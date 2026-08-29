// ══ Hyperwolf · Customer Account — consumer mobile app ══
// Reuses POS foundation tokens + Icon. Mounts as window.CustomerAccountApp.
;(function(){
const { useState, useMemo, useRef, useEffect } = React;
const useP = window.useP, useTheme = window.useTheme, ThemeProvider = window.ThemeProvider;
const { Icon, Avatar } = window;

const money = (n)=> '$'+Number(n||0).toLocaleString(undefined,{maximumFractionDigits:0});
const money2 = (n)=> '$'+Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});

// ── customer (same Reggie Watts as the admin side) ─────────────────────────
const ME = {
  name:'Reggie Watts', first:'Reggie', tier:'Gold', since:'Jun 2024', years:'2 yr',
  phone:'(909) 555-0287', email:'reggie.w@gmail.com', dob:'Mar 14, 1990',
  points:2840, pointsToNext:660, nextTier:'Platinum', wallet:42.50, orders:34, ltv:8240,
  idVerified:true, idExpires:'Aug 2028',
};

const ORDERS = [
  { id:'A-2041', kind:'@ Home', date:'Today · 2:00p', status:'In session', total:null, items:5, live:true, genius:'Marcus Vale', eta:'Now', note:'Live rosin + sleep' },
  { id:'H-8841', kind:'Delivery', date:'Jul 2', status:'Delivered', total:212, items:4, rating:5 },
  { id:'H-8720', kind:'Pickup', date:'Jun 24', status:'Delivered', total:96, items:2, rating:5 },
  { id:'A-2010', kind:'@ Home', date:'Jun 12', status:'Completed', total:388, items:6, rating:5, genius:'Marcus Vale' },
  { id:'H-8402', kind:'Delivery', date:'May 30', status:'Delivered', total:148, items:3, rating:4 },
];

const TRACK = [
  { k:'Requested', t:'1:41p', done:true },
  { k:'Deposit paid', t:'1:42p', done:true },
  { k:'Genius assigned', t:'1:52p', done:true, meta:'Marcus Vale' },
  { k:'On the way', t:'2:02p', done:true, meta:'ETA 2:15p' },
  { k:'Arrived', t:'2:17p', done:true },
  { k:'Shopping with you', t:'now', done:true, now:true },
  { k:'Checkout', t:'—', done:false },
];

const FAVES = [
  { name:'Hyperwolf Live Rosin — Papaya', cat:'Concentrate', strain:'Hybrid', thc:78, price:55, hue:22 },
  { name:'Stilo All-in-One — Blue Dream', cat:'Vape', strain:'Sativa', thc:84, price:45, hue:210 },
  { name:'Pleasure Med Sleep Gummies', cat:'Edibles', strain:'Indica', thc:5, price:28, hue:330 },
  { name:'Hyperwolf Preroll 5pk — GMO', cat:'Pre-roll', strain:'Indica', thc:31, price:40, hue:120 },
];

const ADDRESSES = [
  { label:'Home', line:'1200 Vineyard Ave', city:'Rancho Cucamonga, CA 91739', def:true, zone:true, note:'Gate code 4417 · leave at door' },
  { label:'Work', line:'8600 Utica Ave, Ste 200', city:'Rancho Cucamonga, CA 91730', def:false, zone:true },
  { label:'Mom\u2019s', line:'420 Ridge Route', city:'Wrightwood, CA 92397', def:false, zone:false },
];

const POINTS_LOG = [
  { t:'Earned', d:'Jul 2 · Order H-8841', pts:212, plus:true },
  { t:'Redeemed', d:'Jun 24 · $10 off', pts:1000, plus:false },
  { t:'Earned', d:'Jun 12 · @ Home visit', pts:388, plus:true },
  { t:'Bonus', d:'Jun 12 · Gold 2x day', pts:388, plus:true },
  { t:'Earned', d:'May 30 · Order H-8402', pts:148, plus:true },
];

const WALLET_LOG = [
  { t:'Referral bonus', d:'Jul 5 · Dana joined', amt:25, plus:true },
  { t:'Order credit used', d:'Jul 2 · H-8841', amt:15, plus:false },
  { t:'Refund', d:'Jun 20 · out-of-stock item', amt:32.50, plus:true },
];

const REFERRALS = [
  { name:'Dana Cho', status:'Joined', when:'Jul 5', reward:25 },
  { name:'Leo Park', status:'Joined', when:'Jun 2', reward:25 },
  { name:'Sam Ortiz', status:'Invited', when:'Jun 28', reward:0 },
];

// ── shared bits ─────────────────────────────────────────────────────────
function TierBadge({ tier, sm }){ const P=useP(); const gold=tier==='Gold'||tier==='Platinum'; return (
  <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:sm?'3px 8px':'4px 10px', borderRadius:99, background:gold?P.accent:P.surface3, color:gold?P.accentInk:P.ink, fontSize:sm?10.5:11.5, fontWeight:800, letterSpacing:'.04em' }}>
    <Icon name="crown" size={sm?11:12} color={gold?P.accentInk:P.inkDim}/>{tier} VIP</span>); }

function Row({ icon, label, sub, right, onClick, danger, badge }){ const P=useP(); const [h,setH]=useState(false); return (
  <button onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} onClick={onClick} style={{ width:'100%', display:'flex', alignItems:'center', gap:13, padding:'14px 4px', background:h&&onClick?P.surface2:'transparent', border:'none', borderRadius:12, cursor:onClick?'pointer':'default', textAlign:'left', transition:'background .12s' }}>
    {icon && <span style={{ width:38, height:38, borderRadius:11, background:danger?P.badSoft:P.surface3, color:danger?P.bad:P.ink, display:'flex', alignItems:'center', justifyContent:'center', flex:'0 0 auto' }}><Icon name={icon} size={18} stroke={1.9}/></span>}
    <span style={{ flex:1, minWidth:0 }}>
      <span style={{ display:'block', fontSize: 16, fontWeight:600, color:danger?P.bad:P.ink }}>{label}</span>
      {sub && <span style={{ display:'block', fontSize: 12.5, color:P.inkMute, marginTop:1 }}>{sub}</span>}
    </span>
    {badge!=null && <span style={{ minWidth:20, height:20, padding:'0 6px', borderRadius:99, background:P.accent, color:P.accentInk, fontSize: 11.5, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center' }}>{badge}</span>}
    {right}
    {onClick && <Icon name="chevron-right" size={18} color={P.inkFaint}/>}
  </button>); }

function ScreenHead({ title, onBack, right }){ const P=useP(); return (
  <div style={{ position:'sticky', top:0, zIndex:10, display:'flex', alignItems:'center', gap:12, padding:'14px 18px 12px', background:P.surface, borderBottom:`1px solid ${P.hairline}`, backdropFilter:'blur(8px)' }}>
    {onBack && <button onClick={onBack} style={{ width:34, height:34, borderRadius:10, border:'none', background:P.surface3, color:P.ink, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}><Icon name="chevron-left" size={20}/></button>}
    <span style={{ flex:1, fontSize: 16, fontWeight:800, letterSpacing:'-.01em', color:P.ink }}>{title}</span>
    {right}
  </div>); }

function Card2({ children, style, pad=16, onClick }){ const P=useP(); return (
  <div onClick={onClick} style={{ background:P.surface, border:`1px solid ${P.hairline2}`, borderRadius:16, padding:pad, cursor:onClick?'pointer':'default', ...style }}>{children}</div>); }

function Btn({ children, kind='primary', icon, sm, onClick, full, style }){ const P=useP(); const [h,setH]=useState(false);
  const base={ display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8, padding:sm?'9px 14px':'13px 18px', fontSize:sm?13:14.5, fontWeight:700, borderRadius:13, cursor:'pointer', border:'1px solid transparent', width:full?'100%':'auto', transition:'all .13s' };
  const styles={ primary:{ background:P.accent, color:P.accentInk }, dark:{ background:P.ink, color:P.surface }, ghost:{ background:'transparent', color:P.ink, borderColor:P.hairline3 } };
  return <button onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} onClick={onClick} style={{ ...base, ...styles[kind], transform:h?'translateY(-1px)':'none', ...style }}>{icon&&<Icon name={icon} size={sm?15:17} stroke={2.1}/>}{children}</button>; }

function StrainTag({ type, thc }){ const P=useP(); if(!type) return null; const c=type==='Indica'?P.indica:type==='Sativa'?P.sativa:P.hybrid; return (
  <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontFamily:P.fontMono }}>
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 7px', borderRadius:99, background:c+(P.mode==='dark'?'28':'1F'), color:c, fontSize: 10, fontWeight:700 }}><span style={{ width:5, height:5, borderRadius:99, background:c }}/>{type.toUpperCase()}</span>
    {thc!=null&&<span style={{ fontSize:10, color:P.inkDim, fontWeight:600 }}>{thc}%</span>}</span>); }

