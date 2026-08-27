/* ── NUMBERS THE POS IS NOT ENTITLED TO PRINT ────────────────────────────────
 *
 * This file exists because four separate business figures in this POS were
 * computed from the CHARACTER CODES OF AN IDENTIFIER and rendered as facts an
 * operator acts on:
 *
 *   pos/data.jsx P_()            profit margin and wholesale cost, from the SKU
 *   pos/data.jsx favCategory()   "Usually buys Flower", from the customer's NAME
 *   pos/product-sheet.jsx        lot numbers, per-lot POTENCY, an expiry, a COA
 *                                verdict, a terpene profile — from the SKU
 *   pos/screen-register.jsx      a driver's licence number, an MMIC number, a
 *                                recommending physician, lifetime spend and AOV
 *                                — from name.length + visits
 *
 * ⚠️ EVERY ASSERTION HERE IS ABOUT A RENDERED SURFACE, NOT A SOURCE FILE.
 * A grep for `charCodeAt` proves the expression is gone; it proves nothing
 * about what the operator reads, and the whole failure mode of this class of
 * bug is that the screen looks fine. So these boot the real .jsx files and read
 * the DOM.
 *
 * ⚠️ AND EVERY ONE OF THEM IS A DIFFERENCE, NOT A STRING. The mistake a test
 * like this invites is pinning the replacement copy — which passes a build that
 * prints the same reassuring sentence for every state. Where copy is asserted
 * at all it is asserted as "A must not read the same as B".
 *
 * ⚠️ THE STRONGEST CHECK HERE IS THE HASH-SENSITIVITY ONE. Deleting a hash and
 * deleting the number it fed are different edits, and only the second one
 * matters. `renaming a member` and `renaming a product` below change ONLY the
 * string that used to drive the figure and assert the figure does not move —
 * which fails for a build that swapped one hash for another.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';
import { createPortal } from 'react-dom';

/* ⚠️ THE HARNESS'S ReactDOM IS `react-dom/client`, WHICH HAS NO createPortal.
 * Three of the surfaces this file has to read — ProductSheet, FullOrderView and
 * the member panel — render through a portal, so without this they do not mount
 * at all and every assertion below would pass vacuously against an empty body.
 * Patched on the harness's own writable window object rather than in
 * test/ui-harness.mjs, which other work is editing right now. */
function withPortals(app) {
  if (typeof app.window.ReactDOM.createPortal !== 'function') {
    app.window.ReactDOM.createPortal = createPortal;
  }
  return app;
}

/** Mount one exported screen on a host of its own. */
function mounter(app) {
  const W = app.window;
  let cur = null;
  const close = () => {
    if (!cur) return;
    try { cur.root.unmount(); } catch { /* already gone */ }
    cur.host.remove();
    cur = null;
  };
  const open = async (name, props) => {
    close();
    assert.equal(typeof W[name], 'function',
      `${name} is not on the page — errors: ${app.errors.join(' | ') || '(none)'}`);
    const host = W.document.createElement('div');
    W.document.body.appendChild(host);
    const root = W.ReactDOM.createRoot(host);
    root.render(W.React.createElement(W[name], props || {}));
    cur = { root, host };
    await app.settle(); await app.settle();
  };
  open.close = close;
  return open;
}

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();

// ── 1 · THE MARGIN ──────────────────────────────────────────────────────────

test('no product carries a cost or a margin that nothing sourced', async () => {
  await withApp('pos', async (app) => {
    const P = app.window.HW.PRODUCTS;
    assert.ok(P.length > 5, 'the catalogue loaded');
    const withCost = P.filter((p) => typeof p.cost === 'number');
    const withMargin = P.filter((p) => typeof p.margin === 'number');
    // If a real cost source ever lands, these two go red together and the
    // right response is to DELETE this test, not to relax it — at that point
    // the margin column is honest again. What must never come back is a
    // margin derived from the identifier, which the next test pins.
    assert.equal(withCost.length, 0,
      `${withCost.length} products still carry a wholesale cost; ` +
      'no cost of goods exists in this estate (verified against the wm-demo ' +
      'products table and GET /api/state, neither of which serves one)');
    assert.equal(withMargin.length, 0, `${withMargin.length} products still carry a margin`);
  });
});

