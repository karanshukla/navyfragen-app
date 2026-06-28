import dotenv from "dotenv";
import { bool, cleanEnv, host, port, str, testOnly } from "envalid";

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
  // Leave empty to keep web push disabled (feature is stubbed out, not yet active).
  VAPID_PUBLIC_KEY: str({ default: "" }),
  VAPID_PRIVATE_KEY: str({ default: "" }),
  VAPID_SUBJECT: str({ default: "" }), // mailto: or https: URL identifying the sender
  // E2E testing — disabled by default; never set in production
  E2E_TESTING: bool({ default: false }),
  E2E_PDS_URL: str({ default: "" }),
});
