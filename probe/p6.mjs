import { withApp } from '../test/ui-harness.mjs';
const wait = (ms) => new Promise(r=>setTimeout(r,ms));
function setInput(app, el, val){
  const setter = Object.getOwnPropertyDescriptor(app.window.HTMLInputElement.prototype,'value').set;
  setter.call(el, val); el.dispatchEvent(new app.window.Event('input',{bubbles:true}));
}
await withApp('pos', async (app) => {
  const W = app.window; W.__calls = [];
  W.ProbeCheckIn = function(){ return W.React.createElement(W.CheckInModal, { onClose: ()=>W.__calls.push('close'), onCheckIn: (p)=>W.__calls.push(p) }); };
  await app.mount('ProbeCheckIn');
  app.click('New'); await app.settle();
  const ins = [...app.document.querySelectorAll('input')];
  setInput(app, ins[1], 'Casey Newcomer');   // full name (no placeholder)
  await app.settle();
  app.type('MM/DD/YYYY','03/04/1991');
  app.type('(000) 000-0000','(951) 555-0123');
  app.type('name@email.com','casey@example.com');
  await app.settle();
  const cc = () => [...app.document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Create customer');
  console.log('Create customer disabled now?', cc().disabled);
  console.log('click Create customer ->', app.click('Create customer'));
  await app.settle();
  console.log('TEXT now:', app.text().slice(0,400));
  console.log('BUTTONS:', JSON.stringify(app.buttons()));
  const ci = () => [...app.document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Check in');
  console.log('Check in disabled?', ci() && ci().disabled);
  console.log('click Check in ->', app.click('Check in'));
  await app.settle();
  console.log('CALLS:', JSON.stringify(W.__calls, null, 1).slice(0,800));
  console.log('HW.MEMBERS n=', W.HW.MEMBERS.length, '| CHECKINS n=', W.HW.CHECKINS.length);
  console.log('errors:', app.errors);
});
