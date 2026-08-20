// ── Register screen — New Sale (product picker + cart) ─────────────────────
const useP = window.useP;

// Tax is window.HW.taxBreakdown and nothing else. This file used to carry its
// own `TAX = 0.0822`, which is why the footer could show "Taxes (23.22%) $12.40"
// above a Total that had only charged 8.22% — two tax models, one sale.
// A discount comes off the MERCHANDISE subtotal, and tax is charged on what is
// left, so the customer is not taxed on money they did not pay.
const round2 = (n) => Math.round((+n || 0) * 100) / 100;
const taxOn = (base) => window.HW.taxBreakdown(base).total;
const PAY_LABEL = { cash: 'Cash', card: 'Card', split: 'Split', wallet: 'Wallet' };

window.RegisterScreen = function RegisterScreen() {
  const P = useP();
  // Reads HW.* AND writes to it (a completed sale creates an order), so it has
  // to subscribe — otherwise a real write still looks like nothing happened.
  const HW = window.useHW();
  const products = HW.PRODUCTS;
  // ── Tickets ─────────────────────────────────────────────────────────────
  // A party is ONE ticket by default — one cart, one checkout, which is what
  // most visits are. A guest only gets their own ticket when the associate
  // opens one for them, and the tab strip appears only once that happens.
  // A check-in that said "& start sale" hands the person over here. Taking it is
  // what makes the sale open on THEM instead of on the demo ticket below.
  const [pending] = React.useState(() => window.HW.takePendingSale ? window.HW.takePendingSale() : null);
  // `discounts` lives on the TICKET, not inside the discount card: a discount is
  // money off THIS sale, so it has to survive a re-render, follow the ticket the
  // party is on, and be readable by the tender that records the order.
  const [tickets, setTickets] = React.useState(() => pending && pending.customer ?
    [{ id: 't1', person: pending.customer, cart: [], paid: false, discounts: [] }] :
    [{ id: 't1', person: window.HW.MEMBERS[2],
    cart: [{ sku: 'H480PRO1', qty: 1, disc: 0 }, { sku: 'F2Q4EN2C', qty: 1, disc: 0 }], paid: false, discounts: [] }]);
  const [active, setActive] = React.useState(0);
  const [guests, setGuests] = React.useState(() => pending ? pending.guests || [] : [
  { key: 'g-mia', id: null, name: 'Mia Tran', dob: '09/02/1988', phone: '(951) 555-0121', member: false, doc: { onFile: true } },
  { key: 'g-sam', id: null, name: 'Sam Cole', dob: '12/21/1995', phone: '', member: false, doc: { onFile: true } }]); // party roster captured at check-in
  const [tab, setTab] = React.useState('products');
  const [cat, setCat] = React.useState('All');
  const [smart, setSmart] = React.useState('none'); // (legacy) smart up-sell filter
  const [brands, setBrands] = React.useState(() => new Set()); // brand multi-select
  const [q, setQ] = React.useState('');
  const [pay, setPay] = React.useState('cash');
  const [discMode, setDiscMode] = React.useState('$');
  const [showPay, setShowPay] = React.useState(false);
  const [payScope, setPayScope] = React.useState('ticket'); // ticket | party (one tender, N orders)
  // The POS.lastSale as it stood when the tender opened. See closePay.
  const payMark = React.useRef(null);
  const [showCheckIn, setShowCheckIn] = React.useState(false);
  const [queueOpen, setQueueOpen] = React.useState(true); // committed sliding check-in queue
  const [showDetails, setShowDetails] = React.useState(false); // member-details dropdown
  const [chipView, setChipView] = React.useState('bar'); // claimed-customer layout: bar | detailed | compact
  const [toast, setToast] = React.useState(null);
  // "For this ticket" — engine ranking over the product grid. See `rankRecs`.
  const [rankOn, setRankOn] = React.useState(false);
  const [rankBasis, setRankBasis] = React.useState(null);

  const t = tickets[active] || tickets[0];
  const customer = t ? t.person : null;
  const cart = t ? t.cart : [];
  const multi = tickets.length > 1;
  // Emptying the cart empties the discounts with it — on EVERY path, not just
  // the Clear button. setQty(0) and the per-line trash used to strip the last
  // line and leave a $5 discount sitting on an empty ticket. The footer hides
  // it (discountOff is capped at the merchandise total, so an empty cart shows
  // nothing) right up until the next product is added, and then that sale is
  // silently mispriced. One place, so no future caller can reintroduce it.
  const setCart = (v) => setTickets((ts) => ts.map((x, i) => {
    if (i !== active) return x;
    const next = typeof v === 'function' ? v(x.cart) : v;
    return next.length === 0 ? { ...x, cart: next, discounts: [], upsellHidden: [] } : { ...x, cart: next };
  }));
  // A fresh check-in replaces the whole ticket set — new visit, new sale.
  const openVisit = (person, g) => {setTickets([{ id: 't1', person, cart: [], paid: false, discounts: [] }]);setActive(0);setGuests(g || []);};

  // ── Discounts ───────────────────────────────────────────────────────────
  // One discount per KIND — one approved manual discount, one reward, one promo
  // code. Applying a second of the same kind replaces the first rather than
  // quietly stacking two, which is how a $5 discount becomes $15 off.
  const discounts = (t && t.discounts) || [];
  const setDiscount = (kind, d) => setTickets((ts) => ts.map((x, i) => i === active ?
  { ...x, discounts: [...(x.discounts || []).filter((e) => e.kind !== kind), ...(d ? [{ ...d, kind }] : [])] } : x));
  const applyDiscount = (d) => {setDiscount(d.kind, d);flash(`${window.HW.fmt.money(d.off)} off · ${d.label}`);};
  const removeDiscount = (kind) => setDiscount(kind, null);
  // Emptying the cart empties the discounts with it — a $5 discount sitting on
  // an empty ticket is the next sale's mispriced surprise.
  const clearTicket = () => setTickets((ts) => ts.map((x, i) => i === active ? { ...x, cart: [], discounts: [], upsellHidden: [] } : x));

  // ── Dismissed suggestions ───────────────────────────────────────────────
  // A "no thanks" is worth exactly one sale. It lives on the TICKET, next to
  // the discounts, for the same reason they do: CartPane never unmounts between
  // sales, so a dismissal held in its own state would follow the associate to
  // the next customer — who never said no to anything. Every path that empties
  // a ticket (clear, tender, party tender, last line removed) empties this too.
  const upsellHidden = (t && t.upsellHidden) || [];
  const dismissUpsell = (sku) => setTickets((ts) => ts.map((x, i) => i === active ?
  { ...x, upsellHidden: (x.upsellHidden || []).includes(sku) ? x.upsellHidden : [...x.upsellHidden || [], sku] } : x));

  // Keep the floating switcher / tour launcher off the TENDER button.
  React.useEffect(() => {
    document.body.setAttribute('data-hw-float', 'clear-cart');
    return () => document.body.removeAttribute('data-hw-float');
  }, []);

  const find = (sku) => products.find((p) => p.sku === sku);
  // A paid ticket is a closed transaction. Letting items back onto it re-arms
  // the TENDER button on a ticket that has already been charged, which is the
  // second-order bug by another door.
  const add = (p) => {
    if (t && t.paid) {flash(`${t.person.name.split(' ')[0]}’s ticket is paid — open a new ticket to sell more`);return;}
    setCart((c) => {const e = c.find((x) => x.sku === p.sku);if (e) return c.map((x) => x.sku === p.sku ? { ...x, qty: x.qty + 1 } : x);return [...c, { sku: p.sku, qty: 1, disc: 0 }];});
  };
  const setQty = (sku, qty) => setCart((c) => qty <= 0 ? c.filter((x) => x.sku !== sku) : c.map((x) => x.sku === sku ? { ...x, qty } : x));
  const remove = (sku) => setCart((c) => c.filter((x) => x.sku !== sku));

  const lines = cart.map((c) => {const p = find(c.sku);return { ...c, p, total: (p.price - c.disc) * c.qty };});
  // merch → what the goods cost · discountOff → what comes off before tax
  // sub   → the taxable subtotal · total → what the customer actually pays
  const merch = round2(lines.reduce((s, l) => s + l.total, 0));
  const offSum = (ds) => round2((ds || []).reduce((s, d) => s + (+d.off || 0), 0));
  const discountOff = Math.min(merch, offSum(discounts));
  const sub = round2(merch - discountOff);
  const tax = taxOn(sub);
  const total = round2(sub + tax);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const merchOf = (c) => round2(c.reduce((s, x) => {const p = find(x.sku);return s + (p ? (p.price - x.disc) * x.qty : 0);}, 0));
  const offOf = (tk) => Math.min(merchOf(tk.cart), offSum(tk.discounts));
  const subOf = (tk) => round2(merchOf(tk.cart) - offOf(tk));
  // A paid ticket is emptied when it is paid, so it can no longer price itself.
  // `paidTotal` is what the order that closed it actually recorded, which keeps
  // the party bar honest instead of dropping to zero the moment a guest pays.
  const totalOf = (tk) => {if (tk.paid) return round2(tk.paidTotal || 0);const s = subOf(tk);return round2(s + taxOn(s));};
  const partyTotal = round2(tickets.reduce((s, x) => s + totalOf(x), 0));
  // The open half of the party — what a single "Pay all" tender is charging.
  // Summed the same way each ticket prices itself (2-dp subtotal + 2-dp tax),
  // so the one amount taken at the drawer equals the sum of the orders written.
  const openT = tickets.filter((x) => !x.paid && x.cart.length > 0);
  const partySub = round2(openT.reduce((s, x) => s + subOf(x), 0));
  const partyTax = round2(openT.reduce((s, x) => s + taxOn(subOf(x)), 0));
  const partyDue = round2(partySub + partyTax);
  const partyCount = openT.reduce((s, x) => s + x.cart.reduce((n, c) => n + c.qty, 0), 0);

  const flash = (m) => {setToast(m);setTimeout(() => setToast(null), 1800);};

  // Open a separate ticket for someone already in the party. Only possible for
  // a guest whose ID is on record — a ticket is a legal transaction.
  const startTicket = (g) => {
    const gn = window.guestName ? window.guestName(g) : g;
    const m = window.HW.MEMBERS.find((x) => x.name === gn) || (g && g.id ? window.HW.memberById(g.id) : null);
    const person = m || { id: (g && g.key) || 'g-' + gn, name: gn, email: '—', phone: g && g.phone || '—',
      points: 0, visits: 1, wallet: 0, type: 'AdultUse', member: false, guestOf: customer && customer.name };
    setTickets((ts) => {setActive(ts.length);return [...ts, { id: 't' + (ts.length + 1), person, cart: [], paid: false, discounts: [] }];});
    flash(`Separate ticket opened for ${gn.split(' ')[0]}`);
  };
  const dropTicket = (i) => {
    if (i === 0) return;
    setTickets((ts) => ts.filter((_, idx) => idx !== i));
    setActive((a) => a >= i ? Math.max(0, a - 1) : a);
  };
  const hasTicket = (name) => tickets.some((x) => x.person && x.person.name === name);

  // Load a waiting check-in into the sale (brings their party captured at check-in)
  const loadCheckIn = (ci) => {
    const m = window.HW.MEMBERS.find((x) => x.id === ci.memberId) || { name: ci.name, points: 0, type: ci.type, member: ci.member };
    openVisit(m, ci.guests || []);
    flash(`${ci.name} loaded${ci.guests && ci.guests.length ? ` \u00b7 ${ci.guests.length} guest${ci.guests.length > 1 ? 's' : ''}` : ''}`);
  };
  // Completed new check-in from the modal
  const onCheckIn = ({ customer: c, guests: g }) => {
    openVisit(c, g || []);setShowCheckIn(false);
    flash(`${c.name} checked in${g && g.length ? ` with ${g.length} guest${g.length > 1 ? 's' : ''}` : ''}`);
  };
  // Search → select checks the customer in (no separate check-in button needed)
  const checkInCustomer = (m) => {openVisit(m, []);flash(`${m.name.split(' ')[0]} checked in`);};
  // ── Recording the sale ──────────────────────────────────────────────────
  // The money record the ORDER PANEL prices. Exactly the shape seedOrderMoney
  // produces in pos/screen-orders.jsx — seed, lines, discReason, discAmt,
  // promo, promoAmt, referral, referralAmt, credits — built from what the till
  // actually did rather than re-derived later. There is no second pricer here:
  // priceOrderMoney() remains the one place a total is computed, and this is
  // the input it was always supposed to be given.
  //
  // Split by KIND, because that shape has a rung for each: a promo code is
  // promo/promoAmt, a referral is referral/referralAmt, and an approved manual
  // discount or a redeemed reward is the plain discount. Folding a promo into
  // the anonymous discount line would price identically and describe the sale
  // wrongly, which is the same failure one step quieter.
  //
  // `seed` is computed the way seedOrderMoney computes it, from the record as
  // filed, so a till-written record is indistinguishable in shape from a seeded
  // one and nothing downstream has to know which it is holding.
  const ticketMoney = (rec, tkLines, ds, credits) => {
    const ofKind = (k) => (ds || []).filter((d) => d.kind === k);
    const amtOf = (list) => round2(list.reduce((s, d) => s + (+d.off || 0), 0));
    const promoD = ofKind('promo');
    const refD = ofKind('referral');
    const plain = (ds || []).filter((d) => d.kind !== 'promo' && d.kind !== 'referral');
    // 🔴 CLAMP THE SAME WAY THE DRAWER DID. The till takes
    // `off = Math.min(lineMerch, offSum(ds))`, but the components were filed
    // RAW — so a ticket discounted past its own merchandise total recorded a
    // bigger discount than was actually given, and the receipt showed money
    // coming off that never did. Scale the parts down in proportion so they sum
    // to what was really allowed.
    const merch = round2(tkLines.reduce((s2, l) => s2 + l.total, 0));
    const raw = round2(amtOf(plain) + amtOf(promoD) + amtOf(refD));
    const k = raw > merch && raw > 0 ? merch / raw : 1;
    const share = (list) => round2(amtOf(list) * k);
    // Several discounts of the same kind used to be recorded as the FIRST one's
    // label, so a sale with two manual discounts filed one reason for both.
    const reasonOf = (list) => list.length > 1
      ? list.map((d) => d.label).filter(Boolean).join(' + ')
      : list[0] && list[0].label || 'Discount applied';
    return {
      seed: (rec.id ? rec.id.length : 5) + (rec.name || '').length + (rec.items || 1),
      lines: tkLines.map((l) => ({ ...l })),
      discReason: reasonOf(plain),
      discAmt: share(plain),
      promo: promoD[0] && (promoD[0].code || promoD[0].label) || null,
      promoAmt: share(promoD),
      referral: refD[0] && (refD[0].code || refD[0].label) || null,
      referralAmt: share(refD),
      // Off the GRAND total, after tax — a credit is not a discount. The sale
      // was for the full amount and part of it was settled another way.
      credits: round2(credits) };

  };

  // The receipt used to name an order id that was never created: the tender
  // reset the ticket and wrote nothing, so a completed sale appeared in no
  // queue, on no board, in no report. This is the write.
  //
  // The payment modal mints its own receipt id. Reuse it when it is free, so
  // the paper and the queue name the same order; fall back to the store's own
  // sequence when it collides, because two orders sharing an id is worse than
  // a receipt whose number is one off.
  //
  // `creditsApplied` is the part of the bill settled with points or wallet
  // money. pos/payment.jsx runs its own credit path — the CASH_REWARDS ladder
  // and the wallet field — which reduces the drawer's `balance` and never
  // touches the cart total. Recording totalOf(tk) therefore filed an order for
  // MORE money than was collected: the receipt said "Collected $36.93" and the
  // queue said $39.43 for the same sale. The order records the money taken,
  // and keeps the pre-credit figure alongside it so nothing is hidden.
  const recordTicket = (tk, sale, creditsApplied) => {
    if (!tk) return null;
    const tkLines = tk.cart.map((c) => {const p = find(c.sku);return { sku: c.sku, name: p ? p.name : c.sku, qty: c.qty, price: p ? p.price : 0, total: p ? round2((p.price - c.disc) * c.qty) : 0 };});
    const items = tkLines.reduce((s, l) => s + l.qty, 0);
    const ds = tk.discounts || [];
    // Priced off THE LINES THIS ORDER FILES, not off the live cart. Those same
    // lines become the money record below, so the amount taken at the drawer
    // and the amount priceOrderMoney() reads back are two views of one set of
    // numbers rather than two independent sums that happen to agree today.
    const lineMerch = round2(tkLines.reduce((s, l) => s + l.total, 0));
    const off = Math.min(lineMerch, offSum(ds));
    const netSub = round2(lineMerch - off);
    const gross = round2(netSub + taxOn(netSub));
    const credits = round2(Math.min(gross, Math.max(0, +(creditsApplied || 0))));
    const collected = round2(gross - credits);
    const reuse = sale && sale.id && !HW.orderById(sale.id) ? sale.id : null;
    const rec = HW.addOrder({
      // id AND num together — addOrder numbers from its own sequence, so
      // handing it only the id files ORD-00240 on the board as "#00230".
      id: reuse || undefined,
      num: reuse ? reuse.replace(/^ORD-/, '') : undefined,
      name: tk.person && tk.person.name || sale && sale.name || 'Walk-in',
      // By ID, so a return credits the wallet of the person who actually bought
      // it rather than whoever shares the name on the ticket. A walk-in has no
      // id and gets null, which the return panel reports honestly.
      memberId: tk.person && (tk.person.memberId || tk.person.id) || null,
      total: collected, items, lines: tkLines,
      pay: PAY_LABEL[sale && sale.method || pay] || 'Cash',
      source: 'Stilo', channel: 'Store',
      badge: tk.person && tk.person.member ? 'Member' : null,
      stage: 'verify' });
    // addOrder writes a fixed shape, so the discount detail is patched on: the
    // sale is not honestly recorded if the money that came off it is missing.
    if (rec && off > 0) HW.updateOrder(rec.id, {
      discount: off,
      discounts: ds.map((d) => ({ kind: d.kind, label: d.label, off: round2(d.off), mgr: d.mgr || null, reason: d.reason || null, code: d.code || null, points: d.points || 0 })),
      points: round2(ds.reduce((s, d) => s + (+d.points || 0), 0)) });
    if (rec && credits > 0) HW.updateOrder(rec.id, { credits, grossTotal: gross });
    // 🔴 THE MONEY RECORD IS WRITTEN HERE, AT THE TILL.
    //
    // Filing `total: collected` with credits/grossTotal alongside it as loose
    // fields left the order panel to GUESS: an order with no `money` is one
    // commitOrderMoney re-seeds from its LINES, so a rung-up sale was re-derived
    // by code whose job is to invent money for demo records. The drawer figure
    // and the orders it wrote agreed only at the instant of the write.
    // commitOrderMoney refuses to touch an order that already carries money, so
    // filing it now is what makes the figure permanent.
    //
    // `paid` rides along for the same reason. orderPaid()'s first rule is "the
    // written field — whatever put money in the drawer says so on the record",
    // and until now the only thing writing it was commitOrderMoney, which no
    // longer runs on an order that arrives carrying money. Leaving it unwritten
    // would make a settled sale depend on being INFERRED from its channel, and
    // the panel prints "Payment due at pickup" over anything it reads as open.
    // The till took the money; the till says so.
    if (rec) HW.updateOrder(rec.id, { money: ticketMoney(rec, tkLines, ds, credits), paid: true });
    return rec;
  };
  const recordSale = (sale) => recordTicket(tickets[active] || tickets[0], sale, sale && sale.credits);

  // Mark a ticket paid AND strip it. A paid ticket that keeps its cart keeps a
  // live TENDER button, and a second press writes a second real order for money
  // nobody collected — reproduced once as ORD-00240.
  const closeTicket = (idx, paidTotal) => setTickets((ts) => ts.map((x, i) =>
  i === idx ? { ...x, paid: true, paidTotal, cart: [], discounts: [], upsellHidden: [] } : x));

  // Tender closes the ACTIVE ticket only, then lands on the next unpaid one.
  const onPaid = (sale) => {
    setShowPay(false);
    // Whatever happens next, this sale has now been banked. Re-marking means a
    // later onClose for the same modal cannot record it a second time.
    payMark.current = window.POS && window.POS.getLastSale ? window.POS.getLastSale() : null;
    if (payScope === 'party') {payParty(sale);return;}
    const paidIdx = active;
    const rec = recordSale(sale);
    const named = rec ? ` · ${rec.id}` : '';
    if (!multi) {clearTicket();flash(`Sale complete${named} · receipt printed`);return;}
    closeTicket(paidIdx, rec ? rec.total : totalOf(tickets[paidIdx]));
    const next = tickets.findIndex((x, i) => i !== paidIdx && !x.paid);
    if (next >= 0) {setActive(next);flash(`Paid${named} · now on ${tickets[next].person.name.split(' ')[0]}’s ticket`);} else
    flash(`Paid${named} · party closed, every ticket paid`);
  };

  // ── Pay all — ONE tender, N transactions ────────────────────────────────
  // The host paying for everyone is the common case, and it stayed N legal
  // sales: each guest's ticket keeps its own purchase limit and points, so each
  // one gets its own order. This control used to be a bare toast — driven with
  // two open tickets it congratulated the operator and wrote nothing, leaving
  // the bar reading "0 paid, 2 open" over money that had been taken.
  //
  // Credits are consumed ticket by ticket rather than split by ratio: the
  // orders then add up to the amount tendered EXACTLY, with no rounding
  // remainder to lose between the drawer and the board.
  const payParty = (sale) => {
    const open = tickets.map((x, i) => ({ x, i })).filter((e) => !e.x.paid && e.x.cart.length > 0);
    if (!open.length) {flash('Nothing open to charge — every ticket is paid or empty');return;}
    let left = round2(Math.max(0, +(sale && sale.credits || 0)));
    const ids = [];
    const paidTotals = {};
    for (const e of open) {
      const use = round2(Math.min(left, totalOf(e.x)));
      left = round2(left - use);
      const rec = recordTicket(e.x, sale, use);
      if (rec) {ids.push(rec.id);paidTotals[e.i] = rec.total;}
    }
    setTickets((ts) => ts.map((x, i) => paidTotals[i] == null ? x :
    { ...x, paid: true, paidTotal: paidTotals[i], cart: [], discounts: [], upsellHidden: [] }));
    flash(`One tender · ${ids.length} ticket${ids.length > 1 ? 's' : ''} paid · ${ids.join(', ')}`);
  };

  // ── Opening and closing the tender ──────────────────────────────────────
  const openPay = (scope) => {
    if (scope === 'party') {
      if (!openT.length) {flash('Nothing open to charge — every ticket is paid or empty');return;}
    } else if (t && t.paid) {
      flash(`${t.person.name.split(' ')[0]}’s ticket is already paid — nothing left to tender`);return;
    } else if (count === 0) {
      flash('Nothing on the ticket to tender');return;
    }
    // finalize()'s own fingerprint, sampled before the modal opens. See closePay.
    payMark.current = window.POS && window.POS.getLastSale ? window.POS.getLastSale() : null;
    setPayScope(scope);
    setShowPay(true);
  };

  // The write must NOT hang off which control dismissed the receipt. By the
  // time the receipt is on screen, pos/payment.jsx's finalize() has popped the
  // drawer, banked the cash on the session and printed — the money is taken.
  // Dismissing with the header ✕ or the scrim called setShowPay(false) and
  // nothing else, so a real payment left no order in any queue, on any board,
  // in any report. POS.setLastSale is written by finalize and by nothing else,
  // so a lastSale that is not the one sampled in openPay means the sale went
  // through and has to be recorded, whichever way the operator closed the modal.
  const closePay = () => {
    const s = window.POS && window.POS.getLastSale ? window.POS.getLastSale() : null;
    if (s && s !== payMark.current) {onPaid(s);return;}
    setShowPay(false);
  };

  // Smart up-sell filters
  const SMART = {
    none: () => true,
    under5: (p) => p.price <= 5,
    under10: (p) => p.price <= 10,
    sale: (p) => !!p.was,
    highthc: (p) => p.thc != null && p.thc >= 70,
    bundle: (p) => /pack|5x|all-in|ready/i.test(p.name + p.wt),
    staff: (p) => ['LDI4DRP', 'GBZ35RR', 'FCF1LRS', 'BBH2JNT'].includes(p.sku)
  };
  let list = products.filter((p) =>
  (cat === 'All' || (cat === 'Deals' ? p.was : p.cat === cat)) && (
  brands.size === 0 || brands.has(p.brand)) && (
  !q || (p.name + p.brand).toLowerCase().includes(q.toLowerCase())));

  /* ── "FOR THIS TICKET" — the grid, ranked by the upsell engine ─────────────
   *
   * The same call pos/screen-orders.jsx's AddItemPanel makes, on the surface a
   * cashier actually spends the sale looking at. Nothing here decides what is
   * worth suggesting: @hyperwolf/commerce-logic weighs favourite category,
   * category affinity, sale, known brand, potency, stock depth, margin and —
   * dominating all of them — whether an item unlocks a promotion this ticket is
   * close to. The grid only re-orders.
   *
   * ⚠️ THE RANKING IS FROZEN WHILE THE CHIP IS ON, and this is not an
   * optimisation. Deriving it from `cart` re-ran the engine on every Add, the
   * product just added dropped out (the engine skips what is already in the
   * cart) and the WHOLE GRID re-sorted under the cashier's finger — the tile
   * they had just tapped moved and the next tap landed on something else.
   * AddItemPanel carries the same guard and the same scar; see its comment.
   *
   * `rankBasis` is the ticket as it stood when the chip was switched on, or
   * when the party moved to another ticket. Toggling the chip off and on is the
   * deliberate way to re-rank against what is now on the ticket.
   */
  React.useEffect(() => {
    if (!rankOn) {setRankBasis(null);return;}
    setRankBasis(cart.map((c) => ({ sku: c.sku, qty: c.qty })));
  }, [rankOn, active]);

  const rankRecs = React.useMemo(() => {
    if (!rankOn || !rankBasis || !window.HWPosUpsell) return null;
    // `shop_grid_tile` is a grid of product tiles, which is precisely what this
    // is. Its slot count comes from the engine's config — ranking the whole
    // catalogue would put a gold reason line on nearly every tile, which is
    // wallpaper rather than a signal.
    return window.HWPosUpsell.offersFor({
      surface: 'shop_grid_tile',
      orderItems: rankBasis,
      customer,
      catalogue: products.filter((p) => p.active),
    });
  }, [rankOn, rankBasis, customer && customer.id]);

  // sku → the engine's own reason copy, so a tile can say WHY it is up here.
  const rankReason = React.useMemo(() => {
    const m = new Map();
    (rankRecs || []).forEach((r) => m.set(r.p.sku, r.reason));
    return m;
  }, [rankRecs]);

  // ORDER, never filter. Filtering the grid down to three tiles would empty the
  // catalogue the cashier is mid-search in. Ranked tiles rise; everything else
  // keeps catalogue order beneath them (stable sort, equal keys).
  if (rankOn && rankRecs && rankRecs.length) {
    const rk = new Map(rankRecs.map((r, i) => [r.p.sku, i]));
    const at = (p) => rk.has(p.sku) ? rk.get(p.sku) : Number.MAX_SAFE_INTEGER;
    list = list.slice().sort((a, b) => at(a) - at(b));
  }
  // Is anything the cashier can SEE ranked? Search and the category chips still
  // apply, so a ranking can be live and have nothing left in view — and "Best
  // match first" over a grid where no tile is ranked is a claim about nothing.
  const rankedHere = rankOn && list.some((p) => rankReason.has(p.sku));
  // The chip is DROPPED when the engine is absent rather than shown doing
  // nothing: `slotsFor` returns 0 without window.HWSwap, and a control that is
  // always there and sometimes inert is worse than one that is honestly missing.
  const canRank = !!(window.HWPosUpsell && window.HWPosUpsell.slotsFor('shop_grid_tile') > 0);

  return (
    <div style={{ position: 'relative', height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Intake — collapsed search + sliding check-in queue inline */}
      <div style={{ flex: '0 0 auto', borderBottom: `1px solid ${P.hairline2}`, background: P.surface }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 22px 10px' }}>
          <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: P.inkMute, fontFamily: P.fontMono }}><Icon name="users" size={13} stroke={1.9} />Waiting {window.HW.CHECKINS.filter((c) => !c.claimedBy).length}</span>
            <button onClick={() => setShowCheckIn(true)} title="New check-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, width: 96, padding: '14px 8px', border: `1.5px dashed ${P.hairline3}`, borderRadius: P.r12, background: P.surface, color: P.ink2, cursor: 'pointer', fontFamily: P.fontSans, fontSize: 11.5, fontWeight: 700, transition: 'background .12s, border-color .12s, color .12s' }}
              onMouseEnter={(e) => {e.currentTarget.style.background = P.surface3;e.currentTarget.style.borderColor = P.hairline3;e.currentTarget.style.color = P.ink;}}
              onMouseLeave={(e) => {e.currentTarget.style.background = P.surface;e.currentTarget.style.borderColor = P.hairline3;e.currentTarget.style.color = P.ink2;}}>
              <span style={{ width: 28, height: 28, borderRadius: 99, background: P.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="user-plus" size={15} stroke={2.2} color={P.accentInk} /></span>
              New check-in
            </button>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <WaitingStrip onPick={loadCheckIn} onNewCheckIn={() => setShowCheckIn(true)} activeName={customer?.name} />
          </div>
        </div>
        {customer &&
        <div style={{ padding: '11px 22px', background: P.canvas, borderTop: `1px solid ${P.hairline2}` }}>
            <CustomerChip customer={customer} guests={guests} setGuests={setGuests} onClear={() => {openVisit(null, []);setShowDetails(false);}} detailsOpen={showDetails} onToggleDetails={() => setShowDetails((o) => !o)} view="detailed"
            tickets={tickets} onStartTicket={startTicket} hasTicket={hasTicket} onPickTicket={setActive} activeTicket={active} />
          </div>}
      </div>

      {/* Member-details dropdown — directly underneath the check-in queue */}
      {customer && showDetails &&
      <MemberDetails customer={customer} guests={guests} onClose={() => setShowDetails(false)} />}


      {/* Split body */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* LEFT — product browser */}
        <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${P.hairline2}` }}>
          <div style={{ padding: '13px 22px 10px', display: 'flex', flexDirection: 'column', gap: 11, flex: '0 0 auto' }}>
            {/* Category chips with collapsible product search at the left */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, overflowX: 'auto', paddingBottom: 2 }}>
              <ProductSearch q={q} setQ={setQ} onScan={() => flash('Scanner ready — scan a barcode')} />
              <div style={{ flex: '0 0 auto' }}><BrandFilter products={products} brands={brands} setBrands={setBrands} /></div>
              {canRank &&
              <button onClick={() => setRankOn((o) => !o)} title="Rank the grid for what is already on this ticket"
                style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40, padding: '0 13px', borderRadius: P.r999, border: `1px solid ${rankOn ? P.accentBorder : P.hairline2}`, background: rankOn ? P.accentSoft : P.surface, color: rankOn ? P.ink : P.ink2, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans, whiteSpace: 'nowrap' }}>
                <Icon name="sparkle" size={13} stroke={2} />For this ticket
              </button>}
              <span style={{ flex: '0 0 auto', width: 1, height: 22, background: P.hairline2, margin: '0 1px' }} />
              {['All', ...window.HW.CATS].map((c) => {
                const a = c === cat;
                const col = window.HW.CAT_COLOR[c] || P.ink2;
                const isAll = c === 'All';
                const onColInk = c === 'Deals' ? '#1A1400' : '#fff';
                const softBg = `color-mix(in srgb, ${col} 15%, ${P.surface})`;
                const softBorder = `color-mix(in srgb, ${col} 42%, transparent)`;
                return <button key={c} onClick={() => setCat(c)} style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 13px', borderRadius: P.r999, border: `1px solid ${a ? col : softBorder}`, background: a ? col : softBg, color: a ? onColInk : P.ink, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans, transition: 'all .12s' }}>
                  {c}
                  <span style={{ fontSize: 11.5, fontFamily: P.fontMono, opacity: .7 }}>{isAll ? products.length : window.HW.catCount(c)}</span>
                </button>;
              })}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 22px 22px' }}>
            {/* Say which list this is. A ranking that silently failed and a
                ranking that found nothing must not look like one that worked. */}
            {rankOn &&
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 2px 8px', fontSize: P.type.micro, fontWeight: 700, color: P.accentText }}>
              <Icon name="sparkle" size={11} stroke={2} />{rankedHere ? 'Best match first' : 'No ranking — catalogue order'}
            </div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(252px,1fr))', gap: 10 }}>
              {list.map((p) => <ProductRow key={p.sku} p={p} inCart={cart.find((c) => c.sku === p.sku)?.qty} why={rankOn ? rankReason.get(p.sku) : null} onAdd={() => {add(p);flash(p.name + ' added');}} />)}
            </div>
            {list.length === 0 && <div style={{ padding: 48, textAlign: 'center', color: P.inkMute }}>No products match</div>}
          </div>
        </div>

        {/* RIGHT — cart */}
        <CartPane P={P} lines={lines} merch={merch} discountOff={discountOff} sub={sub} tax={tax} total={total} count={count} pay={pay} setPay={setPay}
        setQty={setQty} remove={remove} onClearCart={clearTicket} customer={customer} cartSkus={cart.map((c) => c.sku)}
        discounts={discounts} onApplyDiscount={applyDiscount} onRemoveDiscount={removeDiscount}
        onAdd={(p) => {add(p);flash(p.name + ' added');}}
        upsellHidden={upsellHidden} onDismissUpsell={dismissUpsell}
        tabs={multi ? <TicketTabs tickets={tickets} active={active} onPick={setActive} onDrop={dropTicket} totalOf={totalOf} /> : null}
        footNote={multi ? <PartyTotalBar P={P} tickets={tickets} partyTotal={partyTotal} onPayAll={() => openPay('party')} /> : null}
        discMode={discMode} setDiscMode={setDiscMode} tab={tab} setTab={setTab} onPay={() => openPay('ticket')} />
      </div>

      {showCheckIn && <CheckInModal onClose={() => setShowCheckIn(false)} onCheckIn={onCheckIn} />}

      {/* One tender for a party charges the OPEN half of the party, and is
          taken against the person the visit is on. Everything else is this
          ticket. onClose is not a cancel — see closePay. */}
      {showPay &&
      <PaymentModal
        total={payScope === 'party' ? partyDue : total}
        sub={payScope === 'party' ? partySub : sub}
        tax={payScope === 'party' ? partyTax : tax}
        count={payScope === 'party' ? partyCount : count}
        customer={payScope === 'party' ? tickets[0] && tickets[0].person : customer}
        onClose={closePay} onDone={onPaid} />}

      {toast && <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: P.ink, color: P.surface, padding: '11px 18px', borderRadius: P.r999, fontSize: 13.5, fontWeight: 600, boxShadow: P.shadowLg, display: 'flex', alignItems: 'center', gap: 9, zIndex: 60 }}><Icon name="check-circle" size={16} stroke={2} color={P.accent} />{toast}</div>}
    </div>);

};

// ── Performance ribbon — store + associate net sales & AOV (comment 7) ──────
function SalesRibbon({ P }) {
  const S = window.HW.STATS;
  const a = S.associate;
  const [per, setPer] = React.useState('day');
  const aov = a.aov[per];
  const dl = a.aovDelta[per];
  const goalPct = Math.min(1, aov / a.goal);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '8px 22px', background: P.surface2, borderBottom: `1px solid ${P.hairline2}`, flex: '0 0 auto', overflowX: 'auto' }}>
      <RibMetric P={P} icon="shop" label="Store · net today" value={window.HW.fmt.money0(S.storeNetToday)} sub={`${S.storeOrdersToday} orders`} />
      <span style={{ width: 1, height: 26, background: P.hairline2, flex: '0 0 auto' }} />
      <RibMetric P={P} icon="user" label={`${a.name.split(' ')[0]} · net today`} value={window.HW.fmt.money0(a.netToday)} sub={`${a.ordersToday} orders`} accent />
      <span style={{ width: 1, height: 26, background: P.hairline2, flex: '0 0 auto' }} />
      {/* AOV with period toggle + goal */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, flex: '0 0 auto' }}>
        <div style={{ lineHeight: 1.15 }}>
          <div style={{ fontSize: 10, color: P.inkMute, fontWeight: 600, letterSpacing: '.09em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>My AOV</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{window.HW.fmt.money(aov)}</span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: dl > 0 ? P.good : dl < 0 ? P.bad : P.inkMute, fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>{dl > 0 ? '▲' : dl < 0 ? '▼' : '—'}{Math.abs(dl)}%</span>
          </div>
        </div>
        <Seg value={per} onChange={setPer} size="sm" options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Wk' }, { value: 'month', label: 'Mo' }]} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: '0 0 auto' }}>
          <div style={{ width: 70 }}><BarMeter value={goalPct} color={goalPct >= 1 ? P.good : P.accent} height={5} /></div>
          <span style={{ fontSize: 10, color: P.inkDim, fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>goal {window.HW.fmt.money0(a.goal)}</span>
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <PBtn variant="ghost" size="xs" icon="chart-line" style={{ flex: '0 0 auto' }}>Full report</PBtn>
    </div>);

}

function RibMetric({ P, icon, label, value, sub, accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flex: '0 0 auto' }}>
      <span style={{ width: 26, height: 26, borderRadius: 7, background: accent ? P.accent : P.surface3, color: accent ? P.accentInk : P.inkDim, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={icon} size={14} stroke={1.9} /></span>
      <div style={{ lineHeight: 1.15 }}>
        <div style={{ fontSize: 10, color: P.inkMute, fontWeight: 600, letterSpacing: '.09em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: P.ink, fontFamily: P.fontMono, letterSpacing: '-.01em' }}>{value}</span>
          {sub && <span style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>{sub}</span>}
        </div>
      </div>
    </div>);

}

// ── Customer chip — reflects the party captured at CHECK-IN. Managing the party
// here edits the check-in record, and a guest can be spun out onto their own
// ticket when they're buying for themselves. ───────────────────────────────
function CustomerChip({ customer, guests, setGuests, onClear, detailsOpen, onToggleDetails, view = 'bar',
  tickets = [], onStartTicket, hasTicket, onPickTicket, activeTicket = 0 }) {
  const P = useP();
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState('named');
  const goldInk = P.accentText;
  const tier = customer.points >= 2000 ? 'Platinum' : customer.points >= 1000 ? 'Gold' : customer.points >= 300 ? 'Silver' : 'Bronze';
  const tierColor = tier === 'Platinum' ? P.info : tier === 'Gold' ? goldInk : tier === 'Silver' ? P.neutral : P.warn;
  // Same derivation the details panel uses for avg basket, so the rail and the
  // expanded panel can never disagree about what this customer spends.
  const chipLifetime = Math.round((customer.visits || 0) * 58 + (customer.points || 0) * 0.42);
  const chipAov = chipLifetime / Math.max(1, customer.visits || 1);

  const Avatars = ({ solo }) =>
  <div style={{ display: 'flex', alignItems: 'center', flex: '0 0 auto' }}>
      <Avatar name={customer.name} size={32} crown={customer.member} />
      {!solo && guests.slice(0, 3).map((g, i) => <span key={i} style={{ marginLeft: -10, borderRadius: 99, boxShadow: `0 0 0 2px ${P.surface2}` }}><Avatar name={(window.guestName?window.guestName(g):g)} size={26} /></span>)}
    </div>;

  const NameRow = () =>
  <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink, display: 'flex', alignItems: 'center', gap: 6 }}>
      {customer.name}
      <VisitPill visit={customer.visits} />
      {guests.length > 0 && <span style={{ fontSize: 10, fontWeight: 600, color: goldInk, background: P.accentSoft, padding: '1px 7px', borderRadius: 99 }}>+{guests.length} guest{guests.length > 1 ? 's' : ''}</span>}
    </div>;

  const Actions = () =>
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }} onClick={(e) => e.stopPropagation()}>
      <button onClick={onToggleDetails} title="Member details" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '6px 8px', background: detailsOpen ? P.surface3 : 'transparent', color: P.ink2, border: `1px solid ${detailsOpen ? P.hairline3 : P.hairline2}`, borderRadius: P.r999, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}>
        <Icon name="user" size={13} stroke={1.9} /><Icon name={detailsOpen ? 'chevron-up' : 'chevron-down'} size={12} stroke={2.2} />
      </button>
      <button onClick={() => setOpen((o) => !o)} title="Manage check-in party" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 9px', background: open ? P.accent : P.surface, color: open ? P.accentInk : P.ink2, border: `1px solid ${open ? P.accentBorder : P.hairline2}`, borderRadius: P.r999, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans, whiteSpace: 'nowrap' }}>
        <Icon name="users" size={13} stroke={2} />Party
      </button>
      <IconBtn icon="x" size={13} style={{ width: 26, height: 26 }} onClick={onClear} />
    </div>;

  const Stat = ({ k, v, color }) =>
  <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, flex: '0 0 auto' }}>
      <span style={{ fontSize: 10, color: P.inkMute, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{k}</span>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: color || P.ink, fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>{v}</span>
    </div>;

  const Sub = () => <div style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{customer.points} pts · {customer.type}{guests.length > 0 ? ' · sale on main' : ''}</div>;
  const tierPill = <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: tierColor, flex: '0 0 auto' }}><Icon name="crown" size={11} color={tierColor} />{tier.toUpperCase()}</span>;
  const vDiv = <span style={{ flex: '0 0 auto', width: 1, height: 26, background: P.hairline2 }} />;

  let body;
  if (view === 'compact') {
    body =
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '5px 8px 5px 6px', background: P.surface2, border: `1px solid ${guests.length ? P.accentBorder : P.hairline2}`, borderRadius: P.r999 }}>
        <Avatars />
        <div style={{ lineHeight: 1.2 }}><NameRow /><Sub /></div>
        <Actions />
      </div>;
  } else if (view === 'detailed') {
    // Option A — stat cards. Each number gets an icon, a 19px mono numeral and
    // a sub-line that turns it into a sentence. Phone is contact detail, not a
    // metric, so it sits with the name and the freed room buys Lifetime spend.
    const seed = (customer.name || '').length + (customer.visits || 1);
    const pick = (arr) => arr[seed % arr.length];
    const since = pick(['Mar 2022', 'Jul 2023', 'Nov 2021', 'Jan 2024', 'Sep 2022']);
    const lastVisit = pick(['2 days ago', 'yesterday', '5 days ago', 'last week']);
    const ready = (window.HW.REWARDS || []).filter((r) => !r.bday && customer.points >= r.cost).sort((a, b) => b.value - a.value)[0];
    const nextR = (window.HW.REWARDS || []).filter((r) => !r.bday && customer.points < r.cost).sort((a, b) => a.cost - b.cost)[0];
    // A guest spun onto their own ticket usually has no history — say so instead
    // of showing a derived number that looks like real spend.
    const guestOf = customer.guestOf;
    const fresh = (customer.visits || 0) <= 1 && !customer.points;

    const SCard = ({ icon, label, value, sub, subColor, valColor, hl }) =>
    <div style={{ flex: '1 1 0', minWidth: 0, background: hl ? P.accentSoft : P.surface, border: `1px solid ${hl ? P.accentBorder : P.hairline2}`, borderRadius: P.r12, padding: '8px 10px 9px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ width: 18, height: 18, borderRadius: 5, background: hl ? P.accent : P.surface3, color: hl ? P.accentInk : P.inkDim, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={icon} size={11} stroke={2} /></span>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: hl ? goldInk : P.inkMute, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        </div>
        <div style={{ fontFamily: P.fontMono, fontSize: 21, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1, color: valColor || P.ink, whiteSpace: 'nowrap' }}>{value}</div>
        <div style={{ fontFamily: P.fontMono, fontSize: 10, color: subColor || P.inkMute, marginTop: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
      </div>;

    body =
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 10, width: '100%' }}>
        {/* Identity — name, contact, standing */}
        <div onClick={onToggleDetails} title="Open full member details" style={{ flex: '0 0 214px', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', background: detailsOpen ? P.surface3 : P.surface2, border: `1px solid ${detailsOpen ? P.hairline3 : guests.length ? P.accentBorder : P.hairline2}`, borderRadius: P.r12, cursor: 'pointer' }}>
          <Avatars solo={!!guestOf} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{customer.name}</div>
            <div style={{ fontSize: 10, color: P.inkDim, fontFamily: P.fontMono, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{guestOf ? `guest of ${guestOf.split(' ')[0]}` : customer.phone}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 5 }}>
              {tierPill}
              <VisitPill visit={customer.visits} />
              {!guestOf && guests.length > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: goldInk, background: P.accentSoft, padding: '1px 6px', borderRadius: 99, whiteSpace: 'nowrap' }}>+{guests.length}</span>}
              {guestOf && <span style={{ fontSize: 10, fontWeight: 700, color: P.ink2, background: P.surface3, padding: '1px 6px', borderRadius: 99, whiteSpace: 'nowrap' }}>OWN TICKET</span>}
            </div>
          </div>
        </div>
        {/* The numbers */}
        <SCard hl icon="star" label="Points" value={customer.points.toLocaleString()}
        sub={ready ? `${ready.label} ready to redeem` : nextR ? `${nextR.cost - customer.points} to ${nextR.label}` : 'earning'}
        subColor={ready ? goldInk : P.inkMute} />
        <SCard icon="user-check" label="Visits" value={fresh ? 1 : customer.visits} sub={fresh ? 'first visit today' : `last · ${lastVisit}`} />
        <SCard icon="chart-line" label="Avg order" value={fresh ? '—' : window.HW.fmt.money(chipAov)} valColor={fresh ? P.inkMute : P.ink} sub={fresh ? 'no orders yet' : `over ${customer.visits} order${customer.visits === 1 ? '' : 's'}`} />
        <SCard icon="wallet" label="Wallet" value={window.HW.fmt.money(customer.wallet || 0)}
        valColor={customer.wallet > 0 ? P.good : P.inkMute}
        sub={customer.wallet > 0 ? 'store credit available' : 'no credit on account'}
        subColor={customer.wallet > 0 ? P.good : P.inkMute} />
        <SCard icon="cash" label="Lifetime" value={fresh ? '$0' : window.HW.fmt.money0(chipLifetime)} valColor={fresh ? P.inkMute : P.ink} sub={fresh ? 'new customer' : `since ${since}`} />
        {/* Actions */}
        <div style={{ flex: '0 0 106px', display: 'flex', flexDirection: 'column', gap: 5, justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
          <button onClick={onToggleDetails} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '7px 9px', background: detailsOpen ? P.surface3 : P.surface, color: P.ink2, border: `1px solid ${detailsOpen ? P.hairline3 : P.hairline2}`, borderRadius: P.r10, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans, minHeight: 30 }}>
            {detailsOpen ? 'Hide' : 'Details'}<Icon name={detailsOpen ? 'chevron-up' : 'chevron-down'} size={12} stroke={2.2} />
          </button>
          <button onClick={() => setOpen((o) => !o)} title="Manage the party · open a separate ticket" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '7px 9px', background: open ? P.accent : P.surface, color: open ? P.accentInk : P.ink2, border: `1px solid ${open ? P.accentBorder : P.hairline2}`, borderRadius: P.r10, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans, minHeight: 30 }}>
            <Icon name="users" size={13} stroke={2} />Party{guests.length > 0 ? ` ${1 + guests.length}` : ''}
          </button>
          <button onClick={onClear} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: P.ctrlH.xs, padding: '5px 9px', background: 'transparent', color: P.inkMute, border: 'none', borderRadius: P.r10, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}>
            <Icon name="x" size={12} stroke={2.2} />Clear
          </button>
        </div>
      </div>;
  } else {
    body =
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', background: P.surface2, border: `1px solid ${guests.length ? P.accentBorder : P.hairline2}`, borderRadius: P.r14, width: '100%' }}>
        <Avatars />
        <div style={{ minWidth: 0 }}><NameRow /><Sub /></div>
        <div style={{ flex: 1 }} />
        {tierPill}{vDiv}
        <Actions />
      </div>;
  }

  return (
    <div style={{ position: 'relative', width: view === 'compact' ? 'auto' : '100%' }}>
      {body}
      {open && <>
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 50 }} />
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 360, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r14, boxShadow: P.shadowLg, padding: 14, zIndex: 51, maxHeight: '70vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Icon name="user-check" size={15} stroke={1.9} color={P.ink2} />
            <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink, whiteSpace: 'nowrap' }}>Manage check-in party</span>
          </div>
          <p style={{ margin: '0 0 12px', fontSize: 11.5, color: P.inkDim, lineHeight: 1.45 }}>Editing the party for <b style={{ color: P.ink2 }}>{customer.name.split(' ')[0]}</b>’s check-in. Guests are added at check-in and tracked as referrals.</p>

          {/* Tickets — the party is one sale unless a guest needs their own */}
          {guests.length > 0 &&
          <div style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r12, padding: 11, marginBottom: 13, background: P.surface2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
                <Eyebrow>Tickets</Eyebrow>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>{tickets.length} open</span>
              </div>
              <p style={{ margin: '0 0 10px', fontSize: 11.5, color: P.inkDim, lineHeight: 1.5 }}>The party checks out on <b style={{ color: P.ink2 }}>one ticket</b> by default. Open a separate one only when a guest is buying for themselves — it becomes their own transaction, with their own purchase limit and points.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px', background: activeTicket === 0 ? P.accentSoft : P.surface, border: `1px solid ${activeTicket === 0 ? P.accentBorder : P.hairline}`, borderRadius: P.r10 }}>
                  <Avatar name={customer.name} size={24} crown={customer.member} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: P.ink }}>{customer.name.split(' ')[0]}</span>
                    <span style={{ display: 'block', fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>main ticket</span>
                  </span>
                  {activeTicket === 0 ? <Pill kind="accent" dot>ringing</Pill> :
                  <PBtn variant="secondary" size="xs" onClick={() => onPickTicket && onPickTicket(0)}>Switch</PBtn>}
                </div>
                {guests.map((g, i) => {
                const gn = window.guestName ? window.guestName(g) : g;
                const ok = !(window.guestIncomplete && window.guestIncomplete([g]) > 0);
                const owns = hasTicket && hasTicket(gn);
                const idx = tickets.findIndex((x) => x.person && x.person.name === gn);
                return (
                  <div key={gn + i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px', background: owns && activeTicket === idx ? P.accentSoft : P.surface, border: `1px solid ${owns ? activeTicket === idx ? P.accentBorder : P.hairline2 : P.hairline}`, borderRadius: P.r10 }}>
                      <Avatar name={gn} size={24} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{gn}</span>
                        <span style={{ display: 'block', fontSize: 10, color: owns ? goldInk : P.inkMute, fontFamily: P.fontMono }}>{owns ? 'own ticket' : ok ? 'on the main ticket' : 'ID not captured'}</span>
                      </span>
                      {owns ?
                    activeTicket === idx ? <Pill kind="accent" dot>ringing</Pill> :
                    <PBtn variant="secondary" size="xs" onClick={() => onPickTicket && onPickTicket(idx)}>Switch</PBtn> :
                    ok ?
                    <PBtn variant="soft" size="xs" icon="plus" onClick={() => {onStartTicket && onStartTicket(g);setOpen(false);}}>Ticket</PBtn> :
                    <Pill kind="bad" dot>needs ID</Pill>}
                    </div>);
              })}
              </div>
            </div>}

          <GuestEditor primaryName={customer.name} guests={guests} onChange={setGuests} />
        </div>
      </>}
    </div>);

}

// ── Ticket tabs — only exist once a party has more than one ticket ─────────
function TicketTabs({ tickets, active, onPick, onDrop, totalOf }) {
  const P = useP();
  const money = window.HW.fmt.money;
  return (
    <div style={{ display: 'flex', background: P.surface3, borderBottom: `1px solid ${P.hairline2}`, flex: '0 0 auto' }}>
      {tickets.map((t, i) => {
        const on = i === active;
        const amt = totalOf(t);
        return (
          <button key={t.id} onClick={() => onPick(i)} title={`${t.person.name} · ticket ${i + 1}`} style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', background: on ? P.surface2 : 'transparent', border: 'none', borderRight: i < tickets.length - 1 ? `1px solid ${P.hairline2}` : 'none', boxShadow: on ? `inset 0 2px 0 ${P.accent}` : 'none', cursor: 'pointer', fontFamily: P.fontSans, textAlign: 'left' }}>
            <Avatar name={t.person.name} size={24} crown={t.person.member} />
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.person.name.split(' ')[0]}</span>
              <span style={{ display: 'block', fontSize: 10, color: t.paid ? P.good : on ? P.ink : P.inkDim, fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>{t.paid ? 'paid' : amt > 0 ? money(amt) : 'empty'}</span>
            </span>
            {t.paid && <Icon name="check-circle" size={13} stroke={2.2} color={P.good} />}
            {!t.paid && i > 0 && amt === 0 && <span onClick={(e) => {e.stopPropagation();onDrop(i);}} title="Close this empty ticket" style={{ display: 'inline-flex', width: 18, height: 18, alignItems: 'center', justifyContent: 'center', color: P.inkMute }}><Icon name="x" size={11} stroke={2.4} /></span>}
          </button>);
      })}
    </div>);

}

// Party total + one-tender shortcut. The host paying for everyone is the common
// case — it stays N transactions, one card.
function PartyTotalBar({ P, tickets, partyTotal, onPayAll }) {
  const paid = tickets.filter((t) => t.paid).length;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 48px 8px 12px', background: P.highlightSoft, borderTop: `1px solid ${P.hairline2}`, flex: '0 0 auto' }}>
      <span style={{ flex: 1, fontSize: 11.5, fontWeight: 700, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        Party <span style={{ fontFamily: P.fontMono, color: P.ink }}>{window.HW.fmt.money(partyTotal)}</span>
        <span style={{ fontWeight: 600, opacity: .8 }}> · {paid} paid, {tickets.length - paid} open</span>
      </span>
      <PBtn variant="secondary" size="xs" icon="card" onClick={onPayAll} title={`One tender · charge every open ticket to ${tickets[0].person.name}`}>Pay all</PBtn>
    </div>);

}

// ── Brand filter — searchable multi-select with clear-all (replaces up-sell) ─
function BrandFilter({ products, brands, setBrands }) {
  const P = useP();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const allBrands = React.useMemo(() => [...new Set(products.map((p) => p.brand))].sort(), [products]);
  const shown = allBrands.filter((b) => !q || b.toLowerCase().includes(q.toLowerCase()));
  const toggle = (b) => setBrands((prev) => {const n = new Set(prev);n.has(b) ? n.delete(b) : n.add(b);return n;});
  const cnt = (b) => products.filter((p) => p.brand === b).length;
  const sel = [...brands];
  const ref = React.useRef(null);
  const [pos, setPos] = React.useState({ left: 0, top: 0 });
  const openMenu = () => {const r = ref.current.getBoundingClientRect();setPos({ left: Math.min(r.left, window.innerWidth - 260), top: r.bottom + 6 });setOpen(true);};
  return (
    <div ref={ref} style={{ position: 'relative', flex: '0 0 auto' }}>
      {/* scroller holds the controls; popover lives OUTSIDE it so it isn't clipped */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, overflowX: 'auto', paddingBottom: 1 }}>
        <button onClick={() => open ? setOpen(false) : openMenu()} style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: P.r999, border: `1px solid ${open || brands.size ? P.accentBorder : P.hairline2}`, background: brands.size ? P.accentSoft : P.surface, color: P.ink2, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans, whiteSpace: 'nowrap' }}>
          <Icon name="tag" size={12.5} stroke={1.9} />Brands{brands.size > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: P.accentInk, background: P.accent, padding: '0 6px', borderRadius: 99, fontFamily: P.fontMono }}>{brands.size}</span>}<Icon name="chevron-down" size={12} stroke={2.2} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
        </button>
        {sel.map((b) =>
        <button key={b} onClick={() => toggle(b)} style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: P.r999, border: `1px solid ${P.accentBorder}`, background: P.accentSoft, color: P.ink, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans, whiteSpace: 'nowrap' }}>
            {b}<Icon name="x" size={11} stroke={2.2} color={P.inkMute} />
          </button>)}
        {brands.size > 0 && <button onClick={() => setBrands(new Set())} style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 9px', background: 'transparent', border: 'none', color: P.inkDim, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans, whiteSpace: 'nowrap' }}><Icon name="x" size={12} stroke={2} />Clear all</button>}
      </div>

      {open && <>
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1000 }} />
        <div style={{ position: 'fixed', left: pos.left, top: pos.top, width: 244, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, boxShadow: P.shadowLg, padding: 8, zIndex: 1001 }}>
          <Field icon="search" placeholder="Search brands…" size="sm" value={q} autoFocus onChange={(e) => setQ(e.target.value)} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 188, overflowY: 'auto', margin: '8px 0' }}>
            {shown.map((b) => {const on = brands.has(b);return (
                <button key={b} onClick={() => toggle(b)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 8px', background: on ? P.accentSoft : 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}>
                <Check on={on} onChange={() => toggle(b)} size={16} />
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b}</span>
                <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{cnt(b)}</span>
              </button>);})}
            {shown.length === 0 && <div style={{ padding: 16, textAlign: 'center', fontSize: 12.5, color: P.inkMute }}>No brands match</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, borderTop: `1px solid ${P.hairline}` }}>
            <button onClick={() => setBrands(new Set())} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: P.inkDim, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}><Icon name="x" size={12} stroke={2} />Clear all</button>
            <PBtn variant="accent" size="xs" onClick={() => setOpen(false)}>Done · {brands.size}</PBtn>
          </div>
        </div>
      </>}
    </div>);

}

// ── Product search — collapses to an icon, expands inline left of the chips ─
function ProductSearch({ q, setQ, onScan }) {
  const P = useP();
  const [open, setOpen] = React.useState(false);
  const expanded = open || !!q;
  if (!expanded) {
    return (
      <button onClick={() => setOpen(true)} title="Search products" style={{ flex: '0 0 auto', width: 38, height: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r999, color: P.ink2, cursor: 'pointer' }}>
        <Icon name="search" size={17} stroke={1.9} />
      </button>);
  }
  return (
    <div style={{ flex: '0 0 auto', width: 296 }}>
      <Field icon="search" placeholder="Search or scan products…" value={q} autoFocus onChange={(e) => setQ(e.target.value)} size="sm"
      suffix={<div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <button title="Scan barcode" onClick={onScan} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 9px', background: P.surface3, border: `1px solid ${P.hairline2}`, borderRadius: 7, color: P.ink2, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans, whiteSpace: 'nowrap' }}><Icon name="scan" size={14} stroke={1.9} />Scan</button>
          <button title="Close search" onClick={() => {setQ('');setOpen(false);}} style={{ display: 'inline-flex', width: 22, height: 22, alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: P.inkMute, cursor: 'pointer' }}><Icon name="x" size={14} stroke={2} /></button>
        </div>} />
    </div>);
}

// ── Customer search — selecting a result checks the customer in ────────────
// (no dedicated check-in button; searching IS the check-in)
function CustomerSearch({ onSelect, onNewCheckIn, activeName }) {
  const P = useP();
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const all = window.HW.MEMBERS;
  const results = q ? all.filter((m) => (m.name + m.email + m.phone).toLowerCase().includes(q.toLowerCase())) : all.slice(0, 5);
  const pick = (m) => {onSelect(m);setOpen(false);setQ('');};
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} title="Check in a customer — search name, e-mail or phone" style={{ flex: '0 0 auto', width: 38, height: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r999, color: P.ink2, cursor: 'pointer' }}>
        <Icon name="search" size={17} stroke={1.9} />
      </button>);
  }
  return (
    <div style={{ position: 'relative', flex: '0 0 auto', width: 320, zIndex: 52 }}>
      <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 50 }} />
      <div style={{ position: 'relative', zIndex: 53 }}>
        <Field icon="search" placeholder="Search a customer to check in…" size="sm" value={q} autoFocus onChange={(e) => setQ(e.target.value)} suffix={<button onClick={() => {setQ('');setOpen(false);}} title="Close" style={{ display: 'inline-flex', width: 22, height: 22, alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: P.inkMute, cursor: 'pointer' }}><Icon name="x" size={14} stroke={2} /></button>} />
      </div>
      <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: 372, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r14, boxShadow: P.shadowLg, padding: 8, zIndex: 53 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px 8px' }}>
            <Eyebrow>Check in a customer</Eyebrow>
            <button onClick={() => {setOpen(false);onNewCheckIn();}} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: P.ink2, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}><Icon name="users" size={12} stroke={2} />New + party</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 320, overflowY: 'auto' }}>
            {results.map((m) => {
            const isActive = m.name === activeName;
            return (
              <button key={m.id} onClick={() => pick(m)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 9px', background: isActive ? P.accentSoft : P.surface, border: `1px solid ${isActive ? P.accentBorder : P.hairline2}`, borderRadius: P.r10, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}>
                  <Avatar name={m.name} size={30} crown={m.member} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, display: 'flex', alignItems: 'center', gap: 6 }}>{m.name}<VisitPill visit={m.visits} /></div>
                    <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{m.phone} · {m.points} pts</div>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11.5, fontWeight: 600, color: isActive ? P.inkMute : P.ink, whiteSpace: 'nowrap' }}>{isActive ? 'In sale' : 'Check in'}<Icon name="arrow-right" size={13} stroke={2.2} /></span>
                </button>);

          })}
            {results.length === 0 &&
          <button onClick={() => {setOpen(false);onNewCheckIn();}} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 9px', background: P.surface, border: `1px dashed ${P.hairline3}`, borderRadius: P.r10, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans, color: P.inkDim }}>
                <span style={{ width: 30, height: 30, borderRadius: 99, background: P.surface3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="user-plus" size={15} stroke={1.9} /></span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink2 }}>No match — check in “{q}” as a new guest</span>
              </button>}
          </div>
        </div>
    </div>);

}

// ── Check-in queue — committed sliding card layout (merged into New Sale) ──
function QueueToggle({ open, setOpen }) {
  const P = useP();
  const waiting = window.HW.CHECKINS.filter((c) => !c.claimedBy).length;
  return (
    <button onClick={() => setOpen((o) => !o)} title="Show / hide check-in queue" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 11px', background: open ? P.surface3 : P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r999, cursor: 'pointer', fontFamily: P.fontSans }}>
      <Icon name="users" size={14} stroke={1.9} color={P.ink2} />
      <span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink }}>Waiting</span>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: P.accentInk, background: P.accent, padding: '1px 6px', borderRadius: 99, fontFamily: P.fontMono }}>{waiting}</span>
      <Icon name="chevron-down" size={13} stroke={2} color={P.inkMute} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
    </button>);

}

function WaitRow({ c, active, onPick }) {
  const P = useP();
  const claimed = !!c.claimedBy;
  return (
    <button onClick={onPick} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 9px', background: active ? P.accentSoft : P.surface, border: `1px solid ${active ? P.accentBorder : P.hairline2}`, borderRadius: P.r10, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans, width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Avatar name={c.name} size={30} crown={c.member} />
        {(c.guests || []).slice(0, 2).map((g, i) => <span key={i} style={{ marginLeft: -9, borderRadius: 99, boxShadow: `0 0 0 2px ${P.surface}` }}><Avatar name={(window.guestName?window.guestName(g):g)} size={22} /></span>)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, display: 'flex', alignItems: 'center', gap: 6 }}>{c.name}<VisitPill visit={c.visit} />{c.guests && c.guests.length > 0 && <span style={{ fontSize: 10, fontWeight: 600, color: P.ink2, background: P.surface3, padding: '0 6px', borderRadius: 99 }}>+{c.guests.length}</span>}</div>
        <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{claimed ? `Claimed · ${c.claimedBy.split(' ')[0]}` : c.type} · {c.wait}</div>
      </div>
      <Icon name="arrow-right" size={15} color={P.inkFaint} />
    </button>);

}

// Visit number badge — 1st / 2nd / 3rd (capped)
function VisitPill({ visit }) {
  const P = useP();
  const ord = window.HW.visitOrdinal(visit);
  const fg = ord === 1 ? P.inkDim : ord === 2 ? P.info : P.ink;
  const bg = ord === 1 ? P.neutralSoft : ord === 2 ? P.infoSoft : P.highlightSoft;
  return <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.02em', color: fg, background: bg, padding: '1px 6px', borderRadius: 99, whiteSpace: 'nowrap', fontFamily: P.fontSans }}>{window.HW.visitLabel(visit)}</span>;
}

function WaitingStrip({ onPick, onNewCheckIn, activeName }) {
  const P = useP();
  const checkins = window.HW.CHECKINS;
  const shortWait = (c) => c.waitSec >= 60 ? `${Math.floor(c.waitSec / 60)}m` : `${c.waitSec}s`;
  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
      {checkins.map((c) => {
        const claimed = !!c.claimedBy;const active = c.name === activeName;
        return (
          <div key={c.id} style={{ flex: '0 0 auto', width: 188, border: `1px solid ${active ? P.accentBorder : P.hairline2}`, borderRadius: P.r12, overflow: 'hidden', background: P.surface }}>
            <div style={{ padding: '7px 10px 6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ position: 'relative', flex: '0 0 auto' }}>
                  <Avatar name={c.name} size={34} crown={c.member} />
                  {c.guests && c.guests.length > 0 && <span style={{ position: 'absolute', bottom: -3, right: -3, borderRadius: 99, boxShadow: `0 0 0 2px ${P.surface}` }}><Avatar name={window.guestName?window.guestName(c.guests[0]):c.guests[0]} size={18} /></span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}{c.guests && c.guests.length > 0 ? <span style={{ color: P.inkMute, fontWeight: 600 }}> +{c.guests.length}</span> : ''}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    <VisitPill visit={c.visit} />
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: claimed ? P.inkMute : P.warn, fontFamily: P.fontMono }}><Icon name="clock" size={10} stroke={2} />{shortWait(c)}</span>
                    {claimed && <span style={{ marginLeft: 'auto', fontSize: 10, color: P.inkMute, fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>· {c.claimedBy.split(' ')[0]}</span>}
                  </div>
                </div>
              </div>
            </div>
            <button onClick={() => onPick(c)} style={{ width: '100%', minHeight: P.ctrlH.md, padding: '5px 10px', background: claimed ? P.surface3 : P.ink, color: claimed ? P.ink : P.surface, border: 'none', borderTop: `1px solid ${P.hairline}`, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: P.fontSans, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              {claimed ? 'Resume' : 'Claim'}<Icon name="arrow-right" size={12} stroke={2.3} />
            </button>
          </div>);
      })}
    </div>);

}

// ── Member-details dropdown — ID, contact, loyalty, orders, referrals ──────
function MemberDetails({ customer, guests, onClose }) {
  const P = useP();
  const m = customer;
  const seed = (m.name || '').length + (m.visits || 1);
  const pick = (arr) => arr[seed % arr.length];
  const lifetime = Math.round(m.visits * 58 + m.points * 0.42);
  const memberSince = pick(['Mar 2022', 'Jul 2023', 'Nov 2021', 'Jan 2024', 'Sep 2022']);
  const dob = pick(['04/14/1991', '09/02/1988', '12/21/1995', '06/30/1983', '02/11/1979']);
  const idNum = 'CA ' + ('D' + (1700000 + seed * 53129).toString().slice(0, 7));
  const favCat = window.HW.favCategory(m);
  const lastVisit = pick(['2 days ago', 'Yesterday', '5 days ago', 'Last week']);
  const avgBasket = (lifetime / Math.max(1, m.visits)).toFixed(0);
  const gender = pick(['Female', 'Male', 'Non-binary', 'Female', 'Male']);
  const isMed = m.type === 'MedicinalUser';
  const mmic = 'MMIC-' + (25800 + seed * 137).toString().slice(0, 5);
  const medMd = pick(['Dr. A. Okafor', 'Dr. L. Brandt', 'Dr. S. Patel', 'Dr. R. Nguyen']);
  const medIssued = pick(['Jan 2026', 'Nov 2025', 'Mar 2026', 'Aug 2025']);
  // ── This member's order history ─────────────────────────────────────────
  // The rows the ORDER BOOK can actually produce a record for come first, and
  // clicking one opens THAT record — so an edit made from here lands on the
  // order the queue is showing.
  //
  // The rest are archive lines. Handing OrderDetails a literal built from one
  // of them — `{ id: '00219', name, items, total }` — is a landmine: '00219' is
  // not a board id, the object carries no stage, and the moment it gains one,
  // OrderDetails turns its edit controls on and every save runs
  // HW.updateOrder('00219', …), which returns null and fails in silence. So an
  // archive row says it is archived rather than opening an editor whose writes
  // go nowhere.
  const liveOrders = (window.HW.ORDERS || []).filter((o) => o.name === m.name).map((o) =>
  ({ id: o.id, date: o.age || '—', items: o.items, total: o.total, tag: `${o.source} · ${o.channel} · ${o.pay}`, live: true }));
  const ARCHIVE = [{ id: '00219', date: 'Jun 8', items: 3, total: 41.0, tag: window.HW_BRANDS.name.jeeter + ' · Pre-Rolls' }, { id: '00204', date: 'Jun 1', items: 2, total: 28.5, tag: window.HW_BRANDS.name.lowell + ' · Flower' }, { id: '00188', date: 'May 24', items: 5, total: 96.2, tag: 'KIVA · Edibles' }, { id: '00171', date: 'May 18', items: 1, total: 15.0, tag: 'Allswell · Flower' }, { id: '00150', date: 'May 9', items: 4, total: 62.4, tag: 'West Coast Cure · Concentrates' }, { id: '00132', date: 'Apr 30', items: 2, total: 33.2, tag: 'AMMO · Vapes' }];
  const orders = [...liveOrders, ...ARCHIVE.filter((a) => !liveOrders.some((l) => l.id === 'ORD-' + a.id))];
  const referrals = (guests && guests.length ? guests.map((g)=>window.guestName?window.guestName(g):g) : ['Dev Anand', 'Mia Tran']).slice(0, 4);

  const [lb, setLb] = React.useState(null); // enlarged photo
  const [ord, setOrd] = React.useState(null); // order details modal
  const [histNote, setHistNote] = React.useState(null); // id of an archive row the operator clicked
  const [oq, setOq] = React.useState(''); // smart order search
  const oList = orders.filter((o) => !oq || (o.id + ' ' + o.date + ' ' + o.tag).toLowerCase().includes(oq.toLowerCase()));
  const [editing, setEditing] = React.useState(null); // field being edited
  const addrSeed = pick([
  { street: '418 Mission Trail', city: 'Wildomar', state: 'CA', zip: '92595' },
  { street: '92 Diamond Dr', city: 'Lake Elsinore', state: 'CA', zip: '92530' },
  { street: '5571 Grand Ave', city: 'Lakeland Village', state: 'CA', zip: '92530' },
  { street: '210 Riverside Dr', city: 'Temescal', state: 'CA', zip: '92883' }]);
  const [f, setF] = React.useState({ phone: m.phone, email: m.email, street: addrSeed.street, city: addrSeed.city, state: addrSeed.state, zip: addrSeed.zip, exp: pick(['08 / 2027', '03 / 2026', '11 / 2028', '05 / 2027']), medExp: pick(['12 / 2026', '06 / 2027', '09 / 2026']) });
  const set1 = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const photos = [
  { id: 'front', label: 'License · front', hue: 210, glyph: 'card' },
  { id: 'selfie', label: 'Selfie match', hue: 150, glyph: 'user' },
  { id: 'med', label: 'Medical card', hue: 90, glyph: 'shield' }];

  const PhotoCard = ({ p2, big }) =>
  <button onClick={() => !big && setLb(p2)} style={{ position: 'relative', flex: '0 0 auto', width: big ? '100%' : 196, height: big ? 300 : 124, borderRadius: P.r12, overflow: 'hidden', border: `1px solid ${P.hairline2}`, cursor: big ? 'default' : 'zoom-in', padding: 0, background: `linear-gradient(140deg, hsl(${p2.hue} 36% ${P.mode === 'dark' ? '26%' : '78%'}), hsl(${(p2.hue + 30) % 360} 32% ${P.mode === 'dark' ? '18%' : '66%'}))` }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.mode === 'dark' ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.8)' }}>
        {p2.id === 'selfie' ? <Avatar name={m.name} size={big ? 120 : 56} /> : <Icon name={p2.glyph} size={big ? 80 : 38} stroke={1.4} />}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: 'linear-gradient(transparent, rgba(0,0,0,.45))' }}>
        <span style={{ fontSize: big ? 12 : 10, fontWeight: 700, color: '#fff', letterSpacing: '.04em' }}>{p2.label}</span>
        {!big && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, color: '#fff', background: 'rgba(0,0,0,.35)', padding: '2px 6px', borderRadius: 99 }}><Icon name="expand" size={10} stroke={2} />Enlarge</span>}
      </div>
    </button>;

  const Panel = ({ title, icon, action, children, style }) =>
  <div style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r12, background: P.surface, padding: 12, minWidth: 0, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
        <Icon name={icon} size={13} stroke={1.9} color={P.inkDim} />
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: P.inkMute }}>{title}</span>
        <div style={{ flex: 1 }} />{action}
      </div>
      {children}
    </div>;
  const KV = ({ k, v, mono = true }) =>
  <div style={{ padding: '3px 0' }}>
      <div style={{ fontSize: 10, color: P.inkMute, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 1 }}>{k}</div>
      <div style={{ fontSize: 12.5, color: P.ink2, fontWeight: 600, fontFamily: mono ? P.fontMono : P.fontSans, wordBreak: 'break-word', lineHeight: 1.3 }}>{v}</div>
    </div>;
  // Editable field — pencil to edit inline, save commits
  const EditKV = ({ k, field, mono = true }) => {
    const on = editing === field;
    return (
      <div style={{ padding: '3px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <span style={{ fontSize: 10, color: P.inkMute, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase' }}>{k}</span>
          <button onClick={() => setEditing(on ? null : field)} title={`Edit ${k}`} style={{ display: 'inline-flex', width: 18, height: 18, alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: on ? P.ink : P.inkMute, cursor: 'pointer' }}><Icon name={on ? 'check' : 'pencil'} size={12} stroke={2} /></button>
        </div>
        {on ?
        <input value={f[field]} autoFocus onChange={(e) => set1(field, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setEditing(null)} style={{ width: '100%', marginTop: 2, padding: '5px 8px', border: `1px solid ${P.accentBorder}`, borderRadius: 7, background: P.field, color: P.ink, fontSize: 12.5, fontFamily: mono ? P.fontMono : P.fontSans, outline: 'none' }} /> :
        <div onClick={() => setEditing(field)} style={{ fontSize: 12.5, color: P.ink2, fontWeight: 600, fontFamily: mono ? P.fontMono : P.fontSans, wordBreak: 'break-word', lineHeight: 1.3, cursor: 'text' }}>{f[field]}</div>}
      </div>);

  };

  return (
    <div style={{ flex: '0 0 auto', borderBottom: `1px solid ${P.hairline2}`, background: P.surface2, animation: 'fade .15s ease' }}>
      <div style={{ padding: '13px 22px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
          <Icon name="user" size={15} stroke={1.9} color={P.ink2} />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Member details</span>
          <span style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>· {m.name}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: P.good }}><Icon name="check-circle" size={11} stroke={2} />ID VERIFIED</span>
          <div style={{ flex: 1 }} />
          <PBtn variant="ghost" size="xs" icon="x" onClick={onClose}>Close</PBtn>
        </div>

        {/* Photo cards — scroll through, click to enlarge */}
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 11, marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 2, flex: 1, minWidth: 0 }}>
            {photos.map((p2) => <PhotoCard key={p2.id} p2={p2} />)}
          </div>
          <div style={{ flex: '0 0 196px', border: `1px solid ${P.hairline2}`, borderRadius: P.r12, background: P.surface, padding: 12, display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: P.inkMute, marginBottom: 8 }}>LICENSE · {idNum}</span>
            <KV k="DOB" v={dob} />
            <EditKV k="Expiration" field="exp" />
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <PBtn variant="soft" size="xs" icon="upload" onClick={() => setLb(photos[0])}>Update image</PBtn>
              <PBtn variant="soft" size="xs" icon="calendar" onClick={() => setEditing('exp')}>Exp</PBtn>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(196px, 1fr))', gap: 12, alignItems: 'start' }}>
          <Panel title="Contact" icon="phone" action={<span style={{ fontSize: 10, color: P.inkMute, fontWeight: 600 }}>tap ✎ to edit</span>}>
            <EditKV k="Phone" field="phone" />
            <EditKV k="Email" field="email" mono={false} />
            <EditKV k="Street" field="street" mono={false} />
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}><EditKV k="City" field="city" mono={false} /></div>
              <div style={{ flex: '0 0 56px' }}><EditKV k="State" field="state" /></div>
              <div style={{ flex: '0 0 64px' }}><EditKV k="ZIP" field="zip" /></div>
            </div>
            <div style={{ height: 1, background: P.hairline, margin: '7px 0' }} />
            <KV k="Points" v={m.points.toLocaleString() + ' pts'} />
            <KV k="Member since" v={memberSince} />
            <KV k="Lifetime spend" v={window.HW.fmt.money(lifetime)} />
          </Panel>

          {/* Medical card details (comment 3) */}
          <Panel title="Medical card" icon="shield" action={isMed ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: P.good }}><Icon name="check-circle" size={11} stroke={2} />ACTIVE</span> : <span style={{ fontSize: 10, fontWeight: 700, color: P.inkMute }}>NONE</span>}>
            {isMed ?
            <>
                <KV k="MMIC #" v={mmic} />
                <EditKV k="Expires" field="medExp" />
                <KV k="Recommending MD" v={medMd} mono={false} />
                <KV k="Issued" v={medIssued} />
                <div style={{ height: 1, background: P.hairline, margin: '7px 0' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: P.good, fontWeight: 600 }}><Icon name="check-circle" size={12} stroke={2} />Tax-exempt (MMIC verified)</div>
                <div style={{ marginTop: 9 }}><PBtn variant="soft" size="xs" icon="eye" onClick={() => setLb(photos[2])}>View card</PBtn></div>
              </> :
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: '6px 0' }}>
                <span style={{ fontSize: 11.5, color: P.inkMute, lineHeight: 1.45 }}>No medical card on file. Adult-use customer.</span>
                <PBtn variant="soft" size="xs" icon="plus">Add medical card</PBtn>
              </div>}
          </Panel>

          <Panel title="Orders" icon="receipt">
            <div style={{ marginBottom: 8 }}><Field icon="search" placeholder="Search order #, brand, product, date…" size="sm" value={oq} onChange={(e) => setOq(e.target.value)} /></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 188, overflowY: 'auto' }}>
              {oList.map((o) =>
              <button key={o.id} title={o.live ? 'Open this order' : 'Archived — no live record'}
              onClick={() => {
                if (!o.live) {setHistNote(o.id);return;}
                // Resolved at click time, not at render: the record is the one
                // the order book holds right now, so the modal's edits write.
                const real = window.HW.orderById(o.id);
                if (!real) {setHistNote(o.id);return;}
                setHistNote(null);setOrd(real);
              }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r8, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans, opacity: o.live ? 1 : .72 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: P.ink, fontFamily: P.fontMono }}>{o.live ? o.id : '#' + o.id}</div>
                    <div style={{ fontSize: 10, color: P.inkMute, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.date} · {o.tag}</div>
                  </div>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{window.HW.fmt.money(o.total)}</span>
                  {o.live ?
                <Icon name="chevron-right" size={14} color={P.inkFaint} /> :
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.07em', color: P.inkMute, fontFamily: P.fontMono }}>ARCHIVED</span>}
                </button>
              )}
              {oList.length === 0 && <div style={{ padding: '14px 8px', textAlign: 'center', fontSize: 11.5, color: P.inkMute }}>No orders match</div>}
            </div>
            {histNote &&
          <div style={{ marginTop: 7, padding: '7px 9px', background: P.surface3, borderRadius: P.r8, fontSize: 10.5, color: P.ink2, lineHeight: 1.45 }}>
                #{histNote} is archived history — the order book holds no record for it, so there is nothing to open or edit.
              </div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11.5, color: P.inkDim }}><span>{m.visits} lifetime orders</span><span style={{ fontFamily: P.fontMono }}>avg {window.HW.fmt.money(avgBasket)}</span></div>
          </Panel>

          <Panel title="Referrals" icon="link">
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 8 }}>
              <div style={{ display: 'flex' }}>{referrals.map((r, i) => <span key={r + i} style={{ marginLeft: i ? -8 : 0, borderRadius: 99, boxShadow: `0 0 0 2px ${P.surface}` }}><Avatar name={r} size={24} /></span>)}</div>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: P.ink2, marginLeft: 9 }}>{referrals.length} referral{referrals.length > 1 ? 's' : ''}</span>
            </div>
            <KV k="Gender" v={gender} mono={false} />
            <KV k="Favorite" v={favCat} mono={false} />
            <KV k="Last visit" v={lastVisit} mono={false} />
            <KV k="Avg basket" v={window.HW.fmt.money(avgBasket)} />
          </Panel>
        </div>
      </div>

      {ord && window.OrderDetails && React.createElement(window.OrderDetails, { o: ord, onClose: () => setOrd(null) })}
      {lb &&
      <div onClick={() => setLb(null)} style={{ position: 'fixed', inset: 0, zIndex: 90, background: P.scrim, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 30, animation: 'fade .15s ease' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(440px, 94vw)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: P.railBright }}>{lb.label} · {m.name}</span>
              <div style={{ display: 'flex', gap: 7 }}>
                <PBtn variant="accent" size="sm" icon="upload">Replace image</PBtn>
                <IconBtn icon="x" size={18} onClick={() => setLb(null)} style={{ color: P.railBright }} />
              </div>
            </div>
            <PhotoCard p2={lb} big />
          </div>
        </div>}
    </div>);

}

// `why` is the upsell engine's own reason copy for this tile, present only when
// "For this ticket" ranked it. It is the engine's sentence, never one written
// here — a reason invented by the UI is a claim the ranking never made.
function ProductRow({ p, inCart, onAdd, why }) {
  const P = useP();
  const [sheet, setSheet] = React.useState(false);
  return (
    // `data-hw-sku` names WHICH product this tile is, so the grid's ORDER is
    // readable — the "For this ticket" ranking is an ordering, and an ordering
    // that cannot be read cannot be tested. Not in the harness's clickable
    // selector, so it adds no new click target.
    <div onClick={() => setSheet(true)} data-hw-sku={p.sku} title="View product details" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '7px 10px', background: P.surface, border: `1px solid ${inCart ? P.accentBorder : P.hairline2}`, borderRadius: P.r12, transition: 'border-color .12s', cursor: 'pointer' }}
      onMouseEnter={(e) => {if (!inCart) e.currentTarget.style.borderColor = P.hairline3;}}
      onMouseLeave={(e) => {if (!inCart) e.currentTarget.style.borderColor = P.hairline2;}}>
      <Thumb item={p} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.brand}</span>
          <span style={{ fontSize: 10, color: p.qty < 10 ? P.warn : P.inkFaint, fontFamily: P.fontMono, whiteSpace: 'nowrap', flex: '0 0 auto' }}>{p.qty} left</span>
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
        {why && <div data-hw-why={why} style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, fontSize: P.type.micro, fontWeight: 700, color: P.accentText, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><Icon name="sparkle" size={10} stroke={2} />{why}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
          {p.strain && <StrainPill type={p.strain} thc={p.thc} />}
          {p.wt && <span style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>{p.wt}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
          {p.was && <span style={{ fontSize: 11.5, color: P.inkFaint, textDecoration: 'line-through', fontFamily: P.fontMono }}>{window.HW.fmt.money0(p.was)}</span>}
          <span style={{ fontSize: 15, fontWeight: 700, color: p.was ? P.bad : P.ink, fontFamily: P.fontMono }}>{window.HW.fmt.money0(p.price)}</span>
        </div>
        <button onClick={(e) => {e.stopPropagation();onAdd();}} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: inCart ? P.ink : P.surface, color: inCart ? P.surface : P.ink, border: `1px solid ${inCart ? P.ink : P.hairline3}`, borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: P.fontSans, minHeight: 30, transition: 'background .12s, border-color .12s' }}
          onMouseEnter={(e) => {if (!inCart) {e.currentTarget.style.background = P.accentSoft;e.currentTarget.style.borderColor = P.accentBorder;}}}
          onMouseLeave={(e) => {if (!inCart) {e.currentTarget.style.background = P.surface;e.currentTarget.style.borderColor = P.hairline3;}}}>
          {inCart ? <><Icon name="check" size={14} stroke={2.6} />{inCart}</> : <><Icon name="plus" size={15} stroke={2.6} />Add</>}
        </button>
      </div>
      {sheet && window.ProductSheet && <window.ProductSheet p={p} inCart={inCart} onAdd={onAdd} onClose={() => setSheet(false)} />}
    </div>);

}

Object.assign(window, {});