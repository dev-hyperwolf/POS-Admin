# The grade — Hyper-Tech-inc estate, 2026-09-09

**Overall: 29 / 100.** Twelve repos scored 19 to 37 on one rubric. Not one repo has a test suite,
a reproducible install, or per-user authentication on its main surface. The best-scoring code in
the estate is the two newest storefronts, and both ship a static credential to every visitor.

This is a read-only grade. No repo has been changed. Every number below is derived from the
per-repo reports in `repos/` (which cite `path:line`) and the mechanical metrics in `metrics/`.
Where the agents' scores were adjusted, the adjustment and reason are shown.

## 1. Rubric (applied identically to every repo)

Nine axes, each scored 1–10 against the anchors below. Security carries double weight because it
is the axis on which the owner's "simplicity, speed and security" brief is currently failing
hardest and because its failures are the only ones with legal exposure (cannabis age gates, card
data, government-ID images).

**Score = 2 × Security + Simplicity + Speed + Data modelling + Reuse + Testing + Upgradability +
Operability + Developer experience** → out of 100.

| Axis | 1–2 | 5 | 9–10 |
|---|---|---|---|
| Simplicity | god-files >3,000 lines; three implementations of one concept; no layers | conventional MVC, some 1,500-line files | small modules, one place per concept |
| Speed | unbounded loads of the main collection on hot paths; N+1 on checkout; no indexes | indexes on main keys; some N+1 in admin paths | measured, batched, cached, bounded |
| Security | credential-free admin takeover, open payment endpoint, committed live keys | no critical; shared secrets, IDOR in admin paths | per-user auth everywhere, signed webhooks, secrets in a manager, tests for auth |
| Data modelling | money untyped or float dollars; ids random strings; no indexes on transactional collections; 3+ time types | typed fields, some indexes, one time convention | one schema per concept, cents, refs, enums, migrations |
| Reuse vs hardcoding | >20% of the repo is a copy of a sibling; store/role/URL literals in logic | shared helpers inside the repo, config in env | shared packages, everything else data |
| Testing | zero | unit tests on the money path | contract + integration + adversarial |
| Upgradability | EOL runtime pinned or unpinned, no lockfile, EOL ORM, framework threaded through business logic | current majors, lockfile, business logic mostly separable | pinned, current, typed boundary, upgrade rehearsed |
| Operability | error tracker not wired or wired before routes; creds in logs; cron comments wrong; deploy = ssh+git pull | structured logs, working error tracking, gated deploy | SLOs, alerts on cron, config validated at boot |
| Developer experience | README contradicts code; dead code that looks load-bearing; no lint | accurate README, lint, some docs | onboarding in a day |

## 2. Scores

Axis inputs come from `repos/<repo>.md` §17. Adjustments: none — the twelve agents graded
independently and their inputs are consistent with the anchors on cross-check (one factual
disagreement between reports: stilo's calls the shared dashboard controller byte-identical, hemp's
shows a five-line difference with a fix stilo has and hemp lacks; `cmp` agrees with hemp, and
neither score moves) (e.g. every repo
with a credential-free takeover chain scored Security 1–2; every repo with a lockfile scored
Upgradability ≥3). The one place I would move a number is hemp-retailer-admin Security 4 → 3
(same `localStorage` token + unsanitised HTML pattern as super-admin, which scored 3); I left it,
because the agent found no route-level IDOR there and the anchor allows 4. It changes nothing.

