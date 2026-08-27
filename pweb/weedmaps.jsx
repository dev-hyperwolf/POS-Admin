// ── Weedmaps channel — integrated into the Promotions Suite (pweb) ──────────
// How Weedmaps plugs into Hyperwolf: orders → regions → drivers, sync health,
// and reconciling WM promotions against ours. Uses WM_* data from promo/pdata.
const useP = window.useP;
const { pfmt, WM_REGIONS, WM_LISTINGS, WM_STORE, WM_SYNC, WM_ORDER_FLOW, WM_AUTOMATION } = window;

const WM_ACTOR = { Weedmaps:'#1F5FC0', Hyperwolf:'#15140F', Driver:'#2E7D46', Store:'#B7791F' };

// deterministic WM sync state for a Suite promo (this dataset has no wm field yet)
function wmStateFor(p, i) {
  if (p.status === 'scheduled' || p.status === 'draft') return 'not_pushed';
  if (p.status === 'paused') return 'paused';
  if (p.status === 'ended') return 'ended';
  if (i === 2) return 'overlap';
  return 'synced';
}

function WmPanel({ title, sub, right, children, pad = 18 }) {
  const P = useP();
  return (
    <div style={{ background:P.surface, border:`1px solid ${P.hairline2}`, borderRadius:P.r14, overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'13px 18px', borderBottom:`1px solid ${P.hairline}` }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13.5, fontWeight:700, color:P.ink }}>{title}</div>
          {sub && <div style={{ fontSize:11.5, color:P.inkDim, marginTop:2, lineHeight:1.45 }}>{sub}</div>}
        </div>
        {right}
      </div>
      <div style={{ padding:pad }}>{children}</div>
    </div>);
}

function WmActorChip({ actor }) {
  const c = WM_ACTOR[actor] || '#7C7869';
  return <span style={{ fontSize: 10, fontWeight:800, letterSpacing:'.04em', textTransform:'uppercase', color:'#fff', background:c, borderRadius:20, padding:'2px 8px', whiteSpace:'nowrap' }}>{actor}</span>;
}

function WmOrderFlow() {
  const P = useP();
  return (
    <div style={{ display:'flex', gap:0, overflowX:'auto', paddingBottom:4 }}>
      {WM_ORDER_FLOW.map((s, i) => (
        <React.Fragment key={i}>
          <div style={{ flex:'1 0 148px', minWidth:148, background: s.key ? P.accentSoft : P.surface2, border:`1px solid ${s.key ? P.accentBorder : P.hairline2}`, borderRadius:P.r12, padding:'11px 13px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:7 }}>
              <WmActorChip actor={s.actor} /><span style={{ fontFamily:P.fontMono, fontSize:10, fontWeight:800, color:P.inkFaint }}>{i + 1}</span>
            </div>
            <div style={{ fontSize:12.5, fontWeight:700, color:P.ink, lineHeight:1.25, marginBottom:3 }}>{s.t}</div>
            <div style={{ fontSize: 11.5, color:P.inkDim, lineHeight:1.4 }}>{s.d}</div>
          </div>
          {i < WM_ORDER_FLOW.length - 1 && <div style={{ display:'flex', alignItems:'center', color:P.inkFaint, padding:'0 3px' }}><Icon name="chevron-right" size={16} stroke={2.2} /></div>}
        </React.Fragment>))}
    </div>);
}

function WmRegionMap() {
  const P = useP();
  return (
    <div style={{ overflowX:'auto' }}>
      <table style={{ width:'100%', minWidth:620, borderCollapse:'collapse', fontSize:12.5 }}>
        <thead><tr style={{ background:P.surface2 }}>
          {['Region', 'Zip codes', 'Drivers (on-shift feed the listing)', 'Feeds'].map((h, i) => (
            <th key={i} style={{ textAlign:'left', padding:'9px 14px', fontSize:10, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:P.inkDim, borderBottom:`1px solid ${P.hairline2}` }}>{h}</th>))}
        </tr></thead>
        <tbody>
          {WM_REGIONS.map((r) => {
            const on = r.drivers.filter((d) => d.on).length; const L = WM_LISTINGS[r.listing];
            return (
              <tr key={r.region}>
                <td style={{ padding:'11px 14px', borderTop:`1px solid ${P.hairline}`, fontWeight:700, color:P.ink }}>{r.region}<div style={{ fontSize:10, fontWeight:500, color: on ? P.good : P.warn, fontFamily:P.fontMono }}>{on}/{r.drivers.length} on shift</div></td>
                <td style={{ padding:'11px 14px', borderTop:`1px solid ${P.hairline}`, fontFamily:P.fontMono, fontSize: 11.5, color:P.ink2 }}>{r.zips.join(' · ')}</td>
                <td style={{ padding:'11px 14px', borderTop:`1px solid ${P.hairline}` }}>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {r.drivers.map((d) => (
                      <span key={d.n} style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize: 11.5, fontWeight:600, padding:'2px 8px', borderRadius:20, background: d.on ? P.goodSoft : P.neutralSoft, color: d.on ? P.good : P.inkDim }}>
                        <span style={{ width:6, height:6, borderRadius:99, background: d.on ? P.good : P.inkMute }} />{d.n} · {d.kit} SKUs</span>))}
                  </div>
                </td>
                <td style={{ padding:'11px 14px', borderTop:`1px solid ${P.hairline}` }}><Pill kind={L.kind === 'Pickup' ? 'warn' : 'info'} dot>{L.kind}</Pill></td>
              </tr>);
          })}
        </tbody>
      </table>
    </div>);
}

