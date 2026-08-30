package shim

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

// End-to-end tests over the real HTTP wiring: the ServeHTTP router, the proxy
// in front of a real httptest upstream standing in for the client SPA, the real
// Generator, a real FileCache on a tempdir, and the real BuildOGResponse. Only
// the two network egress points are stubbed — ProfileFetcher (indigo) and
// ImageRenderer (html-to-image).

// newHandlerOn wires a Handler over cache, in front of a real httptest upstream
// standing in for the client SPA.
//
// It registers h.WaitBackground as a cleanup, which every test relies on: a
// background render outliving the test writes into the t.TempDir() backing
// cache while cleanup is already removing it (the flake fixed in 4df67ba).
// Cleanups run LIFO, so this one — registered after the t.TempDir() call that
// built cache — runs before the directory is removed.
func newHandlerOn(t *testing.T, cache *FileCache, fetcher ProfileFetcher, renderer ImageRenderer) *Handler {
	t.Helper()
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = io.WriteString(w, `<!DOCTYPE html><html><head>
<meta property="og:image" content="https://navyfragen.app/og.png">
</head><body>SPA</body></html>`)
	}))
	t.Cleanup(upstream.Close)

	h, err := NewHandler(upstream.URL, NewGenerator(cache, fetcher, renderer), cache, "https://navyfragen.app")
	if err != nil {
		t.Fatalf("NewHandler: %v", err)
	}
	t.Cleanup(h.WaitBackground)
	return h
}

// newIntegrationHandler builds a Handler exactly like main.go but with the
// fetcher/renderer stubbed, on a fresh tempdir-backed cache.
func newIntegrationHandler(t *testing.T, fetcher ProfileFetcher, renderer ImageRenderer) *Handler {
	t.Helper()
	return newHandlerOn(t, newTempCache(t), fetcher, renderer)
}

func newTempCache(t *testing.T) *FileCache {
	t.Helper()
	cache, err := NewFileCache(t.TempDir(), 100, time.Hour)
	if err != nil {
		t.Fatalf("NewFileCache: %v", err)
	}
	return cache
}

// defaultStubs returns the fetcher/renderer the happy path uses: a known DID,
// banner+avatar set, and a deterministic PNG payload.
func defaultStubs() (*FakeFetcher, *FakeRenderer) {
	return &FakeFetcher{
		DID: "did:plc:integration",
		Profile: Profile{
			DisplayName: "Integration User",
			Handle:      "integration.test",
			Banner:      "https://cdn.bsky.app/b.jpg",
			Avatar:      "https://cdn.bsky.app/a.jpg",
		},
	}, &FakeRenderer{PNG: []byte("\x89PNG\r\n\x1a\nFAKE-PNG-BYTES")}
}

// do issues a GET against the handler with the given UA and path.
func do(t *testing.T, h *Handler, ua, path string) *httptest.ResponseRecorder {
	t.Helper()
	return doMethod(t, h, http.MethodGet, ua, path)
}

func doMethod(t *testing.T, h *Handler, method, ua, path string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, nil)
	if ua != "" {
		req.Header.Set("User-Agent", ua)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

// Cardyb on /profile/:handle MUST trigger generation: the response is the
// synthesized OG HTML, not the upstream SPA, and its og:image points at the
// shim's cache path for the resolved DID.
func TestHandler_CardybOnProfile_GeneratesOGResponse(t *testing.T) {
	fetcher, renderer := defaultStubs()
	h := newIntegrationHandler(t, fetcher, renderer)

	rec := do(t, h, "Bluesky Cardyb/1.2", "/profile/integration.test")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	body := rec.Body.String()
	// The synthesized OG response, not the upstream SPA.
	if !strings.Contains(body, `property="og:image"`) {
		t.Fatalf("response missing og:image tag\n--- body ---\n%s", body)
	}
	// og:image must point at the shim's cache path keyed by the resolved DID,
	// absolute (crawlers won't resolve relative URLs).
	const wantImage = "https://navyfragen.app/og-cache/did-plc-integration.png"
	if !strings.Contains(body, wantImage) {
		t.Fatalf("og:image not absolute cache URL\ngot: %s\nwant substring: %s", body, wantImage)
	}
	// Must NOT leak the upstream's generic og:image — that is the whole point of
	// the shim.
	if strings.Contains(body, "og.png") {
		t.Fatalf("response leaked the generic upstream og:image\n--- body ---\n%s", body)
	}
	// The upstream SPA body must not appear in a generated response.
	if strings.Contains(body, "SPA") {
		t.Fatalf("generated response contains upstream body\n--- body ---\n%s", body)
	}
	// The generator's dependencies each fired exactly once on the cold path —
	// the render is now behind the response, so join it before counting.
	h.WaitBackground()
	if c := atomic.LoadInt32(&fetcher.ResolveCalls); c != 1 {
		t.Fatalf("ResolveDID called %d times, want 1", c)
	}
	if c := atomic.LoadInt32(&fetcher.ProfileCalls); c != 1 {
		t.Fatalf("FetchProfile called %d times, want 1", c)
	}
	if c := atomic.LoadInt32(&renderer.Calls); c != 1 {
		t.Fatalf("renderer called %d times, want 1", c)
	}
}

// TestHandler_CacheMiss_RespondsWithoutAwaitingTheRender pins the non-blocking
// half of the decoupling: a crawler that arrives on a cold profile gets its
// HTML while the render is still running, so a slow (or sleeping) html-to-image
// can no longer turn a first crawl into a failed link preview.
func TestHandler_CacheMiss_RespondsWithoutAwaitingTheRender(t *testing.T) {
	fetcher, renderer := defaultStubs()
	started, release := make(chan struct{}, 4), make(chan struct{})
	blocked := &blockingRenderer{FakeRenderer: renderer, startedCh: started, releaseCh: release}
	h := newIntegrationHandler(t, fetcher, blocked)
	defer func() {
		close(release)
		h.WaitBackground()
	}()

	rec := do(t, h, CardybUA, "/profile/integration.test")

	// The response landed with the render still parked inside html-to-image.
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 while the render is still in flight", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "/og-cache/did-plc-integration.png") {
		t.Fatalf("miss response must still point at the DID's cache URL:\n%s", rec.Body.String())
	}
	<-started
	if c := atomic.LoadInt32(&renderer.Calls); c != 0 {
		t.Fatalf("renderer completed %d times, want 0 — the response awaited the render", c)
	}
}

