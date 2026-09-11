# Hyperwolf codebase audit — status

Updated 2026-09-09 (late). Phases 1, 2, 3 and 4 (Hyperwolf Docs) are complete. **The Hyper-Tech repos are
read-only for this work by the owner's decision**: findings go to the developer team as
`codebase-audit/TEAM-TODO.md`, and nothing under `/Users/jt/hyper-tech` has been modified.
Both repos were pushed on 2026-09-10 (owner's word, Verify session's push); both auto-deploy on push.

## Modules on the contract — status (2026-09-09, night)

**Everything below except the last two commits is already live**: you pushed both repos during the day, so GitHub Pages and Render carry contract 0.3.0 and every wave. Unpushed on POS-Admin: the orders cents conversion and the final refuter fixes (`44aaafd`, `72da34f`).

| Module | State | Evidence |
|---|---|---|
| Bounty | enum lists and the manager gate read the contract (client and server apply the same role rule); the demo register posts a contract Order to `/api/contracts/orders` with tender method and customer name, falling back to `/api/pos/sale` only when the server lacks the route | `incentives_routes_probe` 189, `contracts_probe` 42, `incentives_contests_probe` 35; live on 8801 |
| Verify | statuses/reasons/roles from the contract with literal fallbacks; contract event envelope beside the legacy webhook body; contract error codes beside `/v2`/`/v3` sentences; signer unchanged by decision (engine channel keeps its own canonicalisation until 0.3.0) | done in JT's Verify session: `idv_api_probe` 155, `idv_rules_probe` 338, live on 8793 |
| Promotions Suite (`promo/`, `pweb/`) | Platform ids, one promotion status vocabulary (`live` → `active`), one discount-kind list, Weedmaps ids as `external_ids`; the promo↔draft bridge no longer collapses status (a real bug) | 34 JS tests incl. `promo-builder-native-offer-roundtrip`; live on 8802 |
| wm-demo backend | one dollars↔cents boundary (`pricing.py`), `order_lines`/`engine` route through it; fulfillment stages, check-in states, txn types and promo relations are local literals checked against the contract (never crash boot) | `contract_vocab_probe` 13, `fulfillment_probe` 27, `cycle1/2`, `pricing_probe` |
| shared/ | one `cents()` boundary (adapter → contract), one money formatter (`hd-format.jsx`), one live-feed vocabulary, one age-since-epoch helper; `roundHalfEven` in hw-live.js kept for Weedmaps parity | 55-test gate incl. mutation floor; live on 8803 |
| pos/ | roles via `roleAtLeast`, stages from `FulfillmentStage`, one store registry (`pos/stores.jsx`), one `round2`/`moneyK`, one tax table, `external_ids` at the brand build site; the screen-orders pricing block is extracted to `pos/orders-pricing.js` and computes in integer cents through the one boundary (19-row characterisation floor; 720,000 swept carts differ from the old float math only where a half-cent discount now rounds up); the frozen register untouched | `pos-orders-pricing` 20, order suites 81; live on 8806/8808/8809 |
| shop/, athome/, pipeline/ | checkout goes through the adapter; athome's five money copies are one file; pipeline no longer overrides `window.HD` (proven by test) | `pipeline-hd-no-override`, 86 shop tests; live on 8804 |
| delivery/, logistics/, driver app, terminals/ | terminal-kind bug fixed; FNV-1a hash replaces the colliding char-sum; real driver names and phones replaced with synthetic data; drawer math in integer cents; mobile task statuses on the contract shape | `terminals-drawer-math`, `delivery-weedmaps-hash`, 141 mobile/driver tests; live on 8805 |
| engage/ | channels and the campaign/flow/audience status vocabularies from the contract (0.3.0), loyalty liability keyed on `PointsKind`, vendor ids as `external_ids`; the analytics `/100` was correct, the dead cohort arithmetic removed | 29-test gate; live on 8807 |

Displayed-number changes made on purpose in these waves (record, not regression): card fees round half away from zero like a till (+1¢ on ~0.4% of amounts); logistics mockup totals use the real tax table (23.22%) instead of a flat 8.22%; money at or above $1,000 gains a thousands separator and negatives print as `-$5.00`; the AOV and incentives cards always show two decimals.
Owner decisions still open: the real driver roster in `logistics/ldata.jsx` is gone from HEAD but remains in history (commits 58e1b04..0c9b4a6^) — rewriting history is yours; `screenshots/*.png` were not inspected.
Attribution note: `e6ef263` (terminals) also carries wave 4's pipeline files, swept in from the shared index; `aov-attribution-signal` and the two `demo-seed` failures come from the other session's uncommitted `pos/store.jsx`/`pos/screen-cart.jsx`, not from these commits.

