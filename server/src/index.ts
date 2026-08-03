// Bun.serve + Hono server entrypoint.
//
// Bun owns the socket (Bun.serve); Hono is the HTTP router. This replaced the
// former Express + cors + cookie-session + express-rate-limit + express-validator
// stack (#316). The middleware those packages provided is now native Hono
// middleware: hono/cors, hono/cookie (signed, HMAC-SHA256), hono-rate-limiter,
// and @hono/zod-validator. Route handlers live in src/hono/* and the business
// logic stays in src/services/* (unchanged).
//
// Run with: bun run dev (or bun run start in production).

// Must stay the first import: it front-runs the @atproto/oauth-client-node
// import graph so an unpatched @atproto-labs/fetch-node fails with the actual
// cause rather than an undici stack trace. See the module for why.
import "#/lib/assert-fetch-node-patch";

import dns from "node:dns";

import { cors } from "hono/cors";
import { Hono } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import pino from "pino";

import { createDb, migrateToLatest } from "./database/db";
import { assertProductionBindHost, WILDCARD_HOSTS } from "./lib/assert-production-bind-host";
import { createBidirectionalResolver, createIdResolver } from "./lib/id-resolver";
import { createAuthHono } from "./hono/auth-routes";
import {
  createMessageHono,
  createNotificationHono,
  createProfileHono,
  createSettingsHono,
} from "./hono/message-routes";
import { sessionMiddleware, type SessionVars } from "./hono/session-middleware";

import type { Database } from "./database/db";
import type { IdResolver } from "@atproto/identity";
import type { OAuthClient } from "@atproto/oauth-client-node";
import type { BidirectionalResolver } from "./lib/id-resolver";

// Node.js on Windows hangs on DNS TXT record lookups via the system resolver,
// so point the built-in dns module at public nameservers before any resolver or
// OAuth client is created. Windows-only: under Node this rebinds the dns.resolve*
// family and leaves dns.lookup on getaddrinfo, but Bun routes dns.lookup through
// the same server list, so applying it everywhere makes the runtime forget every
// name the system resolver owns — container DNS included, which is how the
// Postgres hostname stopped resolving under the Bun runtime image.
if (process.platform === "win32") {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
}

import { createClient } from "#/auth/client";
import { env } from "#/lib/env";

function createLogger(): pino.Logger {
  const { AXIOM_TOKEN, AXIOM_DATASET } = env;
  // Defense-in-depth: redact paths known to carry user-authored content so a
  // future logger.info that logs a whole object can't leak PII to Axiom. The
  // per-request hot-path logs have already been trimmed/demoted (#319); this
  // catches anything that slips through. Paths use dot/bracket syntax (fast-redact).
  const redact = [
    "message", // message-service: logged objects sometimes carry the message text
    "updates.message",
    "updates.customPrompt",
    "*.message",
    "*.customPrompt",
  ];
  if (!AXIOM_TOKEN || !AXIOM_DATASET) {
    return pino({ name: "navyfragen", redact });
  }
  const transport = pino.transport({
    targets: [
      {
        target: "@axiomhq/pino",
        options: { dataset: AXIOM_DATASET, token: AXIOM_TOKEN },
        level: "info",
      },
      { target: "pino/file", options: { destination: 1 }, level: "info" },
    ],
  });
  return pino({ name: "navyfragen", redact }, transport);
}

// Application state passed to the router and elsewhere
export type AppContext = {
  db: Database;
  logger: pino.Logger;
  oauthClient: OAuthClient;
  resolver: BidirectionalResolver;
  idResolver: IdResolver;
};

class Server {
  constructor(
    public server: ReturnType<typeof Bun.serve>,
    public ctx: AppContext
  ) {}

