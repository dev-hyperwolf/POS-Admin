# Alpine IQ — Programmatic Config Read Options — 2026-09-17

Research only. No Alpine host was called (`lab.alpineiq.com` or any other Alpine
domain) and no `.env`/credential file was opened. Public documentation via
WebSearch/WebFetch only. This answers **Q1** in
`POS-Admin/docs/LOYALTY-INTEROP-PLAN-2026-09-17.md` §9: "Alpine's tier/program
configuration could not be found through any API endpoint this audit or the
2026-09-10 census tried (`GET /api/v2/tiers/1546` → 404). How should we get the
real export?"

---

## 1. Every Alpine endpoint already used anywhere in this estate

Base URLs confirmed from source and from the 2026-09-10 census:
`https://lab.alpineiq.com/api/v1.1` and `https://lab.alpineiq.com/api/v2`.
Auth confirmed live (no 401/403 across ~20 calls in the census): header
`X-APIKEY: <key>` only — **not** an `x-uuid` header. The account id (`1546`)
is a **path segment**, not a header. This contradicts the `alpineiq-hyperwolf-
marketing-analytics` skill doc, which describes an `x-uuid` header; the skill
doc is stale on this point — trust the census and the source call sites below.

### Read-only client (canonical reference for this research)

`/Users/jt/wm-demo/wmdemo/engage/alpine_client.py` — GET-only, stdlib `urllib`
only, by construction never issues PUT/POST/DELETE. Confirmed working paths
used by this client:
- `GET /api/v1.1/piis/{uid}?limit=N&offset=N` (contacts list, paginated)
- `GET /api/v2/wallet/{phone}` (one contact's points wallet — untested live, needs PII)
- `GET /api/v1.1/adjustments/{uid}/{start}/{end}` (point-adjustment history, unix seconds)
- `GET /api/v1.1/redemptions/{uid}/{start}/{end}` (redemption history)

### Census: `/Users/jt/POS-Admin/scratch/alpine-census-2026-09-10.md`

Ground truth for what is live and what 404s. Confirmed working:
`GET /api/v1.1/piis/1546?limit=N` (337,640 contacts), `GET /api/v2/campaigns?full=true`
(1,428 campaigns), `GET /api/v1.1/redemptions/1546/<start>/<end>` (15,295/30d),
`GET /api/v1.1/adjustments/1546/<start>/<end>` (286/30d), `GET /api/v1.1/stores/1546`
(5 stores). **Confirmed 404: `GET /api/v2/tiers/1546`, `GET /api/v2/loyalty/1546`,
`GET /api/v1.1/optin/1546`, `GET /api/v1.1/consent/1546`, `GET /api/v1.1/discounts/1546`,
`GET /api/v1.1/export/1546`, `GET /api/v2/stores`, `GET /api/v2/locations`,
`GET /api/v1.1/locations/1546`, `GET /api/v2/channel-report`.**
`GET /api/v1.1/piis/1546/export` → 400 (not 404 — likely real but needs undiscovered
params). `GET /api/v1.1/conversions/1546?start=&end=` timed out twice (>20s, no
4xx/5xx — status genuinely unknown). No response ever carried a rate-limit header.

### `hyper-tech/hyperwolf-backend` (READ-ONLY repo — cited, not touched)

- `common/utils.js:1264` `X-APIKEY` header construction; `:1271` `POST /api/v2/loyalty`
  (write — add/update a contact's loyalty enrollment, not a config read);
  `:1283-1284` `PUT /api/v1.1/optin/1546/{phone}/true`, `PUT /api/v2/optin/email/{email}/true`
- `controllers/alpine/alpine-controllers.js:33` `GET /api/v1.1/piis/1546?search={phone}&limit=1`;
  `:38` `GET /api/v2/wallet/{phone}`; `:89` `PUT /api/v1.1/adjust/loyaltyPoints/1546/{contactId}`;
  `:141` `GET /api/v1.1/piis/1546/{contactId}` (single-contact detail, includes `referCode`);
  `:177` `POST /api/v1.1/contact/referral/1546`; `:218,255` `PUT /api/v1.1/contact/referral/1546/{contactID}`;
  `:224` `PUT /api/v1.1/optin/1546/{phone}/true`; `:314` `GET /api/v2/contact/recommendations/{contactId}`
- `controllers/blaze/user-cart-controllers.js:868` redemption-URL replay against a discount
  redemption link (`/api/v1.1/discount/redeem/1546/{id}/{token}`, from `staticDB/alpineDeals.json`);
  `:1039,1052` `GET /api/v1.1/piis/1546?search={phone}` / `GET /api/v1.1/piis/1546/{contactId}`
  (reads `profile.loyaltyPoints`, `orderAmountSpent` — **the two-tier $2,000 threshold is
  reverse-engineered from these fields in app code, at `:1063`, not read from an Alpine
  config resource**)
- `controllers/blaze/user-auth-controllers.js:528` `POST /api/v1.1/loyaltyContact/{projectAlpineiqId}`
- `staticDB/alpineDeals.json` — a **static, hand-maintained** JSON file of discount
  objects (`avatar`, `redemptionURL` pointing at `lab.alpineiq.com/discount/image/...`
  and `/api/v1.1/discount/redeem/...`) — this is the closest thing to a "rewards
  catalogue" in the estate, and it is a checked-in static file, not a live API read.

`hyper-tech/hemp-backend` and `hyper-tech/stilo-backend` mirror the same
`controllers/alpine/alpine-controllers.js` + `common/utils.js` shape (separate
brand deployments of the same backend, same endpoints, presumably different
API keys/UIDs).

### GAS `marketing-analytics/AlpineIq.js` (this repo)

`POST /api/v1.1/campaigns/:uid/reports/channels` (channel report — POST, not GET),
`POST /api/v2/campaigns/filtered/:uid` (date-filtered campaigns — POST),
`GET /api/v1.1/redemptions/:uid/:start/:end`, `GET /api/v1.1/conversions/:uid?start=&end=`,
`GET /api/v2/campaign/stats/:campaignID`, `GET /api/v1.1/adjustments/:uid/:start/:end`.
None of these is a config/tier read either.

### `POS-Admin/docs/LOYALTY-INTEROP-PLAN-2026-09-17.md` (already asks this exact question)

Line 21-22: confirms **two tiers, "Wolfpack" and "Pack Leader,"** live in
production code (`user-cart-controllers.js:995-1075`, `getWolfPack`), and the
**$2,000 lifetime-spend entry threshold** for Pack Leader (`orderAmountSpent`,
`amountLeft = Math.max(2000 - orderAmountSpent, 0)`) — both **reverse-engineered
from app behavior, not read from Alpine**. Line 26 states plainly: tier/program
definitions are "Unknown / NEEDS-EXPORT" and that Alpine "may not expose one at
all under this account." This document is the direct predecessor to the present
one and already frames the same three options this report evaluates as (A)/(B)/(C)
in its Q1 — this report adds (D), the in-app probe.

**Conclusion of the census: no direct programmatic read of tier/program config
exists anywhere already tried in this estate. The 404 was not a fluke or a bad
account id — it was tried once for tiers and once for loyalty, both 404, plus
five other 404s on adjacent guesses (optin, consent, discounts, export,
channel-report-GET).**

---

## 2. Public Alpine IQ documentation research

- **Swagger/OpenAPI**: `https://lab.alpineiq.com/swagger` (UI) /
  `https://lab.alpineiq.com/api/v1/swagger` (JSON) is the one interactive API
  reference Alpine publishes. **This is an Alpine host — not fetched, per this
  task's hard rule.** It cannot be evaluated further without either the owner
  opening it in their own browser (Route d) or a live call (excluded here).
- **Public help docs migrated**: `support.alpineiq.com/developer-documentation*`
  and `support.alpineiq.com/loyalty-settings-and-reporting` now 301-redirect to
  a new help center at `help.aiq.com/en` (Alpine appears to have rebranded/moved
  docs to "AIQ" during 2026). The new portal's category list: **Loyalty (4
  articles), Developers (20 articles), Settings (45 articles), Integrations
  (103), Ecommerce (118),** plus persona/audience/marketing categories.
- **`docs.alpineiq.com/category/api/`** (a separate "AIQ News" blog-style docs
  site, still live, not redirected) lists API categories — Loyalty, Campaign
  Data, Customer Data, CRM, Point of Sale, Retail Loyalty, SMS Marketing — but
  the fetched category page does not itself list endpoint paths; it is a
  landing/index page, not a reference.
- **`help.aiq.com/en/articles/13921233-loyalty-reporting-best-practices`**: the
  only loyalty-configuration-adjacent article found. It is entirely about
  **financial liability reporting** (ASC 606 / IFRS 15 outstanding-points
  valuation), not program structure. Its one relevant line: *"Loyalty Financial
  Reports can be found under Settings > Loyalty Settings > Points Reporting"* —
  confirming these reports live **in the console UI**, with no mention of an
  API or export path for them.
- **Partner integration guide (Treez)**:
  `support.treez.io/.../alpine-iq-two-way-integration-with-treez` describes the
  Treez↔Alpine loyalty integration only in workflow terms (linking customers,
  redeeming rewards at POS); it explicitly configures **discount amounts inside
  Treez's own Discount Management**, not by reading a catalogue from Alpine —
  i.e., even Alpine's own POS partners don't document pulling tier/reward
  config out of Alpine via API; they configure it redundantly on their side.
- **Agency vs. brand key scopes**: **no public documentation found** describing
  this distinction at all. Every real call site in this estate (hyperwolf-backend,
  hemp-backend, stilo-backend, the GAS project, `alpine_client.py`) uses a single
  flat `X-APIKEY` + numeric account-id-as-path-segment shape, with no header or
  parameter that looks like a scope selector. If Alpine has an agency/brand key
  hierarchy, it is not exposed anywhere this estate's code or public docs touch.
- **Zapier**: no native Zapier app for Alpine IQ was found (unlike loyalty
  competitors such as Loopy Loyalty). Community threads describe **outbound**
  custom webhooks (Zapier → Alpine, code-webhook POSTs), not Alpine exposing a
  config-read surface via Zapier.
- **Net finding**: nothing in Alpine's current public documentation surface
  (help.aiq.com, docs.alpineiq.com, or the Treez partner guide) names a
  GET endpoint for tiers, earn rules, multipliers, expiry, or birthday-bonus
  rules. The only structural artifact Alpine documents is the **wallet**
  (`/api/v2/wallet/{phone}`, confirmed live in this estate) — a per-contact
  snapshot of *current* discounts/points, not the program's *rules*.

---

## 3. Four routes evaluated

### (a) Direct read endpoint
**Does not exist.** Two direct 404s (`/api/v2/tiers/1546`, `/api/v2/loyalty/1546`)
plus five adjacent 404s in the census, corroborated by an absence of any public
doc naming a tiers/program-config GET path. Effort to keep pursuing this by
guessing further paths: low per attempt, but no positive signal after seven
tries — diminishing returns. **Not recommended as the primary route**, though
one narrow follow-up is cheap and worth doing (see §3b).

### (b) In-app read-only probe job (Render, key never leaves the server)
Extend the existing, already-reviewed `alpine_client.py` pattern (GET-only by
construction, rate-limited, credentials read at call time, never logged) with
a small allowlist of **additional untried GET-path guesses** run once, from
Render where `ALPINEIQ_API_KEY`/`ALPINEIQ_UID` already live — e.g. `/api/v1.1/tiers`,
`/api/v1.1/tiers/{uid}`, `/api/v1.1/program/{uid}`, `/api/v1.1/rewards/{uid}`,
`/api/v1.1/discountRules/{uid}`, `/api/v2/loyalty/settings/{uid}`,
`/api/v1.1/piis/{uid}/export?format=csv` (the one 400, worth resolving — it may
need `format=`/`fields=` params rather than being truly absent). Record only
response **shape** (status, key names, counts) into a redacted report — same
discipline as the 2026-09-10 census, which is itself the existing proof this
pattern is safe and repeatable.
- **Pros**: reuses vetted infrastructure and posture; key never touches a
  laptop or a transcript; cheap (a handful of GETs, well under rate limits);
  produces evidence either way (a working path, or a stronger negative than
  today's two-endpoint sample).
- **Cons**: still guessing paths Alpine hasn't documented — success isn't
  guaranteed and each guess against undocumented territory carries a small
  risk of hitting an unexpected write-adjacent path if a name is reused
  (mitigate: GET-only client, by construction, as today).
- **Effort**: low (hours) — mostly extending `alpine_client.py`'s existing GET
  wrapper with new path constants, re-running the same reporting shape the
  census already used.
- **Security**: identical to the existing census's posture — no PII fields,
  key from env at call time, redacted output.
- **Needs from owner**: nothing beyond a go-ahead to run it (the key already
  lives in Render/`.env` and this task must not touch either).

### (c) Statistical inference from wallet + transaction history
Using the confirmed-working `wallet`, `adjustments`, and `redemptions`
endpoints against real (consented) contacts:
- **Can infer**: point-value thresholds for specific rewards (by watching what
  a wallet offers at different point balances), the $2,000 Pack Leader
  threshold (already done, via app code rather than API, but the same
  inference could be done purely from wallet snapshots at different spend
  levels), redemption frequency/value patterns.
- **Cannot infer reliably**: hidden hold-back bonuses or promotional multipliers
  that don't manifest as a wallet-visible reward; **expiry rules** (points
  expiry is a background/console-only mechanic — you'd need to watch a
  specific contact's balance silently decrease over months, which is slow,
  noisy, and touches PII repeatedly); birthday-bonus timing/amount (would
  require correlating a birthdate field — itself PII — against adjustment
  events over a full year per contact).
- **Pros**: uses only endpoints already proven to work; zero new attack surface.
- **Cons**: slow, statistically noisy, and the two things the owner most wants
  (expiry, birthday bonus) are exactly the two hardest to infer this way; every
  useful signal here requires per-contact PII (`adjustments`/`redemptions` rows
  carry `phone`/`name`/`email` on every row per the census — §2 above)
  repeated across many contacts and a long time window, which is a much
  larger PII footprint than a one-time config read.
- **Effort**: high (weeks of data collection) for a low-confidence result on
  the fields that matter most.
- **Not recommended as primary** — usable later only as a *cross-check*
  against a real export, not as the source of truth.

### (d) Owner's logged-in browser session, read-only script
Alpine's own config lives in the console under **Settings → Loyalty Settings**
(confirmed by the "Points Reporting" sub-path found in public docs) and
presumably a Tiers/Rewards management screen elsewhere in the same console —
neither enumerated in public docs, so the exact page inventory needs one
session with an authenticated screenshot pass (mirrors what the census
couldn't do for tiers over the API). A read-only script driven from the
owner's own logged-in session (e.g. Claude Browser tools, screenshot + DOM
read, no clicks that submit/save anything) walking Settings → Loyalty Settings
and any Tiers/Rewards page would capture the actual configured values
(thresholds, multipliers, expiry days, birthday-bonus amount) directly from
the source of truth — the same place a human would look today, just without
requiring the owner to take the screenshots personally.
- **Pros**: reads the *actual* configured values, not an inference; needs no
  new Alpine endpoint to exist; matches option (B) already proposed in
  `LOYALTY-INTEROP-PLAN-2026-09-17.md` Q1, just automated instead of manual.
- **Cons**: requires the owner's authenticated session (their SSO/login,
  handled by them — never entering credentials); brittle to Alpine UI changes;
  is a one-time export, not a live sync (config drifts silently until re-run).
