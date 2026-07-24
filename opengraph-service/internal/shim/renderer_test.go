package shim

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

// wakeServer answers the first failCount requests with status, then serves the
// PNG — the shape of a Railway service coming out of sleep.
func wakeServer(t *testing.T, status int, failCount int32, png string) (*httptest.Server, *int32) {
	t.Helper()
	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		n := atomic.AddInt32(&calls, 1)
		if n <= failCount {
			w.WriteHeader(status)
			_, _ = w.Write([]byte("Application failed to respond"))
			return
		}
		w.Header().Set("Content-Type", "image/png")
		_, _ = w.Write([]byte(png))
	}))
	t.Cleanup(srv.Close)
	return srv, &calls
}

func newTestRenderer(url string, timeout time.Duration) *HTMLToImageRenderer {
	r := NewHTMLToImageRenderer(url, timeout)
	r.AttemptTimeout = timeout
	return r
}

func TestRenderRetriesWakeStatuses(t *testing.T) {
	// Railway's edge answers 502 while the container is still waking, and the
	// image service answers 503 while Chromium is still launching. Neither means
	// the render is impossible.
	for _, status := range []int{http.StatusRequestTimeout, http.StatusBadGateway, http.StatusServiceUnavailable, http.StatusGatewayTimeout} {
		srv, calls := wakeServer(t, status, 2, "PNGDATA")
		r := newTestRenderer(srv.URL, 10*time.Second)

		got, err := r.Render(context.Background(), "<h1>hi</h1>")
		if err != nil {
			t.Fatalf("status %d: expected success after wake, got %v", status, err)
		}
		if string(got) != "PNGDATA" {
			t.Fatalf("status %d: got body %q", status, got)
		}
		if n := atomic.LoadInt32(calls); n != 3 {
			t.Fatalf("status %d: expected 3 attempts, got %d", status, n)
		}
	}
}

func TestRenderDoesNotRetryClientErrors(t *testing.T) {
	// A rejected payload fails identically on every attempt; retrying only burns
	// the deadline.
	for _, status := range []int{http.StatusBadRequest, http.StatusUnsupportedMediaType, http.StatusTooManyRequests} {
		srv, calls := wakeServer(t, status, 100, "")
		r := newTestRenderer(srv.URL, 5*time.Second)

		_, err := r.Render(context.Background(), "<h1>hi</h1>")
		if !errors.Is(err, ErrRenderFailed) {
			t.Fatalf("status %d: expected ErrRenderFailed, got %v", status, err)
		}
		if n := atomic.LoadInt32(calls); n != 1 {
			t.Fatalf("status %d: expected exactly 1 attempt, got %d", status, n)
		}
	}
}

func TestRenderRetriesNetworkErrors(t *testing.T) {
	srv, _ := wakeServer(t, http.StatusOK, 0, "PNGDATA")
	dead := srv.URL
	srv.Close() // nothing is listening — every dial fails

	r := newTestRenderer(dead, 1500*time.Millisecond)
	start := time.Now()
	_, err := r.Render(context.Background(), "<h1>hi</h1>")
	if !errors.Is(err, ErrRenderFailed) {
		t.Fatalf("expected ErrRenderFailed, got %v", err)
	}
	if elapsed := time.Since(start); elapsed > 5*time.Second {
		t.Fatalf("retry loop overran its deadline: %v", elapsed)
	}
}

func TestRenderGivesUpAfterDeadlineOnPersistentWakeStatus(t *testing.T) {
	srv, calls := wakeServer(t, http.StatusBadGateway, 1000, "")
	r := newTestRenderer(srv.URL, 1500*time.Millisecond)

	start := time.Now()
	_, err := r.Render(context.Background(), "<h1>hi</h1>")
	if !errors.Is(err, ErrRenderFailed) {
		t.Fatalf("expected ErrRenderFailed, got %v", err)
	}
	if elapsed := time.Since(start); elapsed > 5*time.Second {
		t.Fatalf("retry loop overran its deadline: %v", elapsed)
	}
	if n := atomic.LoadInt32(calls); n < 2 {
		t.Fatalf("expected multiple attempts before giving up, got %d", n)
	}
}

func TestRenderPerAttemptTimeoutLeavesBudgetForRetry(t *testing.T) {
	// The first attempt hangs. With a client timeout equal to the overall
	// deadline it would swallow the entire budget; a per-attempt bound must cut
	// it loose in time for the retry that succeeds.
	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if atomic.AddInt32(&calls, 1) == 1 {
			select {
			case <-time.After(2 * time.Second):
			case <-r.Context().Done():
			}
			return
		}
		_, _ = w.Write([]byte("PNGDATA"))
	}))
	t.Cleanup(srv.Close)

	r := NewHTMLToImageRenderer(srv.URL, 8*time.Second)
	r.AttemptTimeout = 300 * time.Millisecond

	got, err := r.Render(context.Background(), "<h1>hi</h1>")
	if err != nil {
		t.Fatalf("expected the retry to succeed, got %v", err)
	}
	if string(got) != "PNGDATA" {
		t.Fatalf("got body %q", got)
	}
}

func TestRenderStopsOnContextCancel(t *testing.T) {
	srv, _ := wakeServer(t, http.StatusBadGateway, 1000, "")
	r := newTestRenderer(srv.URL, 30*time.Second)

	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		time.Sleep(200 * time.Millisecond)
		cancel()
	}()

	start := time.Now()
	_, err := r.Render(ctx, "<h1>hi</h1>")
	if !errors.Is(err, ErrRenderFailed) {
		t.Fatalf("expected ErrRenderFailed, got %v", err)
	}
	// Must abandon the loop on cancellation rather than sleeping out the 30s.
	if elapsed := time.Since(start); elapsed > 5*time.Second {
		t.Fatalf("cancellation ignored, took %v", elapsed)
	}
}

func TestRenderRejectsEmptySuccessBody(t *testing.T) {
	srv, _ := wakeServer(t, http.StatusOK, 0, "")
	r := newTestRenderer(srv.URL, 2*time.Second)

	_, err := r.Render(context.Background(), "<h1>hi</h1>")
	if !errors.Is(err, ErrRenderFailed) {
		t.Fatalf("expected ErrRenderFailed for an empty 200, got %v", err)
	}
}

func TestNewHTMLToImageRendererDefaults(t *testing.T) {
	r := NewHTMLToImageRenderer("", 0)
	if r.URL != "http://localhost:3033/" {
		t.Fatalf("unexpected default URL %q", r.URL)
	}
	if r.Timeout != 30*time.Second {
		t.Fatalf("unexpected default timeout %v", r.Timeout)
	}
	// A client-level timeout would bound the whole retry loop instead of one
	// attempt, which is the bug the per-attempt deadline replaces.
	if r.Client.Timeout != 0 {
		t.Fatalf("client timeout must stay unset, got %v", r.Client.Timeout)
	}
	if r.AttemptTimeout <= 0 || r.AttemptTimeout > r.Timeout {
		t.Fatalf("attempt timeout %v must be positive and within the overall budget", r.AttemptTimeout)
	}

	// A short overall budget must clamp the per-attempt bound, not exceed it.
	short := NewHTMLToImageRenderer("http://x/", 2*time.Second)
	if short.AttemptTimeout != 2*time.Second {
		t.Fatalf("expected attempt timeout clamped to 2s, got %v", short.AttemptTimeout)
	}
}
