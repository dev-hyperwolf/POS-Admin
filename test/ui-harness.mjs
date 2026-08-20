/* ═══ THIS HARNESS IS WORTH SOMETHING ONLY WHERE IT IMITATES THE BROWSER ═══
 *
 * Every place it quietly does NOT is a place where a green suite means nothing.
 * Four found so far, and two were invisible until another team's code sat
 * beside ours in a merge:
 *
 *   · IT GIVES EACH FILE ITS OWN SCOPE (the IIFE below). The browser does not:
 *     with no `data-presets`, Babel compiles every top-level `const` to a global
 *     and the LAST script wins. That hid a live bug where pos/data.jsx and
 *     pos/screen-orders.jsx both declared `STAGES`, so setStage() returned null
 *     on every call while the UI reported success. STILL PRESENT — every suite
 *     depends on it. test/global-collisions.test.mjs covers the specific hole by
 *     reading the PAGES instead.
 *   · NO `fetch` — jsdom has none, and the live seams call it at load.
 *   · ReactDOM WAS THE FROZEN MODULE NAMESPACE, so code that patches
 *     createRoot (as the live seams do) threw. The browser's UMD global is
 *     writable.
 *   · TEARDOWN RACED QUEUED MICROTASKS, failing whole FILES whose every
 *     assertion had passed.
 *
 * The IIFE that hid STAGES and the sealed ReactDOM are the same bug wearing
 * different clothes. Before trusting this harness on anything load-order or
 * lifecycle shaped, check it is not lying to you about the browser.
 */
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
  // The customer storefront. Its cart and checkout screens are built in
  // parallel and may not exist yet; `scriptsFor` already skips a src that is
  // not on disk, so booting 'shop' works either way and the shell renders its
  // own "not loaded" state for whichever screen is missing.
  shop: 'Hyperwolf Shop.html',
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

  /* 🔴 THE HARNESS IS OFFLINE, AND SAYS SO RATHER THAN CRASHING.
   *
   * jsdom provides no `fetch`. The live seams (shared/hw-live*.js — lines,
   * identity, mapping, taxonomy, checkin, regions) call it AT LOAD, so on a
   * tree where those files are present every single app boot died with
   * `ReferenceError: fetch is not defined` and took 90 of 290 tests with it.
   *
   * ⚠️ NEITHER BRANCH COULD HAVE FOUND THIS ALONE. In a real browser `fetch`
   * exists, so their side is fine; on main those files are absent, so ours is
   * fine. It only exists at the join — which is the entire argument for testing
   * the MERGED tree rather than two green halves.
   *
   * A REJECTING stub would be wrong: an unhandled rejection at load is just a
   * different crash. This RESOLVES with a non-ok response, so each seam takes
   * its own "no live answer" path — which is the state we actually want under
   * test, because the harness must never reach the network.
   *
   * Set `opts.fetch` to drive a seam deliberately.
   */
  /* Once close() has run, a fetch that RESOLVES restarts a seam's poll against a
   * torn-down document — `Cannot read properties of undefined (reading 'body')`,
   * raised as an unhandledRejection AFTER the test ended, which node --test
   * scores as a failed FILE even though every assertion passed. Six files failed
   * that way on the merged tree.
   *
   * A promise that never settles is the honest answer: the harness is gone,
   * so the request genuinely has no reply coming. */
  let harnessClosed = false;

  /* EVERY TIMER THIS PAGE SCHEDULES, so close() can cancel them.
   *
   * The live seams poll on setTimeout/setInterval. jsdom's window.close() does
   * not reliably stop a timer that has already been scheduled, so the callback
   * fires against a torn-down document and throws
   * `Cannot read properties of undefined (reading 'body')` — as an
   * unhandledRejection AFTER the test ended, which node --test scores as a
   * failed FILE even though every assertion in it passed. Six files failed that
   * way on the merged tree, and guarding fetch alone did not fix it because the
   * retry is scheduled, not fetched. */
  /* ⚠️ A ONE-SHOT TIMER FORGETS ITSELF WHEN IT FIRES.
   *
   * The first version of this retained EVERY id for the life of the harness, in
   * a Set that only close() ever emptied. A page that schedules timers in a
   * loop — which a render loop does — therefore grew that Set without bound,
   * and the harness turned a page-level bug into a memory leak of its own. That
   * is the harness making things worse rather than observing them, and across
   * many concurrent runs it is the difference between one slow test and a
   * machine in trouble.
   *
   * setInterval entries stay until cleared, because they genuinely repeat. */
  const harnessTimers = new Set();
  for (const kind of ['setTimeout', 'setInterval']) {
    const orig = window[kind].bind(window);
    const clearName = kind === 'setTimeout' ? 'clearTimeout' : 'clearInterval';
    window[kind] = (fn, ms, ...rest) => {
      if (harnessClosed) return 0;
      let entry;
      const wrapped = kind === 'setTimeout'
        ? (...a) => { harnessTimers.delete(entry); return typeof fn === 'function' ? fn(...a) : undefined; }
        : fn;
      const id = orig(wrapped, ms, ...rest);
      entry = [clearName, id];
      harnessTimers.add(entry);
      return id;
    };
  }
  window.fetch = opts.fetch || function harnessFetch(url) {
    if (harnessClosed) return new Promise(() => {});
    return Promise.resolve({
      ok: false, status: 503, statusText: 'offline in the test harness',
      url: String(url),
      // Guarded too, not just the call: a response created BEFORE close() still
      // resolves afterwards, and it is the CONTINUATION that touches the dead
      // document. Checking only at call time left all six files failing.
      json: () => (harnessClosed ? new Promise(() => {}) : Promise.resolve(null)),
      text: () => (harnessClosed ? new Promise(() => {}) : Promise.resolve('')),
    });
  };

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
  /* 🔴 A MUTABLE COPY, NOT THE MODULE NAMESPACE.
   *
   * In the browser ReactDOM arrives from a UMD <script> and is a plain, writable
   * object. Here it is an ES Module namespace, which is SEALED — so any code
   * that patches it throws `Cannot assign to property 'createRoot' of
   * [object Module]`.
   *
   * shared/hw-live.js:1049 and shared/hw-live-checkin.js:913 both do exactly
   * that, wrapping createRoot to capture renders. On a merged tree that killed
   * 230 boots. Handing out the namespace object was the harness being
   * unfaithful to the browser it claims to imitate — the same category as the
   * IIFE wrapper that hid the STAGES collision.
   */
  window.ReactDOM = { ...ReactDOM };
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

  const roots = [];   // every React root mounted here, so close() can unmount them
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
      roots.push(root);
      await new Promise((r) => { root.render(React.createElement(Comp)); setTimeout(r, opts.settleMs ?? 60); });
      return api;
    },
  };
  /**
   * jsdom keeps the process alive. Always close, or `node --test` hangs.
   *
   * ⚠️ UNMOUNT FIRST. A cleanup that touches `document` — RegisterScreen's
   * `document.body.removeAttribute(...)` is the live example — runs AFTER
   * window.close() has torn the document down, and jsdom reports that as an
   * uncaught error that kills the whole node process. The symptom is a suite
   * that dies with "Cannot read properties of undefined (reading 'body')"
   * pointing at react-dom, long after the assertions passed. Unmounting while
   * the document still exists runs those cleanups the way a browser would.
   */
  api.close = () => {
    harnessClosed = true;   // stop the live seams before the document goes
    for (const [clear, id] of harnessTimers) { try { window[clear](id); } catch { /* gone */ } }
    harnessTimers.clear();
    for (const r of roots) { try { r.unmount(); } catch { /* already gone */ } }
    roots.length = 0;
    /* WINDOW.CLOSE IS DEFERRED, NOT IMMEDIATE.
     *
     * A live seam can have a promise continuation already queued as a
     * microtask. Tearing the document down synchronously means that
     * continuation runs against a dead window and throws
     * `Cannot read properties of undefined (reading 'body')` — raised as an
     * unhandledRejection AFTER the test ended, which node --test scores as a
     * failed FILE even though every assertion passed. Six files failed exactly
     * that way on the merged tree, and neither clearing timers nor guarding
     * fetch fixed it, because the work was already queued.
     *
     * setImmediate runs after the microtask queue drains, so those
     * continuations find the document still standing and complete harmlessly.
     * The document is unreferenced by then, so nothing can newly schedule. */
    try {
      const later = () => { try { window.close(); } catch { /* already gone */ } };
      if (typeof setImmediate === 'function') setImmediate(later); else later();
    } catch { /* already gone */ }
  };

  return api;
}
