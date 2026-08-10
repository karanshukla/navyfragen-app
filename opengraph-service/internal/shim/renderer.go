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

// A sleeping html-to-image answers before it is ready, and those answers are
// HTTP responses rather than network errors: Railway's edge returns 502 while
// the container is still waking, and the service itself returns 503 while
// Chromium is still launching. Mirrors WAKE_RETRYABLE_STATUSES in
// server/src/lib/image-generator.ts — 4xx and 429 are deliberately absent.
var wakeRetryableStatuses = map[int]bool{
	http.StatusRequestTimeout:     true,
	http.StatusBadGateway:         true,
	http.StatusServiceUnavailable: true,
	http.StatusGatewayTimeout:     true,
}

// maxRenderBackoff caps exponential growth so a long deadline cannot produce a
// single sleep that swallows the entire remaining budget.
const maxRenderBackoff = 2 * time.Second

// defaultAttemptTimeout bounds one attempt. A cold attempt pays a container
// wake plus a Chromium launch plus the render; anything beyond this is a hang,
// and retrying beats waiting out the whole budget on a dead connection.
const defaultAttemptTimeout = 15 * time.Second

// HTMLToImageRenderer POSTs the composite HTML to the sibling html-to-image
// service. It mirrors image-generator.ts's call shape and retry discipline.
type HTMLToImageRenderer struct {
	URL     string
	Client  *http.Client
	Timeout time.Duration // overall deadline including retries
	// AttemptTimeout bounds a single attempt. The overall Timeout must not be
	// used here: one hung connection would consume the entire budget and leave
	// nothing for the retry that would have succeeded.
	AttemptTimeout time.Duration
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
	attempt := defaultAttemptTimeout
	if timeout < attempt {
		attempt = timeout
	}
	return &HTMLToImageRenderer{
		URL: url,
		// No Client.Timeout — it would bound the whole loop, not one attempt.
		Client:         &http.Client{},
		Timeout:        timeout,
		AttemptTimeout: attempt,
	}
}

// renderRequest is the body shape html-to-image expects — mirrors
// server/src/lib/image-generator.ts.
type renderRequest struct {
	Source  string         `json:"source"`
	Format  string         `json:"format"`
	Options map[string]any `json:"options"`
}

// Render POSTs the HTML and returns the image bytes. Network errors and
// not-awake-yet statuses are retried with capped exponential backoff until the
// deadline; other non-2xx responses are final (retrying a rejected payload
// won't help). Any failure surfaces as ErrRenderFailed so callers can handle
// one typed error.
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
		remaining := time.Until(deadline)
		if remaining <= 0 {
			break
		}

		respBytes, status, err := r.attempt(ctx, body, minDuration(r.attemptTimeout(), remaining))
		switch {
		case err != nil:
			lastErr = err
		case wakeRetryableStatuses[status]:
			lastErr = fmt.Errorf("html-to-image %d: %s", status, strings.TrimSpace(string(respBytes)))
		case status/100 != 2:
			return nil, fmt.Errorf("%w: html-to-image %d: %s",
				ErrRenderFailed, status, strings.TrimSpace(string(respBytes)))
		case len(respBytes) == 0:
			return nil, fmt.Errorf("%w: empty response", ErrRenderFailed)
		default:
			return respBytes, nil
		}

		wait := minDuration(delay, time.Until(deadline))
		if wait <= 0 {
			break
		}
		timer := time.NewTimer(wait)
		select {
		case <-ctx.Done():
			timer.Stop()
			return nil, fmt.Errorf("%w: %v", ErrRenderFailed, ctx.Err())
		case <-timer.C:
		}
		delay = minDuration(delay*2, maxRenderBackoff)
	}
	return nil, fmt.Errorf("%w: after retries: %v", ErrRenderFailed, lastErr)
}

// attempt performs one POST under its own deadline and returns the body and
// status. A transport error yields a zero status, which the caller treats as
// retryable.
func (r *HTMLToImageRenderer) attempt(ctx context.Context, body []byte, timeout time.Duration) ([]byte, int, error) {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, r.URL, bytes.NewReader(body))
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := r.Client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		// A truncated read mid-wake is transient; report it as retryable rather
		// than failing the whole render on one bad connection.
		return nil, 0, err
	}
	return respBytes, resp.StatusCode, nil
}

func (r *HTMLToImageRenderer) attemptTimeout() time.Duration {
	if r.AttemptTimeout > 0 {
		return r.AttemptTimeout
	}
	return defaultAttemptTimeout
}

func minDuration(a, b time.Duration) time.Duration {
	if a < b {
		return a
	}
	return b
}
