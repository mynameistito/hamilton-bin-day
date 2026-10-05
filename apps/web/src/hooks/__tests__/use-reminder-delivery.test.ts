// @vitest-environment happy-dom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

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

  test("reports unavailable server delivery before requesting permission or subscribing", async () => {
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
});
