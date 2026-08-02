// ── Cart pane + Payment modal ──────────────────────────────────────────────
const useP = window.useP;

window.CartPane = function CartPane({ P, lines, sub, tax, total, count, pay, setPay, setQty, remove, setCart, customer, cartSkus, onAdd, discMode, setDiscMode, tab, setTab, onPay }) {
  const walletAmt = customer?.wallet || 0;
  const [discView, setDiscView] = React.useState('compact'); // compact | inline | stacked
  const goal = window.HW.STATS.associate.goal;
  const gap = Math.max(0, goal - total);
  const goalPct = goal > 0 ? Math.min(1, total / goal) : 0;
  const recs = window.HW.upsell(cartSkus || [], customer).slice(0, 4);

  const payMethods = [
  ['cash', 'Cash', 'cash', null],
  ['card', 'Credit Card', 'card', null],
  ['wallet', 'Wallet', 'wallet', walletAmt],
  ['split', 'Split', 'split', null]];


  return (
    <div style={{ flex: '0 0 408px', width: 408, display: 'flex', flexDirection: 'column', background: P.surface2, minHeight: 0 }}>
      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px 16px' }}>
        {count === 0 ?
        <div style={{ padding: '60px 16px', textAlign: 'center', color: P.inkMute }}>
            <span style={{ display: 'inline-flex', width: 52, height: 52, borderRadius: 99, background: P.surface3, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><Icon name="cart" size={24} stroke={1.6} /></span>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: P.ink2 }}>Cart is empty</div>
            <div style={{ fontSize: 12, marginTop: 3 }}>Add products to start a sale</div>
          </div> :
        <>
          {/* Cart lines */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Eyebrow>{count} item{count > 1 ? 's' : ''}</Eyebrow>
              <button onClick={() => setCart([])} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: P.inkDim, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}><Icon name="x" size={12} stroke={2} />Clear</button>
            </div>
            {lines.map((l) =>
            <div key={l.sku} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', background: P.surface, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}>
                <Thumb item={l.p} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.p.name}</div>
                  <div style={{ fontSize: 10.5, color: P.inkMute, fontFamily: P.fontMono }}>{window.HW.fmt.money0(l.p.price)}{l.p.was && <span style={{ textDecoration: 'line-through', marginLeft: 5, color: P.inkFaint }}>{window.HW.fmt.money0(l.p.was)}</span>}</div>
                </div>
                <Stepper value={l.qty} onChange={(v) => setQty(l.sku, v)} size="sm" />
                <div style={{ width: 54, textAlign: 'right', fontSize: 13, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{window.HW.fmt.money(l.total)}</div>
                <IconBtn icon="trash" size={14} style={{ width: 28, height: 28 }} onClick={() => remove(l.sku)} />
              </div>
            )}
          </div>

          {/* AOV booster — goal meter + recommended up-sells (comment 8) */}
          <AovBooster P={P} total={total} goal={goal} gap={gap} goalPct={goalPct} recs={recs} onAdd={onAdd} />

          {/* Discount + promo — compact with layout options (comment 3) */}
          <DiscountCard P={P} discMode={discMode} setDiscMode={setDiscMode} view={discView} setView={setDiscView} subtotal={sub} />

          {/* Rewards — placed right by the payment types (comment: move rewards near payment) */}
          <RewardsCard P={P} customer={customer} />
        </>}
      </div>

      {/* Totals + tender (sticky footer) — committed to the detailed view, height minimized */}
      {count > 0 &&
      <div style={{ flex: '0 0 auto', padding: '9px 18px 11px', borderTop: `1px solid ${P.hairline2}`, background: P.surface }}>
          {/* Original layout, unchanged: totals column + 52px vertical TENDER
              column on the right. The only fix is the word itself — it used to
              be six stacked per-letter spans, which ran past the button once
              the tax rows made the column taller. writing-mode renders it along
              the column so it fits whatever height the totals produce. */}
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 11 }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3, fontSize: 11.5 }}>
              <Row P={P} k="Sub-total" v={window.HW.fmt.money(sub)} />
              {window.HW.taxBreakdown(sub).lines.map((t) => <Row key={t.k} P={P} k={t.k} v={window.HW.fmt.money(t.v)} />)}
              <Row P={P} k="Items" v={count} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 2, paddingTop: 5, borderTop: `1px dashed ${P.hairline2}` }}><span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Total</span><span style={{ fontSize: 19, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{window.HW.fmt.money(total)}</span></div>
            </div>
            <button onClick={onPay} title={`Tender · ${window.HW.fmt.money(total)}`} style={{ flex: '0 0 auto', width: 52, alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'center', background: P.accent, color: P.accentInk, border: 'none', borderRadius: P.r12, cursor: 'pointer', fontFamily: P.fontSans, padding: '10px 4px', overflow: 'hidden' }}>
              <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 13, fontWeight: 800, letterSpacing: '.16em', whiteSpace: 'nowrap' }}>TENDER</span>
            </button>
          </div>
        </div>
      }
    </div>);

};

