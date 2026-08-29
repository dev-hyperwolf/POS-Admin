/* ── THE DEAD CONTROLS ON THE ORDER SIDE ─────────────────────────────────────
 *
 * Roughly fifteen controls rendered with no onClick at all. Clicked, they did
 * nothing and said nothing — and one of them did something WORSE than nothing:
 * the dispatch table's Assign / Re-route had no handler, so the click fell
 * through to the row and opened the order modal. The operator asked to route a
 * stop and got a receipt.
 *
 * Every test here drives the real screen. Each one fails on the old code —
 * mostly because the thing the click is supposed to produce never appears, and
 * in the Assign case because the WRONG thing appears instead.
 *
 * ⚠️ Harness traps (documented at the top of test/ui-harness.mjs): anything
 * reached through `app.window` is a jsdom-realm object, so assert on primitives
 * (.length, .join(',')), never deepEqual. And `typeof null === 'object'`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

/** Open the delivery side of the queue. */
const toDelivery = async (app) => {
  assert.ok(app.click((t) => t.startsWith('Delivery Orders')), 'no Delivery Orders tab');
  await app.settle();
};
const byTitle = (app, re) => [...app.window.document.querySelectorAll('button')]
  .filter((b) => re.test(b.getAttribute('title') || ''));
const fire = (app, el) => el.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));

// ── The header 'Filters' ───────────────────────────────────────────────────

test('Filters opens a panel and actually narrows the queue', async () => {
  await withApp('pos', async (app) => {
    await app.mount('OrdersScreen');
    // NB the inline bar above the board is already labelled "Filter the queue",
    // so the popover needs a title of its own to assert on.
    assert.ok(!app.text().includes('Filter by source'), 'the panel was open before anything was clicked');
    assert.ok(app.click((t) => t.startsWith('Filters')), 'no Filters button');
    await app.settle();
    assert.ok(app.text().includes('Filter by source'), 'Filters did nothing');

    const all = app.text().match(/(\d+) orders? shown below/);
    assert.ok(app.click('Weedmaps'), 'no Weedmaps source chip');
    await app.settle();
    const wm = app.text().match(/(\d+) orders? shown below/);
    assert.ok(Number(wm[1]) < Number(all[1]), `filter did not narrow: ${all[1]} → ${wm[1]}`);
    assert.ok(app.text().includes('1 filter on'), 'the queue does not say a filter is on');
    // and the button itself carries the count, so a filtered board is not a mystery
    assert.ok(app.buttons().includes('Filters · 1'), 'the Filters button does not show the active count');
  });
});

test('Clear puts every order back', async () => {
  await withApp('pos', async (app) => {
    await app.mount('OrdersScreen');
    const before = app.text().match(/(\d+) orders? shown below/)[1];
    app.click((t) => t.startsWith('Filters'));await app.settle();
    app.click('Weedmaps');await app.settle();
    app.click((t) => t.startsWith('Show '));await app.settle();
    assert.ok(app.click('Clear'), 'no Clear on the filter bar');
    await app.settle();
    assert.equal(app.text().match(/(\d+) orders? shown below/)[1], before, 'Clear did not restore the queue');
  });
});

// ── The check-in strip ─────────────────────────────────────────────────────

test('the check-in strip search filters the strip', async () => {
  await withApp('pos', async (app) => {
    await app.mount('OrdersScreen');
    const names = app.window.HW.CHECKINS.map((c) => c.name);
    assert.ok(names.length > 1, 'need more than one check-in to prove filtering');
    const first = names[0].split(' ')[0];
    // Count the CARDS, not the page text: the same people are named on order
    // cards elsewhere on the board, which the strip's search does not touch.
    const cards = () => [...app.window.document.querySelectorAll('button[aria-label^="Remove"]')]
    .map((b) => b.getAttribute('aria-label').replace(/^Remove | from.*$/g, ''));
    assert.equal(cards().length, names.length, 'the strip is not showing every check-in to begin with');

    assert.ok(app.type('Search customer by e-mail', first), 'no check-in search field');
    await app.settle();
    assert.equal(cards().join(','), first, 'typing in the box changed nothing');
    assert.ok(app.text().includes('1 match'), 'the strip does not say how many are left');
  });
});

