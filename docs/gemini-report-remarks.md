# Gemini report remarks

Report drafts use Gemini 3.5 Flash-Lite through Google's generateContent API,
with minimal thinking, a 512-token output cap and a 30-second timeout.
Only authorized subject names and saved scores are sent. Teachers review the
result before saving. Incomplete, blocked, empty or oversized replies are rejected.

Configure GEMINI_API_KEY in Supabase Edge Function secrets, never in frontend
variables or Git. OpenAI and DeepSeek keys are not used by this function.
The frontend sends provider: gemini so mismatched deployments fail before sending
scores to an unexpected provider. Refresh older browser tabs after deployment.

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
