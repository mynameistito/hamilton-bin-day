#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

import { getBinWeek, getWeekStarting } from "./bin-week.ts";
import type { BinWeekByArea, CollectionArea } from "./bin-week.ts";

const QUERY_URL =
  "https://services1.arcgis.com/R6s0QqCMQdwKY6yp/ArcGIS/rest/services/app_basedata/FeatureServer/2/query";

const BATCH_SIZE = 1000;
const MAX_RETRIES = 5;

const OUT_FIELDS = [
  "OBJECTID",
  "Parcel_Street_Address",
  "RubbishRecycling_Area_Day",
  "RubbishRecycling_Area_Type",
].join(",");

interface ArcGisError {
  code: number;
  message: string;
  details?: string[];
}

interface IdResponse {
  objectIdFieldName?: string;
  objectIds?: number[];
  error?: ArcGisError;
}

interface Feature {
  attributes: {
    OBJECTID: number;
    Parcel_Street_Address?: string | null;
    RubbishRecycling_Area_Day?: string | null;
    RubbishRecycling_Area_Type?: string | null;
  };
}

interface FeatureResponse {
  features?: Feature[];
  exceededTransferLimit?: boolean;
  error?: ArcGisError;
}

interface OutputRow {
  readonly address: string;
  readonly area: CollectionArea;
  readonly dayOfWeek: number | null;
  readonly serviceStatus: "scheduled" | "not_serviced";
}

const chunk = <T>(items: T[], size: number): T[][] => {
  const result: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }

  return result;
};

const formatNumber = (value: number): string => value.toLocaleString("en-NZ");

const DAY_OF_WEEK_NUMBERS = new Map([
  ["monday", 1],
  ["tuesday", 2],
  ["wednesday", 3],
  ["thursday", 4],
  ["friday", 5],
]);

const parseDayOfWeek = (value: string): number | null => {
  const normalized = value.toLocaleLowerCase("en-NZ");

  if (normalized === "not serviced") {
    return null;
  }

  const dayOfWeek = DAY_OF_WEEK_NUMBERS.get(normalized);

  if (dayOfWeek === undefined) {
    throw new Error(`Unexpected collection day: ${value}`);
  }

  return dayOfWeek;
};

