// ── Builder core — shared rule state, preview, meta + schedule pieces ───────
const useP = window.useP;
const { RULE, ENTITIES, REWARDS, paramDefault, ruleToPlain, toneColor, PLATFORMS } = window;

// ── rule state helpers ──────────────────────────────────────────────────────
window.newRule = function newRule() {return { entity: null, group: null, conditions: [], combiner: 'AND', reward: { id: null, values: {} } };};
window.condDefaults = function condDefaults(eid, gid, cid) {const c = RULE.cond(eid, gid, cid);const values = {};(c?.params || []).forEach((p) => values[p.key] = paramDefault(p));return { condId: cid, values };};
window.rewardDefaults = function rewardDefaults(id) {const r = RULE.reward(id);const values = {};(r?.params || []).forEach((p) => values[p.key] = paramDefault(p));return { id, values };};

// blank promo draft
window.newDraft = function newDraft() {return { name: '', code: '', platform: 'Hyperwolf', status: 'active', auto: true, schedule: true, publishNow: false, expiry: true, publishDate: 'Jul 14, 2026 9:00 AM', expiryDate: 'Aug 14, 2026 9:00 AM', totalLimit: '', userLimit: '', rule: window.newRule() };};

// ── PERSISTENT PLAIN-ENGLISH PREVIEW ────────────────────────────────────────
// The heart of the redesign: a live, human sentence + a "so this means…" gloss.
window.LivePreview = function LivePreview({ draft, compact }) {
  const P = useP();const rule = draft.rule;
  const ready = rule.entity && rule.conditions.length && rule.reward.id;
  const plain = ready ? ruleToPlain(rule) : null;
  const c = rule.entity ? toneColor(P, RULE.entity(rule.entity).tone) : P.inkMute;
  const PARAM_PAL = ['#5BB8FF', '#FFC24D', '#57D28E', '#FF8A5C', '#B98CFF'];
  const colorizeParams = (text) => {const parts = String(text).replace(/%\s*%/g, '%').split(/(\$?\d[\d,]*\.?\d*%?)/g);let ci = 0;return parts.map((s, i) => /^\$?\d/.test(s) ? <span key={i} style={{ color: PARAM_PAL[ci++ % PARAM_PAL.length], fontWeight: 800 }}>{s}</span> : s);};
  return (
    <div style={{ background: P.mode === 'dark' ? P.surface2 : '#15140F', color: P.mode === 'dark' ? P.ink : '#F4F2EC', borderRadius: P.r14, padding: compact ? '16px 18px' : '20px 22px', border: `1px solid ${P.mode === 'dark' ? P.hairline2 : 'transparent'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ width: 20, height: 20, borderRadius: 5, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="eye" size={12} stroke={2} /></span>
        <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: P.accent, fontFamily: P.fontMono }}>In plain English</span>
      </div>
      {ready ? <>
        <div style={{ fontSize: compact ? 15 : 17, lineHeight: 1.6, fontWeight: 500 }}>
          <span style={{ color: c, fontWeight: 700 }}>When </span>
          <span style={{ opacity: .95 }}>{plain.subj} {colorizeParams(plain.cond)}, </span>
          <span style={{ color: P.accent, fontWeight: 700 }}>we’ll </span>
          <span style={{ opacity: .95 }}>{colorizeParams(plain.then)}.</span>
        </div>
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${P.mode === 'dark' ? P.hairline : 'rgba(255,255,255,.12)'}`, fontSize: 12.5, lineHeight: 1.5, opacity: .62 }}>
          {draft.auto ? 'Applies automatically at checkout' : 'Requires promo code ' + (draft.code || '—')} · {draft.name || 'Untitled promotion'}
        </div>
      </> : <div style={{ fontSize: 16, lineHeight: 1.6, opacity: .5 }}>Your promotion will read as a sentence here as you build it — pick a trigger, a condition, and a reward.</div>}
    </div>);
};