- **Effort**: low-to-medium (one guided session; a short follow-up thread per
  this project's own browser-automation rule of keeping such tasks short and
  separate).
- **Needs from owner**: log into the Alpine console themselves (never enter
  their password into any automation) in a fresh short thread, then either sit
  through a read-only screenshot/DOM walk of the Loyalty Settings pages, or
  export whatever CSV/print view the console itself offers there.

---

## Recommendation

**Run (b) first, immediately** — it's cheap, reuses code already reviewed and
proven safe, and gives a real (not inferred) answer if Alpine has a
config-read path under a name nobody has guessed yet. **In parallel or as the
fallback, do (d)** — because (b)'s prior probability of success is low (seven
prior 404s plus no public doc naming such a path), (d) is very likely the one
that actually produces tiers/thresholds/rewards/multipliers/expiry/birthday-
bonus values, since Alpine's own documentation places all of this in **console
UI settings**, not in any API surface it publishes. Treat (c) as a standing
cross-check available from data already flowing through `alpine_client.py`,
never as the primary source. Do not spend more effort on (a) beyond the one
cheap follow-up folded into (b) (resolving the `piis/{uid}/export` 400).

This directly resolves `LOYALTY-INTEROP-PLAN-2026-09-17.md` Q1: the owner's
option (B) — "someone with Alpine's own admin console pulls a screenshot/CSV
of the tier and rewards setup" — is very likely still required, but it does
not need to be fully manual; route (d) turns it into a short guided session
instead of the owner doing the extraction themselves.