function Thumb({ hue, size=52 }){ const P=useP(); return (
  <div style={{ width:size, height:size, borderRadius:12, flex:'0 0 auto', position:'relative', overflow:'hidden', background:`linear-gradient(140deg, hsl(${hue} ${P.mode==='dark'?'42%':'56%'} ${P.mode==='dark'?'34%':'50%'}), hsl(${(hue+34)%360} 52% 34%))` }}>
    <div style={{ position:'absolute', inset:0, background:'radial-gradient(circle at 30% 24%, rgba(255,255,255,.4), transparent 56%)' }}/>
    <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}><Icon name="leaf" size={size*0.42} color="rgba(255,255,255,.5)"/></div>
  </div>); }

// ══ SCREEN: ACCOUNT HUB ═══════════════════════════════════════════════════
function IndexItem({ n, label, meta, live, onClick, last }){ const P=useP(); const [h,setH]=useState(false); return (
  <button onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} onClick={onClick} style={{ width:'100%', display:'flex', alignItems:'center', gap:16, padding:'17px 0', background:'transparent', border:'none', borderBottom:last?'none':`1px solid ${P.hairline}`, cursor:'pointer', textAlign:'left' }}>
    <span className="mono" style={{ fontSize: 12.5, fontWeight:600, color:h?P.accent:P.inkFaint, width:22, transition:'color .13s' }}>{n}</span>
    <span style={{ flex:1, minWidth:0, display:'flex', alignItems:'center', gap:9 }}>
      <span style={{ fontSize:16.5, fontWeight:600, letterSpacing:'-.01em', color:P.ink, transform:h?'translateX(3px)':'none', transition:'transform .14s' }}>{label}</span>
      {live && <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:10, fontWeight:800, color:P.good }}><span style={{ width:6, height:6, borderRadius:99, background:P.good }}/>LIVE</span>}
    </span>
    {meta && <span className="mono" style={{ fontSize: 12.5, color:P.inkMute }}>{meta}</span>}
    <Icon name="arrow-right" size={16} color={h?P.ink:P.inkFaint}/>
  </button>); }

function HubScreen({ go }){
  const P=useP(); const { mode, toggle }=useTheme();
  const pct = ME.points/(ME.points+ME.pointsToNext);
  return (<div style={{ padding:'0 22px' }}>
    {/* header */}
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'22px 0 0' }}>
      <span className="mono" style={{ fontSize: 11.5, fontWeight:600, letterSpacing:'.2em', textTransform:'uppercase', color:P.inkMute }}>Hyperwolf · Member</span>
      <div style={{ display:'flex', gap:14 }}>
        <button onClick={toggle} style={{ background:'none', border:'none', color:P.inkDim, cursor:'pointer', padding:0 }}><Icon name={mode==='dark'?'sun':'moon'} size={18}/></button>
        <button onClick={()=>go('settings')} style={{ background:'none', border:'none', color:P.inkDim, cursor:'pointer', padding:0 }}><Icon name="settings" size={18}/></button>
      </div>
    </div>

    {/* greeting */}
    <div style={{ padding:'34px 0 22px' }}>
      <div style={{ fontSize:34, fontWeight:800, letterSpacing:'-.03em', lineHeight:1.05, color:P.ink }}>Good afternoon,<br/>{ME.first}.</div>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:16 }}>
        <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize: 12.5, fontWeight:700, letterSpacing:'.04em', color:P.ink }}><Icon name="crown" size={14} color={P.accent}/>GOLD VIP</span>
        <span style={{ width:4, height:4, borderRadius:99, background:P.inkFaint }}/>
        <span className="mono" style={{ fontSize: 12.5, color:P.inkMute }}>member {ME.years}</span>
      </div>
    </div>

    {/* points, editorial */}
    <div style={{ padding:'4px 0 20px', borderTop:`1px solid ${P.hairline2}`, borderBottom:`1px solid ${P.hairline2}` }}>
      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', paddingTop:20 }}>
        <div><div className="mono" style={{ fontSize:44, fontWeight:700, letterSpacing:'-.02em', lineHeight:.9, color:P.ink }}>{ME.points.toLocaleString()}</div><div className="mono" style={{ fontSize: 11.5, letterSpacing:'.16em', color:P.inkMute, marginTop:8 }}>POINTS BALANCE</div></div>
        <div style={{ textAlign:'right' }}><div className="mono" style={{ fontSize: 16, fontWeight:700, color:P.ink }}>{money2(ME.wallet)}</div><div className="mono" style={{ fontSize: 11.5, letterSpacing:'.16em', color:P.inkMute, marginTop:4 }}>CREDIT</div></div>
      </div>
      <div style={{ marginTop:16, height:2, background:P.hairline2, position:'relative' }}><div style={{ position:'absolute', left:0, top:0, height:'100%', width:(pct*100)+'%', background:P.accent }}/></div>
      <div style={{ fontSize:11.5, color:P.inkMute, marginTop:8 }}>{ME.pointsToNext} points to <span style={{ color:P.ink, fontWeight:600 }}>Platinum</span></div>
    </div>

    {/* live @home */}
    <button onClick={()=>go('order','A-2041')} style={{ width:'100%', display:'flex', alignItems:'center', gap:13, padding:'16px 0', background:'transparent', border:'none', borderBottom:`1px solid ${P.hairline}`, cursor:'pointer', textAlign:'left' }}>
      <span style={{ position:'relative', width:9, height:9 }}><span style={{ position:'absolute', inset:0, borderRadius:99, background:P.good }}/><span style={{ position:'absolute', inset:-4, borderRadius:99, border:`1.5px solid ${P.good}`, animation:'shPing 1.8s ease-out infinite' }}/></span>
      <span style={{ flex:1 }}><span style={{ display:'block', fontSize: 13.5, fontWeight:700, color:P.ink }}>Marcus is shopping with you</span><span style={{ display:'block', fontSize:11.5, color:P.inkMute, marginTop:1 }}>@ Home visit in progress · track live</span></span>
      <Icon name="arrow-right" size={17} color={P.ink}/>
    </button>

    {/* index */}
    <div style={{ padding:'8px 0 4px' }}>
      <IndexItem n="01" label="Shop @ Home" meta="1 live" live onClick={()=>go('athome')}/>
      <IndexItem n="02" label="Orders" meta={ME.orders+''} onClick={()=>go('orders')}/>
      <IndexItem n="03" label="Points & rewards" meta="Gold 2×" onClick={()=>go('points')}/>
      <IndexItem n="04" label="Wallet" meta={money2(ME.wallet)} onClick={()=>go('wallet')}/>
      <IndexItem n="05" label="Membership" meta="Gold" onClick={()=>go('membership')}/>
      <IndexItem n="06" label="Refer friends" meta="$50" onClick={()=>go('referrals')}/>
      <IndexItem n="07" label="Favorites" meta={FAVES.length+''} onClick={()=>go('faves')}/>
      <IndexItem n="08" label="Profile & ID" meta="Verified" onClick={()=>go('profile')}/>
      <IndexItem n="09" label="Addresses" meta={ADDRESSES.length+''} onClick={()=>go('addresses')}/>
      <IndexItem n="10" label="Notifications" onClick={()=>go('settings')}/>
      <IndexItem n="11" label="Support" onClick={()=>go('support')} last/>
    </div>
    <div style={{ textAlign:'center', padding:'22px 0 26px' }} className="mono"><button onClick={()=>{ window.location.href='Hyperwolf.html'; }} style={{ background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'inherit', fontSize: 11.5, color:P.inkFaint, letterSpacing:'.1em' }}>SIGN OUT</button></div>
  </div>);
}
function Group({ title, children }){ const P=useP(); return (
  <div style={{ marginTop:16 }}>
    <div style={{ fontSize: 11.5, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:P.inkMute, padding:'0 4px 2px' }}>{title}</div>
    <div>{children}</div>
  </div>); }

