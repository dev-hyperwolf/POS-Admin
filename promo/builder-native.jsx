// ── Builder · Native offer editor — points / tiered / dollar / bundle ───────
//
// WHY THIS FILE EXISTS (2026-09-03 data-loss fix):
// The rule/condition/reward model in builder-core.jsx + pdata.jsx (ENTITIES,
// REWARDS) can only express "IF this condition THEN discount_self/free_product
// /discount_other" -- it has no slots for a points multiplier, a table of
// spend-tier breakpoints, a flat dollar amount, or a bundle's descriptive
// structure. Those four offer kinds have always had their OWN real field
// shape -- see `discount:{...}` on every promo in pweb/module.jsx's
// seedPromos() and the OFFERS list -- but the Builder never read or wrote
// that shape. Every open+save round-tripped the promo through
// pweb/merge.jsx's discountToRule()/ruleToOffer() bridge, which can only
// PRODUCE 'percent' | 'bogo' | 'gift', so any promo with kind 'points',
// 'tiered', 'dollar' or 'bundle' silently collapsed into a generic
// "spend $X, get %off" rule on the very first save. Confirmed live-tested
// tonight; this file plus the nativeOffer plumbing in pweb/merge.jsx and
// promo/builder-blocks.jsx is the fix: these four kinds are now edited
// directly against their real `discount` fields and never pass through the
// rule bridge at all.
const useP = window.useP;

const NATIVE_KIND_META = {
  points: { label: 'Points boost', icon: 'star', blurb: 'Multiplies loyalty points earned on qualifying orders.' },
  tiered: { label: 'Spend & save', icon: 'chart', blurb: 'Bigger discount at each spend breakpoint.' },
  dollar: { label: '$ off', icon: 'dollar', blurb: 'A fixed dollar amount off, optionally gated by a minimum spend.' },
  bundle: { label: 'Bundle', icon: 'package', blurb: 'A hand-described bundle deal (e.g. buy 2, get 1 half off).' },
};

// plain-English gloss for the preview strip — mirrors LivePreview's tone
// without pretending this is a rule (it isn't one).
function nativeOfferSentence(offer) {
  const scopeTxt = offer.scope === 'cart' ? 'the whole order' :
    (offer.items && offer.items.length) ? offer.items.join(', ') :
    offer.scope === 'category' ? 'a chosen category' :
    offer.scope === 'brand' ? 'a chosen brand' : 'the cart';
  switch (offer.kind) {
    case 'points':
      return { cond: `a customer's order includes ${scopeTxt}`, then: `award ${offer.value || 1}× loyalty points` };
    case 'dollar':
      return { cond: offer.min ? `a customer's order is $${offer.min}+ (${scopeTxt})` : `a customer orders ${scopeTxt}`, then: `take $${offer.value || 0} off` };
    case 'tiered':
      return { cond: `a customer's order crosses a spend tier`, then: (offer.tiers || []).length ? (offer.tiers || []).map((t) => `$${t.min}+ → ${t.value}% off`).join('  ·  ') : 'no tiers configured yet' };
    case 'bundle':
      return { cond: `a customer shops ${scopeTxt}`, then: offer.text || 'apply the bundle deal (describe it below)' };
    default:
      return { cond: '—', then: '—' };
  }
}

