// ── "This Week" — live slotting resolver + 4 concept views ──────────────────
const useP = window.useP;
const { useState, useMemo, useRef } = React;

const A = [0,1,2,3,4,5,6];
const DAYS = [
  {k:0,l:'Mon',d:'Jul 6'},{k:1,l:'Tue',d:'Jul 7'},{k:2,l:'Wed',d:'Jul 8'},
  {k:3,l:'Thu',d:'Jul 9'},{k:4,l:'Fri',d:'Jul 10'},{k:5,l:'Sat',d:'Jul 11'},{k:6,l:'Sun',d:'Jul 12'},
];
const WK_TODAY = 2;

// surfaces + capacity
const WS = [
  {id:'home_hero',      label:'Home hero',   cap:1,  sub:'1 slot · rotates'},
  {id:'home_banner',    label:'Home banner', cap:3,  sub:'3 · carousel'},
  {id:'shop_tile',      label:'Shop grid',   cap:99, sub:'all tiles'},
  {id:'brand_takeover', label:'Brand pages', cap:1,  perBrand:true, sub:'1 / brand'},
  {id:'loyalty',        label:'Rewards',     cap:99, sub:'list'},
];

// 15 promos running across the week of Jul 6–12
const WEEK = [
  {id:'w01', name:'Corona Grand Opening', color:'#C0392B', badge:'25% OFF', offer:'25% off first order', aud:'Everyone', days:A,           surfaces:['home_hero','home_banner']},
  {id:'w02', name:'Members Early Drop',   color:'#0F0F0C', badge:'NEW',     offer:'Members early access', aud:'Members',  days:[2,3,4],     surfaces:['home_hero','shop_tile']},
  {id:'w03', name:'CHKN Launch',          color:'#E0662E', badge:'FREE GIFT',offer:'Free pre-roll on $75+',aud:'Everyone', days:[4,5,6],    surfaces:['home_hero','brand_takeover'], brand:'CHKN'},
  {id:'w04', name:'Wax Wednesday',        color:'#C2841D', badge:'30% OFF', offer:'30% off concentrates', aud:'Everyone', days:[2],         surfaces:['home_banner','shop_tile']},
  {id:'w05', name:'Weekend Flower Bundle',color:'#3F9E72', badge:'BUNDLE',  offer:'Buy 2 eighths, get 3rd 1/2',aud:'Everyone',days:[4,5,6], surfaces:['shop_tile']},
  {id:'w06', name:'Stilo BOGO',           color:'#7E55C9', badge:'BOGO',    offer:'2nd cart 50% off',     aud:'Members',  days:A,           surfaces:['brand_takeover','shop_tile'], brand:'Stilo'},
  {id:'w07', name:'VIP Double Points',    color:'#FFD100', badge:'2× PTS',  offer:'2× points',            aud:'VIP',      days:[5,6],       surfaces:['home_banner','loyalty']},
  {id:'w08', name:'Welcome $20',          color:'#1F8A4F', badge:'$20 OFF', offer:'$20 off first order',  aud:'New',      days:A,           surfaces:['home_banner']},
  {id:'w09', name:'Pleasure Med Wellness',color:'#2FA59B', badge:'15% OFF', offer:'15% off wellness',     aud:'Members',  days:A,           surfaces:['home_banner','shop_tile'], brand:'Pleasure'},
  {id:'w10', name:'Taco Tuesday Edibles', color:'#D6477C', badge:'20% OFF', offer:'20% off edibles',      aud:'Everyone', days:[1],         surfaces:['home_banner','shop_tile']},
  {id:'w11', name:'Thursday Vape Day',    color:'#2C5BB8', badge:'$5 OFF',  offer:'$5 off carts',         aud:'Everyone', days:[3],         surfaces:['home_banner','shop_tile']},
  {id:'w12', name:'Monday Reset',         color:'#3F8E7E', badge:'10% OFF', offer:'10% off wellness',     aud:'Everyone', days:[0],         surfaces:['home_banner','shop_tile']},
  {id:'w13', name:'Refer a Friend',       color:'#2C5BB8', badge:'$15',     offer:'$15 wallet credit',    aud:'Everyone', days:A,           surfaces:['home_banner','loyalty']},
  {id:'w14', name:'Kine 2 for $15',       color:'#6E8B2A', badge:'2/$15',   offer:'Pre-rolls 2 for $15',  aud:'Everyone', days:A,           surfaces:['shop_tile','brand_takeover'], brand:'Kine'},
  {id:'w15', name:'Happy Hour',           color:'#9A7B3A', badge:'15% OFF', offer:'15% off, 4–6pm',       aud:'Everyone', days:A,           surfaces:['home_banner']},
];
const DEFAULT_RANK = WEEK.map(p=>p.id); // initial priority order (index = rank)
const byId = (id)=> WEEK.find(p=>p.id===id);
const textOn = (c)=> c==='#FFD100' ? '#1A1400' : c==='#0F0F0C' ? '#FFD100' : '#fff';
const active = (p,day)=> p.days.includes(day);

