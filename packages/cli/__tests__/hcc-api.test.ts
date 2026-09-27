// oxlint-disable-next-line sonarjs/no-wildcard-import
import * as Effect from "effect/Effect";
// oxlint-disable-next-line sonarjs/no-wildcard-import
import * as Layer from "effect/Layer";
// oxlint-disable-next-line sonarjs/no-wildcard-import
import * as HttpClient from "effect/unstable/http/HttpClient";
// oxlint-disable-next-line sonarjs/no-wildcard-import
import * as HttpClientError from "effect/unstable/http/HttpClientError";
// oxlint-disable-next-line sonarjs/no-wildcard-import
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";
import { describe, expect, test } from "vitest";

import { HccApi, hccApiLayerWithoutDependencies } from "@/hcc-api";
import type { buildSchedule } from "@/schedule";

const collection = {
  Address: "12 Grey Street",
  CollectionDay: 1,
  CollectionWeek: 1,
  RedBin: "2026-09-21T00:00:00",
  YellowBin: "2026-09-28T00:00:00",
};

const invalidJsonResponse = () =>
  new Response("not-json", {
    headers: { "content-type": "application/json" },
  });

const apiLayer = (
  respond: (url: URL) => Response | Promise<Response>,
  scheduleBuilder?: typeof buildSchedule
) => {
  const client = HttpClient.make((request, url) =>
    Effect.tryPromise({
      catch: (cause) =>
        new HttpClientError.HttpClientError({
          reason: new HttpClientError.TransportError({ cause, request }),
        }),
      try: async () => HttpClientResponse.fromWeb(request, await respond(url)),
    })
  );
  return hccApiLayerWithoutDependencies(scheduleBuilder).pipe(
    Layer.provide(Layer.succeed(HttpClient.HttpClient, client))
  );
};

const runWithApi = <A>(
  layer: ReturnType<typeof apiLayer>,
  use: (api: typeof HccApi.Service) => Effect.Effect<A, unknown>
) =>
  Effect.runPromise(
    HccApi.pipe(
      Effect.flatMap((api) => use(api)),
      Effect.provide(layer)
    )
  );

const capture = <A>(effect: Effect.Effect<A, unknown>) =>
  effect.pipe(
    Effect.match({
      onFailure: (error) => ({ error }),
      onSuccess: (value) => ({ value }),
    })
  );

describe("HccApi HTTP adapter", () => {
  test("searches and decodes council address results", async () => {
    let requestedUrl: URL | undefined;
    const layer = apiLayer((url) => {
      requestedUrl = url;
      return Response.json([{ Collection_Address: "12 Grey Street" }]);
    });

    await expect(
      runWithApi(layer, (api) => api.searchAddresses("12 grey st"))
    ).resolves.toStrictEqual(["12 Grey Street"]);
    expect(requestedUrl?.searchParams.get("search_string")).toBe("12 grey st");
  });

  test("returns empty arrays and null for council 404 responses", async () => {
    const layer = apiLayer(() => new Response(null, { status: 404 }));

    await expect(
      runWithApi(layer, (api) => api.searchAddresses("missing"))
    ).resolves.toStrictEqual([]);
    await expect(
      runWithApi(layer, (api) => api.getCollectionSchedule("missing"))
    ).resolves.toBeNull();
  });

  test("maps unsuccessful HTTP responses with operation and status", async () => {
    const layer = apiLayer(() => new Response(null, { status: 503 }));
    const result = await runWithApi(layer, (api) =>
      capture(api.searchAddresses("query"))
    );

    expect(result).toMatchObject({
      error: { operation: "searchAddresses", reason: "http", status: 503 },
    });

    const invalidStatus = await runWithApi(
      apiLayer(() => {
        const response = new Response(null);
        Object.defineProperty(response, "status", { value: 199 });
        return response;
      }),
      (api) => capture(api.getCollectionSchedule("address"))
    );
    expect(invalidStatus).toMatchObject({
      error: {
        operation: "getCollectionSchedule",
        reason: "http",
        status: 199,
      },
    });
  });

  test("maps malformed response bodies and transport failures", async () => {
    const badBody = await runWithApi(
      apiLayer(() => Response.json([{ wrong: true }])),
      (api) => capture(api.searchAddresses("query"))
    );
    expect(badBody).toMatchObject({ error: { reason: "decode" } });

    const badAddressJson = await runWithApi(
      apiLayer(invalidJsonResponse),
      (api) => capture(api.searchAddresses("query"))
    );
    expect(badAddressJson).toMatchObject({
      error: { operation: "searchAddresses", reason: "decode" },
    });

    const badScheduleJson = await runWithApi(
      apiLayer(invalidJsonResponse),
      (api) => capture(api.getCollectionSchedule("address"))
    );
    expect(badScheduleJson).toMatchObject({
      error: { operation: "getCollectionSchedule", reason: "decode" },
    });

    const offline = await runWithApi(
      apiLayer(() => Promise.reject(new Error("offline"))),
      (api) => capture(api.searchAddresses("query"))
    );
    expect(offline).toMatchObject({
      error: { operation: "searchAddresses", reason: "transport" },
    });

    const scheduleOffline = await runWithApi(
      apiLayer(() => Promise.reject(new Error("offline"))),
      (api) => capture(api.getCollectionSchedule("address"))
    );
    expect(scheduleOffline).toMatchObject({
      error: { operation: "getCollectionSchedule", reason: "transport" },
    });
  });

  test("builds collection schedules and maps invalid collection responses", async () => {
    const result = await runWithApi(
      apiLayer(() => Response.json([collection])),
      (api) => api.getCollectionSchedule("12 Grey Street")
    );
    expect(result).toMatchObject({
      address: "12 Grey Street",
      upcomingWeek: "red",
    });

    const invalid = await runWithApi(
      apiLayer(() => Response.json([{ ...collection, RedBin: "bad" }])),
      (api) => capture(api.getCollectionSchedule("address"))
    );
    expect(invalid).toMatchObject({
      error: { operation: "getCollectionSchedule", reason: "decode" },
    });
  });

  test("maps schedule construction failures to a domain error", async () => {
    const result = await runWithApi(
      apiLayer(
        () => Response.json([collection]),
        () => {
          throw new Error("schedule cannot be built");
        }
      ),
      (api) => capture(api.getCollectionSchedule("address"))
    );

    expect(result).toMatchObject({
      error: { operation: "getCollectionSchedule", reason: "domain" },
    });
  });
});
