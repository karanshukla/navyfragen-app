import { test, expect, type Page } from "@playwright/test";

import { flipSettingsSwitch, settingsSwitch } from "../helpers/settings-switch";

test.use({ storageState: "e2e/.auth/user.json" });

// The PDS-sync toggle writes through to the server, so each test restores the
// original value — the account is shared with the other spec files.

async function pdsSyncEnabled(page: Page) {
  const res = await page.request.get("/api/settings");
  expect(res.ok(), "GET /api/settings succeeded").toBeTruthy();
  return Boolean(((await res.json()) as { pdsSyncEnabled?: boolean }).pdsSyncEnabled);
}

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

test("PDS sync toggle flips and is restored afterwards", async ({ page }) => {
  const sync = settingsSwitch(page, "PDS Sync");
  await expect(sync).toBeVisible({ timeout: 10_000 });
  const initiallyChecked = await sync.isChecked();

  await flipSettingsSwitch(sync);
  // The switch follows the settings query, so wait for the server value first.
  await expect.poll(async () => pdsSyncEnabled(page), { timeout: 10_000 }).toBe(!initiallyChecked);
  await expect(sync).toBeChecked({ checked: !initiallyChecked });

  await flipSettingsSwitch(sync);
  await expect.poll(async () => pdsSyncEnabled(page), { timeout: 10_000 }).toBe(initiallyChecked);
  await expect(sync).toBeChecked({ checked: initiallyChecked });
});
