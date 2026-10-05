import type { CollectionDatesResult } from "./types";

const COLLECTION_DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

type BinWeek = "red" | "yellow";

const BINS_BY_WEEK: Record<BinWeek, readonly string[]> = {
  red: ["red bin", "food scraps bin"],
  yellow: ["yellow bin", "glass crate", "food scraps bin"],
};

/** A collection schedule derived from a Council collection-date record. */
export interface CollectionSchedule {
  address: string;
  collectionDay: number;
  collectionDayName: string;
  collectionWeek: number;
  redBin: string;
  yellowBin: string;
  upcomingWeek: BinWeek;
  nextCollection: {
    bins: readonly string[];
    date: string;
    type: BinWeek;
  };
}

const parseCouncilDate = (value: string): string => value.slice(0, 10);

const collectionDayName = (day: number): string => {
  const name = COLLECTION_DAY_NAMES[day - 1];

  if (!name) {
    throw new Error(`Invalid collection day: ${day}`);
  }

  return name;
};

/**
 * Build a bin collection schedule from a Council API record.
 *
 * @param result - The validated Council collection-date record.
 * @returns The upcoming collection schedule.
 */
export const buildSchedule = (
  result: CollectionDatesResult
): CollectionSchedule => {
  const redBin = parseCouncilDate(result.RedBin);
  const yellowBin = parseCouncilDate(result.YellowBin);
  const upcomingWeek: BinWeek = redBin < yellowBin ? "red" : "yellow";
  const nextDate = upcomingWeek === "red" ? redBin : yellowBin;

  return {
    address: result.Address,
    collectionDay: result.CollectionDay,
    collectionDayName: collectionDayName(result.CollectionDay),
    collectionWeek: result.CollectionWeek,
    nextCollection: {
      bins: BINS_BY_WEEK[upcomingWeek],
      date: nextDate,
      type: upcomingWeek,
    },
    redBin,
    upcomingWeek,
    yellowBin,
  };
};

const formatWeekLabel = (week: BinWeek): string =>
  week === "red" ? "Red week" : "Yellow week";

const formatScheduleDate = (date: string): string => {
  const parsed = new Date(`${date}T12:00:00`);

  return parsed.toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "long",
    weekday: "long",
    year: "numeric",
  });
};

/**
 * Format a collection schedule for terminal display.
 *
 * @param schedule - The collection schedule to render.
 * @returns A human-readable schedule with both alternating weeks.
 */
export const formatScheduleText = (schedule: CollectionSchedule): string => {
  const oppositeWeek: BinWeek =
    schedule.upcomingWeek === "red" ? "yellow" : "red";
  const oppositeDate =
    schedule.upcomingWeek === "red" ? schedule.yellowBin : schedule.redBin;

  return [
    `${schedule.address} — ${schedule.collectionDayName} collection`,
    `${formatWeekLabel(schedule.upcomingWeek)} (${formatScheduleDate(schedule.nextCollection.date)})`,
    `  Put out: ${schedule.nextCollection.bins.join(", ")}`,
    `${formatWeekLabel(oppositeWeek)} (${formatScheduleDate(oppositeDate)})`,
    `  Put out: ${BINS_BY_WEEK[oppositeWeek].join(", ")}`,
  ].join("\n");
};

/**
 * Project a collection schedule into its stable JSON output shape.
 *
 * @param schedule - The collection schedule to project.
 * @returns A JSON-serializable representation of the schedule.
 */
export const toScheduleJson = (schedule: CollectionSchedule) => {
  const followingWeek: BinWeek =
    schedule.upcomingWeek === "red" ? "yellow" : "red";
  const followingDate =
    schedule.upcomingWeek === "red" ? schedule.yellowBin : schedule.redBin;

  return {
    address: schedule.address,
    collectionDay: schedule.collectionDay,
    collectionDayName: schedule.collectionDayName,
    collectionWeek: schedule.collectionWeek,
    following: {
      bins: [...BINS_BY_WEEK[followingWeek]],
      date: followingDate,
      dateFormatted: formatScheduleDate(followingDate),
      week: followingWeek,
      weekLabel: formatWeekLabel(followingWeek),
    },
    redBin: schedule.redBin,
    upcoming: {
      bins: [...schedule.nextCollection.bins],
      date: schedule.nextCollection.date,
      dateFormatted: formatScheduleDate(schedule.nextCollection.date),
      week: schedule.upcomingWeek,
      weekLabel: formatWeekLabel(schedule.upcomingWeek),
    },
    yellowBin: schedule.yellowBin,
  };
};
