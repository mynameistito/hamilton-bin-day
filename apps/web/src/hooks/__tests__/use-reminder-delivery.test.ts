// @vitest-environment happy-dom

import { Buffer } from "node:buffer";

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, vi, it } from "vitest";

import { useReminderDelivery } from "@/hooks/use-reminder-delivery";
import type { NotificationPreferences } from "@/lib/notifications";
import type { ScheduleResponse } from "@/lib/schedule";

const schedule: ScheduleResponse = {
  address: "12 Grey Street",
  collectionDayName: "Monday",
  nextCollection: { bins: ["red bin"], date: "2026-10-05", type: "red" },
  redBin: "2026-10-05",
  yellowBin: "2026-10-12",
};

const preferences: NotificationPreferences = {
  enabled: false,
  leadDays: 1,
  localTime: "19:00",
};

const encodeKey = (fill: number) =>
  Buffer.from([4, ...new Uint8Array(64).fill(fill)]).toString("base64url");

const originalServiceWorker = Object.getOwnPropertyDescriptor(
  navigator,
  "serviceWorker"
);
const originalSecureContext = Object.getOwnPropertyDescriptor(
  window,
  "isSecureContext"
);

describe("reminder delivery configuration", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.localStorage.removeItem("hamilton-bin-day-push-endpoint-v1");
    if (originalServiceWorker) {
      Object.defineProperty(navigator, "serviceWorker", originalServiceWorker);
    } else {
      Reflect.deleteProperty(navigator, "serviceWorker");
    }
    if (originalSecureContext) {
      Object.defineProperty(window, "isSecureContext", originalSecureContext);
    } else {
      Reflect.deleteProperty(window, "isSecureContext");
    }
  });

  it("reports unavailable server delivery before requesting permission or subscribing", async () => {
    const requestPermission = vi.fn<() => Promise<NotificationPermission>>();
    vi.stubGlobal("Notification", {
      permission: "default",
      requestPermission,
    });
    vi.stubGlobal("PushManager", {});
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {},
    });
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetcher);
    const savePreferences = vi.fn<() => boolean>(() => true);
    const { result } = renderHook(() =>
      useReminderDelivery(schedule, false, preferences, true, savePreferences)
    );

    await act(async () => {
      await result.current.enableReminders();
    });

    expect(result.current.deliveryMessage).toContain(
      "Reminders aren’t available on this site right now"
    );
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(
      "/api/reminders/public-key"
    );
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("replaces a browser subscription when the VAPID public key changes", async () => {
    const publicKey = encodeKey(2);
    const endpoint = "https://fcm.googleapis.com/fcm/send/test-subscription";
    const keyMaterial = {
      auth: Buffer.from(new Uint8Array(16).fill(3)).toString("base64url"),
      p256dh: encodeKey(4),
    };
    const existingUnsubscribe = vi
      .fn<() => Promise<boolean>>()
      .mockResolvedValue(true);
    const existingSubscription: PushSubscription = {
      endpoint,
      expirationTime: null,
      getKey: () => null,
      options: {
        applicationServerKey: new Uint8Array([4, ...new Uint8Array(64).fill(1)])
          .buffer,
        userVisibleOnly: true,
      },
      toJSON: () => ({ endpoint, expirationTime: null, keys: keyMaterial }),
      unsubscribe: existingUnsubscribe,
    };
    const newSubscription: PushSubscription = {
      ...existingSubscription,
      options: {
        applicationServerKey: new Uint8Array(
          Buffer.from(publicKey, "base64url")
        ).buffer,
        userVisibleOnly: true,
      },
      unsubscribe: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
    };
    const subscribe = vi
      .fn<() => Promise<PushSubscription>>()
      .mockResolvedValue(newSubscription);
    const registration = {
      active: { postMessage: vi.fn<() => void>() },
      pushManager: {
        getSubscription: vi
          .fn<() => Promise<PushSubscription | null>>()
          .mockResolvedValue(existingSubscription),
        subscribe,
      },
    };
    vi.stubGlobal("Notification", {
      permission: "default",
      requestPermission: vi
        .fn<() => Promise<NotificationPermission>>()
        .mockResolvedValue("granted"),
    });
    vi.stubGlobal("PushManager", {});
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json({ publicKey }))
        .mockResolvedValueOnce(Response.json({ saved: true }))
    );
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { ready: Promise.resolve(registration) },
    });
    const savePreferences = vi.fn<() => boolean>(() => true);
    const { result } = renderHook(() =>
      useReminderDelivery(schedule, false, preferences, true, savePreferences)
    );

    await act(async () => {
      await result.current.enableReminders();
    });

    expect(existingUnsubscribe).toHaveBeenCalledOnce();
    expect(subscribe).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        applicationServerKey: new Uint8Array(
          Buffer.from(publicKey, "base64url")
        ),
        userVisibleOnly: true,
      })
    );
  });

  it("does not re-enroll when a newly-created schedule object has unchanged values", async () => {
    const endpoint = "https://fcm.googleapis.com/fcm/send/test-subscription";
    const browserSubscription: PushSubscription = {
      endpoint,
      expirationTime: null,
      getKey: () => null,
      options: { applicationServerKey: null, userVisibleOnly: true },
      toJSON: () => ({
        endpoint,
        expirationTime: null,
        keys: {
          auth: Buffer.from(new Uint8Array(16).fill(3)).toString("base64url"),
          p256dh: encodeKey(4),
        },
      }),
      unsubscribe: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
    };
    const registration = {
      active: { postMessage: vi.fn<() => void>() },
      pushManager: {
        getSubscription: vi
          .fn<() => Promise<PushSubscription | null>>()
          .mockResolvedValue(browserSubscription),
      },
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ saved: true }));
    vi.stubGlobal("Notification", { permission: "granted" });
    vi.stubGlobal("PushManager", {});
    vi.stubGlobal("fetch", fetcher);
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { ready: Promise.resolve(registration) },
    });
    const enabledPreferences: NotificationPreferences = {
      ...preferences,
      enabled: true,
    };
    const savePreferences = vi.fn<() => boolean>(() => true);
    const { rerender } = renderHook(
      ({ currentSchedule }) =>
        useReminderDelivery(
          currentSchedule,
          false,
          enabledPreferences,
          true,
          savePreferences
        ),
      { initialProps: { currentSchedule: schedule } }
    );

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledExactlyOnceWith(
        "/api/reminders/subscription",
        expect.objectContaining({ method: "POST" })
      );
    });
    await act(async () => {
      rerender({
        currentSchedule: {
          ...schedule,
          nextCollection: { ...schedule.nextCollection },
        },
      });
      await Promise.resolve();
    });

    expect(fetcher).toHaveBeenCalledOnce();
  });
});
