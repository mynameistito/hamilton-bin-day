import { readFile } from "node:fs/promises";

import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { registerServiceWorker } from "@/service-worker-runtime.js";
import type { ServiceWorkerEvents } from "@/service-worker-runtime.js";

// oxlint-disable-next-line typescript/promise-function-async -- Preserve synchronous URL construction errors.
const readAppFile = (relativePath: string): Promise<string> =>
  readFile(new URL(relativePath, import.meta.url), "utf-8");

type FetchEvent = ServiceWorkerEvents["fetch"];

class NavigationRequest extends Request {
  // oxlint-disable-next-line eslint/class-methods-use-this -- Simulates browser navigation requests.
  override get mode(): RequestMode {
    return "navigate";
  }
}

type ListenerRegistry = {
  [K in keyof ServiceWorkerEvents]: ((event: ServiceWorkerEvents[K]) => void)[];
};

const makeFetchWorker = (
  fetch: (request: FetchEvent["request"]) => Promise<Response>,
  caches: {
    readonly match: (request: Request | string) => Response | undefined;
    readonly open: () => { readonly put: () => Promise<void> };
  }
) => {
  const handlers: ListenerRegistry = {
    install: [],
    activate: [],
    message: [],
    push: [],
    notificationclick: [],
    fetch: [],
  };

  registerServiceWorker({
    Response,
    URL,
    caches: {
      // oxlint-disable-next-line eslint/require-await -- Convert fixture failures into rejected cache operations.
      match: async (request) => caches.match(request),
      // oxlint-disable-next-line eslint/require-await -- Convert fixture failures into rejected cache operations.
      open: async () => ({
        ...caches.open(),
        addAll: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
        delete: vi.fn<() => Promise<boolean>>().mockResolvedValue(false),
        keys: vi.fn<() => Promise<Request[]>>().mockResolvedValue([]),
        match: vi.fn<() => Promise<undefined>>().mockResolvedValue(undefined),
      }),
      keys: vi.fn<() => Promise<string[]>>().mockResolvedValue([]),
      delete: vi.fn<() => Promise<boolean>>().mockResolvedValue(false),
    },
    console,
    clients: {
      claim: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      openWindow: vi.fn<() => Promise<null>>().mockResolvedValue(null),
    },
    registration: {
      showNotification: vi
        .fn<() => Promise<void>>()
        .mockResolvedValue(undefined),
    },
    skipWaiting: () => {},
    fetch,
    location: { origin: "https://example.test" },
    addEventListener: <K extends keyof ServiceWorkerEvents>(
      type: K,
      handler: (event: ServiceWorkerEvents[K]) => void
    ) => {
      const bucket: ((event: ServiceWorkerEvents[K]) => void)[] =
        handlers[type];

      bucket.push(handler);
    },
  });

  return handlers.fetch[0];
};

