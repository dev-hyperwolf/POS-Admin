---
repo: /Users/jt/wm-demo
model_hint: gpt-5-codex
max_minutes: 30
files_allowed: docs/README.md
verify_command: cd /Users/jt/wm-demo && python3 -c "import re,os;t=open('docs/README.md').read();links=re.findall(r'\]\(([^)#]+)',t);missing=[l for l in links if not os.path.exists(os.path.join('docs',l))];print(len(links),'links',missing)"
---

# Goal

`docs/README.md` in wm-demo: one index of every document under `docs/`, grouped (Security, Modules, Integrations, Platform and migration, Operations), each with a one-sentence summary and the environment flags that document introduces. A new developer should find the right doc in under a minute.

# Hard rules

- Never read, write, copy, move, or delete any `.env` file, anywhere.
- No git commands that write (`add`, `commit`, `push`, `checkout`, `stash`, `reset`, `restore`). The PM commits after reviewing your diff. Read-only git is fine.
- Touch only the files in `files_allowed`, plus new files this brief explicitly names. If you need anything else, stop and say so in your report.
- `/Users/jt/hyper-tech/*` is read-only. Never modify `pos/screen-register.jsx` or `pos/screen-catalog.jsx`.
- Never run `pkill` or any broad process kill. Do not start servers for this task.
- Contact no external service. No network calls beyond package installs the verify command needs.

- This repo has uncommitted work by other agents. Create ONLY `docs/README.md`. Edit nothing else.

# Steps

1. List every `docs/*.md`. Read the first 60 lines of each.
2. Write the grouped index. For each doc: relative link, one sentence, and a "Flags" list of any `WM_*` or `HW_*` environment variables the doc defines (grep the doc for them).
3. Add a final table "Flag to doc" sorted by flag name.
4. Run the verify command; the missing list must be empty.

# Report

Doc count, flag count, and any doc whose purpose was unclear.
