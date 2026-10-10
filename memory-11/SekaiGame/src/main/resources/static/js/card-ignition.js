// Use Anime.js' single-file ESM bundle here. Loading the package's modular entry
// over a mobile tunnel fans out into dozens of requests and can leave the auth
// screen waiting before the application module is evaluated.
import { createTimeline, splitText, stagger, waapi } from "./vendor/anime.esm.js";
import { ELEMENT_NAMES } from "./cards.js";
import { cardArtHtml } from "./card-view.js";

const FULL_TIMING = Object.freeze({
    total: 1100,
    cardStagger: 35,
    heroReveal: 420,
    copyReveal: 620,
    uiSettle: 780,
});

const REDUCED_TIMING = Object.freeze({
    total: 0,
    cardStagger: 0,
    heroReveal: 0,
    copyReveal: 0,
    uiSettle: 0,
});

const PACK_TIMING = Object.freeze({
    cardStagger: 42,
    total: 980,
    tear: 180,
    reveal: 560,
});

const REDUCED_PACK_TIMING = Object.freeze({ cardStagger: 0, total: 0, tear: 0, reveal: 0 });

// 稀有度 → 色彩（pjsk 式：用颜色预告稀有度，抽卡前先给一道对应色的全屏闪光）
const RARITY_COLOR = { N: "#9aa3b2", R: "#5b8bff", SR: "#c77dff", SSR: "#ffd66e", UR: "#ff86e0" };
// 属性 → 色彩（SSR/UR 全屏接管时把整屏染成该卡属性色）
const ATTR_COLOR = {
    fire: "#ff6b3d", water: "#46aaff", wind: "#6ef0aa",
    earth: "#d7a550", light: "#ffe180", dark: "#aa6eff", none: "#7b72ff",
};

export function getIgnitionTiming(reducedMotion = false) {
    return reducedMotion ? REDUCED_TIMING : FULL_TIMING;
}

export function getPackOverloadTiming(reducedMotion = false) {
    return reducedMotion ? REDUCED_PACK_TIMING : PACK_TIMING;
}

export function selectIgnitionCards(cards = [], limit = 8) {
    const selected = [];
    const seen = new Set();
    for (const card of cards) {
        if (!card?.id || seen.has(card.id)) continue;
        seen.add(card.id);
        selected.push(card);
        if (selected.length >= limit) break;
    }
    return selected;
}

