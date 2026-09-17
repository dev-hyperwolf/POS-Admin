# Promo Rules — Rule-Builder Concepts

Four concepts for the `hw.rule.v1` promotion rule-builder screen (plan §2.5). Same tokens, same seeded batches/rules, each concept genuinely different for the inventory team to pick from.

## Concept C — Batch-First Picker

**File:** `explorations/Promo Rules - Concept C - Batch Picker.html`

**The one idea that defines it:** start from the batch list you already trust (age, THC, on-hand,
packaged/received date — sortable, oldest-first by default), check the batches you actually want
to move, and let the screen derive the narrowest `if.all` condition set that covers exactly that
selection — shown as loosenable chips (`batch.thc_pct gte`, `batch.packaged_at older_than_days`)
with a live "what else would this catch" readout before you touch a form field.

**What differs from the others:** every other concept starts from a rule shape (a sentence, a
table, an agent prompt) and asks the operator to describe intent in the abstract. C starts from
concrete inventory and reverses the direction — intent is inferred from a selection, not typed.
It is the only concept where the condition values are *never hand-entered*; they are computed from
whichever batches are checked, and loosening is a stepper on a derived threshold, not a blank
field. It is also the only concept that visibly separates "fields that describe a batch you can
target" from "fields that only help you decide" — on-hand quantity sorts and displays but never
becomes a condition, because `batch.qty_on_hand` isn't a `RuleField`.

**Three questions for the inventory team:**
1. When a selection can't be reduced to one clean threshold per field (e.g. you check a low-THC
   batch and a high-THC batch but skip the one in between), should the picker fall back to an
   explicit `in` list of `batch_no`-adjacent identifiers, or refuse and ask you to split into two
   rules? Batch-level identity beyond `batch_no` isn't in the derivable condition set today.
2. Is "oldest first by default" actually the sort operators want, or is "lowest on-hand first"
   (i.e., dwindling stock they need to move before they're stuck with it) the more common starting
   point?
3. "What else would this catch" only warns about batches that exist *right now*. Should it also
   warn when a newly received batch could silently join the rule later (e.g. this THC threshold
   will keep matching every future harvest at 31%+), or is that expansion the whole point of a
   threshold-based rule instead of a `batch_no` enumeration?

## Concept D — Agent Draft Review

**File:** `explorations/Promo Rules - Concept D - Agent Draft Review.html`

**The one idea that defines it:** the screen is the approval record, not just an editor. Left
column shows exactly what the agent was asked and its plain-English reading of what it built;
center shows the generated rule read-only until `Edit`; right shows the live preview plus a
running audit trail. Activating anything with `meta.source: "agent"` is never a single click — the
Activate control stays disabled with "needs promos:activate — a person" until a human has gone
through Edit, at which point the rule carries a human author of record.

**What differs from the others:** C, A, and (presumably) B all treat "build a rule" as the
subject of the screen. D treats "should this agent-authored rule be trusted" as the subject —
the rule itself is secondary to provenance (who/what proposed it, why, and what a reviewer did
about it). It's the only concept where three rules are shown side-by-side specifically to contrast
governance paths: an agent draft still pending review (Activate disabled), a UI-authored rule
that's live (Activate/Pause enabled), and a paused UI-authored rule — plus two history entries
(one activated, one rejected with a reason) that never depend on which rule is currently selected,
so the audit trail reads as an institutional log, not a per-rule footnote.

**Three questions for the inventory team:**
1. Today `Edit` is presented as the *only* path to activating an agent draft (touch something,
   even trivially, and a human becomes the author of record). Is that too strict — should a
   reviewer be able to activate an untouched agent draft outright, with their approval alone
   standing in for "a person," rather than being forced through Edit first?
2. The audit trail mixes rule-specific events (drafted, edited) with two standing institutional
   examples (an activation, a rejection) that aren't about the currently-selected rule. Is that
   confusing in the real screen, or is a single global activity feed actually what reviewers want
   instead of a per-rule trail?
3. `meta.prompt` is stored verbatim and shown verbatim on the left. If a prompt contains something
   a reviewer shouldn't see unredacted (a customer name, an internal margin target), is there a
   redaction path, or is "the prompt that produced it" meant to always be fully visible for audit
   purposes, no exceptions?

## Concept A — Sentence Builder

**File:** `explorations/Promo Rules - Concept A - Sentence Builder.html`

**The one idea that defines it:** the rule *is* one plain-English sentence, and every clause in it
is a real, backing `RuleField`/`RuleOp` chip — never free text. "+ Add condition" appends a new
clause to the sentence and to the JSON panel underneath it in the same action, so the two views
never drift out of sync. `all`/`any`/`not` render as inline connector words (ALL / ANY / NONE)
rather than as a visible tree, and the recursive renderer walks arbitrary nesting depth, so the
depth-3 `not`-wrapping-`any` clause in the seeded nested rule reads as "…or (none of: customer
tier is bronze)" instead of exposing its bracket structure.

