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

// ── THE CART-PAIRING LANE, delivered to the register's cart ─────────────────
//
// WHAT THIS IS. `wmdemo/reco/core.py` publishes two lanes. `for_guest` ranks
// over the PERSON and reaches this estate through the wrapper above. This
// second block is the other one — `pairs_with_cart`, which answers "what goes
// with what is already on the counter" — and it is the lane the in-cart
// suggestion cards were asked to show.
//
// ⚠️ THERE IS NO HTTP ROUTE FOR IT. Verified 2026-08-27, not assumed: wmdemo/
// reco/ is a Python package (core.py, serve.py, build.py, fit.py) with a
// `recommend()` entry point, and `grep -n reco wmdemo/server.py` matches only
// `/api/reconcile`. Nothing serves `core.rank` over the wire. So this seam
// names the route it needs, asks for it ONCE, and renders the 404 as what it
// is — a deployment fact, under its own code — rather than as a fact about the
// cart. When the route lands, the screen lights up with no other change.
//
// ⚠️ SUBSTITUTES ARE NEVER PROMOTED INTO PAIRINGS. The lane's own comment is
// the specification: on today's order data every co-occurrence pair is
// eliminated (187 of 191 multi-item baskets belong to ONE synthetic account),
// so it returns `no_cooccurrence_evidence` and hands the attribute-similar
// products back under a separate `substitutes` key. This seam COUNTS them and
// passes the count through so the screen can say how many exist. It does not
// put one of them in `items`, and it never asks the route for
// `allow_substitutes`. A thing you could buy INSTEAD is not a thing that goes
// WITH — rendering one as the other is the exact defect the lane was built to
// refuse.
//
// ⚠️ POPULARITY IS NOT A FALLBACK. There is no bestseller branch here at all.
// A refusal returns a refusal; the caller renders it.
//
// PUBLIC SURFACE, on window.HW (mutated in place, never reassigned):
//   HW.cartPairings(skus)  — never null. One of five states, below.
// and window.HW_CART_PAIRS = { status, route, get, enable, disable, reset }.
//
// THE FIVE STATES, KEPT APART, for the same reason hw-live-history.js keeps
// its three apart — an absence that renders as an answer is this codebase's
// signature defect:
//   'empty'        nothing on the counter, so the lane has no question
//   'loading'      asked, not yet answered. Nothing is claimed.
//   'pairs'        the lane answered and found co-occurrence evidence
//   'refused'      the lane answered and REFUSED, with its own code+sentence
//   'unavailable'  we never reached the lane (no route, no fetch, network)
(function () {
  'use strict';

  var W = typeof window !== 'undefined' ? window : null;
  if (!W) { return; }

  var ROUTE = '/api/reco/pairs-with-cart';
  var _byCart = {};      // cartKey -> the route's own payload
  var _errByCart = {};   // cartKey -> { code, message }
  var _inflight = {};
  var _dead = null;      // set once the route proves absent; stops all fetching
  var _hw = null, _tries = 0;
  var armed = true;

  function base() {
    try {
      if (W.HW_HISTORY && W.HW_HISTORY.base) { return W.HW_HISTORY.base; }
    } catch (e) {}
    return '';
  }

  /** The cart, normalised to a stable key. Order must not change the answer. */
  function keyOf(skus) {
    var seen = Object.create(null), out = [];
    (skus || []).forEach(function (s) {
      var k = String(s == null ? '' : s).trim();
      if (!k || Object.prototype.hasOwnProperty.call(seen, k)) { return; }
      seen[k] = 1; out.push(k);
    });
    out.sort();
    return out;
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

  /**
   * Repaint after ANY terminal outcome — the refusals and the failures too, not
   * just the answers.
   *
   * The wrapper above only repaints on success, and it can afford to: its
   * caller re-reads on every customer change anyway. This one cannot. A cart
   * that is asked once, fails, and never repaints leaves 'Asking…' on the
   * screen for the rest of the sale — a spinner that never resolves is the same
   * defect as an empty card, wearing a more reassuring face.
   */
  var _subs = [];
  function bump() {
    // The direct subscribers first. A React card mounted on its own root is NOT
    // reachable through HW_LIVE.rerender (which re-renders #root and nothing
    // else), so a seam that only bumped the app root would leave that card
    // spinning — and the POS mounts screens on their own hosts in three places.
    for (var i = 0; i < _subs.length; i++) { try { _subs[i](); } catch (e) {} }
    try {
      if (W.HW_HISTORY && typeof W.HW_HISTORY.rerender === 'function') {
        return void W.HW_HISTORY.rerender();
      }
      if (W.HW_LIVE && typeof W.HW_LIVE.rerender === 'function') {
        W.HW_LIVE.rerender();
      }
    } catch (e) {}
  }

  function fetchPairs(list, key) {
    if (_inflight[key]) { return _inflight[key]; }
    // `allow_substitutes` is deliberately NOT sent. See the header.
    var qs = ROUTE + '?cart=' + encodeURIComponent(list.join(','));
    _inflight[key] = getJSON(qs)
      .then(function (r) {
        delete _inflight[key];
        if (!r.ok || !r.body) {
          // A 404 is not a fact about this cart, and it will be a 404 for every
          // other cart too. Record it ONCE and stop asking — a rail that fires
          // a failing request on every keystroke is its own outage.
          if (r.status === 404 || r.status === 501) {
            _dead = { code: 'route_missing',
              message: 'no ' + ROUTE + ' on this server. The pairs_with_cart '
                + 'lane exists in wmdemo/reco/core.py and nothing serves it over '
                + 'HTTP yet, so the cart has not been asked — this is a '
                + 'deployment fact, not a fact about what is on the counter.' };
            bump();
            return null;
          }
          _errByCart[key] = {
            code: (r.body && r.body.code) || ('http_' + r.status),
            message: (r.body && r.body.error) || 'the pairing route did not answer' };
          bump();
          return null;
        }
        _byCart[key] = r.body;
        bump();
        return r.body;
      })
      .catch(function (e) {
        delete _inflight[key];
        _errByCart[key] = { code: 'unreachable',
          message: String((e && e.message) || e) };
        bump();
        return null;
      });
    return _inflight[key];
  }

  /** How many substitutes the lane found, without ever returning one. */
  function subCount(payload) {
    var meta = (payload && payload.meta && payload.meta.cart) || null;
    if (meta && typeof meta.substitutes_found === 'number') { return meta.substitutes_found; }
    return Array.isArray(payload && payload.substitutes) ? payload.substitutes.length : 0;
  }

  /**
   * cartPairings(skus) → the lane's answer, ALWAYS an object.
   *
   * `items` is populated in exactly one state ('pairs') and is `[]` in every
   * other. There is no branch that borrows a list from anywhere else.
   */
  function cartPairings(skus) {
    var list = keyOf(skus);
    if (!list.length) {
      return { state: 'empty', code: 'cart_empty', items: [], substitutes_found: 0,
        route: ROUTE,
        sentence: 'Nothing is on the counter yet, so there is nothing to pair '
          + 'with. This lane answers “what goes with what is in the cart”.' };
    }
    if (!armed) {
      return { state: 'unavailable', code: 'disarmed', items: [], substitutes_found: 0,
        route: ROUTE,
        sentence: 'The cart-pairing lane is switched off for this session, so '
          + 'the cart was not asked. Nothing is being claimed about it.' };
    }
    if (!W.fetch) {
      return { state: 'unavailable', code: 'no_fetch', items: [], substitutes_found: 0,
        route: ROUTE,
        sentence: 'This page has no fetch, so ' + ROUTE + ' was never asked. '
          + 'Nothing is being claimed about what is on the counter.' };
    }
    if (_dead) {
      return { state: 'unavailable', code: _dead.code, items: [], substitutes_found: 0,
        route: ROUTE, sentence: _dead.message };
    }

    var key = list.join(',');
    // AN ANSWER OUTRANKS A RECORDED FAILURE, and the order of these two checks
    // is the whole of that rule. With the error checked first, one transient
    // 503 pinned this cart to 'unavailable' for the life of the page — a later
    // successful answer for the SAME cart was sitting in `_byCart` and could
    // never be read. Found by the seeded-refusal test, which is the shape a
    // retry or a route coming up mid-sale takes.
    if (!Object.prototype.hasOwnProperty.call(_byCart, key) && _errByCart[key]) {
      return { state: 'unavailable', code: _errByCart[key].code, items: [],
        substitutes_found: 0, route: ROUTE,
        sentence: 'The pairing lane could not be reached ('
          + _errByCart[key].code + ') — ' + _errByCart[key].message
          + '. Nothing was ranked and nothing is being claimed about this cart.' };
    }
    if (!Object.prototype.hasOwnProperty.call(_byCart, key)) {
      fetchPairs(list, key);
      return { state: 'loading', code: 'loading', items: [], substitutes_found: 0,
        route: ROUTE, cart: list,
        sentence: 'Asking what pairs with the ' + list.length + ' item'
          + (list.length === 1 ? '' : 's') + ' on the counter… nothing is ranked '
          + 'yet, and nothing is being claimed.' };
    }

    var payload = _byCart[key];
    var subs = subCount(payload);

    // A REFUSAL IS THE LANE'S OWN WORDS, CARRIED THROUGH UNCHANGED. This seam
    // does not summarise it, soften it, or substitute a sentence of its own —
    // the nine codes in core.py's docstring are the vocabulary, and the screen
    // renders whichever one came back.
    if (payload && payload.recommends === false) {
      var ref = payload.refusal || {};
      return { state: 'refused', code: ref.code || 'refused', items: [],
        substitutes_found: subs, route: ROUTE, cart: list,
        basis: payload.basis || 'refused',
        sentence: ref.sentence || payload.basis_sentence
          || 'the pairing lane refused and gave no sentence' };
    }

    var items = Array.isArray(payload && payload.items) ? payload.items : [];
    if (!items.length) {
      // `recommends: true` with an empty list is not a state core.py produces,
      // so it means the payload is not the shape this seam was built for.
      // Saying so beats rendering an empty rail that looks like "no matches".
      return { state: 'unavailable', code: 'malformed_payload', items: [],
        substitutes_found: subs, route: ROUTE, cart: list,
        sentence: ROUTE + ' answered without a refusal and without any items, '
          + 'which is not a shape this lane produces. Nothing was rendered '
          + 'rather than guessing what it meant.' };
    }

    // PAIRINGS ONLY. `cart_item_item` is the co-occurrence contribution — the
    // one piece of evidence that two products were actually bought TOGETHER.
    // A row the lane scored purely on attribute similarity is a substitute
    // wearing the list's heading, so it is dropped here even on the happy path.
    var paired = items.filter(function (it) {
      return (it.contributions || []).some(function (c) {
        return c && c.source === 'cart_item_item';
      });
    });
    if (!paired.length) {
      return { state: 'refused', code: 'no_cooccurrence_evidence', items: [],
        substitutes_found: subs || items.length, route: ROUTE, cart: list,
        basis: 'refused',
        sentence: 'The lane returned ' + items.length + ' product'
          + (items.length === 1 ? '' : 's') + ' and not one of them has ever '
          + 'been observed being bought together with anything in this cart. '
          + 'Those are SUBSTITUTES, not pairings, so none was shown under a '
          + 'heading that claims they go with it.' };
    }

    return { state: 'pairs', code: 'pairs', items: paired,
      substitutes_found: subs, route: ROUTE, cart: list,
      basis: payload.basis || null,
      pairings_found: (payload.meta && payload.meta.cart
        && payload.meta.cart.pairings_found) || paired.length,
      sentence: payload.basis_sentence || null };
  }

  function publish() {
    if (W.HW && typeof W.HW === 'object') {
      _hw = W.HW;
      if (_hw.__cartPairsWrapped) { return; }
      try {
        // IN-PLACE mutation, never a reassignment — hw-live.js's rule.
        _hw.cartPairings = cartPairings;
        _hw.__cartPairsWrapped = true;
      } catch (e) {}
      return;
    }
    if (_tries++ > 200) { return; }
    setTimeout(publish, 50);
  }

  W.HW_CART_PAIRS = {
    route: ROUTE,
    /** subscribe(fn) → unsubscribe. Fired after EVERY terminal outcome. */
    subscribe: function (fn) {
      if (typeof fn !== 'function') { return function () {}; }
      _subs.push(fn);
      return function () {
        var i = _subs.indexOf(fn);
        if (i >= 0) { _subs.splice(i, 1); }
      };
    },
    get: function (skus) { return _byCart[keyOf(skus).join(',')] || null; },
    status: function () {
      return { armed: armed, dead: _dead, carts: Object.keys(_byCart),
               errors: _errByCart };
    },
    enable: function () { armed = true; },
    disable: function () { armed = false; },
    reset: function () { _byCart = {}; _errByCart = {}; _inflight = {}; _dead = null; },
    /** For a caller that wants to drive the lane without a route (tests, a
     *  console session). It stores a REAL core.rank payload; every guard above
     *  still runs over it, so a seeded substitutes-only answer still refuses. */
    seed: function (skus, payload) {
      // It seeds an ANSWER and does not clear a recorded failure — deliberately.
      // Clearing it here would hide the ordering rule in cartPairings (an answer
      // outranks a recorded failure) behind this helper, and that rule is the
      // one a retry or a route coming up mid-sale depends on.
      _byCart[keyOf(skus).join(',')] = payload;
      bump();
    }
  };

  publish();
})();
