package shim

import (
	"strings"
	"testing"
	"unicode/utf8"
)

// Edge-case coverage for BuildOGTemplate (reexamine gaps 5 and 6):
//   - Very long display names / handles (truncation behavior — must not overflow
//     the 1200×630 canvas).
//   - Non-Latin display names (Cyrillic, CJK, emoji, RTL scripts) — confirm the
//     template's Noto font stack is present and the first-rune glyph fallback
//     works for non-ASCII.
//
// These are unit tests against BuildOGTemplate's HTML output. They can't assert
// pixel-level rendering (that's html-to-image's job and is e2e-only), but they
// CAN assert: the CSS rules that bound text overflow are present; the font
// stacks that cover non-Latin scripts are emitted; the glyph fallback is
// rune-aware (not byte-aware); and very long strings are carried without
// breaking the HTML structure.

// --- Very long display names / handles (reexamine gap 5) ---

// longName is a display name far longer than the 1200px canvas can fit at 56px.
// At 56px font-size, the canvas fits roughly 20-25 Latin characters in the
// meta row's available width (1088px - avatar 132px - gaps). Anything over ~40
// chars is guaranteed overflow territory.
const longName = "This Is A Really Exceptionally Long Display Name That Will Definitely Overflow The 1200 Pixel Wide Canvas Without Truncation Rules In Place And Keeps Going And Going"

// longHandle mirrors the same risk for the @handle row.
const longHandle = "a-very-long-handle-with-many-segments-that-exceeds-the-canvas-width.bsky.social"

// TestBuildOGTemplate_LongDisplayName_HasTruncationCSS asserts the template
// emits CSS that bounds the display-name element so it cannot overflow the
// canvas. The reexamine flagged this as untested; the dev asked for coverage.
// This test is RED until the template's .name rule includes a max-width /
// overflow / text-overflow directive.
func TestBuildOGTemplate_LongDisplayName_HasTruncationCSS(t *testing.T) {
	html := BuildOGTemplate(OGInput{
		DisplayName: longName,
		Handle:      "ok.bsky.social",
		Avatar:      "https://cdn.bsky.app/a.jpg",
		Prompt:      "p",
	})
	// The full name must still appear in the HTML (we don't truncate the source
	// string — truncation is a render-time CSS concern, so crawlers and the
	// accessible DOM still see the full name). What we assert is that the CSS
	// bounds the rendered width.
	if !strings.Contains(html, longName) {
		t.Fatalf("full display name should be present in HTML (CSS truncates, not the source)")
	}
	// The .name rule must include overflow control. We look for the combination
	// of properties that make CSS ellipsis truncation work. At minimum: a
	// max-width (or width) constraint AND overflow:hidden AND text-overflow.
	if !hasTruncationCSS(t, html, ".name") {
		t.Fatalf("template .name rule lacks truncation CSS; long display names will overflow the canvas\n--- CSS excerpt ---\n%s",
			extractCSS(html))
	}
}

// TestBuildOGTemplate_LongHandle_HasTruncationCSS is the same property for the
// @handle row. Handles can be long (multi-segment .sky.social subdomains) and
// overflow the meta column just like display names.
func TestBuildOGTemplate_LongHandle_HasTruncationCSS(t *testing.T) {
	html := BuildOGTemplate(OGInput{
		DisplayName: "Ok",
		Handle:      longHandle,
		Avatar:      "https://cdn.bsky.app/a.jpg",
		Prompt:      "p",
	})
	if !strings.Contains(html, longHandle) {
		t.Fatalf("full handle should be present in HTML")
	}
	if !hasTruncationCSS(t, html, ".handle") {
		t.Fatalf("template .handle rule lacks truncation CSS; long handles will overflow\n--- CSS excerpt ---\n%s",
			extractCSS(html))
	}
}

// TestBuildOGTemplate_LongNamesDoNotBreakHTMLStructure verifies that even an
// adversarially long name (no spaces — can't wrap) produces well-formed HTML:
// the doctype, closing tags, and OG dimensions are all intact. A buggy template
// (e.g. an unterminated fmt verb) would fail this.
func TestBuildOGTemplate_LongNamesDoNotBreakHTMLStructure(t *testing.T) {
	noSpaces := strings.Repeat("W", 500)
	html := BuildOGTemplate(OGInput{
		DisplayName: noSpaces,
		Handle:      strings.Repeat("h", 300),
		Prompt:      "p",
	})
	for _, want := range []string{"<!DOCTYPE html>", "</html>", "1200", "630"} {
		if !strings.Contains(html, want) {
			t.Fatalf("long-name HTML missing %q\n--- html tail ---\n%s", want, tail(html, 200))
		}
	}
}

