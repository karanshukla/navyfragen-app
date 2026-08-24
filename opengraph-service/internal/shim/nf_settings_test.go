package shim

import (
	"context"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func newTestSettingsClient(url string, timeout time.Duration) *NFSettingsClient {
	c := NewNFSettingsClient(url, timeout)
	c.AttemptTimeout = timeout
	return c
}

func TestNewNFSettingsClient_Defaults(t *testing.T) {
	c := NewNFSettingsClient("", 0)
	if c.Host != DefaultNFServerHost {
		t.Errorf("Host = %q, want %q", c.Host, DefaultNFServerHost)
	}
	if c.Timeout != defaultSettingsTimeout {
		t.Errorf("Timeout = %v, want %v", c.Timeout, defaultSettingsTimeout)
	}
	if c.AttemptTimeout <= 0 || c.AttemptTimeout > c.Timeout {
		t.Fatalf("AttemptTimeout %v must be positive and within the overall budget %v", c.AttemptTimeout, c.Timeout)
	}

	short := NewNFSettingsClient("http://x/", 2*time.Second)
	if short.AttemptTimeout != 2*time.Second {
		t.Fatalf("expected attempt timeout clamped to 2s, got %v", short.AttemptTimeout)
	}
}

func TestNewNFSettingsClient_TrimsTrailingSlash(t *testing.T) {
	c := NewNFSettingsClient("http://server:3000/", time.Second)
	if c.Host != "http://server:3000" {
		t.Fatalf("Host = %q, want trailing slash trimmed", c.Host)
	}
}

func TestNFSettingsClient_FetchSettings_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/public-profile/did:plc:abc123" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"customPrompt":     "Pregúntame algo",
			"touchpointLocale": "es",
		})
	}))
	defer srv.Close()

	c := newTestSettingsClient(srv.URL, 2*time.Second)
	got, err := c.FetchSettings(context.Background(), "did:plc:abc123")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := NFSettings{CustomPrompt: "Pregúntame algo", TouchpointLocale: "es"}
	if got != want {
		t.Fatalf("FetchSettings = %+v, want %+v", got, want)
	}
}

func TestNFSettingsClient_FetchSettings_NullFieldsBecomeEmptyStrings(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"customPrompt":     nil,
			"touchpointLocale": nil,
			"inboxEnabled":     true,
		})
	}))
	defer srv.Close()

	c := newTestSettingsClient(srv.URL, 2*time.Second)
	got, err := c.FetchSettings(context.Background(), "did:plc:abc123")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != (NFSettings{}) {
		t.Fatalf("FetchSettings = %+v, want zero value for null fields", got)
	}
}

func TestNFSettingsClient_RetriesWakeStatuses(t *testing.T) {
	for _, status := range []int{http.StatusRequestTimeout, http.StatusBadGateway, http.StatusServiceUnavailable, http.StatusGatewayTimeout} {
		srv, calls := wakeServer(t, status, 2, `{"customPrompt":"hi","touchpointLocale":"en"}`)
		c := newTestSettingsClient(srv.URL, 10*time.Second)

		got, err := c.FetchSettings(context.Background(), "did:plc:test")
		if err != nil {
			t.Fatalf("status %d: expected success after wake, got %v", status, err)
		}
		if got.CustomPrompt != "hi" {
			t.Fatalf("status %d: got %+v", status, got)
		}
		if n := atomic.LoadInt32(calls); n != 3 {
			t.Fatalf("status %d: expected 3 attempts, got %d", status, n)
		}
	}
}

func TestNFSettingsClient_DoesNotRetryClientErrorsOrTooManyRequests(t *testing.T) {
	for _, status := range []int{http.StatusBadRequest, http.StatusNotFound, http.StatusTooManyRequests} {
		srv, calls := wakeServer(t, status, 100, "")
		c := newTestSettingsClient(srv.URL, 5*time.Second)

		_, err := c.FetchSettings(context.Background(), "did:plc:test")
		if err == nil {
			t.Fatalf("status %d: expected an error", status)
		}
		if n := atomic.LoadInt32(calls); n != 1 {
			t.Fatalf("status %d: expected exactly 1 attempt, got %d", status, n)
		}
	}
}

func TestNFSettingsClient_GivesUpAfterDeadlineOnPersistentWakeStatus(t *testing.T) {
	srv, calls := wakeServer(t, http.StatusBadGateway, 1000, "")
	c := newTestSettingsClient(srv.URL, 1500*time.Millisecond)

	start := time.Now()
	_, err := c.FetchSettings(context.Background(), "did:plc:test")
	if err == nil {
		t.Fatal("expected an error")
	}
	if elapsed := time.Since(start); elapsed > 5*time.Second {
		t.Fatalf("retry loop overran its deadline: %v", elapsed)
	}
	if n := atomic.LoadInt32(calls); n < 2 {
		t.Fatalf("expected multiple attempts before giving up, got %d", n)
	}
}

