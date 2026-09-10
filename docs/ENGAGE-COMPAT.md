# Engage → production compatibility

For the Hyper-Tech dev team porting the Engage spine (`docs/ENGAGE-PLAN-2026-09-10.md`,
`docs/ENGAGE-BUILD-CONTRACT.md`) into the twelve production repos. Production side is
**read-only reference** — every citation below is `repo/path:line` under `/Users/jt/hyper-tech`,
verified by direct read, not from memory. Where verification was not possible, that is stated
rather than guessed.

Companion docs: `docs/codebase-audit/CANONICAL-DATA-MODEL.md` (cross-repo conventions),
`docs/codebase-audit/gaps/engage-and-promotions.md` (our own screens vs `contracts/`).

---

## 1. Table/route → production mapping

Our side is the wm-demo schema in `ENGAGE-BUILD-CONTRACT.md` §1 (not yet built — Phase 0). "PROD"
columns are what exists today; blank cells under PROD mean the concept has no production
counterpart (see §2, Gaps).

### 1.1 Identity

| Ours | Field | Type/unit | PROD counterpart | Field | Type/unit | Notes |
|---|---|---|---|---|---|---|
| `hw_identities` (+cols) | `id` | int autoincrement | `blazeusers` | `_id` (ObjectId) | 24-hex | no shared key today — join is by phone/email at call time |
| | `phone_e164` | plaintext, tier-1 match key | `hyperwolf-backend/models/BlazeUser.js` | `userData` | `Object`, untyped | phone lives **inside** the untyped Blaze mirror blob, not a schema field (`BlazeUser.js:7-25`, no fixed shape) |
| | `email_hash` | sha256 | | `email` | plaintext, required | production never hashes email; **do not** treat `email_hash` as derivable from prod without the plaintext — capture it once at import, never re-derive |
| | `external_ids_json` | `[{source,id}]`, `contracts.ExternalId` | — | — | — | no external-id concept in any production Person model (§2 gap) |
| | `favorite_store_id`, `timezone`, `tags_json`, `created_source` | — | — | — | — | net-new, no prod field |
| `hemp-backend/models/Member.js` (web member, hemp/stilo only) | — | — | | `memberId` | `String`, `Math.random()`-generated | (`Member.js:6`) treat as an `external_ids` entry `{source:"hwpos", id: memberId}`? No — `hwpos` `IdSource` value in `contracts/index.js:97` is reserved for our POS id; use a new alias or map memberId under `IdSource` `hyperwolf` since Member is hemp/stilo-scoped, not Blaze-scoped — **flag for dev-team decision**, not settled here |
| | | | | `phone` | plaintext, unique (`Member.js:13`) | match key, hemp/stilo only |
| | | | | `walletAmount` | `Number`, **dollars** (`Member.js:34`) | legacy wallet cents-equivalent; convert once at adapter (§5) |
| | | | | `klaviyoProfileId` | `String` (`Member.js:26`) | dead reference — no live Klaviyo integration found (SendGrid is the only email sender confirmed, §1.4) |
| | | | | `dob` | `Number` epoch, not `Date` (`Member.js:9`) | ISO↔epoch-ms conversion needed both ways |
| customer_id (new, this plan) | — | int | **nothing** | — | — | orders/sales carry no customer reference today — see §2 gap #1 |

### 1.2 Ledger / wallet / loyalty

