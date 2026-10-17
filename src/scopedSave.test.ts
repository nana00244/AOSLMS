import { expect, test, vi } from 'vitest';
import { scopedSave } from '../supabase/functions/workspace/scopedSave';
import { seed } from './data';
const operationId = '00000000-0000-4000-8000-000000000001';
test('scoped save validates attitudes and preserves blanks in compact acknowledgements', async () => {
  for (const [attitudes, valid] of [
    [{ conduct: '', neatness: 'NEAT & ORDERLY' }, true],
    [{ unknown: 'EXEMPLARY' }, false],
    [{ conduct: 'INVALID' }, false],
  ] as const) {
    const { client, profile, state, id, input, rpc } = setup();
    const request = {
      ...input,
      changes: [{ collection: 'conduct', id, before: state.conduct[id], after: { attitudes } }],
    };
    if (valid) {
      const result = await scopedSave(client, profile, request);
      expect(result.changes[0].after.attitudes).toEqual(attitudes);
    } else {
      await expect(scopedSave(client, profile, request)).rejects.toThrow();
      expect(rpc.mock.calls.some(([name]) => name.startsWith('commit_'))).toBe(false);
    }
  }
});
function setup(role = 'Administrator', completed = false) {
  const state = seed();
  const profile = {
    id: 'staff',
    full_name: 'Staff',
    email: 'staff@example.test',
    role,
    active: true,
    student_id: null,
    username: null,
    class_allowed_subjects: null,
    classes: [],
  };
  const rpc = vi.fn(async (name: string) => ({
    data:
      name === 'read_workspace_save_context'
        ? { document: state, profiles: [profile], revision: 3 }
        : { revision: 4, alreadyApplied: false },
  }));
  const client = {
    rpc,
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          in: async () => ({ data: completed ? [{ operation_id: operationId, revision: 3 }] : [] }),
        }),
      }),
    })),
  };
  const id = state.students[0].id + '|1';
  const input = {
    action: 'save-pending',
    operationId,
    changes: [{ collection: 'remarks', id, before: state.remarks[id], after: 'New' }],
  };
  return { state, profile, client, rpc, id, input };
}
test('scoped save returns confirmed record only, no full snapshot read', async () => {
  const { client, profile, input, rpc, id } = setup();
  const result = await scopedSave(client, profile, input);
  expect(result).toEqual({
    confirmed: true,
    revision: 4,
    baseRevision: 3,
    changes: [{ collection: 'remarks', id, after: 'New' }],
  });
  expect(rpc.mock.calls.map(([name]) => name)).toEqual([
    'read_workspace_save_context',
    'commit_workspace_maps_once',
  ]);
  expect(result).not.toHaveProperty('state');
});
test('unassigned teacher cannot write; confirmed receipt retry does not write again', async () => {
  const denied = setup('Teacher');
  await expect(scopedSave(denied.client, denied.profile, denied.input)).rejects.toThrow(
    'Class or subject',
  );
  expect(denied.rpc).toHaveBeenCalledTimes(1);
  const retry = setup('Administrator', true);
  const result = await scopedSave(retry.client, retry.profile, retry.input);
  expect(result.revision).toBe(3);
  expect(retry.rpc).toHaveBeenCalledTimes(1);
  expect(result.changes[0].after).toBe(retry.state.remarks[retry.id]);
});
