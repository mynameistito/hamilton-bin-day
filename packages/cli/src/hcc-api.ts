import { layerFetch } from "@effect/platform-node/NodeHttpClient";
import { Service } from "effect/Context";
import {
  fail,
  flatMap,
  gen,
  map,
  mapError,
  succeed,
  try as tryEffect,
} from "effect/Effect";
import type { Effect as EffectType } from "effect/Effect";
import { HttpClient } from "effect/http/HttpClient";
import type { HttpClient as HttpClientService } from "effect/http/HttpClient";
import type { HttpClientResponse } from "effect/http/HttpClientResponse";
import { effect as layerEffect, provide as provideLayer } from "effect/Layer";
import { decodeUnknownSync } from "effect/Schema";
import type { ConstraintDecoder, Schema as SchemaTypes } from "effect/Schema";

import {
  AddressLookupResultsSchema,
  CollectionDatesResultsSchema,
} from "@/council-schema";
import { HccApiError } from "@/hcc-api-error";
import { buildSchedule } from "@/schedule";
import type { CollectionSchedule } from "@/schedule";

type AddressLookup = SchemaTypes.Type<
  typeof AddressLookupResultsSchema
>[number];
type CollectionDates = SchemaTypes.Type<
  typeof CollectionDatesResultsSchema
>[number];
type ApiOperation = HccApiError["operation"];

/** The application-owned council API capability. */
export class HccApi extends Service<HccApi, HccApiService>()(
  "hcc-api/HccApi"
) {}

/** Operations exposed by the council API service. */
export interface HccApiService {
  readonly searchAddresses: (
    searchString: string
  ) => EffectType<readonly string[], HccApiError>;
  readonly getCollectionSchedule: (
    address: string
  ) => EffectType<CollectionSchedule | null, HccApiError>;
}

const decodeResponseBody = <S extends ConstraintDecoder<unknown>>(
  response: HttpClientResponse,
  operation: ApiOperation,
  schema: S
) =>
  response.json.pipe(
    mapError(
      (cause) => new HccApiError({ cause, operation, reason: "decode" })
    ),
    flatMap((untrustedJson) =>
      tryEffect({
        catch: (cause) =>
          new HccApiError({ cause, operation, reason: "decode" }),
        try: () => decodeUnknownSync(schema)(untrustedJson),
      })
    )
  );

const getHttpResult = <S extends ConstraintDecoder<unknown>>(
  response: HttpClientResponse,
  operation: ApiOperation,
  schema: S,
  emptyResult: S["Type"]
) => {
  if (response.status === 404) {
    return succeed(emptyResult);
  }

  if (response.status < 200 || response.status >= 300) {
    return fail(
      new HccApiError({
        cause: response,
        operation,
        reason: "http",
        status: response.status,
      })
    );
  }

  return decodeResponseBody(response, operation, schema);
};

const mapTransportError = <A>(
  effect: EffectType<A, unknown>,
  operation: ApiOperation
): EffectType<A, HccApiError> =>
  effect.pipe(
    mapError((cause) =>
      cause instanceof HccApiError
        ? cause
        : new HccApiError({ cause, operation, reason: "transport" })
    )
  );

const projectAddresses = (
  results: readonly AddressLookup[]
): readonly string[] => results.map((result) => result.Collection_Address);

const EMPTY_ADDRESS_RESULTS: readonly AddressLookup[] = [];
const EMPTY_COLLECTION_RESULTS: readonly CollectionDates[] = [];

const buildFirstSchedule = (
  results: readonly CollectionDates[],
  scheduleBuilder: typeof buildSchedule
) => {
  const [first] = results;
  if (!first) {
    return succeed(null);
  }

  return tryEffect({
    catch: (cause) =>
      new HccApiError({
        cause,
        operation: "getCollectionSchedule",
        reason: "domain",
      }),
    try: () => scheduleBuilder(first),
  });
};

/**
 * Build the API service using a supplied schedule converter.
 *
 * @param scheduleBuilder - Converts a validated collection record into a schedule.
 * @returns An API service effect requiring the Effect HTTP client.
 */
const make = (
  scheduleBuilder: typeof buildSchedule = buildSchedule
): EffectType<HccApiService, never, HttpClientService> =>
  gen(function* makeApi() {
    const client = yield* HttpClient;

    const searchAddresses = (searchString: string) => {
      const url = new URL(
        "/FightTheLandFill/get_Addresses",
        "https://api2.hcc.govt.nz"
      );
      url.searchParams.set("search_string", searchString);

      return mapTransportError(
        client.get(url).pipe(
          flatMap((response) =>
            getHttpResult(
              response,
              "searchAddresses",
              AddressLookupResultsSchema,
              EMPTY_ADDRESS_RESULTS
            )
          ),
          map(projectAddresses)
        ),
        "searchAddresses"
      );
    };

    const getCollectionSchedule = (address: string) => {
      const url = new URL(
        "/FightTheLandFill/get_Collection_Dates",
        "https://api2.hcc.govt.nz"
      );
      url.searchParams.set("address_string", address);

      const result = client.get(url).pipe(
        flatMap((response) =>
          getHttpResult(
            response,
            "getCollectionSchedule",
            CollectionDatesResultsSchema,
            EMPTY_COLLECTION_RESULTS
          )
        ),
        flatMap((results) => buildFirstSchedule(results, scheduleBuilder))
      );

      return mapTransportError(result, "getCollectionSchedule");
    };

    return { getCollectionSchedule, searchAddresses };
  });

/**
 * Create an API layer with an injectable schedule builder and HTTP client.
 *
 * @param scheduleBuilder - Converts validated Council data into a schedule.
 * @returns The API service layer, requiring an HTTP client.
 */
export const hccApiLayerWithoutDependencies = (
  scheduleBuilder: typeof buildSchedule = buildSchedule
) => layerEffect(HccApi, make(scheduleBuilder));

/** Production API layer using the Effect Node HTTP client. */
export const hccApiLayer = hccApiLayerWithoutDependencies().pipe(
  provideLayer(layerFetch)
);
