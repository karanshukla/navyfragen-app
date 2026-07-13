/// <reference lib="webworker" />

import { clientsClaim } from "workbox-core";
import { precacheAndRoute } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { NetworkFirst, CacheFirst } from "workbox-strategies";

import type { PushPayload } from "./pushPayload";

declare const self: ServiceWorkerGlobalScope;

// Precache the build's emitted assets (the manifest is injected at build time
// by vite-plugin-pwa's `injectManifest` strategy).
precacheAndRoute(self.__WB_MANIFEST);

// Take over from older workers immediately so updates apply on the next reload
// rather than waiting for every tab to close (matches the prior sw.js behavior).
self.skipWaiting();
clientsClaim();

// --- Production-only runtime caching ---------------------------------------
// In dev, vite-plugin-pwa serves the SW with devOptions that intentionally keep
// runtime behavior minimal; we also gate runtime caching behind a SW-origin
// check so a dev SW can never serve a stale production asset via fetch handlers.
const SW_ORIGIN = self.location.origin;
const CACHE_STATIC = "nf-static-v2";

// Bypass cache for API and OAuth requests — always go to the network.
const networkOnlyUrls = ["/api/", "/oauth"];
registerRoute(({ url }) => {
  if (url.origin !== SW_ORIGIN) return false;
  return networkOnlyUrls.some((p) => url.pathname.startsWith(p));
}, new NetworkFirst());

// Navigation requests: network-first so fresh HTML is served, fall back to the
// precached app shell for offline support. This mirrors the prior hand-rolled
// `event.respondWith(fetch(event.request).catch(() => caches.match("/index.html")))`.
const navigationRoute = new NavigationRoute(
  new NetworkFirst({
    cacheName: CACHE_STATIC,
    networkTimeoutSeconds: 10,
  })
);
registerRoute(navigationRoute);

// Static assets (JS, CSS, fonts, images): cache-first.
registerRoute(
  ({ request, url }) =>
    url.origin === SW_ORIGIN && ["script", "style", "image", "font"].includes(request.destination),
  new CacheFirst({ cacheName: CACHE_STATIC })
);

// --- Push notifications ----------------------------------------------------
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
    // Payload wasn't valid JSON (or empty) — keep the defaults above.
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

// A device can hold push subscriptions for several signed-in accounts at
// once, so a notification's recipient (data.did) doesn't necessarily match
// whichever account is currently active in the browser. The service worker
// itself can't reliably call the API to switch accounts here — it has no
// access to the app's VITE_API_URL, which may prefix every request (e.g.
// "/api") depending on how the app is deployed. So instead of fetching here,
// pass the recipient along as query params and let the page (which already
// knows its own API base URL) perform the switch on load.
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
