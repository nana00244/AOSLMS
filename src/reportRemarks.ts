import { classSubjects, gradeKey, type State, type User } from './data.ts';
import { canTeach } from './backendAccess.ts';

export function reportRemarkScores(state: State, user: User, studentId: string, term: number) {
  const student = state.students.find((s) => s.id === studentId);
  if (
    !user.active ||
    !student ||
    ![1, 2, 3].includes(term) ||
    (user.role !== 'Administrator' &&
      (user.role !== 'Teacher' || term !== state.settings.term || !canTeach(user, student.classId)))
  )
    throw new Error('This report is not available to your account.');
  const scores = classSubjects(student.classId).flatMap((subject) => {
    if (user.role === 'Teacher' && !canTeach(user, student.classId, subject)) return [];
    const grade = state.grades[gradeKey(studentId, term, subject)];
    if (!grade) return [];
    if (![grade.sba, grade.exam].every((n) => Number.isFinite(n) && n >= 0 && n <= 50))
      throw new Error('Correct the report scores before generating a remark.');
    return [{ subject, sba: grade.sba, exam: grade.exam, total: grade.sba + grade.exam }];
  });
  if (!scores.length)
    throw new Error('Save at least one subject score before generating a remark.');
  return scores;
}

export const reportRemarkInstructions = `Write a concise, warm, professional class teacher's report-card remark, 40–70 words, in plain English. Use only the supplied recorded scores (SBA out of 50, examination out of 50, total out of 100). Mention evidenced strengths and an actionable study recommendation for a weaker subject when appropriate. Refer to "the student" without inventing a name or gender. Do not infer behaviour, attendance, personality, effort, improvement over time, disability or home circumstances. Missing subjects are not zero scores; the supplied subjects may be only part of the report. Do not claim an overall class rank or overall report average. Do not invent marks. Return only the remark, with no heading, markdown or quotation marks. This is a draft for teacher review.`;

export function extractReportRemark(response: any): string {
  const candidate = response?.candidates?.[0];
  if (response?.promptFeedback?.blockReason || candidate?.finishReason !== 'STOP')
    throw new Error('AI did not complete the remark. Please retry.');
  const parts = candidate?.content?.parts;
  const text = Array.isArray(parts)
    ? parts
        .filter((part: any) => !part.thought && typeof part.text === 'string')
        .map((part: any) => part.text)
        .join('')
        .trim()
    : '';
  if (!text || text.length > 1200) throw new Error('AI returned an unusable remark. Please retry.');
  return text;
}
export function geminiRemarkRequest(scores: ReturnType<typeof reportRemarkScores>) {
  return {
    systemInstruction: { parts: [{ text: reportRemarkInstructions }] },
    contents: [{ role: 'user', parts: [{ text: JSON.stringify({ scores }) }] }],
    generationConfig: { maxOutputTokens: 512, thinkingConfig: { thinkingLevel: 'minimal' } },
  };
}
export function geminiRemarkError(status: number) {
  if ([400, 401, 403].includes(status))
    return {
      code: 'AI_KEY_INVALID',
      error:
        'Gemini could not authorize this request. Ask the administrator to check the server API key and project access.',
    };
  if (status === 429)
    return {
      code: 'AI_QUOTA_UNAVAILABLE',
      error:
        'Gemini request quota is unavailable. Try later; if this continues, ask the administrator to check the Google AI project quota.',
    };
  return {
    code: 'AI_UNAVAILABLE',
    error: 'Gemini is unavailable. Please try later or enter a remark manually.',
  };
}