test('a search that matches nobody says so', async () => {
  await withApp('pos', async (app) => {
    await app.mount('OrdersScreen');
    app.type('Search customer by e-mail', 'zzzzz');
    await app.settle();
    assert.ok(app.text().includes('Nobody waiting matches'), 'an empty result looked like an empty store');
  });
});

// ── The ✕ on a check-in card ───────────────────────────────────────────────

test('the ✕ on a check-in asks first, then really removes the person', async () => {
  await withApp('pos', async (app) => {
    await app.mount('OrdersScreen');
    const HW = app.window.HW;
    const before = HW.CHECKINS.length;
    const gone = HW.CHECKINS[0].name;

    const x = [...app.window.document.querySelectorAll('button[aria-label^="Remove"]')];
    assert.equal(x.length, before, 'not every check-in card has a labelled ✕');
    fire(app, x[0]);
    await app.settle();
    assert.equal(HW.CHECKINS.length, before, 'the ✕ deleted a walk-in with no confirmation');
    assert.ok(app.text().includes('off the waiting list?'), 'the ✕ did nothing at all');

    assert.ok(app.click('Remove'), 'no Remove in the confirmation');
    await app.settle();
    assert.equal(HW.CHECKINS.length, before - 1, 'confirming removed nothing');
    assert.ok(!app.text().includes(gone), 'the card is still on the board after removal');
  });
});

test('Keep waiting leaves the check-in alone', async () => {
  await withApp('pos', async (app) => {
    await app.mount('OrdersScreen');
    const HW = app.window.HW;
    const before = HW.CHECKINS.length;
    fire(app, app.window.document.querySelector('button[aria-label^="Remove"]'));
    await app.settle();
    assert.ok(app.click('Keep waiting'), 'no way out of the confirmation');
    await app.settle();
    assert.equal(HW.CHECKINS.length, before, 'backing out still removed the check-in');
    assert.ok(!app.text().includes('off the waiting list?'), 'the confirmation is stuck open');
  });
});

// ── The dispatch row action: the one that did the WRONG thing ──────────────

test('the dispatch row action opens the driver picker, NOT the order modal', async () => {
  // Positive control first: clicking the ROW is what opens the order modal, so
  // "Edit order" is a true marker for "the wrong thing happened".
  await withApp('pos', async (app) => {
    await app.mount('OrdersScreen');
    await toDelivery(app);
    fire(app, app.window.document.querySelector('tbody tr'));
    await app.settle();
    assert.ok(app.buttons().includes('Edit order'), 'the row no longer opens the order modal — this marker needs updating');
  });

  await withApp('pos', async (app) => {
    await app.mount('OrdersScreen');
    await toDelivery(app);
    assert.ok(app.click('Assign'), 'no Assign action in the dispatch table');
    await app.settle();
    assert.ok(app.text().includes('Assign a driver'), 'Assign did not open the driver picker');
    assert.ok(!app.buttons().includes('Edit order'),
    'Assign still falls through to the row and opens the order modal');
  });
});

