package shim

import (
	"context"
	"errors"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"path/filepath"
	"strings"
	"time"
)

// Handler is the opengraph-service's HTTP entry point, factored out of
// cmd/shim/main.go so the full request path (classify → proxy / generate →
// cache serve) can be exercised end-to-end by an in-process integration test
// with the external dependencies (indigo, html-to-image) stubbed. The same
// Handler serves production traffic; main.go constructs it and wires it to a
// real *http.Server.
//
// Routes:
//   - GET /healthz → 200 {}
//   - GET /og-cache/<safe-did>.png → cached PNG from the volume
//   - everything else → Classify; DecisionGenerate → slow path, else reverse-proxy.
type Handler struct {
	Proxy     *httputil.ReverseProxy
	Generator *Generator
	Cache     *FileCache
	Origin    string // public site origin for absolute OG URLs
	// GenTimeout bounds the slow path so a stuck upstream cannot hold a
	// connection forever. Defaults to 45s when zero (the production value).
	GenTimeout time.Duration
	// MaxConcurrentGenerate caps the number of generate-path requests that may
	// be in flight at once. Generation is the slow path (indigo resolve + a
	// headless-browser render against the shared html-to-image service). The
	// Cardyb UA can be trivially spoofed, and singleflight only dedups per
	// handle — an attacker rotating handles could otherwise drive unbounded
	// concurrent renders, exhausting html-to-image for legitimate Cardyb
	// traffic. Once the cap is hit, further generate requests fail fast with
	// 503 (the fast proxy path is unaffected — see ServeHTTP). Defaults to
	// DefaultMaxConcurrentGenerate when zero. Set to a negative value to
	// disable the cap (use only in tests).
	MaxConcurrentGenerate int
	genSem                chan struct{}
}

// DefaultMaxConcurrentGenerate bounds concurrent cold-path renders. Sized to
// protect a single html-to-image instance (one Puppeteer at a time) from
// spoofed-Cardyb-driven render storms while still allowing real Cardyb
// concurrency to coalesce via singleflight. Tunable via the Handler field.
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
	proxy := &httputil.ReverseProxy{
		// Director (not Rewrite/NewSingleHostRewrite, which are newer): mutate
		// the inbound request to point at the client upstream. This is the
		// stable API across the supported Go versions.
		Director: func(req *http.Request) {
			req.URL.Scheme = target.Scheme
			req.URL.Host = target.Host
			req.Host = target.Host
		},
		BufferPool:    newBufferPool(),
		FlushInterval: 100 * time.Millisecond,
		// ErrorHandler customizes the body returned when the upstream client is
		// unreachable (connection refused, dial timeout, mid-stream EOF). The
		// stdlib default is a bare 502 with no body and a log line; for the
		// sole frontend upstream we surface a short, stable 502 body and a
		// structured log entry so operators see the upstream is down rather
		// than a silent blank page. This does NOT add retry or a circuit
		// breaker — those are larger changes (and Caddy's lb_retries already
		// hides transient blips upstream of us) — it only improves the
		// observable failure mode.
		ErrorHandler: proxyErrorHandler,
	}
	h := &Handler{
		Proxy:                proxy,
		Generator:            gen,
		Cache:                cache,
		Origin:               origin,
		GenTimeout:           45 * time.Second,
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

// ServeHTTP routes the request per the comments on Handler.
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
	// Bound concurrent cold-path renders so a spoofed-Cardyb render storm
	// (singleflight only dedups per handle; attackers rotate handles) cannot
	// exhaust the shared html-to-image service. When the cap is hit, fail fast
	// with 503 — the proxy fast path keeps serving and Cardyb will retry the
	// link unfurl on its next crawl. Cache hits (the common case after warmup)
	// do NOT hold the slot: we acquire only around the actual generate call.
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
	// Bound the generation so a stuck upstream cannot hold a connection forever.
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
		// The generation path does not surface the display name to the HTTP
		// layer today (it is used only inside the composite render); the title
		// falls back to the handle so the Cardyb-facing HTML is deterministic.
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
	// Path shape: /og-cache/<safe-did>.png
	base := strings.TrimPrefix(r.URL.Path, "/og-cache/")
	base = strings.TrimPrefix(base, "/")
	if base == "" || !strings.HasSuffix(base, ".png") {
		http.NotFound(w, r)
		return
	}
	// The base IS the SafeDID-derived filename. Re-sanitize defensively so a
	// crafted URL cannot traverse the cache dir.
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

// IsErrServerClosed reports whether err is http.ErrServerClosed — the expected
// error from Server.Shutdown. Main callers use this to distinguish graceful
// shutdown from a real listen failure.
func IsErrServerClosed(err error) bool {
	return errors.Is(err, http.ErrServerClosed)
}

// proxyErrorHandler is the ReverseProxy's ErrorHandler: invoked when the
// upstream client connection fails (refused, timed out, EOF mid-response). We
// preserve the stdlib's 502 status but add a short body and a log line so an
// upstream outage is observable from the response rather than a blank page.
// Context cancellation (client disconnect) is intentionally left to the
// stdlib's default (no-op) so a client hang-up does not log as an error.
func proxyErrorHandler(w http.ResponseWriter, r *http.Request, err error) {
	if errors.Is(err, context.Canceled) {
		// Client gave up — not an upstream fault, do not log as one.
		return
	}
	log.Printf("opengraph-service: upstream proxy error for %s %s: %v",
		r.Method, r.URL.Path, err)
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusBadGateway)
	_, _ = w.Write([]byte("upstream unavailable\n"))
}

// smallBufferPool reuses proxy scratch buffers to avoid per-request allocs on
// the hot path.
type bufferPool struct{ ch chan []byte }

func newBufferPool() *bufferPool {
	return &bufferPool{ch: make(chan []byte, 64)}
}

func (p *bufferPool) Get() []byte {
	select {
	case b := <-p.ch:
		return b
	default:
		return make([]byte, 32*1024)
	}
}

func (p *bufferPool) Put(b []byte) {
	select {
	case p.ch <- b:
	default:
	}
}
