// ── Builder B · Step Wizard — one decision at a time, explained up front ────
const useP = window.useP;
const { RULE, toneColor } = window;

const WIZ_STEPS = [
  { id:'trigger', label:'Trigger', icon:'target', title:'What should this promotion watch?', explain:'Choose whether the promo reacts to the customer, a product, the whole cart, or a buy-one-get deal. This decides which conditions are available next.' },
  { id:'conditions', label:'Conditions', icon:'filter', title:'When exactly should it fire?', explain:'Add one or more conditions. The promo only triggers when they’re met. Combine them with AND (all must be true) or OR (any can be true).' },
  { id:'reward', label:'Reward', icon:'gift', title:'What does the customer get?', explain:'Pick the payoff — a discount on the item, a free product, or a discount on something else in the cart.' },
  { id:'schedule', label:'Schedule', icon:'calendar', title:'When is it live, and how often can it be used?', explain:'Set publish and expiry dates, whether it auto-applies, and any usage caps.' },
  { id:'review', label:'Review', icon:'check-circle', title:'Review & publish', explain:'Read the whole promotion back in plain English before it goes live.' },
];

window.BuilderWizard = function BuilderWizard({ draft, set, step, setStep }){
  const P = useP(); const rule = draft.rule;
  const setRule = (patch)=> set({ rule:{ ...rule, ...patch } });
  const S = WIZ_STEPS[step];

  const done = [ !!rule.entity, rule.conditions.length>0, !!rule.reward.id, true, false ];
  const canNext = done[step];

  const pickEntity = (eid)=>{ if(eid!==rule.entity) setRule({ entity:eid, group:null, conditions:[] }); };
  const addCond = (gid,cid)=> setRule({ group:gid, conditions:[...rule.conditions, window.condDefaults(rule.entity,gid,cid)] });
  const updateCond = (i,values)=>{ const cs=[...rule.conditions]; cs[i]={...cs[i],values}; setRule({ conditions:cs }); };
  const removeCond = (i)=> setRule({ conditions:rule.conditions.filter((_,j)=>j!==i) });

  return (
    <div style={{ display:'grid', gridTemplateColumns:'260px 1fr', minHeight:'calc(100vh - 60px - 53px)' }}>
      {/* STEP RAIL */}
      <div style={{ borderRight:`1px solid ${P.hairline2}`, padding:'28px 20px', background:P.surface2 }}>
        <Eyebrow style={{ marginBottom:18, paddingLeft:6 }}>New promotion</Eyebrow>
        <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
          {WIZ_STEPS.map((s,i)=>{ const a=i===step; const cpl=done[i]&&i<step; const reach=i<=step||done[i-1]; return (
            <button key={s.id} onClick={()=>reach&&setStep(i)} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 12px', background:a?P.surface:'transparent', border:`1px solid ${a?P.hairline2:'transparent'}`, borderRadius:P.r10, cursor:reach?'pointer':'default', textAlign:'left', opacity:reach?1:.45, transition:'all .12s' }}>
              <span style={{ width:26, height:26, borderRadius:99, flex:'0 0 auto', display:'flex', alignItems:'center', justifyContent:'center', background:a?P.ink:cpl?P.good:P.surface3, color:a||cpl?'#fff':P.inkDim, fontSize:12, fontWeight:700, fontFamily:P.fontMono }}>{cpl?<Icon name="check" size={14} stroke={3}/>:i+1}</span>
              <span style={{ flex:1 }}><span style={{ fontSize:13, fontWeight:600, color:a?P.ink:P.ink2, display:'block' }}>{s.label}</span></span>
            </button>); })}
        </div>
        <div style={{ marginTop:26 }}><LivePreview draft={draft} compact/></div>
      </div>

      {/* STEP BODY */}
      <div style={{ display:'flex', flexDirection:'column' }}>
        <div style={{ flex:1, padding:'34px 40px', maxWidth:780, overflowY:'auto' }}>
          {/* step explainer — the "know what it does in advance" fix */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
            <span style={{ fontSize:11, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:P.inkMute, fontFamily:P.fontMono }}>Step {step+1} of {WIZ_STEPS.length}</span>
          </div>
          <h1 style={{ margin:'0 0 10px', fontSize:26, fontWeight:700, color:P.ink, letterSpacing:'-.01em' }}>{S.title}</h1>
          <p style={{ margin:'0 0 26px', fontSize:14, lineHeight:1.6, color:P.inkDim, maxWidth:620 }}>{S.explain}</p>

          {step===0 && <EntityCards value={rule.entity} onPick={pickEntity} columns={2}/>}

          {step===1 && (rule.entity ? <div style={{ display:'flex', flexDirection:'column', gap:22 }}>
            {rule.conditions.length>0 && <Card padding={0} style={{ overflow:'hidden' }}>
              {rule.conditions.map((c,i)=>(
                <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 18px', borderTop:i?`1px solid ${P.hairline}`:'none' }}>
                  {i>0 ? <button onClick={()=>setRule({ combiner:rule.combiner==='AND'?'OR':'AND' })} style={{ width:44, fontSize:11, fontWeight:700, color:P.mode==='dark'?P.accent:'#8A6200', background:P.accentSoft, border:'none', borderRadius:6, padding:'3px 0', cursor:'pointer', fontFamily:P.fontMono, flex:'0 0 auto' }}>{rule.combiner}</button> : <span style={{ width:44, fontSize:11, fontWeight:700, color:P.inkMute, fontFamily:P.fontMono, flex:'0 0 auto', textAlign:'center' }}>IF</span>}
                  <span style={{ flex:1, fontSize:15 }}><b style={{ color:P.ink }}>{ {user:'the customer',product:'the product',cart:'the cart',bogo:'the customer'}[rule.entity] } </b><ClauseInline entityId={rule.entity} groupId={rule.group} cond={c} onChange={v=>updateCond(i,v)}/></span>
                  <IconBtn icon="trash" size={15} onClick={()=>removeCond(i)}/>
                </div>))}
            </Card>}
            <div>
              <Eyebrow style={{ marginBottom:12 }}>{rule.conditions.length?'Add another condition':'Choose a condition'}</Eyebrow>
              <ConditionMenu entityId={rule.entity} onPick={addCond} activeCondIds={rule.conditions.map(c=>c.condId)}/>
            </div>
          </div> : <EmptyHint text="Pick a trigger first — go back to Step 1."/>)}

          {step===2 && <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            <RewardPicker value={rule.reward.id} onPick={id=>setRule({ reward:window.rewardDefaults(id) })}/>
            {rule.reward.id && <Card padding={18} style={{ background:P.surface2 }}><Eyebrow style={{ marginBottom:10 }}>Fine-tune the reward</Eyebrow><span style={{ fontSize:16 }}><RewardInline reward={rule.reward} onChange={v=>setRule({ reward:{ ...rule.reward, values:v } })}/></span></Card>}
          </div>}

          {step===3 && <div style={{ display:'flex', flexDirection:'column', gap:24 }}><MetaFields draft={draft} set={set}/><div style={{ height:1, background:P.hairline }}/><ScheduleLimits draft={draft} set={set}/></div>}

          {step===4 && <ReviewStep draft={draft} setStep={setStep}/>}
        </div>

        {/* nav bar */}
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 40px', borderTop:`1px solid ${P.hairline2}`, background:P.surface }}>
          <PBtn variant="secondary" icon="chevron-left" onClick={()=>setStep(Math.max(0,step-1))} disabled={step===0}>Back</PBtn>
          <div style={{ flex:1 }}/>
          {!canNext && step<3 && <span style={{ fontSize:12, color:P.inkMute }}>{step===0?'Pick a trigger to continue':step===1?'Add at least one condition':'Choose a reward'}</span>}
          {step<WIZ_STEPS.length-1
            ? <PBtn variant="primary" iconRight="chevron-right" onClick={()=>setStep(step+1)} disabled={!canNext}>Next: {WIZ_STEPS[step+1].label}</PBtn>
            : <PBtn variant="accent" icon="check" onClick={()=>set({})}>Publish promotion</PBtn>}
        </div>
      </div>
    </div>);
};

function EmptyHint({ text }){ const P=useP(); return <div style={{ padding:'40px', textAlign:'center', color:P.inkMute, fontSize:13, border:`1px dashed ${P.hairline3}`, borderRadius:P.r12 }}>{text}</div>; }

function ReviewStep({ draft, setStep }){
  const P = useP(); const rule = draft.rule;
  const rows = [
    { label:'Name', value:draft.name||'Untitled', step:3 },
    { label:'Code', value:draft.auto?'Auto-applies (no code)':(draft.code||'—'), step:3 },
    { label:'Platform', value:draft.platform, step:3 },
    { label:'Live window', value:(draft.publishNow?'Now':draft.publishDate)+' → '+(draft.expiry?draft.expiryDate:'no expiry'), step:3 },
    { label:'Total limit', value:draft.totalLimit||'Unlimited', step:3 },
    { label:'Per customer', value:draft.userLimit||'Unlimited', step:3 },
  ];
  return (<div style={{ display:'flex', flexDirection:'column', gap:18 }}>
    <LivePreview draft={draft}/>
    <Card padding={0} style={{ overflow:'hidden' }}>
      {rows.map((r,i)=>(<div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 18px', borderTop:i?`1px solid ${P.hairline}`:'none' }}>
        <span style={{ width:120, fontSize:11, fontWeight:600, letterSpacing:'.06em', textTransform:'uppercase', color:P.inkMute }}>{r.label}</span>
        <span style={{ flex:1, fontSize:13.5, color:P.ink, fontWeight:500 }}>{r.value}</span>
        <button onClick={()=>setStep(r.step)} style={{ fontSize:11.5, color:P.info, background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>Edit</button>
      </div>))}
    </Card>
  </div>);
}
