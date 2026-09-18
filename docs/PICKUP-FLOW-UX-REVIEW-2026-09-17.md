# In-store pickup — flow and design review — 2026-09-17

Read-only review of the pickup flow across three surfaces: the e-commerce mocks (`/Users/jt/POS-Admin/shop/*`,
`pos/*`), the live production storefront/backend/admin (`/Users/jt/hyper-tech/*`, read-only), and the
Hyperdrive backend (`/Users/jt/wm-demo/wmdemo/*`). Nothing was edited except this file.

**Owner decisions this review respects (not re-asked):** pickup is a **mode switch** (whole cart is delivery
OR pickup at one chosen store); pickup lives on the **store-specific UI**; cart holds 10 min idle / 25 min max,
auto-shortened when busy, all settings; an out-of-stock item can never be in a cart; last unit held → not shown
as available; guests hold like members; no substitution question at checkout; no delivery fees today but a
rules-based fee engine; customers pay at arrival (Shop at Home deposits excepted); purchase limits server-side;
rewards as live-validated buttons; discounts only from the promotions engine.

---

## 0. One-paragraph verdict

Pickup exists in three disconnected pieces and none of them is the flow the owner decided on. **Live** has a
third tab ("Pick-up") beside ASAP/Scheduled that is "Coming Soon" for customers, employee-only, hard-wired to
one address (571 Crane St, Lake Elsinore), overwrites the customer's saved delivery address, reloads the page
on every switch, and ends on a status page that says "by 3:00 PM" with no stages, no code and no notification.
**The mocks** have no pickup on the storefront at all (delivery lanes only) but have a genuinely good POS-side
order queue, check-in binding, verification gate and stage machine that already say "Ready for pickup".
**The backend** has the stage machine, per-store inventory channels and a soft-reservation primitive, but no
store hours, no pickup code, no no-show clock, no customer-facing events. The decision is therefore
**MODIFY the mocks + backend (they are the right skeleton) and REWORK the live pickup UI (it is the wrong
shape: a tab, one store, no store page)**. Four new screens need four concepts each (§5).

---

## 1. The pickup flow, step by step — designed vs live vs missing

Legend: **LIVE** = real logic in production code · **MOCK** = static design/demo data · **BACKEND** = real
logic in `wm-demo` (not yet wired to a customer surface) · **MISSING** = nothing found.

### 1.1 Store selection (city/store pages, geolocation, hours, cutoffs)

| Piece | State | Evidence |
|---|---|---|
| Store-specific storefront page (menu per store) | **MISSING** on both sides | Live `app/` has no store route — `app/shop/*` is category/brand/product/deals only, `app/[template]` is CMS legal/about pages (`hyperwolf-frontend-nextjs/app/[template]/page.tsx:10-22`). Mock `shop/*` has zero pickup/store references (grep) — its header is "Deliver to Long Beach · 90804" (`shop/chrome.jsx:4, 53-62`) and the zone is a fixture (`shop/data.jsx:60`). |
| Store list / picker | **MISSING** | Live has exactly one constant `PICKUP_LOCATION` (`lib/constants.ts:64-72`). Checkout says "* Pick-up is only available at our main location." (`components/checkout/checkout-delivery-options.tsx:191-194`). |
| Geolocation / nearest store | **MISSING** for stores | Live geolocates for delivery only (`lib/store/deliveryStore.ts`, `userLocation`). |
| Store hours | **LIVE, single global** | `shopTimings.shopOpenTime/shopCloseTime`, holidays from `holidayListingData` (`components/common/DeliveryTabs.tsx:122-170`, `lib/utils/shop-status.ts`). One clock for the whole company, not per store. |
| Pickup cutoff | **LIVE, hard-coded 3:00 PM** | `getNextAvailablePickupDate` → `laHour >= 15` rolls to tomorrow (`lib/utils/shop-status.ts:166-192`); label "Same Day Pick-Up until 3:00 PM (PST)" (`:220-228`). Same literal repeated on the status page (`components/shop/order-status-content.tsx:287-303`). |
| Admin: city → Weedmaps listing | **MOCK + BACKEND (WM only)** | `pos/screen-city-listing.jsx:1-3` — one WM listing per city, rooms express/scheduled; the pickup listing is deliberately outside that model (`:502`). `delivery/dapp.jsx:337` has a Delivery/Pickup WM-pin tab. This is Weedmaps publishing, not a customer store page. |

