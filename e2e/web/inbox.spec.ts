import { test, expect, type Page } from "@playwright/test";

test.use({ storageState: "e2e/.auth/user.json" });

// Inbox happy paths. These exercise real server endpoints:
//  - "Add example messages" creates LOCAL-DB-only rows (no PDS record).
//  - Delete hard-removes the local row (DB is authoritative for the inbox).
//  - Pin/unpin is pure client localStorage state — no server calls.
//  - Reply would post a permanent Bluesky post (no cleanup path exists), so the
//    reply test exercises the compose UI and then backs out with Escape.
//
// To stay idempotent on the shared test account we only ever seed the inbox when
// it's empty, and we only tear down what we seeded.

const handle = () => {
  const h = process.env.E2E_HANDLE;
  if (!h) throw new Error("E2E_HANDLE must be set");
  return h;
};

test.beforeEach(async ({ page }) => {
  await page.goto("/messages");
  await expect(page).toHaveURL(/\/messages/);
  await expect(page.getByRole("heading", { name: "Messages" })).toBeVisible({
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

  const before = await autoScroll.getAttribute("aria-checked");
  await autoScroll.click();
  await expect(autoScroll).not.toHaveAttribute("aria-checked", before ?? "", {
    timeout: 5_000,
  });

  if (seeded) await cleanupAllMessages(page);
});

test("delete a message removes it from the inbox (no-confirm default)", async ({ page }) => {
  const seeded = await ensureExampleMessages(page);
  // Without seeded messages we can't safely delete — abort this test cleanly.
  test.skip(!seeded, "inbox already populated; skipping delete test to avoid data loss");

  const card = page.locator('[id^="message-card-"]').first();
  await expect(card).toBeVisible({ timeout: 10_000 });
  const beforeCount = await page.locator('[id^="message-card-"]').count();

  // confirmBeforeDelete defaults to false, so delete is immediate.
  await card.getByRole("button", { name: "Delete message" }).click();

  await expect(async () => {
    const afterCount = await page.locator('[id^="message-card-"]').count();
    expect(afterCount).toBe(beforeCount - 1);
  }).toPass({ timeout: 15_000 });

  await cleanupAllMessages(page);
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