Contract is 0.3.0 (52 enums), every enum drift-tested against the file that owns its values. Still queued: the Verify engine channel's move to the contract preimage (both sides together).
Three refuter lenses ran over the eleven wave commits: 1 blocker (Publish crash) and 8 warnings, all fixed the same evening; the only surviving caveat is that the register's demo order ids come from a pool of 40 values, so a colliding demo id is swallowed as a replay — a demo limit, not a contract defect.

## Phase 4 — Hyperwolf Docs (live on Render since 2026-09-10; contracts 0.3.2)

A new POS-Admin app served by wm-demo exactly like Bounty: rail item, app-switcher entry, hub
card, IIFE files, and **every route (reads included) behind the write token**. Three screens:
Pages (the audit, the contract guides, the 24 per-repo reports, rendered from the repo with
"View on GitHub"), Search (BM25 over every file of all 14 repos, each hit a `file:Lstart-Lend`
link pinned to the SHA the index was built from) and Ask (chat over the same index; every claim
cites an excerpt `[n]` that links to GitHub).

| Piece | Where | Notes |
|---|---|---|
| Index | `wm-demo/wmdemo/docs_index.py` | stdlib + SQLite; 21,800 chunks over 14 repos in 12.6 s; markdown by heading, code in 80-line windows; populate-then-swap; `.env` never indexed, private-key blocks and long tokens redacted |
| Routes | `wm-demo/wmdemo/docs_api.py` | `/api/docs/status`, `/pages`, `/page`, `/search`, `POST /chat`, `POST /reindex` (background thread); 403 without `x-hw-write-token`; path traversal refused |
| Model seam | `wm-demo/wmdemo/llm_adapter.py` | `complete(system, messages)`; provider `HW_LLM_PROVIDER` (anthropic \| none), model `HW_LLM_MODEL` (default `claude-fable-5-1`), key `ANTHROPIC_API_KEY` from `.env`, urllib only. No key → chat answers extractively with the same citations |
| App | `Hyperwolf Docs.html`, `docs-app/docs-client.jsx` (`window.HWDocs`), `docs-app/app.jsx` | registered in `shared/app-nav.js`, `shared/app-switcher.js`, hub card in `Hyperwolf.html` |
| Probe | `wm-demo/qa/docs_probe.py` (in `qa/battery.py`) | fixture index, token gate, search, page, traversal, chat (extractive), reindex |
| Run buttons | `wm-demo/tools/set_anthropic_key.sh` (hidden dialog → `.env`, restarts), `wm-demo/tools/hw_docs_reindex.sh` | the key never passes through chat |

**Production index (owner decision 2026-09-09: clone on deploy)**: Render's build runs
`wm-demo/tools/hw_docs_clone_repos.sh`, which shallow-clones the twelve Hyper-Tech repos with a
read-only `HW_GITHUB_TOKEN` and builds the index into the checkout; the Re-index button rebuilds
from those clones at runtime. Citations link to the SHA recorded at build time, so a stale index
still points at the right lines. Without the token the deployed index covers POS-Admin and
wm-demo only, and the build says so. A GitHub push webhook → `POST /api/docs/reindex` is the
one-line follow-up. Without `WM_DEMO_WRITE_TOKEN` the routes answer loopback only.

**Movable**: the three Python files depend only on `config.WRITE_TOKEN`/`PUBLIC`/`STATIC_DIR` and
`contracts.error/http_status`; the app depends on `HW_LIVE` and the rail. Lifting them into a
Hyper-Tech service means copying the files and the two `server.py` mount lines.

## Phase 5 — Inventory, placement, forms, RFID (2026-09-10)

The distribution study, 24 design concepts, and migration inventories live under `docs/codebase-audit/distribution/` and `docs/migration/`. All infrastructure and design foundations shipped and live on https://hyperwolf-wm-demo.onrender.com on 2026-09-10.