// TestHandler_CacheMiss_BackgroundRenderWarmsTheNextRequest pins the other half:
// the render the first crawl did not wait for lands in the cache, so the next
// crawl is a hit and its og:image URL serves the real bytes.
func TestHandler_CacheMiss_BackgroundRenderWarmsTheNextRequest(t *testing.T) {
	fetcher, renderer := defaultStubs()
	h := newIntegrationHandler(t, fetcher, renderer)

	if rec := do(t, h, CardybUA, "/profile/integration.test"); rec.Code != http.StatusOK {
		t.Fatalf("first crawl: status %d", rec.Code)
	}
	h.WaitBackground()

	imgRec := do(t, h, "Mozilla/5.0", "/og-cache/did-plc-integration.png")
	if imgRec.Code != http.StatusOK {
		t.Fatalf("cache serve: status %d, want 200", imgRec.Code)
	}
	if got := imgRec.Body.String(); got != string(renderer.PNG) {
		t.Fatalf("cache serve returned %q, want the background render's bytes %q", got, renderer.PNG)
	}
	if cc := imgRec.Header().Get("Cache-Control"); cc != renderedImageCacheControl {
		t.Fatalf("Cache-Control = %q, want %q (a real render, not the fallback)", cc, renderedImageCacheControl)
	}
	// The second crawl is a hit: no further render is scheduled.
	if rec := do(t, h, CardybUA, "/profile/integration.test"); rec.Code != http.StatusOK {
		t.Fatalf("second crawl: status %d", rec.Code)
	}
	h.WaitBackground()
	if c := atomic.LoadInt32(&renderer.Calls); c != 1 {
		t.Fatalf("renderer called %d times, want 1 (the warmed cache must skip the render)", c)
	}
}

// Ordinary browser UA on /profile/:handle MUST pass through to the upstream
// unchanged — the acceptance criterion that ordinary /* traffic is unaffected.
func TestHandler_BrowserOnProfile_ProxiesToUpstream(t *testing.T) {
	fetcher, renderer := defaultStubs()
	h := newIntegrationHandler(t, fetcher, renderer)

	rec := do(t, h, "Mozilla/5.0 (Windows NT 10.0)", "/profile/integration.test")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	body := rec.Body.String()
	// The upstream SPA body must be served verbatim — pass-through.
	if !strings.Contains(body, "SPA") {
		t.Fatalf("browser UA should proxy upstream; got\n--- body ---\n%s", body)
	}
	// The generic og:image from the upstream must be intact (no rewrite).
	if !strings.Contains(body, "og.png") {
		t.Fatalf("proxied response missing upstream og:image\n--- body ---\n%s", body)
	}
	// No generation must have fired.
	if c := atomic.LoadInt32(&fetcher.ResolveCalls); c != 0 {
		t.Fatalf("ResolveDID called %d times, want 0 (pass-through)", c)
	}
	if c := atomic.LoadInt32(&renderer.Calls); c != 0 {
		t.Fatalf("renderer called %d times, want 0 (pass-through)", c)
	}
}

// Cardyb on a non-profile route MUST pass through — generation is gated on BOTH
// the UA and the path.
func TestHandler_CardybOnRoot_ProxiesToUpstream(t *testing.T) {
	fetcher, renderer := defaultStubs()
	h := newIntegrationHandler(t, fetcher, renderer)

	for _, p := range []string{"/", "/messages", "/inbox"} {
		rec := do(t, h, "Bluesky Cardyb", p)
		if rec.Code != http.StatusOK {
			t.Fatalf("path %q: status = %d, want 200", p, rec.Code)
		}
		if !strings.Contains(rec.Body.String(), "SPA") {
			t.Fatalf("path %q: Cardyb should proxy (not a profile route); got\n%s", p, rec.Body.String())
		}
	}
	if c := atomic.LoadInt32(&fetcher.ResolveCalls); c != 0 {
		t.Fatalf("ResolveDID called %d times, want 0 (non-profile paths)", c)
	}
}

// /api/* is handled by Caddy upstream of the shim in production, but the shim
// itself must treat it as an ordinary path and proxy it (it never sees /api/*
// in prod, but if it did it must not generate). This guards the property that
// the shim adds no /api/* special-casing that could shadow Caddy's split.
func TestHandler_ApiPath_ProxiesNotGenerates(t *testing.T) {
	fetcher, renderer := defaultStubs()
	h := newIntegrationHandler(t, fetcher, renderer)

	// Even with the Cardyb UA, /api/* must not generate.
	rec := do(t, h, "Bluesky Cardyb", "/api/profile/foo")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "SPA") {
		t.Fatalf("/api/* should proxy even under Cardyb; got\n%s", rec.Body.String())
	}
	if c := atomic.LoadInt32(&fetcher.ResolveCalls); c != 0 {
		t.Fatalf("ResolveDID called %d times, want 0 (/api/*)", c)
	}
}

// A second Cardyb request within TTL MUST be a cache hit: no indigo profile
// read, no render. This is the proof of the "repeat within TTL → cache hit"
// scenario.
func TestHandler_RepeatWithinTTL_CacheHitSkipsFetchAndRender(t *testing.T) {
	fetcher, renderer := defaultStubs()
	h := newIntegrationHandler(t, fetcher, renderer)

	// First request: cold path. Join the background render so the second
	// request genuinely finds a warm cache.
	rec1 := do(t, h, "Bluesky Cardyb", "/profile/integration.test")
	if rec1.Code != http.StatusOK {
		t.Fatalf("first: status %d", rec1.Code)
	}
	h.WaitBackground()
	// Second request: must be a cache hit.
	rec2 := do(t, h, "Bluesky Cardyb", "/profile/integration.test")
	if rec2.Code != http.StatusOK {
		t.Fatalf("second: status %d", rec2.Code)
	}
	h.WaitBackground()
	// Both responses must point at the same cache URL (deterministic by DID).
	if rec1.Body.String() != rec2.Body.String() {
		t.Fatalf("second response differs from first\ngot:  %s\nwant: %s",
			rec2.Body.String(), rec1.Body.String())
	}
	// ResolveDID runs every time (cheap, needed to key the cache), but the
	// profile read and render must have fired exactly once across both.
	if c := atomic.LoadInt32(&fetcher.ResolveCalls); c != 2 {
		t.Fatalf("ResolveDID called %d times, want 2 (once per request)", c)
	}
	if c := atomic.LoadInt32(&fetcher.ProfileCalls); c != 1 {
		t.Fatalf("FetchProfile called %d times, want 1 (second was a cache hit)", c)
	}
	if c := atomic.LoadInt32(&renderer.Calls); c != 1 {
		t.Fatalf("renderer called %d times, want 1 (second was a cache hit)", c)
	}
}

