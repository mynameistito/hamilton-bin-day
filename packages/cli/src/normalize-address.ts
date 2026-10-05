const STREET_TYPE_ALIASES = {
  av: "avenue",
  ave: "avenue",
  avenue: "avenue",
  blvd: "boulevard",
  boulevard: "boulevard",
  cct: "circuit",
  circuit: "circuit",
  cl: "close",
  close: "close",
  court: "court",
  cres: "crescent",
  crescent: "crescent",
  ct: "court",
  dr: "drive",
  drive: "drive",
  gr: "grove",
  grove: "grove",
  heights: "heights",
  hts: "heights",
  lane: "lane",
  ln: "lane",
  parade: "parade",
  pde: "parade",
  pl: "place",
  place: "place",
  rd: "road",
  rise: "rise",
  road: "road",
  st: "street",
  street: "street",
  tce: "terrace",
  terrace: "terrace",
  way: "way",
} satisfies Record<string, string>;

const STREET_TYPE_ALIASES_MAP = new Map(Object.entries(STREET_TYPE_ALIASES));
const NO_ADDRESS_FOUND = "No address found";

/**
 * Remove the Council's placeholder value from search results.
 *
 * @param matches - Addresses returned by the Council API.
 * @returns Search results containing actual addresses only.
 */
export const filterAddressMatches = (
  matches: readonly string[]
): readonly string[] => matches.filter((match) => match !== NO_ADDRESS_FOUND);

const collapseWhitespace = (value: string): string =>
  value.trim().replaceAll(/\s+/gu, " ");

const normalizeUnitSuffix = (value: string): string =>
  value.replaceAll(
    /\b(?<number>\d+)\s*(?<suffix>[a-zA-Z])\b/gu,
    (_, number: string, suffix: string) => `${number}${suffix.toUpperCase()}`
  );

const expandStreetTypes = (value: string): string => {
  const tokens = value.split(" ");

  return tokens
    .map((token) => STREET_TYPE_ALIASES_MAP.get(token.toLowerCase()) ?? token)
    .join(" ");
};

const normalizeAddress = (address: string): string => {
  const normalized = collapseWhitespace(address).toLowerCase();

  return expandStreetTypes(normalizeUnitSuffix(normalized));
};

/**
 * Expand supported street abbreviations and normalize unit suffixes.
 *
 * @param query - An address query from the user.
 * @returns The query with street type aliases expanded.
 */
export const expandAddressQuery = (query: string): string => {
  const normalized = collapseWhitespace(query);

  return expandStreetTypes(normalizeUnitSuffix(normalized));
};

/**
 * Find the unique result equivalent to the normalized query.
 *
 * @param query - The original user query.
 * @param matches - Candidate addresses returned by the Council API.
 * @returns The unique matching address, or `null` when none or multiple match.
 */
export const pickMatchingAddress = (
  query: string,
  matches: readonly string[]
): string | null => {
  const normalizedQuery = normalizeAddress(query);
  const exactMatches = matches.filter(
    (match) => normalizeAddress(match) === normalizedQuery
  );

  if (exactMatches.length === 1) {
    return exactMatches.join("");
  }

  return null;
};
