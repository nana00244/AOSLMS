import { authenticate, json } from '../_shared/http.ts';
import {
  reportRemarkScores,
  geminiRemarkRequest,
  geminiRemarkError,
  extractReportRemark,
} from '../../../src/reportRemarks.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return json({});
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let session;
  try {
    session = await authenticate(request);
  } catch {
    return json({ error: 'Sign in with an active staff account.' }, 401);
  }
  const { client, profile } = session;
  if (!['Administrator', 'Teacher'].includes(profile.role))
    return json({ error: 'Staff access required.' }, 403);
  try {
    const reader = request.body?.getReader();
    if (!reader) return json({ error: 'Invalid request.' }, 400);
    let raw = '';
    let bytes = 0;
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 1024) {
        await reader.cancel();
        return json({ error: 'Request too large.' }, 413);
      }
      raw += decoder.decode(value, { stream: true });
    }
    let input;
    try {
      input = JSON.parse(raw + decoder.decode());
    } catch {
      return json({ error: 'Invalid request.' }, 400);
    }
    if (
      !input ||
      input.provider !== 'gemini' ||
      typeof input.studentId !== 'string' ||
      input.studentId.length > 150 ||
      ![1, 2, 3].includes(input.term) ||
      Object.keys(input).some((key) => !['studentId', 'term', 'provider'].includes(key))
    )
      return json({ error: 'Invalid report selection.' }, 400);
    const { data: stored, error } = await client
      .from('school_workspace')
      .select('document')
      .eq('id', true)
      .single();
    if (error) throw error;
    let scores;
    try {
      scores = reportRemarkScores(
        stored.document,
        {
          id: profile.id,
          name: '',
          email: '',
          role: profile.role,
          active: profile.active,
          classes: profile.classes || [],
          classAllowedSubjects: profile.class_allowed_subjects,
        },
        input.studentId,
        input.term,
      );
    } catch (error) {
      return json({ error: (error as Error).message }, 403);
    }
    const key = Deno.env.get('GEMINI_API_KEY');
    if (!key)
      return json({ error: 'AI remarks are not configured. Contact the administrator.' }, 503);
    const limit = await client.rpc('reserve_report_remark', { actor: profile.id });
    if (limit.error) throw limit.error;
    if (!limit.data)
      return json({ error: 'AI request limit reached. Please try again later.' }, 429);
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',
      {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify(geminiRemarkRequest(scores)),
      },
    );
    if (!response.ok) {
      const failure = await response.json().catch(() => null);
      console.warn('Gemini rejected request', {
        status: response.status,
        code:
          typeof failure?.error?.code === 'string' && /^[a-z_0-9]{1,80}$/i.test(failure.error.code)
            ? failure.error.code
            : 'unavailable',
      });
      return json(geminiRemarkError(response.status), 503);
    }
    const remark = extractReportRemark(await response.json());
    return json({ remark, scores });
  } catch {
    return json(
      { error: 'Unable to generate a remark. Please try again or enter one manually.' },
      503,
    );
  }
});