// After the cache entry expires, the next Cardyb request MUST regenerate:
// FetchProfile + Render fire again. This is the committed proof of the
// "expire the entry → regeneration" scenario.
func TestHandler_ExpiredEntry_Regenerates(t *testing.T) {
	cache := newTempCache(t)
	fetcher, renderer := defaultStubs()
	h := newHandlerOn(t, cache, fetcher, renderer)

	// First request: cold path → stores the PNG.
	rec1 := do(t, h, "Bluesky Cardyb", "/profile/integration.test")
	if rec1.Code != http.StatusOK {
		t.Fatalf("first: status %d", rec1.Code)
	}
	h.WaitBackground()
	if c := atomic.LoadInt32(&renderer.Calls); c != 1 {
		t.Fatalf("after first: renderer called %d, want 1", c)
	}

	// Backdate the cached file past TTL — simulates the ~1-month TTL elapsing.
	pngPath := cache.pngPath("did:plc:integration")
	past := time.Now().Add(-2 * time.Hour)
	if err := chtimes(pngPath, past, past); err != nil {
		t.Fatalf("chtimes: %v", err)
	}

	// Second request: the entry is expired → miss → regenerate.
	rec2 := do(t, h, "Bluesky Cardyb", "/profile/integration.test")
	if rec2.Code != http.StatusOK {
		t.Fatalf("second: status %d", rec2.Code)
	}
	h.WaitBackground()
	if c := atomic.LoadInt32(&renderer.Calls); c != 2 {
		t.Fatalf("after second: renderer called %d, want 2 (regeneration)", c)
	}
	if c := atomic.LoadInt32(&fetcher.ProfileCalls); c != 2 {
		t.Fatalf("after second: FetchProfile called %d, want 2 (regeneration)", c)
	}
}

// The synthesized og:image URL must be fetchable from the shim's own cache
// route and return the bytes the renderer produced. This ties the generate
// path to the cache-serve path — the crawler's two-step (fetch HTML, then fetch
// the image) is the real end-to-end contract.
func TestHandler_GeneratedImageURL_ServesCachedPNG(t *testing.T) {
	fetcher, renderer := defaultStubs()
	png := []byte("\x89PNG\r\n\x1a\nFAKE-PNG-BYTES")
	renderer.PNG = png
	h := newIntegrationHandler(t, fetcher, renderer)

	// Step 1: Cardyb fetches the profile HTML → schedules generation + caching.
	rec := do(t, h, "Bluesky Cardyb", "/profile/integration.test")
	if rec.Code != http.StatusOK {
		t.Fatalf("generate: status %d", rec.Code)
	}
	h.WaitBackground()

	// Step 2: Cardyb fetches the og:image URL. The crawler uses any UA (it's
	// already past the bot policy); exercise the cache route directly.
	imgRec := do(t, h, "Mozilla/5.0", "/og-cache/did-plc-integration.png")
	if imgRec.Code != http.StatusOK {
		t.Fatalf("cache serve: status %d, want 200", imgRec.Code)
	}
	got := imgRec.Body.String()
	if !strings.HasPrefix(got, "\x89PNG") {
		t.Fatalf("served bytes are not a PNG: %q", got)
	}
	if got != string(png) {
		t.Fatalf("served PNG mismatch\ngot:  %q\nwant: %q", got, png)
	}
	if ct := imgRec.Header().Get("Content-Type"); ct != "image/png" {
		t.Fatalf("Content-Type = %q, want image/png", ct)
	}
}

// An unresolvable handle surfaces as a 404, and critically does NOT panic or
// hang the handler. Resolution is the only failure a crawler can still see —
// its render-failure counterpart is
// TestHandler_RenderFailure_StillAnswersTheCrawler.
func TestHandler_UnresolvableHandle_Returns404AndDoesNotPanic(t *testing.T) {
	fetcher, renderer := defaultStubs()
	fetcher.ResolveErr = ErrProfileNotFound
	h := newIntegrationHandler(t, fetcher, renderer)

	rec := do(t, h, "Bluesky Cardyb", "/profile/nobody.bsky.social")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404 for unresolvable handle", rec.Code)
	}
	h.WaitBackground()
	// The profile read and renderer must not have fired.
	if c := atomic.LoadInt32(&fetcher.ProfileCalls); c != 0 {
		t.Fatalf("FetchProfile called %d, want 0", c)
	}
	if c := atomic.LoadInt32(&renderer.Calls); c != 0 {
		t.Fatalf("renderer called %d, want 0", c)
	}
}

// A render failure is no longer on the crawler's path, so it must not reach the
// crawler: the HTML is still 200 and the image URL still resolves — to the
// branded fallback, since nothing was ever stored.
func TestHandler_RenderFailure_StillAnswersTheCrawler(t *testing.T) {
	fetcher, renderer := defaultStubs()
	renderer.Err = errRenderBoom
	h := newIntegrationHandler(t, fetcher, renderer)

	rec := do(t, h, "Bluesky Cardyb", "/profile/integration.test")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 — a failed render must not reach the crawler", rec.Code)
	}
	h.WaitBackground()

	imgRec := do(t, h, "Mozilla/5.0", "/og-cache/did-plc-integration.png")
	if imgRec.Code != http.StatusOK {
		t.Fatalf("cache serve: status %d, want 200 (the fallback)", imgRec.Code)
	}
	if !bytes.Equal(imgRec.Body.Bytes(), FallbackOGImage()) {
		t.Fatal("a failed render must leave the branded fallback in place")
	}
}

// errRenderBoom is a sentinel for the renderer-failure path; FakeRenderer wraps
// it with ErrRenderFailed (matching the real renderer's contract).
var errRenderBoom = newSentinelErr("render boom")

func newSentinelErr(msg string) error {
	return &sentinelErr{msg: msg}
}

type sentinelErr struct{ msg string }

func (e *sentinelErr) Error() string { return e.msg }

