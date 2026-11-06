import { Buffer } from "node:buffer";

import { describe, expect, vi, it } from "vitest";

import { readVapidConfiguration, sendWebPush } from "@/lib/web-push";
import type { WebPushSubscription } from "@/lib/web-push-subscription";
import { registerServiceWorker } from "@/service-worker-runtime.js";
import type { ServiceWorkerEvents } from "@/service-worker-runtime.js";

type CacheKey = string | Request | URL;

type ListenerRegistry = {
  [K in keyof ServiceWorkerEvents]: ((event: ServiceWorkerEvents[K]) => void)[];
};

const makeServiceWorker = () => {
  const listeners: ListenerRegistry = {
    install: [],
    activate: [],
    message: [],
    push: [],
    notificationclick: [],
    fetch: [],
  };

  const entries = new Map<string, Response>();

  const cache = {
    addAll: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    // oxlint-disable-next-line typescript/promise-function-async -- Preserve the fake cache's synchronous failures.
    delete: (key: CacheKey) =>
      Promise.resolve(
        entries.delete(key instanceof Request ? key.url : String(key))
      ),
    // oxlint-disable-next-line typescript/promise-function-async -- Preserve the fake cache's synchronous failures.
    keys: () =>
      Promise.resolve([...entries.keys()].map((key) => new Request(key))),
    // oxlint-disable-next-line typescript/promise-function-async -- Preserve the fake cache's synchronous failures.
    match: (key: CacheKey) => {
      const stored = entries.get(
        key instanceof Request ? key.url : String(key)
      );

      return Promise.resolve(stored?.clone());
    },
    // oxlint-disable-next-line typescript/promise-function-async -- Preserve the fake cache's synchronous failures.
    put: (key: CacheKey, response: Response) => {
      entries.set(
        key instanceof Request ? key.url : String(key),
        response.clone()
      );

      return Promise.resolve();
    },
  };

  const cachesApi = {
    delete: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
    keys: vi.fn<() => Promise<string[]>>().mockResolvedValue([]),
    match: vi.fn<() => Promise<undefined>>().mockResolvedValue(undefined),
    open: vi.fn<() => Promise<typeof cache>>().mockResolvedValue(cache),
  };

  const showNotification = vi.fn<() => Promise<void>>().mockResolvedValue();

  const self = {
    addEventListener: <K extends keyof ServiceWorkerEvents>(
      type: K,
      listener: (event: ServiceWorkerEvents[K]) => void
    ) => {
      const bucket: ((event: ServiceWorkerEvents[K]) => void)[] =
        listeners[type];

      bucket.push(listener);
    },
    clients: {
      claim: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      openWindow: vi.fn<() => Promise<null>>().mockResolvedValue(null),
    },
    location: { origin: "https://example.test" },
    registration: { showNotification },
    skipWaiting: vi.fn<() => void>(),
  };

  const logger = { warn: vi.fn<(message: string) => void>() };

  registerServiceWorker({
    Response,
    URL,
    caches: cachesApi,
    console: logger,
    fetch: globalThis.fetch,
    location: self.location,
    addEventListener: self.addEventListener,
    clients: self.clients,
    registration: self.registration,
    skipWaiting: self.skipWaiting,
  });

  return { cache, listeners, logger, showNotification };
};

const dispatch = async (
  listener: ((event: ServiceWorkerEvents["push"]) => void) | undefined,
  // oxlint-disable-next-line anti-slop/no-unknown-returns -- Push JSON is untrusted at this boundary.
  data?: { readonly json: () => unknown }
): Promise<void> => {
  const pending: Promise<unknown>[] = [];

  const event: ServiceWorkerEvents["push"] = {
    waitUntil: (promise) => {
      pending.push(promise);
    },
  };

  if (data === undefined) {
    listener?.(event);
  } else {
    listener?.({ ...event, data });
  }

  await Promise.all(pending);
};

const validPayload = {
  body: "Put your red and yellow bins out tomorrow.",
  collectionDate: "2026-10-05",
  leadDays: 1,
  notificationId: "2026-10-05:1:19:00:Pacific/Auckland",
  title: "Bin collection tomorrow",
  version: 1,
};

const encode = (value: ArrayBuffer): string =>
  Buffer.from(value).toString("base64url");

