// ══ Hyperwolf · Members CRM — staff customer record (desktop) ══
;(function(){
const { useState, useMemo } = React;
const useP = window.useP, useTheme = window.useTheme, ThemeProvider = window.ThemeProvider;
const { Icon, Card, Eyebrow, SectionHead, KPI, Pill, IconBtn, Tabs, Avatar, Field, Switch, StrainPill } = window;

const money = (n)=> '$'+Number(n||0).toLocaleString(undefined,{maximumFractionDigits:0});
const money2 = (n)=> '$'+Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});

// tag color map (colorful member tags)
const TAGTINT = { 'VIP':'accent', '@ Home regular':'info', 'High AOV':'good', 'Rosin fan':'indica', 'New':'info', 'At risk':'bad', 'Wholesale':'sativa' };

// ID photo — verified-ID portrait placeholder (drop-in for a real scan crop)
function IDPhoto({ size=64, radius=13, badge, showTag=true }){ const P=useP();
  const dark=P.mode==='dark'; const sil=dark?'rgba(255,255,255,.24)':'rgba(0,0,0,.22)';
  return (<div style={{ position:'relative', width:size, height:size, flex:'0 0 auto' }}>
    <div style={{ width:size, height:size, borderRadius:radius, overflow:'hidden', border:`1px solid ${P.hairline2}`, background:`linear-gradient(160deg, ${dark?'#2a281f':'#e2dfd5'}, ${dark?'#17160f':'#cbc8bc'})`, position:'relative', display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div style={{ position:'absolute', inset:0, backgroundImage:`repeating-linear-gradient(135deg, ${dark?'rgba(255,255,255,.03)':'rgba(0,0,0,.03)'} 0 6px, transparent 6px 12px)` }}/>
      <svg width={size} height={size} viewBox="0 0 64 64" style={{ position:'relative' }}><circle cx="32" cy="25" r="12" fill={sil}/><path d="M11 63c0-13 9.5-20 21-20s21 7 21 20z" fill={sil}/></svg>
      {showTag && size>=44 && <span className="mono" style={{ position:'absolute', top:4, left:4, fontSize:7.5, fontWeight:700, letterSpacing:'.06em', color:P.accentInk, background:P.accent, padding:'1px 4px', borderRadius:4 }}>ID</span>}
    </div>
    {badge && <span style={{ position:'absolute', top:-5, right:-5, width:size>=48?18:15, height:size>=48?18:15, background:P.accent, borderRadius:99, display:'flex', alignItems:'center', justifyContent:'center', border:`1.5px solid ${P.surface}` }}><Icon name="crown" size={size>=48?10:8} color={P.accentInk}/></span>}
  </div>); }

// ── directory of members ────────────────────────────────────────────────
const MEMBERS = [
  { id:'C-1042', name:'Reggie Watts', tier:'Gold', region:'Rancho Cucamonga', ltv:8240, orders:34, last:'Today', status:'active' },
  { id:'C-1043', name:'Jordan Blake', tier:'Gold', region:'Rancho Cucamonga', ltv:11200, orders:41, last:'Today', status:'active' },
  { id:'C-1044', name:'Dana Cho', tier:'Silver', region:'Riverside', ltv:640, orders:6, last:'Today', status:'active' },
  { id:'C-1045', name:'Leo Park', tier:'Gold', region:'Corona', ltv:4100, orders:22, last:'Jul 6', status:'active' },
  { id:'C-1046', name:'Mia Flores', tier:'Silver', region:'Temecula', ltv:1350, orders:11, last:'Jul 5', status:'active' },
  { id:'C-1047', name:'Wesley Kim', tier:'Silver', region:'Riverside', ltv:1120, orders:9, last:'Today', status:'active' },
  { id:'C-1048', name:'Tara Nguyen', tier:'Bronze', region:'Corona', ltv:210, orders:2, last:'Today', status:'new' },
  { id:'C-1049', name:'Sam Ortiz', tier:'—', region:'Murrieta', ltv:0, orders:0, last:'—', status:'flagged' },
];

// ── the focused record (Reggie, matches mobile + admin) ─────────────────
const REC = {
  id:'C-1042', name:'Reggie Watts', tier:'Gold', since:'Jun 12, 2024', years:'2 yr',
  phone:'(909) 555-0287', email:'reggie.w@gmail.com', dob:'Mar 14, 1990 · 36y',
  addr:'1200 Vineyard Ave, Rancho Cucamonga, CA 91739', region:'Rancho Cucamonga',
  idVerified:true, idType:"CA driver's license", idExpires:'Aug 2028',
  ltv:8240, orders:34, aov:242, points:2840, wallet:42.50, nextTier:'Platinum', toNext:660,
  freq:'2.1 / mo', pref:'Concentrates · Indica evenings', payment:'Visa •• 4021',
  tags:['VIP','@ Home regular','High AOV','Rosin fan'], marketing:true, sms:false, email_opt:true,
  risk:'Low', refunds:1, disputes:0, referrals:2,
};

const ORDERS = [
  { id:'A-2041', kind:'@ Home', date:'Today · 2:00p', total:null, items:5, status:'in_session', genius:'Marcus Vale' },
  { id:'H-8841', kind:'Delivery', date:'Jul 2', total:212, items:4, status:'delivered', rating:5 },
  { id:'H-8720', kind:'Pickup', date:'Jun 24', total:96, items:2, status:'delivered', rating:5 },
  { id:'A-2010', kind:'@ Home', date:'Jun 12', total:388, items:6, status:'completed', rating:5, genius:'Marcus Vale' },
  { id:'H-8402', kind:'Delivery', date:'May 30', total:148, items:3, status:'delivered', rating:4 },
  { id:'H-8199', kind:'Delivery', date:'May 14', total:176, items:3, status:'delivered', rating:5 },
];
const VISITS = ORDERS.filter(o=>o.kind==='@ Home');

const ACTIVITY = [
  { icon:'route', t:'@ Home visit started', d:'Today 2:17p · Marcus Vale · A-2041', kind:'good' },
  { icon:'wallet', t:'Deposit authorized', d:'Today 1:42p · $100 · Visa •• 4021' },
  { icon:'note', t:'Staff note added', d:'Jul 5 · Manisha · "Prefers Marcus for house calls"', kind:'info' },
  { icon:'gift', t:'Referral reward paid', d:'Jul 5 · +$25 credit · Dana Cho joined', kind:'good' },
  { icon:'star', t:'Left 5★ review', d:'Jun 12 · A-2010 · "felt like a private shop at my door"' },
  { icon:'crown', t:'Upgraded to Gold', d:'Mar 2025 · crossed 2,500 pts' },
  { icon:'refresh', t:'Refund issued', d:'Jun 20 · $32.50 · out-of-stock item' },
];

const NOTES = [
  { by:'Manisha S.', role:'Ops', when:'Jul 5', text:'Prefers Marcus for @ Home. Always tips well, very easy visits. Flag for Platinum outreach — 660 pts away.' },
  { by:'Dre C.', role:'Genius', when:'Jun 12', text:'Big into live rosin, curious about solventless. Recommended the Papaya batch — became a favorite.' },
];

const STATUSMAP = { in_session:{l:'In session',k:'good'}, delivered:{l:'Delivered',k:'neutral'}, completed:{l:'Completed',k:'neutral'} };

// ── shell chrome ───────────────────────────────────────────────────────
// The rail is shared by every Hyperwolf app — see shared/app-rail.jsx.
function Rail(){ return <window.HWRail active="members"/>; }

function TopBar(){ const P=useP(); const { mode, toggle }=useTheme(); return (
  <header style={{ height:60, flex:'0 0 60px', display:'flex', alignItems:'center', gap:14, padding:'0 22px', borderBottom:`1px solid ${P.hairline2}`, background:P.surface }}>
    <button style={{ display:'inline-flex', alignItems:'center', gap:9, padding:'7px 13px', borderRadius:99, background:P.surface3, border:`1px solid ${P.hairline2}`, cursor:'pointer', color:P.ink }}>
      <span style={{ width:7, height:7, borderRadius:99, background:P.good }}/><span style={{ fontSize:12.5, fontWeight:700 }}>ALL STORES</span><Icon name="chevron-down" size={14} color={P.inkDim}/>
    </button>
    <div style={{ flex:1 }}/>
    <div style={{ width:300 }}><Field icon="search" placeholder="Search members…" size="sm"/></div>
    <IconBtn icon="bell" badge={2}/>
    <button onClick={toggle} style={{ width:38, height:38, borderRadius:10, border:'none', background:'transparent', cursor:'pointer', color:P.inkDim, display:'flex', alignItems:'center', justifyContent:'center' }}><Icon name={mode==='dark'?'sun':'moon'} size={18}/></button>
    <div style={{ display:'flex', alignItems:'center', gap:9, paddingLeft:6 }}><Avatar name="Manisha Saini" size={34} hue={172}/><div style={{ lineHeight:1.15 }}><div style={{ fontSize:12.5, fontWeight:700, color:P.ink }}>Manisha Saini</div><div style={{ fontSize: 11.5, color:P.inkMute }}>Ops · Admin</div></div></div>
  </header>); }

// ── members list column ──────────────────────────────────────────────────
function MembersList({ sel, onSel }){ const P=useP(); const [q,setQ]=useState('');
  const rows=MEMBERS.filter(m=>!q||(m.name+m.id+m.region).toLowerCase().includes(q.toLowerCase()));
  const TSTAT={active:{l:'Active',k:'good'},new:{l:'New',k:'info'},flagged:{l:'Flagged',k:'bad'}};
  return (<div style={{ width:320, flex:'0 0 320px', borderRight:`1px solid ${P.hairline2}`, background:P.surface, display:'flex', flexDirection:'column', minHeight:0 }}>
    <div style={{ padding:'16px 16px 12px', borderBottom:`1px solid ${P.hairline}` }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}><span style={{ fontSize:16, fontWeight:800, color:P.ink }}>Members</span><span className="mono" style={{ fontSize: 11.5, color:P.inkMute }}>4,218 total</span></div>
      <Field icon="search" placeholder="Search members…" value={q} onChange={e=>setQ(e.target.value)} size="sm"/>
    </div>
    <div style={{ flex:1, overflow:'auto' }}>
      {rows.map(m=>{ const a=sel===m.id; const ts=TSTAT[m.status]; return (
        <button key={m.id} onClick={()=>onSel(m.id)} style={{ width:'100%', display:'flex', alignItems:'center', gap:11, padding:'12px 16px', border:'none', borderLeft:`3px solid ${a?P.accent:'transparent'}`, background:a?P.accentSoft:'transparent', cursor:'pointer', textAlign:'left', borderBottom:`1px solid ${P.hairline}` }}>
          <IDPhoto size={38} radius={10} showTag={false} badge={m.tier==='Gold'}/>
          <div style={{ flex:1, minWidth:0 }}><div style={{ fontSize:13.5, fontWeight:700, color:P.ink }}>{m.name}</div><div className="mono" style={{ fontSize: 11.5, color:P.inkMute }}>{m.tier!=='—'?m.tier:'Guest'} · {m.orders} ord · {money(m.ltv)}</div></div>
          <Pill kind={ts.k} soft>{ts.l}</Pill>
        </button>); })}
    </div>
  </div>); }

// ── record header ──────────────────────────────────────────────────────
function RecordHeader(){ const P=useP(); return (
  <div style={{ padding:'22px 30px 0' }}>
    <div style={{ display:'flex', alignItems:'flex-start', gap:18, flexWrap:'wrap' }}>
      <IDPhoto size={64} radius={15} badge/>
      <div style={{ flex:'1 1 300px', minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:11 }}>
          <span style={{ fontSize: 30, fontWeight:800, letterSpacing:'-.02em', color:P.ink }}>{REC.name}</span>
          <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 11px', borderRadius:99, background:P.accent, color:P.accentInk, fontSize: 12.5, fontWeight:800 }}><Icon name="crown" size={13} color={P.accentInk}/>Gold VIP</span>
          {REC.idVerified&&<Pill kind="good" soft icon="shield">ID verified</Pill>}
        </div>
        <div className="mono" style={{ fontSize: 12.5, color:P.inkMute, marginTop:6 }}>{REC.id} · member {REC.years} · since {REC.since} · {REC.region}</div>
        <div style={{ display:'flex', gap:7, flexWrap:'wrap', marginTop:11 }}>
          {REC.tags.map(t=>{ const c=P[TAGTINT[t]||'neutral']; return (<span key={t} style={{ fontSize: 11.5, fontWeight:700, color:c, background:c+(P.mode==='dark'?'26':'1F'), border:`1px solid ${c}${P.mode==='dark'?'44':'55'}`, padding:'4px 10px', borderRadius:99 }}>{t}</span>); })}
          <button style={{ fontSize: 11.5, fontWeight:600, color:P.inkMute, background:'transparent', border:`1px dashed ${P.hairline3}`, padding:'4px 10px', borderRadius:99, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:4 }}><Icon name="plus" size={12}/>Tag</button>
        </div>
      </div>
      <div style={{ display:'flex', gap:8, flex:'0 0 auto', flexWrap:'wrap' }}>
        <BtnG icon="phone">Call</BtnG><BtnG icon="note">Message</BtnG><BtnG icon="plus" primary>Add note</BtnG>
      </div>
    </div>
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(158px,1fr))', gap:12, marginTop:20 }}>
      <KPI label="Lifetime value" value={money(REC.ltv)} icon="dollar" delta={12} deltaKind="good"/>
      <KPI label="Orders" value={REC.orders} hint={REC.freq} icon="receipt"/>
      <KPI label="Avg order" value={money(REC.aov)} icon="cart"/>
      <KPI label="Points" value={REC.points.toLocaleString()} hint={`${REC.toNext} to ${REC.nextTier}`} icon="target" accent/>
      <KPI label="Store credit" value={money2(REC.wallet)} icon="wallet"/>
    </div>
  </div>); }
function BtnG({ children, icon, primary }){ const P=useP(); const [h,setH]=useState(false); return (
  <button onClick={()=>railGo(item)} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'9px 14px', fontSize: 13.5, fontWeight:600, borderRadius:10, cursor:'pointer', border:`1px solid ${primary?P.accentBorder:P.hairline2}`, background:primary?P.accent:(h?P.surface3:'transparent'), color:primary?P.accentInk:P.ink }}><Icon name={icon} size={15} stroke={2}/>{children}</button>); }