test('renaming a product does not move its margin — the SKU is not a cost input', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    // Two SKUs whose character sums differ. Under the old derivation these had
    // materially different margins; under any honest one they are both unknown.
    const a = HW.PRODUCTS.find((p) => p.sku === 'H480PRO1');
    const b = HW.PRODUCTS.find((p) => p.sku === 'F2Q4EN2C');
    assert.ok(a && b, 'both fixture SKUs are present');
    assert.equal(a.margin, b.margin,
      'two different SKUs at two different prices report the same (absent) margin — ' +
      'if these differ, something is deriving a margin from the identifier again');
    assert.equal(a.margin, null);
  });
});

test('the catalog does not print a margin column, a margin sort or a ≥% filter it cannot fill', async () => {
  await withApp('pos', async (app) => {
    const open = mounter(withPortals(app));
    try {
      await open('CatalogScreen');
      const txt = norm(app.window.document.body.textContent);
      // ⚠️ THIS MUST NOT ASSERT ON THE FILTER POPOVER'S CONTENTS. That popover
      // is CLOSED on first paint, so "catalog avg" is absent either way and the
      // assertion passed on the unfixed build — caught by the mutation sweep.
      // What is on screen unconditionally is the column header and the filter's
      // own button, both labelled "Margin", so that is what is asserted.
      assert.ok(txt.length > 500, 'the catalog actually rendered its table');
      assert.ok(/Product \/ SKU/.test(txt), 'the product table header rendered');
      assert.ok(!/Margin/.test(txt),
        'the catalog still offers a Margin column, sort or ≥% filter with no ' +
        'costed row behind it. Restoring the SKU hash must bring all three back ' +
        'and this assertion must go red when it does.');
      assert.ok(!/\d+% mgn/.test(txt), 'a grid tile still prints an "N% mgn" badge');
      // The old bug rendered `Math.round(null * 100)` as a confident 0%.
      assert.ok(!/\b0%\s*(mgn|margin)/i.test(txt), 'a 0% margin is being rendered as a figure');
    } finally { open.close(); }
  });
});

test('a demo-data product does not light the margin column with a random figure', async () => {
  await withApp('pos', async (app) => {
    const W = app.window;
    assert.ok(W.HWSeed && typeof W.HWSeed.product === 'function',
      'the "+ Demo data → New product" generator is on the page');
    const r = W.HWSeed.product({ name: 'Probe Row', price: 30 });
    assert.ok(r.ok, `the generator ran: ${r.message || ''}`);
    // ⚠️ THIS IS THE SUBTLE ONE. shared/demo-seed.js rolled a margin from
    // Math.random() "to mirror P_()". pos/screen-catalog.jsx shows its margin
    // column when ANY row carries a margin, so one click of the demo control
    // would light the column for the whole catalogue — a random number on the
    // demo row, "no cost" on the 24 real ones, and the column header giving no
    // hint that only one figure in it means anything.
    assert.equal(r.record.margin, null, 'a demo row invented a margin');
    assert.equal(r.record.cost, null, 'a demo row invented a wholesale cost');
    const lit = W.HW.PRODUCTS.some((p) => typeof p.margin === 'number');
    assert.equal(lit, false,
      'seeding one demo product turned the catalog margin column back on');
  });
});

test('no product claims a Weedmaps sync time it took from its own SKU', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    // The five WM_PRODUCT_SYNC rows are hand-authored fixtures for named
    // states and keep their `last`. Every OTHER product had one picked by
    // `sku.charCodeAt(0) % 4` and must now have none.
    const derived = HW.PRODUCTS.filter((p) => !HW.WM_PRODUCT_SYNC[p.sku] && p.wm.last != null);
    assert.equal(derived.length, 0,
      `${derived.length} products still report a last-sync time with nothing behind it ` +
      `(e.g. ${derived.slice(0, 2).map((p) => p.sku + '=' + p.wm.last).join(', ')})`);
  });
});

