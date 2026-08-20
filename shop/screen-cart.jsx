/* ── THE WEB CART — Figma node 1912-43270 ───────────────────────────────────
 *
 * 🔴 ONE MONEY AUTHORITY, AND IT IS NOT THIS FILE.
 *
 * `shop/data.jsx` makes the single `computeCartTotals` call for the whole
 * storefront and exposes it as `window.SHOP.totals()`. Every figure on this
 * screen is a field of that one object — lane subtotals, minimums, per-lane
 * fees, tax, total, and the "4 ITEMS · 2 ORDERS" counts. This file owns no
 * subtotal, no fee, no total, and no cart lines: the lines live in `SHOP` too,
 * so the reorder card on the home screen and this page are the same cart.
 *
 * What the frame says, and is therefore not negotiable:
 *   · the lane header is a violet bar carrying arrival copy and the lane's fee
 *   · THE MINIMUM IS A PROGRESS BAR WITH A "MIN MET" TICK, NOT AN ERROR. The
 *     unmet state is progress — show what is still needed, never block or shout.
 *   · "Move to Scheduled" sits on EACH express line: lane assignment is per line
 *     and the customer drives it.
 *   · the summary prices delivery PER LANE — separate Express and Scheduled
 *     rows, never one blended fee.
 *   · "4 ITEMS · 2 ORDERS" is `itemCount` / `orderCount`, never counted by hand.
 *
 * ⚠️ NAMING. Every file on this page is transformed as its own unit and its
 * top-level names land next to everyone else's. `shop/data.jsx` already owns
 * `shopMoney`, `shopContext`, `shopTotals`, `productBySku` and friends, so
 * everything module-scoped here is prefixed `scart` and nothing here is
 * assigned onto `window` except the components the shell resolves by name.
 */
// `useP` is a global from pos/tokens.jsx (`Object.assign(window, {useP})`), so it is
// read off the global object rather than re-declared: six files on this page
// already bind that name at top level, and duplicate top-level `const`s across
// scripts that share one lexical scope is a whole-page failure, not a warning.
const scUseP = () => window.useP();

/** Lane presentation. Nothing here is money. */
const SCART_LANE_META = {
  express: { label: 'Express', icon: 'lightning' },
  scheduled: { label: 'Scheduled', icon: 'calendar' },
};
function scartMeta(lane) {
  return SCART_LANE_META[lane] || { label: String(lane || ''), icon: 'truck' };
}

/**
 * Arrival copy for the cart's lane bar.
 *
 * The express ETA is read from the engine's lane config through
 * `SHOPDATA.expressEtaMinutes()`, not typed as "~90 MIN" — the frame's 90 is
 * the config's 90, and a literal here would survive a zone that changed it.
 */
function scartArrival(lane) {
  if (lane !== 'express') return 'ARRIVES TOMORROW';
  const m = window.SHOPDATA && window.SHOPDATA.expressEtaMinutes();
  return m ? `ARRIVES ~${m} MIN` : 'ARRIVES TODAY';
}

/** "WED DEC 11" for tomorrow — the frame's shape, never a stale literal. */
function scartTomorrow(now) {
  const d = new Date((now || new Date()).getTime() + 24 * 60 * 60 * 1000);
  const day = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()];
  const mon = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][d.getMonth()];
  return `${day} ${mon} ${d.getDate()}`;
}

/** The cart's lines for one lane, joined to the catalogue. */
function scartLaneLines(lane) {
  const SHOP = window.SHOP, D = window.SHOPDATA;
  if (!SHOP || !D) return [];
  return SHOP.lines().filter((l) => l.lane === lane)
    .map((l) => ({ line: l, product: D.productBySku(l.sku) }))
    .filter((x) => x.product);
}

/** `n ITEMS` / `n ORDERS`, pluralised. The COUNTS are the engine's. */
function scartCount(n, one) { return `${n} ${n === 1 ? one : one + 'S'}`; }

// ── Pieces shared with the checkout ────────────────────────────────────────

/**
 * The violet lane bar: arrival copy on the left, the lane's own fee on the right.
 *
 * The fee is `lane.feeCents` straight off the engine — never a literal "+$2",
 * which a waived fee or a re-configured zone would immediately falsify.
 */
