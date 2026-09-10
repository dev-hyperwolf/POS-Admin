/* The Add Product flow, driven the way a person drives it.
 *
 * The owner's report was "they just dont even work", and driving it headlessly
 * showed why: five consecutive clicks on Continue moved the flow ZERO steps and
 * raised ZERO errors. The GATE was right — a variation needs a flavour name —
 * but Continue had no `disabled` attribute and said nothing, so the only
 * feedback was a faint opacity change. Silent refusal reads as broken, and for
 * someone trying to use it, it IS broken.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';
import { makeShellsFixture } from './shells-fetch-stub.mjs';

// The shells library now comes from GET /api/shells (docs/SHELLS-PLAN-2026-
// 09-09.md §3), not a synchronous client-side seed — every test here boots
// against the fake backend in shells-fetch-stub.mjs so a real shell (and its
// Edibles/Gummies format, "Flavor" slot) is actually there to pick.
const withShellsApp = (fn) => withApp('pos', fn, { fetch: makeShellsFixture().fetch });

const openFlow = async (app) => {
  await app.mount('AddProductFlow');
  await app.settle();
  assert.ok(app.click((t) => /Add variation/.test(t)), 'no shell row was clickable');
  await app.settle();
};

const continueBtn = (app) => [...app.document.querySelectorAll('button')]
  .find((b) => /^Continue$/.test((b.textContent || '').trim()));

test('the flow opens and offers real shells', async () => {
  await withShellsApp(async (app) => {
    await app.mount('AddProductFlow');
    await app.settle();
    assert.deepEqual(app.errors, [], 'the page must load clean');
    assert.ok(app.buttons().filter((b) => /Add variation/.test(b)).length > 0,
      'no shells offered — step 1 is a dead end');
  });
});

test('picking a shell advances to the variation step', async () => {
  await withShellsApp(async (app) => {
    await openFlow(app);
    assert.match(app.text(), /Adding to shell/, 'it did not advance');
  });
});

test('Continue is genuinely DISABLED until the flavour is named, and SAYS SO', async () => {
  await withShellsApp(async (app) => {
    await openFlow(app);
    const btn = continueBtn(app);
    assert.ok(btn, 'no Continue button');
    assert.equal(btn.disabled, true,
      'a button that looks clickable and silently does nothing is the defect');
    // The Gummies format's slot is "Flavor" (Edibles), not "the flavour" — the
    // copy names whichever slot the format actually uses.
    assert.match(app.text(), /Enter a flavor to continue/i,
      'it must SAY what is missing — a faded opacity is not feedback');
  });
});

test('...and naming the flavour enables it', async () => {
  // The negative control. Without it the test above passes just as happily
  // against a button that is disabled forever. Naming it alone is not
  // enough now — a price and a server-confirmed derived name are also
  // required, so this drives both.
  await withShellsApp(async (app) => {
    await openFlow(app);
    assert.ok(app.type('e.g. Fruit Punch', 'Blueberry Thunder'), 'could not find the name field');
    assert.ok(app.type('0.00', '18.00'), 'could not find the price field');
    // The derived-name preview is debounced 250ms and then confirmed by the
    // (fake) server before Continue unblocks — genuinely async, so this waits
    // for the actual condition rather than one fixed settle().
    await app.waitFor(() => continueBtn(app) && continueBtn(app).disabled === false,
      { what: 'the derived-name preview to resolve and unblock Continue' });
    assert.equal(continueBtn(app).disabled, false, 'naming it and pricing it must unblock the flow');
  });
});
