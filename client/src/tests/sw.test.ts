import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const precacheAndRouteMock = vi.fn();
const registerRouteMock = vi.fn();
const networkFirstCtor = vi.fn();
const cacheFirstCtor = vi.fn();
const navigationRouteCtor = vi.fn();

vi.mock("workbox-precaching", () => ({
  precacheAndRoute: (...args: unknown[]) => precacheAndRouteMock(...args),
}));
vi.mock("workbox-routing", () => ({
  registerRoute: (...args: unknown[]) => registerRouteMock(...args),
  NavigationRoute: class {
    constructor(...args: unknown[]) {
      navigationRouteCtor(...args);
    }
  },
}));
vi.mock("workbox-strategies", () => ({
  NetworkFirst: class {
    constructor(...args: unknown[]) {
      networkFirstCtor(...args);
    }
  },
  CacheFirst: class {
    constructor(...args: unknown[]) {
      cacheFirstCtor(...args);
    }
  },
}));

// sw.ts registers its `push` / `notificationclick` handlers via
// `self.addEventListener` at import time; capture them here so tests can
// invoke the handlers directly the way the browser would dispatch events.
let listeners: Record<string, (event: any) => unknown>;
let selfMock: any;

async function loadServiceWorker() {
  vi.resetModules();
  listeners = {};
  selfMock = {
    __WB_MANIFEST: [{ url: "/index.html", revision: "abc123" }],
    location: { origin: "https://nf.example.com" },
    skipWaiting: vi.fn(),
    addEventListener: vi.fn((type: string, cb: (event: any) => unknown) => {
      listeners[type] = cb;
    }),
    clients: {
      matchAll: vi.fn(async () => []),
      openWindow: vi.fn(async (url: string) => ({ url })),
    },
    registration: {
      showNotification: vi.fn(async () => undefined),
    },
  };
  vi.stubGlobal("self", selfMock);
  await import("../sw");
}

