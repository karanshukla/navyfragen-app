// Bun.serve + Hono entrypoint — Express→Bun spike for #316 (auth path only).
//
// This mirrors Server.create() in src/index.ts (DNS patch, env, logger, DB,
// OAuth client, resolvers, production bind guard, dual-stack bind, graceful
// shutdown) but mounts a Hono app on Bun.serve instead of Express. Only the
// auth path is wired (login/session/logout/switchAccount) plus CORS, a signed
// session cookie, per-IP rate limiting, and Zod request validation — exactly
// the four pieces issue #316's option-B spike asks to prove.
//
// Run with: bun run start:hono  (or dev:hono for watch mode)

// Must stay the first import — see src/lib/assert-fetch-node-patch.ts.
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
import type { AppContext } from "./index";

// Windows DNS workaround — same comment as index.ts.
if (process.platform === "win32") {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
}

import { createClient } from "#/auth/client";
import { env } from "#/lib/env";

function createLogger(): pino.Logger {
  const { AXIOM_TOKEN, AXIOM_DATASET } = env;
  const redact = [
    "message",
    "req.body.message",
    "req.body.customPrompt",
    "req.body.original",
    "req.body.response",
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

class HonoServer {
  constructor(
    public server: ReturnType<typeof Bun.serve>,
    public ctx: AppContext
  ) {}

  static async create(): Promise<HonoServer> {
    const { NODE_ENV, HOST, PORT, DB_PATH, CLIENT_URL, RATE_LIMIT_MAX } = env;

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

    // Hono app — the four auth-path concerns #316 lists, now native:
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
    //    keys on c.req.header("x-forwarded-for") when present (trust proxy),
    //    falling back to the socket address.
    if (RATE_LIMIT_MAX > 0) {
      app.use(
        "*",
        rateLimiter({
          windowMs: 60 * 1000,
          limit: RATE_LIMIT_MAX,
          standardHeaders: "draft-6",
          message: "Too many requests, please try again later.",
          // trust the proxy hop (Railway/Caddy) — mirrors Express's
          // app.set("trust proxy", 1) + express-rate-limit's default keying.
          keyGenerator: (c) => {
            const xff = c.req.header("x-forwarded-for");
            if (xff) return xff.split(",")[0].trim();
            return c.req.raw.headers.get("x-real-ip") ?? "127.0.0.1";
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

    // 4. Routes. Auth first (login/session/logout/switch/oauth/e2e), then the
    //    remaining domains — each a Hono sub-app with Zod validators.
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

    // Dual-stack bind — mirrors listenPreferringDualStack in index.ts. Bun.serve
    // binds `::` as dual-stack; fall back to 0.0.0.0 where IPv6 is unavailable.
    const { server, boundHost } = await serveDualStack(PORT, HOST, app.fetch, logger);
    logger.info(`Hono server (${NODE_ENV}) running on http://${boundHost}:${PORT}`);

    return new HonoServer(server, ctx);
  }

  async close(): Promise<void> {
    this.ctx.logger.info("sigint received, shutting down");
    // Bun.serve.stop() waits for in-flight connections by default.
    this.server.stop(true);
    try {
      await this.ctx.db.destroy();
    } catch (err) {
      this.ctx.logger.error({ err }, "Failed to drain database pool");
    }
    this.ctx.logger.info("server closed");
  }
}

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
  const server = await HonoServer.create();
  const onCloseSignal = async () => {
    setTimeout(() => process.exit(1), 10000).unref();
    await server.close();
    process.exit();
  };
  process.on("SIGINT", onCloseSignal);
  process.on("SIGTERM", onCloseSignal);
};

run();
