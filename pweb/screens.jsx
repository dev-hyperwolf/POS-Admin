// ── Promotions Module — screens + shell + app root ──────────────────────────
const useP = window.useP;
const useTheme = window.useTheme;
const { useState, useMemo, useEffect, useRef } = React;
const PM = window.PROMO;
const { SURFACES, surfaceMeta, statusMeta, offerLabel, scheduleLabel, audienceLabel,
        REGIONS, BRANDS, CATS, CAMPAIGNS, OFFERS, HOLIDAYS, money, kd, num, fmtDate, TODAY, pd, DOW,
        Fld, TextArea, DateInput, Chip, ColorSwatch, SurfaceRender, offerBadge } = PM;

// ── Rail ────────────────────────────────────────────────────────────────────
const NAV = [
  {id:'register', label:'Register', icon:'register'},
  {id:'orders',   label:'Orders',   icon:'board', badge:4},
  {id:'catalog',  label:'Catalog',  icon:'package'},
  {id:'members',  label:'Members',  icon:'users'},
  {id:'promotions', label:'Promos', icon:'tag'},
];
function Rail(){
  const P=useP();
  const Item=({item})=>{
    const a=item.id==='promotions'; const [h,setH]=useState(false);
    return (<button onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} style={{ position:'relative', width:'100%', display:'flex', flexDirection:'column', alignItems:'center', gap:5, padding:'12px 4px', background:a?P.railActive:h?P.railHover:'transparent', color:a?P.railBright:P.railInk, border:'none', borderRadius:P.r12, cursor:'pointer', transition:'background .12s,color .12s', fontFamily:P.fontSans }}>
      {a && <span style={{ position:'absolute', left:-9, top:'50%', transform:'translateY(-50%)', width:3, height:22, background:P.accent, borderRadius:99 }}/>}
      <span style={{ position:'relative' }}><Icon name={item.icon} size={21} stroke={a?1.9:1.7}/>{item.badge && <span style={{ position:'absolute', top:-6, right:-9, minWidth:15, height:15, padding:'0 3px', background:P.accent, color:P.accentInk, borderRadius:99, fontSize: 10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:P.fontMono }}>{item.badge}</span>}</span>
      <span style={{ fontSize:10, fontWeight:a?600:500 }}>{item.label}</span>
    </button>);
  };
  return (<aside style={{ width:78, flex:'0 0 78px', background:P.rail, display:'flex', flexDirection:'column', alignItems:'center', padding:'14px 9px 12px', gap:4 }}>
    <div style={{ width:38, height:38, borderRadius:10, background:P.accent, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:10 }}><Icon name="logo-w" size={24} color={P.accentInk}/></div>
    <div style={{ display:'flex', flexDirection:'column', gap:4, width:'100%' }}>{NAV.map(i=><Item key={i.id} item={i}/>)}</div>
    <div style={{ flex:1 }}/>
    <div style={{ width:'100%' }}><Item item={{id:'settings', label:'Settings', icon:'settings'}}/></div>
  </aside>);
}

// ── Top bar ──────────────────────────────────────────────────────────────────
function TopBar(){
  const P=useP(); const {mode,toggle}=useTheme();
  return (<header style={{ height:60, flex:'0 0 60px', display:'flex', alignItems:'center', gap:12, padding:'0 18px', background:P.surface, borderBottom:`1px solid ${P.hairline2}`, position:'relative', zIndex:30 }}>
    <button style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 11px', background:P.surface2, border:`1px solid ${P.hairline2}`, borderRadius:P.r10, cursor:'pointer', fontFamily:P.fontSans }}>
      <span style={{ width:7, height:7, borderRadius:99, background:P.good }}/>
      <span style={{ fontSize:12.5, fontWeight:700, color:P.ink, fontFamily:P.fontMono }}>ALL STORES</span>
      <Icon name="chevron-down" size={14} stroke={2} color={P.inkMute}/>
    </button>
    <div style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'6px 11px', borderRadius:P.r999, background:P.accentSoft, border:`1px solid ${P.accentBorder}` }}>
      <Icon name="link" size={13} color={P.mode==='dark'?P.accent:'#7A5A00'}/>
      <span style={{ fontSize: 11.5, fontWeight:700, color:P.mode==='dark'?P.accent:'#7A5A00' }}>Banners · Points · Catalog connected</span>
    </div>
    <div style={{ flex:1 }}/>
    <IconBtn icon="search" title="Search (⌘K)"/>
    <IconBtn icon="bell" badge={true} badgeColor={P.warn} title="Alerts"/>
    <button onClick={toggle} title="Toggle theme" style={{ width:38, height:38, display:'inline-flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'none', borderRadius:P.r10, color:P.ink2, cursor:'pointer' }}><Icon name={mode==='light'?'moon':'sun'} size={18} stroke={1.9}/></button>
    <div style={{ width:1, height:26, background:P.hairline2, margin:'0 2px' }}/>
    <button style={{ display:'flex', alignItems:'center', gap:9, padding:'4px 8px 4px 4px', background:'transparent', border:'none', borderRadius:P.r10, cursor:'pointer' }}>
      <Avatar name="Manisha Saini" size={32}/>
      <span style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', lineHeight:1.2 }}><span style={{ fontSize:12.5, fontWeight:600, color:P.ink }}>Manisha Saini</span><span style={{ fontSize: 11.5, color:P.inkDim }}>Marketing</span></span>
      <Icon name="chevron-down" size={13} stroke={2} color={P.inkMute}/>
    </button>
  </header>);
}

