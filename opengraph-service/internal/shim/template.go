package shim

import (
	"fmt"
	"html"
	"math"
	"strconv"
	"strings"
)

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
	Prompt      string // owner's customPrompt; empty → resolvePrompt's locale/English default
	Locale      string // owner's touchpointLocale; empty → English default
}

// DefaultPrompt is the last-resort fallback: no customPrompt, no recognized
// touchpointLocale, or the NF settings read failed outright. It is
// deliberately short: Bluesky renders a link card at roughly 500px wide, so the
// headline is downscaled ~2.4x and every extra word costs legibility. The
// brand name is carried by the wordmark lockup rather than repeated here.
const DefaultPrompt = "Ask me anything, anonymously"

// touchpointPrompts is the localized default headline, one entry per locale in
// client/src/lib/touchpointTranslations.ts's touchpointLocales.
//
// Deliberately NOT reused from touchpointTranslations.ts: every field there
// that plays this role (`headline`) takes a display-name argument, and this
// key can't — it's a plain map[string]string, and the prompt line is
// name-free by design (the name already renders in the identity block above
// it, the same shape DefaultPrompt itself has). `placeholder` was tried as a
// substitute in an earlier pass and rejected: it drops "anonymously" entirely
// (e.g. es "Pregunta algo…" = "Ask something…"), and anonymity is the
// product's entire value proposition — the OG card is the first thing a
// stranger sees on Bluesky, so losing that word isn't a tone mismatch, it's
// the pitch going missing. These four are therefore fresh headline
// translations of DefaultPrompt itself, each keeping the "anonymously"
// adverb, sized to stay legible at the card's ~2.4x downscale (DefaultPrompt's
// own doc comment explains why), and free of `placeholder`'s trailing
// ellipsis, which reads as truncation at headline size.
//
// "en" is DefaultPrompt itself, so resolvePrompt's locale lookup and its final
// English fallback agree by construction.
//
// [TestResolvePrompt_LocalizedDefault_UsesCatalogWhenNoCustomPrompt] and
// [TestResolvePrompt_UnrecognizedLocale_FallsBackToEnglish] pin the lookup;
// [TestTouchpointPrompts_CoversEveryTouchpointLocale] pins that this map never
// drifts out of sync with the TS locale list.
var touchpointPrompts = map[string]string{
	"en": DefaultPrompt,                    // "Ask me anything, anonymously" (28 chars)
	"es": "Pregúntame algo, anónimamente",  // "Ask me something, anonymously" (29 chars)
	"pt": "Pergunte-me algo, anonimamente", // "Ask me something, anonymously" (30 chars)
	"de": "Frag mich alles, anonym",        // "Ask me everything, anonymous(ly)" (23 chars)
	"fr": "Demande-moi tout, anonymement",  // "Ask me everything, anonymously" (29 chars)
}

// resolvePrompt implements the precedence /customise already promises visitors
// ("Your custom message prompt overrides this setting."):
//
//  1. customPrompt, if set and non-empty after trimming
//  2. the localized default for touchpointLocale
//  3. English (DefaultPrompt)
//
// [TestResolvePrompt_CustomPrompt_TakesPrecedenceOverLocale] and
// [TestResolvePrompt_UnrecognizedLocale_FallsBackToEnglish] pin both ends of
// the fallback chain.
func resolvePrompt(customPrompt, locale string) string {
	if p := strings.TrimSpace(customPrompt); p != "" {
		return p
	}
	if p, ok := touchpointPrompts[primarySubtag(locale)]; ok {
		return p
	}
	return DefaultPrompt
}

// primarySubtag is the part of a BCP-47 tag that picks the language, matching
// how the TS side resolves a locale (client/src/lib/touchpointTranslations.ts,
// server/src/lib/i18n.ts): "pt-BR" reads the pt prompt rather than falling all
// the way back to English.
// [TestResolvePrompt_RegionalVariant_UsesItsLanguage] pins it.
func primarySubtag(locale string) string {
	if i := strings.Index(locale, "-"); i >= 0 {
		locale = locale[:i]
	}
	return strings.ToLower(locale)
}

