# Hyperwolf Verify — calibration against the imported Didit corpus

**Date:** 2026-09-08
**Scope:** plan §2.5. Face 1:1 ROC, document extraction accuracy, passive liveness
distribution, duplicate-person 1:N, per-stage latency.
**Tool:** `/Users/jt/wm-demo/idv-engine/tools/calibrate.py` (new, re-runnable — see §6).
**Data snapshot:** `wmdemo-idv-dev.sqlite3` copied via the SQLite online-backup API at
2026-09-08 ~19:45 local. The Didit import was **still running** during this work; the corpus
grew from 923 to 1,020 media-bearing sessions between the first and last stage. Every number
below is from **one** snapshot: 1,020 imported sessions carrying media.

**No names, dates of birth or document numbers appear in this report or in any file the tool
writes.** Identity is carried as a salted SHA-256 digest and individuals are referenced by
session number only.

---

## 0. Headline

| Finding | Number | Verdict |
|---|---|---|
| Face 1:1 EER, SFace, ID-portrait vs selfie | **18.2%** (95% CI 15.6–20.1), n=582 genuine / 337,730 imposter | As published research predicts. Not a bug. |
| False-decline implied by the shipped `face_match_min = 75` | **86.9%** of genuine pairs (506/582) | 🔴 The gate as configured would reject ~7 of every 8 real guests. |
| Passive liveness (`MiniFASNetV2`) score on 608 real selfies | max observed **0.049 / 100** | 🔴 The model as wired returns a constant. Any `liveness_min ≥ 0.05` is a 100% decline. |
| Barcode (PDF417) decode rate | **41.6%** of 1,020 (46.9% where a back image exists) | Below expectation; 57 of the misses are passports/permits that carry no AAMVA barcode at all. |
| Field accuracy **when the barcode decodes** | DOB 97.6%, doc-number 98.3%, surname 96.9% (n≈414) | The AAMVA path is sound. |
| Field accuracy **on the OCR-only fallback** | DOB 25.8%, surname 3.3% (n≈545) | 🔴 The OCR fallback is not usable as a data source. |
| Duplicate-person 1:N at a 1:1-derived threshold | 1,881 cross-identity hits from 144,991 pairs | 🔴 The 1:1 threshold must not be reused for 1:N. |
| Document pipeline latency, uncontended | median **1.2 s** (OCR 0.55 s + PDF417 0.57 s) | Fine. |

Two of these are engine defects rather than calibration results: the passive liveness model (§3)
and the OCR-only fallback being used as a data source (§2.3).

---

## 1. Face 1:1 — ROC, EER, operating points

### 1.1 What the labels actually are — read this before the numbers

The task specification assumed the imported corpus carries a `selfie` (Didit's liveness
`reference_image`). **It does not.** Across 1,020 imported sessions there are **zero**
`idv_media` rows of kind `selfie` with `source='didit-import'`, and only **5** imported
decisions carry a `liveness_checks[]` node at all — none with a `reference_image` URL.

What the corpus does carry is `front_image_camera_front` / `back_image_camera_front`, imported
as kinds `document_front_selfie` (872) and `document_back_selfie` (778): the **front-camera
frame taken while the guest was photographing the card**. That is the selfie used throughout
this report.

That substitution costs accuracy in a known direction:

- Uncontrolled framing — the guest is looking at the card, not the lens.
- **126 of 608 rejected frames are near-black** (mean luminance < 32; several are literally
  all-zero pixels), because the front camera had not finished its exposure ramp.
- Overall **failure to acquire a face from any selfie candidate: 40.4%** (412 of 1,020).

So the FNMR figures below are **pessimistic** relative to a real capture-path selfie. They are
not, however, optimistic anywhere, and the imposter side is unaffected.

**Consequence: the thresholds in §1.5 are provisional.** They must be re-derived on ≥300 real
`selfie` media from our own capture path before any of them is written into a live workflow.
The tool re-runs unchanged once those exist (`SELFIE_KINDS` already prefers `selfie`).

### 1.2 Acquisition (n = 1,020 imported sessions with media)

| | count | rate |
|---|---|---|
| Face found in a selfie candidate | 608 | 59.6% |
| Face found in Didit's `document_portrait` | 960 | 94.1% |
| Face found in **our own** portrait crop of the front image | 878 | 86.1% |
| Pairable (selfie + vendor portrait) | **582** | |
| Pairable (selfie + our crop) | **539** | |
| Selfie rejects: no face detected | 356 | |
| Selfie rejects: near-black frame | 126 | |
| Sessions with no selfie candidate at all | 147 | |

Inter-eye distance, the ICAO TR Portrait Quality v1.0 floor being 90 px:

