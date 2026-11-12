import type { NaccaQuestion } from '../nacca/types';

const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => {
    const replacements: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return replacements[char];
  });

function answerText(question: NaccaQuestion): string {
  if (question.type === 'mcq' && typeof question.answer === 'number') {
    const option = question.options?.[question.answer];
    return `${String.fromCharCode(65 + question.answer)}${option ? `. ${option}` : ''}`;
  }
  if (Array.isArray(question.answer)) return question.answer.join('; ');
  if (question.answer !== undefined) return String(question.answer);
  return question.rubric ? 'Use the rubric below.' : 'Teacher assessed.';
}

export function buildQuestionBankDocument(
  questions: NaccaQuestion[],
  subject: string,
  level: string,
): string {
  const questionMarkup = questions
    .map((question, index) => {
      const options = question.options?.length
        ? `<ol type="A">${question.options.map((option) => `<li>${escapeHtml(option)}</li>`).join('')}</ol>`
        : '';
      const rubric = question.rubric?.criteria?.length
        ? `<p><strong>Rubric:</strong> ${question.rubric.criteria
            .map((criterion) => `${escapeHtml(criterion.description)} (${criterion.marks} marks)`)
            .join('; ')}</p>`
        : '';
      return `<article class="question"><h2>${index + 1}. ${escapeHtml(question.stem)}</h2><p class="meta">${escapeHtml(question.indicator_code)} · ${escapeHtml(question.strand || '')} · ${escapeHtml(question.type)} · Difficulty ${question.difficulty}</p>${options}${rubric}</article>`;
    })
    .join('\n');
  const answerMarkup = questions
    .map(
      (question, index) =>
        `<li><strong>${index + 1}. ${escapeHtml(answerText(question))}</strong>${question.explanation ? `<br>${escapeHtml(question.explanation)}` : ''}</li>`,
    )
    .join('\n');

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(level)} ${escapeHtml(subject)} Question Bank</title><style>
    body{font-family:Arial,sans-serif;color:#172b4d;line-height:1.5;margin:36px}h1{font-size:24px;margin-bottom:4px}h2{font-size:16px}.subtitle{color:#52627a;margin-top:0}.question{break-inside:avoid;border-bottom:1px solid #d8e0ea;padding:12px 0}.meta{font-size:11px;color:#52627a}ol{padding-left:28px}li{padding:2px 0}.answer-key{break-before:page} @media print{body{margin:16mm}.question{break-inside:avoid}}
  </style></head><body><h1>${escapeHtml(level)} ${escapeHtml(subject)} Question Bank</h1><p class="subtitle">${questions.length} questions · Generated from the NaCCA Learning Hub question bank</p>${questionMarkup}<section class="answer-key"><h1>Teacher Answer Key</h1><ol>${answerMarkup}</ol></section></body></html>`;
}

function downloadHtmlFile(html: string, filename: string, mimeType: string) {
  const blob = new Blob([html], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function safeFilename(value: string) {
  return value
    .trim()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '');
}

export function downloadQuestionBankWord(html: string, subject: string, level: string) {
  downloadHtmlFile(
    html,
    `${safeFilename(level)}-${safeFilename(subject)}-question-bank.doc`,
    'application/msword',
  );
}

export function printQuestionBankPdf(html: string) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;
  let printed = false;
  const printOnce = () => {
    if (printed || printWindow.closed) return;
    printed = true;
    printWindow.focus();
    printWindow.print();
  };
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.addEventListener('load', printOnce, { once: true });
  window.setTimeout(printOnce, 500);
  return true;
}
