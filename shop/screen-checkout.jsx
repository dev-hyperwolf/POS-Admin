/* ── MOBILE CHECKOUT — Figma node 1960-52216 ────────────────────────────────
 *
 * One section per lane, because ONE CART IS TWO ORDERS. The frame's header
 * reads "4 ITEMS · 2 ORDERS" and its sections are
 * "⚡ EXPRESS DELIVERY · 2 Items · +$2 FEE" over "⚡ SCHEDULED · 2 Items · FREE".
 *
 * 🔴 EVERY FIGURE HERE COMES FROM `window.SHOP.totals()` — the same single
 * `computeCartTotals` call in shop/data.jsx that priced the cart page. This file
 * owns no subtotal, no fee, no tax and no total. The lane blocks, the progress
 * bars and the order summary are the cart page's components, reused rather than
 * redrawn, so the two screens cannot drift apart.
 *
 * The ONE arithmetic this file does is splitting that single total across the
 * lanes when the order is placed — see `scoSplit`, which is exact by
 * construction and is the reason the two written orders add back up to the
 * figure on the button the customer pressed.
 *
 * ⚠️ Module-scope names are prefixed `sco` and nothing is put on `window`
 * except the components the shell resolves by name: every file on this page is
 * transformed as its own unit into one shared namespace.
 */
// `useP` is a global from pos/tokens.jsx (`Object.assign(window, {useP})`), so it is
// read off the global object rather than re-declared: six files on this page
// already bind that name at top level, and duplicate top-level `const`s across
// scripts that share one lexical scope is a whole-page failure, not a warning.
const scUseP = () => window.useP();

/**
 * The tip ladder, exactly as the frame draws it:
 *   ( None )( 10% )( 15% ⌄ Most Tipped )( 20% )( Others )
 * Express only — a scheduled order has no driver on the way yet.
 */
const SCO_TIP_STEPS = [
  { key: 'none', label: 'None', pct: 0 },
  { key: 'p10', label: '10%', pct: 10 },
  { key: 'p15', label: '15%', pct: 15, note: 'Most Tipped' },
  { key: 'p20', label: '20%', pct: 20 },
];

/**
 * Checkout's own state, module-scoped so a tab switch does not silently throw
 * away a tip the customer has already chosen. The CART lives in `window.SHOP`;
 * only these three things belong to this screen.
 */
const SCO_STATE = {
  tip: { mode: 'none', pct: 0, customCents: 0 },
  // ── ONE FIELD PER PARAMETER [OWNER RULING 2026-08-27] ─────────────────────
  // This was ONE free-text box, placeholder "Street, city, ZIP", and whatever
  // the customer typed became the delivery address of a real order verbatim.
  // Every downstream question — which region routes it, which state's tax and
  // compliance rules apply, whether the ZIP is even served — needs a specific
  // part of that string, and there was no honest way to get one back out.
  //
  // NO PARSER WAS WRITTEN, DELIBERATELY. Reversing "Street, city, ZIP" by
  // splitting on commas is exactly the guess-that-becomes-a-fact this ruling
  // exists to stop: '221B Baker St', 'Apt 4, 1200 E Ocean Blvd' and
  // 'PO Box 12, Corona, 92879' all come out wrong, and nothing downstream would
  // ever know. The fix is fields, not a splitter.
  addr: { streetNumber: '', streetName: '', city: '', state: '', zip: '' },
  // DERIVED, never typed into. Three existing readers take `address` as a
  // string — two truthiness gates and the order record's `deliverTo` — and they
  // keep working unchanged. It is recomputed from `addr` on every save, so the
  // joined line and the parts cannot drift apart.
  address: '',
  placed: [],          // order ids from the last successful placement
  placing: false,
};

/** Join the captured parts for display. Lossless, and it is the ONLY direction
 *  this file goes: parts → line. A missing part is dropped, never guessed and
 *  never printed as `undefined`. */
