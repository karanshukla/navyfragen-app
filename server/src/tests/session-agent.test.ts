import { test, describe, mock } from "node:test";
import assert from "node:assert";
import { Agent } from "@atproto/api";
import { initializeAgentFromSession } from "../auth/session-agent";

describe("initializeAgentFromSession", () => {
  test("returns null when req.session is null", async () => {
    const result = await initializeAgentFromSession({ session: null } as any, {} as any);
    assert.strictEqual(result, null);
  });

  test("returns null when req.session.did is undefined", async () => {
    const result = await initializeAgentFromSession({ session: {} } as any, {} as any);
    assert.strictEqual(result, null);
  });

  test("returns null when oauthClient.restore returns null", async () => {
    const ctx: any = {
      oauthClient: { restore: mock.fn(async () => null) },
      logger: { warn: mock.fn() },
    };
    const result = await initializeAgentFromSession({ session: { did: "did:foo" } } as any, ctx);
    assert.strictEqual(result, null);
  });

  test("returns null and logs warn when restore throws", async () => {
    const warnMock = mock.fn();
    const ctx: any = {
      oauthClient: { restore: mock.fn(async () => { throw new Error("restore failed"); }) },
      logger: { warn: warnMock },
    };
    const result = await initializeAgentFromSession({ session: { did: "did:foo" } } as any, ctx);
    assert.strictEqual(result, null);
    assert.strictEqual(warnMock.mock.calls.length, 1);
  });

  test("returns Agent instance when restore succeeds", async () => {
    const ctx: any = {
      oauthClient: { restore: mock.fn(async () => ({})) },
      logger: { warn: mock.fn() },
    };
    const result = await initializeAgentFromSession({ session: { did: "did:foo" } } as any, ctx);
    assert.ok(result instanceof Agent);
  });
});
