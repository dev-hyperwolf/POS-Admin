# Purchase Limits — Day Edge Cases (2026-09-17)

Companion to `PURCHASE-LIMITS-PLAN-2026-09-17.md` (the engine design). That plan already answers
"what is a day" at the policy level (Q1: calendar day, America/Los_Angeles) and "do returns/voids
give allowance back" (Q6: void yes, return no, swap re-checks). This document works every
concrete *when-does-it-count* scenario the owner asked for against that policy, so the engine's
`evaluate`/ledger design (§3.3-§3.4 there) has no ambiguous case left when it is built.

**Nothing here overrides §4.1 Q1-Q6 of the plan.** Where an edge case exposes a gap those six
questions didn't cover, it is called out and rolled into the three new questions at the end.

---

## 0. The anchoring rule (recommended)

> **A purchase counts against the legal day on which the goods physically change hands — the
> moment of handover/tender, not the moment the order is placed or paid for.** A Scheduled or
> Shop at Home order's line counts on its **delivery/appointment day**, not its order day. But
> nothing may be **placed** that would be over-limit *on the day it will be fulfilled*: every
> placement pre-checks against the anticipated fulfilment day, and that pre-check **provisionally
> reserves** the amount against that day so a second order for the same future day cannot also pass.
> Provisional reservations release automatically on cancellation, expiry, or a hold/cutoff timeout;
> they never silently disappear on their own.

This is one rule applied consistently, not two:

- **Register / Express / Pickup / Shop at Home in-visit:** placement and handover are the same
  moment (or within the driver's own possession window), so "count at handover" and "count at
  placement" coincide in practice. No special handling needed.
- **Scheduled delivery / Shop at Home appointment booked ahead:** placement and handover are
  different days. The pre-check happens on the **order's own placement day** against the
  **fulfilment day's** running total (including every other pending reservation for that day), and
  the reservation itself is keyed to the fulfilment day.

Confidence: **high** that "handover" is the legally correct moment for a completed sale (the
retailer "sells" — B&P/DCC's own delivery rules gate the actual point of no return on the §15404
door ID check and §15415(g) handover, not on when the request was taken, `PURCHASE-LIMITS-PLAN`
§1.6). Confidence **medium** on "provisional reservation at placement" — this is an operational
control the plan doesn't name explicitly (it says a Scheduled order's `legal_day = scheduled_date`
and is "re-evaluated at dispatch and at the door," `PURCHASE-LIMITS-PLAN` §3.4), so the specific
provisional-reservation-at-placement mechanic below is this document's addition, needed to close
the "two scheduled orders for the same future day" gap. **Mark for counsel**: whether "single day"
is measured at sale/tender or at some other statutory moment is itself one of the plan's §4.2 items
(item 3) — this document's anchoring choice is the operationally defensible default, not a settled
legal question.

---

## 1. State table — allowance effect at every transition

All rows assume the identity-day lock described in `PURCHASE-LIMITS-PLAN` §3.4
(`purchase_ledger` state machine: `reserved → committed → released/voided/returned`).

