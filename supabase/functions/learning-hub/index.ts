import { authenticate, json } from '../_shared/http.ts';
import { hubLessons, type HubLesson } from '../../../src/learningHub/catalog.ts';
import { gradePractice, learnerLesson, manages, profileUser, requestSchema } from './rules.ts';

const assignmentView = (r: any) => ({
  id: r.id,
  lessonId: r.lesson_id,
  classId: r.class_id,
  studentIds: r.student_ids,
  dueDate: r.due_date,
  createdBy: r.created_by,
  createdAt: r.created_at,
});
const activityView = (r: any) => ({
  id: r.id,
  lessonId: r.lesson_id,
  studentId: r.student_id,
  assignmentId: r.assignment_id,
  createdAt: r.created_at,
  ...(r.score === undefined ? {} : { score: r.score, correct: r.correct, total: r.total }),
});

// Read every page explicitly: PostgREST's default row limit must not silently truncate analytics.
async function rows(client: any, table: string) {
  const all: any[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await client
      .from(table)
      .select('*')
      .order('id')
      .range(offset, offset + 999);
    if (result.error) throw result.error;
    all.push(...result.data);
    if (result.data.length < 1000) return all;
    if (all.length >= 100000)
      throw new Error('Learning history is too large to load. Contact the administrator.');
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return json({});
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { client, profile } = await authenticate(request);
    const user = profileUser(profile);
    if (!['Administrator', 'Teacher', 'Student'].includes(user.role))
      return json({ error: 'Learning Hub access is unavailable for this role' }, 403);
    const input = requestSchema.parse(await request.json());
    const workspace = await client
      .from('school_workspace')
      .select('document')
      .eq('id', true)
      .single();
    if (workspace.error) throw workspace.error;
    const roster: { id: string; classId: string }[] = workspace.data.document.students || [];
    const student = roster.find((s) => s.id === user.studentId);
    if (user.role === 'Student' && !student)
      return json({ error: 'Your account must be linked to an existing student record' }, 403);
    const [custom, assignments] = await Promise.all([
      rows(client, 'learning_hub_lessons'),
      rows(client, 'learning_hub_assignments'),
    ]);
    const lessons: HubLesson[] = [
      ...hubLessons,
      ...custom.map((l) => ({ ...l.document, id: l.id })),
    ];
    const lessonById = new Map(lessons.map((l) => [l.id, l]));
    const visibleAssignments = assignments.filter((a) => {
      const lesson = lessonById.get(a.lesson_id);
      if (!lesson) return false;
      return user.role === 'Student'
        ? a.student_ids.includes(student!.id) && a.class_id === student!.classId
        : manages(user, a.class_id, lesson.subject);
    });
    const visibleLessons = lessons.filter(
      (l) =>
        hubLessons.some((b) => b.id === l.id) ||
        user.role === 'Administrator' ||
        (user.role === 'Teacher' &&
          custom.some((c) => c.id === l.id && c.created_by === user.id)) ||
        visibleAssignments.some((a) => a.lesson_id === l.id),
    );
    const visibleLessonIds = new Set(visibleLessons.map((l) => l.id));
    if (input.action === 'load') {
      const [attempts, readings] = await Promise.all([
        rows(client, 'learning_hub_attempts'),
        rows(client, 'learning_hub_readings'),
      ]);
      const visibleActivity = (r: any) => {
        const lesson = lessonById.get(r.lesson_id);
        const owner = roster.find((s) => s.id === r.student_id);
        if (!lesson || !owner || !visibleLessonIds.has(lesson.id)) return false;
        if (r.assignment_id && !visibleAssignments.some((a) => a.id === r.assignment_id))
          return false;
        return user.role === 'Student'
          ? r.student_id === student!.id
          : manages(user, owner.classId, lesson.subject);
      };
      return json({
        lessons: user.role === 'Student' ? visibleLessons.map(learnerLesson) : visibleLessons,
        assignments: visibleAssignments.map((a) =>
          assignmentView({
            ...a,
            student_ids:
              user.role === 'Student'
                ? [student!.id]
                : a.student_ids.filter((id: string) =>
                    roster.some(
                      (s) =>
                        s.id === id &&
                        manages(user, s.classId, lessonById.get(a.lesson_id)!.subject),
                    ),
                  ),
          }),
        ),
        attempts: attempts.filter(visibleActivity).map(activityView),
        readings: readings.filter(visibleActivity).map(activityView),
      });
    }
    if (input.action === 'create-lesson') {
      if (
        user.role !== 'Administrator' &&
        !(
          user.role === 'Teacher' &&
          user.classes.some((classId) => manages(user, classId, input.lesson.subject))
        )
      )
        return json(
          { error: 'Only authorized teaching staff can create lessons for this subject' },
          403,
        );
      const result = await client
        .from('learning_hub_lessons')
        .insert({ document: input.lesson, created_by: user.id })
        .select('*')
        .single();
      if (result.error) throw result.error;
      return json({ ...result.data.document, id: result.data.id }, 201);
    }
    const lesson = visibleLessons.find((l) => l.id === input.lessonId);
    if (!lesson) return json({ error: 'Lesson unavailable' }, 404);
    if (input.action === 'assign') {
      if (!manages(user, input.classId, lesson.subject))
        return json({ error: 'You cannot assign this subject to this class' }, 403);
      const classStudents = roster.filter((s) => s.classId === input.classId);
      const studentIds = [...new Set(input.studentIds || classStudents.map((s) => s.id))];
      if (!studentIds.length || studentIds.some((id) => !classStudents.some((s) => s.id === id)))
        return json({ error: 'Choose students enrolled in the selected class' }, 400);
      const result = await client
        .from('learning_hub_assignments')
        .insert({
          lesson_id: lesson.id,
          class_id: input.classId,
          student_ids: studentIds,
          due_date: input.dueDate,
          created_by: user.id,
        })
        .select('*')
        .single();
      if (result.error) throw result.error;
      return json(assignmentView(result.data), 201);
    }
    if (user.role !== 'Student' || !student)
      return json({ error: 'Only a student can record their own learning progress' }, 403);
    if (
      input.assignmentId &&
      !visibleAssignments.some(
        (a) =>
          a.id === input.assignmentId &&
          a.lesson_id === lesson.id &&
          a.student_ids.includes(student.id),
      )
    )
      return json({ error: 'This assignment is not assigned to you' }, 403);
    const base = {
      lesson_id: lesson.id,
      student_id: student.id,
      assignment_id: input.assignmentId || null,
    };
    if (input.action === 'complete-reading') {
      const result = await client.from('learning_hub_readings').upsert(base, {
        onConflict: 'student_id,lesson_id,assignment_id',
        ignoreDuplicates: true,
      });
      if (result.error) throw result.error;
      let query = client
        .from('learning_hub_readings')
        .select('*')
        .eq('student_id', student.id)
        .eq('lesson_id', lesson.id);
      query = input.assignmentId
        ? query.eq('assignment_id', input.assignmentId)
        : query.is('assignment_id', null);
      const saved = await query.single();
      if (saved.error) throw saved.error;
      return json(activityView(saved.data));
    }
    const graded = gradePractice(lesson, input.answers);
    const saved = await client
      .from('learning_hub_attempts')
      .insert({ ...base, score: graded.score, correct: graded.correct, total: graded.total })
      .select('*')
      .single();
    if (saved.error) throw saved.error;
    return json({ attempt: activityView(saved.data), feedback: graded.feedback }, 201);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : (error as any)?.message || 'Learning request failed';
    return json({ error: message }, message === 'Unauthorized' ? 401 : 400);
  }
});