test('assigning a driver writes to the order and moves the load', async () => {
  await withApp('pos', async (app) => {
    await app.mount('OrdersScreen');
    const HW = app.window.HW;
    await toDelivery(app);
    app.click('Assign');
    await app.settle();

    const [pick] = byTitle(app, /^Give this stop to Dev Anand$/);
    assert.ok(pick, 'the idle driver is not offered');
    const stops0 = HW.DRIVERS.find((d) => d.name === 'Dev Anand').stops;
    fire(app, pick);
    await app.settle();

    /* WHAT IS STORED IS THE NAME; WHAT IS DRAWN IS THE ABBREVIATION.
     * This assertion used to read `o.driver === 'Dev A.'` — it pinned the
     * defect. `shortDriver()` produces the dispatcher's board form for a narrow
     * column, and that truncation was being written back through updateOrder as
     * though it were the driver's name, discarding the surname permanently:
     * 'Dev A.' cannot be turned back into 'Dev Anand' by anything, and a second
     * Dev on the roster is indistinguishable from the first.
     * [OWNER RULING 2026-08-27] The record now keeps the roster's own name and
     * id; the board form is produced at the glass. Both halves are asserted
     * here, because fixing the write while breaking the label would trade one
     * visible bug for a quieter one. */
    const assigned = HW.ORDERS.filter((o) => o.driver === 'Dev Anand').map((o) => o.id);
    assert.equal(assigned.length, 1,
      'the order was not written with the driver\'s real name — a display abbreviation ' +
      'stored as the name loses the surname for good');
    assert.equal(HW.ORDERS.find((o) => o.id === assigned[0]).driverId, 'd3',
      'the order points at no roster row — matching a driver back by the shape of a string ' +
      'is what the id exists to stop');
    assert.equal(HW.ORDERS.filter((o) => o.driver === 'Dev A.').length, 0,
      'the truncation is still being persisted somewhere');
    assert.equal(HW.DRIVERS.find((d) => d.name === 'Dev Anand').stops, stops0 + 1, 'the driver did not pick up the load');
    assert.ok(app.text().includes('Dev A.'),
      'the table stopped showing the dispatcher\'s board form — storing the full name must ' +
      'not change what the board reads, or every column that fit now does not');
  });
});

test('re-routing hands the stop back — capacity is not a decoration', async () => {
  await withApp('pos', async (app) => {
    await app.mount('OrdersScreen');
    const HW = app.window.HW;
    await toDelivery(app);
    const theo0 = HW.DRIVERS.find((d) => d.name === 'Theo Reyes').stops;
    assert.ok(app.click('Re-route'), 'no Re-route action');
    await app.settle();
    const [pick] = byTitle(app, /^Give this stop to Dev Anand$/);
    fire(app, pick);
    await app.settle();
    assert.equal(HW.DRIVERS.find((d) => d.name === 'Theo Reyes').stops, theo0 - 1,
    'the previous driver kept a stop they no longer have');
  });
});

