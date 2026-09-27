import { decodeUnknownSync } from "effect/Schema";
import { describe, expect, test } from "vitest";

import { CollectionDatesResultsSchema } from "@/council-schema";

const validCollection = {
  Address: "12 Grey Street, Hamilton",
  CollectionDay: 1,
  CollectionWeek: 2,
  RedBin: "2026-09-28T00:00:00",
  YellowBin: "2026-10-05T00:00:00",
};

describe("Council collection response schema", () => {
  const decodeCollections = decodeUnknownSync(CollectionDatesResultsSchema);

  test("accepts valid collection dates and day numbers", () => {
    expect(decodeCollections([validCollection])).toStrictEqual([
      validCollection,
    ]);
  });

  test("rejects invalid calendar dates", () => {
    expect(() =>
      decodeCollections([{ ...validCollection, RedBin: "2026-02-30T00:00:00" }])
    ).toThrow(/./u);
  });

  test("rejects a day outside the council's Monday-to-Sunday range", () => {
    expect(() =>
      decodeCollections([{ ...validCollection, CollectionDay: 8 }])
    ).toThrow(/./u);
  });

  test("rejects a non-integer collection day", () => {
    expect(() =>
      decodeCollections([{ ...validCollection, CollectionDay: 1.5 }])
    ).toThrow(/./u);
  });
});
