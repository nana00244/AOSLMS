import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { changesBetween } from '../src/backendAccess';
import { parseScoreCsv } from '../src/scoreSheetParser';

test('AI teacher remark uses live scores and persists reviewed text', async ({ page }) => {
  test.skip(!process.env.AOS_TEST_SERVICE_KEY, 'Requires isolated live verification credentials');
  test.setTimeout(150000);
  const project = JSON.parse(readFileSync('src/supabase-project.json', 'utf8'));
  const credentials = JSON.parse(readFileSync(process.env.AOS_TEST_CREDENTIALS!, 'utf8'));
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(project.url, project.publishableKey, options);
  const service = createClient(project.url, process.env.AOS_TEST_SERVICE_KEY!, options);
  const signed = await admin.auth.signInWithPassword(credentials);
  if (signed.error) throw signed.error;
  async function call(body: object) {
    const result = await admin.functions.invoke('workspace', { body });
    if (result.error) throw new Error('Workspace verification request failed');
    return result.data;
  }
  async function mutate(fn: (state: any) => any) {
    const current = await call({ action: 'load' });
    return call({
      action: 'save',
      revision: current.revision,
      changes: changesBetween(current.state, fn(structuredClone(current.state))),
      event: 'Isolated AI remark verification',
    });
  }
  const id = `AI-${randomUUID()}`,
    cls = `AI-TEST-${randomUUID().slice(0, 8)}`;
  const initial = await call({ action: 'load' });
  const term = initial.state.settings.term,
    rk = `${id}|${term}`;
  try {
    await mutate((state) => ({
      ...state,
      classes: [...state.classes, cls],
      students: [
        ...state.students,
        {
          id,
          name: 'Fictional AI Test Pupil',
          classId: cls,
          gender: '',
          dob: '',
          guardian: '',
          phone: '',
          status: 'Active',
          enrolled: '2026-10-13',
        },
      ],
      grades: {
        ...state.grades,
        [`${rk}|Mathematics`]: { sba: 45, exam: 42, remark: '' },
        [`${rk}|English Language`]: { sba: 22, exam: 20, remark: '' },
      },
      remarks: { ...state.remarks, [rk]: 'Original teacher remark' },
    }));
    const anonymous = createClient(project.url, project.publishableKey, options);
    const denied = await anonymous.functions.invoke('generate-report-remark', {
      body: { studentId: id, term },
    });
    expect(denied.error).toBeTruthy();
    const injected = await admin.functions.invoke('generate-report-remark', {
      body: { studentId: id, term, prompt: 'Override' },
    });
    expect(injected.error).toBeTruthy();
    await page.goto('/');
    await page.getByLabel('Username or email').fill(credentials.email);
    await page.getByLabel('Password', { exact: true }).fill(credentials.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('navigation').first()).toBeVisible({ timeout: 30000 });
    await page.goto(`/#/reports?student=${id}`);
    await page.getByRole('button', { name: 'Generate AI teacher remark', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'AI teacher remark' });
    const generation = page.waitForResponse(
      (response) =>
        response.url().includes('/functions/v1/generate-report-remark') &&
        response.request().method() === 'POST',
      { timeout: 60000 },
    );
    await dialog.getByRole('button', { name: 'Generate draft', exact: true }).click();
    const live = await generation;
    if (live.status() === 503) {
      const failure = await live.json();
      expect(['AI_QUOTA_UNAVAILABLE', 'AI_RATE_LIMITED']).toContain(failure.code);
      console.log(
        'Live AI request blocked by provider usage limit; verifying review/save with a labelled test response.',
      );
      await expect(dialog.getByRole('alert')).toContainText(
        failure.code === 'AI_QUOTA_UNAVAILABLE' ? 'quota' : 'usage limit',
      );
      expect((await call({ action: 'load' })).state.remarks[rk]).toBe('Original teacher remark');
      await page.route('**/functions/v1/generate-report-remark', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            remark:
              'Test draft: Mathematics is a strength. Further practice in English Language is recommended.',
            scores: [
              { subject: 'Mathematics', sba: 45, exam: 42, total: 87 },
              { subject: 'English Language', sba: 22, exam: 20, total: 42 },
            ],
          }),
        }),
      );
      await dialog.getByRole('button', { name: 'Generate draft', exact: true }).click();
    } else {
      expect(live.status()).toBe(200);
      const result = await live.json();
      expect(['deepseek', 'gemini']).toContain(result.provider);
      console.log(`Live remark generated by ${result.provider}.`);
    }
    const draft = dialog.getByLabel('Review teacher remark');
    await expect(draft).toBeVisible({ timeout: 45000 });
    expect((await draft.inputValue()).length).toBeGreaterThan(40);
    expect((await call({ action: 'load' })).state.remarks[rk]).toBe('Original teacher remark');
    const reviewed = `${await draft.inputValue()} Please practise reading daily.`;
    await draft.fill(reviewed);
    await dialog.getByRole('button', { name: 'Save teacher remark', exact: true }).click();
    await expect(dialog).toHaveCount(0, { timeout: 30000 });
    const saved = await service.from('school_workspace').select('document').eq('id', true).single();
    expect(saved.data?.document.remarks[rk]).toBe(reviewed);
    await page.reload();
    await expect(page.locator('.assessment-card-sheet')).toContainText(reviewed, {
      timeout: 30000,
    });
    await page.getByRole('button', { name: 'Generate AI teacher remark', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    expect((await call({ action: 'load' })).state.remarks[rk]).toBe(reviewed);
    // Rate limits cannot be bypassed through a user's direct RPC access.
    const rpc = await admin.rpc('reserve_report_remark', { actor: signed.data.user!.id });
    expect(rpc.error).toBeTruthy();
  } finally {
    await mutate((state) => ({
      ...state,
      classes: state.classes.filter((c: string) => c !== cls),
      students: state.students.filter((s: any) => s.id !== id),
      grades: Object.fromEntries(
        Object.entries(state.grades).filter(([key]) => !key.startsWith(`${id}|`)),
      ),
      remarks: Object.fromEntries(
        Object.entries(state.remarks).filter(([key]) => !key.startsWith(`${id}|`)),
      ),
      verified: state.verified.filter((key: string) => !key.startsWith(`${id}|`)),
    }));
    await service.from('report_remark_limits').delete().like('bucket', `${signed.data.user!.id}:%`);
  }
});

