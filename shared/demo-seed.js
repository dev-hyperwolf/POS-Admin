/* ── DEMO DATA, IN ONE PLACE ─────────────────────────────────────────────────
 *
 * The problem this solves, in the owner's words: "right now everything is super
 * confusing I dont even know what to do."
 *
 * The estate's demo data is authored as `const` arrays across several files, so
 * adding one more order meant finding the right array, matching an undocumented
 * positional factory, and knowing which OTHER map also needed a matching entry.
 * A Weedmaps order needs TWO records that must agree, and nothing said so.
 *
 * So: one file, one floating "Demo data" button on every page that loads it, and
 * three buttons. Each one creates the record AND TELLS YOU WHERE IT WENT and
 * what to do next — because knowing a thing was created is not the same as
 * knowing where to look for it.
 *
 * Plain JS, no build step. Include AFTER pos/data.jsx:
 *   <script src="shared/demo-seed.js"></script>
 *
 * Programmatic use, if you'd rather not click:
 *   HWSeed.weedmapsOrder()            // a clean one
 *   HWSeed.weedmapsOrder('high-risk') // presets below
 *   HWSeed.product({ name:'X', price:42 })
 *   HWSeed.customer({ name:'Y' })
 *
 * ⚠️ IN-MEMORY ONLY. Seeded records live until reload. That is deliberate: a
 * demo you can reset by refreshing is easier to trust than one that accumulates
 * state you have to clean up.
 */
