import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

import { describe, expect, test, vi } from "vitest";

import { readVapidConfiguration, sendWebPush } from "@/lib/web-push";
import type { WebPushSubscription } from "@/lib/web-push-subscription";

interface PushPayload {
  readonly body: string;
  readonly collectionDate: string;
  readonly leadDays: number;
  readonly notificationId: string;
  readonly title: string;
  readonly version: number;
}

interface ServiceWorkerEvent {
  readonly data?: {
    readonly enabled?: boolean;
    readonly json?: () => PushPayload;
    readonly type?: string;
  };
  readonly notification?: { readonly close: () => void };
  readonly waitUntil: (promise: Promise<void>) => void;
}

type ServiceWorkerListener = (event: ServiceWorkerEvent) => void;
type CacheKey = string | Request | URL;

const readServiceWorker = (): Promise<string> =>
  readFile(new URL("../../public/sw.js", import.meta.url), "utf-8");

const makeServiceWorker = (source: string) => {
  const listeners = new Map<string, ServiceWorkerListener>();
  const entries = new Map<string, Response>();
  const cache = {
    delete: (key: CacheKey) =>
      Promise.resolve(
        entries.delete(key instanceof Request ? key.url : String(key))
      ),
    keys: () =>
      Promise.resolve([...entries.keys()].map((key) => new Request(key))),
    match: (key: CacheKey) => {
      const stored = entries.get(
        key instanceof Request ? key.url : String(key)
      );
      return Promise.resolve(stored?.clone());
    },
    put: (key: CacheKey, response: Response) => {
      entries.set(
        key instanceof Request ? key.url : String(key),
        response.clone()
      );
      return Promise.resolve();
    },
  };
  const cachesApi = {
    delete: () => Promise.resolve(true),
    keys: () => Promise.resolve<string[]>([]),
    match: () => Promise.resolve(null),
    open: () => Promise.resolve(cache),
  };
  const showNotification = vi.fn<() => Promise<void>>().mockResolvedValue();
  const self = {
    addEventListener: (type: string, listener: ServiceWorkerListener) => {
      listeners.set(type, listener);
    },
    clients: {
      claim: () => Promise.resolve(),
      openWindow: vi.fn<() => Promise<void>>().mockResolvedValue(),
    },
    location: { origin: "https://example.test" },
    registration: { showNotification },
    skipWaiting: vi.fn<() => void>(),
  };
  const logger = { warn: vi.fn<(message: string) => void>() };

  // oxlint-disable-next-line sonarjs/code-eval -- SAFETY: Executes this checked-in worker in a VM with local deterministic browser fakes.
  runInNewContext(source, {
    Date,
    Request,
    Response,
    URL,
    caches: cachesApi,
    encodeURIComponent,
    console: logger,
    self,
  });
  return { cache, listeners, logger, showNotification };
};

const dispatch = async (
  listener: ServiceWorkerListener | undefined,
  data?: { readonly json: () => PushPayload }
): Promise<void> => {
  const pending: Promise<void>[] = [];
  listener?.({ data, waitUntil: (promise) => pending.push(promise) });
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
  test("does not display push notifications until local opt-in is recorded", async () => {
    const worker = makeServiceWorker(await readServiceWorker());

    await dispatch(worker.listeners.get("push"), {
      json: () => validPayload,
    });

    expect(worker.showNotification).not.toHaveBeenCalled();
  });

  test("validates payloads and displays every consented collection reminder", async () => {
    const worker = makeServiceWorker(await readServiceWorker());
    const consent = worker.listeners.get("message");
    const consentPromises: Promise<void>[] = [];
    consent?.({
      data: { type: "NOTIFICATION_CONSENT", enabled: true },
      waitUntil: (promise) => consentPromises.push(promise),
    });
    await Promise.all(consentPromises);

    await dispatch(worker.listeners.get("push"), {
      json: () => ({ ...validPayload, notificationId: "" }),
    });
    const validPush = {
      json: () => validPayload,
    };
    await Promise.all([
      dispatch(worker.listeners.get("push"), validPush),
      dispatch(worker.listeners.get("push"), validPush),
    ]);
    await dispatch(worker.listeners.get("push"), {
      json: () => validPayload,
    });

    consent?.({
      data: { type: "NOTIFICATION_CONSENT", enabled: false },
      waitUntil: (promise) => consentPromises.push(promise),
    });
    await Promise.all(consentPromises);
    await dispatch(worker.listeners.get("push"), {
      json: () => validPayload,
    });

    consent?.({
      data: { type: "NOTIFICATION_CONSENT", enabled: true },
      waitUntil: (promise) => consentPromises.push(promise),
    });
    await Promise.all(consentPromises.slice(-1));
    await dispatch(worker.listeners.get("push"), {
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

  test("carries the sender JSON contract through encryption to service-worker display", async () => {
    const vapidPair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"]
    );
    const vapidPrivate = await crypto.subtle.exportKey(
      "jwk",
      vapidPair.privateKey
    );
    if (!vapidPrivate.d) {
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
    const worker = makeServiceWorker(await readServiceWorker());

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
    expect(request).toMatchObject({
      redirect: "manual",
      headers: expect.objectContaining({ "content-encoding": "aes128gcm" }),
    });
    expect(request.body).toBeInstanceOf(Uint8Array);

    const consent = worker.listeners.get("message");
    const consentPromises: Promise<void>[] = [];
    consent?.({
      data: { type: "NOTIFICATION_CONSENT", enabled: true },
      waitUntil: (promise) => consentPromises.push(promise),
    });
    await Promise.all(consentPromises);
    // SAFETY: `payload` was serialized from the typed `validPayload` test fixture above.
    const providerDeliveredData = {
      json: () => JSON.parse(payload) as PushPayload,
    };
    await dispatch(worker.listeners.get("push"), providerDeliveredData);
    await dispatch(worker.listeners.get("push"), providerDeliveredData);

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

  test("handles notification display failure without rejecting the push event", async () => {
    const worker = makeServiceWorker(await readServiceWorker());
    const consent = worker.listeners.get("message");
    const pending: Promise<void>[] = [];
    consent?.({
      data: { type: "NOTIFICATION_CONSENT", enabled: true },
      waitUntil: (promise) => pending.push(promise),
    });
    await Promise.all(pending);
    worker.showNotification.mockRejectedValueOnce(
      new Error("permission revoked")
    );

    await expect(
      dispatch(worker.listeners.get("push"), { json: () => validPayload })
    ).resolves.toBeUndefined();
    expect(worker.logger.warn).toHaveBeenCalledExactlyOnceWith(
      "Unable to display a bin-day notification."
    );
  });
});
