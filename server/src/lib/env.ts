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
  // Postgres connection-pool sizing. A single request can briefly hold 2-4
  // connections (the multi-query patterns in message-service.ts), and with the
  // default `max` of 10 a burst of traffic will queue. These knobs are ignored
  // under SQLite. statement_timeout caps slow queries so one bad query can't
  // pin a connection indefinitely; set in ms, 0 = disabled.
  PG_POOL_MAX: num({ default: 20 }),
  PG_POOL_IDLE_TIMEOUT_MS: num({ default: 30000 }),
  PG_STATEMENT_TIMEOUT_MS: num({ default: 0 }),
  COOKIE_SECRET: str({ devDefault: "00000000000000000000000000000000" }),
  CLIENT_URL: str({
    devDefault: testOnly("http://localhost:5173"),
    desc: "URL of the frontend client",
  }),
  EXPORT_HTML_URL: str({
    devDefault: "http://localhost:3033/", // Default for monkeyphysics/html-to-image
    desc: "URL of the monkeyphysics/html-to-image service (e.g., http://localhost:3033/)",
  }),
  OAUTH_TOKEN_SECRET: str({
    desc: "Secret key for encrypting OAuth tokens (hex-encoded, 32 bytes for AES-256)",
  }),
  AXIOM_TOKEN: str({ default: "" }),
  AXIOM_DATASET: str({ default: "" }),
  // Web push (VAPID) — generate a key pair with: npx web-push generate-vapid-keys
  // Leave all three empty to keep web push disabled. When all three are set,
  // push notifications are active and /notifications/* endpoints return 200.
  VAPID_PUBLIC_KEY: str({
    default: "",
    desc: "VAPID public key (base64url) for web push; empty disables push",
  }),
  VAPID_PRIVATE_KEY: str({
    default: "",
    desc: "VAPID private key (base64url) for web push; empty disables push",
  }),
  VAPID_SUBJECT: str({
    default: "",
    desc: "VAPID subject — a mailto: or https: URL identifying the sender",
  }),
  // E2E testing — disabled by default; never set in production
  E2E_TESTING: bool({ default: false }),
  E2E_PDS_URL: str({ default: "" }),
  // Per-IP request cap per minute. Set to 0 in the e2e overlay to disable
  // rate limiting entirely so a large Playwright suite doesn't trip 429s.
  RATE_LIMIT_MAX: num({ default: 100 }),
});
