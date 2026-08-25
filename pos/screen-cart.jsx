// ── Cart pane + Payment modal ──────────────────────────────────────────────
const useP = window.useP;

/* ── THE ONE PLACE THE POS ASKS THE ENGINE FOR AN OFFER ──────────────────────
 *
 * `window.HWSwap.recommendations` is @hyperwolf/commerce-logic reached through
 * shared/commerce-adapter.js — the SAME call pos/screen-orders.jsx's
 * AddItemPanel already makes, and the same code the web cart and the driver app
 * rank with. This wrapper adds the three things every POS surface needs and
 * nothing else. It scores nothing itself.
 *
 * ⚠️ DO NOT ADD A SCORER HERE. pos/data.jsx still carries its own `upsell()`
 * helper — a small hand-rolled "same brand or same category" ranker that cannot
 * see promotion unlocks, which is exactly why the cart used to miss them. It
 * stays as the no-engine fallback and MUST NOT grow a second opinion.
 *
 * It lives on `window` rather than as a top-level function because these pages
 * have no module scope: pos/screen-register.jsx is a separate <script> and
 * reaches this by name at call time. screen-cart.jsx loads first, so it is
 * always defined by the time anything renders.
 */
window.HWPosUpsell = (function () {
  'use strict';

  const swap = () => (typeof window !== 'undefined' && window.HWSwap) || null;

  /**
   * The engine's OWN slot count for a surface — never a number chosen here.
   *
   * How many offers a surface may show is a merchandising decision that lives
   * in `defaultConfig.upsell.slotsBySurface`, next to the weights that produced
   * the ranking. A screen that picks its own `.slice(0, 4)` silently overrides
   * that config and the config stops being the answer to "how many do we show".
   *
   * Returns 0 when the engine is not loaded, which is the caller's signal to
   * render no control at all rather than an inert one.
   */
  function slotsFor(surface) {
    const S = swap();
    const u = S && S.engine && S.engine.defaultConfig && S.engine.defaultConfig.upsell;
    const n = u && u.slotsBySurface ? u.slotsBySurface[surface] : 0;
    return typeof n === 'number' && n > 0 ? n : 0;
  }

  /**
   * Ranked offers for one surface.
   *
   * Returns `null` when the engine is absent (caller falls back or renders
   * nothing) and `[]` when the engine ran and had nothing to say — two very
   * different states that must not look alike.
   *
   * ⚠️ FULFILLABILITY IS THE ENGINE'S JOB, NOT A FILTER OUT HERE. The whole
   * catalogue goes in; the adapter turns each product's `qty` into per-lane
   * availability and `upsell.respectLaneAvailability` drops anything the lane
   * cannot actually fill. Post-filtering on `qty` here would look identical on
   * a good day and quietly disagree with the engine on a bad one — and it would
   * take slots away from offers that WERE fulfillable, because the slice has
   * already happened by then.
   *
   * ⚠️ DISMISSAL IS FILTERED AFTER, AND HAS TO BE. `getUpsells` takes a
   * `dismissed` option, but shared/commerce-adapter.js does not forward it (and
   * that file is not ours to change). So we ask for `slots + hidden.length`
   * offers and drop the hidden ones from the top: because only `hidden.length`
   * ids can ever be dropped, what is left is exactly the top `slots` offers
   * that were not dismissed. The number DISPLAYED is still the config's.
   */
  function offersFor(opts) {
    const S = swap();
    if (!S || typeof S.recommendations !== 'function') return null;
    const slots = slotsFor(opts.surface);
    if (!slots) return null;
    const hidden = opts.hidden || [];
    const catalogue = opts.catalogue ||
      (window.HW.PRODUCTS || []).filter((p) => p.active);
    // The member's go-to category is the one affinity signal this estate has
    // that the cart itself cannot supply. It is DATA handed to the engine, not
    // a ranking: the engine decides what it is worth (weights.favoriteCategory).
    const fav = opts.customer && window.HW.favCategory ?
      window.HW.favCategory(opts.customer) : null;
    const ranked = S.recommendations({
      catalogue,
      orderItems: opts.orderItems || [],
      surface: opts.surface,
      limit: slots + hidden.length,
      customer: fav ? { favoriteCategories: [fav] } : undefined,
    });
    if (!ranked) return null;
    const drop = new Set(hidden);
    return ranked.
      filter((o) => !drop.has(o.product.sku || o.product.id)).
      slice(0, slots).
      map((o) => ({ p: o.product, reason: o.reason, kind: o.kind }));
  }

  return { slotsFor, offersFor };
})();

