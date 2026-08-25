import { test, expect, type Page, type Locator } from "@playwright/test";

import { en } from "../../client/src/lib/i18n/en";
import { escapeRegex } from "../helpers/i18n";

test.use({ storageState: "e2e/.auth/user.json" });

// Runs at the "Pixel 7" viewport, below the `sm` breakpoint, so the sidebar
// collapses behind the burger.

const handle = () => {
  const h = process.env.E2E_HANDLE;
  if (!h) throw new Error("E2E_HANDLE must be set");
  return h;
};

// The name may carry an unread badge ("Messages 3"), hence the trailing \b.
const messagesLinkName = new RegExp(`^${escapeRegex(en.common.shortcuts.messages)}\\b`);

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
  // Collapsed = navbar translated off the left edge.
  await expectDrawerClosed(page);

  await burger(page).click();
  await expectDrawerOpen(page);

  await burger(page).click();
  await expectDrawerClosed(page);
});

test("tapping a nav link navigates and closes the drawer", async ({ page }) => {
  await openDrawer(page);

  await page.locator("nav").getByRole("link", { name: messagesLinkName }).click();

  await expect(page).toHaveURL(/\/messages/);
  await expect(
    page.getByRole("heading", { name: en.messagesPage.heading, exact: true })
  ).toBeVisible({
    timeout: 10_000,
  });
  await expectDrawerClosed(page);
});

test("home hero links to messages on mobile", async ({ page }) => {
  await page.getByRole("link", { name: en.home.viewYourMessages, exact: true }).click();
  await expect(page).toHaveURL(/\/messages/);
  await expect(
    page.getByRole("heading", { name: en.messagesPage.heading, exact: true })
  ).toBeVisible({
    timeout: 10_000,
  });
});

test("navigate to own profile via the user menu on mobile", async ({ page }) => {
  const h = handle();

  // No stable aria-label on the trigger.
  await page.locator("header").getByRole("button").last().click();
  await page.getByRole("menuitem", { name: en.userMenu.viewProfile, exact: true }).click();

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

  await page.getByRole("button", { name: en.appHeader.toggleColorScheme, exact: true }).click();

  await expect(html).toHaveAttribute("data-mantine-color-scheme", expected, {
    timeout: 5_000,
  });
});
