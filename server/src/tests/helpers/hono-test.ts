// Test helpers for exercising Hono route handlers without a real DB.
//
// The route handlers read the session from c.var.session (set by
// session-middleware in production). For tests we mount the sub-app with a
// small middleware that injects a session from a header, so a test can drive
// the real Hono dispatch (route matching, Zod validation, response shaping)
// while substituting mock services for the DB-backed ones.

import { Hono } from "hono";

import { SESSION_VAR, type SessionVars } from "#/hono/session-middleware";

import type { AppSessionData } from "#/auth/session";

/**
 * Builds a Hono app that injects a session from the `x-test-session` header
 * (a JSON string), then delegates to the given sub-app. Lets tests set the
 * session per-request without the signed-cookie machinery.
 */
export function withTestSession(subApp: Hono): Hono<{ Variables: SessionVars }> {
  const wrapper = new Hono<{ Variables: SessionVars }>();
  wrapper.use("*", async (c, next) => {
    const raw = c.req.header("x-test-session");
    if (raw) {
      try {
        c.set(SESSION_VAR, JSON.parse(raw) as AppSessionData);
      } catch {
        c.set(SESSION_VAR, null);
      }
    } else {
      c.set(SESSION_VAR, null);
    }
    await next();
  });
  wrapper.route("/", subApp);
  return wrapper;
}

/** Convenience: serialize a session for the x-test-session header. */
export function sessionHeader(session: AppSessionData | null): Record<string, string> {
  return { "x-test-session": JSON.stringify(session) };
}

export { SESSION_VAR };
