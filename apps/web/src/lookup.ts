import {
  AddressLookupResultsSchema,
  CollectionDatesResultsSchema,
} from "@cli/council-schema";
import {
  expandAddressQuery,
  filterAddressMatches,
  pickMatchingAddress,
} from "@cli/normalize-address";
import { buildSchedule } from "@cli/schedule";
import { decodeUnknownSync } from "effect/Schema";
import type { Codec } from "effect/Schema";

import { isLookupAddressValid } from "@/lib/address";

const councilApi = "https://api2.hcc.govt.nz";
const COUNCIL_API_TIMEOUT_MS = 10_000;

const getJson = async <A>(
  url: URL,
  schema: Codec<A, unknown, never, unknown>
): Promise<A> => {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(COUNCIL_API_TIMEOUT_MS),
  });
  if (response.status === 404) {
    return decodeUnknownSync(schema)([]);
  }
  if (!response.ok) {
    throw new Error(`Council API returned ${response.status}`);
  }
  return decodeUnknownSync(schema)(await response.json());
};

export interface LookupResult {
  readonly status: number;
  readonly body:
    | { readonly error: string }
    | { readonly found: false; readonly matches: readonly string[] }
    | {
        readonly found: true;
        readonly matchedAddress: string;
        readonly schedule: ReturnType<typeof buildSchedule>;
      };
}

export const lookupAddress = async (
  rawAddress: string | null
): Promise<LookupResult> => {
  if (!rawAddress?.trim()) {
    return { body: { error: "An address is required" }, status: 400 };
  }
  if (!isLookupAddressValid(rawAddress)) {
    return {
      body: { error: "Address must be 160 characters or fewer" },
      status: 413,
    };
  }
  const address = rawAddress.trim();

  const addressUrl = new URL("/FightTheLandFill/get_Addresses", councilApi);
  addressUrl.searchParams.set("search_string", address);
  let addresses = await getJson(addressUrl, AddressLookupResultsSchema);
  const expanded = expandAddressQuery(address);
  if (addresses.length === 0 && expanded !== address) {
    addressUrl.searchParams.set("search_string", expanded);
    addresses = await getJson(addressUrl, AddressLookupResultsSchema);
  }

  const matches = filterAddressMatches(
    addresses.map(({ Collection_Address }) => Collection_Address)
  );
  const matchedAddress = pickMatchingAddress(address, matches);
  if (!matchedAddress) {
    return { body: { found: false, matches }, status: 200 };
  }

  const scheduleUrl = new URL(
    "/FightTheLandFill/get_Collection_Dates",
    councilApi
  );
  scheduleUrl.searchParams.set("address_string", matchedAddress);
  const [result] = await getJson(scheduleUrl, CollectionDatesResultsSchema);
  if (!result) {
    return { body: { found: false, matches }, status: 200 };
  }
  return {
    body: { found: true, matchedAddress, schedule: buildSchedule(result) },
    status: 200,
  };
};
