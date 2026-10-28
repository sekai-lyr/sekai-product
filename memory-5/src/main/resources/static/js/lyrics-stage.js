/* ==========================================================================
   Sekai Song — 沉浸歌词舞台
   与 player-stage.js 一样只使用一条主时间线：audio.currentTime，或渲染模式的帧时间。
   ========================================================================== */
(() => {
    "use strict";

    const stage = document.querySelector(".lyric-stage");
    if (!stage) {
        return;
    }

    window.__sekaiStageEngine = true;

    const audio = stage.querySelector("audio.stage-audio");
    const lyricsBox = stage.querySelector("#lyrics");
    const galleryMode = window.SekaiStages?.find(item => item.id === stage.dataset.stageMode && item.engine);
    if (galleryMode) document.body.classList.add('immersive-lyrics-page', 'stage-mode-gallery');
    const requestedStageMode = galleryMode || ["folia", "folia-classic"].includes(stage.dataset.stageMode)
        ? stage.dataset.stageMode
        : "lyrics";
    const rows = Array.from(stage.querySelectorAll("#lyrics p[data-time]"))
        .filter((row) => {
            const text = (row.querySelector("b")?.textContent || "").trim();
            const staffLine = /^(?:作词|作詞|作曲|编曲|編曲|混音|制作|製作|演唱|歌手|翻译|翻譯)\s*[:：]/i.test(text);
            return text
                && !/^\[(?:offset|by|ti|ar|al|re|ve):.*\]$/i.test(text)
                && !(["folia", "folia-classic"].includes(requestedStageMode) && Number(row.dataset.time || 0) < 12 && staffLine);
        }).sort((a, b) => Number(a.dataset.time) - Number(b.dataset.time));
    const slots = {
        prev: stage.querySelector('[data-lyric-slot="prev"]'),
        active: stage.querySelector('[data-lyric-slot="active"]'),
        next: stage.querySelector('[data-lyric-slot="next"]')
    };
    const indexLabel = stage.querySelector("[data-lyric-index]");
    const progressLabel = stage.querySelector("[data-lyric-progress]");
    const foliaSubtitle = stage.querySelector("[data-folia-subtitle]");
    const foliaArticle = stage.querySelector("[data-folia-article]");
    const seek = stage.querySelector("[data-stage-seek]");
    const timeCurrent = stage.querySelector("[data-stage-time-current]");
    const timeTotal = stage.querySelector("[data-stage-time-total]");
    const playBtn = stage.querySelector('[data-player-action="play"]');
    const backdrop = stage.querySelector(".lyric-backdrop img");
    const orbits = Array.from(stage.querySelectorAll(".lyric-orbit"));
    const particles = Array.from(stage.querySelectorAll(".lyric-particle"));
    const foliaDecor = Array.from(stage.querySelectorAll(".folia-geometry > span"));
    const drawer = document.querySelector("[data-stage-drawer]");
    const drawerToggle = stage.querySelector("[data-stage-queue-toggle]");
    const drawerClose = drawer?.querySelector("[data-stage-drawer-close]");
    const params = new URLSearchParams(window.location.search);
    const renderMode = params.has("render");
    const stageMode = requestedStageMode;
    const foliaMode = ["folia", "folia-classic"].includes(stageMode);
    const foliaArticleMode = stageMode === "folia" || Boolean(galleryMode);
    const fps = 60;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
    const renderDuration = rows.length
        ? Math.max(60, Number(rows[rows.length - 1].dataset.time) + 8)
        : 90;

    let renderT = 0;
    let activeIndex = -1;
    let lastNow = performance.now();
    let seekDragging = false;
    let foliaDirector = null;
    let layoutWidth = 0;
    let layoutHeight = 0;
    const scene = stage.querySelector('.lyric-scene');
    const atmosphere = document.createElement('canvas');
    atmosphere.className = 'performance-atmosphere';
    atmosphere.setAttribute('aria-hidden', 'true');
    stage.querySelector('.lyric-backdrop')?.appendChild(atmosphere);
    const atmosphereContext = atmosphere.getContext('2d');

    function paintAtmosphere(t) {
        if (!atmosphereContext || foliaArticleMode) return;
        const width = stage.clientWidth;
        const height = stage.clientHeight;
        if (atmosphere.width !== width || atmosphere.height !== height) {
            atmosphere.width = width;
            atmosphere.height = height;
        }
        const ctx = atmosphereContext;
        ctx.clearRect(0, 0, width, height);
        const clock = reducedMotion ? 0 : t;
        const shot = Math.max(0, activeIndex);
        const hue = 22 + 24 * Math.sin(shot * 0.41);
        const x = width * (0.5 + Math.sin(clock * 0.08) * 0.28);
        const y = height * (0.45 + Math.cos(clock * 0.1) * 0.18);
        const light = ctx.createRadialGradient(x, y, 0, x, y, width * 0.58);
        light.addColorStop(0, `hsla(${hue},85%,65%,.17)`);
        light.addColorStop(1, 'transparent');
        ctx.fillStyle = light;
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = 'rgba(255,220,187,.07)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
            const phase = clock * 0.045 + i * 0.61;
            ctx.beginPath();
            ctx.ellipse(width * .5, height * .48, width * (.16 + i * .055), height * (.13 + i * .045), phase, 0, Math.PI * 1.5);
            ctx.stroke();
        }
        if (reducedMotion) return;
        for (let i = 0; i < 36; i++) {
            const px = (seededValue(i * 47 + 8) * width + Math.sin(clock * .12 + i) * 24);
            const py = (seededValue(i * 31 + 5) * height - clock * (2 + i % 4)) % height;
            ctx.fillStyle = `rgba(255,221,194,${.08 + .12 * (1 + Math.sin(clock * .4 + i))})`;
            ctx.fillRect(px, (py + height) % height, i % 5 === 0 ? 3 : 1, i % 5 === 0 ? 3 : 1);
        }
    }

    function packSlot(slot) {
        if (!slot || slot.hidden || foliaArticleMode || !scene) return;
        const units = Array.from(slot.children);
        const columns = stage.clientWidth < 700 ? 2 : Math.min(4, Math.ceil(Math.sqrt(units.length * 1.6)));
        const rowCount = Math.ceil(units.length / columns);
        const cellWidth = scene.clientWidth * .9 / columns;
        const cellHeight = scene.clientHeight * .8 / rowCount;
        units.forEach((unit, index) => {
            const sourceColumn = index % columns;
            const column = Number(slot.dataset.rowIndex) % 2 ? columns - 1 - sourceColumn : sourceColumn;
            const row = Math.floor(index / columns);
            const jitter = seededValue(Number(slot.dataset.rowIndex) * 31 + index * 13);
            unit.style.setProperty('--glyph-x', `${5 + (column + .5) * 90 / columns + (jitter - .5) * 3}%`);
            unit.style.setProperty('--glyph-y', `${10 + (row + .5) * 80 / rowCount + (jitter - .5) * 12}%`);
            const fit = Math.min(Math.max(4, cellWidth - 64) / Math.max(1, unit.offsetWidth), Math.max(4, cellHeight - 64) / Math.max(1, unit.offsetHeight));
            const desired = foliaMode ? Number(unit.style.getPropertyValue('--glyph-scale')) || 1 : .9 + jitter * .3;
            unit.style.setProperty('--glyph-scale', String(Math.max(.005, Math.min(desired, fit / 1.2))));
            unit.style.setProperty('--glyph-rotation', `${(jitter - .5) * 5}deg`);
        });
    }

    async function loadFoliaDirector() {
        if (!foliaArticleMode || !foliaArticle) return;
        if (!rows.length) {
            stage.dataset.foliaEngine = 'empty';
            window.__stageReady = true;
            if (foliaSubtitle) foliaSubtitle.textContent = '没有同步歌词，请选择本地 LRC 或匹配云端歌词';
            return;
        }
        window.__stageReady = false;
        try {
            if (galleryMode) {
                const { mount } = await import(galleryMode.derived
                    ? '/js/derived-performances.js?v=20261027-area'
                    : '/js/vendor/folia-gallery/gallery.js?v=20261024-mobile');
                document.querySelector('[data-performance-default-note]').hidden = true;
                foliaDirector = await mount({ host: foliaArticle, settingsHost: document.querySelector('[data-folia-settings-host]'),
                    rows, audio, seed: stage.dataset.songId, title: stage.dataset.songTitle, artist: stage.dataset.songArtist,
                    cover: backdrop?.src, reducedMotion, mode: galleryMode.engine, renderMode });
                stage.dataset.foliaEngine = (galleryMode.derived ? 'derived-' : 'upstream-') + galleryMode.engine;
                window.__foliaProgram = foliaDirector.program;
                foliaDirector.apply(stageTime());
                return;
            }
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = '/js/vendor/folia-sonnet.js?v=20261024-mobile';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
            foliaDirector = await window.__createSekaiFolia({ host: foliaArticle, rows,
                seed: stage.dataset.songId, reducedMotion, title: stage.dataset.songTitle, artist: stage.dataset.songArtist });
            stage.dataset.foliaEngine = 'sonnet';
            window.__foliaProgram = foliaDirector.program;
            foliaDirector.apply(stageTime());
        } catch (error) {
            stage.dataset.foliaEngine = 'failed';
            if (foliaSubtitle) foliaSubtitle.textContent = 'Folia 渲染加载失败，请刷新页面';
            console.error('Folia Sonnet initialization failed', error);
        } finally {
            window.__stageReady = stage.dataset.foliaEngine === 'sonnet' || /^(upstream|derived)-/.test(stage.dataset.foliaEngine || '');
        }
    }

    // 没有歌词时，字阵 / Folia 舞台以前是一块空的黑屏：这里给出可读提示，
    // 用户至少知道发生了什么、以及去哪里补歌词（获取歌词表单在唱片舞台）。
    if (!rows.length && slots.active) {
        slots.active.hidden = false;
        slots.active.textContent = "还没有歌词 · 切到「唱片舞台」用「更多 ▾」获取同步歌词";
    }

    function clamp(value, min = 0, max = 1) {
        return Math.min(max, Math.max(min, value));
    }

    function stageDuration() {
        return audio && Number.isFinite(audio.duration) && audio.duration > 0
            ? audio.duration
            : renderDuration;
    }

    function stageTime() {
        if (renderMode) {
            return renderT;
        }
        return audio && Number.isFinite(audio.duration) && audio.duration > 0
            ? audio.currentTime
            : 0;
    }

    function formatTime(seconds) {
        const safe = Math.max(0, Math.floor(seconds || 0));
        return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
    }

    function lyricIndexAt(seconds) {
        let found = -1;
        for (let i = 0; i < rows.length; i++) {
            if (Number(rows[i].dataset.time || "0") <= seconds) {
                found = i;
            }
        }
        return found;
    }

    function seededValue(seed) {
        const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
        return value - Math.floor(value);
    }

    function easeOutCubic(value) {
        const safe = clamp(value);
        return 1 - ((1 - safe) ** 3);
    }

    function splitIntoCompleteUnits(text, maxUnits) {
        const clean = text.replace(/\s+/g, " ").trim();
        if (!clean) {
            return ["♪"];
        }
        const chars = typeof Intl.Segmenter === 'function'
            ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(clean), item => item.segment)
            : Array.from(clean);
        const chunkSize = Math.max(1, Math.ceil(chars.length / maxUnits));
        const units = [];
        for (let i = 0; i < chars.length; i += chunkSize) {
            units.push(chars.slice(i, i + chunkSize).join(""));
        }
        return units;
    }

    function splitLyricUnits(text) {
        return splitIntoCompleteUnits(text, 8);
    }

    function splitFoliaUnits(text) {
        return splitIntoCompleteUnits(text, 10);
    }

    function entranceProgress(t, start, end) {
        const duration = Math.max(0.08, end - start);
        const lead = Math.min(0.42, Math.max(0.12, duration * 0.16));
        return clamp((t - (start - lead)) / lead);
    }


    function setGlyphLayout(span, lineIndex, characterIndex, characterCount, text) {
        const seed = (lineIndex + 17) * 41 + (characterIndex + 3) * 19 + text.length * 7;
        const noiseX = (seededValue(seed) - 0.5) * 4;
        const noiseY = (seededValue(seed + 11) - 0.5) * 4;
        const noiseScale = (seededValue(seed + 23) - 0.5) * 0.12;
        const noiseRotation = seededValue(seed + 37) - 0.5;
        const layouts = {
            1: [[52, 48]],
            2: [[24, 32], [78, 65]],
            3: [[18, 28], [51, 71], [82, 31]],
            4: [[18, 25], [69, 22], [32, 73], [83, 66]],
            5: [[15, 25], [48, 18], [82, 31], [27, 73], [69, 69]],
            6: [[14, 23], [48, 18], [82, 28], [21, 72], [54, 73], [86, 65]],
            7: [[13, 22], [42, 17], [76, 24], [25, 52], [62, 49], [18, 78], [79, 74]],
            8: [[12, 22], [37, 17], [63, 25], [87, 19], [17, 73], [42, 78], [68, 69], [88, 76]]
        };
        const safeCount = Math.min(8, Math.max(1, characterCount));
        const slotsForCount = layouts[safeCount];
        const slotIndex = (characterIndex + Math.abs(lineIndex * 3)) % safeCount;
        const slot = slotsForCount[slotIndex];
        const mirroredX = Math.abs(lineIndex) % 2 === 0 ? slot[0] : 100 - slot[0];
        const x = mirroredX + noiseX;
        const y = slot[1] + noiseY;
        const densityScale = [1.12, 1.08, 0.9, 0.78, 0.68, 0.62, 0.57, 0.53][safeCount - 1];
        const lengthScale = 1.8 / Math.max(1, Array.from(text).length);
        const scale = Math.min(densityScale, lengthScale) + noiseScale;

        span.style.setProperty("--glyph-x", `${clamp(x / 100, 0.04, 0.96) * 100}%`);
        span.style.setProperty("--glyph-y", `${clamp(y / 100, 0.08, 0.92) * 100}%`);
        span.style.setProperty("--glyph-scale", clamp(scale, 0.3, 1.12).toFixed(3));
        span.style.setProperty("--glyph-rotation", `${(noiseRotation * 8).toFixed(2)}deg`);
        span.style.setProperty("--glyph-phase", (seededValue(seed + 53) * Math.PI * 2).toFixed(4));
        span.style.setProperty("--glyph-drift", `${(3 + seededValue(seed + 67) * 6).toFixed(2)}px`);
        span.style.setProperty("--glyph-sweep", `${(2 + seededValue(seed + 79) * 5).toFixed(2)}px`);
        span.classList.toggle("is-accent", (lineIndex + characterIndex) % 7 === 0);
    }

    function setFoliaLayout(span, lineIndex, unitIndex, unitCount) {
        const layouts = [
            [
                [-3, 18, 1.8, -2], [22, 54, 0.8, 0], [43, 56, 1.2, -2], [68, 19, 0.82, 1],
                [87, 50, 0.56, 2], [101, 68, 1.04, 0], [55, 80, 0.52, 0], [15, 78, 0.62, -2],
                [37, 18, 0.42, 0], [76, 78, 0.38, 1]
            ],
            [
                [50, -4, 1.7, 0], [50, 23, 0.62, 0], [50, 37, 0.4, 0], [50, 51, 0.54, 0],
                [50, 66, 0.46, 0], [50, 82, 0.6, 0], [72, 35, 0.34, 0], [30, 64, 0.34, 0],
                [70, 72, 0.3, 0], [31, 25, 0.3, 0]
            ],
            [
                [52, -5, 2.4, 0], [14, 8, 0.62, -2], [30, 7, 0.58, 1], [73, 8, 0.72, 0],
                [89, 11, 0.66, 1], [51, 48, 0.42, 0], [51, 71, 0.7, 0], [78, 70, 0.42, 0],
                [23, 72, 0.4, 0], [92, 48, 0.32, 0]
            ],
            [
                [14, 20, 0.6, -2], [27, 35, 0.46, 0], [42, 27, 1.02, -1], [58, 32, 0.9, 1],
                [73, 25, 0.76, 0], [19, 58, 0.4, 0], [35, 65, 0.54, 0], [53, 56, 1.2, -2],
                [72, 61, 0.52, 1], [88, 55, 0.46, 0]
            ],
            [
                [50, -7, 0.46, 0], [50, 10, 0.5, 0], [50, 40, 1.82, 0], [50, 72, 0.4, 0],
                [18, 18, 0.36, 0], [82, 65, 0.3, 0], [18, 73, 0.28, 0], [82, 18, 0.28, 0],
                [65, 82, 0.26, 0], [35, 82, 0.26, 0]
            ],
            [
                [11, 7, 0.62, -1], [30, 10, 0.46, 0], [49, 13, 0.46, 0], [78, 39, 0.58, 0],
                [66, 58, 0.42, 0], [84, 82, 1.82, -2], [35, 65, 0.36, 0], [14, 48, 0.3, 0],
                [55, 30, 0.34, 0], [95, 21, 0.3, 0]
            ],
            [
                [29, 48, 1.52, -2], [55, 53, 0.72, 2], [51, 16, 0.4, 0], [51, 29, 0.46, 0],
                [72, 20, 0.42, 0], [80, 68, 0.58, 0], [25, 77, 0.36, 0], [93, 45, 0.34, 0],
                [8, 42, 0.3, 0], [61, 82, 0.3, 0]
            ],
            [
                [8, 18, 0.86, 0], [26, 18, 0.78, 0], [43, 18, 0.9, 0], [63, 17, 1.58, 0],
                [83, 19, 0.76, 0], [18, 58, 1.38, 0], [40, 56, 0.66, 0], [61, 58, 1.7, 0],
                [81, 52, 0.62, 0], [93, 70, 0.46, 0]
            ],
            [
                [18, 31, 1.46, 0], [18, 53, 1.38, 0], [18, 76, 1.54, 0], [43, 26, 0.62, 0],
                [58, 25, 0.68, 0], [72, 27, 0.72, 0], [55, 57, 1.86, 0], [78, 45, 0.68, 0],
                [78, 68, 0.72, 0], [92, 72, 0.42, 0]
            ]
        ];
        const shot = Math.abs(lineIndex) % layouts.length;
        const layout = layouts[shot][unitIndex % 10];
        const density = unitCount > 8 ? 0.88 : 1;
        span.style.setProperty("--glyph-x", `${layout[0]}%`);
        span.style.setProperty("--glyph-y", `${layout[1]}%`);
        span.style.setProperty("--glyph-scale", (layout[2] * density).toFixed(3));
        span.style.setProperty("--glyph-rotation", `${layout[3]}deg`);
        span.style.setProperty("--glyph-phase", (seededValue((lineIndex + 11) * 37 + unitIndex * 17) * Math.PI * 2).toFixed(4));
        span.style.setProperty("--glyph-drift", `${(4 + seededValue(lineIndex * 13 + unitIndex + 7) * 9).toFixed(2)}px`);
        span.style.setProperty("--glyph-sweep", `${(3 + seededValue(lineIndex * 19 + unitIndex + 3) * 8).toFixed(2)}px`);
        const framedUnits = [[1, 4], [0, 2, 4], [0, 5], [1, 6, 8], [0, 3], [3, 4], [1, 5], [3, 7], [0, 6]];
        const barredUnits = [[3], [2], [5], [1, 8], [0], [4], [1], [2, 6], [3]];
        const echoUnits = [[0, 2], [0], [0], [2, 7], [2], [5], [0, 1], [3, 7], [0, 6]];
        span.classList.toggle("folia-framed", framedUnits[shot].includes(unitIndex));
        span.classList.toggle("folia-barred", barredUnits[shot].includes(unitIndex));
        span.classList.toggle("folia-echo", echoUnits[shot].includes(unitIndex));
        span.classList.toggle("folia-hero", layout[2] >= 1.3);
        span.classList.toggle("folia-micro", layout[2] <= 0.42);
        span.classList.toggle("is-accent", (lineIndex + unitIndex * 3) % 13 === 0 && layout[2] < 1);
    }

    function setSlot(slot, row, type, index) {
        if (!slot) {
            return;
        }
        slot.className = `immersive-line immersive-line-${type}`;
        if (!row) {
            slot.hidden = true;
            slot.replaceChildren();
            return;
        }
        const text = (row.querySelector("b")?.textContent || "").trim();
        slot.hidden = false;
        if (slot.dataset.rowIndex === String(index) && slot.dataset.text === text) {
            return;
        }
        slot.dataset.rowIndex = String(index);
        slot.dataset.text = text;
        slot.dataset.start = row ? String(Number(row.dataset.time || "0")) : "";
        slot.dataset.end = rows[index + 1]
            ? String(Number(rows[index + 1].dataset.time || "0"))
            : String(Number(row?.dataset.time || "0") + 6);
        slot.replaceChildren();
        const units = foliaMode ? splitFoliaUnits(text || "♪") : splitLyricUnits(text || "♪");
        if (foliaMode) {
            slot.classList.add("folia-composition", `folia-layout-${Math.abs(index) % 9}`);
        }
        units.forEach((character, characterIndex) => {
            const span = document.createElement("span");
            span.textContent = character;
            span.style.setProperty("--char-index", String(characterIndex));
            if (foliaMode) {
                setFoliaLayout(span, index, characterIndex, units.length);
            } else {
                setGlyphLayout(span, index, characterIndex, units.length, text);
            }
            if (/^\s+$/.test(character)) {
                span.classList.add("is-space");
            }
            slot.appendChild(span);
        });
        packSlot(slot);
    }

    function updateLyrics(t) {
        // Directors must receive seeks into the intro too, otherwise the previous scene remains.
        foliaDirector?.apply(t);
        const nextIndex = lyricIndexAt(t);
        if (nextIndex !== activeIndex) {
            activeIndex = nextIndex;
            if (foliaMode) {
                stage.dataset.foliaShot = String(Math.abs(activeIndex) % 9);
            }
            setSlot(slots.prev, rows[activeIndex - 1], "prev", activeIndex - 1);
            setSlot(slots.active, rows[activeIndex], "active", activeIndex);
            setSlot(slots.next, rows[activeIndex + 1], "next", activeIndex + 1);
            if (indexLabel) {
                indexLabel.textContent = String(Math.max(1, activeIndex + 1)).padStart(2, "0");
            }
            if (foliaSubtitle) {
                foliaSubtitle.textContent = (rows[activeIndex]?.querySelector("b")?.textContent || "").trim();
            }
        }

        if (!slots.active || activeIndex < 0 || !rows[activeIndex]) {
            return;
        }
        const start = Number(rows[activeIndex].dataset.time || "0");
        const end = rows[activeIndex + 1]
            ? Number(rows[activeIndex + 1].dataset.time || start + 6)
            : start + 6;
        function animateSlot(slot, type) {
            if (!slot || slot.hidden || !slot.children.length) {
                return;
            }
            const lineStart = Number(slot.dataset.start || "0");
            const lineEnd = Number(slot.dataset.end || lineStart + 6);
            const isActive = type === "active";
            if (foliaMode && !isActive) {
                slot.style.opacity = "0";
                return;
            }
            const groupIn = easeOutCubic(entranceProgress(t, lineStart, lineEnd));
            const lineProgress = clamp((t - lineStart) / Math.max(0.8, lineEnd - lineStart));
            let visibility;

            if (isActive) {
                visibility = groupIn;
            } else if (type === "prev") {
                visibility = clamp(1 - (t - lineEnd) / 2.8) * (foliaMode ? 0.13 : 0.34);
            } else {
                visibility = clamp(1 - (lineStart - t) / 3.2) * (foliaMode ? 0.1 : 0.3);
            }

            slot.style.opacity = String(clamp(visibility));
            slot.style.setProperty("--line-progress", String(lineProgress));
            if (foliaMode) {
                const shot = Math.abs(activeIndex) % 9;
                const direction = shot % 2 === 0 ? -1 : 1;
                const cameraX = reducedMotion ? 0 : direction * (lineProgress - 0.5) * (shot === 3 || shot === 7 ? 24 : 12);
                const cameraY = reducedMotion ? 0 : (lineProgress - 0.5) * (shot === 1 || shot === 8 ? -12 : 5);
                const cameraScale = 1.055 - groupIn * 0.055 + lineProgress * 0.018;
                slot.style.transform = `translate3d(${cameraX.toFixed(2)}px, ${cameraY.toFixed(2)}px, 0) scale(${cameraScale.toFixed(4)})`;
            } else {
                const cameraX = reducedMotion ? 0 : Math.sin(lineProgress * Math.PI) * (activeIndex % 2 ? -8 : 8);
                const cameraScale = reducedMotion ? 1 : 1.025 - groupIn * .025 + lineProgress * .012;
                slot.style.transform = `translate3d(${cameraX.toFixed(2)}px, 0, 0) scale(${cameraScale.toFixed(4)})`;
            }
            Array.from(slot.children).forEach((character, index) => {
                if (character.classList.contains("is-space")) {
                    character.style.opacity = "0";
                    return;
                }
                const phase = Number(character.style.getPropertyValue("--glyph-phase") || "0");
                const drift = Number.parseFloat(character.style.getPropertyValue("--glyph-drift") || "6");
                const sweep = Number.parseFloat(character.style.getPropertyValue("--glyph-sweep") || "12");
                const wave = reducedMotion ? 0 : Math.sin(t * (foliaMode ? 0.3 : 0.72 + (index % 3) * 0.11) + phase);
                const sway = reducedMotion ? 0 : Math.cos(t * (foliaMode ? 0.22 : 0.54 + (index % 2) * 0.08) + phase) * drift;
                const travelX = reducedMotion ? 0 : Math.sin(t * (foliaMode ? 0.12 : 0.31) + phase) * sweep;
                const travelY = reducedMotion ? 0 : Math.cos(t * (foliaMode ? 0.1 : 0.27) + phase) * sweep * 0.62;
                const motionWeight = foliaMode ? 0.18 : 1;
                const enterX = foliaMode ? (1 - groupIn) * (index % 2 ? 38 : -38) : 0;
                const enterLift = isActive ? (1 - groupIn) * (foliaMode ? (index % 3 - 1) * 28 : 24) : 0;
                const exitLift = 0;
                const baseScale = Number.parseFloat(character.style.getPropertyValue("--glyph-scale") || "1");
                const opacity = isActive
                    ? (foliaMode ? 0.78 + visibility * 0.22 : 0.64 + visibility * 0.36)
                    : (foliaMode ? 0.36 + visibility * 0.24 : 0.58 + visibility * 0.42);
                const scale = baseScale * (isActive
                    ? (foliaMode ? 0.9 + groupIn * 0.1 + wave * 0.012 : 0.94 + wave * 0.1)
                    : (foliaMode ? 0.96 + wave * 0.02 : 0.9 + wave * 0.055));
                const rotation = Number.parseFloat(character.style.getPropertyValue("--glyph-rotation") || "0") + wave * (foliaMode ? 1.3 : (isActive ? 5 : 3));
                character.style.opacity = String(clamp(opacity));
                character.style.transform = `translate3d(-50%, -50%, 0) translate3d(${(enterX + (sway + travelX) * motionWeight).toFixed(2)}px, ${(enterLift + exitLift + travelY * motionWeight).toFixed(2)}px, 0) rotate(${rotation.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
                character.style.setProperty("--folia-reveal", groupIn.toFixed(4));
                character.style.setProperty("--folia-clip", `${((1 - groupIn) * 54).toFixed(2)}%`);
                character.style.setProperty("--folia-clip-x", `${((1 - groupIn) * 18).toFixed(2)}%`);
                character.style.filter = `blur(${((1 - visibility) * (foliaMode ? 2.1 : 3.2)).toFixed(2)}px)`;
            });
        }

        animateSlot(slots.prev, "prev");
        animateSlot(slots.active, "active");
        animateSlot(slots.next, "next");
        if (progressLabel) {
            progressLabel.textContent = Math.max(0, t - start).toFixed(2).padStart(5, "0");
        }
    }

    function updateProgress(t) {
        const duration = stageDuration();
        const percent = clamp(t / duration) * 100;
        stage.style.setProperty("--folia-progress", `${percent.toFixed(2)}%`);
        stage.style.setProperty("--folia-progress-ratio", (percent / 100).toFixed(5));
        if (seek) {
            seek.style.setProperty("--seek", `${percent.toFixed(2)}%`);
            if (!seekDragging) {
                seek.value = String(Math.round(percent * 10));
            }
        }
        if (timeCurrent) {
            timeCurrent.textContent = formatTime(t);
        }
        if (timeTotal) {
            timeTotal.textContent = formatTime(duration);
        }
    }

    function applyStage(t, dt) {
        if (layoutWidth !== stage.clientWidth || layoutHeight !== stage.clientHeight) {
            layoutWidth = stage.clientWidth;
            layoutHeight = stage.clientHeight;
            Object.values(slots).forEach(packSlot);
        }
        paintAtmosphere(t);
        const motionT = reducedMotion ? 0 : t;
        const beat = 0.5 + 0.5 * Math.sin(motionT * Math.PI * 2);
        stage.style.setProperty("--lyric-beat", (0.75 + beat * 0.25).toFixed(3));
        stage.style.setProperty("--lyric-drift", `${(Math.sin(motionT * 0.13) * 12).toFixed(2)}px`);
        stage.style.setProperty("--lyric-drift-y", `${(Math.cos(motionT * 0.11) * 8).toFixed(2)}px`);
        if (backdrop) {
            const zoom = (foliaMode ? 1.055 : 1.08) + Math.sin(motionT * .055) * .018;
            backdrop.style.transform = `scale(${zoom.toFixed(4)}) translate3d(var(--lyric-drift), var(--lyric-drift-y), 0) rotate(${(Math.sin(motionT * .035) * .45).toFixed(3)}deg)`;
        }
        orbits.forEach((orbit, index) => {
            const rotation = motionT * (index ? -3.5 : 5.5) + index * 42;
            orbit.style.transform = `rotate(${rotation.toFixed(2)}deg)`;
        });
        particles.forEach((particle, index) => {
            const angle = motionT * (0.22 + index * 0.035) + index * 1.05;
            const radius = 210 + (index % 3) * 84;
            particle.style.transform = `translate3d(${(Math.cos(angle) * radius).toFixed(2)}px, ${(Math.sin(angle) * radius * 0.52).toFixed(2)}px, 0)`;
            particle.style.opacity = reducedMotion ? "0" : String(0.18 + 0.46 * (0.5 + 0.5 * Math.sin(motionT * 1.7 + index)));
        });
        const decorPatterns = [
            [0, 1, 2, 4, 5, 7, 9, 11, 13],
            [0, 2, 3, 5, 8, 10, 12, 14],
            [0, 1, 2, 4, 6, 8, 10, 13],
            [0, 1, 2, 3, 4, 5, 6, 9, 11, 12, 14],
            [1, 2, 5, 8, 10, 12, 13],
            [0, 2, 3, 4, 6, 7, 9, 11, 14],
            [0, 1, 3, 5, 7, 8, 9, 10, 13]
        ];
        const decorPattern = decorPatterns[Math.abs(activeIndex) % decorPatterns.length] || decorPatterns[0];
        foliaDecor.forEach((decor, index) => {
            const phase = index * 0.83;
            const driftX = reducedMotion ? 0 : Math.sin(motionT * 0.18 + phase) * (index % 2 ? 5 : 8);
            const driftY = reducedMotion ? 0 : Math.cos(motionT * 0.15 + phase) * 4;
            const rotation = reducedMotion ? 0 : Math.sin(motionT * 0.12 + phase) * (index % 3 ? 2 : 4);
            decor.style.setProperty("--folia-drift-x", `${driftX.toFixed(2)}px`);
            decor.style.setProperty("--folia-drift-y", `${driftY.toFixed(2)}px`);
            decor.style.setProperty("--folia-rotation", `${rotation.toFixed(2)}deg`);
            const visible = decorPattern.includes(index);
            decor.style.opacity = visible
                ? String(0.34 + 0.2 * (0.5 + 0.5 * Math.sin(motionT * 0.42 + phase)))
                : "0";
        });
        updateLyrics(t);
        updateProgress(t);
    }

    function tick(now) {
        const dt = Math.min(0.1, Math.max(0.001, (now - lastNow) / 1000));
        lastNow = now;
        const running = Boolean(audio && !audio.paused && !audio.ended);
        applyStage(stageTime(), running ? dt : 0);
        requestAnimationFrame(tick);
    }

    function updatePlayIcon() {
        if (!playBtn) {
            return;
        }
        playBtn.textContent = audio && !audio.paused ? "⏸" : "▶";
        stage.classList.toggle("is-playing", Boolean(audio && !audio.paused && !audio.ended));
    }

    if (playBtn && audio) {
        playBtn.addEventListener("click", () => {
            if (audio.paused) {
                audio.play().catch(() => {});
            } else {
                audio.pause();
            }
        });
        audio.addEventListener("play", updatePlayIcon);
        audio.addEventListener("pause", updatePlayIcon);
        audio.addEventListener("ended", updatePlayIcon);
    }

    if (seek && audio) {
        seek.addEventListener("input", () => {
            seekDragging = true;
            const ratio = clamp(Number(seek.value) / Number(seek.max || 1000));
            const percent = ratio * 100;
            audio.currentTime = ratio * stageDuration();
            if (timeCurrent) {
                timeCurrent.textContent = formatTime(audio.currentTime);
            }
            seek.style.setProperty("--seek", `${percent.toFixed(2)}%`);
        });
        seek.addEventListener("change", () => {
            seekDragging = false;
        });
    }

    if (drawer && drawerToggle) {
        drawerToggle.addEventListener("click", () => {
            const open = drawer.classList.toggle("open");
            drawer.setAttribute("aria-hidden", String(!open));
        });
        drawerClose?.addEventListener("click", () => {
            drawer.classList.remove("open");
            drawer.setAttribute("aria-hidden", "true");
        });
    }

    if (renderMode) {
        document.body.classList.add("render-mode", "lyric-render-mode");
        audio?.pause();
        if (audio) {
            audio.muted = true;
        }
        window.__stageSetFrame = (frame, frameRate = fps) => {
            renderT = frame / frameRate;
            applyStage(renderT, 1 / frameRate);
            return frame;
        };
        window.__stageState = () => ({
            t: renderT,
            rows: rows.length,
            active: activeIndex,
            duration: stageDuration()
        });
        window.__stageReady = true;
        applyStage(0, 1 / fps);
    } else {
        requestAnimationFrame(tick);
    }

    loadFoliaDirector();
    document.fonts?.ready.then(() => Object.values(slots).forEach(packSlot));
    window.addEventListener('pagehide', () => foliaDirector?.destroy(), { once: true });
    updatePlayIcon();
    window.__stageTimeline = { now: stageTime, apply: applyStage };
})();
