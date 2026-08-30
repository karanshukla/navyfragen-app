package shim

import _ "embed"

// fallbackOGImageBytes is the branded 1200x630 OG card the client also ships at
// /og.png. It is embedded rather than COPYed into the image because
// the runtime stage is distroless and carries only the /shim binary, so there
// is no filesystem to read it from.
//
//go:embed assets/og.png
var fallbackOGImageBytes []byte

// FallbackOGImage returns the branded OG card served for a DID whose real
// render has not landed yet. It is seen by real people following a share, so it
// is a deliberate brand asset rather than a placeholder or an error page.
func FallbackOGImage() []byte { return fallbackOGImageBytes }
