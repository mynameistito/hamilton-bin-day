import { flatMap, match, provide, runPromise, tryPromise } from "effect/Effect";
import type { Effect as EffectType } from "effect/Effect";
import { HttpClient, make } from "effect/http/HttpClient";
import { HttpClientError, TransportError } from "effect/http/HttpClientError";
import { fromWeb } from "effect/http/HttpClientResponse";
import { provide as provideLayer, succeed as layerSucceed } from "effect/Layer";
import { describe, expect, it } from "vitest";

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
  const client = make((request, url) =>
    tryPromise({
      catch: (cause) =>
        new HttpClientError({
          reason: new TransportError({ cause, request }),
        }),
      try: async () => fromWeb(request, await respond(url)),
    })
  );
  return hccApiLayerWithoutDependencies(scheduleBuilder).pipe(
    provideLayer(layerSucceed(HttpClient, client))
  );
};

const runWithApi = <A>(
  layer: ReturnType<typeof apiLayer>,
  use: (api: typeof HccApi.Service) => EffectType<A, unknown>
) =>
  runPromise(
    HccApi.pipe(
      flatMap((api) => use(api)),
      provide(layer)
    )
  );

const capture = <A>(effect: EffectType<A, unknown>) =>
  effect.pipe(
    match({
      onFailure: (error) => ({ error }),
      onSuccess: (value) => ({ value }),
    })
  );

describe("HccApi HTTP adapter", () => {
  it("searches and decodes council address results", async () => {
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

  it("returns empty arrays and null for council 404 responses", async () => {
    const layer = apiLayer(() => new Response(null, { status: 404 }));

    await expect(
      runWithApi(layer, (api) => api.searchAddresses("missing"))
    ).resolves.toStrictEqual([]);
    await expect(
      runWithApi(layer, (api) => api.getCollectionSchedule("missing"))
    ).resolves.toBeNull();
  });

  it("maps unsuccessful HTTP responses with operation and status", async () => {
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

  it("maps malformed response bodies and transport failures", async () => {
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

  it("builds collection schedules and maps invalid collection responses", async () => {
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

  it("maps schedule construction failures to a domain error", async () => {
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
