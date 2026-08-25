package shim

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/bluesky-social/indigo/api/atproto"
	"github.com/bluesky-social/indigo/api/bsky"
	"github.com/bluesky-social/indigo/xrpc"
)

// Profile is the slice of an AT Protocol actor profile, plus the owner's NF
// touchpoint settings, the shim needs to render an OG image. It is resolved by
// handle and keyed in the cache by DID.
type Profile struct {
	DID         string
	Handle      string
	DisplayName string
	Banner      string // empty → brand gradient fallback
	Avatar      string // empty → glyph fallback
	Prompt      string // owner's customPrompt; empty → resolved default (see resolvePrompt)
	Locale      string // owner's touchpointLocale; empty → English default
}

// NormalizedHandle returns the handle without a leading "@" — the template
// prepends its own "@".
func (p Profile) NormalizedHandle() string {
	return strings.TrimPrefix(p.Handle, "@")
}

// ToOGInput converts the profile to the template's input struct. Prompt/Locale
// pass through as-is — resolvePrompt (template.go) is what turns an unset
// Prompt into the right default, not this conversion.
func (p Profile) ToOGInput() OGInput {
	return OGInput{
		DisplayName: p.DisplayName,
		Handle:      p.NormalizedHandle(),
		Banner:      p.Banner,
		Avatar:      p.Avatar,
		Prompt:      p.Prompt,
		Locale:      p.Locale,
	}
}

// ProfileFetcher resolves a Bluesky handle to a full profile over the AT
// Protocol. The interface exists so the generator can be unit-tested with a
// fake. It is split in two so the cache lookup can happen between the cheap
// handle→DID resolve and the full profile read.
type ProfileFetcher interface {
	// ResolveDID maps a handle to its stable DID. This is the cache key.
	ResolveDID(ctx context.Context, handle string) (string, error)
	// FetchProfile reads the full profile (banner/avatar/displayName) by DID.
	FetchProfile(ctx context.Context, did string) (Profile, error)
}

// IndigoFetcher resolves handles and fetches profiles via
// bluesky-social/indigo against the AppView (https://api.bsky.app by default),
// matching the TS ProfileService's service URL exactly so the Go path sees the
// same view of the data.
type IndigoFetcher struct {
	Client *xrpc.Client
	// Settings reads the owner's customPrompt/touchpointLocale from the NF
	// server. Nil is a valid, supported state (composite-render and
	// indigo-fetch construct an IndigoFetcher without it) — FetchProfile then
	// leaves Prompt/Locale unset, which resolvePrompt turns into DefaultPrompt.
	Settings *NFSettingsClient
}

// NewIndigoFetcher constructs a fetcher pointing at host (the AppView). It has
// no NF settings client attached — set Settings separately (main.go does this)
// to enable customPrompt/touchpointLocale reads.
func NewIndigoFetcher(host string) *IndigoFetcher {
	if host == "" {
		host = DefaultAppViewHost
	}
	return &IndigoFetcher{Client: &xrpc.Client{Host: host}}
}

// DefaultAppViewHost matches server/src/services/profile-service.ts's
// AtpAgent service URL. Both implementations must target the same AppView.
const DefaultAppViewHost = "https://api.bsky.app"

// ResolveDID maps a handle to its DID via atproto.IdentityResolveHandle. An
// unresolvable handle surfaces as ErrProfileNotFound so the generator maps it
// to a 404.
func (f *IndigoFetcher) ResolveDID(ctx context.Context, handle string) (string, error) {
	handle = strings.TrimPrefix(handle, "@")
	resolved, err := atproto.IdentityResolveHandle(ctx, f.Client, handle)
	if err != nil {
		if isNotFound(err) {
			return "", ErrProfileNotFound
		}
		return "", err
	}
	return resolved.Did, nil
}

