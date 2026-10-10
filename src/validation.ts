import { z } from 'zod';
const text = z.string().max(20000);
const id = z.string().min(1).max(150);
const number = z.number().finite().nonnegative();
const role = z.enum(['Administrator', 'Teacher', 'Student', 'Accountant']);
const classId = z.string().min(1).max(150);
const term = z.number().int().min(1).max(3);
const optionalImage = z
  .string()
  .max(800000)
  .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/)
  .optional();
const url = z
  .string()
  .refine((value) => !value || /^https?:\/\//i.test(value))
  .optional();
export const workspaceSchema = z
  .object({
    version: z.literal(1),
    classes: z.array(z.string().min(1).max(150)).optional(),
    students: z.array(
      z.object({
        id,
        name: text,
        classId,
        gender: text,
        dob: text,
        guardian: text,
        phone: text,
        status: z.enum(['Active', 'Inactive', 'Graduated']),
        enrolled: text,
        photo: optionalImage,
      }),
    ),
    assignments: z.array(
      z.object({
        id,
        title: text,
        subject: text,
        classId,
        points: number.positive(),
        due: text,
        description: text,
        category: text,
        term: text.optional(),
        scores: z
          .record(z.string(), z.object({ score: number, feedback: text.optional() }))
          .optional(),
        slots: z
          .array(z.object({ slotKey: text, title: text, maxPoints: number.positive() }))
          .optional(),
        slotScores: z
          .record(
            z.string(),
            z.record(
              z.string(),
              z.object({
                score: number.nullable().optional(),
                maxPoints: number.optional(),
                feedbackType: z.enum(['none', 'absent', 'not_submitted', 'late']).optional(),
                feedbackReason: text.optional(),
                updatedAt: text.optional(),
              }),
            ),
          )
          .optional(),
      }),
    ),
    submissions: z.array(
      z.object({
        id,
        assignmentId: id,
        studentId: id,
        text,
        link: z.string().refine((value) => !value || /^https?:\/\//i.test(value)),
        filename: text.optional(),
        storagePath: z.string().max(500).optional(),
        date: text,
        score: number.optional(),
        feedback: text.optional(),
        isLate: z.boolean().optional(),
      }),
    ),
    attendance: z.record(z.string(), z.enum(['Present', 'Late', 'Absent', 'Excused'])),
    grades: z.record(
      z.string(),
      z.object({ sba: number.max(50), exam: number.max(50), remark: text }),
    ),
    remarks: z.record(z.string(), text),
    conduct: z.record(z.string(), z.record(z.string(), text)),
    verified: z.array(text),
    resources: z.array(
      z.object({
        id,
        title: text,
        category: text,
        classId,
        subject: text,
        subjectId: text.optional(),
        description: text.optional(),
        type: text,
        fileType: text.optional(),
        date: text,
        content: z.string().max(600000),
        url,
        filename: text.optional(),
        storagePath: z.string().max(500).optional(),
        uploadedBy: id.optional(),
        uploadedByRole: z
          .enum(['Administrator', 'Teacher', 'Student', 'Accountant', 'admin'])
          .optional(),
        targetClassIds: z.array(text).optional(),
      }),
    ),
    periods: z.array(
      z.object({
        id,
        day: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']),
        start: z.string().regex(/^\d{2}:\d{2}$/),
        end: z.string().regex(/^\d{2}:\d{2}$/),
        classId,
        subject: text,
        teacher: text,
        room: text,
      }),
    ),
    payments: z.array(
      z.object({
        id,
        studentId: id,
        amount: number.positive(),
        method: text,
        date: text,
        notes: text,
        term,
        transactionRef: text.optional(),
        receiptNumber: text.optional(),
        recordedBy: text.optional(),
      }),
    ),
    expenses: z.array(
      z.object({
        id,
        title: text,
        category: text,
        vendor: text,
        amount: number.positive(),
        status: text,
        date: text,
        paymentMethod: text.optional(),
        reference: text.optional(),
        recordedBy: text.optional(),
      }),
    ),
    payroll: z.array(
      z.object({
        id,
        name: text,
        job: text,
        basic: number,
        housing: number,
        transport: number,
        tax: number,
        paid: z.boolean(),
      }),
    ),
    fees: z.record(z.string(), z.record(z.string(), number)),
    studentConcessions: z.record(id, z.union([z.literal(50), z.literal(100)])).optional(),
    users: z.array(
      z.object({
        id,
        name: text,
        email: text,
        role,
        active: z.boolean(),
        classes: z.array(classId),
        studentId: id.optional(),
        classAllowedSubjects: z.record(z.string(), z.array(text)).optional(),
      }),
    ),
    teacherAssignments: z
      .array(
        z.object({
          id,
          classId,
          teacherUserId: id,
          teacherId: id,
          subjectId: text,
          isGeneralInstructor: z.boolean(),
          isClassTeacher: z.boolean(),
          createdAt: text,
          createdBy: id.optional(),
        }),
      )
      .optional(),
    certificates: z.array(
      z.object({
        id,
        studentId: id,
        type: text,
        date: text,
        teacherUserId: id.optional(),
        issuedByUserId: id.optional(),
        createdById: id.optional(),
        teacherId: id.optional(),
        issuedBy: text.optional(),
      }),
    ),
    messages: z.array(
      z.object({ id, author: text, title: text, body: text, classId: text, date: text }),
    ),
    logs: z.array(z.object({ id, action: text, actor: text, date: text, type: text })),
    settings: z.object({
      name: text,
      motto: text,
      address: text,
      phone: text,
      email: text,
      year: text,
      term,
      vacation: text,
      reopening: text,
      crest: optionalImage,
    }),
  })
  .superRefine((state, ctx) => {
    const students = new Set(state.students.map((s) => s.id));
    const assignments = new Map(state.assignments.map((a) => [a.id, a]));
    const classNames = new Set(state.classes || []);
    for (const student of state.students) {
      if (!classNames.has(student.classId))
        ctx.addIssue({ code: 'custom', message: 'Student references a missing class.' });
    }
    for (const assignment of state.assignments) {
      if (!classNames.has(assignment.classId))
        ctx.addIssue({ code: 'custom', message: 'Assignment references a missing class.' });
      for (const id of new Set([
        ...Object.keys(assignment.scores || {}),
        ...Object.keys(assignment.slotScores || {}),
      ])) {
        if (!students.has(id))
          ctx.addIssue({
            code: 'custom',
            message: 'Coursework score references a missing student.',
          });
      }
    }
    const submissionKeys = state.submissions.map((s) => `${s.assignmentId}|${s.studentId}`);
    if (new Set(submissionKeys).size !== submissionKeys.length)
      ctx.addIssue({
        code: 'custom',
        message: 'Only one submission per student and assignment is allowed.',
      });
    if (students.size !== state.students.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate student identifiers.' });
    for (const key of [
      'assignments',
      'submissions',
      'resources',
      'periods',
      'payments',
      'expenses',
      'payroll',
      'users',
      'certificates',
      'messages',
      'logs',
    ] as const) {
      if (new Set(state[key].map((record) => record.id)).size !== state[key].length)
        ctx.addIssue({ code: 'custom', message: `Duplicate identifiers in ${key}.` });
    }
    for (const payment of state.payments)
      if (!students.has(payment.studentId))
        ctx.addIssue({ code: 'custom', message: 'Payment references a missing student.' });
    for (const cert of state.certificates)
      if (!students.has(cert.studentId))
        ctx.addIssue({ code: 'custom', message: 'Certificate references a missing student.' });
    for (const submission of state.submissions) {
      const assignment = assignments.get(submission.assignmentId);
      if (
        !students.has(submission.studentId) ||
        !assignment ||
        (submission.score !== undefined && submission.score > assignment.points)
      )
        ctx.addIssue({ code: 'custom', message: 'Invalid submission reference or score.' });
    }
  });
