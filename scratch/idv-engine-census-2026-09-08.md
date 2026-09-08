# Self-built IDV engine — open-weight component census
**Date:** 2026-09-08 · **Target:** replace Didit (docs.didit.me) with an in-house Python service
**Constraints:** open weights only · **no training** · no third-party verification vendors · no vendor data feeds
**Scale:** ~310 sessions/day · CPU inference acceptable · Docker (demo on Render x86_64, later AWS incl. possible Graviton)

---

## 0. How to read this

The owner asked for "honest zero over fabricated number." That rule is enforced throughout:

- Every number carries a source URL, or the cell says **not published**.
- Anything derived rather than sourced is labelled **[ESTIMATE]** with the reasoning shown so it can be attacked.
- Where two sources conflict, both are shown rather than one silently picked.
- Where a licence is absent (not merely unfound), that is stated — absence of a licence is **all rights reserved**, which is legally worse than a restrictive licence.

**Five findings that change the architecture before you write any code:**

1. 🔴 **InsightFace `buffalo_l` — the default face stack in every tutorial — is non-commercial.** Verbatim from the repo: *"The training data containing the annotation (and the models trained with these data) are available for non-commercial research purposes only."* A 2025-11-24 update names `buffalo_l` explicitly and gives a licensing contact. This removes the highest-accuracy open face recogniser, the age model, and the SCRFD detector in one line. ([README](https://github.com/deepinsight/insightface/blob/master/README.md))
2. 🔴 **The barcode↔OCR cross-check is your strongest tamper signal, and OCR is the bottleneck.** MIDV-2019 measures Tesseract at **47–56% exact field match in ideal conditions and 6–13% in low light** on identity documents ([arXiv 1910.04009](https://arxiv.org/pdf/1910.04009), Table 3). Naive exact-match cross-checking would flag most genuine IDs.
3. 🔴 **Screen-flash liveness — Didit's `FLASHING` method — is covered by an active US patent.** iProov [US 9,075,975](https://patents.google.com/patent/US9075975B2/en), claim 1, anticipated expiry **2033-02-17**, is the design. FaceTec is currently litigating adjacent liveness patents against both Jumio and iProov.
4. 🔴 **Residential-proxy detection cannot be built from open data at any effort level.** Every open technique keys on infrastructure registration; a residential proxy exit *is* a real consumer line on a real ISP ASN. This is the largest single gap versus Didit's IP analysis.
5. 🟢 **The strongest controls you can build are the ones that need no external data at all** — 1:N face dedupe, ID-number reuse, retry-after-failure, capture-attempt counts. These are immune to the countermeasures that defeat everything else, and here you are genuinely *better* than a vendor because it is your data.

**Didit baseline used for the gap table** comes from Hyperwolf's live console digest at `POS-Admin/scratch/didit-reference-digest-2026-09-08.md` plus the docs pages cited inline. Current spend: **$2,657.89/cycle** across ~9,400 verifications.

---

## 1. Capability 1 — US DL/ID field extraction

### 1a. PDF417 barcode decoding

| Library | PyPI | Licence | Commercial | **PDF417?** | Raw bytes | Wheels x86_64 / aarch64 | Py floor | Deps |
|---|---|---|---|---|---|---|---|---|
| **zxing-cpp** ⭐ | `zxing-cpp` 3.1.1 | **Apache-2.0** | ✅ | ✅ | ✅ `.bytes` | ✅ 1.1 MB / ✅ 1.0 MB | **≥3.9** | **none** |
| rxing | `rxing` 0.1.0 | Apache-2.0 | ✅ | ✅ | ✅ `raw_bytes` | ✅ manylinux2014 both | ≥3.8 | Pillow, numpy |
| pdf417decoder | 1.0.8 (2021) | ⚠️ **CPOL-1.02** | ⚠️ legal review | ✅ | ❌ str only | pure-python | ≥3.7 | Pillow, numpy |
| pyzbar / zbar | 0.1.9 | MIT / LGPL-2.1 | ✅ | 🔴 **NO** | — | — | — | libzbar0 |
| `cv2.barcode` | (opencv) | Apache-2.0 | ✅ | 🔴 **NO** — EAN/UPC only | — | — | — | — |
| zxing (Java) | archived 2026-04-12 | LGPLv3+ | ⚠️ | ✅ | — | needs JRE | — | JVM |

Wheel sizes measured from the [PyPI JSON API](https://pypi.org/pypi/zxing-cpp/json) on 2026-09-08.

**zbar does not decode PDF417 — verified three ways.** (1) zbar's [README](https://raw.githubusercontent.com/mchehab/zbar/master/README.md) symbology list omits it. (2) pyzbar's [PyPI page](https://pypi.org/project/pyzbar/) says "one-dimensional barcodes and QR codes." (3) 🔴 **The trap:** pyzbar's `ZBarSymbol` enum *does* define `PDF417 = 57` ([wrapper.py](https://raw.githubusercontent.com/NaturalHistoryMuseum/pyzbar/master/pyzbar/wrapper.py)) — grepping the enum gives a false positive. Upstream [issue #3](https://github.com/mchehab/zbar/issues/3), open since 2019, titled "PDF417 decoding is incomplete": zbar detects, then aborts on an assertion. **Detection-without-decoding is worse than nothing.**

🔴 **The zxing-cpp weakness is rotation, not damage — and it is the opposite of the intuitive assumption.** From maintainer @axxel in [issue #145](https://github.com/zxing-cpp/zxing-cpp/issues/145) (open since 2020-07-16): the decoder "performs individual horizontal line-scanning operations… can generally only work as long as the rotation of the symbol is so small that at least one complete codeword is visible when scanning a horizontal line," and on a perfect 2×-upscaled symbol **"even just 3° rotation are already too much."** Conversely it "deals happily with corrupt samples." He adds: *"I doubt I have the time to re-implement the PDF417 decoder"* — no upstream fix is coming.

**Consequence: deskew-before-decode is the highest-leverage engineering in this whole capability.** Handheld phone photos routinely exceed 3°. Localise the symbol, rectify to near-zero skew, upscale, sharpen, then decode.

**Always read `.bytes`, never `.text`.** Verified in the [binding source](https://github.com/zxing-cpp/zxing-cpp/blob/master/wrappers/python/zxing.cpp): `.text` transcodes via `text_mode` (default `TextMode.HRI`) and will corrupt byte-oriented AAMVA payloads; `.bytes` returns "uninterpreted bytes of the decoded symbol." No decode-confidence score is exposed — `.ec_level` reports the symbol's EC level, not how much error correction was consumed.

**Latency: not published by any of these projects.** The only published head-to-head is [Dynamsoft's own benchmark](https://www.dynamsoft.com/codepool/pdf417-reading-benchmark-and-comparison.html) (updated 2026-07-14, 78 images, Intel i5-10400): Dynamsoft 95.45% / 586.64 ms, Google ML Kit 61.36% / 304.22 ms, **ZXingCPP 52.27% / 127.56 ms**, Apple Vision 30.68% / 693.96 ms. **Four caveats, all load-bearing:** published by the winner; the dataset is bottles and boarding passes, **not driver's licences** (DL barcodes are denser); speed was measured including failures, so a decoder that gives up fast looks fast; and it is nonetheless the only public head-to-head that exists. Do not transfer 52.27% in either direction.

⚠️ **CPOL-1.02** (pdf417decoder) is [not OSI-approved and not FSF-free](https://spdx.org/licenses/CPOL-1.02.html); Google's third-party licence policy treats it as restricted. PyPI classifies the package `License :: Other/Proprietary License`. Probably fine for an internal service; needs a legal read, and it returns `str` not `bytes`, which is a real corruption risk.

**Recommendation:** `zxing-cpp` — Apache-2.0, **zero runtime dependencies**, 1.1 MB wheel, x86_64 + aarch64 + macOS arm64, pushed within the week. Note `manylinux_2_28` means glibc ≥2.28 → **Debian slim, not Alpine.** Keep `rxing` as an A/B hedge (same algorithm lineage, so a licence/packaging hedge, not an accuracy one).

### 1b. AAMVA DL/ID Card Design Standard

Extracted directly from the official PDFs: [2020 standard](https://www.aamva.org/getmedia/99ac7057-0f4d-4461-b0a2-3a5532e1b35c/AAMVA-2020-DLID-Card-Design-Standard.pdf) (125 pp) and [2025 standard](https://www.aamva.org/getmedia/81af105d-8b1b-45e1-aa46-f1800a259ed1/AAMVADLIDCardDesignStandard2025.pdf) (128 pp, June 2025).

🔴 **There is a 2025 standard and it is version `11`, not 12.** Table D.1 field 7, verbatim: *"All bar codes compliant with AAMVA Card Design Standard version 1.0, dated 10-2020 shall be designated Version '10'. All bar codes compliant with this current AAMVA standard shall be designated '11'."*

**Version byte → standard year (complete, from Table D.1 field 7):**

| Byte | Standard | Byte | Standard |
|---|---|---|---|
| `00`/`0` | pre-AAMVA-2000 (reserved) | `06` | CDS v1.0, 07-2011 |
| `01` | AAMVA DL/ID-2000 | `07` | CDS v1.0, 06-2012 |
| `02` | CDSpec v1.0, 09-2003 | `08` | CDS v1.0, 08-2013 |
| `03` | CDSpec v2.0, 03-2005 | `09` | CDS v1.0, 09-2016 |
| `04` | CDS v1.0, 07-2009 | `10` | CDS v1.0, 10-2020 |
| `05` | CDS v1.0, 07-2010 | **`11`** | **CDS 2025** |

Any version from `01` up is still in circulation — the barcode reflects the standard at *issue* time, so your practical floor is set by your oldest-acceptable expiry date.

**Header — fixed 21 bytes (Table D.1):**

| # | Bytes | Field | Value |
|---|---|---|---|
| 1 | 1 | Compliance Indicator | `@` = 0x40 |
| 2 | 1 | Data Element Separator | **LF = 0x0A** |
| 3 | 1 | Record Separator | **RS = 0x1E** — "shall always be present" |
| 4 | 1 | Segment Terminator | **CR = 0x0D** |
| 5 | 5 | File Type | `"ANSI "` — **trailing SPACE** |
| 6 | 6 | IIN | 6-digit Issuer Identification Number |
| 7 | 2 | AAMVA Version | per table above |
| 8 | 2 | Jurisdiction Version | `00`–`99` |
| 9 | 2 | Number of Entries | `01`–`99` |

Canonical prefix: `@ \n \x1E \r A N S I ␠ I I I I I I V V J J N N`. 🔴 **The `0x1E` between LF and CR is the byte naive parsers drop** — a regex on `\n` alone appears to work, then breaks on the header.

**Subfile designator — 10 bytes each (Table D.2):** 2-byte subfile type (`DL`, `EN`, `ID`, or `Z`+jurisdiction letter), 4-digit offset from byte 0, 4-digit length **including** the segment terminator and the 2-char type. Note `DL` appears twice — once in the designator, once as the first two bytes of the subfile data; parsers that search for the first `"DL"` land in the designator.

**Mandatory data elements — Table D.3, identical membership in 2020 and 2025 (22 elements):**

| ID | Element | Type/Len | ID | Element | Type/Len |
|---|---|---|---|---|---|
| `DAQ` | **Customer ID Number** (licence no.) | V25ANS | `DAG` | Address – Street 1 | V35ANS |
| `DCS` | **Customer Family Name** | V40ANS | `DAI` | Address – City | V20ANS |
| `DAC` | **Customer First Name** | V40ANS | `DAJ` | Address – Jurisdiction Code | F2A |
| `DAD` | Middle Name(s), `,`-separated | V40ANS | `DAK` | Address – Postal Code | F11ANS→V9ANS |
| `DBB` | **Date of Birth** | F8N | `DCA` | Jurisdiction vehicle class | V6ANS |
| `DBA` | **Document Expiration Date** | F8N | `DCB` | Jurisdiction restriction codes | V12ANS |
| `DBD` | Document Issue Date | F8N | `DCD` | Jurisdiction endorsement codes | V5ANS |
| `DBC` | Sex — **`1`=M, `2`=F, `9`=unspecified** | F1N | `DCF` | **Document Discriminator** | V25ANS |
| `DAY` | Eye Colour (D-20 3-letter) | F3A | `DCG` | **Country — `USA` or `CAN`** | F3A |
| `DAU` | Height — `"073 in"` / `"181 cm"` | F6ANS | `DDE`/`DDF`/`DDG` | Family/First/Middle **truncation** `T`/`N`/`U` | F1A each |

🔴 **Two sentinel rules that break parsers**, quoted from D.12.5: *"Mandatory data elements for which no data exists for a given cardholder are to be encoded with the word `NONE`. In the event data is not available for a mandatory data element, `unavl` is to be encoded."* So `DCB=NONE` is normal, and lowercase `unavl` can legally appear in **any** mandatory field including a name. Never compare a sentinel — exclude the field and lower the confidence denominator.

**Important optional elements (Table D.4):** `DAH` street 2 · `DAZ` hair · `DCK` **inventory control number** (DHS-recommended) · `DCU` name suffix (`JR`…`9TH/IX`) · `DDA` **compliance type `F`=REAL-ID / `N`=not** (DHS-required) · `DDB` card revision date · `DDD` limited-duration indicator · `DAW`/`DAX` weight lb/kg · `DDH`/`DDI`/`DDJ` under-18/19/**21-until** dates · `DDK` organ donor · `DDL` veteran · `DCJ` audit information.

**2025 additions** (all F1N, value `1`): `DDM` **CDL indicator** (FMCSA) · `DDN` non-domiciled (**only valid with `DDM`**) · `DDO` enhanced credential · `DDP` permit.

**2025 deprecations:** `DBN`/`DBG`/`DBS` (AKA family/given/suffix), `DCL` (race/ethnicity), `DDC` (hazmat expiry) were converted to *"Placeholder for future data element"* — **deprecated, not removed from the code space.** Keep reading them; they appear on every card issued under `01`–`10`. This follows the new 2025 §D.12.5.3 principle: *"A jurisdiction should not encode data elements in the barcode that are not in human-readable form."* Also re-worded in 2025: `DDK`/`DDL` now mean "marked as such in the Issuing Authority's system of record," with explicit footnotes that **absence does not imply the negative.**

🔴 **Dates: branch on `DCG`, never on heuristics.** Every date element is defined *"(MMDDCCYY for U.S., CCYYMMDD for Canada)"*. `06062019` parses under either convention and is wrong half the time you guess; a DOB read a month off is a silent age-verification failure.

**Postal code changed in 2025.** 2020: `DAK` is F11ANS, US zero-filled to 9 digits then space-padded to 11 (the spec example is `DAK232690000␠␠`). 2025: V9ANS, zero-fill to 9, Canadian formatted `"A1A 1A1"`. Normalisation must handle all four shapes.

**IINs** are published by AAMVA as [an HTML table](https://www.aamva.org/identity/issuer-identification-numbers-(iin)) — no machine-readable form advertised; scrape once and vendor it. Examples: VA `636000`, ON `636012`, CA `636014`, TX `636015`. `IIN ↔ DAJ` agreement is a cheap consistency signal, though weak — people move.

**Annex I "Optional Compact Encoding" exists and is structurally different** — ISO/IEC 18013-2-based, AID prefix `A0 00 00 02 48 01 00`, data groups delimited by `×`/`÷`/`¶`, BCD numerics. A parser assuming `@` at byte 0 **fails cleanly** rather than mis-parsing, which is the safe outcome — detect by AID and reject explicitly. ⚠️ No evidence any US jurisdiction uses it.

✅ **There is no photo in a standard US DL PDF417.** Every element ID in the 2020 and 2025 mandatory and optional tables was enumerated: no image, portrait, or biometric element exists in the Annex D structure. Annex I defines optional `DG4` portrait / `DG7` biometric, but it is *informative*, optional, and constrained by a symbol capped at 75.6 × 38.1 mm. ⚠️ No primary evidence any US jurisdiction ships one. **Do not build a face-match path that depends on a barcode photo.**

**Encryption:** the standard states *"All mandatory and optional data must be unencrypted. Issuing jurisdictions may encrypt jurisdiction-specific data in a separate subfile."* So an unparseable `Z*` subfile is **normal, not tamper.**

### 1b-2. 🔴 Open AAMVA parsers — the only one on PyPI has a verified version bug

| Project | Lang | Licence | Verdict |
|---|---|---|---|
| [rechner/py-aamva](https://github.com/rechner/py-aamva) | Python | 🚩 **GPL-2.0-or-later** | Copyleft — blocker for proprietary use |
| [benhovinga/aamva_barcode_library](https://github.com/benhovinga/aamva_barcode_library) | Python | ✅ MIT | Parse-only, references **2020**, Annex I not implemented, **not on PyPI** |
| [`aamva-parser` 0.1.2](https://pypi.org/project/aamva-parser/) → [btmash](https://github.com/btmash/py-aamva-parser) | Python | ISC | **The only AAMVA parser on PyPI.** Released 2026-04-23. Self-declared *"produced with AI assistance."* 🔴 **Has the bug below** |
| [joptimus/aamva-parser](https://github.com/joptimus/aamva-parser) | TS | — | Upstream. **Same bug** |
| [c0shea/IdParser](https://github.com/c0shea/IdParser) | C# | (LICENSE.md present) | Most mature reference implementation |

🔴 **Both the PyPI package and its TypeScript upstream advertise "AAMVA barcode versions 01–12 (CDS 2000–2025)" and map CDS 2025 → version `12`. There is no version 12.** The 2025 standard designates itself `11`. Impact: a real 2025-standard card presents `11`, gets mapped to the CDS-2020 field set, and `DDM`/`DDN`/`DDO`/`DDP` are silently missed; `isCDL()` never fires. **Do not adopt either without patching the version table.**

**Recommendation: write the parser yourself.** The complete spec is reproduced above; it is a few hundred dependency-free lines. It must: validate all 21 header bytes exactly; read subfiles by *declared* offset/length and **log** when they disagree with reality; branch dates on `DCG`; honour `DDE`/`DDF`/`DDG` downstream; treat `NONE`/`unavl` as absence; preserve unknown and `Z*` elements verbatim; map `11` → 2025; and **accept `bytes`, never a pre-decoded `str`.**

**Real-world breakages — substantiated vs folklore.** Substantiated: older versions with smaller mandatory sets; truncation flags causing false mismatches ([ID Analyzer](https://www.idanalyzer.com/en/blog/reading-pdf417-barcodes-on-north-american-driver-licenses-2026-06-22) warns explicitly); structural drift between versions ([barkoder](https://barkoder.com/blog/aamva-pdf417-barcode-format-fields-examples-and-parsing-guide)); height precision loss (c0shea documents the inch/cm rounding); `Z`-prefix ambiguity is *in the standard* (`ZC` = California **or** Colorado **or** Connecticut, resolved via IIN/address). ⚠️ **Not substantiated and not asserted:** which specific US states produce non-conformant barcodes — vendor guides name **none**; the widely-repeated "wrong subfile offset" bug — no primary source names a jurisdiction; any "95%/5%" figure. **Build a conformance harness and let your own corpus answer this in weeks; the internet will not answer it at all.**

⚠️ **Legal note:** py-aamva's README carries an extended warning about **18 U.S.C. ch. 123 §2721 (Driver's Privacy Protection Act)**. Decoding, storing and retaining DL barcode data is regulated, and several states add DL-scanning statutes. Risk-register item, not an engineering one.

**Horizon:** mDL / ISO 18013-5 is a cryptographically signed credential — categorically stronger than anything here, because it is verifiable *against the issuer*. **TSA accepts digital IDs from 26 jurisdictions** ([tsa.gov](https://www.tsa.gov/digital-id/participating-states)). It does not displace PDF417 this decade but it is the eventual answer to every limitation in §1e.

### 1c. Front-side OCR

| Engine | Licence | Commercial | Det+Rec on disk | Runtime stack | Py floor | **aarch64** |
|---|---|---|---|---|---|---|
| **RapidOCR** ⭐ | Apache-2.0 | ✅ | **9.93 + 21.23 MB bundled in wheel** | onnxruntime | ≥3.8 | ✅ |
| PaddleOCR | Apache-2.0 | ✅ | 4.7 + 16 MB (v5 mobile) | **paddlepaddle 185.8 MB** | ≥3.8 | 🔴 **NO WHEEL** |
| Tesseract | Apache-2.0 | ✅ | 3.92 MB fast / 14.7 MB best | system binary | ≥3.8 | ✅ |
| docTR | Apache-2.0 | ✅ | **not published** | torch | **≥3.11** | ✅ |
| EasyOCR | Apache-2.0 | ✅ | 83.2 + 15.1 MB | torch | unpinned | ✅ |
| surya | ⚠️ code Apache-2.0 / **weights modified OpenRAIL-M** | ⚠️ **$5M cap** | 650M params | torch | ≥3.10 | ✅ but 9.3 s/page |

🔴 **PaddlePaddle has no Linux aarch64 wheel — confirmed at v3.3.1 from the [PyPI JSON API](https://pypi.org/pypi/paddlepaddle/json).** Files present: `manylinux1_x86_64` (185.8 MB), `macosx_11_0_arm64` (99.7 MB), `win_amd64`. **No Linux ARM64 wheel exists.** If Graviton is on the roadmap, PaddleOCR is out on packaging, not quality.

🟢 **RapidOCR is the way to get PaddleOCR's models without PaddlePaddle.** [`rapidocr` 3.9.2](https://pypi.org/project/rapidocr/) (2026-07-21, Apache-2.0, `>=3.8,<4`) ships **PP-OCRv6 models inside the wheel** — no runtime download, no first-request stall, reproducible builds. Measured from the wheel: `PP-OCRv6_det_small.onnx` 9,929,594 B, `PP-OCRv6_rec_small.onnx` 21,234,383 B, cls 585,532 B. ⚠️ `rapidocr-onnxruntime` is the **legacy** package (last release 1.4.4, 2025-01-17, pinned `<3.13`) — use `rapidocr`. ⚠️ It does **not** declare `onnxruntime` as a dependency; install it yourself. Its declared deps pull `opencv-python` (not headless), Shapely and pyclipper.

**PaddleOCR published CPU latency** ([PP-OCRv5 docs](http://www.paddleocr.ai/main/en/version3.x/algorithm/PP-OCRv5/PP-OCRv5.html)): **mobile 1.75 s/image, server 4.34 s/image**, Xeon Gold 6271C @2.60 GHz, FP32, 8 threads. Per-module v5_mobile det 57.77 ms, rec 21.20 ms. Recognition accuracy: v5_mobile 81.29%, v5_server 86.38%, v4_mobile 78.74% ([PaddleX docs](https://paddlepaddle.github.io/PaddleX/3.1/en/module_usage/tutorials/ocr_modules/text_recognition.html)). PP-OCRv6 tiny is claimed **3.9× faster than v5_mobile** ([arXiv 2606.13108](https://arxiv.org/abs/2606.13108)).

**Tesseract published CPU latency: 453 ms/image** ([arXiv 2603.17357](https://arxiv.org/pdf/2603.17357), Table 9) — **on web-page screenshots, not ID cards.** ⚠️ **That paper's three-engine table is being widely misquoted as a CPU comparison. It is not.** The paper's own text: *"Tesseract completes in 453ms on CPU, while GPU-accelerated engines (EasyOCR, PaddleOCR) are 1.6–4.7× slower despite hardware acceleration."* Every blog citing Tesseract 453 / EasyOCR 715 / PaddleOCR 2143 as a CPU benchmark is wrong.

**The one genuine CPU-only cross-runtime benchmark** ([Sekinal/ppocrv6-fast-cpu](https://github.com/Sekinal/ppocrv6-fast-cpu), 143 documents, AMD Ryzen 7 8845HS, 8 threads, median): PP-OCRv6 small — PyTorch 2038 ms, ONNX Runtime 1965 ms, OpenVINO fp32 1458 ms, **OpenVINO bf16 1026 ms**. Caveat: dense arXiv pages, hundreds of lines. **[ESTIMATE]** an ID crop is much faster since recognition scales with line count, but **detection cost is roughly fixed per image — do not expect a 10× win.**

⚠️ **surya's licence trap, confirmed.** The repo `LICENSE` is plain Apache-2.0 with no thresholds — **and it covers code only.** The [README](https://github.com/VikParuchuri/surya) states: *"The model weights use a modified AI Pubs Open Rail-M license (free for research, personal use, and startups under $5M funding/revenue)."* Anyone reading only `LICENSE` concludes the opposite of the truth. It is also CPU-nonviable: the README's own figure is ~0.108 pages/s = **~9.3 s/page**. Ruled out twice.

**The VLM class is not CPU-viable** — dots.ocr (~3B), olmOCR (Qwen2-VL 7B), GOT-OCR2.0 (580M), MinerU (⚠️ Apache-2.0 **plus a commercial rider** above 100M MAU / $20M-month, [LICENSE.md](https://github.com/opendatalab/MinerU/blob/master/LICENSE.md)). Surya's 9.3 s/page for a *650M* model is the empirical anchor. A licence has ~15 short fields; using a 3B VLM on CPU is off by two orders of magnitude.

🔴 **The honest accuracy baseline for ID-card OCR is ~50%, not ~90%.** [MIDV-2019](https://arxiv.org/pdf/1910.04009) Table 3, Tesseract 4.1.0, % of fields recognised **exactly**:

| Field group | Ideal | Distorted | **Low light** |
|---|---|---|---|
| Latin names | 55.6% | 54.8% | **13.0%** |
| Numeric dates | 47.4% | 42.0% | **6.1%** |
| Document numbers | 46.5% | 36.4% | **6.9%** |
| MRZ lines | 8.9% | 6.6% | **0.3%** |

These are 2019 Tesseract numbers and PP-OCRv6 will do better — **but nobody has published how much better on ID documents.** The gap between "document OCR benchmark" and "ID card in the wild" is exactly this large. **Nobody publishes per-state US DL OCR results.** Treat any per-state expectation as unmeasured.

Practical consequences: ID cards are **short isolated lines**, which favour DBNet-style scattered-text detection over Tesseract's page-layout assumptions; guilloche + holographic overlay + glare is the documented worst case; **preprocessing is not optional** — a peer-reviewed ablation found bilateral filtering gave the smallest average edit distance and Otsu the highest character accuracy for PaddleOCR ([ScienceDirect S1877050925027383](https://www.sciencedirect.com/science/article/pii/S1877050925027383)).

**Recommendation:** `rapidocr` + `onnxruntime`, with **Tesseract as a cheap second opinion** (3.92 MB `tessdata_fast`, apt-installable, no ML framework). Two-engine consensus is a useful confidence signal on a document where a wrong DOB is expensive, and it feeds the §1e scoring directly.

### 1d. MRZ parsing (passports)

| Package | Licence | Commercial | Detect? | Needs Tesseract? | Maintained | Accuracy |
|---|---|---|---|---|---|---|
| **mrzscanner-docsaid** ⭐ | **Apache-2.0** | ✅ | ✅ +polygon | **No** (onnxruntime) | 2026-01-13 | **not published** |
| PassportEye | **MIT** | ✅ | ✅ classical | Yes (+legacy engine) | rel. 2025-03, commits 2026-07 | **~80%** self-reported |
| `mrz` | 🚩 **GPL-3.0** | ⚠️ | ❌ parse only | No | **dead 2021** | n/a |
| fastmrz | 🚩 **AGPL-3.0** | 🔴 **blocker** | ✅ ONNX seg | Yes | 2025-11 | not published |
| omnimrz | Apache-2.0 | ✅ | ✅ PaddleOCR | transitively | 2026-02 | not published |
| ultimateMRZ-SDK | 🚩 "non commercial use only" | ❌ | ✅ | — | — | — |
| mrz-scanner-sdk | 🚩 MIT wrapper / **Dynamsoft engine** | ❌ | ✅ | — | — | vendor only |

**PassportEye is not abandoned, but is effectively unreleased-maintained** — PyPI 2.2.2 (2025-03-06), master commits to 2026-07-03. The numpy-2.x break ([#75](https://github.com/konstantint/PassportEye/issues/75)) *is* fixed in the released tag. ⚠️ **But scikit-image is a dated time bomb:** tag 2.2.2 still calls `morphology.square(...)`, deprecated in skimage 0.25 and **scheduled for removal in 0.27**; latest is 0.26.0. **Pin `scikit-image<0.27`.** ⚠️ **Docker gotcha:** its README recommends Tesseract's **legacy engine** (`--oem 0`), and Tesseract 5 distro packages are generally LSTM-only — budget an image-build step to swap `eng.traineddata`. Published accuracy: *"in around 80% of the cases, whenever there is a clearly visible MRZ on a page, the system will recognize it"* and *"around 10 or more seconds for some documents"* — **author's claim on unspecified data, not a benchmark.**

🔴 **AGPL is the sharpest hazard here.** fastmrz is AGPL-3.0 — **serving it over HTTP triggers source disclosure without any distribution.** Also 🚩 **YOLOv8/ultralytics is AGPL-3.0** ([LICENSE](https://raw.githubusercontent.com/ultralytics/ultralytics/main/LICENSE)), and **this taints trained weights** — any YOLOv8-derived MRZ or face detector on Roboflow/HF inherits it. And every OCR-B `traineddata` option has a licence catch: [Shreeshrii/tessdata_ocrb](https://github.com/Shreeshrii/tessdata_ocrb) has **no LICENSE file** (= all rights reserved); DaanVanVugt's is GPL-3.0; fastmrz's is AGPL. **The Tesseract route drags a licence question every time; the ONNX route does not.**

**ICAO 9303 check digits — the algorithm, from [Part 3](https://www.icao.int/sites/default/files/publications/DocSeries/9303_p3_cons_en.pdf) §4.9:** *"modulus 10 with a continuously repetitive weighting of 731 731 …"*; `<` = 0; `A`–`Z` = 10–35.

| Format | Lines × chars | CDs | Positions |
|---|---|---|---|
| **TD1** (ID card, [Part 5](https://www.icao.int/sites/default/files/publications/DocSeries/9303_p5_cons_en.pdf)) | 3 × 30 | **4** | doc-no CD at upper-15; DOB CD mid-7; expiry CD mid-15; composite mid-30 |
| **TD2** ([Part 6](https://www.icao.int/sites/default/files/publications/DocSeries/9303_p6_cons_en.pdf)) | 2 × 36 | **4** | 10, 20, 28, 36 |
| **TD3** (passport, [Part 4](https://www.icao.int/sites/default/files/publications/DocSeries/9303_p4_cons_en.pdf)) | 2 × 44 | **5** | 10, 20, 28, **43 (personal no.)**, 44 |

Two edge cases naive parsers get wrong: **TD3's personal-number CD may legally be `0` *or* `<`** when positions 29–42 are all filler (Part 4 §4.2.4); and TD1 truncates long document numbers with a filler where the CD would be, continuing into optional data. **TD1 has 4 CDs and no personal-number CD — TD3 is the only one with 5.**

**Recommendation:** `mrzscanner-docsaid` (Apache-2.0, detection + recognition, no Tesseract, single dep pulling onnxruntime). If the GPL is unacceptable for `mrz`, **do not link it — reimplement.** The 7-3-1 algorithm is ~15 lines straight out of the spec; it is a specification, not copyrightable expression.

### 1e. Cross-check strategy — barcode vs OCR vs face crop

**Why this is the strongest tamper signal available for US IDs.** The argument is structural, not empirical:

1. **The counterfeit economy optimises the front** — it is what a human looks at. Intellicheck: *"Generative AI tools can now analyze high-resolution scans of authentic state-issued IDs and reproduce their layouts, fonts, holograms, and ultraviolet patterns with alarming accuracy."*
2. **The back requires a separate manufacturing skill** — a correct 21-byte header, a jurisdiction-correct IIN, subfile offsets computed over the actual payload, ~22 mandatory elements in plausible format, printed at 0.0066–0.015 in X-dimension with ECC ≥3. A shop good at one is not automatically good at the other.
3. **Consistency is checkable offline, with no DMV connection.** You cannot ask whether the data is *true*; you can ask whether it is *self-consistent* — and consistency is exactly what a two-surface forgery breaks.
4. **The failure modes are informative, not binary** — "no barcode found", "undecodable", "decodes to garbage", "decodes but disagrees", "decodes and agrees" are five states with five risk profiles.

Directional vendor evidence, honestly framed: the [Greenway Solutions Fraud Red Team test](https://www.biometricupdate.com/202401/intellicheck-aces-independent-fake-id-detection-test) (2024-01-11) procured **20** counterfeit licences; Intellicheck's barcode approach flagged all 20 while a front/back-scan competitor passed one. ⚠️ **n=20, vendor-promoted, sourcing of the fakes undescribed, and the article does not say whether the counterfeits carried matching barcodes. Directionally supportive; not a basis for any number in your system.**

**The four limits, stated bluntly:**

**Limit 1 — "scannable fakes" are a marketed product category.** The standard is public (downloaded in this session) and free AAMVA PDF417 generators are trivially findable. Intellicheck's description is precise: *"fraudsters have used that information to create barcode templates… A counterfeit ID with a properly templated barcode will pass a standard scan every single time."* **Decode success is not evidence of authenticity — only that someone encoded valid AAMVA.** A clean match is the *expected output of a competent forgery.*

**Limit 2 — 🔴 the false-positive direction, which is easy to get backwards.** A **genuine card photoshopped on the front still carries the genuine, untouched barcode.** The cross-check fires — and the barcode data is the *true* data. Conversely a barcode-only forgery on a genuine-looking card inverts this. **The cross-check tells you the two surfaces disagree; it does not tell you which one lied.** Anything reporting "fake ID" from a mismatch alone is over-claiming.

**Limit 3 — the OCR error floor swamps the signal.** §1c: 47–56% exact field match in *ideal* conditions. **Naive exact-match cross-checking will flag nearly every genuine ID.** This single fact dictates the architecture: per-field scoring, error-model-aware fuzzy matching, weighting by OCR reliability, an image-quality gate that **abstains rather than guesses**, and never a single field mismatch as decisive.

**Limit 4 — fewer mandatory fields on older cards.** A version-`02` card gives fewer cross-checkable fields through no fault of the holder. ⚠️ Per-version mandatory sets could not be verified from primary sources (AAMVA publishes only the current standard). **Derive the expected field set from the observed version byte, and lower confidence rather than raise suspicion when the version is old.**

**Field-level matching design** — weight by (tamper informativeness) × (OCR reliability):

| Field | Barcode | Rule | Threshold | Weight |
|---|---|---|---|---|
| **Date of birth** | `DBB` | **EXACT** after `DCG`-branched normalisation | exact | **highest** |
| Expiry | `DBA` | exact; also check vs today | exact | high |
| **Family name** | `DCS` | normalise + fuzzy — ⚠️ **check `DDE` first** | JW ≥ 0.90 **[ESTIMATE]** | high |
| **First name** | `DAC` | normalise + fuzzy + nickname set; check `DDF` | JW ≥ 0.85 **[ESTIMATE]** | medium |
| Middle name | `DAD` | initial-vs-full aware; check `DDG` | lenient | **low** |
| Licence number | `DAQ` | strip spaces/hyphens | exact or ≤1 edit | **high** |
| Sex | `DBC` | map `1/2/9` → `M/F/X` | exact | low |
| Address | `DAG`/`DAI`/`DAJ`/`DAK` | USPS-normalised + fuzzy | JW ≥ 0.85 | **low** — legitimately stale |
| Height / eyes | `DAU`/`DAY` | parse `"068 in"`; D20 codes | exact | low |

**Normalisation rules that matter:** NFKD → strip diacritics → uppercase → collapse whitespace; **extract suffixes before comparing** (`"SMITH JR"` vs `"SMITH"` must not be a mismatch); compare hyphen/apostrophe variants both ways; 🔴 **truncation flags gate everything** — if `DDE`/`DDF`/`DDG` is `T`, compare by **prefix containment**, not equality (if `U`, use the lenient path); sentinels are absence markers; addresses via [USPS Pub 28 App. C1](https://pe.usps.com/text/pub28/pub28apc_002.htm).

⚠️ **Nicknames — use only to *forgive*, never to *create*, a mismatch.** [carltonnorthern/nicknames](https://github.com/carltonnorthern/nicknames) is Apache-2.0, ~1,100 canonical names, and its README documents the bias plainly: *"Due to the source of the original data, the dataset is heavily biased towards traditionally African American names. Names from other groups may or may not be present."* **A nickname table with demographic coverage gaps produces demographically-skewed false mismatches. Audit outcomes by group.**

⚠️ **On thresholds: the 0.90/0.85 figures are [ESTIMATE]s.** Published record-linkage practice puts Jaro-Winkler name thresholds in the **0.80–0.88** band ([Splink comparison templates](https://moj-analytical-services.github.io/splink3_legacy_docs/topic_guides/comparisons/comparison_templates.html)) — **but that literature links two typed database records, not OCR output against a barcode.** OCR errors are **visual** (0/O, 1/I, 5/S, rn/m), not phonetic or typographic, and Jaro-Winkler does not model them. Calibrate on your own labelled corpus; consider a character-confusion-aware distance alongside JW.

**Emit a per-field agreement vector plus an overall confidence, never a bare boolean.** Distinguish `NO_BARCODE_FOUND` (usually image quality, **not** fraud) · `BARCODE_UNDECODABLE` (damage, glare, skew — see the 3° ceiling) · `HEADER_INVALID` (**strong** signal) · `PARSE_FAILED` (moderate; log version + IIN) · `DECODED_OCR_FAILED` (**use the barcode data; abstain on the cross-check**) · `MISMATCH` (surface which fields) · `MATCH` (necessary, **not sufficient**).

**And put an image-quality gate ahead of all of it.** Given the low-light numbers, **abstaining and asking for a re-capture is almost always better than scoring a bad image.** A system that says "I can't see this clearly, try again" is more useful and more honest than one guessing at 13% accuracy.

**Face crop:** since the barcode carries no photo, the *only* face on the document is the printed front portrait — so **the face crop and the field cross-check are independent signals measuring different attacks** (face-swap vs data-alteration). Combine them; do not let one substitute for the other. This is also exactly why a front-photoshop attack leaves the barcode intact.

🟢 **One extra check worth more than most of §2:** most US licences carry a **ghost portrait** — AAMVA defines it as *"A lighter reproduction of the original image that appears in the same area as the personal data."* An attacker pasting a new face must find and replace the ghost too, consistently. Three comparisons are available: primary↔ghost, primary↔selfie, ghost↔selfie. ⚠️ **The ghost is OPTIONAL** in AAMVA Table B.4 (item 4.13, marked **O**, Level-1) — detect presence per state, never assume it.

**What the cross-check honestly gives you:** a strong, cheap, offline consistency signal that catches the low and mid tiers of the counterfeit market and every case of physical front alteration. **What it does not give you:** authenticity. Only the issuing authority can supply that. **Treat it as a strong risk score, never a verdict, and reserve the word "fake" for cases with more than a field mismatch.**

---

## 2. Capability 2 — document authenticity / tamper

### 2a. What open source can actually do on one RGB phone photo

**Per-state template checks: no public US ID template library exists.** The AAMVA standard constrains *which zone* a field lives in — it does not give you the pixel box, typeface, state seal artwork, or background guilloche. Verbatim: *"In some cases, data elements may appear in a choice of zones or be repeated in another zone."* Existing open "US DL OCR" projects ([siyiding1216/dl-ocr](https://github.com/siyiding1216/dl-ocr)) are template *scaffolding* — you supply the atlases. **You would build this from your own captures. Budget it as a data-collection project, not a software project.**

For contrast, this is the vendors' moat: Regula **16,000 templates / 251 territories / 138 languages** ([announcement](https://regulaforensics.com/news/regulas-id-template-database-hits-16000-templates/)); Smart Engines **4,715 templates / 2,989 doc types / 235 jurisdictions** ([product page](https://smartengines.com/ocr-engines/id-engine/)); Didit **14,000+ types / 220+ countries** ([supported documents](https://didit.me/supported-documents/)). ⚠️ Smart Engines publishes SDK repos on GitHub but **the demo builds output fake results** — the templates are not in the open artifact.

**Font consistency / digit substitution: nothing open and production-ready.** Two research lines, neither with released code: [Optical Font Recognition for ID forgery](https://arxiv.org/abs/1810.08016) (CNN on individual characters, tested on 3,238 Russian passport images — **no accuracy figures published at the page level**) and [OCR Graph Features](https://arxiv.org/abs/2009.05158) (character bounding boxes as a graph; claims it "dramatically outperforms" prior work, **specific accuracy not in the abstract**). ⚠️ **DeepFont reimplementations are trained on AdobeVFR, whose licence is "non-commercial research purposes"** — models trained on it inherit that. **[ESTIMATE]** the shippable version is font *consistency*, not *recognition*: measure stroke width, x-height, baseline offset and inter-character spacing within a field and flag statistical inhomogeneity. Classical CV, no licence encumbrance, no published numbers.

🔴 **ELA — do not use it as a decision signal on phone photos.** Hany Farid, on the 2013 World Press Photo dispute where ELA was used to call the winner a composite: ELA *"incorrectly labels altered images as original and incorrectly labels original images as altered with the same likelihood"* ([Wired, via Wikipedia](https://en.wikipedia.org/wiki/Error_level_analysis)). Documented limits ([FotoForensics FAQ](http://fotoforensics.com/faq.php)): useless on PNG; masked by uniform recompression; **interpretation is subjective**; and it cannot separate edits from legitimately high-frequency content — **sharp edges, fine microprint and text**, which is what an ID card *is*. Modern phone pipelines apply per-region denoising and HDR fusion *before* the single JPEG encode, producing exactly the non-uniform error levels ELA calls "editing." The one peer-reviewed evaluation ([IEEE ICSET 2015](https://ieeexplore.ieee.org/document/7412439/)) found it reliable on *natural images*. Open implementations are trivial (~15 lines) and included in **pyIFD** (Apache-2.0). **Use as an analyst visualisation, never as an automated gate.**

**Copy-move detection: run it masked to personalised zones only.** Block-based (DCT + lexicographic sort) and keypoint-based (SIFT/ORB + g2NN + RANSAC) implementations exist; ADQ/NADQ/DCT detectors ship in [pyIFD](https://github.com/AICoE/pyIFD) (Apache-2.0). 🔴 **ID documents break keypoint CMFD by design** — guilloche patterns, repeating microtext, a repeated state seal, and a ghost portrait that is *by definition* a copy of the primary. A naive SIFT-CMFD on a genuine licence lights up everywhere. The one ID-document CMFD dataset, [FMIDV](https://l3i-share.univ-lr.fr/2022FMIDV/FMIDV_v3.htm), warns its forged samples *"contain Similar but Genuine Objects (SGO) which has been shown as a challenge for Copy-Move Forgery Detection algorithms."* Standard benchmarks (CoMoFoD, CASIA v2) are natural photographs and tell you nothing here.

### 2b. Learned splicing/forensics — the licence table is the whole story

**Commercially usable:**

| System | Licence | Weights | Size | CPU latency | Best published metric |
|---|---|---|---|---|---|
| **pyIFD** (14 classical detectors) | **Apache-2.0** | n/a | n/a | not published; CPU-native | none on a common benchmark |
| **PSCC-Net** | **MIT** | ✅ in-repo | not published | **not published** (abstract claims 1080P @50+ FPS on unnamed GPU) | pixel-F1 AVG .542/.371; image AUC .616 |
| **CAT-Net v1/v2** | Apache-2.0 code + **CC-BY-4.0 weights** (relaxed 2026-08-05) ⚠️ GitHub API reports **no LICENSE file** — get it in writing | ✅ Drive | **114.3M params** | **not published** | pixel-F1 AVG .709/.601; image AUC .797 |
| **IML-ViT** | MIT | ✅ | 89.343M params, 92.026 GFLOPs | **not published** | in IMDL-BenCo protocols |
| **SAFIRE** | Apache-2.0 + CC-BY-4.0 ⚠️ README simultaneously calls the SafireMS *datasets* research-only | ✅ | not published | **not published** | AAAI paper only |
| **FOCAL** | MIT | ✅ | not published | **not published** | **relative IoU gains only**; absolute behind IEEE paywall |
| **EXIF-as-language** | MIT | ✅ | not published | **not published** | p-mAP Columbia .94 / DSO .62 / In-the-Wild .54 |
| **IMDL-BenCo** (harness) | CC BY 4.0 | via CLI | n/a | n/a | 8 models, one protocol |

🔴 **Legally unusable — flagged explicitly, because the best performer is in this list:**

| System | Licence text | Consequence |
|---|---|---|
| **TruFor** (CVPR 2023) | *"this software should be used, reproduced and modified only for informational and nonprofit purposes; any unauthorized use of this software for industrial or **profit-oriented activities is expressly prohibited**"* ([LICENSE](https://raw.githubusercontent.com/grip-unina/TruFor/main/test_docker/LICENSE.txt)) | **Banned.** And it is the SOTA: pixel-F1 AVG **.785/.696**, image AUC **.857/.781** ([arXiv 2212.10957](https://arxiv.org/pdf/2212.10957)). 68.7M params, 261 MB weights, **1.17 s @ 3.2 MP on an RTX A6000 — CPU not published** |
| **Noiseprint / Noiseprint++** | identical GRIP-UNINA clause | Banned. Also TensorFlow 1.2.1 — no wheels for Python ≥3.8 |
| **MMFusion-IML** | *"academic, non-commercial use only"* | Banned twice — own licence + consumes Noiseprint++ |
| **ManTra-Net** | *"academic or non-commercial purposes only… must pay for a commercial license"* (USC Stevens) | Paid route exists. Keras 2.2 + TF 1.8 — effectively unbuildable |
| **MVSS-Net / ++** | 🔴 **No LICENSE file at all** | **Worse than an explicit no** — all rights reserved, nothing to comply with. Also requires NVIDIA **apex** (hard CPU blocker) |
| **Sherloq** | GPL-3.0 | Copyleft. Author calls it *"an unpretentious educational tool… expect bugs"* |
| **PhotoHolmes** (harness) | Apache-2.0 base **but per-method licences override** — its README says using TruFor *"implies the user accepts its respective License, which… limits the use of this software to non-profit purposes"* | Usable only if you delete `methods/trufor` and `methods/splicebuster` **and prove it in CI** |
| **Forensically** | [Not open source — confirmed by the author](https://discuss.pixls.us/t/forensically-is-not-open-source/22268) | Rule out |

**No published CPU-latency benchmark exists for any of these.** The only published inference time in the entire set is TruFor's GPU figure.

Two structural mismatches worth flagging before picking any of them: **EXIF-as-language** detects camera-metadata inconsistency *across patches* — a single phone capture is consistent everywhere by construction, so it will correctly report "consistent" and tell you nothing. **FOCAL** decides forged-vs-pristine by clustering *within* one image, so given an authentic image it still returns clusters and labels one "forged" — a relative paradigm, a poor fit for a binary gate.

### 2c. 🔴 These models are near-chance on real ID documents — and blind to the attack that matters

**Measured, not speculated.** [FantasyID](https://arxiv.org/abs/2507.20808) (IJCB 2025, Idiap) — real ID cards printed on plastic, captured on three devices, then digitally tampered. Abstract, verbatim: *"The current state-of-the-art forgery detection algorithms, such as TruFor, MMFusion, UniFD, and FatFormer, are challenged by FantasyID dataset"* with *"the operational threshold set on validation set so that false positive rate is at 10%, leading to **false negative rates close to 50% across the board** on the test set."* **A ~50% miss rate at 10% FPR is a coin flip.**

Corroboration: [FLiD](https://arxiv.org/html/2605.09089) re-ran TruFor, MMFusion and UniVAD with pretrained weights — *"MMFusion and UniVAD remain close to chance across most settings"* and *"detectors designed for natural-image manipulations do not capture the localized, semantically constrained edits found in identity documents."* Its own **whole-document** baseline collapses to **EER 48–53%, AUC 0.47–0.53** — whole-document classification of ID images is worthless. The [2026 systematic survey](https://arxiv.org/abs/2607.01442) zero-shot-benchmarked nine public models on 696 unseen synthesised IDs: *"even the strongest publicly available models achieve APCER values above 25% under security-oriented operating conditions."*

🟢 **The literature's answer is field localisation, and it is cheap.** FLiD crops each field (YOLO11 → MobileNetV3-Small → 191K-param head) and beats TruFor by **+10.7 pp (face), +4.7 pp (text), +15.4 pp (combined)** with **13× fewer trainable params and 21× fewer FLOPs per field**. Its own AUCs: **0.834 face / 0.926 text / 0.837 combined** — state of the art, and not a solved gate. **Build that shape: crop the portrait and each text field, score independently, take the most-suspicious field.**

### 2d. 🔴 The failure mode nobody flags: a physically forged card, photographed once

CAT-Net's core signal is **JPEG double-compression** — it reads quantised DCT coefficients out of the file (it hard-requires `jpegio`) and looks for a region whose DCT-histogram periodicity differs from its surroundings. Same family as ADQ/NADQ/DQ/GHOST in pyIFD.

Now the attack you actually care about: someone manufactures or alters a **physical** PVC card and photographs it once. Photons → one sensor → one demosaic → one JPEG encode. **One compression generation, applied uniformly to every pixel.**

| Signal the detector consumes | Present in a single-capture physical forgery? |
|---|---|
| Double-compression discontinuity (CAT-Net, ADQ, NADQ, GHOST) | **No** |
| Digital splicing boundary (MVSS-Net, PSCC-Net, IML-ViT, FOCAL) | **No** |
| Camera noise-residual inconsistency (Noiseprint, Splicebuster, TruFor low-level branch) | **No** — one camera, one residual everywhere |
| EXIF/metadata inconsistency across patches | **No** — fully consistent, and correctly so |

**A physically forged card photographed once is a digitally pristine image of a fraudulent object. Every detector in §2b will pass it, and by its own definition each will be right.** This is not a threshold problem — the evidence class does not exist in the image. The countermeasures for that attack are substrate/print-texture PAD, template conformance, and **the barcode↔front cross-check of §1e** — which is why §1e outranks all of §2b.

### 2e. Recapture, print, hologram, portrait substitution

**Screen-recapture: no credible validated open pretrained classifier exists for ID documents.** Classic signal-processing lines are published — specularity + gradient non-linearity ([Gao et al., ICME 2010](https://www.ee.columbia.edu/ln/dvmm/publications/10/SRIDBPF_ICME2010.pdf)), learned **edge-profile** dictionaries ([Thongkamwitoon et al., IEEE TIFS 2015](https://www.commsp.ee.ic.ac.uk/~pld/publications/IEEETransactionsINFS_THT_HM_PLD15.pdf)), CNN+ViT moiré fusion, wavelet multi-input CNN ([AmadeusITGroup repo](https://github.com/AmadeusITGroup/Moire-Pattern-Detection) — **ships no weights**). ⚠️ **FFT peak detection is defeated by published means:** moiré *"can be concealed with deep learning-based demoiréing techniques"*, and high-PPI phone displays suppress the aliasing it depends on. **[ESTIMATE]** treat an FFT-peak detector as cheap, high-precision, low-recall — never the PAD decision.

Two HF models exist and neither is usable evidence: `Jwalit/document-moire-detector` (Apache-2.0) claims **99.12% accuracy** — 🔴 **read the training data first: 8,000 *synthetic* images with programmatically overlaid moiré, no real-world test set. [ESTIMATE] that number measures the model detecting its own synthesis pipeline.** `UserPollo/moire-pattern-detector` (Apache-2.0) publishes **zero metrics**. The survey confirms the gap: *"no comprehensive, publicly available forensic pre-training for document artifacts exists."*

⚠️ **Face-PAD models do not transfer.** minivision Silent-Face (Apache-2.0) and DeepPixBiS operate on an aligned face crop at 80×80 or 224×224 — their cues are skin reflectance micro-texture and pixel-wise depth. MiniFASNet at 80×80 destroys the exact high-frequency signal moiré lives in. **[ESTIMATE] expect near-chance.** 🔴 **CelebA-Spoof/AENet is non-commercial** (*"cannot reproduce, duplicate, copy, sell, trade, resell or exploit for any commercial purposes"*) — disqualifying. The one idea worth stealing is Silent-Face's Fourier-spectrum auxiliary branch (Apache-2.0), reimplemented on document crops.

**Print recapture:** the principal line is halftone-cell distortion modelling ([Chen et al., IEEE TIFS 2022](https://ieeexplore.ieee.org/abstract/document/9834956)) — **open code: not found.** No open pretrained print-recapture detector exists.

🔴 **Hologram/OVD verification from a single still is physically impossible, not merely hard.** An OVD's appearance at a pixel is set by the grating equation — a function of the angle between illumination vector, surface normal and viewing vector, of the illumination spectrum, and of a per-template reference of what *that* OVD looks like at *that* angle. **From one frame, "genuine OVD at an unlucky angle" and "no OVD at all" produce the same pixels.** AAMVA's own definition confirms the mechanism: *"Optically variable element: An element whose appearance in color and/or design changes dependent upon the angle of viewing or illumination."* The literature agrees that methods *"rely on the acquisition of a video."*

**With a short tilt video it becomes possible in principle** — angle sweep with per-pixel chromatic variance after warping frames to a canonical template; flash on/off differential imaging (patented by Smart Engines for smartphones); specular tracking. What is open: **MIDV-Holo** ([repo](https://github.com/SmartEngines/midv-holo), CC BY-SA 2.5) — 700 clips, 300 genuine + 400 attacks, iPhone 12 + Galaxy S10, 5 fps, **no baseline code in the repo**; baseline **ROC AUC 0.847** reported in [arXiv 2404.17253](https://arxiv.org/html/2404.17253v1). The EPITA reimplementation and HoloVerif are **GPL-3.0 with no shipped weights**; HoloVerif reports F-score 95±3 / AUC 93±2 at 5 fps but **recall 93±5% on static attacks vs only 61±13% on dynamic ones**, and needs 8 CPUs for NN methods / **30 CPUs** for the MIDV-Holo baseline. **Verdict: nothing open is production-ready; building on it means GPL risk, training your own weights, and constructing a US-document OVD reference set that does not exist publicly.**

**Portrait substitution:** dataset yes, detector-as-a-download no. IDNet's own baselines on its West Virginia DL subset — **face-morphing detection 98.87%** but **portrait-substitution detection 88.95%** ([arXiv 2408.01690](https://arxiv.org/html/2408.01690v1)). **That gap is the honest headline: substitution is measurably harder than morphing even on the authors' own synthetic data.** The cross-domain reality check is worse: the IJCB 2024 ID-card PAD competition, training on Spain/Chile/Argentina/Costa Rica and testing on a sequestered Chile/Guatemala/Panama/Mexico set, best of five teams was **EER 21.87%, BPCER₂₀ 65.82%, BPCER₁₀₀ 90.70%** ([arXiv 2409.00372](https://arxiv.org/html/2409.00372v1)); the 2025 edition improved to **EER 11.34%** private-data / **6.36%** open-set. **[ESTIMATE] a US-licence engine built on European synthetic data should be assumed nearer the 22% end than the 4% end until measured on US documents.**

**Morph detection only works differentially — which you can do.** [NIST FATE MORPH](https://pages.nist.gov/frvt/reports/morph/frvt_morph_report.pdf) (48 submissions, updated 2025-07-29): a leading **D-MAD** algorithm returns one false positive in a hundred while catching roughly **72%** of morphs. **"D-" is differential** — it compares the document image against a trusted live capture. Single-image S-MAD is materially worse. **You have the selfie, so the configuration that works is available to you.** No unrestricted, validated open morph detector was found; SMDD weights are request-gated.

### 2f. What is impossible without special hardware

Straight from the AAMVA 2025 standard — mandatory features invisible to an RGB camera:

| Feature | Status | Why a phone cannot see it |
|---|---|---|
| **UV-A dull substrate** (Table B.1, 1.1) | **Mandatory** — *"No response using a light source with a wavelength between 315 nm and 400 nm"* | Needs a 365 nm source and no UV-cut filter |
| **UV fluorescent ink** (Table B.3, 3.1.1) | **Mandatory** — *"UV fluorescent ink (visible or invisible) with a spectral response in the 365 nm wavelength shall be used as the mandatory feature"* | Same |
| IR-fluorescent / IR drop-out / B900 | Optional | Needs an IR illuminator and IR-pass sensor; phones have IR-cut filters |
| **Level 3 features** | *"Specifics are not considered in this standard because level 3 security features are generally disclosed and only discussed between experts on a need to know basis"* | Forensic-lab only, **specification deliberately not public** |

AAMVA's own tiers make the boundary explicit: *"Level 1: first line inspection — Examination without tools or aids… Level 2: second line inspection — requires the use of a tool or instrument (e.g., UV light, magnifying glass, or scanner)."* **A phone photo is a Level 1 inspection. You are structurally excluded from Levels 2 and 3.**

**NFC: real for passports, useless for US licences.** ePassports carry a CSCA-signed Document Security Object; Passive Authentication proves the data was not altered. Open implementations: [JMRTD](https://jmrtd.org/about.shtml) (Java, LGPL), [pypassport/ePassportViewer](https://github.com/beaujeant/ePassportViewer) (Python, BAC/PACE, Passive + Active Authentication). Access is keyed from the MRZ, tying this to §1d. 🔴 **US driver's licences have no readable chip.** The exception, Enhanced Driver's Licenses, carries a UHF RFID chip — and DHS states *"No personally identifiable information (PII) is stored on the card's RFID chip… the card uses a unique identification number that links to information in a secure DHS database"* ([dhs.gov](https://www.dhs.gov/enhanced-drivers-licenses-what-are-they)). **It is a pointer into a database you cannot query. Worthless for private-sector verification.**

### 2g. Open datasets for validation without training

| Dataset | Licence | **Commercial?** | **US IDs?** | Forgeries | Video | Notes |
|---|---|---|---|---|---|---|
| **IDNet** ⭐ | paper/HF say CC BY 4.0; **Zenodo records carry `cc0-1.0`** | 🟢 **Yes — cleanest licence in the field** | 🟢 **YES — 10 states** | ✅ 6 patterns incl. **portrait substitution**, morphing, text rewrite | ❌ | 837,060 images, ~490 GB. Templates reverse-engineered from public DMV samples, PII stripped with SD 2.0. DHS-funded |
| MIDV-500 | **CC BY-SA 2.5** (`license.txt` on FTP) | 🟢 Yes, attribution | ⚠️ **3 of 50** (Border Crossing Card, Passport Card, 1982 SSN) — **no US DL, no US passport book** | ❌ | ✅ 500 clips | Wikimedia images **printed on photo paper and laminated** |
| MIDV-2019 / 2020 / LAIT | CC BY-SA 2.5 | 🟢 Yes | ❌ | ❌ | ✅ | 2020 narrows to 10 European types |
| **MIDV-Holo** | CC BY-SA 2.5 | 🟢 Yes | ❌ | ✅ 400 PA clips | ✅ 700 | **Only public hologram video set** |
| **MIDV-DM** | CC BY-SA 2.5 | 🟢 Yes | ❌ | ✅ 8,000 manipulated **with pixel-level masks**, taxonomy from **>2,000 real fraud attempts** | ❌ | 94.62 GB. 🔴 **Contradicts the survey's claim that no public dataset has pixel-level localisation** |
| **MIDV-Copy** (2026) | CC BY-SA 2.5 | 🟢 Yes | ❌ | photocopy-of-scan | ❌ | 8.27 GB — print-recapture set |
| **DLC-2021** | CC BY-SA 2.5 | 🟢 Yes | ❌ | ✅ screen recapture, colour/greyscale copies | ✅ 1,424 | The recapture leg |
| **FantasyID** | CC BY 4.0; abstract says *"publicly available (including commercial use)"* ⚠️ Zenodo returned 503 — verified only via the paper | 🟢 Yes | ❌ 13 fantasy templates | ✅ face swap, diffusion text edit | ❌ | **Printed on plastic**, 3 devices |
| SIDTD | ⚠️ **conflict** — Nature paper says CC BY-SA 2.5, repo says CC-BY-4.0 | 🟡 Get it in writing | ❌ 10 EU | ✅ crop&replace, inpainting | ✅ | Survey: *"simple pixel-level edits lacking any semantic or GenAI-driven manipulation"* |
| **DocXPand-25k** | 🔴 **CC BY-NC-SA 4.0** | ❌ **NonCommercial** | ❌ | ❌ | ❌ | Authors also state it is *"explicitly not fraud detection"* |
| **FMIDV** | 🔴 **No licence published** = all rights reserved | ❌ | ❌ | ✅ 28,000 copy-move | ❌ | Email-gated |
| KID34K | Google-Form gated | ⚠️ Request | ❌ South Korea | ✅ screen + print | ❌ | 34,662 images |
| **FakeIDet-db** | 🔴 Signed agreement, *"can only be signed by permanent researchers… and selected companies generating research outcomes"* | ❌ effectively | ❌ Spain | ✅ | ❌ | **The only set built from REAL identity documents** |

⚠️ **Security note on the Smart Engines FTP host:** `ftp://smartengines.com/midv-500/` contains a file named `Photo.scr` (Windows executable extension) alongside the data. **Fetch explicit paths only; never mirror the directory blind.**

**Government sources are all closed.** AAMVA, verbatim: *"AAMVA does not provide sample DL/ID documents/specimens/exemplars from our principal members."* **NIST has no document-authentication track** — FRTE/FATE covers face only, and ⚠️ do not be misled by "SIDD", which is *Specific Image Defect Detection* in face images, not scanned IDs. **DHS S&T RIVTD Track 1 is exactly your problem** — document validation on US state-issued DL/ID using **1,000+ real and fake state IDs** — with anonymised results at [mdtf.org/rivtd/Results2023](https://mdtf.org/rivtd/Results2023) and **no data release**. The follow-on round was reported as showing most commercial document validation *"disastrously ineffective"* ([Biometric Update](https://www.biometricupdate.com/202602/dhs-rivr-results-suggest-most-id-document-validation-disastrously-ineffective)) — **a useful calibration on what "good" means: the vendors' template libraries did not save them.**

🔴 **Kaggle/Roboflow "US driver licence" datasets are a legal and privacy hazard, not an asset** — vendor teasers with unretrievable terms, or user uploads of unclear provenance likely containing real people's documents. **Do not ingest.**

**Honest verdict.** IDNet is the *only* open dataset with US driver's licence layouts, and its US coverage is 10 of 51 jurisdictions, fully synthetic, with **no physical artefacts — no print texture, no lamination, no camera pipeline, no PDF417 realism guarantee.** Everything else is European, Korean, Spanish or fictional. The survey's own conclusion applies directly: *"When bona fide samples are synthetic templates rather than real captured documents, classifiers risk learning template-specific features rather than genuine liveness cues,"* and *"models trained on private, large-scale industry datasets significantly outperformed those trained on public benchmarks."* **Your only real validation set is your own historical captures.** Use IDNet (CC0/CC BY 4.0) to smoke-test that the pipeline runs on US-shaped layouts; use DLC-2021 + MIDV-Holo + MIDV-Copy for the capture-channel legs; **never quote an IDNet number as a production expectation.**

---

## 3. Capability 3 — face detection, embedding, 1:1 match, 1:N search

### 3a. 🔴 Licence forensics — this is the section that reshapes the build

**InsightFace splits code and weights, and says so three times.** From the [repo README](https://github.com/deepinsight/insightface/blob/master/README.md):

> "The code of InsightFace is released under the MIT License. There is no limitation for both academic and commercial usage."
> "The training data containing the annotation (**and the models trained with these data**) are available for **non-commercial research purposes only**."
> "**Both** manual-downloading models from our github repo **and auto-downloading models with our python-library** follow the above license policy."

A **2025-11-24 update** adds: *"For open-sourced face recognition models (e.g., buffalo_l package), please contact recognition-oss-pack@insightface.ai for licensing."* The [model zoo](https://github.com/deepinsight/insightface/blob/master/model_zoo/README.md) line 3 is unqualified: **"ALL models are available for non-commercial research purposes only."**

| Pack | Detection | Recognition | Size | Commercial |
|---|---|---|---|---|
| antelopev2 | RetinaFace-10GF | ResNet100@Glint360K | 407 MB | ❌ |
| **buffalo_l** (default) | RetinaFace-10GF | ResNet50@WebFace600K | 326 MB | ❌ |
| buffalo_m / buffalo_s / buffalo_sc | — | — | 313 / 159 / 16 MB | ❌ |

The PyPI package carries **no licence field and no classifier at all** (`license: None`, `classifiers: []` — [PyPI JSON](https://pypi.org/pypi/insightface/json)), so the repo text is the only authority. The weights are not in the wheel: `FaceAnalysis(name='buffalo_l')` downloads them at first run into `~/.insightface/models/` — **that download is the act the licence restricts, and it happens automatically inside your container.**

**Verified pack contents and sizes** ([HF mirror](https://huggingface.co/public-data/insightface/tree/main/models/buffalo_l)): `1k3d68.onnx` 144 MB, `2d106det.onnx` 5.03 MB, `det_10g.onnx` 16.9 MB, `genderage.onnx` 1.32 MB, `w600k_r50.onnx` 174 MB — **~341 MB total, ~192 MB for the three you would actually use.**

**Is there any commercially-usable ArcFace-quality weight set?** Short answer: **not cleanly.**

| Candidate | Code | **Weights** | Training data | Verdict |
|---|---|---|---|---|
| ONNX Model Zoo ArcFace R100 | Apache-2.0 | SPDX header says Apache-2.0 | 🔴 **"Refined MS-Celeb-1M… 3.8M images from 85000 unique identities"** — deepinsight's own LResNet100E-IR | ⚠️ **Two statements that cannot both be right.** A downstream repo cannot relicense someone else's weights with an SPDX header |
| OpenVINO OMZ `face-recognition-resnet100-arcface-onnx` | points at ONNX's LICENSE | same 261,036,388-byte file | same | **Same file, one more layer of laundering.** LFW 99.68% |
| davidsandberg/facenet | MIT | no separate weight licence | 🔴 **VGGFace2** (withdrawn) / CASIA-WebFace | Contaminated |
| facenet-pytorch (timesler) | MIT | — | inherits the above | Contaminated |
| **dlib** ⭐ | **Boost 1.0** | 🟢 **CC0-1.0** — *"anyone can do whatever they want with these model files as I've released them into the public domain"* | FaceScrub + VGG Face + scraped, ~3M faces / 7,485 ids | 🟢 **The only affirmative commercial grant from the person who trained them.** LFW **99.38%** (mean error 0.993833 ± 0.00272732), 128-d, 21.4 MB |
| **SFace** (opencv_zoo) | Apache-2.0 on the model dir | 🟢 Apache-2.0 | ⚠️ **which dataset produced this ONNX is not published** | 🟡 **Probably fine** — OpenCV affirmatively licensed it; whether they had the right depends on a fact they did not record |
| **YuNet** (opencv_zoo) | **MIT** | 🟢 **MIT** | WIDER FACE | 🟢 Clean |
| EdgeFace | BSD-3 in repo | 🔴 **CC BY-NC-SA-4.0 on every Idiap HF model card** | WebFace260M | 🔴 **The sharpest trap here** — anyone reading only the GitHub LICENSE concludes the opposite of the truth. Idiap sells commercial licences for it |
| AdaFace / MagFace / CurricularFace / OpenSphere / face.evoLVe / GhostFaceNets | MIT / Apache-2.0 | **no separate weight licence published** | MS1MV2/MV3, VGGFace2, Glint360K | Contaminated |
| **AuraFace-v1** (fal) | Apache-2.0 | Apache-2.0; card states *"trained on commercially and publicly available data sources to enable its usage in commercial setting"* | vendor-stated | ⚠️ **Surfaced by one research stream, NOT independently confirmed by the licence-forensics stream. Verify the card and the data claim yourself before relying on it.** ResNet100 + ArcFace |

🔴 **dlib has its own trap:** `shape_predictor_68_face_landmarks.dat` derives from iBUG 300-W and the dlib-models README carries an explicit note that *"The license for this dataset excludes commercial use… the trained model therefore can't be used in a commercial product."* **Use the 5-point predictor** (`shape_predictor_5_face_landmarks.dat`, 5,706,710 B), which carries no such note.

**Training-data contamination — the honest exposure.** *(Not legal advice.)* **MS-Celeb-1M was withdrawn by Microsoft in June 2019**; **VGGFace2 is withdrawn** (*"The download links for the VGGFace2 dataset are no longer available from this website"*); **WebFace260M is academic-only with a signed agreement**; Glint360K ships via insightface's non-commercial DataZoo. Four points:

1. Whether a trained model is a derivative work of its training set is **genuinely unsettled**. Anyone who tells you otherwise is guessing.
2. **The bigger exposure is data protection, not copyright.** These sets contain biometric data of identifiable people scraped without consent. The realistic risk is not "Microsoft sues you" — it is a regulator or class-action plaintiff asking why a commercial identity-verification engine is built on a dataset the publisher withdrew for consent reasons.
3. **A permissive SPDX header downstream is not evidence of upstream permission.** MS1MV2-derived weights sit in DeepFace, GhostFaceNets, MagFace, the ONNX Model Zoo and OpenVINO OMZ, several relabelled Apache-2.0 en route.
4. **For Hyperwolf specifically:** ~310 sessions/day, internal use, nobody is coming tomorrow. But cannabis is audit-heavy, California has CPRA biometric provisions, and the moment this engine appears in a compliance filing, vendor questionnaire, insurance application or acquisition diligence pack, *"which model, trained on what, under what licence"* becomes a written question. **The cost of a clean stack now is a few accuracy points; the cost of unpicking it later is the whole system.**

### 3b. Detection

| Model | Params | Size | WIDER Easy/Med/Hard | CPU latency | Landmarks | Deps | Commercial |
|---|---|---|---|---|---|---|---|
| SCRFD-10GF (`det_10g`) | 3.86 M | not published | 95.16 / 93.87 / 83.05 | 4.9 ms † | 5pt | onnxruntime | ❌ |
| SCRFD-500MF | 0.57 M | not published | 90.57 / 88.12 / 68.51 | **28.3 ms @640×480 / 11.4 ms @320×240** ‡ | 5pt | onnxruntime | ❌ |
| **YuNet 2023mar** ⭐ | not published | **232,589 B** | **0.8844 / 0.8656 / 0.7503** | **0.69 ms @160×120**, i7-12700K | **5pt** | `opencv-python` only | 🟢 **MIT** |
| MediaPipe BlazeFace | not published | in wheel | **not published by Google** | ~275 FPS Pixel 2 1-core + XNNPACK | 6pt | `mediapipe` | 🟢 Apache-2.0 |
| dlib CNN (MMOD) | not published | 694,687 B | **not published** | **not published** | via predictor | dlib | 🟢 CC0 |

† ⚠️ The `Infer(ms)` column in insightface's SCRFD table is **not labelled with a device. Do not read it as CPU.**
‡ The one unambiguous CPU figure insightface publishes, verbatim: *"precision and infer time are evaluated on AMD Ryzen 9 3950X, using the simple PyTorch CPU inference by setting `OMP_NUM_THREADS=1` (no mkldnn)."* Note the same table shows SCRFD-500MF at **82.03 Hard at original size vs 68.51 at 640×480** — **detection accuracy on the Hard set is dominated by input resolution, not model choice.**

⚠️ **YuNet's 0.69 ms is measured at 160×120, a thumbnail. OpenCV publishes no 640×480 figure. Do not quote it as one.** But the packaging win is real: `FaceDetectorYN` lives in OpenCV's **objdetect** module in the main repo, so plain `opencv-python` suffices — **no contrib, no extra dependency.**

**For a cooperative selfie flow — one large, centred, well-lit face — you are in Easy-set conditions**, where YuNet (0.8844) and SCRFD-500MF (90.57) are within a couple of points of SCRFD-10GF (95.16). The Hard-set AP is close to irrelevant.

### 3c. Embeddings and accuracy

| Model | Dim | Model size | CPU latency | Commercial |
|---|---|---|---|---|
| buffalo_l `w600k_r50` | 512 | 174 MB | **not published** | ❌ |
| ArcFace R100 (ONNX zoo) | 512 | 248.9 MB fp32 / 63 MB int8 | **not published** (int8 "1.78×" faster than fp32 on Xeon 8280) | ⚠️ conflicted |
| **SFace** | 128 | **38,696,353 B** | **5.09 ms @150×150**, i7-12700K, OpenCV DNN | 🟢 Apache-2.0 |
| **dlib ResNet** | 128 | 21.4 MB | **not published** | 🟢 CC0 |
| Facenet512 / VGG-Face | 512 / 4096 | not published | not published | ⚠️ / ❌ |

**InsightFace pack accuracy** ([model zoo](https://github.com/deepinsight/insightface/blob/master/model_zoo/README.md)):

| Pack | MR-ALL | African | Caucasian | S.Asian | **E.Asian** | LFW | CFP-FP | AgeDB-30 | IJB-C @FAR≤1e-4 |
|---|---|---|---|---|---|---|---|---|---|
| buffalo_l | 91.25 | 90.29 | 94.70 | 93.16 | **74.96** | 99.83 | 99.33 | 98.23 | **97.25** |
| buffalo_s | 71.87 | 69.45 | 80.45 | 73.39 | **51.03** | 99.70 | 98.00 | 96.58 | 95.02 |

🔴 **Look at the East-Asian column.** buffalo_l drops 94.70 → 74.96; buffalo_s drops 80.45 → 51.03. **Demographic differential is by far the largest published variance in these tables — larger than the gap between models — and it is the number nobody quotes.**

🔴 **LFW cannot distinguish any of these models.** From the same table: CASIA-trained R50 scores **99.450 LFW and 36.794 MR-ALL**; WebFace600K R50 scores **99.800 LFW and 90.566 MR-ALL**. **A 0.35-point LFW difference conceals a 54-point difference on a hard benchmark.** LFW's standard protocol is 6,000 pairs, so the finest measurable FAR is ~3.3×10⁻⁴ — every claim of FAR=1e-5 from an LFW number is extrapolation. Every serious model here sits in a 0.45-point band (99.38–99.83) = ~27 pairs out of 6,000.

Other verified figures: **dlib LFW 99.38%**; **SFace 0.9940** on the opencv_zoo eval; AdaFace R100/WebFace12M LFW 0.9982 / CFP-FP 0.9926 / AVG 0.9755; EdgeFace-XXS (1.77M params) LFW 99.73, IJB-C 94.85. **DeepFace's own LFW benchmark shows detector choice moves accuracy more than model choice** — ArcFace goes 96.6 (retinaface) → **54.8** (no detection/alignment), and **dlib recognition only works with dlib alignment** (96.4 with dlib vs 89.1 with retinaface), because its embedding expects dlib's crop geometry.

**NIST:** an `insightface_001` submission exists (submitted 2021-09-27, [report card](https://pages.nist.gov/frvt/reportcards/11/insightface_001.html)) but **its FNMR@FMR values are rendered as figures and are not extractable as text — treat as not published in machine-readable form.** **No `dlib` FRVT 1:1 submission was verifiable — report that as not published, not as "dlib performs poorly."** And **the buffalo_l pack as shipped has never been submitted**; FRVT entries are tuned pipelines, not `pip install` defaults.

### 3d. 🔴 Thresholds — and the number that should govern your expectations

**DeepFace's published defaults** ([threshold.py](https://github.com/serengil/deepface/blob/master/deepface/config/threshold.py), values are *distances*; "same person" when distance < threshold): VGG-Face cosine 0.68 · Facenet 0.40 · Facenet512 0.30 · ArcFace 0.68 · **Dlib 0.07** · SFace 0.593 · GhostFaceNet 0.65 · Buffalo_L 0.55.

🔴 **DeepFace publishes NO FAR or FRR for any of these.** They were tuned to maximise **accuracy on LFW** — i.e. the point where genuine and impostor errors roughly balance, roughly **FAR ≈ FRR ≈ 1–2%**. That is **two to four orders of magnitude looser than any sane IDV operating point. Do not ship a DeepFace default.** The 3-decimal precision on SFace's `0.593` conveys confidence the evaluation does not support. Note also that `cosine: 0.07` for dlib means similarity ≥ **0.93**, and `0.68` for ArcFace means similarity ≥ **0.32** — not comparable across models, and the sign convention trips people constantly.

🔴 **The widely-quoted InsightFace thresholds 0.28 / 0.35 / 0.4 have no primary source.** They circulate in blog posts and wrappers; **0.28 appears to originate from example code, not a calibration. Treat all three as folklore.** The only citable first-party statement is *"Typical 1:1 thresholds for InsightFace recognition packs land in the 0.30-0.45 cosine range at FMR = 1e-4 to 1e-5"* ([InsightFace guides](https://www.insightface.ai/guides/choose-face-recognition-model-and-evaluate)), heavily hedged, and it explicitly notes that 1:1 and 1:N need different thresholds.

🔴 **ID-photo-to-selfie is much harder than LFW, and this IS published.** [DocFace+](https://arxiv.org/abs/1809.05620) (IEEE TBIOM 2019), Table VII, private ID-selfie dataset:

| Method | TAR @ FAR=0.1% | TAR @ FAR=0.01% |
|---|---|---|
| **SphereFace** (≈99.4% on LFW) | **50.76 ± 1.55%** | **21.15 ± 1.63%** |
| CenterFace | 59.29 ± 1.42% | 41.38 ± 1.43% |
| COTS-1 (commercial) | 78.48 ± 1.99% | 68.03 ± 2.32% |
| COTS-2 (commercial) | 96.50 ± 1.78% | 94.41 ± 1.84% |
| DocFace+ (domain-adapted) | 97.51 ± 0.40% | 95.95 ± 0.54% |

The paper's own words: *"Performances of the two open-source CNN matchers, CenterFace and SphereFace, are below par on this dataset, much worse than their results on general face datasets."* The earlier DocFace paper adds: *"a cross validation on an ID-Selfie dataset shows that DocFace improves the TAR from 61.14% to 92.77% at FAR=0.1%."*

**Read that against LFW: a 99.4%-LFW model matches half of genuine ID-to-selfie pairs at a threshold that is already loose, and 21% at FAR=0.01%.** Also relevant: **NIST FRTE 1:1 uses a VISABORDER dataset** (visa photo enrolled, live border capture as probe) and ranks algorithms at **FNMR @ FMR = 10⁻⁶** ([frvt11](https://pages.nist.gov/frvt/html/frvt11.html)) — NIST's choice of 1e-6 rather than 1e-4 tells you what operating point serious evaluators consider meaningful.

🔴 **What is NOT published: any degradation figure for buffalo_l, dlib, SFace or any model in this survey on ID-photo-vs-selfie.** DocFace+ tested SphereFace and CenterFace, neither of which you would deploy. **Nobody has published buffalo_l on a document-to-selfie benchmark.** Additional stacking degradations — rescanned IDs with moiré/glare/holographic overlay, 5–10 year age gaps, printed-photo halftone, plastic gloss over the eye region — are also unpublished.

**The practical consequence: you cannot pick a threshold from any published table.** Collect a few hundred genuine and a few thousand impostor pairs **from your own capture pipeline**, plot the ROC, pick the point. Until then, any threshold you ship is a guess with a decimal point on it.

### 3e. 1:N search — the arithmetic, and why latency is not the problem

**Scale:** 310/day × 365 = **113,150 faces/year**; five years = 565,750.

**Brute-force numpy, N × 512 float32, cosine = one matrix-vector product:**

| N | Memory (N × 2,048 B) | FLOPs (N × 1,024) | **[ESTIMATE]** wall @5 GB/s | @10 GB/s |
|---|---|---|---|---|
| 10,000 | 20.5 MB | 1.024×10⁷ | 4.1 ms | 2.0 ms |
| **113,150 (year 1)** | **231.7 MB** | 1.16×10⁸ | **46 ms** | **23 ms** |
| 565,750 (year 5) | 1.16 GB | 5.79×10⁸ | 232 ms | 116 ms |
| 1,000,000 | 2.05 GB | 1.024×10⁹ | 410 ms | 205 ms |

**Arithmetic intensity = 1,024 FLOPs ÷ 2,048 bytes = 0.5 FLOP/byte — this is 100% memory-bandwidth-bound, not compute-bound.** The FLOP count is a red herring; the byte count is the answer. **[ESTIMATE]** confidence moderate: the bandwidth-bound model is right, the 5–10 GB/s single-core band is the uncertainty. **Measure in your own container before designing around it.**

**Total daily compute at year 1: 310 × 46 ms = 14.3 seconds/day = 0.017% of one core.** At year 5, 72 s/day.

| Store | Licence | Maturity | Exact? | ANN? | aarch64 |
|---|---|---|---|---|---|
| **numpy** ⭐ | BSD-3 | mature | ✅ | n/a | ✅ |
| **faiss-cpu** | **MIT** | 1.15.0, `>=3.10`, `cp310-abi3` | `IndexFlatIP` = exact | IVF/HNSW/PQ | 🟢 **`manylinux_2_27_aarch64` wheel present — this was a real problem historically and is resolved** |
| sqlite-vec | MIT/Apache dual | **0.1.9, pre-v1** | ✅ | 🔴 **NO** | ✅ |
| pgvector / hnswlib / usearch / chromadb | PostgreSQL / Apache-2.0 ×3 | mature–active | varies | ✅ | ✅ |

**sqlite-vec buys you nothing here.** Its README carries `[!IMPORTANT] sqlite-vec is a pre-v1, so expect breaking changes!`, and [ANN is an open tracking issue](https://github.com/asg017/sqlite-vec/issues/25) — it is **brute-force only**. That is the algorithm you already have in numpy, plus a C extension, plus breaking changes.

**Verdict: a `.npy` memory-mapped at process start with an append on each enrolment is the entire implementation.** You will not hit a wall until roughly 5–10 million embeddings — decades at Hyperwolf volume. The correct first upgrade, if ever, is **faiss `IndexFlatIP`, which is still exact brute force** with better SIMD/threading (typically 2–5× faster). **Do not go to HNSW/IVF**: approximate search introduces recall loss into a system whose entire job is not to miss a duplicate.

🔴 **The real 1:N problem is FAR compounding, and it has nothing to do with speed.** A 1:N search performs N independent comparisons, so `FPIR ≈ N × FMR`:

| Per-comparison FMR | Expected false hits/search at N=113,150 | Per day (310 searches) |
|---|---|---|
| 1e-2 (a DeepFace-style LFW-balanced default) | **1,131** | ~350,000 |
| **1e-4 (the IJB-C E4 operating point behind buffalo_l's 97.25)** | **11.3** | ~3,500 |
| 1e-5 | 1.13 | ~350 |
| 1e-6 | 0.113 | ~35 |
| **8.84e-9** | **0.001** | **~0.3** |

**Deploy buffalo_l's headline operating point for 1:N dedupe against 113k enrolments and you get ~11 false matches on every single search. The system is not slow — it is wrong, on every query, from day one.**

To hold false identifications to 1-in-1000 searches you need `FMR = 1e-3 / 113,150 = 8.84 × 10⁻⁹`. **And you cannot measure FMR ≈ 1e-8 from any public benchmark** — LFW bottoms out at 3.3e-4, IJB-C is usually reported to 1e-4 (sometimes 1e-5), NIST FRTE reaches 1e-6 using millions of images. **Nothing public reaches 1e-8.** From 113k enrolments you can generate ~6.4×10⁹ impostor pairs internally, so **you can measure it — but only on your own data, and only once you have the data.**

**Copy what vendors do, which is architectural, not numerical:**
1. **Never run 1:N as a bare threshold.** Return top-K (10–50) to a decision layer.
2. **Score normalisation** — use the margin between the top hit and the cohort, not raw cosine. Worth more than any threshold tuning.
3. 🟢 **Blocking.** Constrain by a non-biometric key you legitimately hold — DOB, licence number, region, name prefix. **Cutting N from 113,150 to 500 buys 226× of FAR budget for free.** Vendors do this first, not last.
4. **Two-stage:** cheap recall pass → expensive precision pass on the K candidates.
5. **Human adjudication on the residue.** ~1–3 candidates/day is operable; 3,500 is not.
6. 🔴 **Separate the thresholds.** 1:1 verify (selfie vs the ID just presented, N=1) and 1:N dedupe (selfie vs everyone ever enrolled) are different numbers with different error budgets. **Using one constant for both is the most common way this gets built wrong.**

---

## 4. Capability 4 — passive liveness / presentation-attack detection

### 4a. Inventory — `W?` (weights released) is the column that decides everything

| Project | Licence | Commercial | **W?** | Size / input | CPU latency | Best published metric | Health |
|---|---|---|---|---|---|---|---|
| **Silent-Face (MiniFASNetV1/V2)** ⭐ | **Apache-2.0** | ✅ | **YES** | **1.76 MB / 0.435M params**; 80×80 BGR, dual-scale | **19–25 ms** mobile SoC (published); **2.13 ms p50** Pi 5 CPU tflite | 🔴 **NONE on any public benchmark** | 2023-10-03, ★1810, 542 forks |
| **DeepFace `anti_spoofing=True`** | MIT wrapper | ✅ | YES (runtime DL) | 2 × 1.76 MB ensemble | not published | 🔴 **NONE** | active |
| **kprokofi MobileNetV3** | **MIT** | ✅ | **YES** | 3.02M params / 0.15 GFLOPs | not published | **CelebA-Spoof ACER 3.8%** (APCER 0.69 / BPCER 6.92 / AUC 0.998); **LCC-FASD ACER 16.33%** | 2023-01 |
| facenox/face-antispoof-onnx | Apache-2.0 | ⚠️ see below | YES | 1.82 MB fp32 / **600 KB int8** | no absolute ms | CelebA-Spoof 98.20% acc / AUC 0.9984 — no APCER/BPCER | active |
| CDCN / CDCN++ | MIT text **+ research-only rider** | ❌ | **NO** | 256×256 | — | OULU P1 ACER **0.2%** | — |
| DeepPixBiS | 🚩 **GPL-3.0** | ⚠️ | YES (Idiap) | ~13 MB | not published | OULU P1 ACER 0.42%; **P4 ACER 25.0 ± 12.7** | dormant |
| FAS-SGTD | MIT + *"commercial use is not allowed"* | ❌ | partial (P1 only) | — | — | OULU P1 ACER 1.0% | — |
| SSDG | 🔴 **NO LICENCE FILE** | ❌ | **NO** — `pretrained_model/` is stock ImageNet | — | — | O&C&I→M HTER 7.38 | — |
| SSAN | MIT | ✅ code | **NO** | — | — | O&C&I→M HTER 6.67 | — |
| FLIP | 🔴 **NO LICENCE FILE** | ❌ | **YES — 14 ckpts, unlicensed** | CLIP ViT-B/16 | — | ICM→O HTER 2.31 | — |
| ViTAF | Apache-2.0 ✅ | ✅ code | **NO** | ViT + adapters | — | O&C&I→M HTER 2.92 (5-shot) | — |
| FoundPAD | 🔴 **CC BY-NC-SA 4.0** | ❌ | gated | ViT-B/16 + LoRA | — | avg HTER 10.62% | — |
| MVP-FAS / GD-FAS / DADM / InstructFLIP (ICCV/ACM-MM 2025) | mostly none/MIT | ❌ | **NO WEIGHTS** | — | — | — | 2025 |

**The pattern is uniform: the field moved to CLIP/ViT + LoRA and stopped releasing usable checkpoints.** FLIP is the exception that proves the rule — 14 checkpoints, **zero licence**, which is legally *worse* than a restrictive one because there is no grant to rely on. **You cannot train, and the SOTA numbers belong to weights you cannot obtain.**

🔴 **The one model you can ship has no published benchmark.** Both Silent-Face READMEs were grepped for `CASIA|OULU|Replay|SiW|CelebA` — **no public benchmark, no protocol, no APCER/BPCER/ACER anywhere in the repository.** What is published is a two-row table: APK model 84M FLOPs / 20 ms / **TPR 97.8% @ FPR 1e-5**, and a "high precision" model at 99.7% that **was never released.** Both are TPR@FPR on unnamed data — not the ISO 30107-3 metrics an auditor will ask for. **Treat 97.8% as a vendor claim, not a measurement.**

Verified: LICENSE is verbatim Apache 2.0 ("Copyright 2020 Minivision") with **no separate weights licence** — the repo LICENSE is the only grant, which is what DeepFace relies on. Shipped `.pth` files are 1,849,453 B and 1,856,130 B (plain FP32). 🔴 **Output is 3-class, not binary** — `[1,3]` softmax with **class 1 = live** ([LiteRT card](https://huggingface.co/litert-community/Silent-Face-Anti-Spoofing-LiteRT)); treating it as a binary sigmoid gives silently wrong answers. Independent CPU figure: **2.13 ms p50 on Raspberry Pi 5, XNNPACK, 4 threads** — the most credible latency number in this section.

**DeepFace's anti-spoofing IS Silent-Face** — verified by reading [`FasNet.py`](https://raw.githubusercontent.com/serengil/deepface/master/deepface/models/spoofing/FasNet.py), which hard-codes both minivision GitHub raw URLs and instantiates `MiniFASNetV2` + `MiniFASNetV1SE`. Two operational cautions from the code: it is **a live dependency on a third party's GitHub raw endpoint with no pinned hash and no fallback** (mirror those two files yourself), and **DeepFace publishes no PAD accuracy of any kind.** **[ESTIMATE] ~4–12 ms/frame on desktop x86 for the ensemble** (anchor: 2.13 ms for one net under XNNPACK; DeepFace runs two nets in PyTorch *eager* mode, adding ~1–3 ms fixed per call). **[ESTIMATE] the face detector, not the PAD net, will be 80–95% of wall clock.**

🔴 **A licence-contamination trap nobody flags:** `facenox/face-antispoof-onnx` is Apache-2.0 **and trained on CelebA-Spoof**, whose agreement reads *"available for non-commercial research purposes only… must not… exploit for any commercial purposes."* Same applies to kprokofi's CelebA-Spoof numbers. Whether training taints the weights is unsettled — but it is a live risk on **the two options that actually have published metrics.** Silent-Face is ironically cleaner here: trained on minivision's own private data.

🔴 **"iBeta Level 2 compliant" open-source repos are not open source.** [Faceplugin-ltd/FaceLivenessDetection-Docker](https://github.com/Faceplugin-ltd/FaceLivenessDetection-Docker) (★87, top hit on the `liveness-detection` topic) advertises iBeta L2 compliance; reading the README, runtime binaries live in `./lib/cpu/` from a Google Drive link, no source, and activation requires emailing a machine code for a licence key. **No iBeta certificate is linked and no certification holder is named.** There is a cluster of these (kby-ai, FaceOnLive, MiniAiLive, Recognito, Doubango) — **treat the whole category as vendor marketing indexed as open source.**

### 4b. 🔴 Why the published numbers do not transfer

Consolidated from the [TPAMI survey](https://arxiv.org/abs/2106.14948) Tables 4/5. Intra = ACER% on OULU-NPU; cross = HTER% on unseen data. Lower is better.

| Method | **OULU P1 ACER** | OULU P4 ACER | C→I HTER | **I→C HTER** | Collapse |
|---|---|---|---|---|---|
| NAS-FAS (PAMI'21) | **0.2** | 2.9 ± 2.8 | — | — | **~84×** |
| PatchNet (CVPR'22) | **0.0** | 2.9 ± 3.0 | — | — | ∞ |
| DC-CDN (IJCAI'21) | **0.4** | 4.0 ± 3.1 | 6.0 | **30.1** | **~75×** |
| CDCN (CVPR'20) | **1.0** | 6.9 ± 2.9 | 15.5 | **32.6** | **~33×** |
| PixBiS (IJCB'19) | 0.4 | **25.0 ± 12.7** | — | — | **62× without leaving the dataset** |

**Intra-dataset ACER of 0.2–1.6% becomes cross-dataset HTER of 15–36%.** PixBiS is the cleanest demonstration: **0.4% on OULU P1 → 25.0% on OULU P4**, a 62× degradation caused purely by varying lighting, printer and phone at once. **The low numbers are protocol artefacts.**

**OULU protocols, from the official definitions:** P1 holds out *environment*; P2 holds out *attack medium*; P3 is leave-one-camera-out across 6 phones; **P4 holds out all three simultaneously — the deployment condition.**

🔴 **The most important table here — SSAN's own large-scale protocol, TPR at fixed FPR:**

| Method | TPR@FPR=10% | TPR@FPR=1% | **TPR@FPR=0.1%** |
|---|---|---|---|
| ResNet18 | 55.64 ± 22.05 | 17.53 ± 13.44 | **3.64 ± 3.93** |
| CDCN | 55.92 ± 21.45 | 11.07 ± 8.21 | **0.69 ± 0.74** |
| **SSDG-R** | 53.44 ± 19.23 | 3.27 ± 3.09 | **0.06 ± 0.06** |
| SSAN-R (best) | 63.61 ± 21.69 | 25.56 ± 18.07 | **6.58 ± 5.56** |

**SSDG-R — 11.28% average OCIM HTER — passes 0.06% of genuine users at a 0.1% false-accept rate.** The authors' own conclusion: *"some methods have achieved excellent performance on existing protocols, but may suffer an acute degeneration in the large-scale benchmarks… reveals the mismatch between academia and industry in FAS."* **Note the standard deviations exceed the means for several rows — a single reported HTER carries essentially no predictive information about a specific deployment.**

**Why it collapses:** (1) **the network learns the sensor, not the attack** — the survey attributes I→C failure to *"serious lighting and camera resolution variations"*; Replay-Attack is 320×240 MacBook MJPEG. (2) **Codec artefacts** — replay detection leans on moiré and blocking, so 🔴 **a delivery app that re-encodes on-device before upload destroys exactly the signal these models rely on.** (3) **Attack-medium overfitting** — FLIP's own experiment: train real+print → test replay = 4.69% HTER; train real+replay → test print = **10.36%**. (4) **Vintage** — three of the four OCIM datasets are 10–14 years old.

⚠️ **You cannot lawfully train on most of this corpus anyway.** CASIA-FASD: *"commercial usage… will be considered illegal"*. CelebA-Spoof: non-commercial. OULU-NPU requires a signatory *"with a permanent position"* and no public email domain. **And CASIA-FASD's only licence-submission endpoint (`cbsr.ia.ac.cn/.../AgreementUpload.aspx`) returned an empty reply, and `biometrics.idealtest.org` no longer resolves** — anyone reproducing "CASIA→Replay" numbers today is almost certainly using a re-hosted copy in violation of the agreement.

⚠️ **A metrics warning the literature ignores:** ISO/IEC 30107-3 guidance, as presented by standard editor [Christoph Busch](https://www.christoph-busch.de/files/Busch-PAD-240701.pdf), says when reporting a single figure **"DON'T use neither the equal error rate (EER) nor the half-total error rate (HTER)"** — report **BPCER at a fixed APCER**. Essentially the entire cross-dataset FAS literature reports HTER. **By the standard's own recommendation, every number above is the wrong metric.**

### 4c. Certification — no open model holds one, and none can

**ISO/IEC 30107-3:2023** covers *"principles and methods for performance assessment of PAD mechanisms"* and reporting. **It defines no pass/fail threshold.** Confirmed by [iBeta's own FAQ](https://www.ibeta.com/iso-30107-3-presentation-attack-detection-confirmation-letters/), verbatim: *"**Can our product become ISO/IEC certified through your PAD testing? No.** ISO standards do not include an established set of metrics or limit that indicate 'certification.' NIST … requires that neither iBeta nor our vendors claim that a biometrics system has been certified, approved, or endorsed by ISO standards."*

| | **Level 1** | **Level 2** | **Level 3** (2025) |
|---|---|---|---|
| Attacker expertise assumed | none | moderate | significant |
| **Penetration limit** | **0%** | **1%** | **5%** |
| **BPCER/FNMR cap** | **≤15%** | **≤15%** | **≤10%** |
| Species / presentations | 6 / 900 | 5 / 750 | — |
| Material cost cap per species | $30 | $300 | — |
| Cost | **not published** | **not published** | **not published** |

⚠️ **The BPCER ≤15% cap is routinely omitted from vendor marketing — a "Level 2 certified" product may reject up to 15% of genuine users and still pass.**

🔴 **iBeta's full confirmation-letters table (~271 rows, 2018-08 → 2026-08) was text-searched: `open source` 0 hits, `GitHub` 0, `Silent-Face`/`MiniFASNet`/`DeepPixBiS`/`InsightFace`/`OpenCV`/`DeepFace` 0, `CDCN`/`SSDG`/`FLIP` 0.** Every row is a named commercial entity + named product + specific version. **And the process has no mechanism by which a repo could be certified:** the engagement is contractual with a paying vendor; the unit of assessment is a *configured system* (model + capture device + thresholds + challenge sequence); versions are pinned; and the output is a conformance letter, not a certificate. **If you build this, *you* are the vendor and you submit your whole deployed system.**

**California requires none of it.** [DCC regulations, revised 2026-07-01](https://cdn.cannabis.ca.gov/wp-content/uploads/sites/2/2026/08/dcc_regulations_20260701.pdf): **§15404(a)** — sell only to 21+ *"after confirming the customer's age and identity by **inspecting a valid form of identification provided by the customer**"*; **§15415(g)** — *"Prior to providing cannabis goods to a delivery customer, a delivery employee shall confirm the identity and age of the delivery customer as required by section 15404."* 🔴 **Full-text search of all 235 pages: `biometric` 0 hits, `liveness` 0, `facial recognition` 0, `presentation attack` 0.** The only "facial" reference is §15044 requiring *surveillance cameras* to record *"the facial features of any person purchasing"*. **The obligation is a human inspecting a physical photo document.**

🔴 **The statutes that make this *riskier*, not required.** **Illinois BIPA** (740 ILCS 14) has a **private right of action**: $1,000 negligent / $5,000 intentional per person **plus attorneys' and expert fees**. §10 excludes *photographs* from "biometric identifier" but covers a *"scan of… face geometry"*, and Illinois federal courts have found coverage where face geometry is **derived from** a photograph. **§15(b) forbids you to "collect, capture… or otherwise obtain" without prior written notice and a written release — the verb is the violation; deleting the template a millisecond later relieves you only of the separate §15(a) retention duty.** Texas CUBI: **up to $25,000 per violation**, AG-only. Washington MHMD via the CPA. California CPRA §1798.140(ae)(2)(A): sensitive PI where biometric information is *"processed for the purpose of uniquely identifying a consumer."* The **2024 BIPA amendment (P.A. 103-769)** caps repeat collection from the same person by the same method at one recovery — **it caps a repeat customer, not the class**, and it expressly allows electronic-signature written release.

🟢 **Minimum-regret architecture: run liveness ephemerally and store only a boolean + timestamp — no template, no embedding, no retained selfie.** That is the highest-leverage legal decision in the project. **Get counsel; this is not legal advice.**

### 4d. Attack coverage — honest table

| Attack | Passive RGB CNN catches it? | Why / why not |
|---|---|---|
| Printed photo, flat | ✅ **Reliably** | Best-covered case; paper texture, no specular, flat depth, halftone. Over-represented in every dataset |
| Printed photo, wrapped/curved | ✅ Mostly | Curvature reduces the flatness cue; texture and colour gamut still betray it |
| Screen replay — phone | ✅ Usually | Moiré, screen-door, backlight cast, bezel — **but moiré is codec- and resolution-dependent** |
| Screen replay — tablet/monitor | 🟡 Weaker | High-DPI OLED at close range reduces moiré below what 2012-era training saw |
| Cut-out photo with eye holes | 🟡 Partial | In CASIA — but SSDG's own Grad-CAM shows models attend to *"the eyes region of the face for the cut attack"*, i.e. **memorised one PAI's geometry** |
| 2D paper mask | 🟡 Partial | In ROSE-Youtu / WMCA; same overfitting concern |
| **Silicone / resin 3D mask** | 🔴 **Largely no** | Only HKBU-MARs (12 subjects) and WMCA cover it. Real 3D geometry defeats the depth cue; discrimination needs skin-BRDF/subsurface cues no permissively-licensed released model was trained on |
| Latex mask | 🔴 No | Less coverage still |
| Deepfake replayed on a screen | 🟡 As a *replay*, maybe | The **screen** may be detected — not the deepfake |
| **Camera injection** (virtual cam / OBS / HDMI-USB) | 🔴 **NO — bypasses PAD entirely** | See below |

🔴 **Injection bypasses PAD by construction, not by degree.** A passive model classifies **pixels** and has no access to provenance. When a virtual camera feeds the browser, the model receives a clean, in-focus, genuinely-3D-looking face with no print texture, no moiré, no bezel — **because the source material was a real face captured by a real camera, somewhere else.** There is nothing to detect; it will confidently output "live." **The HDMI-to-USB variant is worse:** the dongle *is* a real UVC camera, so the OS, driver stack and browser all see genuine hardware, `label` is a real USB descriptor, `getCapabilities()` is honest, and frame timing is real capture timing. **There is no software-side check at any privilege level on the verifying machine that distinguishes this from a webcam. Cost: roughly $20.**

**Stated plainly: passive PAD raises the cost of a printed photo from zero to "buy a phone." It does nothing whatsoever against injection.**

### 4e. Injection / deepfake resistance in a browser path

**What the browser can see, and why it does not help.** Per the [W3C spec](https://www.w3.org/TR/mediacapture-streams/): `deviceId` *"MUST be un-guessable in documents from other origins"* and must rotate when storage is cleared — **it is a cookie by another name**; `groupId` *"MUST be uniquely generated for each document"* — it does not survive a reload; `label` is *"A label describing this device… Applications can't assume that the label contains any specific information"*, empty without an active stream or granted permission ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaDeviceInfo)).

⚠️ **Virtual-camera label blocklists are architecturally worthless.** Only *"OBS Virtual Cam"* could be corroborated from an OBS-authored source; the rest of the usual list (ManyCam, Snap Camera, DroidCam, e2eSoft iVCam…) appears only in third-party detector match lists. **And OBS's own stated position is that *"most apps/browsers detect the virtual status of a camera by internal information (namely the lack of a device driver), not the 'friendly' name"* — and that internal information is not exposed to web JavaScript.** Meanwhile on Linux, `modprobe v4l2loopback card_label="FaceTime HD Camera"` is **one line**; on Windows a DirectShow `FriendlyName` renamer is hosted on OBS's own resource site.

**Capability probing (`torch`, `zoom`, `focusMode`) fails on legitimate users.** `getCapabilities()` landed in Chrome 59, Safari 11, **Firefox 132**; PTZ shipped Chrome 87 with **"Android still supports zoom only"** and its own separate permission. ⚠️ **No per-browser support table for `torch` could be verified — MDN has no `MediaTrackConstraints/torch` page. Do not put a number on it.** A v4l2loopback device reports no torch and no zoom — **but neither does any front-facing camera, any laptop webcam, Safari/iOS, or Firefox < 132.**

**Every signal above is a value returned by a function running inside a runtime the attacker owns** — `Object.defineProperty(MediaDeviceInfo.prototype, 'label', …)` needs no browser patch. And **an attacker willing to patch has no reason to**: injecting at the OS camera layer produces a stream through the real `getUserMedia` path, so every client-side check passes *honestly*.

**Published prevalence** ([iProov Threat Intelligence Report 2025](https://www.iproov.com/reports/threat-intelligence-report-2025-remote-identity-attack)): native virtual-camera attacks **+2,665% YoY**, face swaps +300% vs 2023, 127 face-swap tools and 91 virtual cameras tracked, >115,000 known attack combinations. ⚠️ **Single commercial vendor whose product is sold as the remedy; marketing, unaudited, no methodology or denominator. The direction is corroborated; the percentages are not.**

🟢 **Nonce binding is the one sound component.** Server generates a ≥128-bit CSPRNG nonce → derives an unpredictable challenge → client responds inside a bounded window → server validates **content AND timing** → nonce single-use and expiring. **This defeats pre-recorded replay cryptographically and does not decay as generators improve.** It does **not** defeat real-time puppeteering: the challenge is satisfied *genuinely* — the attacker really did turn their head — the swap only changes whose face is on it.

🔴 **The load-bearing citation.** [*Seeing is Living? Rethinking the Security of Facial Liveness Verification in the Deepfake Era*](https://arxiv.org/abs/2202.10673), **USENIX Security 2022** — `LiveBugger` attacked **six commercial vendors** across all four FLV types. Verbatim: *"**Action-based FLV can be bypassed very easily**… the liveness evasion rate on HW can reach up to **97%**, and the overall evasion rate can reach up to **80%**"*; *"Compared to silence-based FLV, **the security gain of action-based FLV is marginal**"*; *"the anti-deepfake evasion rate on TC can still achieve as high as **100%**"*; and — directly on the design in the paragraph above — *"the **security gain of the random process** (e.g., random voice code or action sequence) … **is marginal**."* **"Our findings have been confirmed by the corresponding vendors."**

🟢 **The design lesson, and the counterweight.** [GOTCHA](https://arxiv.org/abs/2210.06186) builds challenges that target **inherent limitations of the generation pipeline** — occlusion, extreme pose, hand-over-face, rapid illumination change — rather than asking "are you alive?": **88.6% AUC (human raters), 80.1% AUC (automated).** *"Turn your head left"* is a **liveness** challenge and it is defeated. *"Pass your hand across your face"* is a **generator-stress** challenge and it degrades the fake. **Even so, 80.1% automated AUC is fraud triage, not authentication.**

**Real-time tooling, GitHub API 2026-09-08:** [Deep-Live-Cam](https://github.com/hacksider/Deep-Live-Cam) ★96,554, 14,096 forks, **pushed today**, AGPL-3.0, needs **one photograph**, advertises *"mouth masking while retaining original mouth movements"*, supports CUDA / AMD / **Apple Silicon CoreML** / OpenVINO / DirectML. DeepFaceLive (★31,011) is archived — **superseded, not defunct**, and still downloadable as a portable folder. ⚠️ **No published FPS benchmark on named consumer hardware exists in either repo. Any "30 fps on an RTX 3060" claim is unsourced.**

**Timing binding does not do what people think.** Published simple visual reaction time is **~190 ms** (Welford, via [Jain et al. 2015, PMID 26097821](https://europepmc.org/article/MED/26097821)), 180–200 ms to detect a visual stimulus. ⚠️ Those are the paper's *cited literature values*, not its own 120-subject measurements (its tables are images). **The human driving a puppet has the same ~200 ms RT, so a short window cannot separate human from real-time deepfake.** What it *does* defeat is **human-in-the-loop assembly** — an operator watching, selecting and splicing a pre-recorded clip needs seconds. **[ESTIMATE] window 1.5–3 s** challenge-render → first valid response frame; below ~800 ms you fail legitimate users on slow devices and camera exposure re-adjustment. **Log the distribution, not the threshold** — alert on implausibly *fast*, implausibly *consistent*, or frame-boundary-quantised latencies, and **sequence challenges serially with jittered gaps, never batched** (a batch lets the attacker pipeline). Instrumentation: [`requestVideoFrameCallback`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback) (**Baseline 2024**) gives `presentedFrames`, `presentationTime`, `expectedDisplayTime`, `mediaTime`.

**Open deepfake detectors do not generalise.** DeepfakeBench, all trained on FF++ c23 ([arXiv 2307.01426](https://arxiv.org/abs/2307.01426), Table 3): Xception **0.9637 in-domain → 0.7365 CDFv2 / 0.7077 DFDC**; UCF 0.9705 → 0.7527 / 0.7191; SPSL best CDFv2 at 0.7650. **No detector exceeds 0.7650 on Celeb-DF v2 — and DFDC is the *older* of those; a 2026 Deep-Live-Cam stream is further out of distribution than either.** 🔴 **DeepfakeBench is CC BY-NC 4.0** — a licensing problem in a commercial IDV path, not just an accuracy one. The DFDC winner ([selimsef](https://github.com/selimsef/dfdc_deepfake_challenge), MIT, weights released) scored log loss **0.4279 overall but 0.6605 on real videos** ([arXiv 2006.07397](https://arxiv.org/abs/2006.07397) Table 2), and the paper's own conclusion is the one that matters: *"In realistic distributions, the ratio of Deepfaked videos to real videos may be less than one in a million… **the number of false positives of even an extremely accurate model will outnumber the true positives**."* ⚠️ **The widely-circulated "82.56% → 65.18%" pair does not appear in the DFDC paper — both strings were searched in full text and found nowhere. Do not cite it.** FF++ by compression ([arXiv 1901.08971](https://arxiv.org/abs/1901.08971) Table 1): XceptionNet **99.26 / 95.73 / 81.00%** at raw / c23 / c40 — **c40 is H.264 QP=40, exactly where WebRTC lands under adaptive bitrate on mobile. Budget for the 81% column, then apply the cross-dataset discount on top.**

**Honest verdict: against a determined attacker, no. Against casual fraud, yes and substantially — provided nobody upstairs is told it is more than that.**

---

## 5. Capability 5 — active liveness challenge (own implementation)

### 5a. MediaPipe Face Landmarker — clean licence, and the packaging pain is over

| Item | Verified |
|---|---|
| Docs | [developers.google.com/edge/mediapipe/solutions/vision/face_landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker) |
| Repo licence | **Apache-2.0** ([LICENSE](https://raw.githubusercontent.com/google-ai-edge/mediapipe/master/LICENSE)) |
| **Model licence** | 🟢 **Also Apache-2.0** — each of the three model cards states *"LICENSED UNDER Apache License, Version 2.0"*. **No separate model EULA** |
| Bundle | `face_landmarker.task` = **3,758,596 B** (downloaded and unzipped): landmarks detector 2,553,590 B · blendshapes 955,312 B · BlazeFace detector 229,746 B · geometry metadata 19,376 B |
| Landmarks | **478 by default** — 468 mesh + **10 iris (indices 468–477)**. FaceMesh V2 card: *"more accurate (2.88 → 2.76 IOD MAE), and predicts 10 additional iris landmarks."* No `refine_landmarks` flag; it is baked in |
| Blendshapes | **52**, via `output_face_blendshapes=True` (default `False`) |
| **Head pose** | 🟢 **4×4 facial transformation matrix**, verified from [`geometry_pipeline.cc`](https://raw.githubusercontent.com/google-ai-edge/mediapipe/master/mediapipe/tasks/cc/vision/face_geometry/libs/geometry_pipeline.cc) (`Eigen::Matrix4f pose_transform_mat`), **metric units (cm)** |

⚠️ **Two authoritative blendshape lists disagree at the edges** — `face_blendshapes_graph.cc`'s `kBlendshapeNames` starts at `_neutral` and ends at `noseSneerRight` (no `tongueOut`); the model card appendix starts at `browDownLeft` and includes `tongueOut` at #52. **Index by name, never by integer.**

**Python packaging timeline, measured from the PyPI JSON API:** 0.10.21 (2025-02) had no arm64; **0.10.30 (2025-12-16) added macOS arm64**; **1.0.0 (2026-07-27) added `manylinux_2_28_aarch64`**. Current **1.0.1** ships `macosx_11_0_arm64` 33.7 MB / `manylinux_2_28_aarch64` 35.8 MB / `manylinux_2_28_x86_64` 37.9 MB, **`py3-none` platform wheels (no Python-version tag)**, Apache-2.0, still classified **Development Status: Alpha**. 🔴 **Two current traps replace the old one:** `manylinux_2_28` needs **glibc ≥2.28 — Alpine/musl will fail to resolve and attempt a source build**; and **Intel Macs have no wheel on 1.0.1** (`macosx_11_0_x86_64` disappeared after 0.10.21), which breaks a mixed dev fleet. ⚠️ [`mediapipe-silicon`](https://pypi.org/project/mediapipe-silicon/) is **dead** — last release 0.9.2.1, 2023-04-26, predating the Tasks API.

⚠️ **Its declared dependencies pull `opencv-contrib-python` (not headless), `matplotlib`, and `sounddevice`** (which needs PortAudio present) — a real Docker gotcha for a headless service.

**CPU latency: not published.** Neither the docs page nor any model card contains a latency table. The only published throughput is for the **detector alone**: BlazeFace short-range *"~275 FPS on Pixel 2 single-core CPU with XNNPACK"* ≈ 3.6 ms/frame, and detection runs only on reacquisition. **[ESTIMATE] full pipeline 8–20 ms/frame single-threaded on a modern x86-64 core; 25–60 ms on a constrained cloud vCPU or ARM SBC.** Reasoning: steady-state cost is a MobileNetV2-class net at 256×256 plus a negligible MLP-Mixer head — roughly an order of magnitude more work than the 128×128 BlazeFace that hits 3.6 ms on a Pixel 2 core, offset by a modern core being several times faster. **Measure before sizing anything.**

🔴 **Landmarks computed in the browser are not evidence.** A `FaceLandmarkerResult` posted to your server is a JSON blob the attacker can author in a text editor — **forging "I blinked" is `{"eyeBlinkLeft": 0.91}` in a curl command.** No obfuscation, WASM integrity check or attestation changes this. **The browser may run MediaPipe only for UX — the guidance oval, the "hold still" prompt. Every verdict that matters must be recomputed server-side on the actual received pixels** (and those pixels are only as trustworthy as §4e). Browser bundle cost, if you use it for UX: `@mediapipe/tasks-vision` 1.0.1 unpacks to 36.8 MB with an 11.2 MiB SIMD WASM — **budget ~15 MB cold-start before the first frame.**

### 5b. Blink (EAR) — the "standard threshold" is not from the paper

Soukupová & Čech, *Real-Time Eye Blink Detection using Facial Landmarks*, CVWW 2016. The canonical proceedings host refused connection; verified against the authors' [technical report CTU–CMP–2016–05](https://cmp.felk.cvut.cz/ftp/articles/cech/Soukupova-TR-2016-05.pdf). Eq. (4.1): `EAR = (‖p2−p6‖ + ‖p3−p5‖) / (2‖p1−p4‖)`, *"mostly constant when an eye is open and… close to zero while closing… partially person and head pose insensitive."*

🔴 **The paper does not endorse a global threshold — it argues the opposite.** Fig. 5.8 caption, verbatim: *"If the threshold is set to 0.35 the left blink will be detected but in right half of a plot there would be long false positive. If the threshold is set to 0.2 then the right blink is detected but the left blink is missed."* Body: *"It is very difficult to estimate a correct threshold convenient for all the video sequences… **So the thresholding method makes many mistakes**."* Its actual method is a **linear SVM over a 13-dimensional temporal feature** (EARs of the ±6 neighbouring frames at 30 fps), not "N consecutive frames below a threshold."

**Best-F1 operational thresholds, Table 5.1:** ZJU **0.27** · Eyeblink8 **0.08** · Silesian **0.15** — **a 3.4× spread**, with the EAR-SVM beating raw thresholding on every dataset (Eyeblink8: 77.9/77.9 → **94.3/96.2** precision/recall).

🔴 **The widely-copied `EYE_AR_THRESH = 0.3, EYE_AR_CONSEC_FRAMES = 3` is [PyImageSearch's](https://pyimagesearch.com/2017/04/24/eye-blink-detection-opencv-python-dlib/), not the paper's** — and 0.3 sits **above every operational threshold the paper measured.** Any review comment calling 0.3 "the standard from the paper" is wrong.

**Failure modes:** low light / motion — the FaceMesh V2 card itself warns *"one can expect degradation of quality and increase of 'jittering'"*; occlusion below 50% face visibility is out of scope; 🔴 **extreme yaw — FaceMesh V2 is unsuitable beyond 80° yaw and BlazeFace is specified to roll/pitch ≤45°, yaw ≤90°, which directly caps how far a head-turn challenge can go**; and per-person variation — [arXiv 2604.22479](https://arxiv.org/abs/2604.22479), verbatim: *"fixed values frequently fail to generalize across individuals due to variations in facial structure,"* with per-person calibration gaining **2–3%**.

🔴 **Eyeglasses and demographic bias: not measured, and I will not invent it.** No published quantification of eyeglass impact on EAR was found — the nearest published figure is adjacent, not the same (MediaPipe Iris **depth** error 4.3% σ 2.4% → **4.8% σ 3.1%** with glasses). And **no published evidence exists that EAR or MediaPipe eye landmarking is biased by epicanthic-fold / monolid morphology. That absence is the finding, not an exoneration.** A *mechanism* exists — EAR is a ratio of eyelid aperture to eye width, and palpebral fissure dimensions vary systematically with eyelid morphology — but Google's own fairness evaluations measure **17 UN geographic subregions and 6 Monk skin-tone bins**, which are not eyelid morphology, and their per-region MAE is aggregated over all 478 landmarks, diluting any eye-region-specific error into invisibility. ⚠️ **NISTIR 8280 does not apply here** — its scope is 1:1 and 1:N *matching* accuracy, not landmark localisation; citing it as landmark-bias evidence would be wrong.

🟢 **Therefore: a per-user calibrated EAR baseline is mandatory, not an optimisation.** Capture 1–2 s of open-eye frames at session start, take the median as `EAR_open`, trigger on a **relative** drop (e.g. `EAR < 0.6 × EAR_open` sustained over a temporal window). This is correct on the published evidence alone (0.08–0.27 spread; 2–3% personalisation gain) — and it happens to neutralise a morphology-driven bias if one exists. **Then measure your own accept rates by cohort in production; that is the only way you will find out.**

### 5c. Head pose, smile, gaze

🟢 **Use the MediaPipe 4×4 transform matrix, not solvePnP.** solvePnP fits 6 hand-picked correspondences to a *generic, unitless* template and 🔴 **requires you to guess the focal length (`focal ≈ width`) and assume zero distortion** — the two dominant error sources on consumer webcams. The transform matrix fits all 478 landmarks against a metric canonical model with intrinsics handled internally. ⚠️ **Live footgun:** OpenCV's own [`calib3d.hpp`](https://raw.githubusercontent.com/opencv/opencv/4.x/modules/calib3d/include/opencv2/calib3d.hpp) documents `SOLVEPNP_DLS` and `SOLVEPNP_UPNP` as *"Broken implementation. Using this flag will fallback to EPnP"* — still present in copied tutorial code. Keep solvePnP only as a dev cross-check; disagreement >a few degrees means something upstream is wrong.

**Published head-pose accuracy for MediaPipe on AFLW2000 or BIWI: none, by Google or anyone.** ⚠️ 6DRepNet's numbers must never be attributed to MediaPipe. **[ESTIMATE] ±5–10° MAE in the ±30° yaw range on good webcam input** — reasoning: dedicated pose-supervised regressors land ~3.5–4.5° on curated benchmarks, and a geometric fit to a generic mesh with no pose supervision under webcam conditions should be meaningfully worse. **This is a guess. Measure before setting a threshold on it.**

**"Turn left 20°" challenge design:** request **20–25°** (well inside the ≤80° envelope); accept **≥15°, ≤45° [ESTIMATE]** (one estimator-error below the request so noise does not fail a compliant user); hard-reject **>60°** (landmark quality collapses before the 80° limit); keep roll **<15°** throughout (FaceMesh V2 tolerates ~8°); sustain **≥5 consecutive frames**; record neutral yaw at session start and measure **Δ from neutral**. 🟢 **Require a monotonic sweep through intermediate angles, not a jump — a discontinuous pose jump indicates a spliced or injected frame. That trajectory requirement is the only part with anti-fraud value, and even it is weak.**

**Blendshape thresholds are not published.** Range is `[0,1]`; the only threshold-adjacent figure in the model cards is methodological — *"we only compare blendshapes with high activation values (greater than 0.25) to avoid noise in statistics"* — Google choosing a noise floor for their own metric, **not a detection threshold**, though a legitimate hint that below ~0.25 the coefficients are noise-dominated. **[ESTIMATE], all mine, not Google's:** smile `max(mouthSmileL, mouthSmileR) > 0.5` **and** `|L−R| < 0.3` (the symmetry test rejects a smirk **and usefully rejects a swap model rendering one side badly**); Duchenne corroboration `min(cheekSquintL, cheekSquintR) > 0.3`; mouth-open `jawOpen > 0.4` **and** `mouthClose < 0.2` (the antagonist check catches lips-closed-jaw-dropped).

🟢 **Prefer geometric EAR over the blendshape for the verdict.** The blendshape passes through an extra learned MLP-Mixer whose card warns it is *"sensitive to noise in input facial landmarks that lay outside of FaceMesh distribution."* **EAR is a transparent 6-landmark ratio you can log, debug and defend in an audit — you can explain EAR to a regulator; you cannot explain an MLP-Mixer activation.** Use `eyeBlinkLeft/Right` as a second opinion; disagreement between the two is itself a useful anomaly signal.

🔴 **Gaze: do not build it.** Google states it twice, verbatim, unprompted, in the [MediaPipe Iris announcement](https://research.google/blog/mediapipe-iris-real-time-iris-tracking-depth-estimation/): **"Note that iris tracking does not infer the location at which people are looking, nor does it provide any form of identity recognition."** The underlying paper is titled *"Real-time Pupil Tracking from Monocular Video for **Digital Puppetry**"* ([arXiv 2006.11341](https://arxiv.org/abs/2006.11341)). Iris *centre localisation* ≠ *gaze direction*: recovering gaze additionally needs eyeball-centre estimation, the per-person **kappa angle** (several degrees, not inferable from one frame), head pose and screen geometry. **No published evaluation of gaze accuracy from MediaPipe iris landmarks exists, and I will not estimate one — the vendor has disclaimed the capability.** `eyeLookInLeft` vs `eyeLookOutLeft` for a coarse left/right is the most you can defensibly use, as a soft corroborating signal only.

### 5d. 🔴 FLASHING — feasible in principle, no open implementation, and a live patent

**The principle.** Display a randomised sequence of full-screen colours. A real 3D face reflects them with shape-dependent shading, skin BRDF and subsurface scattering; a flat print or screen reflects near-uniformly; **and a pre-recorded video cannot contain a colour sequence chosen after it was recorded. The flash sequence *is* the nonce** — which is why this is the only active technique that is cryptographically bound rather than behaviourally bound. (Didit's own docs describe its `FLASHING` / "3D Flash" method as projecting *"dynamic light patterns at 30+ frames per second to create depth maps"*.)

**Academic sources:**

| Paper | Venue | Reported |
|---|---|---|
| **Face Flashing: a Secure Liveness Detection Protocol based on Light Reflections** — Tang, Zhou, Zhang, Zhang | **NDSS 2018** ([arXiv 1801.01949](https://arxiv.org/abs/1801.01949)) | **98.8% overall accuracy; 97.3% worst case** |
| **Aurora Guard: Real-Time Face Anti-Spoofing via Light Reflection** — Liu, Tai, Li et al. | 2019 ([arXiv 1902.10311](https://arxiv.org/abs/1902.10311)) | 🔴 **No accuracy/EER/ACER in the abstract.** 12,000 samples |
| Aurora Guard: Reliable Face Anti-Spoofing via Mobile Lighting System | 2021 ([arXiv 2102.00713](https://arxiv.org/abs/2102.00713)) | follow-up; intrinsic depth + material map |
| **LiveScreen: Video Chat Liveness Detection Leveraging Skin Reflection** | **IEEE INFOCOM 2020** ([PDF](https://www.winlab.rutgers.edu/~yychen/papers/LiveScreen%20Video%20Chat%20Liveness%20Detection%20Leveraging%20Skin%20Reflection.pdf)) | **97.7% acc / 1% FDR smartphones; 94.8% / 1.6% laptops** |
| SpecDiff — Ebihara et al. | IJCB 2020 ([arXiv 1907.12400](https://arxiv.org/abs/1907.12400)) | uses **camera flash**, not screen colour |

**Face Flashing detail, extracted from the PDF** — the most operationally useful paper, and its internals matter more than its headline. Two security factors: **time** (linear regression) and **shape** (a neural network). Challenge is *"a sequence of carefully-crafted images that are generated at random"*; *"if we use **8 different colors** and present **10 lighting challenges**, the hitting possibility will be less than **10⁻⁹**."* 174 participants (Asian, European, African), 6 robustness scenarios, *"3 seconds is a reasonable default setting"*, assuming a **60-fps camera and 60-Hz screen**. Server cost: *"the time needed to deal with **300 frames is less than 1 second**"*; on a Nexus 6 at 1920×1080, 300 frames cost **face extraction 28.63 s, timing verification 0.22 s, face verification 0.27 s**.

🟢 **Read those last two numbers carefully: the flash-liveness maths costs ~0.5 s per 300 frames. Face extraction/alignment is 98% of the cost. The technique is computationally cheap; the face pipeline around it is not.**

🔴 **And the architectural killer: Face Flashing's *timing* verification depends on rolling-shutter and screen-refresh line-scan synchronisation** — *"both of them follow the same scheme: refreshing pixel by pixel"*, with forgery detected as a **delay** because *"the adversary's screen can hardly be synchronized with our screen."* **A browser cannot do this.** No exposure control, no shutter mode, no frame-accurate screen-refresh binding. **In a browser you can implement the *shape* half and not the *time* half — which is the half providing the paper's headline security argument against forgery.**

🔴 **Reference implementations: there are none. That is the finding.** GitHub was searched across `flash+liveness`, `light+reflection+anti-spoofing`, `screen+illumination+liveness`, `aurora guard`, `face flashing liveness`, plus the `liveness-detection` and `face-anti-spoofing` topic pages. Complete set of near-misses: [Zhengtq/Aurora-Guard-…](https://github.com/Zhengtq/Aurora-Guard-Real-Time-Face-Anti-Spoofing-via-Light-Reflection) — ★9, 🔴 **no licence**, last push **2020-09-23**, **training code only, no weights**; [SpecDiff-spoofing-detector](https://github.com/Akinori-F-Ebihara/SpecDiff-spoofing-detector) — ★12, **MIT**, real pretrained SVM, **but MATLAB R2017b and it uses the *camera flash*, not a screen colour sequence**. **Official code for Aurora Guard: none released. For Face Flashing: no code release mentioned.** ⚠️ **Naming trap:** "Fasnet"/"flash-based" in this ecosystem almost always means **MiniFASNet** (passive, 80×80), not screen flash — at least one repo is mislabelled on exactly this confusion.

🔴 **PATENT RISK — take this to a lawyer. I am not one. This is not legal advice.**

**iProov [US 9,075,975 B2](https://patents.google.com/patent/US9075975B2/en)**, *"Online pseudonym verification and identity validation"*, assignee **iProov Ltd**, inventor Andrew Bud, priority 2012-02-21, granted 2015-07-07, **status ACTIVE, anticipated expiration 2033-02-17**. **Claim 1:** server sends **control information** to a device with an illumination source and camera → device **modulates its illumination** per that information and captures video → video returned → server **detects illumination changes matching the transmitted control signal** → authentication response. **That is, verbatim, the design in the first paragraph of this section.**

The family is large and growing: iProov's own [Grants & Patents page](https://www.iproov.com/grants-patents) states *"iProov technology is unique and protected by **over 30 patents**… These patents cover our user interface as well as our **Flashmark™ technology**."* The same family lists US 10133943, 9773180, 9621548, 9479500; a separate family runs to **US 12192198 (granted 2025-01-07)**; and **US 11235613 (2022)** covers *"Document Authentication by Attitude-Independent Determination of Surface Appearance Using **Controlled Illumination**."*

**FaceTec is actively litigating and just won.** Its foundational liveness patents (US 10,776,471 / 11,157,606 / 11,693,938 / 11,874,910) survived Jumio's IPRs: **PTAB Final Written Decisions on 2026-06-09 held all four challenged claims patentable**, and FaceTec's legal chief said the ruling *"positions us to proceed with the current patent infringement lawsuits against Jumio and iProov"* ([Biometric Update](https://www.biometricupdate.com/202606/appeals-board-upholds-4-facetec-biometric-liveness-detection-patents)). **The two largest patent holders in this space are suing each other, and one just had four liveness patents affirmed three months ago.**

One counterpoint: not every flash patent is live — **[WO2018118120A1](https://patents.google.com/patent/WO2018118120A1/en)** (Aware Inc, *"Analysis of reflections of projected light in varying colors, brightness, patterns, and sequences for liveness detection"*, priority 2016-12-23) has legal status **Ceased**. But iProov's 2012 priority predates it.

**Practical browser feasibility — the second reason to hesitate:**

| Aspect | Reality |
|---|---|
| Full-screen colour flash via CSS | ✅ Trivial |
| 🔴 **Screen brightness control** | ❌ **Impossible from the web.** The [Screen Brightness API proposal](https://github.com/WICG/proposals/issues/17) is **closed** and never shipped — and its own stated use cases explicitly included *"biometric security apps, where increasing the screen brightness can help illuminate features."* **You get whatever brightness the user has set — on a phone at 20% in daylight, possibly no usable reflected signal at all.** The single biggest practical obstacle |
| 🔴 **Camera auto-exposure / AWB** | ❌ **The camera actively fights you** — a sudden colour change triggers AE/AWB re-convergence, normalising away the signal over an unknown settling time. `exposureMode: "manual"` is **not exposed on iOS Safari** |
| Rolling shutter | ❌ Not observable from JS — kills the timing half |
| Frame-to-flash correlation | 🟡 `requestVideoFrameCallback` associates frames with flash phases, but not with sub-frame timing physics |
| Frame budget | At ~30 fps a 3-colour sequence needs **≥1 s**; Face Flashing used 10 challenges over 3 s **at 60 fps — you get half the samples the paper assumed.** Discard 2–3 frames after each transition for AE settling |
| 🔴 **WCAG 2.3.1 (Level A)** | *"Web pages do not contain anything that flashes more than three times in any one second period, or the flash is below the general flash and red flash thresholds"* ([W3C](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html)). **A full-screen colour-flash liveness check is precisely the pattern this criterion exists to prohibit.** Constrain to **≤3 transitions/second**, avoid saturated red entirely, and provide a documented alternative verification path |

**Nonce binding — why this technique is different, and where it still fails.** Strong against pre-recorded replay: with 8 colours × 10 challenges the guess probability is **<10⁻⁹**, and this is combinatorial, not statistical — it does not decay as generators improve. Strong against a static print or screen. 🔴 **Weak against real-time injection:** an attacker rendering a synthetic face can observe the flash on their own screen and either relight to match, or simply let the flash fall on the operator's real face and swap only the identity — in which case **the reflection is genuine, produced by a real 3D face under real illumination, and merely belongs to the wrong person. Screen-flash liveness proves *a* real 3D face was present under *your* illumination. It does not prove *whose*.**

---

## 6. Capability 6 — age estimation from face

### 6a. Model inventory

| Model | Code licence | **Weights licence** | Params / input | Deps | **MAE + benchmark** | CPU latency |
|---|---|---|---|---|---|---|
| **MiVOLO v2** ⭐ | **Apache-2.0** ([LICENSE](https://raw.githubusercontent.com/WildChlamydia/MiVOLO/main/LICENSE)) | 🟢 **Apache-2.0** (`license: apache-2.0` in the [HF card](https://huggingface.co/iitolstykh/mivolo_v2/raw/main/README.md)) | 28.8 M / 384×384 | torch, transformers==4.51.0, **no mmcv** | **3.65 Lagenda→Lagenda** (face+body); **5.55 Lagenda→AgeDB** | **not published** |
| MiVOLO v1 (d1) | Apache-2.0 | Apache-2.0 | 224×224 | torch | 4.24 IMDB-clean; **6.87 body-only**; 5.58 →AgeDB | not published |
| DEX / IMDB-WIKI | — | 🔴 *"academic research purpose only"* | VGG-16 ×20 ensemble / 256×256 | **Caffe** | **3.221** ChaLearn LAP-2015 val; **ε-error 0.264975** (1st of 115) | not published |
| **FairFace** | **CC BY 4.0** | CC BY 4.0 | — | — | **buckets, not MAE** — see below | not published |
| InsightFace `genderage.onnx` | MIT | 🔴 **non-commercial** | 1.32 MB | onnxruntime | 🔴 **NOT PUBLISHED — none anywhere in the README** | not published |
| DeepFace age | MIT wrapper | ⚠️ inherits **VGG-Face non-commercial** | VGG-Face backbone | tensorflow | *"± 4.65 MAE"* — **benchmark not stated in the README** | not published |
| SSR-Net | Apache-2.0 | in-repo | **326,368 B** / 64×64 | 🔴 **Keras 2.2 / TF1.x — imports `keras.engine.topology.Layer`, removed in Keras 2.3+. Python ≤3.7** | MORPH-2 **3.16** | 🟢 **2.69 ms, Intel i7** — the only published CPU number here |
| C3AE | BSD-2 | in-repo | **39.7 K params** / 64×64 | Keras 2.3 + TF 2.1, Py 3.6.5 | MORPH-2 **2.78**/2.75 | not published |
| CORAL-CNN | MIT | 🔴 **Google Drive, no licence attached** | ResNet-34, ~85 MB | torch | MORPH-2 **2.64±0.02** | not published |
| MWR | MIT | 🔴 Drive, unverified | VGG16 | torch | MORPH-2 2.00–2.53; UTKFace 4.37 | 🔴 not published — the quoted "143 fps" is **RTX 2080Ti** |
| DLDL-v2 | 🔴 **no official code** | — | ThinAge 3.7M / TinyAge 0.9M | MatConvNet | MORPH **1.969 / 2.291** | GPU only |
| [`onnx-community/age-gender-prediction-ONNX`](https://huggingface.co/onnx-community/age-gender-prediction-ONNX) | apache-2.0 | apache-2.0 | ships `model.onnx` | onnxruntime | **MAE 4.5, UTKFace** | not published |
| `dima806/fairface_age_image_detection` | apache-2.0 | apache-2.0 | ViT | torch | ~59% acc — 🔴 **`10-19` recall 0.4236**, worst exactly at your boundary | not published |
| `nateraw/vit-age-classifier` | 🔴 **NO LICENCE AT ALL** | — | — | — | **none published** | — |
| `AdamCodd/yolo11n-face-age` | 🔴 **cc-by-nc-4.0** + AGPL base | — | — | — | mAP@50 ~89.5% | — |

⚠️ **Correction to a common premise: MiVOLO's weights are Apache-2.0, not research-only.** Its training set Lagenda is *"CC 2.0. Do whatever you want, just remember to cite us."* **Two residual risks remain:** the HF card says the model *"was trained on proprietary and open-source datasets"* without enumerating the proprietary corpus; and the **v1 checkpoints are explicitly trained on IMDB-clean**, derived from IMDB-WIKI (**CC BY-NC-SA 4.0**). **Prefer the v2/Lagenda checkpoints.**

🔴 **But the detector is the actual blocker, and it is worse than the model question.** The MiVOLO authors label their own detector `license: agpl-3.0` in the [model-card YAML](https://huggingface.co/iitolstykh/YOLO-Face-Person-Detector/raw/main/README.md) — **declared, not inferred.** Ultralytics' [AGPL-3.0](https://raw.githubusercontent.com/ultralytics/ultralytics/main/LICENSE) §13 fires **without any distribution**: *"if you modify the Program, your modified version must prominently offer all users interacting with it remotely through a computer network… an opportunity to receive the Corresponding Source."* Ultralytics' own [licence page](https://www.ultralytics.com/license) says the reciprocal scope reaches *"the complete corresponding source code for the entire derivative work, including the larger application… and, where applicable, model weights,"* and that an Enterprise Licence is required for *"SaaS platforms, APIs, or cloud systems that use YOLO behind the scenes."* **A retailer running this server-side behind a web app is squarely inside §13. Replace the detector with YuNet (MIT, 232,589 B, 0.69 ms) and the problem disappears.**

⚠️ **MiVOLO ONNX export is author-discouraged:** *"while ONNX export is technically feasible, it is not advisable due to the poor performance of the resulting model with batch processing"* — TorchScript is recommended instead. That keeps torch in the image.

🔴 **FairFace cannot express the decision you need.** It predicts **9 buckets**: `0-2`, `3-9`, `10-19`, `20-29`, `30-39`, `40-49`, `50-59`, `60-69`, `70+`. **`10-19` and `20-29` both straddle the legal line** — "in 10-19" does not distinguish 15 from 19; "in 20-29" does not distinguish 20 from 29. Its own age accuracy is **.536 overall**, by band **0–9 .801 · 10–29 .680 · 30–49 .427 · 50+ .462**, by race Mid-East .500 → E-Asian .598. **It is a bias-measurement instrument, and an excellent one — use it to *audit* a model, never as the model.**

⚠️ **Every Hugging Face accuracy above is self-reported on a held-out split of the same dataset the model was trained on.** That is in-distribution, near-worthless for predicting behaviour on your camera. Say so to anyone who quotes it.

🔴 **Dataset-provenance contamination is the unresolved legal question and no repo addresses it.** IMDB-WIKI is **CC BY-NC-SA 4.0 / "academic research purpose only"** and contaminates DEX, SSR-Net imdb/wiki checkpoints, C3AE's `c3ae_imdb_v89.h5`, MWR pretrained, and MiVOLO **v1**. MORPH-2 requires a paid licence agreement and underlies most published MORPH MAEs. **A permissive code licence does not launder weights trained on a non-commercial dataset. Lawyer question, not a model-selection question.**

### 6b. Bias — the compliance-critical section

🔴 **Correction: NIST explicitly refuses to measure skin tone.** [FATE AEV](https://pages.nist.gov/frvt/reports/aev/fate_aev_report.pdf) §5.4.1, verbatim: *"We do not use the Fitzpatrick skin type (FST)"* … *"We did not attempt to recover FST from our test photographs."* **If a compliance reviewer asks for NIST skin-tone numbers, they do not exist.** NIST uses **region of birth over 34 countries in 6 regions** instead.

**Challenge-25 FPR at true age 17, Application images (Tables 5, 6, 18)** — direction is consistent across nearly all 49 algorithms: lowest = East-European males, highest = West/East-African females.

| Algorithm | F E-Africa | F E-Asia | F E-Europe | M E-Europe | **Gini** |
|---|---|---|---|---|---|
| innovatrics-001 | **0.17** | 0.014 | 0.02 | **0.000** | 0.81 |
| cognitec-000 | 0.08 | 0.015 | 0.006 | 0.000 | 0.74 |
| yoti-004 | 0.06 | 0.05 | 0.011 | 0.003 | 0.54 |
| paravision-000 | 0.011 | 0.013 | 0.006 | 0.003 | **0.35** |

🔴 **Low error and low unfairness are different things.** innovatrics-001 is more accurate on average than paravision-000 and **~10× more unequal (0.000 → 0.17). Selecting on headline MAE selects for the unfair model.**

**By sex** (Table 13, ages 18–30, MAE F/M): roc-002 2.7/2.4 · innovatrics 2.5/2.3 · yoti-004 2.7/2.3 · idemia-002 3.2/2.6 · **paravision-000 on Border/webcam 6.7/4.2**. NIST: *"generally higher FPR in women than men… The MAE values are also generally higher in women."*

**Image quality amplifies it in the same groups:** NIST §5.6 pairs Border(webcam) against Application(ISO) per person — dermalog-001 on **West-African subjects is ≈+4.1 to +4.6 years worse on webcam**, with only 10–21% of images improving. **The webcam penalty concentrates where error is already highest.**

**Glasses:** effects are **algorithm-specific and signed both ways** (dermalog/incode over-estimate with glasses; roc over-estimates *without*). 🔴 **NIST publishes figures only — no numeric per-algorithm deltas.** **Cosmetics and disguise are explicitly out of NIST's scope.**

**Makeup, measured:** [Chen, Dantcheva & Ross, VISAPP 2014](https://cse.msu.edu/~rossarun/pubs/ChenCosmeticsGenderAge_VISAPP2014.pdf) — **56.61% of subjects estimated younger after makeup; 32.08% by ≥5 years; max 20 years younger**, MAD 7.67, **larger than the estimator's own 5.84 baseline MAE**. Adversarially: [arXiv 2602.19539](https://arxiv.org/html/2602.19539v1), 329 faces aged 10–21 across 8 estimators including MiVOLO and DEX — makeup alone shifts the mean only +0.05 yr but achieves **Attack Conversion Rate 29–49%** (minor→adult flips); beard alone **28–69%**; all cues combined **+7.7 yr, up to 83% ACR**. ⚠️ Cosmetics there were VLM-simulated, not physically applied.

🔴 **Academic MAE by race** (apparent age on APPA-REAL, [arXiv 2604.03335](https://arxiv.org/html/2604.03335)): AfrAm F 2.93 · AfrAm M 2.92 · **Asian F 4.33** · Asian M 3.77 · Caucasian F 4.08 · Caucasian M 3.53 — highest error on Asian and African-American **female** subjects, attributed to male-skewed training data. ⚠️ [Gender Shades](https://proceedings.mlr.press/v81/buolamwini18a/buolamwini18a.pdf) (darker-skinned females misclassified **up to 34.7%** vs **0.8%** for lighter-skinned males) is **gender classification, not age** — cite it as evidence the pattern exists in commercial face pipelines, never as an age number.

**What this means for a 21+ gate, bluntly.** Your triage rule is "estimated age below T → force full ID review." A group whose estimates run low or merely noisier crosses below T more often. **Concretely: at Challenge-25, innovatrics-001 flags 0.0% of East-European men and 17% of East-African women at age 17. Same algorithm, same threshold, same product — a ~10× difference in who experiences friction.** Three consequences: (1) **fairness** — darker-skinned and female customers get a materially worse door experience, visible to them and invisible to you; (2) **legal exposure** — disparate friction by race and sex is the classic shape of a disparate-impact claim, and in California the Unruh Civil Rights Act reaches business-establishment discrimination, with the vendor's own benchmark documenting the disparity in advance; (3) 🔴 **it is undetectable from your metrics** — an aggregate MAE of 3.65 is fully compatible with a 10× intersectional ratio, and *"we didn't know"* is a worse deposition answer than *"we measured and mitigated."*

🟢 **The mitigation is architecture, not a better model.** Because the estimate can only ever be a risk signal (§6d), a false flag costs one ID check a compliant operation performs anyway — **so design the flagged path to be indistinguishable from the normal path, and the disparity has no customer-visible consequence.**

### 6c. NIST FATE AEV — what the leaders achieve, and the number that does not exist

**Use the living draft** ([fate_aev_report.pdf](https://pages.nist.gov/frvt/reports/aev/fate_aev_report.pdf)) — **437 pages, 49 algorithms, updated 2026-07-31.** ⚠️ The frozen [NIST IR 8525](https://nvlpubs.nist.gov/nistpubs/ir/2024/NIST.IR.8525.pdf) covers only 6 algorithms; do not cite it as current. Datasets ~11 M photos across Visa, Mugshot, Application (ISO 19794-5, 300×300) and **Border (webcam, ±45° pose, 240×300, 38 px mean interocular)** — Border being the closest analogue to a dispensary camera.

**Best MAE, ages 18–24:** Mugshot roc-002 **1.8** · Application dermalog-003/regula-000 **2.2** · Visa roc-002 **2.4** · **Border innovatrics-001 2.4** (medians ~2.6–3.4; worst 6.5–10.5).

🔴 **NIST does not publish a 21-threshold result.** §2.7, verbatim: *"For L = 18, T = 25 is common. **For L = 21, a higher value of T would be required to achieve the same accuracy.**"* NIST tabulates T = 22/25/28/31 **against L = 18 only**; a search for "Challenge-21", "T=21" and "age 21" across 437 pages returns nothing else. **Any 21+ figure attributed to NIST would be fabricated.**

**What NIST does publish that bounds your problem — Challenge-25 FPR by true age, Application images (Table 3):**

| Algorithm | 17 | 18 | 19 | **20** |
|---|---|---|---|---|
| dermalog-003 | 0.017 | 0.021 | 0.036 | **0.055** |
| paravision-000 | 0.012 | 0.025 | 0.054 | **0.104** |
| yoti-004 | 0.037 | 0.053 | 0.105 | 0.164 |
| **median of all 49** | **0.069** | — | — | **0.231** |

**Even NIST's leaders let 5.5–16% of 20-year-olds past a 25-year challenge; the median lets 23%.** And raising the buffer to T=28 makes every credible algorithm challenge **~14–26% of legitimate adults**.

Two further findings worth knowing: 🔴 **failure-to-process ≈ 0.000 everywhere** — *"it is a characteristic of deep neural networks to operate on any array of input pixels regardless of their semantic content."* **The model always returns a number, including for a blurred thumb — your quality gate (§8) is the only thing between garbage and a confident estimate.** And §5.3.1: *"we do not have any evidence (yet) that an age-verification classifier can outperform a regression-like estimator on the same task."*

🔴 **No open-weight model is competitive, and none was even submitted.** 49 algorithms from 30 organisations: **47 commercial plus 2 university** (Czech Technical University, Brno UT). **MiVOLO, DEX, InsightFace, FairFace, SSR-Net, C3AE — none appears.** The Brno entry is the **worst algorithm on Visa (MAE 10.5)**. Leaders are ROC, Innovatrics, Idemia, Regula, Paravision, Dermalog, Cognitec, Yoti. **There is no NIST-benchmarked open-weight baseline; every number in this subsection belongs to a product you have excluded.**

**The realistic commercial ceiling — Yoti** ([white paper, July 2025](https://cdn.aws.yoti.com/wp-content/uploads/2026/01/Yoti-Age-Estimation-White-Paper-July-2025-PUBLIC-v1.pdf), vendor self-reported; ⚠️ p.2 notes the measured model *"is not the model currently released to production"*): overall **MAE 2.4 yr**, **1.1 yr for 13–17**, TPR for 13–17 correctly estimated under-21 **99.3%**. Skin-tone gradient (Yoti's own 3-point manual scale, not Fitzpatrick): **tone 3 vs tone 1 ≈ +0.6 yr MAE for both sexes.**

🟢 **Yoti p.33 is the single most usable published table for your exact problem — FPR of under-21s estimated at or above threshold:**

| Threshold | 17 | 18 | 19 | **20** | Avg |
|---|---|---|---|---|---|
| 24 | 0.36% | 0.90% | 3.23% | **8.73%** | 2.67% |
| **25** | 0.13% | 0.38% | 1.55% | **4.70%** | 1.36% |
| 26 | 0.05% | 0.17% | 0.63% | 2.02% | 0.58% |
| **28** | 0.01% | 0.06% | 0.13% | **0.34%** | 0.11% |
| 30 | 0.00% | 0.02% | 0.10% | 0.07% | 0.04% |

Yoti's own recommended buffer for the 13–25 band in highly-regulated sectors: **3–5 years.** And **capture conditions explain most of the Yoti-vs-NIST gap** — by Yoti's own analysis, the threshold for 10% FPR at 17 is **26 on NIST Application 300×300, 21 on Mugshot 480×600, 19 on Yoti's 720×800**; ACCS measured **MAE 1.1 yr on mobile captures vs NIST's 2.63 yr on visa images for the same model — a 2.4× spread from capture conditions alone.** 🟢 **That is the strongest argument in this whole document for investing in §8.**

### 6d. Regulatory and the triage arithmetic — the answer is no

🔴 **Facial age estimation can never be the gate in California.** §15404 requires *inspecting a valid form of identification*, and subsection (c) is a **closed list of three** document types with **no "or other reliable method" clause and no rulemaking hook**. Three independent reasons FAE cannot substitute: (1) **§15404 verifies *identity*, not just age** — FAE returns an age estimate and by design identifies no one, so it is categorically incapable of half the obligation (note the trap: that same incapacity is your best BIPA defence, **so you cannot argue both ways**); (2) the list is closed and document-shaped; (3) there is no reduced-friction tier to earn — **Massachusetts proves it: [935 CMR 500.145(4)–(5)](https://www.mass.gov/doc/935-cmr-500-adult-use-of-marijuana/download) has a *formally recognised* pre-verification step and still requires the door check to verify the ID *"matches the pre-verified government-issued identification card."*** New York ([9 NYCRR §123.10(d)](https://cannabis.ny.gov/adopted-au-regulations)) accepts a bare **self-attestation** at online ordering but still requires door verification *"by viewing or scanning a document described in this Part."* **Keyword search of CA, MA and NY rules: "age estimation" — 0 hits each.** ⚠️ CO, MI, NV, NJ, IL, OR, WA, AZ, NM were not checked; *"no US state accepts FAE"* is **unproven**, *"none of CA/MA/NY"* is proven.

**The contrast that makes the US position legible:** UK Ofcom's [HEAA guidance (16 Jan 2025)](https://www.ofcom.org.uk/online-safety/protecting-children/age-checks-to-protect-children-online/) lists methods *"capable of being highly effective… open banking, photo ID matching, **facial age estimation**, mobile network operator age checks…"* — and confirms self-declaration is not highly effective. 🔴 **In the US, the phrase "facial age estimation" appears exactly once in the entire Federal Register** — in the [ESRB/Yoti COPPA application](https://www.federalregister.gov/documents/2023/07/20/2023-15415/childrens-online-privacy-protection-rule-proposed-parental-consent-method-application-of-the-esrb). **Never in an adopted US rule.**

**Can an open model support "<30 → force full ID review"? Do the arithmetic.** For zero-mean Gaussian error, `σ = MAE·√(π/2) ≈ 1.2533·MAE`; miss rate for a true 19-year-old is `1 − Φ((T−19)/σ)`.

| Model (MAE) | σ | T=25 | T=28 | T=30 |
|---|---|---|---|---|
| Yoti 2.4 *(excluded — the ceiling)* | 3.01 | 2.3% | 0.1% | 0.0% |
| **MiVOLO v2, 3.65** | 4.57 | **9.5%** | **2.5%** | **0.8%** |
| onnx-community, 4.5 | 5.64 | 14.4% | 5.5% | 2.6% |

🔴 **The Gaussian assumption is unverified and empirically optimistic by 2–4×.** None of the open repos publishes an error *distribution*, only MAE. Two reasons reality is worse: real age-error distributions are **heavy-tailed**, and errors on young faces are **biased, not zero-mean** — regressors regress toward the training mean (~30s), so a 19-year-old is systematically **over-estimated**, which is the failure direction. **Sanity check: Yoti's *measured* p.33 FPR for true 20-year-olds at T=25 is 4.70%, while this model predicts 2.3% for the harder 19-year-old case at the same MAE. The measured number for the easier cohort is double the model's prediction. Every figure above is a floor.**

**And the cost side kills it.** At T=30 with MiVOLO's σ, the fraction of genuine adults challenged is **97.5% at age 21, 86.3% at 25, 50.0% at 30**.

🔴 **So: at T=30 an open model challenges 86% of 25-year-olds and 50% of 30-year-olds and still misses ~1–3% of 19-year-olds (2–4× that after the correction above). That is not a triage — it is "check everyone under 30," with extra steps and a BIPA exposure attached.** You could implement the same policy with an instruction to staff, at zero infrastructure cost and zero biometric-privacy exposure. **The threshold is trapped between two walls, and the gap between them is a function of σ — open models' σ is roughly 1.5–1.9× Yoti's, which is precisely why Yoti has a business and the open models do not appear in NIST's evaluation.**

🟢 **Where the arithmetic does work — the only place.** Since a 100% ID check is required regardless, the estimate's real value is **prioritisation, not exclusion**: pre-dispatch, flag likely-under-21 orders for a supervisor call before a driver is committed (a false flag costs one phone call, and §6b's disparate-impact concern is defanged because no customer experiences the difference). **And as an anomaly detector, not a classifier** — a 45-year-old ID presented alongside a face estimating 19 is a strong ID-fraud signal, and at that gap even σ=4.57 gives a confident answer. 🔴 **The far-from-threshold cases are exactly where these models are reliable, and the near-threshold cases are exactly where the legal decision lives. That mismatch is the core finding of this capability.** **Never call it "age verification" — internally, in an SOP, or in a contract. Call it a pre-dispatch fraud signal.**

---

## 7. Capability 7 — device & IP risk without vendor feeds

### 7a. Tor exits — CC0, commercial use permitted, parity with any vendor

| Source | Verified 2026-09-08 | Detail |
|---|---|---|
| `https://check.torproject.org/torbulkexitlist` | 200, 19,115 B | **1,345 unique IPv4**, one per line, no header |
| `https://check.torproject.org/exit-addresses` ⭐ | 200, 508,134 B | 3,236 `ExitNode` records → **same 1,345 IPs**, plus per-IP `LastStatus` timestamps |
| `https://onionoo.torproject.org/details` | 200, protocol v8.0 | Enrichment: ASN, country, `first_seen`, flags |
| `https://collector.torproject.org/archive/exit-lists/` | 200, 200 tarballs | **16.5 years of history** — required for "was this IP an exit *at transaction time*" in a chargeback dispute |

**Licence, verbatim from the Tor metrics site footer:** *"Data on this site is freely available under a CC0 no copyright declaration."* **Commercial use permitted, no attribution required.**

**Three traps, all measured rather than assumed:**
1. 🔴 **`?ip=` parameters no longer filter.** `?ip=1.1.1.1`, `?ip=8.8.8.8&port=443` and the bare URL returned **byte-identical 19,115-byte bodies**. Any inherited code passing `?ip=` is stale.
2. 🔴 **Do not match against `or_addresses` or `flag=Exit`.** Onionoo defines `exit_addresses` as *"IPv4 addresses that the relay used to exit to the Internet in the past 24 hours"* while `or_addresses` is *ingress*. Measured: **9 real exit IPs appear in no relay's `or_addresses`**, `flag=Exit` over-blocks by ~2.2× (2,987 relays vs 1,345 exiting IPs), and **72 IPs (5.4%) in `torbulkexitlist` are missing from Onionoo entirely.** Match `ExitAddress` only.
3. 🔴 **The DNS exit list is dead.** `dig exitlist.torproject.org NS` → **NXDOMAIN**, confirmed via 1.1.1.1 and 8.8.8.8, and an `ip-port` query direct to the authoritative `check-01.torproject.org` returns **NXDOMAIN with the `aa` flag set**. No deprecation notice was published. **Any codebase doing a DNS lookup there is currently reporting "not a Tor exit" for every IP on earth. Worth grepping for.**

**Churn is not published, so it was measured** from consecutive CollecTor snapshots: **24 h — 11 added / 6 removed, Jaccard 98.7%; ~95 h — 23 / 17, Jaccard 97.1%. ~1% per day, not compounding linearly.**

⚠️ **dan.me.uk `/torlist/` is not a safe dependency:** *"You can only fetch the data every 15 minutes… **Every time you attempt to re-fetch the list, the timer resets**."* **Any retry loop, health check, or two instances behind one NAT can lock you out permanently while never once succeeding** — and a ban degrades silently into stale-cache false negatives. It also carries **no licence** (`Copyright © 2026 Daniel Austin MBCS`). The genuinely useful part is `dnsbl.dan.me.uk` (*"There are no query limits on this service"*), whose **`X` "Hidden Exit" flag** — nodes whose policy permits egress without advertising the Exit flag — is exposed by no Tor Project feed. Verified live: `dig 25.193.25.171.torexit.dan.me.uk A` → `127.0.0.100`.

🔴 **IPv6 Tor exits are a structural blind spot:** `torbulkexitlist` contains zero lines with `:`, Onionoo `exit_addresses` is IPv4-only by protocol definition, and TorDNSEL only probes over IPv4. **No coverage percentage is published; none is asserted here.**

**Refresh strategy:** primary source `exit-addresses` (same IP set, plus timestamps); **60 min TTL with conditional GET** on `Last-Modified` + `ETag` (Onionoo `If-Modified-Since` → verified 304); staleness ceiling 6 h degrade / 24 h alarm; **serve stale + alarm, never fail-open or fail-closed**; emit a `list_age_seconds` gauge; retry the individual HTTP call only, never the whole cycle; **build the new set then atomic-swap — never clear-then-repopulate.**

### 7b. Datacenter / hosting — the highest-quality free IP signal there is

**IP→ASN, one clear winner and one clear trap:**

| Source | Cadence | Size (measured) | Licence | **Commercial?** |
|---|---|---|---|---|
| **iptoasn.com** ⭐ | **hourly** | v4 6.96 MB gz / **536,289 rows**; combined 8.95 MB / **718,300 rows** | **PDDL v1.0 (public domain)** | 🟢 **Unrestricted, no attribution — the cleanest licence in this report** |
| RouteViews | RIBs 2 h | 83.6 MB per RIB | **CC BY 4.0** | ✅ with attribution |
| **RIPE RIS / RIPEstat** | 8 h / live | 429 MB | RIPE Data Repository T&C | 🔴 **PROHIBITED** |
| Team Cymru | 4 h | service | 🔴 **no licence document exists** | ⚠️ unstated |
| bgp.he.net | — | — | none; `robots.txt` returns "Forbidden" | ❌ dead end |

🔴 **RIPE RIS is prohibited in writing** ([terms](https://www.ripe.net/analyse/raw-data-sets/terms-conditions/)): *"Access to and use of the RIPE Data Repository and the Data for any commercial purposes, for example **selling the Data or services based on the Data, is not allowed**."* **"Services based on the Data" reads directly onto a fraud-scoring service. RouteViews does the same job under CC BY.**

⚠️ **Team Cymru has no ToS at all** — the full 130 KB page was searched: no licence, no AUP, no commercial grant, no prohibition. What exists is operational guidance: *"Free, forever… The only ask is that you use bulk mode or DNS at volume"* and *"IPs that hammer the whois server with large numbers of individual queries are **null routed**."* **Fine for spot checks, never on the hot path — a per-transaction lookup is exactly the pattern they steer away from, and the enforcement is null-routing your production egress with no contract to appeal to.**

**pyasn was built and benchmarked in-session:** MIT, **last release 1.6.2 (2023-09-01)**, **sdist only — needs `gcc` in the image**; `--latestv4` pulled an 83.6 MB RouteViews RIB today; converted 1.1M records in **35 s** → 1,124,979 IPv4 prefixes; DB **24.4 MB**, loads in 0.22 s; **902,604 lookups/sec (1.11 µs)**. **Stale, not dead** — it works end-to-end today; the risk is nobody fixing the C extension when CPython 3.14 breaks it. Pin and vendor it. ⚠️ `--single` on a route-views2 RIB gives **IPv4 only**.

🟢 **First-party cloud range files are the best free IP-risk data that exists** — authoritative, machine-readable, unencumbered, and the same data a vendor ingests. All verified live:

| Provider | URL | Size / count | Change detection |
|---|---|---|---|
| AWS | `ip-ranges.amazonaws.com/ip-ranges.json` | 2.61 MB — **10,543 IPv4 + 6,333 IPv6** | `syncToken`, `createDate`, `ETag`; SNS `AmazonIpSpaceChanged` (us-east-1) |
| GCP | `gstatic.com/ipranges/cloud.json` | 113 KB — 1,102 entries | `syncToken` |
| Google (all) | `gstatic.com/ipranges/goog.json` | 6.2 KB — 145 entries | same |
| Azure | GUID path (see below) | 4.32 MB — **3,321 tags, 95,623 prefixes** | `changeNumber`; **weekly** |
| Cloudflare | `/ips-v4`, `/ips-v6` | **15 IPv4 + 7 IPv6** | API `etag` |
| DigitalOcean | `digitalocean.com/geo/google.csv` | 52.9 KB — 1,228 rows | 🔴 **none — hash the body** |
| Oracle OCI | `docs.oracle.com/en-us/iaas/tools/public_ip_ranges.json` | 234 KB — 1,107 CIDRs | `last_updated_timestamp` |
| Linode/Akamai | `ipgeo.akamai.com/linode-geofeed.csv` | 193 KB — 5,508 lines | `# Last modified:`; daily 10:00 UTC |
| Vultr/Constant | `geofeed.constant.com/` | 21 KB — 502 lines | `# Last Updated:` |
| **Hetzner / OVH / Scaleway** | 🔴 **none exists** | — | ASN only |

**Per-provider gotchas that matter.** **AWS `service` is not a partition** — every prefix appears under `AMAZON` *and* a specific service; `EC2` alone is 1,874 IPv4 prefixes and is the subset closest to "customer-rentable compute". **BYOIP ranges are not in the file.** **Google: `goog` minus `cloud` is the important asymmetry** — `cloud.json` is GCP customer space (datacenter risk); the difference is Search, Gmail, YouTube, crawlers and `8.8.8.0/24` (**legitimate infrastructure you should not penalise**). 🔴 **Azure needs a scraper, not a URL constant** — the download page returns HTML without redirecting, and the real file sits under a **per-publication GUID directory whose GUID and date suffix both change weekly**; regex `https://download\.microsoft\.com/download/[^"]+ServiceTags_Public_\d{8}\.json`. The REST alternative needs an Azure subscription and *"takes up to four weeks for new Service Tag data to propagate."* 🔴 **Cloudflare — flag the misuse: those 22 prefixes mean "proxied through Cloudflare's edge," not "datacenter user." If your origin sits behind Cloudflare, 100% of your legitimate traffic arrives from them.** The correct use is the inverse: validate that `CF-Connecting-IP` came from a real edge before trusting it. **Hetzner announces from three ASNs** — AS24940 (96 prefixes), **AS213230 (391)**, **AS212317 (208)**; miss the latter two and you miss most of Hetzner Cloud. OVH AS16276 (763), Scaleway AS12876 (28), Vultr AS20473 (3,115), DigitalOcean AS14061 (887).

**No provider in this set publishes a feed-specific licence or restriction** — all are anonymous HTTP GETs. The only stated conditions: AWS asks you to verify the TLS certificate; Oracle asks you to poll no more than every 24 h and at least weekly. Everything else falls under general site terms — **written as "not published" rather than guessed.**

**Open ASN classifiers, honest quality assessment:**

| Source | Licence | Last commit | Entries | Verdict |
|---|---|---|---|---|
| **X4BNet/lists_vpn** | MIT (README only, **no LICENSE file**) | 2026-09-08 (bot, multiple/day) | **42,966** DC v4 CIDRs; **10,873** VPN v4 | 🟢 Best ready-made netset |
| ipverse/**as-ip-blocks** (renamed from `asn-ip` 2026-01-03) | **CC0-1.0** | daily | 86,582 ASNs / 1,419,058 prefixes | 🟢 Superb — but prefix data, **not a hosting classifier** |
| brianhama/bad-asn-list | MIT | 2026-04-12 (**5 months idle**, 13 open issues) | **742 ASNs** | 🔴 Hand-typed hobby CSV, ~1% of routed ASNs, rows literally labelled `Unknown` |
| Spamhaus DROP / ASN-DROP | see below | live | **437 ASNs**, 1,707 v4 CIDRs | 🟡 High precision, **wrong axis** |
| firehol/blocklist-ipsets | 🔴 **NONE** (`license: null`) | live | — | 🔴 Aggregates ~150 third-party lists under ~150 licences; also embeds a **plaintext MaxMind licence key** in README URLs. Keep out of the build |
| Umkus/ip-index | 🔴 **GPL-3.0** | **2025-12-20** | 4,582 DC ASNs | 🔴 README claims *"a daily build"* — **it is not.** Labels validated by manually spot-checking vendor screenshots, i.e. a laundered vendor derivative |

⚠️ **X4BNet's legacy root `ipv4.txt` is a trap** — byte-identical to the *datacenter* list and marked *"to be removed in 2026."* Use `output/vpn/ipv4.txt` and `output/datacenter/ipv4.txt` explicitly. Its README defines "datacenter" as *"Anything that is 'not an eyeball network' directly"* — deliberately catching corporate and business networks. **Score it, never block on it.**

🔴 **Spamhaus DROP: the two Spamhaus pages contradict each other.** The marketing page says *"The DROP list is free for any use"* and asks for credit; the [binding Terms](https://www.spamhaus.org/drop/terms/) that the JSON itself references say **§3.1** *"Nothing in these Terms shall be construed as granting an assignment or licence of any intellectual property rights in the DROP Lists"* and **§3.2** *"YOU MAY UNDER NO CIRCUMSTANCES USE… THE 'SPAMHAUS' NAME… IN YOUR MARKETING, PROMOTIONAL OR ANY OTHER COMMERCIAL MATERIALS."* **Free of charge for commercial use, yes; *licensed*, no — you hold a bare, revocable permission over data Spamhaus asserts copyright and database right in.** Safe posture: keep the `copyright`/`terms` fields shipped inside the JSON with the data, and never put "Powered by Spamhaus" on a pricing page. **Retirement check: ASN-DROP is NOT retired** (`/drop/asndrop.json` → 200, 437 records); only the *text format* was replaced. **EDROP genuinely is gone**, merged into DROP.

### 7c. 🔴 The honest gap: residential proxies are invisible to every open list

**There is no open dataset that detects residential proxy exits. Not a partial one, not a stale one, not a low-recall one. None exists.**

| Signal you'd want | Datacenter exit | **Residential proxy exit** |
|---|---|---|
| In a first-party cloud range file | ✅ | ❌ |
| ASN registered to a hosting provider | ✅ | ❌ (Comcast, Vodafone, Jio…) |
| Geofeed places it in a datacenter | ✅ | ❌ — places it in a suburb, **correctly** |
| Appears in an open blocklist | sometimes | ❌ |

**Every technique in §7b keys on infrastructure registration. The IP is not lying — the *session* is. That is a category error no amount of range-file coverage can fix.** Worse: with SDK-monetized exits, **the same IP simultaneously carries the device owner's genuine traffic and a stranger's proxied traffic**, so a binary per-IP verdict is wrong roughly half the time by construction.

**How the exits are sourced:** SDK monetization in free apps — [*Your Phone is My Proxy*, NDSS 2021](https://doi.org/10.14722/ndss.2021.24008) found *"4 proxy providers… offer app developers mobile proxy SDKs as a competitive app monetization channel, with $50K per month per 1M MAU"* across **1,701 APKs / 963 apps**; paid bandwidth-sharing (IPRoyal Pawns claims "20+ Million Users", Honeygain "12M+"); and outright botnet. Two studies complicate the "consenting user" framing: [*Resident Evil*, IEEE S&P 2019](https://doi.org/10.1109/SP.2019.00011) — *"despite the providers' claim that the proxy hosts are willingly joined, many proxies run on likely compromised hosts including IoT devices"*; and [CNSM 2024](https://doi.org/10.23919/CNSM62983.2024.10814519), which captured 368 GB over 7.5 months and found traffic *"used in practices not advertised by the RESIP providers."*

⚠️ **Published pool sizes are all self-reported marketing with no methodology** — Bright Data "400M+ **monthly** ethical residential IPs" (the headline drops the "monthly"), Oxylabs "175M+", SOAX **"155+ Million" on one page and "191 million" on another**, Decodo "115M+", IPRoyal "64M+". Sum ≈750–900M against ~3.7 bn routable IPv4. **Discount heavily — but even discounted, the pool dwarfs anything enumerable.**

**Law-enforcement figures, which are real:** [DOJ on 911 S5](https://www.justice.gov/archives/opa/pr/911-s5-botnet-dismantled-and-its-administrator-arrested-coordinated-international-operation) — **"more than 19 million" unique IPs, 613,841 in the US**, sourced via malware in free VPN apps, **"confirmed fraudulent loss exceeding $5.9 billion"**, and FBI Director Wray calling it *"likely the world's largest botnet ever."* Treasury's framing is the operative one: *"911 S5 essentially enables cybercriminals to conceal their originating location, **effectively defeating fraud detection systems**."* It rebranded as **Cloudrouter** in Oct 2023 ([IC3](https://www.ic3.gov/PSA/2024/PSA240529)). Successors moved from PCs to routers and IoT: Anyproxy/5socks (2025-05), **BADBOX 2.0** — TV boxes and car infotainment compromised *before purchase*, *"millions of infected devices"* ([IC3 2025-06-05](https://www.ic3.gov/PSA/2025/PSA250605)) — and [SocksEscort](https://www.justice.gov/usao-edca/pr/authorities-dismantle-global-malicious-proxy-service-deployed-malware-and-defrauded) (2026-03), which **sold about 369,000 IPs since 2020 to keep ~8,000 live**. 🟢 **That ratio is the lesson: churn is enormous, which is precisely why any static enumerated list decays to worthlessness within days.**

🔴 **Live finding: `netnut.io` is currently FBI-seized.** The site returns 200 with `<title>Seized by the Federal Bureau of Investigation</title>`, and **`dig netnut.io NS` returns `ns1.fbi.seized.gov.` / `ns2.fbi.seized.gov.`** — FBI-operated authoritative nameservers, not a defacement. Wayback narrows it to between 2026-07-02 and 2026-07-07. ⚠️ **No DOJ press release could be located; the seizure is a directly observed fact and no attribution of cause or charge is made here.** **Implication: do not hard-code vendor names or ranges — one of six named vendors vanished nine weeks ago.**

**Academic enumeration bounds the coverage argument:** the best-resourced attempt (*Resident Evil*) reached **6 million RESIP IPs** using a custom **active infiltration framework** — roughly **1.5% of one vendor's claimed monthly pool**, seven years ago; and [MADWeb 2024](https://doi.org/10.14722/madweb.2024.23035) found that of 640,600 proxies enumerated over 30 months, **only 34.5% were ever active.**

### 7d. VPN, GeoIP, and browser fingerprinting

**Providers that publish exit IPs — verified live:** 🟢 **Mullvad** (`api.mullvad.net/www/relays/all/`, 294 KB, no auth, `ipv4_addr_in` on **569/569**, plus `owned` and `provider` fields = free ASN ground truth; ToS has no scraping clause) · **NordVPN** (`api.nordvpn.com/v1/servers` — 🔴 **`limit` trap: bare endpoint returns 100 rows, `limit=0` returns 8,040. Anyone fetching the bare URL has 1.2% of Nord's footprint**) · IVPN (uniquely includes `isp` per gateway: M247, Leaseweb, Datapacket) · PIA (⚠️ **JSON on line 1 only, then a detached RSA signature — `json.loads(body)` fails**) · Windscribe · AirVPN. 🔴 **ProtonVPN requires auth in 2026** — no headers → `400`, valid current version → **`401`**; there is no unauthenticated public list. 🔴 **Surfshark publishes hostnames, not IPs, deliberately** — entry addresses are OpenSSL-encrypted blobs, and its [ToS §7](https://surfshark.com/terms-of-service) forbids *"web crawling, scraping, harvesting"*. **Leave both out.**

**Blunt scope: this covers ~10–15k IPs across seven cooperative providers.** It does not cover any provider treating its exit list as an anti-blocking asset, the obfuscated modes of the providers you just enumerated, or **any residential-proxy-backed service — which is what a motivated adversary in 2026 actually uses. Build it because it is free, precise and legally clean; never let anyone represent it as VPN coverage.**

**Heuristics — one is good, most are worse than folklore claims.** 🔴 **rDNS keyword matching is dead: tested against 14 live exit IPs pulled minutes earlier from the endpoints above, ZERO contained the string `vpn`** — and one **IVPN exit advertises itself as an ADSL line** (`37.120.206.53.adsl.inet-telecom.org`), so a `vpn|proxy|tor` regex scores it 0 and a "residential PTR ⇒ trustworthy" rule scores it *positively*. **Log the PTR for analysts; never let it move a score.** 🔴 **WebRTC local-IP leak is dead — tested, not assumed:** Chrome 152 against Google and Cloudflare STUN returned host candidate `6b1ce63f-….local` (mDNS) with `raddr 0.0.0.0`, and the srflx candidate `47.151.180.217` — **identical to what `fetch('https://api.ipify.org')` returned in the same page.** Per [RFC 8828](https://datatracker.ietf.org/doc/rfc8828/) Mode 3, private addresses *"MUST NOT be provided."* **Anyone selling you on this is quoting 2015.** 🟢 One narrow ~20-line exception survives: **compare the srflx (UDP) address against the HTTP source IP (TCP)** — they diverge when a browser-extension "VPN" proxies TCP but leaves UDP unproxied (a competent one sets `disable_non_proxied_udp`, a lazy one does not). High precision, very low recall. 🔴 **p0f will not work at all behind a CDN** — it fingerprints the SYN's TCP/IP header, which is a property of **whichever kernel terminated the connection**; Cloudflare, ALB, GCLB and nginx all terminate, so **you would fingerprint your own load balancer identically on every request.** `X-Forwarded-For` carries the client IP forward and carries nothing about its TCP stack. (For scale: [*OpenVPN is Open to VPN Fingerprinting*, USENIX Sec '22](https://www.usenix.org/system/files/sec22-xue-diwen.pdf) identifies *"over 85% of OpenVPN flows with only negligible false positives"* — **from a vantage point "in partnership with a million-user ISP."** Not available to a web application.) 🟢 **Timezone-vs-IP-country is the best browser-side signal here** — consumer VPN clients change your *route*, not your *system clock*. ⚠️ **Bucket `UTC` separately**: Firefox with `privacy.resistFingerprinting` forces UTC ([Bugzilla 1330890](https://bugzilla.mozilla.org/show_bug.cgi?id=1330890)) but **RFP is off by default** (`JSDateTimeUTC` is absent from `RFPTargetsDefault.inc`), so a bare `UTC` reading is ambiguous between server, corporate SOE, Tor Browser and a deliberate flip. Anti-detect browsers sell timezone-matched-to-proxy as a headline feature — **which is still useful: it separates casual from determined.**

🔴 **JA3/JA4 — the common belief is inverted, and the inversion matters.** **JA4 proper (TLS client fingerprinting) is [BSD 3-Clause](https://github.com/FoxIO-LLC/ja4/blob/main/LICENSE-JA4)**, and the [FAQ](https://github.com/FoxIO-LLC/ja4/blob/main/License%20FAQ.md) states *"FoxIO does not have patent claims and is not planning to pursue patent coverage for JA4 TLS Client Fingerprinting."* **JA4+ (JA4S, JA4H, JA4L, JA4T, JA4SSH…) is FoxIO License 1.1, non-commercial, patent pending**, and the FAQ draws a line that lands on a retailer's fraud engine: *"If, for example, a company uses JA4+ to provide value to paying customers, even without exposing JA4+ fingerprints directly to those customers, that company would still need an OEM license."* **Plain JA4 is unambiguously safe; anything with a suffix needs legal sign-off. Unlike p0f, TLS fingerprinting survives a CDN** — the ClientHello is client-generated application-layer payload.

**GeoIP without MaxMind — vendors vs open data, clearly separated:**

| Source | Licence | **Commercial?** |
|---|---|---|
| 🔴 **MaxMind GeoLite2** | proprietary EULA (updated 2026-02-12) | ⚠️ **Avoid.** §5: *"you will not use… the GeoLite Data for the purpose of identifying or locating a specific household, individual, or street address"* — an engine scoring IP-vs-delivery-address walks at that. §6 requires **notice + written consent before disclosing to a third party** (shipping the `.mmdb` in an image handed outside the company) and requires you to **"cease use of and destroy… any old versions within thirty (30) days"** — **a DB pinned into an image violates this by design after 30 days.** Also 30 downloads/day, and no FCRA purposes |
| **DB-IP Lite** ⭐ | **CC BY 4.0** | 🟢 Yes — no account, no token, direct HTTPS, no ShareAlike. Best-behaved vendor freebie |
| IPinfo Lite | CC BY-SA 4.0 | 🟡 Real grant, but 7 fields only and a token IPinfo can revoke — **a vendor funnel, not open data** |
| IP2Location LITE | ⚠️ **No CC identifier was verifiable** from the site or terms | ⚠️ **Get the licence text from the download bundle in writing** |
| ip-api.com free | *"strictly limited for a non-commercial purpose"* | ❌ Disqualified |
| **RIR delegated-extended files** | ⚠️ see below | 🟡 Country only |
| **iptoasn.com** ⭐ | **PDDL public domain** | 🟢 **Unambiguous** |

All five RIR files verified live (RIPE 18.1 MB, ARIN 12.8 MB, APNIC 9.2 MB, LACNIC 4.6 MB, AFRINIC 0.99 MB; NRO combined 56.7 MB, 269,937 IPv4 records). ⚠️ **Correction: these are NOT "fully open with no restrictions."** No RIR publishes an open-data licence on them, and two publish text reading *against* commercial use — RIPE's [copyright statement](https://www.ripe.net/about-us/legal/copyright-statement/) grants use *"for private purposes, for public non-commercial purpose, for research, for educational or demonstration purposes"* and says *"Any use… for advertising or marketing purposes is strictly forbidden"*; ARIN links its stats to the Whois TOU prohibiting use *"as part of a commercial service or product."* **Universally treated as public and nobody will chase a retailer for counting IPv4 ranges — but if this engine is a compliance artefact, record the finding rather than asserting public domain. iptoasn.com is the clean substitute.** Also note the country field means *"ISO 2-letter country code of the organization to which the allocation was made"* — **registration, not use**; RIPE uses non-ISO `EU`/`AP`/`UK` for multi-country allocations. **Published accuracy of RIR-file country mapping: not published.**

🟢 **Country-level is sufficient for a California cannabis delivery business, and the argument is four-part.** (1) **IP geo is not doing identity work and cannot** — you already hold a delivery address you will physically drive to, a licence, and a human door check that is legally the last gate. (2) **The city tier's own vendors disclaim it** — MaxMind's published figure is **66% for US cities within 50 km** (and that is for the *paid* products; no GeoLite-specific number is published); a 50 km radius in Southern California spans your whole service area and is wrong a third of the time; and MaxMind's EULA §5 **contractually forbids** the household inference city-level would buy. (3) **State-level is the weakest link at ~80%** — one in five California customers geolocating to Nevada or Arizona generates a false out-of-state flag, producing a review queue nobody staffs, which gets auto-approved, which is worse than not having the signal. (4) 🔴 **Mobile carriers break the city tier structurally, and your customers are on mobile** — CGNAT egress resolves to the carrier's regional aggregation point, not the handset. **Country survives it; city does not.** The three defensible checks are **non-US session (country)**, **impossible travel (country/ASN — a *relative* comparison where absolute accuracy barely matters)**, and **hosting/VPN egress (ASN, not geo — the highest-value IP-derived signal, free under PDDL, needing no city data at all).**

**Zero-dependency implementation, measured** (Python 3.9.6, 400k ranges): `array('I')` uint32 = **4 bytes/entry, 1.6 MB at 400k**, `bisect` lookup **0.49 µs** — vs a Python `list` at ~36 bytes/entry and 0.81 µs. **The whole global IPv4 delegated table (~270k rows) is a ~1.1 MB `array('I')` plus a parallel country array, resolving in under a microsecond in pure stdlib.** That turns "which vendor's terms are we exposed to?" into a question that does not exist.

🔴 **Correction: FingerprintJS is MIT, and always has been.** Verified four ways — `master/LICENSE`, the **v3 branch `LICENSE`**, `package.json` (`"license": "MIT"`, `"version": "5.2.0"`), and the README. **There are no restrictive clauses to quote because there are none; commercial closed-source use is permitted with no fee and no copyleft.** Keep the notice in your bundle. **Note the repo is at v5, not v3/v4.** Its own comparison page publishes **Pro** accuracy (99.5% @30 days, 98.015% @120 days) and **no accuracy for OSS**, rating OSS collisions "Common" and stability at **"Several weeks"** — *that* is the number that should drive your design. Permissive alternatives: ThumbmarkJS (MIT), ClientJS (Apache-2.0, adds an express patent grant).

**Entropy grounding — use the 2018 numbers, not the 2010 ones.** [Laperdrix survey](https://arxiv.org/pdf/1905.01051) Table 3 (N=2,067,942): plugins 9.485 bits · **canvas 8.546** · UA 7.150 · fonts 6.904 · **WebGL renderer 5.541** · screen+depth 4.847 · **timezone 0.164**. 🔴 **Timezone measured 0.164 bits in a single-country dataset — for a California customer base it is worth approximately nothing as entropy, and is useful only as a contradiction detector.** And uniqueness: Eckersley 2010 measured **83.6%** on a privacy-aware audience, but **[Gómez-Boix et al., WWW 2018](https://doi.org/10.1145/3178876.3186097) measured 35.7% desktop / 18.5% mobile on a commercial site** — *"a more global audience."* **Your population is commercial, mobile-heavy, single-timezone and single-state, i.e. structurally closer to the 2018 figures and *more* homogeneous. Plan for ~1-in-3 desktop uniqueness and worse on mobile, not the 90%+ figures vendors quote.**

**Corrections to the current state, all verified:** ⚠️ **Chrome's UA reduction is COMPLETE, not pending** — phases 4–7 finished at Chrome 113; desktop macOS is permanently `Macintosh; Intel Mac OS X 10_15_7`, Android permanently `Linux; Android 10; K`, and *"they will not update even if a user is on an updated operating system."* **You cannot read real macOS version, Android version or device model from the UA.** UA-CH `getHighEntropyValues` restores it — **Chromium-only, permanently (Firefox NO, Safari NO)**, which splits your traffic. ⚠️ **`WEBGL_debug_renderer_info` has NOT been removed anywhere** — MDN reports **Baseline widely available since April 2017**; the only verified restriction is Firefox's non-default RFP. ⚠️ **Safari does not show a canvas permission prompt** — that is Tor Browser / Firefox RFP; what Safari 17 verifiably does is add *"noise to fingerprintable web APIs"* **in Private Browsing**. **Battery Status is dead** (Firefox added 43, removed 52; Safari never shipped). **Font enumeration is degraded**: `queryLocalFonts` is Chrome-only with a permission prompt (**a font prompt on an ID-capture page is a conversion disaster**), and WebKit restricts at the source to *"web fonts and fonts that come with the operating system, but not locally user-installed fonts."* 🟢 **WebGPU `GPUAdapterInfo` is the one genuinely new 2026 signal** — Chrome 144, **Firefox 141, Safari 26** — now cross-engine, which WebGL renderer info effectively never was on Safari.

🟢 **`enumerateDevices()` is your single best structural advantage** — without permission the entries have empty `label`; **after `getUserMedia` permission the labels populate with exact camera and microphone model strings.** Because your page performs an ID/selfie capture, **you will hold camera permission** — unlocking a strong hardware discriminator that most fingerprinting scripts never see, **and one FingerprintJS OSS does not collect at all.** (Firefox RFP reports one generic camera.)

🔴 **Storage is a convenience signal, never a fraud control.** Safari ITP *"deletes all cookies created in JavaScript and all other script-writeable storage after 7 days of no user interaction"* — **for a delivery customer who orders monthly, your first-party ID is gone every single time.** (Third-party cookies: Google [confirmed on 2025-04-22](https://privacysandbox.google.com/blog/privacy-sandbox-next-steps) it *"will not be rolling out a new standalone prompt"* — irrelevant here, you are first-party.)

**What breaks a fingerprint, in order of how often it bites:** browser update (~4 weeks, everyone) · clearing site data / private window · **Safari ITP every 7 idle days** · OS update · GPU driver update · **laptop docking changing `screen.*` daily**. 🔴 **The correct design is fuzzy per-attribute matching with weights and an explicit upgrade heuristic — never equality on a single hash.** Eckersley measured exactly this: *"fingerprints changed quite rapidly, but even a simple heuristic was usually able to guess when a fingerprint was an 'upgrade'."* **A hash comparison shows you a stranger every time Chrome ships.**

🔴 **Anti-detect browsers defeat all of this, and the entry price is $0.** Dolphin Anty's **free tier is 5 profiles** and it advertises *"WebGL, WebGPU, ClientHints, and Voices spoofing"* — **the two newest signals in the table above, already covered** — plus **webcam parameter replacement, which targets your best signal.** Incogniton ($19.99/mo) advertises *"Real device fingerprints"* and explicitly sells **passing Pixelscan, BrowserLeaks and BrowserScan**. GoLogin *"automatically configures 53 fingerprint parameters."* Multilogin bundles matched residential proxies. 🟢 **What survives is *inconsistency*, not identity** — a stitched profile leaves contradictions: UA claiming macOS while WebGL reports a Windows driver string, `platformVersion` disagreeing with the font/voice set, `maxTouchPoints > 0` on a desktop UA, camera labels not matching the claimed device class. **That is a far better use of engineering time than chasing raw entropy.**

⚠️ **Privacy (not legal advice).** A fingerprint is PI under [Cal. Civ. Code §1798.140](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1798.140): §(aj) enumerates *"a device identifier; an Internet Protocol address; cookies, beacons, pixel tags…"*, and §(x) defines a **probabilistic identifier** — *"identification of a consumer or a consumer's device to a degree of certainty of more probable than not"* — which reads as though drafted for this technique. **Treat it as PI from day one and disclose at or before collection on the capture page.** On ADMT: the CPPA package was OAL-approved **2025-09-23**, effective **2026-01-01**, with **ADMT significant-decision requirements from 2027-01-01** — and *"significant decision"* is a **closed list** (*"financial or lending services, housing, education… employment… or healthcare services"*). **Denying a retail cannabis order is not on that list.** 🔴 **Three things would change that:** "financial or lending services" is defined to include **installment payment plans**, so **a BNPL integration puts you squarely inside — flag it to counsel before, not after**; §7221(b)(1) gives an exception where you provide *"a method to appeal the decision to a human reviewer who has the authority to overturn the decision"* (**build that path anyway** — cheap, good service, and insurance); and **risk assessments are a separate obligation that started 2026-01-01.**

### 7e. Velocity and behavioural signals — the highest-value thing you can build

**These are different in kind from everything above.** They need no external data, no licence, no feed that can go stale silently, and no supplier that can be seized by the FBI. **And they are not defeated by the two countermeasures that defeat everything else** — Dolphin Anty can spoof a canvas hash and a residential proxy can supply a clean IP, but **neither can make the same face enrol under two names, nor generate a plausible ordering history at your store. The adversary's countermeasures are aimed at the wrong layer.**

| # | Signal | Catches | Survives §7c/§7d countermeasures? |
|---|---|---|---|
| 1 | **Same face embedding under different identities (1:N)** | Synthetic identities, ID sharing, promo/limit farming | 🟢 **Yes — nothing in §7 touches it. Strongest single control you will build** |
| 2 | Same device fingerprint across identities | Account farming | Defeated by anti-detect — **but only by users who have one** |
| 3 | Same IP across many identities in a short window | Fraud rings | Defeated by rotation — **but rotation costs money and most abuse is unfunded** |
| 4 | **Retry-after-failure patterns** | Iterating until an ID passes | 🟢 **Immune — purely temporal and account-local** |
| 5 | **Capture-attempt counts per session** | Deepfake / printed-ID / replay probing | 🟢 **Immune.** Doubles as a product-quality metric |
| 6 | **ID document number reused across accounts** | The most direct fraud signal you have | 🟢 **Immune** |
| 7 | ASN-hopping within a session | Proxy rotation mid-flow | One of the few residential-proxy-*adjacent* signals available |
| 8 | Impossible travel | Shared/compromised credentials | Country-tier geo suffices |

**Two tables carry all of this.** `verification_attempt` — **one row per capture *attempt*, not per successful verification (the failures are the signal)** — with ip/asn/country/tor/datacenter flags, `device_fp_hash` **plus raw components for fuzzy re-match**, `tz_mismatch`, `capture_type`, `attempt_ordinal_in_session`, `outcome`, `duration_ms`. And `identity_link` — one row per `(entity_kind, entity_value, account_id)` with first/last seen, where `entity_kind ∈ {face_cluster, device_fp, ip, id_number, phone, address_norm}`. 🟢 **Every velocity question then becomes one indexed query — "how many distinct `account_id` share this `entity_value`?" — which answers signals #1, #2, #3 and #6 at once.**

**Build rules drawn from this estate's own failure history:** batch counter writes (one `setValues` per column, never per-cell in a loop); take the script lock **briefly to claim an expiring lease**, then run the long dedupe pass unlocked; **checkpoint the 1:N rebuild and do the destructive swap last — populate-then-swap, never clear-then-repopulate**, because a rebuild that times out mid-loop leaves you permanently half-enrolled and **nothing throws**; and **monitor the output, not just the exception** — alarm on the `distinct_accounts_per_face_cluster` distribution and on counter staleness, because a dedupe job that quietly stops linking sends no email.

**What this does not do:** it does not catch a **first-time** fraudster on a clean residential IP with a genuine-looking ID and a face never seen before. **Nothing in this report catches that — not a vendor either.** For that case the controls are the document itself, liveness, and the human at the door that the DCC already requires. **Scope it honestly in the design doc: velocity is a repeat-abuse and ring-detection control.**

---

## 8. Capability 8 — image quality

**Do this before anything else.** Two facts frame it: Yoti's own analysis shows the *same* model scoring **MAE 1.1 yr on mobile captures vs 2.63 yr on visa images — a 2.4× spread from capture conditions alone**; and NIST reports **failure-to-process ≈ 0.000**, meaning every model in this document *"will operate on any array of input pixels regardless of their semantic content."* **Quality gating is worth more accuracy than any model choice here, and it is the only thing preventing garbage-in-confidence-out. It also carries no biometric-privacy exposure — a sharpness score is not a scan of face geometry.**

### 8a. Metrics and their real thresholds

**Blur.** Origin: Pech-Pacheco et al., *"Diatom autofocusing in brightfield microscopy"*, ICPR 2000 ([doi:10.1109/ICPR.2000.903548](https://doi.org/10.1109/icpr.2000.903548)). 🔴 **The "100" threshold is not from that paper — it is `default=100.0` in a [PyImageSearch argparse call](https://pyimagesearch.com/2015/09/07/blur-detection-with-opencv/), and the same article says so:** *"It's important to note that you'll likely have to tune this value for your own dataset of images. A value of 100 seemed to work well for my dataset, but this value is quite subjective to the contents of the image(s)."* **It is not a universal constant** — variance-of-Laplacian is an *absolute energy* measure that rises with resolution, edge density and contrast and falls with JPEG smoothing, so a 4K photo and a 240p webcam frame of the same scene give wildly different values.

🟢 **The fix comes from the ISO reference implementation: crop to the landmarked face region and rescale so the longer side is exactly 250 px before computing any sharpness feature** (OFIQ §6.6.2.1 step 3). Normalise first, then a threshold means something. **[ESTIMATE] you must still re-derive the cut-off on your own capture hardware; no published number transfers.** Note OFIQ's own sharpness feature uses **Gaussian 3×3 → Laplacian ksize=1 → mean of absolute values** over the landmarked region (not variance), fed to a random forest — and its Tenengrad variant uses isotropic Sobel `dx=1,dy=1` at ksize ∈ {1,3,5,7,9}, taking mean **and** std = 10 features. Alternatives: FFT high-frequency energy; **BRISQUE** — ✅ `cv2.quality.QualityBRISQUE` confirmed present with Python bindings, but 🔴 **it needs two model files** (`brisque_model_live.yml`, `brisque_range_live.yml`) from `opencv_contrib/modules/quality/samples/`; pure-Python fallbacks `brisque` 0.2.0 / `image-quality` 1.2.7 are Apache-2.0. 🔴 **CPBD is a blocker: `pip install cpbd` exists but its PyPI classifier is `License :: Other/Proprietary License` — not an OSI licence.**

**Glare.** 🔴 **There is no glare or specular measure in ISO/IEC 29794-5** — verified two ways: OFIQ's 30-entry `QualityMeasure` enum contains nothing for specularity, and the word "glare" appears **zero times** in the 188-page OFIQ report. Specular reflection appears only as an *occlusion* rule (transparent lenses are not occlusion *"except strong specular reflections"*). **The one genuinely published number is ICAO's** ([TR Portrait Quality v1.0](https://web.archive.org/web/20200620085450if_/https://www.icao.int/Security/FAL/TRIP/Documents/TR%20-%20Portrait%20Quality%20v1.0.pdf)): *"Lighting artefacts shall not be larger than **15% of the area of the iris**"*, and Clause 6.3 — ⚠️ **written for printed portraits, not live digital capture** — *"the number of fully saturated 0 value pixels shall be less than 0.1%, and the number of fully saturated 255 value pixels shall be less than 0.1%."* **Any saturated-pixel threshold applied to a selfie is practitioner convention, not published.**

**Luminance / exposure.** ⚠️ **Neither OFIQ nor ICAO uses HSV V — that is a practitioner shortcut.** OFIQ computes on a luminance image of the *aligned, landmark-masked* face. From `ofiq_structs.h` + `ofiq_config.jaxn`: `UnderExposurePrevention` = **fraction of masked pixels with luminance in [0, 25]**; `OverExposurePrevention` = **fraction in [247, 255]**, scalar `clip(round(1/(raw+0.01)),0,100)` (raw 0.09 → 10); `DynamicRange` = **Shannon entropy of the 256-bin histogram**, scalar `clip(round(12.5 × entropy),0,100)` (8 bits → 100); `LuminanceMean` passes roughly **0.2–0.8 of full scale**. ICAO Clause 5.2.8 recommends *"at least 50% of intensity variation in the facial region."*

**Face size — ⚠️ the commonly-cited numbers get mapped to the wrong categories.** Verified from ICAO TR Portrait Quality v1.0 Table 5 and Table 11:

| Use case | Requirement | Best practice |
|---|---|---|
| Live capture / scanned / electronic submission | **IED ≥ 90 px** | **IED ≥ 240 px** |
| **MRTD chip storage** (Table 11) | **IED ≥ 90 px** | **IED ≥ 120 px** |

🔴 **90 px is the floor in *every* use case, not a "token image" figure; 120 px is best practice for the chip-stored image only; 240 px is best practice for capture.** ⚠️ **The word "Token" appears nowhere in the ICAO TR (0 hits)** — token-image is ISO/IEC 19794-5 terminology and its pixel requirement is **unverified (paywalled)**. Definition worth copying: *"Inter Eye Distance IED: length of the line connecting the eye centres"*, where *"Eye centre: centre of the line connecting the inner and the outer corner of the eye"* — **explicitly not the pupil centre.** OFIQ normalises with a sigmoid (`x0=70.0, w=20.0` → quality 50 at 70 px, saturating above ~130 px) and corrects raw IED for yaw first.

**Head pose — ±5° is right for yaw/pitch and *wrong* for roll.** ICAO Table 8, verbatim: *"The pitch of the head shall be less than ± 5° from frontal. The yaw of the head shall be less than ± 5° from frontal. **The roll of the head shall be less than ± 8°**, it is recommended to keep it below ± 5°."* Children ≤6 yrs get ±15° on all three. ⚠️ ISO/IEC 19794-5 itself is paywalled; the ICAO TR states it *"is based on ISO/IEC 19794-5:2005 and ISO/IEC 19794-5:2011 as well as on Doc 9303 statements."* **OFIQ imposes no hard gate at all** — `scalar = round(100·max(0,cos θ)²)` → 99 at 5°, 98 at 8°, 88 at 20°.

### 8b. 🟢 ISO/IEC 29794-5 and OFIQ — the most important item here

**ISO/IEC 29794-5:2025 is a published International Standard, valid from 2025-04-16** ([ISO catalogue 81005](https://web.archive.org/web/20260404065940/https://www.iso.org/standard/81005.html)), superseding the 2010 Technical Report. ⚠️ BSI's own page still says "FDIS (October 2024)" — **stale**. The normative text costs €272.12.

**[OFIQ](https://github.com/BSI-OFIQ/OFIQ-Project) is its open reference implementation, from the German Federal Office for Information Security.** 🟢 **Code is MIT.** 🔴 **The weights are not:** `LICENSE.md` says model files are *"downloaded from ISO portal"* and *"**Licensed separately** with documentation provided in sub-directories after download"*, and `BUILD.md` confirms they are fetched **during the build process**. **This is the single biggest gotcha for a reproducible Docker build — it reaches out to the ISO portal for weights under a licence nobody has read. Vendor them into a layer and have someone read the terms before shipping.**

It computes **30 measures** (from `ofiq_structs.h`): `UnifiedQualityScore`; capture — `BackgroundUniformity`, `IlluminationUniformity`, `LuminanceMean/Variance`, `Under/OverExposurePrevention`, `DynamicRange`, `Sharpness`, `CompressionArtifacts`, `NaturalColour`, `SingleFacePresent`; subject — `EyesOpen`, `MouthClosed`, `EyesVisible`, `Mouth/FaceOcclusionPrevention`, `ExpressionNeutrality`, `NoHeadCoverings`; geometry — `InterEyeDistance`, `HeadSize`, crop/margin measures, `HeadPoseYaw/Pitch/Roll`. Each returns `{rawScore, scalar ∈ [0,100] (−1 = failure), returnCode}`.

🟢 **Python bindings exist — but not on PyPI.** Version **1.2.0 (2026-03-03)** added a C interface and a **ctypes** wrapper; install is `pip install ./install_x86_64_linux/Release/ofiq-1.2.0-py3-none-any.whl`, **a wheel you build yourself** (`pypi.org/pypi/ofiq/json` → 404). API: `scalar_quality()`, `vector_quality()`, `vector_quality_ext()` on NumPy uint8 arrays, with `_ext` also returning landmarks and occlusion masks. Package deps `opencv-python >=4.5.5,<5`, `numpy <2.0.0`.

**[ESTIMATE] Dockerising is moderate, not trivial.** 🟢 It is **CPU-only by design** (ONNX Runtime CPU EP, no CUDA), verified on Ubuntu 22.04/24.04 x86_64 **and ARM64 including Raspberry Pi**. Three pain points: `conan ==2.18.1` (pinned exactly) **builds OpenCV 4.5.5 from source** — long first build, so multi-stage and cache `~/.conan2`; the **build-time weight download breaks hermetic builds**; and the Python wheel is *produced by* the C++ build, so you cannot `pip install` around the toolchain. Runtime footprint is small: `libofiq_lib.so` + `libonnxruntime.so.1.18.1` + `data/models`. 🔴 **No Dockerfile in the repo; "Docker" appears 0 times in the 188-page report.**

**Why OFIQ wins on licence, not just pedigree:** 🔴 **SER-FIQ is CC BY-NC-SA 4.0** and 🔴 **CR-FIQA is CC BY-NC 4.0** (both Fraunhofer IGD, both non-commercial); 🔴 **FaceQnet has no licence file or statement** (= all rights reserved). 🟢 **MagFace is Apache-2.0** — and it is what OFIQ's unified score is built on. NIST **NFIQ 2** (US public domain) is the identical institutional pattern one modality over: *"formally recognized as a reference implementation of the normative ISO/IEC 29794-4."* **That institutional backing is worth more than any accuracy claim — it is the artefact you show a regulator. There is no independent Python reimplementation of 29794-5.**

🔴 **Document image quality: there is no standard.** Published parts of ISO/IEC 29794 are -1:2024 (framework), -4:2024 (finger), **-5:2025 (face)**, -6:2015 (iris). **No part addresses ID-document or driver-licence captures**; the series is scoped to *biometric sample* quality by modality. ICAO Clause 6 covers *printed* portrait quality — the photo pasted on the document, not a phone photo *of* a licence. **For the document side you are inventing your own metrics.** Reuse the face primitives (normalised Laplacian/Sobel, saturated-pixel fraction, histogram entropy) plus perspective/corner detection — and 🟢 **use MRZ or PDF417 decode success as the ground-truth quality oracle**: it is a free, unambiguous label, because if the barcode decodes the capture was good enough. **Do not claim standards conformance for that half; there is no standard to conform to.**

---

## 9. Capability 9 — runtime, packaging, Docker

All figures below were pulled from the [PyPI JSON API](https://pypi.org/pypi/onnxruntime/json) and Docker Hub on 2026-09-08.

### 9a. Wheel reality — the four findings that decide the stack

| Package | Latest | `requires_python` | linux x86_64 | **linux aarch64** | mac arm64 |
|---|---|---|---|---|---|
| **onnxruntime** | 1.29.0 | **>=3.11** | 22.0 MB | ✅ 19.8 MB | ✅ 20.4 MB |
| opencv-python-headless | **pin 4.12.0.88** | >=3.6 | 51.5 MB (`cp37-abi3`) | ✅ 31.6 MB | ✅ 36.1 MB |
| numpy | 2.5.3 (**>=3.12**) — **latest for 3.11 is 2.4.6** | — | ~16 MB | ✅ | ✅ |
| scipy | 1.18.1 (**>=3.12**) — **latest for 3.11 is 1.17.1** | — | ~33.7 MB | ✅ | ✅ |
| Pillow | 12.3.0 | >=3.10 | 6.6 MB | ✅ 6.0 MB | ✅ 4.6 MB |
| **zxing-cpp** | 3.1.1 | >=3.9 | **1.1 MB** | ✅ 1.0 MB | ✅ 0.8 MB |
| **mediapipe** | 1.0.1 | none declared (**`py3-none` platform wheels**) | 37.9 MB | ✅ **35.8 MB** | ✅ 33.7 MB |
| **insightface** | **2.0** | >=3.10 | **`py3-none-any` 1.1 MB** | ✅ | ✅ |
| **paddlepaddle** | 3.3.1 | none | 185.8 MB | 🔴 **NONE** | 99.7 MB |
| paddleocr | 3.7.0 | >=3.8 | py3-none-any 0.1 MB | ✅ | ✅ |
| rapidocr-onnxruntime | 1.4.4 (legacy) | **<3.13,>=3.6** | py3-none-any **14.2 MB** | ✅ | ✅ |
| **torch** | 2.14.0 | >=3.10 | 🔴 **528.9 MB** | 🔴 433.0 MB | 121.4 MB |
| torchvision | 0.29.0 | >=3.10 | 7.1 MB | ✅ | ✅ |
| faiss-cpu | 1.15.0 | >=3.10 | 17.9 MB (`cp310-abi3`) | ✅ **9.4 MB** | ✅ 4.7 MB |
| sqlite-vec | **0.1.9** | none | 0.2 MB | ✅ 0.2 MB | ✅ |
| **dlib** | 20.0.1 | none | 🔴 **sdist only (3.2 MB) — needs CMake + C++ toolchain** | 🔴 builds | 🔴 builds |
| deepface | 0.0.100 | >=3.7 | py3-none-any | ✅ | ✅ |
| pyzbar | 0.1.9 | none | py2.py3-none-any (needs `libzbar0`) | ✅ | ✅ |

🔴 **Four findings:**
1. **paddlepaddle has no Linux aarch64 wheel.** Confirmed at 3.3.1. **This alone decides OCR if Graviton is on the roadmap.**
2. **`onnxruntime` 1.29.0 requires Python ≥3.11**, which sets the floor for the whole stack.
3. **opencv-python-headless 5.0.0.93 currently ships sdist only** (78 MB `.tar.gz`, no wheels). **Pin 4.12.0.88**, which has proper `cp37-abi3` wheels for both architectures.
4. 🟢 **`insightface` 2.0 is now a `py3-none-any` wheel** — the notorious Cython/compiler build is gone. (Irrelevant given §3a's licence, but worth knowing the packaging folklore is stale.)

⚠️ **Dependency-tree traps, read from PyPI metadata:** `deepface` declares **`tensorflow>=1.9.0` + `keras`** — enormous, and disqualifying for a CPU-only image. `mediapipe` pulls **`opencv-contrib-python` (not headless), `matplotlib`, and `sounddevice`** (needs PortAudio). `insightface` pulls **`opencv-python` (not headless), `scipy`, `scikit-image`, `onnx`**. `rapidocr-onnxruntime` pulls **`opencv-python` (not headless), Shapely, pyclipper** and **does not declare `onnxruntime`**. 🟢 **`zxing-cpp` declares no dependencies at all.** Plan an explicit `opencv-python-headless` pin plus constraint pins to stop the non-headless variants being dragged in.

⚠️ **`torch` from plain PyPI is 528.9 MB and pulls several GB of `nvidia-*` CUDA packages.** Use `--index-url https://download.pytorch.org/whl/cpu` (the CPU wheel is **192.3 MB**).

### 9b. Python version

**Pin Python 3.11.** It is the highest floor anything imposes (`onnxruntime` ≥3.11, `python-doctr` ≥3.11) and it clears everything else. The cost is being one minor behind on numeric libraries — **latest numpy for 3.11 is 2.4.6 and latest scipy is 1.17.1**, because both now require ≥3.12. 3.12 also works if you drop `rapidocr-onnxruntime` (legacy, `<3.13`) in favour of `rapidocr` 3.x, and mediapipe 1.0.1 declares 3.9–3.12 with **no 3.13**.

### 9c. Docker size — the arithmetic

**Base:** `python:3.11-slim-bookworm` = **45.6 MB compressed amd64 / 45.2 MB arm64** (Docker Hub API). **[ESTIMATE] ~120–130 MB uncompressed** at the ~2.7× ratio typical for slim images. Both architectures are published.

**Model weights:** insightface buffalo_l **341 MB** full / **192 MB** for det_10g + w600k_r50 + genderage · RapidOCR PP-OCRv6 **31.8 MB** (bundled in the wheel) · `face_landmarker.task` **3.76 MB** · MiniFASNet **1.76 MB** (×2 for the DeepFace ensemble) · YuNet **232,589 B** · SFace **38.7 MB** · dlib recogniser 21.4 MB.

**[ESTIMATE], stating the assumption: installed size runs ~1.5–3× the wheel for binary-heavy packages, since wheels are zip-compressed.**

| Configuration | Wheels | ×2 installed **[ESTIMATE]** | + base | + models | **Total uncompressed [ESTIMATE]** |
|---|---|---|---|---|---|
| 🟢 **(a) Lean, onnxruntime-only** — onnxruntime + opencv-headless 4.12 + numpy + Pillow + zxing-cpp + rapidocr + mediapipe, running ONNX face models directly | ~22 + 51.5 + 16 + 6.6 + 1.1 + 14.2 + 37.9 ≈ **149 MB** | ~300 MB | ~430 MB | + ~80 MB (ONNX face + OCR + landmarker, **no buffalo_l**) | **≈ 500–550 MB** |
| 🔴 **(b) Kitchen sink** — torch CPU + paddlepaddle + paddleocr + insightface + deepface + easyocr | 192 (torch cpu) + 185.8 + 51.5 + 16 + 33.7 + ~20 ≈ **500 MB**, plus TensorFlow via deepface | ~1.0–1.3 GB | ~1.15 GB | + ~450 MB | **≈ 2.5–3.5 GB** |

**The lean image is ~5× smaller and drops the two heaviest, least-portable dependencies (torch and paddlepaddle) entirely.**

**Render:** compute plans run from `free` (0.1 CPU / 512 MB) through `1c-2g`, `2c-4g`, `2c-8g` and up ([compute plans](https://render.com/docs/compute-plans)). 🔴 **Render's documented image-size limit, build-time limit, and arm64 instance support: not published** — neither `/docs/docker` nor `/docs/compute-plans` states a CPU architecture or a size cap. Render's build-pipeline material describes Linux **x86_64**; **treat arm64 on Render as unavailable until confirmed, and design the Dockerfile multi-arch so the AWS move is a rebuild, not a rewrite.**

### 9d. RAM, CPU architecture, and throughput

**[ESTIMATE] resident memory** = model file sizes + activation buffers + the ONNX Runtime arena. For configuration (a) with SCRFD/YuNet + a recogniser + genderage + MiniFASNet + PP-OCR det/rec + mediapipe loaded concurrently: **~250–400 MB of weights, plus ~150–300 MB of arena and activations, plus ~100 MB of Python and numpy ≈ 500–800 MB steady state.** 🟢 **Pin `intra_op_num_threads` on small instances** — ONNX Runtime's default thread pool sizes to the *host* core count, not the container's CPU limit, and its arena grows to the high-water mark and does not shrink. **Recommended minimum: `2c-4g`. `1c-2g` is workable for the lean config if you pin threads; `free` at 512 MB is not.**

**x86_64:** ONNX Runtime's MLAS kernels dispatch at runtime and fall back on older CPUs — no AVX2 hard requirement, but **[ESTIMATE]** expect a material slowdown without AVX2. **arm64:** wheels exist for onnxruntime, opencv, mediapipe, faiss-cpu, sqlite-vec, Pillow, numpy — **the only build-from-source item in a sane stack is `dlib`**, which just needs a build stage. 🔴 **Published onnxruntime-on-Graviton benchmarks: not found. No x86-vs-arm ratio is asserted here.** **Apple Silicon dev:** everything above has `macosx_*_arm64` wheels except paddlepaddle-dependent OCR (which has a mac arm64 wheel but no Linux arm64 one) and dlib.

**ONNX-only stack — what it costs you.** 🟢 InsightFace's models **are already ONNX** (`det_10g.onnx`, `w600k_r50.onnx`, `genderage.onnx`, `2d106det.onnx`) and run under bare `onnxruntime` + `opencv` without the pip package — **but you must reimplement the preprocessing: 5-point similarity-transform alignment to 112×112**, and §3a says you cannot use those weights commercially anyway. PaddleOCR → ONNX via `paddle2onnx`, or just use RapidOCR's bundled ONNX. MiniFASNet has community ONNX exports on GitHub/HF (`garciafido/minifasnet-v2-anti-spoofing-onnx`, Apache-2.0, 1.66 MB) and an official-community **LiteRT/tflite** build. 🔴 **MediaPipe is the exception: it uses TFLite internally, not ONNX, and the pip package is self-contained** (no torch, no TensorFlow) — so it stays as its own runtime, which is acceptable at 37.9 MB. **The verdict: a stack of `onnxruntime` + `opencv-python-headless` + `zxing-cpp` + `rapidocr` + `mediapipe` avoids torch AND paddlepaddle entirely, and costs you only the models whose licences already excluded them.**

**Throughput sanity check.** 310 sessions/day. **[ESTIMATE] assuming a peak hour holds 20% of daily volume** = 62 sessions/hour = **0.0172 sessions/second**. Even at **5 seconds of CPU per session** that is **8.6% of one core** sustained through the peak hour; at 10 s/session, 17%. **One vCPU is ample; two gives headroom for a concurrent 1:N pass. The instance size is set by RAM (§9d), not by CPU.**

---

## 10. Recommended stack, gap vs Didit, and fallback policy

### 10a. The stack

| Capability | Chosen | Licence | Latency | **What it cannot do** |
|---|---|---|---|---|
| PDF417 decode | **zxing-cpp** 3.1.1 | Apache-2.0 | **not published**; [ESTIMATE] tens of ms on a rectified crop | Fails past **~3° rotation** — deskew is mandatory. No decode-confidence score |
| AAMVA parse | **write it yourself** (~300 lines, no deps) | yours | µs | Cannot prove authenticity — only self-consistency |
| Front OCR | **rapidocr** (PP-OCRv6, models in the wheel) + **Tesseract** second opinion | Apache-2.0 ×2 | PP-OCRv5 mobile **1.75 s/image** on a Xeon 8-thread; Tesseract **453 ms** on web screenshots | **~50% exact field match on ID cards in ideal light, 6–13% in low light** |
| MRZ (passports) | **mrzscanner-docsaid** | Apache-2.0 | not published | Passports only; US DLs have no MRZ |
| Face detect + 5pt | **YuNet** via `cv2.FaceDetectorYN` | **MIT** | **0.69 ms @160×120**, i7-12700K (**not a 640×480 figure**) | WIDER Hard 0.7503 — irrelevant for cooperative selfies |
| Face embed | **SFace** (128-d, opencv_zoo) — fallback **dlib** (128-d, CC0) | Apache-2.0 / **CC0** | **5.09 ms @150×150**, i7-12700K | 🔴 Materially weaker than buffalo_l. **No published ID-photo-vs-selfie number for either.** dlib needs dlib alignment (and the **5-point**, not 68-point, predictor) |
| 1:1 threshold | **derive from your own ROC** | — | — | 🔴 **No published threshold is safe to ship** |
| 1:N dedupe | **numpy brute force**, blocked on a non-biometric key | BSD-3 | **[ESTIMATE] 46 ms @113k**; 14 s of CPU/day | 🔴 **FAR compounds: N×FMR.** Needs top-K + score normalisation + human adjudication, never a bare threshold |
| Passive PAD | **MiniFASNetV2** (Silent-Face) | Apache-2.0 | **2.13 ms** Pi 5 CPU | 🔴 **No published benchmark on any public dataset.** Blind to 3D masks and to injection |
| Active liveness | **MediaPipe Face Landmarker** + **server nonce** | Apache-2.0 (code **and** models) | **[ESTIMATE] 8–20 ms/frame** desktop x86 | 🔴 Defeated by real-time face swap (**97% liveness evasion**, USENIX Sec '22). Client-side output is forgeable JSON |
| Blink | **per-user calibrated EAR** (relative drop) | — | trivial | Fixed thresholds do not generalise (0.08–0.27 across three datasets) |
| Head pose | **MediaPipe 4×4 transform matrix** | Apache-2.0 | included | **No published accuracy.** Landmarks degrade past ~80° yaw |
| Flash liveness | 🔴 **DO NOT BUILD without patent counsel** | — | server maths ~0.5 s/300 frames | 🔴 iProov US 9,075,975 active to 2033. No screen brightness control on the web. WCAG 2.3.1 |
| Age estimate | **MiVOLO v2** (Lagenda ckpt) **with YuNet, not YOLOv8** | Apache-2.0 (🔴 detector must be swapped) | not published | 🔴 Cannot be the gate. Only reliable **far** from the threshold |
| Image quality | **OFIQ 1.2.0** (ISO 29794-5 reference impl.) | **MIT code**, 🔴 weights separate | not published | No document-quality standard exists |
| Tor | `check.torproject.org/exit-addresses`, hourly | **CC0** | in-memory set | **IPv4 only** |
| Datacenter | first-party cloud range files + X4BNet | none / MIT | in-memory | 🔴 **Blind to residential proxies** |
| IP→ASN + country | **iptoasn.com** hourly, `array('I')` + bisect | **PDDL** | **0.49 µs**, 1.6 MB @400k | Country only; registration ≠ use |
| VPN | Mullvad/IVPN/PIA/Windscribe/AirVPN/Nord (`limit=0`) | clean | in-memory | ~10–15k IPs across 7 cooperative providers |
| Fingerprint | **FingerprintJS (MIT)** or ThumbmarkJS + **your own `enumerateDevices()` labels** | MIT | client-side | 🔴 Defeated by a **free** anti-detect browser. ~35.7% desktop / **18.5% mobile** uniqueness |
| TLS fingerprint | **JA4 only** (never JA4+) | **BSD-3** | at termination | Survives a CDN, unlike p0f |
| 🟢 **Velocity / 1:N reuse** | **your own two tables** | yours | one indexed query | Does not catch a first-time fraudster — **nothing does** |
| Runtime | **Python 3.11**, `python:3.11-slim-bookworm`, onnxruntime-only | — | **[ESTIMATE] ~500–550 MB image, 500–800 MB RSS** | 🔴 Alpine/musl breaks mediapipe and zxing-cpp |

**Deliberately excluded, with the reason:** InsightFace/buffalo_l/antelopev2 + SCRFD + `genderage` (**non-commercial weights**) · EdgeFace (**CC BY-NC-SA on the HF cards despite BSD-3 in the repo**) · AdaFace/MagFace/CurricularFace/GhostFaceNets (**MS1MV2/VGGFace2 contamination**) · DeepFace as a framework (**pulls TensorFlow**) · TruFor/Noiseprint/MMFusion/ManTra-Net/MVSS-Net/Splicebuster (**non-commercial or no licence**) · DeepfakeBench + FoundPAD weights (**CC BY-NC**) · surya (**$5M weights clause**) · Ultralytics YOLO anywhere (**AGPL-3.0 §13 fires on network interaction**) · JA4+ (**FoxIO 1.1 non-commercial, patent pending**) · MaxMind GeoLite2 (**EULA §5/§6 vs Docker + IDV**) · RIPE RIS (**commercial use prohibited in writing**) · FireHOL (**no licence, ~150 upstream licences**) · ip-api.com (**non-commercial**) · `nateraw/vit-age-classifier` and FLIP checkpoints (**no licence at all**) · paddlepaddle (**no Linux aarch64 wheel**) · dlib's **68-point** predictor (**iBUG 300-W excludes commercial use**) · CPBD (**proprietary PyPI classifier**) · p0f (**dead behind a CDN**) · WebRTC local-IP leak (**verified dead**) · dan.me.uk `/torlist/` (**no licence, ban-on-retry**).

### 10b. Gap vs Didit — honest verdict per line

Didit baseline from the console digest and [docs.didit.me](https://docs.didit.me). Current spend **$2,657.89/cycle** on ~9,400 verifications.

| Didit capability | Didit's position | Self-built verdict | Honest note |
|---|---|---|---|
| **PDF417 / AAMVA extraction** | `BARCODE_NOT_DETECTED`, `BARCODE_VALIDATION_FAILED`, `DATA_INCONSISTENT` | 🟢 **PARITY** | Same public standard, same Apache-2.0 decoder class. The spec is free |
| **Barcode↔OCR cross-check** | `MRZ_AND_DATA_EXTRACTED_FROM_OCR_NOT_SAME`, `DATA_INCONSISTENT` | 🟢 **PARITY (structure), 🟡 PARTIAL (accuracy)** | The logic is yours to write; **the OCR underneath is ~50% exact-match on ID cards, and Didit's is not** |
| **Front-side OCR** | 14,000+ doc types, 220+ countries | 🟡 **PARTIAL** | Fine for US DL/ID English. **No template library, so no doc-type detection** — `COULD_NOT_DETECT_DOCUMENT_TYPE` has no analogue |
| **MRZ + check digits** | `MRZ_NOT_DETECTED`, `MRZ_VALIDATION_FAILED` | 🟢 **PARITY** | ICAO 9303 is a free public spec |
| **Per-state / per-country templates** | **14,000+ documents** | 🔴 **WORSE — structural** | **No public template library exists.** Build from your own captures, US-only, over months |
| **Tamper forensics** | pixel-level, clone-stamp, font/kerning, AI-generated signals, metadata | 🟡 **PARTIAL** | The best *usable* open detectors are **~50% FN at 10% FPR on real IDs** (FantasyID). Field-localised scoring is the right shape and still not a gate |
| **`SCREEN_CAPTURE_DETECTED` / `PRINTED_COPY_DETECTED`** | unconditional-decline codes | 🔴 **WORSE** | **No validated open pretrained recapture classifier exists.** FFT/specular heuristics only |
| **`PORTRAIT_MANIPULATION_DETECTED`** | unconditional decline | 🟡 **PARTIAL** | 🟢 **The ghost-portrait cross-check is a genuinely strong substitute** — and note **D-MAD works because you have the selfie** (~72% detection at 1% FP, NIST) |
| **Hologram / OVD** | implied in doc authenticity | 🔴 **IMPOSSIBLE on a single RGB still** | Physics, not effort. Possible-in-principle with a tilt video; nothing open is production-ready and the two research repos are GPL-3.0 |
| **UV / IR / B900** | not offered by Didit either | 🔴 **IMPOSSIBLE** | Both parties are excluded — **this is not a gap vs Didit** |
| **NFC chip (`NFC_AND_OCR_DATA_NOT_SAME`)** | $0.15, e-passports/eIDs | 🟡 **PARTIAL** | Open ePassport stacks exist (JMRTD, pypassport). 🔴 **Irrelevant for US DLs — no readable chip** |
| **Face match 1:1** | score 0–100, **default decline threshold 30**; FAR/FRR **not published** | 🟡 **PARTIAL** | 🔴 **You lose buffalo_l on licence.** SFace/dlib are materially weaker, and **no ID-photo-vs-selfie number is published for any of them** |
| **Face search 1:N + `DUPLICATED_FACE`** | standalone API + biometric-template lists | 🟢 **PARITY, arguably BETTER** | 113k embeddings = 232 MB, ~46 ms, 14 s CPU/day. 🔴 **But FAR compounds** — the win requires blocking + top-K + adjudication, not a threshold |
| **Passive liveness** | $0.10, claims **99.9% accuracy, FAR <0.1%, "iBeta-tested"** | 🔴 **WORSE** | Your model has **no published benchmark at all**, and cross-dataset ACER collapses ~30–60× |
| **Active liveness `ACTIVE_3D`** | $0.15 | 🟡 **PARTIAL** | Blink/pose/smile via MediaPipe + a server nonce is buildable. **Both yours and Didit's are defeated by real-time face swap** — USENIX tested six commercial vendors |
| **Active liveness `FLASHING`** | $0.15, "3D Flash… 30+ fps depth maps" | 🔴 **BLOCKED (patent), not technical** | iProov **US 9,075,975 active to 2033-02-17**, claim 1 is this design. FaceTec is litigating. **Plus: no screen-brightness API, AE fights you, WCAG 2.3.1** |
| **iBeta / ISO 30107-3 posture** | "iBeta-tested" | 🔴 **IMPOSSIBLE for an open model — and available to you as a vendor** | **Zero open-source entries in iBeta's ~271-row table**, and the process has no mechanism for a repo. **If you build it, you are the vendor and may submit your deployed system** |
| **Injection / virtual camera** | not a named Didit feature | 🔴 **WORSE for both** | A $20 HDMI-USB dongle is a *real* UVC camera. **No software check on the verifying machine distinguishes it** |
| **Age estimation** | $0.10, adaptive with ID fallback | 🟡 **PARTIAL** | MiVOLO v2 is Apache-2.0 and usable — **but no open model appears in NIST FATE AEV, and §6d shows the triage collapses into "check everyone under 30"** |
| **Image quality scores** | `front/back_image_quality_score`, `IMAGE_TOO_BLURRY/DARK/BRIGHT`, `face_quality`, `face_luminance` | 🟢 **PARITY, arguably BETTER** | **OFIQ is the ISO 29794-5 reference implementation, MIT code.** Didit's scores are undocumented; yours would be standards-traceable |
| **IP: `TOR_DETECTED`** | $0.03 bundle | 🟢 **PARITY or better** | Both consume the same CC0 Tor Project feed |
| **IP: `DATACENTER_IP`** | same | 🟢 **NEAR-PARITY** | First-party cloud files are authoritative; you lose only Hetzner/OVH/Scaleway precision, covered by ASN |
| **IP: `VPN_DETECTED` / `PROXY_DETECTED`** | same | 🔴 **WORSE** | ~10–15k IPs from cooperative providers. 🔴 **Residential proxies are invisible to every open list at any effort level — the single largest gap** |
| **IP: country / `LOCATION_MISMATCH_WITH_DOCUMENT`** | same | 🟢 **PARITY at country level** | PDDL data, sub-µs. City tier is degraded — **and vendors' own city accuracy is 66% within 50 km** |
| **`IMPOSSIBLE_TRAVEL`** | same | 🟢 **PARITY** | Relative comparison; absolute accuracy barely matters |
| **`DUPLICATED_DEVICE` / device fingerprint** | same | 🟡 **PARTIAL** | Signals are at parity (FingerprintJS is MIT). **Both are defeated by a free anti-detect browser** |
| **Cross-customer device reputation** | Didit sees every customer | 🔴 **IMPOSSIBLE by construction** | A device that defrauded three other retailers arrives at you clean |
| **Blocklists / allowlists / biometric templates** | Lists UI | 🟢 **PARITY** | Your own tables |
| **`POSSIBLE_DUPLICATED_USER`, ID-number reuse, retry patterns** | partial | 🟢 **BETTER** | **Your data, your depth. The strongest controls you have** |
| **`expected_details` cross-check** | `*_MISMATCH_WITH_PROVIDED` | 🟢 **PARITY** | Trivial once fields are extracted |
| **AML / PEP screening** | optional | 🔴 **IMPOSSIBLE** | Requires licensed sanctions/PEP data. **Not needed for cannabis retail** |
| **Phone / email intelligence** | disposable, breached, carrier | 🔴 **WORSE** | Vendor-data dependent |
| **Manual review queue + analyst audit trail** | Needs-review UI, `reviews[]` | 🟢 **PARITY** | You must build the UI. 🔴 **Given the numbers above, this is not optional** |
| **Webhook/HMAC session model** | `X-Signature-V2`, replay window 300 s | 🟢 **PARITY** | Standard engineering |
| **Compliance PDF, GDPR delete, reusable KYC** | built-in | 🟡 **PARTIAL** | Buildable; unbudgeted work |
| **Regulatory attestations (IAL2 / Kantara / DIATF)** | vendor-held | 🔴 **IMPOSSIBLE without a paid audit** | Only matters if a counterparty asks |

**One-paragraph summary for a decision memo.** *A self-built engine reaches parity on barcode/AAMVA extraction, MRZ, the barcode↔OCR cross-check, image quality (with a standards-traceable advantage via OFIQ), Tor and datacenter IP detection, country geolocation, and — with a genuine advantage — 1:N dedupe and velocity signals on your own data. It is materially worse on face-match accuracy (the best open weights are non-commercial), passive liveness (no published benchmark, no certification path for a repo), screen/print recapture detection, per-document templates, and residential-proxy detection. It is blocked by patent, not by engineering, on flash liveness. And it is impossible on UV/IR, chip data for US DLs, cross-customer device reputation, and hologram verification from a single RGB still. Didit currently costs $2,657.89 per cycle; the honest comparison is not cost-per-check but whether the four "worse" lines and the one "blocked" line are acceptable at 310 sessions/day, given that California law already places the operative age check on a human inspecting a physical document at the door.*

### 10c. Fallback policy per capability

**Principles:** never fail open; never fail closed silently; **abstain and re-capture in preference to scoring a bad input**; and **cap the achievable score whenever a signal is missing**, so a degraded path can never produce a full-confidence pass.

| Capability | Primary | Fallback | Score effect |
|---|---|---|---|
| **Barcode unreadable** | zxing-cpp on a deskewed crop | Retry with rotation sweep + upscale + CLAHE; then `rxing`; then a cropped-region second decoder | 🔴 **OCR-only with a hard score cap and forced manual review.** Distinguish "no symbol found" (quality → re-capture prompt) from "symbol found, undecodable" (risk signal) |
| **AAMVA parse fails** | own parser | Extract whatever elements are well-formed; preserve the raw bytes | Cap score; log version + IIN; **`HEADER_INVALID` is a strong fraud signal, `PARSE_FAILED` only moderate** |
| **OCR fails or quality gate trips** | rapidocr + Tesseract consensus | **Re-capture prompt first**, not a fallback model | `DECODED_OCR_FAILED` → **use barcode data, abstain on the cross-check**, cap score |
| **Engines disagree** | two-engine consensus | Take the barcode as authoritative for cross-checkable fields | Flag `DATA_INCONSISTENT`; route to review; **never label "fake" from a mismatch alone** |
| **No face found on the document** | YuNet on the rectified front | Fixed-zone crop relative to the card outline | Cap score; manual review |
| **Ghost portrait absent** | primary↔ghost↔selfie | Fall back to primary↔selfie only | **No penalty** — the ghost is optional in AAMVA. Do not treat absence as tamper |
| **Face match below threshold** | 1:1 on your own ROC | **Up to 3 attempts** with quality feedback (Didit's own default is 3) | Then manual review with both crops shown |
| **PAD model unavailable / low confidence** | MiniFASNetV2 | Image-quality + active challenge only | Cap score; require active liveness; **never auto-approve on PAD absence** |
| **Active challenge fails** | nonce-bound blink/pose | One re-issue with a **different** nonce | Two failures → manual review. **Never re-issue the same nonce** |
| **Landmarks unavailable (extreme pose, occlusion)** | MediaPipe | Re-capture prompt with a guidance oval | Abstain; do not score |
| **Age estimate unavailable** | MiVOLO v2 | Omit the signal | **No penalty** — it was never the gate |
| **Tor/ASN/VPN list stale** | hourly refresh | **Serve stale + alarm**, emit `list_age_seconds` | 6 h degrade / 24 h alarm. **Never fail-open, never fail-closed** |
| **GeoIP unavailable** | iptoasn country | Omit; rely on velocity | Small penalty only |
| **Fingerprint absent (JS blocked/private window)** | own JS | Treat as a **weak negative signal**, not a block | Cap score; **do not block — you will block privacy-conscious legitimate customers** |
| **1:N index rebuilding** | numpy brute force | Serve the last good index | Never block a verification on an index rebuild |
| **Any model file missing at boot** | baked-in weights | 🔴 **Fail the deploy, not the request.** Health-check every model at startup | A silently missing model produces confident wrong answers, and NIST's FTP≈0 finding says nothing will throw |

🔴 **The one policy that matters most:** because §2c and §4b show the best usable open detectors sit near coin-flip on real IDs cross-domain, and §6d shows the age triage collapses, **the automated decision must be a risk score feeding a step-up, never a standalone verdict.** **[ESTIMATE] budget 1–5% of sessions routed to human review**, and build that queue before shipping — it is the control that makes every honest number in this document survivable.

---

## 11. Honest-zero register — what does not exist

Recorded so nobody re-discovers these, and so no reviewer supplies a number from memory.

| # | Question | Status |
|---|---|---|
| 1 | CPU latency for **any** forensics model in §2b | **Not published.** Only TruFor's GPU figure (1.17 s @3.2 MP, RTX A6000) exists |
| 2 | PDF417 decode latency for zxing-cpp / rxing / pdf417decoder | **Not published** by any project |
| 3 | Per-state US DL OCR accuracy | **Not published by anyone** |
| 4 | Which specific US states emit non-conformant AAMVA barcodes | **Not published.** Vendor guides name **none** |
| 5 | Silent-Face / MiniFASNet APCER/BPCER/ACER on any public dataset | 🔴 **Does not exist in the repository** |
| 6 | DeepFace anti-spoofing accuracy | **None published** |
| 7 | Any face-PAD model on Hugging Face with APCER/BPCER on a named public protocol | 🔴 **Not one** |
| 8 | An open-source PAD model with an iBeta conformance letter | 🔴 **Zero in ~271 rows**, and no mechanism exists |
| 9 | iBeta L1/L2 pricing | **Not published** |
| 10 | ID-photo-vs-selfie degradation for buffalo_l, dlib, SFace | 🔴 **Not published.** DocFace+ tested only SphereFace and CenterFace |
| 11 | `insightface_001` FNMR@FMR values | Rendered as figures — **not published in machine-readable form** |
| 12 | A `dlib` FRVT 1:1 submission | **Not published** — this is *not* evidence dlib performs poorly |
| 13 | InsightFace age-estimation MAE | 🔴 **Not published anywhere in the README** |
| 14 | MediaPipe full-pipeline CPU latency; head-pose MAE on AFLW2000/BIWI | **Not published** by Google or anyone |
| 15 | Gaze-direction accuracy from MediaPipe iris landmarks | **Not published — and Google disclaims the capability twice, verbatim** |
| 16 | Eyeglass impact on EAR | 🔴 **Not published.** Nearest figure (iris *depth* error 4.3%→4.8%) is adjacent, not the same |
| 17 | Demographic bias in EAR / MediaPipe eye landmarking | 🔴 **Not measured.** A mechanism exists; the evaluation does not. **The absence is the finding** |
| 18 | Deep-Live-Cam FPS on named consumer hardware | **Not published.** Any "30 fps on an RTX 3060" claim is unsourced |
| 19 | The "82.56% → 65.18%" DFDC pair | 🔴 **Searched the full paper text — it does not appear. Do not cite it** |
| 20 | An open flash/colour-reflection liveness implementation | 🔴 **None exists.** Exhaustive GitHub search; two near-misses, both unusable |
| 21 | Aurora Guard accuracy / EER / ACER | **Not in the abstract**; no official code released |
| 22 | Model sizes for PSCC-Net, SAFIRE, EXIF-as-language, FOCAL, Noiseprint | **Not published** |
| 23 | FOCAL absolute IoU | Behind an IEEE paywall — **not retrieved** |
| 24 | NIST Challenge-21 FPR/FNR | 🔴 **Does not exist.** NIST tabulates T=22/25/28/31 **against L=18 only**. Any 21+ NIST figure would be fabricated |
| 25 | NIST skin-tone data | 🔴 **Refused by design** — *"We do not use the Fitzpatrick skin type"* |
| 26 | Numeric NIST eyeglasses deltas | Figures only — **not published numerically** |
| 27 | An open-weight model in NIST FATE AEV | 🔴 **None submitted.** 47 commercial + 2 university entries |
| 28 | Yoti makeup analysis; Yoti per-skin-tone **FPR** at 21 | **Not published** (the tone split is TPR-only) |
| 29 | DEX MORPH MAE | **Not verified** — absent from the ICCVW paper; the IJCV PDF exceeded the fetch limit |
| 30 | CPU latency for any age model except SSR-Net (2.69 ms, i7) | **Not published.** MWR's "143 fps" is an **RTX 2080Ti** |
| 31 | ISO/IEC 29794-5:2025 and 19794-5:2011 normative text | **Paywalled.** All measure formulas here come from OFIQ source, a good proxy but not clause text |
| 32 | ICAO Doc 9303 Part 9 directly | icao.int 403s non-browser clients — ICAO figures come from **TR Portrait Quality v1.0** via Wayback |
| 33 | A document-image-quality standard | 🔴 **None exists.** ISO 29794 has no document part |
| 34 | Render arm64 instance support, image-size limit, build-time limit | 🔴 **Not published** in `/docs/docker` or `/docs/compute-plans` |
| 35 | onnxruntime-on-Graviton benchmarks / any x86-vs-arm ratio | **Not found; none asserted** |
| 36 | Residential-proxy pool sizes | **Self-reported vendor marketing only** — SOAX's own two pages disagree (155M vs 191M) |
| 37 | RIR-file country-mapping accuracy | **Not published** by any RIR, and no primary study found |
| 38 | Team Cymru terms of use | 🔴 **No ToS document exists at all** — searched the full 130 KB page |
| 39 | Torch/DL exit-list IPv6 coverage | **Not published; none asserted** |
| 40 | GeoLite2-specific city accuracy | **Not published** (the 66%-within-50 km figure is for **paid** products) |
| 41 | FingerprintJS **OSS** accuracy | **Not published** (only Pro is: 99.5% @30 days) |
| 42 | EFF Cover Your Tracks current aggregate uniqueness | **Not published** |
| 43 | Didit face-match FAR/FRR at its default threshold of 30 | **Not published** in its docs |
| 44 | Regula / Smart Engines / Jumio / Veriff detection accuracy | **No independent benchmark published.** All vendor claims unaudited |
| 45 | A DOJ press release for the netnut.io seizure | **Not located.** The seizure is directly observed (FBI nameservers + page); **no cause or charge is attributed** |
| 46 | SynID / KID34K / FMIDV / BID dataset licences | FMIDV and BID: **absent, not merely unfound** = all rights reserved |
| 47 | Whether any US jurisdiction ships a portrait in the PDF417, or uses Annex I | **No evidence either way** |
| 48 | Cannabis rules for CO, MI, NV, NJ, IL, OR, WA, AZ, NM | **Not checked.** "No US state accepts FAE" is **unproven**; "none of CA/MA/NY" is proven |

**Unresolved source conflicts, left visible rather than silently resolved:** FLIP's venue (ICCV 2023 vs WACV 2024) · NAS-FAS O&C&I→M reported as **16.85 by three sources and 19.53 by SSAN** · SiW/OULU-NPU video counts differing between official sites and the TPAMI survey · the **52-blendshape list differing between MediaPipe's source and its own model card** · SIDTD's licence (CC BY-SA 2.5 in the Nature paper vs CC-BY-4.0 in the repo) · IDNet's licence (CC BY 4.0 in the paper and HF mirror vs **`cc0-1.0` in the Zenodo record JSON**) · Spamhaus's marketing page vs its binding Terms · CAT-Net's README relicensing vs **GitHub reporting no LICENSE file**.

**Premises that were checked and turned out to be wrong** — recorded because each would have cost real work: MiVOLO's weights are **Apache-2.0, not research-only** (but its **detector is AGPL**, which is the actual blocker) · **NIST FATE AEV does not report skin tone** and explicitly refuses to · **FingerprintJS is MIT** on both the v3 branch and current v5.2.0, with no restrictive clause to quote · **JA4 vs JA4+ is inverted** — plain JA4 is BSD-3 with an explicit no-patent-claims statement, JA4+ is the non-commercial patent-pending one · **RIR delegated files are not "fully open with no restrictions"** — no RIR publishes an open-data licence and two publish text reading against commercial use · **`WEBGL_debug_renderer_info` has not been removed anywhere** · **Chrome's UA reduction is complete, not pending** · **dan.me.uk's limit is 15 minutes, and every attempt resets the timer** · the AAMVA 2025 standard is version **11**, and **the only PyPI AAMVA parser maps it to 12** · **MIDV-500 does contain 3 US documents** (none of them a driver's licence) and is **predominantly Western/Central European, not Russian**.

**Method note.** The session's 200-call WebSearch budget was exhausted partway through the research; the remainder was completed by direct fetch, the GitHub REST API, the PyPI JSON API, Docker Hub's API, DNS queries, local PDF text extraction, and Wayback snapshots. That is why file sizes, wheel tags and repo statistics above are exact byte counts rather than rounded search snippets — and why several search-engine summaries were caught being wrong (MiVOLO's licence structure, `nateraw/vit-age-classifier`'s licence, the DFDC figures). **Every licence claim in this document cites a raw file or a primary page, not a summary.**
