import { test, expect, type Page } from "@playwright/test";

import { en } from "../../client/src/lib/i18n/en";
import {
  getTouchpointTranslations,
  touchpointLocales,
} from "../../client/src/lib/touchpointTranslations";
import { regexFromTemplate } from "../helpers/i18n";
import { flipSettingsSwitch, settingsSwitch } from "../helpers/settings-switch";

const spanish = touchpointLocales.find((l) => l.value === "es")!;
const t = getTouchpointTranslations("en");

test.use({ storageState: "e2e/.auth/user.json" });

const handle = () => {
  const h = process.env.E2E_HANDLE;
  if (!h) throw new Error("E2E_HANDLE must be set");
  return h;
};

// Tests capture, mutate, then restore, so the shared account is left untouched.
async function getSettings(page: Page) {
  const res = await page.request.get("/api/settings");
  expect(res.ok(), "GET /api/settings succeeded").toBeTruthy();
  return (await res.json()) as Record<string, unknown>;
}

async function patchSettings(page: Page, patch: Record<string, unknown>) {
  const res = await page.request.post("/api/settings", { data: patch });
  expect(res.ok(), `POST /api/settings with ${JSON.stringify(patch)} succeeded`).toBeTruthy();
  return (await res.json()) as Record<string, unknown>;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/customise");
  await expect(page).toHaveURL(/\/customise/);
  await expect(
    page.getByRole("heading", { name: en.customisePage.heading, exact: true })
  ).toBeVisible({
    timeout: 10_000,
  });
});

