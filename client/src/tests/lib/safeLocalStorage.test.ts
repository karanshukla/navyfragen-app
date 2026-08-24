import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { readStoredJson, writeStoredJson, removeStored } from "../../lib/safeLocalStorage";

const KEY = "test_key";

describe("safeLocalStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("round-trips a stored value", () => {
    writeStoredJson(KEY, { a: 1 });
    expect(readStoredJson<{ a: number }>(KEY)).toEqual({ a: 1 });
  });

  it("reads a key that was never written as absent", () => {
    expect(readStoredJson(KEY)).toBeNull();
  });

  it("reads an unparseable entry as absent", () => {
    localStorage.setItem(KEY, "{not json");
    expect(readStoredJson(KEY)).toBeNull();
  });

  it("removes a stored value", () => {
    writeStoredJson(KEY, { a: 1 });
    removeStored(KEY);
    expect(readStoredJson(KEY)).toBeNull();
  });

  it("reads as absent when the store cannot be read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(readStoredJson(KEY)).toBeNull();
  });

  it("swallows a write the store refuses", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => writeStoredJson(KEY, { a: 1 })).not.toThrow();
  });

  it("swallows a removal the store refuses", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(() => removeStored(KEY)).not.toThrow();
  });
});
