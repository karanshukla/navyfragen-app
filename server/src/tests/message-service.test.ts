import { test, describe, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert";
import {
  MessageService,
  type Message,
  type ProfileResolver,
} from "../services/message-service";
import { type Agent } from "@atproto/api";
import { type Logger } from "pino";
import { type Database } from "../database/db";
import { imageGenerator } from "../lib/image-generator";

describe("MessageService", () => {
  let mockDb: any;
  let mockResolver: ProfileResolver;
  let mockLogger: Logger;
  let mockAgent: any;
  let messageService: MessageService;
  let lastInsertValues: any;
  let mockSelectBuilder: any;
  let mockInsertBuilder: any;
  let mockDeleteBuilder: any;

  // Helper to create a mock logger with all methods as mock.fn
  function makeLoggerMock(): Logger {
    return {
      info: mock.fn(() => {}),
      error: mock.fn(() => {}),
      warn: mock.fn(() => {}),
      debug: mock.fn(() => {}),
      fatal: mock.fn(() => {}),
      trace: mock.fn(() => {}),
      child: mock.fn(() => ({}) as Logger),
    } as unknown as Logger;
  }
  function makeSelectBuilder() {
    return {
      select: mock.fn(function (this: any) {
        return this;
      }),
      selectAll: mock.fn(function (this: any) {
        return this;
      }),
      where: mock.fn(function (this: any) {
        return this;
      }),
      orderBy: mock.fn(function (this: any) {
        return this;
      }),
      executeTakeFirst: mock.fn(async () => undefined),
      execute: mock.fn(async () => []),
    };
  }
  function makeInsertBuilder() {
    const builder: any = {
      values: mock.fn(function (this: any, arg: any) {
        lastInsertValues = arg;
        return this;
      }),
      onConflict: mock.fn(function (this: any, cb: any) {
        if (typeof cb === "function") {
          const oc = { column: (_col: string) => ({ doNothing: () => builder }) };
          cb(oc);
        }
        return this;
      }),
      execute: mock.fn(async () => ({})),
    };
    return builder;
  }
  function makeDeleteBuilder() {
    return {
      where: mock.fn(function (this: any) {
        return this;
      }),
      execute: mock.fn(async () => ({})),
    };
  }

  const generateQuestionImageMock = mock.fn(async () => ({
    imageBlob: Buffer.from("mock"),
    imageAltText: "alt",
  }));

  beforeEach(() => {
    imageGenerator.generateQuestionImage = generateQuestionImageMock;
    generateQuestionImageMock.mock.resetCalls();
    mockLogger = makeLoggerMock();
    mockResolver = {
      resolveDidToHandle: mock.fn(async (did: string) => did + "-handle"),
    };
    mockSelectBuilder = makeSelectBuilder();
    mockInsertBuilder = makeInsertBuilder();
    mockDeleteBuilder = makeDeleteBuilder();
    lastInsertValues = undefined;
    mockDb = {
      selectFrom: mock.fn((table: string) => {
        if (table === "user_settings") {
          return {
            selectAll: mock.fn(() => ({
              where: mock.fn(() => ({
                executeTakeFirst: mock.fn(async () => ({
                  did: "did:example:user",
                  pdsSyncEnabled: 1,
                  imageTheme: "ocean-breeze", // Mock a specific theme
                  createdAt: new Date().toISOString(),
                })),
              })),
            })),
          };
        }
        return mockSelectBuilder;
      }),
      insertInto: mock.fn(() => mockInsertBuilder),
      deleteFrom: mock.fn(() => mockDeleteBuilder),
    };
    Object.values(mockDb).forEach((fn: any) => fn.mock?.resetCalls?.());
    mockAgent = {
      post: mock.fn(async () => ({ uri: "mock-uri", cid: "mock-cid" })),
      uploadBlob: mock.fn(async () => ({ data: { blob: { ref: "ref" } } })),
      com: {
        atproto: {
          repo: {
            deleteRecord: mock.fn(async () => ({})),
            createRecord: mock.fn(async () => ({
              data: { uri: "uri", cid: "cid" },
            })),
            listRecords: mock.fn(async () => ({
              success: true,
              data: { records: [], cursor: undefined },
            })),
          },
        },
      },
      app: {
        bsky: {
          actor: {
            getProfile: mock.fn(async () => ({ data: { handle: "handle" } })),
          },
        },
      },
      assertDid: "did:example:user",
    };
    // Reset all agent mocks
    mockAgent.post.mock.resetCalls();
    mockAgent.uploadBlob.mock.resetCalls();
    mockAgent.com.atproto.repo.deleteRecord.mock.resetCalls();
    mockAgent.com.atproto.repo.createRecord.mock.resetCalls();
    mockAgent.com.atproto.repo.listRecords.mock.resetCalls();
    mockAgent.app.bsky.actor.getProfile.mock.resetCalls();
    messageService = new MessageService(mockDb, mockResolver, mockLogger);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  test("getMessages returns messages if user exists", async () => {
    const did = "did:foo";
    mockSelectBuilder.executeTakeFirst.mock.mockImplementationOnce(
      async () => ({ did })
    );
    const msgs: Message[] = [
      { tid: "t", message: "hi", createdAt: "now", recipient: did },
    ];
    mockSelectBuilder.execute.mock.mockImplementationOnce(async () => msgs);
    const result = await messageService.getMessages(did);
    assert.deepStrictEqual(result, msgs);
  });

  test("getMessages throws if user does not exist", async () => {
    mockSelectBuilder.executeTakeFirst.mock.mockImplementationOnce(
      async () => undefined
    );
    await assert.rejects(
      () => messageService.getMessages("did:x"),
      /Failed to fetch messages/
    );
    assert.strictEqual((mockLogger.error as any).mock.calls.length, 1);
  });

  test("addExampleMessages adds and returns messages", async () => {
    mockInsertBuilder.execute.mock.mockImplementation(async () => ({}));
    mockSelectBuilder.executeTakeFirst.mock.mockImplementationOnce(
      async () => ({ did: "did:foo" })
    );
    const msgs: Message[] = [
      { tid: "t", message: "hi", createdAt: "now", recipient: "did:foo" },
    ];
    mockSelectBuilder.execute.mock.mockImplementationOnce(async () => msgs);
    const result = await messageService.addExampleMessages("did:foo");
    assert.deepStrictEqual(result, msgs);
    assert.strictEqual(mockDb.insertInto.mock.calls.length, 8);
  });

  test("sendMessage inserts and returns success", async () => {
    mockSelectBuilder.executeTakeFirst.mock.mockImplementationOnce(
      async () => ({ did: "did:foo" })
    );
    mockInsertBuilder.execute.mock.mockImplementationOnce(async () => ({}));
    const result = await messageService.sendMessage("did:foo", "hi");
    assert.deepStrictEqual(result, { success: true });
    assert.strictEqual(mockDb.insertInto.mock.calls.length, 1);
  });

  test("sendMessage throws if user not found", async () => {
    mockSelectBuilder.executeTakeFirst.mock.mockImplementationOnce(
      async () => undefined
    );
    await assert.rejects(
      () => messageService.sendMessage("did:x", "hi"),
      /Recipient not found/
    );
  });

  test("deleteMessage deletes from DB and fires PDS deletion in background", async () => {
    const tid = "tid";
    const did = "did:foo";
    mockSelectBuilder.executeTakeFirst.mock.mockImplementationOnce(
      async () => ({ tid, recipient: did })
    );
    mockDeleteBuilder.execute.mock.mockImplementationOnce(async () => ({}));
    mockAgent.com.atproto.repo.deleteRecord.mock.mockImplementationOnce(
      async () => ({})
    );
    const result = await messageService.deleteMessage(tid, did, mockAgent);
    assert.deepStrictEqual(result, { success: true });
    assert.strictEqual(mockDb.deleteFrom.mock.calls.length, 1);
    // PDS delete is fire-and-forget — synchronously invoked, resolves in background
    assert.strictEqual(mockAgent.com.atproto.repo.deleteRecord.mock.calls.length, 1);
  });

  test("deleteMessage returns success and logs error when background PDS deletion fails", async () => {
    const tid = "tid";
    const did = "did:foo";
    mockSelectBuilder.executeTakeFirst.mock.mockImplementationOnce(
      async () => ({ tid, recipient: did })
    );
    mockDeleteBuilder.execute.mock.mockImplementationOnce(async () => ({}));
    mockAgent.com.atproto.repo.deleteRecord.mock.mockImplementationOnce(
      async () => { throw new Error("PDS unavailable"); }
    );
    const result = await messageService.deleteMessage(tid, did, mockAgent);
    assert.deepStrictEqual(result, { success: true });
    // flush microtasks so the background .catch() fires
    await new Promise((resolve) => setImmediate(resolve));
    assert.strictEqual((mockLogger.error as any).mock.calls.length, 1);
  });

  test("deleteMessage throws if not found", async () => {
    mockSelectBuilder.executeTakeFirst.mock.mockImplementationOnce(
      async () => undefined
    );
    await assert.rejects(
      () => messageService.deleteMessage("tid", "did", mockAgent),
      /Message not found/
    );
  });

  test("respondToMessage with image", async () => {
    (mockResolver.resolveDidToHandle as any).mock.mockImplementationOnce(
      async () => "handle"
    );
    const result = await messageService.respondToMessage(
      "tid",
      "did:example:user", // Use the DID that matches the mocked user_settings
      "rec",
      "orig",
      "resp",
      true,
      mockAgent
    );
    assert.strictEqual(result.success, true);
    assert.ok(result.uri);
    assert.strictEqual(generateQuestionImageMock.mock.calls.length, 1);
    assert.strictEqual(mockAgent.uploadBlob.mock.calls.length, 1);
    assert.deepStrictEqual((generateQuestionImageMock.mock.calls[0].arguments as any[])[3], "ocean-breeze");
  });

  test("respondToMessage with text", async () => {
    (mockResolver.resolveDidToHandle as any).mock.mockImplementationOnce(
      async () => "handle"
    );
    const result = await messageService.respondToMessage(
      "tid",
      "did",
      "rec",
      "orig",
      "resp",
      false,
      mockAgent
    );
    assert.strictEqual(result.success, true);
    assert.ok(result.uri);
    assert.strictEqual(generateQuestionImageMock.mock.calls.length, 0);
  });

  test("deleteUserData deletes all", async () => {
    mockSelectBuilder.execute.mock.mockImplementationOnce(async () => [
      { tid: "t1" },
      { tid: "t2" },
    ]);
    mockAgent.com.atproto.repo.deleteRecord.mock.mockImplementation(
      async () => ({})
    );
    mockDeleteBuilder.execute.mock.mockImplementation(async () => ({}));
    const result = await messageService.deleteUserData("did", mockAgent);
    assert.deepStrictEqual(result, { success: true });
    assert.strictEqual(
      mockAgent.com.atproto.repo.deleteRecord.mock.calls.length,
      2
    );
    assert.strictEqual(mockDb.deleteFrom.mock.calls.length, 3);
  });

  test("syncMessages: pushes DB-only records to PDS when PDS is empty", async () => {
    // listRecords default returns empty — PDS has nothing
    mockSelectBuilder.execute.mock.mockImplementationOnce(async () => [
      { tid: "t1", message: "m", createdAt: "now", recipient: "did:foo" },
    ]);
    const result = await messageService.syncMessages("did:foo", mockAgent);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.syncedCount, 1);
    assert.strictEqual(result.importedCount, 0);
    assert.strictEqual(result.errorCount, 0);
    assert.strictEqual(mockAgent.com.atproto.repo.createRecord.mock.calls.length, 1);
    assert.strictEqual(mockDb.insertInto.mock.calls.length, 0);
  });

  test("syncMessages: imports PDS-only records to DB when DB is empty", async () => {
    mockAgent.com.atproto.repo.listRecords.mock.mockImplementationOnce(async () => ({
      success: true,
      data: {
        records: [{
          uri: "at://did:foo/app.navyfragen.message/pds-only",
          value: { message: "from pds", createdAt: "now", recipient: "did:foo" },
        }],
        cursor: undefined,
      },
    }));
    mockSelectBuilder.execute.mock.mockImplementationOnce(async () => []);
    const result = await messageService.syncMessages("did:foo", mockAgent);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.syncedCount, 0);
    assert.strictEqual(result.importedCount, 1);
    assert.strictEqual(result.errorCount, 0);
    assert.strictEqual(mockAgent.com.atproto.repo.createRecord.mock.calls.length, 0);
    assert.strictEqual(mockDb.insertInto.mock.calls.length, 1);
  });

  test("syncMessages: skips records present in both DB and PDS", async () => {
    mockAgent.com.atproto.repo.listRecords.mock.mockImplementationOnce(async () => ({
      success: true,
      data: {
        records: [{
          uri: "at://did:foo/app.navyfragen.message/shared",
          value: { message: "hello", createdAt: "now", recipient: "did:foo" },
        }],
        cursor: undefined,
      },
    }));
    mockSelectBuilder.execute.mock.mockImplementationOnce(async () => [
      { tid: "shared", message: "hello", createdAt: "now", recipient: "did:foo" },
    ]);
    const result = await messageService.syncMessages("did:foo", mockAgent);
    assert.strictEqual(result.syncedCount, 0);
    assert.strictEqual(result.importedCount, 0);
    assert.strictEqual(result.errorCount, 0);
    assert.strictEqual(mockAgent.com.atproto.repo.createRecord.mock.calls.length, 0);
    assert.strictEqual(mockDb.insertInto.mock.calls.length, 0);
  });

  test("syncMessages: mixed — pushes DB-only, imports PDS-only, skips overlap", async () => {
    mockAgent.com.atproto.repo.listRecords.mock.mockImplementationOnce(async () => ({
      success: true,
      data: {
        records: [
          { uri: "at://did:foo/app.navyfragen.message/pds-only", value: { message: "p", createdAt: "now", recipient: "did:foo" } },
          { uri: "at://did:foo/app.navyfragen.message/both",     value: { message: "b", createdAt: "now", recipient: "did:foo" } },
        ],
        cursor: undefined,
      },
    }));
    mockSelectBuilder.execute.mock.mockImplementationOnce(async () => [
      { tid: "db-only", message: "d", createdAt: "now", recipient: "did:foo" },
      { tid: "both",    message: "b", createdAt: "now", recipient: "did:foo" },
    ]);
    const result = await messageService.syncMessages("did:foo", mockAgent);
    assert.strictEqual(result.syncedCount, 1);
    assert.strictEqual(result.importedCount, 1);
    assert.strictEqual(result.errorCount, 0);
    assert.strictEqual(mockAgent.com.atproto.repo.createRecord.mock.calls.length, 1);
    assert.strictEqual(mockDb.insertInto.mock.calls.length, 1);
  });

  test("syncMessages: counts push errors and import errors independently", async () => {
    mockAgent.com.atproto.repo.listRecords.mock.mockImplementationOnce(async () => ({
      success: true,
      data: {
        records: [{ uri: "at://did:foo/app.navyfragen.message/pds-only", value: { message: "p", createdAt: "now", recipient: "did:foo" } }],
        cursor: undefined,
      },
    }));
    mockSelectBuilder.execute.mock.mockImplementationOnce(async () => [
      { tid: "db-only", message: "d", createdAt: "now", recipient: "did:foo" },
    ]);
    mockAgent.com.atproto.repo.createRecord.mock.mockImplementationOnce(async () => { throw new Error("push failed"); });
    mockInsertBuilder.execute.mock.mockImplementationOnce(async () => { throw new Error("import failed"); });
    const result = await messageService.syncMessages("did:foo", mockAgent);
    assert.strictEqual(result.errorCount, 2);
    assert.strictEqual(result.syncedCount, 0);
    assert.strictEqual(result.importedCount, 0);
    assert.ok(result.errors?.some((e) => e.error === "push failed"));
    assert.ok(result.errors?.some((e) => e.error === "import failed"));
  });

  test("syncMessages: uses fallback error message when Phase 1 createRecord throws non-Error", async () => {
    mockAgent.com.atproto.repo.listRecords.mock.mockImplementationOnce(async () => ({
      success: true,
      data: { records: [], cursor: undefined },
    }));
    mockSelectBuilder.execute.mock.mockImplementationOnce(async () => [
      { tid: "db-only", message: "d", createdAt: "now", recipient: "did:foo" },
    ]);
    mockAgent.com.atproto.repo.createRecord.mock.mockImplementationOnce(async () => { throw "non-Error string"; });
    const result = await messageService.syncMessages("did:foo", mockAgent);
    assert.strictEqual(result.errorCount, 1);
    assert.ok(result.errors?.some((e) => e.error === "Unknown error during PDS record creation"));
  });

  test("syncMessages: uses fallback error message when Phase 2 DB insert throws non-Error", async () => {
    mockAgent.com.atproto.repo.listRecords.mock.mockImplementationOnce(async () => ({
      success: true,
      data: {
        records: [{ uri: "at://did:foo/app.navyfragen.message/pds-only", rkey: "pds-only", value: { message: "p", createdAt: "now", recipient: "did:foo" } }],
        cursor: undefined,
      },
    }));
    mockSelectBuilder.execute.mock.mockImplementationOnce(async () => []);
    mockInsertBuilder.execute.mock.mockImplementationOnce(async () => { throw "non-Error string"; });
    const result = await messageService.syncMessages("did:foo", mockAgent);
    assert.strictEqual(result.errorCount, 1);
    assert.ok(result.errors?.some((e) => e.error === "Unknown error during DB import"));
  });

  test("syncMessages: paginates through multiple pages of PDS records", async () => {
    let pageCall = 0;
    mockAgent.com.atproto.repo.listRecords.mock.mockImplementation(async () => {
      if (pageCall++ === 0) {
        return {
          success: true,
          data: {
            records: [{ uri: "at://did:foo/app.navyfragen.message/p1", value: { message: "m", createdAt: "now", recipient: "did:foo" } }],
            cursor: "page2",
          },
        };
      }
      return {
        success: true,
        data: {
          records: [{ uri: "at://did:foo/app.navyfragen.message/p2", value: { message: "m2", createdAt: "now", recipient: "did:foo" } }],
          cursor: undefined,
        },
      };
    });
    mockSelectBuilder.execute.mock.mockImplementationOnce(async () => []);
    const result = await messageService.syncMessages("did:foo", mockAgent);
    assert.strictEqual(result.importedCount, 2);
    assert.strictEqual(mockAgent.com.atproto.repo.listRecords.mock.calls.length, 2);
  });

  test("syncMessages: stops fetching when listRecords returns success: false", async () => {
    mockAgent.com.atproto.repo.listRecords.mock.mockImplementationOnce(async () => ({
      success: false,
      data: { records: [], cursor: undefined },
    }));
    mockSelectBuilder.execute.mock.mockImplementationOnce(async () => []);
    const result = await messageService.syncMessages("did:foo", mockAgent);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.syncedCount, 0);
    assert.strictEqual(result.importedCount, 0);
  });

  test("syncMessages: throws when db.selectFrom(message) fails", async () => {
    mockAgent.com.atproto.repo.listRecords.mock.mockImplementationOnce(async () => ({
      success: true,
      data: { records: [], cursor: undefined },
    }));
    mockSelectBuilder.execute.mock.mockImplementationOnce(async () => {
      throw new Error("db failure");
    });
    await assert.rejects(
      () => messageService.syncMessages("did:foo", mockAgent),
      /Failed to sync messages to PDS/
    );
  });

  test("addExampleMessages throws on db error", async () => {
    mockInsertBuilder.execute.mock.mockImplementationOnce(async () => {
      throw new Error("db error");
    });
    await assert.rejects(
      () => messageService.addExampleMessages("did:foo"),
      /Failed to add example messages/
    );
    assert.strictEqual((mockLogger.error as any).mock.calls.length, 1);
  });

  test("deleteMessage throws when message belongs to different user", async () => {
    const tid = "tid";
    const did = "did:foo";
    mockSelectBuilder.executeTakeFirst.mock.mockImplementationOnce(
      async () => ({ tid, recipient: "did:other" })
    );
    await assert.rejects(
      () => messageService.deleteMessage(tid, did, mockAgent),
      /Not authorized to delete this message/
    );
    assert.strictEqual(mockAgent.com.atproto.repo.deleteRecord.mock.calls.length, 0);
  });

  test("respondToMessage throws when image generation returns no blob", async () => {
    generateQuestionImageMock.mock.mockImplementationOnce(async () => ({ imageBlob: null }));
    await assert.rejects(
      () => messageService.respondToMessage(
        "tid", "did:example:user", "rec", "orig", "resp", true, mockAgent
      ),
      /Image generation failed/
    );
  });

  test("respondToMessage includes aspectRatio when width and height are returned", async () => {
    generateQuestionImageMock.mock.mockImplementationOnce(async () => ({
      imageBlob: Buffer.from("img"),
      imageAltText: "alt",
      width: 800,
      height: 400,
    }));
    mockAgent.post.mock.mockImplementationOnce(async () => ({
      uri: "at://did:foo/app.bsky.feed.post/rkey1",
    }));
    const result = await messageService.respondToMessage(
      "tid", "did:example:user", "rec", "orig", "resp", true, mockAgent
    );
    assert.strictEqual(result.success, true);
    const postArg = mockAgent.post.mock.calls[0].arguments[0];
    assert.ok(postArg.embed.images[0].aspectRatio);
    assert.strictEqual(postArg.embed.images[0].aspectRatio.width, 800);
    assert.strictEqual(postArg.embed.images[0].aspectRatio.height, 400);
  });

  test("respondToMessage uses default alt text when imageAltText is falsy", async () => {
    generateQuestionImageMock.mock.mockImplementationOnce(async () => ({
      imageBlob: Buffer.from("img"),
      imageAltText: "",
    }));
    mockAgent.post.mock.mockImplementationOnce(async () => ({
      uri: "at://did:foo/app.bsky.feed.post/rkey1",
    }));
    const result = await messageService.respondToMessage(
      "tid", "did:example:user", "rec", "orig", "resp", true, mockAgent
    );
    assert.strictEqual(result.success, true);
    const postArg = mockAgent.post.mock.calls[0].arguments[0];
    assert.strictEqual(postArg.embed.images[0].alt, "Image of the anonymous question");
  });

  test("respondToMessage falls back to DID in url when getProfile throws", async () => {
    mockAgent.post.mock.mockImplementationOnce(async () => ({
      uri: "at://did:foo/app.bsky.feed.post/rkey1",
    }));
    mockAgent.app.bsky.actor.getProfile.mock.mockImplementationOnce(async () => {
      throw new Error("profile fetch failed");
    });
    const result = await messageService.respondToMessage(
      "tid", "did", "rec", "orig", "resp", false, mockAgent
    );
    assert.strictEqual(result.success, true);
    assert.ok(result.link?.includes("did:foo"));
    assert.ok(result.link?.includes("rkey1"));
  });

  test("respondToMessage uses DID in url when getProfile returns no handle", async () => {
    mockAgent.post.mock.mockImplementationOnce(async () => ({
      uri: "at://did:foo/app.bsky.feed.post/rkey1",
    }));
    mockAgent.app.bsky.actor.getProfile.mock.mockImplementationOnce(async () => ({
      data: { handle: null },
    }));
    const result = await messageService.respondToMessage(
      "tid", "did", "rec", "orig", "resp", false, mockAgent
    );
    assert.strictEqual(result.success, true);
    assert.ok(result.link?.includes("did:foo"));
  });

  test("respondToMessage returns undefined link when URI does not match AT URI pattern", async () => {
    mockAgent.post.mock.mockImplementationOnce(async () => ({
      uri: "not-an-at-uri",
    }));
    const result = await messageService.respondToMessage(
      "tid", "did", "rec", "orig", "resp", false, mockAgent
    );
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.link, undefined);
  });

  test("respondToMessage outer catch rethrows on agent.post failure", async () => {
    mockAgent.post.mock.mockImplementationOnce(async () => {
      throw new Error("post failed");
    });
    await assert.rejects(
      () => messageService.respondToMessage(
        "tid", "did", "rec", "orig", "resp", false, mockAgent
      ),
      /post failed/
    );
  });

  test("deleteUserData logs info and skips PDS deletion when no messages exist", async () => {
    mockSelectBuilder.execute.mock.mockImplementationOnce(async () => []);
    mockDeleteBuilder.execute.mock.mockImplementation(async () => ({}));
    const result = await messageService.deleteUserData("did:empty", mockAgent);
    assert.deepStrictEqual(result, { success: true });
    assert.strictEqual(mockAgent.com.atproto.repo.deleteRecord.mock.calls.length, 0);
    const infoMessages = (mockLogger.info as any).mock.calls.map((c: any) => c.arguments[1]);
    assert.ok(infoMessages.some((m: string) => m.includes("No messages found for deletion")));
  });

  test("deleteUserData outer catch rethrows on PDS delete error", async () => {
    mockSelectBuilder.execute.mock.mockImplementationOnce(async () => [{ tid: "t1" }]);
    mockAgent.com.atproto.repo.deleteRecord.mock.mockImplementationOnce(async () => {
      throw new Error("PDS delete failed");
    });
    await assert.rejects(
      () => messageService.deleteUserData("did:foo", mockAgent),
      /Failed to delete user data/
    );
  });

  test("respondToMessage with image uses default theme when user_settings is null", async () => {
    mockDb.selectFrom = mock.fn((table: string) => {
      if (table === "user_settings") {
        return {
          selectAll: mock.fn(() => ({
            where: mock.fn(() => ({
              executeTakeFirst: mock.fn(async () => undefined),
            })),
          })),
        };
      }
      return mockSelectBuilder;
    });
    const result = await messageService.respondToMessage(
      "tid", "did:example:user", "rec", "orig", "resp", true, mockAgent
    );
    assert.strictEqual(result.success, true);
    assert.deepStrictEqual(
      (generateQuestionImageMock.mock.calls[0].arguments as any[])[3],
      "default"
    );
  });

  test("sendMessage uses generic message when err is not an Error instance", async () => {
    mockSelectBuilder.executeTakeFirst.mock.mockImplementationOnce(async () => ({ did: "did:foo" }));
    mockInsertBuilder.execute.mock.mockImplementationOnce(async () => {
      throw "string error";
    });
    await assert.rejects(
      () => messageService.sendMessage("did:foo", "hi"),
      /Failed to send message/
    );
  });

  test("respondToMessage uses generic message when err is not an Error instance", async () => {
    mockAgent.post.mock.mockImplementationOnce(async () => {
      throw "non-error thrown";
    });
    await assert.rejects(
      () => messageService.respondToMessage("tid", "did", "rec", "orig", "resp", false, mockAgent),
      /Failed to post to Bluesky/
    );
  });

  test("deleteMessage uses generic fallback message when db.execute throws non-Error", async () => {
    mockSelectBuilder.executeTakeFirst.mock.mockImplementationOnce(async () => ({
      tid: "tid",
      recipient: "did:foo",
    }));
    mockDb.deleteFrom = mock.fn(() => ({
      where: mock.fn(function (this: any) { return this; }),
      execute: mock.fn(async () => { throw "db-non-error"; }),
    }));
    await assert.rejects(
      () => messageService.deleteMessage("tid", "did:foo", mockAgent),
      /Failed to delete message/
    );
  });
});