test('a failed reassignment does not touch either driver\'s stop count', async () => {
  // Companion to 0bc0ea3 (the sheet no longer closes on a failed reassignment).
  // That fix left `assignDriverTo` bumping the old/new driver's `stops` BEFORE
  // confirming `updateOrder` actually wrote — so the same race it made visible
  // in the UI was still silently corrupting the fleet load numbers underneath
  // the correct-looking error. Reproduce the race the same way: splice the
  // order out of window.HW.ORDERS between the sheet rendering and the click.
  await withApp('pos', async (app) => {
    await app.mount('OrdersScreen');
    const HW = app.window.HW;
    await toDelivery(app);
    assert.ok(app.click('Re-route'), 'no Re-route action');
    await app.settle();

    const [pick] = byTitle(app, /^Give this stop to Dev Anand$/);
    assert.ok(pick, 'the idle driver is not offered');
    const idMatch = app.text().match(/#(\S+)\s*·/);
    assert.ok(idMatch, 'could not find the order id in the sheet header');
    const idx = HW.ORDERS.findIndex((o) => String(o.id) === idMatch[1]);
    assert.ok(idx >= 0, 'could not find the order in window.HW.ORDERS');

    const theo0 = HW.DRIVERS.find((d) => d.name === 'Theo Reyes').stops;
    const dev0 = HW.DRIVERS.find((d) => d.name === 'Dev Anand').stops;
    HW.ORDERS.splice(idx, 1);   // same array reference, only this element removed

    fire(app, pick);
    await app.settle();

    assert.ok(app.text().includes('could not be reassigned'),
    'the sheet does not report the failed reassignment');
    assert.equal(HW.DRIVERS.find((d) => d.name === 'Theo Reyes').stops, theo0,
    'the previous driver was docked a stop for a reassignment that never wrote');
    assert.equal(HW.DRIVERS.find((d) => d.name === 'Dev Anand').stops, dev0,
    'the new driver picked up a stop for a reassignment that never wrote');
  });
});

test('a driver who cannot take the stop is refused out loud', async () => {
  await withApp('pos', async (app) => {
    await app.mount('OrdersScreen');
    await toDelivery(app);
    app.click('Assign');
    await app.settle();
    // Aaron Wells is offline in the roster.
    const off = [...app.window.document.querySelectorAll('button')]
    .find((b) => (b.getAttribute('title') || '').includes('off shift'));
    assert.ok(off, 'the offline driver is silently missing instead of visibly refused');
    assert.equal(off.disabled, true, 'the offline driver can still be handed a stop');
    assert.ok(app.text().includes('Aaron is off shift'), 'nothing says WHY he cannot take it');
  });
});

// ── Drivers view: Route, and Assign driver ─────────────────────────────────

test('Route shows what that driver is actually carrying', async () => {
  await withApp('pos', async (app) => {
    await app.mount('OrdersScreen');
    await toDelivery(app);
    app.click('Drivers');await app.settle();
    assert.ok(app.click('Route'), 'no Route button');
    await app.settle();
    const t = app.text();
    assert.ok(t.includes('Theo Reyes’s route'), 'Route did nothing');
    assert.ok(/\d+ stops? in the queue · [\d.]+ mi/.test(t), 'the route sheet does not total the run');
    assert.ok(t.includes('2841 Mission Trail'), 'the stops Theo is carrying are not listed');
  });
});

test('Route on a driver with nothing says so rather than showing an empty box', async () => {
  await withApp('pos', async (app) => {
    await app.mount('OrdersScreen');
    await toDelivery(app);
    app.click('Drivers');await app.settle();
    assert.ok(app.click('Route', { nth: 2 }), 'no third Route button');
    await app.settle();
    assert.ok(app.text().includes('Nothing in today’s queue is assigned to Dev'),
    'an empty route is indistinguishable from a broken one');
  });
});

test('Assign driver in the unassigned queue empties that queue', async () => {
  await withApp('pos', async (app) => {
    await app.mount('OrdersScreen');
    await toDelivery(app);
    app.click('Drivers');await app.settle();
    const n0 = Number(app.text().match(/Unassigned(\d+)/)[1]);
    assert.ok(n0 > 0, 'nothing is unassigned, so this proves nothing');
    assert.ok(app.click('Assign driver'), 'no Assign driver button');
    await app.settle();
    const [pick] = byTitle(app, /^Give this stop to /);
    assert.ok(pick, 'the sheet offered nobody');
    fire(app, pick);
    await app.settle();
    assert.equal(Number(app.text().match(/Unassigned(\d+)/)[1]), n0 - 1, 'the order never left the unassigned queue');
  });
});

// ── The map view and Optimize ──────────────────────────────────────────────

test('Optimize re-orders the run nearest-first, and can be undone', async () => {
  await withApp('pos', async (app) => {
    await app.mount('OrdersScreen');
    await toDelivery(app);
    assert.ok(app.click('Map'), 'the map view is not reachable');
    await app.settle();
    const dists = () => (app.text().match(/[\d.]+ mi/g) || []).join(',');
    const before = dists();

    assert.ok(app.click('Optimize'), 'no Optimize button');
    await app.settle();
    const after = dists();
    assert.notEqual(after, before, 'Optimize did nothing to the stop order');
    // the leading total is the summary line; the stops follow it, sorted
    const nums = (app.text().match(/[\d.]+ mi/g) || []).slice(1).map((s) => parseFloat(s));
    assert.equal(nums.join(','), nums.slice().sort((a, b) => a - b).join(','), 'the stops are not nearest-first');
    assert.ok(app.text().includes('Ordered nearest-first'), 'nothing says what Optimize did');

    assert.ok(app.click('Nearest first'), 'the toggle does not offer a way back');
    await app.settle();
    assert.equal(dists(), before, 'the original order cannot be restored');
  });
});

test('the phone button on a stop shows the number it has', async () => {
  await withApp('pos', async (app) => {
    await app.mount('OrdersScreen');
    await toDelivery(app);
    app.click('Map');await app.settle();
    const [phone] = byTitle(app, /^Show the phone number on file$/);
    assert.ok(phone, 'no phone control on the selected stop');
    fire(app, phone);
    await app.settle();
    assert.ok(/customer record|No phone number on this order/.test(app.text()),
    'the phone button still does nothing');
    assert.ok(app.text().includes('not wired to a handset') || app.text().includes('No phone number on this order'),
    'it implies it can dial');
  });
});

// ── 'Find customer' — the only escape from "a new customer" ────────────────

test('Find customer links a Weedmaps order to a real member', async () => {
  await withApp('pos', async (app) => {
    await app.mount('OrdersScreen');
    // ORD-00232 is the WM order the matcher could not place: match 'new'.
    const card = [...app.window.document.querySelectorAll('[title="Open the order"]')]
    .find((e) => /00232/.test(e.textContent || ''));
    assert.ok(card, 'the unowned Weedmaps order is not on the board');
    fire(app, card);
    await app.settle();
    assert.ok(app.click((t) => t.startsWith('Customer identity')), 'no identity fold');
    await app.settle();
    assert.ok(app.text().includes('No match — a new customer will be created'), 'not on the new-customer branch');

    assert.ok(app.click('Find customer'), 'no Find customer button');
    await app.settle();
    assert.ok(app.text().includes('Link this order to an existing customer'), 'Find customer did nothing');

    app.type('Search customers by name', 'girish');
    await app.settle();
    assert.ok(app.click('Merge into Girish'), 'searching the book found nobody it should have');
    await app.settle();
    assert.ok(app.text().includes('Merged into Girish Sharma'),
    'the merge did not name who the order was linked to');
  });
});

test('Find customer admits when the book has nobody', async () => {
  await withApp('pos', async (app) => {
    await app.mount('OrdersScreen');
    const card = [...app.window.document.querySelectorAll('[title="Open the order"]')]
    .find((e) => /00232/.test(e.textContent || ''));
    fire(app, card);await app.settle();
    app.click((t) => t.startsWith('Customer identity'));await app.settle();
    app.click('Find customer');await app.settle();
    app.type('Search customers by name', 'qqqq');
    await app.settle();
    assert.ok(app.text().includes('Nobody matches'), 'an empty search result says nothing');
  });
});

// ── Members screen: Export, View all, Unlink ───────────────────────────────

test('Export builds the CSV for the rows on screen', async () => {
  await withApp('pos', async (app) => {
    await app.mount('MembersScreen');
    assert.ok(app.click('Export'), 'no Export button');
    await app.settle();
    const t = app.text();
    assert.ok(/Export \d+ members/.test(t), 'Export did nothing');
    assert.ok(t.includes('Name,Email,Phone,Group'), 'no CSV was produced');
    const rows = app.window.HW.MEMBERS.length;
    assert.ok(t.includes(`Export ${rows} members`), `the export count does not match the ${rows} members on screen`);
    const links = [...app.window.document.querySelectorAll('a[download]')].map((a) => a.getAttribute('download'));
    assert.equal(links.join(','), 'members.csv', 'nothing is offered to save');
  });
});

test('Export says out loud that it is only exporting the filtered rows', async () => {
  await withApp('pos', async (app) => {
    await app.mount('MembersScreen');
    app.type('Search by name, email, phone', 'harshil');
    await app.settle();
    app.click('Export');
    await app.settle();
    const t = app.text();
    assert.ok(t.includes('Export 1 member'), 'the filter was ignored by the export');
    assert.ok(/not all \d+/.test(t), 'nothing warns that this is a partial export');
  });
});

test('View all expands the order history it was hiding', async () => {
  await withApp('pos', async (app) => {
    await app.mount('MembersScreen');
    const HW = app.window.HW;
    const i = HW.MEMBERS.findIndex((m) => m.visits > 6);
    assert.ok(i >= 0, 'no member has more history than the page shows');
    const rows = [...app.window.document.querySelectorAll('button[aria-label="chevron-right"]')];
    fire(app, rows[i]);
    await app.settle();

    // THE SUBTITLE CHANGED, AND THE CHANGE IS THE POINT. It used to read
    // "{m.visits} lifetime orders · showing N" over a list whose ids, dates,
    // item counts and TOTALS were generated from a character-code sum of the
    // customer id — the deleted char-hash confidence score, re-denominated in
    // dollars and feeding lifetime spend and average order value. Real orders
    // and simulated ones are counted separately now, because they are different
    // claims, and only the real ones reach the money.
    const shown = () => Number(app.text().match(/· showing (\d+)/)[1]);
    assert.equal(shown(), 6, 'the history is not truncated, so View all has no job');
    assert.ok(app.click((t) => t.startsWith('View all')), 'no View all button');
    await app.settle();
    assert.equal(shown(), HW.MEMBERS[i].visits, 'View all did not show them all');
    assert.ok(app.click('Show recent'), 'there is no way back to the short list');
    await app.settle();
    assert.equal(shown(), 6, 'the list will not collapse again');
  });
});

/* A GENERATED ORDER IS NOT A RECORDED ONE, AND IT MAY NOT BE MONEY.
 * m5 (Joseph Levi) claims 8 visits; the order board holds none for him. The
 * profile used to answer that gap with eight invented orders and a lifetime
 * spend computed from the same hash, unmarked. */
test('a simulated order history is MARKED, and never becomes lifetime spend', async () => {
  await withApp('pos', async (app) => {
    await app.mount('MembersScreen');
    const HW = app.window.HW;
    const i = HW.MEMBERS.findIndex((m) => m.visits > 6);
    const who = HW.MEMBERS[i];
    const real = (HW.ORDERS || []).filter((o) => o.name === who.name);
    assert.equal(real.length, 0, 'this test needs a member the order board holds nothing for');

    const rows = [...app.window.document.querySelectorAll('button[aria-label="chevron-right"]')];
    fire(app, rows[i]);
    await app.settle();
    const t = app.text();

    assert.match(t, /0 on record \+ \d+ SIMULATED/,
      'real and generated rows must be counted separately, not merged into one total');
    assert.match(t, /DEMO/, 'a generated order row must carry the DEMO mark');
    assert.match(t, /rows are simulated/, 'the section must say the depth is demo data');
    // The two tiles that decide how a customer gets treated. With no order on
    // the board there is nothing to average and nothing to total, and the hash
    // that used to answer both is gone.
    assert.match(t, /Avg order\s*not recorded/,
      'average order must say "not recorded", not a figure derived from the customer id');
    assert.match(t, /Lifetime\s*not recorded/,
      'lifetime spend must say "not recorded", not a figure derived from the customer id');
    assert.match(t, /Member since\s*not recorded/,
      '"Member since" was the same fiction wearing a date');
  });
});

test('Unlink Weedmaps identity confirms, then writes', async () => {
  await withApp('pos', async (app) => {
    await app.mount('MembersScreen');
    const HW = app.window.HW;
    const i = HW.MEMBERS.findIndex((m) => HW.wmLinked(m));
    assert.ok(i >= 0, 'no member is linked to Weedmaps');
    const rows = [...app.window.document.querySelectorAll('button[aria-label="chevron-right"]')];
    fire(app, rows[i]);
    await app.settle();

    assert.ok(app.click('Unlink Weedmaps identity'), 'no Unlink button');
    await app.settle();
    assert.equal(HW.wmLinked(HW.MEMBERS[i]), true, 'it unlinked without asking');
    assert.ok(/Unlink .+ from Weedmaps\?/.test(app.text()), 'Unlink did nothing');

    assert.ok(app.click('Unlink'), 'no confirm');
    await app.settle();
    assert.equal(HW.wmLinked(HW.MEMBERS[i]), false, 'the unlink was never written');
    assert.ok(app.text().includes('In-store only'), 'the card still claims the profile is linked');
  });
});

// ── The two writes the screens above lean on ───────────────────────────────

test('removeCheckIn refuses an id it does not have', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    const n = HW.CHECKINS.length;
    assert.equal(HW.removeCheckIn('nope'), null, 'it reported removing a check-in that never existed');
    assert.equal(HW.CHECKINS.length, n, 'the list changed anyway');
    const id = HW.CHECKINS[0].id;
    assert.equal(HW.removeCheckIn(id).id, id, 'it did not return what it removed');
    assert.equal(HW.CHECKINS.length, n - 1, 'nothing was removed');
  });
});

