package shim

import (
	"fmt"
	"math"
	"strings"
	"testing"
)

// The OG template's theme is enforced here rather than reviewed by eye. This is
// the Go counterpart of client/src/tests/theme/contrast.test.ts: the palette,
// the font-stack ordering, and the vertical layout budget are all rules that
// fail silently in a generated PNG — nobody sees the image until a crawler has
// already cached it — so each one gets a test on both sides of its boundary.

// wcagAA is the WCAG 2.1 AA contrast minimum for body text. Every text colour
// in the template clears it against every surface it can land on. Large text
// would be allowed 3.0, but the template has small text too (the @handle row),
// so the whole palette is held to the stricter number.
const wcagAA = 4.5

func TestOGPalette_EveryTextColourClearsAAOnEverySurface(t *testing.T) {
	for _, bg := range ogSurfaces {
		for _, fg := range ogTextColors {
			ratio := contrastRatio(t, fg, bg)
			if ratio < wcagAA {
				t.Errorf("%s on %s = %.2f:1, below WCAG AA (%.1f:1)", fg, bg, ratio, wcagAA)
			}
		}
	}
}

// The paired failing case: the contrast helper must actually reject something.
// Without this, a bug that returned a huge ratio for every input would leave the
// test above passing forever.
func TestContrastRatio_RejectsALowContrastPair(t *testing.T) {
	if got := contrastRatio(t, ogTextMuted, "#B9B2DD"); got >= wcagAA {
		t.Fatalf("muted text on a light lilac should fail AA, got %.2f:1", got)
	}
	// Known anchor: pure white on pure black is exactly 21:1.
	if got := contrastRatio(t, "#FFFFFF", "#000000"); math.Abs(got-21) > 0.01 {
		t.Fatalf("white on black = %.4f:1, want 21:1 — the luminance maths is wrong", got)
	}
}

// The muted colour is the one most likely to be nudged darker for taste, and it
// is the one carrying the @handle. Pin the surface it actually sits on.
func TestOGPalette_MutedHandleTextOnSurface(t *testing.T) {
	if got := contrastRatio(t, ogTextMuted, ogSurfaceTop); got < wcagAA {
		t.Fatalf("@handle (%s on %s) = %.2f:1, below AA", ogTextMuted, ogSurfaceTop, got)
	}
}

// The chip is the one place where accent text sits on something other than the
// page surface, so its own pair is asserted rather than assumed.
func TestOGPalette_ChipTextOnChipBackground(t *testing.T) {
	if got := contrastRatio(t, ogTextAccent, ogChipBG); got < wcagAA {
		t.Fatalf("chip label (%s on %s) = %.2f:1, below AA", ogTextAccent, ogChipBG, got)
	}
}

// TestOGTemplate_NoTextSitsOnTheBanner is the reachability argument behind the
// palette test: the contrast numbers above are only meaningful if every text
// node lands on one of ogSurfaces. A banner is an arbitrary user photo, so any
// text placed over it has unbounded contrast and nothing here could assert it.
// The banner element must therefore stay empty of content.
func TestOGTemplate_NoTextSitsOnTheBanner(t *testing.T) {
	html := BuildOGTemplate(OGInput{
		DisplayName: "Alice",
		Handle:      "alice.bsky.social",
		Banner:      "https://cdn.bsky.app/banner.jpg",
		Avatar:      "https://cdn.bsky.app/avatar.jpg",
		Prompt:      "Ask me anything",
	})
	banner := between(html, `<div class="banner">`, `</div>`)
	if strings.Contains(banner, "Alice") || strings.Contains(banner, "Ask me anything") {
		t.Fatalf("text inside the banner strip, where contrast cannot be guaranteed: %q", banner)
	}
	// Whatever the banner does contain must be the image and nothing else.
	if got := strings.TrimSpace(banner); got != `<img src="https://cdn.bsky.app/banner.jpg" alt="">` {
		t.Fatalf("banner strip should hold only the image, got %q", got)
	}
}

// ── Font stack ───────────────────────────────────────────────────────────────

// 'Noto Color Emoji' gives U+0020 a 1.25em advance. Anywhere but last in the
// stack it becomes the winning font for the space character whenever the
// webfonts ahead of it have not loaded, and every word gap in the rendered image
// blows out to ~4.5x. That is not hypothetical: it is what the previous template
// did, and it needs only a slow Google Fonts response to reproduce, because
// document.fonts.ready resolves on a *failed* font load too.
func TestOGFontStack_EmojiFamilyIsLast(t *testing.T) {
	families := splitFontStack(ogFontStack)
	last := families[len(families)-1]
	if !strings.Contains(last, "Noto Color Emoji") {
		t.Fatalf("emoji family must be last in the stack to keep it off the space glyph; last is %q\nstack: %s", last, ogFontStack)
	}
}