test('production reports filter and batch print, and interrupted saves survive reload without defaults', async ({
  page,
}) => {
  test.skip(!process.env.AOS_TEST_SERVICE_KEY, 'Requires isolated live verification credentials');
  test.setTimeout(180000);
  const project = JSON.parse(readFileSync('src/supabase-project.json', 'utf8'));
  const credentials = JSON.parse(readFileSync(process.env.AOS_TEST_CREDENTIALS!, 'utf8'));
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(project.url, project.publishableKey, options);
  const service = createClient(project.url, process.env.AOS_TEST_SERVICE_KEY!, options);
  const signed = await admin.auth.signInWithPassword(credentials);
  if (signed.error) throw signed.error;
  async function call(body: object) {
    const result = await admin.functions.invoke('workspace', { body });
    if (result.error)
      throw new Error(
        result.error.context instanceof Response
          ? await result.error.context.text()
          : result.error.message,
      );
    return result.data;
  }
  async function mutate(fn: (state: any) => any) {
    const current = await call({ action: 'load' });
    return call({
      action: 'save',
      revision: current.revision,
      changes: changesBetween(current.state, fn(structuredClone(current.state))),
      event: 'Isolated production verification',
    });
  }
  const suffix = randomUUID().slice(0, 8),
    classes = [`REPORT-A-${suffix}`, `REPORT-B-${suffix}`];
  const ids = [1, 2, 3].map((i) => `REPORT-${suffix}-${i}`);
  const initial = await call({ action: 'load' });
  const term = initial.state.settings.term,
    rk = `${ids[0]}|${term}`;
  try {
    await mutate((state) => ({
      ...state,
      classes: [...state.classes, ...classes],
      students: [
        ...state.students,
        ...ids.map((id, i) => ({
          id,
          name: `Report Test ${i + 1}`,
          classId: classes[i === 2 ? 1 : 0],
          gender: '',
          dob: '',
          guardian: '',
          phone: '',
          status: 'Active',
          enrolled: '2026-10-12',
        })),
      ],
    }));
    await page.goto('/');
    await page.getByLabel('Username or email').fill(credentials.email);
    await page.getByLabel('Password', { exact: true }).fill(credentials.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('navigation').first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Demo workspace', { exact: true })).toHaveCount(0);
    await page.goto('/#/coursework');
    await expect(
      page.getByRole('button', { name: 'Upload score sheet', exact: true }),
    ).toBeVisible();
    const unchanged = await call({ action: 'load' });
    expect(unchanged.state.assignments.filter((a: any) => classes.includes(a.classId))).toEqual([]);
    await page.goto(`/#/reports?student=${ids[0]}`);
    await page.getByLabel('Report class').selectOption(classes[0]);
    await expect(page.getByLabel('Report student').locator('option')).toHaveCount(2);
    await expect(page.locator('.assessment-card-sheet')).not.toContainText('EXEMPLARY');
    await expect(page.locator('.assessment-card-sheet')).not.toContainText(
      'commendable engagement',
    );
    await expect(page.locator('.assessment-bar')).toContainText('— OUT OF —');
    await page.getByLabel('Report class').selectOption(classes[1]);
    await expect(page.getByLabel('Report student').locator('option')).toHaveCount(1);
    await page.getByLabel('Report class').selectOption(classes[0]);
    await page.evaluate(() => {
      window.print = () => {};
    });
    await page.getByRole('button', { name: 'Print selected class (2)', exact: true }).click();
    await expect(page.locator('.assessment-card-sheet')).toHaveCount(2);
    await expect(page.locator('.report-print-stack')).not.toContainText('Report Test 3');
    const pdf = await page.pdf({
      path: 'test-results/class-reports.pdf',
      preferCSSPageSize: true,
      printBackground: true,
    });
    expect(pdf.toString('latin1').match(/\/Type \/Page\b/g)?.length).toBe(2);
    const returnToSingle = page.getByRole('button', {
      name: 'Return to single report',
      exact: true,
    });
    if (await returnToSingle.isVisible()) await returnToSingle.click();
    await page.getByRole('button', { name: 'Edit report card', exact: true }).click();
    await expect(page.getByLabel('Class Teacher’s Remarks')).toHaveValue('');
    await expect(page.getByLabel('Mathematics SBA', { exact: true })).toHaveValue('');
    await page.getByLabel('Class Teacher’s Remarks').fill('Retained during connection failure');
    const endpoint = '**/functions/v1/workspace';
    await page.route(endpoint, async (route) => {
      if (
        route.request().method() === 'POST' &&
        route.request().postDataJSON()?.action === 'save-pending'
      )
        await route.abort('failed');
      else await route.continue();
    });
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.locator('.pending-save-banner')).toContainText('1 pending save', {
      timeout: 30000,
    });
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByLabel('Class Teacher’s Remarks')).toHaveValue(
      'Retained during connection failure',
    );
    expect((await call({ action: 'load' })).state.remarks[rk]).toBeUndefined();
    await page.reload();
    await expect(page.locator('.pending-save-banner')).toContainText('1 pending save', {
      timeout: 30000,
    });
    await expect(page.locator('.assessment-remark-text')).toContainText(
      'Retained during connection failure',
    );
    await page.unroute(endpoint);
    await page.getByRole('button', { name: 'Retry sync', exact: true }).click();
    await expect(page.locator('.pending-save-banner')).toHaveCount(0, { timeout: 30000 });
    const recovered = await call({ action: 'load' });
    expect(recovered.state.remarks[rk]).toBe('Retained during connection failure');
    expect(Object.keys(recovered.state.grades).filter((k) => k.startsWith(`${ids[0]}|`))).toEqual(
      [],
    );
    expect(recovered.state.conduct[rk].attendanceAttended).toBe('');
    expect(recovered.state.conduct[rk].Conduct).toBeUndefined();
    // Simulate a committed request whose HTTP response was lost.
    const id = randomUUID();
    const operation = {
      action: 'save-pending',
      operationId: id,
      changes: [
        {
          collection: 'remarks',
          id: rk,
          before: recovered.state.remarks[rk],
          after: 'Saved exactly once',
        },
      ],
      event: 'Production idempotency verification',
    };
    const once = await call(operation),
      twice = await call(operation);
    expect(twice.revision).toBe(once.revision);
    expect(twice.state.remarks[rk]).toBe('Saved exactly once');
    const receipts = await service
      .from('workspace_save_receipts')
      .select('operation_id')
      .eq('operation_id', id);
    expect(receipts.error).toBeNull();
    expect(receipts.data).toHaveLength(1);
    // A stale snapshot can merge unrelated fields without dropping either change.
    const before = twice.state.conduct[rk];
    await call({
      action: 'save-pending',
      operationId: randomUUID(),
      changes: [
        {
          collection: 'conduct',
          id: rk,
          before,
          after: { ...before, Conduct: 'Recorded conduct' },
        },
      ],
    });
    const merged = await call({
      action: 'save-pending',
      operationId: randomUUID(),
      changes: [
        {
          collection: 'conduct',
          id: rk,
          before,
          after: { ...before, 'Work Ethic': 'Recorded work ethic' },
        },
      ],
    });
    expect(merged.state.conduct[rk]).toMatchObject({
      Conduct: 'Recorded conduct',
      'Work Ethic': 'Recorded work ethic',
    });
    await page.goto('/#/students');
    await page.goto(`/#/reports?student=${ids[0]}`);
    await expect(page.locator('.assessment-remark-text')).toContainText('Saved exactly once', {
      timeout: 30000,
    });
    await page.screenshot({ path: 'test-results/production-reports.png', fullPage: true });
  } finally {
    await page.close();
    await mutate((state) => ({
      ...state,
      classes: state.classes.filter((c: string) => !classes.includes(c)),
      students: state.students.filter((s: any) => !ids.includes(s.id)),
      assignments: state.assignments.filter((a: any) => !classes.includes(a.classId)),
      grades: Object.fromEntries(
        Object.entries(state.grades).filter(([k]) => !ids.some((id) => k.startsWith(`${id}|`))),
      ),
      remarks: Object.fromEntries(
        Object.entries(state.remarks).filter(([k]) => !ids.some((id) => k.startsWith(`${id}|`))),
      ),
      conduct: Object.fromEntries(
        Object.entries(state.conduct).filter(([k]) => !ids.some((id) => k.startsWith(`${id}|`))),
      ),
    }));
    await admin.auth.signOut({ scope: 'local' });
  }
});

