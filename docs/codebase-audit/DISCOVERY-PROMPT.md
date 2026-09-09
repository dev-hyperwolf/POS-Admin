# Per-repo discovery prompt (reusable — one dispatch per repo, Sonnet)

Fill in REPO and SHA, then dispatch. Output goes to
`/Users/jt/POS-Admin/docs/codebase-audit/repos/<REPO>.md` (main report) and
`/Users/jt/POS-Admin/docs/codebase-audit/repos/<REPO>.datamodel.md` (every schema, every field).

---

You are auditing ONE repository for a codebase-wide audit of the Hyper-Tech-inc estate
(a cannabis retail / delivery platform: Hyperwolf, Hemp, Stilo brands; Hyperdrive logistics;
promotions; distribution). The owner suspects duplication across repos and poor engineering.
Grade without diplomacy and without cruelty: evidence, file:line, severity, and the fix.

REPO: `<REPO>` at `/Users/jt/hyper-tech/<REPO>`, pinned at commit `<SHA>`.
A mechanical metrics pass already ran: read
`/Users/jt/POS-Admin/docs/codebase-audit/metrics/<REPO>.md` first (and the `.json` beside it
for route/model lists). Its numbers are regex leads, not verdicts — VERIFY each one you cite,
and correct it where it is wrong (e.g. its "unguarded route" count ignores `router.use(auth)`
at mount points; trace the real auth chain from `index.js`/`app.js` → routes → middleware).
Cross-repo duplicate leads are in `/Users/jt/POS-Admin/docs/codebase-audit/metrics/CROSS-REPO-DUPLICATES.md`.

## Hard rules
- READ-ONLY. Do not modify, create, or delete anything under `/Users/jt/hyper-tech`. Do not run
  `npm install`, `npm start`, tests, or any script from the repo. Do not `git checkout/stash/reset`.
- Use `grep -a` (some files in this estate have carried NUL bytes; `-a` costs nothing).
- Every claim carries `path:line` (relative to the repo root). Nothing is inferred from a README
  when the code can be read; if the README contradicts the code, say so with both citations.
- NEVER write a secret value anywhere — not in the report, not in your final message. Cite the
  file:line and the kind of secret only.
- Honest zero over a fabricated number. If you did not measure it, say "not measured".
- Keep the main report under ~900 lines. Put the full field-by-field data model in the
  `.datamodel.md` file (that one may be long).

## Main report sections (use these exact headings, in this order)
1. **Purpose** — what this service/app is, who calls it, what it calls (from code, not README).
2. **Runtime & framework** — Node version (engines, .nvmrc, Dockerfile), framework versions,
   DB + ORM, TypeScript or not, pinning state (exact/caret/none, lockfile present?), and the
   EOL/CVE exposure of the majors in use.
3. **Entry points & boot** — the file that starts the process, what it wires (DB connections —
   note multi-connection patterns like `global.dbConnections.conn1`), global mutable state,
   startup side effects.
4. **Directory map** — one line per top-level dir with its real role and size.
5. **Data model summary** — count of models, the 10 most central ones with their relations,
   where ids / enums / money / time are defined (type used for money: Number? String? cents or
   dollars?), timestamps, soft-delete convention, multi-tenancy key (store/retailer/brand?),
   indexes present vs queries made. Full detail goes in the `.datamodel.md`.
6. **API surface** — how routes are mounted, the auth mechanism (JWT? where signed, expiry,
   algorithm, secret source), role checks (how roles are represented — strings? where?), input
   validation (library or hand-rolled or none), the list of routes reachable with NO
   authentication (verified by tracing), pagination conventions, error response shape(s),
   versioning. For frontends: how the API base URL is chosen, how auth tokens are stored
   (localStorage? cookie?), the API client layer, route/page inventory, SSR vs CSR.
7. **Background jobs** — every cron/queue/timer with schedule, what it does, whether it can
   overlap itself, whether failures are logged.
8. **Third-party integrations & secrets** — every external service (payments, SMS, email, push,
   maps, POS vendors such as Blaze/Meadow/Treez, Weedmaps, METRC, Intercom, New Relic, AWS,
   Firebase…), the file that wraps it, how its credentials are obtained (env var? literal?
   committed file?), and whether webhooks are signature-verified.
9. **Tests** — what exists, what the `test` script actually runs, what is covered in words,
   what is not.
10. **Build & deploy** — how it is built and where it runs (Dockerfile, CI, PM2, Render,
    Vercel, README claims vs. evidence), environment separation (dev/stage/prod), logging and
    monitoring.
11. **Hardcoded values** — URLs, ids, store lists, role strings, prices, phone numbers, emails,
    region/city lists, feature flags — with COUNTS and the worst 10 with file:line. Distinguish
    "hardcoded and should be config" from "hardcoded and should be data".
12. **Duplicated code** — inside the repo, and vs. other repos (verify the cross-repo leads that
    involve this repo; name the sibling repo and the file pair).
13. **Dependency risk** — unmaintained / abandoned packages, known-vulnerable majors, declared
    but unused, imported but undeclared, bundle-size offenders (frontends).
14. **Security findings** — ranked. Each: severity (Critical/High/Medium/Low), file:line, what
    an attacker can do, the fix. Cover auth bypass, IDOR (does any handler load a record by id
    from the request without scoping to the caller?), injection (NoSQL operator injection via
    `req.body`/`req.query` passed into queries; regex from input; SQL string building), mass
    assignment (`req.body` straight into create/update), CORS, secrets in the tree, unsigned
    webhooks, missing rate limits on login/OTP, JWT weaknesses, file upload handling, XSS via
    dangerouslySetInnerHTML, open redirects.
15. **Performance findings** — ranked. N+1 (await inside loops over DB calls), unbounded
    queries (`find({})` with no limit on large collections), missing indexes for the queries
    actually made, synchronous I/O on hot paths, oversized payloads, chatty frontends (polling
    intervals, refetch storms), bundle size.
16. **Ten things a new developer would trip over** — concrete, each with a file:line.
17. **Grade inputs** — for each rubric axis give a 1–10 with a one-line justification and the
    single citation that most supports it: simplicity · speed · security · data modelling ·
    reuse-vs-hardcoding · testing · upgradability (how many places break on a Node/Next major
    bump; framework pinned?; is business logic separable from the framework?) · operability
    (logging, error handling, config) · developer experience.
18. **Quick fixes (<1 h each)** — ranked by impact per hour.
19. **Open questions** — things only the owner or the contractor can answer.

Your final message to the orchestrator: a 15-line summary (purpose, stack, model count, route
count, the three worst findings with file:line, the grade-input row) and confirmation that both
files were written. Nothing else.
