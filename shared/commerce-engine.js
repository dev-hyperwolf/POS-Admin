/* @hyperwolf/commerce-logic — BUILT ARTEFACT, DO NOT EDIT BY HAND.
 * Source: dev-hyperwolf/hyperwolf-commerce-logic (private). Regenerate with
 * `npm run demo` there; `npm run ship` republishes it here.
 * Exposes window.HWCommerce. Pure + synchronous: no I/O, no clock it was not given.
 */
"use strict";
var HWCommerce = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/demo-entry.ts
  var demo_entry_exports = {};
  __export(demo_entry_exports, {
    BUILTIN_RULES: () => BUILTIN_RULES,
    DEMO_AVAILABILITY: () => DEMO_AVAILABILITY,
    DEMO_CART: () => DEMO_CART,
    DEMO_CUSTOMER: () => DEMO_CUSTOMER,
    DEMO_DRIVER: () => DEMO_DRIVER,
    DEMO_KIT: () => DEMO_KIT,
    DEMO_ORDER: () => DEMO_ORDER,
    DEMO_ORDER_RULES: () => DEMO_ORDER_RULES,
    DEMO_PRODUCTS: () => DEMO_PRODUCTS,
    DEMO_SNAPSHOT: () => DEMO_SNAPSHOT,
    DEMO_SUPPORT: () => DEMO_SUPPORT,
    LANE_CACHE_TAG: () => LANE_CACHE_TAG,
    REASONS_BY_INTENT: () => REASONS_BY_INTENT,
    RedemptionRequestError: () => RedemptionRequestError,
    SUBSTITUTION_REASONS: () => SUBSTITUTION_REASONS,
    SWAP_MODES: () => SWAP_MODES,
    UPSELL_MODES: () => UPSELL_MODES,
    applyLaneMigration: () => applyLaneMigration,
    applyLaneMove: () => applyLaneMove,
    applyOrderSubstitution: () => applyOrderSubstitution,
    applyPartialSwap: () => applyPartialSwap,
    applySwap: () => applySwap,
    asIndex: () => asIndex,
    availabilityFromPlan: () => availabilityFromPlan,
    availabilityFromSources: () => availabilityFromSources,
    buildCandidates: () => buildCandidates,
    buildIndex: () => buildIndex,
    buildRedemptionRequest: () => buildRedemptionRequest,
    canFulfil: () => canFulfil,
    canSwap: () => canSwap,
    candidateReason: () => candidateReason,
    checkActor: () => checkActor,
    checkOrderState: () => checkOrderState,
    computeCartTotals: () => computeCartTotals,
    createRuleStore: () => createRuleStore,
    dedupeCandidates: () => dedupeCandidates,
    defaultConfig: () => defaultConfig,
    defaultFulfillmentPolicy: () => defaultFulfillmentPolicy,
    defaultLaneRules: () => defaultLaneRules,
    defaultLanes: () => defaultLanes,
    defaultPricingConfig: () => defaultPricingConfig,
    defaultSwapConfig: () => defaultSwapConfig,
    defaultUpsellConfig: () => defaultUpsellConfig,
    describeFilter: () => describeFilter,
    describeReward: () => describeReward,
    describeRule: () => describeRule,
    describeSnapshotCoverage: () => describeSnapshotCoverage,
    estimateRewardValue: () => estimateRewardValue,
    evaluateRule: () => evaluateRule,
    explainLanes: () => explainLanes,
    formatDelta: () => formatDelta,
    getUpsells: () => getUpsells,
    interpretRedemption: () => interpretRedemption,
    isIndex: () => isIndex,
    isRuleActive: () => isRuleActive,
    isRuleAvailableToCustomer: () => isRuleAvailableToCustomer,
    isRuleOnChannel: () => isRuleOnChannel,
    isStepUp: () => isStepUp,
    itemCount: () => itemCount,
    judgeCandidate: () => judgeCandidate,
    laneEligibility: () => laneEligibility,
    laneRuleMatches: () => laneRuleMatches,
    lanesOf: () => lanesOf,
    lanesThatCanFulfil: () => lanesThatCanFulfil,
    linesWithExistingEffect: () => linesWithExistingEffect,
    makeConfig: () => makeConfig,
    makeFulfillmentPolicy: () => makeFulfillmentPolicy,
    matchesFilter: () => matchesFilter,
    money: () => money,
    moveLane: () => moveLane,
    offerFromRule: () => offerFromRule,
    pickupLane: () => pickupLane,
    planLaneMigration: () => planLaneMigration,
    planLaneMove: () => planLaneMove,
    planOrderSubstitution: () => planOrderSubstitution,
    planPartialSwap: () => planPartialSwap,
    planSwap: () => planSwap,
    previewSwap: () => previewSwap,
    priceDelta: () => priceDelta,
    priceSubstitution: () => priceSubstitution,
    promotionProgress: () => promotionProgress,
    redemptionCoverageGaps: () => redemptionCoverageGaps,
    redemptionIdempotencyKey: () => redemptionIdempotencyKey,
    requiredConsent: () => requiredConsent,
    resolveLanes: () => resolveLanes,
    revalidateCart: () => revalidateCart,
    setLineLane: () => setLineLane,
    settlementFor: () => settlementFor,
    shouldFailClosed: () => shouldFailClosed,
    similarityDistance: () => similarityDistance,
    similarityScore: () => similarityScore,
    snapshotCacheTags: () => snapshotCacheTags,
    splitLineId: () => splitLineId,
    staleLineEffects: () => staleLineEffects,
    staleness: () => staleness,
    standingRedemptions: () => standingRedemptions,
    subtotalCents: () => subtotalCents,
    toRegistryRow: () => toRegistryRow,
    toRegistryRows: () => toRegistryRows,
    unitsAvailable: () => unitsAvailable,
    validateRuleSet: () => validateRuleSet
  });

  // src/core/types.ts
  function lanesOf(ctx) {
    return Object.keys(ctx.lanes).filter((l) => !!ctx.lanes[l]);
  }

  // src/core/lanes.ts
  var defaultLaneRules = [];
  function minutesOfDay(d) {
    return d.getHours() * 60 + d.getMinutes();
  }
  function laneRuleMatches(rule, laneId, where) {
    if (rule.lanes && !rule.lanes.includes(laneId)) return false;
    if (rule.zoneIds && (where.zoneId == null || !rule.zoneIds.includes(where.zoneId))) return false;
    if (rule.days && !rule.days.includes(where.at.getDay())) return false;
    if (rule.startMinutes != null && rule.endMinutes != null) {
      const m = minutesOfDay(where.at);
      const inWindow = rule.startMinutes <= rule.endMinutes ? m >= rule.startMinutes && m <= rule.endMinutes : m >= rule.startMinutes || m <= rule.endMinutes;
      if (!inWindow) return false;
    }
    if (rule.minDistanceMiles != null || rule.maxDistanceMiles != null) {
      const d = where.distanceMiles;
      if (d == null) return false;
      if (rule.minDistanceMiles != null && d < rule.minDistanceMiles) return false;
      if (rule.maxDistanceMiles != null && d >= rule.maxDistanceMiles) return false;
    }
    return true;
  }
  function sanitise(over) {
    const out = {};
    if (over.feeCents != null && Number.isFinite(over.feeCents)) {
      out.feeCents = Math.max(0, Math.round(over.feeCents));
    }
    if (over.minimumCents != null && Number.isFinite(over.minimumCents)) {
      out.minimumCents = Math.max(0, Math.round(over.minimumCents));
    }
    if (over.etaMinutes != null && Number.isFinite(over.etaMinutes)) {
      out.etaMinutes = Math.max(0, Math.round(over.etaMinutes));
    }
    return out;
  }
  function resolveLanes(base, where, rules = defaultLaneRules, resolve) {
    const out = {};
    for (const [id, lane] of Object.entries(base)) {
      if (!lane) continue;
      let next = { ...lane };
      for (const rule of rules) {
        if (laneRuleMatches(rule, id, where)) next = { ...next, ...sanitise(rule.set) };
      }
      if (resolve) {
        const override = resolve({ laneId: id, lane: next, where });
        if (override) next = { ...next, ...sanitise(override) };
      }
      out[id] = next;
    }
    return out;
  }
  function explainLanes(base, where, rules = defaultLaneRules, resolve) {
    const lanes = resolveLanes(base, where, rules, resolve);
    const explain = [];
    for (const [id, lane] of Object.entries(lanes)) {
      const from = base[id];
      const appliedRuleIds = rules.filter((r) => laneRuleMatches(r, id, where)).map((r) => r.id);
      const withoutResolver = resolveLanes({ [id]: from }, where, rules);
      const preResolver = withoutResolver[id];
      const resolverApplied = !!resolve && !!preResolver && (preResolver.feeCents !== lane.feeCents || preResolver.minimumCents !== lane.minimumCents || preResolver.etaMinutes !== lane.etaMinutes);
      const changed = ["feeCents", "minimumCents", "etaMinutes"].filter((k) => from && from[k] !== lane[k]);
      explain.push({
        laneId: id,
        feeCents: lane.feeCents,
        minimumCents: lane.minimumCents,
        appliedRuleIds,
        resolverApplied,
        changed
      });
    }
    return { lanes, explain };
  }

  // src/core/config.ts
  var defaultLanes = {
    express: {
      id: "express",
      label: "Express",
      feeCents: 200,
      // +$2 fee
      // $50 minimum. Was $40, which was WRONG — corrected on the owner's word:
      // "Express minimum varies by zone — most of the time it is $50."
      // "Most of the time" is why this is a DEFAULT and not the whole answer:
      // per-zone variation is expressed with `laneRules` below, not by editing
      // this number. See src/core/lanes.ts.
      minimumCents: 5e3,
      etaMinutes: 90,
      // "ARRIVES ~90 MIN"
      // What is in an on-shift driver's van right now.
      stockPool: "driver_kit"
    },
    scheduled: {
      id: "scheduled",
      label: "Scheduled",
      feeCents: 0,
      // free
      minimumCents: 4e3,
      // $40 minimum
      // NOT store stock. Scheduled is also fulfilled from a driver's kit — it
      // just has the lead time to load one from Safe/Staging before the window
      // opens, which is why it is the larger pool. Verified live: the storefront
      // reports 731 items for ASAP against 1,564 for Scheduled in the same zone.
      stockPool: "kit_loadable"
    }
  };
  var pickupLane = {
    id: "pickup",
    label: "Pick-up",
    feeCents: 0,
    minimumCents: 0,
    stockPool: "store_on_hand"
  };
  var defaultSwapConfig = {
    maxCandidates: 5,
    similarPriceBand: 0.4,
    similarityWeights: {
      price: 1,
      thc: 0.6,
      size: 0.8,
      brand: 0.3,
      strainType: 0.4,
      subcategory: 0.5
    },
    restrictToSameCategory: true,
    excludeItemsAlreadyInCart: true,
    onInsufficientQuantity: "exclude",
    strongerMinThcDelta: 2,
    cheaperSort: "similarity",
    maxAvailabilityAgeMs: 10 * 6e4,
    maxUpgradeMultiple: 2,
    laneMinimumPolicy: "advise"
  };
  var defaultUpsellConfig = {
    slotsBySurface: {
      home_hero: 1,
      home_banner: 1,
      shop_grid_tile: 3,
      brand_takeover: 1,
      pdp_pairs_with: 4,
      cart_add_to_order: 6,
      cart_savings_line: 1,
      checkout_callout: 2,
      loyalty_card: 1,
      post_add_sheet: 3
    },
    weights: {
      favoriteCategory: 6,
      categoryAffinity: 4,
      onSale: 3,
      knownBrand: 2,
      potency: 1,
      inventoryDepth: 0.5,
      margin: 1.5,
      unlocksPromotion: 12
    },
    categoryAffinity: {
      "Flower": ["Pre-Rolls", "Accessories"],
      "Pre-Rolls": ["Flower", "Accessories"],
      "Vapes": ["Batteries", "Concentrates"],
      "Concentrates": ["Vapes", "Accessories"],
      "Batteries": ["Vapes"],
      "Edibles": ["Drinks", "Tinctures"],
      "Drinks": ["Edibles"],
      "Tinctures": ["Topicals"],
      "Topicals": ["Tinctures"]
    },
    maxSpendToRewardRatio: 6,
    respectLaneAvailability: true,
    maxImpressionsPerOffer: 3
  };
  var defaultPricingConfig = {
    taxRate: 0.1025,
    // matches the Figma. See the warning above — excise is missing.
    taxDeliveryFee: false,
    discountStrategy: "best-single",
    maxDiscountFraction: 1,
    neverDiscountSaleItems: true,
    respectExistingLineEffects: true
  };
  var defaultConfig = {
    lanes: defaultLanes,
    laneRules: defaultLaneRules,
    swap: defaultSwapConfig,
    upsell: defaultUpsellConfig,
    pricing: defaultPricingConfig
  };
  function mergeLanes(overrides) {
    const out = { ...defaultLanes };
    for (const [id, patch] of Object.entries(overrides ?? {})) {
      const base = out[id] ?? (id === "pickup" ? pickupLane : void 0);
      if (!base) continue;
      out[id] = { ...base, ...patch };
    }
    return out;
  }
  function makeConfig(overrides = {}) {
    return {
      lanes: mergeLanes(overrides.lanes),
      laneRules: overrides.laneRules ?? defaultLaneRules,
      swap: { ...defaultSwapConfig, ...overrides.swap ?? {} },
      upsell: { ...defaultUpsellConfig, ...overrides.upsell ?? {} },
      pricing: { ...defaultPricingConfig, ...overrides.pricing ?? {} }
    };
  }
  function money(cents) {
    const sign = cents < 0 ? "-" : "";
    const abs = Math.abs(Math.round(cents));
    return `${sign}$${(abs / 100).toFixed(2)}`;
  }

  // src/core/availability.ts
  function buildIndex(snapshot) {
    const byId = /* @__PURE__ */ new Map();
    const byCategory = /* @__PURE__ */ new Map();
    const byBrand = /* @__PURE__ */ new Map();
    for (const p2 of snapshot.products) {
      byId.set(p2.id, p2);
      let cat = byCategory.get(p2.category);
      if (!cat) {
        cat = [];
        byCategory.set(p2.category, cat);
      }
      cat.push(p2);
      let br = byBrand.get(p2.brand);
      if (!br) {
        br = [];
        byBrand.set(p2.brand, br);
      }
      br.push(p2);
    }
    return { snapshot, byId, byCategory, byBrand };
  }
  function isIndex(x) {
    return "byId" in x;
  }
  function asIndex(x) {
    return isIndex(x) ? x : buildIndex(x);
  }
  function unitsAvailable(snapshot, productId, lane) {
    return snapshot.availability[productId]?.[lane] ?? 0;
  }
  function canFulfil(snapshot, productId, lane, quantity) {
    return unitsAvailable(snapshot, productId, lane) >= quantity;
  }
  function laneEligibility(snapshot, productId, lane, quantity) {
    const units = unitsAvailable(snapshot, productId, lane);
    if (units >= quantity) return { ok: true, units };
    return {
      ok: false,
      reason: units === 0 ? "out_of_stock" : "insufficient_quantity",
      units,
      needed: quantity
    };
  }
  function lanesThatCanFulfil(snapshot, productId, quantity, lanes) {
    return lanes.filter((l) => canFulfil(snapshot, productId, l, quantity));
  }
  function availabilityFromSources(rows) {
    const perSource = /* @__PURE__ */ new Map();
    for (const r of rows) {
      const key = `${r.productId}|${r.lane}|${r.sourceId}`;
      perSource.set(key, (perSource.get(key) ?? 0) + r.units);
    }
    const out = {};
    for (const [key, units] of perSource) {
      const [productId, lane] = key.split("|");
      const entry = out[productId] ??= {};
      entry[lane] = Math.max(entry[lane] ?? 0, units);
    }
    return out;
  }
  function staleness(snapshot, now) {
    if (!snapshot.asOf) return null;
    const t = Date.parse(snapshot.asOf);
    return Number.isNaN(t) ? null : now.getTime() - t;
  }
  function revalidateCart(snapshot, cart, customerZoneId) {
    const problems = [];
    if (snapshot.addressAvailability === false) {
      problems.push({ kind: "address_not_served", ...snapshot.location ? { location: snapshot.location } : {} });
    }
    if (snapshot.zoneId && customerZoneId && snapshot.zoneId !== customerZoneId) {
      problems.push({ kind: "zone_mismatch", snapshotZone: snapshot.zoneId, customerZone: customerZoneId });
    }
    const known = new Set(snapshot.products.map((p2) => p2.id));
    for (const line of cart.lines) {
      if (!known.has(line.productId)) {
        problems.push({ kind: "unknown_product", lineId: line.id, productId: line.productId });
        continue;
      }
      const have = unitsAvailable(snapshot, line.productId, line.lane);
      if (have === 0) {
        problems.push({ kind: "out_of_stock", lineId: line.id, productId: line.productId, lane: line.lane });
      } else if (have < line.quantity) {
        problems.push({
          kind: "insufficient_quantity",
          lineId: line.id,
          productId: line.productId,
          lane: line.lane,
          have,
          need: line.quantity
        });
      }
    }
    return problems;
  }
  var LANE_CACHE_TAG = {
    express: "delivery-asap",
    scheduled: "delivery-schedule",
    pickup: "delivery-pickup"
  };
  function snapshotCacheTags(snapshot, lanes = ["express", "scheduled"]) {
    const tags = lanes.map((l) => LANE_CACHE_TAG[l]).filter(Boolean);
    const zip = snapshot.location?.zipcode;
    if (zip) tags.push(`zipcode-${zip}`);
    return [...new Set(tags)];
  }
  function describeSnapshotCoverage(snapshot) {
    const warnings = [];
    const perProductAvailability = (snapshot.availabilityCoverage ?? "per-product") === "per-product";
    if (!perProductAvailability) {
      warnings.push(
        'availabilityCoverage is "totals-only": per-product lane filtering is inferred, not sourced. Swap and upsell lane decisions cannot be trusted.'
      );
    } else if (Object.keys(snapshot.availability ?? {}).length === 0 && snapshot.products.length > 0) {
      warnings.push(
        "availability is empty but products are present \u2014 every lane will read as out of stock."
      );
    }
    const located = !!(snapshot.location?.zipcode || snapshot.location?.lat != null && snapshot.location?.long != null);
    if (!located) {
      warnings.push("No location: this snapshot cannot be cached or invalidated per address.");
    }
    const served = snapshot.addressAvailability !== false;
    if (!served) warnings.push("addressAvailability is false \u2014 this address is not served.");
    const lanesWithTotals = Object.keys(snapshot.laneTotals ?? {}).filter((l) => (snapshot.laneTotals?.[l] ?? 0) > 0);
    if (!snapshot.asOf) {
      warnings.push("No asOf: staleness is unknowable, so driver-kit stock cannot be aged out.");
    }
    return { perProductAvailability, located, served, lanesWithTotals, warnings };
  }

  // src/core/rules/evaluate.ts
  function matchesFilter(p2, f) {
    if (!f) return true;
    if (f.productIds?.length && !f.productIds.includes(p2.id)) return false;
    if (f.categories?.length && !f.categories.includes(p2.category)) return false;
    if (f.brands?.length && !f.brands.includes(p2.brand)) return false;
    if (f.strainTypes?.length && (!p2.strainType || !f.strainTypes.includes(p2.strainType))) return false;
    if (f.tags?.length && !f.tags.some((t) => p2.tags?.includes(t))) return false;
    if (f.minThcPercent != null && (p2.thcPercent ?? 0) < f.minThcPercent) return false;
    if (f.maxThcPercent != null && (p2.thcPercent ?? 0) > f.maxThcPercent) return false;
    if (f.excludeOnSale && p2.compareAtPrice != null) return false;
    return true;
  }
  function describeFilter(f) {
    if (!f) return "anything";
    const parts = [];
    if (f.productIds?.length) parts.push(f.productIds.length === 1 ? "that product" : `${f.productIds.length} products`);
    if (f.brands?.length) parts.push(f.brands.join(" or "));
    if (f.categories?.length) parts.push(f.categories.join(" or "));
    if (f.strainTypes?.length) parts.push(f.strainTypes.join("/"));
    if (f.minThcPercent != null) parts.push(`${f.minThcPercent}%+ THC`);
    if (f.tags?.length) parts.push(f.tags.join(" or "));
    return parts.length ? parts.join(" ") : "anything";
  }
  function linesOf(ctx, lane) {
    return lane ? ctx.cart.lines.filter((l) => l.lane === lane) : ctx.cart.lines;
  }
  function subtotalCents(ctx, index, lane) {
    let total = 0;
    for (const line of linesOf(ctx, lane)) {
      const p2 = index.byId.get(line.productId);
      if (p2) total += p2.price * line.quantity;
    }
    return total;
  }
  function itemCount(ctx, lane) {
    return linesOf(ctx, lane).reduce((n, l) => n + l.quantity, 0);
  }
  function matchingQuantity(ctx, index, f, lane) {
    let n = 0;
    for (const line of linesOf(ctx, lane)) {
      const p2 = index.byId.get(line.productId);
      if (p2 && matchesFilter(p2, f)) n += line.quantity;
    }
    return n;
  }
  function minutesOfDay2(d) {
    return d.getHours() * 60 + d.getMinutes();
  }
  var DEFS = {
    // ── cart ──────────────────────────────────────────────────────────────────
    cart_subtotal_gte: {
      entity: "cart",
      describe: (c) => `the ${c.lane ?? ""} cart subtotal is ${money(c.amountCents)} or more`.replace("  ", " "),
      evaluate: (c, ctx, index) => {
        const sub = subtotalCents(ctx, index, c.lane);
        if (sub >= c.amountCents) return { satisfied: true };
        return { satisfied: false, gap: { kind: "spend", amountCents: c.amountCents - sub, lane: c.lane } };
      }
    },
    cart_item_count_gte: {
      entity: "cart",
      describe: (c) => `the cart holds ${c.count} or more items`,
      evaluate: (c, ctx) => {
        const n = itemCount(ctx, c.lane);
        if (n >= c.count) return { satisfied: true };
        return { satisfied: false, gap: { kind: "items", count: c.count - n, lane: c.lane } };
      }
    },
    cart_contains: {
      entity: "cart",
      describe: (c) => `the cart holds ${c.minQuantity}+ of ${describeFilter(c.filter)}`,
      evaluate: (c, ctx, index) => {
        const n = matchingQuantity(ctx, index, c.filter, c.lane);
        if (n >= c.minQuantity) return { satisfied: true };
        return {
          satisfied: false,
          gap: { kind: "items", count: c.minQuantity - n, filter: c.filter, lane: c.lane }
        };
      }
    },
    cart_distinct_categories_gte: {
      entity: "cart",
      describe: (c) => `the cart spans ${c.count} or more categories`,
      evaluate: (c, ctx, index) => {
        const cats = /* @__PURE__ */ new Set();
        for (const l of ctx.cart.lines) {
          const p2 = index.byId.get(l.productId);
          if (p2) cats.add(p2.category);
        }
        if (cats.size >= c.count) return { satisfied: true };
        return { satisfied: false, gap: { kind: "distinct_categories", count: c.count - cats.size } };
      }
    },
    // ── product ───────────────────────────────────────────────────────────────
    product_matches: {
      entity: "product",
      describe: (c) => `the product is ${describeFilter(c.filter)}`,
      evaluate: (c, _ctx, _index, scope) => {
        if (!scope.product) {
          return { satisfied: false, gap: { kind: "unreachable", why: "no product in scope" } };
        }
        return { satisfied: matchesFilter(scope.product, c.filter) };
      }
    },
    // ── user ──────────────────────────────────────────────────────────────────
    user_loyalty_tier: {
      entity: "user",
      describe: (c) => `the member is ${c.tiers.join(" or ")}`,
      evaluate: (c, ctx) => {
        const tier = ctx.customer?.loyaltyTier;
        const ok = !!tier && c.tiers.includes(tier);
        return ok ? { satisfied: true } : { satisfied: false, gap: { kind: "unreachable", why: "loyalty tier" } };
      }
    },
    user_order_count_gte: {
      entity: "user",
      describe: (c) => `the member has placed ${c.count}+ orders`,
      evaluate: (c, ctx) => {
        const ok = (ctx.customer?.orderCount ?? 0) >= c.count;
        return ok ? { satisfied: true } : { satisfied: false, gap: { kind: "unreachable", why: "order history" } };
      }
    },
    user_order_count_lte: {
      entity: "user",
      describe: (c) => `the member has placed ${c.count} or fewer orders`,
      evaluate: (c, ctx) => {
        const ok = (ctx.customer?.orderCount ?? 0) <= c.count;
        return ok ? { satisfied: true } : { satisfied: false, gap: { kind: "unreachable", why: "order history" } };
      }
    },
    user_days_since_last_order_gte: {
      entity: "user",
      describe: (c) => `it has been ${c.days}+ days since the last order`,
      evaluate: (c, ctx) => {
        const d = ctx.customer?.daysSinceLastOrder;
        const ok = d != null && d >= c.days;
        return ok ? { satisfied: true } : { satisfied: false, gap: { kind: "unreachable", why: "recency" } };
      }
    },
    user_lifetime_spend_gte: {
      entity: "user",
      describe: (c) => `lifetime spend is ${money(c.amountCents)} or more`,
      evaluate: (c, ctx) => {
        const ok = (ctx.customer?.lifetimeSpend ?? 0) >= c.amountCents;
        return ok ? { satisfied: true } : { satisfied: false, gap: { kind: "unreachable", why: "lifetime spend" } };
      }
    },
    user_purchased_brand: {
      entity: "user",
      describe: (c) => `the member has bought ${c.brands.join(" or ")} before`,
      evaluate: (c, ctx) => {
        const bought = ctx.customer?.purchasedBrands ?? [];
        const ok = c.brands.some((b) => bought.includes(b));
        return ok ? { satisfied: true } : { satisfied: false, gap: { kind: "unreachable", why: "brand history" } };
      }
    },
    user_birthday_within_days: {
      entity: "user",
      describe: (c) => `their birthday is within ${c.days} days`,
      evaluate: (c, ctx) => {
        const bd = ctx.customer?.birthday;
        if (!bd) return { satisfied: false, gap: { kind: "unreachable", why: "no birthday on file" } };
        const parts = bd.split("-").map(Number);
        const mm = parts.length === 3 ? parts[1] : parts[0];
        const dd = parts.length === 3 ? parts[2] : parts[1];
        if (mm == null || dd == null) return { satisfied: false, gap: { kind: "unreachable", why: "bad birthday" } };
        const now = ctx.now;
        let next = new Date(now.getFullYear(), mm - 1, dd);
        if (next.getTime() < now.getTime()) next = new Date(now.getFullYear() + 1, mm - 1, dd);
        const days = (next.getTime() - now.getTime()) / 864e5;
        return days <= c.days ? { satisfied: true } : { satisfied: false, gap: { kind: "unreachable", why: "birthday window" } };
      }
    },
    // ── time ──────────────────────────────────────────────────────────────────
    time_day_of_week: {
      entity: "time",
      describe: (c) => `it is a ${c.days.map((d) => DAY_NAMES[d] ?? d).join(" or ")}`,
      evaluate: (c, ctx) => c.days.includes(ctx.now.getDay()) ? { satisfied: true } : { satisfied: false, gap: { kind: "unreachable", why: "day of week" } }
    },
    time_of_day_between: {
      entity: "time",
      describe: (c) => `the time is between ${hhmm(c.startMinutes)} and ${hhmm(c.endMinutes)}`,
      evaluate: (c, ctx) => {
        const m = minutesOfDay2(ctx.now);
        const ok = c.startMinutes <= c.endMinutes ? m >= c.startMinutes && m <= c.endMinutes : m >= c.startMinutes || m <= c.endMinutes;
        return ok ? { satisfied: true } : { satisfied: false, gap: { kind: "unreachable", why: "time of day" } };
      }
    },
    time_date_between: {
      entity: "time",
      describe: (c) => `the date is between ${c.startIso.slice(0, 10)} and ${c.endIso.slice(0, 10)}`,
      evaluate: (c, ctx) => {
        const t = ctx.now.getTime();
        const ok = t >= Date.parse(c.startIso) && t <= Date.parse(c.endIso);
        return ok ? { satisfied: true } : { satisfied: false, gap: { kind: "unreachable", why: "date window" } };
      }
    },
    // ── location ──────────────────────────────────────────────────────────────
    location_zone_in: {
      entity: "location",
      describe: (c) => `delivering to ${c.zoneIds.join(" or ")}`,
      evaluate: (c, ctx) => {
        const z = ctx.customer?.zoneId;
        const ok = !!z && c.zoneIds.includes(z);
        return ok ? { satisfied: true } : { satisfied: false, gap: { kind: "unreachable", why: "delivery zone" } };
      }
    }
  };
  var DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  function hhmm(mins) {
    const h = Math.floor(mins / 60), m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  function evaluateCondition(c, ctx, index, scope) {
    const def = DEFS[c.id];
    return def.evaluate(c, ctx, index, scope);
  }
  function isRuleActive(rule, now) {
    if (rule.status !== "live" && rule.status !== "scheduled") return false;
    const t = now.getTime();
    if (rule.startsAt && t < Date.parse(rule.startsAt)) return false;
    if (rule.endsAt && t > Date.parse(rule.endsAt)) return false;
    return rule.status === "live" || !!rule.startsAt;
  }
  function isRuleOnChannel(rule, ctx) {
    if (!ctx.channel) return true;
    if (!rule.channels || rule.channels.length === 0) return true;
    return rule.channels.includes(ctx.channel);
  }
  function linesWithExistingEffect(ctx) {
    return new Set(Object.keys(ctx.cart.lineEffects ?? {}));
  }
  function redemptionCoverageGaps(rules, ctx) {
    const channel = ctx.channel;
    const covered = ctx.customer?.redemptionLedgerChannels;
    if (!channel || !covered) return [];
    if (covered.includes(channel)) return [];
    return rules.filter((r) => r.usageLimitPerUser != null).map((r) => ({
      ruleId: r.id,
      channel,
      message: `"${r.name}" limits redemptions per customer, but the redemption ledger has no data for ${channel} (covers: ${covered.join(", ") || "nothing"}). The limit cannot be enforced here.`
    }));
  }
  function isRuleAvailableToCustomer(rule, ctx) {
    const limit = rule.usageLimitPerUser;
    if (limit == null) return true;
    const redeemed = ctx.customer?.redeemedPromotionIds ?? [];
    return redeemed.filter((id) => id === rule.id).length < limit;
  }
  function evaluateRule(rule, ctx, scope = {}, indexIn) {
    const index = indexIn ?? asIndex(ctx.snapshot);
    const results = rule.conditions.map((c) => evaluateCondition(c, ctx, index, scope));
    const satisfied = rule.combiner === "OR" ? results.some((r) => r.satisfied) : results.every((r) => r.satisfied);
    const unmet = results.filter((r) => !r.satisfied);
    const closableGaps = unmet.map((r) => r.gap).filter((g) => !!g && g.kind !== "unreachable");
    const blockedByUnreachable = unmet.some((r) => r.gap?.kind === "unreachable");
    return { rule, satisfied, conditions: results, closableGaps, blockedByUnreachable };
  }
  function describeRule(rule) {
    const joiner = rule.combiner === "OR" ? " or " : " and ";
    const ifPart = rule.conditions.map((c) => DEFS[c.id].describe(c)).join(joiner);
    return `If ${ifPart || "always"}, then ${describeReward(rule.reward)}.`;
  }
  function describeReward(r) {
    switch (r.kind) {
      case "percent_off_cart":
        return `take ${r.percent}% off the cart${r.capCents ? ` (up to ${money(r.capCents)})` : ""}`;
      case "dollar_off_cart":
        return `take ${money(r.amountCents)} off the cart`;
      case "percent_off_items":
        return `take ${r.percent}% off ${describeFilter(r.filter)}`;
      case "dollar_off_items":
        return `take ${money(r.amountCents)} off ${describeFilter(r.filter)}`;
      case "free_gift":
        return `add a free gift`;
      case "free_delivery":
        return `make delivery free${r.lane ? ` on ${r.lane}` : ""}`;
      case "bogo":
        return `buy ${r.buyQuantity} of ${describeFilter(r.filter)}, get ${r.getQuantity} at ${r.getPercentOff}% off`;
      case "bundle_price":
        return `get ${r.quantity} of ${describeFilter(r.filter)} for ${money(r.priceCents)}`;
      case "points_multiplier":
        return `earn ${r.multiplier}x points`;
    }
  }
  function estimateRewardValue(reward, ctx, indexIn, options = {}) {
    const index = indexIn ?? asIndex(ctx.snapshot);
    const cap = (v, c) => c != null ? Math.min(v, c) : v;
    const skipSale = options.neverDiscountSaleItems ?? false;
    const spokenFor = options.respectExistingLineEffects === false ? /* @__PURE__ */ new Set() : linesWithExistingEffect(ctx);
    const matchingLines = (f) => ctx.cart.lines.map((l) => ({ line: l, p: index.byId.get(l.productId) })).filter((x) => !!x.p && matchesFilter(x.p, f) && !(skipSale && x.p.compareAtPrice != null) && !spokenFor.has(x.line.id));
    switch (reward.kind) {
      case "percent_off_cart": {
        const sub = subtotalCents(ctx, index);
        return Math.round(cap(sub * (reward.percent / 100), reward.capCents));
      }
      case "dollar_off_cart": {
        return Math.min(reward.amountCents, subtotalCents(ctx, index));
      }
      case "percent_off_items": {
        const total = matchingLines(reward.filter).reduce((s, x) => s + x.p.price * x.line.quantity, 0);
        return Math.round(cap(total * (reward.percent / 100), reward.capCents));
      }
      case "dollar_off_items": {
        const total = matchingLines(reward.filter).reduce((s, x) => s + x.p.price * x.line.quantity, 0);
        return Math.min(reward.amountCents, total);
      }
      case "free_gift": {
        return index.byId.get(reward.productId)?.price ?? 0;
      }
      case "free_delivery": {
        const lanes = reward.lane ? [reward.lane] : Object.keys(ctx.lanes);
        return lanes.filter((l) => ctx.cart.lines.some((line) => line.lane === l)).reduce((s, l) => s + (ctx.lanes[l]?.feeCents ?? 0), 0);
      }
      case "bogo": {
        const units = [];
        for (const { line, p: p2 } of matchingLines(reward.filter)) {
          for (let i = 0; i < line.quantity; i++) units.push(p2.price);
        }
        units.sort((a, b) => a - b);
        const groupSize = reward.buyQuantity + reward.getQuantity;
        const groups = Math.floor(units.length / groupSize);
        let value = 0;
        for (let g = 0; g < groups; g++) {
          for (let i = 0; i < reward.getQuantity; i++) {
            value += (units[g * reward.getQuantity + i] ?? 0) * (reward.getPercentOff / 100);
          }
        }
        return Math.round(value);
      }
      case "bundle_price": {
        const units = [];
        for (const { line, p: p2 } of matchingLines(reward.filter)) {
          for (let i = 0; i < line.quantity; i++) units.push(p2.price);
        }
        units.sort((a, b) => b - a);
        const bundles = Math.floor(units.length / reward.quantity);
        let value = 0;
        for (let b = 0; b < bundles; b++) {
          const slice = units.slice(b * reward.quantity, (b + 1) * reward.quantity);
          const normal = slice.reduce((s, v) => s + v, 0);
          value += Math.max(0, normal - reward.priceCents);
        }
        return Math.round(value);
      }
      case "points_multiplier":
        return 0;
    }
  }

  // src/core/rules/defaults.ts
  var BUILTIN_RULES = [
    {
      id: "preroll-2pk-5off",
      name: "Add a pre-roll 2pk, save $5",
      status: "live",
      combiner: "AND",
      conditions: [
        { id: "cart_contains", filter: { categories: ["Pre-Rolls"], tags: ["2pk"] }, minQuantity: 1 }
      ],
      reward: { kind: "dollar_off_cart", amountCents: 500 },
      priority: 10,
      upsell: {
        enabled: true,
        surfaces: ["cart_add_to_order", "checkout_callout", "post_add_sheet"],
        headline: "Unlock $5 off",
        subline: "Add any pre-roll 2pk to save"
      }
    },
    {
      id: "free-express-over-100",
      name: "Free Express delivery over $100",
      status: "live",
      combiner: "AND",
      conditions: [
        { id: "cart_subtotal_gte", amountCents: 1e4, lane: "express" }
      ],
      reward: { kind: "free_delivery", lane: "express" },
      priority: 5,
      upsell: {
        enabled: true,
        surfaces: ["cart_add_to_order", "cart_savings_line", "checkout_callout"]
      }
    },
    {
      id: "wolfpack-10",
      name: "Wolfpack Leader \u2014 10% off",
      status: "live",
      combiner: "AND",
      conditions: [
        { id: "user_loyalty_tier", tiers: ["Wolfpack Leader"] }
      ],
      reward: { kind: "percent_off_cart", percent: 10, capCents: 5e3 },
      priority: 20
      // No upsell: a tier gate cannot be closed by adding to the cart, and the
      // engine would correctly refuse to generate a card for it anyway.
    },
    {
      id: "welcome-20",
      name: "Welcome \u2014 $20 off your first order",
      status: "live",
      code: "WELCOME20",
      combiner: "AND",
      conditions: [
        { id: "user_order_count_lte", count: 0 },
        { id: "cart_subtotal_gte", amountCents: 6e3 }
      ],
      reward: { kind: "dollar_off_cart", amountCents: 2e3 },
      priority: 30,
      individualUseOnly: true
    }
  ];

  // src/core/rules/source.ts
  var KNOWN_REWARDS = /* @__PURE__ */ new Set([
    "percent_off_cart",
    "dollar_off_cart",
    "percent_off_items",
    "dollar_off_items",
    "free_gift",
    "free_delivery",
    "bogo",
    "bundle_price",
    "points_multiplier"
  ]);
  var KNOWN_CONDITIONS = /* @__PURE__ */ new Set([
    "cart_subtotal_gte",
    "cart_item_count_gte",
    "cart_contains",
    "cart_distinct_categories_gte",
    "product_matches",
    "user_loyalty_tier",
    "user_order_count_gte",
    "user_order_count_lte",
    "user_days_since_last_order_gte",
    "user_lifetime_spend_gte",
    "user_purchased_brand",
    "user_birthday_within_days",
    "time_day_of_week",
    "time_of_day_between",
    "time_date_between",
    "location_zone_in"
  ]);
  function validateRuleSet(input) {
    const issues = [];
    const out = [];
    const raw = Array.isArray(input) ? input : input && typeof input === "object" && Array.isArray(input.rules) ? input.rules : null;
    if (!raw) {
      issues.push({ ruleId: "(payload)", message: "expected an array of rules or { rules: [...] }" });
      return { rules: [], issues };
    }
    for (const [i, item] of raw.entries()) {
      const r = item;
      const id = typeof r?.id === "string" ? r.id : `(index ${i})`;
      const bad = (message) => issues.push({ ruleId: id, message });
      if (typeof r?.id !== "string" || !r.id) {
        bad("missing id");
        continue;
      }
      if (/^\d+$/.test(r.id)) {
        bad(`id "${r.id}" looks like a sequence value \u2014 the shared key must be a stable slug (e.g. "wolfpack-preroll-2for1"), not an autoincrement`);
        continue;
      }
      if (typeof r.name !== "string" || !r.name) {
        bad("missing name");
        continue;
      }
      if (!Array.isArray(r.conditions)) {
        bad("conditions must be an array");
        continue;
      }
      if (!r.reward || typeof r.reward !== "object") {
        bad("missing reward");
        continue;
      }
      if (!KNOWN_REWARDS.has(r.reward.kind ?? "")) {
        bad(`unknown reward kind "${r.reward.kind}"`);
        continue;
      }
      const unknownCond = r.conditions.find(
        (c) => !KNOWN_CONDITIONS.has(c?.id ?? "")
      );
      if (unknownCond) {
        bad(`unknown condition "${unknownCond.id}" \u2014 is this package older than the admin UI?`);
        continue;
      }
      if (r.combiner !== "AND" && r.combiner !== "OR") {
        bad("combiner must be AND or OR");
        continue;
      }
      out.push(r);
    }
    return { rules: out, issues };
  }
  function createRuleStore(options = {}) {
    const report = (origin, issue) => options.onIssue?.({ ...issue, origin });
    const builtin = {
      rules: options.builtin ?? BUILTIN_RULES,
      origin: "builtin"
    };
    let base = builtin;
    if (options.static !== void 0) {
      const { rules, issues } = validateRuleSet(options.static);
      issues.forEach((i) => report("static", i));
      if (rules.length > 0) {
        base = { rules, origin: "static" };
      } else if (issues.length > 0) {
        report("static", { ruleId: "(payload)", message: "no valid rules \u2014 falling back to builtin" });
      }
    }
    let currentSet = base;
    let lastFetchMs = 0;
    let inFlight = null;
    const ttl = options.remote?.ttlMs ?? 5 * 6e4;
    const nowMs = options.nowMs ?? (() => Date.now());
    function isStale() {
      if (!options.remote) return false;
      return nowMs() - lastFetchMs > ttl;
    }
    async function refresh() {
      const remote = options.remote;
      if (!remote) return currentSet;
      if (inFlight) return inFlight;
      inFlight = (async () => {
        const doFetch = remote.fetchImpl ?? globalThis.fetch;
        if (!doFetch) {
          report("remote", { ruleId: "(fetch)", message: "no fetch implementation available" });
          return currentSet;
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), remote.timeoutMs ?? 4e3);
        try {
          const res = await doFetch(remote.url, {
            headers: remote.headers,
            signal: controller.signal
          });
          if (!res.ok) {
            report("remote", { ruleId: "(fetch)", message: `HTTP ${res.status} \u2014 keeping ${currentSet.origin} rules` });
            return currentSet;
          }
          const body = await res.json();
          const { rules, issues } = validateRuleSet(body);
          issues.forEach((i) => report("remote", i));
          if (rules.length === 0) {
            report("remote", { ruleId: "(payload)", message: `no valid rules \u2014 keeping ${currentSet.origin} rules` });
            return currentSet;
          }
          lastFetchMs = nowMs();
          currentSet = { rules, origin: "remote", fetchedAt: new Date(lastFetchMs).toISOString() };
          return currentSet;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          report("remote", { ruleId: "(fetch)", message: `${msg} \u2014 keeping ${currentSet.origin} rules` });
          return currentSet;
        } finally {
          clearTimeout(timer);
          inFlight = null;
        }
      })();
      return inFlight;
    }
    return { current: () => currentSet, isStale, refresh };
  }

  // src/core/rules/registry.ts
  function rewardShape(reward) {
    switch (reward.kind) {
      case "percent_off_cart":
      case "percent_off_items":
        return { kind: "percent", amount: reward.percent, unit: "percent" };
      case "dollar_off_cart":
      case "dollar_off_items":
        return { kind: "dollar", amount: reward.amountCents, unit: "cents" };
      case "bogo":
        return { kind: "bogo", amount: reward.getPercentOff, unit: "percent" };
      case "bundle_price":
        return { kind: "bundle", amount: reward.priceCents, unit: "cents" };
      case "free_gift":
        return { kind: "gift", amount: 0, unit: "none" };
      case "free_delivery":
        return { kind: "free_delivery", amount: 0, unit: "none" };
      case "points_multiplier":
        return { kind: "points", amount: reward.multiplier, unit: "multiplier" };
    }
  }
  function rewardTarget(reward, skuFor) {
    const sku = (id) => skuFor?.(id) ?? id;
    if (reward.kind === "free_gift") return `sku:${sku(reward.productId)}`;
    if ("filter" in reward && reward.filter) {
      const f = reward.filter;
      if (f.productIds?.length === 1 && f.productIds[0]) return `sku:${sku(f.productIds[0])}`;
      if (f.productIds?.length) return `sku:${f.productIds.map(sku).join("|")}`;
      if (f.brands?.length) return `brand:${f.brands.join("|")}`;
      if (f.categories?.length) return `category:${f.categories.join("|")}`;
    }
    return "cart";
  }
  var FLATTENABLE = /* @__PURE__ */ new Set(["cart_subtotal_gte", "cart_item_count_gte", "product_matches"]);
  function toRegistryRow(rule, options = {}) {
    const opts = typeof options === "function" ? { describe: options } : options;
    const { kind, amount, unit } = rewardShape(rule.reward);
    const flattened = rule.conditions.length > 1 || rule.combiner === "OR" || rule.conditions.some((c) => !FLATTENABLE.has(c.id));
    return {
      id: rule.id,
      name: rule.name,
      code: rule.code && rule.code.length > 0 ? rule.code : null,
      kind,
      amount,
      amount_unit: unit,
      starts_at: rule.startsAt ?? null,
      ends_at: rule.endsAt ?? null,
      channels: rule.channels ?? null,
      target: rewardTarget(rule.reward, opts.skuFor),
      active: rule.status === "live",
      projected_from_rule: true,
      fidelity: flattened ? "flattened" : "exact",
      summary: opts.describe ? opts.describe(rule) : rule.name
    };
  }
  function toRegistryRows(rules, options = {}) {
    return rules.map((r) => toRegistryRow(r, options));
  }

  // src/core/rules/redemption.ts
  var RedemptionRequestError = class extends Error {
  };
  function buildRedemptionRequest(input) {
    const { identity } = input;
    if (identity.identityId == null && !identity.phone) {
      throw new RedemptionRequestError(
        "A redemption needs an identityId or an E.164 phone. Email is accepted but never matched, so it cannot identify anyone on its own."
      );
    }
    if (identity.phone && !/^\+[1-9]\d{6,14}$/.test(identity.phone)) {
      throw new RedemptionRequestError(
        `Phone "${identity.phone}" is not E.164. It will not match the ledger, and the failure is silent.`
      );
    }
    return {
      promotion_key: input.promotionKey,
      source: input.source,
      order_id: input.orderId,
      identity: {
        ...identity.identityId != null ? { identity_id: identity.identityId } : {},
        ...identity.phone ? { phone: identity.phone } : {},
        ...identity.email !== void 0 ? { email: identity.email } : {}
      },
      amount_cents: input.amountCents,
      is_first_timer: input.isFirstTimer
    };
  }
  function redemptionIdempotencyKey(request) {
    return `${request.promotion_key}::${request.source}::${request.order_id}`;
  }
  function shouldFailClosed(subject) {
    return subject.usageLimitPerUser != null || subject.isFirstTimer;
  }
  function interpretRedemption(outcome, subject) {
    switch (outcome.status) {
      case "accepted": {
        const replay = outcome.body.replay || outcome.body.already_redeemed === true;
        return {
          mayApply: true,
          markRedeemed: true,
          reason: replay ? "Idempotent replay of this same order's redemption \u2014 already recorded, still valid." : "Redemption recorded."
        };
      }
      case "conflict": {
        if (outcome.body.standing === false) {
          return {
            mayApply: true,
            markRedeemed: false,
            reason: `A redemption on ${outcome.body.source} was reversed (cancelled order), so it no longer counts against this customer.`
          };
        }
        return {
          mayApply: false,
          markRedeemed: true,
          reason: `Already redeemed on ${outcome.body.source} at ${outcome.body.redeemed_at}.`
        };
      }
      case "unavailable": {
        if (shouldFailClosed(subject)) {
          return {
            mayApply: false,
            markRedeemed: false,
            reason: `Redemption ledger unavailable (${outcome.reason}) and this is a single-use or first-timer promotion, so it was declined rather than honoured. Honouring it blind risks a post-checkout cancellation by the fraud gate, which is worse for the customer than declining up front.`
          };
        }
        return {
          mayApply: true,
          markRedeemed: false,
          reason: `Redemption ledger unavailable (${outcome.reason}) \u2014 the promotion was honoured without a cross-channel check. Safe here because it carries no per-customer usage limit.`
        };
      }
    }
  }
  function standingRedemptions(rows) {
    return [...new Set(rows.filter((r) => r.state === "standing").map((r) => r.promotionKey))];
  }

  // src/core/swap/rank.ts
  var SWAP_MODES = ["similar", "cheaper", "stronger"];
  var UPSELL_MODES = ["upgrade", "stronger", "similar"];
  function similarityDistance(a, b, w) {
    let sum = 0;
    let used = 0;
    const add = (weight, dist) => {
      sum += weight * Math.min(1, Math.max(0, dist));
      used += weight;
    };
    const basis = Math.max(a.price, 1);
    add(w.price, Math.abs(b.price - a.price) / basis);
    if (a.thcPercent != null && b.thcPercent != null) {
      add(w.thc, Math.abs(b.thcPercent - a.thcPercent) / 30);
    }
    if (a.sizeGrams != null && b.sizeGrams != null) {
      add(w.size, Math.abs(b.sizeGrams - a.sizeGrams) / Math.max(a.sizeGrams, 0.1));
    }
    add(w.brand, a.brand === b.brand ? 0 : 1);
    if (a.strainType && b.strainType) {
      add(w.strainType, a.strainType === b.strainType ? 0 : 1);
    }
    if (a.subcategory && b.subcategory) {
      add(w.subcategory, a.subcategory === b.subcategory ? 0 : 1);
    }
    return used === 0 ? 1 : sum / used;
  }
  function similarityScore(a, b, w) {
    return 1 - similarityDistance(a, b, w);
  }
  function priceDelta(current, candidate) {
    return candidate.price - current.price;
  }
  function formatDelta(deltaCents) {
    if (deltaCents === 0) return null;
    return deltaCents < 0 ? `Save ${money(-deltaCents)}` : `+${money(deltaCents)}`;
  }
  function candidateReason(current, candidate, mode) {
    const bits = [];
    if (mode === "cheaper") {
      bits.push(`Save ${money(current.price - candidate.price)}`);
    } else if (mode === "stronger" && current.thcPercent != null && candidate.thcPercent != null) {
      bits.push(`+${(candidate.thcPercent - current.thcPercent).toFixed(1)}% THC`);
    } else if (mode === "upgrade") {
      if (candidate.sizeGrams != null && current.sizeGrams != null && candidate.sizeGrams > current.sizeGrams) {
        const packs = candidate.unitCount != null && current.unitCount != null && candidate.unitCount !== current.unitCount ? ` (${candidate.unitCount}-pack)` : "";
        bits.push(`${candidate.sizeGrams}g vs ${current.sizeGrams}g${packs}`);
      } else if (candidate.unitCount != null && current.unitCount != null && candidate.unitCount > current.unitCount && (candidate.sizeGrams == null || current.sizeGrams == null)) {
        bits.push(`${candidate.unitCount}-pack vs ${current.unitCount}`);
      } else if (current.thcPercent != null && candidate.thcPercent != null && candidate.thcPercent > current.thcPercent) {
        bits.push(`+${(candidate.thcPercent - current.thcPercent).toFixed(1)}% THC`);
      } else {
        bits.push("Step up");
      }
    }
    if (candidate.brand === current.brand) bits.push("Same brand");
    if (candidate.sizeGrams != null && current.sizeGrams != null && candidate.sizeGrams === current.sizeGrams) bits.push("Same size");
    if (bits.length === 0 && candidate.strainType && candidate.strainType === current.strainType) {
      bits.push(`Also ${candidate.strainType}`);
    }
    if (bits.length === 0 && candidate.compareAtPrice != null) bits.push("On sale");
    return bits.slice(0, 2).join(" \xB7 ") || "Similar pick";
  }
  function dedupeCandidates(items) {
    const seenIds = /* @__PURE__ */ new Set();
    const seenVisible = /* @__PURE__ */ new Set();
    const out = [];
    for (const it of items) {
      const p2 = it.product;
      const visibleKey = `${p2.brand}|${p2.name}|${p2.sizeGrams ?? ""}|${p2.price}`.toLowerCase();
      if (seenIds.has(p2.id) || seenVisible.has(visibleKey)) continue;
      seenIds.add(p2.id);
      seenVisible.add(visibleKey);
      out.push(it);
    }
    return out;
  }

  // src/core/pricing.ts
  function computeCartTotals(ctx, options = {}) {
    const cfg = options.config ?? defaultConfig;
    const index = options.index ?? asIndex(ctx.snapshot);
    const rules = options.rules ?? [];
    const activeLanes = lanesOf(ctx).filter((l) => ctx.cart.lines.some((line) => line.lane === l));
    const codes = new Set(ctx.cart.appliedCodes ?? []);
    const qualifying = rules.filter((r) => {
      if (!isRuleActive(r, ctx.now)) return false;
      if (!isRuleOnChannel(r, ctx)) return false;
      if (r.code && !codes.has(r.code)) return false;
      if (!isRuleAvailableToCustomer(r, ctx)) return false;
      return evaluateRule(r, ctx, {}, index).satisfied;
    });
    const monetary = qualifying.filter((r) => r.reward.kind !== "free_delivery" && r.reward.kind !== "points_multiplier").map((r) => ({
      rule: r,
      value: estimateRewardValue(r.reward, ctx, index, {
        neverDiscountSaleItems: cfg.pricing.neverDiscountSaleItems,
        respectExistingLineEffects: cfg.pricing.respectExistingLineEffects
      })
    })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value || (b.rule.priority ?? 0) - (a.rule.priority ?? 0));
    const spokenFor = linesWithExistingEffect(ctx);
    const lineEffectConflicts = [];
    if (spokenFor.size > 0) {
      for (const { rule } of monetary) {
        const cartScoped = rule.reward.kind === "percent_off_cart" || rule.reward.kind === "dollar_off_cart";
        if (!cartScoped) continue;
        for (const lineId of spokenFor) {
          const existing = ctx.cart.lineEffects?.[lineId];
          if (!existing) continue;
          lineEffectConflicts.push({
            lineId,
            existingPromotionId: existing.promotionKey,
            existingChannel: existing.sourceChannel,
            wouldAlsoApplyRuleId: rule.id,
            suppressed: cfg.pricing.respectExistingLineEffects
          });
        }
      }
    }
    const conflictingRuleIds = new Set(
      cfg.pricing.respectExistingLineEffects ? lineEffectConflicts.map((c) => c.wouldAlsoApplyRuleId) : []
    );
    const eligible = monetary.filter((x) => !conflictingRuleIds.has(x.rule.id));
    let chosen = [];
    if (eligible.length > 0) {
      const bestSingle = eligible[0] ? [eligible[0]] : [];
      if (cfg.pricing.discountStrategy === "stack") {
        const stackable = eligible.filter((x) => !x.rule.individualUseOnly);
        const stackValue = stackable.reduce((s, x) => s + x.value, 0);
        const singleValue = bestSingle.reduce((s, x) => s + x.value, 0);
        chosen = stackValue > singleValue ? stackable : bestSingle;
      } else {
        chosen = bestSingle;
      }
    }
    const grossSubtotal = subtotalCents(ctx, index);
    let discountCents = chosen.reduce((s, x) => s + x.value, 0);
    discountCents = Math.min(discountCents, Math.round(grossSubtotal * cfg.pricing.maxDiscountFraction));
    const discounts = chosen.map((x) => ({
      ruleId: x.rule.id,
      name: x.rule.name,
      amountCents: x.value,
      kind: "discount"
    }));
    const waivedLanes = /* @__PURE__ */ new Set();
    for (const r of qualifying) {
      if (r.reward.kind !== "free_delivery") continue;
      const targets = r.reward.lane ? [r.reward.lane] : activeLanes;
      for (const l of targets) {
        if (!activeLanes.includes(l)) continue;
        const fee = ctx.lanes[l]?.feeCents ?? 0;
        if (fee <= 0 || waivedLanes.has(l)) continue;
        waivedLanes.add(l);
        discounts.push({ ruleId: r.id, name: r.name, amountCents: fee, kind: "fee_waiver" });
      }
    }
    const laneTotals = activeLanes.map((lane) => {
      const laneCfg = ctx.lanes[lane];
      const sub = subtotalCents(ctx, index, lane);
      const count = ctx.cart.lines.filter((l) => l.lane === lane).reduce((n, l) => n + l.quantity, 0);
      const met = sub >= laneCfg.minimumCents;
      const waived = waivedLanes.has(lane);
      return {
        lane,
        itemCount: count,
        subtotalCents: sub,
        minimumCents: laneCfg.minimumCents,
        minimumMet: met,
        shortfallCents: met ? 0 : laneCfg.minimumCents - sub,
        progress: laneCfg.minimumCents > 0 ? Math.min(1, sub / laneCfg.minimumCents) : 1,
        feeCents: waived ? 0 : laneCfg.feeCents,
        feeWaived: waived
      };
    });
    const feesCents = laneTotals.reduce((s, l) => s + l.feeCents, 0);
    const discountedSubtotal = Math.max(0, grossSubtotal - discountCents);
    const taxableBaseCents = discountedSubtotal + (cfg.pricing.taxDeliveryFee ? feesCents : 0);
    const taxCents = options.computeTax ? options.computeTax(taxableBaseCents, ctx) : Math.round(taxableBaseCents * cfg.pricing.taxRate);
    const totalCents = discountedSubtotal + feesCents + taxCents;
    const blockers = laneTotals.filter((l) => !l.minimumMet).map((l) => `${ctx.lanes[l.lane]?.label ?? l.lane} is ${fmtShort(l.shortfallCents)} under its minimum`);
    return {
      lanes: laneTotals,
      orderCount: laneTotals.length,
      itemCount: laneTotals.reduce((s, l) => s + l.itemCount, 0),
      subtotalCents: grossSubtotal,
      discounts,
      discountCents,
      feesCents,
      taxableBaseCents,
      taxCents,
      totalCents,
      lineEffectConflicts,
      integrityWarnings: redemptionCoverageGaps(rules, ctx).map((g) => g.message),
      canCheckout: blockers.length === 0 && laneTotals.length > 0,
      blockers
    };
  }
  function fmtShort(cents) {
    return `$${(cents / 100).toFixed(2)}`;
  }
  function staleLineEffects(before, after) {
    const effects = before.lineEffects;
    if (!effects) return [];
    const afterById = new Map(after.lines.map((l) => [l.id, l]));
    const beforeById = new Map(before.lines.map((l) => [l.id, l]));
    const out = [];
    for (const [lineId, effect] of Object.entries(effects)) {
      const was = beforeById.get(lineId);
      if (!was) continue;
      const now = afterById.get(lineId);
      let reason = null;
      if (!now) reason = "line_removed";
      else if (now.productId !== was.productId) reason = "product_changed";
      else if (now.quantity !== was.quantity) reason = "quantity_changed";
      if (reason) {
        out.push({
          lineId,
          promotionKey: effect.promotionKey,
          sourceChannel: effect.sourceChannel,
          reason
        });
      }
    }
    return out;
  }

  // src/core/substitution/candidates.ts
  function isStepUp(current, candidate) {
    const cw = current.sizeGrams;
    const kw = candidate.sizeGrams;
    const bothWeighed = cw != null && kw != null;
    if (bothWeighed) {
      if (kw > cw) return true;
      if (kw < cw) return false;
    }
    if (current.thcPercent != null && candidate.thcPercent != null && candidate.thcPercent > current.thcPercent) {
      return true;
    }
    if (!bothWeighed && current.unitCount != null && candidate.unitCount != null) {
      return candidate.unitCount > current.unitCount;
    }
    return false;
  }
  function buildCandidates(input) {
    const { current, pool, quantity, unitsFor, config: sc } = input;
    const exclude = input.exclude ?? /* @__PURE__ */ new Set();
    const poolLabel = input.poolLabel ?? "this lane";
    const modes = input.modes ?? SWAP_MODES;
    const poolSize = pool.length;
    const needed = sc.onInsufficientQuantity === "offer-partial" ? 1 : quantity;
    const hasStock = pool.filter((p2) => p2.id !== current.id && unitsFor(p2) >= needed);
    const afterQuantityFilter = hasStock.length;
    const usable = sc.excludeItemsAlreadyInCart ? hasStock.filter((p2) => !exclude.has(p2.id)) : hasStock;
    const afterExclusionFilter = usable.length;
    const toCandidate = (p2, mode) => {
      const delta = priceDelta(current, p2);
      const units = unitsFor(p2);
      const fillable = Math.max(0, Math.min(units, quantity));
      return {
        product: p2,
        priceDeltaCents: delta,
        priceDeltaLabel: formatDelta(delta),
        thcDelta: current.thcPercent != null && p2.thcPercent != null ? +(p2.thcPercent - current.thcPercent).toFixed(1) : null,
        unitsAvailable: units,
        fillable,
        partial: fillable < quantity,
        shortfall: Math.max(0, quantity - fillable),
        similarity: +similarityScore(current, p2, sc.similarityWeights).toFixed(4),
        reason: candidateReason(current, p2, mode)
      };
    };
    const byMode = {};
    const perMode = {};
    for (const mode of modes) {
      let excludedByPriceBand = 0;
      let excludedByThreshold = 0;
      let subset;
      if (mode === "similar") {
        const lo = current.price * (1 - sc.similarPriceBand);
        const hi = current.price * (1 + sc.similarPriceBand);
        subset = usable.filter((p2) => {
          const inBand = p2.price >= lo && p2.price <= hi;
          if (!inBand) excludedByPriceBand++;
          return inBand;
        });
      } else if (mode === "cheaper") {
        subset = usable.filter((p2) => {
          const ok = p2.price < current.price;
          if (!ok) excludedByThreshold++;
          return ok;
        });
      } else if (mode === "stronger") {
        const curThc = current.thcPercent ?? 0;
        subset = usable.filter((p2) => {
          const ok = (p2.thcPercent ?? 0) >= curThc + sc.strongerMinThcDelta;
          if (!ok) excludedByThreshold++;
          return ok;
        });
      } else {
        const ceiling = current.price * sc.maxUpgradeMultiple;
        subset = usable.filter((p2) => {
          const ok = p2.price > current.price && p2.price <= ceiling && isStepUp(current, p2);
          if (!ok) excludedByThreshold++;
          return ok;
        });
      }
      let ranked = subset.map((p2) => toCandidate(p2, mode));
      if (mode === "stronger") {
        ranked.sort((a, b) => (b.product.thcPercent ?? 0) - (a.product.thcPercent ?? 0) || b.similarity - a.similarity);
      } else if (mode === "upgrade") {
        ranked.sort((a, b) => a.priceDeltaCents - b.priceDeltaCents || b.similarity - a.similarity);
      } else if (mode === "cheaper" && sc.cheaperSort === "price-asc") {
        ranked.sort((a, b) => a.product.price - b.product.price);
      } else if (mode === "cheaper" && sc.cheaperSort === "savings-desc") {
        ranked.sort((a, b) => a.priceDeltaCents - b.priceDeltaCents);
      } else {
        ranked.sort((a, b) => b.similarity - a.similarity || a.product.price - b.product.price);
      }
      ranked = dedupeCandidates(ranked).slice(0, sc.maxCandidates);
      byMode[mode] = ranked;
      let note;
      if (ranked.length === 0) {
        if (afterQuantityFilter === 0) note = `No ${current.category} is available in ${poolLabel}.`;
        else if (mode === "similar" && excludedByPriceBand > 0) note = `All ${excludedByPriceBand} alternatives fell outside the \xB1${Math.round(sc.similarPriceBand * 100)}% price band \u2014 widen swap.similarPriceBand.`;
        else if (mode === "stronger") note = `Nothing is at least ${sc.strongerMinThcDelta} THC points stronger.`;
        else if (mode === "upgrade") note = `No genuine step up available in ${poolLabel} within ${sc.maxUpgradeMultiple}x the price.`;
        else if (mode === "cheaper") note = `Nothing cheaper in ${current.category} is available in ${poolLabel}.`;
      }
      perMode[mode] = { returned: ranked.length, excludedByPriceBand, excludedByThreshold, ...note ? { note } : {} };
    }
    const total = modes.reduce((n, m) => n + (byMode[m]?.length ?? 0), 0);
    return { byMode, total, diagnostics: { poolSize, afterQuantityFilter, afterExclusionFilter, perMode } };
  }

  // src/core/swap/index.ts
  function planSwap(ctx, request, options = {}) {
    const cfg = options.config ?? defaultConfig;
    const index = options.index ?? asIndex(ctx.snapshot);
    const line = ctx.cart.lines.find((l) => l.id === request.lineId);
    if (!line) return null;
    const current = index.byId.get(line.productId);
    if (!current) return null;
    const requested = request.lanes?.length ? request.lanes.filter((l) => !!ctx.lanes[l]) : [request.lane ?? line.lane];
    const lane = requested.includes(line.lane) ? line.lane : requested[0] ?? line.lane;
    const multi = requested.length > 1;
    const intent = request.intent ?? (lane === line.lane ? "browse" : "faster");
    const unitsAcross = (productId) => Math.max(0, ...requested.map((l) => unitsAvailable(index.snapshot, productId, l)));
    const lanesFor = (productId) => {
      const lanes = requested.filter((l) => unitsAvailable(index.snapshot, productId, l) >= line.quantity);
      const fastest = [...lanes].sort(
        (a, b) => (ctx.lanes[a]?.etaMinutes ?? Infinity) - (ctx.lanes[b]?.etaMinutes ?? Infinity)
      )[0];
      const arrivesIn = lanes.includes(line.lane) ? line.lane : fastest ?? line.lane;
      return { lanes, ...fastest ? { fastest } : {}, arrivesIn };
    };
    const eligibility = laneEligibility(ctx.snapshot, line.productId, lane, line.quantity);
    const pool = index.snapshot.pools?.swap ?? (cfg.swap.restrictToSameCategory ? index.byCategory.get(current.category) ?? [] : index.snapshot.products);
    const built = buildCandidates({
      current,
      pool,
      quantity: line.quantity,
      unitsFor: (p2) => multi ? unitsAcross(p2.id) : unitsAvailable(index.snapshot, p2.id, lane),
      exclude: new Set(ctx.cart.lines.map((l) => l.productId)),
      config: cfg.swap,
      poolLabel: multi ? requested.map((l) => ctx.lanes[l]?.label ?? l).join(" or ") : `${ctx.lanes[lane]?.label ?? lane}`
    });
    const annotate = (list = []) => multi ? list.map((c) => ({ ...c, fulfillment: lanesFor(c.product.id) })) : list;
    const byMode = {
      similar: annotate(built.byMode.similar),
      cheaper: annotate(built.byMode.cheaper),
      stronger: annotate(built.byMode.stronger)
    };
    const emptyMode = () => ({ returned: 0, excludedByPriceBand: 0, excludedByThreshold: 0 });
    const perMode = {
      similar: built.diagnostics.perMode.similar ?? emptyMode(),
      cheaper: built.diagnostics.perMode.cheaper ?? emptyMode(),
      stronger: built.diagnostics.perMode.stronger ?? emptyMode()
    };
    if (cfg.swap.laneMinimumPolicy === "block") {
      const fromCfg = ctx.lanes[line.lane];
      if (fromCfg) {
        const fromLaneWithoutThisLine = ctx.cart.lines.filter((l) => l.lane === line.lane && l.id !== line.id).reduce((sum, l) => {
          const p2 = index.byId.get(l.productId);
          return sum + (p2 ? p2.price * l.quantity : 0);
        }, 0);
        const otherLinesRemain = ctx.cart.lines.some((l) => l.lane === line.lane && l.id !== line.id);
        const survives = (c) => {
          const staysPut = c.fulfillment ? c.fulfillment.arrivesIn === line.lane : lane === line.lane;
          if (staysPut) {
            return fromLaneWithoutThisLine + c.product.price * line.quantity >= fromCfg.minimumCents;
          }
          return !otherLinesRemain || fromLaneWithoutThisLine >= fromCfg.minimumCents;
        };
        for (const mode of SWAP_MODES) {
          const before = byMode[mode] ?? [];
          const after = before.filter(survives);
          byMode[mode] = after;
          if (before.length > 0 && after.length === 0) {
            const d = perMode[mode];
            if (d) d.note = `Every option would leave ${fromCfg.label} under its minimum.`;
          }
        }
      }
    }
    const ageMs = staleness(index.snapshot, ctx.now);
    const diagnostics = {
      ...built.diagnostics,
      perMode,
      afterLaneFilter: built.diagnostics.afterQuantityFilter,
      afterCartFilter: built.diagnostics.afterExclusionFilter,
      availabilityAgeMs: ageMs,
      // ⚙️ TUNE — cfg.swap.maxAvailabilityAgeMs
      stale: ageMs != null && ageMs > cfg.swap.maxAvailabilityAgeMs,
      ...ageMs == null ? { undatedSnapshot: true } : {}
    };
    const candidateCount = SWAP_MODES.reduce((n, m) => n + (byMode[m]?.length ?? 0), 0);
    return {
      lineId: request.lineId,
      intent,
      fromLane: line.lane,
      lane,
      // With several lanes in play the plan itself does not move anything — the
      // CANDIDATE decides, via `fulfillment.fastest`. Only a single-lane request
      // commits the line to a different lane up front.
      changesLane: !multi && lane !== line.lane,
      currentProduct: current,
      quantity: line.quantity,
      sameProductAvailable: eligibility.ok,
      ...eligibility.ok ? {} : { currentProductBlockedBy: eligibility },
      candidatesByMode: byMode,
      candidateCount,
      diagnostics
    };
  }
  function availabilityFromPlan(plan, lanes = defaultConfig.lanes) {
    if (plan.candidateCount === 0 && !plan.sameProductAvailable) {
      const laneLabel = lanes[plan.lane]?.label ?? plan.lane;
      const specific = plan.diagnostics.perMode.similar?.note;
      return {
        offerable: false,
        candidateCount: 0,
        sameProductAvailable: false,
        reason: specific ?? `Nothing in ${plan.currentProduct.category} is available for ${laneLabel}`
      };
    }
    return {
      offerable: plan.candidateCount > 0 || plan.sameProductAvailable,
      candidateCount: plan.candidateCount,
      sameProductAvailable: plan.sameProductAvailable
    };
  }
  function canSwap(ctx, lineId, lane, options = {}) {
    const plan = planSwap(ctx, { lineId, ...lane ? { lane } : {} }, options);
    if (!plan) {
      return { offerable: false, candidateCount: 0, sameProductAvailable: false, reason: "Line not found" };
    }
    return availabilityFromPlan(plan, ctx.lanes);
  }
  function moveLane(ctx, lineId, toLane) {
    const line = ctx.cart.lines.find((l) => l.id === lineId);
    if (!line) return null;
    const eligibility = laneEligibility(ctx.snapshot, line.productId, toLane, line.quantity);
    if (!eligibility.ok) return { kind: "not_available", blockedBy: eligibility };
    return { kind: "moved", cart: setLineLane(ctx.cart, lineId, toLane) };
  }
  function setLineLane(cart, lineId, lane) {
    return { ...cart, lines: cart.lines.map((l) => l.id === lineId ? { ...l, lane } : l) };
  }
  function applySwap(cart, lineId, candidate, lane) {
    if (candidate.partial) return applyPartialSwap(cart, lineId, candidate, candidate.fillable, lane);
    return {
      ...cart,
      lines: cart.lines.map((l) => l.id === lineId ? {
        ...l,
        productId: candidate.product.id,
        ...lane ? { lane } : {},
        swappedFromProductId: l.productId
      } : l)
    };
  }
  function splitLineId(lineId, productId, taken) {
    const base = `${lineId}+${productId}`;
    if (!taken.has(base)) return base;
    for (let n = 2; ; n++) {
      const next = `${base}#${n}`;
      if (!taken.has(next)) return next;
    }
  }
  function applyPartialSwap(cart, lineId, candidate, units, lane) {
    const line = cart.lines.find((l) => l.id === lineId);
    if (!line) return cart;
    const take = Math.max(0, Math.min(Math.floor(units), candidate.fillable, line.quantity));
    if (take === 0) return cart;
    if (take >= line.quantity) {
      return {
        ...cart,
        lines: cart.lines.map((l) => l.id === lineId ? { ...l, productId: candidate.product.id, ...lane ? { lane } : {}, swappedFromProductId: l.productId } : l)
      };
    }
    const newId = splitLineId(lineId, candidate.product.id, new Set(cart.lines.map((l) => l.id)));
    const swapped = {
      id: newId,
      productId: candidate.product.id,
      quantity: take,
      lane: lane ?? line.lane,
      swappedFromProductId: line.productId
    };
    const lines = [];
    for (const l of cart.lines) {
      if (l.id !== lineId) {
        lines.push(l);
        continue;
      }
      lines.push({ ...l, quantity: l.quantity - take });
      lines.push(swapped);
    }
    return { ...cart, lines };
  }
  function planPartialSwap(ctx, lineId, candidate, options = {}) {
    const cfg = options.config ?? defaultConfig;
    const index = options.index ?? asIndex(ctx.snapshot);
    const line = ctx.cart.lines.find((l) => l.id === lineId);
    if (!line) return null;
    const current = index.byId.get(line.productId);
    if (!current) return null;
    const swapUnits = Math.max(0, Math.min(
      Math.floor(options.units ?? candidate.fillable),
      candidate.fillable,
      line.quantity
    ));
    if (swapUnits === 0) return null;
    const remainderUnits = line.quantity - swapUnits;
    const swapLane = options.lane ?? line.lane;
    const afterCart = applyPartialSwap(ctx.cart, lineId, candidate, swapUnits, options.lane);
    const lines = afterCart.lines;
    const invalidated = staleLineEffects(ctx.cart, afterCart);
    const swapSubtotalCents = candidate.product.price * swapUnits;
    const remainderSubtotalCents = current.price * remainderUnits;
    const deltaCents = swapSubtotalCents + remainderSubtotalCents - current.price * line.quantity;
    let remainderAlternatives = [];
    let remainderNote;
    if (remainderUnits === 0) {
      remainderNote = "Nothing left over \u2014 the swap covers the line.";
    } else {
      const pool = index.snapshot.pools?.swap ?? (cfg.swap.restrictToSameCategory ? index.byCategory.get(current.category) ?? [] : index.snapshot.products);
      const built = buildCandidates({
        current,
        pool,
        // The leftover is what needs covering now — a product that could not fill
        // 3 may comfortably fill 1, and excluding it would hide the best answer.
        quantity: remainderUnits,
        unitsFor: (p2) => unitsAvailable(index.snapshot, p2.id, line.lane),
        exclude: /* @__PURE__ */ new Set([
          ...ctx.cart.lines.map((l) => l.productId),
          candidate.product.id
          // already taken by the other half of this split
        ]),
        config: cfg.swap,
        poolLabel: `${ctx.lanes[line.lane]?.label ?? line.lane}`
      });
      remainderAlternatives = dedupeCandidates(
        SWAP_MODES.flatMap((m) => built.byMode[m] ?? [])
      ).slice(0, cfg.swap.maxCandidates);
      if (remainderAlternatives.length === 0) {
        remainderNote = `Nothing else in ${current.category} is available for ${ctx.lanes[line.lane]?.label ?? line.lane}.`;
      }
    }
    return {
      lineId,
      currentProduct: current,
      candidate,
      quantity: line.quantity,
      swapUnits,
      remainderUnits,
      fromLane: line.lane,
      swapLane,
      lines,
      swapSubtotalCents,
      remainderSubtotalCents,
      deltaCents,
      remainderAlternatives,
      ...remainderNote ? { remainderNote } : {},
      invalidatedLineEffects: invalidated,
      requiresRequote: invalidated.length > 0
    };
  }
  function previewSwap(ctx, plan, candidate, options = {}) {
    const cfg = options.config ?? defaultConfig;
    const rules = options.rules ?? [];
    const index = options.index ?? asIndex(ctx.snapshot);
    const after = applySwap(
      ctx.cart,
      plan.lineId,
      candidate,
      plan.changesLane ? plan.lane : void 0
    );
    const ctxAfter = { ...ctx, cart: after };
    const valueOf = (r, c) => evaluateRule(r, c, {}, index).satisfied ? estimateRewardValue(r.reward, c, index) : null;
    const promotionsLost = [];
    const promotionsGained = [];
    for (const r of rules) {
      const before = valueOf(r, ctx);
      const now = valueOf(r, ctxAfter);
      if (before != null && now == null) promotionsLost.push({ ruleId: r.id, name: r.name, valueCents: before });
      if (before == null && now != null) promotionsGained.push({ ruleId: r.id, name: r.name, valueCents: now });
    }
    const laneMinimumsBroken = [];
    for (const lane of lanesOf(ctx)) {
      const laneCfg = ctx.lanes[lane];
      if (!laneCfg) continue;
      const hadItems = ctx.cart.lines.some((l) => l.lane === lane);
      const hasItems = after.lines.some((l) => l.lane === lane);
      if (!hasItems) continue;
      const beforeSub = subtotalCents(ctx, index, lane);
      const afterSub = subtotalCents(ctxAfter, index, lane);
      const wasMet = !hadItems || beforeSub >= laneCfg.minimumCents;
      if (wasMet && afterSub < laneCfg.minimumCents) {
        laneMinimumsBroken.push({ lane, shortfallCents: laneCfg.minimumCents - afterSub });
      }
    }
    return {
      promotionsLost,
      promotionsGained,
      laneMinimumsBroken,
      invalidatedLineEffects: staleLineEffects(ctx.cart, after),
      subtotalDeltaCents: subtotalCents(ctxAfter, index) - subtotalCents(ctx, index)
    };
  }
  function planLaneMove(ctx, lineId, toLane, options = {}) {
    const cfg = options.config ?? defaultConfig;
    const index = options.index ?? asIndex(ctx.snapshot);
    const line = ctx.cart.lines.find((l) => l.id === lineId);
    if (!line) return null;
    const fromCfg = ctx.lanes[line.lane];
    const toCfg = ctx.lanes[toLane];
    if (!fromCfg || !toCfg) return null;
    const value = (l) => {
      const p2 = index.byId.get(l.productId);
      return p2 ? p2.price * l.quantity : 0;
    };
    const sourceLines = ctx.cart.lines.filter((l) => l.lane === line.lane);
    const others = sourceLines.filter((l) => l.id !== lineId);
    const remaining = others.reduce((sum, l) => sum + value(l), 0);
    const sourceAfter = {
      lane: line.lane,
      linesRemaining: others.length,
      subtotalCents: remaining,
      minimumCents: fromCfg.minimumCents,
      // An emptied lane places no order, so it cannot be under anything.
      meetsMinimum: others.length === 0 || remaining >= fromCfg.minimumCents,
      shortfallCents: others.length === 0 ? 0 : Math.max(0, fromCfg.minimumCents - remaining)
    };
    const targetLines = ctx.cart.lines.filter((l) => l.lane === toLane);
    const targetWithLine = targetLines.reduce((sum, l) => sum + value(l), 0) + value(line);
    const targetAfter = {
      lane: toLane,
      linesRemaining: targetLines.length + 1,
      subtotalCents: targetWithLine,
      minimumCents: toCfg.minimumCents,
      meetsMinimum: targetWithLine >= toCfg.minimumCents,
      shortfallCents: Math.max(0, toCfg.minimumCents - targetWithLine)
    };
    const possible = canFulfil(ctx.snapshot, line.productId, toLane, line.quantity);
    const toAlreadyOpen = ctx.cart.lines.some((l) => l.lane === toLane);
    const feeIfOpened = toAlreadyOpen ? 0 : toCfg.feeCents;
    const opts = [];
    if (possible) {
      opts.push({
        kind: "move_line",
        lineIds: [lineId],
        // Either end can be left short, and both block checkout equally.
        strands: !sourceAfter.meetsMinimum || !targetAfter.meetsMinimum,
        shortfallCents: Math.max(sourceAfter.shortfallCents, targetAfter.shortfallCents),
        addedFeeCents: feeIfOpened
      });
    }
    const oneLineStrands = !sourceAfter.meetsMinimum || !targetAfter.meetsMinimum;
    if (oneLineStrands && others.length > 0) {
      const allMovable = sourceLines.every((l) => canFulfil(ctx.snapshot, l.productId, toLane, l.quantity));
      const allValue = sourceLines.reduce((sum, l) => sum + value(l), 0);
      const resolves = targetLines.reduce((sum, l) => sum + value(l), 0) + allValue >= toCfg.minimumCents;
      if (allMovable && resolves) {
        opts.push({
          kind: "move_whole_lane",
          lineIds: sourceLines.map((l) => l.id),
          strands: false,
          shortfallCents: 0,
          addedFeeCents: feeIfOpened
        });
      }
    }
    opts.push({ kind: "keep", lineIds: [], strands: false, shortfallCents: 0, addedFeeCents: 0 });
    return { lineId, fromLane: line.lane, toLane, possible, sourceAfter, targetAfter, options: opts };
  }
  function applyLaneMove(cart, option, toLane) {
    if (option.lineIds.length === 0) return cart;
    const moving = new Set(option.lineIds);
    return { ...cart, lines: cart.lines.map((l) => moving.has(l.id) ? { ...l, lane: toLane } : l) };
  }
  function planLaneMigration(ctx, fromLane, toLane, options = {}) {
    const cfg = options.config ?? defaultConfig;
    const index = options.index ?? asIndex(ctx.snapshot);
    const fromCfg = ctx.lanes[fromLane];
    const toCfg = ctx.lanes[toLane];
    if (!fromCfg || !toCfg) return null;
    const lines = ctx.cart.lines.filter((l) => l.lane === fromLane);
    if (lines.length === 0) return null;
    const value = (l) => {
      const p2 = index.byId.get(l.productId);
      return p2 ? p2.price * l.quantity : 0;
    };
    const movable = [];
    const blocked = [];
    for (const l of lines) {
      const el = laneEligibility(ctx.snapshot, l.productId, toLane, l.quantity);
      if (el.ok) {
        movable.push(l.id);
        continue;
      }
      const p2 = index.byId.get(l.productId);
      const inCart = new Set(ctx.cart.lines.map((x) => x.productId));
      const hasAlternatives = (index.byCategory.get(p2?.category ?? "") ?? []).some(
        (alt) => alt.id !== l.productId && !inCart.has(alt.id) && unitsAvailable(ctx.snapshot, alt.id, toLane) >= l.quantity
      );
      blocked.push({
        lineId: l.id,
        productId: l.productId,
        productName: p2 ? `${p2.brand} ${p2.name}` : l.productId,
        reason: el.reason,
        unitsAvailable: el.units,
        needed: el.needed,
        hasAlternatives
      });
    }
    const movingValue = lines.filter((l) => movable.includes(l.id)).reduce((s, l) => s + value(l), 0);
    const stayingValue = lines.filter((l) => !movable.includes(l.id)).reduce((s, l) => s + value(l), 0);
    const targetExisting = ctx.cart.lines.filter((l) => l.lane === toLane).reduce((s, l) => s + value(l), 0);
    const targetSubtotalAfterCents = targetExisting + movingValue;
    const sourceSubtotalAfterCents = stayingValue;
    const anythingLeft = blocked.length > 0;
    return {
      fromLane,
      toLane,
      movable,
      blocked,
      allMovable: blocked.length === 0,
      noneMovable: movable.length === 0,
      targetSubtotalAfterCents,
      sourceSubtotalAfterCents,
      sourceStranded: anythingLeft && sourceSubtotalAfterCents < fromCfg.minimumCents,
      targetStranded: movable.length > 0 && targetSubtotalAfterCents < toCfg.minimumCents,
      addedFeeCents: ctx.cart.lines.some((l) => l.lane === toLane) ? 0 : toCfg.feeCents
    };
  }
  function applyLaneMigration(cart, plan) {
    const moving = new Set(plan.movable);
    return { ...cart, lines: cart.lines.map((l) => moving.has(l.id) ? { ...l, lane: plan.toLane } : l) };
  }

  // src/core/upsell/index.ts
  function laneFor(ctx, options) {
    if (options.lane) return options.lane;
    const counts = {};
    for (const l of ctx.cart.lines) counts[l.lane] = (counts[l.lane] ?? 0) + l.quantity;
    const entries = Object.entries(counts);
    if (entries.length === 0) return void 0;
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0]?.[0];
  }
  function availableFor(index, productId, lane, qty, lanes) {
    if (lane) return unitsAvailable(index.snapshot, productId, lane) >= qty;
    return lanes.some((l) => unitsAvailable(index.snapshot, productId, l) >= qty);
  }
  function gapPool(index) {
    return index.snapshot.pools?.gapClosers ?? index.snapshot.products;
  }
  function recPool(index) {
    return index.snapshot.pools?.recommendations ?? index.snapshot.products;
  }
  function productClosingGap(gap, ctx, index, lane, cfg) {
    const respectLane = cfg.upsell.respectLaneAvailability;
    const inCart = new Set(ctx.cart.lines.map((l) => l.productId));
    const offered = lanesOf(ctx);
    const usable = (p2, qty) => !inCart.has(p2.id) && (!respectLane || availableFor(index, p2.id, gap.kind === "items" ? gap.lane ?? lane : lane, qty, offered));
    switch (gap.kind) {
      case "spend": {
        const eligible = gapPool(index).filter((p2) => p2.price >= gap.amountCents && usable(p2, 1)).sort((a, b) => a.price - b.price);
        const pick = eligible[0];
        return pick ? { product: pick, quantity: 1 } : null;
      }
      case "items": {
        const qty = Math.max(1, gap.count);
        const eligible = gapPool(index).filter((p2) => matchesFilter(p2, gap.filter) && usable(p2, qty)).sort((a, b) => a.price - b.price);
        const pick = eligible[0];
        return pick ? { product: pick, quantity: qty } : null;
      }
      case "distinct_categories": {
        const have = /* @__PURE__ */ new Set();
        for (const l of ctx.cart.lines) {
          const p2 = index.byId.get(l.productId);
          if (p2) have.add(p2.category);
        }
        const eligible = gapPool(index).filter((p2) => !have.has(p2.category) && usable(p2, 1)).sort((a, b) => a.price - b.price);
        const pick = eligible[0];
        return pick ? { product: pick, quantity: 1 } : null;
      }
      case "unreachable":
        return null;
    }
  }
  function withAdded(cart, product, quantity, lane) {
    return {
      ...cart,
      lines: [...cart.lines, { id: `__projected__${product.id}`, productId: product.id, quantity, lane }]
    };
  }
  function offerFromRule(rule, ctx, surface, options = {}) {
    const cfg = options.config ?? defaultConfig;
    const index = options.index ?? asIndex(ctx.snapshot);
    if (!rule.upsell?.enabled) return null;
    if (rule.upsell.surfaces && !rule.upsell.surfaces.includes(surface)) return null;
    if (!isRuleOnChannel(rule, ctx)) return null;
    if (!isRuleAvailableToCustomer(rule, ctx)) return null;
    const result = evaluateRule(rule, ctx, {}, index);
    if (result.satisfied) return null;
    if (result.blockedByUnreachable && rule.combiner === "AND") return null;
    if (result.closableGaps.length === 0) return null;
    const candidateGaps = rule.combiner === "AND" ? result.closableGaps.length === 1 ? result.closableGaps : [] : result.closableGaps;
    if (candidateGaps.length === 0) return null;
    const lane = laneFor(ctx, options);
    let best = null;
    for (const gap of candidateGaps) {
      const pick = productClosingGap(gap, ctx, index, lane, cfg);
      if (!pick) continue;
      const addCostCents = pick.product.price * pick.quantity;
      const projectedLane = gap.kind !== "unreachable" && "lane" in gap && gap.lane || lane || "scheduled";
      const projected = { ...ctx, cart: withAdded(ctx.cart, pick.product, pick.quantity, projectedLane) };
      if (!evaluateRule(rule, projected, {}, index).satisfied) continue;
      const rewardValueCents = estimateRewardValue(rule.reward, projected, index, { neverDiscountSaleItems: cfg.pricing.neverDiscountSaleItems });
      if (rewardValueCents <= 0) continue;
      if (addCostCents > rewardValueCents * cfg.upsell.maxSpendToRewardRatio) continue;
      const headline = rule.upsell.headline ?? `Unlock ${money(rewardValueCents)} off`;
      const subline = rule.upsell.subline ?? defaultSubline(gap, pick.product, pick.quantity);
      const offer = {
        id: `unlock:${rule.id}:${pick.product.id}`,
        kind: "unlock_promotion",
        surface,
        product: pick.product,
        quantity: pick.quantity,
        headline,
        subline,
        reason: rule.name,
        score: cfg.upsell.weights.unlocksPromotion + rewardValueCents / 1e3,
        ...lane ? { lane } : {},
        unlock: {
          ruleId: rule.id,
          ruleName: rule.name,
          rewardValueCents,
          addCostCents,
          netCents: rewardValueCents - addCostCents,
          gap
        }
      };
      if (!best || offer.score > best.offer.score) best = { offer };
    }
    return best?.offer ?? null;
  }
  function defaultSubline(gap, product, quantity) {
    switch (gap.kind) {
      case "spend":
        return `Add ${money(gap.amountCents)} more to save`;
      case "items":
        return quantity === 1 ? `Add ${product.name} to save` : `Add ${quantity} to save`;
      case "distinct_categories":
        return "Add one more category to save";
      case "unreachable":
        return "";
    }
  }
  function scoreRecommendations(ctx, index, lane, cfg, exclude) {
    const offeredLanes = lanesOf(ctx);
    const w = cfg.upsell.weights;
    const cust = ctx.customer;
    const cartProducts = ctx.cart.lines.map((l) => index.byId.get(l.productId)).filter((p2) => !!p2);
    const cartCategories = [...new Set(cartProducts.map((p2) => p2.category))];
    const wantedCategories = /* @__PURE__ */ new Set();
    for (const c of cartCategories) {
      for (const target of cfg.upsell.categoryAffinity[c] ?? []) wantedCategories.add(target);
    }
    const inCart = new Set(ctx.cart.lines.map((l) => l.productId));
    const out = [];
    for (const p2 of recPool(index)) {
      if (inCart.has(p2.id) || exclude.has(p2.id)) continue;
      if (cfg.upsell.respectLaneAvailability && !availableFor(index, p2.id, lane, 1, offeredLanes)) continue;
      let score = 0;
      let kind = "popular";
      let reason = "Popular right now";
      if (cust?.favoriteCategories?.includes(p2.category)) {
        score += w.favoriteCategory;
        kind = "favorite_category";
        reason = `Usually buys ${p2.category}`;
      }
      if (wantedCategories.has(p2.category)) {
        score += w.categoryAffinity;
        if (kind === "popular") {
          kind = "pairs_with";
          reason = `Pairs with your ${cartProducts[0]?.name ?? cartCategories[0] ?? "order"}`;
        }
      }
      if (p2.compareAtPrice != null) {
        score += w.onSale;
        if (kind === "popular") {
          kind = "on_sale";
          reason = "On sale now";
        }
      }
      if (cust?.purchasedBrands?.includes(p2.brand)) {
        score += w.knownBrand;
        if (kind === "popular") {
          kind = "known_brand";
          reason = `You've bought ${p2.brand} before`;
        }
      }
      if ((p2.thcPercent ?? 0) >= 25) score += w.potency;
      if ((p2.velocityPerDay ?? 0) > 0) score += Math.min(2, (p2.velocityPerDay ?? 0) / 10) * w.inventoryDepth;
      if (p2.marginPct != null) score += p2.marginPct / 100 * w.margin;
      if (score > 0) out.push({ product: p2, score, kind, reason });
    }
    return out.sort((a, b) => b.score - a.score || b.product.price - a.product.price);
  }
  function getUpsells(ctx, surface, options = {}) {
    const cfg = options.config ?? defaultConfig;
    const index = options.index ?? asIndex(ctx.snapshot);
    const lane = laneFor(ctx, options);
    const slots = cfg.upsell.slotsBySurface[surface] ?? 0;
    if (slots <= 0) return [];
    const dismissed = new Set(options.dismissed ?? []);
    const impressions = options.impressions ?? {};
    const excluded = new Set(options.excludeProductIds ?? []);
    const suppressed = (id) => dismissed.has(id) || (impressions[id] ?? 0) >= cfg.upsell.maxImpressionsPerOffer;
    const offers = [];
    for (const rule of options.rules ?? []) {
      const offer = offerFromRule(rule, ctx, surface, { ...options, config: cfg, index });
      if (!offer) continue;
      if (excluded.has(offer.product.id) || suppressed(offer.id)) continue;
      offers.push(offer);
    }
    if (offers.length < slots) {
      const usedProducts = new Set(offers.map((o) => o.product.id));
      const recs = scoreRecommendations(ctx, index, lane, cfg, /* @__PURE__ */ new Set([...excluded, ...usedProducts]));
      for (const r of recs) {
        if (offers.length >= slots) break;
        const id = `rec:${r.kind}:${r.product.id}`;
        if (suppressed(id)) continue;
        offers.push({
          id,
          kind: r.kind,
          surface,
          product: r.product,
          quantity: 1,
          headline: r.product.name,
          subline: `${r.product.brand} \xB7 ${money(r.product.price)}`,
          reason: r.reason,
          score: r.score,
          ...lane ? { lane } : {}
        });
      }
    }
    return offers.sort((a, b) => b.score - a.score).slice(0, slots);
  }
  function promotionProgress(ctx, rules, options = {}) {
    const index = options.index ?? asIndex(ctx.snapshot);
    return rules.map((rule) => {
      const r = evaluateRule(rule, ctx, {}, index);
      return {
        rule,
        satisfied: r.satisfied,
        gaps: r.closableGaps,
        valueCents: r.satisfied ? estimateRewardValue(rule.reward, ctx, index) : 0
      };
    });
  }

  // src/core/fulfillment/types.ts
  var SUBSTITUTION_REASONS = {
    customer_upgraded: "Customer took an upgrade",
    customer_request: "Customer asked",
    out_of_stock_in_kit: "Not in the kit",
    damaged: "Damaged",
    wrong_item_picked: "Wrong item picked",
    expired: "Expired / past date",
    compliance_hold: "Compliance hold",
    other: "Other"
  };
  var REASONS_BY_INTENT = {
    upsell: ["customer_upgraded", "customer_request"],
    replacement: ["out_of_stock_in_kit", "damaged", "wrong_item_picked", "expired", "compliance_hold", "other"]
  };

  // src/core/fulfillment/policy.ts
  var defaultFulfillmentPolicy = {
    priceDelta: "any_reconcile_at_closeout",
    authority: "driver_or_support_anytime",
    driverApprovalThresholdCents: 0,
    consent: "verbal_ok",
    // Level 1 — driver attests. One tap.
    cutoff: "delivered",
    allowCrossKitSubstitution: false,
    blockIfPromotionBroken: false,
    maxKitAgeMs: 10 * 6e4
  };
  function makeFulfillmentPolicy(overrides = {}) {
    return { ...defaultFulfillmentPolicy, ...overrides };
  }
  var STATUS_ORDER = ["submitted", "assigned", "picked", "en_route", "delivered", "cancelled"];
  function checkOrderState(order, policy) {
    if (order.status === "cancelled") {
      return { code: "order_cancelled", message: "This order was cancelled." };
    }
    const at = STATUS_ORDER.indexOf(order.status);
    const cut = STATUS_ORDER.indexOf(policy.cutoff);
    if (at >= cut) {
      return {
        code: "order_past_cutoff",
        message: `Order is ${order.status}. Past ${policy.cutoff}, a change is a return/exchange, not a substitution.`
      };
    }
    return null;
  }
  function checkActor(order, actor, policy) {
    if (actor.kind === "system") {
      return { code: "actor_not_permitted", message: "Automated processes may not substitute on a live order." };
    }
    if (actor.kind === "driver") {
      if (policy.authority === "support_only") {
        return { code: "actor_not_permitted", message: "Substitutions are handled by the support desk." };
      }
      if (!policy.allowCrossKitSubstitution && order.assignedKitId && actor.kitId !== order.assignedKitId) {
        return {
          code: "wrong_kit",
          message: `This order is on kit ${order.assignedKitId}; you are carrying ${actor.kitId}. You cannot hand over stock you do not have.`
        };
      }
      if (!order.assignedKitId) {
        return { code: "order_unassigned", message: "This order has no kit assigned yet." };
      }
    }
    return null;
  }
  function judgeCandidate(input) {
    const { actor, policy, paymentMethod, lineDeltaCents, promotionsBroken, kitAgeMs } = input;
    const warnings = [];
    const increases = lineDeltaCents > 0;
    if (increases) {
      if (policy.priceDelta === "never_increase") {
        return { allowed: false, requiresApproval: false, requiresPromotionAcknowledgement: false, warnings, blockedReason: "This costs more than the item it replaces." };
      }
      if (policy.priceDelta === "increase_needs_cash" && paymentMethod !== "cash") {
        return { allowed: false, requiresApproval: false, requiresPromotionAcknowledgement: false, warnings, blockedReason: "Upcharges are cash-only and this order is not cash." };
      }
      if (policy.priceDelta === "increase_needs_card_reauth" && paymentMethod !== "card") {
        return { allowed: false, requiresApproval: false, requiresPromotionAcknowledgement: false, warnings, blockedReason: "Upcharges need a card to re-authorize." };
      }
    }
    let requiresPromotionAcknowledgement = false;
    if (promotionsBroken > 0) {
      if (policy.blockIfPromotionBroken) {
        return {
          allowed: false,
          requiresApproval: false,
          requiresPromotionAcknowledgement: false,
          warnings,
          blockedReason: `This removes ${promotionsBroken} promotion(s) the customer already received.`
        };
      }
      requiresPromotionAcknowledgement = true;
      warnings.push(
        `Removes ${promotionsBroken} promotion(s) the customer already earned. Their total will be recalculated without it.`
      );
    }
    let requiresApproval = false;
    if (actor.kind === "driver") {
      if (policy.authority === "support_approves_all") requiresApproval = true;
      if (policy.authority === "driver_free_below_threshold" && lineDeltaCents > policy.driverApprovalThresholdCents) {
        requiresApproval = true;
      }
    }
    if (kitAgeMs != null && kitAgeMs > policy.maxKitAgeMs) {
      warnings.push(`Kit data is ${Math.round(kitAgeMs / 6e4)} min old \u2014 confirm the item is physically there.`);
    }
    if (kitAgeMs == null) {
      warnings.push("Kit data is undated \u2014 freshness cannot be checked.");
    }
    if (increases && policy.priceDelta === "any_reconcile_at_closeout") {
      warnings.push("Price increase will be squared up at end of shift, not at the door.");
    }
    return { allowed: true, requiresApproval, requiresPromotionAcknowledgement, warnings };
  }
  function settlementFor(policy, paymentMethod, deltaCents) {
    if (deltaCents === 0) return "none";
    switch (policy.priceDelta) {
      case "any_reconcile_at_closeout":
        return "closeout_reconciliation";
      case "never_increase":
        return paymentMethod === "cash" ? "driver_refunds_cash" : "card_adjustment";
      case "increase_needs_cash":
        return deltaCents > 0 ? "driver_collects_cash" : "driver_refunds_cash";
      case "increase_needs_card_reauth":
        return "card_adjustment";
    }
  }
  function requiredConsent(policy) {
    switch (policy.consent) {
      case "notify_only":
        return null;
      case "verbal_ok":
        return "driver_verbal";
      case "customer_must_confirm":
        return "customer_confirmed";
    }
  }

  // src/core/fulfillment/substitute.ts
  function planOrderSubstitution(input) {
    const {
      order,
      kit,
      lineId,
      actor,
      products,
      now,
      intent = "upsell",
      rules = [],
      policy = defaultFulfillmentPolicy,
      config = defaultConfig,
      modes = UPSELL_MODES
    } = input;
    const line = order.lines.find((l) => l.id === lineId);
    if (!line) return null;
    const byId = new Map(products.map((p2) => [p2.id, p2]));
    const current = byId.get(line.productId);
    if (!current) return null;
    const kitAgeMs = kit.asOf ? now.getTime() - Date.parse(kit.asOf) : null;
    const empty = (blocked) => ({
      orderId: order.id,
      lineId,
      intent,
      actor,
      currentProduct: current,
      quantity: line.quantity,
      kitId: kit.kitId,
      blocked,
      candidatesByMode: {},
      candidateCount: 0,
      diagnostics: { poolSize: 0, afterQuantityFilter: 0, afterExclusionFilter: 0, perMode: {}, kitAgeMs }
    });
    const stateBlock = checkOrderState(order, policy);
    if (stateBlock) return empty(stateBlock);
    const actorBlock = checkActor(order, actor, policy);
    if (actorBlock) return empty(actorBlock);
    const inKit = products.filter((p2) => (kit.units[p2.id] ?? 0) > 0);
    const pool = config.swap.restrictToSameCategory ? inKit.filter((p2) => p2.category === current.category) : inKit;
    const built = buildCandidates({
      current,
      pool,
      quantity: line.quantity,
      unitsFor: (p2) => kit.units[p2.id] ?? 0,
      exclude: new Set(order.lines.map((l) => l.productId)),
      config: config.swap,
      poolLabel: "this kit",
      modes
    });
    const byMode = {};
    let candidateCount = 0;
    for (const mode of modes) {
      const judged = [];
      for (const c of built.byMode[mode] ?? []) {
        const money2 = priceSubstitution({ order, line, replacement: c.product, products, rules, policy, now });
        const verdict = judgeCandidate({
          actor,
          policy,
          paymentMethod: order.paymentMethod,
          lineDeltaCents: money2.lineDeltaCents,
          promotionsBroken: money2.promotionsBroken.length,
          kitAgeMs
        });
        if (!verdict.allowed) continue;
        judged.push({ ...c, money: money2, verdict });
      }
      byMode[mode] = judged;
      candidateCount += judged.length;
    }
    return {
      orderId: order.id,
      lineId,
      intent,
      actor,
      currentProduct: current,
      quantity: line.quantity,
      kitId: kit.kitId,
      candidatesByMode: byMode,
      candidateCount,
      diagnostics: { ...built.diagnostics, kitAgeMs }
    };
  }
  function priceSubstitution(input) {
    const { order, line, replacement, products, rules, policy, now } = input;
    const lineDeltaCents = (replacement.price - line.unitPriceCents) * line.quantity;
    const promotionsBroken = findBrokenPromotions({ order, line, replacement, products, rules, now });
    const promotionLossCents = promotionsBroken.reduce((s, p2) => s + p2.valueCents, 0);
    const newSubtotal = order.agreed.subtotalCents + lineDeltaCents;
    const newDiscount = Math.max(0, order.agreed.discountCents - promotionLossCents);
    const oldTaxable = Math.max(1, order.agreed.subtotalCents - order.agreed.discountCents);
    const effectiveTaxRate = order.agreed.taxCents / oldTaxable;
    const newTax = Math.round(Math.max(0, newSubtotal - newDiscount) * effectiveTaxRate);
    const newTotalCents = Math.max(0, newSubtotal - newDiscount) + order.agreed.feesCents + newTax;
    const customerOwesDeltaCents = newTotalCents - order.agreed.totalCents;
    return {
      lineDeltaCents,
      newTotalCents,
      customerOwesDeltaCents,
      settlement: settlementFor(policy, order.paymentMethod, customerOwesDeltaCents),
      promotionsBroken,
      promotionLossCents
    };
  }
  function findBrokenPromotions(input) {
    const { order, line, replacement, products, rules, now } = input;
    const applied = new Set(order.appliedPromotionIds ?? []);
    if (applied.size === 0 || rules.length === 0) return [];
    const snapshot = { products: [...products], availability: {} };
    const index = buildIndex(snapshot);
    const toCart = (lines) => ({
      lines: lines.map((l) => ({ id: l.id, productId: l.productId, quantity: l.quantity, lane: order.lane }))
    });
    const base = { snapshot, lanes: {}, now };
    const before = { ...base, cart: toCart(order.lines) };
    const after = {
      ...base,
      cart: toCart(order.lines.map((l) => l.id === line.id ? { ...l, productId: replacement.id } : l))
    };
    const lost = [];
    for (const rule of rules) {
      if (!applied.has(rule.id)) continue;
      const heldBefore = evaluateRule(rule, before, {}, index).satisfied;
      const heldAfter = evaluateRule(rule, after, {}, index).satisfied;
      if (heldBefore && !heldAfter) {
        lost.push({ ruleId: rule.id, name: rule.name, valueCents: estimateRewardValue(rule.reward, before, index) });
      }
    }
    return lost;
  }
  function applyOrderSubstitution(input) {
    const {
      order,
      plan,
      candidate,
      actor,
      reason,
      consent,
      now,
      recordId,
      policy = defaultFulfillmentPolicy,
      acknowledgePromotionLoss = false
    } = input;
    const refuse = (code, message) => ({ ok: false, refusal: { code, message } });
    const stateBlock = checkOrderState(order, policy);
    if (stateBlock) return refuse(stateBlock.code, stateBlock.message);
    const actorBlock = checkActor(order, actor, policy);
    if (actorBlock) return refuse(actorBlock.code, actorBlock.message);
    if (!candidate.verdict.allowed) {
      return refuse("candidate_not_allowed", candidate.verdict.blockedReason ?? "This option is not permitted.");
    }
    if (candidate.money.promotionsBroken.length > 0 && !acknowledgePromotionLoss) {
      const names = candidate.money.promotionsBroken.map((p2) => p2.name).join(", ");
      return refuse(
        "promotion_loss_unacknowledged",
        `This removes ${names}, worth ${(candidate.money.promotionLossCents / 100).toFixed(2)} to the customer. Confirm the customer knows their total changes, then retry with acknowledgePromotionLoss.`
      );
    }
    if (policy.consent === "verbal_ok" && consent.channel === "not_required") {
      return refuse("consent_required", "Confirm the customer agreed to this swap.");
    }
    if (policy.consent === "customer_must_confirm" && consent.channel !== "customer_confirmed") {
      return refuse("consent_required", "The customer must confirm this swap themselves.");
    }
    if (consent.channel === "declined") {
      return refuse("consent_declined", "The customer declined this swap.");
    }
    const line = order.lines.find((l) => l.id === plan.lineId);
    if (!line) return refuse("line_not_found", "That line is no longer on this order.");
    const updated = {
      ...order,
      lines: order.lines.map((l) => l.id === plan.lineId ? {
        ...l,
        productId: candidate.product.id,
        unitPriceCents: candidate.product.price,
        substitutedFromProductId: l.productId
      } : l),
      agreed: {
        ...order.agreed,
        subtotalCents: order.agreed.subtotalCents + candidate.money.lineDeltaCents,
        discountCents: Math.max(0, order.agreed.discountCents - candidate.money.promotionLossCents),
        taxCents: candidate.money.newTotalCents - Math.max(0, order.agreed.subtotalCents + candidate.money.lineDeltaCents - Math.max(0, order.agreed.discountCents - candidate.money.promotionLossCents)) - order.agreed.feesCents,
        totalCents: candidate.money.newTotalCents
      },
      appliedPromotionIds: (order.appliedPromotionIds ?? []).filter((id) => !candidate.money.promotionsBroken.some((p2) => p2.ruleId === id))
    };
    const record = {
      id: recordId,
      orderId: order.id,
      lineId: plan.lineId,
      fromProductId: plan.currentProduct.id,
      fromProductName: `${plan.currentProduct.brand} ${plan.currentProduct.name}`,
      toProductId: candidate.product.id,
      toProductName: `${candidate.product.brand} ${candidate.product.name}`,
      quantity: plan.quantity,
      reason,
      actor,
      consent,
      money: candidate.money,
      orderStatusAtChange: order.status,
      kitId: plan.kitId,
      occurredAt: now.toISOString(),
      warnings: candidate.verdict.warnings
    };
    const inventory = [
      {
        kind: "release",
        kitId: plan.kitId,
        productId: plan.currentProduct.id,
        quantity: plan.quantity,
        note: `Released from order ${order.id} after substitution ${recordId}`
      },
      {
        kind: "allocate",
        kitId: plan.kitId,
        productId: candidate.product.id,
        quantity: plan.quantity,
        note: `Allocated to order ${order.id} by substitution ${recordId}`
      }
    ];
    const reconciliation = candidate.money.customerOwesDeltaCents !== 0 ? {
      orderId: order.id,
      ...order.assignedDriverId ? { driverId: order.assignedDriverId } : {},
      kitId: plan.kitId,
      amountCents: candidate.money.customerOwesDeltaCents,
      paymentMethod: order.paymentMethod,
      settlement: candidate.money.settlement,
      reason: `Substitution ${recordId}: ${record.fromProductName} to ${record.toProductName}`,
      occurredAt: now.toISOString()
    } : void 0;
    const owes = candidate.money.customerOwesDeltaCents;
    const notification = {
      ...order.customerId ? { customerId: order.customerId } : {},
      orderId: order.id,
      purpose: "notify",
      headline: plan.intent === "upsell" ? "Your order was upgraded" : "An item on your order changed",
      body: [
        `${record.fromProductName} is now ${record.toProductName}.`,
        owes > 0 ? `Your total is $${(owes / 100).toFixed(2)} higher.` : owes < 0 ? `Your total is $${(-owes / 100).toFixed(2)} lower.` : "Your total is unchanged.",
        candidate.money.promotionsBroken.length ? `${candidate.money.promotionsBroken.map((p2) => p2.name).join(", ")} no longer applies.` : ""
      ].filter(Boolean).join(" ")
    };
    return {
      ok: true,
      order: updated,
      record,
      intents: { inventory, ...reconciliation ? { reconciliation } : {}, notification }
    };
  }

  // src/fixtures/index.ts
  var p = (id, name, brand, category, priceDollars, extra = {}) => ({
    id,
    sku: id.toUpperCase().replace(/-/g, ""),
    name,
    brand,
    category,
    price: Math.round(priceDollars * 100),
    ...extra
  });
  var DEMO_PRODUCTS = [
    // ── in the Figma cart ─────────────────────────────────────────────────────
    p("blue-dream", "Blue Dream", "Pacific Stone", "Flower", 35, { thcPercent: 24, sizeGrams: 3.5, strainType: "hybrid", marginPct: 48, velocityPerDay: 22 }),
    p("og-kush-pod", "OG Kush 1g Pod", "Coast Cart", "Vapes", 35, { thcPercent: 24, sizeGrams: 1, strainType: "indica", marginPct: 52, velocityPerDay: 18 }),
    p("sunset-sherbet", "Sunset Sherbet", "Pacific Stone", "Flower", 35, { thcPercent: 24, sizeGrams: 3.5, strainType: "hybrid", marginPct: 47, velocityPerDay: 15 }),
    p("live-resin-sugar", "Live Resin Sugar 1g", "Pacific Stone", "Concentrates", 35, { thcPercent: 24, sizeGrams: 1, strainType: "hybrid", marginPct: 55, velocityPerDay: 9 }),
    // ── swap-sheet alternatives (Flower, 3.5g) ────────────────────────────────
    p("do-si-dos", "Do-Si-Dos", "Pacific Stone", "Flower", 45, { thcPercent: 29, sizeGrams: 3.5, strainType: "indica", marginPct: 46, velocityPerDay: 12 }),
    p("wedding-cake", "Wedding Cake", "Alien Labs", "Flower", 70, { thcPercent: 31, sizeGrams: 3.5, strainType: "hybrid", marginPct: 40, velocityPerDay: 8 }),
    p("northern-lights", "Northern Lights", "Almora Farm", "Flower", 40, { thcPercent: 27, sizeGrams: 3.5, strainType: "indica", marginPct: 50, velocityPerDay: 11 }),
    p("zkittlez", "Zkittlez", "Backpack Boyz", "Flower", 12, { thcPercent: 18, sizeGrams: 1, strainType: "hybrid", marginPct: 61, velocityPerDay: 30 }),
    p("gelato-41", "Gelato 41", "Connected", "Flower", 38, { thcPercent: 26, sizeGrams: 3.5, strainType: "hybrid", marginPct: 44, velocityPerDay: 14 }),
    p("gg4", "GG#4", "Claybourne", "Flower", 30, { thcPercent: 23, sizeGrams: 3.5, strainType: "hybrid", marginPct: 53, velocityPerDay: 19 }),
    // ── swap-sheet alternatives (Vapes / Concentrates) ────────────────────────
    p("blue-razz-pod", "Blue Razz 1g Pod", "Stiiizy", "Vapes", 30, { thcPercent: 22, sizeGrams: 1, strainType: "hybrid", marginPct: 54, velocityPerDay: 20 }),
    p("sativa-pod-1g", "Sour Diesel 1g Pod", "Raw Garden", "Vapes", 42, { thcPercent: 28, sizeGrams: 1, strainType: "sativa", marginPct: 45, velocityPerDay: 13 }),
    p("badder-1g", "Live Badder 1g", "Raw Garden", "Concentrates", 42, { thcPercent: 30, sizeGrams: 1, strainType: "indica", marginPct: 48, velocityPerDay: 7 }),
    p("shatter-1g", "Shatter 1g", "Claybourne", "Concentrates", 28, { thcPercent: 21, sizeGrams: 1, strainType: "hybrid", marginPct: 60, velocityPerDay: 10 }),
    // ── a category NO driver carries — proves "Swap to Express" must sometimes
    //    not be offered at all, rather than opening an empty sheet ─────────────
    p("cbd-tincture", "CBD Tincture 30ml", "Papa & Barkley", "Tinctures", 48, { cbdPercent: 30, marginPct: 52, velocityPerDay: 4 }),
    p("sleep-tincture", "Sleep Tincture 30ml", "Dr. Norm's", "Tinctures", 54, { cbdPercent: 25, marginPct: 50, velocityPerDay: 3 }),
    // ── upsell inventory ──────────────────────────────────────────────────────
    p("indica-blunts-2pk", "Indica Blunts 2pk", "Claybourne", "Pre-Rolls", 23, { compareAtPrice: 2800, thcPercent: 26, sizeGrams: 2, tags: ["2pk"], unitCount: 2, strainType: "indica", marginPct: 58, velocityPerDay: 26 }),
    p("mini-j-5pk", "Mini-J 5pk", "Jeeter", "Pre-Rolls", 32, { thcPercent: 25, sizeGrams: 2.5, tags: ["5pk"], unitCount: 5, strainType: "hybrid", marginPct: 49, velocityPerDay: 21 }),
    p("hybrid-preroll-2pk", "Hybrid Pre-Roll 2pk", "Almora Farm", "Pre-Rolls", 26, { thcPercent: 24, sizeGrams: 2, tags: ["2pk"], unitCount: 2, strainType: "hybrid", marginPct: 55, velocityPerDay: 17 }),
    p("510-battery", "510 Battery", "Stiiizy", "Batteries", 15, { marginPct: 70, velocityPerDay: 12 }),
    p("gummies-100mg", "Mixed Berry Gummies 100mg", "Wyld", "Edibles", 22, { marginPct: 57, velocityPerDay: 24 })
  ];
  var DEMO_AVAILABILITY = {
    "blue-dream": { express: 6, scheduled: 40 },
    "og-kush-pod": { express: 4, scheduled: 35 },
    "sunset-sherbet": { express: 0, scheduled: 28 },
    // <- no driver carries it
    "live-resin-sugar": { express: 0, scheduled: 22 },
    // <- ditto
    "do-si-dos": { express: 5, scheduled: 18 },
    "wedding-cake": { express: 2, scheduled: 9 },
    "northern-lights": { express: 7, scheduled: 24 },
    "zkittlez": { express: 11, scheduled: 50 },
    "gelato-41": { express: 3, scheduled: 16 },
    "gg4": { express: 8, scheduled: 30 },
    "blue-razz-pod": { express: 5, scheduled: 20 },
    "sativa-pod-1g": { express: 3, scheduled: 18 },
    "badder-1g": { express: 4, scheduled: 14 },
    "shatter-1g": { express: 6, scheduled: 20 },
    "cbd-tincture": { express: 0, scheduled: 12 },
    // <- store only
    "sleep-tincture": { express: 0, scheduled: 8 },
    // <- store only
    "indica-blunts-2pk": { express: 12, scheduled: 44 },
    "mini-j-5pk": { express: 9, scheduled: 38 },
    "hybrid-preroll-2pk": { express: 6, scheduled: 33 },
    "510-battery": { express: 20, scheduled: 60 },
    "gummies-100mg": { express: 14, scheduled: 41 }
  };
  var DEMO_SNAPSHOT = {
    products: DEMO_PRODUCTS,
    availability: DEMO_AVAILABILITY
  };
  var DEMO_CART = {
    lines: [
      { id: "l1", productId: "blue-dream", quantity: 1, lane: "express" },
      { id: "l2", productId: "og-kush-pod", quantity: 1, lane: "express" },
      { id: "l3", productId: "sunset-sherbet", quantity: 1, lane: "scheduled" },
      { id: "l4", productId: "live-resin-sugar", quantity: 1, lane: "scheduled" }
    ]
  };
  var DEMO_CUSTOMER = {
    id: "cust-1",
    loyaltyTier: "Standard",
    pointsBalance: 1200,
    orderCount: 7,
    lifetimeSpend: 84e3,
    daysSinceLastOrder: 11,
    favoriteCategories: ["Flower"],
    purchasedBrands: ["Pacific Stone", "Claybourne"],
    zoneId: "weho"
  };
  var DEMO_ORDER = {
    id: "HW-40182",
    status: "en_route",
    lane: "express",
    paymentMethod: "cash",
    assignedDriverId: "drv-7",
    assignedKitId: "RC3",
    customerId: "cust-1",
    placedAt: "2026-08-18T17:30:00Z",
    lines: [
      { id: "ol1", productId: "blue-dream", quantity: 1, unitPriceCents: 3500 },
      { id: "ol2", productId: "indica-blunts-2pk", quantity: 1, unitPriceCents: 2300 }
    ],
    appliedPromotionIds: ["preroll-2pk-5off"],
    agreed: { subtotalCents: 5800, discountCents: 500, feesCents: 200, taxCents: 543, totalCents: 6043 }
  };
  var DEMO_KIT = {
    kitId: "RC3",
    driverId: "drv-7",
    asOf: "2026-08-18T17:55:00Z",
    units: {
      "blue-dream": 4,
      "do-si-dos": 3,
      "wedding-cake": 2,
      "northern-lights": 5,
      "gelato-41": 2,
      "gg4": 6,
      "zkittlez": 8,
      "indica-blunts-2pk": 5,
      "mini-j-5pk": 4,
      "hybrid-preroll-2pk": 3,
      "510-battery": 10
    }
  };
  var DEMO_ORDER_RULES = [
    {
      id: "preroll-2pk-5off",
      name: "Add a pre-roll 2pk, save $5",
      status: "live",
      combiner: "AND",
      conditions: [{ id: "cart_contains", filter: { categories: ["Pre-Rolls"], tags: ["2pk"] }, minQuantity: 1 }],
      reward: { kind: "dollar_off_cart", amountCents: 500 }
    }
  ];
  var DEMO_DRIVER = { kind: "driver", id: "drv-7", name: "J. Rivera", kitId: "RC3" };
  var DEMO_SUPPORT = { kind: "support", id: "sup-2", name: "A. Chen" };
  return __toCommonJS(demo_entry_exports);
})();
