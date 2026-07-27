// Must stay the first import: it front-runs the @atproto/oauth-client-node
// import graph so an unpatched @atproto-labs/fetch-node fails with the actual
// cause rather than an undici stack trace. See the module for why.
import "#/lib/assert-fetch-node-patch";

import dns from "node:dns";
import events from "node:events";

import cookieSession from "cookie-session";
import cors from "cors";
import express, { type Express } from "express";
import { rateLimit } from "express-rate-limit";
import pino from "pino";

import { createDb, migrateToLatest } from "./database/db";
import { assertProductionBindHost, WILDCARD_HOSTS } from "./lib/assert-production-bind-host";
import {
  createBidirectionalResolver,
  createIdResolver,
  BidirectionalResolver,
} from "./lib/id-resolver";

import type { Database } from "./database/db";
import type { IdResolver } from "@atproto/identity";
import type { OAuthClient } from "@atproto/oauth-client-node";
import type http from "node:http";

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
import { createRouter } from "#/routes";

function createLogger(): pino.Logger {
  const { AXIOM_TOKEN, AXIOM_DATASET } = env;
  // Defense-in-depth: redact paths known to carry user-authored content so a
  // future logger.info that logs a whole object can't leak PII to Axiom. The
  // per-request hot-path logs have already been trimmed/demoted (#319); this
  // catches anything that slips through. Paths use dot/bracket syntax (fast-redact).
  const redact = [
    "message", // message-service: logged objects sometimes carry the message text
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
      {
        target: "pino/file",
        options: { destination: 1 },
        level: "info",
      },
    ],
  });
  return pino({ name: "navyfragen", redact }, transport);
}

async function listenOn(app: Express, port: number, host: string): Promise<http.Server> {
  const server = app.listen(port, host);
  try {
    await events.once(server, "listening");
    return server;
  } catch (err) {
    server.close();
    throw err;
  }
}

/**
 * Binds a wildcard HOST as "::" so one dual-stack listener serves IPv4 and IPv6,
 * because Railway's private network — the only way Caddy reaches this service —
 * is IPv6-only. Falls back to "0.0.0.0" where the network has no IPv6 at all,
 * which is every Docker bridge network in CI and local compose; Bun reports that
 * as a spurious EADDRINUSE (errno 0) rather than degrading the way Node does.
 * A non-wildcard HOST is bound verbatim so `HOST=127.0.0.1` still means loopback.
 */
async function listenPreferringDualStack(
  app: Express,
  port: number,
  host: string,
  logger: pino.Logger
): Promise<{ server: http.Server; boundHost: string }> {
  if (!WILDCARD_HOSTS.has(host)) {
    return { server: await listenOn(app, port, host), boundHost: host };
  }
  try {
    return { server: await listenOn(app, port, "::"), boundHost: "::" };
  } catch (err) {
    logger.warn({ err, host }, "IPv6 wildcard bind failed, falling back to 0.0.0.0");
    return { server: await listenOn(app, port, "0.0.0.0"), boundHost: "0.0.0.0" };
  }
}

// Application state passed to the router and elsewhere
export type AppContext = {
  db: Database;
  logger: pino.Logger;
  oauthClient: OAuthClient;
  resolver: BidirectionalResolver;
  idResolver: IdResolver;
};

export class Server {
  constructor(
    public app: express.Application,
    public server: http.Server,
    public ctx: AppContext
  ) {}

  static async create() {
    const { NODE_ENV, HOST, PORT, DB_PATH } = env;

    // Fail fast in production on a non-wildcard HOST before anything else runs:
    // a loopback bind boots "healthy" but is unreachable from Caddy over
    // Railway's private network, with no error signal in the server's own logs
    // (#298). No-op outside production so local loopback testing is unaffected.
    assertProductionBindHost();

    const logger = createLogger();

    // Set up the SQLite database
    const db = await createDb(DB_PATH);
    await migrateToLatest(db);

    // Create the atproto utilities
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

    // Create our server
    const app: Express = express();
    app.set("trust proxy", 1);
    app.disable("x-powered-by");

    // Enable CORS for the frontend client
    app.use(
      cors({
        origin: env.CLIENT_URL,
        credentials: true,
      })
    );

    // Enable cookie-session
    app.use(
      cookieSession({
        name: "navyfragen",
        keys: [env.COOKIE_SECRET],
        maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
      })
    );

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    // RATE_LIMIT_MAX=0 disables rate limiting (used by the e2e overlay so a
    // large Playwright suite doesn't trip the per-IP cap).
    if (env.RATE_LIMIT_MAX > 0) {
      app.use(
        rateLimit({
          windowMs: 60 * 1000, // 1 minute
          max: env.RATE_LIMIT_MAX,
          message: "Too many requests, please try again later.",
        })
      );
    }

    app.use((_req, res, next) => {
      res.set("Cache-Control", "no-store");
      next();
    });

    const router = createRouter(ctx);
    app.use(router);

    app.use((_req, res) => {
      res.status(404).json({
        error: "Not Found",
        message: "The requested resource does not exist",
        status: 404,
      });
    });

    const { server, boundHost } = await listenPreferringDualStack(app, PORT, HOST, logger);
    logger.info(`Server (${NODE_ENV}) running on port http://${boundHost}:${PORT}`);

    return new Server(app, server, ctx);
  }

  async close() {
    this.ctx.logger.info("sigint received, shutting down");
    return new Promise<void>((resolve) => {
      this.server.close(async () => {
        // Drain the Postgres pool (no-op for SQLite) so in-flight queries
        // settle and connections close before the process exits. `destroy()`
        // rejects any new queries, so it must run after the HTTP server stops
        // accepting connections.
        try {
          await this.ctx.db.destroy();
        } catch (err) {
          this.ctx.logger.error({ err }, "Failed to drain database pool");
        }
        this.ctx.logger.info("server closed");
        resolve();
      });
    });
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