// ── Palette ──────────────────────────────────────────────────────────────────
//
// Mirrors client/src/index.css's design tokens so a shared link looks like the
// page it points at. The OG canvas has no colour scheme to follow, so it takes
// the dark treatment the app's brand gradients already assume
// (`--nf-on-grad-*` exists for exactly this reason).
//
// [TestOGPalette_EveryTextColourClearsAAOnEverySurface] checks every text
// colour here against every surface it can land on, and
// [TestOGTemplate_NoTextSitsOnTheBanner] pins the reachability argument that
// makes those numbers exhaustive. Together they are the Go counterpart of
// client/src/tests/theme/contrast.test.ts: changing a value below fails a test
// rather than silently shipping unreadable text.
const (
	// ogGradMark matches --nf-grad-mark, the app's primary brand gradient.
	ogGradMark = "linear-gradient(135deg, #3349E0 0%, #5322C5 55%, #4F1FA6 100%)"

	// The content surface below the banner. A two-stop vertical ramp rather
	// than a flat fill, so 440px of dark does not read as a void.
	ogSurfaceTop    = "#1B1747"
	ogSurfaceBottom = "#12102F"

	ogText       = "#FDF8FF" // --nf-paper
	ogTextMuted  = "#C3BCE4"
	ogTextAccent = "#DCC9FF"

	// Chip and hairline are solid rather than alpha so their contrast is a
	// fixed number the test can assert, not a function of what is behind them.
	ogChipBG   = "#2C2560"
	ogHairline = "#332B6B"

	// The flat darken over a user banner, copied from ProfileCard.styles.ts's
	// bannerScrim. It exists to keep the avatar ring readable on a bright photo,
	// not to make text legible — no text sits on the banner.
	ogBannerScrim = "rgba(0,0,0,0.2)"
)

// ogSurfaces / ogTextColors enumerate the palette for the contrast test: every
// text colour must clear AA against every surface it can land on.
var (
	ogSurfaces   = []string{ogSurfaceTop, ogSurfaceBottom, ogChipBG}
	ogTextColors = []string{ogText, ogTextMuted, ogTextAccent}
)

// ── Typography ───────────────────────────────────────────────────────────────

// ogFontStack leads with 'Noto Sans' and its per-script siblings. The app's
// --nf-font-sans is the platform system stack, which this renderer cannot use:
// system-ui in the Chromium container resolves to whatever fontconfig happens
// to hold, so the same input would render in a different face per deploy. Noto
// is the webfont stand-in that keeps the render deterministic and covers the
// scripts a container's system font does not.
// [TestOGFontStack_LeadsWithNotoNotABrandWebfont] pins that.
//
// 'Noto Color Emoji' MUST stay last, after the generic `sans-serif`. It ships a
// U+0020 whose advance is 1.25em, so any earlier position makes it the winning
// font for the space character whenever the webfonts above it are unavailable,
// and every gap in the image blows out to 4.5x. Emoji still resolve from it
// there, because no text font in the stack has emoji glyphs to preempt it.
// [TestOGFontStack_EmojiFamilyIsLast] pins the ordering.
const ogFontStack = `'Noto Sans', 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans SC', 'Noto Sans TC', 'Noto Sans Arabic', 'Noto Sans Devanagari', 'Noto Sans Hebrew', 'Noto Sans Thai', 'Liberation Sans', 'DejaVu Sans', sans-serif, 'Noto Color Emoji'`

// ogFontLink loads the stack above. Without it the render falls back to
// whatever the container happens to have installed.
const ogFontLink = `<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&family=Noto+Sans+JP:wght@400;700&family=Noto+Sans+KR:wght@400;700&family=Noto+Sans+SC:wght@400;700&family=Noto+Sans+TC:wght@400;700&family=Noto+Sans+Arabic:wght@400;700&family=Noto+Sans+Devanagari:wght@400;700&family=Noto+Sans+Hebrew:wght@400;700&family=Noto+Sans+Thai:wght@400;700&family=Noto+Color+Emoji&display=swap" rel="stylesheet">`

