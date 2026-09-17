# Handoff brief — Hyperwolf build program (for ChatGPT / Codex)

You are taking over engineering work on the Hyperwolf platform while the lead session (Claude) is
rate-limited. The owner is JT (admin@hyperwolf.com). He is not a developer; he reads results, presses
Run buttons, and makes product decisions. Read this whole brief before touching anything.

---

## 1. What this program is

Hyperwolf is a multi-store licensed cannabis retailer and delivery operator in Southern
California. We are building a new platform to replace the production stack written by an outside
dev team, and to retire a large Google Apps Script estate.

Two repositories are OURS and are the only places you work:

| Repo | What | Language |
|---|---|---|
| `/Users/jt/wm-demo` | The backend demo/stage server deployed on Render (`wmdemo/`, Python 3.9 **standard library only**), its probe suites (`qa/`), the new TypeScript runtime kit (`platform/`, Fastify + Drizzle + pglite tests), AWS CDK (`infra/`) | Python, TypeScript |
| `/Users/jt/POS-Admin` | The front end (browser JS/JSX, **no build step**, every file an IIFE that leaks only its declared globals), contracts package (`contracts/index.js`), design explorations, all plans and docs | JavaScript |

**You do not work in the main checkouts.** Other sessions share them and Render deploys from
`main`. JT will run `tools/offload/setup_codex_worktrees.sh`, which creates:

- `/Users/jt/codex-work/wm-demo` (branch `codex/handoff`)
- `/Users/jt/codex-work/POS-Admin` (branch `codex/handoff`)

Work only there. Commit to `codex/handoff` only. Never push. Never merge. The lead session reviews
`main..codex/handoff` when it returns.

Start by reading, in this order:
1. `POS-Admin/docs/BUILD-PROGRAM-TODO.md` — the living to-do list (sections A owner, B work, C landed).
2. `POS-Admin/docs/BUILD-PROGRAM-MASTER-PLAN-2026-09-16.md` §9 — history of what landed and what each adversarial review broke.
3. `wm-demo/docs/SECURITY-GATE.md` and `wm-demo/docs/ROUTE-POLICY-COVERAGE.md` — the security model you must not weaken.
4. The plan for whichever task you pick (paths in §4).

---

## 2. Absolute rules (violating any of these is worse than doing nothing)

1. **Never read, write, copy, move, print or delete any `.env` file or any credential file**
   (`~/.aws/*`, service-account JSON, `*.pem`). When a test needs env values, set dummies inline:
   `WM_CLIENT_ID=dummy WM_CLIENT_SECRET=dummy HW_PII_KEY=dummy HW_LINK_SIGNING_KEY=dummy HW_AIRTABLE_KEY=dummy`.
2. **Never touch `/Users/jt/hyper-tech/*`** (twelve production repos from the dev team). Read-only
   reference. Fixes for their code are written as requests in
   `POS-Admin/docs/codebase-audit/distribution/DEV-TEAM-CHANGE-LIST.md`, never as edits.
