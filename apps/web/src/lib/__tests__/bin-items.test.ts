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
      searchBinItems("  aLuMiNiUm ").map(({ item }) => item)
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
    expect(searchBinItems("batteries").map(({ bin }) => bin)).toContain("other");
    expect(searchBinItems(" ")).toStrictEqual([]);
  });

  test("maps only known Council bin labels", () => {
    expect(binTypeFromName("Glass recycling crate")).toBe("glass");
    expect(binTypeFromName("Mystery container")).toBeNull();
    expect(binTypeName("food-scraps")).toBe("food scraps bin");
  });

  test("records a complete checked Council catalogue with stable IDs", () => {
    expect(BIN_ITEM_SOURCE.url).toBe(
      "https://hamilton.govt.nz/fight-the-landfill"
    );
    expect(BIN_ITEM_SOURCE.verifiedOn).toBe("2026-10-03");
    expect(BIN_ITEMS).toHaveLength(351);
    expect(new Set(BIN_ITEMS.map(({ id }) => id)).size).toBe(351);
    expect(new Set(BIN_ITEMS.map(({ bin }) => bin))).toStrictEqual(
      new Set(["yellow", "red", "glass", "food-scraps", "other"])
    );
    expect(BIN_ITEMS.some(({ item }) => item === "Medical waste")).toBe(true);
    expect(BIN_ITEMS.filter(({ item }) => item === "Weeds")).toHaveLength(2);
    expect(
      BIN_ITEMS.find(({ item }) => item === "Medical waste")?.notes
    ).toContain("should not be placed in any of your bins");
  });
});
