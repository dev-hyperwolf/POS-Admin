// ── Sales panel — held carts + a full completed-sales lookup ────────────────
// The Completed tab is not a "recent" list; it is a search over every sale we
// have taken. Staff look sales up by whatever the customer can tell them —
// their name, the phone number on the account, an email, or the order number —
// so one field searches all of them at once.
const useP = window.useP;

const SALES_HELD = [
  { id: 'T-4821', name: 'Girish Sharma', phone: '(951) 555-0177', email: 'girish@yopmail.com', items: 3, total: 47.62, at: '6 min ago', by: 'Manisha Saini' },
  { id: 'T-4820', name: 'Walk-in', phone: '', email: '', items: 1, total: 15.00, at: '18 min ago', by: 'Priya Nair' }];

// Dates are ISO so the range filters are a plain comparison. `NOW` is pinned so
// the demo reads consistently: Aug 1 2026.
const SALES_NOW = new Date('2026-08-01T19:40:00');
const SALES_DONE = [
  { id: '#2041', name: 'Harshil Gupta', phone: '(951) 555-0142', email: 'harshil@yopmail.com', items: 2, total: 62.40, date: '2026-08-01', time: '7:37 PM', by: 'Manisha Saini', tender: 'Card' },
  { id: '#2040', name: 'Aarti Desai', phone: '(951) 555-0198', email: 'aarti.d@yopmail.com', items: 5, total: 128.15, date: '2026-08-01', time: '7:29 PM', by: 'Priya Nair', tender: 'Cash' },
  { id: '#2039', name: 'Walk-in', phone: '', email: '', items: 1, total: 22.00, date: '2026-08-01', time: '7:16 PM', by: 'Dev Rao', tender: 'Card' },
  { id: '#2038', name: 'Girish Sharma', phone: '(951) 555-0177', email: 'girish@yopmail.com', items: 4, total: 91.80, date: '2026-08-01', time: '7:02 PM', by: 'Manisha Saini', tender: 'Split' },
  { id: '#2036', name: 'Neha Kapoor', phone: '(951) 555-0163', email: 'neha.k@yopmail.com', items: 3, total: 74.25, date: '2026-07-31', time: '8:44 PM', by: 'Priya Nair', tender: 'Card' },
  { id: '#2034', name: 'Girish Sharma', phone: '(951) 555-0177', email: 'girish@yopmail.com', items: 2, total: 38.90, date: '2026-07-30', time: '6:12 PM', by: 'Dev Rao', tender: 'Cash' },
  { id: '#2031', name: 'Rohan Mehta', phone: '(951) 555-0121', email: 'rohan.m@yopmail.com', items: 6, total: 155.40, date: '2026-07-28', time: '5:55 PM', by: 'Manisha Saini', tender: 'Card' },
  { id: '#2027', name: 'Aarti Desai', phone: '(951) 555-0198', email: 'aarti.d@yopmail.com', items: 1, total: 19.00, date: '2026-07-24', time: '7:48 PM', by: 'Priya Nair', tender: 'Card' },
  { id: '#2019', name: 'Harshil Gupta', phone: '(951) 555-0142', email: 'harshil@yopmail.com', items: 4, total: 96.70, date: '2026-07-18', time: '4:31 PM', by: 'Dev Rao', tender: 'Split' },
  { id: '#1994', name: 'Neha Kapoor', phone: '(951) 555-0163', email: 'neha.k@yopmail.com', items: 2, total: 51.20, date: '2026-06-27', time: '8:05 PM', by: 'Manisha Saini', tender: 'Cash' },
  { id: '#1961', name: 'Girish Sharma', phone: '(951) 555-0177', email: 'girish@yopmail.com', items: 7, total: 212.35, date: '2026-05-30', time: '6:40 PM', by: 'Priya Nair', tender: 'Card' }];

const SALES_RANGES = [['today', 'Today'], ['7', '7 days'], ['30', '30 days'], ['all', 'Any date']];
const SALES_TENDERS = ['All', 'Cash', 'Card', 'Split'];

