/* ── THE WEEDMAPS PROMO PANEL MAY ONLY PRINT WHAT WEEDMAPS PUBLISHES ─────────
 *
 * pweb/weedmaps.jsx used to render 25+ Weedmaps promotion fields that do not
 * exist — discount_value, stackable, usage_limit, priority, max_discount,
 * min_spend, scope/targets/excludes, per-promo REVENUE and DISCOUNT COST —
 * under a comment describing the list as "every parameter WM exposes".
 *
 * The published schema is `ApplicableDiscountAttributes` in the Weedmaps OOS
 * OpenAPI spec. It has EIGHT properties, NO `required` list, and NOT ONE
 * monetary field:
 *
 *   auto_apply · code_name · description · end_date
 *   legal_disclaimer · prerequisite_customer_type · redemption_details · title
 *
 * So a screen reporting Weedmaps promotion revenue and ROI was printing numbers
 * with no source — worse than a blank panel, because someone decides on them.
 *
 * ⚠️ EVERY ASSERTION HERE READS THE RENDERED DOM, NOT THE SOURCE. A grep for
 * `revenue_cents` proves the expression is gone and proves nothing about what
 * the operator reads, which is the entire failure mode of this class of bug.
 *
 * ⚠️ ABSENCE IS ASSERTED AS A DIFFERENCE, NOT AS A STRING. Nothing in the
 * schema is required, so "the attribute did not arrive" is a real state that
 * must not read as `No`, as blank, or as 0. Pinning the replacement copy would
 * pass a build that printed one reassuring word for every state, so the test
 * that matters asserts an ABSENT auto_apply does not read the same as a
 * present-and-false one.
 *
 * ⚠️ THE SHAPE TEST IS THE ONE THAT CANNOT BE FAKED. Weedmaps' own spec and the
 * JSON:API convention it claims to follow disagree about whether a discount
 * element wraps the resource (data[i].data.attributes) or IS the resource
 * (data[i].attributes), and available_discounts has only ever answered
 * {"data":[]}, so nothing observed can settle it. A build that quietly picks
 * one — as `elem.attributes` unconditionally does — renders the other shape
 * with a null id and eight null attributes and raises NOTHING. The last test
 * feeds ONE discount in BOTH shapes and requires the same eight values out.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

const PAGE = 'Promotions Suite.html';
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/** Mount WeedmapsView on a host of its own, optionally over seeded rows. */
async function onScreen(app, rows) {
  const W = app.window;
  assert.equal(typeof W.WeedmapsView, 'function',
    `WeedmapsView is not on the page — errors: ${app.errors.join(' | ') || '(none)'}`);
  if (rows) W.WM_PROMOS = rows;
  const host = W.document.createElement('div');
  W.document.body.appendChild(host);
  const root = W.ReactDOM.createRoot(host);
  root.render(W.React.createElement(W.WeedmapsView, { promos: [] }));
  await app.settle(); await app.settle();
  const bodyRows = () => Array.from(host.querySelectorAll('tbody tr'));
  return {
    host, root,
    text: () => norm(host.textContent),
    /** Click a row whose first cell contains `label`, expanding its detail. */
    expand: async (label) => {
      const tr = bodyRows().find((r) => norm(r.textContent).includes(label) && r.querySelector('td'));
      assert.ok(tr, `no row containing ${JSON.stringify(label)}`);
      tr.dispatchEvent(new W.MouseEvent('click', { bubbles: true, cancelable: true }));
      await app.settle(); await app.settle();
      return norm(host.textContent);
    },
    /** The cells of the row whose first cell contains `label`. */
    row: (label) => {
      const tr = bodyRows().find((r) => norm(r.querySelector('td') ? r.querySelector('td').textContent : '').includes(label));
      assert.ok(tr, `no row whose name cell contains ${JSON.stringify(label)}`);
      return Array.from(tr.querySelectorAll('td')).map((td) => norm(td.textContent));
    },
  };
}

/* ── 1 · NOTHING WITHOUT A SOURCE IS PRINTED AS A VALUE ──────────────────── */

// The invented field LABELS, as they appeared on the panel. If one of these
// comes back as a rendered field, something is sourcing it from nowhere again.
const GONE = [
  'Discount value', 'Stackable', 'Priority', 'Max discount', 'Min spend', 'Min items',
  'Usage limit', 'Per-customer limit', 'Promo type', 'Scope', 'Targets', 'Excludes',
  'Customer segment', 'New-customer only', 'First-order only', 'Recurrence', 'Dayparts',
  'Redemptions', 'Discount cost', 'Match confidence',
];

