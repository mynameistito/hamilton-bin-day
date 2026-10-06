# Web domain libraries

## OVERVIEW
Pure schedule/catalogue helpers plus notification and Web Push lifecycle logic shared by the browser app and Cloudflare Worker.

## WHERE TO LOOK
| Concern | Files | Notes |
|---|---|---|
| Address parsing and schedule data | `address.ts`, `schedule.ts` | Client-side address/schedule helpers |
| Catalogue model and snapshot | `bin-items.ts`, `bin-items-data.json` | Council sorter entries; snapshot is refreshed by the parent app script |
| Reminder date/time calculation | `notifications.ts` | Local-time preferences and DST-aware scheduling |
| Server persistence/delivery | `reminder-server.ts` | D1 subscription routes and scheduled sender |
| Push cryptography/config | `web-push.ts`, `web-push-subscription.ts`, `vapid-keypair.ts` | Validate subscriptions and send encrypted push |
| Browser delivery | `push-reminders.ts`, `notifications.ts` | Registration, permissions, and local state |
| Tests | `__tests__/` | Library behavior and request/crypto edge cases |

## CONVENTIONS
- Inject `now` and push transport where useful to keep date-dependent sender logic deterministic in tests.
- Validate external data at boundaries (Council payloads, request JSON, stored subscription JSON) before using it.
- Keep schedule dates as calendar-date strings and explicitly resolve instants with an IANA timezone; do not rely on the machine's local timezone.

## ANTI-PATTERNS
- Do not broaden reminder storage to include an address, account, or address-derived identifier.
- Do not make missing VAPID/D1 configuration look like a successful subscription; APIs return a safe unavailable response.
- Do not generate new VAPID keys per run or expose private key values to browser code.
