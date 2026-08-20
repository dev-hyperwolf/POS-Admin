import { withApp } from '../test/ui-harness.mjs';
await withApp('pos', async (app) => {
  await app.mount('MembersScreen');
  const el = [...app.document.querySelectorAll('input')].find(i=>/e-mail or phone/.test(i.placeholder||''));
  console.log('found strip search?', !!el, el && el.placeholder);
  const before = app.text();
  const setter = Object.getOwnPropertyDescriptor(app.window.HTMLInputElement.prototype,'value').set;
  setter.call(el,'zzzznobody'); el.dispatchEvent(new app.window.Event('input',{bubbles:true}));
  await app.settle();
  console.log('input value after typing:', JSON.stringify(el.value));
  console.log('screen text unchanged?', before === app.text());
  console.log('waiting count:', (app.text().match(/(\d+) waiting/)||[])[1]);
  // and the member table search (control)
  const t = [...app.document.querySelectorAll('input')].find(i=>/name, email, phone/.test(i.placeholder||''));
  setter.call(t,'Manisha'); t.dispatchEvent(new app.window.Event('input',{bubbles:true}));
  await app.settle();
  console.log('table search works? shows 1:', /1 shown/.test(app.text()), '| Harshil gone from table?', !app.text().includes('Harshil'));
});