describe("sw.ts", () => {
  beforeEach(async () => {
    precacheAndRouteMock.mockClear();
    registerRouteMock.mockClear();
    networkFirstCtor.mockClear();
    cacheFirstCtor.mockClear();
    navigationRouteCtor.mockClear();
    await loadServiceWorker();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("precaches the injected build manifest and skips waiting", () => {
    expect(precacheAndRouteMock).toHaveBeenCalledWith(selfMock.__WB_MANIFEST);
    expect(selfMock.skipWaiting).toHaveBeenCalledOnce();
  });

  it("registers the network-only, navigation, and static-asset routes", () => {
    expect(registerRouteMock).toHaveBeenCalledTimes(3);
    expect(networkFirstCtor).toHaveBeenCalled();
    expect(cacheFirstCtor).toHaveBeenCalledWith({ cacheName: "nf-static-v2" });
    expect(navigationRouteCtor).toHaveBeenCalled();
  });

  describe("network-only route matcher", () => {
    function matcher() {
      return registerRouteMock.mock.calls[0][0] as (arg: { url: URL }) => boolean;
    }

    it("matches same-origin /api/ and /oauth paths", () => {
      const match = matcher();
      expect(match({ url: new URL("https://nf.example.com/api/messages") })).toBe(true);
      expect(match({ url: new URL("https://nf.example.com/oauth/callback") })).toBe(true);
    });

    it("does not match a cross-origin url", () => {
      const match = matcher();
      expect(match({ url: new URL("https://other.example.com/api/messages") })).toBe(false);
    });

    it("does not match a same-origin path outside the network-only list", () => {
      const match = matcher();
      expect(match({ url: new URL("https://nf.example.com/messages") })).toBe(false);
    });
  });

  describe("static asset route matcher", () => {
    function matcher() {
      return registerRouteMock.mock.calls[2][0] as (arg: {
        request: { destination: string };
        url: URL;
      }) => boolean;
    }

    it("matches same-origin script/style/image/font requests", () => {
      const match = matcher();
      expect(
        match({ request: { destination: "script" }, url: new URL("https://nf.example.com/app.js") })
      ).toBe(true);
    });

    it("does not match a cross-origin request", () => {
      const match = matcher();
      expect(
        match({
          request: { destination: "script" },
          url: new URL("https://other.example.com/app.js"),
        })
      ).toBe(false);
    });

    it("does not match a non-static destination", () => {
      const match = matcher();
      expect(
        match({ request: { destination: "document" }, url: new URL("https://nf.example.com/") })
      ).toBe(false);
    });
  });

  describe("push event handler", () => {
    function dispatchPush(event: any) {
      let waited: Promise<unknown> | undefined;
      listeners.push({ ...event, waitUntil: (p: Promise<unknown>) => (waited = p) });
      return waited;
    }

    it("shows a notification with defaults when there is no payload", async () => {
      await dispatchPush({ data: undefined });
      expect(selfMock.registration.showNotification).toHaveBeenCalledWith("Navyfragen", {
        body: "You have a new update",
        icon: "/android-chrome-192x192.png",
        badge: "/favicon-32x32.png",
        data: { title: "Navyfragen", body: "You have a new update", url: "/messages" },
      });
    });

    it("merges a valid JSON payload over the defaults", async () => {
      const payload = {
        title: "New question",
        body: "Someone asked you something",
        url: "/messages/42",
        did: "did:plc:abc",
      };
      await dispatchPush({ data: { json: () => payload } });
      expect(selfMock.registration.showNotification).toHaveBeenCalledWith(
        "New question",
        expect.objectContaining({
          body: "Someone asked you something",
          data: expect.objectContaining(payload),
        })
      );
    });

    it("falls back to the Navyfragen title when the payload explicitly clears it", async () => {
      await dispatchPush({ data: { json: () => ({ title: undefined, body: "Someone asked" }) } });
      expect(selfMock.registration.showNotification).toHaveBeenCalledWith(
        "Navyfragen",
        expect.objectContaining({ body: "Someone asked" })
      );
    });

    it("falls back to defaults when event.data.json() throws", async () => {
      await dispatchPush({
        data: {
          json: () => {
            throw new Error("bad json");
          },
        },
      });
      expect(selfMock.registration.showNotification).toHaveBeenCalledWith(
        "Navyfragen",
        expect.objectContaining({ body: "You have a new update" })
      );
    });
  });

  describe("notificationclick event handler", () => {
    function dispatchClick(event: any) {
      let waited: Promise<unknown> | undefined;
      listeners.notificationclick({ ...event, waitUntil: (p: Promise<unknown>) => (waited = p) });
      return waited;
    }

    it("closes the notification and opens a window with did+handle query params when no client matches", async () => {
      const notification = {
        close: vi.fn(),
        data: { url: "/messages", did: "did:plc:abc", handle: "user.bsky.social" },
      };
      await dispatchClick({ notification });
      expect(notification.close).toHaveBeenCalledOnce();
      expect(selfMock.clients.openWindow).toHaveBeenCalledWith(
        "https://nf.example.com/messages?notifyDid=did%3Aplc%3Aabc&notifyHandle=user.bsky.social"
      );
    });

    it("omits notifyHandle when only did is present", async () => {
      const notification = { close: vi.fn(), data: { did: "did:plc:abc" } };
      await dispatchClick({ notification });
      expect(selfMock.clients.openWindow).toHaveBeenCalledWith(
        "https://nf.example.com/messages?notifyDid=did%3Aplc%3Aabc"
      );
    });

    it("defaults to /messages with no query params when notification.data is missing", async () => {
      const notification = { close: vi.fn() };
      await dispatchClick({ notification });
      expect(selfMock.clients.openWindow).toHaveBeenCalledWith("https://nf.example.com/messages");
    });

    it("does not call openWindow when it is unavailable", async () => {
      selfMock.clients.openWindow = undefined;
      const notification = { close: vi.fn(), data: {} };
      const result = await dispatchClick({ notification });
      expect(result).toBeUndefined();
    });

    it("focuses and navigates the first same-origin client without opening a window", async () => {
      const client = {
        url: "https://nf.example.com/messages",
        focus: vi.fn(async () => undefined),
        navigate: vi.fn(async () => undefined),
      };
      selfMock.clients.matchAll.mockResolvedValueOnce([client]);
      const notification = { close: vi.fn(), data: { url: "/messages" } };
      await dispatchClick({ notification });
      expect(client.focus).toHaveBeenCalledOnce();
      expect(client.navigate).toHaveBeenCalledWith("https://nf.example.com/messages");
      expect(selfMock.clients.openWindow).not.toHaveBeenCalled();
    });

    it("skips clients from a different origin", async () => {
      const crossOriginClient = {
        url: "https://other.example.com/",
        focus: vi.fn(),
        navigate: vi.fn(),
      };
      selfMock.clients.matchAll.mockResolvedValueOnce([crossOriginClient]);
      const notification = { close: vi.fn(), data: {} };
      await dispatchClick({ notification });
      expect(crossOriginClient.focus).not.toHaveBeenCalled();
      expect(selfMock.clients.openWindow).toHaveBeenCalled();
    });

    it("falls back to openWindow when focus/navigate throws on every matching client", async () => {
      const failingClient = {
        url: "https://nf.example.com/messages",
        focus: vi.fn(async () => {
          throw new Error("focus failed");
        }),
        navigate: vi.fn(),
      };
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      selfMock.clients.matchAll.mockResolvedValueOnce([failingClient]);
      const notification = { close: vi.fn(), data: {} };
      await dispatchClick({ notification });
      expect(warnSpy).toHaveBeenCalled();
      expect(selfMock.clients.openWindow).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });
});
