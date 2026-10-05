// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

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

  test("hides the reminder entry point when web push is unsupported", () => {
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

  test("keeps the settings in a dialog and explains Android, desktop, and iOS support", () => {
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
    expect(
      dialog.classList.contains("hidden") &&
        dialog.classList.contains("open:grid")
    ).toBeTruthy();
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
});
