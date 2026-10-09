export type Role = 'Administrator' | 'Teacher' | 'Student' | 'Accountant';
export type AttendanceStatus = 'Present' | 'Late' | 'Absent' | 'Excused';
export interface Student {
  id: string;
  name: string;
  classId: string;
  gender: string;
  dob: string;
  guardian: string;
  phone: string;
  status: 'Active' | 'Inactive' | 'Graduated';
  enrolled: string;
  photo?: string;
}
export interface Assignment {
  id: string;
  title: string;
  subject: string;
  classId: string;
  points: number;
  due: string;
  description: string;
  category: string;
  term?: string;
  scores?: Record<string, { score: number; feedback?: string }>;
  slots?: { slotKey: string; title: string; maxPoints: number }[];
  slotScores?: Record<
    string,
    Record<
      string,
      {
        score?: number | null;
        maxPoints?: number;
        feedbackType?: 'none' | 'absent' | 'not_submitted' | 'late';
        feedbackReason?: string;
        updatedAt?: string;
      }
    >
  >;
}
export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  text: string;
  link: string;
  filename?: string;
  date: string;
  score?: number;
  feedback?: string;
  isLate?: boolean;
}
export interface Resource {
  id: string;
  title: string;
  category: string;
  classId: string;
  subject: string;
  subjectId?: string;
  description?: string;
  type: string;
  fileType?: string;
  date: string;
  content: string;
  url?: string;
  filename?: string;
  uploadedBy?: string;
  uploadedByRole?: Role | 'admin';
  targetClassIds?: string[];
}
export interface DigitalCertificate {
  id: string;
  studentId: string;
  type: string;
  date: string;
  teacherUserId?: string;
  issuedByUserId?: string;
  createdById?: string;
  teacherId?: string;
  issuedBy?: string;
}
export interface TeacherClassRecord {
  id: string;
  classId: string;
  teacherUserId: string;
  teacherId: string;
  subjectId: string;
  isGeneralInstructor: boolean;
  isClassTeacher: boolean;
  createdAt: string;
  createdBy?: string;
}
export interface Period {
  id: string;
  day: string;
  start: string;
  end: string;
  classId: string;
  subject: string;
  teacher: string;
  room: string;
}
export interface Payment {
  id: string;
  studentId: string;
  amount: number;
  method: string;
  date: string;
  notes: string;
  term: number;
  transactionRef?: string;
  receiptNumber?: string;
  recordedBy?: string;
}
export interface Expense {
  id: string;
  title: string;
  category: string;
  vendor: string;
  amount: number;
  status: string;
  date: string;
  paymentMethod?: string;
  reference?: string;
  recordedBy?: string;
}
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  classes: string[];
  /** Links a student login to its student roster record. */
  studentId?: string;
  /** Per-class subject whitelist for subject-specific teachers. Missing class entries mean all curriculum subjects. */
  classAllowedSubjects?: Record<string, string[]>;
}
export interface Payroll {
  id: string;
  name: string;
  job: string;
  basic: number;
  housing: number;
  transport: number;
  tax: number;
  paid: boolean;
}
export interface Grade {
  sba: number;
  exam: number;
  remark: string;
}
export interface Settings {
  name: string;
  motto: string;
  address: string;
  phone: string;
  email: string;
  year: string;
  term: number;
  vacation: string;
  reopening: string;
  crest?: string;
}
export interface State {
  version: 1;
  classes: string[];
  students: Student[];
  assignments: Assignment[];
  submissions: Submission[];
  attendance: Record<string, AttendanceStatus>;
  grades: Record<string, Grade>;
  remarks: Record<string, string>;
  conduct: Record<string, Record<string, string>>;
  verified: string[];
  resources: Resource[];
  periods: Period[];
  payments: Payment[];
  expenses: Expense[];
  payroll: Payroll[];
  fees: Record<string, Record<string, number>>;
  studentConcessions?: Record<string, 50 | 100>;
  users: User[];
  teacherAssignments?: TeacherClassRecord[];
  certificates: DigitalCertificate[];
  messages: {
    id: string;
    author: string;
    title: string;
    body: string;
    classId: string;
    date: string;
  }[];
  logs: { id: string; action: string; actor: string; date: string; type: string }[];
  settings: Settings;
}

