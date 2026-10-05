import type { ArcGisFeature } from "@/arcgis/client";
import type { CollectionArea } from "@/bin-week";

/** Normalized output row containing one address schedule. */
export interface AddressRecord {
  readonly address: string;
  readonly area: CollectionArea;
  readonly dayOfWeek: number | null;
  readonly serviceStatus: "scheduled" | "not_serviced";
}

/** Per-reason counts for source records excluded from the dataset. */
export interface SkippedRecords {
  readonly missingAddress: number;
  readonly missingDay: number;
  readonly missingArea: number;
  readonly unsupportedArea: number;
}

type FeatureResult =
  | { readonly _tag: "Record"; readonly record: AddressRecord }
  | { readonly _tag: "Skipped"; readonly reason: keyof SkippedRecords }
  | { readonly _tag: "InvalidDay"; readonly day: string };

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
 * Extract usable address records and remove exact schedule duplicates.
 *
 * @param features - Validated features returned by the ArcGIS adapter.
 * @returns Sorted records, source-quality counts, and duplicate/conflict data.
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
