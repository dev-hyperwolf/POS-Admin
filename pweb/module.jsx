// ── Hyperwolf Promotions Module ────────────────────────────────────────────
// Author-once, publish-everywhere promotions engine, built in the POS language.
const useP = window.useP;
const useTheme = window.useTheme;
const { useState, useMemo, useEffect, useRef } = React;

const money  = (n)=> '$'+Math.round(n).toLocaleString();
const money1 = (n)=> '$'+(Math.round(n*10)/10).toLocaleString(undefined,{minimumFractionDigits:0});
const kd     = (n)=> n>=1000 ? '$'+(n/1000).toFixed(1)+'k' : '$'+Math.round(n);
const num    = (n)=> Number(n||0).toLocaleString();
const pd     = (s)=> { const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); };
const TODAY  = pd('2026-07-08');
const fmtDate= (s)=> s ? pd(s).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '—';
const DOW    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ── Reference data ──────────────────────────────────────────────────────────
const REGIONS = ['Rancho Cucamonga','Temecula','Corona','Riverside','Murrieta','Wildomar'];
const BRANDS  = [
  {id:'hyperwolf', name:'Hyperwolf', hue:48},
  {id:'stilo',     name:'Stilo Supply', hue:275},
  {id:'chkn',      name:'CHKN N WAFFLEZ', hue:22},
  {id:'pleasure',  name:'Pleasure Med', hue:172},
  {id:'kine',      name:'Kine', hue:120},
];
const CATS = ['Flower','Vape','Edibles','Concentrate','Pre-roll','Tincture','Wellness'];

const SURFACES = [
  { id:'home_hero',      label:'Home hero',           icon:'layout',  note:'Full-width takeover at top of the app home', device:'both' },
  { id:'home_banner',    label:'Home banner',         icon:'flag',    note:'Slim inline banner in the home feed',        device:'both' },
  { id:'shop_tile',      label:'Shop grid tile',      icon:'grid',    note:'Promo card mixed into the product grid',     device:'both' },
  { id:'brand_takeover', label:'Brand page takeover', icon:'tag',     note:'Header on the matching brand page',          device:'both' },
  { id:'cart',           label:'Cart drawer',         icon:'cart',    note:'Applied-savings line inside the cart',       device:'mobile' },
  { id:'checkout',       label:'Checkout callout',    icon:'receipt', note:'Discount + code line at checkout',           device:'mobile' },
  { id:'loyalty',        label:'Rewards & points',    icon:'star',    note:'Card in the loyalty / points hub',           device:'mobile' },
];
const surfaceMeta = (id)=> SURFACES.find(s=>s.id===id) || SURFACES[0];

const CAMPAIGNS = [
  { id:'weekly',    label:'Weekly deal', icon:'refresh' },
  { id:'holiday',   label:'Holiday',     icon:'gift' },
  { id:'brand',     label:'Brand',       icon:'tag' },
  { id:'evergreen', label:'Evergreen',   icon:'clock' },
  { id:'loyalty',   label:'Loyalty',     icon:'star' },
  { id:'referral',  label:'Referral',    icon:'users' },
];
const OFFERS = [
  { id:'percent', label:'% off',        icon:'percent' },
  { id:'dollar',  label:'$ off',        icon:'dollar' },
  { id:'bogo',    label:'BOGO',         icon:'copy' },
  { id:'bundle',  label:'Bundle',       icon:'package' },
  { id:'gift',    label:'Free gift',    icon:'gift' },
  { id:'tiered',  label:'Spend & save', icon:'chart' },
  { id:'points',  label:'Points boost', icon:'star' },
];
const HOLIDAYS = ['None','4th of July','420','Labor Day','Halloween','Green Wednesday','Black Friday','New Year'];

function statusMeta(s){
  return ({
    live:     {label:'Live',      kind:'good'},
    scheduled:{label:'Scheduled', kind:'info'},
    ended:    {label:'Ended',     kind:'neutral'},
    paused:   {label:'Paused',    kind:'warn'},
    draft:    {label:'Draft',     kind:'ghost'},
  })[s] || {label:s, kind:'neutral'};
}

// Human-readable offer summary from a promo's discount object.
function offerLabel(p){
  const d=p.discount||{};
  const scope = d.scope==='cart' ? 'entire order'
    : d.scope==='category' ? (d.items||[]).join(', ')
    : d.scope==='brand' ? (d.items||[]).map(id=>(BRANDS.find(b=>b.id===id)||{}).name).join(', ')
    : (d.items||[]).join(', ');
  switch(d.kind){
    case 'percent': return `${d.value}% off ${scope}`;
    case 'dollar':  return `$${d.value} off ${d.min?`orders $${d.min}+`:scope}`;
    case 'bogo':    return `BOGO — buy one ${scope}, get one ${d.value}% off`;
    case 'bundle':  return d.text || `Bundle deal on ${scope}`;
    case 'gift':    return d.text || `Free gift with $${d.min||75}+`;
    case 'tiered':  return (d.tiers||[]).map(t=>`$${t.min}→${t.value}%`).join('  ·  ');
    case 'points':  return `${d.value}× points on ${scope}`;
    default: return '—';
  }
}
function scheduleLabel(p){
  const s=p.schedule||{};
  if(s.recurring==='weekly' && s.days?.length) return `Every ${s.days.map(d=>DOW[d]).join('/')}`;
  if(s.start && s.end) return `${fmtDate(s.start)} – ${fmtDate(s.end)}`;
  if(s.start) return `From ${fmtDate(s.start)}`;
  return 'Always on';
}
const audienceLabel = (a)=> ({all:'Everyone', members:'Members', vip:'VIP tier', new:'New customers'})[a] || a;

