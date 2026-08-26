/* ── MERCHANDISING — THE ONE SEAM ────────────────────────────────────────────
 *
 * What marketing has decided each surface should show, per region.
 *
 * 🔴 EVERY READ AND WRITE GOES THROUGH HERE, and that is the entire point. The
 * owner's answer on where this data ultimately lives was "browser storage for
 * now, marked as demo" AND "decide later — build behind one seam". So the
 * backing store is localStorage today and the decision between Airtable,
 * api.hyperwolf.com and a GAS web app stays open and cheap. If a screen reaches
 * around this file, that choice stops being reversible.
 *
 * ⚠️ THIS IS DEMO STORAGE. It is per-browser. Two marketers on two laptops have
 * two different realities, and nothing here syncs. `HWMerch.isDemoStorage()` is
 * true so surfaces can SAY so rather than implying a shared source of truth.
 *
 * THE OWNER'S DECISIONS, which this encodes:
 *  · A HOUSE CARD is the fallback when nobody has picked anything — evergreen
 *    Hyperwolf copy, editable at any time. Never a derived pick: falling back to
 *    "deepest markdown in the catalogue" is exactly how the shop came to
 *    advertise "Up to 97% off".
 *  · TWO MODES PER SURFACE, as separate controls: `carousel` (everyone sees all
 *    of them, in order) and `weighted` (each visitor sees one, split by share of
 *    voice). They are different mechanisms and conflating them is a silent wrong
 *    answer.
 *  · SHARE OF VOICE IS PER SURFACE x REGION.
 *  · WHO AND WHEN on every change, with history and rollback.
 *  · DRAFT -> REVIEW -> LIVE exists, and so does publish-immediately; scheduled
 *    changes are visible on the board before they go live.
 */
