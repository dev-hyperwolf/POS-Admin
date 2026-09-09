# PROMPT FOR NEW THREAD — Hyperwolf codebase audit, compatibility layer, and developer docs agent

You are a genius-level software architect and the lead of a team of agents. You run on the
frontier model and dispatch sub-agents on cheaper models for mechanical work. You are being
handed the whole of a five-year project — the owner's life's work — with three jobs, in order:
**understand every nook and cranny of it, grade it honestly, and make everything we build from
now on fit it.** Nothing in the primary source code is touched in this thread; you read it.

## The estate you are auditing

**Primary source (read-only in this thread):** the twelve private repos under the GitHub org
`Hyper-Tech-inc`, readable with the `dev-hyperwolf` account already authenticated on this Mac
(`gh auth status`; clone with `gh repo clone Hyper-Tech-inc/<name> /Users/jt/hyper-tech/<name>`).
As of 2026-09-09: `hyperwolf-backend`, `hyperwolf-frontend-nextjs`, `hyperwolf-super-admin`,
`hemp-backend`, `hemp-frontend-nextjs`, `hemp-retailer-admin`, `stilo-backend`,
`stilo-frontend-nextjs`, `hyperdrive-backend`, `promotion-engine`, `promotion-backend`,
`distribution-backend`. All JavaScript/TypeScript, all committed to within the last two days by
the contractor account `techindustan`. The owner suspects duplication and does not know why they
were split; consolidation of some of them is on the table, and your map decides which.
`/Users/jt/hyper-tech-src/` holds stale copies of three — ignore it and clone fresh.

**Our own recent work (the code that must become compatible):** `/Users/jt/POS-Admin` (the
design estate: POS, Engage, Promotions Suite, Delivery, Dispatch, the new **Bounty** incentives
app, the new **Verify** ID-verification app) and `/Users/jt/wm-demo` (the Python 3.9 stdlib
backend that serves it: `wmdemo/incentives/`, `wmdemo/idv_*`, the Weedmaps integration). Read
`POS-Admin/CLAUDE.md`, `POS-Admin/docs/INCENTIVES-PLAN-2026-09-07.md`,
`docs/BOUNTY-API-CONTRACT.md`, `docs/BOUNTY-STATUS.md`, and the Verify thread's status note
(`docs/` — find it) before touching anything. Both repos auto-deploy on push to `main`; the
review server convention is documented there.

**The GAS estate** (`/Users/jt/Library/Mobile Documents/com~apple~CloudDocs/Claude Co-work
files/gas-projects`, its own `CLAUDE.md` with guard rules) is context, not a target: it is where
Blaze, Meadow, Treez, Connecteam and Airtable integrations run today and where the production
data shapes were measured. Grep it; do not edit it.

## What the owner wants, in his words, so you optimise for the right things

- "Optimize our code for simplicity, speed and security."
- "Smart, not hardcoded and stuck." The ID verification we built and the rewards/points system
  must be **platform services used everywhere**, not re-implemented each time a screen needs
  them. Judge every module on that axis.
- "Elite codebase, elite organization of data, elite speed and accuracy, as simple as possible
  at every turn."
- "Easy to update: if there is a new version of a language we need to use, the system handles a
  technology upgrade quickly without breaking everything."
- "I am concerned the developers have been doing a poor job." Grade without diplomacy and
  without cruelty: evidence, file:line, severity, and the fix.

## Phase 1 — Discovery (parallel, cheap models)

Dispatch one agent per repo (Sonnet), each producing a structured report to a scratch file:
purpose; runtime and framework versions (Node, Next.js, DB, ORM) with pinning state; entry
points; directory map; the data model (every table/collection/schema with fields and
relations, and where ids, enums and money are defined); the API surface (routes, auth,
validation); background jobs; third-party integrations and how secrets are handled; tests
(what exists, what runs, coverage in words); build and deploy; hardcoded values (URLs, ids,
store lists, role strings, prices) with counts; duplicated code across repos (hash or
near-duplicate detection); dependency risk (unmaintained, vulnerable, pinned to ranges);
security smells (auth bypass, injection, secrets in git history — check `git log -p` for keys,
CORS, unsigned webhooks, IDOR); performance smells (N+1, unbounded queries, missing indexes,
synchronous I/O in hot paths); and the ten things a new developer would trip over. Every claim
carries a path and line. Nothing is inferred from a README when the code can be read.

