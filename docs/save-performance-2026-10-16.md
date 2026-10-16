# Save performance investigation — 16 October 2026

The Pro upgrade does not remove the application's large-document processing.
Before changes, production query statistics showed snapshot reads averaging
5,995 ms (25 calls, maximum 17,031 ms) and legacy pending commits averaging
15,703 ms (4 calls, maximum 16,999 ms). Student records alone contained
20,768,664 bytes of JSON, including embedded photos. No blocking sessions were
observed in the sampled lock inspection; that does not rule out intermittent locks.

## Changes

- Student/photo edits, settings edits and score imports now submit changed rows
  instead of a full workspace replacement. Existing map batching remains intact.
- Preserve revision compare-and-swap, per-operation receipts, profile revocation,
  audit entries and realtime notifications. Existing pending operation IDs work.
- Reuse a bounded isolate-local snapshot only after checking its database revision.
  Errors never fall back to stale cached permissions. Cold instances still read data.
- Assemble snapshot responses with JSON aggregators, avoiding repeated construction
  of large nested JSONB objects. One MVCC statement reads revision, rows and profiles.
- Both new RPCs are callable only by the service role behind the authenticated
  Edge Function. No client permissions or global database timeouts were widened.

## Measurements and checks

A production photo-row delta probe, rolled back without persistent pupil changes,
completed its database execution in 52 ms with no temporary-block I/O. This is a
controlled database measurement, not an end-to-end saving guarantee.

A read-only comparison measured the compatibility workspace view at 2,057 ms
versus 580 ms for the new JSON snapshot assembly. Workload and cache state affect
these figures. The first live sync check after the delta/cache change still took
12,896 ms for a batch and 11,980 ms for its duplicate retry; this prompted the
additional snapshot serialization change.

After deployment, a second live check succeeded at 17,019 ms for the batch and
10,354 ms for its duplicate retry. Both recovery previews and ownership rejection
passed; temporary accounts, receipts and audit entries were removed. These samples
do **not** demonstrate an end-to-end latency improvement. Full RPC reads still
dominated (five calls averaged 8,945 ms); separate direct reader probes ranged
from 791 to 6,267 ms. Database/response variability and cold full snapshots remain
material. Do not describe the 52 ms row-write measurement as the user-visible rate.

Validation: 76 unit tests passed (two optional fixture tests skipped), PostgreSQL
semantics tests passed, and the production build passed. Tests cover unchanged
photos, nulls, array ordering and duplicate IDs, stale revisions, duplicate
receipts, student-account revocation, permission refresh and RPC privileges.
Live verification uses a temporary account and empty changes; it checks recovery
ownership and already-confirmed saves without modifying pupil records.

## Remaining limits

Full workspace responses still include embedded photos; cold loads and network
transfer can remain slower than a single row write. Isolate caching is best effort,
not durable storage. Pending entries on a user's browser cannot be confirmed cleared
by server-only tests. Keep the downloaded recovery file and wait for the app to
report zero pending entries. Conflicting edits still require review, not overwriting.
