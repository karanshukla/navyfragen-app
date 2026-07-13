package shim

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"sync"

	"github.com/caddyserver/caddy/v2"
	"github.com/caddyserver/caddy/v2/caddyconfig"
	_ "github.com/caddyserver/caddy/v2/caddyconfig/caddyfile"          // registers the "caddyfile" config adapter
	_ "github.com/caddyserver/caddy/v2/modules/caddyhttp/reverseproxy" // registers the reverse_proxy directive
	_ "github.com/caddyserver/caddy/v2/modules/caddyhttp/standard"     // registers core Caddyfile HTTP directives (handle, respond, etc.)
)

// caddyUpstreamHeader carries the real per-request destination (host:port)
// into the embedded Caddy engine. Caddy models "the running config" as a
// process-wide singleton (caddy.Load replaces it wholesale), so rather than
// give every Handler its own engine/listener/shutdown lifecycle, the process
// runs exactly one loopback-only Caddy engine and every Handler's proxy path
// tags its request with where it actually needs to go. Production only ever
// has one Handler (one FRONTEND_URL for the process's life); the test suite
// constructs many Handlers against many different httptest upstreams, and
// this is what lets them all share the one engine safely.
const caddyUpstreamHeader = "X-Navyfragen-Internal-Upstream"

var (
	caddyEngineOnce sync.Once
	caddyEngineAddr string
	caddyEngineErr  error
)

// ensureCaddyEngine lazily starts the embedded Caddy reverse-proxy engine the
// first time any Handler needs to proxy a request, and returns the loopback
// address it is listening on. The engine is never reachable outside this
// process: it binds 127.0.0.1 on an OS-assigned port, and nothing forwards
// that port out of the container.
func ensureCaddyEngine() (string, error) {
	caddyEngineOnce.Do(func() {
		ln, err := net.Listen("tcp", "127.0.0.1:0")
		if err != nil {
			caddyEngineErr = fmt.Errorf("pick embedded caddy port: %w", err)
			return
		}
		caddyEngineAddr = ln.Addr().String()
		_ = ln.Close()

		caddyfileText := fmt.Sprintf(`{
	admin off
	auto_https off
}
http://%s {
	reverse_proxy {http.request.header.%s} {
		flush_interval 100ms
	}
}
`, caddyEngineAddr, caddyUpstreamHeader)

		adapter := caddyconfig.GetAdapter("caddyfile")
		if adapter == nil {
			caddyEngineErr = errors.New("caddyfile adapter not registered")
			return
		}
		configJSON, _, err := adapter.Adapt([]byte(caddyfileText), nil)
		if err != nil {
			caddyEngineErr = fmt.Errorf("adapt embedded caddy config: %w", err)
			return
		}
		if err := caddy.Load(configJSON, true); err != nil {
			caddyEngineErr = fmt.Errorf("start embedded caddy engine: %w", err)
			return
		}
	})
	return caddyEngineAddr, caddyEngineErr
}

// newCaddyProxy returns an http.Handler that forwards every request to target
// via the embedded Caddy engine. This replaces the hand-rolled
// httputil.ReverseProxy (custom Director, buffer pool, flush-interval tuning)
// that used to live directly in Handler: Caddy's real reverse-proxy engine
// now owns buffering, streaming, and connection handling for the pass-through
// path. The only Go code left here is the loopback hop that tags each request
// with its real destination.
func newCaddyProxy(target *url.URL) (http.Handler, error) {
	engineAddr, err := ensureCaddyEngine()
	if err != nil {
		return nil, err
	}
	engineURL := &url.URL{Scheme: "http", Host: engineAddr}
	proxy := httputil.NewSingleHostReverseProxy(engineURL)
	baseDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		baseDirector(req)
		// NewSingleHostReverseProxy's default director only rewrites
		// req.URL.Host, not req.Host (the actual outgoing Host header). Since
		// the embedded engine's site block is host-matched
		// (http://127.0.0.1:<port>), the request must carry that as its Host
		// header too, or Caddy never matches the site and silently no-ops.
		req.Host = engineURL.Host
		req.Header.Set(caddyUpstreamHeader, target.Host)
	}
	proxy.ErrorHandler = proxyErrorHandler
	return proxy, nil
}

// IsErrServerClosed reports whether err is http.ErrServerClosed — the expected
// error from Server.Shutdown. Main callers use this to distinguish graceful
// shutdown from a real listen failure.
func IsErrServerClosed(err error) bool {
	return errors.Is(err, http.ErrServerClosed)
}

// proxyErrorHandler is the bridge proxy's ErrorHandler: invoked when the
// loopback hop into the embedded Caddy engine fails (which, since the engine
// lives in this same process, indicates the engine itself failed to start or
// crashed — a distinct failure mode from the frontend being down, which Caddy
// itself now handles and reports with its own 502). We log it as an operator-
// visible error. Context cancellation (client disconnect) is intentionally
// left as a no-op so a client hang-up does not log as an error.
func proxyErrorHandler(w http.ResponseWriter, r *http.Request, err error) {
	if errors.Is(err, context.Canceled) {
		return
	}
	log.Printf("opengraph-service: embedded caddy proxy error for %s %s: %v",
		r.Method, r.URL.Path, err)
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusBadGateway)
	_, _ = w.Write([]byte("upstream unavailable\n"))
}