test('not one invented Weedmaps field is rendered as a value', async () => {
  await withApp(PAGE, async (app) => {
    const s = await onScreen(app);
    // Open every row: the detail panel is where the 25+ fields lived.
    const rows = Array.from(s.host.querySelectorAll('tbody tr'));
    for (const tr of rows) {
      tr.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
      await app.settle();
    }
    const t = s.text();
    // A label may legitimately appear inside the "not available" list — that is
    // the point of that list. It must never appear as a FIELD with a value, so
    // check the uppercase field-label rendering the detail grid uses.
    const labels = Array.from(s.host.querySelectorAll('span'))
      .map((n) => norm(n.textContent));
    const found = GONE.filter((g) => labels.includes(g));
    assert.deepEqual(found, [],
      `${found.length} invented field(s) are rendered as values again: ${found.join(', ')}`);
    void t;
  });
});

test('no currency figure is printed for a Weedmaps discount', async () => {
  await withApp(PAGE, async (app) => {
    // Seeded deliberately: the shipped rows link to an INTERNAL promo whose own
    // name contains "$20", and that name is ours and honest. Controlled rows
    // remove that noise, so any `$<digit>` left on the panel is a figure the
    // screen derived for a Weedmaps discount — and ApplicableDiscountAttributes
    // publishes no monetary field of any kind, so there is nowhere to derive it
    // from. (The "Discount type (%, $, BOGO)" chip is a LABEL in the
    // not-available list; requiring a digit after the `$` keeps it out.)
    const s = await onScreen(app, [
      { row_id:'r-money', listing:'342170487', mirror:{ state:'live', firstSeen:'2026-08-01', lastSeen:'now' },
        mapping:{ state:'mapped', internal:'Concentrate Weekly', internal_id:'p_x', confidence:1 },
        element:{ type:'available_discount', id:'d_money', attributes:{
          title:'Concentrate deal', code_name:'CONC', description:'Applied in cart.',
          auto_apply:true, prerequisite_customer_type:'All customers',
          end_date:'2026-10-01T00:00:00Z', redemption_details:'One per order.',
          legal_disclaimer:'Terms apply.' } } },
    ]);
    await s.expand('Concentrate deal');
    const money = s.text().match(/\$\d[\d,]*(\.\d+)?/g) || [];
    assert.deepEqual(money, [],
      `the panel prints ${money.length} currency figure(s) for a discount that ` +
      `publishes no monetary attribute: ${money.join(', ')}`);
  });
});

test('revenue and ROI are named as unavailable — and never shown as 0', async () => {
  await withApp(PAGE, async (app) => {
    const s = await onScreen(app);
    const t = await s.expand('Wax Wednesday');
    // Wanted by the business, so they are still SAID — as absences.
    for (const wanted of ['Revenue and discount cost', 'ROI', 'Redemption count',
      'Discount amount or percent', 'Usage limit and per-customer cap']) {
      assert.ok(t.includes(wanted),
        `"${wanted}" is neither shown nor declared unavailable — it was silently dropped`);
    }
    assert.ok(/no source for them/.test(t) && /0 would be an answer/.test(t),
      'the panel does not say WHY these are blank, so the next reader will "fix" it with a zero');
    // The specific fabrication this replaces: a zero standing in for an answer.
    assert.ok(!/\b(Revenue|ROI|Redemptions)\b[^a-zA-Z]{0,4}0\b/.test(t),
      'a figure with no source is being rendered as 0');
  });
});

/* ── 2 · ABSENT IS ITS OWN STATE, NOT `No` AND NOT BLANK ─────────────────── */

test('an attribute that did not arrive does not read like one that arrived false', async () => {
  await withApp(PAGE, async (app) => {
    const s = await onScreen(app, [
      { row_id:'r-false', listing:'342170487',
        element:{ type:'available_discount', id:'d_false',
          attributes:{ title:'Auto apply is genuinely false', auto_apply:false } },
        mirror:{ state:'live' }, mapping:{ state:'standalone' } },
      { row_id:'r-absent', listing:'342170487',
        element:{ type:'available_discount', id:'d_absent',
          attributes:{ title:'Auto apply never arrived' } },
        mirror:{ state:'live' }, mapping:{ state:'standalone' } },
    ]);
    const AUTO = 1;                                   // the Auto apply column
    const isFalse = s.row('genuinely false')[AUTO];
    const isAbsent = s.row('never arrived')[AUTO];
    assert.notEqual(isAbsent, isFalse,
      `an absent auto_apply reads exactly like a false one (${JSON.stringify(isAbsent)}) — ` +
      'nothing in ApplicableDiscountAttributes is required, so these are different facts');
    assert.equal(isFalse, 'No', 'a present-and-false auto_apply should still read as No');
    assert.notEqual(isAbsent, '', 'an absent attribute renders as empty space, which reads as "nothing to say"');
  });
});

