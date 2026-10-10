import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { layer as nodeFileSystemLayer } from "@effect/platform-node/NodeFileSystem";
import { Effect, FileSystem, Layer, Logger, PlatformError } from "effect";
import { isFailure } from "effect/Exit";
import { describe, expect, it } from "vitest";

import { ArcGisClient } from "@/arcgis/client";
import { exportDataset } from "@/exporter";

describe("export pipeline", () => {
  it("fails with an Effect error and does not write an incomplete download", async () => {
    const outputPath = path.join(tmpdir(), `hcc-bin-day-${randomUUID()}.json`);
    const api: ArcGisClient["Service"] = {
      allObjectIds: Effect.succeed([1, 2]),
      featuresByObjectIds: () =>
        Effect.succeed([
          {
            attributes: {
              OBJECTID: 1,
              Parcel_Street_Address: "12 Grey Street",
            },
          },
        ]),
    };
    const dependencies = Layer.mergeAll(
      Layer.succeed(ArcGisClient, ArcGisClient.of(api)),
      nodeFileSystemLayer
    );

    const result = await Effect.runPromise(
      Effect.exit(exportDataset(outputPath).pipe(Effect.provide(dependencies)))
    );

    expect(isFailure(result)).toBeTruthy();
    expect(existsSync(outputPath)).toBeFalsy();
  });

  it("preserves the previous dataset when writing the temporary file fails", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "hcc-bin-day-"));
    const outputPath = path.join(directory, "dataset.json");
    writeFileSync(outputPath, "previous dataset\n");

    try {
      const fileSystem = await Effect.runPromise(
        FileSystem.FileSystem.pipe(Effect.provide(nodeFileSystemLayer))
      );
      const failingFileSystem = FileSystem.FileSystem.of({
        ...fileSystem,
        writeFileString: (filePath, data, options) =>
          fileSystem.writeFileString(filePath, data.slice(0, 8), options).pipe(
            Effect.flatMap(() =>
              Effect.fail(
                PlatformError.systemError({
                  _tag: "Unknown",
                  method: "writeFileString",
                  module: "FileSystem",
                })
              )
            )
          ),
      });
      const api: ArcGisClient["Service"] = {
        allObjectIds: Effect.succeed([1]),
        featuresByObjectIds: () =>
          Effect.succeed([
            {
              attributes: {
                OBJECTID: 1,
                Parcel_Street_Address: "12 Grey Street",
                RubbishRecycling_Area_Day: "Monday",
                RubbishRecycling_Area_Type: "Area 1",
              },
            },
          ]),
      };
      const dependencies = Layer.mergeAll(
        Layer.succeed(ArcGisClient, ArcGisClient.of(api)),
        Layer.succeed(FileSystem.FileSystem, failingFileSystem)
      );

      const result = await Effect.runPromise(
        Effect.exit(
          exportDataset(outputPath).pipe(Effect.provide(dependencies))
        )
      );

      expect(isFailure(result)).toBeTruthy();
      expect(readFileSync(outputPath, "utf-8")).toBe("previous dataset\n");
      expect(readdirSync(directory)).toStrictEqual(["dataset.json"]);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("logs usable records including duplicate schedules", async () => {
    const outputPath = path.join(tmpdir(), `hcc-bin-day-${randomUUID()}.json`);
    const logMessages: unknown[] = [];
    const logger = Logger.make(({ message }) => logMessages.push(message));
    const api: ArcGisClient["Service"] = {
      allObjectIds: Effect.succeed([1, 2]),
      featuresByObjectIds: () =>
        Effect.succeed(
          [1, 2].map((OBJECTID) => ({
            attributes: {
              OBJECTID,
              Parcel_Street_Address: "12 Grey Street",
              RubbishRecycling_Area_Day: "Monday",
              RubbishRecycling_Area_Type: "Area 1",
            },
          }))
        ),
    };
    const dependencies = Layer.mergeAll(
      Layer.succeed(ArcGisClient, ArcGisClient.of(api)),
      nodeFileSystemLayer,
      Logger.layer([logger])
    );

    try {
      const summary = await Effect.runPromise(
        exportDataset(outputPath).pipe(Effect.provide(dependencies))
      );

      expect(summary.usableRecords).toBe(2);
      expect(summary.uniqueRecords).toBe(1);
      expect(logMessages.map(String)).toContain("Usable records: 2");
    } finally {
      rmSync(outputPath, { force: true });
    }
  });
});
