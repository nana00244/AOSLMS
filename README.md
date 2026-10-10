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

Use `VITE_DEMO_MODE=true` explicitly to explore the isolated browser-local demo. Real accounts start with an empty school, and demo data is never automatically uploaded.

## First use

1. Sign in using the administrator credentials generated during setup. On the setup computer these are in `.temp/admin-credentials.json`, which is excluded from Git. This is a local credential handoff, not an email invitation.
2. Set the school details and term in **Settings**.
3. Add classes in **Classroom**, then admit or import students in **Student directory**.
4. Open **Users & access** to create email/password accounts. Assign teachers to classes and subjects; link each student login to its existing roster record. Share the credentials directly with the intended user.
5. Users sign in with the email and password provided by the administrator. Administrators can change passwords and deactivate/reactivate accounts from the same screen. Passwords require at least 12 characters. A first-login password change is not forced.

Public signup is disabled. The email login provider remains enabled (`auth.email.enable_signup=true`), while the global `auth.enable_signup=false` prevents self-registration. Disabling the email provider would also prevent existing users from logging in.

## Deployed backend

- Supabase Auth handles email/password credentials and sessions.
- `profiles` holds server-managed roles, active status, student links, and teaching scope.
- `school_workspace` stores the complete school model as a versioned JSON document: classes, students, attendance, coursework, submissions, grades, reports, resources, timetables, certificates, announcements, payments, fees, concessions, expenses, payroll and settings.
- The `workspace` Edge Function verifies the signed-in user and current active profile on every request. It returns only the authorized projection and checks both the original and replacement record on writes. Teachers are restricted by class and subject; students see their own records and cannot grade work; accountants access finance records.
- Browser roles have no direct access to the workspace table or its privileged commit RPC. RLS is enabled. Commits and audit inserts run atomically, with revision checks rejecting stale saves instead of silently overwriting another user's work. Class renames update teacher access in the same transaction.
- `admin-create-user` requires a current, active administrator. It creates confirmed accounts, updates credentials/profiles, or deactivates access. Inactive accounts lose data access even if an earlier access token has not expired.
- `learning-files` is a private Storage bucket. Active school users upload into their own folder; authorized downloads use short-lived signed URLs. PDF, supported Office files, text and images are limited to 5 MB.
- `audit_log` records server timestamps and authenticated actors. The app displays the latest 1,000 events.

The original starter relational academic tables are retained by the migration history but are not used by the running app or exposed to browser roles. School data currently uses a single transactional document. This keeps the existing detailed models intact; it is suitable for a small school, but large deployments should split high-volume collections into indexed relational tables. Concurrent edits can require a reload and retry. Views refresh on login, reload, window focus, and successful saves; this is not a realtime subscription.

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

```sh
npm test
npm run build
npm run test:e2e
node scripts/verify-backend.mjs
node scripts/verify-backend-workflows.mjs
```

The standard browser suite runs in explicit demo mode. For the live administrator browser smoke test, set `AOS_CLOUD_TESTS=1` and run `npm run test:e2e`. Live tests read the local credential file and do not print its contents. `verify-backend-workflows.mjs` temporarily creates uniquely named test records/accounts, verifies permissions and persistence, and removes its fixtures and files afterward. Run it against a test environment before broad deployments.

On Windows, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an installed Chrome/Edge executable, or install Playwright Chromium. No cloud-test traces are retained because they could contain login requests.

Verified workflows include administrator-created role accounts, login and session reload, student submissions, teacher grading, finance payments, private uploads/downloads, rejection of self-grading and unauthorized admin/file access, stale-write detection and immediate deactivation.

## Operational notes

JSON exports contain school records and file references, not Auth credentials or file binaries. Restoring retains current login accounts. Keep database and Storage backups separately. Removed/replaced attachments remain private in Storage; automatic orphan cleanup is not implemented.

The final security advisor reported optional leaked-password protection disabled. Enable it in Supabase Auth if available on your plan. No paid features were enabled during setup.

Payments are school ledger entries; this app does not process bank/card payments. Printing uses the browser's print/PDF facilities. AI comments, direct messaging and attachment malware scanning are not included.