test('the Weedmaps panel does not attribute a catalogue value to the API', async () => {
  await withApp('pos', async (app) => {
    const open = mounter(withPortals(app));
    try {
      const W = app.window;
      await open('CatalogScreen');
      // ⚠️ BOTH SENTENCES ARE BEHIND CLICKS, AND THE FIRST DRAFT OF THIS TEST
      // ASSERTED ON THE LIST PAGE WHERE NEITHER APPEARS — it passed on the
      // unfixed build and the mutation sweep said so. "Last synced …" is on the
      // product DETAIL page and "last push recorded by the API" is inside the
      // panel the "Push to Weedmaps…" button expands, so the test has to walk
      // there the way an operator does.
      // app.click() only reaches <button>/<a>/[data-hw-i]. The catalog row that
      // opens a product is a <div> with an onClick, so the click is dispatched
      // directly — still a real React handler on the real element, not a
      // shortcut past the UI.
      const clickDiv = (text) => {
        const el = [...W.document.querySelectorAll('div')]
          .find((d) => (d.textContent || '').trim() === text);
        assert.ok(el, `no row reading "${text}" to click`);
        el.dispatchEvent(new W.MouseEvent('click', { bubbles: true, cancelable: true }));
      };
      clickDiv('Blast Radius SmallsBRD35SM');     // open the detail page
      await app.settle(); await app.settle();
      const detail = norm(W.document.body.textContent);
      assert.ok(/Weedmaps/.test(detail), 'the product detail page opened');
      assert.ok(!/Last synced (3m|12m|28m|1h) ago/.test(detail),
        'a SKU-derived sync time is still printed on the detail page');

      // A PREDICATE, not the literal — app.click() matches exact text and the
      // label carries a typographic ellipsis ("Push to Weedmaps…"). An exact
      // match silently clicks nothing, and a test that clicks nothing passes.
      assert.ok(app.click((t) => /^Push to Weedmaps/.test(t)),
        `no "Push to Weedmaps" control found; buttons: ${app.buttons().slice(0, 12).join(' | ')}`);
      await app.settle(); await app.settle();
      const panel = norm(W.document.body.textContent);
      assert.ok(/last push/i.test(panel),
        `the push panel expanded — got: ${panel.slice(-320)}`);
      assert.ok(!/recorded by the API/.test(panel),
        'a value the catalogue was loaded with is still attributed to the API, ' +
        'four lines under a paragraph saying nothing here contacted Weedmaps');
    } finally { open.close(); }
  });
});

// ── 2 · THE PURCHASE-HABIT CLAIM ────────────────────────────────────────────

test('favCategory asserts nothing about a member the history route was never asked about', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    assert.equal(typeof HW.favCategoryBasis, 'function',
      'favCategoryBasis is published — a caller must be able to ask WHY there is no answer');
    for (const m of HW.MEMBERS) {
      const b = HW.favCategoryBasis(m);
      assert.equal(b.category, null,
        `${m.name} was assigned a favourite category (${b.category}) with no purchase ` +
        'history behind it. A mock member row carries no identity key, and ' +
        'shared/hw-live-history.js refuses `customer.id` on purpose.');
      assert.equal(b.state, 'no_key');
      assert.ok(b.reason && b.reason.length > 20, 'the absence comes with a readable reason');
    }
  });
});

test('renaming a member does not change what we claim they buy', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    const m = { ...HW.MEMBERS[2] };
    const before = HW.favCategory(m);
    // The single edit that used to move the answer: one character on the name.
    const after = HW.favCategory({ ...m, name: m.name + 'x' });
    assert.equal(before, after,
      'a one-character rename changed this customer\'s "favourite category" — ' +
      'the claim is being computed from the spelling of their name again');
    assert.equal(before, null);
  });
});

