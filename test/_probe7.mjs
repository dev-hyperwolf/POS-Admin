import { withApp } from './ui-harness.mjs';
const fire = (app, el) => el.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
const modal = (app) => [...app.document.querySelectorAll('div')].filter(d => d.style.position === 'fixed' && d.style.zIndex === '80')[0];
const openOrder = async (app, id) => {
  const card = [...app.document.querySelectorAll('div')].find(d => (d.textContent||'').startsWith('#'+id));
  fire(app, card); await app.settle();
  return modal(app);
};
await withApp('pos', async (app) => {
  await app.mount('OrdersScreen');
  const M = await openOrder(app, 'ORD-00224');
  console.log('modal:', !!M);
  console.log('BUTTONS:', JSON.stringify([...M.querySelectorAll('button')].map(b=>(b.textContent||'').trim())));
  console.log('TEXT:', M.textContent.replace(/\s+/g,' '));
  console.log('errors:', app.errors);
});
