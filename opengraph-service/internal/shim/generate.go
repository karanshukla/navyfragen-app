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

// Generate returns the OG image for handle. The cache is keyed by DID, so the
// handle is resolved first; a miss runs the render pipeline under singleflight.
// Failures surface as typed errors (ErrProfileNotFound, ErrRenderFailed) so the
// HTTP layer can degrade without breaking the proxy fast path.
func (g *Generator) Generate(ctx context.Context, handle string) (GenerateResult, error) {
	// Keyed on the handle rather than the DID: concurrent requests for one
	// handle resolve to the same DID, and that is the stampede worth deduping.
	//
	// The shared work is detached from the leader's request context. singleflight
	// runs the body under whichever context the leader passed in, so a crawler
	// hanging up early (common for Cardyb) would otherwise abort the render for
	// every follower still waiting. The deadline is preserved; the cancellation
	// is not.
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
		// Guard the hot path against a panic rather than trusting the internal
		// contract to survive a future refactor.
		return GenerateResult{}, ErrRenderFailed
	}
	return res, nil
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

// generateOnce is the single-flight body: one caller runs it per concurrent
// batch for a given handle.
func (g *Generator) generateOnce(ctx context.Context, handle string) (GenerateResult, error) {
	did, err := g.Fetcher.ResolveDID(ctx, handle)
	if err != nil {
		return GenerateResult{}, err
	}

	if cached, err := g.Cache.Load(did); err == nil {
		return GenerateResult{
			Image: cached.Bytes, MimeType: cached.MimeType,
			DID: did, CacheHit: true,
		}, nil
	}

	return g.renderAndStore(ctx, did)
}

func (g *Generator) renderAndStore(ctx context.Context, did string) (GenerateResult, error) {
	prof, err := g.Fetcher.FetchProfile(ctx, did)
	if err != nil {
		return GenerateResult{}, err
	}

	pngBytes, err := g.Renderer.Render(ctx, BuildOGTemplate(prof.ToOGInput()))
	if err != nil {
		return GenerateResult{}, err
	}

	if err := g.Cache.Store(did, pngBytes, "image/png"); err != nil {
		// Non-fatal: the bytes are already in hand, and the next request retries.
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
