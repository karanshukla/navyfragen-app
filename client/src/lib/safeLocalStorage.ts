/**
 * JSON-in-localStorage that answers "absent" instead of throwing.
 *
 * Every browser storage API throws outright in private-browsing modes and once
 * a quota is exhausted, and nothing this app keeps there — a friends cache, a
 * collapsed-section preference — is worth taking a page down for.
 *
 * @see [safeLocalStorage.test.ts](../tests/lib/safeLocalStorage.test.ts): pins
 * that each operation survives a throwing store, and that an unparseable entry
 * reads as absent rather than propagating.
 */

export function readStoredJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeStoredJson(key: string, value: unknown): void {
  ignoringStorageFailure(() => localStorage.setItem(key, JSON.stringify(value)));
}

export function removeStored(key: string): void {
  ignoringStorageFailure(() => localStorage.removeItem(key));
}

function ignoringStorageFailure(write: () => void): void {
  try {
    write();
  } catch {
    // Unwritable storage is not worth reporting.
  }
}
