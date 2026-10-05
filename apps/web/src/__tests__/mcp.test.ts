import { afterEach, describe, expect, vi, it } from "vitest";

import worker from "@/worker";

const assets = {
  fetch: vi.fn<(request: Request) => Promise<Response>>(),
};

interface McpRequest {
  readonly id: number;
  readonly jsonrpc: "2.0";
  readonly method: "initialize" | "tools/list" | "tools/call";
  readonly params: object;
}

const postMcp = (body: McpRequest, origin?: string) => {
  const headers = new Headers({
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
  });
  if (origin) {
    headers.set("Origin", origin);
  }
  return worker.fetch(
    new Request("https://example.test/api/mcp", {
      body: JSON.stringify(body),
      headers,
      method: "POST",
    }),
    { ASSETS: assets }
  );
};

describe("MCP Streamable HTTP endpoint", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("initializes and lists the read-only bin schedule tool", async () => {
    const response = await postMcp({
      id: 1,
      jsonrpc: "2.0",
      method: "initialize",
      params: {
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
        protocolVersion: "2025-11-25",
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      result: {
        protocolVersion: "2025-11-25",
        serverInfo: { name: "hamilton-bin-day", version: "1.0.0" },
      },
    });

    const tools = await postMcp({
      id: 2,
      jsonrpc: "2.0",
      method: "tools/list",
      params: {},
    });
    expect(tools.status).toBe(200);
    await expect(tools.json()).resolves.toMatchObject({
      result: {
        tools: [
          {
            annotations: { readOnlyHint: true },
            inputSchema: {
              properties: { address: { type: "string" } },
              required: ["address"],
            },
            name: "lookup_bin_schedule",
          },
        ],
      },
    });
  });

  it("calls the lookup tool and returns the existing schedule result", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValueOnce(
          Response.json([{ Collection_Address: "12 Grey Street" }])
        )
        .mockResolvedValueOnce(
          Response.json([
            {
              Address: "12 Grey Street",
              CollectionDay: 1,
              CollectionWeek: 1,
              RedBin: "2026-09-21T00:00:00",
              YellowBin: "2026-09-28T00:00:00",
            },
          ])
        )
    );

    const response = await postMcp({
      id: 3,
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        arguments: { address: "12 Grey Street" },
        name: "lookup_bin_schedule",
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      result: {
        isError: false,
        structuredContent: {
          found: true,
          matchedAddress: "12 Grey Street",
          schedule: {
            collectionDayName: "Monday",
            nextCollection: { type: "red" },
          },
        },
      },
    });
  });

  it("returns lookup validation and upstream failures as tool errors", async () => {
    const invalidAddress = await postMcp({
      id: 4,
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        arguments: { address: "x".repeat(161) },
        name: "lookup_bin_schedule",
      },
    });
    await expect(invalidAddress.json()).resolves.toMatchObject({
      result: {
        isError: true,
        structuredContent: {
          error: "Address must be 160 characters or fewer",
        },
      },
    });

    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(new Response(null, { status: 503 }))
    );
    const upstreamFailure = await postMcp({
      id: 5,
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        arguments: { address: "12 Grey Street" },
        name: "lookup_bin_schedule",
      },
    });
    await expect(upstreamFailure.json()).resolves.toMatchObject({
      result: {
        isError: true,
        structuredContent: { error: "Council service unavailable" },
      },
    });
  });

  it("returns a Council request timeout as an MCP tool error", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof globalThis.fetch>()
        .mockRejectedValue(
          new DOMException("The operation was aborted", "TimeoutError")
        )
    );

    const response = await postMcp({
      id: 6,
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        arguments: { address: "12 Grey Street" },
        name: "lookup_bin_schedule",
      },
    });

    await expect(response.json()).resolves.toMatchObject({
      result: {
        isError: true,
        structuredContent: { error: "Council service unavailable" },
      },
    });
  });

  it("rejects cross-origin requests and does not allow GET streaming", async () => {
    const crossOrigin = await postMcp(
      { id: 1, jsonrpc: "2.0", method: "tools/list", params: {} },
      "https://attacker.test"
    );
    const crossOriginOptions = await worker.fetch(
      new Request("https://example.test/api/mcp", {
        headers: { Origin: "https://attacker.test" },
        method: "OPTIONS",
      }),
      { ASSETS: assets }
    );
    expect([crossOrigin.status, crossOriginOptions.status]).toStrictEqual([
      403, 403,
    ]);

    const get = await worker.fetch(
      new Request("https://example.test/api/mcp"),
      { ASSETS: assets }
    );
    expect(get.status).toBe(405);
    expect(get.headers.get("Allow")).toBe("POST, OPTIONS");

    const preflight = await worker.fetch(
      new Request("https://example.test/api/mcp", {
        headers: { Origin: "https://example.test" },
        method: "OPTIONS",
      }),
      { ASSETS: assets }
    );
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://example.test"
    );
  });
});
