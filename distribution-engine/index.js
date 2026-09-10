/* @hyper-tech/distribution-engine — the decisions, not the storage.
 *
 * Pure functions only: every export here takes plain data in (Location[], Batch[],
 * ReceivedItem[], sales as {product_id, batch_id?, quantity, channel, at, location_id})
 * and returns plain data out (a Plan, shaped exactly like contracts/index.js SCHEMAS.Plan).
 * No database, no HTTP, no console output, no persistence, no Blaze-shaped object anywhere
 * in this file. See README.md for the rules this file encodes and the ones it does not.
 */

const VERSION = '0.1.0';
const DEFAULT_TZ = 'America/Los_Angeles';

// ── time ─────────────────────────────────────────────────────────────────────

/** ISO-8601 UTC "now", to the second (matches contracts/index.js isoNow's shape). */
function isoNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function toDate(ts) {
  const d = ts instanceof Date ? ts : new Date(ts);
  if (isNaN(d.getTime())) throw new TypeError(`not a valid time: ${JSON.stringify(ts)}`);
  return d;
}

/**
 * businessDay(ts, tz) → 'YYYY-MM-DD' in the given IANA timezone (default Pacific).
 * One clock, used by every plan function below, so build/refill/restock/closure can never
 * disagree about what day it is — including across a DST transition, which the timezone
 * database (not a fixed offset) handles correctly.
 */
