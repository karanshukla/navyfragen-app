// Runtime-agnostic `mock` for the server test suite.
//
// Bun's test runner recognizes `node:test`'s `test`/`describe`/`before*`/`after*`
// hooks, but does NOT implement its `mock` API (mock.fn, mock.method, mock.module,
// mock.restoreAll, …). This shim presents that surface on both runtimes so test
// files can stay dual-runtime (green under both `node --test` and `bun test`)
// by swapping a single import — see CLAUDE.md "Module Mocking in Server Tests".
//
// Strategy:
//  - `mock.fn` / `mock.method` are reimplemented here in pure JS, reproducing
//    node:test's observable shape (`.mock.calls` as `[{ arguments }]`,
//    `mockImplementation/Once`, `mockReturnValue(/Once)`, `resetCalls`). The same
//    implementation runs under both runtimes — no behavior fork. `mock.timers` is
//    only stubbed far enough for the suite's `.reset()`; the rest throws.
//  - `mock.module` and `mock.restoreAll` can't be reimplemented portably (module
//    registry + property restoration belong to the host runner), so they delegate
//    to the host: node:test under Node, bun:test under Bun. The host import is a
//    guarded dynamic `import()` so Node never resolves "bun:test".
//
// Part of #269 / epic #268. See docs/testing-notes.md for the per-pattern notes.

/* v8 ignore start -- test infra; excluded from coverage semantics */

/**
 * A single queued one-shot override. Interleaved in FIFO order so successive
 * `mockImplementationOnce` / `mockReturnValueOnce` calls apply in registration
 * order, matching node:test (and the prototype validated in the spike).
 */
type OnceItem = { kind: "impl"; value: (...args: any[]) => any } | { kind: "return"; value: any };

interface CallRecord {
  arguments: any[];
}
interface ResultRecord {
  type: "return" | "throw";
  value: any;
}

interface MockState {
  calls: CallRecord[];
  results: ResultRecord[];
  instances: any[];
}

interface MockFunctionApi extends MockState {
  mockImplementation(fn: (...args: any[]) => any): MockFunction;
  mockImplementationOnce(fn: (...args: any[]) => any): MockFunction;
  mockReturnValue(value: any): MockFunction;
  mockReturnValueOnce(value: any): MockFunction;
  resetCalls(): void;
}

export interface MockFunction<R = any> {
  (...args: any[]): R;
  mock: MockFunctionApi;
  // node:test also exposes these directly on the function (not only under .mock).
  mockImplementation(fn: (...args: any[]) => any): MockFunction;
  mockImplementationOnce(fn: (...args: any[]) => any): MockFunction;
  mockReturnValue(value: any): MockFunction;
  mockReturnValueOnce(value: any): MockFunction;
}

/**
 * Build a node:test-compatible mock function. `implementation` is optional; an
 * undefined impl yields `undefined` by default (matching node:test's `mock.fn()`).
 */
function createMockFunction<R = any>(implementation?: (...args: any[]) => R): MockFunction<R> {
  let baseImpl = implementation as ((...args: any[]) => any) | undefined;
  const onceQueue: OnceItem[] = [];
  let onceIndex = 0;

  const state: MockState = { calls: [], results: [], instances: [] };

  const mockFn = function (this: any, ...args: any[]): any {
    state.calls.push({ arguments: args });
    try {
      let active: ((...a: any[]) => any) | undefined;
      let forcedReturn: { value: any } | undefined;
      if (onceIndex < onceQueue.length) {
        const item = onceQueue[onceIndex++];
        if (item.kind === "impl") active = item.value;
        else forcedReturn = { value: item.value };
      }

      let result: any;
      if (forcedReturn) {
        result = forcedReturn.value;
      } else if (active) {
        result = active.apply(this, args);
      } else if (baseImpl) {
        result = baseImpl.apply(this, args);
      } else {
        result = undefined;
      }
      state.results.push({ type: "return", value: result });
      return result;
    } catch (err) {
      state.results.push({ type: "throw", value: err });
      throw err;
    }
  } as MockFunction<R>;

  const api: MockFunctionApi = {
    calls: state.calls,
    results: state.results,
    instances: state.instances,
    mockImplementation(fn) {
      baseImpl = fn;
      return mockFn;
    },
    mockImplementationOnce(fn) {
      onceQueue.push({ kind: "impl", value: fn });
      return mockFn;
    },
    mockReturnValue(value) {
      baseImpl = () => value;
      return mockFn;
    },
    mockReturnValueOnce(value) {
      onceQueue.push({ kind: "return", value });
      return mockFn;
    },
    resetCalls() {
      state.calls.length = 0;
      state.results.length = 0;
      state.instances.length = 0;
    },
  };
  mockFn.mock = api;
  // node:test mirrors these on the function itself (some call sites use the
  // bare form). Mirror both so test code works either way.
  mockFn.mockImplementation = api.mockImplementation;
  mockFn.mockImplementationOnce = api.mockImplementationOnce;
  mockFn.mockReturnValue = api.mockReturnValue;
  mockFn.mockReturnValueOnce = api.mockReturnValueOnce;
  return mockFn;
}

