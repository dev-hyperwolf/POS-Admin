# Shop at Home Plan — appointment-based VIP house calls, the one prepaid deposit flow

Owner framing (JT, 2026-09-17): Shop at Home is **appointment-based** — the customer books online
and pays a **$100 deposit in advance**, the **only** pre-paid flow in the estate; every other order
(delivery, pickup, Express) is charged **at arrival**. A driver/associate brings a curated selection
to the customer's home and the customer shops there. Back-end screens exist and lean on the same
e-commerce plumbing as the rest of the storefront.

All of §1 is read from static mock UI (`/Users/jt/POS-Admin`). **None of it is live logic** — no
`fetch`/API call exists anywhere in `athome/*.jsx`, `mobile/screen-appointment.jsx`, or
`Shop at Home.html`'s script chain (checked directly, zero hits). There is no backend support today:
`wm-demo/wmdemo` has zero files matching `appointment`, `deposit`, `shop_at_home`, `sah`, or
`booking` (checked `grep -a -rniE` across every `.py`, one hit on "slot" and it's an unrelated word
in `tax.py`/`idv_store.py`). The production repos (`/Users/jt/hyper-tech/*`, read-only) have no
appointment/booking/deposit system either — the few filename hits (`Cities.js`,
`ExpressNotAvailable.js`, `FullfillmentStatusModal.js`) are unrelated uses of the word "booking."
This is a from-scratch build wearing a finished-looking mockup.

---

## 1. What the designs show, screen by screen

All static mock data, all client-only React (Babel-in-browser, no build step), no persistence. Live
vs mock is called out per screen.

### 1.1 Customer-facing (`Hyperwolf Shop` app → Customer Account, `athome/account-a.jsx`)

| Screen | What it shows | Status |
|---|---|---|
| **Home hub row** | `Row icon="route" label="Shop @ Home" sub="1 live · book a visit"` — a nav entry into the flow, badge count hard-coded to 1 | Static mock (`athome/account-a.jsx:155`) |
| **`AtHomeScreen`** (landing) | Pitch copy: *"A cannabis genius arrives with a full menu for up to 45 minutes. $150 min · $100 refundable deposit."* Single CTA "Book a visit" | Static mock (`athome/account-a.jsx:267-276`) |
| **`BookScreen`** (booking) | Address picker (index into a fixed list, no real address form), a **slot** picker — 5 fixed 45-minute slots (`2:00–2:45p` … `6:30–7:15p`), a note field, and a deposit summary card: *"Refundable deposit $100.00 — Applied to your order. Fully refunded if you cancel 2h before."* Footer CTA: **"Confirm · pay $100 deposit"** | Static mock, no payment integration, no real calendar (`athome/account-a.jsx:306-333`) |
| **Order/`@ Home` tab** | Shows the live appointment as a card: *"Live visit in progress — A-2041 · Marcus Vale · started 2:17p · deposit $100 held"* | Static mock (`athome/crm.jsx:247-271`) |
| **Order history row** | An `@ Home` order kind sits in the same order list as Delivery/Pickup (`ORDERS` fixture), with `total: null` while `live: true` (no total until the visit closes) | Static mock (`athome/athome-shared.jsx:57-63`) |
| **Loyalty tier grid** | Shop@Home access is a **Gold-tier perk**; Platinum adds "Free @ Home deposit" and "Dedicated genius" | Static mock, states a real product idea not yet wired to any tier engine (`athome/account-a.jsx:404`) |
| **Notification settings** | An `athome` toggle: *"@ Home alerts — When your genius is on the way"* | Static mock (`athome/account-a.jsx:522-530`) |

There are **three parallel Customer Account variants** (`account-a/b/c.jsx` — Hub&groups /
Membership card / Concierge), switched by `account-switch.jsx`, all sharing one data file
(`athome-shared.jsx`). The booking screen shown above lives in variant A; confirm the other two
variants carry the same booking flow before building — this plan did not re-verify B/C's `BookScreen`
byte-for-byte.

### 1.2 Operator/dispatch console (`Shop at Home.html` → `athome/admin.jsx`, mounts `window.ShopHomeApp`)

Script chain for `Shop at Home.html` (grepped `src=`/`href=` attributes directly): `shared/hw-z.js`,
`shared/brands.js`, `shared/app-nav.js`, `contracts/index.js`, React/ReactDOM/Babel (CDN),
`shared/error-boundary.jsx`, `pos/{tokens,icons,atoms}.jsx`, `shared/app-rail.jsx`,
`shared/states.jsx`, `athome/athome-shared.jsx`, `athome/admin.jsx` — same POS-console foundation as
the rest of the operator estate, no separate stack.

