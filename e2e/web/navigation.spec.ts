import { test, expect } from "@playwright/test";

import { APP_NAME_WORDMARK } from "../../client/src/lib/brand";
import { en } from "../../client/src/lib/i18n/en";
import { escapeRegex } from "../helpers/i18n";

test.use({ storageState: "e2e/.auth/user.json" });

const handle = () => {
  const h = process.env.E2E_HANDLE;
  if (!h) throw new Error("E2E_HANDLE must be set");
  return h;
};

// "navy" and "fragen" are separate spans, so the accessible name has a space
// between them; built from the wordmark itself so a brand-copy edit can't
// desync this from what actually renders.
const wordmarkName = new RegExp(
  `${escapeRegex(APP_NAME_WORDMARK[0])}.*${escapeRegex(APP_NAME_WORDMARK[1])}`,
  "i"
);
// The name may carry an unread badge ("Messages 3"), hence the trailing \b.
const messagesLinkName = new RegExp(`^${escapeRegex(en.common.shortcuts.messages)}\\b`);

test("header wordmark returns home", async ({ page }) => {
  await page.goto("/messages");
  await expect(page).toHaveURL(/\/messages/);

  await page.getByRole("link", { name: wordmarkName }).first().click();
  await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });
  await expect(page.locator("main, [role=main]")).toBeVisible();
});

test("sidebar navigates between home, messages, and settings", async ({ page }) => {
  await page.goto("/");

  // The navbar scope avoids the home hero's "View Your Messages" link, which
  // carries the same "Messages" substring.
  const navbar = page.locator("nav").first();
  await navbar.getByRole("link", { name: messagesLinkName }).click();
  await expect(page).toHaveURL(/\/messages/);
  await expect(
    page.getByRole("heading", { name: en.messagesPage.heading, exact: true })
  ).toBeVisible({
    timeout: 10_000,
  });

  await navbar.getByRole("link", { name: en.common.shortcuts.settings, exact: true }).click();
  await expect(page).toHaveURL(/\/settings/);
  await expect(
    page.getByRole("heading", { name: en.settingsPage.heading, exact: true })
  ).toBeVisible({
    timeout: 10_000,
  });

  await navbar.getByRole("link", { name: en.common.shortcuts.home, exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("keyboard shortcuts navigate the app", async ({ page }) => {
  await page.goto("/messages");
  await expect(page).toHaveURL(/\/messages/);

  await page.keyboard.press("Alt+s");
  await expect(page).toHaveURL(/\/settings/);

  await page.keyboard.press("Alt+m");
  await expect(page).toHaveURL(/\/messages/);

  await page.keyboard.press("Alt+h");
  await expect(page).toHaveURL(/\/$/);
});

test("user menu links to own profile", async ({ page }) => {
  const h = handle();
  await page.goto("/");

  // No stable aria-label on the trigger: its name is the user's display name.
  await page.locator("header").getByRole("button").last().click();
  await page.getByRole("menuitem", { name: en.userMenu.viewProfile, exact: true }).click();

  await expect(page).toHaveURL(new RegExp(`/profile/${h.replace(".", "\\.")}`), {
    timeout: 10_000,
  });
  await expect(page.locator("main, [role=main]")).toBeVisible();
});

test("color scheme toggle flips the theme", async ({ page }) => {
  await page.goto("/");

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
