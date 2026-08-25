import { test as setup, expect } from "@playwright/test";

import { seedUiLocale } from "./helpers/locale";

const authFile = "e2e/.auth/user.json";

// Logs in once via the E2E app-password bypass; every spec that depends on
// ["setup"] reuses the stored session.
setup("authenticate via e2e bypass", async ({ page }) => {
  const handle = process.env.E2E_HANDLE;
  const appPassword = process.env.E2E_APP_PASSWORD;

  if (!handle || !appPassword) {
    throw new Error(
      "E2E_HANDLE and E2E_APP_PASSWORD must be set. " +
        "See docs/e2e-testing.md for local setup instructions."
    );
  }

  // Seeded before the first (logged-out) navigation, and captured into
  // `authFile` below, so every spec that reuses this storage state inherits a
  // pinned `uiLocale` instead of falling back to `navigator.languages`.
  await seedUiLocale(page);

  await page.goto("/login");

  await expect(page.getByTestId("e2e-identifier")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("e2e-identifier").fill(handle);
  await page.getByTestId("e2e-password").fill(appPassword);
  await page.getByTestId("e2e-submit").click();

  await page.waitForURL(/\/messages/, { timeout: 20_000 });

  await page.context().storageState({ path: authFile });
});
