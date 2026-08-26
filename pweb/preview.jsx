/* 🔴 THIS FILE SORTS priority ASCENDING — LOWER WINS. That is the Promotions
 * Suite's convention: the editor is labelled "1 = highest" (screens.jsx:286)
 * and every record here uses 1..5. It is correct and its data agrees with it.
 *
 * THE COMMERCE ENGINE USES THE OPPOSITE CONVENTION. hyperwolf-commerce-logic
 * sorts `(b.priority ?? 0) - (a.priority ?? 0)` — HIGHER wins — and its shipped
 * rules use 5 / 10 / 20 / 30.
 *
 * ⚠️ SO NEVER HAND A PROMO'S `priority` STRAIGHT TO A RULE, OR THE REVERSE. It
 * ranks every contested slot exactly backwards, and it LOOKS right, because a
 * ranked list is still a list — nothing throws, and no test notices unless it
 * asserts the ORDER.
 * Convert explicitly: `fromSuitePriority()` / `toSuitePriority()` in the
 * engine's src/core/rules/priority.ts, which exist so that crossing this
 * boundary is a decision somebody made rather than a number that lined up.
 */
// ── Preview → "Live control" — backend board that sets what each surface shows
const useP = window.useP;
const { useState } = React;
const PV = window.PROMO;

const WDATES = [6, 7, 8, 9, 10, 11, 12].map((d) => new Date(2026, 6, d));
const WLAB = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PV_TODAY = 2;
const tOn = (c) => c === '#FFD100' ? '#1A1400' : c === '#0F0F0C' ? '#FFD100' : '#fff';

function pvActive(p, date) {
  if (['draft', 'ended', 'paused'].includes(p.status)) return false;
  const s = p.schedule || {};const t = date.getTime();
  if (s.recurring === 'weekly') return (s.days || []).includes(date.getDay());
  if (s.start) {const st = PV.pd(s.start).getTime();const en = s.end ? PV.pd(s.end).getTime() : Infinity;return t >= st && t <= en;}
  return false;
}
function pvResolve(promos, surfaceId, date) {
  const cap = { home_hero: 1, home_banner: 3 }[surfaceId] || 99;
  const elig = promos.filter((p) => pvActive(p, date) && (p.surfaces || []).includes(surfaceId)).sort((a, b) => (a.priority || 9) - (b.priority || 9));
  return { onAir: elig.slice(0, cap), benched: elig.slice(cap), elig, cap };
}

// surfaces shown on the control board
const CTRL = [
{ id: 'home_hero', label: 'Home hero', icon: 'layout', cap: '1 slot', tip: 'The single promo shown in the big hero. If more than one matches, they rotate as a slider by priority.' },
{ id: 'home_banner', label: 'Home banner', icon: 'flag', cap: '3 · rotates', tip: 'Up to 3 promos rotate through the home banner carousel.' },
{ id: 'shop_tile', label: 'Shop grid', icon: 'grid', cap: 'all deals', tip: 'Every matching promo appears as its own tile in the shop grid — no cap.' },
{ id: 'brand_takeover', label: 'Brand pages', icon: 'tag', cap: '1 / brand', tip: 'One promo themes each brand page.' },
{ id: 'checkout', label: 'Cart & checkout', icon: 'receipt', cap: 'top match', tip: 'The single highest-priority promo whose rules match the cart is applied at checkout.' },
{ id: 'loyalty', label: 'Rewards', icon: 'star', cap: 'all eligible', tip: 'Every matching promo is listed in the rewards hub.' }];