  static async create(): Promise<Server> {
    const { NODE_ENV, HOST, PORT, DB_PATH, CLIENT_URL, RATE_LIMIT_MAX } = env;

    // Fail fast in production on a non-wildcard HOST before anything else runs
    // (see lib/assert-production-bind-host.ts for why — #298).
    assertProductionBindHost();
    const logger = createLogger();

    const db = await createDb(DB_PATH);
    await migrateToLatest(db);

    const oauthClient = await createClient(db);
    const baseIdResolver = createIdResolver();
    const resolver = createBidirectionalResolver(baseIdResolver);
    const ctx: AppContext = {
      db,
      logger,
      oauthClient,
      resolver,
      idResolver: baseIdResolver,
    };

    // Hono app — the four concerns the old Express middleware chain provided,
    // now native:
    const app = new Hono<{ Variables: SessionVars }>();

    // 1. CORS — replaces the `cors` Express middleware. credentials:true so the
    //    signed session cookie travels cross-origin to the client origin.
    app.use(
      "*",
      cors({
        origin: CLIENT_URL,
        allowHeaders: ["Content-Type", "Authorization"],
        allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        credentials: true,
        maxAge: 600,
      })
    );

    // 2. Per-IP rate limiting — replaces express-rate-limit. Honors the same
    //    RATE_LIMIT_MAX=0 disable flag used by the e2e overlay. hono-rate-limiter
    //    keys on x-forwarded-for when present (trust proxy), falling back to the
    //    socket address.
    if (RATE_LIMIT_MAX > 0) {
      app.use(
        "*",
        rateLimiter({
          windowMs: 60 * 1000,
          limit: RATE_LIMIT_MAX,
          standardHeaders: "draft-6",
          message: "Too many requests, please try again later.",
          // Trust the proxy hop (Caddy/Railway set x-forwarded-for). In local
          // dev there's no proxy header, so all requests share one bucket —
          // fine since local dev is single-user.
          keyGenerator: (c) => {
            const xff = c.req.header("x-forwarded-for");
            return xff ? xff.split(",")[0].trim() : "local";
          },
        })
      );
    }

    // 3. Signed-cookie session — replaces cookie-session. Populates c.var.session.
    app.use("*", sessionMiddleware);

    // No-store everywhere — matches the Express Cache-Control setter.
    app.use("*", async (c, next) => {
      await next();
      c.header("Cache-Control", "no-store");
    });

    // 4. Routes. Each domain is a Hono sub-app with Zod validators.
    app.route("/", createAuthHono(ctx));
    app.route("/", createMessageHono(ctx));
    app.route("/", createProfileHono(ctx));
    app.route("/", createSettingsHono(ctx));
    app.route("/", createNotificationHono(ctx));

    // 404 — matches the Express catch-all shape.
    app.notFound((c) =>
      c.json(
        { error: "Not Found", message: "The requested resource does not exist", status: 404 },
        404
      )
    );

    app.onError((err, c) => {
      logger.error({ err }, "unhandled error in hono app");
      return c.json({ error: "Internal Server Error" }, 500);
    });

    // Dual-stack bind — mirrors the old listenPreferringDualStack. Bun.serve
    // binds `::` as dual-stack; fall back to 0.0.0.0 where IPv6 is unavailable.
    const { server, boundHost } = await serveDualStack(PORT, HOST, app.fetch, logger);
    logger.info(`Server (${NODE_ENV}) running on http://${boundHost}:${PORT}`);

    return new Server(server, ctx);
  }

  async close(): Promise<void> {
    this.ctx.logger.info("sigint received, shutting down");
    // Bun.serve.stop(true) waits for in-flight connections before closing.
    this.server.stop(true);
    try {
      await this.ctx.db.destroy();
    } catch (err) {
      this.ctx.logger.error({ err }, "Failed to drain database pool");
    }
    this.ctx.logger.info("server closed");
  }
}

/**
 * Binds a wildcard HOST as "::" so one dual-stack listener serves IPv4 and IPv6,
 * because Railway's private network — the only way Caddy reaches this service —
 * is IPv6-only. Falls back to "0.0.0.0" where the network has no IPv6 at all
 * (every Docker bridge network in CI and local compose). A non-wildcard HOST is
 * bound verbatim so `HOST=127.0.0.1` still means loopback.
 */
async function serveDualStack(
  port: number,
  host: string,
  fetch: (req: Request) => Response | Promise<Response>,
  logger: pino.Logger
): Promise<{ server: ReturnType<typeof Bun.serve>; boundHost: string }> {
  const wildcard = WILDCARD_HOSTS.has(host);
  const tryHost = wildcard ? "::" : host;
  try {
    // Bun.serve resolves the bind synchronously — it throws if the port/host is
    // unavailable. The returned Server exposes .hostname/.port/.url for the
    // address actually bound (which is what we log).
    const server = Bun.serve({ port, hostname: tryHost, fetch });
    return { server, boundHost: server.hostname ?? tryHost };
  } catch (err) {
    if (!wildcard) throw err;
    logger.warn({ err, host }, "IPv6 wildcard bind failed, falling back to 0.0.0.0");
    const server = Bun.serve({ port, hostname: "0.0.0.0", fetch });
    return { server, boundHost: "0.0.0.0" };
  }
}

const run = async () => {
  const server = await Server.create();

  const onCloseSignal = async () => {
    setTimeout(() => process.exit(1), 10000).unref(); // Force shutdown after 10s
    await server.close();
    process.exit();
  };

  process.on("SIGINT", onCloseSignal);
  process.on("SIGTERM", onCloseSignal);
};

run();
