# Product Requirements Document (PRD)

## Ayisatu Owen Schools: School Information System (SIS) & Learning Management System (LMS)

| Field | Detail |
| :--- | :--- |
| **Document Version** | 1.0 |
| **Date** | 7 October 2026 |
| **Product** | Ayisatu Owen Schools |
| **Product Type** | Web-based SIS + LMS + Finance & Operations platform |
| **Target Market** | Basic schools, junior high schools, and international academies (primary context: Ghana / West Africa) |
| **Source Material** | Ayisatu Owen Schools Application Specification & User Manual (DOCUMENTATION.md) |
| **Status** | Draft for review |

> **Note on scope of this document:** Sections marked *(Documented)* are derived directly from the existing application specification. Sections marked *(Proposed)* (success metrics, non-functional targets, risks, roadmap, open questions) are recommended additions for stakeholder review and are not stated in the source documentation.

---

## Table of Contents

1. Executive Summary
2. Problem Statement & Opportunity
3. Goals, Non-Goals & Success Metrics
4. Target Users & Personas
5. User Roles & Access Control (RBAC)
6. Product Scope & Module Overview
7. Functional Requirements
8. Data Requirements & Schema
9. Technical Architecture & Constraints
10. Non-Functional Requirements
11. Key User Flows
12. Reporting, Printing & Export Requirements
13. Security, Privacy & Compliance
14. Release Plan & Roadmap
15. Risks, Dependencies & Assumptions
16. Open Questions
17. Acceptance Criteria Summary
18. Glossary
19. Appendix: Requirement Traceability

---

## 1. Executive Summary

**Ayisatu Owen Schools** is an enterprise-grade School Information System (SIS) and Learning Management System (LMS) built for modern educational institutions. It digitizes and unifies the full academic and operational lifecycle of a school:

- Prospective admissions and student enrollment
- Student ledger accounting, fee billing, and payroll
- Real-time attendance registers
- Continuous coursework assessment (SBA) and terminal examinations
- AI-assisted pedagogical report card remarks
- Certificates and honor awards
- Disaster recovery data snapshots

The platform is designed around the Ghanaian basic education standard (50% School-Based Assessment + 50% Terminal Examination) and produces Ministry-standard single-page A4 Basic School Assessment Cards, while remaining adaptable to international academies.

**Core value proposition:** a single system where administrators, teachers, students, and accountants work from the same live data, replacing spreadsheets, paper registers, and disconnected tools.

---

## 2. Problem Statement & Opportunity

### 2.1 Problems Addressed *(Proposed framing based on documented features)*

| Problem | How Ayisatu Owen Schools Addresses It |
| :--- | :--- |
| Report cards compiled manually in spreadsheets, prone to ranking and arithmetic errors | Automated SBA + Exam computation, grading, and Excel-compatible `RANK.EQ` class and subject positions |
| Attendance kept on paper and re-tallied at term end | Digital daily roll call that live-syncs to report cards |
| Fee collection tracked in notebooks, with no clear view of arrears | Student billing roster, payment recorder, and automatic balances |
| Teacher remark writing is time-consuming across large classes | AI-drafted, personalized remarks (max 30 words) using Gemini 2.5 Flash |
| Students and parents lack visibility into grades, timetable, and fees | Role-scoped student portal |
| Risk of data loss and weak audit trail | SHA-256-verified backups, atomic restore, and audit logs |
| Unreliable internet in many school environments | Dual-layer persistence: zero-latency local cache plus Firebase cloud sync |

### 2.2 Opportunity

Offer a locally relevant, curriculum-aligned, all-in-one school platform that supports Ministry-standard documentation (assessment cards, thermal receipts, attendance audits) out of the box.

---

## 3. Goals, Non-Goals & Success Metrics

### 3.1 Product Goals

1. **G1:** Provide a unified platform covering academics, attendance, finance, communication, and administration.
2. **G2:** Produce Ministry-standard, print-ready documents (A4 report cards, certificates, 58mm receipts, attendance matrices).
3. **G3:** Reduce teacher administrative workload via automation (grade synchronization, rankings, AI remarks).
4. **G4:** Enforce strict role-based access and class-level data boundaries.
5. **G5:** Guarantee data integrity and recoverability.
6. **G6:** Deliver responsive, low-latency user experience through local-first persistence.

### 3.2 Non-Goals (Current Release) *(Proposed)*

- Native mobile applications (the product is a web application using `HashRouter`).
- Parent/guardian login persona (guardian details are stored, but no guardian role is documented).
- Online payment gateway integration (payments are recorded manually by the accountant; methods are Cash, Mobile Money, Bank Transfer/Deposit).
- Live video classroom delivery (external video links can be embedded, but no native conferencing).
- Automated SMS/email notification delivery (not documented).

### 3.3 Success Metrics *(Proposed, to be validated by stakeholders)*

