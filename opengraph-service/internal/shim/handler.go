package shim

import (
	"context"
	"log"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"
	"time"
)

// Handler is the opengraph-service's HTTP entry point. It is separate from
// cmd/shim/main.go so the full request path can be driven end-to-end by an
// in-process test with indigo and html-to-image stubbed.
type Handler struct {
	Proxy     http.Handler
	Generator *Generator
	Cache     *FileCache
	Origin    string // public site origin for absolute OG URLs
	// GenTimeout bounds the slow path so a stuck upstream cannot hold a
	// connection forever. Defaults to 45s when zero (the production value).
	GenTimeout time.Duration
	// MaxConcurrentGenerate caps in-flight generate-path requests; excess ones
	// fail fast with 503. Zero means DefaultMaxConcurrentGenerate; negative
	// disables the cap, for tests only.
	MaxConcurrentGenerate int
	genSem                chan struct{}
}

// DefaultMaxConcurrentGenerate is sized to protect a single html-to-image
// instance (one Puppeteer at a time) while still letting genuine Cardyb
// concurrency coalesce through singleflight.
const DefaultMaxConcurrentGenerate = 4

// NewHandler wires the handler against an upstream client URL and the injected
// generator/cache. upstreamURL is the client's base URL (e.g. http://client:3000).
// A schemeless value (e.g. "client:3000") is treated as http:// — Railway
// private-network URLs are easy to paste without the scheme, and without this
// default the proxy fails at runtime with "unsupported protocol scheme".
func NewHandler(upstreamURL string, gen *Generator, cache *FileCache, origin string) (*Handler, error) {
	if !strings.Contains(upstreamURL, "://") {
		upstreamURL = "http://" + upstreamURL
	}
	target, err := url.Parse(upstreamURL)
	if err != nil {
		return nil, err
	}
	proxy, err := newCaddyProxy(target)
	if err != nil {
		return nil, err
	}
	h := &Handler{
		Proxy:                 proxy,
		Generator:             gen,
		Cache:                 cache,
		Origin:                origin,
		GenTimeout:            45 * time.Second,
		MaxConcurrentGenerate: DefaultMaxConcurrentGenerate,
	}
	h.initSem()
	return h, nil
}

// initSem (re)builds the generate semaphore from MaxConcurrentGenerate. Called
// by NewHandler and by tests that override the cap on a constructed Handler.
func (h *Handler) initSem() {
	if h.MaxConcurrentGenerate < 0 {
		h.genSem = nil // disabled
		return
	}
	if h.MaxConcurrentGenerate == 0 {
		h.MaxConcurrentGenerate = DefaultMaxConcurrentGenerate
	}
	h.genSem = make(chan struct{}, h.MaxConcurrentGenerate)
}

// ServeHTTP serves /healthz, streams /og-cache/<safe-did>.png from the volume,
// and sends everything else to the generate slow path or the Caddy proxy
// according to Classify.
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch {
	case r.URL.Path == "/healthz":
		h.handleHealthz(w, r)
		return
	case strings.HasPrefix(r.URL.Path, "/og-cache/"):
		h.serveCacheFile(w, r)
		return
	}
	dec := Classify(r.Header.Get("User-Agent"), r.URL.Path)
	if dec != DecisionGenerate {
		h.Proxy.ServeHTTP(w, r)
		return
	}
	h.handleGenerate(w, r)
}

func (h *Handler) handleHealthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("{}"))
}

// handleGenerate runs the slow path. On success it returns HTML whose og:image
// points at the cached PNG. On failure it degrades gracefully: a 404 for an
// unresolvable handle, a 502 for an indigo/render failure, a 503 when the
// concurrent-render cap is hit. Critically, a failure here must NOT panic or
// hang the hot path — the proxy fast path is unaffected.
func (h *Handler) handleGenerate(w http.ResponseWriter, r *http.Request) {
	handle := ProfileHandle(r.URL.Path)
	if handle == "" {
		http.NotFound(w, r)
		return
	}
	// The Cardyb UA is trivially spoofable and singleflight only dedups per
	// handle, so an attacker rotating handles could drive unbounded concurrent
	// renders and exhaust the shared html-to-image service. Failing fast with
	// 503 keeps the proxy path serving; Cardyb retries on its next crawl.
	if h.genSem != nil {
		select {
		case h.genSem <- struct{}{}:
			defer func() { <-h.genSem }()
		default:
			log.Printf("opengraph-service: generate %s rejected: %d concurrent renders in flight",
				handle, cap(h.genSem))
			http.Error(w, "og generation busy", http.StatusServiceUnavailable)
			return
		}
	}
	timeout := h.GenTimeout
	if timeout <= 0 {
		timeout = 45 * time.Second
	}
	ctx, cancel := context.WithTimeout(r.Context(), timeout)
	defer cancel()

	result, err := h.Generator.Generate(ctx, handle)
	if err != nil {
		status := AsHTTPStatus(err)
		log.Printf("opengraph-service: generate %s failed: %v (status %d)", handle, err, status)
		http.Error(w, "og generation failed", status)
		return
	}

	imageURL := "/og-cache/" + SafeDID(result.DID) + ".png"
	htmlResp := BuildOGResponse(ResponseInput{
		ProfileHandle: handle,
		// The display name never reaches this layer — it is used only inside the
		// composite render — so the title falls back to the handle.
		DisplayName: strings.TrimPrefix(handle, "@"),
		ImageURL:    imageURL,
		Origin:      h.Origin,
	})
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	_, _ = w.Write([]byte(htmlResp))
}

// serveCacheFile streams the stored PNG for a /og-cache/:did.png request.
func (h *Handler) serveCacheFile(w http.ResponseWriter, r *http.Request) {
	base := strings.TrimPrefix(r.URL.Path, "/og-cache/")
	base = strings.TrimPrefix(base, "/")
	if base == "" || !strings.HasSuffix(base, ".png") {
		http.NotFound(w, r)
		return
	}
	// Re-sanitized defensively: a crafted URL must not traverse the cache dir.
	safe := h.Cache.SafePathFromBase(base)
	if safe == "" {
		http.NotFound(w, r)
		return
	}
	p := filepath.Join(h.Cache.Dir(), safe)
	entry, err := h.Cache.LoadByPath(p)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", entry.MimeType)
	w.Header().Set("Cache-Control", "public, max-age=86400")
	_, _ = w.Write(entry.Bytes)
}
