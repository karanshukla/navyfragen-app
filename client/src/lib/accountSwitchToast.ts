const SWITCHED_QUERY_PARAM = "accountSwitched";

export function buildAccountSwitchUrl(handle: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set(SWITCHED_QUERY_PARAM, handle);
  return url.pathname + url.search + url.hash;
}

/**
 * Reports the handle rather than a finished sentence: the copy belongs in the
 * catalog, and only a component can read the active `uiLocale` from it.
 */
export function consumeAccountSwitchToast(onSwitched: (handle: string) => void): void {
  const url = new URL(window.location.href);
  const handle = url.searchParams.get(SWITCHED_QUERY_PARAM);
  if (!handle) return;

  url.searchParams.delete(SWITCHED_QUERY_PARAM);
  window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  onSwitched(handle);
}