| Metric | Target |
| :--- | :--- |
| Time to compile a class's terminal report cards | Reduced by at least 70% vs. manual process |
| Report card ranking accuracy vs. Excel `RANK.EQ` | 100% match |
| Daily attendance completion rate by teachers | at least 95% of school days |
| Fee receipts issued at point of payment | 100% of recorded payments |
| Backup success rate with valid checksum | 100% |
| Teacher adoption (active weekly use) | at least 90% of teaching staff by end of first term |
| Report card page-fit (single A4 page) | 100% of generated cards |

---

## 4. Target Users & Personas

| Persona | Description | Primary Needs |
| :--- | :--- | :--- |
| **School Administrator / Headteacher** | Oversees governance, compliance, and academic policy | Full visibility, term control, user management, report verification, backups |
| **Class / Subject Teacher** | Delivers instruction, marks attendance, grades work | Fast roll call, gradebook, coursework, report remarks, certificates |
| **Enrolled Student** | Learns, submits work, tracks performance | Assignments, grades, report card, timetable, certificates, fee balance |
| **Financial Bursar / Accountant** | Manages billing, collections, expenses, payroll | Fee structures, payment recording, receipts, expenditure, payroll |

---

## 5. User Roles & Access Control (RBAC) *(Documented)*

RBAC is enforced through route guards (`ProtectedRoute` in `App.tsx`), contextual authorization hooks (`useAuth` in `AuthContext.tsx`), and data-service scoping filters.

### 5.1 Role Capability Matrix

| Capability | Administrator | Teacher | Student | Accountant |
| :--- | :---: | :---: | :---: | :---: |
| Configure institution profile (name, motto, crest, stamp, contacts) | Yes | No | No | No |
| Switch global Active Term | Yes | No | No | No |
| Manage user accounts (create/edit/activate/reset/delete) | Yes | No | No | No |
| Classroom config, enrollment, bulk Excel import, teacher assignment | Yes | No | No | No |
| Master timetable and period allocation | Yes | No | View own | No |
| Compile and verify report cards (all classes) | Yes | Assigned classes | View own | No |
| Mark daily attendance | Yes | Yes | No | No |
| Create coursework/assignments | Yes | Yes | No | No |
| Submit coursework | No | No | Yes | No |
| Grade submissions | Yes | Yes | No | No |
| Record SBA / exam scores | Yes | Yes | No | No |
| Generate AI remarks | Yes | Yes | No | No |
| Issue certificates | Yes | Yes | View own | No |
| Upload resources (class-scoped) | Yes | Yes | View (own class) | No |
| View fee balance | Yes | No | Own only | All students |
| Manage fee structures | Yes | No | No | Yes |
| Record payments and print receipts | Yes | No | No | Yes |
| Record expenditures | Yes | No | No | Yes |
| Manage payroll | Yes | No | No | Yes |
| View audit logs | Yes | No | No | No |
| Backup / restore / factory reset | Yes | No | No | No |

> The matrix consolidates the documented role descriptions. Where the source is silent on a specific cell (for example, accountant access to the audit log), the conservative default is shown and should be confirmed (see Open Questions).

### 5.2 Role Requirements

- **RBAC-1:** Every route must be guarded by role; unauthorized access must redirect or deny.
- **RBAC-2:** Data services must apply role-scoped filters (for example, students see only their own records; teachers see only assigned classes).
- **RBAC-3:** Resource Library access must enforce strict class boundaries.
- **RBAC-4:** Administrators can activate/deactivate accounts, and deactivated users cannot authenticate.

---

## 6. Product Scope & Module Overview

| # | Module | Primary Roles |
| :--- | :--- | :--- |
| M1 | Academic Performance Engine & Termly Report Cards Studio | Admin, Teacher, Student |
| M2 | Attendance Register & Monthly Attendance Audit | Teacher, Admin |
| M3 | Coursework, Assignments & Gradebook | Teacher, Student |
| M4 | Master Timetable & Class Schedules | Admin, Teacher, Student |
| M5 | Student Roster, Admissions & Excel Bulk Import | Admin |
| M6 | Financial Hub: Billing, Payments, Expenditure, Payroll | Accountant, Admin, Student (view) |
| M7 | Digital Certificates & Honor Awards | Teacher, Admin, Student |
| M8 | Resource Library & Classroom Communication | Teacher, Student, Admin |
| M9 | Disaster Recovery, Backups & System Reset | Admin |
| M10 | User, Institution & Settings Management | Admin |
| M11 | Audit Logging | Admin |

---

## 7. Functional Requirements

Requirement IDs follow the pattern `FR-<module>-<n>`. Priority uses **P0** (must-have), **P1** (should-have), **P2** (nice-to-have).

### 7.1 M1: Academic Performance Engine & Termly Report Cards Studio

#### 7.1.1 Dual Assessment Architecture

