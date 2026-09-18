# SMS provider plan — who sends Engage's texts, and how

Prepared 2026-09-17, per the owner's "plan and find a solution together" ask. Companion:
`docs/LOYALTY-INTEROP-PLAN-2026-09-17.md` (Alpine/Blaze interop — read first; this plan assumes
its D15 posture: **Alpine keeps running during transition, Engage takes over sending after
cutover**, not a hard replace). Also assumes `docs/ENGAGE-PLAN-2026-09-10.md` ruling **R2**: "SMS
= short body + our landing page... the SMS body never carries cannabis content" (line 11) — this
plan does not re-litigate that ruling, it builds the provider choice around it.

External research below is public web material, current as of 2026-09-17; vendor claims are
marked as such. No provider API was contacted. No `.env`/credential file was read.

---

## 1. What exists today (from source, cited)

| Item | Finding | Source |
|---|---|---|
| **Current marketing/loyalty SMS sender** | Alpine IQ. Confirmed live in `LOYALTY-INTEROP-PLAN-2026-09-17.md` §1 (`getWolfPack`, `user-cart-controllers.js:995-1075`) and its own §3.1 ("Alpine's own SMS/email sends"). No campaign-trigger API was found for Alpine in that census — unconfirmed whether Engage can ask Alpine to fire a send at all. | `POS-Admin/docs/LOYALTY-INTEROP-PLAN-2026-09-17.md:81-83` |
| **Current operational (delivery) SMS sender** | Aircall, not TextVolt despite the file name. `airCallMethod` (`hyperwolf-backend/common/utils.js:1584`) POSTs to `/numbers/${airCallSendNumber}/messages/native/send` (`:1598`), Basic-auth via `AIRCALL_USERNAME`/`AIRCALL_PASSWORD` (`:71-72`). `textVoltMutationMethod` (a real GraphQL `createMessage` call, `utils.js:1141`) exists but **every call site is commented out** (`textVolt-controllers.js:48,88,149`; also dead at `blaze-integration-controllers.js:749,1064`, `weedmap-controllers.js:60`). | `POS-Admin/docs/ENGAGE-COMPAT.md:60` |
| **TextVolt's actual live use (a different business line)** | `hyperdrive-backend`/`stilo-backend`: delivery-failure SMS via TextVolt's GraphQL API (`common/util.js:281-300`, `TEXT_VOLT_URL`/`TEXT_VOLT_BEARER_TOKEN`), called from `controllers/tasks/task-controller.js:967-977`. Sender number is **hardcoded** (`"from": "+12136910347"`, `util.js:273` — "should be config"), and **send failures are silently swallowed by an empty `catch`** — the exact "watch the output, not just the exception" failure shape this estate's CLAUDE.md §4.7 warns about. Three more hardcoded phone literals at `textVolt-controllers.js:19/67/100` include a test number (`+11111111111`) wired into live control flow. | `POS-Admin/docs/codebase-audit/repos/hyperdrive-backend.md:176,232`; `POS-Admin/docs/codebase-audit/repos/hemp-backend.md:362` |
| **So: TextVolt was never the loyalty/marketing sender in this codebase** — it is (was) delivery-ops SMS for a different vertical (hemp/stilo, not Hyperwolf retail). If the owner's "previously used Textvolt" memory is about marketing sends specifically, that path is not visible in any repo scanned; flag as a gap, not a contradiction — Textvolt account history predates this codebase or lived outside these repos. | — | (no citation — explicitly not found) |
| **GAS estate** | "There is **no SMS sender in this estate** (no Twilio); ConnecTeam's activation SMS is the only outbound text GAS itself triggers" — confirmed by grep across the whole GAS repo (`gas-projects`), nothing resembling a provider integration beyond that. | `.../gas-projects/SB1553-NOTICE-PLAN.md:302` |
| **Engage's own adapter (already built)** | `wmdemo/engage/msg_adapter.py` — a vendor-agnostic seam, same shape as `llm_adapter.py`. `get_adapter("sms")` returns `TwilioLikeAdapter` only if `TWILIO_BASE_URL`/`TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_FROM_NUMBER` are **all** set (`msg_adapter.py:485-506`); otherwise `NullAdapter` (never raises, records the send locally, opens no socket — `:190-243`). Credentials are read from `os.environ` only inside each method call, never at import (`:13-21`), so probes can exercise every code path with zero network access. Inbound STOP/HELP dedupe already exists (`already_processed`/`mark_processed` against `engage_events`, keyed on the provider's own event id — `:109-137`), and HMAC signature verification for both a Twilio-shaped (`verify_twilio_signature`, HMAC-SHA1, `:524-546`) and SendGrid-shaped (`verify_sendgrid_signature`, HMAC-SHA256 with a timestamp-skew window, `:549-582`) inbound webhook is implemented and unit-tested (`ENGAGE-BUILD-CONTRACT.md:544,560`). | `wm-demo/wmdemo/engage/msg_adapter.py` (full file read) |
| **Content policy already decided** | The policy chain that runs before any send: "identity → suppression → consent → gate/geo → frequency cap (4/7d, 20/30d per channel) → quiet hours (8am–9pm recipient local, held not blocked) → content policy (SMS body template only; **no cannabis words, price, imagery**) → provider." This independently matches the public research below almost verbatim — it was designed before this research pass, not after. | `POS-Admin/docs/ENGAGE-PLAN-2026-09-10.md:113-115` |
| **No consent/suppression table anywhere in production** | Confirmed by direct grep across all twelve Hyper-Tech repos: no consent table, no bounce/complaint suppression list, no inbound STOP/HELP webhook found in any repo. Today's "opt-in" is a fire-and-forget PUT to Alpine (`alpineUserRegister`, `common/utils.js:1283-1284`) with no state row, no source, no legal-text hash, no way to prove consent later. | `POS-Admin/docs/ENGAGE-COMPAT.md:53,59` (§1.3, §1.4) |
| **Providers are an owner decision, not a code change** | `ENGAGE-STATUS.md` says this explicitly: `msg_adapter.get_adapter` is env-key-gated; every verification in the current build used `NullAdapter`, no real key was ever used or requested. | `POS-Admin/docs/ENGAGE-STATUS.md:184,225-229` |