window.ShopLaneHeader = function ShopLaneHeader({ lane, arrival, label }) {
  const P = scUseP();
  const meta = scartMeta(lane.lane);
  const free = lane.feeCents === 0;
  return <div style={{
    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    padding: '10px 14px', background: `${P.hue.violet}1f`,
    borderBottom: `1px solid ${P.hairline}`,
  }}>
    <Icon name={meta.icon} size={15} stroke={2} color={P.hue.violet} />
    <Eyebrow color={P.hue.violet} style={{ fontSize: P.type.meta }}>
      {(label || meta.label).toUpperCase()}{arrival ? ` · ${arrival}` : ''}
    </Eyebrow>
    <div style={{ flex: 1 }} />
    <Eyebrow color={free ? P.good : P.ink2} style={{ fontSize: P.type.meta }}>
      {free ? (lane.feeWaived ? 'FEE WAIVED' : 'FREE') : `+${window.SHOP.money(lane.feeCents)} FEE`}
    </Eyebrow>
  </div>;
};

/**
 * 🔴 THE MINIMUM AS PROGRESS, NEVER AS AN ERROR.
 *
 * The frame draws a filling bar and a "✓ MIN MET" tick. The unmet state is the
 * same bar, less full, in neutral ink saying how much more is needed. It is not
 * red, it is not a warning, and it disables nothing on this page — a customer
 * part-way to a threshold is succeeding slowly, not failing. `progress`,
 * `minimumMet` and `shortfallCents` are all the engine's; this draws them.
 */
window.ShopLaneProgress = function ShopLaneProgress({ lane }) {
  const P = scUseP();
  const meta = scartMeta(lane.lane);
  return <div data-hw={`lane-progress-${lane.lane}`}
    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: `1px solid ${P.hairline}` }}>
    <BarMeter value={lane.progress} max={1} color={lane.minimumMet ? P.good : P.ink2} height={8} />
    {lane.minimumMet
      ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flex: '0 0 auto' }}>
        <Icon name="check" size={13} stroke={2.6} color={P.good} />
        <Eyebrow color={P.good} style={{ fontSize: P.type.micro }}>MIN MET</Eyebrow>
      </span>
      : <Eyebrow color={P.inkDim} style={{ fontSize: P.type.micro, flex: '0 0 auto' }}>
        {window.SHOP.money(lane.shortfallCents)} TO THE {meta.label.toUpperCase()} MINIMUM
      </Eyebrow>}
  </div>;
};

/** One cart line: brand / name / THC · size / price / stepper / lane move. */
window.ShopCartLine = function ShopCartLine({ entry, lane }) {
  const P = scUseP();
  const SHOP = window.SHOP;
  const p = entry.product, l = entry.line;
  const other = lane === 'express' ? 'scheduled' : 'express';
  const otherMeta = scartMeta(other);
  return <div data-hw="cart-line" style={{ display: 'flex', gap: 12, padding: 14, borderBottom: `1px solid ${P.hairline}` }}>
    <Thumb item={p} size={56} radius={P.r10} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <Eyebrow style={{ fontSize: P.type.micro }}>{String(p.brand || '—').toUpperCase()}</Eyebrow>
        <div style={{ flex: 1 }} />
        {/* The LINE price is the catalogue price the whole storefront shows;
            every AGGREGATE on this page comes from SHOP.totals(). */}
        <div style={{ fontSize: P.type.numRow, fontWeight: P.weight.num, color: P.ink, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>
          {window.HW.fmt.money(p.price * l.qty)}
        </div>
      </div>
      <div style={{ fontSize: P.type.strong, fontWeight: 600, color: P.ink, marginTop: 2 }}>{p.name}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: P.type.meta, color: P.inkDim, fontFamily: P.fontMono }}>
          {p.thc != null ? `${p.thc}% THC · ` : ''}{String(p.wt || '').toUpperCase()}
        </div>
        <div style={{ flex: 1 }} />
        <Stepper value={l.qty} min={0} size="lg" onChange={(n) => SHOP.setQty(l.id, n)} />
      </div>
      <div style={{ marginTop: 8 }}>
        {/* 🔴 Per-line lane assignment, driven by the customer. */}
        <PBtn size="md" variant="ghost" icon={otherMeta.icon} onClick={() => SHOP.setLane(l.id, other)}>
          Move to {otherMeta.label}
        </PBtn>
      </div>
    </div>
  </div>;
};

