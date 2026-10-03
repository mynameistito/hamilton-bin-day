import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

import { lookupAddress } from "@/lookup";

const ORIGIN_NOT_ALLOWED = "Origin not allowed";
const MCP_ALLOW = "POST, OPTIONS";

const createMcpServer = (): McpServer => {
  const server = new McpServer(
    { name: "hamilton-bin-day", version: "1.0.0" },
    {
      instructions:
        "Look up public Hamilton City Council bin collection schedules by street address.",
    }
  );

  server.registerTool(
    "lookup_bin_schedule",
    {
      description:
        "Find a Hamilton address and return its next bin collection date, collection day, and bins to put out. An unmatched address returns suggestions.",
      inputSchema: {
        address: z.string().describe("Hamilton street address to look up"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ address }) => {
      try {
        const { body, status } = await lookupAddress(address);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(body) }],
          isError: status !== 200,
          structuredContent: body,
        };
      } catch {
        const body = { error: "Council service unavailable" };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(body) }],
          isError: true,
          structuredContent: body,
        };
      }
    }
  );

  return server;
};

export const handleMcp = async (request: Request): Promise<Response> => {
  const origin = request.headers.get("Origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) {
        return Response.json({ error: ORIGIN_NOT_ALLOWED }, { status: 403 });
      }
    } catch {
      return Response.json({ error: ORIGIN_NOT_ALLOWED }, { status: 403 });
    }
  }

  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { Allow: MCP_ALLOW } });
  }

  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
};

export const handleMcpOptions = (request: Request): Response => {
  const origin = request.headers.get("Origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) {
        return Response.json({ error: ORIGIN_NOT_ALLOWED }, { status: 403 });
      }
    } catch {
      return Response.json({ error: ORIGIN_NOT_ALLOWED }, { status: 403 });
    }
  }

  const headers = new Headers({
    Allow: MCP_ALLOW,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID",
    Vary: "Origin",
  });
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return new Response(null, { status: 204, headers });
};
