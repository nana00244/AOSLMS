# Backend verification — 10 October 2026

Target: Supabase project `itqfnzqksuacbeemrqok`.

- Four CLI migrations applied; local and remote migration histories match.
- Both Edge Functions deployed using the CLI API bundler.
- Public signup disabled; administrator-created email/password login verified.
- Production build passed. Dependency annotation and bundle-size warnings remain non-blocking.
- Unit suite covers authorization, privacy, stale records, protected grading, account elevation, and preservation of historical coursework when students transfer classes.
- Live integration tests passed for administrator-created teacher, student and accountant accounts; cross-session persistence; student submission; teacher grading; finance payment; private file upload and authorized download; denied accountant file access; denied student self-grading/admin calls; stale-save rejection; and immediate deactivation. Temporary test users, records and files were removed.
- Live browser test passed for administrator login, session reload and navigation through the main screens of an empty school.
- Demo backup/restore regression passed after retaining its existing feedback message.

The older demo browser suite has ten existing failures. The same test cases fail on baseline commit `445f826992487f69b996c50abbbdd1ab2268fd2c`: report selectors, role-home expectations, strict heading selectors and roster-import labels. They are not treated as passing checks. The baseline comparison was run from an archived copy; its fonts also encountered the development server's filesystem allow-list restriction. No unrelated demo test expectations were rewritten.

Supabase's security advisor reports only optional leaked-password protection disabled. No paid option was enabled. RLS, denied direct workspace/profile writes, service-only commit access and private storage are also covered by the live checks and `scripts/verify-schema.sql`.

Login credentials and local CLI state are Git-ignored. The committed Supabase connection key is public/publishable, not a service-role key. SMTP delivery and a deployed frontend domain were not configured because no frontend domain was supplied. See the README for operating limits and setup instructions.