/** One lane block: header, progress, lines. */
window.ShopCartLane = function ShopCartLane({ lane }) {
  const entries = scartLaneLines(lane.lane);
  return <Card data-hw={`lane-${lane.lane}`} padding={0} style={{ overflow: 'hidden', marginBottom: 16 }}>
    <ShopLaneHeader lane={lane} arrival={scartArrival(lane.lane)} />
    <ShopLaneProgress lane={lane} />
    {entries.map((e) => <ShopCartLine key={e.line.id} entry={e} lane={lane.lane} />)}
  </Card>;
};

/** A summary row. Everything handed in is already a formatted engine figure. */
window.ShopSumRow = function ShopSumRow({ label, value, hint, strong, tone }) {
  const P = scUseP();
  return <div data-hw="sum-row" data-hw-kind={strong ? 'total' : 'row'} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' }}>
    <div style={{ fontSize: strong ? P.type.strong : P.type.body, color: strong ? P.ink : P.inkDim, fontWeight: strong ? 700 : 500, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      {label}{hint && <Icon name="info" size={12} stroke={2} color={P.inkMute} />}
    </div>
    <div style={{ flex: 1 }} />
    <div data-hw="sum-value" style={{ fontSize: strong ? P.type.numTotal : P.type.numRow, fontWeight: P.weight.num, color: tone || P.ink, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
  </div>;
};

/**
 * The promo card the frame draws in the right rail.
 *
 * ⚠️ THE SEAM DOES NOT EXIST YET, AND THIS SAYS SO RATHER THAN PRETENDING.
 * `shopContext()` in shop/data.jsx never sets `ctx.cart.appliedCodes`, so no
 * coded rule — WELCOME20 among them — can currently be applied to this cart.
 * Deciding what a code is worth HERE would be a second pricing authority, which
 * is the one thing this page must not grow. So the control renders in its
 * drawn position and stays inert with the reason on screen until
 * `window.SHOP.applyCode` exists, at which point it wires itself up.
 */
window.ShopPromoCard = function ShopPromoCard({ totals }) {
  const P = scUseP();
  const SHOP = window.SHOP;
  const [code, setCode] = React.useState('');
  const [note, setNote] = React.useState(null);
  const wired = typeof SHOP.applyCode === 'function';
  return <Card density="compact">
    <Eyebrow>Have a promo?</Eyebrow>
    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
      <Field icon="tag" placeholder="Promo Code" value={code} mono disabled={!wired}
        onChange={(e) => setCode(e.target.value)} />
      <PBtn variant="secondary" size="md" style={{ flex: '0 0 auto' }} disabled={!wired || !code.trim()}
        onClick={() => {
          const ok = SHOP.applyCode(code.trim().toUpperCase());
          setNote(ok ? null : `“${code.trim().toUpperCase()}” doesn’t discount this cart.`);
          if (ok) setCode('');
        }}>Apply</PBtn>
    </div>
    {!wired && <div style={{ fontSize: P.type.meta, color: P.inkDim, marginTop: 8, lineHeight: 1.5 }}>
      Promo codes aren’t connected to this cart yet. Automatic offers still apply.
    </div>}
    {note && <div style={{ fontSize: P.type.meta, color: P.inkDim, marginTop: 8 }}>{note}</div>}
    {totals.discounts.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
      {totals.discounts.map((d, i) => <Pill key={i} kind="good" icon="tag">{d.name} · −{SHOP.money(d.amountCents)}</Pill>)}
    </div>}
  </Card>;
};

/**
 * ORDER SUMMARY.
 *
 * 🔴 DELIVERY IS PRICED PER LANE. Separate "Express delivery" and "Scheduled
 * delivery" rows, each from its own lane's `feeCents`. Never one blended fee:
 * the two lanes become two orders, and a customer who moves a line between them
 * has to be able to see which fee moved.
 */
window.ShopOrderSummary = function ShopOrderSummary({ totals }) {
  const P = scUseP();
  const SHOP = window.SHOP;
  const laneOf = (id) => totals.lanes.find((l) => l.lane === id);
  const feeRow = (id, label) => {
    const l = laneOf(id);
    if (!l) return null;
    return <ShopSumRow label={label} value={l.feeCents === 0 ? 'FREE' : SHOP.money(l.feeCents)} />;
  };
  // 🔴 A FEE WAIVER IS NOT A LINE IN THIS COLUMN. The engine reports it in
  // `discounts` so a surface can NAME it, but it never enters `discountCents` —
  // it is expressed by the lane's `feeCents` already being 0. Printing it here
  // as well put a −$2.00 in a column that then did not add up to its own Total,
  // which is a money screen contradicting itself in front of the customer. It
  // is named on the promo card instead, where it is a badge and not a sum.
  const priceRows = totals.discounts.filter((d) => d.kind !== 'fee_waiver');
  return <Card data-hw="order-summary" density="compact">
    <Eyebrow>Order summary</Eyebrow>
    <div style={{ marginTop: 8 }}>
      <ShopSumRow label="Subtotal" value={SHOP.money(totals.subtotalCents)} />
      {priceRows.map((d, i) => <ShopSumRow key={i} label={d.name} value={`−${SHOP.money(d.amountCents)}`} tone={P.good} />)}
      {feeRow('express', 'Express delivery')}
      {feeRow('scheduled', 'Scheduled delivery')}
      <ShopSumRow label="Est. tax" hint value={SHOP.money(totals.taxCents)} />
      <div style={{ borderTop: `1px solid ${P.hairline2}`, marginTop: 6, paddingTop: 4 }}>
        <ShopSumRow strong label="Total" value={SHOP.money(totals.totalCents)} />
      </div>
    </div>
  </Card>;
};

// Shared with shop/screen-checkout.jsx, which must not grow its own copies.
window.SHOPCART_UI = { meta: scartMeta, arrival: scartArrival, tomorrow: scartTomorrow,
  laneLines: scartLaneLines, count: scartCount };

// ── The screen ─────────────────────────────────────────────────────────────

window.ShopCartScreen = function ShopCartScreen() {
  const P = scUseP();
  const SHOP = window.useShop();
  const totals = SHOP.totals();

  // `totals()` returns null when the engine has not loaded. An honest dead end
  // beats a page of NaN, and it is the same contract the adapter follows.
  if (!totals) {
    return <div style={{ padding: 24 }}>
      <ErrorState title="This cart can’t be priced"
        body="The commerce engine didn’t load, so no total on this page would be trustworthy."
        detail="shared/commerce-engine.js → shared/commerce-adapter.js must load before the storefront." />
    </div>;
  }

  return <div data-hw="shop-cart" style={{ padding: 24, maxWidth: 1180, margin: '0 auto' }}>
    <Eyebrow>Shop · Your cart</Eyebrow>
    <h1 style={{ margin: '8px 0 0', fontSize: P.type.h1, fontWeight: 700, letterSpacing: '-.02em', color: P.ink }}>Your cart</h1>
    {/* "4 ITEMS · 2 ORDERS" — itemCount and orderCount off the engine. */}
    <div data-hw="cart-counts" style={{ marginTop: 8 }}>
      <Eyebrow>{scartCount(totals.itemCount, 'ITEM')} · {scartCount(totals.orderCount, 'ORDER')}</Eyebrow>
    </div>

    {totals.orderCount === 0
      ? <div style={{ marginTop: 20 }}>
        <EmptyState icon="cart" title="Your cart is empty"
          body="Anything you add arrives express in about 90 minutes, or scheduled for a window that suits you." />
      </div>
      : <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap', marginTop: 20 }}>
        <div style={{ flex: '1 1 520px', minWidth: 300 }}>
          {totals.lanes.map((l) => <ShopCartLane key={l.lane} lane={l} />)}
        </div>
        <div style={{ flex: '0 1 320px', minWidth: 280, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ShopPromoCard totals={totals} />
          <ShopOrderSummary totals={totals} />
          <PBtn full variant="accent" size="xl" iconRight="chevron-right" onClick={() => SHOP.go('checkout')}>
            Checkout · {SHOP.money(totals.totalCents)}
          </PBtn>
        </div>
      </div>}
  </div>;
};
