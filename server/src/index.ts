import dns from "node:dns";
import events from "node:events";

import cookieSession from "cookie-session";
import cors from "cors";
import express, { type Express } from "express";
import { rateLimit } from "express-rate-limit";
import pino from "pino";

import { createDb, migrateToLatest } from "./database/db";
import {
  createBidirectionalResolver,
  createIdResolver,
  BidirectionalResolver,
} from "./lib/id-resolver";

import type { Database } from "./database/db";
import type { IdResolver } from "@atproto/identity";
import type { OAuthClient } from "@atproto/oauth-client-node";
import type http from "node:http";

// Node.js on Windows hangs on DNS TXT record lookups via the system resolver.
// Force the built-in dns module to use public nameservers before any resolver
// or OAuth client is created.
dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

import { createClient } from "#/auth/client";
import { env } from "#/lib/env";
import { createRouter } from "#/routes";

function createLogger(): pino.Logger {
  const { AXIOM_TOKEN, AXIOM_DATASET } = env;
  if (!AXIOM_TOKEN || !AXIOM_DATASET) {
    return pino({ name: "navyfragen" });
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
  return pino({ name: "navyfragen" }, transport);
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
    const logger = createLogger();

    // Set up the SQLite database
    const db = createDb(DB_PATH);
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
    app.use(
      rateLimit({
        windowMs: 60 * 1000, // 1 minute
        max: 100,
        message: "Too many requests, please try again later.",
      })
    );

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

    // Bind our server to the port
    const server = app.listen(env.PORT, "::");
    await events.once(server, "listening");
    logger.info(`Server (${NODE_ENV}) running on port http://${HOST}:${PORT}`);

    return new Server(app, server, ctx);
  }

  async close() {
    this.ctx.logger.info("sigint received, shutting down");
    return new Promise<void>((resolve) => {
      this.server.close(() => {
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