| Ours | Field | Type/unit | PROD counterpart | Field | Type/unit | Notes |
|---|---|---|---|---|---|---|
| `loy_ledger` | append-only, `delta` INTEGER points | | **none** | — | — | no ledger anywhere in production; closest analog is `Member.walletAmount` (dollars, mutable field, no history) and `Order.alpineIQPoints` (`hyperwolf-backend/models/Order.js:23`, `Number`, default 0, **not** a ledger — a per-order snapshot) |
| `loy_wallet.balance` | cached rollup, points | | Alpine IQ wallet | `loyaltyPoints` | live remote value | read **live, per call**, by phone search: `getWolfPack` (`hyperwolf-backend/controllers/blaze/user-cart-controllers.js` ~1037-1073, confirmed call at line ~1039 `GET /api/v1.1/piis/1546?search=${phone}&limit=1`) — there is no local cache to reconcile against; our nightly-reconcile pattern has no production equivalent to reconcile with until the ledger ships |
| `loy_redemptions` | `code`, `state issued\|applied\|expired\|refunded` | | Alpine redemption | client-built `redemptionURL` | opaque string | `getRequest`/`putRequest('alpine', splitedUrlsArray[i], ...)` in `user-cart-controllers.js` ~853-877 (redemption block starts ~855, `redemptionURL` read at line ~860, `.slice(24)` at ~862, PUT at ~875) — **no redemption row of record**, no idempotency key, no state machine; production trusts whatever URL the client sends (see §4 security) |
| `loy_ledger.source_type='pos_sale'` earn | | | points-adjust write | `putRequest('alpine','/api/v1.1/adjust/loyaltyPoints/1546/${contactId}', ...)` | | `blaze-integration-controllers.js` ~997 and ~1015 (order-cancellation reversal + re-add, inside `checkOrderApproval`→`orderStatusFunction`, starts line 775); also `alpine-controllers.js:89` (`getUnlockableDeals`, value from `req.body.value` directly, line ~75-76) |
| `loy_tier_memberships.tier_id` | one of our tier ladder | | none stored | — | — | tiers are Alpine-side only, no local field; register (300/1000/2000), consumer app (1000/2500/3500), Engage (Seed…Diamond) and the contract draft (bronze…platinum) are four vocabularies that never map to each other or to Alpine (per plan §1) |
| `loy_programs.currency='points'` | | | — | — | — | N/A, no currency concept needed prod-side beyond dollars |

### 1.3 Consent / suppression

| Ours | PROD counterpart | Notes |
|---|---|---|
| `consents` (append-only, hash-chained) | **none** | no consent table in any repo. `Member.isVerified` (`Member.js:31`) is age/identity verification, not marketing consent. `alpineUserRegister` (`hyperwolf-backend/common/utils.js:1241-1289`) sends `loyalty:true` and separately PUTs `/api/v1.1/optin/1546/${mobilePhone}/true` (utils.js ~1283) and `/api/v2/optin/email/${response.email}/true` (~1284) — an **opt-in fire-and-forget**, no state row, no source, no legal-text hash, no way to prove consent later |
| `suppressions` | **none** | `sendGridFunction.js` (`hyperwolf-backend/common/sendGridFunction.js`, 22 lines, full file) has no bounce/complaint handling at all — errors swallowed to console (line ~20); no suppression list exists |
| inbound STOP/HELP/START | **none found** | `textVolt-controllers.js` (`hyperwolf-backend/controllers/textVolt/`) is not the live SMS path — see §3; no consent-relevant inbound webhook found in any repo scanned |

### 1.4 Messaging

| Ours | PROD counterpart | Notes |
|---|---|---|
| `messages` / `message_sends`, channel sms\|email\|push\|wallet | Email: `sendGridEmail({to, templateId, data})` (`sendGridFunction.js:5`) | thin SendGrid wrapper, template-id driven, no send-state tracking, no policy chain |
| | SMS: `airCallMethod` (`hyperwolf-backend/common/utils.js:1584`), not TextVolt despite the file name | POSTs to `/numbers/${airCallSendNumber}/messages/native/send` (utils.js:1598), Basic-auth via `AIRCALL_USERNAME`/`AIRCALL_PASSWORD` (utils.js:71-72). `textVoltMutationMethod` (`utils.js:1141`, real GraphQL `createMessage`) exists but **every call site is commented out** (`textVolt-controllers.js:48,88,149`; also dead at `blaze-integration-controllers.js:749,1064`, `weedmap-controllers.js:60`) |
| `message_sends.state` (queued/held/blocked/sent/...) | none | Aircall/SendGrid calls are fire-and-forget; no delivery/open/click state stored |
| policy-chain verdicts | none | no frequency cap, quiet hours, or content policy check anywhere in the SMS/email paths found |