// The resolver: given day + engine state, return placements per surface.
function resolve(surfaceId, day, {rank, pins, rotate}){
  const cap = WS.find(s=>s.id===surfaceId).cap;
  let elig = WEEK.filter(p=> active(p,day) && p.surfaces.includes(surfaceId));
  elig.sort((a,b)=> rank.indexOf(a.id) - rank.indexOf(b.id));
  const pin = pins[surfaceId];
  if(pin && elig.find(p=>p.id===pin)){ elig = [byId(pin), ...elig.filter(p=>p.id!==pin)]; }
  const contested = elig.length > cap;
  const rotating = contested && rotate[surfaceId];
  const onAir = rotating ? elig : elig.slice(0,cap);
  const benched = rotating ? [] : elig.slice(cap);
  return { onAir, benched, cap, contested, rotating, elig };
}

// ── shared bits ──────────────────────────────────────────────────────────────
function HeroBox({p, small}){
  return (<div style={{ borderRadius:8, padding: small?'6px 8px':'7px 9px', background:p.color, color:textOn(p.color), display:'flex', flexDirection:'column', justifyContent:'center', minHeight: small?38:44, lineHeight:1.1 }}>
    <span style={{ fontWeight:800, fontSize: small?10.5:11, letterSpacing:'-.01em' }}>{p.name}</span>
    <span style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:700, fontSize:8, opacity:.85, letterSpacing:'.06em', marginTop:2 }}>{p.badge}</span>
  </div>);
}
function Bar({p}){ return (<div style={{ borderRadius:6, padding:'4px 7px', background:p.color, color:textOn(p.color), fontSize:9.5, fontWeight:700, display:'flex', alignItems:'center', gap:5, lineHeight:1 }}><span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span><span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:8, opacity:.8, marginLeft:'auto', whiteSpace:'nowrap' }}>{p.badge}</span></div>); }
function Dot({c,s=8}){ return <span style={{ width:s, height:s, borderRadius:99, background:c, flex:'0 0 auto', display:'inline-block' }}/>; }
function MiniChip({p}){ const P=useP(); return (<span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 9px', borderRadius:999, background:P.surface, border:`1px solid ${P.hairline2}`, fontSize:11, fontWeight:600, color:P.ink, whiteSpace:'nowrap' }}><Dot c={p.color}/>{p.name}</span>); }
function DaySelect({ day, setDay }){
  const P=useP();
  return (<div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>{DAYS.map(d=>{ const a=d.k===day; return (
    <button key={d.k} onClick={()=>setDay(d.k)} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:1, padding:'6px 12px', borderRadius:9, background:a?P.ink:P.surface, color:a?P.surface:P.ink2, border:`1px solid ${a?P.ink:P.hairline2}`, cursor:'pointer', fontFamily:P.fontSans }}>
      <span style={{ fontSize:12, fontWeight:700 }}>{d.l}</span>
      {d.k===WK_TODAY && <span style={{ fontSize:7.5, fontWeight:700, fontFamily:P.fontMono, letterSpacing:'.06em', color:a?P.accent:P.accent }}>TODAY</span>}
    </button>); })}</div>);
}

