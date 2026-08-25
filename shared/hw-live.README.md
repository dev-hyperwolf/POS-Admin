# `shared/hw-live.js` — running the design on real data

One file. It lets every POS screen render the real wm-demo estate **without a single
screen edit**, and it is inert everywhere except a loopback origin — so the public
GitHub Pages demo is byte-for-byte unaffected.

Loaded by `Hyperwolf POS.html` only, as the **first** script on the page.

---

## Run it live

```bash
# in /Users/jt/wm-demo — the API serves this design tree same-origin
export WM_DEMO_STATIC_DIR="/Users/jt/POS-Admin"
python3 -m wmdemo            # (however this estate normally starts it)
```

Then open **`http://127.0.0.1:8787/Hyperwolf%20POS.html`**.

Same-origin is the point: no CORS, and no Chrome private-network block on a
public page reaching localhost. A badge appears bottom-left, clear of the rail.

## Turn it off

| How | Effect |
|---|---|
| `?hwlive=off` on the URL | one page load |
| `HW_LIVE.disable()` in the console | sticky (localStorage), reloads |
| `HW_LIVE.enable()` | undoes the above |
| Open the page from anywhere that is not `localhost` / `127.0.0.1` / `[::1]` | never even fetches |
| Stop the API | falls back to mock silently, badge says *Mock data* |

`HW_LIVE.refresh()` re-fetches and re-renders in place. The badge panel has a
**Re-fetch /api/state** button that does the same thing.

---

## How it works (and why it is built this way)

`pos/data.jsx:322` assigns `window.HW` exactly once. `hw-live.js` installs an
accessor on `window.HW` **before** React loads, so it sees that assignment and
replaces the **contents** of the arrays already on it.

**It never reassigns `window.HW`.** Five modules bind `window.HW.fmt.money` at
module scope (`terminals/tdrawer.jsx:7`, `terminals/v2.jsx:7`,
`terminals/tshared.jsx:4`, `delivery/dapp.jsx:6`, `payflows/pay-core.jsx:4`);
a reassignment would leave all five formatting against a dead object and nothing
would throw. A repo-wide scan for module-level captures of any HW **array** found
none — every screen dereferences `window.HW.PRODUCTS` inside render — which is
what makes in-place replacement work with zero screen edits.

Ordering: the fetch starts before the ~5 MB of React + Babel download, so in
practice the payload lands well before `pos/data.jsx` executes and the very first
render is already live. For the cold-cache case where it does not, `hw-live.js`
wraps `ReactDOM.createRoot(...).render` to capture the root and re-renders it
once when the payload arrives. Timeout is 2.5 s, after which the app stays on mock.

## What is replaced

| `window.HW` | Source |
|---|---|
| `PRODUCTS` (contents) | `/api/state` → `catalog` + `stock` + `menu` + `mapping` |
| `REGIONS` (contents) | `regions` (slugs, title-cased; `west-la` → `West LA`) |
| `DRIVERS` (contents) | `regions[].drivers` + `on_shift` + `kits` + open orders |
| `FLEET_TOTAL` | driver count |
| `WM_LISTINGS.pickup.id` / `.delivery.id` | `wmids` |
| `STORE.count` | `pickup_locations.length` |

## The seven mismatches, and what the adapter does about each

1. **`external_id`** — the design renders `'HW-'+sku`; the real anchor is
   `hyperwolf:sku:'+sku` (`wmdemo/catalog.py:17`). The adapter writes the real one
   into `p.wm.ext`, so what an operator reads off the screen is what Weedmaps will
   actually find. It also cross-checks the live `menu` rows and reports any SKU
   published under a different `external_id`.
2. **The two listing ids were backwards.** Truth: pickup/dispensary `914117477`,
   delivery `342170487`. `342170912` does not exist anywhere. Both are read from
   `/api/state.wmids` — neither set is hardcoded here.
3. **THC** — the API stores a string. `'21%'` becomes the number `21`. `'100mg'`
   is a **dose**, not a percentage: it becomes `null`, because coercing it to `100`
   would put every gummy above the design's `thc >= 75` high-potency filter. The
   raw string is kept on `p.thcRaw`, and the badge panel names the affected rows.
4. **Sale was inverted.** API `price` is the *original*; `sale_pct` (1–99) derives
   the sale. Design `price` is what you pay and `was` is the crossed-out original.
   The adapter inverts it, mirroring `wmdemo/pricing.py:53-60` including its
   banker's rounding, so the screen and the register cannot disagree by a cent.
   ⚠️ **Untested against live data: no row in the DB carries `sale_pct` today**, so
   the Deals chip reads 0 and the sale path has only been exercised synthetically.
