import { withApp } from './ui-harness.mjs';
const q = (app, sel) => [...app.document.querySelectorAll(sel)];
const lane = (app) => app.document.querySelector('[data-tour="match-lane"]');
const btnsIn = (el) => [...el.querySelectorAll('button')].map(b => (b.textContent||'').trim());
const clickIn = (app, el, label, nth=0) => {
  const hit = [...el.querySelectorAll('button')].filter(b => (b.textContent||'').trim() === label)[nth];
  if (!hit) return false;
  hit.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  return true;
};

await withApp('pos', async (app) => {
  await app.mount('OrdersScreen');
  const L = lane(app);
  console.log('LANE PRESENT:', !!L);
  console.log('LANE TEXT (head):', L.textContent.replace(/\s+/g,' ').slice(0,200));
  console.log('LANE BUTTONS:', JSON.stringify(btnsIn(L)));
  // click first Bind inside the lane
  const ok = clickIn(app, L, 'Bind', 0);
  console.log('clicked Bind ->', ok);
  await app.settle();
  const L2 = lane(app);
  console.log('LANE STILL PRESENT AFTER BIND:', !!L2);
  if (L2) console.log('LANE TEXT AFTER:', L2.textContent.replace(/\s+/g,' ').slice(0,300));
  console.log('FULL TEXT contains ORD-00232:', app.text().includes('ORD-00232'));
  console.log('errors:', app.errors);
});
