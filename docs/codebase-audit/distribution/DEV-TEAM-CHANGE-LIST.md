# Distribution — changes we ask the developers for

Additive, ordered by value. None blocks the engine or the console; each is here because the
existing code makes it impossible or unsafe for us to do it from outside. Each entry: what, why,
the exact shape, how to prove it. We add to this list as the rebuild proceeds.

| # | Change | Why | Shape | Prove |
|---|---|---|---|---|
| 1 | Allow our console's origin in CORS | The new console calls distribution-backend from another origin | `ALLOW_ORIGIN` parsed as a list; add the wm-demo origin | preflight from the console returns 204 |
| 2 | Fixture export (one-off, read-only) | The engine is tested by replaying real documents | `mongodump` of the collections in `DISTRIBUTION-REBUILD-PLAN.md` D0, customer fields excluded | we receive the archive |
| 3 | Indexes on `KitDistributed` | Zero indexes today; four whole-collection loads and a triple-`$unwind` on every refill | `{weekStartDate:-1,status:1}`, `{"regionData.subRegionId":1}`, `{"regionData.items.productId":1}` | `explain()` shows IXSCAN on the refill load |
| 4 | `neededQty` on refill logs | The cap currently ratchets down because only the given quantity is stored | additive field beside `refillQty` | present on new logs |
| 5 | Scheduler with a lease | Every cron is commented out; nobody knows what triggers the refill today | one `node-cron` job per flow calling a plain function with an options object, a lease document so two triggers cannot overlap | the ActivityLog shows one run per business day |
| 6 | One clock | Four hardcoded +5.5 h copies and two other definitions of "today" | `utils/businessDay.js` exporting `businessDay(ts)` in Pacific; the engine ships the same function | the refill, build and closure agree on the date of one event |
| 7 | `DistributionGlobalSettings` read with the platform filter | Two rows means one platform gets the other's caps | `findOne({platform})` in the build path as the admin read already does | stilo and hyperwolf builds use their own caps |
| 8 | `Sentry.init` | Every swallowed audit-write error is invisible today | init once at boot with `SENTRY_DSN` | a thrown route error appears in Sentry |
| 9 | `POST …/kit-refill/preview` | The console needs to show sold / need / cap / will-give / reason before committing | same input as `/cron`, returns the plan, writes nothing | preview then commit produce identical logs |
| 10 | Auth on the two Blaze transfer routes and the two report downloads | Unauthenticated today | `[admin]` middleware | anonymous call → 401 |
