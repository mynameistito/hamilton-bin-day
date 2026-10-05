import { describe, expect, it } from "vitest";

import { getBinWeek, getWeekStarting } from "@/bin-week";

describe("HCC fortnightly bin weeks", () => {
  it("uses the verified reference week for both areas", () => {
    const date = new Date("2026-10-05T12:00:00.000Z");

    expect(getWeekStarting(date)).toBe("2026-10-05");
    expect(getBinWeek("Area 1", date)).toBe("yellow");
    expect(getBinWeek("Area 2", date)).toBe("red");
  });

  it("flips both areas in the following week", () => {
    const date = new Date("2026-10-12T12:00:00.000Z");

    expect(getBinWeek("Area 1", date)).toBe("red");
    expect(getBinWeek("Area 2", date)).toBe("yellow");
  });

  it("returns the reference rotation again two weeks later", () => {
    const date = new Date("2026-10-19T12:00:00.000Z");

    expect(getBinWeek("Area 1", date)).toBe("yellow");
    expect(getBinWeek("Area 2", date)).toBe("red");
  });

  it("calculates fortnight parity before the reference week", () => {
    const date = new Date("2026-09-28T12:00:00.000Z");

    expect(getBinWeek("Area 1", date)).toBe("red");
    expect(getBinWeek("Area 2", date)).toBe("yellow");
  });

  it("uses Monday as the week boundary in Auckland", () => {
    expect(getWeekStarting(new Date("2026-10-04T12:30:00.000Z"))).toBe(
      "2026-10-05"
    );
    expect(getWeekStarting(new Date("2026-10-05T10:59:00.000Z"))).toBe(
      "2026-10-05"
    );
  });

  it("keeps Sunday immediately before Monday in the previous week", () => {
    const sundayEveningInAuckland = new Date("2026-10-04T10:59:00.000Z");

    expect(getWeekStarting(sundayEveningInAuckland)).toBe("2026-09-28");
    expect(getBinWeek("Area 1", sundayEveningInAuckland)).toBe("red");
  });

  it("uses the Auckland date rather than the UTC date", () => {
    const instant = new Date("2026-10-04T12:30:00.000Z");

    expect(getWeekStarting(instant)).toBe("2026-10-05");
    expect(getBinWeek("Area 2", instant)).toBe("red");
  });

  it("handles the start of NZ daylight saving without shifting the rotation", () => {
    const beforeJump = new Date("2026-09-26T13:59:00.000Z");
    const afterJump = new Date("2026-09-26T14:00:00.000Z");

    expect(getWeekStarting(beforeJump)).toBe("2026-09-21");
    expect(getWeekStarting(afterJump)).toBe("2026-09-21");
    expect(getBinWeek("Area 1", beforeJump)).toBe("yellow");
    expect(getBinWeek("Area 1", afterJump)).toBe("yellow");
  });

  it("handles the end of NZ daylight saving and the repeated local hour", () => {
    const beforeRollback = new Date("2026-04-04T13:59:00.000Z");
    const afterRollback = new Date("2026-04-04T14:00:00.000Z");

    expect(getWeekStarting(beforeRollback)).toBe("2026-03-30");
    expect(getWeekStarting(afterRollback)).toBe("2026-03-30");
    expect(getBinWeek("Area 2", beforeRollback)).toBe("yellow");
    expect(getBinWeek("Area 2", afterRollback)).toBe("yellow");
  });

  it("rejects unexpected area values", () => {
    // SAFETY: Test the runtime guard with an invalid value TypeScript excludes.
    const invalidArea = "Area 3" as never;

    expect(() => getBinWeek(invalidArea)).toThrow(
      "Unexpected rubbish/recycling area: Area 3"
    );
  });
});
