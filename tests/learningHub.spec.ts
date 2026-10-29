import { test, expect, type Page } from '@playwright/test';
import { seed, type Role } from '../src/data';
import type { HubSnapshot, LearningLesson } from '../src/learningHub/types';

const lesson: LearningLesson = {
  id: 'hub-test-lesson',
  title: 'Understanding equivalent fractions',
  subject: 'Mathematics',
  level: 'B7',
  strand: 'Number',
  standard: 'B7 Number: fractions',
  description: 'Compare equal parts of a whole.',
  body: [
    'One half and two quarters represent the same part of a whole.',
    'Multiply the numerator and denominator by the same non-zero number to make an equivalent fraction.',
  ],
  sourceUrl: 'https://nacca.gov.gh/',
  sourceTitle: 'NaCCA curriculum',
  questions: [
    {
      id: 'q1',
      prompt: 'Which fraction is equivalent to one half?',
      options: ['2/4', '1/4', '3/4'],
    },
    {
      id: 'q2',
      prompt: 'Which fraction is equivalent to two thirds?',
      options: ['2/6', '4/6', '3/4'],
    },
  ],
};
async function setup(page: Page, role: Role) {
  const state = seed();
  state.students = state.students.slice(0, 2).map((s, i) => ({
    ...s,
    id: `hub-student-${i}`,
    name: `Hub learner ${i + 1}`,
    classId: 'JHS 1',
  }));
  state.classes = ['JHS 1'];
  const owner = {
    ...state.users.find((u) => u.role === role)!,
    classes: role === 'Teacher' ? ['JHS 1'] : [],
    studentId: role === 'Student' ? state.students[0].id : undefined,
  };
  state.users = [owner];
  const hub: HubSnapshot = { lessons: [lesson], assignments: [], attempts: [], readings: [] };
  const requests: Record<string, any>[] = [];
  if (role === 'Student')
    hub.assignments.push({
      id: 'hub-assignment',
      lessonId: lesson.id,
      classId: 'JHS 1',
      studentIds: [state.students[0].id],
      dueDate: '2026-12-20',
      createdBy: 'teacher',
      createdAt: '2026-10-28T10:00:00Z',
    });
  await page.routeWebSocket('**', (socket) => socket.close());
  await page.addInitScript((user) => {
    localStorage.setItem(
      'sb-itqfnzqksuacbeemrqok-auth-token',
      JSON.stringify({
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        user: { id: user.id, email: user.email, aud: 'authenticated', role: 'authenticated' },
      }),
    );
  }, owner);
  await page.route('https://*.supabase.co/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/functions/v1/workspace'))
      return route.fulfill({ json: { state, revision: 1 } });
    if (!url.includes('/functions/v1/learning-hub')) return route.fulfill({ json: {} });
    const body = route.request().postDataJSON();
    requests.push(body);
    if (body.action === 'load') return route.fulfill({ json: hub });
    if (body.action === 'assign') {
      const assignment = {
        id: `assignment-${hub.assignments.length}`,
        ...body,
        studentIds: body.studentIds || state.students.map((s) => s.id),
        createdBy: owner.id,
        createdAt: new Date().toISOString(),
      };
      hub.assignments.push(assignment);
      return route.fulfill({ json: assignment });
    }
    if (body.action === 'complete-reading') {
      const reading = {
        id: 'reading-1',
        lessonId: body.lessonId,
        assignmentId: body.assignmentId || null,
        studentId: owner.studentId!,
        createdAt: new Date().toISOString(),
      };
      hub.readings.push(reading);
      return route.fulfill({ json: reading });
    }
    if (body.action === 'submit-practice') {
      const correct = body.answers.filter(
        (answer: number, i: number) => answer === [0, 1][i],
      ).length;
      const attempt = {
        id: `attempt-${hub.attempts.length}`,
        lessonId: body.lessonId,
        assignmentId: body.assignmentId || null,
        studentId: owner.studentId!,
        score: correct * 50,
        correct,
        total: 2,
        createdAt: new Date().toISOString(),
      };
      hub.attempts.push(attempt);
      return route.fulfill({
        json: {
          attempt,
          feedback: lesson.questions.map((q, i) => ({
            questionId: q.id,
            correct: body.answers[i] === [0, 1][i],
            answer: [0, 1][i],
            explanation: 'Multiply both parts by the same number.',
          })),
        },
      });
    }
    if (body.action === 'create-lesson') {
      const custom = { ...body.lesson, id: 'custom-lesson' };
      hub.lessons.push(custom);
      return route.fulfill({ json: custom });
    }
    return route.fulfill({ status: 400, json: { error: 'Unexpected test action' } });
  });
  await page.goto('/#/learning-hub');
  return { state, hub, requests };
}