**What differs from the others:** B is a spreadsheet you scan; A is a sentence you read start to
finish, and editing happens *inside* the prose instead of beside it. It is the only concept of
the two where changing a condition's field also live-resets its op and value to something legal
for the new field's type (a swap from `batch.thc_pct` to `customer.tier` doesn't leave `gte 30`
sitting there as a now-invalid combination) — B, being read-mostly, doesn't need that guard.

**Three questions for the inventory team:**
1. The sentence hides the group tree behind connector words (ALL/ANY/NONE) precisely so it reads
   as prose. Once a rule has two or three nested `any`/`not` blocks (like the seeded nested-depth-3
   rule), does the sentence stay readable, or does the prose format start fighting the structure it's
   hiding — at what point should this concept fall back to showing brackets?
2. "+ Add condition" always appends to the top-level `all` array. Should the picker let you choose
   which group (`all`/`any`/`not`, at any depth) a new clause joins, or is defaulting to `all` and
   asking the operator to drag it later the simpler mental model?
3. Every value editor here is a bare `<input>` for anything that isn't a closed enum — including
   `between` (wants exactly 2 values) and `in`/`not_in` (wants a list), both entered as
   comma-separated text. Is that acceptable for a first cut, or do those two op shapes need
   dedicated two-box / tag-list controls before this concept is buildable?

## Concept B — Condition Table

**File:** `explorations/Promo Rules - Concept B - Condition Table.html`

**The one idea that defines it:** every cell in the per-batch match columns is a real, three-valued
evaluation computed on the page from the rule tree and the seeded batch list — not a screenshot of
a number. `true`/`false` render as a green check or a red highlighted fail; wherever a condition
needs order- or customer-scoped data the batch list doesn't carry (`order.channel`,
`customer.tier`), the cell honestly shows "–" (context-dependent) instead of guessing, and an
"Overall (batch/product fields only)" row rolls that same three-valued logic up per batch. That is
also why the live-preview panel below the table can show a different, more complete number for the
nested rule (it stands in for evaluation against an actual cart, order and customer included) —
the caption says so explicitly rather than leaving two numbers looking like they disagree.

**What differs from the others:** A reads top-to-bottom as one sentence; B reads left-to-right as a
grid, with ALL/ANY/NOT as indented labelled blocks instead of connector words, so a reviewer can
scan a wide rule for which single row is failing a given batch without reading the whole thing.
It's the only concept of the two that actually re-derives pass/fail live rather than stating a
static "matches N" figure everywhere — the table's evaluator is a real (if intentionally
batch-only) implementation of the group semantics in RULE-SHAPE.md §1, including empty-array
"no restriction," `not` as NOR, and three-valued propagation through nested groups.

**Three questions for the inventory team:**
1. The "Overall" row is honest about being batch/product-only and shows "–" the moment any row
   needs order or customer context — which means any rule mixing `order.*`/`customer.*` conditions
   with batch conditions will *always* show "–" for every batch in this table. Is a row that can
   never resolve to true/false still useful, or should context-dependent rules suppress the Overall
   row entirely and point straight at the live-preview panel?
2. Rows are flattened out of the nested tree with a breadcrumb label like "ANY → NOT → ANY" instead
   of visual indentation/brackets. Is the breadcrumb legible enough once a rule nests three or four
   levels, or does this concept need an actual indented block layout (nested boxes, like the plan's
   own description of Concept B) rather than a flat table with text breadcrumbs?
3. Field/op/value cells are plain read-only text in this pass — there's no in-table way to edit a
   condition, only to read it (editing lives in Concept A instead). Should the inventory team be
   able to edit a condition value directly in this table (e.g. double-click the value cell), or is
   "table for review, sentence for editing" an acceptable split of labor between the two concepts?
