import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";

/** A verified Council sorter image category. */
export type SorterBin = "yellow" | "red" | "glass" | "food-scraps" | "other";

/** A normalized Council sorter item and its published advice. */
export interface SorterItem {
  readonly id: number;
  readonly item: string;
  readonly bin: SorterBin;
  readonly destination: string;
  readonly notes?: string;
}

/** One item in the Council sorter's public Select2 listing. */
export interface SorterListingItem {
  readonly id: number;
  readonly text: string;
}

/** The complete sorter catalogue and the date it was fetched. */
export interface CouncilCatalogue {
  readonly checkedOn: string;
  readonly items: readonly SorterItem[];
}

interface CatalogueSyncPlan {
  readonly changed: boolean;
  readonly content: string;
  readonly message: string;
}

const SOURCE_URL = "https://hamilton.govt.nz/fight-the-landfill";
const LIST_URL = "https://hamilton.govt.nz/ftl/Select2SorterSearch";
const DETAIL_URL = "https://hamilton.govt.nz/ftl/SorterSelectionData";
const DATA_PATH = new URL("../src/lib/bin-items-data.json", import.meta.url);
const BIN_BY_IMAGE = {
  SorterFoodScraps: "food-scraps",
  SorterGlassCrate: "glass",
  SorterOtherDisposal: "other",
  SorterRedBin: "red",
  SorterYellowBin: "yellow",
} as const satisfies Record<string, SorterBin>;
const SORTER_IMAGE = z.enum([
  "SorterFoodScraps",
  "SorterGlassCrate",
  "SorterOtherDisposal",
  "SorterRedBin",
  "SorterYellowBin",
]);
const LISTING_RESPONSE = z.object({
  results: z.array(
    z.object({
      id: z.number().int().positive(),
      text: z.string(),
    })
  ),
});
const DETAIL_RESPONSE = z.object({
  html: z.string().optional(),
  success: z.boolean(),
  title: z.string().optional(),
});
const NAMED_ENTITIES = {
  amp: "&",
  apos: "'",
  gt: ">",
  hellip: "…",
  ldquo: "“",
  lsquo: "‘",
  lt: "<",
  mdash: "—",
  nbsp: " ",
  ndash: "–",
  quot: '"',
  rdquo: "”",
  rsquo: "’",
} as const satisfies Record<string, string>;

const normalizeWhitespace = (value: string): string =>
  value.replaceAll(/\s+/gu, " ").trim();

const decodeHtmlEntities = (value: string): string =>
  value.replaceAll(
    /&(?<reference>#x[\da-f]+|#\d+|[a-z]+);?/giu,
    (entity, reference: string) => {
      if (reference.startsWith("#x") || reference.startsWith("#X")) {
        return String.fromCodePoint(Number(`0${reference.slice(1)}`));
      }
      if (reference.startsWith("#")) {
        return String.fromCodePoint(Math.trunc(Number(reference.slice(1))));
      }

      const decoded = Object.entries(NAMED_ENTITIES).find(
        ([name]) => name === reference.toLowerCase()
      )?.[1];
      if (decoded === undefined) {
        throw new Error(`Unknown HTML entity in Council sorter response: ${entity}`);
      }
      return decoded;
    }
  );

const textFromHtml = (value: string): string =>
  normalizeWhitespace(
    decodeHtmlEntities(
      value
        .replaceAll(/<!--.*?-->/gsu, " ")
        .replaceAll(/<\/?(?:br|div|p|li|ul|ol|h[1-6])\b[^>]*>/giu, " ")
        .replaceAll(/<[^>]*>/gu, " ")
    )
  );

const sectionText = (html: string, tag: "h3" | "h4" | "small"): string => {
  const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "iu").exec(
    html
  );
  return match?.[1] ? textFromHtml(match[1]) : "";
};