| ID | Requirement | Priority |
| :--- | :--- | :--- |
| FR-M1-01 | The system shall compute Continuous Assessment (SBA) normalized to **50 points**, aggregating classroom exercises, group projects, class tests, homework, and science/practical drills. | P0 |
| FR-M1-02 | The system shall record Terminal Examination scores normalized to **50 points**. | P0 |
| FR-M1-03 | The system shall compute Overall Total as `SBA (50) + Exam (50) = 100`. | P0 |
| FR-M1-04 | The system shall assign automatic letter grades per the grading scale below. | P0 |

**Grading Scale**

| Grade | Range | Descriptor |
| :---: | :--- | :--- |
| A | 80% to 100% | Excellent / Distinction |
| B | 70% to 79% | Very Good / Commendable |
| C | 60% to 69% | Good / Satisfactory |
| D | 50% to 59% | Pass / Fair |
| E | 40% to 49% | Weak / Needs Improvement |
| F | 0% to 39% | Unsatisfactory / Fail |

#### 7.1.2 Excel-Compatible Rankings

| ID | Requirement | Priority |
| :--- | :--- | :--- |
| FR-M1-05 | Class and subject positions shall be computed in real time using an algorithm identical to Excel `RANK.EQ`. | P0 |
| FR-M1-06 | Tied scores shall receive identical positions, and the next rank shall skip accordingly (for example, 1st, 1st, 3rd). | P0 |
| FR-M1-07 | Positions shall be formatted with ordinal suffixes (1st, 2nd, 3rd, 4th, and so on). | P0 |

#### 7.1.3 Single-Page A4 Ministry-Standard Assessment Card

| ID | Requirement | Priority |
| :--- | :--- | :--- |
| FR-M1-08 | The card shall render on a **single A4 page** with print-optimized CSS. | P0 |
| FR-M1-09 | Header shall include school name, address, motto, official crest, and academic metadata. | P0 |
| FR-M1-10 | Student details shall include name, admission number, class stream, academic year, and active term. | P0 |
| FR-M1-11 | The card shall embed a **2"x2" passport photograph** with a square border. | P0 |
| FR-M1-12 | Subject table shall list: Mathematics, English Language, Integrated Science, Social Studies (JHS 1 to 3 only), History (BS 1 to 6 only), Computing, Ghanaian Language, Creative Arts, RME. | P0 |
| FR-M1-13 | Score columns shall include SBA (50%), Exam (50%), Total (100%), Grade Letter, Position in Subject, and Subject Teacher Remarks. | P0 |
| FR-M1-14 | Conduct & Personal Development section shall present descriptive qualitative attributes (Conduct, Work Ethic, Neatness, Sociability, Debate, Mental Drill, Reading Comprehension) **without arbitrary letter grading**. | P0 |
| FR-M1-15 | A termly attendance matrix shall show certified days present out of total sessions. | P0 |
| FR-M1-16 | Footer shall include Class Teacher remarks, Headteacher endorsement, circular school stamp, vacation date, and next-term reopening date. | P0 |
| FR-M1-17 | A "View Card" modal and "Print A4 Card" action shall be available from the roster list. | P0 |
| FR-M1-18 | Subject applicability shall be driven by grade level (Social Studies for JHS only; History for Basic School 1 to 6 only). | P0 |

#### 7.1.4 Report Cards Studio (Teacher/Admin Workflow)

| ID | Requirement | Priority |
| :--- | :--- | :--- |
| FR-M1-19 | Teachers shall customize individual subject grades, attendance counts, and conduct ratings. | P0 |
| FR-M1-20 | Admins shall compile, recalculate, and verify report cards for all classes. | P0 |
| FR-M1-21 | Teachers shall select an assigned class and term before viewing the roster. | P0 |
| FR-M1-22 | Students shall view their own terminal report card with real-time class rankings. | P0 |

#### 7.1.5 AI-Powered Pedagogical Remarks

| ID | Requirement | Priority |
| :--- | :--- | :--- |
| FR-M1-23 | An "AI Draft Remark" action shall generate a Class Teacher remark using Google Gemini 2.5 Flash via the backend Express server. | P0 |
| FR-M1-24 | The AI input shall include average percentage, rank, and subject strengths. | P0 |
| FR-M1-25 | Remarks shall address the student by **given first name**, be concise, empathetic, and constructive, and shall not exceed **30 words**. | P0 |
| FR-M1-26 | Generated text shall populate the Class Teacher's Remarks box as an **editable draft** requiring explicit "Save Changes". | P0 |
| FR-M1-27 | When API rate limits are reached, the UI shall show a clean, non-blocking notification banner. | P1 |

---

### 7.2 M2: Attendance Register & Monthly Attendance Audit

