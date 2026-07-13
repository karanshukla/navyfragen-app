package shim

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// FileCache is a DID-keyed, file-backed, LRU-bounded TTL cache. It persists
// generated PNGs across restarts (the Railway volume) and evicts the
// least-recently-used entries when the entry count exceeds MaxEntries. This is
// the production answer to the poc's "unbounded cache" open question.

func newTestCache(t *testing.T, maxEntries int, ttl time.Duration) *FileCache {
	t.Helper()
	dir := t.TempDir()
	c, err := NewFileCache(dir, maxEntries, ttl)
	if err != nil {
		t.Fatalf("NewFileCache: %v", err)
	}
	return c
}

func TestFileCache_StoreAndLoad_Fresh(t *testing.T) {
	c := newTestCache(t, 100, time.Hour)
	if err := c.Store("did:plc:abc", []byte("PNGDATA"), "image/png"); err != nil {
		t.Fatalf("store: %v", err)
	}
	got, err := c.Load("did:plc:abc")
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if string(got.Bytes) != "PNGDATA" {
		t.Fatalf("got bytes %q", got.Bytes)
	}
	if got.MimeType != "image/png" {
		t.Fatalf("got mime %q", got.MimeType)
	}
}

func TestFileCache_MissIsErrNotFound(t *testing.T) {
	c := newTestCache(t, 100, time.Hour)
	if _, err := c.Load("did:plc:missing"); err != ErrCacheMiss {
		t.Fatalf("want ErrCacheMiss, got %v", err)
	}
}

func TestFileCache_ExpiredEntry_TreatedAsMiss(t *testing.T) {
	c := newTestCache(t, 100, time.Hour)
	if err := c.Store("did:plc:abc", []byte("PNGDATA"), "image/png"); err != nil {
		t.Fatalf("store: %v", err)
	}
	// Backdate the entry past TTL by rewriting mtime.
	pngPath := filepath.Join(c.dir, "did-plc-abc.png")
	past := time.Now().Add(-2 * time.Hour)
	if err := os.Chtimes(pngPath, past, past); err != nil {
		t.Fatalf("chtimes: %v", err)
	}
	if _, err := c.Load("did:plc:abc"); err != ErrCacheMiss {
		t.Fatalf("expired entry should be ErrCacheMiss, got %v", err)
	}
}

func TestFileCache_PersistsAcrossReopen(t *testing.T) {
	dir := t.TempDir()
	c1, err := NewFileCache(dir, 100, time.Hour)
	if err != nil {
		t.Fatalf("NewFileCache: %v", err)
	}
	if err := c1.Store("did:plc:persist", []byte("PERSIST"), "image/png"); err != nil {
		t.Fatalf("store: %v", err)
	}

	// Simulate a restart: a new FileCache pointed at the same dir must see it.
	c2, err := NewFileCache(dir, 100, time.Hour)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	got, err := c2.Load("did:plc:persist")
	if err != nil {
		t.Fatalf("load after reopen: %v", err)
	}
	if string(got.Bytes) != "PERSIST" {
		t.Fatalf("got %q after reopen", got.Bytes)
	}
}

func TestFileCache_LRU_EvictsOldest(t *testing.T) {
	c := newTestCache(t, 2, time.Hour)
	// Fill to capacity.
	mustStore(t, c, "did:plc:a", "A")
	mustStore(t, c, "did:plc:b", "B")
	// Touch "a" so "b" becomes least-recently-used.
	if _, err := c.Load("did:plc:a"); err != nil {
		t.Fatalf("load a: %v", err)
	}
	// Insert "c" — this exceeds capacity and must evict the LRU ("b").
	mustStore(t, c, "did:plc:c", "C")
	if _, err := c.Load("did:plc:a"); err != nil {
		t.Fatalf("a should still be present (was touched), got %v", err)
	}
	if _, err := c.Load("did:plc:b"); err != ErrCacheMiss {
		t.Fatalf("b should have been evicted as LRU, got %v", err)
	}
	if _, err := c.Load("did:plc:c"); err != nil {
		t.Fatalf("c should be present, got %v", err)
	}
}

func TestFileCache_LRUBoundTriggersActualEvictionAtCapacity(t *testing.T) {
	// Inserting the (capacity+1)th entry must reduce on-disk count back to
	// capacity — the eviction is eager, not lazy.
	c := newTestCache(t, 3, time.Hour)
	for _, k := range []string{"did:plc:1", "did:plc:2", "did:plc:3", "did:plc:4"} {
		mustStore(t, c, k, "x")
	}
	entries, _ := os.ReadDir(c.dir)
	pngCount := 0
	for _, e := range entries {
		if !e.IsDir() {
			pngCount++
		}
	}
	// Each entry has 1 PNG + 1 sidecar meta, so total files = capacity * 2.
	if pngCount != 6 {
		t.Fatalf("expected 6 files (3 entries x 2 files), got %d", pngCount)
	}
}

func mustStore(t *testing.T, c *FileCache, did, payload string) {
	t.Helper()
	if err := c.Store(did, []byte(payload), "image/png"); err != nil {
		t.Fatalf("store %s: %v", did, err)
	}
}

// --- TTL/LRU separation (red→green for the concerns that Load's Chtimes was
// refreshing the TTL clock and LoadByPath was not updating LRU recency). ---

