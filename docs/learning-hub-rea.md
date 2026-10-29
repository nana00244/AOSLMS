# Learning Hub reconstruction notes

Inspected 28 October 2026 using REA's passive Chrome DevTools Protocol tools against an isolated browser visiting the public Khan Academy website.

## Observed evidence

- `ev_84ed7b799839ef01e4162ce5333cee670444af779d3770d2795403d0ced6be61`: public homepage target identity, Edge browser, exact khanacademy.org origin.
- `ev_a6712cf736a3e08cc2a3b61d5bd9c5bf2819af6eb41a8e00a344839652cc8131`: homepage DOM and accessibility inspection. Course discovery, search, learner/teacher entry points and teacher-focused assignment/progress messaging were present.
- `ev_76ed8d60342379df7fc19a0e79fe75138b54af6d9a54a68e4d78c0d96b33d73a`: public mathematics directory. Grade/course grouping and skill links were present.
- `ev_f1f8bf1666b406d58502533aab222f9263a0203da77d8715bf74cc31c29abb0c`: seventh-grade mathematics course. Named skills, practice entry points and a course challenge were present.
- REA viewport screenshots corroborated the public page appearance: navy course navigation, white reading surfaces, blue interactive text, strong headings, learning-unit organization and green brand accents. The LMS uses its own name and original artwork.

REA captures are limited to the selected origin and attachment window. They do not establish server internals or authenticated teacher behavior. Browser navigation and cookie dismissal used Playwright; REA inspection itself remained passive. No credentials, private account data, or Khan Academy source code were copied into the LMS.

## Documented behavior used as a functional reference

- [Making assignments](https://support.khanacademy.org/hc/en-us/articles/115000772311-How-do-I-make-assignments-for-my-students-on-Khan-Academy): class/individual selection from teaching tools or a content page.
- [Teacher reporting options](https://support.khanacademy.org/hc/en-us/articles/360031129891-What-reporting-options-are-available-on-Khan-Academy-for-teachers-to-track-student-performance): activity, assignment scores, completion and learner reports.
- [Responses and completion reports](https://support.khanacademy.org/hc/en-us/articles/115000780012-How-do-I-use-the-Responses-and-Completion-Reports): distinction between practice outcomes and content completion.

## LMS implementation decisions

Learning Hub has Courses, Assignments, Progress and Curriculum resources pages. Grade/subject cards lead to a reading-and-practice view. Teachers author original standards-linked lessons, assign them to current class members or selected learners, and inspect actual attempts and reading acknowledgements. Students receive immediate scored feedback and can practise again. Progress reports offer class/student filtering, CSV export and deterministic next-step suggestions based on the latest score.

This is an independent implementation of the requested learning workflows, not a copy of Khan Academy's full platform. Its short practice sets use transparent proficiency bands rather than claiming Khan Academy's proprietary mastery model. Reading completion is a learner acknowledgement, not proof of reading time. The resource directory links external documents; opening those documents is not scored as learning completion. Video hosting, AI tutoring, adaptive question generation and exhaustive curriculum coverage are outside the implemented feature set.

The backend uses dedicated RLS-protected tables and an authenticated Edge Function. It grades answers on the server, hides answer keys before submission, scopes teaching access by class and subject, and permits learners to record only their own activity. Curriculum content and source provenance are described in [the curriculum ledger](learning-hub-curriculum.md).

## Acceptance verification

Completed 29 October 2026:

- Production build passed; browser bundle checked for absence of built-in lesson/question answer content.
- Unit suite: 120 passed, 2 skipped; includes curriculum integrity and authorization/grading tests.
- Five focused browser tests passed across their runs: teacher authoring, class/individual assignments, assigned learner reading/practice and reload, failed-save retry, and latest-score recommendations with the correct learner preselected.
- Desktop and 390px mobile screenshots inspected; no page-level mobile overflow.
- Migration and `learning-hub` function deployed to the linked project. Live temporary-account verification passed for persistence, grading, redacted answer keys, current role/class scope, learner privacy, inactive-account rejection and direct-table-write denial. Temporary fixtures were removed.
- Security advisor reported only the existing disabled leaked-password-protection warning; no new table warning.
- Changed Learning Hub files passed targeted formatting checks. Repository-wide formatting still fails on 21 pre-existing unrelated files. Existing build warnings concern bundle size and dependency annotations.