// `merch` is what the goods cost; `sub` is what is left to tax after
// `discountOff` comes off. They are separate props because the footer has to
// show the customer both — a total that quietly shrank is a total nobody trusts.
window.CartPane = function CartPane({ P, lines, merch, discountOff = 0, sub, tax, total, count, pay, setPay, setQty, remove, onClearCart, customer, cartSkus, onAdd, discMode, setDiscMode, discounts, onApplyDiscount, onRemoveDiscount, tab, setTab, onPay, tabs, footNote, upsellHidden, onDismissUpsell }) {
  const walletAmt = customer?.wallet || 0;
  const [taxOpen, setTaxOpen] = React.useState(false);
  const goal = window.HW.STATS.associate.goal;
  const gap = Math.max(0, goal - total);
  const goalPct = goal > 0 ? Math.min(1, total / goal) : 0;

  /* ── SUGGESTIONS WHILE THE SALE IS BEING RUNG UP ──────────────────────────
   *
   * The cart is the highest-intent moment in the shop: the person is at the
   * counter, the screen already has their attention, and the associate has a
   * reason to speak. So this rail is ranked by the upsell engine — the same one
   * behind the driver's "For {customer}" chip and the order picker — and not by
   * the local `HW.upsell` helper, which cannot see promotion unlocks.
   *
   * ⚠️ THE STRING KEYS ARE DELIBERATE. `lines` and `upsellHidden` are new arrays
   * on every render, so memoising on them directly would re-rank on every
   * keystroke anywhere in the register.
   *
   * When the engine has not loaded we fall back to `HW.upsell` rather than
   * showing an empty rail — the cart still has to sell something. `engine`
   * records WHICH list this is, because a hand-rolled list dressed as an
   * engine-ranked one is how nobody notices the engine stopped loading.
   */
  const hidden = upsellHidden || [];
  const hiddenKey = hidden.join(',');
  const cartKey = (lines || []).map((l) => l.sku + ':' + l.qty).join(',');
  const custKey = customer ? customer.id || customer.name : '';
  const { recs, engineRanked } = React.useMemo(() => {
    const drop = new Set(hidden);
    const ranked = window.HWPosUpsell && window.HWPosUpsell.offersFor({
      surface: 'cart_add_to_order',
      orderItems: (lines || []).map((l) => ({ sku: l.sku, qty: l.qty })),
      customer,
      hidden,
    });
    if (ranked) return { recs: ranked, engineRanked: true };
    return {
      recs: window.HW.upsell(cartSkus || [], customer).
        filter((p) => !drop.has(p.sku)).slice(0, 4).
        map((p) => ({ p, reason: p._reason })),
      engineRanked: false,
    };
  }, [cartKey, hiddenKey, custKey]);

  const payMethods = [
  ['cash', 'Cash', 'cash', null],
  ['card', 'Credit Card', 'card', null],
  ['wallet', 'Wallet', 'wallet', walletAmt],
  ['split', 'Split', 'split', null]];


  return (
    <div style={{ flex: '0 0 408px', width: 408, display: 'flex', flexDirection: 'column', background: P.surface2, minHeight: 0 }}>
      {tabs}
      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px 16px' }}>
        {count === 0 ?
        <div style={{ padding: '60px 16px', textAlign: 'center', color: P.inkMute }}>
            <span style={{ display: 'inline-flex', width: 52, height: 52, borderRadius: 99, background: P.surface3, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><Icon name="cart" size={24} stroke={1.6} /></span>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: P.ink2 }}>Cart is empty</div>
            <div style={{ fontSize: 12.5, marginTop: 3 }}>Add products to start a sale</div>
          </div> :
        <>
          {/* Cart lines */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Eyebrow>{count} item{count > 1 ? 's' : ''}</Eyebrow>
              <button onClick={() => onClearCart && onClearCart()} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: P.ctrlH.xs, padding: '0 4px', background: 'none', border: 'none', color: P.inkDim, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}><Icon name="x" size={12} stroke={2} />Clear</button>
            </div>
            {lines.map((l) =>
            <div key={l.sku} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', background: P.surface, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}>
                <Thumb item={l.p} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.p.name}</div>
                  <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{window.HW.fmt.money0(l.p.price)}{l.p.was && <span style={{ textDecoration: 'line-through', marginLeft: 5, color: P.inkFaint }}>{window.HW.fmt.money0(l.p.was)}</span>}</div>
                </div>
                <Stepper value={l.qty} onChange={(v) => setQty(l.sku, v)} size="sm" />
                <div style={{ width: 54, textAlign: 'right', fontSize: 13.5, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{window.HW.fmt.money(l.total)}</div>
                <IconBtn icon="trash" size={14} style={{ width: 28, height: 28 }} onClick={() => remove(l.sku)} />
              </div>
            )}
          </div>

          {/* AOV booster — goal meter + engine-ranked up-sells (comment 8) */}
          <AovBooster P={P} total={total} goal={goal} gap={gap} goalPct={goalPct} recs={recs} onAdd={onAdd}
          engineRanked={engineRanked} onDismiss={onDismissUpsell} />

          {/* Discount + promo — committed to the compact layout */}
          <DiscountCard P={P} discMode={discMode} setDiscMode={setDiscMode} subtotal={merch == null ? sub : merch}
          discounts={discounts} onApply={onApplyDiscount} onRemove={onRemoveDiscount} />

          {/* Rewards — placed right by the payment types (comment: move rewards near payment) */}
          <RewardsCard P={P} customer={customer} discounts={discounts} onApply={onApplyDiscount} onRemove={onRemoveDiscount} />
        </>}
      </div>

      {footNote}
      {/* Totals + tender (sticky footer) — committed to the detailed view, height minimized */}
      {count > 0 &&
      <div style={{ flex: '0 0 auto', padding: '9px 11px 11px 18px', borderTop: `1px solid ${P.hairline2}`, background: P.surface }}>
          {/* Totals column + the 52px vertical TENDER column, flush to the
            right edge. The three tax lines collapse into one summary row —
            they are the same every sale, so they only cost height. */}
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3, fontSize: 11.5 }}>
              <Row P={P} k="Sub-total" v={window.HW.fmt.money(merch == null ? sub : merch)} />
              {discountOff > 0 && <Row P={P} k="Discount" v={`−${window.HW.fmt.money(discountOff)}`} tone={P.good} />}
              <TaxRow P={P} sub={sub} open={taxOpen} onToggle={() => setTaxOpen((o) => !o)} />
              <Row P={P} k="Items" v={count} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 2, paddingTop: 5, borderTop: `1px dashed ${P.hairline2}` }}><span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Total</span><span style={{ fontSize: 21, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{window.HW.fmt.money(total)}</span></div>
            </div>
            <button onClick={onPay} title={`Tender · ${window.HW.fmt.money(total)}`} style={{ flex: '0 0 auto', width: 52, alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'center', background: P.accent, color: P.accentInk, border: 'none', borderRadius: P.r12, cursor: 'pointer', fontFamily: P.fontSans, padding: '10px 4px', overflow: 'hidden' }}>
              <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 13.5, fontWeight: 800, letterSpacing: '.16em', whiteSpace: 'nowrap' }}>TENDER</span>
            </button>
          </div>
        </div>
      }
    </div>);

};