// Single or bulk unique promo-code generation
function CodeGen({ draft, set }) {
  const P = useP();
  const [open, setOpen] = React.useState(false);
  const [qty, setQty] = React.useState('');
  const rand = () => Math.random().toString(36).slice(2, 7).toUpperCase();
  const single = () => {set({ code: 'HW' + rand() });setOpen(false);};
  const bulk = (n) => {set({ code: `HW${rand()}-####`, codeBatch: n });setOpen(false);};
  return <span style={{ position: 'relative', display: 'inline-flex' }}>
    <button onClick={() => setOpen((o) => !o)} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11.5, fontWeight: 600, color: P.info, background: 'none', border: 'none', cursor: 'pointer', fontFamily: P.fontSans, whiteSpace: 'nowrap' }}>Generate<Icon name="chevron-down" size={11} stroke={2.2} /></button>
    {open && <>
      <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
      <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 250, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, boxShadow: P.shadowLg, zIndex: 61, padding: 12 }}>
        <button onClick={single} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 10px', background: 'transparent', border: `1px solid ${P.hairline2}`, borderRadius: P.r10, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans, marginBottom: 10 }}><Icon name="tag" size={14} color={P.ink2} /><span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink }}>One shared code</span></button>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 7 }}>Bulk unique codes</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 9 }}>{[100, 1000, 10000, 50000].map((n) => <button key={n} onClick={() => bulk(n)} style={{ fontSize: 11.5, fontWeight: 700, fontFamily: P.fontMono, color: P.ink2, background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: 99, padding: '4px 10px', cursor: 'pointer' }}>{n.toLocaleString()}</button>)}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" placeholder="Custom…" style={{ flex: 1, minWidth: 0, padding: '7px 10px', border: `1px solid ${P.hairline2}`, borderRadius: P.r8, background: P.field || P.surface, color: P.ink, fontSize: 12.5, fontFamily: P.fontMono, outline: 'none', boxSizing: 'border-box' }} />
          <button onClick={() => qty && bulk(+qty)} disabled={!qty} style={{ fontSize: 12.5, fontWeight: 700, color: qty ? P.accentInk : P.inkFaint, background: qty ? P.accent : P.surface3, border: 'none', borderRadius: P.r8, padding: '7px 12px', cursor: qty ? 'pointer' : 'default', fontFamily: P.fontSans }}>Generate</button>
        </div>
        <div style={{ fontSize: 10, color: P.inkDim, lineHeight: 1.5, marginTop: 9 }}>Bulk creates single-use unique codes from a pattern — downloadable as CSV on publish.</div>
      </div>
    </>}
  </span>;
}
// ── META header (name, code, platform, status) ─────────────────────────────
window.MetaFields = function MetaFields({ draft, set }) {
  const P = useP();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr auto', gap: 14, alignItems: 'end' }}>
      <div>
        <Eyebrow style={{ marginBottom: 7 }}>Promotion name</Eyebrow>
        <Field placeholder="e.g. Green Wednesday BOGO" value={draft.name} onChange={(e) => set({ name: e.target.value })} />
      </div>
      <div>
        <Eyebrow style={{ marginBottom: 7 }}>Promo code</Eyebrow>
        <Field placeholder="AUTO or CODE" value={draft.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} mono suffix={<CodeGen draft={draft} set={set} />} />
        {draft.codeBatch ? <div style={{ fontSize: 11.5, fontWeight: 600, color: P.info, marginTop: 5, fontFamily: P.fontMono }}>{draft.codeBatch.toLocaleString()} unique codes queued</div> : null}
      </div>
      <div>
        <Eyebrow style={{ marginBottom: 7 }}>Status</Eyebrow>
        <Seg value={draft.status} onChange={(v) => set({ status: v })} options={[{ value: 'active', label: 'Active' }, { value: 'draft', label: 'Draft' }]} />
      </div>
    </div>);
};

