// ── Pipeline domain logic ─────────────────────────────────────────────────
// Ports lib/status.ts, lib/format.ts, lib/batch-sla.ts, lib/batch-archive.ts
// and lib/fake-pipeline-config.ts. Tones resolve against pos/tokens.jsx —
// no color literals live here.
;(function () {
  const ENTITIES = [
    { id: 'thc', name: 'The Highest Craft', short: 'THC', hue: 'accent' },
    { id: 'ccd', name: 'Circle City', short: 'CCD', hue: 'blue' },
    { id: 'ah', name: 'Alternate Health', short: 'AH', hue: 'green' },
    { id: 'hwd', name: 'Hyperwolf Delivery', short: 'HWD', hue: 'violet' },
  ];

  // Categorical wayfinding hues (decorative only, never status) + status
  // tones, both resolved from the live theme palette.
  function hueColor(P, hue) {
    switch (hue) {
      case 'blue': return P.info;
      case 'violet': return P.indica;
      case 'teal': return P.cat.wellness;
      case 'green': return P.hybrid;
      case 'pink': return P.cat.edibles;
      case 'accent': return P.accent;
      default: return P.inkDim;
    }
  }

  // tone → { fg, bg } for pills, dots, column headers and card accents.
  function tone(P, t) {
    switch (t) {
      case 'ok': return { fg: P.good, bg: P.goodSoft, pill: 'good' };
      case 'warn': return { fg: P.warn, bg: P.warnSoft, pill: 'warn' };
      case 'blocked': return { fg: P.bad, bg: P.badSoft, pill: 'bad' };
      case 'info': return { fg: P.info, bg: P.infoSoft, pill: 'info' };
      case 'quarantine': return { fg: P.indica, bg: P.indica + (P.mode === 'dark' ? '28' : '1F'), pill: 'neutral' };
      case 'sealing': return { fg: P.cat.wellness, bg: P.cat.wellness + (P.mode === 'dark' ? '28' : '1F'), pill: 'neutral' };
      case 'archived': return { fg: P.neutral, bg: P.neutralSoft, pill: 'neutral' };
      case 'brand': return { fg: P.mode === 'dark' ? P.accent : P.accentBorder, bg: P.accentSoft, pill: 'accent' };
      default: return { fg: P.ink2, bg: P.neutralSoft, pill: 'neutral' };
    }
  }

  const BATCH_STATUS_LABEL = {
    incoming: 'Incoming', received: 'Received', labeling: 'Labeling', sealing: 'Sealing', staging: 'Staging',
    shelf_ready: 'Shelf-Ready', merchandised: 'Merchandised', approved: 'Approved for Sale',
    quarantined: 'Quarantined', recalled: 'Recalled', destroyed: 'Destroyed',
  };

  const BATCH_STATUS_ORDER = ['incoming', 'received', 'labeling', 'sealing', 'shelf_ready', 'merchandised', 'approved', 'quarantined', 'recalled', 'destroyed'];

  function batchStatusTone(s) {
    switch (s) {
      case 'approved': case 'shelf_ready': case 'merchandised': return 'ok';
      case 'staging': case 'labeling': return 'warn';
      case 'sealing': return 'sealing';
      case 'recalled': return 'blocked';
      case 'quarantined': return 'quarantine';
      case 'destroyed': return 'archived';
      default: return 'info';
    }
  }

  const INVOICE_STATUS_LABEL = {
    unprocessed: 'Unprocessed', review: 'Review', cfo: 'CFO Escalation', orphan: 'Unmatched',
    auto_posted: 'Auto-Posted', corrected_requested: 'Corrected Requested',
  };

  function invoiceStatusTone(s) {
    switch (s) {
      case 'auto_posted': return 'ok';
      case 'review': return 'warn';
      case 'cfo': return 'blocked';
      case 'orphan': return 'quarantine';
      case 'unprocessed': return 'info';
      case 'corrected_requested': return 'warn';
      default: return 'neutral';
    }
  }

  function varianceTone(v) { return v === 'none' ? 'ok' : v === 'minor' ? 'warn' : 'blocked'; }

  const INBOX_STATUS_META = {
    unmatched: { label: 'Unmatched', color: 'warn', icon: 'flag', description: 'Invoice has no matching METRC manifest. Reconcile manually or wait for manifest sync.' },
    autoposted: { label: 'Auto-Posted', color: 'ok', icon: 'check-circle', description: 'Invoice automatically pulled from a PDF and posted to AP without human review.' },
    corrected: { label: 'Corrected', color: 'info', icon: 'pencil', description: 'Invoice was flagged at intake and manually corrected by a buyer before posting.' },
    requested: { label: 'Requested', color: 'archived', icon: 'clock', description: 'Invoice has been requested from the vendor but not yet received.' },
    mapped: { label: 'Mapped', color: 'brand', icon: 'box', description: 'Invoice lines have been mapped to product wrappers and batches created.' },
  };
  const INBOX_STATUS_ORDER = ['autoposted', 'mapped', 'corrected', 'unmatched', 'requested'];

  // ── Pipeline stage config ───────────────────────────────────────────────
  const STAGE_CATALOG = {
    incoming: { stageKey: 'incoming', displayName: 'Incoming', description: 'METRC manifest received, awaiting dock scan', defaultColor: 'info', defaultIcon: 'download', isTerminal: false, isWorkflow: true },
    received: { stageKey: 'received', displayName: 'Received', description: 'Scanned at dock, counted against manifest', defaultColor: 'info', defaultIcon: 'box', isTerminal: false, isWorkflow: true },
    labeling: { stageKey: 'labeling', displayName: 'Labeling', description: 'Entity-specific labels applied (price, SKU, RFID)', defaultColor: 'warn', defaultIcon: 'tag', isTerminal: false, isWorkflow: true },
    sealing: { stageKey: 'sealing', displayName: 'Sealing', description: 'Shrink-tube tamper seal applied (The Highest Craft C12)', defaultColor: 'sealing', defaultIcon: 'shield', isTerminal: false, isWorkflow: true },
    staging: { stageKey: 'staging', displayName: 'Staging', description: 'Floor staging prior to shelf placement', defaultColor: 'warn', defaultIcon: 'package', isTerminal: false, isWorkflow: true },
    shelf_ready: { stageKey: 'shelf_ready', displayName: 'Shelf-Ready', description: 'Ready for QA sign-off and approval', defaultColor: 'ok', defaultIcon: 'check-circle', isTerminal: false, isWorkflow: true },
    merchandised: { stageKey: 'merchandised', displayName: 'Merchandised', description: 'Placed on the retail floor / live on the menu', defaultColor: 'ok', defaultIcon: 'shop', isTerminal: false, isWorkflow: true },
    approved: { stageKey: 'approved', displayName: 'Approved for Sale', description: 'Sellable inventory; leaves the Kanban to Inventory', defaultColor: 'ok', defaultIcon: 'check-circle', isTerminal: false, isWorkflow: false },
    quarantined: { stageKey: 'quarantined', displayName: 'Quarantined', description: 'Held pending compliance / QA / recall review', defaultColor: 'quarantine', defaultIcon: 'shield', isTerminal: false, isWorkflow: false },
    recalled: { stageKey: 'recalled', displayName: 'Recalled', description: 'Held under active recall order', defaultColor: 'blocked', defaultIcon: 'flag', isTerminal: true, isWorkflow: false },
    destroyed: { stageKey: 'destroyed', displayName: 'Destroyed', description: 'Destroyed on-camera; terminal', defaultColor: 'archived', defaultIcon: 'trash', isTerminal: true, isWorkflow: false },
  };

  const CATALOG_CANONICAL_ORDER = ['incoming', 'received', 'labeling', 'sealing', 'shelf_ready', 'merchandised'];

  const st = (stageKey, stageLabel, orderIndex, isRequired, requiresPhoto) => ({ stageKey, stageLabel, orderIndex, isRequired, requiresPhoto, requiresReasonCode: false, active: true });
  const retailStages = () => [st('incoming', 'Incoming', 0, true, false), st('received', 'Received', 1, true, false), st('labeling', 'Labeling', 2, true, false), st('shelf_ready', 'Shelf-Ready', 3, true, false)];
  const retailStorefrontStages = () => [...retailStages(), st('merchandised', 'Merchandised', 4, false, false)];
  const thcStages = () => [st('incoming', 'Incoming', 0, true, false), st('received', 'Received', 1, true, false), st('labeling', 'Labeling', 2, true, false), st('sealing', 'Sealing', 3, true, true), st('shelf_ready', 'Shelf-Ready', 4, true, false)];

  const ENTITY_PIPELINE_CONFIG = {
    thc: { entity: 'thc', configVersion: 1, stages: thcStages() },
    ccd: { entity: 'ccd', configVersion: 2, stages: retailStorefrontStages() },
    ah: { entity: 'ah', configVersion: 2, stages: retailStorefrontStages() },
    hwd: { entity: 'hwd', configVersion: 1, stages: retailStages() },
  };

  const getEntityPipelineStages = (entity) => ENTITY_PIPELINE_CONFIG[entity].stages.filter((s) => s.active).sort((a, b) => a.orderIndex - b.orderIndex);
  const getWorkflowStages = (entity) => getEntityPipelineStages(entity).filter((s) => STAGE_CATALOG[s.stageKey].isWorkflow);
  const getTerminalStageKeys = () => Object.values(STAGE_CATALOG).filter((c) => c.isTerminal).map((c) => c.stageKey);

  const FAKE_MASTER_PACKAGING = {
    'mp-connected': { masterProductId: 'mp-connected', tamperEvidentPackaging: true, packagingType: 'mylar_bag' },
    'mp-alien': { masterProductId: 'mp-alien', tamperEvidentPackaging: true, packagingType: 'mylar_bag' },
    'mp-lowell': { masterProductId: 'mp-lowell', tamperEvidentPackaging: true, packagingType: 'mylar_bag' },
    'mp-kiva': { masterProductId: 'mp-kiva', tamperEvidentPackaging: true, packagingType: 'wrapped_box' },
    'mp-wyld': { masterProductId: 'mp-wyld', tamperEvidentPackaging: true, packagingType: 'wrapped_box' },
    'mp-camino': { masterProductId: 'mp-camino', tamperEvidentPackaging: true, packagingType: 'child_resistant_tin' },
    'mp-cartridges': { masterProductId: 'mp-cartridges', tamperEvidentPackaging: false, packagingType: 'plastic_tube' },
    'mp-stiiizy': { masterProductId: 'mp-stiiizy', tamperEvidentPackaging: false, packagingType: 'plastic_tube' },
    'mp-heavy': { masterProductId: 'mp-heavy', tamperEvidentPackaging: false, packagingType: 'plastic_tube' },
    'mp-select': { masterProductId: 'mp-select', tamperEvidentPackaging: false, packagingType: 'plastic_tube' },
    'mp-raw': { masterProductId: 'mp-raw', tamperEvidentPackaging: false, packagingType: 'plastic_tube' },
    'mp-710': { masterProductId: 'mp-710', tamperEvidentPackaging: false, packagingType: 'glass_jar' },
    'mp-jeeter': { masterProductId: 'mp-jeeter', tamperEvidentPackaging: false, packagingType: 'paper_box' },
    'mp-pax': { masterProductId: 'mp-pax', tamperEvidentPackaging: false, packagingType: 'other' },
    'mp-papa': { masterProductId: 'mp-papa', tamperEvidentPackaging: false, packagingType: 'other' },
    'mp-cann': { masterProductId: 'mp-cann', tamperEvidentPackaging: false, packagingType: 'other' },
  };

  const PACKAGING_TYPE_LABEL = { mylar_bag: 'Mylar bag', wrapped_box: 'Wrapped box', child_resistant_tin: 'Child-resistant tin', glass_jar: 'Glass jar', plastic_tube: 'Plastic tube', paper_box: 'Paper box', other: 'Other' };

  const getPackaging = (id) => (id ? FAKE_MASTER_PACKAGING[id] : undefined);
  const isTamperEvident = (id) => getPackaging(id)?.tamperEvidentPackaging === true;

  const FAKE_PRODUCT_OVERRIDES = [
    { masterProductId: 'mp-cartridges', entity: null, addedStages: ['sealing'], skippedStages: [], reason: 'Premium vape tamper-seal required by brand' },
  ];

  function resolveDetailed(entity, masterProductId) {
    const base = getWorkflowStages(entity);
    if (!masterProductId) return { stages: base, skippedStages: [], skippedBecauseTamperEvident: false };
    const entitySpecific = FAKE_PRODUCT_OVERRIDES.filter((o) => o.masterProductId === masterProductId && o.entity === entity);
    const platformWide = FAKE_PRODUCT_OVERRIDES.filter((o) => o.masterProductId === masterProductId && o.entity === null);
    let overrides = entitySpecific.length > 0 ? entitySpecific : platformWide;
    let skippedBecauseTamperEvident = false;
    const packaging = getPackaging(masterProductId);
    if (packaging?.tamperEvidentPackaging) {
      const explicitTouchesSealing = overrides.some((o) => o.addedStages.includes('sealing') || o.skippedStages.includes('sealing'));
      if (!explicitTouchesSealing) {
        overrides = [...overrides, { masterProductId, entity: null, addedStages: [], skippedStages: ['sealing'], reason: `Tamper-evident packaging (${packaging.packagingType ?? 'pre-sealed'}); shrink-tube redundant`, synthesized: true }];
        skippedBecauseTamperEvident = true;
      }
    }
    const skippedStages = [];
    let stages = base.map((s) => ({ ...s }));
    for (const o of overrides) {
      for (const k of o.skippedStages) {
        if (stages.some((s) => s.stageKey === k) && !skippedStages.includes(k)) skippedStages.push(k);
      }
      stages = stages.filter((s) => !o.skippedStages.includes(s.stageKey));
      for (const addKey of o.addedStages) {
        if (stages.some((s) => s.stageKey === addKey)) continue;
        const canonIdx = CATALOG_CANONICAL_ORDER.indexOf(addKey);
        const insertAt = stages.findIndex((s) => CATALOG_CANONICAL_ORDER.indexOf(s.stageKey) > canonIdx);
        const catalog = STAGE_CATALOG[addKey];
        const newStage = { stageKey: addKey, stageLabel: catalog.displayName, orderIndex: -1, isRequired: true, requiresPhoto: addKey === 'sealing', requiresReasonCode: false, active: true };
        if (insertAt === -1) stages.push(newStage); else stages.splice(insertAt, 0, newStage);
      }
    }
    return { stages: stages.map((s, i) => ({ ...s, orderIndex: i })), skippedStages, skippedBecauseTamperEvident };
  }

  function nextStageAfterSkip(entity, masterProductId, currentStage) {
    if (!masterProductId) return null;
    const detailed = resolveDetailed(entity, masterProductId);
    if (detailed.skippedStages.length === 0) return null;
    const idx = detailed.stages.findIndex((s) => s.stageKey === currentStage);
    if (idx === -1) return null;
    const next = detailed.stages[idx + 1];
    return next ? next.stageKey : null;
  }

  // ── Transitions ─────────────────────────────────────────────────────────
  function canTransition(from, to) {
    if (from === to) return false;
    if (from === 'destroyed') return false;
    if (from === 'recalled') return to === 'destroyed';
    if (from === 'approved' && to === 'quarantined') return true;
    if (from === 'quarantined' && to === 'approved') return true;
    const linear = ['incoming', 'received', 'labeling', 'shelf_ready', 'merchandised', 'approved'];
    const fi = linear.indexOf(from), ti = linear.indexOf(to);
    if (fi !== -1 && ti !== -1 && ti === fi + 1) return true;
    if (to === 'quarantined' || to === 'recalled' || to === 'destroyed') return true;
    return false;
  }

  function canTransitionForEntity(from, to, entity) {
    if (from === to) return false;
    if (from === 'destroyed') return false;
    if (from === 'recalled') return to === 'destroyed';
    if (from === 'approved' && to === 'quarantined') return true;
    if (from === 'quarantined' && to === 'approved') return true;
    const ordered = [...getWorkflowStages(entity).map((s) => s.stageKey), 'approved'];
    const fi = ordered.indexOf(from), ti = ordered.indexOf(to);
    if (fi !== -1 && ti !== -1 && ti === fi + 1) return true;
    if (to === 'quarantined' || to === 'recalled' || to === 'destroyed') return true;
    return false;
  }

  // ── SLA (per-stage dwell thresholds) ────────────────────────────────────
  const STAGE_THRESHOLDS = {
    incoming: { warmHours: 24, hotHours: 48 },
    received: { warmHours: 48, hotHours: 120 },
    labeling: { warmHours: 72, hotHours: 168 },
    sealing: { warmHours: 24, hotHours: 48 },
    shelf_ready: { warmHours: 168, hotHours: 336 },
    merchandised: { warmHours: 168, hotHours: 336 },
    quarantined: { warmHours: 48, hotHours: 168 },
  };

  function stageSeverity(status, statusEnteredAt, now) {
    const t = STAGE_THRESHOLDS[status];
    if (!t) return 'fresh';
    const hours = ((now ?? window.HD_DATA.NOW) - new Date(statusEnteredAt).getTime()) / 3600000;
    if (hours >= t.hotHours) return 'hot';
    if (hours >= t.warmHours) return 'warm';
    return 'fresh';
  }

  // Column-tint accent — a pure location signal, decoupled from severity.
  const STAGE_ACCENT_TONE = {
    incoming: 'brand', received: 'warn', labeling: 'info', sealing: 'sealing', shelf_ready: 'ok',
    merchandised: 'brand', staging: 'quarantine', approved: 'ok', quarantined: 'quarantine',
    recalled: 'blocked', destroyed: 'archived',
  };
  const stageAccentTone = (status) => STAGE_ACCENT_TONE[status] || 'neutral';

  // ── Auto-archive ────────────────────────────────────────────────────────
  function isArchived(batch, now) {
    const n = now ?? window.HD_DATA.NOW;
    if (batch.status === 'approved') return true;
    if (batch.status === 'destroyed') return true;
    const daysAt = (n - new Date(batch.statusEnteredAt).getTime()) / 86400000;
    if (batch.status === 'shelf_ready' && daysAt >= 7) return true;
    if (batch.status === 'recalled' && daysAt >= 14) return true;
    return false;
  }

  function archivedAt(batch) {
    const entered = new Date(batch.statusEnteredAt).getTime();
    if (batch.status === 'shelf_ready') return new Date(entered + 7 * 86400000).toISOString();
    if (batch.status === 'recalled') return new Date(entered + 14 * 86400000).toISOString();
    return batch.statusEnteredAt;
  }

  // ── Formatting ──────────────────────────────────────────────────────────
  const formatCurrency = (amount, opts) => {
    const showCents = opts?.showCents ?? true;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: showCents ? 2 : 0, maximumFractionDigits: showCents ? 2 : 0 }).format(amount);
  };
  const formatNumber = (n) => new Intl.NumberFormat('en-US').format(n);
  const formatPercent = (n, digits = 1) => `${(n * 100).toFixed(digits)}%`;
  const formatDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const formatDateTime = (iso) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' });

  function relativeTime(iso, now) {
    const n = now ?? window.HD_DATA.NOW;
    const diffMs = n - new Date(iso).getTime();
    const s = Math.abs(diffMs) / 1000;
    const future = diffMs < 0;
    const abs = (label) => (future ? `in ${label}` : `${label} ago`);
    if (s < 60) return abs(`${Math.floor(s)}s`);
    if (s < 3600) return abs(`${Math.floor(s / 60)}m`);
    if (s < 86400) return abs(`${Math.floor(s / 3600)}h`);
    if (s < 86400 * 30) return abs(`${Math.floor(s / 86400)}d`);
    if (s < 86400 * 365) return abs(`${Math.floor(s / 2592000)}mo`);
    return abs(`${Math.floor(s / 31536000)}y`);
  }

  function relativeOrDate(iso, now) {
    const n = now ?? window.HD_DATA.NOW;
    const days = (n - new Date(iso).getTime()) / 86400000;
    if (days >= 0 && days < 7) return relativeTime(iso, n);
    return formatDate(iso);
  }

  function ageInStatus(iso, now) {
    const ms = (now ?? window.HD_DATA.NOW) - new Date(iso).getTime();
    const h = Math.floor(ms / 3600000);
    if (h < 1) return `${Math.floor(ms / 60000)}m`;
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24), rem = h % 24;
    return rem ? `${d}d ${rem}h` : `${d}d`;
  }

  // METRC / HUID short forms — mid-ellipsis for METRC, last-4 for HUIDs.
  function uidKind(value) {
    if (/^HWID-/i.test(value)) return 'huid';
    if (/^[0-9A-Fa-f]{24}$/.test(value)) return value.toUpperCase().startsWith('48') ? 'huid' : 'metrc';
    return value.toUpperCase().startsWith('1A') ? 'metrc' : 'huid';
  }
  function uidShort(value, kind) {
    if (/^HWID-/i.test(value)) return value.toUpperCase();
    if (kind === 'huid') return `HWID-${value.slice(-4).toUpperCase()}`;
    if (value.length >= 24) return `${value.slice(0, 9)}…${value.slice(-4).toUpperCase()}`;
    return value.toUpperCase();
  }

  window.HD = {
    ENTITIES, hueColor, tone,
    BATCH_STATUS_LABEL, BATCH_STATUS_ORDER, batchStatusTone,
    INVOICE_STATUS_LABEL, invoiceStatusTone, varianceTone, INBOX_STATUS_META, INBOX_STATUS_ORDER,
    STAGE_CATALOG, CATALOG_CANONICAL_ORDER, ENTITY_PIPELINE_CONFIG, getEntityPipelineStages, getWorkflowStages, getTerminalStageKeys,
    FAKE_MASTER_PACKAGING, PACKAGING_TYPE_LABEL, getPackaging, isTamperEvident, FAKE_PRODUCT_OVERRIDES, resolveDetailed, nextStageAfterSkip,
    canTransition, canTransitionForEntity, stageSeverity, stageAccentTone,
    isArchived, archivedAt,
    formatCurrency, formatNumber, formatPercent, formatDate, formatDateTime, relativeTime, relativeOrDate, ageInStatus,
    uidKind, uidShort,
  };
})();
