// ── pos/screen-pricing.jsx ── cross-source pricing comparison ─────────────
//
// Self-wrapping IIFE: it declares NOTHING at top level, so it cannot clobber
// another file's globals (test/global-collisions.test.mjs — these pages have
// no module system and the last file loaded silently wins). Its only export
// is window.PricingScreen.
//
// Reads ONE external service: the standalone hw-pricing-scraper backend at
// localhost:8799 (GET /api/pricing/listings, GET /api/pricing/facets). That
// server "shares nothing with any other live service" per its own README, so
// this screen — unlike screen-brands.jsx / screen-category-map.jsx — does NOT
// point base() at window.HW_LIVE.base or window.location.origin. It writes
// nothing; there is no write path to grow into by accident.
//
// ── WHY THIS SCREEN EXISTS, AND THE ONE REQUIREMENT THAT SHAPES ALL OF IT ──
//
// The owner's words: "each line item should show all of the pricing across
// all of the sources at the same time so we don't have to tab through and
// search for the same item multiple times. The item is the key — make sure
// you also include the brand name."
//
// That sentence is the whole design brief. The unit of this screen is not a
// listing row — it is a PRODUCT, identified by brand + name + weight, and
// every source's price for that product renders together, in one place, with
// the brand name visible in the group header, not buried in a column nobody
// scans. A flat "one row per listing" table (which is what the first mockup,
// scratch/pricing-dashboard-mockup.html, built) is exactly the "tab through
// and search" problem being fixed here, not a starting point to extend.
//
// ── GROUPING: A REAL, NON-TRIVIAL JUDGMENT CALL — READ THIS BEFORE CHANGING IT
//
// The backend (server/app.py) has no grouping endpoint and no product_group_id
// — confirmed by reading it. Grouping happens here, client-side, against
// whatever GET /api/pricing/listings returns. That is a deliberate choice, not
// a shortcut: the matching logic below is exactly the kind of thing that
// should be visible and reviewable in the screen that uses it, rather than
// hidden behind an opaque server-side join a UI engineer can't see.
//
// THE KEY: normalized brand + normalized weight + a normalized, WORD-SET name
// core (order-independent, common filler words stripped). Three real listings
// prove why naive string equality fails and why this needs to be a word set:
//
//   leafly              "STIIIZY - POD [1G] BLUE DREAM"
//   stiiizy_dispensary_shop "STIIIZY - Original Pod - Blue Dream - 1g"
//
// Same physical product (verified against samples/*.jsonl during the design
// review), but the raw strings differ in word order AND in one filler word
// ("Original"). Stripping punctuation, stripping the brand and weight tokens,
// dropping a short stoplist of purely decorative words, then SORTING the
// remaining words before joining, turns both into the same key
// ("blue dream pod" / stiiizy / 1g) without inventing any data.
//
// WHAT THIS DELIBERATELY DOES NOT DO: merge on brand or name alone, and never
// merges when brand OR weight cannot be confidently extracted (brand is null
// for every weedstoreanddeliveryie.com row in the live data — those become
// solo groups rather than a shared "unknown brand" bucket, because merging
// them would fabricate a match with no real evidence). A second candidate
// match named in OVERNIGHT-STATUS.md — Highatus "ChronBons Peanut Butter &
// Jelly" as a dutchie_embed rosin-infused edible vs. a stiiizy_dispensary_shop
// "SOLVENTLESS CHOCOLATE" edible of the same flavor line — does NOT merge
// under this key on purpose: "Rosin" and "Solventless Chocolate" survive the
// stoplist because they are not filler, they are the actual product format,
// and this screen would rather under-merge (show two honest single-source
// groups) than over-merge two SKUs that may not really be the same thing.
// If that turns out to be wrong, it's a one-line stoplist addition — but that
// is an owner call about what counts as "the same product," not a bug to
// silently paper over here.
//
// Re-verified against the live server on 2026-09-05: across the 1,254-row
// live dataset this key produces 4 multi-row groups, not 1 — and only 3 of
// those are real cross-source matches (Do-Si-Dos: dutchie_embed+leafly;
// Watermelon Z: dutchie_embed+stiiizy_dispensary_shop; Blue Dream:
// leafly+stiiizy_dispensary_shop). The 4th is a SAME-SOURCE duplicate: two
// dutchie_embed rows (id 100 "Kushy Punch Gummy Watermelon Indica 100mg" and
// id 102 "Kushy Punch Original Gummy Watermelon Indica 100mg") merge only
// because "Original" is in STOPWORDS — one store's own catalog scraped twice
// under near-duplicate names, not a competitor match. A multi-row group is
// therefore NOT the same thing as a multi-SOURCE group, and the code below
// (groups.multiSource / distinctSources) keeps the two concepts separate
// rather than treating row count as a proxy for cross-source evidence. Every
// other row in the dataset lands in a group of one, matching
// OVERNIGHT-STATUS.md's account of how rare real cross-source matches are —
// degenerate (single-source) groups are still the honest, expected common
// case.
//
// ── "YOUR PRICE" ─────────────────────────────────────────────────────────
//
// POS-Admin's own catalog has no real match against these listings yet — no
// product-mapping pipeline exists. There is genuinely no "our price" to show
// (owner's explicit call: don't show a "Not yet mapped" label for it either —
// it's always true today and adds nothing but noise). This also means the
// redesign doc's group-header pill — described
// there as "our price vs. best competitor price" — cannot be built as
// written, because "our price" does not exist. The pill here instead reports
// the SPREAD across the sources actually present in the group, which is the
// only thing this screen can honestly compute today.
//
// ── PRE_TAX_PRICE VS price ──────────────────────────────────────────────
//
// pre_tax_price is nullable and is the ONLY figure ranked or compared —
// verified live: 756 of 1,254 rows have pre_tax_price == null (unresolved tax
// basis). The raw `price` column is always populated, which is exactly why
// the redesign doc calls out the regression risk by name: "someone reaches
// for `price` because it's always populated." Rows with a null pre_tax_price
// or price_tax_basis === 'unknown' still render (never hidden), and sort to
// the bottom of their group — but the owner's explicit call is to never show
// the word "unverified" anywhere in this UI, so that sort order is the only
// signal; there is no visible badge for the unresolved case. STIIIZY's own
// $23.00 listing is the proof case for why the two prices matter: raw price
// $23.00, but
// pre_tax_price is $17.19 (inclusive tax basis, arithmetic-verified) — the
// two are not interchangeable and the UI must never suggest they are.
//
;(function () {
  'use strict';
  const useP = window.useP;

  // The pricing backend is a standalone service (server/README.md: "shares
  // nothing with any other live service"). Unlike every other POS-Admin
  // screen, base() must NOT fall back to window.HW_LIVE.base or
  // window.location.origin — those point at the POS-Admin app itself, not
  // this scraper's SQLite-backed API.
  const PRICING_BASE = 'https://hw-pricing-scraper.onrender.com';
  const ROUTE_LISTINGS = '/api/pricing/listings';
  const ROUTE_FACETS = '/api/pricing/facets';

  // ONE shape for every outcome, so a caller can never confuse "the route is
  // not there" with "the route said there is nothing." Same pattern as
  // pos/screen-brands.jsx and pos/screen-category-map.jsx.
  function getJSON(path) {
    const url = PRICING_BASE + path;
    return fetch(url, { credentials: 'omit', cache: 'no-store' }).then(function (res) {
      return res.text().then(function (txt) {
        let body = null, parsed = false;
        try { body = JSON.parse(txt); parsed = true; } catch (e) {}
        return { url: url, code: res.status, ok: res.ok, body: body,
          parsed: parsed, raw: String(txt || '').slice(0, 400) };
      });
    }).catch(function (e) {
      return { url: url, code: 0, ok: false, body: null, parsed: false, raw: '',
        netError: (e && e.message) || 'request failed — is the pricing server running on :8799?' };
    });
  }

  function qs(params) {
    return Object.keys(params)
      .filter(function (k) { return params[k] != null && params[k] !== ''; })
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); })
      .join('&');
  }

  // ── grouping key — see the file header comment for the full rationale ────

  const STOPWORDS = { original: 1, the: 1, a: 1, an: 1 }; // purely decorative; see header

  function normalizeBrand(brand) {
    const b = String(brand || '').toLowerCase().trim().replace(/\s+/g, ' ');
    return b || null; // null brand never merges — see header comment
  }

  // Matches "1g", "3.5g", "100mg", "[1G]", "7g", "1pc", "10pk", etc. Requires
  // a leading digit, so ".5g" (present in real data) intentionally does NOT
  // match — that row falls back to a solo group rather than guessing a
  // weight. Piece-count units (pc/pack/ct/...) were missing entirely until a
  // real bug report: every battery/accessory/multi-pack item measured in
  // units rather than mass never matched across sources, even identical
  // products from the same brand at different stores (verified live: STIIIZY
  // - 510 Battery Koda Pro Green - 1PC showed as 3 separate solo groups, one
  // per store, purely because "1PC" matched nothing). Unit counts pulled from
  // the real dataset before adding these, not guessed: pk(232) pack(61)
  // pc(8) ct(7) count(2) piece(2).
  const WEIGHT_RE = /(\d+(?:\.\d+)?)\s?(mg|g|ml|oz|pcs|pc|pieces|piece|each|ea|pack|pk|count|ct)\b/i;
  // True unit synonyms only (same physical quantity, different spelling) —
  // folded so "1pc" and "1 each" match as the same weight key. Never merges
  // across DIFFERENT units (a "pk" pack is not a "pc" single).
  const UNIT_SYNONYMS = { pcs: 'pc', pieces: 'pc', piece: 'pc', each: 'pc', ea: 'pc', pack: 'pk', count: 'pk', ct: 'pk' };
  function extractWeight(productName) {
    const m = WEIGHT_RE.exec(String(productName || ''));
    if (!m) { return null; }
    const rawUnit = m[2].toLowerCase();
    const unit = UNIT_SYNONYMS[rawUnit] || rawUnit;
    return { raw: m[0], norm: (m[1] + unit).toLowerCase() };
  }

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // Strip brand + weight tokens, strip punctuation, drop the stoplist — but
  // do NOT reorder. Shared by the (sorted) matching key and the (unsorted,
  // readable) display name below, so the two never drift apart on anything
  // but word order.
  function coreWords(productName, brand, weight) {
    let s = String(productName || '').toLowerCase();
    if (brand) { s = s.replace(new RegExp('\\b' + escapeRe(brand.toLowerCase()) + '\\b', 'g'), ' '); }
    if (weight) { s = s.replace(new RegExp(escapeRe(weight.raw.toLowerCase()), 'g'), ' '); }
    s = s.replace(/[-–—,:;/|()\[\]*'".]+/g, ' ').replace(/\s+/g, ' ').trim();
    const words = s.split(' ').filter(function (w) { return w && !STOPWORDS[w]; });
    return words;
  }

  // Order-independent on purpose — "Blue Dream Pod" and "Pod Blue Dream" must
  // produce the same key. This is for MATCHING only; it reads badly as a
  // label (see displayName below for the readable version of the same words).
  function normalizeNameCore(productName, brand, weight) {
    const words = coreWords(productName, brand, weight);
    if (words.length === 0) { return null; }
    return words.slice().sort().join(' ');
  }

  // Returns the group key, or null if brand/weight/name couldn't be
  // confidently extracted — a null key means "never merge this row with
  // anything," which the caller turns into a guaranteed-unique solo key.
  function groupKey(row) {
    const brand = normalizeBrand(row.brand);
    const weight = extractWeight(row.product_name);
    if (!brand || !weight) { return null; }
    const core = normalizeNameCore(row.product_name, brand, weight);
    if (!core) { return null; }
    return brand + '|' + weight.norm + '|' + core;
  }

  // Display name: same word set as the matching key, but taken from whichever
  // group member phrases it with the FEWEST leftover words (after stripping
  // brand/weight/stoplist) and left in that listing's own word order, so a
  // merged group reads as a real product name ("Do-Si-Dos Pod") instead of
  // the sorted matching key ("do dos pod si").
  function displayName(rows) {
    let best = null;
    rows.forEach(function (row) {
      const brand = normalizeBrand(row.brand);
      const weight = extractWeight(row.product_name);
      const words = coreWords(row.product_name, brand, weight);
      if (words.length > 0 && (!best || words.length < best.length)) { best = words; }
    });
    return best ? titleCase(best.join(' ')) : null;
  }

  function titleCase(s) {
    return String(s || '').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  const SOURCE_LABEL = {
    dutchie_embed: 'Dutchie',
    leafly: 'Leafly',
    stiiizy_dispensary_shop: 'STIIIZY (direct)',
    weedmaps: 'Weedmaps',
    weedstoreanddeliveryie: 'Weed Store & Delivery'
  };
  function sourceLabel(s) { return SOURCE_LABEL[s] || titleCase(String(s || '').replace(/_/g, ' ')); }

  // The real, distinct COMPETITOR a row came from — NOT the scraping
  // platform. A few platforms (dutchie_embed, weedmaps, leafly,
  // stiiizy_dispensary_shop) are shared by multiple real, unrelated stores
  // in different cities; `row.source` alone collapses all of them into one
  // bucket. Real bug found live: STIIIZY - Wildomar and STIIIZY - Pomona
  // both carry `source: "stiiizy_dispensary_shop"`, so a shared product
  // between them showed as a "same-source duplicate" instead of two real
  // competitor prices. store_name (added project-wide recently) is the
  // real per-store identity; fall back to source only for the handful of
  // older rows that predate that field.
  function competitorKey(row) { return row.store_name || row.source; }

  // Deterministic small palette for the source dot, cycling by source name —
  // not meant to encode meaning, only to let a scanning eye tell sources
  // apart inside a group without reading the label every time.
  function sourceDot(P, source) {
    const palette = [P.info, P.good, P.warn, P.accent, P.neutral];
    let h = 0;
    for (let i = 0; i < source.length; i++) { h = (h * 31 + source.charCodeAt(i)) >>> 0; }
    return palette[h % palette.length];
  }

  function knownBasis(row) {
    return row.price_tax_basis && row.price_tax_basis !== 'unknown' && row.pre_tax_price != null;
  }

  function money(n) {
    return '$' + Number(n).toFixed(2);
  }

  // ── category filter — 46 raw strings, 13 sources, zero shared taxonomy ────
  // Verified live 2026-09-06 via GET /api/pricing/facets (see scratch/
  // pricing-filters-data-audit.md and scratch/pricing-filters-elite-design.md
  // for the full raw-value table this was built from). Folds case/plural/
  // synonym variants into one canonical bucket per real product type.
  const CATEGORY_FOLD = {
    flower: 'flower', flowers: 'flower',
    vape: 'vape', vapes: 'vape', vaporizers: 'vape', pods: 'vape', 'vapes pods': 'vape',
    cartridge: 'vape', cartridges: 'vape', '510 cartridges': 'vape', disposables: 'vape', battery: 'vape',
    'pre-roll': 'preroll', 'pre-rolls': 'preroll', preroll: 'preroll', prerolls: 'preroll',
    'pre-roll infused': 'preroll', 'infused prerolls': 'preroll', 'pre-roll flower': 'preroll',
    edible: 'edibles', edibles: 'edibles', capsules: 'edibles',
    concentrate: 'concentrate', concentrates: 'concentrate', extract: 'concentrate', extracts: 'concentrate',
    diamonds: 'concentrate', batter: 'concentrate', crumble: 'concentrate', hash: 'concentrate',
    tinctures: 'tincture',
    topical: 'topical', topicals: 'topical',
    accessories: 'other', gear: 'other'
  };
  // Category values that are NOT product types at all — a strain name leaked
  // into the category field at the source (weedmaps_adapter.py scrapes a real
  // `edge_category` field for the actual product type, but it's dropped
  // before reaching this API — see the audit doc). Deliberately NOT folded
  // into any real category: that would fabricate a product type the source
  // never actually gave us through this API.
  const CATEGORY_MISFILED = { indica: 1, sativa: 1, hybrid: 1 };
  // P is only reachable via useP() inside a component — same convention this
  // file already uses for sourceDot(P, source) — so this is a function of P,
  // not a module-level constant.
  function categoryMeta(P) {
    return {
      flower: { label: 'Flower', color: P.cat.flower },
      vape: { label: 'Vapes', color: P.cat.vape },
      preroll: { label: 'Pre-Rolls', color: P.cat.preroll },
      edibles: { label: 'Edibles', color: P.cat.edibles },
      concentrate: { label: 'Concentrates', color: P.cat.concentrate },
      tincture: { label: 'Tinctures', color: P.cat.tincture },
      topical: { label: 'Topicals', color: P.cat.wellness },
      other: { label: 'Accessories', color: P.cat.other }
    };
  }
  function categoryBucket(rawCategory) {
    const key = String(rawCategory || '').toLowerCase().trim();
    if (!key) { return 'uncategorized'; }
    if (CATEGORY_MISFILED[key]) { return 'misfiled'; }
    return CATEGORY_FOLD[key] || 'uncategorized';
  }

  // ── strain filter — no structured field exists; literal text scan only ────
  // A typo like "INDISA" (present in real data) intentionally does NOT match —
  // fuzzy-correcting it would fabricate a classification the source never
  // gave us. This screen's standing rule (see file header) is to under-
  // classify honestly rather than guess.
  const STRAIN_RE = /\b(indica|sativa|hybrid)\b/gi;
  function strainBuckets(productName) {
    const hits = new Set();
    let m;
    while ((m = STRAIN_RE.exec(String(productName || ''))) !== null) { hits.add(m[1].toLowerCase()); }
    if (hits.size >= 2) { return ['mixed']; }
    if (hits.size === 1) { return [[...hits][0]]; }
    return ['unstated'];
  }

  // ── price filter ───────────────────────────────────────────────────────
  // Same preference order the screen already uses to decide what number to
  // show large-and-bold in SubRow: pre-tax when verified, raw otherwise.
  // Filtering on pre_tax_price alone would make the filter silently
  // inoperable on the ~76% of rows without a verified figure.
  function priceCompareValue(row) { return knownBasis(row) ? row.pre_tax_price : row.price; }

  // The pre-tax figure worth SHOWING on a row, without fabricating anything:
  // when basis is 'exclusive', the displayed price is BY DEFINITION already
  // pre-tax (that's what "exclusive" means — tax is added afterward at
  // checkout, on top of this number) — no computation needed, it's the same
  // number. When basis is 'inclusive' and a city tax rate has been
  // researched, pre_tax_price is the real, separately-computed figure. In
  // every other case (basis unknown, or inclusive with no researched rate
  // yet) there is genuinely nothing to show — returns null, never a guess.
  function effectivePreTax(row) {
    if (row.price_tax_basis === 'exclusive') { return row.price; }
    if (row.price_tax_basis === 'inclusive' && row.pre_tax_price != null) { return row.pre_tax_price; }
    return null;
  }

  // ── "average across retailers" — regular price only, no promo pricing ────
  // The owner's explicit spec: average the NORMAL full price, never a
  // discounted one. fullPrice() undoes an active sale by reading was_price
  // (the pre-discount price every adapter already captures); it is NOT the
  // number shown big-and-bold on the row when on sale, which stays the real
  // current price — this is a separate, average-only figure.
  function fullPrice(row) { return (row.was_price != null && row.was_price > row.price) ? row.was_price : row.price; }

  // The full price, tax-normalized the same honest way effectivePreTax() is:
  // 'exclusive' basis means the displayed (full) price already IS pre-tax,
  // no computation needed. 'inclusive' with a researched pre_tax_price for
  // the CURRENT price lets us derive the same store's effective tax
  // multiplier (pre_tax_price / price) and apply it to the full price too —
  // proportional math, not a guess, since a store's tax rate doesn't change
  // between its sale price and its regular price. Every other case (basis
  // unknown, or inclusive with no researched rate) returns null and is
  // excluded from the average rather than mixing tax-in and tax-out numbers.
  function comparableFullPrice(row) {
    const full = fullPrice(row);
    if (row.price_tax_basis === 'exclusive') { return full; }
    if (row.price_tax_basis === 'inclusive' && row.pre_tax_price != null && row.price > 0) {
      return full * (row.pre_tax_price / row.price);
    }
    return null;
  }

  const PRICE_BANDS = [
    { key: 'u15', label: 'Under $15', lo: 0, hi: 15 },
    { key: '15-30', label: '$15–30', lo: 15, hi: 30 },
    { key: '30-50', label: '$30–50', lo: 30, hi: 50 },
    { key: '50-100', label: '$50–100', lo: 50, hi: 100 },
    { key: '100+', label: '$100+', lo: 100, hi: Infinity }
  ];

  // Raw price is heavily right-skewed (verified live: p95 ~$100, max $370) —
  // a linear slider spends most of its drag length on the top 5% of listings.
  // sqrt spreads out the crowded low end and compresses the long tail; must
  // stay exact inverses of each other.
  function sqrtToPos(price, lo, hi) { return Math.sqrt((price - lo) / (hi - lo || 1)); }
  function sqrtToValue(pos, lo, hi) { return lo + pos * pos * (hi - lo); }

  const TAX_BASIS_PLAIN = {
    inclusive: {
      headline: 'Tax is already included in this price.',
      body: 'We found this store’s own site saying tax is baked into the sticker price — what you see is what the customer pays.'
    },
    exclusive: {
      headline: 'Tax gets added at checkout, on top of this price.',
      body: 'This store’s site says tax is charged separately at the register — the price shown here is before that’s added.'
    },
    unknown: {
      headline: 'We checked this store’s website for a tax policy and didn’t find one.',
      body: 'No page said whether tax is included or added at checkout, so we’re not guessing — this price’s tax status is genuinely unverified, not assumed either way.'
    }
  };

  // ── tax-basis info trigger: click-to-pin, never hover-only ────────────────
  // Fix carried forward from the adversarial review of the redesign doc: a
  // hover-only popover is unreachable on touch and disappears the instant a
  // mouse moves toward it. Click toggles a pinned detail panel instead.
  //
  // The owner's explicit direction: no visible "unverified" labels anywhere
  // in this UI. When we genuinely don't know the tax basis, this renders
  // NOTHING — not a quieter badge, not an icon, nothing — rather than putting
  // the word "unverified" in front of a floor manager. The row's own price
  // display already reflects the same honesty without the word (see SubRow:
  // no tax note, no pre-tax line, just the plain price). For the two KNOWN
  // cases, a small inline info icon (not a colored pill) opens a panel that
  // leads with a plain-English sentence — every word of the real evidence
  // string is still preserved verbatim behind "Show technical detail."
  function TaxChip({ row, pinned, onTogglePin }) {
    const P = useP();
    if (row.price_tax_basis !== 'inclusive' && row.price_tax_basis !== 'exclusive') { return null; }
    const isPinned = pinned === row.id;
    const [showRaw, setShowRaw] = React.useState(false);
    const plain = TAX_BASIS_PLAIN[row.price_tax_basis];
    return (
      <span style={{ position: 'relative', display: 'inline-block' }}>
        <button data-hw-i onClick={function (e) { e.stopPropagation(); onTogglePin(isPinned ? null : row.id); if (isPinned) { setShowRaw(false); } }}
          title="How do we know?"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22,
            borderRadius: P.r999, border: 'none', cursor: 'pointer', background: isPinned ? P.surface3 : 'transparent',
            color: P.inkMute
          }}><Icon name="info" size={14} stroke={1.9} /></button>
        {isPinned &&
          <div onClick={function (e) { e.stopPropagation(); }}
            style={{ position: 'absolute', zIndex: 20, top: '120%', left: 0, minWidth: 240, maxWidth: 320,
              background: P.surface, border: `1px solid ${P.hairline3}`, borderRadius: P.r10, boxShadow: '0 6px 20px rgba(0,0,0,.18)',
              padding: 12, fontSize: P.type.meta, color: P.ink }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{plain.headline}</div>
            <div style={{ color: P.inkDim, lineHeight: 1.5 }}>{plain.body}</div>
            {row.price_tax_basis_evidence &&
              <React.Fragment>
                <button data-hw-i onClick={function () { setShowRaw(function (v) { return !v; }); }}
                  style={{ marginTop: 8, font: 'inherit', fontSize: P.type.micro, fontWeight: 600, color: P.info,
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  {showRaw ? 'Hide technical detail' : 'Show technical detail'}
                </button>
                {showRaw &&
                  <div style={{ marginTop: 6, padding: '8px 9px', background: P.surface2, border: `1px solid ${P.hairline}`,
                    borderRadius: P.r8, fontFamily: P.fontMono, fontSize: 10.5, color: P.inkDim, lineHeight: 1.5,
                    wordBreak: 'break-word' }}>
                    {row.price_tax_basis_evidence}
                  </div>}
              </React.Fragment>}
            <button data-hw-i onClick={function (e) { e.stopPropagation(); onTogglePin(null); }}
              style={{ marginTop: 8, display: 'block', font: 'inherit', fontSize: P.type.micro, color: P.inkMute, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              unpin
            </button>
          </div>}
      </span>);
  }

  // ── FilterPopover — shared trigger+panel shell for Brand and Price ────────
  // Same fixed-position / getBoundingClientRect / click-catcher pattern as
  // BrandFilter in screen-register.jsx, factored into one place instead of
  // copy-pasted twice, since Brand and Price both need it here.
  function FilterPopover({ trigger, width, children }) {
    const P = useP();
    const [open, setOpen] = React.useState(false);
    const ref = React.useRef(null);
    const [pos, setPos] = React.useState({ left: 0, top: 0 });
    const openMenu = function () {
      const r = ref.current.getBoundingClientRect();
      // clientWidth (not window.innerWidth) excludes the scrollbar, so the
      // clamp math matches the actual usable viewport. Real bug found live:
      // a trigger far enough right (Brand/Region/Price, after the category
      // tab strip) put the panel's right edge past the window, invisible/
      // unreachable with no scroll affordance — clamp BOTH edges, never just
      // the right one, so a narrow window can't push it negative either.
      const vw = document.documentElement.clientWidth || window.innerWidth;
      const left = Math.max(12, Math.min(r.left, vw - width - 12));
      setPos({ left: left, top: r.bottom + 6 });
      setOpen(true);
    };
    React.useEffect(function () {
      if (!open) { return; }
      function onKey(e) { if (e.key === 'Escape') { setOpen(false); } }
      window.addEventListener('keydown', onKey);
      return function () { window.removeEventListener('keydown', onKey); };
    }, [open]);
    return (
      <div ref={ref} style={{ position: 'relative', flex: '0 0 auto' }}>
        {React.cloneElement(trigger, { onClick: function (e) { e.stopPropagation(); open ? setOpen(false) : openMenu(); } })}
        {open && <React.Fragment>
          <div onClick={function (e) { e.stopPropagation(); setOpen(false); }} style={{ position: 'fixed', inset: 0, zIndex: P.z.dropdown }} />
          <div onClick={function (e) { e.stopPropagation(); }}
            style={{ position: 'fixed', left: pos.left, top: pos.top, width: width, background: P.surface,
              border: `1px solid ${P.hairline2}`, borderRadius: P.r12, boxShadow: P.shadowLg, padding: 10,
              zIndex: P.z.dropdown + 1 }}>
            {typeof children === 'function' ? children({ close: function () { setOpen(false); } }) : children}
          </div>
        </React.Fragment>}
      </div>);
  }

  // ── Category filter — single-select tabs with real counts + honest "Not
  // categorized" tab for the 71 rows where a strain name leaked into the
  // category field at the source (see CATEGORY_MISFILED above).
  function CategoryFilter({ groups, value, onChange }) {
    const P = useP();
    const META = categoryMeta(P);
    const counts = React.useMemo(function () {
      const m = { uncategorized: 0, misfiled: 0 };
      Object.keys(META).forEach(function (k) { m[k] = 0; });
      groups.forEach(function (g) {
        const buckets = new Set(g.rows.map(function (r) { return categoryBucket(r.category); }));
        buckets.forEach(function (b) { m[b] = (m[b] || 0) + 1; });
      });
      return m;
    }, [groups]);
    const order = ['flower', 'vape', 'preroll', 'edibles', 'concentrate', 'tincture', 'topical', 'other'];
    const options = [{ value: 'all', label: 'All', count: groups.length }]
      .concat(order.filter(function (k) { return counts[k] > 0; }).map(function (k) { return { value: k, label: META[k].label, count: counts[k] }; }))
      .concat(counts.misfiled + counts.uncategorized > 0
        ? [{ value: 'uncategorized', label: 'Not categorized', count: counts.misfiled + counts.uncategorized }]
        : []);
    return <Tabs value={value} onChange={onChange} options={options}
      style={{ borderBottom: 'none' }} />;
  }

  // ── Brand filter — multi-select popover with live counts. Reuses this
  // file's own normalizeBrand/titleCase rather than a second normalizer, so
  // the 22 pure-casing duplicates ("710 Labs" / "710 LABS") collapse for free.
  // Generic searchable multi-select popover — Brand and Region are the same
  // shape (a name, a count, an optional "not listed" bucket pinned last), so
  // this is one implementation instead of two near-identical copies.
  function MultiSelectPopover({ icon, label, placeholder, options, value, onChange }) {
    const P = useP();
    const [q, setQ] = React.useState('');
    const shown = options.filter(function (o) { return !q || o.display.toLowerCase().indexOf(q.toLowerCase()) >= 0; });
    const toggle = function (k) { onChange(function (prev) { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; }); };
    return (
      <FilterPopover width={244} trigger={
        <button data-hw-i style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: P.ctrlH.sm, padding: '0 12px',
          borderRadius: P.r999, border: `1px solid ${value.size ? P.hairline3 : P.hairline2}`, background: value.size ? P.highlightSoft : P.surface,
          color: value.size ? P.ink : P.ink2, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}>
          <Icon name={icon} size={12.5} stroke={1.9} />{label}
          {value.size > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: P.accentInk, background: P.accent, padding: '0 6px', borderRadius: 99, fontFamily: P.fontMono }}>{value.size}</span>}
          <Icon name="chevron-down" size={12} stroke={2.2} />
        </button>}>
        {function (popover) { return <React.Fragment>
          <Field icon="search" placeholder={placeholder} size="sm" value={q} autoFocus onChange={function (e) { setQ(e.target.value); }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 220, overflowY: 'auto', margin: '8px 0' }}>
            {shown.map(function (o) {
              const on = value.has(o.key);
              return <button key={o.key} data-hw-i onClick={function () { toggle(o.key); }}
                style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 8px', background: on ? P.surface3 : 'transparent',
                  border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}>
                <Check on={on} onChange={function () { toggle(o.key); }} size={16} />
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: o.muted ? P.inkMute : P.ink,
                  fontStyle: o.muted ? 'italic' : 'normal', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.display}</span>
                <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{o.count}</span>
              </button>;
            })}
            {shown.length === 0 && <div style={{ padding: 16, textAlign: 'center', fontSize: 12.5, color: P.inkMute }}>No matches</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, borderTop: `1px solid ${P.hairline}` }}>
            <button data-hw-i onClick={function () { onChange(new Set()); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: P.inkDim, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}>
              <Icon name="x" size={12} stroke={2} />Clear all
            </button>
            <PBtn variant="accent" size="xs" onClick={popover.close}>Done · {value.size}</PBtn>
          </div>
        </React.Fragment>; }}
      </FilterPopover>);
  }

  function BrandFilterPricing({ groups, value, onChange }) {
    const options = React.useMemo(function () {
      const m = new Map();
      groups.forEach(function (g) {
        g.rows.forEach(function (r) {
          const key = normalizeBrand(r.brand);
          const k = key || '__unbranded__';
          const display = key ? titleCase(key) : 'Brand not listed';
          if (!m.has(k)) { m.set(k, { key: k, display: display, count: 0, muted: !key }); }
          m.get(k).count++;
        });
      });
      return [...m.values()].sort(function (a, b) {
        if (a.key === '__unbranded__') { return 1; }
        if (b.key === '__unbranded__') { return -1; }
        return a.display.localeCompare(b.display);
      });
    }, [groups]);
    return <MultiSelectPopover icon="tag" label="Brand" placeholder="Search brands…" options={options} value={value} onChange={onChange} />;
  }

  // A store's real city, stripped of any parenthetical caveat kept for the
  // detail panel (e.g. "Eagle Rock (delivery marketed to Pasadena; ...)") —
  // the caveat is real and important, but not filter-option-label material.
  function primaryCity(storeCity) {
    const s = String(storeCity || '').trim();
    const idx = s.indexOf(' (');
    return idx > 0 ? s.slice(0, idx) : (s || null);
  }

  function RegionFilterPricing({ groups, value, onChange }) {
    const options = React.useMemo(function () {
      const m = new Map();
      groups.forEach(function (g) {
        g.rows.forEach(function (r) {
          const city = primaryCity(r.store_city);
          const k = city || '__unknown__';
          const display = city || 'City unknown';
          if (!m.has(k)) { m.set(k, { key: k, display: display, count: 0, muted: !city }); }
          m.get(k).count++;
        });
      });
      return [...m.values()].sort(function (a, b) {
        if (a.key === '__unknown__') { return 1; }
        if (b.key === '__unknown__') { return -1; }
        return a.display.localeCompare(b.display);
      });
    }, [groups]);
    return <MultiSelectPopover icon="map-pin" label="Region" placeholder="Search cities…" options={options} value={value} onChange={onChange} />;
  }

  // ── Strain filter — five multi-select toggles, built to be loud about the
  // fact that "Not stated" is 93.6% of the catalog, not a normal category.
  function StrainFilter({ counts, value, onChange }) {
    const P = useP();
    const OPTS = [
      { key: 'indica', label: 'Indica', color: P.indica },
      { key: 'sativa', label: 'Sativa', color: P.sativa },
      { key: 'hybrid', label: 'Hybrid', color: P.hybrid },
      { key: 'mixed', label: 'Mixed', color: P.neutral },
      { key: 'unstated', label: 'Not stated', color: P.inkMute }
    ];
    const toggle = function (k) { onChange(function (prev) { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; }); };
    return (
      <div style={{ display: 'inline-flex', background: P.surface3, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, padding: 3, gap: 2 }}>
        {OPTS.map(function (o) {
          const on = value.has(o.key);
          const c = counts[o.key] || 0;
          return <button key={o.key} data-hw-i onClick={function () { toggle(o.key); }} aria-pressed={on}
            title={o.key === 'unstated' ? 'No strain word found in the product name — not the same as "no strain."' : undefined}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: P.ctrlH.sm, padding: '5px 10px',
              background: on ? P.surface : 'transparent', border: 'none', borderRadius: 7, cursor: 'pointer',
              fontFamily: P.fontSans, fontSize: 12.5, fontWeight: 600, color: on ? o.color : P.inkDim,
              boxShadow: on ? P.shadowSm : 'none', transition: 'background .12s, color .12s' }}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: o.color, opacity: o.key === 'unstated' || o.key === 'mixed' ? 0.5 : 1 }} />
            {o.label}
            <span style={{ fontFamily: P.fontMono, fontSize: 10.5, fontWeight: 700, color: o.color,
              background: o.color + (P.mode === 'dark' ? '28' : '1f'), padding: '1px 6px', borderRadius: 99 }}>{c}</span>
          </button>;
        })}
      </div>);
  }

  // ── Price filter — preset bands for the common case (95% of the catalog
  // sits under $100), a sqrt-scaled dual slider for an exact custom range.
  function PriceRangeFilter({ groups, bounds, value, onChange }) {
    const P = useP();
    const bandCounts = React.useMemo(function () {
      const m = {};
      PRICE_BANDS.forEach(function (b) { m[b.key] = 0; });
      groups.forEach(function (g) {
        const inBand = {};
        g.rows.forEach(function (r) {
          const v = priceCompareValue(r);
          PRICE_BANDS.forEach(function (b) { if (v >= b.lo && v < b.hi) { inBand[b.key] = true; } });
        });
        Object.keys(inBand).forEach(function (k) { m[k]++; });
      });
      return m;
    }, [groups]);
    const priceHistogram = React.useMemo(function () {
      const buckets = new Array(15).fill(0);
      groups.forEach(function (g) {
        g.rows.forEach(function (r) {
          const idx = Math.min(buckets.length - 1, Math.floor(priceCompareValue(r) / 25));
          if (idx >= 0) { buckets[idx]++; }
        });
      });
      return buckets;
    }, [groups]);
    const [customOpen, setCustomOpen] = React.useState(!!value.custom);
    const [draftMin, setDraftMin] = React.useState(value.custom ? value.custom.min : bounds.min);
    const [draftMax, setDraftMax] = React.useState(value.custom ? value.custom.max : bounds.max);
    const label = value.custom ? ('$' + value.custom.min + '–$' + value.custom.max)
      : value.bands.size ? [...value.bands].map(function (k) { return PRICE_BANDS.filter(function (b) { return b.key === k; })[0].label; }).join(', ')
      : 'Price';
    const active = value.bands.size > 0 || !!value.custom;
    return (
      <FilterPopover width={300} trigger={
        <button data-hw-i style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: P.ctrlH.sm, padding: '0 12px',
          borderRadius: P.r999, border: `1px solid ${active ? P.hairline3 : P.hairline2}`, background: active ? P.highlightSoft : P.surface,
          color: active ? P.ink : P.ink2, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans, whiteSpace: 'nowrap' }}>
          <Icon name="tag" size={12.5} stroke={1.9} />{label}
          <Icon name="chevron-down" size={12} stroke={2.2} />
        </button>}>
        {function (popover) { return <React.Fragment>
          <Spark data={priceHistogram} color={P.accent} fill height={28} width={280} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '8px 0' }}>
            {PRICE_BANDS.map(function (b) {
              const on = value.bands.has(b.key);
              return <PBtn key={b.key} size="xs" variant={on ? 'accent' : 'secondary'}
                onClick={function () {
                  const n = new Set(value.bands);
                  n.has(b.key) ? n.delete(b.key) : n.add(b.key);
                  setCustomOpen(false);
                  onChange({ bands: n, custom: null });
                }}>
                {b.label} <span style={{ fontFamily: P.fontMono, opacity: 0.7 }}>{bandCounts[b.key]}</span>
              </PBtn>;
            })}
          </div>
          <button data-hw-i onClick={function () { setCustomOpen(function (v) { return !v; }); }}
            style={{ font: 'inherit', fontSize: P.type.meta, fontWeight: 600, color: P.info, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
            {customOpen ? 'Hide custom range' : 'Custom range…'}
          </button>
          {customOpen && <React.Fragment>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '6px 0', gap: 8 }}>
              <Field size="sm" mono value={draftMin} onChange={function (e) { setDraftMin(+e.target.value || 0); }} style={{ width: 90 }} />
              <span style={{ color: P.inkMute }}>–</span>
              <Field size="sm" mono value={draftMax} onChange={function (e) { setDraftMax(+e.target.value || 0); }} style={{ width: 90 }} />
            </div>
            <DualRange min={bounds.min} max={bounds.max} valueMin={draftMin} valueMax={draftMax}
              toPos={sqrtToPos} toValue={sqrtToValue} formatLabel={function (v) { return '$' + Math.round(v); }}
              onChange={function (lo, hi) { setDraftMin(Math.round(lo)); setDraftMax(Math.round(hi)); }} />
          </React.Fragment>}
          <div style={{ fontSize: P.type.micro, color: P.inkMute, marginTop: 8, lineHeight: 1.5 }}>
            Matches a product if any of its listed prices fall in range — using the verified pre-tax
            price where we have it, the listed price otherwise ({groups.length ? Math.round(1000 * groups.filter(function (g) { return g.rows.some(knownBasis); }).length / groups.length) / 10 : 0}% of groups have one).
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <PBtn variant="ghost" size="xs" onClick={function () { onChange({ bands: new Set(), custom: null }); setCustomOpen(false); }}>Reset</PBtn>
            {customOpen &&
              <PBtn variant="accent" size="xs" onClick={function () { onChange({ bands: new Set(), custom: { min: draftMin, max: draftMax } }); popover.close(); }}>Apply custom range</PBtn>}
          </div>
        </React.Fragment>; }}
      </FilterPopover>);
  }

  // ── Active filter chips — one chip per applied VALUE, not per dimension ───
  function ActiveFilterChips({ chips, onRemove, onClearAll }) {
    const P = useP();
    if (chips.length === 0) { return null; }
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
        {chips.map(function (c) {
          return <button key={c.id} data-hw-i onClick={function () { onRemove(c.id); }} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px',
            borderRadius: P.r999, border: `1px solid ${P.hairline3}`, background: P.highlightSoft,
            color: P.ink, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}>
            <span style={{ color: P.inkMute, fontWeight: 500 }}>{c.dimensionLabel}:</span> {c.valueLabel}
            <Icon name="x" size={11} stroke={2.2} color={P.inkMute} />
          </button>;
        })}
        <button data-hw-i onClick={onClearAll} style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none',
          color: P.inkDim, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans, padding: '5px 6px' }}>
          <Icon name="x" size={12} stroke={2} />Clear all ({chips.length})
        </button>
      </div>);
  }

  function ResultCount({ shown, total, activeCount }) {
    const P = useP();
    return (
      <div style={{ fontSize: P.type.meta, color: P.inkDim }}>
        {activeCount === 0
          ? `${total} product group${total === 1 ? '' : 's'}`
          : `Showing ${shown} of ${total} product group${total === 1 ? '' : 's'}`}
      </div>);
  }

  // Price hierarchy, top to bottom, highest to lowest — no strikethrough
  // (the owner's explicit call: hard to read, not worth it). Each line is a
  // real number that exists in the data, in the order a person would explain
  // the price out loud: what it used to cost, why it's cheaper now, what it
  // costs today, and — only when it adds real information — what that comes
  // out to before tax.
  function SubRow({ row, pinned, onTogglePin }) {
    const P = useP();
    const onSale = row.was_price != null && row.was_price > row.price;
    const pct = onSale ? Math.round((1 - row.price / row.was_price) * 100) : 0;
    const preTax = effectivePreTax(row);
    const showPreTaxLine = preTax != null && row.price_tax_basis === 'inclusive';
    const taxNote = row.price_tax_basis === 'inclusive' ? 'tax incl.'
      : row.price_tax_basis === 'exclusive' ? '+ tax at checkout'
      : null;
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px 10px 30px',
        borderTop: `1px solid ${P.hairline}`, background: P.surface2
      }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: sourceDot(P, row.source), flex: '0 0 auto' }} />
        <div style={{ minWidth: 0, flex: '1 1 240px' }}>
          <div style={{ fontSize: P.type.body, fontWeight: 600, color: P.ink, display: 'flex', alignItems: 'center', gap: 6 }}>
            {row.store_name || sourceLabel(row.source)}
            {row.store_city &&
              <span title={row.store_city} style={{ fontSize: P.type.micro, fontWeight: 700, color: P.inkMute,
                background: P.surface3, padding: '1px 6px', borderRadius: 99, whiteSpace: 'nowrap' }}>{primaryCity(row.store_city)}</span>}
          </div>
          <div style={{ fontSize: P.type.meta, color: P.inkDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={row.product_name}>{row.product_name}</div>
        </div>
        <div style={{ flex: '0 0 auto', textAlign: 'right', minWidth: 160 }}>
          {onSale &&
            <div style={{ fontSize: P.type.micro, color: P.inkMute, fontFamily: P.fontMono }}>
              List {money(row.was_price)} <span style={{ color: P.bad, fontWeight: 700 }}>· {pct}% off</span>
            </div>}
          <div style={{ fontSize: P.type.numRow, fontWeight: 800, fontFamily: P.fontMono, color: P.ink }}>
            {money(row.price)}
            {taxNote && <span style={{ fontSize: P.type.micro, fontWeight: 600, color: P.inkMute }}> {taxNote}</span>}
          </div>
          {showPreTaxLine &&
            <div style={{ fontSize: P.type.body, fontWeight: 700, fontFamily: P.fontMono, color: P.good }}>
              {money(preTax)} <span style={{ fontSize: P.type.micro, fontWeight: 600, color: P.inkMute }}>pre-tax</span>
            </div>}
        </div>
        <div style={{ flex: '0 0 auto' }}>
          <TaxChip row={row} pinned={pinned} onTogglePin={onTogglePin} />
        </div>
      </div>);
  }

  // Above this many DISTINCT sources, a group collapses to the stat strip +
  // "View all" trigger instead of listing every row inline. Grounded in the
  // real distribution (scratch/pricing-collapsed-summary-design.md Part 0/4):
  // 59% of real multi-source groups have <=8 sources and are completely
  // unaffected by this; the 41% above it are exactly the population capable
  // of producing a 40+-row wall (the owner's real Blue Dream example, 44
  // sources). Threshold is on distinctSourceCount, never rows.length — same
  // rule this file already enforces everywhere else that distinguishes a
  // same-source duplicate from a real competitor spread.
  const SOURCE_COLLAPSE_THRESHOLD = 8;

  // headline: the existing spread/same-source-duplicate pill. Pulled out to
  // its own pure function so GroupCard's render and estimateGroupHeight's
  // estimate can never drift apart on when it renders.
  function computeHeadline(group) {
    const rows = group.rows;
    const multi = rows.length > 1;
    const knownRows = rows.filter(knownBasis);
    if (group.multiSource && knownRows.length >= 2) {
      const lo = Math.min.apply(null, knownRows.map(function (r) { return r.pre_tax_price; }));
      const hi = Math.max.apply(null, knownRows.map(function (r) { return r.pre_tax_price; }));
      const spreadPct = lo > 0 ? Math.round(((hi - lo) / lo) * 100) : 0;
      return { kind: spreadPct > 0 ? 'info' : 'neutral', label: `${spreadPct}% spread across sources` };
    }
    if (!group.multiSource && multi) {
      // Same-source duplicate/near-duplicate listings (e.g. Kushy Punch
      // Watermelon Indica 100mg — two dutchie_embed rows that merged only
      // because "Original" is in STOPWORDS). This is real, useful
      // information — this source has duplicate catalog entries — but it is
      // NOT a competitor price spread, and must never be labeled as one.
      return { kind: 'warn', label: `Same-source duplicate (${group.distinctSourceCount} source, ${rows.length} listings)` };
    }
    return null;
  }

  // Average FULL (non-promotional) price across retailers — the owner's
  // explicit spec: no sale pricing in the average. One value per DISTINCT
  // real competitor (competitorKey, not the raw platform `source` — two
  // different STIIIZY store locations must both count), only from rows
  // where a tax-honest comparable figure exists (see comparableFullPrice).
  function computeAvgFull(group) {
    const comparableBySource = new Map();
    group.rows.forEach(function (r) {
      const key = competitorKey(r);
      if (comparableBySource.has(key)) { return; }
      const v = comparableFullPrice(r);
      if (v != null) { comparableBySource.set(key, v); }
    });
    const values = [...comparableBySource.values()];
    return { value: values.length >= 2 ? values.reduce(function (a, b) { return a + b; }, 0) / values.length : null, count: values.length };
  }

  // Cheapest / Most Expensive — a DIFFERENT question from the average
  // ("what's the normal underlying price" vs. "what could someone pay a
  // competitor today"), so deliberately sale-INCLUSIVE: with 57-80% of live
  // rows on sale depending on platform, excluding sale prices would report a
  // "floor" nobody can actually pay.
  //
  // REAL BUG FOUND live (2026-09-07) using priceCompareValue here: it falls
  // back to raw `price` when a row has no resolved pre_tax_price, which
  // silently compares one store's tax-normalized figure against another
  // store's still-tax-inclusive raw number — e.g. STIIIZY Wildomar and
  // STIIIZY Pomona sell the exact same product at the exact same $34.17
  // tax-inclusive price, but only Wildomar has a researched tax rate, so the
  // old code reported "$27.32 cheapest" vs "$34.17 most expensive" — a
  // fabricated spread that was really just "who has a computed pre-tax
  // figure," not a real price difference. Uses effectivePreTax instead,
  // which returns null (excluded, never a silent raw fallback) whenever a
  // row can't be honestly normalized to pre-tax — same rule this file
  // already enforces everywhere else that touches tax basis. Deduped by
  // competitorKey, same reasoning as the average.
  function computeExtremes(group) {
    const bySource = new Map();
    group.rows.forEach(function (r) {
      const key = competitorKey(r);
      if (!bySource.has(key)) { bySource.set(key, r); }
    });
    let cheapest = null, priciest = null, comparableCount = 0;
    bySource.forEach(function (r) {
      const v = effectivePreTax(r);
      if (v == null) { return; }
      comparableCount++;
      if (!cheapest || v < cheapest.value) { cheapest = { value: v, row: r }; }
      if (!priciest || v > priciest.value) { priciest = { value: v, row: r }; }
    });
    // Fewer than 2 honestly-comparable prices means there's nothing to call
    // "cheapest vs. most expensive" — a single value isn't a range, and
    // showing one row's price as both extremes would look like a real
    // comparison that never happened.
    if (comparableCount < 2) { return { cheapest: null, priciest: null, comparableCount: comparableCount }; }
    return { cheapest: cheapest, priciest: priciest, comparableCount: comparableCount };
  }

  // One cell of the Cheapest / Avg / Most-Expensive strip. Never a blanket
  // tax-basis label for the pair — each extreme can legitimately come from a
  // row with a different basis, so each gets its own badge, same ternary
  // SubRow already uses for its own price line.
  function PriceLadderCell({ label, value, row, isAvg, avgMeta }) {
    const P = useP();
    const onSale = row && row.was_price != null && row.was_price > row.price;
    const pct = onSale ? Math.round((1 - row.price / row.was_price) * 100) : 0;
    const known = row && knownBasis(row);
    const taxNote = !row ? null
      : known ? 'pre-tax'
      : row.price_tax_basis === 'inclusive' ? 'tax incl.'
      : row.price_tax_basis === 'exclusive' ? '+ tax at checkout'
      : null;
    return (
      <div style={{ flex: 1, minWidth: 0, padding: '12px 16px' }}>
        <div style={{ fontSize: P.type.micro, fontWeight: 700, letterSpacing: '.03em', color: P.inkMute, textTransform: 'uppercase' }}>{label}</div>
        <div style={{ fontSize: P.type.strong, fontWeight: 800, fontFamily: P.fontMono, color: P.ink, whiteSpace: 'nowrap' }}>
          {money(value)}
          {taxNote && <span style={{ fontSize: P.type.micro, fontWeight: 600, color: known ? P.good : P.inkMute }}> {taxNote}</span>}
        </div>
        <div style={{ fontSize: P.type.micro, color: P.inkFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {isAvg ? `${avgMeta.count} of ${avgMeta.total} sources · no promo pricing`
            : <React.Fragment>{row.store_name || sourceLabel(row.source)}{onSale && <span style={{ color: P.bad, fontWeight: 700 }}> · {pct}% off</span>}</React.Fragment>}
        </div>
      </div>);
  }

  function GroupCard({ group, pinned, onTogglePin, onExpand }) {
    const P = useP();
    const CATMETA = categoryMeta(P);
    const catBucket = categoryBucket(group.category);
    const catLabel = CATMETA[catBucket] ? CATMETA[catBucket].label : group.category;
    const rows = group.rows;
    const multi = rows.length > 1;
    const multiSource = group.multiSource; // 2+ DISTINCT sources — see header comment
    const headline = computeHeadline(group);
    const avg = multiSource ? computeAvgFull(group) : null;
    const extremes = multiSource ? computeExtremes(group) : null;
    const collapsed = multiSource && group.distinctSourceCount > SOURCE_COLLAPSE_THRESHOLD;

    return (
      <Card density="default" style={{ padding: 0, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '14px 16px', background: P.surface }}>
          <div style={{ minWidth: 0, flex: '1 1 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {/* Brand name — prominent, not tucked into secondary text. This
                  is the owner's explicit correction: "make sure you also
                  include the brand name," said because it had been an
                  afterthought before. */}
              <span style={{
                fontSize: P.type.strong, fontWeight: 800, color: P.ink, padding: '2px 9px',
                borderRadius: P.r8, background: P.accentSoft, border: `1px solid ${P.accentBorder}`
              }}>{group.brandDisplay}</span>
              <span style={{ fontSize: P.type.title, fontWeight: 700, color: P.ink }}>{group.nameDisplay}</span>
              <Pill kind="neutral" size="sm" label={group.weight} />
              {catLabel && <Pill kind="ghost" size="sm" label={catLabel} />}
            </div>
            <div style={{ marginTop: 6, fontSize: P.type.meta, color: P.inkMute }}>
              {group.distinctSourceCount} source{group.distinctSourceCount === 1 ? '' : 's'} tracked
              {rows.length !== group.distinctSourceCount && ` (${rows.length} listings)`}
              {!multi && ' — no cross-source match yet, this is the honest common case right now'}
              {!multiSource && multi && ' — duplicate/near-duplicate listings from the same source, not a competitor match'}
            </div>
          </div>
          {headline && <Pill kind={headline.kind} label={headline.label} />}
        </div>

        {multiSource && (extremes.cheapest || avg.value != null) &&
          <div style={{ display: 'flex', background: P.surface2, borderTop: `1px solid ${P.hairline}` }}>
            {extremes.cheapest &&
              <PriceLadderCell label="Cheapest" value={extremes.cheapest.value} row={extremes.cheapest.row} />}
            {avg.value != null &&
              <div style={{ display: 'flex', borderLeft: extremes.cheapest ? `1px solid ${P.hairline}` : 'none' }}>
                <PriceLadderCell label="Avg full price" value={avg.value} isAvg avgMeta={{ count: avg.count, total: group.distinctSourceCount }} />
              </div>}
            {extremes.priciest &&
              <div style={{ display: 'flex', borderLeft: `1px solid ${P.hairline}` }}>
                <PriceLadderCell label="Most expensive" value={extremes.priciest.value} row={extremes.priciest.row} />
              </div>}
          </div>}

        {collapsed
          ? <button data-hw-i onClick={function () { onExpand(group.key); }} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%',
              minHeight: P.ctrlH.sm, background: P.surface2, borderTop: `1px solid ${P.hairline}`,
              borderLeft: 'none', borderRight: 'none', borderBottom: 'none',
              color: P.info, fontFamily: P.fontSans, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
              Show all {group.distinctSourceCount} stores <Icon name="chevron-down" size={13} stroke={2.2} />
            </button>
          : group.sortedRows.map(function (r, i) {
              return <SubRow key={r.id} row={r} pinned={pinned} onTogglePin={onTogglePin}
                isLast={i === group.sortedRows.length - 1} />;
            })}
      </Card>);
  }

  // Full per-store list for a collapsed group, reached via "Show all N
  // stores" — an overlay rather than growing the card in place. This keeps a
  // collapsed group's rendered height fixed regardless of what the user does
  // (the virtualizer below assumes exactly that), and reuses the same
  // scrim/card pattern already powering every other "see full detail" modal
  // in this app (drawer.jsx, product-sheet.jsx, etc) rather than inventing a
  // second one.
  function ExpandedGroupModal({ group, pinned, onTogglePin, onClose }) {
    const P = useP();
    React.useEffect(function () {
      function onKey(e) { if (e.key === 'Escape') { onClose(); } }
      window.addEventListener('keydown', onKey);
      return function () { window.removeEventListener('keydown', onKey); };
    }, [onClose]);
    return (
      <div onClick={onClose} style={overlayScrim(P, { padding: '40px 20px', animate: true })}>
        <div onClick={function (e) { e.stopPropagation(); }}
          style={{ ...overlayCard, width: 'min(680px, 96vw)', maxHeight: '85vh', display: 'flex', flexDirection: 'column',
            background: P.surface, borderRadius: P.r20, boxShadow: P.shadowLg, border: `1px solid ${P.hairline2}`, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px', borderBottom: `1px solid ${P.hairline}` }}>
            <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: P.type.strong, fontWeight: 800, color: P.ink, padding: '2px 9px', borderRadius: P.r8, background: P.accentSoft, border: `1px solid ${P.accentBorder}` }}>{group.brandDisplay}</span>
              <span style={{ fontSize: P.type.title, fontWeight: 700, color: P.ink }}>{group.nameDisplay}</span>
              <Pill kind="neutral" size="sm" label={group.weight} />
            </div>
            <button data-hw-i onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: P.inkMute, padding: 4 }}>
              <Icon name="x" size={18} stroke={2} />
            </button>
          </div>
          <div style={{ overflowY: 'auto', overscrollBehavior: 'contain' }}>
            {group.sortedRows.map(function (r, i) {
              return <SubRow key={r.id} row={r} pinned={pinned} onTogglePin={onTogglePin}
                isLast={i === group.sortedRows.length - 1} />;
            })}
          </div>
        </div>
      </div>);
  }

  // ── virtualized list ───────────────────────────────────────────────────
  // The dataset outgrew "just .map() every card": a single statewide scrape
  // added 5,180 rows in one pass, and this screen's own filter bar is built
  // for a dataset that keeps growing, not a fixed size. Mounting one
  // GroupCard (each with N SubRows) per group for a 9,000+-row, unfiltered
  // "All sources" view is a real, measured cost — large DOM, slow initial
  // paint. Height is estimated deterministically from each row's own known
  // shape (sale line? pre-tax line?) rather than measured after render —
  // this project's data makes exact height computable ahead of time, so
  // there's no need for the reflow-and-remeasure dance a true "unknown
  // content" virtualizer needs. A small overscan buffer absorbs the
  // estimate's minor drift; it only has to be close, not exact.
  const CARD_MARGIN = 14;
  const HEADER_BASE = 80;
  const HEADER_HEADLINE_EXTRA = 24; // the spread/duplicate pill, when present
  const STRIP_HEIGHT = 72; // the Cheapest/Avg/Most-expensive band
  const EXPAND_BAR_HEIGHT = 40; // "Show all N stores" bar, collapsed groups only
  const ROW_BASE = 54;
  const ROW_SALE_EXTRA = 16;
  const ROW_PRETAX_EXTRA = 18;
  // Collapsed groups (see SOURCE_COLLAPSE_THRESHOLD) render a FIXED height
  // regardless of distinctSourceCount — that's the entire point: a 44-source
  // group and a 9-source group cost the virtualizer the same, because the
  // expand action opens a modal (ExpandedGroupModal) rather than growing the
  // card in place. Only non-collapsed groups (solo, same-source-duplicate,
  // or multi-source at/under the threshold) still sum real row heights.
  function estimateGroupHeight(g) {
    let h = HEADER_BASE + CARD_MARGIN + (computeHeadline(g) ? HEADER_HEADLINE_EXTRA : 0);
    if (g.multiSource) {
      h += STRIP_HEIGHT;
      if (g.distinctSourceCount > SOURCE_COLLAPSE_THRESHOLD) {
        return h + EXPAND_BAR_HEIGHT;
      }
    }
    g.rows.forEach(function (r) {
      let rh = ROW_BASE;
      if (r.was_price != null && r.was_price > r.price) { rh += ROW_SALE_EXTRA; }
      if (r.price_tax_basis === 'inclusive' && effectivePreTax(r) != null) { rh += ROW_PRETAX_EXTRA; }
      h += rh;
    });
    return h;
  }

  // Walk up from a node to whatever ancestor actually scrolls (POS-Admin's
  // own shell puts overflowY:auto on <main>, not the window) — falls back
  // to the window/document if nothing closer scrolls.
  function getScrollParent(el) {
    let node = el ? el.parentElement : null;
    while (node && node !== document.body) {
      const cs = window.getComputedStyle(node);
      if (/(auto|scroll)/.test(cs.overflowY)) { return node; }
      node = node.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  }

  function VirtualizedGroups({ groups, pinned, onTogglePin, onExpand }) {
    const rootRef = React.useRef(null);
    const [scrollParent, setScrollParent] = React.useState(null);
    const [viewport, setViewport] = React.useState({ scrollTop: 0, height: 900, topOffset: 0 });

    const offsets = React.useMemo(function () {
      const arr = new Array(groups.length + 1);
      arr[0] = 0;
      for (let i = 0; i < groups.length; i++) { arr[i + 1] = arr[i] + estimateGroupHeight(groups[i]); }
      return arr;
    }, [groups]);
    const totalHeight = offsets[offsets.length - 1] || 0;

    React.useEffect(function () {
      if (!rootRef.current) { return; }
      const sp = getScrollParent(rootRef.current);
      setScrollParent(sp);
      const isWin = sp === document.scrollingElement || sp === document.documentElement;
      let ticking = false;
      function measure() {
        ticking = false;
        if (!rootRef.current) { return; }
        const rect = rootRef.current.getBoundingClientRect();
        const spTop = isWin ? 0 : sp.getBoundingClientRect().top;
        const scrollTop = isWin ? window.scrollY : sp.scrollTop;
        const height = isWin ? window.innerHeight : sp.clientHeight;
        setViewport({ scrollTop: scrollTop, height: height, topOffset: rect.top - spTop + scrollTop });
      }
      function onScroll() { if (!ticking) { ticking = true; window.requestAnimationFrame(measure); } }
      measure();
      const target = isWin ? window : sp;
      target.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
      return function () { target.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
    }, [groups.length]);

    const OVERSCAN = 800;
    function findIndex(target) {
      let lo = 0, hi = Math.max(0, offsets.length - 2);
      while (lo < hi) { const mid = (lo + hi) >> 1; if (offsets[mid + 1] <= target) { lo = mid + 1; } else { hi = mid; } }
      return lo;
    }
    const relTop = Math.max(0, viewport.scrollTop - viewport.topOffset - OVERSCAN);
    const relBottom = viewport.scrollTop - viewport.topOffset + viewport.height + OVERSCAN;
    const startIdx = groups.length ? findIndex(relTop) : 0;
    const endIdx = groups.length ? Math.min(groups.length, findIndex(relBottom) + 1) : 0;

    return (
      <div ref={rootRef} style={{ position: 'relative', height: totalHeight }}>
        {groups.slice(startIdx, endIdx).map(function (g, i) {
          const idx = startIdx + i;
          return <div key={g.key} style={{ position: 'absolute', top: offsets[idx], left: 0, right: 0 }}>
            <GroupCard group={g} pinned={pinned} onTogglePin={onTogglePin} onExpand={onExpand} />
          </div>;
        })}
      </div>);
  }

  window.PricingScreen = function PricingScreen() {
    const P = useP();
    const [http, setHttp] = React.useState(null);
    const [facetsHttp, setFacetsHttp] = React.useState(null);
    const [tick, setTick] = React.useState(0);
    const [q, setQ] = React.useState('');
    const [sourceFilter, setSourceFilter] = React.useState('all');
    const [categoryFilter, setCategoryFilter] = React.useState('all');
    const [brandFilter, setBrandFilter] = React.useState(function () { return new Set(); });
    const [regionFilter, setRegionFilter] = React.useState(function () { return new Set(); });
    const [strainFilter, setStrainFilter] = React.useState(function () { return new Set(); });
    const [priceFilter, setPriceFilter] = React.useState(function () { return { bands: new Set(), custom: null }; });
    const [pinned, setPinned] = React.useState(null);
    // Looked up against `groups` (the full, unfiltered set), not `filtered` —
    // deliberate: a user narrowing an unrelated filter while a modal is open
    // must never make it vanish out from under them. Only clears when the
    // group truly no longer exists (a background refetch changed the data).
    const [expandedGroupKey, setExpandedGroupKey] = React.useState(null);

    React.useEffect(function () {
      let live = true;
      setHttp(null);
      // The server caps `limit` at 2000 per request (server/app.py) — the
      // dataset has grown past that (3,071+ rows and counting as more
      // sources/cities are added), so a single fetch silently truncates it.
      // Page through with `total` from the first response until every row
      // is in, rather than re-raising the single-request cap (which would
      // just move this bug to the next time the dataset grows again).
      const PAGE = 2000;
      function loadAll(offset, acc, firstMeta) {
        return getJSON(ROUTE_LISTINGS + '?' + qs({ limit: PAGE, offset: offset })).then(function (r) {
          if (!live) { return; }
          if (!r.ok || !r.parsed || !r.body || !Array.isArray(r.body.listings)) { setHttp(r); return; }
          const meta = firstMeta || r.body;
          const rows = acc.concat(r.body.listings);
          if (rows.length < meta.total && r.body.listings.length > 0) {
            return loadAll(offset + PAGE, rows, meta);
          }
          setHttp({ url: r.url, code: r.code, ok: true, body: { total: meta.total, count: rows.length, limit: PAGE, offset: 0, listings: rows }, parsed: true, raw: r.raw });
        });
      }
      loadAll(0, [], null);
      return function () { live = false; };
    }, [tick]);

    React.useEffect(function () {
      let live = true;
      getJSON(ROUTE_FACETS).then(function (r) { if (live) { setFacetsHttp(r); } });
      return function () { live = false; };
    }, [tick]);

    const allRows = (http && http.ok && http.parsed && http.body && Array.isArray(http.body.listings)) ? http.body.listings : [];
    const facets = (facetsHttp && facetsHttp.ok && facetsHttp.parsed) ? facetsHttp.body : null;

    // ── build groups — see file header for the matching-logic rationale ────
    const groups = React.useMemo(function () {
      const byKey = new Map();
      allRows.forEach(function (row) {
        const key = groupKey(row) || ('solo:' + row.source + ':' + row.id);
        if (!byKey.has(key)) { byKey.set(key, []); }
        byKey.get(key).push(row);
      });
      const out = [];
      byKey.forEach(function (rows, key) {
        // Sort: ascending pre_tax_price, known-basis rows first — the doc's
        // rule verbatim. Unknown-basis rows sink to the bottom, unranked.
        const sorted = rows.slice().sort(function (a, b) {
          const ka = knownBasis(a), kb = knownBasis(b);
          if (ka !== kb) { return ka ? -1 : 1; }
          if (ka && kb) { return a.pre_tax_price - b.pre_tax_price; }
          return 0;
        });
        const first = rows[0];
        const weight = extractWeight(first.product_name);
        const name = displayName(rows);
        // A group with 2+ rows is not automatically a competitor match — the
        // Kushy Punch Watermelon Indica 100mg group (id 100 vs id 102, both
        // dutchie_embed) is 2 rows from ONE source, merged only because
        // "Original" is in STOPWORDS. distinctSourceCount / multiSource is
        // the only thing allowed to mean "spread across sources" anywhere in
        // this file — rows.length alone must never be read that way again.
        const sourceSet = new Set(rows.map(competitorKey));
        out.push({
          key: key,
          rows: rows,
          sortedRows: sorted,
          brandDisplay: first.brand ? titleCase(first.brand) : '(brand unknown)',
          nameDisplay: name || first.product_name,
          weight: weight ? weight.norm : '—',
          category: first.category || null,
          distinctSourceCount: sourceSet.size,
          multiSource: sourceSet.size > 1
        });
      });
      return out;
    }, [allRows]);

    const expandedGroup = expandedGroupKey
      ? groups.filter(function (g) { return g.key === expandedGroupKey; })[0] || null
      : null;

    const priceBounds = React.useMemo(function () {
      if (!allRows.length) { return { min: 0, max: 0 }; }
      let min = Infinity, max = -Infinity;
      allRows.forEach(function (r) { if (r.price < min) { min = r.price; } if (r.price > max) { max = r.price; } });
      return { min: min, max: max };
    }, [allRows]);

    const filtered = React.useMemo(function () {
      const needle = q.trim().toLowerCase();
      return groups.filter(function (g) {
        if (sourceFilter !== 'all' && !g.rows.some(function (r) { return r.source === sourceFilter; })) { return false; }
        if (categoryFilter !== 'all' && !g.rows.some(function (r) { return categoryBucket(r.category) === categoryFilter || (categoryFilter === 'uncategorized' && ['uncategorized', 'misfiled'].indexOf(categoryBucket(r.category)) >= 0); })) { return false; }
        if (brandFilter.size > 0 && !g.rows.some(function (r) { return brandFilter.has(normalizeBrand(r.brand) || '__unbranded__'); })) { return false; }
        if (regionFilter.size > 0 && !g.rows.some(function (r) { return regionFilter.has(primaryCity(r.store_city) || '__unknown__'); })) { return false; }
        if (strainFilter.size > 0 && !g.rows.some(function (r) { return strainBuckets(r.product_name).some(function (b) { return strainFilter.has(b); }); })) { return false; }
        if (priceFilter.bands.size > 0 && !g.rows.some(function (r) {
          const v = priceCompareValue(r);
          return [...priceFilter.bands].some(function (k) { const b = PRICE_BANDS.filter(function (pb) { return pb.key === k; })[0]; return v >= b.lo && v < b.hi; });
        })) { return false; }
        if (priceFilter.custom && !g.rows.some(function (r) { const v = priceCompareValue(r); return v >= priceFilter.custom.min && v <= priceFilter.custom.max; })) { return false; }
        if (needle) {
          const hay = (g.brandDisplay + ' ' + g.nameDisplay + ' ' + g.rows.map(function (r) { return r.product_name; }).join(' ')).toLowerCase();
          if (hay.indexOf(needle) < 0) { return false; }
        }
        return true;
      }).sort(function (a, b) {
        // Real cross-source matches first — that's the content this screen
        // exists to surface — ranked by distinct source count, NOT row count
        // (a 2-row same-source duplicate group must not outrank a 1-row
        // solo group in this ordering). Alphabetical by brand + name after
        // that, for predictability.
        if (a.distinctSourceCount !== b.distinctSourceCount) { return b.distinctSourceCount - a.distinctSourceCount; }
        return (a.brandDisplay + a.nameDisplay).localeCompare(b.brandDisplay + b.nameDisplay);
      });
    }, [groups, q, sourceFilter, categoryFilter, brandFilter, regionFilter, strainFilter, priceFilter]);

    const totalListings = facets ? facets.total_listings : allRows.length;
    const taxVerified = allRows.filter(function (r) { return r.price_tax_basis && r.price_tax_basis !== 'unknown'; }).length;
    // Deliberately a SEPARATE count from taxVerified, never implied to be the
    // same number. Verified live: 1,212 rows have a known price_tax_basis but
    // only 498 have a non-null pre_tax_price — a known basis does not mean
    // the pre-tax figure was actually computed. Collapsing these two into one
    // stat is exactly the "someone reaches for `price` because it's always
    // populated" regression the redesign doc warns about, one level up.
    const preTaxKnown = allRows.filter(function (r) { return r.pre_tax_price != null; }).length;
    // Counts groups with 2+ DISTINCT sources only — a same-source duplicate
    // group (e.g. Kushy Punch Watermelon Indica 100mg, 2 dutchie_embed rows
    // merged only because "Original" is in STOPWORDS) is not a competitor
    // match and must not inflate this KPI. See groupKey's multiSource field.
    const multiSourceGroups = groups.filter(function (g) { return g.multiSource; }).length;

    const sourceOptions = [{ value: 'all', label: 'All sources' }].concat(
      (facets && Array.isArray(facets.sources) ? facets.sources : []).map(function (s) { return { value: s, label: sourceLabel(s) }; }));

    const strainCounts = React.useMemo(function () {
      const m = { indica: 0, sativa: 0, hybrid: 0, mixed: 0, unstated: 0 };
      groups.forEach(function (g) {
        const buckets = new Set();
        g.rows.forEach(function (r) { strainBuckets(r.product_name).forEach(function (b) { buckets.add(b); }); });
        buckets.forEach(function (b) { m[b]++; });
      });
      return m;
    }, [groups]);

    const CATEGORY_META_LOOKUP = categoryMeta(P);
    const activeChips = [];
    if (categoryFilter !== 'all') {
      activeChips.push({ id: 'cat', dimensionLabel: 'Category',
        valueLabel: categoryFilter === 'uncategorized' ? 'Not categorized' : CATEGORY_META_LOOKUP[categoryFilter].label,
        onRemove: function () { setCategoryFilter('all'); } });
    }
    [...brandFilter].forEach(function (k) {
      activeChips.push({ id: 'brand:' + k, dimensionLabel: 'Brand', valueLabel: k === '__unbranded__' ? 'Not listed' : titleCase(k),
        onRemove: function () { setBrandFilter(function (prev) { const n = new Set(prev); n.delete(k); return n; }); } });
    });
    [...regionFilter].forEach(function (k) {
      activeChips.push({ id: 'region:' + k, dimensionLabel: 'Region', valueLabel: k === '__unknown__' ? 'Unknown' : k,
        onRemove: function () { setRegionFilter(function (prev) { const n = new Set(prev); n.delete(k); return n; }); } });
    });
    [...strainFilter].forEach(function (k) {
      activeChips.push({ id: 'strain:' + k, dimensionLabel: 'Strain', valueLabel: k.charAt(0).toUpperCase() + k.slice(1),
        onRemove: function () { setStrainFilter(function (prev) { const n = new Set(prev); n.delete(k); return n; }); } });
    });
    if (priceFilter.custom) {
      activeChips.push({ id: 'price:custom', dimensionLabel: 'Price', valueLabel: `$${priceFilter.custom.min}–$${priceFilter.custom.max}`,
        onRemove: function () { setPriceFilter({ bands: new Set(), custom: null }); } });
    }
    [...priceFilter.bands].forEach(function (k) {
      const b = PRICE_BANDS.filter(function (pb) { return pb.key === k; })[0];
      activeChips.push({ id: 'price:' + k, dimensionLabel: 'Price', valueLabel: b.label,
        onRemove: function () { setPriceFilter(function (prev) { const n = new Set(prev.bands); n.delete(k); return { bands: n, custom: null }; }); } });
    });
    if (sourceFilter !== 'all') {
      activeChips.push({ id: 'source', dimensionLabel: 'Source', valueLabel: sourceLabel(sourceFilter),
        onRemove: function () { setSourceFilter('all'); } });
    }
    const clearAllFilters = function () {
      setCategoryFilter('all'); setBrandFilter(new Set()); setRegionFilter(new Set());
      setStrainFilter(new Set()); setPriceFilter({ bands: new Set(), custom: null }); setSourceFilter('all');
    };

    return (
      <div onClick={function () { if (pinned) { setPinned(null); } }}>
        <SectionHead level={1} eyebrow="Cross-source pricing"
          title="Pricing"
          subtitle="One row group per product — brand, name and weight — with every competitor's price for it visible at once. No tabbing between sources to compare the same item."
          action={<PBtn icon="refresh" onClick={function (e) { e.stopPropagation(); setTick(tick + 1); }}>Reload</PBtn>} />

        {!http && <div style={{ marginBottom: 18 }}><SkeletonRows rows={4} /></div>}

        {http && !http.ok &&
          <ErrorState
            title={'GET ' + ROUTE_LISTINGS + ' answered ' + (http.code || 'nothing at all')}
            body="The pricing backend (hw-pricing-scraper/server, expected on localhost:8799) did not answer. Nothing below is a report about real pricing — an empty screen here means the server is unreachable, never that there is no data."
            detail={http.netError || ((http.body && http.body.error) || http.raw) || http.url}
            onRetry={function (e) { e && e.stopPropagation(); setTick(tick + 1); }}
            style={{ background: P.badSoft, borderRadius: P.r12, marginBottom: 18 }} />}

        {http && http.ok &&
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(168px,1fr))', gap: 12, marginBottom: 18 }}>
            <KPI label="Listings tracked" value={String(totalListings)} sublabel={`across ${sourceOptions.length - 1} sources`} />
            <KPI label="Tax basis known" value={`${taxVerified} / ${allRows.length}`} sublabel="basis known ≠ pre-tax price known — never conflate the two" />
            <KPI label="Pre-tax price known" value={`${preTaxKnown} / ${allRows.length}`} sublabel="only this figure is ever ranked or compared" />
            <KPI label="Product groups" value={String(groups.length)} sublabel="brand + name + weight" />
            <KPI label="Multi-source matches" value={String(multiSourceGroups)} sublabel="honestly rare right now — not a bug" accent={multiSourceGroups > 0 ? P.good : undefined} />
          </div>}

        {http && http.ok &&
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }} onClick={function (e) { e.stopPropagation(); }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <CategoryFilter groups={groups} value={categoryFilter} onChange={setCategoryFilter} />
              <BrandFilterPricing groups={groups} value={brandFilter} onChange={setBrandFilter} />
              <RegionFilterPricing groups={groups} value={regionFilter} onChange={setRegionFilter} />
              <StrainFilter counts={strainCounts} value={strainFilter} onChange={setStrainFilter} />
              <PriceRangeFilter groups={groups} bounds={priceBounds} value={priceFilter} onChange={setPriceFilter} />
              <Seg value={sourceFilter} onChange={setSourceFilter} options={sourceOptions} size="sm" />
              <div style={{ flex: 1 }} />
              <Field icon="search" placeholder="Search brand or product…" value={q} onChange={(e) => setQ(e.target.value)} size="sm" style={{ maxWidth: 260 }} />
            </div>
            {activeChips.length > 0 &&
              <ActiveFilterChips chips={activeChips} onRemove={function (id) { const c = activeChips.filter(function (x) { return x.id === id; })[0]; if (c) { c.onRemove(); } }} onClearAll={clearAllFilters} />}
            <ResultCount shown={filtered.length} total={groups.length} activeCount={activeChips.length} />
          </div>}

        {http && http.ok && groups.length === 0 &&
          <EmptyState icon="tag" title="The pricing backend answered and listed no rows"
            body="GET /api/pricing/listings returned zero listings. That means the ingest step hasn't populated the database yet, not that pricing is fine." />}

        {http && http.ok && groups.length > 0 && filtered.length === 0 &&
          <EmptyState icon="search" title="No product groups match these filters"
            body="Try clearing the source filter or the search box." />}

        {http && http.ok && filtered.length > 0 &&
          <VirtualizedGroups groups={filtered} pinned={pinned} onTogglePin={setPinned} onExpand={setExpandedGroupKey} />}

        {expandedGroup &&
          <ExpandedGroupModal group={expandedGroup} pinned={pinned} onTogglePin={setPinned}
            onClose={function () { setExpandedGroupKey(null); }} />}
      </div>);
  };
})();
