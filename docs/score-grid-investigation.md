# Score grid and touchpad navigation

REA inspected the existing local `dist` JavaScript bundle on 2026-10-27.
Parent evidence: `ev_1e7f156f080141552b1b25ce6f9356dac8410211533be061a768f394d86542e4`.
Artifact SHA-256: `5c8b6dfb5432a13ef0ec3f46f210b99ff74e4588a1640b84bbb6d8d14867534e`.
The analysis parsed two JavaScript files but exhausted its semantic worker heap;
coverage is partial and does not establish runtime gesture behavior.

Source inspection found three stacked controls per score cell and no horizontal
overscroll policy. The browser's boundary navigation is the likely cause of the
reported two-finger back gesture. The fix uses `overscroll-behavior-x: none` on
the document and scroll surfaces, with containment on the grading grid. Normal
horizontal/vertical scrolling and explicit navigation remain available.
See [MDN overscroll behavior](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overscroll-behavior).
OS-level gestures and browsers that do not honor this policy cannot be locked
by webpage CSS; a physical touchpad gesture was not reproduced by automation.

The score grid uses compact rows, pinned student identities and headers, and
expandable feedback with colored status tags. Hidden filtered rows stay mounted
to preserve edits and form submission values. Existing theme selection is respected.

Verification: production build, unit suite, and Edge browser regression using
synthetic students and mocked network responses. The browser check covers eight
visible students at 1440×900, horizontal scrolling at boundaries, search/edit
retention, zero-score and feedback persistence, and narrow-screen containment.
Screenshots are generated under `test-results/compact-score-grid*.png`.
