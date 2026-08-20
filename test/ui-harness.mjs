/* ── DRIVE A REAL POS SCREEN, HEADLESSLY ─────────────────────────────────────
 *
 * Why this exists, in the owner's words: "they just dont even work. You should
 * have the QA agents test it inside the browser themselves."
 *
 * He was right, and the gap was real. Every QA pass until now read source and
 * ran node assertions — nothing ever CLICKED anything. Three surface
 * integrations were reverted and broken create-flows survived, because a test
 * that never renders the screen cannot tell you the screen is dead.
 *
 * This boots the actual app: the real .jsx files, transformed the same way
 * @babel/standalone transforms them in the browser, rendered by real React into
 * jsdom. `click(...)` dispatches a real event through React's handler. If a
 * button does nothing in here, it does nothing for a user.
 *
 * WHAT IT DOES NOT COVER, so nobody over-trusts it: layout, CSS, scroll,
 * overflow, focus rings, anything visual. It answers "does this WORK", never
 * "does this LOOK right".
 *
 * ⚠️ TWO TRAPS THAT WILL COST YOU AN HOUR EACH.
 *
 * 1. CROSS-REALM VALUES. Everything reached through `app.window` belongs to the
 *    jsdom realm, so an Array from it does NOT share Node's Array prototype.
 *    `assert/strict`'s deepEqual/deepStrictEqual compares prototypes and FAILS
 *    on two empty arrays. Compare primitives: `.join(',')`, `.length`, a string.
 *
 * 2. `typeof null === 'object'`. The adapter and the bridge deliberately set
 *    themselves to `null` when their dependency is missing, so a probe printing
 *    "HWGovern: object" can mean "loaded" OR "explicitly null". Check for null
 *    directly. This fooled me twice and made a broken load look like a good one.
 *
 * Usage:
 *   const app = await boot('pos');
 *   app.click('Catalog');
 *   await app.settle();
 *   assert.ok(app.text().includes('Master Catalog'));
 */
import { readFileSync, existsSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import * as esbuild from 'esbuild';

const ROOT = new URL('..', import.meta.url).pathname;

/** The script list an entry HTML actually loads, in order, minus the CDN ones. */
function scriptsFor(entryHtml) {
  const html = readFileSync(ROOT + entryHtml, 'utf8');
  const out = [];
  const re = /<script[^>]*src="([^"]+)"[^>]*>/g;
  let m;
  while ((m = re.exec(html))) {
    const src = m[1];
    if (/^https?:/.test(src)) continue;          // react/babel come from unpkg
    // pos/app.jsx is the BOOTSTRAPPER: its last line calls
    // ReactDOM.createRoot(...).render(<Root/>), which mounts the whole router.
    // We mount the component under test instead, so loading it here would boot a
    // second app whose render errors get blamed on whatever file evaluated last.
    if (/\/app\.jsx$/.test(src)) continue;
    if (existsSync(ROOT + src)) out.push(src);
  }
  return out;
}

/**
 * Transform one file the way the browser's babel does.
 * `.jsx` needs the JSX loader; plain `.js` is passed through untouched.
 */
function transform(src) {
  const code = readFileSync(ROOT + src, 'utf8');
  if (!src.endsWith('.jsx')) return code;
  // JSX only. NOT `format: 'iife'` — that is a BUNDLE format and on a bare
  // transform it produced a wrapper whose scope had no `window`, so app.jsx
  // died with "window is not defined". Babel-in-the-browser only strips JSX;
  // this must do the same and no more.
  const out = esbuild.transformSync(code, { loader: 'jsx', target: 'es2020' }).code;
  // The estate declares top-level consts that collide across files (pos/data.jsx
  // and delivery/ddata.jsx both declare DRIVERS). Separate <script> tags each get
  // their own top-level scope; wrap by hand to reproduce that, while leaving
  // `window` exactly where it was.
  return '(function(){' + out + '\n})();';
}

const ENTRIES = {
  pos: 'Hyperwolf POS.html',
  driver: 'Hyperwolf Driver App.html',
};

/**
 * Boot, run, and ALWAYS tear down — even when the assertion inside throws.
 *
 * ⚠️ USE THIS, NOT bare `boot()`, inside a test. jsdom holds the event loop
 * open, so a FAILING test that never reaches `close()` hangs `node --test`
 * forever instead of reporting the failure. A test suite that hangs on red is
 * worse than one that has no tests: it looks like an infrastructure problem
 * rather than a bug, which is exactly the wrong place to go looking.
 */
export async function withApp(which, fn, opts) {
  const app = await boot(which, opts);
  try { return await fn(app); } finally { app.close(); }
}

