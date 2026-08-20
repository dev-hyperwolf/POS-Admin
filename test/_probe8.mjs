import { withApp } from './ui-harness.mjs';
const fire = (app, el) => el.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
const modal = (app) => [...app.document.querySelectorAll('div')].filter(d => d.style.position === 'fixed' && d.style.zIndex === '80')[0];
const B = (root, label, nth=0) => [...root.querySelectorAll('button')].filter(b => (b.textContent||'').trim() === label)[nth];
const openOrder = async (app, id) => {
  const card = [...app.document.querySelectorAll('div')].find(d => (d.textContent||'').startsWith('#'+id));
  fire(app, card); await app.settle(); return modal(app);
};
const totals = (M) => {
  const t = M.textContent.replace(/\s+/g,' ');
  return t.match(/Total\$[\d.,]+/g);
};
await withApp('pos', async (app) => {
  await app.mount('OrdersScreen');
  let M = await openOrder(app, 'ORD-00224');
  console.log('TOTAL before:', totals(M));
  console.log('Edit order clicked:', !!B(M,'Edit order') && (fire(app, B(M,'Edit order')), true));
  await app.settle(); M = modal(app);
  console.log('BUTTONS in edit:', JSON.stringify([...M.querySelectorAll('button')].map(b=>(b.textContent||'').trim()||b.getAttribute('aria-label')||'[icon]')));
  console.log('TEXT (items area):', M.textContent.replace(/\s+/g,' ').match(/Items · editing.*?Promotions/)?.[0]);
  console.log('errors:', app.errors);
});
