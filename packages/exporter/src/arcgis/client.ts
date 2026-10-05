import { layerFetch as nodeHttpClientLayer } from "@effect/platform-node/NodeHttpClient";
import { Context, Effect, Layer, Schedule, Schema } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";

import { ArcGisError } from "@/arcgis/error";

/**
 * URL of the HCC ArcGIS query endpoint used to retrieve property records.
 *
 * This URL is also recorded in each generated dataset as its data source.
 */
export const sourceUrl =
  "https://services1.arcgis.com/R6s0QqCMQdwKY6yp/ArcGIS/rest/services/app_basedata/FeatureServer/2/query";
/** Maximum number of attempts made for transient ArcGIS request failures. */
const RETRIES = 5;

/** ArcGIS error envelope used by the query endpoint. */
const ArcGisErrorSchema = Schema.Struct({
  code: Schema.Number,
  details: Schema.optional(Schema.Array(Schema.String)),
  message: Schema.String,
});

/** Object-ID query response schema. */
const IdResponseSchema = Schema.Struct({
  error: Schema.optional(ArcGisErrorSchema),
  objectIds: Schema.optional(Schema.Array(Schema.Number)),
});

/** Property feature schema limited to fields consumed by the exporter. */
const FeatureSchema = Schema.Struct({
  attributes: Schema.Struct({
    OBJECTID: Schema.Number,
    Parcel_Street_Address: Schema.optional(Schema.NullOr(Schema.String)),
    RubbishRecycling_Area_Day: Schema.optional(Schema.NullOr(Schema.String)),
    RubbishRecycling_Area_Type: Schema.optional(Schema.NullOr(Schema.String)),
  }),
});

/** Feature batch query response schema. */
const FeatureResponseSchema = Schema.Struct({
  error: Schema.optional(ArcGisErrorSchema),
  exceededTransferLimit: Schema.optional(Schema.Boolean),
  features: Schema.optional(Schema.Array(FeatureSchema)),
});

/**
 * An ArcGIS feature decoded from the query response and passed to dataset
 * transformation.
 */
export interface ArcGisFeature {
  /** ArcGIS attribute values used to build the public address record. */
  readonly attributes: {
    /** Stable object ID identifying the source feature. */
    readonly OBJECTID: number;
    /** Council-provided street address, if present. */
    readonly Parcel_Street_Address?: string | null | undefined;
    /** Council-provided collection weekday or `Not Serviced`, if present. */
    readonly RubbishRecycling_Area_Day?: string | null | undefined;
    /** Council collection area label, if present. */
    readonly RubbishRecycling_Area_Type?: string | null | undefined;
  };
}

/**
 * Effect service for retrieving the HCC property IDs and corresponding
 * address features.
 */
export class ArcGisClient extends Context.Service<
  ArcGisClient,
  {
    /**
     * Retrieve the complete set of object IDs in the feature layer.
     *
     * @returns All ArcGIS OBJECTIDs, or an `ArcGisError` if the request or
     * response decoding fails.
     */
    readonly allObjectIds: Effect.Effect<readonly number[], ArcGisError>;
    /**
     * Retrieve property features for one batch of object IDs.
     *
     * @param objectIds - OBJECTIDs to include in the ArcGIS query.
     * @returns The decoded features for the requested IDs, or an `ArcGisError`
     * if the request or response decoding fails.
     */
    readonly featuresByObjectIds: (
      objectIds: readonly number[]
    ) => Effect.Effect<readonly ArcGisFeature[], ArcGisError>;
  }
>()("hcc-bin-day-exporter/arcgis/Client") {}

/**
 * Convert an ArcGIS response error envelope to the adapter's typed error.
 *
 * @param error - The validated error envelope returned by ArcGIS.
 * @returns A typed adapter error containing the ArcGIS code and message.
 */
const decodeError = (error: Schema.Schema.Type<typeof ArcGisErrorSchema>) => {
  const details = error.details?.length ? ` ${error.details.join(" ")}` : "";
  return new ArcGisError(`ArcGIS ${error.code}: ${error.message}${details}`);
};

/** Build the ArcGIS service using the HTTP client supplied by the Layer graph. */
const make = Effect.gen(function* make() {
  const rawClient = yield* HttpClient.HttpClient;
  const client = rawClient.pipe(
    HttpClient.filterStatusOk,
    HttpClient.retryTransient({
      schedule: Schedule.exponential("1 second"),
      times: RETRIES,
    })
  );

  /**
   * Send a form-encoded query and decode its JSON response schema.
   *
   * @template S - The response schema used to decode the ArcGIS JSON body.
   * @param params - Query parameters encoded as form fields.
   * @param schema - Schema for the response body.
   * @returns A decoded response or an `ArcGisError` when the request or decode
   * fails.
   */
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
      const features = response.features ?? [];
      if (response.exceededTransferLimit) {
        yield* Effect.logWarning("ArcGIS reported exceededTransferLimit=true.");
      }
      if (features.length !== objectIds.length) {
        yield* Effect.logWarning(
          `ArcGIS returned ${features.length} features for a batch of ${objectIds.length} OBJECTIDs.`
        );
      }
      return features;
    }
  );

  return ArcGisClient.of({ allObjectIds, featuresByObjectIds });
});

/**
 * Production ArcGIS client Layer backed by Effect's Node HTTP client.
 *
 * @returns A Layer providing `ArcGisClient` without external requirements.
 */
export const layer = Layer.effect(ArcGisClient, make).pipe(
  Layer.provide(nodeHttpClientLayer)
);
