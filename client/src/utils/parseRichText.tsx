import React from "react";
import { tokenize } from "@atcute/bluesky-richtext-parser";

const WHITESPACE_REGEX = /^\s+|\s+$| +(?=\n)|\n(?=(?: *\n){2}) */g;
const TRIM_HOST_RE = /^www\./;
const PATH_MAX_LENGTH = 16;

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
  return null;
};

const toShortUrl = (href: string): string => {
  const url = safeUrlParse(href);
  if (url !== null) {
    const host =
      (url.username
        ? url.username + (url.password ? ":" + url.password : "") + "@"
        : "") + url.host.replace(TRIM_HOST_RE, "");
    const path =
      (url.pathname === "/" ? "" : url.pathname) +
      (url.search.length > 1 ? url.search : "") +
      (url.hash.length > 1 ? url.hash : "");

    return host + path;
  }
  // If safeUrlParse returns null (e.g. for an invalid or non-http/s URL),
  // return the original href, or a shortened version if it's very long.
  if (href.length > 80) {
    return href.slice(0, 76) + "…";
  }
  return href;
};

export const parseRichText = (text: string): React.ReactNode => {
  if (!text) return null;
  const trimmedText = text.replace(WHITESPACE_REGEX, "");
  const segments = tokenize(trimmedText);
  const result: React.ReactNode[] = [];

  segments.forEach((segment: any, index: number) => {
    // Render mentions
    if (segment.type === "mention") {
      result.push(
        <a
          href={`https://bsky.app/profile/${segment.handle}`}
          target="_blank"
          rel="noopener noreferrer"
          key={index}
          style={{
            color: "inherit",
            fontWeight: "bold",
            textDecoration: "none",
          }}
        >
          {segment.raw}
        </a>
      );
      return;
    }
    // Render markdown/explicit links
    if (segment.type === "link") {
      let href = segment.url;
      if (!/^https?:\/\//.test(href)) {
        href = "https://" + href;
      }
      const displayText =
        segment.text === segment.url
          ? toShortUrl(segment.url)
          : segment.text.replace(WHITESPACE_REGEX, "");
      result.push(
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          key={index}
          style={{
            color: "inherit",
            fontWeight: "bold",
            textDecoration: "none",
          }}
        >
          {displayText}
        </a>
      );
      return;
    }

    if (segment.type === "text") {
      // Regex to match domains/short links
      const domainRegex =
        /((?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[\w\-._~:/?#[\]@!$&'()*+,;=]*)?)/g;
      let lastIndex = 0;
      let match;
      let text = segment.text;
      let keyOffset = 0;
      while ((match = domainRegex.exec(text)) !== null) {
        const matchText = match[0];
        const start = match.index;

        if (start > lastIndex) {
          result.push(text.slice(lastIndex, start));
        }
        let href = matchText;
        if (!/^https?:\/\//.test(href)) {
          href = "https://" + href;
        }
        result.push(
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            key={`${index}-domain-${keyOffset}`}
            style={{
              color: "inherit",
              fontWeight: "bold",
              textDecoration: "none",
            }}
          >
            {toShortUrl(matchText)}
          </a>
        );
        lastIndex = start + matchText.length;
        keyOffset++;
      }

      if (lastIndex < text.length) {
        result.push(text.slice(lastIndex));
      }
      return;
    }

    result.push(segment.text || segment.raw);
  });
  return result;
};
