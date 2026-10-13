import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

// Real PostgreSQL semantics with synthetic records only; no cloud credentials.
const db = new PGlite();
const actor = '00000000-0000-4000-8000-000000000001';
const operation = '00000000-0000-4000-8000-000000000002';
const original = {
  version: 1,
  students: [
    { id: 'a', photo: 'photo'.repeat(20000) },
    { id: 'b', photo: 'other'.repeat(20000) },
  ],
  settings: { name: 'School', crest: 'crest'.repeat(10000) },
  grades: { a: 8 },
  verified: ['one', 'one'],
  emptyArray: [],
  emptyObject: {},
  nil: null,
  scalar: 'value',
  duplicateIds: [{ id: 'same', value: 1 }, { id: 'same', value: 2 }, { noId: true }],
};
const sql = (name) =>
  readFileSync(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8');
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema private; create schema auth;
    create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    create type public.app_role as enum ('Administrator','Student');
    create table public.profiles(id uuid primary key, role public.app_role,active boolean,
      classes jsonb default '[]',class_allowed_subjects jsonb default '{}',student_id text,updated_at timestamptz);
    create table public.audit_log(id bigserial primary key,actor_id uuid,action text,entity text);
    create table public.school_workspace(id boolean primary key default true check(id),revision bigint default 0,
      document jsonb not null,updated_at timestamptz default now());
    alter table public.school_workspace enable row level security;
    revoke all on public.school_workspace from public,anon,authenticated;
    grant all on public.school_workspace to service_role;
    insert into public.profiles(id,role,active) values('${actor}','Administrator',true);
  `);
  await db.query('insert into public.school_workspace(document) values($1)', [original]);
  await db.exec(sql('20261012090325_durable_workspace_saves.sql'));
  // Preserve and exercise the actual realtime publication trigger, without a replication server.
  await db.exec(
    sql('20261012081234_assessment_upload_realtime.sql').replace(
      'alter publication supabase_realtime add table public.workspace_revisions;',
      '',
    ),
  );
  await db.exec(`create function private.profile_changed() returns trigger language plpgsql as $$
    begin update public.school_workspace set revision=revision+1 where id; return new; end; $$;
    create trigger profile_revision before insert or update on public.profiles
    for each row execute function private.profile_changed();`);
  await db.exec('begin');
  await db.exec(sql('20261013173811_incremental_workspace_storage.sql'));
  await db.exec(sql('20261013222536_bounded_workspace_query_memory.sql'));
  await db.exec('commit');
  const snapshot = async () => (await db.query('select * from public.school_workspace')).rows[0];
  assert.deepEqual((await snapshot()).document, original, 'migration must be lossless');
  const tuples = async () =>
    (
      await db.query(
        'select section,entry_key,ctid::text tuple from public.workspace_entries order by 1,2',
      )
    ).rows;
  const before = await tuples();
  const replacement = structuredClone(original);
  replacement.grades.a = 9;
  const commit = async (state, revision, op = null) => {
    const query = op
      ? 'select public.commit_workspace_once($1,$2,$3,$4,$5) revision'
      : 'select public.commit_workspace($1,$2,$3,$4) revision';
    return (
      await db.query(query, [revision, state, actor, 'Synthetic regression', ...(op ? [op] : [])])
    ).rows[0].revision;
  };
  const revision = await commit(replacement, 0, operation);
  const after = await tuples();
  const changed = after.filter(
    (row) =>
      before.find((b) => b.section === row.section && b.entry_key === row.entry_key)?.tuple !==
      row.tuple,
  );
  assert.deepEqual(
    changed.map((r) => r.section),
    ['grades'],
    'one grade must not rewrite pictures',
  );
  assert.equal(await commit(replacement, 0, operation), revision, 'retry is idempotent');
  assert.equal((await db.query('select count(*)::int n from public.audit_log')).rows[0].n, 1);
  await assert.rejects(commit(original, 0), /Conflict/);
  assert.deepEqual(
    (await snapshot()).document,
    replacement,
    'stale save must leave records unchanged',
  );
  const unchanged = (await db.query('select public.read_workspace_snapshot($1) result', [revision]))
    .rows[0].result;
  assert.deepEqual(unchanged, { unchanged: true, revision });
  replacement.students.reverse();
  replacement.students.unshift({ id: 'c', photo: 'new' });
  delete replacement.grades.a;
  delete replacement.duplicateIds;
  replacement.nil = { key: null };
  await commit(replacement, revision);
  assert.deepEqual(
    (await snapshot()).document,
    replacement,
    'reorder, insert, delete and type changes preserve JSON',
  );
  const current = await snapshot();
  await db.query(
    `insert into public.profiles(id,role,active,student_id) values($1,'Student',true,'c')`,
    [operation],
  );
  assert.equal(
    Number((await snapshot()).revision),
    Number(current.revision) + 1,
    'profile change invalidates snapshots',
  );
  replacement.students = replacement.students.filter((s) => s.id !== 'c');
  await commit(replacement, (await snapshot()).revision);
  const student = (
    await db.query('select active,student_id from public.profiles where id=$1', [operation])
  ).rows[0];
  assert.deepEqual(student, { active: false, student_id: null });
  assert.equal(
    (await db.query('select revision from public.workspace_revisions')).rows[0].revision,
    (await snapshot()).revision,
  );
  for (const role of ['anon', 'authenticated']) {
    for (const table of ['workspace_head', 'workspace_entries', 'school_workspace']) {
      assert.equal(
        (
          await db.query('select has_table_privilege($1,$2,$3) allowed', [
            role,
            'public.' + table,
            'SELECT',
          ])
        ).rows[0].allowed,
        false,
      );
    }
    for (const fn of [
      'split_workspace(jsonb)',
      'workspace_structure(jsonb)',
      'assemble_workspace(jsonb)',
      'read_workspace_snapshot(bigint)',
      'commit_workspace(bigint,jsonb,uuid,text)',
      'commit_workspace_once(bigint,jsonb,uuid,text,uuid)',
    ]) {
      assert.equal(
        (
          await db.query('select has_function_privilege($1,$2,$3) allowed', [
            role,
            'public.' + fn,
            'EXECUTE',
          ])
        ).rows[0].allowed,
        false,
      );
    }
  }
  await db.exec(`grant select,update on public.profiles to service_role;
    grant insert on public.audit_log to service_role;
    grant usage on sequence public.audit_log_id_seq to service_role;
    set role service_role;`);
  const liveShape = (await db.query('select public.read_workspace_snapshot(null) result')).rows[0]
    .result;
  assert.deepEqual(liveShape.document, replacement, 'service role reconstructs all records');
  replacement.settings.name = 'Updated school';
  await commit(replacement, liveShape.revision);
  assert.deepEqual(
    (await snapshot()).document,
    replacement,
    'service role can commit without extra privileges',
  );
  await db.exec('reset role');
  console.log(
    'PASS: lossless migration; one-record writes; CAS; idempotency; array and map edits; profile revocation; realtime; private ACLs.',
  );
} catch (error) {
  console.error(error.message, error.where || '', error.detail || '');
  process.exitCode = 1;
} finally {
  await db.close();
}