5. **`weight.value` is per unit**, `items_per_pack` is the multiplier — and it is
   null on 29 of 31 rows. The adapter prints exactly what the API stores and
   **flags** rows where the stored unit weight contradicts the product's own name,
   rather than silently printing `1g` on an eighth. Three rows are flagged today:
   - `BD-F-35G` — stores `1.0g` on a **3.5g** eighth.
   - `HD-FL-ZECLAIR-35` — stores `3.54g` on a 3.5g eighth (looks like a typo).
   - `HW-PR5-5PK` — a 5-pack with `items_per_pack: null`.
   The flags are in `p._weightNote` and in the badge panel. Nothing invents a pack
   weight the API does not have.
6. **Categories** — live `Flower, Pre Roll, Vape Pens, Edibles, Vapes, Concentrates`
   normalise onto the design's chips (`Pre Roll → Pre-Rolls`, `Vape Pens → Vapes`).
   **`Wellness` and `Deals` have no live analogue and are deliberately left
   unmapped**, so those chips count 0 and read as empty. Filling them with the
   nearest-looking category would be a lie an operator cannot see. Any live
   category with no mapping keeps its raw string, shows under **All** only, and is
   listed in the badge panel.
7. **Regions** — zero overlap with the design's Lake Elsinore / Wildomar / etc., so
   they are replaced outright.

## What stays mock — and why

`MEMBERS`, `CHECKINS`, `ORDERS`, `DELIVERY`, `IDV`, `STATS`, `WM_ORDER`,
`ORDER_BIND`, `REWARDS`, and every product's `cost` / `margin`.

- **Orders.** `/api/state.orders` has no line items and no item count, and 1 857 of
  the 3 252 rows are `CANCELED_SELLER` — a live board would be a wall of
  cancellations with a fabricated item count in each card. Wiring it needs an
  endpoint that returns order lines; until then the mock board is the honest choice.
  Consequence to expect: the delivery views group mock orders by mock zones, which
  no longer match the live regions, so **every live region column reads "No active
  orders"**. That is true — there are no live orders mapped to them.
- **`cost` / `margin`.** The API has no cost of goods at all. Dropping the margin
  columns would need screen edits, which this seam is forbidden, so the design's
  own deterministic `sku → margin` derivation is kept over the *live* price. The
  badge panel says so. **Do not read a business decision off a margin number here.**
- **`brand`.** `brand_name` is `null` on **31 of 31** live rows. `shared/brands.js`
  is the one brand DB and inventing a vendor here would start a second one, so the
  Brand column renders blank. That is a real gap in the API payload, not a bug here.
- **Driver load.** The API models a driver as a *pool member with a kit*, not a
  routed vehicle: there is no stop list and no capacity anywhere in `/api/state`.
  `stops` and `cap` are `null`, so the load meter reads empty and the counter reads
  `/`. The raw `IN_PROGRESS` count per driver **is** available and is exposed on
  `d.openOrders`, but it is in the four figures on this probe-hammered DB, so
  rendering it as "stops" would be a true number that means nothing. If the API ever
  exposes a route, set `stops`/`cap` in `adaptRegionsAndDrivers()` and nothing else
  has to change.

## The badge

Bottom-left, clear of the 74 px rail and of the app-switcher / tour launcher in the
bottom-right gutter. Green dot = live, grey = mock, amber = still checking. Click it
for the full mapping report: counts, unmapped categories, flagged weights, what is
still mock, and a re-fetch button.

Every colour comes from `pos/tokens.jsx` via `window.THEMES` — **there is not one
hex literal in `hw-live.js`**, and if tokens are absent the badge simply does not
render rather than invent a colour. It repaints on theme change by observing
`document.body`'s style attribute, which is the only signal `tokens.jsx` emits.

The badge appears **only on a loopback origin**, live or mock. On GitHub Pages the
whole module is inert, so the public demo gains no new chrome.

## Public surface

```js
HW_LIVE.status    // 'off' | 'pending' | 'live' | 'unreachable' | 'timeout'
HW_LIVE.report    // the full mapping report the panel renders
HW_LIVE.base      // the origin it fetched (loopback only, always)
HW_LIVE.refresh() // re-fetch + re-render in place -> Promise<status>
HW_LIVE.disable() / HW_LIVE.enable()
```

`?hwlive=<origin>` overrides the base **only if that origin is itself loopback** —
otherwise a crafted link could point a viewer's page at an arbitrary host and have
it render whatever came back as the operator's own catalogue.
