import { describe, expect, test } from "vitest";

import {
  fetchCouncilCatalogue,
  parseSorterDetail,
  planCatalogueSync,
  renderCatalogue,
} from "../../../../../scripts/sync-hcc-bin-items";

const listingItem = { id: 42, text: "Glass jars & bottles" } as const;
const detail = {
  success: true,
  title: "Glass jars & bottles",
  html: '<img src="/SorterGlassCrate.png"/><h3>Glass jars &amp; bottles</h3><h4>Use the glass recycling crate.</h4><small><p>Remove lids&nbsp;and rinse.</p></small>',
};

describe("Council sorter catalogue sync", () => {
  test("normalizes HTML entities, whitespace, category, destination and notes", () => {
    expect(parseSorterDetail(listingItem, detail)).toStrictEqual({
      id: 42,
      item: "Glass jars & bottles",
      bin: "glass",
      destination: "Use the glass recycling crate.",
      notes: "Remove lids and rinse.",
    });
  });

  test("fails safely for failed details, unknown categories, and name mismatches", () => {
    expect(() =>
      parseSorterDetail(listingItem, { ...detail, success: false })
    ).toThrow("detail failed");
    expect(() =>
      parseSorterDetail(listingItem, {
        ...detail,
        html: detail.html.replace("SorterGlassCrate", "SorterMysteryBin"),
      })
    ).toThrow("unknown category");
    expect(() =>
      parseSorterDetail(listingItem, {
        ...detail,
        html: detail.html.replace("Glass jars &amp; bottles", "Something else"),
      })
    ).toThrow("listing/detail mismatch");
  });

  test("checks and updates through the injected fetch seam", async () => {
    const calls: Request[] = [];
    const fetcher: typeof fetch = async (input, init) => {
      const request = new Request(input, init);
      calls.push(request);
      if (request.method === "GET") {
        return Response.json({ results: [listingItem] });
      }
      return Response.json(detail);
    };
    const fetched = await fetchCouncilCatalogue(fetcher, "2026-10-03");
    expect(calls).toHaveLength(2);
    expect(await calls[1]?.text()).toBe("id=42");
    const content = renderCatalogue(fetched);
    expect(planCatalogueSync(content, fetched, true).changed).toBe(false);
    const stale = planCatalogueSync("old data", fetched, true);
    expect(stale.changed).toBe(true);
    expect(stale.message).toContain("stale");
    expect(stale.content).toBe(content);
    expect(planCatalogueSync("old data", fetched, false).message).toContain(
      "Updated the Council sorter catalogue with 1 items"
    );
  });

  test("does not produce a partial catalogue if a detail fetch fails", async () => {
    const fetcher: typeof fetch = async (input, init) => {
      const request = new Request(input, init);
      if (request.method === "GET") {
        return Response.json({ results: [listingItem, { id: 43, text: "Other" }] });
      }
      if (new URLSearchParams(await request.text()).get("id") === "43") {
        return new Response("unavailable", { status: 503 });
      }
      return Response.json(detail);
    };
    await expect(fetchCouncilCatalogue(fetcher, "2026-10-03")).rejects.toThrow(
      "detail request failed for item 43"
    );
  });
});
