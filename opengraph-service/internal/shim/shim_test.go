package shim

import (
	"strings"
	"testing"
	"time"
)

// --- Classify: the hot-path decision that ordinary /* traffic must not trip ---

func TestClassify_CardybOnProfilePath_Generates(t *testing.T) {
	if got := Classify("Bluesky Cardyb", "/profile/did:plc:abc"); got != DecisionGenerate {
		t.Fatalf("Cardyb on /profile/:handle = %v, want DecisionGenerate", got)
	}
}

func TestClassify_CardybOnRoot_Proxies(t *testing.T) {
	if got := Classify("Bluesky Cardyb", "/"); got != DecisionProxy {
		t.Fatalf("Cardyb on / = %v, want DecisionProxy", got)
	}
}

func TestClassify_CardybOnMessages_Proxies(t *testing.T) {
	if got := Classify("Bluesky Cardyb", "/messages"); got != DecisionProxy {
		t.Fatalf("Cardyb on /messages = %v, want DecisionProxy", got)
	}
}

func TestClassify_BrowserOnProfilePath_Proxies(t *testing.T) {
	if got := Classify("Mozilla/5.0 (Windows)", "/profile/foo.bsky.social"); got != DecisionProxy {
		t.Fatalf("browser UA on /profile/:handle = %v, want DecisionProxy", got)
	}
}

func TestClassify_CardybAsSubstring_Generates(t *testing.T) {
	// Real crawlers append version info. Match on substring, not equality.
	if got := Classify("Bluesky Cardyb/1.2 (like Googlebot)", "/profile/foo"); got != DecisionGenerate {
		t.Fatalf("Cardyb+version = %v, want DecisionGenerate", got)
	}
}

func TestClassify_EmptyUA_Proxies(t *testing.T) {
	if got := Classify("", "/profile/foo"); got != DecisionProxy {
		t.Fatalf("empty UA = %v, want DecisionProxy", got)
	}
}

// --- ProfileHandle extraction (accepts the :handle and ignores the rest) ---

func TestProfileHandle_Plain(t *testing.T) {
	if got := ProfileHandle("/profile/foo.bsky.social"); got != "foo.bsky.social" {
		t.Fatalf("got %q", got)
	}
}

func TestProfileHandle_StripsQuery(t *testing.T) {
	if got := ProfileHandle("/profile/foo?ref=card"); got != "foo" {
		t.Fatalf("got %q", got)
	}
}

func TestProfileHandle_StripsTrailingSlash(t *testing.T) {
	if got := ProfileHandle("/profile/foo/"); got != "foo" {
		t.Fatalf("got %q", got)
	}
}

func TestProfileHandle_BareProfileRoute_Empty(t *testing.T) {
	if got := ProfileHandle("/profile"); got != "" {
		t.Fatalf("got %q, want empty", got)
	}
}

func TestProfileHandle_NestedPath_Empty(t *testing.T) {
	// /profile/a/b is not a single handle; must not match.
	if got := ProfileHandle("/profile/a/b"); got != "" {
		t.Fatalf("got %q, want empty", got)
	}
}

// --- Cache TTL logic ---

func TestCacheEntry_NilNeverFresh(t *testing.T) {
	var e *CacheEntry
	if e.IsFresh(time.Now(), time.Hour) {
		t.Fatal("nil entry should not be fresh")
	}
}

func TestCacheEntry_ZeroModTimeNeverFresh(t *testing.T) {
	e := &CacheEntry{}
	if e.IsFresh(time.Now(), time.Hour) {
		t.Fatal("zero ModTime should not be fresh")
	}
}

func TestCacheEntry_WithinTTL_Fresh(t *testing.T) {
	now := time.Now()
	e := &CacheEntry{ModTime: now.Add(-1 * time.Minute)}
	if !e.IsFresh(now, time.Hour) {
		t.Fatal("entry 1m old with 1h TTL should be fresh")
	}
}

func TestCacheEntry_PastTTL_NotFresh(t *testing.T) {
	now := time.Now()
	e := &CacheEntry{ModTime: now.Add(-2 * time.Hour)}
	if e.IsFresh(now, time.Hour) {
		t.Fatal("entry 2h old with 1h TTL should NOT be fresh")
	}
}

func TestParseTTL_Valid(t *testing.T) {
	if got := ParseTTL("720h", time.Hour); got != 720*time.Hour {
		t.Fatalf("got %v", got)
	}
}

func TestParseTTL_Empty_FallsBack(t *testing.T) {
	if got := ParseTTL("", 99*time.Hour); got != 99*time.Hour {
		t.Fatalf("got %v", got)
	}
}

