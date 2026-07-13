import { test, expect } from "@playwright/test";

test.use({ storageState: "e2e/.auth/user.json" });

const handle = () => {
  const h = process.env.E2E_HANDLE;
  if (!h) throw new Error("E2E_HANDLE must be set");
  return h;
};

// Unique, findable marker so this test can clean up the message it sends via the
// inbox API regardless of the auto-generated tid.
const marker = () => `[e2e profile ${Date.now()}]`;

// Sending a message creates only a local DB row (no PDS/Bluesky post), so we can
// clean it up by deleting it from the inbox afterwards.

test("send anonymous message to own profile shows success toast", async ({ page }) => {
  const h = handle();
  await page.goto(`/profile/${h}`);

  // Wait for the ask card to render so we can read the exact dynamic aria-label.
  const session = await page.request.get("/api/session");
  const { profile, did } = await session.json();
  if (!profile?.displayName) throw new Error("session profile.displayName missing");

  const askLabel = `Send ${profile.displayName} an anonymous message`;
  const textarea = page.getByLabel(askLabel);
  await expect(textarea).toBeVisible({ timeout: 10_000 });

  const text = `${marker()} Hello from the e2e suite!`;
  await textarea.fill(text);
  await page.getByRole("button", { name: "Send", exact: true }).click();

  // Confirmation modal.
  const dialog = page.getByRole("dialog", { name: "Confirm Anonymous Message" });
  await expect(dialog).toBeVisible({ timeout: 5_000 });
  await dialog.getByRole("button", { name: "Send Message" }).click();

  // Success toast (Mantine notifications render as role="alert").
  await expect(
    page.getByRole("alert", { name: /Message sent!/ })
  ).toBeVisible({ timeout: 15_000 });

  // Cleanup: delete the message we just created via the inbox API.
  await cleanupMessages(page, did, [text, marker()]);
});

test("sending an empty message is blocked before the modal", async ({ page }) => {
  const h = handle();
  await page.goto(`/profile/${h}`);

  const session = await page.request.get("/api/session");
  const { profile } = await session.json();
  if (!profile?.displayName) throw new Error("session profile.displayName missing");

  const askLabel = `Send ${profile.displayName} an anonymous message`;
  const textarea = page.getByLabel(askLabel);
  await expect(textarea).toBeVisible({ timeout: 10_000 });

  // Click Send with an empty box — client-side validation should fire.
  await page.getByRole("button", { name: "Send", exact: true }).click();

  await expect(page.getByRole("alert", { name: /Message cannot be empty/i })).toBeVisible({
    timeout: 5_000,
  });
  // And the confirm modal must NOT have opened.
  await expect(page.getByRole("dialog", { name: "Confirm Anonymous Message" })).toHaveCount(0);
});

test("cancel confirmation modal does not send the message", async ({ page }) => {
  const h = handle();
  await page.goto(`/profile/${h}`);

  const session = await page.request.get("/api/session");
  const { profile } = await session.json();
  if (!profile?.displayName) throw new Error("session profile.displayName missing");

  const askLabel = `Send ${profile.displayName} an anonymous message`;
  const textarea = page.getByLabel(askLabel);
  await expect(textarea).toBeVisible({ timeout: 10_000 });

  await textarea.fill(`${marker()} this should NOT be sent`);
  await page.getByRole("button", { name: "Send", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "Confirm Anonymous Message" });
  await expect(dialog).toBeVisible({ timeout: 5_000 });
  await dialog.getByRole("button", { name: "Cancel" }).click();

  // Modal closed, no success toast appeared.
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("alert", { name: /Message sent!/ })).toHaveCount(0);
});

test("clear button empties the ask box", async ({ page }) => {
  const h = handle();
  await page.goto(`/profile/${h}`);

  const session = await page.request.get("/api/session");
  const { profile } = await session.json();
  if (!profile?.displayName) throw new Error("session profile.displayName missing");

  const askLabel = `Send ${profile.displayName} an anonymous message`;
  const textarea = page.getByLabel(askLabel);
  await expect(textarea).toBeVisible({ timeout: 10_000 });

  await textarea.fill("a draft I will discard");
  await page.getByRole("button", { name: "Clear message" }).click();

  await expect(textarea).toHaveValue("");
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Delete any inbox messages whose body contains one of `needles`. Best-effort. */
async function cleanupMessages(
  page: import("@playwright/test").Page,
  did: string,
  needles: string[]
) {
  try {
    const res = await page.request.get(`/api/messages/${encodeURIComponent(did)}`);
    if (!res.ok()) return;
    const { messages }: { messages: { tid: string; message: string }[] } = await res.json();
    await Promise.all(
      messages
        .filter((m) => needles.some((n) => m.message.includes(n)))
        .map((m) => page.request.delete(`/api/messages/${encodeURIComponent(m.tid)}`))
    );
  } catch {
    // Cleanup is best-effort; don't fail the test over it.
  }
}
