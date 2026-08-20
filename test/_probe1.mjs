import { withApp } from './ui-harness.mjs';
await withApp('pos', async (app) => {
  console.log('ERRORS:', JSON.stringify(app.errors));
  await app.mount('OrdersScreen');
  console.log('ERRORS after mount:', JSON.stringify(app.errors));
  console.log('BUTTONS:', JSON.stringify(app.buttons(), null, 0));
  console.log('TEXT:', app.text().slice(0, 3000));
});
