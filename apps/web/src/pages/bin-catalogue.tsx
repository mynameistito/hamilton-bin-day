import { useState } from "react";

import { BinItemCard } from "@/components/bin-item-card";
import { Input } from "@/components/ui/input";
import {
  BIN_ITEM_SOURCE,
  BIN_ITEMS,
  BIN_TYPES,
  binTypeName,
  searchBinItems,
} from "@/lib/bin-items";
import type { BinType } from "@/lib/bin-items";

const verificationDateFormatter = new Intl.DateTimeFormat("en-NZ", {
  dateStyle: "long",
  timeZone: "UTC",
});

export const BinCataloguePage = () => {
  const [query, setQuery] = useState("");
  const [selectedBin, setSelectedBin] = useState<BinType | null>(null);
  const matchingItems = query.trim() ? searchBinItems(query) : BIN_ITEMS;
  const items = selectedBin
    ? matchingItems.filter((item) => item.bin === selectedBin)
    : matchingItems;
  const itemLabel = items.length === 1 ? "item" : "items";
  const resultContext = query.trim() ? "found" : "in the catalogue";
  const resultSummary = items.length
    ? `${items.length} ${itemLabel} ${resultContext}`
    : `No item matches “${query}”. Try another search.`;

  return (
    <main className="bg-canvas text-ink min-h-dvh px-4 pb-10 sm:px-5">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 py-4 sm:py-5">
        <a
          className="flex items-center gap-2.5 font-bold tracking-tight sm:gap-3"
          href="/"
        >
          <span
            aria-hidden="true"
            className="bg-forest grid size-9 place-items-center rounded-xl text-lg text-white sm:size-10"
          >
            ♻
          </span>
          <span>
            Hamilton{" "}
            <span className="text-copy-muted font-normal">Bin Day</span>
          </span>
        </a>
        <a
          className="text-sage-dark rounded-lg px-3 py-2 text-sm font-semibold underline-offset-4 hover:underline"
          href="/"
        >
          Back to home
        </a>
      </header>

      <section className="mx-auto w-full max-w-4xl pt-8 sm:pt-12">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
          What goes where?
        </h1>
        <p className="text-body-muted mt-3 max-w-2xl text-base leading-7">
          Search an item to find out which Hamilton bin it belongs in. Browse
          the full Council sorter below.
        </p>

        <label className="mt-7 block font-semibold" htmlFor="catalogue-search">
          Search all items
        </label>
        <Input
          autoComplete="off"
          className="mt-2"
          id="catalogue-search"
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Search by item name, e.g. glass bottles"
          type="search"
          variant="search"
          value={query}
        />

        <fieldset className="mt-5">
          <legend className="text-sm font-semibold">Filter by bin</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              aria-pressed={selectedBin === null}
              className={`focus-visible:outline-focus-leaf rounded-full border px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 ${selectedBin === null ? "border-focus-leaf bg-highlight text-ink" : "border-sage-border bg-panel text-ink hover:border-forest"}`}
              onClick={() => setSelectedBin(null)}
              type="button"
            >
              All bins
            </button>
            {BIN_TYPES.map((bin) => (
              <button
                aria-pressed={selectedBin === bin}
                className={`focus-visible:outline-focus-leaf rounded-full border px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 ${selectedBin === bin ? "border-focus-leaf bg-highlight text-ink" : "border-sage-border bg-panel text-ink hover:border-forest"}`}
                key={bin}
                onClick={() => setSelectedBin(bin)}
                type="button"
              >
                {binTypeName(bin)}
              </button>
            ))}
          </div>
        </fieldset>

        <p aria-live="polite" className="text-copy-muted mt-4 text-sm">
          {resultSummary}
        </p>

        {items.length > 0 && (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {items.map((item) => (
              <BinItemCard imagePlacement="center" item={item} key={item.id} />
            ))}
          </ul>
        )}

        <p className="text-copy-muted mt-8 text-xs leading-5">
          Checked{" "}
          {verificationDateFormatter.format(
            new Date(`${BIN_ITEM_SOURCE.verifiedOn}T12:00:00Z`)
          )}
          . Council advice may change; see{" "}
          <a
            className="underline underline-offset-2"
            href={BIN_ITEM_SOURCE.url}
            rel="noreferrer"
            target="_blank"
          >
            Hamilton City Council’s item sorter
          </a>{" "}
          for the latest guidance.
        </p>
      </section>
    </main>
  );
};