// --- Non-Latin display names (reexamine gap 6) ---

// TestBuildOGTemplate_NotoFontStacksPresent asserts the template loads the Noto
// font stacks that cover Cyrillic, CJK, Arabic, Hebrew, Devanagari, Thai, and
// emoji. The reexamine noted font coverage "relies on html-to-image's font
// loading" — but the template itself must REQUEST those stacks; if a future
// edit drops them, non-Latin names silently tofu. This test pins the
// requirement at the template level.
func TestBuildOGTemplate_NotoFontStacksPresent(t *testing.T) {
	html := BuildOGTemplate(OGInput{
		DisplayName: "Test",
		Handle:      "test.bsky.social",
		Prompt:      "p",
	})
	// Every Noto family the template declares. If any is dropped, a script
	// family loses coverage.
	for _, want := range []string{
		"Noto Sans",
		"Noto Sans JP", // Japanese
		"Noto Sans KR", // Korean
		"Noto Sans SC", // Simplified Chinese
		"Noto Sans TC", // Traditional Chinese
		"Noto Sans Arabic",
		"Noto Sans Devanagari",
		"Noto Sans Hebrew",
		"Noto Sans Thai",
		"Noto Color Emoji",
	} {
		if !strings.Contains(html, want) {
			t.Fatalf("template missing font %q — non-Latin coverage lost\n--- font line ---\n%s",
				want, extractFontLine(html))
		}
	}
}

// TestBuildOGTemplate_NonLatinDisplayName_PreservedAndGlyphWorks is a table
// test covering the script families the reexamine flagged. For each:
//   - The full display name survives in the HTML (HTML-escaped but not
//     mangled) — crawlers see the correct name.
//   - When avatar is unset, the first-rune glyph fallback extracts the correct
//     first character (rune-aware, not byte-aware — critical for multibyte).
func TestBuildOGTemplate_NonLatinDisplayName_PreservedAndGlyphWorks(t *testing.T) {
	cases := []struct {
		name      string
		display   string
		wantFirst string // expected first-rune glyph (uppercased where sensible)
	}{
		{"Cyrillic", "Привет Мир", "П"},
		{"Japanese", "こんにちは", "こ"},
		{"ChineseSimplified", "你好世界", "你"},
		{"Korean", "안녕하세요", "안"},
		{"Arabic", "مرحبا بالعالم", "م"},
		{"Hebrew", "שלום עולם", "ש"},
		{"Devanagari", "नमस्ते दुनिया", "न"},
		{"Thai", "สวัสดีชาวโลก", "ส"},
		{"Emoji", "👋🌍 Hello", "👋"},
		{"MixedLatinEmoji", "Alice 🚀", "A"},
		{"RTL Arabic long", "محمد عبد الله الراشد", "م"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			// With avatar set: full name must be present verbatim.
			withAvatar := BuildOGTemplate(OGInput{
				DisplayName: tc.display,
				Handle:      "test.bsky.social",
				Avatar:      "https://cdn.bsky.app/a.jpg",
				Prompt:      "p",
			})
			if !strings.Contains(withAvatar, tc.display) {
				t.Fatalf("display name %q not preserved verbatim in HTML", tc.display)
			}

			// With avatar UNSET: the glyph fallback must be the first rune,
			// uppercased. firstGlyph is rune-aware so multibyte leads survive.
			noAvatar := BuildOGTemplate(OGInput{
				DisplayName: tc.display,
				Handle:      "test.bsky.social",
				Avatar:      "",
				Prompt:      "p",
			})
			if !strings.Contains(noAvatar, tc.wantFirst) {
				t.Fatalf("glyph fallback: want first rune %q in output, missing\n--- avatar element ---\n%s",
					tc.wantFirst, extractAvatarEl(noAvatar))
			}
		})
	}
}

