# Offline use and recovery

## Prepare each device

1. Open the deployed Vercel HTTPS link in the browser you will use remotely. Sign in and wait for **Ready for offline use** above the workspace.
2. Expand the status and choose **Protect offline storage**. The browser decides whether to grant persistent storage. Download a separate workspace backup before extended trips.
3. Open Learning Hub online to cache the account's authorized remote lessons and assignments. Built-in curriculum assets are included in app preparation.
4. Keep the account signed in. Reopen the same origin in the same browser, or use the browser's installed-app shortcut. A different device, browser profile, or Vercel preview hostname needs its own preparation.
5. After reconnecting, open the app and wait until pending entries finish syncing. Review any conflicts. If the session is revoked or the account is disabled, reconnect and resolve access before syncing; retained entries are not silently discarded.

No first visit or new login can happen without a connection. The downloaded app is what runs offline, not a connection to Vercel's servers.

## What works

| Activity                                                                                     | Offline behavior                                                                                                                        |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Prepared app and school workspace                                                            | Reopens from browser caches, including when the existing token has expired.                                                             |
| Roster, attendance, coursework, grades, remarks, timetable, ledger and other workspace edits | Written to IndexedDB before the UI reports success. Pending changes overlay the last authorized snapshot.                               |
| CSV imports and local exports                                                                | Work on retained workspace data. Photo/file operations requiring Storage are separate.                                                  |
| Reports                                                                                      | Can print local drafts while disconnected or awaiting sync. Unavailable photos require confirmation before omission.                    |
| Built-in adaptive practice                                                                   | Completed auto-marked responses stay on the device and retry with the same attempt ID. Server grading remains authoritative after sync. |
| Previously loaded remote lessons/assignments                                                 | Read from an account-specific learning cache. Reading acknowledgements queue for sync.                                                  |
| New sign-in, password/account changes, AI generation                                         | Require internet.                                                                                                                       |
| New file uploads, private downloads, uncached photos, external websites/videos               | Require internet. These are not blanket-cached by the service worker.                                                                   |
| Server-graded fixed lesson quizzes, remote lesson creation/assignment                        | Require internet; the UI reports this and retains the open form. Unsaved form drafts do not survive closing the page.                   |
| Custom local quizzes and teacher-review practice                                             | Existing device-local behavior remains; this change does not add server storage for those features.                                     |

Only saved edits and completed retained attempts are durable. Unsaved typing or an unfinished practice session is not a committed operation. A local save is not a cloud backup. Background sync while every app tab is closed is not promised: reopen the app after connectivity returns.

## Storage, access, and updates

The service worker precaches the complete emitted build and public asset inventory: app HTML, JavaScript chunks, CSS, local fonts, curriculum JSON, icons and sounds. It handles only inventory assets and the app entry navigation. It does not cache authentication/API responses or arbitrary private media. An update waits for existing app tabs to close; it never forces a reload while work is in progress.

Workspace snapshots contain only the server-authorized projection for their account. Offline access requires an existing locally retained session for that same account and a previously downloaded snapshot. Local session data never authorizes a database write. On reconnect the server verifies current identity and permissions; expired credentials may need an online sign-in. A 401/403 load denial does not fall back to the cached workspace. Explicit logout disables offline reopening and deletes cached workspace/learning snapshots, while retaining pending work for the original account.

Offline operation necessarily uses the last downloaded permissions and records. Permission changes made elsewhere cannot be observed until reconnection. Use a protected device/browser profile for confidential school records. Signing out is appropriate on shared devices; an offline workspace is not an encrypted vault.

Each pending workspace operation has a stable ID and account owner. New local operations receive a transactionally assigned order so rapid saves and clock changes do not reorder the live queue. Confirming a save writes the returned snapshot and retires acknowledged queue entries in one IndexedDB transaction. If that transaction fails, the entries remain retryable. Existing server receipts prevent duplicate mutations after a lost response. Conflicting fields stay pending until explicitly resolved; unrelated changes use the existing server merge rules.

Browser quotas, denied storage access, user-cleared site data, private browsing cleanup, browser eviction, and device loss remain real limits. The app reports local write failures instead of claiming success. Persistent storage reduces automatic eviction where granted, but is not a backup. Workspace JSON backups contain records and file references, not attachment binaries, Auth credentials, or separate Learning Hub database tables. **Download pending entries** preserves the workspace operation queue; its existing import limit is 100 entries/20 MB per file.

## Verification and REA evidence

The active source checkout is `.github-sync`; the outer workspace contains older copies. No database schema changes are required for this frontend implementation.

REA inspected the existing built `dist` artifact (SHA-256 `191a89e2c7222883f0066d559f506e4df39d204f42c55256db044eca61f63d0f`). Retained analysis: `ev_3ccc7eadf901179768744205437ae17b814dbfca8ea37d65d94956b9e626d17a`; summary: `ev_7c2ada577fdd68b360016e287c84f8e2ea5b018476b68603797d4598bb5f779e`. It inventoried 235 relevant files and parsed four JavaScript files. Semantic analysis was partial because a large bundle exhausted the worker heap and another exceeded the semantic result budget. This is static artifact evidence, not proof of execution or a complete behavioral audit.

Source inspection established the existing pending-save receipts, snapshot fallback, forced service-worker updates, and incomplete asset caching. Production browser tests exercise the proposed replacement under simulated network loss. They use isolated fixtures rather than real school records:

```sh
npm test
npm run test:offline
npm run test:e2e -- tests/conflict.spec.ts tests/learningHub.spec.ts
```

On Windows set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an installed Chromium/Edge binary. Deploy the resulting frontend before expecting these changes on the public Vercel link. Browser tests with mocked APIs establish client behavior; they do not prove a live production deployment or eliminate the need for server backups.

Verified locally on 24 November 2026: production build and formatting checks passed; 220 unit tests passed (two optional fixture tests skipped); 10 production offline browser tests, four conflict/recovery browser tests, and all 27 Learning Hub browser tests passed. The offline suite includes expired-session reopening, retained edits after reload, lost responses, conflicts, draft printing, account isolation, denied access, storage write failures, atomic confirmation failure, and a stale tab receiving a newer acknowledgement. The stale-tab fixture was corrected to model an unrelated remote edit and rerun successfully. Learning Hub tests were updated to accept eligible randomized questions and verify the actual preloaded audio duration instead of assuming another network request. These changes have not been published to Vercel.
