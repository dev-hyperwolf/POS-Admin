# Rewards redemption — UX/UI audit and recommendation

**Scope:** owner decision — loyalty rewards (today Alpine IQ; our own ledger takes over per
`docs/LOYALTY-INTEROP-PLAN-2026-09-17.md` D15) shown as **tap buttons** in the register when
available, redeemed by tap, never typed. Over-redemption must be **impossible**: every redemption
validated live against the authoritative ledger before the discount applies; no offline path.
Same rewards redeemable on e-commerce.

**Audit method:** read-only. `pos/screen-register.jsx` is FROZEN — audit only, never edited.
Nothing else in the estate was modified. No git writes.

---

## 1. What exists today, cited file:line

### The real backend already exists — and it is good

`wm-demo/wmdemo/engage/rewards.py` + `engage/ledger.py` is a genuine ledger-backed redemption
engine, already built to the spec this audit was asked to evaluate:

- `usable(customer_id, store_id, channel)` (`rewards.py:146-177`) — a pure read returning exactly
  the rewards a customer can use *right now*: active program+reward, right channel, right store,
  affordable against `ledger.balance()`, in stock, under `per_customer_cap` within `window_days`,
  and eligible per `eligibility_rule_json`.
- `redeem(reward_id, customer_id, store_id, channel, order_ref, actor, idempotency_key)`
  (`rewards.py:203-311`) — one atomic transaction (`_dbshare.reuse_connection(atomic=True)`)
  composing stock decrement, `ledger.redeem()` (balance check + ledger row + wallet delta), and a
  `loy_redemptions` insert with a **server-minted redemption code**. Idempotency key is
  customer-scoped (`_scoped_key`, `rewards.py:184-200`) so a retried tap returns the same
  redemption, never a second debit. Every refusal is a specific 4xx code (`reward_inactive`,
  `reward_not_usable_here`, `cap_reached`, `not_eligible`, `out_of_stock`), not a bare 400.
- `refund(redemption_id, actor, idempotency_key)` (`rewards.py:314-343`) — atomic reversal,
  restores stock, marks the ledger reversed, idempotent double-click safe.
- `ledger.py` (`_insert_ledger_row`/`_apply_wallet_delta`, doc comment lines 12-41) — one insert
  helper, one wallet-cache adjustment, both inside the same lock/transaction; balance is checked
  **before** insert for a genuinely new redeem, but a replayed idempotency key is never
  re-checked against a post-spend balance (correctly avoids false-refusing a legitimate replay).
- HTTP surface exists: `engage/api.py` — `_rewards_usable_route` (line 692), `_loyalty_redeem`
  (704), `_loyalty_refund` (714), plus `_points_earn/_redeem/_adjust/_get` (509-537).

**This is the "single source of truth" mechanism the owner is asking for. It is not wired to
either front end.**

### The register today: a static mock, no ledger call

- `pos/data.jsx:107-115` — `REWARDS` is a **hardcoded array** ($2.50/$5/$10/$20/Birthday $20),
  costs 100/200/400/800 points, no server call.
- `pos/screen-register.jsx:1137-1138` — the customer card computes "next reward ready" by
  filtering `window.HW.REWARDS` against `customer.points`, a **client-held, seeded number**
  (`pos/data.jsx:87-91`), not a live balance read.
- `pos/payment.jsx:14-16, 213-217, 231-233` — `CASH_REWARDS` is the **same static ladder**,
  duplicated. `points >= r.cost` gates the button's `disabled` state entirely client-side
  (line 537). Tapping a reward just sets local state (`setReward`); nothing round-trips to a
  server before the discount is computed into `credits` (line 232).
- The sale post (`pos/payment.jsx:355-413`) sends `discount_cents`/`credits` as **plain numbers**
  to `/api/pos/sale` or `/api/contracts/orders`. There is **no `reward_id`, no `redemption_id`,
  no idempotency key** for the reward tied to that specific sale.