// ── Surfaces summary (tiny icon cluster) ─────────────────────────────────────
function SurfaceDots({ ids }){
  const P=useP();
  return (<div style={{ display:'flex', alignItems:'center', gap:4 }}>
    {(ids||[]).slice(0,4).map(id=>{ const s=surfaceMeta(id); return (<span key={id} title={s.label} style={{ width:24, height:24, borderRadius:7, background:P.surface3, border:`1px solid ${P.hairline2}`, display:'flex', alignItems:'center', justifyContent:'center', color:P.ink2 }}><Icon name={s.icon} size={13} stroke={1.8}/></span>); })}
    {(ids||[]).length>4 && <span style={{ fontSize: 11.5, color:P.inkMute, fontFamily:P.fontMono }}>+{ids.length-4}</span>}
  </div>);
}

// ── Dashboard / list ─────────────────────────────────────────────────────────
function Dashboard({ promos, onOpen, onNew, onAnalytics, onDuplicate }){
  const P=useP();
  const [tab,setTab]=useState('all');
  const [q,setQ]=useState('');
  const [groupBy,setGroupBy]=useState('none');
  const counts=useMemo(()=>{ const c={all:promos.length,live:0,scheduled:0,ended:0,paused:0,draft:0}; promos.forEach(p=>c[p.status]++); return c; },[promos]);
  const rows=promos.filter(p=>(tab==='all'||p.status===tab) && (!q || (p.name+p.code).toLowerCase().includes(q.toLowerCase())));

  const live=promos.filter(p=>p.status==='live');
  const redempt=promos.reduce((a,p)=>a+(p.perf?.redemptions||0),0);
  const rev=promos.reduce((a,p)=>a+(p.perf?.revenue||0),0);
  const pts=promos.reduce((a,p)=>a+(p.perf?.pointsIssued||0),0);
  const surfCount=new Set(live.flatMap(p=>p.surfaces)).size;

  const conn=[
    {icon:'flag', title:'Smart Banners', sub:`${live.length} promos auto-publishing to ${surfCount} surfaces`, tag:'Live sync'},
    {icon:'star', title:'Points & Rewards', sub:`${promos.filter(p=>p.rewards?.pointsMult>1||p.rewards?.redeemable||p.rewards?.wallet).length} promos wired to the points ledger`, tag:'Connected'},
    {icon:'package', title:'Catalog', sub:`Matched to ${BRANDS.length} brands · ${CATS.length} categories`, tag:'Connected'},
  ];
  const cols=[
    { label:'Promotion', render:p=>(<div style={{ display:'flex', alignItems:'center', gap:12, minWidth:0 }}>
        <span style={{ width:34, height:34, borderRadius:9, background:p.creative.color, display:'flex', alignItems:'center', justifyContent:'center', flex:'0 0 auto' }}><Icon name={(CAMPAIGNS.find(c=>c.id===p.campaign)||{}).icon} size={16} color={p.creative.color==='#FFD100'?'#1A1400':'#fff'}/></span>
        <div style={{ minWidth:0 }}><div style={{ fontSize: 13.5, fontWeight:600, color:P.ink, whiteSpace:'nowrap' }}>{p.name}</div><div style={{ fontSize: 11.5, color:P.inkMute, fontFamily:P.fontMono }}>{(CAMPAIGNS.find(c=>c.id===p.campaign)||{}).label}{p.code?` · ${p.code}`:''}</div></div>
      </div>) },
    { label:'Offer', render:p=><span style={{ fontSize:12.5, color:P.ink2 }}>{offerLabel(p)}</span> },
    { label:'Audience', render:p=><Pill kind="neutral">{audienceLabel(p.audience)}</Pill> },
    { label:'Surfaces', render:p=><SurfaceDots ids={p.surfaces}/> },
    { label:'Schedule', render:p=><span style={{ fontSize: 12.5, color:P.ink2, fontFamily:P.fontMono, whiteSpace:'nowrap' }}>{scheduleLabel(p)}</span> },
    { label:'Status', render:p=>{ const m=statusMeta(p.status); return <Pill kind={m.kind} dot>{m.label}</Pill>; } },
    { label:'Weedmaps', render:p=> window.wmSyncPill(p.status==='live'?'synced':(p.status==='scheduled'||p.status==='draft')?'not_pushed':p.status==='paused'?'paused':'ended') },
    { label:'30-day rev', align:'right', render:p=> p.perf ? (<div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'flex-end' }}><Spark data={p.perf.spark} width={54} height={18} color={p.perf.aovLift>=0?P.good:P.bad}/><span style={{ fontFamily:P.fontMono, fontWeight:600, fontSize:12.5 }}>{kd(p.perf.revenue)}</span></div>) : <span style={{ color:P.inkFaint, fontSize: 12.5 }}>—</span> },
    { label:'', align:'right', width:'88px', render:p=>(<div style={{ display:'flex', gap:2, justifyContent:'flex-end' }}>
        {p.perf && <IconBtn icon="chart-line" size={15} title="Analytics" style={{ width:32, height:32 }} onClick={(e)=>{ e.stopPropagation(); onAnalytics(p.id); }}/>}
        <IconBtn icon="copy" size={15} title="Duplicate" style={{ width:32, height:32 }} onClick={(e)=>{ e.stopPropagation(); onDuplicate(p.id); }}/>
        <IconBtn icon="pencil" size={15} title="Edit" style={{ width:32, height:32 }} onClick={(e)=>{ e.stopPropagation(); onOpen(p.id); }}/>
      </div>) },
  ];
  return (<div style={{ maxWidth:1280, margin:'0 auto' }}>
    <SectionHead level={1} eyebrow="Promotions" title="Promotions" subtitle="Build a promo once — it publishes itself to every surface, and settles points automatically." action={<PBtn variant="accent" icon="plus" size="lg" onClick={onNew}>New promotion</PBtn>}/>

    <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:14, flexWrap:'wrap' }}>
      <Seg value={tab} onChange={setTab} options={[
        {value:'all', label:'All', count:counts.all},
        {value:'live', label:'Live', count:counts.live},
        {value:'scheduled', label:'Scheduled', count:counts.scheduled},
        {value:'paused', label:'Paused', count:counts.paused},
        {value:'ended', label:'Ended', count:counts.ended},
        {value:'draft', label:'Draft', count:counts.draft},
      ]}/>
      <Seg value={groupBy} onChange={setGroupBy} size="sm" options={[
        {value:'none',label:'No group'},{value:'campaign',label:'By type'},{value:'status',label:'By status'},{value:'date',label:'By timing'}]}/>
      <div style={{ flex:1 }}/>
      <div style={{ width:260 }}><Field icon="search" placeholder="Search promotions…" value={q} onChange={e=>setQ(e.target.value)}/></div>
    </div>
    {groupBy==='none'
      ? <DataTable columns={cols} rows={rows} rowKey={p=>p.id} onRowClick={p=>onOpen(p.id)}/>
      : (()=>{ const getG = groupBy==='campaign' ? (p=>(CAMPAIGNS.find(c=>c.id===p.campaign)||{}).label||p.campaign)
            : groupBy==='status' ? (p=>statusMeta(p.status).label)
            : (p=> p.schedule?.recurring==='weekly' ? 'Recurring weekly' : p.schedule?.start ? pd(p.schedule.start).toLocaleString('en-US',{month:'long', year:'numeric'}) : 'Always-on');
          const gvals=[...new Set(rows.map(getG))];
          return (<div style={{ display:'flex', flexDirection:'column', gap:20 }}>{gvals.map(g=>{ const gr=rows.filter(p=>getG(p)===g); return (
            <div key={g}><div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:9 }}><Eyebrow>{g}</Eyebrow><span style={{ fontFamily:P.fontMono, fontSize: 11.5, color:P.inkMute }}>{gr.length}</span></div>
              <DataTable columns={cols} rows={gr} rowKey={p=>p.id} onRowClick={p=>onOpen(p.id)}/></div>); })}</div>);
        })()}
  </div>);
}

