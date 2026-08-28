// ── Product Carousel builder — mirrors Hyperwolf's carousel tool ────────────
const useP = window.useP;
const { useState, useMemo } = React;
const CX = window.PROMO;

const CBRANDS = ['Alien Labs','Allswell','Angeleno\u2019s Cult','Arcata Fire','Astronauts','Bear Labs','Big Pete\u2019s Treats','Birdies','Bosky','CAKE','CAM','Claybourne','Coldfire','CLSICS','Heavy Hitters','Hyperwolf','Jeeter','Kanha','Kine','lolo','Papa\u2019s Herb','Raw Garden','STIIIZY','Stilo Supply','THC Design','turn','Wyld','Almora','Harbor','Driftwood'];
const CCATS = ['2 Gram Slam','2x Points!!','5g-28g','Accessories','All-in-One Vapes','Baked Goods','Batteries','Budder / Badder','Budget Friendly Flower','Clearance','Concentrate','Edibles','Flower','Pre-roll','Tincture','Vape','Wellness'];
const CTRAITS = ['High THC','CBD-rich','Solventless','Infused','Live Resin','Small Batch','Award Winner','Fast-acting','Sun-grown'];
const CPAGES = ['Home','Shop','Category page','Brand page','Cultivation Style Detail Pages','Strains Details Pages','Terpenes Detail pages','Cart','Checkout'];
const STRAINS = ['Indica','Sativa','Hybrid'];

// products — flattened from the shared catalog, plus a few extras
function buildProducts(){
  const out=[]; let i=0;
  Object.entries(CX.CATALOG||{}).forEach(([cat,list])=> list.forEach(p=>{ out.push({ id:'pr'+(i++), name:p.n, brand:p.b, cat, strain:STRAINS[i%3], inv:2+((i*7)%22), price:p.now, traits:'—' }); }));
  ['#freebritney Half Ounce Smalls|Indica|lolo|7|70','#freebritney Smalls|Indica|lolo|18|20','#lunchbreak Pre-Roll|Sativa|lolo|7|5','#sheslapz Ready-To-Roll|Indica|lolo|16|25','24K|Indica|THC Design|2|45'].forEach(s=>{ const [name,strain,brand,inv,price]=s.split('|'); out.unshift({ id:'pr'+(i++), name, brand, cat:'Flower', strain, inv:Number(inv), price:Number(price), traits:'—' }); });
  return out;
}

