---
repo: /Users/jt/POS-Admin
model_hint: gpt-5-codex
max_minutes: 45
files_allowed: docs/CONCEPT-PAGES-A11Y-AUDIT-2026-09-17.md
verify_command: cd /Users/jt/POS-Admin && grep -c "^## " docs/CONCEPT-PAGES-A11Y-AUDIT-2026-09-17.md
---

# Goal

A read-only audit report, `docs/CONCEPT-PAGES-A11Y-AUDIT-2026-09-17.md`, covering the twelve concept mockups the inventory and HR teams are reviewing: `explorations/Promo Rules - Concept A..D.html`, `explorations/HR Overview - Concept A..D.html`, `explorations/LP Triage - Concept A..D.html`, plus the three review pages under `explorations/review/`. No HTML file is edited.

# Hard rules

- Never read, write, copy, move, or delete any `.env` file, anywhere.
- No git commands that write (`add`, `commit`, `push`, `checkout`, `stash`, `reset`, `restore`). The PM commits after reviewing your diff. Read-only git is fine.
- Touch only the files in `files_allowed`, plus new files this brief explicitly names. If you need anything else, stop and say so in your report.
- `/Users/jt/hyper-tech/*` is read-only. Never modify `pos/screen-register.jsx` or `pos/screen-catalog.jsx`.
- Never run `pkill` or any broad process kill. Do not start servers for this task.
- Contact no external service. No network calls beyond package installs the verify command needs.

# Steps

1. For each file, read the markup and inline styles and script. Do not run a browser.
2. Record per file: missing labels on inputs and buttons, non-button click targets without role and key handling, colour pairs that fail WCAG AA contrast (compute from the hex values), fixed widths that break below 390 px, tap targets under 44 px, focus order problems, tables without header cells, and text baked into images.
3. One `## <file name>` section per file with a findings table: issue, element or selector, line number, severity (blocker, should-fix, nice-to-have), suggested fix in one sentence.
4. End with a cross-file summary: the five most common issues and which shared component would fix each once.

# Report

The path of the report and the count of blockers per file.