### 1.2 Menu per store (store-specific pool, publish gate)

| Piece | State | Evidence |
|---|---|---|
| Per-store on-hand pool | **BACKEND** | `inventory.py:23-28, 125` — channel `pickup | express | scheduled` maps to one or more physical locations (safe/kit/counter); `pickup` is store on-hand. `Hyperwolf POS.html:97-99`: mode `full` = pickup storefront selling store stock. |
| Publish gate on the pickup channel | **MOCK over BACKEND** | `pos/screen-publish-gate.jsx:58` CHANNELS; `:1054-1056` `blocked_no_stock` blocks only on stock-truth modes (kits/pickup); `:1422-1423` `engine._channel_for` → `pickup` for modes full/pickup. Publishes to Weedmaps, not to our storefront. |
| Live storefront pickup menu | **LIVE, but not per store** | Product query sets `deliveryTag = "PICKUP"` (`hyperwolf-backend/controllers/blaze/product-controllers.js:292-293`, `common-controllers.js:121-122`) and the cart uses one `OverrideInventoryId` for schedule AND pickup (`app/actions/cart.ts:182, 335, 367`; `lib/constants.ts:7`). The pickup tab's item count is the **scheduled** count (`DeliveryTabs.tsx:353` `count: scheduledCount`). |
| Availability rules (OOS never in cart, last unit hidden) | **PLAN only** | `docs/CART-AND-CHECKOUT-PLAN-2026-09-17.md:130-133` pools table; `:183` pickup hold TTL; `:862` `cart.mode`. Backend has `catalog.reserve(wm_cart_id, region, requested, ttl=900)` (`catalog.py:1742-1760`) — keyed by region and Weedmaps cart, per-sku clamp, not all-or-nothing, not per store. |

### 1.3 Cart mode switch (what changes: availability, price, tax, promos, limits)

| Piece | State | Evidence |
|---|---|---|
| Mode switch control | **LIVE — as a third tab, not a mode** | `DeliveryTabs.tsx:349-353` tabs `ASAP / Scheduled / Pick-up`; checkout repeats it (`checkout-delivery-options.tsx:40`). |
| What switching does | **LIVE, destructive** | Sets cookie + Zustand, **overwrites `userLocation` with the store address** and stashes the old one in `lastSelectedLocation` (`DeliveryTabs.tsx:200-244`), writes cookies + localStorage, then `router.refresh()` (`:250-257`). Address drawer refuses to open in pickup (`deliveryStore.ts:49-52`). Cart-type conflicts are policed client-side in localStorage (`lib/utils/cart-validation.ts:33-110`). A commented-out `clearCart()` shows the mixed-cart problem was known (`DeliveryTabs.tsx:180-183`). |
| Availability review on switch | **MISSING live; PLAN in mocks** | Cart plan §3.2 review sheet (`CART-AND-CHECKOUT-PLAN:540-556`) and §3.5 (`:581-590`) say a mode switch must run the review sheet because the pool changes. Nothing draws it. |
| Price / tax | **LIVE unchanged by mode** | Blaze prices the cart; storefront memo notes "Pickup Order" and cash to collect (`checkout-container.tsx:209-220`). No per-store price or tax rate in either mock or live. |
| Promos on pickup | **LIVE — promo code hidden** | `CartDrawer.tsx:279-280`, `checkout-cart-summary.tsx:89`. Contradicts owner rule "discounts only from the promotions engine" — the engine, not the mode, should decide. |
| Purchase limits across pickup + delivery | **PLAN only** | `PURCHASE-LIMITS-PLAN-2026-09-17.md:205-207` (all channels count together, same person same day); ledger `channel (web|pos|delivery|pickup|wm|phone)` (`:483`); re-evaluate at transfer/handoff (`:504`). |

### 1.4 Checkout (ID/age, name, phone, time, curbside vs counter, notes)

