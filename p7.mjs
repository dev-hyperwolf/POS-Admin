import { bootDriver, labels, clickSel, state, onDuty, scanAll, btn, clickBtn } from './test/_drive.mjs';
const app = await bootDriver();
await onDuty(app);
clickSel(app, '[data-tour="stop"]', 0); await app.settle();
await scanAll(app);
clickBtn(app, /^Close out/); await app.settle();
console.log('ID btn click:', clickBtn(app, /^Scan customer ID/)); await app.settle();
console.log('overlay text:', app.text().includes('Lay the front of the ID'));
// shutter: button with empty text and width 70
const shutter = [...app.document.querySelectorAll('button')].filter(b=>!(b.textContent||'').trim() && /width: 70px/.test(b.getAttribute('style')||''));
console.log('shutter count', shutter.length);
shutter[0].dispatchEvent(new app.window.MouseEvent('click',{bubbles:true})); await app.settle();
console.log('after shutter buttons:', JSON.stringify(labels(app).slice(15)));
console.log('save click:', clickBtn(app, /Save to profile/)); await app.settle();
console.log('idChecked?', /ID captured/.test(app.text()));
console.log('toast', app.window.M.s.toast);
console.log('BTN', JSON.stringify(labels(app).slice(15)));
console.log('ERR', app.errors);
app.close();
