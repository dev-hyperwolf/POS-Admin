/* ══ THE CATALOG'S PAGE CONTROLS AND ROW ICONS WERE PURE DECORATION ═══════════
 *
 * pos/screen-catalog.jsx rendered a page-controls footer and, on every table
 * row, a pencil (Edit) and a trash can (Delete) icon. None of the four had an
 * onClick:
 *
 *     <PBtn variant="ghost" size="sm" icon="chevron-left" disabled>Prev</PBtn>
 *     <PBtn variant="soft" size="sm">1</PBtn>
 *     <PBtn variant="ghost" size="sm">2</PBtn>
 *     <PBtn variant="ghost" size="sm" iconRight="chevron-right">Next</PBtn>
 *     ...
 *     <IconBtn icon="pencil" size={15} style={{ width: 32, height: 32 }} />
 *     <IconBtn icon="trash" size={15} style={{ width: 32, height: 32 }} />
 *
 * and the table always rendered the SAME `rows` regardless of which page
 * button was "selected" — there was no PAGE_SIZE, no slice, nothing computing
 * which rows a given page even means. A catalogue bigger than one page could
 * never be paged through at all; "2" just sat there, permanently unselected,
 * permanently inert.
 *
 * THIS FILE DRIVES THE REAL SCREEN, not the slicing math in isolation — a test
 * that only proved `rows.slice(...)` works would have stayed green through the
 * entire life of this bug, because the table never called it.
 *
 * ── WHY THE FILTER-RESET TEST EXISTS SEPARATELY FROM THE PLAIN NEXT/PREV ONE
 *
 * A page index that is merely CLAMPED to `totalPages` (`Math.min(pageRaw,
 * totalPages)`) can look correct in the simple case — filter down to fewer
 * pages than you're currently on, and clamping alone lands you on the new
 * last page, which is a valid page and does not crash. But it is the WRONG
 * page: a search that narrows the catalogue should read as "here is what
 * matched," starting from the top, not "here is whatever page number you
 * happened to be on before, reinterpreted against a completely different
 * result set." The two behaviours only diverge when the filtered set still
 * spans more than one page, which is why the test below is built to leave
 * two pages standing after the filter — a test that filtered down to a
 * single page would pass under either implementation and prove nothing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

/** A minimal but complete product row — same shape pos/data.jsx's PRODUCTS.forEach
 *  finishes building (P_() plus the .wm attached at data.jsx:294). Every field
 *  screen-catalog.jsx's table columns actually read is present, so nothing
 *  under test is exercising a shape the real catalogue could never hand it. */
function testProduct(n, cat) {
  const nn = String(n).padStart(2, '0');
  return {
    id: 'TPROD' + nn, sku: 'TPROD' + nn, name: `AAA Product ${nn}`,
    brand: 'Test Brand', strain: 'Hybrid', cat: cat || 'Flower', thc: 20, wt: '1g',
    price: 10, was: null, qty: 50, cost: null, margin: null, hue: 90, active: true,
    wm: { state: 'synced', listings: ['pickup', 'delivery'], ext: 'HW-TPROD' + nn, last: null },
  };
}

async function mountCatalog(app, products) {
  app.window.HW.PRODUCTS = products;
  await app.mount('CatalogScreen');
}

function isDisabled(app, label) {
  const btn = [...app.document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === label);
  assert.ok(btn, `no "${label}" button on screen`);
  return btn.disabled;
}

/* ── 1 · PAGE CONTROLS ACTUALLY SLICE THE ROWS ───────────────────────────── */

