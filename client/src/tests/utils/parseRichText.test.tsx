import { describe, it, expect } from "vitest";
import { parseRichText } from "../../utils/parseRichText";
import React from "react";
import { render } from "@testing-library/react";

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
});
