# Engage unification — concept brief for the four explorations

Owner rulings (2026-09-10), binding on every concept:

1. **Our platform owns loyalty.** One points ledger, one consent record, one customer identity in
   our backend; Alpine IQ imported then retired. Nothing in a mockup shows an Alpine screen.
2. **SMS = short body + our landing page.** The text never carries cannabis content, price or
   imagery: `Important message from Hyperwolf: hyp.wf/x7Kq2p`. Everything lives on the landing
   page ("squeeze page"), which has a **per-page setting to toggle the 21+/state gate on or off**
   (storefront itself stays gate-free, rule D-024a).
3. **Six sections, and Engage merges into the POS estate.** Customers · Audiences · Messages ·
   Journeys · Loyalty · Insights. Settings, integrations, audit, health sit under one gear.
   **Customers = the existing Members CRM module, updated** (`athome/crm.jsx`), never a second
   member module. **Loyalty (points, tiers, rewards, referrals, wallet pass) becomes POS screens.**
   Audiences, Messages, Journeys, Insights stay in the Engage app. One rail, one switcher.
4. **Rewards are store- and channel-scoped**: a reward can be redeemable at some stores only,
   delivery-only, in-store only, or both. Earn rules can differ per store. Show it plainly.
5. **Calm over dense.** Progressive disclosure, plain-language rule sentences, one canvas, a small
   palette, templates/recipes to start from. Starbucks rejected the denser dashboard; so do we.
6. **Register screen is never modified in code** (`pos/screen-register.jsx`). Concepts may show
   the register's customer panel as it would read with real loyalty (points, tier, reward
   eligibility by store/channel, consent), but that lands via the POS Home card, the member panel,
   and the payment modal — say so in the mockup's dev call-out.
7. **Promotions and rewards are one rule language.** A reward is a promotion whose action is
   points or a member-only discount; the Promotions Suite's IF/THEN builder and the loyalty earn
   rules share one sentence editor and one vocabulary (matching the production promotion engine's
   rule types: cart · product · user · bogo · time · payment, plus store and channel scope).

## What every concept must show (one HTML each, `explorations/Engage - Concept X - <name>.html`)

Tabs inside the page, each a full screen at desktop width, real tokens from `pos/tokens.jsx`
(copy the palette values into the file; no external CSS; scripts in `<head>` running on
`DOMContentLoaded`; `window.toggleTheme` exposed; light + dark). Copy the file format of
`explorations/Incentives - Concept D - Two Seats.html`. Data in the mockups is labelled demo
where it is not real; no fake "live" badges.

1. **Home / Insights** — what a marketer sees first. Show how the concept keeps 51 tiles from
   coming back: what the four numbers are, what the one list is.
2. **Customers (Members CRM, updated)** — list + one member record: identity (phone, POS ids,
   web id, wallet pass), consent (SMS/email, with source and timestamp), points balance + tier +
   expiry, store affinity, order history, audiences they are in, messages received, referral.
   Design the record so the same panel can appear inside the POS member lookup.
3. **Audiences** — the builder: a plain-language sentence ("Customers who ordered 3+ times, last
   order over 45 days ago, SMS consent granted, favourite store Corona"), live size, sample of 5,
   AI prompt entry that produces the same editable sentence; saved audiences list with refresh
   cadence and where each is used.
4. **Messages** — campaign compose (audience → channel → content → schedule → policy check →
   send), and the **block builder** used for email AND landing pages: block palette (≤ 12
   blocks), canvas, mobile preview, merge tags, saved sections, per-page gate toggle, and the
   SMS composer that shows the short body next to the page it opens. Show the policy chain
   result honestly (consent coverage, quiet hours holds, frequency cap) before send.
5. **Journeys** — one canvas, small palette: trigger · wait · branch · message · loyalty action ·
   exit. Triggers include "ordering less often than usual" (frequency drop), lapsed N days, tier
   change, birthday, cart abandoned, first order, referral. Show a win-back journey end to end
   with enrolled/converted counts per node.
6. **Loyalty (in the POS)** — program: earn rules (per $, per category, per store, multipliers),
   tiers (thresholds, benefits, grace), rewards catalogue with **store / delivery / in-store
   scope chips**, expiry policy, referral program, wallet pass preview. Plus the register-side
   read: the member panel with points, tier, "3 rewards usable here · 1 delivery-only", and the
   tender step's earn/redeem line.
7. **Dev call-outs** — a small fixed panel or footnotes naming what production must wire:
   customer_id on the sale, the points ledger route, consent write, short-link redirect, landing
   page render, promotion-engine rule compatibility.

## Four directions

- **A — "Calm ledger"**: classic six-section console, Klaviyo-calm density, list + detail
  everywhere, rule sentences in every editor, no dashboards beyond four numbers.
- **B — "Start from the goal"**: Home is a goal picker (win back lapsed · launch a drop · reward
  VIPs · fill a slow Tuesday · grow referrals); each goal opens a guided path that pre-builds
  the audience, message and journey; the six sections exist behind it for editing.
- **C — "One customer record"**: the member record is the centre of gravity; audiences, messages,
  journeys and loyalty are views over customers; the POS member panel and the CRM record are
  literally the same component; loyalty configuration is a POS settings screen.
- **D — "Canvas"**: the journeys canvas is the primary surface; a one-off campaign is a one-node
  journey; the block builder opens inside a node; loyalty actions are nodes; audiences are
  entry conditions. Fewest screens of the four.

Inspiration digest: `scratch/engage-inspiration-digest-2026-09-10.md`. Existing screens to
respect: `engage/*.jsx`, `athome/crm.jsx`, `pos/screen-home.jsx`, `pos/atoms.jsx`.
