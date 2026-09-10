# Engage unification — plan and contract (Phase 0: for approval)

Prepared 2026-09-10. Companion: `docs/ENGAGE-CONCEPT-BRIEF-2026-09-10.md` (the four
explorations), `scratch/engage-inspiration-digest-2026-09-10.md` (industry survey).

## 0. Rulings (owner, 2026-09-10) and what they settle

| # | Ruling | Consequence |
|---|---|---|
| R1 | Our platform owns loyalty; Alpine IQ imported then retired | We build the ledger, consent, tiers, rewards, referrals; an Alpine importer with run reports; production's eight Alpine call sites are replaced by our service |
| R2 | SMS = short body + our landing page | We build short links, landing-page render, per-recipient tokens, STOP/consent handling; the SMS body never carries cannabis content |
| R3 | Six sections; Engage merges into the POS estate; Members CRM is the one member module, updated; loyalty screens live in the POS | Engage app keeps Audiences · Messages · Journeys · Insights; Customers = `athome/crm.jsx` updated; Loyalty = new POS screens; one rail, one switcher |
| R4 | Per-page toggle for the 21+/state gate on landing pages; storefront gate-free (D-024a) | `landing_pages.gate_enabled` per page, default off; the storefront untouched |
| R5 | Plan + four concepts before code | This document + `explorations/Engage - Concept A..D` |
| — | Register screen never modified (standing) | Register integration through the POS Home card, the member panel component, and `pos/payment.jsx` |

Standing rules also apply: "honest zero over fabricated number"; every new `.jsx` an IIFE
leaking declared globals; tokens only; wm-demo is Python 3.9 stdlib + SQLite; secrets never in
chat; fixtures carry no customer PII (phones and emails hashed or blanked).

## 1. What exists today (measured, file:line in the mapper reports)

- **Engage** (`engage/*.jsx`): 40 screens, zero backend calls, PRNG demo data frozen at
  2026-04-20; audience builder has a real rule DSL but no persistence; flows are a vertical list
  with no save; the email/landing-page builder does not exist (copy only); 27 of 71 buttons inert.
- **Promotions Suite** (`promo/`, `pweb/`): four rule editors writing one draft that is never
  persisted; backend `internal_promos` has no audience, stores, stacking, priority, limits or
  points; Weedmaps deals are pull-only by design (no push endpoint exists).
- **POS**: register attaches a customer client-side only; the sale POST carries `customer_name`
  and no id; `pos_sales` has no customer column; points/wallet are mock fields on `HW.MEMBERS`;
  real identities (`hw_identities`) carry no balances by design; `PROMO_CODES` hardcoded in the
  cart. Four incompatible tier ladders (register 300/1000/2000; consumer app 1000/2500/3500;
  Engage Seed…Diamond; contract bronze…platinum).
- **Production** (Hyper-Tech repos, read-only): loyalty entirely in Alpine IQ (project id
  hardcoded in eight places; balance read by phone search per call; redemption calls a
  client-supplied URL; adjust-points route unauthenticated); no consent, segment, campaign or
  journey entity anywhere; SMS via Aircall with hardcoded text; promotion-engine has a rich rule
  vocabulary (cart · product · user · bogo · time · payment) but no store/channel scope, no auth,
  order-dependent stacking; three tier vocabularies that never map; identity join is
  `cuid ⇄ memberId ⇄ contactID` resolved by live vendor calls, never stored together.
- **Prior scope work** (`~/Hyperwolf Intelligence/scope/`): a detailed loyalty/messaging design
  (event-sourced ledger, five-state tiers, policy chain with persisted verdicts, hash-chained
  consent, short-link + landing page, MJML email) that was never built; it lacks store/channel
  redemption scoping and a journeys builder. This plan adopts its data-model decisions where
  they fit stdlib SQLite and drops its multi-tenant SaaS framing (one estate, many stores).

## 2. Architecture — one spine, four surfaces

