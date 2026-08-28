// ── Promotions module — shared shell + primitives ──────────────────────────
const useP = window.useP,useTheme = window.useTheme;
const { pfmt, ENTITIES, REWARDS, RULE, CATEGORIES, BRANDS, PRODUCTS, MEMBER_GROUPS, PRODUCT_TYPES } = window;

// tone → color resolver
function toneColor(P, tone) {return { info: P.info, good: P.good, sativa: P.sativa, hybrid: P.hybrid, edibles: P.cat.edibles, indica: P.indica, warn: P.warn, bad: P.bad, accent: P.accent }[tone] || P.ink2;}

// ── Shell: rail + top bar ───────────────────────────────────────────────────
// The rail itself is shared by every app — see shared/app-rail.jsx.
window.PRail = function PRail({ active, onNav }) {
  return <window.HWRail active={active} onNav={onNav} />;
};

window.PTopBar = function PTopBar({ platform, setPlatform, right }) {
  const P = useP();const { mode, toggle } = useTheme();
  return (
    <header style={{ height: 60, flex: '0 0 60px', display: 'flex', alignItems: 'center', gap: 14, padding: '0 20px', background: P.surface, borderBottom: `1px solid ${P.hairline2}`, zIndex: 30, transition: 'background .2s' }}>
      <PlatformSwitch value={platform} onChange={setPlatform} />
      <div style={{ flex: 1 }} />
      {right}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconBtn icon="search" title="Search" />
        <IconBtn icon="bell" badge={true} badgeColor={P.accent} title="Notifications" />
        <button onClick={toggle} title="Toggle theme" style={{ width: 38, height: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: P.r10, color: P.ink2, cursor: 'pointer' }}><Icon name={mode === 'light' ? 'moon' : 'sun'} size={18} stroke={1.9} /></button>
      </div>
      <div style={{ width: 1, height: 26, background: P.hairline2, margin: '0 2px' }} />
      <button style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '4px 8px 4px 4px', background: 'transparent', border: 'none', borderRadius: P.r10, cursor: 'pointer' }}>
        <Avatar name="Manisha Saini" size={32} />
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink }}>Manisha Saini</span>
          <span style={{ fontSize: 11.5, color: P.inkDim }}>Admin</span>
        </span>
        <Icon name="chevron-down" size={13} stroke={2} color={P.inkMute} />
      </button>
    </header>);
};

// ── status pill mapping ─────────────────────────────────────────────────────
window.statusPill = function statusPill(status) {
  const map = { active: { kind: 'good', dot: true, label: 'Active' }, scheduled: { kind: 'info', dot: true, label: 'Scheduled' }, paused: { kind: 'warn', dot: true, label: 'Paused' }, ended: { kind: 'neutral', dot: true, label: 'Ended' }, draft: { kind: 'ghost', dot: true, label: 'Draft' } };
  const c = map[status] || map.draft;
  return <Pill kind={c.kind} dot={c.dot}>{c.label}</Pill>;
};

// Weedmaps per-promo sync state → pill
window.wmSyncPill = function wmSyncPill(state) {
  const map = { synced: { kind: 'good', label: 'On Weedmaps' }, not_pushed: { kind: 'warn', label: 'Not pushed' }, overlap: { kind: 'warn', label: 'Overlap' }, paused: { kind: 'neutral', label: 'Paused on WM' }, ended: { kind: 'ghost', label: 'Ended' }, wm_only: { kind: 'bad', label: 'WM-only' } };
  const c = map[state] || map.not_pushed;
  return <Pill kind={c.kind} dot={true}>{c.label}</Pill>;
};

