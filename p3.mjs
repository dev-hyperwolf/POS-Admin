import { bootDriver, labels } from './test/_drive.mjs';
const app = await bootDriver();
app.click('Go On Duty'); await app.settle();
console.log('OnDuty click:', app.click('On Duty')); await app.settle();
console.log('duty state:', app.window.M.s.duty, 'sheet:', app.window.M.s.sheet);
console.log('TEXT:', app.text().slice(0,3000));
console.log('BTN:', JSON.stringify(labels(app)));
app.close();
