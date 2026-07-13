package shim

import (
	"fmt"
	"html"
	"net/url"
	"strings"
)

// ResponseInput is the data needed to build the per-profile HTML response the
// Cardyb crawler consumes.
type ResponseInput struct {
	ProfileHandle string // the :handle from the URL (for og:url)
	DisplayName   string // for og:title
	ImageURL      string // the absolute og:image URL
	Origin        string // the public site origin, e.g. https://navyfragen.app
}

// BuildOGResponse produces the minimal HTML that carries the per-profile OG
// tags. It is NOT the image itself — it is the index.html whose og:image points
// at the generated PNG served from /og-cache/:did.png. All user-supplied
// strings are HTML-escaped. The crawler is not a browser executing the page; it
// only reads the meta tags, so the body is a placeholder.
func BuildOGResponse(in ResponseInput) string {
	imageURL := AbsoluteImageURL(in.Origin, in.ImageURL)
	origin := strings.TrimRight(strings.TrimSpace(in.Origin), "/")
	profileURL := origin + "/profile/" + html.EscapeString(strings.TrimPrefix(strings.TrimSpace(in.ProfileHandle), "@"))

	title := html.EscapeString(strings.TrimSpace(in.DisplayName))
	if title == "" {
		title = html.EscapeString(strings.TrimSpace(in.ProfileHandle))
	}
	if title == "" {
		title = "Navyfragen"
	}
	ogURL := html.EscapeString(profileURL)
	ogImage := html.EscapeString(imageURL)

	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>%s - Navyfragen</title>
<meta property="og:title" content="%s">
<meta property="og:description" content="Ask me anything anonymously on Navyfragen">
<meta property="og:url" content="%s">
<meta property="og:image" content="%s">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="%d">
<meta property="og:image:height" content="%d">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="%s">
</head>
<body></body>
</html>`, title, title, ogURL, ogImage, OGWidth, OGHeight, ogImage)
}

// AbsoluteImageURL resolves a possibly-relative image URL against the public
// origin. Cardyb (and link-preview crawlers in general) will not resolve
// relative URLs, so /og-cache/foo.png must become https://origin/og-cache/foo.png.
// Already-absolute URLs pass through unchanged.
func AbsoluteImageURL(origin, imageURL string) string {
	imageURL = strings.TrimSpace(imageURL)
	if imageURL == "" {
		return ""
	}
	// Already absolute (http/https or protocol-relative)?
	lower := strings.ToLower(imageURL)
	if strings.HasPrefix(lower, "http://") || strings.HasPrefix(lower, "https://") {
		return imageURL
	}
	origin = strings.TrimSpace(origin)
	if origin == "" {
		return imageURL
	}
	base := strings.TrimRight(origin, "/")
	if imageURL == "" {
		return base
	}
	if strings.HasPrefix(imageURL, "//") {
		// Protocol-relative: assume https from the origin scheme.
		scheme := "https"
		if u, err := url.Parse(origin); err == nil && u.Scheme != "" {
			scheme = u.Scheme
		}
		return scheme + ":" + imageURL
	}
	if strings.HasPrefix(imageURL, "/") {
		return base + imageURL
	}
	return base + "/" + imageURL
}