// ══ SCREEN: ORDERS ════════════════════════════════════════════════════════
function OrdersScreen({ go, back }){ const P=useP(); return (<div>
  <ScreenHead title="Order history" onBack={back}/>
  <div style={{ padding:'14px 16px 24px', display:'flex', flexDirection:'column', gap:10 }}>
    {ORDERS.map(o=>(
      <Card2 key={o.id} onClick={()=>go('order',o.id)} pad={14} style={{ borderColor:o.live?P.accentBorder:P.hairline2 }}>
        <div style={{ display:'flex', alignItems:'center', gap:11 }}>
          <span style={{ width:42, height:42, borderRadius:12, background:o.kind==='@ Home'?P.accent:P.surface3, color:o.kind==='@ Home'?P.accentInk:P.ink, display:'flex', alignItems:'center', justifyContent:'center', flex:'0 0 auto' }}><Icon name={o.kind==='@ Home'?'route':o.kind==='Pickup'?'shop':'truck'} size={19}/></span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}><span style={{ fontSize: 13.5, fontWeight:700, color:P.ink }}>{o.kind}</span>{o.live&&<span style={{ fontSize:10, fontWeight:800, color:P.good, display:'inline-flex', alignItems:'center', gap:4 }}><span style={{ width:6, height:6, borderRadius:99, background:P.good }}/>LIVE</span>}</div>
            <div className="mono" style={{ fontSize: 11.5, color:P.inkMute, marginTop:1 }}>{o.id} · {o.date} · {o.items} items</div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:13.5, fontWeight:700, color:o.total?P.ink:P.good, fontFamily:o.total?P.fontMono:P.fontSans }}>{o.total?money(o.total):o.status}</div>
            {o.rating&&<div className="mono" style={{ fontSize: 11.5, color:P.inkMute, marginTop:1 }}>★ {o.rating}.0</div>}
          </div>
        </div>
      </Card2>
    ))}
  </div>
</div>); }

