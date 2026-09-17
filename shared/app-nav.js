// Hyperwolf — one nav definition shared by every app's left rail.
// Each app renders it with its own styling; this file owns the item list,
// the order, the icons and where each item actually goes. Add an app here
// once and it appears in every rail.
(function () {
  var ITEMS = [
    { id: 'home', label: 'Home', icon: 'layout', pos: 'home' },
    { id: 'register', label: 'Register', icon: 'register', pos: 'register' },
    { id: 'orders', label: 'Orders', icon: 'board', pos: 'orders', badge: 4 },
    { id: 'catalog', label: 'Catalog', icon: 'package', pos: 'catalog' },
    { id: 'batches', label: 'Batches', icon: 'box', href: 'METRC Batch Pipeline.html' },
    // Catalog -> Batches -> RFID is the physical-goods run of the rail: an operator
    // going from "batch approved for sale" to "tag it, pack it, verify the kit" travels
    // one item down. Everything below is commerce, which needs the goods to exist first.
    { id: 'rfid', label: 'RFID', icon: 'scan', href: 'rfid/index.html' },
    { id: 'promos', label: 'Promos', icon: 'tag', href: 'Promotions Suite.html' },
    { id: 'swapupsell', label: 'Swap & Upsell', icon: 'swap', href: 'Swap and Upsell Engine.html' },
    { id: 'merch', label: 'Merch', icon: 'layout-template', pos: 'merch' },
    { id: 'members', label: 'Members', icon: 'users', pos: 'members' },
    // People-adjacent to Members on purpose: Bounty scores and pays budtenders,
    // the same people Members tracks identity for. docs/INCENTIVES-PLAN-2026-09-07.md §0/§5.
    { id: 'bounty', label: 'Bounty', icon: 'trophy', href: 'Hyperwolf Bounty.html' },
    // Docs is the dev-team console: the audit, the contract and every repo,
    // searchable, with an assistant that cites file:line. No natural
    // neighbor among the staff-facing items above, so it sits right after
    // Bounty — the last "internal ops" item before Verify's identity group.
    { id: 'docs', label: 'Docs', icon: 'note', href: 'Hyperwolf Docs.html' },
    // Forms is the generated-form runtime (docs/migration/FORM-GENERATOR-PROPOSAL.md):
    // one renderer (shared/hd-form.jsx) turns a saved FormDef into a fillable
    // screen. Sits right after Docs, same "internal ops console" neighborhood.
    { id: 'forms', label: 'Forms', icon: 'note', href: 'Hyperwolf Forms.html' },
    // Identity-adjacent to Members and Bounty on purpose: Verify is the ID
    // check/liveness/review console. docs/IDV-PLAN-2026-09-08.md §10.
    { id: 'idv', label: 'Verify', icon: 'shield', href: 'Hyperwolf Verify.html' },
    { id: 'terminals', label: 'Terminals', icon: 'card', href: 'POS Terminal Configuration.html' },
    { id: 'delivery', label: 'Delivery', icon: 'pin', href: 'Hyperwolf Delivery.html' },
    { id: 'logistics', label: 'Dispatch', icon: 'truck', href: 'Hyperdrive Logistics.html' },
    { id: 'shophome', label: '@ Home', icon: 'route', href: 'Shop at Home.html' },
    { id: 'driver', label: 'Drivers App', icon: 'phone', href: 'Hyperwolf Driver App.html' },
    { id: 'engage', label: 'Engage', icon: 'megaphone', href: 'Hyperwolf Engage.html' }
  ];
  var SETTINGS = { id: 'settings', label: 'Settings', icon: 'settings', pos: 'settings' };

  // POS screens live in one file and are selected by a persisted route key, so
  // jumping to one from another app means setting the key before navigating.
  function go(item, localPosNav) {
    if (!item) return;
    if (item.href) { location.href = item.href; return; }
    if (item.pos) {
      if (localPosNav) { localPosNav(item.pos); return; }
      try { localStorage.setItem('hw-pos-route', item.pos); } catch (e) {}
      // A full navigation follows immediately, so this mainly keeps this write site
      // consistent with pos/app.jsx's in-app route effect, which dispatches the same
      // event so shared/notes.js's "This page" filter never shows a stale route.
      try { window.dispatchEvent(new CustomEvent('hw-route-change', { detail: { route: item.pos } })); } catch (e) {}
      location.href = 'Hyperwolf POS.html';
    }
  }
  window.HW_NAV = { items: ITEMS, settings: SETTINGS, all: ITEMS.concat([SETTINGS]), go: go };
})();

