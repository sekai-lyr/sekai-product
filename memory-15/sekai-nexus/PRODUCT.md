# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The owner (the developer of the Sekai project family), alone on their own machine, starting the day's work or revisiting past worlds. Personal memory hub, not a public showcase. Visitor framing stays intimate and solemn; local paths and service ports may appear because the audience is the owner.

## Product Purpose

One page that gathers the owner's 14 real "memory worlds" (projects under `B:\Sekai\Sekai\sekai\memory-1..8` and `D:\Sekai_two\memory-9..14\…`) behind 14 doors of a single fantasy memory hall. Success: the owner recognizes the hall at first glance, selects any of the 14 worlds, and enters the door — opening its local web service or reading its archive for desktop-native projects.

## Positioning

A memory corridor, not a project list: each project is a world behind its own numbered gate; entering is a ritual (selection → camera approach → door opens → light bloom), not a link click. Real local services stay one door away (http://localhost:8081…8094 for web worlds; Godot / Ren'Py projects live in their source directories).

## Operating Context

Runs on the owner's Windows machine with local services optionally running; doors 01–10, 12, 14 are web services with `entryUrl`, doors 11 (Godot card duel game) and 13 (Ren'Py visual novel) are desktop-native with no URL. 中文 is the default UI language; an EN toggle exists. Keyboard: ←/→ select, Enter opens. Motion must respect `prefers-reduced-motion`.

## Capabilities and Constraints

- Vue 3 + TypeScript + Vite + GSAP only; Three.js is out of scope for now.
- `npm run build` (vue-tsc + vite) must pass.
- All 14 manifest entries render from `src/data/door-manifest.json` via `v-for`; no `doors[0]` hardcoding; selection state + per-door name/description/number update live.
- Each manifest entry keeps its real project fields: `id`, `projectNumber`, `memory`, `name`, `description`, `sourceRoot`, `projectPath`, `entryKind` (web/godot/renpy), `entryUrl`, `color`, `side`, `z`. The old `testUrl` route page is deleted; no test-page jumps.
- No Genshin/HoYoverse assets, logos, or copied UI. No external raster dependence: the scene is procedural (CSS gradients/layers) — the old `public/world-entry.png` backdrop is replaced.
- Interface language may be 中文 or EN; copy for both lives in the component.
- Breakpoints must be clean at 390×844 and 412×915 (no clipping), plus desktop wide.
- Explicitly undecided: nothing material; non-URL doors open a local-project archive view instead of navigating (confirmed).

## Brand Commitments

- Brand name stays "SEKAI NEXUS" (wordmark restyled to the new world, not the sci-fi HUD look).
- Main title in 中文 by default: 「十四扇门，一座记忆长廊。」
- Client-pinned design direction (fantasy memory hall): deep blue-grey scene, cold mist, warm gold light inside doors, white title; cyan reserved for selection state and light auxiliary info; no HUD grids/diagonal-line noise; high-end game entry spatial hierarchy and camera language (borrowed, never copied assets).

## Evidence on Hand

Real manifest data in `src/data/door-manifest.json` (14 entries with real paths/URLs/ports). All content on page is real project copy. No imagery is required; the scene is drawn procedurally.

## Product Principles

1. The hall reads first: 14 doors as one receding corridor before any text is read.
2. Selection is exploration; entering is a ritual — never a plain list click.
3. Every door must be reachable (click/touch/keys) and every world name real.
4. Restraint over ornament: fog, gold light and depth do the work; lines, grids and micro-labels get deleted.
5. The page behaves like the machine it runs on: real ports, real paths, honest desktop-project archives.

## Accessibility & Inclusion

Reduced motion must be honored (static fallback for all authored motion). Door controls are real buttons with labels and pressed state; focus visible; aria-live regions for the current-door panel. Contrast targets ≥ 4.5:1 for body text on the dark scene.
