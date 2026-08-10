import dotenv from "dotenv";
import { bool, cleanEnv, host, num, port, str, testOnly } from "envalid";

dotenv.config();

export const env = cleanEnv(process.env, {
  NODE_ENV: str({
    devDefault: testOnly("test"),
    choices: ["development", "production", "test"],
  }),
  HOST: host({ devDefault: testOnly("localhost") }),
  PORT: port({ devDefault: testOnly(3000) }),
  PUBLIC_URL: str({ default: "" }),
  DB_PATH: str({ devDefault: ":memory:" }),
  POSTGRESQL_URL: str({ devDefault: "" }),
  PG_POOL_MAX: num({
    default: 20,
    desc: "Postgres pool size; ignored under SQLite. A request can hold 2-4 connections at once, so the driver default of 10 queues under load",
  }),
  PG_POOL_IDLE_TIMEOUT_MS: num({ default: 30000, desc: "Postgres idle connection timeout" }),
  PG_STATEMENT_TIMEOUT_MS: num({
    default: 0,
    desc: "Caps slow queries so one cannot pin a connection indefinitely; 0 disables",
  }),
  COOKIE_SECRET: str({ devDefault: "00000000000000000000000000000000" }),
  CLIENT_URL: str({
    devDefault: testOnly("http://localhost:5173"),
    desc: "URL of the frontend client",
  }),
  EXPORT_HTML_URL: str({
    devDefault: "http://localhost:3033/",
    desc: "URL of the html-to-image render service (e.g., http://localhost:3033/)",
  }),
  OAUTH_TOKEN_SECRET: str({
    desc: "Secret key for encrypting OAuth tokens (hex-encoded, 32 bytes for AES-256)",
  }),
  AXIOM_TOKEN: str({ default: "" }),
  AXIOM_DATASET: str({ default: "" }),
  // Generate a key pair with: npx web-push generate-vapid-keys
  VAPID_PUBLIC_KEY: str({
    default: "",
    desc: "VAPID public key (base64url) for web push; push stays disabled unless all three VAPID vars are set",
  }),
  VAPID_PRIVATE_KEY: str({
    default: "",
    desc: "VAPID private key (base64url) for web push; empty disables push",
  }),
  VAPID_SUBJECT: str({
    default: "",
    desc: "VAPID subject — a mailto: or https: URL identifying the sender",
  }),
  E2E_TESTING: bool({ default: false, desc: "Never set in production" }),
  E2E_PDS_URL: str({ default: "" }),
  RATE_LIMIT_MAX: num({
    default: 100,
    desc: "Per-IP requests per minute; the e2e overlay sets 0 to disable so a large Playwright suite cannot trip 429s",
  }),
});
