# Pickup flow — demo audit (replaces the "live" column) — 2026-09-17

Addendum to `PICKUP-FLOW-UX-REVIEW-2026-09-17.md`, per owner correction: that review's "live" column
audited the OLD production website (`/Users/jt/hyper-tech/hyperwolf-frontend-nextjs`), which is out of
scope. This document audits what actually runs today at **`https://hyperwolf-wm-demo.onrender.com`**
(the wm-demo server) instead — the mock UIs it serves and the demo APIs behind them. Read-only: no
writes, no auth attempts, no `.env`/credential access, no `hyper-tech` reads. Nothing edited except
this new file.

**Source pinning.** `/Users/jt/wm-demo` at commit `1112a3f` is what Render serves today; `58ed35d` is
committed but not pushed. Checked: `58ed35d` touches none of the pickup-relevant backend files
(`fulfillment.py`, `checkin.py`, `checkin_api.py`, `catalog.py`, `cities.py`, `route_policy.py`,
`policy_batch1/2/3.py`) — the diff against those paths is empty, so nothing pickup-shaped is about to
change on next push. All backend citations below are `git show 1112a3f:wmdemo/<file>`. Mock UI
citations (`POS-Admin/pos/*`, `shop/*`) are the current working tree, which is also what the demo
serves live (confirmed by fetching the same files over HTTP, below).

**Live checks (GET only, unauthenticated, ≤30 requests, spaced ~1s):**

| Path | Status | What it means |
|---|---|---|
| `/` | 200 | Dashboard loads |
| `/Hyperwolf POS.html` | 200 | POS entry page (loads `pos/*.jsx` bundle) |
| `/Hyperwolf Shop.html` | 200 | Shop entry page (loads `shop/*.jsx` bundle) |
| `/pos` (bare) | 404 | No `pos/index.html` — only the named entry HTML above works |
| `/shop`, `/shop/index.html` | 404 | Same — `shop/` has no index either |
| `/pos/screen-orders.jsx`, `/pos/checkin.jsx`, `/pos/screen-publish-gate.jsx`, `/pos/data.jsx` | 200 | Served as static source over the wire — this **is** the deployed mock |
| `/shop/screen-checkout.jsx`, `/shop/chrome.jsx` | 200 | Same for the shop mocks |
| `/explorations/review`, `/explorations/review/index.html` | 200 | Explorations folder has an index |
| `/api/state` | 200 | Public read (no auth) |
| `/api/fulfillment/board` | 401 | Requires session or API key |
| `/api/fulfillment/queue` | 401 | Requires session or API key |
| `/api/checkin/state` | 401 | Requires session or API key |
| `/api/order/lines` | 401 | Requires session or API key |
| `/api/orders/held` | 401 | Requires session or API key |

No mutating call was made. All five `/api/*` 401s are the intended result of a hardening change
landed the same day as this review — see "Security posture," below.

---

## 1. Pickup flow, step by step — status **on the demo**

Legend: **LIVE** = real server logic reachable today · **MOCK** = static UI, no server behavior behind
it · **BACKEND** = real logic in `wmdemo/`, not wired to any customer-facing surface · **MISSING** =
nothing found.

