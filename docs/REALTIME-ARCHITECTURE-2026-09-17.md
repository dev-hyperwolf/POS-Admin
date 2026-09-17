# Realtime architecture — sockets, SSE, and the location/dispatch pipeline

Date: 2026-09-17. Scope: PLATFORM-AND-CUTOVER-PLAN-2026-09-16.md has no socket/realtime design —
its only mention of the problem is "an in-process LRU now, Redis only when measured" (§4). This
document is that missing layer, built against what §8 already decided (D5 AWS prod/Render
demo-stage, D6 Postgres on RDS Multi-AZ, D7 TypeScript Fastify+Drizzle, D8 Vite front end) and
against what is already built: `/Users/jt/wm-demo/infra/lib/*.ts` (CDK: VPC, RDS, ECS Fargate
behind an internal ALB, CloudFront+WAF, CloudTrail/GuardDuty) and `/Users/jt/wm-demo/platform/src/`
(the authz/sessions/policy/module kit the new runtime already runs).

Every vendor claim below (connection limits, pricing, timeouts) carries a URL and a read-date. Where
a figure comes from a third-party aggregator rather than AWS's own rate card (the AWS pricing pages
did not return tabular data to the fetch tool used), that is stated the way
`DATABASE-PROVIDER-RESEARCH-2026-09-17.md` already flags the same gap for RDS — directional, verify
in the Pricing Calculator before budgeting.

---

## Part 1 — Owner summary

**The one-line answer:** WebSockets on the Fastify services already running in ECS Fargate, behind
the ALB that already exists, fanned out through one small Redis-compatible cache (ElastiCache
Serverless for Valkey) that does not exist yet. No new compute model, no new vendor, no Lambda, no
IoT Core. Everything one-way (order status to a customer, notifications) goes over Server-Sent
Events instead of a socket, because SSE is plain HTTP, needs no new auth mechanism, and the CDN/WAF
already in front of the ALB does not need to learn anything new to carry it.

**Cost:** the topology below adds roughly **$10–20/month today, $50–80/month at 3×, $150–300/month
at 10×** on top of what D5/D6 already budgeted — the arithmetic is in Part 2. The ALB, ECS, and
CloudFront costs already in `PLATFORM-AND-CUTOVER-PLAN`'s Phase 6 line do not change; the only new
line item is ElastiCache.

**Route optimization:** self-hosted VROOM + OSRM, triggered by a Postgres-native job queue
(`pg-boss`), not a new message broker and not a per-call vendor API. Revisit only if solve quality
or latency proves inadequate at 10× — Google's Route Optimization API is the paid fallback, priced
per visit (cited in Part 4), not per month, so it is a drop-in escalation with no wasted spend if
never used.

**What's on a socket, what isn't:**

