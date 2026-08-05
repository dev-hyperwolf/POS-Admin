// ── Activity — shift dashboard: KPIs, upsell, route + cash ledger (daily) ───
const useP = window.useP;

function shiftDeliveries() {
  const live = (window.M.s.completed || []).filter((s) => s.outcome !== 'failure');
  const norm = (s) => ({ ...s, collected: s.collected != null ? s.collected : (s.cash || 0) + (s.card || s.cardCharged || 0), card: s.card != null ? s.card : s.cardCharged || 0 });
  return [...window.MD.SHIFT_COMPLETED.map(norm), ...live.map(norm)];
}

function Donut({ segs, size = 150, thick = 22 }) {
  const P = useP();
  const total = segs.reduce((a, s) => a + s.value, 0) || 1;
  const R = (size - thick) / 2,C = 2 * Math.PI * R;
  let off = 0;
  const done = segs.find((s) => s.key === 'completed');
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: '0 0 auto' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke={P.surface3} strokeWidth={thick} />
        {segs.map((s, i) => {const len = s.value / total * C;const el = <circle key={i} cx={size / 2} cy={size / 2} r={R} fill="none" stroke={s.color} strokeWidth={thick} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} strokeLinecap="butt" />;off += len;return el;})}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 32, fontWeight: 800, color: P.ink, fontFamily: P.fontMono, lineHeight: 1 }}>{done ? done.value : 0}</div>
        <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, letterSpacing: '.08em', marginTop: 3 }}>OF {total}</div>
      </div>
    </div>);
}

