// ── shared/hw-signin.jsx — the D2 sign-in prompt ────────────────────────────
// Owner decision D2 (2026-09-16, commit 2fdbf7e) moved the console's write
// credential off a static localStorage secret and onto a server-issued
// session (`shared/hw-live.js`'s `HW_LIVE.login/logout/session`, backed by
// `wm-demo/wmdemo/sessions.py`). That file built the whole surface and
// deliberately no UI: "building that prompt is a separate task for the
// shell." This is that task.
//
// A DETACHED ROOT, ON PURPOSE. This component cannot be reached by editing
// pos/app.jsx or pos/shell.jsx into rendering it — this task's own hard rules
// forbid touching either file (screen-register.jsx and screen-catalog.jsx are
// named explicitly, but the same "smallest possible surface" reasoning rules
// out the app root and the shell too; only shared/app-nav.js and one script
// tag in Hyperwolf POS.html are in scope beyond this file). So this file
// mounts ITSELF, into its own `ReactDOM.createRoot`, the same "detached root"
// trick `pos/shell-locations.jsx`'s `ShellLocationsModule.openNew` and
// `pos/shell-formats.jsx`'s `ShellFormatsModule.openNew` already use for a
// one-off surface with no call site of its own. The one difference: those
// tear their root down after one use; this one stays mounted for the life of
// the page, because `hw-live:unauthenticated` can fire at any time, not just
// in response to a click here.
//
// THEME. A detached root sits outside pos/tokens.jsx's <ThemeProvider>, so
// useP() below reads its context's DEFAULT value (light) rather than the
// app's current light/dark toggle — exactly the same trade-off the two
// `openNew` helpers above already accept for the same structural reason.
// Not fixable without editing pos/app.jsx, which is out of scope here.
;(function () {
  if (window.__hwSignInMounted) { return; }   // idempotent: a second script tag, one prompt
  const useP = window.useP;

  const ACTOR_LABEL_MAX = 40;

  // GET /api/inventory/locations -> {contract, locations:[{..., store_id}]}
  // (wmdemo/inventory_api.py:_location_out). Distinct, non-null store_ids,
  // sorted, become the store picker; anything else (unreachable, gated 403,
  // no store_ids at all) falls back to free text, per this task's own spec —
  // the store field is optional either way.
  function loadStoreIds(onDone) {
    const live = window.HW_LIVE;
    if (!live || typeof live.get !== 'function') { onDone(null); return; }
    live.get('/api/inventory/locations').then(function (res) {
      if (!res || !res.ok || !res.body || !Array.isArray(res.body.locations)) { onDone(null); return; }
      const ids = Array.from(new Set(
        res.body.locations.map(function (l) { return l && l.store_id; }).filter(Boolean)
      )).sort();
      onDone(ids.length ? ids : null);
    }, function () { onDone(null); });
  }

  window.HWSignIn = function HWSignIn() {
    const P = useP();
    const [open, setOpen] = React.useState(false);
    const [token, setToken] = React.useState('');
    const [actorLabel, setActorLabel] = React.useState('');
    const [storeId, setStoreId] = React.useState('');
    const [storeIds, setStoreIds] = React.useState(null);   // null = free text
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState(null);

    // (a) hw-live:unauthenticated — a live session died mid-use (expired,
    // revoked, or was never valid) and hw-live.js already cleared it.
    // (b) at load: no session AND no legacy token — nothing can authenticate
    // a write yet. Checked once, on mount, per this task's own spec.
    // (c) the chip's own "Sign in" link — see shared/app-nav.js — reopens via
    // this same window hook rather than a prop, since the chip is plain JS
    // mounted independently of this React root.
    React.useEffect(function () {
      const live = window.HW_LIVE;
      const hasSession = !!(live && typeof live.session === 'function' && live.session());
      const hasLegacy = !!(live && typeof live.hasToken === 'function' && live.hasToken());
      if (!hasSession && !hasLegacy) { setOpen(true); }
      function onUnauthenticated() { setOpen(true); }
      window.addEventListener('hw-live:unauthenticated', onUnauthenticated);
      window.hwSignInOpen = function () { setOpen(true); };
      return function () {
        window.removeEventListener('hw-live:unauthenticated', onUnauthenticated);
        delete window.hwSignInOpen;
      };
    }, []);

    React.useEffect(function () {
      if (!open) { return; }
      setError(null);
      loadStoreIds(setStoreIds);
    }, [open]);

    if (!open) { return null; }

    function submit(e) {
      if (e) { e.preventDefault(); }
      if (busy) { return; }
      const live = window.HW_LIVE;
      if (!live || typeof live.login !== 'function') { setError('Live seam unavailable.'); return; }
      const label = actorLabel.trim();
      if (!label) { setError('Your name is required.'); return; }
      if (label.length > ACTOR_LABEL_MAX) { setError('Your name must be ' + ACTOR_LABEL_MAX + ' characters or fewer.'); return; }
      setError(null); setBusy(true);
      const opts = { token: token, actor_label: label };
      const sid = storeId.trim();
      if (sid) { opts.store_id = sid; }
      live.login(opts).then(function (res) {
        setBusy(false);
        if (res && res.ok) {
          setOpen(false);
          setToken('');
          try { window.dispatchEvent(new CustomEvent('hw-live:authenticated')); } catch (err) { /* no-op */ }
          return;
        }
        // NEVER echo the token, in the error or anywhere else — just the
        // server's own status, in the wording this task's spec asks for.
        if (res && res.code === 401) { setError('Wrong token.'); return; }
        if (res && res.code === 429) { setError('Too many attempts — wait a few minutes.'); return; }
        setError((res && res.error) || 'Sign-in failed.');
      });
    }

    return (
      <div style={overlayScrim(P, { z: P.z.modal })} data-hw-chrome="hw-signin">
        {/* No onClick here, and no Escape handler anywhere in this component:
            "Esc does nothing while unauthenticated — the prompt is modal by
            design" (this task's spec, verbatim). A background click must not
            dismiss it either, for the same reason. */}
        <div style={{ ...overlayCard, width: 'min(400px,94%)' }} onClick={function (e) { e.stopPropagation(); }}>
          <Card elevation="raised">
            <div style={{ fontSize: P.type.title, fontWeight: 700, color: P.ink, marginBottom: 6 }}>Sign in</div>
            <div style={{ fontSize: P.type.body, color: P.inkDim, lineHeight: 1.5, marginBottom: 18 }}>
              This console needs a session before it can write anything.
            </div>
            <form onSubmit={submit}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: P.inkMute, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Console token</div>
                <Field type="password" value={token} autoComplete="off" autoFocus
                  onChange={function (e) { setToken(e.target.value); }} placeholder="Console token" />
                <div style={{ fontSize: 12, color: P.inkMute, marginTop: 6 }}>the console token from the ops lead</div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: P.inkMute, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Your name</div>
                <Field value={actorLabel} required maxLength={ACTOR_LABEL_MAX}
                  onChange={function (e) { setActorLabel(e.target.value.slice(0, ACTOR_LABEL_MAX)); }} placeholder="Your name" />
              </div>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: P.inkMute, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Store (optional)</div>
                {storeIds ? (
                  <select value={storeId} onChange={function (e) { setStoreId(e.target.value); }}
                    style={{ width: '100%', minHeight: P.ctrlH.md, padding: '0 12px', border: `1px solid ${P.fieldBorder}`, borderRadius: P.r8, background: P.field, color: P.ink, fontSize: 13.5, fontFamily: P.fontSans }}>
                    <option value="">All stores</option>
                    {storeIds.map(function (id) { return <option key={id} value={id}>{id}</option>; })}
                  </select>
                ) : (
                  <Field value={storeId} onChange={function (e) { setStoreId(e.target.value); }} placeholder="Store id (optional)" />
                )}
              </div>
              {error && <div style={{ fontSize: 12.5, color: P.bad, marginBottom: 14 }}>{error}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <PBtn type="submit" variant="accent" busy={busy}>Sign in</PBtn>
              </div>
            </form>
          </Card>
        </div>
      </div>);
  };

  // ── self-mount ─────────────────────────────────────────────────────────
  // Persistent for the life of the page (renders null while closed) — see the
  // file header on why this cannot be a call site inside pos/app.jsx instead.
  function mount() {
    if (!window.React || !window.ReactDOM || typeof window.ReactDOM.createRoot !== 'function') { return; }
    const host = document.createElement('div');
    host.setAttribute('data-hw-chrome', 'hw-signin-root');
    document.body.appendChild(host);
    window.ReactDOM.createRoot(host).render(<window.HWSignIn />);
    window.__hwSignInMounted = true;
  }
  mount();
})();