test('wmLinked prefers the stored answer over the derived one', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    const m = HW.MEMBERS.find((x) => HW.wmLinked(x));
    let notified = 0;
    const off = HW.subscribe(() => notified++);
    assert.equal(HW.setWmLink(m.id, false).id, m.id, 'the write did not return the record');
    assert.equal(HW.wmLinked(m), false, 'the derivation still wins over a real write');
    assert.equal(HW.setWmLink('nope', true), null, 'it wrote to a member that does not exist');
    assert.equal(notified, 1, 'a write that nothing hears about is a write no screen shows');
    off();
  });
});

test('the custom date range refuses instead of eating what you type', async () => {
  await withApp('pos', async (app) => {
    await app.mount('OrdersScreen');
    assert.ok(app.click('Jun 9 – Jun 10'), 'no date-range control');
    await app.settle();
    const boxes = [...app.window.document.querySelectorAll('input')]
    .filter((i) => ['From', 'To'].includes(i.getAttribute('placeholder') || ''));
    assert.equal(boxes.length, 2, 'the custom range inputs are gone');
    assert.equal(boxes.filter((i) => i.disabled).length, 2, 'they still accept input they cannot use');
    assert.ok(app.text().includes('Custom ranges need order timestamps'), 'nothing says why they are off');
  });
});