| sample | n | median IED | % below the 90 px floor bracket |
|---|---|---|---|
| selfie | 608 | 127.6 px | p5 = 73.9 px |
| Didit portrait | 960 | 79.0 px | **median is below the floor** |
| our portrait crop | 878 | 79.5 px | **median is below the floor** |

Both portrait sources sit under the ICAO floor. That is a property of a driver-licence
portrait at these capture resolutions, not of our crop — and it caps what any recogniser can
do here.

### 1.3 Score distributions (0–100, `pipeline.face.similarity_0_100`)

Track `vendor_portrait` — selfie vs Didit's own portrait crop, n = 582 genuine, 337,730
imposter (every unblocked cross pair; see §1.4).

| | mean | sd | p5 | median | p95 | max |
|---|---|---|---|---|---|---|
| genuine | 65.58 | 8.73 | 50.11 | 66.87 | 78.26 | 86.62 |
| imposter | 52.46 | 4.78 | 44.61 | 52.44 | 60.36 | 81.81 |

Genuine, split by Didit's own verdict on the same session:

| Didit status | n | mean | median |
|---|---|---|---|
| Approved | 398 | 67.95 | 68.76 |
| Declined | 163 | 59.67 | 58.83 |
| Kyc Expired | 12 | 67.66 | 68.53 |
| Abandoned | 9 | 64.64 | 64.69 |

Our score is meaningfully lower on the sessions Didit declined — evidence the score is
measuring something real, and a reminder that the "genuine" label on a Declined session is an
assumption (see §8).

### 1.4 Imposter construction

Every selfie was compared against every other session's portrait — 582 × 581 pairs — with
pairs **blocked** where the two sessions share a date of birth, or share a surname and first
initial. 412 pairs were blocked. The task asked for 2,000 imposters per probe; the corpus only
contains 581 other pairable sessions, so **every** unblocked cross pair is used (mean 580.3
per probe). Total imposter comparisons: **337,730**.

At that size, the finest resolvable FMR is 3.0 × 10⁻⁶, so FMR = 10⁻³ and 10⁻⁴ are both
estimable; 10⁻⁵ rests on ~3 pairs and is reported only for completeness.

🔴 **337,730 comparisons are not 337,730 independent observations** — each subject appears in
~580 of them. All confidence intervals below come from a **200-resample subject-level
bootstrap** (resampling sessions with replacement), not from a binomial interval on the pair
count.

### 1.5 ROC, EER and operating points

Track `vendor_portrait` (n = 582 / 337,730):

| threshold | FMR | TAR | FNMR |
|---|---|---|---|
| 50.0 | 6.9 × 10⁻¹ | 0.950 | 0.050 |
| 55.0 | 3.0 × 10⁻¹ | 0.854 | 0.146 |
| 56.8 **(EER)** | 1.9 × 10⁻¹ | 0.818 | 0.182 |
| 60.0 | 5.8 × 10⁻² | 0.739 | 0.261 |
| 63.7 | **1.0 × 10⁻²** | 0.631 | 0.369 |
| 65.0 | 4.4 × 10⁻³ | 0.576 | 0.424 |
| **67.4** | **1.0 × 10⁻³** | 0.471 | **0.529** |
| 70.0 | 2.1 × 10⁻⁴ | 0.356 | 0.644 |
| **71.3** | **9.5 × 10⁻⁵** | 0.287 | **0.713** |
| **75.0** (shipped) | 3.3 × 10⁻⁵ | 0.131 | **0.869** |
| 77.7 | 8.9 × 10⁻⁶ | 0.058 | 0.942 |
| 85.0 | 0 | 0.002 | 0.998 |

**EER = 18.21%** at threshold 56.80. **AUC = 0.8914.**

Bootstrap 95% CIs (200 subject-level resamples):

| quantity | median | 95% CI |
|---|---|---|
| EER | 0.1815 | 0.156 – 0.201 |
| FNMR @ FMR 10⁻² | 0.368 | 0.330 – 0.407 |
| FNMR @ FMR 10⁻³ | 0.526 | 0.484 – 0.564 |
| FNMR @ FMR 10⁻⁴ | 0.715 | 0.646 – 0.854 |
| threshold @ FMR 10⁻³ | 67.4 | 67.0 – 67.7 |
| threshold @ FMR 10⁻⁴ | 71.3 | 70.1 – 74.8 |

This is **exactly what the header comment in `pipeline/face.py` predicts.** DocFace+ (IEEE
TBIOM 2019, Table VII) reports a 99.4%-LFW model reaching 50.76% TAR at FAR = 0.1% on
ID-selfie pairs. We measure 47.1% TAR at FMR = 10⁻³ with a materially weaker 128-d model on
worse selfies. The engine's own accuracy note was right and should stay.