const arcgis = async <T>(
  params: Record<string, string>,
  attempt = 1
): Promise<T> => {
  const body = new URLSearchParams({
    ...params,
    f: "json",
  });

  try {
    const response = await fetch(QUERY_URL, {
      body,
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": "hcc-bin-day-export/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    // SAFETY: The caller chooses T for the ArcGIS operation being requested; the
    // response's documented error envelope is checked below before it is returned.
    const json = (await response.json()) as T & {
      error?: ArcGisError;
    };

    if (json.error) {
      throw new Error(
        [
          `ArcGIS ${json.error.code}: ${json.error.message}`,
          ...(json.error.details ?? []),
        ].join(" ")
      );
    }

    return json;
  } catch (error) {
    if (attempt >= MAX_RETRIES) {
      throw error;
    }

    const delay = 1000 * 2 ** (attempt - 1);

    console.warn(
      `  Request failed, retrying in ${delay / 1000}s ` +
        `(${attempt}/${MAX_RETRIES})...`
    );

    await sleep(delay);

    return arcgis<T>(params, attempt + 1);
  }
};

console.log("HCC bin-day dataset exporter");
console.log("============================");
console.log();

console.log("Fetching complete OBJECTID list...");

const idResponse = await arcgis<IdResponse>({
  returnGeometry: "false",
  returnIdsOnly: "true",
  where: "1=1",
});

const ids = [...(idResponse.objectIds ?? [])].toSorted((a, b) => a - b);

if (ids.length === 0) {
  throw new Error("No OBJECTIDs were returned.");
}

console.log(`Found ${formatNumber(ids.length)} property records.`);
console.log();

const batches = chunk(ids, BATCH_SIZE);

console.log(
  `Fetching ${formatNumber(ids.length)} records in ${formatNumber(batches.length)} batches...`
);
console.log();

const features: Feature[] = [];
const fetchedIds = new Set<number>();

const fetchBatch = async (index: number): Promise<void> => {
  const batch = batches[index];

  if (!batch) {
    return;
  }

  const start = index * BATCH_SIZE + 1;
  const end = Math.min(start + batch.length - 1, ids.length);

  console.log(
    `[${index + 1}/${batches.length}] ` +
      `Fetching ${formatNumber(start)}-${formatNumber(end)}...`
  );

  const response = await arcgis<FeatureResponse>({
    objectIds: batch.join(","),
    outFields: OUT_FIELDS,
    returnGeometry: "false",
  });

  const returned = response.features ?? [];

  for (const feature of returned) {
    features.push(feature);
    fetchedIds.add(feature.attributes.OBJECTID);
  }

  console.log(
    `  Fetched ${formatNumber(fetchedIds.size)} / ` +
      `${formatNumber(ids.length)} total`
  );

  if (returned.length !== batch.length) {
    console.warn(
      `  Warning: requested ${batch.length} records, ` +
        `but received ${returned.length}.`
    );
  }

  if (response.exceededTransferLimit) {
    console.warn("  Warning: ArcGIS reported exceededTransferLimit=true.");
  }

  // Keep requests sequential to avoid overloading the ArcGIS service.
  await fetchBatch(index + 1);
};

await fetchBatch(0);

console.log();
console.log("Validating download...");

const missingIds = ids.filter((id) => !fetchedIds.has(id));

if (missingIds.length > 0) {
  console.warn(`Missing ${formatNumber(missingIds.length)} records.`);

  console.warn(
    `Missing OBJECTIDs: ${missingIds.slice(0, 50).join(", ")}${missingIds.length > 50 ? " ..." : ""}`
  );

  throw new Error("Download was incomplete. Output files were not written.");
}

console.log(`Verified all ${formatNumber(ids.length)} records were fetched.`);

console.log();
console.log("Extracting address/day/area...");

let missingAddress = 0;
let missingDay = 0;
let missingArea = 0;
let unsupportedArea = 0;

const rows: OutputRow[] = [];

for (const feature of features) {
  const address = feature.attributes.Parcel_Street_Address?.trim();
  const day = feature.attributes.RubbishRecycling_Area_Day?.trim();
  const area = feature.attributes.RubbishRecycling_Area_Type?.trim();

  if (address) {
    if (day) {
      if (area) {
        if (area !== "Area 1" && area !== "Area 2") {
          unsupportedArea += 1;
        } else {
          const dayOfWeek = parseDayOfWeek(day);

          rows.push({
            address,
            area,
            dayOfWeek,
            serviceStatus: dayOfWeek === null ? "not_serviced" : "scheduled",
          });
        }
      } else {
        missingArea += 1;
      }
    } else {
      missingDay += 1;
    }
  } else {
    missingAddress += 1;
  }
}

console.log(`Usable rows: ${formatNumber(rows.length)}`);

console.log(`Skipped without address: ${formatNumber(missingAddress)}`);

console.log(`Skipped without day: ${formatNumber(missingDay)}`);

console.log(`Skipped without area: ${formatNumber(missingArea)}`);

console.log(`Skipped with unsupported area: ${formatNumber(unsupportedArea)}`);

console.log();
console.log("Removing exact duplicates...");

const uniqueMap = new Map<string, OutputRow>();

for (const row of rows) {
  const key = [
    row.address.toLocaleLowerCase("en-NZ"),
    row.dayOfWeek ?? "not_serviced",
    row.area.toLocaleLowerCase("en-NZ"),
  ].join("\u0000");

  uniqueMap.set(key, row);
}

const unique = [...uniqueMap.values()].toSorted((a, b) =>
  a.address.localeCompare(b.address, "en-NZ", {
    numeric: true,
    sensitivity: "base",
  })
);

const schedulesByAddress = new Map<string, Set<string>>();

for (const row of unique) {
  const addressKey = row.address.toLocaleLowerCase("en-NZ");
  const schedules = schedulesByAddress.get(addressKey) ?? new Set<string>();
  schedules.add(`${row.area}\u0000${row.dayOfWeek ?? "not_serviced"}`);
  schedulesByAddress.set(addressKey, schedules);
}

const conflictingAddresses = [...schedulesByAddress.values()].filter(
  (schedules) => schedules.size > 1
).length;

const generatedAt = new Date();
const weekStarting = getWeekStarting(generatedAt);
const binWeek: BinWeekByArea = {
  "Area 1": getBinWeek("Area 1", generatedAt),
  "Area 2": getBinWeek("Area 2", generatedAt),
};

console.log(
  `Removed ${formatNumber(rows.length - unique.length)} exact duplicates.`
);

console.log(`Final dataset: ${formatNumber(unique.length)} rows.`);

console.log();
console.log("Writing JSON output...");

const output = Object.fromEntries([
  ["generatedAt", generatedAt.toISOString()],
  ["schemaVersion", 2],
  ["source", QUERY_URL],
  ["weekStarting", weekStarting],
  ["binWeek", binWeek],
  ["records", unique],
]);

await writeFile("hcc-bin-days.json", `${JSON.stringify(output, null, 2)}\n`);

console.log();
console.log("Done.");
console.log("============================");
console.log(`Current NZ collection week: ${weekStarting}`);
console.log(`Area 1: ${binWeek["Area 1"]}`);
console.log(`Area 2: ${binWeek["Area 2"]}`);
console.log();
console.log(`Source records:       ${formatNumber(ids.length)}`);
console.log(`Usable records:       ${formatNumber(rows.length)}`);
console.log(`Unique address rows:  ${formatNumber(unique.length)}`);
console.log(`Conflicting addresses: ${formatNumber(conflictingAddresses)}`);
console.log();
console.log("Created:");
console.log("  hcc-bin-days.json");