| Piece | State | Evidence |
|---|---|---|
| Who can place a pickup order | **LIVE — employees only** | Place button disabled unless `memberShipGroup === EMPLOYEE` (`checkout-container.tsx:1237`); cart drawer likewise (`CartDrawer.tsx:320-321`); backend returns 400 `PICK_UP_CHECKS` for anyone else (`hyperwolf-backend/controllers/blaze/user-cart-controllers.js:536-538`, `common/toastMessages.js:312`). |
| Guest/auth block | **LIVE — hidden for pickup** | `checkout-container.tsx:1172-1173` ("Hidden for pickup in legacy"). |
| Age / DOB | **LIVE for delivery** | DOB → age computed client-side (`checkout-container.tsx:143-180`); in-store ID check is the real gate (POS). |
| Pickup time / ASAP | **MISSING** | No picker. Slot picker exists for Scheduled only (`checkout-delivery-options.tsx:196-215`). Backend: `deliveryDate/completeAfter` on cart (`app/actions/cart.ts:365-366`) unused for pickup. |
| Curbside vs counter | **MISSING** | `dropOffOption` is `discreetcurbside | meetmydoor` for delivery and is nulled for pickup (`checkout-delivery-options.tsx:112`). |
| Notes | **LIVE (delivery instructions), none for pickup** | `dropOffInstructions` only. |
| Payment | **LIVE — choose type, pay at counter** | Memo "Cash To Collect In Person" (`checkout-container.tsx:209-220`). Mock agrees: "collected at hand-over … at the counter on pickup" (`pos/screen-orders.jsx:3403-3408`). Matches the owner's rule. |
| Mock checkout | **MOCK, delivery-only** | `shop/screen-checkout.jsx:5, 200-203` refuses to place without an address; fee lines per lane `:242`. |

### 1.5 Confirmation, status, notifications

| Piece | State | Evidence |
|---|---|---|
| Confirmation email | **LIVE** | `emailTemplates/ordersEmailTemplates.js:204-262` renders "Pickup Address" instead of delivery fee/address. |
| Status page | **LIVE, static** | `order-status-content.tsx:280-303, 588-602` — one card, "You can pick up your order Today by 3:00 PM."; no Received/Preparing/Ready stages, no code, no store hours, no cancel. Delivery gets a 4-step tracker (`:355-385`). |
| Order lookup | **LIVE, unauthenticated** | `POST /api/v1/partner/onfleet` has no middleware (`routes/onfleet/onfleet-route.js:5`, `startup/routes.js:91`); controller does `Order.findOne({orderId})` and Blaze `store/cart/{cartId}?cuid=` from body values (`controllers/onFleet-integration/onfleet-controller.js:13-52`). No `express-rate-limit` `app.use` found in `startup/*.js` although the package is a dependency (`package.json:30`). |
| "Ready for pickup" notification | **MISSING live; MOCK/BACKEND text only** | Super-admin shows a **disabled, default-checked** checkbox "Ready for Pickup" (`hyperwolf-super-admin/src/components/notifications/OrderNotificationCard.jsx:79, 125`) — decoration. Backend maps stage `ready` → customer text "Ready for pickup" for Weedmaps only (`wm-demo/wmdemo/fulfillment.py:133`; mock `pos/data.jsx:304`). No SMS/email/push, no consent record. |
| Realtime | **BACKEND, store-scoped, ids-only** | `orders.store.:storeId` family exists (`realtime_channels.py:27-31`); no customer-scoped `order.<orderId>` family yet. |

### 1.6 In-store handoff and back-office queue

| Piece | State | Evidence |
|---|---|---|
| Order queue screen | **MOCK over BACKEND** | `pos/screen-orders.jsx:57-275` — default tab `pickup` (`:59`), tabs Pickup/Delivery (`:191-192`), board columns Verify → Pack → Packing → Ready → Done (`:14, 228-231`), check-in strip (`:209`), Needs-match lane. Backend `fulfillment.board()` (`fulfillment.py:707`), routes `/api/fulfillment/board|queue` (`server.py:2853-2863`). |
| Order ↔ person binding | **MOCK + BACKEND** | `pos/data.jsx:380-400` weights (handle 100, **code 99**, phone 92…); backend `checkin.match_checkin(... code=)` (`checkin.py:575`). |
| Pickup code | **BACKEND, weak** | `_code_matches` accepts any ≥4-char **suffix of the Weedmaps order id** (`checkin.py:320-330`; `checkin_api.py:120`). No generated code, not random, not single-use, not store-scoped. |
| ID check at handoff | **BACKEND, gated** | `/api/order/stage` runs the verification gate on `done` only (`server.py:4938-4975`); `verify_gate.py:39, 265` `PICKUP_HANDOFF`; counter ID scan counts as document-backed (`pos/screen-orders.jsx:174-178`). |
| Payment at counter | **MOCK** | `pos/screen-orders.jsx:3403-3408`. |
| Hand-off to Register | **MOCK seam exists** | `window.HW.startSaleFor(member, guests, items)` → `takePendingSale()` (`pos/data.jsx:1175-1176`), called from the check-in strip and match sheet (`pos/screen-orders.jsx:261, 270, 417, 481`). The register file is frozen; the seam is the third `items` argument. |
| No-show / hold time / cancel | **MISSING** | Board has **no cancelled column** — a rejected order "will not clear itself off the queue" (`pos/screen-orders.jsx:2605, 2816`). Plan names `pickup.noShowReleaseHours` (`CART-AND-CHECKOUT-PLAN:1013`) but nothing implements it. |
| Curbside arrival | **MISSING** everywhere. |
| Super-admin queue | **MISSING** | Only `OrderSetting.js:15, 176-177` (pickup minimum order value) and the static notification card. `PickupTask.jsx` is a **driver** pickup task, not customer pickup. |

