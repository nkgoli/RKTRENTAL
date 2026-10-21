# Signed agreement PDF inspection

All people, accounts, addresses, agreements, signatures and addendum references in these samples are synthetic. The samples are generated directly by `tests/esign/pdf.test.ts`; no database or customer records are used.

The final renderer uses the immutable reviewed snapshot, resolved agreed terms and individually recorded signature evidence. It separates agreed clauses from the complete review record, which may also contain unselected source-template options. It includes each signer’s actual name, email, phone, timestamp, consent version and authentication audit fields. Original addendum names and content hashes identify the separately preserved files; the renderer does not invent signatures inside those originals.

The PDF also embeds `agreement-snapshot.json` and `signature-evidence.json` so the original structured values and Unicode names can be recovered exactly. `ActualText` surrounds each drawn line. Some plain text extractors ignore this information and reorder right-to-left characters or lose contextual glyph mappings; the inspection script checks the logical marked text and independently checks ordinary fields through pypdf extraction. Rendering was checked separately.

## Verification

- Seven renderer tests passed: full long content and financial terms, three actual signers, frozen attachment recovery, missing/partial evidence rejection, unsupported character rejection, multilingual preflight and rendering, renewal/addendum references, deterministic repeated PDF bytes, and truthful legacy summary wording.
- Twelve existing lease-create tests also passed. Project typecheck and scoped ESLint passed.
- PyMuPDF rendered all 22 pages. Every final page was visually inspected in contact sheets; the signature pages were also inspected at page size. No clipped text, missing tested glyphs, overlap, or incorrect page numbering remained.
- Independent page word bounding-box checks and logical text checks passed. The long agreement includes its last agreed sentence in both the operative terms and the frozen review record.
- The three retained sample files are `synthetic-long-signed-agreement.pdf` (10 pages), `synthetic-renewal-with-addendum-reference.pdf` (6 pages), and `synthetic-multiscript-signatures.pdf` (6 pages). Exact sizes and SHA-256 values are recorded in `inspection-results.json`.
- Tested names include Zoë García, 李明, Олена Коваль, محمد أحمد, אביגיל, and अर्जुन. Arabic/Hebrew runs use Unicode bidirectional ordering; fontkit shaping positions preserve contextual letters and Indic marks.

Reproduce from the repository root in PowerShell:

```powershell
$env:WRITE_PDF_EVIDENCE = '1'
node node_modules/vitest/vitest.mjs run --config vitest.config.ts tests/esign/pdf.test.ts tests/lease-create/lease-create.test.ts
Remove-Item Env:WRITE_PDF_EVIDENCE
python docs/leases/pdf-evidence/inspect_pdfs.py
```

The inspection script requires PyMuPDF and pypdf. Poppler was unavailable in this Windows runtime, so PyMuPDF supplied the independent raster renderer. PNG contact sheets, page renders, extracted text and sample PDFs remain local evidence rather than application assets.

## Font provenance and delivery

Server deployments must include the bundled `public/fonts/Noto*.ttf` files. Files are read from the application working directory and cached. The renderer embeds only fonts used by each document. Full static embedding intentionally avoids the missing composite glyphs observed with fontkit CJK subsets; a CJK sample is approximately 6.9 MB, below the application’s 25 MB file limit. Other language samples are smaller.

The regular, Arabic, Hebrew and Devanagari font files come from the [Noto font repository](https://github.com/notofonts/noto-fonts/tree/main/hinted/ttf), under the bundled `NotoSans-LICENSE.txt` (SIL Open Font License). The Chinese font comes from [Google Fonts Noto Sans SC](https://github.com/google/fonts/tree/main/ofl/notosanssc), under `NotoSansSC-LICENSE.txt`. The downloaded variable Chinese TrueType font was instantiated at weight 400 using fonttools 4.67.0, then saved as the bundled static `NotoSansSC-Regular.ttf`. Temporary font-conversion tools and the variable download were removed.

| Bundled file                   | SHA-256                                                          |
| ------------------------------ | ---------------------------------------------------------------- |
| NotoSans-Regular.ttf           | b85c38ecea8a7cfb39c24e395a4007474fa5a4fc864f6ee33309eb4948d232d5 |
| NotoSansSC-Regular.ttf         | b036909224de210191dfd35d866c0e0b495254a0e41fd7c6698a85e1eda3b2b5 |
| NotoSansArabic-Regular.ttf     | ceea25b464a656dc3b26849bab9356740401af62aedf1bfa8b7f0d9b75925b1b |
| NotoSansHebrew-Regular.ttf     | a7fa16fffb27bedb060a0866267c29e9859aeb9c21cc33f5b3aaf6eb062eca85 |
| NotoSansDevanagari-Regular.ttf | 385e78e6359a9d88a0f243d53b1209d7548361ba2194e2b9ec779bcaa7e8949d |

Coverage is finite. `assertArchivableText` explicitly rejects an unavailable Unicode codepoint before signing when called by the signing service; the renderer independently rejects it during archival. Unsupported scripts require an appropriate additional font and rendering check. No missing character is silently replaced or represented as successful archival.
