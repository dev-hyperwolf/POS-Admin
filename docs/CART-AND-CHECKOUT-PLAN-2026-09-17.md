# Cart and Checkout Plan — holds, integrity, fulfilment lanes, and the Swap verdict

**Date:** 2026-09-17. **Status:** planning document only. No existing file was edited, nothing was
deployed, no server was started, no `.env` or credential file was opened. Every line number cites the
repositories as they stood on 2026-09-17.

**Scope:** the customer cart and checkout for cannabis delivery — Express (from one driver's kit,
within 90 minutes), Scheduled (1-hour windows, 15:00 same-day cutoff, day-ahead booking), and in-store
pickup — plus a full review of the Swap feature across the e-commerce site, the driver app and the
admin.

**Owner decisions this plan treats as settled (not re-asked):**

1. An item added to a cart is placed **on hold** so no other customer can add the same unit.
   Express inventory shown to a customer is the real live inventory of a specific driver's kit.
2. There are **settings** for how long an item may sit in a stale cart before it goes back on sale.
3. The best driver is fetched **when the delivery address is selected**; a placed order goes to the
   driver with **no staging wait**.
4. Swaps exist on the e-commerce site, in the driver app and in the admin; the flow must be smart.
5. Loyalty must work with Alpine and Blaze; discounts come from the promotions engine
   (`hw.rule.v1`), never from the client.

