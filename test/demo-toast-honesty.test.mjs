/* ── FOUR TOASTS THAT NAMED A REAL SYSTEM OF RECORD ──────────────────────────
 *
 * A sweep found ~113 places in engage/, pipeline/ and the rfid trees that
 * success toast with no write behind them. These modules export ZERO window.*
 * writers, so there is no write path at all — not a write path that fails.
 *
 * ~109 of those stay exactly as they are. They are demo furniture with an
 * internal audience and they say vague things like "Saved", which reads as
 * prototype behaviour. Guarding all of them would fire constantly and teach
 * everyone to ignore the guard.
 *
 * These FOUR were different, because they named an external system of record:
 *
 *   engage/screen-customers.jsx      "identity.pii.revealed written to the audit log"
 *   engage/screen-ops.jsx            "written to the tenant flag snapshot + audit log"
 *   pipeline/screen-batches-extra.jsx "Merge submitted to METRC"
 *   pipeline/screen-inbox.jsx        "Approved N invoices" ... "posted to AP"
 *
 * METRC is state cannabis track-and-trace. An audit log is what someone points
 * at to prove a PII reveal was accountable. A screenshot of "Merge submitted to
 * METRC" outlives the context that made it obviously a mock, and read by a
 * compliance reviewer over somebody's shoulder it is simply false.
 *
 * ⚠️ WHY THIS FILE ASSERTS SOURCE TEXT, WHICH IS NORMALLY THE WEAK KIND OF TEST.
 * `fabricated-numbers.test.mjs` is right that a grep proves nothing about what
 * the operator reads. But here the string IS the defect: a literal argument to
 * window.hdToast. The banned-phrase half is the half with teeth — it catches the
 * claim coming back ANYWHERE in the file, including at a new copy-pasted call
 * site that a DOM test pointed at one screen would never reach. The PII site,
 * which the owner singled out, additionally gets a real rendered-surface test
 * at the bottom of this file.
 *
 * ⚠️ THE REPLACEMENT COPY IS PINNED ON PURPOSE. Normally pinning copy is a
 * mistake. It is the point here: the brief is that the old claim must not come
 * back by copy-paste, and a test that only banned the old phrasing would pass
 * against a build that had quietly deleted the limit-naming half.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withApp } from './ui-harness.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/* The voice these four were rewritten into is `mobile/screen-discrepancy.jsx`
 * and `mobile/screen-misc.jsx` — "Kept on this phone — not sent to support".
 * Both name their own limit ON SCREEN rather than hedging into "Saved". */
const SITES = [
  {
    rel: 'engage/screen-customers.jsx',
    what: 'the PII reveal',
    banned: [
      'identity.pii.revealed written to the audit log',
      'written to the audit log',
      'reveal logged to audit',
      'Reveal (audited)',
    ],
    required: [
      // Toast.
      "title: 'PII revealed — nothing was logged'",
      "description: 'Demo screen: no audit record was written. Nothing here makes this reveal accountable.'",
      // The badge that OUTLIVES the toast — it is still on screen after the
      // toast's 4.2s timer, so a fixed toast beside a badge reading "reveal
      // logged to audit" would leave the false claim as the last word.
      '>demo · not logged</span>',
      // The label read at the MOMENT OF DECIDING, which is where "(audited)"
      // did its real damage: it taught that revealing is safe BECAUSE it is
      // recorded. That habit outlives the prototype.
      "'Reveal (not logged)'",
    ],
  },
  {
    rel: 'engage/screen-ops.jsx',
    what: 'the tenant feature-flag toggle',
    banned: [
      'Change written to the tenant flag snapshot + audit log.',
      'tenant flag snapshot',
    ],
    required: [
      "description: 'Demo screen — the switch moved here only. No tenant snapshot or audit record was written.'",
    ],
  },
  {
    rel: 'pipeline/screen-batches-extra.jsx',
    what: 'the METRC package merge',
    banned: [
      "title: 'Merge submitted to METRC'",
      'units combined into new parent package',
    ],
    required: [
      "title: 'Merge staged — not sent to METRC'",
      // The unit count SURVIVES. The toast still has to confirm the
      // interaction registered; naming a limit is not licence to go vague.
      '`${left.qty + right.qty} units combined in this demo. Nothing was filed with the state.`',
    ],
  },
  {
    rel: 'pipeline/screen-inbox.jsx',
    what: 'the AP invoice batch approval',
    banned: [
      'posted to AP.',
    ],
    required: [
      '— nothing posted to AP`',
      'in this demo. No AP entry was created.`',
      // The counts and the money stay — same reason as the METRC one.
      '${smartBatchTarget.invoices.length} invoices',
      '${HD.formatCurrency(batchTotal, { showCents: false })}',
    ],
  },
];

