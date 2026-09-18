---
repo: /Users/jt/wm-demo
model_hint: gpt-5-codex
max_minutes: 25
files_allowed: docs/README.md
verify_command: cd /Users/jt/wm-demo && python3 -c "import re,os;t=open('docs/README.md').read();links=re.findall(r'\]\(([^)#]+)',t);missing=[l for l in links if not os.path.exists(os.path.join('docs',l))];print(len(links),'links',missing)"
---

# Goal

`docs/README.md` (Codex's own index from task 09, 2026-09-17) covers all 62
`docs/*.md` files and passes its own link check at 270/270. It does NOT cover
the six TypeScript module docs under `platform/modules/*/README.md`
(`dispatch`, `restock`, `health`, `tax`, `register`, `promotions-rules`) --
those live outside `docs/` and were never in scope for task 09's "list every
`docs/*.md`" step. When this is done, the index also covers those six, in a
new subsection of "## Platform and migration" (the section that already
covers architecture/platform docs), with the same one-sentence-summary +
Flags treatment every other row gets, and the file's own top-of-file "As of
2026-09-17: **62 source documents**" sentence and "## Flag to doc" table are
updated to match the new total.

# Important: verify each named premise yourself before writing anything

This brief's own instructions (from the PM who queued it) claimed
`docs/SALES.md`, `docs/METRC-API-CONDUCT.md`, `docs/METRC.md`,
`docs/REALTIME-DEMO.md`, `docs/DATA-SYNC.md`, and `docs/AWS-*.md` might be
missing from the index and might need adding. **That premise is false --
verify it yourself first, do not re-add anything already there:** all of
them are already `docs/*.md` files and the current `docs/README.md` already
indexes all 62 `docs/*.md` files including every one of these (confirm with
`grep -n "SALES.md\|METRC-API-CONDUCT.md\|METRC.md\|REALTIME-DEMO.md\|DATA-SYNC.md\|AWS-"
docs/README.md`). The **real, unindexed gap** is only the six
`platform/modules/*/README.md` files named above -- those are the only
files this brief adds.

The brief also claimed you should "grep `os.environ` in
`wmdemo/pos_sale_lines.py` (read-only)" to list env flags the sale-lines work
added. Do that grep (`grep -n "os\.environ" wmdemo/pos_sale_lines.py`) and
report exactly what it returns -- as of this writing it returns **nothing**
(`pos_sale_lines.py` defines no new `WM_*`/`HW_*` flag), so there may be
nothing to add to the Flag to doc table from that file. Do not invent a flag
that isn't there to make the section feel complete.

# Hard rules

- Never read, write, copy, move, or delete any `.env` file, anywhere.
- No git commands that write (`add`, `commit`, `push`, `checkout`, `stash`,
  `reset`, `restore`). Read-only git (`status`, `diff`, `log`) is fine. The
  PM commits after review, with explicit paths -- never `git add -A`/`.`.
- Touch only `docs/README.md`. This repo has uncommitted work by other
  agents/sessions in flight -- do not touch, stage, or comment on any other
  file, even one that looks related.
- `/Users/jt/hyper-tech/*` is read-only reference material -- not relevant to
  this task, but never edit anything under it regardless.
- Never run `pkill -f` or any broad process kill. This task needs no server
  and no database -- if you find yourself wanting to boot one, stop, you've
  gone off scope.
- Never contact a real external service. This task is pure local file
  reading and one local Markdown file edit.
- Foreground run, `max_minutes` cap above -- this is a reading + writing
  task and should be well inside it.

# Steps

1. Read `docs/README.md` in full (234 lines) to learn its exact structure:
   the intro paragraph (including the "As of 2026-09-17: **62 source
   documents**" sentence and the Flags-column conventions paragraph), the
   five `##` group tables (Security, Modules, Integrations, Platform and
   migration, Operations), and the "## Flag to doc" table at the end
   (currently 131 distinct names/families).
2. Read the first 60 lines of each of the six module docs (whole file if
   shorter): `platform/modules/dispatch/README.md`,
   `platform/modules/restock/README.md`, `platform/modules/health/README.md`,
   `platform/modules/tax/README.md`, `platform/modules/register/README.md`,
   `platform/modules/promotions-rules/README.md`. For each, grep the WHOLE
   file (not just the first 60 lines) for `WM_[A-Z0-9_]*` and `HW_[A-Z0-9_]*`
   to build its accurate Flags list -- don't guess from the header alone.
3. Add a new subsection under "## Platform and migration" -- something like
   a sentence ("The TypeScript port lives under `platform/`; each module has
   its own README:") followed by a small table with the same
   `| Document | Summary | Flags |` shape as the existing tables, one row
   per module. Link relative to `docs/` (e.g.
   `[dispatch](../platform/modules/dispatch/README.md)`) so the existing
   link-check regex (which resolves every link against `docs/` as the base)
   finds the real file.
4. Confirm the pos_sale_lines.py finding from the "Important" section above
   (real grep, not assumed) and, if it genuinely returns nothing, say so in
   your report rather than adding a flag row for it.
5. Update the "## Flag to doc" table for the new module docs' *real* flags
   only (per your step-2 greps) -- add each module doc as another linked
   document for any flag name it names that's already in the table, or a new
   row for a flag that isn't in the table yet. Keep the table's existing
   sort-by-name order and the file's own count callout convention.
6. Update the top intro sentence: "**62 source documents**" becomes "**62
   source documents plus 6 platform module docs**" (or similar -- your
   wording, keep it in the file's existing voice), and update the "Flag to
   doc" section's own "**131 distinct names/families**" count sentence if
   your step 5 changed the count.
7. Run the verify command. The link count goes from 270 to 270 + (however
   many new links you added, at least 6 for the module docs themselves), and
   `missing` must be `[]`.

# Verify

```
cd /Users/jt/wm-demo && python3 -c "import re,os;t=open('docs/README.md').read();links=re.findall(r'\]\(([^)#]+)',t);missing=[l for l in links if not os.path.exists(os.path.join('docs',l))];print(len(links),'links',missing)"
```
Success: prints a link count of at least `276` (270 existing + 6 new module
doc links, more if you linked the same flag to a module doc more than once
in the Flag to doc table) and `missing []`. Also spot-check by hand that
`platform/modules/dispatch/README.md` (etc.) actually opens at the relative
path you wrote, from a file inside `docs/`.

# Security notes

None of this touches code, auth, or data -- it's a documentation index. The
only risk is a stale or wrong Flags list misleading a future reader into
thinking a module reads/writes an env var it doesn't (or missing one it
does) -- that's why step 2 says grep the whole file, not the first 60 lines.

# What NOT to do

- Do not re-add SALES.md/METRC-API-CONDUCT.md/METRC.md/REALTIME-DEMO.md/
  DATA-SYNC.md/AWS-*.md -- they're already indexed, see "Important" above.
- Do not touch any file other than `docs/README.md`.
- Do not invent an env flag for `pos_sale_lines.py` if the grep is empty.
- Do not renumber or reorder the five existing `##` group tables, or remove
  any existing row.

# Report format

Write your findings to stdout (this brief has no dedicated REPORT file --
say so explicitly in your final message) covering:
- confirmation that the six named docs (SALES.md etc.) were already indexed
  before you started (paste the grep line proving it)
- the pos_sale_lines.py os.environ grep, verbatim, and what you concluded
- the six module doc summaries + flags you added, one line each
- the verify command's final output (link count + missing list)
- old vs. new document/link/flag counts

# Log entry

Append a section to `POS-Admin/docs/CODEX-HANDOFF-LOG.md` (commit it on
whatever branch this session's other work is landing on, following that
branch's own commit norms -- explicit paths, never `add -A`/`.`, never
push) in the same shape as its existing "## NN -- <title> -- COMPLETE"
entries (see the entries for tasks 05/06/09 already in that file for the
exact style: Files, a two-line summary of what changed and why, Checks with
the real command + output, Limits/ambiguities, and any owner question as a
multiple choice). Title it "## 10 -- Docs index refresh (wave 4 module
READMEs) -- COMPLETE" (or "-- BLOCKED" with why, if you hit a real wall).