// FetchProfile reads the full profile by DID via bsky.ActorGetProfile, then —
// if a Settings client is attached — the owner's customPrompt/touchpointLocale
// from the NF server. The settings read can never fail this call: a Settings
// error or timeout leaves Prompt/Locale unset, and resolvePrompt (template.go)
// turns that into DefaultPrompt. [TestIndigoFetcher_FetchProfile_SettingsFailure_StillReturnsProfile]
// and [TestIndigoFetcher_FetchProfile_SettingsTimeout_StillReturnsProfile] pin
// both failure shapes.
func (f *IndigoFetcher) FetchProfile(ctx context.Context, did string) (Profile, error) {
	prof, err := bsky.ActorGetProfile(ctx, f.Client, did)
	if err != nil {
		if isNotFound(err) {
			return Profile{}, ErrProfileNotFound
		}
		return Profile{}, err
	}
	p := Profile{
		DID:         did,
		Handle:      prof.Handle,
		DisplayName: derefStr(prof.DisplayName),
		Banner:      derefStr(prof.Banner),
		Avatar:      derefStr(prof.Avatar),
	}
	if f.Settings != nil {
		if settings, err := f.Settings.FetchSettings(ctx, did); err == nil {
			p.Prompt = settings.CustomPrompt
			p.Locale = settings.TouchpointLocale
		}
	}
	return p, nil
}

// ErrProfileNotFound signals that a handle did not resolve (the AppView's
// XRPC ERROR 400 "Handle not found", or a 404 on the profile read). The
// generator maps this to an HTTP 404.
var ErrProfileNotFound = errors.New("profile not found")

func derefStr(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

// isNotFound reports whether err is an indigo/xrpc "not found" response.
// Resolving a nonexistent handle yields a 400 ("Unable to resolve handle") and
// a missing profile yields 400/404; both become ErrProfileNotFound.
func isNotFound(err error) bool {
	if err == nil {
		return false
	}
	var xe *xrpc.Error
	if errors.As(err, &xe) {
		return xe.StatusCode == 400 || xe.StatusCode == 404
	}
	// Non-xrpc errors (e.g. wrapped by a transport layer) still carry indigo's
	// "not found" / "Unable to resolve handle" text.
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "not found") || strings.Contains(msg, "unable to resolve handle")
}

// DefaultNFServerHost is the docker-compose-local address of the NF server.
// It is NOT production-correct — Railway has no "server" DNS name on its
// private network — so it must be overridden via NF_SERVER_URL in every
// deployed environment, the same way FRONTEND_URL and EXPORT_HTML_URL are
// (see opengraph-service/RAILWAY.md). Left unset in production, this name
// does not resolve; FetchSettings treats an unresolved-host error as
// terminal rather than retryable (see the DNS check in its retry loop), so
// the failure surfaces after a single attempt, not after the retry budget —
// FetchProfile's caller-side fallback keeps the card rendering in English
// with no added latency, never a broken or a slow card.
const DefaultNFServerHost = "http://server:3000"

// NFSettings is the subset of an owner's NF user_settings row the OG card
// needs: their prompt override and the locale their audience reads it in.
type NFSettings struct {
	CustomPrompt     string
	TouchpointLocale string
}

// nfPublicProfileResponse mirrors the JSON shape of the NF server's
// GET /public-profile/:did (server/src/hono/message-routes.ts, backed by
// ProfileService.getPublicProfile) — the same endpoint PublicProfile.tsx
// calls, so a prompt edit is visible to the card the moment it is visible to
// a visitor. Reused rather than a new route, per #400's note that the
// TypeScript route files are shared with #403's concurrent work.
type nfPublicProfileResponse struct {
	CustomPrompt     *string `json:"customPrompt"`
	TouchpointLocale *string `json:"touchpointLocale"`
}

// settingsWakeRetryableStatuses mirrors wakeRetryableStatuses (renderer.go):
// retry a not-awake-yet response, never a 4xx or 429. Declared separately
// rather than shared so the two callers' retry policies can diverge later
// without coupling; today they agree on purpose.
var settingsWakeRetryableStatuses = wakeRetryableStatuses

// defaultSettingsTimeout/defaultSettingsAttemptTimeout are shorter than the
// renderer's: this is a same-service JSON GET, not a cross-process headless
// render, so a generous budget here only delays the fallback a real outage
// would hit anyway.
const (
	defaultSettingsTimeout        = 6 * time.Second
	defaultSettingsAttemptTimeout = 3 * time.Second
	maxSettingsBackoff            = 1 * time.Second
)

// NFSettingsClient reads NFSettings from the NF server over HTTP. Shaped after
// HTMLToImageRenderer (renderer.go): retries are per-attempt-timeout bounded,
// not per-loop, so one hung connection cannot eat the whole deadline, and only
// 408/502/503/504 are retried — never 4xx or 429.
type NFSettingsClient struct {
	Host   string
	Client *http.Client
	// Timeout bounds the full retry loop; AttemptTimeout bounds one attempt.
	Timeout        time.Duration
	AttemptTimeout time.Duration
}

