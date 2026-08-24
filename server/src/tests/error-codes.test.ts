import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "bun:test";

import { ERROR_CODES } from "../lib/contracts";

const HONO_DIR = join(import.meta.dir, "../hono");
const ROUTE_FILES = ["auth-routes.ts", "e2e-auth-routes.ts", "message-routes.ts"];

const CLIENT_CONTRACTS_PATH = join(import.meta.dir, "../../../client/src/lib/contracts.ts");

const SCREAMING_SNAKE_CASE = /^[A-Z][A-Z0-9_]*$/;

/**
 * Every route error response is built through `errorBody(code, message)`
 * (`../lib/errors.ts`), never a literal `{ error: "some prose" }`. The two
 * zod schema custom messages (`.min(1, { error: "INVALID_HANDLE" })`) are the
 * one place a literal `error: "..."` legitimately remains, so this scans for
 * that shape and only fails when the quoted value isn't itself a
 * SCREAMING_SNAKE code — i.e. it's prose, not a machine code.
 */
describe("Route error responses carry a machine code, never bare prose", () => {
  for (const file of ROUTE_FILES) {
    it(`${file} has no literal { error: "prose" } response`, () => {
      const source = readFileSync(join(HONO_DIR, file), "utf8");
      const proseSites = [...source.matchAll(/\berror:\s*"([^"]*)"/g)]
        .map((m) => m[1])
        .filter((value) => !SCREAMING_SNAKE_CASE.test(value));
      assert.deepStrictEqual(proseSites, []);
    });
  }
});

describe("ErrorCode union stays in sync with the client mirror", () => {
  it("server and client declare the exact same set of codes", () => {
    const clientSource = readFileSync(CLIENT_CONTRACTS_PATH, "utf8");
    const arrayMatch = clientSource.match(/export const ERROR_CODES = \[([\s\S]*?)\] as const;/);
    assert.ok(arrayMatch, "client/src/lib/contracts.ts must export an ERROR_CODES array");
    const clientCodes = [...arrayMatch![1].matchAll(/"([A-Z0-9_]+)"/g)].map((m) => m[1]);

    assert.deepStrictEqual(
      [...clientCodes].sort(),
      [...ERROR_CODES].sort(),
      "client ERROR_CODES must mirror the server's set exactly"
    );
  });
});
