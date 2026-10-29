# Ayisatu Owen Schools

School administration and learning management app with a deployed Supabase backend: authenticated administrator, teacher, student and accountant workspaces; cloud academic and finance records; and private learning files.

## Run

Requires Node.js 22.12+ and npm.

```sh
npm ci
npm run dev
npm run build
```

The app connects to Supabase project `itqfnzqksuacbeemrqok` by default. `src/supabase-project.json` contains only the public project URL and publishable key. Database access is protected on the server; the service-role key is never shipped to the browser. Optional `.env.local` values override the public connection settings.

The app requires Supabase sign-in and has no demo workspace. Empty schools start without sample records or preset fees. Missing report-card values remain blank until entered or calculated from recorded assessments.

## First use

1. Sign in using the administrator credentials generated during setup. On the setup computer these are in `.temp/admin-credentials.json`, which is excluded from Git. This is a local credential handoff, not an email invitation.
2. Set the school details and term in **Settings**.
3. Add classes in **Classroom**, then admit or import students in **Student directory**.
4. Open **Users & access** to create a **username and password**. No email address or `@` is required. Usernames are case-insensitive, 3–32 characters, start with a letter or number, and allow letters, numbers, dots, underscores and hyphens. Link student accounts to existing roster records. Share credentials directly with the intended user.
5. For teachers, check any number of classes and choose the teaching role independently for each class. For example, select **All subjects (class teacher)** in Class A and **Selected subjects (subject teacher)** → Mathematics in Class B for the same teacher. Selecting individual subjects requires at least one subject. Timetable entries do not grant access.
6. Users sign in with their username and password. Existing email accounts, including the original administrator, retain email login unless assigned a username. Administrators can rename usernames, reset passwords and deactivate/reactivate accounts from the same screen. Renaming a username replaces the previous login. Passwords require at least 12 characters. A first-login password change is not forced.

Public signup is disabled. The email login provider remains enabled (`auth.email.enable_signup=true`), while the global `auth.enable_signup=false` prevents self-registration. Disabling the email provider would also prevent existing users from logging in.

### Student login credentials

In **Student directory**, use the key icon beside a student to open **Student login credentials**. The roster record and name are selected automatically. Set a username and a password of at least 12 characters, then choose **Create login account**. For a student who already has an account, the same icon opens that account so an administrator can reset the password or reactivate access without creating a duplicate.

Students sign in on the normal login screen and land on their class stream dashboard. Their navigation includes assignments, fees, report cards, performance, certificates and schedule, with access scoped to their student record. Passwords cannot be retrieved from the app; assign a new password if one is forgotten.

Run `node scripts/verify-with-temporary-admin.mjs --student-logins` for the opt-in live browser regression test. It verifies creation through the directory, username login, all student portal pages, session persistence and password reset, and removes its temporary account and roster record afterward.

## Deployed backend

### Import monthly attendance

Open **Attendance → Import attendance CSV** and select a monthly register. The sample format has a `Class: BS 1 | Month: September 2026` heading, `Student Name` and optional `Admission Number` columns, and daily columns such as `Sep 08`. Full status names or P/L/A/E are accepted; totals and percentages are ignored.

Review the detected month, target class, term, student matches and replacement count before importing. `BS 1` can match `Basic 1` or a single Basic 1 stream; multiple possible streams require a class selection. Matching is limited to the selected class, uses admission numbers first, then names with punctuation/word-order differences, then conservative spelling similarity. Ambiguous names, duplicate student rows and unmatched students are skipped. Students missing from the file, blank cells and unrecognised statuses retain their existing attendance. Recognised marks replace existing marks only for the same student/date/term. Conflicting months and invalid or duplicate dates block the import. The attendance screen supports selecting historical terms.

### Storage and access

- Supabase Auth handles passwords and sessions. Plain usernames map internally to a reserved, non-deliverable email alias; users do not need to enter or own that address. Username accounts use administrator password resets, not email recovery. Unique usernames are enforced in the database.
- `profiles` holds server-managed roles, active status, student links, and teaching scope.
- `school_workspace` stores the complete school model as a versioned JSON document: classes, students, attendance, coursework, submissions, grades, reports, resources, timetables, certificates, announcements, payments, fees, concessions, expenses, payroll and settings.
- The `workspace` Edge Function verifies the signed-in user and current active profile on every request. It returns only the authorized projection and checks both the original and replacement record on writes. Teachers are restricted by class and subject; students see their own records and cannot grade work; accountants access finance records.
- Browser roles have no direct access to the workspace table or its privileged commit RPC. RLS is enabled. Commits and audit inserts run atomically, with revision checks rejecting stale saves instead of silently overwriting another user's work. Class renames update teacher access in the same transaction.
- `admin-create-user` requires a current, active administrator. It creates confirmed accounts, updates credentials/profiles, or deactivates access. Inactive accounts lose data access even if an earlier access token has not expired.
- `learning-files` is a private Storage bucket. Active school users upload into their own folder; authorized downloads use short-lived signed URLs. PDF, supported Office files, text and images are limited to 5 MB.
- `audit_log` records server timestamps and authenticated actors. The app displays the latest 1,000 events.

The original starter relational academic tables are retained by the migration history but are not used by the running app or exposed to browser roles. School data currently uses a single transactional document. This keeps the existing detailed models intact; it is suitable for a small school, but large deployments should split high-volume collections into indexed relational tables. Realtime revision notifications refresh open views, with navigation, focus and periodic refresh as fallbacks.

