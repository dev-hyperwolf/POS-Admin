# SMS provider shortlist — due-diligence packet (Blackleaf, Textvolt, + others)

Prepared 2026-09-17. Extends `docs/SMS-PROVIDER-PLAN-2026-09-17.md` (read first) — that plan
covers the regulatory landscape, Engage's existing adapter architecture, and the owner's Q1
pick of Blackleaf + Textvolt for pricing/terms plus "look for others." This file does not
repeat that ground; it profiles the named vendors and expands the field.

**Method, same rules as the parent plan:** public web pages only, no vendor contact, no signups,
no forms submitted. Every claim below is sourced with a URL and access date (2026-09-17 unless
noted). Anything stated by the vendor about itself is flagged **[vendor claim]** — treat as
marketing until verified in a real call. `.env`/credential files were not opened; the one
codebase reference below came from a plain-text grep of application source, not secrets.

---

## 1. Blackleaf — company and product profile

**Company facts.** Founded 2019, self-funded/bootstrapped (no external VC found), profitable per
its own materials, based in Los Angeles, CA — cannabis-retail text marketing is its sole stated
line of business. **[vendor claim for "profitable"]**
[Blackleaf solutions](https://blackleaf.io/solutions/), [CB Insights: Blackleaf/"Black SMS"](https://www.cbinsights.com/company/black-sms), [Respect My Region coverage](https://respectmyregion.com/blackleaf-cannabis-retail-marketing/)

**Cannabis focus.** Purpose-built for dispensaries/cannabis retailers; markets itself directly
against Alpine IQ and Springbig on deliverability. [Blackleaf](https://blackleaf.io/), [Blackleaf 2026 platform guide](https://blackleaf.io/best-sms-marketing-platform-for-dispensaries-2026-guide/)

**Sending route.** No owned carrier connections found or claimed — Blackleaf's own FAQ states
plainly: *"Blackleaf can guarantee delivery? No. Carriers and devices make downstream decisions."*
Primary route is standard **10DLC** via Campaign Registry brand/campaign registration; the FAQ
tells users to contact support before sending outside the US/Canada. This is a materially
different architecture claim than the "own proprietary network" framing Springbig/Sweed use for
themselves (per the parent plan §2.2/§3) — Blackleaf appears to be a specialist *sender* that
still rides carrier-filed 10DLC, not a vendor with its own aggregator relationship. **This is
worth a direct first-call question** (see Q1 below) since it changes the compliance story:
10DLC campaigns are the exact channel the parent plan (§2.1) says carriers block/restrict for
cannabis content. [Blackleaf FAQ](https://blackleaf.io/faq/) (accessed 2026-09-17)

**API.** Documented at `api.blackleaf.io` / `blackleaf.io/send-messages-api/`. Confirmed from the
public docs: a `GET /api/messaging/send/` endpoint taking `to` (E.164), `body`, optional `image`
(publicly hosted URL, for MMS), and `apiKey` as a **query-string** parameter (not a header) —
returns `{status, message, message-id}`. **No public documentation was found for**: templates,
contacts/consent endpoints, webhooks for delivery receipts or inbound STOP/HELP, signature
verification, or a sandbox environment — these must be asked about directly; their absence from
public docs is a real gap, not proof they don't exist. Key-in-query-string is also worth flagging
as a security question (§6). [Blackleaf send-messages API](https://blackleaf.io/send-messages-api/)

**Two-way / MMS / link tracking.** Shared inbox for inbound replies; automatic STOP handling
(explicitly warns against manual replies that bypass opt-outs). MMS supported (image + text).
Links can be shortened/tracked with click reporting — FAQ is careful to say *"a click is link
activity, not proof of a purchase."* [Blackleaf FAQ](https://blackleaf.io/faq/)

**Consent tooling.** Provides opt-out automation and contact export (all/subscribed/unsubscribed)
but explicitly disclaims platform-level compliance guarantee: *"Does using Blackleaf make every
campaign compliant? No"* — consent records are the sender's responsibility, importing a number is
not proof of consent. This matches (does not exceed) what Engage's own consent ledger already
does per the parent plan §1/§6 — Blackleaf would sit **behind** Engage's consent gate, not replace
it. [Blackleaf FAQ](https://blackleaf.io/faq/)

**Compliance stance (TCPA/CTIA/Prop 64).** References CTIA Messaging Principles throughout its
docs; frames itself as infrastructure, sender retains legal responsibility. Its "identity gate"
for regulated campaigns is explicitly **not** an age determination — it matches a visitor to an
existing recipient record, which is short of the parent plan's §2.3 Prop 64 finding that 1:1 SMS
needs actual age *affirmation*. Ask directly whether/how Blackleaf supports capturing a
birth-year/21+ affirmation at opt-in, since its own docs say it doesn't do age determination.
[Blackleaf FAQ](https://blackleaf.io/faq/)

**Pricing signal.** Pay-as-you-go from **2¢/message**, monthly plans from **$25**, prepaid "Z
Credits" (1 credit = 1¢), no carrier fees/campaign fees/contracts stated, annual pricing ~20%
below monthly, plus a **10% compliance fee** layered on SMS/MMS usage. **[vendor claim, from
Blackleaf's own pricing page, not independently verified against an actual invoice]**. At ~50k
messages/month and a rough single-segment blended rate of ~2.2¢ (2¢ + 10% compliance fee), that's
roughly **$1,100/mo** order-of-magnitude — treat as a floor estimate; MMS, multi-segment messages,
and any minimum plan tier would push it higher. [Blackleaf pricing](https://blackleaf.io/pricing/)

**Contract terms / data export / SOC 2 / uptime / support.** No contract lock-in claimed ("no
contracts"). Contact export available (with an explicit warning to treat exports as sensitive
data). **No SOC 2 or equivalent certification was found anywhere in public materials** — flag as
an open question, not an assumption of absence of controls. A public status/uptime page exists.
Support is ticket-based, 7 days/week per the FAQ; FAQ explicitly instructs never to share
passwords or API keys with support. [Blackleaf FAQ](https://blackleaf.io/faq/)

**Ten questions for a first Blackleaf call:**
1. Is sending truly 10DLC/carrier-filed, or do you hold a direct aggregator/carrier relationship
   for cannabis content specifically? How do you keep cannabis campaigns from being carrier-blocked
   under standard 10DLC content-category rules?
2. Do you support webhooks for delivery receipts and inbound STOP/HELP, and if so, are they
   HMAC/signature-verified? Point us at the docs.
3. Is there a sandbox/test environment that doesn't send real messages or incur charges?
4. What does the "10% compliance fee" actually fund — filing, review, something else?
5. Do you support capturing an explicit 21+/birth-year affirmation as part of double opt-in, not
   just an identity match?
6. Can the API key be scoped (read vs. send), rotated without downtime, and passed as a header
   instead of a query-string parameter?
7. Do you hold SOC 2 Type II or an equivalent third-party security attestation? Can we see the
   report under NDA?
8. What is your published/actual delivery-rate and uptime history for cannabis-content traffic
   specifically (not blended across all customers)?
9. What does contract term length, minimum commitment, and exit/data-export look like in writing
   (not just the marketing FAQ)?
10. Who are three cannabis-retail references we can call, ideally similar size/multi-state?

---

## 2. Textvolt — current stance, and what changed since we used them

### 2.1 What's actually in our codebase (read-only grep, `/Users/jt/hyper-tech`, not modified)

`grep -a -rn -i textvolt /Users/jt/hyper-tech` confirms the parent plan's finding and adds the
exact shape:

- **Integration:** `textVoltMutationMethod` in `common/utils.js` (hyperwolf-backend:1141,
  hyperdrive-backend/`util.js`:248, hemp-backend/`utils.js`:712, stilo-backend/`utils.js`:740) —
  a GraphQL `createMessage` mutation POSTed to `TEXT_VOLT_URL` with `Authorization: Bearer
  ${TEXT_VOLT_BEARER_TOKEN}`.
- **Live call sites today:** only in **hyperdrive-backend** (`task-controller.js:892,922,974` —
  order-started/complete/arriving delivery notifications) and **stilo-backend** (same three
  routes via `textVolt-routes.js` + `textVolt-controllers.js`) and **hemp-backend** (same
  pattern). **hyperwolf-backend's own call sites are commented out** (`textVolt-controllers.js:48,
  88,149`; `blaze-integration-controllers.js:749,1064`; `weedmap-controllers.js:60`) — Hyperwolf
  retail is not currently sending anything through Textvolt; Aircall (`airCallMethod`) is the live
  Hyperwolf SMS path per the parent plan §1.
- **Auth style:** static bearer token in an env var (`TEXT_VOLT_BEARER_TOKEN`), no OAuth, no
  per-request signing found.
- **`.env.example` files** (not real `.env`, not opened as credentials) show only placeholder
  strings `<textvolt-base-url>` / `<textvolt-bearer-token>` — confirms the integration shape
  without exposing any real secret.
- Every repo's use of Textvolt is **transactional delivery-ops SMS** (order started/complete/
  arriving) for the hemp/stilo/hyperdrive vertical — never loyalty or marketing content, and never
  live for Hyperwolf retail today. This matches the parent plan's finding exactly; nothing new
  contradicts it.

### 2.2 What Textvolt is *today* — a material change to flag

Fetching **textvolt.com** directly (2026-09-17) does not land on a cannabis or dispensary SMS
product at all. The site now belongs to **Volt Labs Inc.**, self-described as *"The unified
platform for messaging operations"* — a **multi-provider CPaaS aggregator** (products: Connect,
Register, Insights) that **routes traffic across Twilio, Bandwidth, Telnyx, Infobip, Vonage,
Sinch, and AWS Pinpoint** through one integration, with a GraphQL API (consistent with the
`createMessage` GraphQL mutation still live in our codebase — same underlying platform, rebranded
name). Its five named target verticals are **CRMs, voice AI platforms, lead generation, healthcare
software, and fintech/banking**. **Cannabis is not mentioned anywhere on the page — not as
supported, not as restricted.** [textvolt.com / Volt Labs](https://textvolt.com) (fetched
2026-09-17; verbatim self-description: *"The unified platform for messaging operations"*)

**What this means for the owner's question:** Textvolt/Volt does **not currently permit cannabis
marketing SMS** as a positioned use case — it isn't offered, isn't mentioned, and structurally
routes traffic through general CPaaS providers (Twilio, Bandwidth, Telnyx, Vonage, Sinch) that the
parent plan (§3) already found ban or restrict cannabis messaging outright. An aggregator's
compliance model (10DLC/toll-free registration across those exact carriers) inherits their content
restrictions — Volt "handling compliance" almost certainly means *carrier-standard* compliance,
the same regime that blocks cannabis content, not a cannabis carve-out. **This is a downgrade from
"unconfirmed" to "very unlikely without a direct written exception"** — the honest posture is:
ask Volt directly and in writing whether cannabis-marketing content can be registered on any of
their routed carriers, and do not assume yes. Nothing in this research found a cannabis program,
past or present, publicly documented for Textvolt/Volt.

**What changed since the owner used them:** the product appears to have moved from being a
narrower delivery-SMS API (the shape wired into hyperdrive/hemp/stilo) to a general messaging-ops
platform serving non-cannabis verticals exclusively. Whether that's a rebrand of the same company
or a distinct successor was not resolvable from public pages alone — worth asking on a call
whether "Volt Labs" is the same legal entity that operated as Textvolt when our delivery-ops
integration was built.

### 2.3 Ten questions for a first Textvolt/Volt call

1. Is Volt Labs the same company/account we already integrate with as "Textvolt" in
   hyperdrive-backend, hemp-backend, and stilo-backend (GraphQL `createMessage`, bearer-token
   auth)? Same account ID?
2. Do you register or route **any** cannabis-marketing content on any of your carrier partners
   today? If not today, has it ever been supported?
3. If cannabis content isn't supported, is there a compliance/legal reason (carrier AUP) or just
   an unaddressed market — i.e., is this a hard no or a "nobody's asked"?
4. Since our delivery-ops SMS already runs on Textvolt (order-started/complete/arriving) — does
   moving to "Volt" change that integration's auth, URL, or GraphQL schema at all? Any breaking
   changes coming?
5. What does the current `TEXT_VOLT_BEARER_TOKEN` static-bearer auth model look like today — do
   you support key scoping, rotation, or per-webhook signing now?
6. Do you support inbound STOP/HELP and delivery-receipt webhooks, and are they signed?
7. What is pricing for ~50k messages/month blended across whichever carriers you'd route us
   through?
8. Do you hold SOC 2 or equivalent, and can we see it under NDA?
9. What is contract length, and what happens to our existing delivery-ops integration if we don't
   move to a new product tier?
10. Given cannabis is unmentioned in your public materials, would onboarding a cannabis-marketing
    use case require a special account review, and how long does that take?

**Bottom line for the owner:** the current live delivery-ops use of Textvolt is fine to leave
alone — it's operational, not marketing, and already flagged for an unrelated `.env`/empty-catch
reliability bug in the parent plan (§1). For **marketing** SMS specifically, Textvolt/Volt should
be treated as **unconfirmed-trending-no** unless a direct call produces a written cannabis
exception — do not route the Engage marketing rollout through it without that confirmation.

---

## 3. Six-plus other candidates

| # | Provider | Cannabis marketing allowed? | Route | API quality (public evidence) | Pricing signal | Notable customers | Red flags |
|---|---|---|---|---|---|---|---|
| 1 | **Springbig** | Yes — cannabis-native, market leader | **[vendor claim]** "own proprietary messaging system and APIs," not a Twilio reseller | Public dev hub at `springbig.readme.io` with documented webhooks (POS API + SMS webhooks referenced); most mature-looking docs of the specialist vendors | Not published; sales-quote only | Widely cited as the category leader across dispensary chains (no specific named accounts independently verified here) | A TCPA class action against Springbig was reportedly dismissed on the theory it wasn't the "maker" of the message — a data point about *their* liability shielding, not a guarantee of *our* compliance; verify this cuts both ways before assuming it protects us too |
| 2 | **Sprout** (sprout.online) | Yes — built for cannabis CRM/marketing | Proprietary omni-channel (SMS, "Sprout Messenger," email) | No public API docs surfaced in this pass — unconfirmed, ask directly | Not published | **[vendor claim]** used across 28 states, Canada, Puerto Rico | Cannot confirm developer API exists at all from public sources — could be dashboard-only, which would not fit Engage's adapter-behind-a-provider architecture |
| 3 | **Baker** (trybaker.com) | Yes — cannabis CRM/engagement platform, founded 2016 | Proprietary | Not found publicly | Not published | **[vendor claim]** "leading CRM for the cannabis industry" | CRM-first positioning; SMS may be a feature of the CRM rather than an independently addressable send API — confirm before assuming adapter fit |
| 4 | **Tymber** (tymber.io) | Yes — cannabis dispensary marketing automation | Proprietary, bundled with e-commerce/ordering | Not found publicly | Not published | Not found | Positioned as an add-on to Tymber's online-ordering product, not a standalone messaging API — likely poor fit if we don't also run Tymber's storefront |
| 5 | **Happy Cabbage** ("Happy Marketers," happycabbage.io) | Yes — cannabis text/email marketing, ML-targeted campaigns | Proprietary | Not found publicly; integrates with Dutchie/Blaze/Trees/FlowHub/Meadow POS systems per vendor materials | Not published — vendor doesn't disclose pricing publicly | **[vendor claim]** integrates with major cannabis POS systems | Positioned around analytics/targeting more than raw sending infrastructure — worth confirming whether they'd sit *behind* Engage's adapter (send-only) or want to own the whole campaign layer, which would conflict with our "Engage owns consent/templates/ledger" design |
| 6 | **Leafbuyer** (tech.leafbuyer.com) | Yes — explicitly markets **10DLC registration + TCPA compliance** as a feature, live since 2014 | 10DLC (same carrier-filed route as Blackleaf, not a proprietary network) | Not found publicly | "Transparent pricing, no hidden fees" **[vendor claim]**, no figures published | Long-tenured vendor (since 2014); also runs a consumer-facing lead-gen network (LeadCatcher) that pulls subscribers from leafbuyer.com traffic — a potential mismatch if we don't want third-party-sourced leads mixed with our own opted-in customers | Same 10DLC-carrier-content-restriction exposure as Blackleaf — ask the same "how do you keep cannabis campaigns registered" question |
| 7 | **Blaze Outreach** (blaze.me/products/outreach) | Yes — **[vendor claim]** "follows TCPA guidelines and cannabis advertising restrictions by default" | Not disclosed publicly (POS-native, part of "BLAZE Growth" suite launched July 2026) | Unknown — likely bundled into the Blaze POS product rather than an independently callable API; **we are already a Blaze customer**, so this is the cheapest vendor to get a real, fast answer from (per the parent plan's own recommendation) | Not published | We are already a Blaze customer for POS | Being POS-bundled could mean it's not exposable as a standalone send API behind Engage's adapter at all — the very first question to ask our existing Blaze rep |
| 8 | **Terpli** (terpli.io) | Not applicable — this is an AI product-recommendation engine, not an SMS sender; it feeds personalization data *into* SMS campaigns run by other platforms (Springbig, Alpine IQ) | N/A | N/A | N/A | N/A | Including this in a provider shortlist would be a category error — flagging so the owner doesn't chase it as a sending vendor |

**General-CPaaS cannabis stances (confirms/extends parent plan §3, doesn't repeat it):**
- **SlickText**: explicitly prohibits cannabis/CBD content in its Acceptable Use Policy.
  [SlickText AUP](https://www.slicktext.com/legal/acceptable-use)
- **EZ Texting**: Terms of Service prohibit "any material that promotes, offers, or references
  cannabis, marijuana, hemp, CBD, Kratom, or THC-related content, regardless of legality in any
  jurisdiction." [EZ Texting Terms](https://www.eztexting.com/terms)
- **Podium**: Acceptable Use Policy explicitly prohibits cannabis and CBD.
  [Podium AUP (PDF)](https://podium.pactsafe.io/versions/62f41fb85e57ee6f320848cd.pdf)
- **Klaviyo**: SMS/MMS content policy explicitly prohibits marijuana/cannabis-related content;
  restriction is specific to the SMS channel (email support differs).
  [Klaviyo prohibited content](https://help.klaviyo.com/hc/en-us/articles/4401822831771)
- **Attentive**: general eCommerce SMS platform; secondary sources describe it as "not designed
  for cannabis-specific requirements" — no explicit public AUP clause found naming cannabis in
  this pass, treat as **restricted-to-unconfirmed**, not confirmed-banned, and verify directly if
  ever considered.
- **Mozeo, Trumpia, Textline**: general-purpose SMS marketing platforms (alerts, two-way texting,
  customer service); **no cannabis-specific policy found either way** in this research pass —
  genuinely unconfirmed, not a signal of permission. Given every general CPaaS/aggregator checked
  in both this file and the parent plan bans or is silent-and-presumed-restricted on cannabis, treat
  silence the same way the parent plan does: **assume restricted, confirm before building.**

**Net:** the six-plus field beyond Blackleaf/Textvolt is Springbig, Sprout, Baker, Tymber, Happy
Cabbage, Leafbuyer, and Blaze Outreach (seven) — all cannabis-native. Every general-purpose SMS
platform checked (SlickText, EZ Texting, Podium, Klaviyo, and by policy pattern likely Attentive/
Mozeo/Trumpia/Textline) either explicitly bans cannabis content or has no public evidence of
permitting it. This matches and reinforces the parent plan's core finding: **the real choice is
among cannabis-native vendors, not general CPaaS with a workaround.**

---

## 4. Comparison table

| Provider | Cannabis marketing allowed | Route | API + webhooks + sandbox | Deliverability evidence | Consent tooling | Pricing @ ~50k msgs/mo | Contract | Data export | Security posture | Adapter fit |
|---|---|---|---|---|---|---|---|---|---|---|
| **Blackleaf** | Yes (specialist) | 10DLC, carrier-filed (not proprietary network) | Documented send endpoint (GET, query-string API key); templates/contacts/webhooks/signature/sandbox **not publicly documented** — ask | No independent evidence found; vendor claims "high-deliverability" | Opt-out automation + export; explicitly disclaims compliance guarantee | ~$1,100/mo order-of-magnitude estimate (2¢/msg + 10% compliance fee) **[estimate, not quoted]** | "No contracts" per marketing site — verify in writing | Contact export supported (all/subscribed/unsubscribed) | No SOC 2 found; API key in query string (ask to move to header); public status page exists | Good — thin send API can sit behind Engage's adapter once webhook/signature gaps are answered |
| **Textvolt / Volt Labs** | **Unconfirmed, trending no** — product is now a general CRM/voice-AI/healthcare/fintech messaging-ops aggregator with zero cannabis mention, routed through carriers (Twilio et al.) that ban cannabis content | Multi-provider aggregation (Twilio, Bandwidth, Telnyx, Infobip, Vonage, Sinch, AWS Pinpoint) | GraphQL API (matches our existing `createMessage` integration); Connect/Register/Insights products; webhook/signature/sandbox details not surfaced publicly | Not evaluated for cannabis traffic — no cannabis customers found | Not evaluated — product not positioned for cannabis at all | Not published | Not published | Not evaluated | Not evaluated | Poor unless a direct call produces a written cannabis exception — do not build marketing send on this without that confirmation |
| **Springbig** | Yes — category leader | **[vendor claim]** proprietary network | Public dev hub, documented webhooks — best-documented of the specialists | Category-leading reputation (unverified independently) | Not detailed in this pass | Not published | Not published | Not detailed | Not detailed | Likely good, most mature-looking API |
| **Sprout** | Yes | Proprietary | No public API docs found — unconfirmed | Not found | Not detailed | Not published | Not published | Not detailed | Not detailed | Unknown — may be dashboard-only |
| **Baker** | Yes | Proprietary, CRM-first | Not found publicly | Not found | Not detailed | Not published | Not published | Not detailed | Not detailed | Unknown — CRM bundling risk |
| **Tymber** | Yes | Proprietary, bundled w/ ordering | Not found publicly | Not found | Not detailed | Not published | Not published | Not detailed | Not detailed | Poor unless we adopt Tymber ordering too |
| **Happy Cabbage** | Yes | Proprietary | Not found publicly | Not found | Not detailed | Not published | Not published | Not detailed | Not detailed | Uncertain — analytics-first positioning may want to own campaign layer |
| **Leafbuyer** | Yes | 10DLC, carrier-filed | Not found publicly | **[vendor claim]** "highest delivery rate in industry" | Not detailed | Not published | Not published | Not detailed | Not detailed | Same carrier-filing exposure as Blackleaf; also runs third-party lead-gen network — vet lead sourcing |
| **Blaze Outreach** | Yes **[vendor claim]** | Not disclosed (POS-bundled) | Unknown — likely not a standalone API | Not found | Not detailed | Not published | We're already a Blaze customer — cheapest to ask | Not detailed | Not detailed | Uncertain — may not expose a send API for Engage's adapter to call at all |

Nothing in this table should be read as a final compliance or security verdict — every cell
marked "not found," "not detailed," or "[vendor claim]" is an open question for a real call, per
the parent plan's own standard.

---

## 5. Recommendation — ranked shortlist of three, and a scripted RFP email

**Ranked for quotes (in order):**

1. **Blaze Outreach** — we are already a Blaze customer; this is the fastest, cheapest real answer
   (a conversation with our existing rep, not a cold vendor evaluation) and directly tests the
   parent plan's own top recommendation. Rank #1 purely on speed-to-answer, not on confirmed fit —
   its POS-bundled architecture is the biggest open question.
2. **Blackleaf** — most technically transparent of the specialists (public API docs, published
   pricing, explicit compliance disclaimers instead of vague marketing), and the owner already
   named it. Best combination of "answerable now" and "architecturally close to what Engage needs"
   (a thin send API behind our own adapter).
3. **Springbig** — the most credible alternative if Blackleaf's 10DLC-carrier-filed route turns out
   to be a real deliverability risk; best-documented developer hub of the group, and the
   longest-tenured cannabis-specific competitor to the incumbent (Alpine IQ).

Springbig displaces Textvolt at #3 for a straightforward reason: Textvolt's current public
product (Volt Labs) shows no cannabis positioning at all and routes through carriers that ban
cannabis content — it does not currently look like a live candidate for **marketing** SMS,
independent of its perfectly fine ongoing use for delivery-ops texts. If the first call resolves
that concern in writing, it can re-enter the ranking.

**Scripted RFP email** (placeholders for anything that could reveal our real volumes or terms):

> Subject: SMS platform evaluation — cannabis dispensary marketing, request for information
>
> Hi [Vendor contact],
>
> We're evaluating SMS/MMS providers for our cannabis retail loyalty and marketing program and
> would like some information ahead of a call.
>
> 1. Do you support cannabis-marketing SMS content specifically (not just transactional/
>    operational messages), and on what sending route (proprietary network, 10DLC, toll-free,
>    short code)?
> 2. Do you offer a REST or GraphQL API for sending, templates, and contact/consent management?
>    Please share developer documentation.
> 3. Do you support webhooks for delivery receipts and inbound STOP/HELP, and are they
>    signature-verified? What signing scheme?
> 4. Is a sandbox/test environment available that doesn't incur charges or send real messages?
> 5. What is your pricing structure at approximately [VOLUME] messages/month, including any
>    compliance, carrier, or registration fees?
> 6. What is your standard contract length, minimum commitment, and data-export process on exit?
> 7. Do you hold SOC 2 Type II or an equivalent independent security attestation? Can it be shared
>    under NDA?
> 8. Can you describe your consent/opt-in tooling, including support for age affirmation (21+)
>    under state cannabis-marketing rules?
> 9. Can you provide two to three references from cannabis retail customers of comparable scale?
> 10. What does API key management look like — scoping, rotation, IP allowlisting?
>
> We'd like to schedule a 30-minute call once we've reviewed your answers. Thank you.
>
> [Owner name / title]
> [Company name]

---

## 6. Security checklist for onboarding any SMS provider

- **API key scoping**: request send-only keys where possible (no account-admin or billing scope
  on the key used by the application); confirm the provider supports multiple scoped keys, not one
  master key.
- **IP allowlisting**: restrict outbound calls to the provider's documented API IP ranges where
  supported, and ask the provider whether they support inbound IP allowlisting on their side for
  our webhook callback URL.
- **Webhook signature verification**: never accept an inbound delivery-receipt or STOP/HELP
  webhook without verifying its signature first — Engage's `msg_adapter.py` already implements
  this pattern for a Twilio-shaped and SendGrid-shaped signature (per the parent plan §1); any new
  vendor's webhook must be verified the same way before any DB write, no exceptions.
- **PII handling**: phone numbers are personal information (parent plan §6) — no provider's own
  link-shortener or analytics should receive more customer data than the message body strictly
  requires; prefer Engage's own tokenized landing-page links over a vendor's built-in click
  tracking that could leak identity into a third-party log.
- **DPA (Data Processing Agreement)**: required before any real customer phone number touches the
  provider — do not test with real numbers until a DPA is signed by the owner.
- **Breach notification terms**: confirm in writing what the provider's breach-notification SLA
  is (how fast they must tell us) before going live.
- **Key entry restricted to the owner**: unchanged from the parent plan (§6) and this project's
  standing rule — Claude does not receive, request, type, or store any provider API key at any
  point in this evaluation or any future integration work; the owner enters keys directly into
  Script Properties / environment config.
- **No production traffic before verification**: every item above should be checked off before the
  first real customer message is sent through a new provider, not discovered after.

---

## 7. Open items this packet could not resolve (need a real call)

- Whether Blackleaf's and Leafbuyer's carrier-filed 10DLC route actually gets cannabis campaigns
  registered and sustained in practice, or gets blocked/flagged over time (their own FAQ language
  suggests the platforms themselves don't fully control this outcome).
- Whether "Volt Labs" (current textvolt.com) is the same legal entity as the "Textvolt" already
  wired into hyperdrive-backend/hemp-backend/stilo-backend, and whether that existing delivery-ops
  integration is at any risk from the apparent rebrand.
- Whether Blaze Outreach exposes any callable API at all, or is dashboard/POS-only — the single
  fastest question to resolve given we're already a Blaze customer.
- SOC 2 status for every cannabis-native vendor in this packet — not found publicly for any of
  them; must be asked directly and in writing.
