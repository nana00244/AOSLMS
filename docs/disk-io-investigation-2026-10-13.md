# Disk I/O investigation and current-plan optimization

The Supabase warning describes exhaustion of burst disk throughput. The current
instance can continue at its baseline (5 MB/s in the supplied warning), and the
budget replenishes below that baseline. Software changes cannot remove hosted
plan limits. No plan, billing, compute size or feature entitlement was changed.

## Observations

- The workspace was one 7,262,802-byte JSON document, including inline photos.
- Historical statement statistics attributed 313,026,848 WAL bytes to 73 durable
  saves. WAL is transaction-log traffic, not a measurement of total physical I/O.
- A small settings edit rewrote the document even when photos were unchanged.
- Realtime notifications could cause redundant reads after a save response had
  already supplied that revision.

## Changes

The database now stores 6,942 individual array records/map entries plus a 362-byte
structural header. A security-invoker compatibility view reconstructs the original
document for existing backend readers. Commits compare records and write only
changes; array reordering reuses unchanged photo values. The migration asserts
exact JSON reconstruction before replacing the original document with its header.
The live document digest and revision were identical before and after migration.

CAS locking, durable operation receipts, profile revocation, audit logging and
realtime revision publication remain intact. New tables have RLS enabled with no
browser grants. Existing authenticated APIs still apply role-scoped projections.

An intermediate measurement exposed temporary-disk spill at the instance's
2,184 kB work-memory default. A follow-up migration scopes 32 MB work memory to
workspace assembly/diff functions only. This is a per-operation allowance, not
a global database increase; writers are serialized before computing their diff.
Higher future concurrency or larger documents still need capacity measurements.

The client skips own/duplicate realtime revisions after the current save completes,
while newer remote edits, reconnect checks and periodic catch-up remain active.
Unchanged form submissions continue to avoid writes.

## Verification

The same settings edit was measured using `EXPLAIN (ANALYZE, BUFFERS, WAL)` inside
rolled-back transactions; no school edit or audit entry was retained:

| Metric | Original storage | Final storage |
| --- | ---: | ---: |
| WAL bytes | 12,855,450 | 5,132 |
| Temporary blocks written | 0 | 0 |
| Execution time | 1,722 ms | 521 ms |

This is about 99.96% less WAL for this operation, not a guarantee for every request.
Cache state and checkpoint full-page images affect these measurements. The first
incremental implementation spilled temporary data; it was corrected and remeasured
before completion. A single ordinary vacuum reclaimed reusable old header/TOAST
space after migration; no `VACUUM FULL`, record deletion or quota workaround ran.

`npm run test:database` uses pinned PGlite with synthetic records to exercise exact
migration roundtrips, incremental tuple writes, stale CAS rejection, idempotent
retry, array insert/reorder/delete, duplicate IDs, empty/null sections, profile
revocation, realtime, and browser/service-role privileges. Run it locally with
the command above. GitHub's connected OAuth account lacks workflow-edit scope,
so the existing CI workflow was preserved.
55 unit tests passed (two optional tests skipped), the production build passed,
and both browser regressions passed (timeout recovery and realtime deduplication).
Changed JavaScript/TypeScript/JSON files pass formatting. The repository-wide
format check still reports 19 pre-existing files outside this change; unrelated
formatting was not rewritten as part of the database optimization.

REA inspected a synthetic browser HAR, evidence
`ev_f9c46a1f58a9b0d2422f696b2d4bdd0a9c8c852c1a591c2fe662ac8d30e080fd`:
86 recorded requests, including workspace records 77 (initial load), 81 (one save),
and 82 (load with known revision 2 after an external revision). Own/older events
did not add a load. This is retained test evidence, not production runtime or
deployment attribution. The full retained evidence was exported locally after
the MCP response exceeded its transport limit.

Post-deployment advisors report the expected informational
[RLS-without-policies notices](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
for intentionally service-only tables and the pre-existing
[leaked-password protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
No new security warning was introduced. The warning's current burst-budget
percentage was not available through SQL; allow the budget to recover and check
Database Health under the normal workload. There is no claim of unlimited capacity.

References: [Supabase disk I/O guidance](https://supabase.com/docs/guides/troubleshooting/exhaust-disk-io),
[PostgreSQL view security](https://www.postgresql.org/docs/current/sql-createview.html).
