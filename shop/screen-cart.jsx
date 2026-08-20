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

/**
 * 🔴 WHY "MOVE TO EXPRESS" IS NOT ALWAYS ON OFFER.
 *
 * Express is the driver's kit, and a kit has a depth. The control used to render
 * on every scheduled line unconditionally, so a customer could move a sku the
 * van is carrying NONE of into express — and was then quoted ~90 minutes and
 * charged the express fee for something no driver had. `shopSetLane` refuses
 * that move, which without this would just be a button that does nothing.
 *
 * Returns null when the move is available; otherwise the sentence to show in its
 * place.
 *
 * ⚠️ TONE IS PART OF THE FIX, not decoration on it. The lane minimum next to
 * this is drawn as PROGRESS and never as a refusal, and this has to match: the
 * item is not unavailable, not out of stock, and nothing is blocked — it simply
 * ARRIVES TOMORROW, which is what the scheduled lane is. The words "unavailable"
 * and "out of stock" are wrong here and are the reason this returns prose rather
 * than a boolean.
 */
function scartExpressNote(sku, qty) {
  const D = window.SHOPDATA;
  if (!D || typeof D.expressHeadroom !== 'function') return null;
  if (D.expressHeadroom(sku) >= qty) return null;        // the move can be honoured
  const units = D.expressUnits(sku);
  return units === 0
    ? 'Arrives tomorrow — today’s van isn’t carrying this one.'
    : `Arrives tomorrow — today’s van is carrying ${units}.`;
}


// ── THE UPSELL ENGINE, ON THE STOREFRONT ───────────────────────────────────
//
// 🔴 THE OFFERS ARE THE ENGINE'S. THIS FILE RANKS NOTHING AND PRICES NOTHING.
//
// `HWCommerce.getUpsells(ctx, surface, …)` decides what to show, in what order,
// and how many. It is handed the SAME context `SHOP.totals()` is priced from —
// `SHOP.context()`, which carries the per-line lanes and the operator's lane
// economics — and the SAME rule set, `SHOP.engineOptions().rules`. Both of those
// matter: an unlock card derived from a rule that is not pricing this cart is a
// promise the summary underneath it will not keep.
//
// What this file adds on top is ONE thing the engine cannot know, below.

/**
 * Offers the customer has waved away this visit.
 *
 * "A dismissed offer does not come back for that visit" — so this is module
 * scope, not component state: the cart and the checkout are two screens reading
 * one engine, and a dismissal that only lived in the cart's `useState` came
 * straight back the moment the customer pressed Checkout. It is handed to
 * `getUpsells` as `dismissed`, which suppresses while BUILDING rather than
 * after slicing, so dismissing a card backfills the rail instead of shrinking it.
 */
const SCART_DISMISSED = new Set();
function scartDismiss(id) { if (id) { SCART_DISMISSED.add(id); window.SHOP.toast('Okay — we won’t show that again.'); } }
function scartDismissed(id) { return SCART_DISMISSED.has(id); }

/**
 * 🔴 THE ONE THING THE ENGINE IS WRONG ABOUT HERE, AND WHY.
 *
 * "An offer must never be for something undeliverable in the customer's lane."
 * The engine enforces exactly that — `respectLaneAvailability` checks
 * `unitsAvailable(snapshot, id, lane)` before it will build a card. But the
 * snapshot it is checking comes from `HWSwap.buildContext`, which says, in its
 * own comment, that this estate has ONE stock figure per product and reports it
 * for both lanes: `availability[id] = { express: qty, scheduled: qty }`.
 *
 * `qty` is WAREHOUSE on-hand. Express is the driver's kit. So the engine will
 * happily offer an express shopper a sku with 200 in the warehouse and none on
 * today's van — an offer that, taken, becomes a ~90-minute promise nobody can
 * keep. That is the same falsehood `shopAdd` and "Move to Express" already
 * refuse, and it is refused here from the same authority: `expressHeadroom`.
 *
 * Scheduled IS served from the warehouse, so the engine's answer stands there.
 */
