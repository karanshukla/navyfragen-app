// Bluesky's production PDS infrastructure runs on bsky.network (AWS us-east-2)
// and the legacy bsky.social PDS. Self-hosted or unknown PDS defaults to EU.
const US_PDS_EXACT = new Set(["bsky.social"]);
const US_PDS_PARENTS = ["bsky.network"];

export function pdsRegion(pdsUrl: string): "us" | "eu" {
  try {
    const host = new URL(pdsUrl).hostname;
    if (
      US_PDS_EXACT.has(host) ||
      US_PDS_PARENTS.some((p) => host === p || host.endsWith("." + p))
    ) {
      return "us";
    }
  } catch {}
  return "eu";
}