// ── Geometry ─────────────────────────────────────────────────────────────────
//
// The banner is a strip rather than a full-bleed background: no text sits on
// it, so an arbitrary user photo cannot drag any contrast pair below AA, and
// the banner gets to be genuinely visible instead of buried under a scrim.
//
// Every band is a named constant because the canvas is a fixed 1200x630 with no
// scroll: the bands have to add up, and when they do not the prompt silently
// grows over the footer. [TestOGGeometry_VerticalBandsFitTheCanvas] adds them
// up, so a future type-scale tweak fails a test instead of shipping a collision.
const (
	bannerHeight  = 170
	gutter        = 64
	avatarSize    = 124
	contentPadBot = 44

	nameFontSize     = 50
	nameLineHeight   = 110
	avatarToNameGap  = 14
	handleFontSize   = 27
	handleLineHeight = 135

	promptGap        = 28
	promptFontSize   = 56
	promptLineHeight = 115
	// A prompt longer than this is ellipsised by -webkit-line-clamp rather than
	// allowed to push into the footer.
	promptMaxLines = 2

	footerPadTop = 26
	footerBorder = 2
	markSize     = 44

	chipFontSize   = 24
	chipLineHeight = 100
	chipPadY       = 12
	chipPadX       = 22
	chipBorder     = 2
	chipRadiusPx   = 999

	hairlineWidth = footerBorder
)

// A line height is a percentage of the font size, the way the CSS below states
// it, so the band table and the stylesheet cannot drift apart.
func lineBox(fontSize, lineHeightPct int) int {
	return int(math.Ceil(float64(fontSize) * float64(lineHeightPct) / 100))
}

// cssLineHeight renders a line-height percentage as the unitless ratio CSS takes.
func cssLineHeight(pct int) string {
	return strconv.FormatFloat(float64(pct)/100, 'f', -1, 64)
}

var (
	nameLineBox   = lineBox(nameFontSize, nameLineHeight)
	handleLineBox = lineBox(handleFontSize, handleLineHeight)
	promptLineBox = lineBox(promptFontSize, promptLineHeight)

	// The chip's padding and border sit outside its line box, so the footer row
	// is taller than the text in it.
	footerRowBox = lineBox(chipFontSize, chipLineHeight) + 2*(chipPadY+chipBorder)
)

// The avatar overhangs the banner by half its height and the name sits *below*
// it, matching ProfileCard.styles.ts (`top: -AVATAR_SIZE / 2`, then `pt={48}`
// on the name row) rather than sitting beside it.
const avatarOverlap = avatarSize / 2

// avatarRadius keeps Mantine's `radius="xl"` proportion — the theme sets xl to
// 22px and ProfileCard renders an 84px avatar, so the app's avatar is a rounded
// square, not a circle. Scaling the ratio keeps that shape at OG size.
//
// [TestOGGeometry_AvatarIsARoundedSquareNotACircle] pins it.
const avatarRadius = avatarSize * 22 / 84

// ogVerticalBands is the stack of bands down the canvas, in order. The avatar
// is pulled up into the banner, so it only occupies the half below the seam.
var ogVerticalBands = []int{
	bannerHeight,
	avatarSize - avatarOverlap,
	avatarToNameGap,
	nameLineBox,
	handleLineBox,
	promptGap,
	promptMaxLines * promptLineBox,
	footerPadTop + footerBorder + footerRowBox,
	contentPadBot,
}

// promptMaxHeight is the clamp's hard ceiling. -webkit-line-clamp alone counts
// lines, not pixels, so a font that renders taller than promptLineBox would
// still overrun; this bounds it either way.
var promptMaxHeight = promptMaxLines * promptLineBox

// shareDomain is the short domain the app hands out for a profile — the form
// PublicProfile.tsx builds and ProfileUrlBar.tsx displays. The OG card shows
// the same string so the link someone reads off a preview is the link they were
// given, not the /profile/:handle path the crawler happened to fetch.
const shareDomain = "fragen.navy"

// winkMark is the app's brand mark (client/src/components/WinkMark.tsx) inlined
// as SVG. Inlining keeps it independent of the network: an OG render that
// cannot reach a CDN still carries brand identity.
const winkMark = `<svg class="mark" viewBox="0 0 160 160" aria-hidden="true">
  <defs><linearGradient id="m" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#3349E0"/><stop offset="55%" stop-color="#6B3FD4"/><stop offset="100%" stop-color="#4F1FA6"/>
  </linearGradient></defs>
  <rect width="160" height="160" rx="36" fill="url(#m)"/>
  <circle cx="60" cy="66" r="10" fill="#FDF8FF"/>
  <path d="M88 70 Q100 56 112 70" stroke="#FDF8FF" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M50 96 Q80 124 110 96" stroke="#FDF8FF" stroke-width="10" fill="none" stroke-linecap="round"/>
</svg>`

