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

// ErrCacheMiss is returned by FileCache.Load when an entry is absent or expired.
// Callers treat it as "needs generation."
var ErrCacheMiss = errors.New("cache miss")

// DefaultCacheMaxEntries caps the on-disk cache size when no override is
// supplied. ~10k profiles at ~350KB each is ~3.5GB worst case — a generous
// ceiling that the Railway volume can be sized for. Eviction is LRU, so the
// working set of popular profiles stays resident.
const DefaultCacheMaxEntries = 10000

// FileCache is a DID-keyed, file-backed, LRU-bounded TTL cache for generated OG
// images. It persists to a volume (so the cache survives redeploys), evicts the
// least-recently-used entry when the count exceeds MaxEntries, and treats
// expired entries as misses (Load returns ErrCacheMiss).
//
// The on-disk layout per entry is:
//
//	<dir>/<SafeDID>.png     # the image bytes (ModTime = TTL freshness clock)
//	<dir>/<SafeDID>.meta    # {"mimeType": "..."} sidecar (ModTime = LRU recency)
//
// Two clocks are intentionally separated onto two files:
//
//   - .png ModTime is the TTL freshness clock. It is set ONLY when the image is
//     generated (Store). The TTL check compares now - .pngModTime against TTL,
//     so "image refreshes ~monthly" is honored regardless of how often the
//     entry is read.
//   - .meta ModTime is the LRU recency clock. Load/LoadByPath touch the .meta
//     file (not the .png) on every hit, so eviction orders by access recency
//     without masking TTL expiry.
//
// Keeping these on separate files is load-bearing: an earlier version touched
// the .png on every read, which (because TTL used .png ModTime) made popular
// entries effectively never expire and prevented banner/avatar edits from
// refreshing. LoadByPath previously touched neither file, so actual image
// traffic never updated LRU recency and heavily-served entries could be
// evicted as "least recently used." Both are fixed by splitting the clocks.
type FileCache struct {
	dir        string
	MaxEntries int
	TTL        time.Duration

	mu sync.Mutex // guards the eviction bookkeeping
}

// NewFileCache opens (or creates) a file cache rooted at dir. Existing entries
// are visible immediately — Load scans the directory at read time, so there is
// no in-memory index to rebuild. MaxEntries <= 0 falls back to the default.
func NewFileCache(dir string, maxEntries int, ttl time.Duration) (*FileCache, error) {
	if maxEntries <= 0 {
		maxEntries = DefaultCacheMaxEntries
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	return &FileCache{dir: dir, MaxEntries: maxEntries, TTL: ttl}, nil
}

// pngPath returns the image file path for a DID.
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
	p := c.pngPath(did)
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
	mime := c.readMeta(did)
	// Update LRU recency without refreshing the TTL clock.
	c.touchLRU(did)
	return &CacheEntry{Bytes: bytes, ModTime: info.ModTime(), MimeType: mime}, nil
}

// touchLRU bumps the .meta sidecar's ModTime (the LRU recency clock) for the
// given DID's entry. It is safe to call even when no .meta file exists yet —
// in that case it no-ops (the entry will be considered fresh-insert-recent on
// the next eviction scan, which is correct).
func (c *FileCache) touchLRU(did string) {
	now := time.Now()
	if err := os.Chtimes(c.metaPath(did), now, now); err != nil {
		// Sidecar may be absent on a cache populated by an older binary, or the
		// filesystem may reject the touch. Either way LRU recency is a soft
		// signal — falling back to the .png mtime for eviction ordering is
		// acceptable and never affects correctness of serve.
		return
	}
}

// Store writes the image and its mime type to the cache, then evicts if the
// entry count exceeds MaxEntries. The image is written atomically (temp file +
// rename on the same directory) so a concurrent Store for the same DID, or a
// crash mid-write, can never leave a truncated/half-written .png visible to a
// reader — readers either see the previous complete entry or the new complete
// entry. The .meta sidecar is written non-atomically; readers tolerate a
// missing/corrupt sidecar (defaulting to image/png), so a torn .meta is at
// worst a one-time mime fallback, never a corrupt serve.
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

// writeFileAtomic writes data to a temp file in the same directory as dst, then
// renames it into place. Rename on the same filesystem is atomic, so a
// concurrent reader never observes a partially-written dst. On Windows the
// rename may fail if dst already exists and is open; the temp file is cleaned
// up on any error path.
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

// LoadByPath loads an entry from an absolute image path (used by the
// /og-cache/:did.png serving route). Unlike Load, it does NOT key on the DID
// (the DID is already baked into the path via SafeDID). Returns ErrCacheMiss on
// any absence/expiry error. On a hit it updates the LRU recency clock (the
// .meta sidecar's ModTime) so actual image-serving traffic influences eviction
// ordering, matching the generate path's behavior.
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
	// Derive the sidecar filename from the PNG basename. The .meta uses the
	// same SafeDID-derived stem as the .png, so just swap the extension.
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
	// Update LRU recency so the serve path participates in eviction ordering.
	// The .png ModTime (TTL clock) is deliberately left untouched.
	now := time.Now()
	_ = os.Chtimes(metaPath, now, now)
	return &CacheEntry{Bytes: bytes, ModTime: info.ModTime(), MimeType: mime}, nil
}

// evictIfNeeded removes least-recently-used entries (both .png and .meta) while
// the entry count exceeds MaxEntries. An "entry" is a .png file; .meta sidecars
// are tracked alongside their image. LRU recency is the .meta sidecar's ModTime
// (the access clock); when a .meta is missing or unreadable, the .png's ModTime
// (the freshness clock) is used as a fallback — this over-approximates recency
// (the entry looks older than it really is on access) but never evicts a hot
// entry that was never accessed.
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
	// Pre-index .meta modtimes for LRU recency lookups, and opportunistically
	// collect orphaned sidecars (a .meta whose .png was deleted, e.g. a Store
	// interrupted between writing the .meta and the .png, or a manual .png
	// removal). Orphans would otherwise accumulate indefinitely.
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
		// Prefer the .meta recency clock; fall back to the .png freshness clock
		// if the sidecar is absent (older entry, or never read since a restart).
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
