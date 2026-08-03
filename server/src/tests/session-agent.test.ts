import assert from "node:assert";
import { test, describe, afterEach, mock } from "bun:test";

import { Agent } from "@atproto/api";

import { deleteE2EAgent, setE2EAgent } from "../auth/e2e-agent-store";
import { initializeAgentForDid } from "../auth/session-agent";

describe("initializeAgentForDid", () => {
  describe("with an E2E agent", () => {
    afterEach(() => {
      deleteE2EAgent("did:e2e");
    });

    test("returns the stored E2E agent without calling oauthClient.restore", async () => {
      const e2eAgent = {} as Agent;
      setE2EAgent("did:e2e", e2eAgent, "e2e-user.bsky.social");
      const restoreMock = mock(async () => ({}));
      const ctx: any = {
        oauthClient: { restore: restoreMock },
        logger: { warn: mock() },
      };
      const result = await initializeAgentForDid(ctx, "did:e2e");
      assert.strictEqual(result, e2eAgent);
      assert.strictEqual(restoreMock.mock.calls.length, 0);
    });
  });

  test("returns null when oauthClient.restore returns null", async () => {
    const ctx: any = {
      oauthClient: { restore: mock(async () => null) },
      logger: { warn: mock() },
    };
    const result = await initializeAgentForDid(ctx, "did:foo");
    assert.strictEqual(result, null);
  });

  test("returns null and logs warn when restore throws", async () => {
    const warnMock = mock();
    const ctx: any = {
      oauthClient: {
        restore: mock(async () => {
          throw new Error("restore failed");
        }),
      },
      logger: { warn: warnMock },
    };
    const result = await initializeAgentForDid(ctx, "did:foo");
    assert.strictEqual(result, null);
    assert.strictEqual(warnMock.mock.calls.length, 1);
  });

  test("returns Agent instance when restore succeeds", async () => {
    const ctx: any = {
      oauthClient: { restore: mock(async () => ({})) },
      logger: { warn: mock() },
    };
    const result = await initializeAgentForDid(ctx, "did:foo");
    assert.ok(result instanceof Agent);
  });
});
