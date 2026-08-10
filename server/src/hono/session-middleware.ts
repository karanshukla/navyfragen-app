import { getSignedCookie, setSignedCookie, deleteCookie } from "hono/cookie";
import { env } from "#/lib/env";
import type { Context, MiddlewareHandler } from "hono";
import type { AppSessionData } from "#/auth/session";

const SESSION_COOKIE = "nf-session";
const MAX_AGE_SECONDS = 14 * 24 * 60 * 60;

export const SESSION_VAR = "session";

export interface SessionVars {
  [SESSION_VAR]: AppSessionData | null;
}

/** A tampered or unreadable cookie yields null, i.e. logged out. */
export const sessionMiddleware: MiddlewareHandler = async (c, next) => {
  const data = await getSignedCookie(c, env.COOKIE_SECRET, SESSION_COOKIE);
  if (data === false) {
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

export function getSession(c: Context): AppSessionData | null {
  return (c.get(SESSION_VAR) as AppSessionData | null) ?? null;
}

export async function setSession(c: Context, session: AppSessionData): Promise<void> {
  c.set(SESSION_VAR, session);
  await setSignedCookie(c, SESSION_COOKIE, JSON.stringify(session), env.COOKIE_SECRET, {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearSession(c: Context): void {
  c.set(SESSION_VAR, null);
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}
