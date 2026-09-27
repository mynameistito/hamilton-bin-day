// oxlint-disable-next-line sonarjs/no-wildcard-import
import * as Effect from "effect/Effect";
// oxlint-disable-next-line sonarjs/no-wildcard-import
import * as Layer from "effect/Layer";
import { describe, expect, test } from "vitest";

import { resolveAddressQuery } from "@/address";
import { HccApi } from "@/hcc-api";

const apiLayer = Layer.succeed(HccApi, {
  getCollectionSchedule: () =>
    Effect.succeed({
      address: "14B Mountbatten Place",
      collectionDay: 1,
      collectionDayName: "Monday",
      collectionWeek: 1,
      nextCollection: {
        bins: ["red bin", "food scraps bin"],
        date: "2026-09-21",
        type: "red" as const,
      },
      redBin: "2026-09-21",
      upcomingWeek: "red" as const,
      yellowBin: "2026-09-28",
    }),
  searchAddresses: (query) =>
    Effect.succeed(
      query === "14b mountbatten pl"
        ? ["14B Mountbatten Place"]
        : ["12 Other Road"]
    ),
});

describe("address resolution", () => {
  test("resolves an exact normalized address through the HccApi seam", async () => {
    const result = await Effect.runPromise(
      resolveAddressQuery("14b mountbatten pl").pipe(Effect.provide(apiLayer))
    );

    expect(result).toMatchObject({
      matchedAddress: "14B Mountbatten Place",
      ok: true,
    });
  });

  test("returns suggestions when no exact match exists", async () => {
    const result = await Effect.runPromise(
      resolveAddressQuery("unknown road").pipe(Effect.provide(apiLayer))
    );

    expect(result).toStrictEqual({ matches: ["12 Other Road"], ok: false });
  });

  test("retries expanded queries, filters council placeholders, and handles missing schedules", async () => {
    const queries: string[] = [];
    const noScheduleLayer = Layer.succeed(HccApi, {
      getCollectionSchedule: () => Effect.succeed(null),
      searchAddresses: (query) => {
        queries.push(query);
        return Effect.succeed(
          query === "14b mountbatten pl"
            ? []
            : ["No address found", "14B Mountbatten Place"]
        );
      },
    });

    const result = await Effect.runPromise(
      resolveAddressQuery("14b mountbatten pl").pipe(
        Effect.provide(noScheduleLayer)
      )
    );

    expect(queries).toStrictEqual([
      "14b mountbatten pl",
      "14B mountbatten place",
    ]);
    expect(result).toStrictEqual({
      matches: ["14B Mountbatten Place"],
      ok: false,
    });
  });

  test("returns no suggestions after filtering the council no-address placeholder", async () => {
    const placeholderLayer = Layer.succeed(HccApi, {
      getCollectionSchedule: () => Effect.succeed(null),
      searchAddresses: () => Effect.succeed(["No address found"]),
    });

    const result = await Effect.runPromise(
      resolveAddressQuery("unknown road").pipe(Effect.provide(placeholderLayer))
    );

    expect(result).toStrictEqual({ matches: [], ok: false });
  });
});
