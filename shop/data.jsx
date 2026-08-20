// ── Hyperwolf storefront — the shop's own data, and the ONE cart ───────────
//
// WHAT LIVES HERE, AND WHAT DELIBERATELY DOES NOT.
//
// Here: the signed-in customer, their past orders, the merchandising rails,
// the category list, the brand spotlight, and the cart store.
//
// NOT here: the catalogue (that is `window.HW.PRODUCTS` and there is only one
// of it) and money (that is `window.HWCommerce.computeCartTotals`, reached
// through `SHOP.totals()`, and there is only one of that either). Two money
// authorities on one screen is a bug this project has already shipped and
// reverted — so this file computes NO totals, NO fees, NO tax, and no lane
// minimum. It assembles the engine's context and hands the answer back.

const _SD_E = () => (typeof window !== 'undefined' && window.HWCommerce) || null;
const _SD_SWAP = () => (typeof window !== 'undefined' && window.HWSwap) || null;

// ── The signed-in customer ────────────────────────────────────────────────
// Read off the web home frame (node 1912-39178): "Good afternoon, Marcus." and
// "DELIVER TO / Long Beach · 90804".
//
// ⚠️ `regionId` is the VAN that serves this address, and Long Beach is not one
// of `window.DDATA.SUBREGIONS` — the nearest LA-county van is LA-01 (Pomona).
// That mismatch is a data gap in the estate, not a decision this screen is
// entitled to make, so it is named here rather than buried in a lookup.
const SHOP_CUSTOMER = {
  id: 'c-marcus',
  name: 'Marcus Webb',
  first: 'Marcus',
  zone: { city: 'Long Beach', zip: '90804', regionId: 'LA-01' },
  // What the ENGINE is told about him. `orderCount` > 0 is a fact of the past
  // orders below, so WELCOME20 (first-order-only) correctly does not apply.
  engine: { id: 'c-marcus', loyaltyTier: 'Wolfpack', orderCount: 2 },
};

// ── Store hours ───────────────────────────────────────────────────────────
// The frames show a single "● OPEN" pill. LA county trades 9:00a–11:00p
// (`window.DDATA.COUNTIES` → LA settings), which is where these come from
// rather than from a literal typed here.
function shopOpenState(now) {
  const D = typeof window !== 'undefined' && window.DDATA;
  const county = D && D.COUNTY_BY_ID && D.COUNTY_BY_ID.LA;
  const hours = county ? county.settings : null;
  const h = (now || new Date()).getHours();
  // 9a–11p in 24h. Parsed from the settings string so a change to the region
  // table moves the pill, instead of the pill quietly disagreeing with it.
  const parse = (s, dflt) => {
    const m = String(s || '').match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])/i);
    if (!m) return dflt;
    let hh = +m[1] % 12;
    if (m[3].toLowerCase() === 'p') hh += 12;
    return hh;
  };
  const open = parse(hours && hours.open, 9);
  const close = parse(hours && hours.close, 23);
  const isOpen = h >= open && h < close;
  return { open: isOpen, label: isOpen ? 'OPEN' : 'CLOSED', opensAt: open, closesAt: close };
}

// ── Express eligibility, per product ──────────────────────────────────────
//
// The desktop shop grid puts a ⚡ EXPRESS badge on each product card, so this
// is a per-PRODUCT fact and has to come from real stock.
//
// Express is the driver's kit (`defaultLanes.express.stockPool === 'driver_kit'`),
// and this estate already models a van kit: `window.DDATA.REGION_STOCK[regionId]
// .units[sku]`. A product is express-eligible when the van serving the
// customer's zone is carrying at least one of it today.
//
// FALLBACK, and why it is not silent: when `delivery/ddata.jsx` has not loaded
// there is no kit at all, and the honest answer is "nothing is express" — NOT
// "everything is", which is what a `p.qty > 0` fallback would say. `qty` is
// warehouse on-hand; it is the scheduled pool, not the van.
function expressUnits(sku) {
  const D = typeof window !== 'undefined' && window.DDATA;
  if (!D || typeof D.stockFor !== 'function') return 0;
  const kit = D.stockFor(SHOP_CUSTOMER.zone.regionId);
  if (!kit || !kit.units) return 0;
  return kit.units[sku] || 0;
}
function isExpress(sku) { return expressUnits(sku) > 0; }

