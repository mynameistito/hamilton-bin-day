/** Council bin types represented by the locally verified item guide. */
export type BinType = "yellow" | "red" | "glass" | "food-scraps";

/** A council-sourced item classification and any handling instruction. */
export interface BinItem {
  /** Item wording shown by Hamilton City Council's sorter. */
  readonly item: string;
  /** Destination stated by the Council sorter. */
  readonly bin: BinType;
  /** Preparation wording included in the Council item name or result. */
  readonly notes?: string;
}

/** Provenance for the deliberately small, manually checked starter dataset. */
export const BIN_ITEM_SOURCE = {
  url: "https://hamilton.govt.nz/fight-the-landfill",
  verifiedOn: "2026-10-03",
  note: "Checked in the Council's searchable item sorter with Playwriter. Only explicit sorter results are included; this is not a complete accepted-items list.",
} as const;

/** Items whose destinations were explicitly returned by the Council sorter. */
export const BIN_ITEMS: readonly BinItem[] = [
  { item: "Aluminium cans", bin: "yellow" },
  {
    item: "Apple core",
    bin: "food-scraps",
  },
  {
    item: "Baby formula tins (remove lid and scoop)",
    bin: "yellow",
    notes: "Remove lid and scoop.",
  },
  {
    item: "Glass bottles - brown, green, clear, blue, opaque (no lids)",
    bin: "glass",
    notes: "No lids.",
  },
];

const normalize = (value: string): string => value.trim().toLocaleLowerCase();

/** Find verified Council items whose names contain the user's search text. */
export const searchBinItems = (query: string): readonly BinItem[] => {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) {
    return [];
  }

  return BIN_ITEMS.filter((entry) =>
    normalize(entry.item).includes(normalizedQuery)
  );
};

/** Council-facing name for each supported bin type. */
const binTypeNames: Record<BinType, string> = {
  yellow: "yellow recycling wheelie bin",
  red: "red rubbish wheelie bin",
  glass: "glass recycling crate",
  "food-scraps": "food scraps bin",
};

/** Human-readable Council bin name used in guidance and lookup results. */
export const binTypeName = (bin: BinType): string => binTypeNames[bin];

/** Map a Council collection bin label to a known bin type without guessing. */
export const binTypeFromName = (name: string): BinType | null => {
  const normalized = normalize(name);
  if (normalized.includes("yellow")) {
    return "yellow";
  }
  if (normalized.includes("glass")) {
    return "glass";
  }
  if (normalized.includes("food scraps")) {
    return "food-scraps";
  }
  if (normalized.includes("red")) {
    return "red";
  }
  return null;
};
