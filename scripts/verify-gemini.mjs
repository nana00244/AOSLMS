import { geminiRemarkRequest, extractReportRemark } from '../src/reportRemarks.ts';
import { mkdirSync, writeFileSync } from 'node:fs';

// Live provider smoke test. Synthetic scores only; never print or retain credentials.
if (!process.env.GEMINI_API_KEY) throw new Error('Set GEMINI_API_KEY in the process environment.');
const body = geminiRemarkRequest([
  { subject: 'Mathematics', sba: 38, exam: 40, total: 78 },
  { subject: 'English Language', sba: 27, exam: 29, total: 56 },
]);
const url =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent';
const start = new Date();
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'x-goog-api-key': process.env.GEMINI_API_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(30000),
});
const text = await response.text();
const elapsed = Date.now() - start.getTime();
// Retained actual transaction, with all authentication headers omitted.
mkdirSync('.temp', { recursive: true });
writeFileSync(
  '.temp/gemini-smoke.har',
  JSON.stringify({
    log: {
      version: '1.2',
      creator: { name: 'AOS provider smoke test', version: '1' },
      entries: [
        {
          startedDateTime: start.toISOString(),
          time: elapsed,
          request: {
            method: 'POST',
            url,
            httpVersion: 'HTTP/1.1',
            headers: [],
            queryString: [],
            cookies: [],
            headersSize: -1,
            bodySize: -1,
            postData: { mimeType: 'application/json', text: JSON.stringify(body) },
          },
          response: {
            status: response.status,
            statusText: response.statusText,
            httpVersion: 'HTTP/1.1',
            headers: [],
            cookies: [],
            content: { size: Buffer.byteLength(text), mimeType: 'application/json', text },
            redirectURL: '',
            headersSize: -1,
            bodySize: Buffer.byteLength(text),
          },
          cache: {},
          timings: { send: 0, wait: elapsed, receive: 0 },
        },
      ],
    },
  }),
);
if (!response.ok) {
  console.error(JSON.stringify({ status: response.status, code: JSON.parse(text)?.error?.code }));
  process.exitCode = 1;
} else {
  const remark = extractReportRemark(JSON.parse(text));
  console.log(JSON.stringify({ status: response.status, elapsedMs: elapsed, remark }));
}