// Loyalty rewards — the tier coins, sized small so the cart stays short.
// The ladder is fixed: 100 pts → $2.50, 200 → $5, 400 → $10, 800 → $20, plus
// the birthday $20 which is not points-gated at all.
//
// The redemption used to live in this component's own `redeemed` state, so the
// card printed "$2.50 off applied · 100 pts redeemed" over a total that had not
// moved a cent. It now hands the discount UP to the ticket, and reads back the
// one the ticket is actually carrying.
function RewardsCard({ P, customer, discounts, onApply, onRemove }) {
  const rewards = window.HW.REWARDS;
  const pts = customer?.points || 0;
  const goldInk = P.accentText;
  const tier = pts >= 2000 ? 'Platinum' : pts >= 1000 ? 'Gold' : pts >= 300 ? 'Silver' : 'Bronze';
  const tierColor = tier === 'Platinum' ? P.info : tier === 'Gold' ? goldInk : tier === 'Silver' ? P.neutral : P.warn;
  const unlocked = (r) => r.bday || pts >= r.cost;
  const held = (discounts || []).filter((d) => d.kind === 'reward')[0] || null;
  const redeemed = held ? held.rewardId : null;
  const doRedeem = (r) => {
    if (redeemed === r.id) {onRemove && onRemove('reward');return;}
    onApply && onApply({ kind: 'reward', rewardId: r.id, off: r.value, label: r.label, points: r.bday ? 0 : r.cost });
  };

  if (!customer) {
    return (
      <Card padding={11} style={{ marginBottom: 10, background: P.surface }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
          <span style={{ width: 20, height: 20, borderRadius: 6, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="star" size={12} stroke={1.9} /></span>
          <Eyebrow>Rewards</Eyebrow>
        </div>
        <div style={{ fontSize: 11.5, color: P.inkMute }}>Check in a member to view points &amp; redeem rewards.</div>
      </Card>);
  }

  return (
    <Card density="compact" padding={10} style={{ marginBottom: 10 }} data-tour="rewards-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
        <span style={{ width: 20, height: 20, borderRadius: 6, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="star" size={12} stroke={1.9} /></span>
        <Eyebrow>Rewards</Eyebrow>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: tierColor }}><Icon name="crown" size={11} color={tierColor} />{tier.toUpperCase()}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{pts.toLocaleString()} <span style={{ fontSize: 10, color: P.inkMute, fontWeight: 600 }}>PTS</span></span>
      </div>

      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 1 }}>
        {rewards.map((r) => {
          const can = unlocked(r);const isR = redeemed === r.id;
          return (
            <button key={r.id} disabled={!can} onClick={() => doRedeem(r)} title={can ? r.bday ? 'Birthday reward — no points required' : `${r.cost} pts` : `Locked — ${r.cost - pts} more points needed`}
              style={{ flex: '0 0 auto', width: 62, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '5px 4px 6px', background: isR ? P.accentSoft : P.surface, border: `1px solid ${isR ? P.accentBorder : can ? P.hairline2 : P.hairline}`, borderRadius: P.r10, cursor: can ? 'pointer' : 'not-allowed', opacity: can ? 1 : .55, fontFamily: P.fontSans }}>
              <span style={{ width: 22, height: 22, borderRadius: 99, background: can ? P.accent : P.surface3, color: can ? P.accentInk : P.inkMute, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={isR ? 'check' : can ? r.icon : 'lock'} size={12} stroke={2} /></span>
              <span style={{ fontSize: 10, fontWeight: 700, color: P.ink, textAlign: 'center', lineHeight: 1.15, whiteSpace: 'nowrap' }}>{r.short || r.label}</span>
              <span style={{ fontSize: 10, fontFamily: P.fontMono, color: can ? goldInk : P.inkFaint, whiteSpace: 'nowrap' }}>{r.bday ? 'birthday' : r.cost}</span>
            </button>);
        })}
      </div>

      {held &&
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 7, fontSize: 11.5, color: goldInk, fontWeight: 600 }}>
          <Icon name="gift" size={12} stroke={1.9} />
          {/* "costs", not "redeemed": the points come off when the sale is
              tendered, and this card is not the thing that debits them. */}
          {/* No remove button: the coin itself is the toggle, and it is already
              a proper target. A second 20px × on top of it would be worse. */}
          {held.label} applied — {window.HW.fmt.money(held.off)} off{held.points ? ` · costs ${held.points} pts` : ''} · tap the coin to release it
        </div>}
    </Card>);
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
  const amt = parseFloat(amount) || 0;
  const off = mode === '%' ? subtotal * (amt / 100) : amt;
  const pctOff = subtotal > 0 ? off / subtotal * 100 : 0;
  const steep = pctOff >= 25;
  const needNote = reason === 'other';
  // What is still missing, named. The button used to sit at 50% opacity and
  // `return` on click: the gate was right, the SILENCE was the bug — a manager
  // pressing Approve on an empty form got nothing back and no reason.
  const missing = [
  !mgr && 'choose the approving manager',
  pin.length < 4 && 'enter the manager PIN',
  !reason && 'pick a reason',
  needNote && note.trim().length <= 2 && 'write the note that "Other" requires'].
  filter(Boolean);
  const ok = missing.length === 0;
  const submit = () => {
    if (!ok) return;
    onApprove({ mgr, reason, note: note.trim(), off });
    onClose();
  };
  const lbl = { fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 6 };
  return <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 210, background: P.scrim, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(520px,96vw)', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, overflow: 'hidden' }} data-tour="disc-approval">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '15px 20px', borderBottom: `1px solid ${P.hairline}` }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: steep ? P.badSoft : P.warnSoft, color: steep ? P.bad : P.warn, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="lock" size={16} stroke={2} /></span>
        <div style={{ flex: 1 }}><div style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>Manager approval required</div><div style={{ fontSize: 11.5, color: P.inkDim }}>Manual discounts are never applied without a sign-off</div></div>
        <IconBtn icon="x" size={16} onClick={onClose} />
      </div>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: steep ? P.badSoft : P.surface2, border: `1px solid ${steep ? P.bad : P.hairline}`, borderRadius: P.r12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>Discount requested</div>
            <div style={{ fontSize: 21, fontWeight: 800, color: steep ? P.bad : P.ink, fontFamily: P.fontMono, marginTop: 2 }}>−{money(off)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{pctOff.toFixed(1)}% of {money(subtotal)}</div>
            <div style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>new subtotal {money(Math.max(0, subtotal - off))}</div>
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
              return <button key={m} onClick={() => setMgr(m)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: 99, border: `1px solid ${on ? P.ink : P.hairline2}`, background: on ? P.ink : P.surface, color: on ? P.surface : P.ink2, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}><Avatar name={m} size={18} />{m}</button>;})}
          </div>
        </div>
        <div>
          <div style={lbl}>Manager PIN</div>
          <div style={{ maxWidth: 180 }}><Field mono type="password" placeholder="••••" value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} /></div>
          {pin.length > 0 && pin.length < 4 && <div style={{ fontSize: 11.5, color: P.warn, marginTop: 5 }}>A manager PIN is at least 4 digits.</div>}
        </div>
        <div>
          <div style={lbl}>Reason</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {DISC_REASONS.map((r) => {const on = reason === r.k;
              return <button key={r.k} onClick={() => setReason(r.k)} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '9px 10px', textAlign: 'left', background: on ? P.surface3 : P.surface2, border: `1px solid ${on ? P.ink : P.hairline2}`, borderRadius: P.r10, cursor: 'pointer', fontFamily: P.fontSans }}>
                <span style={{ width: 13, height: 13, borderRadius: 99, border: `2px solid ${on ? P.accent : P.hairline3}`, background: on ? P.accent : 'transparent', flex: '0 0 auto', marginTop: 1 }} />
                <span><span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: P.ink }}>{r.label}</span><span style={{ display: 'block', fontSize: 11.5, color: P.inkDim, lineHeight: 1.4, marginTop: 1 }}>{r.d}</span></span>
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
          <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>The manager's name, the reason and the amount are written to the audit log against this sale and appear in the daily discount report.</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '14px 20px', borderTop: `1px solid ${P.hairline}`, background: P.surface2 }}>
        {!ok && <span style={{ flex: 1, minWidth: 0, display: 'inline-flex', alignItems: 'flex-start', gap: 6, fontSize: 11.5, color: P.inkDim, lineHeight: 1.45 }}>
          <Icon name="info" size={13} color={P.inkMute} style={{ flex: '0 0 auto', marginTop: 1 }} />
          To approve, {missing.join(', ')}.
        </span>}
        <div style={{ flex: ok ? 1 : '0 0 auto' }} />
        <PBtn variant="secondary" size="md" onClick={onClose}>Cancel</PBtn>
        <PBtn variant="accent" size="md" icon="check" disabled={!ok} title={ok ? `Approve ${money(off)} off` : `Still needed: ${missing.join(', ')}`} onClick={submit}>Approve −{money(off)}</PBtn>
      </div>
    </div>
  </div>;
}

