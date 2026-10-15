# Save performance investigation — 15 October 2026

## Measurements before changes

Live pg_stat_statements (cumulative completed calls, not a controlled benchmark):
- commit_workspace_once: 14 calls, mean 12,476.97 ms, max 16,262.63 ms;
  24,719 temporary blocks written (about 193 MiB cumulatively at 8 KiB/block).
- read_workspace_snapshot: 40 calls, mean 4,119.27 ms, max 9,028.79 ms.
- Receipt lookups: mean 6.32 ms.
- PostgreSQL logs contained 11 statement-timeout events in the queried 24-hour window.
  These logs alone do not attribute every timeout to a specific statement.

The workspace contains 239 student records totaling 13,280,012 JSON bytes.
Assignments add 1,277,024 bytes. Ordinary saves were reading the complete workspace,
resending it for full-document comparison, then reading it again after committing.

Read-only direct RPC measurement: full snapshot 15,156,519 bytes / 6,443 ms;
unchanged revision response 36 bytes / 344 ms. The retained HAR omits credentials
and school record bodies. REA inspected it as historical producer evidence:
ev_da8068827ed3064150e9f7c8db3da6b302d5e172f85eb107e6558982378d4f04.
This is API timing, not a browser trace. A warm database-only snapshot EXPLAIN
measured 400.6 ms, showing that RPC serialization/transfer adds substantial cost.

## Indexes and locking

workspace_entries has (section, entry_key), workspace_save_receipts has
(actor, operation_id), and workspace_head has its primary key. An EXPLAIN ANALYZE
of the grades lookup used the existing index-only scan (2.09 ms total).
No blocked sessions appeared in the sampled pg_stat_activity results; historical
contention remains possible. All saves serialize on workspace_head, so reducing
time under that lock matters. No speculative indexes were added.
Performance advisor findings were informational unused indexes; they were retained
because the sampling window does not justify deleting them:
https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index

## Changes

- New service-only commit_workspace_maps_once RPC writes only edited map keys.
  It skips equal values, preserves the global revision CAS and records each original
  operation ID and audit event in the same transaction.
- Grades, attendance, remarks, conduct, fees, concessions and bills use this path.
  Imports, photos, student deletions, profiles and ordered collections retain the
  existing path because they can have other side effects.
- The browser combines up to 10 contiguous compatible saves, bounded by payload
  and change counts. Failed batches fall back to individual operations; local
  entries are removed only after confirmation. Lost-response retries use receipts.
- Successful targeted commits reuse their validated snapshot; already-completed
  batches reuse it only when all receipts are covered by its revision.
- Old timeout text clears when a fresh sync attempt starts.
- Authorization uses the profile from the consistent workspace snapshot.

## Verification and limits

A live targeted write inside a rolled-back transaction measured 37.28 ms with zero
 temporary blocks. The probe was confirmed absent afterward. This is not directly
comparable to cumulative full-save API timings and is not an end-to-end guarantee.

PostgreSQL regression tests cover unchanged photo tuples, atomic receipts, stale
revisions, partial receipt batches, prohibited collections and private function
permissions. Unit/endpoint tests cover ordered same-record changes, authorization,
conflicts, snapshot reuse and queue boundaries. Production build passed.

The migration and workspace function were deployed. A temporary teacher account
verified a two-operation no-op batch and its retry without changing pupil records;
account, receipts and test audit entries were cleaned up.

Remaining limitation: initial loads and each batch still read the full document;
large photos remain embedded in it. Moving media to object storage and introducing
incremental read responses would be a separate data migration. The free-tier
resource ceilings remain unchanged. Non-map saves still use the legacy path.

Reproduction: scripts/measure-workspace.mjs (read-only live RPC timing),
scripts/verify-save-batch.mjs (temporary account/no-op live test),
npm run test:database, npm test, npm run build.

Security advisor retained existing informational RLS-without-policy findings for
service-only tables (browser grants remain revoked) and an existing leaked-password
protection warning; neither was introduced by this migration:
https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

Final live no-op verification: batch 6,224 ms; duplicate retry 7,256 ms. Before removing the redundant retry snapshot, a prior retry measured 11,584 ms. These are individual samples, not a statistical latency guarantee. Final unit suite: 67 passed, 2 optional skipped.
