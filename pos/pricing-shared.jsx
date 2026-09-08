// ── Shared pricing/matching logic — one source of truth ─────────────────────
// Extracted from pos/screen-pricing.jsx so the cross-source matching, tax-
// basis, and full-price functions exist in exactly one place instead of two
// copies that can silently drift. screen-pricing.jsx now destructures these
// from window.HW_PRICING instead of defining its own; pos/product-shell.jsx
// (the shell editor's "Market Pricing" section) is the second consumer this
// extraction exists for.
//
// Every function below is a VERBATIM copy of the logic in screen-pricing.jsx
// (see that file's own header comment for the full rationale behind each
// one — brand/weight normalization, tax-basis honesty rules, etc.). Nothing
// about the matching or tax logic changes here; this file only relocates it.
;(function () {
  'use strict';

  // The pricing backend is a standalone service (server/README.md: "shares
  // nothing with any other live service"). Unlike every other POS-Admin
  // screen, base() must NOT fall back to window.HW_LIVE.base or
  // window.location.origin — those point at the POS-Admin app itself, not
  // this scraper's SQLite-backed API.
  const PRICING_BASE = 'https://hw-pricing-scraper.onrender.com';
  const ROUTE_LISTINGS = '/api/pricing/listings';

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

  // ── grouping key — see screen-pricing.jsx's header comment for the full
  // rationale ──────────────────────────────────────────────────────────────

  const STOPWORDS = { original: 1, the: 1, a: 1, an: 1 }; // purely decorative; see screen-pricing.jsx header

  // Strips ALL whitespace (not just collapsing runs of it) so that the same
  // real brand scraped by different source adapters as "Alien Labs",
  // "ALIEN LABS", and "AlienLabs" (no space at all — confirmed live: 56,938-
  // row dataset, 2026-09) produces one identical key. Casing already merged
  // these; whether a space exists at all did not, so genuinely-identical
  // brands were silently split into non-matching groups.
  //
  // Collision safety: audited against every one of the ~780 distinct live
  // brand strings — every pair that collides once whitespace is removed is a
  // same-brand casing/spacing variant (e.g. "Plug Play"/"PLUGPLAY",
  // "Sun Smoke"/"SunSmoke"). No two distinct real brands were found to share
  // a stripped form, so this is safe to apply unconditionally today. If a
  // future brand is added that WOULD collide with another under this scheme,
  // it must be caught by re-running that audit — not assumed away.
  function normalizeBrand(brand) {
    const b = String(brand || '').toLowerCase().trim().replace(/\s+/g, '');
    return b || null; // null brand never merges — see header comment
  }

  // Human-readable form of the same brand — spacing COLLAPSED (multiple
  // spaces -> one) rather than stripped, so "Alien   Labs" reads correctly.
  // This is what normalizeBrand() itself returned before the whitespace-
  // insensitive matching-key fix above; kept as its own function because two
  // real callers need spaced text, not a matching key: screen-pricing.jsx's
  // Brand filter dropdown label (titleCase() of a space-stripped key turns
  // "Alien Labs" into "Alienlabs") and anywhere else a brand needs to be
  // shown to a person rather than compared to another brand.
  function normalizeBrandSpaced(brand) {
    const b = String(brand || '').toLowerCase().trim().replace(/\s+/g, ' ');
    return b || null;
  }

  // Matches "1g", "3.5g", "100mg", "[1G]", "7g", "1pc", "10pk", etc. Requires
  // a leading digit, so ".5g" (present in real data) intentionally does NOT
  // match — that row falls back to a solo group rather than guessing a
  // weight. Piece-count units (pc/pack/ct/...) are folded via UNIT_SYNONYMS
  // below so "1pc" and "1 each" match as the same weight key.
  const WEIGHT_RE = /(\d+(?:\.\d+)?)\s?(mg|g|ml|oz|pcs|pc|pieces|piece|each|ea|pack|pk|count|ct)\b/i;
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
  // readable) display name, so the two never drift apart on anything but
  // word order.
  function coreWords(productName, brand, weight) {
    let s = String(productName || '').toLowerCase();
    if (brand) {
      // `brand` is normalizeBrand()'s output, which now has ALL internal
      // whitespace stripped (it's a matching key, not display text) — but
      // productName has NOT had its whitespace stripped, so a literal
      // substring match of the whitespace-free brand would never fire here,
      // silently leaving the brand's own words stuck in the product name
      // instead of being removed. Insert an optional-whitespace gap between
      // every character of the brand key so it matches the brand however
      // THIS row happens to space it ("Alien Labs", "AlienLabs", ...).
      const flexBrand = brand.toLowerCase().split('').map(escapeRe).join('\\s*');
      s = s.replace(new RegExp('\\b' + flexBrand + '\\b', 'g'), ' ');
    }
    if (weight) { s = s.replace(new RegExp(escapeRe(weight.raw.toLowerCase()), 'g'), ' '); }
    s = s.replace(/[-–—,:;/|()\[\]*'".]+/g, ' ').replace(/\s+/g, ' ').trim();
    // "preroll"/"pre roll"/"pre-roll" (already space-collapsed to "pre roll"
    // by the punctuation strip above) are the exact same product type across
    // adapters — confirmed live: STIIIZY, Cizi, Seed Junky, Dusties, Presha,
    // Puff, Brite Labs, and Quiet Kings each list the identical product with
    // one source writing "Preroll" and another "Pre-Roll"/"Pre Roll", which
    // otherwise silently fails to merge under the sorted-word matching key.
    // Scoped to this one well-known compound term rather than stripping all
    // internal spacing from product names generally — the latter risks
    // merging genuinely different strain names that happen to share letters
    // (see e.g. the live "GM-UhOh" / "GMUH-OH" strain, a real but much lower-
    // volume, higher-risk case left alone deliberately).
    s = s.replace(/\bpre\s*rolls\b/g, 'prerolls').replace(/\bpre\s*roll\b/g, 'preroll');
    const words = s.split(' ').filter(function (w) { return w && !STOPWORDS[w]; });
    return words;
  }

  // Order-independent on purpose — "Blue Dream Pod" and "Pod Blue Dream" must
  // produce the same key. This is for MATCHING only.
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

  // The real, distinct COMPETITOR a row came from — NOT the scraping
  // platform. A few platforms are shared by multiple real, unrelated stores
  // in different cities; row.source alone would collapse all of them into
  // one bucket. store_name (added project-wide) is the real per-store
  // identity; fall back to source only for the handful of older rows that
  // predate that field.
  function competitorKey(row) { return row.store_name || row.source; }

  function knownBasis(row) {
    return row.price_tax_basis && row.price_tax_basis !== 'unknown' && row.pre_tax_price != null;
  }

  function money(n) {
    return '$' + Number(n).toFixed(2);
  }

  // The pre-tax figure worth SHOWING on a row, without fabricating anything:
  // when basis is 'exclusive', the displayed price is BY DEFINITION already
  // pre-tax (tax is added afterward at checkout) — no computation needed, it
  // is the same number. When basis is 'inclusive' and a city tax rate has
  // been researched, pre_tax_price is the real, separately-computed figure.
  // In every other case (basis unknown, or inclusive with no researched rate
  // yet) there is genuinely nothing to show — returns null, never a guess.
  function effectivePreTax(row) {
    if (row.price_tax_basis === 'exclusive') { return row.price; }
    if (row.price_tax_basis === 'inclusive' && row.pre_tax_price != null) { return row.pre_tax_price; }
    return null;
  }

  // ── "average across retailers" — regular price only, no promo pricing ────
  // Average the NORMAL full price, never a discounted one. fullPrice() undoes
  // an active sale by reading was_price (the pre-discount price every adapter
  // already captures).
  function fullPrice(row) { return (row.was_price != null && row.was_price > row.price) ? row.was_price : row.price; }

  // The full price, tax-normalized the same honest way effectivePreTax() is:
  // 'exclusive' basis means the displayed (full) price already IS pre-tax, no
  // computation needed. 'inclusive' with a researched pre_tax_price for the
  // CURRENT price lets us derive the same store's effective tax multiplier
  // (pre_tax_price / price) and apply it to the full price too — proportional
  // math, not a guess, since a store's tax rate doesn't change between its
  // sale price and its regular price. Every other case returns null and is
  // excluded from the average rather than mixing tax-in and tax-out numbers.
  function comparableFullPrice(row) {
    const full = fullPrice(row);
    if (row.price_tax_basis === 'exclusive') { return full; }
    if (row.price_tax_basis === 'inclusive' && row.pre_tax_price != null && row.price > 0) {
      return full * (row.pre_tax_price / row.price);
    }
    return null;
  }

  // Average FULL (non-promotional) price across retailers. One value per
  // DISTINCT real competitor (competitorKey, not the raw platform `source` —
  // two different STIIIZY store locations must both count), only from rows
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

  // Cheapest / Most Expensive — a DIFFERENT question from the average ("what's
  // the normal underlying price" vs. "what could someone pay a competitor
  // today"), so deliberately sale-INCLUSIVE. Uses effectivePreTax, which
  // returns null (excluded, never a silent raw fallback) whenever a row can't
  // be honestly normalized to pre-tax. Deduped by competitorKey, same
  // reasoning as the average.
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

  // ── fetch-all — paginated, bounded-concurrency ───────────────────────────
  // The server caps `limit` at 2000 per request and the live dataset (53,842+
  // rows and growing) is far past that, so a single fetch silently truncates
  // it. Pages 2..N fire with bounded concurrency (not sequential, not all at
  // once) — a real load test against the live server found firing every page
  // in one Promise.all produced 502s on ~40% of them at 27 pages; 6-8
  // concurrent measured zero failures across repeated real runs. A per-page
  // retry (once) absorbs an occasional transient blip. This is the exact
  // logic screen-pricing.jsx's own loader used before this extraction — moved
  // here so a second caller (pos/product-shell.jsx's Market Pricing section)
  // never forks its own copy of the pagination/retry tuning.
  //
  // Optional `source`/`category` narrow the fetch server-side (the only two
  // filters hw-pricing-scraper/server/app.py supports today — no `?brand=`).
  // Resolves to the same shape screen-pricing.jsx's `http` state already
  // uses: { url, code, ok, body: { total, count, limit, offset, listings },
  // parsed, raw } on success, or the failed page's response as-is on failure.
  function fetchAllListings(opts) {
    opts = opts || {};
    const PAGE = 2000;
    const MAX_CONCURRENT_PAGES = 6;
    const baseParams = { limit: PAGE, source: opts.source, category: opts.category };

    function fetchPageWithRetry(offset) {
      const params = Object.assign({}, baseParams, { offset: offset });
      return getJSON(ROUTE_LISTINGS + '?' + qs(params)).then(function (r) {
        const good = r.ok && r.parsed && r.body && Array.isArray(r.body.listings);
        if (good) { return r; }
        // one retry — a 502 under load is often gone a moment later
        return getJSON(ROUTE_LISTINGS + '?' + qs(params));
      });
    }

    // Runs `tasks` (offset -> Promise) with at most `limit` in flight at
    // once, preserving input order in the resolved array.
    function runBounded(items, limit, task) {
      return new Promise(function (resolve) {
        const results = new Array(items.length);
        let next = 0, inFlight = 0, done = 0;
        function pump() {
          if (done === items.length) { resolve(results); return; }
          while (inFlight < limit && next < items.length) {
            const i = next++;
            inFlight++;
            task(items[i]).then(function (r) {
              results[i] = r;
              inFlight--; done++;
              pump();
            });
          }
        }
        pump();
      });
    }

    return fetchPageWithRetry(0).then(function (first) {
      if (!first.ok || !first.parsed || !first.body || !Array.isArray(first.body.listings)) { return first; }
      const total = first.body.total;
      const firstRows = first.body.listings;
      const remainingOffsets = [];
      for (let off = PAGE; off < total; off += PAGE) { remainingOffsets.push(off); }
      if (remainingOffsets.length === 0) {
        return { url: first.url, code: first.code, ok: true, body: { total: total, count: firstRows.length, limit: PAGE, offset: 0, listings: firstRows }, parsed: true, raw: first.raw };
      }
      return runBounded(remainingOffsets, MAX_CONCURRENT_PAGES, fetchPageWithRetry).then(function (rest) {
        const bad = rest.filter(function (r) { return !r.ok || !r.parsed || !r.body || !Array.isArray(r.body.listings); })[0];
        if (bad) { return bad; }
        let rows = firstRows;
        rest.forEach(function (r) { rows = rows.concat(r.body.listings); });
        return { url: first.url, code: first.code, ok: true, body: { total: total, count: rows.length, limit: PAGE, offset: 0, listings: rows }, parsed: true, raw: first.raw };
      });
    });
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
  // into the category field at the source. Historically this was blind
  // (weedmaps' own category column is a STRAIN type, a mislabeling on
  // Weedmaps' own side), but weedmaps_adapter.py now also scrapes a real
  // `edge_category` field for the actual product type, and it IS returned by
  // this API (see EDGE_CATEGORY_FOLD below) — categoryBucket() prefers it.
  // This fold/misfiled table stays as the fallback for every row where
  // edge_category is empty (every non-weedmaps source, plus any weedmaps row
  // the scraper didn't get an edge_category for).
  const CATEGORY_MISFILED = { indica: 1, sativa: 1, hybrid: 1 };
  // Weedmaps' real product-type taxonomy, scraped into `edge_category`.
  // Verified live 2026-09-07 against all 40,137 weedmaps rows (full paged
  // GET /api/pricing/listings?source=weedmaps) — every value below is a real
  // value seen in that response; nothing here is invented. Folding this in
  // place of the old category-only heuristic took weedmaps' row-level
  // misfiled+uncategorized share from 37,747/40,137 (94.0%) to 0/40,137, and
  // the "Not categorized" group-level filter tab (all 15 sources combined)
  // from 38,128/48,571 groups (78.5%) to 381/48,571 (0.8%).
  const EDGE_CATEGORY_FOLD = {
    buds: 'flower', smalls: 'flower', flower: 'flower', ground: 'flower', 'infused flower': 'flower',
    'all-in-one': 'vape', pods: 'vape', cartridge: 'vape', batteries: 'vape', 'vape pens': 'vape', 'push button': 'vape',
    joints: 'preroll', minis: 'preroll', 'infused joints': 'preroll', 'infused minis': 'preroll',
    'infused blunts': 'preroll', 'infused pre-rolls': 'preroll', 'pre-rolls': 'preroll',
    gummies: 'edibles', capsules: 'edibles', drinks: 'edibles', chocolates: 'edibles', carbonated: 'edibles',
    'non-carbonated': 'edibles', mints: 'edibles', 'baked goods': 'edibles', edibles: 'edibles', tablets: 'edibles',
    concentrates: 'concentrate', sugar: 'concentrate', badder: 'concentrate', rosin: 'concentrate',
    diamonds: 'concentrate', crumble: 'concentrate', solvent: 'concentrate', kief: 'concentrate', sauce: 'concentrate',
    tinctures: 'tincture',
    balms: 'topical', patches: 'topical',
    gear: 'other', accessories: 'other', other: 'other', 'rolling papers': 'other', apparel: 'other'
  };

  // Takes the row (or row-shaped object with .category / .edge_category) —
  // NOT just the raw category string — because edge_category, when present,
  // is a strictly better signal than category and must be checked first.
  function categoryBucket(row) {
    const edgeKey = String((row && row.edge_category) || '').toLowerCase().trim();
    if (edgeKey && EDGE_CATEGORY_FOLD[edgeKey]) { return EDGE_CATEGORY_FOLD[edgeKey]; }
    const key = String((row && row.category) || '').toLowerCase().trim();
    if (!key) { return 'uncategorized'; }
    if (CATEGORY_MISFILED[key]) { return 'misfiled'; }
    return CATEGORY_FOLD[key] || 'uncategorized';
  }

  // ── shell-level matching ─────────────────────────────────────────────────

  // shell.cat is one of TAX's seven keys (pos/shell-store.jsx:8-31). categoryBucket()
  // returns one of ten values. This is the bridge, and it is explicit on purpose —
  // a fuzzy match here reintroduces exactly the 31.4%-of-rows cross-category
  // conflation that requiring a category is meant to prevent.
  const SHELL_CAT_BUCKETS = {
    'Flower':       ['flower'],
    'Pre-Rolls':    ['preroll'],
    'Vapes':        ['vape'],
    'Concentrates': ['concentrate'],
    'Edibles':      ['edibles'],
    'Accessories':  ['other']
    // 'Wellness' is deliberately absent — resolved by shell.sub below.
  };
  // TAX's Wellness subs are six different real product forms
  // (pos/shell-store.jsx:26-28). Three map to one bucket each. The other three
  // ('CBD', 'Ratio Products', 'Pet') name a cannabinoid profile, not a form, and
  // honestly could be any of the three wellness buckets — so they accept all three.
  // Collision-checked live: of 235 (brand, weight) pairs that appear in
  // {tincture, topical, edibles}, exactly ONE spans more than one of them
  // (papa&barkley 15ml: topical 5, edibles 1 — the same brand's own line), so the
  // permissive set is safe.
  const WELLNESS_SUB_BUCKETS = {
    'Tinctures': ['tincture'],
    'Topicals':  ['topical'],
    'Capsules':  ['edibles']
  };
  const WELLNESS_FALLBACK = ['tincture', 'topical', 'edibles'];

  function shellCategoryBuckets(shell) {
    const cat = shell && shell.cat;
    if (!cat) { return null; }
    if (cat === 'Wellness') {
      return WELLNESS_SUB_BUCKETS[shell.sub] || WELLNESS_FALLBACK;
    }
    return SHELL_CAT_BUCKETS[cat] || null;
  }

  // The SHELL's own identity — the three attributes every variation under one
  // shell shares by definition (pos/product-shell.jsx:1-16). This is NOT
  // groupKey(): groupKey() additionally requires the product-name core to match,
  // which is the thing that made this feature return zero for all 12 real shells.
  //
  // Returns null when any of the three cannot be resolved. A null key means
  // "there is nothing here to compare" and MUST degrade to a stated
  // not-enough-information state — never to a looser match, never to a number.
  function shellIdentityKey(shell) {
    if (!shell) { return null; }
    const brand = normalizeBrand(shell.brand);
    if (!brand) { return null; }
    // shell.weight is written as amount+unit by BOTH writers — seed()
    // (pos/shell-store.jsx:90) and saveShell() (pos/shell-store.jsx:170) — e.g.
    // "3.5g", "100mg", "5ct". It MUST be run through extractWeight(), not
    // compared as a raw string: extractWeight folds ct -> pk via UNIT_SYNONYMS
    // (pos/pricing-shared.jsx:92), so a "5ct" shell must become "5pk" to match a
    // listing that says "5 count". Verified round-trip for every preset in TAX
    // (pos/shell-store.jsx:8-31): 1g/3.5g/7g/14g/28g/0.5g/1.75g/2.5g/5g/0.3g/2g
    // /10mg/100mg/200mg/1000mg/30ml/60ml/500mg all map to themselves;
    // 1ct/2ct/5ct map to 1pk/2pk/5pk.
    const w = extractWeight(shell.weight);
    if (!w) { return null; }
    const buckets = shellCategoryBuckets(shell);
    if (!buckets || !buckets.length) { return null; }
    return { brand: brand, weight: w.norm, buckets: buckets };
  }

  // Field-by-field, with no fallbacks:
  //   brand    — normalizeBrand(row.brand) must EQUAL key.brand. row.brand is null
  //              on a large share of rows; normalizeBrand(null) returns null and
  //              null !== any string, so those rows are excluded. That is correct:
  //              a row with no brand cannot be proven to be this brand.
  //   weight   — extractWeight(row.product_name).norm must EQUAL key.weight. Note
  //              the weight comes from the product NAME TEXT, exactly as groupKey()
  //              (pos/pricing-shared.jsx:150-157) already reads it. There is no
  //              structured weight column on a listing.
  //   category — categoryBucket(row) must be one of key.buckets. categoryBucket
  //              prefers row.edge_category over row.category (commit fc9c4ff); rows
  //              that resolve to 'uncategorized' or 'misfiled' match NOTHING and are
  //              excluded, because a row whose product type is unknown cannot be
  //              proven to be this shell's type. Cost measured live: 798 of 13,632
  //              brand+weight-resolvable rows (5.9%), and only 40 of 1,114 brand+
  //              weight pairs are 100% uncategorized.
  // Product NAME is deliberately NOT compared. That is the whole change.
  function listingMatchesShell(row, key) {
    if (!row || !key) { return false; }
    if (normalizeBrand(row.brand) !== key.brand) { return false; }
    const w = extractWeight(row.product_name);
    if (!w || w.norm !== key.weight) { return false; }
    return key.buckets.indexOf(categoryBucket(row)) >= 0;
  }

  // Shell-level average. One vote per distinct competitor (competitorKey), where a
  // competitor's vote is the MEAN of its own matching listings — not whichever row
  // the fetch happened to return first, which at shell level is arbitrary and was
  // measured to move the answer by up to $3.83.
  // Exact (product_name, price) repeats within one store are collapsed first:
  // 16,707 of 56,938 live rows (29.3%) are exact duplicates and would otherwise
  // double-weight one product inside a store's own mean.
  // Return shape is IDENTICAL to computeAvgFull()'s — { value, count } — so any
  // caller reading .value / .count needs no change. `count` is the number of
  // DISTINCT COMPETITORS contributing, same meaning as before.
  function computeAvgFullAcross(rows) {
    const byStore = new Map();          // competitorKey -> Map(dedupKey -> value)
    (rows || []).forEach(function (r) {
      const v = comparableFullPrice(r);
      if (v == null) { return; }
      const sk = competitorKey(r);
      if (!byStore.has(sk)) { byStore.set(sk, new Map()); }
      byStore.get(sk).set(String(r.product_name) + '|' + r.price, v);
    });
    const storeMeans = [];
    byStore.forEach(function (m) {
      const vs = [...m.values()];
      storeMeans.push(vs.reduce(function (a, b) { return a + b; }, 0) / vs.length);
    });
    // Same "a single value is not an average across retailers" rule as
    // computeAvgFull() — fewer than 2 distinct competitors returns null, never a
    // one-store number dressed up as a market average.
    return {
      value: storeMeans.length >= 2
        ? storeMeans.reduce(function (a, b) { return a + b; }, 0) / storeMeans.length
        : null,
      count: storeMeans.length
    };
  }

  // Shell-level extremes. Sale-inclusive, effectivePreTax-normalized, same as
  // computeExtremes(). Min/max are taken over ALL matching rows — deduping to one
  // row per store before a min/max throws away the actual cheapest and priciest
  // listing (measured: wrong range in 27 of 330 live shell-level groups, e.g.
  // alteredalchemy 1g concentrate, whose real high is $27.76 and whose deduped
  // high is $12.00).
  // The >= 2 gate counts DISTINCT COMPETITORS with at least one comparable price —
  // four prices at one store is one store, and is not a market range.
  // Return shape is IDENTICAL to computeExtremes()'s:
  //   { cheapest: {value, row} | null, priciest: {value, row} | null,
  //     comparableCount: <distinct competitors>, comparableRows: <row count> }
  // (comparableRows is new and additive; MarketLadder at product-shell.jsx:203
  //  reads only .cheapest.value / .priciest.value and needs no change.)
  function computeExtremesAcross(rows) {
    let cheapest = null, priciest = null, comparableRows = 0;
    const stores = new Set();
    (rows || []).forEach(function (r) {
      const v = effectivePreTax(r);
      if (v == null) { return; }
      comparableRows++;
      stores.add(competitorKey(r));
      if (!cheapest || v < cheapest.value) { cheapest = { value: v, row: r }; }
      if (!priciest || v > priciest.value) { priciest = { value: v, row: r }; }
    });
    if (stores.size < 2) {
      return { cheapest: null, priciest: null, comparableCount: stores.size, comparableRows: comparableRows };
    }
    return { cheapest: cheapest, priciest: priciest, comparableCount: stores.size, comparableRows: comparableRows };
  }

  // One full listing load per page session, shared by every Market Pricing mount.
  // The matched set now depends only on (brand, weight, category) — nothing
  // per-shell — so there is nothing to key a per-shell fetch on. TTL guards against
  // a long-lived tab going stale.
  let _allCache = null, _allCacheAt = 0;
  const ALL_CACHE_MS = 5 * 60 * 1000;
  function fetchAllListingsCached() {
    const now = Date.now();
    if (_allCache && (now - _allCacheAt) < ALL_CACHE_MS) { return _allCache; }
    _allCacheAt = now;
    _allCache = fetchAllListings({}).then(function (r) {
      // Never cache a failure — a transient 502 must not pin an error for 5 minutes.
      if (!r || !r.ok) { _allCache = null; _allCacheAt = 0; }
      return r;
    });
    return _allCache;
  }

  window.HW_PRICING = {
    PRICING_BASE, ROUTE_LISTINGS, getJSON, qs,
    normalizeBrand, normalizeBrandSpaced, extractWeight, coreWords, normalizeNameCore, groupKey, competitorKey,
    knownBasis, money, effectivePreTax, fullPrice, comparableFullPrice,
    computeAvgFull, computeExtremes, fetchAllListings,
    CATEGORY_FOLD, CATEGORY_MISFILED, EDGE_CATEGORY_FOLD, categoryBucket,
    shellCategoryBuckets, shellIdentityKey, listingMatchesShell,
    computeAvgFullAcross, computeExtremesAcross, fetchAllListingsCached
  };
})();