export const courseworkCategories = [
  'Exercise',
  'Homework',
  'Groupwork',
  'Quiz',
  'Project',
] as const;
export type CourseworkCategory = (typeof courseworkCategories)[number];
export type FeedbackType = 'none' | 'absent' | 'not_submitted' | 'late';
export const courseworkCategoryConfigs = {
  exercise: {
    prefix: 'EXE',
    slotCount: 20,
    label: 'Class Exercises',
    maxPoints: 15,
    description: 'In-class seatwork, drills & continuous exercise sheets (EXE1 - EXE20)',
  },
  homework: {
    prefix: 'HW',
    slotCount: 20,
    label: 'Homework & Assignments',
    maxPoints: 15,
    description: 'Take-home problem sets, practice tasks & homework modules (HW1 - HW20)',
  },
  groupwork: {
    prefix: 'GW',
    slotCount: 10,
    label: 'Groupwork & Collaboration',
    maxPoints: 15,
    description: 'Team activities, paired problem solving & lab tasks (GW1 - GW10)',
  },
  quiz: {
    prefix: 'Quiz',
    slotCount: 2,
    label: 'Quizzes & Class Tests',
    maxPoints: 15,
    description: 'Periodic formative evaluations & mid-term checks (Quiz1, Quiz2)',
  },
  project: {
    prefix: 'PW',
    slotCount: 5,
    label: 'Project Work',
    maxPoints: 15,
    description: 'Capstones, scientific inquiries & research tasks (PW1 - PW5)',
  },
  exam: {
    prefix: 'Exam',
    slotCount: 1,
    label: 'Terminal Exam',
    maxPoints: 100,
    description: 'Official end of term summative examination paper (100 Max Score)',
  },
} as const;
export type CourseworkCategoryKey = keyof typeof courseworkCategoryConfigs;
export function isBsClass(name?: string, gradeLevel?: string | number): boolean {
  const value = `${name || ''} ${gradeLevel ?? ''}`.toLowerCase();
  return /\b(bs|basic|class|grade|primary|p)\s*[1-6]\b/.test(value);
}
export function isJhsClass(name?: string, gradeLevel?: string | number): boolean {
  const value = `${name || ''} ${gradeLevel ?? ''}`.toLowerCase();
  return (
    /\b(jhs|junior\s*high)\s*[1-3]\b/.test(value) || /\b(basic|bs|grade)\s*[7-9]\b/.test(value)
  );
}
export function generateCourseworkSlots(category: CourseworkCategoryKey) {
  const config = courseworkCategoryConfigs[category];
  return Array.from({ length: config.slotCount }, (_, index) => ({
    slotKey: category === 'exam' ? 'Exam' : `${config.prefix}${index + 1}`,
    title:
      category === 'exam' ? 'Terminal Exam' : `${config.label.replace(/s$/, '')} #${index + 1}`,
    maxPoints: config.maxPoints,
  }));
}
export function ensureClassCourseworkCards(
  state: State,
  classId: string,
  term: number,
  allowedSubjectIds?: Set<string>,
): { assignments: Assignment[]; createdCount: number } {
  const isJhs = isJhsClass(classId);
  const classCurriculum = (
    isJhs
      ? subjects.map((subject) => (subject === 'History' ? 'Social Studies' : subject))
      : subjects
  ).filter((subject) => {
    const normalized = subject.trim().toLowerCase();
    if (
      normalized === 'general' ||
      normalized === 'general subject' ||
      normalized === 'class stream'
    )
      return false;
    return (
      !allowedSubjectIds ||
      allowedSubjectIds.has(courseworkSubjectId(subject)) ||
      allowedSubjectIds.has(subject)
    );
  });
  const categories = Object.keys(courseworkCategoryConfigs) as CourseworkCategoryKey[];
  const additions: Assignment[] = [];
  for (const subject of classCurriculum) {
    for (const category of categories) {
      const id = `cc_${classId}_${subject.replace(/[^a-z0-9]/gi, '_')}_${category}_term${term}`;
      if (state.assignments.some((assignment) => assignment.id === id)) continue;
      const config = courseworkCategoryConfigs[category];
      additions.push({
        id,
        classId,
        subject,
        points: config.maxPoints,
        due: today(),
        title: config.label,
        description: config.description,
        category: category === 'exam' ? 'Terminal exam' : config.label,
        term: `Term ${term}`,
        slots: generateCourseworkSlots(category),
        slotScores: {},
      });
    }
  }
  return { assignments: [...state.assignments, ...additions], createdCount: additions.length };
}
export const courseworkFeedbackMetadata: Record<FeedbackType, { label: string; tag: string }> = {
  none: { label: 'Normal Graded', tag: 'OK' },
  absent: { label: 'Absent', tag: 'ABS' },
  not_submitted: { label: "Didn't Submit", tag: 'DNS' },
  late: { label: 'Late Submission', tag: 'LATE' },
};