// ── Builder ──────────────────────────────────────────────────────────────────
function Builder({ promo, onSave, onCancel, onDelete }){
  const P=useP();
  const [d,setD]=useState(()=>JSON.parse(JSON.stringify(promo)));
  const [holidays,setHolidays]=useState(HOLIDAYS);
  const [newHol,setNewHol]=useState('');
  const up=(patch)=> setD(prev=>({...prev, ...patch}));
  const upDisc=(patch)=> setD(prev=>({...prev, discount:{...prev.discount, ...patch}}));
  const upSched=(patch)=> setD(prev=>({...prev, schedule:{...prev.schedule, ...patch}}));
  const upRew=(patch)=> setD(prev=>({...prev, rewards:{...prev.rewards, ...patch}}));
  const upCrea=(patch)=> setD(prev=>({...prev, creative:{...prev.creative, ...patch}}));
  const toggleSurface=(id)=> setD(prev=>({...prev, surfaces: prev.surfaces.includes(id)? prev.surfaces.filter(x=>x!==id): [...prev.surfaces, id]}));
  const toggleItem=(v)=> setD(prev=>{ const items=prev.discount.items||[]; return {...prev, discount:{...prev.discount, items: items.includes(v)? items.filter(x=>x!==v): [...items,v]}}; });
  const toggleRegion=(r)=> setD(prev=>{ const cur = prev.regions==='all'? [] : prev.regions.slice(); return {...prev, regions: cur.includes(r)? cur.filter(x=>x!==r): [...cur,r]}; });
  const toggleDay=(n)=> setD(prev=>{ const days=prev.schedule.days||[]; return {...prev, schedule:{...prev.schedule, days: days.includes(n)? days.filter(x=>x!==n): [...days,n]}}; });
  const STORES=['Stilo Supply · Long Beach','CHKN N WAFFLEZ · Corona','Hyperwolf · West Hollywood','Hyperwolf Delivery'];
  const storeSel = (d.stores==='all'||!d.stores) ? 'all' : d.stores;
  const toggleStore=(s)=> setD(prev=>{ const cur=(prev.stores==='all'||!prev.stores)?[]:prev.stores.slice(); return {...prev, stores: cur.includes(s)?cur.filter(x=>x!==s):[...cur,s]}; });

  const isNew=!promo.perf && promo.__new;
  const scopeItems = d.discount.scope==='brand' ? BRANDS.map(b=>({v:b.id,l:b.name})) : d.discount.scope==='category' ? CATS.map(c=>({v:c,l:c})) : null;

  // preview
  const previewSurfaces = d.surfaces.length? d.surfaces : SURFACES.map(s=>s.id);
  const [surf,setSurf]=useState(previewSurfaces[0]);
  useEffect(()=>{ if(!previewSurfaces.includes(surf)) setSurf(previewSurfaces[0]); },[d.surfaces]);
  const sMeta=surfaceMeta(surf);
  const [device,setDevice]=useState('mobile');
  useEffect(()=>{ if(sMeta.device==='mobile') setDevice('mobile'); },[surf]);

  const Section=({icon,title,sub,children})=>(<Card padding={18} style={{ marginBottom:14 }}>
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
      <span style={{ width:30, height:30, borderRadius:8, background:P.surface3, color:P.ink2, display:'flex', alignItems:'center', justifyContent:'center' }}><Icon name={icon} size={16} stroke={1.9}/></span>
      <div><div style={{ fontSize: 13.5, fontWeight:700, color:P.ink }}>{title}</div>{sub && <div style={{ fontSize:11.5, color:P.inkDim, marginTop:1 }}>{sub}</div>}</div>
    </div>
    {children}
  </Card>);
  const Row=({children,cols=2})=>(<div style={{ display:'grid', gridTemplateColumns:`repeat(${cols},1fr)`, gap:12 }}>{children}</div>);

  return (<div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
    {/* builder header */}
    <div style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 26px', borderBottom:`1px solid ${P.hairline2}`, background:P.surface, flex:'0 0 auto' }}>
      <IconBtn icon="chevron-left" onClick={onCancel} title="Back" tone="solid"/>
      <div style={{ minWidth:0 }}>
        <div style={{ fontSize: 11.5, fontWeight:600, letterSpacing:'.12em', textTransform:'uppercase', color:P.inkMute, fontFamily:P.fontMono }}>{promo.__new?'New promotion':'Editing'}</div>
        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
          <span style={{ fontSize: 16, fontWeight:700, color:P.ink, whiteSpace:'nowrap' }}>{d.name||'Untitled promotion'}</span>
          <Pill kind={statusMeta(d.status).kind} dot>{statusMeta(d.status).label}</Pill>
        </div>
      </div>
      <div style={{ flex:1 }}/>
      <span title="Draft = saved but not published (a rough-in you keep working on). Scheduled = finished, auto-goes live on its start date. Live = showing on the site now. Paused = temporarily hidden without deleting." style={{ display:'inline-flex', color:P.inkMute, cursor:'help' }}><Icon name="help" size={16} stroke={1.9}/></span>
      <Seg value={d.status} onChange={v=>up({status:v})} size="sm" options={[
        {value:'draft',label:'Draft'},{value:'scheduled',label:'Scheduled'},{value:'live',label:'Live'},{value:'paused',label:'Paused'}]}/>
      {!promo.__new && <PBtn variant="danger" icon="trash" size="md" onClick={()=>onDelete(promo.id)}>Delete</PBtn>}
      <PBtn variant="secondary" size="md" onClick={onCancel}>Cancel</PBtn>
      <PBtn variant="accent" icon="check" size="md" onClick={()=>onSave(d)}>Save promotion</PBtn>
    </div>

    <div style={{ flex:1, display:'flex', minHeight:0 }}>
      {/* form */}
      <div style={{ flex:'1 1 auto', overflowY:'auto', padding:'20px 26px 60px', minWidth:0 }}>
        <div style={{ maxWidth:640, margin:'0 auto' }}>

          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 14px', borderRadius:P.r10, background:P.surface2, border:`1px solid ${P.hairline2}`, marginBottom:16 }}>
            <Icon name="eye" size={16} color={P.inkDim}/>
            <span style={{ fontSize: 12.5, color:P.inkDim }}>You&rsquo;re editing one promotion&rsquo;s data. See how it composes with every other live promo in the <b style={{ color:P.ink }}>Live</b> tab.</span>
          </div>

          <Section icon="note" title="Campaign basics">
            <Row>
              <Fld label="Promotion name"><Field placeholder="e.g. Wax Wednesday" value={d.name} onChange={e=>up({name:e.target.value})}/></Fld>
              <Fld label="Promo code" hint="optional"><Field placeholder="No code needed" mono value={d.code} onChange={e=>up({code:e.target.value.toUpperCase()})}/></Fld>
            </Row>
            <Fld label="Campaign type" style={{ marginTop:12 }}>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>{CAMPAIGNS.map(c=><Chip key={c.id} on={d.campaign===c.id} onClick={()=>up({campaign:c.id})}>{c.label}</Chip>)}</div>
            </Fld>
          </Section>

          <Section icon="percent" title="The offer" sub="What the customer actually gets.">
            <Fld label="Offer type">
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>{OFFERS.map(o=><Chip key={o.id} on={d.discount.kind===o.id} onClick={()=>upDisc({kind:o.id})}>{o.label}</Chip>)}</div>
            </Fld>
            <Row cols={2}>
              {(d.discount.kind==='percent'||d.discount.kind==='dollar'||d.discount.kind==='bogo'||d.discount.kind==='points') &&
                <Fld label={d.discount.kind==='points'?'Multiplier':'Value'} style={{ marginTop:12 }}>
                  <Field mono value={d.discount.value||''} onChange={e=>upDisc({value:Number(e.target.value)||0})}
                    suffix={<span style={{ fontSize: 12.5, color:P.inkMute, fontFamily:P.fontMono }}>{d.discount.kind==='dollar'?'$':d.discount.kind==='points'?'×':'%'}</span>}/>
                </Fld>}
              {(d.discount.kind==='dollar'||d.discount.kind==='gift'||d.discount.kind==='tiered') &&
                <Fld label="Minimum spend" hint="optional" style={{ marginTop:12 }}><Field mono placeholder="0" value={d.discount.min||''} onChange={e=>upDisc({min:Number(e.target.value)||0})}/></Fld>}
            </Row>
            <Fld label="Applies to" style={{ marginTop:12 }}>
              <Seg value={d.discount.scope} onChange={v=>upDisc({scope:v, items:[]})} options={[
                {value:'cart',label:'Whole order'},{value:'category',label:'Category'},{value:'brand',label:'Brand'}]}/>
            </Fld>
            {scopeItems && <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:10 }}>{scopeItems.map(it=><Chip key={it.v} on={(d.discount.items||[]).includes(it.v)} onClick={()=>toggleItem(it.v)}>{it.l}</Chip>)}</div>}
            {(d.discount.kind==='bundle'||d.discount.kind==='gift') &&
              <Fld label="Offer description" style={{ marginTop:12 }}><Field placeholder="e.g. Buy 2 eighths, get the 3rd half off" value={d.discount.text||''} onChange={e=>upDisc({text:e.target.value})}/></Fld>}
            {d.discount.kind==='tiered' && <div style={{ marginTop:12, fontSize:11.5, color:P.inkDim }}>Tiers: {(d.discount.tiers||[]).map(t=>`$${t.min} → ${t.value}%`).join('   ·   ')||'—'}</div>}
          </Section>

          <Section icon="target" title="Audience & stores" sub="Who it targets and which locations run it.">
            <Fld label="Who sees it">
              <Seg value={d.audience} onChange={v=>up({audience:v})} options={[
                {value:'all',label:'Everyone'},{value:'members',label:'Members'},{value:'vip',label:'VIP'},{value:'new',label:'New'}]}/>
            </Fld>
            <Fld label="Stores" hint="one, some, or all" style={{ marginTop:12 }}>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                <Chip on={storeSel==='all'} onClick={()=>up({stores:'all'})}>All stores</Chip>
                {STORES.map(s=><Chip key={s} on={storeSel!=='all' && storeSel.includes(s)} onClick={()=>toggleStore(s)}>{s}</Chip>)}
              </div>
            </Fld>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:12, padding:'8px 11px', borderRadius:P.r10, background:P.surface2, border:`1px dashed ${P.hairline3}` }}>
              <Icon name="pin" size={13} color={P.inkMute}/><span style={{ fontSize:11.5, color:P.inkMute }}>Region-level targeting is planned for <b style={{ color:P.inkDim }}>Phase 2</b>.</span>
            </div>
          </Section>

          <Section icon="calendar" title="Schedule">
            <Row>
              <Fld label="Start date"><DateInput value={d.schedule.start} onChange={e=>upSched({start:e.target.value})}/></Fld>
              <Fld label="End date" hint="blank = ongoing"><DateInput value={d.schedule.end} onChange={e=>upSched({end:e.target.value})}/></Fld>
            </Row>
            <Row style={{ marginTop:12 }}>
              <Fld label="Start time" hint="store local"><input type="time" value={d.schedule.startTime||''} onChange={e=>upSched({startTime:e.target.value})} style={{ width:'100%', padding:'10px 12px', background:P.field, border:`1px solid ${P.fieldBorder}`, borderRadius:P.r10, color:P.ink, fontSize: 13.5, fontFamily:P.fontMono, outline:'none', colorScheme:P.mode }}/></Fld>
              <Fld label="End time" hint="blank = end of day"><input type="time" value={d.schedule.endTime||''} onChange={e=>upSched({endTime:e.target.value})} style={{ width:'100%', padding:'10px 12px', background:P.field, border:`1px solid ${P.fieldBorder}`, borderRadius:P.r10, color:P.ink, fontSize: 13.5, fontFamily:P.fontMono, outline:'none', colorScheme:P.mode }}/></Fld>
            </Row>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:14 }}>
              <Switch on={d.schedule.recurring==='weekly'} onChange={v=>upSched({recurring:v?'weekly':null, days:v?(d.schedule.days||[]):[]})}/>
              <span style={{ fontSize: 13.5, fontWeight:600, color:P.ink }}>Repeat weekly</span>
            </div>
            {d.schedule.recurring==='weekly' && <div style={{ display:'flex', gap:6, marginTop:12 }}>{DOW.map((dn,i)=><Chip key={i} on={(d.schedule.days||[]).includes(i)} onClick={()=>toggleDay(i)}>{dn}</Chip>)}</div>}
            <Fld label="Holiday preset" hint="themes the auto tiles · add your own" style={{ marginTop:14 }}>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center' }}>
                {holidays.map(h=><Chip key={h} on={(d.schedule.holiday||'None')===h} onClick={()=>upSched({holiday:h==='None'?null:h})}>{h}</Chip>)}
                <span style={{ display:'inline-flex', gap:6, alignItems:'center' }}>
                  <input value={newHol} onChange={e=>setNewHol(e.target.value)} placeholder="New holiday…" onKeyDown={e=>{ if(e.key==='Enter'&&newHol.trim()){ const v=newHol.trim(); setHolidays(hs=>hs.includes(v)?hs:[...hs,v]); upSched({holiday:v}); setNewHol(''); } }} style={{ padding:'6px 11px', borderRadius:99, border:`1px solid ${P.hairline2}`, background:P.field, color:P.ink, fontSize: 12.5, fontFamily:P.fontSans, outline:'none', width:118 }}/>
                  <PBtn size="xs" variant="secondary" icon="plus" onClick={()=>{ if(newHol.trim()){ const v=newHol.trim(); setHolidays(hs=>hs.includes(v)?hs:[...hs,v]); upSched({holiday:v}); setNewHol(''); } }}>Add</PBtn>
                </span>
              </div>
            </Fld>
          </Section>

          <Section icon="sliders" title="Rules">
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}><div><div style={{ fontSize: 13.5, fontWeight:600, color:P.ink }}>Stackable</div><div style={{ fontSize:11.5, color:P.inkDim }}>Can combine with other active promos</div></div><Switch on={d.stackable} onChange={v=>up({stackable:v})}/></div>
              <Row>
                <Fld label="Priority" hint="1 = highest"><Field mono value={d.priority} onChange={e=>up({priority:Number(e.target.value)||1})}/></Fld>
                <Fld label="Redemption cap" hint="blank = unlimited"><Field mono placeholder="∞" value={d.cap||''} onChange={e=>up({cap:Number(e.target.value)||null})}/></Fld>
              </Row>
            </div>
          </Section>

          <Section icon="star" title="Rewards & points" sub="How this promo talks to the loyalty ledger.">
            <Row cols={3}>
              <Fld label="Points multiplier"><Field mono value={d.rewards.pointsMult} onChange={e=>upRew({pointsMult:Number(e.target.value)||1})} suffix={<span style={{ fontSize: 12.5, color:P.inkMute }}>×</span>}/></Fld>
              <Fld label="Wallet credit"><Field mono placeholder="0" value={d.rewards.wallet||''} onChange={e=>upRew({wallet:Number(e.target.value)||0})} suffix={<span style={{ fontSize: 12.5, color:P.inkMute }}>$</span>}/></Fld>
              <div/>
            </Row>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:14 }}><div><div style={{ fontSize: 13.5, fontWeight:600, color:P.ink }}>Redeemable with points</div><div style={{ fontSize:11.5, color:P.inkDim }}>Customers can spend points against this offer</div></div><Switch on={d.rewards.redeemable} onChange={v=>upRew({redeemable:v})}/></div>
          </Section>

          <Section icon="layout" title="Surfaces" sub="Author once — pick where it publishes. Preview updates live.">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {SURFACES.map(s=>{ const on=d.surfaces.includes(s.id); return (
                <button key={s.id} onClick={()=>toggleSurface(s.id)} style={{ display:'flex', alignItems:'center', gap:11, padding:'11px 12px', textAlign:'left', borderRadius:P.r10, cursor:'pointer', background:on?P.accentSoft:P.surface2, border:`1px solid ${on?P.accentBorder:P.hairline2}`, transition:'all .12s' }}>
                  <span style={{ width:32, height:32, borderRadius:8, background:on?P.accent:P.surface3, color:on?P.accentInk:P.ink2, display:'flex', alignItems:'center', justifyContent:'center', flex:'0 0 auto' }}><Icon name={s.icon} size={16} stroke={1.9}/></span>
                  <div style={{ flex:1, minWidth:0 }}><div style={{ fontSize:12.5, fontWeight:700, color:P.ink }}>{s.label}</div><div style={{ fontSize: 11.5, color:P.inkDim, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{s.note}</div></div>
                  {on && <Icon name="check-circle" size={17} color={P.mode==='dark'?P.accent:'#7A5A00'}/>}
                </button>); })}
            </div>
          </Section>

          <Section icon="note" title="Details & terms" sub="Promotion-level info — the actual banner artwork is owned by design.">
            <Fld label="Theme color" hint="drives the auto-generated deal tiles & weekly board"><ColorSwatch value={d.creative.color} onChange={c=>upCrea({color:c})}/></Fld>
            <Fld label="Customer-facing tagline" hint="short line on auto tiles (optional)" style={{ marginTop:14 }}><Field value={d.creative.headline} onChange={e=>upCrea({headline:e.target.value})}/></Fld>
            <Fld label="Terms & conditions" hint="fine print shown at checkout" style={{ marginTop:14 }}><TextArea value={d.creative.terms||''} onChange={e=>upCrea({terms:e.target.value})} placeholder="e.g. Cannot combine with other offers. While supplies last."/></Fld>
            <Fld label="Internal note" hint="team-only — never shown to customers" style={{ marginTop:14 }}><TextArea value={d.creative.note||''} onChange={e=>upCrea({note:e.target.value})} placeholder="Why we're running this, who approved it, etc."/></Fld>
          </Section>

        </div>
      </div>

    </div>
  </div>);
}