/** Parse one Council sorter detail response into a normalized catalogue item. */
export const parseSorterDetail = (
  listingItem: SorterListingItem,
  input: unknown
): SorterItem => {
  const detail = DETAIL_RESPONSE.safeParse(input);
  if (!detail.success || !detail.data.success) {
    throw new Error(`Council sorter detail failed for item ${listingItem.id}`);
  }
  if (!detail.data.html || !detail.data.title) {
    throw new Error(`Council sorter detail was incomplete for item ${listingItem.id}`);
  }

  const imageMatch = /\/(?<image>Sorter[A-Za-z]+)\.png(?:["'?])/iu.exec(
    detail.data.html
  );
  const imageName = SORTER_IMAGE.safeParse(imageMatch?.groups?.image);
  if (!imageName.success) {
    throw new Error(`Council sorter returned an unknown category for item ${listingItem.id}`);
  }

  const item = sectionText(detail.data.html, "h3");
  const destination = sectionText(detail.data.html, "h4");
  const notes = sectionText(detail.data.html, "small");
  const normalizedListingText = normalizeWhitespace(listingItem.text).toLowerCase();
  if (
    !item ||
    !destination ||
    item.toLowerCase() !== normalizedListingText ||
    normalizeWhitespace(detail.data.title).toLowerCase() !== normalizedListingText
  ) {
    throw new Error(`Council sorter listing/detail mismatch for item ${listingItem.id}`);
  }

  const result: SorterItem = {
    bin: BIN_BY_IMAGE[imageName.data],
    destination,
    id: listingItem.id,
    item,
  };
  if (notes) {
    return { ...result, notes };
  }
  return result;
};

const fetchItemDetail = async (
  fetcher: typeof fetch,
  listingItem: SorterListingItem
): Promise<SorterItem> => {
  const response = await fetcher(DETAIL_URL, {
    body: new URLSearchParams({ id: String(listingItem.id) }),
    headers: {
      accept: "application/json, text/javascript, */*; q=0.01",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      origin: "https://hamilton.govt.nz",
      referer: SOURCE_URL,
      "x-requested-with": "XMLHttpRequest",
    },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(
      `Council sorter detail request failed for item ${listingItem.id} (${response.status})`
    );
  }
  return parseSorterDetail(listingItem, await response.json());
};

/** Fetch the full official listing and every item detail, failing on partial data. */
export const fetchCouncilCatalogue = async (
  fetcher: typeof fetch,
  checkedOn: string
): Promise<CouncilCatalogue> => {
  const response = await fetcher(LIST_URL, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Council sorter listing request failed (${response.status})`);
  }

  const listing = LISTING_RESPONSE.safeParse(await response.json());
  if (!listing.success || listing.data.results.length === 0) {
    throw new Error("Council sorter returned an invalid or empty item listing");
  }

  const items = listing.data.results.map((item) => ({
    ...item,
    text: normalizeWhitespace(item.text),
  }));
  const ids = new Set(items.map(({ id }) => id));
  if (ids.size !== items.length || items.some(({ text }) => !text)) {
    throw new Error("Council sorter listing contains duplicate IDs or blank item names");
  }

  const batchSize = 8;
  const fetchBatch = (offset: number): Promise<readonly SorterItem[]> =>
    Promise.all(
      items
        .slice(offset, offset + batchSize)
        .map((item) => fetchItemDetail(fetcher, item))
    );
  const fetchBatches = async (offset = 0): Promise<SorterItem[]> => {
    if (offset >= items.length) {
      return [];
    }
    const batch = await fetchBatch(offset);
    return [...batch, ...(await fetchBatches(offset + batchSize))];
  };

  return { checkedOn, items: await fetchBatches() };
};

/** Render the deterministic JSON representation written to the web catalogue. */
export const renderCatalogue = ({ checkedOn, items }: CouncilCatalogue): string =>
  `${JSON.stringify(
    { items, source: { url: SOURCE_URL, verifiedOn: checkedOn } },
    null,
    2
  )}\n`;

/** Plan a check-only or update result without performing filesystem writes. */
export const planCatalogueSync = (
  current: string,
  next: CouncilCatalogue,
  checkOnly: boolean
): CatalogueSyncPlan => {
  const content = renderCatalogue(next);
  const changed = content !== current;
  if (!changed) {
    return { changed: false, content, message: "Council sorter catalogue is up to date." };
  }
  return {
    changed: true,
    content,
    message: checkOnly
      ? "Council sorter catalogue is stale. Run `bun run bins:sync` to refresh it."
      : `Updated the Council sorter catalogue with ${next.items.length} items.`,
  };
};

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const checkOnly = args.length === 1 && args[0] === "--check";
  if (args.length > 0 && !checkOnly) {
    throw new Error("Usage: bun run bins:sync [--check]");
  }

  const checkedOn = new Date().toISOString().slice(0, 10);
  const next = await fetchCouncilCatalogue(fetch, checkedOn);
  const current = await readFile(DATA_PATH, "utf-8");
  const plan = planCatalogueSync(current, next, checkOnly);
  console.info(plan.message);
  if (checkOnly && plan.changed) {
    process.exitCode = 1;
  } else if (plan.changed) {
    await writeFile(DATA_PATH, plan.content, "utf-8");
  }
};

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Catalogue sync failed");
    process.exitCode = 1;
  }
}