### 1.6 The production path is the same as the vendor path

`app.py` feeds `face_mod.match` **our own** `document.crop_portraits` output, not Didit's
portrait. Scored separately:

| track | n genuine | EER | AUC | thr @ FMR 10⁻³ | FNMR there |
|---|---|---|---|---|---|
| `vendor_portrait` (Didit's crop) | 582 | 0.1821 | 0.8914 | 67.4 | 0.529 |
| `engine_crop` (**production path**) | 539 | 0.1834 | 0.8876 | 67.4 | 0.551 |
| `vendor_portrait` + mirror-augmented template | 582 | **0.1729** | 0.8957 | 67.6 | 0.500 |
| `engine_crop` + mirror-augmented template | 539 | **0.1726** | 0.8925 | 67.5 | 0.521 |

Two useful results:

1. **Our portrait crop is not the problem.** Scoring our crop against Didit's crop of the same
   card (n = 870) gives median 98.29, p5 = 93.02, and only **0.69%** of pairs below 75. The
   0.1 pp EER difference between the two tracks is the 82 extra sessions where our crop finds
   no face at all, not crop quality.
2. **Mirror augmentation is free accuracy.** Averaging the SFace embedding of the image and
   its mirror cuts EER 18.2% → 17.3% and FNMR@10⁻³ 52.9% → 50.0% — about 3 pp of genuine
   traffic recovered for one extra ~20 ms SFace pass, no new model, no new licence. Worth
   doing; see §7.

### 1.7 Correlation with Didit's own score on the same image pair

Didit's `face_matches[].score` is **absent** from this corpus (n = 5 sessions, all seeded
demos). But the raw `id_verifications[0]` node carries
`front_image_camera_front_face_match_score` — Didit's own comparison of **the same portrait
against the same front-camera frame we used**. That is the like-for-like reference:

| | n | Pearson | Spearman |
|---|---|---|---|
| ours vs Didit camera-front score | 415 | **0.695** | 0.648 |
| same, dropping Didit's 0.0 "failed to acquire" values | 378 | 0.569 | 0.551 |

Didit reports 0.0 (acquisition failure, not a score) on **8.9%** of these.

Their score distribution on the same 415 pairs: median **74.0**, p5 = 0.0, p95 = 97.0 — versus
our median 66.9. **Their scale is not our scale.** A `face_match_min` of 75 makes sense against
a distribution centred on 74–78; against SFace's it is three quarters of the way up the
genuine distribution. The 75 in the live workflow config is a Didit-era number that was carried
across a model change, and that alone explains the 86.9% figure in §0.

### 1.8 dlib — not available, and not worth forcing

`dlib` and `face_recognition` are not installed in `/Users/jt/wm-demo/idv-engine/.venv`
(Python 3.11.16), `cmake` is not on PATH, and there is no arm64 wheel — dlib would have to be
compiled, and its ResNet recogniser needs `dlib_face_recognition_resnet_model_v1.dat`
downloaded from dlib.net. That is a build-toolchain change plus an external model download
into a shared venv, so it was not done here. **Recommendation: don't.** dlib's ResNet is a
2017 99.38%-LFW model of the same generation as SFace; on ID-vs-selfie it would land in the
same place. If a second opinion is wanted, the money is in a stronger *licence-clean* model,
not in dlib.

### 1.9 Recommended threshold

A single number cannot work here. At any threshold with a defensible FMR, more than a third of
genuine guests fail; at any threshold with a tolerable FNMR, the FMR is worthless. Recommended
instead — **provisional pending §1.1's re-derivation on real selfies**:

| band | threshold | what happens | genuine traffic | FMR |
|---|---|---|---|---|
| auto-clear | **≥ 67.5** | face check passes | 46.4% | 9.2 × 10⁻⁴ |
| review | **55.0 – 67.5** | human review, or clear on the other signals (decoded barcode cross-check + passed active challenge + age) | 39.0% | — |
| decline / re-capture | **< 55.0** | `FACE_MATCH_LOW` | 14.6% | 3.0 × 10⁻¹ of imposters sit above this line |

`face_match_min` — the value that currently drives `FACE_MATCH_LOW` → retry → decline in
`idv_rules.py:1676` — should be set to **55.0**, and a second `face_match_auto_min = 67.5`
added for the auto-clear band. Implied false-decline rate at 55.0: **14.6%** (85 of 582), and
on real capture-path selfies it will be lower than that.

Keeping 75 as a single gate implies a **86.9%** false-decline rate (506 of 582) and three
wasted retries per guest before the decline. That is the single most consequential number in
this report.

---

## 2. Document extraction accuracy

Our `pipeline/document.analyze` was run on the imported front (+ back where present) images
for **all 1,020** sessions; zero errors. Reference: Didit's `id_verifications[0]` on the same
session (present for all 1,020).

