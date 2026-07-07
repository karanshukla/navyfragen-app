import { render } from "@testing-library/react";
import React from "react";
import { describe, it, expect } from "vitest";

import { parseRichText } from "../../utils/parseRichText";

describe("parseRichText", () => {
  it("returns null for empty string", () => {
    expect(parseRichText("")).toBeNull();
  });

  it("returns null for falsy input", () => {
    expect(parseRichText(undefined as any)).toBeNull();
  });

  it("renders plain text with no special tokens", () => {
    const result = parseRichText("hello world");
    const { container } = render(<>{result}</>);
    expect(container.textContent).toBe("hello world");
  });

  it("renders a mention segment as an anchor linking to bsky.app/profile", () => {
    const result = parseRichText("@alice.bsky.social");
    const { container } = render(<>{result}</>);
    const anchor = container.querySelector("a");
    expect(anchor).not.toBeNull();
    expect(anchor!.href).toContain("bsky.app/profile");
  });

  it("renders a link segment where text === url using toShortUrl", () => {
    const url = "https://example.com";
    const result = parseRichText(`[${url}](${url})`);
    const { container } = render(<>{result}</>);
    const anchor = container.querySelector("a");
    expect(anchor).not.toBeNull();
    expect(anchor!.href).toBe(url + "/");
  });

  it("renders a text segment that contains a domain as an auto-link", () => {
    const result = parseRichText("Visit example.com for more info");
    const { container } = render(<>{result}</>);
    const anchor = container.querySelector("a");
    expect(anchor).not.toBeNull();
    expect(anchor!.textContent).toContain("example.com");
  });

  it("renders text with no domain as plain text (no anchors)", () => {
    const result = parseRichText("just some text");
    const { container } = render(<>{result}</>);
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toBe("just some text");
  });

  it("prepends https:// to links without protocol", () => {
    const result = parseRichText("example.com/path");
    const { container } = render(<>{result}</>);
    const anchor = container.querySelector("a");
    expect(anchor!.href).toMatch(/^https:\/\//);
  });

  it("renders a link segment where text differs from url using text value", () => {
    const result = parseRichText("[Click here](https://example.com)");
    const { container } = render(<>{result}</>);
    const anchor = container.querySelector("a");
    expect(anchor).not.toBeNull();
    expect(anchor!.textContent).toBe("Click here");
    expect(anchor!.href).toContain("example.com");
  });

  it("renders a link segment with non-http url by prepending https://", () => {
    const result = parseRichText("[visit](example.com/page)");
    const { container } = render(<>{result}</>);
    const anchor = container.querySelector("a");
    expect(anchor).not.toBeNull();
    expect(anchor!.href).toMatch(/^https:\/\//);
  });

  it("safeUrlParse returns null for truly unparseable URL, toShortUrl falls back to original href", () => {
    // [://](://) produces a link token with text === url === "://"
    // new URL("https://://") throws → safeUrlParse returns null → toShortUrl returns "://" as-is
    const result = parseRichText("[://](://)");
    const { container } = render(<>{result}</>);
    const anchor = container.querySelector("a");
    expect(anchor).not.toBeNull();
    expect(anchor!.textContent).toBe("://");
  });

  it("toShortUrl truncates href over 80 chars when safeUrlParse returns null", () => {
    // "://" + 80 "x"s = 83 chars; new URL("https://://xxx...") throws → safeUrlParse returns null
    // toShortUrl falls back: length > 80 → slice(0,76) + "…"
    const longMalformed = "://" + "x".repeat(80);
    const mdText = `[${longMalformed}](${longMalformed})`;
    const result = parseRichText(mdText);
    const { container } = render(<>{result}</>);
    const anchor = container.querySelector("a");
    expect(anchor).not.toBeNull();
    expect(anchor!.textContent).toContain("…");
    expect(anchor!.textContent!.length).toBeLessThan(longMalformed.length);
  });

  it("renders unknown segment type (topic/hashtag) using raw text fallback", () => {
    // "#hashtag" is tokenized as type="topic" with raw="#hashtag" — falls through to the default push
    const result = parseRichText("#hashtag");
    const { container } = render(<>{result}</>);
    expect(container.textContent).toContain("#hashtag");
  });

  it("toShortUrl handles http:// protocol (not https://)", () => {
    // Tests the protocol === "http:" branch in safeUrlParse (line 16)
    const url = "http://a.com";
    const result = parseRichText(`[${url}](${url})`);
    const { container } = render(<>{result}</>);
    const anchor = container.querySelector("a");
    expect(anchor).not.toBeNull();
    expect(anchor!.href).toMatch(/^http:\/\//);
    expect(anchor!.textContent).toBe("a.com");
  });

  it("toShortUrl includes username in short URL (url.username truthy branch)", () => {
    // Tests the url.username ? ... : "" branch in toShortUrl (line 30)
    const url = "https://user@example.com";
    const result = parseRichText(`[${url}](${url})`);
    const { container } = render(<>{result}</>);
    const anchor = container.querySelector("a");
    expect(anchor).not.toBeNull();
    expect(anchor!.textContent).toContain("user@example.com");
  });

  it("toShortUrl includes username:password in short URL (url.password truthy branch)", () => {
    // Tests the url.password ? ":" + url.password : "" branch in toShortUrl (line 30)
    const url = "https://user:pass@example.com";
    const result = parseRichText(`[${url}](${url})`);
    const { container } = render(<>{result}</>);
    const anchor = container.querySelector("a");
    expect(anchor).not.toBeNull();
    expect(anchor!.textContent).toContain("user:pass@example.com");
  });

  it("toShortUrl includes query string in short URL (url.search truthy branch)", () => {
    // Tests the url.search.length > 1 ? url.search : "" branch (line 34)
    const url = "https://example.com?q=1";
    const result = parseRichText(`[${url}](${url})`);
    const { container } = render(<>{result}</>);
    const anchor = container.querySelector("a");
    expect(anchor).not.toBeNull();
    expect(anchor!.textContent).toContain("?q=1");
  });

  it("toShortUrl includes hash fragment in short URL (url.hash truthy branch)", () => {
    // Tests the url.hash.length > 1 ? url.hash : "" branch (line 35)
    const url = "https://example.com#section";
    const result = parseRichText(`[${url}](${url})`);
    const { container } = render(<>{result}</>);
    const anchor = container.querySelector("a");
    expect(anchor).not.toBeNull();
    expect(anchor!.textContent).toContain("#section");
  });

  it("renders a bare url in text as an autolink using toShortUrl", () => {
    const result = parseRichText("https://example.com");
    const { container } = render(<>{result}</>);
    const anchor = container.querySelector("a");
    expect(anchor).not.toBeNull();
    expect(anchor!.href).toBe("https://example.com/");
    expect(anchor!.textContent).toBe("example.com");
  });

  it("renders bold markdown as a strong element", () => {
    const result = parseRichText("**bold**");
    const { container } = render(<>{result}</>);
    expect(container.querySelector("strong")?.textContent).toBe("bold");
  });

  it("renders italic markdown as an em element", () => {
    const result = parseRichText("*italic*");
    const { container } = render(<>{result}</>);
    expect(container.querySelector("em")?.textContent).toBe("italic");
  });

  it("renders underline markdown as a u element", () => {
    const result = parseRichText("__underline__");
    const { container } = render(<>{result}</>);
    expect(container.querySelector("u")?.textContent).toBe("underline");
  });

  it("renders strikethrough markdown as a del element", () => {
    const result = parseRichText("~~strike~~");
    const { container } = render(<>{result}</>);
    expect(container.querySelector("del")?.textContent).toBe("strike");
  });

  it("renders inline code markdown as a code element", () => {
    const result = parseRichText("`code`");
    const { container } = render(<>{result}</>);
    expect(container.querySelector("code")?.textContent).toBe("code");
  });

  it("renders an escaped character as its literal value", () => {
    const result = parseRichText("\\*hi\\*");
    const { container } = render(<>{result}</>);
    expect(container.textContent).toBe("*hi*");
  });
});
