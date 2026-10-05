// @vitest-environment happy-dom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, vi, it } from "vitest";

import { PwaInstallHelp, PwaStatus } from "@/components/pwa-controls";

describe("PWA install controls", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("returns focus to the install trigger when closed", () => {
    render(<PwaInstallHelp />);
    const details = document.querySelector("details");
    const summary = details?.querySelector("summary");
    if (!details || !summary) {
      throw new Error("Expected the install disclosure and trigger.");
    }
    details.open = true;

    fireEvent.click(
      screen.getByRole("button", { name: "Close install instructions" })
    );

    expect(details.open).toBeFalsy();
    expect(summary).toBe(document.activeElement);
  });

  it("keeps the install panel inside the viewport on narrow screens", () => {
    render(<PwaInstallHelp />);
    const closeButton = screen.getByRole("button", {
      name: "Close install instructions",
    });
    const panel = closeButton.parentElement?.parentElement;

    expect(panel?.className).toContain("fixed");
    expect(panel?.className).toContain("inset-x-4");
    expect(panel?.className).toContain("sm:absolute");
  });

  it("does not show app updates in a browser tab", () => {
    render(<PwaStatus isOnline />);

    fireEvent(window, new Event("app-update-available"));

    expect(screen.queryByRole("button", { name: "Update app" })).toBeNull();
  });

  it("shows app updates in an installed PWA", async () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    render(<PwaStatus isOnline />);

    fireEvent(window, new Event("app-update-available"));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Update app" })).toBeTruthy()
    );
  });
});
