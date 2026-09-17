# Platform and cutover plan — Track 4

For JT, 2026-09-16. Answers four questions: what has to be wired to replace the developers' stage
site, where to host, which database and runtime, and how the team writes its own modules without
breaking anything. Sources: two censuses run tonight over the twelve Hyper-Tech repos and our own
estate (scratch `census-production.md`, `census-ours.md`, `models_table.tsv`), plus the audit docs
under `docs/codebase-audit/` (THE-GRADE, DEPLOY-MAP-FROM-REPOS, CANONICAL-DATA-MODEL,
ARCHITECTURE-MAP, TEAM-TODO). Every number below has a `path:line` in those files.

---

## 1. What the stage site actually is

"The stage website" is not one thing. It is five admin/POS surfaces and two storefronts on the
contractor's domain (`thcs.in`) and two bare EC2 addresses, all hand-deployed, all reading one
shared MongoDB:

| Surface | Repo | Live at | Routes / screens | Auth today | Grade |
|---|---|---|---|---|---|
| Stilo POS (the one probed today) | `stilo-frontend-nextjs` + `stilo-backend` | `stilo-pos.react.thcs.in` / `stilo-backend.js.thcs.in` | 504 backend routes, 130 app files | static `x-api-key` in the JS bundle → lists all admins incl. `password`, mints admin JWT (**live, confirmed 2026-09-16**) | 37 / 26 |
| Super admin (one panel, five backends) | `hyperwolf-super-admin` | `54.81.94.241` | 42 layouts; 5 axios clients → hyperwolf, hemp, distribution, stilo, promotion | bearer token in `localStorage` | 29 |
| Retailer admin | `hemp-retailer-admin` | `thcs.in` / `54.81.94.241` | 31 layouts | bearer token in `localStorage` | 35 |
| Hyperwolf backend | `hyperwolf-backend` | `thcs.in` / `18.235.246.3` | 419 routes, 59 models, 146 cron hits, ~110 Blaze call sites in `common/utils.js` | JWT, some routes unguarded | 29 |
| Hemp backend | `hemp-backend` | `api.direct.stage.hyperwolf.com` | 425 routes, 56 models | JWT, admin middleware missing on some | 19 |
| Hyperdrive (delivery) | `hyperdrive-backend` | `thcs.in` | 86 routes, 28 models; DynamoDB + IoT Core for live location | JWT with a `platformType==="web"` bypass | 29 |
| Distribution | `distribution-backend` | docker, self-hosted | 152 routes, 33 models; every cron commented out, driven by an unknown external caller | JWT, `common-routes.js` all unauthenticated | 29 |
| Promotions | `promotion-backend` + `promotion-engine` | self-hosted | 15 + 6 routes | none | 26 / 29 |
| Storefronts (customer-facing) | `hemp-frontend-nextjs`, `hyperwolf-frontend-nextjs` | `thcs.in` / not deployed (workflow commented out) | 241 + 337 app files: shop, blog, signup, reviews, sitemaps | static token fallback in constants | 26 / 34 |

**Data:** 120 distinct Mongo collections across six backends; 70 share a name across two or more
repos; five backends open the same `HEMP_DATABASE_URL`. `Admin`, `Order`, `Brand`, `Category`,
`Miscellaneous` are defined in five repos each. Every model field is `Mixed` where it matters.
No repo has a test suite (Testing 1/10 across all twelve).

**Integrations (blast-radius order):** Blaze (11 of 12 repos), MongoDB (all), AWS S3 (uploads
incl. ID photos, often unauthenticated), Firebase (service-account JSON committed in three repos),
Google Maps (key in a code comment), Metrc (stilo), Didit (stilo), Persona (retailer/stilo),
SendGrid, Klaviyo, TextVolt, HERE, Reviews.io, LedgerGreen (secret literal), Sentry (mis-wired),
DynamoDB + IoT Core.

## 2. What we have today (honest)

- wm-demo on Render is **production-shaped, not a toy**: persistent disk holds the SQLite store
  and Verify's ID media; deploys are manual; memory is tuned from a real OOM. It has **no automated
  backup** (ad-hoc snapshots in `backups/`), one shared write token, no per-user identity, and
  **3 of ~149 API route families** registered in the new policy gate (warn mode by default).
- POS-Admin: `pos`, `idv`, `forms-app`, `incentives`, `pweb` fetch live routes; `athome`,
  `delivery`, `engage`, `logistics`, `pipeline`, `promo`, `shop`, `terminals` have **zero fetch
  calls** (mock data). Screens are Babel-in-browser JSX (no build step).