/** The lane an "add to cart" lands in: express when the van has it, else scheduled. */
function defaultLaneFor(sku) { return isExpress(sku) ? 'express' : 'scheduled'; }

// ── Catalogue helpers ─────────────────────────────────────────────────────
function allProducts() {
  return (typeof window !== 'undefined' && window.HW && window.HW.PRODUCTS) || [];
}
function productBySku(sku) { return allProducts().find((p) => p.sku === sku) || null; }

// ── Categories (left sidebar) ─────────────────────────────────────────────
// The frame shows All / Deals / Flower / Pre-rolls / Edibles with a coloured
// icon each — a TRUNCATED list, because the sidebar carries a collapse control
// and the frame does not scroll. The estate sells seven categories
// (`window.HW.CATS`), so all seven are rendered in the frame's order, with the
// four it named first.
const SHOP_CAT_ORDER = ['Deals', 'Flower', 'Pre-Rolls', 'Edibles', 'Vapes', 'Concentrates', 'Wellness'];
// category → the `P.cat` token key. Colour NEVER comes from HW.CAT_COLOR here:
// that map holds hex literals, and a screen reads tokens.
const SHOP_CAT_TOKEN = {
  All: 'other', Deals: 'deals', Flower: 'flower', 'Pre-Rolls': 'preroll',
  Edibles: 'edibles', Vapes: 'vape', Concentrates: 'concentrate', Wellness: 'wellness',
};
const SHOP_CAT_ICON = {
  All: 'grid', Deals: 'tag', Flower: 'leaf', 'Pre-Rolls': 'scroll',
  Edibles: 'gift', Vapes: 'zap', Concentrates: 'sparkle', Wellness: 'shield',
};
function shopCategories() {
  const cats = (typeof window !== 'undefined' && window.HW && window.HW.CATS) || [];
  const ordered = SHOP_CAT_ORDER.filter((c) => cats.indexOf(c) >= 0)
    .concat(cats.filter((c) => SHOP_CAT_ORDER.indexOf(c) < 0));
  return [{ id: 'All', label: 'All' }].concat(ordered.map((c) => ({ id: c, label: c })));
}
function productsInCategory(cat) {
  const all = allProducts();
  if (!cat || cat === 'All') return all;
  // "Deals" is not a `cat` on any product — it is the marked-down set, which is
  // exactly how `window.HW.catCount` counts it. Same definition, one place.
  if (cat === 'Deals') return all.filter((p) => p.was != null);
  return all.filter((p) => p.cat === cat);
}

// ── Merchandising rails ───────────────────────────────────────────────────
//
// Five rails, named on the desktop shop frame: Fresh Drops · On Sale · Staff
// Picks · Best Sellers · New Arrivals.
//
// ⚠️ ONLY ONE OF THEM IS DERIVABLE. `On Sale` is `p.was != null` — a real field.
// The catalogue carries no first-seen date and no units-sold, so recency and
// popularity CANNOT be computed from it, and a hash dressed up as a "best
// seller" would be a fabricated fact on a customer-facing screen. Membership of
// the other four is therefore an editorial list, which is what merchandising
// actually is, and it is written down here where a merchandiser can see it.
const SHOP_RAILS = [
  { id: 'fresh', label: 'Fresh Drops', token: 'wellness',
    skus: ['FFF81Q98', 'GBZ35RR', 'STG1BAD', 'MMG100E'] },
  { id: 'sale', label: 'On Sale', token: 'deals', derived: 'markdown' },
  { id: 'staff', label: 'Staff Picks', token: 'premium',
    skus: ['FCF1LRS', 'LDI4DRP', 'FP94AIO', 'BOF35SM'] },
  { id: 'best', label: 'Best Sellers', token: 'vape',
    skus: ['CHP1GPR', 'GNJ1123', 'H480PRO1', 'NCO28SM'] },
  { id: 'new', label: 'New Arrivals', token: 'edibles',
    skus: ['DBL78MG', 'BBH2JNT', '984X9CJO', 'ARCH001'] },
];
function railProducts(railId) {
  const rail = SHOP_RAILS.find((r) => r.id === railId);
  if (!rail) return [];
  if (rail.derived === 'markdown') return allProducts().filter((p) => p.was != null);
  return rail.skus.map(productBySku).filter(Boolean);
}