| Step | State | Evidence |
|---|---|---|
| Weedmaps/storefront pickup order arrives | **BACKEND** | `wmdemo/fulfillment.py:130-134` maps our `verify` stage to WM status `PENDING`; the docstring (`:16-21`) says almost no order has ever reached `READY_FOR_ATTAINMENT` and none has reached `COMPLETE` in real WM traffic — the pipe exists, volume through it is ~zero. |
| Store selection / store page | **MISSING** | `shop/*.jsx` has **zero** occurrences of "pickup" (grepped every file); `Hyperwolf Shop.html` loads only `shop/chrome.jsx`, `screen-home.jsx`, `screen-shop.jsx`, `screen-cart.jsx`, `screen-checkout.jsx` — a delivery-only lane set, confirmed live by fetching `shop/chrome.jsx` and `shop/screen-checkout.jsx` (200, both delivery-shaped). |
| Per-store menu / stock pool | **BACKEND** | `wmdemo/catalog.py` channel map (`pickup \| express \| scheduled`) exists but is read only by `pos/screen-publish-gate.jsx` (Weedmaps publishing), never by the shop mock. |
| Cart mode switch (delivery↔pickup) | **MISSING** | No such control anywhere in `shop/*`; the owner's "mode switch on the store-specific UI" decision has no UI to modify — there is nothing to switch. |
| Hold / reservation | **BACKEND, unmodified** | `catalog.reserve(wm_cart_id, region, requested, ttl=900)` (`catalog.py:1742-1750`) — still region-keyed, still 15 min flat, still per-SKU clamp not all-or-nothing. Owner's 10/25-minute decision is not reflected (§4). |
| Checkout (pickup variant) | **MISSING** | `shop/screen-checkout.jsx` is delivery-only: requires an address, has no store card, no ASAP/slot picker, no curbside/counter choice. |
| Order confirmation / status, notification | **MISSING for customer** | Backend maps stage `ready` → text "Ready for pickup" (`fulfillment.py:133`) but nothing sends it anywhere; no customer surface exists to show it. |
| Order queue (POS) | **LIVE mock over BACKEND** | `pos/screen-orders.jsx` defaults to the `pickup` tab (`:59`), counts orders where `channel === 'Store'` (`:191`); fetched live at 200. Backend board/queue routes exist and answer 401 without credentials — see below. |
| Check-in / order↔person binding | **LIVE mock over BACKEND** | `pos/checkin.jsx` (200 live) binds via `checkin.match_checkin(...)` (`checkin.py:575`); `/api/checkin/state` answers 401 unauthenticated, confirming it is a real gated endpoint, not a stub. |
| Pickup code check | **BACKEND, unchanged, weak** | `_code_matches` (`checkin.py:320-330`) still accepts any ≥4-char **suffix of the Weedmaps order id** — not generated, not random, not single-use. No UI field for it in `pos/checkin.jsx` (matches old review). |
| ID check at handoff | **BACKEND, gated** | `verify_gate.py` `PICKUP_HANDOFF` runs on stage `done` per the original review; unchanged in this commit. |
| Payment at counter | **MOCK, text only** | `pos/screen-orders.jsx:3403-3408` region still says "collected at hand-over … at the counter." |
| Stage advance to Ready / Done | **LIVE mock over BACKEND** | `STAGES = ("verify","pack","packing","ready","done")` plus `canceled` now exist server-side (`fulfillment.py:130-199`) — `canceled` is a real terminal stage in the backend today. |
| Cancelled/no-show column in the POS board | **MOCK gap persists** | The mock's own code says so: `screen-orders.jsx:2605` "There is no cancelled stage. HW.STAGES ends at 'done'"; `:2816` "the board has no cancelled column, so it will not clear itself off the queue." So although the **backend** stage machine now has `canceled`, the **client** board still has no column/lane for it — a rejected/no-show order still has nowhere to land on screen. |
| Curbside arrival | **MISSING** everywhere, confirmed unchanged. |

**Net change vs. the original review's backend read:** the backend gained a `canceled` terminal stage
(`fulfillment.py:182-199`) since the last pass judged it entirely missing, and — separately and more
consequentially — the fulfillment/checkin/order APIs are now behind a real auth gate (below), which
they may not have been when the original review's citations were written. Everything else (code
weakness, hold TTL/keying, no store model, no customer confirmation/status surface, no curbside) is
unchanged.

---

## 2. Security posture of every touched route

| Route | Auth mode (live, confirmed) | Scope | Notes |
|---|---|---|---|
| `GET /` , `Hyperwolf POS.html`, `Hyperwolf Shop.html`, `pos/*.jsx`, `shop/*.jsx` | none — public static file serve | — | Server is `config.STATIC_DIR`-rooted (`server.py:3743-3808`); path-traversal and dot-segment guards are in place; this is intended (a demo nobody can look at is not a demo). |
| `GET /api/state` | none | — | Explicitly public per `server.py`'s own comment ("Reads stay open"). |
| `GET /api/fulfillment/board`, `/api/fulfillment/queue`, `/api/fulfillment/status-map` | **session or API key** (`_SESSION_OR_KEY`) | `orders:read`-shaped | Registered in `policy_batch3.py:222-226`; confirmed 401 live with no credential. |
| `GET/POST /api/checkin*`, `/api/checkin/match`, `/api/checkin/candidates` | **session or API key** | `people:read` / write-scoped | `policy_batch1.py:188-198`, `policy_batch3.py:249-252`; confirmed 401 live for `GET /api/checkin/state`. |
| `POST /api/order/stage`, `/api/order/release-hold` | **session or API key** | write-scoped | `policy_batch2.py:158-166`. |
| `GET /api/order/lines`, `/api/orders/held` | **session or API key** | `orders:read` | `policy_batch3.py:220-221`; confirmed 401 live. |

**Store scoping**: not evaluated here — it requires a valid session/key to inspect, which this
read-only audit deliberately does not obtain. The original review's finding that `fulfillment.board()`
is not store-filtered by query parameter is a code-level claim in `fulfillment.py`/`server.py` that
this audit did not re-derive; flag it as **unverified, not confirmed**, rather than repeating it.

**Route-policy default changed to strict** (`route_policy.py:225-231`, dated 2026-09-17): any
`/api/*` path with **no** explicit registration now 404s rather than falling through to a handler —
this is new since whenever the original review's backend citations were written, and it means the
demo's fulfillment/checkin/order surface is no longer reachable by an unauthenticated caller *at all*,
not even to observe shape. That is a security improvement, not a functional one — none of the pickup
gaps above are closed by it.

