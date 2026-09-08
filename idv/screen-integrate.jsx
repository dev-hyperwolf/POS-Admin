// ── idv/screen-integrate.jsx ── IdvIntegrateScreen ─────────────────────────
// Everything another system needs to start a verification and hear the
// result: API keys, webhook destinations + their delivery log, copyable
// code snippets, the "move hyperwolf.com off Didit" change list, and a
// small honest panel for the engine's own health. Built from pos/atoms.jsx +
// shared/states.jsx + shared/hd-ui.jsx only — no hex, no private div-tree
// duplicating an atom. Data via window.HWIdv (idv/idv-client.jsx) exactly as
// every other Verify screen does; see the CONTRACT GAP note below the file
// header for the one place this screen can't use that seam as-is.
//
// CONTRACT GAP, updated: revoking an API key is `DELETE /api/idv/api-keys/{id}`
// per docs/IDV-API-CONTRACT.md, and window.HWIdv now exposes del() alongside
// get()/post()/patch()/put() (idv/idv-client.jsx). The local `idvDelete()`
// mirror of that same request-building was a plain duplicate and has been
// removed — this file now calls window.HWIdv.del() directly.
;(function () {
  const useP = window.useP;

  // ── constants — every literal here matches docs/IDV-API-CONTRACT.md, never
  // an invented friendlier vocabulary ──────────────────────────────────────
  const SCOPE_OPTIONS = ['sessions:write', 'sessions:read', 'lists:read'];
  const EVENT_OPTIONS = ['status.updated', 'data.updated'];
  const DELIVERY_TONE = { queued: 'neutral', delivered: 'good', failed: 'warn', dead: 'bad' };

  // §5b, verbatim substance — this screen never respells it, only annotates
  // items 2 with the specific values this server can supply today.
  const MIGRATION_ITEMS = [
    'Keep the three routes and their exact paths/shapes — currently POST didit/create/url, GET didit/retrieve/status?sessionId=, GET didit/retrieve/session?sessionId= — or change lib/api/services/common.ts:213-225 (3 lines) to point at new paths if the mount differs.',
    'create/url response must include { registerUrl, diditSessionId, isDiditRequired, userData, email, guestCheckout } — signup-form.tsx:292-298 and checkout-container.tsx:781-802 read these exact key names.',
    'registerUrl must be an iframe-embeddable URL (X-Frame-Options / CSP frame-ancestors permitting) that runs entirely client-side to completion — the modal never listens for postMessage, only polls status.',
    'retrieve/status must return { status } with values drawn from the set the frontend already special-cases: ‘Approved’, ‘Declined’, ‘In Review’. Any other string is currently treated as "keep polling" (modal) or "verification failed" (signup/checkout on completion) — translate a new provider’s status vocabulary to these three strings server-side.',
    'retrieve/session must return { firstName, lastName, fullName, dob, recIssueDate, dlExpiration, city, country, state, sex, address, zip, dlNo, isVerified, age, filePath, selfiePath, email } — signup-form.tsx:154-164 and the completeSignup payload builder read these exact keys. filePath/selfiePath must resolve to files this backend can hand to Blaze’s dlPhoto upload.',
    'Env vars to swap (backend-only): DIDIT_API_BASE_URL, DIDIT_API_KEY, DIDIT_WORKFLOW_ID (.env.example:137-140, consumed in common/utils.js:75 and controllers/didit/didit-controllers.js:3,127-129).',
    'next.config.ts:80 CSP frame-src must list the new provider’s iframe host in place of (or alongside) verify.didit.me, or the iframe is silently blocked by the browser.',
    'Everything else (super-admin toggle, signupStatus doc, Blaze PUT .../members/{id} verified-flag call, dlPhoto upload, BlazeUser.diditSessionId/selfiePhotoUrl) is internal to the current backend and can be re-implemented however this backend likes, as long as it is still driven by the same signupStatus.diditStatus === ‘active’ toggle super-admin already writes to.',
  ];

  // ── snippets — placeholder key, deliberately never a real one ───────────
  function curlSnippet(base, workflowId) {
    return `# the site creates the session, then redirects the customer to url
curl -X POST ${base}/v3/session/ \\
  -H "x-api-key: hwv_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "workflow_id": "${workflowId}",
    "vendor_data": "email:<sha256>",
    "callback": "https://hyperwolf.com/verify/return",
    "expected_details": { "first_name": "Jess", "last_name": "Okonta" },
    "language": "en"
  }'

# 201
# { "session_id": "...", "session_token": "...", "url": "...",
#   "status": "Not Started", "workflow_id": "${workflowId}", "vendor_data": "email:<sha256>" }

# poll the decision once the customer returns
curl ${base}/v3/session/{session_id}/decision/ \\
  -H "x-api-key: hwv_live_YOUR_KEY"`;
  }

  function nodeSnippet(base, workflowId) {
    return `const BASE = '${base}';
const API_KEY = 'hwv_live_YOUR_KEY';

async function startSession(vendorData) {
  const res = await fetch(\`\${BASE}/v3/session/\`, {
    method: 'POST',
    headers: { 'x-api-key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workflow_id: '${workflowId}',
      vendor_data: vendorData,
      callback: 'https://hyperwolf.com/verify/return',
    }),
  });
  return res.json(); // { session_id, session_token, url, status, workflow_id, vendor_data }
}

async function getDecision(sessionId) {
  const res = await fetch(\`\${BASE}/v3/session/\${sessionId}/decision/\`, {
    headers: { 'x-api-key': API_KEY },
  });
  return res.json(); // Decision — same shape the console uses
}`;
  }

  // Exact scheme, docs/IDV-API-CONTRACT.md "Outbound webhooks": hex
  // HMAC-SHA256 over timestamp + "." + canonical_json; canonical = sorted
  // keys, compact separators, floats shortened to ≤ 2 decimals; 300s skew;
  // dedupe on event_id.
  const NODE_VERIFY = `const crypto = require('crypto');

function canonicalize(v) {
  if (v === null || typeof v !== 'object') {
    if (typeof v === 'number' && !Number.isInteger(v)) return String(Math.round(v * 100) / 100);
    return JSON.stringify(v);
  }
  if (Array.isArray(v)) return '[' + v.map(canonicalize).join(',') + ']';
  const keys = Object.keys(v).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize(v[k])).join(',') + '}';
}

const seenEventIds = new Set(); // swap for a real store in production

function verifyWebhook(rawBody, headers, secret) {
  const sig = headers['x-signature-v2'];
  const ts = Number(headers['x-timestamp']);
  const now = Math.floor(Date.now() / 1000);
  if (!ts || Math.abs(now - ts) > 300) throw new Error('timestamp outside the 300s skew window');

  const body = JSON.parse(rawBody);
  const expected = crypto.createHmac('sha256', secret)
    .update(\`\${ts}.\${canonicalize(body)}\`).digest('hex');
  if (expected !== sig) throw new Error('signature mismatch');

  if (seenEventIds.has(body.event_id)) throw new Error('duplicate event_id — already processed');
  seenEventIds.add(body.event_id);

  return body; // { event_id, event, session_id, session_number, status, ... }
}`;

  const PY_VERIFY = `import hashlib, hmac, json, time

_seen_event_ids = set()  # swap for a real store in production

def _canonicalize(v):
    if isinstance(v, bool) or v is None or isinstance(v, str):
        return json.dumps(v)
    if isinstance(v, float):
        return json.dumps(round(v, 2))
    if isinstance(v, int):
        return json.dumps(v)
    if isinstance(v, list):
        return '[' + ','.join(_canonicalize(x) for x in v) + ']'
    keys = sorted(v.keys())
    return '{' + ','.join(json.dumps(k) + ':' + _canonicalize(v[k]) for k in keys) + '}'

def verify_webhook(raw_body: bytes, headers: dict, secret: str) -> dict:
    sig = headers.get('x-signature-v2', '')
    ts = int(headers.get('x-timestamp', 0))
    if not ts or abs(int(time.time()) - ts) > 300:
        raise ValueError('timestamp outside the 300s skew window')

    body = json.loads(raw_body)
    message = f"{ts}.{_canonicalize(body)}".encode()
    expected = hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig):
        raise ValueError('signature mismatch')

    event_id = body.get('event_id')
    if event_id in _seen_event_ids:
        raise ValueError('duplicate event_id — already processed')
    _seen_event_ids.add(event_id)

    return body  # { event_id, event, session_id, session_number, status, ... }`;

  // ── small shared pieces ──────────────────────────────────────────────────
  function CodeBlock({ code }) {
    const P = useP();
    const [copied, setCopied] = React.useState(false);
    return (
      <div style={{ position: 'relative' }}>
        <pre style={{ margin: 0, padding: 14, paddingRight: 42, background: P.canvas2, border: `1px solid ${P.hairline}`,
          borderRadius: P.r8, color: P.ink2, fontFamily: P.fontMono, fontSize: 11.5, lineHeight: 1.6,
          overflowX: 'auto', whiteSpace: 'pre' }}>{code}</pre>
        <IconBtn icon={copied ? 'check' : 'copy'} size={14}
          label={copied ? 'Copied' : 'Copy snippet'}
          onClick={() => { navigator.clipboard?.writeText(code).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1400); }}
          style={{ position: 'absolute', top: 6, right: 6, width: 30, height: 30 }} />
      </div>);
  }

  // One error state per poll, honest about WHICH kind of not-working this is:
  // 'no-live-seam' (window.HW_LIVE never armed — the whole backend) gets the
  // estate's NotConnected copy; any other error (a real HTTP status from a
  // reachable backend) gets a plain ErrorState instead, so a 404 on one
  // stale row is never reported as "Verify isn't connected."
  function PanelError({ poll, subject }) {
    return poll.error === 'no-live-seam'
      ? <window.IdvShared.NotConnected onRetry={poll.refresh} compact />
      : <ErrorState compact title={`${subject} didn't load`} detail={poll.error} onRetry={poll.refresh} />;
  }

  function CardHead({ icon, title, meta, action }) {
    const P = useP();
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
        <span style={{ width: 26, height: 26, borderRadius: P.r8, background: P.surface3, color: P.inkDim,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
          <Icon name={icon} size={14} stroke={1.9} />
        </span>
        <div style={{ fontSize: P.type.title, fontWeight: 700, color: P.ink, flex: '0 0 auto' }}>{title}</div>
        {meta}
        <div style={{ flex: 1 }} />
        {action}
      </div>);
  }

  // Shown once — the exact same shape for a freshly-minted API key and a
  // freshly-minted webhook secret, per the contract's "shown once" rule for
  // both. We store a hash; this is the only moment the plaintext exists here.
  function ShownOnceBox({ value, onDone }) {
    const P = useP();
    const [copied, setCopied] = React.useState(false);
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: P.canvas2,
          border: `1px solid ${P.hairline}`, borderRadius: P.r8, marginBottom: 10 }}>
          <span style={{ flex: 1, minWidth: 0, overflowX: 'auto', fontFamily: P.fontMono, fontSize: 13, color: P.ink, whiteSpace: 'nowrap' }}>{value}</span>
          <IconBtn icon={copied ? 'check' : 'copy'} size={14} label="Copy"
            onClick={() => { navigator.clipboard?.writeText(value).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1400); }} />
        </div>
        <div style={{ display: 'flex', gap: 8, padding: 10, background: P.warnSoft, borderRadius: P.r8, marginBottom: 12 }}>
          <Icon name="alert" size={15} stroke={1.8} color={P.warn} style={{ flex: '0 0 auto', marginTop: 1 }} />
          <div style={{ fontSize: P.type.meta, color: P.warnText, lineHeight: 1.5 }}>
            This appears once, right now. We store a hash, so we genuinely cannot show it to you again — if it is lost, revoke it and make another. Revoking takes effect on the next request, not at the end of a session.
          </div>
        </div>
        <PBtn variant="primary" full onClick={onDone}>Done — I’ve copied it</PBtn>
      </div>);
  }

  function ConfirmModal({ title, body, confirmLabel, onConfirm, onCancel, busy }) {
    const P = useP();
    return (
      <div style={window.overlayScrim(P, {})}>
        <div style={{ ...window.overlayCard, width: 'min(420px,94%)' }}>
          <Card elevation="raised">
            <div style={{ fontSize: P.type.title, fontWeight: 700, color: P.ink, marginBottom: 8 }}>{title}</div>
            <div style={{ fontSize: P.type.body, color: P.inkDim, lineHeight: 1.5, marginBottom: 16 }}>{body}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <PBtn variant="ghost" onClick={onCancel} disabled={busy}>Cancel</PBtn>
              <PBtn variant="danger" onClick={onConfirm} busy={busy}>{confirmLabel}</PBtn>
            </div>
          </Card>
        </div>
      </div>);
  }

  function CreateKeyModal({ onClose, onCreated }) {
    const P = useP();
    const [name, setName] = React.useState('');
    const [scopes, setScopes] = React.useState(['sessions:write', 'sessions:read']);
    const [busy, setBusy] = React.useState(false);
    const [created, setCreated] = React.useState(null);

    function toggleScope(s) { setScopes((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]); }
    function submit() {
      setBusy(true);
      window.HWIdv.post('/api/idv/api-keys', { name: name.trim(), scopes }).then((r) => {
        setBusy(false);
        if (r.ok && r.body) { setCreated(r.body); window.hdToast?.({ title: 'Key created', description: r.body.name, tone: 'ok' }); }
        else window.hdToast?.({ title: 'Could not create the key', description: r.error || ('HTTP ' + r.code), tone: 'blocked' });
      });
    }

    return (
      <div style={window.overlayScrim(P, {})}>
        <div style={{ ...window.overlayCard, width: 'min(460px,94%)' }}>
          <Card elevation="raised">
            {!created ? (
              <>
                <div style={{ fontSize: P.type.title, fontWeight: 700, color: P.ink, marginBottom: 4 }}>New API key</div>
                <div style={{ fontSize: P.type.meta, color: P.inkDim, marginBottom: 16 }}>Any system calling the <span style={{ fontFamily: P.fontMono }}>/v3/*</span> API needs one of these in <span style={{ fontFamily: P.fontMono }}>x-api-key</span>.</div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: P.type.meta, fontWeight: 600, color: P.inkDim, marginBottom: 6 }}>Name</div>
                  <Field value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. hyperwolf-backend" />
                </div>
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: P.type.meta, fontWeight: 600, color: P.inkDim, marginBottom: 6 }}>Scopes</div>
                  {SCOPE_OPTIONS.map((s) => (
                    <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0', cursor: 'pointer' }}>
                      <Check on={scopes.includes(s)} onChange={() => toggleScope(s)} />
                      <span style={{ fontSize: P.type.body, color: P.ink, fontFamily: P.fontMono }}>{s}</span>
                    </label>))}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <PBtn variant="ghost" onClick={onClose} disabled={busy}>Cancel</PBtn>
                  <PBtn variant="accent" onClick={submit} busy={busy} disabled={!name.trim() || scopes.length === 0}>Create key</PBtn>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: P.type.title, fontWeight: 700, color: P.ink, marginBottom: 4 }}>{created.name}</div>
                <div style={{ fontSize: P.type.meta, color: P.inkDim, marginBottom: 12 }}>prefix <span style={{ fontFamily: P.fontMono }}>{created.prefix}</span></div>
                <ShownOnceBox value={created.key} onDone={() => { onCreated(); onClose(); }} />
              </>)}
          </Card>
        </div>
      </div>);
  }

  function AddWebhookModal({ onClose, onCreated }) {
    const P = useP();
    const [url, setUrl] = React.useState('');
    const [events, setEvents] = React.useState(EVENT_OPTIONS.slice());
    const [busy, setBusy] = React.useState(false);
    const [created, setCreated] = React.useState(null);

    function toggleEvent(e) { setEvents((prev) => prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]); }
    function submit() {
      setBusy(true);
      window.HWIdv.post('/api/idv/webhooks', { url: url.trim(), events }).then((r) => {
        setBusy(false);
        if (r.ok && r.body) { setCreated(r.body); window.hdToast?.({ title: 'Destination added', description: url, tone: 'ok' }); }
        else window.hdToast?.({ title: 'Could not add the destination', description: r.error || ('HTTP ' + r.code), tone: 'blocked' });
      });
    }

    return (
      <div style={window.overlayScrim(P, {})}>
        <div style={{ ...window.overlayCard, width: 'min(460px,94%)' }}>
          <Card elevation="raised">
            {!created ? (
              <>
                <div style={{ fontSize: P.type.title, fontWeight: 700, color: P.ink, marginBottom: 4 }}>Add webhook destination</div>
                <div style={{ fontSize: P.type.meta, color: P.inkDim, marginBottom: 16 }}>Signed like Didit’s: <span style={{ fontFamily: P.fontMono }}>X-Signature-V2</span> over a canonicalised body, plus <span style={{ fontFamily: P.fontMono }}>X-Timestamp</span>.</div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: P.type.meta, fontWeight: 600, color: P.inkDim, marginBottom: 6 }}>URL</div>
                  <Field value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://hyperwolf.com/api/idv/webhook" mono />
                </div>
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: P.type.meta, fontWeight: 600, color: P.inkDim, marginBottom: 6 }}>Events</div>
                  {EVENT_OPTIONS.map((e) => (
                    <label key={e} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0', cursor: 'pointer' }}>
                      <Check on={events.includes(e)} onChange={() => toggleEvent(e)} />
                      <span style={{ fontSize: P.type.body, color: P.ink, fontFamily: P.fontMono }}>{e}</span>
                    </label>))}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <PBtn variant="ghost" onClick={onClose} disabled={busy}>Cancel</PBtn>
                  <PBtn variant="accent" onClick={submit} busy={busy} disabled={!url.trim() || events.length === 0}>Add destination</PBtn>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: P.type.title, fontWeight: 700, color: P.ink, marginBottom: 4 }}>Destination added</div>
                <div style={{ fontSize: P.type.meta, color: P.inkDim, marginBottom: 12, fontFamily: P.fontMono, wordBreak: 'break-all' }}>{created.url}</div>
                <ShownOnceBox value={created.secret} onDone={() => { onCreated(); onClose(); }} />
              </>)}
          </Card>
        </div>
      </div>);
  }

  // ── (1) API keys ──────────────────────────────────────────────────────────
  function ApiKeysCard({ can }) {
    const P = useP();
    const poll = window.HWIdv.usePoll('/api/idv/api-keys', 20000);
    const [modal, setModal] = React.useState(null); // null | 'create' | { revoke: row }
    const [busyId, setBusyId] = React.useState(null);
    const rows = (poll.data && poll.data.rows) || [];

    function revoke(row) {
      setBusyId(row.id);
      window.HWIdv.del('/api/idv/api-keys/' + row.id).then((r) => {
        setBusyId(null); setModal(null);
        if (r.ok) { window.hdToast?.({ title: 'Key revoked', description: row.name, tone: 'ok' }); poll.refresh(); }
        else window.hdToast?.({ title: 'Could not revoke the key', description: r.error || ('HTTP ' + r.code), tone: 'blocked' });
      });
    }

    const columns = [
      { label: 'Name', key: 'name', render: (r) => (
        <div>
          <div style={{ fontWeight: 700, color: P.ink }}>{r.name}</div>
          <div style={{ fontFamily: P.fontMono, fontSize: 10.5, color: P.inkMute }}>{r.prefix}</div>
        </div>) },
      { label: 'Scopes', key: 'scopes', render: (r) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontFamily: P.fontMono, fontSize: 11, color: P.inkDim }}>
          {(r.scopes || []).map((s) => <span key={s}>{s}</span>)}
        </div>) },
      { label: 'Created', key: 'created_at', render: (r) => <span style={{ color: P.inkDim, fontSize: 12 }}>{window.HWIdv.fmt.date(r.created_at)}</span> },
      { label: 'Last used', key: 'last_used_at', render: (r) => <span style={{ color: P.inkDim, fontSize: 12 }}>{r.last_used_at ? window.HWIdv.fmt.relative(r.last_used_at) : 'never'}</span> },
      { label: '', key: 'actions', align: 'right', render: (r) => r.revoked_at
        ? <Pill kind="neutral" size="sm">Revoked</Pill>
        : <PBtn variant="ghost" size="xs" onClick={() => setModal({ revoke: r })} disabled={!can('keys')} title={can('keys') ? undefined : 'Admin role required'} busy={busyId === r.id}>Revoke</PBtn> },
    ];

    return (
      <Card>
        <CardHead icon="lock" title="API keys" meta={<Pill kind="neutral" size="sm">{rows.length}</Pill>}
          action={<PBtn variant="accent" size="sm" icon="plus" onClick={() => setModal('create')} disabled={!can('keys')} title={can('keys') ? undefined : 'Admin role required to create a key'}>Create key</PBtn>} />
        {poll.loading && !poll.data ? <window.IdvShared.SkeletonTable rows={3} /> :
         poll.error ? <PanelError poll={poll} subject="API keys" /> :
         rows.length === 0 ? <EmptyState icon="lock" title="No API keys yet" body="Create one for the site, the check-in seam, or any migration tool that needs to call /v3/*." compact /> :
         <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} dense />}
        {!can('keys') && <div style={{ marginTop: 10, fontSize: P.type.meta, color: P.inkMute }}>You are signed in as an analyst (the estate’s fallback identity) — creating or revoking a key needs admin.</div>}
        {modal === 'create' && <CreateKeyModal onClose={() => setModal(null)} onCreated={poll.refresh} />}
        {modal && modal.revoke && (
          <ConfirmModal title="Revoke this key?" confirmLabel="Revoke" busy={busyId === modal.revoke.id}
            body={`Any system using ${modal.revoke.name} (${modal.revoke.prefix}) fails on its very next request. This cannot be undone.`}
            onCancel={() => setModal(null)} onConfirm={() => revoke(modal.revoke)} />)}
      </Card>);
  }

  // ── (2) Webhook destinations + deliveries drawer ─────────────────────────
  function DeliveriesDrawer({ webhook, onClose }) {
    const P = useP();
    const poll = window.HWIdv.usePoll('/api/idv/webhooks/' + webhook.id + '/deliveries', 8000);
    const rows = (poll.data && poll.data.rows) || [];
    const [testing, setTesting] = React.useState(false);

    function sendTest() {
      setTesting(true);
      window.HWIdv.post('/api/idv/webhooks/' + webhook.id + '/test', {}).then((r) => {
        setTesting(false);
        if (r.ok) { window.hdToast?.({ title: 'Test delivery sent', description: (r.body && r.body.delivery && r.body.delivery.status) || 'queued', tone: 'ok' }); poll.refresh(); }
        else window.hdToast?.({ title: 'Test delivery failed to send', description: r.error || ('HTTP ' + r.code), tone: 'blocked' });
      });
    }

    const columns = [
      { label: 'Event', key: 'event_id', render: (r) => <span style={{ fontFamily: P.fontMono, fontSize: 11.5, color: P.ink }}>{r.event_id}</span> },
      { label: 'Attempt', key: 'attempt', align: 'right', render: (r) => <span style={{ fontFamily: P.fontMono, fontSize: 12 }}>{r.attempt}</span> },
      { label: 'Status', key: 'status', render: (r) => <Pill kind={DELIVERY_TONE[r.status] || 'neutral'} size="sm" dot>{r.status}</Pill> },
      { label: 'Code', key: 'response_code', align: 'right', render: (r) => <span style={{ fontFamily: P.fontMono, fontSize: 12, color: P.inkDim }}>{r.response_code ?? '—'}</span> },
      { label: 'Next attempt', key: 'next_attempt_at', render: (r) => <span style={{ fontSize: 12, color: P.inkDim }}>{r.next_attempt_at ? window.HWIdv.fmt.relative(r.next_attempt_at) : '—'}</span> },
      { label: 'Error', key: 'error', render: (r) => <span style={{ fontSize: 11.5, color: P.bad }}>{r.error || ''}</span> },
    ];

    return (
      <Sheet open onClose={onClose} width={560}>
        <div style={{ padding: 16, borderBottom: `1px solid ${P.hairline2}`, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: P.type.title, fontWeight: 700, color: P.ink }}>Deliveries</div>
            <div style={{ fontFamily: P.fontMono, fontSize: 11.5, color: P.inkDim, wordBreak: 'break-all', marginTop: 2 }}>{webhook.url}</div>
          </div>
          <PBtn variant="secondary" size="sm" onClick={sendTest} busy={testing}>Send test</PBtn>
          <IconBtn icon="x" onClick={onClose} label="Close" />
        </div>
        <div style={{ padding: '10px 16px', fontSize: P.type.meta, color: P.inkDim, lineHeight: 1.5, borderBottom: `1px solid ${P.hairline}` }}>
          A delivery retries at 60 seconds, then 240 seconds, then is marked dead. A dead delivery keeps its payload so it can be replayed once the receiver is fixed — nothing is silently discarded.
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {poll.loading && !poll.data ? <window.IdvShared.SkeletonTable rows={4} /> :
           poll.error ? <PanelError poll={poll} subject="Deliveries" /> :
           rows.length === 0 ? <EmptyState icon="plug" title="No deliveries yet" body="Nothing has fired to this destination. Send a test to see one appear." compact /> :
           <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} dense />}
        </div>
      </Sheet>);
  }

  function WebhooksCard({ can }) {
    const P = useP();
    const poll = window.HWIdv.usePoll('/api/idv/webhooks', 20000);
    const [showAdd, setShowAdd] = React.useState(false);
    const [drawerRow, setDrawerRow] = React.useState(null);
    const [testingId, setTestingId] = React.useState(null);
    const rows = (poll.data && poll.data.rows) || [];

    function sendTest(row) {
      setTestingId(row.id);
      window.HWIdv.post('/api/idv/webhooks/' + row.id + '/test', {}).then((r) => {
        setTestingId(null);
        if (r.ok) { window.hdToast?.({ title: 'Test delivery sent', description: (r.body && r.body.delivery && r.body.delivery.status) || 'queued', tone: 'ok' }); poll.refresh(); }
        else window.hdToast?.({ title: 'Test delivery failed to send', description: r.error || ('HTTP ' + r.code), tone: 'blocked' });
      });
    }

    const columns = [
      { label: 'Destination', key: 'url', render: (r) => (
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: P.fontMono, fontSize: 12, color: P.ink, wordBreak: 'break-all' }}>{r.url}</div>
          <div style={{ fontFamily: P.fontMono, fontSize: 10.5, color: P.inkMute, marginTop: 2 }}>{(r.events || []).join(' · ')} · secret {r.secret_hint || '—'}</div>
        </div>) },
      { label: 'Active', key: 'active', width: 80, render: (r) => <Pill kind={r.active ? 'good' : 'neutral'} size="sm">{r.active ? 'active' : 'paused'}</Pill> },
      { label: 'Last delivery', key: 'last_delivery', render: (r) => r.last_delivery
        ? <span style={{ fontSize: 12, color: P.inkDim }}><Pill kind={DELIVERY_TONE[r.last_delivery.status] || 'neutral'} size="sm" dot>{r.last_delivery.status}</Pill> {r.last_delivery.code ?? ''} · {window.HWIdv.fmt.relative(r.last_delivery.at)}</span>
        : <span style={{ fontSize: 12, color: P.inkMute }}>none yet</span> },
      { label: '', key: 'actions', align: 'right', render: (r) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <PBtn variant="ghost" size="xs" onClick={() => sendTest(r)} busy={testingId === r.id}>Send test</PBtn>
          <IconBtn icon="list" size={15} label="View deliveries" onClick={() => setDrawerRow(r)} />
        </div>) },
    ];

    return (
      <Card>
        <CardHead icon="plug" title="Webhook destinations" meta={<Pill kind="neutral" size="sm">{rows.length}</Pill>}
          action={<PBtn variant="secondary" size="sm" icon="plus" onClick={() => setShowAdd(true)} disabled={!can('webhooks')} title={can('webhooks') ? undefined : 'Admin role required to add a destination'}>Add destination</PBtn>} />
        {poll.loading && !poll.data ? <window.IdvShared.SkeletonTable rows={2} /> :
         poll.error ? <PanelError poll={poll} subject="Webhook destinations" /> :
         rows.length === 0 ? <EmptyState icon="plug" title="No destinations yet" body="Add one to hear status.updated and data.updated as they happen, instead of polling." compact /> :
         <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} dense />}
        {!can('webhooks') && <div style={{ marginTop: 10, fontSize: P.type.meta, color: P.inkMute }}>You are signed in as an analyst (the estate’s fallback identity) — adding a destination needs admin.</div>}
        {showAdd && <AddWebhookModal onClose={() => setShowAdd(false)} onCreated={poll.refresh} />}
        {drawerRow && <DeliveriesDrawer webhook={drawerRow} onClose={() => setDrawerRow(null)} />}
      </Card>);
  }

  // ── (3) Snippets ──────────────────────────────────────────────────────────
  function SnippetsCard({ base, workflowId }) {
    const P = useP();
    const [tab, setTab] = React.useState('curl');
    const wfid = workflowId || '<workflow_id>';
    const code = {
      curl: curlSnippet(base, wfid),
      node: nodeSnippet(base, wfid),
      'verify-node': NODE_VERIFY,
      'verify-python': PY_VERIFY,
    }[tab];
    return (
      <Card>
        <CardHead icon="scroll" title="Snippets" />
        <Tabs value={tab} onChange={setTab} style={{ marginBottom: 12 }} options={[
          { value: 'curl', label: 'curl' },
          { value: 'node', label: 'Node' },
          { value: 'verify-node', label: 'Verify webhook (Node)' },
          { value: 'verify-python', label: 'Verify webhook (Python)' },
        ]} />
        <CodeBlock code={code} />
        <div style={{ marginTop: 12, fontSize: P.type.meta, color: P.inkDim, lineHeight: 1.5 }}>
          Field names are Didit’s, verbatim, on <span style={{ fontFamily: P.fontMono }}>/v3/*</span>. Hosted capture page: <span style={{ fontFamily: P.fontMono }}>{base}/verify/{'{session_token}'}</span> — valid for that workflow’s own <span style={{ fontFamily: P.fontMono }}>session_ttl_minutes</span>, iframe-embeddable for the origins in <span style={{ fontFamily: P.fontMono }}>IDV_FRAME_ANCESTORS</span>.
        </div>
      </Card>);
  }

  // ── (4) Moving hyperwolf.com off Didit ───────────────────────────────────
  function MigrationCard({ base, workflowId }) {
    const P = useP();
    const [checked, setChecked] = React.useState({});
    return (
      <Card>
        <CardHead icon="swap" title="Moving hyperwolf.com off Didit" meta={<Pill kind="info" size="sm">byte-compatible drop-in</Pill>} />
        <div style={{ fontSize: P.type.body, color: P.inkDim, lineHeight: 1.5, marginBottom: 12 }}>
          The paths and field names on <span style={{ fontFamily: P.fontMono }}>/v2/*</span> match Didit’s, so nothing in the frontend needs to change if this server honours the list below — from <span style={{ fontFamily: P.fontMono }}>scratch/idv-live-site-integration-digest-2026-09-08.md §5b</span>.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 4 }}>
          {MIGRATION_ITEMS.map((text, i) => (
            <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <span style={{ marginTop: 1 }}><Check on={!!checked[i]} onChange={() => setChecked((c) => ({ ...c, [i]: !c[i] }))} size={17} /></span>
              <span style={{ fontSize: 12.5, color: checked[i] ? P.inkMute : P.ink2, lineHeight: 1.55, textDecoration: checked[i] ? 'line-through' : 'none' }}>{text}</span>
            </label>))}
        </div>
        <div style={{ marginTop: 14, padding: 12, background: P.canvas2, border: `1px solid ${P.hairline}`, borderRadius: P.r8 }}>
          <div style={{ fontSize: P.type.meta, fontWeight: 600, color: P.inkDim, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>Item 6, resolved for this server</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontFamily: P.fontMono, fontSize: 12 }}>
            <div><span style={{ color: P.inkMute }}>DIDIT_API_BASE_URL</span> → <span style={{ color: P.ink }}>{base}</span></div>
            <div><span style={{ color: P.inkMute }}>DIDIT_API_KEY</span> → <span style={{ color: P.ink }}>a key from API keys, above</span></div>
            <div><span style={{ color: P.inkMute }}>DIDIT_WORKFLOW_ID</span> → <span style={{ color: P.ink }}>{workflowId || 'no workflow exists yet — create one on the Workflows screen'}</span></div>
            <div><span style={{ color: P.inkMute }}>CSP frame-src</span> → <span style={{ color: P.ink }}>add {base}</span></div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, padding: 10, background: P.warnSoft, borderRadius: P.r8 }}>
          <Icon name="alert" size={15} stroke={1.8} color={P.warn} style={{ flex: '0 0 auto', marginTop: 1 }} />
          <div style={{ fontSize: P.type.meta, color: P.warnText, lineHeight: 1.5 }}>
            <span style={{ fontFamily: P.fontMono }}>In Review</span> is returned literally — escalation §11.2. The facade does not soften it; whether checkout should complete on <span style={{ fontFamily: P.fontMono }}>In Review</span> rather than wait for <span style={{ fontFamily: P.fontMono }}>Approved</span> is a change in the site, not in this facade.
          </div>
        </div>
      </Card>);
  }

  // ── (5) Try the engine ───────────────────────────────────────────────────
  // The API contract ships a 503 body with ok:false specifically so a caller
  // can tell "engine down" apart from "backend unreachable" — idv-client.jsx's
  // usePoll now keeps that body on a non-2xx response instead of discarding
  // it, so poll.data.ok === false is the precise signal, not a fallback from
  // poll.error. "Backend unreachable" (no seam, or a real network failure
  // that never got a body) is the only case left that falls through to
  // poll.error with no usable poll.data.
  function EnginePanel() {
    const P = useP();
    const poll = window.HWIdv.usePoll('/api/idv/engine/health', 15000);
    const noSeam = poll.error === 'no-live-seam';
    // Precise signal first (the 503 body itself says ok:false); fall back to
    // "no body ever arrived" (a network failure with a live seam) as the
    // same visible state — noSeam gets its own NotConnected panel below.
    const down = (poll.data && poll.data.ok === false) || (!!poll.error && !poll.data && !noSeam);
    const up = !down && poll.data && poll.data.ok;
    const models = (up && poll.data.models) || [];

    const columns = [
      { label: 'Capability', key: 'capability', render: (r) => <span style={{ fontFamily: P.fontMono, fontSize: 12, color: P.ink }}>{r.capability}</span> },
      { label: 'Model', key: 'name' },
      { label: 'Version', key: 'version', render: (r) => <span style={{ fontFamily: P.fontMono, fontSize: 12, color: P.inkDim }}>{r.version}</span> },
      { label: 'Licence', key: 'licence', render: (r) => <span style={{ fontSize: 12, color: P.inkDim }}>{r.licence}</span> },
      { label: 'Loaded', key: 'loaded', align: 'right', render: (r) => <Pill kind={r.loaded ? 'good' : 'neutral'} size="sm" dot>{r.loaded ? 'loaded' : 'not loaded'}</Pill> },
    ];

    return (
      <Card>
        <CardHead icon="zap" title="Try the engine" meta={up ? <Pill kind="good" size="sm" dot>reachable · v{poll.data.version}</Pill> : down ? <Pill kind="warn" size="sm" dot>not reachable</Pill> : <Pill kind="neutral" size="sm">checking…</Pill>}
          action={<PBtn variant="ghost" size="sm" icon="refresh" onClick={poll.refresh}>Recheck</PBtn>} />
        <div style={{ fontSize: P.type.body, color: P.inkDim, lineHeight: 1.5, marginBottom: 12 }}>
          Every model the engine has loaded, with its licence — what a threshold change on a workflow actually runs against.
        </div>
        {noSeam ? <window.IdvShared.NotConnected onRetry={poll.refresh} compact /> :
         poll.loading && !poll.data ? <window.IdvShared.SkeletonTable rows={3} /> :
         down ? <ErrorState compact title="Engine not reachable" onRetry={poll.refresh}
           body="The backend answered, but the verification engine did not. Nothing runs against thresholds or scores until it comes back." /> :
         models.length === 0 ? <EmptyState icon="zap" title="No models reported" body="The engine is up but reported no loaded models — check its own startup log." compact /> :
         <>
           <DataTable columns={columns} rows={models} rowKey={(r) => r.capability + r.name} dense />
           <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: P.type.meta, color: P.inkMute }}>
             <span>queue depth <b style={{ color: P.ink2 }}>{poll.data.queue_depth}</b></span>
             <span>last callback <b style={{ color: P.ink2 }}>{poll.data.last_callback_at ? window.HWIdv.fmt.relative(poll.data.last_callback_at) : 'never'}</b></span>
             <span>arch <b style={{ color: P.ink2, fontFamily: P.fontMono }}>{poll.data.arch}</b></span>
           </div>
         </>}
      </Card>);
  }

  // ── screen ────────────────────────────────────────────────────────────────
  window.IdvIntegrateScreen = function IdvIntegrateScreen(props) {
    const P = useP();
    const role = props && props.role ? props.role : window.HWIdv.role();
    const can = (props && props.can) ? props.can : window.HWIdv.can;
    const workflowsPoll = window.HWIdv.usePoll('/api/idv/workflows', 60000);
    const workflowId = (workflowsPoll.data && workflowsPoll.data.rows && workflowsPoll.data.rows[0] && workflowsPoll.data.rows[0].id) || null;
    const base = (window.HW_LIVE && window.HW_LIVE.base) || window.location.origin;

    return (
      <div>
        <SectionHead eyebrow="Connect" title="Integrate" level={2}
          subtitle="Everything another system needs to start a verification and hear the result. The paths and field names match Didit’s, so the site changes two environment variables and one content-security-policy host."
          action={<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Pill kind="neutral" size="sm">signed in as {role}</Pill><window.IdvShared.EngineBadge /></div>} />

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.05fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <ApiKeysCard can={can} />
            <SnippetsCard base={base} workflowId={workflowId} />
            <EnginePanel />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <WebhooksCard can={can} />
            <MigrationCard base={base} workflowId={workflowId} />
          </div>
        </div>
      </div>);
  };
})();
