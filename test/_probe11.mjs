import { withApp } from './ui-harness.mjs';
const fire = (app, el) => el.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
const modal = (app) => [...app.document.querySelectorAll('div')].filter(d => d.style.position === 'fixed' && d.style.zIndex === '80')[0];
const B = (root, label, nth=0) => [...root.querySelectorAll('button')].filter(b => (b.textContent||'').trim() === label)[nth];
const openOrder = async (app, id) => {
  const card = [...app.document.querySelectorAll('div')].find(d => (d.textContent||'').startsWith('#'+id));
  fire(app, card); await app.settle(); return modal(app);
};
const itemsText = (M) => M.textContent.replace(/\s+/g,' ').match(/Items · editing.*?(Promotions|$)/)?.[0];

await withApp('pos', async (app) => {
  await app.mount('OrdersScreen');
  let M = await openOrder(app, 'ORD-00224');
  fire(app, B(M,'Edit order')); await app.settle(); M = modal(app);
  console.log('--- Add item ---');
  fire(app, B(M,'Add item')); await app.settle(); M = modal(app);
  console.log('picker open (Close product picker present):', !!B(M,'Close product picker'));
  const panelTxt = M.textContent.replace(/\s+/g,' ');
  console.log('PANEL TEXT:', panelTxt.match(/Close product picker.*?Promotions/)?.[0]?.slice(0,1200));
  console.log('BUTTONS:', JSON.stringify([...M.querySelectorAll('button')].map(b=>(b.textContent||'').trim()||b.getAttribute('aria-label')||'[?]')));
  console.log('errors:', app.errors);
});
