// Package bench holds in-process latency benchmarks that isolate the
// reverse-proxy overhead from network noise. These are not unit tests; they
// measure the per-request cost added by the shim's fast path.
package bench

import (
	"io"
	"net/http"
	"net/http/httptest"
	"net/http/httputil"
	"net/url"
	"strings"
	"testing"
)

// stubPayload is what the upstream returns — a small static body, like the
// client's index.html on the hot path.
const stubPayload = `<!DOCTYPE html><html><head><title>stub</title></head><body>ok</body></html>`

// BenchmarkDirectHandler measures the floor: a raw handler with no proxy in
// the way. This is the "no shim" baseline.
func BenchmarkDirectHandler(b *testing.B) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, stubPayload)
	}))
	defer upstream.Close()

	client := upstream.Client()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		resp, err := client.Get(upstream.URL)
		if err != nil {
			b.Fatal(err)
		}
		_, _ = io.Copy(io.Discard, resp.Body)
		resp.Body.Close()
	}
}

// BenchmarkViaReverseProxy measures the cost of an httputil.ReverseProxy in
// front of the same upstream. The difference vs BenchmarkDirectHandler is the
// shim's hot-path overhead.
func BenchmarkViaReverseProxy(b *testing.B) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, stubPayload)
	}))
	defer upstream.Close()

	target, _ := url.Parse(upstream.URL)
	proxy := &httputil.ReverseProxy{
		Director: func(req *http.Request) {
			req.URL.Scheme = target.Scheme
			req.URL.Host = target.Host
			req.Host = target.Host
		},
	}
	shim := httptest.NewServer(proxy)
	defer shim.Close()

	client := shim.Client()
	// Sanity: the shim actually proxies before we time it.
	resp, err := client.Get(shim.URL)
	if err != nil {
		b.Fatal(err)
	}
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if !strings.Contains(string(body), "ok") {
		b.Fatalf("shim did not proxy: got %q", body)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		resp, err := client.Get(shim.URL)
		if err != nil {
			b.Fatal(err)
		}
		_, _ = io.Copy(io.Discard, resp.Body)
		resp.Body.Close()
	}
}