// ── 1a — MATRIX ───────────────────────────────────────────────────────────────
function Matrix({ engine }){
  const P=useP();
  const conflicts = useMemo(()=>{ let n=0; DAYS.forEach(d=>['home_hero','home_banner'].forEach(s=>{ const r=resolve(s,d.k,engine); if(r.contested && !r.rotating && !engine.pins[s]) n++; })); return n; },[engine]);
  const cell=(surfaceId,day,render)=>{ const isToday=day===WK_TODAY; return (
    <div key={surfaceId+'-'+day} style={{ borderRight:`1px solid ${P.hairline}`, borderBottom:`1px solid ${P.hairline}`, padding:'8px 9px', background:isToday?(P.mode==='dark'?'rgba(255,209,0,.06)':'rgba(255,209,0,.10)'):'transparent' }}>{render}</div>); };
  return (<Card padding={0} style={{ overflow:'hidden' }}>
    <div style={{ padding:'15px 18px', borderBottom:`1px solid ${P.hairline2}`, display:'flex', alignItems:'center', gap:12 }}>
      <div><Eyebrow>Auto-resolved · read-only view</Eyebrow><div style={{ fontSize:18, fontWeight:800, letterSpacing:'-.02em', marginTop:3 }}>Week of Jul 6–12</div></div>
      <div style={{ flex:1 }}/>
      {conflicts>0 ? <Pill kind="warn" dot>{conflicts} slot conflict{conflicts>1?'s':''}</Pill> : <Pill kind="good" dot>All slots resolved</Pill>}
      <Pill kind="neutral">15 promos live</Pill>
    </div>
    <div style={{ display:'grid', gridTemplateColumns:'150px repeat(7, minmax(112px, 1fr))' }}>
      {/* header */}
      <div style={{ background:P.surface2, borderBottom:`1px solid ${P.hairline}`, borderRight:`1px solid ${P.hairline}` }}/>
      {DAYS.map(d=>(<div key={d.k} style={{ background:d.k===WK_TODAY?(P.mode==='dark'?'rgba(255,209,0,.12)':'rgba(255,209,0,.20)'):P.surface2, borderBottom:`1px solid ${P.hairline}`, borderRight:`1px solid ${P.hairline}`, padding:'8px 9px' }}>
        <div style={{ fontSize:11, fontWeight:800 }}>{d.l}</div><div style={{ fontSize:9.5, fontFamily:P.fontMono, color:P.inkMute }}>{d.d}</div></div>))}
      {/* surface rows */}
      {WS.map(s=>(<React.Fragment key={s.id}>
        <div style={{ background:P.surface2, borderRight:`1px solid ${P.hairline}`, borderBottom:`1px solid ${P.hairline}`, padding:'8px 9px', display:'flex', flexDirection:'column', justifyContent:'center' }}>
          <div style={{ fontSize:11.5, fontWeight:800 }}>{s.label}</div><div style={{ fontSize:9.5, fontFamily:P.fontMono, color:P.inkMute }}>{s.sub}</div>
        </div>
        {DAYS.map(d=>{ const r=resolve(s.id,d.k,engine); return cell(s.id,d.k,
          s.id==='home_hero' ? (
            r.onAir.length ? <div style={{ position:'relative' }}>
              <HeroBox p={r.onAir[0]}/>
              {r.contested && !r.rotating && !engine.pins[s.id] && <span style={{ position:'absolute', top:-6, right:-6, background:P.warn, color:'#fff', fontSize:9, fontWeight:700, fontFamily:P.fontMono, padding:'2px 5px', borderRadius:99, border:`2px solid ${P.surface}`, display:'flex', alignItems:'center', gap:2 }}>⚠{r.benched.length}</span>}
              {r.rotating && <span style={{ position:'absolute', top:-7, right:-7, background:P.ink, color:P.surface, fontSize:8.5, fontWeight:700, fontFamily:P.fontMono, padding:'2px 5px 2px 4px', borderRadius:99, border:`2px solid ${P.surface}`, display:'flex', alignItems:'center', gap:2 }}><Icon name="refresh" size={9} stroke={2.4}/>{r.elig.length}</span>}
            </div> : <span style={{ color:P.inkFaint, fontSize:11 }}>—</span>
          ) : s.id==='home_banner' ? (
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {r.onAir.map(p=><Bar key={p.id} p={p}/>)}
              {r.benched.length>0 && <span style={{ fontSize:9.5, fontFamily:P.fontMono, color:P.inkMute }}>+{r.benched.length} queued</span>}
            </div>
          ) : s.id==='shop_tile' ? (
            r.onAir.length ? <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 9px', borderRadius:999, background:P.surface2, border:`1px solid ${P.hairline2}`, fontSize:11, fontWeight:600 }}><Dot c={r.onAir[0].color}/>{r.onAir.length} tiles</span> : <span style={{ color:P.inkFaint, fontSize:11 }}>—</span>
          ) : s.id==='brand_takeover' ? (
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>{r.onAir.map(p=><span key={p.id} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'3px 8px', borderRadius:999, background:P.surface2, border:`1px solid ${P.hairline2}`, fontSize:10.5, fontWeight:600 }}><Dot c={p.color} s={7}/>{p.brand}</span>)}</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>{r.onAir.map(p=><span key={p.id} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'3px 8px', borderRadius:999, background:P.surface2, border:`1px solid ${P.hairline2}`, fontSize:10.5, fontWeight:600 }}><Dot c={p.color} s={7}/>{p.name.split(' ')[0]}</span>)}</div>
          )
        ); })}
      </React.Fragment>))}
    </div>
  </Card>);
}

