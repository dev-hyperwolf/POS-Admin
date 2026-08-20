import { withApp } from '../test/ui-harness.mjs';
function setInput(app, el, val){
  const setter = Object.getOwnPropertyDescriptor(app.window.HTMLInputElement.prototype,'value').set;
  setter.call(el, val); el.dispatchEvent(new app.window.Event('input',{bubbles:true}));
}
await withApp('pos', async (app) => {
  const W = app.window; W.__sale = 0;
  W.ProbeOrders = () => W.React.createElement(W.OrdersScreen, { onStartSale: () => W.__sale++ });
  await app.mount('ProbeOrders');
  console.log('errors', app.errors);
  console.log('waiting before:', (app.text().match(/(\d+) waiting/)||[])[1]);
  console.log('New check-in ->', app.click('New check-in')); await app.settle();
  app.click('New'); await app.settle();
  const nameEl = [...app.document.querySelectorAll('input')].find(i=>!i.placeholder);
  setInput(app, nameEl, 'Rosa Probe'); await app.settle();
  app.click('Create customer'); await app.settle();
  console.log('chip?', app.text().includes('Rosa Probe'));
  console.log('Check in & start sale ->', app.click((t)=>/^Check in & start sale$/.test(t))); await app.settle();
  console.log('onStartSale fired:', W.__sale);
  console.log('waiting after:', (app.text().match(/(\d+) waiting/)||[])[1]);
  console.log('Rosa on screen?', app.text().includes('Rosa Probe'));
  console.log('CHECKINS:', W.HW.CHECKINS.length, 'MEMBERS:', W.HW.MEMBERS.length);
  console.log('errors', app.errors);
});
