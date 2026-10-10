---
name: Sekai Data Object
description: A dark editorial archive for anime series, characters, quotes, and original audio.
colors:
  bg: "#0b0c0e"
  bg-deep: "#08090a"
  surface: "#121416"
  surface-strong: "#191b1f"
  surface-soft: "#202329"
  line: "#2b2e33"
  line-strong: "#41454d"
  text: "#f0eee8"
  text-soft: "#c7c5bd"
  muted: "#96988f"
  faint: "#676a64"
  accent: "#ff744f"
  accent-strong: "#ff997b"
  success: "#9bd7b5"
  danger: "#ff8d87"
typography:
  display:
    fontFamily: "Avenir Next, Segoe UI, Microsoft YaHei, PingFang SC, sans-serif"
    fontSize: "clamp(2.6rem, 6vw, 5.1rem)"
    fontWeight: 700
    lineHeight: ".96"
    letterSpacing: "-.055em"
  headline:
    fontFamily: "Avenir Next, Segoe UI, Microsoft YaHei, PingFang SC, sans-serif"
    fontSize: "clamp(1.55rem, 3vw, 2.25rem)"
    fontWeight: 700
    lineHeight: "1"
    letterSpacing: "-.04em"
  title:
    fontFamily: "Avenir Next, Segoe UI, Microsoft YaHei, PingFang SC, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 700
    lineHeight: "1.25"
  body:
    fontFamily: "Avenir Next, Segoe UI, Microsoft YaHei, PingFang SC, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "1.7"
  label:
    fontFamily: "Cascadia Code, SFMono-Regular, Consolas, Liberation Mono, monospace"
    fontSize: "10px"
    fontWeight: 600
    lineHeight: "1.2"
    letterSpacing: ".14em"
rounded:
  sm: "10px"
  md: "16px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  section: "72px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#1b100d"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "13px 18px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "13px 18px"
  input:
    backgroundColor: "{colors.surface-strong}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "12px 13px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "18px"
  chip:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "5px 9px"
  navigation:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    padding: "12px clamp(18px, 4vw, 56px)"
  segment-number:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
---

# Design System: Sekai Data Object

## Overview

**Creative North Star: "The Seven-Segment Archive"**

Sekai Data Object treats anime knowledge like a living archive instrument. The interface is dark, editorial, and slightly mechanical: warm paper text sits inside a near-black CRT room, while a single orange-red accent marks active state, playback, and the rare moment that deserves attention. The generated archive-atlas image is atmosphere, not a fake product screenshot.

The system favors a clear working surface over decorative density. Metadata is visible, images remain legible, and the navigation behaves like a catalog index. Rounded corners are soft but restrained, borders are quiet, and the signature seven-segment counters turn dashboard totals into an unmistakable archive readout.

**Key Characteristics:**

- Near-black archive room with warm off-white type.
- One orange-red signal color used sparingly for action and state.
- Editorial split layouts, visible metadata, and uneven but intentional card rhythm.
- Seven-segment metric display as the signature instrument.
- Motion is short, tactile, and disabled cleanly for reduced-motion users.

## Colors

The palette is a dark neutral field with a warm paper text ramp and one signal accent. A light mode fallback keeps the same relationship with an off-white paper ground and deeper rust accent.

### Primary

- **Archive Signal** (`{colors.accent}`): Primary actions, active navigation, key status, selected segments, and playback affordances.
- **Archive Signal Bright** (`{colors.accent-strong}`): Focus-visible rings and high-contrast accent text.

### Neutral

- **Black Room** (`{colors.bg}`) and **Deep Room** (`{colors.bg-deep}`): Page canvas and the deepest archive field.
- **Archive Surface** (`{colors.surface}`), **Raised Surface** (`{colors.surface-strong}`), and **Soft Surface** (`{colors.surface-soft}`): Cards, forms, edit panels, and image placeholders.
- **Quiet Line** (`{colors.line}`) and **Strong Line** (`{colors.line-strong}`): Dividers, borders, input strokes, and active structural edges.
- **Warm Paper** (`{colors.text}`) and **Soft Paper** (`{colors.text-soft}`): Primary and secondary content text.
- **Archive Muted** (`{colors.muted}`) and **Archive Faint** (`{colors.faint}`): Supporting metadata and low-priority labels.
- **Recorded Success** (`{colors.success}`) and **Recorded Danger** (`{colors.danger}`): Flash feedback and destructive actions.

### Named Rules

**The One Signal Rule.** Keep the orange-red accent as the only chromatic voice. Its rarity is what makes an active state feel important.

**The Legible Archive Rule.** Never place essential text directly over the artwork. Use a separate text block, label, or tonal surface.

## Typography

**Display Font:** Avenir Next with Segoe UI, Microsoft YaHei, and PingFang SC fallbacks  
**Body Font:** Avenir Next with system CJK fallbacks  
**Label/Mono Font:** Cascadia Code with SFMono-Regular, Consolas, and Liberation Mono fallbacks

**Character:** The sans family keeps Chinese copy calm and contemporary. The mono face supplies the archival index voice for labels, codes, counts, and timestamp-like metadata without turning the whole interface into a terminal.

### Hierarchy

