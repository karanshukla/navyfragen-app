/**
 * Cached so the account switcher renders without refetching every profile.
 *
 * @see [session.test.ts](../tests/session.test.ts) — pins the merge-on-upsert
 * and capacity-eviction behaviour of the helpers below.
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

export const MAX_ACCOUNTS = 5;

export function getAccounts(session: AppSessionData | null): AccountEntry[] {
  return Array.isArray(session?.accounts) ? (session!.accounts as AccountEntry[]) : [];
}

export function findAccount(session: AppSessionData | null, did: string): AccountEntry | undefined {
  return getAccounts(session).find((a) => a.did === did);
}

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

export function removeAccount(session: AppSessionData | null, did: string): void {
  if (!session || !Array.isArray(session.accounts)) return;
  session.accounts = session.accounts.filter((a) => a.did !== did);
}

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
