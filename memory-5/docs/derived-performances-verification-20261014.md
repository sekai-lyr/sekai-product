# Five derived performances — 2026-10-14

Added 星轨、折页、镜海、对白、聚散 to the shared catalog and backend allowlist (23 modes total). Existing login, library and playlist layouts are unchanged. Rendering and settings are in `static/js/derived-performances.js`; original Folia renderers remain unchanged.

All five use audio time, grapheme segmentation, measured line wrapping and adaptive font sizing. Each has local settings for size, movement, background density and color. These are original Canvas performances, not claims of upstream Folia equivalence or pixel-perfect reproductions.

## Verification

- Release package: `D:/dsh-render/release-20261014-122618/app.jar`.
- Package SHA256: `c0bd4b02f65b8cd18a4f1035bd4fee9a39c1726dc144438af03e38efff692466`.
- Maven: 32 tests passed, including database integration tests.
- Browser fixture: seven timestamped lines, long Chinese text, Japanese, English spaces, combining marks, family emoji and a 0.3-second line.
- 1440, 768 and 375 pixel viewports: all five modes loaded, settings exposed, catalog contained 23 entries, forward/backward seeks selected expected lines, no JavaScript errors.
- 375 and 768 pixel runs additionally compare canvas images: returning to the same audio time reproduces identical pixels; advancing audio time changes the image.
- Reports/screenshots: `D:/dsh-render/qa-derived-polish-20261014-{1440,768,375}`.
- Known unrelated network warning: `/favicon.ico` returned 404.

## Limits

Synthetic silent audio verifies timeline mapping, not alignment of real lyrics to singing. Ordinary line-timed LRC cannot provide true word-level timing. Visual parity with prior performances has no approved baseline; do not claim 100% visual parity. Accessibility and performance on low-end user hardware have not been fully audited.

Deployment uses the existing backup/rollback script, preserves account/song/local-binding records and keeps public HTTP closed during filing. Check the execution result before claiming deployment success.
