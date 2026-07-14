import { test, expect } from "@playwright/test";

test.use({ storageState: "e2e/.auth/user.json" });

// Settings happy paths. The PDS-sync toggle writes through to the server
// (POST /settings); we read its initial label from the DOM, toggle it,
// assert it flipped, then toggle it back to leave the account untouched.

test.beforeEach(async ({ page }) => {
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/settings/);
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible({
    timeout: 10_000,
  });
});

test("settings page renders key cards", async ({ page }) => {
  // Card titles are bold <Text>, not headings — match by text.
  await expect(page.getByText("PDS Sync", { exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText("Push Notifications", { exact: true })).toBeVisible();
});

test("PDS sync toggle flips label and is restored afterwards", async ({ page }) => {
  const sync = page.getByRole("button", { name: /pds sync/i });
  await expect(sync).toBeVisible({ timeout: 10_000 });
  // Wait for settings to load so the button reflects the server value.
  await expect(sync).toBeEnabled({ timeout: 10_000 });
  const enabledLabel = page.getByRole("button", { name: "PDS Sync Enabled" });
  const disabledLabel = page.getByRole("button", { name: "Enable PDS Sync" });
  const initiallyEnabled = await enabledLabel.isVisible();

  await sync.click();
  // Label flips to the opposite of the initial value.
  if (initiallyEnabled) {
    await expect(disabledLabel).toBeVisible({ timeout: 10_000 });
  } else {
    await expect(enabledLabel).toBeVisible({ timeout: 10_000 });
  }

  // Restore the original state so the shared account is untouched.
  await sync.click();
  if (initiallyEnabled) {
    await expect(enabledLabel).toBeVisible({ timeout: 10_000 });
  } else {
    await expect(disabledLabel).toBeVisible({ timeout: 10_000 });
  }
});