test('a member WITH a real history key gets the category the route actually reported', async () => {
  await withApp('pos', async (app) => {
    const W = app.window;
    // Stand in for shared/hw-live-history.js exactly as it publishes itself:
    // an in-place mutation of window.HW, an accessor that takes ONE key.
    const asked = [];
    W.HW.purchaseHistory = (key) => {
      asked.push(key);
      return { state: 'history', items: [
        { sku: 'A', category: 'Edibles', category_known: true },
        { sku: 'B', category: 'Edibles', category_known: true },
        { sku: 'C', category: 'Vapes', category_known: true },
        // An unresolved line must NOT be counted as a category. If it were,
        // 'Flower' would tie Edibles at 2 and the answer would flip.
        { sku: 'D', category: 'Flower', category_known: false },
        { sku: 'E', category: 'Flower', category_known: false },
      ] };
    };
    const m = { ...W.HW.MEMBERS[0], identity_id: 4211 };
    const b = W.HW.favCategoryBasis(m);
    assert.equal(b.category, 'Edibles',
      'the answer is the category the customer actually bought most of');
    assert.equal(b.state, 'history');
    // ONE key, and it is the identity. The route refuses two, and
    // hw-live-history.js's normalize() does the String() coercion — passing the
    // raw value keeps that coercion in exactly one place.
    assert.equal(asked.length, 1, 'exactly one lookup, with exactly one key');
    assert.deepEqual(Object.keys(asked[0]), ['identity_id']);
    assert.equal(String(asked[0].identity_id), '4211');
    assert.ok(/2 of 3/.test(b.reason), `the reason counts real lines: ${b.reason}`);

    // …and the route's other states are NOT history.
    W.HW.purchaseHistory = () => ({ state: 'unknown', state_reason: 'no line data for this person' });
    const u = W.HW.favCategoryBasis(m);
    assert.equal(u.category, null, '`unknown` is not a category');
    assert.notEqual(u.reason, b.reason, 'unknown and history do not read the same');
  });
});

// ── 3 · THE PRODUCT SHEET: LOTS, POTENCY, COA ───────────────────────────────

test('the product sheet prints no lot number, no per-lot potency and no COA verdict', async () => {
  await withApp('pos', async (app) => {
    const open = mounter(withPortals(app));
    try {
      const p = app.window.HW.PRODUCTS[0];
      await open('ProductSheet', { p, inCart: 0, onAdd() {}, onClose() {} });
      const txt = norm(app.window.document.body.textContent);
      assert.ok(txt.length > 50, 'the sheet rendered');
      assert.ok(!/B-[A-Z0-9]{2,4}-\d{4}/.test(txt),
        'a fabricated lot number is still on the sheet');
      // The COA verdict is the worst of them: a green pass/fail on a lab result
      // nobody ran.
      assert.ok(!/\bPassed\b/.test(txt) && !/\bPending\b/.test(txt),
        'a COA verdict is still rendered for a lot this estate does not hold');
      assert.ok(!/Dominant/.test(txt),
        'a "Dominant" terpene is still claimed for this product');
      assert.ok(/no batch is tracked/i.test(txt),
        'the sheet must SAY there is no batch, not just omit the table — ' +
        'an omission reads as "nothing to report"');
    } finally { open.close(); }
  });
});

