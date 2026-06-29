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

// --- Web Push ---

// Show an incoming push as a system notification. The payload is sent by the
// server (NotificationService.sendNewMessageNotification) as JSON:
//   { title, body, url }
// Some push services strip the payload (e.g. older Safari); in that case we
// fall back to a generic notification so the user still sees *something*.
self.addEventListener("push", (event) => {
  let data = { title: "Navyfragen", body: "You have a new update", url: "/messages" };
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch {
    // Payload wasn't valid JSON (or empty) — keep the defaults above.
  }

  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, data }));
});

// Focus an existing tab on click, or open a fresh one, then close the toast.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/messages", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Prefer an already-open Navyfragen tab, focusing it and navigating to the target.
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin)) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // No open tab — open a new one.
      return self.clients.openWindow(targetUrl);
    })
  );
});
