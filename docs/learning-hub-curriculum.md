# Learning Hub curriculum source ledger

Researched 28 October 2026. The built-in catalog contains **18 original lessons and 54 multiple-choice questions**, with three Mathematics and three Science lessons at each of B7, B8 and B9. It is a starter catalog covering selected standards, not the full Ghanaian curriculum, a replacement textbook, or a NaCCA-endorsed product. Science coverage currently concentrates on Diversity of Matter. No Khan Academy teaching content is included.

## Source identity and access

- [NaCCA Mathematics Common Core Programme B7–B9](https://mingycomputersgh.wordpress.com/wp-content/uploads/2023/10/mathematics-1.pdf): inspected the 259-page PDF linked from the supplied JHS archive. The cover names NaCCA / Ministry of Education and September 2020. This is an original NaCCA document hosted on a third-party mirror, not a document authored by the archive owner.
- [NaCCA Science Common Core Programme B7–B9](https://mingycomputersgh.wordpress.com/wp-content/uploads/2023/10/science.pdf): inspected the 170-page PDF linked from that archive; page footers identify NaCCA / Ministry of Education 2021. Standards and indicator identifiers below were read from the document.
- [Supplied JHS archive](https://mingycomputersgh.wordpress.com/2023/10/21/download-the-new-gesnacca-curriculum-full-b7jhs1-to-b9jhs3/): its links were followed to Mathematics, Science, Computing, English Language, Social Studies, Creative Arts and Design, Career Technology, RME, Ghanaian Language, and Physical Education and Health PDFs. Those direct PDF URLs form the broader reference directory.
- [Supplied 2019 primary archive](https://mingycomputersgh.wordpress.com/gesnacca-new-curriculum-for-2019/): inspected its KG and primary subject listings. Opened its B4–B6 Mathematics (183 pages) and Science (69 pages) PDFs to verify the direct reference links. No primary scored lessons are claimed in this release.
- [Official NaCCA 2019 directory](https://nacca.gov.gh/learning-areas-subjects/new-standards-based-curriculum-2019/): two fetch attempts timed out. The requested official URL is retained as a reference, but its live page contents were not verified. The mirrored original PDFs supplied the detailed alignment evidence.
- [Official Ministry of Education resource portal](https://curriculumresources.edu.gh/): the current homepage was inspected. It chiefly presents SHS/SHTS/STEM Year 1–3 learner and teacher materials, with Basic and JHS menu links. It must not be represented as an exclusively JHS content source.

## Alignment register

Page numbers below are **one-based PDF viewer pages**, not the curriculum's printed pagination. The catalog's `standard` field can identify either a content standard (four numeric components) or a narrower indicator (five components). These are references to selected learning outcomes, not claims that a short lesson assesses the entire standard.

| Lesson ID | Catalog reference | Verified supporting indicators | PDF pages |
| --- | --- | --- | --- |
| b7-math-fractions | B7.1.3.1 | B7.1.3.1.1, B7.1.3.1.2 | Mathematics 47–49 |
| b7-math-add-fractions | B7.1.3.2 | B7.1.3.2.1, B7.1.3.2.2 | Mathematics 49–50 |
| b7-math-equations | B7.2.3.1 | B7.2.3.1.4 | Mathematics 76 |
| b8-math-operations | B8.1.3.1 | B8.1.3.1.1, B8.1.3.1.2, B8.1.3.1.3 | Mathematics 132–134 |
| b8-math-inequalities | B8.2.3.1 | B8.2.3.1.1, B8.2.3.1.2, B8.2.3.1.3 | Mathematics 151–152 |
| b8-math-probability | B8.4.2.1 | B8.4.2.1.1, B8.4.2.1.2 | Mathematics 191–192 |
| b9-math-proportion | B9.1.4.1 | B9.1.4.1.1, B9.1.4.1.2 | Mathematics 205–206 |
| b9-math-rational-inequalities | B9.2.3.1 | B9.2.3.1.1, B9.2.3.1.2 | Mathematics 220–221 |
| b9-math-statistics | B9.4.1.2 | B9.4.1.2.2, B9.4.1.2.3 | Mathematics 247–248 |
| b7-science-matter | B7.1.1.1 | B7.1.1.1.1, B7.1.1.1.2, B7.1.1.1.3 | Science 39–40 |
| b7-science-elements | B7.1.1.2 | B7.1.1.2.1 | Science 41 |
| b7-science-cells | B7.1.2.1 | B7.1.2.1.1, B7.1.2.1.2 | Science 42–43 |
| b8-science-mixtures | B8.1.1.1 | B8.1.1.1.1 | Science 89–90 |
| b8-science-separation | B8.1.1.1.2 | B8.1.1.1.2 | Science 90 |
| b8-science-atoms | B8.1.1.2 | B8.1.1.2.1 | Science 91 |
| b9-science-compounds | B9.1.1.1.2 | B9.1.1.1.2 | Science 124–125 |
| b9-science-acids | B9.1.1.1.3 | B9.1.1.1.3 | Science 125 |
| b9-science-bonding | B9.1.1.2 | B9.1.1.2.1 | Science 126 |

## Authoring and interpretation

The prose, examples, numerical values and questions were independently written for this LMS. The references provide curriculum alignment; they are not reproduced as a textbook. Financial percentages are explicitly hypothetical exercises. Science activities use teacher supervision where heating or chemicals are involved. The short readings also contain prerequisite explanations that support the cited outcome.

Every built-in lesson has a stable ID, a linked source, four reading paragraphs, and three questions with a zero-based correct option and an explanation. The source catalog includes official directories and clearly labelled mirrored PDFs. External reference documents open separately; opening one cannot establish that a learner read, understood, or completed it.

Three questions provide a small practice sample. A high score does not certify mastery of a complete NaCCA content standard. Repeat attempts use the same question set, so improvement may partly reflect recall. Recommendations should identify areas for review using observed scores and attempted content; they should not diagnose ability, invent activity, or count an unattempted lesson as a zero score.

Coverage gaps include primary scored lessons, other JHS learning areas, most Science strands, videos, practical assessment, open-ended marking, and a full year-by-year scheme of learning. Teachers should use the linked documents and their school scheme to select appropriate content and add reviewed lessons. The research does not establish that the mirrored editions are the latest revisions of every subject, nor that every external link will remain available.

## Verification

A structural check validates unique lesson/question IDs, non-empty readings and questions, valid answer indexes, distinct answer options, HTTPS source links, and six lessons per B7/B8/B9. Question calculations and explanations were manually checked against their keyed options. The catalog is formatted with the repository's Prettier configuration. Application-level access and scoring tests are maintained by the implementation workstream.
