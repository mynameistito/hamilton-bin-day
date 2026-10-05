import { layerFetch as nodeHttpClientLayer } from "@effect/platform-node/NodeHttpClient";
import { Context, Effect, Layer, Schedule, Schema } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";

import { ArcGisError } from "@/arcgis/error";

/** URL of the HCC ArcGIS feature service used as the export source. */
export const sourceUrl =
  "https://services1.arcgis.com/R6s0QqCMQdwKY6yp/ArcGIS/rest/services/app_basedata/FeatureServer/2/query";
const RETRIES = 5;

const ArcGisErrorSchema = Schema.Struct({
  code: Schema.Number,
  details: Schema.optional(Schema.Array(Schema.String)),
  message: Schema.String,
});

const IdResponseSchema = Schema.Struct({
  error: Schema.optional(ArcGisErrorSchema),
  objectIds: Schema.optional(Schema.Array(Schema.Number)),
});

const FeatureSchema = Schema.Struct({
  attributes: Schema.Struct({
    OBJECTID: Schema.Number,
    Parcel_Street_Address: Schema.optional(Schema.NullOr(Schema.String)),
    RubbishRecycling_Area_Day: Schema.optional(Schema.NullOr(Schema.String)),
    RubbishRecycling_Area_Type: Schema.optional(Schema.NullOr(Schema.String)),
  }),
});

const FeatureResponseSchema = Schema.Struct({
  error: Schema.optional(ArcGisErrorSchema),
  exceededTransferLimit: Schema.optional(Schema.Boolean),
  features: Schema.optional(Schema.Array(FeatureSchema)),
});

/** A validated ArcGIS feature used by the transformation layer. */
export type ArcGisFeature = Schema.Schema.Type<typeof FeatureSchema>;

/** Operations needed to retrieve HCC's ArcGIS feature records. */
export class ArcGisClient extends Context.Service<
  ArcGisClient,
  {
    /** Retrieve the complete OBJECTID set for the service layer. */
    readonly allObjectIds: Effect.Effect<readonly number[], ArcGisError>;
    /** Retrieve property features for a batch of OBJECTIDs. */
    readonly featuresByObjectIds: (
      objectIds: readonly number[]
    ) => Effect.Effect<readonly ArcGisFeature[], ArcGisError>;
  }
>()("hcc-bin-day-exporter/arcgis/Client") {}

const decodeError = (error: Schema.Schema.Type<typeof ArcGisErrorSchema>) => {
  const details = error.details?.length ? ` ${error.details.join(" ")}` : "";
  return new ArcGisError(`ArcGIS ${error.code}: ${error.message}${details}`);
};

const make = Effect.gen(function* make() {
  const rawClient = yield* HttpClient.HttpClient;
  const client = rawClient.pipe(
    HttpClient.filterStatusOk,
    HttpClient.retryTransient({
      schedule: Schedule.exponential("1 second"),
      times: RETRIES,
    })
  );

  const request = <S extends Schema.Constraint>(
    params: Readonly<Record<string, string>>,
    schema: S
  ): Effect.Effect<S["Type"], ArcGisError, S["DecodingServices"]> =>
    HttpClientRequest.post(sourceUrl).pipe(
      HttpClientRequest.bodyText(
        new URLSearchParams({ ...params, f: "json" }).toString(),
        "application/x-www-form-urlencoded"
      ),
      HttpClientRequest.setHeader("user-agent", "hcc-bin-day-export/1.0"),
      client.execute,
      Effect.flatMap(HttpClientResponse.schemaBodyJson(schema)),
      Effect.mapError(() => new ArcGisError("ArcGIS request failed"))
    );

  const allObjectIds = Effect.fn("ArcGisClient.allObjectIds")(
    function* allObjectIds() {
      const response = yield* request(
        { returnGeometry: "false", returnIdsOnly: "true", where: "1=1" },
        IdResponseSchema
      );
      if (response.error) {
        return yield* Effect.fail(decodeError(response.error));
      }
      return response.objectIds ?? [];
    }
  )();

  const featuresByObjectIds = Effect.fn("ArcGisClient.featuresByObjectIds")(
    function* featuresByObjectIds(objectIds: readonly number[]) {
      const response = yield* request(
        {
          objectIds: objectIds.join(","),
          outFields: [
            "OBJECTID",
            "Parcel_Street_Address",
            "RubbishRecycling_Area_Day",
            "RubbishRecycling_Area_Type",
          ].join(","),
          returnGeometry: "false",
        },
        FeatureResponseSchema
      );
      if (response.error) {
        return yield* Effect.fail(decodeError(response.error));
      }
      return response.features ?? [];
    }
  );

  return ArcGisClient.of({ allObjectIds, featuresByObjectIds });
});

/** Production ArcGIS client backed by Effect's Node HTTP client. */
export const layer = Layer.effect(ArcGisClient, make).pipe(
  Layer.provide(nodeHttpClientLayer)
);

/** ArcGIS client layer that keeps the HTTP client dependency available to callers. */
export const layerWithoutDependencies = Layer.effect(ArcGisClient, make);
