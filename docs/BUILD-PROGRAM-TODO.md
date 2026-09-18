# Build program — living to-do list

Single source of truth for what is open. Updated by the PM session every time something lands or
is added. Plan of record: `BUILD-PROGRAM-MASTER-PLAN-2026-09-16.md` (§9 is the history log).
Last updated: 2026-09-17 evening.

## 0. If the lead session is rate-limited

ChatGPT/Codex takes over under `docs/HANDOFF-TO-CODEX-2026-09-17.md`. JT runs
`tools/offload/setup_codex_worktrees.sh`, starts `codex` in `/Users/jt/codex-work`, pastes that brief.
Codex works ONLY in the worktrees on branch `codex/handoff`, never pushes; its log is
`docs/CODEX-HANDOFF-LOG.md` on that branch. On return the lead session reviews
`git log main..codex/handoff` in both repos, refutes, then merges what passes.
Agents in flight when this was written (results may be lost if the limit hits): B15 sale lines,
B20 AWS access/dev-template security review, B21 dispatch + restock review.

## A. Waiting on JT (owner)

| # | Item | Notes |
|---|---|---|
| A1 | **HyperDrive iOS app locked out (URGENT)** — all TestFlight builds expired 2026-09-17, ~39 drivers | Devs upload 1.0.6 build 3 (same version = fast beta review); check the Xcode Cloud tab for a Start Build button; then assign to both tester groups. Permanent fix = unlisted App Store release (B9). |
| A2 | Owner questions: **ALL POLICY QUESTIONS ANSWERED 2026-09-17** (routing 8, driver assignment 6, Metrc 6, loyalty 5, swap 3, scoreboard 4, logistics wiring 3, cart 8, purchase limits 6 incl. medical, pickup 5, Shop at Home 5, SMS 2, Alpine route 1) — D17–D56 in memory. Open: NONE except design picks (A3/A4) | done |
| A3 | Concept picks — nine review rounds (rule builder, HR Overview, LP Triage, Nav Rail, Reports, Tax Rates, Regions, Cash Drawer, + tap targets). **DEFERRED by JT 2026-09-17: he will review on his computer (wants the mobile frames); re-ask when he is at his desk.** Live at `/explorations/review/`; local concept files under `explorations/` | waiting on JT |
| A4 | Tap-target sizes — **DECIDED 2026-09-17: include Register, but NO change until JT approves before/after designs.** PM owes before/after mockups (POS incl. Register, Driver, back-office; desktop + phone). | Design only until approved. |
| A5 | Customer Account: pick variant A/B/C; remove the design-review switcher from the live page | Switcher already hidden on phones. |
| A6 | Real tax rates per store (five numbers); medical exemption; where rates live today | `wm-demo/docs/TAX.md` |
| A7 | AWS: **re-apply the access template** (Update stack → change set → Replace template → `infra/access/hw-assistant-access.yaml`) AFTER its security review passes (B20); then switch the connector to `hw-assistant-deploy-dev` when the dev change set is ready. Also confirm `hw-assistant-deploy-dev` has the permissions boundary (IAM → Roles → it → "Permissions boundary"); later sign the connector in as that role when the dev change set is ready | View-only role cannot read role details. |
| A8 | AWS hygiene: MFA for 5 of 10 users; confirm contractor login `techindustan-hw`; `Customer.Support` unused since 2024; inventory long-lived keys | `wm-demo/docs/AWS-INVENTORY-2026-09-17.md` |
| A9 | From whoever hosts production: read-only MongoDB user for `hw-sync`; who controls `hyperwolf.com` DNS | Production servers are NOT in the company AWS account. |
| A10 | Mobile apps: driver-app source repo, TestFlight/Play internal access, test accounts, push console | `MOBILE-APP-AUDIT-GROUNDWORK` |
| A11 | Render env still optional: `HW_BACKUP_S3_*`, `HW_AIRTABLE_KEY`, `HW_CONNECTEAM_API_KEY_*`, `HW_DISCORD_WEBHOOK_*`, `HW_LINK_SIGNING_KEY`, `HW_PII_KEY` | `WM_DEMO_ADMIN_TOKEN` set 2026-09-17. |
| A12 | Codex: queue 04–09 DONE and MERGED to main 2026-09-17 (04 blocked legitimately: forms generator lacks HEIC + empty-files checks → lead follow-up). Queue 10–14 being written; JT re-prompts Codex when ready | next prompt to JT |
| A13 | Storefront redesign files: where are they? Weedmaps client id rotation call; relaunch the other session's dev server on 8787; GraphHopper plan/credits check | carried from the morning packet |
| A14 | Counsel to confirm the 24-hour Metrc window for in-store sales | Delivery manifests must be in Metrc before departure (4 CCR §15049.3/§15418). |

## B. Running or next (no decision needed)

