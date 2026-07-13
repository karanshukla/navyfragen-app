// Package shim holds the opengraph-service's testable logic: UA detection,
// the profile-path classifier, the TTL cache, and the OG composite template
// builder. The HTTP wiring lives in cmd/shim/main.go; these pieces are pure so
// they can be unit-tested without a network.
package shim

import (
	"fmt"
	"html"
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

// ProfileHandle extracts the :handle from a /profile/:handle path, or "" if
// the path does not match. It deliberately ignores query strings and trailing
// slashes so /profile/foo/ and /profile/foo?bar=baz both resolve to "foo".
func ProfileHandle(path string) string {
	const prefix = "/profile/"
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
// default on any parse error. The default (~1 month) is the staleness
// tradeoff the issue accepts.
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

// --- OG composite template ---

// Brand gradient per CLAUDE.md design tokens (--nf-grad-dark — reserved for
// image-export/OG preview surfaces, not live UI). Matches the "default" theme
// gradient in server/src/lib/image-generator.ts exactly. Used as the
// fallback background when a profile has no banner, and as the accent strip.
const brandGradient = "linear-gradient(135deg, #1E1B4B 0%, #3B2E78 50%, #6B3FD4 100%)"

const (
	brandOnDark   = "rgba(255, 255, 255, 0.90)" // primary text on dark bg
	brandOnDarkMu = "rgba(255, 255, 255, 0.62)" // muted text on dark bg
)

// Noto font stacks covering Latin, CJK, Arabic, Hebrew, Devanagari, Thai, and
// emoji. Mirrors server/src/lib/image-generator.ts so OG previews match the
// app's typography.
const notoStack = `'Noto Sans', 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans SC', 'Noto Sans TC', 'Noto Sans Arabic', 'Noto Sans Devanagari', 'Noto Sans Hebrew', 'Noto Sans Thai', 'Noto Color Emoji', sans-serif`

// notoLink is the Google Fonts stylesheet that actually loads the Noto stacks.
// Without it html-to-image renders with generic fallback fonts, which looks
// inconsistent with the app. Mirrors image-generator.ts's NOTO_LINK.
const notoLink = `<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&family=Noto+Sans+JP:wght@400;700&family=Noto+Sans+KR:wght@400;700&family=Noto+Sans+SC:wght@400;700&family=Noto+Sans+TC:wght@400;700&family=Noto+Sans+Arabic:wght@400;700&family=Noto+Sans+Devanagari:wght@400;700&family=Noto+Sans+Hebrew:wght@400;700&family=Noto+Sans+Thai:wght@400;700&family=Noto+Color+Emoji&display=swap" rel="stylesheet">`

// OGWidth/OGHeight are the standard Open Graph image dimensions.
const (
	OGWidth  = 1200
	OGHeight = 630
)

// OGInput is the data the composite template renders.
type OGInput struct {
	DisplayName string
	Handle      string
	Banner      string // empty → brand gradient fallback
	Avatar      string // empty → glyph fallback
	Prompt      string // empty → default prompt
}

// DefaultPrompt is used when no per-user prompt is wired in yet (issue #199
// is the followup that supplies a custom prompt).
const DefaultPrompt = "Ask me anything anonymously on Navyfragen"

// BuildOGTemplate renders an OG-sized (1200x630) HTML page: banner (or brand
// gradient) as background, avatar (or initial glyph) overlaid, prompt text.
// All user-supplied strings are HTML-escaped — the rendered HTML is fed to a
// headless browser, so an unescaped payload would be a code-injection vector.
//
// Visual language mirrors server/src/lib/image-generator.ts: Noto stacks
// actually loaded via Google Fonts, the brand purple gradient, a dark scrim
// for text legibility over any banner, and a navyfragen.app wordmark footer.
func BuildOGTemplate(in OGInput) string {
	bg := brandGradient
	if in.Banner != "" {
		bg = fmt.Sprintf("url(%q)", in.Banner)
	}

	avatarEl := buildAvatarElement(in.Avatar, in.DisplayName, in.Handle)

	prompt := in.Prompt
	if strings.TrimSpace(prompt) == "" {
		prompt = DefaultPrompt
	}

	name := strings.TrimSpace(in.DisplayName)
	if name == "" {
		name = in.Handle
	}

	const tmpl = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
%s
<style>
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; overflow: hidden; }
  body {
    font-family: %s;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    font-synthesis: none;
    background: %s;
    background-size: cover;
    background-position: center;
    position: relative;
    color: #fff;
  }
  /* Dark scrim: makes white text legible over any banner image, and tints the
     brand-gradient fallback so it reads as the app's default theme. */
  .scrim {
    position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(0,0,0,0.10) 0%%, rgba(30,27,75,0.35) 45%%, rgba(30,27,75,0.82) 100%%);
  }
  .prompt {
    position: absolute; left: 56px; top: 56px; z-index: 1;
    font-size: 56px; font-weight: 700; line-height: 1.2;
    max-width: 1088px;
    text-shadow: 0 3px 16px rgba(0,0,0,0.65);
    letter-spacing: 0.2px;
  }
  .card {
    position: absolute; left: 56px; bottom: 96px; z-index: 1;
    display: flex; align-items: center; gap: 28px;
  }
  .avatar {
    width: 132px; height: 132px; border-radius: 50%%; object-fit: cover;
    border: 4px solid rgba(255,255,255,0.92);
    box-shadow: 0 8px 28px rgba(0,0,0,0.45);
    background: %s;
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 64px; font-weight: 700;
    flex-shrink: 0;
  }
  .meta { display: flex; flex-direction: column; gap: 6px; overflow: hidden; }
  .name {
    font-size: 56px; font-weight: 700; line-height: 1.1;
    text-shadow: 0 2px 14px rgba(0,0,0,0.6);
    max-width: 900px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  }
  .handle {
    font-size: 30px; font-weight: 400; line-height: 1.2;
    color: %s; text-shadow: 0 2px 10px rgba(0,0,0,0.6);
    max-width: 900px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  }
  .footer {
    position: absolute; right: 56px; bottom: 56px; z-index: 1;
    font-size: 22px; font-weight: 600; letter-spacing: 0.5px;
    color: %s;
    text-shadow: 0 2px 10px rgba(0,0,0,0.6);
  }
</style>
</head>
<body>
  <div class="scrim"></div>
  <div class="prompt">%s</div>
  <div class="card">
    %s
    <div class="meta">
      <div class="name">%s</div>
      <div class="handle">@%s</div>
    </div>
  </div>
  <div class="footer">navyfragen.app</div>
</body>
</html>`

	return fmt.Sprintf(tmpl,
		notoLink,
		notoStack,
		bg,
		brandGradient,
		brandOnDark,
		brandOnDarkMu,
		html.EscapeString(prompt),
		avatarEl,
		html.EscapeString(name),
		html.EscapeString(strings.TrimPrefix(in.Handle, "@")),
	)
}

// buildAvatarElement returns the avatar HTML element. When avatarURL is empty,
// a circular brand-gradient tile (styled by .avatar's CSS) with the first
// letter of the display name (or handle) as a glyph is emitted instead.
func buildAvatarElement(avatarURL, displayName, handle string) string {
	if avatarURL != "" {
		return fmt.Sprintf(`<img class="avatar" src=%q alt="">`, avatarURL)
	}
	glyph := firstGlyph(displayName)
	if glyph == "" {
		glyph = firstGlyph(handle)
	}
	return fmt.Sprintf(`<div class="avatar">%s</div>`, html.EscapeString(glyph))
}

// firstGlyph returns the first meaningful character of s (rune-aware), uppercased.
func firstGlyph(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	r := []rune(s)
	if len(r) == 0 {
		return ""
	}
	return strings.ToUpper(string(r[0]))
}
