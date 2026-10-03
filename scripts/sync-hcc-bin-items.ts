import { readFile, writeFile } from "node:fs/promises";

export type SorterBin = "yellow" | "red" | "glass" | "food-scraps" | "other";

export interface SorterItem {
  readonly id: number;
  readonly item: string;
  readonly bin: SorterBin;
  readonly destination: string;
  readonly notes?: string;
}

export interface SorterListingItem {
  readonly id: number;
  readonly text: string;
}

export interface CouncilCatalogue {
  readonly checkedOn: string;
  readonly items: readonly SorterItem[];
}

const SOURCE_URL = "https://hamilton.govt.nz/fight-the-landfill";
const LIST_URL = "https://hamilton.govt.nz/ftl/Select2SorterSearch";
const DETAIL_URL = "https://hamilton.govt.nz/ftl/SorterSelectionData";
const DATA_PATH = new URL(
  "../apps/web/src/lib/bin-items-data.json",
  import.meta.url
);
const BIN_BY_IMAGE: Readonly<Record<string, SorterBin>> = {
  SorterYellowBin: "yellow",
  SorterRedBin: "red",
  SorterGlassCrate: "glass",
  SorterFoodScraps: "food-scraps",
  SorterOtherDisposal: "other",
};
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
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
};

const normalizeWhitespace = (value: string): string =>
  value.replace(/\s+/gu, " ").trim();

const decodeHtmlEntities = (value: string): string =>
  value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);?/giu, (entity, reference: string) => {
    if (reference.startsWith("#x") || reference.startsWith("#X")) {
      return String.fromCodePoint(Number.parseInt(reference.slice(2), 16));
    }
    if (reference.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(reference.slice(1), 10));
    }

    const decoded = NAMED_ENTITIES[reference.toLowerCase()];
    if (decoded === undefined) {
      throw new Error(`Unknown HTML entity in Council sorter response: ${entity}`);
    }
    return decoded;
  });

const textFromHtml = (value: string): string =>
  normalizeWhitespace(
    decodeHtmlEntities(
      value
        .replace(/<!--.*?-->/gsu, " ")
        .replace(/<\/?(?:br|div|p|li|ul|ol|h[1-6])\b[^>]*>/giu, " ")
        .replace(/<[^>]*>/gu, " ")
    )
  );

const sectionText = (html: string, tag: "h3" | "h4" | "small"): string => {
  const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "iu").exec(
    html
  );
  return match?.[1] ? textFromHtml(match[1]) : "";
};

export const parseSorterDetail = (
  listingItem: SorterListingItem,
  detail: unknown
): SorterItem => {
  if (!detail || typeof detail !== "object") {
    throw new Error(`Council sorter returned an invalid detail for item ${listingItem.id}`);
  }

  const record = detail as Record<string, unknown>;
  if (record.success !== true || typeof record.html !== "string") {
    throw new Error(`Council sorter detail failed for item ${listingItem.id}`);
  }

  const image = /\/((?:Sorter)[A-Za-z]+)\.png(?:["'?])/iu.exec(record.html)?.[1];
  const bin = image ? BIN_BY_IMAGE[image] : undefined;
  if (!bin) {
    throw new Error(`Council sorter returned an unknown category for item ${listingItem.id}`);
  }

  const item = sectionText(record.html, "h3");
  const destination = sectionText(record.html, "h4");
  const notes = sectionText(record.html, "small");
  const listingText = normalizeWhitespace(listingItem.text);
  if (
    !item ||
    !destination ||
    item.toLocaleLowerCase() !== listingText.toLocaleLowerCase()
  ) {
    throw new Error(`Council sorter listing/detail mismatch for item ${listingItem.id}`);
  }

  return {
    id: listingItem.id,
    item,
    bin,
    destination,
    ...(notes ? { notes } : {}),
  };
};

const isListing = (value: unknown): value is { readonly results: readonly SorterListingItem[] } =>
  Boolean(
    value &&
      typeof value === "object" &&
      Array.isArray((value as { results?: unknown }).results) &&
      (value as { results: unknown[] }).results.every(
        (item) =>
          item &&
          typeof item === "object" &&
          Number.isSafeInteger((item as SorterListingItem).id) &&
          typeof (item as SorterListingItem).text === "string"
      )
  );

export const fetchCouncilCatalogue = async (
  fetcher: typeof fetch,
  checkedOn: string
): Promise<CouncilCatalogue> => {
  const listingResponse = await fetcher(LIST_URL, {
    headers: { accept: "application/json" },
  });
  if (!listingResponse.ok) {
    throw new Error(`Council sorter listing request failed (${listingResponse.status})`);
  }

  const listing: unknown = await listingResponse.json();
  if (!isListing(listing) || listing.results.length === 0) {
    throw new Error("Council sorter returned an invalid or empty item listing");
  }

  const ids = new Set<number>();
  for (const item of listing.results) {
    if (ids.has(item.id) || !normalizeWhitespace(item.text)) {
      throw new Error(`Council sorter listing contains a duplicate or blank item (${item.id})`);
    }
    ids.add(item.id);
  }

  const items: SorterItem[] = [];
  const batchSize = 8;
  for (let offset = 0; offset < listing.results.length; offset += batchSize) {
    const batch = listing.results.slice(offset, offset + batchSize);
    const details = await Promise.all(
      batch.map(async (listingItem) => {
        const response = await fetcher(DETAIL_URL, {
          method: "POST",
          headers: {
            accept: "application/json, text/javascript, */*; q=0.01",
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            origin: "https://hamilton.govt.nz",
            referer: SOURCE_URL,
            "x-requested-with": "XMLHttpRequest",
          },
          body: new URLSearchParams({ id: String(listingItem.id) }),
        });
        if (!response.ok) {
          throw new Error(
            `Council sorter detail request failed for item ${listingItem.id} (${response.status})`
          );
        }
        return parseSorterDetail(listingItem, await response.json());
      })
    );
    items.push(...details);
  }

  return { checkedOn, items };
};

export const renderCatalogue = ({ checkedOn, items }: CouncilCatalogue): string =>
  `${JSON.stringify(
    { source: { url: SOURCE_URL, verifiedOn: checkedOn }, items },
    null,
    2
  )}\n`;

export const planCatalogueSync = (
  current: string,
  next: CouncilCatalogue,
  checkOnly: boolean
): { readonly changed: boolean; readonly content: string; readonly message: string } => {
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

const main = async () => {
  const args = process.argv.slice(2);
  const checkOnly = args.length === 1 && args[0] === "--check";
  if (args.length > 0 && !checkOnly) {
    throw new Error("Usage: bun run bins:sync [--check]");
  }

  const checkedOn = new Date().toISOString().slice(0, 10);
  const next = await fetchCouncilCatalogue(fetch, checkedOn);
  const current = await readFile(DATA_PATH, "utf8");
  const plan = planCatalogueSync(current, next, checkOnly);
  console.info(plan.message);
  if (checkOnly && plan.changed) {
    process.exitCode = 1;
  } else if (plan.changed) {
    await writeFile(DATA_PATH, plan.content, "utf8");
  }
};

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