| ID | Requirement | Priority |
| :--- | :--- | :--- |
| FR-M2-01 | Teachers shall mark daily attendance per student with four statuses: **Present** (green), **Late** (yellow), **Absent** (red), **Excused** (blue). | P0 |
| FR-M2-02 | A one-click **"Mark All Present"** bulk action shall be provided. | P0 |
| FR-M2-03 | A Monthly Attendance Register shall display a full-page printable matrix of all students versus all school days in the month. | P0 |
| FR-M2-04 | The register shall automatically tally total present, late, absent, and excused sessions. | P0 |
| FR-M2-05 | Standing indicators shall be computed as: **Excellent** (95% or above), **Good** (85% to 94%), **Warning** (75% to 84%), **Critical** (below 75%). | P0 |
| FR-M2-06 | Any recorded attendance mark shall automatically update `attendancePresent` on the student's terminal report card (live sync). | P0 |

---

### 7.3 M3: Coursework, Assignments & Gradebook

| ID | Requirement | Priority |
| :--- | :--- | :--- |
| FR-M3-01 | Teachers shall create assignments with title, description, class targeting, subject mapping, point value, and due date. | P0 |
| FR-M3-02 | Assignments shall support multiple attachment formats. | P1 |
| FR-M3-03 | Students shall submit via text response, external research link, or uploaded document. | P0 |
| FR-M3-04 | Students shall see pending, submitted, and graded tasks. | P0 |
| FR-M3-05 | Teachers shall access a review queue showing submissions with timestamps, and **late submissions shall be flagged**. | P0 |
| FR-M3-06 | Teachers shall enter numeric scores (rubric grading) and written feedback. | P0 |
| FR-M3-07 | Graded coursework shall automatically synchronize into the SBA category breakdown of the terminal gradebook. | P0 |
| FR-M3-08 | Students shall view personal gradebook and performance analytics with subject breakdowns and SBA marks. | P0 |
| FR-M3-09 | Students shall access an interactive classroom activity stream for announcements and assignment postings. | P1 |

---

### 7.4 M4: Master Timetable & Class Schedules

| ID | Requirement | Priority |
| :--- | :--- | :--- |
| FR-M4-01 | Provide a Monday to Friday timetable grid with **7 daily periods** plus morning assembly and lunch recess. | P0 |
| FR-M4-02 | Administrators shall configure start and end times for each period with **conflict detection**. | P0 |
| FR-M4-03 | The system shall prevent **teacher double-booking** across classrooms in the same timeslot. | P0 |
| FR-M4-04 | Teacher and room allocations shall be supported per slot. | P0 |
| FR-M4-05 | Students shall view a personalized daily/weekly schedule showing subject, time, classroom, and teacher. | P0 |

---

### 7.5 M5: Student Roster, Admissions & Excel Bulk Import

| ID | Requirement | Priority |
| :--- | :--- | :--- |
| FR-M5-01 | Provide a Student Directory with admission number, class, gender, date of birth, guardian contacts, and status toggles (**Active, Inactive, Graduated**). | P0 |
| FR-M5-02 | Provide a Class Roster view showing enrolled count vs. room capacity, gender ratio, and assigned class teacher. | P0 |
| FR-M5-03 | Support bulk import of students via `.xlsx` or `.csv` (SheetJS). | P0 |
| FR-M5-04 | Import UI shall provide interactive **column mapping** (First Name, Last Name, Admission No, Gender, Class). | P0 |
| FR-M5-05 | Import shall perform **automatic duplicate prevention**. | P0 |
| FR-M5-06 | Import shall auto-generate user account credentials for imported students. | P0 |
| FR-M5-07 | Support class movements and transfers between classrooms/streams with automatic record reassignment. | P0 |
| FR-M5-08 | Support prospective admissions as part of the lifecycle (admission records and enrollment date). | P1 |
| FR-M5-09 | Support excel-based student data extraction/export. | P1 |

---

### 7.6 M6: Financial Hub, Tuition Billing & Payroll

#### 7.6.1 Billing & Fee Structures

| ID | Requirement | Priority |
| :--- | :--- | :--- |
| FR-M6-01 | Student Billing Roster shall show total billed, total paid, outstanding balance, and a debt status badge: **Paid in Full**, **Partial Balance**, **Unpaid / Arrears**. | P0 |
| FR-M6-02 | Fee structures shall be configurable per grade level with line items: Tuition, ICT & Computer Lab Levy, PTA Dues, Science Laboratory & Practical Fee, Sports & Culture Levy (plus Examination and Library per the accountant scope). | P0 |
| FR-M6-03 | Students shall see a tuition/fee balance tracker with itemized category breakdown. | P0 |

#### 7.6.2 Payments & Receipts

| ID | Requirement | Priority |
| :--- | :--- | :--- |
| FR-M6-04 | Cashier shall record payments with student selection (searchable), amount, method (**Cash, Mobile Money, Bank Deposit/Transfer**), receipt number, and optional notes. | P0 |
| FR-M6-05 | Balance shall be recalculated automatically on save. | P0 |
| FR-M6-06 | "Record & Print Receipt" shall persist the transaction to the student ledger and generate a printable voucher. | P0 |
| FR-M6-07 | Support **A4 invoice/receipt** with crest, itemized breakdown, and signature lines. | P0 |
| FR-M6-08 | Support **58mm POS thermal receipt** formatting. | P0 |
| FR-M6-09 | Support **batch printing** of queued receipts on 58mm paper. | P1 |