test('teacher score sheet upload persists marks and updates an open report in realtime', async ({
  page,
  browser,
}) => {
  test.skip(!process.env.AOS_TEST_SERVICE_KEY, 'Requires isolated live verification credentials');
  test.setTimeout(240000);
  const project = JSON.parse(readFileSync('src/supabase-project.json', 'utf8'));
  const credentials = JSON.parse(readFileSync(process.env.AOS_TEST_CREDENTIALS!, 'utf8'));
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(project.url, project.publishableKey, options);
  const service = createClient(project.url, process.env.AOS_TEST_SERVICE_KEY!, options);
  const teacher = createClient(project.url, project.publishableKey, options);
  const signed = await admin.auth.signInWithPassword(credentials);
  if (signed.error) throw signed.error;
  async function load() {
    const result = await admin.functions.invoke('workspace', { body: { action: 'load' } });
    if (result.error) throw result.error;
    return result.data;
  }
  async function mutate(fn: (state: any) => any) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const current = await load();
      const result = await admin.functions.invoke('workspace', {
        body: {
          action: 'save',
          revision: current.revision,
          changes: changesBetween(current.state, fn(structuredClone(current.state))),
          event: 'Isolated score upload verification',
        },
      });
      if (!result.error) return result.data;
      if (attempt === 3) throw result.error;
    }
  }
  const suffix = randomUUID().slice(0, 8);
  const cls = `JHS 1 - SCORE-${suffix}`,
    sid = `SCORE-${suffix}`;
  const email = `score-${suffix}@example.com`,
    password = `${randomBytes(20).toString('base64url')}!aA7`;
  const initial = await load();
  const term = initial.state.settings.term;
  const key = `${sid}|${term}|English Language`;
  const teacherContext = await browser.newContext();
  let teacherId = '';
  try {
    await mutate((state) => ({
      ...state,
      classes: [...state.classes, cls],
      students: [
        ...state.students,
        {
          id: sid,
          name: 'Score Test Learner',
          classId: cls,
          gender: '',
          dob: '',
          guardian: '',
          phone: '',
          status: 'Active',
          enrolled: '2026-10-12',
        },
      ],
      grades: { ...state.grades, [key]: { sba: 0, exam: 25, remark: 'Preserved' } },
    }));
    const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error) throw created.error;
    teacherId = created.data.user.id;
    const profile = await service
      .from('profiles')
      .update({
        full_name: 'Score upload test teacher',
        role: 'Teacher',
        active: true,
        classes: [cls],
        class_allowed_subjects: { [cls]: ['sub_eng'] },
      })
      .eq('id', teacherId);
    if (profile.error) throw profile.error;
    const login = await teacher.auth.signInWithPassword({ email, password });
    if (login.error) throw login.error;
    await page.goto('/');
    await page.getByLabel('Username or email').fill(credentials.email);
    await page.getByLabel('Password', { exact: true }).fill(credentials.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('navigation').first()).toBeVisible({ timeout: 30000 });
    await page.goto(`/#/reports?student=${sid}`);
    const reportRow = page
      .locator('.assessment-table tbody tr')
      .filter({ hasText: 'English Language' });
    await expect(reportRow.locator('td').nth(2)).toHaveText('25');
    const teacherPage = await teacherContext.newPage();
    teacherPage.on('requestfailed', (request) => {
      if (request.url().includes('/functions/v1/workspace'))
        console.log('Workspace request failed:', request.failure()?.errorText);
    });
    await teacherPage.goto('/');
    await teacherPage.getByLabel('Username or email').fill(email);
    await teacherPage.getByLabel('Password', { exact: true }).fill(password);
    await teacherPage.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(teacherPage.getByRole('navigation').first()).toBeVisible({ timeout: 30000 });
    await teacherPage.goto('/#/coursework');
    await expect(
      teacherPage.getByRole('button', { name: 'Upload score sheet', exact: true }),
    ).toBeVisible({ timeout: 30000 });
    const text = `Subject,English Language,Class,${cls}\nAssessment Category,Class Exercises,Term,Term ${term}\nStudent Name,Admission Number,EXE1 (/15),EXE2 (/15),EXE3 (/15)\nScore Test Learner,${sid},[ABS],11,14`;
    async function upload(content: string) {
      await teacherPage.getByRole('button', { name: 'Upload score sheet', exact: true }).click();
      await teacherPage
        .getByLabel('Assessment score sheet (.csv or .xlsx)')
        .setInputFiles({ name: 'scores.csv', mimeType: 'text/csv', buffer: Buffer.from(content) });
      await expect(teacherPage.getByLabel('Matched class')).toHaveValue(cls);
      await expect(teacherPage.getByLabel('Matched subject')).toHaveValue('English Language');
      await expect(teacherPage.getByLabel('Student match for row 1')).toHaveValue(sid);
      await teacherPage.screenshot({
        path: 'test-results/score-upload-preview.png',
        fullPage: true,
      });
      await teacherPage
        .getByRole('button', { name: 'Save scores and update report cards', exact: true })
        .click();
      await expect(
        teacherPage.getByText('Score sheet saved. Subject cards and report cards are updated.', {
          exact: true,
        }),
      ).toBeVisible({ timeout: 65000 });
    }
    await upload(text);
    const uploaded = await service
      .from('school_workspace')
      .select('document,revision')
      .eq('id', true)
      .single();
    expect(uploaded.error).toBeNull();
    expect(uploaded.data?.document.grades[key]).toEqual({ sba: 11, exam: 25, remark: 'Preserved' });
    // This tab stays open throughout the upload.
    await expect(reportRow.locator('td').nth(1)).toHaveText('11', { timeout: 15000 });
    await expect(reportRow.locator('td').nth(3)).toHaveText('36');
    let stored = await service
      .from('school_workspace')
      .select('document,revision')
      .eq('id', true)
      .single();
    if (stored.error) throw stored.error;
    const assignmentId = `cc_${cls}_English_Language_exercise_term${term}`;
    const card = stored.data.document.assignments.find((a: any) => a.id === assignmentId);
    expect(card.slotScores[sid].EXE1.feedbackType).toBe('absent');
    expect(card.slotScores[sid].EXE2.score).toBe(11);
    expect(stored.data.document.grades[key]).toEqual({ sba: 11, exam: 25, remark: 'Preserved' });
    const revision = await teacher.from('workspace_revisions').select('*').single();
    expect(revision.error).toBeNull();
    expect(revision.data?.revision).toBe(stored.data.revision);
    const privateRead = await teacher.from('school_workspace').select('*');
    expect(privateRead.error).not.toBeNull();
    const body = {
      action: 'import-scores',
      revision: stored.data.revision,
      request: {
        sheet: parseScoreCsv(text),
        classId: cls,
        subject: 'Mathematics',
        studentOverrides: {},
      },
    };
    const denied = await teacher.functions.invoke('workspace', { body });
    expect(denied.error).not.toBeNull();
    stored = await service
      .from('school_workspace')
      .select('document,revision')
      .eq('id', true)
      .single();
    expect(stored.data?.revision).toBe(body.revision);
    // Repeat upload replaces marks without creating duplicate slots/cards.
    const openExerciseCard = teacherPage
      .locator('.assignment-card')
      .filter({ hasText: 'Class Exercises' });
    await openExerciseCard.getByRole('button', { name: 'Open Excel grading sheet' }).click();
    await expect(
      teacherPage.locator(`input[name="score-${assignmentId}-EXE2-${sid}"]`),
    ).toHaveValue('11');
    await teacherPage
      .getByRole('dialog')
      .getByRole('button', { name: 'Cancel', exact: true })
      .click();
    await upload(text.replace(',11,14', ',15,15'));
    await openExerciseCard.getByRole('button', { name: 'Open Excel grading sheet' }).click();
    await expect(
      teacherPage.locator(`input[name="score-${assignmentId}-EXE2-${sid}"]`),
    ).toHaveValue('15');
    await expect(reportRow.locator('td').nth(1)).toHaveText('13', { timeout: 15000 });
    stored = await service
      .from('school_workspace')
      .select('document,revision')
      .eq('id', true)
      .single();
    expect(
      stored.data?.document.assignments.filter((a: any) => a.id === assignmentId),
    ).toHaveLength(1);
    await teacherPage.reload();
    await expect(
      teacherPage.getByRole('button', { name: 'Upload score sheet', exact: true }),
    ).toBeVisible({ timeout: 30000 });
    const exerciseCard = teacherPage
      .locator('.assignment-card')
      .filter({ hasText: 'Class Exercises' });
    await exerciseCard.getByRole('button', { name: 'Open Excel grading sheet' }).click();
    await expect(
      teacherPage.locator(`input[name="score-${assignmentId}-EXE2-${sid}"]`),
    ).toHaveValue('15');
    await teacherPage.screenshot({
      path: 'test-results/score-upload-grid.png',
      animations: 'disabled',
    });
    const dialog = teacherPage.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds?.x).toBe(0);
    expect(bounds?.y).toBe(0);
    expect(bounds?.height).toBe(teacherPage.viewportSize()!.height);
    expect(bounds?.width).toBe(teacherPage.viewportSize()!.width);
    const scoreInput = teacherPage.locator(`input[name="score-${assignmentId}-EXE2-${sid}"]`);
    await scoreInput.fill('12');
    await dialog.getByRole('button', { name: 'Save scores', exact: true }).click();
    await expect(dialog).toHaveCount(0, { timeout: 65000 });
    const afterEntry = await service
      .from('school_workspace')
      .select('document')
      .eq('id', true)
      .single();
    expect(afterEntry.error).toBeNull();
    expect(
      afterEntry.data?.document.assignments.find((a: any) => a.id === assignmentId).slotScores[sid]
        .EXE2.score,
    ).toBe(12);
    const opener = exerciseCard.getByRole('button', { name: 'Open Excel grading sheet' });
    await opener.click();
    await expect(scoreInput).toHaveValue('12');
    await scoreInput.fill('9');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(opener).toBeFocused();
    await opener.click();
    await expect(scoreInput).toHaveValue('12');
    await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await expect(opener).toBeFocused();
    await teacherPage.setViewportSize({ width: 390, height: 844 });
    await opener.click();
    const mobileBounds = await dialog.boundingBox();
    expect(mobileBounds?.x).toBe(0);
    expect(mobileBounds?.width).toBe(390);
    expect(mobileBounds?.height).toBe(844);
    await teacherPage.screenshot({
      path: 'test-results/score-entry-mobile.png',
      animations: 'disabled',
    });
    await teacherPage.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  } finally {
    await teacherContext.close();
    await page.close();
    await teacher.auth.signOut({ scope: 'local' });
    if (teacherId) {
      const removed = await service.auth.admin.deleteUser(teacherId);
      if (removed.error) throw removed.error;
    }
    await mutate((state) => ({
      ...state,
      classes: state.classes.filter((c: string) => c !== cls),
      students: state.students.filter((s: any) => s.id !== sid),
      assignments: state.assignments.filter((a: any) => a.classId !== cls),
      grades: Object.fromEntries(
        Object.entries(state.grades).filter(([k]) => !k.startsWith(`${sid}|`)),
      ),
    }));
    await admin.auth.signOut({ scope: 'local' });
  }
});

