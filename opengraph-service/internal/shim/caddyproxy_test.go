package shim

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestIsErrServerClosed(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want bool
	}{
		{"nil", nil, false},
		{"exact match", http.ErrServerClosed, true},
		{"wrapped", fmt.Errorf("listen: %w", http.ErrServerClosed), true},
		{"unrelated error", errors.New("connection refused"), false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := IsErrServerClosed(tc.err); got != tc.want {
				t.Errorf("IsErrServerClosed(%v) = %v, want %v", tc.err, got, tc.want)
			}
		})
	}
}

func TestProxyErrorHandler_ContextCanceled_IsNoop(t *testing.T) {
	// A client disconnect (context.Canceled) must not be logged as an error or
	// write a response — the caller hung up, there's nothing to report.
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/profile/alice", nil)
	proxyErrorHandler(rec, req, context.Canceled)
	if rec.Code != http.StatusOK {
		// httptest.ResponseRecorder defaults to 200 when WriteHeader is never called.
		t.Fatalf("status = %d, want no response written (default 200)", rec.Code)
	}
	if rec.Body.Len() != 0 {
		t.Fatalf("body = %q, want empty (no response written)", rec.Body.String())
	}
}

func TestProxyErrorHandler_OtherError_Returns502(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/profile/alice", nil)
	proxyErrorHandler(rec, req, errors.New("engine unreachable"))
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status = %d, want 502", rec.Code)
	}
	if rec.Body.String() != "upstream unavailable\n" {
		t.Fatalf("body = %q", rec.Body.String())
	}
	if ct := rec.Header().Get("Content-Type"); ct != "text/plain; charset=utf-8" {
		t.Fatalf("Content-Type = %q", ct)
	}
}
