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
    // Desktop / web — full Chrome viewport, sidebar always visible.
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /.*\.spec\.ts/,
      // Specs at the e2e root (e.g. happy-path.spec.ts) and under e2e/web/.
      testIgnore: [/mobile\/.*\.spec\.ts/],
      dependencies: ["setup"],
    },
    // Mobile — small viewport, navbar collapses behind the burger.
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
      testMatch: /mobile\/.*\.spec\.ts/,
      dependencies: ["setup"],
    },
  ],
});
