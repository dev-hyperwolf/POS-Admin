import { withApp } from '../test/ui-harness.mjs';
const wait = (ms) => new Promise(r=>setTimeout(r,ms));
await withApp('pos', async (app) => {
  const W = app.window;
  W.__calls = [];
  W.ProbeCheckIn = function(){ return W.React.createElement(W.CheckInModal, { onClose: ()=>W.__calls.push({close:true}), onCheckIn: (p)=>W.__calls.push(p) }); };
  await app.mount('ProbeCheckIn');
  console.log('errors:', app.errors);
  console.log('BUTTONS:', JSON.stringify(app.buttons()));
  console.log('open New customer panel ->', app.click('New'));
  await app.settle();
  console.log('BUTTONS after New:', JSON.stringify(app.buttons()));
  const cc = () => [...app.document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Create customer');
  console.log('Create customer disabled?', cc() && cc().disabled);
  // inputs available
  console.log('inputs:', [...app.document.querySelectorAll('input')].map(i=>i.placeholder||'(no placeholder)'));
});
