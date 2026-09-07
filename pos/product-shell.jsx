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
// All matching/tax logic is reused verbatim from pos/pricing-shared.jsx
// (window.HW_PRICING) — the exact same groupKey()/effectivePreTax()/
// computeExtremes()/computeAvgFull() the Pricing screen (pos/screen-
// pricing.jsx) uses. No second matcher, no second tax-basis rule.
//
// Hyperwolf's own shelf price IS pre-tax, by the same definition
// effectivePreTax() already uses for a competitor row with
// price_tax_basis === 'exclusive' — this is verified, not assumed:
// pos/sales-panel.jsx's SALES_TAX table (local cannabis + state excise +
// state sales tax) is computed ON TOP of the line price at checkout
// (`sub * (1 + SALES_TAX_RATE)`), never baked into it. So
// SH.effectivePrice(shell) is already the pre-tax figure this comparison
// needs — no computation, no guess.

// One probe per distinct flavor/variation concept the shell represents, fed
// through groupKey() exactly as a real competitor row would be — never a
// second matching algorithm. A shell with zero variations yet still gets one
// probe from brand + weight alone. A shell can resolve to more than one live
// group (each flavor is its own product); every group that matches
// contributes its rows to one combined comparison, since the number being
// compared (SH.effectivePrice) is a single, shell-level price, not per-
// variation.
function shellProbeKeys(shell) {
  const HP = window.HW_PRICING;
  const variations = (shell.variations && shell.variations.length) ? shell.variations : [null];
  const keys = new Set();
  variations.forEach(function (v) {
    const productName = [shell.brand, v && v.name, shell.weight].filter(Boolean).join(' ');
    const key = HP.groupKey({ brand: shell.brand, product_name: productName });
    if (key) { keys.add(key); }
  });
  return keys;
}