// The promo codes this store honours. Local, like DISC_REASONS and MANAGERS —
// a code that is not on this list is REFUSED OUT LOUD rather than swallowed.
const PROMO_CODES = [
{ code: 'WELCOME10', pct: 10, label: '10% off · new member welcome' },
{ code: 'GREEN5', amt: 5, label: '$5 off · Green Wednesday' },
{ code: 'LOCAL15', pct: 15, label: '15% off · neighbourhood rate' }];

// Discount + promo — one compact layout. The manager-sign-off rule is taught
// in the guided walkthrough, not printed under the field every sale.
//
// ⚠️ The approved discount does NOT live here. It used to — `applied` was local
// state, so a manager could sign off and the total would not move. Everything
// that changes money is handed to `onApply` and read back out of `discounts`.
function DiscountCard({ P, discMode, setDiscMode, subtotal, discounts, onApply, onRemove }) {
  const [promoOpen, setPromoOpen] = React.useState(false);
  const [amount, setAmount] = React.useState('');
  const [code, setCode] = React.useState('');
  const [promoErr, setPromoErr] = React.useState('');
  const [approval, setApproval] = React.useState(null); // pending request
  const money = window.HW.fmt.money;
  const r2 = (n) => Math.round((+n || 0) * 100) / 100;
  const list = discounts || [];
  const applied = list.filter((d) => d.kind === 'manual')[0] || null;
  const promo = list.filter((d) => d.kind === 'promo')[0] || null;
  const sub = r2(subtotal);
  const amt = parseFloat(amount) || 0;
  const off = discMode === '%' ? r2(sub * (amt / 100)) : r2(amt);
  const modeSeg = <Seg value={discMode} onChange={setDiscMode} size="sm" options={[{ value: '$', label: '$' }, { value: '%', label: '%' }]} />;
  // Why Apply is refusing, in a sentence. An empty field used to `return` and
  // say nothing at all, which reads exactly like a dead button.
  const blocked =
  sub <= 0 ? 'Add something to the cart before discounting it.' :
  !amount.trim() ? 'Enter an amount, then Apply.' :
  !(amt > 0) ? 'A discount has to be more than zero.' :
  discMode === '%' && amt > 100 ? 'A percentage cannot be over 100%.' :
  off > sub ? `That is ${money(off)} off a ${money(sub)} subtotal.` : '';
  // Applying is a REQUEST — nothing changes until a manager signs it off.
  const request = () => {if (blocked) return;setApproval({ amount, mode: discMode });};
  const applyPromo = () => {
    const c = code.trim().toUpperCase();
    if (!c) {setPromoErr('Enter a promo code, then Apply.');return;}
    if (sub <= 0) {setPromoErr('Add something to the cart before applying a code.');return;}
    const hit = PROMO_CODES.filter((p) => p.code === c)[0];
    if (!hit) {setPromoErr(`${c} is not a code this store honours.`);return;}
    const value = Math.min(sub, hit.pct ? r2(sub * hit.pct / 100) : r2(hit.amt));
    onApply && onApply({ kind: 'promo', off: value, label: hit.label, code: c });
    setPromoErr('');setCode('');
  };
  const note = { fontSize: 10, color: P.inkDim, lineHeight: 1.4, marginTop: 5 };
  return (
    <Card padding={9} style={{ marginBottom: 10, background: P.surface }} data-tour="disc-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
        <Eyebrow>Discount &amp; promo</Eyebrow>
        <div style={{ flex: 1 }} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: P.inkMute, fontWeight: 600 }} title="Manual discounts need a manager sign-off and a reason."><Icon name="lock" size={10} color={P.inkMute} />sign-off</span>
      </div>

      {applied && <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 9px', background: P.goodSoft, border: `1px solid ${P.good}44`, borderRadius: P.r10, marginBottom: 7 }}>
        <Icon name="check-circle" size={13} color={P.good} style={{ flex: '0 0 auto', marginTop: 1 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: P.ink }}>−{money(applied.off)} approved</div>
          <div style={{ fontSize: 10, color: P.inkDim, lineHeight: 1.4 }}>{(DISC_REASONS.filter((r) => r.k === applied.reason)[0] || {}).label} · signed off by {applied.mgr}</div>
        </div>
        <IconBtn icon="x" size={12} style={{ width: 20, height: 20 }} title="Remove discount" label="Remove discount" onClick={() => {onRemove && onRemove('manual');setAmount('');}} />
      </div>}

      {promo && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', background: P.goodSoft, border: `1px solid ${P.good}44`, borderRadius: P.r10, marginBottom: 7 }}>
        <Icon name="tag" size={13} color={P.good} style={{ flex: '0 0 auto' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: P.ink }}>−{money(promo.off)} · {promo.code}</div>
          <div style={{ fontSize: 10, color: P.inkDim, lineHeight: 1.4 }}>{promo.label}</div>
        </div>
        <IconBtn icon="x" size={12} style={{ width: 20, height: 20 }} title="Remove promo code" label="Remove promo code" onClick={() => onRemove && onRemove('promo')} />
      </div>}

      <div style={{ display: 'flex', gap: 7 }}>
        <Field placeholder="Discount" size="sm" mono value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} suffix={modeSeg} />
        <PBtn variant="soft" size="sm" disabled={!!blocked} title={blocked || `Request ${money(off)} off`} onClick={request}>Apply</PBtn>
      </div>
      {blocked && <div style={note}>{blocked}</div>}
      {promoOpen ?
      <div style={{ marginTop: 6 }}>
          <div style={{ display: 'flex', gap: 7 }}>
            <Field icon="tag" placeholder="Promo code" size="sm" value={code}
            onChange={(e) => {setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));setPromoErr('');}} />
            <PBtn variant="soft" size="sm" disabled={!code.trim()} title={code.trim() ? `Apply ${code.trim()}` : 'Enter a promo code first'} onClick={applyPromo}>Apply</PBtn>
          </div>
          {(promoErr || !code.trim()) &&
          <div style={{ ...note, color: promoErr ? P.bad : P.inkDim, display: 'flex', alignItems: 'flex-start', gap: 5 }}>
              {promoErr && <Icon name="alert" size={11} color={P.bad} style={{ flex: '0 0 auto', marginTop: 1 }} />}
              {promoErr || 'Enter a promo code, then Apply.'}
            </div>}
        </div> :
      <button onClick={() => setPromoOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 4, minHeight: P.ctrlH.xs, background: 'none', border: 'none', color: P.inkDim, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans, padding: '0 2px' }}><Icon name="plus" size={12} stroke={2.2} />Add promo code</button>}

      {approval && <DiscountApprovalModal P={P} amount={approval.amount} mode={approval.mode} subtotal={sub}
      onClose={() => setApproval(null)}
      onApprove={(r) => {onApply && onApply({ kind: 'manual', off: Math.min(sub, r2(r.off)), label: 'Manual discount', mgr: r.mgr, reason: r.reason, note: r.note });setAmount('');}} />}
    </Card>);

}

