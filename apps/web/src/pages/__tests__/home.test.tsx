// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { HomePage } from "@/pages/home";

describe("home page navigation", () => {
  afterEach(cleanup);

  test("names the primary and site information navigation landmarks", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("navigation", { name: "Main navigation" })
    ).toBeTruthy();
    expect(
      screen.getByRole("navigation", { name: "Site information" })
    ).toBeTruthy();
  });
});
