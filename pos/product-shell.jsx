// ── Product shells · editor modal + the one Add Product flow ───────────────
// A SHELL IS NOT A PRODUCT. It is the family template a product hangs off.
//
//   Shell     "Alpine · All-In-One Vape 1g"      ← brand, format, size, price,
//     ├─ Fruit Punch          SKU AL-AIO-FP   $38     traits, box, meta
//     ├─ Blue Dream           SKU AL-AIO-BD   $38   ← a VARIATION (a product)
//     └─ …up to ~50 more
//
// Ownership, so nothing is entered in two places:
//   SHELL      brand · format · category · subcategory · size · pack ·
//              delivery box · RETAIL + SALE PRICE · traits · meta · WM node
//   VARIATION  flavour or strain name · SKU · photo · description ·
//              display-sample flag · an OPTIONAL price override (rare)
//   BATCH      quantity · wholesale cost · barcode / RFID · THC · expiry · METRC
//
// The shell record itself lives in shell-store.jsx (window.HW_SHELL).
const useP = window.useP;
const SH = window.HW_SHELL;

// Turns SH.createVariation's refusal shape into the one sentence the operator
// sees. Named codes first (the server's own words, wmdemo/server.py's
// POST /api/product); anything else falls to the generic form rather than
// guessing at a reason the response did not give.
function wmCreateErrorText(r) {
  if (!r) return 'Could not create the product — no response at all.';
  if (r.error === 'no-write-path') return r.hint || 'There is no write path to call.';
  if (r.error === 'unknown_shell') return 'This shell no longer exists — pick one again.';
  if (r.error === 'not_confirmed') {
    return r.hint || 'The server answered, but a fresh read of the catalog does not show this SKU yet — nothing was created.';
  }
  if (typeof r.error === 'string' && r.error.indexOf('missing required field') === 0) {
    return 'The server refused the product: ' + r.error + '.';
  }
  return 'Could not create the product' + (r.error ? ' (' + r.error + ')' : '') + (r.hint ? ' — ' + r.hint : '') + '.';
}

function Lb({ children, hint, right }) {
  const P = useP();
  return <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>{children}</span>
    {hint && <span title={hint} style={{ display: 'inline-flex', cursor: 'help', color: P.inkFaint }}><Icon name="info" size={12} stroke={1.9} /></span>}
    {right && <span style={{ marginLeft: 'auto' }}>{right}</span>}
  </div>;
}
function Sel2({ value, onChange, options }) {
  const P = useP();
  return <div style={{ position: 'relative' }}>
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', padding: '9px 32px 9px 12px', border: `1px solid ${P.fieldBorder}`, borderRadius: P.r10, background: P.field, fontSize: 13.5, fontWeight: 600, color: P.ink, fontFamily: P.fontSans, minHeight: 38, outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}>{options.map((o) => <option key={o} value={o}>{o}</option>)}</select>
    <Icon name="chevron-down" size={14} stroke={2.2} color={P.inkMute} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
  </div>;
}
function Tag({ children, kind }) {
  const P = useP();
  const c = kind === 'good' ? P.good : kind === 'warn' ? P.warn : kind === 'ai' ? P.indica : P.info;
  const bg = kind === 'good' ? P.goodSoft : kind === 'warn' ? P.warnSoft : kind === 'ai' ? P.indica + '22' : P.infoSoft;
  return <span style={{ display: 'inline-flex', padding: '1px 7px', borderRadius: 99, background: bg, color: c, fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>{children}</span>;
}
// A mini switch that reads as a toggle, used for sample + price override.
function MiniSwitch({ on, onChange, color }) {
  const P = useP();
  return <button onClick={(e) => {e.stopPropagation();onChange(!on);}} style={{ width: 32, height: 18, borderRadius: 99, background: on ? color || P.accent : P.hairline3, padding: 2, display: 'flex', alignItems: 'center', border: 'none', cursor: 'pointer', transition: 'background .15s', flex: '0 0 auto' }}>
    <span style={{ width: 14, height: 14, borderRadius: 99, background: '#fff', transform: on ? 'translateX(14px)' : 'translateX(0)', transition: 'transform .18s', boxShadow: '0 1px 2px rgba(0,0,0,.3)' }} />
  </button>;
}

// ── Market Pricing — built into the shell editor, never a modal-on-a-modal ──
// Owner's own words: "I want to build this into the shell page design vs it
// being a modal that pops up - less clicks is better and I want to include
// the meter from the second design". So: Concept A's PLACEMENT (a permanent
// section inside ShellEditModal, rendered the instant the modal opens, never
// a click-to-expand toggle) + Concept B's VISUAL (a horizontal price ladder
// with a marker for Hyperwolf's own price, instead of a 4-box stat strip).
//
// Matching is now at the SHELL IDENTITY level, not the exact product name level.
// A shell's identity is three attributes it shares with all its variations:
// brand + weight + category. The matcher finds every competitor listing that
// shares those three attributes, regardless of the product name. This fixes the
// original "zero matches for all 12 seeded shells" bug — requiring an exact
// product name match against another retailer's often-different naming was never
// going to work (verified live: 100% no-match rate on the original seed data).
//
// The matched set is now an AGGREGATE: storeCount (distinct competitors),
// productCount (distinct product-name cores across those competitors),
// listingCount (raw matched rows). Prices are aggregated per-store-mean via
// computeAvgFullAcross and computeExtremesAcross — same tax basis as the
// Pricing screen, reused exactly from pos/pricing-shared.jsx.
//
// Hyperwolf's own shelf price IS pre-tax, by the same definition
// effectivePreTax() already uses for a competitor row with
// price_tax_basis === 'exclusive' — this is verified, not assumed:
// pos/sales-panel.jsx's SALES_TAX table (local cannabis + state excise +
// state sales tax) is computed ON TOP of the line price at checkout
// (`sub * (1 + SALES_TAX_RATE)`), never baked into it. So
// SH.effectivePrice(shell) is already the pre-tax figure this comparison
// needs — no computation, no guess.
function shellProbeKeys(shell) {
  const HP = window.HW_PRICING;
  // Variations are no longer embedded on the shell (they live behind
  // GET /api/shells/<id> now) — use whatever detail this page has already
  // cached for it, same as SH.effectivePrice() does.
  const detail = SH.shellDetail(shell.id);
  const products = (detail && detail.products && detail.products.length) ? detail.products : [null];
  const keys = new Set();
  products.forEach(function (p) {
    const productName = [shell.brand, p && (p.name || p.name_derived), shell.weight].filter(Boolean).join(' ');
    const key = HP.groupKey({ brand: shell.brand, product_name: productName });
    if (key) { keys.add(key); }
  });
  return keys;
}

// Fetches the full live listing set once per page session (shared cache, no
// per-shell refetch) and reduces it to the shell-level aggregation the render
// below needs. Six possible outcomes:
//   unmatchable — the shell's identity cannot be resolved (brand/weight/category)
//   none        — identity resolved, but 0 rows matched
//   solo        — matched rows exist, but < 2 distinct competitors with prices
//   ready       — >= 2 competitors, full ladder + caption + store list
//   loading     — fetch in flight
//   error       — fetch failed
function useShellMarketPricing(shell) {
  const [http, setHttp] = React.useState(null); // null = still loading
  React.useEffect(function () {
    let live = true;
    setHttp(null);
    window.HW_PRICING.fetchAllListingsCached().then(function (r) { if (live) { setHttp(r); } });
    return function () { live = false; };
  }, []);

  return React.useMemo(function () {
    if (!http) { return { status: 'loading' }; }
    if (!http.ok || !http.parsed || !http.body || !Array.isArray(http.body.listings)) {
      return { status: 'error', http: http };
    }
    const HP = window.HW_PRICING;

    // Check if the shell identity can be resolved (brand + weight + category)
    const key = HP.shellIdentityKey(shell);
    if (!key) {
      // Determine why the shell is unmatchable
      const why = !HP.normalizeBrand(shell.brand)         ? 'brand'
                : !HP.extractWeight(shell.weight)          ? 'weight'
                : 'category';
      return { status: 'unmatchable', why: why };
    }

    // Filter rows that match the shell identity (brand + weight + category)
    const rows = http.body.listings.filter(function (row) {
      return HP.listingMatchesShell(row, key);
    });

    // Compute the three counts: distinct stores, distinct products, raw listings
    const storeSet = new Set(rows.map(HP.competitorKey));
    const storeCount = storeSet.size;

    const productNameCores = new Set();
    rows.forEach(function (r) {
      const core = HP.normalizeNameCore(r.product_name, HP.normalizeBrand(r.brand), HP.extractWeight(r.product_name));
      if (core) { productNameCores.add(core); }
    });
    const productCount = productNameCores.size;
    const listingCount = rows.length;

    // No matches — the identity is valid but the live data has nothing for it
    if (storeCount === 0) {
      return { status: 'none', storeCount: 0, productCount: 0, listingCount: 0 };
    }

    // Compute pricing aggregates using the shell-level functions
    const extremes = HP.computeExtremesAcross(rows);

    // Exactly one comparable competitor — a range needs two endpoints
    if (extremes.comparableCount < 2) {
      const bySource = new Map();
      rows.forEach(function (r) { const k = HP.competitorKey(r); if (!bySource.has(k)) { bySource.set(k, r); } });
      const candidates = [...bySource.values()];
      const solo = candidates.filter(function (r) { return HP.effectivePreTax(r) != null; })[0] || candidates[0];
      return { status: 'solo', storeCount: storeCount, productCount: productCount, listingCount: listingCount, solo: solo };
    }

    // Full aggregate: >= 2 distinct competitors
    const avg = HP.computeAvgFullAcross(rows);
    return { status: 'ready', storeCount: storeCount, productCount: productCount, listingCount: listingCount, rows: rows, extremes: extremes, avg: avg };
  }, [http, shell.id, shell.brand, shell.weight, shell.cat, shell.sub]);
}

// A store's platform id, human-readable, without pulling in screen-
// pricing.jsx's private SOURCE_LABEL table (that stays there — this only
// needs a readable fallback for the rare row with no store_name).
function marketSourceLabel(row) {
  if (row.store_name) { return row.store_name; }
  return String(row.source || 'Unknown source').replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
}

function MarketTaxNote({ row }) {
  const P = useP();
  const HP = window.HW_PRICING;
  const known = HP.knownBasis(row);
  const note = known ? 'pre-tax'
    : row.price_tax_basis === 'inclusive' ? 'tax incl.'
    : row.price_tax_basis === 'exclusive' ? '+ tax at checkout'
    : null;
  if (!note) { return null; }
  return <span style={{ fontSize: 10, fontWeight: 600, color: known ? P.good : P.inkMute }}> {note}</span>;
}

// Exactly one competitor matched — a ladder needs two ends to mean anything,
// so this is deliberately plain text, no marker graphic, no color coding.
function MarketSoloLine({ row, shell }) {
  const P = useP();
  const HP = window.HW_PRICING;
  const preTax = HP.effectivePreTax(row);
  const value = preTax != null ? preTax : row.price;
  const displayBrand = HP.normalizeBrandSpaced(shell.brand);
  return (
    <div style={{ fontSize: 13, color: P.ink }}>
      <span style={{ fontFamily: P.fontMono, fontWeight: 800 }}>{HP.money(value)}</span>
      <MarketTaxNote row={row} />
      {' at '}
      <strong>{marketSourceLabel(row)}</strong>
      {row.store_city ? ', ' + row.store_city : ''}
      {` — the only tracked store listing ${displayBrand} ${shell.weight}.`}
    </div>
  );
}

// Concept B's horizontal price ladder: low/high labels from the comparable
// competitor extremes ONLY (never widened by Hyperwolf's own price — a
// price cheaper or pricier than every competitor still renders at the 0%/
// 100% end of the same track, per Concept B's own spec), with a marker for
// Hyperwolf's own pre-tax price. Good/bad/accent color follows position:
// cheapest end reads good, priciest end reads bad, in between reads as the
// shell's own accent color — a labeled participant, never just another
// competitor.
function MarketLadder({ extremes, ownPreTax }) {
  const P = useP();
  const HP = window.HW_PRICING;
  const lo = extremes.cheapest.value, hi = extremes.priciest.value;
  const span = hi - lo;
  const pct = span > 0 ? Math.min(1, Math.max(0, (ownPreTax - lo) / span)) : 0.5;
  const ownColor = ownPreTax <= lo ? P.good : ownPreTax >= hi ? P.bad : P.accent;
  return (
    <div style={{ margin: '2px 0 10px' }}>
      <div style={{ position: 'relative', height: 22, margin: '0 2px 4px' }}>
        <div style={{ position: 'absolute', top: 9, left: 0, right: 0, height: 3, borderRadius: 99, background: P.hairline2 }} />
        <div title={'Hyperwolf ' + HP.money(ownPreTax) + ' pre-tax'}
          style={{ position: 'absolute', top: 2, left: `calc(${pct * 100}% - 8px)`, width: 16, height: 16, borderRadius: 99,
            background: ownColor, border: `2px solid ${P.bg}`, boxShadow: '0 1px 4px rgba(0,0,0,.35)' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 10, color: P.inkMute, lineHeight: 1.3 }}>
          <span style={{ fontFamily: P.fontMono, fontWeight: 800, fontSize: 12.5, color: P.ink }}>{HP.money(lo)}</span><br />nearby low
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, color: ownColor, textAlign: 'center', lineHeight: 1.3 }}>
          Hyperwolf<br /><span style={{ fontFamily: P.fontMono, fontWeight: 800, fontSize: 12.5 }}>{HP.money(ownPreTax)}</span>
        </div>
        <div style={{ fontSize: 10, color: P.inkMute, textAlign: 'right', lineHeight: 1.3 }}>
          <span style={{ fontFamily: P.fontMono, fontWeight: 800, fontSize: 12.5, color: P.ink }}>{HP.money(hi)}</span><br />nearby high
        </div>
      </div>
    </div>
  );
}