window.ActivityScreen = function ActivityScreen() {
  const P = useP();const M = window.useM();
  const [period, setPeriod] = React.useState('today');
  const [ledgerKind, setLedgerKind] = React.useState('all');
  const [ledgerQ, setLedgerQ] = React.useState('');
  const money = window.HW.fmt.money;
  const dels = shiftDeliveries();
  const isToday = period === 'today';

  const cashSum = dels.reduce((a, s) => a + (s.cash || 0), 0);
  const cardSum = dels.reduce((a, s) => a + (s.card || 0), 0);
  const collected = cashSum + cardSum;
  const grossTotal = dels.reduce((a, s) => a + (s.total || 0), 0);
  const aov = dels.length ? grossTotal / dels.length : 0;
  const mult = { today: 1, week: 5.4, month: 22 }[period];
  const scaled = (n) => Math.round(n * mult);
  const scaledM = (n) => n * mult;

  const routeCounts = window.MD.TASKS.reduce((a, t) => {const done = M.isDone(t.id);const k = done ? 'completed' : t.status === 'in-progress' ? 'inprogress' : 'notstarted';a[k]++;return a;}, { completed: 0, inprogress: 0, notstarted: 0 });
  const segs = [
  { key: 'completed', label: 'Completed', value: routeCounts.completed + window.MD.SHIFT_COMPLETED.length, color: P.good },
  { key: 'inprogress', label: 'In progress', value: routeCounts.inprogress, color: P.indica },
  { key: 'notstarted', label: 'Not started', value: routeCounts.notstarted, color: P.neutral }];


  // Cash ledger (today only) — chronological money movements + tips
  const tips = window.M.seedTips();
  const ledger = [];
  dels.forEach((s) => {
    if (s.cash > 0) ledger.push({ t: s.at, kind: 'cash', label: s.name, order: s.order, amt: s.cash });
    if (s.card > 0) ledger.push({ t: s.at, kind: 'card', label: s.name, order: s.order, amt: s.card });
  });
  tips.forEach((tp) => ledger.push({ t: tp.at, kind: 'tip', label: tp.name || 'Cash tip', order: tp.order, amt: tp.amount }));
  const kindMeta = { cash: ['cash', P.accent, 'Cash'], card: ['card', P.info, 'Card'], tip: ['star', '#E5A24E', 'Tip'] };

  const up = window.MD.UPSELL;

  const kpi = (label, value, sub, icon, tint) =>
  <div style={{ flex: 1, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, padding: '13px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}><Icon name={icon} size={15} stroke={1.9} color={tint || P.inkMute} /><span style={{ fontSize: 11.5, color: P.inkDim, fontWeight: 600 }}>{label}</span></div>
      <div style={{ fontSize: 21, fontWeight: 800, color: P.ink, fontFamily: P.fontMono, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, marginTop: 6 }}>{sub}</div>}
    </div>;


  return (
    <div style={{ padding: '2px 16px 100px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Seg value={period} onChange={setPeriod} full options={[{ value: 'today', label: 'Today' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} />

      {/* KPIs — money only on Today; Week/Month show performance metrics */}
      {isToday ? <>
        <div style={{ display: 'flex', gap: 10 }}>
          {kpi('Collected', money(collected), `${dels.length} deliveries`, 'cash', P.accent)}
          {kpi('Deliveries', dels.length, `goal ${window.MD.SHIFT.goalDeliveries}`, 'package')}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {kpi('On-time', window.MD.SHIFT.onTimePct + '%', 'today', 'clock', P.good)}
          {kpi('Distance', window.MD.SHIFT.miles.toFixed(1) + ' mi', 'driven', 'route')}
        </div>
      </> : (() => {
        const sh = window.MD.SHIFT;const dw = sh.avgDwellSec;
        const cards = [
        ['Deliveries', scaled(dels.length), 'completed', 'package', null],
        ['On-time', sh.onTimePct + '%', 'this ' + period, 'clock', P.good],
        ['Acceptance', sh.acceptPct + '%', 'orders taken', 'check-circle', P.good],
        ['Rating', sh.rating + '★', sh.ratingCount + ' ratings', 'star', '#E5A24E'],
        ['Stops / hr', sh.stopsPerHr, 'pace', 'lightning', P.info],
        ['Distance', scaledM(sh.miles).toFixed(0) + ' mi', 'driven', 'route', null],
        ['Time / stop', Math.round(dw / 60) + 'm', 'avg handle', 'clock', P.info],
        ['Upsell attach', Math.round(up.attachRate * 100) + '%', 'of orders', 'sparkle', P.accent]];

        return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{cards.map((c) => <div key={c[0]}>{kpi(c[0], c[1], c[2], c[3], c[4])}</div>)}</div>;
      })()}

      {/* TODAY-ONLY: totals + reconcile at the top */}
      {isToday && <div style={{ display: 'flex', gap: 10 }}>
        {[['Cash', cashSum, P.accent], ['Card', cardSum, P.info], ['Tips', window.M.tipTotal(), '#E5A24E']].map(([k, v, c]) =>
          <div key={k} style={{ flex: 1, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r14, padding: '11px 12px' }}><div style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>{k}</div><div style={{ fontSize: 16, fontWeight: 800, color: c, fontFamily: P.fontMono, marginTop: 2 }}>{money(v)}</div></div>
        )}
      </div>}

      {isToday && <button onClick={() => window.M.go('discrepancy')} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '15px 16px', background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, cursor: 'pointer', textAlign: 'left', width: '100%' }}>
        <span style={{ width: 40, height: 40, borderRadius: 11, background: P.ink, color: P.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="cash" size={20} stroke={2} /></span>
        <div style={{ flex: 1 }}><div style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>Reconcile pouch · {money(cashSum)} cash</div><div style={{ fontSize: 12.5, color: P.inkDim, marginTop: 2 }}>End-of-shift count & discrepancies</div></div>
        <Icon name="chevron-right" size={18} stroke={2} color={P.inkFaint} />
      </button>}

      {/* Upsell insight — revenue only on Today */}
      <div style={{ background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="sparkle" size={16} stroke={2} /></span>
          <Eyebrow>Your upsells · shop@home</Eyebrow>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{Math.round(up.attachRate * 100)}% attach</span>
        </div>
        <div style={{ display: 'flex' }}>
          {(isToday ? [['Times added', scaled(up.adds)], ['Items', scaled(up.items)], ['Extra revenue', money(scaledM(up.value))]] : [['Times added', scaled(up.adds)], ['Items added', scaled(up.items)], ['Attach rate', Math.round(up.attachRate * 100) + '%']]).map(([k, v], i) =>
          <div key={k} style={{ flex: 1, borderLeft: i ? `1px solid ${P.hairline}` : 'none', paddingLeft: i ? 14 : 0 }}>
              <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{k}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: P.ink, fontFamily: P.fontMono, marginTop: 3 }}>{v}</div>
            </div>
          )}
        </div>
      </div>

      {/* TODAY-ONLY: route donut */}
      {isToday && <div style={{ background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, padding: '16px 16px 18px' }}>
        <Eyebrow style={{ marginBottom: 14 }}>Today's route</Eyebrow>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Donut segs={segs} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {segs.map((s) =>
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ width: 11, height: 11, borderRadius: 3, background: s.color, flex: '0 0 auto' }} />
                <span style={{ fontSize: 13.5, color: P.ink2, fontWeight: 600, flex: 1 }}>{s.label}</span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{s.value}</span>
              </div>
            )}
          </div>
        </div>
      </div>}

      {/* TODAY-ONLY: cash & card ledger */}
      {isToday && (() => {
        const filtered = ledger.filter((e) => (ledgerKind === 'all' || e.kind === ledgerKind) && (!ledgerQ.trim() || (e.label + ' ' + (e.order || '')).toLowerCase().includes(ledgerQ.toLowerCase())));
        return <div style={{ background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 12 }}><Eyebrow>Cash & card ledger</Eyebrow><div style={{ flex: 1 }} /><span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>today</span></div>
        <div style={{ marginBottom: 10 }}><Field icon="search" size="sm" placeholder="Search name or order" value={ledgerQ} onChange={(e) => setLedgerQ(e.target.value)} /></div>
        <div style={{ display: 'flex', gap: 7, marginBottom: 12 }}>{[['all', 'All'], ['cash', 'Cash'], ['card', 'Card'], ['tip', 'Tips']].map(([k, l]) => { const a = ledgerKind === k; return <button key={k} onClick={() => setLedgerKind(k)} style={{ flex: 1, padding: '7px 4px', borderRadius: 99, border: `1.5px solid ${a ? P.accentBorder : P.hairline2}`, background: a ? P.accentSoft : 'transparent', color: a ? (P.accentText) : P.ink2, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{l}</button>; })}</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {filtered.length === 0 && <div style={{ padding: '18px 0', textAlign: 'center', color: P.inkMute, fontSize: 12.5 }}>No matching entries</div>}
          {filtered.map((e, i) => {const [ic, c, lbl] = kindMeta[e.kind];return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 0', borderBottom: i < filtered.length - 1 ? `1px solid ${P.hairline}` : 'none' }}>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: c + (P.mode === 'dark' ? '22' : '18'), color: c, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={ic} size={15} stroke={2} /></span>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.label}</div><div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{lbl}{e.order ? ' · ' + e.order : ''} · {e.t}</div></div>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: e.kind === 'tip' ? '#E5A24E' : P.ink, fontFamily: P.fontMono }}>+{money(e.amt)}</span>
            </div>);})}
        </div>
      </div>; })()}
    </div>);

};

Object.assign(window, { shiftDeliveries });