// ── The dataset — 13 distinct example promotions ────────────────────────────
function seedPromos(){ return [
 { id:'p01', name:'Wax Wednesday', code:'', campaign:'weekly', status:'live',
   discount:{kind:'percent', value:30, scope:'category', items:['Concentrate']},
   audience:'all', regions:'all',
   schedule:{recurring:'weekly', days:[3]},
   stackable:false, priority:3, cap:null,
   rewards:{pointsMult:1, redeemable:true, wallet:0},
   surfaces:['home_banner','shop_tile'],
   creative:{headline:'Wax Wednesday', subhead:'30% off every concentrate — today only.', cta:'Shop concentrates', color:'#C2841D'},
   perf:{redemptions:842, revenue:38400, aovLift:12, pointsIssued:41200, views:22400, rate:3.8, spark:[12,18,14,22,19,26,31], bySurface:{home_banner:61, shop_tile:39}} },

 { id:'p02', name:'4th of July Blowout', code:'', campaign:'holiday', status:'ended',
   discount:{kind:'tiered', scope:'cart', tiers:[{min:100,value:15},{min:200,value:25}]},
   audience:'all', regions:'all',
   schedule:{start:'2026-07-01', end:'2026-07-05', holiday:'4th of July'},
   stackable:false, priority:1, cap:null,
   rewards:{pointsMult:2, redeemable:false, wallet:0},
   surfaces:['home_hero','home_banner'],
   creative:{headline:'Red, White & Baked', subhead:'Spend more, save more — up to 25% off through July 5.', cta:'Shop the sale', color:'#C0392B'},
   perf:{redemptions:2140, revenue:172500, aovLift:31, pointsIssued:214000, views:88200, rate:5.1, spark:[40,120,180,240,90], bySurface:{home_hero:72, home_banner:28}} },

 { id:'p03', name:'Stilo Supply — BOGO Carts', code:'', campaign:'brand', status:'live',
   discount:{kind:'bogo', value:50, scope:'brand', items:['stilo']},
   audience:'members', regions:'all',
   schedule:{start:'2026-06-28', end:'2026-07-31'},
   stackable:false, priority:2, cap:2000,
   rewards:{pointsMult:1, redeemable:true, wallet:0},
   surfaces:['brand_takeover','shop_tile'],
   creative:{headline:'Two-for Stilo', subhead:'Buy any Stilo cart, get your second 50% off.', cta:'Shop Stilo', color:'#7E55C9'},
   perf:{redemptions:512, revenue:41800, aovLift:22, pointsIssued:20900, views:9800, rate:5.2, spark:[8,10,14,12,18,16,22], bySurface:{brand_takeover:58, shop_tile:42}} },

 { id:'p04', name:'VIP Double Points Weekend', code:'', campaign:'loyalty', status:'live',
   discount:{kind:'points', value:2, scope:'cart'},
   audience:'vip', regions:'all',
   schedule:{recurring:'weekly', days:[6,0]},
   stackable:true, priority:4, cap:null,
   rewards:{pointsMult:2, redeemable:true, wallet:0},
   surfaces:['loyalty','home_banner'],
   creative:{headline:'Double Points, All Weekend', subhead:'VIP members earn 2× on everything, Sat & Sun.', cta:'View my points', color:'#FFD100'},
   perf:{redemptions:1180, revenue:96200, aovLift:9, pointsIssued:384000, views:15600, rate:7.6, spark:[30,26,34,40,44,50,58], bySurface:{loyalty:44, home_banner:56}} },

 { id:'p05', name:'Welcome — $20 Off First Order', code:'WELCOME20', campaign:'evergreen', status:'live',
   discount:{kind:'dollar', value:20, scope:'cart', min:60},
   audience:'new', regions:'all',
   schedule:{start:'2026-01-01'},
   stackable:false, priority:5, cap:null,
   rewards:{pointsMult:1, redeemable:false, wallet:0},
   surfaces:['home_banner','checkout'],
   creative:{headline:'$20 off your first order', subhead:'New here? Take $20 off orders over $60 with code WELCOME20.', cta:'Start shopping', color:'#1F8A4F'},
   perf:{redemptions:1490, revenue:112400, aovLift:-4, pointsIssued:56000, views:61000, rate:2.4, spark:[42,48,44,52,49,55,60], bySurface:{home_banner:37, checkout:63}} },

 { id:'p06', name:'CHKN N WAFFLEZ Launch Drop', code:'', campaign:'brand', status:'scheduled',
   discount:{kind:'gift', scope:'brand', items:['chkn'], min:75, text:'Free pre-roll with any $75+ CHKN order'},
   audience:'all', regions:['Rancho Cucamonga','Temecula'],
   schedule:{start:'2026-07-10', end:'2026-07-24'},
   stackable:false, priority:2, cap:1500,
   rewards:{pointsMult:1.5, redeemable:false, wallet:0},
   surfaces:['home_hero','brand_takeover'],
   creative:{headline:'CHKN has landed', subhead:'The drop is here — free pre-roll on every $75+ order.', cta:'See the drop', color:'#D45A3C'} },

 { id:'p07', name:'420 Season Takeover', code:'', campaign:'holiday', status:'ended',
   discount:{kind:'percent', value:20, scope:'cart'},
   audience:'all', regions:'all',
   schedule:{start:'2026-04-15', end:'2026-04-22', holiday:'420'},
   stackable:false, priority:1, cap:null,
   rewards:{pointsMult:2, redeemable:true, wallet:0},
   surfaces:['home_hero','home_banner','shop_tile'],
   creative:{headline:'420 is a whole season', subhead:'20% off the entire store, all week long.', cta:'Shop 420', color:'#3F9E72'},
   perf:{redemptions:3820, revenue:298000, aovLift:18, pointsIssued:596000, views:142000, rate:4.6, spark:[120,180,240,300,420,260,140], bySurface:{home_hero:64, home_banner:21, shop_tile:15}} },

 { id:'p08', name:'Weekend Flower Bundle', code:'', campaign:'weekly', status:'live',
   discount:{kind:'bundle', scope:'category', items:['Flower'], text:'Buy 2 eighths, get a 3rd for half price'},
   audience:'all', regions:'all',
   schedule:{recurring:'weekly', days:[5,6,0]},
   stackable:false, priority:3, cap:null,
   rewards:{pointsMult:1, redeemable:true, wallet:0},
   surfaces:['shop_tile'],
   creative:{headline:'Stack your weekend', subhead:'Buy 2 eighths, get the 3rd half off — Fri to Sun.', cta:'Build a bundle', color:'#3F9E72'},
   perf:{redemptions:640, revenue:52200, aovLift:26, pointsIssued:26000, views:12200, rate:5.2, spark:[10,0,0,0,0,22,26], bySurface:{shop_tile:100}} },

 { id:'p09', name:'Pleasure Med — Wellness Week', code:'', campaign:'brand', status:'scheduled',
   discount:{kind:'percent', value:15, scope:'brand', items:['pleasure']},
   audience:'members', regions:'all',
   schedule:{start:'2026-07-14', end:'2026-07-21'},
   stackable:true, priority:3, cap:null,
   rewards:{pointsMult:1, redeemable:true, wallet:0},
   surfaces:['home_banner','shop_tile'],
   creative:{headline:'A week for feeling good', subhead:'15% off all Pleasure Med wellness for members.', cta:'Shop wellness', color:'#2FA59B'} },

 { id:'p10', name:'Refer a Friend — $15 Wallet', code:'', campaign:'referral', status:'live',
   discount:{kind:'dollar', value:15, scope:'cart'},
   audience:'all', regions:'all',
   schedule:{start:'2026-03-01'},
   stackable:true, priority:5, cap:null,
   rewards:{pointsMult:1, redeemable:false, wallet:15},
   surfaces:['loyalty','home_banner'],
   creative:{headline:'Give $15, get $15', subhead:'Refer a friend — you both get $15 in wallet credit.', cta:'Get my link', color:'#2C5BB8'},
   perf:{redemptions:388, revenue:29400, aovLift:6, pointsIssued:0, views:8800, rate:4.4, spark:[4,6,8,7,9,11,14], bySurface:{loyalty:71, home_banner:29}} },

 { id:'p11', name:'Points Redemption Boost', code:'', campaign:'loyalty', status:'paused',
   discount:{kind:'points', value:1.5, scope:'cart'},
   audience:'vip', regions:'all',
   schedule:{start:'2026-05-01'},
   stackable:true, priority:4, cap:null,
   rewards:{pointsMult:1, redeemable:true, wallet:0},
   surfaces:['checkout','loyalty'],
   creative:{headline:'Your points go further', subhead:'Redeem points at 1.5× value at checkout.', cta:'Redeem points', color:'#FFD100'},
   perf:{redemptions:210, revenue:16800, aovLift:2, pointsIssued:0, views:5200, rate:4.0, spark:[8,10,9,7,6,5,4], bySurface:{checkout:66, loyalty:34}} },

 { id:'p12', name:'Corona Grand Opening', code:'', campaign:'evergreen', status:'live',
   discount:{kind:'percent', value:25, scope:'cart'},
   audience:'all', regions:['Corona'],
   schedule:{start:'2026-06-20', end:'2026-07-20'},
   stackable:false, priority:2, cap:3000,
   rewards:{pointsMult:1.5, redeemable:false, wallet:0},
   surfaces:['home_hero','home_banner'],
   creative:{headline:'Corona, we\u2019re open', subhead:'25% off your first order at our new Corona shop.', cta:'Shop Corona', color:'#D45A3C'},
   perf:{redemptions:920, revenue:74600, aovLift:14, pointsIssued:44000, views:19400, rate:4.7, spark:[20,28,34,40,38,44,50], bySurface:{home_hero:69, home_banner:31}} },

 { id:'p13', name:'Hyperwolf House Blend Drop', code:'', campaign:'brand', status:'draft',
   discount:{kind:'gift', scope:'brand', items:['hyperwolf'], min:60, text:'Free grinder + 10% off the House Blend'},
   audience:'all', regions:'all',
   schedule:{},
   stackable:false, priority:3, cap:null,
   rewards:{pointsMult:1, redeemable:false, wallet:0},
   surfaces:['home_hero','brand_takeover'],
   creative:{headline:'The House Blend is coming', subhead:'Our signature drop — free grinder with every $60+.', cta:'Notify me', color:'#FFD100'} },
]; }