// Two sentences: standing relative to competitors, then what was actually compared.
// Sentence 1: insertion of Hyperwolf's value into the per-store-mean comparable set.
// Sentence 2: what product+store scope the average covers.
function marketCaption(rows, ownPreTax, shell, storeCount) {
  const HP = window.HW_PRICING;
  // Per-store mean: collapse exact duplicates (product_name|price) within each store,
  // then average those deduplicated prices per store.
  const byStore = new Map();
  rows.forEach(function (r) {
    const v = HP.effectivePreTax(r);
    if (v == null) { return; }
    const sk = HP.competitorKey(r);
    if (!byStore.has(sk)) { byStore.set(sk, new Map()); }
    byStore.get(sk).set(String(r.product_name) + '|' + r.price, v);
  });
  const storeMeans = [];
  byStore.forEach(function (m) {
    const vs = [...m.values()];
    storeMeans.push(vs.reduce(function (a, b) { return a + b; }, 0) / vs.length);
  });
  const M = storeMeans.length;
  const cheaperThanOwn = storeMeans.filter(function (v) { return v > ownPreTax; }).length;
  const pricierThanOwn = storeMeans.filter(function (v) { return v < ownPreTax; }).length;
  const tied = M - cheaperThanOwn - pricierThanOwn;

  let sentence1 = '';
  if (cheaperThanOwn === M) { sentence1 = `The lowest of ${M} nearby stores.`; }
  else if (tied === M) { sentence1 = `Tied with ${M} of ${M} nearby stores.`; }
  else if (cheaperThanOwn >= pricierThanOwn) { sentence1 = `Priced below ${cheaperThanOwn} of ${M} nearby stores.`; }
  else { sentence1 = `Priced above ${pricierThanOwn} of ${M} nearby stores.`; }

  // Sentence 2: distinct product cores in the matched set
  const cores = new Set();
  rows.forEach(function (r) {
    const brand = HP.normalizeBrand(r.brand);
    const weight = HP.extractWeight(r.product_name);
    const core = HP.normalizeNameCore(r.product_name, brand, weight);
    if (core) { cores.add(core); }
  });
  const productCount = cores.size;
  const displayBrandSpaced = HP.normalizeBrandSpaced(shell.brand);
  const displayBrand = displayBrandSpaced ? displayBrandSpaced.split(' ').map(function (w) { return w[0].toUpperCase() + w.slice(1); }).join(' ') : displayBrandSpaced;
  const sentence2 = `Across ${productCount} ${displayBrand} ${shell.weight} products at ${storeCount} store${storeCount === 1 ? '' : 's'}.`;

  return { sentence1: sentence1, sentence2: sentence2 };
}

