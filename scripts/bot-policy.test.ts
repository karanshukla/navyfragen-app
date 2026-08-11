import assert from "node:assert";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "bun:test";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const policy = JSON.parse(readFileSync(join(repoRoot, "anubis", "botPolicy.json"), "utf8"));

const BROWSER_UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36";

/**
 * Anubis walks `bots` in order and takes the first rule that matches, so a test
 * that only checked "is there an ALLOW regex for this" would pass even when an
 * earlier CHALLENGE shadowed it. The `import` entry pulls in upstream's default
 * config, which only classifies non-Mozilla agents, so skipping it does not
 * change the verdict for a browser.
 */
function verdict(path: string, userAgent = BROWSER_UA): string {
  for (const rule of policy.bots) {
    if (rule.import) continue;
    if (rule.path_regex && !new RegExp(rule.path_regex).test(path)) continue;
    if (rule.user_agent_regex && !new RegExp(rule.user_agent_regex).test(userAgent)) continue;
    if (!rule.path_regex && !rule.user_agent_regex) continue;
    return rule.action;
  }
  return "ALLOW";
}

describe("anubis bot policy", () => {
  // The incident: a service worker precaching the build manifest had every
  // asset fetch challenged in turn. Each challenge issued its own Set-Cookie,
  // clobbering the previous one, and the challenge was then solved twice and
  // rejected the second time with double_spend.
  describe("static assets versus documents", () => {
    test("allows a content-hashed bundle", () => {
      assert.equal(verdict("/assets/index-DeIhOTij.js"), "ALLOW");
      assert.equal(verdict("/assets/index-CyAS1slt.css"), "ALLOW");
    });

    test("challenges an app route", () => {
      assert.equal(verdict("/"), "CHALLENGE");
      assert.equal(verdict("/messages"), "CHALLENGE");
    });

    test("allows the precached app shell", () => {
      assert.equal(verdict("/index.html"), "ALLOW");
    });

    test("challenges a profile path, which is what the OG shim answers", () => {
      assert.equal(verdict("/profile/someone.bsky.social"), "CHALLENGE");
    });
  });

  // The rot that caused this: the policy allowed /site.webmanifest, but
  // vite-plugin-pwa emits /manifest.webmanifest, so the real file was
  // challenged for as long as the stale rule sat there looking correct.
  describe("generated filenames", () => {
    test("allows the manifest vite-plugin-pwa actually emits", () => {
      assert.equal(verdict("/manifest.webmanifest"), "ALLOW");
    });

    test("allows the service worker", () => {
      assert.equal(verdict("/sw.js"), "ALLOW");
    });
  });

  test("allows every file shipped in client/public", () => {
    const publicDir = join(repoRoot, "client", "public");
    const challenged = readdirSync(publicDir).filter(
      (name) => verdict(`/${name}`) !== "ALLOW" && !name.endsWith(".html")
    );

    assert.deepEqual(challenged, []);
  });

  test("still allows the Bluesky card crawler by user agent", () => {
    assert.equal(verdict("/profile/someone.bsky.social", "Bluesky Cardyb/1.1"), "ALLOW");
  });

  test("keeps serving challenges as 200, which the SW guard depends on", () => {
    assert.equal(policy.status_codes.CHALLENGE, 200);
  });
});