// ── 1b — PRIORITY STACKS (draggable) ─────────────────────────────────────────
function Stacks({ engine, setRank }){
  const P=useP();
  const [day,setDay]=useState(WK_TODAY);
  const dragId=useRef(null);
  const reorder=(targetId)=>{ const from=dragId.current; if(!from||from===targetId) return; setRank(prev=>{ const arr=prev.filter(x=>x!==from); const i=arr.indexOf(targetId); arr.splice(i,0,from); return arr; }); };
  const cols=['home_hero','home_banner'];
  return (<div>
    <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16, flexWrap:'wrap' }}>
      <div><Eyebrow>Resolve by day</Eyebrow><div style={{ fontSize:18, fontWeight:800, letterSpacing:'-.02em', marginTop:3 }}>{DAYS[day].l}, {DAYS[day].d}</div></div>
      <div style={{ flex:1 }}/>
      <DaySelect day={day} setDay={setDay}/>
    </div>
    <div style={{ fontSize:12.5, color:P.inkDim, marginBottom:14 }}>Drag any promo to re-rank it. The top of each stack — up to the slot's capacity — goes on air; the rest wait.</div>
    <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
      {cols.map(sid=>{ const s=WS.find(x=>x.id===sid); const r=resolve(sid,day,engine); return (
        <Card key={sid} padding={14} style={{ width:300, background:P.surface2 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}><div style={{ fontSize:13.5, fontWeight:800 }}>{s.label}</div><Pill kind="neutral">cap {s.cap}</Pill></div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {r.elig.map((p,i)=>{ const on=i<s.cap || r.rotating; return (
              <div key={p.id} draggable onDragStart={()=>{dragId.current=p.id;}} onDragOver={e=>e.preventDefault()} onDrop={()=>reorder(p.id)}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 11px', borderRadius:10, cursor:'grab',
                  background:on?P.surface:'transparent', border:`1px ${on?'solid':'dashed'} ${on?P.good:P.hairline2}`, boxShadow:on?`0 0 0 2px ${P.mode==='dark'?'rgba(70,192,126,.18)':'rgba(31,138,79,.14)'}`:'none', opacity:on?1:.55, transition:'opacity .12s' }}>
                <span style={{ color:P.inkFaint, fontFamily:P.fontMono, fontWeight:700, fontSize:12, letterSpacing:'-1px' }}>⋮⋮</span>
                <Dot c={p.color} s={9}/>
                <div style={{ flex:1, minWidth:0 }}><div style={{ fontSize:12.5, fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.name}</div><div style={{ fontSize:9.5, fontFamily:P.fontMono, color:P.inkMute }}>#{i+1} · {p.offer}</div></div>
                <span style={{ fontFamily:P.fontMono, fontSize:8.5, fontWeight:700, letterSpacing:'.06em', padding:'2px 6px', borderRadius:99, background:on?(P.mode==='dark'?'rgba(70,192,126,.16)':'rgba(31,138,79,.14)'):P.surface3, color:on?P.good:P.inkMute }}>{on?(r.rotating?'ROTATES':'ON AIR'):'BENCHED'}</span>
              </div>); })}
          </div>
        </Card>); })}
    </div>
  </div>);
}

