# Morning Star Catch release playtest

- Production build tested at 1280 × 720 in the in-app browser using the simulated pointer provider.
- Completed all three authored beats without rebuilding: held the pointer over one star in each scene until its dwell ring completed.
- Confirmed continuous feedback in the gameplay capture: 1/3 aggregate progress, first-star reaction, trail, filled star, and current 1/1 scene objective.
- Confirmed the third capture advances to the terminal state with 3/3 aggregate progress and the localized “Constellation complete” celebration.
- Simulator mode renders the bundled same-origin night artwork beneath interactive stars and HUD; camera mode remains a direct, mirrored, cover-fit video layer.
- Korean copy was exercised in the captured run. English copy, reduced-motion behavior, pack validity, and intentionally invalid fixtures are covered by the automated release gates.
- No camera permission, account, remote runtime CDN, analytics, or network-transmitted frames were required for this simulator playtest.

## Shared platform shell QA

- Desktop evidence was captured at 1280 × 720. The Manse wordmark and localized Showcase return action remain on one 68px line, and `scrollWidth` equals `innerWidth` at 1280.
- Mobile evidence is deterministic rather than synthesized: the route contract verifies the 390 × 844 layout rules use a 64px shell, a viewport width minus 24px inner row, `min-width: 0`, clipped row overflow, and a non-wrapping return action.
- Both navigation links resolve exactly to `https://manse-showcase.ran584000.chatgpt.site`; visible focus and pressed states are defined, and reduced-motion preference removes transitions.
