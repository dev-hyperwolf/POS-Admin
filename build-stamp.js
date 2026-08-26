/* Build stamp — tells you WHICH build a host is currently serving.
 *
 * WHY THIS EXISTS: GitHub Pages and Render served two different branches of this
 * repo for six days and nothing on either page said so. Pages served `main`;
 * Render build-cloned `feat/weedmaps-live-integration`. The same file differed by
 * 2,302 bytes across the two hosts and the only way to notice was to diff them by
 * hand. This makes drift visible instead of silent.
 *
 * HOW IT RESOLVES, in order:
 *   1. ./build-info.json  — written by Render's buildCommand at deploy time. This
 *      is the exact commit that host checked out, which is the honest answer.
 *   2. GitHub API for the head of `main` — the fallback for GitHub Pages, which
 *      serves `main` verbatim with no build step, so the head of main IS what is
 *      being served. Unauthenticated and rate-limited; failure is silent by design.
 *   3. Nothing. The badge does not render. A missing stamp must never break a page.
 *
 * Chrome, not a console screen: it styles itself rather than reading pos/tokens.jsx,
 * the same precedent as shared/app-switcher.js and shared/tour.js. No hex literals.
 */
(function () {
  'use strict';
  var REPO = 'dev-hyperwolf/POS-Admin';

  function render(info) {
    if (!info || !info.sha) return;
    var el = document.createElement('div');
    el.setAttribute('data-build-stamp', '');
    el.style.cssText = [
      'position:fixed', 'right:8px', 'bottom:8px', 'z-index:2147483000',
      'font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace',
      'padding:3px 8px', 'border-radius:999px',
      'background:rgba(0,0,0,.62)', 'color:rgba(255,255,255,.88)',
      'border:1px solid rgba(255,255,255,.16)',
      'pointer-events:auto', 'user-select:text', 'letter-spacing:.02em',
    ].join(';');
    var host = location.hostname.indexOf('onrender') > -1 ? 'render'
             : location.hostname.indexOf('github.io') > -1 ? 'pages'
             : 'local';
    el.textContent = host + ' · ' + info.branch + ' @ ' + String(info.sha).slice(0, 7);
    el.title = 'Serving ' + info.branch + ' @ ' + info.sha
             + (info.builtAt ? '\nbuilt ' + info.builtAt : '')
             + '\nSource: ' + (info.source || 'unknown');
    (document.body || document.documentElement).appendChild(el);
  }

  function fromApi() {
    fetch('https://api.github.com/repos/' + REPO + '/commits/main')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (j && j.sha) render({ branch: 'main', sha: j.sha, builtAt: j.commit && j.commit.author && j.commit.author.date, source: 'github api (head of main)' });
      })
      .catch(function () { /* silent: a stamp is never worth an error */ });
  }

  function start() {
    fetch('./build-info.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (j && j.sha) { j.source = j.source || 'build-info.json (deploy-time)'; render(j); }
        else fromApi();
      })
      .catch(fromApi);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