// Loyalty rewards — points + redeem, with 3 alternative layouts (comment: 3 alternatives)
function RewardsCard({ P, customer }) {
  const [redeemed, setRedeemed] = React.useState(null);
  const [view, setView] = React.useState('progress'); // progress | inline | tiers
  const rewards = window.HW.REWARDS;
  const pts = customer?.points || 0;
  const next = rewards.find((r) => r.cost > pts);
  const pct = next ? Math.min(1, pts / next.cost) : 1;
  const goldInk = P.mode === 'light' ? '#7A5A00' : P.accent;
  const tier = pts >= 2000 ? 'Platinum' : pts >= 1000 ? 'Gold' : pts >= 300 ? 'Silver' : 'Bronze';
  const tierColor = tier === 'Platinum' ? P.info : tier === 'Gold' ? goldInk : tier === 'Silver' ? P.neutral : P.warn;
  const doRedeem = (id) => setRedeemed((r) => r === id ? null : id);

  if (!customer) {
    return (
      <Card padding={12} style={{ marginBottom: 12, background: P.surface }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ width: 22, height: 22, borderRadius: 6, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="star" size={13} stroke={1.9} /></span>
          <Eyebrow>Rewards</Eyebrow>
        </div>
        <div style={{ fontSize: 11.5, color: P.inkMute }}>Check in a member to view points &amp; redeem rewards.</div>
      </Card>);
  }

  return (
    <Card padding={10} style={{ marginBottom: 12, background: P.surface }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ width: 22, height: 22, borderRadius: 6, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="star" size={13} stroke={1.9} /></span>
        <Eyebrow>Rewards</Eyebrow>
        <div style={{ flex: 1 }} />
        <Seg value={view} onChange={setView} size="sm" options={[{ value: 'progress', label: 'Progress' }, { value: 'inline', label: 'Inline' }, { value: 'tiers', label: 'Tiers' }]} />
      </div>

      {/* ALT 1 — Progress: points + bar to next + reward chips */}
      {view === 'progress' &&
      <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: P.ink, fontFamily: P.fontMono, letterSpacing: '-.01em' }}>{pts.toLocaleString()}</span>
            <span style={{ fontSize: 10, color: P.inkMute, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' }}>pts</span>
            <div style={{ flex: 1 }} />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: tierColor }}><Icon name="crown" size={11} color={tierColor} />{tier.toUpperCase()}</span>
          </div>
          {next ?
        <div style={{ marginBottom: 8 }}>
              <BarMeter value={pct} color={P.accent} height={5} />
              <div style={{ fontSize: 10.5, color: P.inkDim, marginTop: 4, fontFamily: P.fontMono }}>{(next.cost - pts).toLocaleString()} pts to <b style={{ color: P.ink2 }}>{next.label}</b></div>
            </div> :
        <div style={{ fontSize: 11, color: P.good, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="check-circle" size={13} stroke={2} />Top reward tier unlocked</div>}
          <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 2 }}>
            {rewards.map((r) => {
            const can = pts >= r.cost;const isR = redeemed === r.id;
            return (
              <button key={r.id} disabled={!can} onClick={() => doRedeem(r.id)} style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: isR ? P.accent : can ? P.surface : P.surface2, color: isR ? P.accentInk : can ? P.ink2 : P.inkFaint, border: `1px solid ${isR ? P.accentBorder : P.hairline2}`, borderRadius: P.r999, fontSize: 12, fontWeight: 600, cursor: can ? 'pointer' : 'not-allowed', opacity: can ? 1 : .6, fontFamily: P.fontSans, whiteSpace: 'nowrap' }}>
                  <Icon name={isR ? 'check' : r.icon} size={13} stroke={1.9} />{r.label}<span style={{ fontSize: 10, fontFamily: P.fontMono, opacity: .75 }}>{isR ? 'redeemed' : `${r.cost} pts`}</span>
                </button>);
          })}
          </div>
        </>}

      {/* ALT 2 — Inline: one row, points + next hint + Redeem dropdown */}
      {view === 'inline' &&
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flex: '0 0 auto' }}>
            <span style={{ fontSize: 19, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{pts.toLocaleString()}</span>
            <span style={{ fontSize: 9.5, color: P.inkMute, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' }}>pts</span>
          </div>
          <div style={{ flex: 1, minWidth: 0, fontSize: 11, color: P.inkDim, fontFamily: P.fontMono, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{next ? `${(next.cost - pts).toLocaleString()} pts → ${next.label}` : 'Top tier unlocked'}</div>
          <RedeemMenu P={P} rewards={rewards} pts={pts} onRedeem={doRedeem} />
        </div>}

      {/* ALT 3 — Tiers: visual reward coins with lock state */}
      {view === 'tiers' &&
      <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 7 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: tierColor }}><Icon name="crown" size={12} color={tierColor} />{tier}</span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{pts.toLocaleString()} <span style={{ fontSize: 9.5, color: P.inkMute, fontWeight: 600 }}>PTS</span></span>
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
            {rewards.map((r) => {
            const can = pts >= r.cost;const isR = redeemed === r.id;
            return (
              <button key={r.id} disabled={!can} onClick={() => doRedeem(r.id)} style={{ flex: '0 0 auto', width: 72, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '7px 6px', background: isR ? P.accentSoft : P.surface, border: `1px solid ${isR ? P.accentBorder : can ? P.hairline2 : P.hairline}`, borderRadius: P.r12, cursor: can ? 'pointer' : 'not-allowed', opacity: can ? 1 : .55, fontFamily: P.fontSans }}>
                  <span style={{ width: 28, height: 28, borderRadius: 99, background: can ? P.accent : P.surface3, color: can ? P.accentInk : P.inkMute, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={isR ? 'check' : can ? r.icon : 'lock'} size={15} stroke={1.9} /></span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: P.ink, textAlign: 'center', lineHeight: 1.2 }}>{r.label}</span>
                  <span style={{ fontSize: 9.5, fontFamily: P.fontMono, color: can ? goldInk : P.inkFaint }}>{r.cost}</span>
                </button>);
          })}
          </div>
        </>}

      {redeemed &&
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 11, color: goldInk, fontWeight: 600 }}>
          <Icon name="gift" size={13} stroke={1.9} />{rewards.find((r) => r.id === redeemed).label} applied · {rewards.find((r) => r.id === redeemed).cost} pts redeemed
        </div>}
    </Card>);
}