// Line items per sale so a looked-up receipt shows what was actually bought.
const SALES_LINES = {
  '#2041': [['Blueberry Pancakes', 1, 20.00], ['Cake Crasher', 1, 32.00]],
  '#2040': [['Space Ripper OG', 2, 38.00], ['Doubleshot', 1, 20.00], ['Thin Mint Sugar', 2, 52.00]],
  '#2039': [['Weed Kick THC', 1, 20.00]],
  '#2038': [['Product Willy', 2, 48.00], ['Cheetah Piss', 1, 5.00], ['Bumble Bee Honey', 1, 32.00]],
  '#2036': [['Lunar Drift Indica', 1, 40.00], ['First Class Funk', 1, 22.00], ['Bay Weeds Yo', 1, 8.00]],
  '#2034': [['Blast Off Smalls', 2, 26.00], ['Candy Kush', 1, 9.00]],
  '#2031': [['Ganja-12 Distillate', 2, 76.00], ['Firewalker Sugar', 2, 10.00], ['Neutron Cookies', 1, 62.00]],
  '#2027': [['Blast Radius Smalls', 1, 13.00]],
  '#2019': [['Cake Crasher', 2, 64.00], ['Frush Gummies', 2, 24.00]],
  '#1994': [['Papa\u2019s Herb Cart', 1, 32.00], ['Blueberry Pancakes', 1, 17.00]],
  '#1961': [['Neutron Cookies', 2, 124.00], ['Lunar Drift Indica', 1, 40.00], ['Doubleshot', 2, 40.00]] };

// Same order the register uses: local cannabis → state excise → state sales.
const SALES_TAX = [['Local cannabis tax (2.22%)', 0.0222], ['State excise tax (15%)', 0.15], ['State sales tax (6%)', 0.06]];
const SALES_TAX_RATE = SALES_TAX.reduce((a, t) => a + t[1], 0);
// The list total and the receipt total must be the same number, so both are
// derived from the line items rather than stored separately.
function saleTotal(s) {
  const lines = SALES_LINES[s.id];
  if (!lines) return s.total;
  return +(lines.reduce((a, l) => a + l[2], 0) * (1 + SALES_TAX_RATE)).toFixed(2);
}
// Same reason as saleTotal: the count on the row is what staff read before
// opening the receipt, so it has to come from the lines, not a stored literal.
function saleItems(s) {
  const lines = SALES_LINES[s.id];
  if (!lines) return s.items;
  return lines.reduce((a, l) => a + l[1], 0);
}

