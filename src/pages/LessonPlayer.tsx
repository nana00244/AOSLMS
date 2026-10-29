import { useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Target,
  ExternalLink,
  Lightbulb,
  Trophy,
} from 'lucide-react';
import { Button } from '../components/ui';
import { completeHubReading, startHubPractice, submitHubSession } from '../learningHub/api';
import {
  assessmentLessons,
  drawQuestions,
  gradeSession,
  setSizes,
  type PracticeKind,
} from '../learningHub/questionBank';
import { learningStatus, recommendation } from '../learningHub/progress';
import type { HubLesson } from '../learningHub/catalog';
import type {
  HubSnapshot,
  LearningLesson,
  HubPracticeResult,
  PracticeSession,
} from '../learningHub/types';
const names: Record<PracticeKind, string> = {
  practice: 'Practice',
  quiz: 'Quiz',
  'unit-test': 'Unit Test',
};
export function LessonPlayer({
  lesson,
  assignmentId,
  snapshot,
  studentId,
  staff,
  onBack,
  onAssign,
  onSaved,
}: {
  lesson: LearningLesson;
  assignmentId?: string;
  snapshot: HubSnapshot;
  studentId: string;
  staff: boolean;
  onBack: () => void;
  onAssign: () => void;
  onSaved: () => Promise<void>;
}) {
  const [kind, setKind] = useState<PracticeKind | null>(null),
    [session, setSession] = useState<PracticeSession | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [answers, setAnswers] = useState<number[]>([]),
    [result, setResult] = useState<HubPracticeResult | null>(null);
  const request = useRef<{ id: string; kind: PracticeKind } | null>(null);
  const preview = useRef<ReturnType<typeof drawQuestions>>([]);
  const status = learningStatus(snapshot, studentId, lesson.id, assignmentId);
  const available = (assessment: PracticeKind) =>
    assessmentLessons(lesson as HubLesson, snapshot.lessons as HubLesson[], assessment).reduce(
      (count, item) => count + item.questions.length,
      0,
    ) >= setSizes[assessment];
  async function start(next: PracticeKind, fresh = false) {
    if (busy || !available(next)) return;
    if (
      !request.current ||
      request.current.kind !== next ||
      (fresh && session?.id === request.current.id)
    )
      request.current = { id: crypto.randomUUID(), kind: next };
    const requested = request.current!;
    setBusy(true);
    setError('');
    try {
      let created: PracticeSession;
      if (staff) {
        preview.current = drawQuestions(
          lesson as HubLesson,
          snapshot.lessons as HubLesson[],
          next,
          [],
        );
        created = {
          id: requested.id,
          kind: next,
          lessonId: lesson.id,
          assignmentId: assignmentId || null,
          expiresAt: '',
          questions: preview.current,
        };
      } else created = await startHubPractice(lesson.id, next, requested.id, assignmentId);
      request.current = null;
      setSession(created);
      setKind(next);
      setAnswers([]);
      setResult(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start practice. Try again.');
    } finally {
      setBusy(false);
    }
  }
  async function markRead() {
    setBusy(true);
    setError('');
    try {
      await completeHubReading(lesson.id, assignmentId);
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save reading progress.');
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (!session || busy) return;
    setBusy(true);
    setError('');
    try {
      if (staff) {
        const graded = gradeSession(preview.current, answers);
        setResult({
          attempt: {
            id: 'preview',
            lessonId: lesson.id,
            studentId: 'preview',
            assignmentId: null,
            kind: session.kind,
            createdAt: new Date().toISOString(),
            ...graded,
          },
          feedback: graded.feedback,
        });
      } else {
        setResult(await submitHubSession(lesson.id, session.id, answers, assignmentId));
        await onSaved();
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Your answers could not be saved. Retry submission.',
      );
    } finally {
      setBusy(false);
    }
  }
  function returnToLesson() {
    setKind(null);
    setError('');
  }
  return (
    <section className="lh-lesson-page">
      <button className="lh-back" onClick={onBack}>
        <ArrowLeft size={17} /> Back to {assignmentId ? 'assignments' : 'courses'}
      </button>
      <div className="lh-lesson-layout">
        <aside className="lh-outline">
          <span className="lh-eyebrow">
            {lesson.level} · {lesson.subject}
          </span>
          <h3>{lesson.strand}</h3>
          <button className={!kind ? 'active' : ''} onClick={returnToLesson}>
            <BookOpen size={18} /> Read lesson {status.read && <CheckCircle2 size={16} />}
          </button>
          {(['practice', 'quiz', 'unit-test'] as PracticeKind[]).map((k) => (
            <button
              key={k}
              disabled={busy || !available(k)}
              title={available(k) ? undefined : 'This question bank is still being prepared.'}
              className={kind === k ? 'active' : ''}
              onClick={() => void start(k, true)}
            >
              <Target size={18} /> {names[k]} ({setSizes[k]} problems)
            </button>
          ))}
          <div className="lh-standard">
            <strong>Curriculum standard</strong>
            <p>{lesson.standard}</p>
            <a href={lesson.sourceUrl} target="_blank" rel="noreferrer">
              {lesson.sourceTitle} <ExternalLink size={13} />
            </a>
            <p>
              Quiz: this strand, up to this lesson.
              <br />
              Unit test: this subject and level.
            </p>
            <strong>{status.label}</strong>
          </div>
        </aside>
        <article className="lh-article">
          <div className="lh-article-heading">
            <span className="lh-eyebrow">
              {kind ? `${names[kind]} · ${setSizes[kind]} QUESTIONS` : 'UNDERSTAND THE IDEA'}
            </span>
            {staff && <Button onClick={onAssign}>Assign lesson</Button>}
          </div>
          <h2>{lesson.title}</h2>
          <p className="lh-intro">{lesson.description}</p>
          {!available('practice') && (
            <p className="lh-notice">
              This lesson is available to read. Its four-question practice bank is still being
              prepared.
            </p>
          )}
          {error && (
            <div role="alert" className="lh-error">
              {error}
            </div>
          )}
          {busy && (
            <p role="status">{kind ? 'Saving your work…' : 'Preparing your learning activity…'}</p>
          )}
          {!kind ? (
            <>
              <div className="lh-reading">
                {lesson.body.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
              <aside className="lh-tip">
                <Lightbulb size={22} />
                <p>
                  Explain the idea in your own words and work through an example on paper. Practice
                  brings back mistakes for review and chooses fresh questions as you learn.
                </p>
              </aside>
              <div className="lh-actions">
                {!staff && (
                  <Button
                    variant="secondary"
                    disabled={busy || status.read}
                    onClick={() => void markRead()}
                  >
                    {status.read ? 'Reading saved' : 'Mark as read'}
                  </Button>
                )}
                <Button
                  disabled={busy || !available('practice')}
                  onClick={() => void start('practice', true)}
                >
                  Start practice <ArrowRight size={17} />
                </Button>
              </div>
            </>
          ) : (
            <>
              {staff && (
                <p className="lh-notice">
                  Teacher preview. These answers will not be saved to a learner’s record.
                </p>
              )}
              {session?.questions.map((q, i) => (
                <fieldset className="lh-question" key={q.id}>
                  <legend>
                    <span>{i + 1}</span> {q.prompt}
                  </legend>
                  {kind !== 'practice' && (
                    <small>{snapshot.lessons.find((l) => l.id === q.lessonId)?.title}</small>
                  )}
                  {q.options.map((o, n) => (
                    <label
                      key={n}
                      className={`${answers[i] === n ? 'selected' : ''} ${result?.feedback[i]?.answer === n ? 'correct' : ''}`}
                    >
                      <input
                        type="radio"
                        name={`answer-${i}`}
                        aria-label={o}
                        checked={answers[i] === n}
                        disabled={!!result || busy}
                        onChange={() =>
                          setAnswers((a) => {
                            const v = [...a];
                            v[i] = n;
                            return v;
                          })
                        }
                      />
                      <span>{String.fromCharCode(65 + n)}</span>
                      {o}
                    </label>
                  ))}
                  {result && (
                    <p
                      className={`lh-feedback ${result.feedback[i]?.correct ? 'correct' : 'incorrect'}`}
                    >
                      {result.feedback[i]?.correct ? 'Correct. ' : 'Review this idea. '}
                      {result.feedback[i]?.explanation}
                    </p>
                  )}
                </fieldset>
              ))}
              {result ? (
                <div
                  className={`lh-result ${result.mastery?.upgraded ? 'lh-celebration' : ''}`}
                  role="status"
                >
                  {result.mastery?.upgraded && <Trophy size={38} />}
                  <h3>
                    {result.attempt.correct} of {result.attempt.total} correct ·{' '}
                    {result.attempt.score}%
                  </h3>
                  {result.mastery && (
                    <h3>
                      {result.mastery.upgraded
                        ? `Level up to ${result.mastery.after}!`
                        : `Mastery: ${result.mastery.after}`}
                    </h3>
                  )}
                  <p>{recommendation(result.attempt.score, status.read)}</p>
                  <p>
                    Missed questions are queued for recovery. New questions are prioritised before
                    successful questions repeat.
                  </p>
                  <div className="lh-actions">
                    <Button disabled={busy} onClick={() => void start(kind, true)}>
                      {kind === 'practice'
                        ? 'Practise again (fresh 4 questions)'
                        : `Retake ${names[kind].toLowerCase()}`}
                    </Button>
                    <Button variant="secondary" onClick={returnToLesson}>
                      Return to lesson
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  disabled={
                    busy || !session || session.questions.some((_, i) => answers[i] === undefined)
                  }
                  onClick={() => void submit()}
                >
                  Submit answers
                </Button>
              )}
            </>
          )}
        </article>
      </div>
    </section>
  );
}
