# PROMPT FOR NEW THREAD — Hyperwolf ID Verification module (Didit parity)

You are a genius-level software architect and product engineer. You are being asked to plan and
build a new module inside an existing, actively developed cannabis retail platform, achieving
feature parity with **Didit** (business.didit.me) — the real, live identity-verification product
Hyperwolf pays for today — and drawing on Persona, Onfido, Veriff, Jumio, Sumsub, Incode, Socure,
Trulioo and CLEAR where they do something better. Before writing a single line of implementation
code you will research, plan, present four design concepts, and get explicit approval. Plan every
feature and every piece of functionality; nothing left behind. This is a production application
that will be ported to the production website, not a demo: no dummy data, no placeholders, every
number on screen comes from a real API, and where a backend is unreachable the screen says so.

## The owner's priorities, verbatim in spirit

1. **Fraud elimination is the point.** Liveness checking is mandatory and must be first-class:
   passive liveness on every selfie, active (challenge) liveness available per workflow, injection
   and deepfake resistance, face match against the document portrait, face search against prior
   sessions and blocklists, device and IP risk, document tamper detection. Nobody fools the system.
2. **Nothing left behind.** Didit's whole console is the parity target: dashboard, verifications
   table and session detail, manual-review queue with analyst audit trail, workflows builder,
   questionnaires, customization (white label), lists (blocklist, allowlist, custom, biometric
   templates), users and businesses directory, integrate surface (API keys, webhooks, SDK snippets),
   usage and billing, team and roles, audit logs, retention and deletion, compliance PDF,
   resubmission flow, reusable KYC, biometric re-authentication of returning users, age estimation.
3. **Real data only, honestly labelled.** This estate's culture is "honest zero over fabricated
   number". Anything not wired to real data must say so where the value would appear.

## The first plan question you must answer before anything else

Hyperwolf currently runs ~9,400 document verifications a month through Didit (workflow "Hemp
Verification (no selfie)": document + device/IP; a second workflow adds selfie liveness + face
match). The recognition engines (document OCR and authenticity, liveness, face match, age
estimation) are ML services. Your plan must state, with a recommendation, how parity is achieved
for those engines: (a) pluggable engine adapters with Didit's standalone APIs
(`/v3/id-verification/`, `/v3/passive-liveness/`, `/v3/face-match/`, `/v3/age-estimation/`) as the
first engine behind our own console, workflows, sessions, webhooks, review queue and lists; (b) an
alternative vendor engine; (c) open-source models self-hosted; or a mix. Say what each costs, what
each cannot do, and what the migration path from Didit looks like (Didit exposes an MCP server
`@didit-protocol/mcp-server` and full REST for sessions/users/lists, so historical sessions and
blocklists can be exported). Do not quietly pick one; present it as the decision it is.

## Where this lives, and why it must not look bolted-on

Repo `/Users/jt/POS-Admin` (frontend estate, GitHub Pages + Render on push to `main`) and
`/Users/jt/wm-demo` (the Python 3.9 **stdlib-only** backend that serves POS-Admin same-origin via
`shared/hw-live.js`; SQLite; one `server.py` with a flat route chain; probes in `qa/` run by
`qa/battery.py`; `docs/SCOREBOARD.md` is the evidence ledger). Read, in this order, before any
design work:

1. `/Users/jt/POS-Admin/CLAUDE.md`, `pos/tokens.jsx` (the only place colours live), `pos/atoms.jsx`
   (every UI primitive), `shared/states.jsx`, `shared/hd-ui.jsx`, `shared/app-nav.js`,
   `shared/app-rail.jsx`, `engage/app.jsx` and `Hyperwolf Engage.html` (how a separate app is
   assembled), `incentives/app.jsx` and `Hyperwolf Bounty.html` (the most recent app, built last
   night to the same rules — copy its shape: IIFE files, `window.X*` globals, one session accessor,
   ErrorState for every unbuilt route, `data-hw-live-lite` on the live seam).
2. **The estate already has identity pieces. Absorb them, do not duplicate them:**
   `pos/verification.jsx`, `pos/checkin.jsx`, `shared/id-photos.jsx` (`window.IdPhotoCapture`, the
   one ID/passport photo control), `pos/screen-identity-binding.jsx` ("Identity & binding"),
   `shared/hw-live-identity.js`, `shared/hw-live-checkin.js`, `athome/crm.jsx` (Members CRM), and in
   wm-demo `wmdemo/identity_api.py`, `identity_match.py`, `bind_gate.py`, `checkin.py`,
   `checkin_api.py`, `demo_seed_identities.py`. Also the GAS estate's live Didit integration:
   grep `/Users/jt/Library/Mobile Documents/com~apple~CloudDocs/Claude Co-work files/gas-projects`
   for `didit` (read-only; that estate has its own guard rules) to learn how sessions are created
   and webhooks consumed today.
3. `/Users/jt/POS-Admin/docs/INCENTIVES-PLAN-2026-09-07.md`, `docs/BOUNTY-API-CONTRACT.md` and
   `docs/BOUNTY-STATUS.md` — the plan, contract and status note of the module built last night.
   Your plan, contract and status note follow the same format and the same standard.
