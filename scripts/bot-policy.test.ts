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

// On 2026-08-30 a single host sprayed 254 distinct credential paths across 194
// spoofed user agents in 88 seconds. Roughly half were denied only because the
// spoofed agent happened to match an ai-* rule; the rest — .aws/credentials,
// gcloud/credentials.db, id_dsa, server.key — were handed a solvable
// proof-of-work challenge instead. Whether a credential probe is blocked must
// not depend on which user agent the scanner picked, so these rules match on
// path alone and sit ahead of every ALLOW.
describe("credential and CMS probes", () => {
  const SCANNER_UA =
    "Mozilla/5.0 (compatible; Claude-User/1.0; +https://www.anthropic.com/claude-user)";

  describe("dotenv files", () => {
    test("denies the .env family wherever it is nested", () => {
      for (const path of [
        "/.env",
        "/.env.bak",
        "/.env.old",
        "/.env.swp",
        "/.env.example",
        "/app/.env",
        "/v1/.env",
        "/backend/.env",
      ]) {
        assert.equal(verdict(path), "DENY", path);
      }
    });

    test("still allows the client metadata document the OAuth flow needs", () => {
      assert.equal(verdict("/client-metadata.json"), "ALLOW");
    });
  });

  describe("path traversal", () => {
    test("denies Vite @fs traversal and /proc reads", () => {
      for (const path of [
        "/@fs/../../../../../root/.env",
        "/@fs/proc/self/environ",
        "/@fs/proc/1/environ",
        "/@vite/env",
        "/uploads../.env",
        "/img../.env",
      ]) {
        assert.equal(verdict(path), "DENY", path);
      }
    });

    test("still allows a content-hashed bundle, which has no dot-dot in it", () => {
      assert.equal(verdict("/assets/index-DeIhOTij.js"), "ALLOW");
    });
  });

  describe("version control and CMS", () => {
    test("denies .git and WordPress probes, including doubled slashes", () => {
      for (const path of [
        "/.git/config",
        "//wp-includes/ID3/license.txt",
        "//blog/wp-includes/wlwmanifest.xml",
        "/wp/wp-login.php",
        "/wp-config.php",
        "//xmlrpc.php",
        "/config.php",
        "/config.php.bak",
      ]) {
        assert.equal(verdict(path), "DENY", path);
      }
    });

    test("still allows the sitemap, whose .xml the CMS rules must not claim", () => {
      assert.equal(verdict("/sitemap.xml"), "ALLOW");
      assert.equal(verdict("/robots.txt"), "ALLOW");
    });
  });

  describe("keys and cloud credentials", () => {
    test("denies key material and provider credential files", () => {
      for (const path of [
        "/id_dsa",
        "/id_rsa",
        "/private-key",
        "/server.key",
        "/@fs/proc/self/cwd/.aws/credentials",
        "/@fs/root/.config/gcloud/credentials.db",
        "/@fs/home/ubuntu/.anthropic/config.json",
        "/@fs/root/.openai/config.json",
        "/@fs/home/ubuntu/.oci/config",
        "/config/database.yml",
        "/config/secrets.yml",
        "/bootstrap.yml",
      ]) {
        assert.equal(verdict(path), "DENY", path);
      }
    });

    test("still allows the precached app shell", () => {
      assert.equal(verdict("/index.html"), "ALLOW");
      assert.equal(verdict("/manifest.webmanifest"), "ALLOW");
    });
  });

  // The scanner's whole point was rotating identities, so the verdict has to be
  // identical for a probe wearing a spoofed AI agent and one wearing a browser.
  test("denies a probe regardless of the user agent it wears", () => {
    assert.equal(verdict("/@fs/.env", SCANNER_UA), "DENY");
    assert.equal(verdict("/@fs/.env", "Bluesky Cardyb/1.1"), "DENY");
    assert.equal(verdict("/.aws/credentials", SCANNER_UA), "DENY");
  });

  // /.well-known/ is the one dotted prefix a future ATProto route would serve.
  test("does not deny .well-known, which is not a probe prefix", () => {
    assert.notEqual(verdict("/.well-known/atproto-did"), "DENY");
  });

  test("keeps every DENY rule ahead of the first ALLOW, so none can be shadowed", () => {
    const named = policy.bots.filter((rule: { import?: string }) => !rule.import);
    const lastDeny = named.findLastIndex((rule: { action: string }) => rule.action === "DENY");
    const firstAllow = named.findIndex((rule: { action: string }) => rule.action === "ALLOW");

    assert.ok(
      lastDeny < firstAllow,
      `DENY at ${lastDeny} must precede first ALLOW at ${firstAllow}`
    );
  });
});