test('two different products get the same (absent) batch answer', async () => {
  await withApp('pos', async (app) => {
    const open = mounter(withPortals(app));
    const readSheet = async (p) => {
      await open('ProductSheet', { p, inCart: 0, onAdd() {}, onClose() {} });
      // Exactly the batches section — the region the hash used to fill. Sliced
      // to the footer so the price in the sticky Add-to-cart bar (which SHOULD
      // differ between two products) cannot make this pass for the wrong reason.
      const t = norm(app.window.document.body.textContent);
      const from = t.indexOf('Batches available');
      const to = t.indexOf('Not in the cart yet');
      assert.ok(from >= 0 && to > from, 'the batches section and the footer were both found');
      return t.slice(from, to);
    };
    try {
      // ⚠️ SIX PRODUCTS, NOT TWO. Any single pair can agree by coincidence
      // under a `% 3` derivation, and one did: the mutation sweep restored a
      // per-SKU lot count and this test stayed green on two fixtures.
      const seen = new Map();
      for (const p of app.window.HW.PRODUCTS.slice(0, 6)) {
        const s = await readSheet(p);
        assert.ok(s.length > 20, `${p.sku} rendered a batch section`);
        seen.set(p.sku, s);
      }
      const variants = new Set(seen.values());
      assert.equal(variants.size, 1,
        'six SKUs produced ' + variants.size + ' different batch sections — ' +
        'something is deriving lot data from the SKU again:\n' +
        [...seen].map(([k, v]) => k + ' :: ' + v.slice(0, 90)).join('\n'));
    } finally { open.close(); }
  });
});

// ── 4 · THE MEMBER PANEL: A LICENCE AND A MEDICAL CARD ──────────────────────

test('the member panel invents no licence number, no MMIC and no physician', async () => {
  await withApp('pos', async (app) => {
    const open = mounter(withPortals(app));
    try {
      const W = app.window;
      const med = W.HW.MEMBERS.find((m) => m.type === 'MedicinalUser');
      assert.ok(med, 'a medicinal member is in the fixture');
      await open('MemberDetails', { customer: med, guests: [], onClose() {} });
      const txt = norm(W.document.body.textContent);
      assert.ok(txt.length > 50, 'the panel rendered');
      assert.ok(!/CA D\d{6,}/.test(txt), 'a fabricated driver-licence number is still printed');
      assert.ok(!/MMIC-\d{4,}/.test(txt), 'a fabricated MMIC number is still printed');
      assert.ok(!/Dr\. [A-Z]\. [A-Z]/.test(txt), 'a fabricated recommending physician is still named');
      // The tax-exempt claim is the one that moves money.
      assert.ok(!/MMIC verified/i.test(txt),
        'the panel still claims the medical card is VERIFIED with no card on file');
    } finally { open.close(); }
  });
});

test('a medicinal customer with no card on file reads differently from one with a card', async () => {
  await withApp('pos', async (app) => {
    const open = mounter(withPortals(app));
    const read = async (customer) => {
      await open('MemberDetails', { customer, guests: [], onClose() {} });
      return norm(app.window.document.body.textContent);
    };
    try {
      const base = app.window.HW.MEMBERS.find((m) => m.type === 'MedicinalUser');
      const without = await read({ ...base });
      const withCard = await read({ ...base, mmic: 'MMIC-90210', medMd: 'Dr. Real Person', medIssued: 'Feb 2026' });
      assert.notEqual(without, withCard,
        'a member with a real card record and one without render identically — ' +
        'the ACTIVE badge is being driven by the customer-TYPE flag again');
      // ⚠️ NOT `/not on file/`. The KV rows print that phrase for every empty
      // field, so the assertion matched even with the ACTIVE badge restored —
      // the mutation sweep caught it. CLAIMED is the badge, and only the badge.
      assert.ok(/CLAIMED/.test(without),
        'a medicinal customer with no card record is still badged ACTIVE. The ' +
        'badge must be driven by a card RECORD, not by the customer-type enum.');
      assert.ok(!/CLAIMED/.test(withCard), 'a real card record is badged ACTIVE, not CLAIMED');
      assert.ok(/MMIC-90210/.test(withCard), 'a real card record is shown when there is one');
    } finally { open.close(); }
  });
});

