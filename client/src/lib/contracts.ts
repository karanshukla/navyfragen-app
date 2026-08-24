/**
 * Identifiers that outlive the brand.
 *
 * `STORAGE_PREFIX` names keys already written to users' localStorage; changing
 * it discards their saved state rather than migrating it. It does not follow
 * the app name — derive nothing here from `brand.ts`.
 *
 * Tests spell these keys out as literals rather than importing this constant,
 * so that renaming it fails them instead of silently following it.
 *
 * @see [navSectionStorage.test.ts](../tests/lib/navSectionStorage.test.ts) and
 * [profileService.test.ts](../tests/profileService.test.ts): pin the two key
 * shapes built from this prefix.
 */

export const STORAGE_PREFIX = "navyfragen";