| Screen | What it shows | Status |
|---|---|---|
| **Board (Appointments)** | A table of all house calls: window, customer (avatar, tier, membership age), region/address, assigned genius, status pill, cart subtotal + deposit state (`paid`/`pending`/`applied`/`refunded`), row click opens the detail drawer. KPI strip: house calls today, live now, avg session value, avg wait to arrive, **deposit held ($400 / 4 open)** | Static mock (`athome/admin.jsx:143-217`) |
| **Live map** | Region pins with genius avatars, live/en-route/in-session appointment markers | Static mock (`athome/admin.jsx:~225+`) |
| **Regions & availability (setup)** | Per-region on/off switch, genius count, operating window, today's count; a **global guardrails** card: Minimum order $150, Deposit (refundable) $100, Max session length **45 min**, Service radius 15 mi from hub, Booking window "Same-day + 3 days", Buffer between calls **30 min**; three toggles — VIP members only, ID scan on arrival, **Auto-decline out of zone → refund deposit automatically** | Static mock (`athome/admin.jsx:320-368`) |
| **Appointment detail drawer** — Overview tab | Customer's verbatim ask (quoted note), an "Assign a genius" panel when `status==='requested'` (ranks geniuses, highlights same-region match), assigned-genius card, delivery address ("exact address unlocked for assigned genius" — a stated but unimplemented masking rule) | Static mock (`athome/admin.jsx:405-451`) |
| — Cart tab | Empty-state copy: *"Cart is empty — the genius builds it live during the visit"*; once populated, shows a running subtotal/discount/tax/est.-total **and a line "− Deposit applied"** subtracting the $100 | Static mock (`athome/admin.jsx:453-472`) |
| — Timeline tab | A fixed 9-step lifecycle: Requested → Deposit paid → Confirmed → Genius assigned → En route → Arrived → In session → Checkout → Completed | Static mock, but this **is the state machine to build against** (`athome/admin.jsx:34-42`) |
| — Chat tab | Customer⇄genius message thread, labeled "monitored" | Static mock |
| — **Payment tab** | KPIs: Deposit held, Payment method ("Visa •• 4021" — hard-coded card brand/last4), Balance due; a ledger table (Deposit authorized +$100 → Order subtotal → VIP discount → Taxes & fees → Balance charged → Tip); two buttons: **"Charge balance"**, **"Refund deposit"** | Static mock — the ledger shape (authorize → subtotal → discount → tax → capture balance → tip) is the right skeleton for the real settlement flow (`athome/admin.jsx:506-524`) |
| — Report tab (completed only) | Rating, order total, tip, duration | Static mock |

### 1.3 Driver/genius-facing (mobile app)

