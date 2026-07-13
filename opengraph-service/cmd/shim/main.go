// Command shim is the opengraph-service reverse proxy. It sits between Caddy
// and the client. The fast path (everything except Bluesky Cardyb on
// /profile/:handle) is a near-zero-overhead httputil.ReverseProxy pass-through.
// The generate path (Cardyb + profile) resolves the handle via indigo, renders a
// per-profile OG image via html-to-image, caches it by DID, and serves a
// rewritten HTML response whose og:image points at the cached PNG.
//
// Cache-serving is a shim responsibility: GET /og-cache/:did.png returns the
// stored image directly from the volume.
//
// The HTTP wiring lives in internal/shim.Handler so the full request path can
// be exercised by an in-process integration test with the external deps
// (indigo, html-to-image) stubbed. main.go constructs the Handler with real
// dependencies and serves it.
package main

import (
	"context"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/karanshukla/navyfragen-app/opengraph-service/internal/shim"
)

func main() {
	var (
		frontendURL = flag.String("frontend", envOr("FRONTEND_URL", "http://client:3000"), "upstream client URL to proxy to")
		exportURL   = flag.String("export-html-url", envOr("EXPORT_HTML_URL", "http://html-to-image:3033/"), "html-to-image service URL")
		appViewHost = flag.String("appview-host", envOr("ATPROTO_APPVIEW_HOST", shim.DefaultAppViewHost), "AT Protocol AppView host")
		cacheDir    = flag.String("cache-dir", envOr("OG_CACHE_DIR", "/data/og-cache"), "cache directory (Railway volume)")
		cacheTTL    = flag.String("cache-ttl", envOr("OG_CACHE_TTL", "720h"), "cache TTL (Go duration; ~1 month)")
		cacheMaxStr = flag.String("cache-max-entries", envOr("OG_CACHE_MAX_ENTRIES", "0"), "max cache entries; 0 = built-in default")
		renderTO    = flag.String("render-timeout", envOr("OG_RENDER_TIMEOUT", "30s"), "html-to-image render deadline")
		origin      = flag.String("origin", envOr("PUBLIC_URL", "https://navyfragen.app"), "public site origin for absolute OG URLs")
		addr        = flag.String("addr", normalizeAddr(envOr("PORT", "8080")), "listen address")
	)
	flag.Parse()

	ttl := shim.ParseTTL(*cacheTTL, 720*time.Hour)
	maxEntries := parseIntOr(*cacheMaxStr, shim.DefaultCacheMaxEntries)
	cache, err := shim.NewFileCache(*cacheDir, maxEntries, ttl)
	if err != nil {
		log.Fatalf("open cache %s: %v", *cacheDir, err)
	}

	fetcher := shim.NewIndigoFetcher(*appViewHost)
	renderer := shim.NewHTMLToImageRenderer(*exportURL, parseDurationOr(*renderTO, 30*time.Second))
	generator := shim.NewGenerator(cache, fetcher, renderer)

	handler, err := shim.NewHandler(*frontendURL, generator, cache, *origin)
	if err != nil {
		log.Fatalf("build handler: %v", err)
	}

	log.Printf("opengraph-service shim listening on %s, proxying to %s (cache %s, ttl %s)",
		*addr, *frontendURL, *cacheDir, ttl)

	srv := &http.Server{
		Addr:              *addr,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		// No WriteTimeout on the server level — the Generate path can legitimately
		// take seconds (indigo + headless render). Per-request deadlines live in
		// the renderer client. IdleTimeout keeps idle keep-alives from piling up.
		IdleTimeout: 120 * time.Second,
	}

	// Graceful shutdown: stop accepting new connections, finish in-flight
	// pass-throughs. Generation requests rely on the renderer's own deadline.
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = srv.Shutdown(ctx)
	}()

	if err := srv.ListenAndServe(); !shim.IsErrServerClosed(err) {
		log.Fatalf("listen: %v", err)
	}
}

func envOr(key, def string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return def
}

// normalizeAddr turns a bare port ("8080") into the listen form (":8080") that
// net/http expects, while leaving already-qualified addresses ("0.0.0.0:8080",
// "[::]:8080") untouched. Railway and docker compose commonly pass PORT as a
// bare number.
func normalizeAddr(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ":8080"
	}
	if strings.ContainsAny(s, ":[]") {
		return s
	}
	return ":" + s
}

func parseDurationOr(s string, def time.Duration) time.Duration {
	s = strings.TrimSpace(s)
	if s == "" {
		return def
	}
	d, err := time.ParseDuration(s)
	if err != nil || d <= 0 {
		return def
	}
	return d
}

func parseIntOr(s string, def int) int {
	s = strings.TrimSpace(s)
	if s == "" || s == "0" {
		return def
	}
	var n int
	for _, c := range s {
		if c < '0' || c > '9' {
			return def
		}
		n = n*10 + int(c-'0')
	}
	if n <= 0 {
		return def
	}
	return n
}