// ── Weedmaps promotions — the EIGHT published attributes, and nothing else ──
// `ApplicableDiscountAttributes` (Weedmaps OOS OpenAPI; a copy of the spec is at
// qa/wm_oos_openapi_2026-01.json in the wm-demo repo) declares exactly eight
// properties, and carries NO `required` list, so ANY of them may be absent on
// any discount:
//
//   auto_apply · code_name · description · end_date
//   legal_disclaimer · prerequisite_customer_type · redemption_details · title
//
// NOT ONE OF THEM IS MONETARY. No amount, no percent, no discount type, no
// scope, no targets or exclusions, no stacking rule, no priority, no minimum
// spend, no usage limit, no per-customer cap, no redemption count, no revenue,
// no cost, no ROI.
//
// This panel used to render 25+ fields of exactly that kind — per-promo revenue
// and discount cost among them — under a comment that called the list "every
// parameter WM exposes". The fields were invented; the comment is why nobody
// checked. The figures the business still wants are now listed at the foot of
// the detail as explicitly unavailable. None is rendered as 0: a 0 is an
// answer, and we do not have one.
//
// Nor has any real discount ever arrived — available_discounts has returned
// 200 {"data":[]} for every listing anyone has polled.

// Read a WM discount element WITHOUT deciding which shape Weedmaps sends.
//   SPEC-LITERAL   ApplicableDiscount declares `data` and `jsonapi`, so each
//                  array element WRAPS the resource: data[i].data.attributes.
//   JSON:API       the convention it claims to follow: data[i].attributes.
// Nobody can settle this by observation, because the endpoint has only ever
// answered with an empty array and an empty array discriminates nothing.
// Guessing is silent rather than loud: reading elem.attributes unconditionally
// against a spec-literal payload yields a null id and eight null attributes for
// EVERY discount, with no exception raised. So this reads either shape and
// reports which one it saw. Mirrors unwrap_discount_element in the sibling
// wmdemo/promos.py — deliberately NOT a decision about which is right.
function wmUnwrapDiscount(elem) {
  const none = { inner:{}, attrs:{}, shape:'unreadable' };
  if (!elem || typeof elem !== 'object' || Array.isArray(elem)) return none;
  const at = (o) => (o && typeof o.attributes === 'object' && o.attributes) || {};
  const inner = elem.data;
  // A wrapper carries `data` as an object and no resource keys of its own.
  if (inner && typeof inner === 'object' && !Array.isArray(inner) && !('attributes' in elem) && !('type' in elem))
    return { inner, attrs: at(inner), shape:'nested' };
  if ('attributes' in elem || 'type' in elem || 'id' in elem)
    return { inner: elem, attrs: at(elem), shape:'flat' };
  return none;
}

// The eight, in spec order, with the spec's own descriptions.
const WM_DISCOUNT_ATTRS = [
  { key:'title',                      label:'Title',            desc:'Discount title' },
  { key:'code_name',                  label:'Code name',        desc:'Discount code', mono:true },
  { key:'description',                label:'Description',      desc:'Discount description', wide:true },
  { key:'auto_apply',                 label:'Auto apply',       desc:'Whether the discount is automatically applied', bool:true },
  { key:'prerequisite_customer_type', label:'Customer type',    desc:'First time/returning customer eligibility requirements' },
  { key:'end_date',                   label:'End date',         desc:'Expiration date', mono:true },
  { key:'redemption_details',         label:'Redemption details', desc:'Redemption details', wide:true },
  { key:'legal_disclaimer',           label:'Legal disclaimer', desc:'Legal disclaimer', wide:true },
];

