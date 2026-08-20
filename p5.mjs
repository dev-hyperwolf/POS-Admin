import { bootDriver, labels, deepClick, clickSel, state, onDuty } from './test/_drive.mjs';
const app = await bootDriver();
await onDuty(app);
clickSel(app, '[data-tour="stop"]', 0); await app.settle();
const closeBtn = () => [...app.document.querySelectorAll('button')].find(b=>/^Close out/.test((b.textContent||'').trim()));
console.log('close disabled before:', closeBtn().disabled);
console.log('footer msg:', /Scan all items to continue/.test(app.text()));
// click per-item Scan buttons repeatedly
for (let i=0;i<8;i++){
  const b = [...app.document.querySelectorAll('button')].find(x=>/^Scan( \(|$)/.test((x.textContent||'').trim()));
  if(!b) { console.log('no more Scan buttons at i='+i); break; }
  b.dispatchEvent(new app.window.MouseEvent('click',{bubbles:true}));
  await app.settle();
}
console.log('after scans text has allScanned:', /All items scanned & verified/.test(app.text()));
console.log('close disabled after:', closeBtn() && closeBtn().disabled);
console.log('ERR', app.errors);
app.close();
