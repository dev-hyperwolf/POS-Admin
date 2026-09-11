// ── forms-app/review.jsx — window.HWFormsReview: the Submissions tab ───────────────────────
// FORM-GENERATOR-PROPOSAL.md phase table, "Review/list screen, print layout, attachments":
// lists a form's submissions (who/when/station/status), opens one through window.HDForm's own
// `mode:'review'` (the SAME renderer fill mode uses — every field simply renders disabled, no
// second render path to keep in sync), shows its attachments inline, lets a manager
// Approve/Reject with a note, print the sheet, or export the whole list as CSV.
//
// IIFE, ONE GLOBAL: window.HWFormsReview. No other top-level name is declared here — same
// discipline shared/hd-form.jsx and forms-app/app.jsx already follow (test/global-collisions
// .test.mjs covers every file loaded by Hyperwolf Forms.html, this one included).
;(function () {
  const useP = window.useP;

  // window.HW_LIVE (shared/hw-live.js) is the estate's one write path — token attachment,
  // same-origin rule, never-rejects shape — same convention pos/data.jsx and every pos/screen-
  // *.jsx already use for a POST. Falls back to a plain fetch (matching forms-app/app.jsx's
  // and hd-form.jsx's own defaultSubmit, which also has no HW_LIVE dependency) so this file
  // works even if hw-live.js is ever dropped from a page that embeds just the Forms shell.
  function getJSON(path) {
    if (window.HW_LIVE && typeof window.HW_LIVE.get === 'function') return window.HW_LIVE.get(path);
    return fetch(path, { credentials: 'omit', cache: 'no-store' }).then((r) =>
      r.json().then((j) => ({ ok: r.ok, code: r.status, body: j }),
                    () => ({ ok: r.ok, code: r.status, body: null })),
    ).catch(() => ({ ok: false, code: 0, body: null }));
  }
  function postJSON(path, body) {
    if (window.HW_LIVE && typeof window.HW_LIVE.post === 'function') return window.HW_LIVE.post(path, body);
    return fetch(path, {
      method: 'POST', credentials: 'omit', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}),
    }).then((r) => r.json().then((j) => ({ ok: r.ok, code: r.status, body: j }),
                                  () => ({ ok: r.ok, code: r.status, body: null })),
    ).catch(() => ({ ok: false, code: 0, body: null }));
  }

  const STATUS_TONE = { submitted: 'info', reviewed: 'ok', rejected: 'blocked' };

  function StatusPill({ P, status }) {
    const HD = window.HD;
    const t = HD ? HD.tone(P, STATUS_TONE[status] || 'info') : { fg: P.ink, bg: P.surface2 };
    return React.createElement('span', {
      style: { fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, color: t.fg,
              background: t.bg, textTransform: 'uppercase', letterSpacing: '.02em', whiteSpace: 'nowrap' },
    }, status);
  }

  // One attachment, fetched over its own gated GET and shown as an image (or a link, for a
  // PDF) — a plain <img src="/api/forms/attachments/<id>"> cannot carry the x-hw-write-token
  // header a non-loopback deployment requires, so this fetches the bytes itself and hands the
  // browser a local blob: URL instead, same "fetch, don't just point a tag at it" shape
  // idv document previews already use.
  function AttachmentThumb({ P, att }) {
    const [src, setSrc] = React.useState(null);
    const [failed, setFailed] = React.useState(false);
    React.useEffect(() => {
      let url = null;
      let cancelled = false;
      fetch('/api/forms/attachments/' + encodeURIComponent(att.id), { credentials: 'omit', cache: 'no-store' })
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('HTTP ' + r.status))))
        .then((blob) => { if (cancelled) return; url = URL.createObjectURL(blob); setSrc(url); })
        .catch(() => { if (!cancelled) setFailed(true); });
      return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
    }, [att.id]);

    const isImage = (att.content_type || '').indexOf('image/') === 0;
    const box = { width: 120, height: 120, borderRadius: P.r8, border: `1px solid ${P.hairline2}` };
    let body;
    if (failed) {
      body = React.createElement('div', { style: Object.assign({}, box, { display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.inkMute, fontSize: 11, background: P.surface2 }) }, 'unavailable');
    } else if (isImage) {
      body = src
        ? React.createElement('img', { src, style: Object.assign({}, box, { objectFit: 'cover', display: 'block' }) })
        : React.createElement('div', { style: Object.assign({}, box, { background: P.surface2 }) });
    } else {
      body = React.createElement('a', {
        href: src || undefined, target: '_blank', rel: 'noreferrer',
        style: Object.assign({}, box, { display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.ink, textDecoration: 'none', fontSize: 12, fontWeight: 600, background: P.surface2 }),
      }, 'PDF');
    }
    return React.createElement('div', { style: { display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4, marginRight: 12, marginBottom: 12 } },
      body,
      React.createElement('span', { style: { fontSize: 11, color: P.inkMute, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, att.field_key));
  }

  function SubmissionDetail({ slug, submissionId, onClose, onReviewed }) {
    const P = useP();
    const hostRef = React.useRef(null);
    const rootRef = React.useRef(null);
    const [detail, setDetail] = React.useState(null);
    const [status, setStatus] = React.useState('loading');
    const [note, setNote] = React.useState('');
    const [busy, setBusy] = React.useState(false);

    React.useEffect(() => {
      let cancelled = false;
      setStatus('loading'); setDetail(null); setNote('');
      getJSON('/api/forms/submissions/' + encodeURIComponent(submissionId)).then((r) => {
        if (cancelled) return;
        if (!r.ok || !r.body || !r.body.submission) { setStatus('unavailable'); return; }
        setDetail(r.body.submission); setStatus('ready');
      });
      return () => { cancelled = true; };
    }, [submissionId]);

    React.useEffect(() => {
      if (!hostRef.current || !detail || !window.HDForm) return;
      if (rootRef.current) { try { rootRef.current.unmount(); } catch (e) {} }
      rootRef.current = window.HDForm.render(hostRef.current, {
        definition: detail.definition, mode: 'review', initial: detail.data || {},
      });
      return () => { if (rootRef.current) { try { rootRef.current.unmount(); } catch (e) {} } rootRef.current = null; };
    }, [detail]);

    function doReview(nextStatus) {
      setBusy(true);
      postJSON('/api/forms/submissions/' + encodeURIComponent(submissionId) + '/review',
        { status: nextStatus, note: note.trim() || null }).then((r) => {
        setBusy(false);
        if (r.ok) {
          window.hdToast && window.hdToast({ title: nextStatus === 'reviewed' ? 'Approved' : 'Rejected', tone: nextStatus === 'reviewed' ? 'ok' : 'warn' });
          onReviewed && onReviewed();
        } else {
          const msg = (r.body && r.body.error && r.body.error.message) || 'Review failed';
          window.hdToast && window.hdToast({ title: msg, tone: 'blocked' });
        }
      });
    }

    if (status === 'loading') return React.createElement('div', { style: { padding: 20, color: P.inkMute } }, 'Loading submission…');
    if (status === 'unavailable' || !detail) {
      return React.createElement('div', { style: { padding: 20 } },
        window.PBtn && React.createElement(window.PBtn, { variant: 'secondary', onClick: onClose }, '← Back'),
        React.createElement('div', { style: { marginTop: 12, color: P.inkMute } }, 'Submission not found.'));
    }

    const HD = window.HD;
    const when = HD ? HD.formatDateTime(detail.submitted_at) : detail.submitted_at;
    return React.createElement('div', { style: { padding: 20, maxWidth: 760 } },
      React.createElement('div', { className: 'hdform-no-print', style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' } },
        window.PBtn && React.createElement(window.PBtn, { variant: 'secondary', onClick: onClose }, '← Back'),
        React.createElement(StatusPill, { P, status: detail.status }),
        React.createElement('span', { style: { fontSize: 12.5, color: P.inkMute } },
          (detail.submitted_by || 'unknown') + ' · ' + when + (detail.station_id ? ' · ' + detail.station_id : '') + ' · v' + detail.form_version),
        React.createElement('div', { style: { flex: 1 } }),
        window.PBtn && React.createElement(window.PBtn, { variant: 'secondary', icon: 'printer', onClick: () => window.print() }, 'Print')),
      React.createElement('div', { ref: hostRef }),
      detail.attachments && detail.attachments.length > 0 && React.createElement('div', { style: { marginTop: 20 } },
        React.createElement('div', { style: { fontSize: 11.5, fontWeight: 700, color: P.inkMute, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.03em' } }, 'Attachments'),
        detail.attachments.map((a) => React.createElement(AttachmentThumb, { key: a.id, P, att: a }))),
      detail.review_note && React.createElement('div', { className: 'hdform-no-print', style: { marginTop: 12, fontSize: 12.5, color: P.inkMute } }, 'Review note: ' + detail.review_note),
      detail.status === 'submitted' && React.createElement('div', { className: 'hdform-no-print', style: { marginTop: 24, borderTop: `1px solid ${P.hairline2}`, paddingTop: 16 } },
        React.createElement('textarea', {
          value: note, onChange: (e) => setNote(e.target.value), placeholder: 'Review note (optional)', rows: 3,
          style: { width: '100%', padding: 10, borderRadius: P.r8, border: `1px solid ${P.fieldBorder || P.hairline2}`,
                  background: P.field || P.surface, color: P.ink, fontFamily: 'inherit', fontSize: 13, resize: 'vertical', marginBottom: 10 },
        }),
        React.createElement('div', { style: { display: 'flex', gap: 10 } },
          window.PBtn && React.createElement(window.PBtn, { variant: 'primary', busy, onClick: () => doReview('reviewed') }, 'Approve'),
          window.PBtn && React.createElement(window.PBtn, { variant: 'secondary', busy, onClick: () => doReview('rejected') }, 'Reject'))));
  }

  function SubmissionsList({ slug }) {
    const P = useP();
    const [rows, setRows] = React.useState([]);
    const [status, setStatus] = React.useState('loading');
    const [filter, setFilter] = React.useState('');
    const [openId, setOpenId] = React.useState(null);

    function load() {
      setStatus('loading');
      const q = filter ? ('?status=' + encodeURIComponent(filter)) : '';
      getJSON('/api/forms/' + encodeURIComponent(slug) + '/submissions' + q).then((r) => {
        if (!r.ok) { setStatus('unavailable'); return; }
        setRows((r.body && r.body.submissions) || []);
        setStatus('ready');
      });
    }
    React.useEffect(() => { setOpenId(null); load(); }, [slug, filter]);

    function exportCsv() {
      const q = filter ? ('?status=' + encodeURIComponent(filter)) : '';
      window.open('/api/forms/' + encodeURIComponent(slug) + '/submissions.csv' + q, '_blank');
    }

    if (openId != null) {
      return React.createElement(SubmissionDetail, {
        slug, submissionId: openId, onClose: () => setOpenId(null),
        onReviewed: () => { setOpenId(null); load(); },
      });
    }

    const cols = ['Who', 'When', 'Station', 'Status', ''];
    return React.createElement('div', { style: { padding: 20 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' } },
        window.Seg && React.createElement(window.Seg, {
          value: filter, onChange: setFilter,
          options: [{ value: '', label: 'All' }, { value: 'submitted', label: 'Submitted' },
                    { value: 'reviewed', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }],
        }),
        React.createElement('div', { style: { flex: 1 } }),
        window.PBtn && React.createElement(window.PBtn, { variant: 'secondary', icon: 'download', onClick: exportCsv }, 'Export CSV')),
      status === 'loading' && React.createElement('div', { style: { color: P.inkMute } }, 'Loading submissions…'),
      status === 'unavailable' && (window.ErrorState
        ? React.createElement(window.ErrorState, { title: 'Submissions not available', compact: true })
        : React.createElement('div', { style: { color: P.inkMute } }, 'Submissions not available.')),
      status === 'ready' && rows.length === 0 && (window.EmptyState
        ? React.createElement(window.EmptyState, { icon: 'note', title: 'No submissions yet' })
        : React.createElement('div', { style: { color: P.inkMute } }, 'No submissions yet.')),
      status === 'ready' && rows.length > 0 && React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: 13 } },
        React.createElement('thead', null, React.createElement('tr', null,
          cols.map((h) => React.createElement('th', {
            key: h, style: { textAlign: 'left', padding: '8px 10px', borderBottom: `1px solid ${P.hairline2}`, color: P.inkMute, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' },
          }, h)))),
        React.createElement('tbody', null, rows.map((s) => React.createElement('tr', {
          key: s.id, onClick: () => setOpenId(s.id), style: { cursor: 'pointer' },
        },
          React.createElement('td', { style: { padding: '8px 10px', borderBottom: `1px solid ${P.hairline2}` } }, s.submitted_by || '—'),
          React.createElement('td', { style: { padding: '8px 10px', borderBottom: `1px solid ${P.hairline2}` } }, window.HD ? window.HD.formatDateTime(s.submitted_at) : s.submitted_at),
          React.createElement('td', { style: { padding: '8px 10px', borderBottom: `1px solid ${P.hairline2}` } }, s.station_id || '—'),
          React.createElement('td', { style: { padding: '8px 10px', borderBottom: `1px solid ${P.hairline2}` } }, React.createElement(StatusPill, { P, status: s.status })),
          React.createElement('td', { style: { padding: '8px 10px', borderBottom: `1px solid ${P.hairline2}`, textAlign: 'right', color: P.inkMute } }, 'Open →'))))));
  }

  window.HWFormsReview = SubmissionsList;
})();
