// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, vi, it } from "vitest";

import { NotificationSettings } from "@/components/notification-settings";
import { NOTIFICATION_PREFERENCES_KEY } from "@/lib/notifications";

const serviceWorkerDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  "serviceWorker"
);
const secureContextDescriptor = Object.getOwnPropertyDescriptor(
  window,
  "isSecureContext"
);
const dialogShowModalDescriptor = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  "showModal"
);
const dialogCloseDescriptor = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  "close"
);

const restoreProperty = <T extends object>(
  target: T,
  property: PropertyKey,
  descriptor: PropertyDescriptor | undefined
) => {
  if (descriptor) {
    Object.defineProperty(target, property, descriptor);
  } else {
    Reflect.deleteProperty(target, property);
  }
};

describe("reminder settings dialog", () => {
  beforeEach(() => {
    window.localStorage.removeItem(NOTIFICATION_PREFERENCES_KEY);
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute("open", "");
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute("open");
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    restoreProperty(navigator, "serviceWorker", serviceWorkerDescriptor);
    restoreProperty(window, "isSecureContext", secureContextDescriptor);
    restoreProperty(
      HTMLDialogElement.prototype,
      "showModal",
      dialogShowModalDescriptor
    );
    restoreProperty(
      HTMLDialogElement.prototype,
      "close",
      dialogCloseDescriptor
    );
  });

  it("hides the reminder entry point when web push is unsupported", () => {
    vi.stubGlobal("Notification", { permission: "default" });
    const dialogRef = createRef<HTMLDialogElement>();

    render(
      <NotificationSettings
        cancelMissingSchedule={false}
        dialogRef={dialogRef}
        schedule={null}
      />
    );

    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
  });

  it("keeps the settings in a dialog and explains Android, desktop, and iOS support", () => {
    vi.stubGlobal("Notification", {
      permission: "default",
      requestPermission: vi.fn<() => Promise<NotificationPermission>>(),
    });
    vi.stubGlobal("PushManager", {});
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        ready: Promise.resolve({
          active: { postMessage: vi.fn<() => void>() },
        }),
      },
    });
    const dialogRef = createRef<HTMLDialogElement>();

    render(
      <NotificationSettings
        cancelMissingSchedule={false}
        dialogRef={dialogRef}
        schedule={null}
      />
    );

    const dialog = screen.getByRole("dialog", { hidden: true });
    expect({
      hidden: dialog.classList.contains("hidden"),
      gridWhenOpen: dialog.classList.contains("open:grid"),
    }).toStrictEqual({ hidden: true, gridWhenOpen: true });
    dialogRef.current?.showModal();

    expect(dialog.hasAttribute("open")).toBeTruthy();
    expect(dialog.textContent).toMatch(
      /Works on Android and desktop\..*On iPhone or iPad/u
    );
    expect(dialog.textContent).not.toContain("push subscription");

    fireEvent.click(
      screen.getByRole("button", { name: "Close reminder settings" })
    );
    expect(dialog.hasAttribute("open")).toBeFalsy();
  });

  it("previews the following collection for a seven-day reminder that is too close", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T00:00:00.000Z"));
    vi.stubGlobal("Notification", {
      permission: "default",
      requestPermission: vi.fn<() => Promise<NotificationPermission>>(),
    });
    vi.stubGlobal("PushManager", {});
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        ready: Promise.resolve({
          active: { postMessage: vi.fn<() => void>() },
          pushManager: {
            getSubscription: vi
              .fn<() => Promise<PushSubscription | null>>()
              .mockResolvedValue(null),
          },
        }),
      },
    });
    window.localStorage.setItem(
      NOTIFICATION_PREFERENCES_KEY,
      JSON.stringify({ enabled: true, leadDays: 7, localTime: "19:00" })
    );
    const dialogRef = createRef<HTMLDialogElement>();

    render(
      <NotificationSettings
        cancelMissingSchedule={false}
        dialogRef={dialogRef}
        schedule={{
          address: "12 Grey Street",
          collectionDayName: "Monday",
          nextCollection: {
            bins: ["red bin"],
            date: "2026-10-05",
            type: "red",
          },
          redBin: "2026-10-05",
          yellowBin: "2026-10-12",
        }}
      />
    );

    expect(screen.getByText(/Next reminder:/u).textContent).toContain(
      "Monday, 5 October at 19:00."
    );
  });
});
