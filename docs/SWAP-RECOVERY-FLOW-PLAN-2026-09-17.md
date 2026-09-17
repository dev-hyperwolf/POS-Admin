# Swap Recovery Flow — mis-stocked Express order

**Owner's brief, 2026-09-17 (verbatim):** "express inventory that is shown to the customer is real
live inventory inside of the driver's kit so that should never happen — of course mistakes are made
so let's plan for it, we definitely want to offer 'Swaps' — we built the swaps logic into the demo
of the admin and also the ecommerce — can you please look into that. If the customer places an order
for an item that the driver does not have (completely unacceptable, but if it does happen) then the
support team contacts the customer and updates their order, so the support agent will use the admin
swap flow to update the order for the customer — flow must be smart — look at how the module is
designed."

This is a planning document only. No existing file is edited. All line numbers cite the state of the
repos on 2026-09-17.

**Scope boundary with the sibling plan.** A separate document,
`docs/DISCREPANCY-ATTRIBUTION-AND-SCOREBOARD-PLAN-2026-09-17.md`, covers *why* a kit came up short —
who filled that kit/box, whether the unit was RFID-scanned at fill, whether it sat in the correct
box, whether the driver accepted it at handover (lost in custody vs. never loaded), and the
per-employee scoreboard/retraining signals that evidence feeds. This document does **not** design
that system. Its only obligation to it is: the recovery flow, at the moment a mis-stock is detected
(§2 step 1), **emits one inventory-discrepancy incident** carrying the order id, driver, kit, box,
SKU/batch/unit and whatever door-scan evidence is available at that moment — and hands it off. See
§2 step 1 for exactly what gets emitted and why no fields beyond that are decided here.

---

## 0. The one-paragraph verdict

The **ranking and money engine is real, shared, and heavily tested** — `@hyperwolf/commerce-logic`
(`POS-Admin/shared/commerce-engine.js`, byte-identical to the bundle inside `Swap and Upsell
Engine.html`) already has a purpose-built `replacement` intent with exactly the reason codes this
scenario needs (`out_of_stock_in_kit`, `wrong_item_picked`, …), and the **driver app's** governed
swap sheet (`mobile/screen-task.jsx`) already exercises it end to end with 891 lines of tests. The
**support/admin side does not** — `pos/screen-orders.jsx`'s `SwapPanel` calls the same governed
engine but was wired for upsells only (no reason picker, wrong mode list, no audit-record id), and
the actual LP/dispatch order-detail screen support would use for this call, `logistics/lorder.jsx`'s
`SwapPicker`, bypasses the engine entirely — no kit awareness, no actor check, no audit trail. There
is **no backend at all** in `wm-demo` for any of this: no swap/amendment table, no kit-ledger
persistence beyond an in-memory reducer, no customer-consent capture, and the one legacy Blaze
"update cart" endpoint (`hyperwolf-backend/controllers/blaze/user-cart-controllers.js:923-925`) is a
stub that returns `{message:"success"}` and does nothing. So the plan is: **extend the admin surface
onto the engine that already exists**, and **build the persistence, consent and kit-ledger backend
that has never existed**, rather than inventing new ranking logic.

---

## 1. How the Swap module is designed today

### 1.1 The engine — real, shared, and where it lives