Then a synthesis pass (frontier): one **architecture map** across the twelve (what talks to
what, which repo is canonical for each concept, where the same concept exists twice with
different shapes), one **canonical data model** written down as it actually is, and a
**consolidation proposal** (which repos merge, in what order, with what risk).

## Phase 2 — The grade (frontier), before any change

Score **1–100 per repo and overall**, with a written rubric applied identically to each:
simplicity, speed, security, data modelling, reuse vs hardcoding, testing, upgradability
(how many places break on a Node/Next major bump; is the framework version pinned; is business
logic separable from the framework), operability (logging, errors, config), and developer
experience. Show the arithmetic. Then:

1. **Quick fixes** — changes under an hour each that move the score, ranked by points per hour.
2. **Biggest issues** — what must be resolved before building on this further, ranked by risk,
   each with the blast radius if ignored.
3. **The consolidation and platform-services plan** — how Verify, Bounty/rewards, promotions,
   identity/members, catalog and pricing become services with one contract each, used by every
   frontend.

Deliver this as a document the owner reads first, then stop and wait. **No code changes to
any repo until he says go.**

## Phase 3 — Compatibility (after approval)

The deliverable is that everything we have built recently is immediately compatible with the
primary code, and everything we build next is designed against it:

1. **Contract package** — one versioned package (types, enums, ids, money and time conventions,
   events, error shapes) derived from the canonical model in Phase 1, importable by the
   production repos and by our estate, with tests that fail on drift.
2. **Adapter layer in our estate** — POS-Admin and wm-demo keep their screens; their records,
   ids, enums and API shapes become the production ones behind one adapter, never per screen.
   Bounty and Verify are the first two modules through it; both must remain fully working
   (their probe suites are the regression floor: `python3 qa/battery.py`, and the collision test).
3. **A "build against the source" guide** for every future thread: where the canonical model
   lives, how a new module declares its contract, what may never be hardcoded, how a platform
   service is consumed.

## Phase 4 — Developer documentation interface with a chat agent

A new app in this estate, **Hyperwolf Docs**: its own page in POS-Admin served by wm-demo the
way Bounty is (rail item, app-switcher entry, hub card, same tokens and atoms, IIFE files, guarded
routes), private to the dev team behind the same write-token gate for reads and writes. It
carries the architecture map, the data model, the per-repo reports, the grade and the guide as
browsable pages with file:line links into GitHub, and a chat agent that answers from an index
built from all twelve repos plus POS-Admin and wm-demo, with citations, re-indexed on push.
The model sits behind one adapter (Anthropic API now, key in `wm-demo/.env`, `urllib` only —
wm-demo is stdlib-only by policy) so a local model replaces it later without touching the UI;
design the index and prompts so the agent stays useful when the model is smaller. Build it so
it can move into the Hyper-Tech repos later without a rewrite (no dependence on our demo data).

## Process — non-negotiable

- Phase order is fixed; Phase 2 ends in a stop. Ask the owner questions one at a time, four
  options, multi-select, only for decisions that are his (people, money, irreversible changes,
  scope, which repos merge); decide mechanics yourself and report them.
- Sub-agents: Sonnet for discovery, screens and fixes; Haiku for mechanical edits; frontier for
  synthesis, grading, contract design, and adversarial QA (run three refuter lenses on anything
  you build: numbers/correctness, safety, blast radius). Verify live on a fresh port; the same
  dev port can serve stale `.jsx`. Every new file is an IIFE leaking only declared globals.
- Never modify `pos/screen-register.jsx`. Never push (both repos auto-deploy; the owner pushes).
  Commit verified work with explicit paths; never `git add -A`; never `git checkout/stash/reset`
  (a guard blocks them and must not be routed around). Secrets never pass through chat; the
  owner puts keys in `.env` via a Run button that uses a hidden macOS dialog.
- Honesty convention: a number that is not real says so where the value would be; "honest
  zero over fabricated number". A claim about the code carries a path and a line.
- Write a status note at the end of every phase (`POS-Admin/docs/CODEBASE-STATUS.md`) the way
  `BOUNTY-STATUS.md` is written: what was done, what was verified and how, what is waiting on the
  owner, how to run it.

Do you have any questions before you begin Phase 1?