#### 7.6.3 Expenditure & Payroll

| ID | Requirement | Priority |
| :--- | :--- | :--- |
| FR-M6-10 | Record operating expenditures (stationery, utilities, fuel, maintenance, supplies) with category, vendor, amount, and approval status. | P0 |
| FR-M6-11 | Payroll ledger shall calculate basic salary, housing/transport allowances, tax deductions, and net salary. | P0 |
| FR-M6-12 | Generate printable employee pay slips and monthly salary distribution summaries. | P0 |

---

### 7.7 M7: Digital Certificates & Honor Awards

| ID | Requirement | Priority |
| :--- | :--- | :--- |
| FR-M7-01 | Teachers and admins shall issue certificates for: Academic Excellence (First Class Honors), Perfect Attendance & Punctuality, Leadership & Service, Sports/Arts/Cultural Distinction. | P0 |
| FR-M7-02 | Certificates shall render with ornate SVG borders, school crest, ribbons, and authorized headteacher signature. | P0 |
| FR-M7-03 | Support high-resolution print and PDF export from student portal and teacher dashboard. | P0 |
| FR-M7-04 | Students shall have a certificate showcase view. | P1 |

---

### 7.8 M8: Resource Library & Classroom Communication

| ID | Requirement | Priority |
| :--- | :--- | :--- |
| FR-M8-01 | Teachers shall upload lecture notes, worksheets, syllabus guides, PDFs, Office files, and text handouts, and embed external video links. | P0 |
| FR-M8-02 | Resources shall be visible **only to the assigned class(es)**, enforcing strict class boundaries and protecting student privacy. | P0 |
| FR-M8-03 | Provide intra-school direct messaging between administration, teachers, and students. | P1 |

---

### 7.9 M9: Disaster Recovery, Backups & System Reset

| ID | Requirement | Priority |
| :--- | :--- | :--- |
| FR-M9-01 | Admins shall generate a full JSON backup of **all 18 database collections** (the schema reference lists 19 tables; see Open Questions). | P0 |
| FR-M9-02 | Each backup shall embed a **SHA-256 checksum** to verify integrity. | P0 |
| FR-M9-03 | Restore shall validate the checksum before applying data. | P0 |
| FR-M9-04 | Restore shall require explicit modal confirmation by typing **"RESTORE SYSTEM"**. | P0 |
| FR-M9-05 | Restore shall be **atomic**: rebuild tables, preserve foreign keys, update local cache, and sync to Firestore immediately. | P0 |
| FR-M9-06 | Provide a **Complete System Factory Reset** to wipe mock/demo records and begin a clean academic year. | P1 |

---

### 7.10 M10: User, Institution & Settings Management

| ID | Requirement | Priority |
| :--- | :--- | :--- |
| FR-M10-01 | Admins shall configure institution profile: school name, motto, crest, official stamp, address, contact details, academic year. | P0 |
| FR-M10-02 | Admins shall set the global **Active Term** (Term 1, 2, 3) under Settings > Institution Profile; all users align immediately. | P0 |
| FR-M10-03 | Admins shall create, edit, activate/deactivate, reset passwords, and delete staff, teacher, student, and accountant logins. | P0 |
| FR-M10-04 | Term selectors on Timetable and Report Cards pages shall be available to admins as convenience switches. | P1 |
| FR-M10-05 | Admins shall assign teachers to classes and subjects (`teacher_classes`). | P0 |

---

### 7.11 M11: Audit Logging

| ID | Requirement | Priority |
| :--- | :--- | :--- |
| FR-M11-01 | The system shall maintain a chronological audit trail logging user, action, timestamp, IP, and event type. | P0 |
| FR-M11-02 | Admins shall be able to view audit logs. | P0 |
| FR-M11-03 | Audit logs shall be included in backups and restores. | P1 |

---

## 8. Data Requirements & Schema

All data is held in atomic tables mirrored between local storage and Firebase Firestore under the collection prefix `nextlearn_mock_db_*`.