- **Server-side gap, confirmed by absence:** `wm-demo/wmdemo/pos_sale_lines.py` — the module that
  *does* enforce a real "discount authority" ceiling (`record_for_sale`, lines 474-660) — checks
  a sale's total discount against `engage.promotions.eligible`'s quote, or requires
  `pos:discount_override` + a reason. **It contains zero references to `reward`, `redemption_id`,
  or `loy_` anything** (grepped, zero hits). A loyalty-reward discount today has no code path
  through this ceiling at all — it would either be silently accepted as an unaudited discount, or
  blocked and forced through the manual-override path, which was built for manager overrides, not
  point-cost redemptions, and performs **no ledger check whatsoever**.

**Net: a reward button in the register today can go to "applied" with nobody — not the client,
not the server — ever asking the ledger whether the customer actually had the points.** That is
the exact failure mode the owner's mandate exists to close.

### The e-commerce shop: no reward redemption UI exists at all

- `shop/screen-cart.jsx` and `shop/screen-checkout.jsx` — grepped for reward/loyalty/wallet/
  points/redeem/tier: the only hits are the **promotions engine** (`hw.rule.v1`, comments at
  `screen-cart.jsx:236-321`, `scartSavings()`) — automatic "spend $X more" nudges and audience/
  tier-gated promo codes (`loyaltyTier: 'Wolfpack Leader'` as a rule *condition*, `shop/data.jsx:
  64-74`). This is the promotions engine, not the points-redemption reward system.
- There is no points balance display, no reward button, no redeem action anywhere in cart or
  checkout. A shopper cannot see or spend a loyalty reward on the web today.
- `athome/account-a/b/c.jsx` (member account screens) render a "Points & rewards" screen
  (`account-c.jsx:327-355`) with the identical static `$2.50/$5/$10/$20/Birthday` ladder as
  **display cards with no `onClick`** — informational only, not an action surface.

### The plan that already answers half of this — and one place it conflicts with today's mandate

`docs/LOYALTY-INTEROP-PLAN-2026-09-17.md` (owner decision D15, same day) already designs Engage
as the authoritative ledger with Alpine/Blaze as downstream projections, and already flags the
register-redemption integration as "the single highest-risk integration point" (§3.2). **Its
conflict rule 3 (§4) currently reads: "Blaze must be allowed to honor the redemption locally
(never block a sale on a loyalty check) and queue it for reconciliation"** — i.e., an offline/
best-effort redemption path with after-the-fact reconciliation. **That is the opposite of this
task's mandate** ("no offline redemption path exists," "over-redemption must be impossible").
The two documents disagree and the owner should resolve which one is the standing rule — see
Owner Question 1 below; nothing here reads that plan's language as already overruling the mandate
this audit was asked to produce.

---

## 2. UX verdict per surface

### Register — **REWORK** (mechanism), APPROVE WITH CHANGES (layout/flow)

The visual pattern (a customer card showing points, a redeem-ladder of buttons) is directionally
right and matches what the owner asked for. What must change, most valuable first:

1. **Wire the button state to `rewards.usable()`, not to a client-held `points` field.** The
   register must call the ledger (directly, or via a thin sync layer) at check-in and re-check
   immediately before enabling any button. Today's `customer.points >= r.cost` is a display of a
   number that can be stale, wrong, or simply the seeded demo value.
2. **Make every tap a synchronous server round-trip through `engage/rewards.redeem()`** before the
   discount is ever added to the ticket. Button shows a brief pending state ("Checking…", <300ms
   target); on success the discount lands with the returned `redemption_id`; on any 4xx it never
   applies and shows the specific reason (see state list below).
