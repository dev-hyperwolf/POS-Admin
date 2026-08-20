import { withApp } from './ui-harness.mjs';
const fire = (app, el) => el.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
const modal = (app) => [...app.document.querySelectorAll('div')].filter(d => d.style.position === 'fixed' && d.style.zIndex === '80')[0];
const B = (root, label, nth=0) => [...root.querySelectorAll('button')].filter(b => (b.textContent||'').trim() === label)[nth];
const byAria = (root, aria, nth=0) => [...root.querySelectorAll('button')].filter(b => b.getAttribute('aria-label') === aria)[nth];
const byTitle = (root, t, nth=0) => [...root.querySelectorAll('button')].filter(b => b.getAttribute('title') === t)[nth];
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
  console.log('newTotal start:', newTotal(M));
  console.log('--- Increase on line 1 ---');
  fire(app, byAria(M,'Increase',0)); await app.settle(); M = modal(app);
  console.log('items:', itemsText(M)); console.log('newTotal:', newTotal(M));
  console.log('Save disabled?', B(M,'Save changes').disabled);
  console.log('--- Decrease twice on line 1 ---');
  fire(app, byAria(M,'Decrease',0)); await app.settle(); M=modal(app);
  fire(app, byAria(M,'Decrease',0)); await app.settle(); M=modal(app);
  console.log('items:', itemsText(M)); console.log('newTotal:', newTotal(M));
  console.log('--- trash line 2 ---');
  const trash = [...M.querySelectorAll('button')].filter(b => (b.textContent||'').trim()==='' && b.getAttribute('title')===null);
  console.log('trash-like count:', trash.length);
  // find trash via icon markup
  const trashBtns = [...M.querySelectorAll('button')].filter(b => b.innerHTML.includes('trash') || (b.getAttribute('aria-label')||'')==='trash');
  console.log('trashBtns:', trashBtns.length);
  console.log('errors:', app.errors);
});
