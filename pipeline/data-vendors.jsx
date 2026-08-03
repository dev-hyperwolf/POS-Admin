// ── Flags + vendor scorecards — continues the fake-data RNG sequence ──────
// Port of the tail of prototype/lib/fake-data.ts (FLAGS, VENDORS_FULL). Loaded
// straight after pipeline/data.jsx so the shared PRNG stays in step.
;(function () {
  const { rng, pick, range, floatRange, daysAgo } = window.HD_RNG;
  const VENDORS = window.HD_DATA.VENDORS;

  const FLAGS = [
    { key: 'intake.auto_post_threshold', category: 'Intake', description: 'Auto-post invoices when OCR confidence exceeds this value and variance is below the tolerance.', type: 'number', value: 0.92, default: 0.92, min: 0.6, max: 0.999, scope: 'platform', lastChangedAt: daysAgo(12), lastChangedBy: 'Manisha Patel' },
    { key: 'intake.variance_tolerance_pct', category: 'Intake', description: 'Maximum line-item $ variance (as % of line total) that still allows auto-post.', type: 'number', value: 0.02, default: 0.02, min: 0, max: 0.1, scope: 'platform' },
    { key: 'intake.cfo_escalation_threshold', category: 'Intake', description: 'Dollar variance above which the invoice is sent to CFO escalation queue instead of review.', type: 'number', value: 500, default: 500, min: 50, max: 10000, scope: 'entity', scopeTargets: ['thc', 'ccd'] },
    { key: 'ocr.provider', category: 'OCR', description: 'Primary OCR provider for PDF + image invoice extraction.', type: 'enum', enumOptions: ['textract', 'google_document_ai', 'anthropic_vision', 'composite'], value: 'composite', default: 'textract', scope: 'platform' },
    { key: 'ocr.confidence_floor', category: 'OCR', description: 'Minimum field-level OCR confidence below which fields are marked for review.', type: 'number', value: 0.75, default: 0.75, min: 0.5, max: 0.99, scope: 'platform' },
    { key: 'metrc.sync_interval_min', category: 'METRC', description: 'Interval (minutes) between background METRC manifest polls. Replacing the legacy 24hr sync.', type: 'number', value: 5, default: 5, min: 1, max: 60, scope: 'platform' },
    { key: 'metrc.webhook_enabled', category: 'METRC', description: 'Prefer METRC webhooks over polling when the state supports them. Falls back to poll.', type: 'boolean', value: true, default: true, scope: 'platform' },
    { key: 'batch.age_warn_hours', category: 'Batch', description: 'Hours in current status before the card border turns warn.', type: 'number', value: 12, default: 12, min: 1, max: 96, scope: 'entity' },
    { key: 'batch.age_blocked_hours', category: 'Batch', description: 'Hours in current status before the card border turns blocked.', type: 'number', value: 48, default: 48, min: 12, max: 168, scope: 'entity' },
    { key: 'batch.require_coa_before_approve', category: 'Batch', description: 'Block transition to Approved-for-Sale unless a COA file is attached.', type: 'boolean', value: true, default: true, scope: 'platform' },
    { key: 'credit.auto_generate_memo', category: 'Credit', description: 'Generate a draft credit memo automatically when a confirmed short-ship is detected.', type: 'boolean', value: true, default: false, scope: 'entity' },
    { key: 'credit.memo_require_photo', category: 'Credit', description: 'Require at least one evidence photo before a credit memo can be sent.', type: 'boolean', value: true, default: true, scope: 'platform' },
    { key: 'anomaly.cost_drift_pct', category: 'Anomaly', description: 'Percentage change in vendor unit cost that triggers an anomaly alert (7d vs 30d).', type: 'number', value: 0.05, default: 0.05, min: 0.01, max: 0.25, scope: 'platform' },
    { key: 'anomaly.short_ship_streak', category: 'Anomaly', description: 'Consecutive weeks of elevated short-ship rate before the vendor is flagged.', type: 'number', value: 3, default: 3, min: 1, max: 12, scope: 'platform' },
    { key: 'email.auto_ingest', category: 'Email', description: 'Automatically ingest vendor invoice emails from the ops@ inbox.', type: 'boolean', value: true, default: true, scope: 'platform' },
    { key: 'email.ingest_from_domains', category: 'Email', description: 'Allowlist of sender domains eligible for auto-ingest. Comma-separated.', type: 'string', value: 'kivaconfections.com,stiiizy.com,jeetpackaging.com,lowellfarms.com', default: '', scope: 'platform' },
    { key: 'portal.vendor_self_service', category: 'Portal', description: 'Expose the vendor portal for brands to upload invoices + manifests directly.', type: 'boolean', value: true, default: false, scope: 'platform' },
    { key: 'portal.require_mfa', category: 'Portal', description: 'Require MFA for all brand-portal users.', type: 'boolean', value: true, default: true, scope: 'platform' },
    { key: 'rfid.scan_debounce_ms', category: 'RFID', description: 'Debounce interval for RFID reader duplicates.', type: 'number', value: 250, default: 250, min: 50, max: 2000, scope: 'platform' },
    { key: 'rfid.require_tag_on_approve', category: 'RFID', description: 'Require every unit to be RFID-tagged before the batch can transition to approved.', type: 'boolean', value: false, default: false, scope: 'entity' },
    { key: 'platform.default_theme', category: 'Platform', description: 'Default UI theme if the user has not chosen one.', type: 'enum', enumOptions: ['dark', 'light', 'system'], value: 'dark', default: 'dark', scope: 'platform' },
    { key: 'platform.session_timeout_min', category: 'Platform', description: 'Session timeout (minutes) for office roles. Floor roles use a longer timeout.', type: 'number', value: 60, default: 60, min: 15, max: 480, scope: 'platform' },
    { key: 'platform.glove_mode_available', category: 'Platform', description: 'Allow floor users to enable large-touch glove mode.', type: 'boolean', value: true, default: true, scope: 'platform' },
    { key: 'platform.kill_switch', category: 'Platform', description: 'Emergency freeze. Puts Hyperdrive into read-only mode platform-wide.', type: 'boolean', value: false, default: false, scope: 'platform' },
  ];

  function genSparkline(len = 12, baseline = 0.9) {
    const out = [];
    let v = baseline;
    for (let i = 0; i < len; i++) { v = Math.max(0.5, Math.min(1, v + floatRange(-0.06, 0.06))); out.push(Number(v.toFixed(3))); }
    return out;
  }
  function genCostTrend(baseUnit) {
    const months = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'];
    let v = baseUnit;
    return months.map((m) => { v = Math.max(1, v + floatRange(-0.8, 0.8)); return { month: m, avgUnitCost: Number(v.toFixed(2)) }; });
  }
  function genAlerts(vendorName) {
    const n = range(0, 3);
    const options = [
      { sev: 'warn', msg: `${vendorName} short-ship rate up to 18% over last 3 weeks.` },
      { sev: 'warn', msg: 'Unit cost up 4.8% vs 30-day trend on 12 SKUs.' },
      { sev: 'blocked', msg: 'Promo commitment missed on spring catalog — $2,140 impact.' },
      { sev: 'info', msg: 'New COA format detected. Parser updated automatically.' },
      { sev: 'warn', msg: 'On-time rate trending below 80% on THC account.' },
    ];
    const out = [];
    for (let i = 0; i < n; i++) {
      const o = pick(options);
      out.push({ id: `al-${vendorName}-${i}-${range(10, 99)}`, at: daysAgo(range(0, 14)), severity: o.sev, message: o.msg });
    }
    return out;
  }
  function genMetrics(base) {
    return {
      onTimeRate: Number(floatRange(0.72, 0.98).toFixed(3)),
      shortShipRate: Number(floatRange(0.01, 0.18).toFixed(3)),
      damageRate: Number(floatRange(0.005, 0.06).toFixed(3)),
      promoHonorRate: Number(floatRange(0.82, 1).toFixed(3)),
      outstandingAP: Number(floatRange(1500, 42000).toFixed(2)),
      maxInvoiceAgeDays: range(2, 62),
      costTrend: genCostTrend(base),
      onTimeSparkline: genSparkline(12, 0.9),
    };
  }

  const VENDORS_FULL = VENDORS.map((v) => ({
    id: v.id, name: v.name, category: v.category,
    totalInvoices90d: range(8, 96),
    totalSpend90d: Number(floatRange(12000, 220000).toFixed(2)),
    metrics: genMetrics(floatRange(8, 48)),
    alerts: genAlerts(v.name),
  }));

  window.HD_VENDORS = { FLAGS, VENDORS_FULL };
})();