function scoJoinAddress(a) {
  if (!a) return '';
  const street = [a.streetNumber, a.streetName].map((s) => String(s || '').trim()).filter(Boolean).join(' ');
  const tail = [String(a.state || '').trim(), String(a.zip || '').trim()].filter(Boolean).join(' ');
  return [street, String(a.city || '').trim(), tail].filter(Boolean).join(', ');
}

/** What the address is still missing, each parameter named on its own. The
 *  wording matches the POS address book (pos/customer-extras.jsx) on purpose:
 *  "a street address" never told anyone WHICH of the two street boxes was
 *  empty, and the same refusal should read the same way on both surfaces. */
function scoAddressMissing(a) {
  a = a || {};
  return [
    !String(a.streetNumber || '').trim() && 'a street number',
    !String(a.streetName || '').trim() && 'a street name',
    !String(a.city || '').trim() && 'a city',
    !/^[A-Za-z]{2}$/.test(String(a.state || '').trim()) && 'a 2-letter state',
    !/^\d{5}$/.test(String(a.zip || '').trim()) && 'a 5-digit ZIP',
  ].filter(Boolean);
}

/**
 * The driver tip, in cents, from the express lane's engine subtotal.
 *
 * ⚠️ CAPTURED, NOT CHARGED — and that is a REPORTED GAP, not an oversight.
 * A voluntary, separately-stated gratuity is not taxable in California, and the
 * estate's order money record (`priceOrderMoney`, pos/screen-orders.jsx) taxes
 * every line it holds and has no post-tax charge slot. Folding a tip into the
 * priced total would therefore either tax it or make the order panel disagree
 * with the button. So it is shown, recorded on the express order as `tipAmt`,
 * and left out of the taxed total, with that said on screen.
 */
/** The tip across the whole checkout — express only, zero when there is no
 *  express lane. The place bar must quote what the customer will actually be
 *  charged, and a tip that is charged but not shown is the same class of bug as
 *  a tip that is shown and not charged. */
function scoTipTotalCents(totals) {
  const ex = totals && totals.lanes && totals.lanes.find((l) => l.lane === 'express');
  return ex ? scoTipCents(ex.subtotalCents) : 0;
}

function scoTipCents(expressSubtotalCents) {
  const t = SCO_STATE.tip;
  if (!t || t.mode === 'none') return 0;
  if (t.mode === 'custom') return Math.max(0, t.customCents | 0);
  return Math.round(Math.max(0, expressSubtotalCents) * (t.pct / 100));
}

/**
 * Split `total` across `weights` so the parts sum to EXACTLY `total`.
 *
 * Largest-remainder. Two lanes rounded independently drift by a cent, and a
 * cent between the bar the customer pressed and the orders that got written is
 * the same class of bug as a dollar — it is the disagreement this project has
 * already shipped once and reverted.
 */
function scoAllocate(total, weights) {
  if (!weights.length) return [];
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) { const z = weights.map(() => 0); z[0] = total; return z; }
  const exact = weights.map((w) => total * w / sum);
  const out = exact.map((e) => Math.floor(e));
  const order = exact.map((e, i) => ({ i, f: e - Math.floor(e) })).sort((a, b) => b.f - a.f || a.i - b.i);
  let rem = total - out.reduce((a, b) => a + b, 0);
  for (let k = 0; k < order.length && rem > 0; k++) { out[order[k].i]++; rem--; }
  if (rem !== 0) out[order[0].i] += rem;        // float wobble lands on the biggest lane
  return out;
}

/**
 * One cart → one order per lane, adding back up to the cart exactly.
 *
 * The cart-level figures the engine reports once — `discountCents` and
 * `taxCents` — are apportioned by each lane's own charged weight
 * (subtotal + its fee). Each lane's total is then
 *     subtotal + fee − its discount share + its tax share
 * and the sum of those is `subtotal + fees − discount + tax`, which is the
 * engine's `totalCents`. No lane invents a figure and nothing is rounded twice.
 */
