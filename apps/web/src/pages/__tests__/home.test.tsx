// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
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
});
