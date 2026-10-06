import { describe, expect, it } from "vitest";

import {
  expandAddressQuery,
  filterAddressMatches,
  pickMatchingAddress,
} from "@/normalize-address";

describe("address normalization", () => {
  it("expands street types and normalizes unit suffixes", () => {
    expect(expandAddressQuery(" 12b grey st ")).toBe("12B grey street");
  });

  it("returns the unique normalized exact match", () => {
    expect(pickMatchingAddress("12 grey st", ["12 Grey Street"])).toBe(
      "12 Grey Street"
    );
  });

  it("rejects ambiguous normalized matches", () => {
    expect(
      pickMatchingAddress("12 grey st", ["12 Grey Street", "12 Grey St"])
    ).toBeNull();
  });

  it("filters the Council no-address placeholder", () => {
    expect(
      filterAddressMatches(["No address found", "12 Grey Street"])
    ).toStrictEqual(["12 Grey Street"]);
  });
});
