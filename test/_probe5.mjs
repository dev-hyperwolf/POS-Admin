import { withApp } from './ui-harness.mjs';
const click = (app, el, label, nth=0) => {
  const hit = [...el.querySelectorAll('button')].filter(b => (b.textContent||'').trim() === label)[nth];
  if (!hit) return false;
  hit.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  return true;
};
await withApp('pos', async (app) => {
  await app.mount('OrdersScreen');
  const D = app.document;
  console.log('--- Yes, that’s them ---');
  const before = app.text();
  console.log('count of "Yes, that" before:', (before.match(/Yes, that/g)||[]).length);
  console.log('clicked:', click(app, D.body, 'Yes, that’s them', 0));
  await app.settle();
  const after = app.text();
  console.log('count after:', (after.match(/Yes, that/g)||[]).length);
  console.log('text changed:', before !== after);
  console.log('errors:', app.errors);
});
await withApp('pos', async (app) => {
  await app.mount('OrdersScreen');
  const D = app.document;
  console.log('--- Not them ---');
  console.log('clicked:', click(app, D.body, 'Not them', 0));
  await app.settle();
  const s = [...D.querySelectorAll('div')].find(d => (d.textContent||'').includes('Who is this order for?') && d.style.position === 'fixed');
  console.log('MatchSheet open:', !!s);
  if (s) console.log('for order:', s.textContent.replace(/\s+/g,' ').slice(0,110));
  console.log('errors:', app.errors);
});