4. `/Users/jt/POS-Admin/scratch/didit-reference-digest-2026-09-08.md` — what was read from
   Hyperwolf's live Didit console today: real usage and costs, the four workflows, the console's
   information architecture, the session model, the V3 decision object, statuses, the operational
   API surface. Then fetch Didit's own full integration prompt and docs yourself
   (console → Integrate → "Copy prompt"; `https://docs.didit.me`, OpenAPI at
   `https://docs.didit.me/openapi-25.json`) — never guess a field name you can look up.

Every new screen is built FROM the tokens and atoms; zero hex literals outside `pos/tokens.jsx`;
copy voice plain and second person; loading is a skeleton inside the header the loaded state will
show; empty is `EmptyState`; not connected is `ErrorState` with the estate's copy. The Register
screen (`pos/screen-register.jsx`) is **never modified** (owner rule). New apps get a rail item in
`shared/app-nav.js`, an entry in `shared/app-switcher.js` and a card in `Hyperwolf.html` in the
same turn.

## Data integration that must actually work

- **Sessions end to end:** create a session server-side, open the hosted or embedded capture flow,
  receive the signed webhook (HMAC over the canonicalised body, timestamp freshness, `event_id`
  idempotency, 2xx within 5 s), apply the decision to our own session record, and expose it on the
  console. Whatever engine is behind it, the webhook is the source of truth, never the client.
- **Capture in our own UI** for the in-store check-in path (camera, document front/back, selfie
  with liveness prompts), using `window.IdPhotoCapture` as the starting point, with the engine
  adapter behind it. Say explicitly how a capture that fails liveness is handled (retry limits,
  resubmission, review) — silently passing or silently dropping is not acceptable.
- **Migration of history:** import Hyperwolf's existing Didit sessions, users, and lists through
  Didit's API/MCP so the new console is not empty on day one; every import writes a run report
  (rows read = inserted + unchanged + conflicts + rejected) exactly like the Bounty ingest does.
- **Real-world messiness up front:** duplicate people across sessions, a name on the document
  that does not match the member record, expired documents, re-verification cadence, minors and
  age-gating rules for cannabis (21+ recreational, 18+ medical with a card), out-of-state IDs,
  webhook replays, and vendor outages (what the register shows when the engine is down).

## Process — non-negotiable

1. **Plan first.** Architecture and feature plan before any mockups: data model (sessions,
   decisions, people, documents, media with retention, reviews, lists, workflows, webhooks, API
   keys, audit), state machine with Didit's exact statuses, engine adapter interface, the console's
   screens, the API contract both sides build to, what is real vs honestly labelled, escalations.
2. **Four completely different whole-module design concepts** as exploration HTMLs in
   `/Users/jt/POS-Admin/explorations/` (copy the format of `Incentives - Concept A..D`), each a full
   take on the entire console (dashboard, verifications and review, workflows builder, capture flow,
   lists, integrate, usage), grounded in the real tokens. The owner picks one or asks for changes.
   Serve them on a fresh local port and hand the owner an `open …` Run button; the desktop app's
   inline file viewer does not run their scripts.
3. **Only after approval, implement**, in disjoint well-specified pieces: shared data and engine
   adapters first, then parallel UI on non-overlapping files, then a dedicated verification pass.

## Model and execution strategy — optimise for cost

Use the strongest model for architecture, data-model decisions, the design concepts, and the
adversarial QA. Use Sonnet for well-specified screens, clients and fixes; Haiku for mechanical
edits. Dispatch sub-agents yourself; run disjoint work in parallel; write the API contract before
the screens so backend and UI agents build to the same file. Ask the owner questions one at a
time, multi-select with four options, and only for decisions that are genuinely his (people,
money, irreversible changes, scope); decide mechanics yourself and report them.

## Hard-won lessons from this estate, this week — do not repeat them

- **Adversarial QA found real blockers last night**: a filtered board that summed gross under
  the name net, a media endpoint that stored and served HTML on the app origin, manager-only
  writes with no role check, a non-idempotent money marker. Run three refuter lenses (numbers,
  safety, blast radius) before calling anything done, and fix what they confirm the same night.
  For ID verification the safety lens matters more, not less: PII at rest, image retention and
  deletion, signed webhooks, role gates on approve/decline, audit of every analyst action.
- **Secrets never pass through chat.** Keys go into `/Users/jt/wm-demo/.env` by the owner; give
  him a script with a macOS dialog (`osascript … with hidden answer`) as a Run button, and verify
  a key's scope with one read-only call before building on it. Two keys were pasted into each
  other's slots last night; check before blaming the vendor.
- **Stale `.jsx` on a reused dev port is real.** Verify live on a port nobody used this session.
- **One global scope.** Every new file is an IIFE leaking only its declared globals; extend
  `test/global-collisions.test.mjs`.
- **Measure before designing on an assumption.** Last night's plan assumed Blaze had no per-sale
  employee field; a census proved it did. Census the vendor payload first.
- **Commit verified work with explicit paths; never `git add -A`; never `git checkout/stash/reset`
  (a guard blocks them); never push** — both repos auto-deploy on push and the owner pushes.
- **Bandwidth is metered on Render** — the deployed server now gzips and caches; do not add a
  polling surface without a backoff when the tab is hidden.

## Out of scope unless the owner says otherwise

Payments and payouts; a standalone mobile app (the capture flow runs in the browser and in the POS);
KYB and transaction monitoring (plan the hooks, do not build them); training our own ML models.
If real production authentication for console users turns out to be required, escalate — it is a
platform decision, not a module one.

Do you have any questions before you begin the planning phase?