3. **Never touch the Apps Script repo** at `~/Library/Mobile Documents/com~apple~CloudDocs/Claude Co-work files/gas-projects` except to read it (always `grep -a`; files there are live in Google and not all in git).
4. **Never modify** `POS-Admin/pos/screen-register.jsx` (owner-locked), `POS-Admin/pos/screen-catalog.jsx`
   (another session's in-progress work), `POS-Admin/pos/tokens.jsx` or `pos/atoms.jsx` (a tap-target
   change is awaiting the owner's design approval), anything under `wm-demo/idv-engine/`,
   `wmdemo/idv_*.py` or `POS-Admin/idv/` (the Verify module belongs to another session), or
   `wm-demo/qa/fixtures/incentives/synthetic/synthetic-meadow-orders.xlsm`.
5. **Never contact a real external system**: no AWS calls (`aws`, `cdk deploy`, `cdk bootstrap`), no
   Metrc, Airtable, Connecteam, Discord, Blaze, Weedmaps, GraphHopper, Twilio, S3, no LLM APIs, no
   production URLs except reading `https://hyperwolf-wm-demo.onrender.com` with GET. Every adapter has
   a loopback stub under `wm-demo/qa/` — use it. Live flags (`HW_*_LIVE`) stay unset.
6. **Never push, deploy, merge to `main`, force anything, or run** `git checkout`, `git stash`,
   `git reset`, `git restore`, `git clean`, `git rebase`, `git commit --amend` on shared history,
   or `git add -A` / `git add .`. Stage **explicit paths only**. If you think you need one of these,
   stop and write the reason in your report instead.
7. **Never run a broad process kill** (`pkill`, `killall`). Kill only PIDs you started. Never boot a
   server against `wm-demo/wmdemo.sqlite3`; always a scratch file:
   `WM_DEMO_DB=/tmp/codex-<task>.sqlite3` for BOTH the server and the battery/probe/recorder.
   Use ports 9200–9299 only.
8. **Do not send anything to any person or vendor.** No emails, messages, issues, PRs.
9. **Do not change AWS/IAM files**: `wm-demo/infra/access/*`, `wm-demo/infra/deploy/*`, and the CDK
   stacks under `wm-demo/infra/lib/` are under security review and will be applied to a real
   account by the owner. Leave them exactly as they are.
10. **Do not change the security core** without an explicit task below saying so:
    `wmdemo/authz.py`, `route_policy.py`, `policy_batch*.py`, `sessions.py`, `reqcheck.py`,
    `signed_links.py`, `platform/src/authz.ts`, `policy.ts`, `sessions.ts`, `src/realtime/*`.
    You may ADD a route registration for a new route you build (pattern in any `*_api.py`
    `register_all()`), nothing else.
11. **Do not change money semantics**: promotions evaluation and rounding
    (`wmdemo/engage/promotions.py`, `batch_rules.py`), tax computation (`wmdemo/tax.py`), register
    expected-cash/variance (`wmdemo/register.py`). Integer cents everywhere; half-away-from-zero
    rounding where rounding exists; the server computes money, never the client.
12. **Never weaken a test to make it pass.** No loosening assertions, no deleting checks, no adding to
    `ALLOWED_SKIPS` in `qa/battery.py` without a written reason why the precondition is unobtainable.
    If a pinned status legitimately changed, rewrite that ONE check with the SAME id and a one-line
    citation. Every new wm-demo probe must be registered in `qa/battery.py`: `SUITES`,
    `EXPECTED_CHECKS[name]`, and `TOTAL_CHECK_FLOOR` raised by the same number. Helper/stub/recorder
    files go in `NOT_A_SUITE` with a comment.
13. **Design rule**: any NEW screen is delivered first as FOUR genuinely distinct concept mockups
    (`POS-Admin/explorations/<Name> - Concept A..D.html`, self-contained, no external requests except
    the Google Fonts link the existing concepts use), each showing BOTH desktop and phone (≤ 430 px),
    plus a review page under `explorations/review/` copied from an existing one (notes feature). You do
    not build the real screen until the owner picks. Existing screens get fixes, not redesigns.
14. **Decisions about people stay human.** Anything that disciplines, scores or messages an employee
    may be measured, drafted and proposed by code, never executed automatically. The write-up AI draft
    is capped at Second Warning; step-ups happen only through a manager's Approve & send.
15. **Owner decisions already made are not reopened** (see §6). If a task seems to need a product
    decision that is not listed, do the parts that do not depend on it and write the question in your
    report as a multiple-choice with up to four options, recommended first.

---

## 3. How work is done here (the quality bar)

- **Security gate for every deliverable**: per-user/token auth on every write; contracts validation
  + `reqcheck.reject_unknown_keys` allowlist on every request body (unknown key → 400 BEFORE any
  other validation); store/entity scoping derived from the credential, never from the body
  (`authz.require_store` → 404 identical to "not found", never 403, no existence oracle); no secrets
  or PII in logs, errors, events or responses; no SQL/identifier injection (parameterised only); no
  wildcard CORS; idempotency keys on anything a client may retry; single-use links are CLAIMED
  atomically before the write and released on failure; async jobs for anything that calls out
  (never inside the request thread); 503 (never 500) when configuration is missing; append-only
  audit for money, inventory and people records.
- **Python side**: stdlib only, Python 3.9 syntax. Follow an existing module end to end as the
  pattern (`wmdemo/register.py` + `register_api.py` + `qa/register_probe.py` + `docs/REGISTER.md`).
  Probes are plain scripts printing `PASS <id> ...` / `FAIL <id> ...`, self-booting their own server
  on a scratch DB like `qa/lp_probe.py`.
- **TypeScript side**: `cd platform && npm test && npx tsc --noEmit && node bin/hw.js check` must be
  green. Ports of Python modules are proven by RECORDED GOLDENS: a recorder under `qa/`
  (`record_differential_*.py`, which refuses to run without `WM_DEMO_DB`) replays real requests
  against the Python server and a `test/differential-*.test.ts` replays them against the TS module.
  Masks may hide timestamps and generated ids only — never a quantity, a cent or a status. Unique
  constraints live in the database; `isUniqueViolation` walks the error `cause` chain.
- **Front end**: no build step; IIFE per file; globals declared at the top comment; tests with
  `node --test test/<file>.test.mjs`. Every new or touched screen must meet
  `docs/MOBILE-READINESS-AUDIT-2026-09-17.md` → "Hyperwolf responsive standard".
- **Adversarial pass**: after you build something, attack it yourself as a second pass with a
  different mindset (authz bypass, IDOR across stores, over-posting, replay/double-submit races with
  8 threads, injection, leak of fields through a new path, cold start with no env, resource
  exhaustion). Write the attacks as probe checks. The lead session found a real defect in almost
  every first-pass build this week — assume yours has one.
- **Verification before you call anything done**: run the module's probe, then
  `python3 qa/battery.py --only=<your suites + every suite whose files you touched>` against a
  scratch server (`WM_DEMO_DB` set for both; the battery reads `WMDEMO_BASE`), and report the exact
  lines. No count may fall.
- **Commits**: small, one topic each, explicit paths, message states what and why, ending with the
  line `Co-Authored-By: Codex <noreply@openai.com>`. Branch `codex/handoff` only.

---

## 4. What to work on (in this order; stop after each and write the report in §7)

Pick from the top. Each item names its plan, the files you may touch, and how it is verified. Do NOT
start an item marked "lead session only".

**Tier 1 — mechanical, fully specified, low risk**

1. **Codex queue briefs** — `POS-Admin/tools/offload/queue/*.md` (six briefs: codebase status
   refresh, contracts `types.d.ts` sync to 0.5.2, concept-page accessibility audit, GAS port list CSV,
   wm-demo docs index, port of the employee-edit and upload-doc forms). Each brief lists its allowed
   files and verify command. Do them as written, inside the worktrees.
2. **Metrc recon idempotency** (`wmdemo/metrc/recon.py`, `qa/metrc_probe.py`): re-running
   `run_recon_for_day` for the same licence/day currently creates duplicate exception rows. Make it
   idempotent (natural key: licence, business day, package tag, kind) and add a per-store wall-clock
   cap to `pull_packages`. Add ≥ 6 probe checks. Read-only module: no HTTP verb other than GET may
   ever exist in `wmdemo/metrc/`.
3. *(withdrawn — the lead session is fixing the dispatch core and restock modules on `main` right now; do NOT touch `platform/modules/dispatch/**`, `platform/modules/restock/**`, `wmdemo/inventory_api.py` restock functions or `qa/pick_slip_probe.py` / `qa/restock_api_probe.py`.)*
4. **TS port of the tax audit-by-sale read** (`GET /api/tax/audit/sale/{order_id}`, store-scoped,
   same 404 body for foreign and missing) into `platform/modules/tax/` with goldens
   (extend `qa/record_differential_tax.py`; three identical recordings; replay green).
5. **Mobile "minor" fixes, batch 1** — from `docs/MOBILE-READINESS-AUDIT-2026-09-17.md`: screens
   classed *minor* in the apps Engage, Bounty (console side), Pipeline, Logistics, Terminals. Only
   wrap/overflow/flexWrap/inputMode/safe-area fixes using `shared/hw-safe-area.js`, `shared/hw-phone.js`
   and the `HDTable` wrapper. No token changes, no redesigns, nothing under `pos/`, `idv/`, `mobile/`.
   One commit per app, tests green.

**Tier 2 — builds with a written plan (read the plan fully first)**

6. **Valkey adapter for the realtime kit** — plan `docs/REALTIME-ARCHITECTURE-2026-09-17.md` Part 6 +
   `wm-demo/platform/docs/REALTIME.md`. Implement `ValkeyBus` behind the existing `RealtimeBus`
   interface with an INJECTED client interface and an in-memory fake for tests (do not add a Redis
   dependency, do not open sockets). This is the one allowed edit under `platform/src/realtime/`:
   new file `valkey-bus.ts` + tests only.
7. **Four-concept design rounds (design only)** for the screens these plans call for, each with
   desktop + phone, review page with notes: (a) Metrc exception queue / close-of-day pre-flight /
   reconciliation board (`METRC-PROGRAM-PLAN` §5); (b) dispatcher routing settings with presets
   (`DRIVER-ASSIGNMENT-MODEL` §5); (c) support swap-recovery surface (`SWAP-RECOVERY-FLOW-PLAN` §5);
   (d) employee scoreboard, incident review, coaching queue, my-record
   (`DISCREPANCY-ATTRIBUTION-AND-SCOREBOARD-PLAN` §7). Sample data only, marked SAMPLE.
8. **Loyalty adapters, stub phase** — plan `docs/LOYALTY-INTEROP-PLAN-2026-09-17.md`: build the Alpine
   IQ and Blaze loyalty adapter INTERFACES with loopback stubs and probes (`wmdemo/engage/` new files
   only; outbound via the existing jobs/outbound pattern; signed webhooks with replay window;
   idempotency keys). No live calls. Do not change existing Engage points math.

**Lead session only (do not start)**: the dispatch core and restock modules (being fixed after an adversarial review); anything in AWS or IAM (the access template FAILED its security review and is being rewritten); pushing/deploying; sale-lines and any
change to the sale/promotions/tax/register money paths; swap-recovery backend; discrepancy/scoreboard
backend; changes to auth/route-policy/sessions/reqcheck/signed-links; the nav rail or any real screen
build that depends on a concept the owner has not picked; anything the owner's open questions decide.

---

## 5. How to run things

```bash
# Python server on a scratch DB (never the repo DB), then a probe or the battery
cd /Users/jt/codex-work/wm-demo
WM_CLIENT_ID=dummy WM_CLIENT_SECRET=dummy HW_PII_KEY=dummy HW_LINK_SIGNING_KEY=dummy \
WM_DEMO_DB=/tmp/codex-t1.sqlite3 WM_DEMO_PORT=9201 WM_DEMO_HOST=127.0.0.1 \
WM_DEMO_WRITE_TOKEN=optok WM_DEMO_ADMIN_TOKEN=admtok HW_TRUSTED_PROXY_HOPS=1 \
WM_DISABLE_BACKGROUND=1 WM_API_READONLY=1 \
HW_CONTRACTS_DIR=/Users/jt/codex-work/POS-Admin/contracts \
python3 -m wmdemo.server &   # note the PID; kill only that PID

WM_DEMO_DB=/tmp/codex-t1.sqlite3 WMDEMO_BASE=http://127.0.0.1:9201 WM_DEMO_BASE=http://127.0.0.1:9201 \
WM_CLIENT_ID=dummy WM_CLIENT_SECRET=dummy HW_PII_KEY=dummy HW_LINK_SIGNING_KEY=dummy \
WM_DEMO_WRITE_TOKEN=optok WM_DEMO_ADMIN_TOKEN=admtok \
HW_CONTRACTS_DIR=/Users/jt/codex-work/POS-Admin/contracts \
python3 qa/battery.py --only=metrc_probe,register_probe      # the battery refuses without WM_DEMO_DB

# Most newer probes are self-booting:  python3 qa/metrc_probe.py
# TypeScript kit:   cd platform && npm test && npx tsc --noEmit && node bin/hw.js check
# Infra (offline):  cd infra && npm test            # never cdk deploy / bootstrap
# Front end:        cd /Users/jt/codex-work/POS-Admin && node --test test/<file>.test.mjs
```

Facts that will save you time: strict route policy is the DEFAULT (an unregistered `/api/` route
answers 404; `WM_ROUTE_POLICY_STRICT=0` relaxes). Console sessions come from
`POST /api/session/login` with the operator or admin token; operator and admin scope sets are
separate (`OPERATOR_SCOPES`, `_ADMIN_ONLY_SCOPES`) and mirrored in `platform/src/authz.ts` — a parity
test fails if they drift. `qa/_probe_auth.py` mints sessions/keys for probes. The full battery has
~30 permanently red suites that belong to other teams (Weedmaps/brand/menu/cycle3 need live
credentials): judge only suites you touched. A macOS "Python quit unexpectedly" dialog from a probe
harness is a known fork quirk — ignore it.

---

## 6. Owner decisions already made (do not reopen)

Batch-first promotions with one JSON rule shape (`hw.rule.v1`), rules target batches never Metrc
tags, agent-written rules land as drafts. Production on AWS; **Aurora PostgreSQL behind RDS Proxy +
ElastiCache Serverless Valkey**; TypeScript (Fastify + Drizzle) strangler with recorded goldens; Vite
later; Render stays demo/stage. **One AWS account**, dev/stage/prod insulated by tags, prefixes and a
permissions boundary; nothing that exists today may be touched; the assistant never creates IAM.
Driver location: raw trails 90 days then summaries; off-duty pings refused server-side. Routing:
GraphHopper kept behind one `RouteSolver` interface, self-hosted solver shadow-tested, dispatcher pins
always win, best driver fetched at address selection, order staged and sequenced jointly before
release, low vendor usage with a credit cap, live quoted window with a per-zone ceiling, Scheduled =
1-hour windows (day-ahead booking, 15:00 same-day cutoff), Express = 90 minutes, home zones with
spillover + floaters, re-sequence only inside the promised window, only the current stop locked,
restock is overnight (new kit build Sunday morning, breakdown Sunday night), Express menu = live kit
contents and the recovery for a mis-stock is the support Swap flow. Metrc: its own program,
END-OF-DAY batch sync for sales detail (delivery manifests must be in Metrc before departure — a later
phase), partner API, read-only first. Loyalty: Engage is the engine, ladder matches today's, balances
carry 1:1, must interoperate with Alpine IQ and Blaze. Inventory discrepancies are flagged, measured
and attributed with evidence and feed an employee scoreboard; people decisions stay human. Write-up
ladders: attendance and accuracy separate, 90-day window, dismissed never count. Leads may verify
their own close-outs (2026-09-07). Every new page is designed for desktop AND phone, four concepts
first. Tap-target sizes: no change until the owner approves the before/after designs.

---

## 7. What to hand back

After each item append to `POS-Admin/docs/CODEX-HANDOFF-LOG.md` (create it; commit it on
`codex/handoff`): item number; files changed (paths); commands run with their exact result lines;
commit hashes; anything you could not verify; anything that looked wrong in code you did not own
(describe, do not fix); questions for the owner as multiple choice. If you break a rule in §2 by
accident, say so at the top of the log in plain words — it will be fixed faster than it will be found.

If at any point you are unsure whether something is allowed: it is not. Write it down and move to the
next item.
