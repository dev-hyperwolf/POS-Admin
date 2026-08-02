// ── Shared analytics command center — today's 26-metric analytics ───────────
// Exposed as window.AnalyticsCenter so both the Promotions Module and the
// merged Suite render the same rich analytics.
(function(){
const useP = window.useP;
const { pfmt, PROMOS, OVERVIEW, METRIC_GROUPS, toneColor } = window;

window.AnalyticsCenter = function AnalyticsCenter({ heading=true }){
  const P = useP(); const O = OVERVIEW;
  const active = PROMOS.filter((p)=>p.status==='active');
  const totalNew = active.reduce((a,p)=>a+p.m.newCust,0), totalRet = active.reduce((a,p)=>a+p.m.returning,0);
  const segs = [{ label:'Returning', value:totalRet, color:P.info }, { label:'New', value:totalNew, color:P.accent }];
  return (<div style={{ display:'flex', flexDirection:'column', gap:16 }}>
    {heading && <SectionHead level={2} eyebrow="Performance" title="Analytics command center" subtitle="Live redemption, revenue, customer and product impact across every active promotion — the full metric set."/>}
    <div style={{ display:'grid', gridTemplateColumns:'1.7fr 1fr', gap:16 }}>
      <Card padding={20}><div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}><div><Eyebrow>Redemptions over time</Eyebrow><div style={{ fontSize:26, fontWeight:600, color:P.ink, fontFamily:P.fontMono, marginTop:6 }}>{pfmt.num(O.redemptions)}</div></div><Pill kind="good" dot>▲ {O.redemptionsDelta}%</Pill></div><AreaChart data={O.series} label="acen" color={P.accent}/></Card>
      <Card padding={20}><Eyebrow>Who's redeeming</Eyebrow><div style={{ display:'flex', alignItems:'center', gap:18, marginTop:14 }}><Donut segments={segs} center={<div style={{ fontSize:17, fontWeight:700, color:P.ink, fontFamily:P.fontMono }}>{pfmt.num(totalNew+totalRet)}</div>}/><div style={{ display:'flex', flexDirection:'column', gap:10 }}>{segs.map((s)=><div key={s.label} style={{ display:'flex', alignItems:'center', gap:8 }}><span style={{ width:9, height:9, borderRadius:3, background:s.color }}/><div><div style={{ fontSize:12, fontWeight:600, color:P.ink }}>{s.label}</div><div style={{ fontSize:12, color:P.inkDim, fontFamily:P.fontMono }}>{pfmt.num(s.value)}</div></div></div>)}</div></div></Card>
    </div>
    {METRIC_GROUPS.map((g)=>{ const c=toneColor(P,g.tone); return (
      <Card key={g.id} padding={20}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}><span style={{ width:28, height:28, borderRadius:8, background:c+(P.mode==='dark'?'28':'1E'), color:c, display:'flex', alignItems:'center', justifyContent:'center' }}><Icon name={g.icon} size={15} stroke={1.9}/></span><h3 style={{ margin:0, fontSize:15, fontWeight:600, color:P.ink }}>{g.label}</h3><span style={{ fontSize:11, color:P.inkMute, fontFamily:P.fontMono }}>{g.metrics.length} metrics</span></div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>{g.metrics.map((m)=><div key={m.k} style={{ padding:'11px 13px', background:P.surface2, border:`1px solid ${P.hairline}`, borderRadius:P.r10 }}><div style={{ fontSize:12.5, fontWeight:600, color:P.ink, marginBottom:4 }}>{m.label}</div><div style={{ fontSize:11, color:P.inkDim, lineHeight:1.4 }}>{m.hint}</div></div>)}</div>
      </Card>); })}
  </div>);
};
})();