export async function boot(which = 'pos', opts = {}) {
  const entry = ENTRIES[which] || which;
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/', pretendToBeVisual: true,
    // 'dangerously' so injected <script> elements run with TRUE script
    // semantics. With 'outside-only' + window.eval, a top-level `var` does NOT
    // become a window property — so `var HWCommerce = ...` in the engine bundle
    // never reached window.HWCommerce, the adapter saw undefined and set
    // window.HWSwap = null, and every downstream check silently got null.
    //
    // That fooled me twice, because `typeof null === 'object'` — a probe reading
    // "HWGovern: object" looked like success and was reporting a null. If a
    // harness can lie about whether the thing under test even loaded, every
    // result it produces is worthless.
    runScripts: 'dangerously',
  });
  const { window } = dom;

  const errors = [];
  window.addEventListener('error', (e) => errors.push(String(e.message || e)));
  window.onerror = (m) => { errors.push(String(m)); };

  // ⚠️ react-dom RUNS IN NODE'S REALM, and it reaches for a bare `window`
  // (getCurrentEventPriority). jsdom's window is a different realm's object, so
  // without this the very first render throws "window is not defined" — from
  // react-dom, nothing to do with the app. Expose the DOM globals BEFORE the
  // import, which is the standard jsdom + React wiring.
  // `navigator` is a getter-only global on modern node, so assign defensively.
  for (const k of ['window', 'document', 'navigator', 'HTMLElement', 'Element',
    'Node', 'MouseEvent', 'Event', 'getComputedStyle']) {
    const value = k === 'window' ? window : window[k];
    try { globalThis[k] = value; }
    catch { Object.defineProperty(globalThis, k, { value, configurable: true, writable: true }); }
  }

  // Real React, the same major version the pages load from unpkg.
  const React = (await import('react')).default;
  const ReactDOM = (await import('react-dom/client'));
  window.React = React;
  window.ReactDOM = ReactDOM;
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  window.scrollTo = () => {};
  window.requestAnimationFrame = (cb) => setTimeout(cb, 0);

  for (const src of scriptsFor(entry)) {
    try {
      const el = window.document.createElement('script');
      el.textContent = transform(src);
      window.document.head.appendChild(el);
    } catch (err) {
      errors.push(`${src}: ${err.message}`);
      if (opts.strict) throw new Error(`${src}: ${err.message}`);
    }
  }

  // A script that throws inside jsdom reports through the error event, not the
  // append call, so surface anything that failed rather than carrying on with a
  // half-loaded page.
  if (opts.strict && errors.length) throw new Error(errors.join(' | '));

  const settle = () => new Promise((r) => setTimeout(r, opts.settleMs ?? 40));

  const api = {
    window, document: window.document, errors,
    /** All visible text, newlines collapsed — cheap to assert against. */
    text: () => (window.document.body.textContent || '').replace(/\s+/g, ' ').trim(),
    /** Every button label on screen, for when a test needs to say what it saw. */
    buttons: () => [...window.document.querySelectorAll('button')]
      .map((b) => (b.textContent || '').trim()).filter(Boolean),
    /**
     * Click by exact label, or by predicate. Returns false when nothing matched
     * — a test that clicks nothing and passes is the failure mode this replaces.
     */
    click(match, { nth = 0 } = {}) {
      const els = [...window.document.querySelectorAll('button,a,[data-hw-i]')];
      const hit = els.filter((el) => {
        const t = (el.textContent || '').trim();
        return typeof match === 'function' ? match(t, el) : t === match;
      })[nth];
      if (!hit) return false;
      hit.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
      return true;
    },
    /** Type into a field found by placeholder. */
    type(placeholder, value) {
      const el = [...window.document.querySelectorAll('input,textarea')]
        .find((i) => (i.getAttribute('placeholder') || '').includes(placeholder));
      if (!el) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, value);
      el.dispatchEvent(new window.Event('input', { bubbles: true }));
      return true;
    },
    settle,
    /** Render the app into #root. Call once after boot. */
    async mount(componentName) {
      const Comp = window[componentName];
      if (typeof Comp !== 'function') {
        throw new Error(`${componentName} is not defined — the page did not finish loading. `
          + `Errors so far: ${errors.join(' | ') || '(none)'}`);
      }
      const root = ReactDOM.createRoot(window.document.getElementById('root'));
      await new Promise((r) => { root.render(React.createElement(Comp)); setTimeout(r, opts.settleMs ?? 60); });
      return api;
    },
  };
  /** jsdom keeps the process alive. Always close, or `node --test` hangs. */
  api.close = () => { try { window.close(); } catch { /* already gone */ } };

  return api;
}
