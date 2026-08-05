// ── "Weekly deal board" — creative header + category → brand → discount ──────
const useP = window.useP;
const { useState } = React;

// 12 brands on sale this week — each carries its own color + offer + category.
const BR = [
{ id: 'hyperwolf', name: 'Hyperwolf', hue: 48, badge: '30% OFF', cat: 'Flower', days: [0, 1, 2, 3, 4, 5, 6] },
{ id: 'stilo', name: 'Stilo Supply', hue: 275, badge: 'BOGO', cat: 'Vape', days: [0, 1, 2, 3, 4, 5, 6] },
{ id: 'chkn', name: 'CHKN N WAFFLEZ', hue: 22, badge: 'FREE GIFT', cat: 'Edibles', days: [4, 5, 6] },
{ id: 'pleasure', name: 'Pleasure Med', hue: 172, badge: '15% OFF', cat: 'Wellness', days: [0, 1, 2, 3, 4, 5, 6] },
{ id: 'kine', name: 'Kine', hue: 110, badge: '2/$15', cat: 'Pre-roll', days: [0, 1, 2, 3, 4, 5, 6] },
{ id: 'claybourne', name: 'Claybourne', hue: 14, badge: '20% OFF', cat: 'Pre-roll', days: [2] },
{ id: 'almora', name: 'Almora', hue: 210, badge: '$10 OFF', cat: 'Vape', days: [0, 1, 2, 3, 4, 5, 6] },
{ id: 'coldfire', name: 'Coldfire', hue: 198, badge: '25% OFF', cat: 'Concentrate', days: [2] },
{ id: 'driftwood', name: 'Driftwood', hue: 88, badge: '20% OFF', cat: 'Flower', days: [4, 5, 6] },
{ id: 'harbor', name: 'Harbor', hue: 330, badge: '15% OFF', cat: 'Edibles', days: [0, 1, 2, 3, 4, 5, 6] },
{ id: 'kanha', name: 'Kanha', hue: 38, badge: '20% OFF', cat: 'Edibles', days: [1] },
{ id: 'wyld', name: 'Wyld', hue: 262, badge: '10% OFF', cat: 'Wellness', days: [0, 1, 2, 3, 4, 5, 6] }];

const WK_DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WEEKS = ['Jun 29 – Jul 5', 'Jul 6 – 12', 'Jul 13 – 19', 'Jul 20 – 26'];
function DayDots({ days }) {
  const P = useP();const full = days.length === 7;
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
    <span style={{ display: 'inline-flex', gap: 5 }}>{WK_DOW.map((d, i) => {const on = days.includes(i);return <span key={i} title={names[i] + (on ? ' · on' : ' · off')} style={{ width: 18, height: 18, borderRadius: 5, fontSize: 11.5, fontWeight: 800, fontFamily: P.fontMono, display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? full ? P.good : P.ink : 'transparent', color: on ? '#fff' : P.inkFaint, border: on ? 'none' : `1px solid ${P.hairline2}` }}>{d}</span>;})}</span>
    <span style={{ fontSize: 11.5, fontWeight: 700, fontFamily: P.fontMono, color: full ? P.good : P.inkDim, whiteSpace: 'nowrap' }}>{full ? 'All week' : days.length + (days.length === 1 ? ' day' : ' days')}</span>
  </span>;
}

const CAT_ORDER = ['Flower', 'Vape', 'Pre-roll', 'Edibles', 'Concentrate', 'Wellness'];
// category color scheme — mirrors the storefront/home category colors (placeholders, map to real tokens)
const CAT_COLOR = { Flower: '#5FB878', Vape: '#8E7BE0', 'Pre-roll': '#E38A3C', Edibles: '#E36597', Concentrate: '#E0B341', Wellness: '#3FB6AC' };
const hsl = (h, s, l) => `hsl(${h} ${s}% ${l}%)`;
const brandGrad = (h, dark) => `linear-gradient(140deg, ${hsl(h, dark ? 42 : 58, dark ? 34 : 48)}, ${hsl((h + 30) % 360, dark ? 46 : 64, dark ? 24 : 38)})`;
const shortBadge = (b) => b.replace(' OFF', '');

