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
    expect(screen.getByLabelText("Search the full catalogue")).toBe(
      document.activeElement
    );
    expect(screen.getByText("Aluminium cans")).toBeTruthy();
  });

  test("searches the full catalogue and announces a clear no-match state", () => {
    render(
      <BinHelpControl bin="yellow" binName="yellow recycling wheelie bin" />
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "What goes in the yellow recycling wheelie bin?",
      })
    );
    const search = screen.getByRole("searchbox", {
      name: "Search the full catalogue",
    });

    fireEvent.change(search, { target: { value: "glass bottles" } });
    expect(
      screen.getByText("This item goes into your glass recycling crate.")
    ).toBeTruthy();

    fireEvent.change(search, { target: { value: "not a council item" } });
    expect(
      screen.getByText(/No item matches “not a council item”/u)
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

  test("shows non-bin advice and closes with the accessible control", () => {
    render(<BinHelpControl bin={null} binName="collection bins" />);
    const trigger = screen.getByRole("button", {
      name: "What goes in the collection bins?",
    });
    fireEvent.click(trigger);
    expect(
      screen.getByText(/The Council sorter has no listed items/u)
    ).toBeTruthy();
    const search = screen.getByLabelText("Search the full catalogue");
    const close = screen.getByRole("button", { name: "Close bin help" });

    close.focus();
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(search).toBe(document.activeElement);
    fireEvent.click(close);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toBe(document.activeElement);
  });
});
