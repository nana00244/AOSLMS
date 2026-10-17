# Weekday-only attendance — 17 October 2026

The register previously included weekends whenever a saved mark existed, and its date input allowed weekend recording. It now uses a month picker plus a weekday-only date selector. Monthly screens and printing always contain Monday–Friday columns, including future months and leap years. UTC calendar checks avoid device timezone changes.

CSV parsing and import construction both skip weekend marks. The preview counts them as skipped. Shared server validation rejects weekend and invalid dates; a PostgreSQL constraint also rejects non-weekday attendance entries. Dashboard and report-card attendance calculations ignore legacy weekend entries if a stale client snapshot still contains them.

Migration `20261017144856_weekday_attendance.sql` was applied and the workspace Edge Function deployed. It serializes with workspace saves, keeps a restricted copy in `private.weekend_attendance_recovery`, removes non-weekday marks from active storage, clears only attendance total overrides on affected reports and publishes a new revision. Other report fields, grades and remarks are preserved.

Production verification: 57 weekend marks removed; 55 affected report overrides cleared; 5,069 weekday records retained; zero non-weekday entries remain. Weekday data checksum before and after: `812d0a5177cdd4853b3a54359a0a5862`. Recovery copies are not active attendance and are inaccessible to ordinary clients. Restoring them would require an explicit rollback of the weekday-only rule and a reviewed administrator operation; do not reinsert them during ordinary recovery.

Validation: 95 unit tests passed, 2 optional sample-file tests skipped; local PostgreSQL migration tests, TypeScript lint and production build passed. Six browser regressions passed across attendance, report editing, private photos, conflicts and pending-file recovery (the attendance test was rerun after correcting its tab locator). The attendance browser fixture explicitly includes old weekend marks and verifies they do not appear in the monthly table, dropdown or report attendance counts.

This is a Monday–Friday rule, not a holiday calendar. Weekday holidays are not automatically excluded. Existing manual report overrides on unrelated reports are unchanged.
