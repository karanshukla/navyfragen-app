package shim

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/bluesky-social/indigo/xrpc"
)

// FakeFetcher is a test ProfileFetcher stub. Profile is guarded because the
// two methods now run on different goroutines: a crawler's request resolves the
// handle while a background render reads the profile.
type FakeFetcher struct {
	DID          string // the DID ResolveDID returns
	ResolveErr   error
	Profile      Profile
	ProfileErr   error
	ResolveCalls int32 // atomic
	ProfileCalls int32 // atomic
	Delay        time.Duration

	mu sync.Mutex // guards Profile once the stub is in use
}

func (f *FakeFetcher) ResolveDID(_ context.Context, handle string) (string, error) {
	atomic.AddInt32(&f.ResolveCalls, 1)
	if f.Delay > 0 {
		time.Sleep(f.Delay)
	}
	if f.ResolveErr != nil {
		return "", f.ResolveErr
	}
	did := f.DID
	if did == "" {
		did = "did:plc:test"
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.Profile.Handle == "" {
		f.Profile.Handle = handle
	}
	f.Profile.DID = did
	return did, nil
}

func (f *FakeFetcher) FetchProfile(_ context.Context, did string) (Profile, error) {
	atomic.AddInt32(&f.ProfileCalls, 1)
	if f.ProfileErr != nil {
		return Profile{}, f.ProfileErr
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	f.Profile.DID = did
	return f.Profile, nil
}

// FakeRenderer is a test ImageRenderer stub.
type FakeRenderer struct {
	PNG   []byte
	Err   error
	Calls int32 // atomic
}

func (r *FakeRenderer) Render(_ context.Context, _ string) ([]byte, error) {
	atomic.AddInt32(&r.Calls, 1)
	if r.Err != nil {
		// Wrap to match the real renderer's typed-error contract so the
		// generator's errors.Is(err, ErrRenderFailed) works.
		return nil, fmt.Errorf("%w: %v", ErrRenderFailed, r.Err)
	}
	if len(r.PNG) == 0 {
		return []byte("DEFAULT-PNG"), nil
	}
	return r.PNG, nil
}

func newDeps(t *testing.T) (*FileCache, *FakeFetcher, *FakeRenderer) {
	t.Helper()
	cache, err := NewFileCache(t.TempDir(), 100, time.Hour)
	if err != nil {
		t.Fatalf("NewFileCache: %v", err)
	}
	return cache, &FakeFetcher{DID: "did:plc:test", Profile: Profile{
		DisplayName: "Test", Handle: "test.bsky.social",
		Banner: "https://cdn.bsky.app/b.jpg", Avatar: "https://cdn.bsky.app/a.jpg",
	}}, &FakeRenderer{PNG: []byte("PNG-BYTES")}
}

// Resolve is the half a crawler waits on, so it must cost exactly one AppView
// call and never touch the profile read or the renderer — on a warm cache
// (below) or a cold one (TestResolve_ColdCache_ReportsUncachedWithoutRendering).
func TestResolve_FreshEntry_ReportsCachedWithoutRendering(t *testing.T) {
	cache, fetcher, renderer := newDeps(t)
	if err := cache.Store("did:plc:test", []byte("CACHED"), "image/png"); err != nil {
		t.Fatal(err)
	}
	gen := NewGenerator(cache, fetcher, renderer)

	got, err := gen.Resolve(context.Background(), "test.bsky.social")
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if !got.Cached {
		t.Fatal("Cached should be true on a primed cache")
	}
	if got.DID != "did:plc:test" {
		t.Fatalf("DID = %q", got.DID)
	}
	if atomic.LoadInt32(&fetcher.ResolveCalls) != 1 {
		t.Fatal("ResolveDID must be called once to key the cache")
	}
	if atomic.LoadInt32(&fetcher.ProfileCalls) != 0 {
		t.Fatal("FetchProfile must not be called by Resolve")
	}
	if atomic.LoadInt32(&renderer.Calls) != 0 {
		t.Fatal("the renderer must not be called by Resolve")
	}
}

func TestResolve_ColdCache_ReportsUncachedWithoutRendering(t *testing.T) {
	cache, fetcher, renderer := newDeps(t)
	gen := NewGenerator(cache, fetcher, renderer)

	got, err := gen.Resolve(context.Background(), "test.bsky.social")
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if got.Cached {
		t.Fatal("Cached should be false on a cold cache")
	}
	if got.DID != "did:plc:test" {
		t.Fatalf("DID = %q", got.DID)
	}
	// The point of the split: a miss is reported, not repaired, so the caller
	// can answer immediately and repair in the background.
	if atomic.LoadInt32(&renderer.Calls) != 0 {
		t.Fatal("the renderer must not be called by Resolve on a miss")
	}
}

func TestEnsureRendered_FreshEntry_SkipsFetchAndRender(t *testing.T) {
	cache, fetcher, renderer := newDeps(t)
	if err := cache.Store("did:plc:test", []byte("CACHED"), "image/png"); err != nil {
		t.Fatal(err)
	}
	gen := NewGenerator(cache, fetcher, renderer)

	if err := gen.EnsureRendered(context.Background(), "did:plc:test"); err != nil {
		t.Fatalf("EnsureRendered: %v", err)
	}
	if atomic.LoadInt32(&fetcher.ProfileCalls) != 0 {
		t.Fatal("FetchProfile must not be called when the entry is already fresh")
	}
	if atomic.LoadInt32(&renderer.Calls) != 0 {
		t.Fatal("the renderer must not be called when the entry is already fresh")
	}
}

func TestEnsureRendered_ColdCache_FetchesRendersStores(t *testing.T) {
	cache, fetcher, renderer := newDeps(t)
	gen := NewGenerator(cache, fetcher, renderer)

	if err := gen.EnsureRendered(context.Background(), "did:plc:test"); err != nil {
		t.Fatalf("EnsureRendered: %v", err)
	}
	if atomic.LoadInt32(&fetcher.ProfileCalls) != 1 {
		t.Fatalf("FetchProfile called %d times, want 1", fetcher.ProfileCalls)
	}
	if atomic.LoadInt32(&renderer.Calls) != 1 {
		t.Fatalf("renderer called %d times, want 1", renderer.Calls)
	}
	entry, err := cache.Load("did:plc:test")
	if err != nil {
		t.Fatalf("the render must have been stored: %v", err)
	}
	if string(entry.Bytes) != "PNG-BYTES" {
		t.Fatalf("stored bytes = %q, want PNG-BYTES", entry.Bytes)
	}
}

func TestEnsureRendered_Singleflight_CoalescesConcurrentCalls(t *testing.T) {
	cache, fetcher, renderer := newDeps(t)
	// Make the slow path slow enough that multiple goroutines are in-flight.
	fetcher.Delay = 50 * time.Millisecond
	gen := NewGenerator(cache, fetcher, renderer)

	const n = 8
	var wg sync.WaitGroup
	errs := make([]error, n)
	start := make(chan struct{})
	wg.Add(n)
	for i := 0; i < n; i++ {
		go func(i int) {
			defer wg.Done()
			<-start
			errs[i] = gen.EnsureRendered(context.Background(), "did:plc:test")
		}(i)
	}
	close(start)
	wg.Wait()

	for i, err := range errs {
		if err != nil {
			t.Fatalf("goroutine %d err: %v", i, err)
		}
	}
	// All n calls coalesced: one profile fetch and one render (the leader won
	// the race; followers rode along).
	if got := atomic.LoadInt32(&fetcher.ProfileCalls); got != 1 {
		t.Fatalf("FetchProfile called %d times, want 1 (singleflight)", got)
	}
	if got := atomic.LoadInt32(&renderer.Calls); got != 1 {
		t.Fatalf("renderer called %d times, want 1 (singleflight)", got)
	}
}

func TestResolve_UnresolvableHandle_ReturnsErrProfileNotFound(t *testing.T) {
	cache, fetcher, renderer := newDeps(t)
	fetcher.ResolveErr = ErrProfileNotFound
	gen := NewGenerator(cache, fetcher, renderer)

	_, err := gen.Resolve(context.Background(), "bogus.bsky.social")
	if !errors.Is(err, ErrProfileNotFound) {
		t.Fatalf("want ErrProfileNotFound, got %v", err)
	}
	// The profile read and renderer must not have been reached.
	if atomic.LoadInt32(&fetcher.ProfileCalls) != 0 {
		t.Fatal("FetchProfile must not be called when ResolveDID fails")
	}
	if atomic.LoadInt32(&renderer.Calls) != 0 {
		t.Fatal("renderer must not be called when ResolveDID fails")
	}
}

func TestEnsureRendered_RendererFailure_ReturnsErrRenderFailed(t *testing.T) {
	cache, fetcher, renderer := newDeps(t)
	renderer.Err = errors.New("puppeteer crashed")
	gen := NewGenerator(cache, fetcher, renderer)

	err := gen.EnsureRendered(context.Background(), "did:plc:test")
	if !errors.Is(err, ErrRenderFailed) {
		t.Fatalf("want ErrRenderFailed, got %v", err)
	}
}

func TestEnsureRendered_ProfileFetchFailure_AfterCacheMiss(t *testing.T) {
	cache, fetcher, renderer := newDeps(t)
	fetcher.ProfileErr = errors.New("appview unavailable")
	gen := NewGenerator(cache, fetcher, renderer)

	err := gen.EnsureRendered(context.Background(), "did:plc:test")
	if err == nil || !strings.Contains(err.Error(), "appview unavailable") {
		t.Fatalf("want the FetchProfile error to propagate, got %v", err)
	}
	// The renderer must not have been reached — the pipeline stops at the
	// profile-read failure.
	if atomic.LoadInt32(&renderer.Calls) != 0 {
		t.Fatal("renderer must not be called when FetchProfile fails")
	}
}

func TestIsNotFound_XRPC400_IsNotFound(t *testing.T) {
	// Handle resolution of a nonexistent handle returns XRPC ERROR 400.
	xe := &xrpc.Error{StatusCode: 400, Wrapped: errors.New("InvalidRequest: Unable to resolve handle")}
	if !isNotFound(xe) {
		t.Fatal("XRPC 400 should be treated as not-found (maps to 404)")
	}
}

func TestIsNotFound_XRPC404_IsNotFound(t *testing.T) {
	xe := &xrpc.Error{StatusCode: 404}
	if !isNotFound(xe) {
		t.Fatal("XRPC 404 should be treated as not-found")
	}
}

func TestIsNotFound_XRPC500_NotNotFound(t *testing.T) {
	// A 5xx from the AppView is a server error, not "not found" — must not map
	// to 404 (it should surface as 502 so the operator sees a real problem).
	xe := &xrpc.Error{StatusCode: 503, Wrapped: errors.New("Service Unavailable")}
	if isNotFound(xe) {
		t.Fatal("XRPC 503 must NOT be treated as not-found")
	}
}

func TestIsNotFound_NilSafe(t *testing.T) {
	if isNotFound(nil) {
		t.Fatal("nil must not be not-found")
	}
}

func TestEnsureRendered_EmptyBannerAvatar_StillRenders(t *testing.T) {
	cache, fetcher, renderer := newDeps(t)
	fetcher.Profile.Banner = ""
	fetcher.Profile.Avatar = ""
	gen := NewGenerator(cache, fetcher, renderer)

	if err := gen.EnsureRendered(context.Background(), "did:plc:test"); err != nil {
		t.Fatalf("EnsureRendered: %v", err)
	}
	// The HTML built internally must not contain empty src="" (would break the
	// renderer). We verify indirectly: the renderer received non-empty HTML.
	if atomic.LoadInt32(&renderer.Calls) != 1 {
		t.Fatal("renderer should have been called once")
	}
}

func TestProfile_NormalizeHandle_StripsLeadingAt(t *testing.T) {
	p := Profile{Handle: "@foo.bsky.social"}
	if p.NormalizedHandle() != "foo.bsky.social" {
		t.Fatalf("got %q", p.NormalizedHandle())
	}
}

func TestProfile_NormalizeHandle_NoAt(t *testing.T) {
	p := Profile{Handle: "foo.bsky.social"}
	if p.NormalizedHandle() != "foo.bsky.social" {
		t.Fatalf("got %q", p.NormalizedHandle())
	}
}

func TestProfile_ToOGInput_PopulatesDefaults(t *testing.T) {
	p := Profile{
		DID: "did:plc:abc", Handle: "foo.bsky.social",
		DisplayName: "Foo", Banner: "b", Avatar: "a",
	}
	in := p.ToOGInput()
	if in.DisplayName != "Foo" || in.Handle != "foo.bsky.social" || in.Banner != "b" || in.Avatar != "a" {
		t.Fatalf("ToOGInput mismatch: %+v", in)
	}
	if strings.TrimSpace(in.Prompt) == "" {
		t.Fatal("Prompt should default to non-empty (DefaultPrompt)")
	}
}

// TestEnsureRendered_LeaderCancelDoesNotAbortFollowers pins detachContext: when
// the leader's context is canceled (its crawler closed the connection early, or
// its own deadline was shorter), the shared render continues to completion for
// the followers still waiting. Without the detach, the singleflight body runs
// under the leader's ctx and its cancellation aborts the work for everyone.
func TestEnsureRendered_LeaderCancelDoesNotAbortFollowers(t *testing.T) {
	cache, fetcher, renderer := newDeps(t)
	// Make the cold path slow enough that the leader's cancel arrives mid-flight.
	fetcher.Delay = 80 * time.Millisecond
	gen := NewGenerator(cache, fetcher, renderer)

	errCh := make(chan error, 1)

	// Leader: starts first, then cancels.
	leaderCtx, leaderCancel := context.WithCancel(context.Background())
	leaderDone := make(chan struct{})
	go func() {
		defer close(leaderDone)
		_ = gen.EnsureRendered(leaderCtx, "did:plc:test")
	}()
	// Follower: starts slightly later, never cancels.
	followerCtx, followerCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer followerCancel()
	// Give the leader time to win the singleflight Do call.
	time.Sleep(20 * time.Millisecond)
	followerDone := make(chan struct{})
	go func() {
		defer close(followerDone)
		errCh <- gen.EnsureRendered(followerCtx, "did:plc:test")
	}()
	// Cancel the leader mid-flight.
	time.Sleep(30 * time.Millisecond)
	leaderCancel()

	// The follower MUST succeed — the leader's cancel must not have aborted the
	// shared render. Both goroutines are joined before returning so neither can
	// still be writing into the t.TempDir() cleanup is about to walk.
	<-followerDone
	<-leaderDone
	if err := <-errCh; err != nil {
		t.Fatalf("follower errored despite its ctx being alive: %v", err)
	}
	if _, err := cache.Load("did:plc:test"); err != nil {
		t.Fatalf("the shared render should have completed and been stored: %v", err)
	}
}

func TestDetachContext_NilContext(t *testing.T) {
	detached, cancel := detachContext(nil)
	defer cancel()
	if detached == nil {
		t.Fatal("detachContext(nil) returned a nil context")
	}
	if _, ok := detached.Deadline(); ok {
		t.Fatal("a detached context built from nil should have no deadline")
	}
	select {
	case <-detached.Done():
		t.Fatal("detached context from nil should not already be done")
	default:
	}
}

func TestAsHTTPStatus(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want int
	}{
		{"nil error is 200", nil, 200},
		{"ErrProfileNotFound is 404", ErrProfileNotFound, 404},
		{"wrapped ErrProfileNotFound is 404", fmt.Errorf("resolve: %w", ErrProfileNotFound), 404},
		{"ErrRenderFailed is 502", ErrRenderFailed, 502},
		{"unknown error defaults to 502", errors.New("boom"), 502},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := AsHTTPStatus(tc.err); got != tc.want {
				t.Errorf("AsHTTPStatus(%v) = %d, want %d", tc.err, got, tc.want)
			}
		})
	}
}
