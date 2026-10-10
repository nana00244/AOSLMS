# Backend verification — 10 October 2026

Target: Supabase project `itqfnzqksuacbeemrqok`.

- Five CLI migrations applied, including unique usernames.
- Both Edge Functions deployed using the CLI API bundler.
- Public signup disabled; administrator-created username/password login and legacy email login supported.
- Production build passed. Dependency annotation and bundle-size warnings remain non-blocking.
- All 23 unit tests passed, covering authorization, privacy, stale records, protected grading, account elevation, historical coursework, username normalization and mixed teaching assignments.
- Live integration tests passed for administrator-created teacher, student and accountant accounts; cross-session persistence; student submission; teacher grading; finance payment; private file upload and authorized download; denied accountant file access; denied student self-grading/admin calls; stale-save rejection; and immediate deactivation. Temporary test users, records and files were removed.
- Live username tests passed for all account roles, case-insensitive duplicate rejection, invalid usernames, username renaming/password resets, mixed all-subject and subject-only assignments, and denied out-of-subject reads/writes.
- Both live browser tests passed: administrator login/reload/navigation, and creating a plain username through the account form, assigning all subjects in one class and Mathematics in another, then logging in and reloading as that teacher.
- Verification used a temporary CLI-created administrator because the original local setup credentials no longer authenticated. Existing administrator credentials were not changed. Temporary verification accounts and fixture records were removed.
- Demo backup/restore regression passed after retaining its existing feedback message.

The older demo browser suite has ten existing failures. The same test cases fail on baseline commit `445f826992487f69b996c50abbbdd1ab2268fd2c`: report selectors, role-home expectations, strict heading selectors and roster-import labels. They are not treated as passing checks. The baseline comparison was run from an archived copy; its fonts also encountered the development server's filesystem allow-list restriction. No unrelated demo test expectations were rewritten.

Supabase's security advisor reports only optional leaked-password protection disabled. No paid option was enabled. RLS, denied direct workspace/profile writes, service-only commit access and private storage are also covered by the live checks and `scripts/verify-schema.sql`.

Login credentials and local CLI state are Git-ignored. The committed Supabase connection key is public/publishable, not a service-role key. SMTP delivery and a deployed frontend domain were not configured because no frontend domain was supplied. See the README for operating limits and setup instructions.
