# Text and colour visibility review — 13 October 2026

Reference: https://www.khanacademy.org/ (English public homepage).

## Observed reference

REA controlled browser capture `ev_a65374d594ae003c84e133a07f40bc44589e5c7a46808e054a99e411cb12909b` inspected the loaded page after dismissing the cookie and donation overlays. DOM, accessibility text and screenshot were captured. The earlier capture `ev_06b9d9eb0344a06b8074106b58260122807683a60e48279d1dd4484790583be5` shows those overlays. These observations cover the public homepage only, not authenticated Khan Academy screens.

The rendered page uses near-black text, white surfaces, purple links/actions, a prominent heading and clearly separated role cards. A supplementary Playwright computed-style read measured:

| Element | Observed style |
| --- | --- |
| Main heading | `#151521`, 42px / 46.2px |
| Body paragraph | `#151521`, 16px / 24px |
| Role-card link | `#5753fa`, white background, 14px / 19.6px |
| Course text | `#4a4c53`, 16px / 24px |
| Font family | Plus Jakarta Sans, Noto Sans, sans-serif |

## App design choices

Keep the school's content and bundled DM Sans/Manrope fonts. Use the observed near-black and secondary text colours, with a slightly darker purple `#4b3cdb` for primary actions. Raise small interface text to 13px, navigation and controls to 14px, and introductory paragraphs to 16px. Printed document typography remains separate. Give dark mode its own pale-purple action and light text colours. Darken semantic attendance backgrounds so their white labels are readable.

This is an adaptation of the reference's hierarchy and visibility, not a copy of its marketing content, branding or illustrations.

## Verification

`scripts/verify-readability.mjs` uses intercepted synthetic login/workspace responses and the repository's seed data; it makes no changes to live school records. Start Vite on port 5175 (or set `AOS_VISUAL_URL`) and run it with Node 22.18+; `PLAYWRIGHT_CHROMIUM_EXECUTABLE` can select a browser. It checks solid-background text contrast on 14 main routes in both themes, checks horizontal page overflow at 1440, 820, 390 and 320 pixels, and saves screenshots/results under ignored `.temp/`.

The contrast calculation does not certify accessibility: gradients, images, opacity compositing, all interactive states and every role-specific screen require additional review. Desktop login/dashboard and mobile dark dashboard screenshots were also visually inspected.

The older `tests/ui.spec.ts` suite expects removed demo-role login buttons and times out at that step on the current app. The fixture-based visual check exercises the current sign-in form and authenticated layouts without restoring demo authentication.
