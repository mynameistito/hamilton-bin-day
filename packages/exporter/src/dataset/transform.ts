import type { ArcGisFeature } from "@/arcgis/client";
import type { CollectionArea } from "@/bin-week";

/** Normalized output row containing one address schedule. */
export interface AddressRecord {
  /** Council-provided street address, trimmed of surrounding whitespace. */
  readonly address: string;
  /** HCC collection area associated with this schedule. */
  readonly area: CollectionArea;
  /** Monday-based weekday number, or `null` when no service is scheduled. */
  readonly dayOfWeek: number | null;
  /** Whether the address has a collection day or is not serviced. */
  readonly serviceStatus: "scheduled" | "not_serviced";
}

/**
 * Counts of source features excluded because required address data was missing
 * or the HCC collection area was unsupported.
 */
interface SkippedRecords {
  /** Features without a non-empty street address. */
  readonly missingAddress: number;
  /** Features without a non-empty collection day. */
  readonly missingDay: number;
  /** Features without a non-empty collection area. */
  readonly missingArea: number;
  /** Features assigned to an area outside Area 1 and Area 2. */
  readonly unsupportedArea: number;
}

/** Intermediate result of parsing one ArcGIS feature for dataset output. */
type FeatureResult =
  | { readonly _tag: "Record"; readonly record: AddressRecord }
  | { readonly _tag: "Skipped"; readonly reason: keyof SkippedRecords }
  | { readonly _tag: "InvalidDay"; readonly day: string };

/**
 * Parse a validated ArcGIS feature into a record or a categorized exclusion.
 *
 * @param feature - Feature whose attributes were decoded by the ArcGIS client.
 * @param days - Case-normalized collection weekday names and their numbers.
 * @returns A record, a reason the feature was skipped, or an unrecognized day.
 */
const parseFeature = (
  feature: ArcGisFeature,
  days: ReadonlyMap<string, number>
): FeatureResult => {
  const { attributes } = feature;
  const address = attributes.Parcel_Street_Address?.trim();
  if (!address) {
    return { _tag: "Skipped", reason: "missingAddress" };
  }

  const rawDay = attributes.RubbishRecycling_Area_Day?.trim();
  if (!rawDay) {
    return { _tag: "Skipped", reason: "missingDay" };
  }

  const area = attributes.RubbishRecycling_Area_Type?.trim();
  if (!area) {
    return { _tag: "Skipped", reason: "missingArea" };
  }
  if (area !== "Area 1" && area !== "Area 2") {
    return { _tag: "Skipped", reason: "unsupportedArea" };
  }

  const day = rawDay.toLocaleLowerCase("en-NZ");
  const dayOfWeek = day === "not serviced" ? null : days.get(day);
  if (dayOfWeek === undefined) {
    return { _tag: "InvalidDay", day };
  }

  return {
    _tag: "Record",
    record: {
      address,
      area,
      dayOfWeek,
      serviceStatus: dayOfWeek === null ? "not_serviced" : "scheduled",
    },
  };
};

/**
 * Project ArcGIS features into the sorted, de-duplicated dataset records.
 *
 * Records missing required fields or using an unsupported area are counted in
 * `skipped`. Unrecognized collection days are returned in `invalidDays` so the
 * export workflow can fail rather than silently publish incomplete data.
 *
 * @param features - Features decoded by the ArcGIS client.
 * @returns Sorted unique records, skip counts, invalid day values, the number
 * of removed duplicate schedules, and the number of addresses with conflicting
 * schedules.
 */
export const transformFeatures = (features: readonly ArcGisFeature[]) => {
  const records: AddressRecord[] = [];
  const skipped = {
    missingAddress: 0,
    missingArea: 0,
    missingDay: 0,
    unsupportedArea: 0,
  };
  const invalidDays = new Set<string>();
  const days = new Map([
    ["monday", 1],
    ["tuesday", 2],
    ["wednesday", 3],
    ["thursday", 4],
    ["friday", 5],
  ]);

  for (const feature of features) {
    const result = parseFeature(feature, days);
    if (result._tag === "Record") {
      records.push(result.record);
    } else if (result._tag === "InvalidDay") {
      invalidDays.add(result.day);
    } else {
      skipped[result.reason] += 1;
    }
  }

  const uniqueBySchedule = new Map<string, AddressRecord>();
  for (const record of records) {
    const key = [
      record.address.toLocaleLowerCase("en-NZ"),
      record.dayOfWeek ?? "not_serviced",
      record.area.toLocaleLowerCase("en-NZ"),
    ].join("\u0000");
    uniqueBySchedule.set(key, record);
  }
  const unique = [...uniqueBySchedule.values()].toSorted((a, b) =>
    a.address.localeCompare(b.address, "en-NZ", {
      numeric: true,
      sensitivity: "base",
    })
  );

  const schedulesByAddress = new Map<string, Set<string>>();
  for (const record of unique) {
    const key = record.address.toLocaleLowerCase("en-NZ");
    const schedules = schedulesByAddress.get(key) ?? new Set<string>();
    schedules.add(`${record.area}\u0000${record.dayOfWeek ?? "not_serviced"}`);
    schedulesByAddress.set(key, schedules);
  }

  return {
    conflictingAddresses: [...schedulesByAddress.values()].filter(
      (schedules) => schedules.size > 1
    ).length,
    duplicateCount: records.length - unique.length,
    invalidDays: [...invalidDays],
    records: unique,
    skipped: skipped satisfies SkippedRecords,
  };
};
