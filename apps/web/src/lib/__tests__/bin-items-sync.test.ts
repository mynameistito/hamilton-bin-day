import { describe, expect, test } from "vitest";

import {
  fetchCouncilCatalogue,
  parseSorterDetail,
  planCatalogueSync,
  renderCatalogue,
} from "@web-scripts/sync-hcc-bin-items";

const listingItem = { id: 42, text: "Glass jars & bottles" } as const;
const detail = {
  success: true,
  title: "Glass jars & bottles",
  html: '<img src="/SorterGlassCrate.png"/><h3>Glass jars &amp; bottles</h3><h4>Use the glass recycling crate.</h4><small><p>Remove lids&nbsp;and rinse.</p></small>',
};

const failingFetch: typeof fetch = async (input, init) => {
  const request = new Request(input, init);
  if (request.method === "GET") {
    return Response.json({ results: [listingItem, { id: 43, text: "Other" }] });
  }
  if (new URLSearchParams(await request.text()).get("id") === "43") {
    return new Response("unavailable", { status: 503 });
  }
  return Response.json(detail);
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
    const fetcher: typeof fetch = (input, init) => {
      const request = new Request(input, init);
      calls.push(request);
      if (request.method === "GET") {
        return Promise.resolve(Response.json({ results: [listingItem] }));
      }
      return Promise.resolve(Response.json(detail));
    };
    const fetched = await fetchCouncilCatalogue(fetcher, "2026-10-03");
    const detailRequest = calls.at(1);
    const detailBody = detailRequest ? await detailRequest.text() : null;
    const content = renderCatalogue(fetched);
    const freshPlan = planCatalogueSync(content, fetched, true);
    const stale = planCatalogueSync("old data", fetched, true);
    const update = planCatalogueSync("old data", fetched, false);
    expect({
      requestCount: calls.length,
      detailBody,
      isFresh: freshPlan.changed,
      checkChanged: stale.changed,
      checkMessage: stale.message,
      checkContent: stale.content,
      updateMessage: update.message,
      updateContent: update.content,
    }).toStrictEqual({
      requestCount: 2,
      detailBody: "id=42",
      isFresh: false,
      checkChanged: true,
      checkMessage: "Council sorter catalogue is stale. Run `bun run bins:sync` to refresh it.",
      checkContent: content,
      updateMessage: "Updated the Council sorter catalogue with 1 items.",
      updateContent: content,
    });
  });

  test("does not produce a partial catalogue if a detail fetch fails", async () => {
    await expect(fetchCouncilCatalogue(failingFetch, "2026-10-03")).rejects.toThrow(
      "detail request failed for item 43"
    );
  });
});
