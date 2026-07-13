import { test, expect, type Page } from "@playwright/test";

test.use({ storageState: "e2e/.auth/user.json" });

// Settings happy paths. The PDS-sync switch writes through to the server
// (POST /settings), so we read the initial value via the API, toggle in the UI,
// assert the state flipped, and restore the original value afterwards.

test.beforeEach(async ({ page }) => {
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/settings/);
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible({
    timeout: 10_000,
  });
});

test("settings page renders key cards", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "PDS Sync" })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByRole("heading", { name: "Push Notifications" })).toBeVisible();
});

test("PDS sync switch toggles and the change is restored afterwards", async ({ page }) => {
  const initial = await readPdsSync(page);

  const sync = page.getByRole("switch", { name: "Enable PDS Sync" });
  await expect(sync).toBeVisible({ timeout: 10_000 });
  // The switch reflects the initial server state once settings load.
  await expect(sync).toHaveAttribute("aria-checked", initial ? "true" : "false", {
    timeout: 10_000,
  });

  await sync.click();

  // UI state flips.
  await expect(sync).toHaveAttribute("aria-checked", initial ? "false" : "true", {
    timeout: 10_000,
  });

  // Restore the original value via the API so the shared account is untouched.
  await setPdsSync(page, initial);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readPdsSync(page: Page): Promise<boolean> {
  const res = await page.request.get("/api/settings");
  const json = await res.json();
  return Boolean(json.pdsSyncEnabled);
}

async function setPdsSync(page: Page, enabled: boolean) {
  await page.request.post("/api/settings", {
    data: { pdsSyncEnabled: enabled },
  });
}
