/* @hyper-tech/contracts — the one place the estate's types, enums, ids, money, time,
 * error and event shapes are written down. Derived from
 * docs/codebase-audit/CANONICAL-DATA-MODEL.md §7 on 2026-09-09.
 *
 * ONE FILE, THREE CONSUMERS, NO DEPENDENCIES.
 *   Node (the Hyper-Tech backends):   const C = require('@hyper-tech/contracts');
 *   Browser (POS-Admin, no build):    <script src="contracts/index.js"></script> → window.HWContracts
 *   Python (wm-demo, stdlib only):    reads contracts/enums.json and contracts/schema/*.json,
 *                                     which tools/contracts-export.mjs writes FROM this file and
 *                                     test/contracts.test.mjs proves are identical to it.
 *
 * RULES THIS FILE ENFORCES
 *   ids     — transport form is a string. Production entities: 24-hex ObjectId. Anything from a
 *             vendor is {source, id} and never a bare string. Our slugs (store_id, associate_id)
 *             are display keys, never foreign keys.
 *   money   — integer cents on the wire and in new storage, with a stated basis. Dollars exist
 *             only at one boundary (centsFromDollars) and are never a schema field.
 *   time    — ISO-8601 UTC with a Z, never epoch, never a bare local date except day-keys.
 *   enums   — closed lists. A value not in the list is a 422, never a new state.
 *   errors  — { error: { code, message, details } } with a real HTTP status per code.
 *   events  — one signed envelope, HMAC-SHA256 the way Verify already signs.
 *
 * Wrapped as a UMD so it is an IIFE in the browser and leaks exactly one global. */
