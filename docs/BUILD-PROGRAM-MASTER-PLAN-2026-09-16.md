# Build program master plan — 2026-09-16

Three tracks, one security gate, cheap swarms supervised from one Fable session. This document is
the plan of record; progress and verdicts are appended in §9 as they land. Nothing here has been
dispatched yet.

Written from four read-only recon passes over wm-demo, POS-Admin, the Hyper-Tech clones and the
migration inventories (scratch notes `recon-A..D` in the session scratchpad; every claim below
carries a `path:line` in those notes).

---

## 0. What the recon changed about the brief

| Brief said | Recon found | Effect on the plan |
|---|---|---|
| Vendor has **two** divergent promotion shapes | **Four** surfaces: `promotion-backend/models/Promotion.js:95-113` holds `rule` (legacy), `rules` (ifRules/thenRules tree), `ruleTree` (AND/OR/CONDITION engine); a fifth flat `models/Rule.js`; plus the standalone `promotion-engine` repo with its own `product_thc` / `product_package_date` vocabulary. Admin's own `backendRuleAttributes.js` cites files that do not exist. No `feat/admin_promo` branch in the pinned clones. | The proposal gets stronger: one shape replaces four. The vendor-facing doc must map each of the four to the new shape, not two. |
| "Wire the Floor Restock screen" | **No Floor Restock screen exists in the app.** It is Store Concept A (`explorations/Store - Concept A - Floor Restock.html`), one of four *different* store screens from design round 2. `docs/CODEBASE-STATUS.md:85` lists it as not done. | Track 2 builds the screen from Concept A on top of a new data layer. Decision D3 below. |
| Restock routes exist | They do (`inventory_api.py:401-536`), batch-keyed `(product_id, batch_id)`, RFID-first, and `/apply` already re-derives and caps `give` server-side. **They have no authentication** — only a non-empty self-reported `actor` string gates a stock-mutating write. | Security foundation (Team 0) is a prerequisite for exposing anything in Track 2. |
| Build on `engage/promotions.py` | It keys on sku/brand/category at cart-line level, never batch; never validates against `contracts/Promotion.json`; `/api/promos/*` has the same self-reported-actor non-auth; `pricing.quote_cart()` never reads the promotions table. wm-demo's real batch model lives in `inventory.py:184` `batch_meta` (thc_pct, batch_no, packaged_at, received_at, expires_at). | The engine is new code that bridges the two modules; the old rule/action shape keeps working behind a shape detector. |
| Per-user/token auth is a checklist item | wm-demo already solved it once: `idv_api.py:6006-6055 _api_key_gate` (API key + scopes, revoked-key exclusion, no trust in `X-HW-Actor`). Never ported anywhere else. | Team 0 lifts it into a shared `wmdemo/authz.py`; every new route uses it. |
| Security headers / CORS / CSV / rate limits | wm-demo has **zero** CORS or security headers anywhere; CSV formula guard exists (`forms.py:722`); rate limiters exist but are per-module. POS-Admin client keeps its write token in `localStorage` (`shared/hw-live.js:136-146`, key `hw-live-token`) — a named checklist failure. | Headers and same-origin CORS go into Team 0. Client token storage is decision D2. |
| "29/100" | `docs/codebase-audit/THE-GRADE.md` scores the **twelve vendor repos**, not our estate. Its §3 quick-fix table (20 items) and §4 biggest issues (7) are the gate checklist. Another session already live-verified finding C1 on staging (`STILO-STAGING-SECURITY-VERIFICATION-2026-09-16.md`); we do not touch that. | Gate = THE-GRADE §3/§4 + the brief's list, encoded as a probe (§3 below). |
| Probe suite registers in `qa/battery.py` | `qa/battery.py` carries **another session's uncommitted edits** that remove `idv_webhooks_probe` (the SSRF / DNS-rebinding guard) from `SUITES` and lower `TOTAL_CHECK_FLOOR` 3767 → 3692. | Not ours to revert. Our registrations are added as `-U3` filtered hunks and never touch those lines. Reported to JT in §8 as a coverage finding. |
| LP/HR inventories exist | They do (2026-09-10, cited). wm-demo has **zero** HR/LP tables. The form generator is already at phase 2. `shared/hd-form.jsx:26-33` documents that role conditions are **fail-open** in the client renderer. Each inventory leaves 8 owner questions open. | Track 3 is plan + contracts + read-only screens in this program; writes wait on decision D1 and the role gate. |

