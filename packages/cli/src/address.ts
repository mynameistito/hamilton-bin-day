// oxlint-disable-next-line sonarjs/no-wildcard-import
import * as Effect from "effect/Effect";

import { HccApi } from "@/hcc-api";
import type { HccApiError } from "@/hcc-api";
import {
  expandAddressQuery,
  filterAddressMatches,
  pickMatchingAddress,
} from "@/normalize-address";
import type { CollectionSchedule } from "@/schedule";

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

export const resolveAddressQuery = (
  query: string
): Effect.Effect<AddressResolution, HccApiError, HccApi> => {
  const expandedQuery = expandAddressQuery(query);
  return Effect.gen(function* resolveAddress() {
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