// ── tab bodies ─────────────────────────────────────────────────────────
function InfoRow({ label, value, edit=true }){ const P=useP(); return (
  <div style={{ display:'flex', alignItems:'center', padding:'12px 0', borderTop:`1px solid ${P.hairline}` }}>
    <span style={{ flex:'0 0 150px', fontSize:12.5, color:P.inkMute }}>{label}</span>
    <span style={{ flex:1, fontSize:13.5, fontWeight:600, color:P.ink }}>{value}</span>
    {edit&&<Icon name="pencil" size={14} color={P.inkFaint}/>}
  </div>); }

function OverviewTab(){ const P=useP(); return (
  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))', gap:16 }}>
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <Card>
        <SectionHead level={3} eyebrow="Identity" title="Contact & personal"/>
        <div style={{ marginTop:2 }}>
          <div style={{ borderTop:`1px solid ${P.hairline}`, marginTop:-1 }}/>
          <InfoRow label="Phone" value={REC.phone}/>
          <InfoRow label="Email" value={REC.email}/>
          <InfoRow label="Date of birth" value={REC.dob}/>
          <InfoRow label="Default address" value={REC.addr}/>
          <InfoRow label="Payment on file" value={REC.payment}/>
        </div>
      </Card>
      <Card>
        <SectionHead level={3} eyebrow="Compliance" title="ID verification"/>
        <div style={{ display:'flex', alignItems:'center', gap:14, marginTop:6 }}>
          <IDPhoto size={72} radius={12}/>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}><span style={{ fontSize:15, fontWeight:700, color:P.ink }}>Verified</span><Pill kind="good" soft icon="check-circle">Face match</Pill></div>
            <div style={{ fontSize: 12.5, color:P.inkMute, marginTop:3 }}>{REC.idType}</div>
            <div className="mono" style={{ fontSize:11.5, color:P.inkMute, marginTop:2 }}>DL ••• 4821 · exp {REC.idExpires} · DOB {REC.dob}</div>
          </div>
          <BtnG icon="expand">Full scan</BtnG>
        </div>
      </Card>
      <Card>
        <SectionHead level={3} eyebrow="Behavior" title="Preferences & signals"/>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginTop:8 }}>
          {[['Preference',REC.pref],['Order frequency',REC.freq],['Account standing','Good · no chargebacks'],['Refunds / disputes',`${REC.refunds} / ${REC.disputes}`],['Referrals',`${REC.referrals} joined`],['Marketing opt-in',REC.marketing?'Yes · email':'No']].map((r,i)=>(
            <div key={i}><div style={{ fontSize: 11.5, letterSpacing:'.08em', textTransform:'uppercase', color:P.inkMute, fontWeight:600 }}>{r[0]}</div><div style={{ fontSize:13.5, fontWeight:600, color:P.ink, marginTop:3 }}>{r[1]}</div></div>
          ))}
        </div>
      </Card>
    </div>
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <Card>
        <SectionHead level={3} eyebrow="Tier" title="Membership"/>
        <div style={{ padding:16, borderRadius:12, background:P.mode==='dark'?'linear-gradient(150deg,#2a2410,#151310)':'linear-gradient(150deg,#151310,#33301f)', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:-30, right:-20, width:120, height:120, borderRadius:'50%', background:`radial-gradient(circle,${P.accent}44,transparent 70%)` }}/>
          <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'space-between' }}><span style={{ fontSize: 21, fontWeight:800, color:'#fff' }}>Gold VIP</span><Icon name="crown" size={26} color={P.accent}/></div>
          <div style={{ position:'relative', marginTop:12, height:7, borderRadius:99, background:'rgba(255,255,255,.14)', overflow:'hidden' }}><div style={{ width:'81%', height:'100%', background:P.accent }}/></div>
          <div style={{ position:'relative', fontSize:11.5, color:'rgba(255,255,255,.65)', marginTop:8 }}>{REC.toNext} pts to Platinum</div>
        </div>
        <div style={{ marginTop:12, display:'flex', gap:8 }}><BtnG icon="target">Adjust points</BtnG><BtnG icon="crown">Override tier</BtnG></div>
      </Card>
      <Card>
        <SectionHead level={3} eyebrow="Comms" title="Channels" action={null}/>
        <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
          {[['Marketing email',REC.email_opt],['SMS',REC.sms],['Push notifications',true],['@ Home alerts',true]].map((r,i)=>(
            <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 0', borderTop:i?`1px solid ${P.hairline}`:'none' }}><span style={{ fontSize: 13.5, color:P.ink }}>{r[0]}</span><Switch on={r[1]} onChange={()=>{}}/></div>
          ))}
        </div>
      </Card>
    </div>
  </div>); }