### 2.1 Barcode decode (n = 1,020; 904 have a back image)

| barcode state | n |
|---|---|
| DECODED | **424** (41.6%) |
| BARCODE_UNDECODABLE | 298 |
| NO_BARCODE_FOUND | 181 |
| NO_BACK_SUPPLIED | 116 |
| HEADER_INVALID | 1 |

Decode rate where a back image exists: **46.9%**.

By Didit's document type — this reframes the number:

| type | n | decoded | rate |
|---|---|---|---|
| Driver's License | 723 | 333 | 46.1% |
| Identity Card | 240 | 91 | 37.9% |
| Passport | 50 | 0 | **0.0%** |
| Residence Permit | 7 | 0 | **0.0%** |

The 57 passports and permits carry no AAMVA PDF417 by design, so 0% is correct behaviour, not
a failure. Of 983 US-issued documents, 423 decoded (43.0%); of 37 non-US, 1 decoded.

By issuing state (using Didit's `region` field — see §2.5; states with n ≥ 9 shown):

| state | n | decoded | rate |
|---|---|---|---|
| CA | 426 | 236 | 55.4% |
| TX | 71 | 33 | 46.5% |
| FL | 34 | 5 | **14.7%** |
| TN | 33 | 13 | 39.4% |
| IL | 27 | 9 | 33.3% |
| GA | 23 | 5 | **21.7%** |
| NY | 19 | 6 | 31.6% |
| OH | 17 | 10 | 58.8% |
| AL | 14 | 10 | 71.4% |
| AZ | 14 | 7 | 50.0% |
| MI | 14 | 6 | 42.9% |
| VA | 14 | 6 | 42.9% |
| LA | 13 | 4 | 30.8% |
| NC | 12 | 7 | 58.3% |
| PA | 11 | 7 | 63.6% |
| IN | 10 | 0 | **0.0%** |
| MN | 10 | 7 | 70.0% |
| unknown state | 144 | 0 | 0.0% |

FL, GA and IN are outliers worth a look; IN at 0/10 is small but suspicious.

Decode strategies used on the 424 successes: plain 302, 2× upscale 78, CLAHE + upscale 22,
sharpen 10, CLAHE 9, non-zero rotation 3. AAMVA versions seen: v9 (283), v10 (96), v8 (20),
v4 (13), v3 (7), v6 (5).

**Full-resolution backs are worse, not better.** On a 60-session A/B, the cropped
`document_back` (~1011 × 638) decoded 27/60 and `document_back_full` (~1620 × 1021) only
20/60. The current preference for the cropped image is correct — don't "fix" it.

### 2.2 Per-field exact match vs Didit (all 1,020 analysed)

"Comparable" = Didit published a value for that field.

| field | comparable | exact match | rate | we extracted nothing |
|---|---|---|---|---|
| date_of_birth | 965 | 547 | **56.7%** | 194 |
| expiration_date | 931 | 520 | **55.9%** | 391 |
| issuing_state | 836 | 383 | **45.8%** | 452 |
| document_number | 957 | 433 | **45.3%** | 511 |
| last_name | 958 | 419 | **43.7%** | 30 |
| first_name (raw field) | 960 | 98 | **10.2%** | 49 |
| first_name (first token only) | 960 | 428 | **44.6%** | 49 |

🔴 **The 10.2% first-name figure is a schema difference, not an extraction failure.** AAMVA
element DAC is *given names* and carries the middle name in most jurisdictions; Didit splits
first and middle. On the barcode-decoded subset, comparing first tokens gives **95.9%**. Our
`first_name` should be documented as "given names" or split at the space before anything
downstream compares it to a vendor field.

### 2.3 The split that matters: barcode vs OCR-only

| field | barcode DECODED (n ≈ 414) | OCR-only fallback (n ≈ 545) |
|---|---|---|
| document_number | **98.3%** | 5.0% |
| date_of_birth | **97.6%** | 25.8% |
| last_name | **96.9%** | 3.3% |
| first name (first token) | **95.9%** | 5.7% |

**OCR-only fallback rate: 58.4%** (596 of 1,020).

The AAMVA path is essentially exact. The OCR path produces *values* at a decent rate — of the
596 OCR-only sessions it emitted a surname for 551 and a first name for 526 — but those values
agree with the vendor on only 3–6% of documents. It is producing confident wrong answers, which
is worse than producing nothing.

🔴 **The OCR-only path must not be treated as a data source.** It is fine as a cross-check
signal against a decoded barcode; it is not fine as the sole origin of a name or a DOB on the
58% of sessions where the barcode does not decode. Note `DATA_INCONSISTENT` fired on 250
sessions — that is largely this.

OCR engine behaviour: `rapidocr-onnxruntime` (PP-OCRv4), zero OCR errors, layout profile
`layout:CA` selected 237 times and `generic` 783 times.

### 2.4 Quality score vs Didit's

| | n | mean | p5 | median | p95 | below 60 |
|---|---|---|---|---|---|---|
| ours (`front_image_quality_score`) | 1,020 | 93.78 | 80.80 | 96.0 | 98.0 | **0.39%** |
| Didit's `front_image_quality_score.overall_score` | 718 | 76.59 | 51.09 | 82.35 | 89.8 | **12.4%** |

Correlation on the 718 sessions where both exist: Pearson **0.621**, Spearman **0.774**.

The *ranking* agrees well; the *scale* does not. `doc_quality_min = 60` rejects 0.39% of our
scores and would reject 12.4% of Didit's — so on our scale that gate is very nearly inert. If
the intent is "reject the worst ~5%", the equivalent value on our scale is about **80**
(our p5 = 80.8). This should be an explicit decision, not left as an inherited 60.

Top engine warnings raised across the 1,020: `BARCODE_NOT_DETECTED` 595, `DATA_INCONSISTENT`
250, `PORTRAIT_IMAGE_NOT_DETECTED` 137, `IMAGE_TOO_BLURRY` 127, `SCREEN_CAPTURE_DETECTED` 53,
`DOCUMENT_EXPIRED` 33, `IMAGE_TOO_BRIGHT` 18, `IMAGE_TOO_DARK` 4.

### 2.5 Three Didit field-mapping traps found while doing this

Anything reading imported `id_verifications` needs to know:

1. **`issuing_state` holds the *country*.** 887 of 928 nodes have `issuing_state = "USA"`;
   `issuing_country` is null on 923 of 928. The actual US state is in **`region`**, as a full
   name ("California", "Texas"). Comparing our AAMVA two-letter code to their `issuing_state`
   scores 100% wrong for a reason that has nothing to do with extraction.
2. **`document_type` is prose, not a code.** Didit says `"Driver's License"` / `"Identity
   Card"`; we emit AAMVA `DL` / `ID`.
3. **`front_image_quality_score` changes shape.** 718 nodes carry a dict
   (`overall_score`, `focus_score`, `brightness_score`, `resolution_score`,
   `is_document_fully_visible`); 205 carry null; 5 carry a bare float. Code that assumes a
   float will throw on 718 of 928 rows.

Also: Didit's own `barcode_fields` is populated on **5** of 928 nodes, so there is no vendor
barcode result to compare our decoder against. The §2.3 accuracy figures are our barcode
against their *extraction*, whatever produced it.

---

## 3. Passive liveness — 🔴 the model as wired returns a constant

`pipeline.liveness.passive_pad` (MiniFASNetV2, 2.7_80x80, ONNX export of
minivision-ai/Silent-Face-Anti-Spoofing) was run on every acquired selfie.

### 3.1 The shipped configuration

**n = 608 scored selfies** (873 attempted; 265 had no usable image).

| | mean | sd | min | median | max |
|---|---|---|---|---|---|
| shipped `score` | 0.032 | 0.005 | **0.019** | 0.032 | **0.049** |

Mean class probabilities: `live` 0.00032, `print` 0.00602, `replay` **0.99366** — on genuine,
Didit-approved, live human faces.

Implied FNMR:

| `liveness_min` | FNMR on real Hyperwolf guests |
|---|---|
| 10 | **100%** |
| 50 | **100%** |
| 70 (the code default, `idv_store.py:2271`) | **100%** |
| 85 (what the live v3 workflow actually carries) | **100%** |

No threshold at or above 0.05 admits a single one of 608 real guests.

**Control.** Re-running the same code on the *printed portrait on the card* (n = 819) — the
only print-attack-shaped label this corpus contains — gives mean 0.026 against the live faces'
0.032. The scores rank slightly (AUC 0.874) but the absolute value is pinned at zero for
everything.

### 3.2 What the model does when fed differently

Feeding the **raw 0–255 crop** (no `/255`) and reading **class index 1** — the
`label == 1 → "Real Face"` convention of the reference repository — produces a distribution
that behaves like a liveness score:

| | n | mean | p5 | median | p95 |
|---|---|---|---|---|---|
| live selfies | 608 | 95.32 | 68.98 | 99.86 | 99.999 |
| printed card portrait (control) | 819 | 59.43 | 2.57 | 69.21 | 99.68 |

Implied FNMR under this wiring: threshold 50 → 2.5%, 70 → **5.3%**, 85 → 9.5%, 90 → 12.8%.
Separation against the printed-portrait control: EER **20.1%**, AUC 0.886.

I inspected the ONNX graph: it begins directly at a `Conv`, with no `Div`/`Mul` normalisation
node, so the scaling is not baked in and the correct input scale is genuinely ambiguous from
the artefact alone. **This is reported as a defect to investigate, not a fix to apply.**
Changing preprocessing on a security control based on one empirical comparison would be the
wrong call.

### 3.3 Why nothing caught this

`tests/test_liveness_ip.py::test_passive_pad_returns_a_score_with_provenance` asserts
`0.0 <= score <= 100.0`, that the three class names are present, and that they sum to 1. A
model returning a constant 0.03 for every image on earth passes all of it. There is no test
that a live face scores above a spoof.

### 3.4 Recommendation

1. **Do not gate on the passive score.** Make it warning-only until §3.2 is resolved against
   the reference implementation and a real PAD dataset. The live v3 workflow already pins
   `face_liveness_method = ACTIVE_3D`, which requires a passed nonce-bound challenge
   (`idv_rules.py:1657`), so the passive score is not load-bearing today — but the code default
   is `PASSIVE`, and any workflow created on that default is a 100% decline gate.
2. **If a number is required now, set `liveness_min = 0`** and rely on the challenge. Any other
   value is a decision to decline everyone.
3. **Add a discrimination test**, not a range test: a live-face fixture must outscore a spoof
   fixture. Until that test exists, the model is a hypothesis.
4. When §3.2 is settled, the corresponding threshold is **70** (FNMR 5.3% on n = 608) — but the
   20.1% EER against the print control says the model is weak even when wired correctly, and
   the control itself (a small card portrait, not a re-photographed print) overstates its
   difficulty.

---

## 4. Duplicate people — 1:N over the imported templates

1:N run over all **539** paired templates (the `engine_crop` track). Comparisons: 144,991
selfie-vs-selfie (upper triangle) and 289,982 selfie-vs-portrait.

Identity is judged by the salted digest of surname + first initial + DOB. `vendor_data` is
**null on every imported session** (0 of 1,020), so the "different vendor_data" criterion in
the task cannot be evaluated — names/DOB are the only key available, and they come from
Didit's own OCR, so a "different identity" verdict can itself be an OCR artefact.

### 4.1 At the shipped `face_match_min = 75`

| | selfie vs selfie | selfie vs portrait |
|---|---|---|
| comparisons | 144,991 | 289,982 |
| hits ≥ 75 | 201 | 46 |
| same identity | 124 | 33 |
| different identity | 69 | 3 |
| identity unknown | 8 | 10 |
| **different-identity hits ≥6 sessions apart** | **30** | **0** |
| hits within 5 session numbers | 135 | 22 |

Most hits are adjacent session numbers — the same guest retrying minutes later, which is
correct behaviour, not a duplicate.

Anonymised examples of the genuinely interesting ones (session numbers only):

| a | b | score | session gap | shared DOB | shared surname |
|---|---|---|---|---|---|
| 682 | 689 | 90.45 | 7 | yes | no |
| 683 | 689 | 89.32 | 6 | no | no |
| 1056 | 1259 | 83.71 | 203 | yes | no |
| 720 | 915 | 83.52 | 195 | no | no |
| 1055 | 1259 | 80.89 | 204 | yes | no |
| 664 | 1224 | 78.71 | 560 | no | no |
| 455 | 1532 | 78.00 | 1077 | no | no |
| 566 | 1603 | 77.87 | 1037 | no | no |

The 682/683/689 cluster shares a DOB with differing surnames — most likely one guest whose name
OCR'd differently across attempts. Sessions 1055/1056 vs 1259 (200 sessions apart, shared DOB,
different surname) is the shape of a real duplicate-person case and is worth a manual look.
Session **915** appears in seven separate selfie-vs-portrait hits — a hub like that is usually a
low-quality template that matches everything, and is the classic 1:N failure mode.

