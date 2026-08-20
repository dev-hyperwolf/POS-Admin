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
  //
  // 🔴 `loyaltyTier` READ 'Wolfpack', WHICH IS NOT A TIER ANYTHING RECOGNISES.
  // The one tier gate in the estate is `user_loyalty_tier: ["Wolfpack Leader"]`
  // (the `wolfpack-10` rule, shared/commerce-engine.js). A tier string is matched
  // by EXACT equality, so 'Wolfpack' silently qualified this customer for
  // nothing — no error, no unapplied-rule notice, just a discount that never
  // appeared and a fixture that looked like it exercised the tier path.
  //
  // A near-miss string is worse than an obviously absent one, because it reads
  // as intentional. `test/shop-van-promise.test.mjs` now pins this against the
  // engine's own rule set, so the next near-miss fails instead of going quiet.
  engine: { id: 'c-marcus', loyaltyTier: 'Wolfpack Leader', orderCount: 2 },
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

/**
 * 🔴 EXPRESS IS A PROMISE ABOUT ONE VAN, AND A VAN HAS A DEPTH.
 *
 * `isExpress` answers "is the driver carrying this at all" — a per-PRODUCT fact,
 * and the right one for the ⚡ badge on a grid card. It is the WRONG question for
 * a cart, because it collapses `units` to a boolean: a van carrying 5 of a sku
 * answered "yes" to a cart holding 99 of it, and the storefront then promised
 * ~90 minutes for 94 units no driver had.
 *
 * This is how many MORE units of `sku` the express lane could still take: the
 * van's depth, less whatever the express lane is already holding. It is the one
 * number every express decision on this storefront is made from — `shopAdd`,
 * `shopSetQty` and `shopSetLane` all ask it, and so does the cart screen when it
 * decides whether "Move to Express" is a promise it can keep.
 *
 * ⚠️ TONE. A shortfall here is never a refusal. The overflow ARRIVES TOMORROW —
 * it is a lane change, not an out-of-stock, and every surface that reads this
 * must say so in those terms. `qty` (warehouse on-hand) is untouched by any of
 * this; the scheduled lane is served from the warehouse and can take the rest.
 */
function expressHeadroom(sku) {
  const held = _findLine(sku, 'express');
  return Math.max(0, expressUnits(sku) - (held ? held.qty : 0));
}

/**
 * What `shopAdd(sku, qty)` would ACTUALLY do, before it does it. Pure.
 *
 * Exposed so a screen can tell the customer the truth in the same breath as the
 * add — a toast that names the lane it BELIEVES the item went to, computed
 * independently, is the second authority this file exists to prevent.
 */
function shopAddPlan(sku, qty, lane) {
  const n = Math.max(1, qty || 1);
  const ln = lane || (isExpress(sku) ? 'express' : 'scheduled');
  if (ln !== 'express') return { express: 0, scheduled: n, lane: ln, capped: false };
  const express = Math.min(n, expressHeadroom(sku));
  return { express, scheduled: n - express, lane: express > 0 ? 'express' : 'scheduled',
    capped: express < n };
}

/**
 * The lane an "add to cart" lands in.
 *
 * ⚠️ CART-DEPENDENT, deliberately. It was `isExpress(sku)`, which is a fact
 * about the van and not about this add: once the express lane already holds the
 * van's whole depth, the NEXT unit lands scheduled, and a card that still
 * announced "Express" would be describing something that did not happen.
 */
function defaultLaneFor(sku) { return expressHeadroom(sku) > 0 ? 'express' : 'scheduled'; }

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

// ── WHAT MARKETING PICKED — the one seam this storefront reads ─────────────
//
// 🔴 THE STOREFRONT NO LONGER DERIVES ITS OWN MERCHANDISING. It reads what a
// marketer put on the surface, through `window.HWMerch` and nothing else.
//
// The incident this replaces: `brandSpotlight()` used to scan the catalogue for
// the deepest markdown and print it, and the shop advertised
// "Connected — Up to 97% off" to customers. Nothing was wrong with the
// arithmetic. The wrong part was that NOBODY DECIDED IT. A screen that composes
// its own claims will eventually compose one no human would have signed.
//
// So: a live pick renders, and when there is no live pick the HOUSE CARD renders
// — never the derivation. The owner was explicit about that, and the reason is
// that a silent fall-back to "deepest markdown" reinstates the incident the
// first time somebody forgets to schedule a slot.
//
// ⚠️ EVERY READ GOES THROUGH HWMerch. Not localStorage, not a copy of the store,
// not a cached snapshot. The owner chose "browser storage for now" AND "decide
// later — build behind one seam"; a screen that reaches around the seam is what
// turns "decide later" into "decided by accident".

