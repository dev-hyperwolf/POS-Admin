import { withApp } from '../test/ui-harness.mjs';
const wait = (ms) => new Promise(r=>setTimeout(r,ms));
await withApp('pos', async (app) => {
  await app.mount('MembersScreen');
  const before = app.text().match(/(\d+) active members/)[1];
  app.click('Add Member'); await app.settle();
  const btn = () => [...app.document.querySelectorAll('button')].find(b=>/^Create member$/.test((b.textContent||'').trim()));
  console.log('create btn disabled attr?', btn().disabled, 'hasAttr:', btn().hasAttribute('disabled'));
  console.log('CLICK create with EMPTY form ->', app.click('Create member'));
  await app.settle();
  console.log('modal still open?', /Add member/.test(app.text()));
  console.log('any message about what is missing?', /required|missing|need|Fill/i.test(app.text()));
  // fill everything but the scan
  console.log('type name', app.type('Jane Doe','Casey Probe'));
  console.log('type dob', app.type('MM/DD/YYYY','01/02/1990'));
  console.log('type phone', app.type('(951) 555-0100','(951) 555-0199'));
  await app.settle();
  console.log('CLICK create, no ID scan ->', app.click('Create member'));
  await app.settle();
  console.log('modal open still?', /Add member/.test(app.text()), '| members count now:', app.text().match(/(\d+) active members/)[1], 'was', before);
  // now scan
  console.log('scan ->', app.click('Scan ID & capture photo'));
  await wait(1200);
  console.log('scan done?', /ID scanned/.test(app.text()));
  console.log('CLICK create ->', app.click('Create member'));
  await app.settle();
  console.log('modal open?', /Add member$/m.test(app.text()), '| active members:', app.text().match(/(\d+) active members/)[1]);
  console.log('row present?', app.text().includes('Casey Probe'));
  console.log('HW.MEMBERS n=', app.window.HW.MEMBERS.length, app.window.HW.MEMBERS.map(m=>m.name).join('|'));
});