---

## 1. Program-wide security gate (applies to every team)

The gate is code, not a checklist agents tick. Team 0 delivers it; every later team registers its
routes into it, and the refuter swarm attacks it by hand.

**Server (wm-demo)**
- `wmdemo/authz.py` — one gate, lifted from `idv_api._api_key_gate`: API key + scopes (`promos:read`, `promos:write`, `promos:activate`, `inventory:restock`, `hr:read`, `lp:read`), console-session path (PIN token) kept separate from the key path, constant-time compare, revoked keys excluded, failed-auth rate limit per key/IP, never echoes a key or scope list in a 401/403 body beyond the one missing scope name.
- `ROUTE_POLICY` registry: every route declares `{auth: none|session|key, scope, methods}`; the dispatcher refuses to serve an unregistered `/api/` route in strict mode. That is what makes "an admin route with no role check" impossible to ship by omission.
- Security headers on every response (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, a CSP for the static UI that allows same-origin only), CORS **deny by default** (no `Access-Control-Allow-Origin` unless the origin is the same origin; never `*`).
- Input contracts: every write body validated through `wmdemo/contracts.py` against a named shape **before** any DB call; unknown keys rejected (`additionalProperties: false` on new shapes) — that closes mass-assignment / over-posting.
- Reads gated: list/detail routes filter by the caller's store/entity scope; object ids are unguessable and ownership is checked (IDOR).
- Responses: no PII beyond the caller's role; SSN/DL never in list responses; errors never include stack traces or SQL.
- CSV: reuse `forms._csv_safe` for every new export.

**Client (POS-Admin)**
- No key literals in any bundle (recon confirmed none today; the probe greps to keep it so).
- Every write goes through `shared/hw-live.js` with the session token; no screen builds its own header set.
- Token storage: see decision D2.

**Probe:** `qa/security_gate_probe.py` walks `ROUTE_POLICY` and asserts: writes without auth → 401; wrong scope → 403; headers present on every route; CORS absent for a foreign origin; a body with an extra key → 400; an id from another store → 404 (not 403, to avoid confirming existence); CSV cells never start with `= + - @`; no response body contains a key fragment. Registered in `SUITES`/`EXPECTED_CHECKS`; target ≥ 60 checks.

**Refuter brief (per team):** try to (1) mutate without a token, (2) escalate with a self-reported actor or header, (3) reach another store's object by id, (4) over-post a field the schema does not list, (5) inject through every free-text field into SQL/CSV/HTML, (6) exhaust the rule evaluator (deep nesting, huge arrays), (7) find a secret or PII in any response. Read-only, non-destructive, against a fresh port and a scratch DB only.

**Verdict scale (mine, Fable):** PASS / PASS-WITH-NOTES / FAIL. A team's commit is not handed to JT until PASS or PASS-WITH-NOTES with every note either fixed or on `DEV-TEAM-CHANGE-LIST`.

---

## 2. Track 1 — batch-first promotions (highest priority)

### 2.1 The single rule shape (contracts, additive, bump 0.4.3 → 0.5.0)

New shape `PromotionRule` in `contracts/index.js` `SCHEMAS`, exported to `schema/PromotionRule.json` by `tools/contracts-export.mjs`; `Promotion.json` gains an optional `rule` property referencing it. Nothing existing changes shape.

```json
{
  "shape": "hw.rule.v1",
  "id": "rule_01J…",
  "name": "Aged 30%+ flower, 15% off",
  "status": "draft | active | paused | ended",
  "priority": 100,
  "stackable": false,
  "window":   { "starts_at": "2026-09-16T00:00:00Z", "ends_at": null },
  "scope":    { "store_ids": ["store_wh"], "channels": ["in_store", "delivery"] },
  "if": {
    "all": [
      { "field": "batch.thc_pct",     "op": "gte",             "value": 30 },
      { "field": "batch.packaged_at", "op": "older_than_days", "value": 90 },
      { "field": "product.category_id", "op": "in",            "value": ["flower"] }
    ],
    "any": [], "not": []
  },
  "then": {
    "kind": "percent | amount | price | bogo | gift | points",
    "value": 15,
    "applies_to": "matched_lines | cart",
    "cap_cents": null, "max_per_order": null
  },
  "meta": { "author": "actor id", "source": "ui | agent", "prompt": null, "version": 1 }
}
```