// TestHandler_OgCacheMiss_ServesFallbackAsNoStore pins the inverse fix for the
// crawler: a DID with no render is not an error, so the route answers with the
// branded card rather than a 404 — and answers it uncacheable, so a consumer
// that would come back for the real render is never held to the generic card by
// a header of ours.
func TestHandler_OgCacheMiss_ServesFallbackAsNoStore(t *testing.T) {
	fetcher, renderer := defaultStubs()
	h := newIntegrationHandler(t, fetcher, renderer)

	rec := do(t, h, "Mozilla/5.0", "/og-cache/did-plc-never-rendered.png")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (fallback, not 404)", rec.Code)
	}
	if !bytes.Equal(rec.Body.Bytes(), FallbackOGImage()) {
		t.Fatalf("body is not the embedded fallback (%d bytes served, %d embedded)",
			rec.Body.Len(), len(FallbackOGImage()))
	}
	if !bytes.HasPrefix(rec.Body.Bytes(), []byte("\x89PNG")) {
		t.Fatal("the fallback must be a real PNG — a crawler discards anything else")
	}
	if ct := rec.Header().Get("Content-Type"); ct != "image/png" {
		t.Fatalf("Content-Type = %q, want image/png", ct)
	}
	if cc := rec.Header().Get("Cache-Control"); cc != "no-store" {
		t.Fatalf("Cache-Control = %q, want no-store — the fallback must never be cached as the profile's card", cc)
	}
}

// TestHandler_OgCacheMiss_WaitsForTheInFlightRenderAndServesIt is the fix for
// the cache poisoning in #371: Cardyb fetches the card image exactly once and
// uploads those bytes into the post record, so a first share of a cold profile
// used to pin the generic fallback permanently. The image fetch now parks on the
// render already running behind the OG HTML and serves it when it lands.
//
// The 40ms release is one-directional: a scheduler slow enough to let the render
// finish first makes this test prove less, never fail.
func TestHandler_OgCacheMiss_WaitsForTheInFlightRenderAndServesIt(t *testing.T) {
	fetcher, renderer := defaultStubs()
	started, release := make(chan struct{}, 4), make(chan struct{})
	blocked := &blockingRenderer{FakeRenderer: renderer, startedCh: started, releaseCh: release}
	h := newIntegrationHandler(t, fetcher, blocked)
	h.PendingRenderWait = 5 * time.Second

	if rec := do(t, h, CardybUA, "/profile/integration.test"); rec.Code != http.StatusOK {
		t.Fatalf("crawl: status %d", rec.Code)
	}
	<-started
	if c := atomic.LoadInt32(&renderer.Calls); c != 0 {
		t.Fatalf("renderer completed %d times before the image fetch — nothing was left to wait on", c)
	}
	go func() {
		time.Sleep(40 * time.Millisecond)
		close(release)
	}()

	imgRec := do(t, h, "Mozilla/5.0", "/og-cache/did-plc-integration.png")

	if imgRec.Code != http.StatusOK {
		t.Fatalf("cache serve: status %d, want 200", imgRec.Code)
	}
	if got := imgRec.Body.String(); got != string(renderer.PNG) {
		t.Fatalf("served %q, want the render this fetch waited for %q", got, renderer.PNG)
	}
	if cc := imgRec.Header().Get("Cache-Control"); cc != renderedImageCacheControl {
		t.Fatalf("Cache-Control = %q, want %q (a real render, not the fallback)", cc, renderedImageCacheControl)
	}
}

// TestHandler_OgCacheMiss_RenderOutlastsTheWait_ServesFallback is the cap on the
// wait: a render still running past PendingRenderWait gives the fallback, so a
// cold Railway wake plus a Chromium launch cannot hold the crawler's connection
// past its own timeout and turn a fallback card into no card at all.
func TestHandler_OgCacheMiss_RenderOutlastsTheWait_ServesFallback(t *testing.T) {
	fetcher, renderer := defaultStubs()
	started, release := make(chan struct{}, 4), make(chan struct{})
	blocked := &blockingRenderer{FakeRenderer: renderer, startedCh: started, releaseCh: release}
	h := newIntegrationHandler(t, fetcher, blocked)
	h.PendingRenderWait = 20 * time.Millisecond
	defer close(release)

	if rec := do(t, h, CardybUA, "/profile/integration.test"); rec.Code != http.StatusOK {
		t.Fatalf("crawl: status %d", rec.Code)
	}
	<-started

	imgRec := do(t, h, "Mozilla/5.0", "/og-cache/did-plc-integration.png")

	if imgRec.Code != http.StatusOK {
		t.Fatalf("cache serve: status %d, want 200 (the fallback)", imgRec.Code)
	}
	if !bytes.Equal(imgRec.Body.Bytes(), FallbackOGImage()) {
		t.Fatal("a render that outlasts the wait must fall back, not hold the crawler")
	}
}

// TestHandler_OgCacheMiss_NothingInFlight_ServesFallbackImmediately keeps the
// wait off every request it could not possibly help. The route is
// unauthenticated and takes an arbitrary DID, so parking on one nobody is
// rendering would let anyone hold connections open a wait at a time.
func TestHandler_OgCacheMiss_NothingInFlight_ServesFallbackImmediately(t *testing.T) {
	fetcher, renderer := defaultStubs()
	h := newIntegrationHandler(t, fetcher, renderer)
	// Long enough that taking the wait is unmistakable rather than a slow machine.
	h.PendingRenderWait = time.Minute

	start := time.Now()
	rec := do(t, h, "Mozilla/5.0", "/og-cache/did-plc-nobody-is-rendering.png")
	elapsed := time.Since(start)

	if !bytes.Equal(rec.Body.Bytes(), FallbackOGImage()) {
		t.Fatal("a DID with no render in flight must get the fallback")
	}
	if elapsed > 5*time.Second {
		t.Fatalf("waited %s on a render that does not exist", elapsed)
	}
}

// TestHandler_OgCacheMiss_ClientDisconnects_StopsWaiting releases the wait when
// the crawler hangs up. Serving a fallback nobody will read costs a goroutine;
// holding it for the rest of the wait costs one for every crawler that gave up.
func TestHandler_OgCacheMiss_ClientDisconnects_StopsWaiting(t *testing.T) {
	fetcher, renderer := defaultStubs()
	started, release := make(chan struct{}, 4), make(chan struct{})
	blocked := &blockingRenderer{FakeRenderer: renderer, startedCh: started, releaseCh: release}
	h := newIntegrationHandler(t, fetcher, blocked)
	h.PendingRenderWait = time.Minute
	defer close(release)

	if rec := do(t, h, CardybUA, "/profile/integration.test"); rec.Code != http.StatusOK {
		t.Fatalf("crawl: status %d", rec.Code)
	}
	<-started

	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		time.Sleep(20 * time.Millisecond)
		cancel()
	}()
	req := httptest.NewRequest(http.MethodGet, "/og-cache/did-plc-integration.png", nil).WithContext(ctx)
	rec := httptest.NewRecorder()
	start := time.Now()
	h.ServeHTTP(rec, req)
	elapsed := time.Since(start)
	cancel()

	if elapsed > 5*time.Second {
		t.Fatalf("kept waiting %s after the client went away", elapsed)
	}
	if !bytes.Equal(rec.Body.Bytes(), FallbackOGImage()) {
		t.Fatal("an abandoned wait must still resolve to the fallback, not hang or 404")
	}
}

