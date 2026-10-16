# Photo storage and save verification — 16 October 2026

Implemented the three recommendations: private photo storage, scoped save reads with compact confirmations, and measured queue recovery.

## Production changes

- Migrated all 155 embedded pupil photos to private Supabase Storage. Every upload was downloaded and SHA-256 verified before a compare-and-swap update replaced the inline photo. Zero failures or concurrent-edit conflicts; 152 distinct objects serve 155 references through content deduplication.
- Student JSON for 239 records decreased from 22,962,772 bytes to 54,782 bytes (about 99.76%). No embedded student photos remain.
- Photo URLs require current account authorization and expire after 15 minutes. Signed URLs are not persisted in workspace data. Reports preload photos before printing.
- Compatible queued map edits use scoped database context and compact acknowledgements rather than full-workspace reads and responses. Existing authorization, revision checks, operation receipts and conflict detection remain in place. Missed external revisions trigger a refresh.
- Pending files containing legacy inline photos normalize matching hashes to stored references; genuinely different photo edits remain conflicts.

## Verification

- Live two-operation no-op batch: HTTP 200, 822 ms, 65-byte response.
- Duplicate retry: HTTP 200, 974 ms, 65-byte response. Exactly two original operation receipts remained; no duplicate commit.
- Recovery preview identified unconfirmed operations, rejected another owner, then skipped confirmed operations.
- Temporary verification account, receipts and audit entries were removed.
- 82 unit tests passed; two optional tests skipped. Database migration/permission tests and production build passed.
- Browser verification passed for private photo rendering, report printing, retaining two saves through a failed request, and draining the local queue after compact server confirmation.
- REA inspected the synthetic report page and accessibility tree; no console errors were observed during its capture. This was a local fixture, not access to a user's real browser queue.

These timings measure a small authenticated no-op batch, not every workload or a controlled before/after benchmark. Earlier successful saves took 10–17 seconds; an attempted baseline during this task failed with HTTP 503. Existing user-device queues still need to retry successfully; server verification does not clear them remotely.

## Deployment and operation

Both migrations (`20261016213411` and `20261016213625`) and the workspace Edge Function were deployed. The frontend deployment for commit `cbb3c36` succeeded on Vercel. The follow-up normalizes nullable profile fields in the scoped endpoint and verifies private-photo printing.

Refresh the app to load the new client, then use Retry sync if pending entries remain. Conflicting entries still require review; they are not silently overwritten or discarded.

Workspace JSON backups now contain private photo references. Preserve the `student-photos` Storage objects alongside database/JSON backups when preparing a complete disaster-recovery backup; JSON alone does not contain those image bytes.
