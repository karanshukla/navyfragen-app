package shim

import "testing"

// Precedence: customPrompt (trimmed, non-empty) → the localized default for
// touchpointLocale → English (DefaultPrompt). Matches what /customise already
// promises visitors: "Your custom message prompt overrides this setting."

func TestResolvePrompt_CustomPrompt_TakesPrecedenceOverLocale(t *testing.T) {
	got := resolvePrompt("Pregúntame algo", "es")
	if got != "Pregúntame algo" {
		t.Fatalf("resolvePrompt = %q, want the custom prompt verbatim", got)
	}
}

func TestResolvePrompt_LocalizedDefault_UsesCatalogWhenNoCustomPrompt(t *testing.T) {
	for locale, want := range touchpointPrompts {
		got := resolvePrompt("", locale)
		if got != want {
			t.Errorf("resolvePrompt(%q, %q) = %q, want %q", "", locale, got, want)
		}
	}
}

// A prompt of only whitespace is the same as unset — /customise's own draft
// logic already treats "" the same way (`promptDraft.trim() || null`), so the
// Go side has to agree or a whitespace-only prompt would render as a blank
// headline instead of falling through to the locale default.
func TestResolvePrompt_WhitespaceOnlyCustomPrompt_FallsBackToLocale(t *testing.T) {
	got := resolvePrompt("   ", "de")
	if got != touchpointPrompts["de"] {
		t.Fatalf("resolvePrompt with whitespace-only prompt = %q, want the German default %q", got, touchpointPrompts["de"])
	}
}

func TestResolvePrompt_UnrecognizedLocale_FallsBackToEnglish(t *testing.T) {
	cases := []string{"", "xx", "EN", "en-US"}
	for _, locale := range cases {
		if got := resolvePrompt("", locale); got != DefaultPrompt {
			t.Errorf("resolvePrompt(%q, %q) = %q, want DefaultPrompt %q", "", locale, got, DefaultPrompt)
		}
	}
}

func TestResolvePrompt_NoCustomPromptRecognizedLocale_TrumpsEnglishFallback(t *testing.T) {
	got := resolvePrompt("", "fr")
	if got == DefaultPrompt {
		t.Fatal("a recognized non-English locale with no custom prompt must not fall through to English")
	}
}

// touchpointLocales in client/src/lib/touchpointTranslations.ts:17-23. If that
// list changes, this map has to change with it or a locale silently renders in
// English.
var wantTouchpointLocales = []string{"en", "es", "pt", "de", "fr"}

func TestTouchpointPrompts_CoversEveryTouchpointLocale(t *testing.T) {
	if len(touchpointPrompts) != len(wantTouchpointLocales) {
		t.Fatalf("touchpointPrompts has %d entries, want %d (%v)",
			len(touchpointPrompts), len(wantTouchpointLocales), wantTouchpointLocales)
	}
	for _, locale := range wantTouchpointLocales {
		prompt, ok := touchpointPrompts[locale]
		if !ok {
			t.Errorf("touchpointPrompts is missing locale %q", locale)
			continue
		}
		if prompt == "" {
			t.Errorf("touchpointPrompts[%q] is empty", locale)
		}
	}
}

func TestTouchpointPrompts_EnglishEntryMatchesDefaultPrompt(t *testing.T) {
	if touchpointPrompts["en"] != DefaultPrompt {
		t.Fatalf(`touchpointPrompts["en"] = %q, want DefaultPrompt %q — the locale lookup and the final English fallback must agree`,
			touchpointPrompts["en"], DefaultPrompt)
	}
}

// A regional variant is a tag the NF server now accepts for touchpointLocale,
// and the client renders that profile in the tag's language — so the card has
// to agree rather than falling back to English.
func TestResolvePrompt_RegionalVariant_UsesItsLanguage(t *testing.T) {
	for _, tc := range []struct{ locale, want string }{
		{"pt-BR", touchpointPrompts["pt"]},
		{"es-419", touchpointPrompts["es"]},
		{"DE-AT", touchpointPrompts["de"]},
		{"fr-CA", touchpointPrompts["fr"]},
		{"en-GB", DefaultPrompt},
	} {
		if got := resolvePrompt("", tc.locale); got != tc.want {
			t.Errorf("resolvePrompt(%q) = %q, want %q", tc.locale, got, tc.want)
		}
	}
}

func TestResolvePrompt_UnsupportedLanguage_StillFallsBackToEnglish(t *testing.T) {
	for _, locale := range []string{"ja", "nl-BE", ""} {
		if got := resolvePrompt("", locale); got != DefaultPrompt {
			t.Errorf("resolvePrompt(%q) = %q, want DefaultPrompt", locale, got)
		}
	}
}
