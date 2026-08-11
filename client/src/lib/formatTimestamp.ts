/**
 * Absolute, timezone-qualified timestamp for a received question.
 *
 * @see [formatTimestamp.test.ts](../tests/lib/formatTimestamp.test.ts): pins the
 * year, the zero-padded minutes, and the timezone abbreviation.
 */
export function formatTimestamp(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}
