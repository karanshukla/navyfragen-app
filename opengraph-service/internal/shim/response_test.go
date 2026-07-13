package shim

import (
	"strings"
	"testing"
)

// BuildOGResponse produces the HTML that the Bluesky Cardyb crawler fetches. It
// is NOT the OG image itself — it is the per-profile index.html whose
// og:image points at the generated PNG. It must carry og:image, og:title,
// og:description, and a reasonable title, and the image URL must be absolute
// (crawlers will not resolve relative URLs).

func TestBuildOGResponse_ContainsAllRequiredOGTags(t *testing.T) {
	got := BuildOGResponse(ResponseInput{
		ProfileHandle: "alice.bsky.social",
		DisplayName:   "Alice",
		ImageURL:      "https://navyfragen.app/og-cache/did-plc-alice.png",
		Origin:        "https://navyfragen.app",
	})
	mustContain(t, got, `property="og:image"`)
	mustContain(t, got, `property="og:title"`)
	mustContain(t, got, `property="og:description"`)
	mustContain(t, got, `property="og:url"`)
	mustContain(t, got, `property="og:image:width"`)
	mustContain(t, got, `property="og:image:height"`)
	mustContain(t, got, "https://navyfragen.app/og-cache/did-plc-alice.png")
}

func TestBuildOGResponse_ImageURLIsAbsolute(t *testing.T) {
	got := BuildOGResponse(ResponseInput{
		ProfileHandle: "alice.bsky.social",
		ImageURL:      "/og-cache/did-plc-alice.png",
		Origin:        "https://navyfragen.app",
	})
	// The absolute URL must appear; the relative one must not be the og:image.
	mustContain(t, got, "https://navyfragen.app/og-cache/did-plc-alice.png")
}

func TestBuildOGResponse_EscapesDisplayName(t *testing.T) {
	got := BuildOGResponse(ResponseInput{
		ProfileHandle: "alice.bsky.social",
		DisplayName:   `<script>x</script>`,
		ImageURL:      "https://x/y.png",
		Origin:        "https://navyfragen.app",
	})
	mustNotContain(t, got, "<script>")
}

func TestBuildOGResponse_IncludesDisplayName(t *testing.T) {
	got := BuildOGResponse(ResponseInput{
		ProfileHandle: "alice.bsky.social",
		DisplayName:   "Alice in Wonderland",
		ImageURL:      "https://x/y.png",
		Origin:        "https://navyfragen.app",
	})
	mustContain(t, got, "Alice in Wonderland")
}

func TestAbsoluteImageURL_RelativeWithOrigin(t *testing.T) {
	got := AbsoluteImageURL("https://navyfragen.app", "/og-cache/did-plc-x.png")
	if got != "https://navyfragen.app/og-cache/did-plc-x.png" {
		t.Fatalf("got %q", got)
	}
}

func TestAbsoluteImageURL_AlreadyAbsolute(t *testing.T) {
	in := "https://cdn.example.com/x.png"
	got := AbsoluteImageURL("https://navyfragen.app", in)
	if got != in {
		t.Fatalf("already-absolute URL should pass through, got %q", got)
	}
}

func TestAbsoluteImageURL_RelativeWithoutLeadingSlash(t *testing.T) {
	got := AbsoluteImageURL("https://navyfragen.app", "og-cache/x.png")
	if !strings.HasPrefix(got, "https://navyfragen.app") || !strings.HasSuffix(got, "/og-cache/x.png") {
		t.Fatalf("got %q", got)
	}
}

func TestAbsoluteImageURL_TrailingSlashOriginNotDoubled(t *testing.T) {
	got := AbsoluteImageURL("https://navyfragen.app/", "/og-cache/x.png")
	if strings.Contains(got, "//og-cache") {
		t.Fatalf("double slash in %q", got)
	}
}
