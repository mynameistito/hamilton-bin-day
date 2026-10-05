// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { HomePage } from "@/pages/home";

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

describe("home page navigation", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    );
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

  test("names the primary and site information navigation landmarks", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("navigation", { name: "Main navigation" })
    ).toBeTruthy();
    expect(
      screen.getByRole("navigation", { name: "Site information" })
    ).toBeTruthy();
  });

  test("places two reminder triggers in the header and footer for one dialog", () => {
    window.localStorage.removeItem("hcc-bin-day-notifications-v1");
    vi.stubGlobal("Notification", {
      permission: "default",
      requestPermission: vi.fn<() => Promise<NotificationPermission>>(),
    });
    vi.stubGlobal("PushManager", {});
    vi.stubGlobal("fetch", vi.fn<typeof fetch>());
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistration: vi.fn<() => Promise<undefined>>().mockResolvedValue(),
        ready: Promise.resolve({
          active: { postMessage: vi.fn<() => void>() },
        }),
      },
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

    render(<HomePage />);

    const triggers = screen.getAllByRole("button", { name: "Reminders" });
    const [headerTrigger, footerTrigger] = triggers;
    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(triggers).toHaveLength(2);
    if (!(headerTrigger && footerTrigger)) {
      throw new Error("Expected reminder triggers in the header and footer");
    }

    fireEvent.click(headerTrigger);
    expect(dialog.hasAttribute("open")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Close reminder settings" })
    );
    fireEvent.click(footerTrigger);
    expect(dialog.hasAttribute("open")).toBeTruthy();
  });
});