// TestHandler_NegativePendingRenderWait_ServesFallbackImmediately pins the
// escape hatch. If the wait ever turns out to overrun Cardyb's own timeout —
// which is not published, so this is a guess until production says otherwise —
// a negative value reverts the route to answering every miss immediately, with
// a render in flight for that exact DID.
func TestHandler_NegativePendingRenderWait_ServesFallbackImmediately(t *testing.T) {
	fetcher, renderer := defaultStubs()
	started, release := make(chan struct{}, 4), make(chan struct{})
	blocked := &blockingRenderer{FakeRenderer: renderer, startedCh: started, releaseCh: release}
	h := newIntegrationHandler(t, fetcher, blocked)
	h.PendingRenderWait = -1
	defer close(release)

	if rec := do(t, h, CardybUA, "/profile/integration.test"); rec.Code != http.StatusOK {
		t.Fatalf("crawl: status %d", rec.Code)
	}
	<-started

	rec := do(t, h, "Mozilla/5.0", "/og-cache/did-plc-integration.png")

	if !bytes.Equal(rec.Body.Bytes(), FallbackOGImage()) {
		t.Fatal("a disabled wait must serve the fallback rather than park on the render")
	}
}

// TestHandler_DroppedRender_DoesNotParkTheImageFetch joins the wait to the
// render cap: a render the cap shed was never registered, so the image fetch
// behind it answers immediately instead of waiting out a render that will never
// run.
func TestHandler_DroppedRender_DoesNotParkTheImageFetch(t *testing.T) {
	fetcher, renderer := defaultStubs()
	started, release := make(chan struct{}, 8), make(chan struct{})
	blocked := &blockingRenderer{FakeRenderer: renderer, startedCh: started, releaseCh: release}
	h := newHandlerOn(t, newTempCache(t), &handleDIDFetcher{FakeFetcher: fetcher}, blocked)
	h.MaxConcurrentGenerate = 1
	h.initSem()
	h.PendingRenderWait = time.Minute
	defer close(release)

	// Leader: parked inside the renderer, holding the only slot.
	if rec := do(t, h, CardybUA, "/profile/leader.test"); rec.Code != http.StatusOK {
		t.Fatalf("leader: status %d", rec.Code)
	}
	<-started
	// Follower: a different DID, so its render is shed rather than coalesced.
	if rec := do(t, h, CardybUA, "/profile/follower.test"); rec.Code != http.StatusOK {
		t.Fatalf("follower: status %d", rec.Code)
	}

	start := time.Now()
	rec := do(t, h, "Mozilla/5.0", "/og-cache/did-plc-follower-test.png")
	elapsed := time.Since(start)

	if !bytes.Equal(rec.Body.Bytes(), FallbackOGImage()) {
		t.Fatal("a shed render must leave the fallback in place")
	}
	if elapsed > 5*time.Second {
		t.Fatalf("waited %s on a render the cap dropped", elapsed)
	}
}

// TestHandler_WarmThenCrawl_ImageFetchWaitsOnTheWarmsRender is the sequence a
// share actually produces: the client warms on copy, Cardyb crawls moments
// later. The crawl's image fetch has to park on the warm's render — it is the
// same DID, so singleflight means there is only ever one render to wait for.
func TestHandler_WarmThenCrawl_ImageFetchWaitsOnTheWarmsRender(t *testing.T) {
	fetcher, renderer := defaultStubs()
	started, release := make(chan struct{}, 4), make(chan struct{})
	blocked := &blockingRenderer{FakeRenderer: renderer, startedCh: started, releaseCh: release}
	h := newIntegrationHandler(t, fetcher, blocked)
	h.PendingRenderWait = 5 * time.Second

	if rec := doMethod(t, h, http.MethodPost, "", "/og-warm/integration.test"); rec.Code != http.StatusAccepted {
		t.Fatalf("warm: status %d", rec.Code)
	}
	<-started
	go func() {
		time.Sleep(40 * time.Millisecond)
		close(release)
	}()

	if rec := do(t, h, CardybUA, "/profile/integration.test"); rec.Code != http.StatusOK {
		t.Fatalf("crawl: status %d", rec.Code)
	}
	imgRec := do(t, h, "Mozilla/5.0", "/og-cache/did-plc-integration.png")

	if got := imgRec.Body.String(); got != string(renderer.PNG) {
		t.Fatalf("served %q, want the warm's render %q", got, renderer.PNG)
	}
	h.WaitBackground()
	if c := atomic.LoadInt32(&renderer.Calls); c != 1 {
		t.Fatalf("renderer called %d times, want 1 (the crawl must join the warm's render)", c)
	}
}

// The other side of the boundary: a DID that HAS been rendered serves the real
// bytes under the long max-age, so the fallback's short TTL never leaks onto a
// finished render.
func TestHandler_OgCacheHit_ServesRenderWithLongMaxAge(t *testing.T) {
	cache := newTempCache(t)
	fetcher, renderer := defaultStubs()
	h := newHandlerOn(t, cache, fetcher, renderer)
	if err := cache.Store("did:plc:integration", []byte("\x89PNGREAL"), "image/png"); err != nil {
		t.Fatalf("Store: %v", err)
	}

	rec := do(t, h, "Mozilla/5.0", "/og-cache/did-plc-integration.png")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if rec.Body.String() != "\x89PNGREAL" {
		t.Fatalf("body = %q, want the stored render", rec.Body.String())
	}
	if cc := rec.Header().Get("Cache-Control"); cc != renderedImageCacheControl {
		t.Fatalf("Cache-Control = %q, want %q", cc, renderedImageCacheControl)
	}
}

func TestHandler_OgCacheTraversal_Returns404(t *testing.T) {
	fetcher, renderer := defaultStubs()
	h := newIntegrationHandler(t, fetcher, renderer)

	for _, p := range []string{
		"/og-cache/../../etc/passwd",
		"/og-cache/..%2f..%2fetc%2fpasswd.png",
		"/og-cache/%2e%2e%2f.png",
	} {
		rec := do(t, h, "", p)
		if rec.Code != http.StatusNotFound {
			t.Fatalf("path %q: status = %d, want 404 (traversal must be neutralized)", p, rec.Code)
		}
	}
}

