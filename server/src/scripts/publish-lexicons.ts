/**
 * Publishes the app.navyfragen.message lexicon to the AT Protocol network.
 *
 * Run this once after setting up the DNS TXT record:
 *   _lexicon.navyfragen.app  TXT  "did=<your-DID>"
 *
 * Usage:
 *   LEXICON_AUTHORITY_HANDLE=you.bsky.social \
 *   LEXICON_AUTHORITY_PASSWORD=your-app-password \
 *   npm run publish-lexicons
 *
 * The DID printed by this script is what goes into the DNS TXT record.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { AtpAgent } from "@atproto/api";

async function main() {
  const handle = process.env.LEXICON_AUTHORITY_HANDLE;
  const password = process.env.LEXICON_AUTHORITY_PASSWORD;
  const pdsUrl = process.env.LEXICON_AUTHORITY_PDS ?? "https://bsky.social";

  if (!handle || !password) {
    console.error(
      "Error: LEXICON_AUTHORITY_HANDLE and LEXICON_AUTHORITY_PASSWORD must be set.\n" +
        "See the script header for usage."
    );
    process.exit(1);
  }

  const agent = new AtpAgent({ service: pdsUrl });
  await agent.login({ identifier: handle, password });

  const did = agent.did;
  console.log(`Logged in as ${handle} (${did})`);
  console.log(`\nDNS record to add:\n  _lexicon.navyfragen.app  TXT  "did=${did}"\n`);

  const lexiconPath = join(__dirname, "../../lexicons/message.json");
  const lexicon = JSON.parse(readFileSync(lexiconPath, "utf-8"));
  const nsid = lexicon.id as string;

  await agent.com.atproto.repo.putRecord({
    repo: did!,
    collection: "com.atproto.lexicon.schema",
    rkey: nsid,
    record: { $type: "com.atproto.lexicon.schema", ...lexicon },
    validate: false,
  });

  console.log(`Published ${nsid} → at://${did}/com.atproto.lexicon.schema/${nsid}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
