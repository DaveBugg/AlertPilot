// AlertPilot Service Worker
// Handles: offline cache + Web Push notifications from ntfy

const CACHE_NAME = "alertpilot-v1";
const OFFLINE_URLS = ["/", "/index.html"];

// ── Install: cache app shell ──
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ──
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first, fallback to cache ──
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches
          .open(CACHE_NAME)
          .then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ── Push notification from ntfy ──
// ntfy sends JSON: { id, time, event, topic, title, message, priority, tags, ... }
self.addEventListener("push", (event) => {
  let data = {};

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      // Fallback: plain text push
      data = { title: "AlertPilot", message: event.data.text() };
    }
  }

  // ntfy message format
  const title = data.title || "AlertPilot";
  const body = data.message || "";
  const priority = data.priority || 3;
  const topic = data.topic || "";
  const tags = data.tags || [];

  // Map ntfy priority to notification urgency
  const vibrate =
    priority >= 4 ? [200, 100, 200, 100, 200] : // high/urgent
    priority >= 3 ? [200, 100, 200] :             // normal
    [100];                                         // low/min

  const options = {
    body: body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.id || `${topic}-${Date.now()}`,
    renotify: true,
    vibrate: vibrate,
    data: {
      id: data.id,
      topic: topic,
      url: data.click || "/",
    },
    // Show action buttons if ntfy provided them
    actions: (data.actions || [])
      .filter((a) => a.action === "view" && a.url)
      .slice(0, 2) // max 2 notification actions
      .map((a) => ({
        action: a.url,
        title: a.label,
      })),
  };

  // Priority 5 (urgent) — require interaction (won't auto-dismiss)
  if (priority >= 5) {
    options.requireInteraction = true;
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── Click notification → open app or action URL ──
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // If user clicked an action button (view link)
  const actionUrl = event.action;
  if (actionUrl && actionUrl.startsWith("http")) {
    event.waitUntil(self.clients.openWindow(actionUrl));
    return;
  }

  // Otherwise open/focus the app
  const appUrl = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Focus existing window if open
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      return self.clients.openWindow(appUrl);
    })
  );
});
