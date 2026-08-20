import { bootDriver, labels } from './test/_drive.mjs';
const app = await bootDriver();
console.log('ERRORS:', app.errors);
console.log('TEXT:', app.text().slice(0, 1500));
console.log('BUTTONS:', JSON.stringify(labels(app), null, 0));
app.close();
