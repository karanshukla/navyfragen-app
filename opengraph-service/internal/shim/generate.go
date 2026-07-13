package shim

import (
	"context"
	"errors"
	"log"

	"golang.org/x/sync/singleflight"
)

// GenerateResult is what the orchestrator returns to the HTTP layer. It is the
// cache entry plus the resolved DID (needed to build the /og-cache/:did.png
// image URL) and a CacheHit flag for logging/metrics.
type GenerateResult struct {
	Image    []byte
	MimeType string
	DID      string
	CacheHit bool
}

// Generator orchestrates the slow path: cache lookup → indigo resolve →
// html-to-image render → store. It coalesces concurrent requests for the same
// handle via singleflight so a cache stampede produces exactly one render.
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

// Generate returns the OG image for handle. The cache is keyed by DID (the
// stable identifier) — the handle is resolved first, then the cache is checked.
// On a miss, the resolve+render pipeline runs under singleflight so concurrent
// callers for the same handle share a single render. Failures surface as typed
// errors (ErrProfileNotFound, ErrRenderFailed) so the HTTP layer can degrade
// the proxy fast path without breaking it.
func (g *Generator) Generate(ctx context.Context, handle string) (GenerateResult, error) {
	// singleflight key: the handle as it arrived. The DID is resolved inside the
	// leader's call; followers receive the same GenerateResult. Keying on handle
	// (not DID) is correct because two concurrent requests for the same handle
	// resolve to the same DID and share one render — that is the stampede we
	// need to dedup.
	//
	// Detach the shared work from the leader's per-request context. If the
	// leader's client disconnects (Cardyb closes the connection early, common
	// for crawlers), its r.Context() is canceled — and singleflight runs the
	// body under whichever caller's context the leader passed in. Without
	// detachment, that cancellation would abort the shared render for every
	// follower whose request is still alive, even though their own contexts
	// are fine. We preserve the deadline (so a stuck upstream still can't run
	// forever) but detach from request cancellation.
	workCtx, workCancel := detachContext(ctx)
	defer workCancel()
	v, err, _ := g.group.Do(handle, func() (any, error) {
		return g.generateOnce(workCtx, handle)
	})
	if err != nil {
		return GenerateResult{}, err
	}
	res, ok := v.(GenerateResult)
	if !ok {
		// The singleflight body always returns a (GenerateResult, error); a
		// non-assertable value means a future refactor returned a typed-nil or
		// unexpected type. Guard the hot path against a panic rather than trust
		// the internal contract.
		return GenerateResult{}, ErrRenderFailed
	}
	return res, nil
}

// detachContext returns a context that carries over the deadline (and values)
// of the supplied ctx but is NOT canceled when ctx is. The returned cancel
// function MUST be called when the caller is done (here, after singleflight
// completes) to release the timer.
//
// This is the standard singleflight+per-request-context fix: the shared work
// should respect a bounded deadline (set by the handler) but should not die
// just because one follower hung up. If ctx has no deadline, the returned
// context is background (the handler always sets a deadline, so this only
// covers the unconfigured test path).
func detachContext(ctx context.Context) (context.Context, context.CancelFunc) {
	if ctx == nil {
		return context.Background(), func() {}
	}
	if dl, ok := ctx.Deadline(); ok {
		return context.WithDeadline(context.Background(), dl)
	}
	// No deadline set: pass through context.Background so cancellation of ctx
	// cannot abort work. (Callers that care about a deadline always set one.)
	bg, cancel := context.WithCancel(context.Background())
	// Carry over request-scoped values (logging, tracing) from the original ctx.
	return context.WithValue(bg, ctxKey{}, ctx), cancel
}

// ctxKey is an unexported key type so we can attach the original ctx's values
// to the detached background ctx without colliding with caller keys.
type ctxKey struct{}

// generateOnce is the single-flight body: one caller runs it per concurrent
// batch for a given handle.
func (g *Generator) generateOnce(ctx context.Context, handle string) (GenerateResult, error) {
	// Phase 1: resolve handle → DID (cheap, always runs). DID is the stable
	// cache key.
	did, err := g.Fetcher.ResolveDID(ctx, handle)
	if err != nil {
		return GenerateResult{}, err
	}

	// Phase 2: cache lookup keyed by DID. A hit short-circuits the expensive
	// profile read and render entirely.
	if cached, err := g.Cache.Load(did); err == nil {
		return GenerateResult{
			Image: cached.Bytes, MimeType: cached.MimeType,
			DID: did, CacheHit: true,
		}, nil
	}

	// Phase 3: cold path — full profile read, render, store.
	prof, err := g.Fetcher.FetchProfile(ctx, did)
	if err != nil {
		return GenerateResult{}, err
	}
	htmlSrc := BuildOGTemplate(prof.ToOGInput())
	pngBytes, err := g.Renderer.Render(ctx, htmlSrc)
	if err != nil {
		return GenerateResult{}, err
	}

	if err := g.Cache.Store(did, pngBytes, "image/png"); err != nil {
		// A store failure is non-fatal — we still have the bytes to serve. Log
		// and continue; the next request will retry the store.
		log.Printf("opengraph-service: cache store for %s failed: %v", did, err)
	}

	return GenerateResult{
		Image: pngBytes, MimeType: "image/png",
		DID: did, CacheHit: false,
	}, nil
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
