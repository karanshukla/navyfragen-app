package shim

import (
	"context"
	"errors"
	"log"

	"golang.org/x/sync/singleflight"
)

// ResolvedProfile is everything the OG HTML response needs: the DID that keys
// the cached image's URL, plus whether a fresh render already backs it. Neither
// field requires a render, which is what lets the response go out before one
// has run.
type ResolvedProfile struct {
	DID    string
	Cached bool
}

// Generator orchestrates the OG image pipeline: handle → DID → cache lookup →
// indigo profile read → html-to-image render → store. It is split into a cheap
// Resolve (everything a crawler's response needs) and an EnsureRendered (the
// expensive half, run in the background), so no caller ever waits on a render.
type Generator struct {
	Cache    *FileCache
	Fetcher  ProfileFetcher
	Renderer ImageRenderer
	group    singleflight.Group
}

// NewGenerator wires the orchestrator's dependencies.
func NewGenerator(cache *FileCache, fetcher ProfileFetcher, renderer ImageRenderer) *Generator {
	return &Generator{Cache: cache, Fetcher: fetcher, Renderer: renderer}
}

// Resolve maps a handle to its cache identity: one AppView call plus a stat of
// the cached file, never a render. Failures surface as typed errors
// (ErrProfileNotFound) so the HTTP layer can degrade without breaking the proxy
// fast path.
func (g *Generator) Resolve(ctx context.Context, handle string) (ResolvedProfile, error) {
	did, err := g.Fetcher.ResolveDID(ctx, handle)
	if err != nil {
		return ResolvedProfile{}, err
	}
	return ResolvedProfile{DID: did, Cached: g.Cache.Fresh(did)}, nil
}

// EnsureRendered renders and stores the OG image for did unless a fresh entry
// already exists. Concurrent callers for one DID coalesce onto a single render
// via singleflight, so a cache stampede costs exactly one html-to-image call.
//
// [TestEnsureRendered_Singleflight_CoalescesConcurrentCalls] pins the dedup and
// [TestEnsureRendered_FreshEntry_SkipsFetchAndRender] pins the no-op-when-warm
// half that makes a repeat warm free.
func (g *Generator) EnsureRendered(ctx context.Context, did string) error {
	// The shared work is detached from the calling context. singleflight runs
	// the body under whichever context the leader passed in, so a leader that
	// goes away early would otherwise abort the render for every follower still
	// waiting. The deadline is preserved; the cancellation is not.
	workCtx, workCancel := detachContext(ctx)
	defer workCancel()
	_, err, _ := g.group.Do(did, func() (any, error) {
		return nil, g.renderIfStale(workCtx, did)
	})
	return err
}

// detachContext carries over ctx's deadline and values but is not canceled
// when ctx is, so shared work respects a bounded deadline without dying because
// one caller hung up. The returned cancel MUST be called to release the timer.
// A ctx with no deadline yields background — only the unconfigured test path.
func detachContext(ctx context.Context) (context.Context, context.CancelFunc) {
	if ctx == nil {
		return context.Background(), func() {}
	}
	if dl, ok := ctx.Deadline(); ok {
		return context.WithDeadline(context.Background(), dl)
	}
	bg, cancel := context.WithCancel(context.Background())
	return context.WithValue(bg, ctxKey{}, ctx), cancel
}

// ctxKey is an unexported key type so we can attach the original ctx's values
// to the detached background ctx without colliding with caller keys.
type ctxKey struct{}

// renderIfStale is the single-flight body: one caller runs it per concurrent
// batch for a given DID. The freshness re-check inside the group is what makes
// a follower's turn free once the leader has stored the image.
func (g *Generator) renderIfStale(ctx context.Context, did string) error {
	if g.Cache.Fresh(did) {
		return nil
	}

	prof, err := g.Fetcher.FetchProfile(ctx, did)
	if err != nil {
		return err
	}

	pngBytes, err := g.Renderer.Render(ctx, BuildOGTemplate(prof.ToOGInput()))
	if err != nil {
		return err
	}

	if err := g.Cache.Store(did, pngBytes, "image/png"); err != nil {
		// Non-fatal: the next request retries, and until then the cache route
		// serves the branded fallback.
		log.Printf("opengraph-service: cache store for %s failed: %v", did, err)
	}
	return nil
}

// AsHTTPStatus maps an orchestrator error to the HTTP status the shim should
// return. Unknown errors become 502 (we are acting as a proxy to the AT
// Protocol / html-to-image).
func AsHTTPStatus(err error) int {
	switch {
	case err == nil:
		return 200
	case errors.Is(err, ErrProfileNotFound):
		return 404
	case errors.Is(err, ErrRenderFailed):
		return 502
	default:
		return 502
	}
}