---

## 2. Verdict per surface

### 2.1 Live storefront pickup (DeliveryTabs, checkout-delivery-options, order-status) — **REWORK**

The UI is the wrong shape for the decision (a third *tab* on the delivery menu, one hard-coded store, no store
page). Reworking it in place would keep every wrong assumption. Changes, most valuable first:

1. **Replace the third tab with a header mode switch: "Delivery to 90804" | "Pickup at Corona".** Phone: a
   segmented control under the logo, store name as the second line; desktop: the same control in the header
   slot the mock already uses for "Deliver to" (`shop/chrome.jsx:53-62`). UX reason: ASAP/Scheduled are
   *delivery lanes*; pickup is a different *place*. Putting them in one row is why pickup shows the scheduled
   item count (`DeliveryTabs.tsx:353`) and overwrites the customer's address.
2. **Stop overwriting the delivery address.** Keep `userLocation` and a separate `pickupStoreId`; never write
   the store into `user_address` cookies (`DeliveryTabs.tsx:200-244`, `checkout-delivery-options.tsx:63-84`).
   UX reason: switching back to delivery today restores a *guess* (`RIVERSIDE_DEFAULT_LOCATION`) if the stash
   was lost — a wrong-address order.
3. **No full page reload on switch.** `router.refresh()` (`:255-257`) blanks the menu on a phone. The server
   cart's `PUT /mode` returns the review diff; the menu re-fetches for the store pool.
4. **Run the review sheet on every switch** (cart plan §3.2): lines that are not in the store's pool are
   greyed "Not at Corona — [Pick another store] [Remove] [Switch back]". Nothing is removed without a tap.
5. **Persist the store choice server-side on the cart and in the account** (`cart.store_id`, `customer.
   preferred_store_id`), not only in a cookie; show the store name on every screen (menu header, cart header,
   checkout, confirmation, status). UX reason: wrong-store confusion is the #1 pickup complaint pattern —
   the store must be visible wherever a price is.
6. **Delete the employee gate** on the button and the server once the flow ships (`checkout-container.tsx:
   1237`, `user-cart-controllers.js:536`); keep a `pickup.enabled` per-store setting instead.
7. **Status page:** replace the static "by 3:00 PM" card with stages (Received → Preparing → Ready → Collected /
   Cancelled), pickup code + QR, store name/address/hours, "Held until 8:00 PM", "I'm here" (curbside) and
   "Cancel order" (until Packing). Phone: code and QR above the fold, stages below; desktop: two columns.
8. **Promo code visible in pickup**; the promotions engine decides eligibility (owner rule).

### 2.2 E-commerce mocks (`shop/*`) — **MODIFY** (add pickup; keep the lane design for delivery)

1. `shop/chrome.jsx` ShopDeliverTo becomes the mode switch (above). Its click goes to the store picker in
   pickup mode, the address form in delivery mode — not straight to checkout (`:99`).
2. `shop/screen-shop.jsx`/`screen-home.jsx`: in pickup mode the "⚡ Express" badges and lane maths
   (`shop/data.jsx:115-173`) are hidden; availability comes from the store pool only; "Express delivery in
   ~90 min" hero copy (`screen-home.jsx:156`) becomes "Ready in about 20 min at Corona".