test('a discount carrying only a title still renders all eight fields, seven as absent', async () => {
  await withApp(PAGE, async (app) => {
    const s = await onScreen(app, [
      { row_id:'r-sparse', listing:'342170912',
        element:{ type:'available_discount', id:'d_sparse', attributes:{ title:'Title and nothing else' } },
        mirror:{ state:'live' }, mapping:{ state:'unmapped' } },
    ]);
    const t = await s.expand('Title and nothing else');
    for (const label of ['Title', 'Code name', 'Description', 'Auto apply',
      'Customer type', 'End date', 'Redemption details', 'Legal disclaimer']) {
      assert.ok(t.includes(label), `the published attribute "${label}" is not on the detail panel`);
    }
    const absent = (t.match(/Not provided/g) || []).length;
    assert.ok(absent >= 7,
      `only ${absent} of the seven missing attributes are declared absent — the rest render as nothing`);
  });
});

/* ── 3 · THE SCREEN DOES NOT PICK A SIDE ON THE ELEMENT SHAPE ────────────── */

test('one discount in BOTH candidate shapes renders the same eight values', async () => {
  await withApp(PAGE, async (app) => {
    // Byte-identical attributes; only the envelope differs.
    const attributes = {
      title:'Same discount, two envelopes', code_name:'TWOSHAPES',
      description:'One payload written the two ways the spec and JSON:API disagree about.',
      auto_apply:true, prerequisite_customer_type:'First time customers',
      end_date:'2026-09-30T23:59:59Z', redemption_details:'Applied at checkout.',
      legal_disclaimer:'Terms apply.' };
    const s = await onScreen(app, [
      { row_id:'r-flat', listing:'342170487', mirror:{ state:'live' }, mapping:{ state:'standalone' },
        element:{ type:'available_discount', id:'d_same', attributes } },
      { row_id:'r-nested', listing:'342170487', mirror:{ state:'live' }, mapping:{ state:'standalone' },
        element:{ jsonapi:{ version:'1.0' }, data:{ type:'available_discount', id:'d_same', attributes } } },
    ]);
    const flat = s.row('Same discount, two envelopes');
    const rows = Array.from(s.host.querySelectorAll('tbody tr'))
      .map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => norm(td.textContent)))
      .filter((c) => c.length && c[0].includes('Same discount'));
    assert.equal(rows.length, 2, 'both shapes should produce a row');
    // Columns 0-3 are the published attributes (name+id, auto apply, customer
    // type, end date). They must be identical. Column 4 is the shape, which is
    // reported precisely BECAUSE it differs — that is the whole point.
    assert.deepEqual(rows[1].slice(0, 4), rows[0].slice(0, 4),
      'the nested-shape element reads differently from the flat one — the screen has ' +
      'silently picked a side on a question nobody can settle');
    assert.ok(flat[0].includes('d_same') && rows[1][0].includes('d_same'),
      'the nested element lost its id — which, being the primary key, collapses ' +
      'every nested discount into one row without raising anything');
    assert.notEqual(rows[1][4], rows[0][4], 'the two shapes should be REPORTED as different');
  });
});

test('an element matching neither shape says so instead of rendering blanks', async () => {
  await withApp(PAGE, async (app) => {
    const s = await onScreen(app, [
      { row_id:'r-junk', listing:'342170912', element:{ unexpected:'payload' },
        mirror:{ state:'live' }, mapping:{ state:'unmapped' } },
    ]);
    const t = s.text();
    assert.ok(/Unreadable/.test(t),
      'an unparseable element renders as an ordinary empty discount, so a parser ' +
      'that stopped working looks exactly like Weedmaps sending nothing');
    const after = await s.expand('Unreadable');
    assert.ok(/not.{0,20}because Weedmaps sent them empty/i.test(after),
      'the detail does not distinguish "we parsed nothing" from "Weedmaps sent nothing"');
  });
});