/** The HWMerch seam, or null when it did not load. `null`, not `{}`: a stub
 *  would make an unloaded seam look like an empty schedule, and those are very
 *  different facts. */
function shopMerch() {
  return (typeof window !== 'undefined' && window.HWMerch) || null;
}
function shopMerchIsDemo() {
  const M = shopMerch();
  return !!(M && typeof M.isDemoStorage === 'function' && M.isDemoStorage());
}

/**
 * WHICH REGION THIS SHOPPER IS IN.
 *
 * The delivery zone is already known (`SHOP_CUSTOMER.zone`), so this maps the
 * city onto HWMerch's own region vocabulary rather than inventing a second one:
 * "Long Beach" → `long-beach`. A city HWMerch does not know returns `'all'`,
 * which is the default set — and `HWMerch.live()` also falls back to `'all'` on
 * its own, so an unresolvable region degrades to the default in both directions
 * instead of rendering nothing.
 *
 * ⚠️ NOT `zone.regionId`. That is the VAN (`LA-01`, a Pomona van serving Long
 * Beach) and it is a delivery fact, not a marketing region. Feeding it in here
 * would look right and match nothing.
 */
function shopRegionId() {
  const M = shopMerch();
  const known = (M && M.REGIONS) || [];
  const slug = String((SHOP_CUSTOMER.zone && SHOP_CUSTOMER.zone.city) || '')
    .trim().toLowerCase().replace(/\s+/g, '-');
  return known.indexOf(slug) >= 0 ? slug : 'all';
}

/**
 * ⚙️ THE CLAIM CEILING — the deepest discount this storefront will ADVERTISE.
 *
 * Owned by whoever owns pricing, and it is a SETTING, sitting beside the lane
 * minimums in POS settings. It is read from there when it exists and falls back
 * to `SPOTLIGHT_MAX_PCT` when it does not, so this file works either side of
 * that settings change landing.
 *
 * ⚠️ THE KEY NAME IS NOT AGREED YET. The setting is being added in
 * `pos/data.jsx`, which this agent does not own, so the candidates below are
 * tried in order. That is a coordination gap written down rather than a guess
 * hidden in one identifier: when the real key lands, delete the others.
 */
const SHOP_CLAIM_CEILING_KEYS = ['claimCeilingPct', 'claimCeiling', 'maxAdvertisedDiscountPct', 'maxClaimPct'];
function shopClaimCeilingPct() {
  const HW = (typeof window !== 'undefined' && window.HW) || null;
  const s = HW && typeof HW.laneSettings === 'function' ? HW.laneSettings() : null;
  if (s) {
    for (const k of SHOP_CLAIM_CEILING_KEYS) {
      const v = Number(s[k]);
      if (Number.isFinite(v) && v > 0) return v;
    }
  }
  return SPOTLIGHT_MAX_PCT;
}

/**
 * Does every percentage in this copy sit inside the ceiling?
 *
 * 🔴 REFUSE, NEVER CLAMP. Rewriting "Up to 97% off" as "Up to 60% off" would put
 * a discount on screen that nobody chose and the cart would not honour — a
 * second fabricated claim replacing the first. An over-ceiling claim is dropped
 * and recorded, and the house card takes the slot.
 */
function shopClaimWithin(text, ceiling) {
  const found = String(text == null ? '' : text).match(/(\d+(?:\.\d+)?)\s*%/g);
  if (!found) return true;
  return found.every((m) => parseFloat(m) <= ceiling);
}

/** Every string on a card that a shopper could read a claim off. */
function shopMerchCopy(item) {
  return [item && item.headline, item && item.offer, item && item.kicker,
    item && item.label, item && item.sub];
}