for (const site of SITES) {
  test(`${site.what}: the old claim about a real system of record cannot come back`, () => {
    const src = read(site.rel);
    for (const phrase of site.banned) {
      assert.equal(src.includes(phrase), false,
        `${site.rel} names a real system of record again: ${JSON.stringify(phrase)}. ` +
        'These four toasts have no write behind them — the module exports zero window.* ' +
        'writers — so this sentence is false wherever it is printed.');
    }
  });

  test(`${site.what}: the toast still names its own limit on screen`, () => {
    const src = read(site.rel);
    for (const phrase of site.required) {
      assert.ok(src.includes(phrase),
        `${site.rel} lost the limit-naming copy: ${JSON.stringify(phrase)}. ` +
        'Deleting the claim is only half the fix — a toast that has gone vague ' +
        '("Merge complete") reads as real behaviour to anyone looking over a shoulder.');
    }
  });
}

/* ── AND THE ONE THAT MATTERS MOST, READ OFF THE RENDERED SCREEN ─────────────
 *
 * The defect in the PII toast was never only that the claim was false. Telling
 * staff a reveal was logged teaches them the reveal is safe BECAUSE it is
 * recorded. So this asserts what a person actually sees, at both moments: the
 * label before they click, and the badge that is still there afterwards.
 */
test('the PII reveal never tells an operator the reveal was audited', async () => {
  await withApp('Hyperwolf Engage.html', async (app) => {
    const D = app.window.ENGAGE_DATA;
    const c = D.CUSTOMERS[0];

    // The toast fires through window.hdToast, which only exists while ToastHost
    // is mounted. This probe mounts one screen, so without a stub the optional
    // call quietly no-ops and every assertion about it would pass vacuously.
    const toasts = [];
    app.window.hdToast = (t) => toasts.push(t);

    app.window.__PiiProbe = () => app.window.React.createElement(
      app.window.ScreenCustomerDetail, { path: '#/customers/' + c.id, navigate: () => {} });
    await app.mount('__PiiProbe');

    const before = app.text();
    assert.ok(before.includes('Reveal (not logged)'),
      'the reveal control does not name its limit where the decision is actually made');
    assert.ok(!/audited/i.test(before),
      'the screen still offers the reveal as "audited" before anyone clicks it');

    assert.ok(app.click('Reveal (not logged)'), 'no reveal control to click');
    await app.settle();

    const after = app.text();
    assert.ok(after.includes('not logged'),
      'nothing on the revealed screen says the reveal went unrecorded');
    assert.ok(!/logged to audit|audit log/i.test(after),
      'the revealed screen still claims an audit record that does not exist');

    assert.equal(toasts.length, 1, 'the reveal did not raise exactly one toast');
    const t = toasts[0];
    const line = `${t.title} ${t.description}`;
    assert.ok(/nothing was logged/i.test(t.title),
      'the toast title does not carry the limit; a title is the half people scan');
    assert.ok(/no audit record was written/i.test(t.description),
      'the toast no longer says plainly that nothing was written');
    assert.ok(!/written to the audit log/i.test(line),
      'the toast claims a write into the audit log');
    // The specific belief this wording exists to prevent.
    assert.ok(/accountable/i.test(line),
      'the toast leaves the operator free to believe the reveal is covered by a record');
  });
});