// Figures the business asks for that ApplicableDiscountAttributes does not
// publish. Listed rather than deleted BECAUSE they are wanted — but a number
// here would have no source, and a 0 would be a claim we cannot make.
const WM_NO_SOURCE = [
  'Discount amount or percent', 'Discount type (%, $, BOGO)', 'What it applies to (scope, targets, exclusions)',
  'Stacking rule and priority', 'Minimum spend or item count', 'Usage limit and per-customer cap',
  'Redemption count', 'Revenue and discount cost', 'ROI',
];

// Absent is its OWN value. It is not "No", it is not "" and it is not 0 —
// nothing in ApplicableDiscountAttributes is required, so absence is expected.
function wmPresent(attrs, k) {
  return attrs != null && Object.prototype.hasOwnProperty.call(attrs, k) && attrs[k] != null && attrs[k] !== '';
}
function wmAttr(attrs, spec) {
  if (!wmPresent(attrs, spec.key)) return null;          // null ⇒ render as absent
  return spec.bool ? (attrs[spec.key] ? 'Yes' : 'No') : String(attrs[spec.key]);
}
// Token match on prerequisite_customer_type, the ONE derivation the sibling
// repo sanctions (wmdemo/promos.py derive_first_timer). Casefolded whole-token,
// never a substring, and never invented when the attribute is absent.
function wmFirstTimer(prereq) {
  if (prereq == null || prereq === '') return null;
  return String(prereq).toLowerCase().split(/[^a-z0-9]+/).indexOf('first') !== -1;
}
function wmTitleOf(attrs, id) {
  if (wmPresent(attrs, 'title')) return { text: String(attrs.title), real:true };
  if (wmPresent(attrs, 'code_name')) return { text: String(attrs.code_name), real:true };
  return { text: id ? id : 'No title and no code on this element', real:false };
}
// `id` is OPTIONAL on ApplicableDiscount, which requires only `type` and
// `attributes`. An id-less discount must stay visibly id-less: keying it as the
// string "None" would collapse every id-less discount into one row.
function wmIdOf(inner) {
  const raw = inner && inner.id;
  return raw == null || String(raw).trim() === '' || String(raw) === 'None' ? null : String(raw);
}
const WM_SHAPE = {
  flat:       { label:'Flat element',   kind:'neutral', note:'data[i].attributes — the JSON:API convention.' },
  nested:     { label:'Nested element', kind:'info',    note:'data[i].data.attributes — the spec read literally.' },
  unreadable: { label:'Unreadable',     kind:'bad',     note:'Matched neither candidate shape. Nothing was parsed and nothing was guessed.' },
};
function wmListingName(id) {
  const l = Object.values(WM_LISTINGS || {}).filter((x) => x.id === id)[0];
  return l ? l.name + ' · ' + l.kind : id || null;
}
function wmMapPill(m) {
  if (m.state === 'mapped') return <Pill kind="good" dot>Mapped</Pill>;
  if (m.state === 'standalone') return <Pill kind="info" dot>Standalone</Pill>;
  return <Pill kind={m.overlap ? 'bad' : 'warn'} dot>Unmapped</Pill>;
}
function WmField({ label, value, mono, hint, wide }) {
  const P = useP();
  const absent = value == null;
  return <div style={{ display:'flex', flexDirection:'column', gap:2, minWidth:0, gridColumn: wide ? '1/-1' : 'auto' }}>
    <span style={{ fontSize: 10, fontWeight:700, letterSpacing:'.05em', textTransform:'uppercase', color:P.inkMute }}>{label}</span>
    <span style={{ fontSize: 12.5, color: absent ? P.inkFaint : P.ink, fontStyle: absent ? 'italic' : 'normal',
      fontFamily: absent ? P.fontSans : (mono ? P.fontMono : P.fontSans), wordBreak:'break-word' }}>
      {absent ? 'Not provided' : value}</span>
    {hint && <span style={{ fontSize:10.5, color:P.inkMute, lineHeight:1.4 }}>{hint}</span>}
  </div>;
}
function WmGroup({ title, sub, children }) {
  const P = useP();
  return <div>
    <div style={{ fontSize:10, fontWeight:800, letterSpacing:'.07em', textTransform:'uppercase', color:P.inkDim, marginBottom: sub ? 3 : 9 }}>{title}</div>
    {sub && <div style={{ fontSize:11, color:P.inkMute, lineHeight:1.45, marginBottom:9 }}>{sub}</div>}
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:'12px 16px' }}>{children}</div>
  </div>;
}
function WmPromoDetail({ p, onOpen, onOpenWm }) {
  const P = useP();
  const { inner, attrs, shape } = wmUnwrapDiscount(p.element);
  const sh = WM_SHAPE[shape];
  const wmId = wmIdOf(inner);
  const firstTimer = wmFirstTimer(attrs.prerequisite_customer_type);
  const mirror = p.mirror || {};

  return <div style={{ background:P.surface2, borderTop:`1px solid ${P.hairline2}`, padding:'16px 18px', display:'flex', flexDirection:'column', gap:18 }}>
    {shape === 'unreadable' &&
      <div style={{ background:P.surface, border:`1px solid ${P.hairline2}`, borderLeft:`3px solid ${P.bad}`, borderRadius:P.r10, padding:'11px 13px' }}>
        <div style={{ fontSize:11.5, fontWeight:800, letterSpacing:'.05em', textTransform:'uppercase', color:P.bad, marginBottom:4 }}>Element could not be read</div>
        <div style={{ fontSize:12.5, color:P.ink2, lineHeight:1.55 }}>{sh.note} The eight attributes below are shown as not provided because nothing was parsed — <b>not</b> because Weedmaps sent them empty.</div>
      </div>}

    <WmGroup title="From Weedmaps — ApplicableDiscountAttributes"
      sub="These eight are the whole of the published schema. None is required, so any may be absent — “Not provided” means the attribute did not arrive, which is different from an empty value and different from zero.">
      {WM_DISCOUNT_ATTRS.map((f) => (
        <WmField key={f.key} label={f.label} value={wmAttr(attrs, f)} mono={f.mono} wide={f.wide}
          hint={f.key === 'prerequisite_customer_type' && firstTimer != null
            ? 'Derived: ' + (firstTimer ? 'first-time customers' : 'not first-time only') + ' (token match on this field)'
            : undefined} />))}
    </WmGroup>

    <div style={{ background:P.surface, border:`1px solid ${P.hairline2}`, borderRadius:P.r10, padding:'12px 14px' }}>
      <div style={{ fontSize:10, fontWeight:800, letterSpacing:'.07em', textTransform:'uppercase', color:P.warn, marginBottom:4 }}>Not available from Weedmaps · {WM_NO_SOURCE.length} figures</div>
      <div style={{ fontSize:11.5, color:P.ink2, lineHeight:1.55, marginBottom:8 }}>
        Wanted by the business, and <b>not published</b> by <code>ApplicableDiscountAttributes</code>, which has no monetary field of any kind. These are listed rather than shown as numbers because we have no source for them — and <b>not</b> shown as 0, because 0 would be an answer.
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
        {WM_NO_SOURCE.map((n) => (
          <span key={n} style={{ fontSize:11, fontWeight:600, color:P.inkDim, background:P.surface2, border:`1px dashed ${P.hairline2}`, borderRadius:20, padding:'2px 9px' }}>{n}</span>))}
      </div>
    </div>

    <WmGroup title="Hyperwolf-side record" sub="Ours, not Weedmaps’. Never presented as discount data.">
      <WmField label="Discount id" value={wmId} mono
        hint={wmId ? undefined : '`id` is optional in the schema — this element genuinely has none'} />
      <WmField label="Element shape" value={sh.label} hint={sh.note} wide />
      <WmField label="Listing we polled" value={wmListingName(p.listing)} />
      <WmField label="Mirror state" value={mirror.state || null} />
      <WmField label="First seen by us" value={mirror.firstSeen || null} mono />
      <WmField label="Last seen by us" value={mirror.lastSeen || null} mono />
      <WmField label="Mapping" value={p.mapping.state} />
      <WmField label="Mapped to" value={p.mapping.internal || null} />
      <WmField label="Overlap with" value={p.mapping.overlap_with || null} />
    </WmGroup>

    {p.mapping.note && <div style={{ fontSize:11.5, color:P.inkDim, lineHeight:1.5, fontStyle:'italic' }}>{p.mapping.note}</div>}
    <div style={{ display:'flex', gap:6, flexWrap:'wrap', paddingTop:2 }}>
      <PBtn variant="secondary" size="sm" icon="eye" onClick={() => onOpenWm && onOpenWm(p)}>Open in builder (read-only)</PBtn>
      {p.mapping.state === 'mapped' ? <><PBtn variant="secondary" size="sm" onClick={() => onOpen && onOpen(p.mapping.internal_id)}>View internal promo</PBtn><PBtn variant="ghost" size="sm">Unlink</PBtn></> :
        <><PBtn variant="primary" size="sm">Link to an internal promo</PBtn><PBtn variant="secondary" size="sm">Merge into new promo</PBtn><PBtn variant="ghost" size="sm">Keep standalone</PBtn></>}
    </div>
  </div>;
}
function WmPromoTable({ onOpen, onOpenWm }) {
  const P = useP();
  const [open, setOpen] = React.useState(null);
  const rows = window.WM_PROMOS || [];
  // Every column is either one of the eight published attributes or a fact of
  // our own. The old Type / Discount / Scope / Redeemed columns are gone —
  // Weedmaps publishes no such field, so there was nothing behind them.
  const th = (t, ours) => <th style={{ textAlign:'left', padding:'9px 14px', fontSize:10, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:P.inkDim, borderBottom:`1px solid ${P.hairline2}`, whiteSpace:'nowrap' }}>
    {t}{ours && <span style={{ fontWeight:500, color:P.inkFaint, textTransform:'none', letterSpacing:0 }}> · ours</span>}</th>;
  const td = { padding:'12px 14px', borderTop:`1px solid ${P.hairline}`, verticalAlign:'middle' };
  return <div style={{ overflowX:'auto' }}>
    <table style={{ width:'100%', minWidth:900, borderCollapse:'collapse', fontSize:12.5 }}>
      <thead><tr style={{ background:P.surface2 }}>{th('Weedmaps promotion')}{th('Auto apply')}{th('Customer type')}{th('End date')}{th('Element shape', true)}{th('Listing', true)}{th('Mapping', true)}{th('')}</tr></thead>
      <tbody>
        {rows.map((p) => {
          const isOpen = open === p.row_id;
          const { inner, attrs, shape } = wmUnwrapDiscount(p.element);
          const sh = WM_SHAPE[shape];
          const wmId = wmIdOf(inner);
          const t = wmTitleOf(attrs, wmId);
          const cell = (v) => v == null
            ? <span style={{ color:P.inkFaint, fontStyle:'italic' }}>Not provided</span> : v;
          return <React.Fragment key={p.row_id}>
            <tr onClick={() => setOpen(isOpen ? null : p.row_id)} style={{ cursor:'pointer', background: isOpen ? P.surface2 : 'transparent' }}>
              <td style={td}>
                <div style={{ fontWeight:600, color: t.real ? P.ink : P.inkFaint, fontStyle: t.real ? 'normal' : 'italic' }}>{t.text}</div>
                <div style={{ fontSize:10, color:P.inkMute, fontFamily:P.fontMono }}>{wmId || 'no id on this element'}</div>
              </td>
              <td style={td}>{cell(wmAttr(attrs, { key:'auto_apply', bool:true }))}</td>
              <td style={td}>{cell(wmAttr(attrs, { key:'prerequisite_customer_type' }))}</td>
              <td style={{ ...td, fontFamily:P.fontMono, fontSize:11.5 }}>{cell(wmAttr(attrs, { key:'end_date' }))}</td>
              <td style={td}><Pill kind={sh.kind}>{sh.label}</Pill></td>
              <td style={{ ...td, fontSize:11.5, color:P.ink2 }}>{cell(wmListingName(p.listing))}</td>
              <td style={td}><div style={{ display:'flex', flexDirection:'column', gap:2 }}>{wmMapPill(p.mapping)}{p.mapping.internal && <span style={{ fontSize:10, color:P.inkMute, whiteSpace:'nowrap' }}>→ {p.mapping.internal}</span>}</div></td>
              <td style={{ ...td, textAlign:'right', color:P.inkMute }}><Icon name="chevron-down" size={15} stroke={2.2} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition:'transform .15s' }} /></td>
            </tr>
            {isOpen && <tr><td colSpan={8} style={{ padding:0 }}><WmPromoDetail p={p} onOpen={onOpen} onOpenWm={onOpenWm} /></td></tr>}
          </React.Fragment>;
        })}
        {rows.length === 0 && <tr><td colSpan={8} style={{ padding:34, textAlign:'center', color:P.inkMute }}>No Weedmaps discounts mirrored.</td></tr>}
      </tbody>
    </table>
  </div>;
}

