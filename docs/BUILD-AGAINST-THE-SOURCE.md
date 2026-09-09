# Build against the source — the guide for every future thread

Written 2026-09-09 at the end of Phase 3. Read this before adding a module, a screen, a route or
an integration anywhere in this estate. It is short on purpose; the reasons are in
`docs/codebase-audit/` and the rules are enforced by tests named below.

## 1. Where the canonical model lives

| What | Where | Enforced by |
|---|---|---|
| The contract (types, enums, ids, money, time, errors, events, schemas) | `contracts/index.js` — package `@hyper-tech/contracts`, one UMD file, zero dependencies | `test/contracts.test.mjs` |
| Its JSON export for Python | `contracts/enums.json`, `contracts/schema/*.json` — written by `node tools/contracts-export.mjs`, never by hand | same test fails if they differ from `index.js` |
| Its TypeScript declarations | `contracts/types.d.ts` | same test checks every export is declared |
| The model as production actually has it | `docs/codebase-audit/CANONICAL-DATA-MODEL.md` | the audit; re-run for a new repo per `docs/codebase-audit/README.md` |
| Why each enum says what it says | the `source` string on every entry in `ENUMS` | the drift group in `test/contracts.test.mjs` parses those source files |
| wm-demo's view of the contract | `wm-demo/wmdemo/contracts.py` (loader, validator, adapters) and `wmdemo/contracts_api.py` (`/api/contracts/*`) | `wm-demo/qa/contracts_probe.py` |

Three runtimes, one vocabulary:

```js
// Node — a Hyper-Tech backend
const C = require('@hyper-tech/contracts');          // or require('../POS-Admin/contracts') until published
if (!C.isEnum('OrderStatus', status)) return res.status(422).json(C.error('unprocessable', 'bad status'));
```
```html
<!-- Browser — a POS-Admin page: loaded once, right after shared/hw-live.js -->
<script src="contracts/index.js"></script>   <!-- window.HWContracts -->
```
```python
# Python — wm-demo (stdlib only)
from wmdemo import contracts as C
C.validate("Order", order)   # same messages as the JS validator, byte for byte
```

## 2. How a new module declares its contract

1. **Write the shapes first**, as an addition to `contracts/index.js`: enums into `ENUMS` (with a
   `source` line saying which file in the estate owns that vocabulary), records into `SCHEMAS`,
   event types into `EventType`, and the matching lines in `types.d.ts`. Bump `VERSION` (semver:
   additive = minor, a changed or removed field = major).
2. `node tools/contracts-export.mjs` then `node --test test/contracts.test.mjs`. Green means the
   three runtimes agree.
3. **Write the probe before the route.** Bounty and Verify were built that way and it is why they
   have a regression floor: `wm-demo/qa/incentives_routes_probe.py`, `qa/idv_api_probe.py`,
   `qa/contracts_probe.py`. A probe asserts keys and types from the contract over real HTTP on a
   scratch database on a free port. Register it in `qa/battery.py` `SUITES` and `EXPECTED_CHECKS`.
4. **Screens read their own module's client** (`window.HWInc`, `window.HWIdv`), never
   `HW_LIVE` or `fetch` directly, and never a second copy of an enum or a money formatter. The
   client exposes `contract.get()`, `contract.validate()`, `contract.session()` for anything
   that must cross to production.
5. **The status note** (`docs/<MODULE>-STATUS.md`) says what was done, what was verified and how,
   what waits on the owner, how to run it. `docs/CODEBASE-STATUS.md` is the one for this work.

## 3. What may never be hardcoded

The audit found each of these as a literal in production logic; the contract package is where
they live instead.

- **Store names, ids, timezones, POS vendor** — `stores` registry (`/api/incentives/stores`,
  contract `Store`); never `'Lake Elsinore'` in a screen or a controller.
- **Role strings** — `HWContracts.roleFrom()` / `contracts.role_from()`; never
  `role === 'Floor Manager'` or `userRoles.includes('Super Admin')`.
- **Status and kind literals** — `C.isEnum('ContestStatus', x)`; a new state is an enum change
  with a version bump, not a new string.
- **Money in dollars** — never stored, never on the wire. `centsFromDollars()` at the one boundary
  where a vendor or a legacy `Number` field hands us dollars; `money(cents, basis)` everywhere
  else, and the basis (`ex_tax_net | ex_tax_gross | inc_tax`) is stated, not assumed.