// ── D2 session chip (owner decision, 2026-09-16) ────────────────────────────
// shared/hw-live.js's server-issued session (HW_LIVE.login/logout/session)
// has no UI of its own; shared/hw-signin.jsx is the sign-in prompt, this is
// the ambient "who am I" readout. It has to be plain JS, not a screen edit:
// this task's hard rules permit touching shared/app-nav.js only, and the
// actual shell (pos/shell.jsx's TopBar) is out of scope — so this self-mounts
// as its own fixed chip, the same pattern shared/hw-live.js's own badge and
// shared/app-switcher.js already use for chrome that isn't part of any
// screen's render tree. Guarded on window.HW_LIVE existing, so the many pages
// that load this file but never load shared/hw-live.js (most of HW_NAV.items'
// targets) render nothing here.
(function () {
  function mount() {
    var live = window.HW_LIVE;
    if (!live || typeof live.session !== 'function') { return; }

    var el = document.createElement('div');
    el.setAttribute('data-hw-chrome', 'hw-session-chip');
    // top-right, not the corner pos/shell.jsx's own TopBar avatar chip
    // already owns — see this file's own history for why that placement was
    // rejected. Still ambient chrome sitting above in-page content (z 66,
    // shared/hw-z.js's chromeBar rung), which is the one collision this
    // codebase already accepts for every other floating chip it ships.
    el.style.cssText = 'position:fixed;top:68px;right:16px;z-index:var(--hwz-chromeBar,66);' +
      'display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;' +
      'background:#1c1b15;color:#e9e6da;border:1px solid #3d3930;' +
      'font-family:"Inter",-apple-system,system-ui,sans-serif;font-size:12px;line-height:1;' +
      'box-shadow:0 6px 18px rgba(0,0,0,.28);';
    document.body.appendChild(el);

    function minutesLeft(iso) {
      if (!iso) { return null; }
      var t = Date.parse(iso);
      if (isNaN(t)) { return null; }
      return Math.round((t - Date.now()) / 60000);
    }

    function linkBtn(label) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.style.cssText = 'background:none;border:none;color:inherit;font:inherit;cursor:pointer;padding:0;text-decoration:underline;';
      return b;
    }

    function render() {
      var s = live.session();
      el.innerHTML = '';
      if (!s) {
        // (c) from the sign-in prompt's own spec: the chip's own "Sign in"
        // reopens it via the window hook shared/hw-signin.jsx registers.
        var signIn = linkBtn('Sign in');
        signIn.addEventListener('click', function () { window.hwSignInOpen && window.hwSignInOpen(); });
        el.appendChild(signIn);
        return;
      }
      var store = (s.store_ids && s.store_ids.length) ? s.store_ids.join(', ') : 'all stores';
      var text = document.createElement('span');
      text.textContent = 'Signed in as ' + (s.label || 'operator') + ' · ' + store;
      el.appendChild(text);
      var mins = minutesLeft(s.expires_at);
      if (mins != null && mins < 15) {
        var warn = document.createElement('span');
        warn.style.cssText = 'color:#FFD100;font-weight:600;';
        warn.textContent = mins <= 0 ? 'expiring' : ('· ' + mins + 'm left');
        el.appendChild(warn);
      }
      var signOut = linkBtn('Sign out');
      signOut.style.opacity = '.85';
      signOut.addEventListener('click', function () {
        signOut.disabled = true;
        live.logout().then(render);
      });
      el.appendChild(signOut);
    }

    render();
    window.addEventListener('hw-live:authenticated', render);
    window.addEventListener('hw-live:unauthenticated', render);
    // Countdown freshness only — every state CHANGE already re-renders via
    // the two events above.
    setInterval(render, 20000);
  }

  if (document.body) { mount(); } else { document.addEventListener('DOMContentLoaded', mount); }
})();