// ── Calendar (timeline) ──────────────────────────────────────────────────────
function Calendar({ promos, onOpen }){
  const P=useP();
  const start=pd('2026-06-15'), end=pd('2026-08-15');
  const totalDays=Math.round((end-start)/86400000);
  const pct=(dt)=> Math.max(0,Math.min(1,(dt-start)/86400000/totalDays))*100;
  const months=[{n:'June',x:pct(pd('2026-06-15'))},{n:'July',x:pct(pd('2026-07-01'))},{n:'August',x:pct(pd('2026-08-01'))}];
  const todayX=pct(TODAY);
  const rows=promos.filter(p=>p.status!=='draft');
  return (<div style={{ maxWidth:1180, margin:'0 auto' }}>
    <SectionHead level={1} eyebrow="Promotions · Schedule" title="Calendar" subtitle="Every promotion on one timeline — dated runs and weekly recurrences." />
    <Card padding={0} style={{ overflow:'hidden' }}>
      {/* month header */}
      <div style={{ position:'relative', height:34, borderBottom:`1px solid ${P.hairline2}`, background:P.surface2 }}>
        {months.map(m=><span key={m.n} style={{ position:'absolute', left:`calc(${m.x}% + 8px)`, top:9, fontSize: 11.5, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', color:P.inkMute, fontFamily:P.fontMono }}>{m.n}</span>)}
        <div style={{ position:'absolute', left:`${todayX}%`, top:0, bottom:0, width:2, background:P.accent, zIndex:3 }}/>
      </div>
      <div style={{ position:'relative' }}>
        <div style={{ position:'absolute', left:`${todayX}%`, top:0, bottom:0, width:2, background:P.accent, opacity:.5, zIndex:3 }}/>
        {rows.map((p,i)=>{ 
          const s=p.schedule;
          return (<div key={p.id} onClick={()=>onOpen(p.id)} style={{ position:'relative', height:46, borderBottom:i<rows.length-1?`1px solid ${P.hairline}`:'none', cursor:'pointer', display:'flex', alignItems:'center' }}
            onMouseEnter={e=>e.currentTarget.style.background=P.surface2} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            <div style={{ position:'absolute', left:8, width:150, fontSize: 12.5, fontWeight:600, color:P.ink, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', zIndex:2 }}>{p.name}</div>
            <div style={{ position:'absolute', left:166, right:12, top:0, bottom:0 }}>
              {s.recurring==='weekly'
                ? Array.from({length:9}).map((_,w)=>{ const wx=(w/9)*100; return (s.days||[]).map(dy=>(<span key={w+'-'+dy} title={`Every ${DOW[dy]}`} style={{ position:'absolute', left:`${wx+dy*1.4}%`, top:16, width:9, height:14, borderRadius:3, background:p.creative.color, opacity:.9 }}/>)); })
                : (s.start ? <div style={{ position:'absolute', left:`${pct(pd(s.start))}%`, width:`${Math.max(2,pct(s.end?pd(s.end):end)-pct(pd(s.start)))}%`, top:13, height:20, borderRadius:6, background:p.creative.color, display:'flex', alignItems:'center', padding:'0 8px', overflow:'hidden' }}><span style={{ fontSize: 11.5, fontWeight:700, color:p.creative.color==='#FFD100'?'#1A1400':'#fff', whiteSpace:'nowrap', fontFamily:P.fontMono }}>{offerBadge(p)}</span></div>
                  : <div style={{ position:'absolute', left:0, right:0, top:19, height:2, background:P.hairline2 }}/>)}
            </div>
          </div>); })}
      </div>
    </Card>
    <div style={{ display:'flex', gap:16, marginTop:14, flexWrap:'wrap', fontSize:11.5, color:P.inkDim }}>
      <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}><span style={{ width:20, height:10, borderRadius:3, background:P.ink2 }}/>Dated run</span>
      <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}><span style={{ width:9, height:12, borderRadius:3, background:P.ink2 }}/>Weekly recurrence</span>
      <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}><span style={{ width:2, height:14, background:P.accent }}/>Today · {TODAY.toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
    </div>
  </div>);
}

// ── Analytics ─────────────────────────────────────────────────────────────────
function Analytics({ promos, initialId, onOpen }){
  const P=useP();
  const withPerf=promos.filter(p=>p.perf);
  const [id,setId]=useState(initialId && withPerf.find(p=>p.id===initialId) ? initialId : withPerf[0]?.id);
  const p=withPerf.find(x=>x.id===id)||withPerf[0];
  if(!p) return <div style={{ padding:40, color:P.inkMute }}>No performance data yet.</div>;
  const bs=p.perf.bySurface||{};
  const bsMax=Math.max(1,...Object.values(bs));
  return (<div style={{ maxWidth:1180, margin:'0 auto' }}>
    <SectionHead level={1} eyebrow="Promotions · Analytics" title="Performance" subtitle="Redemptions, revenue and points settled — per promo, per surface." />
    <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:18 }}>
      {withPerf.map(x=><Chip key={x.id} on={x.id===p.id} onClick={()=>setId(x.id)} color={x.id===p.id?x.creative.color:null}>{x.name}</Chip>)}
    </div>

    <Card padding={18} style={{ marginBottom:16, display:'flex', alignItems:'center', gap:14 }}>
      <span style={{ width:46, height:46, borderRadius:12, background:p.creative.color, display:'flex', alignItems:'center', justifyContent:'center', flex:'0 0 auto' }}><Icon name={(CAMPAIGNS.find(c=>c.id===p.campaign)||{}).icon} size={22} color={p.creative.color==='#FFD100'?'#1A1400':'#fff'}/></span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}><span style={{ fontSize: 16, fontWeight:700, color:P.ink }}>{p.name}</span><Pill kind={statusMeta(p.status).kind} dot>{statusMeta(p.status).label}</Pill></div>
        <div style={{ fontSize:12.5, color:P.inkDim, marginTop:2 }}>{offerLabel(p)} · {audienceLabel(p.audience)} · {scheduleLabel(p)}</div>
      </div>
      <PBtn variant="secondary" icon="pencil" onClick={()=>onOpen(p.id)}>Edit promo</PBtn>
    </Card>

    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:11, marginBottom:16 }}>
      <KPI icon="tag" label="Redemptions" value={num(p.perf.redemptions)} spark={p.perf.spark} sparkColor={p.creative.color}/>
      <KPI icon="dollar" label="Attributed revenue" value={kd(p.perf.revenue)} delta={p.perf.aovLift} deltaKind={p.perf.aovLift>=0?'good':'bad'} accent/>
      <KPI icon="trending-up" label="AOV lift" value={(p.perf.aovLift>=0?'+':'')+p.perf.aovLift+'%'} deltaKind={p.perf.aovLift>=0?'good':'bad'}/>
      <KPI icon="target" label="Redemption rate" value={p.perf.rate+'%'} sublabel={`of ${num(p.perf.views)} views`}/>
      <KPI icon="star" label="Points issued" value={num(p.perf.pointsIssued)} sublabel="to rewards"/>
    </div>

    <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:16 }}>
      <Card padding={18}>
        <SectionHead level={3} eyebrow="Last 7 days" title="Redemptions trend" style={{ marginBottom:16 }}/>
        <div style={{ display:'flex', alignItems:'flex-end', gap:10, height:150 }}>
          {p.perf.spark.map((v,i)=>{ const mx=Math.max(...p.perf.spark); return (<div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:7 }}>
            <div style={{ width:'100%', height:`${(v/mx)*120}px`, minHeight:4, background:p.creative.color, borderRadius:'6px 6px 0 0', opacity:.9 }}/>
            <span style={{ fontSize:10, color:P.inkMute, fontFamily:P.fontMono }}>{DOW[(i)%7]}</span>
          </div>); })}
        </div>
      </Card>
      <Card padding={18}>
        <SectionHead level={3} eyebrow="Attribution" title="By surface" style={{ marginBottom:16 }}/>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {Object.entries(bs).map(([sid,val])=>{ const s=surfaceMeta(sid); return (<div key={sid}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}><Icon name={s.icon} size={14} color={P.ink2}/><span style={{ fontSize:12.5, fontWeight:600, color:P.ink, flex:1 }}>{s.label}</span><span style={{ fontSize: 12.5, fontWeight:700, fontFamily:P.fontMono, color:P.ink }}>{val}%</span></div>
            <BarMeter value={val} max={bsMax} color={p.creative.color}/>
          </div>); })}
        </div>
        <div style={{ marginTop:16, padding:'11px 12px', borderRadius:P.r10, background:P.accentSoft, border:`1px solid ${P.accentBorder}`, display:'flex', gap:9, alignItems:'flex-start' }}>
          <Icon name="link" size={15} color={P.mode==='dark'?P.accent:'#7A5A00'} style={{ marginTop:1 }}/>
          <span style={{ fontSize:11.5, color:P.mode==='dark'?P.accent:'#7A5A00', lineHeight:1.5 }}>{num(p.perf.pointsIssued)} points auto-settled to the rewards ledger from this promo.</span>
        </div>
      </Card>
    </div>
  </div>);
}

