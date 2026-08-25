import { useMemo } from "react";

import { useLocale } from "./i18n";

/**
 * Locale-aware number formatter for counts and lengths rendered to the user
 * (badge counts, character counters, stat tiles). Memoised per locale so a
 * component doesn't construct a fresh `Intl.NumberFormat` on every render.
 */
export function useNumberFormat(): (value: number) => string {
  const locale = useLocale();
  return useMemo(() => {
    const formatter = new Intl.NumberFormat(locale);
    return (value: number) => formatter.format(value);
  }, [locale]);
}
