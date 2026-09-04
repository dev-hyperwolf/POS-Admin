/* ══ THE DETAIL PANEL'S "Swap" LINK NEVER GOT THE FIX THE ROW ALREADY HAD ═══
 *
 * terminals/tshared.jsx's TerminalDetail rendered the Credit card reader
 * section's action as a bare, static button:
 *
 *   <PBtn variant="ghost" size="xs" icon="refresh">Swap</PBtn>
 *
 * No onClick at all. Clicking it did nothing -- no picker opened, nothing was
 * ever assigned. The station-list row right next to it (terminals/v2.jsx
 * ReaderCell) and the region-reader panel (terminals/tshared.jsx RegionTile)
 * already solved this correctly: local `assigning` state flips the button
 * into a TSelect built from READER_POOL, and picking an option calls the
 * shared `onAssign` -- VersionByLocation's `assign`, which is the ONE place
 * the `readers` map (read by every row, by the "no reader" filter and by
 * attentionFor) is written. That fix was simply never copied to the second
 * place the same button lives.
 *
 * The fix here reuses that exact mechanism -- same READER_POOL, same TSelect,
 * same onAssign -- rather than inventing a parallel one, and threads a LIVE
 * `reader` (readers[detail.id], not a stale snapshot taken when the panel was
 * opened) and `onAssign` down from VersionByLocation to TerminalDetail.
 *
 * ⚠️ THE LOAD-BEARING ASSERTION is not that the panel's own text changes --
 * a purely local piece of state could fake that. It is that the STATION-LIST
 * ROW, which the working Swap button already proves reads the shared
 * `readers` map, shows the new reader too. That is the only way to tell
 * "wired to the real mechanism" apart from "redrew itself and nothing else".
 *
 * (The Receipt printer section carries the same dead "Swap" button. It is
 * NOT touched here: there is no working printer-swap mechanism anywhere in
 * this codebase to reuse -- no PRINTER_POOL, no printer ReaderCell equivalent
 * -- so fixing it would mean inventing a new, parallel implementation rather
 * than copying an existing one. Left as a separate, real gap.)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

/** The whole text of the station row for `name` -- same row the working
 *  ReaderCell Swap button lives in and writes through. */
function stationRow(app, name) {
  // Scoped to the STATION_COLS grid template (terminals/v2.jsx) -- the
  // schedule strip above the table also lays out per-station tiles as
  // `display: grid` and would otherwise match first.
  return [...app.document.querySelectorAll('div')].find((d) =>
    d.style && d.style.gridTemplateColumns === '1.7fr 1.4fr 2fr 1.2fr 1fr' &&
    (d.textContent || '').includes(name));
}
function stationRowText(app, name) {
  const row = stationRow(app, name);
  return row ? row.textContent : '';
}

/**
 * The Swap/Assign button inside TerminalDetail's named Section, scoped by
 * its header text.
 *
 * This scoping is not optional: the word "Swap" ALSO labels the
 * already-working station-row reader button, the person (associate) button,
 * and the mobile-row driver button -- all live on the same page at the same
 * time the detail panel is open. An unscoped `app.click('Swap')` would hit
 * whichever of those happens to sit first in DOM order, not the button this
 * test is about.
 */
function sectionActionButton(app, sectionTitle) {
  return [...app.document.querySelectorAll('button')].find((b) =>
    /^(Swap|Assign)$/.test((b.textContent || '').trim()) &&
    b.parentElement && (b.parentElement.textContent || '').includes(sectionTitle));
}

test('the Credit card reader Swap link in the terminal detail panel actually swaps the reader', async () => {
  await withApp('POS Terminal Configuration.html', async (app) => {
    await app.settle();

    assert.match(stationRowText(app, 'Front Counter 1'), /00201/,
      'fixture drift -- Front Counter 1 no longer starts with reader SN 00201, pick another station');

    const row = stationRow(app, 'Front Counter 1');
    assert.ok(row, 'no Front Counter 1 station row on the Terminals screen');
    row.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    await app.settle();

    assert.match(app.text(), /Credit card reader/, 'clicking the station row did not open the detail panel');
    assert.match(app.text(), /00201/, 'the detail panel does not show the reader currently on this station');

    const swapBtn = sectionActionButton(app, 'Credit card reader');
    assert.ok(swapBtn, 'no Swap button in the detail panel\'s Credit card reader section');
    swapBtn.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    await app.settle();

    assert.ok(app.click('Pick a reader…'),
      'clicking Swap opened no reader picker -- the detail panel Swap link is still dead');
    await app.settle();

    assert.ok(app.click((t) => t.includes('Stripe M2') && t.includes('00403')),
      `no spare reader option in the picker -- buttons on screen: ${app.buttons().join(' | ')}`);
    await app.settle();

    assert.match(app.text(), /00403/,
      'picking a spare reader from the detail panel did not update the panel itself');

    // The load-bearing check: the SAME shared state the working row-level
    // Swap button writes to must show the change too.
    const updatedRow = stationRowText(app, 'Front Counter 1');
    assert.match(updatedRow, /00403/,
      'the swap made from the detail panel never reached the shared `readers` state -- the '
      + 'station-list row (which the already-working Swap button there reads and writes) still '
      + 'shows the old reader. The detail panel redrew only its own local view.');
    assert.doesNotMatch(updatedRow, /00201/,
      'the station row still shows the old reader SN after swapping it from the detail panel');
  });
});
