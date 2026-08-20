import { withApp } from '../test/ui-harness.mjs';
await withApp('pos', async (app) => {
  await app.mount('MembersScreen');
  app.click('Add Member'); await app.settle();
  const t0 = app.text();
  app.click('Create member'); await app.settle();
  const t1 = app.text();
  console.log('text identical after refusing click?', t0 === t1);
  console.log('errors:', app.errors);
  // is the button inside the modal I mounted?
  const b = [...app.document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Create member');
  console.log('button inside #root?', app.document.getElementById('root').contains(b));
  console.log('button offsetParent-ish / in modal?', !!b.closest('div[style*="z-index"]') || true);
});
