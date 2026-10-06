# Web application

## OVERVIEW

React/TanStack Router PWA bundled by Vite and deployed with a Cloudflare Worker. The Worker serves lookup, stateless MCP, reminder APIs, scheduled push delivery, and static assets.

## STRUCTURE

```text
src/pages/       User-facing pages and page tests
src/components/  UI and interaction components
src/hooks/       Browser and reminder hooks
src/lib/         Scheduling, catalogue, notifications, and server-side push
src/worker.ts    Worker API dispatcher and scheduled handler
public/          Static public assets, including service worker
scripts/         Council catalogue synchronization
```

## WHERE TO LOOK

| Task | Location | Notes |
| --- | --- | --- |
| HTTP API routing | `src/worker.ts` | Calls domain handlers and falls back to assets |
| Address lookup | `src/lookup.ts` | Shared result/status behavior for HTTP and MCP |
| MCP endpoint | `src/mcp.ts` | Streamable HTTP tool endpoint |
| Pages / app composition | `src/pages/`, `src/main.tsx` | React route UI |
| Offline and push display | `src/service-worker-entry.js`, `src/service-worker-runtime.js`, `public/sw.js` | Browser service-worker behavior |
| Sorter data | `src/lib/bin-items-data.json`, `scripts/sync-hcc-bin-items.ts` | Source snapshot and guarded refresh |
| Worker deployment bindings | `../../alchemy.run.ts` | D1, Cron, rate limiting, production VAPID env |

## CONVENTIONS

- Keep route-specific worker behavior in the dispatcher and substantive business logic in `src/lib/` or endpoint modules.
- Colocate tests under `__tests__/` in the relevant source area; run `bun run --filter @mynameistito/hcc-bin-day-web test` from root.
- Worker and service-worker environments differ from browser UI; keep APIs/types compatible with their respective runtimes.

## ANTI-PATTERNS

- Reminder API mutations must remain same-origin and rate-limited; validate bounded JSON and push-provider endpoints server-side.
- Never persist a subscriber's street address or a derived lookup key in D1.
- A successful local test/build does not substitute for the real-device PWA/push smoke checks documented in the root README.

## COMMANDS

```text
bun run dev:web
bun run dev:tunnel
bun run --filter @mynameistito/hcc-bin-day-web test
bun run --filter @mynameistito/hcc-bin-day-web typecheck
bun run --filter @mynameistito/hcc-bin-day-web build
bun run vapid:generate
```