test('Next actually changes which rows are on screen, and Prev reverses it', async () => {
  await withApp('pos', async (app) => {
    // 30 rows, one page size (25) over the default 1-page fixture — enough
    // for a real second page without needing to know PAGE_SIZE's exact value
    // beyond "more than a screenful."
    const products = Array.from({ length: 30 }, (_, i) => testProduct(i + 1));
    await mountCatalog(app, products);

    const screen1 = app.text();
    assert.match(screen1, /AAA Product 01/, 'page 1 does not even show the first row — nothing paged in at all');
    assert.doesNotMatch(screen1, /AAA Product 26/,
      'row 26 of 30 is visible on the FIRST page — either pagination never sliced, or PAGE_SIZE is not what this test assumes');
    assert.match(screen1, /Showing 1.25 of 30/, `footer does not report the page-1 slice — footer read: "${screen1.match(/Showing[^·]*/)?.[0]}"`);
    assert.equal(isDisabled(app, 'Prev'), true, 'Prev is clickable on page 1 — there is no page before this one');

    assert.ok(app.click('Next'), `no Next button — buttons: ${app.buttons().join(' | ')}`);
    await app.settle();

    const screen2 = app.text();
    assert.match(screen2, /AAA Product 26/, 'clicking Next did not bring row 26 onto the screen — Next has no effect on what is shown');
    assert.doesNotMatch(screen2, /AAA Product 01/, 'row 1 is STILL on screen after Next — the table did not change page, it just re-rendered the same rows');
    assert.match(screen2, /Showing 26.30 of 30/, `footer did not advance — footer read: "${screen2.match(/Showing[^·]*/)?.[0]}"`);
    assert.equal(isDisabled(app, 'Next'), true, 'Next is still clickable on the last page');

    assert.ok(app.click('Prev'), 'no Prev button on page 2');
    await app.settle();
    const screen3 = app.text();
    assert.match(screen3, /AAA Product 01/, 'Prev did not bring row 1 back');
    assert.doesNotMatch(screen3, /AAA Product 26/, 'Prev did not remove row 26 — the page did not actually go back');
  });
});

test('clicking a page NUMBER jumps straight to that page, not just Prev/Next', async () => {
  await withApp('pos', async (app) => {
    const products = Array.from({ length: 30 }, (_, i) => testProduct(i + 1));
    await mountCatalog(app, products);

    assert.ok(app.click('2'), `no page-2 button rendered — buttons: ${app.buttons().join(' | ')}`);
    await app.settle();
    const screen = app.text();
    assert.match(screen, /AAA Product 26/, 'clicking "2" directly did not show page 2\'s rows');
    assert.doesNotMatch(screen, /AAA Product 01/, 'clicking "2" left page 1\'s rows on screen');
  });
});

/* ── 2 · A NARROWING FILTER LANDS ON PAGE 1 OF THE NEW RESULT, NOT A STALE INDEX */

test('filtering while on page 3 shows page 1 of the FILTERED set, not a clamped leftover page', async () => {
  await withApp('pos', async (app) => {
    // 60 rows: the first 30 (alphabetically first, so they fill pages 1-2)
    // are Flower; the next 30 (pages 2-3) are Vapes. 3 pages of 25 total.
    const products = [
    ...Array.from({ length: 30 }, (_, i) => testProduct(i + 1, 'Flower')),
    ...Array.from({ length: 30 }, (_, i) => testProduct(i + 31, 'Vapes'))];

    await mountCatalog(app, products);

    // Walk to page 3 (rows 51-60, all Vapes).
    assert.ok(app.click('Next'), 'no Next on page 1 of 3');
    await app.settle();
    assert.ok(app.click('Next'), 'no Next on page 2 of 3');
    await app.settle();
    assert.match(app.text(), /AAA Product 51/, 'did not actually reach page 3 — the rest of this test proves nothing');

    // Filter down to Vapes only: 30 rows, still 2 pages at 25/page — chosen
    // deliberately so a bare clamp (page 3 -> min(3, 2) = page 2) and a real
    // reset-to-1 produce VISIBLY DIFFERENT screens.
    assert.ok(app.click('Vapes'), `no Vapes category filter — buttons: ${app.buttons().join(' | ')}`);
    await app.settle();

    const screen = app.text();
    assert.match(screen, /AAA Product 31/,
      'filtering to Vapes did not land on page 1 of the new (30-row) result — row 31, the first Vapes '
      + 'product alphabetically, should be showing. A page index that is only clamped to the new page '
      + 'count (rather than reset) would show page 2 of the filtered set instead, which is the wrong page.');
    assert.doesNotMatch(screen, /AAA Product 56/,
      'the screen is showing the filtered set\'s SECOND page (56-60) instead of its first — the page '
      + 'index survived the filter change instead of resetting to 1');
  });
});

/* ── 3 · EDIT ROUTES TO THE REAL EDIT SURFACE, NOT A DEAD ICON ───────────── */

