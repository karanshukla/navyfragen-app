import { describe, it, expect, vi, beforeEach } from "vitest";

type SwUpdateModule = typeof import("../../lib/swUpdate");

// The store is module-level singleton state, so every test gets a fresh copy.
let swUpdate: SwUpdateModule;

beforeEach(async () => {
  vi.resetModules();
  swUpdate = await import("../../lib/swUpdate");
});

describe("swUpdate", () => {
  it("starts with no update ready", () => {
    expect(swUpdate.isUpdateReady()).toBe(false);
  });

  it("notifies subscribers when an update becomes ready", () => {
    const listener = vi.fn();
    swUpdate.subscribeToUpdate(listener);

    swUpdate.markUpdateReady();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(swUpdate.isUpdateReady()).toBe(true);
  });

  it("ignores repeat notifications once an update is already ready", () => {
    const listener = vi.fn();
    swUpdate.subscribeToUpdate(listener);

    swUpdate.markUpdateReady();
    swUpdate.markUpdateReady();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("stops notifying after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = swUpdate.subscribeToUpdate(listener);

    unsubscribe();
    swUpdate.markUpdateReady();

    expect(listener).not.toHaveBeenCalled();
  });

  it("notifies every active subscriber", () => {
    const first = vi.fn();
    const second = vi.fn();
    swUpdate.subscribeToUpdate(first);
    swUpdate.subscribeToUpdate(second);

    swUpdate.markUpdateReady();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("runs the registered applier when the update is applied", () => {
    const applier = vi.fn();
    swUpdate.setUpdateApplier(applier);

    swUpdate.applyUpdate();

    expect(applier).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when no applier has been registered", () => {
    expect(() => swUpdate.applyUpdate()).not.toThrow();
  });

  it("clears a previously registered applier when set to null", () => {
    const applier = vi.fn();
    swUpdate.setUpdateApplier(applier);
    swUpdate.setUpdateApplier(null);

    swUpdate.applyUpdate();

    expect(applier).not.toHaveBeenCalled();
  });
});
