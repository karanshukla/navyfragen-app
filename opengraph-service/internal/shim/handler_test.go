package shim

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

// Handler integration tests: exercise the real HTTP wiring (classify → proxy /
// generate → cache serve) end-to-end against a Handler constructed exactly as
// main.go constructs it, with the external dependencies (indigo, html-to-image)
// replaced by the FakeFetcher/FakeRenderer stubs. This is the committed
// automation that replaces the poc's 12 manual curl runs (reexamine gap 1) — it
// runs hermetically in CI with no real network and no Docker compose.
//
// What is real here:
//   - The full ServeHTTP router (healthz / og-cache / classify-or-proxy).
//   - The real httputil.ReverseProxy in front of a real httptest upstream that
//     stands in for the client SPA.
//   - The real Generator (singleflight, cache-keyed-by-DID, render→store).
//   - The real FileCache on a real tempdir (the volume).
//   - The real BuildOGResponse (og:image, absolute URL, escaping).
//
// What is stubbed: ProfileFetcher (indigo) and ImageRenderer (html-to-image) —
// the two network egress points. The seams (interfaces in fetcher.go /
// renderer.go) are exactly what the poc/implement established.

// newIntegrationHandler builds a Handler exactly like main.go but with the
// fetcher/renderer stubbed. The upstream is a real httptest server standing in
// for the client SPA. It returns the handler, its server, the stub fetcher and
// renderer (so tests can assert call counts and drive cache-expiry scenarios),
// and the cache (so tests can backdate files to simulate TTL expiry).
func newIntegrationHandler(t *testing.T, fetcher *FakeFetcher, renderer *FakeRenderer) (
	*Handler, *httptest.Server, *FileCache,
) {
	t.Helper()
	// Real upstream (the client SPA in production). Returns a static index.html
	// with the generic og:image, exactly as the real client does.
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = io.WriteString(w, `<!DOCTYPE html><html><head>
<meta property="og:image" content="https://navyfragen.app/navyfragen-og.png">
</head><body>SPA</body></html>`)
	}))
	t.Cleanup(upstream.Close)

	cache, err := NewFileCache(t.TempDir(), 100, time.Hour)
	if err != nil {
		t.Fatalf("NewFileCache: %v", err)
	}
	gen := NewGenerator(cache, fetcher, renderer)
	h, err := NewHandler(upstream.URL, gen, cache, "https://navyfragen.app")
	if err != nil {
		t.Fatalf("NewHandler: %v", err)
	}
	return h, upstream, cache
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