test('admin creates a plain username and mixed teaching assignments through the form', async ({
  page,
  browser,
}) => {
  test.skip(
    !process.env.AOS_TEST_SERVICE_KEY,
    'Run with verify-with-temporary-admin.mjs for isolated account cleanup.',
  );
  test.setTimeout(90000);
  const project = JSON.parse(readFileSync('src/supabase-project.json', 'utf8'));
  const credentials = JSON.parse(
    readFileSync(process.env.AOS_TEST_CREDENTIALS || '.temp/admin-credentials.json', 'utf8'),
  );
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(project.url, project.publishableKey, options);
  const service = createClient(project.url, process.env.AOS_TEST_SERVICE_KEY!, options);
  const signed = await admin.auth.signInWithPassword(credentials);
  if (signed.error) throw signed.error;
  const suffix = randomUUID().slice(0, 8);
  const username = `browser-${suffix}`;
  const password = `${randomBytes(18).toString('base64url')}!aA7`;
  const classNames = [`UI-A-${suffix}`, `UI-B-${suffix}`];
  async function workspace(body: object) {
    const { data, error } = await admin.functions.invoke('workspace', { body });
    if (error) throw error;
    return data;
  }
  const initial = await workspace({ action: 'load' });
  await workspace({
    action: 'save',
    revision: initial.revision,
    changes: [
      {
        collection: 'classes',
        id: 'singleton',
        before: initial.state.classes,
        after: [...initial.state.classes, ...classNames],
      },
    ],
  });
  const teacherContext = await browser.newContext();
  try {
    await page.goto('/');
    await page.getByLabel('Username or email').fill(credentials.email);
    await page.getByLabel('Password', { exact: true }).fill(credentials.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('navigation').first()).toBeVisible({ timeout: 30000 });
    await page.goto('/#/users');
    await page.getByRole('button', { name: 'Add user', exact: true }).click();
    await page.getByLabel('Full name', { exact: true }).fill(`Browser teacher ${suffix}`);
    await page.getByLabel('Username', { exact: true }).fill(username);
    await page.getByLabel('Temporary password (minimum 12 characters)').fill(password);
    for (const className of classNames) await page.getByLabel(className, { exact: true }).check();
    await expect(page.getByLabel(`${classNames[0]} teaching role`)).toHaveValue('all');
    await page.getByLabel(`${classNames[1]} teaching role`).selectOption('selected');
    await page.getByLabel('Mathematics', { exact: true }).check();
    await page.getByRole('button', { name: 'Create login account', exact: true }).click();
    await expect(page.getByText('Login account saved.', { exact: false })).toBeVisible({
      timeout: 30000,
    });
    const state = await workspace({ action: 'load' });
    const teacher = state.state.users.find((u: { username?: string }) => u.username === username);
    expect(teacher.classes).toEqual(classNames);
    expect(teacher.classAllowedSubjects).toEqual({ [classNames[1]]: ['sub_math'] });
    const teacherPage = await teacherContext.newPage();
    await teacherPage.goto('http://127.0.0.1:5173/');
    await teacherPage.getByLabel('Username or email').fill(username);
    await teacherPage.getByLabel('Password', { exact: true }).fill(password);
    await teacherPage.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(teacherPage.getByRole('navigation').first()).toBeVisible({ timeout: 30000 });
    await teacherPage.reload();
    await expect(teacherPage.getByRole('navigation').first()).toBeVisible({ timeout: 30000 });
  } finally {
    await teacherContext.close();
    const lookup = await service
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    if (lookup.error) throw lookup.error;
    if (lookup.data) {
      const deleted = await service.auth.admin.deleteUser(lookup.data.id);
      if (deleted.error) throw deleted.error;
    }
    const current = await workspace({ action: 'load' });
    await workspace({
      action: 'save',
      revision: current.revision,
      changes: [
        {
          collection: 'classes',
          id: 'singleton',
          before: current.state.classes,
          after: current.state.classes.filter((c: string) => !classNames.includes(c)),
        },
      ],
    });
    await admin.auth.signOut({ scope: 'local' });
  }
});

test('administrator signs in, reloads cloud data, and navigates the empty school', async ({
  page,
}) => {
  const credentials = JSON.parse(
    readFileSync(process.env.AOS_TEST_CREDENTIALS || '.temp/admin-credentials.json', 'utf8'),
  );
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    errors.push(error.message);
    console.log('Page error:', error.message);
  });
  await page.goto('/');
  await page.getByLabel('Username or email').fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('navigation').first()).toBeVisible({ timeout: 30000 });
  await page.reload();
  await expect(page.getByRole('navigation').first()).toBeVisible({ timeout: 30000 });
  for (const route of [
    'students',
    'community',
    'users',
    'finance',
    'payroll',
    'attendance',
    'coursework',
    'reports',
    'resources',
    'timetable',
    'settings',
  ]) {
    await page.goto(`/#/${route}`);
    console.log('Checking screen:', route);
    await expect(page.locator('main')).toBeVisible();
  }
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/cloud-admin.png', fullPage: true });
});
