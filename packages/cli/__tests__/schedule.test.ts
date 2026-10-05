import { describe, expect, test } from "vitest";

import { buildSchedule, formatScheduleText, toScheduleJson } from "@/schedule";
import type { CollectionDatesResult } from "@/types";

const councilResult = {
  Address: "12 Grey Street",
  CollectionDay: 1,
  CollectionWeek: 1,
  RedBin: "2026-09-21T00:00:00",
  YellowBin: "2026-09-28T00:00:00",
};

describe("collection schedules", () => {
  test("builds the next collection from council data", () => {
    expect(buildSchedule(councilResult)).toMatchObject({
      address: "12 Grey Street",
      collectionDayName: "Monday",
      nextCollection: {
        bins: ["red bin", "food scraps bin"],
        date: "2026-09-21",
      },
      upcomingWeek: "red",
    });
  });

  test("projects a stable JSON output shape", () => {
    const output = toScheduleJson(buildSchedule(councilResult));

    expect(output.upcoming.week).toBe("red");
    expect(output.following.week).toBe("yellow");
    expect(output.upcoming.dateFormatted).toContain("September");
  });

  test("formats the yellow week first when it is the next collection", () => {
    const schedule = buildSchedule({
      ...councilResult,
      RedBin: "2026-10-05T00:00:00",
      YellowBin: "2026-09-28T00:00:00",
    });
    const output = toScheduleJson(schedule);

    expect(schedule).toMatchObject({
      nextCollection: {
        bins: ["yellow bin", "glass crate", "food scraps bin"],
        type: "yellow",
      },
      upcomingWeek: "yellow",
    });
    expect({
      followingBins: output.following.bins,
      followingLabel: output.following.weekLabel,
      text: formatScheduleText(schedule),
      upcomingLabel: output.upcoming.weekLabel,
    }).toMatchObject({
      followingBins: ["red bin", "food scraps bin"],
      followingLabel: "Red week",
      text: expect.stringContaining("Yellow week"),
      upcomingLabel: "Yellow week",
    });
    expect(formatScheduleText(schedule)).toContain("Red week");
  });

  test("formats red-week schedules as readable text", () => {
    const text = formatScheduleText(buildSchedule(councilResult));

    expect(text).toContain("12 Grey Street — Monday collection");
    expect(text).toContain("Red week");
    expect(text).toContain("Yellow week");
  });

  test("rejects a collection day outside the schedule's supported range", () => {
    const invalidDay = {
      ...councilResult,
      CollectionDay: 8,
    } satisfies CollectionDatesResult;
    expect(() => buildSchedule(invalidDay)).toThrow(
      "Invalid collection day: 8"
    );
  });
});
