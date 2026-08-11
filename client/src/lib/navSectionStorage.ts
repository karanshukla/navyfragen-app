/**
 * Which friend sections the user has collapsed, per account.
 *
 * Keyed by DID because two accounts on one device shouldn't share the choice.
 * Every access is guarded: localStorage throws in private-browsing modes and a
 * collapsed-sections preference is never worth taking the sidebar down for.
 *
 * @see [navSectionStorage.test.ts](../tests/lib/navSectionStorage.test.ts):
 * pins the default-open behaviour and the unreadable-storage fallback.
 */

const key = (did: string) => `navyfragen_friends_sections_open_${did}`;

export function isSectionOpen(label: string, did: string): boolean {
  try {
    const raw = localStorage.getItem(key(did));
    if (!raw) return true;
    return JSON.parse(raw)[label] !== false;
  } catch {
    return true;
  }
}

export function setSectionOpen(label: string, open: boolean, did: string) {
  try {
    const raw = localStorage.getItem(key(did));
    const parsed = raw ? JSON.parse(raw) : {};
    localStorage.setItem(key(did), JSON.stringify({ ...parsed, [label]: open }));
  } catch {
    // localStorage unavailable (private browsing quota, etc.)
  }
}