3. `shop/screen-cart.jsx`: one lane bar "Pickup at Corona · Ready in ~20 min · No fee", no "Move to
   Scheduled" per line, no lane minimum; the "Held for you · about 8 min" line stays (cart plan §1.5).
4. `shop/screen-checkout.jsx`: pickup variant — store card (name, address, hours, map link, "Change store"),
   time (ASAP or a slot), counter/curbside, vehicle description if curbside, name + mobile (required for the
   ready text), consent checkbox for SMS, "Bring the ID you ordered with", payment type, rewards buttons.
   No address fields, no tip selector, no delivery fee row.
5. New: confirmation + status screen (§5). New: store picker (§5).

### 2.3 POS order queue (`pos/screen-orders.jsx`) — **KEEP, with modifications**

The board, binding, verification gate and "collected at pickup" are right. Add:

1. **Pickup-specific timers on every card:** promised-ready time, minutes waiting since Ready, "held until".
   Sort the Ready column by held-until ascending. UX reason: the budtender's question is "who is late and who
   is about to be released", not "what stage".
2. **Curbside lane or badge** with "Customer arrived · silver Civic · 3 min ago" when the "I'm here" event
   lands. Tap → "Walking out".
3. **Cancelled / Released column** (or a collapsed tray). Today a rejected or no-show order stays in its
   column forever (`:2605, 2816`). Backend needs `cancelled` and `released_no_show` stages.
4. **Pickup code entry + QR scan** in the check-in modal (`pos/checkin.jsx:1493` area) — the backend
   matcher already accepts `code`, the UI has no field.
5. **Store scoping:** the queue reads `orders.store.:storeId` for the terminal's store only; the "Pickup
   Orders" count must not include other stores.
6. **Register seam (no edit to `pos/screen-register.jsx`):** the Ready card's "Start sale" calls the existing
   `HW.startSaleFor(member, guests, items)` with the order's lines (`pos/data.jsx:1175`); the register's
   `takePendingSale()` already consumes `items`. The queue must pass `order_id` inside `items` so the sale
   records `fulfilled_order_id` and the stage advances to `done` on tender, through `/api/order/stage`, which
   runs the ID gate. Propose: add `orderId` to the pending-sale object; the register reads it if present and
   ignores it otherwise. That is one additive field, no register edit.
7. **PII on the counter screen:** show first name + last initial, last 4 of phone, pickup code; full phone and
   e-mail only inside the detail sheet, and only after the order is bound to a check-in.
8. Phone/tablet: the board's horizontal five-column grid (`:227`) needs a stacked "Ready first" list under
   768px; card buttons at `ctrlH.md` = 40px (`:481`) go to 44 (`docs/TAP-TARGET-PROPOSAL-2026-09-17.md:9-16`).

### 2.4 Check-in (`pos/checkin.jsx`) — **KEEP**; add the code/QR field and a "has a pickup order" hint.

### 2.5 Publish gate / inventory channels — **KEEP**. The `pickup` channel → store locations mapping is the
store pool. Add one read route the storefront can use: `GET /api/shop/stores/{storeId}/menu` built from the
same channel map, so Weedmaps and our storefront publish the same truth.

### 2.6 Backend (`wm-demo/wmdemo/fulfillment.py`, `checkin.py`, `catalog.py`) — **MODIFY**

- Add `fulfilment_type` (delivery|pickup), `store_id`, `pickup_code_hash`, `promised_ready_at`, `ready_at`,
  `held_until`, `collected_at`, `arrival_kind` (counter|curbside), `arrival_at`, `vehicle_note` to the order
  view; stages `cancelled` and `released_no_show`; a sweeper that releases holds at `held_until`.
- Replace the order-id-suffix code (`checkin.py:320-330`) with a generated code (§3).
- Generalise `catalog.reserve` from `(region, wm_cart_id)` to `(pool_kind, pool_id, cart_id)` and make it
  all-or-nothing per line (cart plan §8.1 `stock_hold`). The owner's OOS rule is only enforceable with a
  refuse, not a clamp.

### 2.7 Super-admin (`hyperwolf-super-admin`) — **nothing to keep** for pickup. The notification card is
static; the pickup minimum setting moves to the POS settings screen as `pickup.minimumCents` per store.

