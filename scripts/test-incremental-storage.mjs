import { workspaceRecordDelta } from '../src/workspaceDelta.ts';
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
  await db.exec(sql('20261015084704_targeted_workspace_saves.sql'));
  await db.exec(sql('20261016080249_workspace_record_deltas.sql'));
  await db.exec(sql('20261016081241_workspace_json_snapshot.sql'));
  await db.exec(`create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(bucket_id text,name text);
    grant usage on schema storage to service_role;
    grant select on storage.objects to service_role;`);
  await db.exec(sql('20261016213411_private_student_photos.sql'));
  await db.exec(sql('20261016213625_scoped_workspace_save_context.sql'));
  await db.exec(sql('20261017054715_report_card_attitudes.sql'));
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
    const delta = workspaceRecordDelta((await snapshot()).document, state);
    return (
      await db.query('select public.commit_workspace_delta($1,$2,$3,$4,$5) result', [
        revision,
        JSON.stringify(delta),
        actor,
        'Synthetic regression',
        op,
      ])
    ).rows[0].result.revision;
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
  const unchanged = (
    await db.query('select public.read_workspace_snapshot_json($1) result', [revision])
  ).rows[0].result;
  assert.deepEqual(unchanged, { unchanged: true, revision });
  // Targeted commits retain per-operation receipts and never touch photograph tuples.
  const mapOperation = '00000000-0000-4000-8000-000000000003';
  const mapOperation2 = '00000000-0000-4000-8000-000000000004';
  const mapCommit = (rev, changes, operations) =>
    db
      .query('select public.commit_workspace_maps_once($1,$2,$3,$4) result', [
        rev,
        JSON.stringify(changes),
        actor,
        JSON.stringify(operations),
      ])
      .then((r) => r.rows[0].result);
  const mapBefore = await tuples();
  const ops = [
    { id: mapOperation, event: 'First' },
    { id: mapOperation2, event: 'Second' },
  ];
  const mapped = await mapCommit(revision, [{ collection: 'grades', id: 'a', after: 10 }], ops);
  assert.equal(mapped.alreadyApplied, false);
  assert.equal(
    (await mapCommit(revision, [], ops)).alreadyApplied,
    true,
    'lost-response retry is idempotent',
  );
  assert.equal(
    (await db.query('select count(*)::int n from public.audit_log')).rows[0].n,
    3,
    'one audit per original save, no duplicates',
  );
  const mapAfter = await tuples();
  assert.deepEqual(
    mapAfter
      .filter(
        (r) =>
          mapBefore.find((b) => b.section === r.section && b.entry_key === r.entry_key)?.tuple !==
          r.tuple,
      )
      .map((r) => r.section),
    ['grades'],
  );
  await assert.rejects(
    mapCommit(mapped.revision, [], [ops[0], { id: '00000000-0000-4000-8000-000000000005' }]),
    /Conflict/,
  );
  await assert.rejects(
    mapCommit(revision, [], [{ id: '00000000-0000-4000-8000-000000000005' }]),
    /Conflict/,
  );
  await assert.rejects(
    mapCommit(
      mapped.revision,
      [{ collection: 'students', id: 'a', after: {} }],
      [{ id: '00000000-0000-4000-8000-000000000005' }],
    ),
    /Invalid targeted/,
  );
  assert.equal((await snapshot()).document.grades.a, 10);
  replacement.grades.a = 10;
  replacement.students.reverse();
  replacement.students.unshift({ id: 'c', photo: 'new' });
  delete replacement.grades.a;
  delete replacement.duplicateIds;
  replacement.nil = { key: null };
  await commit(replacement, mapped.revision);
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
      'read_workspace_snapshot_json(bigint)',
      'read_workspace_save_context(jsonb)',
      'read_student_photo_context(jsonb)',
      'migrate_student_photo(text,text,text)',
      'commit_workspace(bigint,jsonb,uuid,text)',
      'commit_workspace_once(bigint,jsonb,uuid,text,uuid)',
      'commit_workspace_maps_once(bigint,jsonb,uuid,jsonb)',
      'commit_workspace_delta(bigint,jsonb,uuid,text,uuid)',
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
  const liveShape = (await db.query('select public.read_workspace_snapshot_json(null) result'))
    .rows[0].result;
  assert.deepEqual(liveShape.document, replacement, 'service role reconstructs all records');
  replacement.settings.name = 'Updated school';
  await commit(replacement, liveShape.revision);
  assert.deepEqual(
    (await snapshot()).document,
    replacement,
    'service role can commit without extra privileges',
  );
  await db.exec('reset role');
  await db.exec(
    "insert into public.workspace_entries(section,entry_key,ordinal,value) values('grades','o:context-test',0,'10'),('grades','o:unrequested-test',0,'20')",
  );
  const context = (
    await db.query('select public.read_workspace_save_context($1) result', [
      JSON.stringify([{ collection: 'grades', id: 'context-test' }]),
    ])
  ).rows[0].result;
  assert.equal(
    context.document.students.some((s) => s.photo),
    false,
    'scoped reads omit photo payloads',
  );
  assert.deepEqual(
    Object.keys(context.document.grades),
    ['context-test'],
    'only requested map keys returned',
  );
  assert.equal(Object.hasOwn(context.document, 'assignments'), false);
  const photoRow = (
    await db.query(
      "select entry_key,value from public.workspace_entries where section='students' limit 1",
    )
  ).rows[0];
  const ref = 'photo:' + 'a'.repeat(64) + '.png';
  await assert.rejects(
    db.query('select public.migrate_student_photo($1,$2,$3)', [
      photoRow.entry_key,
      photoRow.value.photo,
      ref,
    ]),
    /Verified storage/,
  );
  await db.query('insert into storage.objects values($1,$2)', ['student-photos', ref.slice(6)]);
  assert.equal(
    (
      await db.query('select public.migrate_student_photo($1,$2,$3) ok', [
        photoRow.entry_key,
        'wrong before photo',
        ref,
      ])
    ).rows[0].ok,
    false,
  );
  assert.equal(
    (
      await db.query('select public.migrate_student_photo($1,$2,$3) ok', [
        photoRow.entry_key,
        photoRow.value.photo,
        ref,
      ])
    ).rows[0].ok,
    true,
  );
  const changedPhoto = (
    await db.query(
      "select value from public.workspace_entries where section='students' and entry_key=$1",
      [photoRow.entry_key],
    )
  ).rows[0].value;
  assert.deepEqual(
    changedPhoto,
    { ...photoRow.value, photo: ref },
    'photo migration preserves all student fields',
  );
  // Exercise the new JSON member using real PostgreSQL, without any live records.
  await db.query(
    "insert into public.workspace_entries(section,entry_key,ordinal,value) values('conduct','test|1',0,$1)",
    [{ attendanceTotal: '60' }],
  );
  await db.query(
    "update public.workspace_entries set value=$1 where section='conduct' and entry_key='test|1'",
    [{ attitudes: null, attendanceTotal: '60' }],
  );
  const { attitudeItems } = await import('../src/reportAttitudes.ts');
  const attitudes = Object.fromEntries(attitudeItems.map(({ key, options }) => [key, options[0]]));
  await db.query(
    "update public.workspace_entries set value=$1 where section='conduct' and entry_key='test|1'",
    [{ attitudes, attendanceTotal: '60' }],
  );
  assert.deepEqual(
    (
      await db.query(
        "select value->'attitudes' attitudes from public.workspace_entries where section='conduct' and entry_key='test|1'",
      )
    ).rows[0].attitudes,
    attitudes,
  );
  await db.exec('begin');
  await db.exec(
    "update public.workspace_entries set value='\"transaction sentinel\"' where section='grades'",
  );
  await assert.rejects(
    db.query(
      "update public.workspace_entries set value=$1 where section='conduct' and entry_key='test|1'",
      [{ attitudes: [] }],
    ),
    /report_attitudes_object/,
  );
  await db.exec('rollback');
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.workspace_entries where section='grades' and value='\"transaction sentinel\"'",
      )
    ).rows[0].n,
    0,
  );
  await db.exec('alter table public.workspace_entries drop constraint report_attitudes_object');
  assert.deepEqual(
    (
      await db.query(
        "select value->'attitudes' attitudes from public.workspace_entries where section='conduct' and entry_key='test|1'",
      )
    ).rows[0].attitudes,
    attitudes,
    'undo keeps saved data',
  );
  await db.query(
    "insert into public.workspace_entries(section,entry_key,ordinal,value) values('attendance','o:2026-10-16|1|weekday-test',0,$1),('attendance','o:2026-10-17|1|weekday-test',0,$1),('conduct','o:weekday-test|1',0,$2)",
    [
      JSON.stringify('Present'),
      {
        attendanceTotal: '2',
        attendanceAttended: '2',
        attitudes: { conduct: 'EXEMPLARY' },
        promotedTo: 'BS 2',
      },
    ],
  );
  await db.exec(sql('20261017144856_weekday_attendance.sql'));
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.workspace_entries where section='attendance' and entry_key='o:2026-10-17|1|weekday-test'",
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.workspace_entries where section='attendance' and entry_key='o:2026-10-16|1|weekday-test'",
      )
    ).rows[0].n,
    1,
  );
  assert.deepEqual(
    (
      await db.query(
        "select value from public.workspace_entries where section='conduct' and entry_key='o:weekday-test|1'",
      )
    ).rows[0].value,
    { attitudes: { conduct: 'EXEMPLARY' }, promotedTo: 'BS 2' },
  );
  assert.equal(
    (await db.query('select count(*)::int n from private.weekend_attendance_recovery')).rows[0].n,
    2,
  );
  await assert.rejects(
    db.query(
      "insert into public.workspace_entries(section,entry_key,ordinal,value) values('attendance','o:2026-10-18|1|weekday-test',0,$1)",
      [JSON.stringify('Present')],
    ),
    /attendance_weekdays_only/,
  );
  await assert.rejects(
    db.query(
      "insert into public.workspace_entries(section,entry_key,ordinal,value) values('attendance','o:2026-02-30|1|weekday-test',0,$1)",
      [JSON.stringify('Present')],
    ),
    /attendance_weekdays_only/,
  );
  await db.exec('set role service_role');
  await db.query(
    "insert into public.workspace_entries(section,entry_key,ordinal,value) values('attendance','o:2026-10-19|1|weekday-test',0,$1)",
    [JSON.stringify('Present')],
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