---

## 3. Revised verdict table — DEMO surfaces only

| Surface | Old verdict (vs. live prod) | Verdict on the demo | Why it changed / didn't |
|---|---|---|---|
| Live storefront (`hyperwolf-frontend-nextjs`) | REWORK | **OUT OF SCOPE** | Not part of the demo; drop from this track entirely per owner correction. |
| E-commerce mock (`shop/*`) | MODIFY (add pickup) | **MODIFY — unchanged** | Confirmed live: zero pickup surface exists to modify from; the plan in §2.2 of the original review (mode switch, store card, checkout variant, confirmation/status, store picker) still describes exactly what's missing. |
| POS order queue (`pos/screen-orders.jsx`) | KEEP, with modifications | **KEEP, with modifications — unchanged**, one addendum | All 8 original additions still apply. Add: the cancelled-column gap is now a *client* gap specifically — the backend already has the `canceled` stage to hang a column on, so this became easier, not harder. |
| Check-in (`pos/checkin.jsx`) | KEEP + add code/QR field | **KEEP + add code/QR field — unchanged** | `/api/checkin/state` 401 confirms it's a real gated backend, not decoration; the missing UI field is still missing. |
| Publish gate / inventory channels | KEEP | **KEEP — unchanged** | `pickup` channel → store-locations mapping still intact (`screen-publish-gate.jsx:58` CHANNELS). |
| Backend (`fulfillment.py`, `checkin.py`, `catalog.py`) | MODIFY | **MODIFY — narrower** | Drop "add stage `cancelled`" from the to-do — it exists (`fulfillment.py:182-199`). Keep: generated/hashed pickup code, `released_no_show` stage, per-store hold TTL matching the owner's 10/25-minute decision (still 900s flat, still region-keyed — `catalog.py:1742`), `store_id`/`held_until`/`arrival_kind` fields (still absent). |
| Live backend (`hyperwolf-backend`) | MODIFY until cutover | **OUT OF SCOPE** | Part of `hyper-tech`, read-only and out of scope per this task's hard rules. |
| Super-admin | nothing to keep | **OUT OF SCOPE** | Part of `hyper-tech`. |

---

## 4. Which of the original review's eight live-storefront changes still apply

The original review's §2.1 list (items 1–8) was written against the **old production** site and is
now moot as a rework target for that surface — there is no live storefront pickup flow in this
program anymore; the demo replaces it. Restated against **what the demo needs built**, translating
each:

- **Still applies, same shape**: mode switch as a header control (not a tab) — #1; never overwrite a
  saved address — #2 (N/A here, since there's no address flow yet, but design it in from the start);
  run a review sheet on cart-mode switch — #4; persist store choice server-side, show it on every
  screen — #5; status page with real stages + code + QR — #7; promo code visible, decided by the
  promotions engine — #8.
- **Falls away**: #3 ("no full page reload on switch") and #6 ("delete the employee gate") — both are
  reactions to specific old-prod mechanics (`router.refresh()`, a hard-coded `EMPLOYEE` check) that
  don't exist in the demo's React-free, Babel-in-browser mock stack. The demo needs the equivalent
  *decision* (no destructive reload-equivalent, no employee-only gate) but not the specific fix.
- **New, not in the original eight**: the demo needs a pickup code that is generated and hashed
  (not a WM-order-id suffix) before any of this ships — that was previously a backend-only line item
  (§2.6/§3 of the original review) and now sits squarely inside "what the demo needs" since the demo
  *is* the build target; and the POS board needs an actual cancelled/released lane now that the
  backend stage exists to feed it — previously phrased as "add the stage," now it's "wire the stage
  the backend already has into the board UI."

Owner decisions carried forward unchanged and not re-litigated here: pickup as a mode switch on the
store-specific UI; cart holds 10 min idle / 25 min max; pay at arrival; per-store purchase limits;
rewards as live-validated buttons.

---

## 5. One-paragraph verdict

On the demo, pickup is further from done than the original review's mock-surface read suggested and
about the same distance as its backend read: the shop mock has no pickup lane at all (confirmed by
fetching every shop file live — zero hits), the POS queue and check-in are real, gated, working
mock-over-backend pieces (confirmed via 401s against unauthenticated `/api/fulfillment/*`,
`/api/checkin/*`, `/api/order/*`), and the backend stage machine is one stage richer than last time
(`canceled` now exists) but everything else — code strength, hold TTL/keying, store model, customer
notification/status, curbside — is unchanged. The owner's REWORK target (the old storefront tab) is
gone from scope; what remains is exactly the original review's MODIFY-the-mocks-and-backend track,
now with no live-storefront distraction and a slightly shorter backend to-do list.