| Table | Purpose & Key Content |
| :--- | :--- |
| `users` | Credentials, email, hashed password, role, profile picture, status |
| `students` | Admission details, admission number, `userId`, `classId`, guardian name/phone, enrollment date |
| `teachers` | Employee ID, `userId`, qualifications, hire date, assigned subjects |
| `classes` | Grade level, section/stream, room, capacity, class teacher ID |
| `teacher_classes` | Join table: teacher to class to subject |
| `subjects` | Subject catalog, codes, grade-level rules |
| `attendance` | Daily logs per student/class/date with status |
| `coursework_cards` | Continuous assessment task scores per student |
| `report_cards` | Student, class, term, total SBA, total exam, overall score, grade, position, attendance, remarks |
| `report_card_grades` | Per-subject score lines attached to report cards |
| `assignments` | Tasks, instructions, point values, due dates, attachments |
| `submissions` | Submitted answers, files, feedback, numeric grade |
| `timetable_slots` | Day, period index, time, class, subject, teacher |
| `finance_transactions` | Payment vouchers, receipts, methods, references, amounts |
| `fee_structures` | Fee policies and line items per grade level |
| `expenditures` | Expense records, category, vendor, amount, approval status |
| `payroll` | Basic pay, allowances, deductions, net salary |
| `system_settings` | School name, motto, address, logo URL, stamp URL, active term, academic year |
| `audit_logs` | User actions, timestamp, IP, event type |

### 8.1 Key Relationships

- `users` 1:1 `students` / `teachers` via `userId`
- `students` N:1 `classes` via `classId`
- `teachers` N:M `classes` via `teacher_classes` (with subject)
- `report_cards` 1:N `report_card_grades`
- `assignments` 1:N `submissions`
- `students` 1:N `attendance`, `finance_transactions`, `report_cards`

### 8.2 Data Requirements

- **DR-1:** Foreign key integrity must be preserved on restore and import.
- **DR-2:** Passwords must be stored hashed.
- **DR-3:** Tables must be independently replicable (bidirectional merge via `tableMerger.ts`).
- **DR-4:** Term and academic year must be attached to report cards to preserve history across terms.

---

## 9. Technical Architecture & Constraints

### 9.1 Technology Stack

| Layer | Technology |
| :--- | :--- |
| Frontend | React 19 (TypeScript), React Router v7 (`HashRouter`), Vite 6 |
| Styling | Tailwind CSS 3.4, custom print media CSS (A4 and 58mm), Lucide React icons, Framer Motion |
| Backend | Node.js with Express 5 (`server.ts`): REST endpoints, external request proxy, AI workflow |
| AI | `@google/genai` SDK (Gemini 2.5 Flash) |
| Local Persistence | `mockDb.ts` with in-memory + local storage cache; reactive `nextlearn_storage_change` window events |
| Cloud Persistence | Firebase Firestore with bidirectional merge replication (`tableMerger.ts`) |
| Import / Export | SheetJS (.xlsx / .csv), CSS print/PDF, SVG certificates |

### 9.2 Persistence Strategy Requirements

- **TA-1:** Reads/writes shall hit the local layer synchronously for zero-latency UI.
- **TA-2:** Local changes shall dispatch reactive events so all subscribed views update immediately.
- **TA-3:** Cloud sync shall run automatically in the background with cross-tab and cross-device consistency.
- **TA-4:** Merge conflicts shall be resolved by the table merger without data loss.

### 9.3 Architectural Constraints & Considerations *(Proposed)*

- The "mock DB" naming indicates the local layer is client-side; production deployments must ensure authorization is **enforced server-side or via Firestore security rules**, not only in client route guards.
- The Gemini API key must be held only on the Express server and never exposed to the client.
- `HashRouter` is used for static-host compatibility; deep links use `#/` URLs.

---

## 10. Non-Functional Requirements *(Proposed targets unless stated)*

| Category | Requirement |
| :--- | :--- |
| **Performance** | Local reads/writes complete synchronously (documented). Report card render in under 2 s for a class of 60 students. |
| **Scalability** | Support bulk import of hundreds of students (documented) and at least 2,000 students per institution. |
| **Availability / Offline** | Core workflows (attendance, grading, payment recording) usable with intermittent connectivity via local cache, syncing when online. |
| **Reliability** | Backups must be verifiable via SHA-256; restore must be atomic. |
| **Usability** | Mobile-responsive layouts; one-click bulk actions; non-blocking error notifications. |
| **Print Fidelity** | Report cards fit exactly one A4 page; receipts fit 58mm paper width without clipping. |
| **Accessibility** | Status colors (green/yellow/red/blue) must also carry text labels; target WCAG 2.1 AA. |
| **Compatibility** | Latest two versions of Chrome, Edge, Firefox, Safari. |
| **Maintainability** | TypeScript strict typing; table-level modular data services. |
| **Observability** | Audit logs for sensitive actions; AI API errors surfaced gracefully. |

---

## 11. Key User Flows *(Documented)*

### 11.1 View and Print a Terminal Report Card
1. **Admin:** open *Termly Report Cards* (or *Report Generator*, then *View Card*). **Teacher:** open *Termly Report Cards*, select assigned class and term.
2. Click **View Card** on a student.
3. The Basic School Assessment Card modal opens (photo, SBA breakdown, exam marks, class ranking).
4. Click **Print A4 Card** to print or save as PDF.

### 11.2 Generate AI Teacher Remarks
1. Open the student's report card modal.
2. Click **AI Draft Remark** (sparkles icon).
3. Backend sends average %, rank, and strengths to Gemini; the comment populates *Class Teacher's Remarks*.
4. Review or edit, then click **Save Changes**.