// NewNFSettingsClient constructs a client pointing at host (the NF server).
// timeout <= 0 falls back to defaultSettingsTimeout.
func NewNFSettingsClient(host string, timeout time.Duration) *NFSettingsClient {
	if host == "" {
		host = DefaultNFServerHost
	}
	if timeout <= 0 {
		timeout = defaultSettingsTimeout
	}
	attempt := defaultSettingsAttemptTimeout
	if timeout < attempt {
		attempt = timeout
	}
	return &NFSettingsClient{
		Host: strings.TrimSuffix(host, "/"),
		// No Client.Timeout — like HTMLToImageRenderer, it would bound the whole
		// loop rather than one attempt.
		Client:         &http.Client{},
		Timeout:        timeout,
		AttemptTimeout: attempt,
	}
}

// FetchSettings reads did's public settings. Network errors and
// not-awake-yet statuses are retried with capped exponential backoff until
// the deadline; any other failure (a 4xx, a malformed body) is returned
// immediately. Every error is the caller's cue to fall back to DefaultPrompt —
// FetchSettings itself never panics or blocks past its Timeout.
func (s *NFSettingsClient) FetchSettings(ctx context.Context, did string) (NFSettings, error) {
	url := fmt.Sprintf("%s/public-profile/%s", s.Host, did)

	deadline := time.Now().Add(s.Timeout)
	delay := 250 * time.Millisecond
	var lastErr error

	for {
		if ctxErr := ctx.Err(); ctxErr != nil {
			return NFSettings{}, fmt.Errorf("nf-settings: %w", ctxErr)
		}
		remaining := time.Until(deadline)
		if remaining <= 0 {
			break
		}

		respBytes, status, err := s.attempt(ctx, url, minDuration(s.attemptTimeout(), remaining))
		switch {
		case err != nil:
			// A DNS name that does not resolve is a permanent misconfiguration,
			// not a wake-shaped failure — no amount of retrying fixes it, and
			// every retry is dead latency stacked ahead of a cold render (the
			// same render that may also be waiting on html-to-image waking
			// Chromium). Everything else transport-level (connection refused,
			// connection reset, a timeout) still means "the service is
			// booting" and stays retryable below.
			// [TestNFSettingsClient_DNSResolutionFailure_IsNotRetried] pins this
			// alongside the wake-shaped-status and no-retry-on-4xx/429 cases.
			var dnsErr *net.DNSError
			if errors.As(err, &dnsErr) && dnsErr.IsNotFound {
				return NFSettings{}, fmt.Errorf("nf-settings: %w", err)
			}
			lastErr = err
		case settingsWakeRetryableStatuses[status]:
			lastErr = fmt.Errorf("nf-settings %d: %s", status, strings.TrimSpace(string(respBytes)))
		case status/100 != 2:
			return NFSettings{}, fmt.Errorf("nf-settings %d: %s", status, strings.TrimSpace(string(respBytes)))
		default:
			var body nfPublicProfileResponse
			if err := json.Unmarshal(respBytes, &body); err != nil {
				return NFSettings{}, fmt.Errorf("nf-settings: decode: %w", err)
			}
			return NFSettings{
				CustomPrompt:     derefStr(body.CustomPrompt),
				TouchpointLocale: derefStr(body.TouchpointLocale),
			}, nil
		}

		wait := minDuration(delay, time.Until(deadline))
		if wait <= 0 {
			break
		}
		timer := time.NewTimer(wait)
		select {
		case <-ctx.Done():
			timer.Stop()
			return NFSettings{}, fmt.Errorf("nf-settings: %w", ctx.Err())
		case <-timer.C:
		}
		delay = minDuration(delay*2, maxSettingsBackoff)
	}
	return NFSettings{}, fmt.Errorf("nf-settings: after retries: %v", lastErr)
}

// attempt performs one GET under its own deadline and returns the body and
// status. A transport error yields a zero status, which the caller treats as
// retryable — the same contract as HTMLToImageRenderer.attempt.
func (s *NFSettingsClient) attempt(ctx context.Context, url string, timeout time.Duration) ([]byte, int, error) {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, bytes.NewReader(nil))
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Accept", "application/json")

	resp, err := s.Client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, 0, err
	}
	return respBytes, resp.StatusCode, nil
}

func (s *NFSettingsClient) attemptTimeout() time.Duration {
	if s.AttemptTimeout > 0 {
		return s.AttemptTimeout
	}
	return defaultSettingsAttemptTimeout
}
