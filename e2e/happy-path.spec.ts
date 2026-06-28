import { test, expect } from "@playwright/test";

test.use({ storageState: "e2e/.auth/user.json" });

test("messages inbox loads after login", async ({ page }) => {
  await page.goto("/messages");
  await expect(page).toHaveURL(/\/messages/);
  // The inbox renders either a message list or an empty-state — both are valid.
  await expect(page.locator("main, [role=main]")).toBeVisible({ timeout: 10_000 });
});

test("navigate to own profile page", async ({ page }) => {
  const handle = process.env.E2E_HANDLE;
  if (!handle) throw new Error("E2E_HANDLE must be set");
  await page.goto(`/profile/${handle}`);
  await expect(page).toHaveURL(new RegExp(`/profile/${handle.replace(".", "\\.")}`));
  await expect(page.locator("main, [role=main]")).toBeVisible({ timeout: 10_000 });
});

test("navigate to settings", async ({ page }) => {
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/settings/);
  await expect(page.locator("main, [role=main]")).toBeVisible({ timeout: 10_000 });
});

test("session is preserved on reload", async ({ page }) => {
  await page.goto("/messages");
  await page.reload();
  await expect(page).toHaveURL(/\/messages/);
  await expect(page.locator("main, [role=main]")).toBeVisible({ timeout: 10_000 });
});
