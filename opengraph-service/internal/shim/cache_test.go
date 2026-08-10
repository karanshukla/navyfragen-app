package shim

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

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

// Reading an entry must not extend its TTL, or a profile popular enough to be
// read once per window would never pick up a banner/avatar edit.
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

// The serve path must participate in LRU ordering, or a heavily-served image
// gets evicted as "least recently used".
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

// The serve-path counterpart: serving an image must not extend its TTL.
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

func TestNewFileCache_NonPositiveMaxEntriesFallsBackToDefault(t *testing.T) {
	for _, n := range []int{0, -1, -100} {
		c, err := NewFileCache(t.TempDir(), n, time.Hour)
		if err != nil {
			t.Fatalf("NewFileCache(%d): %v", n, err)
		}
		if c.MaxEntries != DefaultCacheMaxEntries {
			t.Errorf("MaxEntries for input %d = %d, want default %d", n, c.MaxEntries, DefaultCacheMaxEntries)
		}
	}
}

func TestNewFileCache_MkdirAllFailure(t *testing.T) {
	// A regular file in the path where a directory component is expected makes
	// MkdirAll fail.
	parent := t.TempDir()
	blocker := filepath.Join(parent, "blocker")
	if err := os.WriteFile(blocker, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := NewFileCache(filepath.Join(blocker, "cache"), 100, time.Hour); err == nil {
		t.Fatal("expected an error when a path component is a file, got nil")
	}
}

func TestFileCache_Load_ReadFileFailureIsCacheMiss(t *testing.T) {
	// Stat succeeds (the .png exists) but ReadFile fails: point the "png" at a
	// directory, which os.Stat happily describes but os.ReadFile cannot read.
	c := newTestCache(t, 100, time.Hour)
	if err := os.MkdirAll(c.pngPath("did:plc:dir"), 0o755); err != nil {
		t.Fatal(err)
	}
	if _, err := c.Load("did:plc:dir"); err != ErrCacheMiss {
		t.Fatalf("want ErrCacheMiss when the png path is a directory, got %v", err)
	}
}

func TestFileCache_TouchLRU_NoopWhenMetaMissing(t *testing.T) {
	// Simulates a cache entry written by an older binary with no .meta sidecar:
	// touchLRU's Chtimes call fails (no such file) and must not panic or error.
	c := newTestCache(t, 100, time.Hour)
	mustStore(t, c, "did:plc:nometa", "X")
	if err := os.Remove(c.metaPath("did:plc:nometa")); err != nil {
		t.Fatal(err)
	}
	got, err := c.Load("did:plc:nometa")
	if err != nil {
		t.Fatalf("load with missing sidecar should still succeed, got %v", err)
	}
	if got.MimeType != "image/png" {
		t.Errorf("mime = %q, want image/png fallback", got.MimeType)
	}
}

func TestFileCache_Store_RejectsEmptyDID(t *testing.T) {
	c := newTestCache(t, 100, time.Hour)
	if err := c.Store("", []byte("x"), "image/png"); err == nil {
		t.Fatal("expected an error for an empty did")
	}
}

func TestFileCache_Store_WriteMetaFailurePropagates(t *testing.T) {
	// Pre-create a directory where the .meta sidecar would be written, so the
	// png write (a differently-named temp+rename) succeeds but writeMeta's
	// os.WriteFile fails ("is a directory").
	c := newTestCache(t, 100, time.Hour)
	if err := os.MkdirAll(c.metaPath("did:plc:blocked"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := c.Store("did:plc:blocked", []byte("x"), "image/png"); err == nil {
		t.Fatal("expected Store to surface the writeMeta failure")
	}
}

func TestWriteFileAtomic_CreateTempFailure(t *testing.T) {
	// A destination directory that doesn't exist makes os.CreateTemp fail.
	dst := filepath.Join(t.TempDir(), "missing-dir", "out.png")
	if err := writeFileAtomic(dst, []byte("x"), 0o644); err == nil {
		t.Fatal("expected an error when the destination directory doesn't exist")
	}
}

func TestWriteFileAtomic_RenameFailure(t *testing.T) {
	// An existing non-empty directory at dst makes os.Rename fail — the temp
	// file must be cleaned up rather than left behind.
	dir := t.TempDir()
	dst := filepath.Join(dir, "target")
	if err := os.MkdirAll(dst, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dst, "occupied"), []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := writeFileAtomic(dst, []byte("x"), 0o644); err == nil {
		t.Fatal("expected an error when dst is a non-empty directory")
	}
	entries, _ := os.ReadDir(dir)
	for _, e := range entries {
		if strings.HasPrefix(e.Name(), ".tmp-") {
			t.Fatalf("temp file left behind after a failed rename: %s", e.Name())
		}
	}
}

func TestFileCache_ReadMeta_FallsBackToDefaultMime(t *testing.T) {
	c := newTestCache(t, 100, time.Hour)

	t.Run("missing sidecar", func(t *testing.T) {
		if got := c.readMeta("did:plc:missing"); got != "image/png" {
			t.Errorf("readMeta = %q, want image/png", got)
		}
	})

	t.Run("invalid JSON", func(t *testing.T) {
		if err := os.WriteFile(c.metaPath("did:plc:badjson"), []byte("not json"), 0o644); err != nil {
			t.Fatal(err)
		}
		if got := c.readMeta("did:plc:badjson"); got != "image/png" {
			t.Errorf("readMeta = %q, want image/png fallback for invalid JSON", got)
		}
	})

	t.Run("empty mimeType field", func(t *testing.T) {
		b, _ := json.Marshal(struct {
			MimeType string `json:"mimeType"`
		}{MimeType: ""})
		if err := os.WriteFile(c.metaPath("did:plc:emptymime"), b, 0o644); err != nil {
			t.Fatal(err)
		}
		if got := c.readMeta("did:plc:emptymime"); got != "image/png" {
			t.Errorf("readMeta = %q, want image/png fallback for empty mimeType", got)
		}
	})
}

func TestFileCache_WriteMeta_EmptyMimeTypeDefaultsToImagePNG(t *testing.T) {
	c := newTestCache(t, 100, time.Hour)
	if err := c.Store("did:plc:defaultmime", []byte("x"), ""); err != nil {
		t.Fatal(err)
	}
	got, err := c.Load("did:plc:defaultmime")
	if err != nil {
		t.Fatal(err)
	}
	if got.MimeType != "image/png" {
		t.Errorf("mime = %q, want image/png default", got.MimeType)
	}
}

func TestFileCache_SafePathFromBase(t *testing.T) {
	c := newTestCache(t, 100, time.Hour)
	cases := []struct {
		name string
		base string
		want string
	}{
		{"empty base", "", ""},
		{"root after clean", "/", ""},
		{"parent traversal collapses to root", "../../etc/passwd.png", "passwd.png"},
		{"missing extension is rejected", "did-plc-abc", ""},
		{"wrong extension is rejected", "did-plc-abc.jpg", ""},
		{"valid did-like filename", "did-plc-abc.png", "did-plc-abc.png"},
		{"colon-bearing DID is re-sanitized", "did:plc:abc.png", "did-plc-abc.png"},
		{"nested path collapses to basename", "sub/dir.png", "dir.png"},
		{"empty stem after SafeDID is rejected", ".png", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := c.SafePathFromBase(tc.base); got != tc.want {
				t.Errorf("SafePathFromBase(%q) = %q, want %q", tc.base, got, tc.want)
			}
		})
	}
}

func TestFileCache_LoadByPath_ExpiredIsCacheMiss(t *testing.T) {
	c := newTestCache(t, 100, time.Hour)
	mustStore(t, c, "did:plc:expired", "X")
	p := c.pngPath("did:plc:expired")
	past := time.Now().Add(-2 * time.Hour)
	if err := os.Chtimes(p, past, past); err != nil {
		t.Fatal(err)
	}
	if _, err := c.LoadByPath(p); err != ErrCacheMiss {
		t.Fatalf("want ErrCacheMiss for an expired entry, got %v", err)
	}
}

func TestFileCache_LoadByPath_ReadFileFailureIsCacheMiss(t *testing.T) {
	c := newTestCache(t, 100, time.Hour)
	dirAsPng := filepath.Join(c.dir, "not-a-file.png")
	if err := os.MkdirAll(dirAsPng, 0o755); err != nil {
		t.Fatal(err)
	}
	if _, err := c.LoadByPath(dirAsPng); err != ErrCacheMiss {
		t.Fatalf("want ErrCacheMiss when the path is a directory, got %v", err)
	}
}

func TestFileCache_EvictIfNeeded_ReadDirFailureIsNoop(t *testing.T) {
	c := newTestCache(t, 100, time.Hour)
	if err := os.RemoveAll(c.dir); err != nil {
		t.Fatal(err)
	}
	// Must not panic when the cache directory itself has been removed out from
	// under it.
	c.evictIfNeeded()
}

func TestFileCache_EvictIfNeeded_RemovesOrphanedMetaAndSkipsSubdirs(t *testing.T) {
	c := newTestCache(t, 100, time.Hour)
	mustStore(t, c, "did:plc:a", "A")

	// An orphaned .meta with no matching .png (e.g. a Store interrupted between
	// writing the sidecar and the image).
	orphan := filepath.Join(c.dir, "orphan.meta")
	if err := os.WriteFile(orphan, []byte(`{"mimeType":"image/png"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	// A stray subdirectory must be skipped, not treated as an entry.
	if err := os.MkdirAll(filepath.Join(c.dir, "stray-subdir"), 0o755); err != nil {
		t.Fatal(err)
	}

	// Store triggers evictIfNeeded.
	mustStore(t, c, "did:plc:b", "B")

	if _, err := os.Stat(orphan); !os.IsNotExist(err) {
		t.Errorf("orphaned .meta should have been removed, stat err = %v", err)
	}
	if _, err := os.Stat(filepath.Join(c.dir, "stray-subdir")); err != nil {
		t.Errorf("subdirectory should have been left alone: %v", err)
	}
}

func TestFileCache_EvictIfNeeded_FallsBackToPngModTimeWhenMetaMissing(t *testing.T) {
	// An entry missing its .meta sidecar (older binary, or manually removed)
	// must still participate in LRU ordering via its .png ModTime, rather than
	// being skipped or crashing eviction.
	c := newTestCache(t, 2, time.Hour)
	mustStore(t, c, "did:plc:a", "A")
	if err := os.Remove(c.metaPath("did:plc:a")); err != nil {
		t.Fatal(err)
	}
	// Backdate "a"'s .png so it is the oldest by the fallback clock.
	past := time.Now().Add(-time.Hour / 2)
	if err := os.Chtimes(c.pngPath("did:plc:a"), past, past); err != nil {
		t.Fatal(err)
	}
	mustStore(t, c, "did:plc:b", "B")
	// Exceeding capacity must evict "a" (oldest by png-modtime fallback).
	mustStore(t, c, "did:plc:c", "C")
	if _, err := c.Load("did:plc:a"); err != ErrCacheMiss {
		t.Fatalf("did:plc:a should have been evicted via the png-modtime fallback, got %v", err)
	}
}
