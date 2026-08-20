import { withApp } from '../test/ui-harness.mjs';
await withApp('pos', async (app) => {
  console.log('ERRORS:', JSON.stringify(app.errors, null, 1));
  const names = Object.keys(app.window).filter(k => typeof app.window[k] === 'function' && /^[A-Z]/.test(k));
  console.log('WINDOW COMPONENTS:', names.join(', '));
  console.log('HW keys:', Object.keys(app.window.HW || {}).join(','));
  console.log('MEMBERS n=', (app.window.HW?.MEMBERS||[]).length);
});
