# NaCCA indicator reference audit

Audited 29 October 2026. This directory is an editorial reference inventory, **not a completed lesson or question bank**. The application must not infer instructional coverage from these files.

## Files and reproduction

- `sources.json`: 29 source records covering all 96 applicable subject/grade combinations in the requested 2019 primary and JHS Common Core curricula. `firstContentPage` is the 1-based PDF page at which curriculum tables begin, excluding preamble examples. Primary French and Computing are B4–B6, not B1–B3.
- `sourceAudit.json`: PDF SHA-256 identities, page counts, counts by grade, and references excluded from preamble/wrong-grade locations. Arabic is explicitly recorded as unavailable.
- `indicatorReferences.json`: 4,041 unique subject-and-indicator references extracted from 28 available PDFs. Each includes the originating source, 1-based PDF pages and original code forms. All remain marked `reference-extracted; meaning-and-table-placement-unverified`.
- `scripts/curriculum-inventory.py`: reads the downloaded PDFs listed in the manifest, caching extracted text only in ignored `.temp/curriculum-inventory`. Emits identifiers and references, not copyrighted instructional/exemplar prose. Requires Python `pypdf`.
- `scripts/curriculum-inventory-check.mjs`: validates source/grade membership, unique IDs, source-code normalization, page bounds, count consistency and the complete subject/grade manifest. Run with Node. Passing this check is **not** evidence of semantic accuracy or exhaustive extraction.

Reproduce after downloading the sources to their manifest `localPath` values:

```text
python scripts/curriculum-inventory.py
node scripts/curriculum-inventory-check.mjs
```

## Important extraction corrections

Some source PDFs print a space instead of a dot after the grade. For example, the JHS RME PDF page 43 prints `B7 3.1.1.3`, and upper-primary Creative Arts page 41 prints `B4 2.2.3.1` and `B4 2.2.3.2`. Both pages were rendered and visually checked. The tolerant parser preserves their numeric parts and records the original forms instead of inventing new indicators. The earlier strict dotted-code audit undercounted these subjects severely: JHS RME rises from 9 to 68 candidate references, and upper-primary Creative Arts from 30 to 141.

Curriculum preambles include hypothetical annotation examples and miniature tables. Counting every code in a PDF falsely adds them to a syllabus. Explicit content-table start pages now exclude these. Grade mismatches are logged, not silently reassigned to the expected grade.

## Source coverage and remaining gaps

Candidate references exist for 93 of the 96 applicable subject/grade cells. This means each of those cells has some extracted references; it does not certify that all its indicators were extracted or understood.

The remaining three cells are Arabic B7, B8 and B9. The official [Common Core directory](https://nacca.gov.gh/common-core-programme-ccp/) lists Arabic and links an [Arabic B7–B9 PDF](https://nacca.gov.gh/wp-content/uploads/2023/06/ARABIC.pdf). The download timed out both in and outside the restricted environment. An indexed mirror also failed its TLS connection. No substitute indicator IDs have been fabricated. Older B7–B10 documents found elsewhere must not silently replace the requested B7–B9 edition.

The previously missing lower-primary Creative Arts document is now sourced from the Ministry of Education [Basic 3 resources page](https://curriculumresources.edu.gh/basic/trs_basic-3_creative-arts/) and its [B1–B3 PDF](https://curriculumresources.edu.gh/basic/wp-content/uploads/2026/05/Creative-Arts-B1-B3-2.pdf).

Before an indicator is considered covered, a reviewer must inspect its actual table entry and exemplars, confirm the meaning and expected performance, and review original assessment items against it. Oral, practical, artistic and physical-performance indicators can require audio or teacher-scored activities; a multiple-choice item alone does not demonstrate performance. Do not generate generic questions from code numbers or strand names and label them full indicator coverage.

## Candidate counts by subject

| Subject                                            |                                    Primary |                        JHS |
| -------------------------------------------------- | -----------------------------------------: | -------------------------: |
| Mathematics                                        |                                        272 |                        177 |
| Science                                            |                                        160 |                        152 |
| English Language                                   |                                        611 |                        152 |
| Ghanaian Language                                  |                                        487 |                        104 |
| French                                             |                                267 (B4–B6) |                        166 |
| Computing                                          |                                206 (B4–B6) |                        123 |
| History                                            |                                         51 | Not a separate JHS subject |
| Our World and Our People                           |                                        148 | Not a separate JHS subject |
| Religious and Moral Education                      |                                         77 |                         68 |
| Creative Arts / Creative Arts and Design           |                                        265 |                        100 |
| Physical Education / Physical Education and Health |                                        214 |                         54 |
| Social Studies                                     |             Not a separate primary subject |                         54 |
| Career Technology                                  |             Not a separate primary subject |                        133 |
| Arabic                                             | Not included in examined primary directory |         Source unavailable |

These are extracted reference counts, not counts of authored lessons, validated meanings, or generated questions. No claim is made that every PDF printing inconsistency, duplicate reference or malformed extraction has been resolved.