```
                 ┌──────────────── platform services (wm-demo now; production port later) ────────────────┐
                 │  identity   ledger   consent   audiences   messages   journeys   promotions   links     │
                 └───────┬────────┬────────┬─────────┬──────────┬──────────┬──────────┬──────────┬───────┘
   POS (register via     │        │        │         │          │          │          │          │
   Home card + member ───┴────────┴────────┘         │          │          │          │          │
   panel + payment)                                  │          │          │          │          │
   Members CRM (Customers) ──────────────────────────┘          │          │          │          │
   Engage (Audiences · Messages · Journeys · Insights) ─────────┴──────────┴──────────┘          │
   Promotions Suite (rule editor shared with loyalty earn/reward rules) ─────────────────────────┘
   Landing pages (public, short links) ◄── messages ──────────────────────────────────────────────┘
```

**One customer identity.** `hw_identities` is the customer row (it already holds
`phone_e164`, `pos_customer_id`, `wm_ids`, verification). We add `customer_id` to the contract
Order and to `pos_sales`, resolved at tender through the existing identity ladder
(`identity_match.match`: phone → name+dob → address → gov-id hash → wm ids). The register keeps
its local attach; the POST now carries the id. Production mapping: `customer_id` ⇄
`blazeusers.userData.memberId` (POS) and `cuid` (web) stored as `external_ids[]` on the identity
(contract `ExternalId` already exists), so a future Alpine `contactID` or Klaviyo profile id is
just another external id.

**One ledger.** `loy_ledger` append-only: `(id, customer_id, delta, currency='points', reason,
state pending|active|spent|expired|canceled, source_type, source_ref, store_id, channel,
expires_at, created_at, actor, idempotency_key UNIQUE)`. `loy_wallet` caches balance per customer
with nightly reconciliation (the Bounty ledger pattern: cached rollup, recomputable, never the
truth). Earn happens on `/api/pos/sale` and `/api/contracts/orders` (idempotent on order id);
refunds write paired negatives; expiry sweep hourly, FIFO.

**One rule language.** Loyalty earn rules, reward eligibility, audience predicates and
promotions share the JSON condition DSL the Promotions Suite and audience builder already use
(`{path, op, value}` with `$and/$or`, ops `$gte $gt $lte $lt $eq $ne $in $nin $within_days`),
extended with two scope paths every rule may carry: `store_id ∈ […]` and
`channel ∈ {in_store, delivery, pickup, web}`. Paths are validated at save against one trait
catalog (customer, order, cart, product, time, store). The production promotion-engine's
attribute names are the catalog's aliases so a rule exported to production compiles there
(`cart_total`, `days_since_last_purchase`, `purchase_count`, `loyalty_tier`, `upcoming_birthday`,
`category_id`, `product_brand`, …); attributes production lacks (store, channel) are added to the
compatibility note for the dev team rather than dropped.

**One block builder.** Email and landing pages are the same JSON document
(`{blocks:[{type, props, children}], theme, merge_tags_required}`) rendered server-side to HTML
by one renderer (table-based email HTML for email, responsive HTML for pages); ≤ 12 block types
(heading, text, image, button, divider, spacer, columns, product card, reward card, points
balance, legal footer, gate). Saved sections are documents too. No third-party builder.

**One prompt path.** A "smart prompt" composes a whole promotion (or audience, or earn rule)
from plain words: the model proposes an interpretation (who / what / reward / where / when /
guardrails) built only from parameters in the trait catalog; the catalog validates it (never
raw SQL, never free code); the marketer edits it in the concept's native control; live numbers
show reach and cost; a parameter the system lacks becomes a "create it from this field" card
(a derived-parameter row: name, source field, expression, type) rather than a dead end; the
prompt and interpretation are stored on the promotion for audit. Spec:
`docs/ENGAGE-PROMPT-PROMO-SPEC.md`. The four concepts show four entry UIs over the same spine
(grounded typeahead sentence · goal → three candidates · example-driven · co-pilot panel).

**One canvas.** Journeys are graphs: `journeys(id, name, status, trigger, version)`,
`journey_nodes(id, journey_id, kind trigger|wait|branch|message|loyalty|exit, props JSON, x, y)`,
`journey_edges(from, to, label)`, `journey_runs(customer_id, journey_id, node_id, state, wake_at)`.
A campaign is a journey with one message node and a one-shot audience trigger, so campaigns and
journeys share the runner, the policy chain and the reporting.

