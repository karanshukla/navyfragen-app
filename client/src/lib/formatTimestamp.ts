/**
 * Absolute, timezone-qualified timestamp for a received question, formatted
 * in the caller's resolved `uiLocale`. Timezone stays the browser's — only
 * the formatting locale is a parameter.
 *
 * @see [formatTimestamp.test.ts](../tests/lib/formatTimestamp.test.ts): pins the
 * year, the zero-padded minutes, the timezone abbreviation, and a non-English
 * locale producing a genuinely different format.
 */
export function formatTimestamp(dateStr: string, locale: string): string {
  return new Date(dateStr).toLocaleString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}
