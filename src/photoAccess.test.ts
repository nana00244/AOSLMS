import { expect, test, vi } from 'vitest';
import { signStudentPhotos } from '../supabase/functions/workspace/photos';
const a = 'photo:' + 'a'.repeat(64) + '.png',
  b = 'photo:' + 'b'.repeat(64) + '.jpg';
test('photo signing enforces current class permissions before issuing a private URL', async () => {
  const signer = vi.fn(async (paths: string[]) => ({
    data: paths.map((path) => ({ path, signedUrl: 'https://signed.test/' + path })),
  }));
  const profile = {
    id: 'teacher',
    role: 'Teacher',
    active: true,
    classes: ['BS1'],
    class_allowed_subjects: { BS1: ['English'] },
  };
  const client = {
    rpc: vi.fn(async () => ({
      data: {
        profiles: [profile],
        students: [
          { id: '1', classId: 'BS1', photo: a },
          { id: '2', classId: 'BS2', photo: b },
        ],
      },
    })),
    storage: { from: () => ({ createSignedUrls: signer }) },
  };
  const result = await signStudentPhotos(client, profile, [a, b]);
  expect(Object.keys(result.urls)).toEqual([a]);
  expect(signer).toHaveBeenCalledWith([a.slice(6)], 900);
  profile.active = false;
  await expect(signStudentPhotos(client, profile, [a])).rejects.toThrow('inactive');
  expect(signer).toHaveBeenCalledTimes(1);
});
