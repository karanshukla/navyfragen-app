package shim

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/bluesky-social/indigo/xrpc"
)

func TestDerefStr(t *testing.T) {
	if got := derefStr(nil); got != "" {
		t.Errorf("derefStr(nil) = %q, want empty string", got)
	}
	s := "hello"
	if got := derefStr(&s); got != "hello" {
		t.Errorf("derefStr(&%q) = %q, want %q", s, got, s)
	}
}

func TestIsNotFound(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want bool
	}{
		{"nil error", nil, false},
		{"xrpc 400", &xrpc.Error{StatusCode: 400}, true},
		{"xrpc 404", &xrpc.Error{StatusCode: 404}, true},
		{"xrpc 500", &xrpc.Error{StatusCode: 500}, false},
		{"generic not found substring", errors.New("record not found"), true},
		{"generic unable to resolve handle substring", errors.New("Unable to resolve handle"), true},
		{"generic unrelated error", errors.New("connection refused"), false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := isNotFound(tc.err); got != tc.want {
				t.Errorf("isNotFound(%v) = %v, want %v", tc.err, got, tc.want)
			}
		})
	}
}

func TestNewIndigoFetcher(t *testing.T) {
	t.Run("defaults to DefaultAppViewHost when host is empty", func(t *testing.T) {
		f := NewIndigoFetcher("")
		if f.Client.Host != DefaultAppViewHost {
			t.Errorf("Host = %q, want %q", f.Client.Host, DefaultAppViewHost)
		}
	})

	t.Run("uses the given host when non-empty", func(t *testing.T) {
		f := NewIndigoFetcher("https://custom.example.com")
		if f.Client.Host != "https://custom.example.com" {
			t.Errorf("Host = %q, want custom host", f.Client.Host)
		}
	})
}

// writeXRPCError mimics the AppView's XRPC error envelope so xrpc.Error's
// StatusCode is populated the same way it would be from a real response.
func writeXRPCError(w http.ResponseWriter, status int, errName, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": errName, "message": message})
}

func TestIndigoFetcher_ResolveDID(t *testing.T) {
	t.Run("returns the resolved DID on success", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !strings.Contains(r.URL.Path, "com.atproto.identity.resolveHandle") {
				t.Errorf("unexpected path: %s", r.URL.Path)
			}
			if got := r.URL.Query().Get("handle"); got != "alice.bsky.social" {
				t.Errorf("handle param = %q, want alice.bsky.social", got)
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{"did": "did:plc:abc123"})
		}))
		defer srv.Close()

		f := NewIndigoFetcher(srv.URL)
		did, err := f.ResolveDID(t.Context(), "@alice.bsky.social")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if did != "did:plc:abc123" {
			t.Errorf("did = %q, want did:plc:abc123", did)
		}
	})

	t.Run("maps a 400 (unresolvable handle) to ErrProfileNotFound", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			writeXRPCError(w, http.StatusBadRequest, "InvalidRequest", "Unable to resolve handle")
		}))
		defer srv.Close()

		f := NewIndigoFetcher(srv.URL)
		_, err := f.ResolveDID(t.Context(), "nonexistent.bsky.social")
		if !errors.Is(err, ErrProfileNotFound) {
			t.Errorf("err = %v, want ErrProfileNotFound", err)
		}
	})

	t.Run("passes through an unrelated error unchanged", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			writeXRPCError(w, http.StatusInternalServerError, "InternalServerError", "boom")
		}))
		defer srv.Close()

		f := NewIndigoFetcher(srv.URL)
		_, err := f.ResolveDID(t.Context(), "alice.bsky.social")
		if err == nil {
			t.Fatal("expected an error")
		}
		if errors.Is(err, ErrProfileNotFound) {
			t.Error("a 500 should not be mapped to ErrProfileNotFound")
		}
	})
}

func TestIndigoFetcher_FetchProfile(t *testing.T) {
	t.Run("returns a fully populated profile on success", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !strings.Contains(r.URL.Path, "app.bsky.actor.getProfile") {
				t.Errorf("unexpected path: %s", r.URL.Path)
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{
				"did":         "did:plc:abc123",
				"handle":      "alice.bsky.social",
				"displayName": "Alice",
				"banner":      "https://cdn.bsky.app/banner.jpg",
				"avatar":      "https://cdn.bsky.app/avatar.jpg",
			})
		}))
		defer srv.Close()

		f := NewIndigoFetcher(srv.URL)
		p, err := f.FetchProfile(t.Context(), "did:plc:abc123")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		want := Profile{
			DID:         "did:plc:abc123",
			Handle:      "alice.bsky.social",
			DisplayName: "Alice",
			Banner:      "https://cdn.bsky.app/banner.jpg",
			Avatar:      "https://cdn.bsky.app/avatar.jpg",
		}
		if p != want {
			t.Errorf("profile = %+v, want %+v", p, want)
		}
	})

	t.Run("defaults optional fields to empty string when absent", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{
				"did":    "did:plc:abc123",
				"handle": "alice.bsky.social",
			})
		}))
		defer srv.Close()

		f := NewIndigoFetcher(srv.URL)
		p, err := f.FetchProfile(t.Context(), "did:plc:abc123")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if p.DisplayName != "" || p.Banner != "" || p.Avatar != "" {
			t.Errorf("expected empty optional fields, got %+v", p)
		}
	})

	t.Run("maps a 404 to ErrProfileNotFound", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			writeXRPCError(w, http.StatusNotFound, "NotFound", "Profile not found")
		}))
		defer srv.Close()

		f := NewIndigoFetcher(srv.URL)
		_, err := f.FetchProfile(t.Context(), "did:plc:missing")
		if !errors.Is(err, ErrProfileNotFound) {
			t.Errorf("err = %v, want ErrProfileNotFound", err)
		}
	})

	t.Run("passes through an unrelated error unchanged", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			writeXRPCError(w, http.StatusInternalServerError, "InternalServerError", "boom")
		}))
		defer srv.Close()

		f := NewIndigoFetcher(srv.URL)
		_, err := f.FetchProfile(t.Context(), "did:plc:abc123")
		if err == nil {
			t.Fatal("expected an error")
		}
		if errors.Is(err, ErrProfileNotFound) {
			t.Error("a 500 should not be mapped to ErrProfileNotFound")
		}
	})
}