// ogTemplate is expanded by a strings.Replacer, not fmt.Sprintf. The CSS is
// dense with percentages, and under fmt every one of them has to be written
// `%%` — a rule that is invisible when it is followed and produces garbled
// output the moment it is not. Named slots also survive reordering the layout,
// which positional verbs do not.
const ogTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
{{FONT_LINK}}
<style>
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: {{W}}px; height: {{H}}px; overflow: hidden; }
  body {
    font-family: {{FONT_STACK}};
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    font-synthesis: none;
    background: linear-gradient(180deg, {{SURFACE_TOP}} 0%, {{SURFACE_BOTTOM}} 100%);
    color: {{TEXT}};
    display: flex;
    flex-direction: column;
  }

  /* Banner strip, ending in a hard edge — the app's ProfileCard cuts here too,
     and a fade would read as a blur over the user's photo. */
  .banner {
    position: relative;
    height: {{BANNER_H}}px;
    flex-shrink: 0;
    background: {{GRAD_MARK}};
    overflow: hidden;
  }
  .banner img {
    width: 100%; height: 100%;
    object-fit: cover; object-position: center;
    display: block;
  }
  /* Flat 20% darken, the same scrim ProfileCard.styles.ts applies, and for the
     same reason: it keeps the avatar's ring readable on a bright photo. It is
     deliberately not a gradient — no text sits here, so nothing needs more. */
  .banner::after {
    content: "";
    position: absolute; inset: 0;
    background: {{BANNER_SCRIM}};
  }

  /* Positioned so it paints above .banner. .banner is position:relative for its
     ::after scrim, which puts it in the positioned layer — an in-flow .content
     would render underneath it and the avatar's overhang would be clipped by
     the banner's own overflow:hidden. */
  .content {
    position: relative;
    z-index: 1;
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 0 {{GUTTER}}px {{PAD_BOT}}px;
  }

  /* The avatar overhangs the banner by half its height and the name stacks
     underneath, the arrangement ProfileCard uses. */
  .identity {
    margin-top: -{{AVATAR_OVERLAP}}px;
    min-width: 0;
  }
  .avatar {
    width: {{AVATAR}}px; height: {{AVATAR}}px;
    /* A rounded square, not a circle — Mantine radius="xl" on ProfileCard's
       Avatar. */
    border-radius: {{AVATAR_RADIUS}}px;
    object-fit: cover;
    background: {{GRAD_MARK}};
    border: 6px solid {{SURFACE_TOP}};
    /* Glyph fallback shares this box, so it centres its letter. */
    display: flex; align-items: center; justify-content: center;
    color: {{TEXT}};
    font-size: 58px; font-weight: 800; line-height: 1;
  }
  .meta {
    min-width: 0;
    padding-top: {{NAME_GAP}}px;
  }
  .name {
    font-size: {{NAME_FS}}px; font-weight: 800; line-height: {{NAME_LH}};
    letter-spacing: -0.02em;
    max-width: 900px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  }
  .handle {
    font-size: {{HANDLE_FS}}px; font-weight: 400; line-height: {{HANDLE_LH}};
    color: {{TEXT_MUTED}};
    max-width: 900px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  }

  /* Absorbs whatever the identity row and footer leave over, and centres the
     prompt in it — so a one-line prompt sits in the optical middle of the card
     instead of stranding 200px of empty surface above the footer. The padding
     is the minimum gap; the centring only ever adds to it. */
  .prompt-wrap {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    padding-top: {{PROMPT_GAP}}px;
  }
  .prompt {
    font-size: {{PROMPT_FS}}px; font-weight: 800; line-height: {{PROMPT_LH}};
    letter-spacing: -0.02em;
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: {{PROMPT_LINES}};
    max-width: 1010px;
    max-height: {{PROMPT_MAX_H}}px;
    overflow: hidden;
  }

  .footer {
    display: flex; align-items: center; justify-content: space-between;
    gap: 24px;
    padding-top: {{FOOTER_PAD}}px;
    border-top: {{HAIRLINE_W}}px solid {{HAIRLINE}};
  }
  .brand { display: flex; align-items: center; gap: 14px; flex-shrink: 0; }
  .mark { width: {{MARK_SIZE}}px; height: {{MARK_SIZE}}px; flex-shrink: 0; }
  .wordmark {
    font-size: 30px; font-weight: 800; letter-spacing: -0.03em; line-height: 1;
  }
  .wordmark span { color: {{TEXT_ACCENT}}; }
  /* The share link, in the same "fragen.navy/<handle>" pill the profile page
     uses (client/src/components/profile/ProfileUrlBar.tsx): bordered, domain
     muted and the handle emphasised, because the handle is the part a reader
     has to retype. */
  .chip {
    min-width: 0;
    background: {{CHIP_BG}};
    border: {{CHIP_BORDER}}px solid {{HAIRLINE}};
    color: {{TEXT_MUTED}};
    font-size: {{CHIP_FS}}px; font-weight: 400; line-height: {{CHIP_LH}};
    padding: {{CHIP_PAD_Y}}px {{CHIP_PAD_X}}px;
    border-radius: {{CHIP_RADIUS}}px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .chip b { color: {{TEXT}}; font-weight: 700; }
</style>
</head>
<body>
  <div class="banner">{{BANNER_IMG}}</div>
  <div class="content">
    <div class="identity">
      {{AVATAR_EL}}
      <div class="meta">
        <div class="name">{{NAME}}</div>
        {{HANDLE_ROW}}
      </div>
    </div>
    <div class="prompt-wrap"><div class="prompt">{{PROMPT}}</div></div>
    <div class="footer">
      <div class="brand">
        {{MARK_SVG}}
        <div class="wordmark">{{WORDMARK}}</div>
      </div>
      <div class="chip">{{SHARE_LINK}}</div>
    </div>
  </div>
</body>
</html>`

// BuildOGTemplate renders an OG-sized (1200x630) HTML page laid out like the
// profile page it previews: a banner strip (or the brand gradient when the
// profile has none), the avatar straddling the seam, name and handle, the ask
// prompt as the headline, and a navyfragen wordmark lockup.
//
// All user-supplied strings are HTML-escaped — the output is fed to a headless
// browser, so an unescaped payload would be a code-injection vector. Remote URLs
// additionally go through safeImageURL.
func BuildOGTemplate(in OGInput) string {
	prompt := resolvePrompt(in.Prompt, in.Locale)

	handle := strings.TrimPrefix(strings.TrimSpace(in.Handle), "@")

	// A profile with no display name shows its handle as the headline, and then
	// the @handle row underneath would just repeat it.
	// [TestBuildOGTemplate_NoDisplayName_DoesNotPrintTheHandleTwice] pins it.
	name := strings.TrimSpace(in.DisplayName)
	handleRow := fmt.Sprintf(`<div class="handle">@%s</div>`, html.EscapeString(handle))
	if name == "" {
		name = handle
		handleRow = ""
	}

	shareLink := fmt.Sprintf("%s/<b>%s</b>", shareDomain, html.EscapeString(handle))

	// strings.Replacer substitutes in a single pass, so a display name that
	// itself contains a "{{...}}" slot is inserted literally rather than
	// re-expanded. [TestBuildOGTemplate_UserContentCannotInjectTemplateSlots]
	// pins that.
	return strings.NewReplacer(
		"{{FONT_LINK}}", ogFontLink,
		"{{FONT_STACK}}", ogFontStack,
		"{{W}}", fmt.Sprint(OGWidth),
		"{{H}}", fmt.Sprint(OGHeight),
		"{{GRAD_MARK}}", ogGradMark,
		"{{WORDMARK}}", AppNameWordmarkHTML,
		"{{SURFACE_TOP}}", ogSurfaceTop,
		"{{SURFACE_BOTTOM}}", ogSurfaceBottom,
		"{{TEXT}}", ogText,
		"{{TEXT_MUTED}}", ogTextMuted,
		"{{TEXT_ACCENT}}", ogTextAccent,
		"{{CHIP_BG}}", ogChipBG,
		"{{HAIRLINE}}", ogHairline,
		"{{BANNER_H}}", fmt.Sprint(bannerHeight),
		"{{GUTTER}}", fmt.Sprint(gutter),
		"{{AVATAR}}", fmt.Sprint(avatarSize),
		"{{AVATAR_OVERLAP}}", fmt.Sprint(avatarOverlap),
		"{{AVATAR_RADIUS}}", fmt.Sprint(avatarRadius),
		"{{NAME_GAP}}", fmt.Sprint(avatarToNameGap),
		"{{BANNER_SCRIM}}", ogBannerScrim,
		"{{PAD_BOT}}", fmt.Sprint(contentPadBot),
		"{{NAME_FS}}", fmt.Sprint(nameFontSize),
		"{{NAME_LH}}", cssLineHeight(nameLineHeight),
		"{{HANDLE_FS}}", fmt.Sprint(handleFontSize),
		"{{HANDLE_LH}}", cssLineHeight(handleLineHeight),
		"{{PROMPT_GAP}}", fmt.Sprint(promptGap),
		"{{PROMPT_FS}}", fmt.Sprint(promptFontSize),
		"{{PROMPT_LH}}", cssLineHeight(promptLineHeight),
		"{{CHIP_FS}}", fmt.Sprint(chipFontSize),
		"{{CHIP_LH}}", cssLineHeight(chipLineHeight),
		"{{CHIP_PAD_Y}}", fmt.Sprint(chipPadY),
		"{{CHIP_PAD_X}}", fmt.Sprint(chipPadX),
		"{{CHIP_BORDER}}", fmt.Sprint(chipBorder),
		"{{PROMPT_LINES}}", fmt.Sprint(promptMaxLines),
		"{{PROMPT_MAX_H}}", fmt.Sprint(promptMaxHeight),
		"{{FOOTER_PAD}}", fmt.Sprint(footerPadTop),
		"{{HAIRLINE_W}}", fmt.Sprint(hairlineWidth),
		"{{CHIP_RADIUS}}", fmt.Sprint(chipRadiusPx),
		"{{MARK_SVG}}", winkMark,
		"{{MARK_SIZE}}", fmt.Sprint(markSize),
		"{{BANNER_IMG}}", buildBannerElement(in.Banner),
		"{{AVATAR_EL}}", buildAvatarElement(in.Avatar, in.DisplayName, in.Handle),
		"{{NAME}}", html.EscapeString(name),
		"{{HANDLE_ROW}}", handleRow,
		"{{SHARE_LINK}}", shareLink,
		"{{PROMPT}}", html.EscapeString(prompt),
	).Replace(ogTemplate)
}

// buildBannerElement returns the banner <img>, or nothing at all when the
// profile has no banner — .banner's own brand-gradient background is then what
// shows through.
func buildBannerElement(bannerURL string) string {
	url := safeImageURL(bannerURL)
	if url == "" {
		return ""
	}
	return fmt.Sprintf(`<img src=%q alt="">`, url)
}

// buildAvatarElement returns the avatar HTML element. When the URL is missing
// or unusable, a circular brand-gradient tile (styled by .avatar's CSS) with
// the first letter of the display name (or handle) as a glyph is emitted.
func buildAvatarElement(avatarURL, displayName, handle string) string {
	if url := safeImageURL(avatarURL); url != "" {
		return fmt.Sprintf(`<img class="avatar" src=%q alt="">`, url)
	}
	glyph := firstGlyph(displayName)
	if glyph == "" {
		glyph = firstGlyph(handle)
	}
	return fmt.Sprintf(`<div class="avatar">%s</div>`, html.EscapeString(glyph))
}

// safeImageURL returns the HTML-escaped URL if it is an ordinary remote image
// reference, and "" otherwise so the caller falls back. The profile fields it
// guards come from a third-party PDS, and the result is interpolated into
// markup that a browser will execute: anything but a plain http(s) URL — a
// javascript: or data: scheme, or embedded whitespace or control characters
// that could break out of the attribute — is refused rather than sanitised.
//
// [TestSafeImageURL] pins the accepted and rejected shapes.
func safeImageURL(raw string) string {
	u := strings.TrimSpace(raw)
	if u == "" {
		return ""
	}
	if !strings.HasPrefix(u, "http://") && !strings.HasPrefix(u, "https://") {
		return ""
	}
	if strings.ContainsFunc(u, func(r rune) bool { return r <= ' ' || r == 0x7f }) {
		return ""
	}
	return html.EscapeString(u)
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