// The other side of that boundary: a real text family — not just the emoji font
// — has to sit ahead of the generic, or a container without the webfonts has
// nothing to fall back to but the emoji font.
func TestOGFontStack_HasALocalTextFallbackBeforeTheGeneric(t *testing.T) {
	families := splitFontStack(ogFontStack)
	genericAt := -1
	for i, f := range families {
		if f == "sans-serif" {
			genericAt = i
		}
	}
	if genericAt < 0 {
		t.Fatalf("stack has no generic sans-serif: %s", ogFontStack)
	}
	// Families that ship with the html-to-image container (ttf-freefont) or with
	// any ordinary Linux image, i.e. present without a network fetch.
	local := []string{"Liberation Sans", "DejaVu Sans"}
	for _, want := range local {
		found := false
		for _, f := range families[:genericAt] {
			if strings.Contains(f, want) {
				found = true
			}
		}
		if !found {
			t.Errorf("no offline fallback %q ahead of the generic in the stack: %s", want, ogFontStack)
		}
	}
}

func TestOGTemplate_RequestsInterToMatchTheApp(t *testing.T) {
	html := BuildOGTemplate(OGInput{Handle: "a.bsky.social"})
	// --nf-font-sans in client/src/index.css leads with Inter; the OG image is
	// the app's own surface and should not be set in a different face.
	if !strings.Contains(html, "family=Inter") {
		t.Fatalf("template does not load Inter, so it will not match the app's typography")
	}
	if !strings.HasPrefix(ogFontStack, "Inter,") {
		t.Fatalf("Inter must lead the stack, got %s", ogFontStack)
	}
}

// ── Geometry ─────────────────────────────────────────────────────────────────

// The canvas is a fixed 1200x630 with no scrollbar to reveal a mistake: if the
// bands do not add up, the prompt grows silently over the footer and the image
// still renders. This adds them up.
func TestOGGeometry_VerticalBandsFitTheCanvas(t *testing.T) {
	total := 0
	for _, b := range ogVerticalBands {
		total += b
	}
	if total > OGHeight {
		t.Fatalf("layout bands total %dpx, overflowing the %dpx canvas by %dpx: %v",
			total, OGHeight, total-OGHeight, ogVerticalBands)
	}
}

// The paired case on the other side of the boundary. A budget that always
// passed would be worthless, so confirm the sum is genuinely near the ceiling
// rather than trivially under it — the layout is meant to use the canvas.
func TestOGGeometry_BandsUseMostOfTheCanvas(t *testing.T) {
	total := 0
	for _, b := range ogVerticalBands {
		total += b
	}
	const leastUsed = OGHeight * 9 / 10
	if total < leastUsed {
		t.Fatalf("layout bands total only %dpx of %dpx; the card is mostly empty", total, OGHeight)
	}
}

// ProfileCard.styles.ts positions the avatar at `top: -AVATAR_SIZE / 2`, so it
// hangs exactly half over the banner. Matching that is what makes the OG card
// read as the same component.
func TestOGGeometry_AvatarHangsHalfOverTheBanner(t *testing.T) {
	if avatarOverlap != avatarSize/2 {
		t.Fatalf("avatar overhang is %dpx of a %dpx avatar; ProfileCard hangs it by exactly half",
			avatarOverlap, avatarSize)
	}
	// Half an avatar has to fit inside the banner, or it hangs off the top edge.
	if avatarOverlap > bannerHeight {
		t.Fatalf("avatar overhang %dpx exceeds the %dpx banner", avatarOverlap, bannerHeight)
	}
}

// The app's avatar is a rounded square, not a circle: Mantine's theme sets
// radius xl to 22px and ProfileCard renders an 84px Avatar with radius="xl".
// A 50% radius here would be the single most visible mismatch with the app.
func TestOGGeometry_AvatarIsARoundedSquareNotACircle(t *testing.T) {
	if avatarRadius >= avatarSize/2 {
		t.Fatalf("avatar radius %d on a %dpx avatar is a circle; the app uses a rounded square",
			avatarRadius, avatarSize)
	}
	if avatarRadius <= 0 {
		t.Fatalf("avatar radius %d has no rounding at all", avatarRadius)
	}
	// Same proportion as the app's 22px radius on an 84px avatar, within a pixel
	// of rounding.
	want := avatarSize * 22 / 84
	if avatarRadius != want {
		t.Fatalf("avatar radius %d does not keep the app's 22/84 proportion (want %d)", avatarRadius, want)
	}
	css := between(BuildOGTemplate(OGInput{Handle: "a.bsky.social"}), "<style>", "</style>")
	if rule := between(css, ".avatar {", "}"); strings.Contains(rule, "border-radius: 50%") {
		t.Fatalf(".avatar is rendered as a circle:\n%s", rule)
	}
}