test('lifetime spend and average basket come off the order book or say they are not recorded', async () => {
  await withApp('pos', async (app) => {
    const open = mounter(withPortals(app));
    const read = async (customer) => {
      await open('MemberDetails', { customer, guests: [], onClose() {} });
      return norm(app.window.document.body.textContent);
    };
    try {
      const W = app.window;
      // A member nothing on the order book names.
      const ghost = { ...W.HW.MEMBERS[0], name: 'Nobody Onbook', visits: 9, points: 4000 };
      const t = await read(ghost);
      assert.ok(/not on file|not recorded/i.test(t),
        'a member with no order still gets a lifetime figure');
      // visits*58 + points*0.42 for this member is $2202. Under any honest
      // rule the panel must not print it.
      assert.ok(!/2,?202/.test(t), 'the visits*58 + points*0.42 identity is still being printed');

      // …and a member the order book DOES name gets the book's own total.
      const named = W.HW.ORDERS && W.HW.ORDERS[0];
      if (named) {
        const real = await read({ ...W.HW.MEMBERS[0], name: named.name });
        const total = (W.HW.ORDERS || []).filter((o) => o.name === named.name)
          .reduce((a, o) => a + (+o.total || 0), 0);
        assert.ok(real.includes(W.HW.fmt.money(total)) || real.includes(W.HW.fmt.money0(total)),
          `the panel prints the order book's own total (${total}) for ${named.name}`);
      }
    } finally { open.close(); }
  });
});

// ── 5 · THE SHELL: A FALSE PROVENANCE IS THE WORST OF THEM ──────────────────

test('no shell row is stamped "From batches" over a figure no batch produced', async () => {
  await withApp('pos', async (app) => {
    const S = app.window.HW_SHELL;
    const shells = S.allShells();
    assert.ok(shells.length > 2, 'shells seeded');
    for (const s of shells) {
      const rows = S.sharedRows(s);
      const cost = rows.find((r) => /unit cost/i.test(r.label));
      assert.ok(cost, 'the unit-cost row is still present — the FIELD is real');
      assert.notEqual(cost.flag, 'From batches',
        `${s.id} still flags its unit cost "From batches". GET /api/state serves ` +
        'batches as an EMPTY ARRAY; nothing on this screen has ever come from one, ' +
        'and a false provenance stops the operator asking where the number came from.');
      assert.equal(s.cost, null, `${s.id} still averages a cost out of nothing`);
      assert.ok(/not recorded/i.test(String(cost.value)), 'the row says the cost is not held');
      assert.ok(!/low \$|high \$/.test(String(cost.sub || '')),
        'the "low $x · high $y" batch spread is still printed for a family with no batches');
    }
    // ⚠️ AND THE OTHER BRANCH. Every shell above has cost === null, so the
    // loop only ever exercised the empty case — reverting the flag string
    // changed nothing and the mutation sweep scored it green. A shell that DOES
    // carry a cost must not claim a batch produced it either: the cost gets
    // there by an operator typing it on receipt (pos/product-shell.jsx:402).
    const costed = { ...shells[0], cost: 12.5, costsKnown: 2, costsTotal: 2 };
    const row = S.sharedRows(costed).find((r) => /unit cost/i.test(r.label));
    assert.ok(/12\.5|13/.test(String(row.value)), 'a real cost IS shown when there is one');
    assert.notEqual(row.flag, 'From batches',
      'a costed shell still stamps its unit cost "From batches" — this estate ' +
      'holds no batches (GET /api/state serves batches as an empty array)');
    assert.ok(!/low \$|high \$/.test(String(row.sub || '')),
      'the invented ±15%/+18% "batch spread" is back on the costed branch');
  });
});

test('a shell claims no store count, because nothing records one per shell', async () => {
  await withApp('pos', async (app) => {
    const S = app.window.HW_SHELL;
    const counts = new Set(S.allShells().map((s) => s.stores));
    assert.deepEqual([...counts], [null],
      'shells still report a per-shell store count. It was 1 + sku.charCodeAt(1) % 4 ' +
      '— a count of retail locations taken from the second letter of a SKU. The ' +
      'estate claims four stores (HW.STORE.count) but records nothing about which ' +
      'of them carries a given shell, so 1 would be a second invented figure.');
  });
});