func TestNFSettingsClient_PerAttemptTimeoutLeavesBudgetForRetry(t *testing.T) {
	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if atomic.AddInt32(&calls, 1) == 1 {
			select {
			case <-time.After(2 * time.Second):
			case <-r.Context().Done():
			}
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"customPrompt": "ok"})
	}))
	defer srv.Close()

	c := NewNFSettingsClient(srv.URL, 8*time.Second)
	c.AttemptTimeout = 300 * time.Millisecond

	got, err := c.FetchSettings(context.Background(), "did:plc:test")
	if err != nil {
		t.Fatalf("expected the retry to succeed, got %v", err)
	}
	if got.CustomPrompt != "ok" {
		t.Fatalf("got %+v", got)
	}
}

func TestNFSettingsClient_StopsOnContextCancel(t *testing.T) {
	srv, _ := wakeServer(t, http.StatusBadGateway, 1000, "")
	c := newTestSettingsClient(srv.URL, 30*time.Second)

	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		time.Sleep(200 * time.Millisecond)
		cancel()
	}()

	start := time.Now()
	_, err := c.FetchSettings(ctx, "did:plc:test")
	if err == nil {
		t.Fatal("expected an error")
	}
	if elapsed := time.Since(start); elapsed > 5*time.Second {
		t.Fatalf("cancellation ignored, took %v", elapsed)
	}
}

func TestNFSettingsClient_AlreadyCanceledContext_FailsImmediately(t *testing.T) {
	srv, calls := wakeServer(t, http.StatusOK, 0, `{}`)
	c := newTestSettingsClient(srv.URL, 5*time.Second)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	_, err := c.FetchSettings(ctx, "did:plc:test")
	if err == nil {
		t.Fatal("expected an error")
	}
	if n := atomic.LoadInt32(calls); n != 0 {
		t.Fatalf("expected zero attempts against an already-canceled context, got %d", n)
	}
}

func TestNFSettingsClient_MalformedBody_ReturnsError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("not json"))
	}))
	defer srv.Close()

	c := newTestSettingsClient(srv.URL, 2*time.Second)
	_, err := c.FetchSettings(context.Background(), "did:plc:test")
	if err == nil {
		t.Fatal("expected a decode error")
	}
}

func TestNFSettingsClient_RetriesNetworkErrors(t *testing.T) {
	srv, _ := wakeServer(t, http.StatusOK, 0, `{}`)
	dead := srv.URL
	srv.Close()

	c := newTestSettingsClient(dead, 1500*time.Millisecond)
	start := time.Now()
	_, err := c.FetchSettings(context.Background(), "did:plc:test")
	if err == nil {
		t.Fatal("expected an error")
	}
	if elapsed := time.Since(start); elapsed > 5*time.Second {
		t.Fatalf("retry loop overran its deadline: %v", elapsed)
	}
}

// TestIndigoFetcher_FetchProfile_SettingsFailure_StillReturnsProfile and
// TestIndigoFetcher_FetchProfile_SettingsTimeout_StillReturnsProfile pin the
// hard constraint that a settings-read failure or timeout never fails
// FetchProfile — the card renders with DefaultPrompt instead.

func bskyProfileServer(t *testing.T, did, handle, displayName string) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"did":         did,
			"handle":      handle,
			"displayName": displayName,
		})
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestIndigoFetcher_FetchProfile_SettingsSuccess_PopulatesPromptAndLocale(t *testing.T) {
	appview := bskyProfileServer(t, "did:plc:abc123", "alice.bsky.social", "Alice")
	settingsSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"customPrompt":     "Pregúntame algo",
			"touchpointLocale": "es",
		})
	}))
	defer settingsSrv.Close()

	f := NewIndigoFetcher(appview.URL)
	f.Settings = newTestSettingsClient(settingsSrv.URL, 2*time.Second)

	p, err := f.FetchProfile(context.Background(), "did:plc:abc123")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if p.Prompt != "Pregúntame algo" || p.Locale != "es" {
		t.Fatalf("profile = %+v, want Prompt/Locale populated from settings", p)
	}
}

func TestIndigoFetcher_FetchProfile_SettingsFailure_StillReturnsProfile(t *testing.T) {
	appview := bskyProfileServer(t, "did:plc:abc123", "alice.bsky.social", "Alice")
	settingsSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer settingsSrv.Close()

	f := NewIndigoFetcher(appview.URL)
	f.Settings = newTestSettingsClient(settingsSrv.URL, 2*time.Second)

	p, err := f.FetchProfile(context.Background(), "did:plc:abc123")
	if err != nil {
		t.Fatalf("a settings failure must not fail FetchProfile, got %v", err)
	}
	if p.DisplayName != "Alice" {
		t.Fatalf("profile fields must still be populated, got %+v", p)
	}
	if p.Prompt != "" || p.Locale != "" {
		t.Fatalf("Prompt/Locale must stay unset on a settings failure, got %+v", p)
	}
	if resolvePrompt(p.Prompt, p.Locale) != DefaultPrompt {
		t.Fatalf("resolvePrompt on the returned profile must fall back to DefaultPrompt")
	}
}