test("customise page renders the wired cards", async ({ page }) => {
  await expect(page.getByText(en.customisePage.yourPublicProfile, { exact: true })).toBeVisible();
  await expect(page.getByText(en.customisePage.messageIntake, { exact: true })).toBeVisible();
  await expect(page.getByText(en.customisePage.profilePrompt, { exact: true })).toBeVisible();
  await expect(page.getByText(en.customisePage.messageLanguage, { exact: true })).toBeVisible();
  await expect(page.getByText(en.customisePage.profileCardColour, { exact: true })).toBeVisible();
  await expect(page.getByText(en.customisePage.inbox, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(en.customisePage.profanityFilter, { exact: true })).toBeVisible();
  // The Notifications section was intentionally removed; "What sends a push"
  // is not — and was never — catalog copy, so there is no `en.*` key for it.
  await expect(page.getByText("What sends a push", { exact: true })).toHaveCount(0);
});

test("inbox toggle flips and is restored afterwards", async ({ page }) => {
  const toggle = settingsSwitch(page, en.customisePage.inbox);
  await expect(toggle).toBeVisible({ timeout: 10_000 });
  const initiallyChecked = await toggle.isChecked();

  await flipSettingsSwitch(toggle);
  // The switch follows the settings query, so wait for the server value first.
  await expect
    .poll(async () => Boolean((await getSettings(page)).inboxEnabled), {
      timeout: 10_000,
    })
    .toBe(!initiallyChecked);
  await expect(toggle).toBeChecked({ checked: !initiallyChecked });

  await flipSettingsSwitch(toggle);
  await expect
    .poll(async () => Boolean((await getSettings(page)).inboxEnabled), {
      timeout: 10_000,
    })
    .toBe(initiallyChecked);
  await expect(toggle).toBeChecked({ checked: initiallyChecked });
});

test("profanity filter toggle flips and is restored afterwards", async ({ page }) => {
  const toggle = settingsSwitch(page, en.customisePage.profanityFilter);
  await expect(toggle).toBeVisible({ timeout: 10_000 });
  const initiallyChecked = await toggle.isChecked();

  await flipSettingsSwitch(toggle);
  await expect
    .poll(async () => Boolean((await getSettings(page)).profanityFilterEnabled), {
      timeout: 10_000,
    })
    .toBe(!initiallyChecked);
  await expect(toggle).toBeChecked({ checked: !initiallyChecked });

  await flipSettingsSwitch(toggle);
  await expect
    .poll(async () => Boolean((await getSettings(page)).profanityFilterEnabled), {
      timeout: 10_000,
    })
    .toBe(initiallyChecked);
  await expect(toggle).toBeChecked({ checked: initiallyChecked });
});

test("custom prompt persists on blur and is cleared afterwards", async ({ page }) => {
  const input = page.getByLabel(en.customisePage.profilePrompt);
  await expect(input).toBeVisible({ timeout: 10_000 });
  await expect(input).toBeEnabled({ timeout: 10_000 });

  const prompt = `[e2e prompt ${Date.now()}] Ask me anything`;
  await input.fill(prompt);
  await input.blur();

  let settings = await getSettings(page);
  expect(settings.customPrompt).toBe(prompt);

  await input.fill("");
  await input.blur();
  settings = await getSettings(page);
  expect(settings.customPrompt).toBeNull();
});

test("message language selector changes locale and is restored afterwards", async ({ page }) => {
  const select = page.getByRole("combobox", { name: en.customisePage.messageLanguage });
  await expect(select).toBeVisible({ timeout: 10_000 });
  await expect(select).toBeEnabled({ timeout: 10_000 });

  const initial = (await getSettings(page)).touchpointLocale ?? "en";

  await select.click();
  await page.getByRole("option", { name: spanish.label, exact: true }).click();

  let settings = await getSettings(page);
  expect(settings.touchpointLocale).toBe("es");

  await patchSettings(page, { touchpointLocale: initial === "en" ? null : initial });
  settings = await getSettings(page);
  expect(settings.touchpointLocale).toBe(initial === "en" ? null : initial);
});

test("profile card colour swatch changes theme and is restored afterwards", async ({ page }) => {
  const ember = page.getByRole("button", { name: en.themes.profileCard.ember, exact: true });
  await expect(ember).toBeVisible({ timeout: 10_000 });
  await expect(ember).toBeEnabled({ timeout: 10_000 });

  const initial = (await getSettings(page)).profileCardTheme ?? null;

  await ember.click();

  let settings = await getSettings(page);
  expect(settings.profileCardTheme).toBe("ember");

  await patchSettings(page, { profileCardTheme: initial });
  settings = await getSettings(page);
  expect(settings.profileCardTheme).toBe(initial);
});

test("closed inbox shows a not-accepting-messages state on the public profile", async ({
  page,
}) => {
  await patchSettings(page, { inboxEnabled: false });

  try {
    await page.goto(`/profile/${handle()}`);
    // The card stays themed; only the send form is replaced.
    await expect(page.getByText(t.inboxClosed)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByLabel(regexFromTemplate(t.headline))).toHaveCount(0);
    await expect(page.getByRole("button", { name: t.sendLabel, exact: true })).toHaveCount(0);
  } finally {
    await patchSettings(page, { inboxEnabled: true });
  }
});

test("profanity filter silently drops a flagged message", async ({ page }) => {
  // Enable the filter, capture the inbox count, send a profane + a clean
  // message, then assert only the clean one landed.
  await patchSettings(page, { profanityFilterEnabled: true });
  const session = await page.request.get("/api/session");
  const { did } = await session.json();

  try {
    const statsBefore = await (await page.request.get("/api/stats")).json();

    // Both sends return success to the sender...
    const profane = await page.request.post("/api/messages/send", {
      data: { recipient: did, message: `you are such a fuck [e2e ${Date.now()}]` },
    });
    expect(profane.ok(), "profane send returned success to sender").toBeTruthy();

    const clean = await page.request.post("/api/messages/send", {
      data: {
        recipient: did,
        message: `[e2e profanity ${Date.now()}] what's your favorite color?`,
      },
    });
    expect(clean.ok(), "clean send returned success").toBeTruthy();

    // ...but only the clean one reached the inbox (+1, not +2).
    const statsAfter = await (await page.request.get("/api/stats")).json();
    expect(statsAfter.messageCount).toBe(statsBefore.messageCount + 1);

    // The profane text is absent from the inbox; the clean text is present.
    const msgs = await (await page.request.get(`/api/messages/${did}`)).json();
    const bodies: string[] = msgs.messages.map((m: { message: string }) => m.message);
    expect(bodies.some((b) => b.includes("fuck"))).toBeFalsy();
    expect(bodies.some((b) => b.includes("favorite color"))).toBeTruthy();

    // Cleanup the clean message we inserted.
    const cleanMsg = msgs.messages.find((m: { message: string }) =>
      m.message.includes("favorite color")
    );
    if (cleanMsg) await page.request.delete(`/api/messages/${cleanMsg.tid}`);
  } finally {
    // Restore the filter to off (default).
    await patchSettings(page, { profanityFilterEnabled: false });
  }
});
