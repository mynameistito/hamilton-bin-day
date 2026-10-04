// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { BIN_ITEMS } from "@/lib/bin-items";
import { BinCataloguePage } from "@/pages/bin-catalogue";

describe("bin catalogue page", () => {
  afterEach(cleanup);

  test("shows the full Council catalogue with a destination for each item", () => {
    render(<BinCataloguePage />);

    expect(
      screen.getByRole("heading", { name: "What goes where?" })
    ).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(BIN_ITEMS.length);
    expect(
      screen.getAllByText("Goes in: yellow recycling wheelie bin").length
    ).toBeGreaterThan(0);
  });

  test("filters items and displays the matching glass crate photo", () => {
    render(<BinCataloguePage />);
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search all items" }),
      {
        target: { value: "wine bottles" },
      }
    );

    expect(screen.getByText("Wine bottles (no lids)")).toBeTruthy();
    const image = screen.getByRole("img", { name: "glass recycling crate" });
    expect({
      width: image.getAttribute("width"),
      height: image.getAttribute("height"),
      imageCentered: image.classList.contains("object-center"),
      containerCentered:
        image.parentElement?.classList.contains("items-center"),
      itemCount: screen.getAllByRole("listitem").length,
    }).toStrictEqual({
      width: "210",
      height: "181",
      imageCentered: true,
      containerCentered: true,
      itemCount: 1,
    });
  });

  test("labels non-kerbside disposal without assigning a bin photo", () => {
    render(<BinCataloguePage />);
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search all items" }),
      {
        target: { value: "lithium batteries" },
      }
    );

    expect(screen.getByText("Goes in: other disposal")).toBeTruthy();
    expect(screen.getByText("No kerbside bin")).toBeTruthy();
  });
});
