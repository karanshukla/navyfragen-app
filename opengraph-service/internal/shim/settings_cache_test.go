package shim

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

// TestGenerator_SettingsNotFetchedPerRender pins the caching constraint from
// #409: the NF settings read (customPrompt/touchpointLocale) is not fetched
// independently on every render. It piggybacks on the existing per-DID image
// cache by only running inside FetchProfile, which EnsureRendered only calls
// on a stale cache entry — so two EnsureRendered calls within one TTL window
// cost exactly one settings read, the same as they cost exactly one AppView
// profile read.
func TestGenerator_SettingsNotFetchedPerRender(t *testing.T) {
	appview := bskyProfileServer(t, "did:plc:test", "alice.bsky.social", "Alice")

	var settingsCalls int32
	settingsSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&settingsCalls, 1)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"customPrompt":     "Ask away",
			"touchpointLocale": "en",
		})
	}))
	defer settingsSrv.Close()

	fetcher := NewIndigoFetcher(appview.URL)
	fetcher.Settings = newTestSettingsClient(settingsSrv.URL, 2*time.Second)

	cache, err := NewFileCache(t.TempDir(), 100, time.Hour)
	if err != nil {
		t.Fatalf("NewFileCache: %v", err)
	}
	renderer := &FakeRenderer{PNG: []byte("PNG-BYTES")}
	gen := NewGenerator(cache, fetcher, renderer)

	if err := gen.EnsureRendered(context.Background(), "did:plc:test"); err != nil {
		t.Fatalf("first EnsureRendered: %v", err)
	}
	if err := gen.EnsureRendered(context.Background(), "did:plc:test"); err != nil {
		t.Fatalf("second EnsureRendered: %v", err)
	}

	if n := atomic.LoadInt32(&settingsCalls); n != 1 {
		t.Fatalf("settings server received %d requests across two renders, want 1", n)
	}
	if n := atomic.LoadInt32(&renderer.Calls); n != 1 {
		t.Fatalf("renderer called %d times across two renders, want 1 (second render served from cache)", n)
	}
}

// The other side: a settings edit lands on the card in the same window a
// display-name edit would — once the cache entry is stale, the next render
// re-reads settings just like it re-reads the AppView profile.
func TestGenerator_SettingsReReadAfterCacheExpiry(t *testing.T) {
	appview := bskyProfileServer(t, "did:plc:test", "alice.bsky.social", "Alice")

	var settingsCalls int32
	settingsSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&settingsCalls, 1)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"customPrompt": "v", "touchpointLocale": "en"})
	}))
	defer settingsSrv.Close()

	fetcher := NewIndigoFetcher(appview.URL)
	fetcher.Settings = newTestSettingsClient(settingsSrv.URL, 2*time.Second)

	// A TTL of ~0 means every render is treated as stale.
	cache, err := NewFileCache(t.TempDir(), 100, time.Nanosecond)
	if err != nil {
		t.Fatalf("NewFileCache: %v", err)
	}
	renderer := &FakeRenderer{PNG: []byte("PNG-BYTES")}
	gen := NewGenerator(cache, fetcher, renderer)

	if err := gen.EnsureRendered(context.Background(), "did:plc:test"); err != nil {
		t.Fatalf("first EnsureRendered: %v", err)
	}
	time.Sleep(2 * time.Millisecond)
	if err := gen.EnsureRendered(context.Background(), "did:plc:test"); err != nil {
		t.Fatalf("second EnsureRendered: %v", err)
	}

	if n := atomic.LoadInt32(&settingsCalls); n != 2 {
		t.Fatalf("settings server received %d requests across two renders past TTL, want 2", n)
	}
}
