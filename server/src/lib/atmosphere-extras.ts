/**
 * Atmosphere apps the Aturi catalog does not carry.
 *
 * The catalog answers "which client can open this record", so it lists clients
 * rather than apps and stops at the 30 its authors curate. An account can
 * publish plenty it has never heard of — this repo's own owner writes
 * `app.rocksky.*` — and those would otherwise be invisible here.
 *
 * The bar for an entry is a profile page that actually exists and actually
 * renders the account: teal.fm and Statusphere both write records people have,
 * and neither is listed below, because the first is a pre-launch landing page
 * and the second redirects to a GitHub repo. A mark linking nowhere is worse
 * than no mark.
 *
 * Reverse-resolving the NSID through `@atproto/lexicon-resolver` would retire
 * this table, since an app's own domain is derivable from its namespace. It
 * yields a DID rather than a name and a profile URL, so it is a later job.
 *
 * @see [atmosphere-service.test.ts](../tests/atmosphere-service.test.ts):
 * "finds an app the Aturi catalog has never heard of".
 */
export interface ExtraApp {
  id: string;
  name: string;
  /** NSID prefixes that mean this account publishes to the app. */
  collectionPrefixes: string[];
  profileUrl: (handle: string) => string;
}

export const EXTRA_APPS: readonly ExtraApp[] = [
  {
    id: "rocksky",
    name: "Rocksky",
    collectionPrefixes: ["app.rocksky."],
    profileUrl: (handle) => `https://rocksky.app/profile/${handle}`,
  },
];