### 4.2 🔴 The 1:1 threshold cannot be reused for 1:N

Re-running at the §1.9 auto-clear threshold of 67.5:

| | selfie vs selfie | selfie vs portrait |
|---|---|---|
| hits ≥ 67.5 | 2,142 | 393 |
| different-identity, >5 sessions apart | **1,881** | 235 |

1,881 false duplicate hits from 144,991 comparisons is a 1.3 × 10⁻² rate — **thirteen times**
the 10⁻³ FMR that threshold buys on the 1:1 problem. Two compounding reasons:

1. **FPIR ≈ N × FMR** — exactly what `pipeline/face.py`'s §3e header warns about.
2. **Selfie-vs-selfie is a different comparison.** Measured directly on 143,781 blocked
   imposter pairs (DOB, surname and ±5 session-number neighbours all excluded), the
   selfie-vs-selfie imposter distribution is mean **55.44**, p95 **64.36**, max **89.32** —
   about 3 points hotter than selfie-vs-portrait (mean 52.46, max 81.81), with a much fatter
   tail. Two live phone selfies are easier to confuse with each other than a selfie is with a
   printed card portrait.

Selfie-vs-selfie imposter FMR by threshold (n = 143,781):

| threshold | FMR | expected false hits per 143,781 pairs |
|---|---|---|
| 67.5 | 1.34 × 10⁻² | 1,925 |
| 70.0 | 3.87 × 10⁻³ | 556 |
| 75.0 | 2.09 × 10⁻⁴ | 30 |
| **80.0** | **2.09 × 10⁻⁵** | **3** |
| 85.0 | 6.96 × 10⁻⁶ | 1 |

