import { gen } from "effect/Effect";
import type { Effect as EffectType } from "effect/Effect";

import { HccApi } from "@/hcc-api";
import type { HccApiError } from "@/hcc-api-error";
import {
  expandAddressQuery,
  filterAddressMatches,
  pickMatchingAddress,
} from "@/normalize-address";
import type { CollectionSchedule } from "@/schedule";

/** A successful or unsuccessful resolution of an address query. */
export type AddressResolution =
  | {
      ok: true;
      matchedAddress: string;
      schedule: CollectionSchedule;
    }
  | {
      ok: false;
      matches: readonly string[];
    };

/**
 * Resolve an address query against council search and collection data.
 *
 * @param query - The user-provided address query.
 * @returns The matching schedule or the available address suggestions.
 */
export const resolveAddressQuery = (
  query: string
): EffectType<AddressResolution, HccApiError, HccApi> => {
  const expandedQuery = expandAddressQuery(query);
  return gen(function* resolveAddress() {
    const api = yield* HccApi;
    let matches = filterAddressMatches(yield* api.searchAddresses(query));

    if (matches.length === 0 && expandedQuery !== query) {
      matches = filterAddressMatches(yield* api.searchAddresses(expandedQuery));
    }

    if (matches.length === 0) {
      return { matches: [], ok: false };
    }

    const matchedAddress = pickMatchingAddress(query, matches);

    if (!matchedAddress) {
      return { matches, ok: false };
    }

    const schedule = yield* api.getCollectionSchedule(matchedAddress);

    if (!schedule) {
      return { matches, ok: false };
    }

    return { matchedAddress, ok: true, schedule };
  });
};
