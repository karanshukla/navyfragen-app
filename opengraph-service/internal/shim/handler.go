package shim

import (
	"context"
	"log"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"
	"sync"
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
	// GenTimeout bounds one background render so a stuck upstream cannot hold a
	// goroutine forever. Defaults to DefaultGenTimeout when zero.
	GenTimeout time.Duration
	// MaxConcurrentGenerate caps in-flight renders; excess ones are dropped.
	// Zero means DefaultMaxConcurrentGenerate; negative disables the cap, for
	// tests only.
	MaxConcurrentGenerate int
	// PendingRenderWait bounds how long an /og-cache/ request parks on a render
	// that is already in flight before serving the fallback. Zero means
	// DefaultPendingRenderWait; negative disables the wait.
	PendingRenderWait time.Duration
	// BackgroundCtx is the lifetime of fire-and-forget renders rather than any
	// one request's context: main cancels it on shutdown so a render that has
	// not started yet gives up instead of outliving the server. Nil means
	// context.Background().
	BackgroundCtx context.Context

	genSem     chan struct{}
	background sync.WaitGroup
	pending    pendingRenders
}

// DefaultMaxConcurrentGenerate is sized to protect a single html-to-image
// instance (one Puppeteer at a time) while still letting genuine Cardyb
// concurrency coalesce through singleflight.
const DefaultMaxConcurrentGenerate = 4

// DefaultGenTimeout bounds one background render when GenTimeout is unset.
const DefaultGenTimeout = 45 * time.Second

// DefaultPendingRenderWait bounds how long an image fetch parks on a render
// that is already in flight. It is a fraction of DefaultGenTimeout on purpose:
// the wait is spent holding the crawler's own connection, and Cardyb fetches
// the card image exactly once — the bytes it gets are uploaded as a blob into
// the post record, so there is no later fetch to hand a warm cache to. That
// makes waiting worth it, and makes overrunning the crawler's timeout the one
// outcome worse than serving the fallback.
const DefaultPendingRenderWait = 3 * time.Second

// Route prefixes the handler owns outright — they are matched before Classify,
// so neither the Cardyb UA check nor the proxy fast path can shadow them.
const (
	// OGCachePathPrefix serves the stored PNG a generated og:image points at.
	OGCachePathPrefix = "/og-cache/"
	// WarmPathPrefix accepts POST /og-warm/:handle, the client's share-intent
	// warm, so the first real crawl after a share finds a warm cache.
	WarmPathPrefix = "/og-warm/"
)

// Cache-Control for the two things the cache route can serve. The fallback is
// no-store rather than briefly cacheable: it is a placeholder for a render that
// did not land in time, so any consumer willing to ask again must be allowed to
// rather than be pinned to the generic card by a header of ours. Cardyb does
// not re-fetch either way, which is why the wait below — not this header — is
// what actually saves a first share.
const (
	renderedImageCacheControl = "public, max-age=86400"
	fallbackImageCacheControl = "no-store"
)

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
		GenTimeout:            DefaultGenTimeout,
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

// WaitBackground blocks until every fire-and-forget render this handler started
// has finished. main calls it beside srv.Shutdown; a test MUST call it before
// returning, because a render still in flight writes into the t.TempDir() that
// cleanup is already walking (the flake fixed in 4df67ba).
func (h *Handler) WaitBackground() { h.background.Wait() }

// ServeHTTP serves /healthz, streams /og-cache/<safe-did>.png from the volume,
// accepts /og-warm/<handle>, and sends everything else to the generate slow
// path or the Caddy proxy according to Classify.
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch {
	case r.URL.Path == "/healthz":
		h.handleHealthz(w, r)
		return
	case strings.HasPrefix(r.URL.Path, OGCachePathPrefix):
		h.serveCacheFile(w, r)
		return
	case strings.HasPrefix(r.URL.Path, WarmPathPrefix):
		h.handleWarm(w, r)
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

// handleGenerate answers a crawler from the resolved DID alone. A render never
// blocks the HTML response: on a cache miss the same HTML goes out immediately
// and the render runs in the background. The crawl's image fetch is where a
// cold profile is won or lost — serveCacheFile parks it on that render for a
// bounded wait — so the HTML going out first is a head start for the render,
// not a decision to serve the fallback. Only the handle resolution can fail the
// request — a 404 for an unresolvable handle, a 502 for an indigo failure. A
// failure here must NOT panic or hang the hot path; the proxy fast path is
// unaffected.
//
// [TestHandler_CacheMiss_RespondsWithoutAwaitingTheRender] and
// [TestHandler_CacheMiss_BackgroundRenderWarmsTheNextRequest] pin both halves.
func (h *Handler) handleGenerate(w http.ResponseWriter, r *http.Request) {
	handle := ProfileHandle(r.URL.Path)
	if handle == "" {
		http.NotFound(w, r)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), h.genTimeout())
	defer cancel()

	resolved, err := h.Generator.Resolve(ctx, handle)
	if err != nil {
		status := AsHTTPStatus(err)
		log.Printf("opengraph-service: resolve %s failed: %v (status %d)", handle, err, status)
		http.Error(w, "og generation failed", status)
		return
	}
	if !resolved.Cached {
		h.spawnRender(handle, resolved.DID)
	}
	h.writeOGResponse(w, handle, resolved.DID)
}