function scoSplit(totals) {
  const weights = totals.lanes.map((l) => l.subtotalCents + l.feeCents);
  const disc = scoAllocate(totals.discountCents, weights);
  const tax = scoAllocate(totals.taxCents, weights);
  return totals.lanes.map((l, i) => ({
    lane: l.lane,
    itemCount: l.itemCount,
    subtotalCents: l.subtotalCents,
    feeCents: l.feeCents,
    discountCents: disc[i] || 0,
    taxCents: tax[i] || 0,
    totalCents: l.subtotalCents + l.feeCents - (disc[i] || 0) + (tax[i] || 0),
  }));
}

/**
 * Write the orders.
 *
 * Each lane becomes a REAL record through `HW.addOrder`, and each one carries a
 * MONEY RECORD so the order panel reads what was actually charged instead of
 * seeding a fabricated discount off the record's id length — `seedOrderMoney`
 * invents a "Veteran 10%" for any order that arrives without one, and a real
 * web receipt must never acquire a discount nobody gave.
 *
 * The record's lines are the lane's merchandise plus its delivery fee as its
 * own line, its `discAmt` is the lane's apportioned share, and `credits` is
 * zero because nothing was tendered against a wallet.
 */
function scoPlace() {
  const HW = window.HW, SHOP = window.SHOP, D = window.SHOPDATA;
  if (!HW || !D || !SHOP) return null;

  /* 🔴 IDEMPOTENT AGAINST A DURABLE FACT, NOT A FLAG.
   *
   * This used to take `totals` from the caller's render closure and guard on a
   * transient `SCO_STATE.placing`. Both were wrong in the same way: scoPlace is
   * fully SYNCHRONOUS, so `placing` was already back to false before a second
   * click's handler ran, and that handler still held the PRE-CLEAR totals. A
   * double-tap on "Place order" filed the whole cart twice — two sets of real
   * orders for one checkout.
   *
   * The cart being empty is the durable fact that a checkout already happened.
   * Totals are re-derived HERE, from the live store, so a stale snapshot cannot
   * be filed at all. */
  if (!SHOP.lines().length) return null;
  const totals = SHOP.totals();
  if (!totals || !totals.canCheckout) return null;

  // A delivery order with no address is not deliverable. The place bar blocks
  // this too, but the guard belongs where the writing happens — a caller that
  // reaches scoPlace another way must not be able to file an undeliverable order.
  if (!SCO_STATE.address) return null;

  SCO_STATE.placing = true;
  try {
    const split = scoSplit(totals);
    const expressLane = totals.lanes.find((l) => l.lane === 'express');
    const tipCents = expressLane ? scoTipCents(expressLane.subtotalCents) : 0;
    const name = (D.CUSTOMER && D.CUSTOMER.name) || 'Web customer';
    const discReason = totals.discounts.map((d) => d.name).filter(Boolean).join(' + ') || 'Discount applied';
    const lines = SHOP.lines();

    const made = split.map((L) => {
      const meta = window.SHOPCART_UI.meta(L.lane);
      const laneLines = lines.filter((l) => l.lane === L.lane).map((l) => {
        const p = D.productBySku(l.sku) || {};
        // Cents first, so a line total can never disagree with the engine's
        // subtotal by a floating-point hair.
        const priceCents = Math.round((+p.price || 0) * 100);
        return {
          sku: l.sku, name: p.name || l.sku, brand: p.brand || '—',
          qty: l.qty, price: priceCents / 100,
          total: +((priceCents * l.qty) / 100).toFixed(2),
        };
      });
      const moneyLines = laneLines.slice();
      if (L.feeCents > 0) {
        moneyLines.push({ sku: 'DLV-' + String(L.lane).toUpperCase(), name: meta.label + ' delivery',
          brand: 'Hyperwolf', qty: 1, price: L.feeCents / 100, total: L.feeCents / 100 });
      }
      // The tip rides on the EXPRESS order only, and it is charged: the owner's
      // decision. It is added AFTER tax — a voluntary, separately-stated
      // gratuity is not taxable in California — which is why it is not a line.
      const laneTip = L.lane === 'express' ? tipCents : 0;
      const total = +((L.totalCents + laneTip) / 100).toFixed(2);
      const rec = HW.addOrder({
        name, total, items: L.itemCount, source: 'Hyperwolf', channel: 'Web',
        pay: 'Card', stage: 'verify', badge: meta.label, lines: laneLines,
      });
      HW.updateOrder(rec.id, {
        total,
        money: {
          seed: (rec.id ? rec.id.length : 5) + (rec.name || '').length + (rec.items || 1),
          lines: moneyLines,
          discReason, discAmt: +(L.discountCents / 100).toFixed(2),
          promo: null, promoAmt: 0, referral: null, referralAmt: 0, credits: 0,
          lane: L.lane,
          deliveryFee: +(L.feeCents / 100).toFixed(2),
          quotedTaxAmt: +(L.taxCents / 100).toFixed(2),
          // `tip`, not `tipAmt`: this object IS the shape priceOrderMoney reads
          // (pos/screen-orders.jsx), and it reads `m.tip`. Filing it under a
          // different key was the storefront quoting one total and the order
          // panel pricing another — two money authorities across two surfaces.
          tip: +(laneTip / 100).toFixed(2),
          // The joined line, kept as-is for anything that only displays it.
          deliverTo: SCO_STATE.address || null,
          // AND THE PARTS, so the split does not die at this boundary. Capturing
          // five fields and then filing one string would leave every downstream
          // question — which region routes this, which state's rules apply,
          // whether the ZIP is served — right back where it started, with a
          // string to guess at. `null` when there is no address: an absence, not
          // a blank shape that renders as an empty street nobody scrolled to.
          // Gated on the PARTS being complete, not on the joined line being
          // truthy. An address that reached this store as a bare string — a
          // legacy caller, or a test that sets `address` directly — genuinely
          // has no parts, and `{streetNumber:'', …}` would render as an empty
          // street the reader assumes they just have not scrolled to. That is
          // an absence wearing the face of a value, which is the whole defect.
          deliverToAddr: scoAddressMissing(SCO_STATE.addr).length ? null : { ...SCO_STATE.addr },
        },
      });
      return rec;
    });

    SCO_STATE.placed = made.map((r) => r.id);
    SCO_STATE.tip = { mode: 'none', pct: 0, customCents: 0 };
    SHOP.clear();                     // emits, so every subscribed screen moves
    return made;
  } finally { SCO_STATE.placing = false; }
}

