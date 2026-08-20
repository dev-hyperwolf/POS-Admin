import { readFileSync } from 'node:fs';
import * as esbuild from 'esbuild';
import { boot } from './ui-harness.mjs';

const ROOT = new URL('..', import.meta.url).pathname;

/** Boot the driver app AND its real router (mobile/app.jsx), which the harness skips. */
export async function bootDriver(opts = {}) {
  const app = await boot('driver', opts);
  // The guided tour auto-starts 600ms after the driver goes on duty and its
  // first step calls popAll()+go('home'), which would rip the app out of any
  // flow under test. Mark it seen unless a test explicitly wants it.
  if (!opts.tour) { try { app.window.localStorage.setItem('hw-m-tourseen', '1'); } catch {} }
  const code = readFileSync(ROOT + 'mobile/app.jsx', 'utf8');
  const out = esbuild.transformSync(code, { loader: 'jsx', target: 'es2020' }).code;
  try { app.window.eval('(function(){' + out + '\n})();'); }
  catch (e) { app.errors.push('mobile/app.jsx: ' + e.message); }
  await app.settle();
  return app;
}

export function labels(app) {
  return [...app.document.querySelectorAll('button')].map((b) => (b.textContent || '').trim());
}

/** Click the DEEPEST element whose trimmed text matches — real bubbling event. */
export function deepClick(app, match, { nth = 0, within = null } = {}) {
  const root = within || app.document.body;
  const all = [...root.querySelectorAll('*')].filter((el) => {
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!(typeof match === 'function' ? match(t, el) : match.test(t))) return false;
    // deepest: no child also matches
    return ![...el.children].some((c) => {
      const ct = (c.textContent || '').replace(/\s+/g, ' ').trim();
      return typeof match === 'function' ? match(ct, c) : match.test(ct);
    });
  });
  const hit = all[nth];
  if (!hit) return null;
  hit.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  return hit;
}

export function clickSel(app, sel, nth = 0) {
  const el = app.document.querySelectorAll(sel)[nth];
  if (!el) return null;
  el.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  return el;
}

export const state = (app) => JSON.parse(JSON.stringify({
  tab: app.window.M.s.tab, stack: app.window.M.s.stack, sheet: app.window.M.s.sheet,
  cart: app.window.M.s.cart, cartTaskId: app.window.M.s.cartTaskId,
  completed: app.window.M.s.completed.map((c) => c.taskId), toast: app.window.M.s.toast,
}));

export async function onDuty(app) {
  app.click('Go On Duty'); await app.settle();
  app.click('On Duty'); await app.settle();
}

export async function scanAll(app) {
  for (let i = 0; i < 30; i++) {
    const b = [...app.document.querySelectorAll('button')].find((x) => /^Scan( \(|$)/.test((x.textContent || '').trim()));
    if (!b) return i;
    b.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true }));
    await app.settle();
  }
  return -1;
}
export const btn = (app, re) => [...app.document.querySelectorAll('button')]
  .find((b) => re.test((b.textContent || '').replace(/\s+/g, ' ').trim()));
export const clickBtn = (app, re) => { const b = btn(app, re); if (!b) return false; b.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true })); return true; };

/** Full happy path: home → stop nth → scan all → close out. Leaves you on the close-out form. */
export async function toCloseOut(app, nth = 0) {
  clickSel(app, '[data-tour="stop"]', nth); await app.settle();
  await scanAll(app);
  clickBtn(app, /^Close out/); await app.settle();
}
export async function captureId(app) {
  if (!clickBtn(app, /^Scan customer ID/)) return false;
  await app.settle();
  const shutter = [...app.document.querySelectorAll('button')]
    .find((b) => !(b.textContent || '').trim() && /width: 70px/.test(b.getAttribute('style') || ''));
  if (!shutter) return false;
  shutter.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true }));
  await app.settle();
  clickBtn(app, /Save to profile/); await app.settle();
  return true;
}
