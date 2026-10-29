# Learning Hub expansion: development checkpoint

This work is not a completed Basic 1–9 curriculum release. Do not deploy this checkpoint as a complete curriculum.

## Implemented and verified

- Server-created assessment sessions with four practice, five quiz and ten unit-test questions; quiz scope is the same strand through the selected lesson, and unit-test scope is the same subject and grade.
- Unseen-question preference, immediate missed-question recovery, and subsequent review intervals of 1, 3, 7, 14 and 30 days after successful recovery.
- Fisher–Yates question and option shuffling with answer-index remapping. Answer keys remain on the server until submission.
- Five monotonic mastery levels. Two consecutive successful full practice sets qualify as repeated practice. Aggregate assessments update only skills actually assessed.
- Session ownership, expiry and idempotent grading. Repeated submissions cannot overwrite the recorded score.
- Lesson outline assessment navigation, completion feedback, mastery celebration, fresh retakes and return to lesson.

Validation: 132 unit tests passed (2 skipped); six mocked browser tests passed; PostgreSQL-compatible PGlite migration/RPC checks passed for grading, invalid answers, ownership, expiry, replay and browser role restrictions. Production build is checked separately. These are not live backend deployment verification.

## Release blockers

1. The development catalogue now adds 960 mathematics questions across thirty indicator facets in B1–B9 and 32 living-cell questions across two B7 science indicators. This still does not satisfy complete curriculum coverage. Earlier selected lessons retain three-question banks; the reader explicitly disables undersized assessments while retaining reading access.
2. Author original, complete lessons and at least sixteen meaningful questions for every applicable NaCCA indicator in every subject Basic 1–9. Do not pad banks with identical questions or substitute generic lesson templates for instruction.
3. Verify the entire source inventory against the PDF tables. Automated references can include preamble examples and can omit codes whose text extraction is malformed. Low extracted counts are not evidence that a subject has fewer indicators.
4. Confirm missing sources, including lower-primary Creative Arts and all applicable JHS subjects. Primary French and Computing start at B4 in the examined curriculum; do not fabricate B1–B3 coverage.
5. Serialize question reservation across simultaneous sessions for one student if unseen-before-repeat must be guaranteed across concurrent tabs. Sequential sessions currently respect served-question history.
6. Run real backend integration checks and deploy the migration/function together with the complete catalogue before releasing the frontend.

## Source audit

`scripts/audit-curriculum-pdfs.py` takes a local manifest and emits candidate indicator codes and PDF page references, without copying instructional prose. Local research PDFs and the provisional audit are in `.temp/curriculum-audit`; language documents are in `.temp/primary-languages`. These temporary files are not shipped curriculum content.

The original requested sources remain the primary and JHS archives linked in `src/learningHub/sources.ts`, official NaCCA curriculum publications and the Ministry of Education curriculum resources portal. A reference inventory is not a lesson library and must never be reported as completed coverage.
