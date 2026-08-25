/** Escapes regex metacharacters so a catalog string can drop into a `RegExp` literally. */
export function escapeRegex(segment: string): string {
  return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Turns a catalog template function like
 * `touchpointTranslations.en.headline: (name) => \`Send ${name} an anonymous message\``
 * into a `RegExp` matching any argument, by rendering it once with a marker
 * token and locating that token in the result, so the regex tracks the
 * template's literal text without the caller re-typing it.
 */
export function regexFromTemplate(template: (arg: string) => string): RegExp {
  const marker = " REGEX_FROM_TEMPLATE_MARKER ";
  const rendered = template(marker);
  const markerIndex = rendered.indexOf(marker);
  const prefix = rendered.slice(0, markerIndex);
  const suffix = rendered.slice(markerIndex + marker.length);
  return new RegExp(`^${escapeRegex(prefix)}.+${escapeRegex(suffix)}$`);
}