// Fetches the full live listing set once per shell and reduces it to exactly
// the shape the render below needs. Three real outcomes, matching the
// honest match-rate reality this codebase has already measured live
// (multi-source matches are a small fraction of the catalog):
//   0  — no competitor listings matched this shell at all.
//   1  — comparableCount < 2 (mirrors computeExtremes' own "a single value
//        isn't a range" rule EXACTLY, so this can trigger even with 2+ raw
//        listings if fewer than 2 of them have a resolvable tax basis).
//   2+ — a real range: full ladder + caption + store list.
function useShellMarketPricing(shell) {
  const [http, setHttp] = React.useState(null); // null = still loading
  React.useEffect(function () {
    let live = true;
    setHttp(null);
    window.HW_PRICING.fetchAllListings({}).then(function (r) { if (live) { setHttp(r); } });
    return function () { live = false; };
  }, [shell.id]);

  return React.useMemo(function () {
    if (!http) { return { status: 'loading' }; }
    if (!http.ok || !http.parsed || !http.body || !Array.isArray(http.body.listings)) {
      return { status: 'error', http: http };
    }
    const HP = window.HW_PRICING;
    const keys = shellProbeKeys(shell);
    const rows = keys.size ? http.body.listings.filter(function (row) {
      const k = HP.groupKey(row);
      return k != null && keys.has(k);
    }) : [];
    const distinctStores = new Set(rows.map(HP.competitorKey)).size;
    if (distinctStores === 0) { return { status: 'ready', storeCount: 0 }; }

    const group = { rows: rows };
    const extremes = HP.computeExtremes(group);
    if (extremes.comparableCount < 2) {
      // Not a range — find the single best row to cite as plain text: prefer
      // one with a resolvable pre-tax figure, otherwise just the first
      // distinct store found (still honestly labeled with its own tax note).
      const bySource = new Map();
      rows.forEach(function (r) { const k = HP.competitorKey(r); if (!bySource.has(k)) { bySource.set(k, r); } });
      const candidates = [...bySource.values()];
      const solo = candidates.filter(function (r) { return HP.effectivePreTax(r) != null; })[0] || candidates[0];
      return { status: 'ready', storeCount: distinctStores, solo: solo };
    }
    return { status: 'ready', storeCount: distinctStores, rows: rows, extremes: extremes, avg: HP.computeAvgFull(group) };
  }, [http, shell.id, shell.brand, shell.weight, shell.variations]);
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
function MarketSoloLine({ row }) {
  const P = useP();
  const HP = window.HW_PRICING;
  const preTax = HP.effectivePreTax(row);
  const value = preTax != null ? preTax : row.price;
  return (
    <div style={{ fontSize: 13, color: P.ink }}>
      <span style={{ fontFamily: P.fontMono, fontWeight: 800 }}>{HP.money(value)}</span>
      <MarketTaxNote row={row} />
      {' at '}
      <strong>{marketSourceLabel(row)}</strong>
      {row.store_city ? ', ' + row.store_city : ''}
      {' — nearest listing found.'}
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

// One honest sentence, computed by inserting Hyperwolf's own value into the
// exact same comparable set computeExtremes() already built (one resolvable
// pre-tax figure per distinct store) — never a second, looser ranking.
function marketCaption(rows, ownPreTax) {
  const HP = window.HW_PRICING;
  const bySource = new Map();
  rows.forEach(function (r) { const k = HP.competitorKey(r); if (!bySource.has(k)) { bySource.set(k, r); } });
  const values = [...bySource.values()].map(HP.effectivePreTax).filter(function (v) { return v != null; });
  const M = values.length;
  const cheaperThanOwn = values.filter(function (v) { return v > ownPreTax; }).length; // stores we're below
  const pricierThanOwn = values.filter(function (v) { return v < ownPreTax; }).length; // stores we're above
  const tied = M - cheaperThanOwn - pricierThanOwn;
  if (cheaperThanOwn === M) { return `The lowest of ${M} nearby stores.`; }
  if (tied === M) { return `Tied with ${M} of ${M} nearby stores.`; }
  if (cheaperThanOwn >= pricierThanOwn) { return `Priced below ${cheaperThanOwn} of ${M} nearby stores.`; }
  return `Priced above ${pricierThanOwn} of ${M} nearby stores.`;
}

// The detail list under the ladder — the owner didn't ask to drop this, only
// to replace the stat-strip with a meter, so every real competitor stays
// visible (the "less clicks" point: nothing hidden behind another click).
// Collapses past 8 distinct stores (same threshold screen-pricing.jsx uses
// for its own overflow case) so a 44-store match doesn't turn the modal into
// a wall of rows.
function MarketStoreList({ rows }) {
  const P = useP();
  const HP = window.HW_PRICING;
  const [expanded, setExpanded] = React.useState(false);
  const bySource = new Map();
  rows.forEach(function (r) { const k = HP.competitorKey(r); if (!bySource.has(k)) { bySource.set(k, r); } });
  const sorted = [...bySource.values()].sort(function (a, b) {
    const va = HP.effectivePreTax(a), vb = HP.effectivePreTax(b);
    if ((va != null) !== (vb != null)) { return va != null ? -1 : 1; }
    if (va != null && vb != null) { return va - vb; }
    return 0;
  });
  const THRESHOLD = 8;
  const visible = expanded ? sorted : sorted.slice(0, THRESHOLD);
  return (
    <div style={{ borderTop: `1px solid ${P.hairline}`, marginTop: 2 }}>
      {visible.map(function (row, i) {
        const preTax = HP.effectivePreTax(row);
        const value = preTax != null ? preTax : row.price;
        return (
          <div key={HP.competitorKey(row) + ':' + i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 2px', borderTop: i === 0 ? 'none' : `1px solid ${P.hairline}` }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink }}>{marketSourceLabel(row)}</span>
              {row.store_city && <span style={{ fontSize: 10, color: P.inkMute }}> · {row.store_city}</span>}
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 800, fontFamily: P.fontMono, color: P.ink, flex: '0 0 auto' }}>
              {HP.money(value)}<MarketTaxNote row={row} />
            </div>
          </div>
        );
      })}
      {!expanded && sorted.length > THRESHOLD &&
        <button onClick={function (e) { e.stopPropagation(); setExpanded(true); }}
          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 2px', background: 'none', border: 'none', borderTop: `1px solid ${P.hairline}`, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: P.info }}>
          Show all {sorted.length} stores
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
        {state.status === 'ready' && state.storeCount > 0 &&
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: P.inkMute, fontFamily: P.fontMono }}>
            {state.storeCount} store{state.storeCount === 1 ? '' : 's'} tracked
          </span>}
      </div>
      <div style={{ padding: '12px 14px' }}>
        {state.status === 'loading' &&
          <div style={{ fontSize: 12.5, color: P.inkMute }}>Checking live competitor pricing…</div>}
        {state.status === 'error' &&
          <div style={{ fontSize: 12.5, color: P.inkMute }}>Competitor pricing unavailable right now{state.http && state.http.netError ? ' — ' + state.http.netError : ''}.</div>}
        {state.status === 'ready' && state.storeCount === 0 &&
          <div style={{ fontSize: 12.5, color: P.inkMute }}>No competitor listings matched for this shell yet.</div>}
        {state.status === 'ready' && state.storeCount > 0 && state.solo &&
          <MarketSoloLine row={state.solo} />}
        {state.status === 'ready' && state.rows &&
          <React.Fragment>
            <MarketLadder extremes={state.extremes} ownPreTax={ownPreTax} />
            <div style={{ fontSize: 12, fontWeight: 600, color: P.inkDim, marginBottom: 8 }}>{marketCaption(state.rows, ownPreTax)}</div>
            <MarketStoreList rows={state.rows} />
          </React.Fragment>}
      </div>
    </div>
  );
}

// ── Edit a shell — the same form the Shells module uses, in a modal ────────
window.ShellEditModal = function ShellEditModal({ p, shellId, onClose, onSave }) {
  const P = useP();
  const id = shellId || (p ? SH.shellOf(p).id : null);
  const shell = SH.shellById(id);
  if (!shell) return null;
  return <div onClick={onClose} style={window.overlayScrim(P, { z: 220, padding: '32px 20px' })}>
    <div onClick={(e) => e.stopPropagation()} style={{ ...window.overlayCard, width: 'min(900px,96vw)', background: P.bg, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '15px 20px', borderBottom: `1px solid ${P.hairline}`, background: P.surface }}>
        <Thumb item={shell.variations[0] ? shell.variations[0].thumb : { hue: shell.hue }} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkMute }}>Product shell</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: P.ink, letterSpacing: '-.01em' }}>{shell.name}</div>
          <div style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono, marginTop: 1 }}>{shell.id} · {shell.variations.length} variation{shell.variations.length === 1 ? '' : 's'} · {shell.stores == null ? 'stores not tracked' : shell.stores + ' store' + (shell.stores > 1 ? 's' : '')}</div>
        </div>
        <IconBtn icon="x" size={16} onClick={onClose} />
      </div>
      <div style={{ padding: 20, maxHeight: '72vh', overflowY: 'auto' }}>
        <MarketPricingSection shell={shell} />
        <window.ShellForm editingId={shell.id} compact onCancel={onClose} onSaved={() => {onSave && onSave();onClose();}} />
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

