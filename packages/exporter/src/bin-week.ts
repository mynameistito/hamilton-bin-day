/** The two possible fortnightly bin rotations. */
export type BinWeek = "red" | "yellow";

/** An area identifier used by HCC's rubbish/recycling dataset. */
export type CollectionArea = "Area 1" | "Area 2";

/** The collection rotation for each HCC area. */
type BinWeekByArea = Readonly<Record<CollectionArea, BinWeek>>;

/** IANA time zone used to determine HCC's local collection week. */
const TIME_ZONE = "Pacific/Auckland";
/** Monday of the verified reference week used to anchor the fortnight rotation. */
const REFERENCE_WEEK = "2026-10-05";
/** Verified bin color in each area during the reference week. */
const REFERENCE_BIN_WEEKS: BinWeekByArea = {
  "Area 1": "yellow",
  "Area 2": "red",
};
const DATE_PARTS_FORMATTER = new Intl.DateTimeFormat("en-NZ", {
  day: "2-digit",
  month: "2-digit",
  timeZone: TIME_ZONE,
  year: "numeric",
});

/**
 * Format an instant as a calendar date in the HCC service time zone.
 *
 * @param date - Instant to format.
 * @returns ISO calendar date in `Pacific/Auckland`.
 * @throws {TypeError} If the supplied date is invalid.
 */
const getAucklandDate = (date: Date): string => {
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("Cannot determine bin week from an invalid date.");
  }

  const parts = DATE_PARTS_FORMATTER.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to determine the date in Pacific/Auckland.");
  }

  return `${year}-${month}-${day}`;
};

/**
 * Return the Monday on or before an ISO calendar date.
 *
 * @param date - ISO calendar date.
 * @returns The Monday calendar date as `YYYY-MM-DD`.
 */
const getMonday = (date: string): string => {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  const daysSinceMonday = (utcDate.getUTCDay() + 6) % 7;
  utcDate.setUTCDate(utcDate.getUTCDate() - daysSinceMonday);

  return [
    utcDate.getUTCFullYear(),
    String(utcDate.getUTCMonth() + 1).padStart(2, "0"),
    String(utcDate.getUTCDate()).padStart(2, "0"),
  ].join("-");
};

/**
 * Count whole Monday-based weeks between two ISO calendar dates.
 *
 * @param fromWeek - Start Monday as `YYYY-MM-DD`.
 * @param toWeek - End Monday as `YYYY-MM-DD`.
 * @returns Signed whole-week distance from the first Monday to the second.
 */
const weeksBetween = (fromWeek: string, toWeek: string): number => {
  const fromYear = Number(fromWeek.slice(0, 4));
  const fromMonth = Number(fromWeek.slice(5, 7));
  const fromDay = Number(fromWeek.slice(8, 10));
  const toYear = Number(toWeek.slice(0, 4));
  const toMonth = Number(toWeek.slice(5, 7));
  const toDay = Number(toWeek.slice(8, 10));
  const from = Date.UTC(fromYear, fromMonth - 1, fromDay);
  const to = Date.UTC(toYear, toMonth - 1, toDay);

  return (to - from) / (7 * 24 * 60 * 60 * 1000);
};

/**
 * Get the red/yellow rotation for an area in the week containing a date.
 *
 * Weeks are Monday-based and derived from Pacific/Auckland calendar dates. The
 * verified reference week is 2026-10-05: Area 1 is yellow and Area 2 is red.
 *
 * @param area - The HCC rubbish/recycling area.
 * @param date - The instant to evaluate, defaulting to the current instant.
 * @returns The color collected from that area in the relevant week.
 * @throws {TypeError} If `date` is invalid or `area` is not a supported HCC area.
 */
export const getBinWeek = (
  area: CollectionArea,
  date: Date = new Date()
): BinWeek => {
  if (area !== "Area 1" && area !== "Area 2") {
    throw new TypeError(`Unexpected rubbish/recycling area: ${String(area)}`);
  }

  const weekStarting = getMonday(getAucklandDate(date));
  const weeksFromReference = weeksBetween(REFERENCE_WEEK, weekStarting);
  const isReferenceRotation = Math.abs(weeksFromReference % 2) === 0;
  const referenceColor = REFERENCE_BIN_WEEKS[area];

  if (isReferenceRotation) {
    return referenceColor;
  }

  return referenceColor === "red" ? "yellow" : "red";
};

/**
 * Get the Monday starting the week in Pacific/Auckland for an instant.
 *
 * @param date - The instant to evaluate.
 * @returns The Monday date as an ISO calendar date.
 * @throws {TypeError} If `date` is invalid.
 */
export const getWeekStarting = (date: Date): string =>
  getMonday(getAucklandDate(date));
