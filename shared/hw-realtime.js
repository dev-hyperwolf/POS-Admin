// ── shared/hw-realtime.js ── the live-update transport ──────────────────────
// Plain JS, no framework, no build step — same discipline as shared/hw-live.js
// right next to it. Loads BEFORE React, on the same entry HTMLs hw-live.js
// already loads on.
//
// WHAT IT IS. `window.HWRealtime.subscribe(opts)` opens a streaming connection
// to `GET /api/rt/sse` (wmdemo/realtime_api.py) and calls `opts.onEvent(evt)`
// for every `{channel, id, ts, payload:{type, ref}}` the server publishes on
// one of `opts.channels`. It is the ONLY thing in this file that knows the
// wire format; hw-live.js (the caller) supplies the auth header, the channel
// list, and what "something changed" should DO (refetch /api/state) — this
// file never reads a token, a session, or app state of its own.
//
// WHY fetch() STREAMING, NOT EventSource. EventSource cannot set request
// headers on its initial connection, and the server's own security contract
// (POS-Admin/docs/REALTIME-ARCHITECTURE-2026-09-17.md Part 5, "never a token
// in the query string") refuses to accept a credential any other way — a
// query-string token would land in access logs and browser history. So this
// reads the response body as a stream with `fetch()` + `ReadableStream`
// (wmdemo/realtime_api.py's own docstring documents the identical contract
// server-side) and parses Server-Sent-Events framing by hand.
//
// FAILS SOFT, ALWAYS. Every code path that hits an unsupported browser, a
// network error, a non-2xx response, or a malformed frame degrades to the
// polling fallback (`opts.poll`, called every `opts.pollIntervalMs`, default
// 30s) — this file never throws out of `subscribe()` and never leaves the
// caller with silence and no signal. `opts.onStatus(status)` reports
// 'connecting' | 'live' | 'reconnecting' | 'polling' | 'paused' | 'stopped' |
// 'unauthenticated' | 'forbidden'. The last two are terminal for this
// subscription (see handleUnauthenticated/handleForbidden below): a dead
// credential or a channel this credential cannot see never reconnects and
// never falls back to polling under it -- `opts.onUnauthenticated()` /
// `opts.onForbidden()` each fire at most once so the caller can react (sign
// out; surface the refusal) instead of being told the same thing forever.
//
// NEVER LOGS. No `console.*` call anywhere in this file, on purpose — same
// posture hw-live.js already holds (grep it: there is exactly one `console`
// mention in that whole file, and it is a code comment). A stray debug log
// of a caught fetch error is exactly how a header object with a live session
// token ends up in a browser's devtools history or a shared screen-recording;
// the discipline is "never even build the sentence", not "remember to redact
// it every time".
(function () {
  'use strict';
  var W = window;
  if (W.HWRealtime && W.HWRealtime.__armed) { return; }  // idempotent: two tags, one seam

  var HAS_STREAMING = (function () {
    try {
      return typeof W.fetch === 'function' &&
        typeof W.ReadableStream === 'function' &&
        typeof W.TextDecoder === 'function' &&
        !!(new W.Response('', {}).body);
    } catch (e) { return false; }
  })();

  var DEFAULTS = {
    pollIntervalMs: 30000,
    baseBackoffMs: 500,
    maxBackoffMs: 30000,
    // After this many CONSECUTIVE failed connection attempts, start polling
    // IN ADDITION to continuing background reconnect attempts — a flaky
    // network should not have to choose between "stale forever" and "never
    // try streaming again".
    pollAfterFailures: 3,
    // A stream that has gone this long with neither an event nor a heartbeat
    // is presumed dead even if the socket itself never errored (a silently
    // dropped NAT/proxy connection — the exact failure mode the server's own
    // 15s heartbeat exists to surface). 3x the server's default heartbeat
    // interval gives two missed beats of slack before giving up.
    watchdogMs: 45000,
  };

  function now() { return Date.now(); }

  function jitterBackoff(attempt, base, max) {
    var raw = Math.min(max, base * Math.pow(2, attempt));
    // Full jitter (AWS architecture blog's own recommended formula): a
    // reconnect storm across many open tabs must not resynchronise itself
    // into another storm every time the backoff doubles.
    return Math.floor(raw * (0.5 + Math.random() * 0.5));
  }

  function parseSseBlock(block) {
    // -> {id, event, data} | null (a block with no `data:` line, e.g. a bare
    // heartbeat comment, has data === null and is reported as a heartbeat).
    var lines = block.split('\n');
    var id = null, event = null, dataLines = [];
    var sawComment = false;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.charAt(0) === ':') { sawComment = true; continue; }
      var idx = line.indexOf(':');
      var field = idx === -1 ? line : line.slice(0, idx);
      var value = idx === -1 ? '' : line.slice(idx + 1).replace(/^ /, '');
      if (field === 'id') { id = value; }
      else if (field === 'event') { event = value; }
      else if (field === 'data') { dataLines.push(value); }
    }
    if (dataLines.length === 0) {
      return sawComment ? { heartbeat: true } : null;
    }
    var raw = dataLines.join('\n');
    try {
      return { id: id, event: event, json: JSON.parse(raw) };
    } catch (e) {
      return null;  // malformed frame: drop it, never throw out of the reader loop
    }
  }

  function subscribe(opts) {
    opts = opts || {};
    var channels = (opts.channels || []).filter(Boolean);
    var baseUrl = opts.baseUrl || W.location.origin;
    var getHeaders = typeof opts.getHeaders === 'function' ? opts.getHeaders : function () { return {}; };
    var onEvent = typeof opts.onEvent === 'function' ? opts.onEvent : function () {};
    var onStatus = typeof opts.onStatus === 'function' ? opts.onStatus : function () {};
    // Terminal outcomes -- a dead credential (401) or a channel this credential
    // cannot see (403/404) are not "the network is flaky", so neither one goes
    // through scheduleReconnect()/startPolling(). Each fires its callback AT MOST
    // ONCE per subscribe() -- the caller (hw-live.js) reacts once (sign the user
    // out; surface the refusal), not once per would-be reconnect attempt.
    var onUnauthenticated = typeof opts.onUnauthenticated === 'function' ? opts.onUnauthenticated : function () {};
    var onForbidden = typeof opts.onForbidden === 'function' ? opts.onForbidden : function () {};
    var poll = typeof opts.poll === 'function' ? opts.poll : null;
    var pollIntervalMs = opts.pollIntervalMs || DEFAULTS.pollIntervalMs;
    var baseBackoffMs = opts.baseBackoffMs || DEFAULTS.baseBackoffMs;
    var maxBackoffMs = opts.maxBackoffMs || DEFAULTS.maxBackoffMs;
    var pollAfterFailures = opts.pollAfterFailures || DEFAULTS.pollAfterFailures;
    var watchdogMs = opts.watchdogMs || DEFAULTS.watchdogMs;

    var _stopped = false;
    var _status = 'stopped';
    var _controller = null;
    var _reconnectTimer = null;
    var _pollTimer = null;
    var _watchdogTimer = null;
    var _attempt = 0;
    var _consecutiveFailures = 0;
    var _unauthFired = false;
    var _forbiddenFired = false;
    var _lastIds = {};   // channel -> last event id SEEN, for resume
    var _pollingActive = false;

    function setStatus(s) {
      if (s === _status) { return; }
      _status = s;
      try { onStatus(s); } catch (e) {}
    }

    function clearWatchdog() {
      if (_watchdogTimer) { clearTimeout(_watchdogTimer); _watchdogTimer = null; }
    }
    function armWatchdog() {
      clearWatchdog();
      _watchdogTimer = setTimeout(function () {
        // No frame (event or heartbeat) in watchdogMs: treat exactly like a
        // dropped connection. abort() causes the reader loop below to exit
        // through its own catch/finally, which is what schedules reconnect.
        if (_controller) { try { _controller.abort(); } catch (e) {} }
      }, watchdogMs);
    }

    function startPolling() {
      if (_pollingActive || !poll || _stopped) { return; }
      _pollingActive = true;
      var tick = function () {
        if (_stopped) { return; }
        try { poll(); } catch (e) {}
      };
      tick();
      _pollTimer = setInterval(tick, pollIntervalMs);
    }
    function stopPolling() {
      _pollingActive = false;
      if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
    }

    function scheduleReconnect() {
      if (_stopped || (W.document && W.document.hidden)) { return; }
      _consecutiveFailures++;
      if (_consecutiveFailures >= pollAfterFailures) {
        setStatus(_pollingActive ? 'polling' : 'polling');
        startPolling();
      } else {
        setStatus('reconnecting');
      }
      var delay = jitterBackoff(_attempt, baseBackoffMs, maxBackoffMs);
      _attempt++;
      _reconnectTimer = setTimeout(connect, delay);
    }

    // Retry-After (RFC 7231 delta-seconds, or an HTTP-date -- both are legal)
    // caps a 429/503's own requested wait at maxBackoffMs, same ceiling every
    // other backoff in this file already respects. No header, or a value that
    // does not parse either way: null, so the caller falls back to the normal
    // exponential path rather than inventing a number.
    function parseRetryAfterMs(res) {
      try {
        var raw = (res && res.headers && typeof res.headers.get === 'function')
          ? res.headers.get('Retry-After') : null;
        if (raw == null) { return null; }
        var secs = Number(raw);
        if (isNaN(secs)) {
          var t = Date.parse(raw);
          if (isNaN(t)) { return null; }
          secs = (t - now()) / 1000;
        }
        if (isNaN(secs) || secs < 0) { secs = 0; }
        return Math.min(maxBackoffMs, secs * 1000);
      } catch (e) { return null; }
    }

    // A server-issued throttle (429) or a temporary refusal (503) is not
    // evidence the stream is broken -- it is the server asking, explicitly,
    // to be left alone for a while. Honour that wait if given one; otherwise
    // this is just an ordinary failed connection attempt.
    function handleThrottled(res) {
      clearWatchdog();
      if (_stopped) { return; }
      var waitMs = parseRetryAfterMs(res);
      if (waitMs == null) { scheduleReconnect(); return; }
      setStatus('reconnecting');
      _reconnectTimer = setTimeout(connect, waitMs);
    }

    // A revoked/expired/never-valid credential (401). Reconnecting with the
    // same dead credential forever is exactly the bug this exists to end:
    // stop outright (no reconnect timer, no polling fallback) and tell the
    // caller once, so it can react the way it reacts to a 401 anywhere else
    // (hw-live.js: clear the session, open the sign-in prompt).
    function handleUnauthenticated() {
      clearWatchdog();
      if (_stopped) { return; }
      _stopped = true;
      stopPolling();
      if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
      setStatus('unauthenticated');
      if (!_unauthFired) {
        _unauthFired = true;
        try { onUnauthenticated(); } catch (e) {}
      }
    }

    // The credential is fine but this channel set is not this principal's to
    // see (403), or does not exist (404 -- the server's own "same body as a
    // foreign channel" no-oracle rule, see wmdemo/realtime_channels.py). Do
    // not hammer a subscription that can never succeed: stop it and surface
    // the refusal once, same shape as handleUnauthenticated above.
    function handleForbidden() {
      clearWatchdog();
      if (_stopped) { return; }
      _stopped = true;
      stopPolling();
      if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
      setStatus('forbidden');
      if (!_forbiddenFired) {
        _forbiddenFired = true;
        try { onForbidden(); } catch (e) {}
      }
    }

    function buildUrl() {
      var qs = 'channels=' + encodeURIComponent(channels.join(','));
      var hasResume = false;
      for (var k in _lastIds) { if (Object.prototype.hasOwnProperty.call(_lastIds, k)) { hasResume = true; break; } }
      if (hasResume) { qs += '&resumeFrom=' + encodeURIComponent(JSON.stringify(_lastIds)); }
      // Ids only, ever, in the query string -- see this file's own header
      // comment. No credential is EVER placed here.
      return baseUrl + '/api/rt/sse?' + qs;
    }

    function handleFrame(block) {
      var parsed = parseSseBlock(block);
      if (!parsed) { return; }
      armWatchdog();  // any frame at all (heartbeat or event) proves liveness
      if (parsed.heartbeat) { return; }
      var j = parsed.json;
      if (!j || typeof j !== 'object') { return; }
      if (j.type === 'event') {
        if (typeof j.channel === 'string' && typeof j.id === 'number') {
          _lastIds[j.channel] = j.id;
        }
        try {
          onEvent({ channel: j.channel, id: j.id, ts: j.ts, payload: j.payload || {} });
        } catch (e) {}
      } else if (j.type === 'gap') {
        // Ring buffer truncated past what we could resume -- there is no
        // finer-grained recovery than "something in this channel changed
        // while we were gone", so this is reported to the caller as a
        // synthetic event with no ref, which is exactly what a full refetch
        // (opts.poll / HW_LIVE.refresh) is for.
        try { onEvent({ channel: j.channel, id: null, ts: now() / 1000, payload: { type: 'gap', ref: null } }); } catch (e) {}
      } else if (j.type === 'shutdown' || j.type === 'revoked') {
        // Server-initiated close -- let the stream end naturally (the fetch
        // reader's own `done` branch below runs next) and reconnect through
        // the normal backoff path, rather than special-casing it here.
      }
    }

    function readStream(reader, decoder) {
      var buffer = '';
      function pump() {
        return reader.read().then(function (result) {
          if (result.done) { throw new Error('stream ended'); }
          buffer += decoder.decode(result.value, { stream: true });
          var parts = buffer.split('\n\n');
          buffer = parts.pop();  // last element: incomplete trailing block
          for (var i = 0; i < parts.length; i++) {
            if (parts[i]) { handleFrame(parts[i]); }
          }
          return pump();
        });
      }
      return pump();
    }

    function connect() {
      if (_stopped) { return; }
      if (W.document && W.document.hidden) { setStatus('paused'); return; }
      if (!HAS_STREAMING) {
        setStatus('polling');
        startPolling();
        return;
      }
      setStatus(_attempt === 0 ? 'connecting' : 'reconnecting');
      var headers;
      try { headers = getHeaders() || {}; } catch (e) { headers = {}; }
      _controller = (typeof W.AbortController === 'function') ? new W.AbortController() : null;
      W.fetch(buildUrl(), {
        method: 'GET',
        headers: headers,
        credentials: 'omit',
        cache: 'no-store',
        signal: _controller ? _controller.signal : undefined,
      }).then(function (res) {
        // Classify BEFORE the generic !res.ok branch -- these three outcomes
        // each need their own reaction, not a blind reconnect. Returning
        // (rather than throwing) here means the .catch() below never sees
        // them, so scheduleReconnect() cannot fire on top of a terminal stop.
        if (res.status === 401) { handleUnauthenticated(); return; }
        if (res.status === 403 || res.status === 404) { handleForbidden(); return; }
        if (res.status === 429 || res.status === 503) { handleThrottled(res); return; }
        if (!res.ok || !res.body) {
          throw new Error('sse http ' + res.status);
        }
        // A real, successful connection: reset backoff and drop out of
        // polling mode (streaming has recovered) — but do NOT stop an
        // in-flight poll tick, just the recurring timer, so nothing is
        // left mid-refresh.
        _attempt = 0;
        _consecutiveFailures = 0;
        stopPolling();
        setStatus('live');
        armWatchdog();
        var reader = res.body.getReader();
        var decoder = new W.TextDecoder('utf-8');
        return readStream(reader, decoder);
      }).catch(function () {
        clearWatchdog();
        if (_stopped) { return; }
        scheduleReconnect();
      });
    }

    function onVisibilityChange() {
      if (!W.document) { return; }
      if (W.document.hidden) {
        // Pause entirely: no open stream, no poll timer, while the tab is in
        // the background — a hidden tab burning a stream slot (and the
        // server's own per-principal/per-IP cap) for nobody to see is
        // exactly the kind of leak "8 open dashboards" already warns about
        // at the server layer; this is the client half of the same care.
        if (_controller) { try { _controller.abort(); } catch (e) {} }
        clearWatchdog();
        stopPolling();
        if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
        setStatus('paused');
      } else if (!_stopped) {
        _attempt = 0;  // a foregrounded tab should reconnect promptly, not
                       // resume mid-backoff from before it was hidden
        connect();
      }
    }

    if (W.document && typeof W.document.addEventListener === 'function') {
      W.document.addEventListener('visibilitychange', onVisibilityChange);
    }

    connect();

    return {
      stop: function () {
        _stopped = true;
        if (_controller) { try { _controller.abort(); } catch (e) {} }
        if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
        clearWatchdog();
        stopPolling();
        if (W.document && typeof W.document.removeEventListener === 'function') {
          W.document.removeEventListener('visibilitychange', onVisibilityChange);
        }
        setStatus('stopped');
      },
      get status() { return _status; },
    };
  }

  W.HWRealtime = {
    __armed: true,
    VERSION: '1.0.0',
    supportsStreaming: HAS_STREAMING,
    subscribe: subscribe,
  };
})();
