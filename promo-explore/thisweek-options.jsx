// ── "This Week" — 3 alternative page directions, light + dark ───────────────
const useP = window.useP;
const DAYS = [['Mon','Jul 6'],['Tue','Jul 7'],['Wed','Jul 8'],['Thu','Jul 9'],['Fri','Jul 10'],['Sat','Jul 11'],['Sun','Jul 12']];
const TODAY = 2;
const WEEK = [
  {n:'Corona Grand Opening', c:'#C0392B', b:'25% OFF', o:'25% off first order', aud:'Everyone', days:[0,1,2,3,4,5,6], surf:'Hero'},
  {n:'Wax Wednesday', c:'#C2841D', b:'30% OFF', o:'30% off concentrates', aud:'Everyone', days:[2], surf:'Banner'},
  {n:'CHKN Launch', c:'#E0662E', b:'FREE GIFT', o:'Free pre-roll on $75+', aud:'Everyone', days:[4,5,6], surf:'Hero'},
  {n:'Stilo BOGO', c:'#7E55C9', b:'BOGO', o:'2nd cart 50% off', aud:'Members', days:[0,1,2,3,4,5,6], surf:'Brand'},
  {n:'Weekend Flower Bundle', c:'#3F9E72', b:'BUNDLE', o:'Buy 2, get 3rd ½ off', aud:'Everyone', days:[4,5,6], surf:'Grid'},
  {n:'VIP Double Points', c:'#FFD100', b:'2× PTS', o:'2× points', aud:'VIP', days:[5,6], surf:'Banner'},
  {n:'Welcome $20', c:'#1F8A4F', b:'$20 OFF', o:'$20 off first order', aud:'New', days:[0,1,2,3,4,5,6], surf:'Banner'},
  {n:'Taco Tuesday Edibles', c:'#D6477C', b:'20% OFF', o:'20% off edibles', aud:'Everyone', days:[1], surf:'Banner'},
  {n:'Thursday Vape Day', c:'#2C5BB8', b:'$5 OFF', o:'$5 off carts', aud:'Everyone', days:[3], surf:'Banner'},
  {n:'Happy Hour', c:'#9A7B3A', b:'15% OFF', o:'15% off, 4–6pm', aud:'Everyone', days:[0,1,2,3,4,5,6], surf:'Banner'},
];
const tOn = (c)=> c==='#FFD100' ? '#1A1400' : c==='#0F0F0C' ? '#FFD100' : '#fff';

// ── Option 1 · Calendar week ────────────────────────────────────────────────
function OptCalendar(){
  const P = useP();
  return (<div>
    <div style={{ display:'flex', alignItems:'baseline', gap:12, marginBottom:16 }}>
      <h1 style={{ margin:0, fontSize:23, fontWeight:800, color:P.ink, letterSpacing:'-.02em' }}>Week of Jul 6–12</h1>
      <span style={{ fontSize:12, color:P.inkMute, fontFamily:P.fontMono }}>15 live</span>
      <div style={{ flex:1 }}/>
      <div style={{ display:'flex', gap:6 }}>{['chevron-left','chevron-right'].map(i=><span key={i} style={{ width:30, height:30, borderRadius:8, border:`1px solid ${P.hairline2}`, display:'flex', alignItems:'center', justifyContent:'center', color:P.ink2 }}><Icon name={i} size={15}/></span>)}</div>
    </div>
    <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6, minWidth:0 }}>
      {DAYS.map((d,di)=>{ const list=WEEK.filter(p=>p.days.includes(di)); const today=di===TODAY; return (
        <div key={di} style={{ minWidth:0, background:today?P.accentSoft:P.surface, border:`1px solid ${today?P.accentBorder:P.hairline2}`, borderRadius:10, minHeight:230, padding:'8px 7px' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:1, marginBottom:9, paddingBottom:7, borderBottom:`1px solid ${P.hairline}` }}>
            <span style={{ fontSize:11.5, fontWeight:800, color:P.ink }}>{d[0]}</span>
            <span style={{ fontSize:9.5, fontFamily:P.fontMono, color:P.inkMute }}>{d[1].split(' ')[1]}</span>
            {today && <span style={{ fontSize:7.5, fontWeight:800, fontFamily:P.fontMono, color:P.mode==='dark'?P.accent:'#8A6200', letterSpacing:'.06em' }}>TODAY</span>}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>{list.map((p,i)=>(
            <div key={i} style={{ background:p.c, color:tOn(p.c), borderRadius:7, padding:'5px 7px', lineHeight:1.1 }}>
              <div style={{ fontSize:9.5, fontWeight:800, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.n}</div>
              <div style={{ fontSize:7.5, fontWeight:700, fontFamily:P.fontMono, opacity:.85, marginTop:2 }}>{p.b}</div>
            </div>))}</div>
        </div>); })}
    </div>
  </div>);
}

