import assert from "node:assert";
import { test, describe } from "bun:test";

import {
  MAX_ACCOUNTS,
  findAccount,
  getAccounts,
  removeAccount,
  toAccountEntry,
  upsertAccount,
  type AppSessionData,
} from "../auth/session";

const entry = (did: string) => ({ did, handle: `${did}.test` });

describe("getAccounts", () => {
  test("returns an empty array when the session has no accounts", () => {
    assert.deepStrictEqual(getAccounts(null), []);
    assert.deepStrictEqual(getAccounts({}), []);
  });

  test("ignores a non-array accounts value", () => {
    assert.deepStrictEqual(getAccounts({ accounts: "nope" } as unknown as AppSessionData), []);
  });
});

describe("findAccount", () => {
  test("finds a remembered account by DID", () => {
    const session: AppSessionData = { accounts: [entry("did:a"), entry("did:b")] };
    assert.strictEqual(findAccount(session, "did:b")?.handle, "did:b.test");
    assert.strictEqual(findAccount(session, "did:missing"), undefined);
  });
});

describe("upsertAccount", () => {
  test("appends an account that is not yet remembered", () => {
    const session: AppSessionData = {};
    upsertAccount(session, entry("did:a"));
    assert.deepStrictEqual(session.accounts, [entry("did:a")]);
  });

  test("merges into an existing entry so stale fields survive a partial refresh", () => {
    const session: AppSessionData = {
      accounts: [{ did: "did:a", handle: "old.test", avatar: "avatar.png" }],
    };

    upsertAccount(session, { did: "did:a", handle: "new.test" });

    assert.deepStrictEqual(session.accounts, [
      { did: "did:a", handle: "new.test", avatar: "avatar.png" },
    ]);
  });

  test("evicts the oldest account once at capacity", () => {
    const session: AppSessionData = {
      accounts: Array.from({ length: MAX_ACCOUNTS }, (_, i) => entry(`did:${i}`)),
    };

    upsertAccount(session, entry("did:new"));

    assert.strictEqual(session.accounts!.length, MAX_ACCOUNTS);
    assert.strictEqual(findAccount(session, "did:0"), undefined);
    assert.strictEqual(findAccount(session, "did:new")?.did, "did:new");
  });

  test("ignores a missing session rather than throwing", () => {
    assert.doesNotThrow(() => upsertAccount(null as unknown as AppSessionData, entry("did:a")));
  });
});

describe("removeAccount", () => {
  test("drops the matching account and leaves the rest", () => {
    const session: AppSessionData = { accounts: [entry("did:a"), entry("did:b")] };
    removeAccount(session, "did:a");
    assert.deepStrictEqual(session.accounts, [entry("did:b")]);
  });

  test("is a no-op when the account or the session is absent", () => {
    const session: AppSessionData = { accounts: [entry("did:a")] };
    removeAccount(session, "did:missing");
    assert.deepStrictEqual(session.accounts, [entry("did:a")]);

    assert.doesNotThrow(() => removeAccount(null, "did:a"));
    assert.doesNotThrow(() => removeAccount({}, "did:a"));
  });
});

describe("toAccountEntry", () => {
  test("keeps only the fields the account switcher renders", () => {
    assert.deepStrictEqual(
      toAccountEntry({
        did: "did:a",
        handle: "a.test",
        displayName: "A",
        avatar: "avatar.png",
      }),
      { did: "did:a", handle: "a.test", displayName: "A", avatar: "avatar.png" }
    );
  });

  test("normalises empty displayName/avatar to undefined", () => {
    assert.deepStrictEqual(toAccountEntry({ did: "did:a", displayName: "", avatar: "" }), {
      did: "did:a",
      handle: undefined,
      displayName: undefined,
      avatar: undefined,
    });
  });
});