function prefersReducedMotion(root, requested) {
    if (typeof requested === "boolean") return requested;
    const view = root?.ownerDocument?.defaultView || (typeof window !== "undefined" ? window : null);
    return Boolean(view?.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

function noopHandle() {
    return { cancel() {}, play() {} };
}

function resetIgnitionState(root) {
    root.classList.remove("is-ignited", "is-launching", "is-static");
    root.querySelectorAll(".ignition-flight").forEach(flight => {
        flight.style.removeProperty("transform");
    });
    root.querySelectorAll(".ignition-card").forEach(card => {
        card.style.removeProperty("transform");
        card.style.removeProperty("opacity");
    });
    root.querySelectorAll(".ignition-word").forEach(word => {
        word.style.removeProperty("transform");
        word.style.removeProperty("opacity");
    });
}

function makeStable(root) {
    root.classList.add("is-ignited", "is-static");
    root.querySelectorAll(".ignition-flight, .ignition-card, .ignition-word").forEach(element => {
        element.style.opacity = "1";
    });
}

function createTitleSplit(root) {
    const title = root.querySelector(".ignition-title");
    if (!title) return null;
    if (!root.__ignitionSplit) {
        root.__ignitionSplit = splitText(title, {
            words: { wrap: "clip", class: "ignition-word" },
            accessible: true,
        });
    }
    return root.__ignitionSplit;
}

export function playCardIgnition(root, options = {}) {
    if (!root) return noopHandle();
    const reducedMotion = prefersReducedMotion(root, options.reducedMotion);
    const timing = getIgnitionTiming(reducedMotion);
    const onComplete = typeof options.onComplete === "function" ? options.onComplete : () => {};

    resetIgnitionState(root);
    if (reducedMotion) {
        makeStable(root);
        onComplete();
        return noopHandle();
    }

    root.classList.add("is-igniting");
    const flights = [...root.querySelectorAll(".ignition-flight")];
    const cards = flights.map(flight => flight.querySelector(".ignition-card")).filter(Boolean);
    const hero = root.querySelector(".ignition-hero-card");
    const copy = root.querySelector(".ignition-copy");
    const dock = root.querySelector(".ignition-dock");
    const split = createTitleSplit(root);
    const animations = [];

    if (flights.length) {
        animations.push(waapi.animate(flights, {
            translateX: element => [0, Number(element.dataset.igniteX || 0)],
            translateY: element => [0, Number(element.dataset.igniteY || 0)],
            delay: stagger(timing.cardStagger),
            duration: 720,
            ease: "outExpo",
        }));
        animations.push(waapi.animate(cards, {
            scale: [0.42, 1],
            rotate: element => [Number(element.dataset.igniteRotate || 0) - 10, Number(element.dataset.igniteRotate || 0)],
            opacity: [0, 1],
            delay: stagger(timing.cardStagger),
            duration: 560,
            ease: "outBack",
        }));
    }

    const timeline = createTimeline({
        autoplay: false,
        defaults: { ease: "outExpo" },
    });

    if (hero) {
        timeline.add(hero, {
            opacity: [0, 1],
            scale: [0.78, 1],
            rotateY: [-82, 0],
            translateY: [18, 0],
            duration: 560,
        }, timing.heroReveal);
    }
    if (copy) {
        timeline.add(copy, {
            opacity: [0, 1],
            translateY: [22, 0],
            duration: 420,
        }, timing.copyReveal);
    }
    if (split?.words?.length) {
        timeline.add(split.words, {
            opacity: [0, 1],
            translateY: [26, 0],
            delay: stagger(48),
            duration: 480,
            ease: "outBack",
        }, timing.copyReveal + 40);
    }
    if (dock) {
        timeline.add(dock, {
            opacity: [0, 1],
            translateY: [24, 0],
            duration: 360,
        }, timing.uiSettle);
    }
    timeline.call(() => {
        root.classList.remove("is-igniting");
        root.classList.add("is-ignited");
        onComplete();
    }, timing.total);
    timeline.play();

    return {
        cancel() {
            timeline.pause();
            // Edge 在已完成或已脱离 DOM 的 WAAPI 动画上执行
            // commitStyles()+cancel() 会偶发卡死渲染线程；暂停后页面根节点
            // 会被下一次路由渲染替换，避免再次触发这个原生取消路径。
            animations.forEach(animation => animation.pause());
            resetIgnitionState(root);
        },
        play() {
            timeline.play();
        },
    };
}

export function playDuelLaunch(root, options = {}) {
    if (!root) {
        options.onComplete?.();
        return noopHandle();
    }
    const reducedMotion = prefersReducedMotion(root, options.reducedMotion);
    const onComplete = typeof options.onComplete === "function" ? options.onComplete : () => {};
    if (reducedMotion) {
        onComplete();
        return noopHandle();
    }

    const target = root.querySelector(".ignition-hero-card") || root;
    const overlay = root.querySelector(".ignition-launch-overlay");
    const timeline = createTimeline({
        autoplay: false,
        defaults: { ease: "outExpo" },
    });
    root.classList.add("is-launching");
    timeline.add(target, {
        scale: [1, 1.16],
        rotateY: [0, 12],
        translateZ: [0, 140],
        duration: 360,
        ease: "inBack",
    });
    if (overlay) {
        timeline.add(overlay, {
            opacity: [0, 1],
            scale: [0.55, 1.35],
            duration: 430,
            ease: "outExpo",
        }, "-=180");
    }
    timeline.call(() => {
        root.classList.remove("is-launching");
        onComplete();
    }, "+=80");
    timeline.play();
    return {
        cancel() {
            timeline.pause();
            root.classList.remove("is-launching");
        },
        play() {
            timeline.play();
        },
    };
}

/**
 * 卡包开启演出（AE 剪辑风）。
 * 用项目自身元素编排六段镜头：撕包 → 光束 → 元素爆发 → 翻面揭示 → 稀有度分层演出 → 汇总。
 * 与旧版只有"标签浮起+光环"的前端标签特效不同，这里每一段都绑定游戏视觉语言
 * （SG 卡背徽记被撕开、六种元素色光尘爆发、卡牌 3D 翻面、最高稀有度英雄聚光）。
 * @param {{reducedMotion?:boolean, heroCard?:object|null, highestRarity?:string}} options
 */
export function playPackOverload(root, options = {}) {
    if (!root) return noopHandle();
    const reducedMotion = prefersReducedMotion(root, options.reducedMotion);
    const onComplete = typeof options.onComplete === "function" ? options.onComplete : () => {};
    const wrapped = root.querySelector(".pack-wrapped");
    const emblem = root.querySelector(".pack-wrapped-emblem");
    const shards = [...root.querySelectorAll(".pack-wrapped-shard")];
    const beam = root.querySelector(".pack-beam");
    const flash = root.querySelector(".pack-flash");
    const burst = root.querySelector(".pack-burst");
    const elements = [...root.querySelectorAll(".pack-element")];
    const sparkField = root.querySelector(".pack-spark-field");
    const sparks = [];
    if (sparkField && typeof document !== "undefined") {
        const SPARK_COUNT = 16;
        for (let i = 0; i < SPARK_COUNT; i++) {
            const s = document.createElement("span");
            s.className = "pack-spark";
            sparkField.appendChild(s);
            sparks.push(s);
        }
    }
    const banner = root.querySelector("#pack-rarity-banner");
    const flipCards = [...root.querySelectorAll(".pack-flip-card")];
    const flipInners = flipCards.map(card => card.querySelector(".pack-flip-inner")).filter(Boolean);
    const copy = root.querySelector(".pack-stage-copy");
    const hero = root.querySelector("#pack-hero");
    const highest = options.highestRarity || "N";
    const heroCard = options.heroCard || null;
    const heroIndex = flipCards.findIndex(card => card.dataset.hero === "true");
    const isSpotlight = Boolean(heroCard) && (highest === "SSR" || highest === "UR");
    if (banner) {
        banner.textContent = highest;
        const bannerElem = String(heroCard?.attribute || heroCard?.element || "none").replace(/["'<>\s]/g, "");
        banner.dataset.elem = bannerElem;
    }
    const rarityFlash = root.querySelector(".pack-rarity-flash");
    const colorWash = root.querySelector(".pack-color-wash");
    const noteField = root.querySelector(".pack-note-field");
    const rhythm = root.querySelector(".dimension-rhythm");
    const rhythmNotes = [...root.querySelectorAll(".dimension-note")];
    const judge = root.querySelector(".dimension-judge");
    const status = root.querySelector(".dimension-status");
    const statusLabel = status?.querySelector("strong");
    const statusProgress = status?.querySelector("i");
    if (rarityFlash) rarityFlash.style.background = RARITY_COLOR[highest] || "#7b72ff";
    if (colorWash && heroCard) {
        const ac = ATTR_COLOR[String(heroCard.attribute || heroCard.element || "none").toLowerCase()] || "#7b72ff";
        colorWash.style.background = ac;
    }
    const notes = [];
    if (noteField && typeof document !== "undefined") {
        const NOTE_GLYPHS = ["♪", "♫", "♬", "✧"];
        const NOTE_COUNT = 22;
        for (let i = 0; i < NOTE_COUNT; i++) {
            const n = document.createElement("span");
            n.className = "pack-note";
            n.textContent = NOTE_GLYPHS[i % NOTE_GLYPHS.length];
            n.style.fontSize = `${15 + (i % 4) * 7}px`;
            n.style.left = `${50 + (((i * 37) % 60) - 30)}%`;
            noteField.appendChild(n);
            notes.push(n);
        }
    }

    if (reducedMotion || flipCards.length === 0) {
        root.classList.add("is-pack-open", "is-static");
        flipCards.forEach(card => card.classList.add("is-face-up"));
        if (copy) copy.style.opacity = "1";
        onComplete();
        return noopHandle();
    }

    root.classList.add("is-pack-opening");
    const animations = [];
    const timeline = createTimeline({ autoplay: false, defaults: { ease: "outExpo" } });

    // 前奏 · 次元音轨校准：三颗音符按拍落到判定线，建立音游式期待感。
    if (rhythm) timeline.add(rhythm, { opacity: [0, 1], duration: 180 }, 0);
    if (rhythmNotes.length) {
        timeline.add(rhythmNotes, {
            translateY: [-240, 0],
            scale: [.7, 1.15, 1],
            opacity: [0, 1, 1],
            delay: stagger(105),
            duration: 430,
            ease: "inCubic",
        }, 0);
    }
    if (judge) timeline.add(judge, { scaleX: [.25, 1.08, 1], opacity: [.2, 1, .55], duration: 620, ease: "outExpo" }, 260);
    if (statusProgress) timeline.add(statusProgress, { scaleX: [0, 1], duration: 520, ease: "inOutCubic" }, 0);
    timeline.call(() => { if (statusLabel) statusLabel.textContent = "共鸣成功"; }, 500);
    if (status) timeline.add(status, { opacity: [1, 0], translateY: [0, -12], duration: 220 }, 620);
    if (rhythm) timeline.add(rhythm, { opacity: [1, 0], scale: [1, 1.08], duration: 260 }, 620);

    // 第一段 · 撕包：四块碎片向外剥落，徽记轻微回弹。
    if (shards.length) {
        const dirs = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
        animations.push(waapi.animate(shards, {
            translateX: (el, i) => [0, dirs[i % 4][0] * 96],
            translateY: (el, i) => [0, dirs[i % 4][1] * 96],
            rotate: (el, i) => [0, dirs[i % 4][0] * 46],
            scale: [1, .55],
            opacity: [1, 0],
            delay: 130,
            duration: 300,
            ease: "inBack",
            fill: "forwards",
        }));
    }
    if (emblem) {
        timeline.add(emblem, { scale: [1, 1.14], rotate: [-4, 0], duration: 240, ease: "outBack" }, 0);
    }
    // pjsk 式稀有度色彩预告：开场一道按最高稀有度着色的全屏闪光，先"剧透"这包成色。
    if (rarityFlash) {
        timeline.add(rarityFlash, { opacity: [0, .82, 0], duration: 520, ease: "outExpo" }, 30);
    }

    // 第二段 · 光束：竖直光柱自裂缝冲起，全屏闪白；撕包瞬间补一道裂缝白闪。
    if (flash) {
        timeline.add(flash, { opacity: [0, .5, 0], duration: 200, ease: "outExpo" }, 130);
        timeline.add(flash, { opacity: [0, .82, 0], duration: 440, ease: "outExpo" }, 392);
    }
    if (beam) {
        timeline.add(beam, { scaleY: [0, 1], opacity: [0, .92], duration: 360, ease: "outExpo" }, 360);
        timeline.add(beam, { opacity: [.92, 0], duration: 540 }, 720);
    }
    // 镜头冲击：光束冲起时整屏轻微推近，强化"开包"的顿挫感。
    timeline.add(root, { scale: [1, 1.045, 1], duration: 300, ease: "outExpo" }, 360);

    // 第三段 · 元素爆发：六元素色光尘沿径向炸开再收束（本项目六种属性）。
    // 镜头震颤：爆发命中时整屏抖一下，配合冲击波环更有"炸开"的实感。
    timeline.add(root, { translateX: [0, -6, 6, -4, 2, 0], translateY: [0, 4, -4, 3, -2, 0], duration: 300, ease: "inOutSine" }, 440);
    if (elements.length) {
        const n = elements.length;
        animations.push(waapi.animate(elements, {
            translateX: (el, i) => { const a = (i / n) * Math.PI * 2; return [0, Math.cos(a) * 168]; },
            translateY: (el, i) => { const a = (i / n) * Math.PI * 2; return [0, Math.sin(a) * 168]; },
            scale: [.3, 1.15, .2],
            opacity: [0, 1, 0],
            rotate: (el, i) => [0, i % 2 ? 200 : -200],
            delay: 440,
            duration: 760,
            ease: "inOutSine",
            fill: "forwards",
        }));
    }
    if (burst) {
        timeline.add(burst, { scale: [.15, 1.95], opacity: [0, .9, 0], duration: 480, ease: "outExpo" }, 440);
    }
    // 光尘火花：在六属性爆发之外，再炸出一圈金白小火花，让"开包"更密更亮。
    if (sparks.length) {
        const sc = sparks.length;
        animations.push(waapi.animate(sparks, {
            translateX: (el, i) => { const a = (i / sc) * Math.PI * 2 + 0.35; return [0, Math.cos(a) * (150 + (i % 3) * 30)]; },
            translateY: (el, i) => { const a = (i / sc) * Math.PI * 2 + 0.35; return [0, Math.sin(a) * (150 + (i % 3) * 30)]; },
            scale: [0, 1, 0],
            opacity: [0, 1, 0],
            rotate: (el, i) => [0, i % 2 ? 280 : -280],
            delay: 440,
            duration: 840,
            ease: "inOutSine",
            fill: "forwards",
        }));
    }
    // 音游魂：♪ 音符粒子自底部缓缓上浮飘散（呼应本作 NIGHTCORD / 夜曲的音乐性，致敬 pjsk·ournote 的节奏演出）。
    if (notes.length) {
        const nc = notes.length;
        animations.push(waapi.animate(notes, {
            translateY: (el, i) => [60 + (i % 5) * 14, -220 - (i % 6) * 46],
            translateX: (el, i) => [0, ((i % 2) ? 1 : -1) * (24 + (i % 3) * 20)],
            opacity: [0, .95, 0],
            rotate: (el, i) => [0, (i % 2 ? 180 : -180)],
            delay: (el, i) => 320 + (i % 7) * 46,
            duration: 3000,
            ease: "inOutSine",
            fill: "forwards",
        }));
    }

    // 第四段 · 翻面揭示：卡牌从中心飞到扇形位，再 3D 翻面亮出卡面。
    animations.push(waapi.animate(flipCards, {
        translateX: el => Number(el.dataset.packX || 0),
        translateY: el => Number(el.dataset.packY || 0),
        rotate: el => [Number(el.dataset.packRotate || 0) - 14, Number(el.dataset.packRotate || 0)],
        scale: [.5, 1],
        opacity: [0, 1],
        delay: 600,
        duration: 560,
        ease: "outBack",
        fill: "forwards",
    }));
    if (wrapped) timeline.add(wrapped, { opacity: [1, 0], scale: [1, .82], duration: 320, ease: "outExpo" }, 600);
    if (flipInners.length) {
        timeline.add(flipInners, { rotateY: [0, 180], delay: stagger(70), duration: 520, ease: "inOutCubic" }, 720);
    }

    // 第五段 · 稀有度分层演出：SSR/UR 升起为英雄卡，其余退场变暗。
    if (isSpotlight && heroIndex >= 0) {
        const heroEl = flipCards[heroIndex];
        const hx = Number(heroEl.dataset.packX || 0);
        const hy = Number(heroEl.dataset.packY || 0);
        root.classList.add("is-pack-spotlight");
        timeline.add(heroEl, {
            translateX: -hx,
            translateY: -hy - 78,
            rotate: 0,
            scale: 1.95,
            duration: 680,
            ease: "outExpo",
            fill: "forwards",
        }, 1480);
        timeline.add(flipCards.filter((_, i) => i !== heroIndex), {
            opacity: [1, .16],
            scale: [1, .82],
            duration: 440,
            fill: "forwards",
        }, 1480);
        if (hero && heroCard) {
            const elem = String(heroCard.attribute || heroCard.element || "none").replace(/["'<>\s]/g, "");
            hero.innerHTML = `<span class="pack-hero-aura" data-elem="${elem}"></span>`;
            timeline.add(hero, { opacity: [0, 1], scale: [.6, 1], duration: 540, ease: "outBack" }, 1504);
        }
        // 稀有度大字横幅：SSR/UR 升起时同步砸出稀有度字样，是整段演出的"高光标点"。
        if (banner) {
            timeline.add(banner, { opacity: [0, 1], scale: [.4, 1.18, 1], rotate: [-7, 0], duration: 820, ease: "outBack", fill: "forwards" }, 1504);
        }
        if (colorWash) {
            timeline.add(colorWash, { opacity: [0, .55], duration: 560, ease: "outExpo", fill: "forwards" }, 1504);
        }
        if (rarityFlash) {
            timeline.add(rarityFlash, { opacity: [0, .6, 0], duration: 620, ease: "outExpo" }, 1524);
        }
    }

    // 第六段 · 汇总：文案与按钮淡入。
    if (copy) {
        timeline.add(copy, { opacity: [0, 1], translateY: [20, 0], duration: 360 }, isSpotlight ? 2140 : 1520);
    }
    timeline.call(() => {
        root.classList.remove("is-pack-opening");
        root.classList.add("is-pack-open");
        onComplete();
    }, isSpotlight ? 2320 : 1720);
    timeline.play();

    return {
        cancel() {
            timeline.pause();
            animations.forEach(animation => animation.pause());
            root.classList.remove("is-pack-opening");
        },
        play() {
            timeline.play();
        },
    };
}

/**
 * Character-led recruitment. Rarity changes are visual only; rewards are already settled.
 * One timeline owns every shot so skipping cannot leave a later reveal running.
 */
export function playDimensionRecruitment(root, options = {}) {
    if (!root) return noopHandle();
    const onComplete = typeof options.onComplete === "function" ? options.onComplete : () => {};
    const highest = options.highestRarity || "N";
    const high = highest === "SSR" || highest === "UR";
    const reduced = options.reducedMotion === true || prefersReducedMotion(root);
    const all = selector => [...root.querySelectorAll(selector)];
    const cards = all(".pack-flip-card");
    const inners = all(".pack-flip-inner");
    const finalColor = RARITY_COLOR[highest] || RARITY_COLOR.N;
    root.style.setProperty("--melody-rarity", finalColor);
    let cancelled = false;
    let complete = false;
    const finish = () => {
        if (cancelled || complete) return;
        complete = true;
        root.classList.remove("is-recruiting");
        root.classList.add("is-pack-open");
        onComplete();
    };
    root.classList.add("is-recruiting");
    if (reduced || !cards.length) {
        root.classList.add("is-static");
        cards.forEach(card => {
            card.style.transform = `translate(${card.dataset.packX}px, ${card.dataset.packY}px)`;
            card.style.opacity = "1";
            card.querySelector(".pack-flip-inner").style.transform = "rotateY(180deg)";
        });
        finish();
        return noopHandle();
    }
    const timeline = createTimeline({ autoplay: false, defaults: { ease: "outCubic" } });
    const shot = (selector, params, time) => {
        const elements = all(selector);
        if (elements.length) timeline.add(elements, params, time);
    };
    // Opening: an illustrated character and a moving musical staff share the frame.
    shot(".melody-opening", { opacity: [0, 1], duration: 380 }, 0);
    shot(".melody-host", { translateX: ["-12vw", "0vw"], rotate: [-5, -2], opacity: [0, 1], duration: 1250 }, 100);
    shot(".melody-host-shadow", { translateX: ["-5vw", "0vw"], opacity: [0, .22], duration: 1500 }, 100);
    shot(".melody-title", { translateY: [24, 0], opacity: [0, 1], duration: 800 }, 360);
    shot(".melody-staff", { translateX: ["-18vw", "0vw"], opacity: [0, .75], duration: 1600 }, 300);
    shot(".melody-petals i", { translateY: [100, -120], translateX: [0, 100], rotate: [0, 160], opacity: [0, .8, 0], delay: stagger(60), duration: 5700, ease: "linear" }, 0);
    // Each element has an organic silhouette and its own route toward the note.
    shot(".melody-gather", { opacity: [0, 1], duration: 220 }, 1100);
    shot(".melody-title", { opacity: [1, 0], duration: 450 }, 1150);
    all(".melody-element").forEach((element, index) => {
        const angle = (index * 60 - 90) * Math.PI / 180;
        const x = Math.cos(angle) * 25;
        const y = Math.sin(angle) * 25;
        timeline.add(element, { translateX: [`${x * 1.4}vmin`, `${x}vmin`], translateY: [`${y * 1.4}vmin`, `${y}vmin`], scale: [.3, 1], opacity: [0, 1], rotate: [-25, 0], duration: 650 }, 1100 + index * 70);
        timeline.add(element, { translateX: "0vmin", translateY: "0vmin", scale: [1, .08], opacity: [1, 0], duration: 600, ease: "inCubic" }, 2140 + index * 55);
    });
    shot(".melody-orb", { scale: [0, 1.12, 1], opacity: [0, 1], duration: 750 }, 2250);
    shot(".melody-opening", { opacity: [1, 0], scale: [1, 1.06], duration: 550 }, 2460);
    shot(".melody-gather", { scale: [1, 1.5], opacity: [1, 0], duration: 460, ease: "inCubic" }, 2920);
    // A card follows a broad curved flight through a pastel sky.
    shot(".melody-flight", { opacity: [0, 1], duration: 450 }, 2900);
    shot(".melody-cloud", { translateX: ["8vw", "-24vw"], scale: [1, 1.2], duration: 2500, ease: "inCubic" }, 2900);
    shot(".melody-flying-card", { translateX: ["-35vw", "-9vw", "14vw"], translateY: ["18vh", "-8vh", "-3vh"], rotate: [-32, 14, 6], scale: [.25, .7, 1], opacity: [0, 1], duration: 1750, ease: "inOutCubic" }, 3050);
    shot(".melody-trail", { scaleX: [0, 1.1], opacity: [0, .85], duration: 1300 }, 3120);
    // Two cropped character shots punctuate the last beat before the card turns.
    shot(".melody-cutins > div", { translateX: ["-110%", "0%"], opacity: [0, 1], delay: stagger(160), duration: 420 }, 3980);
    shot(".melody-cutins", { translateX: ["0vw", "110vw"], duration: 420, ease: "inCubic" }, 4570);
    if (high) {
        // Start blue, then reveal the actual precomputed rarity on the final beat.
        timeline.call(() => root.classList.add("is-upgraded"), 4790);
        shot(".melody-flying-card", { scale: [1, .96, 1.13], rotate: [6, -4, 0], duration: 490 }, 4660);
        shot(".melody-white", { opacity: [0, .8, 0], duration: 430 }, 4840);
    }
    shot(".melody-flying-card", { scale: [1.1, 2.7], rotateY: [0, 180], opacity: [1, 0], duration: 580, ease: "inCubic" }, 5090);
    shot(".melody-white", { opacity: [0, 1, 0], duration: 680 }, 5330);
    shot(".melody-flight", { opacity: [1, 0], duration: 280 }, 5540);
    // A full-viewport illustration, with a deliberately readable name and rarity.
    shot(".melody-reveal", { opacity: [0, 1], duration: 240 }, 5530);
    shot(".melody-reveal-picture", { translateX: ["9vw", "0vw"], scale: [1.1, 1], duration: 1200 }, 5540);
    shot(".melody-reveal-echo", { translateX: ["-5vw", "0vw"], scale: [1.04, 1], duration: 1400 }, 5540);
    shot(".melody-reveal-caption", { translateY: [35, 0], opacity: [0, 1], duration: 600 }, 5910);
    const resultsAt = high ? 7700 : 7200;
    shot(".melody-reveal", { opacity: [1, 0], translateY: [0, -24], duration: 450 }, resultsAt);
    shot(".melody-result-title", { opacity: [0, 1], translateY: [12, 0], duration: 450 }, resultsAt + 250);
    if (cards.length) timeline.add(cards, {
        translateX: el => Number(el.dataset.packX || 0),
        translateY: el => Number(el.dataset.packY || 0),
        scale: [.7, 1], opacity: [0, 1], delay: stagger(50), duration: 500,
    }, resultsAt + 260);
    if (inners.length) timeline.add(inners, { rotateY: [0, 180], delay: stagger(65), duration: 500, ease: "inOutCubic" }, resultsAt + 550);
    timeline.call(finish, resultsAt + 1200 + Math.max(0, cards.length - 1) * 65);
    timeline.play();
    return {
        cancel() {
            cancelled = true;
            timeline.pause();
            root.classList.remove("is-recruiting");
        },
        play() { if (!cancelled) timeline.play(); },
    };
}

export function playAuthIgnition(root, options = {}) {
    if (!root) return noopHandle();
    const reducedMotion = prefersReducedMotion(root, options.reducedMotion);
    if (reducedMotion) {
        root.classList.add("is-auth-ready");
        return noopHandle();
    }
    const cards = [...root.querySelectorAll(".auth-ignition-card")];
    const panel = root.querySelector(".auth-panel");
    const timeline = createTimeline({ autoplay: false, defaults: { ease: "outExpo" } });
    if (cards.length) {
        timeline.add(cards, {
            opacity: [0, 1],
            scale: [0.56, 1],
            rotate: element => [Number(element.dataset.authRotate || -8), 0],
            delay: stagger(55),
            duration: 520,
            ease: "outBack",
        });
    }
    if (panel) {
        timeline.add(panel, {
            opacity: [0, 1],
            translateY: [28, 0],
            duration: 520,
        }, "-=300");
    }
    timeline.call(() => root.classList.add("is-auth-ready"));
    timeline.play();
    return {
        cancel() {
            timeline.pause();
        },
        play() {
            timeline.play();
        },
    };
}

/**
 * 抽卡 PV 演出：角色特写快切
 *
 * 开包流程结束后，把抽到的卡用「番剧 OP 式」快切过一遍——全屏大立绘推近 +
 * 名字大字 + 属性/稀有度标 + 属性色速度线与光带扫过。抽卡就能看到 PV 那套演出。
 *
 * @param {HTMLElement} root 抽卡舞台（.kinetic-pack-stage）
 * @param {Array} cards 抽到的卡（{card} 或直接 card 都兼容）
 * @param {{reducedMotion?:boolean, limit?:number, cutMs?:number, onSkip?:Function}} options
 * @returns {{cancel:Function}}
 */
/**
 * 抽卡 PV 演出：角色特写快切（AE 六件套版）
 *
 * 复刻 AE 演出语言，让画面"活"起来：
 *   1. 逐字遮罩标题（每字从遮罩下方顶出）
 *   2. 镜头推拉 + 运动模糊（入镜瞬间模糊，落位清晰）
 *   3. 形状遮罩转场（clip-path 横向擦除）
 *   4. 抽帧闪白 + 色差（切镜硬闪 + RGB 分离）
 *   5. 辉光后期（同图高斯模糊提亮做 bloom）
 *   6. 卡点节奏（每拍一次硬闪 + 镜头顿挫，每 2 拍加重）
 *
 * @param {HTMLElement} root 容器（需为 absolute/fixed 铺满的舞台）
 * @param {Array} cards 抽到的卡（{card} 或直接 card 都兼容）
 * @param {{reducedMotion?:boolean, limit?:number, cutMs?:number, onSkip?:Function}} options
 * @returns {{cancel:Function}}
 */
export function playPackPvShowcase(root, cards = [], options = {}) {
    if (!root) return noopHandle();
    if (prefersReducedMotion(root, options.reducedMotion)) return noopHandle();

    const limit = Math.max(1, Math.min(8, options.limit || 6));
    const picks = pickShowcaseCards(cards, limit);
    if (!picks.length) return noopHandle();

    const layer = document.createElement("div");
    layer.className = "pack-pv-layer";
    layer.innerHTML = picks.map((card, i) => {
        const alt = i % 2 ? " right" : "";
        const c = ATTR_COLOR[card.attribute] || "#7b72ff";
        const rc = RARITY_COLOR[card.rarity] || "#ffd66e";
        const src = card.fullImage || card.image || card.thumbnail || "";
        const name = escapeText(card.name || "");
        // 1. 逐字遮罩：每个字包一层 overflow:hidden 的兜
        const chars = Array.from(name).map(ch => {
            const glyph = ch === " " ? "&nbsp;" : escapeText(ch);
            return `<span class="ch"><i>${glyph}</i></span>`;
        }).join("");
        return `<div class="pack-pv-cut${alt}" style="--c:${c};--rc:${rc}">
            <div class="pack-pv-rays" aria-hidden="true"></div>
            <div class="pack-pv-wipe" aria-hidden="true"></div>
            <div class="pack-pv-stage">
                <div class="pack-pv-bloom" aria-hidden="true"><img src="${escapeText(src)}" alt=""></div>
                <div class="pack-pv-art"><img class="pack-pv-art-img" src="${escapeText(src)}" alt="${name}"></div>
            </div>
            <div class="pack-pv-txt">
                <div class="pack-pv-name">${chars}</div>
                <div class="pack-pv-meta">
                    <span class="pack-pv-attr">${ELEMENT_NAMES[card.attribute] || "无"}</span>
                    <span class="pack-pv-rar">${escapeText(card.rarity)}</span>
                </div>
            </div>
            <div class="pack-pv-flash" aria-hidden="true"></div>
        </div>`;
    }).join("");
    root.appendChild(layer);
    // cardArtHtml 默认 loading=lazy，快切节奏下会漏载
    layer.querySelectorAll("img").forEach(img => { img.loading = "eager"; img.decoding = "sync"; });

    const CUT = options.cutMs || 520;
    const cuts = Array.from(layer.querySelectorAll(".pack-pv-cut"));
    cuts.forEach((el, k) => {
        const t0 = k * CUT, dir = (k % 2 ? -1 : 1);
        const art = el.querySelector(".pack-pv-art");
        const bloom = el.querySelector(".pack-pv-bloom");
        const stage = el.querySelector(".pack-pv-stage");
        const txt = el.querySelector(".pack-pv-txt");
        const nameEl = el.querySelector(".pack-pv-name");
        const rays = el.querySelector(".pack-pv-rays");
        const wipe = el.querySelector(".pack-pv-wipe");
        const flash = el.querySelector(".pack-pv-flash");

        // 注意：waapi.animate 内部强制 fill:"both"，且把未知参数键当成 CSS 属性去动画，
        // 因此这里不传 fill；transform 全部用原生关键帧字符串，不依赖 @property 注册。
        // 整体：淡入 → 保持 → 淡出
        waapi.animate(el, { opacity: [0, 1, 1, 0], duration: CUT + 140, delay: t0, ease: "linear" });
        // 2. 镜头推拉 + 卡点冲击：1.09 砸入 → 回弹缓推到 1
        waapi.animate(el, { transform: ["scale(1.09)", "scale(1.05)", "scale(1)"], duration: CUT + 160, delay: t0, ease: "outExpo" });
        // 3. 形状遮罩转场：横向擦除入场
        waapi.animate(el, {
            clipPath: [`inset(0 ${dir > 0 ? 100 : 0}% 0 ${dir > 0 ? 0 : 100}%)`, "inset(0 0% 0 0%)"],
            duration: 340, delay: t0, ease: "outExpo",
        });

        // 立绘滑入 + Ken Burns
        waapi.animate(stage, { transform: [`translateX(${dir * 150}px)`, "translateX(0px)"], duration: CUT + 140, delay: t0, ease: "outExpo" });
        waapi.animate(art, { transform: ["scale(1)", "scale(1.09)"], duration: CUT + 140, delay: t0, ease: "outExpo" });
        // 2b. 运动模糊：入镜瞬间糊，落位清晰
        waapi.animate(art, { filter: ["blur(0px)", "blur(7px)", "blur(0px)"], duration: CUT, delay: t0, ease: "inOutQuad" });
        // 5. 辉光呼吸
        waapi.animate(bloom, { opacity: [.35, .75, .45], transform: ["scale(1.08)", "scale(1.16)", "scale(1.12)"], duration: CUT + 140, delay: t0, ease: "inOutSine" });

        // 文字反向滑入
        waapi.animate(txt, { transform: [`translateX(${dir * -100}px)`, "translateX(0px)"], opacity: [0, 1], duration: 400, delay: t0 + 90, ease: "outExpo" });
        // 1. 逐字顶出
        const glyphs = nameEl.querySelectorAll(".ch i");
        waapi.animate(glyphs, { transform: ["translateY(115%)", "translateY(0%)"], duration: 420, delay: stagger(24, { start: t0 + 150 }), ease: "outExpo" });
        // 4. 色差：切镜瞬间 RGB 分离再合拢
        waapi.animate(nameEl, {
            textShadow: [
                "0 0 0 rgba(255,0,90,0), 0 0 0 rgba(0,225,255,0)",
                "5px 0 0 rgba(255,0,90,.75), -5px 0 0 rgba(0,225,255,.75)",
                "0 0 0 rgba(255,0,90,0), 0 0 0 rgba(0,225,255,0)",
            ],
            duration: 300, delay: t0 + 140, ease: "outQuad",
        });

        // 速度线 + 光带
        waapi.animate(rays, { opacity: [0, .6, 0], transform: [`translateX(${dir * -26}%)`, `translateX(${dir * 26}%)`], duration: CUT, delay: t0, ease: "inOutSine" });
        waapi.animate(wipe, { opacity: [0, .85, 0], transform: [`translateX(${dir * -70}%)`, `translateX(${dir * 70}%)`], duration: CUT, delay: t0, ease: "inOutQuad" });

        // 4b. 抽帧闪白（每 2 拍加重一次）
        const accent = (k % 2 === 0);
        waapi.animate(flash, { opacity: [0, accent ? .9 : .55, 0], duration: accent ? 110 : 80, delay: t0, ease: "outQuad" });
    });

    const total = cuts.length * CUT;
    waapi.animate(layer, { opacity: [1, 0], duration: 300, delay: total + 140, ease: "outQuad" });

    let cleanup = null;
    let done = false;
    const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(cleanup);
        layer.remove();
    };
    cleanup = setTimeout(finish, total + 520);
    // 点一下跳过演出，直接进入结果
    layer.addEventListener("click", () => {
        finish();
        if (typeof options.onSkip === "function") options.onSkip();
    });

    return {
        cancel() { finish(); },
        play() {},
    };
}

/** 快切选卡：按稀有度从高到低去重取前 N 张（保证最高稀有度一定出场）。 */
function pickShowcaseCards(cards, limit) {
    const rank = { UR: 5, SSR: 4, SR: 3, R: 2, N: 1 };
    const seen = new Set();
    return (cards || [])
        .map(item => (item && item.card) || item)
        .filter(card => card && card.id)
        .filter(card => !seen.has(card.id) && seen.add(card.id))
        .sort((a, b) => (rank[b.rarity] || 0) - (rank[a.rarity] || 0))
        .slice(0, limit);
}

function escapeText(value = "") {
    return String(value)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
