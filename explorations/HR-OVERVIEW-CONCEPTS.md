# HR Overview — Four Concepts (M1, read-only)

Source: `docs/migration/MIGRATION-PLAN-2026-09-16.md` §1 (M1 Overview screen) + §2 (roles);
`docs/migration/HR-DASHBOARD-INVENTORY.md` (GAS dashboard being replaced, Table-A doc-expiry
false-positive bug). Data: `/Users/jt/wm-demo/wmdemo/hr/api.py` routes, fixtures in
`/Users/jt/wm-demo/qa/fixtures/hr/*.json` (synthetic people, no real names or PII). Tokens
inlined from `pos/tokens.jsx` + `shared/hd-ui.jsx`.

## Concept A — Day Board

**File:** `explorations/HR Overview - Concept A - Day Board.html`

**Defining idea:** the screen is a single urgency-ranked list of cards — "what needs a look
today" — with a thin four-tile stat strip on top rather than the point of the page; clicking a
card opens a right-hand drill-down panel instead of navigating away. Low-urgency items (a doc
that's merely "current," a closed incident) simply never get a card, so the list stays short by
construction rather than by pagination.

**What differs from B/C/D:** no table anywhere on the page — every record becomes a card, ranked
by a single urgency ladder (expired doc > high-severity open incident / no-call-no-show > doc
expiring soon > other open incident) rather than grouped by type (C's lanes) or folder (D's
inbox) or listed as a roster (B). The "needs a person" queue is a horizontal scroll strip above
the board, not a sidebar or a folder — it's meant to be the first thing scanned, before the
ranked list. Drill-down is a modal-style side panel per card, not an expanding row or a
persistent detail pane.

**Questions for JT/HR:**
1. The urgency ladder here is hardcoded (expired docs first, then high-severity/no-shows, then
   expiring docs, then other open incidents) — is that actually the priority order HR would set,
   or does it need to be configurable (e.g., a no-call-no-show might outrank an expired
   `vehicle_insurance` doc for a non-driving role)?
2. A single flat ranked list caps out fast — at what count of same-day items does "everything is
   a card" stop working and this needs to fold into folders (closer to Concept D) or a table
   (closer to Concept B)?
3. The side panel currently has zero actions (M1 is read-only) — once M4 write actions exist,
   should they live in this same panel, or does a real action always warrant its own dedicated
   screen given the PIN step-up requirement on most of them?

## Concept B — People First

**File:** `explorations/HR Overview - Concept B - People First.html`

**Defining idea:** Overview *is* the roster — one row per person (name, role, entity, store, doc
status, last incident, last call-off), filterable at the top, with everything the other concepts
foreground (headline counts, the needs-a-person queue, the role/PII explainer, the doc-expiry fix
callout) demoted to a secondary right rail. If HR opens this screen wanting to know "who," the
answer is already the first thing on screen.

**What differs from A/C/D:** the primary artifact is the person, not the document (C) or the
inbox item (D) or the urgency card (A) — each row already carries doc status, last incident and
last call-off as columns, so a single scan of the table answers "who's clean and who isn't"
without opening anything. Clicking a row expands an inline detail strip under the table rather
than a side panel (A) or navigating elsewhere. Filtering is column-oriented (entity, status, doc
status, name search) rather than folder- or lane-based.

**Questions for JT/HR:**
1. "Last incident" and "last call-off" are single most-recent values per person — is that enough
   for a roster glance, or does HR need a rolling count (e.g., "3 in 90 days") visible in the row
   itself, which would need `total_incidents`/`writeup_count`-style aggregates the People route
   would have to compute per row rather than per list?
2. The doc-status filter groups by computed status (current/expiring/expired/missing) — should
   "missing" (no Table A row at all, four employees in the fixtures) read as a data gap to chase,
   or is "no docs tracked for this role" sometimes the correct, unremarkable state (e.g., a
   manager title with no driver's license requirement)?
3. This concept is the closest of the four to the retired GAS dashboard's People screen rather
   than its Overview screen — is that convergence actually what HR wants from "Overview" (a
   people-first landing page), or should Overview and People stay visibly distinct screens even
   if their underlying data overlaps this much?

## Concept C — Compliance Wall

**File:** `explorations/HR Overview - Concept C - Compliance Wall.html`

**Defining idea:** a timeline wall (Overdue / ≤30d / 31–60d / 61–90d lanes) of documents by
expiry week, one card per person, colored by live status — built for the person whose job is
chasing renewals, not for a store manager glancing at their phone.

**What differs from D:** desktop-density, all-at-once layout (four lanes visible
simultaneously, no folder switching); the primary artifact is the document, with incidents and
call-offs demoted to secondary strips underneath; no triage/inbox-state model at all — a
document's state is entirely a function of `RENEWAL_DATE` vs. today, recomputed live in the
browser exactly like `wmdemo/hr/airtable_read.py:compute_doc_status`, so there is nothing to
mark "seen."

**Questions for JT/HR:**
1. The wall's four lanes (Overdue/30/60/90) match the route's `days` param shape, but do renewal
   chasers actually think in fixed 30-day bands, or would per-doc-type SLAs (e.g., cannabis
   handler permits get flagged earlier than food handler cards) be more useful?
2. Should the "Table A STATUS disagrees" annotation (shown inline on flagged cards, e.g.
   `rec_doc_002`/`rec_doc_008`) stay visible permanently as a trust-building signal, or is it
   only a migration-week crutch that should disappear once Table A itself gets corrected?
3. The secondary incident/call-off strips currently show every fixture record with no date
   filter beyond the mockup's illustrative window — in production, should this screen apply the
   same `since=` default as the People screen, or is a longer lookback appropriate here since
   the wall's whole point is forward-looking risk?

## Concept D — Manager Inbox

**File:** `explorations/HR Overview - Concept D - Manager Inbox.html`

**Defining idea:** a single triaged inbox (incident / call-off / expiring doc / pending
write-up, one feed) with folder badges as counts and keyboard-first triage states (new / seen /
waiting on person / done) — built for a store manager working from a phone between customers,
not a desk-bound compliance review.

**What differs from C:** phone-width-first (480px canvas, centered and framed at tablet width
rather than stretched full-bleed), one item type per row instead of a document wall, and an
explicit triage-state model layered on top of read-only data (the state itself is a client-only
demo artifact — M1 has no write route, so nothing is actually persisted; a real triage-state
write is out of scope until a later phase). "Needs a person" is its own folder rather than a
footer section, so it survives folder-switching instead of always being visible.

**Questions for JT/HR:**
1. Triage state (new/seen/waiting/done) has no backing field in any M1 route or fixture — is
   this worth a real per-manager, per-item write table later (which table/base?), or should
   inbox state just be derived automatically (e.g. "seen" = viewed detail, "done" = the
   underlying record's own status changed) with no separate state to maintain?
2. The mockup treats one call-off type (`no_call_no_show`) and one incident outcome (closed +
   evidence, no write-up filed) as automatically inbox-worthy — is that the right trigger set for
   "needs a manager," or should HR define an explicit rule list (severity ≥ high, or dismissed
   twice, etc.) rather than leaving it to inference?
3. Real managers may supervise employees across both entities (per `reports_to`,
   `Server.js:5384`) — should the entity switcher instead be a multi-select scoped to "my
   reports," replacing the two-entity toggle shown here once the reports-to graph is wired up?

## Shared across C and D (per the M1 owner decisions)

- Both compute document status **only** from `RENEWAL_DATE` (never Table A's stale `STATUS`
  column) and both surface at least one example row where the two disagree — `rec_doc_002`
  (Marcus Webb, cannabis handler permit: Table A says "Expired", renewal is 14 days out) is the
  flagged row in both concepts; `rec_doc_008` (Owen Patel, 2 days out) is a second instance
  visible in the fixtures but not separately called out.
- Both render "Needs a person" (approve & send, reveal SSN, escalate to write-up) as visibly
  disabled with an `M4` tag — no click does anything, per M1 being read-only.
- Both carry a role chip stating `hr:read` and naming exactly what it hides (SSN, DL, passport,
  home address, emergency contact) rather than implying "everything except this row is safe."
- Neither concept fetches or displays a restricted field anywhere, including in JS fixture
  data — the mockups only ever transcribe `EMPLOYEES_LIST_FIELDS`-shaped fields from
  `airtable_read.py`, never `_EMP_RESTRICTED_FIELD_IDS`.

## Data the routes do not expose that a screen wanted

- **Entity display names.** `GET /api/hr/employees` returns raw `entity_id` strings
  (`"highest-craft"`, `"circle-city"`) with no separate human-readable label field in the
  `HrEmployee` contract — both concepts hardcode the "Highest Craft Store"/"Circle City Store"
  labels client-side from the fixture's own `location` field, which happens to work here but
  isn't guaranteed to hold for every entity.
- **A per-item "why is this in the inbox" reason code.** Concept D's triage/needs-person
  grouping is inferred client-side (closed + has evidence = escalate candidate) because no route
  returns an explicit flag for "this incident is missing its write-up" — `Incident` has no
  `writeup_id` or `has_writeup` field in what `/api/hr/incidents` returns.
- **"Today" as a server concept.** Every M1 route takes `since=`/`days=` as caller-supplied
  params with no default tied to a server clock exposed to the client — both concepts had to
  simulate "today" and "call-offs today" against the fixtures' fixed 2026-09-02→09-08 date range
  rather than a live value, which is called out as illustrative in both files' footers.
