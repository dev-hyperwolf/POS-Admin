// ── pos/stores.jsx ── window.HW_STORES — the one store slug → display name list ──
//
// Three screens each held their own copy of "which stores exist and what do we
// call them": pos/screen-aov.jsx's AOV_STORE_NAMES, pos/screen-incentives-card.jsx's
// STORE_NAMES (its own comment already admitted the duplication), and
// pos/screen-merch.jsx's REGION_LABEL — and they had already begun to disagree:
// screen-merch.jsx read 'west-la' as 'West LA' while the other two read it as
// 'West Hollywood', which is the name wmdemo/associates.py's own STORES table
// (the estate's one named source for this slug) actually uses. This file is the
// one copy; the three screens read it instead of carrying their own.
//
// Seeded from the literal union of the three maps as they stood before this file
// existed: elsinore, west-la, long-beach, corona, riverside. Refreshed from
// GET /api/contracts/bounty/stores (contract Store rows: {id, name, ...}) when
// window.HW_LIVE is armed, in the estate's own never-reject shape
// (incentives/inc-client.jsx's get()) — a screen never needs a try/catch to read
// window.HW_STORES, on the demo path or the live one.
//
// Self-wrapped, so it leaks only the one global.
;(function () {
  const DEFAULT_NAMES = {
    elsinore: 'Lake Elsinore',
    'west-la': 'West Hollywood',
    'long-beach': 'Long Beach',
    corona: 'Corona',
    riverside: 'Riverside',
  };

  function toList(names) {
    return Object.keys(names).map((slug) => ({ slug, name: names[slug] }));
  }

  const HW_STORES = {
    names: Object.assign({}, DEFAULT_NAMES),
    list: toList(DEFAULT_NAMES),
    name(slug) { return HW_STORES.names[slug] || slug; },
  };
  window.HW_STORES = HW_STORES;

  // Never reject, mirror HW_LIVE's own {ok, body} shape so this never needs a
  // caller-side try/catch — same convention as incentives/inc-client.jsx get().
  function refresh() {
    const L = window.HW_LIVE;
    if (!L || !L.__armed || typeof L.get !== 'function') return Promise.resolve({ ok: false });
    return L.get('/api/contracts/bounty/stores').then((res) => {
      if (!res || !res.ok || !res.body || !Array.isArray(res.body.stores)) return res || { ok: false };
      const names = {};
      res.body.stores.forEach((s) => { if (s && s.id) names[s.id] = s.name || s.id; });
      // Only replace the seeded defaults once the server has actually named at
      // least one store — an empty/malformed response must never blank the list
      // a screen is already rendering from.
      if (Object.keys(names).length) {
        HW_STORES.names = names;
        HW_STORES.list = toList(names);
      }
      return res;
    }).catch(() => ({ ok: false }));
  }

  HW_STORES.refresh = refresh;
  refresh();
})();