// entity glyph chip
window.EntityChip = function EntityChip({ entityId, size = 'md' }) {
  const P = useP();const e = RULE.entity(entityId);if (!e) return null;
  const c = toneColor(P, e.tone);
  const s = size === 'sm' ? { w: 24, ic: 13, fs: 11 } : { w: 30, ic: 16, fs: 12.5 };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: s.w, height: s.w, borderRadius: 8, background: c + (P.mode === 'dark' ? '28' : '1E'), color: c, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={e.icon} size={s.ic} stroke={1.9} /></span>
      <span style={{ fontSize: s.fs, fontWeight: 600, color: P.ink }}>{e.label}</span>
    </span>);
};

// ── PLAIN-LANGUAGE SENTENCE (read-only) ─────────────────────────────────────
// Renders "When [subject] [conditions], [reward]." Used in previews + detail.
window.PlainSentence = function PlainSentence({ rule, size = 'md', muted }) {
  const P = useP();const plain = window.ruleToPlain(rule);if (!plain) return null;
  const fs = size === 'lg' ? 16.5 : size === 'sm' ? 13 : 14.5;
  const c = toneColor(P, plain.entity.tone);
  const strong = { fontWeight: 700, color: muted ? P.ink2 : P.ink };
  return (
    <div style={{ fontSize: fs, lineHeight: 1.65, color: P.inkDim, fontFamily: P.fontSans }}>
      <span style={{ fontWeight: 700, color: c, textTransform: 'uppercase', fontSize: fs * 0.72, letterSpacing: '.1em', fontFamily: P.fontMono, marginRight: 8 }}>When</span>
      <span style={strong}>{plain.subj}</span> {plain.cond}
      <span style={{ display: 'block', marginTop: 6 }}>
        <span style={{ fontWeight: 700, color: P.accent === '#FFD100' && P.mode === 'light' ? '#8A6200' : P.accent, textTransform: 'uppercase', fontSize: fs * 0.72, letterSpacing: '.1em', fontFamily: P.fontMono, marginRight: 8 }}>Then</span>
        <span style={strong}>{plain.then}</span>
      </span>
    </div>);
};

// ── ANCHORED PORTAL POPOVER — escapes overflow/scroll clipping ──────────────
// Rendered into document.body with fixed positioning computed from the trigger
// rect, so cards with overflow:hidden and scrolling containers can't clip it.
window.AnchoredPopover = function AnchoredPopover({ anchorRef, onClose, width = 300, children }) {
  const P = useP();
  const [pos, setPos] = React.useState(null);
  React.useLayoutEffect(() => {
    const place = () => {
      const el = anchorRef && anchorRef.current; if (!el) return;
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth, vh = window.innerHeight;
      const w = Math.min(width, vw - 16);
      let left = r.left; if (left + w > vw - 8) left = vw - 8 - w; if (left < 8) left = 8;
      const below = vh - r.bottom - 14, above = r.top - 14;
      const up = below < 260 && above > below;
      setPos({ left, top: up ? undefined : Math.round(r.bottom + 8), bottom: up ? Math.round(vh - r.top + 8) : undefined, w, maxH: Math.max(220, Math.round(up ? above : below)) });
    };
    place();
    window.addEventListener('scroll', place, true); window.addEventListener('resize', place);
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); };
  }, []);
  if (!pos) return null;
  return ReactDOM.createPortal(<>
    {/* THE LADDER, NOT A BIG NUMBER. This pair was 2000/2001 — the highest in the
        estate, and above every rung shared/hw-z.js defines: notePin 500, tourMask
        600, tourCard 610. Portalling to document.body is what escapes CLIPPING;
        it is not a reason to outrank the annotation layer and the guided tour,
        which this did on every SlotChip and on the sentence builder's Add popover.
        The identical shape in pos/screen-register.jsx (1000/1001) was measured in
        a browser: it made the tour's "Next" button unclickable. Same fix, same
        reason. P.z.dropdown, panel one step above its own catcher. */}
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: P.z.dropdown }} />
    <div style={{ position: 'fixed', left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.w, maxHeight: pos.maxH, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r14, boxShadow: P.shadowLg, zIndex: P.z.dropdown + 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>{children}</div>
  </>, document.body);
};