function scartDeliverable(sku, quantity, lane) {
  const D = window.SHOPDATA;
  if (!D) return false;
  if (lane !== 'express') return true;
  if (typeof D.expressHeadroom !== 'function') return false;
  return D.expressHeadroom(sku) >= Math.max(1, quantity || 1);
}

/**
 * The engine's config with one surface's slot count widened.
 *
 * Same shape the adapter's `recommendations()` uses. Override the SLOT, never
 * the ranking: how many cards a surface holds is a layout fact, which of them
 * wins is the engine's judgement and not this file's.
 */
function scartConfig(surface, slots) {
  const E = window.HWCommerce;
  if (!E || !E.defaultConfig || !slots) return undefined;
  return Object.assign({}, E.defaultConfig, {
    upsell: Object.assign({}, E.defaultConfig.upsell, {
      slotsBySurface: Object.assign({}, E.defaultConfig.upsell.slotsBySurface, { [surface]: slots }),
    }),
  });
}

/**
 * Everything to render on one upsell surface, joined back to the estate's own
 * catalogue row so a card can draw a Thumb and a price the rest of the shop
 * agrees with.
 *
 * Returns `[]` — never a fallback list of our own — when the engine is absent.
 * A hand-rolled "same brand" rail that appears when the engine is down is a
 * second recommender nobody is measuring, and it looks identical to the real one.
 */
function scartOffers(surface, opts) {
  const E = window.HWCommerce, SHOP = window.SHOP, D = window.SHOPDATA;
  if (!E || typeof E.getUpsells !== 'function' || !SHOP || !D) return [];
  const ctx = SHOP.context();
  if (!ctx) return [];
  const o = opts || {};
  const cfg = scartConfig(surface, o.slots);
  let offers;
  try {
    offers = E.getUpsells(ctx, surface, Object.assign({
      rules: SHOP.engineOptions().rules,
      dismissed: Array.from(SCART_DISMISSED),
    }, cfg ? { config: cfg } : {}, o.lane ? { lane: o.lane } : {})) || [];
  } catch (err) { return []; }
  return offers
    .map((offer) => ({ offer, product: D.productBySku(offer.product.id) }))
    .filter((x) => x.product && scartDeliverable(x.product.sku, x.offer.quantity, x.offer.lane));
}

/**
 * Does taking this offer carry its lane over the lane minimum?
 *
 * 🔴 THE THRESHOLD IS THE ENGINE'S, AND IT IS THE SAME OBJECT THE BAR DREW.
 *
 * `lane` here is one entry of `SHOP.totals().lanes` — the very record
 * `ShopLaneProgress` renders three lines above this card. So the badge and the
 * bar cannot disagree: there is no second reading of the minimum, and there is
 * no $50 typed anywhere. The minimum is operator-controlled (`HW.laneSettings`,
 * applied to the context in shop/data.jsx), and a literal here would silently
 * contradict the progress bar the moment an operator moved it — which is the
 * two-money-authorities bug this project has already shipped and reverted.
 *
 * The arithmetic is one comparison in the engine's own cents: the offer clears
 * the shortfall, therefore the lane clears its minimum. It is only true because
 * `scartDeliverable` has already refused any offer the lane cannot take whole.
 */
function scartMeetsMinimum(offer, laneTotals) {
  if (!laneTotals || laneTotals.minimumMet) return false;
  if (offer.lane !== laneTotals.lane) return false;
  return offer.product.price * Math.max(1, offer.quantity || 1) >= laneTotals.shortfallCents;
}

