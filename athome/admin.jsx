// ══ Hyperwolf · Shop @ Home — Operator console section ══
// Reuses the POS foundation (window.useP / atoms / Icon). Mounts as window.ShopHomeApp.
;(function(){
const { useState, useMemo, useEffect, useRef } = React;
const useP = window.useP, useTheme = window.useTheme, ThemeProvider = window.ThemeProvider;
const { Icon, Card, Eyebrow, SectionHead, KPI, Spark, Pill, IconBtn, Tabs, Avatar, Field, Switch, DataTable, Check, StrainPill } = window;

// ── helpers ──────────────────────────────────────────────────────────────
const money  = (n)=> '$'+Number(n||0).toLocaleString(undefined,{maximumFractionDigits:0});
const money2 = (n)=> '$'+Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
const TODAY  = 'Wed · Jul 8';

// ── reference data ─────────────────────────────────────────────────────────
const REGIONS = [
  { id:'rancho', name:'Rancho Cucamonga', live:true,  geniuses:2, slots:'9a–9p', wait:'12 min', today:5, cx:0.30, cy:0.34 },
  { id:'riverside', name:'Riverside',     live:true,  geniuses:1, slots:'9a–9p', wait:'28 min', today:3, cx:0.55, cy:0.46 },
  { id:'corona', name:'Corona',           live:true,  geniuses:1, slots:'10a–8p', wait:'22 min', today:2, cx:0.44, cy:0.62 },
  { id:'temecula', name:'Temecula',       live:true,  geniuses:1, slots:'10a–8p', wait:'35 min', today:1, cx:0.72, cy:0.80 },
  { id:'murrieta', name:'Murrieta',       live:false, geniuses:0, slots:'—', wait:'—', today:0, cx:0.80, cy:0.68 },
  { id:'wildomar', name:'Wildomar',       live:false, geniuses:0, slots:'—', wait:'—', today:0, cx:0.66, cy:0.92 },
];

const GENIUSES = [
  { id:'g1', name:'Marcus Vale',  region:'Rancho Cucamonga', status:'in_session', rating:4.9, sessions:3, since:'2024', vehicle:'Tesla Model Y · 8XKR221', phone:'(909) 555-0142', restock:'Full', mx:0.31, my:0.36 },
  { id:'g2', name:'Priya Anand',  region:'Riverside', status:'en_route', rating:4.8, sessions:2, since:'2024', vehicle:'Rivian R1S · 7GHT884', phone:'(951) 555-0198', restock:'Low: carts', mx:0.52, my:0.44 },
  { id:'g3', name:'Dre Coleman',  region:'Corona', status:'available', rating:4.7, sessions:1, since:'2025', vehicle:'Ford Transit · 5RLM320', phone:'(951) 555-0110', restock:'Full', mx:0.45, my:0.60 },
  { id:'g4', name:'Sofia Reyes',  region:'Temecula', status:'available', rating:5.0, sessions:2, since:'2023', vehicle:'Tesla Model Y · 9PQD017', phone:'(951) 555-0176', restock:'Full', mx:0.71, my:0.79 },
  { id:'g5', name:'Jimmy Tran',   region:'Rancho Cucamonga', status:'off', rating:4.6, sessions:0, since:'2025', vehicle:'—', phone:'(909) 555-0155', restock:'—', mx:null, my:null },
];
const geniusBy = id => GENIUSES.find(g=>g.id===id);

const CART_2041 = [
  { name:'Hyperwolf Live Rosin — Papaya', cat:'Concentrate', strain:'Hybrid', thc:78, qty:2, price:55 },
  { name:'Stilo All-in-One — Blue Dream', cat:'Vape', strain:'Sativa', thc:84, qty:1, price:45 },
  { name:'Pleasure Med Sleep Gummies 10:1', cat:'Edibles', strain:'Indica', thc:5, qty:2, price:28 },
  { name:'Hyperwolf Preroll 5-pack — GMO', cat:'Pre-roll', strain:'Indica', thc:31, qty:1, price:40 },
  { name:'Kine CBN Tincture 1:3', cat:'Tincture', strain:null, thc:0, qty:1, price:52 },
];

const CHAT_2041 = [
  { who:'cx', t:'2:02p', m:"Hey! Looking to restock on live rosin carts and something for sleep 😴" },
  { who:'sys', t:'2:02p', m:'Marcus Vale assigned · en route from Rancho Cucamonga' },
  { who:'genius', t:'2:04p', m:"On my way Reggie — ETA 11 min. I've got the Papaya rosin you liked last time plus a new Sleep 10:1 gummy." },
  { who:'cx', t:'2:05p', m:"Perfect. Also — do you have the Hyperwolf hoodie in L?" },
  { who:'genius', t:'2:06p', m:"I do, grabbing one for you. See you soon." },
  { who:'sys', t:'2:17p', m:'Marcus arrived · session started' },
];

const TIMELINE_2041 = [
  { k:'Requested', t:'1:41p', done:true, meta:'Via app · Rancho Cucamonga' },
  { k:'Deposit paid', t:'1:42p', done:true, meta:'$100 · Visa •• 4021' },
  { k:'Confirmed', t:'1:44p', done:true, meta:'Window 2:00–2:45p' },
  { k:'Genius assigned', t:'1:52p', done:true, meta:'Marcus Vale' },
  { k:'En route', t:'2:02p', done:true, meta:'ETA 2:15p · 4.2 mi' },
  { k:'Arrived', t:'2:17p', done:true, meta:'On time' },
  { k:'In session', t:'2:17p', done:true, meta:'Active now · 18 min elapsed', now:true },
  { k:'Checkout', t:'—', done:false, meta:'Balance on file' },
  { k:'Completed', t:'—', done:false, meta:'' },
];

// appointments (today Jul 8 + a couple queued)
const APPTS = [
  { id:'A-2041', cust:'Reggie Watts', tier:'Gold', region:'Rancho Cucamonga', addr:'1200 block · Vineyard Ave', win:'2:00–2:45p', genius:'g1', status:'in_session', cart:CART_2041, deposit:'paid', dep:100, subtotal:358, notes:"Restock live rosin carts + something for sleep. Open to recs. Bring Hyperwolf hoodie (L) if available.", orders:34, ltv:8240, member:'2 yr' },
  { id:'A-2042', cust:'Dana Cho', tier:'Silver', region:'Riverside', addr:'Canyon Crest · Big Springs', win:'3:30–4:15p', genius:'g2', status:'en_route', cart:[], deposit:'paid', dep:100, subtotal:0, notes:"First house call. Wants to browse vapes + a starter edible. Gate code 4417.", orders:6, ltv:640, member:'4 mo' },
  { id:'A-2043', cust:'Leo Park', tier:'Gold', region:'Corona', addr:'Sierra Del Oro', win:'4:00–4:45p', genius:'g3', status:'confirmed', cart:[], deposit:'paid', dep:100, subtotal:0, notes:"Repeat. Usual flower order + trying concentrates. Dog on property (friendly).", orders:22, ltv:4100, member:'1 yr' },
  { id:'A-2044', cust:'Mia Flores', tier:'Silver', region:'Temecula', addr:'Redhawk', win:'5:15–6:00p', genius:'g4', status:'confirmed', cart:[], deposit:'paid', dep:100, subtotal:0, notes:"Birthday. Asked about the BOGO preroll deal + a gift for a friend.", orders:11, ltv:1350, member:'8 mo' },
  { id:'A-2045', cust:'Jordan Blake', tier:'Gold', region:'Rancho Cucamonga', addr:'Etiwanda', win:'6:30–7:15p', genius:null, status:'requested', cart:[], deposit:'pending', dep:0, subtotal:0, notes:"VIP. Large restock ~$500. Prefers Marcus if available.", orders:41, ltv:11200, member:'3 yr' },
  { id:'A-2039', cust:'Wesley Kim', tier:'Silver', region:'Riverside', addr:'Orangecrest', win:'12:00–12:45p', genius:'g2', status:'completed', cart:[], deposit:'applied', dep:100, subtotal:356, notes:"Wanted sativa vapes for a hike.", rating:5, tip:40, dur:'31 min', orders:9, ltv:1120, member:'6 mo' },
  { id:'A-2038', cust:'Tara Nguyen', tier:'Bronze', region:'Corona', addr:'Coronita', win:'11:00–11:45a', genius:'g3', status:'completed', cart:[], deposit:'applied', dep:100, subtotal:189, notes:"New member, curious about edibles dosing.", rating:4, tip:15, dur:'44 min', orders:2, ltv:210, member:'2 wk' },
  { id:'A-2046', cust:'Sam Ortiz', tier:'—', region:'Murrieta', addr:'—', win:'—', genius:null, status:'canceled', cart:[], deposit:'refunded', dep:0, subtotal:0, notes:"Address outside live zone — auto-declined, deposit refunded.", orders:0, ltv:0, member:'—' },
];
const apptBy = id => APPTS.find(a=>a.id===id);

const STATUS = {
  requested:  { label:'Requested', kind:'warn', dot:true },
  confirmed:  { label:'Confirmed', kind:'info', dot:true },
  en_route:   { label:'En route',  kind:'info', dot:true },
  in_session: { label:'In session',kind:'good', dot:true },
  completed:  { label:'Completed', kind:'neutral' },
  canceled:   { label:'Canceled',  kind:'bad' },
};
const GSTATUS = {
  available:  { label:'Available', kind:'good' },
  en_route:   { label:'En route',  kind:'info' },
  in_session: { label:'In session',kind:'warn' },
  off:        { label:'Off shift', kind:'neutral' },
};

// ── small ui bits ────────────────────────────────────────────────────────
function Money({ n, size=13, dim, strong }){ const P=useP(); return <span className="mono" style={{ fontFamily:P.fontMono, fontVariantNumeric:'tabular-nums', fontSize:size, color:dim?P.inkDim:P.ink, fontWeight:strong?700:600 }}>{money(n)}</span>; }
function Field2(){}

function Btn({ children, kind='ghost', icon, iconR, sm, onClick, style }){
  const P=useP(); const [h,setH]=useState(false);
  const base={ display:'inline-flex', alignItems:'center', gap:7, padding:sm?'7px 12px':'9px 15px', fontSize:sm?12.5:13.5, fontWeight:600, borderRadius:P.r10, cursor:'pointer', border:'1px solid transparent', fontFamily:P.fontSans, transition:'all .13s', whiteSpace:'nowrap' };
  const styles={
    primary:{ background:P.accent, color:P.accentInk, borderColor:P.accentBorder, boxShadow:h?P.shadowMd:P.shadowSm },
    dark:{ background:P.ink, color:P.surface, boxShadow:h?P.shadowMd:'none' },
    ghost:{ background:h?P.surface3:'transparent', color:P.ink, borderColor:P.hairline2 },
    quiet:{ background:'transparent', color:P.inkDim, borderColor:'transparent' },
  };
  return <button onClick={()=>railGo(item)} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} onClick={onClick} style={{ ...base, ...styles[kind], ...style }}>{icon&&<Icon name={icon} size={sm?14:15} stroke={2}/>}{children}{iconR&&<Icon name={iconR} size={sm?14:15} stroke={2}/>}</button>;
}

function StatCol({ label, children, mono=true }){ const P=useP(); return (
  <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
    <div style={{ fontSize:10, letterSpacing:'.1em', textTransform:'uppercase', color:P.inkMute, fontWeight:600 }}>{label}</div>
    <div className={mono?'mono':''} style={{ fontSize:13.5, color:P.ink, fontWeight:600, fontFamily:mono?P.fontMono:P.fontSans }}>{children}</div>
  </div>); }

// ── RAIL ────────────────────────────────────────────────────────────────
// The rail is shared by every Hyperwolf app — see shared/app-rail.jsx.
function Rail(){ return <window.HWRail active="shophome"/>; }

function TopBar(){
  const P=useP(); const { mode, toggle }=useTheme();
  return (<header style={{ height:60, flex:'0 0 60px', display:'flex', alignItems:'center', gap:14, padding:'0 22px', borderBottom:`1px solid ${P.hairline2}`, background:P.surface }}>
    <button style={{ display:'inline-flex', alignItems:'center', gap:9, padding:'7px 13px', borderRadius:99, background:P.surface3, border:`1px solid ${P.hairline2}`, cursor:'pointer', color:P.ink }}>
      <span style={{ width:7, height:7, borderRadius:99, background:P.good }}/>
      <span style={{ fontSize:12.5, fontWeight:700, letterSpacing:'.02em' }}>ALL STORES</span>
      <Icon name="chevron-down" size={14} stroke={2} color={P.inkDim}/>
    </button>
    <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 12px', borderRadius:99, background:P.accentSoft, border:`1px solid ${P.accentBorder}` }}>
      <Icon name="route" size={14} color={P.mode==='dark'?P.accent:P.accentInk} stroke={2}/>
      <span style={{ fontSize:11.5, fontWeight:700, color:P.mode==='dark'?P.accent:P.accentInk }}>4 regions live · 11 house calls today</span>
    </div>
    <div style={{ flex:1 }}/>
    <IconBtn icon="search" title="Search"/>
    <IconBtn icon="bell" badge={2} title="Alerts"/>
    <button onClick={toggle} title="Toggle theme" style={{ width:38, height:38, borderRadius:10, border:'none', background:'transparent', cursor:'pointer', color:P.inkDim, display:'flex', alignItems:'center', justifyContent:'center' }}><Icon name={mode==='dark'?'sun':'moon'} size={18}/></button>
    <div style={{ display:'flex', alignItems:'center', gap:9, paddingLeft:6 }}>
      <Avatar name="Manisha Saini" size={34} hue={172}/>
      <div style={{ lineHeight:1.15 }}><div style={{ fontSize:12.5, fontWeight:700, color:P.ink }}>Manisha Saini</div><div style={{ fontSize:10.5, color:P.inkMute }}>Dispatch · Ops</div></div>
    </div>
  </header>);
}

// ── STATUS DOT ────────────────────────────────────────────────────────────
function LiveDot({ kind='good', pulse }){ const P=useP(); const c=P[kind]||P.good; return (
  <span style={{ position:'relative', width:8, height:8, flex:'0 0 auto' }}>
    <span style={{ position:'absolute', inset:0, borderRadius:99, background:c }}/>
    {pulse && <span style={{ position:'absolute', inset:-3, borderRadius:99, border:`1.5px solid ${c}`, animation:'shPing 1.8s ease-out infinite' }}/>}
  </span>); }

// ══ VIEW: BOARD (appointments) ══════════════════════════════════════════
function BoardView({ onOpen }){
  const P=useP();
  const [tab,setTab]=useState('today');
  const [q,setQ]=useState('');
  const counts = useMemo(()=>({
    today: APPTS.filter(a=>a.status!=='canceled').length,
    live: APPTS.filter(a=>['en_route','in_session'].includes(a.status)).length,
    requested: APPTS.filter(a=>a.status==='requested').length,
    completed: APPTS.filter(a=>a.status==='completed').length,
    canceled: APPTS.filter(a=>a.status==='canceled').length,
  }),[]);
  const filtered = useMemo(()=> APPTS.filter(a=>{
    if(tab==='live' && !['en_route','in_session'].includes(a.status)) return false;
    if(tab==='requested' && a.status!=='requested') return false;
    if(tab==='completed' && a.status!=='completed') return false;
    if(tab==='canceled' && a.status!=='canceled') return false;
    if(q && !(a.cust+a.id+a.region).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }),[tab,q]);

  const kpis=[
    { label:'House calls today', value:'11', icon:'route', delta:22, deltaKind:'good', spark:[6,8,7,9,8,10,11] },
    { label:'Live now', value:'2', hint:'en route · in session', icon:'target', accent:true },
    { label:'Avg session value', value:'$317', icon:'dollar', delta:8, deltaKind:'good' },
    { label:'Avg wait to arrive', value:'24 min', icon:'clock', delta:-6, deltaKind:'good' },
    { label:'Deposit held', value:'$400', hint:'4 open', icon:'wallet' },
  ];

  return (<div style={{ padding:'26px 30px 60px', display:'flex', flexDirection:'column', gap:20 }}>
    <SectionHead level={1} eyebrow="Shop @ Home" title="Appointments" subtitle="Every VIP house call across all live regions. Assign a genius, watch it run, settle the balance." action={<div style={{ display:'flex', gap:9 }}><Btn kind="ghost" icon="download">Export</Btn><Btn kind="primary" icon="plus">New house call</Btn></div>}/>
    <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12 }}>{kpis.map((k,i)=><KPI key={i} {...k}/>)}</div>

    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, marginTop:4 }}>
      <Tabs value={tab} onChange={setTab} options={[
        {value:'today', label:`Today ${counts.today}`},
        {value:'live', label:`Live ${counts.live}`},
        {value:'requested', label:`Needs assign ${counts.requested}`},
        {value:'completed', label:`Completed ${counts.completed}`},
        {value:'canceled', label:`Canceled ${counts.canceled}`},
      ]}/>
      <div style={{ width:280 }}><Field icon="search" placeholder="Search customer, ID, region…" value={q} onChange={e=>setQ(e.target.value)} size="sm"/></div>
    </div>

    <div style={{ border:`1px solid ${P.hairline2}`, borderRadius:P.r14, overflow:'hidden', background:P.surface }}>
      <div style={{ display:'grid', gridTemplateColumns:'150px 1.4fr 1.2fr 130px 1fr 120px 40px', gap:0, padding:'11px 18px', background:P.surface2, borderBottom:`1px solid ${P.hairline2}`, fontSize:10.5, fontWeight:600, letterSpacing:'.08em', textTransform:'uppercase', color:P.inkDim }}>
        <div>Window · ID</div><div>Customer</div><div>Region · Address</div><div>Genius</div><div>Status</div><div style={{textAlign:'right'}}>Cart · Deposit</div><div/>
      </div>
      {filtered.map((a,i)=>{ const g=geniusBy(a.genius); const st=STATUS[a.status]; return (
        <div key={a.id} onClick={()=>onOpen(a.id)} style={{ display:'grid', gridTemplateColumns:'150px 1.4fr 1.2fr 130px 1fr 120px 40px', gap:0, padding:'14px 18px', borderTop:i?`1px solid ${P.hairline}`:'none', alignItems:'center', cursor:'pointer', transition:'background .1s' }}
          onMouseEnter={e=>e.currentTarget.style.background=P.surface2} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
          <div><div className="mono" style={{ fontSize:13, fontWeight:700, color:P.ink, fontVariantNumeric:'tabular-nums' }}>{a.win}</div><div className="mono" style={{ fontSize:10.5, color:P.inkMute }}>{a.id}</div></div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}><Avatar name={a.cust} size={32} crown={a.tier==='Gold'}/><div><div style={{ fontSize:13.5, fontWeight:600, color:P.ink }}>{a.cust}</div><div style={{ fontSize:11, color:P.inkMute }}>{a.tier!=='—'?`${a.tier} · ${a.member}`:'Non-member'}</div></div></div>
          <div><div style={{ fontSize:12.5, color:P.ink, fontWeight:500 }}>{a.region}</div><div style={{ fontSize:11, color:P.inkMute }}>{a.addr}</div></div>
          <div>{g? <div style={{ display:'flex', alignItems:'center', gap:7 }}><Avatar name={g.name} size={24}/><span style={{ fontSize:12, color:P.ink, fontWeight:500 }}>{g.name.split(' ')[0]}</span></div> : <Pill kind="warn" soft>Unassigned</Pill>}</div>
          <div><Pill kind={st.kind} soft dot={st.dot}>{st.label}</Pill>{a.status==='completed'&&a.rating&&<span className="mono" style={{ marginLeft:7, fontSize:11.5, color:P.inkDim }}>★ {a.rating.toFixed(1)}</span>}</div>
          <div style={{ textAlign:'right' }}>{a.subtotal? <Money n={a.subtotal} strong/> : <span style={{ fontSize:12.5, color:P.inkMute }}>—</span>}<div className="mono" style={{ fontSize:10.5, color:a.deposit==='pending'?P.warn:P.inkMute, marginTop:1 }}>{a.deposit==='pending'?'deposit due':`dep ${a.deposit}`}</div></div>
          <div style={{ textAlign:'right', color:P.inkFaint }}><Icon name="chevron-right" size={18}/></div>
        </div>); })}
    </div>
  </div>);
}

