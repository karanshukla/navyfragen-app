/* v8 ignore start */
// Bluesky's production PDS infrastructure runs on bsky.network (AWS us-east-2)
// and the legacy bsky.social PDS. Self-hosted or unknown PDS defaults to EU.
export function pdsRegion(pdsUrl: string): "us" | "eu" {
  /* v8 ignore stop */
  try {
    const host = new URL(pdsUrl).hostname;
    if (host === "bsky.social" || host === "bsky.network" || host.endsWith(".bsky.network")) {
      return "us";
    }
  } catch {
    /* invalid URL — default to eu */
  }
  return "eu";
}
