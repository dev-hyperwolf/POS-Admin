import { withApp } from '../test/ui-harness.mjs';
await withApp('pos', async (app) => {
  const W = app.window;
  W.ProbeOrders = () => W.React.createElement(W.OrdersScreen, { onStartSale: () => {} });
  await app.mount('ProbeOrders');
  // scope: the modal root is the fixed-inset overlay containing "Who is this order for?"
  const modal = () => [...app.document.querySelectorAll('div')].find(d => /position: fixed/.test(d.getAttribute('style')||'') && /Who is this order for/.test(d.textContent||''));
  const clickIn = (root, re, nth=0) => {
    const els = [...root.querySelectorAll('button')].filter(b=>re.test((b.textContent||'').trim()));
    const el = els[nth];
    if (!el) return {ok:false, n:els.length};
    el.dispatchEvent(new W.MouseEvent('click',{bubbles:true,cancelable:true}));
    return {ok:true, n:els.length, label:(el.textContent||'').trim()};
  };
  app.click('Resolve'); await app.settle();
  const m = modal();
  console.log('modal found?', !!m);
  console.log('switch tab ->', clickIn(m, /All customers/));
  await app.settle();
  const m2 = modal();
  console.log('book rows in modal:', [...m2.querySelectorAll('button')].filter(b=>/Check in & bind/.test(b.textContent)).length);
  console.log('CHECKINS before', W.HW.CHECKINS.length);
  const r = clickIn(m2, /^Check in & bind$/);
  console.log('clicked in modal ->', r);
  await app.settle();
  console.log('sheet closed?', !modal());
  console.log('CHECKINS after:', W.HW.CHECKINS.length, '| waiting shown:', (app.text().match(/(\d+) waiting/)||[])[1]);
  console.log('unowned banner still?', /no owner/.test(app.text()));
  console.log('the bound name appears on a card?', app.text().includes('Harshil Gupta'));
  console.log('errors', app.errors);
});
