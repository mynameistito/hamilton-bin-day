# Hamilton Bin Day

[![CI](https://github.com/mynameistito/hamilton-bin-day/actions/workflows/ci.yml/badge.svg)](https://github.com/mynameistito/hamilton-bin-day/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Look up the next Hamilton City Council bin collection for an address, or use the TypeScript CLI client to query the same public service.

- **Web app:** address lookup, next collection date, and bins to put out.
- **Documentation:** collection guide and project details at `/docs`.
- **CLI:** published TypeScript client at `@hamilton-bin-day/cli`.

## What it does

- searches Hamilton addresses
- resolves a street address to a bin collection schedule
- supports text and JSON output

## Council sorter catalogue

The web app includes the full Hamilton City Council public sorter catalogue, including the Council's destination wording and handling/disposal advice. The checked-in item count and snapshot date are recorded in `apps/web/src/lib/bin-items-data.json` (`source.verifiedOn`). The catalogue is sourced from [Hamilton City Council's Fight the Landfill sorter](https://hamilton.govt.nz/fight-the-landfill) and is informational convenience, not a substitute for current Council advice.

Refresh or check the catalogue from the repository root:

```bash
bun run bins:sync        # fetch the listing and all item details, then update the local data
bun run bins:sync --check # fail with a stale-data message without writing files
```

The refresh stops without changing the checked-in data if any detail fails or the Council introduces an unknown result category.

The current public sorter entries 231 and 232 classify clean cardboard/plastic takeaway containers as red-bin items. This conflicts with the Council's [kerbside collection guidance](https://hamilton.govt.nz/fight-the-landfill/kerbside-collection), which says clean cardboard and plastics numbered 1, 2, and 5 go in the yellow bin. The catalogue preserves the sorter results rather than guessing which Council source is authoritative; confirm current Council advice for these items.

## API endpoints

The deployed web Worker exposes a stateless, read-only MCP Streamable HTTP endpoint:

- `POST https://bin-day.mynameistito.com/api/mcp` — initialize an MCP connection, list tools, and call `lookup_bin_schedule`.
- `OPTIONS /api/mcp` — responds to same-origin OPTIONS requests. Cross-origin `Origin` values are rejected, so browser cross-origin preflight requests are not supported.

The `lookup_bin_schedule` tool accepts `{ "address": "12 Grey Street" }` and returns the same `found`, `matchedAddress`, and `schedule` result as `GET /api/lookup?address=12%20Grey%20Street`. Unmatched addresses return `found: false` and suggestions; invalid input and Council service failures are returned as MCP tool errors. The endpoint is stateless (clients do not retain a session ID), has no A2A endpoint, and supports POST rather than server-initiated GET streams.

For an MCP client that supports Streamable HTTP, configure the server URL as `https://bin-day.mynameistito.com/api/mcp`. No local MCP process or API key is required. The service calls Hamilton City Council's public API, so schedule availability depends on that upstream service.

The web Worker lookup endpoint is also available as `GET /api/lookup?address=...`.

### Bin-day reminder status

The web app lets a user explicitly enable reminders, choose a lead time and local delivery time, and save a schedule using a browser push subscription. The sender resolves the instant in the selected IANA timezone, including DST boundaries. There are no accounts or cross-device sync. Notification permission is requested only by the enable control; unsupported browsers, denied permission, insecure contexts, and iOS browsers that are not installed Home Screen apps are reported. The browser retains the opaque push endpoint locally so it can delete the server record even if PushManager no longer returns the subscription.

Closed-app delivery is implemented with a scheduled Worker, a stage-specific D1 database, and Web Push (RFC 8291/8292 via `@block65/webcrypto-web-push`). It checks due notifications every five minutes, uses a claim and stable collection/preference notification ID to make retries idempotent, suppresses duplicate displays in the service worker, retries transient push failures, and removes subscriptions rejected with HTTP 404/410. A schedule lookup updates the snapshot for an existing browser subscription. The server stores only the push subscription, next and following collection dates/bin-week, timezone, reminder preferences, and operational timestamps/claim state. It does **not** store the street address or an address-derived lookup key. With no account, the push endpoint itself is the unguessable per-device authorization capability used for updates and deletion.

The closed-app sender cannot re-query the Council without retaining an address or equivalent lookup key. Once enabled, reminders continue each week until the user unsubscribes or the push provider invalidates the endpoint (HTTP 404/410). The sender projects alternating weekly collection dates from the latest two-date snapshot; a fresh schedule lookup replaces that snapshot. Exceptional Council date changes therefore require a fresh lookup. The server does not expire an opted-in subscription based on age, including when delivery is temporarily unavailable. No production VAPID credentials are committed. Until the complete VAPID configuration and D1 binding are deployed, the API safely returns “not configured” and does not claim a subscription was saved.

#### Enabling delivery in a deployment

The trusted production deploy provisions the D1 database and five-minute Cron Trigger through Alchemy. Configure GitHub repository settings once:

1. Generate a long-lived keypair once with `bun run vapid:generate`. The script prints the values; it does not save them. Keep the private key secret.
2. Add `VAPID_PRIVATE_KEY` as a GitHub Actions **secret**.
3. Add `VAPID_PUBLIC_KEY` as a GitHub Actions **variable**.
4. Optionally set `VAPID_SUBJECT` as a GitHub Actions **variable**. If omitted, the deploy workflow uses the project's contact address, `mailto:contact+hamilton-bin-day@mynameistito.com`.
5. Deploy through the normal trusted workflow (merge/push to `main`). GitHub Actions passes the private key to Alchemy as a redacted value, which Alchemy provisions as a Cloudflare Worker `secret_text` binding. The public key and subject are non-secret Worker configuration. Do not use `wrangler secret put` or commit key material.

The keypair is stable deployment configuration; it is never generated during CI, builds, deploys, Cron runs, or subscription creation. Rotating it is an explicit operation and may invalidate or disrupt existing browser subscriptions. PR artifact previews intentionally receive no VAPID values and cannot send real push notifications; `/api/reminders/public-key` returns the safe `503` not-configured response and the UI reports that background delivery is unavailable.

#### Production reminder smoke test

After the production deploy, verify the endpoint returns the configured public key:

```sh
curl -i https://bin-day.mynameistito.com/api/reminders/public-key
```

Then, on a real installed PWA device:

1. Verify denied notification permission is clearly reported with browser-settings guidance.
2. Enable reminders and select a lead time and local delivery time.
3. Close the app before send time and verify a notification arrives.
4. Click the notification and verify it opens the app.
5. Verify duplicate delivery is not displayed twice.
6. Look up a changed schedule and confirm it replaces the old server snapshot.
7. Unsubscribe and verify the D1 subscription is removed.
8. Verify a provider 404 or 410 removes a stale subscription.

Prefer Android Chrome and, when available, an installed iOS Safari PWA. Automated tests cover local request construction, encryption, retries, cleanup, and service-worker display behavior; they do not replace this real-device smoke test. No physical-device test is claimed for this change.

The web Worker and CLI use the public Hamilton City Council backend used by the Fight the Landfill page:

- `GET /FightTheLandFill/get_Addresses?search_string=...`
- `GET /FightTheLandFill/get_Collection_Dates?address_string=...`

Base URL:

```text
https://api2.hcc.govt.nz
```

## Usage

```bash
npx @hamilton-bin-day/cli
npx @hamilton-bin-day/cli --version
npx @hamilton-bin-day/cli search "12 Grey Street"
npx @hamilton-bin-day/cli lookup "12 Grey Street"
npx @hamilton-bin-day/cli schedule "12 Grey Street"
npx @hamilton-bin-day/cli --json lookup "12 Grey Street"
```

## Output modes

- `search` returns matching addresses
- `schedule` returns the collection schedule for an exact match
- `lookup` searches for an exact match and falls back to suggestions
- `--json` prints structured JSON for scripting
- `--version` (or `-v`) prints the installed package version

## Project structure

```text
apps/
  docs/      Blume content and configuration
  web/       TanStack React app, Cloudflare Worker, and Tailwind CSS
packages/
  cli/       Published @hamilton-bin-day/cli client
```

## Development

```bash
bun install
bun run dev:web             # TanStack React site
bun run dev:site            # Web site plus docs, with docs served at /docs
bun run dev:web:tunnel      # Web app with an opt-in Cloudflare Quick Tunnel
bun run dev:docs            # Blume docs
bun run dev:cli             # CLI
bun run check
bun run typecheck
bun run test
bun run build
```

The repository is a Bun workspace. Its CLI, web app, and Blume documentation packages are `@hamilton-bin-day/cli`, `@hamilton-bin-day/web`, and `@hamilton-bin-day/docs`. The CLI's primary executable is `hamilton-bin-day`; the deprecated `hcc-bin-day` alias remains available for existing scripts. Run `bun run dev:site` to start both development servers and serve the docs through the web app at `/docs`, matching the production URL structure. To share the web app temporarily, run `bun run dev:web:tunnel`; the Cloudflare Vite plugin starts a Quick Tunnel and prints its public `trycloudflare.com` URL. Anyone with the URL can reach the development server and its HMR endpoints, so only share it with people you trust. Press `t` then Enter to toggle the tunnel, or stop the dev server to close it. `bun run dev:web` stays local-only. In production, the docs are built into the website's `/docs` path and deployed together as one Cloudflare Worker.

## Deployment

Deploy and destroy Cloudflare resources with Alchemy:

```bash
STAGE=prod bun run deploy
STAGE=prod bun run destroy
```

Production deploys to `https://bin-day.mynameistito.com`; preview stages use their stage-specific `workers.dev` URLs. Alchemy also keeps the production Worker available on `workers.dev`. Before deploying, the `mynameistito.com` zone must exist in the target Cloudflare account so Alchemy can attach the custom domain and manage its DNS/certificate. Configure repository secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`. The token should be scoped to the target account with **Workers Scripts: Edit**, **D1: Edit**, and **Secrets Store: Edit** permissions. GitHub Actions uses [`mynameistito/alchemy-deploy`](https://github.com/mynameistito/alchemy-deploy), pinned immutably to v3.1.4. Credential-free CI uploads the built Worker and site assets; PR previews deploy only that exact-run artifact. No non-Cloudflare hosting is used.

### PWA install smoke test

- **Android (Chrome):** visit the production site over HTTPS, open the browser menu, choose **Install app** (or **Add to Home screen**), then launch it and confirm it opens without browser chrome. After a successful visit, enable airplane mode and confirm the app shell opens with a clear offline message and no collection details.
- **iOS (Safari):** visit the production site, tap **Share → Add to Home Screen**, then launch the home-screen icon and confirm it opens in standalone mode. Repeat the airplane-mode check to confirm schedules are hidden while offline.

## Tooling

- Type checking: TypeScript via `tsc` (`bun run typecheck`)
- Bundling: `tsdown` targeting Node.js

## Disclaimer

This project is unofficial and is not affiliated with, endorsed by, supported by, or associated with Hamilton City Council.

It is provided independently as a convenience for accessing publicly available collection data. API behavior, availability, response formats, and returned data may change without notice.

## License

[MIT](LICENSE)