### 2.8 Live backend (`hyperwolf-backend`) — **MODIFY until cutover**: remove the employee gate, add
`storeId` to the pickup payload and Blaze `submitCart` memo (`user-cart-controllers.js:593-599`), delete the
dead `fetchScheduleRegionId` call inside the pickup branch (`:594` result unused), put auth + rate limit on
the status route (§3).

---

## 3. Security and privacy

| Rule | Today | Change |
|---|---|---|
| Pickup code unguessable, single-use | Any ≥4-char suffix of the WM order id (`checkin.py:320-330`); WM ids are sequential-looking; not single-use | Server-generated 6-char Crockford base32 (no 0/O/1/I), stored **hashed**, scoped `(store_id, business_day)`, marked `used_at` on `done`; QR encodes `order_id + code` signed HMAC (same idiom as `signed_links.py`). 5 wrong codes per check-in → lock that check-in's code entry for 10 min. |
| Order lookup never by phone alone | Status route takes `cartId/orderId/cuid/memberId` from the body with no session (`onfleet-controller.js:13-52`, route unauthenticated) | `GET /api/shop/orders/{orderId}` owner-only (session) **or** a signed single-purpose token in the SMS link (`/o/{token}`, 7-day expiry, read-only). Never accept phone, e-mail or memberId as the lookup key. |
| PII minimised at the counter | Mock cards show full name; detail sheet shows phone/e-mail | Name + last initial, last-4 phone, code on cards; full contact only in the bound detail sheet; e-mail never on the floor screen. |
| Store scoping of queue routes | `orders.store.:storeId` realtime family is scoped (`realtime_channels.py:27`); `/api/fulfillment/board` is not store-filtered (`fulfillment.board(limit_per_stage)`) | Board/queue take `store_id` from the principal's terminal, never from the query string; cross-store reads need `orders:admin`. |
| Rate limits on store lookup | None found in `startup/*.js` | Store/menu lookup 60/min/IP; mode switch 6/hour/cart (cart plan §3 security); code check 5/10 min/check-in. |
| No client-trusted totals | Live posts `customTotal` and `creditCardDetails` from the client (`user-cart-controllers.js:526-527`) | Server prices; `place` sends `expectedTotalCents` and gets `409 cart_changed` (cart plan §8.3). |
| Curbside "I'm here" | — | Authenticated or signed-token only; carries `arrival_kind` and free-text vehicle note ≤ 40 chars, sanitised; rate 3/order. |
| Consent | No consent record for SMS | `consent_event(kind=notify, channel=sms)` at checkout (cart plan §8.1); ready text only if consent exists. |

---

## 4. Data model / API / events / settings (consistent with the cart plan)

**Cart** (`cart` table, cart plan §8.1): `mode` (delivery|pickup) already there; `store_id` becomes **required
in pickup mode** and is the pool id for `store_on_hand`. One open cart per (customer, store) is already the
unique rule — a store change is therefore a *cart merge* into the new store's cart, run through the review
sheet, not a mutation of `store_id`.

**Order** additions: `fulfilment_type`, `store_id`, `pickup_code_hash`, `pickup_code_used_at`,
`promised_ready_at`, `ready_at`, `held_until`, `arrival_kind`, `arrival_at`, `vehicle_note`, `collected_at`,
`cancel_reason` (customer|store|no_show). Stage set: `verify → pack → packing → ready → done` plus
`cancelled`, `released_no_show`.

**Store** (new or extended): `store_id`, `name`, `address`, `geo`, `timezone`, `hours[]` (weekday
open/close), `holiday_overrides[]`, `pickup_enabled`, `curbside_enabled`, `pickup_last_order_offset_min`,
`prep_time_min` (default), `ready_capacity_per_15min`, `hold_hours_after_ready`.

**API (additions to §8.3):**
```
GET  /api/shop/stores?near=lat,lng                 → id, name, distance, open_now, next_open, pickup_until, curbside
GET  /api/shop/stores/{storeId}                     → hours, address, prep estimate, capacity state (Available/Filling up/Full per slot)
GET  /api/shop/stores/{storeId}/menu                → skus available in the store_on_hand pool (no counts; last-unit-held → absent)
PUT  /api/shop/carts/{cartId}/mode                  {mode:'pickup', storeId} → review diff (exists in plan)
PUT  /api/shop/carts/{cartId}/checkout/pickup       {when:'asap'|{slotStart}, arrival:'counter'|'curbside', vehicleNote?, notifyConsent}
POST /api/shop/orders/{orderId}/arrived             {arrivalKind, vehicleNote?}   (owner session or signed token)
POST /api/shop/orders/{orderId}/cancel              (until stage packing)
POST /api/order/stage                               existing; 'done' still gated (server.py:4938)
POST /api/fulfillment/{orderId}/code-check          {code} → ok | wrong (rate-limited)
```