window.PreviewView = function PreviewView({ promos, onOpen }) {
  const P = useP();
  const [dayIdx, setDayIdx] = useState(PV_TODAY);
  const [expanded, setExpanded] = useState(null);
  const date = WDATES[dayIdx];
  const activeToday = promos.filter((p) => pvActive(p, date)).sort((a, b) => (a.priority || 9) - (b.priority || 9));
  const conflicts = CTRL.filter((s) => {const r = pvResolve(promos, s.id, date);return s.id !== 'shop_tile' && s.id !== 'loyalty' && r.benched.length > 0;}).length;

  const PromoRow = ({ p, tag, tagKind }) =>
  <button onClick={() => onOpen(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 13px', textAlign: 'left', background: 'transparent', border: 'none', borderTop: `1px solid ${P.hairline}`, cursor: 'pointer' }}
  onMouseEnter={(e) => e.currentTarget.style.background = P.surface2} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
      <span style={{ width: 26, height: 26, borderRadius: 7, flex: '0 0 auto', background: p.creative.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={(PV.CAMPAIGNS.find((c) => c.id === p.campaign) || {}).icon || 'tag'} size={13} color={tOn(p.creative.color)} /></span>
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div><div style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>{PV.offerBadge(p)}</div></div>
      {tag && <span style={{ fontFamily: P.fontMono, fontSize: 10, fontWeight: 700, letterSpacing: '.06em', padding: '2px 6px', borderRadius: 99, background: tagKind === 'air' ? P.mode === 'dark' ? 'rgba(70,192,126,.16)' : 'rgba(31,138,79,.14)' : P.surface3, color: tagKind === 'air' ? P.good : P.inkMute }}>{tag}</span>}
      <Icon name="chevron-right" size={14} color={P.inkFaint} />
    </button>;

  return <div style={{ maxWidth: 1240, margin: '0 auto' }}>
    <SectionHead level={1} eyebrow="Promotions · Live control" title="What's live"
    subtitle="Set exactly what each retail surface shows, per day. Every slot is filled automatically from your promotions — click any to adjust its record. Switch days below; the full-week grid is in This Week."
    action={conflicts > 0 ? <Pill kind="warn" dot>{conflicts} slot{conflicts > 1 ? 's' : ''} oversubscribed</Pill> : <Pill kind="good" dot>All slots clear</Pill>} />

    {/* day selector */}
    <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>{WDATES.map((dt, i) => {const a = i === dayIdx;return (
          <button key={i} onClick={() => setDayIdx(i)} style={{ flex: '1 1 0', minWidth: 96, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '12px 16px', borderRadius: 12, background: a ? P.ink : P.surface, color: a ? P.surface : P.ink2, border: `1px solid ${a ? P.ink : P.hairline2}`, cursor: 'pointer', fontFamily: P.fontSans }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{WLAB[i]}</span><span style={{ fontSize: 12.5, fontWeight: 600, fontFamily: P.fontMono, color: a ? 'rgba(255,255,255,.7)' : P.ink2 }}>{dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        {i === PV_TODAY && <span style={{ fontSize: 10, fontWeight: 700, fontFamily: P.fontMono, color: P.accent }}>TODAY</span>}
      </button>);})}</div>

    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 20, alignItems: 'start' }}>
      {/* surface control tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {CTRL.map((s) => {const r = pvResolve(promos, s.id, date);const oversub = s.id !== 'shop_tile' && s.id !== 'loyalty' && r.benched.length > 0;return (
            <Card key={s.id} padding={0}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 13px', borderBottom: `1px solid ${P.hairline}` }}>
              <span style={{ width: 28, height: 28, borderRadius: 7, background: P.surface3, color: P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={s.icon} size={15} stroke={1.9} /></span>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 800 }}>{s.label}</div></div>
              <span title={s.tip} style={{ fontFamily: P.fontMono, fontSize: 10, color: P.inkMute, background: P.surface2, border: `1px solid ${P.hairline2}`, padding: '2px 7px', borderRadius: 99, cursor: 'help' }}>{s.cap}</span>
            </div>
            {r.onAir.length === 0 ?
              <div style={{ padding: '16px 13px', fontSize: 12.5, color: P.inkFaint }}>No promotion assigned {WLAB[dayIdx]}.</div> :
              <div>
                  {r.onAir.map((p) => <PromoRow key={p.id} p={p} tag={s.cap.includes('rotates') || s.id === 'home_hero' && r.rotating ? 'ON AIR' : s.id === 'shop_tile' || s.id === 'loyalty' ? null : 'ON AIR'} tagKind="air" />)}
                  {r.benched.length > 0 && (oversub ?
                <div title="More promos match this slot than it can show at once, so they rotate (carousel) by priority — none are dropped." style={{ padding: '9px 13px', borderTop: `1px solid ${P.hairline}`, display: 'flex', alignItems: 'center', gap: 8, background: P.warnSoft, cursor: 'help' }}>
                        <Icon name="info" size={13} color={P.warn} /><span style={{ fontSize: 11.5, color: P.warn, flex: 1 }}>{r.benched.length} more want this slot</span>
                        <span style={{ fontFamily: P.fontMono, fontSize: 10, color: P.warn, fontWeight: 700 }}>rotating</span>
                      </div> :
                r.benched.map((p) => <PromoRow key={p.id} p={p} tag="QUEUED" tagKind="q" />))}
                </div>}
          </Card>);})}
      </div>

      {/* promotions ledger */}
      <Card padding={0} style={{ position: 'sticky', top: 0 }}>
        <div style={{ padding: '14px 15px', borderBottom: `1px solid ${P.hairline2}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: P.inkMute, fontFamily: P.fontMono }}>Live {WLAB[dayIdx]} · {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>{activeToday.length} promotions running</div>
        </div>
        <div style={{ maxHeight: 600, overflowY: 'auto' }}>
          {activeToday.map((p) => {const summ = PV.scopeSummary(p);const open = expanded === p.id;return (
              <div key={p.id} style={{ borderBottom: `1px solid ${P.hairline}` }}>
              <div onClick={() => setExpanded(open ? null : p.id)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 15px', cursor: 'pointer', background: open ? P.surface2 : 'transparent' }}
                onMouseEnter={(e) => {if (!open) e.currentTarget.style.background = P.surface2;}} onMouseLeave={(e) => {if (!open) e.currentTarget.style.background = 'transparent';}}>
                <span style={{ width: 30, height: 30, borderRadius: 8, flex: '0 0 auto', background: p.creative.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={(PV.CAMPAIGNS.find((c) => c.id === p.campaign) || {}).icon || 'tag'} size={15} color={tOn(p.creative.color)} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{PV.offerBadge(p)} · {summ.count != null ? summ.count + ' products' : 'storewide'}</div>
                </div>
                <span onClick={(e) => {e.stopPropagation();onOpen(p.id);}} title="Edit promotion" style={{ width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.inkMute, cursor: 'pointer' }}><Icon name="pencil" size={14} /></span>
                <Icon name="chevron-down" size={15} color={P.inkFaint} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
              </div>
              {open && <div style={{ padding: '2px 15px 13px', background: P.surface2 }}>
                {summ.count === null ?
                  <div style={{ fontSize: 11.5, color: P.inkDim, padding: '6px 0' }}>Applies to the whole order — not limited to specific products.</div> :
                  summ.count === 0 ?
                  <div style={{ fontSize: 11.5, color: P.inkDim, padding: '6px 0' }}>No catalog products match yet.</div> :
                  <div>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkMute, fontFamily: P.fontMono, margin: '4px 0 8px' }}>{summ.count} products on sale{summ.cats.length ? ` · ${summ.cats.join(', ')}` : ''}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {summ.list.map((pr, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 7, background: P.surface }}>
                            <span style={{ fontSize: 11.5, fontWeight: 600, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pr.n}</span>
                            <span style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>{pr.b}</span>
                            <span style={{ fontFamily: P.fontMono, fontSize: 11.5, fontWeight: 700 }}><span style={{ color: P.inkFaint, textDecoration: 'line-through', marginRight: 4 }}>${pr.was}</span><span style={{ color: P.good }}>${pr.now}</span></span>
                          </div>)}
                        </div>
                      </div>}
              </div>}
            </div>);})}
          {activeToday.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: P.inkMute, fontSize: 13.5 }}>No promotions live this day.</div>}
        </div>
        <div style={{ padding: '11px 15px', display: 'flex', alignItems: 'center', gap: 8, background: P.surface2 }}>
          <Icon name="info" size={14} color={P.inkMute} /><span style={{ fontSize: 11.5, color: P.inkDim }}>Click a promotion to see its products on sale · pencil to edit.</span>
        </div>
      </Card>
    </div>
  </div>;
};