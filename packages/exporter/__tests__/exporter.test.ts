import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { layer as nodeFileSystemLayer } from "@effect/platform-node/NodeFileSystem";
import { Effect, Layer } from "effect";
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
});