// The detail list under the ladder — grouped by store, showing all products
// and price ranges for each store. Collapses past 8 distinct stores (same
// threshold screen-pricing.jsx uses for its own overflow case) so a large
// match doesn't turn the modal into a wall of rows.
function MarketStoreList({ rows }) {
  const P = useP();
  const HP = window.HW_PRICING;
  const [expanded, setExpanded] = React.useState(false);

  // Group rows by store, collecting all products and prices per store
  const byStore = new Map();
  rows.forEach(function (r) {
    const sk = HP.competitorKey(r);
    if (!byStore.has(sk)) { byStore.set(sk, []); }
    byStore.get(sk).push(r);
  });

  // For each store, compute: lowest pre-tax price, all distinct products, all pre-tax prices
  const storeData = [];
  byStore.forEach(function (storeRows, storeKey) {
    const preTaxPrices = [];
    const productCores = new Map(); // core -> cheapest-product-name by word count
    storeRows.forEach(function (r) {
      const v = HP.effectivePreTax(r);
      if (v != null) { preTaxPrices.push(v); }
      const brand = HP.normalizeBrand(r.brand);
      const weight = HP.extractWeight(r.product_name);
      const core = HP.normalizeNameCore(r.product_name, brand, weight);
      if (core) {
        if (!productCores.has(core)) {
          productCores.set(core, r.product_name);
        } else {
          // Keep the version with fewest core words (displayName rule)
          const existing = productCores.get(core);
          const existingWords = HP.coreWords(existing, brand, weight).length;
          const newWords = HP.coreWords(r.product_name, brand, weight).length;
          if (newWords < existingWords) { productCores.set(core, r.product_name); }
        }
      }
    });

    if (preTaxPrices.length > 0) {
      const lowestPrice = Math.min(...preTaxPrices);
      const highestPrice = Math.max(...preTaxPrices);
      const uniquePrices = preTaxPrices.length > 0
        ? [...new Set(preTaxPrices.map(function (p) { return p.toFixed(2); }))].length
        : 0;
      storeData.push({
        key: storeKey,
        row: storeRows[0], // for store_name/city
        lowestPrice: lowestPrice,
        highestPrice: highestPrice,
        uniquePrices: uniquePrices,
        productCores: productCores
      });
    }
  });

  // Sort by lowest price ascending; stores with no comparable price go last
  storeData.sort(function (a, b) {
    return a.lowestPrice - b.lowestPrice;
  });

  const THRESHOLD = 8;
  const visible = expanded ? storeData : storeData.slice(0, THRESHOLD);

  return (
    <div style={{ borderTop: `1px solid ${P.hairline}`, marginTop: 2 }}>
      {visible.map(function (store, i) {
        const isRange = store.uniquePrices > 1;
        const priceDisplay = isRange
          ? `${HP.money(store.lowestPrice)}–${HP.money(store.highestPrice)}`
          : HP.money(store.lowestPrice);

        // Product names: limit to 3 with "+N more" overflow
        const productNames = [...store.productCores.values()]
          .map(function (pn) {
            const brand = HP.normalizeBrand(store.row.brand);
            const weight = HP.extractWeight(pn);
            return HP.coreWords(pn, brand, weight).join(' ');
          })
          .map(function (s) { return s.charAt(0).toUpperCase() + s.slice(1); });
        const displayProducts = productNames.slice(0, 3);
        const moreCount = productNames.length - 3;
        const productText = displayProducts.length === 1
          ? displayProducts[0]
          : (displayProducts.join(', ') + (moreCount > 0 ? ` +${moreCount} more` : ''));

        return (
          <div key={store.key + ':' + i} style={{ padding: '7px 2px', borderTop: i === 0 ? 'none' : `1px solid ${P.hairline}` }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: displayProducts.length > 0 ? 3 : 0 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink }}>{marketSourceLabel(store.row)}</span>
                {store.row.store_city && <span style={{ fontSize: 10, color: P.inkMute }}> · {store.row.store_city}</span>}
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 800, fontFamily: P.fontMono, color: P.ink, flex: '0 0 auto', whiteSpace: 'nowrap' }}>
                {priceDisplay}<MarketTaxNote row={store.row} />
              </div>
            </div>
            {displayProducts.length > 0 &&
              <div style={{ fontSize: 10.5, color: P.inkMute, lineHeight: 1.4, marginLeft: 0 }}>
                {productText}
              </div>}
          </div>
        );
      })}
      {!expanded && storeData.length > THRESHOLD &&
        <button onClick={function (e) { e.stopPropagation(); setExpanded(true); }}
          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 2px', background: 'none', border: 'none', borderTop: `1px solid ${P.hairline}`, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: P.info }}>
          Show all {storeData.length} stores
        </button>}
    </div>
  );
}

function MarketPricingSection({ shell }) {
  const P = useP();
  const HP = window.HW_PRICING;
  const state = useShellMarketPricing(shell);
  const ownPreTax = SH.effectivePrice(shell); // pre-tax by definition — see file comment above

  return (
    <div style={{ marginBottom: 18, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, background: P.surface, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: `1px solid ${P.hairline}` }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkMute }}>Market pricing</span>
        {state.status === 'ready' && state.storeCount > 0 && state.productCount != null &&
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: P.inkMute, fontFamily: P.fontMono }}>
            {state.storeCount} store{state.storeCount === 1 ? '' : 's'} · {state.productCount} product{state.productCount === 1 ? '' : 's'}
          </span>}
      </div>
      <div style={{ padding: '12px 14px' }}>
        {state.status === 'loading' &&
          <div style={{ fontSize: 12.5, color: P.inkMute }}>Checking live competitor pricing…</div>}
        {state.status === 'error' &&
          <div style={{ fontSize: 12.5, color: P.inkMute }}>Competitor pricing unavailable right now{state.http && state.http.netError ? ' — ' + state.http.netError : ''}.</div>}
        {state.status === 'unmatchable' &&
          <div style={{ fontSize: 12.5, color: P.inkMute }}>
            {state.why === 'brand' &&
              'This shell has no brand set, so there is nothing to compare it against.'}
            {state.why === 'weight' &&
              `This shell's size ("${shell.weight}") can't be read as a comparable size, so there is not enough information to compare it.`}
            {state.why === 'category' &&
              `This shell's category ("${shell.cat}") doesn't map to a tracked product type, so there is not enough information to compare it.`}
          </div>}
        {state.status === 'ready' && state.storeCount === 0 &&
          <div style={{ fontSize: 12.5, color: P.inkMute }}>No live listings for any {HP.normalizeBrandSpaced(shell.brand)} {shell.weight} {shell.cat} at any tracked store.</div>}
        {state.status === 'ready' && state.storeCount > 0 && state.solo &&
          <MarketSoloLine row={state.solo} shell={shell} />}
        {/* A shell no longer carries its own price (docs/SHELLS-PLAN-2026-09-
            09.md §1 — price lives on the variation, not the shell), so
            `ownPreTax` is null until at least one priced variation has been
            fetched for this shell. Comparing against a fabricated $0 would be
            worse than saying so. */}
        {state.status === 'ready' && state.rows && ownPreTax == null &&
          <div style={{ fontSize: 12.5, color: P.inkMute }}>No shelf price recorded for this shell yet — add a priced variation to compare it against nearby stores.</div>}
        {state.status === 'ready' && state.rows && ownPreTax != null &&
          <React.Fragment>
            <MarketLadder extremes={state.extremes} ownPreTax={ownPreTax} />
            {function () {
              const caption = marketCaption(state.rows, ownPreTax, shell, state.storeCount);
              return (
                <React.Fragment>
                  <div style={{ fontSize: 12, fontWeight: 600, color: P.ink, marginBottom: 2 }}>{caption.sentence1}</div>
                  <div style={{ fontSize: 11, color: P.inkMute, marginBottom: 8 }}>{caption.sentence2}</div>
                </React.Fragment>
              );
            }()}
            <MarketStoreList rows={state.rows} />
          </React.Fragment>}
      </div>
    </div>
  );
}

// ── Placement — the shell's own FOH/BOH + box, editable here (unlike brand/
// format/size above, location and box are NOT part of the shell's identity
// key, so they get real setter routes rather than "create a new shell").
// docs/SHELLS-PLAN-2026-09-09.md 2026-09-10 addendum: "shell locations are
// per store with a company default… box lives on the shell". Scoped by a
// store picker (or "Company default" — store_id: null); a store's own value
// shows greyed with "inherited from shell default" and a Clear whenever
// nothing has been overridden AT THAT STORE — clearing an actual override
// reverts to the default, it never deletes the default itself.
function PlacementSection({ shell, detail }) {
  const P = useP();
  const LM = window.ShellLocationsModule;
  const BM = window.ShellBoxesModule;
  const stores = (window.HW_STORES && window.HW_STORES.list) || [];
  const [storeSel, setStoreSel] = React.useState(null); // null = Company default
  const locStatus = SH.useLocationsStatus(storeSel, null);
  const locations = SH.useLocations(storeSel, null);
  const boxStatus = SH.useBoxesStatus();
  const boxes = SH.useBoxes();
  const rawShell = (detail && detail.shell) || null;
  const box = detail && detail.box;
  const [busy, setBusy] = React.useState({ foh: false, boh: false, box: false });

  if (!LM || !BM) return null; // shell-locations.jsx / shell-boxes.jsx not on this page

  const effFoh = SH.effectiveLocation(rawShell, storeSel, 'foh');
  const effBoh = SH.effectiveLocation(rawShell, storeSel, 'boh');

  function pickSide(side, locationId) {
    setBusy((o) => ({ ...o, [side]: true }));
    SH.setShellLocation(shell.id, storeSel, side, locationId).then(() => setBusy((o) => ({ ...o, [side]: false })));
  }
  function pickBox(boxId) {
    setBusy((o) => ({ ...o, box: true }));
    SH.setShellBox(shell.id, boxId).then(() => setBusy((o) => ({ ...o, box: false })));
  }

  function SideRow({ side, label, eff }) {
    const isOverride = eff.source === 'override';
    const isInheritedShown = storeSel != null && eff.source === 'default';
    const canClear = storeSel == null ? !!eff.location_id : isOverride;
    return <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkMute }}>{label}</span>
        {isInheritedShown && eff.location_id && <span style={{ fontSize: 10, color: P.inkFaint, fontStyle: 'italic' }}>inherited from shell default</span>}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', opacity: isInheritedShown ? .6 : 1 }}>
        <div style={{ flex: 1 }}>
          <LM.DestPicker locations={locations} side={side} value={eff.location_id} disabled={busy[side]}
            placeholder={'Not set'} onPick={(id) => pickSide(side, id)}
            onRequestNew={() => LM.openNew({ side, storeId: storeSel, onCreated: (loc) => pickSide(side, loc.id) })} />
        </div>
        {canClear && <PBtn variant="ghost" size="xs" disabled={busy[side]} onClick={() => pickSide(side, null)}>Clear</PBtn>}
      </div>
    </div>;
  }

  return <Card padding={16} style={{ marginBottom: 18 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <Icon name="map-pin" size={15} stroke={1.9} color={P.inkDim} />
      <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink, flex: 1 }}>Placement</span>
      <div style={{ position: 'relative', minWidth: 180 }}>
        <select value={storeSel || ''} onChange={(e) => setStoreSel(e.target.value || null)}
          style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', padding: '7px 28px 7px 10px', border: `1px solid ${P.fieldBorder}`, borderRadius: P.r10, background: P.field, fontSize: 12, fontWeight: 700, color: P.ink, fontFamily: P.fontSans, outline: 'none', cursor: 'pointer' }}>
          <option value="">Company default</option>
          {stores.map((st) => <option key={st.slug} value={st.slug}>{st.name || st.slug}</option>)}
        </select>
        <Icon name="chevron-down" size={12} stroke={2.2} color={P.inkMute} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
      </div>
    </div>
    {locStatus.error === 'not-available' ?
      <div style={{ fontSize: 11.5, color: P.inkMute }}>Locations not available on this server yet.</div> :
      <>
        <SideRow side="foh" label="Front of house" eff={effFoh} />
        <SideRow side="boh" label="Back of house" eff={effBoh} />
      </>}
    <div style={{ marginTop: 4 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 6 }}>Box</div>
      {boxStatus.error === 'not-available' ?
        <div style={{ fontSize: 11.5, color: P.inkMute }}>Boxes not available on this server yet.</div> :
        <BM.DestPicker boxes={boxes} value={box && box.id} disabled={busy.box} placeholder="Not set"
          onPick={(id) => pickBox(id)} onRequestNew={() => BM.openNew({ onCreated: (b) => pickBox(b.id) })} />}
    </div>
    <div style={{ fontSize: 11, color: P.inkFaint, marginTop: 10, lineHeight: 1.4 }}>Not mandatory — leaving this empty is fine. Every variation on this shell inherits whatever is set here unless overridden.</div>
  </Card>;
}

