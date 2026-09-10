# Distribution rebuild — compatible by construction

Owner decisions, 2026-09-10: rebuild in our estate; the MongoDB collections and shapes, the
existing super-admin routes, the deploy (same service, same host) and the Blaze transfer behaviour
all stay exactly as they are; screens may be redesigned as long as every control binds to an
existing endpoint and existing data; wanted changes underneath go on `DEV-TEAM-CHANGE-LIST.md`
for the developers.

## The shape that satisfies all four constraints

```
hyperwolf-super-admin ──(unchanged 140 routes)──► distribution-backend ──► Mongo (unchanged)
Hyperwolf Distribution ─┘ (our new console, same routes)     │                 │
                                                             ▼                 │
                                          @hyper-tech/distribution-engine      │
                                          (pure functions, no driver, tested   │
                                           against exported documents) ◄───────┘ shapes
```

1. **`@hyper-tech/distribution-engine`** — an npm package in our estate (beside
   `@hyper-tech/contracts`). Pure functions over the *existing* document shapes, no database
   driver, no HTTP: `businessDay(ts)`, `soldSince(transactions, kitItems, window, terminalMap)`,
   `planBuild(templates, batches, settings, subregions, now)`, `planRefill(kits, sales, batches,
   settings, now)`, `explain(plan)`. Every decision returns a plan **and its reasons** (why each
   product was placed, capped, skipped, short). Tested by replaying exported production
   documents: the plan for a past day must match what should have happened, and the two reported
   symptoms become named regression cases.
2. **One integration pull request in distribution-backend**, written by us on a branch, merged
   and deployed by the developers: `kitDistributed()` and `dailyRefillKit()` call the engine for
   the decision and keep their own reads, writes, Blaze transfers and responses. Same routes,
   same shapes, same host. The engine is a dependency in `package.json`, nothing else moves.
   Optional and additive: `POST …/kit-refill/preview` returning the plan without committing.
3. **Hyperwolf Distribution** — a POS-Admin app served by wm-demo like Bounty, Verify and Docs.
   Every button calls a distribution-backend route that exists today with the admin JWT; the
   screens are redesigned around the operator's day (received lane, refill preview with reasons,
   status timeline, skips panel). The super-admin screens keep working untouched until the team
   chooses to retire them.
4. **`DEV-TEAM-CHANGE-LIST.md`** — the additive changes we ask the developers for, each with the
   reason and the exact shape: CORS origin for the console, indexes, `neededQty` on refill logs,
   a scheduler with a lease, Sentry init, the platform filter, and so on. None blocks step 1–3;
   each makes the result better or faster.

## Phases

| Phase | What | Needs | Done when |
|---|---|---|---|
| D0 Fixtures | Read-only export of `kitdistributeds`, `kittemplates`, `kittemplateskus`, `kitboxes`, `productbatches`, `distributionglobalsettings`, `regiondriverassigns`, `activitylogs` (last 30 days) and 14 days of Blaze transactions + the terminal map, into `distribution-engine/fixtures/` (PII-free: no customer fields) | developers (one mongodump) or owner with Mongo access after A1 | replay of a real refill day runs offline |
| D1 Engine | The package, the replay harness, the two symptoms as failing tests, then passing: freshness lane, all-sales sold, demand-based cap, one Pacific clock, partial placement under the subregion gate | D0 | replay reproduces the team's complaints, then no longer does; refuter pass |
| D2 Integration PR | Branch `fix/distribution-engine` in the clone; the two call sites; a preview route; the change list handed over | D1, the deploy line (A2) | developers merge and deploy; the refill's response now carries reasons |
| D3 Console | `Hyperwolf Distribution.html` + `dist/*.jsx`, bound to the existing routes; screens per the UX review and the mockup | CORS on the change list; admin JWT flow | operator runs refill day from our console end to end against stage |
| D4 Retire | Super-admin distribution menu hidden once the team lives in the console | team | — |

Effort, elite developer: D1 40–60 h, D2 8–12 h, D3 60–90 h. The 200–300 h figure in the logic
map assumed rebuilding the persistence and Blaze paths too; keeping those is what makes this
smaller and compatible.

## Rules for the work

- The twelve repos stay read-only until Phase A of the operating plan is done; D0–D1 need nothing
  in them. D2 is a branch and a pull request, never a push to a deploy-trigger branch.
- Every engine function is pure and documented with the document fields it reads; the shapes come
  from `distribution-backend.datamodel.md` and are asserted by the contracts package.
- No number reaches production without a replay test that would have caught today's symptoms.
- Console controls map 1:1 to existing routes; any control that needs a route that does not exist
  goes on the change list and ships disabled with a note until the developers add it.
