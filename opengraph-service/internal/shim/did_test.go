package shim

import "testing"

// SafeDID turns a DID (the cache key) into a filename-safe string. DIDs contain
// colons (did:plc:..., did:web:...) which are legal on disk but inconvenient
// and visually confusing in paths. Any attempt to escape the cache directory via
// ".." or "/" must be neutralized — a DID comes from an untrusted upstream
// (indigo resolution), so the cache filename is an untrusted input.

func TestSafeDID_PLC(t *testing.T) {
	if got := SafeDID("did:plc:abcdef123"); got != "did-plc-abcdef123" {
		t.Fatalf("got %q", got)
	}
}

func TestSafeDID_Web(t *testing.T) {
	if got := SafeDID("did:web:example.com"); got != "did-web-example.com" {
		t.Fatalf("got %q", got)
	}
}

func TestSafeDID_StripsParentTraversal(t *testing.T) {
	// A malicious or malformed DID must not be able to break out of the cache dir.
	got := SafeDID("../../etc/passwd")
	if got == "../../etc/passwd" {
		t.Fatalf("traversal unchanged: %q", got)
	}
	for _, bad := range []string{"/", "\\", ".."} {
		if contains(got, bad) {
			t.Fatalf("SafeDID left %q in result %q", bad, got)
		}
	}
}

func TestSafeDID_Empty(t *testing.T) {
	if got := SafeDID(""); got != "" {
		t.Fatalf("empty input should map to empty, got %q", got)
	}
}

func contains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
