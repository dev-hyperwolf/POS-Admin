// ── Builder A · Guided Sentence — refined inline-link approach ──────────────
const useP = window.useP;
const { RULE, ENTITIES, toneColor } = window;

window.BuilderSentence = function BuilderSentence({ draft, set }) {
  const P = useP();const rule = draft.rule;
  const setRule = (patch) => set({ rule: { ...rule, ...patch } });
  const [addOpen, setAddOpen] = React.useState(false);
  const addRef = React.useRef(null);

  const pickEntity = (eid) => {if (eid === rule.entity) return;setRule({ entity: eid, group: null, conditions: [] });setAddOpen(true);};
  const addCond = (gid, cid) => {setRule({ group: gid, conditions: [...rule.conditions, window.condDefaults(rule.entity, gid, cid)] });setAddOpen(false);};
  const updateCond = (i, values) => {const cs = [...rule.conditions];cs[i] = { ...cs[i], values };setRule({ conditions: cs });};
  const removeCond = (i) => setRule({ conditions: rule.conditions.filter((_, j) => j !== i) });
  const setReward = (id) => setRule({ reward: window.rewardDefaults(id) });
  const updateReward = (values) => setRule({ reward: { ...rule.reward, values } });

  const e = rule.entity && RULE.entity(rule.entity);
  const ec = e ? toneColor(P, e.tone) : P.ink;
  const subj = rule.entity ? { user: 'the customer', product: 'the product', cart: 'the cart', bogo: 'the customer' }[rule.entity] : '';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, padding: '26px 24px 60px', maxWidth: 1180, margin: '0 auto', alignItems: 'start' }}>
      {/* MAIN */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <MetaFields draft={draft} set={set} />

        {/* trigger */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}><StepDot n={1} /><span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>What triggers this promotion?</span><span style={{ fontSize: 12, color: P.inkMute }}>Pick what the rule looks at.</span></div>
          <EntityCards value={rule.entity} onPick={pickEntity} />
        </div>

        {/* sentence */}
        {e &&
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}><StepDot n={2} /><span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Build the rule</span><span style={{ fontSize: 12, color: P.inkMute }}>Reads like a sentence. Click any underlined value to change it.</span></div>
            <Card padding={0} style={{ overflow: 'hidden' }}>
              {/* WHEN */}
              <div style={{ padding: '20px 22px', fontSize: 16 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginRight: 8, verticalAlign: '2px' }}><span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em', color: ec, fontFamily: P.fontMono, background: ec + (P.mode === 'dark' ? '22' : '14'), padding: '3px 9px', borderRadius: 6 }}>WHEN</span></span>
                <span style={{ fontWeight: 700, color: P.ink }}>{subj}</span>
                {rule.conditions.length === 0 && <span style={{ color: P.inkMute }}> …</span>}
                {rule.conditions.map((c, i) =>
              <span key={i}>
                    {i > 0 && <button onClick={() => setRule({ combiner: rule.combiner === 'AND' ? 'OR' : 'AND' })} style={{ margin: '0 7px', padding: '2px 9px', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', color: P.mode === 'dark' ? P.accent : '#8A6200', background: P.accentSoft, border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: P.fontMono, verticalAlign: '2px' }} title="Toggle AND / OR">{rule.combiner}</button>}
                    {i === 0 && <span> </span>}
                    <ClauseInline entityId={rule.entity} groupId={rule.group} cond={c} onChange={(v) => updateCond(i, v)} />
                    <button onClick={() => removeCond(i)} title="Remove" style={{ marginLeft: 5, color: P.inkFaint, background: 'none', border: 'none', cursor: 'pointer', verticalAlign: '0px' }}><Icon name="x" size={13} stroke={2.2} /></button>
                  </span>)}
                {/* add condition */}
                <span style={{ display: 'inline-block', marginLeft: 8 }}>
                  <button ref={addRef} onClick={() => setAddOpen((o) => !o)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', fontSize: 12.5, fontWeight: 600, color: P.info, background: P.infoSoft, border: 'none', borderRadius: 99, cursor: 'pointer', verticalAlign: '2px' }}><Icon name="plus" size={13} stroke={2.4} />{rule.conditions.length ? 'and / or' : 'add a condition'}</button>
                  {addOpen && <AnchoredPopover anchorRef={addRef} onClose={() => setAddOpen(false)} width={580}>
                    <div style={{ padding: 18, overflowY: 'auto' }}>
                      <div style={{ fontSize: 12, color: P.inkDim, marginBottom: 14 }}>Pick a condition for <b style={{ color: P.ink }}>{e.label}</b>. Each shows what it does.</div>
                      <ConditionMenu entityId={rule.entity} onPick={addCond} activeCondIds={rule.conditions.map((c) => c.condId)} />
                    </div>
                  </AnchoredPopover>}
                </span>
              </div>
              {/* THEN */}
              <div style={{ padding: '18px 22px', borderTop: `1px solid ${P.hairline}`, background: P.surface2 }}>
                <div style={{ marginBottom: rule.reward.id ? 12 : 0 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em', color: P.mode === 'dark' ? P.accent : '#8A6200', fontFamily: P.fontMono, background: P.accentSoft, padding: '3px 9px', borderRadius: 6, marginRight: 10 }}>THEN</span>
                  <span style={{ fontSize: 13, color: P.inkDim }}>we reward the customer with…</span>
                </div>
                {rule.reward.id ?
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}><span style={{ fontSize: 16 }}><RewardInline reward={rule.reward} onChange={updateReward} /></span><button onClick={() => setReward(null)} style={{ fontSize: 11.5, color: P.info, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>change reward</button></div> :
              <RewardPicker value={rule.reward.id} onPick={setReward} />}
              </div>
            </Card>
          </div>}

        {/* schedule */}
        {e && rule.reward.id &&
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}><StepDot n={3} /><span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Schedule & limits</span></div>
            <Card padding={20}><ScheduleLimits draft={draft} set={set} /></Card>
          </div>}
      </div>

      {/* RAIL */}
      <div style={{ position: 'sticky', top: 78, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <LivePreview draft={draft} />
        <Card padding={16}>
          <Eyebrow style={{ marginBottom: 10 }}>Why this is easier</Eyebrow>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.6, color: P.inkDim }}>
            <li>Every option tells you what it does before you pick it.</li>
            <li>The rule reads as one plain sentence — no guessing what a step means.</li>
            <li>The live preview always shows the real-world effect.</li>
          </ul>
        </Card>
      </div>
    </div>);
};

window.StepDot = function StepDot({ n }) {
  const P = useP();
  return <span style={{ width: 22, height: 22, borderRadius: 99, background: P.ink, color: P.surface, fontSize: 11.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: P.fontMono, flex: '0 0 auto' }}>{n}</span>;
};