- **Display** (700, `clamp(2.6rem, 6vw, 5.1rem)`, `.96`): Home thesis and major archive statements.
- **Headline** (700, `clamp(1.55rem, 3vw, 2.25rem)`, `1`): Section titles and page headings.
- **Title** (700, `1.05rem`, `1.25`): Series, character, and quote item titles.
- **Body** (400, `15px`, `1.7`): Descriptions, synopsis, forms, and supporting prose.
- **Label** (600, `10px`, `.14em`, mono): Navigation metadata, record labels, status tags, field labels, and archive codes.

### Named Rules

**The Two-Speed Type Rule.** Use the sans face for reading and the mono face for indexing. Do not make body copy look like system output.

## Layout

The primary container is capped at `1360px` and uses `clamp(18px, 4vw, 64px)` side padding. The home page begins with a split hero, then moves through a metric band and content-led sections. Collection pages use a full-width search or filter row followed by grids or a quote list. The series detail page pairs a visual record with a fact-rich information block before the related collections.

Spacing follows a compact archive rhythm built from `8px`, `12px`, `16px`, `24px`, and `32px`, with `72px` section separation. The archive grid uses responsive columns rather than fixed equal cards: 5 columns at wide desktop, 3 at medium desktop, and 2 on mobile. Character cards use the same principle with a wider portrait ratio. At `1040px`, `760px`, and `400px`, navigation, hero, forms, and grids collapse deliberately. Mobile navigation becomes an explicit disclosure rather than a crowded row.

## Elevation & Depth

Depth comes from tonal layering, quiet borders, image crop, and a restrained ambient shadow on major surfaces. Resting cards stay mostly flat. The main shadow is reserved for edit panels, cards, and large image surfaces; focus uses a clear accent ring rather than a diffuse glow. The generated archive-atlas image supplies atmosphere through texture and contrast, not through UI chrome.

### Shadow Vocabulary

- **Archive Ambient** (`0 24px 70px rgba(0, 0, 0, .28)`): Large dark-mode panels and hero visual surfaces.
- **Paper Ambient** (`0 18px 46px rgba(47, 45, 37, .10)`): Light-mode surfaces.

### Named Rules

**The Flat-By-Default Rule.** Surfaces are quiet at rest. Use borders, tonal shifts, and state changes before reaching for stronger shadow.

## Shapes

The form language uses gently softened corners: `10px` controls and buttons, `16px` cards and panels, and a `999px` pill only for compact tags or status markers. Borders are one-pixel and low-contrast at rest, becoming stronger on hover or focus. Images clip to the card silhouette and use intentional aspect ratios rather than decorative masks. No glyph icons are required for the core system; text labels and native controls carry the meaning.

## Components

### Buttons

- **Shape:** Soft rectangular corners (`10px`), with a compact mono label.
- **Primary:** Archive Signal background, dark text, `13px 18px` padding, and a small lift on hover.
- **Hover / Focus:** Accent deepens or brightens by state; focus-visible uses a `2px` accent outline with `3px` offset; active state returns to the resting position.
- **Secondary / Ghost / Tertiary:** Outline buttons use the quiet line and become lightly tinted on hover. Ghost buttons are text-led and preserve the same focus treatment. Danger keeps the danger color for destructive actions.

### Chips

- **Style:** Pill silhouette (`999px`), surface-soft background, muted mono text, and a quiet border.
- **State:** Tags are informational. Active or selected states use the one signal accent without introducing a second color family.

### Cards / Containers

- **Corner Style:** `16px` for cards and panels; image frames inherit the card silhouette.
- **Background:** Archive Surface with Raised Surface reserved for interactive or editable regions.
- **Shadow Strategy:** Follow the ambient shadow vocabulary; do not shadow every list item.
- **Border:** Quiet line at rest, strong line on hover when the card is actionable.
- **Internal Padding:** `18px` cards, `24px` section blocks, and the shared spacing rhythm for nested content.

### Inputs / Fields

- **Style:** Raised Surface background, quiet line border, `10px` radius, visible label, and readable placeholder.
- **Focus:** Accent border plus a visible accent ring. Focus must remain legible in both dark and light themes.
- **Error / Disabled:** Error uses the danger color and live-region feedback. Disabled controls are muted without removing their label or shape.

### Navigation

The navigation is a sticky archive index with the SDO text mark, four visible route links, a member state, a theme control, and a text logout link. Active navigation is identified by a short orange-red underline and text state. On mobile, the route list becomes a disclosure panel controlled by a labeled button.

### Seven-Segment Metrics

Dashboard totals are rendered as actual seven-segment DOM pieces rather than a display-font approximation. Each digit is mapped in JavaScript, preserving an accessible numeric label. The signal color is reduced when a segment is inactive and remains bright when active. Reduced-motion users receive the final state without the entrance sequence.

## Do's and Don'ts

### Do:

- **Do** keep one orange-red signal color for action, active state, and playback.
- **Do** expose metadata as text labels and small record rows so the archive remains scannable.
- **Do** use the actual local artwork or a clearly marked placeholder; preserve the image's subject and legibility.
- **Do** keep focus-visible rings and visible field labels on every interactive surface.
- **Do** reveal content once with short opacity and vertical motion, and honor `prefers-reduced-motion`.

### Don't:

- **Don't** add purple gradients, neon dashboard chrome, decorative starbursts, or random glyph icons.
- **Don't** put core copy over busy poster art or use a fake UI screenshot as atmosphere.
- **Don't** turn every panel into a floating shadow card or every label into uppercase mono text.
- **Don't** replace the seven-segment metric with a decorative font that only resembles it.
- **Don't** hide the mobile navigation, form labels, audio controls, or destructive action meaning behind icons alone.