// TestHandler_OgCacheMalformedName_Returns404NotFallback is the boundary the
// fallback must not cross: it answers "not rendered yet", never "bad request".
// A name that changes under sanitization is a request for something that was
// never a cache key, so serving it the fallback would report success for a URL
// the shim never issued.
func TestHandler_OgCacheMalformedName_Returns404NotFallback(t *testing.T) {
	fetcher, renderer := defaultStubs()
	h := newIntegrationHandler(t, fetcher, renderer)

	for _, p := range []string{
		"/og-cache/",              // no name at all
		"/og-cache/did-plc-a.jpg", // not a PNG
		"/og-cache/did-plc-a",     // no extension
		"/og-cache/did..plc.png",  // a stem SafeDID would rewrite
		"/og-cache//did-plc-a.png",
		`/og-cache/sub\dir.png`,
	} {
		rec := do(t, h, "", p)
		if rec.Code != http.StatusNotFound {
			t.Fatalf("path %q: status = %d, want 404 (malformed is not a pending render)", p, rec.Code)
		}
		if bytes.Equal(rec.Body.Bytes(), FallbackOGImage()) {
			t.Fatalf("path %q: served the fallback for a malformed request", p)
		}
	}
}

func TestHandler_Healthz(t *testing.T) {
	fetcher, renderer := defaultStubs()
	h := newIntegrationHandler(t, fetcher, renderer)

	rec := do(t, h, "", "/healthz")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
		t.Fatalf("Content-Type = %q, want application/json", ct)
	}
	if rec.Body.String() != "{}" {
		t.Fatalf("healthz body = %q, want {}", rec.Body.String())
	}
}

// TestHandler_WarmOnColdProfile_TriggersExactlyOneRender pins the share-intent
// warm: one POST turns a cold profile into a warm cache, and the response does
// not wait for it.
func TestHandler_WarmOnColdProfile_TriggersExactlyOneRender(t *testing.T) {
	cache := newTempCache(t)
	fetcher, renderer := defaultStubs()
	h := newHandlerOn(t, cache, fetcher, renderer)

	rec := doMethod(t, h, http.MethodPost, "", "/og-warm/integration.test")

	if rec.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want 202", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
		t.Fatalf("Content-Type = %q, want application/json", ct)
	}
	if body := rec.Body.String(); body != `{"warming":true}` {
		t.Fatalf("body = %q, want {\"warming\":true}", body)
	}
	h.WaitBackground()
	if c := atomic.LoadInt32(&renderer.Calls); c != 1 {
		t.Fatalf("renderer called %d times, want exactly 1", c)
	}
	if _, err := cache.Load("did:plc:integration"); err != nil {
		t.Fatalf("the warm must have populated the cache: %v", err)
	}
}

// The other side of the boundary: warming an already-fresh profile is a no-op,
// so a user who shares the same link repeatedly cannot drive repeated renders.
func TestHandler_WarmOnFreshProfile_TriggersNoRender(t *testing.T) {
	cache := newTempCache(t)
	fetcher, renderer := defaultStubs()
	h := newHandlerOn(t, cache, fetcher, renderer)
	if err := cache.Store("did:plc:integration", []byte("\x89PNGREAL"), "image/png"); err != nil {
		t.Fatalf("Store: %v", err)
	}

	rec := doMethod(t, h, http.MethodPost, "", "/og-warm/integration.test")
	if rec.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want 202", rec.Code)
	}
	h.WaitBackground()

	if c := atomic.LoadInt32(&fetcher.ProfileCalls); c != 0 {
		t.Fatalf("FetchProfile called %d times, want 0 on an already-fresh profile", c)
	}
	if c := atomic.LoadInt32(&renderer.Calls); c != 0 {
		t.Fatalf("renderer called %d times, want 0 on an already-fresh profile", c)
	}
	entry, err := cache.Load("did:plc:integration")
	if err != nil || string(entry.Bytes) != "\x89PNGREAL" {
		t.Fatalf("the warm must have left the existing render untouched (%v)", err)
	}
}

// A warm only takes a render slot once it knows there is a render to run.
// Acquiring first and resolving inside the goroutine let warms for fresh or
// unresolvable handles hold the whole cap for a generation timeout each, and
// spawnRender drops rather than queues, so every crawl arriving in that window
// scheduled no render and served the fallback card.
func TestHandler_WarmOnFreshProfile_HoldsNoRenderSlot(t *testing.T) {
	cache := newTempCache(t)
	fetcher, renderer := defaultStubs()
	h := newHandlerOn(t, cache, fetcher, renderer)
	h.MaxConcurrentGenerate = 1
	h.initSem()
	if err := cache.Store("did:plc:integration", []byte("\x89PNGREAL"), "image/png"); err != nil {
		t.Fatalf("Store: %v", err)
	}

	rec := doMethod(t, h, http.MethodPost, "", "/og-warm/integration.test")
	if rec.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want 202", rec.Code)
	}
	if body := rec.Body.String(); body != `{"warming":false}` {
		t.Fatalf("body = %q, want {\"warming\":false} — a fresh profile takes no render slot", body)
	}
	h.WaitBackground()
}

func TestHandler_WarmWithNonPostMethod_Returns405(t *testing.T) {
	fetcher, renderer := defaultStubs()
	h := newIntegrationHandler(t, fetcher, renderer)

	for _, method := range []string{http.MethodGet, http.MethodPut, http.MethodDelete, http.MethodPatch} {
		rec := doMethod(t, h, method, "", "/og-warm/integration.test")
		if rec.Code != http.StatusMethodNotAllowed {
			t.Fatalf("%s /og-warm: status = %d, want 405", method, rec.Code)
		}
		if allow := rec.Header().Get("Allow"); allow != http.MethodPost {
			t.Fatalf("%s /og-warm: Allow = %q, want POST", method, allow)
		}
	}
	h.WaitBackground()
	if c := atomic.LoadInt32(&renderer.Calls); c != 0 {
		t.Fatalf("renderer called %d times, want 0 — a rejected method must not warm", c)
	}
}

func TestHandler_WarmWithEmptyHandle_Returns404(t *testing.T) {
	fetcher, renderer := defaultStubs()
	h := newIntegrationHandler(t, fetcher, renderer)

	for _, p := range []string{"/og-warm/", "/og-warm/a/b"} {
		rec := doMethod(t, h, http.MethodPost, "", p)
		if rec.Code != http.StatusNotFound {
			t.Fatalf("POST %s: status = %d, want 404", p, rec.Code)
		}
	}
	h.WaitBackground()
	if c := atomic.LoadInt32(&fetcher.ResolveCalls); c != 0 {
		t.Fatalf("ResolveDID called %d times, want 0 — an empty handle must not reach the AppView", c)
	}
}

