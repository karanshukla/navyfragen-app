// Package shim holds the opengraph-service's testable logic: UA detection,
// the profile-path classifier, and the TTL cache. The OG composite template
// builder lives in template.go. The HTTP wiring lives in cmd/shim/main.go;
// these pieces are pure so they can be unit-tested without a network.
package shim

import (
	"strings"
	"time"
)

// CardybUA is the Bluesky link-preview crawler's user agent. Only this UA on
// the /profile/:handle route triggers image generation; everything else is a
// pass-through. Mirrors anubis/botPolicy.json's allowlist entry.
const CardybUA = "Bluesky Cardyb"

// Decision classifies a request for the hot path.
type Decision int

const (
	DecisionProxy    Decision = iota // pass through to the client unchanged
	DecisionGenerate                 // synthesize a per-profile OG response
)

// Classify determines whether a request should be proxied or generate an OG
// image. Generation fires only when BOTH the UA is the Bluesky Cardyb crawler
// AND the path is /profile/:handle. Every other combination proxies — this is
// the acceptance criterion that ordinary /* traffic is unaffected.
func Classify(userAgent, path string) Decision {
	if !isCardyb(userAgent) {
		return DecisionProxy
	}
	if !isProfilePath(path) {
		return DecisionProxy
	}
	return DecisionGenerate
}

// ProfilePathPrefix is the client route a link preview points at, and the only
// route the Cardyb UA triggers generation on.
const ProfilePathPrefix = "/profile/"

// ProfileHandle extracts the :handle from a /profile/:handle path, or "" if
// the path does not match.
func ProfileHandle(path string) string { return handleAfterPrefix(path, ProfilePathPrefix) }

// WarmHandle extracts the :handle from an /og-warm/:handle path, or "" if the
// path does not match — the warm route's counterpart to ProfileHandle.
func WarmHandle(path string) string { return handleAfterPrefix(path, WarmPathPrefix) }

// handleAfterPrefix returns the single path segment following prefix, or "" if
// there is not exactly one. It deliberately ignores query strings and trailing
// slashes so /profile/foo/ and /profile/foo?bar=baz both resolve to "foo".
func handleAfterPrefix(path, prefix string) string {
	if !strings.HasPrefix(path, prefix) {
		return ""
	}
	rest := strings.TrimPrefix(path, prefix)
	if rest == "" {
		return ""
	}
	if i := strings.IndexByte(rest, '?'); i >= 0 {
		rest = rest[:i]
	}
	rest = strings.TrimSuffix(rest, "/")
	if rest == "" {
		return ""
	}
	// A path like /profile/a/b is not a single handle.
	if strings.Contains(rest, "/") {
		return ""
	}
	return rest
}

func isCardyb(userAgent string) bool {
	return strings.Contains(userAgent, CardybUA)
}

func isProfilePath(path string) bool {
	return ProfileHandle(path) != ""
}

// CacheEntry is a stored generated image and its metadata.
type CacheEntry struct {
	Bytes    []byte
	ModTime  time.Time
	MimeType string
}

// IsFresh reports whether the entry is within ttl of now. A missing entry
// (ModTime zero) is never fresh.
func (e *CacheEntry) IsFresh(now time.Time, ttl time.Duration) bool {
	if e == nil || e.ModTime.IsZero() {
		return false
	}
	return now.Sub(e.ModTime) < ttl
}

// ParseTTL turns a string like "720h" into a Duration, falling back to the
// default (~1 month) on any parse error.
func ParseTTL(s string, fallback time.Duration) time.Duration {
	if s == "" {
		return fallback
	}
	d, err := time.ParseDuration(s)
	if err != nil || d <= 0 {
		return fallback
	}
	return d
}