// AOV goal meter — the bar, plus recommended up-sells.
/**
 * The goal meter and the suggestion rail, in one card.
 *
 * ⚠️ `recs` IS `[{ p, reason }]`, not a list of products. It used to be
 * products carrying a `_reason` the card then threw away — the local helper had
 * been computing a reason for every row since it was written and no cashier
 * ever saw one. Both list shapes now arrive normalised, so the card renders the
 * engine's copy and the fallback's copy through the same path.
 *
 * ⚠️ THE RAIL IS NO LONGER GATED ON THE AOV GOAL. It used to disappear the
 * moment `total` crossed the associate's goal, which meant the suggestion
 * surface switched itself off during exactly the sales that were going well.
 * The meter is a staff metric; the rail is the customer's. They share a card
 * and nothing else.
 */
function AovBooster({ P, total, goal, gap, goalPct, recs, onAdd, engineRanked, onDismiss }) {
  const met = gap <= 0;
  const meterColor = met ? P.good : P.info;
  const headColor = met ? P.good : P.warn;
  const fmt0 = window.HW.fmt.money0;

  return (
    <div style={{ marginBottom: 10, border: `1px solid ${met ? P.goodSoft : P.hairline2}`, borderRadius: P.r12, overflow: 'hidden', background: P.surface }}>
      <div style={{ padding: '7px 11px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 5 }}>
          <Icon name="target" size={12} stroke={2} color={headColor} style={{ alignSelf: 'center', flex: '0 0 auto' }} />
          <span style={{ fontSize: 11.5, fontWeight: 700, color: P.ink, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{met ? 'AOV goal met' : `Add ${fmt0(Math.ceil(gap))} to hit goal`}</span>
          <span style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono, flex: '0 0 auto', whiteSpace: 'nowrap' }}>{fmt0(total)} / {fmt0(goal)}</span>
        </div>
        <BarMeter value={goalPct} max={1} color={meterColor} height={4} />
      </div>

      {recs.length > 0 &&
      <div style={{ borderTop: `1px solid ${P.hairline}`, padding: '7px 11px 9px', background: P.surface2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Eyebrow>{engineRanked ? 'Suggested for this sale' : 'Recommended for this member'}</Eyebrow>
            {/* Say which list this is. A hand-rolled fallback that looks like an
                engine ranking is how nobody notices the engine stopped loading. */}
            {engineRanked && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: P.type.micro, fontWeight: 700, color: P.accentText, whiteSpace: 'nowrap' }}><Icon name="sparkle" size={11} stroke={2} />Ranked</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
            {recs.map(({ p: r, reason }) =>
          <div key={r.sku} style={{ flex: '0 0 auto', width: 232, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, background: P.surface, padding: 9, display: 'flex', gap: 9 }}>
                <Thumb item={r} size={44} radius={8} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: P.inkMute, fontFamily: P.fontMono, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.brand}</span>
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: window.HW.CAT_COLOR[r.cat] || P.ink2, background: (window.HW.CAT_COLOR[r.cat] || P.ink2) + '1f', borderRadius: 5, padding: '1px 5px', flex: '0 0 auto', whiteSpace: 'nowrap' }}>{r.cat}</span>
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                  {/* WHY this card is here, in the engine's own words. */}
                  {reason && <div style={{ fontSize: P.type.micro, fontWeight: 700, color: P.accentText, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{reason}</div>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                    {r.strain && <StrainPill type={r.strain} thc={r.thc} />}
                    {r.wt && <span style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>{r.wt}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 1 }}>
                    {r.was && <span style={{ fontSize: 10, color: P.inkFaint, textDecoration: 'line-through', fontFamily: P.fontMono }}>{fmt0(r.was)}</span>}
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: r.was ? P.bad : P.ink, fontFamily: P.fontMono }}>{fmt0(r.price)}</span>
                    <span style={{ fontSize: 10, color: r.qty < 10 ? P.warn : P.inkFaint, fontFamily: P.fontMono, marginLeft: 'auto' }}>{r.qty} left</span>
                  </div>
                </div>
                <div style={{ flex: '0 0 auto', alignSelf: 'center', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <button onClick={() => onAdd && onAdd(r)} title={`Add ${r.name}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, background: P.accent, color: P.accentInk, border: 'none', borderRadius: 10, cursor: 'pointer' }}><Icon name="plus" size={17} stroke={2.6} /></button>
                  {/* "Not for them" — for THIS sale only. The next customer gets
                      a clean slate, because the dismissal lives on the ticket. */}
                  {onDismiss && <button onClick={() => onDismiss(r.sku)} title={`Not for this sale · ${r.name}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, background: P.surface, color: P.inkDim, border: `1px solid ${P.hairline2}`, borderRadius: 10, cursor: 'pointer' }}><Icon name="x" size={15} stroke={2.2} /></button>}
                </div>
              </div>
          )}
          </div>
        </div>}
    </div>);

}

