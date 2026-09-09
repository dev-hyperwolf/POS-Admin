// ── athome/ shared formatters & fixtures — window.AtHome ────────────────────
// Plain JS (no JSX, no React dependency), one IIFE, one global. Loads before
// account-a/b/c.jsx, admin.jsx and crm.jsx on all three athome/ HTMLs.
//
// money/money2 were defined byte-identically five times: account-a.jsx:8-9,
// account-b.jsx:8-9, account-c.jsx:8-9, admin.jsx:9-10, crm.jsx:7-8. This is
// the one copy.
//
// The three Customer Account variants (account-a/b/c.jsx → Hub & groups /
// Membership card / Concierge, switched by account-switch.jsx) are DELIBERATE
// UI variants and stay three screens — only their DATA (ME, ORDERS) was a
// byte-identical triplicate, so only the data moves here.
;(function () {
  const HWC = (typeof window !== 'undefined' && window.HWContracts) || null;

  const money = (n) => '$' + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
  const money2 = (n) => '$' + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // contracts/index.js LoyaltyTier (bronze|silver|gold|platinum) — every athome/
  // screen shows the tier title-cased ("Gold"), never the raw enum id, so the
  // label map is built here once instead of each fixture hand-typing 'Gold'.
  const LOYALTY_TIERS = (HWC && HWC.enumValues('LoyaltyTier')) || ['bronze', 'silver', 'gold', 'platinum'];
  const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const LOYALTY_TIER_LABEL = {};
  LOYALTY_TIERS.forEach((t) => { LOYALTY_TIER_LABEL[t] = titleCase(t); });
  // '—' is "no tier assigned" (a cancelled/never-onboarded record) — not a
  // LoyaltyTier value, so it is not in the map above and stays a literal at
  // each of its few call sites.

  // admin.jsx's STATUS (appointment/visit lifecycle) and GSTATUS (Genius shift
  // state), moved here so there is one export instead of the sole local copy.
  // Reported as-is for the orchestrator's enum decision — this file does not
  // decide AtHomeVisitStatus / GeniusShiftStatus, only stops the vocabulary
  // living nowhere but one screen's local scope.
  const STATUS = {
    requested:  { label: 'Requested', kind: 'warn', dot: true },
    confirmed:  { label: 'Confirmed', kind: 'info', dot: true },
    en_route:   { label: 'En route',   kind: 'info', dot: true },
    in_session: { label: 'In session', kind: 'good', dot: true },
    completed:  { label: 'Completed', kind: 'neutral' },
    canceled:   { label: 'Canceled',  kind: 'bad' },
  };
  const GSTATUS = {
    available:  { label: 'Available', kind: 'good' },
    en_route:   { label: 'En route',   kind: 'info' },
    in_session: { label: 'In session', kind: 'warn' },
    off:        { label: 'Off shift', kind: 'neutral' },
  };

  // ── Customer Account (account-a/b/c.jsx) shared fixtures ──────────────────
  // Byte-identical across all three variants before this file existed.
  const ME = {
    name: 'Reggie Watts', first: 'Reggie', tier: LOYALTY_TIER_LABEL.gold, since: 'Jun 2024', years: '2 yr',
    phone: '(909) 555-0287', email: 'reggie.w@gmail.com', dob: 'Mar 14, 1990',
    points: 2840, pointsToNext: 660, nextTier: LOYALTY_TIER_LABEL.platinum, wallet: 42.50, orders: 34, ltv: 8240,
    idVerified: true, idExpires: 'Aug 2028',
  };
  const ORDERS = [
    { id: 'A-2041', kind: '@ Home', date: 'Today · 2:00p', status: 'In session', total: null, items: 5, live: true, genius: 'Marcus Vale', eta: 'Now', note: 'Live rosin + sleep' },
    { id: 'H-8841', kind: 'Delivery', date: 'Jul 2', status: 'Delivered', total: 212, items: 4, rating: 5 },
    { id: 'H-8720', kind: 'Pickup', date: 'Jun 24', status: 'Delivered', total: 96, items: 2, rating: 5 },
    { id: 'A-2010', kind: '@ Home', date: 'Jun 12', status: 'Completed', total: 388, items: 6, rating: 5, genius: 'Marcus Vale' },
    { id: 'H-8402', kind: 'Delivery', date: 'May 30', status: 'Delivered', total: 148, items: 3, rating: 4 },
  ];

  window.AtHome = {
    money, money2,
    LOYALTY_TIERS, LOYALTY_TIER_LABEL,
    STATUS, GSTATUS,
    ME, ORDERS,
  };
})();