- **Field vocabulary (closed enum):** `batch.batch_no`, `batch.thc_pct`, `batch.packaged_at`, `batch.received_at`, `batch.expires_at`, `batch.age_days` (derived from received_at); `product.shell_id`, `product.sku`, `product.category_id`, `product.brand`; `cart.subtotal_cents`, `cart.line_count`; `customer.tier`, `customer.segment_id`; `order.channel`, `order.store_id`; `time.dow`, `time.hour`. **`batch.metrc_tag` and `metrc_packages` are not in the enum — the validator rejects them.** Owner ruling 2026-09-14 and `PRODUCT-BATCHES-DESIGN.md:95`.
- **Operators (closed, typed per field):** `eq neq in not_in gt gte lt lte between before after older_than_days newer_than_days`.
- **Limits (DoS guard, enforced by both validators):** nesting depth ≤ 4, ≤ 50 condition nodes, `in` arrays ≤ 200, strings ≤ 200 chars.
- **Parity:** `contracts/fixtures/promotion-rule/{valid,invalid}/*.json` — one fixture set, run by `test/contracts.test.mjs` (JS) and by `qa/promo_rules_probe.py` through `wmdemo/contracts.py` (Python). Same file list, same verdict per file, or the battery goes red.
- **Vendor mapping table** (for the proposal, not sent): each of the four vendor surfaces → `hw.rule.v1` fields, with the three things they cannot express today (batch attributes, store/channel scope, agent authorship).

### 2.2 Engine (wm-demo, Python 3.9 stdlib)

