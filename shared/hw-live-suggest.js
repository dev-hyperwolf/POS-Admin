// shared/hw-live-suggest.js — THE RANKING, delivered to the register.
//
// WHAT WAS MISSING, and it is one property.
// ----------------------------------------
// shared/hw-live-history.js publishes window.HW.purchaseHistory(key) and gets
// the THREE STATES right: skus [...] / [] / null for history / no_purchases /
// unknown. What it cannot do is ORDER that list — GET /api/customer/purchase-
// history returns the SIGNALS (ranking_input) and deliberately ranks nothing,
// because wmdemo/purchase_history.py's own docstring says two implementations
// of the ranking would drift. So `skus` arrives in ITEMS order.
//
// pos/screen-cart.jsx then lifts those skus onto the grid. Measured
// 2026-08-27: with items-order skus the customer's repeat purchase lands
// wherever the catalogue happens to put it. The ranking exists
// (wmdemo/suggestion_rank.py, GET /api/customer/suggestions — repeat purchase,
// then category affinity, then brand affinity) and simply never reached the
// screen.
//
// THIS FILE IS A WRAPPER, NOT A SECOND SEAM. Two files racing to own
// window.HW.purchaseHistory is the collision hw-live-lines.js's header warns
// about, and whichever <script> tag came last would silently win. So this one
// CAPTURES the existing accessor and delegates to it for every state, every
// refusal and every transient — it changes exactly one thing, the ORDER of
// `skus`, and only when the ranking route has actually answered for the same
// person. If this file does not load, the seam below it still works; if the
// route is unreachable, the unranked answer is returned unchanged rather than
// an empty one.
//
// IT ASKS BY `subject.identity_id` AND NOTHING ELSE. That id comes back inside
// the answer the history seam already resolved, so this file duplicates no key
// parsing, re-derives no binding, and cannot disagree with the seam about WHO
// is being asked about. Where the history answer carries no identity_id (the
// unbound-single-account scope), it returns that answer untouched rather than
// guessing a person.
//
// IT NEVER INVENTS AN ORDER. If the ranking route has not answered yet, the
// wrapped answer is returned exactly as-is and `ranked` is false — a list in
// catalogue order labelled as unranked, never a made-up ordering.
//
// PUBLIC SURFACE, on window.HW (mutated in place, never reassigned):
//   HW.purchaseHistory(key)  — the wrapped accessor, `skus` ranked when known
//   HW.SUGGESTIONS           — { cacheKey: <the /api/customer/suggestions body> }
//   HW.suggestions(key)      — the full ranked payload: tiers, per-row
//                              evidence, basis_effective, basis_shifted,
//                              basis_sentence_effective, coverage
// and window.HW_SUGGEST = { status, route, get, enable, disable }.
(function () {
  'use strict';

  var W = typeof window !== 'undefined' ? window : null;
  if (!W) { return; }

  var ROUTE = '/api/customer/suggestions';
  var _rank = {};        // identity_id -> ranked payload
  var _err = {};         // identity_id -> { code, message }
  var _inflight = {};
  var _hw = null, _tries = 0;
  var armed = true;
  var _prev = null;      // the accessor this file wraps

  function base() {
    // Same-origin. A loopback page talking to the dev server is the only case
    // that needs an explicit origin, and hw-live-history.js already made that
    // call for this estate; this file follows it rather than inventing a
    // second rule.
    try {
      if (W.HW_HISTORY && W.HW_HISTORY.base) { return W.HW_HISTORY.base; }
    } catch (e) {}
    return '';
  }

  function getJSON(path) {
    return W.fetch(base() + path, { credentials: 'same-origin' })
      .then(function (res) {
        return res.json().then(function (body) {
          return { ok: res.ok, status: res.status, body: body };
        }, function () {
          return { ok: false, status: res.status, body: null };
        });
      });
  }

  function fetchRank(identityId) {
    var k = String(identityId);
    if (_inflight[k]) { return _inflight[k]; }
    _inflight[k] = getJSON(ROUTE + '?identity_id=' + encodeURIComponent(k))
      .then(function (r) {
        delete _inflight[k];
        if (!r.ok || !r.body) {
          // A REFUSAL IS RECORDED, NEVER SWALLOWED INTO "no ranking". The
          // wrapped accessor still answers; this only means the order stays
          // the seam's own.
          _err[k] = { code: (r.body && r.body.code) || ('http_' + r.status),
                      message: (r.body && r.body.error) || 'the ranking route did not answer' };
          return null;
        }
        _rank[k] = r.body;
        try { if (W.HW_HISTORY && W.HW_HISTORY.rerender) { W.HW_HISTORY.rerender(); } } catch (e) {}
        return r.body;
      })
      .catch(function (e) {
        delete _inflight[k];
        _err[k] = { code: 'unreachable', message: String((e && e.message) || e) };
        return null;
      });
    return _inflight[k];
  }

  /**
   * The wrapped accessor. Delegates for everything except the ORDER of `skus`.
   *
   * The three states are the seam's, untouched — this file never turns a null
   * into an empty array or an empty array into a list, which is the collapse
   * both modules exist to prevent.
   */
  function wrapped(key) {
    var answer = _prev ? _prev(key) : null;
    if (!answer || typeof answer !== 'object') { return answer; }
    if (!armed) { return answer; }
    // ONLY a positive history has an order worth applying. no_purchases has
    // nothing to order, and unknown must not acquire a list from anywhere.
    if (answer.state !== 'history') { return answer; }
    if (!answer.skus || !answer.skus.length) { return answer; }

    var id = answer.subject && answer.subject.identity_id;
    if (id === null || id === undefined) {
      // No person id on the answer (the unbound single-account scope). Return
      // the seam's answer untouched rather than guessing whose ranking to use.
      return shallow(answer, { ranked: false,
        ranked_note: 'this answer carries no identity_id, so the ranking route '
          + 'was not asked and `skus` is in items order' });
    }

    var k = String(id);
    if (!Object.prototype.hasOwnProperty.call(_rank, k)) {
      if (!_err[k]) { fetchRank(k); }
      return shallow(answer, { ranked: false,
        ranked_note: _err[k]
          ? 'the ranking route refused (' + _err[k].code + '), so `skus` is in '
            + 'items order and NOT ranked'
          : 'the ranking has not come back yet, so `skus` is in items order and '
            + 'NOT ranked' });
    }

    var payload = _rank[k];
    var order = [];
    (payload.ranked || []).forEach(function (row) {
      if (row && row.sku) { order.push(row.sku); }
    });
    if (!order.length) {
      return shallow(answer, { ranked: false,
        ranked_note: 'the ranking route ranked nothing for this customer ('
          + (payload.basis_sentence_effective || 'no basis') + '), so `skus` is '
          + 'in items order' });
    }

    // INTERSECTION, ORDERED BY THE RANKING. A sku the seam did not return is
    // NOT added here — the ranking covers the whole catalogue and the seam's
    // list is what this person actually bought. Their own products come back in
    // ranked order; anything the ranking did not mention keeps its place after
    // them rather than being dropped.
    var pos = Object.create(null);
    order.forEach(function (s, i) {
      if (!Object.prototype.hasOwnProperty.call(pos, s)) { pos[s] = i; }
    });
    var ranked = [], rest = [];
    answer.skus.forEach(function (s) {
      if (Object.prototype.hasOwnProperty.call(pos, s)) { ranked.push(s); } else { rest.push(s); }
    });
    ranked.sort(function (a, b) { return pos[a] - pos[b]; });

    return shallow(answer, {
      skus: ranked.concat(rest),
      ranked: true,
      ranked_by: payload.basis_effective || null,
      ranked_note: (rest.length
        ? rest.length + ' of this customer’s products are not in the '
          + 'sellable catalogue the ranking covers; they keep their place after '
          + 'the ranked ones rather than being dropped.'
        : null),
      // The label the register prints. It describes the list on screen, which
      // is not always the list the customer's signals asked for — see
      // basis_shifted in wmdemo/suggestion_rank.py.
      basis_sentence_effective: payload.basis_sentence_effective || null,
      basis_effective: payload.basis_effective || null,
      basis_shifted: !!payload.basis_shifted,
      source: (answer.source || ROUTE) + ' + ' + ROUTE + ' ('
        + (payload.basis_effective || 'unranked') + ')'
    });
  }

  function shallow(obj, extra) {
    var out = {};
    Object.keys(obj).forEach(function (k) { out[k] = obj[k]; });
    Object.keys(extra).forEach(function (k) { out[k] = extra[k]; });
    return out;
  }

  /** The full ranked payload, for a screen that wants the tiers and evidence. */
  function suggestions(key) {
    var answer = _prev ? _prev(key) : null;
    if (!answer || typeof answer !== 'object') {
      return { state: 'no_seam', state_reason: 'the purchase-history seam is not loaded' };
    }
    var id = answer.subject && answer.subject.identity_id;
    if (id === null || id === undefined) {
      return { state: answer.state, state_reason: answer.state_reason || null,
        ranked: null,
        note: 'no identity_id on this answer, so no ranking was requested' };
    }
    var k = String(id);
    if (Object.prototype.hasOwnProperty.call(_rank, k)) { return _rank[k]; }
    if (_err[k]) {
      return { state: 'unavailable', state_code: _err[k].code,
        state_reason: _err[k].message };
    }
    fetchRank(k);
    return { state: 'loading', state_reason: 'ranking this customer’s suggestions' };
  }

  function publish() {
    if (W.HW && typeof W.HW === 'object') {
      _hw = W.HW;
      if (typeof _hw.purchaseHistory !== 'function') {
        // The seam this wraps has not published yet. Wait for it rather than
        // installing a wrapper around nothing.
        if (_tries++ > 200) { return; }
        return void setTimeout(publish, 50);
      }
      if (_hw.__suggestWrapped) { return; }
      _prev = _hw.purchaseHistory;
      try {
        // IN-PLACE mutation, never a reassignment — hw-live.js's rule.
        _hw.purchaseHistory = wrapped;
        _hw.suggestions = suggestions;
        _hw.SUGGESTIONS = _rank;
        _hw.__suggestWrapped = true;
      } catch (e) {}
      return;
    }
    if (_tries++ > 200) { return; }
    setTimeout(publish, 50);
  }

  W.HW_SUGGEST = {
    route: ROUTE,
    get: function (id) { return _rank[String(id)] || null; },
    status: function () {
      return { armed: armed, wrapped: !!_prev, ranked_keys: Object.keys(_rank),
               errors: _err };
    },
    enable: function () { armed = true; },
    disable: function () { armed = false; }
  };

  publish();
})();
