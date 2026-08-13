import { expect, type Locator, type Page } from "@playwright/test";

/**
 * A `SettingsToggle` switch, addressed by the card title it takes as its
 * accessible name.
 */
export function settingsSwitch(page: Page, name: string) {
  return page.getByRole("switch", { name });
}

/**
 * Flips a `SettingsToggle`.
 *
 * These switches carry no visible Mantine label, so the input's box is exactly
 * the track, and the aria-hidden track span covers its centre. Playwright's
 * hit-target check then never passes and a direct `.click()` retries until the
 * test times out. The wrapping `<label>` is what a pointer actually lands on,
 * and clicking it keeps the actionability checks a forced click would skip.
 */
export async function flipSettingsSwitch(toggle: Locator) {
  await expect(toggle).toBeVisible({ timeout: 10_000 });
  await expect(toggle).toBeEnabled({ timeout: 10_000 });
  await toggle.locator("xpath=..").click();
}