**Recommendation.** Set the duplicate-person threshold to **80** on selfie-vs-selfie, keep the
outcome as `review` (which is what the v3 workflow already does — `duplicate_person: "review"`),
and block the search on a non-biometric key first, exactly as `face_mod.search`'s docstring
requires. Do not derive it from `face_match_min`. Re-derive it once real capture-path selfies
exist, on a gallery of realistic size — 539 templates is not 113,000.

---

## 5. Latency on real images

Single process, OpenCV unpinned, models warm, 40 real sessions. This is what one request
experiences; it is not the throughput figure.

| stage | n | median | p95 | max |
|---|---|---|---|---|
| imread front | 40 | 3.5 ms | 4.2 ms | 4.5 ms |
| imread back | 40 | 2.9 ms | 3.8 ms | 8.4 ms |
| `detect_card_quad` | 40 | 18.5 ms | 19.5 ms | 20.7 ms |
| `rectify` + `deskew` | 40 | 29.8 ms | 59.3 ms | 63.0 ms |
| `quality.score_image` (document) | 40 | 25.6 ms | 28.3 ms | 29.0 ms |
| **`decode_pdf417`** | 40 | **571.8 ms** | 1,118 ms | 1,709 ms |
| **`ocr_front`** | 40 | **551.0 ms** | 732.6 ms | 839.7 ms |
| `crop_portraits` | 40 | 12.2 ms | 17.3 ms | 24.2 ms |
| YuNet detect (selfie) | 40 | 29.4 ms | 34.9 ms | 42.2 ms |
| SFace embed | 24 | 19.7 ms | 25.2 ms | 77.4 ms |
| `passive_pad` | 24 | 10.2 ms | 16.3 ms | 25.3 ms |
| **`face.match` 1:1 end-to-end** | 24 | **83.6 ms** | 89.3 ms | 90.0 ms |
| `face.search` 1:N over 539 templates | 24 | 2.5 ms | 2.6 ms | 3.9 ms |

