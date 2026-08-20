import { withApp } from './ui-harness.mjs';
const fire = (app, el) => el.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
const modal = (app) => [...app.document.querySelectorAll('div')].filter(d => d.style.position === 'fixed' && d.style.zIndex === '80')[0];
const B = (root, label, nth=0) => [...root.querySelectorAll('button')].filter(b => (b.textContent||'').trim() === label)[nth];
const trashBtns = (root) => [...root.querySelectorAll('button')].filter(b => b.getAttribute('aria-label')==='trash');
const openOrder = async (app, id) => {
  const card = [...app.document.querySelectorAll('div')].find(d => (d.textContent||'').startsWith('#'+id));
  fire(app, card); await app.settle(); return modal(app);
};
const itemsText = (M) => M.textContent.replace(/\s+/g,' ').match(/Items · editing.*?(Promotions|$)/)?.[0];
const newTotal = (M) => M.textContent.replace(/\s+/g,' ').match(/New total(\$[\d.,]+)/)?.[1];

await withApp('pos', async (app) => {
  await app.mount('OrdersScreen');
  let M = await openOrder(app, 'ORD-00224');
  fire(app, B(M,'Edit order')); await app.settle(); M = modal(app);
  console.log('--- trash the 2nd line ---');
  const t = trashBtns(M); console.log('trash count:', t.length);
  fire(app, t[1]); await app.settle(); M = modal(app);
  console.log('items:', itemsText(M));
  console.log('newTotal:', newTotal(M));
  console.log('approval prompt present:', /Manager approval required/.test(M.textContent));
  const save = B(M,'Save changes');
  console.log('Save disabled (needs approval, not given):', save.disabled);
  console.log('--- tick approval ---');
  const check = [...M.querySelectorAll('button,[role="checkbox"],label')].find(e => (e.textContent||'').includes('Manager approval required'));
  console.log('approval element tag:', check && check.tagName);
  fire(app, check); await app.settle(); M = modal(app);
  console.log('approved text:', /Approved · Carla M/.test(M.textContent));
  console.log('Save disabled now:', B(M,'Save changes').disabled);
  console.log('errors:', app.errors);
});
