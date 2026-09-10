# pos-provider

The `PosProvider` adapter boundary (`docs/codebase-audit/distribution/BLAZE-DEPENDENCY-MAP.md`
§3): every module that reads or writes a POS talks to this port, never to Blaze or wm-demo
directly, so leaving Blaze is a provider swap, not a rewrite.

Pure Node.js, ESM, zero dependencies, `node --test`. Every provider uses global `fetch` behind an
injectable `http` constructor option, so no test ever touches the network.

## Files

- `index.js` — the port: `POS_PROVIDER_METHODS`, `assertProvider(obj)`, `PosError`, and
  `channelFromOrderTags` (the one asap/scheduled/pickup/express rule every provider shares).
- `blaze.js` — `BlazeProvider({baseUrl, partnerKey, authKey, http, now, sleep, platform,
  currentEmployeeId})` over the real Blaze Partner endpoints in use today.
- `hwpos.js` — `HwposProvider({baseUrl, token, http, platform})` over wm-demo's actual routes.
- `memory.js` — `MemoryProvider(fixtures)` for tests and the future decision engine's fixtures.
- `test/*.test.mjs` — 109 assertions across 31 tests, all passing.

## The port

```
listProducts({storeId})                              -> Product[]
getProduct(id)                                        -> Product
listBatches({productId?})                             -> Batch[]
listLocations({storeId?})                             -> Location[]
listTerminals({storeId?})                             -> {terminal_id, name, region_id|null, location_id|null}[]
listSales({since, until, terminalIds?})               -> {order_id, at, channel, terminal_id, lines:[{product_id, batch_id|null, quantity}]}[]
createTransfer({from_location_id, to_location_id, lines}) -> {transfer_id, status}
acceptTransfer(id)                                    -> {transfer_id, status}
findMember(query)                                     -> Person|null
capabilities()                                        -> {name, supports: {...}}
```

Product/Batch/Location/Person are `contracts/index.js` shapes, validated in the test suite via
`Contracts.validate(...)`. `listTerminals`/`listSales`/transfer/`findMember` have no formal
contract schema (they're new, port-specific shapes) — the tests check their fields directly.
`ExternalId.source` is `'blaze'` for BlazeProvider records and `'hwpos'` for HwposProvider/
MemoryProvider records — both already reserved in `IdSource`.

## What hwpos lacks today

Grepped from `wm-demo/wmdemo/server.py`'s live `/api/` route list — not a wishlist, the actual gap
a build has to close:

- **Terminals** — no model, no route, anywhere.
- **Transfers** — no create/accept concept; nothing moves inventory between locations over HTTP.
- **Members** — no account/loyalty lookup; `idv_*` tracks verification identity, not a customer.
- **Sales history (`listSales`)** — `POST /api/pos/sale` records one sale; there is no GET route
  that lists or queries completed sales. `/api/aov/stats` and `/api/aov/leaderboard` return
  aggregates, not line-level data this port's shape needs.

`HwposProvider` throws `PosError {code:'not_supported'}` for all five rather than faking a
response, and `capabilities()` reports the same five as `false`. This is the honest starting point
the cutover plan (§4 of BLAZE-DEPENDENCY-MAP.md) builds against.

`listProducts`/`listBatches` do work today, but only via `GET /api/state`'s `.catalog`/`.batches`
fields — there is no dedicated bulk-list route for either; that's a real API gap worth closing
before this provider is anything but a stopgap.

## Choosing a provider

```js
import { BlazeProvider } from './blaze.js';
import { HwposProvider } from './hwpos.js';

const provider = process.env.HW_POS_PROVIDER === 'hwpos'
  ? HwposProvider({ baseUrl: process.env.HWPOS_BASE_URL, token: process.env.HWPOS_TOKEN })
  : BlazeProvider({
      baseUrl: process.env.BLAZE_BASE_URL,
      partnerKey: process.env.BLAZE_PARTNER_KEY,
      authKey: process.env.BLAZE_AUTH_KEY_<STORE>,
    });
```

## Dual-run for cutover

Per `OWNER-NOTES.md` (2026-09-10): module by module, both providers running until each is proven.
Call both, compare, log differences — never switch a module's writes to `hwpos` until its reads
have matched Blaze for a real observation window:

```js
const [fromBlaze, fromHwpos] = await Promise.all([
  blaze.listProducts({ storeId }),
  hwpos.listProducts({ storeId }).catch((e) => (e.code === 'not_supported' ? [] : Promise.reject(e))),
]);
logDiff('listProducts', storeId, diffByKey(fromBlaze, fromHwpos, 'sku'));
// Blaze stays the only writer (createTransfer/acceptTransfer, member writes) until its module's
// dual-run window closes — see BLAZE-DEPENDENCY-MAP.md §4, migration order.
```