function salesDaysAgo(iso) { return Math.round((SALES_NOW - new Date(iso + 'T12:00:00')) / 86400000); }
function salesDateLabel(s) {
  const d = salesDaysAgo(s.date);
  if (d <= 0) return 'Today · ' + s.time;
  if (d === 1) return 'Yesterday · ' + s.time;
  return new Date(s.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + s.time;
}
// One query string is matched against every field a customer might quote.
// Digits-only comparison for phones so "5550177" finds "(951) 555-0177".
function salesMatch(s, q) {
  if (!q) return true;
  const n = q.toLowerCase().trim();
  const digits = n.replace(/\D/g, '');
  if (digits.length >= 3 && s.phone.replace(/\D/g, '').indexOf(digits) >= 0) return true;
  return [s.name, s.email, s.id, s.by, s.tender, salesDateLabel(s), s.date].join(' ').toLowerCase().indexOf(n) >= 0;
}

function SalesRow({ s, tab, onPick }) {
  const P = useP();
  const money = window.HW.fmt.money;
  const held = tab === 'held';
  return <button onClick={onPick} title={held ? 'Resume this cart' : 'Open receipt'} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px', background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}>
    <Avatar name={s.name} size={28} />
    <span style={{ flex: 1, minWidth: 0 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
        {s.tender && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: P.ink2, background: P.surface3, borderRadius: 5, padding: '1px 5px', flex: '0 0 auto' }}>{s.tender}</span>}
      </span>
      <span style={{ display: 'block', fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.id} · {held ? s.items : saleItems(s)} item{(held ? s.items : saleItems(s)) > 1 ? 's' : ''} · {held ? s.at : salesDateLabel(s)}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
        <Icon name={held ? 'pause' : 'check'} size={10} stroke={2.4} color={held ? P.warn : P.good} />
        <span style={{ fontSize: 10, color: P.ink2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{held ? 'Held by' : 'Rung up by'} <b style={{ fontWeight: 600 }}>{s.by}</b></span>
      </span>
    </span>
    <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink, fontFamily: P.fontMono, flex: '0 0 auto' }}>{money(held ? s.total : saleTotal(s))}</span>
  </button>;
}

// ── Sale detail — the receipt, reprint and return ───────────────────────────
// Looking a sale up is only ever a means to an end: reprint it, or take some
// of it back. Returns are per-line with a quantity, because partial returns
// are the common case and a whole-order refund is just every line selected.
function SaleDetail({ s, onClose, onFlash }) {
  const P = useP();
  const money = window.HW.fmt.money;
  const lines = SALES_LINES[s.id] || [['Sale item', s.items, s.total]];
  const [mode, setMode] = React.useState('receipt');
  const [ret, setRet] = React.useState({});
  const [reason, setReason] = React.useState('');
  const sub = lines.reduce((a, l) => a + l[2], 0);
  const taxes = SALES_TAX.map(([label, rate]) => [label, +(sub * rate).toFixed(2)]);
  const total = +(sub + taxes.reduce((a, t) => a + t[1], 0)).toFixed(2);
  const retQty = (i) => ret[i] || 0;
  const setQ = (i, q) => setRet((r) => ({ ...r, [i]: Math.max(0, Math.min(lines[i][1], q)) }));
  const retSub = lines.reduce((a, l, i) => a + l[2] / l[1] * retQty(i), 0);
  const retTotal = +(retSub * (1 + SALES_TAX.reduce((a, t) => a + t[1], 0))).toFixed(2);
  const anyRet = Object.keys(ret).some((k) => ret[k] > 0);
  const REASONS = ['Defective product', 'Wrong item', 'Customer changed mind', 'Damaged packaging', 'Other'];
  const rowStyle = { display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: P.ink2 };

  return <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: P.scrim, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
    <div onClick={(e) => e.stopPropagation()} data-tour="sale-detail" style={{ width: 'min(470px,96%)', maxHeight: '88%', display: 'flex', flexDirection: 'column', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: `1px solid ${P.hairline}` }}>
        <Avatar name={s.name} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>{s.name}</div>
          <div style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{s.id} · {salesDateLabel(s)} · {s.tender}</div>
        </div>
        <IconBtn icon="x" size={16} onClick={onClose} />
      </div>
      <div style={{ display: 'flex', gap: 3, padding: 3, margin: '12px 18px 0', background: P.surface3, borderRadius: P.r10 }}>
        {[['receipt', 'Receipt'], ['return', 'Start a return']].map(([k, label]) => {
          const a = mode === k;
          return <button key={k} onClick={() => setMode(k)} style={{ flex: 1, padding: '7px 8px', background: a ? P.surface : 'transparent', border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: P.fontSans, fontSize: 12.5, fontWeight: 700, color: a ? P.ink : P.inkDim, boxShadow: a ? P.shadowSm : 'none' }}>{label}</button>;
        })}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 18px 18px' }}>
        {mode === 'receipt' ? <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {lines.map((l, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 22, height: 22, borderRadius: 6, background: P.surface3, color: P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 700, fontFamily: P.fontMono, flex: '0 0 auto' }}>{l[1]}</span>
              <span style={{ flex: 1, fontSize: 12.5, color: P.ink, minWidth: 0 }}>{l[0]}</span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, fontFamily: P.fontMono }}>{money(l[2])}</span>
            </div>)}
          </div>
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${P.hairline}`, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={rowStyle}><span>Sub-total</span><span style={{ fontFamily: P.fontMono }}>{money(sub)}</span></div>
            {taxes.map(([label, amt]) => <div key={label} style={rowStyle}><span>{label}</span><span style={{ fontFamily: P.fontMono }}>{money(amt)}</span></div>)}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, paddingTop: 8, borderTop: `1px solid ${P.hairline}`, fontSize: 15, fontWeight: 800, color: P.ink }}><span>Total</span><span style={{ fontFamily: P.fontMono }}>{money(total)}</span></div>
            <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 3 }}>Paid by {s.tender.toLowerCase()} · rung up by {s.by}</div>
          </div>
        </> : <>
          <div style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.5, marginBottom: 10 }}>Choose how many of each line is coming back. Returning every line refunds the whole sale.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {lines.map((l, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', background: retQty(i) ? P.surface3 : P.surface2, border: `1px solid ${retQty(i) ? P.ink : P.hairline2}`, borderRadius: P.r10 }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 12.5, color: P.ink, fontWeight: 600 }}>{l[0]}</span>
                <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{l[1]} sold · {money(l[2] / l[1])} each</span>
              </span>
              <Stepper value={retQty(i)} onChange={(v) => setQ(i, v)} size="sm" />
            </div>)}
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 6 }}>Reason</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{REASONS.map((r) => {
              const on = reason === r;
              return <button key={r} onClick={() => setReason(r)} style={{ padding: '5px 10px', borderRadius: 99, border: `1px solid ${on ? P.ink : P.hairline2}`, background: on ? P.ink : 'transparent', color: on ? P.surface : P.ink2, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}>{r}</button>;
            })}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, paddingTop: 10, borderTop: `1px solid ${P.hairline}`, fontSize: 15, fontWeight: 800, color: anyRet ? P.ink : P.inkMute }}><span>Refund</span><span style={{ fontFamily: P.fontMono }}>{money(retTotal)}</span></div>
          <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 3 }}>Back to {s.tender.toLowerCase()} · tax refunded with the item</div>
        </>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: `1px solid ${P.hairline}` }}>
        <PBtn variant="secondary" size="md" onClick={onClose}>Close</PBtn>
        {mode === 'receipt'
          ? <PBtn variant="accent" size="md" icon="printer" onClick={() => { onFlash(`Receipt ${s.id} sent to the printer`); onClose(); }}>Reprint receipt</PBtn>
          : <PBtn variant="accent" size="md" icon="refresh" onClick={() => { if (!anyRet || !reason) return; onFlash(`${money(retTotal)} refunded on ${s.id} · ${reason}`); onClose(); }} style={{ opacity: anyRet && reason ? 1 : .5 }}>Refund {money(retTotal)}</PBtn>}
      </div>
    </div>
  </div>;
}

window.OpenTickets = function OpenTickets() {
  const P = useP();
  const money = window.HW.fmt.money;
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState('held');
  const [q, setQ] = React.useState('');
  const [range, setRange] = React.useState('today');
  const [tender, setTender] = React.useState('All');
  const [staff, setStaff] = React.useState('All');
  const [detail, setDetail] = React.useState(null);
  const [flash, setFlash] = React.useState('');
  React.useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(''), 2600); return () => clearTimeout(t); }, [flash]);

  const staffList = ['All'].concat(Array.from(new Set(SALES_DONE.map((s) => s.by))));
  const done = SALES_DONE.filter((s) => {
    if (tender !== 'All' && s.tender !== tender) return false;
    if (staff !== 'All' && s.by !== staff) return false;
    const d = salesDaysAgo(s.date);
    if (range === 'today' && d > 0) return false;
    if (range === '7' && d > 7) return false;
    if (range === '30' && d > 30) return false;
    return salesMatch(s, q);
  });
  const rows = tab === 'held' ? SALES_HELD : done;
  const tabs = [['held', 'On hold', SALES_HELD.length], ['done', 'Completed', SALES_DONE.length]];
  const filtered = tab === 'done' && (q || range !== 'today' || tender !== 'All' || staff !== 'All');
  const reset = () => { setQ(''); setRange('today'); setTender('All'); setStaff('All'); };
  const sum = done.reduce((a, s) => a + saleTotal(s), 0);

  const chip = (on, label, onClick, key) => <button key={key} onClick={onClick} style={{ padding: '4px 9px', borderRadius: 99, border: `1px solid ${on ? P.ink : P.hairline2}`, background: on ? P.ink : 'transparent', color: on ? P.surface : P.ink2, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: P.fontSans, whiteSpace: 'nowrap' }}>{label}</button>;

  return <div style={{ position: 'relative' }}>
    <IconBtn icon="receipt" badge={String(SALES_HELD.length)} badgeColor={P.warn} title={`Sales — ${SALES_HELD.length} on hold · look up any completed sale`} onClick={() => setOpen((o) => !o)} data-tour="sales-panel" />
    {flash && <div style={{ position: 'fixed', bottom: 22, left: '50%', transform: 'translateX(-50%)', padding: '10px 16px', background: P.ink, color: P.surface, borderRadius: 99, fontSize: 12.5, fontWeight: 600, boxShadow: P.shadowLg, zIndex: 600, whiteSpace: 'nowrap' }}>{flash}</div>}
    {detail && <SaleDetail s={detail} onClose={() => setDetail(null)} onFlash={setFlash} />}
    {open && <>
      <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 400 }} />
      <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: tab === 'done' ? 384 : 330, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r14, boxShadow: P.shadowLg, padding: 12, zIndex: 401 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Icon name="receipt" size={15} stroke={1.9} color={P.ink2} />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Sales</span>
          <div style={{ flex: 1 }} />
          {tab === 'done' && filtered && <button onClick={reset} style={{ fontSize: 11.5, fontWeight: 700, color: P.ink2, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: P.fontSans, textDecoration: 'underline' }}>Reset</button>}
        </div>
        <div style={{ display: 'flex', gap: 3, padding: 3, background: P.surface3, borderRadius: P.r10, marginBottom: 10 }}>
          {tabs.map(([k, label, n]) => {
            const a = tab === k;
            return <button key={k} onClick={() => setTab(k)} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '6px 8px', background: a ? P.surface : 'transparent', border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: P.fontSans, fontSize: 11.5, fontWeight: 700, color: a ? P.ink : P.inkDim, boxShadow: a ? P.shadowSm : 'none' }}>
              {label}<span style={{ fontFamily: P.fontMono, fontSize: 10, fontWeight: 700, color: a ? (k === 'held' ? P.warn : P.good) : P.inkMute }}>{n}</span>
            </button>;
          })}
        </div>

        {tab === 'done' && <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 10 }}>
          <Field icon="search" size="sm" placeholder="Name, phone, email or order #" value={q} onChange={(e) => setQ(e.target.value)} />
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{SALES_RANGES.map(([k, label]) => chip(range === k, label, () => setRange(k), k))}</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute, marginRight: 1 }}>Tender</span>
            {SALES_TENDERS.map((t) => chip(tender === t, t, () => setTender(t), t))}
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute, marginRight: 1 }}>Staff</span>
            {staffList.map((s) => chip(staff === s, s === 'All' ? 'Anyone' : s.split(' ')[0], () => setStaff(s), s))}
          </div>
        </div>}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.45, flex: 1 }}>{tab === 'held'
            ? 'Carts parked mid-sale so the register could be used for someone else. Resuming one loads it back with its customer and party.'
            : `${rows.length} sale${rows.length === 1 ? '' : 's'}${filtered ? ' matching' : ' today'} · ${money(sum)}`}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
          {rows.map((s) => <SalesRow key={s.id} s={s} tab={tab} onPick={() => {
            setOpen(false);
            if (tab === 'done') setDetail(s);
            else setFlash(`Cart ${s.id} resumed · ${s.name}`);
          }} />)}
          {rows.length === 0 && <div style={{ textAlign: 'center', padding: '22px 12px' }}>
            <Icon name="search" size={20} stroke={1.7} color={P.inkFaint} />
            <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink2, marginTop: 7 }}>No sales found</div>
            <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 3, lineHeight: 1.45 }}>Try widening the date range to <b>Any date</b>, or search by the phone number on the account.</div>
          </div>}
        </div>
      </div>
    </>}
  </div>;
};