// ── 1c — STOREFRONT PREVIEW + LIST ───────────────────────────────────────────
function Storefront({ engine }){
  const P=useP();
  const [day,setDay]=useState(WK_TODAY);
  const hero=resolve('home_hero',day,engine);
  const banner=resolve('home_banner',day,engine);
  const shop=resolve('shop_tile',day,engine);
  const h=hero.onAir[0];
  return (<div>
    <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:18, flexWrap:'wrap' }}>
      <div><Eyebrow>Storefront preview</Eyebrow><div style={{ fontSize:18, fontWeight:800, letterSpacing:'-.02em', marginTop:3 }}>What ships {DAYS[day].l}, {DAYS[day].d}</div></div>
      <div style={{ flex:1 }}/>
      <DaySelect day={day} setDay={setDay}/>
    </div>
    <div style={{ display:'flex', gap:24, flexWrap:'wrap' }}>
      {/* phone */}
      <div style={{ width:284, borderRadius:40, background:'#000', padding:9, boxShadow:'0 30px 60px rgba(0,0,0,.3)', flex:'0 0 auto' }}>
        <div style={{ borderRadius:32, overflow:'hidden', background:'#0F0F0C', color:'#fff', position:'relative' }}>
          <div style={{ position:'absolute', top:8, left:'50%', transform:'translateX(-50%)', width:84, height:22, borderRadius:20, background:'#000', zIndex:5 }}/>
          <div style={{ height:38, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 20px', fontSize:12, fontWeight:600 }}><span>9:41</span><span style={{ fontFamily:"'JetBrains Mono',monospace", opacity:.6, fontSize:9 }}>▮▮▮ ⌁</span></div>
          <div style={{ padding:'2px 15px 18px' }}>
            <div style={{ fontWeight:800, fontSize:14, marginBottom:12 }}>Good afternoon 👋</div>
            {h ? <div style={{ borderRadius:16, background:h.color, color:textOn(h.color), padding:'16px', position:'relative', overflow:'hidden' }}>
              <span style={{ display:'inline-block', padding:'3px 8px', borderRadius:99, background:textOn(h.color), color:h.color, fontFamily:"'JetBrains Mono',monospace", fontSize:8.5, fontWeight:800, letterSpacing:'.06em', marginBottom:9 }}>{h.badge}</span>
              <div style={{ fontSize:19, fontWeight:900, letterSpacing:'-.02em', lineHeight:1.05 }}>{h.name}</div>
              <div style={{ fontSize:11, opacity:.82, marginTop:5 }}>{h.offer}</div>
            </div> : <div style={{ borderRadius:16, border:'1px dashed rgba(255,255,255,.2)', padding:24, textAlign:'center', color:'rgba(255,255,255,.4)', fontSize:11 }}>No hero today</div>}
            {hero.contested && !hero.rotating && !engine.pins.home_hero && <div style={{ fontSize:9.5, fontFamily:"'JetBrains Mono',monospace", color:'#E0A53A', marginTop:8, textAlign:'center' }}>⚠ {hero.benched.length} more want this slot</div>}
            <div style={{ display:'flex', gap:5, justifyContent:'center', margin:'12px 0 10px' }}>{banner.onAir.map((_,i)=><span key={i} style={{ width:i===0?16:5, height:5, borderRadius:9, background:i===0?'#fff':'rgba(255,255,255,.3)' }}/>)}</div>
            {banner.onAir[0] && <div style={{ height:50, borderRadius:12, background:banner.onAir[0].color, color:textOn(banner.onAir[0].color), display:'flex', alignItems:'center', padding:'0 13px', fontWeight:800, fontSize:11.5 }}>{banner.onAir[0].name} · {banner.onAir[0].offer}</div>}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:7, marginTop:10 }}>{[0,1,2].map(i=><div key={i} style={{ height:50, borderRadius:11, background:'repeating-linear-gradient(135deg,#2a3a2a,#2a3a2a 7px,#243324 7px,#243324 14px)' }}/>)}</div>
          </div>
        </div>
      </div>
      {/* placed list */}
      <div style={{ flex:'1 1 300px', minWidth:280 }}>
        <Card padding={0}>
          {[['Home hero · 1', hero],['Home banner · '+banner.onAir.length+' of '+banner.elig.length, banner],['Shop grid · '+shop.elig.length+' tiles', shop]].map(([label,r],gi)=>(
            <div key={gi}>
              <div style={{ padding:'12px 15px 6px', fontSize:10, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:P.inkMute, fontFamily:P.fontMono }}>{label}</div>
              <div>{r.elig.map((p,i)=>{ const on = r.rotating || i<r.cap; return (
                <div key={p.id} style={{ display:'flex', alignItems:'center', gap:11, padding:'10px 15px', borderTop:`1px solid ${P.hairline}` }}>
                  <Dot c={p.color} s={9}/><span style={{ fontSize:12.5, fontWeight:600, flex:1, color:on?P.ink:P.inkDim }}>{p.name}</span>
                  <span style={{ fontFamily:P.fontMono, fontSize:8.5, fontWeight:700, letterSpacing:'.06em', padding:'2px 6px', borderRadius:99, background:on?(P.mode==='dark'?'rgba(70,192,126,.16)':'rgba(31,138,79,.14)'):P.surface3, color:on?P.good:P.inkMute }}>{on?(r.rotating?'ROTATES':'ON AIR'):'QUEUED'}</span>
                </div>); })}</div>
            </div>))}
        </Card>
      </div>
    </div>
  </div>);
}