// toggle chip used inside product filters
function FChip({ label, on, onClick }) {
  const P = useP();
  return <button onClick={onClick} style={{ padding: '4px 10px', fontSize: 11.5, fontWeight: 600, borderRadius: 99, cursor: 'pointer', border: `1px solid ${on ? P.ink : P.hairline2}`, background: on ? P.ink : 'transparent', color: on ? P.surface : P.ink2, fontFamily: P.fontSans, whiteSpace: 'nowrap' }}>{label}</button>;
}
function MiniNum({ prefix, suffix, value, onChange, ph }) {
  const P = useP();
  return <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 9px', background: P.field, border: `1px solid ${P.fieldBorder}`, borderRadius: 8, flex: 1, minWidth: 0 }}>
    {prefix && <span style={{ fontSize: 12.5, color: P.inkDim, fontFamily: P.fontMono }}>{prefix}</span>}
    <input type="number" value={value} placeholder={ph} onChange={(e) => onChange(e.target.value)} style={{ flex: 1, minWidth: 0, width: '100%', border: 'none', outline: 'none', background: 'transparent', color: P.ink, fontSize: 13.5, fontWeight: 600, fontFamily: P.fontMono }} />
    {suffix && <span style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{suffix}</span>}
  </div>;
}

function MultiSelect({ options, value, onChange, searchable, labelKey, priceKey, onClose, allLabel, productMode }) {
  const P = useP();const [q, setQ] = React.useState('');
  const opts = options.map((o) => typeof o === 'object' ? o : { [labelKey || 'n']: o });
  const lk = labelKey || 'n';
  // product filters
  const [fOpen, setFOpen] = React.useState(false);
  const [fCat, setFCat] = React.useState([]); const [fBrand, setFBrand] = React.useState([]);
  const [pmin, setPmin] = React.useState(''); const [pmax, setPmax] = React.useState('');
  const [tGte, setTGte] = React.useState(''); const [tLte, setTLte] = React.useState('');
  const [fType, setFType] = React.useState([]);
  const cats = productMode ? [...new Set(opts.map((o) => o.c).filter(Boolean))].sort() : [];
  const brands = productMode ? [...new Set(opts.map((o) => o.b).filter(Boolean))].sort() : [];
  const activeFilters = fCat.length + fBrand.length + fType.length + (pmin !== '' ? 1 : 0) + (pmax !== '' ? 1 : 0) + (tGte !== '' ? 1 : 0) + (tLte !== '' ? 1 : 0);
  const clearF = () => { setFCat([]); setFBrand([]); setFType([]); setPmin(''); setPmax(''); setTGte(''); setTLte(''); };
  const tog = (arr, set, v) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const filtered = opts.filter((o) => {
    if (q && !String(o[lk]).toLowerCase().includes(q.toLowerCase())) return false;
    if (!productMode) return true;
    if (fCat.length && !fCat.includes(o.c)) return false;
    if (fBrand.length && !fBrand.includes(o.b)) return false;
    if (fType.length && !fType.includes(o.type)) return false;
    if (pmin !== '' && o.p < +pmin) return false;
    if (pmax !== '' && o.p > +pmax) return false;
    if (tGte !== '' && (o.thc == null || o.thc < +tGte)) return false;
    if (tLte !== '' && (o.thc == null || o.thc > +tLte)) return false;
    return true;
  });
  const has = (o) => value.some((v) => (typeof v === 'object' ? v[lk] : v) === o[lk]);
  const toggle = (o) => {const raw = priceKey ? o : o[lk];if (has(o)) onChange(value.filter((v) => (typeof v === 'object' ? v[lk] : v) !== o[lk]));else onChange([...value, raw]);};
  const allOn = filtered.length > 0 && filtered.every(has);
  const toggleAll = () => {
    if (allOn) onChange(value.filter((v) => !filtered.some((o) => (typeof v === 'object' ? v[lk] : v) === o[lk])));
    else { const add = filtered.filter((o) => !has(o)).map((o) => priceKey ? o : o[lk]); onChange([...value, ...add]); }
  };
  const FLabel = ({ children }) => <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 7 }}>{children}</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      {(searchable || productMode) && <div style={{ padding: 12, borderBottom: `1px solid ${P.hairline}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}><Field icon="search" placeholder={productMode ? 'Search products…' : 'Search…'} value={q} onChange={(e) => setQ(e.target.value)} size="sm" /></div>
          {productMode && <button onClick={() => setFOpen((o) => !o)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 12px', background: activeFilters || fOpen ? P.ink : P.surface, color: activeFilters || fOpen ? P.surface : P.ink2, border: `1px solid ${activeFilters || fOpen ? P.ink : P.hairline3}`, borderRadius: P.r10, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: P.fontSans, whiteSpace: 'nowrap' }}><Icon name="filter" size={14} stroke={1.9} />Filters{activeFilters ? ` · ${activeFilters}` : ''}</button>}
        </div>
        {productMode && fOpen && <div style={{ display: 'flex', flexDirection: 'column', gap: 13, padding: '4px 2px 2px' }}>
          <div><FLabel>Category</FLabel><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 78, overflowY: 'auto' }}>{cats.map((c) => <FChip key={c} label={c} on={fCat.includes(c)} onClick={() => tog(fCat, setFCat, c)} />)}</div></div>
          <div><FLabel>Brand</FLabel><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 78, overflowY: 'auto' }}>{brands.map((b) => <FChip key={b} label={b} on={fBrand.includes(b)} onClick={() => tog(fBrand, setFBrand, b)} />)}</div></div>
          <div><FLabel>Strain type</FLabel><div style={{ display: 'flex', gap: 6 }}>{PRODUCT_TYPES.map((t) => <FChip key={t} label={t} on={fType.includes(t)} onClick={() => tog(fType, setFType, t)} />)}</div></div>
          <div><FLabel>Price range</FLabel><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><MiniNum prefix="$" ph="min" value={pmin} onChange={setPmin} /><span style={{ color: P.inkMute, fontSize: 12.5 }}>to</span><MiniNum prefix="$" ph="max" value={pmax} onChange={setPmax} /></div></div>
          <div><FLabel>THC %</FLabel><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><MiniNum suffix="% ≥" ph="min" value={tGte} onChange={setTGte} /><span style={{ color: P.inkMute, fontSize: 12.5 }}>–</span><MiniNum suffix="% ≤" ph="max" value={tLte} onChange={setTLte} /></div></div>
          {activeFilters > 0 && <button onClick={clearF} style={{ alignSelf: 'flex-start', fontSize: 11.5, color: P.info, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Clear all filters</button>}
        </div>}
      </div>}
      <div style={{ flex: 1, minHeight: 100, overflowY: 'auto', padding: 6 }}>
        <button onClick={toggleAll} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px', background: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}>
          <Check on={allOn} onChange={toggleAll} /><span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>{allLabel || 'Select all'} ({filtered.length})</span>
        </button>
        {filtered.length === 0 && <div style={{ padding: '24px 10px', textAlign: 'center', color: P.inkMute, fontSize: 12.5 }}>No matches — adjust filters.</div>}
        {filtered.map((o, i) =>
        <button key={i} onClick={() => toggle(o)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px', background: has(o) ? P.surface2 : 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}>
            <Check on={has(o)} onChange={() => toggle(o)} />
            <span style={{ flex: 1, minWidth: 0 }}><span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, display: 'block' }}>{o[lk]}</span>{productMode && <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{o.c} · {o.b} · {o.thc}% THC</span>}</span>
            {priceKey && o[priceKey] != null && <span style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{pfmt.money(o[priceKey])}</span>}
          </button>)}
      </div>
      <div style={{ padding: 10, borderTop: `1px solid ${P.hairline}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{value.length} selected</span>
        <PBtn size="sm" variant="primary" onClick={onClose}>Done</PBtn>
      </div>
    </div>);
}

function SingleSelect({ options, value, onChange, onClose }) {
  const P = useP();
  return <div style={{ padding: 6, maxHeight: 280, overflowY: 'auto' }}>
    {options.map((o) => {const a = o === value;return (
        <button key={o} onClick={() => {onChange(o);onClose();}} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px', background: a ? P.accentSoft : 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}>
        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: P.ink }}>{o}</span>{a && <Icon name="check" size={14} stroke={2.4} color={P.ink} />}
      </button>);})}
  </div>;
}