/**
 * "Spend $X more for free delivery" — the threshold upsell the Figma draws, read
 * off the promotion that actually grants it.
 *
 * This is NOT the lane minimum. `free-express-over-100` waives a $2 fee at a
 * $100 express subtotal; the express MINIMUM is a different number, set by the
 * operator, and the progress bar owns it. Two different thresholds, two
 * different sentences — never merged, and neither one typed here.
 *
 * ⚠️ WHY THIS DOES NOT COME OUT OF `getUpsells`. It cannot, and correctly so:
 * `offerFromRule` refuses any card whose ask costs more than
 * `maxSpendToRewardRatio × reward`, and a free-delivery reward is worth the
 * lane's fee. Asking a customer to spend $37 to save $2 is exactly the card the
 * engine is right to suppress. But the PROGRESS is still worth stating, which is
 * what `promotionProgress` exists for — so this reads the rule's own gap.
 *
 * ⚠️ AND WHY IT FILTERS FIRST. `evaluateRule` answers "is this rule satisfied",
 * not "may this customer have it". WELCOME20 is first-order-only and Marcus has
 * two orders behind him: its order-count condition is `unreachable`, but its
 * $60 subtotal condition still reports a perfectly closable spend gap. Rendering
 * that gap would advertise a $20 discount this cart can never earn. So: live,
 * on-channel, still available to this customer, its code actually applied — and
 * for an AND rule, exactly ONE unmet condition, because closing one gap of two
 * satisfies nothing.
 */
/** What a rule is actually worth here, in cents, or null when the engine cannot
 *  say. Used to refuse advertising a reward of nothing. */
function scartRewardCents(rule, ctx, E) {
  try {
    if (typeof E.rewardValueCents === 'function') return E.rewardValueCents(rule, ctx);
    const rw = rule && rule.reward;
    if (!rw) return null;
    if (typeof rw.amountCents === 'number') return rw.amountCents;
    if (typeof rw.percent === 'number' && ctx.cart) {
      // A percentage of nothing is nothing, which is the case that matters.
      const sub = (ctx.cart.lines || []).reduce((n, l) => n + (l.unitPriceCents || 0) * (l.quantity || 0), 0);
      return Math.round(sub * (rw.percent / 100));
    }
    return null;                         // unknown shape — do not refuse on a guess
  } catch (err) { return null; }
}

function scartSavings() {
  const E = window.HWCommerce, SHOP = window.SHOP;
  if (!E || typeof E.evaluateRule !== 'function' || !SHOP) return [];
  const ctx = SHOP.context();
  if (!ctx) return [];
  const codes = new Set((ctx.cart && ctx.cart.appliedCodes) || []);
  const out = [];
  for (const rule of SHOP.engineOptions().rules || []) {
    const id = 'savings:' + rule.id;
    if (scartDismissed(id)) continue;
    if (rule.code && !codes.has(rule.code)) continue;
    try {
      if (!E.isRuleActive(rule, ctx.now)) continue;
      if (!E.isRuleOnChannel(rule, ctx)) continue;
      /* 🔴 THIS LINE WAS LITERALLY `if (false) continue;` — a dead gate.
       *
       * The engine's own gate list (offerFromRule) runs isRuleOnChannel AND
       * isRuleAvailableToCustomer. Without the second one this line advertised
       * members-only and audience-restricted rewards to everybody, and the
       * shopper could not have claimed a single one of them. */
      if (typeof E.isRuleAvailableToCustomer === 'function'
        && !E.isRuleAvailableToCustomer(rule, ctx)) continue;
    } catch (err) { continue; }
    let r;
    try { r = E.evaluateRule(rule, ctx); } catch (err) { continue; }
    if (r.satisfied) continue;
    const unmet = r.conditions.filter((c) => !c.satisfied);
    if (rule.combiner !== 'OR' && unmet.length !== 1) continue;
    /* THE ENGINE CHECKS TWO MORE THINGS BEFORE IT WILL OFFER A RULE, and this
     * reimplementation omitted both:
     *
     *  · A REWARD WORTH NOTHING IS NOT AN OFFER. offerFromRule refuses when
     *    rewardValueCents <= 0. Without it the cart told a shopper to spend
     *    more to unlock $0.00.
     *  · ADVICE THAT CANNOT BE TAKEN IS NOT ADVICE. A gap is only closable in a
     *    lane the cart can actually reach; the engine picks a product for the
     *    gap and re-evaluates. A spend gap in a lane the van cannot serve reads
     *    as "add $12 more" against an impossibility.
     *
     * ⚠️ THIS WHOLE FUNCTION IS A REIMPLEMENTATION OF offerFromRule, WHICH IS
     * WHY IT DRIFTED. `getUpsells` IS exported on window.HWCommerce and is the
     * right long-term home for this line — replacing it is a bigger change than
     * this fix and belongs with someone who can re-verify the cart UI against
     * it. Recorded rather than silently left. */
    const spend = r.closableGaps.filter((g) => g.kind === 'spend')
      .sort((a, b) => a.amountCents - b.amountCents)[0];
    if (!spend) continue;
    const worth = scartRewardCents(rule, ctx, E);
    if (worth != null && worth <= 0) continue;
    if (spend.lane && ctx.lanes && !ctx.lanes[spend.lane]) continue;
    out.push({ id, rule, gap: spend, rewardCents: worth });
  }
  return out.sort((a, b) => a.gap.amountCents - b.gap.amountCents);
}

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
  // Only the move INTO express can be un-keepable — the scheduled lane is served
  // from the warehouse and takes anything.
  const note = other === 'express' ? scartExpressNote(p.sku, l.qty) : null;
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
        {/* 🔴 Per-line lane assignment, driven by the customer — but only offered
            where the van can honour it. See scartExpressNote. */}
        {note
          ? <div data-hw="lane-note" style={{ display: 'flex', alignItems: 'center', gap: 7, minHeight: P.ctrlH.md, fontSize: P.type.meta, color: P.inkDim }}>
            <Icon name="calendar" size={14} stroke={1.9} color={P.inkMute} />
            <span>{note}</span>
          </div>
          : <PBtn size="md" variant="ghost" icon={otherMeta.icon} onClick={() => SHOP.setLane(l.id, other)}>
            Move to {otherMeta.label}
          </PBtn>}
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
  laneLines: scartLaneLines, count: scartCount, expressNote: scartExpressNote,
  // The upsell seam. shop/screen-checkout.jsx renders the SAME rail on its own
  // engine surface and shares this one dismissal set — a card waved away in the
  // cart must not reappear one screen later, which is what "for that visit"
  // means when the visit crosses two screens.
  offers: scartOffers, savings: scartSavings, deliverable: scartDeliverable,
  meetsMinimum: scartMeetsMinimum, dismiss: scartDismiss, dismissed: scartDismissed,
  DISMISSED: SCART_DISMISSED };

