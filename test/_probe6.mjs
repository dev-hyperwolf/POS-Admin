import { withApp } from './ui-harness.mjs';
const fire = (app, el) => el.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
const btn = (root, label, nth=0) => [...root.querySelectorAll('button')].filter(b => (b.textContent||'').trim() === label)[nth];
const modal = (app) => [...app.document.querySelectorAll('div')].find(d => d.style.position === 'fixed' && (d.textContent||'').includes('Order #'));

await withApp('pos', async (app) => {
  await app.mount('OrdersScreen');
  const D = app.document;
  // open an order detail: click an OrderCard. Use a card in the 'pack' stage.
  const card = [...D.querySelectorAll('div')].find(d => (d.textContent||'').startsWith('#ORD-00224'));
  console.log('card found:', !!card, card && card.textContent.replace(/\s+/g,' ').slice(0,80));
  fire(app, card);
  await app.settle();
  const M = modal(app);
  console.log('detail modal open:', !!M);
  console.log('BUTTONS:', JSON.stringify([...M.querySelectorAll('button')].map(b=>(b.textContent||'').trim())));
  console.log('errors:', app.errors);
});