- `wmdemo/engage/batch_rules.py` — pure `evaluate(rule, ctx) -> Decision`; ctx = cart lines each carrying `batch_id` resolved to `batch_meta` (`inventory.py:391-453`), product fields from the shell/catalog, customer, order, time. No DB inside evaluate; a separate `build_context()` does the lookups in one query per cart.
- `engage/promotions.py`: shape detector — `rule_json` with `"shape": "hw.rule.v1"` routes to the new engine; the legacy rule/action pair keeps working untouched. `_validate_rule` calls `contracts.validate("PromotionRule", …)` for the new shape.
- Quote integration: `pricing.quote_cart()` gains one call, `promotions.apply_rules(cart, ctx)`, behind a store-level flag so nothing changes for stores without active rules. Priority/stackable semantics reuse the existing ordering in `promotions.py:749-841`.
- Routes (all through `ROUTE_POLICY`): `GET /api/promos/rules` (`promos:read`), `POST /api/promos/rules` and `PUT …/{id}` (`promos:write`; **agent-sourced rules land as `draft`**), `POST …/{id}/activate` (`promos:activate`, human only — default policy, see D4), `POST …/{id}/preview` (dry-run: which live batches / which lines of a sample cart match, with the reason per line), `DELETE` is a status change to `ended`, never a row delete.
- Registered via `engage/serve.py` **and** the exact-match table in `server.py` (recon A fact 11: a route added only in `engage/api.py`'s own tables never fires).

### 2.3 Demo on the wm-demo server

Seeded scratch data: three batches of one flower shell with different `thc_pct` / `packaged_at`; one rule written "by the UI", one written "by an agent" (same POST, `meta.source: "agent"`, lands as draft, activated by a human call); a sample cart whose lines resolve to those batches; `preview` shows the match per batch; `quote` shows the discount only on the aged high-THC batch. Verified live on a fresh port and, after JT's push, on Render.

### 2.4 Probe suite

`qa/promo_rules_probe.py` (new file, never overwrites `engage_promotions_probe.py`): schema fixtures parity, operator matrix per field type, forbidden-field rejection, depth/node limits, priority/stackable order, agent-draft policy, preview correctness, quote integration, legacy shape still evaluates. Registered in `SUITES` + `EXPECTED_CHECKS`, floor raised by its count. Target ≥ 80 checks.

### 2.5 Four rule-builder concepts (POS-Admin `explorations/`)

`Promo Rules - Concept A..D.html`, same tokens (`pos/tokens.jsx`, `shared/hd-ui.jsx`), same seeded data, each bound to the real `preview` route for its live "matches N batches" panel:
- **A — Sentence builder:** the rule reads as one English sentence with editable chips ("flower batches over 30% THC packaged more than 90 days ago get 15% off in-store").
- **B — Condition table:** rows of field / op / value with all/any/not groups, a right-hand match preview per batch.
- **C — Batch-first picker:** start from the live batch list (age, THC, on-hand), select what you want to move, the rule is derived and shown for approval.
- **D — Agent draft review:** the agent's prompt on the left, the generated rule and its live preview on the right, activate / edit / reject; the audit trail is the screen.
Plus `PROMO-RULES-CONCEPTS.md`: what differs, what is common, questions for the team. Two Sonnet design agents, two concepts each.

### 2.6 Team 1 roster

| Step | Model | Output |
|---|---|---|
| 1a contracts shape + fixtures + export + JS test | Sonnet | `contracts/index.js`, `schema/PromotionRule.json`, `contracts/fixtures/…`, `test/contracts.test.mjs` |
| 1b engine + routes + quote integration + seed | Sonnet | `wmdemo/engage/batch_rules.py`, edits to `promotions.py`, `serve.py`, `server.py`, `pricing.py` |
| 1c probe suite | Haiku scaffold → Sonnet fill | `qa/promo_rules_probe.py`, `qa/battery.py` (two hunks) |
| 1d four concepts | 2 × Sonnet | `explorations/Promo Rules - Concept A..D.html`, `PROMO-RULES-CONCEPTS.md` |
| QA | Sonnet | runs contracts test + battery `--only`, diffs live-vs-local, reports |
| Refuter | Sonnet × 2 (shape/engine lens; auth/IDOR lens) | attack report |
| Vendor proposal doc | Fable (me) | `docs/promotions/BATCH-PROMOTIONS-PROPOSAL.md` — drafted, **not sent** |

Dependencies: 1b needs 1a's JSON on disk (Python reads the exported schema) and Team 0's `authz.py` (builds against a stub import until then). 1d needs 1b's preview route on a port.

---

## 3. Track 2 — Floor Restock wiring + console common ground

### 3.1 Floor Restock (build now)

- **Data layer** `shared/hw-restock.js` (IIFE, leaks `HWRestock`): `preview(store, shelf, since)`, `plan(...)`, `apply(plan, read)`, `slip(plan, format)`; all through `shared/hw-live.js` (session token, same-origin base). Handles the three apply outcomes (`applied / skipped / adjusted`) and the `hand_count_required` state per line.
- **Screen** `pos/screen-floor-restock.jsx`, routed in `pos/app.jsx`'s route chain, built from Store Concept A: per shelf, SOLD · ON SHELF · PAR · WILL MOVE · REASON; oldest batch first; the loud mixed-batch flag; RFID read panel first (scan tags → lines flip from `hand_count_required` to ready); one "Move to floor" commit; printable slip via the slip route. Every number on screen comes from a route response; no client-side math on `give`.
- **Tests** `test/hw-restock.test.mjs` (node, fake fetch) for the data layer; the server side is already covered by the existing restock checks and gains the `ROUTE_POLICY` auth checks from Team 0.
- Four-concept rule: see decision D3.

### 3.2 Console common ground (build now, layout-agnostic)

All four Refill concepts already share (`REFILL-CONCEPTS.md:3-8`): Region → Kit → Boxes structure, a preview before commit (sold · need · cap · will give · reason), a "received in the last 7 days" lane with "Send today", a status timeline, a skips-and-shortfalls panel. These become **data-bound components with no page layout** in `shared/hw-dist-ui.jsx`: `KitBoxTree`, `PlanPreviewTable`, `ReceivedLane`, `StatusTimeline`, `SkipsPanel` — the winning concept composes them.

Step 0 is an **endpoint census** (Haiku): for each component, the existing wm-demo route it binds to (`/api/inventory/*`, `/api/distribution/*` if any, the `distribution-engine` functions behind them). Any control with no route goes on `DEV-TEAM-CHANGE-LIST.md` as item 20+, and the component ships without that control. No console page is built until JT names the winners.

### 3.3 Team 2 roster

| Step | Model | Output |
|---|---|---|
| 2a endpoint census | Haiku | `docs/codebase-audit/distribution/CONSOLE-ENDPOINT-MAP.md`, change-list items |
| 2b data layer + Floor Restock screen + tests | Sonnet | files above |
| 2c common-ground components | Sonnet | `shared/hw-dist-ui.jsx` + a `explorations/Distribution Components - Bench.html` that renders each against live data |
| QA | Sonnet | live on a fresh port with seeded batches + RFID tags; screenshot-free (text assertions via node tests + curl) |
| Refuter | Sonnet × 2 (client-trust lens: can the client make `apply` move more than derived?; auth lens) | attack report |

Dependency: 2b's writes are only exposed once Team 0's gate covers `inventory:restock`.

---

## 4. Track 3 — LP and HR dashboard migrations

### 4.1 What this program delivers now (plan + foundations), and what waits

Greenfield backend; the biggest risks are auth (client role gate is fail-open; `state.isAdmin` hardcoded in the GAS app), PII (plaintext SSN field, DL, addresses, cash figures) and GAS-only plumbing (triggers, HMAC links, Drive, MailApp). So:

- **M0 (this program):** migration plan doc, contracts for the six core shapes (`Employee`, `Incident`, `WriteUp`, `CallOff`, `CloserReport`, `LossLedgerEntry`) with entity scoping, the server-side role model (`admin / manager / hr / lp` scopes in `authz.py`; PIN second factor for SSN reveal and approve), a decision sheet consolidating the 16 open owner questions into the few that actually block (D1 first), and the Airtable read adapter (server-side, key from env, **never** the client; probes run against a stub Airtable server in `qa/`, never the live base — the guard blocks Airtable writes for good reason).
- **M1 (this program, after D1):** HR read-only screens — Overview, People, Compliance, Policies — lowest blast radius; fixes the Table-A doc-expiry false positives (13 of 18) in the rebuild rather than carrying them.
- **M2 (next program):** LP Triage + Decision slice; fixes the LossLedger stale-driver bug in the rebuild.
- **M3:** write forms on the form generator (incident, call-off, closer report).
- **M4:** write-up draft + ladder + approve + SSN reveal (uses the 2026-09-16 ladder decisions: attendance and accuracy ladders separate, 90-day window, dismissed never count).
- **M5:** background jobs (timesheet engine, LossLedger replacement, daniel-hr) re-homed from GAS triggers to Render scheduled tasks; the 10 unmapped `writeup-pipeline` tables get read first.

### 4.2 Team 3 roster

| Step | Model | Output |
|---|---|---|
| 3a migration planner | Sonnet (Plan agent) | `docs/migration/MIGRATION-PLAN-2026-09-16.md`, `docs/migration/OWNER-DECISIONS-NEEDED.md` |
| 3b contracts for six shapes + fixtures | Sonnet | contracts additions (same 0.5.0 bump) |
| 3c Airtable read adapter + stub + probe | Sonnet | `wmdemo/hr/airtable_read.py`, `qa/hr_airtable_stub.py`, `qa/hr_read_probe.py` |
| 3d M1 screens | Sonnet, after D1 | `pos/screen-hr-*.jsx` (four concepts first for the Overview screen only; People/Compliance/Policies follow the winner) |
| QA + refuter (PII lens, IDOR lens) | Sonnet | reports |

---

## 5. Team 0 — security foundation (runs first, everything else builds against it)

| Step | Model | Output |
|---|---|---|
| 0a `wmdemo/authz.py` + `ROUTE_POLICY` + headers/CORS middleware | Sonnet | server files; `docs/SECURITY-GATE.md` (the checklist as it is enforced) |
| 0b `qa/security_gate_probe.py` + battery registration | Sonnet | ≥ 60 checks |
| 0c retrofit the two exposed weak spots: `/api/promos/*` and `/api/inventory/restock/*` onto the gate | Sonnet | the self-reported-actor path is gone from both |
| QA | Sonnet | full battery on a fresh port; nothing else's count drops |
| Refuter | Sonnet × 2 (bypass lens, lockout/DoS lens) | attack report |

Verify's `_api_key_gate` stays where it is until the refuter passes `authz.py`; then a one-line delegation, no behaviour change, its own probe counts unchanged.

---

## 6. Sequencing, concurrency, cost

Concurrency cap **6 agents** at once (a 14-agent swarm died on the weekly limit on 2026-09-10). Every agent: writes to disk early, keeps tool calls short, names new files distinctly, never overwrites an existing probe, never touches `.env`.

| Wave | Agents | What lands |
|---|---|---|
| W1 | 0a, 1a, 1b (stub gate), 2a, 3a, 3b | foundation + shape + engine skeleton + census + migration plan |
| W2 | 0b, 0c, 1c, 1d ×2, 2b | gate probe, retrofit, promo probe, concepts, Floor Restock |
| W3 | QA 0/1/2, refuters 0 ×2, 1 ×2 | verdicts; fix swarms as needed (Haiku for mechanical fixes, Sonnet otherwise) |
| W4 | 2c, 3c, refuters 2 ×2, 3d (if D1 answered) | components, HR read adapter, remaining verdicts |
| W5 | fix swarms → final QA → Fable sign-off per track | Run buttons |

Rough scale: ~28 agent runs, Sonnet-heavy in W1–W2, Haiku for scaffolds/census/mechanical fixes. Fable does planning, briefs, grading, the proposal doc and commits only.

**Commits:** explicit paths only; per-session identity `git -c user.name="Claude build-program [pm]"`; `qa/battery.py` and any other shared-dirty file staged as `-U3` filtered hunks; after staging, export the index to the scratchpad and boot-test it before any Run button. One Run button per landed commit:
- POS-Admin: `tools/hw_push_pos_admin.sh`
- wm-demo: `cd /Users/jt/wm-demo && git push origin main` — **this deploys the live demo on Render**, so it comes last and only after the Render-equivalent boot test.

---

## 7. Owner decisions — DECIDED 2026-09-16 (JT accepted the recommendations)

- **D1 → Airtable stays the system of record for M0–M2**; our admin is the UI over it; revisit at M3.
- **D2 → move the client write token off `localStorage` now**, behind Team 0, short-lived server-issued session token.
- **D3 → wire Store Concept A directly**; the four-concept rule applies to the console pages.
- **D4 → agents draft, humans activate** (`promos:activate` never on an agent key).

Original framing kept below for the record.

- **D1 — System of record for HR/LP.** Airtable stays the store and our admin is the UI over it (fast, reversible, PII stays where it is) — or data migrates into wm-demo's DB (a schema and an irreversible cut-over). Blocks M1 build; M0 planning proceeds either way. *Recommendation: Airtable stays for M0–M2; revisit at M3.*
- **D2 — Client write token in `localStorage`** (`shared/hw-live.js`, key `hw-live-token`). Moving it to a memory/session-scoped token changes sign-in for every existing screen (re-enter on each tab/reload). Do it in this program, or list it on `DEV-TEAM-CHANGE-LIST` with the rest of the client hardening? *Recommendation: do it now, behind Team 0, with a short-lived server-issued session token; it is the one checklist item the whole client fails.*
- **D3 — Floor Restock concepts.** Store Concept A is the only Floor Restock concept in existence (the Store round's four were four different screens). Wire Concept A directly, or produce four Floor Restock variants on the same live data layer first? *Recommendation: wire Concept A now (JT named it), and let the four-concept rule apply to the console pages.*
- **D4 — Who may activate a promotion.** Default policy in the plan: rules written by an agent land as `draft`; activation needs the `promos:activate` scope, which no agent key carries. Confirm, or allow agents to activate within a cap.

Mechanics I am deciding myself and reporting: contracts bump to 0.5.0 (additive); `customer.*` fields are in the vocabulary from day one (the engage rulings make loyalty ours); `DELETE` on a rule is a status change; `ROUTE_POLICY` strict mode is on for every new route and warns (not refuses) for legacy routes until Team 0's retrofit is done.

---

## 8. Findings for JT that are not this program's to fix

- `qa/battery.py` in the working tree (another session's uncommitted edit) drops `idv_webhooks_probe` — the outbound-webhook SSRF / DNS-rebinding guard — and lowers the floor 3767 → 3692. If that edit is committed as-is the battery stops guarding webhook SSRF and nothing turns red. Probably the security-audit thread's in-flight work; flagged, not touched.
- `hyperwolf-super-admin/src/layouts/promo/backendRuleAttributes.js:5-8` documents backend files that do not exist; anyone building an admin promo UI from it sends fields the backend cannot consume. Goes on `DEV-TEAM-CHANGE-LIST` with the promotions proposal.
- `POST /api/promos/internal` accepts almost any body today and its rows never affect pricing; the Promo Builder mockup (another session) already documents this. Team 0c closes the auth half; Track 1 closes the pricing half.

---

## 9. Progress log (appended as work lands)

- 2026-09-16 · plan approved by JT; W1 dispatched staggered: 0a, 1a, 2a, 3a first; 1b and 3b after 1a lands (both need `contracts/index.js` quiet).
