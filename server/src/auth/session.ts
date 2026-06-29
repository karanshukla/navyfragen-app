import "cookie-session";

/**
 * A remembered account entry cached in the browser session so the account
 * switcher can render without fetching every profile on each page load.
 * The active account's entry is refreshed on every `/session` call.
 */
export interface AccountEntry {
  did: string;
  handle?: string;
  displayName?: string;
  avatar?: string;
}

export interface AppSessionData {
  /** DID of the currently active account. */
  did?: string;
  /** All accounts authenticated in this browser session. */
  accounts?: AccountEntry[];
  oauthState?: string;
}

/** Maximum number of accounts kept in a single browser session. */
export const MAX_ACCOUNTS = 5;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      session: AppSessionData | null;
    }
  }
}

/** Returns the remembered accounts (never undefined). */
export function getAccounts(session: AppSessionData | null): AccountEntry[] {
  return Array.isArray(session?.accounts) ? (session!.accounts as AccountEntry[]) : [];
}

/** Finds a remembered account by DID. */
export function findAccount(session: AppSessionData | null, did: string): AccountEntry | undefined {
  return getAccounts(session).find((a) => a.did === did);
}

/**
 * Inserts or refreshes an account entry. Existing entries are merged so cached
 * handle/displayName/avatar are refreshed when fresh data is available.
 * When at capacity the oldest entry is dropped.
 */
export function upsertAccount(session: AppSessionData, entry: AccountEntry): void {
  if (!session) return;
  if (!Array.isArray(session.accounts)) {
    session.accounts = [];
  }
  const idx = session.accounts.findIndex((a) => a.did === entry.did);
  if (idx >= 0) {
    session.accounts[idx] = { ...session.accounts[idx], ...entry };
    return;
  }
  if (session.accounts.length >= MAX_ACCOUNTS) {
    session.accounts.shift();
  }
  session.accounts.push(entry);
}

/** Removes a remembered account by DID (no-op if absent). */
export function removeAccount(session: AppSessionData | null, did: string): void {
  if (!session || !Array.isArray(session.accounts)) return;
  session.accounts = session.accounts.filter((a) => a.did !== did);
}

/** Maps a full profile (from getProfile) to the minimal cached entry. */
export function toAccountEntry(profile: {
  did: string;
  handle?: string;
  displayName?: string;
  avatar?: string;
}): AccountEntry {
  return {
    did: profile.did,
    handle: profile.handle,
    displayName: profile.displayName || undefined,
    avatar: profile.avatar || undefined,
  };
}