// do issues a request against the handler with the given UA and path.
func do(t *testing.T, h *Handler, ua, path string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	if ua != "" {
		req.Header.Set("User-Agent", ua)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

// --- UA detection on the full HTTP path (AC3 / AC8 trigger) ---

// Cardyb on /profile/:handle MUST trigger generation: the response is the
// synthesized OG HTML, not the upstream SPA, and its og:image points at the
// shim's cache path for the resolved DID.
func TestHandler_CardybOnProfile_GeneratesOGResponse(t *testing.T) {
	fetcher, renderer := defaultStubs()
	h, upstream, _ := newIntegrationHandler(t, fetcher, renderer)

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
	if strings.Contains(body, "navyfragen-og.png") {
		t.Fatalf("response leaked the generic upstream og:image\n--- body ---\n%s", body)
	}
	// The upstream SPA body must not appear in a generated response.
	if strings.Contains(body, "SPA") {
		t.Fatalf("generated response contains upstream body\n--- body ---\n%s", body)
	}
	// Sanity: the upstream was not hit on a generate decision. We can't count
	// upstream requests without instrumenting it, but we can assert the
	// generator's dependencies each fired exactly once (cold path).
	if c := atomic.LoadInt32(&fetcher.ResolveCalls); c != 1 {
		t.Fatalf("ResolveDID called %d times, want 1", c)
	}
	if c := atomic.LoadInt32(&fetcher.ProfileCalls); c != 1 {
		t.Fatalf("FetchProfile called %d times, want 1", c)
	}
	if c := atomic.LoadInt32(&renderer.Calls); c != 1 {
		t.Fatalf("renderer called %d times, want 1", c)
	}
	_ = upstream // referenced for clarity; upstream is cleaned up via t.Cleanup
}

// Ordinary browser UA on /profile/:handle MUST pass through to the upstream
// unchanged — the acceptance criterion that ordinary /* traffic is unaffected
// (AC3 / hard constraint #3).
func TestHandler_BrowserOnProfile_ProxiesToUpstream(t *testing.T) {
	fetcher, renderer := defaultStubs()
	h, _, _ := newIntegrationHandler(t, fetcher, renderer)

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
	if !strings.Contains(body, "navyfragen-og.png") {
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
// the UA and the path (AC3).
func TestHandler_CardybOnRoot_ProxiesToUpstream(t *testing.T) {
	fetcher, renderer := defaultStubs()
	h, _, _ := newIntegrationHandler(t, fetcher, renderer)

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
	h, _, _ := newIntegrationHandler(t, fetcher, renderer)

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

// --- Cache hit/miss/expiry on the full request path (AC5) ---

// A second Cardyb request within TTL MUST be a cache hit: no indigo profile
// read, no render. This is the committed proof of the reexamine's "repeat
// within TTL → cache hit" scenario.
func TestHandler_RepeatWithinTTL_CacheHitSkipsFetchAndRender(t *testing.T) {
	fetcher, renderer := defaultStubs()
	h, _, _ := newIntegrationHandler(t, fetcher, renderer)

	// First request: cold path.
	rec1 := do(t, h, "Bluesky Cardyb", "/profile/integration.test")
	if rec1.Code != http.StatusOK {
		t.Fatalf("first: status %d", rec1.Code)
	}
	// Second request: must be a cache hit.
	rec2 := do(t, h, "Bluesky Cardyb", "/profile/integration.test")
	if rec2.Code != http.StatusOK {
		t.Fatalf("second: status %d", rec2.Code)
	}
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
// reexamine's "expire the entry → regeneration" scenario.
func TestHandler_ExpiredEntry_Regenerates(t *testing.T) {
	// Short TTL so we can expire the entry by backdating mtime.
	cache, err := NewFileCache(t.TempDir(), 100, time.Hour)
	if err != nil {
		t.Fatalf("NewFileCache: %v", err)
	}
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, "SPA")
	}))
	t.Cleanup(upstream.Close)
	fetcher, renderer := defaultStubs()
	gen := NewGenerator(cache, fetcher, renderer)
	h, err := NewHandler(upstream.URL, gen, cache, "https://navyfragen.app")
	if err != nil {
		t.Fatalf("NewHandler: %v", err)
	}

	// First request: cold path → stores the PNG.
	rec1 := do(t, h, "Bluesky Cardyb", "/profile/integration.test")
	if rec1.Code != http.StatusOK {
		t.Fatalf("first: status %d", rec1.Code)
	}
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
	if c := atomic.LoadInt32(&renderer.Calls); c != 2 {
		t.Fatalf("after second: renderer called %d, want 2 (regeneration)", c)
	}
	if c := atomic.LoadInt32(&fetcher.ProfileCalls); c != 2 {
		t.Fatalf("after second: FetchProfile called %d, want 2 (regeneration)", c)
	}
}

// --- The full generation pipeline on the request path (AC8) ---

// The synthesized og:image URL must be fetchable from the shim's own cache
// route and return the bytes the renderer produced. This ties the generate
// path to the cache-serve path — the crawler's two-step (fetch HTML, then fetch
// the image) is the real end-to-end contract.
func TestHandler_GeneratedImageURL_ServesCachedPNG(t *testing.T) {
	fetcher, renderer := defaultStubs()
	png := []byte("\x89PNG\r\n\x1a\nFAKE-PNG-BYTES")
	renderer.PNG = png
	h, _, _ := newIntegrationHandler(t, fetcher, renderer)

	// Step 1: Cardyb fetches the profile HTML → triggers generation + caching.
	rec := do(t, h, "Bluesky Cardyb", "/profile/integration.test")
	if rec.Code != http.StatusOK {
		t.Fatalf("generate: status %d", rec.Code)
	}

	// Step 2: Cardyb fetches the og:image URL. The crawler uses any UA (it's
	// already past the bot policy); exercise the cache route directly.
	imgRec := do(t, h, "Mozilla/5.0", "/og-cache/did-plc-integration.png")
	if imgRec.Code != http.StatusOK {
		t.Fatalf("cache serve: status %d, want 200", imgRec.Code)
	}
	if imgRec.Body.Bytes() == nil {
		t.Fatal("cache serve returned no bytes")
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
// hang the handler (AC8 fallback + the hot-path-safety risk from the
// investigation).
func TestHandler_UnresolvableHandle_Returns404AndDoesNotPanic(t *testing.T) {
	fetcher, renderer := defaultStubs()
	fetcher.ResolveErr = ErrProfileNotFound
	h, _, _ := newIntegrationHandler(t, fetcher, renderer)

	rec := do(t, h, "Bluesky Cardyb", "/profile/nobody.bsky.social")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404 for unresolvable handle", rec.Code)
	}
	// The profile read and renderer must not have fired.
	if c := atomic.LoadInt32(&fetcher.ProfileCalls); c != 0 {
		t.Fatalf("FetchProfile called %d, want 0", c)
	}
	if c := atomic.LoadInt32(&renderer.Calls); c != 0 {
		t.Fatalf("renderer called %d, want 0", c)
	}
}

// A render failure surfaces as 502 (we are acting as a proxy to the AT Protocol
// / html-to-image), again without panicking.
func TestHandler_RenderFailure_Returns502(t *testing.T) {
	fetcher, renderer := defaultStubs()
	renderer.Err = errRenderBoom
	h, _, _ := newIntegrationHandler(t, fetcher, renderer)

	rec := do(t, h, "Bluesky Cardyb", "/profile/integration.test")
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status = %d, want 502 for render failure", rec.Code)
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

// --- /og-cache path traversal defense on the real route ---

func TestHandler_OgCacheTraversal_Returns404(t *testing.T) {
	fetcher, renderer := defaultStubs()
	h, _, _ := newIntegrationHandler(t, fetcher, renderer)

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

// --- /healthz ---

func TestHandler_Healthz(t *testing.T) {
	fetcher, renderer := defaultStubs()
	h, _, _ := newIntegrationHandler(t, fetcher, renderer)

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

// --- Concurrent-render cap (concern 3 fix) ---

// TestHandler_GenerateCap_FailsFastWhenBusy pins the spoofed-Cardyb DoS guard:
// when MaxConcurrentGenerate cold-path renders are already in flight, further
// generate requests fail fast with 503. The proxy fast path is unaffected
// (verified separately). This protects the shared html-to-image service from a
// rotating-handle render storm — singleflight dedups per handle, but an
// attacker who varies the handle drives unbounded concurrent renders without
// this cap.
func TestHandler_GenerateCap_FailsFastWhenBusy(t *testing.T) {
	// Build a handler with a cap of 1 and a fetcher that blocks until released,
	// so the first generate holds the only slot.
	cache, err := NewFileCache(t.TempDir(), 100, time.Hour)
	if err != nil {
		t.Fatalf("NewFileCache: %v", err)
	}
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, "SPA")
	}))
	t.Cleanup(upstream.Close)

	release := make(chan struct{})
	started := make(chan struct{}, 1)
	fetcher := &FakeFetcher{
		DID: "did:plc:busy",
		Profile: Profile{DisplayName: "Busy", Handle: "busy.test",
			Banner: "b", Avatar: "a"},
		Delay: 0, // we block manually below
	}
	// Wrap ResolveDID so the leader blocks on `release` while holding the slot.
	fetcherBlock := &blockingFetcher{
		FakeFetcher: fetcher,
		startedCh:   started,
		releaseCh:   release,
	}
	renderer := &FakeRenderer{PNG: []byte("BUSY-PNG")}
	gen := NewGenerator(cache, fetcherBlock, renderer)
	h, err := NewHandler(upstream.URL, gen, cache, "https://navyfragen.app")
	if err != nil {
		t.Fatalf("NewHandler: %v", err)
	}
	h.MaxConcurrentGenerate = 1
	h.initSem()

	// Leader: holds the single slot.
	leaderDone := make(chan error, 1)
	go func() {
		rec := do(t, h, "Bluesky Cardyb", "/profile/leader.test")
		if rec.Code != http.StatusOK {
			leaderDone <- fmt.Errorf("leader status %d", rec.Code)
			return
		}
		leaderDone <- nil
	}()
	// Wait for the leader to be inside ResolveDID (holding the slot).
	<-started

	// Follower: must fail fast with 503 — the only slot is taken.
	rec := do(t, h, "Bluesky Cardyb", "/profile/follower.test")
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("follower should fail fast with 503 when cap is saturated, got %d", rec.Code)
	}

	// Release the leader and confirm it completes cleanly.
	close(release)
	if err := <-leaderDone; err != nil {
		t.Fatalf("leader: %v", err)
	}
}

// TestHandler_GenerateCap_ProxyUnaffected confirms the cap gates only the
// generate path — ordinary proxy traffic is never 503'd even when the generate
// cap is fully saturated.
func TestHandler_GenerateCap_ProxyUnaffected(t *testing.T) {
	cache, err := NewFileCache(t.TempDir(), 100, time.Hour)
	if err != nil {
		t.Fatalf("NewFileCache: %v", err)
	}
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, "SPA")
	}))
	t.Cleanup(upstream.Close)
	release := make(chan struct{})
	started := make(chan struct{}, 1)
	fetcherBlock := &blockingFetcher{
		FakeFetcher: &FakeFetcher{DID: "did:plc:busy",
			Profile: Profile{DisplayName: "Busy", Handle: "busy.test"}},
		startedCh: started,
		releaseCh: release,
	}
	gen := NewGenerator(cache, fetcherBlock, NewFakeRenderer())
	h, err := NewHandler(upstream.URL, gen, cache, "https://navyfragen.app")
	if err != nil {
		t.Fatalf("NewHandler: %v", err)
	}
	h.MaxConcurrentGenerate = 1
	h.initSem()

	// Saturate the generate slot.
	go func() { _ = do(t, h, "Bluesky Cardyb", "/profile/busy.test") }()
	<-started
	defer close(release)

	// Ordinary proxy traffic (browser UA) must succeed — the cap is generate-only.
	rec := do(t, h, "Mozilla/5.0", "/some/path")
	if rec.Code != http.StatusOK {
		t.Fatalf("proxy fast path must not be gated by generate cap, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "SPA") {
		t.Fatalf("proxy fast path did not reach upstream: %q", rec.Body.String())
	}
}

// blockingFetcher wraps FakeFetcher and blocks ResolveDID until releaseCh is
// closed, signaling startedCh once it has entered the call. Used to hold a
// generate slot deterministically in concurrency tests.
type blockingFetcher struct {
	*FakeFetcher
	startedCh chan<- struct{}
	releaseCh <-chan struct{}
}

func (b *blockingFetcher) ResolveDID(ctx context.Context, handle string) (string, error) {
	select {
	case b.startedCh <- struct{}{}:
	default:
	}
	select {
	case <-b.releaseCh:
	case <-ctx.Done():
		return "", ctx.Err()
	}
	return b.FakeFetcher.ResolveDID(ctx, handle)
}

// NewFakeRenderer returns a FakeRenderer with a default PNG payload, for tests
// that don't care about the renderer's output.
func NewFakeRenderer() *FakeRenderer { return &FakeRenderer{PNG: []byte("DEFAULT-PNG")} }

// --- helper: set file times so a test can simulate TTL expiry. ---

func chtimes(path string, atime, mtime time.Time) error {
	return os.Chtimes(path, atime, mtime)
}
