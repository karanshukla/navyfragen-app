import { test, expect } from "@playwright/test";

test.use({ storageState: "e2e/.auth/user.json" });

// The PDS-sync toggle writes through to the server, so each test restores the
// original value — the account is shared with the other spec files.

test.beforeEach(async ({ page }) => {
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/settings/);
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible({
    timeout: 10_000,
  });
});

test("settings page renders key cards", async ({ page }) => {
  // Card titles are bold <Text>, not headings.
  await expect(page.getByText("PDS Sync", { exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText("Push Notifications", { exact: true })).toBeVisible();
});

test("PDS sync toggle flips label and is restored afterwards", async ({ page }) => {
  const sync = page.getByRole("button", { name: /pds sync/i });
  await expect(sync).toBeVisible({ timeout: 10_000 });
  await expect(sync).toBeEnabled({ timeout: 10_000 });
  const enabledLabel = page.getByRole("button", { name: "PDS Sync Enabled" });
  const disabledLabel = page.getByRole("button", { name: "Enable PDS Sync" });
  const initiallyEnabled = await enabledLabel.isVisible();

  await sync.click();
  if (initiallyEnabled) {
    await expect(disabledLabel).toBeVisible({ timeout: 10_000 });
  } else {
    await expect(enabledLabel).toBeVisible({ timeout: 10_000 });
  }

  await sync.click();
  if (initiallyEnabled) {
    await expect(enabledLabel).toBeVisible({ timeout: 10_000 });
  } else {
    await expect(disabledLabel).toBeVisible({ timeout: 10_000 });
  }
});
