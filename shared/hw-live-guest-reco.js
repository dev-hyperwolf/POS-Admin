// shared/hw-live-guest-reco.js — LOOK-ALIKE + PERSONAL RECOMMENDATIONS for a
// known customer, delivered to the register's cart.
//
// WHAT THIS IS. `wmdemo/reco/core.py` publishes two lanes. `pairs_with_cart`
// (shared/hw-live-suggest.js, second block) answers "what goes with what is
// on the counter". This file is the OTHER lane — `for_guest`, GET
// /api/reco/for-guest — which answers "what might THIS PERSON want", ranked
// on their own repeat purchases first and, when that is thin, on guests who
// behave like them (a k-means cohort over category mix, wmdemo/reco/fit.py).
//
// ⚠️ A STALE COMMENT IN hw-live-suggest.js CLAIMED THE for_guest LANE "reaches
// this estate through the wrapper above". That was never true — the wrapper
// there calls GET /api/customer/suggestions (suggestion_rank.py: repeat
// purchase, then category affinity, then brand affinity), a DIFFERENT engine
// with no cohort/look-alike step at all. Nothing called core.py's for_guest
// lane before this file. Confirmed by grep before writing this: the only hit
// for `for_guest`/`for-guest` anywhere under POS-Admin was that one comment.
//
// ⚠️ ASSIGN_COHORT WILL LEGITIMATELY REFUSE FOR ALMOST EVERYONE ON REAL DATA
// TODAY. Measured 2026-08-27 in wmdemo/reco/fit.py: 369 of 371 placeable
// guests share the IDENTICAL category-mix vector (100% flower), so
// `_fit_cohorts` finds no second group to distinguish and emits ZERO cohorts
// — `meta.cohort.code` comes back `no_cohorts_in_model` for nearly everyone.
// That is a data-sparsity fact, not a bug, and it is NOT the same as the
// whole lane refusing: a guest with their own purchase history typically still
// gets a personalised list (basis `own_purchases`) or the house-brand/
// popularity fallback (basis `not_personalised`) even with no cohort at all.
// This seam therefore carries `cohort` on EVERY answer it can — ranked or
// refused — so a screen can say "no look-alike group yet" honestly without
// that ever being confused with "no recommendation at all".
//
// ⚠️ IT ASKS BY THE SUBJECT THE HISTORY SEAM ALREADY RESOLVED, AND NOTHING
// ELSE — same rule as hw-live-suggest.js's ranking wrapper, for the same
// reason: `window.HW.purchaseHistory(customer)` already ran the identity-merge
// rule (hw_identities.wm_ids, not wm_customer_mapping — see
// wmdemo/purchase_history.py) and resolved exactly one subject or refused.
// Re-deriving that here would be a second copy of a merge rule this estate has
// already watched drift once. `subject.asked_by` + `subject.asked_for` are
// replayed verbatim as the query key, so this route cannot name a different
// person than the one the history card is showing.
//
// A 409 IS READ, NEVER THROWN AWAY. `/api/reco/for-guest` can refuse an
// ambiguous identity exactly like /api/customer/purchase-history does (only
// the guest lane can raise it — the cart lane never resolves a person at
// all). When the history seam ALREADY cached that refusal for this same
// subject, this file reads it back rather than spending a second round trip
// to relearn the same fact.
//
// PUBLIC SURFACE, on window.HW (mutated in place, never reassigned):
//   HW.guestRecommendations(customer) — never null. One of SEVEN states below.
// and window.HW_GUEST_RECO = { status, route, get, subscribe, enable,
//   disable, reset, seed }.
//
// THE SEVEN STATES, KEPT APART, for the same reason every other seam in this
// file set keeps its states apart — an absence rendering as an answer is this
// codebase's signature defect:
//   'no-customer'  nobody is on this ticket, or the customer carries none of
//                  identity_id / pos_customer_id / wm_customer_id (a mock
//                  MEMBERS row, not a real key — see hw-live-history.js)
//   'loading'      asked (history, then the recommender), not yet answered
//   'ranked'       the lane answered with recommends:true and at least 1 item
//   'refused'      the lane answered with recommends:false — a NORMAL,
//                  first-class result (see core.py's ten refusal codes)
//   'ambiguous'    the identity has no single answer (409, same idiom as
//                  wm_id_on_multiple_identities on the history route)
//   'unavailable'  the route is missing, unreachable, malformed, or the
//                  history it depends on could not be read either
(function () {
  'use strict';

  var W = typeof window !== 'undefined' ? window : null;
  if (!W) { return; }

  var ROUTE = '/api/reco/for-guest';
  var _byKey = {};       // 'asked_by=asked_for' -> the route's own payload
  var _errByKey = {};    // same key -> { code, message } (network/http)
  var _ambiguous = {};   // same key -> the 409 body (code, error, extra)
  var _inflight = {};
  var _dead = null;      // set once the route proves absent; stops all fetching
  var _hw = null, _tries = 0;
  var armed = true;

  function base() {
    // Same-origin rule as every other seam here — hw-live-history.js already
    // made the loopback-only call for an explicit override and this file
    // follows it rather than inventing a second one.
    try {
      if (W.HW_HISTORY && W.HW_HISTORY.base) { return W.HW_HISTORY.base; }
    } catch (e) {}
    return '';
  }

  var _subs = [];
  function bump() {
    // Direct subscribers first — a card mounted on its own root is not
    // reachable through HW_HISTORY.rerender alone, same reasoning as
    // HW_CART_PAIRS.subscribe in hw-live-suggest.js.
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

  // core.py's `limit` defaults to unbounded when omitted -- `_finish()` only
  // truncates `if limit:` -- so an unqualified fetch here returned every
  // scored candidate up to the 400-product retrieval bound (confirmed live
  // against the scratch test server: 400 items for one ordinary guest). A
  // cart card rendering all 400 would be both wasteful and unreadable; ASK
  // for a sane page size rather than truncating client-side after the fact.
  var PAGE_LIMIT = 8;

  function fetchReco(askedBy, askedFor, key) {
    if (_inflight[key]) { return _inflight[key]; }
    var qs = ROUTE + '?' + askedBy + '=' + encodeURIComponent(askedFor)
      + '&limit=' + PAGE_LIMIT;
    _inflight[key] = getJSON(qs)
      .then(function (r) {
        delete _inflight[key];
        if (r.status === 409) {
          // AN AMBIGUOUS IDENTITY, READ AND KEPT — not merged into a generic
          // failure. Same body shape as the history route's own 409s
          // (purchase_history.Refused.as_dict(): error, code, + extras).
          _ambiguous[key] = r.body || { code: 'refused',
            error: 'this customer’s identity has no single answer' };
          bump();
          return null;
        }
        if (!r.ok || !r.body) {
          if (r.status === 404 || r.status === 501) {
            _dead = { code: 'route_missing',
              message: 'no ' + ROUTE + ' on this server. The for_guest lane '
                + 'exists in wmdemo/reco/core.py and nothing served it over '
                + 'HTTP until this route was wired — this is a deployment '
                + 'fact, not a fact about this guest.' };
            bump();
            return null;
          }
          _errByKey[key] = { code: (r.body && r.body.code) || ('http_' + r.status),
            message: (r.body && r.body.error) || 'the recommender did not answer' };
          bump();
          return null;
        }
        _byKey[key] = r.body;
        bump();
        return r.body;
      })
      .catch(function (e) {
        delete _inflight[key];
        _errByKey[key] = { code: 'unreachable',
          message: String((e && e.message) || e) };
        bump();
        return null;
      });
    return _inflight[key];
  }

  /**
   * guestRecommendations(customer) -> the lane's answer, ALWAYS an object.
   *
   * Depends on window.HW.purchaseHistory (shared/hw-live-history.js) for the
   * identity resolution ONLY — see the file header for why re-deriving it
   * here would be a second copy of a merge rule.
   */
  function guestRecommendations(customer) {
    if (!W.HW || typeof W.HW.purchaseHistory !== 'function') {
      return { state: 'unavailable', code: 'no_history_seam', items: [],
        route: ROUTE, cohort: null,
        sentence: 'shared/hw-live-history.js is not loaded, so nobody could '
          + 'be identified and ' + ROUTE + ' was never asked.' };
    }

    var hist;
    try { hist = W.HW.purchaseHistory(customer); } catch (e) {
      return { state: 'unavailable', code: 'history_seam_threw', items: [],
        route: ROUTE, cohort: null,
        sentence: 'the purchase-history seam threw (' + ((e && e.message) || e)
          + '), so nobody could be identified.' };
    }
    if (!hist || typeof hist !== 'object') {
      return { state: 'no-customer', code: 'no_key', items: [], route: ROUTE,
        cohort: null,
        sentence: 'No customer is on this ticket, so there is nobody to '
          + 'recommend for.' };
    }

    // NO KEY, NO QUESTION. A mock MEMBERS row carries none of identity_id /
    // pos_customer_id / wm_customer_id (see hw-live-history.js's own note on
    // why `customer.id` is deliberately not accepted there), and this file
    // asks by nothing else.
    if (hist.state === 'no_key') {
      return { state: 'no-customer', code: hist.state_code || 'no_key',
        items: [], route: ROUTE, cohort: null,
        sentence: hist.state_reason
          || 'This customer carries no identity_id, pos_customer_id or '
             + 'wm_customer_id, so there is nobody to recommend for.' };
    }
    if (hist.state === 'off') {
      return { state: 'unavailable', code: 'history_seam_off', items: [],
        route: ROUTE, cohort: null, sentence: hist.state_reason
          || 'the purchase-history seam is switched off' };
    }
    if (hist.state === 'loading') {
      return { state: 'loading', code: 'loading', items: [], route: ROUTE,
        cohort: null,
        sentence: 'Reading this customer’s purchase history before '
          + 'asking for recommendations…' };
    }
    if (hist.state === 'unavailable') {
      // hist.refusal carries the 409 body when the HISTORY route itself
      // refused an ambiguous identity. It is the SAME refusal this route
      // would give for the same person, so it is surfaced here rather than
      // spending a second round trip to relearn it.
      if (hist.refusal && hist.refusal.code) {
        return { state: 'ambiguous', code: hist.refusal.code, items: [],
          route: ROUTE, cohort: null,
          sentence: hist.refusal.error
            || 'this customer’s identity has no single answer, so '
               + 'nothing was recommended.' };
      }
      return { state: 'unavailable', code: hist.state_code || 'history_unavailable',
        items: [], route: ROUTE, cohort: null,
        sentence: hist.state_reason
          || 'the purchase-history route could not be reached, so nothing '
             + 'was recommended.' };
    }

    // 'history' | 'no_purchases' | 'unknown' all carry a resolved `subject`
    // (resolve_subject() runs, and succeeds, before the state is decided).
    // 'unknown' (history_unreadable) is NOT special-cased here: it flows
    // through to the fetch below exactly like the other two, and core.py's
    // own for_guest lane turns it into the `history_unreadable` REFUSAL —
    // this file does not pre-empt the engine's own vocabulary.
    var subj = hist.subject || null;
    if (!subj || !subj.asked_by || subj.asked_for == null) {
      return { state: 'unavailable', code: 'no_subject', items: [],
        route: ROUTE, cohort: null,
        sentence: 'the purchase-history route answered without naming who '
          + 'it read, so ' + ROUTE + ' was never asked.' };
    }
    var key = subj.asked_by + '=' + subj.asked_for;

    if (!armed) {
      return { state: 'unavailable', code: 'disarmed', items: [], route: ROUTE,
        subject: subj, cohort: null,
        sentence: 'The guest-recommendation lane is switched off for this '
          + 'session, so nobody was asked about.' };
    }
    if (!W.fetch) {
      return { state: 'unavailable', code: 'no_fetch', items: [], route: ROUTE,
        subject: subj, cohort: null,
        sentence: 'This page has no fetch, so ' + ROUTE + ' was never asked.' };
    }
    if (_dead) {
      return { state: 'unavailable', code: _dead.code, items: [], route: ROUTE,
        subject: subj, cohort: null, sentence: _dead.message };
    }
    if (_ambiguous[key]) {
      var amb = _ambiguous[key];
      return { state: 'ambiguous', code: amb.code || 'refused', items: [],
        route: ROUTE, subject: subj, cohort: null,
        sentence: amb.error
          || 'this customer’s identity has no single answer, so nothing '
             + 'was recommended.' };
    }
    // AN ANSWER OUTRANKS A RECORDED FAILURE — same ordering rule and same
    // reason as HW_CART_PAIRS.cartPairings: a later successful answer for the
    // same key must not stay pinned to an earlier transient error.
    if (!Object.prototype.hasOwnProperty.call(_byKey, key) && _errByKey[key]) {
      return { state: 'unavailable', code: _errByKey[key].code, items: [],
        route: ROUTE, subject: subj, cohort: null,
        sentence: 'The recommender could not be reached ('
          + _errByKey[key].code + ') — ' + _errByKey[key].message
          + '. Nothing was ranked and nothing is being claimed about this '
          + 'guest.' };
    }
    if (!Object.prototype.hasOwnProperty.call(_byKey, key)) {
      fetchReco(subj.asked_by, subj.asked_for, key);
      return { state: 'loading', code: 'loading', items: [], route: ROUTE,
        subject: subj, cohort: null,
        sentence: 'Asking what to recommend for this guest… nothing is '
          + 'ranked yet, and nothing is being claimed.' };
    }

    var payload = _byKey[key];
    var cohort = (payload && payload.meta && payload.meta.cohort) || null;

    // A REFUSAL IS THE LANE'S OWN WORDS, CARRIED THROUGH UNCHANGED — same
    // rule as HW_CART_PAIRS. This file does not summarise, soften, or invent
    // a friendlier sentence than the one core.py wrote.
    if (payload && payload.recommends === false) {
      var ref = payload.refusal || {};
      return { state: 'refused', code: ref.code || 'refused', items: [],
        route: ROUTE, subject: subj, cohort: cohort,
        basis: payload.basis || 'refused',
        sentence: ref.sentence || payload.basis_sentence
          || 'the recommender refused and gave no sentence' };
    }

    var items = Array.isArray(payload && payload.items) ? payload.items : [];
    if (!items.length) {
      // `recommends: true` with zero items is not a shape core.py's for_guest
      // lane produces (see `_rank_guest`: an empty `scored` list always
      // returns a refusal). Saying so beats rendering an empty rail that
      // looks like "we looked and found nothing".
      return { state: 'unavailable', code: 'malformed_payload', items: [],
        route: ROUTE, subject: subj, cohort: cohort,
        sentence: ROUTE + ' answered without a refusal and without any '
          + 'items, which is not a shape this lane produces. Nothing was '
          + 'rendered rather than guessing what it meant.' };
    }

    return { state: 'ranked', code: 'ranked', items: items, route: ROUTE,
      subject: subj, cohort: cohort,
      personalised: !!(payload && payload.personalised),
      basis: (payload && payload.basis) || null,
      sentence: (payload && payload.basis_sentence) || null };
  }

  function publish() {
    if (W.HW && typeof W.HW === 'object') {
      _hw = W.HW;
      if (_hw.__guestRecoWrapped) { return; }
      try {
        // IN-PLACE mutation, never a reassignment — hw-live.js's rule.
        _hw.guestRecommendations = guestRecommendations;
        _hw.__guestRecoWrapped = true;
      } catch (e) {}
      return;
    }
    if (_tries++ > 200) { return; }
    setTimeout(publish, 50);
  }

  W.HW_GUEST_RECO = {
    route: ROUTE,
    /** subscribe(fn) -> unsubscribe. Fired after EVERY terminal outcome. */
    subscribe: function (fn) {
      if (typeof fn !== 'function') { return function () {}; }
      _subs.push(fn);
      return function () {
        var i = _subs.indexOf(fn);
        if (i >= 0) { _subs.splice(i, 1); }
      };
    },
    get: function (askedBy, askedFor) { return _byKey[askedBy + '=' + askedFor] || null; },
    status: function () {
      return { armed: armed, dead: _dead, keys: Object.keys(_byKey),
               errors: _errByKey, ambiguous: Object.keys(_ambiguous) };
    },
    enable: function () { armed = true; },
    disable: function () { armed = false; },
    reset: function () { _byKey = {}; _errByKey = {}; _ambiguous = {}; _inflight = {}; _dead = null; },
    /** For a caller that wants to drive the lane without a route (tests, a
     *  console session). Stores a REAL core.rank payload keyed by the exact
     *  subject key; every guard above still runs over it. */
    seed: function (askedBy, askedFor, payload) {
      _byKey[askedBy + '=' + askedFor] = payload;
      bump();
    }
  };

  publish();
})();
