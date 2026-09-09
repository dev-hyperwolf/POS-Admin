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

  var VERSION = '0.2.3'; // 0.2.0: additive enums (MODULE-CONTRACT-GAPS.md §2); 0.2.1 PersonStatus; 0.2.2 LiveFeedStatus; 0.2.3 AtHomeVisitStatus, GeniusShiftStatus
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
    PointsKind: { values: ['earned', 'adjusted', 'recorded_paid', 'redeemed'],
      source: 'wm-demo/wmdemo/incentives/rewards.py KINDS + redeemed (Rewards service, plan §3)' },
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
      'IP_TOR', 'INJECTION_DETECTED', 'CHALLENGE_NONCE_MISMATCH', 'LIVENESS_ATTEMPTS_EXHAUSTED_HARD'],
      source: 'docs/IDV-API-CONTRACT.md Reason (review + decline sets)' },
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
    IdSource: { values: ['blaze', 'meadow', 'treez', 'weedmaps', 'didit', 'hwpos', 'connecteam', 'airtable', 'hyperwolf', 'metrc', 'onfleet'],
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
    PersonStatus: { values: ['unverified', 'active', 'blocked', 'deleted', 'flagged'],
      source: 'wm-demo idv_people.status (Verify); `flagged` is legacy from the Didit import, accepted on read only, never written by our code' },
    ErrorCode: { values: ['bad_request', 'unauthorized', 'forbidden', 'not_found', 'conflict',
      'unprocessable', 'rate_limited', 'internal', 'not_built'],
      source: 'CANONICAL-DATA-MODEL.md §7.6' },
    EventType: { values: ['order.created', 'order.completed', 'order.refunded', 'order.cancelled', 'task.status_changed',
      'verification.decided', 'points.earned', 'points.redeemed', 'promotion.consumed', 'person.merged'],
      source: 'CANONICAL-DATA-MODEL.md §7.7' },
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
  // name via $enum), pattern, minimum, nullable, $ref to another schema. Enough to fail on
  // drift, small enough to run in a browser and to re-implement in 120 lines of Python.
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
        usage_limit: { type: 'integer', nullable: true }, stackable: { type: 'boolean' } } },
    Error: { type: 'object', required: ['error'], additionalProperties: false,
      properties: { error: { type: 'object', required: ['code', 'message'], additionalProperties: false,
        properties: { code: { type: 'string', $enum: 'ErrorCode' }, message: { type: 'string' }, details: { nullable: true } } } } },
    Event: { type: 'object', required: ['event_id', 'type', 'contract', 'at', 'source', 'data'], additionalProperties: false,
      properties: { event_id: ID, type: { type: 'string', $enum: 'EventType' }, contract: { type: 'string' }, at: ISO, source: { type: 'string' }, data: { type: 'object' } } },
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
  };
});
