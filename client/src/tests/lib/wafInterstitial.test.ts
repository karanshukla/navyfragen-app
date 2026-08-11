import { describe, it, expect } from "vitest";

import { isWafInterstitial } from "../../lib/wafInterstitial";

const ORIGIN = "https://navyfragen.app";
const CHALLENGE_TYPE = "text/html; charset=utf-8";

describe("isWafInterstitial", () => {
  // The pair that matters: on 2026-08-11 Anubis answered a precache fetch for
  // /assets/index-DeIhOTij.js with 200 text/html, and workbox cached the
  // challenge page as the app bundle. A navigation getting HTML is the normal
  // case and must stay cacheable.
  it("rejects an HTML body served for an asset URL", () => {
    expect(isWafInterstitial(`${ORIGIN}/assets/index-DeIhOTij.js`, CHALLENGE_TYPE)).toBe(true);
  });

  it("accepts an HTML body served for a document URL", () => {
    expect(isWafInterstitial(`${ORIGIN}/messages`, CHALLENGE_TYPE)).toBe(false);
  });

  it("accepts an asset URL served with its own content type", () => {
    expect(isWafInterstitial(`${ORIGIN}/assets/index-DeIhOTij.js`, "text/javascript")).toBe(false);
  });

  it.each([
    ["stylesheet", "/assets/index-CyAS1slt.css"],
    ["web manifest", "/manifest.webmanifest"],
    ["service worker", "/sw.js"],
    ["icon", "/android-chrome-192x192.png"],
    ["json", "/client-metadata.json"],
    ["font", "/assets/inter.woff2"],
  ])("rejects an HTML body served for a %s", (_label, path) => {
    expect(isWafInterstitial(`${ORIGIN}${path}`, CHALLENGE_TYPE)).toBe(true);
  });

  it("treats the app shell as a document, since HTML is what it should return", () => {
    expect(isWafInterstitial(`${ORIGIN}/index.html`, CHALLENGE_TYPE)).toBe(false);
  });

  it("ignores a query string when reading the extension", () => {
    expect(isWafInterstitial(`${ORIGIN}/sw.js?v=2`, CHALLENGE_TYPE)).toBe(true);
  });

  it("matches the content type case-insensitively", () => {
    expect(isWafInterstitial(`${ORIGIN}/sw.js`, "TEXT/HTML")).toBe(true);
  });

  it("accepts a response with no content type at all", () => {
    expect(isWafInterstitial(`${ORIGIN}/sw.js`, null)).toBe(false);
  });
});
