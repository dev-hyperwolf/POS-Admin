# RFID for distribution kit verification — what exists, what's missing

Read-only study, 2026-09-10. Every claim cited `path:line`. Sources: `/Users/jt/POS-Admin/rfid*`,
`/Users/jt/POS-Admin/docs/`, `/Users/jt/Documents/hyperwolf-repos/rfid-middleware` (real clone,
found via `find /Users/jt -maxdepth 3 -type d -iname "*rfid*"`), `/Users/jt/wm-demo/wmdemo/*.py`,
`/Users/jt/hyper-tech/distribution-backend` (read-only). Context read first: `DISTRIBUTION-LOGIC-
MAP.md` §1–§2 and `OWNER-NOTES.md`'s 2026-09-10 entries on RFID, Concept B/D, batch identity.

## 0. Which direction is current

`rfid/` is **the shipped module** per its own note (`rfid/NOTES.md:1-4`): Direction **A**'s whole
spine (data model, admin console, chrome) with Direction **C**'s TC22R handheld screens and
decision-rights model grafted on. **Direction B contributed nothing** (`rfid/NOTES.md:41-43`).
`rfid-direction-a/b/c/` are untouched studies, not competing live code. Git confirms the sequence:
the direction studies land 2026-08-25/26 (shared commits `121024a`, `200d4ea`), then `rfid/` gets
two more commits closing gaps that touch only it: `04b26e7` "QA follow-ups" and `ca8cf3e`
(2026-08-28) "fix: five rfid toasts claimed real inventory/desk/audit writes with no backend
behind them." Index `<title>`s don't disambiguate (`rfid/` and `rfid-direction-a/` both say
`RFID — Hyperdrive`); the NOTES.md files are what settles it.

**Everything in `rfid/` is a static mockup, not wired code.** `rfid/data.jsx:1-13` is fixture data
behind a fixed clock and a seeded PRNG "so the prototype renders identically on every open."
Commit `ca8cf3e` rewrote five toasts using real-operation language ("Kit posted," "Written off")
to say explicitly that nothing was written, because the decision store is `React.useState` that
"resets on reload and is never persisted anywhere" (commit message; diff at `rfid/screen-kits.jsx`
changes `"Kit posted"` → `"Kit posted — not written to inventory"`).

## 1. What exists

### 1.1 Routes (`rfid/`)

Eight hash routes (`rfid/NOTES.md:23-25`): `#/kits`, `#/counts`, `#/commission`, `#/registry`,
`#/handheld`, `#/devices`, `#/audit`, `#/settings`. Two matter here:

**`#/kits` — kit verification** (`rfid/screen-kits.jsx`). Its own subhead: "The handheld scans
each box of a kit. Every tag is assigned to the one box it read strongest in, then per-box SKU
counts are diffed against the distribution plan. Posting the result is a decision, and it is made
here." (`:35`). Shows planned vs. counted per kit (`:81-82`), a per-box progress bar (`:123-126`),
a per-(box,SKU) diff table (`:282,304`), a rescan queue for sub-gate reads (`:354`), an
"argmax vs. naive" comparison (`:372-374`), and a sticky "Approve & post kit" bar (`:432`). **No
refill mode**: `grep -n "refill" rfid/screen-kits.jsx rfid/data.jsx` returns nothing, even though
`OWNER-NOTES.md` and `REFILL-CONCEPTS.md` treat refill as its own daily flow.

**`#/counts` — cycle count** (`rfid/screen-counts.jsx`). A room walk-scan, not kit verification:
"no argmax and no confidence gate here" (`:2-3`). Dedupes by EPC across passes, reports coverage
vs. a 98% bar, lists "stragglers" only a supervisor may close as missing (`:4,21-22`). Not a
return-verify screen — it audits a room's expected inventory, not one kit's dispatched-minus-sold.

**No return-verify screen exists anywhere** in `rfid/` or any direction study. The only "dispatch"
hit is a cycle-count "second pass dispatched to device" button (`rfid/screen-counts.jsx:107`),
unrelated to driver returns. The owner's own notes already flag this as undesigned: "Two new
verification moments... pack verify... and return verify... Both belong on the timeline"
(`OWNER-NOTES.md`, "Concept D + RFID requirement" entry).

### 1.2 Data model