**A conflict to reconcile, flagged not resolved here.** `docs/HANDOFF-TO-CODEX-2026-09-17.md:231-232`
and `docs/DRIVER-ASSIGNMENT-MODEL-2026-09-17.md` §4 still describe "order staged and sequenced jointly
before release", and `wm-demo/platform/modules/dispatch/staging.ts` + `release.ts` implement it. The
brief for this plan says **no staging wait**. This plan follows the brief: see §1.14 for the one
small change that satisfies both (stage and release in the same transaction; joint re-sequencing keeps
working on every stop except the driver's current one).

---

## 0. Owner summary (plain language)

**The Swap design: APPROVE WITH CHANGES.** The thinking behind it is right and the engine underneath
it is real and well tested. But the customer-facing swap is **not actually on the storefront yet**
(only "Move to Scheduled/Express" is), it has **no connection to holds**, there is **no
"if something is missing, do this" choice at checkout**, and the three swap screens (site, driver,
admin) **do not behave the same way**. §4 lists the 14 changes, most valuable first.

**The cart itself: the money side is careful; the inventory side does not exist yet.** The storefront
design prices everything through one engine and refuses to show a number it cannot trust. That part
is good. What is missing is everything the owner's hold requirement needs:

- The cart lives **only in the browser's memory** (`shop/data.jsx:798-806`). There is no cart on a
  server, no cart id, no hold, no timer. Two customers can both add the last unit today.
- The address is asked for **at the end** (`shop/screen-checkout.jsx:372`), and it is a different
  thing from the "Deliver to" label in the header (`shop/data.jsx:60`, a fixed demo value). The
  owner's rule is the opposite order: address first, then the best driver, then that driver's kit is
  the Express menu.
- Orders are written **by the browser** (`shop/screen-checkout.jsx:180-302`, `HW.addOrder`). In
  production the server must price and place the order; the browser only asks.
- The hold library that was just built (`wm-demo/platform/modules/dispatch/holds.ts`) holds driver
  *capacity* per cart, but it **cannot add a second item to an existing hold and cannot extend a
  hold's time** (`holds.ts:128-150` returns the original record unchanged). It needs two small
  additions before it can carry unit holds.
- The driver app's "what this van has already promised" ledger lives in **one phone's browser
  storage** (`mobile/screen-task.jsx:22-58`). A web cart hold and a driver's at-the-door upsell
  cannot see each other. The kit ledger has to live on the server before holds are real.
- **No code anywhere tracks the legal daily purchase limit**, there is **no age gate** on the
  storefront, the payment method is hard-coded to "Card" (`shop/data.jsx:41`), the Scheduled window
  is a fixed "2–3 PM" label (`shop/screen-checkout.jsx:454`), promo codes are drawn but not connected
  (`shop/screen-cart.jsx:457-483`), and pickup is not on the storefront at all
  (`contracts/index.js:161` lists only `express` and `scheduled`).

**The recommended hold, in one paragraph.** The hold starts the moment an item is added to the cart
(the owner's rule). For Express that means the address must already be known, because the unit being
held is physically in one driver's kit. The hold lasts **10 minutes from the customer's last real
action**, never more than **25 minutes in total**, drops to **5 minutes when it is the last unit**,
and is refreshed to a **5-minute checkout hold (renewable once)** when checkout starts. A quiet
"Held for you" line is always visible; a countdown appears only in the last 2 minutes with one
"Keep my items" button. At expiry the item **stays in the cart** marked "no longer held"; if it is
still free when the customer returns it is re-held silently, otherwise they are offered Scheduled
("arrives tomorrow") or a Swap — never a dead end and never the words "out of stock" for something
that simply arrives later.

---

## 0.1 What exists today (evidence table)

| Area | What exists | Where | Verdict |
|---|---|---|---|
| Cart store | In-memory `_SHOP.lines = [{id:'sl'+n, sku, qty, lane}]`; ids are a counter; no persistence, no server | `shop/data.jsx:797-815` | Design-only. Replace with a server cart |
| Express truthfulness | `expressUnits` / `expressHeadroom`: a line can only be Express up to the van's depth minus what *this* cart already holds; overflow goes Scheduled | `shop/data.jsx:115-147`, `:828-838`, `:853-864`, `:881-889` | Right idea, single-customer. Must become "depth minus **everyone's** holds" on the server |
| Tone | A shortfall is "Arrives tomorrow", never "unavailable"; minimum is a progress bar, never an error | `shop/screen-cart.jsx:77-103`, `:353-376` | Keep. Every new state in this plan follows it |
| One money authority | All totals from `HWCommerce.computeCartTotals` via `SHOP.totals()`; estate tax function injected | `shop/data.jsx:902-995` | Good client design; production needs the **server** to be that authority |
| Rules used to price | `E.BUILTIN_RULES` baked into the engine bundle | `shop/data.jsx:977` | **Gap:** not `hw.rule.v1`. Two rule shapes (§2.2) |
| Promo code box | Drawn, deliberately inert ("Promo codes aren't connected to this cart yet") | `shop/screen-cart.jsx:446-483` | Wire to the server (§2.2) |
| Two lanes = two orders | Per-line lane, per-lane fee/minimum, exact-cent split of discount and tax across lanes | `shop/screen-cart.jsx:12-20`, `shop/screen-checkout.jsx:120-167` | Keep the model; server must place both orders in **one transaction** |
| Placement | Browser writes orders; double-tap guarded by "cart is empty" | `shop/screen-checkout.jsx:180-302` | Demo-only. Needs a server idempotency key (§2.9) |
| Address | Five labelled fields, no parser, at checkout; header "Deliver to" is a fixed fixture | `shop/screen-checkout.jsx:45-94`, `:372-445`; `shop/data.jsx:50-60` | Fields are right. **Order of steps is wrong** for kit-based Express (§3.1) |
| Tip | None/10/15/20/custom, Express only, after tax; custom amount has **no upper bound** | `shop/screen-checkout.jsx:33-38`, `:114-119`, `:347` | Add cap + validation (§2.7) |
| Payment | Hard-coded `'card'` | `shop/data.jsx:41-46` | **Gap.** Cannabis delivery is cash/debit at the door (§2.8) |
| Scheduled window | Literal "2–3 PM" tomorrow | `shop/screen-checkout.jsx:452-454` | **Gap.** No window picker, no window capacity (§3.4) |
| Age / ID / medical | Nothing on the storefront | grep of `shop/*.jsx` clean | **Gap** (§2.5) |
| Daily purchase limits | No code anywhere | confirmed by `docs/SWAP-RECOVERY-FLOW-PLAN-2026-09-17.md` §3 | **Gap, highest compliance priority** (§2.4) |
| Pickup | Engine has `pickupLane`; storefront and the `Lane` contract do not | `shared/commerce-engine.js:245-251`; `contracts/index.js:161` | **Gap** (§3.5) |
| Cart-side swap engine | `canSwap` / `planSwap` / `previewSwap` / `applySwap`: Move vs Swap, three ladders, promo-loss preview | `shared/commerce-engine.js:1518-1680`, `:1769-1810` | Real and tested |
| Cart-side swap **UI** | Only in the engine demo page, not the storefront | `Swap and Upsell Engine.html:3178-3262`, `:3318-3397`; none in `shop/*` | **Gap** (§4) |
| Driver swap sheet | Governed, reasons, consent tick, double-tap latch, soft-hold `VanLedger` in `localStorage` | `mobile/screen-task.jsx:9-64`, `:283-460` | Best of the three; ledger must move server-side |
| Admin swap (POS) | Governed, support actor; "Cheaper" tab can never fill, no reason, no record id | `pos/screen-orders.jsx:2050-2095`, `:3331` | Three known bugs (swap plan §1.5) |
| Admin swap (logistics) | Ungoverned local state edit over the whole catalogue | `logistics/lorder.jsx:113-148`, `:327` | Replace or retire |
| Capacity holds | `HoldStore`: server-generated 128-bit `holdId`, bound to `cartId`, TTL, lazy expiry, idempotent place; in-memory | `wm-demo/platform/modules/dispatch/holds.ts:1-271`; `config.ts:246-248`, `:374` | Good base; needs `amend`, `touch`, persistence (§1.2) |
| Kit ledger | `reserve/consume/release/restock`, idempotent, never negative; in-memory; no `hold`/`expire` | `dispatch/kit-ledger.ts:1-60` | Add `hold`, `expire`, `move`; persist |
| Region-level reservation precedent | Weedmaps draft carts: `reserve(wm_cart_id, region, requested, ttl=900)`, atomic `BEGIN IMMEDIATE`, best-effort clamp, idempotent per cart, sweep on write | `wm-demo/wmdemo/catalog.py:107-114`, `:1742-1777`, `:1779-1838`, `:1840+` | Proven pattern. Region-level, not kit-level — reuse the shape |
| Inventory by location | No hold or reservation concept at all | `wm-demo/wmdemo/inventory.py` (grep: none) | Scheduled/pickup holds need it (§1.12) |
| Sale lines | Server-authoritative unit price when the sku resolves; discount still client-declared | `wm-demo/wmdemo/pos_sale_lines.py:12-47`; `wm-demo/docs/SALES.md:128-135` | Web checkout must not inherit the discount gap |
| Realtime | Pub/sub with **ids-only payloads**; no family registered yet | `wm-demo/wmdemo/realtime_channels.py:62-63`, `:375` | Use for hold/cart/swap events (§8.4) |

---

## 1. Hold lifecycle

### 1.1 The one idea everything else hangs on

> **Available to sell = on hand − reserved (placed orders) − held (carts).**
> One number per (stock pool, sku), computed on the **server**, changed only by one atomic
> statement. Every surface — storefront badge, cart, driver swap sheet, admin swap panel, dispatch
> constraint checker — reads that same number.

Today three different things each believe they know what a van has: the storefront
(`DDATA.REGION_STOCK` minus this browser's own cart, `shop/data.jsx:144-147`), the driver's phone
(`VanLedger`, `mobile/screen-task.jsx:22-58`) and the dispatch library (`kit-ledger.ts` +
`holds.ts::withHolds`, `holds.ts:247-271`). None can see the others. Until they are one ledger a hold
is a promise only one screen knows about.

**Stock pools** (the engine already names them, `shared/commerce-engine.js:214-252`):

| Lane | Pool | What a hold is against |
|---|---|---|
| Express | `driver_kit` | one vehicle's kit: `(vehicle_id, sku)` |
| Scheduled | `kit_loadable` | the store's safe/staging locations that tomorrow's kits are built from: `(store_id, sku)` |
| Pickup | `store_on_hand` | the store floor/back-stock: `(store_id, sku)` |

### 1.2 When the hold starts — recommendation: **at add-to-cart, as a soft hold**

| Option | For | Against | Verdict |
|---|---|---|---|
| **At add-to-cart** | The owner's rule. The customer never reaches checkout to find the item gone. Matches "the menu is a real kit" | Abandoned carts tie up units; needs short TTLs and anti-hoarding caps | **Recommended** — with the TTL, last-unit and cap rules below |
| At address selection | Nothing to hold yet — no items | — | This is when the **driver-capacity** hold starts, not the unit hold |
| At checkout start | Fewest idle holds (the earlier dispatch doc chose this: "Kit lines are not held while browsing", `docs/DRIVER-ASSIGNMENT-MODEL-2026-09-17.md:580-583`) | A customer can build a cart for ten minutes and lose it at the last step — the exact failure the owner wants gone | Superseded by the owner's decision |

So there are **two holds with one owner**, both keyed to the same server-side cart:

1. **Unit hold** (new): starts at add-to-cart. Reduces *available to sell* for everyone else.
2. **Capacity hold** (exists, `holds.ts`): starts when the address is selected and a driver is
   quoted; reserves a gap in that driver's route, value cap and cash cap. Counts at reduced weight
   while browsing and in full once checkout starts (`DRIVER-ASSIGNMENT-MODEL` §4.3 — unchanged).

**Two changes `holds.ts` needs before it can carry either properly:**

- **`amend(holdId, cartId, amounts, now)`** — today `place()` is idempotent by `cartId` and returns
  the *original* record unchanged (`holds.ts:128-150`). A cart's second add-to-cart would therefore
  be silently **not held**. Amend must be atomic and must refuse (not clamp) when the extra units are
  not available.
- **`touch(holdId, cartId, now)`** — today `expiresAt` is fixed at `createdAt + ttl`
  (`holds.ts:144`); there is no sliding renewal and no hard ceiling. Add `lastExtendedAt` and
  `hardExpiresAt`.

Both keep the existing security posture: server-generated 128-bit `holdId`, every mutation needs
`holdId` **and** the matching `cartId`, every refusal is identical (`holds.ts:20-41`, `:171-183`).

### 1.3 Soft vs firm — three stages, one row

| Stage | Starts | Ends | Counts against availability | Counts against driver on-time guard |
|---|---|---|---|---|
| `soft` | add-to-cart | TTL, removal, or checkout start | Yes, in full | Reduced weight (browsing phantom) |
| `checkout` | "Checkout" pressed | 5 min, renewable once; or order placed | Yes, in full | Yes, in full |
| `reserved` | order placed | delivered (`consume`), cancelled or swapped (`release`) | Yes — it is now an order reservation, no TTL | Yes |

`soft → checkout → reserved` happens on the **same hold row** (status + stage change), never by
releasing and re-acquiring: a release/re-acquire gap is exactly when a second customer's add slips in.

### 1.4 TTL, extension and heartbeat

| Rule | Recommendation | Why |
|---|---|---|
| Sliding TTL | Express **10 min** from the last *meaningful* action | Matches the dispatch default (`config.ts:374`, `holdTtlSec: 600`) so the unit hold and the capacity hold expire together |
| Hard ceiling | **25 min** from the first hold on that cart, regardless of activity | A sliding timer with no ceiling is a free way to park stock all evening |
| Meaningful action | add / remove / quantity change / lane move / swap / opening the cart / any checkout step / pressing "Keep my items" | Things a person does on purpose |
| Heartbeat | The page pings every 60 s **only while the tab is visible**. A heartbeat keeps a hold alive for at most **one extra TTL** past the last meaningful action, never past the ceiling | A script can send heartbeats forever; a heartbeat must not be worth as much as a tap |
| Last-unit TTL | When the hold takes availability to **zero**, TTL is **5 min** (ceiling 15) | The scarcest stock turns over fastest; this single rule removes most hoarding harm |
| Checkout TTL | **5 min**, renewable **once** (so ≤ 10 min), and it may exceed the 25-min ceiling by that amount only | Nobody should lose their cart while typing an address |
| Scheduled / Pickup | **20 min** sliding, **60 min** ceiling | Deep pool, low contention; a longer hold costs little. The last-unit rule still applies |
| Shift/close clamp | `expiresAt = min(TTL rule, the latest moment an order could still be placed and delivered legally)` | A hold must never outlive the thing it holds (§1.12, §1.13) |

### 1.5 Countdown UX and what the customer sees at expiry

Recommendation: **honest but calm.**

- **Always visible, low-key:** in the lane header, "Held for you" with the minutes remaining as plain
  text ("Held for you · about 8 min"). No ticking seconds. A permanent ticking clock pushes people to
  rush a regulated purchase and reads as a pressure tactic.
- **Last 2 minutes:** the line becomes prominent, shows `m:ss`, and offers one button,
  **"Keep my items"** (a meaningful action — extends within the ceiling). Announced once to screen
  readers via a polite live region; never a modal that steals focus.
- **At the ceiling:** the button is replaced with "Check out now to keep these" — the truth.
- **At expiry the line is NOT deleted.** It stays in the cart, greyed, labelled **"No longer held"**
  with one action: **"Check again"**. The customer's choices are preserved; only the promise lapsed.
- **On return / "Check again":** silent re-acquire if units are free (within the
  `reacquireGraceSec` window this needs no tap at all). If not free, the existing tone rule applies:
  the line offers **"Move to Scheduled — arrives tomorrow"** and, where the engine has candidates,
  **"Swap to Express"** (§4). Never "out of stock" for an item that is merely not in today's van
  (`shop/screen-cart.jsx:88-93`).
- **Totals while a line is unheld:** the unheld line is excluded from the total and the button reads
  "Checkout · 3 of 4 items". A total that includes something we cannot promise is a wrong number.

**New screen work — needs four concepts (desktop + phone):** (1) held / expiring / no-longer-held
line states and lane-header timer; (2) the "your cart changed" review sheet (§3.2) which expiry,
address change and price change all share.

### 1.6 Guest vs signed-in, multi-device, multi-tab, merge on sign-in

| Case | Recommendation |
|---|---|
| Signed-in | **One open cart per customer per store**, stored on the server. Phone and laptop show the same cart and the same holds. A change on one appears on the other (realtime `cart.<cartId>` event, ids only) |
| Guest | One open cart per **session cookie** (HttpOnly, SameSite=Lax, server-issued random id). Shorter TTL (5 min sliding / 15 ceiling) and at most 2 last-unit holds until a phone number is verified (owner question 3) |
| Multi-tab | Same cart. Every write carries `cartVersion`; a stale tab gets `409 cart_changed` with the fresh cart and re-renders. No tab can resurrect a removed line |
| Merge on sign-in | Guest cart **into** the customer's existing cart: per sku+lane the **larger** quantity wins (never the sum — summing is how a customer ends up with 4 when they wanted 2), capped by limits. Guest holds are **moved** to the customer cart in one transaction (`status='moved'`, `replaced_by_hold_id`), not released and re-taken. The merged cart is re-priced and re-checked against daily limits; anything that no longer fits is shown in the review sheet |
| Sign-out | Release all holds immediately; keep the cart contents server-side for the customer |
| Tab close | **Do not release.** `pagehide` fires when a phone user switches apps to read a text; releasing there would punish normal behaviour. Heartbeats stop, so the hold lapses one TTL later by itself |

### 1.7 Quantity caps per cart

The binding cap is the **smallest** of: (a) available to sell in the pool, (b)
`cart.maxQtyPerLine` (Express 4, Scheduled 10), (c) the compliance daily limit remaining for this
customer (§2.4), (d) `cart.maxHeldUnits` (15), (e) the vehicle value cap for the quoted driver (the
$10,000 rule already enforced by `withHolds`, `holds.ts:262-268`). The stepper simply stops at the
cap and says why in one line ("That's all today's van is carrying — more can arrive tomorrow").

### 1.8 Hoarding, bots, rate limits, concurrent-hold limits

Threat: one person or script opens many carts and holds the last units of popular items across all
of them, either to starve other customers or to reserve stock for themselves.

| Control | Default | Notes |
|---|---|---|
| One open cart per customer / per guest session | 1 | The strongest control; makes "many carts" require many identities |
| Max active holds (distinct skus) per cart | 12 | |
| Max held units per cart | 15 | Compliance limit usually binds first |
| Max **last-unit** holds per identity at once | 3 (guest 2) | The scarce resource gets its own cap |
| Max open carts with holds per device fingerprint | 2 | Fingerprint = coarse, server-side hash of UA + accept headers + cookie; advisory, never the only control |
| Max open carts with holds per IP | 8 | Generous for shared households / carrier NAT; a signal before it is a block |
| Hold acquisitions per session per minute | 20 | |
| Cart mutations per cart per minute | 30 | |
| Address changes per cart per hour | 6 | Each one re-quotes a driver and reveals kit contents — see §7 |
| Expired-unconverted strikes | After 3 carts in 24 h that held last units and expired without an order, that identity's TTL halves for 24 h and last-unit holds require a verified phone | Proportionate; invisible to honest shoppers |
| Guests cannot hold last units in more than 2 skus | 2 | |
| Bot friction | Only when signals trip: require sign-in / phone OTP before further holds. **Not** a CAPTCHA on every add | |

Every refusal is a normal product sentence ("You can hold up to 3 'last one' items at a time"), not a
security error, and is logged as an `abuse_signal` row for the admin view (§8.6).

### 1.9 Last-unit contention messaging

- **Badge on a product card:** "Only 2 left today" when available ≤ `scarcityBadgeThreshold` (3).
  Counts above that are never shown (exact depths let a competitor scrape the kit).
- **When the last unit is in another cart:** the card does **not** say "in someone's cart" by default.
  It shows the truthful *next* option: "Arrives tomorrow" (Scheduled) plus **"Tell me if it frees up
  today"** — an in-session watch: if the hold lapses while this customer is still on the site, a toast
  offers it to them first-come. This is honest, useful, and gives no one a reason to sit on a cart.
  Whether to *also* say "in another customer's cart" is owner question 2.
- **Never** fake scarcity. The badge is the ledger's number or it is absent.

### 1.10 Release rules (complete list)

Released immediately: line removed · quantity reduced (the difference) · lane moved (old pool) ·
swap committed (old sku; atomic with the new hold, §4.7) · cart emptied · sign-out · address change
confirmed (old kit) · fulfilment mode switched (old pools) · order placed (**converted**, not
released) · admin manual release · kit closed / driver off shift / store closed (§1.12-1.13).
Expired by time: TTL · ceiling · checkout TTL after its one renewal.
Both the 15-second sweeper **and** lazy expiry on every read (`holds.ts:104-112` already does this)
— a missed sweep never leaves a ghost hold. Every transition writes one append-only `hold_event`.

### 1.11 Holds across driver kits when the best driver changes

This is the hardest part of the owner's model and the place it collides with the dispatch doc's
assumption that "the customer's promise is a window, not a driver, so a changed driver is invisible"
(`DRIVER-ASSIGNMENT-MODEL` §4.3). With kit-specific inventory that is only true **if the other
driver also carries the held units.** Rules:

1. **A unit hold pins the cart to a vehicle.** Before the first Express add, the menu is the union of
   the on-time-safe drivers' kits (dispatch doc §4.2). The first Express add picks the best-scoring
   vehicle that has the unit and pins the cart to it. From then on the Express badge reflects **that
   kit**; anything it lacks shows "Arrives tomorrow" or "Swap to Express".
2. **Re-home, never split.** One Express order = one driver. If adding an item would be possible on a
   different safe driver who **also has every unit already held**, the server may re-home the whole
   cart: acquire everything on kit B, then release kit A, in one transaction. If it cannot get
   everything, nothing moves.
3. **Address change** (different zone, different driver): run the re-home attempt. Lines that cannot
   follow are shown in the **review sheet** (§3.2): stays Express / moves to Scheduled / swap / remove.
   The **old holds are kept for `rehomeOverlapSec` (120 s)** while the customer decides, so cancelling
   the address change loses nothing. Holding both for two minutes is the cheaper mistake.
4. **Driver goes on break / off duty / out of service / fails the on-time guard while the cart is
   open:** same re-home attempt, silently if it fully succeeds; otherwise a `cart.rehome_needed`
   event and the review sheet. The vehicle id and driver identity are **never** sent to the browser.
5. **At placement** the pinned vehicle is passed to dispatch as a **hard pin** (constraint H1) because
   the units are physically there. If the on-time guard now fails for that vehicle, the server tries
   rule 2, and if that fails it tells the customer **before** placing — new window, Scheduled, or
   swap. Never after.

### 1.12 Holds vs the nightly restock and the Sunday kit rebuild

Settled facts: restock is overnight; a new kit is built Sunday morning and broken down Sunday night
(`docs/HANDOFF-TO-CODEX-2026-09-17.md:235`). The Sunday breakdown is a full count
(`docs/DISCREPANCY-ATTRIBUTION-AND-SCOREBOARD-PLAN-2026-09-17.md:267`, `inventory.py:2155-2184`).

- **Express holds never survive a kit closing.** When a driver ends shift or a kit is opened for
  breakdown, all `soft`/`checkout` holds on that vehicle are expired with reason `kit_closed`; carts
  get the review sheet offering Scheduled.
- **A breakdown count may not open while the kit still has `reserved` units** (undelivered orders).
  Those must be delivered, cancelled or reassigned first — otherwise the count "finds" units that are
  promised. Soft holds are simply expired. `inventory.open_count` has no such guard today.
- **Restock raises availability but never touches holds.** A `restock` event changes `on_hand` only.
- **Scheduled orders reserve the loadable pool, and the overnight kit build must honour them first.**
  The pick list for tomorrow's kits starts with "reserved for order" units, per driver/window, before
  any general kit fill. Without this a scheduled order is a promise against stock the morning kit
  build may hand to Express.
- **Kit rebuild day:** Express ordering for a zone opens only once that day's kit is *accepted by the
  driver* (the handover moment the discrepancy plan adds). Before that, the menu shows Scheduled only.

### 1.13 Holds vs closing time and the 15:00 cutoff

- **Express last order:** accepted only if the quoted P80 arrival is at or before licensed close minus
  `express.closeBufferMin` (10). From 30 minutes before that moment the cart shows "Order by 8:40 PM
  for delivery tonight". After it, Express lines get the review sheet → Scheduled. A hold's
  `expiresAt` is clamped to this moment. **Compliance check needed:** the demo fixture trades
  9:00a-11:00p (`shop/data.jsx:77-98`); California limits retail delivery hours (believed 6:00 AM -
  10:00 PM under 4 CCR §15403) — confirm with compliance before configuring any zone past 10 PM.
- **Scheduled same-day cutoff (15:00 store-local):** evaluated by the **server at placement**
  (`dispatch/quote.ts::checkScheduledWindow`, timezone- and DST-safe per `dispatch/README.md`). A
  hold does **not** freeze the cutoff. From 14:45 the window picker says "Order by 3:00 PM for today".
  At 15:00 same-day windows disappear; a cart that had one selected is asked to pick again — never
  silently moved to tomorrow. One exception, as a setting: a customer **already in checkout with a
  window hold** gets `scheduled.cutoffGraceSec` (120 s) to finish.
- **Store closed:** browsing and carting Scheduled-for-tomorrow remain possible (day-ahead booking is
  a settled rule); Express adds are refused with the opening time.

### 1.14 "No staging wait" and holds

At placement, in **one transaction**: verify version → convert unit holds to `reserved` → convert the
capacity hold → create the order(s) → write the dispatch assignment as **released** (not staged) →
publish `driver.tasks.<driverId>` (id only). `release.ts` keeps its rules for *Scheduled* orders
(released at the commit horizon); for Express add a policy value `express.releaseMode = 'immediate'`.
Joint re-sequencing continues to improve every stop except the driver's current one (the owner's
"only the current stop is locked" decision, `dispatch/README.md` refuter finding 2).

### 1.15 Security for holds

Identifiers: `cartId`, `holdId`, `lineId` are server-generated, ≥128-bit random, never sequential
(today's `'sl'+counter`, `shop/data.jsx:815`, is demo-only). A hold is bound to **cart + session (or
customer)**; presenting a `cartId` alone does nothing (the hijack lesson, `holds.ts:20-41`). Refusals
are indistinguishable between "wrong id" and "not yours". The browser never receives vehicle ids,
driver ids, kit ids or exact depths above the scarcity threshold. All hold mutations are rate-limited
(§1.8) and audited (`hold_event`). The atomic statement is a single conditional update —
`UPDATE pool_stock SET held = held + :q WHERE pool=:p AND sku=:s AND on_hand - reserved - held >= :q`
— so two simultaneous adds for the last unit cannot both succeed, on any number of app servers.

---

## 2. Price, promotion, tax and loyalty integrity

### 2.1 Server-side re-pricing at every step

**Rule: the browser displays money; it never decides money.** The storefront design already obeys
this *inside the browser* (one `computeCartTotals` call, `shop/data.jsx:984-992`). In production the
same discipline moves to the server:

| Step | Server does | Browser receives |
|---|---|---|
| Any cart read or write | Re-prices the whole cart from its own catalogue, its own rules, its own tax table | A priced cart object + `cartVersion` + `pricedAt` |
| Checkout start | Re-price; lock prices (§2.3); upgrade holds | Same, plus `priceLockUntil` |
| Place | Re-price **again inside the placement transaction**; compare with `expectedTotalCents` and `cartVersion` sent by the browser | Orders, or `409 cart_changed` with a line-by-line diff |

`expectedTotalCents` is **not** trusted as a price. It is a consent check: "the customer pressed a
button that said $257.50 — is that still the number?" If not, nothing is placed and the review sheet
shows what changed. This closes the gap `pos_sale_lines.py` names for itself (discount is
client-declared, `wm-demo/docs/SALES.md:130-131`; tender total never server-verified, `:134-135`) —
the web checkout must not inherit it: **no price, discount, fee, tax, tip cap, loyalty value or total
is ever read from the request body.** The request carries ids, quantities, codes and choices only.

Engine placement (the same decision as swap plan Q5): run the pricing engine **server-side** (the
commerce-logic bundle is pure JS; the TypeScript platform can import it directly — no Python port
needed for the web path) and keep the browser copy for instant display only. A contract test prices
the same 50 fixture carts both ways and fails on a one-cent difference.

### 2.2 Promotions: two rule shapes today — one must win

The storefront prices with `E.BUILTIN_RULES` (`shop/data.jsx:977`), rules compiled into the engine
bundle (`shared/commerce-engine.js:834`). The owner's decision is `hw.rule.v1`
(`docs/promotions/BATCH-PROMOTIONS-PROPOSAL.md` §2), evaluated by `wmdemo/engage/promotions.py`. The
swap plan found the same split from the other side ("nothing bridges its Rule shape into the
commerce-logic engine's Rule type", `SWAP-RECOVERY-FLOW-PLAN` §2 step 5).

**Recommendation:** `hw.rule.v1` is the only authored shape. The server evaluates it and hands the
pricing engine a list of **already-decided effects** (rule id, rule version, lines matched, cents).
The cart engine keeps doing what it is good at — lanes, fees, minimums, allocation, "spend $X more"
progress — and stops owning promotions. `BUILTIN_RULES` becomes test fixtures only.

| Topic | Recommendation |
|---|---|
| Promo expiry mid-cart | Promotions are evaluated live on every re-price. If one ends while the item is in the cart, the cart shows a one-line notice ("Aged flower 15% ended at 6:00 PM") and the new total. **Exception:** once checkout has started, discounts shown at checkout start are honoured until the checkout hold ends (`promo.checkoutGraceSec` 300). A customer should never watch the total rise while typing |
| Stacking | `hw.rule.v1` carries `stackable` and `priority`. Default remains the engine's `discountStrategy: "best-single"` (`commerce-engine.js:314`): the single best non-stackable rule, plus any rules explicitly marked stackable, never exceeding caps |
| Per-order caps | Honour `then.cap_cents` and `then.max_per_order` from the rule; add a store-level `promo.maxDiscountPctOfSubtotal` (default 50%) as a safety net against a mis-typed rule |
| Sale items | Keep `neverDiscountSaleItems: true` |
| Codes | `POST /promo-codes` with the code only. Server answers applied / not-applicable-with-reason. 5 attempts per cart per 10 min, 20 per IP per hour; identical response time for "unknown" and "not eligible" so codes cannot be enumerated. First-order-only and one-per-customer rules are enforced by the existing idempotent `consume()` (`UNIQUE(promotion_id, order_id)`) **inside the placement transaction** |
| Snapshot | Every placed order stores the rule ids **and versions** that priced it, so a swap or refund re-prices against the rules the customer actually agreed to (the engine already prices swaps against frozen agreed totals) |
| Batch-targeted rules | A rule on `batch.*` needs to know which batch the customer will receive. For Express that is knowable (the kit holds specific batches); for Scheduled it is decided at kit build. Recommendation: batch rules apply on Scheduled only when **every** loadable batch of the sku matches; otherwise not advertised. Flagged for the promotions team |

### 2.3 Price lock

`price.lockWithHold = true`: the unit price at add-to-cart is honoured while that line's hold is
alive (at most 25 + 10 minutes). If the price **drops**, the customer gets the lower price. If the
hold lapses, the line re-prices at current price on re-acquire and says so. Cheap, fair, and removes
an entire class of "the total changed" support contacts.

### 2.4 Compliance daily purchase limits — what is needed (nothing exists)

Confirmed absent in both repos (`SWAP-RECOVERY-FLOW-PLAN` §3). Build:

1. **Product facts:** `compliance_class` (flower-equivalent, concentrate, immature plant, non-cannabis)
   and `net_cannabis_g` / `concentrate_g` on every product. No weight = not sellable online.
2. **Limits config** per licence type and customer type, date-versioned like `tax.py`. Starting
   values to be **confirmed by compliance**: adult-use 28.5 g non-concentrated, 8 g concentrate, 6
   immature plants per day; medical 8 oz unless the recommendation says otherwise.
3. **Running total** `customer_daily_purchase(customer_id, licence_id, business_day, class, grams)`
   counting **every channel** — web, POS register, Weedmaps — because the limit is per person per
   day per licensee, not per website.
4. **Three checks:** at add-to-cart (friendly: "That would go over today's legal limit — you can add
   up to 3.5 g more"), at checkout start, and **authoritatively inside the placement transaction**
   with the customer-day row locked, so two devices placing at the same second cannot both pass.
5. **Swaps re-check** (the swap plan's attack #2 currently succeeds).
6. **Business day** is store-local. A Scheduled order counts against the day it is **delivered**.
   Flag for compliance confirmation.

### 2.5 Age, ID, medical vs adult-use

- **Age gate** on first visit (21+, or 18+ with a medical recommendation). Absent today. Marketing
  pages behind it per the Engage landing-page decision.
- **Account + ID verification before the first order**, via the existing Verify module (integrate,
  do not modify `idv/*`). Cart and holds work before verification; **placing** does not.
- **ID re-check at the door** already exists in the driver flow (`mobile/screen-task.jsx:1`).
- **Customer type is a server fact**, derived from a verified, unexpired recommendation — never a
  toggle in the browser. It drives tax (`tax.py` `member_type`), limits (§2.4), and 18-20 eligibility.
  A recommendation expiring before a Scheduled delivery date blocks that window with a clear reason.

### 2.6 Minimum order and delivery fee

Keep the design: per-lane minimum as a progress bar (`shop/screen-cart.jsx:353-376`), per-lane fee
rows (`:485-521`), both from operator settings (`shop/data.jsx:917-929`). Additions: per-**zone**
minimum and fee (the engine comment says minimums vary by zone, `commerce-engine.js:219-225`; the
address-first flow makes the zone known before the first add); the minimum is evaluated **after**
discounts or before — pick one and state it (recommend: on merchandise subtotal before discounts,
which is what the bar shows today); an unheld/expired line does not count toward the minimum.
Whether the delivery fee is inside the excise base (`taxDeliveryFee: false`, engine pricing config)
is a **tax-compliance confirmation**, not a design choice.

### 2.7 Tip

Keep: Express only, after tax, recorded on the Express order (`shop/screen-checkout.jsx:96-119`).
Fix: the custom amount has no ceiling and accepts anything `+custom` parses, e.g. `1e5`
(`:347`). Add `tip.maxPct` (100% of lane subtotal) and `tip.maxCents` ($200), digits-and-one-decimal
validation, and a confirm step above 50%. With pay-at-the-door the online tip is a **pledge** shown
to the driver as part of the amount to collect (cash) or added at the debit terminal; say so on
screen. Scheduled tips: allow at the door only (no driver is assigned at order time — the design's
own reasoning, `:31`).

### 2.8 Payment method constraints

`SHOP_PAYMENT_METHOD_ID = 'card'` (`shop/data.jsx:41`) cannot ship. Recommended selector at
checkout: **Cash at the door · Debit at the door** (and CanPay/ACH later — the swap plan already
flags that it needs its own settlement class). Consequences the design must carry:

- **Cash feeds the driver's cash cap** — the dispatch hold already has a `cash` dimension
  (`holds.ts:58-62`, `:266-268`). So payment method must be chosen **before** placement and a change
  of method re-runs the capacity check.
- **Cash:** ask "Need change? I'll pay with $___" (drivers carry limited change); show the exact
  amount due including tip pledge.
- **Debit at the door:** note any terminal fee and whether totals round (cashless-ATM style rounding
  must be disclosed before placement, not at the door).
- **Swap settlement** follows the method (`settle_at_door`, `shared/commerce-governance.js:72-73`).
- The `PaymentMethod` contract (`contracts/index.js:160`) has `cash|card|split|cod|prepaid`; add
  `debit_at_door` rather than overloading `card`.

Needs four concepts (desktop + phone): payment-method + change + tip block.

### 2.9 Idempotent placement, double-submit, back button, failure recovery

| Risk | Today | Recommendation |
|---|---|---|
| Double tap / retry | Guarded by "cart is empty" in the browser (`shop/screen-checkout.jsx:183-196`) — correct for a synchronous demo, meaningless across a network | Browser generates a `checkoutAttemptId` when checkout opens; sends it as `Idempotency-Key`. Server stores `(cart_id, key) UNIQUE` with the request hash and the response. Same key + same body → same orders returned. Same key + different body → 422. Button disables on press and shows progress |
| Two lanes, two orders | Written one after another in a loop (`:209-296`) | **One database transaction creates both or neither.** A customer must never end up with the Scheduled half of a cart placed and the Express half failed |
| Back button after placing | Cart cleared in memory | Cart status becomes `converted`; any write returns `410 cart_converted` with the order ids; the page redirects to the confirmation. Re-opening the confirmation URL requires the owner's session (no order ids guessable, §7) |
| Refresh mid-placement | — | Same idempotency key is reused from `sessionStorage`; the replay returns the original result |
| Hold lost at the last second | — | Placement transaction fails closed: nothing placed, holds that remain are kept in `checkout` stage, review sheet explains, one tap to continue |
| Version conflict / price change | — | `409 cart_changed` + diff → review sheet. Never place at a number the customer did not see |
| Daily limit / ID / hours / cutoff failure | — | Typed blockers in the same shape the engine already uses (`blockers[]`, `commerce-engine.js:1362-1377`), each with a plain sentence and an action |
| Prepaid methods later (CanPay) | — | Authorise **after** holds convert and **before** the order is released to the driver; on decline, holds return to `checkout` stage for one renewal, then lapse |
| Server error after commit, before response | — | Idempotent replay returns the committed orders. This is the case the key exists for |

**Security for §2:** request bodies carry ids and choices only; all money re-derived; promo-code
attempts rate-limited and constant-time; placement requires the session that owns the cart **and**,
for signed-in customers, the authenticated customer; every placement writes an append-only
`order_price_snapshot` (inputs, rule versions, tax breakdown, totals) for audit and disputes.

---

## 3. Express, Scheduled and Pickup in one cart

### 3.1 Address first — the step order has to change

Express inventory is one driver's kit, and the driver is chosen from the address. Therefore **no
Express item can be truthfully shown, let alone held, before the address is known.** Today the
header "Deliver to Long Beach · 90804" is a fixture (`shop/data.jsx:50-60`, with its own warning that
Long Beach is not even one of the modelled van regions) and the real address is captured at the end
of checkout (`shop/screen-checkout.jsx:372-445`), feeding nothing.

**Recommendation:** one address, captured up front, used everywhere.

1. First visit: age gate → "Where should we deliver?" (the five-field form already designed, plus
   saved addresses for signed-in customers). ZIP-only is enough to **browse**; a full validated
   address is required before the first **Express add**.
2. Server: validate → geocode → zone → `quoteAtAddress` (`dispatch/quote.ts`, in-process, no vendor
   call) → capacity hold + live window ("35-50 min") + the Express menu.
3. The header control becomes the real address switcher. Checkout shows the address read-only with
   "Change" — which runs §3.2.
4. Out-of-zone / undeliverable addresses (schools, public land, PO boxes, outside the licensed area):
   say so at step 1, offer pickup or a waitlist, never at the end of checkout.

Needs four concepts (desktop + phone): address-first entry + header address switcher.

### 3.2 The review sheet — one pattern for every "your cart changed"

Address change, fulfilment-mode switch, hold expiry, driver change, price/promo change, cutoff
passing and sign-in merge all produce the same situation: some lines can no longer be promised as
they were. One sheet, one grammar, reusing the existing tone:

> **We updated your cart for the new address.**
> Blue Dream 3.5g — still Express, about 40 min. ✓
> Sunset Sherbet 3.5g — arrives tomorrow at this address. **[Move to Scheduled]** **[Swap to Express]** **[Remove]**
> New total $84.10 (was $86.20). **[Looks good]** **[Undo address change]**

Rules: nothing is removed without the customer's tap; the default action per line is the least
destructive (keep → move → swap → remove); "Undo" works for `rehomeOverlapSec` because the old holds
are still alive (§1.11); if the customer walks away, the old holds expire normally and the unresolved
lines become "No longer held". Needs four concepts (desktop + phone).

### 3.3 Mixed carts and switching lane mid-cart

Keep the existing model — it is the best part of the design: **one cart, a lane per line, one order
per lane**, "Move to Scheduled/Express" on each line, per-lane minimum/fee/arrival
(`shop/screen-cart.jsx:12-20`, `:378-422`; checkout header "4 ITEMS · 2 ORDERS").

Hold consequences of a lane move: it is a **pool change**, so it is an atomic hold *move* (acquire in
the new pool, release the old, one transaction; refuse whole if the new pool cannot cover the
quantity — `shopSetLane` already refuses rather than splits, `shop/data.jsx:881-889`). A move into
Express resets that line to the Express TTL; a move to Scheduled gives it the longer one.

Missing and worth drawing: a **cart-level "make it all one delivery"** helper. The engine has
`planLaneMigration` (`commerce-engine.js:1882`) but the demo removed its control because design had
not drawn it (`Swap and Upsell Engine.html:3166-3171`). With two fees, two minimums and two
doorbells, many customers will want one. Needs four concepts.

### 3.4 Scheduled windows, their hold, and "tighter costs more"

- **Window picker** (absent; `:454` is a literal): days = today (until 15:00) and tomorrow
  (`scheduledMaxLeadDays: 1`), 1-hour windows inside licensed hours, each window showing
  *Available / Filling up / Full* — never a number.
- **Window capacity hold:** choosing a window places a `window_hold` for the checkout TTL (5 min,
  renew once). The picker says "Holding 2-3 PM for you". Expiry returns the customer to the picker
  with their cart intact.
- **Window capacity** = a per-zone, per-window order budget derived by dispatch from scheduled driver
  shifts (new setting family `scheduled.window.*`), not a hand-typed number per window.
- **"Customer chooses tighter costs more":** recommended shape is three widths priced relative to the
  standard fee — **Standard 1-hour** (base fee), **Precise 30-minute** (+$4, only in windows where
  dispatch reports slack, never at peak), **Flexible 3-hour** (−$2 or free). The narrow option is
  offered only when the on-time guard says it is safe; otherwise it is simply not shown. Fee numbers
  and whether to launch with more than the 1-hour window are owner question 6.
- Fees come from the server's lane/zone/window settings and appear as the lane's fee row; the client
  never computes them.

### 3.5 Pickup

Not on the storefront today. Recommendation: **pickup is a cart-level mode, not a third lane mixed
with delivery.** A "Delivery | Pickup" switch beside the address. In pickup mode the whole cart is
held against one store's on-hand pool, there is no fee, minimum or driver tip, and the customer
chooses a store and a ready-by time. Switching modes runs the review sheet (§3.2) because the pool —
and therefore what is available — changes completely. Pickup orders hold stock as `reserved` until
`pickup.noShowReleaseHours` (default: end of business day), then auto-cancel and release. ID and
daily-limit checks are identical. Mixed pickup + delivery in one checkout is owner question 8.
Needs four concepts (desktop + phone).

**Security for §3:** address and zone lookups are rate-limited (6 changes/hour/cart) because each one
reveals a kit's contents and, by triangulating which addresses flip the menu, roughly where drivers
are. ETA windows are rounded to 5 minutes; vehicle/driver ids never leave the server; saved addresses
are returned only to their authenticated owner; the geocoder receives the address and nothing else
about the customer.

---

## 4. The Swap feature

### 4.1 Verdict: **APPROVE WITH CHANGES**

**What the e-commerce swap design is, end to end** (from the engine demo, which is the only place it
is drawn in code — `Swap and Upsell Engine.html`, whose script is byte-identical to
`shared/commerce-engine.js` per the swap plan §1.1):

1. Each cart line gets **one** lane control. If the *same product* is available in the other lane the
   label is **"Move to Express/Scheduled"** — a plain lane change, no sheet. If it is not, the label
   is **"Swap to Express"** and a sheet opens (`:3178-3210`, `canSwap` → `sameProductAvailable`).
   If the other lane can offer neither, the control is simply absent.
2. The sheet is titled **"What we can get you today"**, with one explanatory sentence and **no
   failure framing** — the customer is never told why something they did not choose is unavailable
   (`:3336-3347`).
3. Three tabs — **Similar / Cheaper / Stronger** — each with up to 5 candidates ranked by a weighted
   similarity (price 1.0, size 0.8, THC 0.6, subcategory 0.5, strain type 0.4, brand 0.3), same
   category only, "Similar" within ±40% price, "Stronger" at least +2 THC points, items already in the
   cart excluded, candidates that cannot cover the full quantity excluded
   (`commerce-engine.js:252-270`, `:1426-1450`).
4. Each candidate shows brand, name, THC, size, the reason it was picked, where it will arrive, its
   price and the difference, and **"you'd lose [promotion]"** when the swap would break a discount the
   cart currently earns (`previewSwap`, `commerce-engine.js:1769-1810`). Swaps that would break a lane
   minimum are not offered.
5. **Swap** replaces the product on that line, moves the lane if the candidate dictates it, remembers
   `swappedFromProductId`, and the whole cart re-prices (`applySwap`, `:1651-1662`).

**Why approve:** the Move/Swap distinction is exactly right and rare; "arrives tomorrow" instead of
"unavailable" is the right voice; consequences are shown before the tap; ranking is transparent,
tunable and tested; nothing is margin-driven (upsell weights are a separate function — swap plan
§1.2); the same engine backs the driver and admin flows.

### 4.2 The changes, most valuable first

| # | Change | UX reason | Evidence |
|---|---|---|---|
| 1 | **Put the swap on the storefront.** `shop/screen-cart.jsx` implements only "Move to" and a passive "Arrives tomorrow" note; nothing in `shop/*` calls `canSwap`/`planSwap` | Today a customer whose item is not in the van has two choices: wait until tomorrow or give up. The designed third choice — "here is what we *can* get you in 40 minutes" — is the one that saves the sale | `shop/screen-cart.jsx:95-103`, `:409-418`; grep of `shop/*` |
| 2 | **Add a substitution preference at checkout** (pre-authorisation), per order with optional per-item override: **"Best match, never pay more" · "Contact me first" · "Remove it and adjust my total"** | The owner's recovery scenario ("driver does not have it") is slow because nobody knows what the customer wants. Asked once, calmly, at checkout, it turns most recoveries into a notification instead of a phone chase | Absent everywhere; swap plan §2 step 6 |
| 3 | **Make the swap move the hold atomically** (§4.7) | Without it a customer can pick an alternative that another cart takes between the tap and the re-price, or lose both the old and the new item | `applySwap` is a pure cart edit (`commerce-engine.js:1651`) |
| 4 | **Use the swap sheet for every "can't promise this line" moment** — hold expired and re-acquire failed, address changed, driver changed — not only for "make it faster" | One learned pattern instead of four different dead ends (§3.2) | — |
| 5 | **Show the all-in consequence, not just the shelf-price difference**: "New total $84.10 (−$2.10)" | The sheet shows `priceDeltaLabel` only; tax (~23% all-in here) and promotions make the real change different from the sticker change. The driver flow already shows "Customer pays/is owed … new total" | `:3361-3380` vs `:3694-3703` |
| 6 | **One swap contract across the three surfaces**: same ladder order per intent, same labels, same delta presentation, same reasons, same record | A customer offered "Similar" by support and "Upgrade" by the driver for the same problem experiences two companies. Today: cart = Similar/Cheaper/Stronger; driver = intent toggle; POS = Upgrade/Similar/Cheaper where **Cheaper can never fill**; logistics = ungoverned | `pos/screen-orders.jsx:2058-2086`; `logistics/lorder.jsx:113-148`, `:327`; swap plan §1.5 |
| 7 | **Tighter candidate rules when the customer is not the one choosing** (pre-authorised or support-proposed): same category **and** subcategory, same strain type where known, size equal or larger, THC within ±5 points, price within −15%/+25% with any increase absorbed (rule 8), never a product that changes the compliance class or breaks the daily limit | ±40% and "Stronger" are fine when the customer is browsing alternatives themselves. They are not fine as an automatic substitute: a stronger or different-type product is a different experience, not a replacement | `defaultSwapConfig`, `commerce-engine.js:252-270` |
| 8 | **Never charge more without explicit consent; when the mistake is ours, the store absorbs.** Customer-initiated cart swap: customer pays the new price (they chose it). Recovery swap (mis-stock): customer pays the **lower** of old and new; difference absorbed by the store, recorded against the discrepancy incident. Driver upsell: customer pays, with recorded consent | The rule customers remember. Matches swap plan Q2 option A — **not re-asked here**; this plan assumes A until the owner answers there | `commerce-governance.js:72-73`; engine `priceDelta` enum |
| 9 | **Time-box a swap offer to the delivery promise, not to a link lifetime.** Offer expires in `swap.offerTtlSec` (10 min Express / 60 min Scheduled); the proposed replacement unit is **held for the offer's life**; on timeout the order follows the customer's stated preference (change 2) or, with none, support calls once and then removes the item with an adjusted total | The swap plan suggests a 30-60 minute consent link; a 90-minute Express promise cannot wait that long | swap plan §2 step 6 |
| 10 | **Add "remove this item and adjust my total" and "cancel the order" as first-class outcomes** beside substitute | The engine can only substitute. Sometimes the right answer is "just take it off" | swap plan §3 "cancel-line" gap |
| 11 | **Swapped lines stay visible as swapped** in cart, confirmation, receipt and order history: "Swapped from Sunset Sherbet", with **Undo** in the cart while the original is still available | `swappedFromProductId` is recorded but never shown on the storefront; an unexplained different product on a receipt is a support ticket | `commerce-engine.js:1659` |
| 12 | **Order the tabs by intent.** Customer cart: Similar → Cheaper → Stronger (as drawn). Recovery: **Closest match → Cheaper → Step up (free)**. Driver upsell: Upgrade → Stronger → Similar. Empty tabs are hidden, not shown with "Nothing here" | The first tab is the recommendation. In a recovery, leading with "Stronger/Upgrade" reads as an upsell on our own mistake | `:3349-3353`, `:3397` |
| 13 | **Phone-first sheet.** On a phone the sheet must be a modal bottom sheet with focus trapped, the line being swapped pinned at the top for comparison, tabs as a real tab list, 44 px targets, price change stated in words and sign (not colour), speed stated in words (not only ⚡/🗓) | The demo needs a `reveal()` scroll-and-flash hack because the sheet opens below the fold in one column — that is the phone experience today | `:3303-3316` |
| 14 | **Limit and count swaps.** `swap.maxPerOrder` (3 post-placement), and a per-line note when a line has already been swapped once | The swap plan found no counter. Repeated swaps on one order are a fraud and an ops signal | swap plan §3 |

### 4.3 Pre-authorised substitution at checkout (detail)

One calm question in checkout, default chosen by the owner (question 4):

> **If something isn't on the van when we get to it:**
> ( ) Send the closest match — I'll never pay more
> ( ) Contact me first
> ( ) Remove it and adjust my total

Stored per order (`substitution_pref`, the exact wording version shown, timestamp) and optionally per
line ("don't substitute this one"). "Closest match" uses the strict rules of change 7, notifies the
customer immediately with what changed and the new total, and offers a **one-tap reject** until the
driver departs for their stop (reject = remove the item). The pre-authorisation is recorded as consent
channel `customer_preauthorised` on the `SubstitutionRecord`; the engine's consent field needs that
one new value beside `driver_verbal` / `support_verbal` / `customer_confirmed`.

### 4.4 Consent capture and audit

| Situation | Consent | Evidence stored |
|---|---|---|
| Customer swaps in their own cart | The tap itself | cart event (who/when/from/to/price before/after) |
| Pre-authorised substitute applied | Checkout preference | preference text version + timestamp + notification sent + reject window outcome |
| Support-proposed recovery, price unchanged or lower | Customer taps the signed link **or** support attests a phone "yes" | link consumption record, or agent id + call reference |
| Anything that **raises** what the customer pays, or removes an earned promotion | Customer's own tap on the signed link only. Verbal is not enough | single-use token consumption (`signed_links.py` purpose `swap_consent`), IP/UA hash, exact figures shown |
| Driver upsell at the door | Driver attests + customer sees the new total on the driver's screen | existing driver sheet record |

Every committed change is one append-only `order_amendment` row holding the engine's
`SubstitutionRecord` unchanged (actor, reason, consent, money, warnings) — the swap plan's §4 contract.

### 4.5 Swap vs refund vs partial cancel — the decision order

1. Same product available from another safe driver within the promised window → **reassign, no swap**
   (customer sees nothing).
2. Strict-rule candidate exists in the kit **and** preference = closest match → substitute, notify.
3. Candidates exist but preference = contact me → propose (10-minute offer, unit held).
4. No acceptable candidate, or customer declines → **remove the line**, re-price; if the order falls
   under the lane minimum because of *our* mistake, the minimum and fee are waived, not enforced.
5. Customer prefers, or the removed line was the point of the order → **cancel the order**, release
   all reservations, no charge.
6. Already paid (prepaid methods later) → refund the difference to the original method; never store
   credit unless the customer chooses it.

### 4.6 Candidate quality — settings by context

| Setting | Customer cart | Recovery / pre-authorised | Driver upsell |
|---|---|---|---|
| Same category | yes | yes | yes |
| Same subcategory | preferred (weight) | **required** | preferred |
| Same strain type | preferred | **required when known** | preferred |
| Price band | ±40% | −15% / +25%, increase absorbed | up to 2× (`maxUpgradeMultiple`) |
| THC | "Stronger" ≥ +2 | within ±5 points | "Stronger" ≥ +2 |
| Size | weighted | equal or larger | equal or larger |
| Brand | weighted 0.3 | weighted 0.6 (people buy brands) | weighted 0.3 |
| Must be in the assigned kit | lane pool | **yes, and not held by anyone else** | yes |
| Must pass daily limit + customer type | yes | yes | yes |
| Kit data age | ≤ 10 min (`maxAvailabilityAgeMs`) | live ledger | live ledger |

### 4.7 Moving the hold atomically

One server operation, `swap_line(cartId, lineId, candidateSku, expectedVersion)` — or for a placed
order, `commit_amendment(...)`:

```
BEGIN
  lock cart (or order) row; check version
  acquire: UPDATE pool_stock SET held = held + q            -- or reserved, for an order
           WHERE pool = :newPool AND sku = :new AND on_hand - reserved - held >= q
  if 0 rows -> ROLLBACK, return 409 candidate_gone (sheet refreshes; old hold untouched)
  old hold  -> status 'moved', replaced_by = new hold id
  release:  UPDATE pool_stock SET held = held - q WHERE pool = :oldPool AND sku = :old
  update line (sku, lane, swapped_from), re-price, bump version
  append hold_event x2, cart_event / order_amendment
COMMIT -> publish cart.<id> 'cart.repriced' / order.<id> 'amendment.committed' (ids only)
```

Acquire-before-release means the customer can never end up holding neither item. The new hold
**inherits the old hold's ceiling** (a swap is not a way to reset the 25-minute clock). For a placed
order the same statement moves `reserved` instead of `held`, inside the same transaction as the
`order_amendment` insert, and the kit-ledger events are `release` + `reserve` with a shared
`correlation_id` — which replaces the driver phone's `VanLedger` (`mobile/screen-task.jsx:22-58`).

### 4.8 Consistency between the three surfaces

Build **one shared swap component contract** (not necessarily one component — the driver sheet is
phone-native and the POS panel is desktop): same request/response, same ladders per intent, same
line/total presentation, same reason list (`REASONS_BY_INTENT`), same consent rules, same record.
Then: storefront sheet (new), driver sheet (already closest — move its ledger server-side), POS
`SwapPanel` (fix the three bugs: pass `intent` and `modes`, add the reason picker, mint a record id),
and **retire or rebuild `logistics/lorder.jsx`'s `SwapPicker`**, which edits local state over the whole
catalogue with no kit awareness. A contract test feeds one order + one kit to all three entry points
and asserts identical candidates, identical money and one identical record.

**Security for §4:** candidates and money are computed server-side from the server's kit ledger and
catalogue; the client sends a candidate **sku**, never a price or delta; every swap endpoint checks
the caller owns the cart/order (customer), is assigned to it (driver, kit-scoped — the engine's
`wrong_kit` refusal, `commerce-engine.js:2222-2238`), or holds `orders:amend` for that **store**
(support); consent links are single-use, short-lived, scoped to one order+line+candidate, and
constant-time on failure; swap count per order capped; every proposal, view, decision and timeout is
audited.

---

## 5. Abandoned cart recovery, saved-for-later, reorder, notify-me

### 5.1 Abandoned cart (cannabis marketing rules)

Constraints that shape this: SMS carriers refuse cannabis content on standard messaging routes;
individualised marketing may only go to people whose age has been verified; consent must be
express, logged, and revocable with STOP; quiet hours apply. The Engage decision already fits — short
SMS + landing page with a per-page age gate.

| Rule | Recommendation |
|---|---|
| Who | Signed-in, age-verified customers with **express marketing consent** on file (Engage/Alpine audience), not guests, not "transactional-only" opt-ins |
| When | Cart idle 30 min with ≥1 line **and** no order placed; a second touch at 20 h only if the first got no click; never more than 2 per cart, never more than 1 cart reminder per customer per 7 days |
| What (SMS) | No product names, no cannabis words, no prices: "You left something in your bag at Hyperwolf — it's saved for you. [link] Reply STOP to opt out." The link opens a gated page that re-acquires holds **on tap**, not on send |
| What (email) | May show items and prices behind the age-verified account; still no medical claims |
| Holds | A reminder **never** keeps a hold alive. The cart contents are saved; availability is re-checked when they return |
| Quiet hours | Store-local 9 PM - 9 AM suppressed, queued to 9 AM |
| Incentive | Not by default (it trains abandonment). Owner question 7 |
| Measure | Sent → opened → returned → re-held → ordered; suppress the programme automatically if unsubscribe rate exceeds a threshold |

### 5.2 Saved for later

"Save for later" on any cart line: releases the hold, moves the line to a `saved_item` list on the
customer, and shows the item's current availability each visit ("Express today" / "Arrives tomorrow"
/ "Not available right now"). No holds on saved items, ever. Move back to cart = normal add.

### 5.3 Reorder

The home screen already draws a reorder card and adds the past order's lines with `shopAddAll`
(`shop/data.jsx:841-848`). Make it honest against today's kit: the card previews per line what will
happen (Express / tomorrow / unavailable / price changed), the add is one server call that acquires
holds for all lines atomically-per-line (best effort, clamp reported — the `catalog.reserve` shape,
`wmdemo/catalog.py:1742-1777`), and the result opens the cart with a summary line
("3 of 4 items added — Sticky Rice isn't on today's van"). Pre-authorised substitution preference is
remembered from the last order.

### 5.4 Out-of-stock notify-me

Two kinds, kept separate: **"Tell me if it frees up today"** (in-session, hold-lapse watch, §1.9 —
no consent needed, nothing sent) and **"Notify me when it's back"** (a `stock_notify_request` with
zone + channel + a consent record; sent once when *available to sell* in that customer's zone goes
from 0 to ≥ 1, batched every 15 minutes, first-come order, message rules as §5.1). Never auto-add to
the cart; the message deep-links to the product with the address pre-set.

**Security for §5:** links are signed, single-purpose, expire in 7 days, and open a page that
requires the customer's session to show anything; no product data in SMS; consent id stored on every
send; STOP handled by the messaging provider **and** mirrored to Engage.

---

## 6. Accessibility and mobile

Every proposal above must work at 375 px wide and with a keyboard/screen reader:

- Hold state and countdown: text, not colour; one polite `aria-live` announcement at the 2-minute
  mark and at expiry; the "Keep my items" button is reachable in one tab from the cart heading.
- Review sheet and swap sheet on phones: full-height bottom sheets, focus trapped, Escape/close
  restores focus to the line that opened them, tabs use `role="tablist"`, candidate cards are
  single buttons with the full sentence as the accessible name ("Swap to Blue Dream 3.5g, $42, $2 less,
  arrives in about 40 minutes").
- Stepper caps say why in text next to the control, not only by disabling the "+" button.
- The window picker is a radio group, one window per row on phones, the width options as a second
  radio group with the fee stated in the label.
- Address-first flow: one field per line on phones (the checkout form already does this and measured
  its label contrast at 375 px, `shop/screen-checkout.jsx:355-364`).
- Contrast: the existing `inkDim` finding stands — no `inkMute` for informational text.
- Motion: no auto-scrolling "reveal" flashes (`Swap and Upsell Engine.html:3310-3316`); respect
  `prefers-reduced-motion`.
- Nothing in this plan requires hover; every action is a tap target ≥ 44 px (tap-target changes are
  themselves gated on owner approval — the storefront's existing components already meet this).

**Screens that need four concepts (desktop + phone) before build:** (1) hold states on cart lines +
lane-header timer; (2) the review sheet; (3) address-first entry + header address switcher; (4)
storefront swap sheet (mobile frame exists in Figma per the demo's spec reference; desktop and hold
states do not); (5) substitution preference block at checkout; (6) payment method + change + tip
block; (7) Scheduled window picker with widths; (8) pickup mode switch; (9) "make it one delivery"
helper; (10) admin holds view. Nothing else in this plan is a new screen.

---

## 7. Security, in one place

| Concern | Rule |
|---|---|
| Identifiers | `cart_id`, `line_id`, `hold_id`, `order_id`, `attempt_id`, consent tokens: server-generated, ≥ 128-bit random (or UUIDv7 where ordering matters, with a separate random public id). Never counters, never derived from customer data |
| Ownership | Every cart/hold/order endpoint resolves the object **through the caller**: guest session cookie → its one cart; authenticated customer → their carts/orders; driver → orders assigned to their vehicle; support → orders in stores their token covers. A valid id from another owner returns the same 404 as a nonexistent id |
| No client-trusted money | Request bodies carry ids, quantities, codes, choices and the displayed total as a *consent check*. Price, discount, tax, fee, tip cap, loyalty value, delta, settlement are computed server-side and snapshotted |
| Atomicity | Conditional single-statement updates for stock; row locks for cart/order/customer-day; idempotency keys on place, swap, amend, notify |
| Rate limits | Per session, per cart, per identity, per IP (§1.8, §2.2, §3); refusals are product sentences, logged as signals |
| PII minimisation | Realtime events carry ids only (`realtime_channels.py:62-63`); SMS carries no product or price; logs store hashes of session ids; addresses are stored once on the customer and referenced by id from carts and orders; geocoder gets the address only; driver/vehicle/kit ids never reach the storefront |
| Audit | Append-only `cart_event`, `hold_event`, `order_price_snapshot`, `order_amendment`, `abuse_signal`, `consent_event` — same discipline as `metrc/ledger.py` and `lp/cases.py` |
| Abuse signals | last-unit hoarding, expired-unconverted strikes, address-change churn, promo-code enumeration, swap count per order, multiple carts per device/IP, placement 409 storms; surfaced in the admin holds view with manual release and a per-identity cool-down |
| Kit inference | Depth shown only as "Only N left" at ≤ 3; menu differences across addresses are rate-limited; ETA windows rounded; no per-driver menus keyed by a driver id in any URL |
| Compliance data | Customer type, verified age, daily totals are server facts with their own audit; the browser can display them, never set them |

---

## 8. Data model, API sketch, events, settings, metrics

Target: the TypeScript platform (Fastify + Drizzle on Aurora Postgres, Valkey for sweeps/pubsub —
the settled stack), as a `commerce` module beside `dispatch`, following the same module posture
(`module.json`, no routes until wired). The `wm-demo` SQLite side gets the same tables for the demo
server; `catalog.py:reserve/commit_reservation/release_reservation` (`:1742-1860`) is the
shape to copy, generalised from `(region, sku)` to `(pool, sku)`.

### 8.1 Tables (new unless noted)

| Table | Key columns | Notes |
|---|---|---|
| `cart` | `cart_id` (random), `store_id`, `customer_id?`, `session_hash?`, `channel` (web/app), `mode` (delivery/pickup), `address_id?`, `zone_id?`, `quote_id?`, `pinned_vehicle_id?` (never serialised), `customer_type` (server fact), `status` (open/checkout/converted/abandoned/expired/merged), `version`, `first_hold_at`, `hard_expires_at`, `price_lock_until`, `last_activity_at`, `substitution_pref`, timestamps | One open cart per (customer, store) and per (session, store) — partial unique indexes |
| `cart_line` | `line_id`, `cart_id`, `sku`, `qty`, `lane`, `unit_price_cents_locked`, `pricing_snapshot_json`, `hold_state` (held/unheld/none), `swapped_from_sku?`, `no_substitute` flag, `added_at` | Unique (cart_id, sku, lane) — the design's "one line per sku+lane" |
| `pool_stock` | `pool_kind` (driver_kit/kit_loadable/store_on_hand), `pool_id`, `sku`, `on_hand`, `reserved`, `held`, `updated_at` | The one availability number; all changes by conditional UPDATE. For kits this **is** the persisted kit ledger's current view |
| `stock_hold` | `hold_id` (random 128-bit), `cart_id`, `line_id`, `pool_kind`, `pool_id`, `sku`, `qty`, `stage` (soft/checkout), `status` (active/released/expired/converted/moved), `reason?`, `created_at`, `last_extended_at`, `expires_at`, `hard_expires_at`, `plan_version`, `replaced_by_hold_id?` | Lazy expiry on read + 15 s sweeper |
| `hold_event` | `event_id`, `hold_id`, `kind` (acquire/amend/touch/stage/release/expire/convert/move), `qty`, `actor`, `at` | Append-only |
| `capacity_hold` | = `holds.ts` `HoldRecord` persisted, plus `stage`, `last_extended_at`, `hard_expires_at` | Driver capacity; existing module |
| `window_hold` | `hold_id`, `cart_id`, `zone_id`, `window_start`, `window_width`, `expires_at`, `status` | Scheduled window capacity |
| `checkout_attempt` | `cart_id`, `idempotency_key` UNIQUE, `request_hash`, `status`, `response_json`, `created_at` | Replay returns `response_json` |
| `order`, `order_line` | existing shapes + `lane`, `substitution_pref`, `swapped_from_sku`, `pinned_vehicle_id`, `window` | Both lane orders in one transaction, linked by `checkout_id` |
| `order_price_snapshot` | `order_id`, inputs, `rule_ids_versions[]`, tax breakdown, totals, `pricer_version` | Append-only |
| `customer_daily_purchase` | `customer_id`, `licence_id`, `business_day`, `class`, `grams`, `updated_at` | Row-locked in placement/swap |
| `compliance_limit` | `licence_type`, `customer_type`, `class`, `max_per_day`, `effective_from` | Date-versioned like `tax.py` |
| `swap_proposal`, `swap_decision`, `order_amendment` | as `SWAP-RECOVERY-FLOW-PLAN` §4 | Unchanged from that plan |
| `consent_event` | `customer_id`, `kind` (marketing_sms/marketing_email/substitution/swap_consent/notify), `text_version`, `channel`, `evidence`, `at`, `revoked_at?` | |
| `stock_notify_request` | `customer_id`, `sku`, `zone_id`, `channel`, `consent_id`, `created_at`, `notified_at?` | |
| `saved_item` | `customer_id`, `sku`, `saved_at` | |
| `cart_event` | append-only: every cart mutation with actor, before/after ids, version | |
| `abuse_signal` | `identity_kind`, `identity_hash`, `signal`, `weight`, `at`, `cart_id?` | Feeds cool-downs and the admin view |
| `commerce_setting` | `key`, `scope` (global/store/zone/channel/lane), `scope_id`, `value`, `min`, `max`, `effective_from`, `changed_by` | The settings table below |

### 8.2 Hold state transitions

```
                add / re-acquire / merge-in
      (none) ──────────────────────────────▶ active:soft
                                             │  ▲ touch (meaningful action; ≤ hard ceiling)
   checkout start ───────────────────────────┤  │
                                             ▼  │
                                         active:checkout ── renew once ──▶ (same)
                                             │
         ┌──────────────┬───────────────┬────┴─────────┬────────────────┐
         ▼              ▼               ▼              ▼                ▼
      released       expired          moved        converted     (rollback: unchanged)
  remove/qty↓/lane  TTL/ceiling/    swap/rehome/   order placed
  /empty/sign-out   kit_closed/     merge          → pool_stock.reserved
  /address confirm  cutoff/close                     (kit ledger 'reserve')
```

### 8.3 API sketch (all under the caller's session; all writes idempotent)

```
POST   /api/shop/carts                                  → {cartId, version}
GET    /api/shop/carts/{cartId}                         → priced cart, holds (line-level), blockers
PUT    /api/shop/carts/{cartId}/address                 → quote, zone, window, menu revision; may return review diff
PUT    /api/shop/carts/{cartId}/mode                    → delivery|pickup (+storeId); review diff
POST   /api/shop/carts/{cartId}/lines                   {sku, qty, lane?}  → line + hold outcome (held / clamped / tomorrow)
PATCH  /api/shop/carts/{cartId}/lines/{lineId}          {qty} | {lane} | {noSubstitute}
DELETE /api/shop/carts/{cartId}/lines/{lineId}
GET    /api/shop/carts/{cartId}/lines/{lineId}/swap-options   → ladders (server-computed)
POST   /api/shop/carts/{cartId}/lines/{lineId}/swap     {candidateSku, expectedVersion}
POST   /api/shop/carts/{cartId}/lines/{lineId}/check    → re-acquire attempt for an unheld line
POST   /api/shop/carts/{cartId}/heartbeat               (visible tab only)
POST   /api/shop/carts/{cartId}/keep                    (the "Keep my items" tap)
POST   /api/shop/carts/{cartId}/promo-codes             {code}   DELETE …/promo-codes/{code}
POST   /api/shop/carts/{cartId}/checkout                → stage=checkout, priceLockUntil, checkoutAttemptId
PUT    /api/shop/carts/{cartId}/checkout/window         {start, width}
PUT    /api/shop/carts/{cartId}/checkout/payment        {method, cashTendered?}
PUT    /api/shop/carts/{cartId}/checkout/tip            {mode, pct?|cents?}
PUT    /api/shop/carts/{cartId}/checkout/substitution   {pref}
POST   /api/shop/carts/{cartId}/place                   Idempotency-Key; {expectedTotalCents, version} → orders | 409 cart_changed(diff) | 4xx blockers
POST   /api/shop/carts/{cartId}/saved                   {lineId}  (save for later)
GET    /api/shop/orders/{orderId}                        owner only
POST   /api/shop/notify-me                              {sku, zoneId}
GET/POST /s/{token}                                      signed swap-consent page (single use)
Admin: GET /api/admin/holds?store=…  POST /api/admin/holds/{holdId}/release  (scope holds:admin)
```

### 8.4 Realtime channel families (ids only, per `realtime_channels.py`)

| Family | Event types | Subscriber scope |
|---|---|---|
| `cart.<cartId>` | `hold.expiring`, `hold.expired`, `hold.moved`, `cart.repriced`, `cart.rehome_needed`, `cart.converted` | the cart's session/customer only |
| `zone.<zoneId>.menu` | `sku.availability_changed` (ref = sku) | any storefront in that zone; carries no counts |
| `kit.<vehicleId>` | `stock.changed` (ref = sku) | driver app for that vehicle, admin |
| `order.<orderId>` | `swap.proposed`, `swap.decided`, `swap.expired`, `amendment.committed` | customer, assigned driver, store support |
| `driver.tasks.<driverId>` | `task.released` (ref = order id) | that driver |
| `admin.holds.<storeId>` | `signal.raised` (ref = signal id) | support/admin |

### 8.5 Settings (the full set)

Scope column: **G** global, **S** per store, **Z** per zone, **C** per channel (web/app), **L** per
lane/fulfilment type. Values are read from `commerce_setting` with the most specific scope winning.

| Key | Default | Min | Max | Scope | Purpose |
|---|---|---|---|---|---|
| `hold.express.ttlSec` | 600 | 180 | 1800 | S, Z | sliding TTL from last meaningful action |
| `hold.express.hardMaxSec` | 1500 | 600 | 3600 | S, Z | ceiling from first hold on the cart |
| `hold.express.lastUnitTtlSec` | 300 | 120 | = ttlSec | S, Z | TTL when the hold takes availability to 0 |
| `hold.express.lastUnitHardMaxSec` | 900 | 300 | = hardMaxSec | S, Z | |
| `hold.scheduled.ttlSec` | 1200 | 300 | 3600 | S | |
| `hold.scheduled.hardMaxSec` | 3600 | 900 | 7200 | S | |
| `hold.pickup.ttlSec` | 1200 | 300 | 3600 | S | |
| `hold.pickup.hardMaxSec` | 3600 | 900 | 7200 | S | |
| `hold.checkout.ttlSec` | 300 | 120 | 600 | G | checkout stage (aligns with dispatch `holdTtlSec` family) |
| `hold.checkout.renewals` | 1 | 0 | 2 | G | |
| `hold.heartbeatSec` | 60 | 30 | 120 | G | client ping interval while visible |
| `hold.heartbeatMaxExtendSec` | 600 | 0 | 900 | G | how far heartbeats alone may extend past the last real action |
| `hold.warnBeforeExpirySec` | 120 | 60 | 300 | G | when the countdown becomes prominent |
| `hold.reacquireGraceSec` | 120 | 0 | 600 | G | silent re-hold on return if still free |
| `hold.rehomeOverlapSec` | 120 | 30 | 300 | G | old kit's holds kept while the review sheet is open |
| `hold.guest.ttlSec` | 300 | 120 | 900 | S, C | |
| `hold.guest.hardMaxSec` | 900 | 300 | 1800 | S, C | |
| `hold.sweepIntervalSec` | 15 | 5 | 60 | G | plus lazy expiry on read |
| `cart.maxQtyPerLine.express` | 4 | 1 | 10 | S | |
| `cart.maxQtyPerLine.scheduled` | 10 | 1 | 20 | S | |
| `cart.maxQtyPerLine.pickup` | 10 | 1 | 20 | S | |
| `cart.maxHeldUnits` | 15 | 5 | 40 | S | |
| `cart.maxActiveHoldSkus` | 12 | 3 | 30 | S | |
| `cart.maxLastUnitHolds` | 3 | 1 | 6 | S | per identity |
| `cart.guest.maxLastUnitHolds` | 2 | 0 | 3 | S | |
| `cart.openCartsPerCustomerPerStore` | 1 | 1 | 1 | G | fixed by design; listed so it is visible |
| `cart.scarcityBadgeThreshold` | 3 | 0 | 5 | S, C | show "Only N left" at or below |
| `cart.showInAnotherCart` | false | — | — | S, C | owner question 2 |
| `rate.holdAcquiresPerSessionPerMin` | 20 | 5 | 60 | G | |
| `rate.cartMutationsPerCartPerMin` | 30 | 10 | 120 | G | |
| `rate.addressChangesPerCartPerHour` | 6 | 2 | 20 | G | |
| `rate.openCartsWithHoldsPerDevice` | 2 | 1 | 5 | G | |
| `rate.openCartsWithHoldsPerIp` | 8 | 2 | 50 | G | |
| `rate.promoAttemptsPerCartPer10Min` | 5 | 3 | 20 | G | |
| `rate.promoAttemptsPerIpPerHour` | 20 | 5 | 100 | G | |
| `abuse.expiredLastUnitStrikes24h` | 3 | 1 | 10 | G | strikes before cool-down |
| `abuse.cooldownTtlFactor` | 0.5 | 0.25 | 1 | G | TTL multiplier during cool-down |
| `abuse.cooldownHours` | 24 | 1 | 168 | G | |
| `price.lockWithHold` | true | — | — | S | |
| `promo.checkoutGraceSec` | 300 | 0 | 600 | S | discounts shown at checkout start honoured this long |
| `promo.maxDiscountPctOfSubtotal` | 50 | 10 | 100 | S | safety net over rule caps |
| `promo.discountStrategy` | best-single | — | — | S | engine value |
| `tip.maxPct` | 100 | 25 | 200 | S | |
| `tip.maxCents` | 20000 | 1000 | 100000 | S | |
| `tip.confirmAbovePct` | 50 | 10 | 100 | S | |
| `payment.methods` | cash_at_door, debit_at_door | — | — | S, C | |
| `payment.cashChangeCapCents` | 10000 | 0 | 50000 | S | max "pay with" note for change |
| `lane.express.minimumCents` | 5000 | 0 | 20000 | S, Z | existing engine default |
| `lane.express.feeCents` | 200 | 0 | 2000 | S, Z | |
| `lane.scheduled.minimumCents` | 4000 | 0 | 20000 | S, Z | |
| `lane.scheduled.feeCents` | 0 | 0 | 2000 | S, Z | |
| `lane.minimumBasis` | subtotal_before_discounts | — | — | G | state it once |
| `express.closeBufferMin` | 10 | 0 | 60 | S, Z | last Express order = close − buffer − quoted P80 |
| `express.lastOrderWarnMin` | 30 | 10 | 60 | S | when "Order by …" appears |
| `express.releaseMode` | immediate | — | — | G | owner: no staging wait |
| `express.reopenRequiresKitAcceptance` | true | — | — | S | rebuild day |
| `scheduled.cutoffSecOfDayLocal` | 54000 (15:00) | — | — | S | existing dispatch setting |
| `scheduled.cutoffWarnMin` | 15 | 5 | 60 | S | |
| `scheduled.cutoffGraceSec` | 120 | 0 | 600 | S | only for carts already in checkout with a window hold |
| `scheduled.maxLeadDays` | 1 | 1 | 7 | S | existing dispatch setting |
| `scheduled.window.widths` | 60 | — | — | S, Z | minutes; owner question 6 may add 30 and 180 |
| `scheduled.window.preciseSurchargeCents` | 400 | 0 | 2000 | S, Z | |
| `scheduled.window.flexibleDiscountCents` | 200 | 0 | 1000 | S, Z | |
| `scheduled.window.preciseOnlyWhenSlack` | true | — | — | Z | |
| `scheduled.windowHold.ttlSec` | 300 | 120 | 600 | G | = checkout TTL |
| `pickup.enabled` | false | — | — | S | owner question 8 |
| `pickup.noShowReleaseHours` | end_of_day | 1 | 48 | S | |
| `pickup.readyLeadMin` | 30 | 10 | 120 | S | |
| `compliance.limits.*` | per class / customer type | — | — | licence | date-versioned; values confirmed by compliance |
| `compliance.businessDayBasis` | delivery_day | — | — | G | to confirm |
| `swap.cart.priceBand` | 0.40 | 0 | 1 | S | existing engine default |
| `swap.cart.maxCandidates` | 5 | 1 | 12 | S | |
| `swap.cart.strongerMinThcDelta` | 2 | 0 | 10 | S | |
| `swap.recovery.priceBandDown` | 0.15 | 0 | 0.5 | S | |
| `swap.recovery.priceBandUp` | 0.25 | 0 | 1 | S | increase absorbed |
| `swap.recovery.thcTolerance` | 5 | 0 | 15 | S | |
| `swap.recovery.requireSameSubcategory` | true | — | — | S | |
| `swap.recovery.requireSameStrainType` | true | — | — | S | when known |
| `swap.recovery.absorbIncrease` | true | — | — | S | pending swap plan Q2 |
| `swap.offerTtlSec.express` | 600 | 120 | 1800 | S | |
| `swap.offerTtlSec.scheduled` | 3600 | 600 | 14400 | S | |
| `swap.maxPerOrder` | 3 | 1 | 10 | S | |
| `swap.rejectWindow` | until_driver_departs | — | — | S | pre-authorised substitute reject window |
| `swap.consentLinkTtlSec` | 600 | 120 | 3600 | S | |
| `substitution.defaultPref` | best_match_never_more | — | — | S | owner question 4 |
| `recovery.abandoned.enabled` | false | — | — | S, C | owner question 7 |
| `recovery.abandoned.firstTouchMin` | 30 | 15 | 240 | S | |
| `recovery.abandoned.secondTouchHours` | 20 | 0 | 72 | S | 0 = none |
| `recovery.abandoned.maxPerCustomerPer7d` | 1 | 0 | 3 | S | |
| `recovery.quietHours` | 21:00-09:00 | — | — | S | store-local |
| `notify.batchIntervalMin` | 15 | 5 | 60 | G | |
| `notify.linkTtlDays` | 7 | 1 | 30 | G | |

### 8.6 Metrics to watch (all per store, per lane, per hour-of-week)

Hold conversion (holds → placed) · expiry rate · median hold age at conversion · **contention rate**
(adds refused because units were held) · **held-lost sales** (refused adds whose blocking hold later
expired unconverted — the cost of the TTL being too long) · last-unit hold conversion · re-acquire
success rate · re-home attempts / silent successes / review-sheet outcomes · "Keep my items" taps ·
review-sheet outcomes by cause · **double-promise incidents** (target 0) · **oversell incidents**
(order placed with no unit; target 0) · idempotent replays · `409 cart_changed` rate · daily-limit
blocks · rate-limit trips and abuse signals · swap sheet open → accept, by intent and tab · swap
price-delta distribution and absorbed cents · pre-authorised opt-in mix · recovery consent latency and
timeout rate · swaps per order · abandoned-cart send → return → order · notify-me → order · window
fill and precise-window uptake · Express last-order and cutoff refusals.

---

## 9. Build order — small shippable slices with QA and adversarial checks

Each slice is independently shippable, keeps the storefront design's components, and is refuted by
at least one adversarial pass (the estate's `refuter` convention) before it merges.

| # | Slice | Size | Delivers | QA / adversarial checks |
|---|---|---|---|---|
| 0 | **Server cart + one money authority** | M | `cart`, `cart_line`, `cart_event`; server re-price on every read/write; `place` with idempotency key, both lanes in one transaction; `order_price_snapshot`; storefront reads/writes through the API, keeps `SHOP.totals()` shape for display | Contract test: 50 fixture carts priced client vs server, zero cent drift · IDOR: another session's cart id → 404 · double-submit and replay return the same orders · partial-placement impossible (fault injection between the two order inserts) · no money field in any request body is read (schema strips + test) |
| 1 | **Address-first + quote + pinned kit** | M | Header address switcher wired to the checkout fields; `quoteAtAddress` + capacity hold; Express menu = pinned/union kit; `SHOP_CUSTOMER.zone` fixture removed | Out-of-zone at step 1 · address change rate limit · vehicle id never in a response (response-schema test) · ETA rounded |
| 2 | **Unit holds on add** | L | `pool_stock`, `stock_hold`, `hold_event`; conditional-update acquire; sliding TTL, ceiling, last-unit TTL, heartbeat rules; sweeper + lazy expiry; `holds.ts` `amend`/`touch`; kit ledger `hold`/`expire`/`move` persisted; driver `VanLedger` reads the server ledger | Two concurrent adds for the last unit: exactly one succeeds (100-way race test) · hold cannot be mutated with cart id alone · heartbeat-only cart dies at ceiling · release on every path in §1.10 (table-driven) · ledger never negative · replay of every event id is a no-op |
| 3 | **Expiry UX + re-acquire + realtime** | M | Held / expiring / no-longer-held states, "Keep my items", "Check again", `cart.<id>` events, review sheet v1 (expiry only) | Screen-reader announcement once · total excludes unheld lines · re-acquire grace · 375 px layout · reduced motion |
| 4 | **Checkout stage** | M | Checkout hold upgrade + one renewal; payment method + change note + tip caps; substitution preference; window picker (1-hour) + window hold; `express.releaseMode=immediate` | Tip `1e5` rejected · cash method feeds cash cap (dispatch test) · window hold expiry returns to picker with cart intact · cutoff at placement, grace only inside checkout · release-immediately path publishes `task.released` once |
| 5 | **Storefront swap sheet + review sheet v2** | M | `canSwap`/`planSwap` wired; atomic hold move; swap sheet as bottom sheet; address-change and re-home flows through the review sheet; swapped-from label + undo | Candidate gone between view and tap → 409, old hold intact · ceiling inherited · swap never crosses category · all-in total shown equals server total · undo within overlap window |
| 6 | **Compliance gates** | M | Age gate; Verify integration before place; customer type as server fact; daily-limit tables + three checks; medical expiry vs window | Two devices placing at once cannot both pass the day limit (row lock test) · swap re-checks limit · limits counted across POS + web fixtures · under-21 adult-use refused, 18-20 medical allowed |
| 7 | **Promotions + loyalty at checkout** | M | `hw.rule.v1` evaluated server-side, effects handed to the cart engine; promo-code endpoint with limits; rule ids/versions snapshotted; loyalty earn/redeem via Engage with the `(program, order)` idempotent consume inside placement; Alpine/Blaze outbox unchanged from the loyalty plan | Best-single vs stackable fixtures · expired-mid-cart notice · checkout grace · code enumeration constant-time · redeem twice → replayed, not doubled · sale items never discounted |
| 8 | **Anti-abuse + admin holds view** | S | Caps, strikes, cool-downs, `abuse_signal`, admin list with manual release (`holds:admin`) | Each cap has a table-driven test · refusals read as product copy · admin release audited · cool-down invisible to a clean identity |
| 9 | **Post-order swap unification** | L | Swap plan phases 1-3 (POS panel fixes, `orders_amend`, consent page) on the shared swap contract; pre-authorised substitution execution + reject window; `lorder.jsx` picker retired | One order + one kit into three entry points → identical candidates/money/record · consent link single use · price increase without customer tap refused · swap count cap |
| 10 | **Recovery programmes** | S | Saved-for-later, honest reorder, notify-me, abandoned-cart (behind `recovery.abandoned.enabled`) | No product words in SMS (lint on templates) · STOP mirrored · quiet hours · a reminder never extends a hold · notify sent once per 0→1 transition |
| 11 | **Scheduled/pickup pools + overnight integration** | M | `kit_loadable` and `store_on_hand` pools; scheduled reservations on the pick list; breakdown-count guard; rebuild-day gating; pickup mode (if approved) | Breakdown count refused while reserved units exist · kit close expires soft holds and fires review sheet · pick list lists reserved-for-order first · pickup no-show release |

Slices 0-4 are the minimum for the owner's hold requirement to be true in production. Slice 6 must
ship before real orders are taken online regardless of the order above.

---

## 10. Owner questions (eight; each written for a non-developer; more than one option may be picked)

**Q1. How long should an Express item stay held in a cart?**
- **A. 10 minutes after the last thing the customer does, never more than 25 minutes in total;
  5 minutes when it is the last one.** (Recommended.) *Pro:* long enough to finish a normal order,
  short enough that an abandoned cart frees the van quickly; matches the dispatch team's 10-minute
  default. *Con:* a slow shopper on a bad connection may see "no longer held" once and have to tap
  "Check again".
- **B. Start with A, and let the system shorten holds by itself when a zone is busy** (e.g. down to
  5/15 minutes at peak). *Pro:* the vans turn stock fastest exactly when it matters; no one has to
  watch a dial. *Con:* a rule that changes on its own is harder to explain to a customer who asks.
- **C. Shorter: 5 minutes, 15 total.** *Pro:* least stock parked in abandoned carts. *Con:* more
  "no longer held" moments for honest shoppers, more support contacts.
- **D. Longer: 15 minutes, 45 total.** *Pro:* nobody in a hurry ever loses an item. *Con:* on a busy
  night a popular item can be invisible to everyone else for most of an hour while one cart idles.

**Q2. When the last unit is in another customer's cart, what should a shopper see?**
- **A. "Arrives tomorrow" plus "Tell me if it frees up today"** — no mention of other carts.
  (Recommended.) *Pro:* always truthful, always gives a next step, never invites anyone to camp on a
  cart. *Con:* the shopper does not learn that a short wait might work.
- **B. Also say "In another customer's cart — it may free up in a few minutes."** *Pro:* honest and
  sometimes recovers the sale. *Con:* can feel like a queue; encourages refreshing; tells competitors
  how thin the kit is.
- **C. Show only "Only 1 left today" style badges (at 3 or fewer) and nothing about holds.**
  *Pro:* simplest. *Con:* the badge can say "1 left" while nobody can add it, which reads as broken.
- **D. Show exact counts everywhere.** *Pro:* maximum transparency. *Con:* exposes every driver's kit
  depth to anyone who wants to scrape it.

**Q3. Can someone who has not signed in hold items?**
- **A. Yes, with a shorter hold (5 minutes, 15 total) and at most two "last one" items; they must sign
  in to check out.** (Recommended.) *Pro:* browsing and building a cart stays frictionless; the
  scarce units are protected. *Con:* a guest who dawdles loses items sooner than a member would.
- **B. Yes, but only after verifying a phone number by text.** *Pro:* a real identity behind every
  hold, which is the strongest anti-hoarding control. *Con:* friction on the first visit; text
  delivery problems become cart problems.
- **C. No — sign in before adding an Express item.** *Pro:* one identity, one cart, always. *Con:*
  the highest drop-off point on any store is "create an account before you can even try".
- **D. Guests hold exactly like members.** *Pro:* nothing to explain. *Con:* many guest sessions from
  one device is the easiest way to hoard.

**Q4. What should the checkout ask about substitutions, and what is the default?**
- **A. Three choices — "Send the closest match, I'll never pay more" (default), "Contact me first",
  "Remove it and adjust my total" — with a per-item "don't substitute this one".** (Recommended.)
  *Pro:* most mis-stocks resolve with a notification, not a phone call; the customer stays in charge
  of the items they care about. *Con:* one more thing on the checkout screen.
- **B. Same three choices, default "Contact me first".** *Pro:* nobody ever receives something they
  did not explicitly pick. *Con:* every recovery needs a live conversation inside a 90-minute promise.
- **C. Ask per item only (no order-level default).** *Pro:* precise. *Con:* tedious on a five-item
  order; most people will not answer, which forces a default anyway.
- **D. Do not ask; support always calls.** *Pro:* nothing to build at checkout. *Con:* slowest
  recovery, and it contradicts the "smart" flow the owner asked for.

**Q5. The customer changes the delivery address after Express items are held and the new driver's
van does not carry some of them. What happens?**
- **A. Show a review sheet listing each affected item with "Move to Scheduled / Swap to Express /
  Remove", and keep the old holds for two minutes so "Undo" costs nothing.** (Recommended.) *Pro:*
  nothing disappears without a tap; the customer sees exactly what the new address changes. *Con:*
  briefly holds units on two vans.
- **B. A as the first step, and if the customer does not answer within the two minutes, move the
  affected items to Scheduled automatically.** *Pro:* the cart never sits half-resolved. *Con:* a
  customer who stepped away finds items quietly moved to tomorrow.
- **C. Move everything the new van lacks to Scheduled automatically and show a notice.** *Pro:*
  fastest. *Con:* silently turns a 40-minute order into a tomorrow order.
- **D. Do not allow the address to change while Express items are held; empty the Express lane
  first.** *Pro:* simplest to build. *Con:* punishes the common case of a typo in the address.

**Q6. Scheduled delivery windows: what widths and prices should the site offer?**
- **A. Launch with the 1-hour window at the standard fee only.** (Recommended for launch.) *Pro:*
  matches the settled rule; no pricing to explain; capacity math is simplest. *Con:* no upsell for
  customers who would pay for precision.
- **B. Add a "precise 30-minute" window for a small surcharge, shown only when dispatch reports
  slack (never at peak).** *Pro:* revenue from people who value certainty, without risking on-time.
  *Con:* customers may look for it at peak and not find it.
- **C. Add a "flexible 3-hour" window at a discount or free.** *Pro:* gives dispatch room and rewards
  patient customers. *Con:* a wide window can read as "we don't know when".
- **D. Price busy windows higher and quiet windows lower automatically.** *Pro:* smooths demand.
  *Con:* surge pricing is a reputational risk in a regulated retail business and hard to explain.

**Q7. Should we message people about carts they left behind?**
- **A. One text to opted-in, age-verified members after 30 minutes with no product names and a link
  to a gated page; one email at 20 hours if there was no click.** (Recommended.) *Pro:* recovers
  sales within carrier and cannabis-advertising rules; nothing in the text reveals what they shop
  for. *Con:* needs the consent records and templates to be exactly right.
- **B. Email only.** *Pro:* fewer carrier problems, richer message. *Con:* lower open rates; slower
  than a 90-minute Express decision.
- **C. On-site only (a "you left items" banner when they return), no outbound messages.** *Pro:* zero
  compliance exposure. *Con:* only reaches people who already came back.
- **D. A two-touch sequence with a small incentive on the second message.** *Pro:* highest recovery
  rate in most stores. *Con:* teaches customers to abandon carts to get a discount.

**Q8. Should in-store pickup be in the same cart as delivery?**
- **A. Pickup is a mode switch: the whole cart is either delivery or pickup, and switching shows the
  review sheet.** (Recommended.) *Pro:* one pool, one set of rules, one order; no "which half is
  where" confusion. *Con:* a customer cannot pick up one item and have the rest delivered in one
  checkout.
- **B. Allow mixed carts (delivery lanes plus a pickup lane, up to three orders).** *Pro:* maximum
  flexibility. *Con:* three orders, two locations, two ID checks; the hardest thing to explain on a
  receipt.
- **C. No online pickup in this phase.** *Pro:* nothing to build now. *Con:* pickup is the natural
  answer when an address is out of zone or the vans are full.
- **D. Offer pickup only for items delivery cannot promise** (out of zone, after Express close).
  *Pro:* solves the real gap without a full pickup programme. *Con:* a half-feature that customers
  discover by accident.

*Not asked again here because they belong to other plans:* who absorbs a price increase on a recovery
swap (swap plan Q2 — this plan assumes option A), whether recovery swaps always need support (swap
plan Q3), consent strength (swap plan Q4), server-side commit (swap plan Q5 — this plan assumes A),
and what the customer sees when a zone is over capacity (driver-assignment plan Q3).

---

## Appendix — files read (all read-only)

`POS-Admin`: `Hyperwolf Shop.html`, `Shop at Home.html`, `shop/{screen-cart,screen-checkout,
screen-shop,screen-home,data,chrome}.jsx`, `Swap and Upsell Engine.html`, `shared/commerce-engine.js`,
`shared/commerce-governance.js` (grep), `mobile/screen-task.jsx`, `pos/screen-orders.jsx` (grep),
`logistics/lorder.jsx` (grep), `contracts/index.js` (grep), `docs/SWAP-RECOVERY-FLOW-PLAN-2026-09-17.md`,
`docs/DRIVER-ASSIGNMENT-MODEL-2026-09-17.md`, `docs/ROUTING-ENGINE-PLAN-2026-09-17.md` (grep),
`docs/LOYALTY-INTEROP-PLAN-2026-09-17.md` (grep), `docs/promotions/BATCH-PROMOTIONS-PROPOSAL.md`,
`docs/DISCREPANCY-ATTRIBUTION-AND-SCOREBOARD-PLAN-2026-09-17.md` (grep),
`docs/HANDOFF-TO-CODEX-2026-09-17.md` §6. `wm-demo`: `wmdemo/order_lines.py`, `wmdemo/inventory.py`
(outline), `wmdemo/pos_sale_lines.py`, `wmdemo/catalog.py:100-116, 1483-1860`,
`wmdemo/realtime_channels.py` (grep), `docs/SALES.md`, `platform/modules/dispatch/{holds,kit-ledger,
staging,config}.ts`, `platform/modules/dispatch/README.md`.