| # | Item | State |
|---|---|---|
| B1 | DONE (committed) — live update stream, refuted twice | push with B24 |
| B2 | AWS dev environment plan DONE (uncommitted): three phase-1 templates under the inline size limit, ~$110/mo, no NAT; BLOCKED on B17 (deploy role lacked CloudFormation actions) | waiting on B17 + A7 |
| B3 | DONE (uncommitted) — cold-start probe (21 checks); real cause found: timesheet routes answered 500 instead of 503 when HR env is unset | refute + commit |
| B4 | TypeScript port #4: restock, with Python goldens | dispatching |
| B5 | DONE (uncommitted) — Metrc phase 1 read-only (88 checks, contracts 0.5.2) | refute + commit |
| B6 | DONE (uncommitted, 204 tests) — Dispatch core phase 1: `RouteSolver` interface, hard-constraint checker, kit stock ledger, insertion quote (< 200 ms), GraphHopper + VROOM adapters behind stubs | dispatching |
| B7 | Loyalty interop plan — DONE (`LOYALTY-INTEROP-PLAN-2026-09-17.md`); 5 owner questions added to A2 | done |
| B8 | DONE — dev-team change list items 26–35 added. Was: add today's findings (driver password storage, public ID/selfie folder, unauthenticated order routes, Firebase keys in repos, Metrc integration state, dangling refs, tax-rate scale question) | dispatching |
| B9 | HyperDrive: unlisted App Store distribution plan so builds stop expiring every 90 days | with B8 |
| B10 | Valkey adapter for the realtime kit; WebSocket consumers (dispatcher map, driver task push) on AWS dev | after B2 |
| B11 | Nav rail + top bar build, Reports/Tax/Regions/Drawer/HR/LP screens (desktop + phone) | blocked on A3 |
| B12 | Mobile readiness phase 2: remaining "minor" screens in batches; drag-and-drop touch fallbacks | queue |
| B13 | `GET /api/tax/audit/sale` port to TS; TS realtime parity with Python channel names | queue |
| B14 | Forms: port employee-edit and upload-doc (Codex brief 04) | in Codex queue |

| B15 | BUILT (uncommitted, 49 checks) — REVIEW FAILED 2026-09-17 (replay double-consumes stock, total never cross-checked, discount client-trusted, refund ref unverified, no single transaction); fix agent running → re-refute → commit; KNOWN GAP to close before commit: line discounts are still client-trusted (must come from the promotions engine or an audited manager-override scope). **Sale lines**: `pos_sales` stores no per-line sku/batch/quantity and nothing writes a sale inventory movement, so the Metrc day-ledger resolves zero real lines today. Record sale lines + unit→batch movement at sale time (needed for Metrc, batch promotions reporting, COGS) | next, after the wm-demo commit |
| B16 | DONE (committed 3a707e2, 317 tests) — Dispatch core 1b. NOTE: owner chose ONLY the current stop locked → change `frozenStopCount` default 2 → 1 | follow-up with B21 |
| B17 | DONE (committed) — Access template update: CloudFormation actions for deploy roles (scoped to `hyperwolf-<env>-*`, deny on `shorturl-service-prod` and on its own stack), missing RDS/KMS teardown actions, view-only self-inspection | agent running → then A7 re-apply |
| B18 | DONE — driver assignment model; finding: the live `swiftAssign` ranking engine is NOT in the repos we hold (ask devs; eight admin screens to screenshot) | done |
| B19 | DONE — tap-target mockups + review round; waiting on JT's approval (A4) | done |

