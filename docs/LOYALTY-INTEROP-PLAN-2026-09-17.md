# Loyalty interop plan — Engage as the engine, working with Alpine IQ and Blaze

**Owner decision D15 (2026-09-17), amending the 2026-09-10 "Alpine is retired" assumption:**
Engage is the loyalty engine. Its ladder must **match today's Alpine/Blaze ladder**. Balances
carry over **1:1**. The system must keep working **with** Alpine IQ and **with** Blaze — this is
an interop plan, not a replacement/cutover plan.

Everything below was re-derived from source today: `wm-demo/wmdemo/engage/*.py`, `docs/ENGAGE-
STATUS.md`, `hyper-tech/hyperwolf-backend` (`controllers/alpine/`, `controllers/blaze/`, routes),
`hyper-tech/hyperwolf-backend/routes/blaze/other-blaze-routes.js`, the GAS estate
(`marketing-analytics/AlpineIq.js`), and `POS-Admin/scratch/alpine-census-2026-09-10.md`. No
external system was called to write this — everything cited below is either code already in the
estate or a public/vendor-facing shape already discovered by a prior, disclosed API census.

---

## 1. Today's ladder, as actually configured

| Item | Value | Status | Source |
|---|---|---|---|
| Tier names | **Wolfpack**, **Pack Leader** (two tiers) | **CONFIRMED** | Live in production: `hyperwolf-backend/controllers/blaze/user-cart-controllers.js:995-1075` (`exports.getWolfPack`, mounted `GET /api/v1/blaze/wolfpack` — `routes/blaze/user-cart-routes.js:19`) returns `wolfPackObject.wolfPackPoints`/`isPackLeader`. Engage's own build (`wm-demo/wmdemo/engage/program.py:127-128`) independently names the same two tiers. |
| Pack Leader entry threshold | **$2,000 lifetime spend** (`orderAmountSpent`) | **CONFIRMED** | Live: `user-cart-controllers.js:1063` — `amountLeft = Math.max(2000 - orderAmountSpent, 0)`; `isPackLeader: amountLeft === 0`. `orderAmountSpent` comes from Alpine (`GET /api/v1.1/piis/1546/{contactId}`, field `.data.spent`). Engage's `program.py:130-137` sets `PACK_LEADER_ENTRY_THRESHOLD_CENTS = 200000` with the code comment "matching production's existing check" — this audit independently found the production check it refers to and it matches exactly. |
| Wolfpack entry threshold | None — every enrolled customer | **CONFIRMED** (by absence: no lower gate exists in the live check above) | Same source. |
| Points earn rate | **1 point per $1 net spend** | **Engage's own default (CONFIRMED as built); NOT independently confirmed against Alpine's live earn-rate config** | `wm-demo/wmdemo/engage/ledger.py:99` — `DEFAULT_EARN_RULE = {"type": "per_dollar_net", "points_per_dollar": 1}`. No Alpine or Blaze endpoint returning an earn-rate/program-config value was found in this pass or the earlier one (see NEEDS-EXPORT below) — this number is Engage's design assumption, not read from a vendor. |
| Points balance | Alpine `loyaltyPoints` field | **CONFIRMED, read live** | `user-cart-controllers.js:1045` — `profile.loyaltyPoints`, from `GET /api/v1.1/piis/1546?search={phone}`. |
| Tier/program definitions (thresholds, benefits, as Alpine itself would list them) | Unknown | **NEEDS-EXPORT** | `POS-Admin/scratch/alpine-census-2026-09-10.md:115-116,212` — `GET /api/v2/tiers/1546` returned 404; no endpoint under v1.1 or v2 exposed a tier-definitions list in that census. The $2,000/two-tier shape above was reverse-engineered from what the **app** computes, not read from a "program config" resource — Alpine may not expose one at all under this account. |
| Rewards catalog (redeemable items, point costs) | Unknown from API | **NEEDS-EXPORT** | Alpine's `GET /wallet/{phone}` (`alpine_client.py:358-367`, and `getReedemPoints` in `hyperwolf-backend/controllers/alpine/alpine-controllers.js:13-45`) returns redemption **URLs** for a given wallet, not a catalog of rewards with costs. `putRequest .../adjust/loyaltyPoints/1546/{contactId}` (line 89) *adjusts* a balance; it doesn't list what's redeemable. |
| Blaze-side loyalty (promotions/rewards) | Thin proxy only | **CONFIRMED shape, NEEDS-EXPORT values** | `hyperwolf-backend/routes/blaze/other-blaze-routes.js:12-13` → `controllers/blaze/other-blaze-controllers.js:7-28` — `GET /loyalty/promotions` and `GET /loyalty/rewards` are pure pass-throughs to Blaze's own `/api/v1/partner/loyalty/promotions`/`/rewards`. The actual promotion/reward *values* live in Blaze, not in any repo in this estate, and this audit made no live call to Blaze to avoid contacting an external system. |
| Referral / unlockable deals | Exists, separate from the tier ladder | **CONFIRMED, structurally minor** | `alpine-controllers.js:100-160` (`getRefCode`, `alpinePhoneUser`, `applyRefCode`) — referral-code flow, keyed on phone → Alpine `piis` lookup, independent of tier/points. |