// "no blur or anything": the banner ends in a hard cut, and its scrim is the
// app's flat darken rather than a fade into the surface. A gradient here reads
// as a blur over the user's photo.
func TestOGTemplate_BannerHasNoFadeOrBlur(t *testing.T) {
	css := between(BuildOGTemplate(OGInput{
		Handle: "a.bsky.social",
		Banner: "https://cdn.bsky.app/b.jpg",
	}), "<style>", "</style>")
	scrim := between(css, ".banner::after {", "}")
	if strings.Contains(scrim, "gradient") {
		t.Errorf(".banner::after fades into the surface; the banner should end in a hard cut\n%s", scrim)
	}
	if !strings.Contains(scrim, ogBannerScrim) {
		t.Errorf(".banner::after should carry ProfileCard's flat scrim %q\n%s", ogBannerScrim, scrim)
	}
	// Scanned across every .banner rule — the element, its image, and the scrim.
	// An earlier version of this test only looked at .banner and .banner::after,
	// and a `filter: blur()` on `.banner img` sailed straight past it.
	for _, selector := range bannerSelectors(css) {
		rule := between(css, selector+" {", "}")
		for _, banned := range []string{"blur", "filter", "backdrop"} {
			if strings.Contains(rule, banned) {
				t.Errorf("%s uses %q; the banner photo must render sharp\n%s", selector, banned, rule)
			}
		}
	}
}

// bannerSelectors returns every rule head in css that styles the banner, so a
// blur added to a new sub-element is caught rather than missed.
func bannerSelectors(css string) []string {
	var out []string
	for _, line := range strings.Split(css, "\n") {
		head, _, ok := strings.Cut(strings.TrimSpace(line), " {")
		if ok && strings.HasPrefix(head, ".banner") {
			out = append(out, head)
		}
	}
	return out
}

func TestOGTemplate_PromptIsClampedNotAllowedToGrow(t *testing.T) {
	html := BuildOGTemplate(OGInput{
		Handle: "a.bsky.social",
		Prompt: strings.Repeat("a very long prompt that will not fit ", 20),
	})
	css := between(html, "<style>", "</style>")
	rule := between(css, ".prompt {", "}")
	for _, want := range []string{"-webkit-line-clamp", "max-height", "overflow: hidden"} {
		if !strings.Contains(rule, want) {
			t.Errorf(".prompt rule lacks %q, so a long prompt can overrun the footer\n%s", want, rule)
		}
	}
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// contrastRatio implements the WCAG 2.1 relative-luminance formula for two
// #rrggbb colours. Mirrors the client contrast test's maths so the two suites
// cannot disagree about what AA means.
func contrastRatio(t *testing.T, fg, bg string) float64 {
	t.Helper()
	l1, l2 := relativeLuminance(t, fg), relativeLuminance(t, bg)
	if l1 < l2 {
		l1, l2 = l2, l1
	}
	return (l1 + 0.05) / (l2 + 0.05)
}

func relativeLuminance(t *testing.T, hex string) float64 {
	t.Helper()
	var r, g, b int
	if _, err := fmt.Sscanf(strings.TrimPrefix(hex, "#"), "%02x%02x%02x", &r, &g, &b); err != nil {
		t.Fatalf("colour %q is not #rrggbb: %v", hex, err)
	}
	channel := func(v int) float64 {
		c := float64(v) / 255
		if c <= 0.04045 {
			return c / 12.92
		}
		return math.Pow((c+0.055)/1.055, 2.4)
	}
	return 0.2126*channel(r) + 0.7152*channel(g) + 0.0722*channel(b)
}

func splitFontStack(stack string) []string {
	parts := strings.Split(stack, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		out = append(out, strings.Trim(strings.TrimSpace(p), "'\""))
	}
	return out
}

// between returns the text between the first open and the following close, or
// "" if either is absent.
func between(s, open, close string) string {
	i := strings.Index(s, open)
	if i < 0 {
		return ""
	}
	rest := s[i+len(open):]
	j := strings.Index(rest, close)
	if j < 0 {
		return ""
	}
	return rest[:j]
}
