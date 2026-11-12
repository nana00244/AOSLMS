const preferredSubjects = ['english language', 'english', 'mathematics', 'science'];

function subjectRank(subject: string): number {
  const normalized = subject.trim().toLowerCase();
  const exact = preferredSubjects.indexOf(normalized);
  if (exact >= 0) return exact;
  if (normalized.startsWith('english')) return 0;
  return preferredSubjects.length;
}

export function compareHubSubjects(a: string, b: string): number {
  return subjectRank(a) - subjectRank(b) || a.localeCompare(b);
}

function levelRank(level: string): number {
  const normalized = level.trim().split('·')[0].trim();
  const basicMatch = normalized.match(/^(?:Basic\s*|B)(\d+)$/i);
  if (basicMatch) return Number(basicMatch[1]);

  const kgMatch = normalized.match(/^KG\s*(\d+)$/i);
  if (kgMatch) return 100 + Number(kgMatch[1]);

  const jhsMatch = normalized.match(/^(?:JHS\s*(\d+)|B([789]))$/i);
  if (jhsMatch) return 110 + Number(jhsMatch[1] || Number(jhsMatch[2]) - 6);

  const shsMatch = normalized.match(/^SHS\s*(\d+)$/i);
  if (shsMatch) return 120 + Number(shsMatch[1]);

  return 200;
}

export function compareHubLevels(a: string, b: string): number {
  return levelRank(a) - levelRank(b) || a.localeCompare(b);
}

export function displayHubLevel(level: string): string {
  const basicMatch = level.trim().match(/^B([1-6])$/i);
  if (basicMatch) return `Basic ${basicMatch[1]}`;
  const normalized = level.trim();
  return /^B[789]$/i.test(normalized) ? `${normalized} · JHS ${Number(normalized[1]) - 6}` : level;
}

export function compareHubCourseGroups(a: string, b: string): number {
  const [levelA, subjectA] = a.split('|');
  const [levelB, subjectB] = b.split('|');
  return compareHubSubjects(subjectA, subjectB) || compareHubLevels(levelA, levelB);
}
