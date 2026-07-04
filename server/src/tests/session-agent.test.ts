import assert from "node:assert";
import { test, describe, mock, afterEach } from "node:test";

import { Agent } from "@atproto/api";

import { deleteE2EAgent, setE2EAgent } from "../auth/e2e-agent-store";
import { initializeAgentFromSession } from "../auth/session-agent";

describe("initializeAgentFromSession", () => {
  describe("with an E2E agent", () => {
    afterEach(() => {
      deleteE2EAgent("did:e2e");
    });

    test("returns the stored E2E agent without calling oauthClient.restore", async () => {
      const e2eAgent = {} as Agent;
      setE2EAgent("did:e2e", e2eAgent, "e2e-user.bsky.social");
      const restoreMock = mock.fn(async () => ({}));
      const ctx: any = {
        oauthClient: { restore: restoreMock },
        logger: { warn: mock.fn() },
      };
      const result = await initializeAgentFromSession({ session: { did: "did:e2e" } } as any, ctx);
      assert.strictEqual(result, e2eAgent);
      assert.strictEqual(restoreMock.mock.calls.length, 0);
    });
  });

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
      oauthClient: {
        restore: mock.fn(async () => {
          throw new Error("restore failed");
        }),
      },
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