// ── Brand spotlight ───────────────────────────────────────────────────────
//
// The frame spotlights "Pacific Stone - 15% off / HUMBOLDT-GROWN · READY ~90M".
// Neither the brand nor the "Humboldt-grown" descriptor exists in
// `shared/brands.js`, and inventing a 15%-off promotion would put a discount on
// screen that the cart would then refuse to honour.
//
// So the SHAPE is the frame's and the CONTENT is real: the spotlight goes to the
// brand carrying the deepest genuine markdown in the catalogue, the offer line
// is that markdown, and "READY ~90M" is the engine's own express ETA.
/**
 * ⚙️ TUNE — the deepest markdown the storefront will ADVERTISE, as a percentage.
 *
 * 🔴 WHY THIS EXISTS. The spotlight picks the brand with the deepest markdown in
 * the catalogue and prints it. A reviewer read the rendered DOM and found the
 * shop advertising "Connected / Up to 97% off" TO CUSTOMERS. Nothing was wrong
 * with the arithmetic — one item really was marked down 97% — but a single
 * clearance or mispriced SKU was speaking for an entire brand, and a 97%
 * headline reads as a pricing error to anyone who sees it, because usually it
 * is one.
 *
 * The design draws "Pacific Stone - 15% off", so a plausible brand promotion is
 * what this card is for. Anything past this threshold is treated as a DATA
 * ARTEFACT and that brand is skipped rather than advertised.
 *
 * This is a merchandising decision, not an engineering one — the same call as
 * `similarPriceBand` in the engine. The default is deliberately conservative
 * and should be confirmed by whoever owns pricing. See docs/OPEN-QUESTIONS.md.
 */
const SPOTLIGHT_MAX_PCT = 60;
let _spotlightSkipped = [];

function brandSpotlight() {
  const best = new Map();
  const skipped = [];
  for (const p of allProducts()) {
    if (p.was == null || !(p.was > p.price)) continue;
    const pct = Math.round(((p.was - p.price) / p.was) * 100);
    // An implausible markdown is a data-quality signal, not a promotion. Skip
    // the ITEM, not the brand — a brand with one bad row and ten sane ones can
    // still be spotlighted on the sane ones.
    if (pct > SPOTLIGHT_MAX_PCT) { skipped.push({ sku: p.sku, brand: p.brand, pct }); continue; }
    const cur = best.get(p.brand);
    if (!cur || pct > cur.pct) best.set(p.brand, { pct, product: p });
  }
  // Kept rather than swallowed: a storefront quietly hiding catalogue rows is
  // how a mispriced SKU survives for weeks. Readable at SHOPDATA.spotlightSkipped().
  _spotlightSkipped = skipped;
  let top = null;
  for (const [brand, v] of best) {
    // Ties break on brand name so the card does not move between renders.
    if (!top || v.pct > top.pct || (v.pct === top.pct && brand < top.brand)) {
      top = { brand, pct: v.pct, product: v.product };
    }
  }
  if (!top) return null;
  const items = allProducts().filter((p) => p.brand === top.brand);
  const B = (typeof window !== 'undefined' && window.HW_BRANDS) || null;
  const meta = B && B.byName ? B.byName[top.brand] : null;
  return {
    brand: top.brand,
    offer: 'Up to ' + top.pct + '% off',
    // The brand's own category, from the one brand DB. No invented provenance.
    kicker: (meta && meta.category) || '',
    etaMinutes: expressEtaMinutes(),
    expressCount: items.filter((p) => isExpress(p.sku)).length,
    itemCount: items.length,
  };
}

/** The express ETA, from the engine's lane config — never a literal "90". */
function expressEtaMinutes() {
  const E = _SD_E();
  const lane = E && E.defaultLanes && E.defaultLanes.express;
  return (lane && lane.etaMinutes) || null;
}

