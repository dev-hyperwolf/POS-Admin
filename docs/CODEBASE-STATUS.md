# Hyperwolf codebase audit — status

Updated 2026-09-09 (evening). Phases 1, 2 and 3 are complete. **The Hyper-Tech repos are
read-only for this work by the owner's decision**: findings go to the developer team as
`codebase-audit/TEAM-TODO.md`, and nothing under `/Users/jt/hyper-tech` has been modified.
Nothing has been pushed anywhere; both our repos auto-deploy on push and the owner pushes.

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
