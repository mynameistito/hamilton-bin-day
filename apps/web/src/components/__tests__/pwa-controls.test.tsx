// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { PwaInstallHelp } from "@/components/pwa-controls";

describe("PWA install controls", () => {
  afterEach(() => {
    cleanup();
  });

  test("returns focus to the install trigger when closed", () => {
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
});
