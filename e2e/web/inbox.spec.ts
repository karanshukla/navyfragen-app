import { test, expect, type Page } from "@playwright/test";

test.use({ storageState: "e2e/.auth/user.json" });

// Inbox happy paths against real server endpoints. Replying would post a
// permanent Bluesky post with no cleanup path, so that test drives the compose
// UI and backs out with Escape.
//
// These share one account with the other spec files, which run in parallel, so
// no test may assume it owns the inbox. Most don't care which card they touch;
// the delete test seeds and deletes its own marker'd message.

test.beforeEach(async ({ page }) => {
  await page.goto("/messages");
  await expect(page).toHaveURL(/\/messages/);
  await expect(page.getByRole("heading", { name: "Messages", exact: true })).toBeVisible({
    timeout: 10_000,
  });
});

test("inbox renders the header and inbox-link hero card", async ({ page }) => {
  await expect(page.getByText(/Your inbox link/)).toBeVisible({ timeout: 10_000 });
});

test("expand a message card to reveal the reply composer and back out", async ({ page }) => {
  const seeded = await ensureExampleMessages(page);

  const card = page.locator('[id^="message-card-"]').first();
  await expect(card).toBeVisible({ timeout: 10_000 });

  await card.click();

  const replyBox = page.getByLabel("Your response");
  await expect(replyBox).toBeVisible({ timeout: 5_000 });
  await replyBox.fill("an e2e draft reply");

  const replyBtn = page.getByRole("button", { name: /^Reply/ }).last();
  await expect(replyBtn).toBeEnabled({ timeout: 5_000 });

  // Escape collapses the composer without posting to Bluesky.
  await replyBox.press("Escape");
  await expect(replyBox).toHaveCount(0);

  if (seeded) await cleanupAllMessages(page);
});

test("pin and unpin a thread root is local state only", async ({ page }) => {
  const seeded = await ensureExampleMessages(page);

  const card = page.locator('[id^="message-card-"]').first();
  await expect(card).toBeVisible({ timeout: 10_000 });

  await card.getByRole("button", { name: "Set as thread root" }).click();
  await expect(card.getByRole("button", { name: "Unpin thread root" })).toBeVisible({
    timeout: 5_000,
  });

  await card.getByRole("button", { name: "Unpin thread root" }).click();
  await expect(card.getByRole("button", { name: "Set as thread root" })).toBeVisible({
    timeout: 5_000,
  });

  if (seeded) await cleanupAllMessages(page);
});

test("posting-preferences switch toggles state", async ({ page }) => {
  const seeded = await ensureExampleMessages(page);

  const header = page.getByText("Posting preferences");
  const autoScroll = page.getByRole("switch", { name: "Auto-scroll to messages" });
  if (!(await autoScroll.isVisible().catch(() => false))) {
    await header.click();
  }
  await expect(autoScroll).toBeVisible({ timeout: 5_000 });

  const before = await autoScroll.isChecked();
  await autoScroll.click();
  if (before) {
    await expect(autoScroll).not.toBeChecked({ timeout: 5_000 });
  } else {
    await expect(autoScroll).toBeChecked({ timeout: 5_000 });
  }

  if (seeded) await cleanupAllMessages(page);
});

test("delete a message removes it from the inbox (no-confirm default)", async ({ page }) => {
  // Must never skip: a "populated inbox ⇒ skip" guard used to let this go green
  // without exercising delete at all, because the parallel
  // profile-send-message.spec.ts lands a row first (#289). Hence the marker.
  const marker = `[e2e inbox-delete ${Date.now()}]`;
  await seedOwnedMessage(page, marker);
  try {
    // Seeded via the API after beforeEach navigated, so React Query's cache has
    // not seen the row yet.
    await page.reload();
    const card = page.locator('[id^="message-card-"]').filter({ hasText: marker });
    await expect(card).toBeVisible({ timeout: 15_000 });

    await card.getByRole("button", { name: "Delete message" }).click();

    // Asserting on our own card, not a count delta, which races the other spec.
    await expect(card).toHaveCount(0, { timeout: 15_000 });
  } finally {
    // Best-effort litter cleanup if the UI delete never landed.
    await deleteMessagesByText(page, [marker]);
  }
});

/**
 * Ensure the inbox has at least one message. If it's empty, click "Add example
 * messages" (local-DB-only seeding). Returns true if this call seeded the inbox
 * (and thus cleanup is warranted), false if it was already populated.
 */
async function ensureExampleMessages(page: Page): Promise<boolean> {
  await expect(page.locator("main, [role=main]")).toBeVisible({ timeout: 10_000 });

  // Neither is present while loading, so this waits for the query to settle.
  const cards = page.locator('[id^="message-card-"]');
  const emptyAlert = page.getByRole("alert").filter({ hasText: "No messages" });
  await expect(async () => {
    const hasCards = (await cards.count()) > 0;
    const hasEmpty = await emptyAlert.isVisible().catch(() => false);
    expect(hasCards || hasEmpty).toBeTruthy();
  }).toPass({ timeout: 15_000 });

  if ((await cards.count()) > 0) return false; // already populated — don't touch it

  await page.getByRole("button", { name: "Add example messages" }).click();
  await expect(cards.first()).toBeVisible({ timeout: 15_000 });
  return true;
}

/** Best-effort deletion of all inbox messages via the API. */
async function cleanupAllMessages(page: Page) {
  try {
    const session = await page.request.get("/api/session");
    const { did } = await session.json();
    if (!did) return;
    const res = await page.request.get(`/api/messages/${encodeURIComponent(did)}`);
    if (!res.ok()) return;
    const { messages }: { messages: { tid: string }[] } = await res.json();
    await Promise.all(
      messages.map((m) =>
        page.request.delete(`/api/messages/${encodeURIComponent(m.tid)}`)
      )
    );
  } catch {
    // best-effort
  }
}

/**
 * Seed a single message owned by THIS test into the inbox of the logged-in
 * account, identified by `marker`. Uses the public `POST /messages/send`
 * endpoint (the same one `profile-send-message.spec.ts` exercises) so the
 * message is deletable later via its tid and leaves no PDS record.
 *
 * Why this exists: `ensureExampleMessages` returns false (and the old delete
 * test then `test.skip`-ed) whenever the inbox already held any row. Under the
 * Playwright worker model different spec files run concurrently against the
 * same shared account, so another spec seeding the inbox first caused the
 * delete test to silently opt out — a green run that never exercised delete
 * (#289). Seeding a marker'd message we ourselves created removes that
 * dependency entirely: the inbox is never a reason to skip.
 *
 * Returns when the API confirms the insert; the caller is responsible for
 * making the card visible (e.g. via `page.reload()`) before asserting on it.
 */
async function seedOwnedMessage(page: Page, marker: string): Promise<void> {
  const session = await page.request.get("/api/session");
  const { did } = await session.json();
  if (!did) throw new Error("seedOwnedMessage: no session.did");
  const text = `${marker} owned by inbox delete test`;
  const res = await page.request.post("/api/messages/send", {
    data: { recipient: did, message: text },
  });
  if (!res.ok()) {
    throw new Error(`seedOwnedMessage: /messages/send failed (${res.status()})`);
  }
}

/**
 * Best-effort deletion of inbox messages whose body contains one of `needles`.
 * Used to clean up marker'd rows a test created via {@link seedOwnedMessage}
 * if the UI path under test didn't remove them.
 */
async function deleteMessagesByText(page: Page, needles: string[]): Promise<void> {
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
    // best-effort
  }
}
