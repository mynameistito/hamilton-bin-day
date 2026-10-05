// @vitest-environment happy-dom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, vi, it } from "vitest";

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

  it("names the primary and site information navigation landmarks", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("navigation", { name: "Main navigation" })
    ).toBeTruthy();
    expect(
      screen.getByRole("navigation", { name: "Site information" })
    ).toBeTruthy();
  });

  it("places two reminder triggers in the header and footer for one dialog", () => {
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

    const triggers = screen.getAllByRole("button", {
      name: /remind/iu,
    });
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

  it("reserves space for the loaded collection card", () => {
    render(<HomePage />);

    expect(screen.getByRole("article").className).toContain("min-h-[30rem]");
    expect(
      screen.getByText("Your schedule, made simple").parentElement?.className
    ).toContain("my-auto");
  });

  it("adds a mobile address changer after a selected schedule", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          found: true,
          schedule: {
            address: "12 Grey Street",
            collectionDayName: "Monday",
            nextCollection: {
              bins: ["red bin"],
              date: "2026-10-05",
              type: "red",
            },
            redBin: "2026-10-05",
            yellowBin: "2026-10-12",
          },
        })
      )
    );
    render(<HomePage />);

    const address = screen.getByRole("textbox", {
      name: "Hamilton street address",
    });
    fireEvent.change(address, { target: { value: "12 Grey Street" } });
    const form = address.closest("form");
    if (!form) {
      throw new Error("Expected the address lookup form.");
    }
    fireEvent.submit(form);

    await waitFor(() =>
      expect(screen.getByText("Change address")).toBeTruthy()
    );
    expect(
      screen.getByRole("article").classList.contains("min-h-0")
    ).toBeTruthy();
    expect(
      screen.getByRole("article").parentElement?.classList.contains("order-1")
    ).toBeTruthy();
    expect(
      screen
        .getByText("Change address")
        .parentElement?.classList.contains("order-2")
    ).toBeTruthy();
    expect(
      screen
        .getByRole("heading", { name: "Never miss your bin day again." })
        .classList.contains("sr-only")
    ).toBeTruthy();
  });
});
