# HyperDrive iOS distribution plan — stop the 90-day TestFlight expiry cycle

**Trigger:** all TestFlight builds for HyperDrive (the driver app) expired 2026-09-17, locking out
~39 drivers (`BUILD-PROGRAM-TODO.md` item A1). HyperDrive has no public App Store listing on
iOS — confirmed by `MOBILE-APP-AUDIT-GROUNDWORK-2026-09-17.md` §1 (search under "Hyperwolf",
"Hyperwolf cannabis delivery", "Hyperdrive delivery", and the developer name/address all came up
empty) — so TestFlight has been the *only* iOS distribution channel, and every TestFlight build
expires 90 days after its own upload date regardless of app version, with no way to extend an
expired build (confirmed against Apple's own documentation, cited below).

App identity, for reference: bundle ID `com.hyperdrive.hyperwolf` (reversed word order vs. the
Android package `com.hyperwolf.hyperdrive`), Apple Developer Team ID `WKJ7ST229V` (recovered
from the misnamed AASA file at `hyperdrive-backend/public/.well-known/assetlinks.json` —
see item 34 of today's dev-team change list).

---

## 1. Options compared, with citations

### Option A — Unlisted App Store distribution (recommended permanent fix)

The app goes through normal App Review once, then is switched to "Unlisted App" distribution:
it never appears in App Store categories, search, charts, or recommendations, but is reachable
by anyone with the direct link, and builds no longer expire on a 90-day timer the way TestFlight
betas do.

**Process (Apple's own support page, fetched today):**
1. Submit the app for App Review through the normal App Store Connect flow, with a note in the
   Review Notes section stating the app is intended for unlisted distribution.
2. [Submit a request for unlisted app distribution](https://developer.apple.com/contact/request/unlisted-app/)
   and wait for approval.
3. Once approved, the app's distribution method in Pricing and Availability changes to "Unlisted
   App" — for the current version and every future version — and a permanent direct link is
   generated, usable both as a plain App Store link and through Apple Business/School Manager
   assignment.

**Eligibility note:** the app must already be on the App Store, *or* be finished and submitted to
App Review — a beta/prerelease TestFlight build does not qualify on its own; this is why item 35
of today's dev-team change list still needs a fresh TestFlight build uploaded today as the
immediate stopgap while the unlisted request is in flight.

**Audience fit:** Apple's own examples for who unlisted distribution suits — "partner sales
tools, employee resources... part-time employees, franchisees, partners, business affiliates" —
describe HyperDrive's ~39 drivers close to exactly.

*Source: [Unlisted app distribution](https://developer.apple.com/support/unlisted-app-distribution) — developer.apple.com, fetched 2026-09-17.*

### Option B — Apple Business Manager (ABM) custom apps

Custom Apps are submitted through App Store Connect and assigned privately to an organization's
Apple Business Manager account; devices are assigned the app the same way an MDM would assign any
App Store app, without the app ever going public. Each custom app goes through the same App
Review guidelines as a public app, typically reviewed in 1-2 days per Apple's own guidance.

**Why this is a real alternative to Option A, not a downgrade:** ABM custom apps work well when
drivers' phones are enrolled in a company MDM. If HyperDrive drivers use personal (BYOD) phones
rather than company-issued/enrolled devices — likely, given this is a driver-employee app, not a
corporate fleet of managed hardware — Option A's unlisted-link model reaches unmanaged devices
directly, which ABM assignment does not do as cleanly. **Confirm device ownership model with the
owner before choosing between A and B** (see §7, this doesn't need to be an owner question if the
answer is already known operationally — check first).

*Source: [Learn about Custom Apps in Apple Business Manager](https://support.apple.com/guide/apple-business-manager/axm58ba3112a/web) — Apple Support, fetched 2026-09-17.*

### Option C — Apple Developer Enterprise Program

**Likely not eligible, and not recommended even if eligible.** Apple's own eligibility rules
require the applicant organization to have **100 or more employees**, be a legal entity (no DBAs
or trade names), pass Apple's verification interview, and use the program *only* for proprietary
in-house apps — Apple's own guidance explicitly says the Enterprise Program is for cases **not
adequately addressed by** unlisted App Store distribution, ABM custom apps, ad hoc distribution,
or TestFlight. Since Option A fits HyperDrive's actual shape (a small driver fleet, not >100
employees needing a proprietary internal tool with no App Store equivalent), Enterprise is very
likely both unavailable (headcount) and unnecessary (the exact case Apple says to use the other
paths for instead).

*Source: [Apple Developer Enterprise Program](https://developer.apple.com/programs/enterprise/) — developer.apple.com, fetched 2026-09-17.*

### Option D — Stay on TestFlight, with a calendar reminder + Xcode Cloud scheduled builds (stopgap only)

TestFlight builds are active for 90 days from **each build's own upload date**, not from the app's
version or today's date — an older build can expire while a newer one is still fresh, and an
expired build cannot be reactivated or extended; only a new upload resets the clock. Xcode Cloud
supports an "On a Schedule" workflow start condition — a workflow can be configured to build a
chosen branch on a recurring schedule (e.g., a specific day/time, or every weeknight) with no
manual trigger required.

**Recommendation:** use this as the **stopgap only**, running today alongside the unlisted-app
request, not as the permanent answer — a recurring rebuild still requires someone to reassign the
new build to both tester groups each cycle (TestFlight builds don't auto-assign to existing
groups on upload), and it does nothing about drivers on personal devices who'd rather have a
normal App Store-style install/update experience.

*Source: [TestFlight forums / build expiry behavior](https://developer.apple.com/forums/thread/720033) and [Configuring start conditions](https://developer.apple.com/documentation/xcode/configuring-start-conditions) — developer.apple.com, fetched 2026-09-17.*

---

## 2. What App Review will ask of a cannabis-delivery **driver** app

**HyperDrive is a logistics tool for employees — it does not sell anything to consumers.**
Confirmed from the backend: `hyperdrive-backend`'s entire surface (per
`MOBILE-APP-AUDIT-GROUNDWORK-2026-09-17.md` §2.2) is task assignment, navigation, proof of
delivery, and driver duty status — no product catalog, no cart, no payment collection. This
matters for App Review because Apple's cannabis-specific guideline is about **facilitating the
sale**, not about logistics:

> **Guideline 1.4.3:** "Facilitating the sale of controlled substances (except for licensed
> pharmacies and licensed or otherwise legal cannabis dispensaries), or tobacco is not allowed."
> **Guideline 5.1.4(a)(ix):** "Apps that facilitate the legal sale of cannabis must be
> geo-restricted to the corresponding legal jurisdiction."

*Source: [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) — developer.apple.com, fetched 2026-09-17.*

**How to position this in the App Store Connect submission (App Description + Review Notes):**
state plainly that this is an internal logistics/dispatch tool for employed delivery drivers of a
licensed cannabis retailer — it does not sell, advertise, or list cannabis products to consumers,
does not process consumer payments, and is not intended for or accessible to the general public
(which is also the honest reason it's requesting unlisted distribution, not a public listing). If
a reviewer treats it as a consumer cannabis app anyway, 1.4.3/5.1.4(a)(ix) become relevant and the
geo-restriction language should be ready to cite (HyperDrive's own region/zone logic already
exists — `hyperdrive-backend`'s `Region`/KML models, per the codebase audit — so "restricted to
licensed delivery zones" is already true operationally and just needs stating in the submission).

**A driver-app-specific risk worth flagging to whoever submits:** Apple's reviewers may still
ask what the app is "for" in plain terms, since "delivery driver" alone doesn't disclose the
product category. Be direct about the cannabis-retail context rather than describing it
generically as "a delivery app" — a vague description that gets discovered as cannabis-adjacent
during review reads worse than a clear one submitted up front.

---

## 3. Metadata / privacy declarations needed, given the backend audit

Two data types drive HyperDrive's App Privacy ("Nutrition Label") declaration and its Info.plist
usage-description strings, both already confirmed live in the backend:

1. **Location — collected continuously while on duty.** `hyperdrive-backend` runs two
   overlapping location paths: a REST `updateDutyStatus` call writing `Fleets.lastLocationData`,
   and a separate always-on MQTT/AWS IoT Core process writing `Fleets.locationData`
   (`models/Fleets.js:35,58`; confirmed present in both the schema and every consumer of
   `locationData` across `driverAssignment/*.js`). This is "always" or "when in use, but
   continuously during a shift" location collection, not one-shot — declare it as such in the
   Privacy Nutrition Label's Location category, and the Info.plist purpose string
   (`NSLocationAlwaysAndWhenInUseUsageDescription` if background tracking continues once the app
   is backgrounded during a shift, or `NSLocationWhenInUseUsageDescription` if it doesn't — **ask
   whoever holds the source which one is actually declared today**, §5 item 1) must say plainly
   that it's used for dispatch, routing, and delivery-proof, matching what the backend actually
   does with it.
2. **Camera — for ID verification and delivery proof.** Confirmed live: proof-of-delivery photo
   upload (`middlewares/multiFileUploadToS3.js`) and merged ID+selfie identity capture
   (`hyperwolf-backend/controllers/berbix/berbix-controller.js` — though that specific flow may
   be customer-side; confirm whether HyperDrive itself also captures ID/selfie for driver
   onboarding, or only proof-of-delivery photos, before finalizing the declaration). Declare
   Camera usage in the Nutrition Label as tied to delivery completion (and driver identity
   verification, if applicable), with an `NSCameraUsageDescription` string that says exactly
   that — not a generic "app needs camera access."

**Data Safety honesty check:** the Google Play listing's cached search snippet claims "No data is
shared with third parties, and data is encrypted in transit" (`MOBILE-APP-AUDIT-GROUNDWORK-
2026-09-17.md` §1, marked UNVERIFIED there). Given the backend sends location/photo data through
AWS S3 (currently `public-read` — see item 28 of today's dev-team change list) and to Firebase for
push, **this claim should be re-verified against what actually happens before it's repeated on
the iOS side's own Privacy Nutrition Label** — "not shared with third parties" is a strong claim
against a backend that hands driver location to AWS IoT Core and photos to a public-read S3
bucket.

---

## 4. Step list for whoever holds the app source

1. Confirm the current Info.plist location/camera usage-description strings and background modes
   entitlement, so §3's declarations describe what's actually shipped, not what's assumed.
2. Upload **version 1.0.6, build 3** to TestFlight today (same version number as the last known
   build, so beta review — a lighter check than full App Review — applies) and assign it to both
   existing tester groups immediately; this unblocks the ~39 locked-out drivers without waiting
   on Option A.
3. If an Xcode Cloud project isn't already wired for this app, check the Xcode Cloud tab for a
   "Start Build" button (per `BUILD-PROGRAM-TODO.md` A1) — this is likely how build 3 gets
   produced without a local build environment.
4. In parallel, prepare the App Store Connect listing for a first real submission (App
   Description, screenshots, Review Notes per §2, privacy declarations per §3) — this submission
   is the prerequisite for Option A regardless of which final distribution model is chosen.
5. Submit to App Review with the unlisted-distribution note in Review Notes (§1 Option A step 1).
6. After approval, file the unlisted-distribution request itself
   ([developer.apple.com/contact/request/unlisted-app/](https://developer.apple.com/contact/request/unlisted-app/)).
7. Once the unlisted link is live, distribute it to all 39+ drivers and retire the TestFlight
   tester-group dependency for future releases (TestFlight remains useful for pre-release QA
   builds, just no longer as the only distribution channel).

---

## 5. Owner checklist inside App Store Connect

- [ ] Confirm the Apple Developer account/Team ID (`WKJ7ST229V`, recovered from the AASA file —
      confirm this is still the active team, not a stale credential)
- [ ] Confirm who currently has Admin/App Manager role access to App Store Connect for this app
- [ ] Decide device-ownership model (BYOD vs. company-managed) — this decides Option A vs. B (§1)
- [ ] Review and approve the App Description / Review Notes language in §2 before submission
- [ ] Review and approve the Privacy Nutrition Label + usage-description strings in §3
- [ ] Approve the unlisted-distribution request once the first review passes
- [ ] Decide who owns the recurring "reassign new TestFlight builds to testers" chore during the
      stopgap window (§1 Option D) so it doesn't silently lapse again like this one did

---

## 6. Expiry calendar

| Event | Date |
|---|---|
| Prior TestFlight builds expired | 2026-09-17 (today — the trigger for this plan) |
| New build (1.0.6 build 3) uploaded, per plan | 2026-09-17 |
| That build expires (90 days from upload) if unlisted distribution isn't live by then | **~2026-12-16** |
| Recommended: unlisted App Store distribution live | before 2026-12-16, to make this the last expiry cycle |

If Option A isn't complete by 2026-12-16, the same lockout recurs — put a calendar reminder on
that date now, independent of whether the unlisted request has landed, as the safety net Option D
describes.

---

## 7. Android parity note

Per `MOBILE-APP-AUDIT-GROUNDWORK-2026-09-17.md` §1: **HyperDrive For Drivers is already live on
Google Play** (package `com.hyperwolf.hyperdrive`, developer "Hyper Technologies Inc."), unlike
iOS which has no public listing at all. This is the inverse of the iOS problem — Android doesn't
have a 90-day expiry cycle because it's on a normal production track, not a beta-testing track.

**What is NOT confirmed:** the audit's own WebFetch against the Play listing page failed
repeatedly this session (client-side-rendered page too large/dynamic for the fetch tool), so the
current Play release track (production vs. internal/closed testing), version, rating, and full
Data Safety section were not independently retrievable — the only version data point is an
unverified cached search snippet ("last updated April 20, 2026"). **Getting real track/version
detail requires either a live browser session or direct Play Console access** — this is the same
limitation `MOBILE-APP-AUDIT-GROUNDWORK-2026-09-17.md` §8 already asks the owner/dev team for
(item 2, TestFlight + Play internal-testing access), not a new ask invented here.
