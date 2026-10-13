# Report cards and confirmed saves

Select a class on Report cards to restrict the student list. **Print selected class** prepares one report per pupil for the selected term, with a page break between reports. The existing **Print / Save PDF** prints the selected pupil. Printing is disabled while this device has pending saves.

Reports show recorded grades, attendance and remarks. Missing entries remain blank or an em dash; the app does not invent conduct, attendance, teacher remarks, ranks or official stamps. Opening coursework does not create assignments. Empty workspaces start without sample students, classes or financial records.

Workspace saves are retained in IndexedDB before being sent to the authenticated Supabase workspace function. Forms report success only after the database confirms the operation. A connection failure leaves the form open and shows a pending-save banner. Retained operations survive reload and retry on reconnect, navigation, focus and periodic refresh. Use **Retry sync** to retry immediately or **Download pending entries** to keep an additional copy.

Pending entries are local until Supabase confirms them: do not clear browser storage while they are pending. Closing the browser during the initial local write or losing the device cannot provide a cloud backup. The app warns before leaving with pending writes and blocks sign-out until they are synced.

Each operation has an authenticated-user-scoped UUID receipt committed in the same database transaction as the workspace update. Retrying after a lost response cannot repeat the mutation. Unrelated concurrent fields merge; competing changes to the same field remain pending for review. The explicit **Keep my changed fields and retry** action preserves the user's changed fields after confirmation.

Supabase remains the source of confirmed records. Pages reload records on navigation, and realtime revision notifications refresh open sessions. Authorization is checked server-side for every mutation. Save receipts and the workspace document are service-only tables with RLS enabled; browsers cannot write them directly.

Verification: `scripts/verify-with-temporary-admin.mjs --production` exercises class filtering, two-report PDF printing, failed-save retention across reload, cloud recovery, receipt idempotency and concurrent field merging using isolated records. `--score-import` checks teacher uploads and updates to an already-open report. Temporary accounts and fixture records are removed after verification.

Verified on 13 October 2026: production build passed; 49 unit tests passed including the supplied score CSV (one optional roster fixture test skipped); all four live browser tests passed. The live backend workflow checks also passed for permissions, cross-session persistence, billing, submissions, grading and private files. The database migration is applied, the workspace function is deployed, and SQL checks confirmed that save receipts and the commit function cannot be accessed directly by authenticated browsers. The two-page class PDF was rendered and visually inspected.
