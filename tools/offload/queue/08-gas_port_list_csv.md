---
repo: /Users/jt/POS-Admin
model_hint: gpt-5-codex
max_minutes: 20
files_allowed: docs/migration/GAS-PORT-LIST-2026-09-17.csv
verify_command: cd /Users/jt/POS-Admin && python3 -c "import csv;r=list(csv.DictReader(open('docs/migration/GAS-PORT-LIST-2026-09-17.csv')));print(len(r),sorted(r[0].keys()))"
---

# Goal

`docs/migration/GAS-PORT-LIST-2026-09-17.csv`: a spreadsheet-ready copy of `docs/migration/GAS-PORT-LIST-2026-09-17.md` so the owner can sort and filter the Apps Script estate by decision.

# Hard rules

- Never read, write, copy, move, or delete any `.env` file, anywhere.
- No git commands that write (`add`, `commit`, `push`, `checkout`, `stash`, `reset`, `restore`). The PM commits after reviewing your diff. Read-only git is fine.
- Touch only the files in `files_allowed`, plus new files this brief explicitly names. If you need anything else, stop and say so in your report.
- `/Users/jt/hyper-tech/*` is read-only. Never modify `pos/screen-register.jsx` or `pos/screen-catalog.jsx`.
- Never run `pkill` or any broad process kill. Do not start servers for this task.
- Contact no external service. No network calls beyond package installs the verify command needs.

# Steps

1. Read the markdown list. Every Apps Script project in it becomes one row.
2. Columns, in this order: project, purpose, triggers, external_systems, recommendation (port, keep, retire, merge), target_module, status (not_started, in_progress, ported, verified), effort, blocking_decision, notes. Take values only from the markdown and from `docs/migration/FORMS-MIGRATION-MATRIX-2026-09-17.md`, `docs/migration/PORT-PLAN-*.md`; leave a cell empty rather than guess.
3. Quote every cell; escape embedded quotes; prefix any cell that starts with =, +, - or @ with a single quote so spreadsheet apps do not treat it as a formula.
4. Run the verify command.

# Report

Row count and any project whose recommendation was ambiguous in the source.
