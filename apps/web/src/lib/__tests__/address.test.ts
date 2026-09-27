import { describe, expect, test } from "bun:test";

import {
  ADDRESS_LENGTH_LIMIT,
  isLookupAddressValid,
  normalizeRememberedAddress,
} from "../address";

describe("isLookupAddressValid", () => {
  test("accepts a non-blank address at the length limit", () => {
    expect(isLookupAddressValid("1".repeat(ADDRESS_LENGTH_LIMIT))).toBe(true);
  });

  test("rejects blank and overlong address input", () => {
    expect(isLookupAddressValid("   ")).toBe(false);
    expect(isLookupAddressValid("1".repeat(ADDRESS_LENGTH_LIMIT + 1))).toBe(
      false
    );
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
