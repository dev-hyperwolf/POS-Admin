import { withApp } from '../test/ui-harness.mjs';
function setInput(app, el, val){
  const setter = Object.getOwnPropertyDescriptor(app.window.HTMLInputElement.prototype,'value').set;
  setter.call(el, val); el.dispatchEvent(new app.window.Event('input',{bubbles:true}));
}
const waiting = (app) => (app.text().match(/(\d+) waiting/)||[])[1];
await withApp('pos', async (app) => {
  await app.mount('MembersScreen');
  console.log('waiting before:', waiting(app), '| names:', app.window.HW.CHECKINS.map(c=>c.name).join(','));
  console.log('click New check-in ->', app.click('New check-in'));
  await app.settle();
  console.log('modal open?', /New check-in.*Start of visit|Start of visit/.test(app.text()));
  app.click('New'); await app.settle();
  const ins = [...app.document.querySelectorAll('input')];
  console.log('inputs:', ins.map(i=>i.placeholder||'(none)'));
  const nameEl = ins.find(i=>!i.placeholder);
  setInput(app, nameEl, 'Rosa Probe'); await app.settle();
  console.log('click Create customer ->', app.click('Create customer')); await app.settle();
  console.log('customer chip shows?', app.text().includes('Rosa Probe'));
  const ci = [...app.document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Check in');
  console.log('Check in disabled?', ci.disabled);
  console.log('click Check in ->', app.click('Check in')); await app.settle();
  console.log('modal closed?', !/Start of visit/.test(app.text()));
  console.log('waiting AFTER:', waiting(app), '| CHECKINS:', app.window.HW.CHECKINS.map(c=>c.name).join(','));
  console.log('Rosa anywhere on screen?', app.text().includes('Rosa Probe'));
  console.log('HW.MEMBERS:', app.window.HW.MEMBERS.length);
  console.log('errors:', app.errors);
});