// A warm whose profile cannot be resolved must still answer 202: the caller is
// a share handler and the failure must never surface in the UI.
func TestHandler_WarmFailure_StillAccepts(t *testing.T) {
	fetcher, renderer := defaultStubs()
	fetcher.ResolveErr = ErrProfileNotFound
	h := newIntegrationHandler(t, fetcher, renderer)

	rec := doMethod(t, h, http.MethodPost, "", "/og-warm/nobody.bsky.social")
	if rec.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want 202 even when the warm cannot succeed", rec.Code)
	}
	// A handle that does not resolve has no render to run, so it must not have
	// taken a slot the crawler path needs.
	if body := rec.Body.String(); body != `{"warming":false}` {
		t.Fatalf("body = %q, want {\"warming\":false} when the handle does not resolve", body)
	}
	h.WaitBackground()
	if c := atomic.LoadInt32(&renderer.Calls); c != 0 {
		t.Fatalf("renderer called %d times, want 0", c)
	}
}

// TestHandler_WarmIsBoundedByTheRenderCap pins the claim that makes an
// unauthenticated warm route acceptable: it reaches html-to-image only through
// the same cap as the crawler path, so a saturated service sheds warms instead
// of multiplying renders.
func TestHandler_WarmIsBoundedByTheRenderCap(t *testing.T) {
	fetcher, renderer := defaultStubs()
	started, release := make(chan struct{}, 8), make(chan struct{})
	blocked := &blockingRenderer{FakeRenderer: renderer, startedCh: started, releaseCh: release}
	h := newHandlerOn(t, newTempCache(t), &handleDIDFetcher{FakeFetcher: fetcher}, blocked)
	h.MaxConcurrentGenerate = 1
	h.initSem()

	// Saturate the single slot with a warm, and hold it inside the renderer.
	if rec := doMethod(t, h, http.MethodPost, "", "/og-warm/first.test"); rec.Code != http.StatusAccepted {
		t.Fatalf("first warm: status %d", rec.Code)
	}
	<-started
	defer func() {
		close(release)
		h.WaitBackground()
	}()

	rec := doMethod(t, h, http.MethodPost, "", "/og-warm/second.test")
	if rec.Code != http.StatusAccepted {
		t.Fatalf("a shed warm must still be accepted, got %d", rec.Code)
	}
	if body := rec.Body.String(); body != `{"warming":false}` {
		t.Fatalf("body = %q, want {\"warming\":false} when the cap sheds the warm", body)
	}
}

// TestHandler_RenderCap_RunsBackgroundRenderWhenASlotIsFree is the inside of the
// cap's boundary: with a slot free, a crawl's background render runs.
func TestHandler_RenderCap_RunsBackgroundRenderWhenASlotIsFree(t *testing.T) {
	fetcher, renderer := defaultStubs()
	h := newHandlerOn(t, newTempCache(t), &handleDIDFetcher{FakeFetcher: fetcher}, renderer)
	h.MaxConcurrentGenerate = 1
	h.initSem()

	if rec := do(t, h, CardybUA, "/profile/first.test"); rec.Code != http.StatusOK {
		t.Fatalf("status %d", rec.Code)
	}
	h.WaitBackground()
	if c := atomic.LoadInt32(&renderer.Calls); c != 1 {
		t.Fatalf("renderer called %d times, want 1 (a free slot must run the render)", c)
	}
}

