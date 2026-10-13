import { authenticate, json } from '../_shared/http.ts';
import {
  reportRemarkScores,
  reportRemarkInstructions,
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
      typeof input.studentId !== 'string' ||
      input.studentId.length > 150 ||
      ![1, 2, 3].includes(input.term) ||
      Object.keys(input).some((key) => !['studentId', 'term'].includes(key))
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
    const key = Deno.env.get('OPENAI_API_KEY');
    if (!key)
      return json({ error: 'AI remarks are not configured. Contact the administrator.' }, 503);
    const limit = await client.rpc('reserve_report_remark', { actor: profile.id });
    if (limit.error) throw limit.error;
    if (!limit.data)
      return json({ error: 'AI request limit reached. Please try again later.' }, 429);
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        store: false,
        max_output_tokens: 250,
        instructions: reportRemarkInstructions,
        input: JSON.stringify({ scores }),
      }),
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => null);
      const quota = failure?.error?.code === 'insufficient_quota';
      console.warn('AI provider rejected request', {
        status: response.status,
        code:
          typeof failure?.error?.code === 'string' && /^[a-z_0-9]{1,80}$/i.test(failure.error.code)
            ? failure.error.code
            : 'unavailable',
      });
      return json(
        {
          error: quota
            ? 'OpenAI billing quota is unavailable. The administrator must add API credit or increase the OpenAI project budget.'
            : response.status === 429
              ? 'The AI service has reached its usage limit. Please try again later.'
              : 'The AI service is unavailable. Please try later or enter a remark manually.',
          code: quota
            ? 'AI_QUOTA_UNAVAILABLE'
            : response.status === 429
              ? 'AI_RATE_LIMITED'
              : 'AI_UNAVAILABLE',
        },
        503,
      );
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
