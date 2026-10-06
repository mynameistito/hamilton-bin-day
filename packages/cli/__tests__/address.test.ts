import { succeed, runPromise, provide } from "effect/Effect";
import { succeed as layerSucceed } from "effect/Layer";
import { describe, expect, it } from "vitest";

import { resolveAddressQuery } from "@/address";
import { HccApi } from "@/hcc-api";

const apiLayer = layerSucceed(HccApi, {
  getCollectionSchedule: () =>
    succeed({
      address: "12 Grey Street",
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
  searchAddresses: () => succeed(["12 Grey Street"]),
});

describe("address resolution", () => {
  it("resolves an exact normalized address through the HccApi seam", async () => {
    const result = await runPromise(
      resolveAddressQuery("12 grey st").pipe(provide(apiLayer))
    );

    expect(result).toMatchObject({
      matchedAddress: "12 Grey Street",
      ok: true,
    });
  });

  it("returns suggestions when no exact match exists", async () => {
    const result = await runPromise(
      resolveAddressQuery("unknown road").pipe(provide(apiLayer))
    );

    expect(result).toStrictEqual({ matches: ["12 Grey Street"], ok: false });
  });

  it("retries expanded queries, filters council placeholders, and handles missing schedules", async () => {
    const queries: string[] = [];
    const noScheduleLayer = layerSucceed(HccApi, {
      getCollectionSchedule: () => succeed(null),
      searchAddresses: (query) => {
        queries.push(query);
        return succeed(
          query === "12 grey st" ? [] : ["No address found", "12 Grey Street"]
        );
      },
    });

    const result = await runPromise(
      resolveAddressQuery("12 grey st").pipe(provide(noScheduleLayer))
    );

    expect(queries).toStrictEqual(["12 grey st", "12 grey street"]);
    expect(result).toStrictEqual({
      matches: ["12 Grey Street"],
      ok: false,
    });
  });

  it("returns no suggestions after filtering the council no-address placeholder", async () => {
    const placeholderLayer = layerSucceed(HccApi, {
      getCollectionSchedule: () => succeed(null),
      searchAddresses: () => succeed(["No address found"]),
    });

    const result = await runPromise(
      resolveAddressQuery("unknown road").pipe(provide(placeholderLayer))
    );

    expect(result).toStrictEqual({ matches: [], ok: false });
  });
});
