---
repo: /Users/jt/POS-Admin
model_hint: gpt-5-codex
max_minutes: 30
files_allowed: docs/CODEBASE-STATUS.md
verify_command: cd /Users/jt/POS-Admin && grep -n "^## " docs/CODEBASE-STATUS.md
---

# Goal

`docs/CODEBASE-STATUS.md` is stale: its most recent dated entry is
"Updated 2026-09-09 (late)" and its newest section is Phase 5
(2026-09-10). A whole build program (`docs/BUILD-PROGRAM-MASTER-PLAN-2026-09-16.md`)
ran since then, and that plan's own §9 "Progress log (appended as work
lands)" already has the accurate, dated, evidence-cited record of what
shipped — versions, commit hashes, suite names, check counts, floors. When
this is done, `docs/CODEBASE-STATUS.md` has a new section summarizing that
program's state as of its latest log entry (2026-09-17 early), in the same
evidence-citing style the rest of the file already uses, and nothing in the
existing file is deleted or contradicted — this is a refresh/append, not a
rewrite.

# Hard rules

- Never touch any `.env` file.
- No git commands that write — the PM commits after review.
- Only edit `docs/CODEBASE-STATUS.md`. Read
  `docs/BUILD-PROGRAM-MASTER-PLAN-2026-09-16.md` as your source — do not
  edit that file, it is the plan of record and stays exactly as is.
- Do not delete or rewrite any existing section of `docs/CODEBASE-STATUS.md`
  (Phase 4, Phase 5, Phase 3, Phases 1-2, "Where it stands", etc.) — add a
  new section. If something existing is now factually contradicted by the
  new information, note the contradiction in the new section rather than
  silently editing the old one.
- Every fact you write must be traceable to something actually written in
  `BUILD-PROGRAM-MASTER-PLAN-2026-09-16.md` §9 (or another already-committed
  doc it cites) — do not infer, estimate, or round a number you did not
  read. If §9 says something is "in progress" or a decision is still open,
  say that, not a made-up completion.
- Foreground, `max_minutes` cap above (this is a reading + writing task,
  should be well inside it).

# Steps

1. Read `docs/BUILD-PROGRAM-MASTER-PLAN-2026-09-16.md` §9 (search for
   "## 9. Progress log") end to end — it is the authoritative, dated record
   of what actually shipped, by whom/what track, with commit hashes and
   check counts. Also skim §0, §7, and §8 briefly for context (what the
   plan intended, what risks/findings are NOT this program's to fix) so
   your summary doesn't misstate scope.
2. Read `docs/CODEBASE-STATUS.md` in full to learn its existing voice and
   structure: short prose paragraphs per module/phase, a `| Piece | Where |
   Proof |`-style table where a table fits, explicit check counts and
   commit hashes inline, an "Owner decisions still open" or "Not done yet"
   line where relevant. Match this, don't invent a new format.
3. Add a new section — something like
   `## Build program (2026-09-16/17) — status` — placed logically (either
   right after the top intro/before "## Modules on the contract", or at the
   end before "## Phases 1-2", your call; explain your placement choice in
   your report). Cover, for each track/team mentioned in §9:
   - what shipped, with its commit hash(es) as written in §9 (do not
     abbreviate or alter a hash)
   - the suite/probe name(s) and check counts / floors named in §9 (e.g.
     the wm-demo full battery total and floor, security-gate probe's
     pass/fail/skip breakdown, any named EXPECTED_CHECKS-style number) —
     transcribe exactly, don't recompute
   - anything §9 explicitly says is still in progress or still open —
     phrase it as open, not done
   - the contracts version number(s) mentioned (e.g. if §9 references a
     contracts version bump alongside a track's commit, name it)
4. Update the file's own "Updated" line (near the very top,
   `Updated 2026-09-09 (late). Phases 1, 2, 3 and 4...`) to reflect the new
   section — append rather than replace, e.g. extend the sentence to note
   the build program section covers through 2026-09-17, keeping the
   original Phase 1-4 sentence intact.

# Verify

```
cd /Users/jt/POS-Admin && grep -n "^## " docs/CODEBASE-STATUS.md
```
Success: the existing section headings are all still present, unchanged,
in the same order, plus your one new heading. Additionally, spot-check that
every commit hash and check-count number you wrote appears verbatim
somewhere in `docs/BUILD-PROGRAM-MASTER-PLAN-2026-09-16.md`:
```
cd /Users/jt/POS-Admin && grep -Fn "<hash-or-number>" docs/BUILD-PROGRAM-MASTER-PLAN-2026-09-16.md
```
run that for at least three of the facts you added, and paste the results
in your report.

# Report format

Write `docs/REPORT-05-codebase_status_refresh.md` covering:
- where you placed the new section and why
- a bullet list of every fact (hash/number/status) you transcribed, each
  with the §9 line it came from
- the grep spot-checks from Verify, with output
- anything in §9 you found ambiguous or under-specified and chose to leave
  out rather than guess