// TestFirstGlyph_RuneAwareNotByteAware directly pins the rune-awareness of the
// glyph fallback. A byte-based implementation would emit the first byte of a
// multibyte UTF-8 sequence (garbage); the rune-based implementation emits the
// full first character.
func TestFirstGlyph_RuneAwareNotByteAware(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"Alice", "A"},
		{"alice", "A"}, // uppercased
		{"", ""},       // empty safe
		{"  spaceman", "S"},
		{"こんにちは", "こ"},
		{"👋hi", "👋"},
		{"Привет", "П"},
		{"مرحبا", "م"},
	}
	for _, tc := range cases {
		t.Run(tc.in, func(t *testing.T) {
			got := firstGlyph(tc.in)
			if got != tc.want {
				t.Fatalf("firstGlyph(%q) = %q, want %q", tc.in, got, tc.want)
			}
			// The result must be valid UTF-8 (a byte-based impl would produce
			// an invalid prefix of a multibyte sequence).
			if !utf8.ValidString(got) {
				t.Fatalf("firstGlyph(%q) = %q is not valid UTF-8", tc.in, got)
			}
		})
	}
}

// TestFirstGlyph_EmptyAfterTrim confirms the empty-name path: when the display
// name is empty/whitespace, firstGlyph returns "" and buildAvatarElement falls
// through to the handle. This is the defensive contract the template relies on.
func TestFirstGlyph_EmptyReturnsEmpty(t *testing.T) {
	for _, in := range []string{"", "   ", "\t\n"} {
		if got := firstGlyph(in); got != "" {
			t.Fatalf("firstGlyph(%q) = %q, want empty", in, got)
		}
	}
}

// --- RTL safety: an RTL display name must not break the LTR template structure ---

func TestBuildOGTemplate_RTLDisplayName_StructureIntact(t *testing.T) {
	html := BuildOGTemplate(OGInput{
		DisplayName: "محمد والعائلة",
		Handle:      "mohamed.bsky.social",
		Avatar:      "https://cdn.bsky.app/a.jpg",
		Prompt:      "p",
	})
	// The HTML scaffolding must remain intact — an RTL string must not escape
	// its containing element or break the doctype/structure.
	for _, want := range []string{"<!DOCTYPE html>", "</html>", "<body>", "</body>"} {
		if !strings.Contains(html, want) {
			t.Fatalf("RTL name broke HTML structure; missing %q", want)
		}
	}
	// The name should be HTML-escaped but the Arabic characters pass through
	// unchanged (html.EscapeString does not touch non-ASCII letters).
	if !strings.Contains(html, "محمد والعائلة") {
		t.Fatalf("RTL display name not preserved in HTML")
	}
}

// --- helpers ---

// hasTruncationCSS reports whether the CSS rule for selector (e.g. ".name")
// contains the overflow-control trio: a width bound, overflow:hidden, and
// text-overflow. It does a coarse scan of the <style> block — this is a test
// helper, not a real CSS parser.
func hasTruncationCSS(t *testing.T, html, selector string) bool {
	t.Helper()
	css := extractCSS(html)
	// Find the rule block for the selector.
	idx := strings.Index(css, selector)
	if idx < 0 {
		return false
	}
	// Take the rule body: from the first { after the selector to the next }.
	braceStart := strings.IndexByte(css[idx:], '{')
	if braceStart < 0 {
		return false
	}
	rule := css[idx+braceStart:]
	braceEnd := strings.IndexByte(rule, '}')
	if braceEnd < 0 {
		rule = rule[braceStart:]
	} else {
		rule = rule[:braceEnd]
	}
	hasWidth := strings.Contains(rule, "max-width") || strings.Contains(rule, "width")
	hasOverflow := strings.Contains(rule, "overflow:") || strings.Contains(rule, "overflow-hidden")
	hasEllipsis := strings.Contains(rule, "text-overflow") || strings.Contains(rule, "ellipsis")
	return hasWidth && hasOverflow && hasEllipsis
}

func extractCSS(html string) string {
	start := strings.Index(html, "<style>")
	end := strings.Index(html, "</style>")
	if start < 0 || end < 0 || end < start {
		return ""
	}
	return html[start:end]
}

func extractFontLine(html string) string {
	for _, line := range strings.Split(html, "\n") {
		if strings.Contains(line, "font-family") {
			return line
		}
	}
	return ""
}

func extractAvatarEl(html string) string {
	start := strings.Index(html, `<div class="avatar">`)
	if start < 0 {
		start = strings.Index(html, `<img class="avatar"`)
	}
	if start < 0 {
		return ""
	}
	rest := html[start:]
	end := strings.Index(rest, "</div>")
	if end < 0 {
		end = strings.Index(rest, "/>")
	}
	if end < 0 {
		return rest
	}
	return rest[:end]
}

func tail(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[len(s)-n:]
}
