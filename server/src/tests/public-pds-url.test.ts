import assert from "node:assert";
import { describe, it } from "bun:test";

import { isPublicPdsUrl } from "../lib/public-pds-url";

describe("isPublicPdsUrl", () => {
  it("accepts a PDS addressed by a public domain name over TLS", () => {
    assert.strictEqual(isPublicPdsUrl("https://morel.us-east.host.bsky.network"), true);
  });

  it("accepts a self-hosted PDS on its own domain", () => {
    assert.strictEqual(isPublicPdsUrl("https://pds.example.social"), true);
  });

  it("rejects plain HTTP, which no real PDS serves", () => {
    assert.strictEqual(isPublicPdsUrl("http://pds.example.social"), false);
  });

  it("rejects a scheme that is not HTTP at all", () => {
    assert.strictEqual(isPublicPdsUrl("file:///etc/passwd"), false);
  });

  it("rejects an IPv4 literal", () => {
    assert.strictEqual(isPublicPdsUrl("https://10.0.0.5"), false);
  });

  it("rejects an IPv6 literal", () => {
    assert.strictEqual(isPublicPdsUrl("https://[::1]"), false);
  });

  it("rejects the cloud metadata address", () => {
    assert.strictEqual(isPublicPdsUrl("https://169.254.169.254"), false);
  });

  it("rejects a bare hostname with no dot in it", () => {
    assert.strictEqual(isPublicPdsUrl("https://localhost"), false);
  });

  it("rejects a Railway private-network name", () => {
    assert.strictEqual(isPublicPdsUrl("https://navyfragen-server.railway.internal"), false);
  });

  it("rejects an mDNS name regardless of case", () => {
    assert.strictEqual(isPublicPdsUrl("https://Printer.LOCAL"), false);
  });

  it("rejects a string that is not a URL", () => {
    assert.strictEqual(isPublicPdsUrl("not a url"), false);
  });
});