### 1.5 Promotions / rules

| Ours | Field | PROD counterpart | Field | Notes |
|---|---|---|---|---|
| `engage_promotions` (reserved, Phase 4) rule DSL `{path,op,value}` | | `promotion-backend/models/Promotion.js` | `rule`/`actions`/`rules`/`ruleTree` | all `Mixed` (untyped blobs, `Promotion.js:96-116`) |
| | `status` | | `status` | enum `["active","inactive"]` only (`Promotion.js:47`) — no draft/scheduled/paused/ended; matches `contracts/index.js:89` `PromotionStatus` only if narrowed, see §2 gap #5 note |
| | `stores_json`, `channels_json` | | — | **absent** — `Promotion.js` has no store/channel field at all (confirmed by direct grep, not merely unmentioned) |
| `engage/rules.py TRAIT_CATALOG` → `ALIASES` (`cart_total`, `days_since_last_purchase`, `purchase_count`, `loyalty_tier`, `upcoming_birthday`, `category_id`, `product_brand`) | | `promotion-engine/rule-types/*/definition.js` | condition/action attribute maps | confirmed present: `cart_total` (`rule-types/cart/definition.js:2`), `category_id` (`cart/definition.js:8`, also `product/definition.js:3`), `days_since_last_purchase` (`user/definition.js:25`, dup'd `product/definition.js:23`), `upcoming_birthday` (`user/definition.js:24`), `loyalty_tier` (`user/definition.js:18`), `purchase_count` (`user/definition.js:3`), `product_brand` (`product/definition.js:14`) — **all seven aliases confirmed real, all mapped correctly by name** |
| | | `promotion-backend/models/Rule.js` | `rule_type` enum | `["cart","user","product","bogo"]` only (`Rule.js:13`) — **`time` and `payment` rule-type directories exist in `promotion-engine/rule-types/` but have no schema-level representation in `promotion-backend`**; a rule exported with `rule_type:"time"` will fail Mongoose validation |
| | | `promotion-backend/models/Rule.js` | `attributes` enum | `each_or_any, cart_total, cart_count, category_id, product_id, user_group, mp_id` only (`Rule.js:24-32`) — narrower than the definition.js vocabularies; `loyalty_tier`/`product_brand`/`days_since_last_purchase`/`upcoming_birthday` would **not validate** against this enum today (schema-DB mismatch, dev team must widen it or export bypasses this model) |
| stacking/priority (`priority INTEGER`) | | `promotion-engine/core/resolver.js` | `resolveCartPromotions` (line 49) | no `priority`/`store`/`channel`/`audience` token anywhere in this file (grepped, zero matches); order is purely **caller-supplied array order**, and iteration continues (not break) after the first non-stackable promo is applied (lines ~61-63) — functionally single-non-stackable-then-stop but written as a full-loop continue |
| `promotions/from-prompt` interpretation audit | | — | — | frontend has a UI-only `promotionCreteria` (misspelled, `hyperwolf-super-admin/src/layouts/promo/data.js:2789`) explicitly stripped before the API call (`data.js:4` comment: "creteria is UI-only"; confirmed again in `PromoSummary.md:84`, sample payload) — **the misspelling never reaches the backend today**; if Engage's export path ever serializes a `creteria` key it must match this exact spelling or the frontend's own reconciliation breaks (rule of the road §5) |

### 1.6 API surface (our wm-demo routes → nearest production route)

| Ours (`ENGAGE-BUILD-CONTRACT.md` §2) | Nearest PROD route | Notes |
|---|---|---|
| `POST /api/engage/points/earn|redeem|adjust` | `PUT /api/v1.1/adjust/loyaltyPoints/1546/:contactId` (Alpine, via `alpine-controllers.js`, `blaze-integration-controllers.js`) | no idempotency key, no local record, unauthenticated (see §4) |
| `GET /api/engage/points/<customer_id>` | `GET /api/v1/partner/store/cart/wolfpack` (`user-cart-controllers.js:995`, `getWolfPack`) | live remote read every call, no cache |
| `POST /api/engage/loyalty/redeem` | `submitCart` redemption block (`user-cart-controllers.js` ~518-880) | client supplies `redemptionURL`, see §4 |
| `POST /api/engage/consent` | `alpineUserRegister` opt-in PUTs (`common/utils.js:1283-1284`) | fire-and-forget, no row |
| `POST /api/engage/messages/<id>/send` | `sendGridEmail` / `airCallMethod` | no policy chain, no send-state |
| `POST /api/promos/eligible` (replaces `PROMO_CODES`) | `POST /api/v1/engine/evaluate` (`promotion-engine`) | `validationMiddleware` only — body-shape check, not auth (see §4) |
| `POST /api/promos/internal` | `POST /api/v1/admin/promotion/create` (via `promotion-engine`) or legacy `POST /api/v1/admin/promotion` (per-platform backend) | `hyperwolf-super-admin/src/redux/apis/promotion.js` calls **both** depending on function — promotion-engine for product/category/brand listing + CRUD, legacy per-platform backend for cart/product rule types and CSV download (comment at `promotion.js:105`: "no promotion-backend routes yet" for those) |
| `POST /api/engage/import/alpine` | Alpine IQ REST, called via `getRequest`/`putRequest('alpine', ...)` throughout `alpine-controllers.js` | see §3 for the export endpoints already exercised |

---

## 2. Gaps production must add

Each gap: exact change, why. Ordered roughly by what blocks what.

| # | Gap | Model/route change | Why |
|---|---|---|---|
| 1 | No customer id on orders | Add `customer_id` (String, 24-hex or our int, TBD by dev team) to `hyperwolf-backend/models/Order.js` (currently only `paymentId`/`cuid`/`orderId`, `Order.js:6-8`) and to the POS sale write path | Without this, `loy_ledger.source_ref` and any per-customer join is reconstructed by phone/email search on every read — exactly the `getWolfPack` pattern (`user-cart-controllers.js:995`) this plan exists to replace |
| 2 | No consent table | New `consents` collection/table, minimum shape `{customer_id, channel, state, source, legal_text_sha, at}` (append-only) | `alpineUserRegister`'s opt-in PUTs (`utils.js:1283-1284`) are the only trace of consent today and record nothing queryable; cannot prove consent at send time or on a compliance request |
| 3 | Points ledger with idempotency, replacing `Order.alpineIQPoints` | New `loy_ledger`-equivalent collection; `Order.alpineIQPoints` (`Order.js:23`, bare `Number`) becomes a derived/cached read, not the write target | Current writes are two sequential Alpine PUTs with **no idempotency key** (`blaze-integration-controllers.js:990,1015`) — a retried webhook double-adjusts points; also `getUnlockableDeals` (`alpine-controllers.js:89`) takes `value`/`note` straight from `req.body` (lines ~75-76) with no record of what was granted or why |
| 4 | No store/channel/audience attributes in the promotion engine | Add `store_id`/`channel` fields to `promotion-backend/models/Promotion.js` (currently absent, confirmed by grep) and corresponding condition support in `promotion-engine/core/resolver.js` (currently reads neither token) | Engage's promotion export assumes store/channel scoping (plan §2); without it, an exported rule with a store restriction silently applies everywhere |
| 5 | No auth on promotion-engine or promotion-backend routes | Add auth middleware to `promotion-engine/routes/promotion-routes.js` (`/compile-promotion` and `/consume-usage` currently have **zero** middleware; `/evaluate` and `/userPromotions` have body-validation only, not auth) | `/consume-usage` mutates `promoUsage` and upserts `promotionusages` (`promotion-controllers.js:414-418,458`) with no caller identity check — anyone who can reach the route can consume promo inventory |
| 6 | No unsubscribe path | Add bounce/complaint webhook handling to `hyperwolf-backend/common/sendGridFunction.js` (currently 22 lines, errors swallowed to console, no suppression write) | SendGrid sends will keep hitting bounced/complained addresses indefinitely; also blocks RFC 8058 one-click unsubscribe (plan §2) |
| 7 | No derived-parameter table | New `derived_parameters` collection mirroring our `engage/rules.py:register_derived_parameter` | Production has no concept of "a parameter the system lacks becomes a create-it-from-this-field card" (plan §2) — every attribute is hardcoded in `Rule.js`'s closed `attributes` enum (`Rule.js:24-32`) |
| 8 | No prompt+interpretation audit | New column/table on the promotion or a sibling audit collection: `prompt`, `interpretation_json` | Nothing today records what a marketer asked for vs. what rule was compiled; `engage_promotions` (our schema, reserved) already carries this — production has neither the fields nor the audit habit |
| 9 | No journey/run tables | New `journeys`/`journey_nodes`/`journey_edges`/`journey_runs` collections | No campaign/journey entity exists anywhere in production (confirmed by the plan's own survey, §1); closest is the abandoned-cart cron (`order-controllers.js:916`, `checkCartStatus`, invoked from `startup/nodeCrons.js:83`) which is a single hardcoded email step, not a graph |
| 10 | `rule_type` enum excludes `time`/`payment` | Widen `promotion-backend/models/Rule.js:13` enum from 4 to 6 values | `promotion-engine/rule-types/time/definition.js` and `.../payment/definition.js` are real, populated rule-type directories with no schema path to persist through `Rule.js` |
| 11 | `attributes` enum far narrower than the rule-type vocabularies | Widen `Rule.js:24-32` (7 values) to include at minimum `loyalty_tier`, `product_brand`, `days_since_last_purchase`, `upcoming_birthday` | These exist and are used in `promotion-engine/rule-types/{user,product}/definition.js` but cannot be persisted as a `Rule` document today — a real vocabulary/schema mismatch, not a naming gap |
| 12 | No idempotency anywhere in the Alpine write paths | Add an idempotency key parameter to the points-adjust and redemption call sites (`blaze-integration-controllers.js:990,1015`; `alpine-controllers.js:89`; `user-cart-controllers.js:875`) | Matches gap #3; called out separately because it also affects redemption, not just earn/adjust |
| 13 | No local record of a redemption | New `loy_redemptions`-equivalent row written **before** the Alpine PUT in `user-cart-controllers.js` (~875) | Today a redemption is only ever a side effect on Alpine's server; if the PUT fails partway or the response is lost, production has no record a redemption was attempted |
| 14 | Tier ladder never persisted or reconciled | New `loy_tier_memberships`-equivalent; pick one ladder of record (plan §9 escalation, still open) | Four ladders exist (register, consumer app, Engage, contract draft) and none is stored against a customer row anywhere in production |

---

## 3. Migration path from Alpine IQ

**Endpoints the code already calls** (so the importer reuses proven paths, not new ones):

| Alpine endpoint | Called from | Use for import |
|---|---|---|
| `GET /api/v1.1/piis/1546?search=<phone>&limit=1` | `user-cart-controllers.js` ~1039 (`getWolfPack`) | contacts + current point balance, keyed by phone |
| `GET /api/v1.1/adjust/loyaltyPoints/1546/<contactId>` (write) / implied read via the adjust log if Alpine exposes one | `alpine-controllers.js:89`, `blaze-integration-controllers.js:990,1015` | **write-only calls seen; no read-history endpoint confirmed in this codebase.** If Alpine exposes a points-history/ledger export API, it was not found in any of the 13 files read — the importer will need Alpine's own export tooling (CSV or a documented API not called by this codebase) for historical ledger reconstruction. Flag to owner (plan §9 already lists "Alpine export access... API key scope or CSV" as open). |
| `POST /api/v2/loyalty` | `common/utils.js:1271` (`alpineUserRegister`) | the registration shape (`firstName, lastName, mobilePhone, email, favoriteStore, loyalty, address`) — useful as the inverse: shows exactly what fields Alpine expects, which is what an export should produce for round-trip validation |
| `PUT /api/v1.1/optin/1546/<phone>/true`, `PUT /api/v2/optin/email/<email>/true` | `common/utils.js:1283-1284` | opt-in state (binary only — no timestamp/source captured today, so imported consent rows will need `source:"import"` and an import-run timestamp, not a real historical `at`) |
| referral code lookup/apply | `alpine-controllers.js:108` (`getRefCode`), `:239` (`applyRefCode`) | referral program import, if in scope |

**Import order** (dependency-driven): contacts/identity → consents (opt-in state only, not history) → loyalty balances (`piis` search, one call per known phone — no bulk export endpoint found; this will be slow at scale and worth flagging to the owner before running against the full customer list) → campaigns (not found — no campaign entity exists in Alpine calls made by this codebase; Alpine's own campaign API, if any, was never located in the 13 files read, so `kind:campaigns` in `POST /api/engage/import/alpine` may have nothing to import from this integration and should degrade to an empty run report rather than fail).

**Dual-run window**: keep the eight-plus call sites (see below) live and writing to Alpine *and* the new ledger/consent tables simultaneously until a reconciliation pass shows the new `loy_wallet.balance` matches the last-read Alpine `loyaltyPoints` for a sample of customers. Because there is no ledger today, "dual-run" here means: new writes go to both systems, reads shift to the new local tables only after the reconciliation pass, not before.

**The call sites to switch** (verified 17 hardcoded-project-id sites across 4 files, more than the plan's "eight" estimate — listing all for completeness):

1. `common/utils.js:1283` (`alpineUserRegister` opt-in, SMS)
2. `common/utils.js:1284` (`alpineUserRegister` opt-in, email)
3. `alpine-controllers.js:33` (`getReedemPoints`)
4. `alpine-controllers.js:73` (`getUnlockableDeals`, read)
5. `alpine-controllers.js:89` (`getUnlockableDeals`, write — points adjust)
6. `alpine-controllers.js:128` (`getRefCode`)
7. `alpine-controllers.js:141` (`getRefCode`, continued)
8. `alpine-controllers.js:177` (`getRefCode`, continued)
9. `alpine-controllers.js:194` (`alpinePhoneUser`)
10. `alpine-controllers.js:207` (`alpinePhoneUser`, continued)
11. `alpine-controllers.js:218` (`applyRefCode`)
12. `alpine-controllers.js:224` (`applyRefCode`, continued)
13. `alpine-controllers.js:255` (`alpineRecProducts`)
14. `alpine-controllers.js:302` (`alpineRecProducts`, continued)
15. `user-cart-controllers.js:1039` (`getWolfPack`, balance read)
16. `user-cart-controllers.js:1052` (`getWolfPack`, continued)
17. `blaze-integration-controllers.js:975,997,1015` (`checkOrderApproval` order-cancellation reversal — 3 calls, counted as one switch site since they share one code path)

Plus the 5 `redemptionURL` sites across `stilo-backend` and `hemp-backend` (not hyperwolf-backend, so not in the count above but in scope if the dev team ports this pattern estate-wide): `stilo-backend/controllers/cart/cart-controllers.js:1896-1898`, `stilo-backend/controllers/POS/pos-controllers.js:1363-1365`, `hemp-backend/controllers/POS/pos-controllers.js:753-755`, `hemp-backend/controllers/cart/cart-controllers.js:3461-3463`.

**Rollback**: because every write above is a live remote call with no local system of record, rollback is "stop calling the new ledger/consent tables, resume trusting Alpine's live response" — there is no data migration to undo on the production side since nothing is deleted from Alpine during the dual-run window. The risk is one-directional: once the new ledger becomes the write target and Alpine calls stop, reverting means replaying whatever local ledger deltas accumulated back into Alpine's `/adjust/loyaltyPoints` endpoint, in order, which is not automated by anything found in this codebase and would need to be built as part of the cutover, not assumed to exist.

---

## 4. Security deltas checklist

| Finding (from `docs/codebase-audit/gaps/engage-and-promotions.md` and this read) | Verified at | Fix |
|---|---|---|
| Unauthenticated `/alpine` routes | `hyperwolf-backend/routes/alpine/alpine-routes.js` — zero middleware on all 8 routes; mounted with no wrapper at `startup/routes.js:98` (`app.use('/api/v1/alpine', alpineRoutes)`) | Add `auth` middleware (JWT, same as `middlewares/auth.js:13` `jwt.verify(..., JWT_ADMIN_PRIVATE_KEY)`) to every alpine route, minimum on the two writes (`getUnlockableDeals` points-adjust, `applyRefCode`) |
| Client-supplied `redemptionURL` | `user-cart-controllers.js` ~853-877 (read at ~860, sliced at ~862, PUT'd at ~875); same pattern at 4 more sites across stilo/hemp (§3 list) | Server must construct the Alpine path itself from a stored `reward_id`/`redemption_id` it issued, never accept a URL fragment from the client; this is the exact vulnerability our `loy_rewards.redeem` atomic flow (`ENGAGE-BUILD-CONTRACT.md` §2 `rewards.py`) is designed to prevent by minting the redemption server-side first |
| `PUBLIC_TOKEN` shared secret | `admin.js` in `stilo-backend`, `hemp-backend`, `distribution-backend`, `hyperwolf-backend` (each `middlewares/admin.js:1`, header `x-auth-token` or `?token=`, compared to `process.env.PUBLIC_TOKEN`) — **absent** from `promotion-engine`/`promotion-backend` entirely | Replace with per-actor JWT (already the pattern in `auth.js`) or, at minimum, rotate the shared secret and stop accepting it via query string (`req.query.token` is logged in every access log and proxy) |
| No rate limiting | Confirmed present **only** in `stilo-backend/startup/routes.js:56-74` (`/ping` only) and `hemp-backend/startup/routes.js:53-87` (`/ping` + 4 login/forgot routes); **absent** from `hyperwolf-backend`, `promotion-engine`, `promotion-backend`, `distribution-backend` — none of the alpine, `/submitCart`, `/wolfpack`, or promotion-engine routes are rate-limited anywhere | Add `express-rate-limit` to `/api/v1/alpine/*`, `/api/v1/partner/store/cart/submitCart/:id`, `/api/v1/partner/store/cart/wolfpack`, and `/api/v1/engine/*` — the pattern to copy already exists in `hemp-backend/startup/routes.js:62-77` |
| `/consume-usage` and `/compile-promotion` unauthenticated | `promotion-engine/routes/promotion-routes.js` — zero middleware on both; `/evaluate`/`/userPromotions` have `validationMiddleware` (body-shape) only, not auth; mount at `promotion-engine/startup/routes.js` has no app-level auth wrapper; repo-wide grep for inbound auth logic in this repo found none (`promotion-engine/utils/common.js:10,1026,1131` is an **outbound** auth header for calling Blaze, not inbound gating) | Add auth middleware to all four routes at minimum; `/consume-usage` mutates `promoUsage`/`promotionusages` (`promotion-controllers.js:414-418,458`) and must not be callable by an unauthenticated party |
| `partnerAuth.js` is not authentication | `partnerAuth.js:6` — logic bug: `if (!req.headers["Authorization"] || req.headers["authorization"])`, the second clause is truthy whenever a lowercase header is present regardless of the first; it injects outbound `Authorization`/`X-API-KEY` from env and always calls `next()` | Not a gate at all — rename/refactor so it cannot be mistaken for one; any route relying on `partnerAuth` for protection is unprotected |
| No idempotency on money/points writes | `blaze-integration-controllers.js:990,1015`, `alpine-controllers.js:89`, `user-cart-controllers.js:875` — none carry an idempotency key | See gap #3/#12; a retried webhook or client retry double-writes points today with no detection |
| No bounce/complaint suppression | `sendGridFunction.js` — errors swallowed to console (~line 20), no webhook handler found in the repo | See gap #6 |

---

## 5. Rule of the road

- **Money in cents at our boundary, converted once at the adapter.** Production stores dollars as
  `Number` throughout (`Order.customTotal`, `Member.walletAmount`, `Products.totalPrice` — all
  confirmed `Number`, no `Decimal128`, no cents). Convert dollars→cents on read into our tables,
  cents→dollars on write back to any production field. Never carry a cents value into a production
  `Number` field or a dollars value into ours.
- **Enums verbatim, including production's misspellings, so exports compile.** `creteria`
  (`hyperwolf-super-admin/src/layouts/promo/data.js:2789`) is frontend-only and stripped before
  the backend call (`data.js:4`, `PromoSummary.md:84`) — if Engage ever serializes a rule payload
  that a legacy screen re-parses, match the frontend's exact key, not a corrected spelling. Same
  discipline for the leading-space action value `" bundle_with_high_demand_product"`
  (`promotion-engine/rule-types/product/definition.js:45`, copied into
  `promotion-backend/common/index.js:9437`) — trim only at the boundary that consumes it, never
  rename the source string.
- **Never rename a production field in our adapter.** `alpineIQPoints`, `walletAmount`,
  `redemptionURL`, `cuid` stay exactly as spelled in the adapter layer even where our own schema
  uses a cleaner name (`delta`, `balance_cents`, `redemption_id`) — the adapter is the translation
  point, not a place to "fix" production's naming.
- **Every mapping in §1 needs a drift test in `contracts/`.** `contracts/index.js` already carries
  `PromotionStatus`, `RuleType`, `IdSource` (includes `alpineiq`, `hyperdrive` — `contracts/index.js:97`),
  `NotificationChannel`, and `ExternalId` (`{source, id}` shape, `contracts/index.js:309-315`). Add
  one drift-test case per row in §1's mapping tables under `test/contracts.test.mjs` (existing
  pattern) so a field rename on either side fails CI instead of silently breaking the adapter.
  `RuleType` already includes `time`/`payment` in `contracts/index.js:91` even though
  `promotion-backend/models/Rule.js:13` does not — the contract is ahead of production here; the
  gap is production's schema, not the contract (see gap #10).

---

## 6. What could not be verified

- **No Alpine points-history/ledger read endpoint was found** in any of the 13 production files
  read — only write (`adjust/loyaltyPoints`) and single-contact read (`piis` search) calls exist
  in this codebase. Whether Alpine exposes a bulk/historical export API is unknown from the code;
  confirm with Alpine's own API docs or the account dashboard before scoping the importer's
  historical-ledger reconstruction.
- **No Alpine campaign entity or API call was found**, so the plan's `import/alpine kind:campaigns`
  path may have nothing to import via the endpoints this codebase calls.
- **`hemp-backend/models/Member.js` → our `customer_id` mapping is not settled.** The task brief
  says "customer_id ⇄ blazeusers.userData.memberId (POS) and cuid (web)" but `Member.memberId`
  (hemp/stilo) is a third, separate identifier with no observed join to `BlazeUser` or `cuid`
  anywhere in the 19 files read. Whether hemp/stilo members and Blaze users are the same people
  under different ids, or genuinely separate customer bases, was not determined by this read and
  needs a dev-team or owner call before the identity-join code is written.
- **`hemp-backend`/`stilo-backend` versions of `alpine-controllers.js`-equivalent code were not
  read** — this document covers `hyperwolf-backend`'s Alpine integration only, since that is what
  the task's file list specified. The five `redemptionURL` sites found by grep in stilo/hemp
  (§3) confirm the same vulnerability pattern exists there, but their full call chains were not
  traced line-by-line the way `hyperwolf-backend`'s was.
- **Whether `promotion-engine`'s `resolver.js` is used for register/POS-side promo application, or
  only web cart**, was not determined — the resolver file itself has no store/channel awareness
  either way, so the gap (#4) holds regardless, but the blast radius of adding store scoping (which
  callers would need to start passing a store_id) was not traced beyond `resolver.js` itself.
- **Whether `admin.js`'s `PUBLIC_TOKEN` is the same value as our own `.claude/hooks` guard's
  "classifier-blocked" Airtable/Script-Properties boundary** is unrelated and not applicable —
  noted only to rule out confusion between the two "PUBLIC_TOKEN"-shaped concepts in different
  parts of this estate.