/**
 * WHY THIS ITEM CANNOT BE SHOWN TO THIS VISITOR, or null when it can.
 *
 * Eligibility is checked against things that actually exist, never invented:
 *  · a card naming a `sku` needs that sku in the one catalogue;
 *  · a card naming a `brand` needs that brand to be carried;
 *  · a card marked `expressOnly` needs the van serving this shopper's zone to be
 *    carrying it — express is a promise about ONE van, and a card promising
 *    express on a sku the van has none of is the shop lying about stock.
 * A card that names no catalogue object at all is pure copy and is eligible.
 */
function shopMerchWhyNot(item) {
  if (!item || typeof item !== 'object') return 'not-an-item';
  const ceiling = shopClaimCeilingPct();
  if (!shopMerchCopy(item).every((t) => shopClaimWithin(t, ceiling))) return 'claim-over-ceiling';
  if (item.sku) {
    if (!productBySku(item.sku)) return 'sku-not-in-catalogue';
    if (item.expressOnly && !isExpress(item.sku)) return 'not-express-for-this-van';
    return null;
  }
  if (item.brand) {
    const carried = allProducts().filter((p) => p.brand === item.brand);
    if (!carried.length) return 'brand-not-carried';
    if (item.expressOnly && !carried.some((p) => isExpress(p.sku))) return 'not-express-for-this-van';
    return null;
  }
  return null;
}

/* Refusals are KEPT, not swallowed. A storefront that quietly drops a scheduled
 * card looks identical to a storefront with nothing scheduled, and a marketer
 * would spend a week wondering why their slot is empty. Keyed by surface so the
 * list is bounded by the surface count rather than growing per render. */
let _shopMerchRefusals = {};
function shopMerchRefusals() {
  const out = [];
  for (const k of Object.keys(_shopMerchRefusals)) out.push(..._shopMerchRefusals[k]);
  return out;
}

/* ── The draw ───────────────────────────────────────────────────────────────
 *
 * ⚠️ CAROUSEL AND WEIGHTED ARE DIFFERENT MECHANISMS.
 *   carousel — everyone sees ALL of them, in the stored order.
 *   weighted — each visitor sees ONE, split by share of voice.
 * Conflating them is a silent wrong answer: a weighted set rendered as a
 * carousel gives every item 100% of the slot, and nobody would see an error.
 */

/** FNV-1a. A stable small hash so the draw is deterministic per visitor: the
 *  card must not flip on every re-render, which is both unreadable and would
 *  make any share-of-voice measurement meaningless. */
