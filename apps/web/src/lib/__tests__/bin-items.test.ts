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
    expect(searchBinItems("formula")).toStrictEqual([
      {
        item: "Baby formula tins (remove lid and scoop)",
        bin: "yellow",
        notes: "Remove lid and scoop.",
      },
    ]);
  });

  test("returns no invented match for an item not in the checked sample", () => {
    expect(searchBinItems("batteries")).toStrictEqual([]);
    expect(searchBinItems(" ")).toStrictEqual([]);
  });

  test("maps only known Council bin labels", () => {
    expect(binTypeFromName("Glass recycling crate")).toBe("glass");
    expect(binTypeFromName("Mystery container")).toBeNull();
    expect(binTypeName("food-scraps")).toBe("food scraps bin");
  });

  test("records the verified source and intentionally small sample", () => {
    expect(BIN_ITEM_SOURCE.url).toBe(
      "https://hamilton.govt.nz/fight-the-landfill"
    );
    expect(BIN_ITEM_SOURCE.verifiedOn).toBe("2026-10-03");
    expect(BIN_ITEMS).toHaveLength(4);
  });
});
