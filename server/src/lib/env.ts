import dotenv from "dotenv";
import { cleanEnv, host, port, str, testOnly } from "envalid";

dotenv.config();

export const env = cleanEnv(process.env, {
  NODE_ENV: str({
    devDefault: testOnly("test"),
    choices: ["development", "production", "test"],
  }),
  HOST: host({ devDefault: testOnly("localhost") }),
  PORT: port({ devDefault: testOnly(3000) }),
  PUBLIC_URL: str({}),
  DB_PATH: str({ devDefault: ":memory:" }),
  POSTGRESQL_URL: str({ devDefault: "" }),
  COOKIE_SECRET: str({ devDefault: "00000000000000000000000000000000" }),
  CLIENT_URL: str({
    devDefault: testOnly("http://localhost:5173"),
    desc: "URL of the frontend client",
  }),
});
