import { bootDriver, labels } from './test/_drive.mjs';
const app = await bootDriver();
console.log('clicked GoOnDuty:', app.click('Go On Duty'));
await app.settle();
console.log('ERR', app.errors);
console.log('TEXT:', app.text().slice(0,2500));
console.log('BTN:', JSON.stringify(labels(app)));
console.log('SHEET:', JSON.stringify(app.window.M.s.sheet));
app.close();
