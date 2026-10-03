// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { BinHelpControl } from "@/components/bin-help";

describe("per-bin help", () => {
  afterEach(cleanup);

  test("opens for the selected bin and focuses its labelled item search", () => {
    render(
      <BinHelpControl bin="yellow" binName="yellow recycling wheelie bin" />
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "What goes in the yellow recycling wheelie bin?",
      })
    );

    expect(
      screen.getByRole("dialog", {
        name: "What goes in the yellow recycling wheelie bin?",
      })
    ).toBeTruthy();
    expect(screen.getByLabelText("Search checked items")).toBe(
      document.activeElement
    );
    expect(screen.getByText("Aluminium cans")).toBeTruthy();
  });

  test("searches checked items and announces a clear no-match state", () => {
    render(
      <BinHelpControl bin="yellow" binName="yellow recycling wheelie bin" />
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "What goes in the yellow recycling wheelie bin?",
      })
    );
    const search = screen.getByRole("searchbox", {
      name: "Search checked items",
    });

    fireEvent.change(search, { target: { value: "glass bottles" } });
    expect(screen.getByText(/Goes in the glass recycling crate/u)).toBeTruthy();
    expect(screen.getByText("No lids.")).toBeTruthy();

    fireEvent.change(search, { target: { value: "batteries" } });
    expect(
      screen.getByText(/No checked item matches “batteries”/u)
    ).toBeTruthy();
  });

  test("closes with Escape and returns focus to its help control", () => {
    render(<BinHelpControl bin="food-scraps" binName="food scraps bin" />);
    const trigger = screen.getByRole("button", {
      name: "What goes in the food scraps bin?",
    });
    fireEvent.click(trigger);

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toBe(document.activeElement);
  });

  test("closes with the accessible close control and wraps keyboard focus", () => {
    render(<BinHelpControl bin="red" binName="red rubbish wheelie bin" />);
    const trigger = screen.getByRole("button", {
      name: "What goes in the red rubbish wheelie bin?",
    });
    fireEvent.click(trigger);
    expect(
      screen.getByText(/No items for this bin have been verified/u)
    ).toBeTruthy();
    const search = screen.getByLabelText("Search checked items");
    const close = screen.getByRole("button", { name: "Close bin help" });

    close.focus();
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(search).toBe(document.activeElement);
    fireEvent.click(close);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toBe(document.activeElement);
  });
});
