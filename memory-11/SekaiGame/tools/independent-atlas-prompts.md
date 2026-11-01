# Independent card atlas production

Generator: built-in image_gen, transparent_background=true.

Per-card identity, technique, filename and replacement reason are recorded in independent-atlas-tasks.json. Generation uses each card's name, ID and complete description; each request produces one original asset. Raw results are retained in independent-atlas-raw. Only existing transparent results are installed.

Character prompt template:

Create ONE premium painted anime battle VFX spritesheet dedicated exclusively to card "{name}" (ID {id}). Use the character's canonical signature ability and this card-specific action: {description}. Depict EFFECT ONLY, no character portrait or card illustration. EXACT 4 columns x 4 rows, 16 chronological frames of a single continuous animation: 1–3 anticipation and distinct signature motif; 4–6 rising power; 7–11 directed attack and impactful target contact; 12–16 energy dissipates and fragments fade. Detailed material, layered cinematic highlights, natural elemental fluid motion when appropriate, striking readable silhouette. Distinguish this variant from other cards of the same character using its named technique. All 16 frames evenly aligned and separated, equal square cells, entire sheet square; consistent fixed camera and anchor, generous 12% transparent padding in each cell, nothing crosses a cell boundary. Actual alpha transparency. No text, numbers, watermark, grid lines, UI, photographic background, flat geometric symbols, random particle clutter, or reused generic magic circle.

Spell directions:

- 黑洞: gravitational accretion disk, warped debris, inward pull and implosion.
- 死者苏生: turquoise Egyptian ankh, death boundary opening, rising souls and golden revival pillar.
- 地裂: advancing fault, jagged stone chasm beneath target, inward debris and settling dust.
- 强欲之壶: sculpted green ceramic pot opening, treasure light and two returning blank card silhouettes.
- 光之护封剑: three golden swords descending and forming a linked protective prison.
- 心变: white angelic and black demonic wings, crystal heart and transferring soul ribbon.

Every spell direction uses the same grid, margin, chronological animation and transparency constraints as the character template.