// Redeem dropdown (used by the Inline rewards alternative)
function RedeemMenu({ P, rewards, pts, onRedeem }) {
  const [open, setOpen] = React.useState(false);
  const goldInk = P.mode === 'light' ? '#7A5A00' : P.accent;
  return (
    <div style={{ position: 'relative', flex: '0 0 auto' }}>
      <button onClick={() => setOpen((o) => !o)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: P.accent, color: P.accentInk, border: 'none', borderRadius: P.r999, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: P.fontSans }}>
        <Icon name="gift" size={13} stroke={2} />Redeem<Icon name="chevron-down" size={12} stroke={2.4} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>
      {open && <>
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 50 }} />
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 208, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, boxShadow: P.shadowLg, padding: 6, zIndex: 51 }}>
          {rewards.map((r) => {
            const can = pts >= r.cost;
            return (
              <button key={r.id} disabled={!can} onClick={() => {onRedeem(r.id);setOpen(false);}} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 9px', background: 'transparent', border: 'none', borderRadius: 8, cursor: can ? 'pointer' : 'not-allowed', opacity: can ? 1 : .5, textAlign: 'left', fontFamily: P.fontSans }}>
                <Icon name={can ? r.icon : 'lock'} size={14} stroke={1.9} color={P.ink2} />
                <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: P.ink }}>{r.label}</span>
                <span style={{ fontSize: 10.5, fontFamily: P.fontMono, color: can ? goldInk : P.inkFaint }}>{r.cost}</span>
              </button>);
          })}
        </div>
      </>}
    </div>);
}