| Transition | Allowance effect | Which `legal_day` | Notes |
|---|---|---|---|
| **Cart hold** (add-to-cart, soft/checkout stage, `CART-AND-CHECKOUT-PLAN` §1.3) | None yet — a cart hold is inventory-only, not a purchase-limit reservation. The **cart meter** does a live, non-binding `evaluate` call so the customer sees headroom, but nothing is written to `purchase_ledger` until checkout reserves it. | n/a | Matches §3.4: "at checkout start (and at register 'start tender')" is when reservation begins, not add-to-cart. |
| **Placed** (checkout commits inside the order-placement transaction) | `reserved` row(s) written at checkout start, `committed` at placement, same transaction as the order write (`PURCHASE-LIMITS-PLAN` §3.4, `CART-AND-CHECKOUT-PLAN` §2.9). For Scheduled/Shop-at-Home, the row's `legal_day = anticipated fulfilment day`, not today. | Anticipated fulfilment day (today for Express/register/pickup same-day; the chosen date for Scheduled/appointment) | This is the provisional-allowance step: it counts against the fulfilment day's total immediately, before that day arrives. |
| **Staged** (order queued for a driver/kit, not yet released — `CART-AND-CHECKOUT-PLAN` §1.14 "no staging wait" for Express, or an overnight-built Scheduled kit) | No change — still `committed` under the placement-day reservation. | Unchanged | Staging is a dispatch-internal state; it has no compliance meaning by itself. |
| **Out for delivery** | No change to the ledger row. Re-evaluated (not re-committed) at departure and at the door (§3.4: "re-evaluated at dispatch and at the door") to catch a purchase made since placement. | Unchanged (still the day of departure/handover) | If re-evaluation finds the customer now over limit (e.g., they bought in-store since placing), the order is blocked at the door, not silently delivered — routes to `SWAP-RECOVERY-FLOW-PLAN` §2's flagging path. |
| **Delivered / Picked up / Register tender completed** | `committed` stays `committed` — this is the moment the reservation becomes a real, permanent sale. Nothing to release. | The day this actually happens (must equal the `legal_day` the reservation was keyed to; if it does not — e.g. a Scheduled delivery slips past midnight, §2.3 below — re-evaluate before handover) | This is "the count." |
| **Voided** (before the customer takes possession — order cancelled pre-dispatch, or the driver never hands it over, or register clears the ticket before tender) | Allowance **returns in full** (Q6 option 1: void = allowance back). Row → `voided`. | Same day it was reserved on | Matches §3.4 and §1.5: "a void plainly never was a sale." |
| **Returned** (after a completed sale — customer brings goods back) | Allowance does **not** return by default (Q6 default, `return_frees_allowance = false`). Row → `returned`, new row is *not* subtracted. | The day of the original sale (unaffected) | §1.5: goods cannot be resold anyway (§15410(c)); returning and re-buying the same day is exactly the loophole Q6 closes. Counsel item 7 (plan §4.2) flags this as legally unsettled — treat as **decided operationally, not legally certain**. |
| **Swapped, before handover** (kit swap at the door, or a pre-dispatch cart edit) | Outgoing line **released** (its allowance returns); incoming line evaluated against the **full day including everything else still committed** (not just what's left after releasing the outgoing line). Both happen in one atomic operation (`CART-AND-CHECKOUT-PLAN` §4.7 `swap_line`/`commit_amendment`). | Same day as the order being swapped | A swap can legitimately be blocked if the replacement item does not fit even after the original releases — e.g., swapping a 3.5g eighth for an 8g concentrate cartridge on a day already near the concentrate cap. |
| **Swapped, after handover** (the customer already has the goods; this is a correction, not a recovery) | Treated as a return-then-new-sale: original allowance does not return (same as Returned row above); the "new" item is a fresh sale evaluated against the day. In practice this should be rare/manual and always compliance-reviewed. | Same day | Not explicitly covered by the plan's §3.4 swap language, which assumes pre-handover. **New edge case, flagged in §2.9 below.** |
| **Driver-to-driver transfer** (kit rebalance; the *customer's basket does not change*) | No allowance effect by itself. But the transfer **must re-run `evaluate`** (the customer may have bought elsewhere since placement) and, if the new driver's ETA rolls the delivery into the next calendar day, **re-reserve under the new day** — releasing the old day's provisional hold and creating a new one on the new day. | Re-keyed to the new handover day if it changed | §3.4: "the transfer must re-run `evaluate`... and re-reserve under the new ETA's `legal_day` if the day rolls." |
| **Cart held across midnight, never converted to an order** | No ledger effect at all — cart holds are inventory-only (see Placed row above). The cart's *price/promo/limits meter* simply re-evaluates fresh on the new calendar day next time it's touched; any "already bought today" facts shown reset to the new day's ledger. | n/a | See §2.5 below for the customer-facing behavior. |
| **Reservation expires / checkout abandoned** | Allowance **returns** — same mechanism as a void; the TTL sweeper (`CART-AND-CHECKOUT-PLAN` §1.10) and the purchase-limit reservation should expire together (`purchase_ledger.reserved_until` should equal the checkout hold TTL, per §3.4: "reserved with a TTL equal to the cart hold TTL"). | n/a | Prevents "hold two checkouts open, double-spend" per §3.4's own stated attack. |
| **Identity merge** (guest → member, or two records found to be the same person) creates an over-limit day | Not auto-corrected. Raises a `limits.exception` / daily-exceptions report row (§3.8). A human (`compliance` role) resolves it — the design explicitly forbids any auto-release here. | The day the merge revealed | §3.4: "a merge that produces an over-limit day raises an exception report, it does not silently pass." |

---

## 2. Edge cases

Each case: scenario → legal reading (moment counted, confidence) → recommended system rule →
customer message → what register/driver/admin shows → an adversarial test.

### 2.1 Order placed today for Scheduled delivery tomorrow

**Scenario:** Customer places a Scheduled order at 20:00 on Sept 17 for a delivery window on
Sept 18.

**Legal reading:** The statute prohibits a retailer selling more than X "to a single customer in a
single day" (§15409(a),(b)) — the sale is the transfer of goods for consideration, which for a
regulated cannabis retailer transaction is most defensibly read as completed at **handover**
(matches the delivery-specific record-keeping scheme, which centers on the door ID check and
delivery-receipt completion, `PURCHASE-LIMITS-PLAN` §1.6, 4 CCR §15420(b)). Confidence: **medium-high**
for "counts on delivery day," because no DCC guidance says so explicitly (this is the same
unsettled ground as counsel item 3 in the plan). Mark for counsel.

**Recommended system rule:** The order's `purchase_ledger` row is written at placement (Sept 17)
but with `legal_day = 2026-09-18`. It counts against Sept 18's running total from the moment of
placement (provisional allowance), and is finally committed as a real sale when delivered on the
18th.

**Customer message:** At checkout, if the item would put Sept 18 over the limit: *"That would put
tomorrow's delivery over the legal daily limit — you can add up to 3.5 g more for that date."* If
fine: no message, just the normal per-bucket meter, labeled with the delivery date when it differs
from today ("Flower 14 g of 28.5 g for Sept 18 delivery").

**Register/driver/admin:** Admin order view shows the reservation's `legal_day` distinctly from
`placed_at`. Driver app's door check shows "Limits OK — checked [time]" using a **fresh**
`evaluate` at the door (re-run, not the placement-time snapshot), since the customer may have
bought more between placement and delivery.

**Adversarial test:** Customer places Scheduled order for 28 g flower, delivery Sept 18, at 20:00
Sept 17 → passes (Sept 18 has 0 g committed). Same customer walks into a store and buys 5 g flower
at 09:00 Sept 18. Door check at 14:00 Sept 18 re-evaluates: 28 + 5 = 33 g > 28.5 g → **block at the
door**, route to `SWAP-RECOVERY-FLOW-PLAN` §2, offer the largest subset that fits (23.5 g).

---

### 2.2 Order placed tonight for pickup tomorrow

**Scenario:** Customer places a Pickup order at 23:30 Sept 17, ready-by 10:00 Sept 18.

**Legal reading:** Same as §2.1 — pickup handover is a walk-in transfer, counted on the pickup day.
Confidence: **high** (pickup handover is unambiguously the moment of sale; there is no delivery
door-check ambiguity here at all).

**Recommended system rule:** Identical mechanism to Scheduled — `legal_day` = the anticipated
pickup day, provisional reservation at placement, re-evaluated at the counter when the customer
actually shows up (a walk-in "door check" equivalent). `CART-AND-CHECKOUT-PLAN` §3.5's
`pickup.noShowReleaseHours` auto-cancel-and-release already exists for inventory; extend it to
release the purchase-limit reservation identically.

**Customer message:** Same pattern as §2.1, dated to the pickup day.

**Register/driver/admin:** Register (check-in card, per `PURCHASE-LIMITS-PLAN` §3.7) shows the
meter as of *today* when the customer actually arrives, re-evaluated fresh, not the placement-time
number.

**Adversarial test:** Customer places two Pickup orders for the same Sept 18 ready time, 8 g
concentrate each, from two different sessions 10 seconds apart. The identity-day row lock (§3.4,
`SELECT … FOR UPDATE` on `(identity_id, legal_day)`) serializes them: first commits at 8 g, second
re-evaluates against 8 g already reserved and blocks at 8 g (limit reached, `== limit` passes,
second `+8` would be `16 > 8` → blocks the whole second order, or the specific over-limit line).

---

### 2.3 Express order near midnight

**Scenario:** Customer places an Express order at 23:52 on Sept 17; quoted ETA is 35-50 minutes,
meaning delivery could complete before or after midnight.

**Legal reading:** Handover moment governs (§0). If handover happens at 23:59, it's Sept 17's day;
if at 00:03, it's Sept 18's. Confidence: **high** that the actual clock-on-the-wall handover time
governs — this is the plain reading of "in a single day," and it is exactly the scenario the plan's
own test battery names ("23:59:30 order committed on day D, 00:00:30 new order on D+1 passes,"
§3.11).

**Recommended system rule:** Express is placed with `legal_day` = today (Sept 17) as the
provisional reservation, because that's the anticipated handover day. **Re-evaluate at the door**
(§3.4, §3.7's driver-app requirement) using the *actual* wall-clock time of handover. If the
door-check crosses midnight, recompute `legal_day` for that specific order to Sept 18 and
re-evaluate against Sept 18's ledger before completing handover — the same re-key-on-roll logic
already specified for driver-to-driver transfer (§3.4).

**Customer message:** No special message unless the recompute fails — then it becomes the same
"Limits OK" / "Do not hand over" driver-app pattern as any other door-check failure
(`PURCHASE-LIMITS-PLAN` §3.7).

**Register/driver/admin:** Driver app's "Limits OK — checked 00:03" line implicitly shows the
correct day was used because the check timestamp is visible. No new UI needed — this is a
consequence of always re-checking at the door with real wall-clock time, not of the meter itself.

**Adversarial test:** Customer buys 25 g flower via register at 22:00 Sept 17 (Long Beach). Same
customer's Express order (5 g flower) placed 23:50 Sept 17 is quoted for delivery ~00:10 Sept 18.
At placement, evaluated against Sept 17 (25+5=30 > 28.5) → **blocked at placement** already (correct
— it would fail regardless of which day it lands on, since Sept 17 is already over). Second test:
same order but only 2 g flower (25+2=27, passes Sept 17). Door-check at 00:10 Sept 18 recomputes
against Sept 18 (0 g so far) → passes independent of the Sept 17 number. Third test: if handover
actually happens at 23:58 Sept 17 (early), door-check uses Sept 17 and must catch the 25+2=27 case
correctly (still passes, correctly, since 27 ≤ 28.5).

---

### 2.4 Shop at Home appointment booked days ahead with a $100 deposit

**Scenario:** Customer books a Shop at Home visit 4 days out (booking window is "same-day + 3
days" per `SHOP-AT-HOME-PLAN` §2.2, so "days ahead" here means up to 3 days), pays a $100
authorization-only deposit at booking. The actual cart is built live by the genius during the
visit — nothing is known about SKUs or quantities at booking time.

**Legal reading:** The deposit is not a cannabis sale (no cannabis changes hands or is even
selected at booking) — it is a service-appointment hold. The purchase-limit question only exists
once the genius starts adding real product during the visit. Confidence: **high** — this is not
actually ambiguous; SHOP-AT-HOME-PLAN §2.3 already treats the deposit as a pure payment-ledger
entry, separate from the sale.

**Recommended system rule:** No purchase-limit reservation exists at booking (there's no basket
yet). At the moment the genius begins adding items on-site (`SHOP-AT-HOME-PLAN` §2.4: "reserve a
generic kit allotment... then convert specific line reservations to holds as the genius actually
adds items"), the **same evaluate/reserve mechanism the storefront cart uses** fires per line
add, live, against the **visit day's** ledger (today, since the visit is happening now). The sale
is recorded through `pos_sale_lines` at settlement (§2.5 there), same path as every other channel,
so it inherits the same commit-time enforcement automatically — no separate Shop-at-Home limits
logic to build.

**Customer message:** Same per-bucket meter shown to the genius's tablet/app during the visit, in
real time, exactly as the storefront cart shows it — "Flower 20 g of 28.5 g" as items are added
live.

**Register/driver/admin:** The genius's device is the "register" here — same blocker/meter
integration as `pos/data.jsx` (§3.7). If the visit customer already bought elsewhere today (web
order delivered that morning, say), the meter reflects that ledger immediately when the visit
starts.

**Adversarial test:** Customer receives an Express delivery of 20 g flower at 10:00, then has a
Shop at Home visit at 15:00 the same day where the genius tries to add 10 g flower. Live meter at
the visit shows 20 g already used, 8.5 g remaining, and refuses the full 10 g add, suggesting 8.5 g
max — exactly the standard `suggestions[]` behavior (§3.3), no new code path.

---

### 2.5 Cart held across midnight (no order placed)

**Scenario:** Customer builds a web cart with 25 g flower at 23:00, walks away, comes back at
01:00 the next calendar day, and completes checkout.

**Legal reading:** No sale exists yet — a cart hold is not a purchase. Confidence: **high**, not
contested.

**Recommended system rule:** No purchase-limit reservation is created by the hold itself (§1 state
table). When checkout is (re-)started at 01:00, the reservation is created fresh against the
**new** calendar day's ledger — today's date at that moment, i.e., Sept 18 not Sept 17. The
inventory hold (§CART-AND-CHECKOUT-PLAN §1.4 TTLs) is a completely separate lifecycle and may or
may not still be alive; if it lapsed, that's a stock question, not a compliance one.

**Customer message:** No special "day changed" message is needed for the limits meter — it simply
reflects the fresh day's totals when checkout starts, same as any other page load. (The *inventory*
side may show a "your cart was held for you" message per `CART-AND-CHECKOUT-PLAN` §1.5, unrelated.)

**Register/driver/admin:** N/A — no ledger row exists to show anywhere until checkout is (re)started.

**Adversarial test:** Customer buys 20 g flower in-store at 22:00 Sept 17, then resumes an
overnight web cart with 15 g flower and checks out at 00:30 Sept 18. Evaluated against Sept 18 (0 g
so far) → passes at 15 g, correctly ignoring the prior evening's Sept 17 purchase.

---

### 2.6 Voids and returns

Covered fully in the state table (§1) and Q6 of the plan. Two adversarial tests specific to the
"day" dimension not already in the plan's §3.11 battery:

**Test A (void spans midnight):** Order placed 23:50 Sept 17 for 28 g flower (passes, Sept 17 at
0 g before this). Customer calls to cancel at 00:15 Sept 18, before dispatch. Void releases the
reservation — but **against which day**? Answer: the day it was reserved against (Sept 17, per the
state table), not the day the void itself is processed. The customer's Sept 17 allowance is fully
restored; this has no effect on Sept 18 (the order was never keyed to Sept 18 to begin with, since
it was an immediate register/Express-style commit, not Scheduled).

**Test B (return spans midnight):** Customer buys 28 g flower at 20:00 Sept 17 (register), returns
the sealed package at 00:30 Sept 18 (different calendar day, different `legal_day`). Per Q6
default, `return_frees_allowance = false` — the **Sept 17** row is marked `returned`, but nothing
changes about Sept 17's total (it stays "used" for record purposes; the point of Q6 is precisely
that the original day's allowance is not un-spent). It has zero effect on Sept 18's fresh ledger
either way, since Sept 18 never had that purchase on it. **No new rule needed** — returns are
day-agnostic once Q6 is decided; the only trap is making sure a naive implementation doesn't credit
the return to *today's* (the return day's) allowance instead of correctly doing nothing.

---

### 2.7 Multiple stores and channels

**Scenario:** Same customer buys at West Hollywood (register) and orders delivery from Long Beach
(web) on the same calendar day.

**Legal reading:** Per plan §1.5/§4.1 Q2 (recommended: aggregate across every Hyperwolf licence,
store, and channel for one person) — this is the conservative, defensible reading given DCC's own
cross-licence Metrc visibility. Confidence: **medium** per the plan itself (flagged for counsel,
item 3: "whether purchases across our own licences must be aggregated or merely may be").

**Recommended system rule:** No change from the plan — `identity_id` is global across
`store_id`/`channel`/`licence_id` in the ledger schema (§3.4), so the day total is already
naturally company-wide once identity resolution works. This document adds nothing new here except
to confirm: the **day boundary itself does not vary by store** even though stores may be in
different cities — all Hyperwolf licences are in America/Los_Angeles, so there is no multi-timezone
aggregation problem today. If Hyperwolf ever opens outside Pacific time, this becomes a real
question (which store's midnight?) — not needed now, flagged for future-proofing only.

**Customer message:** "You bought 7 g of flower earlier today at Long Beach; 21.5 g remains" —
exactly as specified in §3.7, already correct for the multi-store case.

**Register/driver/admin:** No change needed.

**Adversarial test:** Already in the plan's §3.11 battery ("two stores; two channels").

---

### 2.8 Time zones — servers in UTC, stores in America/Los_Angeles, DST

**Legal reading:** Not a legal question — a pure implementation-correctness question. The
"single day" the law means is unambiguously the day as experienced by the person and the store,
i.e., **local wall-clock time**, never UTC. Confidence: **high**.

**The concrete bug this estate already has, twice, in the exact shape that would break this
feature:**

1. **`wmdemo/pos_sale_lines.py:114-115`** stamps every sale line's `created_at` using
   `time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())` — i.e., **UTC**, with a trailing `Z` that
   correctly labels it as UTC. This is fine *as a storage format* (an unambiguous instant), but it
   is **not** a legal day by itself — converting it to a legal day requires a timezone conversion
   step that does not yet exist anywhere in this file.
2. **`wmdemo/incentives/ledger.py:210-228`** already solved this correctly for a different feature
   (incentive tracking): `local_parts(store_id, sold_at_iso)` parses the stored UTC-ish
   timestamp, calls `.astimezone(_zone(store_id))` (a real IANA zone lookup, DST-aware), and
   derives `(local_day, local_hour)` **once, at ingest**, storing them as columns rather than
   recomputing from raw UTC at every read (module docstring, line 35: *"`local_day`/`local_hour`
   come from the store's zone at ingest, never at read... A stored local_day cannot drift"*). Line
   96's comment is explicit about the exact mistake to avoid: *"Raised rather than silently falling
   back to UTC. A UTC `local_day` looks [valid but wrong]."*
3. **`qa/reports_probe.py`** has the mirror-image bug **as a live test flake**, not yet fixed: lines
   297, 316, 338, 723-724 and 765 all compute "today"/"yesterday" test fixture dates using
   `datetime.datetime.utcnow()`, then compare those UTC-derived day strings against report rows that
   are bucketed by **store-local** `local_day` (via `ledger.py`'s correct logic above). Any test run
   between **00:00 and 07:00/08:00 UTC** (i.e., roughly **16:00-24:00 the previous day in Pacific
   time**, the exact window shifts with DST) has the test's notion of "today" one calendar day ahead
   of the store's actual local "today," making assertions like RP-17 through RP-20 ("corona day1: …",
   "corona day2 tender: …") and RP-58 ("csv data rows (header+2 days)") **fail non-deterministically
   depending on what time of day the suite happens to run** — not because the report logic is wrong,
   but because the *test's own fixture dates* are computed in the wrong timezone.

**The fix to describe (for `reports_probe.py`, and as the template for the purchase-limits
ledger):** replace every `datetime.datetime.utcnow()` used to derive a **day label** for
fixtures/assertions with the same `ledger.local_parts`-style conversion — resolve "today" as
`datetime.now(zone).strftime("%Y-%m-%d")` where `zone` is the store's real IANA zone
(`America/Los_Angeles`), not the host machine's or UTC's "now." **This is the exact same fix the
purchase-limits engine must build in from day one**, not retrofit later: `legal_day` must be
derived by converting a stored instant into the store's zone (using the zone database, which
handles DST transitions automatically — never a fixed `-07:00`/`-08:00` offset, which is wrong half
the year), computed **once at reservation/commit time** and stored, exactly as `ledger.py` already
does for incentives. `PURCHASE-LIMITS-PLAN` §3.4 already specifies this correctly ("computed from
the store-local wall clock, never from UTC arithmetic") — this section's contribution is naming the
two real precedents (one correct, one currently flaky) already in the codebase to build from and to
fix, per CLAUDE.md's own §4.7 ("watch the output, not just the exception" — a silently-wrong day
label produces no error, only an occasionally-failing, hard-to-reproduce test).

**Recommended system rule:** `purchase_ledger.legal_day` is computed exactly like
`ledger.local_parts`: parse the UTC instant, `.astimezone(zoneinfo.ZoneInfo("America/Los_Angeles"))`,
take the date. Computed once, at reservation time, stored as a column, never recomputed from a
"now()" call anywhere else in the code (report queries, admin views, etc. all read the stored value).

**Customer message:** N/a — invisible when correct.

**Register/driver/admin:** N/A.

**Adversarial test:** Server host clock in UTC reads `2026-09-18T06:30:00Z` (this is `2026-09-17
23:30:00-07:00` Pacific during PDT, or `2026-09-17 22:30:00-08:00` during PST). A sale committed at
this instant must be stamped `legal_day = 2026-09-17`, not `2026-09-18`. A naive
`utcnow().strftime("%Y-%m-%d")` would wrongly say `2026-09-18` — this exact off-by-one is the
`reports_probe.py` flake above, reproduced deliberately as a unit test for the limits ledger.

---

### 2.9 DST transitions

**2026-11-01 fall back (25-hour day, PDT → PST at 02:00 → 01:00):** America/Los_Angeles clocks
repeat the 01:00-01:59 hour. A purchase at "01:30 AM" is ambiguous without an offset — it happened
either at 01:30 PDT (first occurrence, UTC 08:30) or 01:30 PST (second occurrence, UTC 09:30).
**Recommended rule:** never store or compare local wall-clock time without its offset; always
derive `legal_day` from the **UTC instant** converted through the zone database (which resolves the
ambiguity correctly using the DST transition rules), never from a bare local-time string. Since the
whole calendar day (Nov 1) is still exactly one `legal_day` value regardless of it containing 25
hours, **no special-case code is needed for the limit itself** — a customer who buys at both
occurrences of 01:30 AM on Nov 1 is still buying twice on the same `legal_day`, correctly. The 25th
hour does not create a 25th hour of allowance.

**2026-03-08 spring forward (23-hour day, PST → PDT at 02:00 → 03:00):** The 02:00-02:59 hour does
not exist. No purchase can occur "at 02:30 AM" that day — inconsequential for the limit itself, but
relevant for **the nightly Metrc submit job and any cron scheduled at a literal 02:xx local time**
(§2.10 below) — a job scheduled for "02:15 local" simply does not fire that night unless the
scheduler is DST-aware. **Recommended rule:** schedule the nightly Metrc job (and any other
legal-day-rollover job) by a UTC-equivalent computed fresh each day from the zone database, not a
fixed local cron string, so it survives both transitions without a special case.

**Adversarial test:** Two orders at Sept-equivalent "local 01:30" on 2026-11-01, one during each
UTC-distinct occurrence of that wall-clock hour — both must land on `legal_day = 2026-11-01` and
sum together (test the ambiguous-local-time parsing explicitly, since a bug here would either
double-count or silently drop one of the two purchases from the ledger day it belongs to).

---

### 2.10 Metrc nightly window vs. the legal day boundary

**Legal reading:** Metrc's `SalesDateTime` must be the facility's **naive local wall-clock time,
with no UTC conversion or explicit offset** (`METRC-API-CONDUCT.md` "SalesDateTime rule", §3) — the
exact same local-time-not-UTC discipline as §2.8 above, for a different reason (Metrc's own field
format, not our own day-boundary logic). Confidence: **high**, this is Metrc's documented behavior,
corroborated by the program plan's own finding that a sibling function in the same Stilo file
correctly pinned `America/Los_Angeles` while `createSales` did not.

**Which local day does a 12:01 AM sale belong to, and does the nightly job run before or after
that boundary?** A sale that completes at 00:01 local time belongs to the **new** calendar day that
just started (Sept 18, not Sept 17) — same handover-moment rule as everywhere else in this
document. The nightly Metrc submit job (per `METRC-API-CONDUCT.md` §5-§6) runs **after** a store's
close, batching that store's day's receipts — it must run **strictly after local midnight** (i.e.,
after the legal day it is submitting has fully closed) to guarantee it has seen every sale up to and
including 23:59:59 of that day, and it must **key its query by the same stored `legal_day` column**
the purchase-limits ledger uses (§3.9 of the plan: "one table family keyed by `order_id, line_no`"),
never by a UTC date range, or it will pick up or drop sales exactly at the midnight edge depending
on server clock skew.

**Recommended system rule:** The nightly job's own "which day am I submitting" input is the
**completed** `legal_day` value (yesterday's date in store-local terms, computed the same
DST-aware way as §2.8), not "the last 24 hours" and not "today's UTC date." A 00:01 AM sale is
correctly excluded from *that night's* batch (it belongs to the day that just started, which hasn't
closed yet) and picked up the *following* night.

**Customer message:** N/A (backend-only).

**Register/driver/admin:** The Metrc pre-flight exception check (§3.9 of the plan: "no receipt in
tonight's batch belongs to an identity-day that is over limit") should display, in the admin
reconciliation report, the `legal_day` each receipt was keyed to alongside the wall-clock
`SalesDateTime` sent to Metrc — so an auditor can see they match.

**Adversarial test:** A sale at 23:58:00 local on Sept 17 and a sale at 00:02:00 local on Sept 18
(4 minutes apart in real time) must produce two different `SalesDateTime` values (`2026-09-17
23:58:00` and `2026-09-18 00:02:00`, both naive-local, no offset) and be submitted in **two
different nightly batches** — the first in the batch that runs after Sept 17 closes, the second the
following night. If the nightly job instead groups by "orders from the last 24 hours run before
each batch," these two would incorrectly land in the same batch.

---

### 2.11 Identity: guest + member, phone vs. ID number, expiring medical mid-day

**Guest then member, same day:** Per `PURCHASE-LIMITS-PLAN` §3.5, a guest who logs in mid-checkout
merges into the resolved identity and **re-evaluates**; per `CART-AND-CHECKOUT-PLAN` §1.6, cart
merge takes the **larger** quantity per line, never sums. **Recommended rule (unchanged from the
plan):** the merge is same-day only in effect if it happens on the same calendar day; if a guest
purchase happened yesterday and today they log in as a member, yesterday's guest purchase (now
correctly attributed to the merged identity) has zero effect on today's fresh ledger — merges only
matter for the day(s) on which both identities transacted.

**Phone vs. ID number resolution collision:** Plan §3.5's resolution order (`member_id` →
`gov_id_hash` → `phone_e164` → `name_dob_fp`) already handles "same phone, two names" and "same ID,
two phones" as evasion test cases. No new day-specific behavior — the day boundary is orthogonal to
identity resolution; once identity is resolved (correctly or not, pending investigation), the
`legal_day` computation is identical.

**Medical recommendation expiring mid-day:** **Legal reading:** the recommendation's expiry
(`expires_on`) is a **date**, not a timestamp — DCC verification records do not (to our knowledge)
carry an intraday expiry time. Confidence: **medium** — flagged as an assumption, not verified
against a specific recommendation-format requirement (counsel item 6 in the plan touches
recommendation content requirements generally). **Recommended system rule:** per plan §3.6, "the
engine treats `expires_on < legal_day` as adult-use" — i.e., the **entire** `legal_day` the
recommendation expires on is still treated as verified-medical (expiry takes effect the *next* day),
which is the more permissive and more defensible reading absent a specific intraday cutoff. A
Scheduled order for a date *after* `expires_on` is blocked at reservation time regardless of when
during that day the recommendation technically lapsed.

**Adversarial test:** Patient's recommendation `expires_on = 2026-09-17`. A register sale at 23:55
Sept 17 uses the medical (226,796 mg) limit and passes at 30 g. A Scheduled order placed Sept 16 for
delivery Sept 18 is evaluated against the **adult-use** limit (28,500 mg) at placement, since
Sept 18 > `expires_on`, and blocks or warns if it exceeds 28.5 g — even though the recommendation
was still technically valid on the day the order was placed.

---

### 2.12 Register: customer walks in at 11:58 PM, sale completes 12:01 AM

**Legal reading:** Handover/tender moment governs (§0) — the sale legally happens at 00:01, the
new calendar day, regardless of when the customer walked in or when the basket was built at the
register. Confidence: **high** — a register sale's "moment of sale" is unambiguously the tender
completion, and this is explicitly one of the plan's own §3.11 battery cases ("23:59:30 order
committed on day D, 00:00:30 new order on D+1 passes... calendar policy").

**Recommended system rule:** The register's `evaluate`/reservation happens at "start tender"
(§3.4) using the wall-clock time *at that moment*, computed store-local. If the budtender starts
building the ticket at 23:58 but doesn't tender until 00:01, the reservation should be created (or
re-evaluated) at **tender**, not at ticket-open, using the then-current local day. This mirrors
`wmdemo`'s own sale-recording discipline (`SALES.md` "Ordering and atomicity": the entire sale is
one atomic transaction, committed at the point `record_for_sale` runs) — the transaction's own
commit instant is what should stamp `legal_day`, computed via the §2.8 fix, not a ticket-open
timestamp captured earlier.

