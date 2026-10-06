# PROJECT KNOWLEDGE BASE

**Generated:** 2026-10-06
**Commit:** be3d035
**Branch:** main

## OVERVIEW
Hamilton bin-collection lookup for web and CLI, backed by Hamilton City Council's public API. Bun workspace: React/TanStack Router + Cloudflare Worker, Effect-based TypeScript CLI, and Blume docs.

## STRUCTURE
```text
apps/docs/             Blume content and configuration
apps/web/              React app, Worker API, reminders, and PWA
packages/cli/           Published CLI/client package
scripts/                Workspace build and Alchemy command wrappers
alchemy.run.ts          Cloudflare Worker, D1, and rate-limit resources
```

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Address/schedule client and CLI | `packages/cli/src/` | Council API parsing, normalization, schedule, CLI entrypoint |
| Web routes and UI | `apps/web/src/pages/`, `components/` | TanStack Router and React |
| Worker endpoints / MCP | `apps/web/src/worker.ts`, `lookup.ts`, `mcp.ts` | API request dispatch and Council lookup |
| Push reminders | `apps/web/src/lib/` | Scheduling, Web Push, subscription storage; see child guide |
| Sorter catalogue | `apps/web/src/lib/bin-items*`, `apps/web/scripts/` | Checked-in Council data and safe refresh workflow |
| Deployment | `alchemy.run.ts`, `.github/workflows/` | Alchemy owns Cloudflare resources and deploy flow |
| Docs | `apps/docs/content/` | MDX content served under `/docs` |

## CODE MAP
| Symbol | Type | Location | Role |
|---|---|---|---|
| `fetch` | Worker handler | `apps/web/src/worker.ts` | Routes API requests and serves static assets |
| `sendDueReminders` | Effect | `apps/web/src/lib/reminder-server.ts` | Scheduled delivery and rolling schedule advancement |
| `lookupAddress` | Function | `apps/web/src/lookup.ts` | Shared web address lookup |

## CONVENTIONS
- Bun workspaces and catalog-managed shared dependencies; use declared scripts from root/package manifests.
- Tests live in each package's `__tests__/` directories and use Vitest.
- TypeScript uses strict project configs; web aliases use `@/` for `apps/web/src`.
- CLI package is the published package; `apps/web` and `apps/docs` are private workspace apps.

## ANTI-PATTERNS (THIS PROJECT)
- Do not store an address or address-derived lookup key in reminder records. Push endpoint is the per-device capability; retain only the documented schedule/preferences fields.
- Do not commit or generate VAPID key material in CI/builds. Production secrets are supplied through trusted deployment configuration.
- Do not silently alter Council sorter results to reconcile conflicting guidance; preserve source data and disclose the conflict.
- Do not write refreshed catalogue data if detail retrieval fails or an unknown result category is encountered.

## COMMANDS
```text
bun run dev                 # Local web app
bun run dev:docs             # Docs app
bun run check                # Ultracite checks
bun run typecheck            # Workspace and root type checks
bun run test                 # Workspace tests with coverage
bun run build                # CLI, docs, and web builds
bun run bins:sync            # Refresh Council catalogue
bun run bins:sync --check    # Check catalogue freshness without writing
bun run deploy               # Deploy current Alchemy stage
```

## NOTES
- Root CI script is `bun run ci` (check, typecheck, test, build).
- Reminder delivery requires deployed D1 and complete production VAPID configuration; unavailable config is handled as a safe disabled state.
- Council API is upstream and may change; schedule availability and response formats are not controlled here.