function OrdersTab(){ const P=useP(); return (
  <Card padding={0} style={{ overflow:'hidden' }}>
    <div style={{ display:'grid', gridTemplateColumns:'110px 1fr 120px 90px 110px 90px', padding:'11px 18px', background:P.surface2, borderBottom:`1px solid ${P.hairline2}`, fontSize: 11.5, fontWeight:600, letterSpacing:'.08em', textTransform:'uppercase', color:P.inkDim }}>
      <div>Order</div><div>Date · genius</div><div>Type</div><div>Items</div><div>Status</div><div style={{textAlign:'right'}}>Total</div>
    </div>
    {ORDERS.map((o,i)=>{ const st=STATUSMAP[o.status]; return (
      <div key={o.id} style={{ display:'grid', gridTemplateColumns:'110px 1fr 120px 90px 110px 90px', padding:'13px 18px', borderTop:i?`1px solid ${P.hairline}`:'none', alignItems:'center', cursor:'pointer' }} onMouseEnter={e=>e.currentTarget.style.background=P.surface2} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
        <span className="mono" style={{ fontSize:12.5, fontWeight:700, color:P.ink }}>{o.id}</span>
        <div><span style={{ fontSize: 13.5, color:P.ink }}>{o.date}</span>{o.genius&&<span style={{ fontSize:11.5, color:P.inkMute }}> · {o.genius}</span>}</div>
        <div><span style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:12.5, color:P.inkDim }}><Icon name={o.kind==='@ Home'?'route':o.kind==='Pickup'?'shop':'truck'} size={15}/>{o.kind}</span></div>
        <span className="mono" style={{ fontSize:12.5, color:P.inkDim }}>{o.items}</span>
        <div><Pill kind={st.k} soft dot={o.status==='in_session'}>{st.l}</Pill></div>
        <div style={{ textAlign:'right' }}>{o.total?<span className="mono" style={{ fontSize: 13.5, fontWeight:700, color:P.ink }}>{money(o.total)}</span>:<span style={{ fontSize: 12.5, color:P.inkMute }}>live</span>}{o.rating&&<div className="mono" style={{ fontSize: 11.5, color:P.inkMute }}>★ {o.rating}</div>}</div>
      </div>); })}
  </Card>); }

