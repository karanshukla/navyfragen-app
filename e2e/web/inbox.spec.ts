import { test, expect, type Page } from "@playwright/test";

test.use({ storageState: "e2e/.auth/user.json" });

// Inbox happy paths. These exercise real server endpoints:
//  - "Add example messages" creates LOCAL-DB-only rows (no PDS record).
//  - Delete hard-removes the local row (DB is authoritative for the inbox).
//  - Pin/unpin is pure client localStorage state — no server calls.
//  - Reply would post a permanent Bluesky post (no cleanup path exists), so the
//    reply test exercises the compose UI and then backs out with Escape.
//
// Isolation across the shared account: most tests here don't care *which* card
// they touch, so they use `ensureExampleMessages` (seed only when empty) and
// `cleanupAllMessages`. The delete test is different — under Playwright's worker
// model another spec file can land a row in this inbox between our checks, so a
// "populated inbox ⇒ skip" guard (#289) made the delete path silently opt out
// of CI. Instead the delete test seeds and identifies its OWN marker'd message
// and deletes only that card, so a populated inbox is never a reason to skip.

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

  // Expanding happens on card click.
  await card.click();

  const replyBox = page.getByLabel("Your response");
  await expect(replyBox).toBeVisible({ timeout: 5_000 });
  await replyBox.fill("an e2e draft reply");

  const replyBtn = page.getByRole("button", { name: /^Reply/ }).last();
  await expect(replyBtn).toBeEnabled({ timeout: 5_000 });

  // Back out WITHOUT sending — Escape collapses the composer (no Bluesky post made).
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

  // The Posting preferences section is open by default; if it isn't, open it.
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
  // This test must NEVER skip. The previous implementation bailed out (and the
  // suite went green without exercising the delete path) whenever the shared
  // inbox already held a row — which happens whenever the parallel
  // `profile-send-message.spec.ts` lands a message first (#289). Instead of
  // relying on the inbox being empty, we seed and identify OUR OWN message by a
  // unique marker, delete only that card, and assert only that card disappears.
  // A populated inbox is no longer a reason to skip.
  const marker = `[e2e inbox-delete ${Date.now()}]`;
  await seedOwnedMessage(page, marker);
  try {
    // We seeded via the API after `beforeEach` already navigated, so the
    // client's React Query cache doesn't know about the new row yet. Reload to
    // surface it deterministically.
    await page.reload();
    const card = page.locator('[id^="message-card-"]').filter({ hasText: marker });
    await expect(card).toBeVisible({ timeout: 15_000 });

    // confirmBeforeDelete defaults to false, so delete is immediate.
    await card.getByRole("button", { name: "Delete message" }).click();

    // Assert OUR card is gone — not a count delta, which is also racy under
    // concurrent writers from the other spec.
    await expect(card).toHaveCount(0, { timeout: 15_000 });
  } finally {
    // Best-effort: if the UI delete didn't land (e.g. test failed mid-flight),
    // clean up the marker row we created so we don't leave litter.
    await deleteMessagesByText(page, [marker]);
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Ensure the inbox has at least one message. If it's empty, click "Add example
 * messages" (local-DB-only seeding). Returns true if this call seeded the inbox
 * (and thus cleanup is warranted), false if it was already populated.
 */
async function ensureExampleMessages(page: Page): Promise<boolean> {
  await expect(page.locator("main, [role=main]")).toBeVisible({ timeout: 10_000 });

  // Wait for the messages query to settle: either cards render, or the empty
  // state appears. (While loading, neither is present.)
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