// ── Our promotions ⇄ Weedmaps ───────────────────────────────────────────────
// The actual sync surface: every Hyperwolf promotion, what state it is in on
// Weedmaps, and the one button that changes it. Pushing writes the state back
// onto the promo, so the Studio and the dashboard see it too.
const WM_STATE = {
  synced: { label:'Synced', kind:'good', dot:true },
  syncing: { label:'Pushing…', kind:'info', dot:true },
  not_pushed: { label:'Not pushed', kind:'neutral' },
  paused: { label:'Paused on WM', kind:'warn', dot:true },
  overlap: { label:'Overlaps a WM promo', kind:'bad', dot:true },
  ended: { label:'Ended', kind:'neutral' } };

function OurPromosOnWm({ promos, setPromos, onOpen }) {
  const P = useP();
  const [busy, setBusy] = React.useState({});
  const stateOf = (p, i) => busy[p.id] || (p.wm && p.wm.state) || wmStateFor(p, i);
  const patch = (id, wm) => setPromos && setPromos((prev) => prev.map((x) => x.id === id ? { ...x, wm: { ...x.wm, ...wm } } : x));
  const stamp = () => new Date().toLocaleTimeString([], { hour:'numeric', minute:'2-digit' });
  const push = (p, next) => {
    setBusy((b) => ({ ...b, [p.id]: 'syncing' }));
    setTimeout(() => {
      setBusy((b) => {const n = { ...b };delete n[p.id];return n;});
      patch(p.id, { state: next, pushedAt: stamp(), wmId: (p.wm && p.wm.wmId) || 'wmp_' + String(p.id).replace(/\D/g, '').slice(-6).padStart(6, '0') });
    }, 900);
  };
  const th = (t, r) => <th style={{ textAlign: r ? 'right' : 'left', padding:'9px 14px', fontSize:10, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:P.inkDim, borderBottom:`1px solid ${P.hairline2}`, whiteSpace:'nowrap' }}>{t}</th>;
  const td = { padding:'11px 14px', borderTop:`1px solid ${P.hairline}`, verticalAlign:'middle' };

  return <div style={{ overflowX:'auto' }}>
    <table style={{ width:'100%', minWidth:860, borderCollapse:'collapse', fontSize:12.5 }}>
      <thead><tr style={{ background:P.surface2 }}>{th('Hyperwolf promotion')}{th('Runs on')}{th('Weedmaps ID')}{th('Sync state')}{th('Last push', true)}{th('')}</tr></thead>
      <tbody>
        {promos.map((p, i) => {
          const st = stateOf(p, i), m = WM_STATE[st] || WM_STATE.not_pushed;
          const live = p.status === 'active' || p.status === 'live';
          return <tr key={p.id}>
            <td style={td}>
              <div onClick={() => onOpen && onOpen(p.id)} style={{ fontWeight:600, color:P.ink, cursor:'pointer' }}>{p.name}</div>
              <div style={{ fontSize:10, color:P.inkMute, fontFamily:P.fontMono }}>{p.code || p.id}</div>
            </td>
            <td style={td}><div style={{ display:'flex', gap:5 }}>
              <Pill kind={live ? 'warn' : 'ghost'}>Pickup</Pill><Pill kind={live ? 'info' : 'ghost'}>Delivery</Pill>
            </div></td>
            <td style={{ ...td, fontFamily:P.fontMono, color: p.wm && p.wm.wmId ? P.ink2 : P.inkFaint }}>{p.wm && p.wm.wmId || '—'}</td>
            <td style={td}><Pill kind={m.kind} dot={m.dot}>{m.label}</Pill></td>
            <td style={{ ...td, textAlign:'right', fontFamily:P.fontMono, color:P.inkMute }}>{p.wm && p.wm.pushedAt || '—'}</td>
            <td style={{ ...td, textAlign:'right' }}>
              {st === 'syncing' ? <span style={{ fontSize:11.5, color:P.info, fontWeight:600 }}>Pushing…</span> :
              st === 'overlap' ? <PBtn variant="primary" size="xs" icon="shield" onClick={() => push(p, 'synced')}>Resolve &amp; push</PBtn> :
              st === 'not_pushed' ? <PBtn variant="accent" size="xs" icon="arrow-up" onClick={() => push(p, 'synced')}>Push to WM</PBtn> :
              st === 'paused' ? <PBtn variant="secondary" size="xs" icon="refresh" onClick={() => push(p, 'synced')}>Resume</PBtn> :
              st === 'ended' ? <span style={{ fontSize:11.5, color:P.inkFaint }}>—</span> :
              <div style={{ display:'inline-flex', gap:5 }}>
                <PBtn variant="secondary" size="xs" icon="refresh" onClick={() => push(p, 'synced')}>Re-sync</PBtn>
                <PBtn variant="ghost" size="xs" onClick={() => patch(p.id, { state:'paused' })}>Pause</PBtn>
              </div>}
            </td>
          </tr>;
        })}
        {promos.length === 0 && <tr><td colSpan={6} style={{ padding:34, textAlign:'center', color:P.inkMute }}>No promotions yet.</td></tr>}
      </tbody>
    </table>
  </div>;
}