function AtHomeTab(){ const P=useP(); return (
  <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12 }}>
      <KPI label="@ Home visits" value="6" icon="route" accent/>
      <KPI label="Avg visit value" value="$372" icon="dollar"/>
      <KPI label="Favorite genius" value="Marcus" hint="4 of 6" icon="user"/>
      <KPI label="Avg rating given" value="★ 5.0" icon="star"/>
    </div>
    <Card>
      <SectionHead level={3} eyebrow="History" title="House-call visits"/>
      <div style={{ display:'flex', flexDirection:'column' }}>
        {VISITS.map((v,i)=>(
          <div key={v.id} style={{ display:'flex', alignItems:'center', gap:13, padding:'13px 0', borderTop:i?`1px solid ${P.hairline}`:'none' }}>
            <Avatar name={v.genius} size={40}/>
            <div style={{ flex:1 }}><div style={{ fontSize:13.5, fontWeight:600, color:P.ink }}>{v.genius}{v.status==='in_session'&&<span style={{ fontSize: 11.5, fontWeight:700, color:P.good }}> · live now</span>}</div><div className="mono" style={{ fontSize:11.5, color:P.inkMute }}>{v.id} · {v.date} · {v.items} items</div></div>
            {v.total?<span className="mono" style={{ fontSize:13.5, fontWeight:700, color:P.ink }}>{money(v.total)}</span>:<Pill kind="good" soft dot>In session</Pill>}
            {v.rating&&<span className="mono" style={{ fontSize: 12.5, color:P.inkMute, marginLeft:10 }}>★ {v.rating}</span>}
          </div>
        ))}
      </div>
    </Card>
    <Card style={{ background:P.accentSoft, border:`1px solid ${P.accentBorder}` }}>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <span style={{ position:'relative', width:10, height:10 }}><span style={{ position:'absolute', inset:0, borderRadius:99, background:P.good }}/><span style={{ position:'absolute', inset:-4, borderRadius:99, border:`1.5px solid ${P.good}`, animation:'shPing 1.8s ease-out infinite' }}/></span>
        <div style={{ flex:1 }}><div style={{ fontSize: 13.5, fontWeight:800, color:P.ink }}>Live visit in progress — A-2041</div><div style={{ fontSize: 12.5, color:P.mode==='dark'?'rgba(0,0,0,.6)':'rgba(26,20,0,.7)' }}>Marcus Vale · started 2:17p · deposit $100 held</div></div>
        <BtnG icon="external">Open in @ Home</BtnG>
      </div>
    </Card>
  </div>); }

