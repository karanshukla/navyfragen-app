// Command composite-render builds the OG composite HTML for a profile (banner
// bg + avatar overlay + prompt text) and POSTs it to the running html-to-image
// service, saving the returned PNG to disk. This is poc slice #3: prove the
// composite renders a usable OG-sized PNG, with sensible fallbacks when
// banner/avatar are unset.
//
// Usage:
//
//	composite-render -banner URL -avatar URL -name "Alice" -handle "alice.bsky.social" \
//	  -prompt "Ask me anything" -out alice.png
//	composite-render -out no-banner.png -name "Bob" -handle "bob.bsky.social"   # banner empty
//	composite-render -out no-avatar.png -name "Carol" -handle "carol.bsky.social" -banner URL
//	composite-render -out both-empty.png -name "Dave" -handle "dave.bsky.social"
package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/karanshukla/navyfragen-app/opengraph-service/internal/shim"
)

func main() {
	var (
		htmlURL  = flag.String("url", envOr("EXPORT_HTML_URL", "http://localhost:3033/"), "html-to-image service URL")
		banner   = flag.String("banner", "", "banner image URL (empty = brand gradient fallback)")
		avatar   = flag.String("avatar", "", "avatar image URL (empty = glyph fallback)")
		name     = flag.String("name", "", "display name")
		handle   = flag.String("handle", "", "profile handle (required)")
		prompt   = flag.String("prompt", "", "prompt text (empty = default)")
		out      = flag.String("out", "og.png", "output PNG path")
		timeoutS = flag.Int("timeout", 30, "overall deadline in seconds")
	)
	flag.Parse()

	if *handle == "" {
		fmt.Fprintln(os.Stderr, "composite-render: -handle is required")
		os.Exit(2)
	}

	in := shim.OGInput{
		DisplayName: *name,
		Handle:      *handle,
		Banner:      *banner,
		Avatar:      *avatar,
		Prompt:      *prompt,
	}
	htmlSrc := shim.BuildOGTemplate(in)

	// Echo the template size + which fallback is active so the report can quote it.
	fmt.Printf("banner=%q avatar=%q glyph_fallback=%v\n", *banner, *avatar, *avatar == "")
	fmt.Printf("html bytes=%d\n", len(htmlSrc))

	if err := postAndSave(*htmlURL, htmlSrc, *out, time.Duration(*timeoutS)*time.Second); err != nil {
		fmt.Fprintf(os.Stderr, "composite-render: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("wrote %s\n", *out)
}

func postAndSave(htmlURL, htmlSrc, outPath string, deadline time.Duration) error {
	body, err := json.Marshal(map[string]any{
		"source": htmlSrc,
		"format": "png",
		"options": map[string]any{
			"width":  shim.OGWidth,
			"height": shim.OGHeight,
		},
	})
	if err != nil {
		return fmt.Errorf("marshal body: %w", err)
	}

	// Mirror server/src/lib/image-generator.ts: bounded deadline, retry on
	// network errors (not on HTTP errors — those mean the service is up).
	client := &http.Client{Timeout: deadline}
	var lastErr error
	delay := 500 * time.Millisecond
	deadlineAt := time.Now().Add(deadline)
	for {
		req, err := http.NewRequest(http.MethodPost, htmlURL, bytes.NewReader(body))
		if err != nil {
			return fmt.Errorf("build request: %w", err)
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := client.Do(req)
		if err == nil {
			defer resp.Body.Close()
			if resp.StatusCode/100 != 2 {
				b, _ := io.ReadAll(resp.Body)
				return fmt.Errorf("html-to-image returned %d: %s", resp.StatusCode, strings.TrimSpace(string(b)))
			}
			pngBytes, err := io.ReadAll(resp.Body)
			if err != nil {
				return fmt.Errorf("read response: %w", err)
			}
			if err := os.WriteFile(outPath, pngBytes, 0o644); err != nil {
				return fmt.Errorf("write %s: %w", outPath, err)
			}
			fmt.Printf("png bytes=%d\n", len(pngBytes))
			return nil
		}
		lastErr = err
		if time.Now().After(deadlineAt) {
			break
		}
		time.Sleep(delay)
		delay *= 2
	}
	return fmt.Errorf("after retries: %w", lastErr)
}

func envOr(key, def string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return def
}
