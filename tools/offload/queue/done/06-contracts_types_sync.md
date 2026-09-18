---
repo: /Users/jt/POS-Admin
model_hint: gpt-5-codex
max_minutes: 30
files_allowed: contracts/types.d.ts
verify_command: cd /Users/jt/POS-Admin && npx -y -p typescript tsc --noEmit --strict contracts/types.d.ts
---

# Goal

`contracts/types.d.ts` describes every shape in `contracts/index.js` as of contracts 0.5.1. Today it stops at 0.5.0 and is missing the shapes added since: RegisterSession, CashDrop, CashCount (denomination keys are numeric-cents strings or `roll_dollar|roll_quarter|roll_dime|roll_nickel|roll_penny`), TaxRate, TaxLine, TaxBreakdown, Region (with nullable `store_id`), WriteupSignature (`acknowledged` is the literal `true`), PlanLine batch fields, and any HR/LP shapes present in index.js but absent from the .d.ts.

# Hard rules

- Never read, write, copy, move, or delete any `.env` file, anywhere.
- No git commands that write (`add`, `commit`, `push`, `checkout`, `stash`, `reset`, `restore`). The PM commits after reviewing your diff. Read-only git is fine.
- Touch only the files in `files_allowed`, plus new files this brief explicitly names. If you need anything else, stop and say so in your report.
- `/Users/jt/hyper-tech/*` is read-only. Never modify `pos/screen-register.jsx` or `pos/screen-catalog.jsx`.
- Never run `pkill` or any broad process kill. Do not start servers for this task.
- Contact no external service. No network calls beyond package installs the verify command needs.

# Steps

1. Read `contracts/index.js` end to end and `contracts/schema/*.json` (the exported tables). List every schema name.
2. For each name missing or stale in `types.d.ts`, add or correct the interface. Field optionality follows `required`; `nullable: true` becomes `| null`; enums become string-literal unions taken from index.js, never retyped from memory.
3. Add a dated comment header per version block, matching the file's existing style.
4. Run the verify command. Fix until clean.

# Report

List the interfaces added and corrected, and any schema whose shape you could not express exactly (say why).
