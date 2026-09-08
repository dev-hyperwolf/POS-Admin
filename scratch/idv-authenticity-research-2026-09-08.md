# ID Verification Authenticity — Research Brief (2026-09-08)

Scope: what Didit actually checks, what AAMVA DLDV/Intellicheck actually are, whether fake IDs beat scanners in 2025-26, what open-source can realistically do, and what CA cannabis law requires/permits for retention. Primary source for §1-2 is `/Users/jt/POS-Admin/scratch/idv-didit-openapi-25.json` (2.5MB, openapi-25, fetched today) — grepped and parsed directly, not summarized from memory. Docs pages fetched live where cited.

---

## 1. Didit ID Verification — how it decides "genuine"

Endpoint: `POST /v3/id-verification/` ("ID Verification (document OCR + fraud checks)"). Source: openapi-25.json lines 10784-11803 (`operationId: post_v3id-verification`), corroborated by `docs.didit.me/core-technology/id-verification/overview` (WebFetch, 2026-09-08).

**Pipeline, per the spec's own description text (verbatim from the endpoint description field):**
1. Auto-classifies document type/country (you never declare it) — "Supports 14,000+ document types from 220+ countries and territories."
2. OCR reads the visual (front-of-card) zone.
3. MRZ and any barcodes are decoded (PDF417, QR, Data Matrix, Code128, EAN13 per `DocumentAIDetectedCode.type` description, line ~11470 area of the schema).
4. Cross-checks: date validity, number-format validity, MRZ checksum, and visual-zone-vs-MRZ consistency.
5. If `perform_document_liveness=true` (**default true**): screens for screen replays, printed copies, and portrait manipulation.

**Every authenticity-relevant warning code found in the spec (`RiskWarning.risk`, free-form string, not a closed enum — spec says "New values can be added over time"):**

| Risk code | What it means | Auto-decline? |
|---|---|---|
| `DOCUMENT_EXPIRED` | Document past expiry | Always decline |
| `SCREEN_CAPTURE_DETECTED` | Photo of a screen (replay attack) | Always decline |
| `PRINTED_COPY_DETECTED` | Photocopy/printout, not original document | Always decline |
| `PORTRAIT_MANIPULATION_DETECTED` | Photo on the ID was digitally altered | Always decline |
| `PUBLIC_DOCUMENT_IMAGE_DETECTED` | Image matches a publicly-circulating stock/sample ID image | Always decline |
| `MINIMUM_AGE_NOT_MET` | Computed age below configured floor | Always decline |
| `PORTRAIT_IMAGE_NOT_DETECTED` | No face photo found on document | Always decline (workflow sessions only) |
| `NAME_NOT_DETECTED` / `DATE_OF_BIRTH_NOT_DETECTED` / `DOCUMENT_NUMBER_NOT_DETECTED` | Required OCR field extraction failed | Always decline |
| `COULD_NOT_DETECT_DOCUMENT_TYPE` | Couldn't classify document | Always decline (workflow only) |
| `INVALID_DATE` | Malformed date field | Always decline (workflow only) |
| `COULD_NOT_RECOGNIZE_DOCUMENT` | No ID detected in image at all | HTTP 400, not a warning |
| `MRZ_NOT_DETECTED` / `MRZ_VALIDATION_FAILED` | MRZ missing or checksum fails | Configurable via `invalid_mrz_action` (DECLINE/NO_ACTION) |
| `DATA_INCONSISTENT` / `MRZ_AND_DATA_EXTRACTED_FROM_OCR_NOT_SAME` / `DOCUMENT_NAME_DIFFERENT_FROM_OTHER_APPROVED_DOCUMENTS` | Visual zone vs MRZ vs prior-session mismatch | Configurable via `inconsistent_data_action` |
| `EXPIRATION_DATE_NOT_DETECTED` | Can't find expiry date | Configurable via `expiration_date_not_detected_action` |
| `POSSIBLE_DUPLICATED_USER` | Same face/doc seen in a prior session (`duplicated_session_id` in `additional_data`) | Informational only, never auto-declines |

