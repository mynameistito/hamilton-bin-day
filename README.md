# @mynameistito/hcc-bin-day

[![CI](https://github.com/mynameistito/hcc-bin-day/actions/workflows/ci.yml/badge.svg)](https://github.com/mynameistito/hcc-bin-day/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Look up the next Hamilton City Council bin collection for an address, or use the TypeScript CLI client to query the same public service.

- **Web app:** address lookup, next collection date, and bins to put out.
- **Documentation:** collection guide and project details at `/docs`.
- **CLI:** published TypeScript client at `@mynameistito/hcc-bin-day`.

## What it does

- searches Hamilton addresses
- resolves a street address to a bin collection schedule
- supports text and JSON output

## API endpoints

The deployed web Worker exposes a stateless, read-only MCP Streamable HTTP endpoint:

- `POST https://bin-day.mynameistito.com/api/mcp` — initialize an MCP connection, list tools, and call `lookup_bin_schedule`.
- `OPTIONS /api/mcp` — responds to same-origin OPTIONS requests. Cross-origin `Origin` values are rejected, so browser cross-origin preflight requests are not supported.

The `lookup_bin_schedule` tool accepts `{ "address": "12 Grey Street" }` and returns the same `found`, `matchedAddress`, and `schedule` result as `GET /api/lookup?address=12%20Grey%20Street`. Unmatched addresses return `found: false` and suggestions; invalid input and Council service failures are returned as MCP tool errors. The endpoint is stateless (clients do not retain a session ID), has no A2A endpoint, and supports POST rather than server-initiated GET streams.

For an MCP client that supports Streamable HTTP, configure the server URL as `https://bin-day.mynameistito.com/api/mcp`. No local MCP process or API key is required. The service calls Hamilton City Council's public API, so schedule availability depends on that upstream service.

The web Worker lookup endpoint is also available as `GET /api/lookup?address=...`.

### Bin-day reminder status

The web app now lets a user save an explicit reminder preference, lead time, and local delivery time in that browser's local storage. It calculates the requested local instant from Hamilton's collection date (including local timezone and daylight-saving transitions). Preferences are device-local; there are no accounts or cross-device sync.

Closed-app delivery is **not configured**, so the app does not request browser notification permission and does not claim that reminders will be sent. The service worker accepts only validated push messages after a local opt-in marker and suppresses repeats with the same notification ID; it has no page timer and cannot schedule notifications on its own. No VAPID key, push subscription endpoint, subscription database, or reminder scheduler is currently deployed.

To enable production delivery, provision a VAPID key pair (keep the private key in a Cloudflare secret), an authenticated subscribe/unsubscribe API, durable storage for the minimal push subscription and reminder preferences, and a scheduled Worker (or queue-backed scheduler). Rechecking a schedule also requires retaining the address or equivalent Council lookup key on the server; that personal data is not collected server-side today, so its retention and privacy disclosure must be decided before enabling delivery. The sender must recompute the current Council schedule before delivery, cancel stale address/date schedules, use a stable per-subscription/collection/preference idempotency key, and delete expired push subscriptions. Only after this path is configured should the UI request permission and create a push subscription. No credentials or Cloudflare resources for this delivery path are included in this change.

#### Reminder delivery smoke test

- **Current deployment:** on Android Chrome and iOS Safari, install the PWA, opt in, choose **The day before** and a local time, then reload and confirm the selections persist. Confirm the UI reports that delivery is unavailable and that it did not prompt for notification permission. A closed-app delivery test is not possible until the backend above is provisioned.
- **After delivery is provisioned — Android:** allow notifications, set a test collection/reminder close to the current time, close the installed app before delivery, and verify one notification arrives at the selected local time. Tap it to open the app; resend the same push and verify it is not shown again.
- **After delivery is provisioned — iOS:** use a supported iOS version and an app launched from **Share → Add to Home Screen** in Safari. Repeat the permission, closed-app, selected-time, tap-through, and duplicate checks.
- On both platforms, also deny permission and verify the UI directs the user to browser settings; then change the collection schedule and verify an old collection reminder is cancelled before testing the new date.

The web Worker and CLI use the public Hamilton City Council backend used by the Fight the Landfill page:

- `GET /FightTheLandFill/get_Addresses?search_string=...`
- `GET /FightTheLandFill/get_Collection_Dates?address_string=...`

Base URL:

```text
https://api2.hcc.govt.nz
```

## Usage

```bash
npx @mynameistito/hcc-bin-day
npx @mynameistito/hcc-bin-day --version
npx @mynameistito/hcc-bin-day search "12 Grey Street"
npx @mynameistito/hcc-bin-day lookup "12 Grey Street"
npx @mynameistito/hcc-bin-day schedule "12 Grey Street"
npx @mynameistito/hcc-bin-day --json lookup "12 Grey Street"
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
  cli/       Published @mynameistito/hcc-bin-day client
```

## Development

```bash
bun install
bun run dev                 # TanStack React site
bun run --filter @mynameistito/hcc-bin-day-docs dev # Blume docs
bun run check
bun run typecheck
bun run test
bun run build
```

The repository is a Bun workspace. The CLI package remains `@mynameistito/hcc-bin-day` in `packages/cli`; the web app and Blume documentation have their own package scripts. The docs are built into the website's `/docs` path and deployed together as one Cloudflare Worker.

## Deployment

Deploy and destroy Cloudflare resources with Alchemy:

```bash
STAGE=prod bun run deploy
STAGE=prod bun run destroy
```

Production deploys to `https://bin-day.mynameistito.com`; preview stages use their stage-specific `workers.dev` URLs. Alchemy also keeps the production Worker available on `workers.dev`. Before deploying, the `mynameistito.com` zone must exist in the target Cloudflare account so Alchemy can attach the custom domain and manage its DNS/certificate. Configure repository secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`. The token should be scoped to the target account with **Workers Scripts: Edit** and **Secrets Store: Edit** permissions. GitHub Actions uses [`mynameistito/alchemy-deploy`](https://github.com/mynameistito/alchemy-deploy), pinned immutably to v3.1.3. Credential-free CI uploads the built Worker and site assets; PR previews deploy only that exact-run artifact. No non-Cloudflare hosting is used.

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
