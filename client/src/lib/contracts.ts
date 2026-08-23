/**
 * Identifiers that outlive the brand.
 *
 * `STORAGE_PREFIX` names keys already written to users' localStorage; changing
 * it discards their saved state rather than migrating it. It does not follow
 * the app name — derive nothing here from `brand.ts`.
 */

export const STORAGE_PREFIX = "navyfragen";
