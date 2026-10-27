# SBA calculation

For each class, subject and term:

- Exercises and homework: all slots on their cards are required. Twenty slots
  have a maximum of 300 marks. Category score = total earned / 300 × 15.
- Group work, quizzes and projects: use the highest recorded entry count among
  enrolled classmates as the shared required count, separately for each category.
  Counts of 5, 3 and 7 therefore use a denominator of 7 × 15 = 105 for everyone.
  Missing required work contributes zero; unused template slots do not increase
  these three denominators.
- Numeric zero, absence and non-submission records count as entries. Absence and
  non-submission earn zero; late submissions retain their numeric marks.
- Each category contributes at most 15. Sum the five categories out of 75,
  then multiply by 50/75. Keep precision until rounding the final SBA to a whole
  mark. Scorebook display rounds category values to two decimals only.
- Historical scores with different maxima are normalized to /15 per entry.
  Original stored marks and marking scales are preserved.
- Terminal exam calculation remains separate and contributes at most 50.

Full marks produce 15 + 15 + 15 + 15 + 15 = 75, and SBA = 50.
Eighty percent in all five categories produces 60/75, and SBA = 40.

Report cards and rankings derive current SBA from coursework when coursework
entries exist for the class/subject/term, rather than trusting an older cached
SBA. Saved exam marks and remarks remain intact. Without coursework entries,
manually entered report grades remain available. Score imports and grading
updates recalculate classmates because a shared denominator may have changed.
