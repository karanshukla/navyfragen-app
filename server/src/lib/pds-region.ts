/* v8 ignore start */
// Bluesky's own PDS infrastructure is US-hosted (bsky.network on AWS us-east-2,
// plus the legacy bsky.social). Self-hosted and unknown PDSes default to EU.
export function pdsRegion(pdsUrl: string): "us" | "eu" {
  /* v8 ignore stop */
  try {
    const host = new URL(pdsUrl).hostname;
    if (host === "bsky.social" || host === "bsky.network" || host.endsWith(".bsky.network")) {
      return "us";
    }
  } catch {
    /* invalid URL */
  }
  return "eu";
}
