/// <reference lib="webworker" />

import { addPlugins, precacheAndRoute } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { NetworkFirst, CacheFirst } from "workbox-strategies";

import { isWafInterstitial } from "./lib/wafInterstitial";
import type { PushPayload } from "./pushPayload";

declare const self: ServiceWorkerGlobalScope;

const rejectWafInterstitials = {
  cacheWillUpdate: async ({ request, response }: { request: Request; response: Response }) =>
    isWafInterstitial(request.url, response.headers.get("content-type")) ? null : response,
};

addPlugins([rejectWafInterstitials]);
precacheAndRoute(self.__WB_MANIFEST);

// Only ever skip waiting on request. Calling skipWaiting() at parse time takes
// control of open tabs, and vite-plugin-pwa answers that with a
// window.location.reload() — reloading a tab mid-session and discarding whatever
// the user was typing. The header's Update button posts this message instead,
// and workbox only posts it to a worker that is genuinely waiting.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Every runtime-caching route is gated on this so a dev service worker can never
// serve a stale production asset.
const SW_ORIGIN = self.location.origin;
const CACHE_STATIC = "nf-static-v2";

const networkOnlyUrls = ["/api/", "/oauth"];
registerRoute(({ url }) => {
  if (url.origin !== SW_ORIGIN) return false;
  return networkOnlyUrls.some((p) => url.pathname.startsWith(p));
}, new NetworkFirst());

// Network-first, falling back to the precached app shell when offline.
const navigationRoute = new NavigationRoute(
  new NetworkFirst({
    cacheName: CACHE_STATIC,
    networkTimeoutSeconds: 10,
    plugins: [rejectWafInterstitials],
  })
);
registerRoute(navigationRoute);

registerRoute(
  ({ request, url }) =>
    url.origin === SW_ORIGIN && ["script", "style", "image", "font"].includes(request.destination),
  new CacheFirst({ cacheName: CACHE_STATIC, plugins: [rejectWafInterstitials] })
);

const APP_ICON = "/android-chrome-192x192.png";
const APP_BADGE = "/favicon-32x32.png";

self.addEventListener("push", (event) => {
  let data: PushPayload = {
    title: "Navyfragen",
    body: "You have a new update",
    url: "/messages",
  };
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch {
    /* not valid JSON — keep the defaults above */
  }

  event.waitUntil(
    self.registration.showNotification(data.title ?? "Navyfragen", {
      body: data.body,
      icon: APP_ICON,
      badge: APP_BADGE,
      data,
    })
  );
});

// The notification's recipient is not necessarily the account active in the
// browser, but this worker cannot switch accounts itself: VITE_API_URL, which
// may prefix every request, is not available here. The recipient rides along as
// query params so the page can do it on load.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};

  event.waitUntil(
    (async () => {
      const url = new URL(data.url || "/messages", self.location.origin);
      if (data.did) {
        url.searchParams.set("notifyDid", data.did);
        if (data.handle) {
          url.searchParams.set("notifyHandle", data.handle);
        }
      }
      const targetUrl = url.href;

      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of clientList) {
        if (!client.url.startsWith(self.location.origin)) continue;

        try {
          await client.focus();
          await client.navigate(targetUrl);
          return;
        } catch (err) {
          console.warn("[sw] focus/navigate failed, falling back to openWindow", err);
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })()
  );
});