// ── Manager approval for a manual discount ─────────────────────────────────
// A hand-typed discount is money leaving the till, so it never applies on the
// associate's say-so. It requires a named manager, their PIN, and a reason —
// and the whole thing is written to the audit log with the amount attached.
const DISC_REASONS = [
  { k: 'price-match', label: 'Price match', d: 'Matching a competitor or our own advertised price.' },
  { k: 'damaged', label: 'Damaged packaging', d: 'Product is sellable but the packaging is not perfect.' },
  { k: 'service', label: 'Service recovery', d: 'Making good on a bad order, a long wait or a missed delivery.' },
  { k: 'expiring', label: 'Near expiry', d: 'Moving stock that is close to its date.' },
  { k: 'employee', label: 'Employee / friends & family', d: 'Staff purchase at the approved rate.' },
  { k: 'other', label: 'Other', d: 'Anything else — a note is required.' }];
const MANAGERS = ['Manisha Saini', 'Carla Mendes', 'Devon Pierce'];

function DiscountApprovalModal({ P, amount, mode, subtotal, onClose, onApprove }) {
  const money = window.HW.fmt.money;
  const [mgr, setMgr] = React.useState('');
  const [pin, setPin] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [note, setNote] = React.useState('');
  const [err, setErr] = React.useState('');
  const amt = parseFloat(amount) || 0;
  const off = mode === '%' ? subtotal * (amt / 100) : amt;
  const pctOff = subtotal > 0 ? off / subtotal * 100 : 0;
  const steep = pctOff >= 25;
  const needNote = reason === 'other';
  const ok = mgr && pin.length >= 4 && reason && (!needNote || note.trim().length > 2);
  const submit = () => {
    if (!ok) return;
    if (pin !== '1234' && pin.length < 4) { setErr('PIN must be at least 4 digits'); return; }
    onApprove({ mgr, reason, note: note.trim(), off });
    onClose();
  };
  const lbl = { fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 6 };
  return <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 210, background: P.scrim, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(520px,96vw)', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, overflow: 'hidden' }} data-tour="disc-approval">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '15px 20px', borderBottom: `1px solid ${P.hairline}` }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: steep ? P.badSoft : P.warnSoft, color: steep ? P.bad : P.warn, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="lock" size={16} stroke={2} /></span>
        <div style={{ flex: 1 }}><div style={{ fontSize: 14.5, fontWeight: 700, color: P.ink }}>Manager approval required</div><div style={{ fontSize: 11, color: P.inkDim }}>Manual discounts are never applied without a sign-off</div></div>
        <IconBtn icon="x" size={16} onClick={onClose} />
      </div>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: steep ? P.badSoft : P.surface2, border: `1px solid ${steep ? P.bad : P.hairline}`, borderRadius: P.r12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>Discount requested</div>
            <div style={{ fontSize: 21, fontWeight: 800, color: steep ? P.bad : P.ink, fontFamily: P.fontMono, marginTop: 2 }}>−{money(off)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: P.inkDim, fontFamily: P.fontMono }}>{pctOff.toFixed(1)}% of {money(subtotal)}</div>
            <div style={{ fontSize: 11, color: P.inkDim, fontFamily: P.fontMono }}>new subtotal {money(Math.max(0, subtotal - off))}</div>
          </div>
        </div>
        {steep && <div style={{ display: 'flex', gap: 8, padding: '10px 12px', background: P.badSoft, borderRadius: P.r10 }}>
          <Icon name="shield" size={14} color={P.bad} style={{ flex: '0 0 auto', marginTop: 1 }} />
          <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>This is <b style={{ color: P.bad }}>{pctOff.toFixed(0)}% off</b> — steep enough that it will be flagged in the daily discount report.</span>
        </div>}
        <div>
          <div style={lbl}>Approving manager</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {MANAGERS.map((m) => {const on = mgr === m;
              return <button key={m} onClick={() => setMgr(m)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: 99, border: `1px solid ${on ? P.accentBorder : P.hairline2}`, background: on ? P.accentSoft : P.surface, color: on ? P.mode === 'dark' ? P.accent : '#7A5A00' : P.ink2, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}><Avatar name={m} size={18} />{m}</button>;})}
          </div>
        </div>
        <div>
          <div style={lbl}>Manager PIN</div>
          <div style={{ maxWidth: 180 }}><Field mono type="password" placeholder="••••" value={pin} onChange={(e) => {setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6));setErr('');}} /></div>
          {err && <div style={{ fontSize: 11, color: P.bad, marginTop: 5 }}>{err}</div>}
        </div>
        <div>
          <div style={lbl}>Reason</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {DISC_REASONS.map((r) => {const on = reason === r.k;
              return <button key={r.k} onClick={() => setReason(r.k)} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '9px 10px', textAlign: 'left', background: on ? P.accentSoft : P.surface2, border: `1px solid ${on ? P.accentBorder : P.hairline2}`, borderRadius: P.r10, cursor: 'pointer', fontFamily: P.fontSans }}>
                <span style={{ width: 13, height: 13, borderRadius: 99, border: `2px solid ${on ? P.accent : P.hairline3}`, background: on ? P.accent : 'transparent', flex: '0 0 auto', marginTop: 1 }} />
                <span><span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: P.ink }}>{r.label}</span><span style={{ display: 'block', fontSize: 10.5, color: P.inkDim, lineHeight: 1.4, marginTop: 1 }}>{r.d}</span></span>
              </button>;})}
          </div>
        </div>
        <div>
          <div style={lbl}>Note {needNote ? '· required' : '· optional'}</div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="What justifies this discount? Order number, competitor price, what went wrong…"
            style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: '9px 12px', border: `1px solid ${needNote && !note.trim() ? P.warn : P.hairline2}`, borderRadius: P.r10, background: P.surface, color: P.ink, fontSize: 12.5, fontFamily: P.fontSans, lineHeight: 1.5, outline: 'none' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '10px 12px', background: P.infoSoft, borderRadius: P.r10 }}>
          <Icon name="info" size={13} color={P.info} style={{ flex: '0 0 auto', marginTop: 1 }} />
          <span style={{ fontSize: 11, color: P.ink2, lineHeight: 1.5 }}>The manager's name, the reason and the amount are written to the audit log against this sale and appear in the daily discount report.</span>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, padding: '14px 20px', borderTop: `1px solid ${P.hairline}`, background: P.surface2 }}>
        <PBtn variant="secondary" size="md" onClick={onClose}>Cancel</PBtn>
        <PBtn variant="accent" size="md" icon="check" onClick={submit} style={{ opacity: ok ? 1 : .5 }}>Approve −{money(off)}</PBtn>
      </div>
    </div>
  </div>;
}