function WalletTab(){ const P=useP(); return (
  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:16 }}>
    <Card>
      <SectionHead level={3} eyebrow="Loyalty" title="Points" action={<BtnG icon="target">Adjust</BtnG>}/>
      <div className="mono" style={{ fontSize:32, fontWeight:700, color:P.ink }}>{REC.points.toLocaleString()} <span style={{ fontSize: 13.5, color:P.inkMute }}>pts</span></div>
      <div style={{ marginTop:14, display:'flex', flexDirection:'column' }}>
        {[['Earned','Jul 2 · H-8841','+212',true],['Bonus','Jun 12 · Gold 2×','+388',true],['Redeemed','Jun 24 · $10 off','−1,000',false]].map((r,i)=>(
          <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 0', borderTop:`1px solid ${P.hairline}` }}><div style={{ flex:1 }}><div style={{ fontSize: 13.5, fontWeight:600, color:P.ink }}>{r[0]}</div><div style={{ fontSize:11.5, color:P.inkMute }}>{r[1]}</div></div><span className="mono" style={{ fontSize: 13.5, fontWeight:700, color:r[3]?P.good:P.ink }}>{r[2]}</span></div>
        ))}
      </div>
    </Card>
    <Card>
      <SectionHead level={3} eyebrow="Credit" title="Store credit" action={<BtnG icon="plus">Comp credit</BtnG>}/>
      <div className="mono" style={{ fontSize:32, fontWeight:700, color:P.ink }}>{money2(REC.wallet)}</div>
      <div style={{ marginTop:14, display:'flex', flexDirection:'column' }}>
        {[['Referral bonus','Jul 5 · Dana joined','+$25.00',true],['Order credit used','Jul 2 · H-8841','−$15.00',false],['Refund','Jun 20 · out-of-stock','+$32.50',true]].map((r,i)=>(
          <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 0', borderTop:`1px solid ${P.hairline}` }}><div style={{ flex:1 }}><div style={{ fontSize: 13.5, fontWeight:600, color:P.ink }}>{r[0]}</div><div style={{ fontSize:11.5, color:P.inkMute }}>{r[1]}</div></div><span className="mono" style={{ fontSize: 13.5, fontWeight:700, color:r[3]?P.good:P.ink }}>{r[2]}</span></div>
        ))}
      </div>
    </Card>
  </div>); }

