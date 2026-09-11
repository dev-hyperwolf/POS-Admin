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
