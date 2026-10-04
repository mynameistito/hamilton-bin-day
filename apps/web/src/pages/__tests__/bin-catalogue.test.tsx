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

  test("links Lincoln St Transfer Station notes to its Google Maps location", () => {
    render(<BinCataloguePage />);

    const stationLinks = screen.getAllByRole("link", {
      name: "Lincoln St Transfer Station",
    });
    const stationCards = screen
      .getAllByRole("listitem")
      .filter((card) =>
        card.textContent?.includes("Lincoln St Transfer Station")
      );

    expect({
      linkCount: stationLinks.length,
      noteCount: stationCards.length,
      destinations: stationLinks.map((link) => link.getAttribute("href")),
      visibleAddresses: stationCards.some((card) =>
        /\(60 Lincoln (?:St|Street), Frankton, Hamilton\)/u.test(
          card.textContent ?? ""
        )
      ),
    }).toStrictEqual({
      linkCount: stationCards.length,
      noteCount: stationCards.length,
      destinations: stationLinks.map(
        () =>
          "https://www.google.com/maps/place/?q=place_id:ChIJVeG03RYibW0RUifSCPuFN1w"
      ),
      visibleAddresses: false,
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