test('the shell edit header says the store count is not tracked rather than printing one', async () => {
  await withApp('pos', async (app) => {
    const open = mounter(withPortals(app));
    try {
      const W = app.window;
      const p = W.HW.PRODUCTS[0];
      // ⚠️ NOT ShellsModule. Its default view is the grouped card list, which
      // never renders `s.stores` at all — so an assertion there would pass on
      // the unfixed build for want of a surface, which is the failure mode this
      // whole file is about. ShellEditModal's header DOES render it.
      await open('ShellEditModal', { p, shellId: null, onClose() {}, onSave() {} });
      const txt = norm(W.document.body.textContent);
      assert.ok(/variation/i.test(txt), 'the shell header rendered');
      assert.ok(!/\b[1-9] stores?\b/.test(txt),
        'the shell header still prints "N store(s)" for a distribution nobody records');
      assert.ok(/stores not tracked/.test(txt), 'the absence is stated, not just omitted');
    } finally { open.close(); }
  });
});

// ── 7 · THE REGISTER'S CUSTOMER CHIP ────────────────────────────────────────
//
// Five figures beside a named customer's face, two of which were
// `visits * 58 + points * 0.42` and that number divided by visits.

test('the customer chip prints no lifetime spend the order book cannot account for', async () => {
  await withApp('pos', async (app) => {
    const open = mounter(withPortals(app));
    const read = async (customer) => {
      await open('CustomerChip', { customer, guests: [], setGuests() {}, onClear() {},
        detailsOpen: false, onToggleDetails() {}, view: 'detailed' });
      return norm(app.window.document.body.textContent);
    };
    try {
      const W = app.window;
      // 9 visits, 4000 points → the old identity is $2202, AOV $245.
      const ghost = { ...W.HW.MEMBERS[0], name: 'Nobody Onbook', visits: 9, points: 4000, wallet: 0 };
      const t = await read(ghost);
      assert.ok(/Lifetime/.test(t), 'the detailed chip rendered its stat cards');
      assert.ok(!/2,?202/.test(t),
        'the chip still prints visits*58 + points*0.42 as a lifetime spend');
      assert.ok(!/\$245/.test(t), 'the chip still prints that identity divided by visits as an AOV');
      assert.ok(/not recorded/.test(t),
        'a customer with no order on the book must be told so, not given a figure');

      // A customer the book DOES name gets the book's own total, and the two
      // states must not read the same.
      const named = (W.HW.ORDERS || [])[0];
      if (named) {
        const real = await read({ ...W.HW.MEMBERS[0], name: named.name, visits: 9, points: 4000 });
        assert.notEqual(real, t, 'a customer with orders reads the same as one without');
        const total = (W.HW.ORDERS || []).filter((o) => o.name === named.name)
          .reduce((a, o) => a + (+o.total || 0), 0);
        assert.ok(real.includes(W.HW.fmt.money0(total)),
          `the chip prints the order book's total (${total}) for ${named.name}`);
      }
    } finally { open.close(); }
  });
});

// ── 6 · THE RECEIPT ─────────────────────────────────────────────────────────

test('a full order view names no product, tender or associate the record does not hold', async () => {
  await withApp('pos', async (app) => {
    const open = mounter(withPortals(app));
    try {
      const W = app.window;
      const m = W.HW.MEMBERS[0];
      const order = { id: '00219', date: 'Jun 8', items: 3, total: 41.0, channel: 'Pickup', status: 'Completed' };
      await open('FullOrderView', { order, m, onClose() {} });
      const txt = norm(W.document.body.textContent);
      assert.ok(txt.length > 50, 'the receipt rendered');
      assert.ok(/no line items are held/i.test(txt),
        'the receipt still lists products for an order that records only a COUNT');
      assert.ok(!/Priya Nair|Marcus Hill|Devon Pierce/.test(txt),
        'the receipt still names an associate picked out of a list by a hash');
      // THE TOTAL IS THE RECORD'S. The old version recomputed it off invented
      // lines and disagreed with o.total by tens of dollars.
      assert.ok(txt.includes('$41'), `the record's own total is what is shown: ${txt.slice(0, 200)}`);
    } finally { open.close(); }
  });
});
