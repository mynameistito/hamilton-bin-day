import { describe, expect, test } from "vitest";

import {
  BIN_ITEMS,
  BIN_ITEM_SOURCE,
  binTypeFromName,
  binTypeName,
  searchBinItems,
} from "@/lib/bin-items";

describe("verified bin item lookup", () => {
  test("finds item names without case or surrounding-space sensitivity", () => {
    expect(
      searchBinItems("  aLuMiNiUm cans ").map(({ item }) => item)
    ).toStrictEqual(["Aluminium cans"]);
  });

  test("returns the Council destination and handling notes for matches", () => {
    expect(searchBinItems("formula")[0]).toMatchObject({
      item: "Baby formula tins (remove lid and scoop)",
      bin: "yellow",
      destination: "This item goes into the yellow recycling wheelie bin",
    });
    expect(searchBinItems("aerosol cans")[0]?.notes).toContain(
      "not empty need to taken to Lincoln St Resource Recovery Centre"
    );
  });

  test("finds Council handling advice for non-kerbside disposal", () => {
    expect(searchBinItems("batteries").map(({ bin }) => bin)).toContain(
      "other"
    );
    expect(searchBinItems(" ")).toStrictEqual([]);
  });

  test("maps only known Council bin labels", () => {
    expect(binTypeFromName("Glass recycling crate")).toBe("glass");
    expect(binTypeFromName("Mystery container")).toBeNull();
    expect(binTypeName("food-scraps")).toBe("food scraps bin");
  });

  test("records a complete checked Council catalogue with stable IDs", () => {
    expect({
      url: BIN_ITEM_SOURCE.url,
      verifiedOn: BIN_ITEM_SOURCE.verifiedOn,
      count: BIN_ITEMS.length,
      uniqueIds: new Set(BIN_ITEMS.map(({ id }) => id)).size,
      categoryCount: new Set(BIN_ITEMS.map(({ bin }) => bin)).size,
      medicalWasteNote: BIN_ITEMS.find(({ item }) => item === "Medical waste")
        ?.notes,
      weedEntries: BIN_ITEMS.filter(({ item }) => item === "Weeds").length,
    }).toStrictEqual({
      url: "https://hamilton.govt.nz/fight-the-landfill",
      verifiedOn: "2026-10-03",
      count: 351,
      uniqueIds: 351,
      categoryCount: 5,
      medicalWasteNote:
        "Private medical waste disposal services are available. Medical waste should not be placed in any of your bins.",
      weedEntries: 2,
    });
  });
});