// ── Past orders — what the REORDER card is built from ─────────────────────
//
// A reorder card shows what the customer PAID, not what the item costs today.
// So each line carries the price it was bought at, and the card's figure is the
// sum of those. There is no hand-typed order total anywhere: a total that is
// typed separately from its lines is a total that will eventually disagree with
// them.
//
// The frames name "Blue Dream 3.5g" and "Sticky Rice Quarter". Neither product
// exists in `window.HW.PRODUCTS`, and mirroring a second catalogue to obtain
// them is the one thing this file must not do — so these reference real skus.
// The demo fixture records each line at the catalogue's current price, which is
// the only price this estate knows.
function _pastOrder(id, daysAgo, lines) {
  const S = _SD_SWAP();
  const built = lines.map((l) => {
    const p = productBySku(l.sku);
    if (!p) return null;
    // Dollars → integer cents happens in the ADAPTER and nowhere else. A second
    // `* 100` in a screen is how two money authorities start.
    const ep = S ? S.toEngineProduct(p) : null;
    return { sku: l.sku, qty: l.qty, product: p, paidCents: ep ? ep.price : null };
  }).filter(Boolean);
  const priced = built.every((l) => l.paidCents != null);
  return {
    id, daysAgo, lines: built,
    // null, not 0, when the adapter is absent: "we don't know" must not render
    // as "$0.00".
    totalCents: priced ? built.reduce((s, l) => s + l.paidCents * l.qty, 0) : null,
    title: built.length
      ? built[0].product.name + (built[0].product.wt ? ' ' + built[0].product.wt : '')
        + (built.length > 1 ? ' + ' + (built.length - 1) + ' more' : '')
      : '',
  };
}
function pastOrders() {
  return [
    _pastOrder('o-usual', 11, [
      { sku: 'FFF81Q98', qty: 1 }, { sku: 'MMG100E', qty: 1 }, { sku: 'CHP1GPR', qty: 2 },
    ]),
    _pastOrder('o-prev', 12, [
      { sku: 'NCO28SM', qty: 1 }, { sku: 'LDI4DRP', qty: 1 }, { sku: 'FP94AIO', qty: 1 },
    ]),
  ];
}

// ── The cart ──────────────────────────────────────────────────────────────
//
// One line per (sku, lane): the same product can legitimately sit in both lanes
// — "Move to Scheduled" on the cart frame moves ONE line, not the product.
const _shopListeners = new Set();
const _shopEmit = () => _shopListeners.forEach((fn) => fn());
let _shopSeq = 0;
const _SHOP = {
  tab: 'home',              // home | shop | cart | checkout
  category: 'All',
  rail: null,               // active merchandising rail id, or null
  query: '',
  lines: [],                // [{ id, sku, qty, lane }]
  menuOpen: false,
  toast: null,
};

function _findLine(sku, lane) { return _SHOP.lines.find((l) => l.sku === sku && l.lane === lane) || null; }

function shopAdd(sku, qty, lane) {
  const p = productBySku(sku);
  if (!p) return null;                       // never hold a line for a sku the store does not sell
  const n = Math.max(1, qty || 1);
  const ln = lane || defaultLaneFor(sku);
  const existing = _findLine(sku, ln);
  if (existing) { existing.qty += n; } else {
    _SHOP.lines = _SHOP.lines.concat([{ id: 'sl' + (++_shopSeq), sku, qty: n, lane: ln }]);
  }
  _shopEmit();
  return _findLine(sku, ln);
}

/** Add every line of a past order. Returns how many lines actually landed. */
function shopAddAll(order) {
  const lines = (order && order.lines) || [];
  let added = 0;
  for (const l of lines) { if (shopAdd(l.sku, l.qty)) added++; }
  return added;
}

