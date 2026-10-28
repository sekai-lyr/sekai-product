# Folia gallery verification — 2026-10-13

## Delivered in release 20261013-184130

- Existing modes 2–4 renamed; fourteen upstream built-in renderers added separately (18 total).
- Original settings panels, browser-local tuning preferences, background shaders, and local image asset adapters.
- Playback/settings layout separated; mobile queue positioning corrected.
- Fixed whitespace lyric loss, grapheme splitting, backward seeks and initial paused word notification.
- Shadow DOM transform defaults and shader canvas sizing corrected.
- Long classic/partita lines receive font-size fitting and extra row spacing.

## Evidence

- Release build: 32 tests, zero failures.
- Desktop browser: all 18 modes loaded without script/network errors; eight forward/backward lyric-index checks per mode (144 checks).
- Additional 375px checks: Luminous, Cappella, Monet. Additional 768px checks: modes 2–4 and Sonnet.
- Screenshots and JSON reports: `D:/dsh-render/qa-gallery-20261013-1440`, `-375`, `-768`.
- Cloud artifact SHA256: `bc719ab86c41db94a8d66697496197d6ce2cbed6ab4becf77ee69e3abe05b6de`.
- Cloud service active; stage catalog and gallery JS response hashes match local files.
- Previous artifact and database backed up under `/opt/sekai-backups/20261013-184130`.
- Deployment compared account/song/local-binding records: unchanged. Public HTTP remains 503 during filing.

## Remaining verification / differences

- Original cinematic renderers can intentionally move/crop text beyond viewport edges (observed in Sonnet). This is not a no-clipping acceptance pass.
- Line-timed LRC does not establish true sung-word timings. Index checks are not an audio alignment benchmark.
- Frame-by-frame pause determinism, all settings combinations, image import/reload, and every renderer on mobile are not exhaustively verified.
- URL-embedded backgrounds are not enabled; this is not the entire upstream desktop application's settings surface.
- No independent upstream pixel baseline: pixel-perfect equivalence is INCONCLUSIVE, not 100% complete.

Changes concentrate on `tools/folia`, stage scripts/styles and `player.html`, mode normalization/preferences validation and related tests. Original login/registration layouts are not redesigned.