function shopHash32(s) {
  let h = 2166136261;
  const str = String(s);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** Walk the stored order against a roll of 0–99. Pure, and exported, so the
 *  share split can be asserted exactly instead of sampled. */
function shopMerchDrawAt(items, roll) {
  if (!Array.isArray(items) || !items.length) return null;
  let acc = 0;
  for (const it of items) {
    acc += Number(it && it.share) || 0;
    if (roll < acc) return it;
  }
  return null;
}
function shopMerchDraw(items, seed) {
  return shopMerchDrawAt(items, shopHash32(seed) % 100);
}
/** THE SEED IS THE VISITOR, THE SURFACE AND THE REGION — and nothing else. Not
 *  the time and not a counter: a card that changes on every re-render is
 *  unreadable, and it would make any share-of-voice figure a marketer reads back
 *  meaningless, because no visitor would have had a stable exposure. */
function shopMerchSeed(surfaceId, region) {
  return SHOP_CUSTOMER.id + '|' + surfaceId + '|' + (region || 'all');
}
/** Which roll (0–99) this visitor gets on this surface. Exported so the draw can
 *  be reasoned about from outside instead of being a black box. */
function shopMerchRoll(surfaceId, region) {
  return shopHash32(shopMerchSeed(surfaceId, region)) % 100;
}

/**
 * What one surface shows this visitor, in this region.
 *
 * Returns `{ source, mode, items, by, region }` where `source` is 'merch' when a
 * live pick survived, and 'none' when the caller must fall back — to the house
 * card on a spotlight, to the editorial list on a rail.
 *
 * 🔴 AN INELIGIBLE WINNER DOES NOT REALLOCATE. In weighted mode the roll is
 * taken over the FULL stored set, and if the winner turns out to be ineligible
 * for this visitor the slot goes to the house card. Filtering first and
 * re-rolling would quietly hand one advertiser's share to another — nobody
 * bought that share, and the numbers a marketer reads back would be wrong.
 */
function shopMerchChoose(surfaceId, region) {
  const reg = region || shopRegionId();
  const out = { source: 'none', mode: null, items: [], by: null, region: reg };
  const M = shopMerch();
  if (!M || typeof M.live !== 'function') return out;
  const set = M.live(surfaceId, reg);
  const refusals = [];
  _shopMerchRefusals[surfaceId] = refusals;
  if (!set || !Array.isArray(set.items) || !set.items.length) return out;
  out.mode = set.mode || null;
  out.by = set.by || null;

  const note = (item, why) => refusals.push({
    surface: surfaceId, region: reg, id: (item && item.id) || null, why,
    ceiling: why === 'claim-over-ceiling' ? shopClaimCeilingPct() : undefined,
  });

  if (set.mode === 'weighted') {
    const drawn = shopMerchDrawAt(set.items, shopMerchRoll(surfaceId, set.region || 'all'));
    if (!drawn) return out;
    const why = shopMerchWhyNot(drawn);
    if (why) { note(drawn, why); return out; }
    out.source = 'merch'; out.items = [drawn];
    return out;
  }

  const kept = [];
  for (const it of set.items) {
    const why = shopMerchWhyNot(it);
    if (why) { note(it, why); continue; }
    kept.push(it);
  }
  if (!kept.length) return out;
  out.source = 'merch'; out.items = kept;
  return out;
}

/**
 * THE HOUSE CARD — the fallback when nothing is picked.
 *
 * Editable at any time, and never derived. The claim ceiling applies to it too:
 * a house card is written by a person and a person can type 97%.
 * `SHOP_HOUSE_LAST_RESORT` exists because dropping an over-ceiling HEADLINE
 * would leave a card with no words on it, and a blank card is the state the
 * house card exists to prevent.
 */
const SHOP_HOUSE_LAST_RESORT = { headline: 'Shop Hyperwolf', sub: '', kicker: '' };
function shopHouseCard() {
  const M = shopMerch();
  const raw = (M && typeof M.houseCard === 'function' && M.houseCard()) || SHOP_HOUSE_LAST_RESORT;
  const ceiling = shopClaimCeilingPct();
  const refusals = [];
  const keep = (v, field) => {
    if (shopClaimWithin(v, ceiling)) return v == null ? '' : String(v);
    refusals.push({ surface: '_house', region: null, id: field, why: 'claim-over-ceiling', ceiling });
    return '';
  };
  const card = {
    headline: keep(raw.headline, 'headline') || SHOP_HOUSE_LAST_RESORT.headline,
    sub: keep(raw.sub, 'sub'),
    kicker: keep(raw.kicker, 'kicker'),
  };
  _shopMerchRefusals._house = refusals;
  return card;
}

// ── Merchandising rails ───────────────────────────────────────────────────
//
// Five rails, named on the desktop shop frame: Fresh Drops · On Sale · Staff
// Picks · Best Sellers · New Arrivals.
//
// EACH RAIL NOW HAS THREE POSSIBLE SOURCES, in this order:
//   1. `HWMerch.live('shop_rail_<id>')` — what a merchandiser picked;
//   2. the derivation, where one honestly exists (`On Sale` is `p.was != null`);
//   3. the editorial list written down here.
//
// ⚠️ ONLY ONE OF THE FIVE IS DERIVABLE. The catalogue carries no first-seen date
// and no units-sold, so recency and popularity CANNOT be computed from it. An
// "auto" mode is therefore OFFERED AND DISABLED, with `needs` naming the field
// it is waiting on — a hash dressed up as a "best seller" would be a fabricated
// fact on a customer-facing screen, which is the same failure as the 97% card.
//
// `basisNote` is what the SHOPPER is told the rail is. A rail called "Best
// Sellers" makes a claim about sales data; since we do not have any, the screen
// says what the list actually is rather than letting the label imply a ranking.
const SHOP_RAILS = [
  // "Fresh Drops" claims recency exactly as loudly as "New Arrivals" does, and
  // the catalogue has no stocking date for either. Same note, same missing field.
  { id: 'fresh', label: 'Fresh Drops', token: 'wellness',
    basisNote: 'Chosen by our team — we don’t hold stocking dates', needs: 'firstSeenAt',
    skus: ['FFF81Q98', 'GBZ35RR', 'STG1BAD', 'MMG100E'] },
  { id: 'sale', label: 'On Sale', token: 'deals', derived: 'markdown',
    basisNote: 'Every item currently marked down', needs: null },
  { id: 'staff', label: 'Staff Picks', token: 'premium',
    basisNote: 'Chosen by our team', needs: null,
    skus: ['FCF1LRS', 'LDI4DRP', 'FP94AIO', 'BOF35SM'] },
  { id: 'best', label: 'Best Sellers', token: 'vape',
    basisNote: 'Chosen by our team — we don’t publish sales rankings', needs: 'unitsSold',
    skus: ['CHP1GPR', 'GNJ1123', 'H480PRO1', 'NCO28SM'] },
  { id: 'new', label: 'New Arrivals', token: 'edibles',
    basisNote: 'Chosen by our team — we don’t hold stocking dates', needs: 'firstSeenAt',
    skus: ['DBL78MG', 'BBH2JNT', '984X9CJO', 'ARCH001'] },
];
function shopRailSurfaceId(railId) { return 'shop_rail_' + railId; }
function shopRailById(railId) { return SHOP_RAILS.find((r) => r.id === railId) || null; }

/**
 * WHERE THIS RAIL'S ITEMS CAME FROM, and what an auto mode would still need.
 *
 * ⚠️ THE RAIL SURFACES ARE NOT IN `HWMerch.SURFACES` YET. `set()` refuses an
 * unknown surface, so nothing can be stored against `shop_rail_*` until the five
 * ids are registered in `shared/merch-store.js` — which this agent does not own.
 * Until then every rail reports `editorial` or `markdown`, `registered` is false,
 * and the read below is dead but correct. That is deliberate: the alternative is
 * a screen that cannot use the picks on the day they become possible.
 */
function railBasis(railId, region) {
  const rail = shopRailById(railId);
  if (!rail) return null;
  const M = shopMerch();
  const surfaceId = shopRailSurfaceId(railId);
  const registered = !!(M && typeof M.surfaceById === 'function' && M.surfaceById(surfaceId));
  const pick = shopMerchChoose(surfaceId, region);
  const base = {
    rail: railId, surface: surfaceId, registered,
    // An auto rail is available only when the catalogue carries the field it
    // would rank on. It never does today, and `needs` says which one is missing.
    autoAvailable: false, needs: rail.needs || null,
  };
  if (pick.source === 'merch') {
    return Object.assign(base, { source: 'merch', mode: pick.mode, by: pick.by,
      note: 'Picked by our merchandising team' });
  }
  if (rail.derived === 'markdown') {
    return Object.assign(base, { source: 'markdown', mode: null, by: null, note: rail.basisNote });
  }
  return Object.assign(base, { source: 'editorial', mode: null, by: null, note: rail.basisNote });
}

function railProducts(railId, region) {
  const rail = shopRailById(railId);
  if (!rail) return [];
  const pick = shopMerchChoose(shopRailSurfaceId(railId), region);
  if (pick.source === 'merch') {
    const wanted = [];
    for (const it of pick.items) {
      if (Array.isArray(it.skus)) wanted.push(...it.skus);
      else if (it.sku) wanted.push(it.sku);
      else if (it.brand) wanted.push(...allProducts().filter((p) => p.brand === it.brand).map((p) => p.sku));
    }
    const seen = new Set();
    const out = [];
    for (const s of wanted) {
      if (seen.has(s)) continue;
      seen.add(s);
      const p = productBySku(s);
      if (p) out.push(p);
    }
    // An empty result means every sku the pick named is gone from the catalogue.
    // Rendering an empty rail would read as "we sold out"; the editorial list is
    // the honest answer, and the refusals list already says what was dropped.
    if (out.length) return out;
  }
  if (rail.derived === 'markdown') return allProducts().filter((p) => p.was != null);
  return rail.skus.map(productBySku).filter(Boolean);
}

// ── Brand spotlight ───────────────────────────────────────────────────────
//
// The frame spotlights a brand card, top right of the shop screen. WHAT it
// spotlights is now a marketing decision read from `HWMerch`, and when marketing
// has not made one, the house card takes the slot.
/**
 * ⚙️ TUNE — the default claim ceiling, used until the POS setting exists.
 *
 * 🔴 WHY THIS EXISTS. The spotlight used to pick the brand with the deepest
 * markdown in the catalogue and print it. A reviewer read the rendered DOM and
 * found the shop advertising "Connected / Up to 97% off" TO CUSTOMERS. Nothing
 * was wrong with the arithmetic — one item really was marked down 97% — but a
 * single clearance or mispriced SKU was speaking for an entire brand, and a 97%
 * headline reads as a pricing error to anyone who sees it, because usually it is.
 *
 * The derivation is gone from the card. The ceiling stays, because a HUMAN can
 * type 97% too, and `shopClaimCeilingPct()` prefers the operator's setting over
 * this constant the moment that setting exists.
 */
const SPOTLIGHT_MAX_PCT = 60;
let _spotlightSkipped = [];

/**
 * THE SPOTLIGHT — what marketing picked, or the house card. Never a derivation.
 *
 * Returns `{ source, mode, region, by, demo, cards: [...] }`. `cards` is a LIST
 * because carousel mode means everyone sees all of them in order; the surface's
 * cap is 1 today, so there is normally one, and the screen maps over it anyway
 * so raising the cap does not silently drop items.
 */
function brandSpotlight(region) {
  const reg = region || shopRegionId();
  const pick = shopMerchChoose('shop_spotlight', reg);
  const eta = expressEtaMinutes();
  const demo = shopMerchIsDemo();
  if (pick.source !== 'merch') {
    const house = shopHouseCard();
    return { source: 'house', mode: null, region: reg, by: null, demo,
      cards: [{ title: house.headline, offer: house.sub, kicker: house.kicker,
        brand: null, sku: null, etaMinutes: eta, expressCount: 0, itemCount: 0 }] };
  }
  const B = (typeof window !== 'undefined' && window.HW_BRANDS) || null;
  const cards = pick.items.map((it) => {
    const brand = it.brand || null;
    const carried = brand ? allProducts().filter((p) => p.brand === brand) : [];
    const meta = brand && B && B.byName ? B.byName[brand] : null;
    return {
      title: it.headline || it.label || brand || '',
      offer: it.offer || '',
      // The brand's own category, from the one brand DB. No invented provenance.
      kicker: it.kicker || (meta && meta.category) || '',
      brand, sku: it.sku || null,
      etaMinutes: eta,
      expressCount: carried.filter((p) => isExpress(p.sku)).length,
      itemCount: carried.length,
    };
  });
  return { source: 'merch', mode: pick.mode, region: reg, by: pick.by, demo, cards };
}

/**
 * 🔴 NOT A CARD, AND NOTHING RENDERS IT. This is the old derivation, kept as an
 * OPERATOR AUDIT: "here is the claim the catalogue would generate, and here is
 * the brand it would come from". It is how a mispriced SKU gets noticed instead
 * of surviving for weeks — `spotlightSkipped()` lists the rows past the ceiling.
 *
 * ⚠️ IF THIS EVER REACHES A SHOPPER-FACING SCREEN, THE 97% INCIDENT IS BACK.
 * `test/shop-merch-surfaces.test.mjs` asserts the spotlight never renders it.
 */
function markdownAudit() {
  const best = new Map();
  const skipped = [];
  const ceiling = shopClaimCeilingPct();
  for (const p of allProducts()) {
    if (p.was == null || !(p.was > p.price)) continue;
    const pct = Math.round(((p.was - p.price) / p.was) * 100);
    // An implausible markdown is a data-quality signal, not a promotion. Skip
    // the ITEM, not the brand — a brand with one bad row and ten sane ones is
    // still a brand with ten sane rows.
    if (pct > ceiling) { skipped.push({ sku: p.sku, brand: p.brand, pct }); continue; }
    const cur = best.get(p.brand);
    if (!cur || pct > cur.pct) best.set(p.brand, { pct, product: p });
  }
  _spotlightSkipped = skipped;
  let top = null;
  for (const [brand, v] of best) {
    // Ties break on brand name so the audit does not reorder between runs.
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
    // The string that WOULD have been advertised, retained so an operator can
    // see exactly what the derivation wanted to say.
    offer: 'Up to ' + top.pct + '% off',
    kicker: (meta && meta.category) || '',
    etaMinutes: expressEtaMinutes(),
    expressCount: items.filter((p) => isExpress(p.sku)).length,
    itemCount: items.length,
  };
}

/**
 * THE REORDER ROW — the customer's own history, plus at most a labelled sponsor.
 *
 * 🔴 THE TWO RULES COME FROM THE DATA, NOT FROM THIS FUNCTION.
 * `HWMerch.surfaceById('home_reorder')` carries `neverFirst` and `mustLabel`,
 * and both are read here. Hard-coding "start at index 1" would work today and
 * would silently stop tracking the surface the moment the flags change — and the
 * flags are the owner's decision, not this screen's.
 *
 * Index 0 earns the "Your usual" badge, and the row's entire credibility comes
 * from being genuinely the customer's own history. A sponsored card that cannot
 * be placed legally is DROPPED, not promoted: with no past orders at all there
 * is no index 1, so the row stays empty rather than becoming an advert wearing
 * the word "Reorder".
 */
function shopReorderRow(region) {
  const entries = pastOrders().map((o, i) => ({ kind: 'order', key: o.id, order: o, usual: i === 0 }));
  const M = shopMerch();
  const surface = M && typeof M.surfaceById === 'function' ? M.surfaceById('home_reorder') : null;
  if (!surface) return entries;
  const pick = shopMerchChoose('home_reorder', region);
  if (pick.source !== 'merch') return entries;

  const refusals = _shopMerchRefusals.home_reorder || (_shopMerchRefusals.home_reorder = []);
  const minIndex = surface.neverFirst ? 1 : 0;
  let at = minIndex;
  for (const it of pick.items) {
    /* ⚠️ UNREACHABLE TODAY AND NOT COVERED BY A TEST. `pastOrders()` is a fixture
     * that always returns two orders, so `entries.length` is never below 1 and no
     * test can drive this branch without faking the fixture. It is kept because
     * the day past orders become real, a brand-new customer has none — and the
     * failure it prevents is silent: a row headed "Reorder" containing nothing
     * but an advert. Delete it only together with the guarantee that made it
     * dead. */
    if (entries.length < minIndex) {
      refusals.push({ surface: 'home_reorder', region: pick.region, id: it.id || null, why: 'no-legal-slot' });
      continue;
    }
    let idx = Number(it.slot);
    if (!Number.isFinite(idx)) idx = at;
    idx = Math.max(minIndex, Math.min(Math.round(idx), entries.length));
    entries.splice(idx, 0, {
      kind: 'sponsored', key: 'sponsored-' + (it.id || idx), item: it,
      // ⚠️ ONLY WHEN THE SURFACE SAYS SO. The screen renders the disclosure iff
      // this is set, so flipping `mustLabel` in the surface data actually
      // changes what a shopper sees.
      sponsorLabel: surface.mustLabel ? (String(it.sponsorLabel || '').trim() || 'Sponsored') : null,
    });
    at = idx + 1;
  }
  return entries;
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

/** Put units into one lane, merging with that lane's existing line. NO emit. */
function _shopPut(sku, qty, lane) {
  if (qty <= 0) return null;
  const existing = _findLine(sku, lane);
  if (existing) { existing.qty += qty; return existing; }
  _SHOP.lines = _SHOP.lines.concat([{ id: 'sl' + (++_shopSeq), sku, qty, lane }]);
  return _findLine(sku, lane);
}

/**
 * Add to the cart, within what the van can actually carry.
 *
 * 🔴 The storefront is the ONLY system that can falsify the express promise
 * before it is made, and it used to make it unconditionally: 99 units went into
 * express against a van depth of 5. The overflow is not refused and it is not
 * lost — it goes scheduled, which is exactly what "arrives tomorrow instead"
 * means, and `shopAddPlan` is what a screen reads to say so.
 */
function shopAdd(sku, qty, lane) {
  const p = productBySku(sku);
  if (!p) return null;                       // never hold a line for a sku the store does not sell
  const plan = shopAddPlan(sku, qty, lane);
  const ex = _shopPut(sku, plan.express, 'express');
  // `plan.lane` when nothing went express, so an explicitly-named lane is still
  // honoured; 'scheduled' when this is the overflow off a capped express add.
  const sc = _shopPut(sku, plan.scheduled, plan.express > 0 ? 'scheduled' : plan.lane);
  _shopEmit();
  return ex || sc;
}

/** Add every line of a past order. Returns how many lines actually landed. */
function shopAddAll(order) {
  const lines = (order && order.lines) || [];
  let added = 0;
  for (const l of lines) { if (shopAdd(l.sku, l.qty)) added++; }
  return added;
}

/**
 * A stepper is just another way to ask for more than the driver is carrying, so
 * the van caps this too. Without it, "+" held down on an express line rebuilt
 * the exact promise `shopAdd` now refuses to make.
 */
function shopSetQty(lineId, qty) {
  const l = _SHOP.lines.find((x) => x.id === lineId);
  if (!l) return false;
  if (qty <= 0) return shopRemove(lineId);
  if (l.lane === 'express') {
    const keep = Math.min(qty, expressUnits(l.sku));
    if (keep <= 0) _SHOP.lines = _SHOP.lines.filter((x) => x.id !== l.id);
    else l.qty = keep;
    _shopPut(l.sku, qty - keep, 'scheduled');   // the overflow arrives tomorrow
    _shopEmit(); return true;
  }
  l.qty = qty; _shopEmit(); return true;
}
function shopRemove(lineId) {
  const before = _SHOP.lines.length;
  _SHOP.lines = _SHOP.lines.filter((l) => l.id !== lineId);
  if (_SHOP.lines.length === before) return false;
  _shopEmit(); return true;
}
/**
 * Move ONE line to the other lane, merging if that lane already holds the sku.
 *
 * 🔴 Returns false — the move does not happen — when the van cannot carry the
 * whole line. The cart screen hides the control in that case, so this is the
 * second line of defence rather than the only one; it is here because a store
 * that only guards in the view is a store that is guarded until someone adds a
 * second view.
 */
function shopSetLane(lineId, lane) {
  const l = _SHOP.lines.find((x) => x.id === lineId);
  if (!l || l.lane === lane) return false;
  if (lane === 'express' && expressHeadroom(l.sku) < l.qty) return false;
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
  expressUnits, isExpress, expressHeadroom, addPlan: shopAddPlan, defaultLaneFor,
  allProducts, productBySku, categories: shopCategories, productsInCategory,
  railProducts, railBasis, brandSpotlight, expressEtaMinutes, pastOrders,
  // WHAT MARKETING PICKED. Every one of these reads through `window.HWMerch`
  // and nothing else — see the seam note above `shopMerch()`.
  reorderRow: shopReorderRow,
  region: shopRegionId,
  houseCard: shopHouseCard,
  claimCeilingPct: shopClaimCeilingPct,
  merchRefusals: shopMerchRefusals,
  merchIsDemo: shopMerchIsDemo,
  // Pure, and exported, so the share-of-voice split can be asserted exactly
  // rather than sampled: feed rolls 0–99 and count the winners.
  merchDraw: shopMerchDraw, merchDrawAt: shopMerchDrawAt,
  merchSeed: shopMerchSeed, merchRoll: shopMerchRoll,
  // 🔴 AN AUDIT, NOT A CARD. Nothing shopper-facing may render this.
  markdownAudit,
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
/* A MERCHANDISING CHANGE MUST REPAINT THE STOREFRONT.
 *
 * Every shop screen already re-renders off `useShop()`. Forwarding HWMerch's
 * own notifications into that one emitter means a marketer publishing a set
 * shows up immediately, WITHOUT a second subscription hook that half the
 * screens would forget to use — and a screen that renders stale merchandising
 * looks exactly like a screen with nothing scheduled. */
if (typeof window !== 'undefined' && window.HWMerch && typeof window.HWMerch.subscribe === 'function') {
  window.HWMerch.subscribe(() => _shopEmit());
}

window.useShop = function useShop() {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => window.SHOP.subscribe(force), []);
  return window.SHOP;
};
