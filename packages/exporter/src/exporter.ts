import { Clock, Effect, FileSystem } from "effect";

import { ArcGisClient, sourceUrl } from "@/arcgis/client";
import { getBinWeek, getWeekStarting } from "@/bin-week";
import { transformFeatures } from "@/dataset/transform";

const BATCH_SIZE = 1000;
/** A typed failure while validating or writing the exported dataset. */
export class ExportError extends Error {
  /** Stable error tag for typed Effect error handling. */
  readonly _tag = "ExportError" as const;

  /** Identifies the workflow error in runtime diagnostics. */
  override readonly name = "ExportError";
}

const formatNumber = (value: number): string => value.toLocaleString("en-NZ");

const chunks = <A>(values: readonly A[], size: number) =>
  Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
    values.slice(index * size, (index + 1) * size)
  );

/** Fetch, validate, transform, and write the HCC address dataset. */
export const exportDataset = Effect.fn("exportDataset")(function* exportDataset(
  outputPath: string
) {
  const api = yield* ArcGisClient;
  const fs = yield* FileSystem.FileSystem;

  yield* Effect.log("HCC bin-day dataset exporter");
  yield* Effect.log("Fetching complete OBJECTID list...");
  const ids = [...(yield* api.allObjectIds)].toSorted((a, b) => a - b);
  if (ids.length === 0) {
    return yield* Effect.fail(
      new ExportError("No OBJECTIDs were returned; output was not written.")
    );
  }
  yield* Effect.log(`Found ${formatNumber(ids.length)} property records.`);

  const batches = chunks(ids, BATCH_SIZE);
  yield* Effect.log(
    `Fetching ${formatNumber(ids.length)} records in ${formatNumber(batches.length)} batches...`
  );
  const downloadedFeatures = yield* Effect.all(
    batches.map((batch, index) =>
      Effect.gen(function* fetchBatch() {
        yield* Effect.log(
          `[${index + 1}/${batches.length}] Fetching ${formatNumber(batch.length)} records...`
        );
        return yield* api.featuresByObjectIds(batch);
      })
    ),
    { concurrency: 1 }
  ).pipe(Effect.map((responses) => responses.flat()));

  const fetchedIds = new Set(
    downloadedFeatures.map(({ attributes }) => attributes.OBJECTID)
  );
  const missingIds = ids.filter((id) => !fetchedIds.has(id));
  if (missingIds.length > 0) {
    yield* Effect.logWarning(
      `Missing ${formatNumber(missingIds.length)} records.`
    );
    return yield* Effect.fail(
      new ExportError(
        `Download was incomplete: ${formatNumber(missingIds.length)} OBJECTIDs were missing. Output was not written.`
      )
    );
  }
  yield* Effect.log(
    `Verified all ${formatNumber(ids.length)} records were fetched.`
  );

  const transformed = transformFeatures(downloadedFeatures);
  if (transformed.invalidDays.length > 0) {
    return yield* Effect.fail(
      new ExportError(
        `Unexpected collection days: ${transformed.invalidDays.join(", ")}. Output was not written.`
      )
    );
  }
  const generatedAt = new Date(yield* Clock.currentTimeMillis);
  const output = {
    binWeek: {
      "Area 1": getBinWeek("Area 1", generatedAt),
      "Area 2": getBinWeek("Area 2", generatedAt),
    },
    generatedAt: generatedAt.toISOString(),
    records: transformed.records,
    schemaVersion: 2,
    source: sourceUrl,
    weekStarting: getWeekStarting(generatedAt),
  };

  yield* Effect.log(`Usable rows: ${formatNumber(transformed.records.length)}`);
  yield* Effect.log(
    `Skipped without address: ${formatNumber(transformed.skipped.missingAddress)}`
  );
  yield* Effect.log(
    `Skipped without day: ${formatNumber(transformed.skipped.missingDay)}`
  );
  yield* Effect.log(
    `Skipped without area: ${formatNumber(transformed.skipped.missingArea)}`
  );
  yield* Effect.log(
    `Skipped with unsupported area: ${formatNumber(transformed.skipped.unsupportedArea)}`
  );
  yield* Effect.log(
    `Removed ${formatNumber(transformed.duplicateCount)} exact duplicates.`
  );
  yield* Effect.log(
    `Conflicting addresses: ${formatNumber(transformed.conflictingAddresses)}`
  );
  yield* fs
    .writeFileString(outputPath, `${JSON.stringify(output, null, 2)}\n`)
    .pipe(
      Effect.mapError(
        () => new ExportError(`Could not write dataset to ${outputPath}.`)
      )
    );

  yield* Effect.log("Done.");
  yield* Effect.log(`Current NZ collection week: ${output.weekStarting}`);
  yield* Effect.log(`Area 1: ${output.binWeek["Area 1"]}`);
  yield* Effect.log(`Area 2: ${output.binWeek["Area 2"]}`);
  yield* Effect.log(`Source records: ${formatNumber(ids.length)}`);
  yield* Effect.log(
    `Usable records: ${formatNumber(transformed.records.length)}`
  );
  yield* Effect.log(
    `Unique address rows: ${formatNumber(transformed.records.length)}`
  );
  yield* Effect.log(
    `Conflicting addresses: ${formatNumber(transformed.conflictingAddresses)}`
  );
  yield* Effect.log(`Created: ${outputPath}`);
  return {
    outputPath,
    sourceRecords: ids.length,
    uniqueRecords: transformed.records.length,
    usableRecords: transformed.records.length,
  };
});
