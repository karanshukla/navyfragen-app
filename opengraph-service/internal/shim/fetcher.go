package shim

import (
	"context"
	"errors"
	"strings"

	"github.com/bluesky-social/indigo/api/atproto"
	"github.com/bluesky-social/indigo/api/bsky"
	"github.com/bluesky-social/indigo/xrpc"
)

// Profile is the slice of an AT Protocol actor profile the shim needs to render
// an OG image. It is resolved by handle and keyed in the cache by DID.
type Profile struct {
	DID         string
	Handle      string
	DisplayName string
	Banner      string // empty → brand gradient fallback
	Avatar      string // empty → glyph fallback
}

// NormalizedHandle returns the handle without a leading "@" — the template
// prepends its own "@".
func (p Profile) NormalizedHandle() string {
	return strings.TrimPrefix(p.Handle, "@")
}

// ToOGInput converts the profile to the template's input struct, defaulting the
// prompt to DefaultPrompt (issue #199 will later supply a custom prompt).
func (p Profile) ToOGInput() OGInput {
	return OGInput{
		DisplayName: p.DisplayName,
		Handle:      p.NormalizedHandle(),
		Banner:      p.Banner,
		Avatar:      p.Avatar,
		Prompt:      DefaultPrompt,
	}
}

// ProfileFetcher resolves a Bluesky handle to a full profile over the AT
// Protocol. The indigo-backed implementation is the production path; the
// interface exists so the generator can be unit-tested with a fake.
//
// It is split into two phases so the cache lookup can happen between them:
// ResolveDID is the cheap handle→DID lookup (always called); FetchProfile is
// the full profile read (skipped on a cache hit). This matches the task spec:
// "DID is resolved first, then cache check → on miss: indigo resolve +
// getProfile."
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
}

// NewIndigoFetcher constructs a fetcher pointing at host (the AppView).
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

// FetchProfile reads the full profile by DID via bsky.ActorGetProfile.
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

// isNotFound reports whether err is an indigo/xrpc "not found" response. The
// indigo client returns *xrpc.Error whose StatusCode is the HTTP status from
// the AppView. Handle resolution of a nonexistent handle yields a 400
// ("Unable to resolve handle"); a missing profile yields a 400/404. Both map to
// ErrProfileNotFound so the shim can return a 404 to the crawler.
func isNotFound(err error) bool {
	if err == nil {
		return false
	}
	// The concrete indigo type carries StatusCode as a field, not a method.
	var xe *xrpc.Error
	if errors.As(err, &xe) {
		return xe.StatusCode == 400 || xe.StatusCode == 404
	}
	// Fall back to a substring check for non-xrpc errors (e.g. a wrapped error
	// from a transport layer): indigo messages carry "not found" / "Unable to
	// resolve handle".
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "not found") || strings.Contains(msg, "unable to resolve handle")
}
