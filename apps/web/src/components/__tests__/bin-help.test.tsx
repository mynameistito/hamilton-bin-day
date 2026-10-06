// @vitest-environment happy-dom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BinHelpControl } from "@/components/bin-help";

describe("per-bin help", () => {
  afterEach(() => {
    cleanup();
    document.querySelector("#root")?.remove();
  });

  it("makes the app inert behind the development dialog", () => {
    const appRoot = document.createElement("div");
    appRoot.id = "root";
    document.body.append(appRoot);

    render(
      <BinHelpControl bin="yellow" binName="yellow recycling wheelie bin" />
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "What goes in the yellow recycling wheelie bin?",
      })
    );

    expect(appRoot.inert).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close bin help" }));
    expect(appRoot.inert).toBeFalsy();
  });

  it("opens for the selected bin and focuses its labelled item search", () => {
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
    const panel = screen.getByRole("dialog").querySelector("section");
    expect({
      fullViewportHeight: panel?.classList.contains("h-dvh"),
      noMobileMaxHeight: panel?.classList.contains("max-h-none"),
      noMobileCornerRadius: panel?.classList.contains("rounded-none"),
    }).toStrictEqual({
      fullViewportHeight: true,
      noMobileMaxHeight: true,
      noMobileCornerRadius: true,
    });
    expect(screen.getByText("Aluminium cans").textContent).toBe(
      "Aluminium cans"
    );
  });

  it("keeps the full catalogue collapsed and its source outside live regions", () => {
    render(
      <BinHelpControl bin="yellow" binName="yellow recycling wheelie bin" />
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "What goes in the yellow recycling wheelie bin?",
      })
    );

    const dialog = screen.getByRole("dialog");
    const initialItems = dialog
      .querySelector("section > ul")
      ?.querySelectorAll("li").length;
    const sourceLink = screen.getByRole("link", {
      name: "Hamilton City Council’s item sorter",
    });
    const catalogueLink = screen.getByRole("link", {
      name: "Browse the full catalogue",
    });
    expect({
      initialItemsAtMostTen: initialItems !== undefined && initialItems <= 10,
      hasItemsHeading: Boolean(
        within(dialog).getByRole("heading", { name: "Items for this bin" })
      ),
      hasNoDestinationSubtext: within(dialog).queryByText(/Goes in:/u) === null,
      remainingItemsDisclosure: screen.getByText(
        /Show the remaining \d+ items/u
      ).tagName,
      sourceOutsideLiveRegion: sourceLink.closest("[aria-live]") === null,
      catalogueHref: catalogueLink.getAttribute("href"),
      catalogueOutsideLiveRegion: catalogueLink.closest("[aria-live]") === null,
    }).toStrictEqual({
      initialItemsAtMostTen: true,
      hasItemsHeading: true,
      hasNoDestinationSubtext: true,
      remainingItemsDisclosure: "SUMMARY",
      sourceOutsideLiveRegion: true,
      catalogueHref: "/what-goes-where",
      catalogueOutsideLiveRegion: true,
    });
  });

  it("searches the catalogue with compact photo cards and announces no matches", () => {
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

    fireEvent.change(search, { target: { value: "Aerosol cans" } });
    const resultList = document.querySelector('output[aria-live="polite"]');
    if (!resultList) {
      throw new Error("Expected the live search results list.");
    }
    expect(
      within(resultList).getAllByRole("img", {
        name: "red rubbish wheelie bin",
      }).length
    ).toBeGreaterThan(0);
    expect(within(resultList).queryByText(/Goes in:/u)).toBeNull();
    expect(
      within(resultList).queryByText(/Empty cans can go in your red bin/u)
    ).toBeNull();

    fireEvent.change(search, { target: { value: "not a council item" } });
    expect(
      screen.getByText(/No item matches “not a council item”/u).textContent
    ).toContain("No item matches “not a council item”");
  });

  it("shows a compact Council guidance conflict note for the red bin", () => {
    render(<BinHelpControl bin="red" binName="red rubbish wheelie bin" />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "What goes in the red rubbish wheelie bin?",
      })
    );

    const conflictNotice = screen.getByRole("note");
    expect(conflictNotice.textContent).toContain(
      "Council sources conflict on takeaway containers"
    );
    expect(conflictNotice.closest("details")).toBeNull();
    expect(
      screen
        .getByRole("link", { name: "kerbside guidance" })
        .getAttribute("href")
    ).toBe("https://hamilton.govt.nz/fight-the-landfill/kerbside-collection");
  });

  it("closes with Escape and returns focus to its help control", () => {
    render(<BinHelpControl bin="food-scraps" binName="food scraps bin" />);
    const trigger = screen.getByRole("button", {
      name: "What goes in the food scraps bin?",
    });
    fireEvent.click(trigger);

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toBe(document.activeElement);
  });

  it("shows non-bin advice and closes with the accessible control", () => {
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
