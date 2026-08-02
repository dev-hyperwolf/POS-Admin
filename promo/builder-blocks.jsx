// ── Builder C · Visual Blocks — snap IF + THEN cards together ───────────────
const useP = window.useP;
const { RULE, ENTITIES, REWARDS, toneColor } = window;

window.BuilderBlocks = function BuilderBlocks({ draft, set }) {
  const P = useP();const rule = draft.rule;
  if (draft.wmReadonly) return <WmReadonlyView promo={draft.wm} />;
  const setRule = (patch) => set({ rule: { ...rule, ...patch } });
  const [palette, setPalette] = React.useState(false);
  const [drag, setDrag] = React.useState(null);

  const pickEntity = (eid) => {if (eid !== rule.entity) {setRule({ entity: eid, group: null, conditions: [] });setPalette(true);}};
  const addCond = (gid, cid) => {setRule({ group: gid, conditions: [...rule.conditions, window.condDefaults(rule.entity, gid, cid)] });setPalette(false);};
  const updateCond = (i, values) => {const cs = [...rule.conditions];cs[i] = { ...cs[i], values };setRule({ conditions: cs });};
  const removeCond = (i) => setRule({ conditions: rule.conditions.filter((_, j) => j !== i) });
  const reorder = (from, to) => {if (from === to || to < 0 || to >= rule.conditions.length) return;const cs = [...rule.conditions];const [x] = cs.splice(from, 1);cs.splice(to, 0, x);setRule({ conditions: cs });};

  const e = rule.entity && RULE.entity(rule.entity);
  const ec = e ? toneColor(P, e.tone) : P.ink;
  const subj = rule.entity ? { user: 'the customer', product: 'the product', cart: 'the cart', bogo: 'the customer' }[rule.entity] : '';

  return (
    <div style={{ padding: '22px 24px 40px', maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}><MetaFields draft={draft} set={set} /></div>

      {/* trigger chips as source blocks */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: P.inkMute, fontFamily: P.fontMono, marginRight: 4 }}>Trigger</span>
        {ENTITIES.map((en) => {const a = rule.entity === en.id;const c = toneColor(P, en.tone);return (
            <button key={en.id} onClick={() => pickEntity(en.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', background: a ? c : P.surface, color: a ? '#fff' : P.ink2, border: `1.5px solid ${a ? c : P.hairline2}`, borderRadius: 99, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: P.fontSans, transition: 'all .12s' }}><Icon name={en.icon} size={15} stroke={1.9} />{en.label}</button>);})}
      </div>

      {/* canvas: IF column → connector → THEN column */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 1fr', gap: 0, alignItems: 'start' }}>
        {/* IF */}
        <div style={{ background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, padding: 16, minHeight: 220 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', color: P.info, fontFamily: P.fontMono, background: P.infoSoft, padding: '4px 10px', borderRadius: 6 }}>IF</span><span style={{ fontSize: 12.5, color: P.inkDim }}>{e ? `all of these about ${subj}` : 'pick a trigger to start'}</span></div>
          {!e && <BlockGhost text="Choose a trigger above, then snap condition blocks here." />}
          {e && <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rule.conditions.map((c, i) => {const cd = RULE.cond(rule.entity, rule.group, c.condId);return (
                <div key={i}>
                {i > 0 && <div style={{ display: 'flex', justifyContent: 'center', margin: '2px 0' }}><button onClick={() => setRule({ combiner: rule.combiner === 'AND' ? 'OR' : 'AND' })} style={{ padding: '2px 12px', fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', color: P.mode === 'dark' ? P.accent : '#8A6200', background: P.accentSoft, border: 'none', borderRadius: 99, cursor: 'pointer', fontFamily: P.fontMono }}>{rule.combiner}</button></div>}
                <div draggable onDragStart={() => setDrag(i)} onDragOver={(ev) => ev.preventDefault()} onDrop={() => {reorder(drag, i);setDrag(null);}} style={{ background: P.surface, border: `1px solid ${P.hairline2}`, borderLeft: `3px solid ${ec}`, borderRadius: P.r12, padding: '13px 14px', opacity: drag === i ? .4 : 1, boxShadow: P.shadowSm }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Icon name="sort" size={14} stroke={1.9} color={P.inkFaint} style={{ cursor: 'grab' }} />
                    <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: P.inkMute, flex: 1 }}>{cd?.label}</span>
                    <IconBtn icon="trash" size={14} onClick={() => removeCond(i)} />
                  </div>
                  <div style={{ fontSize: 14 }}><b style={{ color: P.ink }}>{subj} </b><ClauseInline entityId={rule.entity} groupId={rule.group} cond={c} onChange={(v) => updateCond(i, v)} /></div>
                </div>
              </div>);})}
            {/* add block */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setPalette((o) => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '13px', background: 'transparent', border: `1.5px dashed ${P.hairline3}`, borderRadius: P.r12, cursor: 'pointer', color: P.info, fontSize: 12.5, fontWeight: 600, fontFamily: P.fontSans }}><Icon name="plus" size={15} stroke={2.2} />Add condition block</button>
              {palette && <>
                <div onClick={() => setPalette(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r14, boxShadow: P.shadowLg, zIndex: 61, padding: 16, maxHeight: 420, overflowY: 'auto' }}>
                  <ConditionMenu entityId={rule.entity} onPick={addCond} activeCondIds={rule.conditions.map((c) => c.condId)} />
                </div>
              </>}
            </div>
          </div>}
        </div>

        {/* connector */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 70 }}>
          <div style={{ display: 'flex', alignItems: 'center', color: rule.reward.id && rule.conditions.length ? P.accent : P.inkFaint }}>
            <div style={{ width: 24, height: 2, background: 'currentColor' }} />
            <Icon name="chevron-right" size={18} stroke={2.4} />
          </div>
        </div>

        {/* THEN */}
        <div style={{ background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, padding: 16, minHeight: 220 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', color: P.mode === 'dark' ? P.accent : '#8A6200', fontFamily: P.fontMono, background: P.accentSoft, padding: '4px 10px', borderRadius: 6 }}>THEN</span><span style={{ fontSize: 12.5, color: P.inkDim }}>reward the customer</span></div>
          {rule.reward.id ? (() => {const r = RULE.reward(rule.reward.id);return (
              <div style={{ background: P.surface, border: `1px solid ${P.accentBorder}`, borderLeft: `3px solid ${P.accent}`, borderRadius: P.r12, padding: '14px', boxShadow: P.shadowSm }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={r.icon} size={16} stroke={1.9} /></span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, flex: 1 }}>{r.label}</span>
                <button onClick={() => setRule({ reward: { id: null, values: {} } })} style={{ color: P.inkFaint, background: 'none', border: 'none', cursor: 'pointer' }}><Icon name="x" size={15} stroke={2.2} /></button>
              </div>
              <div style={{ fontSize: 14.5, lineHeight: 1.7 }}><RewardInline reward={rule.reward} onChange={(v) => setRule({ reward: { ...rule.reward, values: v } })} /></div>
            </div>);})() :
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {REWARDS.map((r) => <button key={r.id} onClick={() => setRule({ reward: window.rewardDefaults(r.id) })} style={{ display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left', padding: '12px 14px', background: P.surface, border: `1.5px dashed ${P.hairline3}`, borderRadius: P.r12, cursor: 'pointer', fontFamily: P.fontSans }}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: P.surface3, color: P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={r.icon} size={16} stroke={1.9} /></span>
                  <span><span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, display: 'block', marginBottom: 2 }}>{r.label}</span><span style={{ fontSize: 11, color: P.inkDim }}>{r.hint}</span></span>
                </button>)}
              </div>}
        </div>
      </div>

      {/* summary bar */}
      <div style={{ marginTop: 20 }}><LivePreview draft={draft} compact /></div>
      <div style={{ marginTop: 16 }}><Card padding={20}><Eyebrow style={{ marginBottom: 14 }}>Schedule & limits</Eyebrow><ScheduleLimits draft={draft} set={set} /></Card></div>
      <div style={{ marginTop: 16 }}><WmChannelCard draft={draft} /></div>
    </div>);
};

function WmChannelCard({ draft }) {
  const P = useP();
  const [on, setOn] = React.useState(true);
  const params = [['WM promo name', draft.name || 'Untitled promotion'], ['external_id', draft.code ? 'HW-' + draft.code : 'HW-AUTO'], ['Pickup listing', '342170487 · live'], ['Delivery listing', '342170912 · live'], ['Menu item', 'active'], ['Price on WM', 'synced from POS'], ['Mapping', 'auto-matched']];
  return <Card padding={0}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 18px', borderBottom: `1px solid ${P.hairline}` }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 800, color: '#fff', background: '#1F5FC0', padding: '2px 8px', borderRadius: 99 }}><span style={{ width: 6, height: 6, borderRadius: 2, background: '#fff' }} />Weedmaps</span>
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Weedmaps channel</div><div style={{ fontSize: 11, color: P.inkDim }}>Params fetched from Weedmaps for this promotion · updated 2m ago</div></div>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: on ? P.good : P.inkMute }}>{on ? 'Publishing' : 'Off'}</span>
      <button onClick={() => setOn((v) => !v)} style={{ position: 'relative', width: 42, height: 24, borderRadius: 99, border: 'none', cursor: 'pointer', background: on ? P.good : P.hairline3, transition: 'background .15s', flex: '0 0 auto' }}><span style={{ position: 'absolute', top: 2.5, left: on ? 21 : 2.5, width: 19, height: 19, borderRadius: 99, background: '#fff', transition: 'left .15s', boxShadow: '0 1px 2px rgba(0,0,0,.3)' }} /></button>
    </div>
    <div style={{ padding: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '12px 18px' }}>
      {params.map(([k, v]) => <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}><span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute }}>{k}</span><span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, fontFamily: P.fontMono }}>{v}</span></div>)}
    </div>
    <div style={{ padding: '0 18px 16px', fontSize: 11, color: P.inkDim, lineHeight: 1.5 }}>These come from the Weedmaps API for this promotion. Pricing &amp; availability flow <b style={{ color: P.ink2 }}>POS → Weedmaps</b>.</div>
  </Card>;
}

function BlockGhost({ text }) {const P = useP();return <div style={{ padding: '36px 20px', textAlign: 'center', color: P.inkMute, fontSize: 12.5, lineHeight: 1.5, border: `1.5px dashed ${P.hairline3}`, borderRadius: P.r12 }}>{text}</div>;}

// ── Read-only view of a Weedmaps-sourced promotion ──────────────────────────
// WM's promotions API is read-only for partners — we fetch & inspect a WM promo
// and show how it translates into our schema, but can't push edits back.
function WmReadonlyView({ promo }) {
  const P = useP();
  const p = promo || {};
  const cents = (c) => c == null ? '—' : '$' + (c / 100).toLocaleString('en-US', { maximumFractionDigits: 0 });
  const yn = (b) => b ? 'Yes' : 'No';
  const arr = (a) => a && a.length ? a.join(', ') : '—';
  const val = (v) => v == null || v === '' ? '—' : v;
  const scopeTxt = p.scope === 'cart' ? 'the whole order' : p.scope === 'category' ? `any ${arr(p.targets)} item` : p.scope === 'brand' ? arr(p.targets) : val(p.scope);
  const applyTxt = p.apply === 'automatic' || !p.code ? 'automatically at checkout' : `with code ${p.code}`;
  const disc = p.display || `${p.discount_value}${p.discount_unit}`;
  const map = p.mapping || {};

  const Field = ({ label, value, mono }) =>
  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: P.inkMute }}>{label}</span>
      <span style={{ fontSize: 12, color: P.ink, fontFamily: mono ? P.fontMono : P.fontSans, wordBreak: 'break-word' }}>{value}</span>
    </div>;
  const Group = ({ title, children }) =>
  <div><div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkDim, marginBottom: 9 }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: '12px 16px' }}>{children}</div></div>;

  const mapRows = [
  ['promo_type', p.promo_type, 'Reward type', { percentage: '% off', dollar: '$ off', bogo: 'BOGO', bundle: 'Bundle', gift: 'Free gift' }[p.promo_type] || p.promo_type],
  ['discount_value + unit', `${p.discount_value}${p.discount_unit}`, 'Reward value', disc],
  ['scope + targets', `${val(p.scope)} · ${arr(p.targets)}`, 'Condition', p.scope === 'cart' ? 'Whole order' : `${p.scope}: ${arr(p.targets)}`],
  ['apply / code', p.apply + (p.code ? ` · ${p.code}` : ''), 'Trigger', p.apply === 'automatic' || !p.code ? 'Auto-apply' : 'Promo code'],
  ['min_spend', cents(p.min_spend_cents) !== '—' ? cents(p.min_spend_cents) : p.min_spend ? '$' + p.min_spend : '$0', 'Cart minimum', p.min_spend || p.min_spend_cents ? 'Min spend condition' : 'None'],
  ['stackable', yn(p.stackable), 'Stacking rule', p.stackable ? 'Stacks with others' : 'Exclusive'],
  ['start / end', `${val(p.start)} → ${val(p.end)}`, 'Schedule', p.recurrence && p.recurrence !== 'none' ? p.recurrence : 'Fixed window'],
  ['external_id', val(p.external_id), 'Link key', map.state === 'mapped' ? `Mapped → ${map.internal}` : 'Unmapped']];


  return (
    <div style={{ padding: '22px 24px 48px', maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* read-only banner */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '13px 15px', background: P.mode === 'dark' ? 'rgba(31,95,192,.10)' : '#eaf1fb', border: '1px solid #1F5FC0', borderRadius: P.r14 }}>
        <span style={{ flex: '0 0 auto', width: 34, height: 34, borderRadius: 9, background: P.surface, color: '#1F5FC0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="lock" size={17} stroke={1.9} /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: P.ink }}>Read-only — synced from Weedmaps</div>
          <div style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.5, marginTop: 2 }}>This promotion was fetched from the Weedmaps promotions API, which is <b style={{ color: P.ink2 }}>read-only</b> for partners. Inspect how it’s built and how it maps to our schema here — to change it, edit it in Weedmaps and it re-syncs. To run an equivalent you control, rebuild it as a Hyperwolf promotion.</div>
        </div>
      </div>

      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.02em', color: P.ink }}>{val(p.name)}</div>
          <div style={{ fontSize: 11, color: P.inkMute, fontFamily: P.fontMono }}>{val(p.wm_id)} · created via {val(p.created_source)} · last synced {val(p.last_synced)}</div>
        </div>
        {window.wmSyncPill ? window.wmSyncPill(p.status === 'live' ? 'synced' : 'synced') : null}
        <Pill kind={map.state === 'mapped' ? 'good' : map.state === 'standalone' ? 'info' : 'warn'} dot>{map.state === 'mapped' ? 'Mapped to a promo' : map.state === 'standalone' ? 'Standalone' : 'Unmapped'}</Pill>
      </div>

      {/* plain-English translation */}
      <div style={{ background: P.mode === 'dark' ? P.surface2 : '#15140F', color: P.mode === 'dark' ? P.ink : '#F4F2EC', borderRadius: P.r14, padding: '18px 20px', border: `1px solid ${P.mode === 'dark' ? P.hairline2 : 'transparent'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
          <span style={{ width: 20, height: 20, borderRadius: 5, background: '#1F5FC0', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="eye" size={12} stroke={2} /></span>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#6ea8f0', fontFamily: P.fontMono }}>How it reads</span>
        </div>
        <div style={{ fontSize: 16, lineHeight: 1.6, fontWeight: 500 }}>
          <span style={{ color: '#6ea8f0', fontWeight: 700 }}>When </span>a customer’s order includes {scopeTxt}{p.min_spend || p.min_spend_cents ? ` and they spend ${p.min_spend ? '$' + p.min_spend : cents(p.min_spend_cents)}+` : ''}, <span style={{ color: '#6ea8f0', fontWeight: 700 }}>Weedmaps applies </span>{disc} {applyTxt}.
        </div>
        <div style={{ marginTop: 13, paddingTop: 12, borderTop: `1px solid ${P.mode === 'dark' ? P.hairline : 'rgba(255,255,255,.12)'}`, fontSize: 12, opacity: .62 }}>{p.stackable ? 'Stacks with other offers' : 'Does not stack'} · priority {val(p.priority)} · {arr(p.wm_menu_ids) !== '—' ? `${(p.wm_menu_ids || []).length} WM menu(s)` : 'all menus'}</div>
      </div>

      {/* WM → Hyperwolf mapping */}
      <Card padding={0}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${P.hairline}` }}><div style={{ fontSize: 13, fontWeight: 700, color: P.ink }}>Weedmaps → Hyperwolf mapping</div><div style={{ fontSize: 11.5, color: P.inkDim, marginTop: 1 }}>How each Weedmaps field translates into our promotion schema.</div></div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ background: P.surface2 }}>{['Weedmaps field', 'Value', 'Our field', 'Maps to'].map((h, i) => <th key={i} style={{ textAlign: 'left', padding: '8px 14px', fontSize: 9.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkDim, borderBottom: `1px solid ${P.hairline2}` }}>{h}</th>)}</tr></thead>
            <tbody>{mapRows.map((r, i) =>
              <tr key={i}>
                <td style={{ padding: '9px 14px', borderTop: `1px solid ${P.hairline}`, fontFamily: P.fontMono, color: P.ink2 }}>{r[0]}</td>
                <td style={{ padding: '9px 14px', borderTop: `1px solid ${P.hairline}`, fontFamily: P.fontMono, color: P.ink, fontWeight: 600 }}>{val(r[1])}</td>
                <td style={{ padding: '9px 14px', borderTop: `1px solid ${P.hairline}`, color: P.inkDim }}><Icon name="arrow-right" size={12} color={P.inkFaint} style={{ marginRight: 6, verticalAlign: 'middle' }} />{r[2]}</td>
                <td style={{ padding: '9px 14px', borderTop: `1px solid ${P.hairline}`, color: P.ink, fontWeight: 600 }}>{val(r[3])}</td>
              </tr>)}</tbody>
          </table>
        </div>
      </Card>

      {/* full WM parameters (read-only) */}
      <Card padding={18}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Group title="Offer">
            <Field label="Promo type" value={val(p.promo_type)} />
            <Field label="Display" value={val(p.display)} />
            <Field label="Discount value" value={`${p.discount_value}${p.discount_unit}`} />
            <Field label="Applies" value={val(p.apply)} />
            <Field label="Code" value={val(p.code)} mono />
            <Field label="Stackable" value={yn(p.stackable)} />
            <Field label="Priority" value={val(p.priority)} />
            <Field label="Max discount" value={cents(p.max_discount_cents)} />
          </Group>
          <Group title="Targeting & eligibility">
            <Field label="Scope" value={val(p.scope)} />
            <Field label="Targets" value={arr(p.targets)} />
            <Field label="Excludes" value={arr(p.excludes)} />
            <Field label="Customer segment" value={val(p.customer_segment)} />
            <Field label="New-customer only" value={yn(p.new_customer_only)} />
            <Field label="Min spend" value={p.min_spend ? '$' + p.min_spend : cents(p.min_spend_cents)} />
            <Field label="Min items" value={val(p.min_items)} />
            <Field label="Usage limit" value={val(p.usage_limit)} />
          </Group>
          <Group title="Schedule & sync">
            <Field label="Status" value={val(p.status)} />
            <Field label="Start" value={val(p.start)} mono />
            <Field label="End" value={val(p.end)} mono />
            <Field label="Recurrence" value={val(p.recurrence)} />
            <Field label="external_id" value={val(p.external_id)} mono />
            <Field label="Weedmaps id" value={val(p.wm_id)} mono />
            <Field label="Redemptions" value={val(p.redemptions)} />
            <Field label="Revenue" value={cents(p.revenue_cents)} />
          </Group>
        </div>
      </Card>
    </div>);
}