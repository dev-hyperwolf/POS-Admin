// ── "Card Studio" — 3 alternative page directions, light + dark ─────────────
// Every direction wires the hero INNER CARDS to promotions: click one and it
// opens the shop page pre-filtered to that promo's qualifying products.
const useP = window.useP;
const MONO = '"JetBrains Mono",monospace';
const tOn = (c)=> c==='#FFD100' ? '#1A1400' : c==='#0F0F0C' ? '#FFD100' : '#fff';

const INNER = [
  {id:'i1', promo:'Wax Wednesday', badge:'30% OFF', color:'#C2841D', cat:'Concentrate', hue:38,
    products:[{n:'Live Rosin 1g',b:'Coldfire',was:60,now:42},{n:'Badder 1g',b:'Claybourne',was:40,now:28},{n:'Sauce 1g',b:'Almora',was:45,now:32},{n:'Diamonds 1g',b:'Coldfire',was:55,now:38}]},
  {id:'i2', promo:'Weekend Flower', badge:'BUNDLE', color:'#3F9E72', cat:'Flower', hue:120,
    products:[{n:'House Blend 3.5g',b:'Hyperwolf',was:50,now:35},{n:'Coastal OG 3.5g',b:'Driftwood',was:45,now:36},{n:'Gelato 41 3.5g',b:'THC Design',was:48,now:38},{n:'Blue Zkittlez 3.5g',b:'Almora',was:44,now:33}]},
  {id:'i3', promo:'Stilo BOGO', badge:'BOGO', color:'#7E55C9', cat:'Vape', hue:265,
    products:[{n:'Live Resin Cart 1g',b:'Stilo',was:50,now:25},{n:'All-in-One 1g',b:'Stilo',was:45,now:23},{n:'Blue Dream 1g',b:'Stilo',was:40,now:20}]},
  {id:'i4', promo:'VIP · 2× Points', badge:'2× PTS', color:'#FFD100', cat:'Storewide', hue:48,
    products:[{n:'Every item earns 2×',b:'All brands',was:0,now:0}]},
];

