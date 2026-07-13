package shim

import "strings"

// SafeDID turns a DID (the cache key) into a filename-safe, path-traversal-safe
// string. DIDs are the cache key because they are stable across handle renames;
// they are colon-delimited (did:plc:..., did:web:...). Colons are legal on disk
// but inconvenient and visually confusing in URLs, so they are replaced with
// dashes. Any path separator or traversal segment is also neutralized — the DID
// arrives from an untrusted upstream (indigo resolution of a URL path), so the
// resulting cache filename must never escape the cache directory.
func SafeDID(did string) string {
	if did == "" {
		return ""
	}
	did = strings.ReplaceAll(did, ":", "-")
	did = strings.ReplaceAll(did, "/", "-")
	did = strings.ReplaceAll(did, "\\", "-")
	// Collapse ".." so a crafted DID cannot form a parent-directory reference.
	did = strings.ReplaceAll(did, "..", "")
	return did
}