(Doc-AI/manipulation-forensics warnings, a **separate** feature from base ID Verification — see below — add: `DOCUMENT_AI_SUSPECTED_MANIPULATION`, `DOCUMENT_AI_NAME_MISMATCH`, `DOCUMENT_AI_UNREADABLE_DOCUMENT`, `DOCUMENT_AI_MISSING_REQUIRED_FIELDS`, `DOCUMENT_AI_UNSUPPORTED_FILE` — these apply to PDF/EXIF forensics on **uploaded documents** like proof-of-address, not photographed ID cards. Source: openapi-25.json line 13661-13664, 14035-14039.)

**NFC/chip codes** (`nfc_skip_reason` enum, line 5085-5093): `USER_SKIPPED`, `DOCUMENT_WITHOUT_CHIP`, `CHIP_CERTIFICATE_UNAVAILABLE`, `DEVICE_WITHOUT_NFC`, `INTEGRATION_WITHOUT_NFC_ACCESS`, `MRZ_KEY_UNAVAILABLE`. This is ICAO 9303 e-passport/e-ID chip reading (cryptographic signature verification against issuing-country certificates) — **not applicable to US driver's licenses**, which carry no NFC chip. It's a passport/eID feature.

**What the docs page adds beyond the API spec** (WebFetch of `docs.didit.me/core-technology/id-verification/overview`, 2026-09-08): "template matching against certified database" (i.e., the layout/field-position template for that specific document type/version/country is checked, not just OCR), and explicit mention of validating "holograms, watermarks" as part of "security feature validation." A blog post (`didit.me/blog/id-document-serial-number-validation-security/`, surfaced via WebSearch) additionally claims OVI, kinegram, and microprint validation — **this is marketing copy, not the OpenAPI spec**; treat the specific claim of pixel-level OVI/kinegram/microprint detection as unverified against the authoritative source. The OpenAPI spec's own hard evidence only supports: template/layout matching, MRZ/barcode decode+checksum, cross-field consistency, screen-replay/printed-copy/portrait-manipulation detection (via `perform_document_liveness`), and expiry checking.

**Does the base product consult a government database? No, not by default.** The base `/v3/id-verification/` endpoint's decision logic (quoted above) is entirely image-forensics + OCR + MRZ/barcode cross-checks. There is no government-registry call in that endpoint's documented pipeline, billing model, or response schema. Government/registry lookups are a **separate, separately-billed product**: Database Validation (§2). The docs-page fetch above also states this pattern generically: registry queries are described as optional, invoked through a distinct verification method ("non-document lookup... checked against a government register... named per country"), not as a step inside base ID Verification.

**Billing**: base ID Verification is "$0.15 per check" per `didit.me/products/id-verification/` (WebSearch result, 2026-09-08) — pay-per-call, no free tier per the OpenAPI spec text ("standalone APIs have no free tier").

---

## 2. Didit "Database Validation" — countries, mechanism, US coverage

Endpoint: `POST /v3/database-validation/` ("Database Validation (standalone)"). Source: openapi-25.json lines 18807-18904 (full endpoint description quoted/parsed directly), corroborated by WebFetch of `docs.didit.me/core-technology/database-validation/overview` (2026-09-08).

**Mechanism** (verbatim from spec): "Validate a person's identity data against official government and registry sources — CPF in Brazil, RENAPER in Argentina, DNI registries in Spain and Peru, INE in Mexico, and 100+ more services across 60+ countries." Each country exposes one or more catalog `service_id`s (e.g. `bra_cpf`, `arg_renaper`). Omit `services` and exactly one default service runs; specifying `services` unlocks the extended response (`services_used`, `match_score` 0.0-1.0). Outcome codes returned: `MATCH`, `PARTIAL_MATCH`, `NO_MATCH`, `DOCUMENT_NOT_FOUND`, `INVALID_DOCUMENT_FORMAT`, `INVALID_INPUT`, `MINOR_BLOCKED`, `DECEASED`, `BIOMETRIC_NO_MATCH`, `BIOMETRIC_IMAGE_UNUSABLE`, `INCONCLUSIVE`, `DOCUMENT_SUPERSEDED`, `REGISTRY_UNAVAILABLE`, `REGISTRY_ERROR`.

**Coverage documented in the spec's per-country `screened_data`/`source_data` breakdown (line 7985, full list given)**: Argentina (RENAPER, biometric face-match), Bolivia, Brazil (CPF via Receita Federal, with LGPD minor-status handling), Chile, Colombia, Costa Rica, Dominican Republic, Ecuador, Spain, Guatemala, Honduras, Mexico (RENAPO civil registry + separate INE validity check), Panama (SIB biometric), Peru, Paraguay, El Salvador, Uruguay, Venezuela — **all Latin America + Spain**, plus the spec separately states "60+ countries across the Americas, Europe, Africa, the Middle East and Asia-Pacific."