function NativeOfferPreview({ offer, draft }) {
  const P = useP();
  const plain = nativeOfferSentence(offer);
  const meta = NATIVE_KIND_META[offer.kind] || {};
  return (
    <div style={{ background: P.mode === 'dark' ? P.surface2 : '#15140F', color: P.mode === 'dark' ? P.ink : '#F4F2EC', borderRadius: P.r14, padding: '20px 22px', border: `1px solid ${P.mode === 'dark' ? P.hairline2 : 'transparent'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ width: 20, height: 20, borderRadius: 5, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="eye" size={12} stroke={2} /></span>
        <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: P.accent, fontFamily: P.fontMono }}>In plain English</span>
      </div>
      <div style={{ fontSize: 17, lineHeight: 1.6, fontWeight: 500 }}>
        <span style={{ color: P.accent, fontWeight: 700 }}>When </span>
        <span style={{ opacity: .95 }}>{plain.cond}, </span>
        <span style={{ color: P.accent, fontWeight: 700 }}>we'll </span>
        <span style={{ opacity: .95 }}>{plain.then}.</span>
      </div>
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${P.mode === 'dark' ? P.hairline : 'rgba(255,255,255,.12)'}`, fontSize: 12.5, lineHeight: 1.5, opacity: .62 }}>
        {meta.label || offer.kind} · {draft.auto ? 'Applies automatically at checkout' : 'Requires promo code ' + (draft.code || '—')} · {draft.name || 'Untitled promotion'}
      </div>
    </div>);
}

// ── tiers: the one field the dead screens.jsx Builder could show but never
// let anyone edit (it only rendered a joined summary string). Real add/edit/
// remove, kept sorted by spend so the table always reads low → high.
function TierEditor({ tiers, onChange }) {
  const P = useP();
  const rows = tiers && tiers.length ? tiers : [];
  const commit = (next) => onChange([...next].sort((a, b) => (a.min || 0) - (b.min || 0)));
  const upTier = (i, patch) => {const t = [...rows];t[i] = { ...t[i], ...patch };commit(t);};
  const removeTier = (i) => commit(rows.filter((_, j) => j !== i));
  const addTier = () => {
    const last = rows[rows.length - 1];
    commit([...rows, { min: (last ? last.min : 0) + 100, value: (last ? last.value : 0) + 10 }]);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.length === 0 && <div style={{ fontSize: 12.5, color: P.inkDim, fontStyle: 'italic' }}>No tiers yet — add at least one spend breakpoint.</div>}
      {rows.map((t, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: P.inkMute, fontFamily: P.fontMono, width: 16 }}>{i + 1}</span>
          <span style={{ fontSize: 12.5, color: P.ink2 }}>Spend</span>
          <Field mono size="sm" value={t.min} onChange={(e) => upTier(i, { min: Number(e.target.value) || 0 })} style={{ width: 100 }} suffix={<span style={{ fontSize: 12, color: P.inkMute, fontFamily: P.fontMono }}>$</span>} />
          <span style={{ fontSize: 12.5, color: P.ink2 }}>get</span>
          <Field mono size="sm" value={t.value} onChange={(e) => upTier(i, { value: Number(e.target.value) || 0 })} style={{ width: 90 }} suffix={<span style={{ fontSize: 12, color: P.inkMute, fontFamily: P.fontMono }}>%</span>} />
          <span style={{ fontSize: 12.5, color: P.ink2 }}>off</span>
          <IconBtn icon="trash" size={14} title="Remove tier" onClick={() => removeTier(i)} />
        </div>
      ))}
      <button onClick={addTier} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 7, padding: '9px 13px', background: 'transparent', border: `1.5px dashed ${P.hairline3}`, borderRadius: P.r10, cursor: 'pointer', color: P.info, fontSize: 12.5, fontWeight: 600, fontFamily: P.fontSans }}><Icon name="plus" size={14} stroke={2.2} />Add tier</button>
    </div>);
}

