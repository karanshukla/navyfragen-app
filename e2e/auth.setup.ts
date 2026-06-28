import { test as setup, expect } from "@playwright/test";

const authFile = "e2e/.auth/user.json";

// Logs in once via the E2E app-password bypass and saves auth state.
// All spec files that depend on ["setup"] will reuse this stored session.
setup("authenticate via e2e bypass", async ({ page }) => {
  const handle = process.env.E2E_HANDLE;
  const appPassword = process.env.E2E_APP_PASSWORD;

  if (!handle || !appPassword) {
    throw new Error(
      "E2E_HANDLE and E2E_APP_PASSWORD must be set. " +
        "See docs/e2e-testing.md for local setup instructions."
    );
  }

  await page.goto("/login");

  await expect(page.getByTestId("e2e-identifier")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("e2e-identifier").fill(handle);
  await page.getByTestId("e2e-password").fill(appPassword);
  await page.getByTestId("e2e-submit").click();

  await page.waitForURL(/\/messages/, { timeout: 20_000 });

  await page.context().storageState({ path: authFile });
});