**Realtime (ids only, per `realtime_channels.py`):**
- `orders.store.:storeId` (exists): `order.created`, `order.stage_changed`, `order.arrived`, `order.released`.
- new `order.:orderId` family, scope = order owner or signed token: `stage_changed`, `held_until_changed`,
  `released`. The client fetches the order after each event; no payload beyond ids.

**Settings (all per store, `commerce_setting` scope=store):** `pickup.enabled` (false), `pickup.curbside`
(Q2), `pickup.prepTimeMin` (20), `pickup.readyCapacityPer15Min` (6), `pickup.lastOrderBeforeCloseMin` (Q4),
`pickup.holdAfterReady` (Q1), `pickup.reminderBeforeReleaseMin` (30), `hold.pickup.ttlSec` **600** and
`hold.pickup.hardMaxSec` **1500** — the cart plan's 1200/3600 (`:953-954`) should be lowered to the owner's
10/25 decision; the auto-shorten-when-busy rule applies unchanged.

---

## 5. New screens / material redesigns — each needs four concepts (desktop + phone)

1. **Store picker + store page** (list/map, distance, open/closed, "pickup until", curbside badge; the store
   page hosts the store menu with the mode switch already set to that store).
2. **Header mode switch + review sheet** ("We updated your cart for pickup at Corona").
3. **Pickup checkout variant** (store card, time picker with Available/Filling up/Full, counter/curbside,
   contact + consent, ID reminder, payment type, rewards buttons).
4. **Pickup confirmation + live status** (code + QR, stages, held-until, "I'm here", cancel).
5. **POS queue pickup lane additions** are a modification of an existing screen (timers, curbside, cancelled
   tray, code/QR field) — one concept round is enough, but phone/tablet layout must be shown.

---

## 6. Owner questions (business only; multi-select; recommended option first)

**Q1. How long do we hold a Ready pickup order before releasing the stock and cancelling? (pick all that
apply)**
- **A. Until store close on the day it is ready, with a text reminder 60 min before close.** Pro: simplest to
  explain, never strands a customer mid-drive, matches the cart plan default. Con: slow-moving stock sits
  all day on a busy Friday.
- B. **4 hours after Ready**, reminder at 3 h. Pro: turns stock faster; predictable. Con: an order placed at
  noon for after-work pickup is released at 4 PM — needs the time picker to set expectations.
- C. **Until close next day.** Pro: friendliest for ASAP-then-forgot customers. Con: ties up stock overnight;
  the day-limit ledger must move with the handover day.
- D. **Customer-chosen at checkout (same day / tomorrow), default same day.** Pro: matches intent. Con: one
  more decision at checkout; more no-show variety for the counter.

**Q2. Curbside handoff? (pick all that apply)**
- **A. Yes, at stores with a marked bay, as a per-store setting, launch at one store.** Pro: real value for
  parents/mobility; the "I'm here" event is cheap once the status page exists. Con: staff must leave the
  counter; ID check happens at the car.
- B. **Counter only at launch; curbside in a later phase.** Pro: fewer concepts and no floor process change.
  Con: the checkout design must leave room for it or it gets bolted on.
- C. **Curbside everywhere from day one.** Pro: one flow. Con: not every lot has a safe bay; compliance
  staff must sign off handing product to a vehicle.
- D. **Curbside only for verified members with a prior in-store purchase.** Pro: lowers fraud at the car.
  Con: a rule customers cannot see and staff must explain.

**Q3. Paying for pickup orders online, later? (pick all that apply)**
- **A. Pay at arrival only, for this phase; design the checkout so "Pay now" can be added as a payment
  type.** Pro: matches the standing rule and today's live memo; no processor work. Con: no-show cost stays
  with the store.
- B. **Optional pay-now with card, next phase.** Pro: lower no-shows, faster counter. Con: refunds on
  cancel/no-show; compliance fee handling (live has a 6% card fee, `lib/constants.ts:76`).