**What the owner must do:**
1. Approve running the (b) probe job against production (read-only, GET-only,
   same posture as the existing census — no new consent needed beyond what
   already covers `alpine_client.py`).
2. For (d): open a **new, short thread** dedicated to browser automation (per
   this project's own thread-discipline rule), log into the Alpine/AIQ console
   themselves, and stay for a read-only walk of Settings → Loyalty Settings
   (and whatever Tiers/Rewards page that section links to) — or pull whatever
   export/print view exists there directly.
3. Decide, once (b) and (d) results are in, whether the existing $2,000/
   two-tier reverse-engineered shape needs correcting, or is confirmed exactly
   as-is (Q1 option C would then simply be validated rather than assumed).

---

## 4. Security

- **Key handling**: the Alpine API key/UID must never leave Render's
  environment or be pasted into a local `.env`, a chat transcript, or this
  document. `alpine_client.py`'s existing pattern — read via `os.environ` at
  call time inside `_creds()`, never a module-level constant, never logged —
  is the correct shape and should be reused unchanged for any (b) probe.
- **Rate limits**: 5 req/sec / 120 req/min / 2,000 req/hr per Alpine's own
  published limits (confirmed independently by both the marketing-analytics
  skill doc and the 2026-09-10 census's throttle choice); no rate-limit
  response headers exist to read back, so a fixed client-side floor
  (`alpine_client.py`'s `MIN_INTERVAL_S = 0.5`) is the only enforcement lever.
  A handful of new-path guesses under (b) is trivial against these limits.
- **PII minimization for route (c)**: `adjustments` and `redemptions` rows
  carry `phone`, `name`, and `email` on **every row**, with no way to request
  them without that PII (per the census, §2 above). Any inference work must:
  hash or discard PII fields the instant a row is read (as `import_alpine.py`
  already does per `alpine_client.py`'s own docstring), never persist raw
  phone/email/name, and never expand the contact sample size beyond what a
  specific inference question actually needs.
- **Never write to Alpine**: every route above is read-only by design.
  `alpine_client.py` enforces this by construction (no function builds a
  PUT/POST/DELETE). Any (b) probe script must be built the same way — no
  write helper function should exist in the file at all, not just "unused."
  The known write endpoints already in production code (`/api/v2/loyalty`,
  `/api/v1.1/adjust/loyaltyPoints/...`, `/api/v1.1/optin/...`,
  `/api/v1.1/contact/referral/...`) must not be called by any config-read
  tooling, ever, even to "test" them.
