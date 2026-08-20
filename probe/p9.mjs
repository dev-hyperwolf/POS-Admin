import { withApp } from '../test/ui-harness.mjs';
function setInput(app, el, val){
  const setter = Object.getOwnPropertyDescriptor(app.window.HTMLInputElement.prototype,'value').set;
  setter.call(el, val); el.dispatchEvent(new app.window.Event('input',{bubbles:true}));
}
await withApp('pos', async (app) => {
  await app.mount('RegisterScreen');
  console.log('errors', app.errors);
  console.log('initial customer on screen? Girish:', app.text().includes('Girish Sharma'));
  console.log('New check-in ->', app.click('New check-in')); await app.settle();
  app.click('New'); await app.settle();
  const nameEl = [...app.document.querySelectorAll('input')].find(i=>!i.placeholder);
  setInput(app, nameEl, 'Rosa Probe'); await app.settle();
  app.click('Create customer'); await app.settle();
  console.log('Check in & start sale ->', app.click((t)=>/^Check in & start sale$/.test(t))); await app.settle();
  console.log('Rosa is now the active customer?', app.text().includes('Rosa Probe'));
  console.log('Girish gone?', !app.text().includes('Girish Sharma'));
  console.log('waiting:', (app.text().match(/Waiting (\d+)/)||[])[1], 'CHECKINS', app.window.HW.CHECKINS.length, 'MEMBERS', app.window.HW.MEMBERS.length);
  console.log('errors', app.errors);
});