Workspace saves are retained on the device before transmission and confirmed only after Supabase commits them. Transactional operation receipts prevent duplicate retries. Unrelated concurrent fields merge; conflicting fields remain pending for review. Pending entries survive reload and retry when connectivity returns, but remain local until confirmed. See [report cards and saving](docs/report-cards-and-saving.md) for class batch printing and recovery behavior, and [assessment uploads](docs/assessment-uploads.md) for teacher score-sheet imports.

## CLI deployment

Supabase CLI 2.120.0 is pinned as a development dependency. This repository is already initialized; do not overwrite `supabase/config.toml` with `init --force`.

```sh
npx supabase login
npx supabase link --project-ref itqfnzqksuacbeemrqok
npx supabase db push --dry-run
npx supabase db push
npx supabase functions deploy --use-api --import-map supabase/functions/deno.json
npx supabase config diff
npx supabase config push
npx supabase db advisors --linked --type security
```

The Edge Functions disable gateway legacy-JWT verification so current signing keys work; both handlers explicitly verify the bearer token using `auth.getUser()` before doing any work. Do not remove that verification.

For a fresh project, replace the project reference/public connection settings and run `node scripts/bootstrap-admin.mjs ADMIN_EMAIL` after deploying migrations. The bootstrap script uses the logged-in CLI, refuses to overwrite an existing administrator, and writes generated credentials only to a Git-ignored local file.

For local Supabase development, Docker Desktop is required: `npm run supabase:start`. Production deployment uses the CLI API bundler and does not require Docker. `supabase db reset` is for a disposable local database only.

When hosting the frontend, set `auth.site_url` and `auth.additional_redirect_urls` to its HTTPS URL before using email recovery or redirect-based flows. Current configuration uses localhost because no deployment URL was supplied. Ordinary administrator-created email/password sign-in works without email delivery. SMTP recovery/invitation delivery has not been configured.

## Verification

### Learning Hub

Open **Learning Hub** in the administrator, teacher or student navigation. The old `/khan` link redirects to `/learning-hub`.

- **Courses:** browse by subject, level or search; open a lesson to read explanations and practise.
- **Create lesson:** teaching staff can write original content, cite a curriculum standard/source, and add multiple-choice questions with explanations.
- **Assign lesson:** choose a class, all current class members or selected students, and a due date. Class assignments capture the selected roster at assignment time.
- **Assignments:** students open their assigned lessons, acknowledge reading and submit practice. Both learning steps are required for completion when questions are present.
- **Progress:** filter by class/learner, review latest scores and attempt history, export CSV, or assign recommended practice to a learner. Average scores include all attempts; proficiency uses the latest attempt. Suggestions are transparent score-based guidance, not an AI diagnosis.
- **Curriculum resources:** open the source documents for broader planning. The initial catalog covers 18 selected B7–B9 Mathematics and Science standards with 54 questions; it is not a complete NaCCA course library. Teachers can extend it through the lesson editor.

The authenticated `learning-hub` Edge Function stores lessons, assignments, readings and attempts in dedicated `learning_hub_*` tables. These records are separate from the legacy workspace JSON backup; include them in database backups. Only server-authorized operations can write to those tables. Practice is graded on the server, answer keys are withheld before submission, and current class/subject permissions constrain access. External document views are not tracked as completed lessons. Reading acknowledgement is self-reported and does not measure time spent.

See [REA findings](docs/learning-hub-rea.md) and [curriculum source/coverage details](docs/learning-hub-curriculum.md). Run `npm run test:e2e -- tests/learningHub.spec.ts` for isolated browser tests or `node scripts/verify-learning-hub.mjs` for opt-in live authorization and persistence verification with temporary fixtures. New deployments must apply the migration and deploy the `learning-hub` function as well as the frontend.

```sh
npm test
npm run build
npm run test:e2e
node scripts/verify-backend.mjs
node scripts/verify-backend-workflows.mjs
node scripts/verify-with-temporary-admin.mjs
```

For the production browser checks, set `AOS_CLOUD_TESTS=1` and run `npm run test:e2e`, or use the temporary-administrator wrapper below. The old demo browser suite is retained as historical coverage and is not a production acceptance test. Live tests read the local credential file and do not print its contents. `verify-backend-workflows.mjs` temporarily creates uniquely named test records/accounts, verifies permissions and persistence, and removes its fixtures and files afterward. Run it against a test environment before broad deployments.

`verify-with-temporary-admin.mjs` uses the logged-in Supabase CLI to create an isolated administrator, runs the live workflow and browser tests, and removes that account and its temporary credential file afterward. It never resets an existing administrator password. Its browser test creates a plain username through the actual form, assigns mixed class/subject permissions, and signs in as that teacher.

On Windows, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an installed Chrome/Edge executable, or install Playwright Chromium. No cloud-test traces are retained because they could contain login requests.

Verified workflows include administrator-created role accounts, login and session reload, student submissions, teacher grading, finance payments, private uploads/downloads, rejection of self-grading and unauthorized admin/file access, stale-write detection and immediate deactivation.

## Operational notes

JSON exports contain school records and file references, not Auth credentials or file binaries. Restoring retains current login accounts. Keep database and Storage backups separately. Removed/replaced attachments remain private in Storage; automatic orphan cleanup is not implemented.

The final security advisor reported optional leaked-password protection disabled. Enable it in Supabase Auth if available on your plan. No paid features were enabled during setup.

Payments are school ledger entries; this app does not process bank/card payments. Printing uses the browser's print/PDF facilities. Administrators and teachers can generate score-based AI remark drafts, review/edit them, and save them to report cards. See [AI remarks setup and privacy](docs/ai-report-remarks.md). Direct messaging and attachment malware scanning are not included.