// ── SCHEDULE + LIMITS ───────────────────────────────────────────────────────
window.ScheduleLimits = function ScheduleLimits({ draft, set }) {
  const P = useP();
  const Row = ({ label, children }) => <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{children}<span style={{ fontSize: 13.5, color: P.ink2, fontWeight: 500 }}>{label}</span></div>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      <div>
        <Eyebrow style={{ marginBottom: 12 }}>Scheduling</Eyebrow>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Row label="Apply automatically (no code needed)"><Switch on={draft.auto} onChange={(v) => set({ auto: v })} /></Row>
          <Row label="Publish immediately"><Switch on={draft.publishNow} onChange={(v) => set({ publishNow: v })} /></Row>
          {!draft.publishNow && <div style={{ paddingLeft: 2 }}><Eyebrow style={{ marginBottom: 6, fontSize: 10 }}>Publish date</Eyebrow><Field icon="calendar" value={draft.publishDate} onChange={(e) => set({ publishDate: e.target.value })} size="sm" /></div>}
          <Row label="Set an expiry date"><Switch on={draft.expiry} onChange={(v) => set({ expiry: v })} /></Row>
          {draft.expiry && <div style={{ paddingLeft: 2 }}><Eyebrow style={{ marginBottom: 6, fontSize: 10 }}>Expiry date</Eyebrow><Field icon="calendar" value={draft.expiryDate} onChange={(e) => set({ expiryDate: e.target.value })} size="sm" /></div>}
        </div>
      </div>
      <div>
        <Eyebrow style={{ marginBottom: 12 }}>Usage limits</Eyebrow>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><Eyebrow style={{ marginBottom: 6, fontSize: 10 }}>Total uses (all customers)</Eyebrow><Field placeholder="Unlimited" value={draft.totalLimit} onChange={(e) => set({ totalLimit: e.target.value })} mono size="sm" /></div>
          <div><Eyebrow style={{ marginBottom: 6, fontSize: 10 }}>Uses per customer</Eyebrow><Field placeholder="Unlimited" value={draft.userLimit} onChange={(e) => set({ userLimit: e.target.value })} mono size="sm" /></div>
        </div>
      </div>
    </div>);
};