// ── Day-availability callouts (Options A + B shipped together) ──────────────
// A = inline day tag on limited-day deals · B = today-aware urgency states.
// "today" is a weekday index 0=Mon … 6=Sun; the demo "this week" treats Wed as today.
const TODAY_DOW = 2; // Wednesday — the demo's "today" on the current week
const DOW3 = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
function dayLabel(days) {
  const s = [...days].sort((a, b) => a - b);
  if (s.length === 1) return DOW3[s[0]] + ' ONLY';
  const contig = s.every((d, i) => i === 0 || d === s[i - 1] + 1);
  return contig ? DOW3[s[0]] + '–' + DOW3[s[s.length - 1]] : s.map((d) => DOW3[d][0]).join('');
}
function dayCallout(days, today) {
  if (!days || days.length >= 7) return null; // all week → no callout (A: only exceptions get tagged)
  const s = [...days].sort((a, b) => a - b);
  if (today != null) {// B: today-aware urgency
    if (days.includes(today)) return { tone: 'today', text: s.length === 1 ? 'TODAY ONLY' : 'TODAY' };
    if (s[0] > today) return { tone: 'soon', text: 'STARTS ' + DOW3[s[0]] };
    if (s[s.length - 1] < today) return { tone: 'past', text: 'ENDED ' + DOW3[s[s.length - 1]] };
  }
  return { tone: 'range', text: dayLabel(days) }; // A: plain day range (other weeks / no "today")
}
function DayTag({ days, today = TODAY_DOW, size }) {
  const P = useP();
  const co = dayCallout(days, today);if (!co) return null;
  const sm = size === 'sm';
  const base = { fontFamily: P.fontMono, fontSize: 10, fontWeight: 800, letterSpacing: '.06em', padding: sm ? '1px 5px' : '2px 6px', borderRadius: 6, whiteSpace: 'nowrap', display: 'inline-block', lineHeight: 1.3 };
  const tones = {
    today: { background: '#FF5C4D', color: '#fff', boxShadow: '0 0 0 3px rgba(255,92,77,.22)' },
    soon: { background: 'rgba(255,209,0,.16)', color: '#FFD100', border: '1px solid rgba(255,209,0,.42)' },
    past: { border: '1px solid rgba(255,255,255,.22)', color: 'rgba(255,255,255,.45)' },
    range: { border: '1px solid rgba(255,255,255,.35)', color: 'rgba(255,255,255,.82)' }
  };
  return <span style={{ ...base, ...tones[co.tone] }}>{co.text}</span>;
}

// One auto-generated shop tile from a brand record — no hand art.
function BrandTile({ b, dark }) {
  const P = useP();
  return <div style={{ borderRadius: 14, overflow: 'hidden', background: P.surface, border: `1px solid ${P.hairline2}`, boxShadow: P.shadowSm }}>
    <div style={{ height: 78, position: 'relative', background: brandGrad(b.hue, dark), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 24%, rgba(255,255,255,.4), transparent 58%)' }} />
      <span style={{ fontFamily: P.fontMono, fontWeight: 800, fontSize: 21, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,.25)' }}>{b.name[0]}</span>
      <span style={{ position: 'absolute', top: 8, left: 8, padding: '3px 7px', borderRadius: 99, background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: 10, fontWeight: 800, fontFamily: P.fontMono, letterSpacing: '.04em' }}>{shortBadge(b.badge)}</span>
      {dayCallout(b.days, TODAY_DOW) && <span style={{ position: 'absolute', top: 8, right: 8 }}><DayTag days={b.days} size="sm" /></span>}
    </div>
    <div style={{ padding: '8px 10px' }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.2 }}>{b.name}</div>
      <div style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono, marginTop: 2 }}>{b.cat}</div>
    </div>
  </div>;
}