window.WeedmapsView = function WeedmapsView({ promos = [], setPromos, onOpen, onOpenWm }) {
  const P = useP();
  const withWm = promos.map((p, i) => ({ p, state: p.wm && p.wm.state || wmStateFor(p, i) }));
  const synced = withWm.filter((x) => x.state === 'synced').length;
  const notPushed = withWm.filter((x) => x.state === 'not_pushed').length;

  const kpis = [
    { label:'Products mapped', value:`${WM_SYNC.productsMapped}/${WM_SYNC.productsTotal}`, sublabel:`${WM_SYNC.review} in review`, icon:'package' },
    { label:'Promos synced', value:`${synced}/${promos.length}`, sublabel:`${notPushed} not pushed`, icon:'gift' },
    { label:'WM orders today', value:pfmt.num(WM_SYNC.ordersToday), sublabel:'auto-routed', icon:'truck' },
    { label:'Push latency', value:`${WM_SYNC.p50}ms`, sublabel:`p95 ${WM_SYNC.p95}ms`, icon:'refresh' },
    { label:'Sync errors 60s', value:WM_SYNC.errors, sublabel:`reconcile ${WM_SYNC.lastReconcile}`, icon:'shield', accent:WM_SYNC.errors > 0 },
    { label:'API token', value:`${WM_SYNC.tokenDays}d`, sublabel:'auto-renews', icon:'clock' },
  ];

  return (
    <div style={{ maxWidth:1320, margin:'0 auto' }}>
      <SectionHead level={1} eyebrow="Channel" title="Weedmaps"
        subtitle="How Weedmaps plugs into Hyperwolf — orders, regions, drivers and promotions. Almost all of it runs in the background; you only step in when the logic can’t resolve something itself."
        action={<Pill kind="good" dot>Live · event-driven</Pill>} />

      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:12, marginBottom:22 }}>
        {kpis.map((k) => <KPI key={k.label} {...k} />)}
      </div>

      <div style={{ marginBottom:22 }}>
        <WmPanel title="Your promotions on Weedmaps" pad={0}
          sub={`Every Hyperwolf promotion and where it stands on the channel. Pushing sends the offer to both listings — it lands inside the five-second Draft window, so a cart being built right now picks it up.`}
          right={<div style={{ display:'flex', gap:6 }}><Pill kind="good" dot>{synced} synced</Pill><Pill kind="neutral">{notPushed} not pushed</Pill></div>}>
          <OurPromosOnWm promos={promos} setPromos={setPromos} onOpen={onOpen} />
        </WmPanel>
      </div>

      <div style={{ marginBottom:22 }}>
        <WmPanel title="How a Weedmaps order reaches a driver" sub="A customer’s cart on Weedmaps becomes a routed, driver-assigned order in seconds. Highlighted steps are where our logic decides who can fulfil it.">
          <WmOrderFlow />
          <div style={{ marginTop:14, display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={{ background:P.surface2, border:`1px solid ${P.hairline}`, borderRadius:P.r10, padding:'11px 13px' }}>
              <div style={{ fontSize: 11.5, fontWeight:800, letterSpacing:'.05em', textTransform:'uppercase', color:P.info, marginBottom:4 }}>Delivery orders</div>
              <div style={{ fontSize: 12.5, color:P.ink2, lineHeight:1.55 }}>Come from Weedmaps → we resolve <b>zip → region → one on-shift driver</b>, and only offer SKUs in that driver’s kit. The order binds to that driver.</div>
            </div>
            <div style={{ background:P.surface2, border:`1px solid ${P.hairline}`, borderRadius:P.r10, padding:'11px 13px' }}>
              <div style={{ fontSize: 11.5, fontWeight:800, letterSpacing:'.05em', textTransform:'uppercase', color:P.warn, marginBottom:4 }}>Pickup orders</div>
              <div style={{ fontSize: 12.5, color:P.ink2, lineHeight:1.55 }}>Also from Weedmaps, but fulfilled from <b>store on-hand stock</b> — no driver, no routing. The order binds to the <b>{WM_STORE.name}</b> store and is marked ready for pickup.</div>
            </div>
          </div>
        </WmPanel>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1.6fr 1fr', gap:16, marginBottom:22 }}>
        <WmPanel title="Regions → drivers → Weedmaps listing" sub="Each region maps to a set of zips and drivers. On-shift drivers’ kits decide what the Delivery listing can sell right now.">
          <WmRegionMap />
        </WmPanel>
        <WmPanel title="The two Weedmaps listings" sub="Same catalog, different availability rules.">
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {Object.values(WM_LISTINGS).map((l) => (
              <div key={l.id} style={{ border:`1px solid ${P.hairline2}`, borderLeft:`3px solid ${l.kind === 'Pickup' ? P.warn : P.info}`, borderRadius:P.r10, padding:'12px 14px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:3 }}>
                  <span style={{ fontSize: 13.5, fontWeight:700, color:P.ink }}>{l.name}</span>
                  <Pill kind={l.kind === 'Pickup' ? 'warn' : 'info'}>{l.kind}</Pill>
                </div>
                <div style={{ fontSize: 11.5, color:P.inkDim, fontFamily:P.fontMono, marginBottom:4 }}>wmid {l.id} · {l.policy}</div>
                <div style={{ fontSize:11.5, color:P.ink2, lineHeight:1.45 }}>{l.desc}</div>
              </div>))}
          </div>
        </WmPanel>
      </div>

      <div style={{ marginBottom:22 }}>
        <WmPanel title="What runs itself — and when we ask a human" sub="Mapping and routing are automated end-to-end. A person is only pulled in for the cases the logic can’t safely resolve.">
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', minWidth:680, borderCollapse:'collapse', fontSize:12.5 }}>
              <thead><tr style={{ background:P.surface2 }}>
                {['Area', 'How it works', 'Automatic', 'Needs a human'].map((h, i) => (
                  <th key={i} style={{ textAlign:'left', padding:'9px 14px', fontSize:10, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:P.inkDim, borderBottom:`1px solid ${P.hairline2}` }}>{h}</th>))}
              </tr></thead>
              <tbody>
                {WM_AUTOMATION.map((a) => (
                  <tr key={a.area}>
                    <td style={{ padding:'11px 14px', borderTop:`1px solid ${P.hairline}`, fontWeight:700, color:P.ink, whiteSpace:'nowrap' }}>{a.area}</td>
                    <td style={{ padding:'11px 14px', borderTop:`1px solid ${P.hairline}`, color:P.ink2, lineHeight:1.45 }}>{a.how}</td>
                    <td style={{ padding:'11px 14px', borderTop:`1px solid ${P.hairline}` }}><span style={{ display:'inline-flex', alignItems:'center', gap:6, color:P.good, fontWeight:600 }}><Icon name="check" size={13} stroke={2.6} />{a.auto}</span></td>
                    <td style={{ padding:'11px 14px', borderTop:`1px solid ${P.hairline}`, color:P.warn, fontWeight:600 }}>{a.human}</td>
                  </tr>))}
              </tbody>
            </table>
          </div>
        </WmPanel>
      </div>

      <div>
        <WmPanel title="Weedmaps discounts we mirror" sub="Whether mapped to one of ours, kept standalone, or unmapped and awaiting a decision. Open a row for the eight attributes Weedmaps actually publishes, which of them arrived, and the figures — revenue, ROI, discount amount — that it does not publish at all." pad={0}
          right={<div style={{ display:'flex', gap:6 }}><Pill kind="good" dot>{(window.WM_PROMOS||[]).filter(p=>p.mapping.state==='mapped').length} mapped</Pill><Pill kind="info" dot>{(window.WM_PROMOS||[]).filter(p=>p.mapping.state==='standalone').length} standalone</Pill><Pill kind="warn" dot>{(window.WM_PROMOS||[]).filter(p=>p.mapping.state==='unmapped').length} unmapped</Pill></div>}>
          <WmPromoTable onOpen={onOpen} onOpenWm={onOpenWm} />
        </WmPanel>
      </div>
    </div>);
};