| Surface | Transport | Why |
|---|---|---|
| Dispatcher map (driver positions, ETAs) | **WebSocket** | Bidirectional-shaped in practice (dispatcher issues manual overrides that must land on the same channel), high update rate (every driver breadcrumb), many viewers per store |
| Driver app: location ping | **WebSocket** (client→server leg of the same connection the driver app holds open for task pushes) | The driver app already needs a live channel for task assignment pushes; piggybacking the outbound ping on the same connection avoids a second transport for one client |
| Driver app: task/assignment push | **WebSocket** | Server-initiated, needs to interrupt a driver mid-shift (new stop, reassignment, recall) — a poll loop cannot do this without either high latency or high battery/data cost |
| Order-status updates to a customer | **SSE** | One-way, low rate, no reason to hand an anonymous customer session a bidirectional channel it never uses to send anything |
| POS register / inventory screens | **SSE** (falls back to polling with ETag if a store's network drops SSE) | One-way ("this shelf's count just changed"), low rate, many idle tabs — SSE's HTTP/1.1-compatible reconnect-with-Last-Event-ID semantics fit better than a socket the register never writes to |
| Pick/pack boards, StatusTimeline | **SSE**, event-sourced from the same job/audit writes that already happen | One-way status transitions; see Part 6 — this is also the one surface `CONSOLE-ENDPOINT-MAP.md` flags as **not built yet**, so it should be built push-first instead of poll-then-retrofitted |
| LP/HR review queues | **Plain polling + ETag** | Low-rate, low-urgency, already the console's existing pattern (`shared/hw-live.js`); a socket buys nothing here |
| Notifications (Discord/push/email triggers) | **Push notification (FCM/APNs) for background mobile; SSE for an open console tab** | A backgrounded phone cannot hold a socket open reliably; a push notification is the correct tool the moment the driver app is not foregrounded |
| Presence / edit-locks on shared admin screens (e.g., two people opening the same write-up) | **WebSocket**, tiny payload, presence-only | Needs sub-second "someone else has this open" — SSE could do this too, but the socket is already open for the dispatcher/admin console anyway |

**Decisions needed from the owner** (recommended answer first in each — full list, Part 7):

1. Adopt ALB+Fargate WebSockets + ElastiCache Valkey as the one realtime topology? **Recommend yes.**
2. Self-host VROOM+OSRM for route optimization, Google's API only as a paid fallback? **Recommend yes.**
3. Location retention: 90 days of raw breadcrumbs, aggregate-only after? **Recommend yes; adjust
   the number if a compliance/dispute-window requirement says otherwise.**
4. Confirm off-shift location tracking must be impossible **server-side**, not just hidden client-side.
5. Build order: dispatcher map/presence first, then order-status SSE, then pick/pack + StatusTimeline?
   **Recommend yes** — see Part 6 for sizes.

---

## Part 2 — Topology on AWS

### The four options compared

| | (a) WS on Fastify/ECS + ALB + Valkey pub/sub | (b) API Gateway WebSocket + Lambda | (c) AWS IoT Core / AppSync Events | (d) Vendor (Ably/Pusher/Supabase Realtime) |
|---|---|---|---|---|
| Fits what's already built | **Yes** — same ECS service, same ALB (`app-stack.ts`), same VPC | No — a second compute model (Lambda) alongside ECS Fargate | No — a third AWS service family, its own auth/cert story | No — a second vendor relationship, exactly what D5 chose AWS to avoid |
| Connection duration | Whatever the ALB idle timeout is set to (1–4000s), effectively unbounded for an open service | **Hard 2-hour cap, unextendable**; 10-minute idle timeout, unextendable ([AWS docs, WebSocket quotas](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-execution-service-websocket-limits-table.html), read 2026-09-17) | MQTT keep-alives 30s–20min, no hard session cap ([AWS IoT Core pricing](https://aws.amazon.com/iot-core/pricing/), read 2026-09-17) | Vendor-defined, generally long-lived |
| Sticky sessions | Not needed — WebSocket upgrade already pins the connection to the target that returned HTTP 101; no separate cookie stickiness required after upgrade ([websocket.org ALB guide](https://websocket.org/guides/infrastructure/aws/alb/); [AWS ELB sticky-sessions docs](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/sticky-sessions.html), both read 2026-09-17) | N/A — API Gateway manages connection routing itself | N/A | N/A |
| Deploys without dropping connections | Yes, with care — see below | Yes (Lambda is stateless per-invocation) | Yes | Vendor's problem, not ours |
| Pricing shape | Fixed ALB/ECS cost already sunk; incremental cost is Valkey only | $1.00/million messages + $0.25/million connection-minutes ([AWS API Gateway pricing](https://aws.amazon.com/api-gateway/pricing/), read 2026-09-17) — **connection-minutes bill even when idle**, so a driver holding a socket open all shift costs money every minute regardless of message volume | IoT Core: $0.08/million connection-minutes ($0.042/device/year for 24/7), $1/million messages, 5KB increments ([AWS IoT Core pricing](https://aws.amazon.com/iot-core/pricing/), read 2026-09-17). AppSync Events: $1.00/million operations + $0.08/million connection-minutes, 5KB increments ([AWS AppSync pricing](https://aws.amazon.com/appsync/pricing/), read 2026-09-17) | Ably Pro $399/mo for 50k connections, consumption billed on top; Pusher Business $299/mo for 2,000 connections ([Ably pricing](https://ably.com/docs/platform/pricing); [Pusher pricing](https://pusher.com/channels/pricing/), both read 2026-09-17) — flat monthly floors that are pure overhead against our actual concurrency (Part 2's sizing below) |
| Connection limits | ALB: 3,000 active connections per minute per LCU, $0.008/LCU-hour, plus a $0.0252/hour base ALB charge — the connections dimension is one of four LCU dimensions and you're billed on whichever is highest that hour ([akalcloud.ai ALB LCU breakdown](https://akalcloud.ai/blog/alb-lcu-pricing/); [AWS ELB pricing](https://aws.amazon.com/elasticloadbalancing/pricing/), both read 2026-09-17) | No documented hard connection cap beyond account-level API Gateway quotas | Effectively unbounded (built for device fleets) | Ably Free: 200 concurrent / 6M msgs-mo; Pro: 50k connections / 10k msg/sec ([Ably pricing](https://ably.com/docs/platform/pricing), read 2026-09-17) |
| Render demo/stage equivalent | Render's web services support WebSockets natively on the same always-on instance — no separate config, no timeout to fight ([Render WebSocket docs](https://render.com/docs/websocket), read 2026-09-17) | Not applicable — API Gateway/Lambda has no Render equivalent worth building for a stage environment | Not applicable | Same vendor SDK on both environments — the one place option (d) is genuinely simpler across stage/prod |
| Fits D5's own reasoning | **Yes** — D5 chose AWS specifically for VPC-private, per-IAM, WAF-fronted control; option (a) is that same control extended to sockets | Partially — still AWS, but reopens "two runtimes" the D7 strangler plan just closed | Partially — still AWS, but a second security perimeter to audit for a fleet 1/1000th the size IoT Core is built for | **No** — directly against D5's "Render gives us none of the first four" argument, just aimed at a different vendor |

**Pick: (a).** It costs the least, it is the only option that adds zero new compute model, and it is
the only one that inherits the authz/policy kit already sitting in `platform/src/authz.ts` and
`policy.ts` without translation. (b) and (c) are each defensible in isolation but both reopen a
debate D5/D7 already settled — "one runtime, one vendor perimeter" — for no capability this
workload needs at 20–600 drivers. (d) is the fallback if ALB+Valkey ever becomes a genuine
operational burden (see Part 2's "what would change this" below), not a starting choice.

### What (a) actually requires, concretely

1. **Fastify gets a WebSocket plugin** (`@fastify/websocket` or equivalent) mounted on the same
   `server.ts` that already runs `src/policy.ts`'s `enforce()` — the WS upgrade request is still an
   HTTP request until the 101 response, so the existing route-policy gate, WAF rules, and CloudFront
   pass-through all see it exactly like any other `/api/*` request before the upgrade happens.
2. **ALB target group idle timeout raised** from the 60-second default to something that matches a
   driver's shift (recommend 3600s, the top of AWS's own "increase this for long-lived WebSocket
   traffic" guidance) — a one-line change to `app-stack.ts`'s listener, not a new stack
   ([websocket.org ALB guide](https://websocket.org/guides/infrastructure/aws/alb/), read
   2026-09-17). CloudFront in front of it (`edge-stack.ts`) already sets
   `cachePolicy: CACHING_DISABLED` and `allowedMethods: ALLOW_ALL` on the VPC origin — both are
   required for WebSocket pass-through and are already in place for an unrelated reason (it's a
   dynamic app, not a static site).
3. **ElastiCache Serverless for Valkey**, one new construct in a new (or extended) CDK stack: pub/sub
   fan-out so a location update published by whichever Fargate task received the driver's ping
   reaches dispatcher connections held by a *different* task. Serverless, not a provisioned node,
   because the actual load (Part 3's arithmetic) never approaches a fixed instance's minimum
   footprint at any of the three sizes — provisioned only pays off once sustained throughput is
   large and predictable, which is explicitly a "revisit at 10×" item, not a day-one one.
4. **No sticky-session configuration needed** on the target group beyond what WebSocket's own
   HTTP-101 upgrade already guarantees — the same connection stays pinned to the same task for its
   whole lifetime without a cookie.

### Deploys without dropping connections

`app-stack.ts` already sets `circuitBreaker: { rollback: true }`, `minHealthyPercent: 100`,
`maxHealthyPercent: 200`, and a 30-second `deregistrationDelay` on the target group. That
deregistration delay is a **connection drain window, not a WebSocket-safe drain** as written today:
ALB stops sending *new* connections to a draining task immediately, but an existing WebSocket on
that task is not gracefully closed — it is severed when the task is killed at the end of the delay.
The fix belongs in the app, not the CDK: on `SIGTERM`, the Fastify process should (a) stop accepting
new WS upgrades, (b) send each held-open socket a `{type: "reconnect_please"}` control message so
the client reconnects proactively instead of discovering a dead socket via a stalled heartbeat, then
(c) exit once every socket has drained or the 30-second window (Render's own default shutdown grace,
extendable to 300s — [Render WebSocket docs](https://render.com/docs/websocket), read 2026-09-17;
ECS/Fargate's `deregistrationDelay` plays the same role) elapses, whichever is first. A driver whose
socket drops mid-shift because of a normal deploy should reconnect within a second or two, not
silently miss a task push until the next heartbeat timeout — that is the actual bar for "deploys
without dropping connections," not "the ALB stopped routing to the old task."

### Cost arithmetic — three sizes

Concurrency estimate, from the workload given: drivers (20–60 today, design for 10× → 200–600),
dispatcher/store consoles (~5–15 today), POS/inventory screens (~10 stores × 2–3 screens), customer
order-tracking pages (SSE, not counted here — separate from the WS pool), pick/pack boards
(~1 per store). Concurrent **WebSocket** connections: **~150–250 today, ~500–800 at 3×, ~2,000–3,000
at 10×** (SSE connections are cheaper per-connection on the ALB side and are not the cost driver).

| | Concurrent WS | ALB incremental (LCU: 3,000 active conns/min per LCU, $0.008/LCU-hr + $0.0252/hr base) | ElastiCache Serverless Valkey (storage $0.084/GB-hr, compute $0.0023/M ECPU) | Total incremental/mo |
|---|---|---|---|---|
| **Today** | ~150–250 | Under 1 LCU on the connections dimension; effectively the base ALB charge only, ≈$18/mo — but the ALB itself is **already** provisioned for HTTP traffic in `app-stack.ts`, so this line is $0 truly incremental | 0.1GB min storage × $0.084 × 730 ≈ $6.13/mo; pings ~12–60/sec plus dispatcher fan-out, well under 10M ECPU/mo ≈ $2–5/mo compute | **≈ $10–15/mo** |
| **3×** | ~500–800 | Still under 1–2 LCU on connections; incremental ALB cost negligible (a few dollars/mo) | ~0.3–0.5GB storage ≈ $18–30/mo; compute scales with fan-out volume ≈ $15–30/mo | **≈ $40–70/mo** |
| **10×** | ~2,000–3,000 | ~1 LCU sustained on the connections dimension (3,000/min threshold) ≈ $6/mo LCU + base; still trivial next to RDS/ECS spend | ~1GB storage ≈ $61/mo; compute for continuous location fan-out at fleet-wide scale ≈ $80–150/mo — **this is the threshold to revisit provisioned ElastiCache** (a fixed `cache.r7g.large`-class node becomes cost-competitive once sustained pub/sub throughput is large and predictable, rather than serverless's per-request billing) | **≈ $150–300/mo** |

Sources: ALB LCU/pricing ([akalcloud.ai](https://akalcloud.ai/blog/alb-lcu-pricing/); [AWS ELB
pricing](https://aws.amazon.com/elasticloadbalancing/pricing/), both read 2026-09-17); ElastiCache
Serverless Valkey rates ([usage.ai ElastiCache Serverless
pricing](https://www.usage.ai/blogs/aws/database-savings-plans/elasticache/serverless-pricing/),
read 2026-09-17). All directional per the same caveat `DATABASE-PROVIDER-RESEARCH-2026-09-17.md`
states for RDS pricing — verify in the AWS Pricing Calculator before budgeting.

**What would change this pick:** if a future requirement needs realtime fan-out to a geographically
dispersed *public* audience (thousands of customers nationwide watching live order maps, not the
current single-region store footprint), a vendor's global edge network (Ably, Pusher) starts to
earn its flat monthly floor back in reduced latency and reduced ops burden — revisit then, not now.

---

## Part 3 — Location pipeline

**Pipeline:** driver ping → auth (same session/key principal as HTTP) → sanity validation (speed,
teleport, clock skew) → Valkey GEO/latest-position hash with TTL → fan-out to dispatcher channels
scoped by store/region → **sampled** breadcrumb write to Postgres (PostGIS `geography`,
time-partitioned, retention policy) → ETA recompute (debounced, Part 4).

### Never write every ping to the primary — the arithmetic

At 3–10 second ping intervals: 20–60 drivers today is **2–20 pings/second**; 10× (200–600 drivers) is
**20–200 pings/second**, i.e. **1.7M–17M rows/day** if every ping hit Postgres directly. That is not
a "maybe measure it" call — it is an obviously wrong design before a single row is written, which is
exactly why `PLATFORM-AND-CUTOVER-PLAN`'s own D6 rationale leans on RLS/typed tables for correctness,
not on the primary absorbing unbounded write volume it was never sized for.

Instead:

1. **Every ping** updates a Valkey key `hw:<stage>:driver:<driver_id>:pos` (a hash: lat, lng, heading,
   speed, ts) with a short TTL (e.g. 90s — if a driver's key expires with no refresh, the dispatcher
   map should show them as stale/offline, not as frozen at their last position). This is the "latest
   position" read path for the dispatcher map — O(1), no query, no lock contention.
2. **Every ping** also triggers a Valkey `PUBLISH` on `hw:<stage>:store:<store_id>:driver-positions`
   (or a region-scoped channel) — this is the fan-out dispatchers actually see live. No Postgres
   write is on this path at all.
3. **A sampled subset** — one write per driver per fixed interval (recommend 30–60s, or on a
   "moved more than N meters since last sample" trigger, whichever fires first) — lands in Postgres
   as a breadcrumb row. At 60s sampling: 200–600 drivers → **3.3–10 writes/second at 10×**, a rounding
   error against RDS's connection/IOPS budget, independent of how fast drivers actually ping.
4. Breadcrumb table: PostGIS `geography(Point, 4326)` column, **time-partitioned** (by day or week —
   partition pruning keeps the dispatcher's "last 2 hours" queries and any compliance export off a
   full-table scan as the table grows), written by the sampler, never by the raw ping handler
   directly.

### PII and off-shift tracking — impossible by construction, not by policy

The location-ingest endpoint (whether it's the WS message handler or a REST fallback) must check a
**server-side on-duty flag** before it will accept *or* forward a ping — not merely rely on the
driver app declining to send one while off shift. Concretely: the same session/credential system
already in `platform/src/sessions.ts` should carry a `duty_active: boolean` claim (refreshed by the
existing clock-in/clock-out action, not a separate toggle a driver could leave stuck on), and the
location handler rejects (`401`, same shape as `authz.unauthorized`) any ping presented by a session
whose `duty_active` is false — the same "fail closed" posture `authz.ts` already uses for
`HW_TRUSTED_PROXY_HOPS`. This makes off-shift tracking a protocol-level impossibility: there is no
code path in which a ping from an off-duty session reaches Valkey or Postgres, not a UI affordance
that merely hides it. Retention: recommend 90 days of raw breadcrumb rows (matching a typical
delivery-dispute/audit window), aggregated-or-deleted after — flagged as an owner decision (Part 7),
since the actual number is a policy call, not an engineering one.

### Clock skew and sanity checks

Reject (don't silently clamp) a ping whose device timestamp is more than a few seconds ahead of
server receive time (clock skew) or whose implied speed between two consecutive accepted pings
exceeds a sane ceiling (a "teleport" — GPS jump or spoofing) — log both as a metric, not just a
dropped packet, since a driver whose pings are *routinely* rejected on sanity grounds is either a
device clock problem or a spoofing attempt, and only a metric surfaces which.

---

## Part 4 — Route optimization

**Queue: `pg-boss`.** It runs on Postgres's own `SKIP LOCKED`, needs no new infrastructure beyond the
RDS instance D6 already committed to, supports transactional enqueue (a route-recompute job and the
order-create that triggered it commit or roll back together), cron scheduling, retries with backoff,
and dead-letter handling out of the box ([pgboss.io](https://pgboss.io/); [pg-boss on
npm](https://www.npmjs.com/package/pg-boss), both read 2026-09-17). Plain `LISTEN/NOTIFY` alone is
tempting (zero polling) but is documented as unsuitable once volume passes roughly 10k
notifications/second or exact-once delivery matters
([nerdleveltech.com](https://nerdleveltech.com/postgres-listen-notify-job-queue), read 2026-09-17) —
we are nowhere near that ceiling (route-recompute triggers number in the tens per minute at 10×, not
per second), so `pg-boss`'s hybrid (poll workers with `LISTEN/NOTIFY` used for low-latency wake-up,
not as the delivery mechanism itself) is the right fit without needing SQS at all. **Not SQS**: SQS
earns its keep at "six-figure messages per minute, fan-out to many consumers, or cross-service
delivery" — none of which describes a single region's route-recompute worker
([nerdleveltech.com](https://nerdleveltech.com/postgres-listen-notify-job-queue), read 2026-09-17).
Revisit only if a future integration needs cross-service delivery this worker doesn't have today.

### Debounce and coalesce

An order create/cancel, or a driver breadcrumb sample landing far enough off the current plan's
predicted position, each enqueue a `recompute-region` job keyed by `(region_id)`. `pg-boss`'s
`singletonKey` (or an equivalent "only one pending job per key" guard) collapses a burst of five
orders arriving in the same 10 seconds into **one** recompute, not five — this is the debounce.
Recommend a 10–20 second coalescing window: short enough that a dispatcher does not notice the lag,
long enough that a lunch-rush burst of order creates doesn't re-solve the same region five times in a
minute.

### Solver options

| | Cost | Latency | Lock-in | Fit |
|---|---|---|---|---|
| **VROOM + self-hosted OSRM** (recommended) | Infra only (a small ECS task or two) — no per-call fee | Sub-second to a few seconds for a single region's stop count at any of the three sizes | None — open source, OSM-backed road network already usable for KML/geofencing work the estate has | **Recommended.** VROOM solves CVRP/VRPTW/CVRPTW on top of OSRM or OpenRouteService ([VROOM-Project/vroom](https://github.com/VROOM-Project/vroom), read 2026-09-17); fits D5's "no new vendor relationship" bias exactly the way RDS was chosen over a SaaS Postgres |
| **Google Route Optimization API** (fallback) | $10/1,000 visits single-vehicle, $30/1,000 visits multi-vehicle ([Google, cost model](https://developers.google.com/maps/documentation/route-optimization/concepts/costs), read 2026-09-17) — at 3,000 orders/day (10×) that's **$900–2,700/month** for multi-vehicle routing alone, before any other Maps Platform spend | Managed, likely lower ops burden | Vendor lock-in on the solver call itself (not the data) | Escalation path only, if VROOM's solve quality or latency proves inadequate — note Google's prior product in this space (Cloud Fleet Routing) was discontinued in Q2 2024 in favor of this one ([Google Maps Platform blog](https://mapsplatform.google.com/resources/blog/plan-efficient-routes-for-your-fleet-route-optimization-api-is-now-generally/), read 2026-09-17), which is itself a reason to prefer the open-source path for a system meant to run for years |
| **Onfleet's own optimization** | Already paid for indirectly (Blaze's delivery stack uses Onfleet under the hood, confirmed live in `hyperdrive-backend` — see Part "How it works today" below) | Unknown — not exposed to HyperDrive's own code today | Locked to Blaze's task-creation flow (`createOnfleetTask` flag), not callable standalone from the new platform | Not recommended as the new platform's solver: the new platform is explicitly replacing the Blaze/Onfleet dependency per the cutover plan's own arc, not building a new integration against it |
| **OR-Tools direct** | Infra only, same shape as VROOM | Comparable, more implementation work (VROOM is a ready-made HTTP service wrapping the same class of solver) | None | Not chosen over VROOM only because VROOM is already the packaged, HTTP-callable form of the same solving approach — no reason to hand-roll the OR-Tools integration VROOM already did |

### Idempotent plan versions and manual overrides

Each recompute produces a **new** `route_plan_versions` row (region_id, version, created_at, solver
inputs hash, solver output) — never an in-place mutation of the previous plan, mirroring the same
"wipe-then-repopulate becomes populate-then-swap" discipline the GAS estate's own runtime rules
already require for long jobs (CLAUDE.md §4.6) applied here to a plan instead of a spreadsheet. A
dispatcher's manual override (pin driver X to stop Y regardless of what the solver would pick) is
stored as a **hard constraint row** referenced by the next recompute's solver input — the override
survives re-optimization because it is fed back in as a constraint the solver must satisfy, not
because the solver "remembers" it; an override that has expired or been explicitly cleared simply
stops being included in the next input set. **Publish only the delta** between plan version N and
N+1 (which stops moved, whose ETA changed materially) over the socket to dispatcher channels — never
the whole plan on every recompute; the dispatcher UI already holds the previous plan client-side and
only needs to know what changed.

---

## Part 5 — Security (non-negotiable)

This section reuses `platform/src/authz.ts`/`sessions.ts`/`policy.ts` wholesale rather than inventing
a parallel socket-auth system — the same Principal, the same scopes, the same 404-not-403 posture.

- **Socket auth, same principals as HTTP.** The WS handshake carries the session token or API key in
  the `Sec-WebSocket-Protocol` header (a documented, standard place to smuggle an auth token past
  browsers that don't let JS set arbitrary headers on the initial upgrade request) — **never in the
  query string**, because query strings land in ALB/CloudFront access logs and browser history,
  which is a real leak, not a theoretical one.
- **Re-auth on token expiry.** `sessions.ts` already expires a session at 8h idle / 24h absolute. A
  WS connection opened under a session that later expires must be **closed by the server** the
  moment `sessions.lookup()` would return null for it (checked on a periodic tick per connection, not
  only at handshake) — an open socket must never outlive the credential that authorized it.
- **Per-channel authorization derived from the credential**, exactly like `authz.requireStore` /
  `requireEntity`: a driver's channel subscription is scoped to their own `driver_id` (derived from
  their Principal, never accepted as a client-supplied parameter); a dispatcher's channel list is
  scoped to `principal.storeIds`/`entityIds` exactly as today's REST routes are. **404, not 403**, on
  a channel outside the principal's scope — a store-restricted dispatcher must not learn a foreign
  store's channel even exists, the same reasoning `authz.ts`'s own doc comment gives for its REST
  routes.
- **Origin checks** at the WS handshake, validated against the same allowed-origins list CORS already
  enforces for the REST API — a WebSocket upgrade is still subject to the browser's Origin header,
  and Fastify should refuse the upgrade before running any auth logic if the Origin doesn't match.
- **Message schema validation via the contracts package.** Every inbound and outbound socket message
  gets a shape registered in `@hyper-tech/contracts` (the same package `platform/src/contracts.ts`
  already loads) and validated before it's acted on or published — a location ping, a task-status
  update, and a dispatcher override are three distinct schemas, not one loosely-typed envelope.
- **Rate limits and backpressure per connection**, reusing `authz.ts`'s `checkAndRecord` bucket
  mechanism keyed per-connection (and per-IP for the handshake itself, same as the existing
  key/session/login buckets) — a connection that exceeds its message rate gets throttled or dropped,
  not left to flood the server.
- **Max message size**: cap well below API Gateway's own 128KB WebSocket ceiling
  ([AWS pricing page](https://aws.amazon.com/api-gateway/pricing/), read 2026-09-17) — recommend
  32KB, since every real message on this system (a location ping, a status transition, a plan delta)
  is tiny; a message near that cap is itself a signal something is wrong.
- **Replay protection**: a monotonic per-connection sequence number on privileged messages
  (task-status transitions, dispatcher overrides) — a replayed or out-of-order "delivered" message
  must be rejected, not silently re-applied.
- **Audit of privileged socket actions**: a dispatcher override or a driver task-status change writes
  through the same audit hook the module loader already enforces for every REST write (plan §5's "every
  write goes through the audit hook") — a socket message that mutates state is a write, full stop,
  and gets the same who/what/before/after row a POST would.
- **No PII in channel names**: channels are keyed by opaque IDs (`store_id`, `driver_id` as already
  used elsewhere in the estate), never by name, phone, or email — a channel name is effectively a log
  line that lives in Valkey and CloudWatch both.
- **TLS only (WSS)**: terminated at CloudFront exactly like HTTPS is today (`edge-stack.ts`'s
  `REDIRECT_TO_HTTPS` already applies to the upgrade request, since it's still HTTP until the 101
  response).
- **DoS posture**: the WAF rate-based rules already in `edge-stack.ts` (2,000 req/5min per IP
  generally, 100/5min on the session-login path) apply to the WS upgrade request itself — add a
  parallel per-IP **concurrent-connection** cap (not just a request-rate cap) scoped the same way,
  and rely on the same `trustedProxyHops()`-derived client IP `authz.ts` already computes fail-closed,
  since both CloudFront and the ALB sit in front of the app exactly as they do for REST today.

### Refuter's attack list for the first build

1. **Query-string token leak** — a socket URL with the auth token as a query parameter, captured in
   CloudFront/ALB access logs or browser history.
2. **Channel enumeration / IDOR** — guessing or incrementing a store/driver ID to subscribe to a
   channel outside the caller's scope.
3. **Zombie connection past expiry** — a session expires at the HTTP layer but the already-open
   socket is never checked again and stays live indefinitely.
4. **Cross-site WebSocket hijacking** — a malicious page opens a WS to the ALB using the victim's
   ambient credentials (cookie or stored token) without an Origin check catching it.
5. **Location spoofing** — a driver client (or a MITM) sends an impossible jump or a negative
   time-delta ping to fake presence or manipulate ETA/assignment.
6. **Replay of a stale privileged message** — an old "delivered" or "task complete" frame resent to
   falsely re-trigger a completed action after a real cancellation.
7. **Slow-loris on the upgrade handshake** — many connections opened and left mid-handshake,
   exhausting a Fargate task's file descriptors before auth ever completes.
8. **Fan-out amplification** — one bad publish (bug or malicious) flooding a channel that fans out to
   every dispatcher connection watching a store, DoSing the dispatcher UI rather than the server.
9. **Schema-bypass via binary frames** — a non-JSON or oversized frame sent past whatever validation
   only checks the JSON-parse-then-validate happy path.
10. **Cross-tenant key collision** — two stores' channel or Valkey-key names colliding because a
    prefix wasn't strictly derived from a fixed, validated ID format.

---

## Part 6 — Kit primitives in `/Users/jt/wm-demo/platform` (`src/realtime/`)

Mirrors the existing kit's own shape (`policy.ts`'s registry pattern, `db.ts`'s
driver-selected-by-env factory) rather than inventing a new convention:

- **`channel-registry.ts`** — mirrors `policy.ts` exactly: `register(pattern, {auth, scopeCheck})` at
  module load time; `subscribe()` looks up the channel and refuses (same 404 posture as an
  unregistered `/api/*` route in strict mode) if it isn't registered. **An unregistered channel
  cannot be subscribed** — the socket equivalent of "a route with no auth check is impossible to ship
  by omission."
- **`publish.ts`** — the one `publish(channel, event, payload)` API every module calls; validates
  `payload` against its registered contracts schema before handing it to the Valkey `PUBLISH` call
  (key prefix `hw:<stage>:<channel>`, mirroring `sessions.ts`'s own `platform.console_sessions`
  naming discipline).
- **`presence.ts`** — a Valkey set per channel with TTL-refreshed heartbeat entries (same
  touch-on-activity pattern `sessions.ts`'s `TOUCH_MIN_INTERVAL_S` already uses for session
  last-seen) — answers "who's watching this store's map right now" and "did this driver's connection
  just go silent."
- **`sse.ts`** — the one-way helper: same channel-registry auth/scope check as a WS subscribe, but
  emits `text/event-stream` instead of upgrading. Reuses `Last-Event-ID` for reconnect-and-replay so
  a dropped customer connection resumes without missing an order-status transition.
- **`test-harness.ts`** — an in-memory `EventEmitter` standing in for Valkey PUBLISH/SUBSCRIBE,
  selected the same way `db.ts` picks `pglite` vs `pg` (`HW_REALTIME_DRIVER=memory|valkey`, defaulting
  to `memory` under `NODE_ENV=test`) — `npm test` never needs a running Valkey, exactly as it never
  needs a running Postgres today.

### First three consumers, in build order

1. **Dispatcher presence + driver-position map** (~1 module-week). Smallest possible slice that
   proves the whole chain end to end: channel registry, Valkey GEO write/read, store-scoped
   auth, and a live pin moving on `delivery/dmap.jsx`'s `DeliveryMap` component (already built as a
   static mockup with no data source — this is the module that wires it up).
2. **Order-status SSE to customers** (~3–4 days). Lowest risk: one-way, anonymous-session scoped,
   reuses the same registry with `sse.ts` instead of a socket. Proves the SSE half of the kit.
3. **Pick/pack board + StatusTimeline push** (~1 module-week). `CONSOLE-ENDPOINT-MAP.md` already
   flags StatusTimeline as a **missing route** (item 21, "a day's status per kit: built → pack →
   dispatch → refill → close") — build the underlying event-log table *and* wire it to the channel
   registry from day one, so the pick/pack board is push-native from the start instead of shipped as
   a poll loop and retrofitted later, which is the exact trap `hw-live.js`'s single-shot,
   never-refreshing `/api/state` fetch (`shared/hw-live.js:1848`, no `setInterval` anywhere in that
   file) shows the current console fell into for everything else.

---

## Part 7 — Owner decisions

1. **Topology: ALB+Fargate WebSockets + ElastiCache Serverless Valkey, SSE for one-way feeds.**
   Recommend **yes** — it's the only option that adds zero new compute model or vendor to what D5–D8
   already decided, and the incremental cost ($10–300/mo across the three sizes) is a rounding error
   against the RDS/ECS spend already budgeted.
2. **Route optimization: self-hosted VROOM+OSRM, Google Route Optimization API as a paid escalation
   only.** Recommend **yes** — Google's own prior product in this exact space (Cloud Fleet Routing)
   was discontinued in 2024, which argues for owning the open-source path rather than betting a
   years-long system on the vendor's second attempt at the same product category.
3. **Location retention: 90 days of raw breadcrumbs, then aggregate-only or deleted.** Recommend
   **yes as a default**, but this is a compliance/dispute-window policy call, not an engineering one
   — confirm the number, or override it.
4. **Off-shift tracking must be a server-side impossibility (duty-flag gate on the ingest endpoint),
   not a client-side courtesy.** Recommend **yes** — this is the one item in this document with real
   legal/trust exposure if built the easy way instead.
5. **Build order: dispatcher presence/map → order-status SSE → pick/pack + StatusTimeline.**
   Recommend **yes** — smallest-proof-of-the-whole-chain first, lowest-risk second, and the one
   surface already flagged as a genuine product gap (StatusTimeline) third, built push-native instead
   of poll-then-retrofit.
6. **Vendor realtime (Ably/Pusher/Supabase Realtime) stays declined for now**, revisited only if a
   future requirement needs realtime fan-out to a geographically dispersed public audience the
   single-region ALB+CloudFront setup doesn't serve well. Recommend **yes, decline for now.**

---

## Appendix — How location/dispatch actually works today (read-only findings, `hyperdrive-backend`)

Cited because the new design has to replace this, not guess at it. All paths under
`/Users/jt/hyper-tech/hyperdrive-backend` (READ-ONLY per this task's hard rule; nothing here was
edited).

- **The README claims more than the code delivers.** `README.md` states real-time location/task
  updates run "over Socket.IO, fed by AWS IoT Core (MQTT)." A repo-wide search for `socket.io`,
  `io.emit`, `Server(` / `createServer` found **zero matches** outside `node_modules` — `index.js`
  boots a plain `app.listen(PORT)` with no Socket.IO server ever instantiated. The MQTT half is
  real (`awsEvent/iotCore.js`, a separate process using `aws-iot-device-sdk`); the Socket.IO
  broadcast half described in the README does not exist in the code as it stands today.
- **Driver location today**: the AWS IoT Core subscriber (`awsEvent/iotCore.js:32-42,84-87`) receives
  an MQTT message per ping and calls `fleetController.updateFleetCurrentLocation()`
  (`controllers/fleets/fleet-controller.js:426-459`), which opens a fresh Mongoose connection,
  performs one `Fleets.updateOne(...)`, and closes the connection — **per message**, with no
  batching and no persistent connection reuse. There is also a REST path
  (`fleet-controller.js:53-54, 352-353`) where a driver's own duty-status update carries
  `latitude`/`longitude` in the request body.
- **No live fan-out to any dashboard exists in this codebase.** Whatever dashboard consumes fleet
  position today must be polling the REST API — there is no broadcast mechanism from the
  MQTT-ingest path to any admin/dispatcher client.
- **Reassignment is mostly disabled.** `startup/cronJobs.js` has every cron job commented out except
  `updateDutyStatusCronJob` — `orderMonitoringCron`, `scheduleReassignTask`, and
  `scheduleTaskStatusUpdate` are all dead code paths today, not running in production. The one live
  reassignment trigger is inline: `driverAssignment/monitoring/monitoringCron.js`'s
  `updateExpectedArrivalTime()` recomputes a task's ETA and calls `reassignFleet()`
  (line 36-40) only when the ETA has drifted more than 85 minutes (`DELIVERY_TIME`) from the order's
  creation time — an ETA-threshold trigger, not a continuous or scheduled re-optimization pass.
- **Onfleet is not an integration HyperDrive calls directly** — the only reference in this codebase
  (`admin/controllers/task-controller.js:2011`) is a boolean flag (`createOnfleetTask: false`) passed
  through to **Blaze's own** transaction-reassignment API call. Onfleet task creation is Blaze's
  subsystem, not something the new platform needs to integrate with on its own — it is being
  replaced by this very cutover, not extended.

## Appendix — What the dashboards actually are today (`/Users/jt/POS-Admin`)

- `Hyperdrive Logistics.html`, `Hyperwolf Driver App.html`, and `Hyperwolf Delivery.html` are all
  thin shells (59–108 lines) that load a stack of Babel-in-browser JSX files — they are **static
  mockups with seeded demo data**, not wired to any live backend. A search for `fetch(`,
  `setInterval`, `WebSocket`, and `EventSource` across `logistics/lviews.jsx`, `logistics/ldata.jsx`,
  `delivery/dmap.jsx`, `delivery/dapp.jsx`, `delivery/ddata.jsx`, and `mobile/screen-task.jsx`
  returned no real data-fetching code — only a UI "Rebalance all" button and a couple of decorative
  "refresh" icons.
- The dispatcher-facing surface is `logistics/lviews.jsx`'s `LogisticsApp`, which has `BoardView`
  (a pick/pack board), `MapView` (renders `window.DeliveryMap` from `delivery/dmap.jsx` — SVG pins
  over static region shapes today, `showPins`/regions only, no driver markers wired up), and
  `LanesView`. `delivery/dapp.jsx`'s `DeliveryApp` is region/KML/schedule **configuration**, not a
  live-tracking surface. `mobile/screen-task.jsx` is the driver app's per-stop screen.
- **The whole console loads once and never refreshes itself.** `shared/hw-live.js`'s `load()`
  function (line 1848) does one `fetch(base + '/api/state')` on boot — a documented ~1.9MB payload
  ("catalog + regions + fleet", line 120) — with a `setTimeout`-based request timeout, but **no
  `setInterval` or any recurring refresh anywhere in the file**. The only way to see fresh data today
  is the manual "Re-fetch /api/state" button (line 1722). This is the literal, present-day state of
  "an in-process LRU now, Redis later" from the cutover plan: there is currently no live-update
  mechanism of any kind on the client, which is the gap this whole document exists to close.
- `docs/codebase-audit/distribution/CONSOLE-ENDPOINT-MAP.md` confirms the Floor Restock / distribution
  console's existing routes are all plain request/response (`GET`/`POST` against
  `inventory_api.py`), and explicitly flags **StatusTimeline as missing** (item 21: "a day's status
  per kit: built → pack → dispatch → refill → close... no event log or status route exists") — the
  exact surface Part 6 names as the third build-order consumer, and the reason it should be built
  push-native rather than as a poll loop that later needs retrofitting.

---

*Sources not otherwise inlined above: AWS API Gateway WebSocket quotas
([docs.aws.amazon.com](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-execution-service-websocket-limits-table.html),
read 2026-09-17); AWS ALB idle-timeout guidance
([websocket.org](https://websocket.org/guides/infrastructure/aws/alb/); [AWS ELB sticky-sessions
docs](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/sticky-sessions.html), both
read 2026-09-17); Render WebSocket support
([render.com/docs/websocket](https://render.com/docs/websocket), read 2026-09-17); Supabase Realtime
pricing ([supabase.com/docs/guides/realtime/pricing](https://supabase.com/docs/guides/realtime/pricing),
read 2026-09-17, cited in Part 2's option (d) sizing though not tabulated above since (d) was not
chosen); pg-boss architecture ([pgboss.io](https://pgboss.io/), read 2026-09-17).*