;(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HWContracts = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '0.5.0'; // 0.5.0 (additive, Team 3b): HrEmployee/HrEmployeeRestricted/Incident/WriteUp/
  // CallOff/CloserReport/LossLedgerEntry + AirtableSourceRef (BUILD-PROGRAM-MASTER-PLAN-2026-09-16.md §4
  // Track 3 LP+HR migration, docs/migration/MIGRATION-PLAN-2026-09-16.md). PII_CLASS const (shape.property
  // -> restricted|internal|normal), exported to enums.json as pii_class; RULE_OPS_BY_TYPE now also
  // exported to enums.json as rule_ops_by_type (was JS-only). No prior shape changed.
  // 0.5.0: PromotionRule (hw.rule.v1) -- RuleGroup/RuleCondition/RuleNode,
  // RULE_FIELD_TYPE + RULE_LIMITS (depth<=4, nodes<=50, list<=200, string<=200; enforced by
  // validatePromotionRule, not the schema subset), Promotion.rule optional $ref (additive).
  // batch.metrc_tag / metrc_packages deliberately excluded from RuleField (owner ruling 2026-09-14,
  // docs/shells/PRODUCT-BATCHES-DESIGN.md:95). BUILD-PROGRAM-MASTER-PLAN-2026-09-16.md §2.1.
  // 0.4.3: Batch.metrc_packages -- one batch spans many Metrc packages; the batch is the unit of control, the tag is a compliance id (owner 2026-09-14); metrc_tag deprecated to 'first tag'. 0.4.2: LocationSide, ShellLocationBinding (per-store FOH/BOH placement, shell default, variations inherit). 0.4.1: attribution on Plan (planned_by, engine_version, approved_by/at) and PlanLine (picked/packed/verified by+at, overridden_by). 0.4.0: inventory — LocationKind, ArrivalKind, MovementReason, PlanReason, ChannelKind, CountState; Location, Batch, Movement, ReceivedItem, PlanLine, Plan. 0.3.2: VerificationReason +15 reasons idv_rules.py already emitted. 0.3.1: VerificationReason + MED_REC_JURISDICTION_UNCONFIGURED (Verify r10). 0.2.x additive enums (MODULE-CONTRACT-GAPS.md §2, PersonStatus, LiveFeedStatus, AtHome*); 0.3.0: DiscountKind, CampaignStatus, FlowStatus, AudienceStatus, PointsKind+expired, IdSource+twilio/sendgrid/alpineiq/hyperdrive
  var HEADER = 'x-hw-contract'; // clients send this to ask for contract-shaped answers

  // ── Enums ──────────────────────────────────────────────────────────────────
  // Each carries `source` naming where the vocabulary was taken from, so a drift test can
  // point at the file that must agree with it.
  var ENUMS = {
    Platform: { values: ['hyperwolf', 'hemp', 'stilo'],
      source: 'promotion-engine/core/constants.js PLATFORMS; distribution-backend/models/Regions.js lacks hemp' },
    PersonKind: { values: ['customer', 'staff', 'driver', 'tenant', 'service'],
      source: 'CANONICAL-DATA-MODEL.md §1 — the nine person shapes collapse to five kinds' },
    Role: { values: ['viewer', 'associate', 'manager', 'admin', 'superadmin'],
      source: 'replaces Admin.userRoles[] + isSuperAdmin, Bounty MANAGER_ROLES, Verify viewer|analyst|admin' },
    Classification: { values: ['budtender', 'driver', 'manager', 'loss_prevention', 'support', 'other'],
      source: 'wm-demo/wmdemo/incentives/schema.py CLASSES' },
    ContestKind: { values: ['spiff', 'contest', 'team_goal', 'store_vs_store', 'aov_goal'],
      source: 'wm-demo/wmdemo/incentives/scoring.py KINDS' },
    ContestStatus: { values: ['draft', 'pending_approval', 'active', 'settled', 'cancelled', 'ended'],
      source: 'wm-demo/wmdemo/incentives/contests.py stored statuses + derived "ended"' },
    Metric: { values: ['units', 'net_cents', 'gross_cents', 'txn_count', 'aov_cents'],
      source: 'wm-demo/wmdemo/incentives/scoring.py METRICS' },
    PointsKind: { values: ['earned', 'adjusted', 'recorded_paid', 'redeemed', 'expired'],
      source: 'wm-demo/wmdemo/incentives/rewards.py KINDS + redeemed (Rewards service, plan §3) + expired (engage/screen-loyalty.jsx liability). rewards.balances() ignores kinds it does not write; expired must be added there before any writer emits it' },
    SnapStatus: { values: ['draft', 'published', 'expired'],
      source: 'wm-demo/wmdemo/incentives/education.py STATUSES' },
    MatchKind: { values: ['id', 'email', 'name-exact-vendor', 'name-new', 'confirmed', 'manual', 'unresolved'],
      source: 'wm-demo/wmdemo/incentives/schema.py match_kind comment' },
    TxnType: { values: ['sale', 'refund', 'void'],
      source: 'wm-demo/wmdemo/server.py /api/pos/sale' },
    MoneyBasis: { values: ['ex_tax_net', 'ex_tax_gross', 'inc_tax'],
      source: 'wm-demo/wmdemo/incentives/scoring.py MONEY_BASIS + the tender total the POS sends' },
    Currency: { values: ['USD'], source: 'every price in every repo is USD' },
    VerificationStatus: { values: ['Not Started', 'In Progress', 'Awaiting User', 'In Review', 'Approved',
      'Declined', 'Resubmitted', 'Abandoned', 'Expired', 'Kyc Expired'],
      source: 'wm-demo/wmdemo/idv_rules.py STATUSES (Didit-compatible literals)' },
    VerificationChannel: { values: ['hosted', 'embedded', 'pos', 'import'],
      source: 'docs/IDV-API-CONTRACT.md SessionSummary.channel' },
    VerificationReason: { values: ['LIVENESS_LOW', 'LIVENESS_FAILED_3X', 'FACE_MATCH_LOW', 'DOC_QUALITY_LOW',
      'BARCODE_OCR_MISMATCH', 'NAME_MISMATCH_EXPECTED', 'DUPLICATE_PERSON', 'IP_HOSTING', 'IP_VPN',
      'AGE_ESTIMATE_UNDER_MARGIN', 'OUT_OF_STATE', 'DOC_NEAR_EXPIRY', 'ENGINE_UNAVAILABLE_MANUAL',
      'DOC_EXPIRED', 'UNDER_AGE', 'FACE_BLOCKLIST_HIT', 'DOCUMENT_BLOCKLIST_HIT', 'USER_BLOCKLIST_HIT',
      'IP_TOR', 'INJECTION_DETECTED', 'CHALLENGE_NONCE_MISMATCH', 'LIVENESS_ATTEMPTS_EXHAUSTED_HARD',
      'MED_REC_JURISDICTION_UNCONFIGURED',
      // 0.3.2: the reasons wmdemo/idv_rules.py REASONS already emitted and the contract lacked
      'BARCODE_NOT_DETECTED', 'DOC_PORTRAIT_NOT_FOUND', 'ENGINE_MEDIA_UNAVAILABLE', 'ENGINE_NO_EVIDENCE',
      'MED_REC_DOB_MISMATCH', 'MED_REC_EXPIRED', 'MED_REC_INVALID_LICENSE', 'MED_REC_MISSING',
      'MED_REC_NAME_MISMATCH', 'MED_REC_OUT_OF_STATE', 'MED_REC_UNREADABLE', 'MRZ_LOW_CONFIDENCE',
      'MRZ_NOT_FOUND', 'OVI_SHIFT_NOT_SEEN', 'SCREEN_REPLAY_SUSPECTED'],
      source: 'docs/IDV-API-CONTRACT.md Reason (review + decline sets) = wmdemo/idv_rules.py REASONS' },
    OrderStatus: { values: ['pending', 'confirmed', 'packed', 'out_for_delivery', 'completed', 'cancelled', 'refunded'],
      source: 'hyperwolf/distribution Order Joi (pending|completed|cancelled) widened with the POS stages' },
    TaskStatus: { values: ['not_started', 'unassigned', 'in_progress', 'completed', 'cancelled'],
      source: 'hyperdrive-backend/models/TasksModel.js validTaskStatus' },
    TaskAssignmentMode: { values: ['auto', 'manual', 'driver', 'region'],
      source: 'hyperdrive-backend/models/TasksModel.js validTaskAssignmentMode' },
    FleetStatus: { values: ['active', 'inactive'],
      source: 'hyperdrive-backend/models/Fleets.js validFleetStatus' },
    FleetVerificationStatus: { values: ['pending', 'verified'],
      source: 'hyperdrive-backend/models/Fleets.js' },
    PromotionStatus: { values: ['draft', 'scheduled', 'active', 'paused', 'ended', 'inactive'],
      source: 'promotion-backend/models/Promotion.js writes active|inactive; the Promotions Suite (pweb/, promo/) needs draft|scheduled|paused|ended; widened 0.2.0' },
    RuleType: { values: ['cart', 'product', 'user', 'bogo', 'time', 'payment'],
      source: 'promotion-engine/rule-types/* directory (the evaluators that exist)' },
    ProductSource: { values: ['blaze', 'meadow', 'treez', 'first-party'],
      source: 'hyperwolf Product (Blaze mirror) vs hemp/stilo typed products; Meadow/Treez from Bounty ingest' },
    PosVendor: { values: ['blaze', 'meadow', 'treez', 'hwpos', 'none'],
      source: 'docs/BOUNTY-API-CONTRACT.md Store.pos + Source' },
    IdSource: { values: ['blaze', 'meadow', 'treez', 'weedmaps', 'didit', 'hwpos', 'connecteam', 'airtable', 'hyperwolf', 'metrc', 'onfleet', 'twilio', 'sendgrid', 'alpineiq', 'hyperdrive'],
      source: 'every external id seen across the twelve repos and the GAS estate' },
    SourceState: { values: ['failing', 'stale', 'healthy', 'not_configured', 'never_synced'],
      source: 'docs/BOUNTY-API-CONTRACT.md Source.state' },
    // ── 0.2.0 additions (MODULE-CONTRACT-GAPS.md §2) ──
    FulfillmentStage: { values: ['verify', 'pack', 'packing', 'ready', 'done', 'canceled'],
      source: 'pos/data.jsx ORDER_STAGES and wm-demo/wmdemo/fulfillment.py STAGES (identical); the queue stages, distinct from OrderStatus' },
    WeedmapsOrderStatus: { values: ['DRAFT', 'PENDING', 'IN_PROGRESS', 'READY_FOR_ATTAINMENT', 'COMPLETE', 'CANCELED_SELLER'],
      source: 'pos/data.jsx WM_STATUS_MAP, wmdemo/fulfillment.py WM_STATUS_ORDER — the vendor vocabulary, kept verbatim' },
    DriverDutyState: { values: ['duty', 'idle', 'break', 'meal', 'oos', 'offline', 'on_route'],
      source: 'logistics/ldata.jsx, pos/data.jsx DRIVERS, delivery/ddata.jsx, mobile/ — four lists reconciled' },
    CalloffStatus: { values: ['open', 'covered'], source: 'delivery/ddata.jsx CALLOFFS' },
    RegionShiftStatus: { values: ['on', 'off'], source: 'delivery/ddata.jsx SUBREGIONS' },
    TerminalKind: { values: ['station', 'mobile'], source: 'terminals/tdata.jsx (the wizard emits driver — a bug)' },
    DrawerState: { values: ['open', 'closed'], source: 'terminals/tdata.jsx' },
    CloseoutDestination: { values: ['safe', 'bank', 'hand'], source: 'terminals/tdrawer.jsx DESTS' },
    PaymentMethod: { values: ['cash', 'card', 'split', 'cod', 'prepaid'], source: 'shop/, mobile/data.jsx pay|tender, pos/payment.jsx method' },
    Lane: { values: ['express', 'scheduled'], source: 'shop/data.jsx lane; wmdemo/cities.py room CHECK' },
    CheckinState: { values: ['waiting', 'bound', 'served', 'left'], source: 'wmdemo/checkin_api.py _ALL_STATES' },
    NotificationChannel: { values: ['sms', 'email', 'push', 'wallet'], source: 'engage/data.jsx CHANNELS' },
    PromoRelation: { values: ['mirrors', 'supersedes', 'conflict'], source: 'wmdemo/store.py promo_links CHECK' },
    BatchStage: { values: ['incoming', 'received', 'labeling', 'sealing', 'shelf_ready', 'merchandised', 'approved', 'quarantined', 'recalled', 'destroyed'],
      source: 'pipeline/domain.jsx:24 BATCH_STATUS_ORDER (verbatim, in order)' },
    LoyaltyTier: { values: ['bronze', 'silver', 'gold', 'platinum'], source: 'athome/, crm.jsx (title-cased on screen)' },
    LiveFeedStatus: { values: ['off', 'pending', 'slow', 'live', 'unreachable', 'no-write-path'],
      source: 'shared/hw-live.js HW_LIVE_STATES (hw-live-history.js and hw-live-mapping.js read it)' },
    AtHomeVisitStatus: { values: ['requested', 'confirmed', 'en_route', 'in_session', 'completed', 'canceled'],
      source: 'athome/athome-shared.jsx STATUS (Shop @ Home visits)' },
    GeniusShiftStatus: { values: ['available', 'en_route', 'in_session', 'off'],
      source: 'athome/athome-shared.jsx GSTATUS (at-home associates)' },
    DiscountKind: { values: ['percent', 'dollar', 'bogo', 'bundle', 'gift', 'tiered', 'points'],
      source: 'promo/pshared.jsx DISCOUNT_KINDS — the REWARD shape of a promotion; RuleType is its trigger scope' },
    CampaignStatus: { values: ['sent', 'sending', 'scheduled', 'queued', 'draft', 'paused'],
      source: 'engage/data.jsx CAMPAIGN_STATUSES' },
    FlowStatus: { values: ['draft', 'live', 'paused', 'archived'],
      source: 'engage/data.jsx FLOW_STATUSES (the display word Active is a label for live)' },
    AudienceStatus: { values: ['draft', 'live', 'paused', 'archived', 'suggested'],
      source: 'engage/data.jsx AUDIENCE_STATUSES' },
    PersonStatus: { values: ['unverified', 'active', 'blocked', 'deleted', 'flagged'],
      source: 'wm-demo idv_people.status (Verify); `flagged` is legacy from the Didit import, accepted on read only, never written by our code' },
    ErrorCode: { values: ['bad_request', 'unauthorized', 'forbidden', 'not_found', 'conflict',
      'unprocessable', 'rate_limited', 'internal', 'not_built'],
      source: 'CANONICAL-DATA-MODEL.md §7.6' },
    EventType: { values: ['order.created', 'order.completed', 'order.refunded', 'order.cancelled', 'task.status_changed',
      'verification.decided', 'points.earned', 'points.redeemed', 'promotion.consumed', 'person.merged'],
      source: 'CANONICAL-DATA-MODEL.md §7.7' },
    // 0.4.0 — inventory (distribution/OWNER-NOTES.md 2026-09-10: one location model for kits and stores)
    LocationKind: { values: ['receiving', 'safe', 'floor', 'shelf', 'display', 'kit_box', 'vehicle', 'packing_bench', 'lp_bench',
      'quarantine', 'returns', 'waste', 'transfer_out'],
      source: 'distribution/USE-CASES.md §1 actors and locations; wm-demo inventory.py kinds safe|kit|counter widened' },
    ArrivalKind: { values: ['new_sku', 'restock', 'new_batch'],
      source: 'OWNER-NOTES.md 2026-09-10 — three kinds of receiving' },
    MovementReason: { values: ['receive', 'put_away', 'build', 'refill', 'restock', 'dispatch', 'return', 'sale', 'transfer',
      'handoff', 'count_adjust', 'quarantine', 'waste', 'sample', 'correction'],
      source: 'distribution/USE-CASES.md §2 flows' },
    PlanReason: { values: ['sold', 'new_arrival', 'oldest_first', 'partial_placement', 'short_stock', 'below_subregion_count',
      'not_in_template', 'no_sales_counted', 'capped', 'mixed_batch', 'reserved', 'expiring', 'held', 'manual'],
      source: 'distribution/DESIGN-BRIEF.md item 3; OWNER-NOTES.md (mixed batch always loud)' },
    ChannelKind: { values: ['asap', 'scheduled', 'register', 'pickup', 'express'],
      source: 'OWNER-NOTES.md — ASAP from the kit drives refill; scheduled from the safe counts for loss prevention only' },
    CountState: { values: ['proposed', 'recount_required', 'awaiting_approval', 'approved', 'rejected'],
      source: 'OWNER-NOTES.md — second-person recount above threshold; manager approves every adjustment' },
    LocationSide: { values: ['foh', 'boh'],
      source: 'OWNER-NOTES.md 2026-09-10 — every shell carries an optional front-of-house and back-of-house location per store' },
    // 0.5.0 — PromotionRule (hw.rule.v1). BUILD-PROGRAM-MASTER-PLAN-2026-09-16.md §2.1.
    RuleShape: { values: ['hw.rule.v1'],
      source: 'BUILD-PROGRAM-MASTER-PLAN-2026-09-16.md §2.1 — the rule envelope version; the subset has no const, so this is a one-value enum' },
    RuleField: { values: [
        'batch.batch_no', 'batch.thc_pct', 'batch.packaged_at', 'batch.received_at', 'batch.expires_at', 'batch.age_days',
        'product.shell_id', 'product.sku', 'product.category_id', 'product.brand',
        'cart.subtotal_cents', 'cart.line_count',
        'customer.tier', 'customer.segment_id',
        'order.channel', 'order.store_id',
        'time.dow', 'time.hour' ],
      source: 'BUILD-PROGRAM-MASTER-PLAN-2026-09-16.md §2.1 closed field vocabulary. batch.metrc_tag and metrc_packages are deliberately absent (owner ruling 2026-09-14, docs/shells/PRODUCT-BATCHES-DESIGN.md:95) — do not add them' },
    RuleOp: { values: ['eq', 'neq', 'in', 'not_in', 'gt', 'gte', 'lt', 'lte', 'between', 'before', 'after', 'older_than_days', 'newer_than_days'],
      source: 'BUILD-PROGRAM-MASTER-PLAN-2026-09-16.md §2.1 — closed, typed per field; see RULE_FIELD_TYPE and validatePromotionRule' },
    RuleThenKind: { values: ['percent', 'amount', 'price', 'bogo', 'gift', 'points'],
      source: 'BUILD-PROGRAM-MASTER-PLAN-2026-09-16.md §2.1 then.kind' },
    RuleStatus: { values: ['draft', 'active', 'paused', 'ended'],
      source: 'BUILD-PROGRAM-MASTER-PLAN-2026-09-16.md §2.1 status' },
    RuleSource: { values: ['ui', 'agent'],
      source: 'BUILD-PROGRAM-MASTER-PLAN-2026-09-16.md §2.1 meta.source' },
    RuleChannel: { values: ['in_store', 'pickup', 'delivery'],
      source: 'pos/screen-cart.jsx:892 channel: "in_store"; promo/pdata.jsx:267-268 Weedmaps listing kinds Pickup/Delivery' },
    // 0.5.0 — Track 3 LP+HR migration (BUILD-PROGRAM-MASTER-PLAN-2026-09-16.md §4, Team 3b).
    // HrEmployee/HrEmployeeRestricted/Incident/WriteUp/CallOff/CloserReport/LossLedgerEntry.
    // Airtable is still system of record through M2 — these are the API/UI contract our
    // server exposes over it, each carrying source_ref (AirtableSourceRef) to round-trip writes.
    HrEmployeeStatus: { values: ['active', 'on_leave', 'terminated'],
      source: 'onboarding/Config.js:94 F_EMP.STATUS singleSelect comment "Active / On leave / Terminated"' },
    HrAccountabilityBand: { values: ['clean', 'watch', 'high_risk'],
      source: 'onboarding/Config.js:101 F_EMP.ACCOUNTABILITY formula comment "Clean / Watch / High Risk"' },
    // INFERRED — only "Expired" is directly cited (HR-DASHBOARD-INVENTORY.md §4, onboarding/Server.js:1417,1578
    // _policyCellsFromTableA/_computeDocs); current/expiring_soon/missing are the natural closed set for a
    // doc-status summary chip but are not individually confirmed against the live Table A schema.
    HrDocStatus: { values: ['current', 'expiring_soon', 'expired', 'missing'],
      source: 'onboarding/Server.js:1417,1578; HR-DASHBOARD-INVENTORY.md §4 // INFERRED (see comment above)' },
    IncidentType: { values: [
        'customer_complaint', 'change_not_returned', 'inventory_confirmation_failure', 'wrong_order_items',
        'inappropriate_behavior', 'over_under_charged', 'poor_customer_service', 'time_task_not_started_promptly',
        'time_area_task_late_start', 'time_hq_task_late_start', 'time_left_region_on_break', 'time_idle_during_orders',
        'time_personal_errands', 'time_extended_break', 'used_promo_code', 'late_delivery', 'late_or_no_show' ],
      source: 'writeup-pipeline/ConfigReader.js:170-186 INCIDENT_TYPES_FALLBACK labels (mirror of IncidentPortal.gs IP_INCIDENT_TYPE_OPTIONS)' },
    IncidentIssueCategory: { values: ['communication', 'response_time', 'professionalism', 'accuracy', 'timeliness', 'other'],
      source: 'writeup-pipeline/ConfigReader.js:188-195 ISSUE_CATEGORIES_FALLBACK (mirror of IncidentPortal.gs IP_ISSUE_CATEGORY_OPTIONS)' },
    Severity: { values: ['low', 'medium', 'high'],
      source: 'writeup-pipeline/ConfigReader.js:197-202 SEVERITY_LEVELS_FALLBACK — "CANONICAL LABELS, do not rename"' },
    // INFERRED (partial) — 'open'/'escalated'/'in_progress'/'pending'/'response_received' are the literal
    // _OPEN_INCIDENT_STATUSES array; 'resolved'/'closed' are the closing counterparts, not individually
    // confirmed against the live Incidents singleSelect choice list.
    IncidentStatus: { values: ['open', 'escalated', 'in_progress', 'pending', 'response_received', 'resolved', 'closed'],
      source: 'onboarding/Server.js:3152 _OPEN_INCIDENT_STATUSES; IncidentPortal.js:69 IP_NEW_STATUS=\'Open\' // INFERRED (see comment above)' },
    CallOffType: { values: ['absent', 'late', 'no_call_no_show', 'sick'],
      source: 'onboarding/Config.js:399 F_CO.TYPE comment: Absent / Late / "No Call / No Show" / Sick' },
    CallOffReason: { values: ['sick', 'flu_symptoms', 'personal', 'family_emergency', 'car_trouble', 'injury', 'appointment', 'other'],
      source: 'writeup-pipeline/ConfigReader.js:161-169 CALL_OFF_REASONS_FALLBACK labels' },
    // INFERRED (partial) — 'pending_review'/'unexcused'/'doctors_note_received'/'pending' are the literal
    // _OPEN_CALLOFF_STATUSES array; 'excused'/'covered' are the closing counterparts, not individually
    // confirmed against the live Call Offs singleSelect choice list. Distinct from CalloffStatus (Connecteam
    // shift-coverage feature, different domain) to avoid a name collision.
    HrCallOffStatus: { values: ['pending_review', 'unexcused', 'doctors_note_received', 'pending', 'excused', 'covered'],
      source: 'onboarding/Server.js:3153 _OPEN_CALLOFF_STATUSES // INFERRED (see comment above)' },
    WriteUpLevel: { values: ['first_warning', 'second_warning', 'final_warning', 'termination'],
      source: 'writeup-pipeline/Aiwriteupdrafter.js:891-892 allowedLevels/allowedRecs — AI drafts capped at second_warning (allowedLevels), manager step-up unlocks the full allowedRecs list' },
    WriteUpLadder: { values: ['attendance', 'accuracy'],
      source: '2026-09-16 write-up ladder decision (docs/migration/MIGRATION-PLAN-2026-09-16.md intro "Owner decisions already assumed"; memory writeup-ladder-decisions.md) — NEW, no Airtable field yet' },
    WriteUpStatus: { values: ['pending', 'acknowledged', 'in_progress', 'closed', 'archived', 'rescinded'],
      source: 'onboarding/Config.js:365 F_WU.STATUS comment (Pending/Acknowledged/Closed/In Progress/Archived) + writeup-pipeline/Webapp.js:2388 formula names \'Rescinded\'' },
    WriteUpAiDraftStatus: { values: ['not_drafted', 'drafting', 'drafted', 'failed', 'manually_edited'],
      source: 'onboarding/Config.js:374 F_WU.AI_DRAFT_STATUS comment' },
    CloserReportMode: { values: ['delivery', 'retail'],
      source: 'docs/migration/LP-AIRTABLE-SCHEMA.md §1 group 1: "Mode (Delivery | Retail; empty = Delivery)"' },
    CloserReportDiscrepancyType: { values: ['cash_short', 'cash_over', 'cc_mismatch', 'payment_type_swap', 'cash_and_cc', 'unverified_return', 'lp_blaze_review'],
      source: 'end-of-shift-portal/IncidentEngine.gs:693-723 computeDiscrepancyType_; :717-718 comment lists the live Airtable choices verified 2026-08-24' },
    // INFERRED — Config.gs:117 names the field ("singleSelect — over or under?") but the actual choice
    // strings are fetched dynamically from the Airtable meta API in Form.html (fillSelect), never literal
    // in code. Verify spelling against the live schema before shipping a writer for this field.
    CloserReportOverUnder: { values: ['over', 'under'],
      source: 'end-of-shift-portal/Config.gs:117 CASH_DISC_OVER_UNDER; Form.html:1363 label // INFERRED (see comment above)' },
    CashExpectedSource: { values: ['receipt', 'pos', 'typed'],
      source: 'docs/migration/LP-AIRTABLE-SCHEMA.md §3 precedence: Lead POS Cash (receipt) > Blaze Expected Cash (POS) > Expected Cash Value (typed); mapping table "Closeout.expected with a source enum receipt|pos|typed"' },
    LpBlazeStatus: { values: ['pending', 'match', 'mismatch'],
      source: 'docs/migration/LP-AIRTABLE-SCHEMA.md §4: "LP vs Blaze Status (formula: PENDING | MATCH | MISMATCH)"' },
    CloserReportResolutionStatus: { values: [
        'submit_for_review', 'unresolved', 'in_process_of_resolving', 'resolved', 'manual_follow_up_required',
        'audited_verified', 'pending_driver_response', 'unverified_returns',
        'closed_duplicate_archived', 'closed_corrected_no_discrepancy' ],
      source: 'end-of-shift-portal/Dashboard.gs:1360 LP_REAUDIT_STATUSES; Airtable.gs:169 \'Unverified Returns\'; DuplicateGuard.gs:44 EOS_DUP_STATUS; Dashboard.gs:1529 LP_CORRECTION_STATUS; \'Pending Driver Response\' per Dashboard.gs:1939,2002 comments' },
    LpDisposition: { values: ['explained', 'process_fix', 'true_loss'],
      source: 'end-of-shift-portal/Dashboard.gs:1229 LP_DISPOSITION_VALUES' },
    ManagerDecision: { values: ['approve_write_up', 'dismiss_coaching'],
      source: 'docs/migration/LP-DASHBOARD-INVENTORY.md §2 Manager Decision form: "choice: Approve Write-Up / Dismiss-Coaching"' },
  };
  var HTTP_STATUS = { bad_request: 400, unauthorized: 401, forbidden: 403, not_found: 404,
    conflict: 409, unprocessable: 422, rate_limited: 429, internal: 500, not_built: 501 };

  function enumValues(name) {
    var e = ENUMS[name]; if (!e) throw new Error('unknown enum ' + name);
    return e.values.slice();
  }
  function isEnum(name, v) { return ENUMS[name] ? ENUMS[name].values.indexOf(v) !== -1 : false; }

  // Role mapping — every vocabulary the estate uses today, mapped once. Unknown → viewer.
  var ROLE_MAP = {
    // Hyper-Tech backends: Admin.userRoles[] strings and the isSuperAdmin boolean
    'super admin': 'superadmin', 'superadmin': 'superadmin', 'admin': 'admin', 'manager': 'manager',
    // POS-Admin / Bounty display roles (pos/app.jsx USER, contests.MANAGER_ROLES)
    'floor manager': 'manager', 'owner': 'superadmin', 'budtender': 'associate', 'associate': 'associate',
    'driver': 'associate', 'support': 'associate', 'loss prevention': 'associate',
    // Verify ladder (idv_api.py)
    'analyst': 'manager', 'viewer': 'viewer',
  };
  function roleFrom(input) {
    if (input && typeof input === 'object') {
      if (input.isSuperAdmin === true) return 'superadmin';
      var arr = input.userRoles || input.roles;
      if (Array.isArray(arr) && arr.length) {
        var best = 'viewer';
        for (var i = 0; i < arr.length; i++) { var r = roleFrom(arr[i]); if (rank(r) > rank(best)) best = r; }
        return best;
      }
      input = input.role;
    }
    if (typeof input !== 'string') return 'viewer';
    return ROLE_MAP[input.trim().toLowerCase()] || (isEnum('Role', input) ? input : 'viewer');
  }
  function rank(role) { return ENUMS.Role.values.indexOf(role); }
  // An unknown `need` DENIES: a typo'd gate must fail closed, never open.
  function roleAtLeast(role, need) { if (!isEnum('Role', need)) return false; return rank(roleFrom(role)) >= rank(need); }

  // ── Ids ────────────────────────────────────────────────────────────────────
  var OBJECT_ID = /^[0-9a-f]{24}$/;
  var UUID_HEX = /^[0-9a-f]{32}$/;
  var SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  function isObjectId(s) { return typeof s === 'string' && OBJECT_ID.test(s); }
  function isUuidHex(s) { return typeof s === 'string' && UUID_HEX.test(s); }
  function isSlug(s) { return typeof s === 'string' && SLUG.test(s); }
  function externalId(source, id) {
    if (!isEnum('IdSource', source)) throw new Error('unknown id source ' + source);
    if (id === null || id === undefined || String(id) === '') throw new Error('empty external id');
    return { source: source, id: String(id) };
  }
  function formatExternalId(x) { return x.source + ':' + x.id; }
  function parseExternalId(s) {
    var i = typeof s === 'string' ? s.indexOf(':') : -1;
    if (i <= 0) return null;
    var source = s.slice(0, i), id = s.slice(i + 1);
    return isEnum('IdSource', source) && id ? { source: source, id: id } : null;
  }

  // ── Money ──────────────────────────────────────────────────────────────────
  function isCents(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; }
  function assertCents(n, what) {
    if (!isCents(n)) throw new TypeError((what || 'amount') + ' must be an integer number of cents, got ' + JSON.stringify(n));
    return n;
  }
  // THE dollars→cents boundary. Rounds half away from zero the way a till does; refuses NaN.
  function centsFromDollars(d) {
    var f = d;
    if (typeof d === 'string') {
      var t = d.replace(/[$,\s]/g, '');
      if (!/^-?\d+(\.\d+)?$/.test(t)) throw new TypeError('not a dollar amount: ' + JSON.stringify(d));
      f = parseFloat(t);
    }
    if (typeof f !== 'number' || !isFinite(f)) throw new TypeError('not a dollar amount: ' + JSON.stringify(d));
    var sign = f < 0 ? -1 : 1;
    return sign * Math.round(Math.abs(f) * 100 + 1e-9);
  }
  function dollarsFromCents(c) { assertCents(c); return c / 100; }
  function money(cents, basis, currency) {
    assertCents(cents, 'money.cents');
    if (!isEnum('MoneyBasis', basis)) throw new Error('money basis must be one of ' + ENUMS.MoneyBasis.values.join(', '));
    return { cents: cents, currency: currency || 'USD', basis: basis };
  }

  // ── Time ───────────────────────────────────────────────────────────────────
  var ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
  var BARE_DATE = /^\d{4}-\d{2}-\d{2}$/;
  // A pattern match is not a date: V8 rolls Feb 30 and 24:00 forward, so the round trip must reproduce the text.
  function isIsoUtc(s) {
    if (typeof s !== 'string' || !ISO_UTC.test(s)) return false;
    var ms = Date.parse(s); if (isNaN(ms)) return false;
    return new Date(ms).toISOString().slice(0, 19) === s.slice(0, 19);
  }
  function isBareDate(s) { return typeof s === 'string' && BARE_DATE.test(s) && isIsoUtc(s + 'T00:00:00Z'); }
  function isoNow() { return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'); }
  // Legacy backends store epoch MILLISECONDS as Number; wm-demo stores epoch SECONDS as REAL.
  // Both are converted here and nowhere else. A value under 1e11 is seconds.
  function isoFromEpoch(n) {
    if (typeof n !== 'number' || !isFinite(n)) throw new TypeError('not an epoch: ' + JSON.stringify(n));
    var ms = n < 1e11 ? n * 1000 : n;
    return new Date(Math.floor(ms / 1000) * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  }
  function epochMsFromIso(s) { if (!isIsoUtc(s)) throw new TypeError('not ISO-8601 UTC: ' + JSON.stringify(s)); return Date.parse(s); }
  function toIso(v) {
    if (v instanceof Date) return v.toISOString().replace(/\.\d{3}Z$/, 'Z');
    if (typeof v === 'number') return isoFromEpoch(v);
    if (isIsoUtc(v)) return v;
    if (isBareDate(v)) return v + 'T00:00:00Z';
    // No local-time parsing: a string without a zone means something different on every host.
    throw new TypeError('not a time (ISO-8601 UTC with Z, a bare date, an epoch or a Date): ' + JSON.stringify(v));
  }

  // ── Errors ─────────────────────────────────────────────────────────────────
  function error(code, message, details) {
    if (!isEnum('ErrorCode', code)) throw new Error('unknown error code ' + code);
    var e = { code: code, message: String(message || code) };
    if (details !== undefined) e.details = details;
    return { error: e };
  }
  function httpStatus(code) { return HTTP_STATUS[code] || 500; }
  // Legacy shapes ({message}, {error:"…"}, {success:false,…}) → the contract shape.
  function errorFromLegacy(status, body) {
    var code = { 400: 'bad_request', 401: 'unauthorized', 403: 'forbidden', 404: 'not_found', 409: 'conflict',
      422: 'unprocessable', 429: 'rate_limited', 501: 'not_built' }[status] || 'internal';
    var msg = body && (typeof body.error === 'string' ? body.error : body.message) || ('HTTP ' + status);
    var details = body && body.hint ? { hint: body.hint } : undefined;
    return error(code, msg, details);
  }

  // ── Events ─────────────────────────────────────────────────────────────────
  function event(type, data, opts) {
    if (!isEnum('EventType', type)) throw new Error('unknown event type ' + type);
    opts = opts || {};
    return { event_id: opts.event_id || randomHex(16), type: type, contract: VERSION,
      at: opts.at || isoNow(), source: opts.source || 'unknown', data: data === undefined ? {} : data };
  }
  function randomHex(bytes) {
    var out = '', c = (typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto : null;
    if (c) { var a = new Uint8Array(bytes); c.getRandomValues(a); for (var i = 0; i < a.length; i++) out += (a[i] < 16 ? '0' : '') + a[i].toString(16); return out; }
    try { return require('crypto').randomBytes(bytes).toString('hex'); } catch (e) { throw new Error('no secure random available'); }
  }
  // Signing preimage for CONTRACT EVENT ENVELOPES: "<unix_ts>.<canonical_json>". Same shape as
  // wm-demo/wmdemo/idv_webhooks.py's engine channel, but NOT the same bytes: that channel prints
  // integral floats as `100.0` and rounds ties banker's-style, and it is a two-party contract with
  // idv-engine, so it keeps its own canonicalisation until both sides move together (planned 0.3.0).
  // The HMAC itself is computed by the host (node crypto / python hmac); this only fixes the bytes.
  function canonicalJson(v) {
    if (v === null || typeof v !== 'object') {
      // Floats to 2 dp via toFixed (binary-exact, like Python's round); integral values print
      // without a decimal point — the Python side (wmdemo/contracts.py) applies the same rule.
      if (typeof v === 'number') {
        if (!isFinite(v) || Math.abs(v) >= 1e15) throw new RangeError('number not representable in a signed body: ' + v);
        return JSON.stringify(Number(v.toFixed(2)));
      }
      return JSON.stringify(v);
    }
    if (Array.isArray(v)) return '[' + v.map(function (x) { return x === undefined ? 'null' : canonicalJson(x); }).join(',') + ']';
    var keys = Object.keys(v).filter(function (k) { return v[k] !== undefined; }).sort();
    return '{' + keys.map(function (k) { return JSON.stringify(k) + ':' + canonicalJson(v[k]); }).join(',') + '}';
  }
  function signingPreimage(unixTs, body) { return String(unixTs) + '.' + canonicalJson(body); }

  // ── Schemas (JSON Schema subset) ───────────────────────────────────────────
  // Deliberately a subset: type, required, properties, additionalProperties, items, enum (by
  // name via $enum), pattern, minimum, maximum, nullable, $ref to another schema. Enough to fail on
  // drift, small enough to run in a browser and to re-implement in 120 lines of Python.
  // ── Promotion rules (hw.rule.v1) ────────────────────────────────────────────
  // Which base type (and, via RULE_OPS_BY_TYPE, which ops) each RuleField accepts. Exported to
  // enums.json as rule_field_type so wm-demo reads the same table instead of a second copy.
  var RULE_FIELD_TYPE = {
    'batch.batch_no': 'string', 'batch.thc_pct': 'number', 'batch.packaged_at': 'date',
    'batch.received_at': 'date', 'batch.expires_at': 'date', 'batch.age_days': 'number',
    'product.shell_id': 'string', 'product.sku': 'string', 'product.category_id': 'string', 'product.brand': 'string',
    'cart.subtotal_cents': 'number', 'cart.line_count': 'number',
    'customer.tier': 'enum', 'customer.segment_id': 'string',
    'order.channel': 'enum', 'order.store_id': 'string',
    'time.dow': 'number', 'time.hour': 'number',
  };
  // DoS guard on the rule tree. The JSON-Schema subset here has no maxItems/maxLength, so these
  // six cannot live in PromotionRule's schema itself -- validatePromotionRule enforces them.
  // max_bytes is checked FIRST, on JSON.stringify(rule).length, before validate() or any
  // recursive walk runs at all -- 2026-09-16 refuter finding: max_nodes used to only count
  // condition LEAVES (nodeCount++ lived inside the `if (hasCond)` branch), so a tree of nothing
  // but empty `{all:[],any:[],not:[]}` groups had no cap at all -- 1,000,000 of them at depth 2
  // (well under max_depth) produced a 29 MB payload that validatePromotionRule accepted in
  // 460ms. max_nodes now counts every node (group or condition); max_group_items additionally
  // caps each all/any/not array so a wide group can't even be recursed into; max_bytes is the
  // backstop that rejects an oversized body in O(n) without walking it at all.
  // Exported to enums.json as rule_limits so Python reads the same numbers.
  var RULE_LIMITS = { max_depth: 4, max_nodes: 50, max_group_items: 50, max_bytes: 16384, max_list: 200, max_string: 200 };
  // Ops each field type accepts (union across all four types == ENUMS.RuleOp.values, 13 ops).
  // A compatibility TABLE, not a schema keyword -- lives here and in validatePromotionRule only.
  // Exported to enums.json as rule_ops_by_type (tools/contracts-export.mjs) -- this WAS JS-only
  // (team 1b's Python engine re-implemented it by hand) until 0.5.0's Team 3b export; Python
  // must now read enums.json['rule_ops_by_type'] instead of carrying its own copy. (Corrected
  // 2026-09-16: this comment previously claimed the opposite, and so did wmdemo/contracts.py's
  // own mirrored comment -- see RULE-SHAPE.md §3.)
  var RULE_OPS_BY_TYPE = {
    number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'in', 'not_in'],
    string: ['eq', 'neq', 'in', 'not_in'],
    date: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'before', 'after', 'older_than_days', 'newer_than_days'],
    enum: ['eq', 'neq', 'in', 'not_in'],
  };

  // PII_CLASS: 'Shape.property' -> restricted|internal|normal, per the three-tier legend in
  // docs/migration/MIGRATION-PLAN-2026-09-16.md §1 (restricted = SSN/DL/passport/home address/
  // emergency contact/bank/cash figures/signed attachments; internal = contact info, plus any field
  // naming a specific *other* person, e.g. submitted_by/approved_by/dismissed_by/lp_owner; normal =
  // everything else). A route strips 'restricted' unconditionally and 'internal' unless the caller's
  // scope is hr|admin (lp|admin for the two LP shapes) -- the M1 People-screen rule the migration plan
  // describes. A nested object (CloserReport.cash, .cards; LossLedgerEntry.window) is classified as one
  // block, not leaf-by-leaf, since a route strips or keeps the whole block. Exported to enums.json as
  // pii_class the same way rule_limits already is (tools/contracts-export.mjs).
  var PII_CLASS = {
    'HrEmployee.source_ref': 'normal', 'HrEmployee.person_id': 'normal', 'HrEmployee.entity_id': 'normal',
    'HrEmployee.store_id': 'normal', 'HrEmployee.display_name': 'normal', 'HrEmployee.email': 'internal',
    'HrEmployee.phone': 'internal', 'HrEmployee.status': 'normal', 'HrEmployee.title': 'normal',
    'HrEmployee.location': 'normal', 'HrEmployee.reports_to': 'normal', 'HrEmployee.tenure_label': 'normal',
    'HrEmployee.accountability_band': 'normal', 'HrEmployee.total_incidents': 'normal', 'HrEmployee.writeup_count': 'normal',
    'HrEmployee.doc_flags': 'normal', 'HrEmployee.separation_date': 'normal', 'HrEmployee.separation_note': 'internal',
    'HrEmployee.created_at': 'normal',

    'HrEmployeeRestricted.source_ref': 'normal', 'HrEmployeeRestricted.person_id': 'internal',
    'HrEmployeeRestricted.entity_id': 'normal', 'HrEmployeeRestricted.ssn': 'restricted',
    'HrEmployeeRestricted.dl_number': 'restricted', 'HrEmployeeRestricted.passport_number': 'restricted',
    'HrEmployeeRestricted.home_address': 'restricted', 'HrEmployeeRestricted.emergency_contact_name': 'restricted',
    'HrEmployeeRestricted.emergency_contact_phone': 'restricted', 'HrEmployeeRestricted.emergency_contact_relationship': 'restricted',
    'HrEmployeeRestricted.bank_account_last4': 'restricted',

    'Incident.source_ref': 'normal', 'Incident.entity_id': 'normal', 'Incident.store_id': 'normal',
    'Incident.employee_person_id': 'normal', 'Incident.number': 'normal', 'Incident.type': 'normal',
    'Incident.issue_category': 'normal', 'Incident.severity': 'normal', 'Incident.description': 'normal',
    'Incident.date_of_incident': 'normal', 'Incident.status': 'normal', 'Incident.source': 'normal',
    'Incident.escalate_to_writeup': 'normal', 'Incident.customer_name': 'internal', 'Incident.order_number': 'normal',
    'Incident.is_driver_involved': 'normal', 'Incident.submitter_email': 'internal', 'Incident.subject_role': 'normal',
    'Incident.attachments_count': 'internal', 'Incident.dismissed': 'normal', 'Incident.dismissed_at': 'normal',
    'Incident.dismissed_by': 'internal', 'Incident.created_at': 'normal',

    'WriteUp.source_ref': 'normal', 'WriteUp.entity_id': 'normal', 'WriteUp.employee_person_id': 'normal',
    'WriteUp.ladder': 'normal', 'WriteUp.level': 'normal', 'WriteUp.severity_recommendation': 'normal',
    'WriteUp.status': 'normal', 'WriteUp.ai_draft_status': 'normal', 'WriteUp.window_days': 'normal',
    'WriteUp.dismissed': 'normal', 'WriteUp.counts_toward_ladder': 'normal', 'WriteUp.approved_by': 'internal',
    'WriteUp.approved_at': 'normal', 'WriteUp.sent_at': 'normal', 'WriteUp.issued_at': 'normal',
    'WriteUp.date_of_incident': 'normal', 'WriteUp.policy_violated': 'normal', 'WriteUp.description': 'normal',
    'WriteUp.corrective_action': 'normal', 'WriteUp.linked_incident_id': 'normal', 'WriteUp.linked_calloff_ids': 'normal',
    'WriteUp.emp_acknowledged': 'normal', 'WriteUp.ack_at': 'normal', 'WriteUp.email_sent': 'normal',
    'WriteUp.ct_sent': 'normal', 'WriteUp.dismissed_at': 'normal', 'WriteUp.dismissed_by': 'internal',
    'WriteUp.created_at': 'normal',

    'CallOff.source_ref': 'normal', 'CallOff.entity_id': 'normal', 'CallOff.employee_person_id': 'normal',
    'CallOff.type': 'normal', 'CallOff.reason': 'normal', 'CallOff.date': 'normal', 'CallOff.shift_start_time': 'normal',
    'CallOff.expected_arrival_time': 'normal', 'CallOff.minutes_late': 'normal', 'CallOff.notes': 'normal',
    'CallOff.doctors_note_attachment_present': 'restricted', 'CallOff.status': 'normal', 'CallOff.submitted_by': 'internal',
    'CallOff.team': 'normal', 'CallOff.writeup_id': 'normal', 'CallOff.dismissed': 'normal', 'CallOff.dismissed_at': 'normal',
    'CallOff.dismissed_by': 'internal', 'CallOff.created_at': 'normal',

    'CloserReport.source_ref': 'normal', 'CloserReport.entity_id': 'normal', 'CloserReport.store_id': 'normal',
    'CloserReport.mode': 'normal', 'CloserReport.driver_person_id': 'internal', 'CloserReport.auditor_person_id': 'internal',
    'CloserReport.region': 'normal', 'CloserReport.register': 'normal', 'CloserReport.shift_date': 'normal',
    'CloserReport.created_at': 'normal', 'CloserReport.cash': 'restricted', 'CloserReport.cards': 'restricted',
    'CloserReport.discrepancy': 'normal', 'CloserReport.severity': 'normal', 'CloserReport.status': 'normal',
    'CloserReport.eos_incident_id': 'normal', 'CloserReport.response_deadline': 'normal', 'CloserReport.driver_response': 'normal',
    'CloserReport.driver_response_at': 'normal', 'CloserReport.manager_decision': 'normal', 'CloserReport.manager_decision_by': 'internal',
    'CloserReport.manager_decision_at': 'normal', 'CloserReport.lp_disposition': 'normal', 'CloserReport.lp_disposition_by': 'internal',
    'CloserReport.lp_disposition_at': 'normal', 'CloserReport.lp_owner': 'internal', 'CloserReport.amount_recovered': 'restricted',
    'CloserReport.final_loss': 'restricted', 'CloserReport.pattern_flag': 'normal',

    'LossLedgerEntry.source_ref': 'normal', 'LossLedgerEntry.entity_id': 'normal', 'LossLedgerEntry.person_id': 'internal',
    'LossLedgerEntry.store_id': 'normal', 'LossLedgerEntry.closer_report_id': 'normal', 'LossLedgerEntry.shift_date': 'normal',
    'LossLedgerEntry.final_loss': 'restricted', 'LossLedgerEntry.amount_recovered': 'restricted', 'LossLedgerEntry.net_loss': 'restricted',
    'LossLedgerEntry.reason_code': 'normal', 'LossLedgerEntry.disposition': 'normal', 'LossLedgerEntry.window': 'restricted',
    'LossLedgerEntry.high_risk': 'normal', 'LossLedgerEntry.recorded_at': 'normal',
  };

  var EXT = { type: 'object', required: ['source', 'id'], additionalProperties: false,
    properties: { source: { type: 'string', $enum: 'IdSource' }, id: { type: 'string', minLength: 1 } } };
  var MONEY = { type: 'object', required: ['cents', 'currency', 'basis'], additionalProperties: false,
    properties: { cents: { type: 'integer' }, currency: { type: 'string', $enum: 'Currency' }, basis: { type: 'string', $enum: 'MoneyBasis' } } };
  var ISO = { type: 'string', pattern: ISO_UTC.source };
  var ID = { type: 'string', minLength: 1 };
  var SCHEMAS = {
    ExternalId: EXT,
    Money: MONEY,
    Store: { type: 'object', required: ['id', 'name', 'platform', 'tz', 'pos', 'active'], additionalProperties: true,
      properties: { id: ID, name: { type: 'string' }, platform: { type: 'string', $enum: 'Platform' },
        tz: { type: 'string' }, pos: { type: 'string', $enum: 'PosVendor' }, active: { type: 'boolean' },
        region_id: { type: 'string', nullable: true }, external_ids: { type: 'array', items: { $ref: 'ExternalId' } } } },
    Person: { type: 'object', required: ['id', 'kind', 'display_name'], additionalProperties: true,
      properties: { id: ID, kind: { type: 'string', $enum: 'PersonKind' }, display_name: { type: 'string' },
        role: { type: 'string', $enum: 'Role', nullable: true }, classification: { type: 'string', $enum: 'Classification', nullable: true },
        store_id: { type: 'string', nullable: true }, email: { type: 'string', nullable: true }, phone: { type: 'string', nullable: true },
        external_ids: { type: 'array', items: { $ref: 'ExternalId' } },
        verified: { type: 'boolean', nullable: true }, created_at: { type: 'string', pattern: ISO_UTC.source, nullable: true } } },
    Product: { type: 'object', required: ['id', 'platform', 'source', 'name', 'price'], additionalProperties: true,
      properties: { id: ID, platform: { type: 'string', $enum: 'Platform' }, source: { type: 'string', $enum: 'ProductSource' },
        name: { type: 'string' }, sku: { type: 'string', nullable: true }, brand: { type: 'string', nullable: true },
        category: { type: 'string', nullable: true }, price: { $ref: 'Money' }, sale_price: { $ref: 'Money', nullable: true },
        quantity_on_hand: { type: 'integer', nullable: true }, external_ids: { type: 'array', items: { $ref: 'ExternalId' } } } },
    OrderLine: { type: 'object', required: ['product_id', 'name', 'quantity', 'unit_price', 'line_gross', 'discount'], additionalProperties: true,
      properties: { product_id: ID, name: { type: 'string' }, brand: { type: 'string', nullable: true }, category: { type: 'string', nullable: true },
        quantity: { type: 'number', minimum: 0 }, unit_price: { $ref: 'Money' }, line_gross: { $ref: 'Money' }, discount: { $ref: 'Money' } } },
    Order: { type: 'object', required: ['id', 'platform', 'store_id', 'status', 'txn_type', 'created_at', 'subtotal', 'discount', 'total'], additionalProperties: true,
      properties: { id: ID, platform: { type: 'string', $enum: 'Platform' }, store_id: ID, status: { type: 'string', $enum: 'OrderStatus' },
        txn_type: { type: 'string', $enum: 'TxnType' }, ref_order_id: { type: 'string', nullable: true },
        customer_id: { type: 'string', nullable: true }, associate_id: { type: 'string', nullable: true },
        created_at: ISO, completed_at: { type: 'string', pattern: ISO_UTC.source, nullable: true },
        subtotal: { $ref: 'Money' }, discount: { $ref: 'Money' }, tax: { $ref: 'Money', nullable: true }, total: { $ref: 'Money' },
        lines: { type: 'array', items: { $ref: 'OrderLine' } }, external_ids: { type: 'array', items: { $ref: 'ExternalId' } } } },
    Standing: { type: 'object', required: ['person', 'metric', 'value', 'rank'], additionalProperties: true,
      properties: { person: { $ref: 'Person' }, metric: { type: 'string', $enum: 'Metric' }, value: { type: 'integer' }, rank: { type: 'integer', minimum: 1, nullable: true },
        tied: { type: 'boolean' }, earned: { $ref: 'Money', nullable: true }, progress: { type: 'number', nullable: true } } },
    Contest: { type: 'object', required: ['id', 'name', 'kind', 'status', 'metric', 'audience', 'store_ids'], additionalProperties: true,
      properties: { id: ID, name: { type: 'string' }, kind: { type: 'string', $enum: 'ContestKind' }, status: { type: 'string', $enum: 'ContestStatus' },
        metric: { type: 'string', $enum: 'Metric' }, audience: { type: 'array', items: { type: 'string', $enum: 'Classification' } },
        store_ids: { type: 'array', items: ID }, starts_at: { type: 'string', pattern: ISO_UTC.source, nullable: true },
        ends_at: { type: 'string', pattern: ISO_UTC.source, nullable: true }, prize: { $ref: 'Money', nullable: true } } },
    PointsEntry: { type: 'object', required: ['id', 'person_id', 'kind', 'amount', 'at'], additionalProperties: true,
      properties: { id: ID, person_id: ID, kind: { type: 'string', $enum: 'PointsKind' }, amount: { $ref: 'Money' }, at: ISO,
        contest_id: { type: 'string', nullable: true }, note: { type: 'string', nullable: true } } },
    VerificationSession: { type: 'object', required: ['id', 'status', 'channel', 'created_at'], additionalProperties: true,
      properties: { id: ID, session_number: { type: 'integer', nullable: true }, status: { type: 'string', $enum: 'VerificationStatus' },
        channel: { type: 'string', $enum: 'VerificationChannel' }, person_id: { type: 'string', nullable: true },
        reasons: { type: 'array', items: { type: 'string', $enum: 'VerificationReason' } },
        created_at: ISO, completed_at: { type: 'string', pattern: ISO_UTC.source, nullable: true },
        external_ids: { type: 'array', items: { $ref: 'ExternalId' } } } },
    Task: { type: 'object', required: ['id', 'status', 'assignment_mode', 'created_at'], additionalProperties: true,
      properties: { id: ID, order_id: { type: 'string', nullable: true }, fleet_id: { type: 'string', nullable: true },
        status: { type: 'string', $enum: 'TaskStatus' }, assignment_mode: { type: 'string', $enum: 'TaskAssignmentMode' },
        region_id: { type: 'string', nullable: true }, created_at: ISO, total: { $ref: 'Money', nullable: true } } },
    Fleet: { type: 'object', required: ['id', 'person_id', 'status', 'verification_status'], additionalProperties: true,
      properties: { id: ID, person_id: ID, status: { type: 'string', $enum: 'FleetStatus' },
        verification_status: { type: 'string', $enum: 'FleetVerificationStatus' }, on_duty: { type: 'boolean' }, region_id: { type: 'string', nullable: true } } },
    Promotion: { type: 'object', required: ['id', 'platform', 'name', 'status', 'rule_types'], additionalProperties: true,
      properties: { id: ID, platform: { type: 'string', $enum: 'Platform' }, name: { type: 'string' }, codes: { type: 'array', items: { type: 'string' } },
        status: { type: 'string', $enum: 'PromotionStatus' }, rule_types: { type: 'array', items: { type: 'string', $enum: 'RuleType' } },
        starts_at: { type: 'string', pattern: ISO_UTC.source, nullable: true }, ends_at: { type: 'string', pattern: ISO_UTC.source, nullable: true },
        usage_limit: { type: 'integer', nullable: true }, stackable: { type: 'boolean' },
        // 0.5.0 -- additive: the single-rule-shape engine (hw.rule.v1). Nothing above changed shape.
        rule: { $ref: 'PromotionRule', nullable: true } } },
    // 0.5.0 -- PromotionRule (hw.rule.v1). RuleCondition is a leaf; RuleGroup is all/any/not of
    // RuleNode; RuleNode itself models BOTH forms in one flat object (the subset has no oneOf) --
    // "exactly one form present" and the four RULE_LIMITS are enforced by validatePromotionRule,
    // not by this schema.
    RuleCondition: { type: 'object', required: ['field', 'op', 'value'], additionalProperties: false,
      properties: { field: { type: 'string', $enum: 'RuleField' }, op: { type: 'string', $enum: 'RuleOp' }, value: {} } },
    RuleNode: { type: 'object', additionalProperties: false,
      properties: { field: { type: 'string', $enum: 'RuleField' }, op: { type: 'string', $enum: 'RuleOp' }, value: {},
        all: { type: 'array', items: { $ref: 'RuleNode' } }, any: { type: 'array', items: { $ref: 'RuleNode' } }, not: { type: 'array', items: { $ref: 'RuleNode' } } } },
    RuleGroup: { type: 'object', required: ['all', 'any', 'not'], additionalProperties: false,
      properties: { all: { type: 'array', items: { $ref: 'RuleNode' } }, any: { type: 'array', items: { $ref: 'RuleNode' } }, not: { type: 'array', items: { $ref: 'RuleNode' } } } },
    PromotionRule: { type: 'object',
      required: ['shape', 'id', 'name', 'status', 'priority', 'stackable', 'window', 'scope', 'if', 'then', 'meta'],
      additionalProperties: false,
      properties: {
        shape: { type: 'string', $enum: 'RuleShape' }, id: ID, name: { type: 'string' },
        status: { type: 'string', $enum: 'RuleStatus' }, priority: { type: 'integer' }, stackable: { type: 'boolean' },
        window: { type: 'object', required: ['starts_at', 'ends_at'], additionalProperties: false,
          properties: { starts_at: ISO, ends_at: { type: 'string', pattern: ISO_UTC.source, nullable: true } } },
        scope: { type: 'object', required: ['store_ids', 'channels'], additionalProperties: false,
          properties: { store_ids: { type: 'array', items: ID }, channels: { type: 'array', items: { type: 'string', $enum: 'RuleChannel' } } } },
        if: { $ref: 'RuleGroup' },
        // cap_cents/max_per_order have a fixed shape regardless of then.kind, so `minimum` lives
        // here; then.value's shape DEPENDS on then.kind (percent vs price vs gift, ...) and the
        // subset has no oneOf/if-then to express that, so per-kind value rules live only in
        // validatePromotionRule's _checkThenValue (RULE-SHAPE.md §1).
        then: { type: 'object', required: ['kind', 'value', 'applies_to', 'cap_cents', 'max_per_order'], additionalProperties: false,
          properties: { kind: { type: 'string', $enum: 'RuleThenKind' }, value: {}, applies_to: { type: 'string', enum: ['matched_lines', 'cart'] },
            cap_cents: { type: 'integer', nullable: true, minimum: 0 }, max_per_order: { type: 'integer', nullable: true, minimum: 1 } } },
        meta: { type: 'object', required: ['author', 'source', 'prompt', 'version'], additionalProperties: false,
          properties: { author: { type: 'string' }, source: { type: 'string', $enum: 'RuleSource' }, prompt: { type: 'string', nullable: true }, version: { type: 'integer' } } },
      } },
    Error: { type: 'object', required: ['error'], additionalProperties: false,
      properties: { error: { type: 'object', required: ['code', 'message'], additionalProperties: false,
        properties: { code: { type: 'string', $enum: 'ErrorCode' }, message: { type: 'string' }, details: { nullable: true } } } } },
    Event: { type: 'object', required: ['event_id', 'type', 'contract', 'at', 'source', 'data'], additionalProperties: false,
      properties: { event_id: ID, type: { type: 'string', $enum: 'EventType' }, contract: { type: 'string' }, at: ISO, source: { type: 'string' }, data: { type: 'object' } } },
    // 0.4.0 — inventory. A Batch is the unit of identity a customer cares about (THC, package date);
    // a Location is anywhere product can be (a kit box and a shelf are both locations); a Movement is
    // the only way quantity changes; a ReceivedItem is one arrival of one of three kinds; a Plan is
    // what the engine decided and why, line by line.
    Location: { type: 'object', required: ['id', 'kind', 'name'], additionalProperties: true,
      properties: { id: ID, kind: { type: 'string', $enum: 'LocationKind' }, name: { type: 'string' },
        address: { type: 'string', nullable: true }, store_id: { type: 'string', nullable: true }, region_id: { type: 'string', nullable: true },
        parent_id: { type: 'string', nullable: true }, active: { type: 'boolean' }, capacity: { type: 'integer', nullable: true } } },
    Batch: { type: 'object', required: ['id', 'product_id', 'batch_no', 'received_at'], additionalProperties: true,
      properties: { id: ID, product_id: ID, sku: { type: 'string', nullable: true }, batch_no: { type: 'string' },
        metrc_tag: { type: 'string', nullable: true }, /* deprecated 0.4.3: first tag */ metrc_packages: { type: 'array', items: { type: 'object', properties: { tag: { type: 'string', minLength: 1 }, quantity: { type: 'integer', minimum: 0, nullable: true }, packaged_at: { type: 'string', pattern: ISO_UTC.source, nullable: true } }, required: ['tag'], additionalProperties: false } }, packaged_at: { type: 'string', pattern: ISO_UTC.source, nullable: true },
        expires_at: { type: 'string', pattern: ISO_UTC.source, nullable: true }, received_at: ISO,
        thc_pct: { type: 'number', minimum: 0, maximum: 100, nullable: true }, unit_cost: { $ref: 'Money', nullable: true },
        quantity: { type: 'integer', minimum: 0 }, location_id: { type: 'string', nullable: true },
        external_ids: { type: 'array', items: { $ref: 'ExternalId' } } } },
    Movement: { type: 'object', required: ['id', 'at', 'reason', 'product_id', 'batch_id', 'quantity', 'to_location_id'], additionalProperties: true,
      properties: { id: ID, at: ISO, reason: { type: 'string', $enum: 'MovementReason' }, product_id: ID, batch_id: ID,
        quantity: { type: 'integer', minimum: 1 }, from_location_id: { type: 'string', nullable: true }, to_location_id: ID,
        tag_ids: { type: 'array', items: { type: 'string' } }, actor_id: { type: 'string', nullable: true },
        ref: { type: 'string', nullable: true }, note: { type: 'string', nullable: true } } },
    ReceivedItem: { type: 'object', required: ['id', 'received_at', 'kind', 'product_id', 'batch_id', 'quantity'], additionalProperties: true,
      properties: { id: ID, received_at: ISO, kind: { type: 'string', $enum: 'ArrivalKind' }, product_id: ID, batch_id: ID,
        quantity: { type: 'integer', minimum: 1 }, location_id: { type: 'string', nullable: true },
        included_in: { type: 'array', items: { type: 'string' } }, reason: { type: 'string', $enum: 'PlanReason', nullable: true },
        premium: { type: 'boolean' } } },
    PlanLine: { type: 'object', required: ['product_id', 'batch_id', 'to_location_id', 'sold', 'need', 'cap', 'give', 'reasons'], additionalProperties: true,
      properties: { product_id: ID, batch_id: ID, from_location_id: { type: 'string', nullable: true }, to_location_id: ID,
        sold: { type: 'integer', minimum: 0 }, need: { type: 'integer', minimum: 0 }, cap: { type: 'integer', minimum: 0 },
        give: { type: 'integer', minimum: 0 }, reasons: { type: 'array', items: { type: 'string', $enum: 'PlanReason' } },
        mixed_batch: { type: 'boolean' }, note: { type: 'string', nullable: true },
        // 0.4.1 attribution — who picked, packed and verified this line (person ids), with times
        picked_by: { type: 'string', nullable: true }, picked_at: { type: 'string', pattern: ISO_UTC.source, nullable: true },
        packed_by: { type: 'string', nullable: true }, packed_at: { type: 'string', pattern: ISO_UTC.source, nullable: true },
        verified_by: { type: 'string', nullable: true }, verified_at: { type: 'string', pattern: ISO_UTC.source, nullable: true },
        overridden_by: { type: 'string', nullable: true } } },
    // 0.4.2 — placement: which Location a shell (or a store's override of it) uses per side. Variations inherit.
    ShellLocationBinding: { type: 'object', required: ['shell_id', 'side', 'location_id'], additionalProperties: true,
      properties: { shell_id: ID, store_id: { type: 'string', nullable: true }, side: { type: 'string', $enum: 'LocationSide' },
        location_id: ID, updated_at: { type: 'string', pattern: ISO_UTC.source, nullable: true }, updated_by: { type: 'string', nullable: true } } },
    Plan: { type: 'object', required: ['id', 'kind', 'business_day', 'generated_at', 'channel', 'lines'], additionalProperties: true,
      properties: { id: ID, kind: { type: 'string', enum: ['build', 'refill', 'restock', 'handoff'] }, business_day: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
        generated_at: ISO, channel: { type: 'string', $enum: 'ChannelKind' }, store_id: { type: 'string', nullable: true },
        lines: { type: 'array', items: { $ref: 'PlanLine' } }, skipped: { type: 'array', items: { $ref: 'PlanLine' } },
        warnings: { type: 'array', items: { type: 'string' } }, inputs: { type: 'object', nullable: true },
        // 0.4.1 attribution — 'system' or a person id; the engine version that produced it
        planned_by: { type: 'string', nullable: true }, engine_version: { type: 'string', nullable: true },
        approved_by: { type: 'string', nullable: true }, approved_at: { type: 'string', pattern: ISO_UTC.source, nullable: true } } },

    // 0.5.0 — Track 3 LP+HR migration (BUILD-PROGRAM-MASTER-PLAN-2026-09-16.md §4, Team 3b).
    // Airtable stays system of record through M2: these are the API/UI contract our server exposes over
    // it, not a new database schema. Every shape below carries source_ref (AirtableSourceRef) so a write
    // round-trips to the originating Airtable record, and entity_id (+ store_id where it applies) for
    // entity scoping (docs/migration/MIGRATION-PLAN-2026-09-16.md §2). PII classification lives in
    // PII_CLASS, not in the schema itself (additionalProperties:false is the over-posting guard; PII_CLASS
    // is the field-stripping guard a route applies before a response leaves the server).
    AirtableSourceRef: { type: 'object', required: ['base', 'table', 'record_id'], additionalProperties: false,
      properties: { base: { type: 'string', minLength: 1 }, table: { type: 'string', minLength: 1 }, record_id: { type: 'string', minLength: 1 } } },

    // Restricted PII (SSN, DL number, passport, home address, emergency contact, bank) is deliberately
    // modelled as HrEmployeeRestricted, never a property of HrEmployee -- see that shape below. This shape
    // holds only the internal/normal-class fields a People-list/detail route may ever return.
    // fields_map (Airtable field ids, onboarding/Config.js F_EMP unless noted): display_name=NAME
    // fldxBSlYpPJJ2bEgr, email=EMAIL fldEATdWjDJVPfQiy, entity_id<-EMPLOYER fldCqOlSqBJOWhC8C, status=STATUS
    // fldZrTtoaJjgqTFIS, location=LOCATION flddw77QIq14OaPkO, title<-TITLE fldTBIrFqypKZgbHp, reports_to<-
    // REPORTS_TO fldpvonzhnPdmbcfQ, tenure_label=TENURE fldSmgoxmVE6xEpTT, accountability_band=
    // ACCOUNTABILITY fldjuAFdK5YeqUN8H, total_incidents=TOTAL_INCIDENTS fld9vkDTOqt2ZAykW, writeup_count=
    // WRITEUP_COUNT fldkacP2HEhVbGEl1, separation_date=SEPARATION_DATE fldQpnxa7Zua5lsMt, separation_note=
    // SEPARATION_NOTE fld4SJAAi88dfVEcq, phone=PHONE fldGDKkLsOIM2kHbu. doc_flags has no single field id --
    // computed from Tables A/B/C (Policies & Documents / Required Doc Set / Renewal Checkpoints) via the
    // fixed doc-expiry logic (M1 Policies screen reads renewals directly, not Table A's stale status field,
    // per OWNER-DECISIONS-NEEDED.md #3). person_id is the join to Person.id (HR-DASHBOARD-INVENTORY.md §5
    // recommends a new HrEmployee contract referencing Person.id rather than growing Person) -- not yet
    // backed by a live join in Airtable.
    HrEmployee: { type: 'object', required: ['source_ref', 'entity_id', 'display_name', 'status'], additionalProperties: false,
      properties: {
        source_ref: { $ref: 'AirtableSourceRef' }, person_id: { type: 'string', nullable: true },
        entity_id: { type: 'string' }, store_id: { type: 'string', nullable: true },
        display_name: { type: 'string' }, email: { type: 'string', nullable: true }, phone: { type: 'string', nullable: true },
        status: { type: 'string', $enum: 'HrEmployeeStatus' }, title: { type: 'array', items: { type: 'string' } },
        location: { type: 'string', nullable: true }, reports_to: { type: 'string', nullable: true },
        tenure_label: { type: 'string', nullable: true }, accountability_band: { type: 'string', $enum: 'HrAccountabilityBand', nullable: true },
        total_incidents: { type: 'integer', minimum: 0, nullable: true }, writeup_count: { type: 'integer', minimum: 0, nullable: true },
        doc_flags: { type: 'array', items: { type: 'object', required: ['doc_type', 'status'], additionalProperties: false,
          properties: { doc_type: { type: 'string' }, status: { type: 'string', $enum: 'HrDocStatus' },
            expires_at: { type: 'string', pattern: ISO_UTC.source, nullable: true } } } },
        separation_date: { type: 'string', pattern: ISO_UTC.source, nullable: true }, separation_note: { type: 'string', nullable: true },
        created_at: { type: 'string', pattern: ISO_UTC.source, nullable: true } } },

    // Kept OUT of HrEmployee by construction: a route that only ever reads HrEmployee (every list/detail
    // response in M1) cannot leak restricted PII by accident, regardless of caller scope -- the
    // over-posting guard this task calls for. fields_map (onboarding/Config.js F_EMP unless noted):
    // ssn=SSN_PLAIN fldEw1uLp6v48uV9C (plaintext, source of truth -- OWNER-DECISIONS-NEEDED.md #2 keeps it
    // plaintext+PIN+audit for M4, encryption-at-rest is a fast-follow, not a blocker), dl_number=DL_NUMBER
    // fldVDiiA2JzjYpBTx, passport_number=PASSPORT_NUMBER fldeqxZefQp72tPhC, home_address=HOME_ADDRESS
    // fldCBYcVtBARZkIjz, emergency_contact_name=EC_NAME fld4zMgCcNZ2T81rD, emergency_contact_phone=EC_PHONE
    // fldndOQCYH9I9HRLT, emergency_contact_relationship=EC_RELATIONSHIP fldVi9MClYhj0J0LJ.
    // bank_account_last4: NO field id found in onboarding/Config.js or either inventory doc -- included
    // because the task names "bank" as a restricted class; nullable, gap flagged in the team report.
    HrEmployeeRestricted: { type: 'object', required: ['source_ref', 'person_id'], additionalProperties: false,
      properties: {
        source_ref: { $ref: 'AirtableSourceRef' }, person_id: { type: 'string' }, entity_id: { type: 'string', nullable: true },
        ssn: { type: 'string', nullable: true }, dl_number: { type: 'string', nullable: true }, passport_number: { type: 'string', nullable: true },
        home_address: { type: 'string', nullable: true }, emergency_contact_name: { type: 'string', nullable: true },
        emergency_contact_phone: { type: 'string', nullable: true }, emergency_contact_relationship: { type: 'string', nullable: true },
        bank_account_last4: { type: 'string', nullable: true } } },

    // fields_map (writeup-pipeline F_INC unless noted, onboarding/Config.js:335-358): employee_person_id<-
    // EMPLOYEE_LINK fldzVjGX09Lnm40df, type=TYPE fldY76LHWdDVorILW, severity=SEVERITY fldx2RzKQ0IOR1nKR,
    // description=DESCRIPTION fldEnWXlWLS2RaMJx, date_of_incident=DATE fldTC8Sfzv9EKPwlp, status=STATUS
    // fldxFTxMnKipKbxGA, number=NUMBER fldU6dTdLr4OWlk5o (autoNumber, read-only), escalate_to_writeup=
    // ESCALATE_FLAG fldmz4tzZGjC1YmqR, entity_id<-ENTITY_LOOKUP fldacaMHbtJ6nNUj8, dismissed=DISMISSED
    // fldYbGQsMoI2kqFlO, dismissed_at=DISMISSED_AT fldnohXAKurjF6oRk, dismissed_by=DISMISSED_BY
    // fldY9CsqDFa3v8Xkn. issue_category/customer_name/order_number/submitter_email/is_driver_involved/
    // subject_role are writeup-pipeline/IncidentPortal.js:36,38-40,43-44 field ids fldFa2iZkXHqQZJHo,
    // fldkVhU08Lm1h2ed2, fldZI9IJ8J94BJCuV, fldUslWuc6EUA6tu7, fldr927BphgwvuF2o, flddTD9Y49upZriOA
    // respectively (subject_role has no enumerated value set found -- left as free text). severity is
    // enforced server-side even if the client omits it (IncidentPortal.js:248-253, incident P0-B
    // 2026-08-07) -- required here too. attachments_count is derived (up to 20 attachments per
    // IncidentPortal.js:227); the attachments themselves are restricted and never carried on this shape
    // (migration plan M3 table) -- only a count crosses this boundary.
    Incident: { type: 'object',
      required: ['source_ref', 'entity_id', 'employee_person_id', 'type', 'severity', 'description', 'status'],
      additionalProperties: false,
      properties: {
        source_ref: { $ref: 'AirtableSourceRef' }, entity_id: { type: 'string' }, store_id: { type: 'string', nullable: true },
        employee_person_id: { type: 'string' }, number: { type: 'integer', nullable: true },
        type: { type: 'string', $enum: 'IncidentType' }, issue_category: { type: 'string', $enum: 'IncidentIssueCategory', nullable: true },
        severity: { type: 'string', $enum: 'Severity' }, description: { type: 'string' },
        date_of_incident: { type: 'string', pattern: ISO_UTC.source, nullable: true }, status: { type: 'string', $enum: 'IncidentStatus' },
        source: { type: 'string', nullable: true }, escalate_to_writeup: { type: 'boolean', nullable: true },
        customer_name: { type: 'string', nullable: true }, order_number: { type: 'string', nullable: true },
        is_driver_involved: { type: 'boolean', nullable: true }, submitter_email: { type: 'string', nullable: true },
        subject_role: { type: 'string', nullable: true }, attachments_count: { type: 'integer', minimum: 0, nullable: true },
        dismissed: { type: 'boolean', nullable: true }, dismissed_at: { type: 'string', pattern: ISO_UTC.source, nullable: true },
        dismissed_by: { type: 'string', nullable: true }, created_at: { type: 'string', pattern: ISO_UTC.source, nullable: true } } },

    // Carries the 2026-09-16 write-up ladder decision (attendance/accuracy separate, 90-day window,
    // dismissed never counts, AI drafts cap at second_warning, step-ups only via approve-and-send).
    // ladder/window_days/dismissed/counts_toward_ladder are NEW fields with no Airtable column yet -- the
    // ladder decision is not implemented in GAS. window_days is modelled as a one-value enum ([90]) since
    // this schema subset has no `const` keyword (same technique RuleShape already uses for 'hw.rule.v1').
    // dismissed=true => counts_toward_ladder=false is an application-level invariant this schema subset
    // cannot express (no if/then) -- enforce it where WriteUp records are written, not here.
    // fields_map (onboarding/Config.js F_WU:363-392 unless noted): employee_person_id<-EMPLOYEE_LINK
    // fldRxUjUpGojc02Ju, status=STATUS fldI1aybKj8PvDR1F, level=LEVEL fldQHQKKMGQRZO0VK ("DIRTY: legacy
    // options -- normalize", Config.js:366), ai_draft_status=AI_DRAFT_STATUS flddyZsawAbegZDT5,
    // emp_acknowledged=EMP_ACKNOWLEDGED fldYQFHRBsQ4haQib, ack_at=ACK_AT fldw0OHC3xa5Nu71U,
    // linked_incident_id<-LINKED_INCIDENT fldRK0G3735atSm4e, linked_calloff_ids<-CALLOFFS_LINK
    // fld66UcJOIUDjEwER, date_of_incident=DATE fldYZidppdD5e8nh8, issued_at=ISSUED_AT fldJWNPyxGsXb28Et,
    // corrective_action=CORRECTIVE_ACTION fldfRqUjSlosmMMNR (best-effort per Config.js:388-390
    // TODO(field-gap)), dismissed=DISMISSED fldRNvfDQ9dUggbFN, dismissed_at=DISMISSED_AT fld0nGidhzJx9ZMMR,
    // dismissed_by=DISMISSED_BY fldqI3qAbTAv8ypeZ, email_sent=EMAIL_SENT fldlyL1QmxxD5oWJT, ct_sent=CT_SENT
    // fldpSS1cp2eonToOS, approved_by<-MANAGER_APPROVED_BY fldHMLeyO6LzqtlCm, approved_at=
    // MANAGER_APPROVED_AT fld8uFGl3LTpAYDEP. policy_violated/severity_recommendation/sent_at: no verified
    // field id (Config.js:388-391 "no verified Write-Up DATE field id and no Category field id"); sent_at
    // is not a stored field today, it is whichever of email_sent/ct_sent/approved_at fires first.
    WriteUp: { type: 'object',
      required: ['source_ref', 'entity_id', 'employee_person_id', 'ladder', 'level', 'status', 'window_days', 'dismissed', 'counts_toward_ladder'],
      additionalProperties: false,
      properties: {
        source_ref: { $ref: 'AirtableSourceRef' }, entity_id: { type: 'string' }, employee_person_id: { type: 'string' },
        ladder: { type: 'string', $enum: 'WriteUpLadder' }, level: { type: 'string', $enum: 'WriteUpLevel' },
        severity_recommendation: { type: 'string', $enum: 'WriteUpLevel', nullable: true }, status: { type: 'string', $enum: 'WriteUpStatus' },
        ai_draft_status: { type: 'string', $enum: 'WriteUpAiDraftStatus', nullable: true }, window_days: { type: 'integer', enum: [90] },
        dismissed: { type: 'boolean' }, counts_toward_ladder: { type: 'boolean' },
        approved_by: { type: 'string', nullable: true }, approved_at: { type: 'string', pattern: ISO_UTC.source, nullable: true },
        sent_at: { type: 'string', pattern: ISO_UTC.source, nullable: true }, issued_at: { type: 'string', pattern: ISO_UTC.source, nullable: true },
        date_of_incident: { type: 'string', pattern: ISO_UTC.source, nullable: true }, policy_violated: { type: 'string', nullable: true },
        description: { type: 'string', nullable: true }, corrective_action: { type: 'string', nullable: true },
        linked_incident_id: { type: 'string', nullable: true }, linked_calloff_ids: { type: 'array', items: { type: 'string' } },
        emp_acknowledged: { type: 'boolean', nullable: true }, ack_at: { type: 'string', pattern: ISO_UTC.source, nullable: true },
        email_sent: { type: 'boolean', nullable: true }, ct_sent: { type: 'boolean', nullable: true },
        dismissed_at: { type: 'string', pattern: ISO_UTC.source, nullable: true }, dismissed_by: { type: 'string', nullable: true },
        created_at: { type: 'string', pattern: ISO_UTC.source, nullable: true } } },

    // fields_map (writeup-pipeline/CalloffPortal.js:31-44,74-77 unless noted): employee_person_id<-
    // EMPLOYEE fldcebdbqZpboisj3, type=TYPE fldzO2rlAs3kAo1L4, date=DATE_OF_OCCURRENCE fldKnEyIZZdy2Cn1x,
    // reason=REASON fldHaUqf7aCeiWIE0, entity_id<-ENTITY fldVzZS1MZiiYy9st ("DIRTY -- junk recID option +
    // dup, normalize via NORMALIZE_ENTITY_STRING", onboarding/Config.js:399), shift_start_time=
    // SHIFT_START_TIME fldke6aQLcdgCifzJ, expected_arrival_time=EXPECTED_ARRIVAL_TIME fldBhLc5YvYwz0rg2
    // (required server-side only when type=late, CalloffPortal.js:350 handleCallOffPost_ -- a conditional
    // requirement this schema subset cannot express), minutes_late=MINUTES_LATE fldY2uzhWL5zc9ETQ,
    // notes=NOTES fldwxxDrlSKImEYmf, submitted_by=SUBMITTED_BY fldOZVHejIQ4MtkJD, team=TEAM
    // fldN16aBXurQtbNu2. status=onboarding/Config.js F_CO.STATUS fldsgXwhwRdp35JIH, writeup_id<-
    // WRITEUP_LINK fld0y72OPk8lpVmAM, dismissed=DISMISSED fld6LBUAvCU0Pf0Ir, dismissed_at=DISMISSED_AT
    // fldCQ1GW6Tlh0Nn87, dismissed_by=DISMISSED_BY fldpT4uYDX4dbP4AC. doctors_note_attachment_present is
    // derived from DOCTORS_NOTE fld6nLIOnbleSHm3q / NOTICE_PDF fldiU0r5czLnKb0H8 -- presence flag only, the
    // file itself is restricted and never carried on this shape.
    CallOff: { type: 'object', required: ['source_ref', 'entity_id', 'employee_person_id', 'type', 'date', 'status'], additionalProperties: false,
      properties: {
        source_ref: { $ref: 'AirtableSourceRef' }, entity_id: { type: 'string' }, employee_person_id: { type: 'string' },
        type: { type: 'string', $enum: 'CallOffType' }, reason: { type: 'string', $enum: 'CallOffReason', nullable: true },
        date: { type: 'string', pattern: ISO_UTC.source }, shift_start_time: { type: 'string', nullable: true },
        expected_arrival_time: { type: 'string', nullable: true }, minutes_late: { type: 'integer', nullable: true },
        notes: { type: 'string', nullable: true }, doctors_note_attachment_present: { type: 'boolean', nullable: true },
        status: { type: 'string', $enum: 'HrCallOffStatus' }, submitted_by: { type: 'string', nullable: true },
        team: { type: 'string', nullable: true }, writeup_id: { type: 'string', nullable: true },
        dismissed: { type: 'boolean', nullable: true }, dismissed_at: { type: 'string', pattern: ISO_UTC.source, nullable: true },
        dismissed_by: { type: 'string', nullable: true }, created_at: { type: 'string', pattern: ISO_UTC.source, nullable: true } } },

    // fields_map (end-of-shift-portal/Config.gs CR.* unless noted): driver_person_id<-CR.DRIVER_EMAIL
    // fldfOXb1P3UZScH9w (CR.DRIVER_NAME fldZi1a4C9bL2cvg9 is the display link), auditor_person_id<-
    // CR.AUDITOR fldZKRDxweJITKDnN, region=CR.REGION_WORKED fldkEhOQ5yNUg0npK, shift_date=
    // CR.DATE_OF_SHIFT fldBem9NkJfLJWHgH, created_at=CR.CREATED fldebOBsMy4X9RWdP, status=
    // CR.RESOLUTION_STATUS fldsnoBaWWo6BeueH, severity=CR.SEVERITY fldku9FgQ6HqXV0AN, eos_incident_id=
    // CR.EOS_INCIDENT_ID fldGZJakZHYPZQZwI, response_deadline=CR.RESPONSE_DEADLINE fldRhMHrrukQdTWXH,
    // driver_response=CR.DRIVER_RESPONSE fldwLRMH0H3as8Rdu, driver_response_at=CR.DRIVER_RESPONSE_AT
    // fld0puq2MXKWB8kdh, manager_decision_by=CR.MANAGER_DECISION_BY fldT3xADLGcgSIg34, manager_decision_at=
    // CR.MANAGER_DECISION_AT fldi5y0biQEAbv7Hl, lp_disposition=CR.LP_DISPOSITION fldJ5ElOU3QG9vGPl,
    // lp_disposition_by=CR.LP_DISPOSITION_BY fldaINFvtHUSLNjUa, lp_disposition_at=CR.LP_DISPOSITION_AT
    // fldX5iQAPMiuU1D98, lp_owner=CR.LP_OWNER fldiF4M0H2EbzufMv, pattern_flag=CR.PATTERN_FLAG
    // fldCEnJTsVGGSv5Mk, amount_recovered=CR.AMOUNT_RECOVERED flduPfq825jtdglad, final_loss=CR.FINAL_LOSS
    // fldPCId7lgG5pzZzg. mode has no single CR field id in Config.gs (Mode is handled ad hoc in
    // RetailEngine.gs vs the delivery path) -- gap flagged in the team report; empty means 'delivery' per
    // LP-AIRTABLE-SCHEMA.md §1. cash.expected.amount<-CR.EXPECTED_CASH_VALUE fldVSaks2FL3xXkxG (blank
    // means unknown, NEVER coerce to 0 -- LP-AIRTABLE-SCHEMA.md "Rules the fields encode"),
    // cash.counted_total=CR.CLOSER_COUNTED_TOTAL fldwpTBs2O5RAxJv6, cash.cash_total_calc=
    // CR.CASH_TOTAL_CALC fldSIhAkfT3G5KdSN, cash.over_under=CR.CASH_DISC_OVER_UNDER fldP8A1OUJnSwkQ1J,
    // cards.blaze_total<-CR.CC_SALES_TOTAL fldvnHDkZl3wQ4wMI, cards.lp_count=CR.LP_CARD_COUNT
    // fldue8ly9ReKdJ8y1, cards.lp_total=CR.LP_CARD_TOTAL fldx9O9JxaUDLtcIO, cards.lp_status=
    // CR.LP_VS_BLAZE_STATUS fldCdiC0FwVYvRzcP, cards.lp_audited=CR.LP_AUDITED fldKzfPLud42t17vt,
    // discrepancy.type=CR.DISCREPANCY_TYPE fldMWQmVAeTncnce0, discrepancy.payment_discrepancy=
    // CR.PAYMENT_DISCREPANCY fldpgov6pQU0Ub62r.
    CloserReport: { type: 'object', required: ['source_ref', 'entity_id', 'mode', 'shift_date', 'status'], additionalProperties: false,
      properties: {
        source_ref: { $ref: 'AirtableSourceRef' }, entity_id: { type: 'string' }, store_id: { type: 'string', nullable: true },
        mode: { type: 'string', $enum: 'CloserReportMode' }, driver_person_id: { type: 'string', nullable: true },
        auditor_person_id: { type: 'string', nullable: true }, region: { type: 'string', nullable: true }, register: { type: 'string', nullable: true },
        shift_date: { type: 'string', pattern: BARE_DATE.source }, created_at: { type: 'string', pattern: ISO_UTC.source, nullable: true },
        cash: { type: 'object', nullable: true, additionalProperties: false,
          properties: {
            expected: { type: 'object', nullable: true, additionalProperties: false,
              properties: { amount: { $ref: 'Money', nullable: true }, source: { type: 'string', $enum: 'CashExpectedSource', nullable: true } } },
            counted_total: { $ref: 'Money', nullable: true }, cash_total_calc: { $ref: 'Money', nullable: true },
            float_amount: { $ref: 'Money', nullable: true }, safe_drop_amount: { $ref: 'Money', nullable: true },
            cash_dropped: { $ref: 'Money', nullable: true }, deposit_variance: { $ref: 'Money', nullable: true },
            over_under: { type: 'string', $enum: 'CloserReportOverUnder', nullable: true } } },
        cards: { type: 'object', nullable: true, additionalProperties: false,
          properties: {
            blaze_count: { type: 'integer', nullable: true }, blaze_total: { $ref: 'Money', nullable: true },
            lp_count: { type: 'integer', nullable: true }, lp_total: { $ref: 'Money', nullable: true },
            lp_status: { type: 'string', $enum: 'LpBlazeStatus', nullable: true }, lp_audited: { type: 'boolean', nullable: true } } },
        discrepancy: { type: 'object', nullable: true, additionalProperties: false,
          properties: {
            has_discrepancy: { type: 'boolean', nullable: true }, type: { type: 'string', $enum: 'CloserReportDiscrepancyType', nullable: true },
            suspicious_bills: { type: 'boolean', nullable: true }, damaged_inventory: { type: 'boolean', nullable: true },
            missing_accessories: { type: 'boolean', nullable: true }, broken_hardware: { type: 'boolean', nullable: true },
            payment_discrepancy: { type: 'boolean', nullable: true } } },
        severity: { type: 'string', $enum: 'Severity', nullable: true }, status: { type: 'string', $enum: 'CloserReportResolutionStatus' },
        eos_incident_id: { type: 'string', nullable: true }, response_deadline: { type: 'string', pattern: ISO_UTC.source, nullable: true },
        driver_response: { type: 'string', nullable: true }, driver_response_at: { type: 'string', pattern: ISO_UTC.source, nullable: true },
        manager_decision: { type: 'string', $enum: 'ManagerDecision', nullable: true }, manager_decision_by: { type: 'string', nullable: true },
        manager_decision_at: { type: 'string', pattern: ISO_UTC.source, nullable: true }, lp_disposition: { type: 'string', $enum: 'LpDisposition', nullable: true },
        lp_disposition_by: { type: 'string', nullable: true }, lp_disposition_at: { type: 'string', pattern: ISO_UTC.source, nullable: true },
        lp_owner: { type: 'string', nullable: true }, amount_recovered: { $ref: 'Money', nullable: true }, final_loss: { $ref: 'Money', nullable: true },
        pattern_flag: { type: 'boolean', nullable: true } } },

    // Derived read shape, not a distinct Airtable table: one row per Closer Report whose Final Loss is
    // populated (end-of-shift-portal/LossLedger.gs:9-15 SCOPE [LOCKED] -- ANY report with FINAL_LOSS set,
    // not just True Loss). fields_map: final_loss=CR.FINAL_LOSS fldPCId7lgG5pzZzg, amount_recovered=
    // CR.AMOUNT_RECOVERED flduPfq825jtdglad, net_loss computed = max(0, final_loss - amount_recovered)
    // (LossLedger.gs:9-10 NET LOSS DEFINITION [LOCKED]), shift_date<-CR.DATE_OF_SHIFT fldBem9NkJfLJWHgH via
    // lossShiftDay_ (LossLedger.gs:83-98), person_id<-CR.DRIVER_EMAIL fldfOXb1P3UZScH9w, disposition=
    // CR.LP_DISPOSITION fldJ5ElOU3QG9vGPl. reason_code reuses CloserReportDiscrepancyType
    // (CR.DISCREPANCY_TYPE fldMWQmVAeTncnce0) rather than a new enum -- there is no separate ledger-only
    // reason code in Airtable; the ledger inherits the source report's Discrepancy Type. window/high_risk
    // are the cached rollup (LossLedger.gs:104-133 computeLossRollups_/lossChipData_, 45 min CacheService
    // TTL) -- present only on rollup responses, not on a single ledger-entry read.
    LossLedgerEntry: { type: 'object',
      required: ['source_ref', 'entity_id', 'person_id', 'shift_date', 'final_loss', 'amount_recovered', 'net_loss'],
      additionalProperties: false,
      properties: {
        source_ref: { $ref: 'AirtableSourceRef' }, entity_id: { type: 'string' }, person_id: { type: 'string' },
        store_id: { type: 'string', nullable: true }, closer_report_id: { type: 'string', nullable: true },
        shift_date: { type: 'string', pattern: BARE_DATE.source }, final_loss: { $ref: 'Money' }, amount_recovered: { $ref: 'Money' },
        net_loss: { $ref: 'Money' }, reason_code: { type: 'string', $enum: 'CloserReportDiscrepancyType', nullable: true },
        disposition: { type: 'string', $enum: 'LpDisposition', nullable: true },
        window: { type: 'object', nullable: true, additionalProperties: false,
          properties: { lifetime: { $ref: 'Money', nullable: true }, mtd: { $ref: 'Money', nullable: true }, ytd: { $ref: 'Money', nullable: true } } },
        high_risk: { type: 'boolean', nullable: true }, recorded_at: { type: 'string', pattern: ISO_UTC.source, nullable: true } } },
  };

  function typeOf(v) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    return typeof v;
  }
  function validate(schemaName, value) {
    var errors = [];
    var schema = typeof schemaName === 'string' ? SCHEMAS[schemaName] : schemaName;
    if (!schema) return { ok: false, errors: ['unknown schema ' + schemaName] };
    walk(schema, value, '$', errors, 0);
    return { ok: errors.length === 0, errors: errors };
  }
  function walk(s, v, path, errors, depth) {
    if (depth > 32) { errors.push(path + ': too deep'); return; }
    if (s.$ref) { var t = SCHEMAS[s.$ref]; if (!t) { errors.push(path + ': unknown $ref ' + s.$ref); return; }
      if (v === null && s.nullable) return; return walk(t, v, path, errors, depth + 1); }
    if (v === null || v === undefined) {
      if (s.nullable || !s.type) return;
      errors.push(path + ': expected ' + s.type + ', got ' + (v === null ? 'null' : 'undefined')); return;
    }
    if (s.type) {
      var actual = typeOf(v);
      var want = s.type === 'integer' ? 'number' : s.type;
      if (actual !== want || (want === 'number' && !isFinite(v)) || (s.type === 'integer' && Math.floor(v) !== v)) { errors.push(path + ': expected ' + s.type + ', got ' + actual); return; }
    }
    if (s.$enum && !isEnum(s.$enum, v)) errors.push(path + ': ' + JSON.stringify(v) + ' is not a ' + s.$enum);
    if (s.enum && s.enum.indexOf(v) === -1) errors.push(path + ': ' + JSON.stringify(v) + ' not in enum');
    if (s.pattern && typeof v === 'string' && !new RegExp(s.pattern).test(v)) errors.push(path + ': ' + JSON.stringify(v) + ' does not match ' + s.pattern);
    if (s.minLength !== undefined && typeof v === 'string' && v.length < s.minLength) errors.push(path + ': shorter than ' + s.minLength);
    if (s.minimum !== undefined && typeof v === 'number' && v < s.minimum) errors.push(path + ': below minimum ' + s.minimum);
    if (s.maximum !== undefined && typeof v === 'number' && v > s.maximum) errors.push(path + ': above maximum ' + s.maximum);
    if (s.type === 'object') {
      var req = s.required || [];
      for (var i = 0; i < req.length; i++) if (!(req[i] in v)) errors.push(path + ': missing required ' + req[i]);
      var props = s.properties || {};
      for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) {
        if (Object.prototype.hasOwnProperty.call(props, k)) walk(props[k], v[k], path + '.' + k, errors, depth + 1);
        else if (s.additionalProperties === false) errors.push(path + ': unexpected property ' + k);
      }
    }
    if (s.type === 'array' && s.items) for (var j = 0; j < v.length; j++) walk(s.items, v[j], path + '[' + j + ']', errors, depth + 1);
  }

  // ── validatePromotionRule ────────────────────────────────────────────────
  // 1) $: JSON.stringify(rule).length <= RULE_LIMITS.max_bytes, checked before validate() or
  //    any recursion -- see the RULE_LIMITS comment above for why.
  // 2) validate('PromotionRule', rule) -- shape, enums, additionalProperties:false.
  // 3) walk rule.if enforcing what the schema subset cannot express: exactly one of
  //    {field,op,value} / {all,any,not} per node, nesting depth <= RULE_LIMITS.max_depth,
  //    total NODES (groups and conditions both) <= max_nodes, each all/any/not array
  //    <= max_group_items, op allowed for the field's RULE_FIELD_TYPE, the value's JS type
  //    matches that type, in/not_in/between array and string-length limits.
  // 4) then.value against then.kind's business rule (RULE-SHAPE.md §1).
  function _valueMatchesFieldType(fieldType, v) {
    if (fieldType === 'number') return typeof v === 'number' && isFinite(v);
    if (fieldType === 'string' || fieldType === 'enum') return typeof v === 'string';
    if (fieldType === 'date') return isIsoUtc(v);
    return false;
  }
  function _checkStringLen(v, path, errors) {
    if (typeof v === 'string' && v.length > RULE_LIMITS.max_string) errors.push(path + ': longer than ' + RULE_LIMITS.max_string + ' chars');
  }
  function _checkConditionValue(node, fieldType, path, errors) {
    var op = node.op, value = node.value;
    if (op === 'in' || op === 'not_in') {
      if (!Array.isArray(value)) { errors.push(path + '.value: expected an array for ' + op); return; }
      if (value.length > RULE_LIMITS.max_list) errors.push(path + '.value: list longer than ' + RULE_LIMITS.max_list);
      for (var i = 0; i < value.length; i++) {
        if (!_valueMatchesFieldType(fieldType, value[i])) errors.push(path + '.value[' + i + ']: does not match type ' + fieldType);
        _checkStringLen(value[i], path + '.value[' + i + ']', errors);
      }
      return;
    }
    if (op === 'between') {
      if (!Array.isArray(value) || value.length !== 2) { errors.push(path + '.value: expected a 2-item array for between'); return; }
      for (var k = 0; k < 2; k++) if (!_valueMatchesFieldType(fieldType, value[k])) errors.push(path + '.value[' + k + ']: does not match type ' + fieldType);
      return;
    }
    if (op === 'older_than_days' || op === 'newer_than_days') {
      if (typeof value !== 'number' || !isFinite(value) || value < 0) errors.push(path + '.value: expected a non-negative number of days for ' + op);
      return;
    }
    // eq, neq, gt, gte, lt, lte, before, after
    if (!_valueMatchesFieldType(fieldType, value)) { errors.push(path + '.value: does not match type ' + fieldType); return; }
    _checkStringLen(value, path + '.value', errors);
  }
  // Digits after the decimal point, read off the number's decimal STRING form (not inferred from
  // floating-point error) -- 12.345 is 3 places, 12.3 is 1, 12 is 0. A number so large or small
  // that String() switches to exponential notation can never be a clean <=2dp percent, so that's
  // treated as "too many" rather than parsed.
  function _decimalPlaces(n) {
    var s = String(n);
    if (s.indexOf('e') !== -1 || s.indexOf('E') !== -1) return Infinity;
    var i = s.indexOf('.');
    return i === -1 ? 0 : s.length - i - 1;
  }
  function _isIntegerAtLeast(v, min) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v && v >= min; }
  // then.value's shape depends on then.kind, and the schema's `value: {}` is deliberately
  // typeless (RULE-SHAPE.md §1/§3 -- no oneOf in the subset), so the per-kind business rule lives
  // only here. cap_cents/max_per_order don't depend on kind, so they're `minimum` in the schema
  // itself (SCHEMAS.PromotionRule.then) and are not re-checked below.
  function _checkThenValue(then, errors) {
    if (!then || typeof then !== 'object') return;
    var kind = then.kind, value = then.value, path = '$.then.value';
    if (kind === 'percent') {
      if (typeof value !== 'number' || !isFinite(value) || !(value > 0) || value > 100) {
        errors.push(path + ': percent must be a number > 0 and <= 100, got ' + JSON.stringify(value));
      } else if (_decimalPlaces(value) > 2) {
        errors.push(path + ': percent must have at most 2 decimal places, got ' + JSON.stringify(value));
      }
    } else if (kind === 'amount' || kind === 'price') {
      if (!_isIntegerAtLeast(value, 1)) errors.push(path + ': ' + kind + ' must be an integer number of cents >= 1, got ' + JSON.stringify(value));
    } else if (kind === 'points') {
      if (!_isIntegerAtLeast(value, 1)) errors.push(path + ': points must be an integer >= 1, got ' + JSON.stringify(value));
    } else if (kind === 'bogo') {
      if (!_isIntegerAtLeast(value, 1)) errors.push(path + ': bogo free quantity must be an integer >= 1, got ' + JSON.stringify(value));
    } else if (kind === 'gift') {
      if (typeof value !== 'string' || value.length < 1 || value.length > RULE_LIMITS.max_string) {
        errors.push(path + ': gift must be a non-empty sku string <= ' + RULE_LIMITS.max_string + ' chars, got ' + JSON.stringify(value));
      }
    }
  }
  function validatePromotionRule(rule) {
    // Checked FIRST, before validate() or any recursion: JSON.stringify's length is O(n) and
    // not recursive the way the tree walk below is -- a rule this big is rejected without ever
    // walking it. See the RULE_LIMITS comment for the 29 MB payload this closes.
    var size;
    try { size = JSON.stringify(rule).length; } catch (e) { size = Infinity; }
    if (size > RULE_LIMITS.max_bytes) return { ok: false, errors: ['$: serialized rule is ' + size + ' bytes, exceeds RULE_LIMITS.max_bytes ' + RULE_LIMITS.max_bytes] };
    var base = validate('PromotionRule', rule);
    if (!base.ok) return base;
    var errors = [];
    var nodeCount = 0;
    var nodeLimitHit = false;
    function walkNode(node, path, depth) {
      if (nodeLimitHit) return;
      // Every node counts toward max_nodes -- groups AND conditions. Previously this only
      // incremented inside the condition branch below, so a tree of nothing but groups (no
      // leaf conditions at all) was uncounted no matter how many siblings it had.
      nodeCount++;
      if (nodeCount > RULE_LIMITS.max_nodes) { errors.push('$.if: more than ' + RULE_LIMITS.max_nodes + ' nodes (groups and conditions counted together)'); nodeLimitHit = true; return; }
      if (depth > RULE_LIMITS.max_depth) { errors.push(path + ': nesting depth ' + depth + ' exceeds ' + RULE_LIMITS.max_depth); return; }
      var hasCond = node && (node.field !== undefined || node.op !== undefined || node.value !== undefined);
      var hasGroup = node && (node.all !== undefined || node.any !== undefined || node.not !== undefined);
      if (hasCond && hasGroup) { errors.push(path + ': node has both the condition form and the group form'); return; }
      if (!hasCond && !hasGroup) { errors.push(path + ': node has neither the condition form nor the group form'); return; }
      if (hasCond) {
        if (node.field === undefined || node.op === undefined || node.value === undefined) { errors.push(path + ': condition missing field, op or value'); return; }
        var fieldType = RULE_FIELD_TYPE[node.field];
        var allowedOps = RULE_OPS_BY_TYPE[fieldType] || [];
        if (allowedOps.indexOf(node.op) === -1) { errors.push(path + '.op: ' + JSON.stringify(node.op) + ' is not allowed for ' + node.field + ' (' + fieldType + ')'); return; }
        _checkConditionValue(node, fieldType, path, errors);
        return;
      }
      ['all', 'any', 'not'].forEach(function (k) {
        if (nodeLimitHit) return;
        var arr = node[k] || [];
        if (!Array.isArray(arr)) return;
        // Capped BEFORE recursing: an oversized array is rejected as one check, never by
        // walking however many siblings an attacker put there.
        if (arr.length > RULE_LIMITS.max_group_items) { errors.push(path + '.' + k + ': ' + arr.length + ' items exceeds RULE_LIMITS.max_group_items ' + RULE_LIMITS.max_group_items); return; }
        for (var i = 0; i < arr.length; i++) walkNode(arr[i], path + '.' + k + '[' + i + ']', depth + 1);
      });
    }
    walkNode(rule['if'], '$.if', 1);
    _checkStringLen(rule.name, '$.name', errors);
    if (rule.meta) _checkStringLen(rule.meta.prompt, '$.meta.prompt', errors);
    _checkThenValue(rule.then, errors);
    return { ok: errors.length === 0, errors: errors };
  }

  return {
    VERSION: VERSION, HEADER: HEADER, ENUMS: ENUMS, HTTP_STATUS: HTTP_STATUS, SCHEMAS: SCHEMAS,
    enumValues: enumValues, isEnum: isEnum, roleFrom: roleFrom, roleAtLeast: roleAtLeast, ROLE_MAP: ROLE_MAP,
    isObjectId: isObjectId, isUuidHex: isUuidHex, isSlug: isSlug, externalId: externalId,
    formatExternalId: formatExternalId, parseExternalId: parseExternalId,
    isCents: isCents, assertCents: assertCents, centsFromDollars: centsFromDollars, dollarsFromCents: dollarsFromCents, money: money,
    isIsoUtc: isIsoUtc, isBareDate: isBareDate, isoNow: isoNow, isoFromEpoch: isoFromEpoch, epochMsFromIso: epochMsFromIso, toIso: toIso,
    error: error, httpStatus: httpStatus, errorFromLegacy: errorFromLegacy,
    event: event, canonicalJson: canonicalJson, signingPreimage: signingPreimage, randomHex: randomHex,
    validate: validate,
    RULE_FIELD_TYPE: RULE_FIELD_TYPE, RULE_LIMITS: RULE_LIMITS, RULE_OPS_BY_TYPE: RULE_OPS_BY_TYPE,
    validatePromotionRule: validatePromotionRule,
    PII_CLASS: PII_CLASS,
  };
});