`rfid/data.jsx:1-9`: the engine is "a faithful JS port of `rfid-middleware/src/reconciliation/
engine.ts`" — "no screen may hold its own figure." Confirmed same algorithm shape between
`rfid/data.jsx`'s `reconcileKit` (from line 47) and `rfid-middleware/src/reconciliation/
engine.ts:29-51` (argmax over `Map<epc, Map<box, rssi>>`, −62 dBm gate, per-box SKU diff).

EPC scheme: 96-bit closed-loop, not SGTIN-96 (`rfid/data.jsx:29-32`, matches
`rfid-middleware/README.md`'s gap note). **Tag → batch, not just tag → SKU**: the canonical tag
record's `batchId` is required, not nullable, because "a nullable batch is how half the tags end
up unattributable, and recall is exactly when you cannot afford a lookup through the package to
be wrong" (`rfid-middleware/src/ports.ts:18-20`; `db/schema.sql:13-14`) — this already satisfies
the owner's "unit of allocation is the batch, not the SKU" requirement, at the tag-record level.
**The reconciliation engine doesn't use that field yet**: `KitReconResult`/`SkuLine` are keyed by
`sku` only (`rfid-middleware/src/types.ts:52-58`), so it can't say which batch is short or flag
`MIXED_BATCH` — new engine work (§5).

### 1.3 Decision rights

`rfid/data.jsx:517-527` (`DECISION_RIGHTS`) and `rfid/ui.jsx:33-116` (`RfidDecisionProvider`): the
handheld only **asserts**; a **Supervisor** approves/posts a kit, rejects and re-scans, closes a
straggler as missing, rebinds an EPC, or changes RF power/gate — each gated by a typed reason and
audited (`rfid/NOTES.md:45-59`). Matches the middleware's rule: "the handheld ASSERTS what it
read; only the desk approves and posts" (`rfid-middleware/docs/HYPERDRIVE-INTEGRATION.md:277-279`).

## 2. Hardware and middleware

**Hardware**: one handheld reader only, no fixed/portal reader (`rfid/screen-system.jsx:140,144`).
Zebra **TC22R** integrated handheld — on-board UHF, built-in screen, Android
(`rfid/screen-system.jsx:391`; `rfid-middleware/README.md`, invoice `SO-2030101`). Printer: Zebra
**ZT411** on Vulcan Glint UHF paper labels, no on-metal stock (`rfid-middleware/README.md`).

**Reads reach the browser via a native shell that does not exist yet.** A browser can't reach the
UHF radio or set RF power, so "a thin Android WebView shell owns the Zebra SDK and streams reads
into this page" (`rfid/screen-system.jsx:21-22`; middleware doc status: "**SPECIFICATION. The
shell does not exist yet.**", `ANDROID-BRIDGE.md:1-4`). Contract: shell injects
`window.HyperwolfRfid` (`connect/disconnect/setRfPower/startInventory/stopInventory/getBattery`)
and calls `window.onHyperwolfRead(read)`; **the page owns session/WebSocket/idempotency**, not the
shell (`ANDROID-BRIDGE.md:82-90,106-150`). DataWedge is ruled out (not supported on TC22R per
Zebra's own docs, `ANDROID-BRIDGE.md:24-30`); the live path is the Zebra RFID SDK for Android
(API3), with an unverified zero-Android alternative (Enterprise Browser's JS RFID API — TC22R
support unconfirmed, `ANDROID-BRIDGE.md:47-56`). `src/readers/ZebraAdapter.ts` /
`MockAdapter.ts` are the swap point; reads then flow over REST (durable) and WebSocket (live,
non-durable) per `HYPERDRIVE-INTEGRATION.md:115-146`.

**What `rfid-middleware` provides**: a real, fairly complete TypeScript module (77 tests + a
100-check conformance kit per its README). Explicitly "a module inside Hyperdrive, not a service
beside it" (`HYPERDRIVE-INTEGRATION.md:7-9`), owning kit verification, cycle count, and tag
commissioning only (`:11-17`) — **no storage**; the host implements eight "ports" (`src/ports.ts`):
`TagRegistry`, `PlanProvider`, `SessionStore`, `SerialCounter`, `LabelPrinter`, `AuditSink`,
`IdempotencyStore`, `WsAuthorizer`. REST: `POST /tags/commission`, `POST /kits/:kitId/sessions`,
`POST /sessions/:id/boxes/:box/reads`, `POST /sessions/:id/reconcile`,
`GET /sessions/:id/move-list`, plus cycle-count equivalents (`:119-126`). WebSocket:
`/v1/rfid/stream?session=<id>`, provisional live counts, never persists (`:130-140`).

**wm-demo has no RFID integration.** `grep -arniE "rfid|epc" wmdemo/*.py` and
`grep -arliE "rfid" docs/*.md` returned zero real hits. The one real cross-system link is not
RFID: a kit write (`POST /api/kit`, `wm-demo/wmdemo/server.py:4335-4340` → `catalog.set_kit()` →
`_heal_delivery_async()`) republishes the public Weedmaps delivery menu, since
`union_menu_skus()` (`server.py:1723,1739`) unions on-shift driver kits. The middleware's own docs
flag this, "verified against a live wm-demo server" (`HYPERDRIVE-INTEGRATION.md:262-281`): **RFID
reconciliation output must never be wired straight to a kit write** — the decision-rights split
(§1.3) exists around exactly this hazard.

## 3. Tag lifecycle

Association happens at **commissioning** (receiving-side), not packing: minting an EPC binds it
1:1 to `retailId`, `packageId` (METRC Scan-One-Get-All key), and a **required** `batchId`
(`rfid-middleware/src/ports.ts:13-25`; `db/schema.sql:9-20`). 1:1 is enforced at commissioning,
"not discovered at scan time... A duplicate caught at scan time is already on a jar, in a box,
possibly on a van." (`HYPERDRIVE-INTEGRATION.md:90-99`). Batch identity is preserved end to end:
`idx_tag_batch` exists for "recall path: every physical unit from a failed batch, by scan"
(`db/schema.sql:24`).

State machine (`src/lifecycle/tagState.ts:19-30`): `AVAILABLE → TRANSFER_PENDING/ALLOCATED/HELD/
SOFT_HOLD/DAMAGED/DESTROYED`; `ALLOCATED → DISPATCHED`; `DISPATCHED → SOLD/RETURNED/DAMAGED/
DESTROYED`; `SOLD → RETURNED` ("a sale is not the end; returns happen," `:24`);
`RETURNED → AVAILABLE/DAMAGED/DESTROYED`; `DESTROYED` terminal. Transitions go through a
compare-and-set (`updateState(epc, from, to)`) so concurrent scans can't race (`:12-16,85-131`).
METRC pushes are explicitly not built, blocked on "who is system of record during the Blaze
cutover" (`HYPERDRIVE-INTEGRATION.md:304-306`).

**At sale / at return**: no code path found for either. The state machine names `SOLD` and
`RETURNED` and their legal transitions, but nothing calls `transitionTag` from a Blaze sale event
or a return scan — and no return-scanning screen exists at all (§1.1). The lifecycle is ready to
receive a return-verify flow; the flow itself is unbuilt.

## 4. Fit to the three verification moments

**(a) Pack verify — after initial build.** *Exists*: `#/kits` — argmax box assignment, per-box
SKU diff vs. plan, supervisor approve/reject; `reconcileKit()` (`engine.ts:29-51`) is the real
engine it mocks. *Missing*: (1) SKU-level only, no `MIXED_BATCH` line for two-batches-in-one-box;
(2) the plan shape (`box_index → {sku → qty}`, `db/schema.sql:42-48`) carries no batch id;
(3) the screen isn't wired to a real `PlanProvider` reading `KitDistributed` — it's fixture data.
*Plan must expose*: per box, per **batch** planned quantity — new surface, not present in
`KitDistributed.regionData[].items[].productBatches` today (§5).

**(b) Pack verify — after refill (per box).** *Exists*: nothing RFID-specific — no refill mode on
`#/kits` (§1.1), `#/counts` is a room audit not a per-kit diff. *Missing*: an entire mode.
`REFILL-CONCEPTS.md`'s four concepts are scan-agnostic UI, not an RFID step. Needs either a
`mode: 'refill'` on the kit session diffing against the refill's *delta* plan, or a new screen.
**This is the largest gap for pack-verify.** *Plan must expose*: the refill's own per-box,
per-batch delta, separate from the kit's cumulative plan, so a scan can tell "still missing from
build" from "this refill's addition wasn't packed."

**(c) Return verify (dispatched − sold vs. read).** *Exists*: lifecycle has `DISPATCHED →
SOLD/RETURNED` and `SOLD → RETURNED` (`tagState.ts:23-24`); schema has `delivery_ledger` with
`sold + returned + remaining = original_allocation` as a DB constraint (`db/schema.sql:90-100`) —
matches the owner's own framing, "expected back = dispatched − sold (Blaze) ± refills; read back
= RFID; difference = discrepancy" (`OWNER-NOTES.md`). *Missing — the bigger of the two gaps*:
(1) no scanning screen at all, in any direction; (2) nothing computes "dispatched − sold" from
Blaze — that logic lives only in distribution-backend, and "sold" there is itself under-counted
(only ASAP-tagged orders, `DISTRIBUTION-LOGIC-MAP.md` §2, `common-controllers.js:125`); (3) no
`'RETURN'` mode in `ScanSession` (`src/ports.ts:97-105`, only `'KIT'|'CYCLE'`) — would need its
own reconciliation, closer to `roomAudit.ts`'s straggler logic than `reconcileKit`'s per-box logic,
since a return scan asserts presence, not location. *Plan must expose*: per kit, per batch,
`originalAllocation`, correctly-computed `sold`, and any `refills` since dispatch, so
`expected = dispatched − sold + refills − priorReturns` is ready before the scan runs.

## 5. Integration options with distribution-backend's scan path

Existing path is **barcode/manual, one unit per call**: Socket.IO `scanProduct`
(`common/socket.js:20`) → `common/scanHandler.js:4-40` → `services/scanItems.service.js:31`
(`scanItemService`), keyed by one `productBatchId`, matched against
`KitDistributed...productBatches[]` (or `.refillLogs[].productBatches[]`) by **`productBatchId`
OR `sku` fallback** (`scanItems.service.js:183-188`) — the SKU fallback can match the *wrong
batch* today, exactly the ambiguity RFID's required `batchId` would resolve. Extra scans open a
`Discrepancy` (`:142-181`); matched scans increment `scannedQty` by one on both the item and the
batch entry (`:349-360`).

**Shape mismatch**: the handler processes one `productBatchId` per call; an RFID box scan yields
dozens–hundreds of `{epc, rssi, boxIndex}` reads needing argmax + gate reconciliation *before* any
SKU count exists. Firing one synthetic `scanProduct` per resolved unit would work mechanically but
throws away box-level argmax, the confidence gate, and cross-box move suggestions, all of which
need the whole box's read set at once — and loses the "rescan, don't count" signal
(`rfid/screen-kits.jsx:354`) unless pre-filtered outside the engine.

**Recommended, additive only — for `DEV-TEAM-CHANGE-LIST.md`**:
1. A **new endpoint**, not a `scanProduct` reuse — e.g. `POST /kits/:kitId/rfid-reconcile`
   accepting a full box's reads, or the middleware's own shape
   (`POST /sessions/:id/boxes/:box/reads` + `.../reconcile`, `HYPERDRIVE-INTEGRATION.md:119-126`).
2. **Additive fields** on `KitDistributed...productBatches[]` (`rfidScannedQty`,
   `rfidDiscrepancy`) feeding the existing `Discrepancy` model the same way barcode scans do.
3. **Batch-keyed plan**: today's `BoxPlan` (`rfid-middleware/src/types.ts:46`,
   `Map<box, Map<sku, qty>>`) and `db/schema.sql:42-48`'s `box_plan` are SKU-keyed only; extending
   to batch-level is additive and needed for the mixed-batch flag (§1.2).
4. A **new `RETURN` session mode** (`ScanSession.mode`, `src/ports.ts:99`) with its own
   reconciliation function (§4c).
5. **Never** wire RFID output straight into `/api/kit` — confirmed hazard, §2.

## 6. Open questions for the owner

1. **Tagging point** — receiving (satisfies "100% certainty on every received product" directly)
   or packing? Middleware schema assumes receiving-time commissioning
   (`registered_at`... "set at hw-intake-ops Phase 1," `db/schema.sql:18`); nothing found actually
   commissions a tag today.
2. **One tag per unit vs. per case** — model assumes per-unit (`TagRecord`, `ports.ts:13`); cases
   aren't modeled anywhere found.
3. **Reader placement** — one handheld only is designed for; multi-operator cycle count "is
   designed and simulated, and stays unvalidated until a second unit exists"
   (`rfid/screen-system.jsx:146`). Second reader or fixed portal (currently "cancelled,"
   `:144`) for the return dock?
4. **Return-scan location** — dock (box-by-box, like pack-verify) or single room-audit-style scan
   (like `#/counts`)? Decides whether return-verify reuses `reconcileKit`'s or `reconcileRoom`'s
   shape (§4c).
5. **Batch storage location** — owner's mixed-batch note asks where this lives; not found in
   `ProductBatch`, the middleware schema, or `KitDistributed`. New field either way.
6. **Hardware bring-up still unverified** — per-read RSSI, runtime RF power control, and the
   −62 dBm gate are "simulation-validated only" (`rfid-middleware/src/types.ts:27-38`;
   `rfid/screen-system.jsx:116`), blocking calibration of any threshold above.