// ── Option 2 · Live-ops control room ────────────────────────────────────────
function OptControl(){
  const P = useP();
  const live = WEEK.filter(p=>p.days.includes(TODAY));
  const hero = live.find(p=>p.surf==='Hero')||live[0];
  const banners = live.filter(p=>p.surf==='Banner').slice(0,3);
  const upcoming = WEEK.filter(p=>!p.days.includes(TODAY) && Math.min(...p.days)>TODAY);
  const Stat = ({label,value,tone})=>(<div style={{ flex:1, background:P.surface, border:`1px solid ${P.hairline2}`, borderRadius:10, padding:'11px 13px' }}>
    <div style={{ fontSize:9.5, fontWeight:600, letterSpacing:'.07em', textTransform:'uppercase', color:P.inkMute }}>{label}</div>
    <div style={{ fontSize:20, fontWeight:700, color:tone||P.ink, fontFamily:P.fontMono, marginTop:3 }}>{value}</div>
  </div>);
  return (<div>
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
      <span style={{ width:8, height:8, borderRadius:99, background:P.bad, boxShadow:`0 0 0 4px ${P.badSoft}` }}/>
      <h1 style={{ margin:0, fontSize:20, fontWeight:800, color:P.ink, letterSpacing:'-.02em' }}>Live now · Wed Jul 8</h1>
    </div>
    <div style={{ display:'flex', gap:8, marginBottom:14 }}><Stat label="Promos live" value="15"/><Stat label="Slots filled" value="8/9"/><Stat label="Conflicts" value="2" tone={P.warn}/><Stat label="Surfaces" value="6"/></div>
    <div style={{ display:'grid', gridTemplateColumns:'1.3fr 1fr', gap:14 }}>
      <div>
        <div style={{ fontSize:10.5, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:P.inkMute, fontFamily:P.fontMono, marginBottom:9 }}>On air</div>
        <div style={{ borderRadius:12, background:hero.c, color:tOn(hero.c), padding:'15px 16px', marginBottom:10 }}>
          <span style={{ fontSize:9, fontWeight:800, fontFamily:P.fontMono, background:tOn(hero.c), color:hero.c, padding:'2px 7px', borderRadius:99 }}>HERO · {hero.b}</span>
          <div style={{ fontSize:18, fontWeight:900, letterSpacing:'-.02em', marginTop:8 }}>{hero.n}</div>
          <div style={{ fontSize:11.5, opacity:.85, marginTop:3 }}>{hero.o}</div>
        </div>
        <div style={{ borderRadius:12, border:`1px solid ${P.hairline2}`, background:P.surface, padding:'11px 12px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:P.inkMute, fontFamily:P.fontMono, marginBottom:8 }}>BANNER CAROUSEL · {banners.length}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>{banners.map((p,i)=>(<div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}><span style={{ width:8, height:8, borderRadius:99, background:p.c }}/><span style={{ fontSize:12, fontWeight:600, color:P.ink, flex:1 }}>{p.n}</span><span style={{ fontSize:11, fontWeight:700, fontFamily:P.fontMono, color:P.ink2 }}>{p.b}</span></div>))}</div>
        </div>
      </div>
      <div>
        <div style={{ fontSize:10.5, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:P.inkMute, fontFamily:P.fontMono, marginBottom:9 }}>Queue</div>
        <div style={{ borderRadius:12, border:`1px solid ${P.warnSoft}`, background:P.warnSoft, padding:'10px 12px', marginBottom:10, display:'flex', gap:9, alignItems:'flex-start' }}>
          <Icon name="bell" size={15} color={P.warn}/><div><div style={{ fontSize:12, fontWeight:700, color:P.warn }}>2 slot conflicts Fri</div><div style={{ fontSize:11, color:P.warn, opacity:.8 }}>Hero oversubscribed — pin or rotate</div></div>
        </div>
        <div style={{ borderRadius:12, border:`1px solid ${P.hairline2}`, background:P.surface }}>
          {upcoming.slice(0,5).map((p,i)=>(<div key={i} style={{ display:'flex', alignItems:'center', gap:9, padding:'9px 12px', borderTop:i?`1px solid ${P.hairline}`:'none' }}><span style={{ width:7, height:7, borderRadius:99, background:p.c }}/><span style={{ fontSize:11.5, fontWeight:600, color:P.ink, flex:1 }}>{p.n}</span><span style={{ fontSize:10, color:P.inkMute, fontFamily:P.fontMono }}>{DAYS[Math.min(...p.days)][0]}</span></div>))}
        </div>
      </div>
    </div>
  </div>);
}

// ── Option 3 · Storefront-led editorial ─────────────────────────────────────
function OptStorefront(){
  const P = useP();
  const live = WEEK.filter(p=>p.days.includes(TODAY));
  const hero = live.find(p=>p.surf==='Hero')||live[0];
  const banner = live.find(p=>p.surf==='Banner');
  const placed = [['Hero', live.filter(p=>p.surf==='Hero')],['Banner', live.filter(p=>p.surf==='Banner')],['Grid', live.filter(p=>p.surf==='Grid'||p.surf==='Brand')]];
  return (<div style={{ display:'flex', gap:22 }}>
    <div style={{ width:250, flex:'0 0 auto' }}>
      <div style={{ borderRadius:34, background:'#000', padding:8, boxShadow:'0 24px 50px rgba(0,0,0,.28)' }}>
        <div style={{ borderRadius:28, overflow:'hidden', background:'#0F0F0C', color:'#fff', position:'relative' }}>
          <div style={{ position:'absolute', top:7, left:'50%', transform:'translateX(-50%)', width:74, height:19, borderRadius:20, background:'#000', zIndex:5 }}/>
          <div style={{ height:34, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 18px', fontSize:11, fontWeight:600 }}><span>9:41</span><span style={{ fontFamily:P.fontMono, opacity:.6, fontSize:8 }}>▮▮▮</span></div>
          <div style={{ padding:'2px 13px 16px' }}>
            <div style={{ fontWeight:800, fontSize:13, marginBottom:10 }}>Good afternoon 👋</div>
            <div style={{ borderRadius:15, background:hero.c, color:tOn(hero.c), padding:'14px' }}>
              <span style={{ display:'inline-block', padding:'3px 8px', borderRadius:99, background:tOn(hero.c), color:hero.c, fontFamily:P.fontMono, fontSize:8, fontWeight:800, marginBottom:8 }}>{hero.b}</span>
              <div style={{ fontSize:17, fontWeight:900, letterSpacing:'-.02em', lineHeight:1.05 }}>{hero.n}</div>
              <div style={{ fontSize:10.5, opacity:.82, marginTop:4 }}>{hero.o}</div>
            </div>
            {banner && <div style={{ marginTop:10, height:46, borderRadius:11, background:banner.c, color:tOn(banner.c), display:'flex', alignItems:'center', padding:'0 12px', fontWeight:800, fontSize:10.5 }}>{banner.n} · {banner.b}</div>}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginTop:10 }}>{[110,180,45].map((h,i)=><div key={i} style={{ height:46, borderRadius:9, background:`repeating-linear-gradient(135deg,hsl(${h} 30% 26%),hsl(${h} 30% 26%) 6px,hsl(${h} 30% 21%) 6px,hsl(${h} 30% 21%) 12px)` }}/>)}</div>
          </div>
        </div>
      </div>
    </div>
    <div style={{ flex:1, minWidth:0 }}>
      <div style={{ fontSize:11, fontWeight:700, letterSpacing:'.14em', textTransform:'uppercase', color:P.mode==='dark'?P.accent:'#8A6200', fontFamily:P.fontMono }}>Ships today · Wed Jul 8</div>
      <h1 style={{ margin:'8px 0 6px', fontSize:34, fontWeight:900, letterSpacing:'-.03em', color:P.ink, lineHeight:.98 }}>This Week</h1>
      <div style={{ fontSize:13, color:P.inkDim, marginBottom:18, maxWidth:360, lineHeight:1.5 }}>What every shopper sees right now — auto-composed from {live.length} live promotions.</div>
      {placed.map(([label,list],i)=>(
        <div key={i} style={{ marginBottom:12 }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:P.inkMute, fontFamily:P.fontMono, marginBottom:7 }}>{label} · {list.length}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>{list.map((p,j)=>(
            <div key={j} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:10, background:P.surface, border:`1px solid ${P.hairline2}` }}>
              <span style={{ width:9, height:9, borderRadius:99, background:p.c }}/><span style={{ fontSize:13, fontWeight:600, color:P.ink, flex:1 }}>{p.n}</span>
              <span style={{ fontSize:11.5, fontWeight:700, fontFamily:P.fontMono, color:P.ink2 }}>{p.b}</span>
            </div>))}</div>
        </div>))}
    </div>
  </div>);
}

