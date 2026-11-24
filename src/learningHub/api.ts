import { loadPracticeHistory, type AutoPracticeRecord } from '../nacca/practiceHistory';
import { indicatorLessonId } from './indicatorLessonId';
import { invokeBackend, BackendError, isAccessDenied } from '../backend';
import { supabase } from '../supabase';
import {
  cacheHub,
  readCachedHub,
  retainReading,
  acknowledgeReading,
  readPendingReadings,
  confirmAdaptive,
  isAdaptiveConfirmed,
  forgetCachedHub,
} from './offlineHub';
import type { HubLesson } from './catalog';
import type {
  HubAssignment,
  HubAttempt,
  HubPracticeResult,
  HubReading,
  HubSnapshot,
  LearningLesson,
} from './types';

import { hubLessons } from './catalog';
import { naccaHubLessons } from './naccaBank';

export function localHubAttempt(record: AutoPracticeRecord): HubAttempt {
  return {
    id: record.id,
    lessonId: indicatorLessonId(record.subject, record.indicatorCode),
    studentId: record.studentId,
    assignmentId: record.assignmentId ?? null,
    score: record.score,
    correct: record.correctCount,
    total: record.totalCount,
    createdAt: record.completedAt,
  };
}

function requireOnline() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false)
    throw Error(
      'This action needs an internet connection. Your current work remains on this page.',
    );
}

/** Bind queued work to its original account, including across an account switch. */
async function invokeForOwner(owner: string, body: Record<string, unknown>) {
  requireOnline();
  if (!supabase) throw Error('Supabase is not configured');
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session || session.user.id !== owner)
    throw new BackendError('Sign in to the original account to sync learning progress.', 401);
  const { data, error } = await supabase.functions.invoke('learning-hub', {
    body,
    headers: { Authorization: `Bearer ${session.access_token}` },
    signal: AbortSignal.timeout(15000),
  });
  if (error) {
    if (error.context instanceof Response) {
      const detail = await error.context.json().catch(() => null);
      throw new BackendError(
        detail?.error || `Request failed (${error.context.status})`,
        error.context.status,
      );
    }
    throw error;
  }
  if (data?.error) throw Error(data.error);
  return data;
}

export async function submitAdaptive(
  record: AutoPracticeRecord,
  owner?: string,
): Promise<HubAttempt> {
  requireOnline();
  const body = {
    action: 'submit-adaptive',
    attemptId: record.id,
    completedAt: record.completedAt,
    lessonId: indicatorLessonId(record.subject, record.indicatorCode),
    assignmentId: record.assignmentId,
    responses: record.questions.map((q) => ({ questionId: q.questionId, ...q.response })),
  };
  const result = await (owner ? invokeForOwner(owner, body) : invokeBackend('learning-hub', body));
  if (owner) await confirmAdaptive(owner, record.id);
  return result;
}