3. **Five button states, not two (available/disabled-by-cost):**
   - **Available** — solid, tappable.
   - **Not yet earned** — visible but dim, with a progress sub-label ("140 pts to go") — this
     already exists as a *concept* (`screen-register.jsx:1137-1138`'s `nextR`) but needs to render
     as a state on the button itself, not just a card sub-line.
   - **Already used today / at cap** — visible, disabled, labeled "Used today" (reads
     `per_customer_cap`/`window_days` from `usable()`'s refusal, not guessed client-side).
   - **Blocked by purchase minimum** — e.g., a reward with an `eligibility_rule_json` minimum-
     spend condition not yet met on this cart; label states the gap ("Add $8 more").
   - **Ledger unreachable** — see item 4. Never silently falls back to "available."
4. **When the ledger cannot be reached: rewards are disabled with a clear message, never a manual
   override.** "Rewards unavailable — connection issue" replaces the whole reward rail; the
   associate cannot type a code or approve one by eye. This is the one place the owner's mandate
   is completely unambiguous and the current code has no such state at all (payment.jsx has no
   network-failure branch for the reward ladder).
5. **One-tap apply, undo before tender.** Undo must call `rewards.refund()` (already built,
   atomic, idempotent) rather than just removing a client-side discount object — otherwise a
   removed-then-re-added reward silently double-spends against the ledger. Undo after tender
   (a return) must go through the same refund path, tied to the sale's void/return flow.
6. **Customer-facing confirmation:** a receipt line naming the specific reward and its redemption
   code (`rewards.py` already mints one, `_redemption_code()`), plus an SMS confirmation via the
   existing `msg_adapter.py`. Today's receipt only shows an anonymous `discAmt`.
7. **Stacking with promotions:** one reward + one promo + one manual discount, by *kind*, already
   enforced client-side (`screen-register.jsx:122-129` — "One discount per KIND... quietly
   stacking two... is how a $5 discount becomes $15 off"). That rule is correct and should be
   preserved, but it must be re-verified server-side in `pos_sale_lines.py`'s discount-authority
   ceiling once rewards are wired in — right now that ceiling doesn't know rewards exist at all
   (see §1).
8. **Speed/placement:** apply `docs/TAP-TARGET-PROPOSAL-2026-09-17.md`'s 44px floor to the reward
   rail specifically — it is a new touch surface, not retrofitted, so build it compliant from
   day one rather than adding it to that proposal's punch list later. Reward buttons belong
   adjacent to the customer card (already true), sized and spaced for a one-hand tap without
   looking — same reasoning as that proposal's register section (`TAP-TARGET-PROPOSAL:87-95`
   on the product grid).
9. **Accessibility:** state must not be color-only (disabled buttons currently rely on opacity —
   `payment.jsx:537` `opacity: can ? 1 : .5`) — add a locked/checkmark icon and an
   `aria-disabled` + reason in the accessible name ("5 dollars off, 60 points needed").

### Shop cart — **REWORK** (nothing exists to approve)

No reward redemption surface exists. Needs: a points balance chip, a redeem tray showing the same
five states as the register, live-validated against the same `usable()`/`redeem()` calls (web
channel), applied before the promotions engine computes final totals so stacking rules are
evaluated once, in one place, not twice.

### Shop checkout — **REWORK**

Same gap. The applied reward must survive from cart to checkout as a `redemption_id` already
reserved (see §3), re-confirmed at order submission, not re-picked.

### Customer account (`athome/account-*.jsx`) — **REWORK**

Currently decorative. Needs the reward cards to become real actions (redeem-for-later /
generate-a-code-for-in-store-use, or direct web redemption), backed by the same ledger calls.

---

## 3. Mechanism to make over-redemption impossible

1. **Ledger is the single source of truth.** `engage/ledger.py`'s `loy_wallet.balance` is a cache
   of `SUM(loy_ledger.delta)`; every earn/redeem/adjust/refund is one atomic transaction. No
   front end (register, shop, account) may hold or trust its own copy of a balance for anything
   beyond display; every redemption decision re-asks the ledger at the moment of the tap.
2. **Atomic reserve → apply → release**, already built: `rewards.redeem()` is the reserve+apply in
   one step (stock decrement + ledger debit + redemption row, one transaction); `refund()` is the
   release, equally atomic. Server-generated `redemption_id` and `code` — never client-minted.
   Idempotency key scoped per customer (`_scoped_key`) makes a double-tap or a retried network
   call resolve to one debit, not two.
3. **Race between two registers:** the `_lock` + `_dbshare.reuse_connection(atomic=True)` pair in
   `redeem()` serializes concurrent calls for the same customer; the balance check happens inside
   that lock, immediately before the insert, so two registers racing to spend the same last 100
   points cannot both succeed — the second sees the post-first-debit balance and is refused.
4. **Alpine mirror-mode / Blaze-native till:** per `LOYALTY-INTEROP-PLAN` §2-3, Alpine's balance
   is read at check-in for continuity but Engage is authoritative; Alpine is written *after* the
   ledger commits, never before. For a still-Blaze till, the honest answer (plan §3.2, "highest
   risk row"): **no confirmed Blaze partner-API write exists for real-time redemption validation
   today.** Until Phase 0 of that plan confirms otherwise, a Blaze-native till **cannot** safely
   offer register-side reward redemption under this mandate — the only mandate-compliant options
   are (a) hold reward redemption back until the till itself can call Engage synchronously, or
   (b) redeem only through a channel that already round-trips to Engage (admin-assisted, SMS/web)
   until the till is off Blaze. Anything else is exactly the "offline redemption" the mandate
   forbids, however the interop plan currently phrases it as an acceptable interim (see §1's
   conflict note).
5. **Audit trail + fraud signal:** every redemption already writes an `engage_events` row
   (before/after, actor) and an `engage_domain_events` `points.redeemed` row (`rewards.py:303-
   310`) — sufficient raw material for a same-reward-multiple-stores-within-minutes fraud check;
   that specific query does not exist yet and should be added to the reconciliation job in the
   interop plan (§5) rather than invented as a third system.

---

## 4. New/redesigned screens

The following need **four concepts each (desktop + phone)** before any commit, per standing
practice — none are drawn here:

- Register reward rail (five-state buttons, ledger-unreachable banner, undo/refund flow).
- Shop cart reward tray (parallel to the promotions "savings" nudges already in
  `screen-cart.jsx`, but a separate, clearly-labeled panel — the two must never visually merge,
  since one is automatic and one is a redemption the shopper chose).
- Shop checkout reward confirmation (surviving from cart, re-confirmed at submit).
- Customer-account "Points & rewards" screen, converted from decorative cards to real actions.

Any change to `pos/screen-register.jsx` is a **proposal for the owner's approval only** — this
audit recommends the five-state reward rail and the ledger-unreachable banner described in §2,
but no code in that file has been or should be touched without separate sign-off.

---

## 5. Owner questions

**Q1.** `docs/LOYALTY-INTEROP-PLAN-2026-09-17.md` conflict rule 3 currently allows Blaze to honor
a redemption offline and reconcile after the fact; this task's mandate says over-redemption must
be impossible with no offline path. Which stands?
A) **This mandate wins — remove offline/best-effort redemption from the interop plan; register
   redemption is unavailable (button shows "unavailable") whenever the ledger can't be reached
   live, on any till, including Blaze-native.** *(Recommended — matches the stated requirement
   exactly and costs nothing but an occasional disabled button during a network blip.)*
B) Keep the interop plan's offline-then-reconcile posture for Blaze-native tills only, accept the
   small over-redemption risk as a temporary transition cost, and apply the strict no-offline rule
   only once the till itself is off Blaze
C) Offline redemption is fine anywhere, capped at a small dollar amount per occurrence, reconciled
   daily
