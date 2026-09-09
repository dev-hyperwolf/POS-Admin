// ── idv/screen-workflows.jsx ── window.IdvWorkflowsScreen ──────────────────
// Routes `#/workflows` (list) and `#/workflows/:id` (detail/editor), per
// docs/IDV-API-CONTRACT.md "Workflows, questionnaires, customization" and
// docs/IDV-PLAN-2026-09-08.md §3.1. Design source: the owner's pick,
// `explorations/Verify - Concept D - Floor.html` tab 8 "Workflows" — copied
// here verbatim for copy/structure, rebuilt in real atoms (Card, PBtn, Pill,
// Switch, Seg, Field, Stepper, DataTable, SectionHead, Eyebrow) + shared/
// states.jsx + idv-shared.jsx. Zero hex; every colour is `P.<token>`.
//
// ROUTING, updated: idv/app.jsx's `screenFor()` now has a WORKFLOW_DETAIL_RE
// alongside SESSION_DETAIL_RE, so `#/workflows/<id>` resolves to this screen
// via `location.hash` like every other detail route. The list-to-detail
// transition below still ALSO keeps its own local React state (`openId`,
// seeded from a literal `/workflows/:id` `path` prop via WORKFLOW_ID_RE) —
// harmless now that both paths agree, and it means this component doesn't
// care which route shape got it here.
//
// PATCH — updated: `PATCH /api/idv/workflows/{id}` now goes through
// window.HWIdv.patch() (idv/idv-client.jsx); the local `idvPatch()` mirror
// of that same request-building was a plain duplicate and has been removed.
//
// Data source: GET /api/idv/workflows already returns the FULL Workflow shape
// per row (config included) — there is no single-workflow GET route in the
// contract, so detail is a lookup into the same polled list, never a second
// fetch. PATCH re-uses that same poll's `refresh()` afterward ("re-GET after
// save"), and the edited row is taken from the refreshed rows, never held
// stale in local state.
;(function () {
  const useP = window.useP;
  const HWIdv = window.HWIdv;
  const IdvShared = window.IdvShared;

  // ── feature vocabulary (docs/IDV-API-CONTRACT.md "Common fragments" +
  // idv_workflows.features enum, plan §3.1) ─────────────────────────────────
  // Order matches the Concept D mockup and the plan's DDL comment.
  const FEATURES = [
    { key: 'OCR', label: 'OCR — document read', note: { kind: 'neutral', text: 'required' } },
    { key: 'LIVENESS', label: 'LIVENESS', note: { kind: 'warn', text: 'uncertified' } },
    { key: 'FACE_MATCH', label: 'FACE_MATCH', note: null },
    { key: 'IP_ANALYSIS', label: 'IP_ANALYSIS', note: null },
    { key: 'AGE_ESTIMATION', label: 'AGE_ESTIMATION', note: { kind: 'neutral', text: 'off — the barcode has the DOB' } },
    { key: 'QUESTIONNAIRE', label: 'QUESTIONNAIRE', note: null },
    { key: 'PHONE_VERIFICATION', label: 'PHONE_VERIFICATION', note: null },
    { key: 'EMAIL_VERIFICATION', label: 'EMAIL_VERIFICATION', note: null },
  ];
  // Declared-unsupported per plan §3.1 Rules — a FIXED set of four, always
  // shown greyed regardless of what a given workflow's own
  // `unsupported_features` array happens to contain, because the row exists
  // to say "the engine cannot run this," not to reflect a per-workflow
  // choice. Whether the switch reads on/off still reflects the workflow's
  // own stored flag, because that flag is what makes an imported Didit
  // workflow round-trip byte-for-byte (plan §3.1) — only its *editability*
  // is fixed off.
  const UNSUPPORTED = [
    { key: 'NFC', label: 'NFC' },
    { key: 'AML', label: 'AML' },
    { key: 'DATABASE_VALIDATION', label: 'DATABASE_VALIDATION' },
    { key: 'PROOF_OF_ADDRESS', label: 'PROOF_OF_ADDRESS' },
  ];
  const NOT_AVAILABLE = 'Not available on the Hyperwolf engine';

  const WORKFLOW_ID_RE = /^\/workflows\/([^/]+)$/;

  function shortId(id) {
    if (!id) return '—';
    return id.length > 14 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id;
  }

  function defaultWorkflow() {
    // Day-one default per plan §11 Escalation 1 (Cannabis Verification +
    // Selfie: OCR, IP, passive liveness, face match, age rule REC_21) — the
    // shape a fresh admin-created workflow starts from.
    return {
      name: 'New workflow',
      kind: 'KYC',
      status: 'active',
      features: ['OCR', 'LIVENESS', 'FACE_MATCH', 'IP_ANALYSIS'],
      unsupported_features: ['NFC', 'AML', 'DATABASE_VALIDATION', 'PROOF_OF_ADDRESS'],
      config: {
        face_liveness_method: 'PASSIVE',
        thresholds: { liveness_min: 70, face_match_min: 75, doc_quality_min: 60 },
        age_rule: 'REC_21',
        allowed_document_types: ['DL', 'ID', 'PASSPORT'],
        allowed_countries: ['USA'],
        out_of_state: 'allow',
        duplicate_person: 'review',
        ip: { tor: 'decline', hosting: 'review', vpn: 'review' },
        resubmission_max: 3,
        liveness_attempts_max: 3,
        expires_after_days: 365,
        session_ttl_minutes: 60,
        questionnaire_id: null,
        four_eyes: false,
        manual_fallback_when_engine_down: false,
      },
    };
  }

  // ── small composites the atom set doesn't cover ──────────────────────────
  // (pos/atoms.jsx has DualRange — two handles — and Stepper — integer +/-.
  // Neither is a single 0-100 threshold slider, so this is a local composite
  // built from primitive DOM + P tokens, the same category of thing
  // idv-shared.jsx's ScorePill/MediaThumb already are — not a duplicate of an
  // existing atom.)
  function ThresholdSlider({ label, value, onChange, consequence, disabled }) {
    const P = useP();
    const clamp = (n) => Math.max(0, Math.min(100, Math.round(isNaN(n) ? 0 : n)));
    const trackCss = `
      .hw-idv-th-range { -webkit-appearance:none; appearance:none; background:transparent; width:100%; height:24px; margin:0; position:relative; z-index:1; }
      .hw-idv-th-range::-webkit-slider-thumb { -webkit-appearance:none; width:16px; height:16px; border-radius:99px; background:${P.surface}; border:2px solid ${disabled ? P.hairline3 : P.ink}; box-shadow:${P.shadowSm}; cursor:${disabled ? 'default' : 'grab'}; margin-top:0; }
      .hw-idv-th-range::-moz-range-thumb { width:16px; height:16px; border-radius:99px; background:${P.surface}; border:2px solid ${disabled ? P.hairline3 : P.ink}; box-shadow:${P.shadowSm}; cursor:${disabled ? 'default' : 'grab'}; }
      .hw-idv-th-range::-webkit-slider-runnable-track, .hw-idv-th-range::-moz-range-track { background:transparent; }
    `;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <Eyebrow>{label}</Eyebrow>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative', flex: 1, height: 24, display: 'flex', alignItems: 'center' }}>
            <style>{trackCss}</style>
            <div style={{ position: 'absolute', left: 0, right: 0, height: 4, borderRadius: P.r999, background: P.surface3 }} />
            <div style={{ position: 'absolute', left: 0, width: `${value}%`, height: 4, borderRadius: P.r999, background: disabled ? P.hairline3 : P.accent }} />
            <input className="hw-idv-th-range" type="range" min={0} max={100} step={1} value={value} disabled={disabled}
              aria-label={label} onChange={(e) => onChange(clamp(+e.target.value))} />
          </div>
          <Field size="sm" mono full={false} value={String(value)} disabled={disabled} style={{ width: 66 }}
            onChange={(e) => onChange(clamp(parseInt(e.target.value, 10)))} />
        </div>
        {consequence && <div style={{ fontSize: P.type.meta, color: P.inkDim, lineHeight: 1.4 }}>{consequence}</div>}
      </div>);
  }

  function RadioCard({ selected, title, subtitle, warning, disabled, onClick }) {
    const P = useP();
    return (
      <Card elevation="flat" onClick={disabled ? undefined : onClick} hover={!disabled}
        style={{ opacity: disabled ? 0.55 : 1, cursor: disabled ? 'default' : 'pointer',
          border: `1px solid ${selected ? P.ink : P.hairline2}`, display: 'flex', gap: 11, padding: 12 }}>
        <span style={{ width: 16, height: 16, borderRadius: 99, flex: '0 0 auto', marginTop: 1,
          border: `1.5px solid ${selected ? P.ink : P.hairline3}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {selected && <span style={{ width: 8, height: 8, borderRadius: 99, background: P.ink }} />}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: P.type.strong, fontWeight: 700, color: P.ink }}>{title}</div>
          <div style={{ fontSize: P.type.meta, color: P.inkDim, marginTop: 2, lineHeight: 1.4 }}>{subtitle}</div>
          {warning && <div style={{ marginTop: 8 }}><Card elevation="sunken" padding={10}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: P.warnText }} />
              <span style={{ fontSize: P.type.meta, fontWeight: 700, color: P.warnText }}>{warning.title}</span>
            </div>
            <div style={{ fontSize: P.type.meta, color: P.inkDim, lineHeight: 1.45 }}>{warning.body}</div>
          </Card></div>}
        </div>
      </Card>);
  }

  // Read-only wrapper for atoms without their own `disabled` prop (Switch,
  // Seg, Stepper) — visual + interaction lock, no atom edit required.
  function Lockable({ locked, children }) {
    return <div style={locked ? { opacity: 0.5, pointerEvents: 'none' } : undefined}>{children}</div>;
  }

  function FeatureRow({ label, on, onChange, note, locked }) {
    const P = useP();
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 30 }}>
        <Lockable locked={locked}><Switch on={on} onChange={onChange} size={20} /></Lockable>
        <span style={{ fontSize: P.type.body, fontWeight: 600, color: P.ink }}>{label}</span>
        {note && <Pill kind={note.kind} size="sm" style={{ marginLeft: 'auto' }}>{note.text}</Pill>}
      </div>);
  }

  function UnsupportedRow({ label, on }) {
    const P = useP();
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 30, opacity: 0.55 }}>
        <span style={{ width: 33, height: 20, borderRadius: 99, background: P.hairline3, flex: '0 0 auto', display: 'flex', alignItems: 'center', padding: 2 }}>
          <span style={{ width: 16, height: 16, borderRadius: 99, background: P.surface, transform: on ? 'translateX(13px)' : 'translateX(0)' }} />
        </span>
        <span style={{ fontSize: P.type.body, fontWeight: 600, color: P.inkMute }}>{label}</span>
        <Pill kind="ghost" size="sm" style={{ marginLeft: 'auto' }}>{NOT_AVAILABLE}</Pill>
      </div>);
  }

  function CapField({ label, value, onChange, locked, width = '100%' }) {
    const P = useP();
    return (
      <div style={{ minWidth: 0 }}>
        <Eyebrow style={{ marginBottom: 6 }}>{label}</Eyebrow>
        <Field mono size="sm" value={String(value)} disabled={locked} style={{ width }}
          onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)} />
      </div>);
  }

  function ChoiceRow({ label, value, onChange, options, locked, note }) {
    const P = useP();
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: `1px solid ${P.hairline}` }}>
        <div style={{ fontSize: P.type.body, color: P.ink2, fontWeight: 600 }}>{label}{note && <span style={{ fontWeight: 400, color: P.inkFaint }}> · {note}</span>}</div>
        <Lockable locked={locked}><Seg size="sm" value={value} onChange={onChange} options={options} /></Lockable>
      </div>);
  }

  // ── Versions panel — fetched lazily on "Version history" click ──────────
  function VersionsPanel({ workflowId, currentVersion }) {
    const P = useP();
    const [state, setState] = React.useState({ loading: true, error: null, rows: null });
    React.useEffect(() => {
      let alive = true;
      setState({ loading: true, error: null, rows: null });
      HWIdv.get(`/api/idv/workflows/${encodeURIComponent(workflowId)}/versions`).then((r) => {
        if (!alive) return;
        if (!r.ok) { setState({ loading: false, error: r.error || `HTTP ${r.code}`, rows: null }); return; }
        // docs/IDV-API-CONTRACT.md addendum J: the route's response changed
        // shape from a bare array to `{ idv_version, rows: [...] }` (the
        // counter needed somewhere to live). Accept both defensively — a
        // bare array is still what an older/cached backend or a test fixture
        // may hand back.
        const body = r.body;
        const rows = Array.isArray(body) ? body : (body && Array.isArray(body.rows) ? body.rows : []);
        setState({ loading: false, error: null, rows: rows });
      });
      return () => { alive = false; };
    }, [workflowId]);

    return (
      <Card elevation="flat" style={{ marginTop: 12 }}>
        <SectionHead level={3} eyebrow="History" title="Version history" style={{ marginBottom: 10 }} />
        {state.loading && <IdvShared.SkeletonTable rows={3} />}
        {!state.loading && state.error && (
          state.error === 'no-live-seam'
            ? <IdvShared.NotConnected compact />
            : <ErrorState compact title="Versions didn't load" detail={state.error} />
        )}
        {!state.loading && !state.error && state.rows && state.rows.length === 0 && (
          <EmptyState compact icon="clock" title="No prior versions" body="This workflow has never been edited." />
        )}
        {!state.loading && !state.error && state.rows && state.rows.length > 0 && (
          <DataTable
            columns={[
              { label: 'Version', key: 'version', render: (r) => (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: P.fontMono, fontWeight: 700 }}>
                  {`v${r.version}`}{r.version === currentVersion && <Pill kind="good" size="sm">current</Pill>}
                </span>) },
              { label: 'Features', key: 'features', render: (r) => (Array.isArray(r.features) ? r.features.length : 0) + ' enabled' },
              { label: 'Changed', key: 'created_at', render: (r) => HWIdv.fmt.date(r.created_at) },
            ]}
            rows={state.rows.slice().sort((a, b) => b.version - a.version)}
            rowKey={(r) => r.version}
            dense
          />
        )}
        {/* The contract's versions response ({version, features, config, created_at}) has no
            actor/"sessions pinned" field — unlike the exploration mockup's "By"/"Sessions pinned"
            columns, which are sample data, not part of the API contract. Never invented here. */}
        <div style={{ fontSize: P.type.meta, color: P.inkFaint, marginTop: 10, lineHeight: 1.5 }}>
          A session pins <code style={{ fontFamily: P.fontMono }}>workflow_id</code> and its version at creation —
          saving a new version never rewrites the rules a finished session ran under.
        </div>
      </Card>);
  }

  // ── Detail / editor ───────────────────────────────────────────────────────
  function WorkflowDetail({ workflow, canWrite, onBack, onSaved, refreshing }) {
    const P = useP();
    const [draft, setDraft] = React.useState(() => ({
      name: workflow.name,
      status: workflow.status,
      features: workflow.features.slice(),
      config: JSON.parse(JSON.stringify(workflow.config || {})),
    }));
    const [showVersions, setShowVersions] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [saveError, setSaveError] = React.useState(null);

    // A newly-opened workflow (different id) resets the draft to its own data.
    React.useEffect(() => {
      setDraft({
        name: workflow.name,
        status: workflow.status,
        features: workflow.features.slice(),
        config: JSON.parse(JSON.stringify(workflow.config || {})),
      });
      setSaveError(null);
    }, [workflow.id]);

    const locked = !canWrite;
    const cfg = draft.config || {};
    const th = cfg.thresholds || {};

    function patchCfg(partial) { setDraft((d) => ({ ...d, config: { ...d.config, ...partial } })); }
    function patchThreshold(key, value) { patchCfg({ thresholds: { ...th, [key]: value } }); }
    function patchIp(key, value) { patchCfg({ ip: { ...(cfg.ip || {}), [key]: value } }); }
    function hasFeature(key) { return draft.features.indexOf(key) !== -1; }
    function toggleFeature(key) {
      setDraft((d) => ({ ...d, features: d.features.indexOf(key) !== -1 ? d.features.filter((f) => f !== key) : d.features.concat([key]) }));
    }

    function handleSave() {
      if (!canWrite || saving) return;
      setSaving(true); setSaveError(null);
      const body = {
        name: draft.name, kind: workflow.kind, status: draft.status,
        features: draft.features, unsupported_features: workflow.unsupported_features,
        config: draft.config,
      };
      HWIdv.patch(`/api/idv/workflows/${encodeURIComponent(workflow.id)}`, body).then((r) => {
        setSaving(false);
        if (!r.ok) {
          setSaveError(r.error || `HTTP ${r.code}`);
          window.hdToast && window.hdToast({ title: 'Save failed', description: r.error || `HTTP ${r.code}`, tone: 'bad' });
          return;
        }
        const saved = r.body;
        window.hdToast && window.hdToast({ title: `Saved as v${saved && saved.version != null ? saved.version : workflow.version + 1}`, tone: 'good' });
        onSaved(saved);
      });
    }

    const nextVersion = workflow.version + 1;

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <IconBtn icon="chevron-left" label="Back to Workflows" onClick={onBack} style={{ marginTop: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Eyebrow>{`Back office · workflow · version ${workflow.version}${JSON.stringify(draft) !== JSON.stringify({ name: workflow.name, status: workflow.status, features: workflow.features, config: workflow.config }) ? ', editing' : ''}`}</Eyebrow>
            <h2 style={{ margin: '4px 0 0', fontSize: P.type.h2, fontWeight: 700, color: P.ink, letterSpacing: '-.01em' }}>{draft.name}</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Pill kind={draft.status === 'active' ? 'good' : 'neutral'} size="sm">{draft.status}</Pill>
            <Pill kind="neutral" size="sm" style={{ fontFamily: P.fontMono }}>{shortId(workflow.id)}</Pill>
            <PBtn variant="secondary" size="sm" icon="clock" onClick={() => setShowVersions((v) => !v)}>Version history</PBtn>
            <PBtn variant="accent" size="sm" icon="check" busy={saving} disabled={locked}
              title={locked ? 'Needs an admin role' : undefined} onClick={handleSave}>
              {`Save as v${nextVersion}`}
            </PBtn>
          </div>
        </div>

        {locked && (
          <Card elevation="sunken" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 9 }}>
            <Icon name="lock" size={15} stroke={2} color={P.inkMute} />
            <span style={{ fontSize: P.type.meta, color: P.inkDim }}>
              Viewing as {`role: `}{HWIdv.role()}. Editing and saving workflows needs an admin role.
            </span>
          </Card>
        )}
        {saveError && <div style={{ marginBottom: 14 }}><ErrorState compact title="That didn't save" detail={saveError} onRetry={handleSave} /></div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 14, alignItems: 'start' }}>
          {/* Features */}
          <Card elevation="flat">
            <SectionHead level={3} eyebrow="What runs" title="Features" style={{ marginBottom: 10 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {FEATURES.map((f) => (
                <FeatureRow key={f.key} label={f.label} note={f.note} locked={locked}
                  on={hasFeature(f.key)} onChange={() => toggleFeature(f.key)} />
              ))}
              <div style={{ height: 1, background: P.hairline, margin: '6px 0' }} />
              {UNSUPPORTED.map((f) => (
                <UnsupportedRow key={f.key} label={f.label} on={(workflow.unsupported_features || []).indexOf(f.key) !== -1} />
              ))}
            </div>
            <div style={{ fontSize: P.type.meta, color: P.inkFaint, marginTop: 12, lineHeight: 1.5 }}>
              Four features are declared and stored but never run. They exist so an imported Didit
              workflow survives a round trip byte-for-byte. Turning one on would mean a third party,
              and there are none — from day one, by decision.
            </div>
          </Card>

          {/* Thresholds + Age rule */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Card elevation="flat">
              <SectionHead level={3} title="Thresholds" style={{ marginBottom: 10 }} />
              <div style={{ fontSize: P.type.meta, color: P.inkFaint, marginBottom: 12 }}>
                0–100, matching the API's scale.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <ThresholdSlider label="liveness_min" value={th.liveness_min ?? 0} disabled={locked}
                  onChange={(v) => patchThreshold('liveness_min', v)}
                  consequence={`Below → the guest is asked to redo that step, up to ${cfg.liveness_attempts_max ?? 3} tries, then Declined.`} />
                <ThresholdSlider label="face_match_min" value={th.face_match_min ?? 0} disabled={locked}
                  onChange={(v) => patchThreshold('face_match_min', v)}
                  consequence="Below → In Review with FACE_MATCH_LOW. Never an automatic decline." />
                <ThresholdSlider label="doc_quality_min" value={th.doc_quality_min ?? 0} disabled={locked}
                  onChange={(v) => patchThreshold('doc_quality_min', v)}
                  consequence={`Below → ask for that image again, up to ${cfg.resubmission_max ?? 3} tries.`} />
              </div>
            </Card>

            <Card elevation="flat">
              <SectionHead level={3} title="Age rule" style={{ marginBottom: 10 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <RadioCard selected={cfg.age_rule === 'REC_21'} disabled={locked}
                  onClick={() => patchCfg({ age_rule: 'REC_21' })}
                  title="REC_21"
                  subtitle="Recreational. 21 and over, read from the barcode date of birth. Under → Declined with UNDER_AGE." />
                <RadioCard selected={cfg.age_rule === 'MED_18_CARD'} disabled={locked}
                  onClick={() => patchCfg({ age_rule: 'MED_18_CARD' })}
                  title="MED_18_CARD"
                  subtitle="Medical. 18 and over plus a valid medical card. The engine can verify the age; it cannot verify the card."
                  warning={{ title: 'MED_18_CARD needs a ruling first', body: 'Which system says a customer is medical — a Blaze member flag passed in expected_details, or a photo of the card reviewed by an analyst? Until that’s answered, selecting it creates a rule with nothing behind it. Escalation §11.4.' }} />
              </div>
            </Card>
          </div>
        </div>

        <Card elevation="flat" style={{ marginTop: 14 }}>
          <SectionHead level={3} title="Liveness method" style={{ marginBottom: 10 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <RadioCard selected={cfg.face_liveness_method === 'PASSIVE'} disabled={locked}
              onClick={() => patchCfg({ face_liveness_method: 'PASSIVE' })}
              title="PASSIVE" subtitle="Two seconds of frames, nothing asked of the customer. Fastest. Weakest against a replayed video." />
            <RadioCard selected={cfg.face_liveness_method === 'ACTIVE_3D'} disabled={locked}
              onClick={() => patchCfg({ face_liveness_method: 'ACTIVE_3D' })}
              title="ACTIVE_3D" subtitle="Passive frames, then a server-nonce head turn. The nonce is what makes a pre-recorded clip fail." />
            <RadioCard selected={false} disabled title="FLASHING" subtitle="Not built: patent-blocked until 2033." />
          </div>
          <div style={{ fontSize: P.type.meta, color: P.inkFaint, marginTop: 12, lineHeight: 1.5 }}>
            No open passive-liveness model is ISO 30107-3 certified, and this build does not claim
            one is. The score carries the caption "open model · uncertified" everywhere it is shown.
          </div>
        </Card>

        <Card elevation="flat" style={{ marginTop: 14 }}>
          <SectionHead level={3} title="Caps and routing" style={{ marginBottom: 10 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 14, marginBottom: 14 }}>
            <div>
              <Eyebrow style={{ marginBottom: 6 }}>liveness_attempts_max</Eyebrow>
              <Lockable locked={locked}><Stepper value={cfg.liveness_attempts_max ?? 0} min={1} onChange={(v) => patchCfg({ liveness_attempts_max: v })} /></Lockable>
            </div>
            <div>
              <Eyebrow style={{ marginBottom: 6 }}>resubmission_max</Eyebrow>
              <Lockable locked={locked}><Stepper value={cfg.resubmission_max ?? 0} min={1} onChange={(v) => patchCfg({ resubmission_max: v })} /></Lockable>
            </div>
            <CapField label="session_ttl_minutes" value={cfg.session_ttl_minutes ?? 0} locked={locked} onChange={(v) => patchCfg({ session_ttl_minutes: v })} />
            <CapField label="expires_after_days" value={cfg.expires_after_days ?? 0} locked={locked} onChange={(v) => patchCfg({ expires_after_days: v })} />
          </div>
          <div>
            <ChoiceRow label="Out-of-state licence" value={cfg.out_of_state} locked={locked}
              onChange={(v) => patchCfg({ out_of_state: v })}
              options={[{ value: 'review', label: 'Review' }, { value: 'allow', label: 'Allow' }]} />
            <ChoiceRow label="Duplicate person" value={cfg.duplicate_person} locked={locked}
              onChange={(v) => patchCfg({ duplicate_person: v })}
              options={[{ value: 'review', label: 'Review' }, { value: 'decline', label: 'Decline' }]} />
            <ChoiceRow label="IP · Tor" value={(cfg.ip || {}).tor} locked={locked}
              onChange={(v) => patchIp('tor', v)}
              options={[{ value: 'decline', label: 'Decline' }, { value: 'review', label: 'Review' }, { value: 'allow', label: 'Allow' }]} />
            <ChoiceRow label="IP · hosting range" value={(cfg.ip || {}).hosting} locked={locked}
              onChange={(v) => patchIp('hosting', v)}
              options={[{ value: 'decline', label: 'Decline' }, { value: 'review', label: 'Review' }, { value: 'allow', label: 'Allow' }]} />
            <ChoiceRow label="IP · VPN" value={(cfg.ip || {}).vpn} locked={locked}
              onChange={(v) => patchIp('vpn', v)}
              options={[{ value: 'decline', label: 'Decline' }, { value: 'review', label: 'Review' }, { value: 'allow', label: 'Allow' }]} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderTop: `1px solid ${P.hairline}` }}>
              <div style={{ fontSize: P.type.body, color: P.ink2, fontWeight: 600 }}>Engine unavailable <span style={{ fontWeight: 400, color: P.inkFaint }}>· the register fails closed</span></div>
              <Lockable locked={locked}><Switch on={!!cfg.manual_fallback_when_engine_down} onChange={(v) => patchCfg({ manual_fallback_when_engine_down: v })} /></Lockable>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderTop: `1px solid ${P.hairline}` }}>
              <div style={{ fontSize: P.type.body, color: P.inkMute, fontWeight: 600 }}>Four-eyes on approve <span style={{ fontWeight: 400 }}>· Off — the system is autonomous</span></div>
              <div style={{ opacity: 0.5, pointerEvents: 'none' }}><Switch on={false} onChange={() => {}} /></div>
            </div>
          </div>
        </Card>

        {showVersions && <VersionsPanel workflowId={workflow.id} currentVersion={workflow.version} />}
      </div>);
  }

  // ── List ───────────────────────────────────────────────────────────────
  function WorkflowsTable({ rows, onOpen }) {
    const P = useP();
    return (
      <DataTable
        rowKey={(r) => r.id}
        onRowClick={(r) => onOpen(r.id)}
        columns={[
          { label: 'Name', key: 'name', render: (r) => (
            <div>
              <div style={{ fontWeight: 700, color: P.ink }}>{r.name}</div>
              <div style={{ fontSize: P.type.meta, color: P.inkFaint, fontFamily: P.fontMono }}>{r.kind}</div>
            </div>) },
          { label: 'Version', key: 'version', render: (r) => (
            <span style={{ fontFamily: P.fontMono, fontWeight: 700 }}>{`v${r.version}`}</span>) },
          { label: 'Status', key: 'status', render: (r) => <Pill kind={r.status === 'active' ? 'good' : 'neutral'} size="sm">{r.status}</Pill> },
          { label: 'Features', key: 'features', render: (r) => (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, maxWidth: 280 }}>
              {(r.features || []).slice(0, 4).map((f) => <Pill key={f} kind="ghost" size="sm">{f}</Pill>)}
              {(r.features || []).length > 4 && <Pill kind="ghost" size="sm">{`+${r.features.length - 4}`}</Pill>}
            </div>) },
          { label: 'Sessions', key: 'sessions_count', align: 'right', render: (r) => HWIdv.fmt.number(r.sessions_count) },
          { label: 'Updated', key: 'updated_at', render: (r) => HWIdv.fmt.relative(r.updated_at) },
        ]}
        rows={rows}
      />);
  }

  // ── Screen root ──────────────────────────────────────────────────────────
  window.IdvWorkflowsScreen = function IdvWorkflowsScreen(props) {
    const P = useP();
    const path = props && props.path;
    const canFn = (props && props.can) || (HWIdv && HWIdv.can) || (() => false);
    const canWrite = !!canFn('workflows');

    const poll = HWIdv.usePoll('/api/idv/workflows', 15000);
    const rows = (poll.data && poll.data.rows) || [];

    const detailMatch = WORKFLOW_ID_RE.exec(path || '');
    const [openId, setOpenId] = React.useState(detailMatch ? detailMatch[1] : null);
    const [creating, setCreating] = React.useState(false);

    const openWorkflow = rows.find((r) => r.id === openId) || null;

    function handleCreate() {
      if (!canWrite || creating) return;
      setCreating(true);
      HWIdv.post('/api/idv/workflows', defaultWorkflow()).then((r) => {
        setCreating(false);
        if (!r.ok) {
          window.hdToast && window.hdToast({ title: 'Could not create workflow', description: r.error || `HTTP ${r.code}`, tone: 'bad' });
          return;
        }
        window.hdToast && window.hdToast({ title: 'Workflow created', tone: 'good' });
        poll.refresh().then(() => { if (r.body && r.body.id) setOpenId(r.body.id); });
      });
    }

    function handleSaved(saved) {
      poll.refresh();
      if (saved && saved.id) setOpenId(saved.id);
    }

    const header = (
      <SectionHead
        eyebrow="Back office"
        title="Workflows"
        subtitle="Every rule a verification runs under: which features run, the thresholds that gate an approve, the age rule, and the caps. Editing writes a new version — a session already decided keeps the rules it ran under."
        action={
          <PBtn variant="accent" icon="plus" busy={creating} disabled={!canWrite}
            title={!canWrite ? 'Needs an admin role' : undefined} onClick={handleCreate}>
            New workflow
          </PBtn>
        }
        style={{ marginBottom: 16 }}
      />
    );

    // ── detail view ─────────────────────────────────────────────────────
    if (openId) {
      if (poll.loading && !poll.data) {
        return <div><IdvShared.SkeletonCard lines={6} /></div>;
      }
      if (poll.error && !poll.data) {
        return poll.error === 'no-live-seam'
          ? <IdvShared.NotConnected onRetry={poll.refresh} />
          : <ErrorState title="That didn't load" detail={poll.error} onRetry={poll.refresh} />;
      }
      if (!openWorkflow) {
        return (
          <EmptyState icon="workflow" title="Workflow not found"
            body="It may have been archived, or the list hasn't caught up yet."
            action={<PBtn variant="secondary" icon="chevron-left" onClick={() => setOpenId(null)}>Back to Workflows</PBtn>} />
        );
      }
      return (
        <WorkflowDetail workflow={openWorkflow} canWrite={canWrite}
          onBack={() => setOpenId(null)} onSaved={handleSaved} refreshing={poll.loading} />
      );
    }

    // ── list view ───────────────────────────────────────────────────────
    if (poll.loading && !poll.data) {
      return <div>{header}<IdvShared.SkeletonTable rows={5} /></div>;
    }
    if (poll.error && !poll.data) {
      return (
        <div>{header}
          {poll.error === 'no-live-seam'
            ? <IdvShared.NotConnected onRetry={poll.refresh} />
            : <ErrorState title="That didn't load" detail={poll.error} onRetry={poll.refresh} />}
        </div>);
    }
    if (rows.length === 0) {
      return (
        <div>{header}
          <EmptyState icon="workflow" title="No workflows yet"
            body="Create one to define what a verification checks and where it draws the line."
            action={canWrite ? <PBtn variant="accent" icon="plus" onClick={handleCreate}>New workflow</PBtn> : undefined} />
        </div>);
    }
    return (
      <div>
        {header}
        <WorkflowsTable rows={rows} onOpen={(id) => setOpenId(id)} />
      </div>);
  };
})();