window.NativeOfferEditor = function NativeOfferEditor({ draft, set }) {
  const P = useP();
  // `Fld` and `Chip` are plain top-level function declarations in
  // pweb/module.jsx (not `window.X = ...`), so they only become real globals
  // the way a classic <script> tag would in a browser. Reach them through
  // window.PROMO (the module's actual exported surface, assembled at its own
  // end via Object.assign(window, {PROMO:{...}})) instead of a bare
  // reference, which is the reliable path either way.
  const { Fld, Chip } = window.PROMO;
  const offer = draft.nativeOffer;
  const meta = NATIVE_KIND_META[offer.kind] || { label: offer.kind, icon: 'tag', blurb: '' };
  const upOffer = (patch) => set({ nativeOffer: { ...offer, ...patch } });
  const scopeItems = offer.scope === 'brand' ? window.PROMO.BRANDS.map((b) => ({ v: b.id, l: b.name })) :
    offer.scope === 'category' ? window.PROMO.CATS.map((c) => ({ v: c, l: c })) : null;
  const toggleItem = (v) => {
    const items = offer.items || [];
    upOffer({ items: items.includes(v) ? items.filter((x) => x !== v) : [...items, v] });
  };

  return (
    <div style={{ padding: '22px 24px 40px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}><MetaFields draft={draft} set={set} /></div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '13px 15px', background: P.mode === 'dark' ? 'rgba(255,209,0,.08)' : '#FFF8DE', border: `1px solid ${P.mode === 'dark' ? 'rgba(255,209,0,.35)' : '#E8CE6B'}`, borderRadius: P.r14, marginBottom: 18 }}>
        <span style={{ flex: '0 0 auto', width: 34, height: 34, borderRadius: 9, background: P.surface, color: P.mode === 'dark' ? P.accent : '#8A6200', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={meta.icon} size={17} stroke={1.9} /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{meta.label} — native offer</div>
          <div style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.5, marginTop: 2 }}>{meta.blurb} This offer type has its own real fields (below) instead of the IF/THEN condition builder — editing here keeps its structure intact instead of collapsing it into a generic percent-off rule.</div>
        </div>
      </div>

      <Card padding={18} style={{ marginBottom: 16 }}>
        <Eyebrow style={{ marginBottom: 14 }}>The offer</Eyebrow>

        {offer.kind === 'points' &&
        <Fld label="Points multiplier" hint="× earned on qualifying orders">
            <Field mono value={offer.value ?? ''} onChange={(e) => upOffer({ value: Number(e.target.value) || 0 })} suffix={<span style={{ fontSize: 12.5, color: P.inkMute, fontFamily: P.fontMono }}>×</span>} style={{ width: 140 }} />
          </Fld>}

        {offer.kind === 'dollar' &&
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <Fld label="Amount off"><Field mono value={offer.value ?? ''} onChange={(e) => upOffer({ value: Number(e.target.value) || 0 })} suffix={<span style={{ fontSize: 12.5, color: P.inkMute, fontFamily: P.fontMono }}>$</span>} style={{ width: 140 }} /></Fld>
            <Fld label="Minimum spend" hint="optional"><Field mono placeholder="No minimum" value={offer.min ?? ''} onChange={(e) => upOffer({ min: e.target.value === '' ? undefined : Number(e.target.value) || 0 })} suffix={<span style={{ fontSize: 12.5, color: P.inkMute, fontFamily: P.fontMono }}>$</span>} style={{ width: 160 }} /></Fld>
          </div>}

        {offer.kind === 'tiered' &&
        <TierEditor tiers={offer.tiers} onChange={(tiers) => upOffer({ tiers })} />}

        {offer.kind === 'bundle' &&
        <Fld label="Offer description" hint="shown to customers"><Field placeholder="e.g. Buy 2 eighths, get a 3rd for half price" value={offer.text || ''} onChange={(e) => upOffer({ text: e.target.value })} /></Fld>}

        <div style={{ marginTop: 16 }}>
          <Fld label="Applies to">
            <Seg value={offer.scope || 'cart'} onChange={(v) => upOffer({ scope: v, items: [] })} options={[{ value: 'cart', label: 'Whole order' }, { value: 'category', label: 'Category' }, { value: 'brand', label: 'Brand' }]} />
          </Fld>
          {scopeItems && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>{scopeItems.map((it) => <Chip key={it.v} on={(offer.items || []).includes(it.v)} onClick={() => toggleItem(it.v)}>{it.l}</Chip>)}</div>}
        </div>
      </Card>

      <div style={{ marginBottom: 16 }}><NativeOfferPreview offer={offer} draft={draft} /></div>
      <Card padding={20}><Eyebrow style={{ marginBottom: 14 }}>Schedule & limits</Eyebrow><ScheduleLimits draft={draft} set={set} /></Card>
    </div>);
};