| Screen | What it shows | Status |
|---|---|---|
| **`mobile/screen-appointment.jsx`** (`AppointmentScreen`) | Purpose-built screen, distinct from the regular delivery `TaskScreen`: appointment-window banner (SHOP@HOME badge + ETA/slack), an **AOV goal card** (target/min, both from `window.MD.AOV`), "Interested in" category chips from a `brief`, arrival/ID-scan gate (`window.ArrivalSection`, `window.IDCapture`), and a **"Start shopping with {name}"** CTA that is disabled until ID is scanned. A parallel, ungated **"Close out appointment"** exit always routes to `CompleteScreen` — deliberately not gated on the ID scan, per the file's own comment, because "guest not home / won't show ID / changed mind" all need a finishing path too | Static mock; genuinely load-bearing UX reasoning already written into the file (`mobile/screen-appointment.jsx:9-110`) |
| **`mobile/data.jsx` SCHEDULED fixture** | Appointments (`kind:'appt', appt:true`) sit in the **same "Scheduled" list** as ordinary pre-booked deliveries (`kind:'dropoff', appt:false`), differing only by `items:[]` (nothing pre-built) and a `brief` object (interests/note/last-visit) | Static mock (`mobile/data.jsx:90-105`) |
| **ID capture note (live bug class, not this plan's to fix)** | `athome/admin.jsx:70-78` and `mobile/screen-appointment.jsx` both flag: a driver-side ID scan captures **nothing persisted** — it is a per-stop check, not a stored verification — yet the UI can show "ID on file · Verified" as if it were saved. The two states are worded distinctly in the mock specifically to avoid promising a record that doesn't exist. **Carry this distinction into the real build**: no persisted "verified forever" claim from a Shop-at-Home visit alone. |

### 1.4 The "genius" role — a real and unresolved modeling conflict

Two of the three mocks disagree on who runs an appointment, and this is not cosmetic — it changes
the driver-assignment and routing model:

- `athome/admin.jsx` models a **dedicated roster** — `GENIUSES` — separate from delivery drivers,
  each pinned to one region, with shift states (`available/en_route/in_session/off`), and a
  "VIP members only" + "in zone" assignment ranking. A genius is never shown carrying delivery
  stops.
- `mobile/data.jsx` embeds appointments (`appt:true`) directly in the **same driver's** "Scheduled"
  list alongside ordinary deliveries — implying a regular driver can be handed an appointment stop
  for the day, not a person in a separate role at all.

**This has to be resolved as an owner decision before dispatch/routing wiring** — see Q3 below. It
determines whether Shop at Home appointments compete for the same capacity pool as Express/
Scheduled deliveries (mobile model) or sit entirely outside it on dedicated staff (admin model).

---

## 2. Data model and lifecycle

### 2.1 Appointment states

Adopt the mock's own 9-step timeline (`athome/admin.jsx:34-42`) as the canonical `AtHomeVisitStatus`
lifecycle, collapsed to the board's 6 top-level states already in `athome/athome-shared.jsx`
(`STATUS`): `requested → confirmed → en_route → in_session → completed`, with `canceled` reachable
from any pre-`in_session` state (auto-decline out of zone, customer cancellation, no-show). Add this
enum to `contracts/index.js` alongside the existing `TaskStatus`/`LoyaltyTier` enums — do not let a
second, undeclared status vocabulary grow in `athome/*` the way `TaskStatus` briefly drifted
hyphenated vs. underscored elsewhere in this estate (documented in `mobile/data.jsx`'s own header
comment). A `no_show` state is implied by the owner's framing but is **not** in the mock's status
list at all — Q1 below is exactly this gap.

### 2.2 Slot capacity per region/associate

The mock's "Regions & availability" screen (§1.2) already expresses the right shape: capacity is
per-region (`geniuses` count, `slots` operating window), not global. A slot-capacity model needs, at
minimum: `region_id`, `associate_id` (nullable until assigned), `date`, `start_time`, `duration_min`
(mock: 45), `buffer_min` (mock: 30 between calls), and a derived "open slots today" count per region
— which the board's KPI strip already surfaces as a UI expectation. Booking window in the mock is
"Same-day + 3 days"; build the slot query against that horizon, not an open-ended calendar.

### 2.3 Deposit as a ledger entry

The Payment tab's ledger (§1.2) is the right skeleton. Model it explicitly as authorize-then-later
decide, not a single charge:

- **Authorize** ($100) at booking confirmation — a hold on the customer's payment instrument, not
  a captured charge. CanPay's own API distinguishes this: `authorizeTransaction` takes an
  `auth_only` flag (`hyperwolf-backend/controllers/canpay-controllers.js:18-42`), so "hold $100,
  capture later" is a real, already-integrated capability, not new payment-provider work — see §4.
- **Applied**: on visit completion with a sale, the $100 reduces the balance due (mock:
  `"− Deposit applied" −$100.00`, `athome/admin.jsx:469`). This must be the SAME capture call as the
  balance charge, not two, so a customer's card is touched once at settlement, not authorized once
  and captured separately as a duplicate transaction.
- **Refunded**: on a cancellation inside the policy window, or an auto-declined out-of-zone booking
  (mock: `"Address outside live zone — auto-declined, deposit refunded"`, `athome/admin.jsx:71`).
  Refund the **authorization** (void), not a post-capture refund, whenever no capture happened yet —
  cheaper, faster, and avoids a chargeback-eligible "refunded charge" appearing on the customer's
  statement for money that was never actually taken. See CanPay's own `refundOrder`/
  `refundType` path (`canpay-controllers.js:126-183`) for the pattern already used elsewhere in this
  estate.
- **Forfeited**: no-show. Not represented in the mock at all — this is Q1.

### 2.4 The at-home kit as a special kit build

The cart/checkout plan's `pool_stock` schema (`docs/CART-AND-CHECKOUT-PLAN-2026-09-17.md:864`) already
defines `pool_kind` as `driver_kit | kit_loadable | store_on_hand`. Model the at-home curated
selection as a **`driver_kit`-kind pool scoped to the appointment's assigned associate for that
visit's time window** — reserved (not just held) from the moment a genius is assigned, released back
to the shared kit if the appointment cancels or the genius is reassigned. This reuses the same hold/
reserve mechanics the cart plan is already building (`stock_hold`, conditional `UPDATE pool_stock`)
rather than inventing a second reservation system — do not duplicate that machinery here.

Because the mock is explicit that "the genius builds the cart live during the visit" (no pre-built
order), the interplay with `pool_stock` is: reserve a **generic kit allotment** (a curated assortment,
not specific SKUs) at assignment time, then convert specific line reservations to holds as the genius
actually adds items on-site — same "on-hold on add" mechanic the cart plan defines for the regular
storefront (§1.10 there), just fed from the genius's device instead of a customer's browser.

### 2.5 Sale recorded through the same sale-lines path

The finished sale (§1.2, Cart tab totals: subtotal → VIP discount → taxes & fees → est. total → less
deposit) must land through the **same** `pos_sale_lines` path every other channel uses
(`wm-demo/wmdemo/pos_sale_lines.py`), not a parallel Shop-at-Home-only sale writer. That gets, for
free, the same purchase-limit enforcement the purchase-limits plan already establishes as a live,
production feature in `stilo-backend`
(`docs/PURCHASE-LIMITS-PLAN-2026-09-17.md:33`), the same promotions engine, and the same loyalty
earn/redeem hook (`docs/LOYALTY-INTEROP-PLAN-2026-09-17.md` — Wolfpack/Pack Leader tiers via
Engage's `loy_ledger`, §63-69 there). **Do not build a separate discount/tax/points calculator for
Shop at Home** — that is exactly the kind of "second copy of the rules" this estate's own
`gas-projects` CLAUDE.md warns drifts and dies.

Metrc: California's pre-departure manifest requirement (`docs/METRC-PROGRAM-PLAN-2026-09-17.md:165`,
citing 4 CCR §15049.3/§15418) applies to Shop at Home exactly as it does to any delivery — the
curated kit leaving the licensed premises needs a CCTT delivery-inventory ledger entry **before the
genius departs**, synchronous, not end-of-day. This is already flagged in the Metrc plan as the one
piece of that plan that cannot be a nightly job (§175-180 there); Shop at Home adds volume to that
same requirement, not a new one.

Taxes: flow through the same tax engine as every other sale (`wm-demo/wmdemo/tax.py`) — no
Shop-at-Home-specific tax logic. The mock's cart-tab math (`Math.round(cartTotal*0.9*1.27)`) is a
placeholder constant, not a real rate table; do not carry that literal forward.

---

## 3. Dispatch/routing interplay

The routing engine plan already treats Shop@Home appointments as a first-class fact from the mobile
mock: *"Shop@Home appointments with 1-hour windows"* (`docs/ROUTING-ENGINE-PLAN-2026-09-17.md:122`,
citing `mobile/data.jsx:56-104`). Two things worth surfacing that the routing plan's own citation did
not resolve:

- **Dwell length disagrees across mocks.** `mobile/data.jsx`'s `SCHEDULED` fixture gives appointments
  `dwellSec` of 900–1400 (15–23 minutes) per stop; `athome/admin.jsx`'s guardrail card states "Max
  session length **45 min**" (2700 seconds) as the operator-facing policy. These are not the same
  number describing the same thing by coincidence of rounding — they are roughly 2–3× apart. Before
  routing can allocate a driver's day around an appointment, this needs one number, and it should be
  the **actual observed session length distribution**, not either mock's placeholder — the routing
  plan's own methodology (§ "door dwell drawn from the empirical...") argues for measuring this the
  same way regular door dwell is measured, once real Shop at Home visits exist to measure.
- **Fixed-time stops with long dwell are exactly the DRIVER-ASSIGNMENT-MODEL's existing "pinned
  stop" concept** (H1 in the routing plan's constraint table: "a pinned stop stays on its driver; a
  pinned position stays in sequence"). An appointment's booked window is a stronger commitment than
  an Express/Scheduled delivery window — the customer paid $100 to hold it — so it should be modeled
  as a **hard pin**, not a soft priority weight, in whichever assignment produces the day's plan.

**Dedicated associates vs. regular drivers (the §1.4 conflict) has direct routing consequences:**

- If Shop at Home stays on a **dedicated genius roster** (admin.jsx's model): geniuses never carry
  Express deliveries, so "blocks the driver from Express during the visit" is moot — there's no
  competing Express queue for that person's time at all. Routing only needs to sequence appointments
  within one genius's day plus travel buffers between them (mock: 30-min buffer between calls).
- If Shop at Home appointments are handed to **regular drivers** as a stop type (mobile/data.jsx's
  model): the long dwell (15–45 min depending on which mock's number you trust) genuinely removes
  that driver from Express eligibility for the appointment's duration plus travel buffer both ways —
  this is a real capacity cost the driver-assignment model's load-spread/fewest-stops fairness term
  would need to account for, and it is not accounted for anywhere in that plan today (grepped
  `DRIVER-ASSIGNMENT-MODEL-2026-09-17.md` for "dedicated associate" / "blocks... Express" — no hits).

Travel buffers: reuse the routing plan's existing dwell-and-travel formula
(`ETA = departure + Σ leg + Σ dwell...`, `ROUTING-ENGINE-PLAN-2026-09-17.md:461`) with the
appointment's dwell as one term — do not build a second ETA model for this one stop type.

**Hyperdrive Logistics board**: `Hyperdrive Logistics.html` and `logistics/{ldata,lorder,lparts,
lparts2,lviews}.jsx` were checked for any Shop-at-Home-specific view — none exists. Appointments do
not appear on the logistics board's order/driver list today; the board's `stockCheck`/`BOX_TYPE`
kit-awareness (cited in the routing plan) is category/box-level, not the appointment-specific kit
model in §2.4 above. **This is a gap, not a decision** — the dispatcher-facing board needs an
appointments lane the same way the customer/genius apps already have one, or dispatchers lose
visibility into house calls the moment they leave the separate `athome/admin.jsx` console.

---

## 4. Payments

**The deposit is the one online prepayment in the whole estate.** Every other order type is
charged at arrival (COD, per the owner's framing and consistent with `mobile/data.jsx`'s
`pay:'cod'`/`'prepaid'` split, where "prepaid" there means "loyalty wallet/pre-tender," not a stored
card).

**Provider, today**: two cashless rails are live in `hyperwolf-backend` (read-only, cited):
`controllers/canpay-controllers.js` (CanPay) and `controllers/ledgergreen/ledgergreen-controllers.js`
+ `models/LedgerGreen.js` (LedgerGreen). Both are wired with real routes and models. **Aeropay does
not exist anywhere in this codebase** — `grep -a -rli aeropay` across all of `/Users/jt/hyper-tech`
returned zero files; do not assume it is available without confirming a separate integration exists
elsewhere. **No Stripe or Square integration exists** — zero hits — consistent with the standard
cannabis constraint that neither processor supports plant-touching cannabis payments.

- **CanPay** already supports the exact primitive the deposit needs: `authorizeTransaction` accepts
  an `auth_only` flag (`canpay-controllers.js:18-42`) — authorize now, capture later is a real,
  already-built capability. Refunds go through `refundOrder`/`refundType` with an `originalMethod`
  vs `wallet` branch (`:126-240`). **Use CanPay's `auth_only` flow for the $100 deposit hold**; this
  needs no new payment-provider integration, only a Shop-at-Home-specific caller of an existing
  endpoint.
- **LedgerGreen**'s `webhook` handler reads `creditTransactionId`/`phone` straight from the request
  body with **no signature verification visible** (`ledgergreen-controllers.js:34-45`). This is a
  live gap in production, not something to inherit into a new flow: **do not build the Shop-at-Home
  deposit webhook on this pattern.** Any new webhook (deposit-authorized, capture-succeeded,
  refund-issued) must verify a provider signature before trusting the payload, whichever of the two
  rails ends up handling deposits.
- **PCI posture**: neither controller stores raw card data — both post to the provider's hosted
  API and store only provider-side identifiers (`CanPayUsers.auth_id`, `LedgerGreen.
  creditTransactionId`). Continue that: the deposit flow should use the provider's own hosted
  fields/redirect, never a card form Hyperwolf's own frontend touches directly.
- **Idempotent capture**: neither existing controller shows an idempotency key being generated or
  checked on the capture call (grepped both files for `idempoten` — no hits beyond LedgerGreen's own
  internal usage notes). Add one for the Shop-at-Home settlement capture specifically — a retried
  "Charge balance" click (network blip, double-tap) must not double-charge a customer at the doorstep
  where there is no second screen to catch it.
- **Chargebacks**: not modeled anywhere in the mock or the two provider controllers read here. A
  refundable deposit + a later balance capture is two separate chargeback-eligible events; the
  ledger (§2.3) needs to carry provider transaction ids for both so a dispute can be traced to the
  right one.

---

## 5. Security and privacy

- **Address + appointment PII minimized**: the admin mock already states the right rule in copy —
  "exact address unlocked for assigned genius" (`athome/admin.jsx:441`) — but this is **presentational
  only** in the mock (the full address renders regardless of assignment state in the drawer's data
  binding). Build it as a real access check: the address field resolves to a coarse region/zip until
  a genius is actually assigned, and the fine-grained address is scoped to that genius's session, not
  broadcast to every staff view.
- **Appointment ids unguessable**: the mock's ids (`A-2041`, sequential) are a demo convenience, not
  a design to carry forward — any customer-facing link (confirmation, reschedule, cancel) must use a
  signed/opaque token, the same posture this estate already uses for magic links elsewhere
  (`incident-pipeline` skill: HMAC magic links) rather than a guessable sequential id.
- **Booking rate limits / abuse**: two distinct abuse shapes to guard against — (a) **deposit fraud**:
  repeated authorize-then-cancel cycles as a card-testing vector, needs a per-customer/per-card
  velocity check before authorization, not just a refund-policy check after; (b) **slot hoarding**:
  a customer or bot booking every slot in a region to deny competitors availability — needs a
  per-customer active-appointment cap (e.g., one open booking at a time) enforced server-side, not
  just a UI affordance.
- **Staff-side access scoped by store/region**: the admin console's mock has no visible
  region-scoping on the Board view — it shows all regions to whatever staff account opens it. The
  real build should scope the Shop-at-Home console the same way the rest of the operator estate
  scopes store/region access (per the estate's existing per-store admin patterns), not as a
  wide-open cross-region view by default.
- **Audit trail**: the Timeline tab (§1.2) is the right user-facing shape; back it with an
  append-only event log (status transitions, deposit authorize/capture/refund/void, genius
  assignment changes) — the same pattern the cart/checkout plan already specifies for hold events
  (`hold_event`, replay-safe by event id) — rather than a mutable "current state" row with no history.

---

## 6. Gaps and build order

Small slices, each with its own adversarial check. Any **new** screen or material redesign is called
out explicitly as needing four concepts (desktop + phone) — none are designed here.

1. **Appointment + slot data model** (contracts enum, `athome_appointment`, `athome_slot` tables,
   region/associate capacity). *Adversarial check*: two customers booking the last slot in a region
   simultaneously — exactly one must win, the same race the cart plan already solves for stock holds
   (`pool_stock` conditional update pattern) — reuse it, don't reinvent it for slots.
2. **Deposit authorize/void/capture via CanPay's existing `auth_only` path** (§4), wired to
   appointment state transitions. *Adversarial check*: authorize succeeds, then the appointment is
   auto-declined for being out of zone in the same request cycle — the void must fire before the
   customer sees a confirmation, not after, or a declined booking still shows "deposit held."
3. **At-home kit reservation** as a `driver_kit`-kind `pool_stock` row scoped to the appointment
   (§2.4), built on top of the cart plan's hold/reserve primitives once those ship — do not build
   this before that foundation lands, or Shop at Home gets its own, second, drifting reservation
   system.
4. **Sale-through-existing-pipeline**: route the completed visit's cart through `pos_sale_lines`
   with the deposit as a tender line, so purchase limits, promotions, loyalty, and tax all apply
   unmodified (§2.5). *Adversarial check*: a VIP discount plus the $100 deposit plus a promotions-
   engine coupon on the same order — verify the deposit nets against the **post-discount** total,
   not pre-discount, so the customer is never charged more than the discounted price.
5. **Dispatcher-facing appointments lane on the Hyperdrive Logistics board** (§3 gap) — this is a
   **material addition to an existing screen**, not a from-scratch page; still needs four concepts
   (desktop + phone) before build, per this estate's standing design rule.
6. **Routing/dispatch model decision** (§3, §1.4): resolve dedicated-genius vs. regular-driver
   before wiring appointments into the driver-assignment model at all — building against the wrong
   one means redoing the capacity math.
7. **Metrc pre-departure manifest hook for Shop-at-Home kits** (§2.5) — reuse the delivery
   pre-departure work the Metrc plan already scopes as its own hardest item; do not build a second,
   parallel synchronous Metrc writer.
8. **No-show and abuse policies** (§5, Q1/Q4 below) — needs the owner decisions before the state
   machine's `canceled`/forfeiture branches can be finished.

---

## 7. Owner questions

Business decisions only. Four options each, pros/cons, a recommendation first. Multi-select — pick
one letter per question (or note "none of these").

**Q1. Deposit refund / no-show policy — what happens to the $100 when the customer isn't there?**
- **A. Forfeit in full on a true no-show (genius arrived, waited a grace period, no contact); full
  refund on any cancellation before the window opens.** (Recommended.) *Pro:* clean, easy to explain,
  matches the mock's existing "fully refunded if you cancel 2h before" copy almost exactly. *Con:*
  no partial-fault middle ground (customer forgot but called 10 minutes late).
- **B. Sliding scale — full refund outside 2h, 50% forfeit inside 2h, 100% forfeit on true no-show.**
  *Pro:* rewards early cancellation, discourages last-minute drops without being punitive to genuine
  mistakes. *Con:* three tiers to explain and support-agent train on.
- **C. Always fully refundable, no forfeiture ever.** *Pro:* zero customer friction, easiest support
  story. *Con:* removes the entire commitment mechanism the deposit exists for — genius time gets
  wasted for free.
- **D. Forfeit applies only after a second no-show from the same customer (first is a warning, no
  charge).** *Pro:* forgiving to genuine one-offs, still deters repeat abuse. *Con:* needs a
  per-customer no-show counter and a "here's your warning" messaging flow that doesn't exist yet.

**Q2. Slot length and capacity — how long is a session, and how many run at once per region?**
- **A. Fixed 45 minutes (matches the current admin mock), one appointment per genius at a time, 30-min
  buffer between.** (Recommended.) *Pro:* matches what's already designed and shown to staff; simple
  to route. *Con:* a session that runs long (customer wants more time) has no accommodation.
- **B. Fixed 60 minutes (matches the driver-app mock's "1-hour windows"), same one-at-a-time model.**
  *Pro:* matches the OTHER existing mock (mobile/data.jsx) and gives more room. *Con:* fewer sessions
  per genius per day; the two existing mocks disagree and this locks in one of them.
- **C. Variable length by tier (Gold 30 min, Platinum 60 min).** *Pro:* ties session length to the
  loyalty perk already implied in the account mock ("Dedicated genius" for Platinum). *Con:* two
  numbers to route around instead of one; more scheduling complexity for a first build.
- **D. Let the genius end the session manually with a soft 45-min guideline, no hard cutoff.**
  *Pro:* best in-home experience, no awkward "time's up" moment. *Con:* makes routing/ETA promises to
  the *next* customer unreliable — directly conflicts with the routing plan's pinned-stop model.

**Q3. Who staffs visits — dedicated associates or regular delivery drivers?**
- **A. Dedicated "genius" roster, never carries delivery stops (matches `athome/admin.jsx`).**
  (Recommended.) *Pro:* protects Express capacity entirely, matches the more fully-designed of the
  two existing mocks, cleanest routing story (§3). *Con:* dedicated headcount, idle time between
  appointments in a slow region.
- **B. Regular drivers take appointments as a stop type (matches `mobile/data.jsx`).** *Pro:* no new
  headcount, one flexible pool. *Con:* every appointment now removes a driver from Express for
  15–45 minutes plus travel, uncosted in the current driver-assignment model (§3) — real capacity
  hit not yet accounted for anywhere.
- **C. Hybrid — a small dedicated pool for peak regions, fallback to regular drivers elsewhere.**
  *Pro:* balances cost against Express protection. *Con:* two routing paths to build and keep
  correct instead of one.
- **D. Regular drivers, but appointments are scheduled only in off-peak windows so Express is never
  actually competing.** *Pro:* no new headcount, no measured Express hit. *Con:* constrains when
  customers can book, weakening the "book anytime" pitch in the customer mock.

**Q4. Minimum spend — is the $150 minimum (from the admin mock's guardrail card) still right?**
- **A. Keep $150, same as the current mock's guardrail.** (Recommended, as the default already
  designed and shown to staff.) *Pro:* zero rework, matches AOV goal already set in the driver app
  ($150 min / $300 target, `mobile/data.jsx` `AOV`). *Con:* not re-verified against any actual margin
  math for genius time cost.
- **B. Raise it (e.g., $200) to better cover a dedicated associate's time.** *Pro:* protects unit
  economics if Q3 lands on dedicated staff. *Con:* may price out the exact new/curious customers the
  "guidance" framing in the driver brief mock targets (first-time guests).
- **C. No minimum — the $100 deposit alone is the commitment device.** *Pro:* simplest policy, most
  inclusive. *Con:* a genius could complete a full visit for a $20 sale, deposit barely covering time
  cost.
- **D. Tier-based minimum (lower for Gold, waived for Platinum) matching the loyalty-perk framing
  already in the account mock.** *Pro:* consistent with the tier story already shown to customers.
  *Con:* couples this policy to Q3/loyalty-interop decisions not yet finalized.

**Q5. How is the deposit applied against the final sale?**
- **A. Net against the post-discount, post-promotion total at settlement (deposit is the last line
  before tender), exactly as the admin mock's Cart-tab math already shows.** (Recommended.) *Pro:*
  matches the existing, already-designed ledger shape (§2.3/§6 item 4); customer never overpays.
  *Con:* none identified — this is the mock's own model and it's sound.
- **B. Net against the pre-discount subtotal, discounts applied only to the remaining balance.**
  *Pro:* slightly simpler math to implement. *Con:* can make the customer pay more overall than they
  would delivery-side for the identical cart, which is hard to justify to a VIP customer.
- **C. Deposit is a flat account credit usable on ANY future order, not just this appointment's
  sale.** *Pro:* forgiving if a session produces no purchase at all. *Con:* breaks the "commitment to
  show up" purpose of the deposit and turns it into a gift-card mechanic with different accounting.
- **D. Deposit is non-applicable — always refunded separately, balance always charged in full.**
  *Pro:* completely clean separation, easiest to reconcile. *Con:* customer effectively pays the
  $100 twice in the moment (once as deposit, once at settlement) until the refund posts, which reads
  badly at the doorstep.

**Q6. Cancellation window — how close to the appointment can a customer cancel for a full refund?**
- **A. 2 hours before the window opens (matches the current mock's own copy exactly).**
  (Recommended.) *Pro:* zero rework — this is already the sentence shown to customers today. *Con:*
  not validated against how far in advance geniuses actually need notice to reroute their day.
- **B. 24 hours before.** *Pro:* gives dispatch real time to refill the slot or reroute the genius.
  *Con:* contradicts the "Same-day + 3 days" booking window already in the admin mock — a same-day
  booking could never qualify for a full-refund cancellation under this rule.
- **C. No fixed window — full refund any time before the genius departs for the visit.** *Pro:*
  maximally customer-friendly. *Con:* a genius already en route with a reserved kit has no protection
  at all; directly conflicts with the "blocks the driver from Express" cost being real (§3).
- **D. Tiered — 2 hours for a full refund, up to departure for a 50% refund, nothing after departure.**
  *Pro:* covers the middle case B and C both miss. *Con:* three cutoffs instead of one; more
  copy and support training than the mock currently carries.

---

## Appendix — files read (all read-only)

`POS-Admin`: `Shop at Home.html` (script chain grepped directly), `Hyperwolf Shop.html`,
`athome/{admin,athome-shared,account-a,crm}.jsx` (account-b/c not fully re-read — see §1.1 caveat),
`shop/{chrome,data,screen-cart,screen-checkout,screen-home,screen-shop}.jsx` (grepped),
`logistics/{ldata,lorder,lparts,lparts2,lviews}.jsx` (grepped, no Shop-at-Home hits),
`mobile/{screen-task,screen-appointment,data}.jsx`, `pos/screen-orders.jsx` (grepped, no hits),
`docs/CART-AND-CHECKOUT-PLAN-2026-09-17.md`, `docs/DRIVER-ASSIGNMENT-MODEL-2026-09-17.md`,
`docs/ROUTING-ENGINE-PLAN-2026-09-17.md`, `docs/SWAP-RECOVERY-FLOW-PLAN-2026-09-17.md` (grepped, no
hits), `docs/PURCHASE-LIMITS-PLAN-2026-09-17.md` (grepped), `docs/LOYALTY-INTEROP-PLAN-2026-09-17.md`
(grepped), `docs/METRC-PROGRAM-PLAN-2026-09-17.md` (grepped). `wm-demo/wmdemo`: full-tree
`grep -a -rniE` for `appointment|deposit|shop_at_home|sah|booking|slot` (no relevant hits beyond
unrelated uses of "slot"). `hyper-tech` (read-only, all twelve repos): filename search for
canpay/aeropay/ledgergreen/stripe/square and appointment/deposit/booking/prepaid;
`hyperwolf-backend/controllers/canpay-controllers.js`, `controllers/ledgergreen/
ledgergreen-controllers.js`, `models/{CanPayUsers,LedgerGreen}.js` read in full/near-full.
