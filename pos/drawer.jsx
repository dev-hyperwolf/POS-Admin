// ── Cash-drawer: global header controls + open-drawer overlay ──────────────
const useP = window.useP;

// Header cluster — manual "open register" + persistent "last receipt"
window.DrawerControls = function DrawerControls() {
  const P = useP();
  const POS = window.usePOS();
  const last = POS.getLastSale();
  const [open, setOpen] = React.useState(false);
  const sess = POS.getSession();
  const [modal, setModal] = React.useState(null);
  const money = window.HW.fmt.money;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {/* register session — open (count-in) / close (count-out) */}
      {sess.open ?
      <button onClick={() => setModal('close')} title="Register open — click to close out"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 12px', background: P.goodSoft, border: `1px solid ${P.good}`, borderRadius: P.r10, color: P.good, cursor: 'pointer', fontFamily: P.fontSans, fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
        <span style={{ width: 7, height: 7, borderRadius: 99, background: P.good }} />Register open<span style={{ color: P.ink2, fontFamily: P.fontMono, fontWeight: 600 }}>{money(sess.float)}</span>
      </button> :
      <button onClick={() => setModal('open')} title="Open register (count the starting cash balance)"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 12px', background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, color: P.ink2, cursor: 'pointer', fontFamily: P.fontSans, fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>
        <Icon name="cash" size={16} stroke={1.9} />Open register
      </button>}

      {/* last receipt — reprint / email / print */}
      <div style={{ position: 'relative' }}>
        <button onClick={() => last && setOpen((o) => !o)} disabled={!last} title={last ? 'Last receipt' : 'No sales yet'}
        style={{ width: 38, height: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: open ? P.surface3 : 'transparent', border: 'none', borderRadius: P.r10, color: last ? P.ink2 : P.inkFaint, cursor: last ? 'pointer' : 'not-allowed' }}>
          <Icon name="receipt" size={18} stroke={1.8} />
        </button>
        {open && last && <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 296, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r14, boxShadow: P.shadowLg, padding: 14, zIndex: 41 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Icon name="receipt" size={15} stroke={1.9} color={P.ink2} />
              <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Last receipt</span>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{last.id}</span>
            </div>
            <div style={{ background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10, padding: '10px 12px', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}><span style={{ color: P.inkDim }}>{last.name} · {last.items} items</span><span style={{ fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{money(last.collected)}</span></div>
              <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{last.method === 'cash' ? 'Cash' : last.method === 'card' ? 'Card' : 'Split'}{last.cardCharged > 0 ? ` · card ${money(last.cardCharged)}` : ''}{last.change > 0 ? ` · change ${money(last.change)}` : ''}</div>
            </div>
            <window.ReceiptActions sale={last} compact />
          </div>
        </>}
      </div>
      {modal === 'open' && <OpenRegisterModal onClose={() => setModal(null)} />}
      {modal === 'close' && <CloseRegisterModal onClose={() => setModal(null)} />}
    </div>);

};

// Global overlay — visible whenever the physical drawer is (or was just) popped
window.CashDrawerOverlay = function CashDrawerOverlay() {
  const P = useP();
  const POS = window.usePOS();
  const d = POS.getDrawer();
  if (!d.open) return null;
  return (
    <div style={{ position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', zIndex: 90, display: 'flex', alignItems: 'center', gap: 13, padding: '12px 16px', background: P.ink, color: '#fff', borderRadius: P.r14, boxShadow: P.shadowLg, animation: 'fade .18s ease', maxWidth: 'calc(100vw - 40px)' }}>
      <span style={{ width: 34, height: 34, borderRadius: 9, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="cash" size={18} stroke={2} /></span>
      <div style={{ lineHeight: 1.25 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>Cash drawer open</div>
        <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.6)', fontFamily: P.fontMono }}>{d.reason} · close the drawer to continue</div>
      </div>
      <button onClick={() => window.POS.closeDrawer()} style={{ marginLeft: 6, padding: '7px 13px', background: 'rgba(255,255,255,.12)', color: '#fff', border: 'none', borderRadius: P.r999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: P.fontSans, whiteSpace: 'nowrap' }}>Drawer closed</button>
    </div>);

};

// ── Cash-count grid + open/close register modals ───────────────────────────
const DENOMS = [['$100', 100], ['$50', 50], ['$20', 20], ['$10', 10], ['$5', 5], ['$1', 1], ['25¢', 0.25], ['10¢', 0.1], ['5¢', 0.05], ['1¢', 0.01]];
function countTotal(counts) {return +DENOMS.reduce((a, [, d]) => a + (counts[d] || 0) * d, 0).toFixed(2);}
function CountGrid({ counts, setCounts }) {
  const P = useP();const money = window.HW.fmt.money;
  const set = (d, v) => setCounts({ ...counts, [d]: Math.max(0, parseInt(v || 0, 10) || 0) });
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
    {DENOMS.map(([lbl, d]) => {const q = counts[d] || 0;return <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}>
      <span style={{ width: 38, fontSize: 12.5, fontWeight: 700, color: P.ink2, fontFamily: P.fontMono }}>{lbl}</span>
      <span style={{ color: P.inkFaint, fontSize: 12.5 }}>×</span>
      <input value={q || ''} onChange={(e) => set(d, e.target.value)} inputMode="numeric" placeholder="0" style={{ width: 44, padding: '5px 7px', border: `1px solid ${P.hairline2}`, borderRadius: 7, background: P.surface, color: P.ink, fontSize: 12.5, fontFamily: P.fontMono, outline: 'none', textAlign: 'center' }} />
      <span style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 600, color: q ? P.ink : P.inkFaint, fontFamily: P.fontMono }}>{money(q * d)}</span>
    </div>;})}
  </div>;
}
function RegModal({ title, sub, icon, children, footer, onClose }) {
  const P = useP();
  return <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 95, background: P.scrim, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '44px 20px', overflowY: 'auto', animation: 'fade .15s ease' }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(460px,96vw)', background: P.surface, borderRadius: P.r20, boxShadow: P.shadowLg, border: `1px solid ${P.hairline2}`, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '15px 18px', borderBottom: `1px solid ${P.hairline}` }}>
        <span style={{ width: 32, height: 32, borderRadius: 9, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={icon || 'cash'} size={17} stroke={1.9} /></span>
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 15, fontWeight: 700, color: P.ink }}>{title}</div>{sub && <div style={{ fontSize: 11.5, color: P.inkDim }}>{sub}</div>}</div>
        <IconBtn icon="x" size={17} onClick={onClose} />
      </div>
      <div style={{ padding: 18 }}>{children}</div>
      <div style={{ display: 'flex', gap: 9, padding: '0 18px 18px' }}>{footer}</div>
    </div>
  </div>;
}
function OpenRegisterModal({ onClose }) {
  const P = useP();const money = window.HW.fmt.money;
  const POS = window.usePOS();
  const required = POS.getRequiredFloat();
  const [counts, setCounts] = React.useState({});
  const total = countTotal(counts);
  const started = Object.keys(counts).some((d) => counts[d] > 0);
  const diff = +(total - required).toFixed(2);
  const matches = Math.abs(diff) < 0.005;
  const c = !started ? P.inkMute : matches ? P.good : diff < 0 ? P.bad : P.warn;
  return <RegModal title="Open register" sub={`Count the drawer to ${money(required)} to open`} icon="cash" onClose={onClose}
  footer={<><PBtn variant="accent" size="md" icon="check" full disabled={!started} onClick={() => {window.POS.openRegister(total);onClose();}}>{matches ? 'Open register · ' + money(total) : started ? 'Open anyway · ' + (diff < 0 ? 'short ' : 'over ') + money(Math.abs(diff)) : 'Count the drawer'}</PBtn><PBtn variant="secondary" size="md" onClick={onClose}>Cancel</PBtn></>}>
    {/* The store sets the number; the associate's job is to make the drawer
        match it. Showing the target first means they are counting TO a figure
        rather than typing whatever happens to be in the till. */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: P.accentSoft, border: `1px solid ${P.accentBorder}`, borderRadius: P.r12, marginBottom: 13 }}>
      <span style={{ width: 34, height: 34, borderRadius: 9, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="cash" size={17} stroke={2} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: P.accentText }}>Every drawer in this store starts with</div>
        <div style={{ fontSize: 21, fontWeight: 800, color: P.ink, fontFamily: P.fontMono, lineHeight: 1.15 }}>{money(required)}</div>
      </div>
      <span style={{ fontSize: 11.5, color: P.inkDim, textAlign: 'right', lineHeight: 1.4, flex: '0 0 auto', maxWidth: 128 }}>Set by a manager in Settings → Cash Drawer</span>
    </div>
    <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 8 }}>Count what is in the drawer</div>
    <CountGrid counts={counts} setCounts={setCounts} />
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, padding: '11px 13px', background: P.ink, color: '#fff', borderRadius: P.r12 }}>
      <div><div style={{ fontSize: 12.5, fontWeight: 600 }}>Counted {money(total)}</div><div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.6)', fontFamily: P.fontMono }}>required {money(required)}</div></div>
      {started ?
        <span style={{ fontSize: 15, fontWeight: 800, fontFamily: P.fontMono, color: matches ? '#8FE3B0' : diff < 0 ? '#FF9B8F' : '#FFD98F' }}>{matches ? 'match' : (diff > 0 ? '+' : '') + money(diff)}</span> :
        <span style={{ fontSize: 12.5, fontWeight: 600, fontFamily: P.fontMono, color: 'rgba(255,255,255,.45)' }}>not counted</span>}
    </div>
    <div style={{ fontSize: 11.5, color: c, fontWeight: 600, marginTop: 8, textAlign: 'center' }}>
      {!started ? 'Enter the notes and coins in the drawer to verify against ' + money(required) :
        matches ? 'Verified — the drawer matches the required starting balance' :
        diff < 0 ? 'Short by ' + money(Math.abs(diff)) + ' — add cash or flag a manager before opening' :
        'Over by ' + money(diff) + ' — remove the excess or flag a manager before opening'}
    </div>
  </RegModal>;
}
function CloseRegisterModal({ onClose }) {
  const P = useP();const money = window.HW.fmt.money;
  const sess = window.POS.getSession();
  const cashSales = sess.cashSales || 0;
  const expected = +((sess.float || 0) + cashSales).toFixed(2);
  const [counts, setCounts] = React.useState({});
  const counted = countTotal(counts);
  // Nothing has been counted yet ⇒ there is no variance to report. Showing
  // −(expected) before a single note is entered reads as a huge shortage the
  // second you open the modal, which is what it used to do.
  const started = Object.keys(counts).some((d) => counts[d] > 0);
  const variance = +(counted - expected).toFixed(2);
  const vc = !started ? P.inkMute : variance === 0 ? P.good : Math.abs(variance) < 5 ? P.warn : P.bad;
  return <RegModal title="Close register" sub="Count the drawer to reconcile" icon="cash" onClose={onClose}
  footer={<><PBtn variant="accent" size="md" icon="check" full disabled={counted <= 0} onClick={() => {window.POS.closeRegister(counted);onClose();}}>Close &amp; reconcile</PBtn><PBtn variant="secondary" size="md" onClick={onClose}>Cancel</PBtn></>}>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
      {[['Starting cash balance', money(sess.float || 0)], ['Cash sales', money(cashSales)], ['Expected in drawer', money(expected)]].map(([k, v], i) => <div key={k} style={{ gridColumn: i === 2 ? '1/-1' : 'auto', display: 'flex', justifyContent: 'space-between', padding: '9px 12px', background: i === 2 ? P.surface3 : P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}><span style={{ fontSize: 11.5, color: P.inkDim }}>{k}</span><span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{v}</span></div>)}
    </div>
    <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 8 }}>Counted</div>
    <CountGrid counts={counts} setCounts={setCounts} />
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, padding: '11px 13px', background: P.ink, color: '#fff', borderRadius: P.r12 }}>
      <div><div style={{ fontSize: 12.5, fontWeight: 600 }}>Counted {money(counted)}</div><div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.6)', fontFamily: P.fontMono }}>expected {money(expected)}</div></div>
      {started ?
        <span style={{ fontSize: 15, fontWeight: 800, fontFamily: P.fontMono, color: variance >= 0 ? '#8FE3B0' : '#FF9B8F' }}>{variance > 0 ? '+' : ''}{money(variance)}</span> :
        <span style={{ fontSize: 12.5, fontWeight: 600, fontFamily: P.fontMono, color: 'rgba(255,255,255,.45)' }}>not counted</span>}
    </div>
    <div style={{ fontSize: 11.5, color: vc, fontWeight: 600, marginTop: 8, textAlign: 'center' }}>{!started ? 'Enter the counted notes and coins above to see the variance' : variance === 0 ? 'Balanced — no variance' : variance > 0 ? 'Over by ' + money(Math.abs(variance)) : 'Short by ' + money(Math.abs(variance))}</div>
  </RegModal>;
}

Object.assign(window, {});