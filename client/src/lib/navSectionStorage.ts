import { readStoredJson, writeStoredJson } from "./safeLocalStorage";

/**
 * Which friend sections the user has collapsed, per account.
 *
 * Keyed by DID because two accounts on one device shouldn't share the choice.
 *
 * @see [navSectionStorage.test.ts](../tests/lib/navSectionStorage.test.ts):
 * pins the default-open behaviour and the unreadable-storage fallback.
 */

type CollapsedSections = Record<string, boolean>;

const key = (did: string) => `navyfragen_friends_sections_open_${did}`;

export function isSectionOpen(label: string, did: string): boolean {
  return readStoredJson<CollapsedSections>(key(did))?.[label] !== false;
}

export function setSectionOpen(label: string, open: boolean, did: string) {
  const stored = readStoredJson<CollapsedSections>(key(did)) ?? {};
  writeStoredJson(key(did), { ...stored, [label]: open });
}