// Discount + promo — compact by default, with 3 layout options
function DiscountCard({ P, discMode, setDiscMode, view, setView, subtotal }) {
  const [promoOpen, setPromoOpen] = React.useState(false);
  const [amount, setAmount] = React.useState('');
  const [approval, setApproval] = React.useState(null); // pending request
  const [applied, setApplied] = React.useState(null); // { off, mgr, reason, note }
  const money = window.HW.fmt.money;
  const modeSeg = <Seg value={discMode} onChange={setDiscMode} size="sm" options={[{ value: '$', label: '$' }, { value: '%', label: '%' }]} />;
  // Applying is a REQUEST — nothing changes until a manager signs it off.
  const request = () => {if (!(parseFloat(amount) > 0)) return;setApproval({ amount, mode: discMode });};
  const discField = (ph) => <Field placeholder={ph} size="sm" mono value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} suffix={modeSeg} />;
  const applyBtn = <PBtn variant="soft" size="sm" onClick={request}>Apply</PBtn>;
  return (
    <Card padding={11} style={{ marginBottom: 12, background: P.surface }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 9 }}>
        <Eyebrow>Discount &amp; promo</Eyebrow>
        <Seg value={view} onChange={setView} size="sm" options={[{ value: 'compact', label: 'Compact' }, { value: 'inline', label: 'Inline' }, { value: 'stacked', label: 'Rows' }]} />
      </div>

      {applied && <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '9px 11px', background: P.goodSoft, border: `1px solid ${P.good}44`, borderRadius: P.r10, marginBottom: 9 }}>
        <Icon name="check-circle" size={14} color={P.good} style={{ flex: '0 0 auto', marginTop: 1 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: P.ink }}>−{money(applied.off)} approved</div>
          <div style={{ fontSize: 10.5, color: P.inkDim, lineHeight: 1.45 }}>{(DISC_REASONS.filter((r) => r.k === applied.reason)[0] || {}).label} · signed off by {applied.mgr}</div>
        </div>
        <IconBtn icon="x" size={12} style={{ width: 22, height: 22 }} title="Remove discount" onClick={() => {setApplied(null);setAmount('');}} />
      </div>}

      {view === 'compact' &&
      <>
          <div style={{ display: 'flex', gap: 7 }}>
            {discField('Discount')}
            {applyBtn}
          </div>
          {promoOpen ?
        <div style={{ display: 'flex', gap: 7, marginTop: 7 }}>
              <Field icon="tag" placeholder="Promo code" size="sm" />
              <PBtn variant="soft" size="sm">Apply</PBtn>
            </div> :
        <button onClick={() => setPromoOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, background: 'none', border: 'none', color: P.inkDim, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans, padding: 0 }}><Icon name="plus" size={12} stroke={2.2} />Add promo code</button>}
        </>}

      {view === 'inline' &&
      <div style={{ display: 'flex', gap: 7 }}>
          <Field placeholder="Disc." size="sm" mono full={false} value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} style={{ flex: '1 1 0', minWidth: 0 }} suffix={modeSeg} />
          <Field icon="tag" placeholder="Promo" size="sm" full={false} style={{ flex: '1 1 0', minWidth: 0 }} />
          <PBtn variant="soft" size="sm" icon="check" onClick={request} />
        </div>}

      {view === 'stacked' &&
      <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {discField('Sale discount')}
            {applyBtn}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Field icon="tag" placeholder="Promo code" size="sm" />
            <PBtn variant="soft" size="sm">Apply</PBtn>
          </div>
        </>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 9, fontSize: 10.5, color: P.inkMute, lineHeight: 1.4 }}>
        <Icon name="lock" size={11} color={P.inkMute} />Manual discounts need a manager sign-off and a reason.
      </div>

      {approval && <DiscountApprovalModal P={P} amount={approval.amount} mode={approval.mode} subtotal={subtotal || 0}
        onClose={() => setApproval(null)} onApprove={(r) => setApplied(r)} />}
    </Card>);

}