func TestParseTTL_Garbage_FallsBack(t *testing.T) {
	if got := ParseTTL("not-a-duration", 99*time.Hour); got != 99*time.Hour {
		t.Fatalf("got %v", got)
	}
}

func TestParseTTL_NonPositive_FallsBack(t *testing.T) {
	if got := ParseTTL("0s", 99*time.Hour); got != 99*time.Hour {
		t.Fatalf("got %v", got)
	}
	if got := ParseTTL("-1s", 99*time.Hour); got != 99*time.Hour {
		t.Fatalf("got %v", got)
	}
}

// --- OG composite template builder fallbacks ---
// These are the acceptance criteria for "sensible fallbacks when banner/avatar
// are unset." Each variation must produce valid HTML that names the OG size and
// does NOT contain an empty src attribute that would break the renderer.

func TestBuildOGTemplate_BothSet(t *testing.T) {
	html := BuildOGTemplate(OGInput{
		DisplayName: "Alice",
		Handle:      "alice.bsky.social",
		Banner:      "https://cdn.bsky.app/banner.jpg",
		Avatar:      "https://cdn.bsky.app/avatar.jpg",
		Prompt:      "Ask me anything",
	})
	mustContain(t, html, "alice.bsky.social")
	mustContain(t, html, "https://cdn.bsky.app/banner.jpg")
	mustContain(t, html, "https://cdn.bsky.app/avatar.jpg")
	mustContain(t, html, "Ask me anything")
	mustContain(t, html, "1200") // width
	mustContain(t, html, "630")  // height
	mustNotContain(t, html, `src=""`)
}

func TestBuildOGTemplate_BannerEmpty(t *testing.T) {
	html := BuildOGTemplate(OGInput{
		DisplayName: "Bob",
		Handle:      "bob.bsky.social",
		Banner:      "", // fallback bg expected
		Avatar:      "https://cdn.bsky.app/avatar.jpg",
		Prompt:      "p",
	})
	mustContain(t, html, "bob.bsky.social")
	mustNotContain(t, html, `url()`)        // no empty CSS url()
	mustNotContain(t, html, `src=""`)       // no empty img src
	mustContain(t, html, "linear-gradient") // brand gradient fallback bg
}

func TestBuildOGTemplate_AvatarEmpty(t *testing.T) {
	html := BuildOGTemplate(OGInput{
		DisplayName: "Carol",
		Handle:      "carol.bsky.social",
		Banner:      "https://cdn.bsky.app/banner.jpg",
		Avatar:      "", // fallback glyph expected
		Prompt:      "p",
	})
	mustContain(t, html, "carol.bsky.social")
	mustNotContain(t, html, `src=""`)
	// Avatar fallback = first letter of display name as a glyph.
	mustContain(t, html, "C")
}

func TestBuildOGTemplate_BothEmpty(t *testing.T) {
	html := BuildOGTemplate(OGInput{
		DisplayName: "Dave",
		Handle:      "dave.bsky.social",
		Banner:      "",
		Avatar:      "",
		Prompt:      "p",
	})
	mustContain(t, html, "dave.bsky.social")
	mustNotContain(t, html, `url()`)
	mustNotContain(t, html, `src=""`)
	mustContain(t, html, "linear-gradient")
	mustContain(t, html, "D") // glyph
}

func TestBuildOGTemplate_EmptyDisplayName_UsesHandleForGlyph(t *testing.T) {
	html := BuildOGTemplate(OGInput{
		DisplayName: "",
		Handle:      "eve.bsky.social",
		Avatar:      "",
		Prompt:      "p",
	})
	mustContain(t, html, "eve.bsky.social")
	mustContain(t, html, "e") // glyph falls back to first letter of handle
}

func TestBuildOGTemplate_PromptHTMLEscaped(t *testing.T) {
	html := BuildOGTemplate(OGInput{
		DisplayName: "X",
		Handle:      "x.bsky.social",
		Prompt:      `<script>alert(1)</script>`,
	})
	mustNotContain(t, html, "<script>")
	mustContain(t, html, "&lt;script&gt;")
}

func mustContain(t *testing.T, s, sub string) {
	t.Helper()
	if !strings.Contains(s, sub) {
		t.Fatalf("output missing %q\n--- output ---\n%s", sub, s)
	}
}

func mustNotContain(t *testing.T, s, sub string) {
	t.Helper()
	if strings.Contains(s, sub) {
		t.Fatalf("output unexpectedly contains %q\n--- output ---\n%s", sub, s)
	}
}
