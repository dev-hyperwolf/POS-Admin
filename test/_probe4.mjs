import { withApp } from './ui-harness.mjs';
const lane = (app) => app.document.querySelector('[data-tour="match-lane"]');
const clickIn = (app, el, label, nth=0) => {
  const hit = [...el.querySelectorAll('button')].filter(b => (b.textContent||'').trim() === label)[nth];
  if (!hit) return false;
  hit.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  return true;
};
const sheet = (app) => [...app.document.querySelectorAll('div')].find(d => (d.textContent||'').includes('Who is this order for?') && d.style.position === 'fixed');

await withApp('pos', async (app) => {
  await app.mount('OrdersScreen');
  clickIn(app, lane(app), 'Check in & bind', 0);
  await app.settle();
  let s = sheet(app);
  console.log('--- switch to All customers tab ---');
  console.log('clicked tab:', clickIn(app, s, 'All customers'));
  await app.settle();
  s = sheet(app);
  console.log('SHEET BUTTONS:', JSON.stringify([...s.querySelectorAll('button')].map(b=>(b.textContent||'').trim())));
  console.log('SHEET TEXT:', s.textContent.replace(/\s+/g,' ').slice(0,500));
  console.log('--- click first "Check in & bind" for a book member ---');
  console.log('clicked:', clickIn(app, s, 'Check in & bind', 0));
  await app.settle();
  console.log('sheet closed:', !sheet(app));
  const L = lane(app);
  console.log('lane text:', L ? L.textContent.replace(/\s+/g,' ').slice(0,160) : '(lane gone)');
  console.log('full text has ORD-00232 card in a stage col:', app.text().includes('ORD-00232'));
  console.log('errors:', app.errors);
});
