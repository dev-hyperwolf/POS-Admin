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
  console.log('--- click "Check in & bind" in lane ---');
  console.log('clicked:', clickIn(app, lane(app), 'Check in & bind', 0));
  await app.settle();
  const s = sheet(app);
  console.log('MatchSheet open:', !!s);
  if (s) {
    console.log('SHEET BUTTONS:', JSON.stringify([...s.querySelectorAll('button')].map(b=>(b.textContent||'').trim())));
    console.log('SHEET TEXT:', s.textContent.replace(/\s+/g,' ').slice(0,600));
  }
  console.log('errors:', app.errors);
});