D) Something else (say what)

**Q2.** The register's reward ladder and the customer-account reward list are currently two
separate hardcoded copies of the same five rewards. Once wired to the real ledger, should reward
*definitions* (cost, value, caps, channels) be:
A) **Managed once in `engage`'s `loy_rewards` table and read by every surface (register, shop,
   account) — no hardcoded ladder anywhere.** *(Recommended — this is what `usable()` already
   assumes; it is the only version that can't drift.)*
B) Managed centrally but allow a per-surface override table for register-only or web-only rewards
C) Keep them independently configured per surface, accepting they can drift
D) Something else (say what)

**Q3.** For the ledger-unreachable state at the register, what should the associate be told to do
next, beyond "rewards unavailable"?
A) **Nothing else — sell the rest of the cart normally, offer to apply the reward on the
   customer's next visit or via a follow-up SMS/receipt credit once the ledger is back.**
   *(Recommended — keeps the sale moving without inventing a workaround.)*
B) Let a manager approve a placeholder discount now, reconciled against the ledger later
C) Hold the whole sale until connectivity returns
D) Something else (say what)

**Q4.** Same-reward-across-stores-within-minutes is a real fraud signal the audit trail already
supports but nothing currently checks. Should this be:
A) **A passive flag added to the reconciliation job (§5 of the interop plan) for daily review —
   no automatic blocking.** *(Recommended — avoids blocking a legitimate customer on a false
   positive while surfacing the pattern.)*
B) A real-time block: the second redemption attempt within the window is refused outright
C) Not worth building yet — revisit after the first few months of real redemption volume
D) Something else (say what)