// ── 1d — CONFLICT INBOX ───────────────────────────────────────────────────────
function Inbox({ engine, setEngine }){
  const P=useP();
  const pin=(surface,id)=> setEngine(e=>({...e, pins:{...e.pins, [surface]:id}}));
  const rot=(surface)=> setEngine(e=>({...e, rotate:{...e.rotate, [surface]:true}}));
  const reset=(surface)=> setEngine(e=>({...e, pins:{...e.pins,[surface]:undefined}, rotate:{...e.rotate,[surface]:false}}));

  // find contested hero + banner days
  const heroDays = DAYS.filter(d=>{ const r=resolve('home_hero',d.k,engine); return r.contested; });
  const bannerDays = DAYS.filter(d=>{ const r=resolve('home_banner',d.k,engine); return r.contested; });
  const heroResolved = engine.rotate.home_hero || engine.pins.home_hero;
  const bannerResolved = engine.rotate.home_banner || engine.pins.home_banner;
  // sample contested set from Friday for hero, Saturday for banner
  const heroSet = resolve('home_hero', 4, engine);
  const bannerSet = resolve('home_banner', 5, engine);

  const openCount = (heroDays.length&&!heroResolved?1:0)+(bannerDays.length&&!bannerResolved?1:0)+1;

  const Conf=({tone,icon,title,body,children})=>(<div style={{ padding:'15px 16px', borderBottom:`1px solid ${P.hairline}`, display:'flex', gap:13, alignItems:'flex-start' }}>
    <div style={{ width:34, height:34, borderRadius:9, flex:'0 0 auto', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, background: tone==='warn'?P.warnSoft:P.infoSoft, color: tone==='warn'?P.warn:P.info }}>{icon}</div>
    <div style={{ flex:1, minWidth:0 }}><div style={{ fontSize:13.5, fontWeight:700 }}>{title}</div><div style={{ fontSize:12, color:P.inkDim, marginTop:2, lineHeight:1.5 }}>{body}</div><div style={{ display:'flex', gap:8, marginTop:11, flexWrap:'wrap' }}>{children}</div></div>
  </div>);

  return (<Card padding={0} style={{ maxWidth:640 }}>
    <div style={{ padding:'15px 18px', borderBottom:`1px solid ${P.hairline2}` }}><Eyebrow>This week · exception queue</Eyebrow><div style={{ fontSize:18, fontWeight:800, letterSpacing:'-.02em', marginTop:3 }}>{openCount} decision{openCount>1?'s':''} need you</div></div>
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'13px 16px', background:P.mode==='dark'?'rgba(70,192,126,.10)':'rgba(31,138,79,.08)', borderBottom:`1px solid ${P.hairline}` }}>
      <Dot c={P.good} s={9}/><span style={{ fontSize:12.5, fontWeight:600 }}>12 promos auto-placed across the week</span><span style={{ flex:1 }}/><span style={{ fontFamily:P.fontMono, fontSize:11, color:P.inkMute }}>no conflicts</span>
    </div>

    {heroDays.length>0 && !heroResolved && <Conf tone="warn" icon="⚠" title={`Home hero · ${heroDays.map(d=>d.l).join(', ')}`}
      body={<span>{heroSet.elig.length} promos want the single hero. Run them as a <b style={{color:P.ink}}>rotating hero slider</b> (the same carousel the holiday takeover uses), or pin one to feature it — <b style={{color:P.ink}}>{heroSet.onAir[0]?.name}</b> shows now.</span>}>
      <PBtn variant="primary" size="sm" icon="refresh" onClick={()=>rot('home_hero')}>Make it a slider ({heroSet.elig.length})</PBtn>
      <PBtn variant="secondary" size="sm" icon="pin" onClick={()=>pin('home_hero', heroSet.onAir[0]?.id)}>Pin {heroSet.onAir[0]?.name.split(' ')[0]}</PBtn>
    </Conf>}
    {heroResolved && <Conf tone="info" icon="✓" title="Home hero · resolved" body={engine.rotate.home_hero? 'All eligible heroes now rotate through the hero slider.' : `Pinned ${byId(engine.pins.home_hero)?.name} to the hero.`}><PBtn variant="ghost" size="sm" onClick={()=>reset('home_hero')}>Undo</PBtn></Conf>}

    {bannerDays.length>0 && !bannerResolved && <Conf tone="warn" icon="⚠" title={`Home banner · ${bannerDays.map(d=>d.l).join(', ')}`}
      body={<span>{bannerSet.elig.length} promos for {bannerSet.cap} carousel slots. <b style={{color:P.ink}}>{bannerSet.benched.map(p=>p.name).join(' & ')}</b> benched by priority.</span>}>
      <PBtn variant="accent" size="sm" icon="check" onClick={()=>reset('home_banner')}>Keep top {bannerSet.cap}</PBtn>
      <PBtn variant="secondary" size="sm" icon="refresh" onClick={()=>rot('home_banner')}>Rotate all {bannerSet.elig.length}</PBtn>
    </Conf>}
    {bannerResolved && <Conf tone="info" icon="✓" title="Home banner · resolved" body="All eligible banners rotate through the carousel."><PBtn variant="ghost" size="sm" onClick={()=>reset('home_banner')}>Undo</PBtn></Conf>}

    <Conf tone="info" icon="⇄" title="Overlap · Wed" body={<span><b style={{color:P.ink}}>Wax Wednesday</b> and <b style={{color:P.ink}}>Stilo BOGO</b> both hit concentrates. Stack the discounts or keep exclusive?</span>}>
      <PBtn variant="secondary" size="sm" onClick={()=>{}}>Allow stack</PBtn>
      <PBtn variant="primary" size="sm" onClick={()=>{}}>Keep exclusive</PBtn>
    </Conf>
  </Card>);
}