// AOV goal meter — 3 compact concepts (bar / inline / ring) + up-sells
function AovBooster({ P, total, goal, gap, goalPct, recs, onAdd }) {
  const met = gap <= 0;
  const [view, setView] = React.useState('bar'); // bar | inline | ring
  const meterColor = met ? P.good : P.accent;
  const headColor = met ? P.good : P.warn;
  const fmt0 = window.HW.fmt.money0;

  const Ring = () => {
    const r = 11,c = 2 * Math.PI * r,off = c * (1 - Math.min(1, goalPct));
    return (
      <span style={{ position: 'relative', flex: '0 0 auto', width: 30, height: 30 }}>
        <svg width="30" height="30" viewBox="0 0 30 30">
          <circle cx="15" cy="15" r={r} fill="none" stroke={P.hairline2} strokeWidth="3.5" />
          <circle cx="15" cy="15" r={r} fill="none" stroke={meterColor} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 15 15)" />
        </svg>
        <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: P.ink2, fontFamily: P.fontMono }}>{met ? '✓' : Math.round(goalPct * 100)}</span>
      </span>);
  };

  return (
    <div style={{ marginBottom: 12, border: `1px solid ${met ? P.goodSoft : P.accentBorder}`, borderRadius: P.r12, overflow: 'hidden', background: P.surface }}>
      <div style={{ padding: '8px 12px 9px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
          <Icon name="target" size={13} stroke={2} color={headColor} />
          <Eyebrow>AOV goal</Eyebrow>
          <div style={{ flex: 1 }} />
          <Seg value={view} onChange={setView} size="sm" options={[{ value: 'bar', label: 'Bar' }, { value: 'inline', label: 'Inline' }, { value: 'ring', label: 'Ring' }]} />
        </div>

        {view === 'bar' &&
        <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: P.ink, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{met ? 'AOV goal met' : `Add ${fmt0(Math.ceil(gap))} to hit goal`}</span>
              <span style={{ fontSize: 10.5, color: P.inkDim, fontFamily: P.fontMono, flex: '0 0 auto' }}>{fmt0(total)} / {fmt0(goal)}</span>
            </div>
            <BarMeter value={goalPct} max={1} color={meterColor} height={5} />
          </>}

        {view === 'inline' &&
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: P.ink, flex: '0 0 auto', whiteSpace: 'nowrap' }}>{met ? 'Goal met' : `${fmt0(Math.ceil(gap))} left`}</span>
            <div style={{ flex: 1, minWidth: 0 }}><BarMeter value={goalPct} max={1} color={meterColor} height={5} /></div>
            <span style={{ fontSize: 10.5, color: P.inkDim, fontFamily: P.fontMono, flex: '0 0 auto' }}>{fmt0(total)}/{fmt0(goal)}</span>
          </div>}

        {view === 'ring' &&
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Ring />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{met ? 'AOV goal met' : `Add ${fmt0(Math.ceil(gap))} to goal`}</div>
              <div style={{ fontSize: 10, color: P.inkDim, fontFamily: P.fontMono }}>{fmt0(total)} / {fmt0(goal)}</div>
            </div>
          </div>}
      </div>

      {!met && recs.length > 0 &&
      <div style={{ borderTop: `1px solid ${P.hairline}`, padding: '8px 12px 10px', background: P.surface2 }}>
          <Eyebrow style={{ marginBottom: 7 }}>Recommended for this member</Eyebrow>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
            {recs.map((r) =>
          <div key={r.sku} style={{ flex: '0 0 auto', width: 214, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, background: P.surface, padding: 9, display: 'flex', gap: 9 }}>
                <Thumb item={r} size={44} radius={8} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: P.inkMute, fontFamily: P.fontMono, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.brand}</span>
                    <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: window.HW.CAT_COLOR[r.cat] || P.ink2, background: (window.HW.CAT_COLOR[r.cat] || P.ink2) + '1f', borderRadius: 5, padding: '1px 5px', flex: '0 0 auto', whiteSpace: 'nowrap' }}>{r.cat}</span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: P.ink, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                    {r.strain && <StrainPill type={r.strain} thc={r.thc} />}
                    {r.wt && <span style={{ fontSize: 9.5, color: P.inkMute, fontFamily: P.fontMono }}>{r.wt}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 1 }}>
                    {r.was && <span style={{ fontSize: 10, color: P.inkFaint, textDecoration: 'line-through', fontFamily: P.fontMono }}>{fmt0(r.was)}</span>}
                    <span style={{ fontSize: 13, fontWeight: 700, color: r.was ? P.bad : P.ink, fontFamily: P.fontMono }}>{fmt0(r.price)}</span>
                    <span style={{ fontSize: 9.5, color: r.qty < 10 ? P.warn : P.inkFaint, fontFamily: P.fontMono, marginLeft: 'auto' }}>{r.qty} left</span>
                  </div>
                </div>
                <button onClick={() => onAdd && onAdd(r)} title={`Add ${r.name}`} style={{ flex: '0 0 auto', alignSelf: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, background: P.accent, color: P.accentInk, border: 'none', borderRadius: 8, cursor: 'pointer' }}><Icon name="plus" size={15} stroke={2.6} /></button>
              </div>
          )}
          </div>
        </div>}
    </div>);

}

function Row({ P, k, v }) {return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: P.inkDim }}><span style={{ whiteSpace: 'nowrap' }}>{k}</span><span style={{ color: P.ink2, fontWeight: 600, fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>{v}</span></div>;}


Object.assign(window, {});