**One policy chain** before any send (persisted verdict per message): identity → suppression →
consent → gate/geo → frequency cap (4/7d, 20/30d per channel) → quiet hours (8am–8pm recipient
local, held not blocked) → content policy (SMS body template only; no cannabis words, price,
imagery) → provider. Verdicts are rows; nothing is silent.

**Short links + landing pages.** `links(token, message_id, customer_id, landing_page_id,
expires_at, clicks)`; `GET /l/<token>` (HEAD ignored for click counting, GET counted) renders the
page with merge tags, the page's `gate_enabled` toggle, STOP/unsubscribe, attribution cookie.
Served by wm-demo now; production port is a Next.js route (`/l/[token]`) rendering the same JSON
document with the same renderer (JS twin of the Python renderer, one fixture, like the naming
engine).

**Providers behind adapters** (`msg_adapter`): SMS (Twilio-compatible REST via `urllib`, "customer
care" registration; STOP/HELP inbound webhook), email (SendGrid v3 or Postmark; RFC 8058
one-click unsubscribe; bounce/complaint webhooks → suppression), wallet pass (Apple PassKit /
Google Wallet, phase 2), push (phase 2). The adapter interface is the same shape as
`llm_adapter.py` and the Bounty vendor clients: `send(message) -> {provider_id, status}`,
`status(provider_id)`, `inbound(payload)`. Keys in `.env` by the owner via the dialog script.

## 3. Data model (wm-demo, `wmdemo/engage/schema.py`)

```
customers            = hw_identities (+ columns: email_hash, dob, favorite_store_id, timezone,
                       tags JSON, external_ids JSON, created_source)
consents             (id, customer_id, channel sms|email|push|wallet, state granted|revoked|pending,
                      source pos|web|sms_reply|csr|import, legal_text_sha, ip, ua, message_id,
                      prev_hash, row_hash, at)                      -- append-only, hash-chained
suppressions         (customer_id, channel, reason bounce|complaint|stop|manual, at)
loy_programs         (id, name, currency, earn_rules JSON[], expiry_policy JSON, tier_policy JSON,
                      active)
loy_tiers            (id, program_id, name, entry_rule JSON, maintain_rule JSON, grace_days,
                      benefits JSON, sort)
loy_tier_memberships (customer_id, tier_id, state earning|qualifying|maintaining|grace|degrading,
                      since, evaluated_at)
loy_ledger, loy_wallet                                              -- §2
loy_rewards          (id, program_id, name, kind pct|amount|free_product|bonus_points|perk,
                      value JSON, cost_points, eligibility_rule JSON, stores JSON, channels JSON,
                      stock, per_customer_cap, window_days, active, sort)
loy_redemptions      (id, reward_id, customer_id, code UNIQUE, state issued|applied|expired|refunded,
                      store_id, channel, order_ref, issued_at, applied_at, expires_at)
referral_programs, referrals (code, referrer_id, referee_id, state, risk JSON, qualified_at)
audiences            (id, name, rule JSON, mode dynamic|static, size, size_at, refresh_s,
                      created_by, updated_at)
audience_members     (audience_id, customer_id, computed_at)         -- static snapshots + cache
documents            (id, kind email|landing|section, name, doc JSON, version, updated_by)
landing_pages        (id, document_id, slug, gate_enabled, gate_min_age 21, gate_states JSON,
                      footer_policy, status)
messages             (id, journey_id, node_id, campaign_name, channel, template_doc_id,
                      sms_body_template, audience_id, schedule JSON, status, created_by)
message_sends        (id, message_id, customer_id, channel, provider, provider_id, state
                      queued|held|blocked|sent|delivered|failed|opened|clicked|converted,
                      verdicts JSON, hold_until, sent_at, delivered_at)
links                (token, send_id, landing_page_id, expires_at, clicks, first_click_at)
journeys, journey_nodes, journey_edges, journey_runs                 -- §2
promotions           = the Promotions Suite draft, persisted at last: (id, name, code, status,
                      rule JSON, action JSON, stores JSON, channels JSON, stackable, priority,
                      usage_limit, per_customer_limit, starts_at, ends_at, audience_id)
events               (id, type, customer_id, store_id, channel, ref, payload JSON, at)
                     -- order.completed, cart.abandoned, points.earned, points.redeemed,
                        tier.changed, consent.changed, message.sent/clicked, referral.qualified
engage_events        audit of every operator write (actor, before, after)
```

