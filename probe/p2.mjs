import { withApp } from '../test/ui-harness.mjs';
await withApp('pos', async (app) => {
  await app.mount('MembersScreen');
  console.log('ERRORS:', app.errors);
  console.log('BUTTONS:', JSON.stringify(app.buttons()));
  console.log('--- open Add Member ---', app.click('Add Member'));
  await app.settle();
  console.log('TEXT:', app.text().slice(0,600));
  console.log('BUTTONS:', JSON.stringify(app.buttons()));
});