- **Time as epoch or a formatted string** — `toIso()` once at the adapter; ISO-8601 UTC `Z` on
  the wire; a bare `YYYY-MM-DD` only as a store-local day key.
- **Vendor ids as bare strings** — `externalId('blaze', id)` → `{source, id}`; a person, product
  or order carries `external_ids[]`, and our own slug (`associate_id`, `store_id`) is a display key.
- **Base URLs, ports, keys, phone numbers, employee ids, S3 URLs** — environment, validated at
  boot (`startup/config` must check every variable the code reads; the audit found 14 unchecked).
- **Secrets in the repo** — never, including `.json` key files and `build.zip`. Keys go in `.env`
  through the owner's Run button; the guard blocks the rest.
- **A second copy of anything above** — the collision test (`test/global-collisions.test.mjs`)
  catches a second top-level binding; the drift tests catch a second enum. If you need it in two
  places, it belongs in `contracts/` or `shared/`.

Known exceptions after the 2026-09-09 waves, each deliberate and each named where it lives:
`shared/hw-live.js` `roundHalfEven` (Weedmaps parity, documented in the file);
`shared/merch-store.js` REGIONS (delivery-zone cities, not store slugs — a false namesake);
`pos/screen-register.jsx` (frozen: its own `round2`, role and store literals);
`pos/screen-cart.jsx`, `pos/store.jsx` (owned by another session at the time; the orders pricing block itself is now `pos/orders-pricing.js`, on cents);
Verify's engine webhook channel (its own canonicalisation until 0.3.0).

## 4. How a platform service is consumed

The eight services and their state are in `docs/codebase-audit/CONSOLIDATION-AND-PLATFORM-SERVICES.md`
§3. The pattern is the same for each and Bounty/Verify already follow it:

1. **One contract per service**, in `contracts/` (`Order`, `Person`, `VerificationSession`,
   `PointsEntry`, …) plus its events (`order.completed`, `verification.decided`, `points.earned`).
2. **One adapter per legacy shape**, server-side, in the service that owns the data —
   `wmdemo/contracts.py` for wm-demo's SQLite shapes, `wmdemo/contracts_api.py` for the routes.
   A screen never adapts; a controller never re-implements.
3. **Consume by contract route or by event**, never by reaching into another service's database
   (the audit's biggest structural finding). Today that means `/api/contracts/*`; in production it
   means the service's `/api/v1/...` returning the same schema with `x-hw-contract: 0.1.0`.
   - Bounty ingests production sales through `POST /api/contracts/orders` (a contract `Order`,
     or an `order.completed` event wrapping one). That is the production POS integration; the
     register's `/api/pos/sale` stays for the demo register only.
   - Verify is consumed through `/v3/*` (canonical) or the `/v2/*` Didit facade
     (`docs/IDV-SITE-INTEGRATION.md`); a decision reaches Members only as a signed
     `verification.decided` event.
4. **Authenticate as a service**, not with a shared static key: the contract's `PersonKind`
   `service` and `Role` enum are the shape; the Identity & Auth service (plan §3) is the issuer.
   Until it exists, `x-hw-write-token` (writes) and `X-HW-Actor` (Verify console) are the seams,
   and `HWInc.contract.session()` / `HWIdv.contract.session()` are where a real session plugs in.
5. **Sign what leaves**: `signingPreimage(unixTs, body)` → HMAC-SHA256 with the destination's
   secret, headers `X-Signature-V2` + `X-Timestamp`, ±300 s window. This is the rule for contract
   Event envelopes. Verify's engine channel (`wmdemo/idv_webhooks.py` ↔ `idv-engine`) keeps its
   own canonicalisation (integral floats print as `100.0`, ties round banker's) because both
   parties sign the same bytes; they move to the contract rule together in 0.3.0.
6. **Prove it**: a probe on a scratch database, three refuter lenses (numbers, safety, blast
   radius) on the diff, and a live check on a fresh port — the same dev port can serve stale
   `.jsx`.

## 5. Moving into the Hyper-Tech repos later

`contracts/` has no dependency on POS-Admin, wm-demo or demo data: copy the directory into a
repo named `hyper-tech/contracts`, `npm publish` it privately as `@hyper-tech/contracts`, and
point the drift tests at the production models by path (they already read
`/Users/jt/hyper-tech/*` when present and only report, not fail, unless
`HW_CONTRACTS_STRICT_PROD=1`). Nothing in the package knows it started here.
