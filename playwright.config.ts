import { resolve } from "path";
import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

// Load credentials from the same file Docker Compose reads — no manual env sourcing needed.
// dotenv is hoisted from server/package.json in this npm workspace.
loadEnv({ path: resolve(__dirname, "docker/.env") });

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [["html", { open: "never" }]],
  use: {
    // Caddy exposed directly on 8090 by docker-compose.e2e.yml (bypasses Anubis)
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8090",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
});
