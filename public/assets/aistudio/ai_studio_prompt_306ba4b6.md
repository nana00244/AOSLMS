# PROMPT FOR AI STUDIO: Load the NaCCA question bank and build the student and teacher screens
(Attach `published_questions.json` and `pilot_sample.json` with this prompt. Also attach or describe your existing app if you already have one.)

---

I am building a Khan Academy-style learning app for Ghana's NaCCA curriculum, Basic 1 to Basic 9. I have attached `published_questions.json`: questions that teachers have already reviewed and approved. Please build the features below. Work in the numbered steps, and STOP after each step so I can test it before you continue. If something cannot be done in this environment, tell me plainly instead of working around it.

## DATA YOU ARE GIVEN
`published_questions.json` is an array. Each item has: `id`, `indicator_code`, `subject`, `level` (B1 to B9), `strand`, `sub_strand`, `objective`, `skill_tag`, `type`, `difficulty` (1 to 4), `stem`, `options`, `answer`, `hints`, `explanation`, `rubric`, `reviewer`.

Question types and how they are marked:
- `mcq`: `options` has 4 strings; `answer` is the index 0 to 3. Auto-scored.
- `numeric`: `answer` is a number. Auto-scored (accept equivalent forms like "5" and "5.0").
- `short_answer`: `answer` is an array of accepted answers. Auto-scored after trimming spaces and ignoring case.
- `written`, `oral`, `drawing`, `practical`: no `answer`; they have a `rubric` ({"criteria":[{"description","marks"}]}). These are marked by a TEACHER, never automatically.

## RULES THAT MUST NOT BE BROKEN
1. Do not rewrite, "improve" or invent any question, answer, explanation or indicator. Show the content exactly as given. If an item is malformed, skip it and list it in a report.
2. Students must never receive the `answer` field before they submit. Check answers on the server side, not in the browser.
3. Any secret key stays in server-side environment variables. Nothing secret goes in frontend code or the repository.
4. Scores from auto-marked questions and scores from teacher-marked tasks are stored and shown SEPARATELY. Never merge them into one number.
5. Only questions from the imported file are shown to students.

## STEP 1: Import
Create database tables for subjects, levels, indicators (unique by `indicator_code`), and questions (unique by `id`), plus an import script that loads `published_questions.json`. Make it safe to run again with an updated file: new questions are added, changed ones updated, nothing duplicated. After import, show me a report: counts per subject and level, number of indicators, number of questions per indicator, any items skipped and why.

## STEP 2: Student practice
- Student picks a subject, then a level, then a strand/sub-strand, then an indicator (a topic).
- Practice sessions pick questions from that indicator, starting at difficulty 1 and moving up as the student answers correctly, and moving down after repeated mistakes. Do not repeat a question within a session.
- Show each question one at a time. After answering: whether it was right, the worked `explanation`, and a hint option BEFORE answering.
- Support mcq, numeric and short_answer input. Show clear messages for wrong input.
- Mastery per indicator: for example "mastered" after 5 correct in a row, or 80% over the last 10. Show it as a simple progress bar per topic. Keep the rule in one place so I can change it.
- Allow retakes. Keep the history of every attempt.

## STEP 3: Quizzes and unit tests
- Teacher creates a quiz or unit test by choosing subject, level, indicators, number of questions and (optionally) difficulty mix.
- Questions are picked randomly from the approved bank, different for each student if wished.
- Quiz can be assigned to a class or to selected students, with a due date.
- Auto-scored questions are graded immediately. A quiz containing teacher-marked questions shows "awaiting teacher marking" until marked.

## STEP 4: Teacher-marked work
- Students can submit: typed written answers, an audio recording (oral), and an uploaded photo or file (drawing or practical work).
- Teacher sees a marking queue. For each submission they see the question, the rubric, the student's work, and can give a mark per criterion plus a written comment.
- The student sees the marks and feedback. These marks are stored as "teacher-assessed", separate from auto-scored results.

## STEP 5: Teacher reports
- Per student: mastery by indicator, auto-scored results, teacher-assessed results, attempt history.
- Per class: which indicators have the lowest mastery; which questions are most often answered wrongly (so I can send them back for review).
- Export a report to CSV or PDF.
- A "report a problem with this question" button for students and teachers. Reports are saved against the question `id` so I can send them back for review.

## STEP 6: Coverage page for the admin
Show, per subject and level: number of indicators, number of indicators with fewer than 16 questions, and number with no questions at all. List missing ones plainly. State clearly on the page that a question count does not prove full curriculum coverage.

## STEP 7: Users and security
- Roles: student, teacher, admin. Teachers only see their own classes. Students only see their own results.
- Sign-in with email or class code, whichever suits a school. Passwords hashed, never stored as plain text.
- Basic protection: rate limiting on login, validation of all inputs, file upload limits (size and type) for audio, images and documents.
- These are children's records. Keep personal data to the minimum, and tell me what data you store.

## STEP 8: Testing before deployment
Write and run tests for: answer checking for each question type, question selection (no repeats, difficulty moves correctly), mastery calculation, quiz grading, retakes, assignment visibility between classes, and that students never receive answers early. Tell me which tests pass and which fail. Do not claim anything works unless you tested it.

## HOW TO REPORT
After each step tell me: what you built, what you tested, what does not work yet, and what you need from me. Keep it short and plain.
