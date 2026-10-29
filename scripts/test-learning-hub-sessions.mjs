import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);`);
  for (const file of [
    '20261028161503_learning_hub.sql',
    '20261029093443_learning_hub_practice_sessions.sql',
  ])
    await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
  const questions = Array.from({ length: 4 }, (_, i) => ({
    id: `q${i}`,
    lessonId: 'lesson',
    prompt: 'Test',
    options: ['a', 'b', 'c', 'd'],
    answer: i,
    explanation: 'Feedback',
  }));
  const id = randomUUID();
  await db.query(
    `insert into learning_hub_sessions(id,student_id,lesson_id,kind,questions) values($1,'student','lesson','practice',$2)`,
    [id, JSON.stringify(questions)],
  );
  const finish = (student, answers) =>
    db.query(`select finish_learning_hub_session($1,$2,$3) as attempt`, [
      id,
      student,
      answers === null ? null : JSON.stringify(answers),
    ]);
  await assert.rejects(finish('another-student', [0, 1, 2, 3]), /unavailable/);
  await assert.rejects(finish('student', null), /Answer every/);
  await assert.rejects(finish('student', [0]), /Answer every/);
  await assert.rejects(finish('student', [0, 1, 2, 4]), /valid answer/);
  await assert.rejects(finish('student', [0, 1, 2, 0.5]), /valid answer/);
  const {
    rows: [{ attempt }],
  } = await finish('student', [0, 1, 2, 0]);
  assert.equal(attempt.score, 75);
  assert.equal(attempt.correct, 3);
  assert.equal(attempt.question_results[3].correct, false);
  const replay = await finish('student', [0, 1, 2, 3]);
  assert.deepEqual(replay.rows[0].attempt, attempt);
  assert.equal(
    (await db.query(`select count(*)::integer as count from learning_hub_attempts`)).rows[0].count,
    1,
  );
  await db.exec(`set role authenticated`);
  await assert.rejects(db.query(`select * from learning_hub_sessions`), /permission denied/);
  await assert.rejects(finish('student', [0, 1, 2, 3]), /permission denied/);
  await db.exec(`reset role`);
  const expired = randomUUID();
  await db.query(
    `insert into learning_hub_sessions(id,student_id,lesson_id,kind,questions,expires_at) values($1,'student','lesson','practice',$2,now()-interval '1 day')`,
    [expired, JSON.stringify(questions)],
  );
  await assert.rejects(
    db.query(`select finish_learning_hub_session($1,'student','[0,1,2,3]')`, [expired]),
    /expired/,
  );
  console.log(
    'Learning Hub sessions: grading, validation, ownership, expiry, replay and browser-role isolation passed.',
  );
} finally {
  await db.close();
}
