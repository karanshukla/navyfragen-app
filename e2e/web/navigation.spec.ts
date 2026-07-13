import { test, expect } from "@playwright/test";

test.use({ storageState: "e2e/.auth/user.json" });

const handle = () => {
  const h = process.env.E2E_HANDLE;
  if (!h) throw new Error("E2E_HANDLE must be set");
  return h;
};

// Desktop navigation: sidebar is always visible, keyboard shortcuts work,
// the header logo returns home, and the user menu exposes profile + logout.

test("header wordmark returns home", async ({ page }) => {
  await page.goto("/messages");
  await expect(page).toHaveURL(/\/messages/);

  // The wordmark renders "navy" + "fragen" as separate spans, so its accessible
  // name is "navy fragen" (with a space). Match by shape, not the concatenated form.
  await page.getByRole("link", { name: /navy.*fragen/i }).first().click();
  await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });
  await expect(page.locator("main, [role=main]")).toBeVisible();
});

test("sidebar navigates between home, messages, and settings", async ({ page }) => {
  await page.goto("/");

  // The sidebar NavLink's accessible name includes any unread-count badge
  // ("Messages 3"), so anchor to the label and allow a trailing number. Scope
  // to the navbar to avoid the home hero's "View Your Messages" link.
  const navbar = page.locator("nav").first();
  await navbar.getByRole("link", { name: /^Messages\b/ }).click();
  await expect(page).toHaveURL(/\/messages/);
  await expect(page.getByRole("heading", { name: "Messages", exact: true })).toBeVisible({
    timeout: 10_000,
  });

  await navbar.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings/);
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible({
    timeout: 10_000,
  });

  await navbar.getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("keyboard shortcuts navigate the app", async ({ page }) => {
  // Start on the messages page so the session has settled.
  await page.goto("/messages");
  await expect(page).toHaveURL(/\/messages/);

  // Alt+S -> Settings
  await page.keyboard.press("Alt+s");
  await expect(page).toHaveURL(/\/settings/);

  // Alt+M -> Messages
  await page.keyboard.press("Alt+m");
  await expect(page).toHaveURL(/\/messages/);

  // Alt+H -> Home
  await page.keyboard.press("Alt+h");
  await expect(page).toHaveURL(/\/$/);
});

test("user menu links to own profile", async ({ page }) => {
  const h = handle();
  await page.goto("/");

  // The user-menu trigger is the last header button (after the color-scheme
  // toggle). It has no stable aria-label — its name is the user's display name.
  await page.locator("header").getByRole("button").last().click();
  await page.getByRole("menuitem", { name: "View Profile" }).click();

  await expect(page).toHaveURL(new RegExp(`/profile/${h.replace(".", "\\.")}`), {
    timeout: 10_000,
  });
  await expect(page.locator("main, [role=main]")).toBeVisible();
});

test("color scheme toggle flips the theme", async ({ page }) => {
  await page.goto("/");

  const html = page.locator("html");
  // The attribute toggles between "light" and "dark" once Mantine hydrates it.
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