// ══ VIEW: LIVE MAP ═══════════════════════════════════════════════════════
function MapView({ onOpen }){
  const P=useP();
  const [sel,setSel]=useState('g1');
  const active = APPTS.filter(a=>['en_route','in_session','confirmed'].includes(a.status));
  return (<div style={{ padding:'26px 30px 40px', display:'flex', flexDirection:'column', gap:18, height:'100%' }}>
    <SectionHead level={1} eyebrow="Shop @ Home · Live" title="Field map" subtitle="Where every genius is right now, and the house calls in flight across the four live regions."/>
    <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:16, flex:1, minHeight:0 }}>
      {/* map */}
      <div style={{ position:'relative', borderRadius:P.r16, overflow:'hidden', border:`1px solid ${P.hairline2}`, background:P.mode==='dark'?'#0b0f0d':'#e9efe8', minHeight:520 }}>
        <div style={{ position:'absolute', inset:0, backgroundImage:`linear-gradient(${P.hairline} 1px, transparent 1px), linear-gradient(90deg, ${P.hairline} 1px, transparent 1px)`, backgroundSize:'44px 44px', opacity:.5 }}/>
        {/* freeway lines */}
        <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%' }} preserveAspectRatio="none" viewBox="0 0 100 100">
          <path d="M6 30 L60 40 L78 78" fill="none" stroke={P.mode==='dark'?'#1c2620':'#d3ddcf'} strokeWidth="1.4"/>
          <path d="M28 12 L44 62 L70 96" fill="none" stroke={P.mode==='dark'?'#1c2620':'#d3ddcf'} strokeWidth="1.4"/>
        </svg>
        {/* region blobs */}
        {REGIONS.filter(r=>r.live).map(r=>(
          <div key={r.id} style={{ position:'absolute', left:`${r.cx*100}%`, top:`${r.cy*100}%`, transform:'translate(-50%,-50%)', width:150, height:150, borderRadius:'50%', background:`radial-gradient(circle, ${P.accent}22, transparent 70%)`, pointerEvents:'none' }}/>
        ))}
        {REGIONS.map(r=>(
          <div key={r.id+'l'} style={{ position:'absolute', left:`${r.cx*100}%`, top:`${r.cy*100}%`, transform:'translate(-50%,-50%)', textAlign:'center', pointerEvents:'none' }}>
            <div style={{ fontSize:11, fontWeight:700, color:r.live?P.ink:P.inkFaint, letterSpacing:'.02em', whiteSpace:'nowrap' }}>{r.name}</div>
            <div className="mono" style={{ fontSize:9.5, color:r.live?P.inkMute:P.inkFaint }}>{r.live?`${r.today} today · ${r.wait}`:'not live'}</div>
          </div>
        ))}
        {/* genius pins */}
        {GENIUSES.filter(g=>g.mx!=null).map(g=>{ const gs=GSTATUS[g.status]; const c=P[gs.kind]; const on=sel===g.id; return (
          <button key={g.id} onClick={()=>setSel(g.id)} style={{ position:'absolute', left:`${g.mx*100}%`, top:`${g.my*100}%`, transform:'translate(-50%,-100%)', border:'none', background:'transparent', cursor:'pointer', zIndex:on?5:2 }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', filter:on?`drop-shadow(0 6px 12px ${P.scrim})`:'none' }}>
              <div style={{ padding:'3px 8px 3px 4px', background:P.surface, border:`1.5px solid ${on?c:P.hairline2}`, borderRadius:99, display:'flex', alignItems:'center', gap:5, boxShadow:P.shadowSm }}>
                <Avatar name={g.name} size={20}/><span style={{ fontSize:11, fontWeight:700, color:P.ink }}>{g.name.split(' ')[0]}</span>
                {g.status==='en_route'&&<Icon name="route" size={12} color={c}/>}
              </div>
              <div style={{ width:2, height:12, background:on?c:P.hairline3 }}/>
              <div style={{ width:9, height:9, borderRadius:99, background:c, border:`2px solid ${P.surface}` }}/>
            </div>
          </button>); })}
      </div>
      {/* side panel */}
      <div style={{ display:'flex', flexDirection:'column', gap:12, minHeight:0 }}>
        <Card padding={0} style={{ overflow:'hidden' }}>
          <div style={{ padding:'12px 15px', background:P.surface2, borderBottom:`1px solid ${P.hairline2}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:11.5, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', color:P.inkDim }}>Geniuses · live</span>
            <LiveDot kind="good" pulse/>
          </div>
          {GENIUSES.map((g,i)=>{ const gs=GSTATUS[g.status]; return (
            <div key={g.id} onClick={()=>setSel(g.id)} style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 15px', borderTop:i?`1px solid ${P.hairline}`:'none', cursor:'pointer', background:sel===g.id?P.accentSoft:'transparent' }}>
              <Avatar name={g.name} size={30}/>
              <div style={{ flex:1, minWidth:0 }}><div style={{ fontSize:12.5, fontWeight:600, color:P.ink }}>{g.name}</div><div style={{ fontSize:10.5, color:P.inkMute }}>{g.region}</div></div>
              <Pill kind={gs.kind} soft>{gs.label}</Pill>
            </div>); })}
        </Card>
        <Card padding={0} style={{ overflow:'hidden', flex:1 }}>
          <div style={{ padding:'12px 15px', background:P.surface2, borderBottom:`1px solid ${P.hairline2}` }}><span style={{ fontSize:11.5, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', color:P.inkDim }}>In flight · {active.length}</span></div>
          {active.map((a,i)=>{ const g=geniusBy(a.genius); const st=STATUS[a.status]; return (
            <div key={a.id} onClick={()=>onOpen(a.id)} style={{ padding:'11px 15px', borderTop:i?`1px solid ${P.hairline}`:'none', cursor:'pointer' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}><span style={{ fontSize:12.5, fontWeight:600, color:P.ink }}>{a.cust}</span><Pill kind={st.kind} soft dot={st.dot}>{st.label}</Pill></div>
              <div style={{ fontSize:11, color:P.inkMute, marginTop:2 }}>{a.win} · {a.region}{g?` · ${g.name.split(' ')[0]}`:''}</div>
            </div>); })}
        </Card>
      </div>
    </div>
  </div>);
}

// ══ VIEW: GENIUSES (roster) ═══════════════════════════════════════════════
function GeniusesView(){
  const P=useP();
  return (<div style={{ padding:'26px 30px 60px', display:'flex', flexDirection:'column', gap:20 }}>
    <SectionHead level={1} eyebrow="Shop @ Home" title="Genius roster" subtitle="Your in-home team — shift status, restock level, ratings and today's load." action={<Btn kind="primary" icon="user-plus">Add genius</Btn>}/>
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
      <KPI label="On shift" value="4" hint="of 5" icon="user-check" accent/>
      <KPI label="In session" value="1" icon="target"/>
      <KPI label="Avg rating" value="4.8" icon="star" delta={2} deltaKind="good"/>
      <KPI label="Restock alerts" value="1" hint="Priya · carts" icon="box-add"/>
    </div>
    <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:14 }}>
      {GENIUSES.map(g=>{ const gs=GSTATUS[g.status]; return (
        <Card key={g.id} hover padding={0} style={{ overflow:'hidden' }}>
          <div style={{ display:'flex', gap:14, padding:16 }}>
            <Avatar name={g.name} size={54}/>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:9 }}><span style={{ fontSize:16, fontWeight:700, color:P.ink }}>{g.name}</span><Pill kind={gs.kind} soft dot>{gs.label}</Pill></div>
              <div style={{ fontSize:12, color:P.inkMute, marginTop:2 }}>{g.region} · genius since {g.since}</div>
              <div style={{ display:'flex', gap:20, marginTop:12 }}>
                <StatCol label="Rating">★ {g.rating.toFixed(1)}</StatCol>
                <StatCol label="Today">{g.sessions} sessions</StatCol>
                <StatCol label="Restock" mono={false}><span style={{ color:g.restock.startsWith('Low')?P.warn:P.good }}>{g.restock}</span></StatCol>
              </div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:14, padding:'11px 16px', background:P.surface2, borderTop:`1px solid ${P.hairline}`, fontSize:11.5, color:P.inkDim }}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}><Icon name="cart" size={14}/> {g.vehicle}</span>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}><Icon name="phone" size={13}/> {g.phone}</span>
            <div style={{ flex:1 }}/>
            <Btn kind="ghost" sm icon="route">Assign</Btn>
          </div>
        </Card>); })}
    </div>
  </div>);
}

// ══ VIEW: REGIONS (config) ════════════════════════════════════════════════
function RegionsView(){
  const P=useP();
  const [rows,setRows]=useState(REGIONS);
  const toggle=(id)=>setRows(rs=>rs.map(r=>r.id===id?{...r,live:!r.live}:r));
  return (<div style={{ padding:'26px 30px 60px', display:'flex', flexDirection:'column', gap:20 }}>
    <SectionHead level={1} eyebrow="Shop @ Home · Setup" title="Regions & availability" subtitle="Turn service zones on and off, set operating windows, and control the guardrails for every house call." action={<Btn kind="primary" icon="plus">Add region</Btn>}/>
    <div style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:16, alignItems:'start' }}>
      <div style={{ border:`1px solid ${P.hairline2}`, borderRadius:P.r14, overflow:'hidden', background:P.surface }}>
        <div style={{ display:'grid', gridTemplateColumns:'1.4fr 90px 100px 90px 70px', padding:'11px 18px', background:P.surface2, borderBottom:`1px solid ${P.hairline2}`, fontSize:10.5, fontWeight:600, letterSpacing:'.08em', textTransform:'uppercase', color:P.inkDim }}>
          <div>Region</div><div>Geniuses</div><div>Window</div><div>Today</div><div style={{textAlign:'right'}}>Live</div>
        </div>
        {rows.map((r,i)=>(
          <div key={r.id} style={{ display:'grid', gridTemplateColumns:'1.4fr 90px 100px 90px 70px', padding:'14px 18px', borderTop:i?`1px solid ${P.hairline}`:'none', alignItems:'center' }}>
            <div style={{ display:'flex', alignItems:'center', gap:9 }}><Icon name="map" size={16} color={r.live?P.ink:P.inkFaint}/><span style={{ fontSize:13.5, fontWeight:600, color:r.live?P.ink:P.inkMute }}>{r.name}</span></div>
            <div className="mono" style={{ fontSize:13, color:P.inkDim }}>{r.geniuses||'—'}</div>
            <div className="mono" style={{ fontSize:12, color:P.inkDim }}>{r.slots}</div>
            <div className="mono" style={{ fontSize:13, color:P.ink }}>{r.today}</div>
            <div style={{ textAlign:'right' }}><Switch on={r.live} onChange={()=>toggle(r.id)}/></div>
          </div>
        ))}
      </div>
      <Card>
        <Eyebrow>Global guardrails</Eyebrow>
        <div style={{ marginTop:14, display:'flex', flexDirection:'column', gap:0 }}>
          {[['Minimum order','$150'],['Deposit (refundable)','$100'],['Max session length','45 min'],['Service radius','15 mi from hub'],['Booking window','Same-day + 3 days'],['Buffer between calls','30 min']].map((row,i)=>(
            <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0', borderTop:i?`1px solid ${P.hairline}`:'none' }}>
              <span style={{ fontSize:13, color:P.inkDim }}>{row[0]}</span>
              <span className="mono" style={{ fontSize:13.5, fontWeight:700, color:P.ink }}>{row[1]}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop:16, display:'flex', flexDirection:'column', gap:12 }}>
          {[['VIP members only','Restrict house calls to Gold + invited tiers',true],['ID scan on arrival','Genius must scan ID before session',true],['Auto-decline out of zone','Refund deposit automatically',true]].map((row,i)=>(
            <div key={i} style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
              <div><div style={{ fontSize:13, fontWeight:600, color:P.ink }}>{row[0]}</div><div style={{ fontSize:11.5, color:P.inkMute }}>{row[1]}</div></div>
              <Switch on={row[2]} onChange={()=>{}}/>
            </div>
          ))}
        </div>
      </Card>
    </div>
  </div>);
}

// ══ APPOINTMENT DETAIL (drawer) ═══════════════════════════════════════════
function ApptDetail({ id, onClose }){
  const P=useP(); const a=apptBy(id); const g=geniusBy(a.genius);
  const [tab,setTab]=useState('overview');
  const st=STATUS[a.status];
  const cartTotal = (a.cart||[]).reduce((s,it)=>s+it.price*it.qty,0);
  const isDone = a.status==='completed';

  const Section=({title,children,right})=> (<div style={{ display:'flex', flexDirection:'column', gap:12 }}>
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}><Eyebrow>{title}</Eyebrow>{right}</div>{children}</div>);

  return (<div style={{ position:'fixed', inset:0, zIndex:50, display:'flex', justifyContent:'flex-end' }}>
    <div onClick={onClose} style={{ position:'absolute', inset:0, background:P.scrim, backdropFilter:'blur(2px)' }}/>
    <div style={{ position:'relative', width:'min(720px, 94vw)', background:P.bg, borderLeft:`1px solid ${P.hairline2}`, boxShadow:P.shadowLg, display:'flex', flexDirection:'column', animation:'shSlide .28s cubic-bezier(.2,.8,.2,1)' }}>
      {/* header */}
      <div style={{ padding:'18px 24px', borderBottom:`1px solid ${P.hairline2}`, background:P.surface, display:'flex', alignItems:'center', gap:14 }}>
        <Avatar name={a.cust} size={44} crown={a.tier==='Gold'}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}><span style={{ fontSize:18, fontWeight:700, color:P.ink }}>{a.cust}</span><Pill kind={st.kind} soft dot={st.dot}>{st.label}</Pill></div>
          <div className="mono" style={{ fontSize:11.5, color:P.inkMute, marginTop:2 }}>{a.id} · {a.tier!=='—'?`${a.tier} member · ${a.member}`:'Non-member'} · {a.orders} orders · LTV {money(a.ltv)}</div>
        </div>
        <IconBtn icon="phone" title="Call"/>
        <IconBtn icon="x" onClick={onClose} title="Close"/>
      </div>
      {/* meta strip */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:0, background:P.surface, borderBottom:`1px solid ${P.hairline2}` }}>
        {[['Window',a.win],['Region',a.region],['Genius',g?g.name:'Unassigned'],['Deposit',a.deposit==='pending'?'Due $100':`$${a.dep} ${a.deposit}`]].map((m,i)=>(
          <div key={i} style={{ padding:'12px 20px', borderLeft:i?`1px solid ${P.hairline}`:'none' }}>
            <div style={{ fontSize:9.5, letterSpacing:'.1em', textTransform:'uppercase', color:P.inkMute, fontWeight:600 }}>{m[0]}</div>
            <div style={{ fontSize:13, fontWeight:600, color:P.ink, marginTop:3 }}>{m[1]}</div>
          </div>
        ))}
      </div>
      {/* tabs */}
      <div style={{ padding:'0 24px', background:P.surface, borderBottom:`1px solid ${P.hairline2}` }}>
        <Tabs value={tab} onChange={setTab} options={[
          {value:'overview',label:'Overview'},{value:'cart',label:`Cart ${(a.cart||[]).length||''}`.trim()},{value:'timeline',label:'Timeline'},{value:'chat',label:'Chat'},{value:'deposit',label:'Payment'},...(isDone?[{value:'report',label:'Report'}]:[])
        ]}/>
      </div>
      {/* body */}
      <div style={{ flex:1, overflow:'auto', padding:'22px 24px', display:'flex', flexDirection:'column', gap:24 }}>
        {tab==='overview' && (<>
          <Section title="What the customer said">
            <div style={{ padding:16, background:P.accentSoft, border:`1px solid ${P.accentBorder}`, borderRadius:P.r12, display:'flex', gap:12 }}>
              <Icon name="note" size={18} color={P.mode==='dark'?P.accent:P.accentInk}/>
              <div style={{ fontSize:14, lineHeight:1.55, color:P.ink, fontStyle:'italic' }}>“{a.notes}”</div>
            </div>
          </Section>
          {a.status==='requested' && (
            <Section title="Assign a genius" right={<span style={{ fontSize:11.5, color:P.warn, fontWeight:600 }}>Waiting since 1:52p</span>}>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {GENIUSES.filter(x=>x.status!=='off').map(x=>{ const xs=GSTATUS[x.status]; const match=x.region===a.region; return (
                  <div key={x.id} style={{ display:'flex', alignItems:'center', gap:11, padding:'10px 12px', border:`1px solid ${match?P.accentBorder:P.hairline2}`, borderRadius:P.r10, background:match?P.accentSoft:P.surface }}>
                    <Avatar name={x.name} size={30}/>
                    <div style={{ flex:1 }}><div style={{ fontSize:13, fontWeight:600, color:P.ink }}>{x.name} {match&&<span style={{ fontSize:10.5, color:P.mode==='dark'?P.accent:P.accentInk, fontWeight:700 }}>· in zone</span>}</div><div style={{ fontSize:11, color:P.inkMute }}>{x.region} · ★ {x.rating} · {x.sessions} today</div></div>
                    <Pill kind={xs.kind} soft>{xs.label}</Pill>
                    <Btn kind={match?'primary':'ghost'} sm>Assign</Btn>
                  </div>); })}
              </div>
            </Section>
          )}
          {g && (
            <Section title="Assigned genius">
              <Card padding={14} style={{ display:'flex', alignItems:'center', gap:13 }}>
                <Avatar name={g.name} size={40}/>
                <div style={{ flex:1 }}><div style={{ fontSize:14, fontWeight:700, color:P.ink }}>{g.name}</div><div style={{ fontSize:11.5, color:P.inkMute }}>{g.vehicle}</div></div>
                <StatCol label="Rating">★ {g.rating.toFixed(1)}</StatCol>
                <StatCol label="ETA">{a.status==='en_route'?'2:15p':a.status==='in_session'?'On site':'—'}</StatCol>
                <Btn kind="ghost" sm icon="phone">Call</Btn>
              </Card>
            </Section>
          )}
          <Section title="Delivery address" right={<Btn kind="quiet" sm icon="external">Open map</Btn>}>
            <Card padding={14} style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:44, height:44, borderRadius:10, background:P.surface3, display:'flex', alignItems:'center', justifyContent:'center' }}><Icon name="map" size={20} color={P.inkDim}/></div>
              <div><div style={{ fontSize:13.5, fontWeight:600, color:P.ink }}>{a.addr}</div><div style={{ fontSize:11.5, color:P.inkMute }}>{a.region}, CA · exact address unlocked for assigned genius</div></div>
            </Card>
          </Section>
        </>)}

        {tab==='cart' && (<>
          <Section title={a.cart&&a.cart.length?'Cart built on-site':'Cart'} right={g&&a.status==='in_session'?<Pill kind="good" soft dot>Building live · {g.name.split(' ')[0]}</Pill>:null}>
            {a.cart&&a.cart.length? (<div style={{ border:`1px solid ${P.hairline2}`, borderRadius:P.r12, overflow:'hidden', background:P.surface }}>
              {a.cart.map((it,i)=>(
                <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 15px', borderTop:i?`1px solid ${P.hairline}`:'none' }}>
                  <div style={{ width:40, height:40, borderRadius:8, background:P.surface3, display:'flex', alignItems:'center', justifyContent:'center', flex:'0 0 auto' }}><Icon name="leaf" size={18} color={P.inkDim}/></div>
                  <div style={{ flex:1, minWidth:0 }}><div style={{ fontSize:13, fontWeight:600, color:P.ink }}>{it.name}</div><div style={{ marginTop:3 }}>{it.strain&&<StrainPill type={it.strain} thc={it.thc}/>}<span style={{ fontSize:11, color:P.inkMute, marginLeft:it.strain?8:0 }}>{it.cat}</span></div></div>
                  <span className="mono" style={{ fontSize:12.5, color:P.inkDim }}>×{it.qty}</span>
                  <Money n={it.price*it.qty} strong/>
                </div>
              ))}
            </div>) : <div style={{ padding:'30px', textAlign:'center', color:P.inkMute, fontSize:13, border:`1px dashed ${P.hairline3}`, borderRadius:P.r12 }}>Cart is empty — the genius builds it live during the visit.</div>}
          </Section>
          {a.cart&&a.cart.length>0 && (
            <div style={{ marginLeft:'auto', width:280, display:'flex', flexDirection:'column', gap:8 }}>
              {[['Subtotal',cartTotal],['VIP member (10%)',-Math.round(cartTotal*0.1)],['Taxes & fees',Math.round(cartTotal*0.9*0.27)]].map((r,i)=>(
                <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12.5, color:P.inkDim }}><span>{r[0]}</span><span className="mono">{r[1]<0?'−':''}{money(Math.abs(r[1]))}</span></div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', paddingTop:9, borderTop:`1px solid ${P.hairline2}` }}><span style={{ fontSize:13.5, fontWeight:700, color:P.ink }}>Est. total</span><Money n={Math.round(cartTotal*0.9*1.27)} strong size={15}/></div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:P.good }}><span>− Deposit applied</span><span className="mono">−{money(a.dep)}</span></div>
            </div>
          )}
        </>)}

        {tab==='timeline' && (
          <Section title="Session timeline">
            <div style={{ display:'flex', flexDirection:'column' }}>
              {TIMELINE_2041.map((s,i)=>(
                <div key={i} style={{ display:'flex', gap:14 }}>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                    <div style={{ width:22, height:22, borderRadius:99, background:s.done?(s.now?P.accent:P.good):P.surface3, border:`2px solid ${s.done?(s.now?P.accentBorder:P.good):P.hairline3}`, display:'flex', alignItems:'center', justifyContent:'center' }}>{s.done&&<Icon name="check" size={11} stroke={3} color={s.now?P.accentInk:'#fff'}/>}</div>
                    {i<TIMELINE_2041.length-1&&<div style={{ width:2, flex:1, minHeight:26, background:s.done?P.good:P.hairline2 }}/>}
                  </div>
                  <div style={{ paddingBottom:20, flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:9 }}><span style={{ fontSize:13.5, fontWeight:600, color:s.done?P.ink:P.inkMute }}>{s.k}</span>{s.now&&<Pill kind="good" soft dot>Now</Pill>}<span className="mono" style={{ marginLeft:'auto', fontSize:11.5, color:P.inkMute }}>{s.t}</span></div>
                    {s.meta&&<div style={{ fontSize:11.5, color:P.inkMute, marginTop:2 }}>{s.meta}</div>}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {tab==='chat' && (
          <Section title="Conversation" right={<span style={{ fontSize:11, color:P.inkMute }}>Customer ⇄ Genius · monitored</span>}>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {CHAT_2041.map((c,i)=>{ if(c.who==='sys') return (<div key={i} style={{ textAlign:'center' }}><span className="mono" style={{ fontSize:10.5, color:P.inkMute, background:P.surface3, padding:'4px 10px', borderRadius:99 }}>{c.m} · {c.t}</span></div>);
                const mine=c.who==='genius'; return (
                <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:mine?'flex-end':'flex-start' }}>
                  <div style={{ maxWidth:'78%', padding:'10px 13px', borderRadius:14, background:mine?P.ink:P.surface, color:mine?P.surface:P.ink, border:mine?'none':`1px solid ${P.hairline2}`, fontSize:13, lineHeight:1.5 }}>{c.m}</div>
                  <span className="mono" style={{ fontSize:10, color:P.inkMute, marginTop:3 }}>{c.who==='cx'?a.cust.split(' ')[0]:g?g.name.split(' ')[0]:'Genius'} · {c.t}</span>
                </div>); })}
            </div>
          </Section>
        )}

        {tab==='deposit' && (<>
          <Section title="Deposit & settlement">
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
              <KPI label="Deposit held" value={money(a.dep||100)} hint="refundable" icon="wallet" accent/>
              <KPI label="Payment method" value="Visa" hint="•• 4021" icon="card"/>
              <KPI label="Balance due" value={a.subtotal?money(Math.round(a.subtotal*0.9*1.27)-a.dep):'—'} hint="on checkout" icon="dollar"/>
            </div>
          </Section>
          <Section title="Ledger">
            <div style={{ border:`1px solid ${P.hairline2}`, borderRadius:P.r12, overflow:'hidden', background:P.surface }}>
              {[['1:42p','Deposit authorized','Visa •• 4021','+$100.00',P.good],['—','Order subtotal','estimated','$358.00',P.inkDim],['—','VIP discount 10%','auto','−$35.80',P.good],['—','Taxes & fees','CA + local','$87.00',P.inkDim],...(isDone?[['12:41p','Balance charged','Visa •• 4021','$309.20',P.ink],['12:41p','Tip','to genius','$40.00',P.good]]:[])].map((r,i)=>(
                <div key={i} style={{ display:'grid', gridTemplateColumns:'70px 1.4fr 1fr 100px', padding:'11px 15px', borderTop:i?`1px solid ${P.hairline}`:'none', alignItems:'center', fontSize:12.5 }}>
                  <span className="mono" style={{ color:P.inkMute }}>{r[0]}</span><span style={{ color:P.ink, fontWeight:500 }}>{r[1]}</span><span style={{ color:P.inkMute }}>{r[2]}</span><span className="mono" style={{ textAlign:'right', color:r[4], fontWeight:600 }}>{r[3]}</span>
                </div>
              ))}
            </div>
          </Section>
          {!isDone && <div style={{ display:'flex', gap:10 }}><Btn kind="primary" icon="dollar">Charge balance</Btn><Btn kind="ghost" icon="refresh">Refund deposit</Btn></div>}
        </>)}

        {tab==='report' && isDone && (<>
          <Section title="Post-visit report">
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
              <KPI label="Rating" value={`★ ${a.rating}.0`} icon="star" accent/>
              <KPI label="Order total" value={money(a.subtotal)} icon="receipt"/>
              <KPI label="Tip" value={money(a.tip)} icon="gift"/>
              <KPI label="Duration" value={a.dur} icon="clock"/>
            </div>
          </Section>
          <Section title="Customer review">
            <div style={{ padding:16, background:P.surface, border:`1px solid ${P.hairline2}`, borderRadius:P.r12 }}>
              <div style={{ display:'flex', gap:3, marginBottom:8 }}>{[1,2,3,4,5].map(n=><Icon key={n} name="starFilled" size={16} color={n<=a.rating?P.accent:P.hairline3}/>)}</div>
              <div style={{ fontSize:13.5, lineHeight:1.55, color:P.ink, fontStyle:'italic' }}>“{a.rating===5?'Wesley knew exactly what to recommend for the hike. Fast, friendly, felt like a private shop at my door.':'Good visit, learned a lot about dosing. Would have liked a bit more variety in stock.'}”</div>
              <div style={{ fontSize:11, color:P.inkMute, marginTop:8 }}>— {a.cust} · {g?g.name:'genius'}</div>
            </div>
          </Section>
          <Section title="Genius notes"><div style={{ fontSize:13, lineHeight:1.55, color:P.inkDim }}>Restocked customer on their usual. Recommended the new sleep tincture — added to favorites. Flagged interest in concentrates for next visit.</div></Section>
          <div style={{ display:'flex', gap:10 }}><Btn kind="ghost" icon="printer">Print receipt</Btn><Btn kind="ghost" icon="download">Export report</Btn></div>
        </>)}
      </div>
      {/* footer actions */}
      {!isDone && a.status!=='canceled' && (
        <div style={{ padding:'14px 24px', borderTop:`1px solid ${P.hairline2}`, background:P.surface, display:'flex', alignItems:'center', gap:10 }}>
          <Btn kind="quiet" icon="x">Cancel call</Btn>
          <div style={{ flex:1 }}/>
          {a.status==='requested'&&<Btn kind="primary" icon="user-check">Assign & confirm</Btn>}
          {a.status==='confirmed'&&<Btn kind="primary" icon="route">Dispatch genius</Btn>}
          {a.status==='en_route'&&<Btn kind="dark" icon="phone">Message customer</Btn>}
          {a.status==='in_session'&&<Btn kind="primary" icon="dollar">Complete & charge</Btn>}
        </div>
      )}
    </div>
  </div>);
}

// ══ SHELL ═════════════════════════════════════════════════════════════════
const SUBNAV=[
  { id:'board', label:'Appointments', icon:'board' },
  { id:'map', label:'Live map', icon:'map' },
  { id:'geniuses', label:'Geniuses', icon:'user' },
  { id:'regions', label:'Regions', icon:'sliders' },
];
function Shell(){
  const P=useP();
  const [view,setView]=useState('board');
  const [open,setOpen]=useState(null);
  return (<div style={{ display:'flex', height:'100vh', background:P.bg, color:P.ink, fontFamily:P.fontSans, overflow:'hidden' }}>
    <Rail/>
    <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden' }}>
      <TopBar/>
      {/* section subnav */}
      <div style={{ height:48, flex:'0 0 48px', display:'flex', alignItems:'center', gap:4, padding:'0 30px', borderBottom:`1px solid ${P.hairline2}`, background:P.surface }}>
        {SUBNAV.map(s=>{ const a=view===s.id; return (
          <button key={s.id} onClick={()=>setView(s.id)} style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'7px 13px', borderRadius:99, border:'none', background:a?P.ink:'transparent', color:a?P.surface:P.inkDim, fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:P.fontSans, transition:'all .13s' }}>
            <Icon name={s.icon} size={15} stroke={2}/>{s.label}
          </button>); })}
        <div style={{ flex:1 }}/>
        <span className="mono" style={{ fontSize:11, color:P.inkMute }}>{TODAY} · 2:35p PT</span>
      </div>
      <main style={{ flex:1, overflow:'auto', minHeight:0 }}>
        {view==='board' && <BoardView onOpen={setOpen}/>}
        {view==='map' && <MapView onOpen={setOpen}/>}
        {view==='geniuses' && <GeniusesView/>}
        {view==='regions' && <RegionsView/>}
      </main>
    </div>
    {open && <ApptDetail id={open} onClose={()=>setOpen(null)}/>}
  </div>);
}

window.ShopHomeApp = function ShopHomeApp(){ return React.createElement(ThemeProvider, null, React.createElement(Shell)); };
})();
