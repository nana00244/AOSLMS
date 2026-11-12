import { useState, useMemo, useEffect } from 'react';
import {
  Search,
  CheckCircle2,
  HelpCircle,
  Award,
  Layers,
  ChevronDown,
  ChevronUp,
  Play,
  FileText,
  AlertCircle,
  FileQuestion,
  Download,
  Printer,
} from 'lucide-react';
import { Button } from './ui';
import { naccaQuestions, naccaIndicators } from '../learningHub/naccaBank';
import type { NaccaQuestion } from '../nacca/types';
import { compareHubLevels, compareHubSubjects } from '../learningHub/displayOrder';
import {
  matchesSelectedIndicators,
  questionIndicatorKey,
} from '../learningHub/questionBankFilters';
import {
  displayQuestionBankLevel,
  summarizeQuestionBank,
} from '../learningHub/questionBankSummary';
import {
  buildQuestionBankDocument,
  downloadQuestionBankWord,
  printQuestionBankPdf,
} from '../learningHub/questionBankExport';

interface Props {
  onOpenPractice: (indicatorCode: string, subject?: string) => void;
  staff: boolean;
  onCreateAssessment?: (indicatorCode?: string, level?: string) => void;
}

export function NaccaQuestionBankView({ onOpenPractice, staff, onCreateAssessment }: Props) {
  const [search, setSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('ALL');
  const [selectedLevel, setSelectedLevel] = useState('ALL');
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('ALL');
  const [expandedHints, setExpandedHints] = useState<Record<string, boolean>>({});
  const [expandedExplanations, setExpandedExplanations] = useState<Record<string, boolean>>({});
  const [expandedRubrics, setExpandedRubrics] = useState<Record<string, boolean>>({});
  const [exportMessage, setExportMessage] = useState('');
  const bankSummary = useMemo(() => summarizeQuestionBank(naccaQuestions, naccaIndicators), []);
  const subjectOptions = bankSummary.subjects;
  const levelOptions = bankSummary.levels;
  const selectedIndicatorSet = useMemo(() => new Set(selectedIndicators), [selectedIndicators]);

  const toggleHint = (id: string) => {
    setExpandedHints((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleExplanation = (id: string) => {
    setExpandedExplanations((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleRubric = (id: string) => {
    setExpandedRubrics((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Filter indicators by subject and level
  const availableIndicators = useMemo(() => {
    return naccaIndicators.filter((i) => {
      if (selectedSubject !== 'ALL' && i.subject !== selectedSubject) return false;
      if (selectedLevel !== 'ALL' && displayQuestionBankLevel(i.level) !== selectedLevel)
        return false;
      return true;
    });
  }, [selectedSubject, selectedLevel]);

  // Filter questions
  const filtered = useMemo(() => {
    return naccaQuestions.filter((q) => {
      if (selectedSubject !== 'ALL' && q.subject !== selectedSubject) {
        return false;
      }
      if (selectedLevel !== 'ALL' && displayQuestionBankLevel(q.level) !== selectedLevel) {
        return false;
      }
      if (!matchesSelectedIndicators(q, selectedIndicatorSet)) return false;
      if (selectedType !== 'ALL' && q.type !== selectedType) {
        return false;
      }
      if (selectedDifficulty !== 'ALL' && String(q.difficulty) !== selectedDifficulty) {
        return false;
      }
      if (search.trim()) {
        const query = search.toLowerCase();
        const text =
          `${q.stem} ${q.indicator_code} ${q.skill_tag || ''} ${q.strand || ''} ${q.sub_strand || ''}`.toLowerCase();
        if (!text.includes(query)) return false;
      }
      return true;
    });
  }, [
    search,
    selectedSubject,
    selectedLevel,
    selectedIndicatorSet,
    selectedType,
    selectedDifficulty,
  ]);

  const exportQuestions = useMemo(
    () => (selectedSubject !== 'ALL' && selectedLevel !== 'ALL' ? filtered : []),
    [filtered, selectedSubject, selectedLevel],
  );

  const exportHtml = () =>
    buildQuestionBankDocument(exportQuestions, selectedSubject, selectedLevel);

  const handlePdfExport = () => {
    if (!printQuestionBankPdf(exportHtml())) {
      setExportMessage('Allow pop-ups from this site to open the printable PDF document.');
    } else {
      setExportMessage('Choose “Save as PDF” in the print dialog to download your PDF.');
    }
  };

  const [visibleCount, setVisibleCount] = useState(50);
  useEffect(() => {
    setVisibleCount(50);
  }, [filtered]);

  // Aggregate stats
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const q of naccaQuestions) {
      counts[q.type] = (counts[q.type] || 0) + 1;
    }
    return counts;
  }, []);

  const difficultyCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const q of naccaQuestions) {
      counts[q.difficulty] = (counts[q.difficulty] || 0) + 1;
    }
    return counts;
  }, []);

  const strandCounts = useMemo(() => {
    const counts = new Map<
      string,
      { subject: string; level: string; strand: string; count: number }
    >();
    for (const ind of naccaIndicators) {
      const strand = ind.strand || 'General';
      const level = displayQuestionBankLevel(ind.level);
      const key = `${ind.subject}|${level}|${strand}`;
      const row = counts.get(key);
      if (row) row.count += 1;
      else counts.set(key, { subject: ind.subject, level, strand, count: 1 });
    }
    return [...counts.values()].sort(
      (a, b) =>
        compareHubSubjects(a.subject, b.subject) ||
        compareHubLevels(a.level, b.level) ||
        a.strand.localeCompare(b.strand),
    );
  }, []);

  return (
    <div className="nacca-bank-view">
      {/* Hero / Header Banner */}
      <section className="lh-hero nacca-hero">
        <div>
          <span className="lh-eyebrow">NATIONAL CURRICULUM & ASSESSMENT (NaCCA)</span>
          <h2>
            Ghana Standards-Based
            <br />
            <em>Official Question Bank</em>
          </h2>
          <p>
            Curriculum-approved questions with teacher rubrics, pedagogical hints, worked
            explanations, and auto-scored mastery tracking for Ghana Basic Education.
          </p>
          <div className="nacca-hero-stats">
            <span className="nacca-pill">
              <strong>{bankSummary.questionCount.toLocaleString()}</strong> Questions
            </span>
            <span className="nacca-pill">
              <strong>{bankSummary.indicatorCount.toLocaleString()}</strong> Indicators
            </span>
            <span className="nacca-pill">
              <strong>Levels</strong> {bankSummary.levels.join(', ')}
            </span>
            <span className="nacca-pill">
              <strong>Subjects</strong> {bankSummary.subjects.join(', ')}
            </span>
          </div>
        </div>
      </section>

      {/* KPI Cards */}
      <div className="nacca-summary-cards">
        <div className="nacca-card">
          <div className="nacca-card-header">
            <Layers size={18} />
            <span>Question Types</span>
          </div>
          <div className="nacca-card-body">
            <div className="nacca-stat-row">
              <span>MCQ (Auto-marked)</span>
              <strong>{typeCounts['mcq'] || 0}</strong>
            </div>
            <div className="nacca-stat-row">
              <span>Numeric (Auto-marked)</span>
              <strong>{typeCounts['numeric'] || 0}</strong>
            </div>
            <div className="nacca-stat-row">
              <span>Short Answer (Auto-marked)</span>
              <strong>{typeCounts['short_answer'] || 0}</strong>
            </div>
            <div className="nacca-stat-row">
              <span>Teacher Assessed (Rubric)</span>
              <strong>
                {(typeCounts['written'] || 0) +
                  (typeCounts['oral'] || 0) +
                  (typeCounts['drawing'] || 0) +
                  (typeCounts['practical'] || 0) +
                  (typeCounts['role_play'] || 0)}
              </strong>
            </div>
          </div>
        </div>

        <div className="nacca-card">
          <div className="nacca-card-header">
            <Award size={18} />
            <span>Difficulty Progression</span>
          </div>
          <div className="nacca-card-body">
            <div className="nacca-stat-row">
              <span>⭐ Difficulty 1 (Foundational)</span>
              <strong>{difficultyCounts[1] || 0}</strong>
            </div>
            <div className="nacca-stat-row">
              <span>⭐⭐ Difficulty 2 (Developing)</span>
              <strong>{difficultyCounts[2] || 0}</strong>
            </div>
            <div className="nacca-stat-row">
              <span>⭐⭐⭐ Difficulty 3 (Competent)</span>
              <strong>{difficultyCounts[3] || 0}</strong>
            </div>
            <div className="nacca-stat-row">
              <span>⭐⭐⭐⭐ Difficulty 4 (Advanced)</span>
              <strong>{difficultyCounts[4] || 0}</strong>
            </div>
          </div>
        </div>

        <div className="nacca-card">
          <div className="nacca-card-header">
            <CheckCircle2 size={18} />
            <span>Curriculum Strands</span>
          </div>
          <div className="nacca-card-body">
            <div className="nacca-strand-breakdown">
              {strandCounts.map(({ subject, level, strand, count }) => (
                <div className="nacca-stat-row" key={`${subject}|${level}|${strand}`}>
                  <span>
                    {subject} · {level} — {strand}
                  </span>
                  <strong>{count} indicators</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <section className="nacca-filter-section">
        <div className="lh-section-heading">
          <div>
            <span className="lh-eyebrow">QUESTION BROWSER</span>
            <h2>Filter & Explore Questions</h2>
          </div>
          <p>
            Showing {Math.min(visibleCount, filtered.length)} of {filtered.length} matching
            questions.
          </p>
        </div>

        <div className="nacca-filters-grid">
          <label className="lh-search nacca-search-input">
            <Search size={18} />
            <input
              placeholder="Search stem, skill, indicator or concept…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>

          <select
            aria-label="Filter by subject"
            value={selectedSubject}
            onChange={(e) => {
              setSelectedSubject(e.target.value);
              setSelectedIndicators([]);
            }}
          >
            <option value="ALL">All Subjects</option>
            {subjectOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by class or level"
            value={selectedLevel}
            onChange={(e) => {
              setSelectedLevel(e.target.value);
              setSelectedIndicators([]);
            }}
          >
            <option value="ALL">All Classes / Levels</option>
            {levelOptions.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>

          <details className="nacca-indicator-picker">
            <summary aria-label="Filter by one or more indicators">
              {selectedIndicators.length
                ? `${selectedIndicators.length} indicators selected`
                : `All ${availableIndicators.length} Indicators`}
            </summary>
            <div className="nacca-indicator-options">
              <button type="button" onClick={() => setSelectedIndicators([])}>
                Clear indicator selection
              </button>
              {availableIndicators.map((ind) => {
                const key = questionIndicatorKey(ind.subject, ind.code);
                return (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={selectedIndicators.includes(key)}
                      onChange={() =>
                        setSelectedIndicators((selected) =>
                          selected.includes(key)
                            ? selected.filter((item) => item !== key)
                            : [...selected, key],
                        )
                      }
                    />
                    <span>
                      [{ind.subject}] {displayQuestionBankLevel(ind.level)}: {ind.code} -{' '}
                      {ind.sub_strand.slice(0, 30)}
                    </span>
                  </label>
                );
              })}
            </div>
          </details>

          <select
            aria-label="Filter by type"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            <option value="ALL">All Question Types</option>
            <option value="mcq">MCQ (Multiple Choice)</option>
            <option value="numeric">Numeric Answer</option>
            <option value="short_answer">Short Answer</option>
            <option value="written">Written Task</option>
            <option value="drawing">Drawing Task</option>
            <option value="practical">Practical Task</option>
            <option value="role_play">Role Play Task</option>
            <option value="oral">Oral Task</option>
          </select>

          <select
            aria-label="Filter by difficulty"
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
          >
            <option value="ALL">All Difficulties (1 to 4)</option>
            <option value="1">Difficulty 1 (Foundational)</option>
            <option value="2">Difficulty 2 (Developing)</option>
            <option value="3">Difficulty 3 (Competent)</option>
            <option value="4">Difficulty 4 (Advanced)</option>
          </select>
        </div>
        {staff && (
          <div className="nacca-export-panel">
            <div>
              <strong>Download a class question set</strong>
              <p>
                Select a class and subject above; all active filters are applied to the export.
                {selectedSubject !== 'ALL' && selectedLevel !== 'ALL'
                  ? ` ${exportQuestions.length.toLocaleString()} questions match the current filters.`
                  : ''}
              </p>
              {exportMessage && <small role="status">{exportMessage}</small>}
            </div>
            <div className="nacca-export-actions">
              <Button
                type="button"
                variant="secondary"
                disabled={!exportQuestions.length}
                onClick={() =>
                  downloadQuestionBankWord(exportHtml(), selectedSubject, selectedLevel)
                }
              >
                <Download size={15} /> Download Word
              </Button>
              <Button type="button" disabled={!exportQuestions.length} onClick={handlePdfExport}>
                <Printer size={15} /> Save as PDF
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Questions List */}
      <div className="nacca-questions-container">
        {filtered.length === 0 ? (
          <div className="nacca-empty-state">
            <AlertCircle size={36} />
            <h3>No questions found</h3>
            <p>Try clearing your search query or choosing "All Question Types".</p>
            <Button
              variant="secondary"
              onClick={() => {
                setSearch('');
                setSelectedIndicators([]);
                setSelectedType('ALL');
                setSelectedDifficulty('ALL');
              }}
            >
              Reset Filters
            </Button>
          </div>
        ) : (
          filtered.slice(0, visibleCount).map((q, idx) => {
            const lessonId = `nacca-${q.indicator_code.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
            const isMcq = q.type === 'mcq';
            const isNumeric = q.type === 'numeric';
            const isShortAnswer = q.type === 'short_answer';
            const isTeacherMarked = !isMcq && !isNumeric && !isShortAnswer;

            return (
              <article key={q.id || idx} className="nacca-question-card">
                <header className="nacca-card-top">
                  <div className="nacca-badges">
                    <span className="nacca-badge nacca-badge-code">{q.indicator_code}</span>
                    <span className="nacca-badge nacca-badge-strand">
                      {q.strand} · {q.sub_strand}
                    </span>
                    <span className="nacca-badge nacca-badge-type">
                      {q.type.toUpperCase()}
                      {isTeacherMarked ? ' (Teacher Assessed)' : ' (Auto-marked)'}
                    </span>
                  </div>
                  <div className="nacca-difficulty">
                    <span title={`Difficulty ${q.difficulty} of 4`}>
                      {'★'.repeat(q.difficulty)}
                      {'☆'.repeat(4 - q.difficulty)}
                    </span>
                    <small>Level {q.difficulty}</small>
                  </div>
                </header>

                <div className="nacca-card-main">
                  <h3 className="nacca-stem">{q.stem}</h3>

                  {/* MCQ Options preview */}
                  {isMcq && q.options && (
                    <div className="nacca-options-grid">
                      {q.options.map((opt, oIdx) => (
                        <div
                          key={oIdx}
                          className={`nacca-option-preview ${
                            staff && oIdx === q.answer ? 'nacca-option-correct' : ''
                          }`}
                        >
                          <span className="nacca-opt-letter">{String.fromCharCode(65 + oIdx)}</span>
                          <span className="nacca-opt-text">{opt}</span>
                          {staff && oIdx === q.answer && (
                            <span className="nacca-correct-tag">Correct Answer</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Numeric question notice */}
                  {isNumeric && (
                    <div className="nacca-input-preview">
                      <span className="nacca-input-label">Numeric Entry:</span>
                      <code>[ Number Input ]</code>
                      {staff && (
                        <span className="nacca-staff-answer">
                          Answer: <strong>{String(q.answer)}</strong>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Short answer notice */}
                  {isShortAnswer && (
                    <div className="nacca-input-preview">
                      <span className="nacca-input-label">Short Answer:</span>
                      <code>[ Text Entry ]</code>
                      {staff && (
                        <span className="nacca-staff-answer">
                          Accepted:{' '}
                          <strong>
                            {Array.isArray(q.answer) ? q.answer.join(', ') : String(q.answer)}
                          </strong>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Teacher-marked task banner */}
                  {isTeacherMarked && (
                    <div className="nacca-teacher-task-banner">
                      <FileText size={16} />
                      <span>
                        Teacher-marked task ({q.type}). Evaluated against rubric criteria.
                      </span>
                    </div>
                  )}

                  {/* Collapsible Rubric */}
                  {q.rubric?.criteria && (
                    <div className="nacca-collapsible">
                      <button
                        type="button"
                        className="nacca-toggle-btn"
                        onClick={() => toggleRubric(q.id)}
                      >
                        <Award size={15} />
                        <span>Teacher Marking Rubric ({q.rubric.criteria.length} criteria)</span>
                        {expandedRubrics[q.id] ? (
                          <ChevronUp size={15} />
                        ) : (
                          <ChevronDown size={15} />
                        )}
                      </button>
                      {expandedRubrics[q.id] && (
                        <div className="nacca-collapsed-content nacca-rubric-box">
                          <ul>
                            {q.rubric.criteria.map((c, cIdx) => (
                              <li key={cIdx}>
                                <span>{c.description}</span>
                                <strong>
                                  {c.marks} mark{c.marks !== 1 ? 's' : ''}
                                </strong>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Collapsible Hints */}
                  {q.hints && q.hints.length > 0 && (
                    <div className="nacca-collapsible">
                      <button
                        type="button"
                        className="nacca-toggle-btn"
                        onClick={() => toggleHint(q.id)}
                      >
                        <HelpCircle size={15} />
                        <span>Pedagogical Hints ({q.hints.length})</span>
                        {expandedHints[q.id] ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                      {expandedHints[q.id] && (
                        <div className="nacca-collapsed-content nacca-hint-box">
                          {q.hints.map((h, hIdx) => (
                            <p key={hIdx}>💡 {h}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Collapsible Explanation (visible for staff or expanded) */}
                  {q.explanation && (
                    <div className="nacca-collapsible">
                      <button
                        type="button"
                        className="nacca-toggle-btn"
                        onClick={() => toggleExplanation(q.id)}
                      >
                        <CheckCircle2 size={15} />
                        <span>Worked Explanation & Solution</span>
                        {expandedExplanations[q.id] ? (
                          <ChevronUp size={15} />
                        ) : (
                          <ChevronDown size={15} />
                        )}
                      </button>
                      {expandedExplanations[q.id] && (
                        <div className="nacca-collapsed-content nacca-explanation-box">
                          <p>{q.explanation}</p>
                          {q.misconception && (
                            <p className="nacca-misconception">
                              ⚠️ <strong>Known Learner Misconception:</strong> {q.misconception}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <footer className="nacca-card-footer">
                  <span className="nacca-skill-tag">
                    Skill: <strong>{q.skill_tag || 'Standard application'}</strong>
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {onCreateAssessment && staff && (
                      <Button
                        variant="secondary"
                        onClick={() => onCreateAssessment(q.indicator_code, q.level)}
                        title={`Create Quiz or Unit Test for indicator ${q.indicator_code}`}
                      >
                        <FileQuestion size={14} /> Create Test
                      </Button>
                    )}
                    <Button
                      onClick={() => onOpenPractice(q.indicator_code, q.subject)}
                      title={`Practise indicator ${q.indicator_code}`}
                    >
                      <Play size={14} /> Practise Indicator {q.indicator_code}
                    </Button>
                  </div>
                </footer>
              </article>
            );
          })
        )}
      </div>
      {visibleCount < filtered.length && (
        <Button onClick={() => setVisibleCount((count) => count + 50)}>Show more questions</Button>
      )}
    </div>
  );
}
