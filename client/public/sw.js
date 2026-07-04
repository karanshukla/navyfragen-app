const CACHE = "nf-static-v2";

// Pre-cache the app shell on install
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(["/", "/index.html"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Remove old cache versions
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Let API and OAuth requests always hit the network
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/oauth")) {
    return;
  }

  // Navigation requests: network-first so fresh HTML is served, fall back to cache for offline
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/index.html")));
    return;
  }

  // Static assets (JS, CSS, fonts, images): cache-first
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
    )
  );
});

const APP_ICON = "/android-chrome-192x192.png"; // shown in the notification body
const APP_BADGE = "/favicon-32x32.png"; // small status-bar stamp (Android)

self.addEventListener("push", (event) => {
  let data = { title: "Navyfragen", body: "You have a new update", url: "/messages" };
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch {
    // Payload wasn't valid JSON (or empty) — keep the defaults above.
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: APP_ICON,
      badge: APP_BADGE,
      data,
    })
  );
});

// A device's push subscription is tied to whatever account was active when
// the user last enabled push — it doesn't automatically follow later account
// switches in the same browser. So a notification's recipient (data.did) can
// differ from whichever account is currently active. Before navigating, try
// to switch the active session to match so the inbox that opens is the right
// one; if that account isn't remembered on this device, fall back silently.
async function switchToNotificationAccount(data) {
  if (!data?.did) return null;

  try {
    const sessionRes = await fetch("/session", { credentials: "include" });
    if (!sessionRes.ok) return null;
    const session = await sessionRes.json();
    if (!session.did || session.did === data.did) return null;

    const switchRes = await fetch("/accounts/switch", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ did: data.did }),
    });
    return switchRes.ok ? (data.handle ?? null) : null;
  } catch (err) {
    console.warn("[sw] account auto-switch failed", err);
    return null;
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};

  event.waitUntil(
    (async () => {
      const switchedToHandle = await switchToNotificationAccount(data);

      const url = new URL(data.url || "/messages", self.location.origin);
      if (switchedToHandle) {
        url.searchParams.set("accountSwitched", switchedToHandle);
      }
      const targetUrl = url.href;

      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

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
