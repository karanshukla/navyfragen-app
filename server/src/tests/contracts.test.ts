import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "bun:test";

import { LEXICON_NSID, OAUTH_SCOPE } from "../lib/contracts";

const CLIENT_METADATA_PATH = join(import.meta.dir, "../../../client/public/client-metadata.json");

/**
 * The literal below is deliberate. Composing OAUTH_SCOPE from its parts must
 * reproduce the string users are already authorized against — a stray space or
 * a reordered term is a silent logout for everyone.
 */
const REGISTERED_SCOPE =
  "atproto repo:app.bsky.feed.post repo:app.navyfragen.message blob:image/* rpc:app.bsky.actor.getProfile?aud=* rpc:app.bsky.graph.getFollows?aud=*";

describe("OAuth contract", () => {
  it("composes the scope byte-for-byte as registered", () => {
    assert.strictEqual(OAUTH_SCOPE, REGISTERED_SCOPE);
  });

  it("declares in client-metadata.json exactly the scope the server requests", () => {
    const metadata = JSON.parse(readFileSync(CLIENT_METADATA_PATH, "utf8"));
    assert.strictEqual(metadata.scope, OAUTH_SCOPE);
  });

  it("names the collection that existing PDS records were written under", () => {
    assert.strictEqual(LEXICON_NSID, "app.navyfragen.message");
  });
});