// ── Small local controls ─────────────────────────────────────────────────────
function Fld({ label, hint, children, style }){
  const P=useP();
  return (<label style={{ display:'flex', flexDirection:'column', gap:6, ...style }}>
    <span style={{ fontSize:11.5, fontWeight:600, color:P.ink2 }}>{label}{hint && <span style={{ color:P.inkMute, fontWeight:400 }}> · {hint}</span>}</span>
    {children}
  </label>);
}
function TextArea({ value, onChange, placeholder, rows=2 }){
  const P=useP(); const [f,setF]=useState(false);
  return (<textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} onFocus={()=>setF(true)} onBlur={()=>setF(false)}
    style={{ width:'100%', resize:'vertical', padding:'11px 13px', background:P.field, border:`1px solid ${f?P.accentBorder:P.fieldBorder}`, borderRadius:P.r10, boxShadow:f?`0 0 0 3px ${P.accentSoft}`:'none', color:P.ink, fontSize:13.5, fontFamily:P.fontSans, lineHeight:1.5, outline:'none', transition:'border-color .12s, box-shadow .12s' }}/>);
}
function DateInput({ value, onChange }){
  const P=useP(); const [f,setF]=useState(false);
  return (<input type="date" value={value||''} onChange={onChange} onFocus={()=>setF(true)} onBlur={()=>setF(false)}
    style={{ width:'100%', padding:'10px 12px', background:P.field, border:`1px solid ${f?P.accentBorder:P.fieldBorder}`, borderRadius:P.r10, boxShadow:f?`0 0 0 3px ${P.accentSoft}`:'none', color:P.ink, fontSize: 13.5, fontFamily:P.fontMono, outline:'none', colorScheme:P.mode, transition:'border-color .12s, box-shadow .12s' }}/>);
}
function Chip({ on, onClick, children, color }){
  const P=useP();
  return (<button onClick={onClick} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 11px', borderRadius:P.r999, fontSize: 12.5, fontWeight:600, cursor:'pointer', fontFamily:P.fontSans,
    background:on ? (color?color:P.ink) : P.surface3, color:on ? (color?'#fff':P.surface) : P.ink2, border:`1px solid ${on ? (color||P.ink) : P.hairline2}`, transition:'all .12s' }}>
    {on && <Icon name="check" size={12} stroke={3}/>}{children}</button>);
}
function ColorSwatch({ value, onChange }){
  const P=useP();
  const opts=['#FFD100','#C0392B','#7E55C9','#1F8A4F','#D45A3C','#2FA59B','#2C5BB8','#C2841D','#3F9E72','#0F0F0C'];
  return (<div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
    {opts.map(c=>(<button key={c} onClick={()=>onChange(c)} title={c} style={{ width:30, height:30, borderRadius:9, background:c, cursor:'pointer',
      border: value===c ? `2px solid ${P.ink}` : `1px solid ${P.hairline2}`, boxShadow: value===c?`0 0 0 3px ${P.accentSoft}`:'none', outline:'none' }}/>))}
  </div>);
}

// ── Front-end surface previews (customer app is black + yellow) ──────────────
function offerBadge(p){ const d=p.discount||{};
  if(d.kind==='percent') return d.value+'% OFF';
  if(d.kind==='dollar')  return '$'+d.value+' OFF';
  if(d.kind==='bogo')    return 'BOGO';
  if(d.kind==='bundle')  return 'BUNDLE';
  if(d.kind==='gift')    return 'FREE GIFT';
  if(d.kind==='tiered')  return 'UP TO '+Math.max(...(d.tiers||[{value:0}]).map(t=>t.value))+'%';
  if(d.kind==='points')  return d.value+'× PTS';
  return 'DEAL';
}
const APP_BG='#0F0F0C', APP_CARD='#17170F';
function SwatchImg({ h, style }){ // striped placeholder art
  return (<div style={{ background:`repeating-linear-gradient(135deg, hsl(${h} 40% 30%), hsl(${h} 40% 30%) 8px, hsl(${h} 40% 24%) 8px, hsl(${h} 40% 24%) 16px)`, ...style }}/>);
}

