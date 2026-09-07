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
// product-mapping pipeline exists. Every "our price" surface on this screen
// reads "Not yet mapped." Never computed, never estimated, never left blank
// (blank reads as "loading" or "n/a," which both imply a real value is
// coming). This also means the redesign doc's group-header pill — described
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
// or price_tax_basis === 'unknown' still render (never hidden), but sort to
// the bottom of their group, unranked, and never receive a good/bad pill.
// STIIIZY's own $23.00 listing is the proof case: raw price $23.00, but
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

  // Matches "1g", "3.5g", "100mg", "[1G]", "7g", etc. Requires a leading
  // digit, so ".5g" (present in real data) intentionally does NOT match —
  // that row falls back to a solo group rather than guessing a weight.
  const WEIGHT_RE = /(\d+(?:\.\d+)?)\s?(mg|g|ml|oz)\b/i;
  function extractWeight(productName) {
    const m = WEIGHT_RE.exec(String(productName || ''));
    if (!m) { return null; }
    return { raw: m[0], norm: (m[1] + m[2]).toLowerCase() };
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

  function taxChipTone(basis) {
    if (basis === 'inclusive') { return { label: '✓ Tax incl.', kind: 'good' }; }
    if (basis === 'exclusive') { return { label: '+ Tax at cart', kind: 'warn' }; }
    return { label: '? Unverified', kind: 'neutral' };
  }

  // ── tax-basis chip: click-to-pin, never hover-only ────────────────────────
  // Fix carried forward from the adversarial review of the redesign doc: a
  // hover-only popover is unreachable on touch and disappears the instant a
  // mouse moves toward it. Click toggles a pinned detail panel instead.
  function TaxChip({ row, pinned, onTogglePin }) {
    const P = useP();
    const tone = taxChipTone(row.price_tax_basis);
    const isPinned = pinned === row.id;
    return (
      <span style={{ position: 'relative', display: 'inline-block' }}>
        <button data-hw-i onClick={function (e) { e.stopPropagation(); onTogglePin(isPinned ? null : row.id); }}
          title="Click to see tax-basis evidence"
          style={{
            font: 'inherit', fontSize: P.type.micro, fontWeight: 700, letterSpacing: '.02em',
            padding: '2px 7px', borderRadius: P.r999, border: '1px solid transparent', cursor: 'pointer',
            background: tone.kind === 'good' ? P.goodSoft : tone.kind === 'warn' ? P.warnSoft : P.neutralSoft,
            color: tone.kind === 'good' ? P.good : tone.kind === 'warn' ? P.warnText : P.neutral,
            outline: isPinned ? `2px solid ${P.ink}` : 'none', outlineOffset: 1
          }}>{tone.label}</button>
        {isPinned &&
          <div onClick={function (e) { e.stopPropagation(); }}
            style={{ position: 'absolute', zIndex: 20, top: '120%', left: 0, minWidth: 220, maxWidth: 300,
              background: P.surface, border: `1px solid ${P.hairline3}`, borderRadius: P.r10, boxShadow: '0 6px 20px rgba(0,0,0,.18)',
              padding: 10, fontSize: P.type.meta, color: P.ink }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>price_tax_basis: {row.price_tax_basis}</div>
            <div style={{ color: P.inkDim, marginBottom: 6 }}>
              {row.price_tax_basis_evidence || 'No evidence string recorded for this row.'}
            </div>
            <button data-hw-i onClick={function (e) { e.stopPropagation(); onTogglePin(null); }}
              style={{ font: 'inherit', fontSize: P.type.micro, color: P.inkMute, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              unpin
            </button>
          </div>}
      </span>);
  }

  function SubRow({ row, pinned, onTogglePin, isLast, unranked }) {
    const P = useP();
    const known = knownBasis(row);
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px 10px 30px',
        borderTop: unranked ? `1px dashed ${P.hairline3}` : `1px solid ${P.hairline}`,
        background: P.surface2, opacity: unranked ? 0.72 : 1
      }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: sourceDot(P, row.source), flex: '0 0 auto' }} />
        <div style={{ minWidth: 0, flex: '1 1 240px' }}>
          <div style={{ fontSize: P.type.body, fontWeight: 600, color: P.ink }}>{sourceLabel(row.source)}</div>
          <div style={{ fontSize: P.type.meta, color: P.inkDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={row.product_name}>{row.product_name}</div>
        </div>
        <div style={{ flex: '0 0 auto', textAlign: 'right', minWidth: 150 }}>
          {known
            ? <div style={{ fontSize: P.type.numRow, fontWeight: 800, fontFamily: P.fontMono, color: P.ink }}>{money(row.pre_tax_price)}<span style={{ fontSize: P.type.micro, fontWeight: 600, color: P.inkMute }}> pre-tax</span></div>
            : <div style={{ fontSize: P.type.body, fontWeight: 600, color: P.inkMute, fontStyle: 'italic' }}>pre-tax unverified</div>}
          <div style={{ fontSize: P.type.micro, color: P.inkFaint, fontFamily: P.fontMono }}>({money(row.price)} · raw)</div>
        </div>
        <div style={{ flex: '0 0 auto' }}>
          <TaxChip row={row} pinned={pinned} onTogglePin={onTogglePin} />
        </div>
      </div>);
  }

  function GroupCard({ group, pinned, onTogglePin }) {
    const P = useP();
    const rows = group.rows;
    const multi = rows.length > 1;
    const multiSource = group.multiSource; // 2+ DISTINCT sources — see header comment
    const knownRows = rows.filter(knownBasis);
    let headline = null;
    if (multiSource && knownRows.length >= 2) {
      const lo = Math.min.apply(null, knownRows.map(function (r) { return r.pre_tax_price; }));
      const hi = Math.max.apply(null, knownRows.map(function (r) { return r.pre_tax_price; }));
      const spreadPct = lo > 0 ? Math.round(((hi - lo) / lo) * 100) : 0;
      headline = { kind: spreadPct > 0 ? 'info' : 'neutral', label: `${spreadPct}% spread across sources` };
    } else if (multiSource && knownRows.length === 0) {
      // Every sub-row is unknown-basis — the doc's exact rule, adapted:
      // never render a confident-looking pill over data that isn't.
      headline = { kind: 'info', label: 'Basis unverified' };
    } else if (!multiSource && multi) {
      // Same-source duplicate/near-duplicate listings (e.g. Kushy Punch
      // Watermelon Indica 100mg — two dutchie_embed rows that merged only
      // because "Original" is in STOPWORDS). This is real, useful
      // information — this source has duplicate catalog entries — but it is
      // NOT a competitor price spread, and must never be labeled as one.
      headline = { kind: 'warn', label: `Same-source duplicate (${group.distinctSourceCount} source, ${rows.length} listings)` };
    }

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
              {group.category && <Pill kind="ghost" size="sm" label={group.category} />}
            </div>
            <div style={{ marginTop: 6, fontSize: P.type.meta, color: P.inkMute }}>
              {group.distinctSourceCount} source{group.distinctSourceCount === 1 ? '' : 's'} tracked
              {rows.length !== group.distinctSourceCount && ` (${rows.length} listings)`}
              {!multi && ' — no cross-source match yet, this is the honest common case right now'}
              {!multiSource && multi && ' — duplicate/near-duplicate listings from the same source, not a competitor match'}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flex: '0 0 auto' }}>
            <Pill kind="neutral" label="Not yet mapped" />
            {headline && <Pill kind={headline.kind} label={headline.label} />}
          </div>
        </div>
        {group.sortedRows.map(function (r, i) {
          return <SubRow key={r.id} row={r} pinned={pinned} onTogglePin={onTogglePin}
            isLast={i === group.sortedRows.length - 1} unranked={!knownBasis(r) && knownRows.length > 0 ? false : !knownBasis(r) && rows.length > 1} />;
        })}
      </Card>);
  }

  window.PricingScreen = function PricingScreen() {
    const P = useP();
    const [http, setHttp] = React.useState(null);
    const [facetsHttp, setFacetsHttp] = React.useState(null);
    const [tick, setTick] = React.useState(0);
    const [q, setQ] = React.useState('');
    const [sourceFilter, setSourceFilter] = React.useState('all');
    const [unverifiedOnly, setUnverifiedOnly] = React.useState(false);
    const [pinned, setPinned] = React.useState(null);

    React.useEffect(function () {
      let live = true;
      setHttp(null);
      // limit 2000 is the server's documented cap (server/README.md) and
      // comfortably covers the live 1,254-row dataset in one call — no
      // pagination UI needed for a dataset this size.
      getJSON(ROUTE_LISTINGS + '?' + qs({ limit: 2000, offset: 0 })).then(function (r) { if (live) { setHttp(r); } });
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
        const sourceSet = new Set(rows.map(function (r) { return r.source; }));
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

    const filtered = React.useMemo(function () {
      const needle = q.trim().toLowerCase();
      return groups.filter(function (g) {
        if (sourceFilter !== 'all' && !g.rows.some(function (r) { return r.source === sourceFilter; })) { return false; }
        if (unverifiedOnly && !g.rows.some(function (r) { return !knownBasis(r); })) { return false; }
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
    }, [groups, q, sourceFilter, unverifiedOnly]);

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
            <KPI label="Listings tracked" value={String(totalListings)} sublabel="across 5 sources" />
            <KPI label="Tax basis known" value={`${taxVerified} / ${allRows.length}`} sublabel="basis known ≠ pre-tax price known — never conflate the two" />
            <KPI label="Pre-tax price known" value={`${preTaxKnown} / ${allRows.length}`} sublabel="only this figure is ever ranked or compared" />
            <KPI label="Product groups" value={String(groups.length)} sublabel="brand + name + weight" />
            <KPI label="Multi-source matches" value={String(multiSourceGroups)} sublabel="honestly rare right now — not a bug" accent={multiSourceGroups > 0 ? P.good : undefined} />
          </div>}

        {http && http.ok &&
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }} onClick={function (e) { e.stopPropagation(); }}>
            <Seg value={sourceFilter} onChange={setSourceFilter} options={sourceOptions} size="sm" />
            <PBtn variant={unverifiedOnly ? 'accent' : 'secondary'} size="sm" icon="flag"
              onClick={function () { setUnverifiedOnly(!unverifiedOnly); }}>
              Unverified tax basis only
            </PBtn>
            <div style={{ flex: 1 }} />
            <Field icon="search" placeholder="Search brand or product…" value={q} onChange={(e) => setQ(e.target.value)} size="sm" style={{ maxWidth: 260 }} />
          </div>}

        {http && http.ok && groups.length === 0 &&
          <EmptyState icon="tag" title="The pricing backend answered and listed no rows"
            body="GET /api/pricing/listings returned zero listings. That means the ingest step hasn't populated the database yet, not that pricing is fine." />}

        {http && http.ok && groups.length > 0 && filtered.length === 0 &&
          <EmptyState icon="search" title="No product groups match these filters"
            body="Try clearing the source filter, the unverified-only toggle, or the search box." />}

        {http && http.ok && filtered.map(function (g) {
          return <GroupCard key={g.key} group={g} pinned={pinned} onTogglePin={setPinned} />;
        })}
      </div>);
  };
})();