function NumberEditor({ param, value, onChange, onClose }) {
  const P = useP();const [v, setV] = React.useState(value ?? param.def ?? '');
  const prefix = param.type === 'money' ? '$' : '';const suffix = param.type === 'percent' ? '%' : param.unit && ['days', 'months', 'items', 'qty'].includes(param.unit) ? ' ' + param.unit : '';
  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 13px', background: P.field, border: `1px solid ${P.accentBorder}`, borderRadius: P.r10, boxShadow: `0 0 0 3px ${P.accentSoft}` }}>
        {prefix && <span style={{ fontSize: 15, fontWeight: 700, color: P.inkDim, fontFamily: P.fontMono }}>{prefix}</span>}
        <input autoFocus type="number" value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => {if (e.key === 'Enter') {onChange(v === '' ? '' : Number(v));onClose();}}}
        style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: P.ink, fontSize: 16, fontWeight: 600, fontFamily: P.fontMono }} />
        {suffix && <span style={{ fontSize: 13.5, color: P.inkDim, fontFamily: P.fontMono }}>{suffix}</span>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}><PBtn size="sm" variant="primary" onClick={() => {onChange(v === '' ? '' : Number(v));onClose();}}>Set</PBtn></div>
    </div>);
}

// The editable underlined slot chip that opens the right editor.
window.SlotChip = function SlotChip({ param, value, onChange, empty }) {
  const P = useP();const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const filled = param.type === 'category' || param.type === 'brand' || param.type === 'product' || param.type === 'ptype' ? value && value.length : param.type === 'group' ? !!value : value !== '' && value != null;
  const txt = window.paramText(param, value);
  const c = P.mode === 'light' ? P.info : '#8FB4F5';
  const width = param.type === 'product' ? 420 : param.type === 'category' || param.type === 'brand' ? 300 : param.type === 'group' ? 240 : 200;
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button ref={ref} onClick={() => setOpen((o) => !o)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 3px', margin: '0 1px', background: 'transparent', border: 'none', borderBottom: `1.5px solid ${filled ? c : P.inkFaint}`, color: filled ? c : P.inkMute, fontSize: 'inherit', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', lineHeight: 1.5 }}>
        {txt}<Icon name="chevron-down" size={12} stroke={2.4} />
      </button>
      {open && <AnchoredPopover anchorRef={ref} onClose={() => setOpen(false)} width={width}>
        {param.type === 'number' || param.type === 'money' || param.type === 'percent' ? <NumberEditor param={param} value={value} onChange={onChange} onClose={() => setOpen(false)} /> :
        param.type === 'ptype' ? <MultiSelect options={PRODUCT_TYPES} value={value || []} onChange={onChange} onClose={() => setOpen(false)} /> :
        param.type === 'category' ? <MultiSelect options={CATEGORIES} value={value || []} onChange={onChange} searchable onClose={() => setOpen(false)} /> :
        param.type === 'brand' ? <MultiSelect options={BRANDS} value={value || []} onChange={onChange} searchable onClose={() => setOpen(false)} /> :
        param.type === 'product' ? <MultiSelect options={PRODUCTS} value={value || []} onChange={onChange} searchable productMode labelKey="n" priceKey="p" onClose={() => setOpen(false)} /> :
        param.type === 'group' ? <SingleSelect options={MEMBER_GROUPS} value={value} onChange={onChange} onClose={() => setOpen(false)} /> : null}
      </AnchoredPopover>}
    </span>);
};