describe("service worker push notifications", () => {
  it("accepts boxed notification strings and sends their text to the browser", async () => {
    const worker = makeServiceWorker();
    // Exercise boxed strings accepted at the push boundary.
    // oxlint-disable-next-line unicorn/new-for-builtins
    const title: unknown = Object(validPayload.title);
    // oxlint-disable-next-line unicorn/new-for-builtins
    const body: unknown = Object(validPayload.body);
    // oxlint-disable-next-line unicorn/new-for-builtins
    const notificationId: unknown = Object(validPayload.notificationId);
    const pending: Promise<unknown>[] = [];
    worker.listeners.message[0]?.({
      data: { type: "NOTIFICATION_CONSENT", enabled: true },
      waitUntil: (promise) => {
        pending.push(promise);
      },
    });
    await Promise.all(pending);
    await dispatch(worker.listeners.push[0], {
      json: () => ({
        ...validPayload,
        title,
        body,
        notificationId,
      }),
    });
    expect(worker.showNotification).toHaveBeenCalledWith(
      validPayload.title,
      expect.objectContaining({
        body: validPayload.body,
        tag: validPayload.notificationId,
      })
    );
  });

  it("does not display push notifications until local opt-in is recorded", async () => {
    const worker = makeServiceWorker();

    await dispatch(worker.listeners.push[0], {
      json: () => validPayload,
    });

    expect(worker.showNotification).not.toHaveBeenCalled();
  });

  it("validates payloads and displays every consented collection reminder", async () => {
    const worker = makeServiceWorker();
    const [consent] = worker.listeners.message;
    const consentPromises: Promise<unknown>[] = [];
    consent?.({
      data: { type: "NOTIFICATION_CONSENT", enabled: true },
      waitUntil: (promise) => {
        consentPromises.push(promise);
      },
    });
    await Promise.all(consentPromises);

    await dispatch(worker.listeners.push[0], {
      json: () => ({ ...validPayload, notificationId: "" }),
    });
    const validPush = { json: () => validPayload };
    await Promise.all([
      dispatch(worker.listeners.push[0], validPush),
      dispatch(worker.listeners.push[0], validPush),
    ]);
    await dispatch(worker.listeners.push[0], {
      json: () => validPayload,
    });

    consent?.({
      data: { type: "NOTIFICATION_CONSENT", enabled: false },
      waitUntil: (promise) => {
        consentPromises.push(promise);
      },
    });
    await Promise.all(consentPromises.slice(-1));
    await dispatch(worker.listeners.push[0], {
      json: () => validPayload,
    });

    consent?.({
      data: { type: "NOTIFICATION_CONSENT", enabled: true },
      waitUntil: (promise) => {
        consentPromises.push(promise);
      },
    });
    await Promise.all(consentPromises.slice(-1));
    await dispatch(worker.listeners.push[0], {
      json: () => validPayload,
    });

    expect(worker.showNotification).toHaveBeenCalledTimes(4);
    expect(worker.showNotification).toHaveBeenNthCalledWith(
      1,
      validPayload.title,
      expect.objectContaining({
        body: validPayload.body,
        renotify: false,
        tag: validPayload.notificationId,
      })
    );
  });

  it("carries the sender JSON contract through encryption to service-worker display", async () => {
    const vapidPair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"]
    );

    const vapidPrivate = await crypto.subtle.exportKey(
      "jwk",
      vapidPair.privateKey
    );

    if (vapidPrivate.d === undefined || vapidPrivate.d === "") {
      throw new Error("The test VAPID keypair is incomplete");
    }

    const vapid = await readVapidConfiguration({
      VAPID_PRIVATE_KEY: vapidPrivate.d,
      VAPID_PUBLIC_KEY: encode(
        await crypto.subtle.exportKey("raw", vapidPair.publicKey)
      ),
      VAPID_SUBJECT: "mailto:push-test@example.test",
    });

    const clientPair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"]
    );

    const subscription: WebPushSubscription = {
      endpoint: "https://fcm.googleapis.com/fcm/send/local-test-endpoint",
      expirationTime: null,
      keys: {
        auth: encode(crypto.getRandomValues(new Uint8Array(16)).buffer),
        p256dh: encode(
          await crypto.subtle.exportKey("raw", clientPair.publicKey)
        ),
      },
    };

    const payload = JSON.stringify(validPayload);

    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 201 }));

    const worker = makeServiceWorker();

    expect(vapid).not.toBeNull();

    if (!vapid) {
      throw new Error("Expected valid test VAPID keys");
    }

    await sendWebPush({ subscription, payload, vapid, ttl: 86_400 }, fetcher);
    const [call] = fetcher.mock.calls;

    if (!call) {
      throw new Error("Expected a push-service fetch call");
    }

    const [, request] = call;

    if (!request) {
      throw new Error("Expected a Web Push RequestInit");
    }

    const expectedHeaders: unknown = expect.objectContaining({
      "content-encoding": "aes128gcm",
    });

    expect(request).toMatchObject({
      redirect: "manual",
      headers: expectedHeaders,
    });
    expect(request.body).toBeInstanceOf(Uint8Array);

    const [consent] = worker.listeners.message;
    const consentPromises: Promise<unknown>[] = [];
    consent?.({
      data: { type: "NOTIFICATION_CONSENT", enabled: true },
      waitUntil: (promise) => {
        consentPromises.push(promise);
      },
    });
    await Promise.all(consentPromises);

    const providerDeliveredData = {
      // oxlint-disable-next-line anti-slop/no-unknown-returns -- Model untrusted provider JSON.
      json: (): unknown => JSON.parse(payload),
    };

    await dispatch(worker.listeners.push[0], providerDeliveredData);
    await dispatch(worker.listeners.push[0], providerDeliveredData);

    expect(worker.showNotification).toHaveBeenCalledTimes(2);
    expect(worker.showNotification).toHaveBeenNthCalledWith(
      1,
      validPayload.title,
      expect.objectContaining({
        body: validPayload.body,
        tag: validPayload.notificationId,
        renotify: false,
      })
    );
  });

  it("handles notification display failures without rejecting push processing", async () => {
    const worker = makeServiceWorker();
    const [consent] = worker.listeners.message;
    const pending: Promise<unknown>[] = [];
    consent?.({
      data: { type: "NOTIFICATION_CONSENT", enabled: true },
      waitUntil: (promise) => {
        pending.push(promise);
      },
    });
    await Promise.all(pending);
    worker.showNotification.mockRejectedValueOnce(
      new Error("permission revoked")
    );

    await expect(
      dispatch(worker.listeners.push[0], { json: () => validPayload })
    ).resolves.toBeUndefined();
    expect(worker.logger.warn).toHaveBeenCalledExactlyOnceWith(
      "Unable to display a bin-day notification."
    );
  });
});
