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
 *   3. Nothing. Nothing is published and no consumer shows a line. A missing
 *      stamp must never break a page.
 *
 * IT NO LONGER DRAWS ANYTHING. The floating badge was the worst-behaved layer on
 * the page: pinned at right:8/bottom:8 (8px further out than every other piece of
 * chrome), 169x23, at the SAME z-index as the app switcher and "+ Demo data", and
 * appended after its fetch resolved -- so DOM order made it win every tie and it
 * ate the bottom 15px of both buttons, 34% of a 44px target. Measured, not
 * guessed: docs/FLOATING-UI-AUDIT.md 3.2.
 *
 * So this file now RESOLVES and PUBLISHES, and something else displays:
 *   - window.HW_BUILD = { host, branch, sha, builtAt, source, title }
 *   - a `hw:build` CustomEvent on window, for anything that mounted first.
 * shared/app-switcher.js renders it as the last row of its menu, and the hub
 * (Hyperwolf.html, the one page with no switcher) renders it in its own footer.
 * Every resolution branch below is unchanged; only the destination moved.
 */
(function () {
  'use strict';
  var REPO = 'dev-hyperwolf/POS-Admin';

  function publish(info) {
    if (!info || !info.sha) { return; }
    var host = location.hostname.indexOf('onrender') > -1 ? 'render'
             : location.hostname.indexOf('github.io') > -1 ? 'pages'
             : 'local';
    var out = {
      host: host, branch: info.branch, sha: String(info.sha),
      builtAt: info.builtAt || null, source: info.source || 'unknown',
      // Same string the old badge carried as its tooltip, so the drift it was
      // built to expose is still one hover away from whoever is looking.
      title: 'Serving ' + info.branch + ' @ ' + info.sha
           + (info.builtAt ? '\nbuilt ' + info.builtAt : '')
           + '\nSource: ' + (info.source || 'unknown'),
    };
    window.HW_BUILD = out;
    try { window.dispatchEvent(new CustomEvent('hw:build', { detail: out })); } catch (e) {}
  }

  function fromApi() {
    fetch('https://api.github.com/repos/' + REPO + '/commits/main')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (j && j.sha) publish({ branch: 'main', sha: j.sha, builtAt: j.commit && j.commit.author && j.commit.author.date, source: 'github api (head of main)' });
      })
      .catch(function () { /* silent: a stamp is never worth an error */ });
  }

  function start() {
    fetch('./build-info.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (j && j.sha) { j.source = j.source || 'build-info.json (deploy-time)'; publish(j); }
        else fromApi();
      })
      .catch(fromApi);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