// ── Shell details — read-only, in a modal ──────────────────────────────────
// There is no update-shell route (docs/SHELLS-PLAN-2026-09-09.md §3): a shell
// is keyed by brand+format+weight+unit+pack, so a different size or format is
// a NEW shell, not an edit of this one. This used to host the shell form in
// edit mode; now it just shows what the shell is and how it prices against
// the market — plus Placement (location/box), which DOES have a real setter
// route and is editable right here. `onSave` is accepted for backward
// compatibility with callers that still pass it (it is never called).
window.ShellEditModal = function ShellEditModal({ p, shellId, onClose, onSave }) {
  const P = useP();
  const resolved = shellId || (p ? (SH.shellOf(p) || {}).id : null);
  const shell = resolved ? SH.shellById(resolved) : null;
  const detail = SH.useShellDetail(resolved); // primes SH.effectivePrice() for MarketPricingSection below, and carries .shell.locations + .box for Placement
  if (!shell) {
    return <div onClick={onClose} style={window.overlayScrim(P, { z: 220, padding: '32px 20px' })}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...window.overlayCard, width: 'min(480px,96vw)', background: P.bg, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '15px 20px', borderBottom: `1px solid ${P.hairline}`, background: P.surface }}>
          <div style={{ flex: 1 }}><div style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>No shell on record</div></div>
          <IconBtn icon="x" size={16} onClick={onClose} />
        </div>
        <div style={{ padding: 20 }}>
          <window.EmptyState icon="box" title="This product isn't linked to a shell" body="It may predate the shells rewrite, or the link could not be resolved. Add it to a shell from the catalog." compact />
        </div>
      </div>
    </div>;
  }
  return <div onClick={onClose} style={window.overlayScrim(P, { z: 220, padding: '32px 20px' })}>
    <div onClick={(e) => e.stopPropagation()} style={{ ...window.overlayCard, width: 'min(760px,96vw)', background: P.bg, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '15px 20px', borderBottom: `1px solid ${P.hairline}`, background: P.surface }}>
        <Thumb item={{ hue: SH.hueOf(shell) }} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkMute }}>Product shell</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: P.ink, letterSpacing: '-.01em' }}>{shell.name}</div>
          <div style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono, marginTop: 1 }}>{shell.id} · {shell.variationCount} variation{shell.variationCount === 1 ? '' : 's'}</div>
        </div>
        <IconBtn icon="x" size={16} onClick={onClose} />
      </div>
      <div style={{ padding: 20, maxHeight: '72vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', gap: 9, padding: '11px 13px', background: P.infoSoft, borderRadius: P.r10, marginBottom: 16 }}>
          <Icon name="info" size={14} color={P.info} style={{ flex: '0 0 auto', marginTop: 1 }} />
          <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>Shell details are set at creation and can’t be edited here — create a new shell if the brand, format or size needs to change.</div>
        </div>
        <Card padding={16} style={{ marginBottom: 18 }}>
          {SH.sharedRows(shell, { locations: detail && detail.shell && detail.shell.locations }).map((f, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderTop: i ? `1px solid ${P.hairline}` : 'none' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: P.inkDim }}>{f.label}{f.flag && <Tag>{f.flag}</Tag>}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{f.value}</span>
          </div>)}
        </Card>
        <PlacementSection shell={shell} detail={detail} />
        <MarketPricingSection shell={shell} />
      </div>
    </div>
  </div>;
};

// ── Add a product = add a VARIATION to a shell ─────────────────────────────
const FLOW_STEPS = [
{ k: 'shell', label: 'Choose shell' },
{ k: 'variation', label: 'Variation' },
{ k: 'batch', label: 'First batch' },
{ k: 'done', label: 'Done' }];

// Which slot labels the primary name field, by category — the owner's
// ruling: the intake person types a strain or flavor name, never a product
// name, and the product name is derived from it (docs/SHELLS-PLAN-2026-09-
// 09.md, rulings). Wellness/Accessories have no strain/flavor concept at all.
const NAME_SLOT_LABEL = { Flower: 'Strain', 'Pre-Rolls': 'Strain', Vapes: 'Strain', Concentrates: 'Strain', Edibles: 'Flavor', Wellness: 'Product name', Accessories: 'Product name' };
const NAME_SLOT_EXAMPLE = { Flower: 'Blue Dream', 'Pre-Rolls': 'Blue Dream', Vapes: 'Blue Dream', Concentrates: 'Blue Dream', Edibles: 'Fruit Punch', Wellness: 'Sleep Support', Accessories: 'Grinder' };