// ══ SCREEN: ORDER / @HOME TRACKING ════════════════════════════════════════
function OrderScreen({ id, back, go }){ const P=useP(); const o=ORDERS.find(x=>x.id===id)||ORDERS[0]; const live=o.live;
  return (<div>
  <ScreenHead title={live?'Your @ Home visit':'Order '+o.id} onBack={back}/>
  <div style={{ padding:'14px 16px 24px', display:'flex', flexDirection:'column', gap:14 }}>
    {live && (<>
      <Card2 pad={0} style={{ overflow:'hidden' }}>
        <div style={{ height:150, position:'relative', background:P.mode==='dark'?'#0b0f0d':'#e9efe8' }}>
          <div style={{ position:'absolute', inset:0, backgroundImage:`linear-gradient(${P.hairline} 1px,transparent 1px),linear-gradient(90deg,${P.hairline} 1px,transparent 1px)`, backgroundSize:'32px 32px', opacity:.6 }}/>
          <div style={{ position:'absolute', left:'70%', top:'62%', transform:'translate(-50%,-50%)' }}><span style={{ display:'flex', flexDirection:'column', alignItems:'center' }}><span style={{ padding:'3px 8px', background:P.accent, color:P.accentInk, borderRadius:99, fontSize: 11.5, fontWeight:800 }}>You</span><span style={{ width:8, height:8, borderRadius:99, background:P.accentInk, marginTop:3 }}/></span></div>
          <div style={{ position:'absolute', left:'26%', top:'34%' }}><span style={{ display:'flex', flexDirection:'column', alignItems:'center' }}><span style={{ padding:'2px 4px 2px 3px', background:P.surface, border:`1.5px solid ${P.good}`, borderRadius:99, display:'flex', alignItems:'center', gap:4 }}><Avatar name="Marcus Vale" size={18}/><span style={{ fontSize:10, fontWeight:700, color:P.ink, paddingRight:3 }}>Marcus</span></span></span></div>
          <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%' }}><line x1="27%" y1="38%" x2="69%" y2="60%" stroke={P.good} strokeWidth="2" strokeDasharray="4 4"/></svg>
        </div>
        <div style={{ padding:14, display:'flex', alignItems:'center', gap:12 }}>
          <Avatar name="Marcus Vale" size={44}/>
          <div style={{ flex:1 }}><div style={{ fontSize: 16, fontWeight:700, color:P.ink }}>Marcus Vale</div><div style={{ fontSize:11.5, color:P.inkMute }}>Your genius · ★ 4.9 · Tesla Model Y</div></div>
          <button style={{ width:40, height:40, borderRadius:12, border:'none', background:P.surface3, color:P.ink, cursor:'pointer' }}><Icon name="phone" size={18}/></button>
          <button onClick={()=>go('support')} style={{ width:40, height:40, borderRadius:12, border:'none', background:P.ink, color:P.surface, cursor:'pointer' }}><Icon name="note" size={18}/></button>
        </div>
      </Card2>
      <Card2>
        <div style={{ fontSize: 12.5, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', color:P.inkMute, marginBottom:14 }}>Visit progress</div>
        {TRACK.map((s,i)=>(
          <div key={i} style={{ display:'flex', gap:13 }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
              <div style={{ width:20, height:20, borderRadius:99, background:s.done?(s.now?P.accent:P.good):P.surface3, border:`2px solid ${s.done?(s.now?P.accentBorder:P.good):P.hairline3}`, display:'flex', alignItems:'center', justifyContent:'center' }}>{s.done&&<Icon name="check" size={10} stroke={3} color={s.now?P.accentInk:'#fff'}/>}</div>
              {i<TRACK.length-1&&<div style={{ width:2, flex:1, minHeight:22, background:s.done?P.good:P.hairline2 }}/>}
            </div>
            <div style={{ paddingBottom:16, flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}><span style={{ fontSize:13.5, fontWeight:600, color:s.done?P.ink:P.inkMute }}>{s.k}</span>{s.now&&<span style={{ fontSize:10, fontWeight:800, color:P.good }}>NOW</span>}<span className="mono" style={{ marginLeft:'auto', fontSize: 11.5, color:P.inkMute }}>{s.t}</span></div>
              {s.meta&&<div style={{ fontSize:11.5, color:P.inkMute, marginTop:1 }}>{s.meta}</div>}
            </div>
          </div>
        ))}
      </Card2>
      <Card2>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}><span style={{ fontSize:13.5, fontWeight:700, color:P.ink }}>Deposit</span><span className="mono" style={{ fontSize:13.5, fontWeight:700, color:P.good }}>$100 paid</span></div>
        <div style={{ fontSize:11.5, color:P.inkMute, marginTop:3 }}>Applied to your total at checkout. Balance charged to Visa •• 4021 when Marcus wraps up.</div>
      </Card2>
    </>)}
    {!live && (<>
      <Card2>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}><div><div style={{ fontSize:15, fontWeight:700, color:P.ink }}>{o.kind}</div><div className="mono" style={{ fontSize:11.5, color:P.inkMute }}>{o.date}</div></div><span style={{ padding:'5px 11px', borderRadius:99, background:P.goodSoft, color:P.good, fontSize: 12.5, fontWeight:700 }}>{o.status}</span></div>
      </Card2>
      <Card2>
        <div style={{ fontSize: 12.5, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', color:P.inkMute, marginBottom:12 }}>{o.items} items</div>
        {FAVES.slice(0,o.items>4?4:o.items).map((f,i)=>(
          <div key={i} style={{ display:'flex', alignItems:'center', gap:11, padding:'9px 0', borderTop:i?`1px solid ${P.hairline}`:'none' }}>
            <Thumb hue={f.hue} size={42}/>
            <div style={{ flex:1, minWidth:0 }}><div style={{ fontSize: 13.5, fontWeight:600, color:P.ink }}>{f.name}</div><div style={{ marginTop:2 }}><StrainTag type={f.strain} thc={f.thc}/></div></div>
            <span className="mono" style={{ fontSize:12.5, fontWeight:600, color:P.ink }}>{money(f.price)}</span>
          </div>
        ))}
        <div style={{ display:'flex', justifyContent:'space-between', paddingTop:12, marginTop:6, borderTop:`1px solid ${P.hairline2}` }}><span style={{ fontSize: 13.5, fontWeight:700, color:P.ink }}>Total</span><span className="mono" style={{ fontSize:15, fontWeight:700, color:P.ink }}>{money(o.total)}</span></div>
      </Card2>
      <Btn kind="primary" icon="refresh" full onClick={()=>{}}>Reorder these items</Btn>
    </>)}
  </div>
</div>); }

// ══ SCREEN: SHOP @ HOME (customer) ════════════════════════════════════════
function AtHomeScreen({ back, go }){ const P=useP(); return (<div>
  <ScreenHead title="Shop @ Home" onBack={back}/>
  <div style={{ padding:'14px 16px 24px', display:'flex', flexDirection:'column', gap:14 }}>
    <div style={{ position:'relative', borderRadius:16, overflow:'hidden', padding:18, background:P.mode==='dark'?'linear-gradient(160deg,#1c1a12,#111)':'linear-gradient(160deg,#151310,#26261f)' }}>
      <div style={{ position:'absolute', top:-50, right:-40, width:180, height:180, borderRadius:'50%', background:`radial-gradient(circle,${P.accent}33,transparent 70%)` }}/>
      <div style={{ position:'relative' }}>
        <span style={{ fontSize: 11.5, fontWeight:800, letterSpacing:'.16em', color:P.accent, textTransform:'uppercase' }}>VIP Exclusive</span>
        <div style={{ fontSize: 21, fontWeight:800, color:'#fff', marginTop:6, lineHeight:1.15 }}>Bring the dispensary<br/>to your couch</div>
        <div style={{ fontSize:12.5, color:'rgba(255,255,255,.65)', marginTop:8, lineHeight:1.5 }}>A cannabis genius arrives with a full menu for up to 45 minutes. $150 min · $100 refundable deposit.</div>
        <div style={{ marginTop:14 }}><Btn kind="primary" icon="route" onClick={()=>go('book')}>Book a visit</Btn></div>
      </div>
    </div>
    <div>
      <div style={{ fontSize: 11.5, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:P.inkMute, padding:'4px 4px 6px' }}>Live now</div>
      <Card2 onClick={()=>go('order','A-2041')} style={{ borderColor:P.accentBorder }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <Avatar name="Marcus Vale" size={42}/>
          <div style={{ flex:1 }}><div style={{ fontSize: 13.5, fontWeight:700, color:P.ink }}>Marcus is with you</div><div style={{ fontSize:11.5, color:P.inkMute }}>A-2041 · shopping now · track visit</div></div>
          <span style={{ width:9, height:9, borderRadius:99, background:P.good }}/>
        </div>
      </Card2>
    </div>
    <div>
      <div style={{ fontSize: 11.5, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:P.inkMute, padding:'4px 4px 6px' }}>Past visits</div>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {ORDERS.filter(o=>o.kind==='@ Home'&&!o.live).map(o=>(
          <Card2 key={o.id} onClick={()=>go('order',o.id)} pad={13}>
            <div style={{ display:'flex', alignItems:'center', gap:11 }}>
              <Avatar name={o.genius||'Marcus Vale'} size={38}/>
              <div style={{ flex:1 }}><div style={{ fontSize:13.5, fontWeight:600, color:P.ink }}>{o.genius}</div><div className="mono" style={{ fontSize: 11.5, color:P.inkMute }}>{o.date} · {money(o.total)}</div></div>
              <span className="mono" style={{ fontSize: 12.5, color:P.inkMute }}>★ {o.rating}.0</span>
            </div>
          </Card2>
        ))}
      </div>
    </div>
  </div>
</div>); }

// ══ SCREEN: BOOK VISIT ════════════════════════════════════════════════════
function BookScreen({ back }){ const P=useP(); const [addr,setAddr]=useState(0); const [slot,setSlot]=useState('4:00–4:45p'); const [note,setNote]=useState('');
  const slots=['2:00–2:45p','2:45–3:30p','4:00–4:45p','5:15–6:00p','6:30–7:15p'];
  return (<div>
  <ScreenHead title="Book @ Home" onBack={back}/>
  <div style={{ padding:'14px 16px 100px', display:'flex', flexDirection:'column', gap:18 }}>
    <div><div style={{ fontSize: 13.5, fontWeight:700, color:P.ink, marginBottom:8 }}>Where</div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {ADDRESSES.map((a,i)=>(
          <button key={i} onClick={()=>a.zone&&setAddr(i)} disabled={!a.zone} style={{ display:'flex', alignItems:'center', gap:11, padding:'12px 14px', borderRadius:13, border:`1.5px solid ${addr===i?P.accentBorder:P.hairline2}`, background:addr===i?P.accentSoft:P.surface, cursor:a.zone?'pointer':'not-allowed', opacity:a.zone?1:.5, textAlign:'left' }}>
            <Icon name="pin" size={18} color={addr===i?P.accentInk:P.inkDim}/>
            <div style={{ flex:1 }}><div style={{ fontSize:13.5, fontWeight:700, color:P.ink }}>{a.label}{!a.zone&&<span style={{ fontSize: 11.5, color:P.bad, fontWeight:600 }}> · outside zone</span>}</div><div style={{ fontSize:11.5, color:P.inkMute }}>{a.line}</div></div>
            {addr===i&&a.zone&&<Icon name="check-circle" size={18} color={P.accentInk}/>}
          </button>
        ))}
      </div>
    </div>
    <div><div style={{ fontSize: 13.5, fontWeight:700, color:P.ink, marginBottom:8 }}>When · Today, Jul 8</div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        {slots.map(s=>(<button key={s} onClick={()=>setSlot(s)} className="mono" style={{ padding:'9px 12px', borderRadius:11, border:`1.5px solid ${slot===s?P.accentBorder:P.hairline2}`, background:slot===s?P.accent:P.surface, color:slot===s?P.accentInk:P.ink, fontSize:12.5, fontWeight:700, cursor:'pointer' }}>{s}</button>))}
      </div>
    </div>
    <div><div style={{ fontSize: 13.5, fontWeight:700, color:P.ink, marginBottom:8 }}>Anything you're looking for?</div>
      <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. restock rosin carts + something for sleep" style={{ width:'100%', minHeight:80, padding:13, borderRadius:13, border:`1px solid ${P.fieldBorder}`, background:P.field, color:P.ink, fontSize:13.5, fontFamily:P.fontSans, resize:'none', outline:'none' }}/>
    </div>
    <Card2 style={{ background:P.surface2 }}><div style={{ display:'flex', justifyContent:'space-between', fontSize: 13.5 }}><span style={{ color:P.inkDim }}>Refundable deposit</span><span className="mono" style={{ fontWeight:700, color:P.ink }}>$100.00</span></div><div style={{ fontSize:11.5, color:P.inkMute, marginTop:5 }}>Applied to your order. Fully refunded if you cancel 2h before.</div></Card2>
  </div>
  <div style={{ position:'absolute', left:0, right:0, bottom:56, padding:'12px 16px', background:P.surface, borderTop:`1px solid ${P.hairline2}` }}><Btn kind="primary" icon="lock" full>Confirm · pay $100 deposit</Btn></div>
</div>); }

// ══ SCREEN: POINTS ════════════════════════════════════════════════════════
function PointsScreen({ back }){ const P=useP(); const pct=ME.points/(ME.points+ME.pointsToNext);
  const rewards=[['$2.50 off','100 pts',true],['$5 off','200 pts',true],['$10 off','400 pts',true],['$20 off','800 pts',true],['Birthday $20','perk',true]];
  return (<div>
  <ScreenHead title="Points & rewards" onBack={back}/>
  <div style={{ padding:'14px 16px 24px', display:'flex', flexDirection:'column', gap:16 }}>
    <div style={{ position:'relative', borderRadius:18, overflow:'hidden', padding:20, background:P.mode==='dark'?'linear-gradient(150deg,#1c1a12,#111)':'linear-gradient(150deg,#151310,#26261f)', textAlign:'center' }}>
      <div style={{ position:'absolute', top:-60, left:'50%', transform:'translateX(-50%)', width:200, height:200, borderRadius:'50%', background:`radial-gradient(circle,${P.accent}30,transparent 70%)` }}/>
      <div style={{ position:'relative' }}>
        <div className="mono" style={{ fontSize:40, fontWeight:700, color:P.accent, lineHeight:1 }}>{ME.points.toLocaleString()}</div>
        <div style={{ fontSize: 12.5, color:'rgba(255,255,255,.6)', marginTop:4, letterSpacing:'.1em', textTransform:'uppercase' }}>Points balance</div>
        <div style={{ marginTop:14, height:8, borderRadius:99, background:'rgba(255,255,255,.12)', overflow:'hidden' }}><div style={{ width:(pct*100)+'%', height:'100%', background:P.accent }}/></div>
        <div style={{ fontSize:11.5, color:'rgba(255,255,255,.6)', marginTop:8 }}>{ME.pointsToNext} points to <b style={{ color:'#fff' }}>{ME.nextTier}</b> · Gold earns 2× on every order</div>
      </div>
    </div>
    <div><div style={{ fontSize: 12.5, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', color:P.inkMute, marginBottom:8 }}>Redeem</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        {rewards.map((r,i)=>(<Card2 key={i} pad={14} style={{ opacity:r[2]?1:.55 }}>
          <Icon name="gift" size={20} color={r[2]?P.accent:P.inkMute}/>
          <div style={{ fontSize: 16, fontWeight:700, color:P.ink, marginTop:8 }}>{r[0]}</div>
          <div className="mono" style={{ fontSize:11.5, color:P.inkMute, marginTop:2 }}>{r[1]}</div>
          <div style={{ marginTop:10 }}><Btn kind={r[2]?'dark':'ghost'} sm full>{r[2]?'Redeem':'Locked'}</Btn></div>
        </Card2>))}
      </div>
    </div>
    <div><div style={{ fontSize: 12.5, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', color:P.inkMute, marginBottom:4 }}>Activity</div>
      {POINTS_LOG.map((l,i)=>(<div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 4px', borderTop:i?`1px solid ${P.hairline}`:'none' }}>
        <span style={{ width:34, height:34, borderRadius:10, background:l.plus?P.goodSoft:P.surface3, color:l.plus?P.good:P.inkDim, display:'flex', alignItems:'center', justifyContent:'center' }}><Icon name={l.plus?'plus':'gift'} size={16} stroke={2.2}/></span>
        <div style={{ flex:1 }}><div style={{ fontSize:13.5, fontWeight:600, color:P.ink }}>{l.t}</div><div style={{ fontSize:11.5, color:P.inkMute }}>{l.d}</div></div>
        <span className="mono" style={{ fontSize:13.5, fontWeight:700, color:l.plus?P.good:P.ink }}>{l.plus?'+':'−'}{l.pts.toLocaleString()}</span>
      </div>))}
    </div>
  </div>
</div>); }

// ══ SCREEN: WALLET ════════════════════════════════════════════════════════
function WalletScreen({ back }){ const P=useP(); return (<div>
  <ScreenHead title="Wallet" onBack={back}/>
  <div style={{ padding:'14px 16px 24px', display:'flex', flexDirection:'column', gap:16 }}>
    <div style={{ borderRadius:18, padding:20, background:P.mode==='dark'?'linear-gradient(150deg,#1c1a12,#111)':'linear-gradient(150deg,#151310,#26261f)' }}>
      <div style={{ fontSize: 11.5, letterSpacing:'.14em', color:'rgba(255,255,255,.55)', textTransform:'uppercase' }}>Store credit</div>
      <div className="mono" style={{ fontSize:34, fontWeight:700, color:'#fff', marginTop:6 }}>{money2(ME.wallet)}</div>
      <div style={{ fontSize:11.5, color:'rgba(255,255,255,.55)', marginTop:4 }}>Auto-applies at checkout</div>
    </div>
    <div><div style={{ fontSize: 12.5, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', color:P.inkMute, marginBottom:8 }}>Payment methods</div>
      <Card2 pad={0}>
        {[['Visa','•• 4021','card',true],['Apple Pay','default','wallet',false]].map((m,i)=>(
          <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 15px', borderTop:i?`1px solid ${P.hairline}`:'none' }}>
            <Icon name={m[2]} size={20} color={P.inkDim}/>
            <div style={{ flex:1 }}><div style={{ fontSize:13.5, fontWeight:600, color:P.ink }}>{m[0]}</div><div className="mono" style={{ fontSize:11.5, color:P.inkMute }}>{m[1]}</div></div>
            {m[3]&&<span style={{ fontSize: 11.5, fontWeight:700, color:P.good }}>DEFAULT</span>}
          </div>
        ))}
        <div style={{ padding:'13px 15px', borderTop:`1px solid ${P.hairline}` }}><button style={{ display:'flex', alignItems:'center', gap:9, background:'none', border:'none', color:P.ink, fontSize:13.5, fontWeight:600, cursor:'pointer' }}><Icon name="plus" size={17}/>Add payment method</button></div>
      </Card2>
    </div>
    <div><div style={{ fontSize: 12.5, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', color:P.inkMute, marginBottom:4 }}>Credit activity</div>
      {WALLET_LOG.map((l,i)=>(<div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 4px', borderTop:i?`1px solid ${P.hairline}`:'none' }}>
        <span style={{ width:34, height:34, borderRadius:10, background:l.plus?P.goodSoft:P.surface3, color:l.plus?P.good:P.inkDim, display:'flex', alignItems:'center', justifyContent:'center' }}><Icon name={l.plus?'arrow-down':'arrow-up'} size={16} stroke={2.2}/></span>
        <div style={{ flex:1 }}><div style={{ fontSize:13.5, fontWeight:600, color:P.ink }}>{l.t}</div><div style={{ fontSize:11.5, color:P.inkMute }}>{l.d}</div></div>
        <span className="mono" style={{ fontSize:13.5, fontWeight:700, color:l.plus?P.good:P.ink }}>{l.plus?'+':'−'}{money2(l.amt)}</span>
      </div>))}
    </div>
  </div>
</div>); }

// ══ SCREEN: MEMBERSHIP ════════════════════════════════════════════════════
function MembershipScreen({ back }){ const P=useP();
  const tiers=[['Bronze','0 pts',['Standard delivery','Points on orders']],['Silver','1,000 pts',['1.5× points','Early drops']],['Gold','2,500 pts',['2× points','Shop @ Home access','Priority delivery','$25 birthday credit']],['Platinum','3,500 pts',['3× points','Free @ Home deposit','Dedicated genius','Exclusive strains']]];
  return (<div>
  <ScreenHead title="Membership" onBack={back}/>
  <div style={{ padding:'14px 16px 24px', display:'flex', flexDirection:'column', gap:14 }}>
    <div style={{ borderRadius:18, padding:20, background:P.mode==='dark'?'linear-gradient(150deg,#2a2410,#151310)':'linear-gradient(150deg,#151310,#33301f)', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:-40, right:-30, width:160, height:160, borderRadius:'50%', background:`radial-gradient(circle,${P.accent}44,transparent 70%)` }}/>
      <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div><div style={{ fontSize: 11.5, letterSpacing:'.14em', color:'rgba(255,255,255,.6)', textTransform:'uppercase' }}>Current tier</div><div style={{ fontSize: 30, fontWeight:800, color:'#fff', marginTop:4 }}>Gold VIP</div></div>
        <Icon name="crown" size={40} color={P.accent}/>
      </div>
      <div style={{ position:'relative', fontSize: 12.5, color:'rgba(255,255,255,.65)', marginTop:10 }}>660 pts from Platinum · member {ME.years}</div>
    </div>
    {tiers.map((t,i)=>{ const cur=t[0]==='Gold'; return (
      <Card2 key={i} style={{ borderColor:cur?P.accentBorder:P.hairline2, background:cur?P.accentSoft:P.surface }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}><div style={{ display:'flex', alignItems:'center', gap:8 }}><Icon name="crown" size={17} color={cur?P.accentInk:P.inkMute}/><span style={{ fontSize:15, fontWeight:800, color:P.ink }}>{t[0]}</span>{cur&&<span style={{ fontSize:10, fontWeight:800, color:P.accentInk, background:P.accent, padding:'2px 7px', borderRadius:99 }}>YOU</span>}</div><span className="mono" style={{ fontSize:11.5, color:P.inkMute }}>{t[1]}</span></div>
        <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:6 }}>{t[2].map((p,j)=>(<div key={j} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12.5, color:P.ink }}><Icon name="check" size={14} stroke={2.5} color={cur?P.accentInk:P.good}/>{p}</div>))}</div>
      </Card2>); })}
  </div>
</div>); }

// ══ SCREEN: REFERRALS ═════════════════════════════════════════════════════
function ReferralsScreen({ back }){ const P=useP(); return (<div>
  <ScreenHead title="Refer friends" onBack={back}/>
  <div style={{ padding:'14px 16px 24px', display:'flex', flexDirection:'column', gap:16 }}>
    <div style={{ borderRadius:18, padding:22, textAlign:'center', background:P.mode==='dark'?'linear-gradient(150deg,#1c1a12,#111)':'linear-gradient(150deg,#151310,#26261f)', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:-50, left:'50%', transform:'translateX(-50%)', width:180, height:180, borderRadius:'50%', background:`radial-gradient(circle,${P.accent}30,transparent 70%)` }}/>
      <div style={{ position:'relative' }}>
        <Icon name="gift" size={30} color={P.accent}/>
        <div style={{ fontSize: 21, fontWeight:800, color:'#fff', marginTop:8 }}>Give $25, get $25</div>
        <div style={{ fontSize:12.5, color:'rgba(255,255,255,.65)', marginTop:6 }}>Friends get $25 off their first order. You get $25 credit when they buy.</div>
        <div style={{ marginTop:16, display:'flex', gap:8, alignItems:'center', background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.14)', borderRadius:12, padding:'11px 14px' }}>
          <span className="mono" style={{ flex:1, fontSize:15, fontWeight:700, color:'#fff', letterSpacing:'.08em' }}>REGGIE25</span>
          <button style={{ padding:'7px 14px', background:P.accent, color:P.accentInk, border:'none', borderRadius:9, fontSize:12.5, fontWeight:700, cursor:'pointer' }}>Copy</button>
        </div>
      </div>
    </div>
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
      <Card2 pad={14} style={{ textAlign:'center' }}><div className="mono" style={{ fontSize: 21, fontWeight:700, color:P.ink }}>2</div><div style={{ fontSize: 11.5, color:P.inkMute, marginTop:2 }}>Friends joined</div></Card2>
      <Card2 pad={14} style={{ textAlign:'center' }}><div className="mono" style={{ fontSize: 21, fontWeight:700, color:P.good }}>$50</div><div style={{ fontSize: 11.5, color:P.inkMute, marginTop:2 }}>Earned</div></Card2>
    </div>
    <div><div style={{ fontSize: 12.5, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', color:P.inkMute, marginBottom:4 }}>Your invites</div>
      {REFERRALS.map((r,i)=>(<div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 4px', borderTop:i?`1px solid ${P.hairline}`:'none' }}>
        <Avatar name={r.name} size={36}/>
        <div style={{ flex:1 }}><div style={{ fontSize:13.5, fontWeight:600, color:P.ink }}>{r.name}</div><div style={{ fontSize:11.5, color:P.inkMute }}>{r.when}</div></div>
        {r.status==='Joined'?<span className="mono" style={{ fontSize: 13.5, fontWeight:700, color:P.good }}>+${r.reward}</span>:<span style={{ fontSize:11.5, fontWeight:600, color:P.inkMute }}>{r.status}</span>}
      </div>))}
    </div>
  </div>
</div>); }

// ══ SCREEN: PROFILE ═══════════════════════════════════════════════════════
function ProfileScreen({ back }){ const P=useP(); return (<div>
  <ScreenHead title="Profile" onBack={back}/>
  <div style={{ padding:'14px 16px 24px', display:'flex', flexDirection:'column', gap:16 }}>
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'10px 0' }}>
      <Avatar name={ME.name} size={72} crown/>
      <button style={{ marginTop:10, fontSize:12.5, fontWeight:600, color:P.ink, background:P.surface3, border:'none', padding:'7px 14px', borderRadius:99, cursor:'pointer' }}>Edit photo</button>
    </div>
    <div><div style={{ fontSize: 12.5, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', color:P.inkMute, marginBottom:8 }}>Personal info</div>
      <Card2 pad={0}>
        {[['Full name',ME.name],['Phone',ME.phone],['Email',ME.email],['Date of birth',ME.dob]].map((f,i)=>(
          <div key={i} style={{ display:'flex', alignItems:'center', padding:'13px 15px', borderTop:i?`1px solid ${P.hairline}`:'none' }}>
            <span style={{ flex:'0 0 110px', fontSize:12.5, color:P.inkMute }}>{f[0]}</span>
            <span style={{ flex:1, fontSize:13.5, fontWeight:600, color:P.ink }}>{f[1]}</span>
            <Icon name="pencil" size={15} color={P.inkFaint}/>
          </div>
        ))}
      </Card2>
    </div>
    <div><div style={{ fontSize: 12.5, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', color:P.inkMute, marginBottom:8 }}>ID verification</div>
      <Card2>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ width:44, height:44, borderRadius:12, background:P.goodSoft, color:P.good, display:'flex', alignItems:'center', justifyContent:'center' }}><Icon name="shield" size={22}/></span>
          <div style={{ flex:1 }}><div style={{ fontSize: 13.5, fontWeight:700, color:P.ink }}>Verified</div><div style={{ fontSize:11.5, color:P.inkMute }}>CA driver's license · expires {ME.idExpires}</div></div>
          <Icon name="check-circle" size={22} color={P.good}/>
        </div>
        <div style={{ marginTop:12, padding:'10px 12px', background:P.surface2, borderRadius:11, fontSize:11.5, color:P.inkMute, display:'flex', gap:8 }}><Icon name="info" size={15} color={P.inkMute}/>Required for every order. Your genius re-scans on arrival for @ Home visits.</div>
      </Card2>
    </div>
  </div>
</div>); }

// ══ SCREEN: ADDRESSES ═════════════════════════════════════════════════════
function AddressesScreen({ back }){ const P=useP(); return (<div>
  <ScreenHead title="Saved addresses" onBack={back} right={<button style={{ width:34, height:34, borderRadius:10, border:'none', background:P.ink, color:P.surface, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}><Icon name="plus" size={18}/></button>}/>
  <div style={{ padding:'14px 16px 24px', display:'flex', flexDirection:'column', gap:12 }}>
    {ADDRESSES.map((a,i)=>(<Card2 key={i}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
        <span style={{ width:40, height:40, borderRadius:11, background:P.surface3, color:P.ink, display:'flex', alignItems:'center', justifyContent:'center', flex:'0 0 auto' }}><Icon name="pin" size={19}/></span>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}><span style={{ fontSize: 16, fontWeight:700, color:P.ink }}>{a.label}</span>{a.def&&<span style={{ fontSize:10, fontWeight:800, color:P.accentInk, background:P.accent, padding:'2px 7px', borderRadius:99 }}>DEFAULT</span>}</div>
          <div style={{ fontSize:12.5, color:P.inkDim, marginTop:3 }}>{a.line}<br/>{a.city}</div>
          {a.note&&<div style={{ fontSize:11.5, color:P.inkMute, marginTop:5, fontStyle:'italic' }}>“{a.note}”</div>}
          <div style={{ marginTop:8 }}>{a.zone?<span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize: 11.5, fontWeight:700, color:P.good }}><Icon name="route" size={13}/>@ Home available</span>:<span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize: 11.5, fontWeight:700, color:P.inkMute }}><Icon name="x" size={13}/>Outside @ Home zone</span>}</div>
        </div>
        <Icon name="pencil" size={16} color={P.inkFaint}/>
      </div>
    </Card2>))}
  </div>
</div>); }

// ══ SCREEN: FAVORITES ═════════════════════════════════════════════════════
function FavesScreen({ back }){ const P=useP(); return (<div>
  <ScreenHead title="Favorites" onBack={back}/>
  <div style={{ padding:'14px 16px 24px', display:'flex', flexDirection:'column', gap:10 }}>
    <Btn kind="dark" icon="cart" full>Add all 4 to cart · {money(FAVES.reduce((s,f)=>s+f.price,0))}</Btn>
    {FAVES.map((f,i)=>(<Card2 key={i} pad={12}>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <Thumb hue={f.hue}/>
        <div style={{ flex:1, minWidth:0 }}><div style={{ fontSize:13.5, fontWeight:600, color:P.ink }}>{f.name}</div><div style={{ marginTop:3, display:'flex', alignItems:'center', gap:8 }}><StrainTag type={f.strain} thc={f.thc}/><span style={{ fontSize: 11.5, color:P.inkMute }}>{f.cat}</span></div></div>
        <div style={{ textAlign:'right' }}><div className="mono" style={{ fontSize:13.5, fontWeight:700, color:P.ink }}>{money(f.price)}</div><button style={{ marginTop:6, width:32, height:32, borderRadius:9, border:'none', background:P.accent, color:P.accentInk, cursor:'pointer' }}><Icon name="plus" size={17} stroke={2.4}/></button></div>
      </div>
    </Card2>))}
  </div>
</div>); }

// ══ SCREEN: SETTINGS (notifications & privacy) ════════════════════════════
function SettingsScreen({ back }){ const P=useP();
  const [s,setS]=useState({ deals:true, order:true, athome:true, sms:false, email:true, loc:true, share:false });
  const Toggle=({on,onClick})=>(<button onClick={onClick} style={{ width:44, height:26, borderRadius:99, background:on?P.accent:P.hairline3, border:'none', cursor:'pointer', padding:3, display:'flex' }}><span style={{ width:20, height:20, borderRadius:99, background:on?P.accentInk:P.surface, transform:on?'translateX(18px)':'none', transition:'transform .16s' }}/></button>);
  const Item=({k,label,sub})=>(<div style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 4px' }}><div style={{ flex:1 }}><div style={{ fontSize: 13.5, fontWeight:600, color:P.ink }}>{label}</div>{sub&&<div style={{ fontSize:11.5, color:P.inkMute, marginTop:1 }}>{sub}</div>}</div><Toggle on={s[k]} onClick={()=>setS(v=>({...v,[k]:!v[k]}))}/></div>);
  return (<div>
  <ScreenHead title="Notifications & privacy" onBack={back}/>
  <div style={{ padding:'8px 16px 24px' }}>
    <div style={{ fontSize: 11.5, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:P.inkMute, padding:'12px 4px 2px' }}>Notifications</div>
    <Item k="order" label="Order updates" sub="Status, delivery, @ Home progress"/>
    <div style={{ borderTop:`1px solid ${P.hairline}` }}/><Item k="athome" label="@ Home alerts" sub="When your genius is on the way"/>
    <div style={{ borderTop:`1px solid ${P.hairline}` }}/><Item k="deals" label="Deals & drops" sub="Weekly promos and new products"/>
    <div style={{ fontSize: 11.5, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:P.inkMute, padding:'18px 4px 2px' }}>Channels</div>
    <Item k="sms" label="Text messages"/>
    <div style={{ borderTop:`1px solid ${P.hairline}` }}/><Item k="email" label="Email"/>
    <div style={{ fontSize: 11.5, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:P.inkMute, padding:'18px 4px 2px' }}>Privacy</div>
    <Item k="loc" label="Location while ordering" sub="For accurate @ Home ETAs"/>
    <div style={{ borderTop:`1px solid ${P.hairline}` }}/><Item k="share" label="Share purchase data" sub="Personalized recommendations"/>
    <div style={{ marginTop:16, display:'flex', flexDirection:'column', gap:2 }}>
      <Row icon="download" label="Download my data" onClick={()=>{}}/>
      <Row icon="trash" label="Delete account" danger onClick={()=>{}}/>
    </div>
  </div>
</div>); }

// ══ SCREEN: SUPPORT ═══════════════════════════════════════════════════════
function SupportScreen({ back }){ const P=useP();
  const msgs=[{who:'sys',m:'Hyperwolf Support · replies in ~2 min'},{who:'them',m:'Hey Reggie! 👋 How can we help with your @ Home visit?'},{who:'me',m:'Can Marcus grab an extra Sleep gummy pack?'},{who:'them',m:"Passed it along — he's got two on the cart now. Anything else?"}];
  const [t,setT]=useState('');
  return (<div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
  <ScreenHead title="Support" onBack={back}/>
  <div style={{ flex:1, overflow:'auto', padding:'16px', display:'flex', flexDirection:'column', gap:12 }}>
    {msgs.map((c,i)=>{ if(c.who==='sys') return <div key={i} style={{ textAlign:'center' }}><span className="mono" style={{ fontSize: 11.5, color:P.inkMute, background:P.surface3, padding:'4px 10px', borderRadius:99 }}>{c.m}</span></div>;
      const me=c.who==='me'; return (<div key={i} style={{ display:'flex', justifyContent:me?'flex-end':'flex-start' }}><div style={{ maxWidth:'80%', padding:'11px 14px', borderRadius:16, background:me?P.ink:P.surface, color:me?P.surface:P.ink, border:me?'none':`1px solid ${P.hairline2}`, fontSize:13.5, lineHeight:1.5 }}>{c.m}</div></div>); })}
  </div>
  <div style={{ padding:'12px 16px', borderTop:`1px solid ${P.hairline2}`, background:P.surface, display:'flex', gap:9, alignItems:'center' }}>
    <input value={t} onChange={e=>setT(e.target.value)} placeholder="Message…" style={{ flex:1, padding:'12px 15px', borderRadius:99, border:`1px solid ${P.fieldBorder}`, background:P.field, color:P.ink, fontSize:13.5, outline:'none' }}/>
    <button style={{ width:44, height:44, borderRadius:99, border:'none', background:P.accent, color:P.accentInk, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><Icon name="arrow-up" size={20} stroke={2.4}/></button>
  </div>
</div>); }

// ══ TAB BAR ═══════════════════════════════════════════════════════════════
function TabBar({ tab, setTab, go }){ const P=useP();
  const tabs=[['shop','Shop','shop'],['orders','Orders','receipt'],['athome','@ Home','route'],['account','Account','user']];
  return (<div style={{ height:56, flex:'0 0 56px', display:'flex', borderTop:`1px solid ${P.hairline2}`, background:P.surface }}>
    {tabs.map(t=>{ const a=tab===t[0]; return (
      <button key={t[0]} onClick={()=>{ setTab(t[0]); if(t[0]==='orders')go('orders'); else if(t[0]==='athome')go('athome'); else if(t[0]==='account')go('hub'); }} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, background:'none', border:'none', cursor:'pointer', color:a?P.ink:P.inkMute }}>
        <Icon name={t[2]} size={22} stroke={a?2.1:1.8}/><span style={{ fontSize:10, fontWeight:a?700:500 }}>{t[1]}</span>
      </button>); })}
  </div>); }

// ══ PHONE + ROUTER ════════════════════════════════════════════════════════
function App(){
  const P=useP();
  const [stack,setStack]=useState([{ s:'hub' }]);
  const [tab,setTab]=useState('account');
  const cur=stack[stack.length-1];
  const go=(s,arg)=> setStack(st=>[...st,{ s, arg }]);
  const back=()=> setStack(st=>st.length>1?st.slice(0,-1):st);
  const reset=(s)=> setStack([{ s }]);
  const scrollRef=useRef(null);
  useEffect(()=>{ if(scrollRef.current) scrollRef.current.scrollTop=0; },[stack.length]);

  const goTab=(s,arg)=>{ if(s==='hub') reset('hub'); else reset(s); };
  let screen;
  switch(cur.s){
    case 'hub': screen=<HubScreen go={go}/>; break;
    case 'orders': screen=<OrdersScreen go={go} back={back}/>; break;
    case 'order': screen=<OrderScreen id={cur.arg} back={back} go={go}/>; break;
    case 'athome': screen=<AtHomeScreen back={back} go={go}/>; break;
    case 'book': screen=<BookScreen back={back}/>; break;
    case 'points': screen=<PointsScreen back={back}/>; break;
    case 'wallet': screen=<WalletScreen back={back}/>; break;
    case 'membership': screen=<MembershipScreen back={back}/>; break;
    case 'referrals': screen=<ReferralsScreen back={back}/>; break;
    case 'profile': screen=<ProfileScreen back={back}/>; break;
    case 'addresses': screen=<AddressesScreen back={back}/>; break;
    case 'faves': screen=<FavesScreen back={back}/>; break;
    case 'settings': screen=<SettingsScreen back={back}/>; break;
    case 'support': screen=<SupportScreen back={back}/>; break;
    default: screen=<HubScreen go={go}/>;
  }
  const noTab = true;

  return (<div style={{ width:'100%', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:P.bg, fontFamily:P.fontSans, padding:'28px 0' }}>
    {/* phone */}
    <div style={{ width:390, height:'min(844px, calc(100vh - 56px))', maxHeight:844, borderRadius:46, background:'#000', padding:10, boxShadow:'0 40px 90px rgba(0,0,0,.4), 0 0 0 1px rgba(0,0,0,.2)', flex:'0 0 auto' }}>
      <div style={{ position:'relative', width:'100%', height:'100%', borderRadius:37, overflow:'hidden', background:P.bg, display:'flex', flexDirection:'column' }}>
        {/* status bar */}
        <div style={{ height:44, flex:'0 0 44px', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 26px', background:P.surface, zIndex:20 }}>
          <span className="mono" style={{ fontSize: 13.5, fontWeight:700, color:P.ink }}>9:41</span>
          <div style={{ position:'absolute', left:'50%', top:9, transform:'translateX(-50%)', width:96, height:26, borderRadius:20, background:'#000' }}/>
          <span style={{ display:'flex', gap:5, alignItems:'center', color:P.ink }}><Icon name="target" size={13}/><Icon name="chart" size={13}/><span style={{ width:22, height:11, border:`1.4px solid ${P.ink}`, borderRadius:3, position:'relative' }}><span style={{ position:'absolute', inset:1.5, right:5, background:P.ink, borderRadius:1 }}/></span></span>
        </div>
        {/* screen */}
        <div ref={scrollRef} style={{ flex:1, overflow:'auto', overflowX:'hidden', background:P.bg, position:'relative' }}>{screen}</div>
        {/* tab bar */}
        {!noTab && <TabBar tab={tab} setTab={setTab} go={goTab}/>}
        {/* home indicator */}
        <div style={{ height:20, flex:'0 0 20px', display:'flex', alignItems:'center', justifyContent:'center', background:noTab?P.surface:P.surface }}><span style={{ width:130, height:5, borderRadius:99, background:P.ink, opacity:.35 }}/></div>
      </div>
    </div>
  </div>);
}

window.CustomerAccountAppC = function CustomerAccountAppC(){ return React.createElement(ThemeProvider, null, React.createElement(App)); };
})();
