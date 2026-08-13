import { tokenize, type Token } from "@atcute/bluesky-richtext-parser";
import React from "react";

const WHITESPACE_REGEX = /^\s+|\s+$| +(?=\n)|\n(?=(?: *\n){2}) */g;
const TRIM_HOST_RE = /^www\./;

const MAX_DISPLAY_URL_LENGTH = 80;
const TRUNCATED_URL_LENGTH = 76;

const linkStyle: React.CSSProperties = {
  color: "inherit",
  fontWeight: "bold",
  textDecoration: "none",
};

const ensureProtocol = (href: string): string =>
  /^https?:\/\//.test(href) ? href : "https://" + href;

const safeUrlParse = (href: string): URL | null => {
  try {
    const url = new URL(ensureProtocol(href));
    /* istanbul ignore else */
    if (url.protocol === "https:" || url.protocol === "http:") {
      return url;
    }
  } catch {
    // Not a URL.
  }
  return null;
};

/**
 * A href the URL parser refused, shown as typed.
 *
 * @see [parseRichText.test.tsx](../tests/utils/parseRichText.test.tsx): pins the
 * length past which it is truncated rather than shown whole.
 */
const showUnparseableUrl = (href: string): string =>
  href.length > MAX_DISPLAY_URL_LENGTH ? href.slice(0, TRUNCATED_URL_LENGTH) + "…" : href;

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
  return showUnparseableUrl(href);
};

const renderTextWithAutolinks = (content: string, keyPrefix: string): React.ReactNode[] => {
  const bareDomainRegex = /((?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[\w\-._~:/?#[\]@!$&'()*+,;=]*)?)/g;
  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let keyOffset = 0;
  while ((match = bareDomainRegex.exec(content)) !== null) {
    const matchText = match[0];
    const start = match.index;

    if (start > lastIndex) {
      result.push(content.slice(lastIndex, start));
    }
    let href = matchText;
    // bareDomainRegex's segments require a literal "." before the TLD, so it can never
    // match starting at "http:" or "https:" (no dot before the colon) — matchText is
    // always the bare domain, so this guard's false arm is structurally unreachable.
    /* istanbul ignore else */
    if (!/^https?:\/\//.test(href)) {
      href = "https://" + href;
    }
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
      // @see [parseRichText.test.tsx](../tests/utils/parseRichText.test.tsx): pins
      // that a markdown link wrapping its own url shortens like a plain autolink.
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