func TestIndigoFetcher_FetchProfile_SettingsTimeout_StillReturnsProfile(t *testing.T) {
	appview := bskyProfileServer(t, "did:plc:abc123", "alice.bsky.social", "Alice")
	settingsSrv, _ := wakeServer(t, http.StatusBadGateway, 1000, "")

	f := NewIndigoFetcher(appview.URL)
	c := NewNFSettingsClient(settingsSrv.URL, 300*time.Millisecond)
	c.AttemptTimeout = 100 * time.Millisecond
	f.Settings = c

	start := time.Now()
	p, err := f.FetchProfile(context.Background(), "did:plc:abc123")
	if err != nil {
		t.Fatalf("a settings timeout must not fail FetchProfile, got %v", err)
	}
	if elapsed := time.Since(start); elapsed > 5*time.Second {
		t.Fatalf("FetchProfile must not block past the settings budget, took %v", elapsed)
	}
	if p.DisplayName != "Alice" {
		t.Fatalf("profile fields must still be populated, got %+v", p)
	}
	if p.Prompt != "" || p.Locale != "" {
		t.Fatalf("Prompt/Locale must stay unset on a settings timeout, got %+v", p)
	}
}

func TestIndigoFetcher_FetchProfile_NoSettingsClient_LeavesPromptAndLocaleEmpty(t *testing.T) {
	appview := bskyProfileServer(t, "did:plc:abc123", "alice.bsky.social", "Alice")
	f := NewIndigoFetcher(appview.URL) // f.Settings is nil

	p, err := f.FetchProfile(context.Background(), "did:plc:abc123")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if p.Prompt != "" || p.Locale != "" {
		t.Fatalf("with no Settings client attached, Prompt/Locale must stay empty, got %+v", p)
	}
}

// errSettingsTransport always fails the round trip, simulating a server that
// is entirely unreachable (DNS failure, connection refused) rather than one
// that answers with an error status.
type errSettingsTransport struct{}

func (errSettingsTransport) RoundTrip(*http.Request) (*http.Response, error) {
	return nil, errors.New("connection refused")
}

func TestNFSettingsClient_UnreachableHost_ReturnsErrorNotPanic(t *testing.T) {
	c := NewNFSettingsClient("http://nf-settings.invalid/", 500*time.Millisecond)
	c.AttemptTimeout = 200 * time.Millisecond
	c.Client = &http.Client{Transport: errSettingsTransport{}}

	_, err := c.FetchSettings(context.Background(), "did:plc:test")
	if err == nil {
		t.Fatal("expected an error against an unreachable host")
	}
}

// dnsNotFoundTransport simulates a hostname that fails DNS resolution — the
// expected state of NF_SERVER_URL in production until the Railway variable is
// set (DefaultNFServerHost's docker-compose-local default does not resolve on
// Railway's private network).
type dnsNotFoundTransport struct {
	calls *int32
}

func (t dnsNotFoundTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	atomic.AddInt32(t.calls, 1)
	return nil, &net.DNSError{Err: "no such host", Name: req.URL.Hostname(), IsNotFound: true}
}

// TestNFSettingsClient_DNSResolutionFailure_IsNotRetried pins the fix for a
// production incident risk: a DNS name that does not resolve is a permanent
// misconfiguration, not a wake-shaped failure like 502/503 or
// connection-refused. Retrying it burns the full retry budget as dead latency
// on a cold render — the same render that may also be waiting on
// html-to-image waking Chromium — so it must fail after exactly one attempt,
// well under the configured deadline.
func TestNFSettingsClient_DNSResolutionFailure_IsNotRetried(t *testing.T) {
	var calls int32
	c := NewNFSettingsClient("http://nf-settings.invalid/", 6*time.Second)
	c.AttemptTimeout = 6 * time.Second
	c.Client = &http.Client{Transport: dnsNotFoundTransport{calls: &calls}}

	start := time.Now()
	_, err := c.FetchSettings(context.Background(), "did:plc:test")
	if err == nil {
		t.Fatal("expected an error for a DNS resolution failure")
	}
	if elapsed := time.Since(start); elapsed > 500*time.Millisecond {
		t.Fatalf("a DNS resolution failure must not be retried, took %v (budget was 6s)", elapsed)
	}
	if n := atomic.LoadInt32(&calls); n != 1 {
		t.Fatalf("expected exactly 1 attempt for a DNS resolution failure, got %d", n)
	}
}