export interface CourseworkAssessment {
  categories: Record<CourseworkCategory, number | null>;
  categoryDetails: Record<
    CourseworkCategory,
    { earnedRaw: number; maxRaw: number; scaled15: number; count: number }
  >;
  rawSba: number | null;
  sba: number | null;
  examRaw: number | null;
  exam: number | null;
  total: number | null;
  grade: string;
  hasSba: boolean;
  hasExam: boolean;
}

export function courseworkCategory(category: string): CourseworkCategory | 'Exam' | null {
  const normalized = category.toLowerCase().trim();
  if (normalized.includes('exam')) return 'Exam';
  if (normalized.includes('exercise')) return 'Exercise';
  if (normalized.includes('homework') || normalized.includes('assignment')) return 'Homework';
  if (normalized.includes('group') || normalized.includes('practical')) return 'Groupwork';
  if (normalized.includes('quiz') || normalized.includes('test')) return 'Quiz';
  if (normalized.includes('project')) return 'Project';
  return null;
}

/** Derive the five SBA bands and terminal exam from graded assignment submissions. */
export function courseworkAssessment(
  state: State,
  studentId: string,
  classId: string,
  subject: string,
): CourseworkAssessment {
  const assignments = state.assignments.filter(
    (assignment) => assignment.classId === classId && assignment.subject === subject,
  );
  const categories = Object.fromEntries(
    courseworkCategories.map((category) => [category, null]),
  ) as Record<CourseworkCategory, number | null>;
  const categoryDetails = Object.fromEntries(
    courseworkCategories.map((category) => [
      category,
      { earnedRaw: 0, maxRaw: 0, scaled15: 0, count: 0 },
    ]),
  ) as CourseworkAssessment['categoryDetails'];
  let hasSba = false;
  let hasExam = false;
  let examRaw: number | null = null;

  for (const category of [...courseworkCategories, 'Exam'] as const) {
    const categoryAssignments = assignments.filter(
      (assignment) => courseworkCategory(assignment.category) === category,
    );
    const scores = categoryAssignments.flatMap((assignment) => {
      const submission = state.submissions.find(
        (item) => item.assignmentId === assignment.id && item.studentId === studentId,
      );
      const slots = assignment.slots?.length
        ? assignment.slots
        : [{ slotKey: 'Score', title: assignment.title, maxPoints: assignment.points }];
      const slotScores = slots.flatMap((slot, slotIndex) => {
        const slotScore = assignment.slotScores?.[studentId]?.[slot.slotKey]?.score;
        const legacyScore =
          slotIndex === 0
            ? (assignment.scores?.[studentId]?.score ?? submission?.score)
            : undefined;
        const score = slotScore ?? legacyScore;
        const feedbackType = assignment.slotScores?.[studentId]?.[slot.slotKey]?.feedbackType;
        if (
          score === undefined ||
          score === null ||
          !Number.isFinite(score) ||
          feedbackType === 'absent' ||
          feedbackType === 'not_submitted'
        )
          return [];
        const max =
          assignment.slotScores?.[studentId]?.[slot.slotKey]?.maxPoints ??
          slot.maxPoints ??
          assignment.points;
        if (max <= 0) return [];
        return [{ earned: Math.max(0, score), max }];
      });
      return slotScores;
    });
    if (!scores.length) continue;

    const earned = scores.reduce((sum, score) => sum + score.earned, 0);
    const possible = scores.reduce((sum, score) => sum + score.max, 0);
    if (category === 'Exam') {
      hasExam = true;
      examRaw = Math.round(earned);
    } else {
      hasSba = true;
      const scaled15 = Math.round((earned / possible) * 15);
      categoryDetails[category] = {
        earnedRaw: Math.round(earned),
        maxRaw: Math.round(possible),
        scaled15,
        count: scores.length,
      };
      categories[category] = scaled15;
    }
  }

  const rawSba = hasSba
    ? courseworkCategories.reduce((sum, category) => sum + (categories[category] ?? 0), 0)
    : null;
  const sba = Math.round(((rawSba ?? 0) / 60) * 50);
  const exam = examRaw === null ? null : Math.round(examRaw / 2);
  const total = hasSba || hasExam ? Math.min(100, sba + (exam ?? 0)) : null;

  return {
    categories,
    categoryDetails,
    rawSba,
    sba,
    examRaw,
    exam,
    total,
    grade: gradeLetter(total ?? 0),
    hasSba,
    hasExam,
  };
}
export const classes = ['Basic 6 - Gold', 'Basic 4 - Blue', 'JHS 2 - Alpha', 'Basic 1 - Green'];
export const subjects = [
  'Mathematics',
  'English Language',
  'Integrated Science',
  'Religious & Moral Education (RME)',
  'History',
  'Ghanaian Language (Twi)',
  'Creative Arts & Design',
  'Computing / ICT',
];
export const classSubjects = (classId: string) =>
  subjects.map((s) =>
    s === 'History' && classId.toUpperCase().startsWith('JHS') ? 'Social Studies' : s,
  );