**US coverage — confirmed present but NOT via a DMV/AAMVA source.** The only US-specific artifact in the spec is the service id `usa_states_credit_bureau` (openapi-25.json line 19939 — "services that need at least one extra identifier (e.g. `usa_states_credit_bureau`, which cannot verify a name alone)"). WebFetch of the docs overview page names five live US services: Credit Bureau ($0.15/check), Death Check/SSDMF ($0.06), Financial Services ($0.12), Phone verification ($0.15), Residential records ($0.60) — describing this as aggregated "credit header data and other services," explicitly **not** a single DMV/AAMVA source. **No AAMVA DLDV integration is documented anywhere in the 2.5MB OpenAPI spec** (grepped for `AAMVA`, `DLDV`, zero hits outside this brief's own search). So: Database Validation's US layer is a credit-bureau/identity-data check (does this SSN/name/DOB combination exist and match on file), not a "does this driver's license number match what the issuing state DMV has on record" check.

**Pricing**: $0.05-$7.00/check by service+country (WebFetch); billed per-service, failed/skipped services not billed, `400`s free.

---

## 3. AAMVA DLDV — what it actually is, and Intellicheck

**AAMVA DLDV (Driver's License Data Verification)**, per `aamva.org/technology/systems/verification-systems/dldv` and the AAMVA-published overview PDF (both surfaced via WebSearch, 2026-09-08):

- **What it verifies**: field-level **match/no-match only** — name, date of birth, license number, issue/expiry dates — against the issuing state's live DMV record. It is a yes/no confirmation service, not a data-retrieval service; it does not hand back the DMV's actual record.
- **Mechanism**: AAMVA operates as a single gateway into participating state systems, so an integrator calls one API instead of 50 separate state systems.
- **Coverage**: 44 jurisdictions, ~73% of US population. **Not** supported: Alaska, **California**, Louisiana, Minnesota, New York, Pennsylvania, Utah — those states restrict DLDV access to their own data. (Source: GBG blog + AAMVA overview PDF, via WebSearch.) **This directly matters for Hyperwolf: our CA stores cannot use DLDV to verify a CA-issued license even through a paid vendor, because California itself blocks the lookup.**
- **Access**: AAMVA must pre-approve every customer; a signed NDA is required before receiving DLDV documentation. Access typically runs through a "Gateway Partner" (AAMVA's customer of record) who pays AAMVA setup + per-transaction fees, then re-sells/negotiates pricing to end users — i.e., **no direct self-serve API for a retailer**; you go through an approved vendor.
- **Fees**: not published as a flat public rate card. One cited example: Virginia DMV/dealer integration priced the transaction at $4.00 (dealertrack.com FAQ, via WebSearch) — that is a dealer/titling context, not necessarily representative of a retail age-verification per-swipe cost, and pricing is stated to be negotiated between Gateway Partner and end customer. **Treat "$4/query" as one data point, not a reliable estimate for retail volume pricing.**
- **Resellers found**: GBG, Veridas, Entrust, Persona, PingOne (Ping Identity), IDScan.net all advertise DLDV integration (WebSearch, multiple hits). **Socure, IDology, Experian, and LexisNexis were not confirmed as DLDV resellers by search results returned today** — say "not confirmed" rather than asserting it; they are known KYC/identity vendors generally but no citation in hand ties them specifically to DLDV reselling.

**Intellicheck** (`intellicheck.com/use-case/id-verification`, WebSearch 2026-09-08): explicitly a **heuristic/forensic approach, not a government-database lookup**. Its own marketing states it analyzes the "Authoritative North America Barcode data" — the hidden, proprietary structure each state DMV/Canadian province encodes into the PDF417 barcode (element identifiers, internal data structure, issuer-specific encoding logic) — and cross-references it against Intellicheck's own proprietary reference database of **known-good encoding formats per issuer**, built from 25+ years as AAMVA's own DL/ID Card Verification Program testing lab. It claims a 99.975% "decisioning rate." This is barcode-forensics (does this barcode's internal structure match what this state's DMV is known to produce) — it is **not** a live query against a DMV record, and it cannot detect a barcode that was correctly re-encoded with fabricated-but-correctly-formatted data (see §4).

---

## 4. Fake-ID reality, 2025-2026

**Do popular fake-ID sites produce PDF417 barcodes that pass scanners?** Yes, for basic barcode scanners. Multiple sources (Patronscan, IDScan.net, FakeIDs.com — all via WebSearch 2026-09-08) converge on the same point: a barcode scanner that just decodes and displays the PDF417 payload has no way to know if the *encoded data itself* is fabricated — it will happily display a fake name/DOB/ID-number if the barcode is correctly formatted. AAMVA's PDF417 barcode standard (element identifiers, field order) is public and documented (`dynamsoft.com`, `microblink.com`, WebSearch) — a fake-ID vendor selling "scannable" fakes only needs to follow the published AAMVA encoding spec to produce a barcode that decodes cleanly. What catches this class of fake: (a) cross-referencing the decoded data against a live source (AAMVA DLDV — but see §3 for coverage gaps, esp. California), or (b) Intellicheck-style forensic analysis of the barcode's *undocumented*, issuer-specific encoding quirks that a fake-ID vendor working only from the public spec would not replicate. A basic barcode-only scanner does neither.

**What still distinguishes fakes visually/physically, on an RGB camera or in hand** (Veriff, IDScan.net, driverslicenseguide.com, kingfakeid.com, all via WebSearch 2026-09-08 — noting several sources are fake-ID vendor sites themselves, cross-checked against the legitimate-vendor sources):

- **Laser perforation**: CA-issued cards have laser-perforated micro-holes (forming a grizzly-bear/state-shape image) that pass fully through the card and are visible from both sides when backlit. Counterfeits either omit this or fake it with surface printing that doesn't pass light through.
- **Ghost image**: a second small photo of the holder, laser-*engraved* into the card substrate (sits within the material) on genuine cards vs. printed *on top of* the surface on fakes — a tactile/depth cue a flat photograph can't always convey, but a raking-light photo can.
- **OVI/color-shifting ink**: changes color/appearance under different viewing angles. Requires tilt to observe — a single static photo cannot capture this; needs multi-frame capture (see below).
- **Microprint**: legitimate microprint reads as clean text under magnification; on fakes it commonly degrades into illegible dots/solid lines. Detectable only at resolutions well beyond what a typical phone-camera ID-scan flow captures at normal working distance.
- **Tactile/raised text**: genuine cards have laser-engraved raised lettering (detectable by touch); this is invisible to any camera — a pure image-based system cannot check it at all.
- **UV features**: explicitly **not visible** to a normal RGB camera under normal lighting — requires a UV light source; out of scope for any phone/webcam-based system.
- **Card material/weight/flex**: genuine polycarbonate cards have specific flex/rigidity/thickness; also not camera-detectable.
- **Font kerning/spacing irregularities**: is a real, camera-detectable signal (raised in state-guide sources) but is soft evidence — modern high-quality counterfeits increasingly replicate fonts closely.

**"Document liveness" (multi-frame tilt capture)**: confirmed as a real, named technique across multiple scanner-vendor sources (Regula Forensics `regulaforensics.com/blog/id-document-liveness-detection`, HyperVerge, Didit's own blog — all via WebSearch 2026-09-08). The user is prompted to tilt the physical document while the camera captures multiple frames; software then checks whether OVI/hologram/kinegram elements actually *change appearance* across frames the way genuine optically-variable security features do under viewing-angle change. This is meaningfully different from Didit's base `perform_document_liveness` flag (§1), which — per the OpenAPI spec text — only screens for screen-replay/printed-copy/portrait-manipulation from a **single pair of front/back images**; the spec text does not describe a tilt/multi-frame capture requirement for the standalone `/v3/id-verification/` endpoint. (A tilt-based flow may exist in Didit's interactive SDK/workflow product, not confirmed here — out of scope of what the openapi spec's standalone-API section documents.)

**Screen replay / "photo of a photo" detection literature**: real, active research area. Regula and Mitek (`miteksystems.com/blog/document-liveness-detection`) both publish on this commercially. Academically: an arXiv 2026 paper on "Receipt Replay OOD" benchmarks screen-replay detection under domain shift; the DLC-2021 dataset explicitly includes color-photocopy, grayscale-copy, and screen-replay attack categories for ID documents. Detection methods described: moiré-pattern classifiers, refresh-rate/frequency-domain artifact analysis, boundary-focused detectors that apply a Hough transform along the document edge to catch stripe-like moiré leakage at the border (distinguishing recapture artifacts from ordinary glare/reflection). (Sources: arxiv.org/pdf/2605.26855, researchgate.net moiré-pattern-leak-detection figure, mathnet.ru screen-recapture paper — all via WebSearch 2026-09-08.)

---

## 5. What open-source can realistically do

Grounded in the academic literature surfaced above (arXiv, researchgate, WebSearch 2026-09-08):

- **Per-country/template matching**: feasible in principle (compare detected document layout against a reference template per country+doc-type+version) but requires a template library Hyperwolf would have to build and maintain itself — no evidence of an open, comprehensive, current per-US-state DL template library was found in this search.
- **Font/layout consistency checks**: feasible with standard CV/OCR tooling (character spacing, font-matching against a reference); soft signal, not a hard pass/fail — matches the "soft evidence" caveat in §4.
- **ELA (Error Level Analysis) / copy-move forgery detection**: standard, off-the-shelf digital-forensics techniques; academic datasets exist to train/benchmark against (FMIDV — 28k copy-move-forged documents across 10 countries, built specifically to detect guilloche-pattern forgeries, from MIDV-2020 base images — l3i-share.univ-lr.fr; arxiv.org/pdf/2206.10989 on guilloche-forgery detection specifically).
- **Moiré/screen-replay detection**: academically documented and reproducible (see §4's screen-replay literature) — this is the most mature open research area of the ones asked about.
- **Multi-frame OVI/hologram shift detection**: documented as a commercial technique (Regula, HyperVerge) but **no open-source implementation or open dataset was found** for training/validating this specifically — the hologram-detection paper found (`researchgate.net/publication/360999496_Hologram_Detection_for_Identity_Document_Authentication`) is a single academic paper, not a maintained open-source library.

**Open datasets of genuine vs. fake US IDs**: **essentially none exist, as expected.** What was found is all **synthetic/dummy documents, not real US state-issued IDs**, and mostly international in composition:
- **MIDV-2020**: 1000 *artificially generated dummy* identity documents (video/scan/photo), international document types — not real IDs, not exclusively/primarily US.
- **SIDTD**: synthetic ID/travel documents, Creative Commons licensed, built via Crop&Replace/inpainting synthetic-forgery generation — synthetic by design.
- **FMIDV**: 28k copy-move forgeries generated *from* MIDV-2020's synthetic base — same limitation, inherited.
- **DLC-2021**: presentation-attack dataset (photocopies, screen replays) — again built on dummy/synthetic base documents per the same research lineage.
- **IDNet** (arxiv.org/html/2408.01690v1) and **FantasyID** (arxiv.org/pdf/2507.20808): both explicitly synthetic/generated datasets for fraud-detection research, 2024-2025 vintage.

No source found offers a real-genuine-vs-real-fake US driver's-license image corpus — for obvious legal/privacy reasons (real IDs are PII; real fakes are contraband). **Any open-source authenticity model Hyperwolf builds would have to train/validate on synthetic data and would carry an honest, stated gap: it has never seen a real California DL next to a real confiscated fake CA DL.** That gap is exactly the boundary the commercial vendors (Intellicheck, AAMVA) close by having actual issuer cooperation/proprietary reference data — something open-source cannot replicate without that same institutional access.

---

## 6. California DCC — what's required, what's permitted, what's restricted

**Age/ID-check requirement**: Cal. Code Regs. Tit. 4, § 15404 ("Retail Customers") requires retailers to confirm age and identity **"by inspecting a valid form of identification"** before selling adult-use cannabis to anyone under 21 (18+ with a physician's recommendation for medicinal). Source: `law.cornell.edu/regulations/california/4-CCR-15404` (WebFetch, 2026-09-08). **The regulation text is silent on scanning** — it says "inspecting," which is satisfied by visual inspection alone; it neither mandates nor prohibits electronic scanning, and says nothing about retaining scanned images. Acceptable ID forms per the regulation: government-issued ID with required identifying info, Armed Forces ID cards, US/foreign passports.

**Retention restriction — this is the one that actually binds the system design**: Cal. Civil Code § 1798.90.1 (Title 1.81.2, "Confidentiality of Driver's License Information") governs any business that scans/swipes a DMV-issued license or ID card. Source: `codes.findlaw.com/ca/civil-code/civ-sect-1798-90-1` + `law.justia.com` (WebSearch, 2026-09-08). Key provisions:
- Scanning/swiping is permitted **only** for enumerated purposes: verifying age or document authenticity; complying with a separate legal record-keeping requirement; transmitting to a check-service company for payment verification (name+ID-number only may be retained by that company); or fraud prevention/investigation.
- **Data obtained for age/identity verification may not be retained longer than 24 hours after the scan/swipe.** (Other enumerated purposes carry a 72-hour limit per the statute's own internal cross-references — confirm exact hour figure per purpose against the statute text directly before hard-coding, since the WebSearch summary conflated "24 or 72 hours as provided" without pinning which purpose gets which window.)
- Retention or use beyond the enumerated purposes/windows requires **the individual's affirmative consent.**
- Statute does not on its face prohibit an *image* scan (vs. a magnetic-stripe/barcode swipe) outright — it's written in terms of "scan or swipe... to obtain information," which reads broadly enough to cover a camera-based capture of the printed/encoded data, but this brief did not find a case or DCC guidance document explicitly applying § 1798.90.1 to camera-based ID-photo capture as opposed to stripe/barcode swiping. **Flag as needing a closer legal read before relying on the 24-hour figure as authoritative for a photo-based (not swipe-based) capture flow** — the statute predates smartphone-camera ID-scan UX and its plain text is stripe/swipe-centric.

**Net for system design**: DCC itself does not require scanning at all — visual inspection satisfies compliance. If Hyperwolf chooses to scan/photograph for its own fraud-prevention purposes, Civil Code 1798.90.1 caps retention of the *data obtained from that scan* at 24 hours for verification purposes, and requires consent for anything longer or for other uses. This is a **real constraint on any design that wants to keep ID photos around for later manual review, dispute resolution, or model training** — that use case isn't one of the statute's enumerated purposes on its face, and would need either an under-24-hour lifecycle or documented customer consent.

---

## What this means for an autonomous, no-vendor engine

Didit's base ID Verification product — and the entire commercial IDV industry's marketing language around "authenticity" — is fundamentally an **image-forensics + OCR/MRZ/barcode-consistency + template-matching** system, not a government-database check; the government-database layer (AAMVA DLDV, Database Validation) is a separate, separately-priced add-on that, for California specifically, is *unavailable through AAMVA at all* because California blocks DLDV access to its own DMV data — meaning even a fully-paid, best-in-class commercial stack cannot get a live California-DMV yes/no on a CA-issued license, and would fall back to the same class of forensic/heuristic signal (Intellicheck-style barcode-encoding forensics, or Didit-style document-liveness/template checks) that an in-house engine would use. That closes most of the gap that would normally justify buying a vendor: the hard, unautomatable edge — real laser perforation, engraved ghost images, tactile raised text, UV features — is invisible to *any* RGB-camera pipeline, vendor or not, so the commercial products' actual advantage over open tooling is narrower than their marketing implies: template libraries built from proprietary specimen access, screen-replay/moiré models trained at scale, and (for non-CA states) a live DMV match signal CA stores can't use anyway. An in-house engine built on the same primitives documented here — MRZ/barcode decode+checksum, cross-field consistency, OCR-based template/layout matching, ELA/copy-move and moiré/screen-replay detection trained on the available synthetic datasets (MIDV-2020/SIDTD/FMIDV/DLC-2021) — can close most of that gap for the CA cannabis-retail use case specifically, with the explicit, stated caveat that it has never been validated against a real genuine-vs-real-fake CA DL corpus (none exists, open or otherwise) and cannot check laser perforation, tactile engraving, or UV features under any circumstance. Legally, none of this is even required: DCC only mandates visual inspection, so the entire authenticity-engine question is a fraud-reduction investment layered on top of a compliance floor that's already met by a human looking at the card — and if the engine captures and stores the ID image at all, Civil Code 1798.90.1's ~24-hour retention cap (pending confirmation against camera-capture, not just swipe) becomes the binding constraint on system design, not the sophistication of the authenticity check itself.