- C. **Required deposit for orders over a threshold.** Pro: protects high-value stock. Con: friction; a second
  prepaid flow beside Shop at Home.
- D. **Pay-now only for curbside.** Pro: nobody handles cash at a car. Con: two payment rules to explain.

**Q4. When does same-day pickup ordering stop? (pick all that apply)**
- **A. Until 30 minutes before store close, per store, from store hours (replaces the fixed 3:00 PM).**
  Pro: honest, per store, no dead afternoon. Con: late orders land on the closing crew.
- B. **Keep a fixed daily cutoff (e.g. 3:00 PM) but per store.** Pro: matches the live copy customers know.
  Con: loses evening pickup entirely.
- C. **Until close, with the last 30 minutes ASAP-only (no scheduled slots).** Pro: maximum window. Con:
  ready promises get thin at close.
- D. **Cutoff follows the prep queue: stop accepting when the next ready slot would be after close.** Pro:
  never promises what cannot be packed. Con: cutoff moves; needs the capacity model working first.

**Q5. What does the ASAP promise say? (pick all that apply)**
- **A. "Ready in about N min", N from a per-store prep setting plus queue depth, rounded to 5, never under
  15.** Pro: honest and self-correcting; the plan already rounds ETAs. Con: needs the queue-depth signal.
- B. **A fixed "Ready in 20 min" everywhere.** Pro: simplest copy. Con: false on a busy night; the status
  page has to walk it back.
- C. **No time at all: "We'll text you when it's ready".** Pro: never wrong. Con: customers ask the counter
  instead; lower conversion.
- D. **A window: "Ready in 20-35 min".** Pro: forgiving. Con: wide windows read as vague on a phone.

---

## 7. Citations index (paths absolute)

- Mocks: `/Users/jt/POS-Admin/shop/chrome.jsx`, `shop/data.jsx`, `shop/screen-cart.jsx`,
  `shop/screen-checkout.jsx`, `shop/screen-home.jsx`; `pos/screen-orders.jsx`, `pos/data.jsx`,
  `pos/checkin.jsx`, `pos/screen-publish-gate.jsx`, `pos/screen-city-listing.jsx`, `Hyperwolf POS.html`,
  `delivery/dapp.jsx`. (`pos/screen-register.jsx` read only for the seam; not edited.)
- Live: `/Users/jt/hyper-tech/hyperwolf-frontend-nextjs/components/common/DeliveryTabs.tsx`,
  `components/checkout/checkout-delivery-options.tsx`, `components/checkout/checkout-container.tsx`,
  `components/shop/order-status-content.tsx`, `components/cart/CartDrawer.tsx`, `lib/store/deliveryStore.ts`,
  `lib/utils/shop-status.ts`, `lib/utils/cart-validation.ts`, `lib/constants.ts`, `app/actions/cart.ts`;
  `/Users/jt/hyper-tech/hyperwolf-backend/controllers/blaze/user-cart-controllers.js`,
  `controllers/blaze/product-controllers.js`, `controllers/onFleet-integration/onfleet-controller.js`,
  `routes/onfleet/onfleet-route.js`, `startup/routes.js`, `emailTemplates/ordersEmailTemplates.js`;
  `/Users/jt/hyper-tech/hyperwolf-super-admin/src/components/notifications/OrderNotificationCard.jsx`,
  `src/components/CardSetting/OrderSetting.js`.
- Backend: `/Users/jt/wm-demo/wmdemo/fulfillment.py`, `server.py`, `verify_gate.py`, `checkin.py`,
  `checkin_api.py`, `inventory.py`, `catalog.py`, `realtime_channels.py`, `order_lines.py`,
  `pos_sale_lines.py`.
- Plans: `/Users/jt/POS-Admin/docs/CART-AND-CHECKOUT-PLAN-2026-09-17.md`,
  `PURCHASE-LIMITS-PLAN-2026-09-17.md`, `LOYALTY-INTEROP-PLAN-2026-09-17.md`,
  `REWARDS-REDEMPTION-UX-AUDIT-2026-09-17.md`, `MOBILE-READINESS-AUDIT-2026-09-17.md`,
  `TAP-TARGET-PROPOSAL-2026-09-17.md`, `NAV-RAIL-IA-2026-09-17.md`, `REALTIME-ARCHITECTURE-2026-09-17.md`,
  `SHOP-AT-HOME-PLAN-2026-09-17.md`.
