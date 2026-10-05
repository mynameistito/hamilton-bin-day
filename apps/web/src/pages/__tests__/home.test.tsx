// @vitest-environment happy-dom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { HomePage } from "@/pages/home";

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

  test("reserves space for the loaded collection card", () => {
    render(<HomePage />);

    expect(screen.getByRole("article").className).toContain("min-h-[30rem]");
    expect(
      screen.getByText("Your schedule, made simple").parentElement?.className
    ).toContain("my-auto");
  });

  test("adds a mobile address changer after a selected schedule", async () => {
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