const synchronizing = new Map<string, Promise<void>>();
/** All writes here are server-idempotent; failures leave the local record intact. */
export async function syncHubOffline(owner: string, studentId?: string): Promise<void> {
  if (!studentId || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
  const existing = synchronizing.get(owner);
  if (existing) return existing;
  const task = (async () => {
    let rejected: unknown;
    const retainFailure = (error: unknown) => {
      // Validation/deleted-assignment failures remain retained for review, but
      // must not block unrelated newer work. Connectivity/session failures stop.
      if (!(error instanceof BackendError) || ![400, 403, 404, 409, 422].includes(error.status))
        throw error;
      rejected ??= error;
    };
    for (const reading of await readPendingReadings(owner)) {
      if (reading.studentId !== studentId) continue;
      try {
        const confirmed = await invokeForOwner(owner, {
          action: 'complete-reading',
          lessonId: reading.lessonId,
          assignmentId: reading.assignmentId || undefined,
        });
        await acknowledgeReading(owner, reading.id, confirmed);
      } catch (error) {
        retainFailure(error);
      }
    }
    for (const record of loadPracticeHistory(studentId)) {
      if (
        record.category !== 'auto' ||
        record.studentId !== studentId ||
        !record.questions.length ||
        record.questions.some((q) => q.response === undefined) ||
        (await isAdaptiveConfirmed(owner, record.id))
      )
        continue;
      try {
        await submitAdaptive(record, owner);
      } catch (error) {
        retainFailure(error);
      }
    }
    if (rejected) throw rejected;
  })();
  synchronizing.set(owner, task);
  try {
    await task;
  } finally {
    synchronizing.delete(owner);
  }
}

export type OfflineHubSnapshot = HubSnapshot & {
  offline: boolean;
  pendingReadings: number;
  syncError?: string;
};
export const loadHub = async (
  studentId?: string,
  background = false,
  owner?: string,
): Promise<OfflineHubSnapshot> => {
  let remote: HubSnapshot | null = null;
  let offline = false;
  let syncError: string | undefined;
  try {
    requireOnline();
    if (owner) {
      try {
        await syncHubOffline(owner, studentId);
      } catch (error) {
        syncError = error instanceof Error ? error.message : 'Learning sync failed.';
      }
    }
    remote = await (owner
      ? invokeForOwner(owner, { action: 'load' })
      : invokeBackend('learning-hub', { action: 'load' }));
  } catch (error) {
    if (isAccessDenied(error)) {
      if (owner) await forgetCachedHub(owner);
      throw error;
    }
    offline = true;
    if (owner) remote = (await readCachedHub(owner)) ?? null;
    if (background && !remote && navigator.onLine) throw error;
  }
  if (!offline && owner && remote) {
    try {
      await cacheHub(owner, remote);
    } catch {
      syncError =
        'This device could not store the learning copy. Keep it online and free storage before leaving.';
    }
  }

  const naccaLessonsMapped: LearningLesson[] = naccaHubLessons.map((l) => ({
    ...l,
    questions: l.questions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      options: q.options,
    })),
  }));

  const catalogLessons: LearningLesson[] = hubLessons.map((l) => ({
    ...l,
    questions: l.questions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      options: q.options,
    })),
  }));
  const remoteLessons = remote?.lessons ?? [];

  // Prefer curated catalog lessons when generated indicator entries share the same ID.
  const seen = new Set<string>();
  const combinedLessons: LearningLesson[] = [];
  for (const l of [...catalogLessons, ...naccaLessonsMapped, ...remoteLessons]) {
    if (!seen.has(l.id)) {
      seen.add(l.id);
      combinedLessons.push(l);
    }
  }

  const attempts = new Map((remote?.attempts ?? []).map((a) => [a.id, a]));
  if (studentId) {
    for (const record of loadPracticeHistory(studentId)) {
      if (record.studentId !== studentId || record.category !== 'auto' || attempts.has(record.id))
        continue;
      attempts.set(record.id, localHubAttempt(record));
      // Older records have totals only. Keep them on the originating device.
      if (
        !owner &&
        !offline &&
        remote &&
        record.questions.length &&
        record.questions.every((q) => q.response !== undefined)
      ) {
        try {
          attempts.set(record.id, await submitAdaptive(record));
        } catch {
          // The local history is the retry queue. A later load will retry this same ID.
        }
      }
    }
  }
  const pending = owner ? await readPendingReadings(owner) : [];
  const readings = [...(remote?.readings || [])];
  for (const reading of pending) {
    if (
      reading.studentId === studentId &&
      !readings.some(
        (r) =>
          r.studentId === reading.studentId &&
          r.lessonId === reading.lessonId &&
          r.assignmentId === reading.assignmentId,
      )
    )
      readings.push(reading);
  }
  return {
    offline,
    pendingReadings: pending.length,
    syncError,
    lessons: combinedLessons,
    assignments: remote?.assignments || [],
    attempts: [...attempts.values()],
    readings,
  };
};
export const createHubLesson = (lesson: Omit<HubLesson, 'id'>): Promise<LearningLesson> => {
  requireOnline();
  return invokeBackend('learning-hub', { action: 'create-lesson', lesson });
};
export const assignHubLesson = (assignment: {
  lessonId: string;
  classId: string;
  studentIds?: string[];
  dueDate: string;
}): Promise<HubAssignment> => {
  requireOnline();
  return invokeBackend('learning-hub', { action: 'assign', ...assignment });
};
export async function completeHubReading(
  lessonId: string,
  assignmentId?: string,
  owner?: string,
  studentId?: string,
): Promise<HubReading & { pending?: boolean }> {
  if (!owner || !studentId) {
    requireOnline();
    return invokeBackend('learning-hub', { action: 'complete-reading', lessonId, assignmentId });
  }
  const reading = {
    id: JSON.stringify([studentId, lessonId, assignmentId ?? null]),
    owner,
    studentId,
    lessonId,
    assignmentId: assignmentId ?? null,
    createdAt: new Date().toISOString(),
  };
  await retainReading(reading);
  try {
    const confirmed = await invokeForOwner(owner, {
      action: 'complete-reading',
      lessonId,
      assignmentId,
    });
    await acknowledgeReading(owner, reading.id, confirmed);
    return confirmed;
  } catch {
    return { ...reading, pending: true };
  }
}
export const submitHubPractice = (
  lessonId: string,
  answers: number[],
  assignmentId?: string,
): Promise<HubPracticeResult> => {
  requireOnline();
  return invokeBackend('learning-hub', {
    action: 'submit-practice',
    lessonId,
    answers,
    assignmentId,
  });
};