// THE weekly-deal hero: creative header, then categories → brand + discount.
// device: 'mobile' (phone-framed) | 'desktop' (wide) | undefined (fluid).
// headless: skip the creative header + frame (used by the hybrid surface).
function DealBoard({ list, weekLabel, device, headless, copy, today = TODAY_DOW }) {
  const P = useP();
  const groups = {};list.forEach((b) => {(groups[b.cat] = groups[b.cat] || []).push(b);});
  const cats = CAT_ORDER.filter((c) => groups[c]);
  const mobile = device === 'mobile';
  const catCols = mobile ? '1fr 1fr' : 'repeat(3,1fr)';
  const eyebrow = copy && copy.eyebrow || 'HYPERWOLF';
  const headline = copy && copy.headline || 'THIS WEEK’S DEALS';
  const subhead = copy && copy.subhead || `${list.length} brands · every category marked down`;
  const content = <div style={{ background: '#0E1511', color: '#fff' }}>
    {!headless && <div style={{ position: 'relative', padding: mobile ? '14px 15px 12px' : '20px 22px 18px', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -40, right: -30, width: 200, height: 200, background: 'radial-gradient(circle, rgba(95,184,120,.24), transparent 70%)' }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: mobile ? 130 : 200 }}>
          <div style={{ fontSize: mobile ? 10 : 11, fontWeight: 800, letterSpacing: '.14em', color: '#FFD100', fontFamily: P.fontMono }}>{eyebrow}</div>
          <div style={{ fontSize: mobile ? 22 : 30, fontWeight: 900, letterSpacing: '-.03em', lineHeight: .98, marginTop: 6 }}>{headline}</div>
          <div style={{ fontSize: mobile ? 11 : 12.5, color: 'rgba(255,255,255,.6)', marginTop: 7 }}>{subhead}</div>
        </div>
        <span style={{ padding: '6px 12px', borderRadius: 99, background: '#fff', color: '#0F0F0C', fontSize: mobile ? 11 : 12, fontWeight: 800, fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>{weekLabel || 'JUL 6 – 12'}</span>
      </div>
    </div>}
    <div style={{ padding: mobile ? '12px 12px 12px' : '0 16px 16px', display: 'grid', gridTemplateColumns: catCols, gap: 10 }}>
      {cats.map((cat) => {const cc = CAT_COLOR[cat] || '#FFD100';return <div key={cat} style={{ minWidth: 0, borderRadius: 13, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.10)', borderLeft: `3px solid ${cc}`, padding: '12px 13px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9 }}>
          <span style={{ width: 7, height: 7, borderRadius: 2, background: cc, flex: '0 0 auto' }} />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', color: cc, fontFamily: P.fontMono }}>{cat.toUpperCase()}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: mobile ? 11 : 10 }}>
          {groups[cat].map((b) => mobile ?
            <div key={b.id} style={{ display: 'flex', flexDirection: 'column', gap: 3, opacity: dayCallout(b.days, today)?.tone === 'past' ? .5 : 1 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.2, color: '#fff', wordBreak: 'break-word' }}>{b.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: '#FFD100', fontFamily: P.fontMono }}>{shortBadge(b.badge)}</span>
                <DayTag days={b.days} today={today} size="sm" />
              </div>
            </div> :
            <div key={b.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, opacity: dayCallout(b.days, today)?.tone === 'past' ? .5 : 1 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, flex: 1, minWidth: 0, lineHeight: 1.25, color: '#fff', wordBreak: 'break-word' }}>{b.name}</span>
              <DayTag days={b.days} today={today} />
              <span style={{ fontSize: 13.5, fontWeight: 800, color: '#FFD100', fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>{shortBadge(b.badge)}</span>
            </div>)}
        </div>
      </div>;})}
    </div>
    <div style={{ padding: mobile ? '0 12px 14px' : '0 16px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <span style={{ padding: '11px 18px', borderRadius: 12, background: '#FFD100', color: '#1A1400', fontWeight: 800, fontSize: 13.5, ...(mobile ? { flex: 1, textAlign: 'center' } : {}) }}>Shop all deals →</span>
      {!mobile && <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,.5)', fontFamily: P.fontMono }}>UPCOMING · 7/27 New-drop Friday</span>}
    </div>
  </div>;
  if (headless) return content;
  if (mobile) return <div style={{ width: 300, borderRadius: 40, background: '#000', padding: 9, boxShadow: '0 30px 60px rgba(0,0,0,.3)' }}><div style={{ borderRadius: 32, overflow: 'hidden', background: '#0F0F0C', position: 'relative' }}><div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', width: 86, height: 22, borderRadius: 20, background: '#000', zIndex: 5 }} /><div style={{ height: 38 }} />{content}</div></div>;
  return <div style={{ borderRadius: 18, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.28)' }}>{content}</div>;
}

Object.assign(window, { DealBoard, DayTag, dayCallout, dayLabel, WM_TODAY_DOW: TODAY_DOW, WEEKLY_BR: BR, WEEKLY_CATS: CAT_ORDER, WEEKLY_CAT_COLOR: CAT_COLOR, weeklyGrad: brandGrad });
window.BrandMapView = function BrandMapView({ onNew }) {
  const P = useP();
  const [wk, setWk] = useState(1);
  const weekLabel = WEEKS[wk];
  const [on, setOn] = useState(() => new Set(BR.map((b) => b.id)));
  const toggle = (id) => setOn((prev) => {const n = new Set(prev);n.has(id) ? n.delete(id) : n.add(id);return n;});
  const list = BR.filter((b) => on.has(b.id));
  const dark = P.mode === 'dark';

  return <div style={{ maxWidth: 1320, margin: '0 auto' }}>
    {/* ONE week switcher governs this whole section */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, padding: 4 }}>
        <button onClick={() => setWk((w) => Math.max(0, w - 1))} disabled={wk === 0} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: 8, cursor: wk === 0 ? 'default' : 'pointer', color: wk === 0 ? P.inkFaint : P.ink2 }}><Icon name="chevron-left" size={16} /></button>
        <span style={{ fontSize: 13.5, fontWeight: 700, fontFamily: P.fontMono, color: P.ink, padding: '0 10px', whiteSpace: 'nowrap' }}>Week of {weekLabel}</span>
        <button onClick={() => setWk((w) => Math.min(WEEKS.length - 1, w + 1))} disabled={wk === WEEKS.length - 1} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: 8, cursor: wk === WEEKS.length - 1 ? 'default' : 'pointer', color: wk === WEEKS.length - 1 ? P.inkFaint : P.ink2 }}><Icon name="chevron-right" size={16} /></button>
      </div>
      {wk !== 1 && <PBtn variant="ghost" size="sm" onClick={() => setWk(1)}>This week</PBtn>}
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 11.5, color: P.inkMute }}>One switcher controls the whole board</span>
      <PBtn variant="secondary" icon="plus" size="sm" onClick={onNew}>New promotion</PBtn>
    </div>
    {/* SOURCE → OUTPUT mapping: the 12 promo records that feed the board */}
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 10 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: P.inkMute, fontFamily: P.fontMono }}>Source · {list.length} live promotions</div>
      <div style={{ fontSize: 12.5, color: P.inkDim }}>the live promotions feeding this week's board (staged in Studio)</div>
    </div>
    <Card padding={0} style={{ marginBottom: 22 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(360px,1fr))' }}>
        {BR.map((b, i) =>
        <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 16px', fontFamily: P.fontSans, borderRight: `1px solid ${P.hairline}`, borderBottom: `1px solid ${P.hairline}` }}>
            <span style={{ width: 28, height: 28, borderRadius: 8, flex: '0 0 auto', background: brandGrad(b.hue, dark), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 800, color: '#fff', fontFamily: P.fontMono }}>{b.name[0]}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink, lineHeight: 1.25 }}>{b.name} <span style={{ fontSize: 11.5, fontWeight: 600, color: P.inkMute, fontFamily: P.fontMono }}>· {b.cat}</span></div>
              <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, marginTop: 4, overflow: 'hidden' }}><DayDots days={b.days} /></div>
            </div>
            <span style={{ fontSize: 12.5, fontWeight: 800, flex: '0 0 auto', color: P.accentInk, background: P.accent, fontFamily: P.fontMono, whiteSpace: 'nowrap', padding: '3px 9px', borderRadius: 99 }}>{shortBadge(b.badge)}</span>
          </div>)}
      </div>
      <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, background: P.surface2 }}>
        <Icon name="arrow-down" size={14} color={P.inkMute} />
        <span style={{ fontSize: 11.5, color: P.inkDim }}>The engine groups these <b style={{ color: P.ink }}>{list.length}</b> promotions by category and renders one hero board — no promo builds it alone.</span>
      </div>
    </Card>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
      {/* THE HERO — creative section + category/brand/discount board */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 10 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: P.inkMute, fontFamily: P.fontMono }}>Home hero · weekly deal</div>
          <div style={{ fontSize: 12.5, color: P.inkDim }}>creative section, then every category with its brands + discount</div>
        </div>
        <DealBoard list={list} weekLabel={weekLabel} today={wk === 1 ? TODAY_DOW : null} />
      </div>
    </div>
  </div>;
};