// Taxes are identical every sale, so they collapse into one row by default.
function TaxRow({ P, sub, open, onToggle }) {
  const tb = window.HW.taxBreakdown(sub);
  const money = window.HW.fmt.money;
  return (
    <>
      <button onClick={onToggle} aria-expanded={open} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, width: '100%', minHeight: P.ctrlH.xs, padding: 0, background: 'none', border: 'none', cursor: 'pointer', fontFamily: P.fontSans, fontSize: 11.5, color: P.inkDim, textAlign: 'left' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
          Taxes<span style={{ fontFamily: P.fontMono, fontSize: 10, color: P.inkMute }}>({(tb.rate * 100).toFixed(2)}%)</span>
          <Icon name="chevron-down" size={11} stroke={2.4} color={P.inkMute} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
        </span>
        <span style={{ color: P.ink2, fontWeight: 600, fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>{money(tb.total)}</span>
      </button>
      {open && <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '2px 0 1px 10px', borderLeft: `1px solid ${P.hairline2}`, marginLeft: 1 }}>
        {tb.lines.map((t) => <div key={t.k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 11.5, color: P.inkMute }}><span style={{ whiteSpace: 'nowrap' }}>{t.k}</span><span style={{ fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>{money(t.v)}</span></div>)}
      </div>}
    </>);
}

function Row({ P, k, v, tone }) {return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: P.inkDim }}><span style={{ whiteSpace: 'nowrap' }}>{k}</span><span style={{ color: tone || P.ink2, fontWeight: 600, fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>{v}</span></div>;}


Object.assign(window, {});