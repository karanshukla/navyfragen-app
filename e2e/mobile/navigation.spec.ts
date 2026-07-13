import { test, expect, type Page, type Locator } from "@playwright/test";

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
function burger(page: Page): Locator {
  return page.locator("header").locator("button").first();
}

/**
 * Mantine collapses the mobile navbar with a CSS transform (translateX off the
 * left edge); the links remain in the accessibility tree, so toBeVisible() /
 * toBeHidden() can't tell the states apart. The user-facing reality is the
 * navbar's on-screen x position, which we assert via the bounding box.
 */
async function expectDrawerOpen(page: Page) {
  await expect
    .poll(async () => (await page.locator("nav").first().boundingBox())?.x, { timeout: 5_000 })
    .toBeGreaterThanOrEqual(0);
}

async function expectDrawerClosed(page: Page) {
  await expect
    .poll(async () => (await page.locator("nav").first().boundingBox())?.x, { timeout: 5_000 })
    .toBeLessThan(0);
}

async function openDrawer(page: Page) {
  await burger(page).click();
  await expectDrawerOpen(page);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main, [role=main]")).toBeVisible({ timeout: 10_000 });
});

test("burger opens and closes the navigation drawer", async ({ page }) => {
  // Drawer starts collapsed (navbar translated off the left edge).
  await expectDrawerClosed(page);

  await burger(page).click();
  await expectDrawerOpen(page);

  // Close again.
  await burger(page).click();
  await expectDrawerClosed(page);
});

test("tapping a nav link navigates and closes the drawer", async ({ page }) => {
  await openDrawer(page);

  // The NavLink accessible name may include an unread badge ("Messages 3"),
  // so anchor to the label and allow a trailing number.
  await page.locator("nav").getByRole("link", { name: /^Messages\b/ }).click();

  await expect(page).toHaveURL(/\/messages/);
  await expect(page.getByRole("heading", { name: "Messages", exact: true })).toBeVisible({
    timeout: 10_000,
  });
  // Drawer auto-closed after navigation.
  await expectDrawerClosed(page);
});

test("home hero links to messages on mobile", async ({ page }) => {
  // The logged-in home hero has a prominent "View Your Messages" button.
  await page.getByRole("link", { name: "View Your Messages" }).click();
  await expect(page).toHaveURL(/\/messages/);
  await expect(page.getByRole("heading", { name: "Messages", exact: true })).toBeVisible({
    timeout: 10_000,
  });
});

test("navigate to own profile via the user menu on mobile", async ({ page }) => {
  const h = handle();

  // The user-menu trigger is the last header button (after the color-scheme
  // toggle). It has no stable aria-label.
  await page.locator("header").getByRole("button").last().click();
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
