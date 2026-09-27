import type { IncomingMessage, ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vite";

type LookupHandler = (request: Request) => Promise<Response>;

const serveLookup = async (
  request: IncomingMessage,
  response: ServerResponse,
  loadLookup: () => Promise<LookupHandler>
): Promise<void> => {
  try {
    const lookupRequest = new Request(
      new URL(request.url ?? "/", "http://localhost"),
      { method: request.method ?? "GET" }
    );
    const lookupResponse = await (await loadLookup())(lookupRequest);
    response.statusCode = lookupResponse.status;
    for (const [key, value] of lookupResponse.headers.entries()) {
      response.setHeader(key, value);
    }
    response.end(await lookupResponse.text());
  } catch {
    response.statusCode = 502;
    response.end(JSON.stringify({ error: "Council service unavailable" }));
  }
};

const lookupDevPlugin: Plugin = {
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      if (request.url?.split("?")[0] !== "/api/lookup") {
        next();
        return;
      }
      void serveLookup(request, response, async () => {
        const worker = await server.ssrLoadModule("/src/worker.ts");
        const handleLookup: LookupHandler = worker["handleLookup"];
        return handleLookup;
      });
    });
  },
  name: "hcc-bin-day-dev-api",
};

export default defineConfig({
  plugins: [react(), tailwindcss(), lookupDevPlugin],
  resolve: {
    alias: [
      {
        find: /^@cli\/council-schema$/u,
        replacement: fileURLToPath(
          new URL("../../packages/cli/src/council-schema.ts", import.meta.url)
        ),
      },
      {
        find: /^@cli\/normalize-address$/u,
        replacement: fileURLToPath(
          new URL(
            "../../packages/cli/src/normalize-address.ts",
            import.meta.url
          )
        ),
      },
      {
        find: /^@cli\/schedule$/u,
        replacement: fileURLToPath(
          new URL("../../packages/cli/src/schedule.ts", import.meta.url)
        ),
      },
      {
        find: "@",
        replacement: fileURLToPath(new URL("src", import.meta.url)),
      },
    ],
  },
});