function shopSetQty(lineId, qty) {
  const l = _SHOP.lines.find((x) => x.id === lineId);
  if (!l) return false;
  if (qty <= 0) return shopRemove(lineId);
  l.qty = qty; _shopEmit(); return true;
}
function shopRemove(lineId) {
  const before = _SHOP.lines.length;
  _SHOP.lines = _SHOP.lines.filter((l) => l.id !== lineId);
  if (_SHOP.lines.length === before) return false;
  _shopEmit(); return true;
}
/** Move ONE line to the other lane, merging if that lane already holds the sku. */
function shopSetLane(lineId, lane) {
  const l = _SHOP.lines.find((x) => x.id === lineId);
  if (!l || l.lane === lane) return false;
  const target = _findLine(l.sku, lane);
  if (target) { target.qty += l.qty; _SHOP.lines = _SHOP.lines.filter((x) => x.id !== l.id); }
  else { l.lane = lane; }
  _shopEmit(); return true;
}
function shopClear() { _SHOP.lines = []; _shopEmit(); }

function shopItemCount() { return _SHOP.lines.reduce((s, l) => s + l.qty, 0); }

// ── The engine bridge ─────────────────────────────────────────────────────
//
// `HWSwap.buildContext` assembles the snapshot, availability, customer affinity
// and lane config from this estate's shapes — that mapping belongs to the
// adapter and is not repeated here. It assigns ONE lane to every line, though,
// because the POS has one; this cart has a lane per line, so the lines are
// replaced afterwards. (`toEngineProduct` sets `id = p.id || p.sku`, and
// `pos/data.jsx` sets `id: sku`, so the engine's productId IS the sku.)
function shopContext(now) {
  const S = _SD_SWAP();
  if (!S) return null;                       // engine absent → caller falls back
  const ctx = S.buildContext({
    catalogue: allProducts(),
    orderItems: _SHOP.lines.map((l) => ({ sku: l.sku, qty: l.qty })),
    customer: SHOP_CUSTOMER.engine,
    now: now || new Date(),
  });
  if (!ctx) return null;
  ctx.cart.lines = _SHOP.lines.map((l) => ({
    id: l.id, productId: l.sku, quantity: l.qty, lane: l.lane,
  }));
  // The operator's lane economics, set in POS settings, override the engine's
  // shipped defaults. buildContext assembles lanes from `defaultLanes`, so this
  // has to be applied AFTER it — and it is applied to the context rather than
  // to any screen, so every figure downstream (the minimum bar, the fee rows,
  // the tax base, the total) moves together from one source.
  const LS = window.HW && window.HW.laneSettings ? window.HW.laneSettings() : null;
  if (LS && ctx.lanes) {
    if (ctx.lanes.express) {
      ctx.lanes.express.minimumCents = Math.round(LS.expressMinimum * 100);
      ctx.lanes.express.feeCents = Math.round(LS.expressFee * 100);
    }
    if (ctx.lanes.scheduled) {
      ctx.lanes.scheduled.minimumCents = Math.round(LS.scheduledMinimum * 100);
      ctx.lanes.scheduled.feeCents = Math.round(LS.scheduledFee * 100);
    }
  }
  return ctx;
}

/**
 * THE cart totals. Every money figure on every storefront screen comes from
 * here — lane subtotals, the minimum progress bar, per-lane fees, tax, total.
 * Returns null when the engine has not loaded, so a caller renders an honest
 * "unavailable" rather than a wrong number.
 */
/**
 * 🔴 THE ESTATE'S TAX FUNCTION, HANDED TO THE ENGINE.
 *
 * The owner's instruction, verbatim: "the total needs to fully update when an
 * adjustment is made - no exceptions. This needs to be bulletproof" — and, on
 * how tax should be computed, "give the engine our tax function".
 *
 * Without this the storefront quotes the engine's BUILT-IN flat rate (10.25%)
 * while every other surface in the estate itemises `HW.taxBreakdown` (local +
 * excise + sales, ~23.22% on the same base). Measured by a reviewer: the same
 * cart was quoted to the customer at one figure and re-priced about 10% higher
 * the moment the order was opened in the POS. That is two money authorities —
 * the exact bug this project has already shipped and reverted once — just
 * spread across two surfaces instead of sitting on one screen.
 *
 * `taxBreakdown` works in DOLLARS; the engine works in integer cents. Same
 * bridge as `estateTax()` in shared/commerce-governance.js — deliberately the
 * same shape, so the two cannot drift.
 */
