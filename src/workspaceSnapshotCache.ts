// An isolate-local acceleration only: every reuse is checked against the database.
export function createSnapshotCache() {
  let cached: any;
  const fits = (snapshot: any) => {
    let size = 0;
    const visit = (value: any): boolean => {
      if (typeof value === 'string') size += value.length;
      else if (value && typeof value === 'object') {
        for (const key of Object.keys(value)) {
          size += key.length + 16;
          if (!visit(value[key])) return false;
        }
      } else size += 16;
      return size <= 32 * 1024 * 1024;
    };
    return visit(snapshot);
  };
  const remember = (snapshot: any) => {
    if (!snapshot?.document || snapshot.unchanged) return;
    if (!cached || snapshot.revision >= cached.revision)
      cached = fits(snapshot) ? snapshot : undefined;
  };
  return {
    clear() {
      cached = undefined;
    },
    remember,
    async read(client: any, knownRevision: number | null = null) {
      const candidate = cached;
      const { data, error } = await client.rpc('read_workspace_snapshot_json', {
        known_revision: candidate?.revision ?? knownRevision,
      });
      if (error) throw error;
      if (!data) throw Error('School workspace is unavailable');
      const result =
        data.unchanged && candidate && data.revision === candidate.revision ? candidate : data;
      remember(result);
      return knownRevision !== null && result.revision === knownRevision
        ? { unchanged: true, revision: result.revision }
        : result;
    },
  };
}
