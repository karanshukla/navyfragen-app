import { test, expect, type Page } from "@playwright/test";

test.use({ storageState: "e2e/.auth/user.json" });

const handle = () => {
  const h = process.env.E2E_HANDLE;
  if (!h) throw new Error("E2E_HANDLE must be set");
  return h;
};

// Read the full settings object so a test can capture the initial value,
// mutate it, and restore it afterwards — leaving the shared account untouched.
async function getSettings(page: Page) {
  const res = await page.request.get("/api/settings");
  expect(res.ok(), "GET /api/settings succeeded").toBeTruthy();
  return (await res.json()) as Record<string, unknown>;
}

// Persist a partial settings update (mirrors what each /customise card does).
async function patchSettings(page: Page, patch: Record<string, unknown>) {
  const res = await page.request.post("/api/settings", { data: patch });
  expect(res.ok(), `POST /api/settings with ${JSON.stringify(patch)} succeeded`).toBeTruthy();
  return (await res.json()) as Record<string, unknown>;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/customise");
  await expect(page).toHaveURL(/\/customise/);
  await expect(page.getByRole("heading", { name: "Customise", exact: true })).toBeVisible({
    timeout: 10_000,
  });
});

test("customise page renders the wired cards", async ({ page }) => {
  // Section eyebrows.
  await expect(page.getByText("Your public profile", { exact: true })).toBeVisible();
  await expect(page.getByText("Message intake", { exact: true })).toBeVisible();
  // Wired cards.
  await expect(page.getByText("Profile prompt", { exact: true })).toBeVisible();
  await expect(page.getByText("Message language", { exact: true })).toBeVisible();
  await expect(page.getByText("Profile card colour", { exact: true })).toBeVisible();
  await expect(page.getByText("Inbox", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Profanity filter", { exact: true })).toBeVisible();
  // The Notifications section was intentionally removed.
  await expect(page.getByText("What sends a push", { exact: true })).toHaveCount(0);
});

test("inbox toggle flips and is restored afterwards", async ({ page }) => {
  const toggle = page.getByRole("switch", { name: /accepting messages/i });
  await expect(toggle).toBeVisible({ timeout: 10_000 });
  // Wait for settings to load so the switch reflects the server value.
  await expect(toggle).toBeEnabled({ timeout: 10_000 });
  const initiallyChecked = await toggle.isChecked();

  await toggle.click();
  // The switch is driven by the settings query, which refetches after the
  // mutation settles — wait for the server value to flip, then for the DOM.
  await expect.poll(async () => Boolean((await getSettings(page)).inboxEnabled), {
    timeout: 10_000,
  }).toBe(!initiallyChecked);
  await expect(toggle).toBeChecked({ checked: !initiallyChecked });

  // Restore the original state.
  await toggle.click();
  await expect.poll(async () => Boolean((await getSettings(page)).inboxEnabled), {
    timeout: 10_000,
  }).toBe(initiallyChecked);
  await expect(toggle).toBeChecked({ checked: initiallyChecked });
});

test("profanity filter toggle flips and is restored afterwards", async ({ page }) => {
  const toggle = page.getByRole("switch", { name: /filter enabled/i });
  await expect(toggle).toBeVisible({ timeout: 10_000 });
  await expect(toggle).toBeEnabled({ timeout: 10_000 });
  const initiallyChecked = await toggle.isChecked();

  await toggle.click();
  await expect.poll(async () => Boolean((await getSettings(page)).profanityFilterEnabled), {
    timeout: 10_000,
  }).toBe(!initiallyChecked);
  await expect(toggle).toBeChecked({ checked: !initiallyChecked });

  // Restore.
  await toggle.click();
  await expect.poll(async () => Boolean((await getSettings(page)).profanityFilterEnabled), {
    timeout: 10_000,
  }).toBe(initiallyChecked);
  await expect(toggle).toBeChecked({ checked: initiallyChecked });
});

test("custom prompt persists on blur and is cleared afterwards", async ({ page }) => {
  const input = page.getByLabel("Profile prompt");
  await expect(input).toBeVisible({ timeout: 10_000 });
  await expect(input).toBeEnabled({ timeout: 10_000 });

  const prompt = `[e2e prompt ${Date.now()}] Ask me anything`;
  await input.fill(prompt);
  await input.blur();

  // The server now stores the prompt.
  let settings = await getSettings(page);
  expect(settings.customPrompt).toBe(prompt);

  // Clear it (persist null) to leave the account at the default.
  await input.fill("");
  await input.blur();
  settings = await getSettings(page);
  expect(settings.customPrompt).toBeNull();
});

test("message language selector changes locale and is restored afterwards", async ({ page }) => {
  const select = page.getByRole("combobox", { name: /message language/i });
  await expect(select).toBeVisible({ timeout: 10_000 });
  await expect(select).toBeEnabled({ timeout: 10_000 });

  const initial = (await getSettings(page)).touchpointLocale ?? "en";

  // Pick Español.
  await select.click();
  await page.getByRole("option", { name: /^español$/i }).click();

  let settings = await getSettings(page);
  expect(settings.touchpointLocale).toBe("es");

  // Restore to the original (null = English when it was unset).
  await patchSettings(page, { touchpointLocale: initial === "en" ? null : initial });
  settings = await getSettings(page);
  expect(settings.touchpointLocale).toBe(initial === "en" ? null : initial);
});

test("profile card colour swatch changes theme and is restored afterwards", async ({ page }) => {
  // Wait for the swatches to render.
  const ember = page.getByRole("button", { name: /ember theme/i });
  await expect(ember).toBeVisible({ timeout: 10_000 });
  await expect(ember).toBeEnabled({ timeout: 10_000 });

  const initial = (await getSettings(page)).profileCardTheme ?? null;

  await ember.click();

  let settings = await getSettings(page);
  expect(settings.profileCardTheme).toBe("ember");

  // Restore (null = default Royal gradient).
  await patchSettings(page, { profileCardTheme: initial });
  settings = await getSettings(page);
  expect(settings.profileCardTheme).toBe(initial);
});

test("closed inbox shows a not-accepting-messages state on the public profile", async ({
  page,
}) => {
  // Close the inbox via the API (fast, deterministic), then visit the profile.
  await patchSettings(page, { inboxEnabled: false });

  try {
    await page.goto(`/profile/${handle()}`);
    // The ask card is still themed, but the send form is replaced by the
    // closed message — no textarea, no Send button.
    await expect(page.getByText(/not accepting new messages/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByLabel(/^Send .+ an anonymous message$/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Send", exact: true })).toHaveCount(0);
  } finally {
    // Always restore so the shared account keeps accepting messages.
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
      data: { recipient: did, message: `[e2e profanity ${Date.now()}] what's your favorite color?` },
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