function Notch(){ return <div style={{ position:'absolute', top:7, left:'50%', transform:'translateX(-50%)', width:74, height:19, borderRadius:20, background:'#000', zIndex:5 }}/>; }
function Status(){ return <div style={{ height:32, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 18px', fontSize:10.5, fontWeight:600, color:'#fff' }}><span>9:41</span><span style={{ fontFamily:MONO, opacity:.6, fontSize:8 }}>▮▮▮ ⌁</span></div>; }
function Phone({ children, w=252, minH=452 }){
  return (<div style={{ width:w, flex:'0 0 auto', borderRadius:34, background:'#000', padding:8, boxShadow:'0 24px 52px rgba(0,0,0,.3)' }}>
    <div style={{ borderRadius:28, overflow:'hidden', background:'#0F0F0C', color:'#fff', position:'relative', minHeight:minH }}><Notch/><Status/>{children}</div>
  </div>);
}
function Swatch({ hue, style }){ return <div style={{ background:`repeating-linear-gradient(135deg, hsl(${hue} 34% 30%), hsl(${hue} 34% 30%) 7px, hsl(${hue} 34% 24%) 7px, hsl(${hue} 34% 24%) 14px)`, ...style }}/>; }

// hero inner-cards grid — the wired tiles
function InnerGrid({ onOpen, compact }){
  return (<div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
    {INNER.map(c=>(
      <button key={c.id} onClick={()=>onOpen(c)} style={{ textAlign:'left', border:'none', cursor:'pointer', borderRadius:12, overflow:'hidden', background:'#17170F', padding:0 }}>
        <div style={{ height:compact?44:54, position:'relative', background:`linear-gradient(135deg, hsl(${c.hue} 52% 47%), hsl(${(c.hue+30)%360} 56% 34%))` }}>
          <span style={{ position:'absolute', top:6, left:6, padding:'2px 6px', borderRadius:99, background:'rgba(0,0,0,.5)', color:'#fff', fontSize:8, fontWeight:800, fontFamily:MONO }}>{c.badge}</span>
          <span style={{ position:'absolute', bottom:6, right:6, width:16, height:16, borderRadius:5, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center' }}><Icon name="arrow-right" size={10} color="#fff"/></span>
        </div>
        <div style={{ padding:'7px 9px' }}><div style={{ fontSize:10.5, fontWeight:700, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.promo}</div><div style={{ fontSize:8.5, color:'rgba(255,255,255,.5)', fontFamily:MONO }}>→ {c.cat} shop</div></div>
      </button>))}
  </div>);
}
// the filtered shop page an inner card opens
function FilteredShop({ card, onBack }){
  return (<div style={{ padding:'2px 13px 16px' }}>
    <div style={{ display:'flex', alignItems:'center', gap:9, margin:'4px 0 12px' }}>
      <span onClick={onBack} style={{ width:26, height:26, borderRadius:8, background:'rgba(255,255,255,.12)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}><Icon name="chevron-left" size={15} color="#fff"/></span>
      <div style={{ flex:1, minWidth:0 }}><div style={{ fontSize:13, fontWeight:800, color:'#fff' }}>{card.promo}</div><div style={{ fontSize:9, color:'rgba(255,255,255,.55)', fontFamily:MONO }}>{card.cat} · filtered shop</div></div>
      <span style={{ padding:'3px 8px', borderRadius:99, background:card.color, color:tOn(card.color), fontSize:8.5, fontWeight:800, fontFamily:MONO }}>{card.badge}</span>
    </div>
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>{card.products.map((p,i)=>(
      <div key={i} style={{ borderRadius:11, overflow:'hidden', background:'#17170F' }}>
        <Swatch hue={card.hue} style={{ height:58 }}/>
        <div style={{ padding:'7px 9px' }}><div style={{ fontSize:10, fontWeight:700, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.n}</div><div style={{ fontSize:8, color:'rgba(255,255,255,.5)' }}>{p.b}</div>
          {p.was>0 && <div style={{ fontFamily:MONO, fontSize:10, fontWeight:700, marginTop:3 }}><span style={{ color:'rgba(255,255,255,.4)', textDecoration:'line-through', marginRight:4 }}>${p.was}</span><span style={{ color:card.color==='#FFD100'?'#FFD100':'#6ee7a8' }}>${p.now}</span></div>}
        </div>
      </div>))}</div>
  </div>);
}
function HeroPreview({ onOpen }){
  return (<div style={{ padding:'2px 13px 16px' }}>
    <div style={{ fontWeight:800, fontSize:13, margin:'4px 0 10px', color:'#fff' }}>Hyperwolf</div>
    <div style={{ borderRadius:16, background:'#C0392B', color:'#fff', padding:'15px 15px', marginBottom:11 }}>
      <span style={{ display:'inline-block', padding:'3px 8px', borderRadius:99, background:'#fff', color:'#C0392B', fontSize:8.5, fontWeight:800, fontFamily:MONO, marginBottom:8 }}>25% OFF</span>
      <div style={{ fontSize:18, fontWeight:900, letterSpacing:'-.02em' }}>This Week's Deals</div>
      <div style={{ fontSize:10.5, opacity:.85, marginTop:3 }}>Every category marked down</div>
    </div>
    <InnerGrid onOpen={onOpen}/>
  </div>);
}

// ── Option 1 · Canvas + Inspector (evolved) ─────────────────────────────────
function OptInspector(){
  const P = useP(); const [open,setOpen] = React.useState(null);
  return (<div>
    <div style={{ display:'flex', alignItems:'baseline', gap:12, marginBottom:16 }}>
      <h1 style={{ margin:0, fontSize:21, fontWeight:800, color:P.ink, letterSpacing:'-.02em' }}>Card studio</h1>
      <span style={{ fontSize:12, color:P.inkMute }}>Home hero · inner cards linked to promotions</span>
    </div>
    <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:20 }}>
      <Phone>{open ? <FilteredShop card={open} onBack={()=>setOpen(null)}/> : <HeroPreview onOpen={setOpen}/>}</Phone>
      <div>
        <div style={{ fontSize:10.5, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:P.inkMute, fontFamily:MONO, marginBottom:10 }}>Inner cards · {INNER.length}</div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>{INNER.map(c=>{ const a=open&&open.id===c.id; return (
          <button key={c.id} onClick={()=>setOpen(a?null:c)} style={{ display:'flex', alignItems:'center', gap:11, textAlign:'left', padding:'11px 13px', borderRadius:11, cursor:'pointer', background:a?P.accentSoft:P.surface, border:`1px solid ${a?P.accentBorder:P.hairline2}` }}>
            <span style={{ width:30, height:30, borderRadius:8, background:c.color, color:tOn(c.color), display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, fontFamily:MONO, flex:'0 0 auto' }}>{c.badge.split(' ')[0]}</span>
            <div style={{ flex:1, minWidth:0 }}><div style={{ fontSize:13, fontWeight:700, color:P.ink }}>{c.promo}</div><div style={{ fontSize:11, color:P.inkDim }}>opens → <b style={{ color:P.ink2 }}>{c.cat}</b> shop, filtered to {c.products.length} products</div></div>
            <Icon name="arrow-right" size={15} color={P.inkMute}/>
          </button>); })}</div>
        <div style={{ marginTop:12, padding:'10px 12px', borderRadius:10, background:P.surface2, border:`1px dashed ${P.hairline3}`, fontSize:11.5, color:P.inkDim, display:'flex', gap:8, alignItems:'center' }}><Icon name="link" size={14} color={P.inkMute}/>Each tile is a promotion — tapping it deep-links to that promo's filtered shop page.</div>
      </div>
    </div>
  </div>);
}

// ── Option 2 · Device stage ─────────────────────────────────────────────────
function OptStage(){
  const P = useP(); const [open,setOpen] = React.useState(null); const [surf,setSurf] = React.useState('hero');
  const chips = [['hero','Home hero'],['banner','Home banner'],['category','Category banner'],['grid','Shop grid']];
  return (<div>
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, flexWrap:'wrap' }}>
      <h1 style={{ margin:0, fontSize:21, fontWeight:800, color:P.ink, letterSpacing:'-.02em' }}>Live stage</h1>
      <div style={{ flex:1 }}/>
      <div style={{ display:'inline-flex', background:P.surface3, border:`1px solid ${P.hairline2}`, borderRadius:P.r10, padding:3, gap:2 }}>
        {chips.map(([v,l])=>{ const a=v===surf; return <button key={v} onClick={()=>{setSurf(v);setOpen(null);}} style={{ padding:'7px 12px', borderRadius:7, border:'none', cursor:'pointer', fontFamily:P.fontSans, fontSize:12, fontWeight:600, background:a?P.surface:'transparent', color:a?P.ink:P.inkDim, boxShadow:a?P.shadowSm:'none' }}>{l}</button>; })}
      </div>
    </div>
    <div style={{ display:'flex', gap:24, alignItems:'flex-start', justifyContent:'center' }}>
      <Phone w={284} minH={500}>{open ? <FilteredShop card={open} onBack={()=>setOpen(null)}/> : surf==='hero' ? <HeroPreview onOpen={setOpen}/> :
        <div style={{ padding:'8px 14px 16px' }}><div style={{ fontWeight:800, fontSize:13, marginBottom:10, color:'#fff' }}>{chips.find(c=>c[0]===surf)[1]}</div><div style={{ borderRadius:14, background:'#C2841D', color:'#fff', padding:16, minHeight:110 }}><span style={{ fontSize:8.5, fontWeight:800, fontFamily:MONO, background:'#fff', color:'#C2841D', padding:'2px 7px', borderRadius:99 }}>30% OFF</span><div style={{ fontSize:17, fontWeight:900, marginTop:8 }}>Wax Wednesday</div></div></div>}
      </Phone>
      <div style={{ width:260, flex:'0 0 auto' }}>
        <div style={{ fontSize:10.5, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:P.inkMute, fontFamily:MONO, marginBottom:10 }}>Linked promotions</div>
        <div style={{ display:'flex', flexDirection:'column', gap:7 }}>{INNER.map(c=>(
          <button key={c.id} onClick={()=>{setSurf('hero');setOpen(c);}} style={{ display:'flex', alignItems:'center', gap:9, textAlign:'left', padding:'9px 11px', borderRadius:10, cursor:'pointer', background:open&&open.id===c.id?P.accentSoft:P.surface, border:`1px solid ${open&&open.id===c.id?P.accentBorder:P.hairline2}` }}>
            <span style={{ width:8, height:8, borderRadius:99, background:c.color }}/><span style={{ fontSize:12.5, fontWeight:600, color:P.ink, flex:1 }}>{c.promo}</span><span style={{ fontSize:10, color:P.inkMute, fontFamily:MONO }}>{c.products.length}p</span>
          </button>))}</div>
        <div style={{ marginTop:12, fontSize:11.5, color:P.inkDim, lineHeight:1.5 }}>Tap a tile on the phone <b style={{ color:P.ink }}>or</b> a promotion here — the stage jumps to that promo's filtered shop.</div>
      </div>
    </div>
  </div>);
}

// ── Option 3 · Storefront simulator ─────────────────────────────────────────
function OptSimulator(){
  const P = useP(); const [open,setOpen] = React.useState(null);
  return (<div>
    <div style={{ display:'flex', alignItems:'baseline', gap:12, marginBottom:16 }}>
      <h1 style={{ margin:0, fontSize:21, fontWeight:800, color:P.ink, letterSpacing:'-.02em' }}>Storefront simulator</h1>
      <span style={{ fontSize:12, color:P.inkMute }}>the full home, scrollable — every card live &amp; wired</span>
    </div>
    <div style={{ display:'flex', gap:22, alignItems:'flex-start' }}>
      <Phone w={270} minH={520}>{open ? <FilteredShop card={open} onBack={()=>setOpen(null)}/> : (
        <div style={{ padding:'2px 13px 18px' }}>
          <div style={{ fontWeight:800, fontSize:13, margin:'4px 0 10px', color:'#fff' }}>Good afternoon 👋</div>
          <div style={{ borderRadius:15, background:'#C0392B', color:'#fff', padding:'13px', marginBottom:10 }}><span style={{ fontSize:8, fontWeight:800, fontFamily:MONO, background:'#fff', color:'#C0392B', padding:'2px 6px', borderRadius:99 }}>25% OFF</span><div style={{ fontSize:16, fontWeight:900, marginTop:7 }}>This Week's Deals</div></div>
          <InnerGrid onOpen={setOpen} compact/>
          <div style={{ marginTop:10, height:42, borderRadius:11, background:'#7E55C9', color:'#fff', display:'flex', alignItems:'center', padding:'0 12px', fontWeight:800, fontSize:10 }}>Stilo BOGO · 2nd cart 50% off</div>
          <div style={{ marginTop:10, borderRadius:11, background:'#2FA59B', color:'#fff', padding:'10px 12px', fontSize:9.5, fontWeight:800 }}>CATEGORY BANNER · Wellness Week 15% OFF</div>
        </div>)}
      </Phone>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:10.5, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:P.inkMute, fontFamily:MONO, marginBottom:10 }}>Wiring map</div>
        {INNER.map(c=>{ const a=open&&open.id===c.id; return (
          <div key={c.id} onClick={()=>setOpen(a?null:c)} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 13px', borderRadius:11, marginBottom:8, cursor:'pointer', background:a?P.accentSoft:P.surface, border:`1px solid ${a?P.accentBorder:P.hairline2}` }}>
            <span style={{ width:34, height:34, borderRadius:9, background:`linear-gradient(135deg, hsl(${c.hue} 52% 47%), hsl(${(c.hue+30)%360} 56% 34%))`, flex:'0 0 auto' }}/>
            <div style={{ flex:1, minWidth:0 }}><div style={{ fontSize:13, fontWeight:700, color:P.ink }}>{c.promo} <span style={{ fontSize:10.5, fontWeight:700, color:P.inkMute, fontFamily:MONO }}>· {c.badge}</span></div><div style={{ fontSize:11.5, color:P.inkDim }}>inner card → <b style={{ color:P.ink2 }}>{c.cat}</b> shop · {c.products.length} products</div></div>
            <Icon name={a?'eye':'arrow-right'} size={15} color={P.inkMute}/>
          </div>); })}
        <div style={{ padding:'10px 12px', borderRadius:10, background:P.surface2, border:`1px dashed ${P.hairline3}`, fontSize:11.5, color:P.inkDim, display:'flex', gap:8, alignItems:'flex-start' }}><Icon name="link" size={14} color={P.inkMute} style={{ marginTop:1 }}/>Tap any card on the phone or a row here to preview the exact filtered shop a shopper lands on.</div>
      </div>
    </div>
  </div>);
}

// ── harness ─────────────────────────────────────────────────────────────────
function Frame({ mode, Comp }){
  const P = window.THEMES[mode];
  return (
    <window.ThemeCtx.Provider value={{ mode, P, setMode:()=>{}, toggle:()=>{} }}>
      <div style={{ width:760, flex:'0 0 auto' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:9 }}>
          <span style={{ width:16, height:16, borderRadius:5, background:P.bg, border:'1px solid rgba(0,0,0,.2)', display:'flex', alignItems:'center', justifyContent:'center' }}><Icon name={mode==='dark'?'moon':'sun'} size={10} color={mode==='dark'?'#bbb':'#a88'}/></span>
          <span style={{ fontSize:11.5, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:'#6b6961', fontFamily:MONO }}>{mode}</span>
        </div>
        <div style={{ borderRadius:16, overflow:'hidden', background:P.bg, border:`1px solid ${P.hairline2}`, padding:22, boxShadow:'0 10px 30px rgba(0,0,0,.12)' }}><Comp/></div>
      </div>
    </window.ThemeCtx.Provider>);
}
function ExploreApp(){
  const options = [
    ['Option 1 — Canvas + Inspector', OptInspector, 'Today\u2019s studio, refined: the hero preview beside an inspector that lists each inner card and the promo/filtered-shop it links to. Click a tile or a row to preview the shop.'],
    ['Option 2 — Live stage', OptStage, 'One big device center-stage with a surface switcher on top. The inner tiles and a side list both jump the stage to the promo\u2019s filtered shop.'],
    ['Option 3 — Storefront simulator', OptSimulator, 'The full scrollable home with every surface live, beside a wiring map. Tapping any card drills straight into its filtered shop, inline.'],
  ];
  return (<div style={{ minHeight:'100%', background:'#e9e7e0', padding:'34px 42px 60px' }}>
    <div style={{ maxWidth:1580, margin:'0 auto' }}>
      <div style={{ marginBottom:8, fontSize:11, fontWeight:700, letterSpacing:'.16em', textTransform:'uppercase', color:'#8a8880', fontFamily:MONO }}>Promotions · Studio</div>
      <h1 style={{ margin:'0 0 6px', fontSize:26, fontWeight:800, color:'#1a1a14', letterSpacing:'-.02em' }}>Three directions for the Studio page</h1>
      <div style={{ marginBottom:30, fontSize:13.5, color:'#57554e', maxWidth:720, lineHeight:1.5 }}>All three wire the hero <b>inner cards to promotions</b> — click any card to open the shop page filtered to that promo's products. (Interactive — try it in any frame.)</div>
      <div style={{ display:'flex', flexDirection:'column', gap:40 }}>
        {options.map(([title,Comp,desc],i)=>(
          <section key={i}>
            <div style={{ display:'flex', alignItems:'baseline', gap:14, marginBottom:14 }}>
              <h2 style={{ margin:0, fontSize:18, fontWeight:800, color:'#1a1a14' }}>{title}</h2>
              <span style={{ fontSize:12.5, color:'#6b6961', maxWidth:660, lineHeight:1.4 }}>{desc}</span>
            </div>
            <div style={{ display:'flex', gap:28, flexWrap:'wrap' }}>
              <Frame mode="light" Comp={Comp}/>
              <Frame mode="dark" Comp={Comp}/>
            </div>
          </section>))}
      </div>
    </div>
  </div>);
}
ReactDOM.createRoot(document.getElementById('root')).render(<ExploreApp/>);
