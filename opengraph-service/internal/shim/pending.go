package shim

import "sync"

// pendingRenders tracks the in-flight renders an image fetch is allowed to wait
// on, keyed by the SafeDID that names the cache file.
//
// It exists because the render is no longer in front of the response. Without
// it, the image fetch that follows the OG HTML cannot tell "a render for this
// DID is a second away" from "nothing is coming", and has to answer both with
// the fallback — which for Cardyb is permanent, since it fetches the card image
// once and bakes those bytes into the post record.
//
// Entries are reference counted. A share-time warm and the crawl behind it each
// begin a render for the same profile (singleflight coalesces them downstream
// into one html-to-image call), and a waiter must stay parked until the last of
// them is done rather than being woken by whichever finishes first.
//
// [TestPendingRenders_SecondBeginKeepsWaitersParkedUntilBothRelease] pins the
// refcount and [TestPendingRenders_WatchWithNothingInFlight_ReturnsNil] pins
// the nothing-to-wait-for answer that keeps a fallback serve immediate.
type pendingRenders struct {
	mu sync.Mutex
	m  map[string]*pendingRender
}

type pendingRender struct {
	done chan struct{}
	refs int
}

// begin registers an in-flight render for key and returns the release that
// closes it out. The caller MUST call the returned func exactly once when the
// render finishes: skipping it parks every later waiter for its full wait on a
// render that is already over.
func (p *pendingRenders) begin(key string) func() {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.m == nil {
		p.m = make(map[string]*pendingRender)
	}
	entry, ok := p.m[key]
	if !ok {
		entry = &pendingRender{done: make(chan struct{})}
		p.m[key] = entry
	}
	entry.refs++
	return func() { p.release(key, entry) }
}

func (p *pendingRenders) release(key string, entry *pendingRender) {
	p.mu.Lock()
	entry.refs--
	last := entry.refs == 0
	if last {
		delete(p.m, key)
	}
	p.mu.Unlock()
	if last {
		close(entry.done)
	}
}

// watch returns the channel that closes when the in-flight render for key
// finishes, or nil when there is no render to wait for — the caller must not
// park in that case, or every request for a DID nobody is rendering would hold
// a connection for the full wait.
func (p *pendingRenders) watch(key string) <-chan struct{} {
	p.mu.Lock()
	defer p.mu.Unlock()
	entry, ok := p.m[key]
	if !ok {
		return nil
	}
	return entry.done
}
