export function equalJson(a: any, b: any): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a),
    other = Object.keys(b);
  return (
    keys.length === other.length &&
    keys.every((key) => Object.hasOwn(b, key) && equalJson(a[key], b[key]))
  );
}
interface Entry {
  section: string;
  entry_key: string;
  ordinal: number;
  value: any;
}
function split(document: Record<string, any>) {
  const rows = new Map<string, Entry>();
  const structure: Record<string, any> = {};
  for (const [section, value] of Object.entries(document)) {
    if (value === undefined) continue;
    if (['users', 'teacherAssignments'].includes(section)) continue;
    if (Array.isArray(value)) {
      structure[section] = [];
      const counts = new Map<string, number>();
      value.forEach((item, index) => {
        let key = 'p:' + (index + 1);
        if (item && typeof item === 'object' && !Array.isArray(item) && item.id != null) {
          const id = String(item.id),
            count = (counts.get(id) || 0) + 1;
          counts.set(id, count);
          key = 'i:' + id + ':' + count;
        }
        rows.set(JSON.stringify([section, key]), {
          section,
          entry_key: key,
          ordinal: index + 1,
          value: item === undefined ? null : item,
        });
      });
    } else if (value !== null && typeof value === 'object') {
      structure[section] = {};
      for (const [key, item] of Object.entries(value)) {
        if (item === undefined) continue;
        const entry_key = 'o:' + key;
        rows.set(JSON.stringify([section, entry_key]), {
          section,
          entry_key,
          ordinal: 0,
          value: item,
        });
      }
    } else structure[section] = value;
  }
  return { rows, structure };
}
export function workspaceRecordDelta(before: Record<string, any>, after: Record<string, any>) {
  const old = split(before),
    next = split(after);
  const upserts = [...next.rows]
    .filter(([key, row]) => !equalJson(old.rows.get(key), row))
    .map(([, row]) => row);
  const removals = [...old.rows]
    .filter(([key]) => !next.rows.has(key))
    .map(([, row]) => ({ section: row.section, entry_key: row.entry_key }));
  const profiles = equalJson(before.users, after.users)
    ? null
    : (after.users || []).map((u: any) => ({
        id: u.id,
        classes: u.classes,
        classAllowedSubjects: u.classAllowedSubjects || {},
      }));
  const oldIds = (before.students || []).map((s: any) => s.id),
    studentIds = (after.students || []).map((s: any) => s.id);
  return {
    upserts,
    removals,
    structure: next.structure,
    profiles,
    studentIds: equalJson(oldIds, studentIds) ? null : studentIds,
  };
}
