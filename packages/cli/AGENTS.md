# CLI package

## OVERVIEW

Published `@mynameistito/hcc-bin-day` package: a Node.js TypeScript CLI and Effect-based client for Hamilton City Council's public address/schedule API.

## STRUCTURE

```text
src/index.ts       CLI entrypoint and commands
src/hcc-api.ts     Council HTTP API calls
src/council-schema.ts, types.ts  External payload validation and domain types
src/address.ts, normalize-address.ts  Address matching/normalization
src/schedule.ts    Collection schedule interpretation
__tests__/         Vitest unit tests
tsdown.config.ts   Published bundle configuration
```

## WHERE TO LOOK

| Task | Location | Notes |
| --- | --- | --- |
| Add CLI behavior | `src/index.ts` | Keep text and `--json` output behavior coherent |
| Change upstream requests | `src/hcc-api.ts` | Council API endpoints and errors |
| Parse council responses | `src/council-schema.ts` | Validate at the external boundary |
| Address matching | `src/address.ts`, `src/normalize-address.ts` | Exact match and suggestion behavior |
| Schedule behavior | `src/schedule.ts` | Collection type/date interpretation |
| Publish artifact | `tsdown.config.ts`, `package.json` | CLI bin points to `dist/index.mjs` |

## CONVENTIONS

- Add tests in `__tests__/`; do not place tests next to source files.
- Keep the published package runtime requirement at Node.js 22+ and the build output aligned with the package `bin`/`main` fields.
- `prepack` runs checks, typecheck, and build before packaging.

## COMMANDS

```text
bun run --filter @mynameistito/hcc-bin-day test
bun run --filter @mynameistito/hcc-bin-day typecheck
bun run --filter @mynameistito/hcc-bin-day build
bun run --filter @mynameistito/hcc-bin-day dev
```

## ANTI-PATTERNS

- Do not treat Council response data as trusted; preserve validation and explicit errors for upstream changes.
- Do not change the package identity or public CLI output without considering published consumers.