describe("PWA app shell", () => {
  it("declares install metadata and registers the root service worker", async () => {
    const [manifestSource, html, main, buildScript, networkStatus] =
      await Promise.all([
        readAppFile("../../public/manifest.webmanifest"),
        readAppFile("../../index.html"),
        readAppFile("../main.tsx"),
        readAppFile("../../../../scripts/build-web.ts"),
        readAppFile("../hooks/use-network-status.ts"),
      ]);

    const parsedManifest: unknown = JSON.parse(manifestSource);

    const manifest = z
      .object({
        display: z.string(),
        icons: z.array(
          z.object({
            purpose: z.string().optional(),
            sizes: z.string(),
            src: z.string(),
            type: z.string(),
          })
        ),
        name: z.string(),
        short_name: z.string(),
        start_url: z.string(),
        theme_color: z.string(),
      })
      .parse(parsedManifest);

    expect(manifest).toMatchObject({
      display: "standalone",
      name: "Hamilton Bin Day",
      short_name: "Bin Day",
      start_url: "/",
      theme_color: "#171d19",
    });
    expect(manifest.icons).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: "192x192", type: "image/png" }),
        expect.objectContaining({ sizes: "512x512", type: "image/png" }),
        expect.objectContaining({ purpose: "maskable", sizes: "192x192" }),
        expect.objectContaining({ purpose: "maskable", sizes: "512x512" }),
      ])
    );
    expect({
      hasManifest: html.includes('rel="manifest" href="/manifest.webmanifest"'),
      safeIosStatusBar:
        /<meta\s+name="apple-mobile-web-app-status-bar-style"\s+content="black"\s*\/>/u.test(
          html
        ),
      registersServiceWorker: main.includes(
        '.register(\n      "/sw.js",\n      import.meta.env.DEV ? { type: "module" } : undefined'
      ),
      detectsWaitingUpdates:
        main.includes("if (registration.waiting)") &&
        main.includes("let updatePending = false"),
      sortsBuildAssets: buildScript.includes("assetFiles.toSorted()"),
      validatesPlaceholders: buildScript.includes(
        "Expected exactly one service-worker placeholder"
      ),
      seedsFromBrowserNetworkState: networkStatus.includes(
        'let isOnline = typeof navigator !== "undefined" && navigator.onLine;'
      ),
    }).toStrictEqual({
      hasManifest: true,
      safeIosStatusBar: true,
      registersServiceWorker: true,
      detectsWaitingUpdates: true,
      sortsBuildAssets: true,
      validatesPlaceholders: true,
      seedsFromBrowserNetworkState: true,
    });
  });

  it("precaches the app shell and falls back to it for offline navigation", async () => {
    const serviceWorker = await readAppFile("../service-worker-runtime.js");

    expect({
      precachesRoot: serviceWorker.includes('"/"'),
      handlesNavigations: serviceWorker.includes(
        'if (request.mode === "navigate")'
      ),
      cachesNavigationsByRequest: serviceWorker.includes(
        "await cache.put(request, response.clone())"
      ),
      fallsBackToMatchingNavigation: serviceWorker.includes(
        "(await caches.match(request))"
      ),
      fallsBackToRoot: serviceWorker.includes('await caches.match("/")'),
      returnsNetworkErrorWhenUncached: serviceWorker.includes(
        "return cached ?? Response.error()"
      ),
      bypassesApi: serviceWorker.includes('url.pathname.startsWith("/api/")'),
    }).toStrictEqual({
      precachesRoot: true,
      handlesNavigations: true,
      cachesNavigationsByRequest: true,
      fallsBackToMatchingNavigation: true,
      fallsBackToRoot: true,
      returnsNetworkErrorWhenUncached: true,
      bypassesApi: true,
    });
  });

  it("requests permission only from explicit reminder opt-in and syncs consent to the worker", async () => {
    const [settings, deliveryHook, serviceWorker] = await Promise.all([
      readAppFile("../components/notification-settings.tsx"),
      readAppFile("../hooks/use-reminder-delivery.ts"),
      readAppFile("../service-worker-runtime.js"),
    ]);

    const enableStart = deliveryHook.indexOf("const enableReminders = async");
    const disableStart = deliveryHook.indexOf("const disableReminders = async");
    const enableAction = deliveryHook.slice(enableStart, disableStart);

    expect({
      hasExplicitOptIn:
        settings.includes('type="checkbox"') &&
        settings.includes("event.target.checked") &&
        settings.includes("void enableReminders()"),
      hasLocalTime: settings.includes('type="time"'),
      hasDayBeforeOption: settings.includes("The day before"),
      showsPermissionState: deliveryHook.includes("Notification.permission"),
      permissionPromptLivesInOptInAction:
        enableAction.includes("requestBrowserNotificationPermission(") &&
        deliveryHook.includes(
          "const requestBrowserNotificationPermission = async"
        ) &&
        deliveryHook.includes("Notification.requestPermission()") &&
        !settings.includes("Notification.requestPermission"),
      syncsOptInToServiceWorker:
        deliveryHook.includes("registration.active?.postMessage({") &&
        deliveryHook.includes('type: "NOTIFICATION_CONSENT"') &&
        serviceWorker.includes('type === "NOTIFICATION_CONSENT"'),
      gatesWorkerConsentOnSavedPreference: deliveryHook.includes(
        "enabled: storageAvailable && preferences.enabled"
      ),
      explainsWhenClearedTimeIsRejected:
        settings.includes("The previous time was kept.") &&
        settings.includes("{timeInputMessage && (") &&
        settings.includes("<output className="),
      handlesPushEvents: serviceWorker.includes('addEventListener("push"'),
    }).toStrictEqual({
      hasExplicitOptIn: true,
      hasLocalTime: true,
      hasDayBeforeOption: true,
      showsPermissionState: true,
      permissionPromptLivesInOptInAction: true,
      syncsOptInToServiceWorker: true,
      gatesWorkerConsentOnSavedPreference: true,
      explainsWhenClearedTimeIsRejected: true,
      handlesPushEvents: true,
    });
  });

  it("keeps network navigation responses when the cache is unavailable", async () => {
    const networkResponse = new Response("network response");

    const fetchHandler = makeFetchWorker(
      vi.fn<() => Promise<Response>>().mockResolvedValue(networkResponse),
      {
        match: () => {},
        open: () => ({
          put: vi
            .fn<() => Promise<void>>()
            .mockRejectedValue(new Error("storage full")),
        }),
      }
    );

    expect(fetchHandler).toBeTypeOf("function");

    if (!fetchHandler) {
      return;
    }

    let response: Promise<Response> | undefined;
    fetchHandler({
      request: new NavigationRequest("https://example.test/"),
      respondWith: (value) => {
        response = value;
      },
    });
    await expect(response).resolves.toBe(networkResponse);
  });

  it("falls back to the cached app shell when navigation is offline", async () => {
    const appShell = new Response("app shell");

    const fetchHandler = makeFetchWorker(
      vi.fn<() => Promise<Response>>().mockRejectedValue(new Error("offline")),
      {
        match: (request) => (request === "/" ? appShell : undefined),
        open: () => ({
          put: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
        }),
      }
    );

    expect(fetchHandler).toBeTypeOf("function");

    if (!fetchHandler) {
      return;
    }

    let response: Promise<Response> | undefined;
    fetchHandler({
      request: new NavigationRequest("https://example.test/"),
      respondWith: (value) => {
        response = value;
      },
    });
    await expect(response).resolves.toBe(appShell);
  });
});
