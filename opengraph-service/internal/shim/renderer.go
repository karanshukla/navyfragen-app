package shim

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// ErrRenderFailed wraps any failure from the html-to-image service so the
// generator can surface a single typed error (and the proxy fast path can
// degrade gracefully).
var ErrRenderFailed = errors.New("render failed")

// ImageRenderer renders an HTML source document to image bytes. The
// html-to-image-backed implementation is the production path; the interface
// exists so the generator can be unit-tested with a fake.
type ImageRenderer interface {
	Render(ctx context.Context, htmlSrc string) ([]byte, error)
}

// HTMLToImageRenderer POSTs the composite HTML to the sibling html-to-image
// service and returns the rendered PNG bytes. It mirrors the TS
// image-generator.ts call shape and retry discipline (bounded deadline, retry
// on network errors only — not on HTTP errors).
type HTMLToImageRenderer struct {
	URL     string
	Client  *http.Client
	Timeout time.Duration // overall deadline including retries
}

// NewHTMLToImageRenderer constructs a renderer for the given service URL. The
// timeout bounds the full retry loop (default 30s if <= 0).
func NewHTMLToImageRenderer(url string, timeout time.Duration) *HTMLToImageRenderer {
	if url == "" {
		url = "http://localhost:3033/"
	}
	if timeout <= 0 {
		timeout = 30 * time.Second
	}
	return &HTMLToImageRenderer{
		URL:     url,
		Client:  &http.Client{Timeout: timeout},
		Timeout: timeout,
	}
}

// renderRequest is the body shape html-to-image expects — mirrors
// server/src/lib/image-generator.ts.
type renderRequest struct {
	Source  string         `json:"source"`
	Format  string         `json:"format"`
	Options map[string]any `json:"options"`
}

// Render POSTs the HTML and returns the image bytes. Network errors are retried
// with exponential backoff until the deadline; HTTP 4xx/5xx are not retried (a
// response means the service is up — retrying the same payload won't help). Any
// failure surfaces as ErrRenderFailed so callers can handle one typed error.
func (r *HTMLToImageRenderer) Render(ctx context.Context, htmlSrc string) ([]byte, error) {
	body, err := json.Marshal(renderRequest{
		Source: htmlSrc,
		Format: "png",
		Options: map[string]any{
			"width":  OGWidth,
			"height": OGHeight,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("%w: marshal: %v", ErrRenderFailed, err)
	}

	deadline := time.Now().Add(r.Timeout)
	delay := 500 * time.Millisecond
	var lastErr error
	for {
		if ctxErr := ctx.Err(); ctxErr != nil {
			return nil, fmt.Errorf("%w: %v", ErrRenderFailed, ctxErr)
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, r.URL, bytes.NewReader(body))
		if err != nil {
			return nil, fmt.Errorf("%w: build request: %v", ErrRenderFailed, err)
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := r.Client.Do(req)
		if err != nil {
			// Network error: retryable.
			lastErr = err
			if time.Now().After(deadline) {
				break
			}
			time.Sleep(delay)
			delay *= 2
			continue
		}
		respBytes, readErr := io.ReadAll(resp.Body)
		resp.Body.Close()
		if readErr != nil {
			return nil, fmt.Errorf("%w: read response: %v", ErrRenderFailed, readErr)
		}
		if resp.StatusCode/100 != 2 {
			return nil, fmt.Errorf("%w: html-to-image %d: %s",
				ErrRenderFailed, resp.StatusCode, strings.TrimSpace(string(respBytes)))
		}
		if len(respBytes) == 0 {
			return nil, fmt.Errorf("%w: empty response", ErrRenderFailed)
		}
		return respBytes, nil
	}
	return nil, fmt.Errorf("%w: after retries: %v", ErrRenderFailed, lastErr)
}
