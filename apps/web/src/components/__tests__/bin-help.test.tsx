// @vitest-environment happy-dom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { BinHelpControl } from "@/components/bin-help";
import {
  LINCOLN_FACILITIES,
  LINCOLN_FACILITY_MAPS_URL,
  SOFT_PLASTICS_RECYCLING_URL,
  THE_WAREHOUSE_HAMILTON_MAPS_URL,
  WOOLWORTHS_HAMILTON_MAPS_URL,
} from "@/components/bin-item-notes";

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
      screen
        .getByRole("dialog", {
          name: "What goes in the yellow recycling wheelie bin?",
        })
        .getAttribute("aria-modal")
    ).toBe("true");
    expect(screen.getByLabelText("Search the full catalogue")).toBe(
      document.activeElement
    );
    expect(screen.getByText("Aluminium cans").textContent).toBe(
      "Aluminium cans"
    );
  });

  test("keeps the full catalogue collapsed and its source outside live regions", () => {
    render(
      <BinHelpControl bin="yellow" binName="yellow recycling wheelie bin" />
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "What goes in the yellow recycling wheelie bin?",
      })
    );

    const dialog = screen.getByRole("dialog");
    expect(
      dialog.querySelector("section > ul")?.querySelectorAll("li").length
    ).toBeLessThanOrEqual(10);
    expect(screen.getByText(/Show the remaining \d+ items/u).tagName).toBe(
      "SUMMARY"
    );
    const sourceLink = screen.getByRole("link", {
      name: "Hamilton City Council’s item sorter",
    });
    expect(sourceLink.closest("[aria-live]")).toBeNull();
    const catalogueLink = screen.getByRole("link", {
      name: "Browse the full catalogue",
    });
    expect(catalogueLink.getAttribute("href")).toBe("/what-goes-where");
    expect(catalogueLink.closest("[aria-live]")).toBeNull();
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
      screen.getAllByText("Goes in: glass recycling crate")[0].textContent
    ).toBe("Goes in: glass recycling crate");

    fireEvent.change(search, { target: { value: "not a council item" } });
    expect(
      screen.getByText(/No item matches “not a council item”/u).textContent
    ).toContain("No item matches “not a council item”");
  });

  test.each([
    {
      facility: LINCOLN_FACILITIES.transferStation,
      item: "Batteries",
      query: "Batteries",
    },
    {
      facility: LINCOLN_FACILITIES.resourceRecoveryCentre,
      item: "Batteries (torch)",
      query: "Batteries (torch)",
    },
  ])(
    "links $item facility notes to Google Maps in search results",
    ({ facility, item, query }) => {
      render(
        <BinHelpControl bin="yellow" binName="yellow recycling wheelie bin" />
      );
      fireEvent.click(
        screen.getByRole("button", {
          name: "What goes in the yellow recycling wheelie bin?",
        })
      );
      fireEvent.change(screen.getByLabelText("Search the full catalogue"), {
        target: { value: query },
      });

      const resultCard = screen
        .getByText(item, { selector: "p" })
        .closest("li");
      if (!resultCard) {
        throw new Error(`Expected the ${item} search result card.`);
      }
      const facilityLink = within(resultCard).getByRole("link", {
        name: facility.label,
      });
      expect({
        href: facilityLink.getAttribute("href"),
        label: facilityLink.textContent,
        target: facilityLink.getAttribute("target"),
        visibleAddress: facilityLink
          .closest("li")
          ?.textContent?.includes("60 Lincoln Street, Frankton, Hamilton"),
      }).toStrictEqual({
        href: LINCOLN_FACILITY_MAPS_URL,
        label: facility.label,
        target: "_blank",
        visibleAddress: false,
      });
    }
  );

  test("links soft plastics stores and recycling site in help search results", () => {
    render(<BinHelpControl bin="red" binName="red rubbish wheelie bin" />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "What goes in the red rubbish wheelie bin?",
      })
    );
    fireEvent.change(screen.getByLabelText("Search the full catalogue"), {
      target: { value: "Bread bags (soft plastic)" },
    });

    const resultCard = screen
      .getByText("Bread bags (soft plastic)", { selector: "p" })
      .closest("li");
    if (!resultCard) {
      throw new Error("Expected the Bread bags search result card.");
    }
    expect({
      woolworths: within(resultCard)
        .getByRole("link", { name: "Woolworths" })
        .getAttribute("href"),
      warehouse: within(resultCard)
        .getByRole("link", { name: "The Warehouse stores" })
        .getAttribute("href"),
      recyclingSite: within(resultCard)
        .getByRole("link", { name: "www.recycling.kiwi.nz" })
        .getAttribute("href"),
    }).toStrictEqual({
      woolworths: WOOLWORTHS_HAMILTON_MAPS_URL,
      warehouse: THE_WAREHOUSE_HAMILTON_MAPS_URL,
      recyclingSite: SOFT_PLASTICS_RECYCLING_URL,
    });
  });

  test("shows the Council guidance conflict beside sorter entries 231 and 232", () => {
    render(<BinHelpControl bin="red" binName="red rubbish wheelie bin" />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "What goes in the red rubbish wheelie bin?",
      })
    );

    const conflictNotice = screen.getByText(
      /Council sorter entries 231 and 232/u
    );
    expect(conflictNotice.closest("details")).toBeNull();
    expect(
      screen
        .getByRole("link", { name: "kerbside guidance" })
        .getAttribute("href")
    ).toBe("https://hamilton.govt.nz/fight-the-landfill/kerbside-collection");
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
      screen.getByText(/The Council sorter has no listed items/u).textContent
    ).toContain("The Council sorter has no listed items");
    const search = screen.getByLabelText("Search the full catalogue");
    const sourceLink = screen.getByRole("link", {
      name: "Hamilton City Council’s item sorter",
    });
    const close = screen.getByRole("button", { name: "Close bin help" });

    close.focus();
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(sourceLink).toBe(document.activeElement);
    fireEvent.keyDown(sourceLink, { key: "Tab" });
    expect(close).toBe(document.activeElement);
    search.focus();
    fireEvent.click(close);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toBe(document.activeElement);
  });
});