function CartVariant({ v, p, c, accent, ink, badge, rad, showBadge, Phone, Status, device }){
  const d=p.discount||{};
  const save = d.kind==='percent'? Math.round(84*d.value/100) : d.kind==='dollar'? d.value : d.kind==='bogo'? 21 : 24;
  const sub=84, tax=7, total=sub-save+tax;
  const items=[{n:'House Blend 3.5g', b:'Hyperwolf', pr:50, hue:110},{n:'Live Resin Cart 1g', b:'Stilo Supply', pr:34, hue:265}];
  const T=(s)=>({ fontFamily:"'JetBrains Mono',monospace", ...s });
  const CTA=({label='Checkout', kind='primary'})=> <div style={{ marginTop:12, padding:'14px', borderRadius:13, background: kind==='primary'?accent:'transparent', color: kind==='primary'?ink:'#fff', border: kind==='primary'?'none':'1px solid rgba(255,255,255,.2)', textAlign:'center', fontWeight:800, fontSize: 13.5 }}>{label}</div>;
  const Row=({it})=> <div style={{ display:'flex', gap:11, alignItems:'center', padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,.08)' }}><SwatchImg h={it.hue} style={{ width:44, height:44, borderRadius:10 }}/><div style={{ flex:1, minWidth:0 }}><div style={{ fontSize:12.5, fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{it.n}</div><div style={{ fontSize: 11.5, opacity:.55 }}>{it.b}</div></div><span style={T({ fontSize:12.5 })}>${it.pr}</span></div>;
  const wrap=(title, body, foot)=> <Phone><Status/><div style={{ padding:'6px 16px 16px', color:'#fff' }}><div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}><div style={{ fontWeight:800, fontSize:15 }}>{title}</div><span style={{ fontSize: 11.5, opacity:.5, fontFamily:"'JetBrains Mono',monospace" }}>V{v}</span></div>{body}{foot}</div></Phone>;
  const promoBanner=(compact)=> <div style={{ marginTop:14, borderRadius:13, background:accent, padding: compact?'10px 12px':'13px 14px', display:'flex', alignItems:'center', gap:11 }}><div style={{ width:compact?26:32, height:compact?26:32, borderRadius:9, background:ink, color:accent, display:'flex', alignItems:'center', justifyContent:'center' }}><Icon name="tag" size={compact?14:16}/></div><div style={{ flex:1 }}><div style={{ color:ink, fontWeight:800, fontSize:12.5 }}>{p.name} applied</div><div style={{ color:ink, opacity:.8, fontSize: 11.5 }}>{offerLabel(p)}</div></div><span style={T({ color:ink, fontWeight:900, fontSize: 13.5 })}>−{money(save)}</span></div>;
  const totalRow=(big)=> <div style={{ marginTop:14, display:'flex', justifyContent:'space-between', alignItems:'baseline' }}><span style={{ opacity:.7, fontSize: 13.5 }}>Total</span><span style={T({ fontWeight:900, fontSize:big?24:19 })}>{money(total)}</span></div>;

  // 1 — Classic drawer
  if(v===1) return wrap('Your cart', <>{items.map((it,i)=><Row key={i} it={it}/>)}{promoBanner()}{totalRow(false)}</>, <CTA/>);

  // 2 — Summary-first: big total up top, savings pill, slim items
  if(v===2) return wrap('Cart', <>
    <div style={{ borderRadius:16, background:'linear-gradient(135deg,#1c1c14,#0f0f0c)', border:`1px solid ${accent}44`, padding:'16px', marginBottom:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}><span style={{ fontSize: 11.5, opacity:.6, letterSpacing:'.08em', fontFamily:"'JetBrains Mono',monospace" }}>ORDER TOTAL</span><span style={{ padding:'3px 9px', borderRadius:99, background:accent, color:ink, fontSize: 11.5, fontWeight:800, fontFamily:"'JetBrains Mono',monospace" }}>SAVED {money(save)}</span></div>
      <div style={T({ fontSize:34, fontWeight:900, color:accent, marginTop:6 })}>{money(total)}</div>
    </div>
    {items.map((it,i)=><Row key={i} it={it}/>)}
  </>, <CTA/>);

  // 3 — Progress to reward
  if(v===3){ const goal=100, pctv=Math.min(100,Math.round(sub/goal*100)); return wrap('Your cart', <>
    <div style={{ borderRadius:13, border:`1px solid ${accent}55`, padding:'13px 14px', marginBottom:14 }}>
      <div style={{ fontSize:12.5, fontWeight:700, marginBottom:9 }}>Spend <span style={{ color:accent }}>{money(goal-sub)}</span> more for a free gift 🎁</div>
      <div style={{ height:8, borderRadius:99, background:'rgba(255,255,255,.1)', overflow:'hidden' }}><div style={{ width:pctv+'%', height:'100%', background:accent }}/></div>
    </div>
    {items.map((it,i)=><Row key={i} it={it}/>)}{promoBanner(true)}{totalRow(false)}
  </>, <CTA/>); }

  // 4 — Coupon-forward
  if(v===4) return wrap('Your cart', <>
    {items.map((it,i)=><Row key={i} it={it}/>)}
    <div style={{ marginTop:14, display:'flex', gap:8 }}>
      <div style={{ flex:1, padding:'11px 12px', borderRadius:11, border:'1px dashed rgba(255,255,255,.25)', fontSize:12.5, fontFamily:"'JetBrains Mono',monospace", color:'rgba(255,255,255,.5)' }}>{p.code||'PROMO CODE'}</div>
      <div style={{ padding:'11px 16px', borderRadius:11, background:accent, color:ink, fontWeight:800, fontSize:12.5 }}>Apply</div>
    </div>
    <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:8, fontSize: 12.5, color:accent }}><Icon name="check-circle" size={14} color={accent}/><span style={{ fontWeight:700 }}>{p.name} — saved {money(save)}</span></div>
    {totalRow(false)}
  </>, <CTA/>);

  // 5 — Line-item savings (was/now)
  if(v===5) return wrap('Your cart', <>
    {items.map((it,i)=><div key={i} style={{ display:'flex', gap:11, alignItems:'center', padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,.08)' }}><SwatchImg h={it.hue} style={{ width:44, height:44, borderRadius:10 }}/><div style={{ flex:1, minWidth:0 }}><div style={{ fontSize:12.5, fontWeight:700 }}>{it.n}</div><span style={{ fontSize:10, color:accent, fontWeight:700 }}>{d.kind==='percent'?d.value+'% off':'Deal'}</span></div><div style={{ textAlign:'right' }}><div style={T({ fontSize:12.5, fontWeight:800 })}>${Math.round(it.pr*0.7)}</div><div style={T({ fontSize: 11.5, opacity:.4, textDecoration:'line-through' })}>${it.pr}</div></div></div>)}
    {totalRow(false)}<div style={{ marginTop:4, textAlign:'right', fontSize:11.5, color:accent, fontWeight:700 }}>You saved {money(save)}</div>
  </>, <CTA/>);

  // 6 — Compact dense
  if(v===6) return wrap('Cart · 2 items', <>
    {items.map((it,i)=><div key={i} style={{ display:'flex', alignItems:'center', gap:9, padding:'7px 0' }}><span style={T({ fontSize: 11.5, opacity:.5, width:16 })}>{i+1}</span><div style={{ flex:1, fontSize:12.5, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{it.n}</div><span style={T({ fontSize: 12.5 })}>${it.pr}</span></div>)}
    <div style={{ marginTop:12, borderRadius:12, background:accent, padding:'11px 13px', display:'flex', justifyContent:'space-between', alignItems:'center' }}><span style={{ color:ink, fontWeight:800, fontSize:12.5 }}>{p.name}</span><span style={T({ color:ink, fontWeight:900 })}>−{money(save)}</span></div>
    {totalRow(true)}
  </>, <CTA/>);

  // 7 — Upsell
  if(v===7) return wrap('Your cart', <>
    {items.map((it,i)=><Row key={i} it={it}/>)}
    <div style={{ marginTop:14, fontSize: 11.5, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', color:'rgba(255,255,255,.5)', fontFamily:"'JetBrains Mono',monospace", marginBottom:9 }}>Frequently added</div>
    <div style={{ display:'flex', gap:9, overflowX:'auto' }}>{[140,60,300].map((h,i)=><div key={i} style={{ flex:'0 0 84px' }}><SwatchImg h={h} style={{ height:64, borderRadius:11 }}/><div style={{ fontSize: 11.5, fontWeight:700, marginTop:5 }}>Add +</div></div>)}</div>
    {totalRow(false)}
  </>, <CTA/>);

  // 8 — Split totals card
  if(v===8) return wrap('Order summary', <>
    {items.map((it,i)=><Row key={i} it={it}/>)}
    <div style={{ marginTop:14, borderRadius:14, background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.08)', padding:'14px' }}>
      {[['Subtotal',money(sub)],[p.name,'−'+money(save)],['Tax',money(tax)]].map((r,i)=><div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', fontSize:12.5, color: i===1?accent:'rgba(255,255,255,.75)' }}><span>{r[0]}</span><span style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight: i===1?800:500 }}>{r[1]}</span></div>)}
      <div style={{ display:'flex', justifyContent:'space-between', padding:'9px 0 0', marginTop:6, borderTop:'1px solid rgba(255,255,255,.1)' }}><span style={{ fontWeight:800 }}>Total</span><span style={T({ fontWeight:900, fontSize: 16 })}>{money(total)}</span></div>
    </div>
  </>, <CTA/>);

  // 9 — Rewards-integrated
  if(v===9) return wrap('Your cart', <>
    {items.map((it,i)=><Row key={i} it={it}/>)}
    {promoBanner(true)}
    <div style={{ marginTop:10, borderRadius:12, border:`1px solid ${accent}44`, padding:'11px 13px', display:'flex', alignItems:'center', gap:10 }}><Icon name="star" size={16} color={accent}/><div style={{ flex:1, fontSize: 12.5, fontWeight:700 }}>You&rsquo;ll earn <span style={{ color:accent }}>+{Math.round(total*2)} pts</span> on this order</div></div>
    {totalRow(false)}
  </>, <CTA/>);

  // 10 — Express checkout
  return wrap('Checkout', <>
    {items.map((it,i)=><Row key={i} it={it}/>)}
    {promoBanner(true)}{totalRow(true)}
    <div style={{ marginTop:14, display:'flex', flexDirection:'column', gap:9 }}>
      <div style={{ padding:'13px', borderRadius:12, background:'#fff', color:'#000', textAlign:'center', fontWeight:800, fontSize: 13.5 }}> Pay</div>
      <div style={{ padding:'13px', borderRadius:12, background:'rgba(255,255,255,.1)', color:'#fff', textAlign:'center', fontWeight:700, fontSize: 13.5, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}><Icon name="tag" size={15}/>Pay with card</div>
    </div>
  </>, null);
}

function SurfaceRender({ promo:p, surface, device, childCards, onReorderChild, onCardClick }){
  const c = p.creative||{}; const accent=c.color||'#FFD100';
  const lay = p.layout||{};
  const showBadge = lay.showBadge!==false;
  const ctaAlign = lay.ctaAlign||'left';
  const rad = (base)=> lay.radius!=null ? lay.radius : base;
  const dark = accent==='#0F0F0C'; const ink = dark ? '#FFD100' : '#0F0F0C';
  const badge = offerBadge(p);
  const W = device==='desktop' ? 760 : 300;

  const Phone = ({children})=> device==='desktop'
    ? <div style={{ width:W, borderRadius:14, overflow:'hidden', background:APP_BG, boxShadow:'0 24px 60px rgba(0,0,0,.28)', border:'1px solid rgba(255,255,255,.06)' }}>{children}</div>
    : <div style={{ width:W, borderRadius:40, background:'#000', padding:9, boxShadow:'0 30px 60px rgba(0,0,0,.3)' }}>
        <div style={{ borderRadius:32, overflow:'hidden', background:APP_BG, position:'relative' }}>
          <div style={{ position:'absolute', top:8, left:'50%', transform:'translateX(-50%)', width:86, height:22, borderRadius:20, background:'#000', zIndex:5 }}/>
          {children}
        </div>
      </div>;
  const Status = ()=> device==='mobile' ? <div style={{ height:40, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 20px', color:'#fff', fontSize: 12.5, fontWeight:600 }}><span>9:41</span><span style={{ fontFamily:"'JetBrains Mono',monospace", opacity:.6, fontSize: 10 }}>▮▮▮ ⌁</span></div> : null;

  // HOME HERO — big takeover
  if(surface==='home_hero'){
    const cards = (childCards && childCards.length) ? childCards : (lay.heroCards && lay.heroCards.length ? lay.heroCards : [
      {id:'hc1', label:'New drops', tag:'Fresh', hue:120},
      {id:'hc2', label:'Under $30', tag:'Deals', hue:200},
    ]);
    const editable = typeof onReorderChild==='function';
    let dragFrom=null;
    return (<Phone><Status/>
      <div style={{ padding: device==='desktop'?'16px 18px':'6px 16px 16px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <span style={{ color:'#fff', fontWeight:800, fontSize:15 }}>Hyperwolf</span>
          <span style={{ width:26, height:26, borderRadius:8, background:'rgba(255,255,255,.1)' }}/>
        </div>
        <div style={{ borderRadius:rad(20), overflow:'hidden', position:'relative', background:accent, padding:device==='desktop'?'30px 30px':'22px 20px', minHeight:device==='desktop'?230:280, display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
          <SwatchImg h={(BRANDS.find(b=>p.discount.items?.includes(b.id))||{}).hue||90} style={{ position:'absolute', inset:0, opacity:.28, mixBlendMode:'overlay' }}/>
          <div style={{ position:'relative' }}>
            {showBadge && <span style={{ display:'inline-block', padding:'5px 10px', borderRadius:99, background:ink, color:accent, fontSize: 11.5, fontWeight:800, letterSpacing:'.06em', fontFamily:"'JetBrains Mono',monospace", marginBottom:12 }}>{badge}</span>}
            <div style={{ color:ink, fontSize:device==='desktop'?34:28, fontWeight:900, letterSpacing:'-.03em', lineHeight:1.02 }}>{c.headline}</div>
            <div style={{ color:ink, opacity:.82, fontSize: 13.5, marginTop:9, maxWidth:440, lineHeight:1.4 }}>{c.subhead}</div>
            <div style={{ marginTop:16, textAlign:ctaAlign }}><span style={{ display:'inline-block', padding:'11px 18px', borderRadius:12, background:ink, color:accent, fontWeight:800, fontSize: 13.5 }}>{c.cta} →</span></div>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:12 }}>
          {cards.map((card,i)=>(<div key={card.id}
              draggable={editable}
              onDragStart={editable?(()=>{ dragFrom=i; }):undefined}
              onDragOver={editable?(e=>e.preventDefault()):undefined}
              onDrop={editable?(e=>{ e.preventDefault(); if(dragFrom!=null && dragFrom!==i){ onReorderChild(dragFrom,i); } dragFrom=null; }):undefined}
              onClick={onCardClick?(()=>onCardClick(card)):undefined}
              style={{ borderRadius:14, overflow:'hidden', background:APP_CARD, position:'relative', cursor:onCardClick?'pointer':(editable?'grab':'default'), boxShadow:editable?'0 2px 8px rgba(0,0,0,.25)':'none' }}>
            <SwatchImg h={card.hue} style={{ height:70 }}/>
            {editable && <span style={{ position:'absolute', top:6, right:6, width:20, height:20, borderRadius:6, background:'rgba(0,0,0,.55)', display:'flex', alignItems:'center', justifyContent:'center' }}><Icon name="drag" size={11} color="#fff"/></span>}
            {card.tag && <span style={{ position:'absolute', top:6, left:6, padding:'2px 6px', borderRadius:99, background:accent, color:ink, fontSize: 10, fontWeight:800, fontFamily:"'JetBrains Mono',monospace" }}>{card.tag}</span>}
            <div style={{ padding:'8px 10px' }}><div style={{ color:'#fff', fontSize:11.5, fontWeight:700 }}>{card.label}</div><div style={{ height:7, width:'40%', background:'rgba(255,255,255,.14)', borderRadius:4, marginTop:6 }}/></div>
          </div>))}
        </div>
      </div></Phone>);
  }

  // HOME BANNER — redesigned: clean split with big offer number + CTA
  if(surface==='home_banner' || surface==='category_banner'){
    const isCat = surface==='category_banner';
    const pct = (p.discount&&p.discount.kind==='percent') ? p.discount.value+'%' : (p.discount&&p.discount.kind==='bogo') ? 'BOGO' : (p.discount&&p.discount.kind==='dollar') ? '$'+p.discount.value : 'DEAL';
    const Body = (<div style={{ borderRadius:rad(18), overflow:'hidden', position:'relative', background:accent, display:'flex', alignItems:'stretch', minHeight:118 }}>
      <SwatchImg h={(BRANDS.find(b=>p.discount.items?.includes(b.id))||{}).hue||90} style={{ position:'absolute', inset:0, opacity:.2, mixBlendMode:'overlay' }}/>
      <div style={{ position:'relative', flex:1, padding:'16px 16px', display:'flex', flexDirection:'column', justifyContent:'center' }}>
        {showBadge && <span style={{ alignSelf:'flex-start', display:'inline-block', padding:'3px 8px', borderRadius:99, background:ink, color:accent, fontSize: 10, fontWeight:800, letterSpacing:'.06em', fontFamily:"'JetBrains Mono',monospace", marginBottom:8 }}>{badge}</span>}
        <div style={{ color:ink, fontSize: 21, fontWeight:900, letterSpacing:'-.025em', lineHeight:1.05 }}>{c.headline}</div>
        <div style={{ color:ink, opacity:.78, fontSize: 12.5, marginTop:4, lineHeight:1.35 }}>{c.subhead}</div>
        <div style={{ marginTop:12, textAlign:ctaAlign }}><span style={{ display:'inline-block', padding:'9px 15px', borderRadius:11, background:ink, color:accent, fontWeight:800, fontSize:12.5 }}>{c.cta} →</span></div>
      </div>
      <div style={{ position:'relative', width:96, flex:'0 0 auto', borderLeft:`1px dashed ${ink}33`, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:ink }}>
        <div style={{ fontSize:34, fontWeight:900, letterSpacing:'-.04em', lineHeight:.9, fontFamily:"'JetBrains Mono',monospace" }}>{pct}</div>
        <div style={{ fontSize: 10, fontWeight:800, letterSpacing:'.12em', textTransform:'uppercase', opacity:.7, marginTop:3 }}>{p.discount&&p.discount.kind==='bogo'?'2 for 1':'off'}</div>
      </div>
    </div>);
    if(isCat){
      // headerless — lives between category rows / top of a category page. Slider-ready.
      return (<Phone><Status/>
        <div style={{ padding:'6px 16px 16px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:9 }}>
            <span style={{ color:'#fff', fontWeight:800, fontSize: 13.5 }}>Flower</span>
            <span style={{ color:'rgba(255,255,255,.5)', fontSize: 11.5 }}>See all →</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>{[0,1].map(i=><div key={i} style={{ borderRadius:12, overflow:'hidden', background:APP_CARD }}><SwatchImg h={100+i*40} style={{ height:64 }}/></div>)}</div>
          {Body}
          {lay.slider && <div style={{ display:'flex', justifyContent:'center', gap:5, marginTop:10 }}>{[0,1,2].map(i=><span key={i} style={{ width:i===0?16:6, height:6, borderRadius:6, background:i===0?accent:'rgba(255,255,255,.25)' }}/>)}</div>}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:16, marginBottom:9 }}>
            <span style={{ color:'#fff', fontWeight:800, fontSize: 13.5 }}>Vape</span>
            <span style={{ color:'rgba(255,255,255,.5)', fontSize: 11.5 }}>See all →</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>{[0,1].map(i=><div key={i} style={{ borderRadius:12, overflow:'hidden', background:APP_CARD }}><SwatchImg h={200+i*40} style={{ height:64 }}/></div>)}</div>
        </div></Phone>);
    }
    return (<Phone><Status/>
      <div style={{ padding:'6px 16px 16px' }}>
        <div style={{ color:'#fff', fontWeight:800, fontSize:15, marginBottom:12 }}>Good afternoon 👋</div>
        {Body}
        {lay.slider && <div style={{ display:'flex', justifyContent:'center', gap:5, marginTop:10 }}>{[0,1,2].map(i=><span key={i} style={{ width:i===0?16:6, height:6, borderRadius:6, background:i===0?accent:'rgba(255,255,255,.25)' }}/>)}</div>}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginTop:14 }}>
          {[0,1,2].map(i=>(<div key={i} style={{ borderRadius:12, overflow:'hidden', background:APP_CARD }}><SwatchImg h={90+i*70} style={{ height:56 }}/></div>))}
        </div>
      </div></Phone>);
  }

  // SHOP TILE — grid with promo card
  if(surface==='shop_tile'){
    return (<Phone><Status/>
      <div style={{ padding:'6px 16px 16px' }}>
        <div style={{ color:'#fff', fontWeight:800, fontSize:15, marginBottom:12 }}>Shop</div>
        <div style={{ display:'grid', gridTemplateColumns:device==='desktop'?'repeat(4,1fr)':'1fr 1fr', gap:10 }}>
          <div style={{ gridColumn:device==='desktop'?'span 2':'span 2', borderRadius:14, overflow:'hidden', position:'relative', background:accent, padding:'14px 14px', minHeight:104, display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
            <span style={{ alignSelf:'flex-start', padding:'3px 8px', borderRadius:99, background:ink, color:accent, fontSize: 10, fontWeight:800, fontFamily:"'JetBrains Mono',monospace" }}>{badge}</span>
            <div><div style={{ color:ink, fontSize:16, fontWeight:900, letterSpacing:'-.02em', lineHeight:1.05 }}>{c.headline}</div><div style={{ color:ink, opacity:.8, fontSize: 11.5, marginTop:3 }}>{c.cta} →</div></div>
          </div>
          {[0,1,2,3].map(i=>(<div key={i} style={{ borderRadius:14, overflow:'hidden', background:APP_CARD }}><SwatchImg h={70+i*55} style={{ height:78 }}/><div style={{ padding:'8px 10px' }}><div style={{ height:8, width:'75%', background:'rgba(255,255,255,.2)', borderRadius:4 }}/><div style={{ height:8, width:'45%', background:'rgba(255,255,255,.12)', borderRadius:4, marginTop:6 }}/></div></div>))}
        </div>
      </div></Phone>);
  }

  // BRAND TAKEOVER
  if(surface==='brand_takeover'){
    const brand=(BRANDS.find(b=>p.discount.items?.includes(b.id))||{name:'Brand',hue:90});
    return (<Phone><Status/>
      <div>
        <div style={{ position:'relative', background:accent, padding:device==='desktop'?'26px 24px':'18px 18px 20px' }}>
          <SwatchImg h={brand.hue} style={{ position:'absolute', inset:0, opacity:.3, mixBlendMode:'overlay' }}/>
          <div style={{ position:'relative' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
              <div style={{ width:40, height:40, borderRadius:11, background:ink, color:accent, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize: 16 }}>{brand.name[0]}</div>
              <div style={{ color:ink, fontWeight:900, fontSize: 16, letterSpacing:'-.02em' }}>{brand.name}</div>
            </div>
            <span style={{ display:'inline-block', padding:'4px 9px', borderRadius:99, background:ink, color:accent, fontSize:10, fontWeight:800, fontFamily:"'JetBrains Mono',monospace", marginBottom:8 }}>{badge}</span>
            <div style={{ color:ink, fontSize:device==='desktop'?28:22, fontWeight:900, letterSpacing:'-.02em', lineHeight:1.05 }}>{c.headline}</div>
            <div style={{ color:ink, opacity:.82, fontSize: 13.5, marginTop:7, maxWidth:420 }}>{c.subhead}</div>
          </div>
        </div>
        <div style={{ padding:'14px 16px', display:'grid', gridTemplateColumns:device==='desktop'?'repeat(4,1fr)':'1fr 1fr', gap:10 }}>
          {[0,1,2,3].map(i=>(<div key={i} style={{ borderRadius:14, overflow:'hidden', background:APP_CARD }}><SwatchImg h={brand.hue+i*12} style={{ height:78 }}/><div style={{ padding:'8px 10px' }}><div style={{ height:8, width:'70%', background:'rgba(255,255,255,.2)', borderRadius:4 }}/></div></div>))}
        </div>
      </div></Phone>);
  }

  // HOME TAKEOVER — full-screen interstitial on app open
  if(surface==='home_takeover'){
    const brand=(BRANDS.find(b=>p.discount.items?.includes(b.id))||{name:'Hyperwolf',hue:90});
    return (<Phone>
      <div style={{ position:'relative', minHeight: device==='desktop'?420:560, background:accent, display:'flex', flexDirection:'column' }}>
        <SwatchImg h={brand.hue} style={{ position:'absolute', inset:0, opacity:.34, mixBlendMode:'overlay' }}/>
        <div style={{ position:'absolute', inset:0, background:`linear-gradient(180deg, transparent 30%, ${ink}22 100%)` }}/>
        <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'space-between', padding: device==='desktop'?'20px 22px':'46px 20px 0' }}>
          <span style={{ padding:'4px 10px', borderRadius:99, background:`${ink}1f`, color:ink, fontSize:10, fontWeight:800, letterSpacing:'.1em', fontFamily:"'JetBrains Mono',monospace" }}>FEATURED</span>
          <span style={{ width:30, height:30, borderRadius:99, background:`${ink}22`, color:ink, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700 }}>×</span>
        </div>
        <div style={{ position:'relative', flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding: device==='desktop'?'0 26px 28px':'0 22px 30px' }}>
          {showBadge && <span style={{ alignSelf:'flex-start', padding:'6px 12px', borderRadius:99, background:ink, color:accent, fontSize: 12.5, fontWeight:800, letterSpacing:'.05em', fontFamily:"'JetBrains Mono',monospace", marginBottom:14 }}>{badge}</span>}
          <div style={{ color:ink, fontSize: device==='desktop'?46:38, fontWeight:900, letterSpacing:'-.04em', lineHeight:.98 }}>{c.headline}</div>
          <div style={{ color:ink, opacity:.85, fontSize:15, marginTop:12, maxWidth:440, lineHeight:1.4 }}>{c.subhead}</div>
          <div style={{ marginTop:22, display:'flex', flexDirection:'column', gap:10 }}>
            <span style={{ textAlign:'center', padding:'15px', borderRadius:14, background:ink, color:accent, fontWeight:800, fontSize:15 }}>{c.cta} →</span>
            <span style={{ textAlign:'center', color:ink, opacity:.7, fontSize:12.5, fontWeight:600 }}>Maybe later</span>
          </div>
        </div>
      </div></Phone>);
  }

  // CART DRAWER — 10 selectable layouts
  if(surface==='cart' || surface==='checkout'){
    const v = lay.cartVariant || (surface==='checkout' ? 10 : 1);
    return <CartVariant v={v} p={p} c={c} accent={accent} ink={ink} badge={badge} rad={rad} showBadge={showBadge} Phone={Phone} Status={Status} device={device}/>;
  }

  // LOYALTY / POINTS
  if(surface==='loyalty'){
    return (<Phone><Status/>
      <div style={{ padding:'6px 16px 16px', color:'#fff' }}>
        <div style={{ fontWeight:800, fontSize:15, marginBottom:14 }}>Rewards</div>
        <div style={{ borderRadius:16, background:'linear-gradient(135deg,#1c1c14,#0f0f0c)', border:'1px solid rgba(255,209,0,.25)', padding:'16px', marginBottom:14 }}>
          <div style={{ fontSize: 11.5, opacity:.6, letterSpacing:'.08em', fontFamily:"'JetBrains Mono',monospace" }}>YOUR POINTS</div>
          <div style={{ fontSize:32, fontWeight:900, fontFamily:"'JetBrains Mono',monospace", color:'#FFD100', marginTop:4 }}>4,820</div>
        </div>
        <div style={{ borderRadius:16, overflow:'hidden', position:'relative', background:accent, padding:'16px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
            <div style={{ width:34, height:34, borderRadius:10, background:ink, color:accent, display:'flex', alignItems:'center', justifyContent:'center' }}><Icon name="star" size={17}/></div>
            <span style={{ padding:'3px 8px', borderRadius:99, background:ink, color:accent, fontSize: 10, fontWeight:800, fontFamily:"'JetBrains Mono',monospace" }}>{badge}</span>
          </div>
          <div style={{ color:ink, fontSize: 16, fontWeight:900, letterSpacing:'-.02em' }}>{c.headline}</div>
          <div style={{ color:ink, opacity:.82, fontSize:12.5, marginTop:5 }}>{c.subhead}</div>
          <div style={{ marginTop:12, display:'inline-block', padding:'9px 14px', borderRadius:10, background:ink, color:accent, fontWeight:800, fontSize:12.5 }}>{c.cta}</div>
        </div>
      </div></Phone>);
  }
  return null;
}

const CATALOG = {
  'Flower':[
    {n:'House Blend 3.5g', b:'Hyperwolf', was:50, now:35},
    {n:'Coastal OG 3.5g', b:'Driftwood', was:45, now:36},
    {n:'Sunset Sherb 3.5g', b:'Claybourne', was:40, now:32},
    {n:'Blue Zkittlez 3.5g', b:'Almora', was:44, now:33},
    {n:'Wedding Cake 7g', b:'Hyperwolf', was:80, now:56},
    {n:'Gelato 41 3.5g', b:'THCDesign', was:48, now:38},
  ],
  'Vape':[
    {n:'Live Resin Cart 1g', b:'Stilo Supply', was:50, now:35},
    {n:'All-in-One 1g', b:'Almora', was:45, now:35},
    {n:'Diamonds Cart 1g', b:'Coldfire', was:50, now:35},
    {n:'Zaza Cart 1g', b:'Harbor', was:40, now:34},
    {n:'Blue Dream 1g', b:'Stilo Supply', was:40, now:28},
  ],
  'Edibles':[
    {n:'Waffle Bites 100mg', b:'CHKN N WAFFLEZ', was:25, now:20},
    {n:'Syrup Gummies', b:'CHKN N WAFFLEZ', was:22, now:18},
    {n:'Elderberry Gummies', b:'Wyld', was:22, now:20},
    {n:'Dark Choc Bar', b:'Harbor', was:18, now:15},
    {n:'Sour Belts 100mg', b:'Kanha', was:25, now:20},
  ],
  'Concentrate':[
    {n:'Live Rosin 1g', b:'Coldfire', was:60, now:45},
    {n:'Badder 1g', b:'Claybourne', was:40, now:32},
    {n:'Sauce 1g', b:'Almora', was:45, now:34},
  ],
  'Pre-roll':[
    {n:'Infused 5-pack', b:'Kine', was:35, now:28},
    {n:'Solventless 2-pack', b:'Kine', was:30, now:24},
    {n:'Dogwalker 6-pack', b:'Claybourne', was:45, now:36},
  ],
  'Tincture':[
    {n:'1:1 Relief 30ml', b:'Pleasure Med', was:40, now:34},
    {n:'Sleep Drops 15ml', b:'Pleasure Med', was:36, now:30},
  ],
  'Wellness':[
    {n:'CBD Balm 2oz', b:'Pleasure Med', was:45, now:38},
    {n:'Recovery Roll-on', b:'Pleasure Med', was:30, now:25},
    {n:'Calm Capsules', b:'Wyld', was:28, now:25},
  ],
};
function productsFor(p){
  const d=p.discount||{};
  if(d.scope==='category') return (d.items||[]).flatMap(c=> CATALOG[c]||[]);
  if(d.scope==='brand'){ const names=(d.items||[]).map(id=>(BRANDS.find(b=>b.id===id)||{}).name); return Object.values(CATALOG).flat().filter(pr=> names.includes(pr.b)); }
  return [];
}
function scopeSummary(p){
  const d=p.discount||{};
  if(d.scope==='cart') return { kind:'cart', label:'Storewide', count:null, cats:[], list:[] };
  const list=productsFor(p);
  const cats = d.scope==='category' ? (d.items||[]) : [...new Set(list.map(x=>Object.keys(CATALOG).find(c=>CATALOG[c].includes(x))))];
  const label = d.scope==='brand' ? (d.items||[]).map(id=>(BRANDS.find(b=>b.id===id)||{}).name).join(', ') : (d.items||[]).join(', ');
  return { kind:d.scope, label, count:list.length, cats, list };
}

Object.assign(window, { PROMO:{ seedPromos, CATALOG, productsFor, scopeSummary, SURFACES, surfaceMeta, statusMeta, offerLabel, scheduleLabel, audienceLabel, REGIONS, BRANDS, CATS, CAMPAIGNS, OFFERS, HOLIDAYS, money, kd, num, fmtDate, TODAY, pd, DOW, Fld, TextArea, DateInput, Chip, ColorSwatch, SurfaceRender, offerBadge } });