(function () {
  'use strict';
  var KEY = 'hw-merch-v1';
  var HISTORY_CAP = 50;          // per surface+region; enough to roll back, bounded

  /** Every surface a marketer can control. Ids match the Promotions Suite's
   *  registry (pweb/module.jsx) wherever one already exists, because a FIFTH
   *  surface vocabulary is the thing this estate least needs. */
  var SURFACES = [
    { id: 'shop_spotlight', label: 'Shop · Brand spotlight', cap: 1, page: 'Shop' },
    { id: 'home_hero', label: 'Home · Hero', cap: 1, page: 'Home' },
    { id: 'home_reorder', label: 'Home · Reorder row', cap: 3, page: 'Home',
      // The owner: a sponsored card may appear here, but NEVER first and always
      // labelled. Index 0 earns the "Your usual" badge and the row's whole
      // credibility comes from being genuinely the customer's own history.
      neverFirst: true, mustLabel: true },
    { id: 'cart_addon', label: 'Cart · Add-on', cap: 3, page: 'Cart' },
    { id: 'checkout_addon', label: 'Checkout · Add-on', cap: 1, page: 'Checkout' },
  ];
  var REGIONS = ['corona', 'long-beach', 'west-la'];
  var MODES = ['carousel', 'weighted'];
  var STATES = ['draft', 'review', 'live'];

  function _load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function _save(db) { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }
  var _subs = new Set();
  function _emit() { _subs.forEach(function (f) { try { f(); } catch (e) {} }); }
  function _slot(surface, region) { return surface + '::' + (region || 'all'); }

  function surfaceById(id) {
    for (var i = 0; i < SURFACES.length; i++) if (SURFACES[i].id === id) return SURFACES[i];
    return null;
  }

  /** The house card — the fallback, and editable at any time. */
  var HOUSE_DEFAULT = {
    headline: 'Express in ~90 min',
    sub: 'Free delivery over $50',
    kicker: 'Long Beach · on shift now',
  };
  function houseCard() {
    var db = _load();
    return Object.assign({}, HOUSE_DEFAULT, db._house || {});
  }
  function setHouseCard(patch, who) {
    if (!patch || typeof patch !== 'object') return null;
    var db = _load();
    var next = Object.assign({}, houseCard(), patch);
    // Never let it become blank — a blank house card is a blank surface, which
    // is the state it exists to prevent.
    if (!String(next.headline || '').trim()) return null;
    db._house = next;
    db._houseBy = { who: who || 'unknown', at: new Date().toISOString() };
    _save(db); _emit();
    return next;
  }
  function houseCardBy() { return (_load()._houseBy) || null; }

  /* ── A SET: what one surface shows in one region ──────────────────────────── */

  function emptySet(surface, region) {
    return { surface: surface, region: region || 'all', mode: 'carousel', items: [], state: 'draft' };
  }

  function get(surface, region) {
    var db = _load();
    var rec = db[_slot(surface, region)];
    if (!rec) return null;
    // A copy, so a screen cannot edit the store through what it is rendering.
    // ⚠️ REDUNDANT TODAY AND KEPT DELIBERATELY: _load() re-parses localStorage on
    // every call, so `rec` is already fresh and removing this line breaks no
    // test. It is the assertion that survives if _load() ever caches — which is
    // the obvious optimisation someone will reach for.
    return JSON.parse(JSON.stringify(rec));
  }

  /** The LIVE set, or null. This is what a customer-facing surface must read. */
  function live(surface, region) {
    var rec = get(surface, region);
    if (rec && rec.state === 'live') return rec;
    // Regional fallback: an unset region inherits the 'all' default, which is
    // what makes "one number until it isn't" workable.
    if (region && region !== 'all') {
      var d = get(surface, 'all');
      if (d && d.state === 'live') return d;
    }
    return null;
  }

  /**
   * Write a set. Returns the stored record, or null with nothing written.
   *
   * REFUSES rather than coerces, and every refusal is a real rule:
   *  · an unknown surface or a bad mode — a typo'd surface id is invisible
   *    otherwise, because an unknown surface renders nothing and looks exactly
   *    like a surface with nothing scheduled;
   *  · more items than the surface's capacity;
   *  · in weighted mode, shares that do not sum to 100 — a set that sums to 90
   *    silently under-delivers 10% of the slot and nobody set that.
   */
  function set(surface, region, patch, who) {
    var s = surfaceById(surface);
    if (!s) return null;
    var cur = get(surface, region) || emptySet(surface, region);
    var next = Object.assign({}, cur, patch || {});
    next.surface = surface; next.region = region || 'all';

    if (MODES.indexOf(next.mode) < 0) return null;
    if (STATES.indexOf(next.state) < 0) return null;
    if (!Array.isArray(next.items)) return null;
    if (next.items.length > s.cap) return null;

    if (next.mode === 'weighted' && next.items.length) {
      var sum = 0;
      for (var i = 0; i < next.items.length; i++) sum += Number(next.items[i].share) || 0;
      if (Math.round(sum) !== 100) return null;
    }

    next.by = { who: who || 'unknown', at: new Date().toISOString() };

    var db = _load();
    var slot = _slot(surface, region);
    var hist = (db[slot] && db[slot].history) || [];
    if (db[slot]) {
      var prev = Object.assign({}, db[slot]); delete prev.history;
      hist = [prev].concat(hist).slice(0, HISTORY_CAP);
    }
    next.history = hist;
    db[slot] = next;
    _save(db); _emit();
    return get(surface, region);
  }

  /** Roll back to a previous version. The rollback is itself a change, so it is
   *  attributed too — otherwise the record of who did what has a hole in it. */
  function rollback(surface, region, index, who) {
    var rec = get(surface, region);
    if (!rec || !rec.history || !rec.history[index]) return null;
    var target = rec.history[index];
    return set(surface, region, {
      mode: target.mode, items: target.items, state: target.state,
    }, who);
  }

  function history(surface, region) {
    var rec = get(surface, region);
    return rec && rec.history ? rec.history : [];
  }

  /** Every slot a marketer could fill, with whether it is filled. An EMPTY slot
   *  is a visible task rather than a silent gap. */
  function board() {
    var out = [];
    for (var i = 0; i < SURFACES.length; i++) {
      for (var r = 0; r < REGIONS.length; r++) {
        var rec = get(SURFACES[i].id, REGIONS[r]);
        out.push({
          surface: SURFACES[i].id, label: SURFACES[i].label, region: REGIONS[r],
          filled: !!(rec && rec.items && rec.items.length),
          state: rec ? rec.state : null,
          mode: rec ? rec.mode : null,
          by: rec ? rec.by : null,
        });
      }
    }
    return out;
  }

  function reset() { try { localStorage.removeItem(KEY); } catch (e) {} _emit(); }

  window.HWMerch = {
    SURFACES: SURFACES, REGIONS: REGIONS, MODES: MODES, STATES: STATES,
    surfaceById: surfaceById,
    houseCard: houseCard, setHouseCard: setHouseCard, houseCardBy: houseCardBy,
    get: get, live: live, set: set, rollback: rollback, history: history,
    board: board, reset: reset,
    isDemoStorage: function () { return true; },
    subscribe: function (fn) { _subs.add(fn); return function () { _subs.delete(fn); }; },
  };
})();