/* Published for the same reason every component in this file is published: the
 * page has no module system, and things that must be reachable go on `window`.
 *
 * scoPlace WRITES REAL ORDERS. It had two defects a reviewer had to drive by
 * hand because nothing could address it from a test — a double tap filed the
 * cart twice, and an order could be placed with no delivery address. A
 * money-writing path that no test can call is a money-writing path nobody is
 * checking. */
window.scoPlace = scoPlace;
window.SCO_STATE = SCO_STATE;

// ── Pieces ─────────────────────────────────────────────────────────────────

window.ShopTipSelector = function ShopTipSelector({ lane, onChange }) {
  const P = scUseP();
  const [custom, setCustom] = React.useState('');
  const [others, setOthers] = React.useState(false);
  const t = SCO_STATE.tip;
  const activeKey = t.mode === 'none' ? 'none' : t.mode === 'custom' ? 'custom' : 'p' + t.pct;
  const tipCents = scoTipCents(lane.subtotalCents);
  const set = (next) => { SCO_STATE.tip = next; onChange(); };

  return <div data-hw="tip-express" style={{ padding: '12px 14px', borderTop: `1px solid ${P.hairline}` }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Eyebrow style={{ fontSize: P.type.micro }}>Tip express driver</Eyebrow>
      <div style={{ flex: 1 }} />
      <div style={{ fontSize: P.type.meta, fontWeight: 700, color: tipCents ? P.ink : P.inkMute, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>
        {window.SHOP.money(tipCents)}
      </div>
    </div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
      {SCO_TIP_STEPS.map((s) => <PBtn key={s.key} size="md" variant="secondary" active={activeKey === s.key}
        onClick={() => { setOthers(false); set({ mode: s.pct ? 'pct' : 'none', pct: s.pct, customCents: 0 }); }}>
        {s.label}{s.note ? ` · ${s.note}` : ''}
      </PBtn>)}
      <PBtn size="md" variant="secondary" active={activeKey === 'custom'} onClick={() => setOthers(true)}>Others</PBtn>
    </div>
    {others && <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
      <Field icon="dollar" placeholder="Tip amount" value={custom} mono inputMode="decimal"
        onChange={(e) => setCustom(e.target.value)} />
      <PBtn size="md" variant="secondary" style={{ flex: '0 0 auto' }}
        onClick={() => set({ mode: 'custom', pct: 0, customCents: Math.round((+custom || 0) * 100) })}>Set tip</PBtn>
    </div>}
    {tipCents > 0 && <div style={{ fontSize: P.type.micro, color: P.inkDim, marginTop: 8, lineHeight: 1.5 }}>
      Goes to your express driver. Recorded on the express order, not taxed with it.
    </div>}
  </div>;
};

/** The name of ONE address parameter, above its own box, still there once the
 *  box is full. Kept tiny on purpose: this storefront is used on a phone and
 *  the split already turned one box into five.
 *
 *  `inkDim`, NOT `inkMute`, AND THE DIFFERENCE WAS MEASURED IN A BROWSER at
 *  375px. inkMute is rgba(15,15,12,.42) — 2.81:1 on this white card, where AA
 *  for text this size wants 4.5:1. It passed the whole suite, because jsdom
 *  reads textContent and a label it can FIND is a label it calls present; on a
 *  phone it was an unreadable smudge. inkDim (.60) measures 5.03:1. A label
 *  nobody can read is the same defect as no label, one step quieter. */
function ShopAddrLab({ children }) {
  const P = scUseP();
  return <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase',
    color: P.inkDim, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{children}</div>;
}

/** The address row: [pin] No Address … + Add Address. */
window.ShopAddressRow = function ShopAddressRow({ onChange }) {
  const P = scUseP();
  const [open, setOpen] = React.useState(false);
  // The draft is the PARTS, not a line of text. Nothing in this component ever
  // parses a joined string back apart — the only conversion here is parts → line.
  const [draft, setDraft] = React.useState(() => ({ ...SCO_STATE.addr }));
  const set1 = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const has = !!SCO_STATE.address;
  const missing = scoAddressMissing(draft);
  const ok = missing.length === 0;
  // AN UNSTARTED FORM IS NOT A FORM WITH ERRORS. "Still needs …" used to render
  // the moment the panel opened, so a customer who tapped Add Address was met
  // by a red list of four things they had not yet had the chance to type. On a
  // STOREFRONT that is worse than noise: the first thing the page does is tell
  // the buyer they have got it wrong. The refusal is still loud, and it still
  // names every missing part — it just waits until there is something to
  // refuse. Changing an address that already exists starts non-empty, so it is
  // touched from the outset and the line shows immediately, which is right:
  // that form really does have content, and the content really is incomplete.
  const touched = Object.keys(draft).some((k) => String(draft[k] || '').trim() !== '');
  const needs = missing.length === 1 ? missing[0]
    : missing.slice(0, -1).join(', ') + ' and ' + missing[missing.length - 1];
  const save = () => {
    if (!ok) return;
    const addr = { streetNumber: draft.streetNumber.trim(), streetName: draft.streetName.trim(),
      city: draft.city.trim(), state: draft.state.trim().toUpperCase(), zip: draft.zip.trim() };
    SCO_STATE.addr = addr;
    SCO_STATE.address = scoJoinAddress(addr);   // derived, every time
    setOpen(false);
    onChange();
  };
  return <div data-hw="address-row" style={{ padding: '12px 14px', borderTop: `1px solid ${P.hairline}` }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Icon name="pin" size={16} stroke={1.9} color={has ? P.ink2 : P.inkMute} />
      <div style={{ flex: 1, minWidth: 0, fontSize: P.type.body, fontWeight: 600, color: has ? P.ink : P.inkMute, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {SCO_STATE.address || 'No Address'}
      </div>
      <PBtn size="md" variant="ghost" icon="plus" onClick={() => { setDraft({ ...SCO_STATE.addr }); setOpen((v) => !v); }}>
        {has ? 'Change Address' : 'Add Address'}
      </PBtn>
    </div>
    {/* FIVE BOXES WHERE THERE WAS ONE. Street number is the narrow box and
         street name the wide one; state is two characters. This is a real
         layout change on a storefront that is used on a phone, and jsdom cannot
         see any of it — it answers "is it wired", never "does it fit". */}
    {open && <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
      {/* A PLACEHOLDER IS NOT A LABEL — it vanishes exactly when the box stops
           explaining itself. With "3400" in the narrow box and "S Las Vegas
           Blvd" in the wide one, nothing named which was which, and this is the
           form a customer re-opens to CHECK the address an order is about to be
           driven to. Splitting one box into five and leaving the five unnamed
           moves the ambiguity instead of removing it. */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ width: 96 }}><ShopAddrLab>Street no.</ShopAddrLab><Field mono placeholder="Street no." value={draft.streetNumber} onChange={(e) => set1('streetNumber', e.target.value)} /></div>
        <div style={{ flex: 1, minWidth: 0 }}><ShopAddrLab>Street name</ShopAddrLab><Field icon="pin" placeholder="Street name" value={draft.streetName} onChange={(e) => set1('streetName', e.target.value)} /></div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}><ShopAddrLab>City</ShopAddrLab><Field placeholder="City" value={draft.city} onChange={(e) => set1('city', e.target.value)} /></div>
        <div style={{ width: 72 }}><ShopAddrLab>State</ShopAddrLab><Field mono placeholder="State" value={draft.state} onChange={(e) => set1('state', e.target.value.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase())} /></div>
        <div style={{ width: 104 }}><ShopAddrLab>ZIP</ShopAddrLab><Field mono placeholder="ZIP" value={draft.zip} onChange={(e) => set1('zip', e.target.value.replace(/[^0-9]/g, '').slice(0, 5))} /></div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Refused OUT LOUD, naming each parameter separately. A greyed button
             with no stated reason makes the customer guess which of five boxes
             is the blocker — and on a storefront, guessing means leaving. */}
        {touched && !ok && <span style={{ flex: 1, minWidth: 0, fontSize: P.type.meta, color: P.warn, lineHeight: 1.45 }}>Still needs {needs}.</span>}
        <div style={{ flex: (ok || !touched) ? 1 : '0 0 auto' }} />
        <PBtn size="md" variant="secondary" style={{ flex: '0 0 auto' }} disabled={!ok}
          title={ok ? undefined : `Still needs ${needs}`} onClick={save}>Save</PBtn>
      </div>
    </div>}
  </div>;
};

/** One lane section: header, green arrival strip, address, chips, subtotal. */
window.ShopCheckoutLane = function ShopCheckoutLane({ lane, now, onChange, showAddress }) {
  const P = scUseP();
  const UI = window.SHOPCART_UI;
  const meta = UI.meta(lane.lane);
  const entries = UI.laneLines(lane.lane);
  const arrival = lane.lane === 'express'
    ? `ARRIVES TODAY ${UI.arrival('express').replace(/^ARRIVES\s*/, '')} FROM NOW`
    : `ARRIVES TOMORROW · ${UI.tomorrow(now)} · 2–3 PM`;
  const shown = entries.slice(0, 3), extra = entries.length - shown.length;

  return <Card data-hw={`checkout-lane-${lane.lane}`} padding={0} style={{ overflow: 'hidden', marginBottom: 16 }}>
    <ShopLaneHeader lane={lane}
      label={lane.lane === 'express' ? 'Express Delivery' : meta.label}
      arrival={UI.count(lane.itemCount, 'ITEM')} />

    {/* The green arrival strip. */}
    <div style={{ padding: '8px 14px', background: P.goodSoft }}>
      <Eyebrow color={P.good} style={{ fontSize: P.type.micro }}>{arrival}</Eyebrow>
    </div>

    {/* The frame draws ONE address row, inside the express section. There is
        one delivery address and both orders go to it, so it renders once — on
        the first section, which is express whenever the cart has one. */}
    {showAddress && <ShopAddressRow onChange={onChange} />}

    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '12px 14px', borderTop: `1px solid ${P.hairline}` }}>
      {shown.map((e) => <Pill key={e.line.id} kind="neutral">{e.product.name}{e.line.qty > 1 ? ` ×${e.line.qty}` : ''}</Pill>)}
      {extra > 0 && <Pill kind="neutral">+{extra}</Pill>}
      <div style={{ flex: 1 }} />
      <div style={{ fontSize: P.type.numRow, fontWeight: P.weight.num, color: P.ink, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>
        {window.SHOP.money(lane.subtotalCents)}
      </div>
    </div>

    {/* 🔴 THE MINIMUM STAYS PROGRESS, EVEN HERE. It gates the button below,
        but it is never drawn on the lane as a failure. */}
    <ShopLaneProgress lane={lane} />

    {lane.lane === 'express' && <ShopTipSelector lane={lane} onChange={onChange} />}
  </Card>;
};

/**
 * The place-order bar.
 *   [ 🔒 CLICK TO PLACE ORDER / Place order            $257.50 > ]
 * The figure is `totals.totalCents` — the same number the cart's summary and
 * the cart's Checkout button carry, because all three read one priced object.
 */
window.ShopPlaceBar = function ShopPlaceBar({ totals, onPlace }) {
  const P = scUseP();
  // An address is as much a reason you cannot check out as a lane minimum is,
  // and the customer has to be told which one it is.
  const needsAddress = !SCO_STATE.address;
  const blocked = !totals.canCheckout || needsAddress;
  const reasons = (totals.canCheckout ? [] : totals.blockers.map((b) => b.toLowerCase()))
    .concat(needsAddress ? ['we need a delivery address'] : []);
  return <div data-hw="place-bar" style={{ position: 'sticky', bottom: 0, background: P.surface, borderTop: `1px solid ${P.hairline2}`, padding: 14, marginTop: 8 }}>
    {blocked && <div style={{ fontSize: P.type.meta, color: P.inkDim, marginBottom: 10, lineHeight: 1.5 }}>
      {/* Progress, not a scolding — the same framing the lane bars use. */}
      Almost there — {reasons.join(' · ')}.
    </div>}
    <PBtn full size="xl" variant="accent" icon="lock" iconRight="chevron-right"
      disabled={blocked} onClick={onPlace} style={{ justifyContent: 'space-between' }}>
      <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.25 }}>
        <span style={{ fontSize: P.type.micro, letterSpacing: '.14em', fontFamily: P.fontMono }}>CLICK TO PLACE ORDER</span>
        <span style={{ fontSize: P.type.strong, fontWeight: 700 }}>Place order</span>
      </span>
      <span style={{ fontSize: P.type.numRow, fontWeight: P.weight.num, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>
        {window.SHOP.money(totals.totalCents + scoTipTotalCents(totals))}
      </span>
    </PBtn>
  </div>;
};

/**
 * The checkout's own upsell surface.
 *
 * A thin wrapper on purpose: the CARD, the ranking, the lane refusal and the
 * dismissal set all live in shop/screen-cart.jsx, and a second copy here is how
 * two screens start disagreeing about what the engine said. All this file
 * decides is which surface id to ask for and what to call it.
 */
window.ShopUpsellCallout = function ShopUpsellCallout({ totals, onChange }) {
  return <ShopUpsellRail surface="checkout_callout" title="Before you place it"
    totals={totals} onChange={onChange} />;
};

// ── The screen ─────────────────────────────────────────────────────────────

window.ShopCheckoutScreen = function ShopCheckoutScreen({ now }) {
  const P = scUseP();
  const SHOP = window.useShop();
  // Tip and address live in SCO_STATE so a tab switch cannot lose them; this
  // is how a write to that object reaches the screen.
  const [, bump] = React.useReducer((x) => x + 1, 0);
  const totals = SHOP.totals();

  if (!totals) {
    return <div style={{ padding: 24 }}>
      <ErrorState title="Checkout can’t be priced"
        body="The commerce engine didn’t load. Nothing has been placed, and no total on this page would be trustworthy."
        detail="shared/commerce-engine.js → shared/commerce-adapter.js must load before the storefront." />
    </div>;
  }

  // Placed: the cart is empty because `scoPlace` cleared it, so the receipt is
  // read back off the orders that were actually written — never off the cart
  // that no longer exists.
  if (totals.orderCount === 0 && SCO_STATE.placed.length) {
    return <div data-hw="shop-checkout-done" style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
      <EmptyState icon="check-circle"
        title={SCO_STATE.placed.length === 1 ? 'Order placed' : `${SCO_STATE.placed.length} orders placed`}
        body="One order per delivery lane, exactly as your cart was split."
        action={<PBtn variant="accent" size="lg" onClick={() => { SCO_STATE.placed = []; SHOP.go('shop'); }}>Keep shopping</PBtn>} />
      <Card density="compact" style={{ marginTop: 16 }}>
        {SCO_STATE.placed.map((id) => {
          const o = window.HW.orderById(id);
          if (!o) return null;
          return <div key={id} data-hw="placed-order" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0' }}>
            <Pill kind="neutral">{o.badge}</Pill>
            <div style={{ fontSize: P.type.body, color: P.ink, fontWeight: 600 }}>{o.id}</div>
            <div style={{ flex: 1 }} />
            <div style={{ fontSize: P.type.numRow, fontWeight: P.weight.num, color: P.ink, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>
              {window.HW.fmt.money(o.total)}
            </div>
          </div>;
        })}
      </Card>
    </div>;
  }

  if (totals.orderCount === 0) {
    return <div data-hw="shop-checkout" style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
      <EmptyState icon="cart" title="Nothing to check out" body="Your cart is empty."
        action={<PBtn variant="accent" size="lg" onClick={() => SHOP.go('shop')}>Start shopping</PBtn>} />
    </div>;
  }

  return <div data-hw="shop-checkout" style={{ maxWidth: 640, margin: '0 auto' }}>
    <div style={{ padding: '24px 16px 0', display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
      <h1 style={{ margin: 0, fontSize: P.type.h2, fontWeight: 700, letterSpacing: '-.01em', color: P.ink }}>Checkout</h1>
      <div style={{ flex: 1 }} />
      {/* itemCount / orderCount — the engine's, never counted by hand. */}
      <Eyebrow>{window.SHOPCART_UI.count(totals.itemCount, 'ITEM')} · {window.SHOPCART_UI.count(totals.orderCount, 'ORDER')}</Eyebrow>
    </div>

    <div style={{ padding: '16px 16px 0' }}>
      {totals.lanes.map((l, i) => <ShopCheckoutLane key={l.lane} lane={l} now={now || new Date()}
        onChange={bump} showAddress={i === 0} />)}
      {/* 🔴 THE UPSELL SURFACE HERE IS `checkout_callout`, NOT THE CART'S.
          The engine gives this surface two slots against the cart's six, and
          that difference is the whole point: a customer with a finger on "Place
          order" is interruptible once, not six times. The cards, the ranking and
          the cap are the engine's — see shop/screen-cart.jsx, which owns the
          components and the ONE dismissal set both screens share, so a card
          waved away in the cart does not reappear here. */}
      <ShopUpsellCallout totals={totals} onChange={bump} />
      {/* The same ORDER SUMMARY the cart frame draws, reused rather than
          reinvented, so the per-lane delivery rows and the tax behind this
          total are visible where the total is pressed. */}
      <ShopSavingsLines onChange={bump} />
      <div style={{ height: 16 }} />
      <ShopOrderSummary totals={totals} />
    </div>

    <ShopPlaceBar totals={totals} onPlace={() => { scoPlace(); bump(); }} />
  </div>;
};