(function () {
  if (window.HWSeed) return;

  var HW = function () { return window.HW || {}; };
  var pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };
  var money = function (n) { return Math.round(n * 100) / 100; };

  /** Next free ORD- number across everything already on the board. */
  function nextOrderNum() {
    var max = 0;
    (HW().ORDERS || []).forEach(function (o) {
      var n = parseInt(String(o.num || '').replace(/\D/g, ''), 10);
      if (n > max) max = n;
    });
    return String(max + 1).padStart(5, '0');
  }

  function nextId(list, prefix) {
    var max = 0;
    (list || []).forEach(function (x) {
      var n = parseInt(String(x.id || '').replace(prefix, ''), 10);
      if (!isNaN(n) && n > max) max = n;
    });
    return prefix + (max + 1);
  }

  // ── Weedmaps orders ───────────────────────────────────────────────────────
  //
  // A WM order is TWO records that must agree: a row in HW.ORDERS (what the
  // queue renders) and an entry in HW.WM_ORDER keyed by the same id (the
  // verification, risk and identity-match signals). Creating one without the
  // other gives you an order the POS renders and then crashes on, which is the
  // trap this function exists to remove.
  var WM_PRESETS = {
    clean: {
      label: 'Clean — matches an existing member',
      risk: 9, level: 'low', match: 'existing', matchConf: 0.97,
      checks: { id: 'pass', name: 'match', phone: 'verified', email: 'valid', address: 'n/a' },
      flags: [], stage: 'verify',
      next: 'It lands in Orders → Needs match with a confident match. Bind it and it moves to Verify.',
    },
    'needs-id': {
      label: 'Needs ID — verification gate',
      risk: 44, level: 'medium', match: 'new',
      checks: { id: 'pending', name: 'match', phone: 'unverified', email: 'valid', address: 'n/a' },
      flags: ['No ID uploaded / age unverified'], stage: 'verify',
      remoteId: { status: 'sent', sentAt: 'just now', by: 'System', link: 'hyprwlf.co/id/N3w1', attempts: [] },
      next: 'Lands in Needs match with ID pending. Send or chase the ID link, then bind.',
    },
    'high-risk': {
      label: 'High risk — fraud signals',
      risk: 84, level: 'high', match: 'new',
      checks: { id: 'missing', name: 'suspicious', phone: 'unverified', email: 'invalid', address: 'n/a' },
      flags: ['Display name fails name heuristics', 'Email hard-bounced on send', 'No ID uploaded / age unverified'],
      stage: 'verify',
      next: 'Lands in Needs match, flagged. Good for testing the refusal path — it should NOT be bindable without ID.',
    },
    delivery: {
      label: 'Delivery — needs an address',
      risk: 52, level: 'medium', match: 'new', delivery: true, channel: 'Delivery',
      checks: { id: 'pending', name: 'match', phone: 'unverified', email: 'valid', address: 'unverified' },
      flags: ['Delivery to an address we can’t verify', 'Phone not SMS-verified — delivery orders require it'],
      stage: 'verify',
      next: 'A delivery order — it needs an address AND an SMS-verified phone before it can be packed.',
    },
    ambiguous: {
      label: 'Ambiguous — two customers match',
      risk: 33, level: 'medium', match: 'ambiguous', matchConf: 0.61,
      checks: { id: 'pass', name: 'partial', phone: 'verified', email: 'valid', address: 'n/a' },
      flags: ['Name + phone match two different customers'], stage: 'verify',
      next: 'Lands in Needs match with TWO candidates. Good for testing the merge/choose path.',
    },
  };

  var WM_NAMES = ['Casey Lindqvist', 'Robin Adeyemi', 'Jules Marchetti', 'Sasha Okonkwo',
    'blaze_ranger', 'kushkat.99', 'Dev Ramanathan', 'Morgan Whitely'];

  function weedmapsOrder(presetOrOpts) {
    var o = typeof presetOrOpts === 'string' ? { preset: presetOrOpts } : (presetOrOpts || {});
    var preset = WM_PRESETS[o.preset] || WM_PRESETS.clean;
    var hw = HW();
    if (!hw.ORDERS || !hw.WM_ORDER) {
      return { ok: false, message: 'pos/data.jsx has not loaded — HW.ORDERS / HW.WM_ORDER are missing.' };
    }

    var num = nextOrderNum();
    var id = 'ORD-' + num;
    var name = o.name || pick(WM_NAMES);
    var itemCount = o.items || (1 + Math.floor(Math.random() * 4));

    // Total from REAL catalogue prices, so the order reconciles against the
    // products the rest of the app knows about rather than a made-up number.
    var pool = (hw.PRODUCTS || []).filter(function (p) { return p.active; });
    var total = 0;
    for (var i = 0; i < itemCount && pool.length; i++) total += pick(pool).price;
    total = money(o.total != null ? o.total : total);

    var row = {
      id: id, num: num, name: name, total: total,
      source: 'Weedmaps', channel: o.channel || preset.channel || 'Store',
      pay: 'Prepaid', badge: 'Weedmaps', age: '0h 0m',
      items: itemCount, stage: o.stage || preset.stage || 'verify',
      hue: Math.floor(Math.random() * 360),
    };

    var wm = {
      wmId: 'WM-' + (88400 + Math.floor(Math.random() * 500)),
      contact: {
        name: name,
        phone: o.phone || '(951) 555-0' + (100 + Math.floor(Math.random() * 899)),
        email: o.email || name.toLowerCase().replace(/[^a-z0-9]/g, '.') + '@gmail.com',
        address: preset.delivery ? '221 Riverside Dr, Lake Elsinore, CA 92530' : null,
      },
      matchOn: preset.match === 'existing' ? ['phone', 'email'] : [],
      wmStatus: 'PENDING',
      risk: preset.risk, level: preset.level,
      match: preset.match,
      checks: preset.checks, flags: preset.flags.slice(),
    };
    if (preset.matchConf) wm.matchConf = preset.matchConf;
    if (preset.match === 'existing') wm.matchId = (hw.MEMBERS && hw.MEMBERS[0] || {}).id || 'm1';
    if (preset.match === 'ambiguous') wm.candidates = (hw.MEMBERS || []).slice(0, 2).map(function (m) { return m.id; });
    if (preset.remoteId) wm.remoteId = preset.remoteId;
    if (preset.delivery) wm.delivery = true;

    hw.WM_ORDER[id] = wm;      // the detail FIRST — the queue reads it on render
    hw.ORDERS.unshift(row);

    return {
      ok: true, id: id, record: row,
      message: id + ' · ' + name + ' · $' + total.toFixed(2) + ' (' + preset.label + ')',
      next: preset.next,
      where: 'Orders → Order queue',
    };
  }

  // ── Products ──────────────────────────────────────────────────────────────
  var CATS = ['Flower', 'Pre-Rolls', 'Vapes', 'Edibles', 'Concentrates'];
  var STRAINS = ['Indica', 'Sativa', 'Hybrid'];
  var PROD_NAMES = ['Comet Haze', 'Velvet Sunrise', 'Iron Orchid', 'Paper Lantern',
    'Sunday Gravity', 'Copper Moth', 'Quiet Riot OG', 'Nine Lives'];

  function product(opts) {
    var o = opts || {};
    var hw = HW();
    if (!hw.PRODUCTS) return { ok: false, message: 'pos/data.jsx has not loaded — HW.PRODUCTS is missing.' };

    var name = o.name || pick(PROD_NAMES) + ' ' + (1 + Math.floor(Math.random() * 99));
    var cat = o.cat || pick(CATS);
    var price = o.price != null ? +o.price : 10 + Math.floor(Math.random() * 50);
    var sku = (o.sku || name.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8) + Math.floor(Math.random() * 90 + 10));
    var brands = hw.PRODUCTS.map(function (p) { return p.brand; });
    var brand = o.brand || pick(brands);

    // The margin fields the rest of the app expects. Mirrors pos/data.jsx's P_.
    var marginPct = 0.28 + (Math.floor(Math.random() * 41)) / 100;
    var cost = Math.max(0.5, money(price * (1 - marginPct)));

    var p = {
      id: sku, sku: sku, name: name, brand: brand,
      strain: o.strain || pick(STRAINS), cat: cat,
      thc: o.thc != null ? o.thc : (cat === 'Edibles' ? null : 18 + Math.floor(Math.random() * 15)),
      wt: o.wt || (cat === 'Edibles' ? '10mg' : cat === 'Flower' ? '3.5g' : '1g'),
      price: price, was: o.was || null,
      qty: o.qty != null ? o.qty : 10 + Math.floor(Math.random() * 90),
      cost: cost, margin: money((price - cost) / price),
      hue: Math.floor(Math.random() * 360), active: true,
    };
    hw.PRODUCTS.push(p);

    return {
      ok: true, id: sku, record: p,
      message: name + ' · ' + brand + ' · ' + cat + ' · $' + price.toFixed(2) + ' · ' + p.qty + ' in stock',
      next: 'It is in the catalogue now — Catalog, the POS product picker, and every swap ladder in its category.',
      where: 'Catalog',
    };
  }

  // ── Customers ─────────────────────────────────────────────────────────────
  var CUST_NAMES = ['Rowan Petrov', 'Amara Diallo', 'Tomas Lindgren', 'Priya Raghunathan',
    'Eli Nakamura', 'Fern Okafor', 'Marta Silva', 'Desmond Clarke'];

  function customer(opts) {
    var o = opts || {};
    var hw = HW();
    if (!hw.MEMBERS) return { ok: false, message: 'pos/data.jsx has not loaded — HW.MEMBERS is missing.' };

    var name = o.name || pick(CUST_NAMES);
    var m = {
      id: nextId(hw.MEMBERS, 'm'),
      name: name,
      email: o.email || name.toLowerCase().replace(/[^a-z0-9]/g, '.') + '@yopmail.com',
      phone: o.phone || '(951) 555-0' + (100 + Math.floor(Math.random() * 899)),
      group: o.group || pick(['Walk-In', 'Delivery']),
      type: o.type || pick(['AdultUse', 'MedicinalUser']),
      delivery: o.delivery || pick(['Pick-up', 'Delivery']),
      visits: o.visits != null ? o.visits : Math.floor(Math.random() * 6),
      points: o.points != null ? o.points : Math.floor(Math.random() * 900),
      wallet: o.wallet != null ? o.wallet : 0,
      member: o.member !== false,
    };
    hw.MEMBERS.push(m);

    return {
      ok: true, id: m.id, record: m,
      message: name + ' · ' + m.phone + ' · ' + m.group + ' · ' + m.points + ' pts',
      next: 'Findable in Members, in check-in search, and as a match candidate for the next Weedmaps order.',
      where: 'Members',
    };
  }

  window.HWSeed = {
    weedmapsOrder: weedmapsOrder,
    product: product,
    customer: customer,
    WM_PRESETS: WM_PRESETS,
    presets: Object.keys(WM_PRESETS),
  };
})();
