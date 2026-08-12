package shim

import (
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

// ErrCacheMiss is returned when an entry is absent or expired.
var ErrCacheMiss = errors.New("cache miss")

// DefaultCacheMaxEntries caps the on-disk cache when no override is supplied.
// ~10k profiles at ~350KB each is ~3.5GB worst case, which the Railway volume
// is sized for.
const DefaultCacheMaxEntries = 10000

// FileCache is a DID-keyed, file-backed, LRU-bounded TTL cache for generated OG
// images, persisted to a volume so it survives redeploys.
//
// The on-disk layout per entry is:
//
//	<dir>/<SafeDID>.png     # the image bytes
//	<dir>/<SafeDID>.meta    # {"mimeType": "..."} sidecar
//
// The two files carry two separate clocks, and keeping them separate is
// load-bearing — collapsing them either stops popular entries from ever
// expiring or evicts heavily-served ones as "least recently used":
//
//   - .png ModTime is TTL freshness, written only by Store, so a read never
//     extends an image's lifetime.
//   - .meta ModTime is LRU recency, touched by every Load/LoadByPath hit, so
//     eviction orders by access without masking TTL expiry.
//
// [TestFileCache_LoadDoesNotRefreshTTL], [TestFileCache_LoadByPathUpdatesLRURecency],
// and [TestFileCache_LoadByPathDoesNotRefreshTTL] pin all three directions.
type FileCache struct {
	dir        string
	MaxEntries int
	TTL        time.Duration

	mu sync.Mutex // guards the eviction bookkeeping
}

// NewFileCache opens (or creates) a file cache rooted at dir. Existing entries
// are visible immediately: Load scans the directory, so there is no in-memory
// index to rebuild. MaxEntries <= 0 falls back to the default.
func NewFileCache(dir string, maxEntries int, ttl time.Duration) (*FileCache, error) {
	if maxEntries <= 0 {
		maxEntries = DefaultCacheMaxEntries
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	return &FileCache{dir: dir, MaxEntries: maxEntries, TTL: ttl}, nil
}

func (c *FileCache) pngPath(did string) string {
	return filepath.Join(c.dir, SafeDID(did)+".png")
}

func (c *FileCache) metaPath(did string) string {
	return filepath.Join(c.dir, SafeDID(did)+".meta")
}

// Load returns the cached entry for did, or ErrCacheMiss if it is absent or
// past TTL. On a hit, the .meta sidecar's ModTime is touched (the LRU recency
// clock); the .png ModTime (the TTL freshness clock) is left untouched so the
// TTL is measured from generation time, not last access.
func (c *FileCache) Load(did string) (*CacheEntry, error) {
	mod, ok := c.freshModTime(did)
	if !ok {
		return nil, ErrCacheMiss
	}
	bytes, err := os.ReadFile(c.pngPath(did))
	if err != nil {
		return nil, ErrCacheMiss
	}
	mime := c.readMeta(did)
	// Update LRU recency without refreshing the TTL clock.
	c.touchLRU(did)
	return &CacheEntry{Bytes: bytes, ModTime: mod, MimeType: mime}, nil
}

// Fresh reports whether a live (within-TTL) entry exists for did without
// reading the image bytes. The generate path asks this on every crawl purely to
// decide whether to schedule a render, and reading a ~350KB PNG only to discard
// it would make the fast answer as expensive as the slow one. Like Load, a hit
// bumps LRU recency and leaves the TTL clock alone.
//
// [TestFileCache_FreshWithinTTL_ReportsTrue] and
// [TestFileCache_FreshPastTTL_ReportsFalse] pin that it agrees with Load on both
// sides of the TTL boundary; [TestFileCache_FreshDoesNotRefreshTTL] pins that
// probing does not extend an image's life.
func (c *FileCache) Fresh(did string) bool {
	if _, ok := c.freshModTime(did); !ok {
		return false
	}
	c.touchLRU(did)
	return true
}

// freshModTime is the one place the TTL clock is read: it returns the .png
// ModTime when a live entry exists for did, and reports false on an absent or
// expired one.
func (c *FileCache) freshModTime(did string) (time.Time, bool) {
	info, err := os.Stat(c.pngPath(did))
	if err != nil {
		return time.Time{}, false
	}
	if c.TTL > 0 && time.Since(info.ModTime()) >= c.TTL {
		return time.Time{}, false
	}
	return info.ModTime(), true
}

// touchLRU bumps the .meta sidecar's ModTime. It no-ops when no sidecar
// exists yet, which the eviction scan then treats as fresh-insert-recent.
func (c *FileCache) touchLRU(did string) {
	now := time.Now()
	if err := os.Chtimes(c.metaPath(did), now, now); err != nil {
		// LRU recency is a soft signal: falling back to the .png mtime for
		// eviction ordering never affects the correctness of a serve.
		return
	}
}

// Store writes the image and its mime type, then evicts down to MaxEntries.
// The image write is atomic, so a concurrent Store or a crash mid-write leaves
// readers on either the previous or the new complete entry, never a truncated
// one. The .meta sidecar is not atomic: readers default a torn or missing one
// to image/png, making it at worst a one-time mime fallback.
func (c *FileCache) Store(did string, bytes []byte, mimeType string) error {
	if did == "" {
		return errors.New("store: empty did")
	}
	finalPng := c.pngPath(did)
	if err := writeFileAtomic(finalPng, bytes, 0o644); err != nil {
		return err
	}
	if err := c.writeMeta(did, mimeType); err != nil {
		return err
	}
	c.evictIfNeeded()
	return nil
}

// writeFileAtomic writes to a temp file alongside dst and renames it into
// place, which is atomic on the same filesystem. On Windows the rename can fail
// while dst is open; the temp file is cleaned up on every error path.
func writeFileAtomic(dst string, data []byte, perm os.FileMode) error {
	dir := filepath.Dir(dst)
	tmp, err := os.CreateTemp(dir, ".tmp-og-*")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	cleanup := func() { _ = os.Remove(tmpName) }
	n, err := tmp.Write(data)
	if err == nil && n < len(data) {
		err = io.ErrShortWrite
	}
	if syncErr := tmp.Sync(); syncErr != nil && err == nil {
		err = syncErr
	}
	if closeErr := tmp.Close(); closeErr != nil && err == nil {
		err = closeErr
	}
	if err != nil {
		cleanup()
		return err
	}
	if err := os.Chmod(tmpName, perm); err != nil {
		cleanup()
		return err
	}
	if err := os.Rename(tmpName, dst); err != nil {
		cleanup()
		return err
	}
	return nil
}

func (c *FileCache) readMeta(did string) string {
	b, err := os.ReadFile(c.metaPath(did))
	if err != nil {
		return "image/png"
	}
	var m struct {
		MimeType string `json:"mimeType"`
	}
	if json.Unmarshal(b, &m) != nil {
		return "image/png"
	}
	if m.MimeType == "" {
		return "image/png"
	}
	return m.MimeType
}

func (c *FileCache) writeMeta(did, mimeType string) error {
	if mimeType == "" {
		mimeType = "image/png"
	}
	b, err := json.Marshal(struct {
		MimeType string `json:"mimeType"`
	}{MimeType: mimeType})
	if err != nil {
		return err
	}
	return os.WriteFile(c.metaPath(did), b, 0o644)
}

// Dir returns the cache root directory.
func (c *FileCache) Dir() string { return c.dir }

// SafePathFromBase sanitizes a request-supplied filename for cache serving. It
// strips any path components, enforces the .png suffix, and re-runs SafeDID on
// the stem so a crafted URL cannot traverse the cache dir. Returns "" if base
// is unacceptable.
func (c *FileCache) SafePathFromBase(base string) string {
	base = filepath.Clean("/" + base) // neutralize ../ and any leading slash
	base = filepath.Base(base)
	if base == "" || base == "." || base == "/" {
		return ""
	}
	if filepath.Ext(base) != ".png" {
		return ""
	}
	stem := strings.TrimSuffix(base, ".png")
	safe := SafeDID(stem) // re-sanitize the stem
	if safe == "" {
		return ""
	}
	return safe + ".png"
}

// LoadByPath loads an entry from an absolute image path, for the
// /og-cache/:did.png serving route. It does not key on the DID — SafeDID has
// already baked that into the path. A hit updates LRU recency, so image-serving
// traffic influences eviction ordering the same way the generate path does.
func (c *FileCache) LoadByPath(p string) (*CacheEntry, error) {
	info, err := os.Stat(p)
	if err != nil {
		return nil, ErrCacheMiss
	}
	if c.TTL > 0 && time.Since(info.ModTime()) >= c.TTL {
		return nil, ErrCacheMiss
	}
	bytes, err := os.ReadFile(p)
	if err != nil {
		return nil, ErrCacheMiss
	}
	base := strings.TrimSuffix(filepath.Base(p), ".png")
	metaPath := filepath.Join(c.dir, base+".meta")
	mime := "image/png"
	if b, err := os.ReadFile(metaPath); err == nil {
		var m struct {
			MimeType string `json:"mimeType"`
		}
		if json.Unmarshal(b, &m) == nil && m.MimeType != "" {
			mime = m.MimeType
		}
	}
	now := time.Now()
	_ = os.Chtimes(metaPath, now, now)
	return &CacheEntry{Bytes: bytes, ModTime: info.ModTime(), MimeType: mime}, nil
}

// evictIfNeeded removes least-recently-used entries while the count exceeds
// MaxEntries. An "entry" is a .png plus its sidecar. A missing .meta falls back
// to the .png ModTime, which makes the entry look older than it is but never
// evicts one that is genuinely hot.
func (c *FileCache) evictIfNeeded() {
	c.mu.Lock()
	defer c.mu.Unlock()

	type entry struct {
		name string
		mod  time.Time
	}
	entries, err := os.ReadDir(c.dir)
	if err != nil {
		return
	}
	// Orphaned sidecars (a .meta whose .png was deleted, e.g. a Store
	// interrupted mid-write) would otherwise accumulate indefinitely.
	metaMod := make(map[string]time.Time)
	pngStems := make(map[string]bool)
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		switch filepath.Ext(name) {
		case ".png":
			pngStems[strings.TrimSuffix(name, ".png")] = true
		case ".meta":
			if info, err := e.Info(); err == nil {
				metaMod[strings.TrimSuffix(name, ".meta")] = info.ModTime()
			}
		}
	}
	for stem := range metaMod {
		if !pngStems[stem] {
			_ = os.Remove(filepath.Join(c.dir, stem+".meta"))
		}
	}
	var pngs []entry
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if filepath.Ext(name) != ".png" {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		stem := strings.TrimSuffix(name, ".png")
		recency, ok := metaMod[stem]
		if !ok || recency.IsZero() {
			recency = info.ModTime()
		}
		pngs = append(pngs, entry{name: name, mod: recency})
	}
	if len(pngs) <= c.MaxEntries {
		return
	}
	// Oldest first.
	sort.Slice(pngs, func(i, j int) bool { return pngs[i].mod.Before(pngs[j].mod) })
	excess := len(pngs) - c.MaxEntries
	for i := 0; i < excess; i++ {
		base := strings.TrimSuffix(pngs[i].name, ".png")
		_ = os.Remove(filepath.Join(c.dir, pngs[i].name))
		_ = os.Remove(filepath.Join(c.dir, base+".meta"))
	}
}