// TestFileCache_LoadDoesNotRefreshTTL pins the invariant that reading an entry
// does NOT extend its TTL. Before the fix, Load called os.Chtimes on the .png
// (the TTL clock), so a popular entry read at least once per TTL window never
// expired — defeating the "~monthly refresh" tradeoff. Now Load touches only
// the .meta sidecar; the .png ModTime (TTL clock) is frozen at Store time.
func TestFileCache_LoadDoesNotRefreshTTL(t *testing.T) {
	c := newTestCache(t, 100, time.Hour)
	if err := c.Store("did:plc:ttl", []byte("X"), "image/png"); err != nil {
		t.Fatal(err)
	}
	pngPath := c.pngPath("did:plc:ttl")
	storeMod, err := os.Stat(pngPath)
	if err != nil {
		t.Fatal(err)
	}

	// Simulate the .png mtime being just inside TTL at generation time by
	// backdating it close to the TTL edge. The .png must stay there across
	// many Load calls — Load must NOT refresh it.
	nearExpiry := time.Now().Add(-55 * time.Minute) // TTL is 1h, so 5m of life left
	if err := os.Chtimes(pngPath, nearExpiry, nearExpiry); err != nil {
		t.Fatal(err)
	}

	// Many generate-path hits (a popular profile).
	for i := 0; i < 50; i++ {
		if _, err := c.Load("did:plc:ttl"); err != nil {
			t.Fatalf("load %d: %v", i, err)
		}
	}

	gotMod, err := os.Stat(pngPath)
	if err != nil {
		t.Fatal(err)
	}
	if !gotMod.ModTime().Equal(nearExpiry) {
		t.Fatalf("Load refreshed the TTL clock: .png mtime moved from %v to %v (expected unchanged)",
			nearExpiry, gotMod.ModTime())
	}
	// Sanity: the store-time mtime we captured above should still be later than
	// the backdated nearExpiry, confirming we are asserting against a real
	// change, not a no-op.
	if !gotMod.ModTime().Before(storeMod.ModTime()) {
		t.Fatalf("test setup invariant: backdated mtime %v should be before store mtime %v",
			gotMod.ModTime(), storeMod.ModTime())
	}
}

// TestFileCache_LoadByPathUpdatesLRURecency pins the invariant that the
// image-serving path (GET /og-cache/:did.png) participates in LRU eviction
// ordering. Before the fix, LoadByPath touched neither file, so heavily-served
// images could be evicted as "least recently used" because the serve path
// never marked them recent. Now LoadByPath bumps the .meta mtime.
func TestFileCache_LoadByPathUpdatesLRURecency(t *testing.T) {
	c := newTestCache(t, 2, time.Hour)
	mustStore(t, c, "did:plc:a", "A")
	mustStore(t, c, "did:plc:b", "B")

	// Serve "b" many times via LoadByPath — the route real crawlers hit.
	p := c.pngPath("did:plc:b")
	for i := 0; i < 10; i++ {
		if _, err := c.LoadByPath(p); err != nil {
			t.Fatalf("loadbypath %d: %v", i, err)
		}
	}
	// "a" is untouched since store; "b" was just served repeatedly. Inserting
	// "c" exceeds capacity and must evict the LRU, which is "a" (not "b").
	mustStore(t, c, "did:plc:c", "C")
	if _, err := c.Load("did:plc:b"); err != nil {
		t.Fatalf("heavily-served b should be retained, got %v", err)
	}
	if _, err := c.Load("did:plc:a"); err != ErrCacheMiss {
		t.Fatalf("untouched a should have been evicted as LRU, got %v", err)
	}
}

// TestFileCache_LoadByPathDoesNotRefreshTTL pins the matching invariant for the
// serve path: serving an image does not extend its TTL. The .png mtime (TTL
// clock) must be frozen at Store time even when the image is served constantly.
func TestFileCache_LoadByPathDoesNotRefreshTTL(t *testing.T) {
	c := newTestCache(t, 100, time.Hour)
	mustStore(t, c, "did:plc:x", "X")
	p := c.pngPath("did:plc:x")
	nearExpiry := time.Now().Add(-55 * time.Minute)
	if err := os.Chtimes(p, nearExpiry, nearExpiry); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 20; i++ {
		if _, err := c.LoadByPath(p); err != nil {
			t.Fatalf("loadbypath %d: %v", i, err)
		}
	}
	gotMod, err := os.Stat(p)
	if err != nil {
		t.Fatal(err)
	}
	if !gotMod.ModTime().Equal(nearExpiry) {
		t.Fatalf("LoadByPath refreshed the TTL clock: %v (expected %v)", gotMod.ModTime(), nearExpiry)
	}
}

// TestFileCache_StoreIsAtomic pins the atomic-store invariant: a concurrent
// reader (Load / LoadByPath) never observes a truncated or partially-written
// .png. Store writes to a temp file and renames; a reader either sees the
// previous complete entry or the new complete entry, never a half-written one.
// We assert the load-bearing property: after Store, the .png on disk is
// byte-for-byte what was stored (no torn write), and a re-Store over an
// existing entry leaves a consistent file.
func TestFileCache_StoreOverwritesAtomically(t *testing.T) {
	c := newTestCache(t, 100, time.Hour)
	first := bytes.Repeat([]byte{0x01}, 4096)
	second := bytes.Repeat([]byte{0x02}, 4096)
	if err := c.Store("did:plc:atom", first, "image/png"); err != nil {
		t.Fatal(err)
	}
	// Overwrite with different content.
	if err := c.Store("did:plc:atom", second, "image/png"); err != nil {
		t.Fatal(err)
	}
	got, err := c.Load("did:plc:atom")
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if !bytes.Equal(got.Bytes, second) {
		t.Fatalf("atomic overwrite failed: got %d bytes of value %d, want %d bytes of value %d",
			len(got.Bytes), got.Bytes[0], len(second), second[0])
	}
	// No leftover temp files in the cache dir.
	entries, _ := os.ReadDir(c.dir)
	for _, e := range entries {
		if strings.HasPrefix(e.Name(), ".tmp-") {
			t.Fatalf("temp file left behind after atomic Store: %s", e.Name())
		}
	}
}