/**
 * Tracked `mock.method` replacement, so `restoreAll` can put the original back.
 * Stored module-locally; reset on each `restoreAll`.
 */
interface MethodBinding {
  target: any;
  methodName: PropertyKey;
  original: any;
  descriptor: PropertyDescriptor | undefined;
}
const methodBindings: MethodBinding[] = [];

/** Host-runner mock surface, lazily resolved so Node never imports "bun:test". */
interface ModuleMockOptions {
  exports: Record<string, unknown>;
}
interface HostMock {
  module: (specifier: string, options: ModuleMockOptions) => Promise<void>;
  restoreAll: () => void;
}
let hostMockPromise: Promise<HostMock> | null = null;

function isBun(): boolean {
  return typeof (globalThis as any).Bun !== "undefined" || !!(process.versions as any).bun;
}

async function resolveHostMock(): Promise<HostMock> {
  if (!hostMockPromise) {
    hostMockPromise = (async () => {
      if (isBun()) {
        // Bun's `mock.module` takes a *factory* `() => exports`, the opposite of
        // node:test's `{ exports }` shape. Wrap our node-style options so the
        // native call gets the factory it expects. `restoreAll` → `clearAllMocks`.
        const bunTest = await import("bun:test");
        const bunMock = (bunTest as any).mock;
        return {
          module: async (specifier, options) => bunMock.module(specifier, () => options.exports),
          restoreAll: () => bunMock.clearAllMocks(),
        } satisfies HostMock;
      }
      // Node: forward node:test's native `{ exports }` shape untouched.
      const nodeTest = await import("node:test");
      const nodeMock = (nodeTest as any).mock;
      return {
        module: async (specifier, options) => nodeMock.module(specifier, options),
        restoreAll: () => nodeMock.restoreAll(),
      } satisfies HostMock;
    })();
  }
  return hostMockPromise;
}

function unimplementedTimer(name: string): () => never {
  return () => {
    throw new Error(
      `mock.timers.${name}() is not implemented by the dual-runtime mock shim. ` +
        `Add a portable implementation to src/tests/mock-shim.ts before using it.`
    );
  };
}

export const mock = {
  /**
   * node:test's `mock.fn`. Records calls (with `arguments`), results, and
   * supports per-mock implementation/return-value overrides.
   */
  fn: createMockFunction,

  /**
   * node:test's `mock.method(target, methodName, impl?)`. Replaces the named
   * method with a mock fn and tracks the binding so `restoreAll` can restore it.
   * Returns the mock fn so callers can read `.mock.calls`.
   */
  method(
    target: any,
    methodName: PropertyKey,
    implementation?: (...args: any[]) => any
  ): MockFunction {
    const descriptor = Object.getOwnPropertyDescriptor(target, methodName);
    const original = target[methodName];
    // node:test treats an absent implementation as "spy on it": calls are
    // recorded and still reach the original. Defaulting to undefined instead
    // would silently stub the method out.
    const spy = createMockFunction(
      implementation ??
        function (this: any, ...args: any[]) {
          return original.apply(this ?? target, args);
        }
    );
    methodBindings.push({
      target,
      methodName,
      original,
      descriptor,
    });
    target[methodName] = spy as any;
    return spy;
  },

  /**
   * node:test's `mock.timers`. The suite only calls `.reset()`, and only to undo
   * an `.enable()` that never happened, so resetting nothing is correct. Faking
   * timers portably is not implemented — the rest of the surface throws rather
   * than returning quietly, because a silently ignored `.enable()` would leave a
   * test waiting on real timers and failing somewhere unrelated.
   */
  timers: {
    reset() {},
    enable: unimplementedTimer("enable"),
    tick: unimplementedTimer("tick"),
    setTime: unimplementedTimer("setTime"),
    runAll: unimplementedTimer("runAll"),
  },

  /**
   * Replace a module's exports before it's imported. Delegates to the host
   * runner. Accepts node:test's `{ exports }` shape; the Bun host adapter wraps
   * it in the factory bun:test expects.
   */
  async module(specifier: string, options: { exports: Record<string, unknown> }): Promise<void> {
    const host = await resolveHostMock();
    await host.module(specifier, options);
  },

  /**
   * Restore everything: host-runner mocks (module mocks + any host-level spies),
   * then the `mock.method` bindings tracked by this shim.
   */
  restoreAll(): void {
    // Run host restore first; then undo our own method replacements. Do it
    // synchronously where possible — node:test's restoreAll is sync; bun's
    // clearAllMocks is sync. resolveHostMock is async, so kick it off and also
    // restore synchronously what we can.
    resolveHostMock()
      .then((host) => {
        try {
          host.restoreAll();
        } catch {
          /* host restore is best-effort */
        }
      })
      .catch(() => {
        /* ignore — Node path below still restores method bindings */
      });
    // Always restore our method bindings synchronously so afterEach teardown is
    // deterministic even if the host promise hasn't settled.
    while (methodBindings.length) {
      const { target, methodName, original, descriptor } = methodBindings.pop()!;
      if (descriptor) {
        Object.defineProperty(target, methodName, descriptor);
      } else {
        target[methodName] = original;
      }
    }
  },
};

/* v8 ignore stop */
