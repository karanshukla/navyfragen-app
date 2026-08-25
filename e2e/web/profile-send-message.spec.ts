import { test, expect, type Page } from "@playwright/test";

import { en } from "../../client/src/lib/i18n/en";
import { getTouchpointTranslations } from "../../client/src/lib/touchpointTranslations";
import { escapeRegex, regexFromTemplate } from "../helpers/i18n";

const t = getTouchpointTranslations("en");

test.use({ storageState: "e2e/.auth/user.json" });

const handle = () => {
  const h = process.env.E2E_HANDLE;
  if (!h) throw new Error("E2E_HANDLE must be set");
  return h;
};

// Lets cleanup find the sent message without knowing its generated tid.
const marker = () => `[e2e profile ${Date.now()}]`;

// Matched by shape because the aria-label embeds the display name, which the
// test would otherwise have to fetch from the session API.
const askBox = (page: Page) => page.getByLabel(regexFromTemplate(t.headline));

test("send anonymous message to own profile succeeds", async ({ page }) => {
  await page.goto(`/profile/${handle()}`);

  const textarea = askBox(page);
  await expect(textarea).toBeVisible({ timeout: 10_000 });

  const text = `${marker()} Hello from the e2e suite!`;
  await textarea.fill(text);
  await page.getByRole("button", { name: t.sendLabel, exact: true }).click();

  const dialog = page.getByRole("dialog", { name: en.publicProfilePage.confirmSendTitle });
  await expect(dialog).toBeVisible({ timeout: 5_000 });
  await dialog.getByRole("button", { name: en.publicProfilePage.sendMessage }).click();

  // The cleared textarea is the deterministic success signal; the toast
  // auto-closes after 5s, so it is only asserted opportunistically.
  await expect(textarea).toHaveValue("", { timeout: 15_000 });
  await expect(
    page.locator('[role="alert"]').filter({ hasText: en.publicProfilePage.messageSentTitle })
  ).toBeVisible({
    timeout: 4_000,
  });

  await cleanupMessages(page, [text]);
});

test("sending an empty message is blocked before the modal", async ({ page }) => {
  await page.goto(`/profile/${handle()}`);

  const textarea = askBox(page);
  await expect(textarea).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: t.sendLabel, exact: true }).click();

  // The inline Alert has role="alert" but no title.
  await expect(
    page.locator('[role="alert"]').filter({ hasText: en.publicProfilePage.messageEmptyError })
  ).toBeVisible({
    timeout: 5_000,
  });
  await expect(
    page.getByRole("dialog", { name: en.publicProfilePage.confirmSendTitle })
  ).toHaveCount(0);
});

test("cancel confirmation modal does not send the message", async ({ page }) => {
  await page.goto(`/profile/${handle()}`);

  const textarea = askBox(page);
  await expect(textarea).toBeVisible({ timeout: 10_000 });

  await textarea.fill(`${marker()} this should NOT be sent`);
  await page.getByRole("button", { name: t.sendLabel, exact: true }).click();

  const dialog = page.getByRole("dialog", { name: en.publicProfilePage.confirmSendTitle });
  await expect(dialog).toBeVisible({ timeout: 5_000 });
  await dialog.getByRole("button", { name: en.common.cancel }).click();

  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("alert", {
      name: new RegExp(escapeRegex(en.publicProfilePage.messageSentTitle)),
    })
  ).toHaveCount(0);
});

test("clear button empties the ask box", async ({ page }) => {
  await page.goto(`/profile/${handle()}`);

  const textarea = askBox(page);
  await expect(textarea).toBeVisible({ timeout: 10_000 });

  await textarea.fill("a draft I will discard");
  await page.getByRole("button", { name: en.askCard.clearMessage }).click();

  await expect(textarea).toHaveValue("");
});

/** Delete any inbox messages whose body contains one of `needles`. Best-effort. */
async function cleanupMessages(page: Page, needles: string[]) {
  try {
    const session = await page.request.get("/api/session");
    if (!session.ok()) return;
    const { did } = await session.json();
    if (!did) return;
    const res = await page.request.get(`/api/messages/${encodeURIComponent(did)}`);
    if (!res.ok()) return;
    const { messages }: { messages: { tid: string; message: string }[] } = await res.json();
    await Promise.all(
      messages
        .filter((m) => needles.some((n) => m.message.includes(n)))
        .map((m) => page.request.delete(`/api/messages/${encodeURIComponent(m.tid)}`))
    );
  } catch {
    // Best-effort; never fail the test over cleanup.
  }
}