test('the row Edit icon opens the same product detail/edit page the row itself opens', async () => {
  await withApp('pos', async (app) => {
    const products = [testProduct(1)];
    await mountCatalog(app, products);

    assert.doesNotMatch(app.text(), /Back to catalog/, 'the detail page is already open before anything was clicked');

    const editBtn = [...app.document.querySelectorAll('[data-hw-i]')]
      .find((el) => (el.getAttribute('aria-label') || '').startsWith('Edit AAA Product 01'));
    assert.ok(editBtn, 'no Edit icon button for the row (aria-label "Edit <product name>")');
    editBtn.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    await app.settle();

    assert.match(app.text(), /Back to catalog/,
      'clicking the row\'s Edit icon did not open the product detail page — it is still a dead control');
    assert.match(app.text(), /TPROD01/, 'the detail page opened for the wrong product, or opened blank');

    assert.ok(app.click('Back to catalog'), 'the detail page opened but has no way back');
    await app.settle();
    assert.doesNotMatch(app.text(), /Back to catalog/, 'Back to catalog did not return to the list');
  });
});

/* ── 4 · DELETE STAYS HONEST: DISABLED, NOT A FAKE WIRE-UP ───────────────── */

/**
 * There is no product-delete route anywhere in this build (verified: grep
 * across pos/*.jsx and shared/*.js for any DELETE-shaped call finds
 * shell-store.jsx's real POST /api/product create/upsert and GET
 * /api/product/<sku>, and nothing else). Wiring this button to splice the row
 * out of window.HW.PRODUCTS would "delete" it on screen while the server
 * still serves it on the next fetch — a screen that reports success and
 * changes nothing durable, the exact shape test/register-checkin-writes
 * .test.mjs exists to catch, on a different screen. The bulk action bar
 * above this row (screen-catalog.jsx ~line 281) already made this same call
 * for the same reason and left "Delete" unwired rather than fake it; this
 * keeps the row-level icon consistent with that decision instead of
 * re-opening it quietly one level down.
 */
test('the row Delete icon is honestly disabled, not a silent no-op pretending to work', async () => {
  await withApp('pos', async (app) => {
    const products = [testProduct(1)];
    await mountCatalog(app, products);
    const before = app.window.HW.PRODUCTS.length;

    const delBtn = [...app.document.querySelectorAll('[data-hw-i]')]
      .find((el) => (el.getAttribute('aria-label') || '').startsWith('Delete AAA Product 01'));
    assert.ok(delBtn, 'no Delete icon button for the row (aria-label "Delete <product name>")');
    assert.equal(delBtn.disabled, true,
      'the Delete icon is enabled with no backend route behind it — clicking it can only fake a deletion');
    assert.ok((delBtn.title || '').length > 10,
      'a disabled control with no explanation reads as broken, not as "not available" — it needs a real tooltip');

    delBtn.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    await app.settle();
    assert.equal(app.window.HW.PRODUCTS.length, before, 'clicking the disabled Delete icon changed the product store');
    assert.doesNotMatch(app.text(), /Back to catalog/, 'clicking Delete navigated to the detail page — it should do nothing at all');
  });
});

/* ══ VERIFIED RED / GREEN ═══════════════════════════════════════════════════
 *
 * Every test above was run against the PRE-FIX pos/screen-catalog.jsx (the
 * shipped file, byte-identical to origin/HEAD at the time of this pass — no
 * PAGE_SIZE, no slicing, `<IconBtn icon="pencil".../>` / `<IconBtn
 * icon="trash".../>` with no onClick) and every one failed:
 *   · both page-control tests — Next/Prev/"2" changed nothing, the footer
 *     never read "Showing 26-30 of 30"
 *   · the filter-reset test — there was no pagination to reset in the first
 *     place, so it failed at the very first Next click
 *   · the Edit test — clicking the pencil icon left the list on screen;
 *     "Back to catalog" never appeared
 *   · the Delete test — the trash icon had no `disabled` attribute and no
 *     `title`, so both of those assertions failed
 * Then run again against the fixed file: all green. This file was NOT
 * written against the fix and left unverified against the bug it claims to
 * catch.
 */