A full document + face pass is roughly **1.3 s** of compute, ~85% of it in PDF417 decoding and
OCR. `face.search` at 2.5 ms for 539 templates extrapolates to ~0.5 s at 113k — consistent with
`face.py`'s §3e estimate, and the reason a mem-mapped `.npy` matters later, not now.

For contrast, the batch figures from the 1,020-session run at 10 worker processes with
`cv2.setNumThreads(1)`: `document.analyze` median **7.9 s** (OCR 5.2 s, barcode 0.4 s median /
5.5 s p95). That 6× gap is contention, not the pipeline — worth knowing before anyone sizes a
container from the batch number.

---

## 6. The tool

`/Users/jt/wm-demo/idv-engine/tools/calibrate.py` — new, the only file added. Nothing outside
`tools/` was modified.

```
/Users/jt/wm-demo/idv-engine/.venv/bin/python tools/calibrate.py \
    --db    /Users/jt/wm-demo/scratch/idv-dev/wmdemo-idv-dev.sqlite3 \
    --media /Users/jt/wm-demo/scratch/idv-dev/media \
    --out   /path/to/calib \
    --stages all --workers 10
```

Stages are independently re-runnable and each caches to `--out`:
`embed`, `roc`, `doc`, `liveness`, `dup`, `timing`, `report`.
Useful flags: `--limit N` (cap sessions per stage), `--imposters N`, `--dup-threshold`,
`--timing-n`, `--seed`, `--reuse-snapshot`.

Properties worth knowing:

- **The DB is snapshotted** with the SQLite online-backup API before any query. The import
  writes continuously; a half-written row read mid-import is a silent wrong number, not a crash.
- **Names, DOBs and document numbers are never written out.** They exist only as salted
  comparison hashes inside the process; output files carry session numbers and digests. To be
  precise about what the stage caches *do* retain: `doc.json` keeps the extracted
  **expiration date** and **issuing state** in the clear, because the exact-match comparison
  for those two fields is done on the values rather than on hashes. Nothing in this report
  contains either. If the caches are ever moved out of a scratch directory, hash those two the
  same way.
