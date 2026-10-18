# Gemini report remarks

Verified 18 October 2026: Dahl accepted the key with 100,000,000 available tokens.
The direct DeepSeek probe reported model concurrency capacity. The secret and
DeepSeek-first function were deployed; authenticated browser verification generated
a real Gemini fallback draft and passed review, save and reload using fictional
pupil data. Temporary fixtures and the test administrator were removed. All 16
focused tests and the production build passed. Successful live DeepSeek generation
has not yet been observed; its success path is covered by a mocked endpoint test.

Report drafts first try DeepSeek V4 Flash (`deepseek-ai/DeepSeek-V4-Flash-0731`)
through Dahl's chat completions API, with a 20-second timeout and 2,048-token cap.
HTTP failures, timeouts, malformed, incomplete, empty or oversized responses fall
back to Gemini. A successful DeepSeek draft never calls Gemini. Both attempts
share one staff request-limit reservation. No draft is saved automatically.

The fallback uses Gemini 3.5 Flash-Lite through Google's generateContent API,
with minimal thinking, a 512-token output cap and a 30-second timeout.
Only authorized subject names and saved scores are sent. Teachers review the
result before saving. Incomplete, blocked, empty or oversized replies are rejected.

Configure DAHL_API_KEY and GEMINI_API_KEY in Supabase Edge Function secrets, never
in frontend variables or Git. The legacy frontend provider: gemini field remains
accepted for compatibility; provider priority is controlled on the server.
Only canonical subject names and scores reach either provider, never pupil names
or IDs. The response identifies the provider that generated the draft.

Run node scripts/verify-gemini.mjs with GEMINI_API_KEY in the process environment
for a synthetic-only provider test. The credential-free HAR is retained under
ignored .temp/ for REA inspection.

Verified 15 October 2026: live synthetic generation returned HTTP 200 with a
complete teacher remark in 4.27 seconds. Gemini 2.5 Flash-Lite rejected this new
account with HTTP 404 and directed it to Gemini 3.5 Flash-Lite.
REA evidence: ev_9baba1dc332b3c9718559fdeee8ef4594478bbfbe12479cfc84c7ed188704ebd.
This evidence covers the direct provider transaction, not an authenticated browser flow.
The Gemini secret and generate-report-remark Edge Function were deployed.
60 tests passed, 2 optional tests skipped; production build passed.
Google project quotas still apply; quota failures show actionable feedback.

References:
- https://ai.google.dev/gemini-api/docs/api-key
- https://ai.google.dev/api/generate-content
