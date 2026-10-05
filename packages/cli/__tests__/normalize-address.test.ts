import { describe, expect, test } from "vitest";

import {
  expandAddressQuery,
  filterAddressMatches,
  pickMatchingAddress,
} from "@/normalize-address";

describe("address normalization", () => {
  test("expands street types and normalizes unit suffixes", () => {
    expect(expandAddressQuery(" 12 grey st ")).toBe("12 grey street");
  });

  test("returns the unique normalized exact match", () => {
    expect(pickMatchingAddress("12 grey st", ["12 Grey Street"])).toBe(
      "12 Grey Street"
    );
  });

  test("rejects ambiguous normalized matches", () => {
    expect(
      pickMatchingAddress("12 grey st", ["12 Grey Street", "12 Grey St"])
    ).toBeNull();
  });

  test("filters the Council no-address placeholder", () => {
    expect(
      filterAddressMatches(["No address found", "12 Grey Street"])
    ).toStrictEqual(["12 Grey Street"]);
  });
});