| Piece | Where | Proof |
|---|---|---|
| Contracts 0.4.2 (inventory shapes, attribution, placement) | POS-Admin `contracts/` | 13 parity tests |
| Decision engine (JS) | POS-Admin `distribution-engine/` | 53 tests |
| POS adapter (Blaze / hwpos / memory) | POS-Admin `pos-provider/` | 31 tests |
| Inventory storage + `/api/inventory/*` | wm-demo `inventory.py`, `inventory_api.py` | 49 + 21 checks |
| Placement (per-store FOH/BOH on the shell, boxes, rebind) | wm-demo `shells.py`, `shells_api.py`; POS-Admin `pos/shell-locations.jsx`, `shell-boxes.jsx`, Placement on the shell form | 66 checks; 5 UI tests |
| Python restock engine, parity with the JS | wm-demo `restock_engine.py` | 83 checks, 31 goldens |
| Form generator phases 0–1 | wm-demo `forms.py`, `forms_api.py`; POS-Admin `shared/hd-form.jsx`, `Hyperwolf Forms.html` | 57 checks; 8 tests |
| RFID middleware: batch-keyed plans, RETURN mode, station meta | `~/Documents/hyperwolf-repos/rfid-middleware` commit `676d88d` | 223 tests, 44-check conformance kit |
| 24 concepts, batch level everywhere, RFID first | POS-Admin `explorations/` + index | live on Render |
| Migration inventories + form proposal | POS-Admin `docs/migration/` | — |
| Design review pages: index + refill, location, count, verify, store, build | POS-Admin `explorations/review/` | `GET /api/review/*` behind `HW_REVIEW_PIN`, 31 contract checks |
| Floor-restock routes (RFID-first, batch-aware) | wm-demo `inventory_api.py` | `GET /api/inventory/restock/preview`, `POST .../plan`, `POST .../apply`, 36 checks |
| Paper-first pick slip: HTML and text formats | wm-demo `pick_slip.py` | `GET /api/inventory/restock/slip?format=html\|text`, 27 checks |
| Form generator phase 2: attachments, submission detail, CSV export | wm-demo `forms_api.py`; POS-Admin `forms-app/review.jsx` | 42 checks, formula-injection guard (FA-11d) |
| RFID return-verify endpoint: same-person refusal | `rfid-middleware` `/sessions/:id/return-approve` | 44-check conformance kit; typed output |

**Shipped and live (2026-09-10):** design review pages collect team feedback (team PIN-gated); floor-restock routes plan kits with RFID-first, batch-aware allocation; pick slips print via wm-demo; RFID middleware enforces batch-keyed plans and return authorization. Adversarial QA ran (3 findings; CSV injection fixed, restock-apply trust, attachment content-type noted). Battery floor 3628 stable.

Not done yet: Floor Restock wired to `plan_restock_for_store`; the form builder screen (phase 3); the LP migration.

## Phase 3 — compatibility (done, committed, not pushed)

**What shipped**
- `contracts/` — `@hyper-tech/contracts` 0.1.0: one UMD file (`index.js`) with 29 enums, 16 JSON
  schemas, id/money/time/role/error/event rules and a dependency-free validator; `types.d.ts`;
  `enums.json` + `schema/*.json` exported by `tools/contracts-export.mjs` for Python. Loaded on
  `Hyperwolf Bounty.html` and `Hyperwolf Verify.html` as `window.HWContracts`; `HWInc.contract`
  and `HWIdv.contract` are the client seams.
- `wm-demo/wmdemo/contracts.py` — the Python twin (loader, validator, adapters) and
  `wmdemo/contracts_api.py` — `/api/contracts/*`: version/enums/schemas, Bounty and Verify
  records in contract shape, and `POST /api/contracts/orders` (a contract Order or
  `order.completed|refunded|cancelled` Event → the Bounty ledger through the same writes as
  `/api/pos/sale`). Two inserted branches in `server.py`.
- `docs/BUILD-AGAINST-THE-SOURCE.md` — the guide for every future thread.

**Verified, and how**
- `node --test test/contracts.test.mjs` 13/13: three runtimes one vocabulary; the Python twin is
  driven by the JS test (spawns `python3`) and must return the same validator messages,
  signing preimage, roles, cents and times; wm-demo enum drift fails the test; Hyper-Tech
  production drift is reported (two known items: promotion-engine `RULE_TYPES` constant,
  distribution `Regions.platform`) and fails only with `HW_CONTRACTS_STRICT_PROD=1`.
- `wm-demo/qa/contracts_probe.py` 42/42 on a scratch database and free port; registered in
  `qa/battery.py` (`EXPECTED_CHECKS` 42, floor +42). Regression floor unchanged after the
  server change: `incentives_routes_probe` 189/189, `idv_api_probe` 137/137;
  `test/global-collisions.test.mjs` 16/16.
- Live on a fresh port (8799): both pages render; `HWContracts` is the only new global;
  `HWInc.contract.get('stores')` returns five valid Store records; `/bounty/me` maps the
  demo role to `manager`; Verify's contract routes agree with the legacy routes.
