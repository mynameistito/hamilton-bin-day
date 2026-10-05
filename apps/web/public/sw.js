const CACHE_PREFIX = "hcc-bin-day-shell-";
const BUILD_ID = "development";
const BUILD_ASSETS = [];
const NOTIFICATION_CACHE = "hcc-bin-day-notification-delivery-v1";
const NOTIFICATION_CONSENT_KEY = new URL(
  "/__notification-consent__",
  self.location.origin
).href;
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_ID}`;
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/icons/favicon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
  ...BUILD_ASSETS,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(APP_SHELL);
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data?.type === "NOTIFICATION_CONSENT") {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(NOTIFICATION_CACHE);
        if (event.data.enabled === true) {
          await cache.put(NOTIFICATION_CONSENT_KEY, new Response("enabled"));
          return;
        }
        await cache.delete(NOTIFICATION_CONSENT_KEY);
        const keys = await cache.keys();
        const deliveredKeys = keys.filter(
          (key) => key.url !== NOTIFICATION_CONSENT_KEY
        );
        await Promise.all(deliveredKeys.map((key) => cache.delete(key)));
      })()
    );
  }
});

const parseBoundedString = (value, minimum, maximum) => {
  if (Object.prototype.toString.call(value) !== "[object String]") {
    return null;
  }
  const text = String(value);
  return text.length >= minimum && text.length <= maximum ? text : null;
};

const isCollectionDate = (value) => {
  const date = parseBoundedString(value, 10, 10);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/u.test(date)) {
    return false;
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
};

const isValidPushPayload = (payload) => {
  if (
    !payload ||
    Object.prototype.toString.call(payload) !== "[object Object]"
  ) {
    return false;
  }

  const checks = [
    payload.version === 1,
    parseBoundedString(payload.notificationId, 1, 256) !== null,
    isCollectionDate(payload.collectionDate),
    [0, 1, 2, 7].includes(payload.leadDays),
    parseBoundedString(payload.title, 1, 80) !== null,
    parseBoundedString(payload.body, 1, 240) !== null,
  ];
  return checks.every(Boolean);
};

const parsePushPayload = (event) => {
  try {
    const payload = event.data?.json();
    if (!isValidPushPayload(payload)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
};

const showPushNotification = async (payload) => {
  try {
    await self.registration.showNotification(payload.title, {
      body: payload.body,
      data: { url: "/" },
      renotify: false,
      tag: payload.notificationId,
    });
  } catch {
    console.warn("Unable to display a bin-day notification.");
  }
};

self.addEventListener("push", (event) => {
  const payload = parsePushPayload(event);
  if (!payload) {
    return;
  }

  event.waitUntil(
    (async () => {
      const cache = await caches.open(NOTIFICATION_CACHE);
      if (!(await cache.match(NOTIFICATION_CONSENT_KEY))) {
        return;
      }

      await showPushNotification(payload);
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data?.url ?? "/"));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const deletions = [];
      for (const key of keys) {
        if (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) {
          deletions.push(caches.delete(key));
        }
      }
      await Promise.all(deletions);
      await self.clients.claim();
    })()
  );
});

const cacheResponse = async (request, response) => {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  } catch {
    // Caching is best-effort; a successful network response is still usable.
  }
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            await cacheResponse(request, response);
          }
          return response;
        } catch {
          const cached =
            (await caches.match(request)) ?? (await caches.match("/"));
          return cached ?? Response.error();
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cacheResponse(request, response);
        }
        return response;
      } catch {
        const cached = await caches.match(request);
        return cached ?? Response.error();
      }
    })()
  );
});