func (h *Handler) writeOGResponse(w http.ResponseWriter, handle, did string) {
	htmlResp := BuildOGResponse(ResponseInput{
		ProfileHandle: handle,
		// The display name never reaches this layer — it is used only inside the
		// composite render — so the title falls back to the handle.
		DisplayName: strings.TrimPrefix(handle, "@"),
		ImageURL:    OGCachePathPrefix + SafeDID(did) + ".png",
		Origin:      h.Origin,
	})
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	_, _ = w.Write([]byte(htmlResp))
}

// handleWarm accepts a fire-and-forget warm for a profile so the first real
// crawl after a share finds a warm cache instead of the fallback. The response
// is 202 whether or not a render actually started: the caller is a share or
// copy-link handler and must never surface a failure to the user.
//
// This route is unauthenticated, which is the exposure the spoofable Cardyb UA
// already accepts. What keeps that bounded is that it reaches html-to-image
// only through spawnRender, so it shares the render cap with the crawler path
// and is shed rather than queued once that cap is saturated.
//
// Resolution happens on the request, before a slot is taken, exactly as on the
// crawler path. Taking the slot first would let warms for handles that are
// already fresh — or that do not resolve at all — hold the whole cap for a
// generation timeout each, and since spawnRender drops rather than queues, every
// crawl arriving in that window would schedule no render and serve the fallback.
//
// [TestHandler_WarmOnColdProfile_TriggersExactlyOneRender] and
// [TestHandler_WarmOnFreshProfile_TriggersNoRender] pin the no-op-when-warm
// rule; [TestHandler_WarmIsBoundedByTheRenderCap] pins the bound; and
// [TestHandler_WarmOnFreshProfile_HoldsNoRenderSlot] pins that a warm with
// nothing to do leaves the cap alone.
func (h *Handler) handleWarm(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	handle := WarmHandle(r.URL.Path)
	if handle == "" {
		http.NotFound(w, r)
		return
	}
	started := h.warmProfile(r.Context(), handle)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusAccepted)
	if started {
		_, _ = w.Write([]byte(`{"warming":true}`))
		return
	}
	_, _ = w.Write([]byte(`{"warming":false}`))
}

// warmProfile resolves the handle on the caller's context and spawns a render
// only for a profile that has none, reporting whether one started. A resolve
// failure is a warm that did nothing: the caller is a share or copy-link
// handler, and the crawl that follows will surface the same failure properly.
func (h *Handler) warmProfile(reqCtx context.Context, handle string) bool {
	ctx, cancel := context.WithTimeout(reqCtx, h.genTimeout())
	defer cancel()

	resolved, err := h.Generator.Resolve(ctx, handle)
	if err != nil {
		log.Printf("opengraph-service: warm resolve %s failed: %v", handle, err)
		return false
	}
	if resolved.Cached {
		return false
	}
	return h.spawnRender(handle, resolved.DID)
}

// spawnRender renders did in a joinable background goroutine under the render
// cap, reporting whether it started. Both entry points to html-to-image are
// unauthenticated (a spoofable Cardyb UA, and the warm route), and singleflight
// only dedups per DID, so an attacker rotating handles could otherwise drive
// unbounded concurrent renders against the shared service. Work that cannot get
// a slot is dropped, never queued — queueing would move the unbounded growth
// into memory and hand the crawler a stale render minutes later anyway.
//
// The render is registered as pending before the goroutine starts, not inside
// it, so the image fetch that follows this crawl's HTML response can never
// arrive in a window where the render exists but is not yet waitable.
//
// [TestHandler_RenderCap_RunsBackgroundRenderWhenASlotIsFree] and
// [TestHandler_RenderCap_DropsBackgroundRenderWhenSaturated] pin both sides of
// the bound; [TestHandler_DroppedRender_DoesNotParkTheImageFetch] pins that a
// render the cap shed leaves nothing behind to wait on.
func (h *Handler) spawnRender(handle, did string) bool {
	if err := h.backgroundContext().Err(); err != nil {
		return false
	}
	if !h.acquireRenderSlot() {
		log.Printf("opengraph-service: background render for %s dropped: %d concurrent renders in flight",
			handle, cap(h.genSem))
		return false
	}
	donePending := h.pending.begin(SafeDID(did))
	h.background.Add(1)
	go func() {
		defer h.background.Done()
		defer h.releaseRenderSlot()
		defer donePending()
		ctx, cancel := context.WithTimeout(h.backgroundContext(), h.genTimeout())
		defer cancel()
		if err := h.Generator.EnsureRendered(ctx, did); err != nil {
			log.Printf("opengraph-service: background render for %s failed: %v", handle, err)
		}
	}()
	return true
}