**Customer message:** None needed if it doesn't change the outcome. If it does (e.g., customer was
under the limit for Sept 17 at 23:58 when the budtender rang it up but the till doesn't finalize
until 00:03 and the customer separately bought online at 23:59) — a rare, sub-second-precision
race — the register shows the same disabled-tender blocker as any other over-limit case
(`PURCHASE-LIMITS-PLAN` §3.7), re-evaluated fresh at tender.

**Register/driver/admin:** No new UI — this is the existing tender-time blocker, correctly timed.

**Adversarial test:** Budtender opens ticket at 23:58, adds 28 g flower (passes against Sept 17,
currently 0 g). Customer's own separate web order for 5 g flower, placed at 23:59, is delivered
same-day (Express) and reserves against Sept 17 first (reservation created at placement, 23:59).
Budtender finally tenders the register ticket at 00:02 Sept 18. Because tender happens after
midnight, the register re-evaluates against **Sept 18** (0 g so far, the 23:59 web reservation was
Sept 17's), and the register sale of 28 g **passes** on Sept 18 — correct, even though a naive
"ticket-open-time" stamp would have wrongly compared it against Sept 17's 5 g already reserved.

---

## 3. New owner questions

Everything else above is decided; these three genuinely need the owner's call.

**NQ1. How long does a Scheduled/Shop-at-Home provisional reservation hold a future day's
allowance before it expires if the order stalls (never cancelled, never delivered — e.g., a stuck
dispatch)?**
1. **Same as the order's own cutoff/cancellation window** — if the order itself would auto-cancel
   (no-show, stale dispatch) per the relevant plan's existing timeout, the provisional allowance
   releases at that same moment, no separate timer. Pros: one clock to reason about, reuses
   machinery that already exists. Cons: if that timeout is generous (e.g., end-of-business-day for
   pickup no-shows), a stuck reservation can block a same-day re-order for hours.
2. A fixed, shorter timer (e.g., 2 hours past the promised window) independent of the order's own
   lifecycle. Pros: frees a customer's own future-day allowance sooner if the order clearly stalled.
   Cons: a second timer to keep in sync with dispatch state; risk of releasing allowance for an
   order that is actually still going to deliver late.
3. Never auto-release — only a manual `compliance`-role action clears a stalled provisional
   reservation. Pros: safest against double-counting. Cons: a stuck dispatch order becomes a support
   ticket just to let the customer re-order.
4. No provisional reservation at all for future-dated orders — only check at placement, don't hold
   the allowance until fulfilment day. Pros: simplest. Cons: reopens exactly the "two Scheduled
   orders for the same day both pass" gap this document's anchoring rule (§0) was written to close.

**NQ2. Does a same-day return ever re-open allowance, even with a manager's sign-off — i.e., should
Q6's "no" have any escape hatch at all?**
1. **No escape hatch — Q6's "returns don't return allowance" is absolute, with no override
   permission,** consistent with the plan's own §3.6 principle ("no override above the law... a
   manager cannot approve an over-limit sale"). Pros: no new audit-exposure surface; matches the
   plan's stated design philosophy exactly. Cons: a legitimately defective/wrong-item return (not
   the customer's fault) still burns their day's allowance for a purchase they now don't even have.
2. A defect-return exception only (item was wrong, damaged, or recalled — never a change-of-mind
   return), gated by a `compliance`-role reason, audited. Pros: fixes the "not the customer's fault"
   case. Cons: is exactly the override mechanism the plan's §3.6/Q6-option-4 both explicitly reject
   as "the very override the design forbids."
3. Treat a defect return as a **void**, not a return, if caught before the customer leaves the
   counter/door (same day, same visit) — no new rule, just correct classification. Pros: uses the
   existing void path, no override needed, matches "goods never really left the customer's
   possession as a completed purchase" logic already in §1.5. Cons: doesn't help a defect discovered
   after the customer gets home.
4. Leave exactly as decided in Q6 (no escape hatch, no reclassification guidance) and treat every
   defect-return-same-day complaint as a manual customer-service gesture (comp/discount on a future
   purchase) rather than a compliance mechanism. Pros: zero new engine logic. Cons: no clean answer
   for support staff fielding the complaint today.

**NQ3. For a Shop-at-Home visit that runs past midnight (a long appointment starting Sept 17
evening, sale settled after 00:00 Sept 18), which day's allowance applies to items added before
midnight vs. after?**
1. **Split by the same handover-moment rule as everything else: each line item's `legal_day` is
   whichever calendar day it was actually added/reserved during the live visit**, so items added
   at 23:50 count against Sept 17 and items added at 00:10 count against Sept 18, evaluated
   independently — the meter would show two separate day totals mid-visit if this happens. Pros:
   fully consistent with §0's anchoring rule; no special case. Cons: a genius mid-visit seeing the
   meter "reset" at midnight could be confusing without a clear UI cue, and the *single* sale
   (§2.5/§2.5's `pos_sale_lines` write) would need to carry two different `legal_day` values across
   its own lines — a shape the ledger schema (one `legal_day` per line, per §3.4) already supports,
   but no other flow currently produces a single order spanning two legal days.
2. The whole visit's sale is stamped with a single `legal_day` — whichever day the visit **started**
   on. Pros: one day per order, matching every other flow's assumption of "one order, one day."
   Cons: lets a visit deliberately timed to straddle midnight effectively get two days' worth of
   allowance charged to one day, or conversely blocks a legitimate second-day purchase that should
   be allowed.
3. The whole visit's sale is stamped with the day it **settles/finalizes** (when the genius closes
   out and charges the deposit + balance). Pros: also one day per order, matches "when the sale
   completes" language used elsewhere in this document. Cons: a visit that starts at 20:00 and adds
   26 g of flower, then runs long and settles at 00:15, would count the entire 26 g against the new
   day even though almost all of it was physically handed over the evening before.
4. Cap Shop-at-Home visit duration so this can never happen (e.g., hard-stop bookings so no visit
   can plausibly cross midnight) and treat it as an operational scheduling constraint rather than a
   ledger design question. Pros: makes the question moot. Cons: real visits sometimes run long for
   ordinary reasons (traffic, a chatty customer); an artificial hard-stop could cut off ordering
   mid-visit for a wholly non-compliance reason.