| Repo | Sec ×2 | Simp | Speed | Data | Reuse | Test | Upg | Ops | DX | **Score** |
|---|---|---|---|---|---|---|---|---|---|---|
| stilo-frontend-nextjs | 2→4 | 5 | 5 | 4 | 4 | 1 | 5 | 3 | 6 | **37** |
| hemp-retailer-admin | 4→8 | 4 | 5 | 4 | 3 | 1 | 3 | 3 | 4 | **35** |
| hyperwolf-frontend-nextjs | 2→4 | 4 | 4 | 3 | 4 | 1 | 5 | 3 | 6 | **34** |
| distribution-backend | 2→4 | 3 | 4 | 4 | 3 | 1 | 4 | 3 | 3 | **29** |
| hyperdrive-backend | 2→4 | 4 | 3 | 3 | 4 | 1 | 4 | 3 | 3 | **29** |
| hyperwolf-super-admin | 3→6 | 3 | 4 | 4 | 2 | 1 | 3 | 3 | 3 | **29** |
| promotion-engine | 2→4 | 3 | 3 | 3 | 4 | 1 | 5 | 3 | 3 | **29** |
| hemp-frontend-nextjs | 2→4 | 3 | 4 | 3 | 3 | 1 | 3 | 2 | 3 | **26** |
| hyperwolf-backend | 2→4 | 3 | 4 | 3 | 3 | 1 | 2 | 3 | 3 | **26** |
| promotion-backend | 1→2 | 3 | 5 | 4 | 3 | 1 | 3 | 2 | 3 | **26** |
| stilo-backend | 1→2 | 4 | 3 | 4 | 2 | 1 | 3 | 3 | 3 | **25** |
| hemp-backend | 1→2 | 2 | 2 | 3 | 2 | 1 | 2 | 3 | 2 | **19** |

Arithmetic, e.g. hemp-backend: 2×1 + 2+2+3+2+1+2+3+2 = 2 + 17 = **19**. stilo-frontend:
2×2 + 5+5+4+4+1+5+3+6 = 4 + 33 = **37**.

**Overall** = mean of twelve = 344 / 12 = **28.7 → 29**. Weighting the seven backends double
(they hold the money and the identities) gives 527 / 19 = 27.7 → **28**. Weighting by lines is
meaningless because super-admin is 42% of all lines and a third of it is vendored.

Read the table this way: the four axes that drag every repo below 40 are the same four —
Security (median 2), Testing (all 1), Reuse (median 3), Upgradability (median 3). Fixing those
four across the estate is worth more than any single repo's rewrite, which is why the plan in
`CONSOLIDATION-AND-PLATFORM-SERVICES.md` starts with a shared package rather than a merge.

## 3. Quick fixes — ranked by leverage, none over about two hours

"Points" are repo-score points (one axis step = 1, a Security step = 2). Hours are the reports'
own §18 estimates summed across the repos named; rows over one hour are multi-repo sweeps of a
one-line change. Per-repo detail and exact `path:line` are in each report's §18. Owner-authority
items are marked ◆. Sorted by points per hour.

