import { test, expect, type Locator } from "@playwright/test";

test.use({ storageState: "e2e/.auth/user.json" });

// Mobile happy paths. Runs at the "Pixel 7" viewport, below the `sm` breakpoint,
// so the sidebar collapses behind the burger. Opening it reveals the same nav
// links, and tapping one navigates and closes the drawer.

const handle = () => {
  const h = process.env.E2E_HANDLE;
  if (!h) throw new Error("E2E_HANDLE must be set");
  return h;
};

/** The mobile burger button (no aria-label). It's the first button rendered in
 * the AppShell header — placed before the wordmark — and only exists on mobile
 * (`hiddenFrom="sm"`). Scoped to the header to avoid matching anything else. */
function burger(page: import("@playwright/test").Page): Locator {
  return page.locator("header").locator("button").first();
}

async function openDrawer(page: import("@playwright/test").Page) {
  // The nav links are hidden while the drawer is collapsed. Open it.
  await burger(page).click();
  // After opening, the Messages link should be visible in the drawer.
  await expect(page.getByRole("link", { name: "Messages" })).toBeVisible({
    timeout: 5_000,
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main, [role=main]")).toBeVisible({ timeout: 10_000 });
});

test("burger opens and closes the navigation drawer", async ({ page }) => {
  // Drawer collapsed initially: nav links are not visible.
  await expect(page.getByRole("link", { name: "Messages" })).toHaveCount(0);

  await burger(page).click();

  // Drawer open: nav links appear.
  await expect(page.getByRole("link", { name: "Messages" })).toBeVisible({
    timeout: 5_000,
  });
  await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Home" })).toBeVisible();

  // Close again.
  await burger(page).click();
  await expect(page.getByRole("link", { name: "Messages" })).toHaveCount(0);
});

test("tapping a nav link navigates and closes the drawer", async ({ page }) => {
  await openDrawer(page);

  await page.getByRole("link", { name: "Messages" }).click();

  await expect(page).toHaveURL(/\/messages/);
  await expect(page.getByRole("heading", { name: "Messages" })).toBeVisible({
    timeout: 10_000,
  });
  // Drawer auto-closed after navigation.
  await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
});

test("home hero links to messages on mobile", async ({ page }) => {
  // The logged-in home hero has a prominent "View Your Messages" button.
  await page.getByRole("link", { name: "View Your Messages" }).click();
  await expect(page).toHaveURL(/\/messages/);
  await expect(page.getByRole("heading", { name: "Messages" })).toBeVisible({
    timeout: 10_000,
  });
});

test("navigate to own profile via the user menu on mobile", async ({ page }) => {
  const h = handle();

  // The user-menu trigger is labelled with the displayName; read it from session.
  const session = await page.request.get("/api/session");
  const { profile } = await session.json();
  if (!profile?.displayName) throw new Error("session profile.displayName missing");

  await page.getByRole("button", { name: profile.displayName }).first().click();
  await page.getByRole("menuitem", { name: "View Profile" }).click();

  await expect(page).toHaveURL(new RegExp(`/profile/${h.replace(".", "\\.")}`), {
    timeout: 10_000,
  });
  await expect(page.locator("main, [role=main]")).toBeVisible();
});

test("color scheme toggle works on mobile", async ({ page }) => {
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-mantine-color-scheme", /(light|dark)/, {
    timeout: 10_000,
  });
  const before = await html.getAttribute("data-mantine-color-scheme");
  const expected = before === "light" ? "dark" : "light";

  await page.getByRole("button", { name: "Toggle color scheme" }).click();

  await expect(html).toHaveAttribute("data-mantine-color-scheme", expected, {
    timeout: 5_000,
  });
});