/**
 * One offer, as the engine wrote it.
 *
 * `headline`, `subline` and `reason` are the ENGINE'S COPY and are printed
 * verbatim — a rewrite here would be a second voice describing a promotion the
 * merchandiser authored once, and the two would drift on the first edit. The
 * only sentence this component owns is the lane one, because the lane promise is
 * the estate's, not the engine's.
 */
window.ShopOfferCard = function ShopOfferCard({ entry, laneTotals, onChange }) {
  const P = scUseP();
  const SHOP = window.SHOP;
  const o = entry.offer, p = entry.product;
  const meta = scartMeta(o.lane);
  const unlocks = o.kind === 'unlock_promotion';
  const meets = scartMeetsMinimum(o, laneTotals);
  return <Card data-hw="upsell-offer" data-hw-offer={o.id} density="compact"
    style={{ flex: '1 1 240px', minWidth: 220, display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <Thumb item={p} size={44} radius={P.r10} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: P.type.strong, fontWeight: 700, color: unlocks ? P.good : P.ink, lineHeight: 1.3 }}>
          {o.headline}
        </div>
        <div style={{ fontSize: P.type.meta, color: P.inkDim, marginTop: 3, lineHeight: 1.45 }}>{o.subline}</div>
      </div>
      {/* 40×40 by construction — the dismiss is a real touch target, not a
          6px glyph in a corner. */}
      <IconBtn icon="x" size={15} label={`Dismiss ${o.headline}`}
        onClick={() => { scartDismiss(o.id); onChange && onChange(); }} />
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {o.reason && <Pill kind={unlocks ? 'good' : 'neutral'} size="sm" icon={unlocks ? 'tag' : 'sparkle'}>{o.reason}</Pill>}
      {/* 🔴 The lane minimum, from the same lane record the progress bar drew. */}
      {meets && <Pill kind="good" size="sm" icon="check">Meets the {meta.label} minimum</Pill>}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Pill kind="ghost" size="sm" icon={meta.icon}>{meta.label}</Pill>
      <div style={{ flex: 1 }} />
      <PBtn size="md" variant="secondary" icon="plus" onClick={() => {
        // The lane is the engine's, and `shopAdd` is still the authority on
        // whether it can be honoured — `scartDeliverable` has already made sure
        // it can, so this lands whole rather than spilling into tomorrow.
        SHOP.add(p.sku, o.quantity, o.lane);
        SHOP.toast(`${p.name} added · ${meta.label}`);
        onChange && onChange();
      }}>Add</PBtn>
    </div>
  </Card>;
};

