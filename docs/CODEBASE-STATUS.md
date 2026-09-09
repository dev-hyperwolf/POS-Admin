# Hyperwolf codebase audit — status

Updated 2026-09-09 (evening). Phases 1, 2 and 3 are complete. **The Hyper-Tech repos are
read-only for this work by the owner's decision**: findings go to the developer team as
`codebase-audit/TEAM-TODO.md`, and nothing under `/Users/jt/hyper-tech` has been modified.
Nothing has been pushed anywhere; both our repos auto-deploy on push and the owner pushes.

## Modules on the contract — status (2026-09-09, late)

| Module | State | Evidence |
|---|---|---|
| Bounty | enum lists and the manager gate read the contract (client and server apply the same role rule); the demo register posts a contract Order to `/api/contracts/orders` with tender method and customer name, falling back to `/api/pos/sale` only when the server lacks the route | `incentives_routes_probe` 189, `contracts_probe` 42, `incentives_contests_probe` 35; live on 8801 |
| Verify | statuses/reasons/roles from the contract with literal fallbacks; contract event envelope beside the legacy webhook body; contract error codes beside `/v2`/`/v3` sentences; signer unchanged by decision (engine channel keeps its own canonicalisation until 0.3.0) | done in JT's Verify session: `idv_api_probe` 155, `idv_rules_probe` 338, live on 8793 |
| Promotions Suite (`promo/`, `pweb/`) | Platform ids, one promotion status vocabulary (`live` → `active`), one discount-kind list, Weedmaps ids as `external_ids`; the promo↔draft bridge no longer collapses status (a real bug) | 34 JS tests incl. `promo-builder-native-offer-roundtrip`; live on 8802 |
| wm-demo backend | one dollars↔cents boundary (`pricing.py`), `order_lines`/`engine` route through it; fulfillment stages, check-in states, txn types and promo relations are local literals checked against the contract (never crash boot) | `contract_vocab_probe` 13, `fulfillment_probe` 27, `cycle1/2`, `pricing_probe` |
| shared/ | one `cents()` boundary (adapter → contract), one money formatter (`hd-format.jsx`), one live-feed vocabulary, one age-since-epoch helper; `roundHalfEven` in hw-live.js kept for Weedmaps parity | 55-test gate incl. mutation floor; live on 8803 |
| pos/ | roles via `roleAtLeast`, stages from `FulfillmentStage`, one store registry (`pos/stores.jsx`), one `round2`/`moneyK`, one tax table, `external_ids` at the brand build site; screen-orders pricing block and the frozen register untouched | `pos-stages-contract` test; live sale on 8806 moved the board |
| shop/, athome/, pipeline/ | checkout goes through the adapter; athome's five money copies are one file; pipeline no longer overrides `window.HD` (proven by test) | `pipeline-hd-no-override`, 86 shop tests; live on 8804 |
| delivery/, logistics/, driver app, terminals/ | terminal-kind bug fixed; FNV-1a hash replaces the colliding char-sum; real driver names and phones replaced with synthetic data; drawer math in integer cents; mobile task statuses on the contract shape | `terminals-drawer-math`, `delivery-weedmaps-hash`, 141 mobile/driver tests; live on 8805 |
| engage/ | inventoried, not started (money/time already disciplined; four enums to extract) | `gaps/engage-and-promotions.md` |

Displayed-number changes made on purpose in these waves (record, not regression): card fees round half away from zero like a till (+1¢ on ~0.4% of amounts); logistics mockup totals use the real tax table (23.22%) instead of a flat 8.22%; money at or above $1,000 gains a thousands separator and negatives print as `-$5.00`; the AOV and incentives cards always show two decimals.
Owner decisions still open: the real driver roster in `logistics/ldata.jsx` is gone from HEAD but remains in history (commits 58e1b04..0c9b4a6^) — rewriting history is yours; `screenshots/*.png` were not inspected.
Attribution note: `e6ef263` (terminals) also carries wave 4's pipeline files, swept in from the shared index; `aov-attribution-signal` and the two `demo-seed` failures come from the other session's uncommitted `pos/store.jsx`/`pos/screen-cart.jsx`, not from these commits.

Contract is 0.2.1 (45 enums). Queued for 0.3.0: `DiscountKind` (percent|dollar|bogo|bundle|gift|tiered|points), the engine channel's move to the contract preimage.
Three refuter lenses ran over the eleven wave commits: 1 blocker (Publish crash) and 8 warnings, all fixed the same evening; the only surviving caveat is that the register's demo order ids come from a pool of 40 values, so a colliding demo id is swallowed as a replay — a demo limit, not a contract defect.

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
