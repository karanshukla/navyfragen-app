import { tokenize, type Token } from "@atcute/bluesky-richtext-parser";
import React from "react";

const WHITESPACE_REGEX = /^\s+|\s+$| +(?=\n)|\n(?=(?: *\n){2}) */g;
const TRIM_HOST_RE = /^www\./;

const linkStyle: React.CSSProperties = {
  color: "inherit",
  fontWeight: "bold",
  textDecoration: "none",
};

const safeUrlParse = (href: string): URL | null => {
  try {
    let fullHref = href;
    if (!/^https?:\/\//.test(href)) {
      fullHref = "https://" + href;
    }
    const url = new URL(fullHref);
    const protocol = url.protocol;
    if (protocol === "https:" || protocol === "http:") {
      return url;
    }
  } catch (e) {
    // Ignore errors from URL parsing, it'll just return null
  }
  /* v8 ignore next */
  return null;
};

const toShortUrl = (href: string): string => {
  const url = safeUrlParse(href);
  if (url !== null) {
    const host =
      (url.username ? url.username + (url.password ? ":" + url.password : "") + "@" : "") +
      url.host.replace(TRIM_HOST_RE, "");
    const path =
      (url.pathname === "/" ? "" : url.pathname) +
      (url.search.length > 1 ? url.search : "") +
      (url.hash.length > 1 ? url.hash : "");

    return host + path;
  }
  // If safeUrlParse returns null (e.g. for an invalid or non-http/s URL),
  // return the original href, or a shortened version if it's very long.
  /* v8 ignore next 4 */
  if (href.length > 80) {
    return href.slice(0, 76) + "…";
  }
  return href;
};

const ensureProtocol = (href: string): string =>
  /^https?:\/\//.test(href) ? href : "https://" + href;

const renderTextWithAutolinks = (content: string, keyPrefix: string): React.ReactNode[] => {
  // Regex to match domains/short links
  const domainRegex = /((?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[\w\-._~:/?#[\]@!$&'()*+,;=]*)?)/g;
  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let keyOffset = 0;
  while ((match = domainRegex.exec(content)) !== null) {
    const matchText = match[0];
    const start = match.index;

    if (start > lastIndex) {
      result.push(content.slice(lastIndex, start));
    }
    let href = matchText;
    // domainRegex's segments require a literal "." before the TLD, so it can never
    // match starting at "http:" or "https:" (no dot before the colon) — matchText is
    // always the bare domain, so this guard's false arm is structurally unreachable.
    /* v8 ignore start */
    if (!/^https?:\/\//.test(href)) {
      href = "https://" + href;
    }
    /* v8 ignore stop */
    result.push(
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        key={`${keyPrefix}-domain-${keyOffset}`}
        style={linkStyle}
      >
        {toShortUrl(matchText)}
      </a>
    );
    lastIndex = start + matchText.length;
    keyOffset++;
  }

  if (lastIndex < content.length) {
    result.push(content.slice(lastIndex));
  }
  return result;
};

const renderTokens = (tokens: Token[], keyPrefix: string): React.ReactNode[] =>
  tokens.map((token, index) => renderToken(token, `${keyPrefix}-${index}`));

const renderToken = (token: Token, key: string): React.ReactNode => {
  switch (token.type) {
    case "mention":
      return (
        <a
          href={`https://bsky.app/profile/${token.handle}`}
          target="_blank"
          rel="noopener noreferrer"
          key={key}
          style={linkStyle}
        >
          {token.raw}
        </a>
      );

    case "autolink": {
      const href = ensureProtocol(token.url);
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" key={key} style={linkStyle}>
          {toShortUrl(token.url)}
        </a>
      );
    }

    case "link": {
      const href = ensureProtocol(token.url);
      // A markdown link whose single child's raw text is identical to the url
      // (e.g. `[https://example.com](https://example.com)`) is a bare-url link —
      // shorten its display text the same way a plain autolink would.
      const isBareUrlLink = token.children.length === 1 && token.children[0].raw === token.url;
      const displayText = isBareUrlLink
        ? toShortUrl(token.url)
        : renderTokens(token.children, `${key}-c`);
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" key={key} style={linkStyle}>
          {displayText}
        </a>
      );
    }

    case "strong":
      return <strong key={key}>{renderTokens(token.children, `${key}-c`)}</strong>;

    case "emphasis":
      return <em key={key}>{renderTokens(token.children, `${key}-c`)}</em>;

    case "underline":
      return <u key={key}>{renderTokens(token.children, `${key}-c`)}</u>;

    case "delete":
      return <del key={key}>{renderTokens(token.children, `${key}-c`)}</del>;

    case "code":
      return <code key={key}>{token.content}</code>;

    case "escape":
      return token.escaped;

    case "text":
      return renderTextWithAutolinks(token.content, key);

    /* v8 ignore next 2 */
    default:
      return token.raw;
  }
};

export const parseRichText = (text: string): React.ReactNode => {
  if (!text) return null;
  const trimmedText = text.replace(WHITESPACE_REGEX, "");
  const tokens = tokenize(trimmedText);
  return renderTokens(tokens, "t");
};