- Two engines are maintained twice: `distribution-engine/index.js` (JS) and
  `wmdemo/restock_engine.py` (Python), kept in parity by 31 goldens. Contracts validators exist in
  JS and Python, kept in parity by 50 fixtures. Tonight's program spent several agent-runs on that
  parity.
- What the stdlib-only Python choice has cost us, concretely: no Postgres driver, hand-rolled
  auth / rate-limit / CORS / headers / sessions, a Python port of every JS validator, no job queue,
  one process, no ORM or migration tool, no off-the-shelf backup.

## 3. Recommendations (each is an owner decision; my pick is first)

### D5 — Host: **AWS for production, Render stays as demo/stage until cutover**

Not because AWS is "more secure" by itself. Because the things that make a cannabis POS defensible
are VPC-private databases, per-service IAM, KMS-managed keys for ID media, WAF in front of the
public edge, CloudTrail for every console action, and PITR backups with restore drills, and Render
gives us none of the first four. The developers' estate already runs on AWS we do not control
(S3, DynamoDB, IoT Core, the two EC2 stage boxes); the cutover is also the moment the account
becomes ours. Minimal stack: ECS Fargate (or App Runner) for the app container, RDS Postgres
Multi-AZ, S3 + CloudFront + WAF, Secrets Manager, CloudWatch. Infra as code (CDK or Terraform)
from day one so a second environment is a parameter, not a project.

Render keeps the demo and stage: it is cheap, we know it, and it is production-shaped enough for
the vendor walkthroughs. **Containerize the app now** so the AWS move is a deploy, not a rewrite.

### D6 — Database: **Postgres. Not Mongo.**

The four rule shapes, the 70 collections shared by name, the `Mixed` fields and the
`global.dbConnections.connN` pattern are what an untyped document store looks like after five
years without a schema owner. Postgres gives: typed core tables (money, stock, people) with
transactions, so the "duplicate line moves double" class of bug is impossible at the DB layer;
JSONB for the genuinely flexible parts (promotion rules, form submissions, module data) validated
by the contracts package on write; **row-level security** for entity and store scoping, so the
IDOR class of bug stops being a per-route promise; mature backups, PITR and replicas (we have no
backups today); indexes and materialized views for the fast admin. Our 211 SQLite tables are
already relational. The vendor's newest code (`stilo-backend`) already carries Sequelize + `pg`.

### D7 — Runtime: **TypeScript app server; Python stays only where it is ML**

Two options, honestly costed:

| | A. TypeScript (Fastify/Hono + Postgres via Drizzle or Kysely) | B. Python (FastAPI + psycopg) |
|---|---|---|
| Contracts | consumed natively (`contracts/index.js`) — the Python port and its parity fixtures disappear | port stays, parity work stays |
| Same language as | POS-Admin, `distribution-engine`, all twelve vendor repos, the developers | the Verify engine, our probes |
| Team writes modules | yes, one language front to back | two languages per module |
| Cost | port ~73 wm-demo modules behind the same route paths, using the goldens/fixtures as the oracle | keep modules, replace the HTTP layer and DB driver |

**Pick A**, sequenced as a strangler: the new runtime hosts the platform kit and every *new*
module first; existing wm-demo modules move one at a time behind the same `/api/...` paths (the
client does not change); wm-demo shrinks to the Verify engine adapter (`idv-engine` stays Python:
it is an ML service, and it already talks over HTTP with a signed contract).

### D8 — Frontend: **a build step, one bundle per module**

Babel-in-browser JSX cannot be fast or code-split, and it forces `'unsafe-eval'` into the CSP.
Vite with per-module entry points, the same IIFE discipline replaced by ES modules, contracts
imported not copied. This is what "lightning fast" mostly means on the client.

### D9 — Storefronts: **owner call**

We have nothing storefront-shaped (shop, blog, signup, reviews, sitemaps — ~580 Next.js files
across two repos). Options: rebuild on our API later; or keep the vendor storefront and point it
at our backend through the contracts. Not needed to replace the admin/POS surfaces.

## 4. Speed

Server: Postgres with real indexes; read models (materialized views refreshed by jobs) for every
dashboard count; cursor pagination everywhere; ETag caching on reads; an in-process LRU now, Redis
only when measured. Client: precompiled bundles, per-module code split, one shared data client
with request de-duplication. "Running functions": a `jobs` table plus a worker — every long
operation (sync, export, build plan, timesheet audit) becomes a job with progress, cancel and an
audit row; this is also where the GAS triggers land in the LP/HR migration.

## 5. The module system (how the team writes modules themselves)

