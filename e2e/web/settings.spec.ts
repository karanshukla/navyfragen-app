import { test, expect } from "@playwright/test";

test.use({ storageState: "e2e/.auth/user.json" });

// Settings happy paths. The PDS-sync switch writes through to the server
// (POST /settings); we read its initial checked state from the DOM, toggle it,
// assert it flipped, then toggle it back to leave the account untouched.

test.beforeEach(async ({ page }) => {
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/settings/);
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible({
    timeout: 10_000,
  });
});

test("settings page renders key cards", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "PDS Sync" })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByRole("heading", { name: "Push Notifications" })).toBeVisible();
});

test("PDS sync switch toggles and is restored afterwards", async ({ page }) => {
  const sync = page.getByRole("switch", { name: "Enable PDS Sync" });
  await expect(sync).toBeVisible({ timeout: 10_000 });
  // Wait for settings to load so the switch reflects the server value.
  await expect(sync).toBeEnabled({ timeout: 10_000 });
  const initial = await sync.isChecked();

  await sync.click();
  // UI state flips to the opposite of the initial value.
  if (initial) {
    await expect(sync).not.toBeChecked({ timeout: 10_000 });
  } else {
    await expect(sync).toBeChecked({ timeout: 10_000 });
  }

  // Restore the original state so the shared account is untouched.
  await sync.click();
  if (initial) {
    await expect(sync).toBeChecked({ timeout: 10_000 });
  } else {
    await expect(sync).not.toBeChecked({ timeout: 10_000 });
  }
});