// TestHandler_RenderCap_DropsBackgroundRenderWhenSaturated is the outside: with
// the cap saturated the crawler is still answered — it never waited on a render
// — but the excess render is dropped rather than queued. This is the spoofed-
// Cardyb guard: singleflight only dedups per DID, so an attacker rotating
// handles would otherwise drive unbounded concurrent renders.
func TestHandler_RenderCap_DropsBackgroundRenderWhenSaturated(t *testing.T) {
	fetcher, renderer := defaultStubs()
	started, release := make(chan struct{}, 8), make(chan struct{})
	blocked := &blockingRenderer{FakeRenderer: renderer, startedCh: started, releaseCh: release}
	h := newHandlerOn(t, newTempCache(t), &handleDIDFetcher{FakeFetcher: fetcher}, blocked)
	h.MaxConcurrentGenerate = 1
	h.initSem()

	// Leader: holds the only slot inside the renderer.
	if rec := do(t, h, CardybUA, "/profile/leader.test"); rec.Code != http.StatusOK {
		t.Fatalf("leader: status %d", rec.Code)
	}
	<-started
	defer func() {
		close(release)
		h.WaitBackground()
	}()

	// Follower: a different DID, so singleflight cannot coalesce it away.
	rec := do(t, h, CardybUA, "/profile/follower.test")
	if rec.Code != http.StatusOK {
		t.Fatalf("a shed render must not fail the crawler, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "/og-cache/did-plc-follower-test.png") {
		t.Fatalf("the follower must still be pointed at its own cache URL:\n%s", rec.Body.String())
	}
	select {
	case <-started:
		t.Fatal("a second render started while the cap was saturated")
	case <-time.After(50 * time.Millisecond):
	}
}

// TestHandler_RenderCap_ProxyUnaffected confirms the cap gates only rendering —
// ordinary proxy traffic is never blocked even when the cap is fully saturated.
func TestHandler_RenderCap_ProxyUnaffected(t *testing.T) {
	fetcher, renderer := defaultStubs()
	started, release := make(chan struct{}, 8), make(chan struct{})
	blocked := &blockingRenderer{FakeRenderer: renderer, startedCh: started, releaseCh: release}
	h := newHandlerOn(t, newTempCache(t), &handleDIDFetcher{FakeFetcher: fetcher}, blocked)
	h.MaxConcurrentGenerate = 1
	h.initSem()

	if rec := do(t, h, CardybUA, "/profile/busy.test"); rec.Code != http.StatusOK {
		t.Fatalf("saturating request: status %d", rec.Code)
	}
	<-started
	defer func() {
		close(release)
		h.WaitBackground()
	}()

	// Ordinary proxy traffic (browser UA) must succeed — the cap is render-only.
	rec := do(t, h, "Mozilla/5.0", "/some/path")
	if rec.Code != http.StatusOK {
		t.Fatalf("proxy fast path must not be gated by the render cap, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "SPA") {
		t.Fatalf("proxy fast path did not reach upstream: %q", rec.Body.String())
	}
}

// TestHandler_CancelledBackgroundContext_DropsNewRenders pins the shutdown
// lifecycle: once main cancels the background context, a render that has not
// started is not started at all, so nothing can be writing to the cache volume
// after WaitBackground returns.
func TestHandler_CancelledBackgroundContext_DropsNewRenders(t *testing.T) {
	fetcher, renderer := defaultStubs()
	h := newIntegrationHandler(t, fetcher, renderer)
	ctx, cancel := context.WithCancel(context.Background())
	h.BackgroundCtx = ctx
	cancel()

	rec := do(t, h, CardybUA, "/profile/integration.test")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 — shutdown must not fail the crawler", rec.Code)
	}
	h.WaitBackground()
	if c := atomic.LoadInt32(&renderer.Calls); c != 0 {
		t.Fatalf("renderer called %d times, want 0 after the background context was cancelled", c)
	}
}

// blockingRenderer wraps FakeRenderer and blocks Render until releaseCh is
// closed, signaling startedCh once it has entered the call. Used to hold a
// render slot deterministically in concurrency tests. The wrapped FakeRenderer's
// Calls counter only advances once a render actually completes, which is what
// lets a test distinguish "started" from "finished".
type blockingRenderer struct {
	*FakeRenderer
	startedCh chan<- struct{}
	releaseCh <-chan struct{}
}

func (b *blockingRenderer) Render(ctx context.Context, html string) ([]byte, error) {
	select {
	case b.startedCh <- struct{}{}:
	default:
	}
	select {
	case <-b.releaseCh:
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	return b.FakeRenderer.Render(ctx, html)
}

// handleDIDFetcher gives every handle its own DID. Cap tests need it: with one
// shared DID, singleflight would coalesce two requests and a broken cap would
// still look like it was holding.
type handleDIDFetcher struct{ *FakeFetcher }

func (f *handleDIDFetcher) ResolveDID(ctx context.Context, handle string) (string, error) {
	if _, err := f.FakeFetcher.ResolveDID(ctx, handle); err != nil {
		return "", err
	}
	return "did:plc:" + strings.ReplaceAll(handle, ".", "-"), nil
}

//
// Railway private-network URLs are easy to paste without the http:// scheme
// (e.g. "client.railway.internal:3000"). Without defaulting, the reverse
// proxy's Director sets an empty scheme and every request fails at runtime
// with "unsupported protocol scheme" — taking the whole frontend down. This
// guards against that class of misconfiguration by defaulting to http.

func TestNewHandler_BareHostnameDefaultsToHTTP(t *testing.T) {
	fetcher, renderer := defaultStubs()
	cache := newTempCache(t)
	gen := NewGenerator(cache, fetcher, renderer)

	// Real upstream to prove the proxy actually reaches it once the scheme is
	// defaulted — a bare hostname must behave like http://<host>.
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, "ok")
	}))
	t.Cleanup(upstream.Close)

	// Strip the http:// from the httptest URL to simulate the bare-hostname case.
	bare := strings.TrimPrefix(upstream.URL, "http://")
	h, err := NewHandler(bare, gen, cache, "https://navyfragen.app")
	if err != nil {
		t.Fatalf("NewHandler with bare hostname: %v", err)
	}
	t.Cleanup(h.WaitBackground)

	rec := do(t, h, "Mozilla/5.0", "/")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (bare hostname should default to http and proxy)", rec.Code)
	}
	if rec.Body.String() != "ok" {
		t.Fatalf("body = %q, want %q (upstream not reached)", rec.Body.String(), "ok")
	}
}

func chtimes(path string, atime, mtime time.Time) error {
	return os.Chtimes(path, atime, mtime)
}

func TestNewHandler_InvalidUpstreamURL_ReturnsError(t *testing.T) {
	fetcher, renderer := defaultStubs()
	cache := newTempCache(t)
	gen := NewGenerator(cache, fetcher, renderer)

	// Already contains "://" so NewHandler's bare-hostname default does not
	// apply; the unbalanced bracket makes url.Parse itself fail.
	_, err := NewHandler("http://[::1", gen, cache, "https://navyfragen.app")
	if err == nil {
		t.Fatal("expected an error for a malformed upstream URL")
	}
}

func TestHandler_InitSem_NegativeDisablesCap(t *testing.T) {
	h := &Handler{MaxConcurrentGenerate: -1}
	h.initSem()
	if h.genSem != nil {
		t.Fatal("a negative MaxConcurrentGenerate should disable the semaphore (nil genSem)")
	}
	if !h.acquireRenderSlot() {
		t.Fatal("a disabled cap must never refuse a render slot")
	}
	h.releaseRenderSlot() // must be a no-op rather than a block or a panic
}

func TestHandler_InitSem_ZeroFallsBackToDefault(t *testing.T) {
	h := &Handler{MaxConcurrentGenerate: 0}
	h.initSem()
	if h.MaxConcurrentGenerate != DefaultMaxConcurrentGenerate {
		t.Fatalf("MaxConcurrentGenerate = %d, want default %d", h.MaxConcurrentGenerate, DefaultMaxConcurrentGenerate)
	}
	if cap(h.genSem) != DefaultMaxConcurrentGenerate {
		t.Fatalf("genSem capacity = %d, want %d", cap(h.genSem), DefaultMaxConcurrentGenerate)
	}
}

func TestHandler_HandleGenerate_EmptyHandleIsNotFound(t *testing.T) {
	fetcher, renderer := defaultStubs()
	h := newIntegrationHandler(t, fetcher, renderer)

	// A path that ServeHTTP's Classify would never route to handleGenerate
	// (isProfilePath would be false), called directly to exercise the guard.
	req := httptest.NewRequest(http.MethodGet, "/profile/", nil)
	rec := httptest.NewRecorder()
	h.handleGenerate(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404 for an empty handle", rec.Code)
	}
	if atomic.LoadInt32(&fetcher.ResolveCalls) != 0 {
		t.Fatal("the fetcher must not be reached when the handle is empty")
	}
}

func TestHandler_HandleGenerate_ZeroTimeoutFallsBackToDefault(t *testing.T) {
	fetcher, renderer := defaultStubs()
	h := newIntegrationHandler(t, fetcher, renderer)
	h.GenTimeout = 0 // bypass NewHandler's default to hit the fallback directly

	rec := do(t, h, CardybUA, "/profile/integration.test")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (a zero GenTimeout should fall back to the default, not fail)", rec.Code)
	}
	if h.genTimeout() != DefaultGenTimeout {
		t.Fatalf("genTimeout() = %s, want %s", h.genTimeout(), DefaultGenTimeout)
	}
}
