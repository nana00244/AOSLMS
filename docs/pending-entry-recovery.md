# Recover pending entries

Open **Recover pending entries** on the Dashboard, or beside workspace restore in
Settings. Sign in as the account that downloaded the file.

1. Choose pending-school-saves.json (the original array format is supported).
2. Review each save's date, action, record identifiers, previous/proposed values
   and server-checked status. File previews are read-only.
3. Click Recover ready entries and sync. The server checks the file again first.
4. Wait for the pending queue to clear and verify the affected records.

Confirmed receipt IDs are skipped. Conflicts and blocked entries remain in the
file and are not imported; review those records before previewing again. Later
entries after an unresolved conflict are blocked because they may depend on it.
There is no automatic overwrite of competing database values.

Ownership is checked locally and by the authenticated server. Current staff
permissions and schema validation still apply. IDs are preserved for idempotent
retries. Imports are stored atomically in IndexedDB, existing local copies are
preserved, and cross-account local ID collisions abort the transaction.
A failed network save leaves the imported entries on the device for normal retry.

Limits: 100 saves, 20 MB per file. Full workspace backup envelopes, malformed
records, duplicate IDs and unsafe object keys are rejected. No real recovery file
was supplied during implementation; this feature lets the user upload it in-app.

Validation: 71 unit/endpoint tests passed (2 optional skipped); production build
passed; Playwright verified upload, ownership rejection, preview without writes,
confirmed-save skipping, conflict exclusion and successful local queue removal.
REA inspected the synthetic controlled-browser HAR request sequence:
ev_17caed4f4238ec7e0c1883755a52f365a1863e240ffdbe854ed9a0ecf39a36fa.
This is controlled mocked traffic, not evidence of production recovery.

The workspace Edge Function was deployed. Live temporary-account verification
was blocked by Supabase Auth gateway timeouts. The temporary account created
before the timeout was subsequently removed directly from the database. No pupil
records were changed by that attempted check.
