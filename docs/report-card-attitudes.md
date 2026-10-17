# Report-card attitudes

## Inspection and design

The school app is React/TypeScript (Vite), backed by Supabase PostgreSQL and the `workspace` Edge Function. `ReportCardEditor` and its `handleSubmit` function in `src/pages/Academics.tsx` send one existing queued save containing grades, remarks and conduct. `ReportSheet` is shared by view, individual printing/PDF and class printing. Server authorization is in `src/backendAccess.ts`; both full and compact saves validate `src/validation.ts` before transactional workspace commits.

There is no relational report-card table. Records live in `public.workspace_entries(section, entry_key, ordinal, value jsonb)`. The report's `conduct` entry is keyed by `pupilId|term`. Accordingly, the nullable `attitudes` object is stored **inside the existing `value` JSONB**, rather than adding a redundant second column or a new table. This is an intentional adaptation of the requested JSON-column design to the existing document model. No existing column is changed, and the migration does not update any record. The migration adds a nullable-object shape constraint; the single TypeScript list supplies exact key/word validation on the server.

The eight lists are defined only in `src/reportAttitudes.ts`. New forms start empty, and Leave blank allows clearing a selection. Legacy free-text values remain intact and visible. Unlisted values are shown with a re-pick message and must be corrected or cleared before saving that report. Reports without values show hyphens. React escapes values as text, preserving literal ampersands in JSON, HTML and printed output.

Attitudes use the existing report permissions, pending-save recovery, three-way conflict handling and transaction. Before/after choices are included in the existing report-update audit message. No second save request or new save button is introduced. Also fixed the editor sending an invalid empty image string when no school logo exists; the absent image now remains undefined.

There is no report-copy/term-promotion operation. Switching terms reads a different conduct key and does not copy attitudes. Pupil roster and score imports do not copy conduct to another term. Same-term backup/recovery preserves the original record. The existing report-key convention does not include academic year; redesigning that convention is outside this change.

## Deployment — commands for the operator, not run against production

Branch: `codex/report-card-attitudes`.

Migration: `20261017054715_report_card_attitudes.sql`.

Review the pending migration list before applying:

```powershell
npx supabase db push --linked --skip-vault --dry-run
npx supabase db push --linked --skip-vault
npx supabase functions deploy workspace --project-ref itqfnzqksuacbeemrqok
```

Deploy the updated Edge Function before publishing the frontend: the old function only accepts flat string conduct fields. Publish the frontend through the normal GitHub/Vercel release process after backend validation is available. The current work does not deploy, merge to main, or change production data.

For local Supabase instead, use `npx supabase db push --local`. The automated database check uses PGlite with synthetic records and requires no live credentials.

## Undo without deleting saved choices

Supabase uses forward migrations. Create a compensating migration:

```powershell
npx supabase migration new undo_report_card_attitudes
```

Place this SQL in the generated file, then apply it with the same reviewed `db push` flow:

```sql
alter table public.workspace_entries drop constraint if exists report_attitudes_object;
```

This removes the new constraint and **retains all saved attitudes**. Do not redeploy the original flat-string validator after real attitudes have been saved: it cannot accept the nested object. A functional UI rollback must retain the compatible server/model or ship a separate compatibility release; deleting choices to fit old code is not an acceptable rollback.

## Files

- `src/reportAttitudes.ts`: shared ordered options, record types, legacy reads and exact-value validation.
- `src/data.ts`: conduct record type includes optional attitudes.
- `src/validation.ts`: server schema validates nested attitudes and preserves legacy fields.
- `src/pages/Academics.tsx`: eight accessible selects, pre-selection, obsolete-value messages, atomic save, audit text and shared print rendering.
- `src/styles.css`: responsive 4/2/1 editor grid and wrapping in the fixed 4×2 print grid.
- `supabase/migrations/20261017054715_report_card_attitudes.sql`: additive JSON shape constraint with non-destructive rollback instructions.
- `src/reportAttitudes.test.ts`: values, blanks, old records, permissions and term isolation.
- `src/workspaceBatchEndpoint.test.ts`: full-response server acceptance, atomic save payload and rejection before commit.
- `src/scopedSave.test.ts`: compact acknowledgement validation and optional blank values.
- `scripts/test-incremental-storage.mjs`: real PostgreSQL migration, persistence, rollback and atomicity checks.
- `tests/reportAttitudes.spec.ts`: synthetic browser save/reopen, responsive layout, old values, term isolation and PDF checks.
- `playwright.config.ts`: registers the new browser regression.
- `docs/report-card-attitudes.md`: design, deployment, undo and verification notes.

## Verification

Full unit suite: 92 passed, 2 optional sample-file tests skipped. Local PostgreSQL migration tests passed. Lint and production build passed (existing bundle-size/dependency warnings remain). Browser test verifies one save request for remarks and all attitudes, reopening, clearing, obsolete-value review, 4/2/1 responsive columns and class printing. The exported synthetic report was rendered and visually checked: one A4 page, 4×2 attitudes box, correctly wrapped long values and literal ampersands.

Production database and real pupil records were not accessed or changed. Device-specific printer/PDF scaling and the deployed backend/frontend combination should receive a staging smoke test before release. The unrelated mobile starter and FilOne research files are excluded from these commits.
