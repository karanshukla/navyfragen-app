// Signed-cookie session middleware. The session is stored in a single
// HMAC-SHA256 signed cookie read/written via Hono's cookie helpers, and
// surfaced through Hono context variables (c.var.session).
//
// Cookie-format note: this uses Hono's single `name=value.signature` SHA256
// cookie (nf-session). The former Express build used cookie-session + keygrip
// (dual navyfragen + navyfragen.sig cookies, SHA1). The two are NOT
// wire-compatible — the migration invalidated existing sessions, requiring a
// one-time re-login.

import { getSignedCookie, setSignedCookie, deleteCookie } from "hono/cookie";
import { env } from "#/lib/env";
import type { Context, MiddlewareHandler } from "hono";
import type { AppSessionData } from "#/auth/session";

const SESSION_COOKIE = "nf-session";
// 14 days, matching the former cookie-session maxAge.
const MAX_AGE = 14 * 24 * 60 * 60; // seconds (Hono cookie maxAge is in seconds)

export const SESSION_VAR = "session";

/** Variables we attach to the Hono context for typed access downstream. */
export interface SessionVars {
  [SESSION_VAR]: AppSessionData | null;
}

/**
 * Reads the signed session cookie on each request and stores it in
 * `c.var.session`. Tampered/unreadable cookies yield null (treated as logged
 * out) — matching cookie-session, which the controllers then null out.
 */
export const sessionMiddleware: MiddlewareHandler = async (c, next) => {
  const data = await getSignedCookie(c, env.COOKIE_SECRET, SESSION_COOKIE);
  if (data === false) {
    // Signature invalid / tampered → treat as no session.
    c.set(SESSION_VAR, null);
  } else if (typeof data === "string" && data.length > 0) {
    try {
      c.set(SESSION_VAR, JSON.parse(data) as AppSessionData);
    } catch {
      c.set(SESSION_VAR, null);
    }
  } else {
    c.set(SESSION_VAR, null);
  }
  await next();
};

/** Reads the current session from the context (never throws). */
export function getSession(c: Context): AppSessionData | null {
  return (c.get(SESSION_VAR) as AppSessionData | null) ?? null;
}

/** Overwrites the session in context AND persists it to the signed cookie. */
export async function setSession(c: Context, session: AppSessionData): Promise<void> {
  c.set(SESSION_VAR, session);
  await setSignedCookie(c, SESSION_COOKIE, JSON.stringify(session), env.COOKIE_SECRET, {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    maxAge: MAX_AGE,
  });
}

/** Clears the session cookie and the context variable (logout). */
export function clearSession(c: Context): void {
  c.set(SESSION_VAR, null);
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}
