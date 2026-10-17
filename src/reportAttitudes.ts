// Shared by the editor, printed reports and server validation. Order is intentional.
export const attitudeItems = [
  {
    key: 'conduct',
    label: 'Conduct',
    options: ['EXEMPLARY', 'VERY GOOD', 'WELL-BEHAVED', 'SATISFACTORY', 'NEEDS IMPROVEMENT'],
  },
  {
    key: 'work_ethic',
    label: 'Work Ethic',
    options: ['COMMENDABLE', 'DILIGENT', 'STEADY', 'FAIR', 'NEEDS MORE EFFORT'],
  },
  {
    key: 'neatness',
    label: 'Neatness',
    options: ['NEAT & ORDERLY', 'VERY NEAT', 'TIDY', 'FAIRLY NEAT', 'NEEDS IMPROVEMENT'],
  },
  {
    key: 'sociability',
    label: 'Sociability',
    options: ['RESPECTFUL', 'FRIENDLY', 'COOPERATIVE', 'RESERVED', 'NEEDS ENCOURAGEMENT'],
  },
  {
    key: 'debate_oratory',
    label: 'Debate & Oratory',
    options: ['VERY ACTIVE', 'ACTIVE', 'CONFIDENT', 'FAIRLY ACTIVE', 'PASSIVE'],
  },
  {
    key: 'science_expo',
    label: 'Science Expo',
    options: ['INNOVATIVE', 'CREATIVE', 'CURIOUS', 'PARTICIPATING', 'NEEDS ENCOURAGEMENT'],
  },
  {
    key: 'mental_drill',
    label: 'Mental Drill',
    options: ['QUICK & SHARP', 'ALERT', 'ACCURATE', 'STEADY', 'SLOW'],
  },
  {
    key: 'reading_comprehension',
    label: 'Reading Comprehension',
    options: ['FLUENT & EXPRESSIVE', 'FLUENT', 'CLEAR', 'DEVELOPING', 'NEEDS SUPPORT'],
  },
] as const;

export type AttitudeKey = (typeof attitudeItems)[number]['key'];
export type Attitudes = Partial<Record<AttitudeKey, string>>;
export interface ReportConduct {
  attitudes?: Attitudes | null;
  promotedTo?: string;
  attendanceAttended?: string;
  attendanceTotal?: string;
  rollOverride?: string;
  positionOverride?: string;
  [key: string]: string | Attitudes | null | undefined;
}

export function readAttitudes(record: ReportConduct = {}): Attitudes {
  // Preserve existing free-text remarks until explicitly replaced in the editor.
  return Object.fromEntries(
    attitudeItems.map(({ key, label }) => [
      key,
      record.attitudes != null
        ? record.attitudes[key] || ''
        : typeof record[label] === 'string'
          ? record[label]
          : '',
    ]),
  );
}

export function attitudeError(value: unknown): string | undefined {
  if (value == null) return;
  if (typeof value !== 'object' || Array.isArray(value)) return 'Attitudes must be an object.';
  for (const [key, word] of Object.entries(value)) {
    const item = attitudeItems.find((item) => item.key === key);
    if (!item) return `Unknown attitude key: ${key}.`;
    if (
      typeof word !== 'string' ||
      (word !== '' && !(item.options as readonly string[]).includes(word))
    )
      return `Choose a listed option or leave ${item.label} empty.`;
  }
}