func (h *Handler) backgroundContext() context.Context {
	if h.BackgroundCtx != nil {
		return h.BackgroundCtx
	}
	return context.Background()
}

func (h *Handler) genTimeout() time.Duration {
	if h.GenTimeout > 0 {
		return h.GenTimeout
	}
	return DefaultGenTimeout
}

func (h *Handler) pendingRenderWait() time.Duration {
	if h.PendingRenderWait == 0 {
		return DefaultPendingRenderWait
	}
	return h.PendingRenderWait
}

func (h *Handler) acquireRenderSlot() bool {
	if h.genSem == nil {
		return true
	}
	select {
	case h.genSem <- struct{}{}:
		return true
	default:
		return false
	}
}

func (h *Handler) releaseRenderSlot() {
	if h.genSem == nil {
		return
	}
	<-h.genSem
}

// serveCacheFile streams the stored PNG for an /og-cache/:did.png request. A
// DID whose render has not landed yet is not an error — one is usually in
// flight behind it — so a miss waits briefly for that render and, if it does
// not arrive, serves the branded fallback rather than handing the crawler a
// 404. A malformed path is a bad request rather than a pending render and still
// 404s.
//
// [TestHandler_OgCacheMiss_ServesFallbackAsNoStore],
// [TestHandler_OgCacheHit_ServesRenderWithLongMaxAge] and
// [TestHandler_OgCacheMalformedName_Returns404NotFallback] pin all three.
func (h *Handler) serveCacheFile(w http.ResponseWriter, r *http.Request) {
	name := h.cacheFileName(r.URL.Path)
	if name == "" {
		http.NotFound(w, r)
		return
	}
	path := filepath.Join(h.Cache.Dir(), name)
	entry, err := h.Cache.LoadByPath(path)
	if err != nil && h.awaitPendingRender(r.Context(), pendingKey(name)) {
		entry, err = h.Cache.LoadByPath(path)
	}
	if err != nil {
		writeImage(w, "image/png", FallbackOGImage(), fallbackImageCacheControl)
		return
	}
	writeImage(w, entry.MimeType, entry.Bytes, renderedImageCacheControl)
}

// awaitPendingRender parks the request on the render already in flight for key,
// reporting whether it finished within the wait and the cache is therefore
// worth a second look. This is what stops a first share of a cold profile from
// baking the generic fallback into the post record: Cardyb fetches the card
// image once, so the only chance to give it the profile card is while it is
// still holding this connection.
//
// It never starts a render. A DID nobody is rendering answers immediately with
// the fallback, which keeps the wait off requests that could only ever time out
// — including the ones an unauthenticated caller can invent by the thousand.
//
// [TestHandler_OgCacheMiss_WaitsForTheInFlightRenderAndServesIt] pins the win,
// [TestHandler_OgCacheMiss_RenderOutlastsTheWait_ServesFallback] pins the cap,
// [TestHandler_OgCacheMiss_NothingInFlight_ServesFallbackImmediately] pins that
// nothing else waits, [TestHandler_OgCacheMiss_ClientDisconnects_StopsWaiting]
// pins the hangup, and
// [TestHandler_NegativePendingRenderWait_ServesFallbackImmediately] pins the
// off switch.
func (h *Handler) awaitPendingRender(ctx context.Context, key string) bool {
	wait := h.pendingRenderWait()
	if wait <= 0 {
		return false
	}
	done := h.pending.watch(key)
	if done == nil {
		return false
	}
	timer := time.NewTimer(wait)
	defer timer.Stop()
	select {
	case <-done:
		return true
	case <-timer.C:
		return false
	case <-ctx.Done():
		return false
	}
}

// cacheFileName returns the on-disk filename an /og-cache/ request maps to, or
// "" when the request is malformed. Sanitizing is not enough now that a miss is
// answered rather than refused: a name that *changes* under sanitization was a
// traversal or a non-image request, so it is rejected here instead of being
// rewritten into some other DID's miss and served the fallback.
func (h *Handler) cacheFileName(path string) string {
	base := strings.TrimPrefix(path, OGCachePathPrefix)
	if base == "" || strings.ContainsAny(base, `/\`) {
		return ""
	}
	if safe := h.Cache.SafePathFromBase(base); safe == base {
		return safe
	}
	return ""
}

// pendingKey maps a validated /og-cache/ filename back to the key spawnRender
// registered the render under, which is the SafeDID the file is named for.
func pendingKey(name string) string { return strings.TrimSuffix(name, ".png") }

func writeImage(w http.ResponseWriter, mimeType string, body []byte, cacheControl string) {
	w.Header().Set("Content-Type", mimeType)
	w.Header().Set("Cache-Control", cacheControl)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(body)
}