function shopEstateTax() {
  const hw = window.HW;
  if (!hw || typeof hw.taxBreakdown !== 'function') return undefined;
  return function (taxableBaseCents) {
    return Math.round(hw.taxBreakdown((taxableBaseCents || 0) / 100).total * 100);
  };
}

/**
 * THE options every storefront pricing call uses. Exposed rather than inlined so
 * that nothing — including a test — can price this cart with a DIFFERENT option
 * set and still believe it is comparing like with like. A test that rebuilt
 * these by hand went stale the moment `computeTax` was added, and reported a
 * second money authority that did not exist.
 */
function shopEngineOptions() {
  const E = _SD_E();
  return {
    rules: (E && E.BUILTIN_RULES) || [],
    // Omitting this is what made the storefront quote a different tax from the
    // rest of the estate. `undefined` means "not supplied", which is what
    // computeCartTotals already expects — it then falls back to its own rate.
    computeTax: shopEstateTax(),
  };
}

function shopTotals(now) {
  const E = _SD_E();
  const ctx = shopContext(now);
  if (!E || !ctx) return null;
  try {
    return E.computeCartTotals(ctx, shopEngineOptions());
  } catch (err) { return null; }
}

/** `money()` is the engine's formatter. The storefront never rolls its own. */
function shopMoney(cents) {
  const E = _SD_E();
  if (cents == null || !E || !E.money) return '—';
  return E.money(cents);
}

// ── Screen registry ───────────────────────────────────────────────────────
//
// The shell resolves a tab to a component through this, falling back to a
// conventional global. Cart and checkout are built in parallel by another
// agent; this is the seam, so neither side has to edit the other's file.
const SHOP_SCREEN_GLOBAL = {
  home: 'ShopHomeScreen', shop: 'ShopShopScreen',
  cart: 'ShopCartScreen', checkout: 'ShopCheckoutScreen',
};
const SHOP_SCREENS = {};
function shopScreenFor(tab) {
  if (typeof SHOP_SCREENS[tab] === 'function') return SHOP_SCREENS[tab];
  const g = SHOP_SCREEN_GLOBAL[tab];
  return g && typeof window[g] === 'function' ? window[g] : null;
}

window.SHOPDATA = {
  CUSTOMER: SHOP_CUSTOMER,
  RAILS: SHOP_RAILS,
  CAT_TOKEN: SHOP_CAT_TOKEN,
  CAT_ICON: SHOP_CAT_ICON,
  SCREENS: SHOP_SCREENS,
  SCREEN_GLOBAL: SHOP_SCREEN_GLOBAL,
  openState: shopOpenState,
  expressUnits, isExpress, defaultLaneFor,
  allProducts, productBySku, categories: shopCategories, productsInCategory,
  railProducts, brandSpotlight, expressEtaMinutes, pastOrders,
  screenFor: shopScreenFor,
};

window.SHOP = {
  s: _SHOP,
  subscribe(fn) { _shopListeners.add(fn); return () => _shopListeners.delete(fn); },
  go(tab) { _SHOP.tab = tab; _SHOP.menuOpen = false; _shopEmit(); },
  setCategory(c) { _SHOP.category = c; _SHOP.rail = null; _shopEmit(); },
  setRail(r) { _SHOP.rail = _SHOP.rail === r ? null : r; _shopEmit(); },
  setQuery(q) { _SHOP.query = q; _shopEmit(); },
  toggleMenu() { _SHOP.menuOpen = !_SHOP.menuOpen; _shopEmit(); },
  toast(msg) { _SHOP.toast = msg; _shopEmit(); },
  clearToast() { _SHOP.toast = null; _shopEmit(); },
  add: shopAdd, addAll: shopAddAll, setQty: shopSetQty, remove: shopRemove,
  setLane: shopSetLane, clear: shopClear,
  lines: () => _SHOP.lines,
  itemCount: shopItemCount,
  context: shopContext, totals: shopTotals, money: shopMoney, engineOptions: shopEngineOptions,
  spotlightSkipped: () => _spotlightSkipped.slice(), SPOTLIGHT_MAX_PCT,
};

// Re-render on any write, the same contract as `window.useHW`.
window.useShop = function useShop() {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => window.SHOP.subscribe(force), []);
  return window.SHOP;
};