/* THE COMPLIANCE CARD IS WHERE A FABRICATED FACT COSTS THE MOST.
 * Licence number, date of birth, ID expiry, gender, the whole medical card
 * (MMIC #, recommending physician, issue and expiry, under a green "Active ·
 * Tax-exempt" header) and both marketing-consent rows were all derived from the
 * same character-code sum of the customer id. Those are the fabricated-METRC-id
 * class of claim, on the one card an operator opens to answer a regulator. */
test('the identity card shows the real document, or says it has none', async () => {
  await withApp('pos', async (app) => {
    await app.mount('MembersScreen');
    const HW = app.window.HW;
    // m5: MedicinalUser, and IDV holds no document at all.
    const i = HW.MEMBERS.findIndex((m) => m.id === 'm5');
    const rows = [...app.window.document.querySelectorAll('button[aria-label="chevron-right"]')];
    fire(app, rows[i]);
    await app.settle();
    const t = app.text();

    assert.doesNotMatch(t, /CA D\d{7}/,
      'a driver licence number was generated from the customer id');
    assert.doesNotMatch(t, /MMIC-\d+/,
      'a medical card number was generated from the customer id');
    assert.doesNotMatch(t, /Medical card · Active/,
      'a tax exemption was asserted from a customer TYPE, with no card on file');
    assert.match(t, /card not on file/,
      '"recorded as Medicinal" and "we hold their card" are different facts');
    assert.doesNotMatch(t, /Opted in/,
      'a marketing consent was a function of how the customer id spells');
    assert.match(t, /no consent recorded/,
      '"we hold no consent" and "they said no" are the two states that decide whether a ' +
      'message may be sent at all, and they rendered identically');
  });
});

test('a member with a REAL scanned document still shows it', async () => {
  await withApp('pos', async (app) => {
    await app.mount('MembersScreen');
    const HW = app.window.HW;
    // m1 carries a genuine IDV doc record written by a counter scan.
    const doc = HW.IDV.m1.doc;
    const i = HW.MEMBERS.findIndex((m) => m.id === 'm1');
    const rows = [...app.window.document.querySelectorAll('button[aria-label="chevron-right"]')];
    fire(app, rows[i]);
    await app.settle();
    const t = app.text();

    assert.ok(t.includes(doc.num), 'the real licence number from the IDV ledger is missing');
    assert.ok(t.includes(doc.expires), 'the real expiry from the IDV ledger is missing');
  });
});
