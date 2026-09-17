# Build program — living to-do list

Single source of truth for what is open. Updated by the PM session every time something lands or
is added. Plan of record: `BUILD-PROGRAM-MASTER-PLAN-2026-09-16.md` (§9 is the history log).
Last updated: 2026-09-17 afternoon.

## A. Waiting on JT (owner)

| # | Item | Notes |
|---|---|---|
| A1 | **HyperDrive iOS app locked out (URGENT)** — all TestFlight builds expired 2026-09-17, ~39 drivers | Devs upload 1.0.6 build 3 (same version = fast beta review); check the Xcode Cloud tab for a Start Build button; then assign to both tester groups. Permanent fix = unlisted App Store release (B9). |
| A2 | 14 owner questions, one at a time, four options | 8 routing (`ROUTING-ENGINE-PLAN` §7) + 6 Metrc (`METRC-PROGRAM-PLAN` §6) |
| A3 | Concept picks — eight review rounds live at `/explorations/review/` | rule builder, HR Overview, LP Triage, Nav Rail, Reports, Tax Rates, Regions, Cash Drawer. Unblocks every Phase-1 screen build. |
| A4 | Tap-target size floor: apply everywhere except Register, or Register too? | Shared tokens are used by the locked Register screen. |
| A5 | Customer Account: pick variant A/B/C; remove the design-review switcher from the live page | Switcher already hidden on phones. |
| A6 | Real tax rates per store (five numbers); medical exemption; where rates live today | `wm-demo/docs/TAX.md` |
| A7 | AWS: confirm `hw-assistant-deploy-dev` has the permissions boundary (IAM → Roles → it → "Permissions boundary"); later sign the connector in as that role when the dev change set is ready | View-only role cannot read role details. |
| A8 | AWS hygiene: MFA for 5 of 10 users; confirm contractor login `techindustan-hw`; `Customer.Support` unused since 2024; inventory long-lived keys | `wm-demo/docs/AWS-INVENTORY-2026-09-17.md` |
| A9 | From whoever hosts production: read-only MongoDB user for `hw-sync`; who controls `hyperwolf.com` DNS | Production servers are NOT in the company AWS account. |
| A10 | Mobile apps: driver-app source repo, TestFlight/Play internal access, test accounts, push console | `MOBILE-APP-AUDIT-GROUNDWORK` |
| A11 | Render env still optional: `HW_BACKUP_S3_*`, `HW_AIRTABLE_KEY`, `HW_CONNECTEAM_API_KEY_*`, `HW_DISCORD_WEBHOOK_*`, `HW_LINK_SIGNING_KEY`, `HW_PII_KEY` | `WM_DEMO_ADMIN_TOKEN` set 2026-09-17. |
| A12 | Codex queue: six briefs ready — `tools/offload/run_queue.sh` | PM reviews and commits the output. |
| A13 | Storefront redesign files: where are they? Weedmaps client id rotation call; relaunch the other session's dev server on 8787; GraphHopper plan/credits check | carried from the morning packet |
| A14 | Counsel to confirm the 24-hour Metrc window for in-store sales | Delivery manifests must be in Metrc before departure (4 CCR §15049.3/§15418). |

## B. Running or next (no decision needed)

| # | Item | State |
|---|---|---|
| B1 | Live update stream for the Render demo — fix 401 handling + per-family channel scopes, then commit, push, deploy | fix agent running |
| B2 | AWS dev environment: phase-1 templates (network, data, realtime) deployable through the connector, runbook, cost, role permission pre-flight | agent running |
| B3 | Transient 500 on the first signed-link request after a restart | dispatching |
| B4 | TypeScript port #4: restock, with Python goldens | dispatching |
| B5 | Metrc phase 1 (read-only): day-ledger, unit→batch→package resolution, Metrc stub server, reconciliation read | dispatching |
| B6 | Dispatch core phase 1: `RouteSolver` interface, hard-constraint checker, kit stock ledger, insertion quote (< 200 ms), GraphHopper + VROOM adapters behind stubs | dispatching |
| B7 | Loyalty interop plan: Engage as the engine, ladder matched to today's, balances 1:1, adapters for Alpine and Blaze | dispatching |
| B8 | Dev-team change list: add today's findings (driver password storage, public ID/selfie folder, unauthenticated order routes, Firebase keys in repos, Metrc integration state, dangling refs, tax-rate scale question) | dispatching |
| B9 | HyperDrive: unlisted App Store distribution plan so builds stop expiring every 90 days | with B8 |
| B10 | Valkey adapter for the realtime kit; WebSocket consumers (dispatcher map, driver task push) on AWS dev | after B2 |
| B11 | Nav rail + top bar build, Reports/Tax/Regions/Drawer/HR/LP screens (desktop + phone) | blocked on A3 |
| B12 | Mobile readiness phase 2: remaining "minor" screens in batches; drag-and-drop touch fallbacks | queue |
| B13 | `GET /api/tax/audit/sale` port to TS; TS realtime parity with Python channel names | queue |
| B14 | Forms: port employee-edit and upload-doc (Codex brief 04) | in Codex queue |

## C. Landed today (2026-09-17) — detail in the master plan §9

Wave 3 on wm-demo (`1112a3f`, pushed and deployed, live-verified): strict route policy default,
close-out routes, write-up signing, per-register cash + persisted tax, timesheet Tier-2, Airtable
write-backs (async, fail-closed), over-posting allowlists, link-race fix; TS ports (register, tax),
realtime kit, `hw-sync`; AWS options (Aurora + proxy + Valkey), access roles, account inventory.
POS-Admin: signing page, phone fixes (Driver App, Customer Account, scan, notes, tables, forms),
eight concept rounds, plans (gap closure, DB provider, realtime, routing, Metrc, legacy data model,
mobile readiness, mobile app groundwork). Owner decisions D10–D15 recorded in memory.