// ── WeekView wrapper ──────────────────────────────────────────────────────────
window.WeekView = function WeekView(){
  const P=useP();
  const [concept,setConcept]=useState('matrix');
  const [engine,setEngine]=useState({ rank:DEFAULT_RANK.slice(), pins:{}, rotate:{} });
  const setRank=(fn)=> setEngine(e=>({...e, rank: typeof fn==='function'?fn(e.rank):fn }));
  const resetAll=()=> setEngine({ rank:DEFAULT_RANK.slice(), pins:{}, rotate:{} });
  const dirty = JSON.stringify(engine)!==JSON.stringify({ rank:DEFAULT_RANK, pins:{}, rotate:{} });

  const CONCEPTS=[
    {id:'matrix', label:'Matrix', icon:'grid', tag:'1a'},
    {id:'inbox',  label:'Conflict inbox', icon:'bell', tag:'1d'},
    {id:'brands', label:'Weekly board', icon:'grid', tag:'1e'},
  ];
  const desc={ matrix:'The whole week as a grid — every cell is auto-resolved. ⚠ marks a slot more promos wanted than it holds.',
    stacks:'Ranked stacks per contested surface. Drag to re-rank — on-air vs benched updates instantly.',
    store:'The actual customer app for any day, beside a list of what\u2019s placed and what\u2019s queued.',
    inbox:'Everything that fits is auto-placed. Only real conflicts surface — resolve them and it flows back to every view.',
    brands:'A weekly deal with 12 brands live: one hero = a creative header, then every category with its brands + discounts. The same brands auto-map to the shop grid. Toggle brands to recompose.' };

  return (<div style={{ maxWidth:1200, margin:'0 auto' }}>
    <SectionHead level={1} eyebrow="Promotions · This week" title="This Week"
      subtitle="15 promotions, limited slots — one hero, a 3-up banner, one grid. The engine maps them onto the week from the promo rules; you never rebuild creative."
      action={dirty && <PBtn variant="secondary" icon="refresh" onClick={resetAll}>Reset changes</PBtn>}/>

    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8, flexWrap:'wrap' }}>
      <div style={{ display:'inline-flex', background:P.surface3, border:`1px solid ${P.hairline2}`, borderRadius:P.r10, padding:3, gap:2 }}>
        {CONCEPTS.map(c=>{ const a=c.id===concept; return (
          <button key={c.id} onClick={()=>setConcept(c.id)} style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'8px 13px', borderRadius:7, border:'none', cursor:'pointer', fontFamily:P.fontSans, fontSize:12.5, fontWeight:600,
            background:a?P.surface:'transparent', color:a?P.ink:P.inkDim, boxShadow:a?P.shadowSm:'none' }}>
            <Icon name={c.icon} size={14} stroke={1.9}/>{c.label}
            <span style={{ fontFamily:P.fontMono, fontSize:9.5, fontWeight:700, padding:'1px 5px', borderRadius:5, background:a?P.accentSoft:P.surface, color:a?(P.mode==='dark'?P.accent:'#7A5A00'):P.inkMute }}>{c.tag}</span>
          </button>); })}
      </div>
    </div>
    <div style={{ fontSize:12.5, color:P.inkDim, marginBottom:20, maxWidth:760, lineHeight:1.5 }}>{desc[concept]}</div>

    {concept==='matrix' && <Matrix engine={engine}/>}
    {concept==='stacks' && <Stacks engine={engine} setRank={setRank}/>}
    {concept==='store'  && <Storefront engine={engine}/>}
    {concept==='inbox'  && <Inbox engine={engine} setEngine={setEngine}/>}
    {concept==='brands' && <BrandMapView/>}
  </div>);
};