// ── METRIC primitives ───────────────────────────────────────────────────────
// small labeled stat with tooltip hint
window.MetricStat = function MetricStat({ label, value, hint, delta, deltaKind, accent, tone }) {
  const P = useP();const [h, setH] = React.useState(false);
  const dc = !delta ? P.inkMute : deltaKind === 'bad' ? P.bad : deltaKind === 'warn' ? P.warn : P.good;
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ position: 'relative', background: P.surface, border: `1px solid ${accent ? P.accentBorder : P.hairline2}`, borderRadius: P.r12, padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 10, color: P.inkMute, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        {hint && <span style={{ color: P.inkFaint, display: 'inline-flex', cursor: 'help' }}><Icon name="info" size={12} stroke={1.9} /></span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 21, fontWeight: 600, color: tone ? toneColor(P, tone) : P.ink, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{value}</span>
        {delta != null && <span style={{ fontSize: 11.5, fontWeight: 600, color: dc, fontVariantNumeric: 'tabular-nums' }}>{delta > 0 ? '▲' : delta < 0 ? '▼' : '—'} {Math.abs(delta)}%</span>}
      </div>
      {hint && h && <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, right: 0, background: P.ink, color: P.surface, padding: '8px 10px', borderRadius: 8, fontSize: 11.5, lineHeight: 1.4, zIndex: 20, boxShadow: P.shadowMd }}>{hint}</div>}
    </div>);
};