window.AddProductFlow = function AddProductFlow({ entry = 'catalog', lockShell, onClose, onDone }) {
  const P = useP();
  const money = window.HW.fmt.money0;
  const shells = SH.useShells();
  SH.useFormats(); // ensure the format library (and its templates) is loaded
  const [step, setStep] = React.useState(lockShell ? 1 : 0);
  const [q, setQ] = React.useState('');
  const [shellId, setShellId] = React.useState(lockShell || null);
  const [newShell, setNewShell] = React.useState(false); // inline "create shell first"
  const shell = shellId ? SH.shellById(shellId) : null;
  const format = shell ? SH.formatById(shell.format_id) : null;
  const template = (format && format.template) || '';
  // Which optional slots this shell's format actually uses — shown only when
  // the template has them (plan §2 / §4).
  const hasRatio = /\{ratio\}/.test(template);
  const hasTier = /\{tier\}/.test(template);
  const hasType = /\{[^}]*type[^}]*\}/.test(template);
  const nameLabel = (shell && NAME_SLOT_LABEL[shell.cat]) || 'Name';
  const nameExample = (shell && NAME_SLOT_EXAMPLE[shell.cat]) || 'Example';

  const [v, setV] = React.useState({ name: '', ratio: '', tier: '', type: 'Hybrid', sku: '', skuManual: false, price: '', desc: '', photo: '', sample: false, metaTitle: '', metaDesc: '', slug: '', keywords: '' });
  const [metaOpen, setMetaOpen] = React.useState(false);
  const [b, setB] = React.useState({ skip: false, qty: '', cost: '', code: '', metrc: '', exp: '', thc: '', cbd: '', total: '' });
  const s1 = (k, x) => setV((o) => ({ ...o, [k]: x }));
  const b1 = (k, x) => setB((o) => ({ ...o, [k]: x }));

  const hits = !q.trim() ? shells.slice(0, 5) : shells.filter((s) => (s.name + ' ' + s.brand + ' ' + s.cat + ' ' + s.sub).toLowerCase().includes(q.toLowerCase())).slice(0, 6);
  const cur = FLOW_STEPS[step];

  // SKU is generated from the shell code + product initials, and stays editable
  // because it becomes external_id — the key Weedmaps recognises the product by.
  const autoSku = React.useMemo(() => {
    if (!shell) return '';
    const size = String(shell.weight).replace(/[^0-9]/g, '').slice(0, 3) || 'X';
    const init = v.name.trim().split(/\s+/).filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 3) || 'NEW';
    return SH.mono2(shell.brand) + '-' + size + '-' + init;
  }, [shell && shell.id, v.name]);
  const sku = v.skuManual ? v.sku : autoSku;

  // The derived product name — rendered live under the name field, engine
  // warnings surfaced inline. Never sent as a typed name; `commit()` below
  // sends the SLOTS and lets the server (or the local naming engine) derive
  // it the same way this preview does.
  const [namePreview, setNamePreview] = React.useState(null); // null while pending/empty
  React.useEffect(() => {
    if (!shell || !v.name.trim()) { setNamePreview(null); return; }
    const slots = { name: v.name.trim() };
    if (hasRatio && v.ratio.trim()) slots.ratio = v.ratio.trim();
    if (hasTier && v.tier) slots.tier = v.tier;
    if (hasType && v.type && v.type !== 'N/A') slots.type = v.type;
    let live = true;
    const t = setTimeout(() => {
      SH.previewName(shell.format_id, slots, { weight: shell.netW, unit: shell.unit, pack: shell.pack, category: shell.cat }).then((r) => { if (live) setNamePreview(r); });
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [shell && shell.id, v.name, v.ratio, v.tier, v.type, hasRatio, hasTier, hasType]);
  const derivedName = (namePreview && namePreview.name) || '';

  // Storefront meta belongs to the PRODUCT, not the family — every variation
  // gets its own search listing. Drafted from the name, editable per field.
  // (Decorative only — there is no column for it server-side; see the "done"
  // step's own note.)
  const meta = React.useMemo(() => {
    const nm = derivedName || v.name.trim() || 'New product';
    const br = shell ? shell.brand : '';
    return {
      title: v.metaTitle || `${nm} — ${br} | Hyperwolf`,
      desc: v.metaDesc || `Buy ${nm} by ${br} — ${shell ? shell.weight + ' ' + shell.cat.toLowerCase() : ''}, lab-tested with same-day delivery across Riverside and San Bernardino.`,
      slug: v.slug || SH.slugify(br + '-' + nm),
      keywords: v.keywords || [br.toLowerCase(), nm.toLowerCase(), shell ? shell.cat.toLowerCase() : '', hasType ? String(v.type).toLowerCase() : '', 'cannabis delivery'].filter(Boolean).join(', ') };
  }, [derivedName, v.name, v.metaTitle, v.metaDesc, v.slug, v.keywords, shell && shell.id]);

  // Seed the description from the AI drafter the moment a shell is chosen.
  // Price is never seeded from the shell — a shell no longer carries one
  // (docs/SHELLS-PLAN-2026-09-09.md §1); every variation prices itself.
  React.useEffect(() => {
    if (shell && !v.desc) setV((o) => ({ ...o, desc: SH.aiDesc(shell, { name: o.name, type: o.type }) }));
  }, [shell && shell.id]);

  const canNext = cur.k === 'shell' ? !!shell :
  cur.k === 'variation' ? !!v.name.trim() && !!sku.trim() && v.price !== '' && !!derivedName :
  cur.k === 'batch' ? b.skip || b.qty !== '' && b.cost !== '' : true;

  // WHAT IS STOPPING YOU, in words.
  //
  // The gate above is right; being SILENT about it was not. Continue had no
  // `disabled` attribute and only a faded opacity, so clicking it did nothing,
  // said nothing, and left no way to find out what was wrong. Driven headlessly,
  // five consecutive clicks moved the flow zero steps and raised zero errors —
  // which is precisely what "I don't even know what to do" feels like.
  const missing =
    cur.k === 'shell' ? (!shell ? 'Pick a shell to continue.' : null) :
    cur.k === 'variation' ? (
      !v.name.trim() ? `Enter a ${nameLabel.toLowerCase()} to continue — e.g. “${nameExample}”.` :
      !sku.trim() ? 'This variation needs a SKU.' :
      v.price === '' ? 'Enter a price to continue.' :
      !derivedName ? ((namePreview && namePreview.warnings && namePreview.warnings[0]) || 'Waiting on the naming engine…') : null) :
    cur.k === 'batch' ? (
      !b.skip && b.qty === '' ? 'Enter a quantity, or tick “create without stock”.' :
      !b.skip && b.cost === '' ? 'Enter a unit cost, or tick “create without stock”.' : null) :
    null;
  const effPrice = v.price !== '' ? parseFloat(v.price) || 0 : 0;
  const margin = effPrice && b.cost ? Math.round((1 - (parseFloat(b.cost) || 0) / (effPrice || 1)) * 100) : null;

  // WAS: SH.addVariation(...) — a synchronous write to the client-side mock
  // only, called from the button's onClick with the very next line advancing
  // to the "done" step unconditionally. Nothing here ever reached the server,
  // so nothing ever reached Weedmaps, and the operator was told "added"
  // regardless. NOW: commit() sends SLOTS (never a typed name) to
  // SH.createVariation, which POSTs /api/shells/<id>/variations and hands
  // back the server-derived name; the "done" step is only reached once that
  // confirms. See saveErr / saveWm below and their one call site, the
  // "Create variation" button.
  const [saving, setSaving] = React.useState(false);
  const [saveErr, setSaveErr] = React.useState(null);
  const [saveWm, setSaveWm] = React.useState(null);
  const [saveCollided, setSaveCollided] = React.useState(false);
  const genetics = hasType && v.type && v.type !== 'N/A' ? String(v.type).toLowerCase() : null;
  const commit = () => {
    if (!shell) return Promise.resolve(false);
    setSaving(true);setSaveErr(null);
    const slots = { name: v.name.trim() };
    if (hasRatio && v.ratio.trim()) slots.ratio = v.ratio.trim();
    if (hasTier && v.tier) slots.tier = v.tier;
    if (hasType && v.type && v.type !== 'N/A') slots.type = v.type;
    return SH.createVariation(shell.id, slots, {
      sku, price: effPrice, genetics,
      thc: !b.skip && b.thc !== '' ? parseFloat(b.thc) : undefined,
      cbd: !b.skip && b.cbd !== '' ? parseFloat(b.cbd) : undefined,
      cost: !b.skip && b.cost !== '' ? parseFloat(b.cost) : undefined,
      inventory: b.skip ? 0 : parseInt(b.qty || '0', 10) || 0,
      sample: v.sample, description: v.desc || null
    }).then((r) => {
      setSaving(false);
      if (!r.ok) {setSaveErr(wmCreateErrorText(r));return false;}
      setSaveWm(r.wm || null);
      setSaveCollided(!!r.collided);
      return true;
    });
  };

  // ── pre-submit collision warning ──
  // There is no sku-uniqueness check anywhere in this build, so a typo'd or
  // reused sku silently turns "add a product" into "edit an existing one".
  // The operator should find out BEFORE clicking Create, not just after.
  // Debounced off `sku` (which changes on every keystroke of the name while
  // auto-assigned) and only checked on the variation step, where the field is
  // visible. Purely advisory: createVariation's own server-side check runs
  // regardless of whether this resolves in time, so a slow or failed check
  // here cannot cause data loss, only a missed warning.
  const [skuExisting, setSkuExisting] = React.useState(null); // null = clear/unknown, else the raw row found
  React.useEffect(() => {
    if (cur.k !== 'variation' || !sku || !sku.trim() || !SH.fetchRawProduct) {setSkuExisting(null);return;}
    let live = true;
    const t = setTimeout(() => {
      SH.fetchRawProduct(sku).then((r) => {if (live) setSkuExisting(r.ok ? r.product : null);});
    }, 400);
    return () => {live = false;clearTimeout(t);};
  }, [sku, cur.k]);

  const Head = () => <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '11px 20px', background: P.surface2, borderBottom: `1px solid ${P.hairline}`, overflowX: 'auto' }}>
    {FLOW_STEPS.map((s, i) => {const on = i === step, done = i < step;
      return <React.Fragment key={s.k}>
        {i > 0 && <span style={{ width: 16, height: 1.5, background: done || on ? P.accent : P.hairline2, flex: '0 0 auto' }} />}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>
          <span style={{ width: 19, height: 19, borderRadius: 99, background: done ? P.good : on ? P.accent : P.surface3, color: done ? '#fff' : on ? P.accentInk : P.inkMute, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, fontFamily: P.fontMono }}>{done ? <Icon name="check" size={11} stroke={3} color="#fff" /> : i + 1}</span>
          <span style={{ fontSize: 11.5, fontWeight: on ? 700 : 600, color: on ? P.ink : P.inkMute, whiteSpace: 'nowrap' }}>{s.label}</span>
        </span>
      </React.Fragment>;})}
  </div>;

  const ShellRecap = () => shell ? <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', background: P.goodSoft, borderRadius: P.r10 }}>
    <Thumb item={{ hue: SH.hueOf(shell) }} size={34} radius={8} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: P.good }}>Adding to shell</div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shell.name}</div>
      <div style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{shell.id} · {SH.familyPath(shell)} · {shell.variationCount} existing variation{shell.variationCount === 1 ? '' : 's'}</div>
    </div>
    {!lockShell && <PBtn variant="ghost" size="xs" onClick={() => {setShellId(null);setStep(0);}}>Change</PBtn>}
  </div> : null;

  const readImg = (file) => {
    if (!file || !/^image\//.test(file.type)) return;
    const r = new FileReader();r.onload = () => s1('photo', r.result);r.readAsDataURL(file);
  };

  // ── inline "create the shell first" ──
  if (newShell) return <div onClick={onClose} style={window.overlayScrim(P, { z: 220, padding: '32px 20px' })}>
    <div onClick={(e) => e.stopPropagation()} style={{ ...window.overlayCard, width: 'min(900px,96vw)', background: P.bg, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '15px 20px', borderBottom: `1px solid ${P.hairline}`, background: P.surface }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="box-add" size={16} stroke={2} /></span>
        <div style={{ flex: 1 }}><div style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>New shell first</div><div style={{ fontSize: 11.5, color: P.inkDim }}>Define the family, then carry straight on to its first variation</div></div>
        <IconBtn icon="x" size={16} onClick={onClose} />
      </div>
      <div style={{ padding: 20, maxHeight: '74vh', overflowY: 'auto' }}>
        <window.ShellForm compact onCancel={() => setNewShell(false)} onSaved={(id) => {setNewShell(false);setShellId(id);setStep(1);}} />
      </div>
    </div>
  </div>;

  return <div onClick={onClose} style={window.overlayScrim(P, { z: 220, padding: '36px 20px' })}>
    <div onClick={(e) => e.stopPropagation()} style={{ ...window.overlayCard, width: cur.k === 'variation' ? 'min(940px,96vw)' : 'min(640px,96vw)', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, overflow: 'hidden', transition: 'width .2s' }} data-tour="add-product">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '15px 20px', borderBottom: `1px solid ${P.hairline}` }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="package" size={16} stroke={2} /></span>
        <div style={{ flex: 1 }}><div style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>New product</div><div style={{ fontSize: 11.5, color: P.inkDim }}>A product is a <b>variation</b> of a shell — pick the shell, then name the flavour</div></div>
        <IconBtn icon="x" size={16} onClick={onClose} />
      </div>
      <Head />
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 15, minHeight: 260 }}>

        {cur.k === 'shell' && <>
          <div style={{ display: 'flex', gap: 9, padding: '11px 13px', background: P.infoSoft, borderRadius: P.r10 }}>
            <Icon name="info" size={14} color={P.info} style={{ flex: '0 0 auto', marginTop: 1 }} />
            <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>Shells describe a <b>family</b> — “Alpine · All-In-One Vape 1g”. A flavour like <i>Fruit Punch</i> is a product hanging off it, and one shell can carry fifty. Pick the shell first and everything shared comes with it.</div>
          </div>
          <div><Lb>Find the shell</Lb><Field icon="search" placeholder="Brand, format, category or subcategory…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div style={{ border: `1px solid ${P.hairline}`, borderRadius: P.r10, overflow: 'hidden' }}>
            {hits.map((s, i) => <button key={s.id} onClick={() => {setShellId(s.id);setStep(1);}} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', borderTop: i ? `1px solid ${P.hairline}` : 'none', cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }} onMouseEnter={(e) => e.currentTarget.style.background = P.surface2} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              <Thumb item={{ hue: SH.hueOf(s) }} size={34} radius={8} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{s.id} · {SH.familyPath(s)} · {s.variationCount} variation{s.variationCount === 1 ? '' : 's'}</div>
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: P.info, flex: '0 0 auto' }}>Add variation</span>
            </button>)}
            {hits.length === 0 && <div style={{ padding: 16, textAlign: 'center', fontSize: 12.5, color: P.inkMute }}>No shell matches “{q}”.</div>}
          </div>
          <button onClick={() => setNewShell(true)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 13px', background: P.surface2, border: `1px dashed ${P.hairline2}`, borderRadius: P.r10, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans, width: '100%' }}>
            <Icon name="plus" size={14} color={P.ink2} />
            <span style={{ flex: 1, fontSize: 11.5, color: P.ink2, lineHeight: 1.45 }}>Genuinely new format or brand? <b>Create the shell here</b> — you’ll land straight back on this flow to add its first variation.</span>
            <Icon name="chevron-right" size={15} color={P.inkMute} />
          </button>
        </>}

        {cur.k === 'variation' && shell && <>
          <ShellRecap />
          {/* prefill meter */}
          <div title="How much of the new product is already filled in from the shell. The higher this is, the faster staff can add a variation." style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', background: P.goodSoft, border: `1px solid ${P.good}44`, borderRadius: P.r12 }}>
            <span style={{ width: 34, height: 34, borderRadius: 9, background: P.good, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="check" size={18} stroke={2.4} color="#fff" /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              {(() => {const inh = SH.sharedRows(shell).length;const tot = inh + 2;
                return <>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{inh} of {tot} details pre-filled</div>
                  <div style={{ fontSize: 11.5, color: P.good, marginTop: 2 }}>Inherited from the shell — you only set what makes this product unique.</div>
                </>;})()}
            </div>
            <div style={{ width: 110, height: 8, borderRadius: 99, background: P.good + '33', overflow: 'hidden', flex: '0 0 auto' }}>
              {(() => {const inh = SH.sharedRows(shell).length;
                return <div style={{ width: Math.round(inh / (inh + 2) * 100) + '%', height: '100%', background: P.good, borderRadius: 99 }} />;})()}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: 16, alignItems: 'start' }}>
            {/* inherited (locked) */}
            <div style={{ border: `1px solid ${P.hairline}`, borderRadius: P.r12, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                <Icon name="lock" size={14} stroke={1.9} color={P.inkMute} />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Inherited from shell</span>
              </div>
              <div style={{ fontSize: 11.5, color: P.inkMute, marginBottom: 13 }}>Locked to keep the family consistent.</div>
              {SH.sharedRows(shell).map((f, i) => <div key={i} style={{ marginBottom: 9 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkMute }}>{f.label}</span>{f.flag && <Tag>{f.flag}</Tag>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: 9 }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: P.ink2, fontFamily: P.fontMono, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.value}</span>
                    {f.sub && <span style={{ display: 'block', fontSize: 10, color: P.inkMute, fontFamily: P.fontMono, marginTop: 1 }}>{f.sub}</span>}
                  </span>
                  <Icon name="lock" size={12} stroke={1.9} color={P.inkFaint} />
                </div>
              </div>)}
            </div>

            {/* this variation (editable) */}
            <div style={{ border: `1px solid ${P.accentBorder}`, borderRadius: P.r12, padding: 16, boxShadow: `0 0 0 3px ${P.accentSoft}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                <Icon name="pencil" size={14} stroke={1.9} color={P.mode === 'dark' ? P.accent : '#7A5A00'} />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>This variation</span>
              </div>
              <div style={{ fontSize: 11.5, color: P.inkMute, marginBottom: 13 }}>The only details that change per product.</div>

              <div style={{ marginBottom: 13 }}>
                <Lb>Product photo</Lb>
                <label onDrop={(e) => {e.preventDefault();readImg(e.dataTransfer.files && e.dataTransfer.files[0]);}} onDragOver={(e) => e.preventDefault()}
                  title="Drag an image in or click to browse. One image per variation, stored on the product record."
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, border: `1.5px dashed ${P.hairline3}`, borderRadius: 11, background: P.surface2, cursor: 'pointer', textAlign: 'center' }}>
                  <input type="file" accept="image/*" onChange={(e) => readImg(e.target.files && e.target.files[0])} style={{ display: 'none' }} />
                  {v.photo ?
                  <><img src={v.photo} alt="" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 10 }} />
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: P.mode === 'dark' ? P.accent : '#7A5A00' }}>Replace image</span></> :
                  <><span style={{ width: 42, height: 42, borderRadius: 10, background: P.surface3, display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.inkMute }}><Icon name="camera" size={20} stroke={1.7} /></span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink }}>Drag &amp; drop or click to upload</span>
                    <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>PNG or JPG · 1000 × 1000 px</span></>}
                </label>
              </div>

              <div style={{ marginBottom: 6 }}><Lb hint={`The ${nameLabel.toLowerCase()} the intake person types — never the product name itself. The name below is derived from it.`}>{nameLabel} *</Lb>
                <Field placeholder={`e.g. ${nameExample}`} value={v.name} onChange={(e) => s1('name', e.target.value)} /></div>
              {/* Derived name — same style as ShellForm's "Resulting shell name" line. Never editable: this IS the product name, and it is never typed. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 13, padding: '10px 12px', background: P.surface2, borderRadius: P.r10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, color: P.inkMute, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase' }}>Product name</span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{derivedName || (v.name.trim() ? '…' : '—')}</span>
                {namePreview && namePreview.warnings && namePreview.warnings.length > 0 &&
                  <span style={{ fontSize: 11, color: P.warn, fontWeight: 600 }}>{namePreview.warnings.join(' · ')}</span>}
              </div>

              {(hasRatio || hasTier || hasType) && <div style={{ display: 'flex', gap: 10, marginBottom: 13, flexWrap: 'wrap' }}>
                {hasRatio && <div style={{ flex: '1 1 100px' }}><Lb hint="Cannabinoid ratio, e.g. 2:1 CBD:THC.">Ratio</Lb>
                  <Field mono placeholder="2:1" value={v.ratio} onChange={(e) => s1('ratio', e.target.value)} /></div>}
                {hasTier && <div style={{ flex: '1 1 100px' }}><Lb>Tier</Lb>
                  <Sel2 value={v.tier || '1'} onChange={(x) => s1('tier', x)} options={['1', '2', '3', '4']} /></div>}
                {hasType && <div style={{ flex: '1 1 220px' }}><Lb>Type</Lb>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[['Indica', P.indica], ['Sativa', P.sativa], ['Hybrid', P.hybrid]].map(([t, c]) => {const on = v.type === t;
                      return <button key={t} onClick={() => setV((o) => ({ ...o, type: t, desc: SH.aiDesc(shell, { name: o.name, type: t }) }))} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 10px', borderRadius: P.r999, border: `1px solid ${on ? P.ink : P.hairline2}`, background: on ? P.ink : P.surface, color: on ? P.surface : P.ink2, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}>
                        <span style={{ width: 6, height: 6, borderRadius: 99, background: c }} />{t}</button>;})}
                  </div>
                </div>}
              </div>}

              <div style={{ marginBottom: 13 }}>
                <Lb right={<PBtn variant="soft" size="xs" icon="sparkle" onClick={() => s1('desc', SH.aiDesc(shell, v))}>Regenerate</PBtn>}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Description <Tag kind="ai">AI draft</Tag></span>
                </Lb>
                <textarea value={v.desc} onChange={(e) => s1('desc', e.target.value)} rows={3} placeholder="Tasting notes, effects — anything specific to this product…"
                  style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: 74, padding: '9px 12px', border: `1px solid ${P.fieldBorder}`, borderRadius: P.r10, background: P.field, color: P.ink, fontSize: 13.5, fontFamily: P.fontSans, lineHeight: 1.45, outline: 'none' }} />
                <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 5 }}>Pre-drafted by the AI product generator — edit freely or regenerate.</div>
              </div>

              <div style={{ marginBottom: 13 }}>
                <Lb hint="A variation's SKU becomes external_id — the key Weedmaps recognises it by. Changing it later makes WM treat it as a brand-new product."
                  right={<button onClick={() => setV((o) => ({ ...o, skuManual: !o.skuManual, sku: o.skuManual ? '' : autoSku }))} style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: P.fontSans }}><Tag kind={v.skuManual ? 'warn' : 'good'}>{v.skuManual ? 'Manual · lock' : 'Auto-assigned · edit'}</Tag></button>}>SKU</Lb>
                {v.skuManual ?
                <Field mono value={v.sku} onChange={(e) => s1('sku', e.target.value.toUpperCase())} /> :
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10, minHeight: 38 }}>
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: P.ink2, fontFamily: P.fontMono }}>{autoSku || '—'}</span>
                  <Icon name="refresh" size={14} stroke={1.8} color={P.inkMute} />
                </div>}
                <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 5 }}>Generated from the shell code + product name. Get it right now — it is permanent on Weedmaps.</div>
                {skuExisting && <div style={{ display: 'flex', gap: 9, marginTop: 8, padding: '10px 12px', background: P.warnSoft, border: `1px solid ${P.warn}44`, borderRadius: P.r10 }}>
                  <Icon name="alert-triangle" size={14} color={P.warn} style={{ flex: '0 0 auto', marginTop: 1 }} />
                  <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>
                    <b>{sku}</b> already exists — <b>{skuExisting.name}</b>. Creating will <b>edit that product</b>, not add a new one.
                    Its Weedmaps mapping, publish status and sample flag are kept as-is; only the fields on this screen will change.
                  </div>
                </div>}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '11px 13px', marginBottom: 13, background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: 9 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink }}>Display sample</div>
                  <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 2, lineHeight: 1.4 }}>Hidden from the menu &amp; not for sale — still tracked as a full product profile.</div>
                </div>
                <MiniSwitch on={v.sample} onChange={(x) => s1('sample', x)} color={P.warn} />
              </div>

              <div>
                <Lb hint="A shell no longer has a shared price — every variation prices itself.">Price *</Lb>
                <Field mono icon="dollar" placeholder="0.00" value={v.price} onChange={(e) => s1('price', e.target.value.replace(/[^0-9.]/g, ''))} />
                <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 5 }}>This variation's own retail price.</div>
              </div>

              {/* Storefront meta — per product, never shared with the family */}
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${P.hairline}` }}>
                <Lb hint="Each variation is its own storefront page, so it gets its own title, description and slug. Nothing here is shared with the rest of the family."
                  right={<PBtn variant="ghost" size="xs" iconRight={metaOpen ? 'chevron-up' : 'chevron-down'} onClick={() => setMetaOpen(!metaOpen)}>{metaOpen ? 'Hide' : 'Edit'}</PBtn>}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Search &amp; storefront meta <Tag kind="good">Auto-drafted</Tag></span>
                </Lb>
                {!metaOpen ?
                <div style={{ padding: '11px 13px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}>
                  <div style={{ fontSize: 11.5, color: P.good, fontFamily: P.fontMono, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>hyperwolf.com › shop › {meta.slug}</div>
                  <div style={{ fontSize: 13.5, color: '#1a0dab', fontWeight: 600, marginTop: 3, lineHeight: 1.3 }}>{meta.title}</div>
                  <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5, marginTop: 3 }}>{meta.desc}</div>
                </div> :
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  <div><Lb hint="Recommended 50–60 characters.">Meta title</Lb><Field value={meta.title} onChange={(e) => s1('metaTitle', e.target.value)} />
                    <div style={{ fontSize: 11.5, color: meta.title.length > 60 ? P.warn : P.inkMute, fontFamily: P.fontMono, marginTop: 4 }}>{meta.title.length} / 60</div></div>
                  <div><Lb hint="Recommended 150–160 characters.">Meta description</Lb>
                    <textarea value={meta.desc} onChange={(e) => s1('metaDesc', e.target.value)} rows={3} style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: '9px 12px', border: `1px solid ${P.fieldBorder}`, borderRadius: P.r10, background: P.field, color: P.ink, fontSize: 13.5, fontFamily: P.fontSans, lineHeight: 1.45, outline: 'none' }} />
                    <div style={{ fontSize: 11.5, color: meta.desc.length > 160 ? P.warn : P.inkMute, fontFamily: P.fontMono, marginTop: 4 }}>{meta.desc.length} / 160</div></div>
                  <div><Lb>URL slug</Lb><Field mono value={meta.slug} onChange={(e) => s1('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} /></div>
                  <div><Lb>Keywords</Lb><Field value={meta.keywords} onChange={(e) => s1('keywords', e.target.value)} /></div>
                </div>}
              </div>
            </div>
          </div>
        </>}

        {cur.k === 'batch' && <>
          <ShellRecap />
          <div style={{ display: 'flex', gap: 9, padding: '11px 13px', background: P.infoSoft, borderRadius: P.r10 }}>
            <Icon name="info" size={14} color={P.info} style={{ flex: '0 0 auto', marginTop: 1 }} />
            <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>Stock never gets typed as a bare number — it arrives as a <b>batch</b>. The batch carries the quantity, what we paid, its own barcode / RFID and its potency. That is why THC is per batch and why cost is here rather than on the shell.</div>
          </div>
          <label onClick={() => b1('skip', !b.skip)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: b.skip ? P.surface3 : P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, cursor: 'pointer' }}>
            <Check on={b.skip} onChange={(x) => b1('skip', x)} size={17} />
            <span style={{ fontSize: 12.5, color: P.ink2 }}>Create the variation without stock — receive a batch later</span>
          </label>
          {!b.skip && <div style={{ border: `1px solid ${P.hairline}`, borderRadius: P.r12, overflow: 'hidden' }}>
            <div style={{ padding: '9px 13px', background: P.surface2, borderBottom: `1px solid ${P.hairline}`, fontSize: 11.5, fontWeight: 700, color: P.ink }}>Receive first batch</div>
            <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><Lb>Quantity received</Lb><Field mono placeholder="0" value={b.qty} onChange={(e) => b1('qty', e.target.value.replace(/[^0-9]/g, ''))} /></div>
              <div><Lb hint="What we paid per unit for this batch. Different batches of the same product routinely cost different amounts.">Wholesale cost / unit</Lb><Field mono placeholder="0.00" value={b.cost} onChange={(e) => b1('cost', e.target.value.replace(/[^0-9.]/g, ''))} /></div>
              <div><Lb hint="Generated per batch and printed on the label — barcode and RFID encode the same value.">Batch barcode / RFID</Lb><Field mono placeholder="Auto-generate on receive" value={b.code} onChange={(e) => b1('code', e.target.value)} /></div>
              <div><Lb>METRC tag</Lb><Field mono placeholder="1A4FF01…" value={b.metrc} onChange={(e) => b1('metrc', e.target.value)} /></div>
              <div style={{ gridColumn: '1/-1' }}><Lb>Expiry</Lb><Field mono placeholder="MM/DD/YYYY" value={b.exp} onChange={(e) => b1('exp', e.target.value)} /></div>
            </div>
            <div style={{ padding: '11px 14px', borderTop: `1px solid ${P.hairline}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
                <Icon name="lightning" size={13} color={P.ink2} />
                <span style={{ fontSize: 11.5, fontWeight: 700, color: P.ink }}>Potency</span>
                <span style={{ fontSize: 11.5, color: P.inkMute }}>· typed from the batch label on the packaging</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div><Lb>THC %</Lb><Field mono placeholder="0.0" value={b.thc} onChange={(e) => b1('thc', e.target.value.replace(/[^0-9.]/g, ''))} /></div>
                <div><Lb>CBD %</Lb><Field mono placeholder="0.0" value={b.cbd} onChange={(e) => b1('cbd', e.target.value.replace(/[^0-9.]/g, ''))} /></div>
                <div><Lb hint="Total cannabinoids as printed on the label, where the packaging states it.">Total cannabinoids %</Lb><Field mono placeholder="0.0" value={b.total} onChange={(e) => b1('total', e.target.value.replace(/[^0-9.]/g, ''))} /></div>
              </div>
            </div>
            {margin != null && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderTop: `1px solid ${P.hairline}`, background: P.surface2 }}>
              <span style={{ fontSize: 11.5, color: P.inkDim }}>Margin on this batch</span>
              <span style={{ marginLeft: 'auto', fontSize: 13.5, fontWeight: 800, fontFamily: P.fontMono, color: margin > 40 ? P.good : P.warn }}>{margin}%</span>
            </div>}
          </div>}
          <div style={{ display: 'flex', gap: 9, padding: '11px 13px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}>
            <Icon name="lightning" size={14} color={P.inkMute} style={{ flex: '0 0 auto', marginTop: 1 }} />
            <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>Potency is <b>entered by hand from the batch label</b> on the packaging — we do not parse it out of a COA. Whoever receives the batch reads the printed figures and types them in, and the product’s low / high / avg recalculate across every in-stock batch.</div>
          </div>
        </>}

        {cur.k === 'done' && <div style={{ textAlign: 'center', padding: '14px 0' }}>
          <span style={{ width: 46, height: 46, borderRadius: 99, background: P.good, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={24} stroke={2.6} color="#fff" /></span>
          <div style={{ fontSize: 16.5, fontWeight: 800, color: P.ink, marginTop: 11 }}>{derivedName || v.name || 'Variation'} {saveCollided ? 'updated' : 'added'}</div>
          <div style={{ fontSize: 12.5, color: P.inkDim, fontFamily: P.fontMono, marginTop: 3 }}>{sku || '—'} · {shell ? shell.name : ''}{effPrice ? ' · ' + money(effPrice) : ''}</div>
          <div style={{ marginTop: 16, textAlign: 'left', border: `1px solid ${P.hairline}`, borderRadius: P.r10, overflow: 'hidden' }}>
            {[saveCollided ?
              ['Existing product updated, not created', 'warn', 'SKU ' + sku + ' already had a product on it — this edited that record in place rather than adding a new one. Its Weedmaps mapping, publish status and sample flag were left exactly as they were.'] :
              ['Variation created on ' + (shell ? shell.id : 'the shell'), 'good', 'Brand, format and size inherited; the name was derived, never typed.'],
            // The only line on this screen that reports whether this product
            // actually reached Weedmaps — SH.createVariation's own per-listing
            // push verdict, never a bare 200. `saveWm == null` is a genuinely
            // different fact from `saveWm.ok === false`: the catalog write was
            // confirmed by read-back either way, but a null push result means
            // the response that would have said what happened never arrived
            // (e.g. WM_API_BASE unreachable raised past the write, which the
            // route still committed).
            saveWm == null ?
              ['Weedmaps push status unknown', 'warn', 'The catalog write was confirmed, but no push result came back with it — check the sync log, or push again from the catalog screen.'] :
            saveWm.ok ?
              ['Pushed to Weedmaps', 'good', 'Confirmed by the server’s own push result — ' + saveWm.checked + ' listing' + (saveWm.checked === 1 ? '' : 's') + ' accepted it.'] :
            saveWm.checked === 0 ?
              ['Not pushed to Weedmaps yet', 'warn', 'Saved to the catalog, but no listing accepted the push — it should go out on the next sync.'] :
              ['Push to Weedmaps incomplete', 'warn', 'Saved to the catalog, but not every listing confirmed: ' + saveWm.failed.join('; ') + '.'],
            v.sample ? ['Marked as a display sample', 'warn', 'Kept off the sellable menu, still tracked as a full product profile.'] :
            b.skip ? ['No stock yet', 'neutral', 'It will not appear on any menu until a batch is received against it.'] :
            // WAS "recorded on the batch" — there is no batch/lot entity in
            // this build at all (GET /api/state.batches is always empty; see
            // the costRow note above). Quantity is the one real field here;
            // wholesale cost, barcode/RFID, METRC tag and expiry are entered
            // above and held nowhere once this modal closes.
            ['Batch received · ' + (b.qty || 0) + ' units', 'good', 'Quantity synced to the Weedmaps catalog as on-hand inventory. Wholesale cost, barcode/RFID, METRC tag and expiry are not stored anywhere in this build — there is no batch/lot table server-side yet.'],
            ['Inherits the shell’s Weedmaps node', 'good', shell ? shell.wmNode : '—'],
            ['Its own storefront listing', 'good', 'hyperwolf.com/shop/' + meta.slug + ' — title, description and keywords are written per product, not shared with the family.'],
            b.skip || !b.thc ? ['Potency not recorded yet', 'warn', 'Enter THC and cannabinoids from the batch label when the stock is received.'] : ['Potency recorded · ' + b.thc + '% THC', 'good', 'Sent to the catalog as the product’s THC. Low / high / avg still assume per-batch lots this build does not have.'],
            v.photo ? ['Photo not synced to Weedmaps', 'warn', 'This build has no image-hosting endpoint — the API expects a real image URL, not the file captured here. The photo stays on this device only.'] : null].filter(Boolean).map(([t, tone, d], i) => {
              const c = tone === 'good' ? P.good : tone === 'warn' ? P.warn : P.inkMute;
              return <div key={t} style={{ display: 'flex', gap: 10, padding: '10px 12px', borderTop: i ? `1px solid ${P.hairline}` : 'none' }}>
                <Icon name={tone === 'good' ? 'check-circle' : tone === 'warn' ? 'clock' : 'package'} size={14} color={c} style={{ flex: '0 0 auto', marginTop: 1 }} />
                <div><div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>{t}</div><div style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.45, marginTop: 1 }}>{d}</div></div>
              </div>;})}
          </div>
        </div>}
      </div>

      <div style={{ display: 'flex', gap: 9, padding: '14px 20px', borderTop: `1px solid ${P.hairline}`, background: P.surface2 }}>
        {step > (lockShell ? 1 : 0) && cur.k !== 'done' && <PBtn variant="secondary" size="md" icon="chevron-left" onClick={() => setStep((s) => s - 1)}>Back</PBtn>}
        <div style={{ flex: 1 }} />
        {cur.k === 'done' ?
        <PBtn variant="accent" size="md" icon="check" onClick={() => {onDone && onDone(v);onClose();}}>Open the shell</PBtn> :
        <><PBtn variant="secondary" size="md" onClick={onClose}>Cancel</PBtn>
          {/* saveErr is the SERVER's refusal, shown after a real attempt —
              distinct from `missing`, which is client-side validation before
              one is ever made. Never both at once: canNext gates missing off
              exactly when a submit is possible, which is the only time
              saveErr can be non-null. */}
          {missing && <span style={{ fontSize: 11.5, color: P.warn, fontWeight: 600, marginRight: 4, textAlign: 'right', maxWidth: 300 }}>{missing}</span>}
          {saveErr && <span style={{ fontSize: 11.5, color: P.bad, fontWeight: 600, marginRight: 4, textAlign: 'right', maxWidth: 320 }}>{saveErr}</span>}
          <PBtn variant="accent" size="md" iconRight="chevron-right" busy={saving} disabled={!canNext || saving}
            onClick={() => {
              if (!canNext || saving) return;
              const isFinal = FLOW_STEPS[step + 1] && FLOW_STEPS[step + 1].k === 'done';
              if (!isFinal) {setStep((s) => s + 1);return;}
              // Only advance to "done" once SH.createVariation's own
              // read-back says the product is really there. A failure leaves
              // the wizard on this step with saveErr visible, instead of
              // silently landing on a "done" screen for a write that never
              // happened.
              commit().then((ok) => {if (ok) setStep((s) => s + 1);});
            }}
            style={{ opacity: canNext && !saving ? 1 : .5 }}>
            {saving ? 'Creating…' : FLOW_STEPS[step + 1] && FLOW_STEPS[step + 1].k === 'done' ? 'Create variation' : 'Continue'}
          </PBtn></>}
      </div>
    </div>
  </div>;
};

Object.assign(window, { MarketPricingSection, useShellMarketPricing, shellProbeKeys, MarketLadder, marketCaption, MarketStoreList, MarketSoloLine });