function MultiField({ label, options, value, onChange, placeholder }){
  const P=useP(); const [open,setOpen]=useState(false);
  const toggle=(o)=> onChange(value.includes(o)? value.filter(x=>x!==o): [...value,o]);
  return (<div style={{ marginBottom:16 }}>
    <div style={{ fontSize:12.5, fontWeight:700, color:P.ink, marginBottom:7 }}>{label}</div>
    <div style={{ position:'relative' }}>
      <div onClick={()=>setOpen(o=>!o)} style={{ minHeight:44, borderRadius:P.r10, border:`1px solid ${open?P.accentBorder:P.fieldBorder}`, background:P.field, padding:'7px 10px', display:'flex', flexWrap:'wrap', gap:6, alignItems:'center', cursor:'pointer', boxShadow:open?`0 0 0 3px ${P.accentSoft}`:'none' }}>
        {value.length ? value.slice(0,6).map(v=><span key={v} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 9px', borderRadius:7, background:P.surface3, fontSize: 12.5, fontWeight:600 }}>{v}<span onClick={e=>{e.stopPropagation();toggle(v);}} style={{ cursor:'pointer', color:P.inkMute }}>×</span></span>)
          : <span style={{ color:P.inkMute, fontSize: 13.5 }}>{placeholder||'Select\u2026'}</span>}
        {value.length>6 && <span style={{ fontSize: 12.5, color:P.inkMute, fontFamily:P.fontMono }}>+{value.length-6} more</span>}
        <div style={{ marginLeft:'auto', display:'flex', gap:6, alignItems:'center' }}>
          {value.length>0 && <span onClick={e=>{e.stopPropagation();onChange([]);}} title="Clear" style={{ color:P.inkMute, cursor:'pointer' }}>×</span>}
          <Icon name="chevron-down" size={16} color={P.inkMute} style={{ transform:open?'rotate(180deg)':'none' }}/>
        </div>
      </div>
      {open && <><div onClick={()=>setOpen(false)} style={{ position:'fixed', inset:0, zIndex:40 }}/>
        <div style={{ position:'absolute', top:'calc(100% + 5px)', left:0, right:0, maxHeight:220, overflowY:'auto', background:P.surface, border:`1px solid ${P.hairline2}`, borderRadius:P.r12, boxShadow:P.shadowLg, zIndex:41, padding:5 }}>
          {options.map(o=>{ const on=value.includes(o); return (<button key={o} onClick={()=>toggle(o)} style={{ display:'flex', alignItems:'center', gap:9, width:'100%', padding:'8px 9px', background:on?P.accentSoft:'transparent', border:'none', borderRadius:8, cursor:'pointer', textAlign:'left', fontFamily:P.fontSans }}>
            <span style={{ width:17, height:17, borderRadius:5, border:`1.5px solid ${on?P.ink:P.hairline3}`, background:on?P.ink:'transparent', display:'flex', alignItems:'center', justifyContent:'center', flex:'0 0 auto' }}>{on && <Icon name="check" size={11} stroke={3} color={P.surface}/>}</span>
            <span style={{ fontSize:12.5, fontWeight:600, color:P.ink }}>{o}</span>
          </button>); })}
        </div></>}
    </div>
  </div>);
}

window.CarouselModal = function CarouselModal({ config, onClose, onSave }){
  const P=useP();
  const [d,setD]=useState(()=>({ name:'Hyperwolf-Carousel-1a', brands:[], cats:[], strains:['Indica','Sativa','Hybrid'], traits:[], pages:['Cultivation Style Detail Pages','Strains Details Pages','Terpenes Detail pages'], min:5, max:12, ...(config||{}) }));
  const [q,setQ]=useState('');
  const [picked,setPicked]=useState(()=> new Set(config?.picked||[]));
  const up=(patch)=> setD(prev=>({...prev, ...patch}));
  const PRODUCTS=useMemo(buildProducts,[]);
  const rows=PRODUCTS.filter(p=> (!q || (p.name+p.brand).toLowerCase().includes(q.toLowerCase()))
    && (!d.brands.length || d.brands.includes(p.brand))
    && (!d.cats.length || d.cats.includes(p.cat))
    && (!d.strains.length || d.strains.includes(p.strain))
  );
  const toggleStrain=(s)=> up({ strains: d.strains.includes(s)? d.strains.filter(x=>x!==s): [...d.strains,s] });
  const allStrains = d.strains.length===3;
  const pick=(id)=> setPicked(prev=>{ const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });
  const inRange = picked.size>=d.min && picked.size<=d.max;
  const inp={ width:'100%', padding:'11px 13px', borderRadius:P.r10, border:`1px solid ${P.fieldBorder}`, background:P.field, color:P.ink, fontSize: 13.5, fontFamily:P.fontSans, outline:'none' };
  const Ap=({title,children})=>(<div style={{ marginBottom:16 }}><div style={{ fontSize: 13.5, fontWeight:800, marginBottom:8 }}>{title}</div><div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>{children}</div></div>);
  const apChip=(t)=><span key={t} style={{ padding:'5px 10px', borderRadius:99, background:P.surface3, fontSize: 12.5, fontWeight:600 }}>{t}</span>;
  const clear=()=> up({ brands:[], cats:[], strains:[], traits:[], pages:[] });

  return (<div style={window.overlayScrim(P, { z: 200, padding: '28px 20px' })}>
    <div style={{ ...window.overlayCard, width:'100%', maxWidth:1120, display:'flex', flexDirection:'column', gap:16 }}>
      {/* header */}
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ flex:1 }}><div style={{ fontSize: 11.5, fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', color:'rgba(255,255,255,.7)', fontFamily:P.fontMono }}>Product carousel</div><div style={{ fontSize: 21, fontWeight:800, color:'#fff', letterSpacing:'-.02em' }}>Build a carousel</div></div>
        <IconBtn icon="x" tone="solid" onClick={onClose} style={{ background:'rgba(255,255,255,.14)', color:'#fff' }}/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) 300px', gap:16, alignItems:'start' }}>
        {/* form */}
        <Card padding={20}>
          <div style={{ fontSize:12.5, fontWeight:700, marginBottom:7 }}>Carousel Name</div>
          <input value={d.name} onChange={e=>up({name:e.target.value})} style={{ ...inp, marginBottom:16 }}/>
          <MultiField label="Select Brands" options={CBRANDS} value={d.brands} onChange={v=>up({brands:v})} placeholder="All brands"/>
          <MultiField label="Select Categories" options={CCATS} value={d.cats} onChange={v=>up({cats:v})} placeholder="All categories"/>

          <div style={{ marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
              <span style={{ fontSize:12.5, fontWeight:700 }}>Select Strain Type</span>
              <button onClick={()=>up({strains: allStrains?[]:STRAINS.slice()})} style={{ display:'inline-flex', alignItems:'center', gap:6, background:'transparent', border:'none', cursor:'pointer', color:P.accentText, fontSize:12.5, fontWeight:700, fontFamily:P.fontSans }}>
                <span style={{ width:16, height:16, borderRadius:5, border:`1.5px solid ${allStrains?P.ink:P.hairline3}`, background:allStrains?P.ink:'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>{allStrains && <Icon name="check" size={10} stroke={3} color={P.surface}/>}</span>Select All
              </button>
            </div>
            <div style={{ display:'flex', gap:10 }}>{STRAINS.map(s=>{ const on=d.strains.includes(s); return (
              <button key={s} onClick={()=>toggleStrain(s)} style={{ flex:1, display:'flex', alignItems:'center', gap:9, padding:'12px 14px', borderRadius:P.r10, border:`1px solid ${on?P.accentBorder:P.hairline2}`, background:on?P.accentSoft:P.surface2, cursor:'pointer', fontFamily:P.fontSans }}>
                <span style={{ width:18, height:18, borderRadius:5, border:`1.5px solid ${on?P.ink:P.hairline3}`, background:on?P.ink:'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>{on && <Icon name="check" size={11} stroke={3} color={P.surface}/>}</span>
                <span style={{ fontSize:13.5, fontWeight:700, color:P.ink }}>{s}</span>
              </button>); })}</div>
          </div>

          <MultiField label="Select Product Traits" options={CTRAITS} value={d.traits} onChange={v=>up({traits:v})} placeholder="Search & Select Product Traits"/>
          <MultiField label="Select Page" options={CPAGES} value={d.pages} onChange={v=>up({pages:v})} placeholder="Select pages"/>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:18 }}>
            <div><div style={{ fontSize:12.5, fontWeight:700, marginBottom:7 }}>Minimum Product Qty</div><input type="number" value={d.min} onChange={e=>up({min:Number(e.target.value)||0})} style={inp}/></div>
            <div><div style={{ fontSize:12.5, fontWeight:700, marginBottom:7 }}>Maximum Product Qty</div><input type="number" value={d.max} onChange={e=>up({max:Number(e.target.value)||0})} style={inp}/></div>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <PBtn variant="accent" size="lg" onClick={()=>onSave&&onSave({...d, picked:[...picked]})}>Update</PBtn>
            <PBtn variant="secondary" size="lg" onClick={onClose}>Cancel</PBtn>
            <div style={{ flex:1 }}/>
            <button onClick={clear} style={{ background:'transparent', border:'none', color:P.inkMute, fontSize: 13.5, fontWeight:600, textDecoration:'underline', cursor:'pointer', fontFamily:P.fontSans }}>Clear Filters</button>
          </div>
        </Card>

        {/* applied filters */}
        <Card padding={18}>
          <div style={{ fontSize:15, fontWeight:800, marginBottom:14 }}>Applied Filters</div>
          <Ap title="Carousel Name">{apChip(d.name)}</Ap>
          <Ap title={`Brands (${d.brands.length})`}>{d.brands.length? d.brands.map(apChip) : <span style={{ color:P.inkMute, fontSize: 12.5 }}>All brands</span>}</Ap>
          <Ap title={`Categories (${d.cats.length})`}>{d.cats.length? d.cats.map(apChip) : <span style={{ color:P.inkMute, fontSize: 12.5 }}>All categories</span>}</Ap>
          <Ap title={`Strain Types (${d.strains.length})`}>{d.strains.length? d.strains.map(apChip) : <span style={{ color:P.inkMute, fontSize: 12.5 }}>—</span>}</Ap>
          <Ap title={`Product Traits (${d.traits.length})`}>{d.traits.length? d.traits.map(apChip) : <span style={{ color:P.inkMute, fontSize: 12.5 }}>—</span>}</Ap>
          <Ap title="Page Name">{d.pages.length? d.pages.map(apChip) : <span style={{ color:P.inkMute, fontSize: 12.5 }}>—</span>}</Ap>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div><div style={{ fontSize:12.5, fontWeight:800, marginBottom:4 }}>Minimum Product Qty</div><div style={{ fontFamily:P.fontMono, fontSize: 13.5 }}>{d.min}</div></div>
            <div><div style={{ fontSize:12.5, fontWeight:800, marginBottom:4 }}>Maximum Product Qty</div><div style={{ fontFamily:P.fontMono, fontSize: 13.5 }}>{d.max}</div></div>
          </div>
        </Card>
      </div>

      {/* product picker */}
      <Card padding={0}>
        <div style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 18px', borderBottom:`1px solid ${P.hairline2}` }}>
          <div style={{ flex:'1 1 300px', maxWidth:420 }}><Field icon="search" placeholder="Search" value={q} onChange={e=>setQ(e.target.value)}/></div>
          <div style={{ flex:1 }}/>
          <span style={{ fontSize: 13.5, color:P.inkDim }}><b style={{ color:P.ink }}>{picked.size} products selected</b> <span style={{ fontFamily:P.fontMono, color:P.inkMute }}>(Min: {d.min} | Max: {d.max})</span></span>
          <PBtn variant="accent" size="lg" disabled={!inRange} onClick={()=>onSave&&onSave({...d, picked:[...picked]})}>Assign</PBtn>
        </div>
        <div style={{ maxHeight:360, overflowY:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize: 13.5 }}>
            <thead><tr style={{ background:P.surface2 }}>
              {['','Product Name','Strain Type','Product Brand','Inventory','Price','Traits'].map((h,i)=><th key={i} style={{ textAlign:i>3&&i<6?'right':'left', padding:'10px 16px', fontSize: 11.5, fontWeight:600, letterSpacing:'.06em', textTransform:'uppercase', color:P.inkDim, borderBottom:`1px solid ${P.hairline2}`, position:'sticky', top:0, background:P.surface2, whiteSpace:'nowrap' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {rows.map(p=>{ const on=picked.has(p.id); return (<tr key={p.id} onClick={()=>pick(p.id)} style={{ cursor:'pointer', background:on?P.accentSoft:'transparent' }}>
                <td style={{ padding:'11px 16px', borderTop:`1px solid ${P.hairline}` }}><span style={{ width:18, height:18, borderRadius:5, border:`1.5px solid ${on?P.ink:P.hairline3}`, background:on?P.ink:'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>{on && <Icon name="check" size={11} stroke={3} color={P.surface}/>}</span></td>
                <td style={{ padding:'11px 16px', borderTop:`1px solid ${P.hairline}`, fontWeight:600 }}>{p.name}</td>
                <td style={{ padding:'11px 16px', borderTop:`1px solid ${P.hairline}`, color:P.ink2 }}>{p.strain}</td>
                <td style={{ padding:'11px 16px', borderTop:`1px solid ${P.hairline}`, color:P.ink2 }}>{p.brand}</td>
                <td style={{ padding:'11px 16px', borderTop:`1px solid ${P.hairline}`, textAlign:'right', fontFamily:P.fontMono }}>{p.inv}</td>
                <td style={{ padding:'11px 16px', borderTop:`1px solid ${P.hairline}`, textAlign:'right', fontFamily:P.fontMono, fontWeight:600 }}>${p.price}</td>
                <td style={{ padding:'11px 16px', borderTop:`1px solid ${P.hairline}`, color:P.inkMute }}>{p.traits}</td>
              </tr>); })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  </div>);
};
