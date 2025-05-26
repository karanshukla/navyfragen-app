import events from "node:events";
import type http from "node:http";
import express, { type Express } from "express";
import { pino } from "pino";
import type { OAuthClient } from "@atproto/oauth-client-node";
import { Firehose } from "@atproto/sync";
import { rateLimit } from "express-rate-limit";
import cors from "cors";

import { createDb, migrateToLatest } from "#/db";
import { env } from "#/lib/env";
import { createRouter } from "#/routes";
import { createClient } from "#/auth/client";
import {
  createBidirectionalResolver,
  createIdResolver,
  BidirectionalResolver,
} from "#/id-resolver";
import type { Database } from "#/db";
import { IdResolver, MemoryCache } from "@atproto/identity";
import { createFirehoseStream } from "./firehose";
import { ingestFirehoseMessages } from "./ingest";

// Application state passed to the router and elsewhere
export type AppContext = {
  db: Database;
  ingester?: Firehose;
  logger: pino.Logger;
  oauthClient: OAuthClient;
  resolver: BidirectionalResolver;
};

export class Server {
  constructor(
    public app: express.Application,
    public server: http.Server,
    public ctx: AppContext
  ) {}

  static async create() {
    const { NODE_ENV, HOST, PORT, DB_PATH } = env;
    const logger = pino({ name: "server start" });

    // Set up the SQLite database
    const db = createDb(DB_PATH);
    await migrateToLatest(db);

    // Create the atproto utilities
    const oauthClient = await createClient(db);
    const baseIdResolver = createIdResolver();
    //const ingester = createIngester(db, baseIdResolver);
    const resolver = createBidirectionalResolver(baseIdResolver);
    const ctx = {
      db,
      logger,
      oauthClient,
      resolver,
    };

    // Subscribe to events on the firehose
    (async () => {
      const firehose = createFirehoseStream();
      ingestFirehoseMessages(db, firehose);
    })();

    // Create our server
    const app: Express = express();
    app.set("trust proxy", true);

    // Enable CORS for the frontend client
    app.use(
      cors({
        origin: env.CLIENT_URL,
        credentials: true, // Allow cookies to be sent
      })
    ); // Apply middleware first
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Then apply the router
    const router = createRouter(ctx);
    app.use(router);
    app.use((_req, res) => res.sendStatus(404));
    app.use(
      rateLimit({
        windowMs: 60 * 1000, // 1 minute
        max: 100,
        message: "Too many requests, please try again later.",
      })
    );

    // Bind our server to the port
    const server = app.listen(env.PORT);
    await events.once(server, "listening");
    logger.info(`Server (${NODE_ENV}) running on port http://${HOST}:${PORT}`);

    return new Server(app, server, ctx);
  }

  async close() {
    this.ctx.logger.info("sigint received, shutting down");
    //await this.ctx.ingester.destroy();
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
