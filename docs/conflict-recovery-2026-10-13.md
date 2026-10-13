# Persistent conflict and sign-out recovery

The screenshot shows a three-way merge conflict, not a database timeout. The
pending edit was intentionally retained in IndexedDB, but automatic retries
repeated the same conflict, the warning appeared twice, and sign-out refused
while any entry was pending. Reopening the same browser restored that queue.

Conflicted entries now persist a needs-review status and stop automatic save
attempts. The single notice can be dismissed and reopened through a compact
review button. Users can download their entries, keep their changed fields, or
explicitly discard the oldest pending save in favour of database values. Both
resolution actions require confirmation; later entries remain retained.

Sign-out now offers to retain unsynced entries for that account on this device.
Local persistence is completed separately from cloud synchronization, so sign-out
does not wait for a failing save. Supabase signs out the current session; its
logout request has an eight-second timeout, and the installed auth-js version
clears local credentials even when server logout fails. Server-side token
revocation cannot be guaranteed if that server request fails. Pending data is
never automatically deleted or silently overwritten.

Validation: 55 unit tests passed (two existing optional tests skipped), production
build passed, changed files passed formatting, and four browser regressions
passed. They cover both conflict choices, retained entries across reload and
sign-out/sign-in, notice dismissal, timeout retry, and realtime deduplication.

REA inspected a synthetic workspace-only HAR, evidence
`ev_8afcb4274789ae507a7ea8ffe2442fdcfa1e4b7178c74cc2d8d9255f3c867c27`.
Its eight requests include one rejected save (409), intervening reads, and one
successful explicitly resolved save (200) retaining the operation ID. This is
recorded test evidence, not a capture of the user's private production session.

After the frontend deployment loads, open **Show details** on the pending-save
notice to choose which version to keep. Dismissal hides the notice without
pretending the edit has synchronized.