| # | Fix | Repos | Hours | Points | Pts/h |
|---|---|---|---|---|---|
| 2 | Add `[adminAuth]` to `PUT /reassignTask/:taskId` | hyperdrive | 0.05 | 2 | 40 |
| 1 | Delete `POST /api/v1/nmi/payment` (open card-charging endpoint) | hemp-b | 0.1 | 2 | 20 |
| 8 | Remove hardcoded token fallbacks; fail the build if the env var is unset | hw-frontend, hemp-frontend | 0.3 | 4 | 13 |
| 4 | Require `req.user.isSuperAdmin` before honouring `userRoles.includes("Super Admin")` | stilo-b | 0.2 | 2 | 10 |
| 5 | `app.use(cors(corsOptionsDelegate))` — the allow-list already exists, unused, in the same file | hyperwolf-b, hemp-b, stilo-b, hyperdrive, distribution | 0.5 | 5 | 10 |
| 12 | Stop logging DB connection strings and full member documents; scrub card data from Sentry captures | hemp-b, promotion-b | 0.3 | 3 | 10 |
| 15 | `crypto.randomBytes` for reset tokens and ids instead of `Math.random()` | hemp-b, promotion-b | 0.2 | 2 | 10 |
| 3 | Remove the `generateAuthToken()` call from `getAdminById`; put `admin` middleware on the admin-user routes; `.select('-password')` on `getAllAdmins` | hemp-b, stilo-b | 0.5 | 4 | 8 |
| 7 | ◆ Rotate and remove the three committed service-account keys, the Maps key in a comment, the LedgerGreen webhook literal; `git rm --cached build.zip` | hyperwolf-b, hemp-b, stilo-b, super-admin | 1 | 8 | 8 |
| 13 | Wire `app.use(errorHandler)` last; un-comment `Sentry.init`; mount Sentry's error handler **after** routes | promotion-engine, distribution, hemp-b | 0.5 | 3 | 6 |
| 16 | Point `authRateLimiter` at the route that exists (`/admin/forgot` not `/forgot-password`); add limiters to login, PIN login, reset, register | hemp-b, stilo-b, distribution | 0.5 | 3 | 6 |
| 17 | Fix cron comments (five of six wrong in two repos) or delete them; add `CRON_TIME`, `KLAVIYO_API_KEY` and the 14 unlisted vars (10 of them FHL) to `.env.example` | hyperwolf-b, hemp-b, hyperdrive | 0.5 | 3 | 6 |
| 9 | Commit `package-lock.json` (un-ignore it) and add `engines.node` | 8 repos without lockfiles | 1.5 | 8 | 5 |
| 6 | Put `[admin]` + a real `fileFilter` + `limits.fileSize` on the upload routes; stop `express.static` on the upload dir; S3 `ACL` private | distribution, hemp-b | 1 | 4 | 4 |
| 10 | Indexes: `Order {orderId} unique, {memberId, createdDate}, {createdDate}`; `Member {memberId},{email}`; `KitDistributed {distributionId}`; fix the three dead indexes | hemp-b, stilo-b, distribution, hyperdrive | 1 | 4 | 4 |
| 11 | Replace `Order.find()` (whole collection on every coupon apply) with `countDocuments` | hemp-b | 0.25 | 1 | 4 |
| 19 | Cap `limit` server-side on every list endpoint (`Math.min(limit, 100)`) | all 7 backends | 1 | 4 | 4 |
| 18 | Delete the dead code inventory in `CONSOLIDATION-AND-PLATFORM-SERVICES.md` P4 | 6 backends | 2 | 6 | 3 |
| 20 | Correct the READMEs that contradict the code (hyperdrive's describes a service that does not exist; five say `.env.example` is absent when it is present) | 5 repos | 1 | 3 | 3 |
| 14 | `DOMPurify.sanitize()` at the 16 `dangerouslySetInnerHTML` sites in retailer-admin (the 134 / 65 / 93 in super-admin, stilo-f and hemp-f are a day each, not quick fixes) | retailer-admin | 1 | 2 | 2 |

Total: about 13.5 hours for 73 repo-points, which moves the estate mean from 29 to about 35. None of it changes the architecture; all of it removes an exploit or a footgun.

## 4. Biggest issues — must be resolved before building on this, ranked by risk

Each carries the blast radius if ignored. These are the reasons the score is 29 rather than 50.

1. **There is no per-user authentication on the brand backends.** One static `x-api-key`, shipped
   in every browser bundle (with a hardcoded fallback in two storefronts), is the only gate on
   428 of 434 hemp routes and 51 of 53 stilo route files; only 4 hemp routes require an identity;
   customer identity is a client-supplied `memberId`/`consumerId` (`repos/hemp-backend.md` §6,
   `repos/stilo-backend.md` §6, `repos/hyperwolf-frontend-nextjs.md` §14, `repos/stilo-frontend-nextjs.md` §6).
   *Blast radius:* every customer record (DOB, licence number, ID photo, address, wallet), every
   order, every admin, from any browser that has loaded the site. This is also why every IDOR
   finding exists. Nothing can be merged, and no platform service can be trusted, until Identity &
   Auth exists (plan §3).
2. **Credential-free admin takeover in hemp and stilo.** `GET /api/v1/admin/get` lists admins with
   hashes; `GET /api/v1/admin/:id` mints a valid 2-day JWT for any of them; stilo's `updateAdmin`
   lets the caller set `isSuperAdmin` (`repos/hemp-backend.md` §14 #1, `repos/stilo-backend.md` §14 #1–2).
   *Blast radius:* full back-office control of two brands, including price, promotion and role
   changes, with no log of who did it. Quick fix #3–4.
3. **Money is trusted from the client.** Cart totals, discounts and wallet amounts are read from
   `req.body` and charged/persisted as sent; `total: 0` skips payment and still ships; wallet
   balance is settable by request; an unauthenticated endpoint charges arbitrary card data on the
   merchant account and echoes the gateway response (`repos/hemp-backend.md` §14 #2–4; the same
   defect is duplicated in the POS controller). *Blast radius:* free orders, unlimited store
   credit, a public carding oracle on a live merchant account, PCI scope on a server that also
   logs card data to Sentry. Quick fixes #1 and #12 close the oracle; the structural fix is the
   Pricing & Cart service.
4. **Live secrets in the tree.** Three GCP/Firebase service-account private keys (hyperwolf-b,
   hemp-b, stilo-b), a Google Maps key in a comment, a LedgerGreen webhook secret literal, static
   API tokens in two storefront sources, a 13 MB production bundle with keys inside
   (`repos/*.md` §8). *Blast radius:* anyone with read access to the org (the contractor's
   account included) can send push notifications as Hyperwolf, spend the Maps quota, forge payment
   webhooks. Owner action (rotation), then quick fix #7.
5. **Three forks of one backend, with fixes landing in one and not the others.** hemp↔stilo:
   9,543 lines ≥90% identical, 50 files identical ignoring whitespace, a 2,054-line dashboard controller with a
   bug fixed in stilo and live in hemp, Stilo-branded emails sent to Hemp admins; hyperwolf↔stilo
   629 exact lines; `awsBucket.js` identical in four repos (`repos/hemp-backend.md` §12,
   `metrics/fork-distance.md`). *Blast radius:* every security fix above must be applied two or
   three times by hand, and the evidence says it will not be. This is the case for `backend-core`
   and merge #2.
6. **Services share databases instead of APIs.** distribution-backend authenticates against the
   Hemp DB and writes Fleets/Order/Product in the Hyperwolf DB through drifted schema copies;
   stilo keeps its `Admin` in the Hemp DB; promotion-backend opens four DBs; hyperdrive and
   hyperwolf and distribution each define `Order` differently on the same collection
   (`repos/distribution-backend.md` §3, `ARCHITECTURE-MAP.md` §2). *Blast radius:* a schema change
   in any one repo silently corrupts reads in the others; no service can be deployed, scaled or
   migrated alone.
7. **Nothing is reproducible or gated.** Eight repos gitignore their lockfile and run `npm i` on
   the server at deploy; `engines.node` is `12.x`, `>=12.x`, an EOL `>=18` floor, or absent in nine repos; three repos run Mongoose 5
   (EOL); deploys are SSH + `git stash` + `git pull` + `pm2 restart` with no build or test step,
   triggered by branches that do not exist (`development`, `feat/admin_promo`,
   `free-product-and-calculation`, `feature/distribution-tasks`); the one security workflow
   requires a lockfile it cannot have (`repos/*.md` §2, §10). *Blast radius:* any deploy can pull a
   different dependency tree than the last; a broken push goes live; nobody can say what is
   running in production. This is the owner's "upgrade without breaking everything" concern in
   its current state: a Node major bump today is untestable.
8. **Zero tests.** Two files in twelve repos — a 105-line `assert` script in hyperwolf-backend and a 94-line
   upsell-state test in hemp-frontend; `jest` configured in promotion-engine with no files (`repos/*.md` §9). *Blast radius:* every item on this page has to be fixed blind. Our
   estate's probe suites (656 Bounty + 600 Verify checks per `docs/BOUNTY-STATUS.md` and
   `docs/IDV-STATUS.md`, plus 279 engine tests) are the only regression floor in the whole map.
9. **The data model cannot carry a platform.** Money as float dollars, mostly inside untyped
   `Object` fields; ids as `Math.random()` strings; three time types; five soft-delete
   conventions; tenant key unindexed and client-supplied; `Order` with zero indexes queried at
   33 sites; `KitDistributed` five levels deep with zero indexes (`CANONICAL-DATA-MODEL.md` §0).
   *Blast radius:* every merge and every service contract has to pick a shape first; every
   dashboard query is a collection scan that gets slower every week.
10. **Observability is broken exactly where it matters.** Sentry initialised 19 times in hemp
    with the error handler mounted before the routes; commented out in stilo and distribution
    while `SENTRY_DSN` is mandatory at boot; cron failures only `console.log`; DB connection
    strings and bcrypt hashes in logs; cron comments wrong by 24× (`repos/*.md` §7, §10).
    *Blast radius:* the estate cannot tell it is being exploited or that a sync stopped.
11. **Compliance-shaped defects.** Age verification is self-asserted from the request body in
    hemp; customer ID photographs upload unauthenticated to a public-read bucket and are served
    from the API origin; card PAN/CVV transit hemp-backend (`repos/hemp-backend.md` §14 #4, #7, #12).
    *Blast radius:* regulatory, not just technical. Verify (ours) and the S3-private quick fix
    are the direct remedies.
12. **Concurrency defects on inventory and promotions.** Read-modify-write inventory decrement
    (oversell), unlocked crons that can overlap themselves, check-then-act on promotion usage
    limits across two services (`repos/hemp-backend.md` §15 #3, `repos/promotion-engine.md` §14 #2).
    *Blast radius:* wrong stock and over-redeemed promotions at exactly the busiest moments.

## 5. On the owner's four asks

- **"Simplicity, speed, security."** Simplicity median 3: hand-written files of 3,500–4,700 lines, a 10,939-line vendored bundle on
  the checkout path, and one concept implemented three times. Speed median 4: the checkout and dashboard paths load whole
  collections. Security median 2: see §4 items 1–4.
- **"Smart, not hardcoded and stuck."** ID verification is four vendor integrations copied into
  three backends with a self-asserted flag; rewards are a settable number on the member and a
  vendor API. Neither is a service. Store names, role strings, phone numbers, S3 URLs, employee
  ids and prod/stage hosts are literals in logic (`repos/*.md` §11).
- **"Elite organisation of data."** Five Order schemas on two collections; nine shapes for a
  person; money in blobs. See `CANONICAL-DATA-MODEL.md`.
- **"Easy to update."** No lockfiles, EOL runtimes, framework objects threaded through 30,000-line
  controller trees, no tests. A Node or Next major bump breaks in unknown places, in every repo.
- **"Are the developers doing a poor job?"** The evidence says the work was done fast, by
  copy-and-rename, without review, without tests, and with security added as dead code that looks
  like it works (`partnerAuth`, unused CORS allow-lists, unused `isSuperAdmin`, `SECURITY_AUDIT.md`
  that certifies a clean bill while five criticals sit beside it). There are pockets of good
  instinct — promotion-engine's `core/` modules, distribution's `KitDispatch` indexes, Intercom's
  HMAC, hemp's newer hashed reset tokens — and they are consistently disconnected from the live
  path. That pattern, more than any single bug, is the finding.

## 6. What happens next

Nothing, until you say go. The decisions in `CONSOLIDATION-AND-PLATFORM-SERVICES.md` §6 are
yours; I will ask them one at a time. Phase 3 (contracts package, adapter layer, build-against-the-
source guide) and Phase 4 (Hyperwolf Docs) do not touch the Hyper-Tech repos and can start on
your word independently of the merge decisions.
