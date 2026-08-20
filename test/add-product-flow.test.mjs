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

const openFlow = async (app) => {
  await app.mount('AddProductFlow');
  assert.ok(app.click((t) => /Add variation/.test(t)), 'no shell row was clickable');
  await app.settle();
};

const continueBtn = (app) => [...app.document.querySelectorAll('button')]
  .find((b) => /^Continue$/.test((b.textContent || '').trim()));

test('the flow opens and offers real shells', async () => {
  await withApp('pos', async (app) => {
    await app.mount('AddProductFlow');
    assert.deepEqual(app.errors, [], 'the page must load clean');
    assert.ok(app.buttons().filter((b) => /Add variation/.test(b)).length > 0,
      'no shells offered — step 1 is a dead end');
  });
});

test('picking a shell advances to the variation step', async () => {
  await withApp('pos', async (app) => {
    await openFlow(app);
    assert.match(app.text(), /Adding to shell/, 'it did not advance');
  });
});

test('Continue is genuinely DISABLED until the flavour is named, and SAYS SO', async () => {
  await withApp('pos', async (app) => {
    await openFlow(app);
    const btn = continueBtn(app);
    assert.ok(btn, 'no Continue button');
    assert.equal(btn.disabled, true,
      'a button that looks clickable and silently does nothing is the defect');
    assert.match(app.text(), /Name the flavour to continue/,
      'it must SAY what is missing — a faded opacity is not feedback');
  });
});

test('...and naming the flavour enables it', async () => {
  // The negative control. Without it the test above passes just as happily
  // against a button that is disabled forever.
  await withApp('pos', async (app) => {
    await openFlow(app);
    assert.ok(app.type('Fruit Punch', 'Blueberry Thunder'), 'could not find the name field');
    await app.settle();
    assert.equal(continueBtn(app).disabled, false, 'naming it must unblock the flow');
  });
});