function ActivityTab(){ const P=useP(); return (
  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))', gap:16, alignItems:'start' }}>
    <Card>
      <SectionHead level={3} eyebrow="Timeline" title="Activity"/>
      <div style={{ display:'flex', flexDirection:'column' }}>
        {ACTIVITY.map((a,i)=>(
          <div key={i} style={{ display:'flex', gap:13, padding:'12px 0', borderTop:i?`1px solid ${P.hairline}`:'none' }}>
            <span style={{ width:34, height:34, borderRadius:10, flex:'0 0 auto', background:a.kind?P[a.kind+'Soft']||P.surface3:P.surface3, color:a.kind?P[a.kind]:P.inkDim, display:'flex', alignItems:'center', justifyContent:'center' }}><Icon name={a.icon} size={16}/></span>
            <div><div style={{ fontSize:13.5, fontWeight:600, color:P.ink }}>{a.t}</div><div style={{ fontSize:11.5, color:P.inkMute, marginTop:1 }}>{a.d}</div></div>
          </div>
        ))}
      </div>
    </Card>
    <Card>
      <SectionHead level={3} eyebrow="Internal" title="Staff notes" action={<BtnG icon="plus" primary>Add</BtnG>}/>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {NOTES.map((n,i)=>(
          <div key={i} style={{ padding:13, borderRadius:12, background:P.surface2, border:`1px solid ${P.hairline}` }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}><Avatar name={n.by} size={22}/><span style={{ fontSize: 12.5, fontWeight:700, color:P.ink }}>{n.by}</span><span style={{ fontSize: 11.5, color:P.inkMute }}>{n.role}</span><span className="mono" style={{ marginLeft:'auto', fontSize: 11.5, color:P.inkMute }}>{n.when}</span></div>
            <div style={{ fontSize:12.5, lineHeight:1.5, color:P.ink2 }}>{n.text}</div>
          </div>
        ))}
      </div>
    </Card>
  </div>); }

