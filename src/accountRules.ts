import { classSubjects, courseworkSubjectId } from './data.ts';

export const usernamePattern = /^[a-z0-9][a-z0-9._-]{2,31}$/;
export function normalizeUsername(value: string): string {
  const username = value.trim().toLowerCase();
  if (!usernamePattern.test(username))
    throw new Error(
      'Use 3–32 letters, numbers, dots, underscores or hyphens for the username, starting with a letter or number. Do not include @.',
    );
  return username;
}

/** A reserved, non-deliverable Auth identifier; users only need their school username. */
export function usernameAuthEmail(username: string): string {
  return `${normalizeUsername(username)}@users.aoslms.invalid`;
}
export function loginIdentifier(value: string): string {
  const identifier = value.trim().toLowerCase();
  return identifier.includes('@') ? identifier : usernameAuthEmail(identifier);
}

/** An absent class entry means all subjects; an explicit entry means only those subjects. */
export function normalizeTeachingAccess(
  assignedClasses: string[],
  restrictions: Record<string, string[]>,
  schoolClasses: string[],
): { classes: string[]; classAllowedSubjects: Record<string, string[]> } {
  const classes = [...new Set(assignedClasses)];
  const classAllowedSubjects: Record<string, string[]> = {};
  for (const classId of classes) {
    if (!schoolClasses.includes(classId)) throw new Error('Choose existing classes.');
    if (!Object.hasOwn(restrictions, classId)) continue;
    const curriculum = classSubjects(classId);
    const subjects = [
      ...new Set(
        restrictions[classId].map((subject) => {
          const match = curriculum.find(
            (name) => name === subject || courseworkSubjectId(name) === subject,
          );
          if (!match) throw new Error(`Choose a valid subject for ${classId}.`);
          return courseworkSubjectId(match);
        }),
      ),
    ];
    if (!subjects.length)
      throw new Error(`Select at least one subject for ${classId}, or choose All subjects.`);
    classAllowedSubjects[classId] = subjects;
  }
  return { classes, classAllowedSubjects };
}