// donut for splits (e.g. new vs returning)
window.Donut = function Donut({ segments, size = 88, thickness = 13, center }) {
  const P = useP();const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  let acc = 0;const r = (size - thickness) / 2;const cx = size / 2,cy = size / 2;const circ = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={P.surface3} strokeWidth={thickness} />
        {segments.map((s, i) => {const frac = s.value / total;const dash = frac * circ;const el = <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={thickness} strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-acc * circ} strokeLinecap="butt" />;acc += frac;return el;})}
      </svg>
      {center && <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>{center}</div>}
    </div>);
};

// horizontal bar row (for top SKUs / categories)
window.BarRow = function BarRow({ label, value, max, color, valueLabel }) {
  const P = useP();const pct = Math.max(3, Math.min(100, value / (max || 1) * 100));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0' }}>
      <span style={{ width: 150, fontSize: 12.5, color: P.ink, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      <div style={{ flex: 1, height: 8, background: P.surface3, borderRadius: 99, overflow: 'hidden' }}><div style={{ width: pct + '%', height: '100%', background: color || P.accent, borderRadius: 99 }} /></div>
      <span style={{ width: 64, textAlign: 'right', fontSize: 12.5, fontWeight: 600, color: P.ink2, fontFamily: P.fontMono }}>{valueLabel}</span>
    </div>);
};

// area chart (simple)
window.AreaChart = function AreaChart({ data, height = 140, color, label }) {
  const P = useP();color = color || P.accent;
  if (!data || !data.length) return null;
  const w = 680;const max = Math.max(...data),min = Math.min(...data),rng = max - min || 1;
  const pts = data.map((v, i) => [i / (data.length - 1) * w, height - (v - min) / rng * (height - 18) - 8]);
  const path = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  return <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
    <defs><linearGradient id={'ag' + label} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={P.mode === 'dark' ? .32 : .22} /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
    <path d={path + ` L ${w} ${height} L 0 ${height} Z`} fill={`url(#ag${label})`} />
    <path d={path} stroke={color} strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round" />
  </svg>;
};

Object.assign(window, { toneColor });