- Three refuter lenses on the diff (numbers, safety, blast radius): 23 findings, all fixed the
  same evening — the two that mattered most: a JS role gate that returned true for an unknown
  role name, and a write path that accepted backdated, status-contradicting or tax-inclusive
  orders. The probe now pins each refusal (CT-50..58).
- Not verified: the POS-Admin full `npm test` shows 14 failures in three suites
  (`brand-bind-offer`, `weedmaps-promo-attributes`, `demo-seed`) whose source files are dirty
  from a concurrent session and outside this diff; they were not touched and not fixed here.

**Known limits**
- `/api/contracts/orders` dedupes on order id, not on `event_id`; a second event with a new order
  id is a new sale by design. Backdating is bounded to 48 h; history goes through Data → Upload.
- `randomHex()` in a browser without WebCrypto throws; only `event()` without an `event_id` hits it.
- The contract is 0.1.0 and unpublished: publishing `@hyper-tech/contracts` to the org registry is
  the team's step (guide §5).

## Phases 1–2

## Where it stands

**Overall grade 29 / 100** across twelve repos (19 to 37). Read
[`codebase-audit/THE-GRADE.md`](codebase-audit/THE-GRADE.md) first; the index is
[`codebase-audit/README.md`](codebase-audit/README.md).

## What was done

- Cloned all twelve repos fresh to `/Users/jt/hyper-tech/<repo>` and pinned each to its HEAD SHA
  (recorded in `codebase-audit/metrics/<repo>.md`). Every repo has exactly one commit, dated
  8–9 September, by one author: there is no history to mine.
- Built a repeatable mechanical pass, `tools/hw_audit_metrics.py` (stdlib Python), producing per-repo
  metrics, cross-repo exact/near duplicates, a fork-distance table and a concept matrix.
- Dispatched twelve discovery agents against one shared prompt (`codebase-audit/DISCOVERY-PROMPT.md`)
  and one digest of our own estate's contract surface. Every claim in the reports carries a
  `path:line`; each agent corrected the mechanical pass where it was wrong and said so.
- Synthesised the architecture map, the canonical data model as it is, the consolidation and
  platform-services plan, and the grade with its rubric and arithmetic.

## What was verified, and how

- Report files exist and are within their line caps; grep over all reports for secret-value
  patterns found one Firebase web API key that had been copied into a report — redacted in place;
  no other value appears anywhere in `docs/codebase-audit/`.
- `npm audit --package-lock-only` on the four repos that have a lockfile (no install, no scripts):
  80 / 51 / 29 / 14 advisories. The other eight cannot be audited without an install because they
  gitignore their lockfile.
- Fork distance measured with `difflib` on same-basename files (`metrics/fork-distance.md`), not
  inferred from the reports.
- The Firebase service-account key in `hyperwolf-backend` was confirmed by counting the
  `BEGIN PRIVATE KEY` marker line, never by reading the value.
- Not verified: anything live. No production host was called, no database was opened, no test
  suite in the twelve repos was run (there is none to run). Deployment branch/host mismatches are
  reported as open questions in each repo's §19, not as facts.

## Waiting on you

0. **Push POS-Admin** (Run button: `tools/hw_push_pos_admin.sh`) and **push wm-demo** — the classifier refuses `git push` from this session. Done: both pushed, key set, Docs live on the 8791 review server. Still owed on Render: `HW_GITHUB_TOKEN` (read-only, Hyper-Tech-inc repos), `ANTHROPIC_API_KEY`, `WM_DEMO_WRITE_TOKEN`.
1. **Rotate the three committed service-account keys** (`hyperwolf-backend/hyperdrive-firebase-adminsdk.json`,
   `hemp-backend/staticDB/fcmtoken.json`, `stilo-backend/staticDB/fcmtoken.json`), the Google Maps
   key in `hyperwolf-backend/controllers/google-controllers.js:23`, and the LedgerGreen webhook
   literal at `ledgergreen-controllers.js:10`. Your call, today.
2. Read `THE-GRADE.md`; say go for Phase 3 (contracts package + adapters in our estate — touches
   nothing in Hyper-Tech) and/or for the quick fixes in the Hyper-Tech repos (touches them; needs
   your decision on who has write access).
3. The five decisions in `CONSOLIDATION-AND-PLATFORM-SERVICES.md` §6, asked one at a time.

## Run it

```bash
cd /Users/jt/POS-Admin && python3 tools/hw_audit_metrics.py /Users/jt/hyper-tech docs/codebase-audit/metrics
```

Re-runs the mechanical pass over every clone (about 70 s). Add a repo name at the end to run one.