export const courseworkSubjectId = (subject: string) => {
  const known: Record<string, string> = {
    mathematics: 'sub_math',
    'english language': 'sub_eng',
    'integrated science': 'sub_sci',
    'religious & moral education (rme)': 'sub_rme',
    'creative arts & design': 'sub_cad',
    'ghanaian language (twi)': 'sub_twi',
    'computing / ict': 'sub_ict',
    history: 'sub_hist',
    'social studies': 'sub_soc',
  };
  return (
    known[subject.trim().toLowerCase()] ||
    subject
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
  );
};
export const today = () => new Date().toISOString().slice(0, 10);
export const uid = () => crypto.randomUUID();
export const gradeKey = (id: string, term: number, subject: string) => `${id}|${term}|${subject}`;
export const gradeLetter = (total: number) =>
  total >= 80
    ? 'A'
    : total >= 70
      ? 'B'
      : total >= 60
        ? 'C'
        : total >= 50
          ? 'D'
          : total >= 40
            ? 'E'
            : 'F';
export const rank = (score: number, scores: number[]) => 1 + scores.filter((s) => s > score).length;
export const ordinal = (n: number) =>
  `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] || 'th'}`;
export const money = (n: number) =>
  new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    maximumFractionDigits: 2,
  }).format(n);
export const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('');
export const standing = (percent: number) =>
  percent >= 95 ? 'Excellent' : percent >= 85 ? 'Good' : percent >= 75 ? 'Warning' : 'Critical';