Trait catalog (derived nightly + on event, cached in `customer_traits`): lifetime orders/spend,
last order at, order frequency (median gap) and **frequency drop ratio** (the "ordering less
often" trigger), AOV, favorite store, favorite category/brand, points, tier, consent per
channel, days to birthday, referral count, churn risk (rule-based RFM now; model later).

## 4. API contract (wm-demo; all writes gated as today; manager-only where noted)

```
Identity   GET  /api/engage/customers?query&audience&store          POST /api/engage/customers/<id> (edit, merge, tags)
           GET  /api/engage/customers/<id>  -> record: identity, external_ids, consent, wallet, tier,
                                              rewards usable {here|delivery|in_store}, orders, audiences,
                                              messages, referrals
Consent    POST /api/engage/consent  {customer_id, channel, state, source, legal_text}  (append-only)
           POST /api/engage/inbound/sms   (STOP/HELP/START webhook)   POST /api/engage/inbound/email (bounce/complaint)
Ledger     POST /api/engage/points/earn|redeem|adjust {customer_id, delta, reason, source_ref, store_id, channel,
                                                      idempotency_key}   adjust = manager
           GET  /api/engage/points/<customer_id>  -> balance, expiring, history
Loyalty    GET/POST /api/engage/loyalty/programs, /tiers, /rewards (manager on write)
           GET  /api/engage/loyalty/rewards/usable?customer_id&store_id&channel   <- register and web use this
           POST /api/engage/loyalty/redeem {reward_id, customer_id, store_id, channel, order_ref}  (atomic: stock, ledger, redemption)
           POST /api/engage/loyalty/redeem/refund {redemption_id}
Audiences  GET/POST /api/engage/audiences ; POST /audiences/preview {rule} -> {size, sample[5], rationale}
           POST /api/engage/audiences/from-prompt {prompt} -> {rule, sentence, size}  (llm_adapter; rule validated; never SQL)
Documents  GET/POST /api/engage/documents ; POST /documents/<id>/render {customer_id?} -> html
Landing    GET/POST /api/engage/landing-pages ; GET /l/<token>  (public)
Messages   GET/POST /api/engage/messages ; POST /messages/<id>/check -> policy summary (consent coverage, holds, blocks)
           POST /messages/<id>/test-send ; POST /messages/<id>/send (manager)
Journeys   GET/POST /api/engage/journeys ; POST /journeys/<id>/activate|pause ; GET /journeys/<id>/report
Promotions POST /api/promos/internal (persist the Suite's draft: rule, action, stores, channels, stacking, limits, audience)
           POST /api/promos/from-prompt {prompt, refine_of?} -> {interpretation, rule, action, scope, numbers, parameters_used[], missing_parameters[]}
           POST /api/engage/parameters {name, source_field, expression, type}  (derived parameter; manager)
           GET  /api/promos/eligible?customer_id&store_id&channel&cart  -> applied promotions (replaces PROMO_CODES)
Import     POST /api/engage/import/alpine {kind contacts|loyalty|consents|campaigns, dry_run}  run report invariant
Insights   GET  /api/engage/insights?range -> four numbers + one list (per section), never a wall of tiles
```

Register → platform (through `pos/payment.jsx` and the member panel, never the register file):
`customer_id` on the sale; `points_redeemed`, `reward_codes[]`, `wallet_cents`; the response
returns `points_earned`, new balance, tier change. Dev call-outs on screen state what production
must send.

## 5. Surfaces

- **Members CRM (Customers)** — `athome/crm.jsx` rewired to `/api/engage/customers`; the
  record becomes a shared component `window.MemberRecord` used by the CRM, the Engage customer
  views and the POS member lookup (one component, three mounts).
- **POS Loyalty** — new `pos/screen-loyalty-*.jsx` (program, tiers, rewards with store/channel
  chips, referrals, wallet pass), rail item under the existing POS nav; Home card shows the
  four loyalty numbers.
- **Engage** — `engage/` rebuilt to four sections (Audiences, Messages, Journeys, Insights) plus
  the gear; `Hyperwolf Engage.html` loads `shared/hw-live.js`; all data from `/api/engage/*`.
- **Promotions Suite** — the rule editor persists to `/api/promos/internal`; the audience picker
  reads Engage audiences; the reward kinds use the loyalty catalogue; the cart's promo apply calls
  `/api/promos/eligible`.
- **Landing pages** — public route on wm-demo now; Next.js twin spec for production.

## 6. Compatibility with production (copy-paste path)

Delivered as `docs/ENGAGE-COMPAT.md` in Phase 1: for each of our tables/routes, the production
counterpart (`blazeusers`, `members`, `orders.alpineIQPoints`, promotion-engine rule types,
`/api/v1/alpine/*`, SendGrid/Aircall), the field mapping, and the gaps the dev team must add
(customer_id on orders; consent table; points ledger; store/channel attributes in the engine;
auth on promotion routes). Contract types go into `contracts/` (already the estate's shared
type package) so drift tests fail on rename. Money stays cents in our estate and is converted at
the adapter boundary (production uses dollars).

## 7. Security (non-negotiable, each with a probe)

Auth on every write (write token now; real actor auth attaches at one function);
manager-only for ledger adjust, reward config, sends, journey activation; idempotency keys on
every money/points write; append-only consent with hash chain; PII at rest hashed where a hash
suffices (email/phone lookups by hash) and never in fixtures; landing-page tokens 10-char
random, single-recipient, expiring; HEAD ignored for clicks; inbound webhooks signature-checked;
rate limits on public routes (`/l/`, inbound); no raw SQL from prompts, rules validated against
the catalog; provider keys only in `.env`; audit row on every operator write.

## 8. Phases and gates

| Phase | Deliverable | Gate |
|---|---|---|
| 0 | This plan + four concepts | Owner picks a concept |
| 1 | Spine: identity join (customer_id on sale), ledger, consent, trait catalog, rewards with store/channel scope, redeem/refund atomic, Alpine importer (dry run report), Members CRM rewired, POS member panel + Home card, payment.jsx earn/redeem | Probes green; register untouched; owner reviews the CRM record and a real earn on the demo register |
| 2 | Audiences (rule + prompt), documents + renderer (py + js twins), landing pages + short links + gate toggle, messages + policy chain + adapters (SMS, email), Engage rebuilt to four sections | Test send to owner's phone/email via his keys; owner approves the builder |
| 3 | Journeys canvas + runner (frequency-drop trigger, waits, branches, loyalty nodes), campaigns as one-node journeys, insights | A win-back journey runs end to end on demo data |
| 4 | Promotions persistence + eligibility route replacing hardcoded cart codes; compatibility doc + contract types; wallet pass | Cart applies a persisted promotion; compat doc reviewed |

**Before any push (owner, 2026-09-10): demo data becomes real stores.** Engage today shows
fake tenants (Green Leaf Collective, Oaktown Dispensary, Harbor Cannabis Co.) and PRNG
customers. The first push replaces the tenant switcher with the estate's store switcher
(`window.HW_STORES`: Corona, Lake Elsinore, West Hollywood, Long Beach, Riverside, and any store
the registry adds), removes `TENANT`/`TENANTS` and the "Provision new tenant" affordance, and
seeds nothing invented: customers come from `hw_identities`, orders from `pos_sales`/contract
orders, products from the catalogue; where a number is not real yet the screen says so.

Each phase: adversarial refute (numbers, safety, blast radius) before "done"; status note
`docs/ENGAGE-STATUS.md`; commits with explicit paths; push only on approval.

## 9. Escalations (owner decisions still open)

- Provider choice for SMS and email (Twilio + SendGrid assumed; keys needed for Phase 2).
- Tier ladder of record (four exist); proposal: Bronze 0 · Silver 500 · Gold 2,000 · Platinum
  6,000 points with grace 90 days — confirm or replace.
- Alpine export access for the importer (API key scope or CSV).
- Whether the storefront (production Next.js) renders landing pages from day one or after the
  wm-demo route proves the renderer.