// ── record view ──────────────────────────────────────────────────────────
function Record(){ const P=useP(); const [tab,setTab]=useState('overview');
  return (<div style={{ flex:1, overflow:'auto', minWidth:0 }}>
    <RecordHeader/>
    <div style={{ padding:'18px 30px 0', position:'sticky', top:0 }}>
      <Tabs value={tab} onChange={setTab} options={[{value:'overview',label:'Overview'},{value:'orders',label:'Orders'},{value:'athome',label:'@ Home'},{value:'wallet',label:'Wallet & points'},{value:'activity',label:'Activity & notes'}]}/>
    </div>
    <div style={{ padding:'22px 30px 50px' }}>
      {tab==='overview'&&<OverviewTab/>}
      {tab==='orders'&&<OrdersTab/>}
      {tab==='athome'&&<AtHomeTab/>}
      {tab==='wallet'&&<WalletTab/>}
      {tab==='activity'&&<ActivityTab/>}
    </div>
  </div>); }

function Shell(){ const P=useP(); const [sel,setSel]=useState('C-1042');
  return (<div style={{ display:'flex', height:'100vh', background:P.bg, color:P.ink, fontFamily:P.fontSans, overflow:'hidden' }}>
    <Rail/>
    <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden' }}>
      <TopBar/>
      <div style={{ flex:1, display:'flex', minHeight:0 }}>
        <MembersList sel={sel} onSel={setSel}/>
        <Record/>
      </div>
    </div>
  </div>); }

window.CustomerCRMApp = function CustomerCRMApp(){ return React.createElement(ThemeProvider, null, React.createElement(Shell)); };
})();