export const conflicts = (a: Period, b: Period) =>
  a.id !== b.id &&
  a.day === b.day &&
  a.start < b.end &&
  b.start < a.end &&
  (a.teacher === b.teacher || a.room === b.room || a.classId === b.classId);
export function billed(state: State, s: Student) {
  const total = Object.values(state.fees[s.classId] || {}).reduce((a, b) => a + b, 0);
  return Math.round(total * (1 - (state.studentConcessions?.[s.id] || 0) / 100) * 100) / 100;
}
export function paid(state: State, id: string) {
  return state.payments
    .filter((p) => p.studentId === id && p.term === state.settings.term)
    .reduce((a, p) => a + p.amount, 0);
}
export function studentGrades(state: State, s: Student) {
  return classSubjects(s.classId).map((subject) => ({
    subject,
    ...(state.grades[gradeKey(s.id, state.settings.term, subject)] || {
      sba: 0,
      exam: 0,
      remark: '',
    }),
  }));
}
export function average(state: State, s: Student) {
  const gs = studentGrades(state, s);
  return gs.reduce((a, g) => a + g.sba + g.exam, 0) / gs.length;
}
export function seed(): State {
  const names = [
    'Kofi Mensah Boateng',
    'Ama Serwaa Antwi',
    'Kwame Osei Tutu',
    'Abena Mansa',
    'Yaw Opoku Ware',
    'Efua Badu',
    'Kwesi Appiah',
    'Nana Yaa Asante',
    'Amara Okafor',
    'Ekow Baidoo',
    'Akosua Owusu',
    'Kojo Adjei',
    'Abena Osei',
    'Yaw Antwi',
    'Esi Mensah',
    'Kwame Appiah',
    'Akua Danquah',
    'Kwaku Ofori',
    'Ama Agyeman',
    'Kofi Asare',
    'Afia Addo',
    'Kwabena Aidoo',
    'Adwoa Sarpong',
    'Nana Osei',
  ];
  const students: Student[] = names.map((name, i) => ({
    id: `AOS-2026-${String(892 + i).padStart(4, '0')}`,
    name,
    classId: classes[i % 4],
    gender: i % 2 ? 'Female' : 'Male',
    dob: `${2014 + (i % 4)}-04-12`,
    guardian: `${name.split(' ').at(-1)} family`,
    phone: '+233 24 555 0100',
    status: i === 14 ? 'Inactive' : i === 19 ? 'Graduated' : 'Active',
    enrolled: '2026-09-07',
  }));
  const grades: State['grades'] = {};
  for (const [i, s] of students.entries())
    for (const t of [1, 2, 3])
      for (const [j, sub] of classSubjects(s.classId).entries())
        grades[gradeKey(s.id, t, sub)] = {
          sba: 30 + ((i * 3 + j * 7) % 20),
          exam: 28 + ((i * 7 + j * 3) % 22),
          remark: 'Making steady progress',
        };
  const assignments: Assignment[] = [
    {
      id: 'a1',
      title: 'Exploring the world of plants',
      subject: 'Integrated Science',
      classId: classes[0],
      points: 50,
      due: '2026-10-12',
      description:
        'Observe a plant in your environment. Draw and label its parts, then describe how each part helps it grow.',
      category: 'Project',
    },
    {
      id: 'a2',
      title: 'Grammar & punctuation practice',
      subject: 'English Language',
      classId: classes[0],
      points: 20,
      due: '2026-10-09',
      description:
        'Write a short paragraph about your school. Underline five nouns and circle the punctuation marks.',
      category: 'Homework',
    },
    {
      id: 'a3',
      title: 'The story of the Gold Coast',
      subject: 'History',
      classId: classes[1],
      points: 30,
      due: '2026-10-05',
      description: 'Create a timeline of five important events in the history of the Gold Coast.',
      category: 'Class test',
    },
  ];
  const periods: Period[] = [];
  ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].forEach((day, d) =>
    ['08:00', '09:00', '10:00', '11:30', '12:30', '13:30', '14:30'].forEach((start, i) => {
      const end = `${String(Number(start.slice(0, 2)) + 1).padStart(2, '0')}:${start.slice(3)}`;
      periods.push({
        id: `p${d}-${i}`,
        day,
        start,
        end,
        classId: classes[0],
        subject: subjects[(d + i) % 8],
        teacher: ['Sarah Mensah', 'Alex Rivera', 'John Doe', 'Patricia Kwesi'][(d + i) % 4],
        room: (d + i) % 8 === 2 ? 'Science Lab' : 'Room 102',
      });
    }),
  );
  const date = today();
  return {
    version: 1,
    classes: [...classes],
    students,
    assignments,
    submissions: students
      .filter((s) => s.classId === classes[0])
      .map((s, i) => ({
        id: `sub${i}`,
        assignmentId: 'a1',
        studentId: s.id,
        text: 'I observed a mango plant. Its roots absorb water and its leaves capture sunlight.',
        link: '',
        date: '2026-10-06T10:00:00Z',
        score: i === 0 ? 45 : undefined,
        feedback: i === 0 ? 'Thoughtful observations. Well done!' : undefined,
      })),
    attendance: Object.fromEntries(
      students
        .filter((s) => s.classId === classes[0])
        .map((s, i) => [
          `${date}|2|${s.id}`,
          (['Present', 'Late', 'Present', 'Absent', 'Excused', 'Present'] as AttendanceStatus[])[i],
        ]),
    ),
    grades,
    remarks: {},
    conduct: {},
    verified: [],
    resources: [
      ['Term 2 mathematics syllabus', 'Syllabus Guides', 'Mathematics'],
      ['Computing practical guide', 'Lecture Notes', 'Computing'],
      ['Ghanaian language practice', 'Worksheets', 'Ghanaian Language'],
      ['Our history: a study guide', 'Lecture Notes', 'History'],
      ['Science lab safety', 'Worksheets', 'Integrated Science'],
      ['English essay rubric', 'Syllabus Guides', 'English Language'],
    ].map(([title, category, subject], i) => ({
      id: `r${i}`,
      title,
      category,
      subject,
      classId: classes[0],
      type: 'TXT',
      date: '2026-10-05',
      content: `${title}\n\nAyisatu Owen Schools — Basic 6\n\nLearning objectives\n• Build understanding through observation and practice.\n• Explain ideas clearly using examples.\n• Reflect on your progress.\n\nClass activity\nReview your class notes, complete the assigned exercise, and discuss your answers with a partner.\n\nThis is a sample teaching resource for the frontend demonstration.`,
    })),
    periods,
    payments: students.slice(0, 18).map((s, i) => ({
      id: `REC-2026-${1001 + i}`,
      studentId: s.id,
      amount: i % 3 === 0 ? 520 : i % 3 === 1 ? 300 : 150,
      method: i % 2 ? 'Mobile Money' : 'Cash',
      date: '2026-10-06',
      notes: 'Term fees',
      term: 2,
    })),
    expenses: [
      {
        id: 'e1',
        title: 'Classroom stationery',
        category: 'Supplies',
        vendor: 'Kumasi Office Supplies',
        amount: 1200,
        status: 'Approved',
        date: '2026-10-05',
      },
      {
        id: 'e2',
        title: 'Electricity',
        category: 'Utilities',
        vendor: 'ECG',
        amount: 450,
        status: 'Pending',
        date: '2026-10-06',
      },
    ],
    payroll: [
      {
        id: 'staff1',
        name: 'Sarah Mensah',
        job: 'Class Teacher',
        basic: 2800,
        housing: 400,
        transport: 200,
        tax: 280,
        paid: false,
      },
      {
        id: 'staff2',
        name: 'Alex Rivera',
        job: 'Mathematics Teacher',
        basic: 3000,
        housing: 400,
        transport: 250,
        tax: 300,
        paid: false,
      },
      {
        id: 'staff3',
        name: 'Grace Asante',
        job: 'School Accountant',
        basic: 3200,
        housing: 400,
        transport: 200,
        tax: 320,
        paid: true,
      },
    ],
    fees: Object.fromEntries(
      classes.map((c) => [
        c,
        {
          Tuition: c.startsWith('JHS') ? 600 : 450,
          'ICT levy': 50,
          'PTA dues': 20,
          ...(c.startsWith('JHS') ? { 'Science laboratory': 100 } : {}),
        },
      ]),
    ),
    users: [
      {
        id: 'u1',
        name: 'Grace Asante',
        email: 'admin@ayisatuowen.edu.gh',
        role: 'Administrator',
        active: true,
        classes: [],
      },
      {
        id: 'u2',
        name: 'Sarah Mensah',
        email: 'teacher@ayisatuowen.edu.gh',
        role: 'Teacher',
        active: true,
        classes: classes.slice(0, 2),
      },
      {
        id: 'u3',
        name: students[0].name,
        email: 'student@ayisatuowen.edu.gh',
        role: 'Student',
        active: true,
        classes: [classes[0]],
        studentId: students[0].id,
      },
      {
        id: 'u4',
        name: 'Daniel Owusu',
        email: 'accounts@ayisatuowen.edu.gh',
        role: 'Accountant',
        active: true,
        classes: [],
      },
    ],
    teacherAssignments: classes.slice(0, 2).map((classId, index) => ({
      id: `tc_seed_${index + 1}`,
      classId,
      teacherUserId: 'u2',
      teacherId: 'u2',
      subjectId: 'all',
      isGeneralInstructor: true,
      isClassTeacher: true,
      createdAt: '2026-10-01T08:00:00.000Z',
      createdBy: 'u1',
    })),
    certificates: [
      { id: 'cert1', studentId: students[0].id, type: 'Academic Excellence', date: '2026-10-01' },
    ],
    messages: [
      {
        id: 'm1',
        author: 'Sarah Mensah',
        title: 'A new week of discovery',
        body: 'Please bring a small leaf sample for our science lesson on Monday. We will explore the amazing world of plants together.',
        classId: classes[0],
        date: '2026-10-06T08:30:00Z',
      },
      {
        id: 'm2',
        author: 'Grace Asante',
        title: 'Mid-term assessments',
        body: 'Mid-term assessments begin on 19 October. Review the timetable and use the practice materials in your resource library.',
        classId: 'All classes',
        date: '2026-10-05T10:00:00Z',
      },
    ],
    logs: [
      {
        id: 'log1',
        action: 'Term 2 academic workspace prepared',
        actor: 'Grace Asante',
        date: '2026-10-07T08:00:00Z',
        type: 'Settings',
      },
      {
        id: 'log2',
        action: 'Science assignment published for Basic 6 - Gold',
        actor: 'Sarah Mensah',
        date: '2026-10-06T11:30:00Z',
        type: 'Academic',
      },
      {
        id: 'log3',
        action: 'Student fee payments recorded',
        actor: 'Daniel Owusu',
        date: '2026-10-06T10:00:00Z',
        type: 'Finance',
      },
    ],
    settings: {
      name: 'Ayisatu Owen Schools',
      motto: 'Knowledge is Power',
      address: 'P.O. Box 452, Kumasi · Ghana',
      phone: '+233 24 555 0123',
      email: 'hello@ayisatuowen.edu.gh',
      year: '2026/2027',
      term: 2,
      vacation: '2026-12-12',
      reopening: '2027-01-11',
    },
  };
}