A module is one folder. The loader refuses anything that does not follow the manifest.

```
modules/<name>/
  module.json      name, version, owner, scopes it defines, secrets it needs (names only)
  routes.ts        every route declares {auth, scope}; the loader rejects a route without one
  contracts.ts     shapes registered into @hyper-tech/contracts (additive, versioned)
  migrations/      forward-only SQL, numbered; the module owns ONE Postgres schema
  jobs.ts          named jobs with schedules; run by the worker, not by cron on a box
  screens/         entries + nav; built into the module's bundle
  probes/          battery-style checks; a module ships with ≥ 20 or does not load
  README.md        what it does, what it reads from other modules
```

Rules the loader enforces, not reviewers: a module touches only its own schema, and other
modules' data only through their exported service functions or read-only views; secrets come
from `config.secret("NAME")` (the secrets manager), never from the environment directly or from
a file; every write goes through the audit hook (who, what, before, after); no `fetch` outside
the shared client on the front end. `hw new-module <name>` scaffolds all of it with a passing
probe; `hw check` runs contracts tests, the security-gate probe, the module's probes and a lint
for secrets and raw SQL. CI blocks merge on any failure. The docs app and a `write-module` skill
let Claude or a developer produce a module from a one-page spec.

## 6. Security through the whole process

Per-user identity via Google Workspace SSO (OIDC), MFA inherited from Google, short sessions
(tonight's D2 session tokens are the stepping stone); scopes as built tonight; row-level security
in Postgres; an audit table written by the loader; secrets in Secrets Manager with rotation dates;
WAF + per-route rate limits; CSP enforced once the build step lands; dependency lockfiles and
audit in CI; signed container images; automated backups with a weekly restore drill; the
security-gate probe as a CI gate; the security-audit thread's pen test before any DNS change.
Before touching production data: rotate the committed Firebase keys, the Google Maps key and the
LedgerGreen literal (TEAM-TODO 0.1–0.2) — those are JT's console actions.

## 7. Start to finish

| Phase | What | Exit proof | Rough size |
|---|---|---|---|
| 0 (this program) | Tracks 1–3 landed and pushed | Run buttons pressed, battery green on Render | in flight |
| 1 Foundations (1–2 wk) | D5–D8 decided; app containerized; managed Postgres on Render with automated backups + restore drill (**closes the one BLOCK**); Google SSO + audit table; route policy at 100 % and strict mode on; session tokens live, legacy token off | restore drill passes; `security_gate_probe` green in strict mode; every write attributable to a person | ~12 agent-runs |
| 2 Platform kit (1–2 wk) | new runtime skeleton (TS + Postgres), module manifest + loader + CLI + CI gate; first module = promotion rules (already contract-shaped) | `hw new-module` → passing probe in one command; promotions served from the new runtime on the same paths | ~15 |
| 3 Integrations (2–4 wk, blast-radius order) | Blaze adapter module (read first, writes behind flags, secrets in the manager); Metrc; Onfleet/Hyperdrive tasks + regions; Airtable (HR/LP read, then write); Connecteam; Alpine import; Didit (Verify has it); S3 media → our bucket with KMS; one outbound-messaging adapter (SendGrid/Klaviyo/TextVolt); one geo adapter (Google/HERE); push (after key rotation) | each adapter: probes against a stub + one read-only live smoke; no vendor write without a flag | ~25 |
| 4 Data ownership (2–3 wk) | replica/dump access from the developers (Phase A of the operating plan); ETL 120 collections → Postgres by CANONICAL-DATA-MODEL concept, starting with the five shared-by-five and the three biggest (Tasks, Region, Fleets); nightly reconcile counts; dual-run | row counts and money totals reconcile for 7 consecutive nights | ~20 |
| 5 Replace the stage surfaces (2–3 wk) | admin/POS first: super-admin's 42 layouts and retailer-admin's 31 map onto POS-Admin modules; Stilo POS register flow onto our POS; DNS per surface with the vendor stage frozen read-only; rollback = DNS back | a store runs a full day on ours; the vendor surface is dark for that store | ~20 |
| 6 AWS production (1–2 wk) | infra as code, blue/green, WAF, backups verified, pen test, DNS | pen test report; a rollback rehearsed | ~10 |

Storefronts (D9) sit outside this sequence.

## 8. Decisions needed from JT

- **D5** host (AWS prod, Render stage) · **D6** Postgres · **D7** TypeScript runtime ·
  **D8** frontend build step · **D9** storefront strategy.
- Phase A ownership with the developers (replica access, key rotation) is the gate on Phase 4;
  everything before it needs nothing from them.