function businessDay(ts, tz = DEFAULT_TZ) {
  const d = toDate(ts);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Start of a business day (00:00:00 local, expressed as an ISO instant), for "since last
 *  refill" windows when no explicit checkpoint is supplied. */
function businessDayStart(businessDayStr, tz = DEFAULT_TZ) {
  // Binary-search-free approach: walk from UTC midnight of that calendar date backward/forward
  // a few hours until businessDay(candidate, tz) matches. Timezones are at most 14h from UTC,
  // so a 27-hour window from noon-UTC-the-day-before is always enough.
  const base = new Date(`${businessDayStr}T12:00:00Z`);
  for (let h = 0; h <= 36; h++) {
    const candidate = new Date(base.getTime() - h * 3600 * 1000);
    if (businessDay(candidate, tz) === businessDayStr) {
      // walk back further while still the same business day, in 15-minute steps, to find the
      // earliest instant — good enough precision for a "since start of day" filter.
      let earliest = candidate;
      for (let m = 15; m <= 36 * 60; m += 15) {
        const c2 = new Date(candidate.getTime() - m * 60 * 1000);
        if (businessDay(c2, tz) === businessDayStr) earliest = c2;
        else break;
      }
      return earliest.toISOString().replace(/\.\d{3}Z$/, 'Z');
    }
  }
  throw new Error(`businessDayStart: could not resolve ${businessDayStr} in ${tz}`);
}

// ── rotation (FEFO) ──────────────────────────────────────────────────────────

function fefoCompare(a, b) {
  const ax = a.expires_at ? Date.parse(a.expires_at) : Infinity;
  const bx = b.expires_at ? Date.parse(b.expires_at) : Infinity;
  if (ax !== bx) return ax - bx;
  const ar = a.received_at ? Date.parse(a.received_at) : Infinity;
  const br = b.received_at ? Date.parse(b.received_at) : Infinity;
  if (ar !== br) return ar - br;
  const an = String(a.batch_no ?? '');
  const bn = String(b.batch_no ?? '');
  if (an !== bn) return an < bn ? -1 : 1;
  return String(a.id).localeCompare(String(b.id));
}

/**
 * rotation(batches) → { ordered, allocate(qty) }
 * `ordered` is FEFO: expires_at ascending (no-expiry batches last), received_at as the
 * tie-break, so "oldest batch first" is one sort, reused everywhere allocation happens.
 * `allocate(qty)` walks `ordered` taking whole batches before opening the next one and
 * reports whether more than one batch was needed — the mixed-batch detector every planner
 * below is built on. Never mutates the input batches.
 */
function rotation(batches) {
  const ordered = [...batches].sort(fefoCompare);
  function allocate(qty) {
    let remaining = qty;
    const allocations = [];
    for (const b of ordered) {
      if (remaining <= 0) break;
      const have = b.quantity || 0;
      if (have <= 0) continue;
      const take = Math.min(have, remaining);
      if (take > 0) {
        allocations.push({ batch_id: b.id, batch: b, quantity: take });
        remaining -= take;
      }
    }
    return { allocations, filled: qty - remaining, remaining, mixed_batch: allocations.length > 1 };
  }
  return { ordered, allocate };
}

// ── shared allocation core ───────────────────────────────────────────────────

function batchDetailText(batch) {
  if (!batch) return 'batch unknown';
  const bits = [`Batch ${batch.batch_no ?? batch.id}`];
  if (batch.thc_pct != null) bits.push(`THC ${batch.thc_pct}%`);
  if (batch.packaged_at) bits.push(`packaged ${String(batch.packaged_at).slice(0, 10)}`);
  return bits.join(', ');
}

function mixedBatchNote(batchIds, batchLookup) {
  const uniq = [...new Set(batchIds)];
  return `MIXED BATCH — ${uniq.map((id) => batchDetailText(batchLookup.get(id))).join(' + ')}`;
}

/**
 * The one allocator every plan function below calls. Given a product's need at each
 * candidate destination and a shared stock pool for that product, it:
 *   - sorts destinations by need (highest first) so scarce stock covers the biggest gaps first
 *     and, per the owner, a product is never withheld from every destination just because it
 *     can't cover all of them (rule 5 — partial placement, never dropped entirely);
 *   - allocates oldest-batch-first per destination (rule 4), splitting across batches only
 *     when one batch can't cover the need, and flagging every such line `mixed_batch: true`
 *     with both batches named (rule 3/4 — loud, never silent);
 *   - also flags mixed_batch when a destination's own already-on-hand batch differs from the
 *     batch(es) just allocated, even if the allocation itself only touched one batch — this is
 *     the "new batch placed beside the old one" case from OWNER-NOTES 2026-09-10.
 * Returns { lines, skipped } in PlanLine shape (contracts 0.4.0).
 */
function allocateAcrossDestinations({
  product_id, entries, batchLookup, poolBatches, baseReasons, soldByDestination, fromLocationId,
}) {
  const pool = poolBatches.map((b) => ({ ...b })); // local mutable copy of remaining quantity
  const totalAvailable = pool.reduce((s, b) => s + (b.quantity || 0), 0);
  const totalNeed = entries.reduce((s, e) => s + Math.max(0, e.need), 0);
  const candidates = entries.filter((e) => e.need > 0);
  const scarce = totalAvailable < totalNeed;
  const belowDestinationCount = totalAvailable > 0 && totalAvailable < candidates.length;

  const sorted = [...candidates].sort(
    (a, b) => b.need - a.need || String(a.destination.id).localeCompare(String(b.destination.id)),
  );

  const lines = [];
  const skipped = [];

  for (const entry of sorted) {
    const { destination, need } = entry;
    const cap = entry.cap == null ? need : entry.cap;
    const target = Math.min(need, cap);
    const rot = rotation(pool.filter((b) => (b.quantity || 0) > 0));
    const alloc = rot.allocate(target);
    for (const a of alloc.allocations) {
      const b = pool.find((x) => x.id === a.batch_id);
      b.quantity -= a.quantity;
    }
    const sold = soldByDestination ? soldByDestination.get(destination.id) || 0 : 0;
    const existingForProduct = new Set(
      (destination.existing_batches && destination.existing_batches[product_id]) || [],
    );
    const allocatedIds = alloc.allocations.map((a) => a.batch_id);
    const besideExisting = existingForProduct.size > 0
      && allocatedIds.some((id) => !existingForProduct.has(id));
    const mixedBatch = alloc.mixed_batch || besideExisting;
    const involvedIds = mixedBatch
      ? [...new Set([...allocatedIds, ...(besideExisting ? existingForProduct : [])])]
      : allocatedIds;
    const note = mixedBatch ? mixedBatchNote(involvedIds, batchLookup) : undefined;

    if (alloc.filled <= 0 && target > 0) {
      const reasons = [...baseReasons, 'short_stock'];
      if (cap < need) reasons.push('capped');
      if (scarce && totalAvailable > 0) reasons.push('partial_placement');
      if (belowDestinationCount) reasons.push('below_subregion_count');
      skipped.push({
        product_id,
        batch_id: pool[0] ? pool[0].id : 'none',
        from_location_id: fromLocationId,
        to_location_id: destination.id,
        sold, need, cap, give: 0,
        reasons,
      });
      continue;
    }

    for (const a of alloc.allocations) {
      const reasons = [...baseReasons];
      if (mixedBatch) reasons.push('mixed_batch');
      if (cap < need) reasons.push('capped');
      if (alloc.filled < target) reasons.push('partial_placement');
      if (belowDestinationCount) reasons.push('below_subregion_count');
      const line = {
        product_id,
        batch_id: a.batch_id,
        from_location_id: fromLocationId,
        to_location_id: destination.id,
        sold, need, cap, give: a.quantity,
        reasons,
        mixed_batch: mixedBatch,
      };
      if (note) line.note = note;
      lines.push(line);
    }
  }

  return { lines, skipped };
}

function indexBatchesByProduct(batches) {
  const byProduct = new Map();
  for (const b of batches) {
    if (!byProduct.has(b.product_id)) byProduct.set(b.product_id, []);
    byProduct.get(b.product_id).push(b);
  }
  return byProduct;
}

function makePlanId(kind, scope, businessDayStr) {
  return `${kind}:${scope}:${businessDayStr}`;
}

// ── sales helpers ─────────────────────────────────────────────────────────────

function sumSales(sales, { product_id, location_id, channels, sinceIso, untilIso }) {
  const sinceMs = sinceIso ? Date.parse(sinceIso) : -Infinity;
  const untilMs = untilIso ? Date.parse(untilIso) : Infinity;
  let total = 0;
  for (const s of sales) {
    if (s.product_id !== product_id) continue;
    if (location_id != null && s.location_id !== location_id) continue;
    if (channels && !channels.includes(s.channel)) continue;
    const t = Date.parse(s.at);
    if (t < sinceMs || t > untilMs) continue;
    total += s.quantity;
  }
  return total;
}

/**
 * returnBaseline(sales, {product_id, location_id, sinceIso, untilIso}) — the OTHER demand
 * stream (rule 1): everything that left with the driver, ASAP and scheduled alike, because
 * both must be accounted for at return even though only ASAP drives the refill itself. Not a
 * plan — a number, for whatever return-verify/loss-prevention step consumes it.
 */
function returnBaseline(sales, { product_id, location_id, sinceIso, untilIso } = {}) {
  return sumSales(sales, {
    product_id, location_id, channels: ['asap', 'scheduled'], sinceIso, untilIso,
  });
}

function distinctProductIds(...lists) {
  const set = new Set();
  for (const list of lists) for (const item of list) if (item.product_id) set.add(item.product_id);
  return [...set];
}

// ── planBuild ─────────────────────────────────────────────────────────────────

/**
 * planBuild(input) — the weekly/initial kit build. Need is the template's target quantity
 * (max) at every destination, never a function of what happened last time (rule 2). Filled
 * oldest-batch-first from a shared stock pool per product, with partial placement under
 * scarcity (rule 5) and a loud mixed-batch flag whenever one destination's line has to span
 * two batches (rule 3/4).
 *
 * input: {
 *   business_day?, generated_at?, channel?, from_location_id?,
 *   destinations: [{ id, name?, template: [{product_id, min, max}], existing_batches? }],
 *   batches: Batch[],   // the source pool the build draws from (e.g. the safe/warehouse)
 * }
 */
function planBuild(input) {
  const generated_at = input.generated_at || isoNow();
  const business_day = input.business_day || businessDay(generated_at);
  const channel = input.channel || 'asap';
  const destinations = input.destinations || [];
  const batchLookup = new Map(input.batches.map((b) => [b.id, b]));
  const byProduct = indexBatchesByProduct(input.batches);

  const productIds = distinctProductIds(...destinations.map((d) => d.template || []));
  const lines = [];
  const skipped = [];

  for (const product_id of productIds) {
    const entries = destinations
      .filter((d) => (d.template || []).some((t) => t.product_id === product_id))
      .map((d) => {
        const tmpl = d.template.find((t) => t.product_id === product_id);
        return { destination: d, need: tmpl.max, cap: tmpl.max };
      });
    const { lines: l, skipped: s } = allocateAcrossDestinations({
      product_id,
      entries,
      batchLookup,
      poolBatches: byProduct.get(product_id) || [],
      baseReasons: ['capped', 'oldest_first'],
      fromLocationId: input.from_location_id,
    });
    lines.push(...l);
    skipped.push(...s);
  }

  return {
    id: makePlanId('build', input.scope || 'all', business_day),
    kind: 'build',
    business_day,
    generated_at,
    channel,
    lines,
    skipped,
    warnings: [],
  };
}

// ── planRefill ────────────────────────────────────────────────────────────────

/**
 * planRefill(input) — the daily kit top-off. Two things happen, kept as separate reason
 * groups on the returned lines:
 *   1. Demand pass — need = ASAP sales at that kit since the last refill checkpoint only
 *      (rule 1: scheduled orders are fulfilled from the safe, never counted here). Cap comes
 *      from the template max, or the destination's originally distributed quantity if no
 *      template entry exists — never from what a prior refill happened to hand out (rule 2:
 *      that ratchet is the bug this engine specifically does not reproduce).
 *   2. Arrivals pass — every ReceivedItem of the day (new_sku, restock, new_batch) that
 *      belongs in a destination's template is pushed too, even with zero sales-driven need
 *      (rule 3), so a premium product received this morning ships this afternoon instead of
 *      queuing for a week. A new_batch arriving beside a batch the destination already has is
 *      flagged mixed_batch — loud, never silent.
 *
 * input: {
 *   business_day?, generated_at?, channel?, from_location_id?,
 *   destinations: [{ id, template, distributed?, last_checkpoint_at?, existing_batches? }],
 *   batches: Batch[],        // remaining stock pool available to refill from
 *   sales: Sale[],           // ASAP + scheduled; this function itself filters to ASAP
 *   received?: ReceivedItem[],
 *   onlyProductIds?: string[],  // partial refill (rule 9)
 * }
 */
function planRefill(input) {
  const generated_at = input.generated_at || isoNow();
  const business_day = input.business_day || businessDay(generated_at);
  const channel = input.channel || 'asap';
  const destinations = input.destinations || [];
  const sales = input.sales || [];
  const received = input.received || [];
  const batchLookup = new Map(input.batches.map((b) => [b.id, b]));
  const byProduct = indexBatchesByProduct(input.batches);
  const only = input.onlyProductIds ? new Set(input.onlyProductIds) : null;

  const lines = [];
  const skipped = [];

  // Pass 1 — demand-driven refill of products the kit already carries.
  const demandProductIds = distinctProductIds(...destinations.map((d) => d.template || []))
    .filter((pid) => !only || only.has(pid));

  for (const product_id of demandProductIds) {
    const dayStart = businessDayStart(business_day);
    const soldByDestination = new Map();
    const entries = [];
    for (const d of destinations) {
      const tmpl = (d.template || []).find((t) => t.product_id === product_id);
      if (!tmpl) continue;
      const since = d.last_checkpoint_at || dayStart;
      const sold = sumSales(sales, {
        product_id, location_id: d.id, channels: ['asap'], sinceIso: since, untilIso: generated_at,
      });
      soldByDestination.set(d.id, sold);
      if (sold <= 0) continue;
      const cap = tmpl ? tmpl.max : (d.distributed || []).find((x) => x.product_id === product_id)?.quantity;
      entries.push({ destination: d, need: sold, cap: cap == null ? sold : cap });
    }
    if (!entries.length) continue;
    const { lines: l, skipped: s } = allocateAcrossDestinations({
      product_id,
      entries,
      batchLookup,
      poolBatches: byProduct.get(product_id) || [],
      baseReasons: ['sold', 'oldest_first'],
      soldByDestination,
      fromLocationId: input.from_location_id,
    });
    lines.push(...l);
    skipped.push(...s);
  }

  // Pass 2 — every arrival of the day pushed into destinations whose template wants it.
  const arrivalsByProduct = new Map();
  for (const item of received) {
    if (only && !only.has(item.product_id)) continue;
    if (!arrivalsByProduct.has(item.product_id)) arrivalsByProduct.set(item.product_id, []);
    arrivalsByProduct.get(item.product_id).push(item);
  }

  for (const [product_id, items] of arrivalsByProduct) {
    const eligible = destinations.filter((d) => (d.template || []).some((t) => t.product_id === product_id));
    if (!eligible.length) {
      // Not in any destination's template at all — this is a receivedLedger-level fact
      // ("not_in_template"), not something this plan can place; recorded as a skip so the
      // 100%-certainty ledger has something to point at even before receivedLedger() runs.
      for (const item of items) {
        skipped.push({
          product_id,
          batch_id: item.batch_id,
          from_location_id: item.location_id,
          to_location_id: item.location_id || 'unassigned',
          sold: 0, need: 0, cap: 0, give: 0,
          reasons: ['not_in_template'],
        });
      }
      continue;
    }
    const entries = eligible.map((d) => {
      const tmpl = d.template.find((t) => t.product_id === product_id);
      return { destination: d, need: tmpl.max, cap: tmpl.max };
    });
    const { lines: l, skipped: s } = allocateAcrossDestinations({
      product_id,
      entries,
      batchLookup,
      poolBatches: byProduct.get(product_id) || [],
      baseReasons: ['new_arrival', 'oldest_first'],
      fromLocationId: input.from_location_id,
    });
    lines.push(...l);
    skipped.push(...s);
  }

  return {
    id: makePlanId('refill', input.scope || 'all', business_day),
    kind: 'refill',
    business_day,
    generated_at,
    channel,
    lines,
    skipped,
    warnings: [],
  };
}

// ── planRestock (floor) ───────────────────────────────────────────────────────

/**
 * planRestock(input) — the sales-floor restock (BOH → FOH). Same engine as planRefill's
 * demand pass, but need is driven by **register** sales, never ASAP/scheduled, because the
 * floor's channel is the register (rule: "floor restock counts register sales"). Accepts the
 * same optional `received` arrivals pass so a store gets the identical "new stock, flagged
 * immediately" behaviour as a delivery kit.
 *
 * input: {
 *   business_day?, generated_at?, from_location_id? (the store's safe/BOH),
 *   destinations: [{ id, template, last_checkpoint_at?, existing_batches? }],  // shelves
 *   batches: Batch[],   // BOH stock available to restock from
 *   sales: Sale[],      // register sales
 *   received?: ReceivedItem[],
 * }
 */
function planRestock(input) {
  const generated_at = input.generated_at || isoNow();
  const business_day = input.business_day || businessDay(generated_at);
  const destinations = input.destinations || [];
  const sales = input.sales || [];
  const received = input.received || [];
  const batchLookup = new Map(input.batches.map((b) => [b.id, b]));
  const byProduct = indexBatchesByProduct(input.batches);

  const lines = [];
  const skipped = [];

  const productIds = distinctProductIds(...destinations.map((d) => d.template || []));
  for (const product_id of productIds) {
    const dayStart = businessDayStart(business_day);
    const soldByDestination = new Map();
    const entries = [];
    for (const d of destinations) {
      const tmpl = (d.template || []).find((t) => t.product_id === product_id);
      if (!tmpl) continue;
      const since = d.last_checkpoint_at || dayStart;
      const sold = sumSales(sales, {
        product_id, location_id: d.id, channels: ['register'], sinceIso: since, untilIso: generated_at,
      });
      soldByDestination.set(d.id, sold);
      if (sold <= 0) continue;
      entries.push({ destination: d, need: sold, cap: tmpl.max });
    }
    if (!entries.length) continue;
    const { lines: l, skipped: s } = allocateAcrossDestinations({
      product_id,
      entries,
      batchLookup,
      poolBatches: byProduct.get(product_id) || [],
      baseReasons: ['sold', 'oldest_first'],
      soldByDestination,
      fromLocationId: input.from_location_id,
    });
    lines.push(...l);
    skipped.push(...s);
  }

  for (const item of received) {
    const eligible = destinations.filter((d) => (d.template || []).some((t) => t.product_id === item.product_id));
    if (!eligible.length) continue;
    const entries = eligible.map((d) => {
      const tmpl = d.template.find((t) => t.product_id === item.product_id);
      return { destination: d, need: tmpl.max, cap: tmpl.max };
    });
    const { lines: l, skipped: s } = allocateAcrossDestinations({
      product_id: item.product_id,
      entries,
      batchLookup,
      poolBatches: byProduct.get(item.product_id) || [],
      baseReasons: ['new_arrival', 'oldest_first'],
      fromLocationId: input.from_location_id,
    });
    lines.push(...l);
    skipped.push(...s);
  }

  return {
    id: makePlanId('restock', input.scope || 'all', business_day),
    kind: 'restock',
    business_day,
    generated_at,
    channel: 'register',
    store_id: input.store_id,
    lines,
    skipped,
    warnings: [],
  };
}

// ── planHandoff ───────────────────────────────────────────────────────────────

/**
 * planHandoff(fromKit, toKit, lines, opts?) — a mid-day kit-to-kit movement (rare, but the
 * function must exist: a driver goes out of service and a second driver or the 3:30pm wave
 * takes the region). `lines` is [{product_id, quantity, batch_id?}]. When a line already
 * names a batch it is trusted directly (a human picked it); when it doesn't, and `opts.batches`
 * is supplied, the same FEFO allocator used everywhere else splits it oldest-first and flags
 * mixed batches exactly like a refill would.
 */
function planHandoff(fromKit, toKit, lines, opts = {}) {
  const generated_at = opts.generated_at || isoNow();
  const business_day = opts.business_day || businessDay(generated_at);
  const batchLookup = new Map((opts.batches || []).map((b) => [b.id, b]));
  const byProduct = indexBatchesByProduct(opts.batches || []);
  const outLines = [];
  const skipped = [];

  for (const req of lines) {
    if (req.batch_id) {
      outLines.push({
        product_id: req.product_id,
        batch_id: req.batch_id,
        from_location_id: fromKit,
        to_location_id: toKit,
        sold: 0, need: req.quantity, cap: req.quantity, give: req.quantity,
        reasons: ['manual'],
        mixed_batch: false,
      });
      continue;
    }
    const pool = (byProduct.get(req.product_id) || []).filter((b) => !opts.batches
      || b.location_id == null || b.location_id === fromKit);
    const { lines: l, skipped: s } = allocateAcrossDestinations({
      product_id: req.product_id,
      entries: [{ destination: { id: toKit }, need: req.quantity, cap: req.quantity }],
      batchLookup,
      poolBatches: pool,
      baseReasons: ['manual', 'oldest_first'],
      fromLocationId: fromKit,
    });
    outLines.push(...l);
    skipped.push(...s);
  }

  return {
    id: makePlanId('handoff', `${fromKit}->${toKit}`, business_day),
    kind: 'handoff',
    business_day,
    generated_at,
    channel: opts.channel || 'asap',
    lines: outLines,
    skipped,
    warnings: [],
  };
}

// ── receivedLedger ────────────────────────────────────────────────────────────

/**
 * receivedLedger(receivedItems, plans) — the "100% certainty" ledger the owner asked for
 * (2026-09-10): every arrival of the day, one line, either "included in N kits" or "not
 * included — reason". Cross-references every plan's lines/skipped entries by batch_id (and
 * falls back to product_id for items that never got a line at all) so nothing can be silently
 * dropped between receiving and the plan.
 */
function receivedLedger(receivedItems, plans) {
  const allLines = [];
  const allSkipped = [];
  for (const plan of plans) {
    for (const l of plan.lines || []) allLines.push(l);
    for (const s of plan.skipped || []) allSkipped.push(s);
  }

  return receivedItems.map((item) => {
    const givenLines = allLines.filter((l) => l.batch_id === item.batch_id && l.give > 0);
    if (givenLines.length) {
      return {
        ...item,
        included_in: [...new Set(givenLines.map((l) => l.to_location_id))],
        reason: givenLines.some((l) => l.reasons.includes('mixed_batch')) ? 'mixed_batch' : 'new_arrival',
      };
    }
    const relatedSkip = allSkipped.find((s) => s.batch_id === item.batch_id)
      || allSkipped.find((s) => s.product_id === item.product_id);
    if (relatedSkip) {
      return { ...item, included_in: [], reason: relatedSkip.reasons[0] };
    }
    const mentioned = allLines.some((l) => l.product_id === item.product_id)
      || allSkipped.some((s) => s.product_id === item.product_id);
    return { ...item, included_in: [], reason: mentioned ? 'short_stock' : 'not_in_template' };
  });
}

// ── suggestMinMax ─────────────────────────────────────────────────────────────

/**
 * suggestMinMax({sales, days, current, minCoverageDays, maxCoverageDays}) — velocity-driven
 * min/max suggestions, per product, with the evidence behind each number. Suggestions only:
 * nothing here writes to a template. Used identically for kit templates and floor pars (the
 * owner: "adopt the same engine for the delivery kits").
 */
function suggestMinMax({ sales, days, current = [], minCoverageDays = 1, maxCoverageDays = 5 }) {
  if (!days || days <= 0) throw new TypeError('suggestMinMax: days must be a positive number');
  const totals = new Map();
  for (const s of sales) totals.set(s.product_id, (totals.get(s.product_id) || 0) + s.quantity);
  const currentByProduct = new Map(current.map((c) => [c.product_id, c]));

  return [...totals.entries()].map(([product_id, units]) => {
    const unitsPerDay = units / days;
    const suggestedMin = unitsPerDay > 0 ? Math.max(1, Math.ceil(unitsPerDay * minCoverageDays)) : 0;
    const suggestedMax = Math.max(suggestedMin, Math.ceil(unitsPerDay * maxCoverageDays));
    const cur = currentByProduct.get(product_id) || {};
    return {
      product_id,
      units_per_day: Math.round(unitsPerDay * 100) / 100,
      coverage_days: { min: minCoverageDays, max: maxCoverageDays },
      suggested_min: suggestedMin,
      suggested_max: suggestedMax,
      current_min: cur.min ?? null,
      current_max: cur.max ?? null,
      evidence: {
        units_sold: units, days, units_per_day: Math.round(unitsPerDay * 100) / 100,
        min_coverage_days: minCoverageDays, max_coverage_days: maxCoverageDays,
      },
    };
  });
}

// ── explain ───────────────────────────────────────────────────────────────────

const REASON_PHRASE = {
  sold: 'to replace ASAP sales since the last refill',
  new_arrival: 'newly received today',
  oldest_first: 'oldest batch first (FEFO)',
  partial_placement: 'stock did not cover every destination — placed partially, not dropped',
  short_stock: 'no stock left to give here',
  below_subregion_count: 'total stock is below the number of destinations',
  not_in_template: 'not in this destination\'s template',
  no_sales_counted: 'no sales counted yet',
  capped: 'capped at the template maximum',
  mixed_batch: 'spans more than one batch',
  reserved: 'reserved',
  expiring: 'expiring soon',
  held: 'held pending review',
  manual: 'manual instruction',
};

function phraseFor(reasons) {
  return reasons.map((r) => REASON_PHRASE[r] || r).join('; ');
}

/**
 * explain(plan) — plain-English lines for the packing screen and the pick slip. Every mixed
 * batch line gets its own loud, all-caps-led line naming both batch numbers, THC and packaged
 * dates (from the `note` field already built at plan time) so a packer can never miss it.
 */
function explain(plan) {
  const out = [];
  for (const line of plan.lines || []) {
    if (line.mixed_batch && line.note) out.push(line.note);
    out.push(
      `Give ${line.give} × ${line.product_id} (batch ${line.batch_id}) → ${line.to_location_id} — `
      + phraseFor(line.reasons),
    );
  }
  for (const s of plan.skipped || []) {
    out.push(
      `Skip ${s.product_id} → ${s.to_location_id} — ${phraseFor(s.reasons)} `
      + `(need ${s.need}, cap ${s.cap})`,
    );
  }
  return out;
}

export {
  VERSION,
  businessDay,
  businessDayStart,
  rotation,
  returnBaseline,
  receivedLedger,
  planBuild,
  planRefill,
  planRestock,
  planHandoff,
  suggestMinMax,
  explain,
};