| B20 | **SECOND review also FAILED 2026-09-17** (boundary escape through any role a deploy role creates; `ec2:CreateTags` forging; glue bucket missing) — third fix agent running, Denies move INSIDE the boundary → third independent review. **AWS access template FAILED security review** (CloudFront mutate on `*`, role-attachment escalation to the boundary ceiling, boundary too wide for S3 objects/secrets, tag forging). Fix agent running → independent re-review → only then A7. **JT asked to set `EnableDeployRoleDev=false` until then.** | fixing |
| B21 | **RE-REVIEW PASSED 2026-09-17** (restock 57/57 + 39 goldens; dispatch 342 tests, 50-way budget race holds) — commit with B15. Note for later: vendor solver output must re-validate through `checkPromiseWindow` before it may ever publish a plan; restock 409 should tell a retrying client its own request succeeded. Was: Dispatch core FAILED review (promised-window rule unenforced, frozen default 2→1, budget race, time-box misses construction: 900 ms vs 150 ms target, hold hijack) and restock had a cross-store slip leak + overlapping-window double give (Python AND TS). Two fix agents running → re-refute | fixing |
| B22 | Swap recovery flow build (backend does not exist; POS support SwapPanel has 3 bugs; logistics swap picker is ungoverned) — plan `SWAP-RECOVERY-FLOW-PLAN-2026-09-17.md` | after owner questions |
| B23 | Discrepancy attribution + employee scoreboard — plan `DISCREPANCY-ATTRIBUTION-AND-SCOREBOARD-PLAN-2026-09-17.md`; handover-acceptance scan and box-placement check do not exist anywhere yet | after owner questions |
| B24 | Push + deploy wave 4 — BUTTONS HANDED (wm-demo 4 commits to 58ed35d, POS-Admin 25 commits to 0835bc8); live verify after deploy | waiting on JT |
| B25 | `GET /api/session/me` flagged by the gate probe as echoing the presented credential (pre-existing) — verify and fix | queue |
| B27 | DONE — `LOGISTICS-WIRING-PLAN-2026-09-17.md`: dispatch signals mapped onto the EXISTING Hyperdrive Logistics designs; call-the-customer loop; customer phone must be masked (mock shows it unmasked in `lorder.jsx`); six design gaps need four concepts; 5 owner questions | questions to A2 |
| B28 | Elite cart + checkout specialist (cart holds, stale-cart release settings, swap design verdict) → `CART-AND-CHECKOUT-PLAN-2026-09-17.md` | agent running |
| B29 | Elite purchase-limits researcher (CA adult-use + medical law, how products count, existing code search across hyper-tech, engine design for cart/checkout/admin/register/swap/transfer) → `PURCHASE-LIMITS-PLAN-2026-09-17.md` | agent running |
| B30 | Dispatch core follow-up from D24: transfer candidate check = receiving kit holds every line, else raise a swap-recovery case; auto-move for gains with once-per-order + cool-down | queue (lead-only module) |
| B31 | Plans landed 2026-09-17 evening (all committed): CART-AND-CHECKOUT (swap: approve with changes), PURCHASE-LIMITS (+ dev list 1.9), METRC-API-CONDUCT (wm-demo), ALPINE-CONFIG-READ-OPTIONS, REWARDS-REDEMPTION-UX-AUDIT (ledger built but unwired), SMS-PROVIDER, SHOP-AT-HOME | done |
| B32 | Sale lines RE-REVIEW PASSED → COMMITTED wm-demo 58ed35d + contracts 0.5.3 (POS-Admin 0835bc8); index boot-tested; buttons handed to JT 2026-09-17 evening; reports_probe fixture updated; RP-17/18/19/20/58 = UTC-midnight day-boundary flake in the fixture (fix: compute days in store-local tz) | refuting |
| B33 | IAM template THIRD review FAILED (rds/kms tag self-forging; SecretTargetAttachment blocker) → fourth fix running → fourth review. Earlier: third fix DONE (Denies inside the boundary, sts removed, ceiling trimmed to 8 services, 6,049/6,144 chars; template 178 KB → must be uploaded to S3, not inline) → third review running | reviewing |
| B34 | Plans landed (committed): PICKUP-FLOW-UX-REVIEW + PICKUP-FLOW-DEMO-AUDIT, PURCHASE-LIMITS-DAY-EDGE-CASES, MEDICAL-PURCHASE-LIMIT-RESEARCH, SMS-PROVIDER-SHORTLIST, ALPINE-CONFIG-READ-OPTIONS | done |
| B35 | Alpine read-only config probe job COMMITTED (fcf4598, 36 checks) → refuter running; JT triggers it after deploy via `docs/ALPINE-PROBE.md` | refuting |
| B38 | Design rounds 10 + 11 built and committed: Curbside Arrival (A–D) and Swap Recovery (A–D) under `explorations/review/` — JT picks with the other rounds | waiting on JT |
| B39 | Forms generator HEIC + min_files DONE (ddd6346, 158 checks); Codex briefs 10–14 committed; Codex worktrees merged with main; JT re-prompts Codex (prompt in chat) | done |
| B36 | Forms generator: add HEIC to `ATTACHMENT_CONTENT_TYPES` and a non-empty `files` check (from Codex 04 blocker), then re-queue brief 04 | queue |
| B37 | IAM template FIFTH fix (structural: conditioned Allows) running → fifth review; AWS MCP connector session INVALIDATED 2026-09-17 evening — JT must reconnect | fixing |
| B26 | Metrc recon: rerun creates duplicate exception rows; per-store wall-clock cap on package pulls | queue (with B15) |

## C. Landed today (2026-09-17) — detail in the master plan §9

Wave 3 on wm-demo (`1112a3f`, pushed and deployed, live-verified): strict route policy default,
close-out routes, write-up signing, per-register cash + persisted tax, timesheet Tier-2, Airtable
write-backs (async, fail-closed), over-posting allowlists, link-race fix; TS ports (register, tax),
realtime kit, `hw-sync`; AWS options (Aurora + proxy + Valkey), access roles, account inventory.
POS-Admin: signing page, phone fixes (Driver App, Customer Account, scan, notes, tables, forms),
eight concept rounds, plans (gap closure, DB provider, realtime, routing, Metrc, legacy data model,
mobile readiness, mobile app groundwork). Owner decisions D10–D15 recorded in memory.
