/**
 * Identifiers that outlive the brand.
 *
 * These are on the wire, not on the page. `LEXICON_NSID` names records already
 * written to users' PDSes, and `OAUTH_SCOPE` must match the `scope` in
 * `client/public/client-metadata.json` byte for byte or every login fails.
 * Renaming the app does not rename these — derive nothing here from
 * `brand.ts`.
 *
 * @see [contracts.test.ts](../tests/contracts.test.ts): pins `OAUTH_SCOPE`
 * against the published client metadata.
 */

export const LEXICON_NSID = "app.navyfragen.message";

export const OAUTH_SCOPE = [
  "atproto",
  "repo:app.bsky.feed.post",
  `repo:${LEXICON_NSID}`,
  "blob:image/*",
  "rpc:app.bsky.actor.getProfile?aud=*",
  "rpc:app.bsky.graph.getFollows?aud=*",
].join(" ");