// ── harness — each option in light + dark ───────────────────────────────────
function Frame({ title, mode, Comp }){
  const P = window.THEMES[mode];
  return (
    <window.ThemeCtx.Provider value={{ mode, P, setMode:()=>{}, toggle:()=>{} }}>
      <div style={{ width:760, flex:'0 0 auto' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:9 }}>
          <span style={{ width:16, height:16, borderRadius:5, background:P.bg, border:`1px solid rgba(0,0,0,.2)`, display:'flex', alignItems:'center', justifyContent:'center' }}><Icon name={mode==='dark'?'moon':'sun'} size={10} color={mode==='dark'?'#bbb':'#a88'}/></span>
          <span style={{ fontSize:11.5, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:'#6b6961', fontFamily:'"JetBrains Mono",monospace' }}>{title} · {mode}</span>
        </div>
        <div style={{ borderRadius:16, overflow:'hidden', background:P.bg, border:`1px solid ${P.hairline2}`, padding:22, boxShadow:'0 10px 30px rgba(0,0,0,.12)' }}><Comp/></div>
      </div>
    </window.ThemeCtx.Provider>);
}

function ExploreApp(){
  const options = [
    ['Option 1 — Calendar week', OptCalendar, 'A familiar Mon–Sun calendar: each day column stacks the promos scheduled that day. Easiest for planning "what runs when."'],
    ['Option 2 — Live-ops control room', OptControl, 'Mission-control: status strip + what\u2019s on air right now (hero, banner carousel) beside the upcoming queue and conflicts.'],
    ['Option 3 — Storefront-led editorial', OptStorefront, 'Leads with the real customer phone preview of today, beside a clean list of exactly what\u2019s placed on each surface.'],
  ];
  return (<div style={{ minHeight:'100%', background:'#e9e7e0', padding:'34px 42px 60px' }}>
    <div style={{ maxWidth:1580, margin:'0 auto' }}>
      <div style={{ marginBottom:8, fontSize:11, fontWeight:700, letterSpacing:'.16em', textTransform:'uppercase', color:'#8a8880', fontFamily:'"JetBrains Mono",monospace' }}>Promotions · This Week</div>
      <h1 style={{ margin:'0 0 30px', fontSize:26, fontWeight:800, color:'#1a1a14', letterSpacing:'-.02em' }}>Three directions for the This Week page</h1>
      <div style={{ display:'flex', flexDirection:'column', gap:40 }}>
        {options.map(([title,Comp,desc],i)=>(
          <section key={i}>
            <div style={{ display:'flex', alignItems:'baseline', gap:14, marginBottom:14 }}>
              <h2 style={{ margin:0, fontSize:18, fontWeight:800, color:'#1a1a14' }}>{title}</h2>
              <span style={{ fontSize:12.5, color:'#6b6961', maxWidth:640, lineHeight:1.4 }}>{desc}</span>
            </div>
            <div style={{ display:'flex', gap:28, flexWrap:'wrap' }}>
              <Frame title={title.split('—')[0].trim()} mode="light" Comp={Comp}/>
              <Frame title={title.split('—')[0].trim()} mode="dark" Comp={Comp}/>
            </div>
          </section>))}
      </div>
    </div>
  </div>);
}

ReactDOM.createRoot(document.getElementById('root')).render(<ExploreApp/>);