- Imposter pairs are blocked on DOB and surname+initial; all confidence intervals are
  subject-level bootstraps.
- `SELFIE_KINDS` already prefers a real `selfie` over the front-camera frame, so §1.1's
  re-derivation is a re-run with no code change.
- Run artefacts for this report:
  `/private/tmp/claude-501/.../scratchpad/calfull/` — `summary.json` (146 KB) plus per-stage
  caches, `templates.npz`, `dup_t75.json`, `dup_t67.5.json`, and the run logs.

---

## 7. What to do, in order

| # | Action | Why | Owner call |
|---|---|---|---|
| 1 | Stop treating `liveness_min` as a live gate; make the passive score warning-only, or set it to 0 | As wired it declines 100% of real guests (§3.1) | mechanic — safe to do now |
| 2 | Add a PAD **discrimination** test (live fixture must outscore a spoof fixture) | The existing test passes on a constant (§3.3) | mechanic |
| 3 | Investigate the MiniFASNet preprocessing/label question against the reference implementation | §3.2 — do **not** change it on this evidence alone | needs a decision |
| 4 | Split `face_match_min` into a decline floor (55.0) and an auto-clear bar (67.5) | 75 as a single gate implies an 86.9% false-decline rate (§1.9) | needs a decision — touches live workflow config |
| 5 | Re-derive §1 on ≥300 real capture-path selfies before locking any threshold | The imported corpus has no real selfie (§1.1) | blocked on capture traffic |
| 6 | Set the duplicate-person threshold to 80 on selfie-vs-selfie, independently of `face_match_min` | 1:N at the 1:1 threshold gives 1,881 false hits (§4.2) | needs a decision |
| 7 | Stop using OCR-only output as a data source; keep it as a cross-check | 3–6% field agreement when the barcode fails (§2.3) | needs a decision |
| 8 | Document `first_name` as "given names", or split it | 10.2% → 95.9% agreement once compared like-for-like (§2.2) | mechanic |
| 9 | Decide `doc_quality_min` from our own distribution (~80 for a 5% reject rate) | 60 rejects 0.39% of our scores — effectively inert (§2.4) | needs a decision |
| 10 | Add mirror-augmented templates to `face_mod.embed` | ~1 pp EER, ~3 pp FNMR@10⁻³, for ~20 ms (§1.6) | mechanic |
| 11 | Handle Didit's `region` / prose `document_type` / dict-shaped quality score in any importer or console code that reads these nodes | §2.5 — the dict shape will throw on 718 of 928 rows | mechanic |
| 12 | Look at sessions 1055/1056 vs 1259, and at session 915 | Plausible real duplicate; probable hub template (§4.1) | needs a person |

---

## 8. Caveats, stated plainly

- **No real selfie exists in this corpus.** Every face number rests on the front-camera frame
  captured during document capture. FNMR is pessimistic; FMR is not affected. §1.1.
- **The "genuine" label is an inference**, not ground truth: same Didit session ⇒ same person.
  It holds unless a guest handed the phone to someone else mid-session. 163 of the 582 genuine
  pairs come from sessions Didit **declined**, and their scores are visibly lower (§1.3) —
  some of those declines may be genuine impostor attempts mislabelled here as genuine, which
  would make the real FNMR slightly better than reported.
- **The "imposter" label is an inference too**, blocked only on DOB and surname+initial. An
  undetected returning guest under a different-looking name inflates the imposter tail.
- **337,730 imposter pairs are not independent.** All CIs are subject-level bootstraps; treat
  any FMR below 10⁻⁴ as indicative only (≈3 supporting pairs at 10⁻⁵).
- **The import was still running.** Corpus counts differ by stage in the raw caches; the
  numbers here are all from the single 1,020-session snapshot.
- **The document reference is Didit's extraction, not truth.** Where we disagree, one of us is
  wrong and this corpus cannot say which. The barcode-decoded agreement rates (96–98%) are
  strong evidence that both are right there; the OCR-only rates (3–6%) are evidence that at
  least one of us is badly wrong, and the AAMVA-vs-OCR asymmetry says it is us.
- **The PAD "spoof" control is a printed card portrait**, not a re-photographed print or a
  screen replay. It is the only spoof-shaped label available and it is an easy one; the 20.1%
  EER in §3.2 is an optimistic bound, not a benchmark.
- **`vendor_data` is null on all 1,020 imported sessions**, so §4's duplicate test falls back
  to vendor-OCR'd names and DOBs and cannot distinguish a true duplicate person from an OCR
  variant with certainty.
- **`dlib` was not run** — not installed, no wheel, no compiler, and its model would need an
  external download into a shared venv. §1.8.