// ── shared: entity picker cards (used by sentence + wizard) ─────────────────
window.EntityCards = function EntityCards({ value, onPick, columns = 4 }) {
  const P = useP();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns},1fr)`, gap: 12 }}>
      {ENTITIES.map((e) => {const a = value === e.id;const c = toneColor(P, e.tone);return (
          <button key={e.id} onClick={() => onPick(e.id)} style={{ textAlign: 'left', padding: '16px', background: a ? c + (P.mode === 'dark' ? '22' : '14') : P.surface, border: `1.5px solid ${a ? c : P.hairline2}`, borderRadius: P.r12, cursor: 'pointer', transition: 'all .12s', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <span style={{ width: 36, height: 36, borderRadius: 9, background: a ? c : c + (P.mode === 'dark' ? '22' : '16'), color: a ? '#fff' : c, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={e.icon} size={19} stroke={1.9} /></span>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{e.label}</span>
          <span style={{ fontSize: 11.5, lineHeight: 1.45, color: P.inkDim }}>{e.blurb}</span>
        </button>);})}
    </div>);
};

// ── shared: reward picker (with hints) ──────────────────────────────────────
window.RewardPicker = function RewardPicker({ value, onPick }) {
  const P = useP();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {REWARDS.map((r) => {const a = value === r.id;return (
          <button key={r.id} onClick={() => onPick(r.id)} style={{ display: 'flex', alignItems: 'flex-start', gap: 13, textAlign: 'left', padding: '14px 16px', background: a ? P.accentSoft : P.surface, border: `1.5px solid ${a ? P.accentBorder : P.hairline2}`, borderRadius: P.r12, cursor: 'pointer', transition: 'all .12s' }}>
          <span style={{ width: 34, height: 34, borderRadius: 8, background: a ? P.accent : P.surface3, color: a ? P.accentInk : P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={r.icon} size={17} stroke={1.9} /></span>
          <span><span style={{ fontSize: 13.5, fontWeight: 600, color: P.ink, display: 'block', marginBottom: 3 }}>{r.label}</span><span style={{ fontSize: 12.5, color: P.inkDim, lineHeight: 1.4 }}>{r.hint}</span></span>
          {a && <span style={{ marginLeft: 'auto', color: P.ink }}><Icon name="check-circle" size={18} stroke={2} /></span>}
        </button>);})}
    </div>);
};

// ── shared: condition menu (grouped, with hints) ────────────────────────────
// Shows the entity's groups → conditions, each with a description so the user
// knows what it does BEFORE picking. This is the core UX fix.
window.ConditionMenu = function ConditionMenu({ entityId, onPick, activeCondIds = [] }) {
  const P = useP();const e = RULE.entity(entityId);if (!e) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {e.groups.map((g) =>
      <div key={g.id}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
            <Icon name={g.icon} size={14} stroke={1.9} color={P.inkMute} />
            <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkMute }}>{g.label}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {g.conditions.map((c) => {const used = activeCondIds.includes(c.id);return (
              <button key={c.id} disabled={used} onClick={() => onPick(g.id, c.id)} style={{ textAlign: 'left', padding: '11px 13px', background: used ? P.surface2 : P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, cursor: used ? 'default' : 'pointer', opacity: used ? .5 : 1, transition: 'all .12s' }} onMouseEnter={(ev) => !used && (ev.currentTarget.style.borderColor = P.hairline3)} onMouseLeave={(ev) => ev.currentTarget.style.borderColor = P.hairline2}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, display: 'block', marginBottom: 3 }}>{c.label}</span>
                <span style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.4 }}>{c.hint}</span>
              </button>);})}
          </div>
        </div>)}
    </div>);
};

// ── shared: editable clause (renders a condition as an inline sentence w/ slots)
window.ClauseInline = function ClauseInline({ entityId, groupId, cond, onChange }) {
  const P = useP();const cd = RULE.cond(entityId, groupId, cond.condId);if (!cd) return null;
  // split tmpl into text + {slot} tokens
  const parts = cd.tmpl.split(/(\{[^}]+\})/g).filter(Boolean);
  return <span style={{ lineHeight: 1.9 }}>{parts.map((part, i) => {
      const mt = part.match(/^\{([^}]+)\}$/);
      if (mt) {const p = cd.params.find((x) => x.key === mt[1]);if (!p) return part;return <SlotChip key={i} param={p} value={cond.values[p.key]} onChange={(v) => onChange({ ...cond.values, [p.key]: v })} />;}
      return <span key={i} style={{ color: P.ink2 }}>{part}</span>;
    })}</span>;
};

// ── shared: editable reward clause ──────────────────────────────────────────
window.RewardInline = function RewardInline({ reward, onChange }) {
  const P = useP();const r = RULE.reward(reward.id);if (!r) return null;
  const parts = r.tmpl.split(/(\{[^}]+\})/g).filter(Boolean);
  return <span style={{ lineHeight: 1.9 }}>{parts.map((part, i) => {
      const mt = part.match(/^\{([^}]+)\}$/);
      if (mt) {const p = r.params.find((x) => x.key === mt[1]);if (!p) return part;return <SlotChip key={i} param={p} value={reward.values[p.key]} onChange={(v) => onChange({ ...reward.values, [p.key]: v })} />;}
      return <span key={i} style={{ color: P.ink2 }}>{part}</span>;
    })}</span>;
};

// ── shared: builder chrome (paradigm switch + save bar) ─────────────────────
window.BuilderTopBar = function BuilderTopBar({ mode, setMode, onCancel, onSave, draft }) {
  const P = useP();
  const [wmOn, setWmOn] = React.useState(true);
  const [wmOpen, setWmOpen] = React.useState(false);
  const ro = draft && draft.wmReadonly;
  if (ro) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 24px', borderBottom: `1px solid ${P.hairline2}`, background: P.surface, position: 'sticky', top: 0, zIndex: 25 }}>
        <PBtn variant="ghost" icon="chevron-left" size="sm" onClick={onCancel}>Back</PBtn>
        <div style={{ width: 1, height: 22, background: P.hairline2 }} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 800, color: '#fff', background: '#1F5FC0', padding: '3px 9px', borderRadius: 99 }}><span style={{ width: 6, height: 6, borderRadius: 2, background: '#fff' }} />Weedmaps promotion</span>
        <span style={{ fontSize: 12.5, color: P.inkDim }}>{draft.name || 'Untitled'}</span>
        <div style={{ flex: 1 }} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: P.inkDim, fontFamily: P.fontMono }}><Icon name="lock" size={13} stroke={1.9} />Read-only</span>
        <PBtn variant="secondary" size="sm" icon="link">Open on Weedmaps</PBtn>
      </div>);
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 24px', borderBottom: `1px solid ${P.hairline2}`, background: P.surface, position: 'sticky', top: 0, zIndex: 25 }}>
      <PBtn variant="ghost" icon="chevron-left" size="sm" onClick={onCancel}>Cancel</PBtn>
      <div style={{ width: 1, height: 22, background: P.hairline2 }} />
      <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>New promotion</span>
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 12.5, color: P.inkDim }}>{draft.name || 'Untitled promotion'}</span>
      <PBtn variant="secondary" size="sm">Save draft</PBtn>
      <PBtn variant="accent" icon="check" size="sm" onClick={onSave}>Publish</PBtn>
    </div>);
};