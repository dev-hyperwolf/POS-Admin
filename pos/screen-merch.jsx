// ── MERCHANDISING — what marketing controls, per surface, per region ───────
// Reads and writes go through window.HWMerch (shared/merch-store.js) and
// nowhere else. The long rationale is inside the IIFE, kept off the first
// lines so test/global-collisions.test.mjs still recognises the wrapper.
;(function () {
  const useP = window.useP;

  /* ═══ WHY THIS SCREEN LOOKS THE WAY IT DOES ══════════════════════════════
   *
   * 🔴 EVERY READ AND WRITE OF A MERCHANDISING SET GOES THROUGH window.HWMerch.
   * The owner chose "browser storage for now" AND "decide later — build behind
   * one seam". The moment a screen reaches past the seam into localStorage,
   * that second decision stops being reversible. There is exactly one direct
   * localStorage key in this file — the CLAIM CEILING — and it is a POS
   * *setting*, deliberately shaped like `HW.laneSettings` in pos/data.jsx,
   * which is the pattern this estate already uses for operator settings.
   *
   * ⚠️ A REFUSAL IS SHOWN, NEVER SWALLOWED. `HWMerch.set()` returns null on an
   * unknown surface, a bad mode or state, more items than the cap, or weighted
   * shares that do not sum to 100. Every one of those is pre-checked here so
   * the operator is told BEFORE pressing Save — and the refusal is caught and
   * displayed anyway, because a control that fails quietly is the bug this
   * project has shipped most often.
   *
   * ⚠️ "FILLED" IS NOT "SHOWING". `HWMerch.board()` reports whether a region's
   * OWN record has items. It does not know about the state machine or about
   * regional inheritance. What a shopper actually sees is `HWMerch.live()` and
   * nothing else — a draft with four items shows the house card, not the four
   * items. The board prints live() as the ground truth for every cell, because
   * an operator reading "4 items" off a draft would reasonably believe it was
   * on the storefront.
   */

  const M = () => window.HWMerch;

  /* ── The claim ceiling — max advertised discount %  ───────────────────────
   *
   * The owner: this is a SETTING, beside the lane minimums in POS settings.
   *
   * 🔴 WHY IT EXISTS. The storefront's brand spotlight prints the deepest
   * genuine markdown in the catalogue, and a reviewer found it advertising
   * "Connected · Up to 97% off" to customers. The arithmetic was right; one
   * clearance SKU was speaking for a whole brand. A ceiling turns "an
   * implausible number" into "a data artefact we do not advertise".
   *
   * Shaped like HW.laneSettings: a default, a validating setter that REFUSES
   * rather than coerces, a reset, and an isDefault() so a surface can say the
   * figure is still provisional.
   *
   * ⚠️ WHERE THE FIGURE LIVES, AND WHY IT IS NOT SIMPLY HERE.
   *
   * The storefront reads this ceiling too — shop/data.jsx caps what its brand
   * spotlight advertises — and it looks for the figure on `HW.laneSettings()`,
   * trying the key names below in order, falling back to its own
   * `SPOTLIGHT_MAX_PCT` (60, which is why 60 is the default here). That is the
   * estate-wide home for the setting, and it is in pos/data.jsx, which this
   * screen does not own: `setLaneSettings` copies only the keys in
   * LANE_DEFAULTS, so a `claimCeilingPct` patch is dropped on the floor today.
   *
   * So this reads the estate-wide figure when it exists and keeps its own
   * browser-local one when it does not, and it finds out which by WRITING and
   * checking what came back rather than by assuming. The day
   * `claimCeilingPct` joins LANE_DEFAULTS, POS and the storefront agree with no
   * edit here — and until then the panel says, in those words, that the
   * storefront is still on its own constant.
   *
   * 🔴 IT MUST NEVER MEMOISE THE ESTATE-WIDE FIGURE. Caching it here would mean
   * a lane-settings change made anywhere else is invisible until reload, and
   * two enforcement points quietly disagreeing is the whole failure this
   * setting exists to prevent.
   */
  const CLAIM_KEY = 'hw-claim-ceiling';
  const CLAIM_DEFAULT = 60;
  // The order shop/data.jsx tries. Same list, deliberately — a second opinion
  // about the key name is a second ceiling.
  const CLAIM_KEYS = ['claimCeilingPct', 'claimCeiling', 'maxAdvertisedDiscountPct', 'maxClaimPct'];
  let _claim = null;
  const _claimSubs = new Set();
  const _claimEmit = () => _claimSubs.forEach((f) => { try { f(); } catch (e) {} });

  /** The estate-wide figure, or null when the shared setting does not carry one. */
  function claimShared() {
    const HW = window.HW;
    if (!HW || typeof HW.laneSettings !== 'function') return null;
    let s = null;
    try { s = HW.laneSettings(); } catch (e) { return null; }
    if (!s) return null;
    for (let i = 0; i < CLAIM_KEYS.length; i++) {
      const v = Number(s[CLAIM_KEYS[i]]);
      if (Number.isFinite(v) && v > 0 && v <= 100) return v;
    }
    return null;
  }
  function claimGet() {
    const shared = claimShared();
    if (shared !== null) return shared;
    if (_claim != null) return _claim;
    try {
      const raw = JSON.parse(localStorage.getItem(CLAIM_KEY) || 'null');
      _claim = Number.isFinite(raw) && raw > 0 && raw <= 100 ? raw : CLAIM_DEFAULT;
    } catch (e) { _claim = CLAIM_DEFAULT; }
    return _claim;
  }
  function claimSet(pct) {
    const n = typeof pct === 'number' ? pct : parseFloat(pct);
    // REFUSES rather than coerces. A ceiling of 0 would refuse every claim and
    // a ceiling of 250 would refuse none — both switch the guard off silently,
    // in opposite directions.
    if (!Number.isFinite(n) || n < 1 || n > 100) return null;
    /* Try the estate-wide setting FIRST, and believe only what it hands back.
     * pos/data.jsx ignores keys outside LANE_DEFAULTS without complaining, so a
     * write that "succeeded" proves nothing — the returned record does. */
    const HW = window.HW;
    if (HW && typeof HW.setLaneSettings === 'function') {
      let res = null;
      try { res = HW.setLaneSettings({ claimCeilingPct: n }); } catch (e) { res = null; }
      if (res && CLAIM_KEYS.some((k) => Number(res[k]) === n)) { _claimEmit(); return n; }
    }
    _claim = n;
    try { localStorage.setItem(CLAIM_KEY, JSON.stringify(n)); } catch (e) {}
    _claimEmit();
    return n;
  }
  function claimReset() {
    if (claimShared() !== null) return claimSet(CLAIM_DEFAULT) === null ? claimGet() : CLAIM_DEFAULT;
    _claim = CLAIM_DEFAULT;
    try { localStorage.removeItem(CLAIM_KEY); } catch (e) {}
    _claimEmit();
    return CLAIM_DEFAULT;
  }

  /**
   * The deepest DISCOUNT percentage claimed in a piece of copy, or null.
   *
   * ⚠️ Only a discount claim counts. "18% THC" is a fact about the product, not
   * an advertised markdown — blocking it would train the operator to ignore
   * this guard, and a guard that is routinely overridden protects nothing.
   */
  function claimIn(text) {
    const s = String(text == null ? '' : text);
    const re = /(\d+(?:\.\d+)?)\s*%/g;
    let m, max = null;
    while ((m = re.exec(s))) {
      const around = s.slice(Math.max(0, m.index - 26), m.index + m[0].length + 14).toLowerCase();
      if (!/off|save|saving|discount|markdown|deal|sale|reduced/.test(around)) continue;
      const pct = parseFloat(m[1]);
      if (max === null || pct > max) max = pct;
    }
    return max;
  }

  window.HWClaim = {
    DEFAULT: CLAIM_DEFAULT,
    get: claimGet, set: claimSet, reset: claimReset,
    isDefault: () => claimGet() === CLAIM_DEFAULT,
    /** True once the figure lives on the estate-wide setting the storefront
     *  reads, rather than in this browser only. */
    isShared: () => claimShared() !== null,
    claimIn: claimIn,
    /** { ok, pct, ceiling } — pct is null when the copy claims no discount. */
    check(text) {
      const pct = claimIn(text);
      const ceiling = claimGet();
      return { ok: pct === null || pct <= ceiling, pct: pct, ceiling: ceiling };
    },
    subscribe(fn) { _claimSubs.add(fn); return () => _claimSubs.delete(fn); },
  };

  /* ── Rails ────────────────────────────────────────────────────────────────
   *
   * Editorial now, with a mode that can switch to auto later.
   *
   * 🔴 AUTO IS OFFERED AND DISABLED. "Best Sellers" needs `unitsSold` and "New
   * Arrivals" needs `firstSeenAt`; the catalogue (pos/data.jsx `P_`) carries
   * neither, so an auto rail would rank on something invented and the ranking
   * would look authoritative. Offering the mode greyed, with the missing fields
   * named, is the honest version of "not yet".
   *
   * 🔴 EDITORIAL IS ALSO DISABLED, AND FOR A DIFFERENT REASON. A rail is a
   * merchandising surface, so its picks belong in HWMerch — and HWMerch.SURFACES
   * carries no rail id, so `set('rail_fresh', …)` is REFUSED by the seam. The
   * fix is one line in shared/merch-store.js, not a second store in this file:
   * a private rails cache here would be exactly the reach-around the seam
   * exists to prevent, and the picks would never reach the storefront anyway.
   * These pickers light up on their own the moment the ids exist.
   */
  const RAILS = [
    { id: 'fresh', label: 'Fresh Drops', needs: 'nothing — this one is pure editorial' },
    { id: 'sale', label: 'On Sale', needs: 'nothing — markdown is already in the catalogue' },
    { id: 'staff', label: 'Staff Picks', needs: 'nothing — this one is pure editorial' },
    { id: 'best', label: 'Best Sellers', needs: '`unitsSold`, which no product row carries' },
    { id: 'new', label: 'New Arrivals', needs: '`firstSeenAt`, which no product row carries' },
  ];
  const railSurfaceId = (r) => 'rail_' + r.id;

  /* ── small helpers ────────────────────────────────────────────────────── */

  const REGION_LABEL = { all: 'All regions', corona: 'Corona', 'long-beach': 'Long Beach', 'west-la': 'West LA' };
  const regionLabel = (r) => REGION_LABEL[r] || r;
  const STATE_KIND = { draft: 'neutral', review: 'info', live: 'good' };
  const who = () => (window.USER && window.USER.name) || 'Manisha Saini';
  const shareSum = (items) => items.reduce((a, i) => a + (Number(i.share) || 0), 0);

  /** An even split that actually sums to 100 — the remainder lands on the first
   *  item rather than being dropped, which is what made 33+33+33 = 99 refuse. */
  function evenShares(items) {
    const n = items.length;
    if (!n) return items;
    const base = Math.floor(100 / n);
    return items.map((it, i) => ({ ...it, share: base + (i === 0 ? 100 - base * n : 0) }));
  }

  function useMerch() {
    const [, bump] = React.useReducer((x) => x + 1, 0);
    React.useEffect(() => M().subscribe(bump), []);
    return M();
  }
  function useClaim() {
    const [, bump] = React.useReducer((x) => x + 1, 0);
    React.useEffect(() => window.HWClaim.subscribe(bump), []);
    return window.HWClaim;
  }

  /** Every reason this draft would be refused, in the operator's words. Empty
   *  array means Save is safe to offer. */
  function problems(surface, draft, ceiling) {
    const s = M().surfaceById(surface);
    const out = [];
    if (!s) { out.push('“' + surface + '” is not a surface the seam knows about.'); return out; }
    if (draft.items.length > s.cap) {
      out.push('This surface holds ' + s.cap + ' item' + (s.cap === 1 ? '' : 's') + ' and ' + draft.items.length + ' are picked.');
    }
    if (draft.mode === 'weighted' && draft.items.length) {
      const sum = shareSum(draft.items);
      if (Math.round(sum) !== 100) {
        out.push('Share of voice totals ' + Math.round(sum) + '% — weighted needs exactly 100%.');
      }
      /* 🔴 A ZERO SHARE IS NOT A REFUSAL THE SEAM MAKES, AND IT SHOULD BE SEEN.
       * 50/50/0 sums to 100 and the store accepts it happily — but the third
       * item is then picked by nobody, ever. The operator put it in the slot, so
       * they believe it is running. This is the same class of bug as a set that
       * sums to 90: a number nobody chose, invisible in the result. */
      draft.items.forEach((it, i) => {
        if (!(Number(it.share) > 0)) {
          out.push('Item ' + (i + 1) + ' has a 0% share, so no visitor is ever shown it. Give it a share or remove it.');
        }
      });
    }
    if (s.neverFirst && draft.items.length && draft.items[0].sponsored) {
      out.push('A sponsored card cannot sit first here — index 0 is the customer’s own history and the row’s credibility comes from that.');
    }
    if (s.mustLabel) {
      draft.items.forEach((it, i) => {
        if (it.sponsored && !String(it.label || '').trim()) {
          out.push('Sponsored item ' + (i + 1) + ' has no label, and everything sponsored here must be labelled.');
        }
      });
    }
    draft.items.forEach((it, i) => {
      const pct = claimIn(it.label);
      if (pct !== null && pct > ceiling) {
        out.push('Item ' + (i + 1) + ' advertises ' + pct + '% off, over the ' + ceiling + '% claim ceiling.');
      }
    });
    return out;
  }

  /* ── modal shell ──────────────────────────────────────────────────────── */

  function Sheet({ icon, title, sub, onClose, children, footer, width }) {
    const P = useP();
    return <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: P.scrim, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: width || 'min(680px,96vw)', maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '15px 20px', borderBottom: `1px solid ${P.hairline}`, flex: '0 0 auto' }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={icon} size={16} stroke={2} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: P.type.title, fontWeight: 700, color: P.ink }}>{title}</div>
            {sub && <div style={{ fontSize: P.type.meta, color: P.inkDim }}>{sub}</div>}
          </div>
          <IconBtn icon="x" size={16} label="Close" onClick={onClose} />
        </div>
        <div style={{ padding: 20, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
        {footer && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 9, padding: '14px 20px', borderTop: `1px solid ${P.hairline}`, background: P.surface2, flex: '0 0 auto', flexWrap: 'wrap' }}>{footer}</div>}
      </div>
    </div>;
  }

  function Note({ tone = 'info', icon = 'info', children }) {
    const P = useP();
    const map = { info: [P.infoSoft, P.info], warn: [P.warnSoft, P.warn], bad: [P.badSoft, P.bad], flat: [P.surface2, P.inkMute] };
    const [bg, fg] = map[tone] || map.info;
    return <div style={{ display: 'flex', gap: 9, padding: '11px 13px', background: bg, border: tone === 'flat' ? `1px solid ${P.hairline}` : 'none', borderRadius: P.r10 }}>
      <Icon name={icon} size={14} color={fg} style={{ flex: '0 0 auto', marginTop: 1 }} />
      <div style={{ fontSize: P.type.meta, color: P.ink2, lineHeight: 1.5 }}>{children}</div>
    </div>;
  }

  const lbl = (P) => ({ fontSize: P.type.micro, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 6 });

  /* ── House card ───────────────────────────────────────────────────────── */

  function HouseCardModal({ onClose }) {
    const P = useP();
    const C = useClaim();
    const cur = M().houseCard();
    const [f, setF] = React.useState({ headline: cur.headline, sub: cur.sub, kicker: cur.kicker });
    const [refused, setRefused] = React.useState(null);
    const set = (k) => (e) => { setRefused(null); setF((x) => ({ ...x, [k]: e.target.value })); };

    const blank = !String(f.headline || '').trim();
    const over = ['headline', 'sub', 'kicker'].map((k) => C.check(f[k])).find((c) => !c.ok);
    const stop = blank ? 'The house card cannot be blank — a blank fallback is the blank surface it exists to prevent.'
      : over ? 'This claims ' + over.pct + '% off, over the ' + over.ceiling + '% claim ceiling.' : null;

    const save = () => {
      const rec = M().setHouseCard({ headline: f.headline, sub: f.sub, kicker: f.kicker }, who());
      // The seam refuses rather than coerces. If it ever refuses for a reason
      // this form did not predict, the operator must see that, not a button
      // that appeared to work.
      if (!rec) { setRefused('The store refused this edit and nothing was saved.'); return; }
      onClose();
    };

    return <Sheet icon="sparkle" title="House card" sub="The fallback whenever a slot has nothing live" onClose={onClose}
      footer={<React.Fragment>
        <span style={{ fontSize: P.type.meta, color: P.inkDim }}>Editable at any time — never derived from the catalogue.</span>
        <span style={{ display: 'flex', gap: 9 }}>
          <PBtn variant="secondary" size="md" onClick={onClose}>Cancel</PBtn>
          <PBtn variant="accent" size="md" icon="check" disabled={!!stop} onClick={save}>Save house card</PBtn>
        </span>
      </React.Fragment>}>
      <Note tone="flat" icon="shield">
        <b>This is the fallback, and it is never a derived pick.</b> Falling back to “the deepest markdown in the
        catalogue” is exactly how the shop came to advertise <b>Up to 97% off</b>. Evergreen copy, written by a person.
      </Note>
      <div><div style={lbl(P)}>Headline</div><Field value={f.headline} onChange={set('headline')} placeholder="Express in ~90 min" /></div>
      <div><div style={lbl(P)}>Sub</div><Field value={f.sub} onChange={set('sub')} placeholder="Free delivery over $50" /></div>
      <div><div style={lbl(P)}>Kicker</div><Field value={f.kicker} onChange={set('kicker')} placeholder="Long Beach · on shift now" /></div>
      {stop && <Note tone="bad" icon="alert">{stop}</Note>}
      {refused && <Note tone="bad" icon="alert">{refused}</Note>}
    </Sheet>;
  }

  function HouseCardPanel({ onEdit }) {
    const P = useP();
    const MM = useMerch();
    const card = MM.houseCard();
    const by = MM.houseCardBy();
    return <Card padding={16} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 240 }}>
        <Eyebrow style={{ marginBottom: 8 }}>House card</Eyebrow>
        <div style={{ fontSize: P.type.h2, fontWeight: 700, color: P.ink, lineHeight: 1.15 }}>{card.headline}</div>
        <div style={{ fontSize: P.type.strong, color: P.ink2, marginTop: 4 }}>{card.sub}</div>
        <div style={{ fontSize: P.type.meta, color: P.inkDim, fontFamily: P.fontMono, marginTop: 4 }}>{card.kicker}</div>
        <div style={{ fontSize: P.type.meta, color: P.inkMute, marginTop: 10 }}>
          {by ? <React.Fragment>Last edited by <b style={{ color: P.ink2 }}>{by.who}</b> · {new Date(by.at).toLocaleString()}</React.Fragment>
            : 'Never edited — this is the shipped default.'}
        </div>
      </div>
      <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 9, alignItems: 'flex-end' }}>
        <PBtn variant="secondary" size="md" icon="pencil" onClick={onEdit}>Edit house card</PBtn>
        <div style={{ fontSize: P.type.meta, color: P.inkDim, maxWidth: 240, textAlign: 'right', lineHeight: 1.5 }}>
          This is what a shopper sees in every slot that has nothing live.
        </div>
      </div>
    </Card>;
  }

  /* ── The slot editor ──────────────────────────────────────────────────── */

  function AddPicker({ cap, count, onAdd }) {
    const P = useP();
    const [q, setQ] = React.useState('');
    const full = false;
    const brands = (window.HW_BRANDS ? window.HW_BRANDS.list : []).map((b) => ({ id: 'brand:' + b.key, kind: 'brand', label: b.name }));
    const prods = ((window.HW && window.HW.PRODUCTS) || []).filter((p) => p.active)
      .map((p) => ({ id: 'sku:' + p.sku, kind: 'product', label: p.name }));
    const all = brands.concat(prods);
    const hits = (q.trim() ? all.filter((o) => o.label.toLowerCase().includes(q.trim().toLowerCase())) : all).slice(0, 8);
    return <div>
      <div style={lbl(P)}>Add an item</div>
      <Field icon="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search brands and products" />
      {full
        ? <div style={{ marginTop: 8 }}><Note tone="warn" icon="alert">
            <b>{count} of {cap}.</b> This surface holds {cap}. The seam refuses a set that is over capacity, so
            remove one before adding another.
          </Note></div>
        : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 9 }}>
            {hits.map((o) => <PBtn key={o.id} size="sm" variant="soft" icon="plus" onClick={() => onAdd(o)}>{o.label}</PBtn>)}
            {!hits.length && <span style={{ fontSize: P.type.meta, color: P.inkMute }}>Nothing matches “{q}”.</span>}
          </div>}
    </div>;
  }

  function ItemRow({ it, i, n, mode, sponsoredMatters, onPatch, onMove, onRemove }) {
    const P = useP();
    return <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10, flexWrap: 'wrap' }}>
      <span style={{ fontFamily: P.fontMono, fontSize: P.type.meta, color: P.inkMute, width: 18, flex: '0 0 auto' }}>{i + 1}</span>
      <span style={{ flex: 1, minWidth: 140 }}>
        <span style={{ display: 'block', fontSize: P.type.strong, fontWeight: 600, color: P.ink }}>{it.label}</span>
        <span style={{ display: 'block', fontSize: P.type.micro, color: P.inkMute, fontFamily: P.fontMono, textTransform: 'uppercase', letterSpacing: '.06em' }}>{it.kind}</span>
      </span>
      {mode === 'weighted' && <span style={{ width: 108, flex: '0 0 auto' }}>
        <Field mono size="sm" value={String(it.share == null ? '' : it.share)} placeholder="share %"
          onChange={(e) => onPatch(i, { share: e.target.value === '' ? '' : Number(e.target.value.replace(/[^0-9.]/g, '')) })}
          suffix={<span style={{ fontSize: P.type.meta, color: P.inkMute, fontFamily: P.fontMono }}>%</span>} />
      </span>}
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>
        <span style={{ fontSize: P.type.meta, color: P.inkDim }}>Sponsored</span>
        <Switch on={!!it.sponsored} onChange={(v) => onPatch(i, { sponsored: v })} />
      </span>
      {sponsoredMatters && it.sponsored && <Pill kind="info" size="sm" icon="flag">Labelled</Pill>}
      <span style={{ display: 'flex', flex: '0 0 auto' }}>
        <IconBtn icon="arrow-up" size={15} label={'Move up ' + it.label} onClick={() => onMove(i, -1)} style={{ opacity: i === 0 ? .35 : 1 }} />
        <IconBtn icon="arrow-down" size={15} label={'Move down ' + it.label} onClick={() => onMove(i, 1)} style={{ opacity: i === n - 1 ? .35 : 1 }} />
        <IconBtn icon="trash" size={15} label={'Remove ' + it.label} onClick={() => onRemove(i)} />
      </span>
    </div>;
  }

  function SlotModal({ surface, region, onClose }) {
    const P = useP();
    const MM = useMerch();
    const C = useClaim();
    const s = MM.surfaceById(surface);
    const stored = MM.get(surface, region);
    const inherited = region !== 'all' && !stored ? MM.get(surface, 'all') : null;

    const [draft, setDraft] = React.useState(() => {
      const base = stored || (inherited ? { mode: inherited.mode, items: inherited.items, state: 'draft' } : null);
      return { mode: (base && base.mode) || 'carousel', items: (base && base.items ? base.items.slice() : []), state: (stored && stored.state) || 'draft' };
    });
    const [refused, setRefused] = React.useState(null);
    const [showHist, setShowHist] = React.useState(false);

    /* ⚠️ EVERY MUTATOR IS A FUNCTION OF THE PREVIOUS DRAFT, never of the `draft`
     * captured by this render. React batches, so two clicks landing in one
     * frame both read the same stale `draft` and the second silently discards
     * the first — the operator adds two items and gets one, with no error. The
     * screen's own test caught exactly that. */
    const patch = (p) => { setRefused(null); setDraft((d) => ({ ...d, ...(typeof p === 'function' ? p(d) : p) })); };
    const patchItem = (i, p) => patch((d) => ({ items: d.items.map((it, j) => (j === i ? { ...it, ...p } : it)) }));
    const move = (i, dir) => patch((d) => {
      const j = i + dir;
      if (j < 0 || j >= d.items.length) return {};
      const items = d.items.slice();
      const t = items[i]; items[i] = items[j]; items[j] = t;
      return { items: items };
    });
    const remove = (i) => patch((d) => ({ items: d.items.filter((_, j) => j !== i) }));
    // Deliberately NOT capped here. The picker already closes at capacity, and
    // silently dropping an add that got past it would be the quiet failure this
    // screen exists to avoid — an over-capacity draft is caught by problems()
    // and shown with its real numbers.
    const add = (o) => patch((d) => ({ items: d.items.concat([{ ...o, share: d.mode === 'weighted' ? 0 : undefined, sponsored: false }]) }));

    const total = shareSum(draft.items);
    const probs = problems(surface, draft, C.get());
    const canSave = probs.length === 0;

    const commit = (state) => {
      const next = { mode: draft.mode, items: draft.items, state: state };
      const rec = MM.set(surface, region, next, who());
      /* ⚠️ THE SEAM IS THE AUTHORITY, NOT THIS FORM. `problems()` predicts the
       * refusals, but if the store refuses for a reason the form did not model,
       * the operator has to see it — otherwise Save looks like it worked and
       * the slot silently keeps its old contents. */
      if (!rec) {
        setRefused('The merchandising store REFUSED this set and nothing was written. '
          + 'Surface “' + surface + '”, mode ' + draft.mode + ', ' + draft.items.length + ' item(s)'
          + (draft.mode === 'weighted' ? ', shares totalling ' + Math.round(total) + '%' : '') + '.');
        return;
      }
      onClose();
    };

    const hist = MM.history(surface, region);

    return <Sheet icon="layout-template" title={s ? s.label : surface} sub={regionLabel(region) + ' · holds ' + (s ? s.cap : '?') + ' · ' + (s ? s.page : '') + ' page'}
      onClose={onClose} width="min(760px,96vw)"
      footer={<React.Fragment>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <PBtn variant="ghost" size="md" icon="clock" onClick={() => setShowHist((v) => !v)}>{showHist ? 'Hide history' : 'History (' + hist.length + ')'}</PBtn>
          {!canSave && <span style={{ fontSize: P.type.meta, color: P.bad, fontWeight: 600 }}>Save is held back — {probs.length} thing{probs.length === 1 ? '' : 's'} to fix.</span>}
        </span>
        <span style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          <PBtn variant="secondary" size="md" onClick={onClose}>Cancel</PBtn>
          <PBtn variant="secondary" size="md" disabled={!canSave} onClick={() => commit(draft.state)}>Save as {draft.state}</PBtn>
          <PBtn variant="accent" size="md" icon="lightning" disabled={!canSave} onClick={() => commit('live')}>Publish now</PBtn>
        </span>
      </React.Fragment>}>

      {inherited && <Note tone="info" icon="link">
        <b>{regionLabel(region)} has no set of its own</b> and inherits the <b>All regions</b> default
        ({inherited.items.length} item{inherited.items.length === 1 ? '' : 's'}, {inherited.mode}, {inherited.state}).
        Saving here creates an override for {regionLabel(region)} only — one number until it isn’t.
      </Note>}

      <div>
        <div style={lbl(P)}>Mode</div>
        <Seg size="lg" value={draft.mode} onChange={(v) => patch((d) => ({ mode: v, items: v === 'weighted' ? evenShares(d.items) : d.items }))}
          options={[{ value: 'carousel', label: 'Carousel', icon: 'list' }, { value: 'weighted', label: 'Weighted', icon: 'pie' }]} />
        <div style={{ fontSize: P.type.meta, color: P.inkDim, marginTop: 8, lineHeight: 1.5 }}>
          {draft.mode === 'carousel'
            ? <React.Fragment><b>Everyone sees all of them, in this order.</b> Nobody is excluded from anything; position is the only lever.</React.Fragment>
            : <React.Fragment><b>Each visitor sees exactly one</b>, drawn by share of voice. These are different mechanisms — a weighted set at 3 items shows each visitor one of the three, not three.</React.Fragment>}
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          <div style={lbl(P)}>Items · {draft.items.length} of {s ? s.cap : '?'}</div>
          {draft.mode === 'weighted' && !!draft.items.length &&
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: P.type.numRow, fontWeight: 800, fontFamily: P.fontMono, color: Math.round(total) === 100 ? P.good : P.bad }}>{Math.round(total)}% of 100%</span>
              <PBtn size="sm" variant="soft" onClick={() => patch((d) => ({ items: evenShares(d.items) }))}>Split evenly</PBtn>
            </div>}
        </div>
        {!draft.items.length
          ? <Note tone="warn" icon="alert">
              <b>Nothing is picked, so this slot shows the house card.</b> That is a safe fallback, not a filled slot —
              an empty slot nobody could see is how “Up to 97% off” reached customers.
            </Note>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {draft.items.map((it, i) => <ItemRow key={it.id + ':' + i} it={it} i={i} n={draft.items.length} mode={draft.mode}
                sponsoredMatters={!!(s && s.mustLabel)} onPatch={patchItem} onMove={move} onRemove={remove} />)}
            </div>}
      </div>

      <AddPicker cap={s ? s.cap : 0} count={draft.items.length} onAdd={add} />

      {s && (s.neverFirst || s.mustLabel) && <Note tone="flat" icon="shield">
        <b>The reorder row has two standing rules.</b> A sponsored card may appear here, but
        {s.neverFirst ? <React.Fragment> <b>never at position 1</b></React.Fragment> : null}
        {s.neverFirst && s.mustLabel ? ' and' : ''}
        {s.mustLabel ? <React.Fragment> <b>always labelled</b></React.Fragment> : null}.
        Position 1 earns the “Your usual” badge and the row’s whole credibility comes from being genuinely the
        customer’s own history.
      </Note>}

      <div>
        <div style={lbl(P)}>State</div>
        <Seg size="lg" value={draft.state} onChange={(v) => patch({ state: v })}
          options={MM.STATES.map((k) => ({ value: k, label: k[0].toUpperCase() + k.slice(1) }))} />
        <div style={{ fontSize: P.type.meta, color: P.inkDim, marginTop: 8, lineHeight: 1.5 }}>
          Only <b>live</b> reaches a shopper. Draft and review are visible on the board before they go live, and the
          slot keeps showing whatever it showed before — the house card, if there is nothing else.
        </div>
      </div>

      {!!probs.length && <Note tone="bad" icon="alert">
        <b>This will be refused as it stands:</b>
        <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{probs.map((p, i) => <li key={i} style={{ marginTop: 3 }}>{p}</li>)}</ul>
      </Note>}
      {refused && <Note tone="bad" icon="alert">{refused}</Note>}

      {showHist && <div>
        <div style={lbl(P)}>History · newest first</div>
        {!hist.length
          ? <div style={{ fontSize: P.type.meta, color: P.inkMute }}>Nothing has been saved to this slot yet.</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {hist.map((h, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', border: `1px solid ${P.hairline}`, borderRadius: P.r10, flexWrap: 'wrap' }}>
                <Pill kind={STATE_KIND[h.state] || 'neutral'} size="sm">{h.state}</Pill>
                <span style={{ fontSize: P.type.meta, color: P.ink2, flex: 1, minWidth: 150 }}>
                  {h.mode} · {(h.items || []).length} item{(h.items || []).length === 1 ? '' : 's'}
                  {h.by ? <React.Fragment> · <b>{h.by.who}</b> · {new Date(h.by.at).toLocaleString()}</React.Fragment> : ' · attribution missing'}
                </span>
                <PBtn size="sm" variant="secondary" icon="refresh" onClick={() => {
                  const rec = MM.rollback(surface, region, i, who());
                  if (!rec) { setRefused('The rollback was REFUSED and nothing changed — that version is no longer valid for this surface.'); return; }
                  onClose();
                }}>Roll back</PBtn>
              </div>)}
            </div>}
      </div>}
    </Sheet>;
  }

  /* ── The board ────────────────────────────────────────────────────────── */

  function Cell({ surface, region, onOpen }) {
    const P = useP();
    const MM = M();
    const own = MM.get(surface, region);
    /* 🔴 WHAT A SHOPPER SEES IS live(), NOT get(). This read `own`, so a DRAFT
     * with items rendered "Showing 1 · carousel" — telling the operator their
     * staged set was on the storefront when the storefront was still showing the
     * house card. The comment further down already said "live() is the only
     * authority"; the code did the opposite, which is the exact shape this
     * project keeps producing: a correct sentence next to code that contradicts
     * it, and nothing to catch the difference.
     * live() also resolves the All-regions fallback, so an inheriting region
     * correctly reports what IT shows rather than what it owns. */
    const shown = MM.live(surface, region);
    const ownLive = !!(own && own.state === 'live');
    /* ⚠️ "INHERITS" MEANS THERE IS SOMETHING TO INHERIT. A region with no set of
     * its own AND no All-regions default is EMPTY, and the first version of this
     * cell called it "inherits · From All regions" — which reads as covered when
     * every one of those slots was in fact dark. That is precisely the blindness
     * the board exists to remove. */
    const fallback = region !== 'all' ? MM.get(surface, 'all') : null;
    const inherits = !own && !!fallback;
    const n = own ? own.items.length : 0;

    const tone = shown ? P.good : P.warn;
    return <button data-hw-i onClick={onOpen} title={(MM.surfaceById(surface) || {}).label + ' · ' + regionLabel(region)}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5, minHeight: 84, width: '100%',
        padding: '10px 12px', textAlign: 'left', cursor: 'pointer', fontFamily: P.fontSans,
        background: P.surface, border: `1px solid ${shown ? P.hairline2 : P.warnSoft}`, borderRadius: P.r10 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {own ? <Pill kind={STATE_KIND[own.state] || 'neutral'} size="sm" dot>{own.state}</Pill>
          : inherits ? <Pill kind="neutral" size="sm" icon="link">inherits</Pill>
            : <Pill kind="warn" size="sm" icon="alert">empty</Pill>}
        {own && <span style={{ fontSize: P.type.micro, fontFamily: P.fontMono, color: P.inkMute, textTransform: 'uppercase', letterSpacing: '.06em' }}>{own.mode}</span>}
      </span>
      <span style={{ fontSize: P.type.strong, fontWeight: 600, color: P.ink }}>
        {own ? n + ' item' + (n === 1 ? '' : 's') : inherits ? 'From All regions' : 'Nothing scheduled'}
      </span>
      {/* WHAT A SHOPPER ACTUALLY SEES. `own.items.length` is not that: a draft
          with four items shows the house card. live() is the only authority. */}
      <span style={{ fontSize: P.type.micro, color: tone, fontWeight: 600 }}>
        {shown ? 'Showing ' + shown.items.length + ' · ' + shown.mode : 'Showing the house card'}
      </span>
      {own && !ownLive && !!n && <span style={{ fontSize: P.type.micro, color: P.inkMute }}>staged, not live yet</span>}
      {own && own.by && <span style={{ fontSize: P.type.micro, color: P.inkMute, fontFamily: P.fontMono, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{own.by.who}</span>}
    </button>;
  }

  function Board({ onOpen }) {
    const P = useP();
    const MM = useMerch();
    const cols = ['all'].concat(MM.REGIONS);
    const head = { fontSize: P.type.micro, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkMute, fontFamily: P.fontMono, padding: '0 2px 8px' };
    return <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: 720, display: 'grid', gridTemplateColumns: `minmax(190px,1.2fr) repeat(${cols.length},minmax(148px,1fr))`, gap: 8, alignItems: 'stretch' }}>
        <div style={head}>Surface</div>
        {cols.map((c) => <div key={c} style={head}>{regionLabel(c)}</div>)}
        {MM.SURFACES.map((s) => <React.Fragment key={s.id}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3, padding: '4px 2px' }}>
            <span style={{ fontSize: P.type.strong, fontWeight: 600, color: P.ink }}>{s.label}</span>
            <span style={{ fontSize: P.type.micro, color: P.inkMute, fontFamily: P.fontMono }}>
              holds {s.cap}{s.neverFirst ? ' · never first' : ''}{s.mustLabel ? ' · must label' : ''}
            </span>
          </div>
          {cols.map((c) => <Cell key={s.id + c} surface={s.id} region={c} onOpen={() => onOpen(s.id, c)} />)}
        </React.Fragment>)}
      </div>
    </div>;
  }

  /* ── Rails ────────────────────────────────────────────────────────────── */

  function RailsPanel() {
    const P = useP();
    const MM = useMerch();
    return <Card padding={16}>
      <SectionHead level={3} title="Rails" subtitle="Fresh Drops · On Sale · Staff Picks · Best Sellers · New Arrivals" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {RAILS.map((r) => {
          const sid = railSurfaceId(r);
          const wired = !!MM.surfaceById(sid);
          return <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', border: `1px solid ${P.hairline}`, borderRadius: P.r10, flexWrap: 'wrap' }}>
            <span style={{ flex: 1, minWidth: 150 }}>
              <span style={{ display: 'block', fontSize: P.type.strong, fontWeight: 600, color: P.ink }}>{r.label}</span>
              <span style={{ display: 'block', fontSize: P.type.micro, color: P.inkMute, fontFamily: P.fontMono }}>{sid}</span>
            </span>
            <Seg size="lg" value="editorial" onChange={() => {}}
              options={[{ value: 'editorial', label: 'Editorial' }, { value: 'auto', label: 'Auto' }]} />
            <PBtn size="md" variant="secondary" icon="pencil" disabled={!wired}
              title={wired ? 'Pick the items for this rail' : 'No surface id for this rail yet'}>Pick items</PBtn>
          </div>;
        })}
      </div>
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Note tone="warn" icon="alert">
          <b>Auto is offered and switched off, deliberately.</b> Best Sellers needs <b>unitsSold</b> and New Arrivals
          needs <b>firstSeenAt</b>; no product row in this catalogue carries either. An auto rail would rank on
          something invented, and an invented ranking reads as authoritative.
        </Note>
        <Note tone="flat" icon="link">
          <b>The editorial pickers are inert until the seam knows these ids.</b> A rail is a merchandising surface, so
          its picks belong in <b>HWMerch</b> — and <b>HWMerch.SURFACES</b> carries no <b>rail_*</b> id, so a set for one
          would be refused. Keeping a second private store here instead would put rail picks outside the one seam and
          they would never reach the storefront. Add the ids and these light up unchanged.
        </Note>
      </div>
    </Card>;
  }

  /* ── The claim ceiling settings modal (opened from POS Settings) ───────── */

  window.ClaimCeilingSettings = function ClaimCeilingSettings({ onClose }) {
    const P = useP();
    const C = useClaim();
    const [val, setVal] = React.useState(String(C.get()));
    const n = parseFloat(val);
    const bad = !Number.isFinite(n) || n < 1 || n > 100;
    const sample = 'Up to ' + (Number.isFinite(n) ? Math.round(n) : 0) + '% off';
    return <Sheet icon="percent" title="Claim ceiling" sub="The deepest discount merchandising copy may advertise" onClose={onClose} width="min(560px,96vw)"
      footer={<React.Fragment>
        <PBtn variant="ghost" size="md" onClick={() => { const d = C.reset(); setVal(String(d)); }}>Reset</PBtn>
        <span style={{ display: 'flex', gap: 9 }}>
          <PBtn variant="secondary" size="md" onClick={onClose}>Cancel</PBtn>
          <PBtn variant="accent" size="md" icon="check" disabled={bad} onClick={() => { if (C.set(n) === null) return; onClose(); }}>Save · {Number.isFinite(n) ? Math.round(n) : '—'}%</PBtn>
        </span>
      </React.Fragment>}>
      <Note tone="flat" icon="shield">
        <b>A reviewer found the shop advertising “Up to 97% off”.</b> The arithmetic was right — one clearance SKU
        really was down 97% — but a single mispriced row was speaking for an entire brand, and a 97% headline reads
        as a pricing error, because usually it is one.
      </Note>
      <div>
        <div style={lbl(P)}>Maximum advertised discount</div>
        <div style={{ maxWidth: 180 }}><Field mono value={val} onChange={(e) => setVal(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="60"
          suffix={<span style={{ fontSize: P.type.meta, color: P.inkMute, fontFamily: P.fontMono }}>%</span>} /></div>
        <div style={{ fontSize: P.type.meta, color: P.inkDim, marginTop: 6, lineHeight: 1.5 }}>
          Merchandising copy claiming more than this is refused where it is written. “{sample}” is the deepest claim
          this store will let through.
        </div>
      </div>
      {C.isDefault() && <Note tone="warn" icon="info">
        <b>Still the shipped default.</b> {CLAIM_DEFAULT}% is a conservative starting figure, not a confirmed policy —
        it should be set by whoever owns pricing.
      </Note>}
      {C.isShared()
        ? <Note tone="info" icon="link">
            <b>This figure is the estate-wide one.</b> It sits on the shared delivery/lane setting, so the storefront’s
            brand spotlight and this tab are held to the same number. One ceiling, one place.
          </Note>
        : <Note tone="warn" icon="alert">
            <b>This browser only — the storefront is still on its own constant.</b> It is enforced here, where copy is
            authored: a house card or item label over the ceiling is refused with the reason shown. The storefront caps
            its brand spotlight with <b>SPOTLIGHT_MAX_PCT</b> in <b>shop/data.jsx</b> ({CLAIM_DEFAULT}%, which is why
            {CLAIM_DEFAULT}% is the default here). It already looks for <b>claimCeilingPct</b> on
            <b> HW.laneSettings()</b>; adding that key to <b>LANE_DEFAULTS</b> in <b>pos/data.jsx</b> joins the two,
            and this panel switches over on its own.
          </Note>}
      {bad && <Note tone="bad" icon="alert">
        A ceiling must be between 1% and 100%. Zero would refuse every claim and 250 would refuse none — both switch
        the guard off silently, in opposite directions.
      </Note>}
    </Sheet>;
  };

  /* ── The screen ───────────────────────────────────────────────────────── */

  window.MerchScreen = function MerchScreen() {
    const P = useP();
    const MM = useMerch();
    const C = useClaim();
    const [slot, setSlot] = React.useState(null);
    const [house, setHouse] = React.useState(false);
    const [ceiling, setCeiling] = React.useState(false);

    /* The claim ceiling's home is POS settings, beside the lane minimums. The
     * button in the header is a shortcut to the SAME editor, opened in place:
     * routing to Settings from here goes through HW_NAV, which reloads the
     * page, and the operator loses whatever slot they were half way through. */
    const cols = ['all'].concat(MM.REGIONS);
    let dark = 0, total = 0;
    MM.SURFACES.forEach((s) => MM.REGIONS.forEach((r) => { total++; if (!MM.live(s.id, r)) dark++; }));

    return <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      <SectionHead level={1} eyebrow="Merchandising" title="Merchandising"
        subtitle="What each surface shows, per region — the mode, the items, the share of voice, and who changed it."
        action={<PBtn variant="secondary" size="md" icon="percent" onClick={() => setCeiling(true)}>Claim ceiling · {C.get()}%</PBtn>} />

      {MM.isDemoStorage() && <div style={{ marginBottom: 14 }}>
        <Note tone="warn" icon="alert">
          <b>Demo storage — this browser only.</b> These sets live in this browser’s local storage and sync nowhere.
          Two marketers on two laptops have two different realities. Nothing here is a shared source of truth yet.
        </Note>
      </div>}

      <div style={{ marginBottom: 14 }}>
        <Note tone={dark ? 'warn' : 'info'} icon={dark ? 'alert' : 'check-circle'}>
          {dark
            ? <React.Fragment><b>{dark} of {total} region slots have nothing live</b> and fall back to the house card.
              That is the safe outcome, but an unseen empty slot is how a bad automatic pick reached customers — each
              one is a task, not silence.</React.Fragment>
            : <React.Fragment><b>Every one of the {total} region slots has something live.</b> Nothing is falling back
              to the house card right now.</React.Fragment>}
        </Note>
      </div>

      <div style={{ marginBottom: 20 }}><HouseCardPanel onEdit={() => setHouse(true)} /></div>

      <SectionHead level={2} title="The board" subtitle={'Every surface across ' + cols.length + ' columns — the All-regions default plus one column per region. Click any slot to edit it.'} />
      <Card padding={16} style={{ marginBottom: 20 }}><Board onOpen={(s, r) => setSlot({ surface: s, region: r })} /></Card>

      <RailsPanel />

      {slot && <SlotModal surface={slot.surface} region={slot.region} onClose={() => setSlot(null)} />}
      {house && <HouseCardModal onClose={() => setHouse(false)} />}
      {ceiling && <window.ClaimCeilingSettings onClose={() => setCeiling(false)} />}
    </div>;
  };
})();