test('Learning Hub learner completes assigned reading and scored practice across reloads', async ({
  page,
}) => {
  const { hub, requests } = await setup(page, 'Student');
  await expect(page.getByRole('heading', { name: 'Learning Hub', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'My assignments', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText(lesson.body[0], { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mark as read', exact: true }).click();
  await expect.poll(() => hub.readings.length).toBe(1);
  expect(hub.readings[0].assignmentId).toBe('hub-assignment');
  await page.getByRole('button', { name: 'Start practice', exact: true }).click();
  await page.getByLabel(/2\/4/).check();
  await page.getByLabel(/2\/6/).check();
  await page.getByRole('button', { name: 'Submit answers', exact: true }).click();
  await expect.poll(() => hub.attempts.length).toBe(1);
  expect(hub.attempts[0].score).toBe(50);
  expect(requests.find((r) => r.action === 'submit-practice')).toMatchObject({
    answers: [0, 0],
    assignmentId: 'hub-assignment',
  });
  expect(requests.find((r) => r.action === 'submit-practice')).not.toHaveProperty('score');
  await expect(page.getByText(/1 of 2 correct · 50%/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Reading saved', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'My assignments', exact: true }).click();
  await expect(page.getByText('Completed', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Progress', exact: true }).click();
  await expect(page.getByText('50%', { exact: true }).first()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/learning-hub-mobile.png' });
});

test('Learning Hub teacher assigns classes and individual learners with honest progress', async ({
  page,
}) => {
  const { hub, requests } = await setup(page, 'Teacher');
  await expect(page.getByRole('heading', { name: 'Learning Hub', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Understanding equivalent fractions/ }).click();
  await page.getByRole('button', { name: 'Assign lesson', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Assign lesson' });
  await dialog.getByLabel('Class', { exact: true }).selectOption('JHS 1');
  await dialog.getByLabel('Due date', { exact: true }).fill('2026-12-20');
  await dialog.getByRole('button', { name: 'Assign', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(hub.assignments).toHaveLength(1);
  expect(requests.find((r) => r.action === 'assign')).toMatchObject({
    lessonId: lesson.id,
    classId: 'JHS 1',
    dueDate: '2026-12-20',
  });
  expect(hub.assignments[0].studentIds).toHaveLength(2);
  await page.getByRole('button', { name: 'Assign lesson', exact: true }).click();
  await dialog.getByLabel('Assign to', { exact: true }).selectOption('students');
  await dialog.getByLabel('Hub learner 2', { exact: true }).check();
  await dialog.getByLabel('Due date', { exact: true }).fill('2026-12-21');
  await dialog.getByRole('button', { name: 'Assign', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(hub.assignments[1].studentIds).toEqual(['hub-student-1']);
  await page.getByRole('button', { name: 'Progress', exact: true }).click();
  await expect(page.getByText('No attempts yet', { exact: true })).toBeVisible();
  await expect(page.getByText('Not started', { exact: true }).first()).toBeVisible();
  await page.getByLabel('Progress student', { exact: true }).selectOption('hub-student-1');
  await expect(page.locator('.lh-progress-table tbody tr')).toHaveCount(1);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'test-results/learning-hub-teacher-progress.png' });
});

test('Learning Hub teacher authors a curriculum lesson and exercise', async ({ page }) => {
  const { hub, requests } = await setup(page, 'Teacher');
  await page.getByRole('button', { name: 'Create lesson', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create lesson' });
  await dialog.getByLabel('Lesson title', { exact: true }).fill('Measuring a school garden');
  await dialog.getByLabel('Subject', { exact: true }).selectOption('Mathematics');
  await dialog.getByLabel('Level', { exact: true }).selectOption('B7');
  await dialog.getByLabel('Curriculum strand', { exact: true }).fill('Geometry and measurement');
  await dialog
    .getByLabel('Content standard / indicator', { exact: true })
    .fill('Measure the area of a rectangle');
  await dialog
    .getByLabel('Lesson summary', { exact: true })
    .fill('Find the area of a rectangular garden.');
  await dialog
    .getByLabel('Lesson content', { exact: true })
    .fill(
      'Area equals length multiplied by width.\n\nA garden 4 m long and 3 m wide has area 12 square metres.',
    );
  await dialog.getByLabel('Curriculum source URL', { exact: true }).fill('https://nacca.gov.gh/');
  await dialog.getByRole('button', { name: 'Add question', exact: true }).click();
  await dialog
    .getByLabel('Question 1 prompt', { exact: true })
    .fill('What is the area of a 4 m by 3 m rectangle?');
  for (const [letter, answer] of [
    ['A', '7 square metres'],
    ['B', '12 square metres'],
    ['C', '14 square metres'],
    ['D', '24 square metres'],
  ]) {
    await dialog.getByLabel(`Question 1 option ${letter}`, { exact: true }).fill(answer);
  }
  await dialog.getByLabel('Question 1 correct answer', { exact: true }).selectOption('1');
  await dialog
    .getByLabel('Question 1 explanation', { exact: true })
    .fill('Multiply 4 by 3 to get 12 square metres.');
  await dialog.getByRole('button', { name: 'Create lesson', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(hub.lessons).toHaveLength(2);
  const request = requests.find((r) => r.action === 'create-lesson');
  expect(request?.lesson.body).toHaveLength(2);
  expect(request?.lesson.questions[0].answer).toBe(1);
  await page.getByRole('button', { name: /Measuring a school garden/ }).click();
  await expect(
    page.getByText('A garden 4 m long and 3 m wide has area 12 square metres.', { exact: true }),
  ).toBeVisible();
});

test('Learning Hub preserves answers and reports a failed save without claiming completion', async ({
  page,
}) => {
  const { hub } = await setup(page, 'Student');
  let fail = true;
  await page.route('**/functions/v1/learning-hub', async (route) => {
    if (route.request().postDataJSON()?.action === 'submit-practice' && fail) {
      return route.fulfill({
        status: 503,
        json: { error: 'Practice could not be saved. Please retry.' },
      });
    }
    return route.fallback();
  });
  await page.getByRole('button', { name: 'My assignments', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Start practice', exact: true }).click();
  await page.getByLabel(/2\/4/).check();
  await page.getByLabel(/4\/6/).check();
  await page.getByRole('button', { name: 'Submit answers', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Practice could not be saved. Please retry.');
  expect(hub.attempts).toHaveLength(0);
  await expect(page.getByLabel(/2\/4/)).toBeChecked();
  await expect(page.getByLabel(/4\/6/)).toBeChecked();
  fail = false;
  await page.getByRole('button', { name: 'Submit answers', exact: true }).click();
  await expect(page.getByText('2 of 2 correct · 100%', { exact: true })).toBeVisible();
  expect(hub.attempts).toHaveLength(1);
});

test('Learning Hub recommends practice from latest results and targets the selected learner', async ({
  page,
}) => {
  const { hub } = await setup(page, 'Teacher');
  hub.attempts.push(
    {
      id: 'older-attempt',
      lessonId: lesson.id,
      assignmentId: null,
      studentId: 'hub-student-1',
      score: 100,
      correct: 2,
      total: 2,
      createdAt: '2026-10-27T10:00:00Z',
    },
    {
      id: 'latest-attempt',
      lessonId: lesson.id,
      assignmentId: null,
      studentId: 'hub-student-1',
      score: 50,
      correct: 1,
      total: 2,
      createdAt: '2026-10-28T10:00:00Z',
    },
  );
  await page.getByRole('button', { name: 'Refresh learning progress', exact: true }).click();
  await page.getByRole('button', { name: 'Progress', exact: true }).click();
  await expect(page.getByText('75%', { exact: true })).toBeVisible();
  const row = page.locator('.lh-progress-table tbody tr');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Hub learner 2');
  await expect(row).toContainText('Developing');
  await expect(row).toContainText('50%');
  await expect(row).toContainText('Review the feedback on missed questions');
  await row.getByRole('button', { name: 'Assign practice', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Assign lesson' });
  await expect(dialog.getByLabel('Class', { exact: true })).toHaveValue('JHS 1');
  await expect(dialog.getByLabel('Assign to', { exact: true })).toHaveValue('students');
  await expect(dialog.getByLabel('Hub learner 2', { exact: true })).toBeChecked();
  await expect(dialog.getByLabel('Hub learner 1', { exact: true })).not.toBeChecked();
  await dialog.getByLabel('Due date', { exact: true }).fill('2026-12-22');
  await dialog.getByRole('button', { name: 'Assign', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(hub.assignments[0].studentIds).toEqual(['hub-student-1']);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'test-results/learning-hub-populated-progress.png' });
});