`Swap and Upsell Engine.html` is not a mockup with fake logic behind it. Its `<script>` block is the
built output of a **private source repo**, `dev-hyperwolf/hyperwolf-commerce-logic` (see the file
header shared by both copies: *"BUILT ARTEFACT, DO NOT EDIT BY HAND… Regenerate with `npm run demo`
there; `npm run ship` republishes it here."*, `shared/commerce-engine.js:1-4`). A byte-for-byte diff
of `shared/commerce-engine.js` against the `<script>` block of `Swap and Upsell Engine.html` shows
**zero differences except the header comment** — the demo page and the production bundle are the
same code. This is the single most important fact in this document: nothing about "the ranking" has
to be designed or re-implemented; it has to be **reached from the right screen with the right
inputs.**

### 1.2 Ranking logic — what makes a good swap

`buildCandidates` (`Swap and Upsell Engine.html:~1699-1793`, identical in `commerce-engine.js`) is
the shared core both the cart and the fulfilment flow call:

- **Similarity distance** (`similarityDistance`/`similarityScore`) weighs price, THC%, size (grams),
  brand, strain type and subcategory. Default weights
  (`defaultSwapConfig.similarityWeights`, engine line ~540-547): `price:1, thc:.6, size:.8, brand:.3,
  strainType:.4, subcategory:.5` — price and size dominate; brand matters least.
- **Three ladders, not one list**: `similar` (within a configurable ±price band, default **40%**,
  `similarPriceBand:0.4`), `cheaper` (strictly less, sortable by price-asc or savings-desc), and
  `stronger` (at least `strongerMinThcDelta` THC points above the original, default **2**). A fourth
  ladder, `upgrade`, exists only for the **upsell** intent (a genuine step up in size/potency/pack
  count, capped at `maxUpgradeMultiple` × price, default **2×**).
- **Category-restricted by default** (`restrictToSameCategory:true`) — a Pre-Roll never replaces
  Flower unless a caller deliberately turns this off.
- **Margin, brand affinity, promotion-unlock** are NOT part of swap ranking — those weights
  (`defaultUpsellConfig.weights`, engine line ~558-575: `favoriteCategory, categoryAffinity, onSale,
  knownBrand, potency, inventoryDepth, margin, unlocksPromotion`) belong to a **different** function,
  `getUpsells`, used for merchandising surfaces (cart add-ons, PDP "pairs with"), not for swapping an
  existing line. Conflating the two would let a margin-driven upsell rule sneak into a customer's
  mis-stock recovery, which is why the engine keeps them as two separate call paths.
- **Diagnostics are structured, not just a boolean**: an empty ladder always carries a `note` saying
  *why* (`"All N alternatives fell outside the ±40% price band"`, `"Nothing is at least 2 THC points
  stronger"`, `"No genuine step up available… within 2x the price"`) — this is what lets a screen say
  something better than "no results."

### 1.3 Customer-facing flow (ecommerce / cart)

`planSwap` / `applySwap` / `applyPartialSwap` (engine `~1802-2070`) operate on the **unsubmitted
cart** — nothing has been agreed or charged yet, so there is deliberately **no actor check, no
order-state check, no audit record**. A swap here can also change **lane** (Express ↔ Scheduled),
which the order-level flow cannot. `shared/commerce-adapter.js` (`window.HWSwap`) is the *only* place
this estate's product shape (`p.wt`, `p.thc`, `p.margin`, dollars) is translated into the engine's
shape (`sizeGrams`, `thcPercent`, `marginPct`, integer cents) — `toEngineProduct`
(`commerce-adapter.js:75-100`), with the multi-pack parser (`grams('5x.5g') → 2.5`,
`commerce-adapter.js:44-58`) called out in its own comment as a real bug that was found and fixed
(a `5x.5g` pre-roll pack was silently absent from every "Upgrade" ladder until the parser handled
`NxM g`).

### 1.4 Driver flow — the most complete implementation of the recovery scenario, on the wrong screen

`mobile/screen-task.jsx`'s `MGovernedSwapSheet` (`~line 284-460`) is the **only** screen in the
estate that already does everything the owner is asking for, end to end:

- An explicit **Upgrade / Replacement toggle** (`intent`, lines 476-477) that switches both the
  candidate `modes` (`SWAP_MODES` = similar/cheaper/stronger vs `UPSELL_MODES`) and the **reason
  list** shown to the operator (`REASONS_BY_INTENT[intent]`, line 341).
- A **reason picker** rendered from `ctx.G.REASONS_BY_INTENT` — for `replacement` that is
  `out_of_stock_in_kit / damaged / wrong_item_picked / expired / compliance_hold / other`
  (engine `~2452-2461`) — exactly the vocabulary a mis-stock needs.
- A **soft-hold kit ledger**, `VanLedger` (module scope, `mobile/screen-task.jsx:14-58`), that
  applies the engine's own `intents.inventory` (`release`/`allocate`) to a `localStorage`-backed
  ledger so a unit promised at one stop is gone by the next — explicitly documented as **not**
  writing back into the raw stock table (`DDATA.REGION_STOCK`), because that table is "the van as
  loaded this morning," and the ledger is "loaded minus promised."
- **Idempotent, collision-safe record ids** (`mintRecordId`, lines 60-64) minted at module scope,
  specifically because an earlier attempt minted from a component ref that reset on unmount and
  produced **duplicate ids that silently ate the second swap's audit row**.
- A `committing` ref latch (line 296) guarding against a double-tap filing two records and debiting
  the van twice — found and fixed by an earlier bug.
- **891 lines of tests** (`test/driver-governed-swap.test.mjs`) covering wrong-kit refusal, unattested
  commits, COD pricing direction, one-record-per-swap, scan invalidation on swap, cross-stop kit
  bleed, promotion-loss disclosure, double-tap idempotency, and state isolation between stops/lines.

None of this is demo dressing — it is the real governed engine, exercised thoroughly, just **on the
driver's phone**, not in front of a support agent.

### 1.5 Support/admin flow — the two screens that exist, and their real gaps

Two different screens in the admin surface can already "swap a line," and they are **not the same
quality of implementation**:

**`pos/screen-orders.jsx`'s `SwapPanel`** (`~line 2020-2145`) is wired to the same governed engine
(`window.HWGovern.planGoverned` / `commitGoverned`) and, unlike the driver sheet, already builds its
`actor` as `{kind:'support', id:'pos-user', name:'POS'}` (line ~3335) — meaning `checkActor` never
kit-scopes it (`commerce-governance.js`'s `checkActor` only restricts `actor.kind === 'driver'`; a
`support` actor is **unscoped by design**, per the file's own comment: *"a POS operator is unscoped
by permission (D1) — not carrying a kit"*). That is the right actor shape for this exact scenario.
But the panel itself has three concrete, fixable gaps:

1. **No `intent` or `modes` override** (`pos/screen-orders.jsx:2058-2065`) — `planGoverned` is called
   with no `intent`, so it defaults to `'upsell'` and `modes` default to `E.UPSELL_MODES =
   ['upgrade','stronger','similar']`. The panel's own tab list is
   `[['upgrade','Upgrade'],['similar','Similar'],['cheaper','Cheaper']]` (line 2077) — **the
   "Cheaper" tab can never populate**, because `plan.candidatesByMode.cheaper` does not exist under
   the default modes. This is a real, live bug for exactly the "customer never pays more" case a
   recovery swap needs.
2. **No reason picker** — `commitGoverned` is called with no `reason` (line 2086), so every POS swap
   is filed as `'customer_upgraded'` regardless of what actually happened. A mis-stock recovery filed
   under that reason is a mislabeled audit trail.
3. **No `recordId`** — `commitGoverned({..., recordId: undefined, ...})` (implicit, no `recordId`
   key at all) means every `SubstitutionRecord.id` from this screen is `undefined`. The driver
   screen's own `mintRecordId` fix (§1.4) was never ported here.

**`logistics/lorder.jsx`'s `SwapPicker`** (`~line 113-148`) is the screen that best matches the
owner's mental model of "the support agent updates the order" (it is the LP/dispatch order-detail
view, and `shared/tour-steps.js:351` literally describes it: *"swap any item for a similar, more
potent or cheaper alternative in the same category, with price and THC deltas shown. The person on
the phone can fix the actual problem."*) — but it is **completely ungoverned**:

- It ranks over `window.HW.PRODUCTS` filtered by `qty > 0` and matching category
  (`lorder.jsx:120`) — the **whole regional catalogue**, not the driver's actual kit. It cannot know
  whether the alternative is really in the van.
- `swap()` (`lorder.jsx:322`) is `onItems(o.id, o.items.map(it => it.sku===sku ? {...it, sku:to} :
  it))` — a bare local-state mutation. No actor check, no order-state check, no re-priced totals
  beyond a local tax recompute, no promotion re-evaluation, no settlement figure, no audit record, no
  consent capture.
- It does not call `window.HWGovern` at all, and is not covered by any test.

**Conclusion for §1**: the *engine* is one honest, real, well-tested thing. The *screens* are three
different maturity levels of the same idea — driver (excellent), POS order detail (close, three
concrete bugs), logistics/LP console (the screen the copy already promises, built with none of the
governance). Phase 1 should extend the POS `SwapPanel` pattern (already correctly actor-scoped) to
be reason/mode-complete, then either replace `logistics/lorder.jsx`'s picker with the same governed
component or route LP/dispatch support agents into the POS order-detail screen instead of
maintaining two.

### 1.6 The knobs (what is genuinely tunable, live)

All in `defaultSwapConfig` (engine `~537-554`): `maxCandidates` (5), `similarPriceBand` (0.4),
`similarityWeights` (per-attribute), `restrictToSameCategory` (true), `excludeItemsAlreadyInCart`
(true), `onInsufficientQuantity` (`'exclude'` for cart / `'offer-partial'` for order-level, so a
kit that has 2 of the 3 needed units offers a **partial swap + remainder**), `strongerMinThcDelta`
(2), `maxUpgradeMultiple` (2), `laneMinimumPolicy` (`'advise'`, cart-only). `defaultFulfillmentPolicy`
(engine `~2475-2486`, overridden by `commerce-governance.js:POLICY` per the owner's 2026-08-19
decisions) governs `priceDelta` (`settle_at_door`, not the engine's own default
`any_reconcile_at_closeout`), `authority`, `consent` (`verbal_ok`), `cutoff` (`delivered`),
`allowCrossKitSubstitution` (false), `blockIfPromotionBroken` (false — broken promotions are
**allowed and flagged**, never blocking).

---

## 2. The recovery scenario, end to end

Numbered sequence, with the responsible component. Steps marked **[BUILD]** have no existing
implementation; steps marked **[EXTEND]** reuse real code with fixable gaps; steps marked **[REAL]**
are already production-quality.

1. **Detection — and this is where the recovery flow must EMIT an inventory-discrepancy incident.**
   Three honest sources, none of which exist as a single signal today:
   - Driver scan mismatch at pack/at the door — `mobile/screen-task.jsx`'s per-item barcode scan
     flow already exists and a swap already invalidates prior scans (`test/driver-governed-
     swap.test.mjs:250` — *"a swap invalidates that line's scans"*) — **[REAL]**, but nothing today
     turns "scan came back wrong" into an automatic mis-stock flag; the driver currently has to open
     the swap sheet themselves. **[EXTEND]**
   - Kit-ledger mismatch — would need the persisted, multi-actor kit ledger from step 6 below;
     today's `VanLedger` is per-browser (§1.4), so a mismatch the support agent's screen could see
     independently of the driver's phone does not exist. **[BUILD]**
   - Customer report (calls in saying the driver doesn't have it) — no intake path exists; this
     becomes a manually opened case in the same screen support already uses for other order issues.
     **[BUILD]** (light: a "Report a problem" affordance is enough; no new system).

   **Owner addition, 2026-09-17: every out-of-kit/mis-stock event must be flagged and measured, not
   just recovered.** Whichever of the three sources above fires, detection must **emit one
   inventory-discrepancy incident** — a fire-and-forget event, not a second workflow this document
   designs — carrying at minimum: `orderId`, the assigned `driverId`/kit id, the `boxId` the SKU was
   supposed to be in, the `sku`/`batchId`/unit, and whatever door-scan evidence exists at that moment
   (a scan attempt with no match, a scan that never happened, or a customer report with no scan at
   all — the incident should say which, honestly, rather than implying a scan occurred when none
   did). This is the **only** obligation this recovery flow has toward attribution: *who was assigned
   to fill that kit/box, whether the unit was RFID-scanned at fill, whether it sat in the correct
   box, and whether the driver accepted it at handover (lost in driver custody vs. never loaded)* are
   questions the sibling plan,
   `docs/DISCREPANCY-ATTRIBUTION-AND-SCOREBOARD-PLAN-2026-09-17.md`, answers — including the
   per-employee scoreboard and retraining signals — not this one. Two things worth flagging so that
   plan doesn't assume evidence that doesn't exist yet: (a) `rfid/screen-kits.jsx`
   (`docs/codebase-audit/distribution/RFID-FOR-DISTRIBUTION.md §1.1`) is the fill-time, per-box RFID
   verification screen and it is, today, **"a static mockup, not wired code"** — its decision store
   is `React.useState` that "resets on reload and is never persisted anywhere," so a real
   RFID-at-fill signal for this incident does not exist until that module is wired to a backend; and
   (b) the same audit doc records the owner's own note that **no return/handover-verify screen
   exists anywhere** ("*Two new verification moments… pack verify… and return verify… Both belong on
   the timeline*"), so "did the driver accept it at handover" is presently unanswerable from any
   system and will need that capability built, not just read. This recovery flow should emit its
   incident with whatever evidence it actually has and let the sibling plan's attribution logic deal
   with gaps — it must not wait on, or attempt to backfill, evidence that has nowhere to come from
   yet.
2. **The order is flagged and the ETA clock is protected.** `checkOrderState` (`commerce-
   governance.js` via the engine) already refuses a swap once the order passes `policy.cutoff`
   (`'delivered'`) — **[REAL]** — but there is no concept today of *pausing* or *flagging* an order
   mid-flight the way, e.g., an LP case flags a register session. The driver-assignment model's
   **soft-hold** machinery (`docs/DRIVER-ASSIGNMENT-MODEL-2026-09-17.md §4.3`) is the closest
   existing pattern — phantom stops with `expiresAt`/`planVersion`, atomic per-area writer, TTL
   sweeper — and is explicitly documented as needing new kit-ledger event kinds `hold`/`expire`
   beside the existing `reserve/consume/release/restock`
   (`platform/modules/dispatch/kit-ledger.ts:24`, doc §4.3 last bullet). Protecting the ETA clock
   during a recovery swap is the same shape of problem: a hold, not a state machine. **[BUILD]**,
   reusing the hold design already spec'd for a different purpose.
3. **Support opens the order in the admin.** `pos/screen-orders.jsx`'s order-detail view — **[EXTEND]**
   modulo the caveat in §1.5 that its line items are, for a Weedmaps-originated order, currently
   **fabricated** (`wm-demo/wmdemo/order_lines.py`'s own docstring: *"the order detail sheet in the
   POS design invents its products from a hardcoded literal
   (POS-Admin/pos/screen-orders.jsx:1462-1466 — baseItems, three made-up products sliced to the
   order's item count)… That is a real order rendering fake products."*). `order_lines.py` itself is
   a new, **read-only** module built to fix exactly this (joins the raw webhook payload to resolved
   products and FIFO batch allocations) but nothing in `pos/screen-orders.jsx` calls it yet.
   **[BUILD]**: wire the real order lines in before the swap flow can trust what it is editing.
4. **Ranked substitutes, actually in the kit right now.** `HWGovern.planGoverned({intent:
   'replacement', modes: E.SWAP_MODES, ...})` — **[EXTEND]**: the call shape exists, `buildKit`/
   `buildStoreKit` already resolve the correct van vs. store-floor stock (D4, `commerce-
   governance.js:~355-460`), but "right now" is honest only if the kit reflects concurrent holds —
   see step 6.
5. **Priced under the same promotions, with the price-difference policy.** `priceSubstitution` /
   `findBrokenPromotions` (engine `~2745-2800`) already re-evaluate the order's promotion rules
   against the substituted cart and price the delta against the **frozen agreed totals**, never a
   live draft — **[REAL]** on the *engine* side. **[BUILD]** on the *data* side: `wm-demo`'s real
   promotion engine (`wmdemo/engage/promotions.py`) is batch-targeted and genuinely re-pricing
   (`apply_rules`, `_matching_lines`, `_compute_discount`), but nothing bridges its `Rule` shape into
   the commerce-logic engine's `Rule` type — `mobile/screen-task.jsx`'s own test suite says as much:
   *"the estate publishes no engine-shaped Rule objects and no order carries a promotion id, so this
   gate cannot fire… a known gap in the DATA"* (`pos/screen-orders.jsx:~3360-3366`,
   `test/driver-governed-swap.test.mjs:361`).
6. **Customer consent captured.** `wmdemo/signed_links.py` is a real, general-purpose signed
   single-use link module — `mint(purpose, subject_kind, subject_id, scopes, ttl_s, max_uses,
   ...)`, `resolve`/`consume`, and a **race-safe claim/release pattern** for concurrent submits
   (`claim`/`release`/`consume_claim`, lines 651-800) — already used for `driver_response`,
   `signature`, `ssn_backfill`, `doc_reupload`. **[EXTEND]**: add a new purpose, e.g.
   `"swap_consent"`, to `PURPOSES`/`DEFAULT_TTL_S` (`signed_links.py:192-204`), mint a short-TTL
   (say 30–60 min) single-use link scoped to the one order/line/candidate, and build a small
   customer-facing confirm page (same shape as the existing driver-response portal) that calls
   `consume()` and hands back `{channel:'customer_confirmed', recordedByActorId: customerId,
   recordedAt}` — the engine already accepts exactly this consent shape
   (`requiredConsent`/`checkApproval`, engine `~2648-2660`), it is just never fed anything but a
   one-tap attestation today. A phone-call path (support relays what the customer said) can keep
   using the existing `consent.channel:'support_verbal'` one-tap the POS panel already sets
   (`commerce-governance.js:commitGoverned`, `i.actor.kind === 'driver' ? 'driver_verbal' :
   'support_verbal'`) — **[REAL]** for that lighter-weight path.
7. **Order updated atomically.** `applyOrderSubstitution` (engine `~2848-2930`) already does lines,
   promotion re-evaluation, and a recomputed `agreed` block as **one pure function returning a new
   order object** — **[REAL]**. What is missing is **anything that persists the result**: no
   `wm-demo` table for an amended order or a substitution record exists, and every current caller
   (`mobile/screen-task.jsx`, `pos/screen-orders.jsx`) keeps the result in **component state only**
   (`setSubRecords`, `pos/screen-orders.jsx:3822`) — closing the tab loses the audit trail.
   **[BUILD]**: an `order_amendments` (or `substitution_records`) table plus a write route, append-
   only, same shape as `wmdemo/metrc/ledger.py`'s immutability discipline (below).
8. **Tax breakdown recomputed and persisted.** `wm-demo/wmdemo/tax.py:compute()` is a real,
   per-store, date-versioned, cannabis/non-cannabis-split, medical/recreational-aware tax engine
   (`_compute_pure`, `_applicable`, lines 578-635) — **[REAL]**, and specifically already fixed a
   real defect (`refute-money-2.md finding 4`: `member_type="all"` was silently excluding every
   `recreational` rate). **[BUILD]**: nothing today calls `tax.compute()` from a swap; the engine's
   own tax recompute is either the estate's simpler `HW.taxBreakdown` helper (client-side,
   `commerce-governance.js:estateTax()`) or, if `computeTax` is not supplied, the engine's own
   single-blended-rate fallback — which the estate's own comment says loses **18.7% of candidates on
   rounding alone** against California's three separately-rounded components. Wiring `wm-demo`'s
   real `tax.compute()` in as the `computeTax` callback (server-side, at commit time) is the correct
   fix, not a client-side estimate.
9. **Payment delta (cash / card / CanPay).** `settlementFor`/`settlementView` (engine +
   `commerce-governance.js:settlementMethod/settlementView/SETTLEMENT_COPY`) already produce a
   direction-correct instruction (*"Collect $X in cash at the door" / "Refund $X to the card on
   file"*) and this exact file records a real adversarial-review catch: a card refund was once shown
   as *"Re-authorize $80.10"*, reading as a charge when it was a refund — **[REAL]**, fixed. CanPay
   is **not** one of the engine's payment methods (`cash`/`card`/`split`/`wallet` per `TENDERS`,
   `commerce-governance.js:~205`) — **[BUILD]**: decide whether CanPay is `wallet` or needs its own
   settlement class (a debit-style ACH rail behaves differently from a card re-auth).
10. **Kit reservation moved.** `applyOrderSubstitution`'s `intents.inventory` (`release`/`allocate`,
    engine `~2930-2945`) already says what should happen — **[REAL]** as an *instruction*. Applying
    it durably, across more than one browser tab, is the same gap as step 2/6: `VanLedger` is
    localStorage-only (§1.4). **[BUILD]**: the persisted kit ledger with `hold`/`expire` event kinds
    already scoped by the driver-assignment doc (§4.3) is the right target, extended to accept these
    `release`/`allocate` intents as `reserve`/`release`-shaped events against a real store, not a
    browser.
11. **Metrc day-ledger line superseded, never edited.** This exact pattern already exists —
    `wmdemo/metrc/ledger.py`: rows are immutable except `superseded_by`
    (module docstring lines 24-27); `correct_line(original_id, by, **overrides)` (line 242) inserts
    a new row with `resolution_path="manual_correction"` and `supersedes=original_id`, then makes
    the **only** mutation this module ever performs on an existing row — setting its
    `superseded_by` — and refuses (`ValueError`) if the original is already superseded.
    `wmdemo/metrc/exceptions.py:raise_void_after_ledger` (line 134) is the typed exception already
    raised when *"a void/return arrived for an order that already has a ledger line"* — a swap after
    the sale has been ledgered is the same shape of event. **[REAL]** as a mechanism; **[BUILD]**:
    nothing today calls `correct_line` from a swap — that wiring, plus deciding whether a swap
    *before* the day-ledger line exists needs no correction at all (just a different `product_id`/
    `batch_id` on first write), is new.
12. **Realtime event to the driver app.** `wmdemo/realtime_channels.py` is a real pub/sub primitive
    (channel families, scope-checked subscribe, replay-by-last-id, idle eviction) — **[REAL]** as
    infrastructure — but `register_channel_family()` has **no call sites registering an actual
    family** anywhere in the codebase today (confirmed by grep: only the function definition and a
    test-only reference exist). **[BUILD]**: register an `order.driver.<orderId>` or
    `driver.tasks.<driverId>` family and publish on a successful `commitGoverned`.
13. **Audit trail** (who, why, customer consent evidence). The engine's `SubstitutionRecord` already
    carries `actor`, `reason`, `consent`, `approval`, `money`, `warnings`, `occurredAt` — **[REAL]**
    as a shape. **[BUILD]**: persistence (step 7) is what turns this from "what React state
    happened to hold when the tab was open" into an actual audit trail.
14. **LP variance case opened for the mis-stock.** `wmdemo/lp/cases.py` is a real, tested state
    machine (`new → awaiting_driver → awaiting_manager → decided → corrected|reopened`) but every
    `kind` it currently models (`variance`, `closeout`, `delivery`) is a **cash**-discrepancy case
    from register closeouts (`sync_from_submissions`, lines 376-495) — **[REAL]** for cash, **not**
    for inventory. **[BUILD]**: a new case `kind` (e.g. `inventory_variance`) reusing the same
    lifecycle/dedupe/idempotency machinery (`_insert_case`, `decide`, `_dedup_conflict`) rather than
    a parallel system. **This is not the same thing as the incident emitted at detection (step 1).**
    An LP case is a store-level investigation/disposition workflow; the detection-time incident is a
    per-event attribution record feeding the sibling scoreboard plan. They may end up cross-linked
    (an LP case referencing the incident id, or vice versa) but that linkage is the sibling plan's
    call to make, not a second incident system invented here.
15. **Dispatch re-check** (still inside the promised window?). The driver-assignment model's
    compare-and-swap-on-plan-version pattern (`docs/DRIVER-ASSIGNMENT-MODEL-2026-09-17.md:589-593`)
    is the existing design for *"did the world move under this promise, and if so, tell the customer
    before it's too late, never after."* **[BUILD]**: a swap is a smaller perturbation than a new
    order, but the same re-quote-and-compare-to-promised-window logic applies — this should **not**
    become a second, parallel window-check implementation.

---

## 3. "Smart" rules

| Rule | Where it lives today | Status |
|---|---|---|
| Never offer what is not in the kit | `buildCandidates`'s `unitsFor` + `buildKit`'s `units` map (engine + `commerce-governance.js:buildKit`) | **REAL** |
| Equal-or-better / customer never pays more | `SWAP_MODES` (`similar`/`cheaper`) exist and price correctly; **not selected by default** on the POS panel (§1.5 gap #1) | **REAL engine, BROKEN wiring** |
| Price-difference policy (never pay more / refund difference / goodwill credit) | `priceDelta` policy values already include `never_increase`, `increase_needs_cash`, `increase_needs_card_reauth`, `settle_at_door` (engine `settlementFor`, `~2635-2650`) — a literal "never charge more for a recovery swap" policy is one more `priceDelta` value or a per-`reason` policy override | **PARTIALLY REAL** — the enum has almost what's needed; a goodwill-credit settlement class does not exist (only cash/card/closeout) |
| Max swaps per order | Not tracked anywhere — the engine has no per-order swap counter | **GAP** |
| Medical vs adult-use | `wm-demo/wmdemo/tax.py`'s `member_type` (`recreational`/`medical`/`all`) drives **tax only** (`_applicable`, `_compute_pure`); the commerce-logic engine has no `Actor`/`Order` concept of medical vs adult-use at all | **GAP for eligibility**, real for tax |
| Compliance daily limits by category/weight | **No code anywhere in either repo tracks this.** `pos/checkin.jsx:625-628` and `pos/screen-register.jsx:554-556,1240` only carry *comments/copy* noting medical and adult-use "have different purchase limits" — no numeric cap, no running daily total | **GAP — confirmed absent, not just undocumented** |
| Equal-or-better rule for a *replacement* (not upsell) | This is exactly what `modes: SWAP_MODES` + `intent: 'replacement'` already models — a mis-stock swap should default to `similar` first, `cheaper` second, and only offer `upgrade`/`stronger` if the customer wants it, which is the *opposite* default from today's POS panel (§1.5) | **REAL logic, wrong default today** |
| When to offer cancel-line vs full cancel | No such option exists in `planOrderSubstitution`/`applyOrderSubstitution` — the engine only substitutes; removing a line or cancelling the order are separate, unbuilt code paths | **GAP** |
| What the driver can do alone at the door vs what needs support | Already encoded: `defaultFulfillmentPolicy.authority` (`driver_or_support_anytime` / `support_only` / `support_approves_all` / `driver_free_below_threshold`) plus `approvalRequiredFor` (engine `~2573-2586`). Today's policy (`commerce-governance.js:POLICY`) leaves this at the engine default (`driver_or_support_anytime`, no threshold) — a driver can commit **any size** substitution alone, which may be too loose for a recovery swap specifically (vs. an upsell) | **REAL mechanism, needs an owner decision on the threshold (see §6)** |

---

## 4. Backend to build

There is, today, **no backend for this anywhere.** `order_lines.py` (read-only, §2 step 3),
`signed_links.py` (general-purpose, needs a new purpose), `metrc/ledger.py` (correction pattern
exists, unused for swaps), `lp/cases.py` (state machine exists, no inventory case kind),
`realtime_channels.py` (pub/sub primitive exists, no family registered), and
`platform/modules/dispatch/kit-ledger.ts` (in-memory only, its own docstring says *"a later phase
persists the same event log… written so that swap is additive"*) are all real pieces that a new
`orders`/`swap` module should sit on top of, mirroring the existing `module.py` + `module_api.py`
split (`lp/cases.py`+`lp/api.py`, `register.py`+`register_api.py`) and the same
`register_all()` → `route_policy.register()` gating every other module uses
(`wmdemo/server.py:122-168`).

**Contracts (new, in `wmdemo/contracts.py` alongside the existing `TxnType`/`TaxBreakdown` shapes):**

- `SwapProposal` — `{orderId, lineId, intent, kitId, candidates: [...], expiresAt}` — the *offered*
  set, time-boxed so a support agent isn't confirming against stock that moved five minutes ago
  (reuses the `maxKitAgeMs`/staleness concept already in the engine, engine `~1879-1881`).
- `SwapDecision` — `{proposalId, candidateProductId, reason, consent: {channel, evidence},
  approval?, idempotencyKey}` — the support agent's/customer's decision, submitted once.
- `OrderAmendment` — the persisted result of `applyOrderSubstitution`: `{id, orderId, record
  (engine's own SubstitutionRecord, unchanged), appliedAt, appliedBy}` — **append-only**, same
  discipline as `metrc/ledger.py` (§2 step 11) and `lp/cases.py`'s event log (`_log_event`).

**Routes (new module, e.g. `wmdemo/orders_amend.py` + `wmdemo/orders_amend_api.py`):**

- `POST /api/orders/{id}/swap/propose` — scope `orders:amend` (new — sits naturally next to the
  existing, currently-unusable `ORDERS_SCOPES = ("orders:status:write", "orders:eta:write")` in
  `wmdemo/config.py:222`, which are **outbound** scopes for pushing to Weedmaps and are separately,
  and unrelatedly, blocked — Weedmaps has not entitled this client for either, per the controlled
  400-vs-200 experiment documented at `config.py:185-215`. `orders:amend` would be a purely
  **internal** scope on our own API, not a WM scope, and is not blocked by that finding — but it
  does mean a swap cannot, today, push an updated ETA or status back to Weedmaps itself; see §6.
  Requires an idempotency key (client-generated) so the "second tap lands before the sheet unmounts"
  bug already found and fixed on the driver screen (§1.4) cannot resurface as a server-side double
  commit.
- `POST /api/orders/{id}/swap/consent` — mints/consumes a `signed_links.py` `"swap_consent"` link
  (see §2 step 6); support-role and driver-role both call `propose`, only a customer-facing page
  calls `consent`.
- `POST /api/orders/{id}/swap/commit` — server-side call into the same `applyOrderSubstitution`
  logic (or a server port of it — the engine today is a **client-side JS bundle**; a decision is
  needed on whether the server re-implements the pure functions in Python, matching them with a
  contract test, or the commit still happens client-side and the server only persists the result —
  see §6).

**Idempotency**: every write path needs a caller-supplied idempotency key, exactly like
`promotions.consume`'s `UNIQUE(promotion_id, order_id)` (`engage/promotions.py:1475-1524`) and
`register.py`'s `assert_open`/session guards — this estate has the pattern everywhere else already;
a swap commit should not be the exception.

**Store scoping**: every existing module (`lp/cases.py`, `register.py`, `tax.py`) scopes by
`store_id`; a swap route must refuse (not silently ignore) a request for an order belonging to a
different store than the caller's session.

**Integer cents, always**: the one dollars↔cents boundary in the frontend
(`commerce-adapter.js:cents()`) must have exactly one backend counterpart
(`contracts.cents_from_dollars`, already used by `order_lines.py:_cents`) — no second hand-rolled
`Math.round(x*100)`.

**Probes / refuter's attack list** (mirroring this estate's own QA convention —
`qa/order_push_truth_probe.py`, `qa/order_origin_invariant_probe.py`, etc. — a new swap module
should get siblings, not a separate test philosophy):

1. **Price manipulation via swap** — commit a candidate whose `priceDeltaCents` the client claims
   is negative when the server's own catalogue/kit says otherwise; server must re-derive money from
   its own data, never trust a client-supplied delta (the engine's `priceSubstitution` already does
   this correctly *if* it is fed server-side inputs — the attack is a client bypassing it).
2. **Swapping into a restricted product** — a medical-only or age/compliance-restricted SKU offered
   through the general catalogue path; given §3's confirmed gap (no daily-limit tracking, no
   medical/adult-use eligibility check in the engine), this attack currently **succeeds** and is the
   single highest-priority gap to close before shipping.
3. **Replaying a consent link** — `signed_links.py`'s `consume()`/`claim()` pattern is already
   built to prevent this (single-use, `max_uses=1` default, race-safe `claim`/`release`), so this
   probe should pass once the new purpose is wired — verify it does, don't assume.
4. **Amending another store's order** — per store-scoping above; probe should submit a
   support-agent token for store A against an order in store B.
5. **Double-refund** — commit the same `SwapDecision` twice (network retry, double-tap); the
   idempotency key plus `OrderAmendment`'s append-only, unique-per-decision design should make the
   second call a no-op replay, mirroring `promotions.consume`'s `{consumed, replayed}` return shape
   (`engage/promotions.py:1490` return contract) — reuse that exact pattern rather than inventing a
   new one.

---

## 5. UI — what exists, what's missing

**Exists and should be the base to extend:**
- `pos/screen-orders.jsx`'s `SwapPanel` — correct actor scoping, correct engine calls, three fixable
  bugs (§1.5). **Desktop only** — this is a full POS screen, not built for a phone-sized viewport.
- `mobile/screen-task.jsx`'s `MGovernedSwapSheet` — the reference implementation for intent/reason/
  modes; **phone-sized already**, since it's the driver app.

**Missing / needs a decision:**
- A **support-agent-on-a-phone** surface. The owner's own framing — *"the support agent may be on a
  phone"* — means the admin swap flow cannot only live in the desktop POS screen. Two options: (a)
  make `pos/screen-orders.jsx`'s order detail responsive enough to use one-handed, or (b) give
  support agents a lighter, mobile-first version of the same `SwapPanel` component (same governed
  calls, simpler chrome) — this is new UI work either way and needs **four concepts, desktop and
  phone**, per standing design practice.
- A **customer consent page** (§2 step 6, §4) — does not exist in any form today; the closest
  precedent is the driver-response portal built on the same `signed_links.py` module.
- **`logistics/lorder.jsx`'s `SwapPicker`** — decide whether to rebuild it on the governed path or
  retire it in favor of routing LP/dispatch agents to the POS order-detail screen; maintaining two
  divergent implementations of the same action is how the POS panel's own bugs (§1.5) went unnoticed
  this long.

---

## 6. Phases

**Phase 1 — S (fix what's already 90% there).** Fix the three `SwapPanel` bugs (§1.5): pass
`intent:'replacement'` + `modes: E.SWAP_MODES`, add the `REASONS_BY_INTENT` picker (copy the pattern
from `mobile/screen-task.jsx:470-480`), add `mintRecordId`-equivalent idempotent record ids. Wire
`pos/screen-orders.jsx`'s order detail to real order lines via `wmdemo/order_lines.py` instead of the
hardcoded `baseItems` literal. No new backend yet — audit records still live in component state, same
as today, just correctly shaped.

**Phase 2 — M (persistence + audit).** Build the `orders_amend` module (§4): contracts, routes,
idempotency, the `OrderAmendment` table. Wire `wm-demo`'s real `tax.compute()` in as the swap
commit's tax recompute. Register a real-time channel family (§2 step 12) and publish on commit.

**Phase 3 — M (consent + compliance gates).** New `signed_links.py` purpose + customer consent page.
Close the two confirmed compliance gaps from §3 that a refuter would flag first: (a) daily
category/weight limits (does not exist anywhere — needs its own small design pass, likely a
per-customer running-total table keyed by day + category), (b) medical/adult-use eligibility check on
swap candidates (today only affects tax, not offer eligibility).

**Phase 4 — L (kit ledger + dispatch integration).** Persist the kit ledger with `hold`/`expire`
event kinds (already spec'd in `docs/DRIVER-ASSIGNMENT-MODEL-2026-09-17.md §4.3`, not yet built even
for its original purpose) so support and driver see the *same* live kit, not two independent
`localStorage` copies. Wire the dispatch re-check (§2 step 15) using the existing compare-and-swap
pattern. Wire `metrc/ledger.py:correct_line` from a commit (§2 step 11). Add the new `lp/cases.py`
inventory-variance case kind (§2 step 14).

**Phase 5 — S/M (Weedmaps-facing, blocked pending entitlement).** If a swap needs to push an updated
ETA or line-item change back into the Weedmaps-facing order (not just our own driver/support apps),
that is blocked today regardless of anything built above — `wmdemo/config.py:185-215` documents a
controlled experiment proving Weedmaps has not entitled this client for `orders:status:write` or
`orders:eta:write`. Scope this phase only once that changes; do not build a client-side workaround
(the file's own comment: *"anything that looks like one is writing to somebody else's order"*).

---

## Owner questions

**Q1 — Which existing screen becomes the one governed swap surface for support?**
- **A. Extend `pos/screen-orders.jsx`'s `SwapPanel`, retire `logistics/lorder.jsx`'s picker.**
  (Recommended.) *Pro:* reuses the already-correctly-actor-scoped, already-governed component; one
  code path to test and fix. *Con:* LP/dispatch agents have to switch screens if they live mostly in
  `logistics/lorder.jsx` today.
- **B. Rebuild `logistics/lorder.jsx`'s `SwapPicker` on the governed engine, keep both screens.**
  *Pro:* no workflow disruption for whoever uses the LP console daily. *Con:* two implementations of
  the same governed call, which is exactly how the POS panel's three bugs went unnoticed (§1.5).
- **C. Build a brand-new, third screen just for recovery swaps.** *Pro:* purpose-built, no legacy
  baggage. *Con:* a fourth code path calling the same engine, more surface for the two screens to
  drift apart from.
- **D. Decide later; ship Phase 1's engine fixes against whichever screen is used most today.**
  *Pro:* unblocks Phase 1 immediately. *Con:* Phase 1's UI work might target the wrong screen.

**Q2 — What price-difference policy for a *recovery* swap specifically (as opposed to a driver upsell)?**
- **A. Customer never pays more; a genuine upgrade is offered but free.** (Recommended — matches
  "completely unacceptable, but if it does happen," i.e., this is the business's mistake to absorb.)
  *Pro:* simplest support-agent script, no negotiation. *Con:* margin cost on every recovery that
  happens to only have pricier stock in the kit.
- **B. Refund the difference if cheaper, no charge if pricier (current engine default, `settle_at_
  door`).** *Pro:* zero new logic — this is what's already wired. *Con:* a customer who accepts a
  pricier replacement still gets charged more for a mistake that wasn't theirs.
- **C. Refund the difference if cheaper; offer a goodwill credit (not a charge) if pricier.**
  *Pro:* customer never pays more, business absorbs a bounded amount rather than the full delta.
  *Con:* a goodwill-credit settlement class does not exist in the engine today (§3) — new work.
- **D. Support agent decides case by case, no default policy.** *Pro:* maximum flexibility.
  *Con:* the engine can't gate a commit on a policy it can't see, so every commit becomes support's
  personal judgment call with nothing to audit against.

**Q3 — How strict should driver-alone-at-the-door be for a *mis-stock recovery*, versus today's engine default (`driver_or_support_anytime`, no dollar threshold)?**
- **A. Recovery swaps always require support** — a driver who discovers the mis-stock at the door
  calls it in rather than self-serving a replacement. (Recommended for a first ship — matches "the
  support team contacts the customer.") *Pro:* every recovery has a human talking to the customer,
  matching the owner's stated flow exactly. *Con:* slower at the door; a trivial same-price swap now
  needs a phone call.
- **B. Driver may self-serve below a dollar threshold (reuse `driver_free_below_threshold`,
  set a number), support required above it.** *Pro:* the engine already has this policy value —
  zero new mechanism, just a number. *Con:* picking the right threshold is a guess without data.
- **C. Driver may always self-serve for `replacement`, same as today's `upsell` default.**
  *Pro:* no behavior change, no new policy work. *Con:* skips the customer-contact step the owner
  explicitly asked for.
- **D. Depends on payment method (COD self-serve; prepaid needs support).** *Pro:* ties the gate to
  where money actually changes hands at the door. *Con:* another axis to test; not an existing engine
  concept (would need a new policy dimension).

**Q4 — Customer consent for a recovery swap: phone attestation only, or a signed SMS/link confirmation?**
- **A. Phone attestation only (today's `verbal_ok`/`support_verbal`, already wired).**
  *Pro:* zero new backend, ships in Phase 1. *Con:* weaker evidence trail than a customer's own
  signed confirmation for what is, by definition, an unplanned change to what they're paying for.
- **B. Signed single-use SMS link required for every recovery swap (§2 step 6, §4).**
  (Recommended if consent quality matters more than speed.) *Pro:* real, direct customer evidence,
  reuses `signed_links.py`'s existing, tested pattern almost as-is. *Con:* Phase 3 work, and a
  customer who doesn't tap the link stalls the order.
- **C. Link required only when the price changes or a promotion is lost; phone attestation
  otherwise.** *Pro:* proportionate — the highest-stakes changes get the strongest evidence.
  *Con:* two consent code paths to maintain and test instead of one.
- **D. Support's word is sufficient; no customer-side artifact at all.** *Pro:* fastest, no build.
  *Con:* the audit trail's `consent` field would say `support_verbal` for something the customer
  never directly confirmed — thin evidence if a charge is later disputed.

**Q5 — Should the swap commit logic run server-side (a Python port of `applyOrderSubstitution`), or stay client-side with the server only persisting the result?**
- **A. Server-side port, contract-tested against the JS engine's own outputs.** (Recommended for
  anything that touches money.) *Pro:* closes the "price manipulation via swap" attack in §4 by
  construction — the server never trusts a client-computed delta. *Con:* two implementations of the
  same pricing logic to keep in sync (mitigated by a contract test, not eliminated).
- **B. Client computes, server validates the result against its own re-derivation before persisting.**
  *Pro:* no logic duplication — server calls out to the same rules it already has (tax, promotions)
  to check the client's number rather than re-implementing substitution math. *Con:* "validates
  against its own re-derivation" is still most of a server-side port in practice.
- **C. Client computes and commits; server only stores whatever it's given.** *Pro:* least work,
  ships fastest. *Con:* this is the price-manipulation attack surface in §4 left wide open — not
  recommended for anything that changes what a customer is charged.
- **D. Move the whole engine to a shared Node service both the browser and `wm-demo` call.**
  *Pro:* one implementation, period. *Con:* biggest lift by far — a new service, new deploy target,
  new failure mode, for a decision that doesn't need to be made before Phase 1 or 2 can start.
