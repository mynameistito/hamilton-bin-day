import { describe, expect, test } from "vitest";

import { daysUntilCollection, formatCollectionDate } from "@/lib/schedule";

describe(formatCollectionDate, () => {
  test("formats a collection date with its weekday and month", () => {
    expect(formatCollectionDate("2026-09-25")).toContain("September");
    expect(formatCollectionDate("2026-09-25")).toContain("Friday");
  });
});

describe(daysUntilCollection, () => {
  test("calculates days using calendar dates rather than the current time", () => {
    expect(
      daysUntilCollection("2026-09-28", new Date("2026-09-25T23:50:00"))
    ).toBe(3);
  });

  test("returns zero on collection day", () => {
    expect(
      daysUntilCollection("2026-09-25", new Date("2026-09-25T08:00:00"))
    ).toBe(0);
  });
});
