// @vitest-environment happy-dom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
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

  test("links Lincoln facility notes to their Google Maps location", () => {
    render(<BinCataloguePage />);

    const facilityNotes = BIN_ITEMS.filter((item) =>
      /Lincoln (?:St(?:reet)? Transfer Station|Street Resource Recovery Centre)/u.test(
        item.notes ?? ""
      )
    );
    const facilityIds = new Set(facilityNotes.map((item) => item.id));
    const facilityCards = screen.getAllByRole("listitem").filter((_, index) => {
      const item = BIN_ITEMS[index];
      return item !== undefined && facilityIds.has(item.id);
    });
    const facilityLinks = facilityCards.map((card) =>
      within(card).getByRole("link", {
        name: /^(?:Lincoln St Transfer Station|Lincoln Street Resource Recovery Centre)$/u,
      })
    );

    expect({
      linkCount: facilityLinks.length,
      destinations: facilityLinks.map((link) => link.getAttribute("href")),
      visibleAddresses: facilityCards.some((card) =>
        /\(60 Lincoln (?:St|Street), Frankton, Hamilton\)|, at 60 Lincoln Street, Frankton/u.test(
          card.textContent ?? ""
        )
      ),
    }).toStrictEqual({
      linkCount: facilityNotes.length,
      destinations: facilityNotes.map(
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
