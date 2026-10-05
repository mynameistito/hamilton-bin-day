#!/usr/bin/env node
import { fileURLToPath } from "node:url";

import { layer as nodeFileSystemLayer } from "@effect/platform-node/NodeFileSystem";
import { runMain } from "@effect/platform-node/NodeRuntime";
import { Effect, Layer } from "effect";

import { layer as arcGisLayer } from "@/arcgis/client";
import { exportDataset } from "@/exporter";

const outputPath = fileURLToPath(
  new URL("../hcc-bin-days.json", import.meta.url)
);
const dependencies = Layer.mergeAll(arcGisLayer, nodeFileSystemLayer);

const main = exportDataset(outputPath).pipe(Effect.provide(dependencies));

runMain(main);