**Net finding:** Engage's adapter, content-policy chain, and inbound-webhook-signature machinery
are already built and already shaped correctly for a cannabis SMS program (short body, no
cannabis words/price/imagery, STOP/HELP handling, idempotent sends). What is genuinely undecided
is **which real provider's keys go into `TWILIO_*`-shaped env vars** — and, per the research
below, Twilio itself is not eligible for that role.

---

## 2. The regulatory landscape

### 2.1 Federal: TCPA, CTIA, 10DLC, toll-free, short code

- **TCPA** (Telephone Consumer Protection Act) requires prior express written consent for
  marketing texts, immediate honoring of STOP, and exposes **$500 per violation, up to $1,500 for
  willful/knowing violations** — assessed **per message**, not per campaign. A single class of
  10,000 recipients can expose $5M+ in liability, and plaintiffs don't have to prove harm, which
  is why cannabis dispensaries specifically have been targeted by a wave of TCPA class actions.
  [TCPA Violation Fines and Penalties](https://www.fransis.ai/articles/tcpa-violations-penalties-explained),
  [Amundsen Davis — cannabis TCPA exposure](https://www.amundsendavislaw.com/cannabis-business-legal-news/protecting-your-cannabis-business-from-the-trappings-of-the)
- **CTIA** publishes carrier-facing "Messaging Principles and Best Practices" — separate from
  TCPA, and a program can be fully TCPA-compliant while still getting carrier-blocked for failing
  CTIA norms (double opt-in, STOP/HELP support, quiet hours, frequency discipline). [CTIA
  guidelines explained](https://10dlccheck.com/learn/ctia-guidelines-explained),
  [Bloomreach — TCPA vs CTIA](https://www.bloomreach.com/en/blog/understanding-tcpa-and-ctia-compliance-for-sms-marketing-in-the-us)
- **10DLC / The Campaign Registry (TCR)**: since Feb 2025, all major US carriers block SMS/MMS
  from unregistered 10DLC numbers outright. Registration classifies traffic into content
  categories; **cannabis sits alongside the "SHAFT" list (Sex, Hate, Alcohol, Firearms, Tobacco)
  plus cannabis, gambling, payday loans** as content most carriers will not register at all, or
  only under heavy restriction — a dispensary URL or cannabis term in the message body alone can
  get a whole campaign blocked. [Textbolt 10DLC guide](https://textbolt.com/blog/10dlc-compliance/),
  [cannabisregulations.ai — 10DLC reality check](https://www.cannabisregulations.ai/cannabis-and-hemp-regulations-compliance-ai-blog/10dlc-cannabis-hemp-texting-2025)
- **Toll-free verification**: required before sending to US/Canada numbers or messages are
  blocked outright; **from Jan 1, 2026, new verifications require a Business Registration Number
  (EIN), issuing country, and entity type** in addition to prior fields.
  [Telgorithm — 2026 toll-free changes](https://www.telgorithm.com/news/toll-free-verification-is-changing-in-2026-heres-what-you-need-to-know)
- **Short codes**: leased through the US Short Code Registry / Common Short Code Administration,
  vetted per-carrier under the CTIA Short Code Monitoring Program Handbook, and subject to random
  compliance audits. Public sources did not surface a definitive current cost/lead-time figure for
  a *cannabis-content* short code specifically (most general guides quote weeks-to-months and
  four/five-figure setup + monthly fees for **non-restricted** content) — treat short code as
  **likely infeasible for cannabis content on standard carrier programs** absent a cannabis-native
  aggregator relationship (§2.2), and confirm with any shortlisted vendor before assuming it's an
  option. [Short code cost guide](https://www.fransis.ai/articles/how-much-does-a-short-code-cost)

### 2.2 What "cannabis-friendly" providers actually do differently

Public sources consistently describe the same mechanism, not a regulatory loophole: cannabis-native
platforms (Springbig, Blackleaf, Sweed, Baker) run their **own proprietary messaging
infrastructure and carrier relationships** instead of reselling a general CPaaS's 10DLC/short-code
programs, and enforce **content rules in the product itself** — no cannabis words in the SMS body
(pre-approved substitute phrasing), no price, no product imagery, link-only calls to action to a
gated landing page. Springbig states it uses its "own proprietary messaging system and APIs"
rather than a general provider like Twilio specifically to keep TCPA/10DLC compliance intact.
[Springbig cannabis messaging](https://springbig.com/cannabis-communications/), [Flowium — top
cannabis SMS platforms](https://flowium.com/blog/cannabis-sms-marketing/). This is exactly the
shape Engage's own policy chain already enforces (§1) — the provider question is really "whose
carrier relationship do we ride on," not "whose compliance product do we adopt," because Engage
already owns the compliance layer.

### 2.3 California-specific: Prop 64 / BPC §26151, CCPA

- **Prop 64 (Bus. & Prof. Code §26151)**: cannabis ads may only run where **≥71.6% of the
  audience is reasonably expected to be 21+**. For **direct, individualized communication**
  (which SMS is) the law requires "a method of age affirmation to verify the recipient is 21 years
  of age or older" — user confirmation, birth-date disclosure, or similar. This is a *stronger*
  bar than the 71.6% broadcast rule and applies to every 1:1 text. [Cannabis Marketing
  Association — CA ad rules](https://thecannabismarketingassociation.com/cannabis-advertising-regulations-in-california/)
  No ads within 1,000 ft of a school/playground/youth center, and no content "attractive to
  children."
- **CCPA**: phone numbers are personal information; the estate's existing consent/PII posture
  (`identity.py`/`consent.py`, `POS-Admin/docs/LOYALTY-INTEROP-PLAN-2026-09-17.md:157-159`)
  already gates on this and should be the CCPA control point for SMS too — nothing new to invent.

### 2.4 Consent, opt-out, and quiet hours — the practical checklist

Double opt-in (a confirmation reply, e.g. "Y", before entering the active list) is the CTIA/MMA
recommended standard, because it proves the number's actual owner consented and creates two
timestamped records instead of one. STOP/UNSUBSCRIBE/CANCEL must all work and HELP must return
support contact info; quiet hours are 8am–9pm recipient local time; frequency should match what
was promised at opt-in. [CaptainVerify — opt-in & quiet hours](https://captainverify.com/blog/sms-opt-in-examples-gdpr.html),
[Texty Pro — CTIA/TCPA compliance](https://www.texty.pro/sms-compliance-for-tcpa-and-ctia). All
of this is already Engage's design (§1) — the gap is a real provider to execute it through.

---

## 3. Provider landscape — condensed comparison

General CPaaS (Twilio-class) is **not eligible** for this use case: Twilio's Messaging Policy
(last updated 2026-04-13 per its own support article) states cannabis/CBD messaging is banned in
the US "regardless of the federal or state legality," with no exceptions, and defines a
cannabis-related message as **any message that relates to the marketing or sale of a cannabis
product — even one with no cannabis words, images, or links** (i.e., a "buy one get one" text
from a dispensary counts, even if it never says "cannabis"). [Twilio cannabis support
article](https://support.twilio.com/hc/en-us/articles/1260804628349-Can-I-send-cannabis-or-CBD-related-messaging-traffic-on-Twilio).
Plivo's AUP explicitly forbids SHAFT content including cannabis on any number type. Vonage lists
cannabis/CBD as a restricted category assessed case-by-case (in practice, restrictive). Telnyx's
forbidden-use-cases article groups cannabis with carrier-filtered content categories. Bandwidth
and Sinch have no published cannabis carve-out found in this research — silence here should be
read as "assume restricted," not as tacit permission; confirm directly before building on either.
SlickText and EZ Texting's specific cannabis policies were not found in public sources searched —
also unconfirmed, don't assume.

| Provider | Cannabis policy | Sending route | Notes (marked where a vendor claim) |
|---|---|---|---|
| **Alpine IQ** (current) | Built for cannabis; runs its own network | Proprietary | Already integrated (§1); *vendor claim*: avoids cannabis words via pre-approved substitute phrasing. No confirmed campaign-trigger API for Engage to call (`LOYALTY-INTEROP-PLAN §3.1`) — biggest open question for the "Alpine during transition" posture |
| **Springbig** | Built for cannabis; *vendor claim*: "own proprietary messaging system and APIs," not a Twilio reseller | Proprietary | Direct cannabis-dispensary competitor to Alpine; TCPA suit against Springbig was dismissed on grounds it wasn't the "maker" of the message (a data point on architecture, not a compliance guarantee for us) |
| **Blackleaf** | Built for cannabis (dispensary SMS specialist) | Proprietary | Frequently cited as an Alpine-alternative specifically for SMS deliverability; positions on migration/ROI from Alpine |
| **Sweed** (POS-integrated) | Built for cannabis; *vendor claim*: "tens of millions of cannabis-specific messages/year, 95% delivery" | Proprietary | POS-native messaging, not a fit unless we're also switching POS |
| **Baker (trybaker.com)** | Built for cannabis CRM incl. SMS | Proprietary | CRM-first, not primarily a messaging infra vendor |
| **Blaze Outreach** | Built for cannabis (Blaze's own marketing module) | Proprietary | We already have a Blaze relationship (register/POS); worth a direct question to our Blaze rep since we're already a customer — cheapest diligence path |
| **Twilio** | **Banned** — explicit, no exceptions, defined broadly (any promo/sale-related text, even cannabis-word-free) | 10DLC/toll-free/short code | Already the *shape* Engage's adapter speaks (`TwilioLikeAdapter`) but the account itself cannot be Twilio |
| **Telnyx / Bandwidth / Sinch / Vonage / Plivo / SlickText / EZ Texting** | Restricted-to-unconfirmed across the board; Plivo explicit-ban, Vonage restrictive/case-by-case, others unconfirmed in this research pass | 10DLC/toll-free | Do not build against any of these for cannabis marketing content without a direct written confirmation from the vendor first — a "not found" in this research is not a green light |

**Recommendation for the shortlist to actually diligence (owner decision, §5 Q1):** Alpine IQ
(incumbent, already wired), Springbig, Blackleaf, and Blaze Outreach (existing vendor
relationship = fastest path to a real answer) — all four run proprietary cannabis-native sending
infrastructure rather than reselling a general CPaaS's 10DLC program, which is the actual
differentiator per §2.2, not a marketing claim to take at face value.

Pricing at 20k–100k messages/month, contract terms, SOC 2, and exact API/webhook shape for each
of these four were **not independently verified against vendor documentation in this pass** — the
searches available here surfaced positioning and policy pages, not current rate cards. Getting
real numbers requires either a sales call (which counts as vendor contact, out of scope for this
research-only task) or a documentation deep-dive on each vendor's own developer docs as a
follow-up.

---

## 4. Number strategy

- **Transactional/operational** (order-ready, delivery-arriving): highest deliverability need,
  lowest regulatory risk (transactional traffic is not marketing, still needs TCPA consent but not
  cannabis-content restrictions apply the same way since it's account-servicing, not marketing) —
  best fit is a **10DLC or toll-free number on whichever adapter already handles delivery ops**
  (Aircall today, §1) — do not route this through the same number/campaign as marketing.
- **Loyalty/marketing (Engage)**: this is the cannabis-restricted content class — must go through
  a cannabis-native proprietary route (§2.2, §3), never a standard carrier 10DLC/toll-free/short
  code campaign under current carrier and 10DLC policy.
- **Short code**: likely not obtainable for cannabis-marketing content on any standard program
  (§2.1); only relevant if a cannabis-native vendor offers one on their own aggregator
  relationship — ask, don't assume.
- Engage's `msg_adapter.py` architecture (§1) is number-and-provider-agnostic already — whichever
  vendor is chosen, the `TwilioLikeAdapter`'s env-var shape (`*_BASE_URL`/`*_ACCOUNT_SID`/
  `*_AUTH_TOKEN`/`*_FROM_NUMBER`) is a reasonable template to point at a cannabis-native vendor's
  REST API **if** that vendor exposes a Twilio-compatible-enough shape; if not, a new adapter class
  in the same file (same interface: `send`/`status`/`inbound`/`describe`) is a contained, additive
  change — not a rewrite.

---

## 5. Architecture, migration, and monitoring

**Architecture (already built, confirmed in §1):** Engage owns consent, templates, audiences,
policy chain, and the send ledger (`message_sends`, journaled and idempotent per
`_insert_or_get_send_row`, `msg_adapter.py:140-167`); the provider sits behind `msg_adapter.py`'s
adapter interface, swappable without touching any caller. Inbound STOP/HELP and delivery-receipt
webhooks are signature-verified before any write (`verify_twilio_signature`/
`verify_sendgrid_signature`) and deduped by the provider's own event id
(`already_processed`/`mark_processed`). This is exactly the "adapter, journaled, idempotent,
SSRF-safe" shape the task called for — it already exists; the missing piece is which vendor's
keys go in.

**Migration path — "Alpine during transition, Engage after cutover"** (the posture the owner
already picked, per `LOYALTY-INTEROP-PLAN-2026-09-17.md` D15): Alpine's own SMS/email sends keep
running for acquisition and loyalty-triggered campaigns until Phase 0/1 of that plan closes
whether Alpine even has a campaign-trigger API (unconfirmed, §3.1 of that doc). If it doesn't,
Engage's `msg_adapter.py` sends loyalty-triggered messages directly the moment a real provider is
wired — no code change needed there, only a provider decision and keys. Opt-in export: Alpine's
own opt-in state (`alpineUserRegister`'s fire-and-forget PUTs, §1) has no source/timestamp/legal
text on record, so a straight "re-consent required" posture is safer than "carry over silently" —
this mirrors the same 1:1-import-but-honest-provenance principle the loyalty plan already applies
to points balances (`LOYALTY-INTEROP-PLAN §6`, "imported, source unknown" rather than guessing).
No silent gap: both channels (Alpine sends, Engage sends once wired) can run in parallel during
the transition rather than a hard cutover date, exactly like that plan's own Phase 2 "mirror mode,
time-boxed."

**Monitoring / kill switches:** delivery rate, opt-out rate, and complaint rate per the estate's
own §4.7 standing rule ("watch the output, not just the exception") — a provider that silently
degrades delivery without throwing is the same failure shape as the TextVolt empty-`catch` bug
already found in this codebase (§1). `providers_off()` (`msg_adapter.py:473-482`) is already a
global kill switch usable in production the same way it's used in tests today — flip one env var
to force every send back to `NullAdapter` during an incident.

**Cost model:** cannot be sized honestly without real vendor pricing (§3) — this is the first
Phase 0 item, not a number to guess here.

---

## 6. Security and privacy

- Phone numbers are PII: the estate's existing `identity.py`/`consent.py` pattern already gates
  writes on `consent.check()` (`LOYALTY-INTEROP-PLAN §6`) — the SMS provider adapter must call
  through the same gate, never bypass it for a "just this once" send.
- Consent evidence retention: Engage's `consents` table is append-only and hash-chained
  (`ENGAGE-PLAN-2026-09-10.md` data model, `docs/ENGAGE-PLAN-2026-09-10.md` §3) — this is the
  system of record for "can we prove this person opted in," which today's Alpine fire-and-forget
  PUT cannot answer at all (§1).
- Rate limits: `msg_adapter.py`'s frequency-cap policy-chain step (§1) is the application-level
  control; the provider's own API rate limits are a second, independent control to respect
  (mirrors Alpine's own jittered-backoff pattern already used elsewhere in this estate, per
  `LOYALTY-INTEROP-PLAN §6` security requirements).
- Template injection / link-shortener abuse: the landing-page link (`links.py`, per-token,
  expiring, rate-limited — `ENGAGE-STATUS.md`) is already built with per-token and per-IP rate
  limits; any new provider's own link-shortening feature (if it has one) should be disabled in
  favor of Engage's own token so abuse monitoring stays in one place, not split across two
  systems.
- **Provider keys are entered only by the owner** — this project's own standing rule
  (`ENGAGE-BUILD-CONTRACT.md:563`, `MEMORY: jt-handles-no-deployments`) and this plan changes
  nothing about that: whichever vendor is chosen, Claude does not receive, request, or handle the
  API key.

---

## 7. Owner questions

**Q1.** Which provider(s) should we actually get real pricing/contract terms from next (the
diligence this research pass could not do — no vendor contact was made)? (Select one or more.)
A) **Alpine IQ** (incumbent — ask specifically about a campaign-trigger API, since none was found
in the interop census; this closes a real gap either way) **[recommended, alongside C]**
B) Springbig (leading cannabis-dedicated competitor to Alpine, proprietary network)
C) Blackleaf (cannabis SMS specialist, markets directly against Alpine on deliverability)
**[recommended, alongside A]**
D) Blaze Outreach (we're already a Blaze customer — fastest path to a real quote and terms, worth
asking regardless of the other three)

**Q2.** Number/routing strategy for marketing SMS, given that standard 10DLC/toll-free/short-code
programs treat cannabis content as restricted-to-banned (§2.1, §3)?
A) Route marketing SMS only through a cannabis-native proprietary vendor's own network (never
attempt 10DLC/toll-free/short code for marketing content ourselves) **[recommended]**
B) Keep operational/delivery SMS on our existing Aircall/10DLC-style path, marketing SMS on the
cannabis-native vendor — two separate numbers, two separate senders
C) Attempt our own 10DLC registration for marketing SMS anyway, accepting the risk of rejection or
after-the-fact carrier blocking
D) Something else (say what)

**Q3.** Migration posture for Alpine's existing opt-ins, given that Alpine's own consent records
have no source/timestamp/legal-text-hash on file (§1, §5)?
A) Treat every existing Alpine opt-in as "unknown provenance" and require fresh double opt-in
before Engage ever sends to that number **[recommended — matches the loyalty plan's own "honest
provenance over guessed carryover" principle]**
B) Carry over Alpine's opt-in state as-is with no re-confirmation, accepting the legal risk that
we can't prove consent for numbers imported this way
C) Carry over opt-ins only for customers with a recent (e.g. 90-day) purchase, re-confirm
everyone else
D) Something else (say what)

**Q4.** Timing: should Engage start sending loyalty-triggered SMS itself as soon as a real
provider is wired, or wait for Alpine's campaign-trigger-API question (§5 of the loyalty plan) to
resolve first?
A) Wire the provider now; Engage sends directly the moment keys exist, regardless of what Alpine
turns out to support **[recommended — matches D15's "Engage is the loyalty engine" posture and
doesn't block send-capability on an unrelated Alpine API question]**
B) Wait for the Alpine campaign-trigger-API answer before wiring any new provider, in case Alpine
can just be asked to send instead
C) Run both in parallel indefinitely (Alpine sends its own campaigns, Engage sends everything
else) with no forced convergence date
D) Something else (say what)

**Q5.** Toll-free numbers require new EIN/entity-type verification info starting Jan 1, 2026
(§2.1) if we end up needing any non-marketing toll-free number (e.g. for operational SMS) —
who should own gathering that business-registration info?
A) Owner provides it directly to whichever vendor needs it when the time comes
B) Have the operations/finance side pull it once and keep it on file for any future
verification, cannabis or not
C) Defer until an actual toll-free number is needed — don't pre-gather
D) Something else (say what)

**Q6.** Age-affirmation for 1:1 SMS under Prop 64 (§2.3) — every marketing text is "direct,
individualized communication" requiring 21+ affirmation, not just the storefront's existing gate.
How should that affirmation be captured for someone who opts in by texting a keyword (no web form
in that flow)?
A) Require age affirmation as part of the double opt-in reply flow itself (e.g. the confirmation
message asks for birth-year or a 21+ affirmation before activating) **[recommended]**
B) Rely on the fact that the opt-in phone number is already tied to a verified 21+ POS/online
account (no separate SMS-specific affirmation needed) — legal risk if a number is later reused
C) Only allow SMS opt-in through the already-gated landing page/web flow, never via inbound
keyword text, so the existing web gate always applies first
D) Something else (say what)
