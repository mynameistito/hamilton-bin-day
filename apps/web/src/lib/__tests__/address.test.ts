import { describe, expect, test } from "vitest";

import {
  ADDRESS_LENGTH_LIMIT,
  isLookupAddressValid,
  normalizeRememberedAddress,
} from "@/lib/address";

describe(isLookupAddressValid, () => {
  test("accepts a non-blank address at the length limit", () => {
    expect(isLookupAddressValid("1".repeat(ADDRESS_LENGTH_LIMIT))).toBeTruthy();
  });

  test("rejects blank and overlong address input", () => {
    expect(isLookupAddressValid("   ")).toBeFalsy();
    expect(
      isLookupAddressValid("1".repeat(ADDRESS_LENGTH_LIMIT + 1))
    ).toBeFalsy();
  });
});

describe("remembered addresses", () => {
  test("trims a valid stored address", () => {
    expect(normalizeRememberedAddress("  12 Grey Street, Hamilton  ")).toBe(
      "12 Grey Street, Hamilton"
    );
  });

  test("ignores missing, blank, and overlong stored addresses", () => {
    expect(normalizeRememberedAddress(null)).toBeNull();
    expect(normalizeRememberedAddress("   ")).toBeNull();
    expect(
      normalizeRememberedAddress("x".repeat(ADDRESS_LENGTH_LIMIT + 1))
    ).toBeNull();
  });
});