/**
 * ADD TO YOUR ORDER — one engine surface, drawn.
 *
 * Renders nothing at all when the engine returns nothing. An empty rail with a
 * heading over it is a surface reporting that it has no opinion, and on a cart
 * page that reads as something broken.
 */
window.ShopUpsellRail = function ShopUpsellRail({ surface, title, totals, slots, onChange }) {
  const P = scUseP();
  const entries = scartOffers(surface, { slots });
  if (!entries.length) return null;
  const laneOf = (id) => (totals && totals.lanes.find((l) => l.lane === id)) || null;
  return <div data-hw="upsell-rail" data-hw-surface={surface} style={{ marginBottom: 16 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <Icon name="sparkle" size={14} stroke={2} color={P.inkMute} />
      <Eyebrow>{title}</Eyebrow>
    </div>
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'stretch' }}>
      {entries.map((e) => <ShopOfferCard key={e.offer.id} entry={e}
        laneTotals={laneOf(e.offer.lane)} onChange={onChange} />)}
    </div>
  </div>;
};

/**
 * "Add $37.50 more · Free Express delivery over $100."
 *
 * The threshold upsell as a SAVINGS LINE, which is the surface the engine names
 * for it (`cart_savings_line`) and the shape the frame draws: a sentence beside
 * the money, not a card. Every figure is `gap.amountCents`, straight off the
 * rule's own unmet condition — see `scartSavings` for what is filtered out
 * before anything reaches here, and why.
 */
window.ShopSavingsLines = function ShopSavingsLines({ onChange }) {
  const P = scUseP();
  const SHOP = window.SHOP;
  const rows = scartSavings();
  if (!rows.length) return null;
  return <Card data-hw="savings-lines" density="compact">
    <Eyebrow>Almost unlocked</Eyebrow>
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((r) => <div key={r.id} data-hw="savings-line" data-hw-rule={r.rule.id}
        style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon name="gift" size={15} stroke={1.9} color={P.good} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: P.type.body, fontWeight: 600, color: P.ink }}>
            Add {SHOP.money(r.gap.amountCents)} more
          </div>
          <div style={{ fontSize: P.type.meta, color: P.inkDim, marginTop: 2, lineHeight: 1.45 }}>{r.rule.name}</div>
        </div>
        <IconBtn icon="x" size={15} label={`Dismiss ${r.rule.name}`}
          onClick={() => { scartDismiss(r.id); onChange && onChange(); }} />
      </div>)}
    </div>
  </Card>;
};

// ── The screen ─────────────────────────────────────────────────────────────

window.ShopCartScreen = function ShopCartScreen() {
  const P = scUseP();
  const SHOP = window.useShop();
  // Dismissing an offer changes no cart line, so nothing in `SHOP` has to move
  // for the rail to be right afterwards. This is how that write reaches the
  // screen — the same reason the checkout keeps a bump for SCO_STATE.
  const [, bump] = React.useReducer((x) => x + 1, 0);
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
          {/* The engine's cart surface, under the lanes it is reasoning about. */}
          <ShopUpsellRail surface="cart_add_to_order" title="Add to your order"
            totals={totals} onChange={bump} />
        </div>
        <div style={{ flex: '0 1 320px', minWidth: 280, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Thresholds sit with the money they change, above the summary. */}
          <ShopSavingsLines onChange={bump} />
          <ShopPromoCard totals={totals} />
          <ShopOrderSummary totals={totals} />
          <PBtn full variant="accent" size="xl" iconRight="chevron-right" onClick={() => SHOP.go('checkout')}>
            Checkout · {SHOP.money(totals.totalCents)}
          </PBtn>
        </div>
      </div>}
  </div>;
};