### 11.3 Switch the Global Active Term (Admin)
1. Use the term selector on *Class Timetable* or *Termly Report Cards* for a quick switch.
2. For a permanent change: **Settings > Institution Profile > Active Term**.
3. All teachers and students align immediately.

### 11.4 Record a Student Fee Payment
1. Go to **Treasury > Record Payment**.
2. Search and select the student.
3. Enter amount, method (Cash / Mobile Money / Bank Deposit), and notes.
4. Click **Record & Print Receipt**; the ledger is updated and a receipt is generated.

### 11.5 Perform a Disaster Recovery Backup / Restore
1. Go to **Settings > Disaster Recovery & Backup**.
2. Click **Generate Full Database Backup**; a `.json` file with SHA-256 checksum downloads.
3. To restore: click **Upload Restore File**, confirm the security prompt (`RESTORE SYSTEM`); data is restored atomically and synced.

### 11.6 Daily Attendance (Teacher) *(Derived)*
1. Open the attendance register for the assigned class and date.
2. Click **Mark All Present**, then adjust exceptions (Late / Absent / Excused).
3. Save; report card attendance counts update automatically.

### 11.7 Coursework Cycle *(Derived)*
1. Teacher creates assignment; students see it in the activity stream.
2. Student submits text, link, or file.
3. Teacher reviews (late work flagged), scores, and comments.
4. Score syncs into the SBA breakdown on the gradebook.

---

## 12. Reporting, Printing & Export Requirements

| Output | Format | Requirements |
| :--- | :--- | :--- |
| Terminal Assessment Card | A4 single-page print / PDF | Ministry-standard layout, passport photo, stamp, signatures |
| Monthly Attendance Register | Multi-page printable matrix | All students and all school days; tallies and standing indicators |
| Fee Receipt | A4 and 58mm thermal | Crest, itemized lines, signature lines (A4); compact POS layout (58mm) |
| Batch Receipts | 58mm thermal | Queued printing |
| Pay Slips / Salary Summary | Printable | Basic, allowances, deductions, net |
| Certificates | SVG-based print / PDF | Ornate borders, crest, ribbon, signature |
| Student Data | .xlsx / .csv | Import with column mapping; roster extraction |
| System Backup | .json | SHA-256 checksum embedded |

---

## 13. Security, Privacy & Compliance

### 13.1 Documented Controls
- Role-based route guards and data-scoping filters.
- Hashed password storage.
- Class-level resource isolation.
- Audit logging of user actions.
- Checksummed backups and confirmation-gated destructive operations.

### 13.2 Proposed Requirements
| ID | Requirement |
| :--- | :--- |
| SEC-1 | Authorization must be enforced at the data layer (server or Firestore rules), not solely in the client. |
| SEC-2 | Admin password resets must force a password change on next login. |
| SEC-3 | Session timeout and logout on inactivity, especially for shared school computers. |
| SEC-4 | Minors' data (names, photos, guardian contacts) must be protected in line with Ghana's Data Protection Act, 2012 (Act 843); confirm applicable obligations with legal counsel. |
| SEC-5 | Backup files contain all school data and should be stored securely; consider optional backup encryption. |
| SEC-6 | Factory reset and restore must be admin-only and fully audit-logged. |
| SEC-7 | AI prompts should transmit the minimum necessary data (first name, average, rank, strengths) with no sensitive identifiers. |
| SEC-8 | Uploaded files must be validated for type and size. |

---

## 14. Release Plan & Roadmap *(Proposed)*

| Phase | Focus | Scope |
| :--- | :--- | :--- |
| **Phase 1: Core (Current)** | Foundation | Auth/RBAC, student/class management, attendance, gradebook, report cards, timetable, finance, certificates, resource library, backups, AI remarks |
| **Phase 2: Hardening** | Production readiness | Server-side authorization, security rules, audit log enrichment, automated tests, performance tuning |
| **Phase 3: Engagement** | Reach | Guardian/parent portal, SMS/email notifications, announcement broadcasts |
| **Phase 4: Payments & Analytics** | Revenue and insight | Mobile Money / online payment integration, analytics dashboards (attendance trends, fee collection, performance cohorts) |
| **Phase 5: Scale** | Multi-school | Multi-tenant support, curriculum templates for other regions, native/PWA mobile experience |

---

## 15. Risks, Dependencies & Assumptions

### 15.1 Risks

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| Client-side-only RBAC could be bypassed | High | Enforce authorization in the data layer (SEC-1) |
| Gemini API rate limits / outages | Medium | Non-blocking banner (documented); allow manual remarks; consider quota monitoring |
| Sync conflicts between devices | Medium | `tableMerger.ts` bidirectional merge; add conflict test suite |
| Print layout drift across browsers/printers | Medium | Print CSS regression checks; test on target printers |
| Poor connectivity at schools | Medium | Local-first design; background sync |
| Data loss from user error (restore/reset) | High | Typed confirmation, checksum, audit logs |
| Regulatory exposure for minors' data | High | Privacy review and policy |