**Net finding:** the two-tier, $2,000-threshold ladder Engage already built (2026-09-10, before
today's D15) turns out to independently match what production actually gates on — this is a
good sign, not a coincidence to be nervous about, because both were reading the same Alpine
`spent` field. What is **not** yet confirmed is whether Alpine's own account-level configuration
(if one exists beyond what the app computes) agrees on the number, and neither Alpine's nor
Blaze's actual rewards catalog/point-costs are visible from source. Closing those two NEEDS-EXPORT
rows is this plan's first action item (Phase 0, §7).

---

## 2. System of record: **Engage authoritative, with outbound adapters** (not mirror mode)

**Recommendation: Engage becomes the system of record for balances and tier state; Alpine IQ and
Blaze become downstream targets kept in sync by outbound adapters**, not the other way around,
and not a permanent dual-write mirror.

**Why not mirror mode as the end state:** a mirror (write to both, read from either) has no
answer for what happens when the two disagree — and they will, the moment Engage supports a
promotion shape Alpine's UI doesn't (already true today per `ENGAGE-STATUS.md`'s own "Known,
documented gaps" — Suite `bundle`/`points`-multiplier offers). Two systems of record is not a
transition state, it's a permanent reconciliation tax. Mirror mode is still useful, but only as
a **time-boxed transition posture** (Phase 2 below), not the target architecture.

**Why Engage, not Alpine/Blaze, ends up authoritative:** Engage already has the richer model
(store/channel/audience-scoped promotions, `priority`-ordered stacking, per-customer/usage caps,
idempotent `consume()` — `ENGAGE-STATUS.md` "Phase 4" section) that neither vendor's API exposes
a way to configure. Building the richer model twice, once in Engage and once by fighting Alpine's
UI into the same shape, is waste; the adapters exist so Alpine/Blaze keep functioning as the
customer-facing surfaces they already are (Alpine's own SMS/email sends, Blaze's own register
UI) without either vendor needing to know Engage exists underneath.

**What "authoritative" means concretely:**
- Every points earn/redeem/tier-change event is written to Engage's `loy_ledger`/
  `loy_tier_memberships` first (already-built machinery — `ledger.py`, `program.py`'s
  `evaluate_tier`).
- The Alpine and Blaze adapters are **outbound projections** of that event, not independent
  sources of truth — they push Engage's state to the vendor so the vendor's own UI (Alpine's
  wallet page, Blaze's register redemption screen) shows a number that matches.
- The one exception, unavoidable during transition: Blaze's **register** is the point of sale
  today and Engage doesn't sit in that transaction path yet (Phase 1, §7) — so redemption *at
  the register* must round-trip through Blaze first. See conflict rule 3 in §4.

---

## 3. Adapter designs

### 3.1 Alpine IQ adapter

| Direction | Data | Mechanism | Notes |
|---|---|---|---|
| **Inbound** (Alpine → Engage) | Contacts (create/update), consent state changes (STOP/START via Alpine's own SMS flow) | Webhook, if Alpine offers one for contact/consent events (unconfirmed — not found in this census; ask Alpine directly, see §7 owner question) — otherwise a polling reconciliation job (§5) against `get_contacts`/`get_wallet` (`alpine_client.py:292-367`, already read-only and rate-limited) | Alpine is source of truth for **acquisition** (a customer signing up via an Alpine-run SMS keyword) until Engage's own signup surface exists |
| **Outbound** (Engage → Alpine) | Points balance adjustments, tier changes (as a note/tag, since Alpine may have no tier resource — NEEDS-EXPORT), audience membership (for Alpine's own campaign targeting) | `PUT /api/v1.1/adjust/loyaltyPoints/1546/{contactId}` (already used live, `alpine-controllers.js:89` — same call, new caller) for point deltas; audience sync via whatever Alpine's audience/list API turns out to be (not yet censused — add to Phase 0) | Every outbound call must carry Engage's own idempotency key as the adjustment's `note` field (that field already exists, `alpine-controllers.js:82` `body: {value, note}`) so a retried adjustment is detectable even though Alpine's API itself has no idempotency-key parameter |
| **Outbound** (Engage → Alpine, campaigns) | Trigger a campaign/journey send when Engage's own `journeys.py` reaches a step that should fire an Alpine-run SMS/email | Unconfirmed mechanism — Alpine's campaign-trigger API (if any) was not found in the census; `marketing-analytics/AlpineIq.js` only *reads* campaign reports, never triggers one | **NEEDS-EXPORT.** If Alpine has no trigger API, Engage's own `msg_adapter.py` (already built, vendor-agnostic) sends the message directly and Alpine is used for acquisition/wallet display only, not send orchestration going forward |

### 3.2 Blaze adapter

| Direction | Data | Mechanism | Notes |
|---|---|---|---|
| **Inbound** (Blaze → Engage) | Completed order (for earn calculation), register-side redemption event | Blaze webhook if one exists for order completion (the estate already has a Weedmaps webhook precedent — `msg_adapter.py`'s docstring references the same public-write-token-exemption posture used for it) — otherwise poll `/api/v1/partner/transactions` (already called elsewhere in the estate, per CLAUDE.md's "duplicate fetches" note — reuse the existing call site, don't add a new one) | Order → earn must key off the **same** order id Blaze uses, so `consume()`'s existing `(promotion_id, order_id)` idempotency pattern (`ENGAGE-STATUS.md` Phase 4) extends directly to `(program_id, order_id)` for earn |
| **Outbound** (Engage → Blaze) | Points balance, so the register's own loyalty display agrees with Engage | `GET /api/v1/partner/loyalty/rewards`/`/promotions` are Blaze's read surface today (`other-blaze-controllers.js:7-28`); no write endpoint for "set this customer's point balance" was found in this pass — **NEEDS-EXPORT**: ask whether Blaze's partner API exposes a loyalty-balance write, or whether balance display at the register must stay Blaze-native (in which case Blaze's own DB, not Engage's, is momentarily authoritative for the in-register number, reconciled after the fact) |
| **Outbound** (Engage → Blaze), redemption at register | A cashier applies a reward; Blaze must know it's valid and Engage must know it was consumed | Register calls Blaze's existing `/loyalty/rewards` to show the list; the redemption itself needs a real-time check against Engage's `rewards.usable()` (already built, `rewards.py:146-180`) — this requires either a Blaze-side webhook/lookup at redemption time, or the register calling out to Engage synchronously, both **unconfirmed as buildable from Blaze's current partner API** — flag as the single highest-risk integration point in this whole plan (see conflict rule 3) |

**Idempotency keys, estate-wide convention:** every adapter write carries a key of the shape
`{engage_event_type}:{engage_entity_id}:{vendor}` (e.g. `points_earn:evt_9182:alpine`), stored in
a new `engage_adapter_outbox` table (append-only, mirrors `msg_adapter.py`'s already-proven
`_insert_or_get_send_row` replay-detection pattern) so a retried push is a no-op, not a double
push, on both Alpine (via the `note` field workaround above) and Blaze.

---

## 4. Conflict rules

1. **Double-earn** (a sale synced from both a Blaze webhook and a polling reconciliation pass):
   the `(program_id, order_id)` idempotency key on `consume()`/earn (extending the proven Phase-4
   pattern) makes the second write a no-op. The reconciliation job (§5) only ever fixes gaps it
   finds, never re-applies an event whose id it has already seen.
2. **Double-redeem** (a reward redeemed at the register AND through an Engage-driven channel
   before the two systems sync): `rewards.py:180-203`'s `_scoped_key`/idempotency-key mechanism
   already exists for this — extend the register path to pass the same order/transaction id as
   its idempotency key, so a redemption that round-trips through both paths for the same
   transaction resolves to one debit.
3. **Offline register** (network down, cashier applies a reward Blaze can't confirm against
   Engage in real time): Blaze must be allowed to honor the redemption locally (never block a
   sale on a loyalty check) and **queue it for reconciliation**. Engage's ledger then either
   confirms the debit after the fact or, if the customer's balance can't cover it, the
   reconciliation job flags a negative balance for manual review rather than silently allowing
   unlimited offline redemption — this is a policy the owner should confirm (§7 Q3).
4. **Conflicting tier state** (Alpine's own UI shows a tier Engage doesn't agree with, because
   Alpine's tier config was never confirmed to match — see §1 NEEDS-EXPORT row): until Alpine's
   real tier config is exported and diffed, Engage's computed tier is authoritative for benefits
   logic, and any customer-visible mismatch on Alpine's own screens is a display bug to fix in
   the adapter, not a signal to change Engage's math.

---

## 5. Reconciliation job

A scheduled job (cadence: hourly first month, then daily) that:
- Pulls Alpine's `get_adjustments`/`get_redemptions` (`alpine_client.py:372-410`, already built,
  read-only, rate-limited) and Blaze's transaction feed for the same window.
- Diffs each vendor-side balance against Engage's ledger-computed balance per customer.
- Where they agree: no-op, logged.
- Where they disagree: writes a `loy_reconciliation_discrepancy` row (never auto-corrects a
  customer-visible balance silently) for a human to resolve, following this estate's own §4.7
  standing rule ("watch the output, not just the exception" — a reconciliation job that only
  alerts on its own failure and never checks whether the numbers it produced are *right* repeats
  the exact failure mode that left a Supabase table half-empty for weeks elsewhere in this
  estate).
- Surfaces a daily count (discrepancies found / auto-resolved / open) so a silently-growing gap
  is visible before it's a support ticket.

---

## 6. 1:1 balance import, PII, and security

**1:1 balance carryover.** Route through `hw-sync` (`wm-demo/platform/sync`), the estate's
existing mapping-driven ingestion tool (16 mapping files already in production use, per
`docs/migration/LEGACY-DATA-MODEL-INVENTORY-2026-09-17.md`). A new one-time mapping,
`alpine_wallet_to_loy_ledger.json`, following the same schema every other mapping in that
directory already validates against (`_schema.json`), imports each customer's current
`loyaltyPoints` as one opening-balance ledger entry (`kind="import_1:1"`, `at=<import
timestamp>`), never as a synthetic "earned" event — so a customer's history starts clean in
Engage but their number is exactly what Alpine showed them the day of cutover.

**PII handling.** Phone number is the join key between Blaze (`cuid`), Alpine (`piis` search),
and Engage (`customer_id`) today — confirmed across `alpine-controllers.js`, `user-cart-
controllers.js`. Engage's own `identity.py`/`consent.py` modules already exist and already gate
writes on consent state; the adapters must call through them, never write phone/PII to a vendor
call that bypasses `consent.check()`.

**SMS opt-in provenance.** Already modeled: `wm-demo/wmdemo/engage/consent.py:263`
(`REGRANT_SOURCES = ("sms_reply", "web", "pos", "csr")`) — every consent grant/re-grant already
records where it came from. The Alpine adapter's inbound consent sync (§3.1) should map Alpine's
own opt-in source (if Alpine reports one) onto this same enum rather than inventing a second
taxonomy, and where Alpine can't say, record it explicitly as `"csr"`-equivalent ("imported,
source unknown") rather than guessing a specific channel.

**Security requirements:**
- **Scoped keys per adapter.** `ALPINEIQ_API_KEY`/`ALPINEIQ_UID` (variable names only, already in
  use — `alpine_client.py:21`) and Blaze's `PARTNER_KEY`/`AUTH_TOKEN` (`hyperwolf-backend`
  common pattern) should each get an Engage-specific credential, not reuse the hyperwolf-backend
  app's own keys, so a scope/rate-limit problem in one caller doesn't take down the other.
- **Signed webhooks with replay windows.** `msg_adapter.py`'s existing HMAC-verification pattern
  (`hmac.compare_digest`, timestamp-skew window, `_already_processed`/`mark_processed` dedup by
  event id — lines 29-160) is the template; any inbound Alpine/Blaze webhook this plan adds
  should reuse that module rather than writing a third signature-verification implementation.
- **Rate limits.** Alpine's client already self-throttles (`alpine_client.py:178-190,
  219-261` — jittered backoff on 429/5xx); the Blaze adapter should adopt the same posture rather
  than relying on Blaze to reject politely.

---

## 7. Phases

- **Phase 0 — close the NEEDS-EXPORT gaps (small, ~2-3 days).** Get Alpine's real tier/program
  config (if it exists) and rewards catalog with point costs, either via Alpine support/docs or
  an account-level export; get Blaze's actual loyalty promotion/reward values via one authorized
  read call (not blocked on this plan); confirm whether Alpine has a webhook or campaign-trigger
  API at all. Nothing in Phase 1+ should be built against a guessed vendor shape when a real
  export is one ask away.
- **Phase 1 — outbound adapters + reconciliation job (medium, ~2-3 weeks).** Build the Alpine and
  Blaze adapters in §3, the idempotent outbox, and the reconciliation job in §5, running in
  **shadow mode**: Engage computes and logs what it would push, nothing is actually written to
  either vendor yet. This is where correctness gets proven against real traffic without risk.
- **Phase 2 — mirror mode, time-boxed (medium, ~1-2 weeks).** Turn on real outbound writes;
  Engage and the vendors run in parallel, reconciliation job active and alerting on any
  discrepancy. This phase has an explicit end date, not an open-ended "keep both in sync forever"
  posture — mirror mode is how you find the last surprises, not a target state (§2).
- **Phase 3 — 1:1 balance import + cutover (small, ~2-3 days plus a freeze window).** Run the
  hw-sync mapping in §6 once, verify a sample of imported balances by hand against Alpine's own
  wallet page, then flip Engage to authoritative per §2. Vendors keep receiving outbound pushes;
  inbound polling/webhooks continue only for the acquisition/register-redemption paths that must
  stay vendor-initiated (§3).
- **Phase 4 — register redemption closes the loop (largest unknown, size TBD pending Phase 0).**
  This is gated entirely on what Phase 0 discovers about Blaze's write capability for real-time
  redemption checks (§3.2, highest-risk row) — cannot be sized honestly before that answer exists.

---

## 8. Probe plan, with vendor stubs

Before any phase touches a real vendor account:
1. **Alpine stub server** — a local HTTP stub replaying the census's own recorded shapes
   (`piis`, `wallet`, `adjustments`, `redemptions` — `alpine_client.py`'s own docstrings already
   describe every field), so adapter code and its probe suite run with zero live calls, following
   this estate's own `qa/*_probe.py` convention (`ENGAGE-STATUS.md`'s 357/357 pattern).
2. **Blaze stub server** — same idea for `/api/v1/partner/loyalty/promotions`/`rewards` and the
   transaction feed, seeded from real (PII-stripped) response shapes already on file from prior
   Blaze work in this estate (`CLAUDE.md`'s own "duplicate fetches" note — reuse a shape that's
   already been captured rather than guessing a new one).
3. **Idempotency/replay probe** — synthetic double-delivery of the same webhook/event id against
   both stubs, asserting exactly one ledger write per real event, mirroring `qa/engage_api_probe.py`'s
   existing "mint → GET counted → replay" pattern.
4. **Reconciliation-job probe** — seed a deliberate mismatch between Engage's ledger and a stub
   vendor balance, confirm the job flags it and does not silently self-correct.
5. Only after all four probes are green does Phase 0's real (read-only, rate-limited, already-
   built) Alpine client get pointed at production for the export, and only after Phase 1 is
   proven in shadow mode does anything write to a live vendor account.

---

## 9. Owner questions

**Q1.** Alpine's tier/program configuration could not be found through any API endpoint this
audit or the 2026-09-10 census tried (`GET /api/v2/tiers/1546` → 404). How should we get the real
export?
A) Alpine support ticket asking for an account-level config export
B) Someone with Alpine's own admin console pulls a screenshot/CSV of the tier and rewards setup
C) Accept the reverse-engineered $2,000/two-tier shape as correct (it already matches production)
and skip the export
D) Something else (say what)

**Q2.** Blaze's partner API has no discovered endpoint for writing a customer's loyalty balance
or validating a redemption in real time (§3.2). If that capability doesn't exist, register
redemption has to stay Blaze-native with after-the-fact reconciliation rather than a live check.
Which posture should Phase 4 target?
A) Ask Blaze/the POS vendor whether a real-time redemption-validation API exists or can be added
B) Accept register redemption as Blaze-native + reconciled-after-the-fact permanently, no real-time check
C) Route all redemption through Engage's own channels (SMS/web) only, and stop offering
register-side redemption
D) Something else (say what)

**Q3.** Conflict rule 3 (offline register redemption, §4) needs a policy for what happens if a
customer's post-hoc balance can't cover a reward the register already gave them offline.
A) Flag for manual review every time (no auto-debt, no auto-block of future earn)
B) Auto-deduct from future earn until the balance is even, silently
C) Cap how far negative a balance can go, and freeze redemption (not earn) past that cap until reviewed
D) Something else (say what)

**Q4.** Alpine's own campaign-trigger capability is unconfirmed (§3.1) — if it doesn't exist,
Engage's own `msg_adapter.py` would send loyalty-triggered messages directly instead of asking
Alpine to send them.
A) Confirm with Alpine whether a trigger API exists before deciding
B) Move all loyalty-triggered sends to Engage's own sender now, regardless of what Alpine offers
C) Keep loyalty-triggered sends on Alpine permanently, Engage only supplies the audience/data
D) Something else (say what)

**Q5.** Phase timing: Phase 2 (mirror mode) is deliberately time-boxed rather than open-ended
(§2, §7). How long should that window be before Phase 3 cutover is forced regardless of open
discrepancies?
A) 2 weeks, fixed
B) 4 weeks, fixed
C) Until the reconciliation job goes a full 7 consecutive days with zero new discrepancies, however long that takes
D) Something else (say what)