window.AddProductFlow = function AddProductFlow({ entry = 'catalog', lockShell, onClose, onDone }) {
  const P = useP();
  const money = window.HW.fmt.money0;
  const shells = SH.useShells();
  const [step, setStep] = React.useState(lockShell ? 1 : 0);
  const [q, setQ] = React.useState('');
  const [shellId, setShellId] = React.useState(lockShell || null);
  const [newShell, setNewShell] = React.useState(false); // inline "create shell first"
  const shell = shellId ? SH.shellById(shellId) : null;
  const [v, setV] = React.useState({ name: '', strain: 'Hybrid', sku: '', skuManual: false, override: false, price: '', desc: '', photo: '', sample: false, metaTitle: '', metaDesc: '', slug: '', keywords: '' });
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

  // Storefront meta belongs to the PRODUCT, not the family — every variation
  // gets its own search listing. Drafted from the name, editable per field.
  const meta = React.useMemo(() => {
    const nm = v.name.trim() || 'New product';
    const br = shell ? shell.brand : '';
    return {
      title: v.metaTitle || `${nm} — ${br} | Hyperwolf`,
      desc: v.metaDesc || `Buy ${nm} by ${br} — ${shell ? shell.weight + ' ' + shell.cat.toLowerCase() : ''}, lab-tested with same-day delivery across Riverside and San Bernardino.`,
      slug: v.slug || SH.slugify(br + '-' + nm),
      keywords: v.keywords || [br.toLowerCase(), nm.toLowerCase(), shell ? shell.cat.toLowerCase() : '', String(v.strain).toLowerCase(), 'cannabis delivery'].filter(Boolean).join(', ') };
  }, [v.name, v.strain, v.metaTitle, v.metaDesc, v.slug, v.keywords, shell && shell.id]);

  // Seed the description from the AI drafter the moment a shell is chosen.
  React.useEffect(() => {
    if (shell && !v.desc) setV((o) => ({ ...o, desc: SH.aiDesc(shell, { name: o.name, strain: o.strain }), price: String(SH.effectivePrice(shell)) }));
  }, [shell && shell.id]);

  const canNext = cur.k === 'shell' ? !!shell :
  cur.k === 'variation' ? !!v.name.trim() && !!sku.trim() && (!v.override || v.price !== '') :
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
      !v.name.trim() ? 'Name the flavour to continue — e.g. “Fruit Punch”.' :
      !sku.trim() ? 'This variation needs a SKU.' :
      v.override && v.price === '' ? 'You overrode the price — enter one, or switch the override off.' : null) :
    cur.k === 'batch' ? (
      !b.skip && b.qty === '' ? 'Enter a quantity, or tick “create without stock”.' :
      !b.skip && b.cost === '' ? 'Enter a unit cost, or tick “create without stock”.' : null) :
    null;
  const effPrice = v.override && v.price !== '' ? parseFloat(v.price) || 0 : shell ? SH.effectivePrice(shell) : 0;
  const margin = effPrice && b.cost ? Math.round((1 - (parseFloat(b.cost) || 0) / (effPrice || 1)) * 100) : null;

  // WAS: SH.addVariation(...) — a synchronous write to the client-side mock
  // only, called from the button's onClick with the very next line advancing
  // to the "done" step unconditionally. Nothing here ever reached
  // POST /api/product, so nothing ever reached Weedmaps, and the operator was
  // told "added" regardless. NOW: commit() is the one place this flow talks
  // to the server, it is awaited, and the "done" step is only reached when
  // SH.createVariation's own read-back confirms the write. See saveErr /
  // saveWm below and their one call site, the "Create variation" button.
  const [saving, setSaving] = React.useState(false);
  const [saveErr, setSaveErr] = React.useState(null);
  const [saveWm, setSaveWm] = React.useState(null);
  const [saveCollided, setSaveCollided] = React.useState(false);
  const commit = () => {
    if (!shell) return Promise.resolve(false);
    setSaving(true);setSaveErr(null);
    return SH.createVariation(shell.id, { sku, name: v.name.trim() || 'New Variation', price: effPrice, override: v.override,
      strain: v.strain === 'N/A' ? null : v.strain, active: !v.sample && !b.skip, qty: b.skip ? 0 : parseInt(b.qty || '0', 10) || 0,
      sample: v.sample, desc: v.desc, photo: v.photo, thumb: { hue: shell.hue },
      metaTitle: meta.title, metaDesc: meta.desc, slug: meta.slug, keywords: meta.keywords }, b).then((r) => {
      setSaving(false);
      if (!r.ok) {setSaveErr(wmCreateErrorText(r));return false;}
      setSaveWm(r.wm);
      setSaveCollided(!!r.collided);
      return true;
    });
  };

  // ── pre-submit collision warning ──
  // There is no sku-uniqueness check anywhere in this build, so a typo'd or
  // reused sku silently turns "add a product" into "edit an existing one".
  // SH.createVariation now merges that case safely (wm_manual_unpublish,
  // wm_product_id and sample all survive — see its own comment), but the
  // operator should find out BEFORE clicking Create, not just after. Debounced
  // off `sku` (which changes on every keystroke of the name while
  // auto-assigned) and only checked on the variation step, where the field is
  // visible. Purely advisory: createVariation does its own GET regardless of
  // whether this resolves in time, so a slow or failed check here cannot
  // cause data loss, only a missed warning.
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
    <Thumb item={{ hue: shell.hue }} size={34} radius={8} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: P.good }}>Adding to shell</div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shell.name}</div>
      <div style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{shell.id} · {SH.familyPath(shell)} · {shell.variations.length} existing variation{shell.variations.length === 1 ? '' : 's'}</div>
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
              <Thumb item={{ hue: s.hue }} size={34} radius={8} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{s.id} · {SH.familyPath(s)} · {s.variations.length} variation{s.variations.length === 1 ? '' : 's'}</div>
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
              {(() => {const inh = SH.sharedRows(shell).length + (shell.traits || []).length;const tot = inh + 5;
                return <>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{inh} of {tot} details pre-filled</div>
                  <div style={{ fontSize: 11.5, color: P.good, marginTop: 2 }}>Inherited from the shell — you only set what makes this product unique.</div>
                </>;})()}
            </div>
            <div style={{ width: 110, height: 8, borderRadius: 99, background: P.good + '33', overflow: 'hidden', flex: '0 0 auto' }}>
              {(() => {const inh = SH.sharedRows(shell).length + (shell.traits || []).length;
                return <div style={{ width: Math.round(inh / (inh + 5) * 100) + '%', height: '100%', background: P.good, borderRadius: 99 }} />;})()}
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
              {(shell.traits || []).length > 0 && <div style={{ marginTop: 12, paddingTop: 13, borderTop: `1px solid ${P.hairline}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkMute }}>Product traits · carry across the line</span>
                  <span title="Pack count, servings, infusion — set on the shell, inherited by the whole line. Edit them on the shell, not per product." style={{ display: 'inline-flex', cursor: 'help', color: P.inkFaint }}><Icon name="info" size={12} /></span>
                </div>
                {shell.traits.map((t, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 11px', marginBottom: 7, background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: 9 }}>
                  <span style={{ fontSize: 12.5, color: P.inkDim }}>{t.label}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink2, fontFamily: P.fontMono }}>{t.value}</span>
                </div>)}
              </div>}
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

              <div style={{ marginBottom: 13 }}><Lb hint="The flavour or strain — this is what makes it a distinct product.">Product name *</Lb>
                <Field placeholder="e.g. Fruit Punch" value={v.name} onChange={(e) => s1('name', e.target.value)} /></div>

              <div style={{ marginBottom: 13 }}><Lb>Type</Lb>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[['Indica', P.indica], ['Sativa', P.sativa], ['Hybrid', P.hybrid]].map(([t, c]) => {const on = v.strain === t;
                    return <button key={t} onClick={() => setV((o) => ({ ...o, strain: t, desc: SH.aiDesc(shell, { name: o.name, strain: t }) }))} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 10px', borderRadius: P.r999, border: `1px solid ${on ? P.ink : P.hairline2}`, background: on ? P.ink : P.surface, color: on ? P.surface : P.ink2, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}>
                      <span style={{ width: 6, height: 6, borderRadius: 99, background: c }} />{t}</button>;})}
                  <Sel2 value={['Indica', 'Sativa', 'Hybrid'].includes(v.strain) ? 'More' : v.strain} onChange={(x) => x !== 'More' && s1('strain', x)} options={['More', 'CBD', 'N/A']} />
                </div>
              </div>

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
                <Lb right={<span onClick={() => s1('override', !v.override)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: v.override ? P.warn : P.inkMute }}>Override shell price</span>
                  <MiniSwitch on={v.override} onChange={(x) => s1('override', x)} color={P.warn} /></span>}>Price</Lb>
                {v.override ?
                <Field mono icon="dollar" placeholder="0.00" value={v.price} onChange={(e) => s1('price', e.target.value.replace(/[^0-9.]/g, ''))} /> :
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10, minHeight: 38 }}>
                  <span style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: 7 }}>
                    {shell.sale ? <span style={{ fontSize: 11.5, color: P.inkFaint, textDecoration: 'line-through', fontFamily: P.fontMono }}>{money(shell.price)}</span> : null}
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: shell.sale ? P.bad : P.ink, fontFamily: P.fontMono }}>{money(SH.effectivePrice(shell))}</span>
                    {shell.sale ? <Tag kind="warn">On sale</Tag> : null}
                  </span>
                  <Icon name="lock" size={12} stroke={1.9} color={P.inkFaint} />
                </div>}
                <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 5 }}>{v.override ? 'Custom price for this variation only — the rest of the family is unaffected.' : `Inherits the shell price of ${money(SH.effectivePrice(shell))}${shell.sale ? ' (promo, retail ' + money(shell.price) + ')' : ''}. Rare to override.`}</div>
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
          <div style={{ fontSize: 16.5, fontWeight: 800, color: P.ink, marginTop: 11 }}>{v.name || 'Variation'} {saveCollided ? 'updated' : 'added'}</div>
          <div style={{ fontSize: 12.5, color: P.inkDim, fontFamily: P.fontMono, marginTop: 3 }}>{sku || '—'} · {shell ? shell.name : ''}{effPrice ? ' · ' + money(effPrice) + (v.override ? ' (override)' : '') : ''}</div>
          <div style={{ marginTop: 16, textAlign: 'left', border: `1px solid ${P.hairline}`, borderRadius: P.r10, overflow: 'hidden' }}>
            {[saveCollided ?
              ['Existing product updated, not created', 'warn', 'SKU ' + sku + ' already had a product on it — this edited that record in place rather than adding a new one. Its Weedmaps mapping, publish status and sample flag were left exactly as they were.'] :
              ['Variation created on ' + (shell ? shell.id : 'the shell'), 'good', v.override ? 'Brand, format, size and traits inherited. Retail price overridden for this variation only.' : 'Brand, format, size, price and traits all inherited — nothing re-entered.'],
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
            ['Inherits the shell’s Weedmaps node', 'good', shell ? shell.wmNode + ' — already mapped, so it can sync without joining the review queue.' : 'Already mapped.'],
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