### 15.2 Dependencies
- Google Gemini API (`@google/genai`)
- Firebase Firestore
- SheetJS
- 58mm thermal printer hardware support via browser printing

### 15.3 Assumptions
- Schools follow a three-term academic year.
- The SBA/Exam split is fixed at 50/50 (not configurable in the current release).
- One active term applies globally across the institution.
- Users have access to a modern browser and, for receipts, a compatible thermal printer.

---

## 16. Open Questions

1. **Collection count:** the documentation states "all 18 database collections" while the schema table lists 19 tables. Which is authoritative, and does the backup include all of them?
2. **Accountant permissions:** can accountants view audit logs or student academic data? Can administrators also record payments (assumed yes)?
3. **Fee categories:** the Accountant section lists Examination and Library fees, while the Fee Structure section lists Science Lab and Sports & Culture levies. Should the final catalog be the union of both?
4. **Guardian access:** is a parent/guardian portal needed for report cards and fee statements?
5. **Configurable assessment weights:** should the 50/50 SBA/Exam ratio and grade boundaries be configurable per school?
6. **Subject scope:** should the subject list be extensible beyond the nine documented subjects (for example, French, Physical Education)?
7. **Multi-school support:** is multi-tenancy in scope, or is each deployment single-institution?
8. **Prospective admissions:** the executive summary mentions admissions, but the detailed features focus on enrolled-student management. Is an applicant pipeline required?
9. **Payment methods wording:** "Bank Transfer" and "Bank Deposit" are both used. Should these be unified?
10. **Data retention:** how long should historical terms, audit logs, and graduated student records be retained?

---

## 17. Acceptance Criteria Summary

| Area | Acceptance Criteria |
| :--- | :--- |
| **Report Cards** | Total equals SBA + Exam; grade letter matches the scale; ties ranked per `RANK.EQ`; card prints on exactly one A4 page; Social Studies appears only for JHS and History only for BS 1 to 6 |
| **AI Remarks** | Output is 30 words or fewer, uses the student's first name, is editable, and shows a banner (not an error page) on rate limit |
| **Attendance** | Four statuses selectable; "Mark All Present" works; monthly standing thresholds correct; report card present-count updates after marking |
| **Coursework** | Late submissions flagged; graded scores appear in the SBA breakdown |
| **Timetable** | Double-booking a teacher in one timeslot is blocked with a clear conflict message |
| **Import** | Column mapping works; duplicates not created; credentials generated |
| **Finance** | Balance recalculates on save; receipt prints in A4 and 58mm; status badges match balance state |
| **Certificates** | All four types issuable; exports at high resolution |
| **Resource Library** | A student in Class A cannot see Class B resources |
| **Backup/Restore** | Backup includes a valid SHA-256 checksum; restore blocked unless "RESTORE SYSTEM" is typed; corrupted file is rejected; restore is atomic |
| **RBAC** | Each role can access only its permitted routes and data |

---

## 18. Glossary

| Term | Definition |
| :--- | :--- |
| **SIS** | School Information System |
| **LMS** | Learning Management System |
| **SBA** | School-Based Assessment (continuous assessment, 50% of the term total) |
| **Terminal Exam** | End-of-term examination (50% of the term total) |
| **RANK.EQ** | Excel ranking function giving tied values the same rank and skipping subsequent ranks |
| **RBAC** | Role-Based Access Control |
| **BS / JHS** | Basic School / Junior High School |
| **RME** | Religious and Moral Education |
| **GES** | Ghana Education Service |
| **NaCCA** | National Council for Curriculum and Assessment (Ghana) |
| **WAEC** | West African Examinations Council |
| **PTA** | Parent-Teacher Association |
| **POS** | Point of Sale |
| **Firestore** | Google Firebase cloud NoSQL document database |
| **Active Term** | The institution-wide current term (1, 2, or 3) |

---

## 19. Appendix: Requirement Traceability

| Source Section (DOCUMENTATION.md) | PRD Section |
| :--- | :--- |
| 1. Executive Summary & Architecture | 1, 9 |
| 2. RBAC & Actor Privileges | 4, 5 |
| 3.1 Academic Performance Engine | 7.1 |
| 3.2 Attendance Register | 7.2 |
| 3.3 Coursework & Gradebook | 7.3 |
| 3.4 Timetable | 7.4 |
| 3.5 Roster, Admissions & Import | 7.5 |
| 3.6 Financial Hub & Payroll | 7.6 |
| 3.7 Certificates | 7.7 |
| 3.8 Resource Library & Communication | 7.8 |
| 3.9 Disaster Recovery | 7.9 |
| 4. Database Schema | 8 |
| 5. User Guide Workflows | 11 |

---

*End of Document: Ayisatu Owen Schools PRD v1.0*
