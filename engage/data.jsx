// ── Engage fixtures — one seeded PRNG, shapes match the server actions ─────
// The upstream console reads Postgres via server actions, so there is no
// fixture file to port. These rows mirror the row types those actions return
// (customer list/detail, audiences, flows, loyalty, referrals, messages,
// events) so every screen renders with plausible, stable data.
;(function () {
  function mulberry32(seed) {
    return function () {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(0x5eed17);
  const range = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
  const floatRange = (lo, hi) => lo + rng() * (hi - lo);
  const pick = (a) => a[Math.floor(rng() * a.length)];
  const chance = (p) => rng() < p;
  const NOW = new Date('2026-04-20T15:30:00-07:00').getTime();
  const ago = (mins) => new Date(NOW - mins * 60000).toISOString();
  const agoDays = (d) => new Date(NOW - d * 86400000).toISOString();

  const TENANT = { id: 't-1', name: 'Green Leaf Collective', slug: 'green-leaf', role: 'Admin', customers: 42318 };
  const TENANTS = [
    TENANT,
    { id: 't-2', name: 'Oaktown Dispensary', slug: 'oaktown', role: 'Marketer', customers: 18402 },
    { id: 't-3', name: 'Harbor Cannabis Co.', slug: 'harbor', role: 'Admin', customers: 9155 },
  ];

  // ── Customers ───────────────────────────────────────────────────────────
  const RFM_SEGMENTS = ['champions', 'loyal', 'potential_loyal', 'new', 'needs_attention', 'at_risk', 'hibernating'];
  const RFM_TONE = { champions: 'ok', loyal: 'info', potential_loyal: 'info', new: 'neutral', needs_attention: 'warn', at_risk: 'blocked', hibernating: 'neutral' };
  const TIERS = ['Seed', 'Sprout', 'Bloom', 'Diamond'];
  const FIRST = ['Jordan', 'Alexis', 'Priya', 'Marcus', 'Dana', 'Luis', 'Tomas', 'Renee', 'Kai', 'Nadia', 'Owen', 'Simone', 'Devon', 'Yara', 'Caleb', 'Imani', 'Felix', 'Rosa', 'Hugo', 'Mei', 'Silas', 'Talia', 'Bruno', 'Elena', 'Grant', 'Noor', 'Wesley', 'Camille', 'Ivan', 'Leah', 'Malik', 'Sofia', 'Trent', 'Uma', 'Vince', 'Willa', 'Xavier', 'Yusuf', 'Zoe', 'Aaron'];
  const LAST = ['Alvarez', 'Brooks', 'Chen', 'Duarte', 'Eriksen', 'Flores', 'Gupta', 'Hollis', 'Ibrahim', 'Jensen', 'Kowal', 'Lindqvist', 'Moreno', 'Nguyen', 'Okafor', 'Petrov', 'Quinn', 'Ramos', 'Silva', 'Tanaka', 'Ueda', 'Vargas', 'Whitfield', 'Xiong', 'Yates', 'Zamora'];
  const CHANNELS = ['sms', 'email', 'push', 'wallet'];

  function hex(n) { let s = ''; for (let i = 0; i < n; i++) s += '0123456789abcdef'[Math.floor(rng() * 16)]; return s; }
  function uuid() { return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`; }

  const CUSTOMERS = Array.from({ length: 64 }, () => {
    const first = pick(FIRST), last = pick(LAST);
    const segment = pick(RFM_SEGMENTS);
    const heavy = segment === 'champions' || segment === 'loyal';
    const orders = heavy ? range(14, 96) : range(1, 18);
    const lifetimeSpentCents = orders * range(3200, 14500);
    const recencyDays = segment === 'hibernating' ? range(120, 320) : segment === 'at_risk' ? range(45, 110) : range(0, 30);
    return {
      id: uuid(),
      // ONE FIELD PER PARAMETER [OWNER RULING 2026-08-27]. This generator held
      // `first` and `last` and threw the pair away, keeping only the joined
      // string — so every consumer that needed a half had to guess it back.
      // engage/screen-customers.jsx did exactly that, with `name.split(' ')[1]`,
      // which THROWS on a one-word name and blanks the whole detail screen.
      // The pair is the captured fact; `name` is DERIVED from it and kept only
      // for display and for the list-view search, so the two cannot drift.
      firstName: first,
      lastName: last,
      name: [first, last].filter(Boolean).join(' '),
      initials: `${first[0] || ''}${last[0] || ''}`,
      tierName: heavy ? pick(['Bloom', 'Diamond']) : pick(TIERS),
      rfmSegment: segment,
      lifetimeSpentCents,
      lifetimeOrders: orders,
      recencyDays,
      pointsBalance: Math.round(lifetimeSpentCents / 100) + range(0, 800),
      hasConsent: chance(0.82),
      hasEncryptedEmail: chance(0.94),
      hasEncryptedPhone: true,
      ageVerifiedAt: chance(0.88) ? agoDays(range(10, 400)) : null,
      churnRisk30d: Number(floatRange(0.04, 0.93).toFixed(2)),
      winBackProbability: Number(floatRange(0.08, 0.74).toFixed(2)),
      predictedLtv90dCents: range(4000, 92000),
      lifetimeEarned: 0, lifetimeSpent: 0,
      storeSlug: pick(['green-leaf-wh', 'green-leaf-le', 'green-leaf-cor', 'green-leaf-lb']),
    };
  });
  CUSTOMERS.forEach((c) => {
    c.lifetimeEarned = c.pointsBalance + range(200, 4200);
    c.lifetimeSpent = c.lifetimeEarned - c.pointsBalance;
  });

  // ── Audiences ───────────────────────────────────────────────────────────
  const AUDIENCE_SEEDS = [
    ['At-risk VIPs', 'ai', 'Diamond + Bloom tiers with churn_30d ≥ 0.55 and no order in 45 days.'],
    ['Champions · flower buyers', 'rule', 'RFM champions whose top category is flower.'],
    ['Lapsed 90+ days', 'rule', 'No completed order in 90 days, consent on file.'],
    ['New this month', 'rule', 'First order within the last 30 days.'],
    ['High-LTV vape propensity', 'ai', 'predicted_ltv_90d ≥ $400 and propensity_vape ≥ 0.6.'],
    ['Wallet pass holders', 'rule', 'Has an active Apple or Google wallet pass.'],
    ['Quiet-hours senders', 'rule', 'Timezone-safe subset for 8pm sends.'],
    ['Birthday · next 14 days', 'rule', 'Birthday within the next two weeks.'],
    ['Referral advocates', 'ai', 'Completed ≥ 2 referrals in 180 days.'],
    ['Concentrates cross-sell', 'ai', 'Flower-only buyers with propensity_concentrates ≥ 0.5.'],
    ['SMS unengaged', 'rule', 'No click in 6 SMS sends — throttle candidates.'],
    ['Store · West Hollywood', 'rule', 'Primary store is West Hollywood.'],
  ];
  const AUDIENCES = AUDIENCE_SEEDS.map(([name, source, description], i) => {
    const size = range(180, 12400);
    return {
      id: `aud-${String(i + 1).padStart(3, '0')}`,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      name, source, description,
      status: i === 11 ? 'draft' : chance(0.85) ? 'live' : 'paused',
      size,
      sizeDelta: range(-420, 640),
      reachableSms: Math.round(size * floatRange(0.62, 0.94)),
      reachableEmail: Math.round(size * floatRange(0.55, 0.9)),
      lastRefreshedAt: ago(range(2, 700)),
      refreshCadence: pick(['15 min', 'hourly', 'nightly']),
      usedByFlows: range(0, 4),
      usedByCampaigns: range(0, 6),
      createdBy: pick(['Jessica Tran', 'Manisha Patel', 'AI builder']),
      createdAt: agoDays(range(3, 210)),
      predicate: pick([
        'rfm_segment in (champions, loyal) AND churn_30d >= 0.55',
        'last_order_at < now() - 90d AND consent.sms = granted',
        'predicted_ltv_90d >= 40000 AND propensity_vape >= 0.6',
        'tier in (Bloom, Diamond) AND lifetime_orders >= 12',
      ]),
      history: Array.from({ length: 12 }, (_, k) => Math.round(size * (0.82 + k * 0.016 + floatRange(-0.02, 0.02)))),
    };
  });

  const SUGGESTED_AUDIENCES = [
    { id: 'sug-1', name: 'Champions look-alikes', size: 412, confidence: 0.86, rationale: 'Behaviour matches your top Champions cohort but no tag applied. High basket size, weekly cadence.', signals: ['basket ≥ $92', 'orders/mo ≥ 3.1', 'flower + concentrates'] },
    { id: 'sug-2', name: 'Silent Diamonds', size: 168, confidence: 0.79, rationale: 'Diamond tier with zero message engagement in 60 days — wallet pass is the likely channel.', signals: ['tier Diamond', 'no click 60d', 'wallet pass active'] },
    { id: 'sug-3', name: 'Weekend-only shoppers', size: 2140, confidence: 0.72, rationale: 'Purchases cluster Fri–Sun. Time-of-day send window would lift CTR materially.', signals: ['84% Fri–Sun', 'avg 6:40pm', 'SMS preferred'] },
    { id: 'sug-4', name: 'Price-sensitive lapsers', size: 936, confidence: 0.68, rationale: 'Only convert on ≥20% promos. Discount-gated winback keeps margin intact.', signals: ['promo attach 91%', 'lapsed 60d', 'avg discount 22%'] },
  ];

  // ── Flows ───────────────────────────────────────────────────────────────
  const FLOWS = [
    { id: 'flow-001', name: 'Welcome series', trigger: 'customer.created', status: 'live', steps: 4, enrolled: 1284, completed: 902, converted: 214, revenueCents: 1284000, versionNo: 7, updatedAt: ago(220) },
    { id: 'flow-002', name: 'Abandoned cart · 1h', trigger: 'commerce.cart.abandoned', status: 'live', steps: 3, enrolled: 3410, completed: 2288, converted: 611, revenueCents: 2894000, versionNo: 12, updatedAt: ago(90) },
    { id: 'flow-003', name: 'Winback · 60 days', trigger: 'schedule.daily', status: 'live', steps: 5, enrolled: 2210, completed: 1502, converted: 288, revenueCents: 1642000, versionNo: 4, updatedAt: agoDays(3) },
    { id: 'flow-004', name: 'Post-purchase review', trigger: 'commerce.order.completed', status: 'paused', steps: 2, enrolled: 8802, completed: 8104, converted: 92, revenueCents: 122000, versionNo: 9, updatedAt: agoDays(6) },
    { id: 'flow-005', name: 'Tier upgrade celebration', trigger: 'loyalty.tier.entered', status: 'live', steps: 3, enrolled: 640, completed: 601, converted: 188, revenueCents: 986000, versionNo: 3, updatedAt: agoDays(1) },
    { id: 'flow-006', name: 'Birthday reward', trigger: 'schedule.daily', status: 'live', steps: 3, enrolled: 480, completed: 402, converted: 140, revenueCents: 712000, versionNo: 5, updatedAt: agoDays(9) },
    { id: 'flow-007', name: 'Referral nudge', trigger: 'referral.attributed', status: 'draft', steps: 4, enrolled: 0, completed: 0, converted: 0, revenueCents: 0, versionNo: 1, updatedAt: agoDays(2) },
  ];

  const FLOW_STEPS = {
    'flow-002': [
      { id: 's1', kind: 'trigger', label: 'Cart abandoned', detail: 'commerce.cart.abandoned · value ≥ $40', entered: 3410 },
      { id: 's2', kind: 'wait', label: 'Wait 1 hour', detail: 'quiet-hours aware', entered: 3410 },
      { id: 's3', kind: 'condition', label: 'Ordered since?', detail: 'skip if commerce.order.completed', entered: 3288, branchA: 'yes → exit', branchB: 'no → continue' },
      { id: 's4', kind: 'message', label: 'SMS · cart reminder', detail: 'tmpl_cart_reminder_v3 · 2,940 sent', entered: 2940 },
      { id: 's5', kind: 'wait', label: 'Wait 22 hours', detail: '', entered: 2288 },
      { id: 's6', kind: 'message', label: 'Email · 10% nudge', detail: 'tmpl_cart_email_v2 · policy-capped', entered: 1842 },
    ],
  };

  const FLOW_TEMPLATES = [
    { id: 'ft-1', name: 'Welcome series', category: 'Lifecycle', steps: 4, blurb: 'Three-touch onboarding with consent capture and a first-purchase reward.', channels: ['sms', 'email'] },
    { id: 'ft-2', name: 'Abandoned cart', category: 'Commerce', steps: 3, blurb: '1-hour SMS then next-day email with margin-safe discount ladder.', channels: ['sms', 'email'] },
    { id: 'ft-3', name: 'Winback 60/90', categoryd: '', category: 'Retention', steps: 5, blurb: 'Escalating winback that stops the moment they order.', channels: ['sms', 'email', 'push'] },
    { id: 'ft-4', name: 'Birthday reward', category: 'Loyalty', steps: 3, blurb: 'Pre-birthday teaser, day-of reward grant, expiry reminder.', channels: ['sms', 'wallet'] },
    { id: 'ft-5', name: 'Tier upgrade', category: 'Loyalty', steps: 3, blurb: 'Celebrate the tier, explain the perks, push wallet pass refresh.', channels: ['push', 'wallet'] },
    { id: 'ft-6', name: 'Review request', category: 'Advocacy', steps: 2, blurb: 'Post-pickup ask, throttled to one per 90 days per customer.', channels: ['sms'] },
  ];

  // ── Campaigns + messages + templates ────────────────────────────────────
  const CAMPAIGNS = [
    { id: 'cmp-001', name: 'Labor Day Flower Drop', channel: 'sms', status: 'sent', audience: 'Champions · flower buyers', sent: 11204, delivered: 9881, clicked: 3112, revenueCents: 4820000, sentAt: ago(52) },
    { id: 'cmp-002', name: '4/20 Countdown · Day 3', channel: 'sms', status: 'sending', audience: 'All consented', sent: 6402, delivered: 5980, clicked: 1420, revenueCents: 1980000, sentAt: ago(14) },
    { id: 'cmp-003', name: 'Concentrates cross-sell', channel: 'email', status: 'scheduled', audience: 'Concentrates cross-sell', sent: 0, delivered: 0, clicked: 0, revenueCents: 0, sentAt: null, scheduledFor: ago(-720) },
    { id: 'cmp-004', name: 'Diamond tier perks refresh', channel: 'wallet', status: 'sent', audience: 'Wallet pass holders', sent: 4021, delivered: 4008, clicked: 902, revenueCents: 1140000, sentAt: agoDays(2) },
    { id: 'cmp-005', name: 'Winback · lapsed 90', channel: 'email', status: 'sent', audience: 'Lapsed 90+ days', sent: 8802, delivered: 8410, clicked: 1188, revenueCents: 2210000, sentAt: agoDays(5) },
    { id: 'cmp-006', name: 'Weekend BOGO teaser', channel: 'push', status: 'draft', audience: 'Weekend-only shoppers', sent: 0, delivered: 0, clicked: 0, revenueCents: 0, sentAt: null },
  ];

  const TEMPLATES = [
    { id: 'tmpl-001', name: 'Cart reminder · SMS v3', channel: 'sms', updatedAt: agoDays(1), usedBy: 3, body: 'Still thinking it over? Your cart at Green Leaf is saved for 24h. {{link}} Reply STOP to opt out.', segments: 1, chars: 118 },
    { id: 'tmpl-002', name: 'Welcome · email', channel: 'email', updatedAt: agoDays(4), usedBy: 2, subject: 'Welcome to Green Leaf', body: 'Hi {{first_name}} — your account is live. Here is how points work…', segments: 0, chars: 0 },
    { id: 'tmpl-003', name: 'Winback 20% · SMS', channel: 'sms', updatedAt: agoDays(6), usedBy: 4, body: '{{first_name}}, 20% off your next pickup through Sunday. {{link}}', segments: 1, chars: 96 },
    { id: 'tmpl-004', name: 'Tier upgrade · push', channel: 'push', updatedAt: agoDays(9), usedBy: 1, body: 'You just hit {{tier_name}} — new perks unlocked.', segments: 0, chars: 0 },
    { id: 'tmpl-005', name: 'Wallet pass refresh', channel: 'wallet', updatedAt: agoDays(12), usedBy: 2, body: 'Points balance {{points}} · {{tier_name}}', segments: 0, chars: 0 },
    { id: 'tmpl-006', name: 'Birthday reward · SMS', channel: 'sms', updatedAt: agoDays(15), usedBy: 1, body: 'Happy birthday {{first_name}}! A gift is waiting in your wallet. {{link}}', segments: 1, chars: 104 },
  ];

  const MESSAGE_STATUSES = ['delivered', 'delivered', 'delivered', 'sent', 'queued', 'held', 'failed', 'blocked'];
  const MESSAGES = Array.from({ length: 40 }, (_, i) => {
    const status = pick(MESSAGE_STATUSES);
    const channel = pick(CHANNELS);
    const c = pick(CUSTOMERS);
    return {
      id: `msg-${String(i + 1).padStart(4, '0')}`,
      customerId: c.id, customerName: c.name, initials: c.initials,
      channel, status,
      templateName: pick(TEMPLATES).name,
      campaignName: pick(CAMPAIGNS).name,
      scheduledFor: ago(range(5, 2600)),
      deliveredAt: status === 'delivered' ? ago(range(1, 2500)) : null,
      reason: status === 'held' ? 'quiet hours · releasing 09:00 local' : status === 'blocked' ? 'frequency cap · 3/7d' : status === 'failed' ? 'carrier 30008 unknown error' : null,
      costCents: channel === 'sms' ? range(1, 3) : channel === 'email' ? 0 : 0,
    };
  });

  // ── Loyalty ─────────────────────────────────────────────────────────────
  const LOYALTY_PROGRAMS = [
    {
      id: 'lp-001', name: 'Green Leaf Rewards', status: 'active', earnRate: '1 pt per $1', redeemRate: '100 pts = $5',
      members: 38210, pointsOutstanding: 4820140, liabilityCents: 24100700, expiryMonths: 12,
      tiers: [
        { name: 'Seed', threshold: 0, members: 18240, perks: ['1x points', 'birthday reward'] },
        { name: 'Sprout', threshold: 500, members: 12480, perks: ['1.25x points', 'early drops'] },
        { name: 'Bloom', threshold: 2000, members: 5920, perks: ['1.5x points', 'free delivery'] },
        { name: 'Diamond', threshold: 6000, members: 1570, perks: ['2x points', 'concierge line', 'quarterly gift'] },
      ],
      rewards: [
        { id: 'rw-1', name: '$5 off', cost: 100, redeemed30d: 2140, status: 'active' },
        { id: 'rw-2', name: '$15 off', cost: 280, redeemed30d: 812, status: 'active' },
        { id: 'rw-3', name: 'Free pre-roll', cost: 150, redeemed30d: 1402, status: 'active' },
        { id: 'rw-4', name: 'Birthday gift', cost: 0, redeemed30d: 402, status: 'automatic' },
        { id: 'rw-5', name: 'Merch tee', cost: 900, redeemed30d: 41, status: 'paused' },
      ],
    },
    { id: 'lp-002', name: 'Hyperwolf Delivery Perks', status: 'draft', earnRate: '1 pt per $1', redeemRate: '100 pts = $5', members: 0, pointsOutstanding: 0, liabilityCents: 0, expiryMonths: 12, tiers: [], rewards: [] },
  ];

  const WALLET_PASSES = {
    installed: 12480, appleShare: 0.68, googleShare: 0.32,
    pushQueue: 0, lastPushAt: ago(38), refreshed24h: 402, staleOver7d: 118,
    byStore: [
      { store: 'West Hollywood', installed: 4102, active: 3811 },
      { store: 'Lake Elsinore', installed: 2840, active: 2510 },
      { store: 'Corona', installed: 2988, active: 2704 },
      { store: 'Long Beach', installed: 2550, active: 2301 },
    ],
  };

  // ── Referrals ───────────────────────────────────────────────────────────
  const REFERRAL_PROGRAMS = [
    { id: 'rp-001', name: 'Give $10 / Get $10', status: 'active', advocateReward: '1,000 pts', friendReward: '$10 off first order', referrals30d: 812, completed30d: 402, fraudFlagged30d: 24, revenueCents: 1840000, payoutCents: 402000 },
    { id: 'rp-002', name: 'Diamond ambassador', status: 'active', advocateReward: '2,500 pts + merch', friendReward: '$15 off', referrals30d: 140, completed30d: 92, fraudFlagged30d: 3, revenueCents: 620000, payoutCents: 138000 },
    { id: 'rp-003', name: 'Budtender referral', status: 'paused', advocateReward: '$5 gift card', friendReward: '$5 off', referrals30d: 0, completed30d: 0, fraudFlagged30d: 0, revenueCents: 0, payoutCents: 0 },
  ];

  const REFERRALS = Array.from({ length: 26 }, (_, i) => {
    const advocate = pick(CUSTOMERS), friend = pick(CUSTOMERS);
    const status = pick(['completed', 'completed', 'attributed', 'pending', 'fraud_flagged', 'expired']);
    return {
      id: `ref-${String(i + 1).padStart(3, '0')}`,
      code: `GL${hex(3).toUpperCase()}`,
      programId: pick(REFERRAL_PROGRAMS).id,
      advocateName: advocate.name, advocateInitials: advocate.initials,
      friendName: friend.name, friendInitials: friend.initials,
      status,
      firstOrderCents: status === 'completed' ? range(4200, 22000) : 0,
      attributedAt: ago(range(20, 9000)),
      riskScore: status === 'fraud_flagged' ? Number(floatRange(0.72, 0.98).toFixed(2)) : Number(floatRange(0.02, 0.45).toFixed(2)),
      riskReasons: status === 'fraud_flagged' ? [pick(['same device fingerprint', 'shared payment instrument', 'self-referral email alias', 'velocity: 6 in 1h'])] : [],
    };
  });

  // ── Interactive campaigns ───────────────────────────────────────────────
  const INTERACTIVE = [
    { id: 'int-1', name: '4/20 Spin to Win', kind: 'spin_wheel', status: 'live', plays: 8420, uniquePlayers: 6102, winRate: 0.32, prizes: [{ label: '10% off', weight: 40, awarded: 2688 }, { label: 'Free pre-roll', weight: 25, awarded: 1680 }, { label: '250 pts', weight: 30, awarded: 2016 }, { label: 'Merch tee', weight: 5, awarded: 336 }] },
    { id: 'int-2', name: 'Scratch & Save', kind: 'scratch_card', status: 'live', plays: 3210, uniquePlayers: 2904, winRate: 0.28, prizes: [{ label: '$5 off', weight: 60, awarded: 1926 }, { label: '$15 off', weight: 30, awarded: 963 }, { label: 'Free delivery', weight: 10, awarded: 321 }] },
    { id: 'int-3', name: 'Strain IQ quiz', kind: 'quiz', status: 'ended', plays: 1840, uniquePlayers: 1802, winRate: 1, prizes: [{ label: '100 pts', weight: 100, awarded: 1840 }] },
    { id: 'int-4', name: 'Summer mystery drop', kind: 'spin_wheel', status: 'draft', plays: 0, uniquePlayers: 0, winRate: 0, prizes: [] },
  ];

  // ── Integrations ────────────────────────────────────────────────────────
  const INTEGRATIONS = [
    { id: 'ig-1', name: 'Hyperdrive POS', slug: 'hyperdrive', kind: 'pos', status: 'connected', lastSyncAt: ago(4), rows24h: 18402, health: 'ok', direction: 'bidirectional' },
    { id: 'ig-2', name: 'Blaze POS', slug: 'blaze', kind: 'pos', status: 'connected', lastSyncAt: ago(11), rows24h: 9120, health: 'ok', direction: 'inbound' },
    { id: 'ig-3', name: 'Twilio SMS', slug: 'twilio', kind: 'channel', status: 'connected', lastSyncAt: ago(1), rows24h: 42800, health: 'ok', direction: 'outbound' },
    { id: 'ig-4', name: 'SendGrid', slug: 'sendgrid', kind: 'channel', status: 'connected', lastSyncAt: ago(2), rows24h: 61240, health: 'degraded', direction: 'outbound' },
    { id: 'ig-5', name: 'Alpine IQ', slug: 'alpineiq', kind: 'crm', status: 'migrating', lastSyncAt: ago(180), rows24h: 4210, health: 'warn', direction: 'inbound' },
    { id: 'ig-6', name: 'Weedmaps', slug: 'weedmaps', kind: 'marketplace', status: 'pending', lastSyncAt: null, rows24h: 0, health: 'idle', direction: 'bidirectional' },
    { id: 'ig-7', name: 'Snowflake export', slug: 'snowflake', kind: 'warehouse', status: 'connected', lastSyncAt: ago(60), rows24h: 220400, health: 'ok', direction: 'outbound' },
  ];

  // ── Audit + events ──────────────────────────────────────────────────────
  const EVENT_TYPES = [
    'identity.consent.granted', 'identity.consent.revoked', 'identity.pii.revealed', 'compliance.suppression.added',
    'commerce.order.completed', 'loyalty.points.credited', 'loyalty.tier.entered', 'loyalty.reward.redeemed',
    'campaign.message.sent', 'campaign.message.delivered', 'campaign.message.clicked', 'campaign.message.failed',
    'referral.attributed', 'referral.completed', 'referral.fraud_flagged', 'audience.refreshed', 'flow.version.published',
  ];
  const ACTORS = ['jessica@greenleaf.co', 'manisha@hyperwolf.com', 'system:worker', 'system:flow-engine', 'ops@greenleaf.co'];
  const AUDIT = Array.from({ length: 48 }, (_, i) => {
    const c = pick(CUSTOMERS);
    return {
      id: `ev-${String(i + 1).padStart(4, '0')}`,
      eventType: pick(EVENT_TYPES),
      actor: pick(ACTORS),
      at: ago(range(2, 5200)),
      customerId: c.id, customerName: c.name,
      ip: `${range(12, 210)}.${range(0, 255)}.${range(0, 255)}.${range(1, 254)}`,
      payload: { channel: pick(CHANNELS), delta: range(-400, 900), totalCents: range(2200, 24000) },
    };
  });

  window.ENGAGE_DATA = {
    NOW, TENANT, TENANTS, rng, range, floatRange, pick, chance, ago, agoDays,
    RFM_SEGMENTS, RFM_TONE, TIERS, CHANNELS, CUSTOMERS,
    AUDIENCES, SUGGESTED_AUDIENCES, FLOWS, FLOW_STEPS, FLOW_TEMPLATES,
    CAMPAIGNS, TEMPLATES, MESSAGES, LOYALTY_PROGRAMS, WALLET_PASSES,
    REFERRAL_PROGRAMS, REFERRALS, INTERACTIVE, INTEGRATIONS, AUDIT, EVENT_TYPES,
  };
})();
