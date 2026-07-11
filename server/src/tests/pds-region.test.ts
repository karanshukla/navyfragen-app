/* v8 ignore start */
import assert from "node:assert";
import { test, describe } from "node:test";

import { pdsRegion } from "../lib/pds-region";
/* v8 ignore stop */

describe("pdsRegion", () => {
  test("returns us for bsky.social", () => {
    assert.strictEqual(pdsRegion("https://bsky.social"), "us");
  });

  test("returns us for bsky.network subdomain", () => {
    assert.strictEqual(pdsRegion("https://shimeji.us-east.host.bsky.network"), "us");
  });

  test("returns eu for self-hosted PDS", () => {
    assert.strictEqual(pdsRegion("https://my-pds.example.com"), "eu");
  });

  test("returns eu for invalid URL", () => {
    assert.strictEqual(pdsRegion("not-a-url"), "eu");
  });

  test("returns eu for empty string", () => {
    assert.strictEqual(pdsRegion(""), "eu");
  });

  test("does not match partial bsky.social hostname", () => {
    assert.strictEqual(pdsRegion("https://notbsky.social"), "eu");
  });

  test("returns us for bsky.network base domain itself", () => {
    assert.strictEqual(pdsRegion("https://bsky.network"), "us");
  });
});
