import { withApp } from '../test/ui-harness.mjs';
await withApp('pos', async (app) => {
  const W = app.window;
  W.ProbeOrders = () => W.React.createElement(W.OrdersScreen, { onStartSale: () => {} });
  await app.mount('ProbeOrders');
  const owner = () => (app.text().match(/(\d+) orders? on the floor with no owner/)||[])[1];
  console.log('unowned before:', owner());
  const modal = () => [...app.document.querySelectorAll('div')].find(d => /position: fixed/.test(d.getAttribute('style')||'') && /Who is this order for/.test(d.textContent||''));
  const clickIn = (root, re, nth=0) => { const el=[...root.querySelectorAll('button')].filter(b=>re.test((b.textContent||'').trim()))[nth]; if(!el) return false; el.dispatchEvent(new W.MouseEvent('click',{bubbles:true,cancelable:true})); return true; };
  app.click('Resolve'); await app.settle();
  console.log('bind to someone in the room ->', clickIn(modal(), /^Bind$/)); await app.settle();
  console.log('sheet closed?', !modal(), '| unowned now:', owner());
  console.log('errors', app.errors);
  // second: use the book path
  app.click('Resolve'); await app.settle();
  clickIn(modal(), /All customers/); await app.settle();
  console.log('book bind ->', clickIn(modal(), /^Check in & bind$/)); await app.settle();
  console.log('unowned now:', owner(), '| CHECKINS', W.HW.CHECKINS.length, '| waiting', (app.text().match(/(\d+) waiting/)||[])[1]);
  console.log('errors', app.errors);
});