// ── App root ──────────────────────────────────────────────────────────────────
function PromoModule(){
  const P=useP();
  const [promos,setPromos]=useState(()=>PM.seedPromos());
  const [view,setView]=useState('dashboard'); // dashboard | calendar | analytics
  const [builderId,setBuilderId]=useState(null); // null | 'new' | id
  const [analyticsId,setAnalyticsId]=useState(null);

  const blankPromo=()=>({ id:'p'+Date.now(), name:'', code:'', campaign:'weekly', status:'draft',
    discount:{kind:'percent', value:20, scope:'cart', items:[]}, audience:'all', regions:'all', stores:'all',
    schedule:{}, stackable:false, priority:3, cap:null, rewards:{pointsMult:1, redeemable:false, wallet:0},
    surfaces:['home_banner'], creative:{headline:'New promotion', subhead:'Add a subhead that sells it.', cta:'Shop now', color:'#FFD100'}, __new:true });

  const editing = builderId==='new' ? blankPromo() : builderId ? promos.find(p=>p.id===builderId) : null;
  const openBuilder=(id)=>setBuilderId(id);
  const save=(d)=>{ const clean={...d}; delete clean.__new; setPromos(prev=> prev.find(p=>p.id===clean.id)? prev.map(p=>p.id===clean.id?clean:p) : [clean,...prev]); setBuilderId(null); };
  const del=(id)=>{ setPromos(prev=>prev.filter(p=>p.id!==id)); setBuilderId(null); };
  const dup=(id)=>{ const src=promos.find(p=>p.id===id); const copy={...JSON.parse(JSON.stringify(src)), id:'p'+Date.now(), name:src.name+' (copy)', status:'draft', __new:true, perf:undefined}; setBuilderId('new'); setPromos(prev=>[copy,...prev]); setTimeout(()=>setBuilderId(copy.id),0); };
  const goAnalytics=(id)=>{ setAnalyticsId(id); setView('analytics'); };

  if(editing){
    return (<div style={{ display:'flex', height:'100vh', background:P.bg, color:P.ink, fontFamily:P.fontSans, overflow:'hidden' }}>
      <Rail/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden' }}>
        <TopBar/>
        <div style={{ flex:1, minHeight:0 }}><Builder promo={editing} onSave={save} onCancel={()=>setBuilderId(null)} onDelete={del}/></div>
      </div>
    </div>);
  }

  return (<div style={{ display:'flex', height:'100vh', background:P.bg, color:P.ink, fontFamily:P.fontSans, overflow:'hidden' }}>
    <Rail/>
    <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden' }}>
      <TopBar/>
      <div style={{ padding:'0 30px', borderBottom:`1px solid ${P.hairline2}`, background:P.surface, flex:'0 0 auto' }}>
        <Tabs value={view} onChange={setView} options={[
          {value:'dashboard', label:'Promotions'},{value:'preview', label:'Live'},{value:'studio', label:'Studio'},{value:'analytics', label:'Analytics'}]}/>
      </div>
      <main style={{ flex:1, overflowY:'auto', overflowX:'hidden', padding:'26px 30px 56px' }}>
        {view==='dashboard' && <><WeekView/><div style={{ height:1, background:P.hairline2, margin:'44px 0' }}/><Dashboard promos={promos} onOpen={openBuilder} onNew={()=>setBuilderId('new')} onAnalytics={goAnalytics} onDuplicate={dup}/></>}
        {view==='preview'   && <PreviewView promos={promos} onOpen={openBuilder}/>}
        {view==='studio'    && <StudioView promos={promos} setPromos={setPromos} onOpen={openBuilder}/>}
        {view==='analytics' && <Analytics promos={promos} initialId={analyticsId} onOpen={openBuilder}/>}
      </main>
    </div>
  </div>);
}

window.PromoApp = function PromoApp(){ return <ThemeProvider><PromoModule/></ThemeProvider>; };
Object.assign(window, { PromoCalendar: Calendar, PromoAnalytics: Analytics, LegacyDashboard: Dashboard });
