import { playCardTransfer } from "./card-transfer.js";
import { getDuelMotion, motionGeneration, createEffectElement, scheduleVisual as setTimeout, scheduleVisualFrame as requestAnimationFrame } from "./duel-motion.js";
/**
 * effects.js
 * 战斗特效系统 —— 召唤、魔法、陷阱、攻击、伤害、破坏、治愈
 * + 卡牌飞行动画系统（抽卡、出牌）
 */

import { getMonsterCinematicProfile } from "./monster-cinematics.js?v=1.1.1";
import { themedActionParams } from "./themed-effects.js";
import { playSound } from "./audio.js?v=1.0.0";
import { sekaiCardBackHtml } from "./card-view.js?v=1.2.0-bca";
import { getAttackProfile } from "./attack-fx-profiles.js?v=1.0.0";
import { playCardAttack } from "./attack-fx.js?v=1.0.0";
import { playCardPerformance } from "./card-performance-fx.js?v=15-trap-atlas";
import { getCardPerformance } from "./card-performance.js?v=13-trap-atlas";
import { getAuthoredScene } from "./authored-card-scenes.js?v=23-trap-atlas";

const isBrowser = typeof document !== "undefined";
let attackVisualBusyUntil = 0;
const authoredScene = (card, phase) => getAuthoredScene(getCardPerformance(card)?.id, phase);

function removeAfter(el, ms) {
    setTimeout(() => el.remove(), ms);
}

// ---------------------------------------------------------------------
//  特效节点预算
//  一次命中特效会创建 80~120 个带 box-shadow / filter / animation 的绝对定位
//  节点。连击、多体攻击、反击陷阱连锁时这些特效会叠加到同一帧，直接把主线程
//  压到掉帧。这里限制同时存活的命中特效数量，并在已有特效在播时自动降级。
// ---------------------------------------------------------------------
const MAX_CONCURRENT_HIT_IMPACTS = 2;

function hitImpactLoad() {
    if (!isBrowser) return 0;
    return document.querySelectorAll(".hit-impact-container").length;
}

/** 超预算时清掉最早创建的命中特效，保证新的一击永远有表现。 */
function trimHitImpacts() {
    if (!isBrowser) return;
    const nodes = [...document.querySelectorAll(".hit-impact-container")];
    const overflow = nodes.length - MAX_CONCURRENT_HIT_IMPACTS;
    if (overflow <= 0) return;
    for (let i = 0; i < overflow; i++) nodes[i].remove();
}

function spawnParticles(container, cls, count, spread = 30) {
    for (let i = 0; i < Math.ceil(count * getDuelMotion().particleRatio); i++) {
        const p = createEffectElement("div");
        p.className = cls;
        const dx = (Math.random() - 0.5) * spread * 2;
        const dy = -(Math.random() * spread + 10);
        p.style.cssText = `left:calc(50% + ${dx}px);top:calc(50% + ${dy}px);`;
        if (cls === "destroy-particle") {
            p.style.setProperty("--dx", `${dx * 1.5}px`);
            p.style.setProperty("--dy", `${dy * 1.5}px`);
            p.style.background = ["#ff6f8d", "#ffd36b", "#c77dff", "#fff"][Math.floor(Math.random() * 4)];
        }
        container.appendChild(p);
        removeAfter(p, 600);
    }
}

function getRect(el) {
    if (!el) return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 };
    if (typeof el.getBoundingClientRect === "function") return el.getBoundingClientRect();
    return el;
}

function setBattleCamera(battleScreen, { x = 0, y = 0, scale = 1, duration = 180 } = {}) {
    if (!battleScreen || getDuelMotion().quality === "low" || getDuelMotion().reduced) return;
    battleScreen.style.setProperty("--bca-camera-x", x + "px");
    battleScreen.style.setProperty("--bca-camera-y", y + "px");
    battleScreen.style.setProperty("--bca-camera-scale", String(scale));
    battleScreen.style.setProperty("--bca-camera-duration", duration + "ms");
}

const RULE_VISUALS = {
    power: { label: "POWER UP", color: "#ffd36b", accent: "#ff8a4c", motion: "rise" },
    guard: { label: "GUARD", color: "#70e6ff", accent: "#527dff", motion: "shield" },
    heal: { label: "RECOVERY", color: "#74f0b0", accent: "#d8ff91", motion: "rise" },
    draw: { label: "INSIGHT", color: "#79dfff", accent: "#b68cff", motion: "spiral" },
    search: { label: "SEARCH", color: "#62e6ff", accent: "#ffffff", motion: "spiral" },
    damage: { label: "DAMAGE", color: "#ff5d67", accent: "#ffb04a", motion: "impact" },
    destroy: { label: "BREAK", color: "#ff4f70", accent: "#d173ff", motion: "impact" },
    banish: { label: "BANISH", color: "#b379ff", accent: "#342064", motion: "void" },
    return: { label: "RETURN", color: "#63d9ff", accent: "#ffffff", motion: "sweep" },
    revive: { label: "REVIVAL", color: "#9dffb4", accent: "#fff1a8", motion: "rise" },
    summon: { label: "SPECIAL SUMMON", color: "#ffdd73", accent: "#d876ff", motion: "burst" },
    lock: { label: "SEALED", color: "#bd8cff", accent: "#5f55ba", motion: "shield" },
    weaken: { label: "WEAKEN", color: "#a873ff", accent: "#ff5d87", motion: "fall" },
    field: { label: "FIELD SHIFT", color: "#64e3d0", accent: "#6d8cff", motion: "wave" },
    effect: { label: "EFFECT", color: "#e4dfff", accent: "#8f7cff", motion: "burst" },
};

export const THEMED_ACTION_VISUALS = {
    ignite:   { label: "IGNITE", motion: "rise", color: "#ff7a3c", accent: "#ffd36b" },
    venom:    { label: "VENOM", motion: "fall", color: "#9d6bff", accent: "#7dffa8" },
    bleed:    { label: "BLEED", motion: "sweep", color: "#ff4f70", accent: "#ff9b8a" },
    curse:    { label: "CURSE", motion: "shield", color: "#8c5cff", accent: "#2a1740" },
    exile:    { label: "EXILE", motion: "void", color: "#7b5cff", accent: "#1b1035" },
    paralyze: { label: "STUN", motion: "impact", color: "#ffe06b", accent: "#70dcff" },
    detonate: { label: "DETONATE", motion: "impact", color: "#ff5d67", accent: "#ffb04a" },
    combust: { label: "爆血引爆", motion: "impact", color: "#ff5d67", accent: "#ffb04a" },
    railgun: { label: "超电磁炮", motion: "sweep", color: "#7cdfff", accent: "#ffe06b" },
    ensemble: { label: "舞台接力", motion: "spiral", color: "#7ce1dd", accent: "#ffa9da" },
    tempoStrike: { label: "一闪蓄势", motion: "rise", color: "#ffe06b", accent: "#ffffff" },
    infinity: { label: "INFINITY", motion: "shield", color: "#d7e6ff", accent: "#8fb8ff" },
    domain:   { label: "DOMAIN", motion: "wave", color: "#cfd6ff", accent: "#8f7cff" },
    gamble:   { label: "GAMBLE", motion: "spiral", color: "#ffd76b", accent: "#fff6c9" },
};

// 主题动作 → 音效名（唯一发声点：playRuleDrivenEffect 每次结算播一次）
// gamble 走 onCoinFlip → playCoinFlip → playSound("coin")，此处不重复；
// infinity 无专属音，不播（statusTick 语义属伤害跳字，错配）
const THEMED_ACTION_SOUNDS = {
    ignite:   "ignite",
    venom:    "venom",
    bleed:    "bleed",
    curse:    "curse",
    exile:    "exile",
    paralyze: "paralyze",
    detonate: "detonate",
    domain:   "domain",
};

const CARD_THEME_RULES = [
    [/鸣人|九喇嘛/, { key: "chakra", label: "九喇嘛查克拉", color: "#ff8a2b", accent: "#ffe06b", glyph: "火" }],
    [/佐助|须佐能乎/, { key: "susanoo", label: "须佐能乎", color: "#9366ff", accent: "#e4c4ff", glyph: "瞳" }],
    [/我爱罗|砂瀑/, { key: "sand", label: "砂瀑结界", color: "#d8a35b", accent: "#fff0b0", glyph: "砂" }],
    [/佩恩|神罗天征/, { key: "rinnegan", label: "轮回眼", color: "#b67cff", accent: "#ff697f", glyph: "轮" }],
    [/卡卡西|雷切/, { key: "lightning", label: "雷切", color: "#70dcff", accent: "#ffffff", glyph: "雷" }],
    [/纲手|怪力/, { key: "strength", label: "百豪怪力", color: "#7dff9e", accent: "#ff9bc8", glyph: "力" }],
    [/日之呼吸|缘壹/, { key: "sunfire", label: "日之呼吸", color: "#ff6538", accent: "#ffd86b", glyph: "日" }],
    [/初音未来|音浪|旋律|缤纷节拍|独奏/, { key: "music", label: "共鸣音轨", color: "#43f0db", accent: "#ff7fe1", glyph: "♪" }],
    [/真冬|奏|绘名|瑞希|实乃理|宁宁|雫/, { key: "sekai", label: "SEKAI共鸣", color: "#63ddff", accent: "#ff77c7", glyph: "奏" }],
    [/古见|教室|放学后|约定|笑容|悸动|恶作剧|海梦|真昼/, { key: "memory", label: "青春记忆", color: "#ff9fca", accent: "#a7dcff", glyph: "心" }],
    [/从零开始|异世界/, { key: "re-zero", label: "死亡回归", color: "#816cff", accent: "#8fffe1", glyph: "零" }],
    [/邪王真眼/, { key: "wicked-eye", label: "邪王真眼", color: "#8c5cff", accent: "#ff557f", glyph: "眼" }],
    [/暗影|终焉|血刃|绯狱|断罪/, { key: "abyss", label: "暗影显现", color: "#7b42d9", accent: "#ff3e68", glyph: "影" }],
    [/陷阱|绳索|浅坑|捕兽夹|绊线|伏击|机关|落石|诱饵/, { key: "trap", label: "机关启动", color: "#ff5d70", accent: "#ffd06b", glyph: "!" }],
];

function stableCardSeed(value = "") {
    let seed = 2166136261;
    for (const char of String(value)) {
        seed ^= char.codePointAt(0);
        seed = Math.imul(seed, 16777619) >>> 0;
    }
    return seed;
}

export function getCardVisualTheme(cardOrName = "", type = "effect", attribute = "none") {
    const card = typeof cardOrName === "object" && cardOrName
        ? cardOrName
        : { name: cardOrName, type, attribute };
    const name = String(card.name || "");
    const matched = CARD_THEME_RULES.find(([pattern]) => pattern.test(name))?.[1];
    const fallbackTable = {
        fire: ["flame", "#ff7648", "#ffd05f", "炎"],
        water: ["tide", "#55cfff", "#b4f4ff", "水"],
        wind: ["gale", "#73efb0", "#dcff8f", "风"],
        earth: ["earth", "#d3aa62", "#fff0a8", "岩"],
        light: ["radiance", "#ffe66d", "#ffffff", "光"],
        dark: ["void", "#a36cff", "#ff6d9f", "暗"],
        none: ["arcane", "#8fdcff", "#d9a2ff", "术"],
    };
    // 未知/非字符串属性（含 PvP 对端数据）一律回落到 none，避免解引用 undefined
    const fallback = fallbackTable[card.attribute || card.element || attribute || "none"] || fallbackTable.none;
    const primaryEffect = card.effects?.[0] || card.effect || {};
    const effectKey = ruleVisualKey(primaryEffect.type || type);
    const effectVisual = RULE_VISUALS[effectKey] || RULE_VISUALS.effect;
    const seed = stableCardSeed(`${card.id || ""}:${name}:${card.image || ""}:${primaryEffect.type || type}:${primaryEffect.value || ""}`);
    const fallbackVisual = fallback || fallbackTable.none;
    const base = matched || { key: fallbackVisual[0], label: "卡牌效果", color: fallbackVisual[1], accent: fallbackVisual[2], glyph: fallbackVisual[3] };
    const moveName = name.split(/[·・]/).filter(Boolean).at(-1) || base.label;
    return {
        ...base,
        label: matched ? `${base.label} · ${moveName}` : moveName,
        effectKey,
        effectMotion: effectVisual.motion,
        effectLabel: effectVisual.label,
        image: card.image || "",
        seed,
        variant: seed % 8,
        orbit: 3 + (seed % 6),
        direction: seed % 2 ? 1 : -1,
        hueShift: (seed % 41) - 20,
        intensity: ({ N: .7, R: .9, SR: 1.1, SSR: 1.35, UR: 1.65 }[String(card.rarity || "N").toUpperCase()] || 1),
    };
}

function playCardThemeAccent(card, anchor = null) {
    if (!isBrowser) return false;
    const host = document.getElementById("battle-screen") || document.body;
    if (!host) return false;
    const theme = getCardVisualTheme(card);
    const rect = getRect(anchor || document.getElementById("battlefield"));
    const x = rect.width ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect.height ? rect.top + rect.height / 2 : window.innerHeight * .45;
    const layer = createEffectElement("div");
    layer.className = `card-theme-accent theme-${theme.key} theme-effect-${theme.effectKey} theme-motion-${theme.effectMotion} theme-v${theme.variant}`;
    layer.style.cssText = `--theme-x:${x}px;--theme-y:${y}px;--theme-color:${theme.color};--theme-accent:${theme.accent};--theme-power:${theme.intensity};--theme-hue:${theme.hueShift}deg;--theme-direction:${theme.direction};--theme-orbit:${theme.orbit};`;
    const imageEcho = theme.image
        ? `<div class="card-theme-image" style="background-image:url(&quot;${escapeHtml(theme.image)}&quot;)"></div>`
        : "";
    layer.innerHTML = `${imageEcho}<div class="card-theme-glyph">${theme.glyph}</div><div class="card-theme-name"><strong>${escapeHtml(theme.label)}</strong><small>${theme.effectLabel}</small></div><div class="card-theme-ring"></div><div class="card-theme-cut"></div>`;
    for (let index = 0; index < 14; index++) {
        const particle = createEffectElement("i");
        const angle = (index / 14) * Math.PI * 2 + (theme.seed % 17) / 17;
        const distance = 55 + ((theme.seed >>> (index % 16)) % 95);
        particle.style.cssText = `--tx:${Math.cos(angle) * distance}px;--ty:${Math.sin(angle) * distance}px;--delay:${index * .025}s;`;
        layer.appendChild(particle);
    }
    host.appendChild(layer);
    removeAfter(layer, 1450);
    return true;
}

function ruleVisualKey(effectType = "") {
    const type = String(effectType).toLowerCase();
    if (/heal|recover/.test(type)) return "heal";
    if (/destroy|break/.test(type)) return "destroy";
    if (/damage|burn|reflect/.test(type)) return "damage";
    if (/banish|remove/.test(type)) return "banish";
    if (/return|bounce/.test(type)) return "return";
    if (/revive|recycle/.test(type)) return "revive";
    if (/draw/.test(type)) return "draw";
    if (/search|deck/.test(type)) return "search";
    if (/token|summon/.test(type)) return "summon";
    if (/cannot|lock|disable|seal|freeze/.test(type)) return "lock";
    if (/debuff|reduce|discard/.test(type)) return "weaken";
    if (/defense|protect|guard/.test(type)) return "guard";
    if (/buff|attack|power/.test(type)) return "power";
    if (/field|ocean|scene/.test(type)) return "field";
    return "effect";
}

export function themedVisualKey(effect) {
    if (effect?.type === "themedAction" && THEMED_ACTION_VISUALS[effect.action]) return effect.action;
    return ruleVisualKey(effect?.type);
}

// 状态类动作 → 临时徽记文案（层数由 themedActionParams 提供，保证与卡面/结算同源）
const STATUS_MARK_META = {
    ignite:   { label: "灼烧", stacks: true },
    venom:    { label: "剧毒", stacks: true },
    bleed:    { label: "出血", stacks: true },
    curse:    { label: "诅咒", stacks: true },
    paralyze: { label: "麻痹" },
    exile:    { label: "异界" },
    infinity: { label: "无下限" },
    detonate: { label: "引爆" },
};

function showStatusMark(target, key, effect) {
    const meta = STATUS_MARK_META[key];
    if (!meta || typeof target?.appendChild !== "function") return;
    const mark = createEffectElement("div");
    mark.className = `status-mark status-mark-${key}`;
    // 賭运麻痹与卡面一致：走抛硬币文案，不直接显示"麻痹"
    let text = key === "paralyze" && effect?.params?.gamble === true ? "抛硬币" : meta.label;
    if (meta.stacks) {
        const stacks = Number(themedActionParams(effect)?.stacks);
        if (Number.isFinite(stacks) && stacks > 0) text = `${meta.label}×${stacks}`;
    }
    mark.textContent = text;
    mark.style.setProperty("--mark-color", THEMED_ACTION_VISUALS[key]?.color || "#ffffff");
    target.appendChild(mark);
    removeAfter(mark, 1250);
}

function resolveRuleTargets(effect, origin, ownerIndex = 0) {
    const key = themedVisualKey(effect);
    const effectType = String(effect.type || "").toLowerCase();
    const ownPrefix = ownerIndex === 1 ? "#opponent-area" : "#player-area";
    const enemyPrefix = ownerIndex === 1 ? "#player-area" : "#opponent-area";
    const ownHand = ownerIndex === 1 ? "#opponent-hand" : "#hand-tray";
    const enemyHand = ownerIndex === 1 ? "#hand-tray" : "#opponent-hand";
    const ownDeck = ownerIndex === 1 ? "#opponent-deck-pile" : "#player-deck-pile";
    const ownMonster = `[data-owner="${ownerIndex}"][data-zone="monster"]`;
    const enemyMonster = `[data-owner="${ownerIndex === 1 ? 0 : 1}"][data-zone="monster"]`;
    const enemyBackrow = `[data-owner="${ownerIndex === 1 ? 0 : 1}"][data-zone="spell-trap"][data-instance-id]`;
    const enemyGraveyard = ownerIndex === 1 ? "#player-graveyard-pile" : "#opponent-graveyard-pile";
    const ownHp = document.querySelector(`${ownPrefix} .hp-bar-wrap`);
    const enemyHp = document.querySelector(`${enemyPrefix} .hp-bar-wrap`);
    const enemyMonsterTarget = document.querySelector(`${enemyMonster}[data-instance-id]`);
    // 主题动作按"打在目标卡上"落点：指向敌方的动作锚定 data-atk 最高的敌方怪兽槽
    if (effectType === "themedaction" && THEMED_ACTION_VISUALS[effect.action]) {
        const enemySlots = typeof document.querySelectorAll === "function"
            ? [...document.querySelectorAll(`${enemyMonster}[data-instance-id]`)]
            : [document.querySelector(`${enemyMonster}[data-instance-id]`)].filter(Boolean);
        const strongest = () => enemySlots.slice()
            .sort((a, b) => (Number(b.dataset?.atk) || 0) - (Number(a.dataset?.atk) || 0))[0];
        if (effect.action === "infinity") return origin ? [{ target: origin, key }] : [];
        if (effect.action === "exile" && effect.params?.self) return origin ? [{ target: origin, key }] : [];
        if (effect.action === "paralyze") {
            if (effect.params?.count === "all") {
                const allSelector = `${enemyMonster}:not(.face-down-set)[data-instance-id]`;
                const targets = typeof document.querySelectorAll === "function"
                    ? [...document.querySelectorAll(allSelector)]
                    : [document.querySelector(allSelector)].filter(Boolean);
                return targets.map(target => ({ target, key }));
            }
            const target = strongest();
            return target ? [{ target, key }] : [];
        }
        if (["ignite", "venom", "bleed", "curse", "exile", "detonate"].includes(effect.action)) {
            const target = strongest();
            return target ? [{ target, key }] : [];
        }
        // domain / gamble 维持战场锚点
        return [{ target: document.getElementById("battlefield"), key }];
    }
    if (effectType === "destroyallenemyspelltraps") {
        const targets = typeof document.querySelectorAll === "function"
            ? [...document.querySelectorAll(enemyBackrow)]
            : [document.querySelector(enemyBackrow)].filter(Boolean);
        return targets.map(target => ({ target, key: "destroy" }));
    }
    if (effectType === "destroyspelltrap") {
        return [{ target: document.querySelector(enemyBackrow), key: "destroy" }];
    }
    if (effectType === "banishenemygraveyard") {
        return [{ target: document.querySelector(enemyGraveyard), key: "banish" }];
    }
    if (effectType === "damageandheal") return [{ target: enemyMonsterTarget || enemyHp, key: "damage" }, { target: ownHp, key: "heal" }];
    if (effectType === "damagebothplayers") return [{ target: ownHp, key: "damage" }, { target: enemyHp, key: "damage" }];
    if (effectType === "reducedamage") return [{ target: ownHp, key: "guard" }];
    if (effectType === "discardcards") return [{ target: document.querySelector(enemyHand), key: "weaken" }];
    if (origin && ["power", "guard", "summon", "effect"].includes(key)) return [{ target: origin, key }];
    if (key === "heal") return [{ target: ownHp, key }];
    if (key === "damage") {
        const targetsPlayerLp = /direct|player|bothplayers|burn/.test(effectType);
        return [{ target: targetsPlayerLp ? enemyHp : enemyMonsterTarget, key }];
    }
    if (key === "draw") return [{ target: document.querySelector(ownHand), key }];
    if (key === "search") return [{ target: document.querySelector(ownDeck), key }];
    if (key === "power" || key === "guard" || key === "revive" || key === "summon") return [{ target: document.querySelector(`${ownMonster}[data-instance-id]`) || origin, key }];
    if (key === "weaken" || key === "destroy" || key === "banish" || key === "return" || key === "lock") return [{ target: enemyMonsterTarget, key }];
    if (key === "field") return [{ target: document.querySelector(`.field-zone-slot[data-owner="${ownerIndex}"]`) || document.getElementById("battlefield"), key }];
    return [{ target: document.getElementById("battlefield"), key }];
}

export function playRuleDrivenEffect(cardOrEffect, origin = null, ownerIndex = 0, explicitTarget = null) {
    if (!isBrowser) return false;
    const effect = cardOrEffect?.effects?.[0] || cardOrEffect?.effect || cardOrEffect || {};
    const battleScreen = document.getElementById("battle-screen");
    if (!battleScreen) return;

    const targets = (explicitTarget
        ? [{ target: explicitTarget, key: themedVisualKey(effect) }]
        : resolveRuleTargets(effect, origin, ownerIndex)).filter(item => item.target);
    if (!targets.length) return false;
    if (effect.type === "themedAction" && effect.skillName) showSkillBanner(effect.skillName, effect.skillLabel, effect.action);
    // 主题动作音效：赌运麻痹的结果已由 coin 音覆盖，跳过规避双重发声
    if (effect.type === "themedAction" && !(effect.action === "paralyze" && effect.params?.gamble === true)) {
        const actionSound = THEMED_ACTION_SOUNDS[effect.action];
        if (actionSound) playSound(actionSound);
    }
    if (effect.type === "themedAction" && effect.action === "domain") {
        playDomainCinematic(effect.params?.field, cardOrEffect?.name, ownerIndex);
    }
    for (const { target, key } of targets) {
        const visual = THEMED_ACTION_VISUALS[key] || RULE_VISUALS[key];
        const rect = getRect(target);
        const centerX = rect.width ? rect.left + rect.width / 2 : window.innerWidth / 2;
        const centerY = rect.height ? rect.top + rect.height / 2 : window.innerHeight / 2;
        const sourceRect = getRect(origin);
        const sourceX = sourceRect.width ? sourceRect.left + sourceRect.width / 2 : centerX;
        const sourceY = sourceRect.height ? sourceRect.top + sourceRect.height / 2 : centerY;
        const layer = createEffectElement("div");
        layer.className = `rule-fx rule-fx-${visual.motion} rule-fx-local`;
        layer.style.cssText = `--rule-x:${centerX}px;--rule-y:${centerY}px;--rule-color:${visual.color};--rule-accent:${visual.accent};--rule-width:${Math.max(80, rect.width)}px;`;
        const routeDx = centerX - sourceX;
        const routeDy = centerY - sourceY;
        const routeLength = Math.hypot(routeDx, routeDy);
        layer.style.setProperty("--rule-source-x", `${sourceX}px`);
        layer.style.setProperty("--rule-source-y", `${sourceY}px`);
        layer.style.setProperty("--rule-route-length", `${routeLength}px`);
        layer.style.setProperty("--rule-route-angle", `${Math.atan2(routeDy, routeDx) * 180 / Math.PI}deg`);
        battleScreen.dataset.lastRuleRouteLength = String(Math.round(routeLength));
        battleScreen.dataset.lastRuleRouteDirection = `${Math.round(sourceX)},${Math.round(sourceY)}->${Math.round(centerX)},${Math.round(centerY)}`;
        layer.innerHTML = `${routeLength > 16 ? '<div class="rule-fx-route"><i></i></div><div class="rule-fx-source"></div>' : ""}<div class="rule-fx-core"></div><div class="rule-fx-ring"></div><div class="rule-fx-title"><strong>${visual.label}</strong></div>`;
        for (let i = 0; i < Math.ceil(12 * getDuelMotion().particleRatio); i++) {
            const particle = createEffectElement("i");
            const angle = Math.random() * Math.PI * 2;
            const distance = 55 + Math.random() * 150;
            particle.style.cssText = `--px:${Math.cos(angle) * distance}px;--py:${Math.sin(angle) * distance}px;--delay:${Math.random() * .18}s;--size:${2 + Math.random() * 5}px;`;
            layer.appendChild(particle);
        }
        // 坐标来自视口；挂在 body 上，避免战场运镜 transform 改写 fixed 的参考系。
        document.body.appendChild(layer);
        showStatusMark(target, key, effect);
        target.classList?.add("rule-target-pulse");
        if (visual.motion === "impact" && getDuelMotion().quality !== "low" && !getDuelMotion().reduced) {
            battleScreen.classList.remove("rule-camera-impact");
            void battleScreen.offsetWidth;
            battleScreen.classList.add("rule-camera-impact");
        }
        removeAfter(layer, 1250);
        setTimeout(() => {
            target.classList?.remove("rule-target-pulse");
            battleScreen.classList.remove("rule-camera-impact");
        }, 850);
    }
    return true;
}

/**
 * 技能横幅：主题行动结算时展示「主动技」名称
 */
export function showSkillBanner(skillName, label = "主动技", action = "") {
    if (!isBrowser || !skillName) return;
    const banner = createEffectElement("div");
    banner.className = "skill-banner";
    banner.innerHTML = `<small>【${label}】</small><strong>${skillName}</strong>`;
    (document.querySelector(".battle-screen") || document.body).appendChild(banner);
    removeAfter(banner, 950);
}

/**
 * 硬币演出：onCoinFlip 事件的正/反面表现
 */
export function playCoinFlip(result = "pending") {
    if (!isBrowser) return;
    playSound("coin");
    const coin = createEffectElement("div");
    coin.className = `coin-flip ${result}`;
    coin.innerHTML = `<div class="coin-face"></div><strong>${result === "heads" ? "正面" : result === "tails" ? "反面" : "抛硬币"}</strong>`;
    (document.querySelector(".battle-screen") || document.body).appendChild(coin);
    removeAfter(coin, 950);
}

// =====================================================================
//  卡牌飞行动画系统
// =====================================================================

/**
 * 创建一个飞行卡牌克隆体
 */


/**
 * 抽卡动画：卡牌从牌库漂浮→斜向飞向镜头放大（维持1秒）→回退缩小→滑入手牌
 * 全程带光效拖尾、动态模糊、镜头晃动，流畅连贯帅气运镜
 */
export function animateDrawCard(card, htmlFn, isOpponent = false) {
    if (!isBrowser || !card) return Promise.resolve();
    return playCardTransfer(card, isOpponent ? createCardBackHtml(card) : htmlFn(card),
        document.getElementById(isOpponent ? "opponent-deck-pile" : "player-deck-pile"),
        document.querySelector(isOpponent ? ".opponent-hand" : "#hand-tray"), "draw");
}

/**
 * 出牌动画：卡牌从手牌冲向镜头→回退缩小→落入场位
 * 电影级运镜，与抽卡风格一致
 */
export function animatePlayCard(card, handCard, targetSlot, htmlFn) {
    return animatePlayToZone(card, handCard, targetSlot, htmlFn);
}

/**
 * 出牌飞向墓地动画：卡牌从手牌漂浮→斜向飞向镜头放大（维持1秒）→回退缩小→滑入墓区
 * 全程带光效拖尾、动态模糊、镜头晃动，流畅连贯帅气运镜
 */
export function animatePlayToGraveyard(card, handCard, htmlFn, graveyardId = "player-graveyard-pile") {
    if (!isBrowser || !card) return Promise.resolve();
    return playCardTransfer(card, htmlFn(card), handCard, document.getElementById(graveyardId), "graveyard");
}

/**
 * 生成卡背HTML（里侧表示）
 */
export function createCardBackHtml(card) {
    const typeLabel = card?.type === "trap" ? "TRAP" : card?.type === "spell" ? "SPELL" : "NC";
    const label = card?.type === "monster" ? "SET" : typeLabel;
    return `<div class="card in-field"><div class="card-frame face-down-frame"><div class="card-back-icon">${typeLabel}</div>${sekaiCardBackHtml({ label })}</div></div>`;
}

/**
 * 出牌到场上区域运镜动画（怪兽/魔法/陷阱通用）
 * 卡牌从手牌→飞向镜头放大→回退缩小→落入目标区域
 * options.isCardBack: true 时显示卡背（对手陷阱）
 * options.endScale: 落地缩放比例（魔法/陷阱区较小，用0.7）
 */
export function animatePlayToZone(card, fromEl, targetSlot, htmlFn, options = {}) {
    if (!isBrowser || !card) return Promise.resolve();
    return playCardTransfer(card, options.isCardBack ? createCardBackHtml(card) : htmlFn(card), fromEl, targetSlot || fromEl);
}



function getFlashColor(card) {
    const attr = card.attribute || card.element || "none";
    const colors = {
        fire: "rgba(255,120,60,.1)", water: "rgba(80,180,255,.1)",
        wind: "rgba(120,255,160,.08)", earth: "rgba(200,170,80,.08)",
        light: "rgba(255,240,120,.1)", dark: "rgba(180,100,255,.1)",
    };
    return colors[attr] || "rgba(85,216,229,.08)";
}

function screenFlash(color) {
    if (!isBrowser || getDuelMotion().reduced || getDuelMotion().quality === "low") return;
    const el = createEffectElement("div");
    el.className = "screen-flash";
    el.style.setProperty("--flash-color", color);
    document.body.appendChild(el);
    removeAfter(el, 400);
}

// =====================================================================
//  原有战斗特效
// =====================================================================

/**
 * 召唤怪兽入场特效 + 通告横幅
 * 每种属性有完全不同的入场运镜与粒子表现
 */
function playLevelSummonCinematic(fieldSlot, cardName, level, options = {}) {
    if (!fieldSlot) return;
    const starLevel = Math.max(1, Math.min(12, Number(level) || 1));
    const tributeFallback = options.tributeSummon ? (starLevel >= 7 ? 2 : 1) : 0;
    const tributeRaw = Number(options.tributeCount);
    // Infinity / NaN / 超大数（PvP 对端可传 1e999 → Infinity）统一夹到 0..3 的有限整数
    const tributeCount = Number.isFinite(tributeRaw)
        ? Math.min(3, Math.max(0, Math.round(tributeRaw)))
        : tributeFallback;
    const rect = getRect(fieldSlot);
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const tier = starLevel >= 9 ? "cosmic" : starLevel >= 7 ? "legendary" : starLevel >= 5 ? "tribute" : starLevel >= 3 ? "advanced" : "basic";
    const overlay = createEffectElement("div");
    overlay.className = `level-summon-cinematic level-summon-${tier}`;
    overlay.style.setProperty("--summon-x", `${centerX}px`);
    overlay.style.setProperty("--summon-y", `${centerY}px`);
    overlay.style.setProperty("--star-hue", `${38 + starLevel * 8}`);
    overlay.innerHTML = `
        <div class="level-summon-vignette"></div>
        <div class="level-summon-gate">
            <i class="level-summon-ring ring-one"></i>
            <i class="level-summon-ring ring-two"></i>
            <i class="level-summon-core"></i>
        </div>
        <div class="level-summon-stars"></div>
        <div class="level-summon-title">
            <small>${tributeCount ? "ADVANCE SUMMON" : "MONSTER SUMMON"}</small>
            <strong>LEVEL ${starLevel}</strong>
            <span>${cardName || "UNKNOWN ENTITY"}</span>
        </div>`;
    document.body.appendChild(overlay);

    const stars = overlay.querySelector(".level-summon-stars");
    for (let index = 0; index < starLevel; index++) {
        const star = createEffectElement("b");
        star.textContent = "★";
        star.style.setProperty("--star-index", index);
        star.style.setProperty("--star-count", starLevel);
        star.style.setProperty("--star-delay", `${index * 55}ms`);
        stars.appendChild(star);
    }

    // 二次防御：循环上界再夹一次，保证渲染的 DOM 节点数量有界
    const soulCount = Math.min(3, Math.max(0, Math.round(Number(tributeCount) || 0)));
    for (let index = 0; index < soulCount; index++) {
        const soul = createEffectElement("div");
        soul.className = "tribute-soul-pillar";
        soul.style.setProperty("--soul-offset", `${(index - (soulCount - 1) / 2) * 150}px`);
        soul.style.setProperty("--soul-delay", `${index * 180}ms`);
        overlay.appendChild(soul);
    }

    const battlefield = document.querySelector(".battlefield");
    if (battlefield) {
        battlefield.classList.remove("level-summon-camera", "level-summon-camera-heavy");
        void battlefield.offsetWidth;
        battlefield.classList.add(starLevel >= 7 ? "level-summon-camera-heavy" : "level-summon-camera");
        setTimeout(() => battlefield.classList.remove("level-summon-camera", "level-summon-camera-heavy"), 2300);
    }
    fieldSlot.classList.add("level-summon-arrival");
    setTimeout(() => fieldSlot.classList.remove("level-summon-arrival"), 2100);
    removeAfter(overlay, starLevel >= 7 ? 2700 : 2200);
}

export function getMonsterVisualSignature(cardName = "", rarity = "N", attribute = "none") {
    let seed = 2166136261;
    for (const char of String(cardName)) {
        seed ^= char.codePointAt(0);
        seed = Math.imul(seed, 16777619) >>> 0;
    }
    const normalizedRarity = String(rarity || "N").toUpperCase();
    const intensityByRarity = { R: 1, SR: 1.2, SSR: 1.45, UR: 1.75 };
    return {
        enabled: normalizedRarity !== "N",
        seed,
        variant: seed % 6,
        hue: seed % 360,
        tilt: (seed % 61) - 30,
        intensity: intensityByRarity[normalizedRarity] || 1,
        attribute: attribute || "none",
        zenitsu: /善逸|zenitsu/i.test(String(cardName)),
    };
}

function seededVisualUnit(seed, index) {
    let value = (seed + Math.imul(index + 1, 0x9e3779b1)) >>> 0;
    value ^= value >>> 16;
    value = Math.imul(value, 0x7feb352d) >>> 0;
    value ^= value >>> 15;
    return (value >>> 0) / 4294967295;
}

function monsterParticleFamily(profile, attribute = "none") {
    const style = String(profile?.style || "");
    if (/sunfire|flame|blood-flame|bomb|flame-arrow|cursed-slash/.test(style)) return "fire";
    if (/thunder/.test(style)) return "thunder";
    if (/water|ocean|ice|rain/.test(style)) return "water";
    if (/wind|mist|butterfly|serpent|poison/.test(style)) return "wind";
    if (/earth|stone|sand|beast|cat-paw/.test(style)) return "earth";
    if (/digital-song|dark-song|bass-wave|sound-bomb|idol-stage|dj-beat|piano-wave/.test(style)) return "music";
    if (/domain|dark|moon|hollow|dimension|void|time-stop|cream|compass|spirit|revenge|red-thread-eye/.test(style)) return "dark";
    if (/bullet|sniper/.test(style)) return "bullet";
    if (/light|infinity|rose|love|angel|feather|prism|judgement|shrine|red-thread-rose|red-thread-feather/.test(style)) return "light";
    if (profile?.characterSpecific) return "arcane";
    return ({ fire: "fire", water: "water", wind: "wind", earth: "earth", light: "light", dark: "dark" })[attribute] || "arcane";
}

export function getMonsterParticleProfile(card = {}) {
    const signature = getMonsterVisualSignature(card.name, card.rarity, card.attribute || card.element || "none");
    const cinematic = signature.enabled ? getMonsterCinematicProfile(card) : null;
    return {
        enabled: signature.enabled,
        family: cinematic ? monsterParticleFamily(cinematic, signature.attribute) : null,
        style: cinematic?.style || null,
        seed: signature.seed,
        variant: signature.variant,
        intensity: signature.intensity,
    };
}

function createMonsterParticleLayer({ phase, profile, signature, startX, startY, endX = startX, endY = startY }) {
    const family = monsterParticleFamily(profile, signature.attribute);
    const layer = createEffectElement("div");
    const safeStyle = String(profile?.style || "arcane").replace(/[^a-z0-9-]/gi, "-");
    layer.className = `monster-particle-field monster-particle-${phase} particle-family-${family} particle-style-${safeStyle} particle-variant-${signature.variant}`;
    layer.style.cssText = [
        `--particle-start-x:${startX}px`,
        `--particle-start-y:${startY}px`,
        `--particle-end-x:${endX}px`,
        `--particle-end-y:${endY}px`,
        `--particle-power:${signature.intensity}`,
        `--particle-hue:${signature.hue}`,
        `--particle-angle:${Math.atan2(endY - startY, endX - startX) * 180 / Math.PI}deg`,
        `--particle-distance:${Math.hypot(endX - startX, endY - startY)}px`,
    ].join(";");

    const baseCount = phase === "summon" ? 30 : 22;
    const count = Math.round(baseCount * signature.intensity);
    for (let index = 0; index < count; index++) {
        const particle = createEffectElement("i");
        particle.className = `monster-theme-particle particle-${index % 4}`;
        const angle = seededVisualUnit(signature.seed, index) * Math.PI * 2;
        const radius = 45 + seededVisualUnit(signature.seed ^ 0xa511e9b3, index) * (phase === "summon" ? 190 : 95);
        const size = 3 + seededVisualUnit(signature.seed ^ 0x63d83595, index) * 12;
        const curve = (seededVisualUnit(signature.seed ^ 0xc2b2ae35, index) - .5) * 150;
        particle.style.cssText = [
            `--particle-x:${Math.cos(angle) * radius}px`,
            `--particle-y:${Math.sin(angle) * radius}px`,
            `--particle-size:${size}px`,
            `--particle-curve:${curve}px`,
            `--particle-delay:${index * .018}s`,
            `--particle-spin:${Math.round(seededVisualUnit(signature.seed ^ 0x27d4eb2f, index) * 720 - 360)}deg`,
        ].join(";");
        layer.appendChild(particle);
    }

    const structureCount = family === "thunder" ? 7 : family === "water" ? 5 : family === "wind" ? 8 : 4;
    for (let index = 0; index < structureCount; index++) {
        const structure = createEffectElement("b");
        structure.className = `monster-theme-structure structure-${index}`;
        structure.style.cssText = `--structure-index:${index};--structure-delay:${index * .055}s;--structure-turn:${(360 / structureCount) * index + signature.tilt}deg;`;
        layer.appendChild(structure);
    }
    document.body.appendChild(layer);
    removeAfter(layer, phase === "summon" ? 1900 : 1050);
    return family;
}

function playMonsterSummonSignature(fieldSlot, cardName, rarity, attribute) {
    const signature = getMonsterVisualSignature(cardName, rarity, attribute);
    if (!signature.enabled || !fieldSlot) return;
    const profile = getMonsterCinematicProfile({ name: cardName, rarity, attribute });
    const rect = getRect(fieldSlot);
    const overlay = createEffectElement("div");
    overlay.className = `monster-signature summon-signature signature-v${signature.variant} cinematic-${profile.summonStyle || profile.style}${signature.zenitsu ? " signature-zenitsu" : ""}`;
    overlay.style.cssText = `--sig-x:${rect.left + rect.width / 2}px;--sig-y:${rect.top + rect.height / 2}px;--sig-hue:${signature.hue};--sig-tilt:${signature.tilt}deg;--sig-power:${signature.intensity};`;
    overlay.innerHTML = `<i></i><i></i><i></i><i></i><strong>${escapeHtml(profile.summonTitle)}</strong>`;
    document.body.appendChild(overlay);
    createMonsterParticleLayer({
        phase: "summon",
        profile: { ...profile, style: profile.summonStyle || profile.style },
        signature,
        startX: rect.left + rect.width / 2,
        startY: rect.top + rect.height / 2,
    });
    if (signature.zenitsu) screenFlash("rgba(255,238,90,.28)");
    removeAfter(overlay, 1650);
}

function playMonsterAttackSignature(from, to, attackerCard) {
    const signature = getMonsterVisualSignature(attackerCard.name, attackerCard.rarity, attackerCard.attribute || attackerCard.element);
    if (!signature.enabled) return;
    const profile = getMonsterCinematicProfile(attackerCard);
    const startX = from.left + from.width / 2;
    const startY = from.top + from.height / 2;
    const endX = to.left + to.width / 2;
    const endY = to.top + to.height / 2;
    const distance = Math.hypot(endX - startX, endY - startY);
    const angle = Math.atan2(endY - startY, endX - startX) * 180 / Math.PI;
    const overlay = createEffectElement("div");
    overlay.className = `monster-signature attack-signature signature-v${signature.variant} cinematic-${profile.attackStyle || profile.style}${signature.zenitsu ? " signature-zenitsu" : ""}`;
    overlay.style.cssText = `--sig-x:${startX}px;--sig-y:${startY}px;--sig-distance:${distance}px;--sig-angle:${angle}deg;--sig-hue:${signature.hue};--sig-tilt:${signature.tilt}deg;--sig-power:${signature.intensity};`;
    overlay.innerHTML = `<i></i><i></i><i></i><strong>${escapeHtml(profile.attackTitle)}</strong>`;
    document.body.appendChild(overlay);
    createMonsterParticleLayer({ phase: "attack", profile: { ...profile, style: profile.attackStyle || profile.style }, signature, startX, startY, endX, endY });
    if (signature.zenitsu) screenFlash("rgba(255,248,170,.38)");
    removeAfter(overlay, 900);
}

export function playSummonEffect(fieldSlot, attribute = "none", cardName = "", level = 0, rarity = "N", options = {}) {
    if (!isBrowser) return;
    if (options.faceDown || fieldSlot?.classList?.contains("face-down-set")) return Promise.resolve();
    if (authoredScene(cardName, "summon")) {
        showSummonBanner(attribute, cardName, level);
        if (options.tributeSummon || options.fusionSummon) {
            const epoch = motionGeneration();
            return playCardPerformance(cardName, options.tributeSummon ? "tribute" : "fusion", fieldSlot, fieldSlot, options.materialRects || [])
                .then(() => epoch !== motionGeneration() || fieldSlot?.isConnected === false ? undefined : playCardPerformance(cardName, "summon", fieldSlot));
        }
        return playCardPerformance(cardName, "summon", fieldSlot);
    }
    playCardPerformance(cardName, options.tributeSummon ? "tribute" : options.fusionSummon ? "fusion" : "summon", fieldSlot, fieldSlot, options.materialRects || []);

    showSummonBanner(attribute, cardName, level);
    playLevelSummonCinematic(fieldSlot, cardName, level, options);
    playMonsterSummonSignature(fieldSlot, cardName, rarity, attribute);
    const container = fieldSlot || document.querySelector(".battle-screen") || document.body;
    const battlefield = document.querySelector(".battlefield");
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight * 0.5;

    if (fieldSlot) {
        fieldSlot.classList.add("summoning");
        setTimeout(() => fieldSlot.classList.remove("summoning"), 500);
    }

    // === 属性专属召唤运镜 ===
    if (attribute === "fire") {
        // 火属性：地面裂纹 + 火柱从下方喷射 + 熔岩碎片 + 画面热浪
        const slotRect = fieldSlot ? getRect(fieldSlot) : { left: cx - 50, top: cy - 65, width: 100, height: 130 };
        // 地面裂纹
        for (let i = 0; i < 6; i++) {
            const crack = createEffectElement("div");
            crack.className = "summon-fire-crack";
            const angle = (i / 6) * Math.PI * 2;
            const dist = 30 + Math.random() * 40;
            crack.style.cssText = `left:${slotRect.left + slotRect.width/2}px; top:${slotRect.top + slotRect.height}px; --cx:${Math.cos(angle)*dist}px; --cy:${Math.sin(angle)*dist*0.3}px; animation-delay:${i*0.04}s;`;
            container.appendChild(crack);
            removeAfter(crack, 600);
        }
        // 火柱粒子
        for (let i = 0; i < 18; i++) {
            const p = createEffectElement("div");
            p.className = "summon-fire-pillar";
            const ox = (Math.random() - 0.5) * 80;
            p.style.cssText = `left:${slotRect.left + slotRect.width/2 + ox}px; top:${slotRect.top + slotRect.height}px; animation-delay:${i*0.03}s; height:${40+Math.random()*80}px;`;
            container.appendChild(p);
            removeAfter(p, 800);
        }
        // 熔岩碎片飞溅
        for (let i = 0; i < 14; i++) {
            const p = createEffectElement("div");
            p.className = "summon-ember";
            const angle = Math.random() * Math.PI * 2;
            const dist = 40 + Math.random() * 80;
            p.style.cssText = `left:${slotRect.left + slotRect.width/2}px; top:${slotRect.top + slotRect.height*0.7}px; --ex:${Math.cos(angle)*dist}px; --ey:${-30-Math.random()*80}px; animation-delay:${Math.random()*0.2}s;`;
            container.appendChild(p);
            removeAfter(p, 900);
        }
        // 热浪扭曲
        const heatwave = createEffectElement("div");
        heatwave.className = "summon-heatwave";
        heatwave.style.cssText = `left:${slotRect.left - 20}px; top:${slotRect.top - 20}px; width:${slotRect.width+40}px; height:${slotRect.height+40}px;`;
        container.appendChild(heatwave);
        removeAfter(heatwave, 700);
        // 镜头下压+回弹
        if (battlefield) {
            battlefield.style.transition = "transform 0.08s ease-in";
            battlefield.style.transform = "translateX(-50%) scale(1.04) translateY(3px)";
            setTimeout(() => {
                battlefield.style.transition = "transform 0.35s cubic-bezier(.25,.8,.25,1)";
                battlefield.style.transform = "translateX(-50%)";
            }, 80);
        }
        screenFlash("rgba(255,100,40,.15)");
    } else if (attribute === "water") {
        // 水属性：水面涟漪扩散 + 水泡上升 + 水花飞溅 + 蓝色光晕
        const slotRect = fieldSlot ? getRect(fieldSlot) : { left: cx - 50, top: cy - 65, width: 100, height: 130 };
        // 多层涟漪
        for (let i = 0; i < 4; i++) {
            const ripple = createEffectElement("div");
            ripple.className = "summon-water-ripple";
            ripple.style.cssText = `left:${slotRect.left + slotRect.width/2}px; top:${slotRect.top + slotRect.height/2}px; animation-delay:${i*0.12}s;`;
            container.appendChild(ripple);
            removeAfter(ripple, 1200);
        }
        // 水泡上升
        for (let i = 0; i < 20; i++) {
            const bubble = createEffectElement("div");
            bubble.className = "summon-water-bubble";
            const ox = (Math.random() - 0.5) * 100;
            const size = 4 + Math.random() * 8;
            bubble.style.cssText = `left:${slotRect.left + slotRect.width/2 + ox}px; top:${slotRect.top + slotRect.height}px; width:${size}px; height:${size}px; animation-delay:${i*0.05}s;`;
            container.appendChild(bubble);
            removeAfter(bubble, 1000);
        }
        // 水花飞溅（顶部）
        for (let i = 0; i < 12; i++) {
            const splash = createEffectElement("div");
            splash.className = "summon-water-splash";
            const ox = (Math.random() - 0.5) * 60;
            splash.style.cssText = `left:${slotRect.left + slotRect.width/2 + ox}px; top:${slotRect.top}px; --sy:${-20-Math.random()*40}px; --sx:${ox*0.5}px; animation-delay:${Math.random()*0.3}s;`;
            container.appendChild(splash);
            removeAfter(splash, 800);
        }
        // 镜头柔和漂移
        if (battlefield) {
            battlefield.style.transition = "transform 0.3s cubic-bezier(.25,.8,.25,1)";
            battlefield.style.transform = "translateX(-50%) translateY(-4px)";
            setTimeout(() => {
                battlefield.style.transition = "transform 0.5s cubic-bezier(.25,.8,.25,1)";
                battlefield.style.transform = "translateX(-50%)";
            }, 300);
        }
        screenFlash("rgba(80,180,255,.1)");
    } else if (attribute === "wind") {
        // 风属性：旋风环绕 + 叶片/羽毛飘散 + 空气涡流
        const slotRect = fieldSlot ? getRect(fieldSlot) : { left: cx - 50, top: cy - 65, width: 100, height: 130 };
        // 旋风环（多层）
        for (let i = 0; i < 3; i++) {
            const tornado = createEffectElement("div");
            tornado.className = "summon-wind-tornado";
            tornado.style.cssText = `left:${slotRect.left + slotRect.width/2}px; top:${slotRect.top + slotRect.height/2}px; animation-delay:${i*0.15}s; --scale:${1+i*0.3};`;
            container.appendChild(tornado);
            removeAfter(tornado, 900);
        }
        // 飘散叶片/羽毛
        for (let i = 0; i < 16; i++) {
            const leaf = createEffectElement("div");
            leaf.className = "summon-wind-leaf";
            const angle = (i / 16) * Math.PI * 2;
            const dist = 30 + Math.random() * 50;
            leaf.style.cssText = `left:${slotRect.left + slotRect.width/2}px; top:${slotRect.top + slotRect.height/2}px; --lx:${Math.cos(angle)*dist}px; --ly:${Math.sin(angle)*dist}px; --lr:${Math.random()*360}deg; animation-delay:${i*0.04}s;`;
            container.appendChild(leaf);
            removeAfter(leaf, 800);
        }
        // 空气涡流线
        for (let i = 0; i < 8; i++) {
            const line = createEffectElement("div");
            line.className = "summon-wind-line";
            const angle = (i / 8) * 360;
            line.style.cssText = `left:${slotRect.left + slotRect.width/2}px; top:${slotRect.top + slotRect.height/2}px; transform:rotate(${angle}deg); animation-delay:${i*0.06}s;`;
            container.appendChild(line);
            removeAfter(line, 600);
        }
        // 镜头旋转微晃
        if (battlefield) {
            battlefield.style.transition = "transform 0.2s ease-out";
            battlefield.style.transform = "translateX(-50%) rotate(0.5deg)";
            setTimeout(() => {
                battlefield.style.transition = "transform 0.4s cubic-bezier(.25,.8,.25,1)";
                battlefield.style.transform = "translateX(-50%) rotate(0deg)";
            }, 200);
        }
        screenFlash("rgba(120,255,160,.08)");
    } else if (attribute === "earth") {
        // 地属性：地面震裂 + 石柱升起 + 碎石飞溅 + 扬尘
        const slotRect = fieldSlot ? getRect(fieldSlot) : { left: cx - 50, top: cy - 65, width: 100, height: 130 };
        // 地面震裂线
        for (let i = 0; i < 8; i++) {
            const crack = createEffectElement("div");
            crack.className = "summon-earth-crack";
            const angle = (i / 8) * Math.PI * 2;
            const len = 25 + Math.random() * 35;
            crack.style.cssText = `left:${slotRect.left + slotRect.width/2}px; top:${slotRect.top + slotRect.height}px; transform:rotate(${angle*180/Math.PI}deg); --len:${len}px; animation-delay:${i*0.03}s;`;
            container.appendChild(crack);
            removeAfter(crack, 500);
        }
        // 碎石飞溅
        for (let i = 0; i < 20; i++) {
            const rock = createEffectElement("div");
            rock.className = "summon-earth-rock";
            const angle = Math.random() * Math.PI * 2;
            const dist = 25 + Math.random() * 70;
            const size = 3 + Math.random() * 7;
            rock.style.cssText = `left:${slotRect.left + slotRect.width/2}px; top:${slotRect.top + slotRect.height}px; --rx:${Math.cos(angle)*dist}px; --ry:${-20-Math.random()*60}px; --rr:${Math.random()*360}deg; width:${size}px; height:${size}px; animation-delay:${Math.random()*0.15}s;`;
            container.appendChild(rock);
            removeAfter(rock, 700);
        }
        // 扬尘
        const dust = createEffectElement("div");
        dust.className = "summon-earth-dust";
        dust.style.cssText = `left:${slotRect.left - 30}px; top:${slotRect.top + slotRect.height - 20}px; width:${slotRect.width + 60}px;`;
        container.appendChild(dust);
        removeAfter( dust, 800);
        // 镜头剧烈震动
        if (battlefield) {
            battlefield.classList.remove("hit-shake-heavy");
            void battlefield.offsetWidth;
            battlefield.classList.add("hit-shake-heavy");
            setTimeout(() => battlefield.classList.remove("hit-shake-heavy"), 400);
        }
        screenFlash("rgba(200,170,80,.1)");
    } else if (attribute === "light") {
        // 光属性：神圣光柱 + 十字光芒 + 光粒子上升 + 画面过曝
        const slotRect = fieldSlot ? getRect(fieldSlot) : { left: cx - 50, top: cy - 65, width: 100, height: 130 };
        // 神圣光柱
        for (let i = 0; i < 3; i++) {
            const pillar = createEffectElement("div");
            pillar.className = "summon-light-pillar";
            pillar.style.cssText = `left:${slotRect.left + slotRect.width/2 + (i-1)*30}px; top:0; animation-delay:${i*0.1}s;`;
            container.appendChild(pillar);
            removeAfter(pillar, 800);
        }
        // 十字光芒
        const cross = createEffectElement("div");
        cross.className = "summon-light-cross";
        cross.style.cssText = `left:${slotRect.left + slotRect.width/2}px; top:${slotRect.top + slotRect.height/2}px;`;
        container.appendChild(cross);
        removeAfter(cross, 700);
        // 光粒子上升
        for (let i = 0; i < 24; i++) {
            const p = createEffectElement("div");
            p.className = "summon-light-particle";
            const ox = (Math.random() - 0.5) * 100;
            p.style.cssText = `left:${slotRect.left + slotRect.width/2 + ox}px; top:${slotRect.top + slotRect.height}px; animation-delay:${i*0.04}s;`;
            container.appendChild(p);
            removeAfter(p, 1000);
        }
        // 镜头上移+柔和闪光
        if (battlefield) {
            battlefield.style.transition = "transform 0.2s ease-out";
            battlefield.style.transform = "translateX(-50%) translateY(-6px)";
            setTimeout(() => {
                battlefield.style.transition = "transform 0.6s cubic-bezier(.25,.8,.25,1)";
                battlefield.style.transform = "translateX(-50%)";
            }, 200);
        }
        // 过曝闪光
        const overexpose = createEffectElement("div");
        overexpose.className = "summon-light-overexpose";
        container.appendChild(overexpose);
        removeAfter(overexpose, 600);
        screenFlash("rgba(255,240,120,.18)");
    } else if (attribute === "dark") {
        // 暗属性：暗影触手从地面伸出 + 紫色漩涡 + 虚空裂隙 + 画面压暗
        const darkSlotRect = fieldSlot ? getRect(fieldSlot) : { left: cx - 50, top: cy - 65, width: 100, height: 130 };
        // 暗影触手
        for (let i = 0; i < 6; i++) {
            const tendril = createEffectElement("div");
            tendril.className = "summon-dark-tendril";
            const ox = (Math.random() - 0.5) * 80;
            tendril.style.cssText = `left:${darkSlotRect.left + darkSlotRect.width/2 + ox}px; top:${darkSlotRect.top + darkSlotRect.height}px; animation-delay:${i*0.06}s; --twist:${(Math.random()-0.5)*30}deg;`;
            container.appendChild(tendril);
            removeAfter(tendril, 800);
        }
        // 紫色漩涡
        const vortex = createEffectElement("div");
        vortex.className = "summon-dark-vortex";
        vortex.style.cssText = `left:${darkSlotRect.left + darkSlotRect.width/2}px; top:${darkSlotRect.top + darkSlotRect.height/2}px;`;
        container.appendChild(vortex);
        removeAfter(vortex, 900);
        // 虚空碎片
        for (let i = 0; i < 14; i++) {
            const p = createEffectElement("div");
            p.className = "summon-dark-void";
            const angle = Math.random() * Math.PI * 2;
            const dist = 20 + Math.random() * 50;
            p.style.cssText = `left:${darkSlotRect.left + darkSlotRect.width/2 + Math.cos(angle)*dist}px; top:${darkSlotRect.top + darkSlotRect.height/2 + Math.sin(angle)*dist}px; animation-delay:${Math.random()*0.3}s;`;
            container.appendChild(p);
            removeAfter(p, 700);
        }
        // 暗角+画面压暗
        const darken = createEffectElement("div");
        darken.className = "summon-dark-darken";
        container.appendChild(darken);
        removeAfter(darken, 800);
        // 镜头微沉
        if (battlefield) {
            battlefield.style.transition = "transform 0.15s ease-in";
            battlefield.style.transform = "translateX(-50%) translateY(5px) scale(0.98)";
            setTimeout(() => {
                battlefield.style.transition = "transform 0.5s cubic-bezier(.25,.8,.25,1)";
                battlefield.style.transform = "translateX(-50%)";
            }, 150);
        }
        screenFlash("rgba(140,60,255,.12)");
    } else {
        // 无属性（默认）：基础闪光环
        const ring = createEffectElement("div");
        ring.className = "summon-ring none";
        ring.style.cssText = fieldSlot ? "" : "position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:200;";
        container.appendChild(ring);
        removeAfter(ring, 650);
        const flash = createEffectElement("div");
        flash.className = "summon-flash";
        flash.style.cssText = fieldSlot ? "" : "position:fixed; left:0; top:0; right:0; bottom:0; z-index:199;";
        container.appendChild(flash);
        removeAfter(flash, 400);
        if (fieldSlot) spawnParticles(fieldSlot, "summon-spark", 8, 35);
        screenFlash(getFlashColor({ attribute }));
    }
}

function showSummonBanner(attribute, cardName, level) {
    // 中心文字横幅已移除，运镜动画接管视觉表现
}

/**
 * 魔法卡发动特效 + 全屏通告
 */
export function playSpellEffect(fieldSlot, attribute = "none", cardName = "") {
    if (!isBrowser || !fieldSlot) return;

    // 全屏通告
    showAnnounceBanner("spell", attribute, cardName);

    const circle = createEffectElement("div");
    circle.className = `spell-circle ${attribute}`;
    fieldSlot.appendChild(circle);
    removeAfter(circle, 900);

    const glow = createEffectElement("div");
    glow.className = "spell-glow";
    fieldSlot.appendChild(glow);
    removeAfter(glow, 1000);

    const beam = createEffectElement("div");
    beam.className = "spell-beam";
    fieldSlot.appendChild(beam);
    removeAfter(beam, 650);

    screenFlash(getFlashColor({ attribute }));
}

/**
 * 陷阱卡发动特效 + 全屏通告（更慢更震撼）
 */
export function playTrapEffect(fieldSlot, subtype = "counter", cardName = "") {
    if (!isBrowser || !fieldSlot) return;

    // 全屏通告 —— 陷阱最重要的视觉反馈
    showAnnounceBanner("trap", subtype, cardName);

    const barrier = createEffectElement("div");
    barrier.className = `trap-barrier ${subtype}`;
    fieldSlot.appendChild(barrier);
    removeAfter(barrier, 1100);

    const flash = createEffectElement("div");
    flash.className = "trap-flash";
    fieldSlot.appendChild(flash);
    removeAfter(flash, 550);

    const hex = createEffectElement("div");
    hex.className = `trap-hex ${subtype}`;
    fieldSlot.appendChild(hex);
    removeAfter(hex, 1000);

    screenFlash("rgba(255,111,141,.12)");
}

/**
 * 显示全屏通告横幅（同一时间只显示一个，停留2.5秒）
 */
export function showAnnounceBanner(type, subtype, cardName) {
    // 中心文字横幅已移除，运镜动画接管视觉表现
}

function escapeHtml(s) {
    return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * 攻击特效（在屏幕中央播放）
 */
export function playAttackEffect(attackerSlot, targetSlot = null) {
    // 旧版兼容：使用增强版打击特效
    if (!isBrowser) return;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight * 0.45;
    playHitImpact(cx, cy, "none", !targetSlot);
}

/**
 * 增强版打击命中特效 — 冻帧闪光 + 径向爆发 + 冲击波 + 能量射线 + 环形碎片 + 暗角
 * @param x - 命中点屏幕X坐标
 * @param y - 命中点屏幕Y坐标
 * @param attribute - 攻击属性 (fire/water/wind/earth/light/dark/none)
 * @param isDirectAttack - 是否直接攻击玩家HP（更震撼）
 */
export function playHitImpact(x, y, attribute = "none", isDirectAttack = false) {
    if (!isBrowser) return;

    const container = document.querySelector(".battle-screen") || document.body;

    // 属性配色
    const attrColors = {
        fire:   { core: "rgba(255,80,30,.8)",   color: "rgba(255,140,60,.95)",  glow: "rgba(255,100,40,.6)",  spark: "#ffcc44", burst: "rgba(255,200,100,.7)" },
        water:  { core: "rgba(40,140,255,.8)",   color: "rgba(80,180,255,.95)",  glow: "rgba(60,160,255,.6)",  spark: "#88ddff", burst: "rgba(150,220,255,.7)" },
        wind:   { core: "rgba(100,255,140,.7)",  color: "rgba(140,255,180,.9)",  glow: "rgba(120,255,160,.5)", spark: "#bbffcc", burst: "rgba(200,255,220,.6)" },
        earth:  { core: "rgba(200,160,60,.8)",   color: "rgba(220,190,100,.95)", glow: "rgba(200,170,80,.6)",  spark: "#ffe088", burst: "rgba(255,230,150,.7)" },
        light:  { core: "rgba(255,240,100,.9)",  color: "rgba(255,240,140,.95)", glow: "rgba(255,240,120,.6)", spark: "#ffffaa", burst: "rgba(255,255,200,.7)" },
        dark:   { core: "rgba(140,60,255,.8)",   color: "rgba(180,100,255,.95)", glow: "rgba(160,80,255,.6)",  spark: "#cc88ff", burst: "rgba(200,150,255,.7)" },
    };
    const c = attrColors[attribute] || { core: "rgba(255,180,80,.8)", color: "rgba(255,220,140,.95)", glow: "rgba(255,200,100,.6)", spark: "#ffdd88", burst: "rgba(255,240,180,.7)" };

    // 已有命中特效在播 → 砍半粒子数；再多就直接降级为一次轻量闪光，
    // 否则连锁攻击时几十个特效层叠在同一帧会把渲染线程彻底压死。
    const load = hitImpactLoad();
    if (load >= MAX_CONCURRENT_HIT_IMPACTS) {
        trimHitImpacts();
        screenFlash(c.glow.replace(/[\d.]+\)/, ".12)"));
        return;
    }
    const degrade = load > 0;
    const scale = base => (degrade ? Math.max(2, Math.round(base * 0.5)) : base);

    // --- 0. 冻帧闪光（命中瞬间全屏白闪 + 暗角） ---
    const freezeFlash = createEffectElement("div");
    freezeFlash.className = "hit-freeze-flash";
    freezeFlash.style.cssText = `--hx:${x / window.innerWidth * 100}%; --hy:${y / window.innerHeight * 100}%;`;
    container.appendChild(freezeFlash);
    removeAfter(freezeFlash, 300);

    // 暗角
    const vignette = createEffectElement("div");
    vignette.className = "hit-vignette";
    container.appendChild(vignette);
    removeAfter(vignette, 450);

    // --- 主容器 ---
    const box = createEffectElement("div");
    box.className = "hit-impact-container";
    box.style.cssText = `left:${x}px; top:${y}px; --hit-color:${c.color}; --hit-glow:${c.glow};`;
    container.appendChild(box);

    // --- 1. 中心白色闪光核（更大） ---
    const core = createEffectElement("div");
    core.className = "hit-core";
    core.style.background = `radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,.9) 10%, ${c.core} 35%, transparent 65%)`;
    box.appendChild(core);

    // --- 2. 径向爆发扇形（8个白色扇形从中心射出） ---
    const burstCount = scale(isDirectAttack ? 12 : 8);
    for (let i = 0; i < burstCount; i++) {
        const burst = createEffectElement("div");
        burst.className = "hit-burst";
        const angle = (i / burstCount) * 360 + (Math.random() - 0.5) * 10;
        const len = (isDirectAttack ? 120 : 80) + Math.random() * 60;
        burst.style.cssText = `transform:rotate(${angle}deg); --burst-len:${len}px; border-left-color:${c.burst}; animation-delay:${Math.random() * 0.04}s;`;
        box.appendChild(burst);
    }

    // --- 3. 冲击波环（3层） ---
    const waveCount = isDirectAttack ? 3 : 3;
    for (let i = 0; i < waveCount; i++) {
        const wave = createEffectElement("div");
        wave.className = "hit-shockwave";
        wave.style.borderColor = c.color;
        wave.style.boxShadow = `0 0 ${16 + i * 6}px ${c.glow}, 0 0 ${30 + i * 10}px ${c.glow.replace(/[\d.]+\)/, '.2)')}, inset 0 0 ${10 + i * 3}px ${c.glow}`;
        box.appendChild(wave);
    }

    // --- 4. 能量射线（更粗更亮） ---
    const rayCount = scale(isDirectAttack ? 14 : 10);
    for (let i = 0; i < rayCount; i++) {
        const ray = createEffectElement("div");
        ray.className = "hit-ray";
        const angle = (i / rayCount) * 360 + (Math.random() - 0.5) * 8;
        const len = (isDirectAttack ? 110 : 70) + Math.random() * 60;
        ray.style.cssText = `transform:rotate(${angle}deg); --ray-len:${len}px; --hit-spark-color:${c.spark}; animation-delay:${Math.random() * 0.05}s;`;
        box.appendChild(ray);
    }

    // --- 5. 飞溅火花（更多更大） ---
    const sparkCount = scale(isDirectAttack ? 22 : 14);
    for (let i = 0; i < sparkCount; i++) {
        const spark = createEffectElement("div");
        spark.className = "hit-spark";
        const angle = Math.random() * Math.PI * 2;
        const dist = 25 + Math.random() * (isDirectAttack ? 90 : 60);
        const sx = Math.cos(angle) * dist;
        const sy = Math.sin(angle) * dist;
        const dur = 0.25 + Math.random() * 0.35;
        const size = 3 + Math.random() * 5;
        spark.style.cssText = `width:${size}px; height:${size}px; --sx:${sx}px; --sy:${sy}px; --spark-dur:${dur}s; --hit-spark-color:${c.spark}; --hit-glow:${c.glow}; left:${-size/2}px; top:${-size/2}px; animation-delay:${Math.random() * 0.06}s;`;
        box.appendChild(spark);

        // 火花拖尾线
        const trail = createEffectElement("div");
        trail.className = "hit-spark-trail";
        const trailAngle = angle * (180 / Math.PI);
        const trailLen = 18 + Math.random() * 30;
        trail.style.cssText = `transform:rotate(${trailAngle}deg); --trail-w:${trailLen}px; --hit-spark-color:${c.spark}; left:0; top:0; animation-delay:${Math.random() * 0.06}s;`;
        box.appendChild(trail);
    }

    // --- 6. 环形碎片（命中点飞散的菱形碎片） ---
    const debrisCount = scale(isDirectAttack ? 10 : 6);
    for (let i = 0; i < debrisCount; i++) {
        const debris = createEffectElement("div");
        debris.className = "hit-debris";
        const angle = (i / debrisCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const dist = 30 + Math.random() * (isDirectAttack ? 70 : 45);
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;
        const dr = (Math.random() - 0.5) * 360;
        const dur = 0.3 + Math.random() * 0.3;
        const dw = 4 + Math.random() * 6;
        const dh = 5 + Math.random() * 8;
        debris.style.cssText = `--dx:${dx}px; --dy:${dy}px; --dr:${dr}deg; --debris-dur:${dur}s; --dw:${dw}px; --dh:${dh}px; --hit-spark-color:${c.spark}; left:${-dw/2}px; top:${-dh/2}px; animation-delay:${Math.random() * 0.05}s;`;
        box.appendChild(debris);
    }

    // --- 7. 直接攻击额外：全屏扫描线 + 更强闪光 ---
    if (isDirectAttack) {
        const scanlines = createEffectElement("div");
        scanlines.className = "hit-scanlines";
        scanlines.style.setProperty("--hit-color", c.color);
        container.appendChild(scanlines);
        removeAfter(scanlines, 550);

        screenFlash(c.glow.replace(/[\d.]+\)/, ".25)"));
    }

    // --- 7b. 属性专属打击附加特效（已有特效在播时省略，避免同帧叠加过多节点） ---
    if (degrade) {
        // 降级：只保留核心闪光与震动
    } else if (attribute === "fire") {
        // 火属性：命中点火焰喷溅 + 烟雾
        for (let i = 0; i < 6; i++) {
            const flame = createEffectElement("div");
            flame.style.cssText = `position:fixed; left:${x}px; top:${y}px; z-index:${isDirectAttack ? 272 : 271}; pointer-events:none; width:4px; height:${10+Math.random()*15}px; background:linear-gradient(to top, rgba(255,100,30,.9), rgba(255,200,60,.4), transparent); border-radius:2px 2px 0 0; transform:rotate(${(Math.random()-0.5)*40}deg); animation:fireHitFlame .5s ease-out forwards; animation-delay:${i*0.03}s;`;
            container.appendChild(flame);
            removeAfter(flame, 500);
        }
    } else if (attribute === "water") {
        // 水属性：命中点水花飞溅
        for (let i = 0; i < 8; i++) {
            const splash = createEffectElement("div");
            const angle = Math.random() * Math.PI * 2;
            const dist = 15 + Math.random() * 40;
            splash.style.cssText = `position:fixed; left:${x}px; top:${y}px; z-index:271; pointer-events:none; width:3px; height:8px; border-radius:2px; background:rgba(100,200,255,.8); box-shadow:0 0 6px rgba(80,180,255,.5); --sx:${Math.cos(angle)*dist}px; --sy:${Math.sin(angle)*dist - 20}px; animation:waterHitSplash .5s ease-out forwards; animation-delay:${i*0.03}s;`;
            container.appendChild(splash);
            removeAfter(splash, 500);
        }
    } else if (attribute === "light") {
        // 光属性：命中点神圣十字闪光
        const holyCross = createEffectElement("div");
        holyCross.style.cssText = `position:fixed; left:${x}px; top:${y}px; z-index:271; pointer-events:none; width:40px; height:40px; margin:-20px; animation:lightHitCross .4s ease-out forwards;`;
        holyCross.innerHTML = `<div style="position:absolute;left:50%;top:0;width:2px;height:100%;background:rgba(255,240,120,.8);transform:translateX(-50%);box-shadow:0 0 8px rgba(255,240,120,.5);"></div><div style="position:absolute;top:50%;left:0;height:2px;width:100%;background:rgba(255,240,120,.8);transform:translateY(-50%);box-shadow:0 0 8px rgba(255,240,120,.5);"></div>`;
        container.appendChild(holyCross);
        removeAfter(holyCross, 450);
    } else if (attribute === "dark") {
        // 暗属性：命中点暗影腐蚀圈
        const corruption = createEffectElement("div");
        corruption.style.cssText = `position:fixed; left:${x}px; top:${y}px; z-index:271; pointer-events:none; width:0; height:0; margin:0; border-radius:50%; background:radial-gradient(circle, rgba(100,40,180,.6), transparent 60%); animation:darkHitCorrupt .5s ease-out forwards;`;
        container.appendChild(corruption);
        removeAfter(corruption, 500);
    } else if (attribute === "earth") {
        // 地属性：命中点碎石飞溅
        for (let i = 0; i < 6; i++) {
            const rock = createEffectElement("div");
            const angle = Math.random() * Math.PI * 2;
            const dist = 20 + Math.random() * 35;
            rock.style.cssText = `position:fixed; left:${x}px; top:${y}px; z-index:271; pointer-events:none; width:${3+Math.random()*4}px; height:${3+Math.random()*4}px; background:rgba(200,170,80,.8); clip-path:polygon(30% 0%, 100% 20%, 80% 100%, 0% 70%); --rx:${Math.cos(angle)*dist}px; --ry:${Math.sin(angle)*dist - 15}px; --rr:${Math.random()*360}deg; animation:earthHitRock .4s ease-out forwards; animation-delay:${i*0.025}s;`;
            container.appendChild(rock);
            removeAfter(rock, 450);
        }
    } else if (attribute === "wind") {
        // 风属性：命中点风刃弧线
        for (let i = 0; i < 4; i++) {
            const blade = createEffectElement("div");
            const angle = (i / 4) * 360 + Math.random() * 30;
            blade.style.cssText = `position:fixed; left:${x}px; top:${y}px; z-index:271; pointer-events:none; width:30px; height:2px; background:linear-gradient(90deg, transparent, rgba(160,255,200,.7), transparent); transform-origin:left center; transform:rotate(${angle}deg); animation:windHitBlade .35s ease-out forwards; animation-delay:${i*0.04}s;`;
            container.appendChild(blade);
            removeAfter(blade, 400);
        }
    }

    // --- 8. 屏幕震动增强 ---
    const bf = document.querySelector(".battlefield");
    if (bf) {
        bf.classList.remove("hit-shake-heavy", "shake");
        void bf.offsetWidth;
        bf.classList.add(isDirectAttack ? "hit-shake-heavy" : "shake");
        setTimeout(() => bf.classList.remove("hit-shake-heavy", "shake"), isDirectAttack ? 450 : 300);
    }

    // --- 9. 碰撞点闪光 ---
    screenFlash(c.glow.replace(/[\d.]+\)/, ".15)"));

    removeAfter(box, 700);
}

/**
 * 新版攻击运镜：怪兽冲过去 → 碰撞 → 活了滑回来 / 死了碎裂消失
 * @param attackerSlot - 攻击怪兽的DOM槽位
 * @param targetSlot - 目标怪兽的DOM槽位（null = 直接攻击玩家）
 * @param attackerCard - 攻击怪兽的卡牌数据
 * @param attackerSurvived - 攻击后攻击方是否存活
 * @param playerHud - 直接攻击时的玩家HUD元素
 */
function playAttackAnimationLegacy(attackerSlot, targetSlot, attackerCard, attackerSurvived, playerHud) {
    if (!isBrowser || !attackerSlot || !attackerCard) return Promise.resolve();

    const now = Date.now();
    const lightweight = now < attackVisualBusyUntil;
    attackVisualBusyUntil = Math.max(attackVisualBusyUntil, now + (lightweight ? 350 : 1150));
    const from = getRect(attackerSlot);
    const to = targetSlot ? getRect(targetSlot) : (playerHud ? getRect(playerHud) : from);
    const battlefield = document.querySelector(".battlefield");
    if (battlefield) {
        battlefield.classList.add("attack-performance-mode");
        setTimeout(() => battlefield.classList.remove("attack-performance-mode"), 1300);
    }
    if (!lightweight) playMonsterAttackSignature(from, to, attackerCard);

    const sourceElement = typeof attackerSlot.querySelector === "function" ? attackerSlot : null;
    const sourceCard = sourceElement?.querySelector(".card") || sourceElement;
    const previousVisibility = sourceCard?.style.visibility || "";
    if (sourceCard) sourceCard.style.visibility = "hidden";
    const restoreSource = () => {
        if (sourceCard?.isConnected) sourceCard.style.visibility = previousVisibility;
    };

    // 创建飞行克隆体
    const fly = createEffectElement("div");
    fly.className = `flying-card attack-fly${lightweight ? " attack-fly-lite" : ""}`;
    fly.innerHTML = `<div class="card in-field rarity-${escapeHtml(attackerCard.rarity || "N")}"><div class="card-frame elem-${attackerCard.attribute || "none"} type-monster"><div class="card-header"><span class="card-name">${escapeHtml(attackerCard.name)}</span><span class="card-level">Lv.${attackerCard.level || "?"}</span></div><div class="card-art"><div class="card-art-inner">${createFlyingCardInner(attackerCard)}</div></div><div class="card-footer"><span class="stat-atk"><span>ATK</span>${attackerCard.currentAttack || 0}</span></div></div></div>`;

    // 起始位置：怪兽槽位中心
    const startX = from.left + from.width / 2 - 48;
    const startY = from.top + from.height / 2 - 62;
    fly.style.cssText = `position:fixed; left:${startX}px; top:${startY}px; width:96px; height:125px; z-index:260; pointer-events:none; opacity:0; transition:none;`;
    document.body.appendChild(fly);

    // 终点位置：目标槽位中心
    const endX = to.left + to.width / 2 - 48;
    const endY = to.top + to.height / 2 - 62;

    // 计算移动距离
    const dx = endX - startX;
    const dy = endY - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const midX = startX + dx * 0.5;
    const midY = startY + dy * 0.5 - 30; // 中间点略微上抛

    let resolve;
    const done = new Promise(r => { resolve = r; });

    // 阶段1：怪兽从槽位弹起 (0-150ms)
    requestAnimationFrame(() => {
        fly.style.opacity = "1";
        fly.style.transition = "transform 0.15s cubic-bezier(.4,0,.2,1), opacity 0.1s ease";
        fly.style.transform = "translateY(-15px) scale(1.05)";
        fly.style.filter = lightweight ? "none" : "brightness(1.4)";
    });

    // 阶段2：冲向目标 (150-450ms)
    setTimeout(() => {
        fly.style.transition = "transform 0.3s cubic-bezier(.2,.8,.3,1), filter 0.3s ease";
        fly.style.transform = `translate(${dx}px, ${dy}px) scale(0.9)`;
        const attr = attackerCard.attribute || attackerCard.element || "none";
        const trailColors = {
            fire: "rgba(255,120,40,.5)", water: "rgba(80,180,255,.5)",
            wind: "rgba(120,255,160,.4)", earth: "rgba(200,170,80,.4)",
            light: "rgba(255,240,120,.5)", dark: "rgba(180,100,255,.5)",
        };
        fly.style.filter = lightweight
            ? "none"
            : `brightness(1.6) drop-shadow(0 0 10px ${trailColors[attr] || "rgba(255,200,100,.4)"})`;
        // 属性专属冲刺拖尾；连续攻击时省略，避免叠加大量短命节点。
        if (!lightweight && attr !== "none") {
            for (let t = 0; t < 4; t++) {
                const trail = createEffectElement("div");
                trail.style.cssText = `position:fixed; z-index:258; pointer-events:none; width:20px; height:4px; border-radius:2px; left:${startX + dx * (t / 4) + 48}px; top:${startY + dy * (t / 4) + 62}px; transform:rotate(${Math.atan2(dy, dx) * 180 / Math.PI}deg); background:linear-gradient(90deg, transparent, ${trailColors[attr]}, transparent); opacity:${0.6 - t * 0.12}; animation:attackTrailFade .3s linear forwards;`;
                document.body.appendChild(trail);
                removeAfter(trail, 350);
            }
        }

        // 镜头微晃
        if (battlefield) {
            battlefield.style.transition = "none";
            battlefield.style.transform = "translateX(-50%) translateY(2px)";
            setTimeout(() => {
                battlefield.style.transition = "transform 0.15s ease-out";
                battlefield.style.transform = "translateX(-50%) translateY(-1px)";
                setTimeout(() => {
                    battlefield.style.transition = "transform 0.2s ease-out";
                    battlefield.style.transform = "translateX(-50%)";
                }, 150);
            }, 50);
        }
    }, 150);

    // 阶段3：碰撞！(450ms)
    setTimeout(() => {
        const hitX = endX + 48;
        const hitY = endY + 62;
        const isDirect = !targetSlot;
        if (!lightweight) playHitImpact(hitX, hitY, attackerCard.attribute || "none", isDirect);

        // 卡牌碰撞回弹
        fly.style.transition = "transform 0.1s ease-out, filter 0.1s ease";
        fly.style.transform = `translate(${dx * 0.85}px, ${dy * 0.85}px) scale(1.1)`;
        fly.style.filter = lightweight ? "none" : "brightness(2) blur(1px)";
    }, 450);

    // 阶段4：根据结果决定去向 (600ms)
    setTimeout(() => {
        if (attackerSurvived) {
            // 存活：滑回原位
            fly.style.transition = "transform 0.5s cubic-bezier(.25,.8,.25,1), filter 0.5s ease, opacity 0.5s ease";
            fly.style.transform = "translate(0, 0) scale(1)";
            fly.style.filter = lightweight ? "none" : "brightness(1.1)";
            fly.style.opacity = "1";

            // 回到原位后消失
            setTimeout(() => {
                fly.style.transition = "opacity 0.2s ease";
                fly.style.opacity = "0";
                setTimeout(() => { restoreSource(); fly.remove(); resolve(); }, 250);
            }, 500);
        } else {
            // 被破坏：碎裂消失
            // 镜像破碎效果
            const shatter = createEffectElement("div");
            shatter.className = "mirror-shatter";
            shatter.style.cssText = `position:fixed; left:${startX}px; top:${startY}px; width:96px; height:125px; z-index:265;`;

            // 裂纹
            const crack = createEffectElement("div");
            crack.className = "mirror-crack";
            crack.style.cssText = `--a1:${30 + Math.random() * 30}deg; --a2:${120 + Math.random() * 40}deg; --a3:${200 + Math.random() * 30}deg;`;
            shatter.appendChild(crack);

            // 闪光
            const flash = createEffectElement("div");
            flash.className = "mirror-flash";
            shatter.appendChild(flash);

            // 碎片
            for (let i = 0; i < 14; i++) {
                const shard = createEffectElement("div");
                shard.className = "mirror-shard";
                const angle = (i / 14) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
                const dist = 40 + Math.random() * 50;
                const sx = Math.cos(angle) * dist;
                const sy = Math.sin(angle) * dist;
                const sr = (Math.random() - 0.5) * 540;
                const w = 10 + Math.random() * 18;
                const h = 12 + Math.random() * 20;
                const x = 10 + Math.random() * 70;
                const y = 10 + Math.random() * 70;
                shard.style.cssText = `left:${x}%; top:${y}%; width:${w}px; height:${h}px; --sx:${sx}px; --sy:${sy}px; --sr:${sr}deg; clip-path:polygon(${Math.random()*30}% 0%, 100% ${Math.random()*30}%, ${70+Math.random()*30}% 100%, 0% ${70+Math.random()*30}%); animation-delay:${Math.random() * 0.06}s;`;
                shatter.appendChild(shard);
            }
            document.body.appendChild(shatter);

            // 卡牌缩小消失
            fly.style.transition = "transform 0.35s cubic-bezier(.4,0,.2,1), opacity 0.35s ease, filter 0.35s ease";
            fly.style.transform = `translate(${dx}px, ${dy}px) scale(0.2) rotate(${(Math.random()-0.5)*30}deg)`;
            fly.style.opacity = "0";
            fly.style.filter = lightweight ? "none" : "brightness(2.5) blur(3px)";

            setTimeout(() => { restoreSource(); shatter.remove(); fly.remove(); resolve(); }, 500);
        }
    }, 600);

    return done;
}

/**
 * 新版攻击演出入口：按「攻击档案」播放专属招式（只动特效层）。
 * R 稀有度与异常情况回退旧版演出（playAttackAnimationLegacy）。
 */
export function playAttackAnimation(attackerSlot, targetSlot, attackerCard, attackerSurvived, playerHud) {
    if (!isBrowser || !attackerSlot || !attackerCard) return Promise.resolve();
    const performanceOwner = Number(attackerSlot.dataset?.owner ?? 0);
    const performanceTarget = targetSlot || playerHud || document.getElementById(performanceOwner === 0 ? "opponent-area" : "player-area");
    const performance = playCardPerformance(attackerCard, "attack", attackerSlot, performanceTarget);
    if (authoredScene(attackerCard, "attack")) return performance;
    let profile = null;
    try { profile = getAttackProfile(attackerCard); } catch (error) { profile = null; }
    if (!profile || profile.legacy) {
        return playAttackAnimationLegacy(attackerSlot, targetSlot, attackerCard, attackerSurvived, playerHud);
    }
    const screen = document.getElementById("battle-screen");
    if (!screen) {
        return playAttackAnimationLegacy(attackerSlot, targetSlot, attackerCard, attackerSurvived, playerHud);
    }
    // 攻击者/目标可能是"纯矩形"（怪兽已在本回合结算中被破坏，DOM 元素已移除），
    // 这种情况没有可动画的卡牌元素，回退旧版演出（克隆飞行）保证仍有攻击过程。
    const resolveCardEl = (node) => (node && typeof node.querySelector === "function")
        ? (node.querySelector(".card") || node)
        : null;
    const attackerEl = resolveCardEl(attackerSlot);
    if (!attackerEl) {
        return playAttackAnimationLegacy(attackerSlot, targetSlot, attackerCard, attackerSurvived, playerHud);
    }
    // 直接攻击（targetSlot 为空）时，演出目标指向"对手怪兽区整行"，
    // 卡牌会朝对手场地方向竖直突进，而不是冲向角落的对手信息栏。
    const attackerOwner = Number(attackerSlot.dataset?.owner ?? attackerSlot.closest?.("[data-owner]")?.dataset.owner ?? 0);
    const targetEl = targetSlot
        ? resolveCardEl(targetSlot)
        : (playerHud
            || document.querySelector(`[data-drop-zone="monster"][data-owner="${attackerOwner === 0 ? 1 : 0}"]`)
            || document.getElementById("battlefield")
            || screen);
    if (!targetEl) {
        return playAttackAnimationLegacy(attackerSlot, targetSlot, attackerCard, attackerSurvived, playerHud);
    }
    const card = {
        id: attackerCard.id || attackerCard.instanceId || attackerCard.name,
        name: attackerCard.name,
        rarity: attackerCard.rarity || "N",
        attribute: attackerCard.attribute || attackerCard.element || "none",
        atk: Number(attackerCard.currentAttack != null ? attackerCard.currentAttack : attackerCard.attack) || 0,
    };
    // 战斗结算会立即刷新卡槽；飞行使用独立副本，避免原卡离场时动画中途消失。
    const screenRect = screen.getBoundingClientRect();
    const scaleX = screenRect.width / (screen.offsetWidth || screenRect.width || 1) || 1;
    const scaleY = screenRect.height / (screen.offsetHeight || screenRect.height || 1) || 1;
    const makeAnchor = (element, clone = false) => {
        const rect = element.getBoundingClientRect();
        const node = clone ? element.cloneNode(true) : createEffectElement("div");
        node.removeAttribute("id");
        node.removeAttribute("data-instance-id");
        node.dataset.attackGhost = clone ? "attacker" : "target";
        node.style.cssText = `position:absolute;left:${(rect.left - screenRect.left) / scaleX}px;top:${(rect.top - screenRect.top) / scaleY}px;width:${rect.width / scaleX}px;height:${rect.height / scaleY}px;margin:0;transform:none;translate:none;pointer-events:none;z-index:279;`;
        screen.appendChild(node);
        return node;
    };
    const flyingCard = makeAnchor(attackerEl, true);
    const targetAnchor = makeAnchor(targetEl);
    const oldVisibility = attackerEl.style.visibility;
    attackerEl.style.visibility = "hidden";
    return Promise.resolve(playCardAttack({ arena: screen, attackerEl: flyingCard, targetEl: targetAnchor, card, speed: 1 }))
        .finally(() => {
            flyingCard.remove();
            targetAnchor.remove();
            attackerEl.style.visibility = oldVisibility;
        })
        .catch((error) => {
            console.warn("[attack-fx] 新演出异常，回退旧演出：", error);
            return playAttackAnimationLegacy(attackerSlot, targetSlot, attackerCard, attackerSurvived, playerHud);
        });
}

function createFlyingCardInner(card) {
    // 飞行卡牌（抽卡/出牌/卡包揭晓）用 640px 大图，缩略图在放大的演出里会发虚
    const img = card.fullImage || card.image || card.thumbnail;
    const imageClass = card?.rarity === "R" ? "" : "card-breeze-image";
    const motionStyle = card?.rarity === "R"
        ? ""
        : `--card-breeze-delay:-${((stableCardSeed(`${card?.id || ""}:${card?.name || ""}:${card?.image || card?.thumbnail || ""}`) % 7000) / 1000).toFixed(3)}s;`;
    const art = img
        ? `<img class="${imageClass}" src="${escapeHtml(img)}" alt="${escapeHtml(card.name)}" style="width:100%;height:100%;object-fit:cover;${motionStyle}" onerror="this.style.display='none'">`
        : `<div style="width:100%;height:100%;display:grid;place-items:center;font-size:28px;font-weight:900;color:rgba(255,255,255,.6)">${escapeHtml(card.name?.[0] || "?")}</div>`;
    const effect = card?.rarity === "R" ? "" : '<span class="card-breeze-overlay" aria-hidden="true"></span>';
    return `${art}${effect}`;
}

function spawnShatterFragments(container, count) {
    const colors = [
        "rgba(255,255,255,.12)", "rgba(255,200,100,.1)",
        "rgba(180,100,255,.08)", "rgba(85,216,229,.08)",
    ];
    for (let i = 0; i < count; i++) {
        const f = createEffectElement("div");
        f.className = "shatter-fragment";
        const angle = (i / count) * Math.PI * 2;
        const dist = 30 + Math.random() * 40;
        const sx = Math.cos(angle) * dist;
        const sy = Math.sin(angle) * dist;
        const sr = 90 + Math.random() * 270;
        const w = 8 + Math.random() * 10;
        const h = 10 + Math.random() * 14;
        f.style.cssText = `
            left:calc(50% - ${w/2}px); top:calc(50% - ${h/2}px);
            --sx:${sx}px; --sy:${sy}px; --sr:${sr}deg;
            --w:${w}px; --h:${h}px;
            --bg:${colors[Math.floor(Math.random() * colors.length)]};
        `;
        container.appendChild(f);
        removeAfter(f, 650);
    }
}

/**
 * 显示伤害/回复数字
 */
export function showDamageNumber(container, value, type = "damage") {
    if (!isBrowser || !container || !value) return;
    const el = createEffectElement("div");
    el.className = `damage-number ${type}`;
    el.textContent = type === "damage" ? `-${value}` : `+${value}`;
    container.appendChild(el);
    removeAfter(el, 900);
}

/**
 * 破坏怪兽特效
 */
export function playDestroyEffect(fieldSlot) {
    if (!isBrowser || !fieldSlot) return;
    const card = fieldSlot.querySelector(".card");
    if (card) {
        card.classList.add("destroying");
        setTimeout(() => card.classList.remove("destroying"), 500);
    }
    spawnParticles(fieldSlot, "destroy-particle", 10, 40);
    screenFlash("rgba(255,80,100,.06)");
}

/**
 * 治愈特效
 */
export function playHealEffect(fieldSlot) {
    if (!isBrowser || !fieldSlot) return;
    const glow = createEffectElement("div");
    glow.className = "heal-glow";
    fieldSlot.appendChild(glow);
    removeAfter(glow, 750);
    spawnParticles(fieldSlot, "heal-sparkle", 6, 20);
}

// =====================================================================
//  高级特效
// =====================================================================

/**
 * 翻转召唤特效（Y轴180度翻转 + 金色粒子爆发）
 */
export function playFlipSummonEffect(fieldSlot, isDefense = false) {
    if (!isBrowser) return;

    const container = fieldSlot || document.querySelector(".battle-screen") || document.body;

    if (fieldSlot) {
        const card = fieldSlot.querySelector(".card");
        if (card) {
            card.classList.add(isDefense ? "flipping-defense" : "flipping");
            setTimeout(() => {
                card.classList.remove("flipping", "flipping-defense");
            }, isDefense ? 950 : 850);
        }

        // 金色粒子爆发
        spawnGoldParticles(fieldSlot, 16);

        // 闪光环
        const ring = createEffectElement("div");
        ring.className = "flip-flash-ring";
        fieldSlot.appendChild(ring);
        removeAfter(ring, 650);

        // 防御表示额外护盾
        if (isDefense) {
            const shield = createEffectElement("div");
            shield.className = "defense-shield";
            fieldSlot.appendChild(shield);
            removeAfter(shield, 1050);
        }
    }

    screenFlash("rgba(255,211,107,.12)");
}

function spawnGoldParticles(container, count) {
    for (let i = 0; i < count; i++) {
        const p = createEffectElement("div");
        p.className = "flip-gold-particle";
        const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const dist = 20 + Math.random() * 35;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist - 15;
        const size = 3 + Math.random() * 4;
        p.style.cssText = `
            left:calc(50% - ${size/2}px); top:calc(50% - ${size/2}px);
            --dx:${dx}px; --dy:${dy}px; --size:${size}px;
            animation-delay:${Math.random() * 0.15}s;
        `;
        container.appendChild(p);
        removeAfter(p, 750);
    }
}

/**
 * 陷阱连锁发动（旧版兼容包装 → V3）
 */
export function playTrapChainEffect(fieldSlot, cardName = "") {
    if (!isBrowser || !fieldSlot) return;
    const trapCard = { name: cardName || "陷阱", type: "trap", rarity: "R" };
    playTrapActivationV3(fieldSlot, trapCard);
}

/**
 * 陷阱卡连锁发动完整运镜 V4
 * 镜头偏移到陷阱区 → 卡牌翻转揭示 → 镜头回去 → 翻开的卡运镜飞向墓区
 * @param trapSlot - 盖放陷阱卡的DOM槽位
 * @param trapCard - 陷阱卡数据
 * @param targetType - 效果目标类型 (null=无目标, "monster"=怪兽, "player"=玩家)
 * @param targetSlot - 目标DOM槽位
 * @param htmlFn - 卡牌渲染函数
 */
export function playTrapActivationV3(trapSlot, trapCard, targetType = null, targetSlot = null, htmlFn = null) {
    if (!isBrowser || !trapSlot || !trapCard) return Promise.resolve();
    playCardThemeAccent(trapCard, trapSlot);

    const container = document.querySelector(".battle-screen") || document.body;
    const battlefield = document.querySelector(".battlefield");
    const slotRect = getRect(trapSlot);
    const isPlayer = trapSlot.dataset.owner === "0";

    // 墓地区DOM
    const graveyardId = isPlayer ? "player-graveyard-pile" : "opponent-graveyard-pile";
    const graveyardPile = document.getElementById(graveyardId) || document.querySelector(".graveyard-pile-" + (isPlayer ? "player" : "opponent"));

    let resolve;
    const done = new Promise(r => { resolve = r; });

    // === 全屏暗紫底光 ===
    const overlay = createEffectElement("div");
    overlay.className = "trap-purple-overlay";
    container.appendChild(overlay);
    removeAfter(overlay, 2200);

    // === 阶段1：镜头偏移到陷阱区 (0-350ms) ===
    if (battlefield) {
        // 计算陷阱槽位在画面中的偏移量
        const slotCenterY = slotRect.top + slotRect.height / 2;
        const viewCenterY = window.innerHeight * 0.5;
        const panOffset = viewCenterY - slotCenterY;

        battlefield.style.transition = "transform 0.35s cubic-bezier(.3,1,.4,1)";
        battlefield.style.transform = `translateX(-50%) translateY(${panOffset * 0.7}px) scale(1.08)`;
    }

    // === 阶段2：盖卡翻转揭示 (350-850ms) ===
    setTimeout(() => {
        // 盖卡弹起翻转
        trapSlot.classList.add("trap-flip-launch");
        setTimeout(() => trapSlot.classList.remove("trap-flip-launch"), 550);

        // 翻转闪光（在陷阱槽位位置）
        const flash = createEffectElement("div");
        flash.style.cssText = `position:fixed; left:${slotRect.left + slotRect.width / 2}px; top:${slotRect.top + slotRect.height / 2}px; width:0; height:0; z-index:265; background:radial-gradient(circle, rgba(180,100,255,.7), transparent 70%); border-radius:50%; transform:translate(-50%,-50%); animation:mirrorFlash .4s ease-out forwards;`;
        container.appendChild(flash);
        removeAfter(flash, 500);

        // 紫色能量环（在陷阱槽位）
        for (let i = 0; i < 3; i++) {
            const ring = createEffectElement("div");
            ring.className = "magic-ring spell-effect-dark";
            ring.style.cssText = `position:fixed; left:${slotRect.left + slotRect.width / 2}px; top:${slotRect.top + slotRect.height / 2}px; transform:translate(-50%,-50%); z-index:210; animation-delay:${i * 0.1}s; --spell-color:rgba(180,100,255,.7); --spell-glow:rgba(180,100,255,.3);`;
            container.appendChild(ring);
            removeAfter(ring, 800 + i * 100);
        }

        screenFlash("rgba(180,100,255,.12)");
    }, 350);

    // === 阶段3：镜头回弹到正常位置 (850-1200ms) ===
    setTimeout(() => {
        if (battlefield) {
            battlefield.style.transition = "transform 0.35s cubic-bezier(.25,.8,.25,1)";
            battlefield.style.transform = "translateX(-50%)";
        }
    }, 850);

    // === 阶段4：翻开的陷阱卡运镜飞向墓区 (1200-2200ms) ===
    // 类似 playToGraveyard 的运镜：从陷阱区出发 → 飞向镜头放大 → 回退缩小 → 滑入墓区
    setTimeout(() => {
        const fromX = slotRect.left;
        const fromY = slotRect.top;

        // 终点：墓地区位置
        let endX, endY;
        if (graveyardPile) {
            const gyRect = getRect(graveyardPile);
            endX = gyRect.left + gyRect.width / 2 - 71;
            endY = gyRect.top + 20;
        } else {
            endX = isPlayer ? window.innerWidth * 0.2 - 71 : window.innerWidth * 0.2 - 71;
            endY = isPlayer ? window.innerHeight * 0.65 - 101 : window.innerHeight * 0.2 - 101;
        }

        // 镜头中心（画面中央偏上）
        const camX = window.innerWidth / 2 - 71;
        const camY = window.innerHeight * 0.35 - 101;

        // 创建飞行卡牌（显示翻开的卡面）
        const fly = createEffectElement("div");
        fly.className = "flying-card";
        fly.innerHTML = `<div class="card in-field rarity-${escapeHtml(trapCard.rarity || "N")}"><div class="card-frame elem-dark type-trap"><div class="card-header"><span class="card-name">${escapeHtml(trapCard.name)}</span></div><div class="card-art"><div class="card-art-inner">${createFlyingCardInner(trapCard)}</div></div><div class="card-footer"><span class="stat-type">TRAP</span></div></div></div>`;
        fly.style.left = `${fromX}px`;
        fly.style.top = `${fromY}px`;
        fly.style.opacity = "0";
        fly.style.zIndex = "260";
        fly.style.transition = "none";
        fly.style.transformStyle = "preserve-3d";
        fly.style.perspective = "800px";
        document.body.appendChild(fly);

        // 光效拖尾
        const trail = createEffectElement("div");
        trail.className = "draw-light-trail";
        trail.style.cssText = `position:fixed; z-index:259; pointer-events:none; left:${fromX}px; top:${fromY}px; width:142px; height:202px; opacity:0;`;
        document.body.appendChild(trail);

        // 子阶段A：卡牌从陷阱位升起+亮度提升 (0-300ms)
        requestAnimationFrame(() => {
            fly.style.opacity = "1";
            fly.style.transition = "transform 0.3s cubic-bezier(.4,0,.2,1), opacity 0.2s ease, filter 0.3s ease";
            fly.style.transform = "translateY(-20px) rotateY(180deg) scale(1.1)";
            fly.style.filter = "brightness(1.8) blur(1px)";
        });

        // 子阶段B：斜向飞向镜头放大 (300-800ms)
        setTimeout(() => {
            fly.style.transition = "transform 0.5s cubic-bezier(.1,.9,.2,1), filter 0.5s ease";
            fly.style.transform = `translate(${camX - fromX}px, ${camY - fromY}px) rotateY(360deg) scale(2.8)`;
            fly.style.filter = "brightness(1.6) blur(0px)";
            fly.style.zIndex = "300";

            trail.style.transition = "transform 0.5s cubic-bezier(.1,.9,.2,1), opacity 0.4s ease, filter 0.5s ease";
            trail.style.transform = `translate(${camX - fromX}px, ${camY - fromY}px) scale(2.5)`;
            trail.style.filter = "blur(4px)";
            trail.style.opacity = "0.6";

            // 镜头微晃
            if (battlefield) {
                battlefield.style.transition = "none";
                battlefield.style.transform = "translateX(-50%) translateY(2px)";
                setTimeout(() => {
                    battlefield.style.transition = "transform 0.15s ease-out";
                    battlefield.style.transform = "translateX(-50%) translateY(-1px)";
                    setTimeout(() => {
                        battlefield.style.transition = "transform 0.2s ease-out";
                        battlefield.style.transform = "translateX(-50%)";
                    }, 150);
                }, 50);
            }
        }, 300);

        // 子阶段C：近距离维持 (800-1200ms)

        // 子阶段D：减速回退缩小向墓区 (1200-1800ms)
        setTimeout(() => {
            fly.style.transition = "transform 0.6s cubic-bezier(.25,.8,.25,1), filter 0.6s ease";
            fly.style.transform = `translate(${endX - fromX}px, ${endY - fromY}px) rotateY(540deg) scale(1)`;
            fly.style.filter = "brightness(1.1) blur(0px)";
            fly.style.zIndex = "260";

            trail.style.transition = "transform 0.6s cubic-bezier(.25,.8,.25,1), opacity 0.6s ease, filter 0.6s ease";
            trail.style.transform = `translate(${endX - fromX}px, ${endY - fromY}px) scale(1)`;
            trail.style.filter = "blur(2px)";
            trail.style.opacity = "0.3";
        }, 1200);

        // 子阶段E：滑入墓区消失 (1800-2100ms)
        setTimeout(() => {
            fly.style.transition = "transform 0.3s cubic-bezier(.4,0,.2,1), opacity 0.3s ease, filter 0.3s ease";
            fly.style.transform = `translate(${endX - fromX}px, ${endY + 20 - fromY}px) rotateY(720deg) scale(0.8)`;
            fly.style.filter = "brightness(1) blur(0px)";
            fly.style.opacity = "0";

            trail.style.transition = "opacity 0.3s ease";
            trail.style.opacity = "0";

            // 墓区发光
            if (graveyardPile) {
                graveyardPile.style.transition = "box-shadow 0.3s ease";
                graveyardPile.style.boxShadow = "0 0 40px rgba(180,100,255,.5)";
                setTimeout(() => {
                    graveyardPile.style.boxShadow = "";
                    graveyardPile.style.transition = "";
                }, 400);
            }

            screenFlash("rgba(180,100,255,.08)");
        }, 1800);

        // 清理
        setTimeout(() => {
            fly.remove();
            trail.remove();
            resolve();
        }, 2200);
    }, 1200);

    return done;
}

/**
 * 反击型陷阱特写运镜 V4
 * 对方怪兽突进途中→镜头切到陷阱区→翻开→屏障挡住怪兽→镜头回去→陷阱卡飞向墓区
 * @param trapSlot - 盖放陷阱卡的DOM槽位
 * @param trapCard - 陷阱卡数据
 * @param attackerSlot - 正在攻击的对方怪兽DOM槽位
 * @param attackerCard - 攻击怪兽数据
 * @param htmlFn - 卡牌渲染函数
 */
export function playCounterTrapV3(trapSlot, trapCard, attackerSlot = null, attackerCard = null, htmlFn = null) {
    if (!isBrowser || !trapSlot || !trapCard) return Promise.resolve();

    const container = document.querySelector(".battle-screen") || document.body;
    const battlefield = document.querySelector(".battlefield");
    const slotRect = getRect(trapSlot);
    const isPlayer = trapSlot.dataset.owner === "0";

    // 墓地区DOM
    const graveyardId = isPlayer ? "player-graveyard-pile" : "opponent-graveyard-pile";
    const graveyardPile = document.getElementById(graveyardId) || document.querySelector(".graveyard-pile-" + (isPlayer ? "player" : "opponent"));

    let resolve;
    const done = new Promise(r => { resolve = r; });

    // === 全屏暗紫底光 ===
    const overlay = createEffectElement("div");
    overlay.className = "trap-purple-overlay";
    container.appendChild(overlay);
    removeAfter(overlay, 2800);

    // === 阶段1：镜头猛地切向陷阱区 (0-200ms) ===
    if (battlefield) {
        const slotCenterY = slotRect.top + slotRect.height / 2;
        const viewCenterY = window.innerHeight * 0.45;
        const panOffset = viewCenterY - slotCenterY;

        battlefield.style.transition = "transform 0.15s ease-in";
        battlefield.style.transform = `translateX(-50%) translateY(${panOffset * 0.8}px) scale(1.08)`;
    }

    // === 阶段2：陷阱卡翻开揭示 (200-600ms) ===
    setTimeout(() => {
        trapSlot.classList.add("trap-flip-launch");
        setTimeout(() => trapSlot.classList.remove("trap-flip-launch"), 550);

        // 翻开闪光
        const flash = createEffectElement("div");
        flash.style.cssText = `position:fixed; left:${slotRect.left + slotRect.width/2}px; top:${slotRect.top + slotRect.height/2}px; width:0; height:0; z-index:265; background:radial-gradient(circle, rgba(180,100,255,.7), transparent 70%); border-radius:50%; transform:translate(-50%,-50%); animation:mirrorFlash .4s ease-out forwards;`;
        container.appendChild(flash);
        removeAfter(flash, 500);

        // 紫色能量环
        for (let i = 0; i < 2; i++) {
            const ring = createEffectElement("div");
            ring.className = "magic-ring spell-effect-dark";
            ring.style.cssText = `position:fixed; left:${slotRect.left + slotRect.width/2}px; top:${slotRect.top + slotRect.height/2}px; transform:translate(-50%,-50%); z-index:210; animation-delay:${i * 0.08}s; --spell-color:rgba(180,100,255,.7); --spell-glow:rgba(180,100,255,.3);`;
            container.appendChild(ring);
            removeAfter(ring, 700 + i * 80);
        }

        screenFlash("rgba(180,100,255,.12)");
    }, 200);

    // === 阶段3：屏障特效挡在怪兽前 + 镜头回弹 (600-1000ms) ===
    setTimeout(() => {
        // 屏障挡住攻击
        if (attackerSlot) {
            const atkRect = getRect(attackerSlot);
            const barrier = createEffectElement("div");
            barrier.className = "trap-counter-barrier";
            barrier.style.cssText = `position:fixed; left:${atkRect.left + atkRect.width/2}px; top:${atkRect.top - 20}px; transform:translate(-50%,-50%);`;
            container.appendChild(barrier);
            removeAfter(barrier, 1300);

            // 怪兽骤停+后退
            attackerSlot.style.transition = "transform 0.15s ease-out";
            attackerSlot.style.transform = "translateY(5px) scale(0.95)";
            setTimeout(() => {
                attackerSlot.style.transition = "transform 0.3s cubic-bezier(.25,.8,.25,1)";
                attackerSlot.style.transform = "";
            }, 200);
        }

        // 镜头回弹到正常
        if (battlefield) {
            battlefield.style.transition = "transform 0.4s cubic-bezier(.25,.8,.25,1)";
            battlefield.style.transform = "translateX(-50%)";
        }

        // 镜头微晃
        if (battlefield) {
            battlefield.classList.add("camera-shake-micro");
            setTimeout(() => battlefield.classList.remove("camera-shake-micro"), 300);
        }

        screenFlash("rgba(180,100,255,.15)");
    }, 600);

    // === 阶段4：陷阱卡运镜飞向墓区 (1000-2000ms) ===
    setTimeout(() => {
        const fromX = slotRect.left;
        const fromY = slotRect.top;

        // 终点：墓地区位置
        let endX, endY;
        if (graveyardPile) {
            const gyRect = getRect(graveyardPile);
            endX = gyRect.left + gyRect.width / 2 - 71;
            endY = gyRect.top + 20;
        } else {
            endX = isPlayer ? window.innerWidth * 0.2 - 71 : window.innerWidth * 0.2 - 71;
            endY = isPlayer ? window.innerHeight * 0.65 - 101 : window.innerHeight * 0.2 - 101;
        }

        // 镜头中心
        const camX = window.innerWidth / 2 - 71;
        const camY = window.innerHeight * 0.35 - 101;

        // 创建飞行卡牌（翻开的陷阱卡面）
        const fly = createEffectElement("div");
        fly.className = "flying-card";
        fly.innerHTML = `<div class="card in-field rarity-${escapeHtml(trapCard.rarity || "N")}"><div class="card-frame elem-dark type-trap"><div class="card-header"><span class="card-name">${escapeHtml(trapCard.name)}</span></div><div class="card-art"><div class="card-art-inner">${createFlyingCardInner(trapCard)}</div></div><div class="card-footer"><span class="stat-type">TRAP</span></div></div></div>`;
        fly.style.left = `${fromX}px`;
        fly.style.top = `${fromY}px`;
        fly.style.opacity = "0";
        fly.style.zIndex = "260";
        fly.style.transition = "none";
        fly.style.transformStyle = "preserve-3d";
        fly.style.perspective = "800px";
        document.body.appendChild(fly);

        // 光效拖尾
        const trail = createEffectElement("div");
        trail.className = "draw-light-trail";
        trail.style.cssText = `position:fixed; z-index:259; pointer-events:none; left:${fromX}px; top:${fromY}px; width:142px; height:202px; opacity:0;`;
        document.body.appendChild(trail);

        // 子阶段A：卡牌从陷阱位升起 (0-250ms)
        requestAnimationFrame(() => {
            fly.style.opacity = "1";
            fly.style.transition = "transform 0.25s cubic-bezier(.4,0,.2,1), opacity 0.2s ease, filter 0.25s ease";
            fly.style.transform = "translateY(-20px) rotateY(180deg) scale(1.1)";
            fly.style.filter = "brightness(1.8) blur(1px)";
        });

        // 子阶段B：斜向飞向镜头放大 (250-700ms)
        setTimeout(() => {
            fly.style.transition = "transform 0.45s cubic-bezier(.1,.9,.2,1), filter 0.45s ease";
            fly.style.transform = `translate(${camX - fromX}px, ${camY - fromY}px) rotateY(360deg) scale(2.8)`;
            fly.style.filter = "brightness(1.6) blur(0px)";
            fly.style.zIndex = "300";

            trail.style.transition = "transform 0.45s cubic-bezier(.1,.9,.2,1), opacity 0.35s ease, filter 0.45s ease";
            trail.style.transform = `translate(${camX - fromX}px, ${camY - fromY}px) scale(2.5)`;
            trail.style.filter = "blur(4px)";
            trail.style.opacity = "0.6";
        }, 250);

        // 子阶段C：近距离维持 (700-1100ms)

        // 子阶段D：减速回退缩小向墓区 (1100-1600ms)
        setTimeout(() => {
            fly.style.transition = "transform 0.5s cubic-bezier(.25,.8,.25,1), filter 0.5s ease";
            fly.style.transform = `translate(${endX - fromX}px, ${endY - fromY}px) rotateY(540deg) scale(1)`;
            fly.style.filter = "brightness(1.1) blur(0px)";
            fly.style.zIndex = "260";

            trail.style.transition = "transform 0.5s cubic-bezier(.25,.8,.25,1), opacity 0.5s ease, filter 0.5s ease";
            trail.style.transform = `translate(${endX - fromX}px, ${endY - fromY}px) scale(1)`;
            trail.style.filter = "blur(2px)";
            trail.style.opacity = "0.3";
        }, 1100);

        // 子阶段E：滑入墓区消失 (1600-1900ms)
        setTimeout(() => {
            fly.style.transition = "transform 0.3s cubic-bezier(.4,0,.2,1), opacity 0.3s ease, filter 0.3s ease";
            fly.style.transform = `translate(${endX - fromX}px, ${endY + 20 - fromY}px) rotateY(720deg) scale(0.8)`;
            fly.style.filter = "brightness(1) blur(0px)";
            fly.style.opacity = "0";

            trail.style.transition = "opacity 0.3s ease";
            trail.style.opacity = "0";

            // 墓区发光
            if (graveyardPile) {
                graveyardPile.style.transition = "box-shadow 0.3s ease";
                graveyardPile.style.boxShadow = "0 0 40px rgba(180,100,255,.5)";
                setTimeout(() => {
                    graveyardPile.style.boxShadow = "";
                    graveyardPile.style.transition = "";
                }, 400);
            }

            screenFlash("rgba(180,100,255,.08)");
        }, 1600);

        // 清理
        setTimeout(() => {
            fly.remove();
            trail.remove();
            // 陷阱槽位清空
            trapSlot.innerHTML = `<div class="field-slot empty spell-trap-slot" data-owner="${trapSlot.dataset.owner}" data-zone="spell-trap"></div>`;
            resolve();
        }, 2000);
    }, 1000);

    return done;
}

/**
 * 简化版陷阱卡发动动画 V5
 * 只做翻牌+显示名称，运镜飞墓区由外部在效果结算后调用
 * @param trapSlot - 盖放陷阱卡的DOM槽位
 * @param trapCard - 陷阱卡数据
 */
export function playTrapActivationV5(trapSlot, trapCard) {
    if (!isBrowser || !trapSlot || !trapCard) return Promise.resolve();
    const performance = playCardPerformance(trapCard, "trap", trapSlot);
    if (authoredScene(trapCard, "trap")) {
        showAnnounceBanner("trap", "trap", trapCard.name || "陷阱");
        return performance;
    }
    if (document.body.classList.contains("reduce-motion") || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
        return performance;
    }

    const container = document.body;
    const slotRect = getRect(trapSlot);

    let resolve;
    const done = new Promise(r => { resolve = r; });

    // === 阶段1：翻牌动画 (0-400ms) ===
    trapSlot.classList.add("trap-flip-launch");
    setTimeout(() => trapSlot.classList.remove("trap-flip-launch"), 550);

    // 翻开闪光
    const flash = createEffectElement("div");
    flash.style.cssText = `position:fixed; left:${slotRect.left + slotRect.width / 2}px; top:${slotRect.top + slotRect.height / 2}px; width:0; height:0; z-index:265; background:radial-gradient(circle, rgba(180,100,255,.7), transparent 70%); border-radius:50%; transform:translate(-50%,-50%); animation:mirrorFlash .4s ease-out forwards;`;
    container.appendChild(flash);
    removeAfter(flash, 500);

    const reveal = createEffectElement("div");
    reveal.className = "trap-cinematic-card";
    reveal.innerHTML = `<div class="card in-field rarity-${escapeHtml(trapCard.rarity || "N")}"><div class="card-frame elem-dark type-trap"><div class="card-header"><span class="card-name">${escapeHtml(trapCard.name || "陷阱")}</span></div><div class="card-art"><div class="card-art-inner">${createFlyingCardInner(trapCard)}</div></div><div class="card-footer"><span class="stat-type">TRAP</span></div></div></div>`;
    reveal.style.cssText = `position:fixed;left:${slotRect.left}px;top:${slotRect.top}px;width:${slotRect.width}px;height:${slotRect.height}px;z-index:270;pointer-events:none;opacity:0;transform:rotateY(180deg) scale(.72);transition:none;`;
    document.body.appendChild(reveal);
    requestAnimationFrame(() => {
        reveal.style.opacity = "1";
        reveal.style.transition = "left .75s cubic-bezier(.2,.8,.2,1), top .75s cubic-bezier(.2,.8,.2,1), transform .75s cubic-bezier(.2,.8,.2,1), filter .75s ease";
        reveal.style.left = `${(window.innerWidth - slotRect.width) / 2}px`;
        reveal.style.top = `${(window.innerHeight - slotRect.height) / 2}px`;
        reveal.style.transform = "rotateY(360deg) scale(1.18)";
        reveal.style.filter = "drop-shadow(0 0 28px rgba(190,90,255,.9))";
    });
    setTimeout(() => {
        reveal.style.transition = "left .55s ease-in, top .55s ease-in, transform .55s ease-in, opacity .55s ease";
        reveal.style.left = `${slotRect.left}px`;
        reveal.style.top = `${slotRect.top}px`;
        reveal.style.transform = "rotateY(360deg) scale(.72)";
        reveal.style.opacity = ".35";
    }, 1250);
    setTimeout(() => reveal.remove(), 1850);

    // === 阶段2：显示陷阱卡名称横幅 (400ms) ===
    setTimeout(() => {
        showAnnounceBanner("trap", "trap", trapCard.name || "陷阱");
    }, 400);

    // 翻牌完成后resolve，让外部继续处理效果结算
    setTimeout(() => resolve(), 1850);

    return done;
}

export function playNegatedAttackBarrier(attackerSlot, targetSlot, attackerCard = null) {
    if (!isBrowser || !attackerSlot) return Promise.resolve();
    const attackerRect = getRect(attackerSlot);
    const targetRect = targetSlot ? getRect(targetSlot) : {
        left: window.innerWidth / 2,
        top: window.innerHeight / 2,
        width: 1,
        height: 1,
    };
    const startX = attackerRect.left + attackerRect.width / 2;
    const startY = attackerRect.top + attackerRect.height / 2;
    const targetX = targetRect.left + targetRect.width / 2;
    const targetY = targetRect.top + targetRect.height / 2;
    const wallX = startX + (targetX - startX) * 0.52;
    const wallY = startY + (targetY - startY) * 0.52;

    const barrier = createEffectElement("div");
    barrier.className = "negated-attack-wall";
    barrier.style.left = `${wallX}px`;
    barrier.style.top = `${wallY}px`;
    document.body.appendChild(barrier);

    const movingCard = createEffectElement("div");
    movingCard.className = "negated-attacker-card";
    movingCard.innerHTML = attackerSlot.querySelector(".card")?.outerHTML || `<strong>${escapeHtml(attackerCard?.name || "ATTACK")}</strong>`;
    movingCard.style.cssText = `left:${attackerRect.left}px;top:${attackerRect.top}px;width:${attackerRect.width}px;height:${attackerRect.height}px;`;
    document.body.appendChild(movingCard);

    const travelX = wallX - startX;
    const travelY = wallY - startY;
    requestAnimationFrame(() => {
        movingCard.style.transform = `translate(${travelX}px,${travelY}px) scale(1.04)`;
    });
    setTimeout(() => {
        barrier.classList.add("impact");
        movingCard.classList.add("rejected");
        movingCard.style.transform = `translate(${travelX * .42}px,${travelY * .42}px) rotate(-7deg) scale(.96)`;
        screenFlash("rgba(100,190,255,.16)");
    }, 520);
    setTimeout(() => {
        movingCard.style.transition = "transform .65s cubic-bezier(.2,.8,.2,1),opacity .3s ease";
        movingCard.style.transform = "translate(0,0) rotate(0) scale(1)";
    }, 900);

    return new Promise(resolve => setTimeout(() => {
        barrier.remove();
        movingCard.remove();
        resolve();
    }, 1650));
}

/**
 * 陷阱卡飞向墓区动画（效果结算后调用）
 * @param trapSlot - 陷阱卡DOM槽位
 * @param trapCard - 陷阱卡数据
 */
export function animateTrapToGraveyard(trapSlot, trapCard) {
    if (!isBrowser || !trapSlot || !trapCard) return Promise.resolve();
    const graveyardId = trapSlot.dataset?.owner === "0" ? "player-graveyard-pile" : "opponent-graveyard-pile";
    const html = `<div class="card in-field rarity-${escapeHtml(trapCard.rarity || "N")}"><div class="card-frame type-trap"><div class="card-art">${createFlyingCardInner(trapCard)}</div></div></div>`;
    return playCardTransfer(trapCard, html, trapSlot, document.getElementById(graveyardId), "graveyard");
}

/**
 * 卡面碎闪效果（在卡牌上添加流光覆盖层）
 * 调用后卡牌会根据鼠标移动产生钻石光泽
 */
export function addFoilShimmer(cardElement) {
    if (!isBrowser || !cardElement) return;
    const frame = cardElement.querySelector(".card-frame");
    if (!frame) return;
    if (frame.querySelector(".card-foil-overlay")) return;

    const overlay = createEffectElement("div");
    overlay.className = "card-foil-overlay";
    const shimmer = createEffectElement("div");
    shimmer.className = "card-foil-shimmer";
    overlay.appendChild(shimmer);
    frame.appendChild(overlay);

    // 鼠标移动时更新光泽角度
    cardElement.addEventListener("mousemove", e => {
        const rect = cardElement.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        const angle = Math.atan2(y - 0.5, x - 0.5) * (180 / Math.PI);
        shimmer.style.setProperty("--foil-angle", `${angle}deg`);
    });
}

/**
 * 玩家区域治愈特效
 */
export function playPlayerHealEffect(playerHud) {
    if (!isBrowser || !playerHud) return;
    playerHud.style.animation = "healGlow .7s ease-out";
    setTimeout(() => { playerHud.style.animation = ""; }, 750);
}

/**
 * 抽卡特效（光效）
 */
export function playDrawEffect(rarity = "N", attribute = "none") {
    if (!isBrowser) return;

    const rarityColors = {
        N: { color: "rgba(150,150,150,.3)", border: "rgba(150,150,150,.5)", sparkle: "rgba(200,200,200,.6)" },
        R: { color: "rgba(85,180,230,.3)", border: "rgba(85,180,230,.6)", sparkle: "rgba(120,200,250,.7)" },
        SR: { color: "rgba(255,180,50,.35)", border: "rgba(255,180,50,.7)", sparkle: "rgba(255,200,100,.8)" },
        SSR: { color: "rgba(255,140,30,.4)", border: "rgba(255,160,50,.8)", sparkle: "rgba(255,220,120,.9)" },
        UR: { color: "rgba(180,100,255,.4)", border: "rgba(180,120,255,.8)", sparkle: "rgba(200,160,255,.9)" },
    };
    const rc = rarityColors[rarity] || rarityColors["N"];

    // ????
    const cx = window.innerWidth / 2;
    const fly = createEffectElement("div");
    fly.className = "draw-card-fly";
    fly.style.cssText = `left:${cx}px; top:35%; --rarity-color:${rc.color}; --rarity-border:${rc.border}; animation-delay:0.05s;`;
    document.body.appendChild(fly);
    setTimeout(() => fly.remove(), 700);

    // ??????
    for (let i = 0; i < 6; i++) {
        const spark = createEffectElement("div");
        spark.className = "draw-rarity-sparkle";
        const angle = (i / 6) * Math.PI * 2;
        const dist = 30 + Math.random() * 20;
        spark.style.cssText = `left:${cx}px; top:35%; --dx:${Math.cos(angle)*dist}px; --dy:${Math.sin(angle)*dist - 20}px; background:${rc.sparkle}; box-shadow:0 0 6px ${rc.sparkle}; animation-delay:${i*0.06+0.1}s;`;
        document.body.appendChild(spark);
        setTimeout(() => spark.remove(), 600);
    }

    // ????
    const glow = createEffectElement("div");
    glow.className = "draw-glow-enhanced";
    glow.style.cssText = `--draw-glow-color:${rc.color.replace('.3','.1')};`;
    document.getElementById("battle-screen")?.appendChild(glow);
    removeAfter(glow, 650);
}

/**
 * 阶段转换闪光
 */
export function playPhaseFlash() {
    if (!isBrowser) return;
    const flash = createEffectElement("div");
    flash.className = "phase-flash";
    document.getElementById("battle-screen")?.appendChild(flash);
    removeAfter(flash, 550);
}

// =====================================================================
//  多样化卡牌效果动画
// =====================================================================

/**
 * 怪兽效果发动特效（通用闪光 + 属性色环）
 */
export function playMonsterEffect(fieldSlot, attribute = "none", effectType = "none", card = null, effectIndex = null, explicitTarget = null, visualOrigin = null) {
    if (!isBrowser || !fieldSlot) return;
    const ownerIndex = Number(fieldSlot.dataset.owner || 0);
    const selected = Number.isInteger(effectIndex) ? card?.effects?.[effectIndex] : null;
    const effects = selected ? [selected] : (card?.effects?.length ? card.effects : [{ type: effectType }]);
    effects.forEach((effect, index) => {
        setTimeout(() => playRuleDrivenEffect({ ...card, effects: [effect] }, visualOrigin || fieldSlot, ownerIndex, explicitTarget), index * 420);
    });

    // 发动闪光
    fieldSlot.classList.add("effect-activate");
    setTimeout(() => fieldSlot.classList.remove("effect-activate"), 650);

    // 属性色魔法环
    const ring = createEffectElement("div");
    ring.className = `magic-ring spell-effect-${attribute}`;
    ring.style.setProperty("--spell-color", getAttributeColor(attribute));
    ring.style.setProperty("--spell-glow", getAttributeGlow(attribute));
    fieldSlot.appendChild(ring);
    removeAfter(ring, 750);

    const battlefield = document.querySelector(".battlefield");

    // 根据效果类型添加额外粒子 + 镜头效果
    if (effectType === "buff" || effectType === "buffSelfAttack" || effectType === "buffSelfDefense" || effectType === "buffAllAlliesAttack") {
        spawnEffectParticles(fieldSlot, "buff-particle", 6);
        // 增益：镜头微升
        if (battlefield) {
            battlefield.style.transition = "transform 0.15s ease-out";
            battlefield.style.transform = "translateX(-50%) translateY(-4px)";
            setTimeout(() => {
                battlefield.style.transition = "transform 0.3s cubic-bezier(.25,.8,.25,1)";
                battlefield.style.transform = "translateX(-50%)";
            }, 150);
        }
    } else if (effectType === "debuff" || effectType === "debuffEnemyAttack" || effectType === "debuffAllEnemyAttack") {
        spawnEffectParticles(fieldSlot, "debuff-particle", 6);
        // 减益：镜头下沉
        if (battlefield) {
            battlefield.style.transition = "transform 0.15s ease-out";
            battlefield.style.transform = "translateX(-50%) translateY(4px)";
            setTimeout(() => {
                battlefield.style.transition = "transform 0.3s cubic-bezier(.25,.8,.25,1)";
                battlefield.style.transform = "translateX(-50%)";
            }, 150);
        }
    } else if (effectType === "healPlayer" || effectType === "healAllAllies") {
        playHealEffect(fieldSlot);
        // 治愈：镜头柔和上移
        if (battlefield) {
            battlefield.style.transition = "transform 0.2s ease-out";
            battlefield.style.transform = "translateX(-50%) translateY(-5px)";
            setTimeout(() => {
                battlefield.style.transition = "transform 0.4s cubic-bezier(.25,.8,.25,1)";
                battlefield.style.transform = "translateX(-50%)";
            }, 200);
        }
    } else if (effectType === "drawCards") {
        spawnEffectParticles(fieldSlot, "draw-particle", 5);
    } else if (effectType === "priorityTarget") {
        for (let i = 0; i < 8; i++) {
            const p = createEffectElement("div");
            p.className = "priority-shield-particle";
            const ox = (Math.random() - 0.5) * 40;
            p.style.cssText = `left:calc(50% + ${ox}px); top:50%; animation-delay:${i * 0.06}s;`;
            fieldSlot.appendChild(p);
            removeAfter(p, 800);
        }
        const shieldRing = createEffectElement("div");
        shieldRing.className = "priority-shield-ring";
        fieldSlot.appendChild(shieldRing);
        removeAfter(shieldRing, 700);
    } else if (effectType === "conditionalBuff") {
        for (let i = 0; i < 8; i++) {
            const p = createEffectElement("div");
            p.className = "conditional-buff-particle";
            const ox = (Math.random() - 0.5) * 40;
            const colors = ["rgba(255,200,60,.9)", "rgba(80,180,255,.9)"];
            p.style.cssText = `left:calc(50% + ${ox}px); top:50%; --cond-color:${colors[i % 2]}; animation-delay:${i * 0.06}s;`;
            fieldSlot.appendChild(p);
            removeAfter(p, 700);
        }
        screenFlash("rgba(255,200,60,.08)");
    } else if (effectType === "searchWaterMonster") {
        for (let i = 0; i < 6; i++) {
            const p = createEffectElement("div");
            p.className = "search-water-particle";
            const ox = (Math.random() - 0.5) * 50;
            const oy = (Math.random() - 0.5) * 50;
            p.style.cssText = `left:calc(50% + ${ox}px); top:calc(50% + ${oy}px); animation-delay:${i * 0.1}s;`;
            fieldSlot.appendChild(p);
            removeAfter(p, 1000);
        }
    } else if (effectType === "targetProtect") {
        for (let i = 0; i < 12; i++) {
            const p = createEffectElement("div");
            p.className = "protect-barrier-particle";
            const angle = (i / 12) * Math.PI * 2;
            const dist = 20 + Math.random() * 10;
            p.style.cssText = `left:50%; top:50%; --px:${Math.cos(angle) * dist}px; --py:${Math.sin(angle) * dist}px; animation-delay:${i * 0.04}s;`;
            fieldSlot.appendChild(p);
            removeAfter(p, 900);
        }
        const barrier = createEffectElement("div");
        barrier.className = "protect-barrier-shell";
        fieldSlot.appendChild(barrier);
        removeAfter(barrier, 600);
    } else if (effectType === "switchDefenseRedirect") {
        for (let i = 0; i < 8; i++) {
            const p = createEffectElement("div");
            p.className = "defense-redirect-particle";
            const ox = (Math.random() - 0.5) * 40;
            p.style.cssText = `left:calc(50% + ${ox}px); top:50%; animation-delay:${i * 0.05}s;`;
            fieldSlot.appendChild(p);
            removeAfter(p, 700);
        }
        const redirectShield = createEffectElement("div");
        redirectShield.className = "defense-redirect-shield";
        fieldSlot.appendChild(redirectShield);
        removeAfter(redirectShield, 500);
    } else if (effectType === "bounceBackrow") {
        for (let i = 0; i < 6; i++) {
            const p = createEffectElement("div");
            p.className = "bounce-backrow-particle";
            p.style.cssText = `left:50%; top:50%; --bx:${(Math.random() - 0.5) * 60}px; --by:${(Math.random() - 0.5) * 20}px; animation-delay:${i * 0.06}s;`;
            fieldSlot.appendChild(p);
            removeAfter(p, 800);
        }
    } else if (effectType === "recycleWaterAndProtect") {
        for (let i = 0; i < 8; i++) {
            const p = createEffectElement("div");
            p.className = "recycle-water-particle";
            p.style.cssText = `left:50%; top:50%; animation-delay:${i * 0.07}s;`;
            fieldSlot.appendChild(p);
            removeAfter(p, 900);
        }
    } else if (effectType === "effectDisruptor") {
        for (let i = 0; i < 12; i++) {
            const p = createEffectElement("div");
            p.className = "disruptor-wave-particle";
            const angle = (i / 12) * Math.PI * 2;
            const dist = 25;
            p.style.cssText = `left:50%; top:50%; --dx:${Math.cos(angle) * dist}px; --dy:${Math.sin(angle) * dist}px; animation-delay:${i * 0.04}s;`;
            fieldSlot.appendChild(p);
            removeAfter(p, 600);
        }
        const slice = createEffectElement("div");
        slice.className = "disruptor-slice";
        fieldSlot.appendChild(slice);
        removeAfter(slice, 500);
        screenFlash("rgba(180,100,255,.1)");
    } else if (effectType === "buffAllyOnDestroy") {
        for (let i = 0; i < 6; i++) {
            const p = createEffectElement("div");
            p.className = "ally-buff-spirit";
            const ox = (Math.random() - 0.5) * 30;
            p.style.cssText = `left:calc(50% + ${ox}px); top:50%; animation-delay:${i * 0.08}s;`;
            fieldSlot.appendChild(p);
            removeAfter(p, 800);
        }
        const glow = createEffectElement("div");
        glow.className = "ally-buff-glow";
        fieldSlot.appendChild(glow);
        removeAfter(glow, 800);
    } else if (effectType === "recycleSpellDraw") {
        for (let i = 0; i < 8; i++) {
            const p = createEffectElement("div");
            p.className = "recycle-spell-particle";
            const ox = (Math.random() - 0.5) * 30;
            p.style.cssText = `left:calc(50% + ${ox}px); top:50%; animation-delay:${i * 0.06}s;`;
            fieldSlot.appendChild(p);
            removeAfter(p, 900);
        }
        spawnEffectParticles(fieldSlot, "draw-particle", 4);
    } else if (effectType === "fusionSubstituteSpell") {
        for (let i = 0; i < 10; i++) {
            const p = createEffectElement("div");
            p.className = "fusion-sub-particle";
            p.style.cssText = `left:50%; top:50%; animation-delay:${i * 0.05}s;`;
            fieldSlot.appendChild(p);
            removeAfter(p, 800);
        }
        const fusionRing = createEffectElement("div");
        fusionRing.className = "fusion-sub-ring";
        fieldSlot.appendChild(fusionRing);
        removeAfter(fusionRing, 700);
        screenFlash("rgba(255,200,80,.1)");
    } else if (effectType === "searchSpellByDiscard") {
        for (let i = 0; i < 6; i++) {
            const p = createEffectElement("div");
            p.className = "search-spell-discard-particle";
            const ox = (Math.random() - 0.5) * 40;
            p.style.cssText = `left:calc(50% + ${ox}px); top:50%; animation-delay:${i * 0.08}s;`;
            fieldSlot.appendChild(p);
            removeAfter(p, 700);
        }
    } else if (effectType === "discardToDisableAttack") {
        for (let i = 0; i < 10; i++) {
            const p = createEffectElement("div");
            p.className = "disable-attack-particle";
            const angle = (i / 10) * Math.PI * 2;
            const dist = 20;
            p.style.cssText = `left:50%; top:50%; --cx:${Math.cos(angle) * dist}px; --cy:${Math.sin(angle) * dist}px; animation-delay:${i * 0.04}s;`;
            fieldSlot.appendChild(p);
            removeAfter(p, 700);
        }
        const chain = createEffectElement("div");
        chain.className = "disable-attack-chain";
        fieldSlot.appendChild(chain);
        removeAfter(chain, 500);
        screenFlash("rgba(180,60,80,.1)");
    }

    screenFlash(getFlashColor({ attribute }));
}

/**
 * 魔法卡发动特效（在屏幕中央播放，不依赖特定DOM元素）
 */
export function playSpellEffectV2(fieldSlot, attribute = "none", cardName = "", effectType = "none", card = null, ownerIndex = 0) {
    if (!isBrowser) return;
    if (authoredScene(card || cardName, "spell")) {
        showAnnounceBanner("spell", attribute, cardName);
        playRuleDrivenEffect(card || { name:cardName,type:effectType },fieldSlot,ownerIndex);
        return playCardPerformance(card || cardName, "spell", fieldSlot || document.getElementById(ownerIndex === 0 ? "player-area" : "opponent-area"));
    }
    playCardPerformance(card || cardName, "spell", fieldSlot || document.getElementById(ownerIndex === 0 ? "player-area" : "opponent-area"));
    const effect = card?.effects?.[0] || card?.effect || { type: effectType };
    playCardThemeAccent(card || { name: cardName, type: "spell", attribute }, fieldSlot);
    const hasRuleTarget = playRuleDrivenEffect(card || { name: cardName, type: effectType }, fieldSlot, ownerIndex);

    // 全屏通告
    showAnnounceBanner("spell", attribute, cardName);

    const visualKey = ruleVisualKey(effect.type);
    const effectName = String(effect.type || "").toLowerCase();
    const targetsMonster = ["weaken", "destroy", "banish", "return", "lock"].includes(visualKey)
        || (visualKey === "damage" && !/direct|player|bothplayers|burn/.test(effectName));
    if (targetsMonster && !hasRuleTarget) return;

    // 在battle-screen上播放特效（如果有的话），否则在body上
    const container = document.querySelector(".battle-screen") || document.body;
    const battlefield = document.querySelector(".battlefield");

    // 属性色魔法阵（更大更亮）
    const circle = createEffectElement("div");
    circle.className = `spell-circle ${attribute}`;
    circle.style.cssText = "position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:200;";
    container.appendChild(circle);
    removeAfter(circle, 900);

    // 属性色扩散环（4层，更大）
    for (let i = 0; i < 4; i++) {
        const ring = createEffectElement("div");
        ring.className = `magic-ring spell-effect-${attribute}`;
        ring.style.cssText = `position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:200; animation-delay:${i * 0.08}s; --spell-color:${getAttributeColor(attribute)}; --spell-glow:${getAttributeGlow(attribute)};`;
        container.appendChild(ring);
        removeAfter(ring, 900 + i * 100);
    }

    const glow = createEffectElement("div");
    glow.className = "screen-flash";
    glow.style.cssText = `--flash-color:${getFlashColor({ attribute })}; position:fixed; left:0; top:0; right:0; bottom:0; z-index:199;`;
    container.appendChild(glow);
    removeAfter(glow, 800);

    screenFlash(getFlashColor({ attribute }));

    // 魔法发动通用镜头晃动
    if (battlefield) {
        battlefield.style.transition = "none";
        battlefield.style.transform = "translateX(-50%) translateY(-3px)";
        setTimeout(() => {
            battlefield.style.transition = "transform 0.15s ease-out";
            battlefield.style.transform = "translateX(-50%) translateY(2px)";
            setTimeout(() => {
                battlefield.style.transition = "transform 0.2s ease-out";
                battlefield.style.transform = "translateX(-50%)";
            }, 150);
        }, 50);
    }

    // 根据效果类型追加专属特效
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    if (effectType === "drawCards") {
        // 抽卡：蓝色能量漩涡 + 卡牌雨 + 光柱
        const vortex = createEffectElement("div");
        vortex.className = "spell-draw-vortex";
        vortex.style.cssText = "position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:210;";
        container.appendChild(vortex);
        removeAfter(vortex, 900);
        for (let i = 0; i < 8; i++) {
            const p = createEffectElement("div");
            p.className = "spell-draw-particle";
            p.style.cssText = `left:${cx - 40 + (i - 4) * 25}px; top:${cy - 30}px; animation-delay:${i * 0.06}s;`;
            container.appendChild(p);
            removeAfter(p, 1000);
        }
        const beam = createEffectElement("div");
        beam.className = "spell-draw-beam";
        beam.style.cssText = "position:fixed; left:50%; top:0; transform:translateX(-50%); z-index:205;";
        container.appendChild(beam);
        removeAfter(beam, 700);
    } else if (effectType === "reviveRecentGraveyard" || effectType === "reviveRecentGraveyardV2") {
        // 复活：光点从底部升起
        const isReviveV2 = effectType === "reviveRecentGraveyardV2";
        const reviveCount = isReviveV2 ? 18 : 12;
        for (let i = 0; i < reviveCount; i++) {
            const p = createEffectElement("div");
            p.className = "spell-revive-particle";
            const ox = (Math.random() - 0.5) * 80;
            p.style.cssText = `left:${cx + ox}px; top:${cy + 40}px; animation-delay:${i * 0.06}s;`;
            container.appendChild(p);
            removeAfter(p, 1200);
        }
        if (isReviveV2) {
            const reviveGlow = createEffectElement("div");
            reviveGlow.className = "spell-revive-glow";
            container.appendChild(reviveGlow);
            removeAfter(reviveGlow, 1000);
        }
    } else if (effectType === "healPlayer" || effectType === "healAllAllies" || effectType === "healAndDrawV2" || effectType === "recoverRecentDamage") {
        // 回复：绿色光柱 + 十字治愈阵 + 大量光点上升
        // 治愈光柱（从底部到顶部）
        for (let i = 0; i < 3; i++) {
            const pillar = createEffectElement("div");
            pillar.className = "spell-heal-pillar";
            pillar.style.cssText = `position:fixed; left:calc(50% + ${(i - 1) * 60}px); top:0; z-index:208; animation-delay:${i * 0.12}s;`;
            container.appendChild(pillar);
            removeAfter(pillar, 1000);
        }
        // 十字治愈光环
        const cross = createEffectElement("div");
        cross.className = "spell-heal-cross";
        cross.style.cssText = `position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:209;`;
        container.appendChild(cross);
        removeAfter(cross, 800);
        // 大量绿色光点上升（更多更大）
        for (let i = 0; i < 22; i++) {
            const p = createEffectElement("div");
            p.className = "spell-heal-particle";
            const ox = (Math.random() - 0.5) * 160;
            const oy = Math.random() * 50;
            p.style.cssText = `left:${cx + ox}px; top:${cy + oy}px; animation-delay:${i * 0.04}s; width:${5 + Math.random() * 8}px; height:${5 + Math.random() * 8}px;`;
            container.appendChild(p);
            removeAfter(p, 1400);
        }
        // 治愈专属：柔和镜头上移 + 绿色光晕
        if (battlefield) {
            battlefield.style.transition = "transform 0.3s cubic-bezier(.25,.8,.25,1)";
            battlefield.style.transform = "translateX(-50%) translateY(-8px)";
            setTimeout(() => {
                battlefield.style.transition = "transform 0.5s cubic-bezier(.25,.8,.25,1)";
                battlefield.style.transform = "translateX(-50%)";
            }, 300);
        }
        // 绿色全屏柔光
        const healGlow = createEffectElement("div");
        healGlow.style.cssText = "position:fixed; inset:0; z-index:198; pointer-events:none; background:radial-gradient(circle at 50% 60%, rgba(92,224,178,.15), transparent 60%); animation:hitVignette .6s ease-out forwards;";
        container.appendChild(healGlow);
        removeAfter(healGlow, 650);
    } else if (effectType === "sacrificeDestroy" || effectType === "destroyTarget" || effectType === "destroyAllEnemyMonsters" || effectType === "damageAllEnemyMonsters") {
        // 破坏：红色爆裂 + 裂纹扩散 + 冲击波 + 画面缩放 + 色差
        // 画面缩放冲击（先放大再回弹）
        if (battlefield) {
            battlefield.style.transition = "transform 0.08s ease-in";
            battlefield.style.transform = "translateX(-50%) scale(1.06)";
            setTimeout(() => {
                battlefield.style.transition = "transform 0.3s cubic-bezier(.25,.8,.25,1)";
                battlefield.style.transform = "translateX(-50%) scale(0.98)";
                setTimeout(() => {
                    battlefield.style.transition = "transform 0.4s ease-out";
                    battlefield.style.transform = "translateX(-50%) scale(1)";
                }, 200);
            }, 80);
        }
        // 色差效果（红蓝分离）
        const chroma = createEffectElement("div");
        chroma.style.cssText = "position:fixed; inset:0; z-index:266; pointer-events:none; mix-blend-mode:screen; animation:chromaAberration .3s ease-out forwards;";
        container.appendChild(chroma);
        removeAfter(chroma, 350);
        // 中心爆裂闪光
        const coreFlash = createEffectElement("div");
        coreFlash.className = "spell-destroy-core";
        coreFlash.style.cssText = `position:fixed; left:${cx}px; top:${cy}px; transform:translate(-50%,-50%); z-index:215;`;
        container.appendChild(coreFlash);
        removeAfter(coreFlash, 500);
        // 裂纹扩散（更多）
        for (let i = 0; i < 10; i++) {
            const crack = createEffectElement("div");
            crack.className = "spell-destroy-crack";
            const angle = (i / 10) * 360 + (Math.random() - 0.5) * 15;
            crack.style.cssText = `position:fixed; left:${cx}px; top:${cy}px; transform:translate(-50%,-50%) rotate(${angle}deg); z-index:214;`;
            container.appendChild(crack);
            removeAfter(crack, 600);
        }
        // 红色碎片爆裂（更多更大）
        for (let i = 0; i < 30; i++) {
            const p = createEffectElement("div");
            p.className = "spell-destroy-particle";
            const angle = (i / 30) * Math.PI * 2;
            const dist = 40 + Math.random() * 120;
            const dx = Math.cos(angle) * dist;
            const dy = Math.sin(angle) * dist;
            const rot = (Math.random() - 0.5) * 720;
            const size = 5 + Math.random() * 12;
            p.style.cssText = `left:${cx - 5}px; top:${cy - 7}px; --dx:${dx}px; --dy:${dy}px; --rot:${rot}deg; width:${size}px; height:${size * 1.3}px; animation-delay:${i * 0.02}s;`;
            container.appendChild(p);
            removeAfter(p, 900);
        }
        // 冲击波环
        for (let i = 0; i < 3; i++) {
            const ring = createEffectElement("div");
            ring.className = "spell-destroy-ring";
            ring.style.cssText = `position:fixed; left:${cx}px; top:${cy}px; transform:translate(-50%,-50%); z-index:213; animation-delay:${i * 0.08}s;`;
            container.appendChild(ring);
            removeAfter(ring, 700);
        }
        // 破坏专属：剧烈屏幕震动 + 暗角
        if (battlefield) {
            battlefield.classList.remove("hit-shake-heavy", "shake");
            void battlefield.offsetWidth;
            battlefield.classList.add("hit-shake-heavy");
            setTimeout(() => battlefield.classList.remove("hit-shake-heavy"), 450);
        }
        // 暗角效果
        const darkVig = createEffectElement("div");
        darkVig.className = "hit-vignette";
        darkVig.style.cssText = "position:fixed; inset:0; z-index:267; pointer-events:none; background:radial-gradient(ellipse at center, transparent 40%, rgba(100,0,0,.3) 100%);";
        container.appendChild(darkVig);
        removeAfter(darkVig, 500);
        screenFlash("rgba(255,60,40,.15)");
    } else if (effectType === "returnToHand") {
        // 回手：漩涡吸入 + 卡牌旋转飞走 + 空间扭曲
        // 漩涡中心
        const vortex = createEffectElement("div");
        vortex.className = "spell-return-vortex";
        vortex.style.cssText = `position:fixed; left:${cx}px; top:${cy}px; transform:translate(-50%,-50%); z-index:212;`;
        container.appendChild(vortex);
        removeAfter(vortex, 800);
        // 卡牌从四周向中心旋转吸入
        for (let i = 0; i < 8; i++) {
            const p = createEffectElement("div");
            p.className = "spell-return-particle";
            const angle = (i / 8) * Math.PI * 2;
            const dist = 100 + Math.random() * 60;
            p.style.cssText = `left:${cx - 18}px; top:${cy - 25}px; --dx:${Math.cos(angle) * dist}px; --dy:${Math.sin(angle) * dist - 80}px; animation-delay:${i * 0.06}s;`;
            container.appendChild(p);
            removeAfter(p, 1000);
        }
    } else if (effectType === "doubleAttack") {
        // 双重攻击：两道红色能量环
        for (let i = 0; i < 2; i++) {
            const r = createEffectElement("div");
            r.className = "spell-double-ring";
            r.style.cssText = `position:fixed; left:50%; top:50%; z-index:210; animation-delay:${i * 0.15}s;`;
            container.appendChild(r);
            removeAfter(r, 800);
        }
    } else if (effectType === "swapHands") {
        // 交换手牌：循环箭头
        const orbit = createEffectElement("div");
        orbit.className = "spell-swap-orbit";
        orbit.style.cssText = "position:fixed; left:50%; top:50%; z-index:210;";
        container.appendChild(orbit);
        removeAfter(orbit, 1100);
    } else if (effectType === "fusionSummon") {
        // 融合：两束光从两侧汇聚
        const offsets = [{ sx: -120, sy: -60 }, { sx: 120, sy: -60 }];
        offsets.forEach((off, i) => {
            const b = createEffectElement("div");
            b.className = "spell-fusion-beam";
            b.style.cssText = `position:fixed; left:50%; top:50%; z-index:210; --sx:${off.sx}px; --sy:${off.sy}px; animation-delay:${i * 0.15}s;`;
            container.appendChild(b);
            removeAfter(b, 1000);
        });
    } else if (effectType === "snatchCards") {
        // 夺取：暗影之手
        const hand = createEffectElement("div");
        hand.className = "spell-snatch-hand";
        hand.textContent = "🫳";
        hand.style.cssText = "position:fixed; left:50%; top:40%; z-index:210;";
        container.appendChild(hand);
        removeAfter(hand, 1000);
    } else if (effectType === "recycleAndDraw") {
        // 回收：卡牌旋转回收
        for (let i = 0; i < 6; i++) {
            const p = createEffectElement("div");
            p.className = "spell-recycle-particle";
            const angle = (i / 6) * Math.PI * 2;
            const dist = 60 + Math.random() * 40;
            p.style.cssText = `left:${cx - 15}px; top:${cy - 21}px; --mx:${Math.cos(angle) * dist}px; --my:${Math.sin(angle) * dist}px; animation-delay:${i * 0.08}s;`;
            container.appendChild(p);
            removeAfter(p, 1200);
        }
    } else if (effectType === "buffThenDebuff") {
        // 先增益后减益：金色上升 + 紫色下降
        for (let i = 0; i < 8; i++) {
            const p = createEffectElement("div");
            p.className = "spell-heal-particle";
            const ox = (Math.random() - 0.5) * 100;
            p.style.cssText = `left:${cx + ox}px; top:${cy}px; background:radial-gradient(circle, rgba(255,220,100,.9), rgba(255,180,60,.4)); animation-delay:${i * 0.06}s;`;
            container.appendChild(p);
            removeAfter(p, 1000);
        }
        setTimeout(() => {
            for (let i = 0; i < 8; i++) {
                const p = createEffectElement("div");
                p.className = "spell-heal-particle";
                const ox = (Math.random() - 0.5) * 100;
                p.style.cssText = `left:${cx + ox}px; top:${cy}px; background:radial-gradient(circle, rgba(180,100,255,.9), rgba(120,60,200,.4)); animation:spellHealFloat 1s ease-in forwards; animation-delay:${i * 0.06}s;`;
                container.appendChild(p);
                removeAfter(p, 1200);
            }
        }, 600);
    } else if (effectType === "guessGame") {
        // 猜测游戏：问号粒子
        for (let i = 0; i < 8; i++) {
            const p = createEffectElement("div");
            p.style.cssText = `position:fixed; z-index:210; pointer-events:none; left:${cx + (Math.random() - 0.5) * 160}px; top:${cy + (Math.random() - 0.5) * 100}px; font-size:${20 + Math.random() * 20}px; color:rgba(255,200,100,.8); text-shadow:0 0 10px rgba(255,200,100,.5); animation:spellHealFloat ${0.8 + Math.random() * 0.4}s ease-out forwards; animation-delay:${i * 0.08}s;`;
            p.textContent = "?";
            container.appendChild(p);
            removeAfter(p, 1400);
        }
    } else if (effectType === "guessGameV2") {
        for (let i = 0; i < 8; i++) {
            const p = createEffectElement("div");
            p.style.cssText = `position:fixed; z-index:210; pointer-events:none; left:${cx + (Math.random() - 0.5) * 160}px; top:${cy + (Math.random() - 0.5) * 100}px; font-size:${20 + Math.random() * 20}px; color:rgba(255,200,100,.8); text-shadow:0 0 10px rgba(255,200,100,.5); animation:spellHealFloat ${0.8 + Math.random() * 0.4}s ease-out forwards; animation-delay:${i * 0.08}s;`;
            p.textContent = "?";
            container.appendChild(p);
            removeAfter(p, 1400);
        }
    } else if (effectType === "recoverAndDrawV2" || effectType === "healDrawNoSpecial") {
        // 回复+抽卡：绿光+蓝色抽卡粒子
        for (let i = 0; i < 12; i++) {
            const p = createEffectElement("div");
            p.className = "spell-recover-draw-particle";
            const ox = (Math.random() - 0.5) * 120;
            p.style.cssText = `left:${cx + ox}px; top:${cy + Math.random() * 30}px; animation-delay:${i * 0.05}s;`;
            container.appendChild(p);
            removeAfter(p, 1000);
        }
        for (let i = 0; i < 4; i++) {
            const p = createEffectElement("div");
            p.className = "spell-draw-particle";
            p.style.cssText = `left:${cx - 20 + (i - 2) * 30}px; top:${cy - 30}px; animation-delay:${i * 0.08 + 0.3}s;`;
            container.appendChild(p);
            removeAfter(p, 1000);
        }
    } else if (effectType === "discardAndDraw") {
        // 弃牌+抽卡：红→蓝转换粒子
        for (let i = 0; i < 8; i++) {
            const p = createEffectElement("div");
            p.className = "spell-discard-draw-particle";
            const ox = (Math.random() - 0.5) * 80;
            p.style.cssText = `left:${cx + ox}px; top:${cy + 20}px; animation-delay:${i * 0.06}s;`;
            container.appendChild(p);
            removeAfter(p, 700);
        }
        setTimeout(() => {
            for (let i = 0; i < 4; i++) {
                const p = createEffectElement("div");
                p.className = "spell-draw-particle";
                p.style.cssText = `left:${cx - 16 + (i - 2) * 26}px; top:${cy - 20}px; animation-delay:${i * 0.08}s;`;
                container.appendChild(p);
                removeAfter(p, 900);
            }
        }, 400);
    } else if (effectType === "lockAttack") {
        // ????: ??????
        for (let i = 0; i < 8; i++) {
            const link = createEffectElement("div");
            link.className = "spell-lock-link";
            const angle = (i / 8) * Math.PI * 2;
            const dist = 35;
            link.style.cssText = `left:${cx}px; top:${cy}px; --lx:${Math.cos(angle)*dist}px; --ly:${Math.sin(angle)*dist}px; animation-delay:${i*0.05}s;`;
            container.appendChild(link);
            removeAfter(link, 600);
        }
    } else if (effectType === "gameThroneDraw") {
        // ????: ??+????
        const crown = createEffectElement("div");
        crown.className = "spell-throne-crown";
        crown.textContent = "??";
        container.appendChild(crown);
        removeAfter(crown, 800);
        for (let i = 0; i < 6; i++) {
            const p = createEffectElement("div");
            p.className = "spell-draw-particle";
            p.style.cssText = `left:${cx - 20 + (i - 3) * 30}px; top:${cy - 20}px; animation-delay:${i*0.1+0.2}s;`;
            container.appendChild(p);
            removeAfter(p, 900);
        }
    } else if (effectType === "fieldOceanScene") {
        // ????: ??????
        const transform = createEffectElement("div");
        transform.className = "spell-field-transform";
        container.appendChild(transform);
        removeAfter(transform, 1000);
        for (let i = 0; i < 12; i++) {
            const p = createEffectElement("div");
            p.className = "spell-heal-particle";
            const ox = (Math.random() - 0.5) * 200;
            p.style.cssText = `left:${cx + ox}px; top:${cy + 30 + Math.random()*20}px; background:radial-gradient(circle,rgba(40,180,240,.8),rgba(20,120,200,.3)); animation-delay:${i*0.06}s;`;
            container.appendChild(p);
            removeAfter(p, 1000);
        }
    } else if (effectType === "mutualHandRefresh") {
        // 双向洗牌：交错粒子
        for (let i = 0; i < 12; i++) {
            const p = createEffectElement("div");
            p.className = "spell-mutual-refresh-particle";
            const x = (i % 2 === 0) ? -40 : 40;
            p.style.cssText = `left:${cx + x + (Math.random() - 0.5) * 20}px; top:${cy + (Math.random() - 0.5) * 40}px; --mx:${-x}px; --my:0px; animation-delay:${i * 0.05}s;`;
            container.appendChild(p);
            removeAfter(p, 800);
        }
        screenFlash("rgba(200,180,120,.08)");
    } else if (effectType === "cancelAttackAndReturn") {
        // 攻击取消+回手：爆发光晕
        const cancelBurst = createEffectElement("div");
        cancelBurst.className = "spell-cancel-attack-burst";
        container.appendChild(cancelBurst);
        removeAfter(cancelBurst, 600);
        for (let i = 0; i < 6; i++) {
            const p = createEffectElement("div");
            p.className = "spell-return-particle";
            const angle = Math.random() * Math.PI * 2;
            const dist = 80 + Math.random() * 40;
            p.style.cssText = `left:${cx - 18}px; top:${cy - 25}px; --dx:${Math.cos(angle) * dist}px; --dy:${Math.sin(angle) * dist - 60}px; animation-delay:${i * 0.08}s;`;
            container.appendChild(p);
            removeAfter(p, 900);
        }
    } else if (effectType === "preventDestructionByBanish") {
        // 除外防破：护盾
        const banishShield = createEffectElement("div");
        banishShield.className = "spell-banish-shield";
        container.appendChild(banishShield);
        removeAfter(banishShield, 800);
        for (let i = 0; i < 8; i++) {
            const p = createEffectElement("div");
            p.className = "spell-revive-particle";
            const ox = (Math.random() - 0.5) * 60;
            p.style.cssText = `left:${cx + ox}px; top:${cy - 20}px; animation-delay:${i * 0.06}s; background:rgba(180,160,220,.8);`;
            container.appendChild(p);
            removeAfter(p, 1000);
        }
    } else if (effectType === "trapStackAndRecover") {
        // 堆叠回收：卡牌升起
        for (let i = 0; i < 8; i++) {
            const p = createEffectElement("div");
            p.className = "spell-stack-recover-particle";
            const ox = (Math.random() - 0.5) * 80;
            p.style.cssText = `left:${cx + ox}px; top:${cy + 30}px; animation-delay:${i * 0.06}s;`;
            container.appendChild(p);
            removeAfter(p, 700);
        }
    } else if (effectType === "temporaryBanish") {
        // 暂除外：漩涡传送门
        const portal = createEffectElement("div");
        portal.className = "spell-temp-banish-portal";
        container.appendChild(portal);
        removeAfter(portal, 700);
        for (let i = 0; i < 8; i++) {
            const p = createEffectElement("div");
            p.className = "spell-revive-particle";
            const angle = (i / 8) * Math.PI * 2;
            const dist = 40;
            p.style.cssText = `left:${cx + Math.cos(angle) * dist}px; top:${cy * 0.9 + Math.sin(angle) * dist}px; animation-delay:${i * 0.05}s; background:rgba(160,140,200,.7);`;
            container.appendChild(p);
            removeAfter(p, 700);
        }
    } else if (effectType === "negateCounterEffect") {
        // 反击无效化：白色爆裂
        const negateBlast = createEffectElement("div");
        negateBlast.className = "spell-negate-counter-blast";
        container.appendChild(negateBlast);
        removeAfter(negateBlast, 500);
        for (let i = 0; i < 12; i++) {
            const p = createEffectElement("div");
            p.className = "spell-negate-shatter-particle";
            const angle = (i / 12) * Math.PI * 2;
            const dist = 30 + Math.random() * 40;
            p.style.cssText = `left:${cx}px; top:${cy}px; --nx:${Math.cos(angle) * dist}px; --ny:${Math.sin(angle) * dist}px; animation-delay:${i * 0.03}s;`;
            container.appendChild(p);
            removeAfter(p, 600);
        }
        screenFlash("rgba(255,255,255,.15)");
    } else if (effectType === "buffAllAlliesAttack") {
        // 全体增攻：金色能量爆发 + 上升粒子 + 画面放大
        // 画面放大冲击
        if (battlefield) {
            battlefield.style.transition = "transform 0.15s ease-out";
            battlefield.style.transform = "translateX(-50%) scale(1.03) translateY(-5px)";
            setTimeout(() => {
                battlefield.style.transition = "transform 0.5s cubic-bezier(.25,.8,.25,1)";
                battlefield.style.transform = "translateX(-50%)";
            }, 150);
        }
        const aura = createEffectElement("div");
        aura.className = "spell-buff-aura";
        aura.style.cssText = `position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:210;`;
        container.appendChild(aura);
        removeAfter(aura, 900);
        // 金色能量射线
        for (let i = 0; i < 12; i++) {
            const ray = createEffectElement("div");
            ray.className = "hit-ray";
            const angle = (i / 12) * 360;
            ray.style.cssText = `position:fixed; left:50%; top:50%; transform:rotate(${angle}deg); z-index:209; --ray-len:${80 + Math.random() * 40}px; --hit-spark-color:#ffdd88;`;
            container.appendChild(ray);
            removeAfter(ray, 500);
        }
        for (let i = 0; i < 18; i++) {
            const p = createEffectElement("div");
            p.className = "spell-buff-particle";
            const ox = (Math.random() - 0.5) * 200;
            p.style.cssText = `left:${cx + ox}px; top:${cy + 40}px; animation-delay:${i * 0.04}s;`;
            container.appendChild(p);
            removeAfter(p, 1000);
        }
        const goldGlow = createEffectElement("div");
        goldGlow.style.cssText = "position:fixed; inset:0; z-index:198; pointer-events:none; background:radial-gradient(circle at 50% 50%, rgba(255,211,107,.15), transparent 55%); animation:hitVignette .7s ease-out forwards;";
        container.appendChild(goldGlow);
        removeAfter(goldGlow, 750);
        screenFlash("rgba(255,211,107,.12)");
    } else if (effectType === "debuffAllEnemyAttack") {
        // 全体减攻：暗紫色冲击波扩散 + 画面缩小
        // 画面缩小压制
        if (battlefield) {
            battlefield.style.transition = "transform 0.15s ease-out";
            battlefield.style.transform = "translateX(-50%) scale(0.97) translateY(5px)";
            setTimeout(() => {
                battlefield.style.transition = "transform 0.5s cubic-bezier(.25,.8,.25,1)";
                battlefield.style.transform = "translateX(-50%)";
            }, 150);
        }
        const wave = createEffectElement("div");
        wave.className = "spell-debuff-wave";
        wave.style.cssText = `position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:210;`;
        container.appendChild(wave);
        removeAfter(wave, 900);
        // 暗紫色能量射线（向下压制）
        for (let i = 0; i < 8; i++) {
            const ray = createEffectElement("div");
            ray.className = "hit-ray";
            const angle = (i / 8) * 360 + 22.5;
            ray.style.cssText = `position:fixed; left:50%; top:50%; transform:rotate(${angle}deg); z-index:209; --ray-len:${70 + Math.random() * 30}px; --hit-spark-color:#cc88ff;`;
            container.appendChild(ray);
            removeAfter(ray, 500);
        }
        for (let i = 0; i < 16; i++) {
            const p = createEffectElement("div");
            p.className = "spell-debuff-particle";
            const angle = (i / 16) * Math.PI * 2;
            const dist = 60 + Math.random() * 80;
            p.style.cssText = `left:${cx + Math.cos(angle) * dist}px; top:${cy + Math.sin(angle) * dist}px; animation-delay:${i * 0.03}s;`;
            container.appendChild(p);
            removeAfter(p, 800);
        }
        // 减攻专属：镜头下沉 + 暗紫色全屏压暗
        if (battlefield) {
            battlefield.style.transition = "transform 0.2s ease-out";
            battlefield.style.transform = "translateX(-50%) translateY(5px)";
            setTimeout(() => {
                battlefield.style.transition = "transform 0.4s cubic-bezier(.25,.8,.25,1)";
                battlefield.style.transform = "translateX(-50%)";
            }, 200);
        }
        const darkGlow = createEffectElement("div");
        darkGlow.style.cssText = "position:fixed; inset:0; z-index:198; pointer-events:none; background:radial-gradient(circle at 50% 50%, rgba(100,40,160,.1), transparent 55%); animation:hitVignette .7s ease-out forwards;";
        container.appendChild(darkGlow);
        removeAfter(darkGlow, 750);
        screenFlash("rgba(140,60,200,.1)");
    } else if (effectType === "directDamage") {
        // 直接伤害：红色能量弹 + 画面缩放冲击
        // 画面先放大再回弹
        if (battlefield) {
            battlefield.style.transition = "transform 0.06s ease-in";
            battlefield.style.transform = "translateX(-50%) scale(1.04)";
            setTimeout(() => {
                battlefield.style.transition = "transform 0.25s cubic-bezier(.25,.8,.25,1)";
                battlefield.style.transform = "translateX(-50%)";
            }, 60);
        }
        for (let i = 0; i < 4; i++) {
            const bolt = createEffectElement("div");
            bolt.className = "spell-damage-bolt";
            bolt.style.cssText = `position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:212; animation-delay:${i * 0.1}s;`;
            container.appendChild(bolt);
            removeAfter(bolt, 600);
        }
        // 红色冲击环（3层）
        for (let i = 0; i < 3; i++) {
            const ring = createEffectElement("div");
            ring.className = "spell-destroy-ring";
            ring.style.cssText = `position:fixed; left:${cx}px; top:${cy}px; transform:translate(-50%,-50%); z-index:211; animation-delay:${i * 0.08}s;`;
            container.appendChild(ring);
            removeAfter(ring, 600);
        }
        // 红色碎片飞散
        for (let i = 0; i < 12; i++) {
            const p = createEffectElement("div");
            p.className = "spell-destroy-particle";
            const angle = (i / 12) * Math.PI * 2;
            const dist = 40 + Math.random() * 60;
            p.style.cssText = `left:${cx}px; top:${cy}px; --dx:${Math.cos(angle)*dist}px; --dy:${Math.sin(angle)*dist}px; --rot:${(Math.random()-0.5)*360}deg; width:${4+Math.random()*6}px; height:${5+Math.random()*8}px; animation-delay:${i*0.03}s;`;
            container.appendChild(p);
            removeAfter(p, 600);
        }
        if (battlefield) {
            battlefield.classList.remove("shake");
            void battlefield.offsetWidth;
            battlefield.classList.add("shake");
            setTimeout(() => battlefield.classList.remove("shake"), 300);
        }
        screenFlash("rgba(255,60,40,.12)");
    } else if (effectType === "damageBothPlayers") {
        // 双方伤害：红色双向冲击 + 画面震动
        if (battlefield) {
            battlefield.style.transition = "transform 0.06s ease-in";
            battlefield.style.transform = "translateX(-50%) scale(1.03)";
            setTimeout(() => {
                battlefield.style.transition = "transform 0.2s ease-out";
                battlefield.style.transform = "translateX(-50%)";
            }, 60);
        }
        for (let i = 0; i < 2; i++) {
            const yDir = i === 0 ? -1 : 1;
            for (let j = 0; j < 10; j++) {
                const p = createEffectElement("div");
                p.className = "spell-destroy-particle";
                const angle = (j / 10) * Math.PI;
                const dist = 40 + Math.random() * 70;
                const dx = Math.cos(angle) * dist * 0.5;
                const dy = Math.sin(angle) * dist * yDir;
                p.style.cssText = `left:${cx}px; top:${cy}px; --dx:${dx}px; --dy:${dy}px; --rot:${(Math.random()-0.5)*360}deg; animation-delay:${(i * 10 + j) * 0.025}s;`;
                container.appendChild(p);
                removeAfter(p, 700);
            }
        }
        screenFlash("rgba(255,80,60,.1)");
    } else if (effectType === "mutualHandRefresh") {
        // 交换手牌：双向粒子流
        for (let i = 0; i < 16; i++) {
            const p = createEffectElement("div");
            p.className = "spell-mutual-refresh-particle";
            const x = (i % 2 === 0) ? -50 : 50;
            p.style.cssText = `left:${cx + x + (Math.random() - 0.5) * 20}px; top:${cy + (Math.random() - 0.5) * 60}px; --mx:${-x}px; --my:0px; animation-delay:${i * 0.04}s;`;
            container.appendChild(p);
            removeAfter(p, 800);
        }
        screenFlash("rgba(200,180,120,.08)");
    }
}

/**
 * 陷阱卡连锁发动特效（在屏幕中央播放，根据效果类型增强）
 */
export function playTrapEffectV2(fieldSlot, subtype = "counter", cardName = "", effectType = "none", card = null, ownerIndex = 0, { activationPlayed = false } = {}) {
    if (activationPlayed && authoredScene(card || cardName, "trap")) {
        playRuleDrivenEffect(card || { name: cardName, type: effectType }, fieldSlot, ownerIndex);
        return Promise.resolve();
    }
    if (!isBrowser) return;
    if (authoredScene(card || cardName, "trap")) {
        showAnnounceBanner("trap", subtype, cardName);
        playRuleDrivenEffect(card || { name:cardName,type:effectType },fieldSlot,ownerIndex);
        return playCardPerformance(card || cardName, "trap", fieldSlot || document.getElementById(ownerIndex === 0 ? "player-area" : "opponent-area"));
    }
    playCardPerformance(card || cardName, "trap", fieldSlot || document.getElementById(ownerIndex === 0 ? "player-area" : "opponent-area"));
    playRuleDrivenEffect(card || { name: cardName, type: effectType }, fieldSlot, ownerIndex);

    showAnnounceBanner("trap", subtype, cardName);

    const container = document.querySelector(".battle-screen") || document.body;
    const battlefield = document.querySelector(".battlefield");
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    // 紫色魔法阵（更大更亮）
    const circle = createEffectElement("div");
    circle.className = "trap-magic-circle";
    circle.style.cssText = "position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:200;";
    container.appendChild(circle);
    removeAfter(circle, 1300);

    // 锁链（更多更密）
    for (let i = 0; i < 8; i++) {
        const chain = createEffectElement("div");
        chain.className = "trap-chain";
        chain.style.cssText = `position:fixed; left:50%; top:50%; z-index:200; transform:rotate(${i * 45}deg); animation-delay:${i * 0.03}s;`;
        container.appendChild(chain);
        removeAfter(chain, 900);
    }

    // 锁定符号
    const lock = createEffectElement("div");
    lock.className = "trap-lock-symbol";
    lock.style.cssText = "position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:201;";
    container.appendChild(lock);
    removeAfter(lock, 700);

    // 警告标志
    const warn = createEffectElement("div");
    warn.className = "trap-warning-sign";
    warn.style.cssText = "position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:202;";
    container.appendChild(warn);
    removeAfter(warn, 1050);

    // 紫色爆发（更大更强）
    const burst = createEffectElement("div");
    burst.className = "trap-purple-burst";
    burst.style.cssText = "position:fixed; left:0; top:0; right:0; bottom:0; z-index:199;";
    container.appendChild(burst);
    removeAfter(burst, 1050);

    // 陷阱发动通用镜头震动（比魔法更强）
    if (battlefield) {
        battlefield.style.transition = "none";
        battlefield.style.transform = "translateX(-50%) translateY(-4px) scale(1.01)";
        setTimeout(() => {
            battlefield.style.transition = "transform 0.1s ease-out";
            battlefield.style.transform = "translateX(-50%) translateY(3px)";
            setTimeout(() => {
                battlefield.style.transition = "transform 0.25s ease-out";
                battlefield.style.transform = "translateX(-50%)";
            }, 100);
        }, 30);
    }

    // 根据陷阱效果类型追加专属特效
    if (effectType === "cannotAttack" || effectType === "cancelAttackAndReturn") {
        // 无效攻击：锁链屏障 + 红色X + 镜头急停
        const barrier = createEffectElement("div");
        barrier.className = "trap-attack-barrier";
        barrier.style.cssText = `position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:210;`;
        container.appendChild(barrier);
        removeAfter(barrier, 800);
        const xMark = createEffectElement("div");
        xMark.className = "trap-x-mark";
        xMark.style.cssText = `position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:211;`;
        container.appendChild(xMark);
        removeAfter(xMark, 700);
        // 无效攻击专属：镜头猛拉后回弹
        if (battlefield) {
            battlefield.style.transition = "transform 0.15s ease-in";
            battlefield.style.transform = "translateX(-50%) translateY(15px) scale(1.03)";
            setTimeout(() => {
                battlefield.style.transition = "transform 0.4s cubic-bezier(.25,.8,.25,1)";
                battlefield.style.transform = "translateX(-50%)";
            }, 150);
        }
        screenFlash("rgba(255,60,60,.12)");
    } else if (effectType === "reduceDamage") {
        // 减伤：蓝色护盾展开
        const shield = createEffectElement("div");
        shield.className = "trap-shield";
        shield.style.cssText = `position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:210;`;
        container.appendChild(shield);
        removeAfter(shield, 800);
        for (let i = 0; i < 6; i++) {
            const p = createEffectElement("div");
            p.className = "trap-shield-particle";
            const angle = (i / 6) * Math.PI * 2;
            p.style.cssText = `left:${cx + Math.cos(angle) * 50}px; top:${cy + Math.sin(angle) * 50}px; animation-delay:${i * 0.06}s;`;
            container.appendChild(p);
            removeAfter(p, 700);
        }
        screenFlash("rgba(80,180,255,.1)");
    } else if (effectType === "returnToHand") {
        // 回手：漩涡吸入
        const vortex = createEffectElement("div");
        vortex.className = "trap-return-vortex";
        vortex.style.cssText = `position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:210;`;
        container.appendChild(vortex);
        removeAfter(vortex, 800);
        for (let i = 0; i < 8; i++) {
            const p = createEffectElement("div");
            p.className = "spell-return-particle";
            const angle = (i / 8) * Math.PI * 2;
            const dist = 80;
            p.style.cssText = `left:${cx - 18}px; top:${cy - 25}px; --dx:${Math.cos(angle) * dist}px; --dy:${Math.sin(angle) * dist}px; animation-delay:${i * 0.05}s;`;
            container.appendChild(p);
            removeAfter(p, 800);
        }
        screenFlash("rgba(180,100,255,.1)");
    } else if (effectType === "reflectDamage") {
        // 反射伤害：镜面反弹 + 红色冲击
        const mirror = createEffectElement("div");
        mirror.className = "trap-reflect-mirror";
        mirror.style.cssText = `position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:210;`;
        container.appendChild(mirror);
        removeAfter(mirror, 700);
        // 红色反弹粒子
        for (let i = 0; i < 10; i++) {
            const p = createEffectElement("div");
            p.className = "trap-reflect-particle";
            const angle = Math.random() * Math.PI * 2;
            const dist = 40 + Math.random() * 60;
            p.style.cssText = `left:${cx}px; top:${cy}px; --rx:${Math.cos(angle) * dist}px; --ry:${Math.sin(angle) * dist}px; animation-delay:${i * 0.04}s;`;
            container.appendChild(p);
            removeAfter(p, 600);
        }
        // 反射专属：镜头快速拉近再弹回
        if (battlefield) {
            battlefield.style.transition = "transform 0.1s ease-in";
            battlefield.style.transform = "translateX(-50%) scale(1.04)";
            setTimeout(() => {
                battlefield.style.transition = "transform 0.3s cubic-bezier(.25,.8,.25,1)";
                battlefield.style.transform = "translateX(-50%)";
            }, 100);
        }
        screenFlash("rgba(255,100,80,.12)");
    } else if (effectType === "destroyAttacker") {
        // 破坏攻击怪兽：碎裂爆破
        const shatter = createEffectElement("div");
        shatter.className = "trap-destroy-burst";
        shatter.style.cssText = `position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:210;`;
        container.appendChild(shatter);
        removeAfter(shatter, 600);
        for (let i = 0; i < 14; i++) {
            const p = createEffectElement("div");
            p.className = "trap-shatter-particle";
            const angle = (i / 14) * Math.PI * 2;
            const dist = 30 + Math.random() * 50;
            const size = 4 + Math.random() * 8;
            p.style.cssText = `left:${cx}px; top:${cy}px; --sx:${Math.cos(angle) * dist}px; --sy:${Math.sin(angle) * dist}px; width:${size}px; height:${size}px; animation-delay:${i * 0.03}s;`;
            container.appendChild(p);
            removeAfter(p, 600);
        }
        // 破坏专属：剧烈震动 + 暗角
        if (battlefield) {
            battlefield.classList.remove("hit-shake-heavy");
            void battlefield.offsetWidth;
            battlefield.classList.add("hit-shake-heavy");
            setTimeout(() => battlefield.classList.remove("hit-shake-heavy"), 400);
        }
        const darkVig = createEffectElement("div");
        darkVig.className = "hit-vignette";
        darkVig.style.cssText = "position:fixed; inset:0; z-index:267; pointer-events:none; background:radial-gradient(ellipse at center, transparent 40%, rgba(100,0,0,.35) 100%);";
        container.appendChild(darkVig);
        removeAfter(darkVig, 500);
        screenFlash("rgba(255,80,60,.12)");
    }
}

/**
 * 破坏怪兽特效（增强版：卡牌镜像破碎）
 */
export function playDestroyEffectV2(fieldSlot) {
    if (!isBrowser || !fieldSlot) return;
    const card = fieldSlot.querySelector(".card");
    if (!card) return;

    // 卡牌镜像破碎容器
    const shatter = createEffectElement("div");
    shatter.className = "mirror-shatter";

    // 裂纹线（3条交叉）
    const crack = createEffectElement("div");
    crack.className = "mirror-crack";
    crack.style.cssText = `--a1:${30 + Math.random() * 30}deg; --a2:${120 + Math.random() * 40}deg; --a3:${200 + Math.random() * 30}deg;`;
    shatter.appendChild(crack);

    // 中心闪光
    const flash = createEffectElement("div");
    flash.className = "mirror-flash";
    shatter.appendChild(flash);

    // 碎片（12-16块不规则镜面碎片）
    const shardCount = 12 + Math.floor(Math.random() * 5);
    for (let i = 0; i < shardCount; i++) {
        const shard = createEffectElement("div");
        shard.className = "mirror-shard";
        const angle = (i / shardCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const dist = 40 + Math.random() * 60;
        const sx = Math.cos(angle) * dist;
        const sy = Math.sin(angle) * dist;
        const sr = (Math.random() - 0.5) * 540;
        const w = 10 + Math.random() * 20;
        const h = 12 + Math.random() * 22;
        const x = 30 + Math.random() * 40;
        const y = 20 + Math.random() * 50;
        shard.style.cssText = `
            left:${x}%; top:${y}%; width:${w}px; height:${h}px;
            --sx:${sx}px; --sy:${sy}px; --sr:${sr}deg;
            clip-path:polygon(${Math.random()*30}% 0%, 100% ${Math.random()*30}%, ${70+Math.random()*30}% 100%, 0% ${70+Math.random()*30}%);
            animation-delay:${Math.random() * 0.08}s;
        `;
        shatter.appendChild(shard);
    }

    card.appendChild(shatter);

    // 卡牌缩小消失
    card.style.transition = "transform 0.5s cubic-bezier(.4,0,.2,1), opacity 0.5s ease, filter 0.5s ease";
    card.style.transform = "scale(0.3)";
    card.style.opacity = "0";
    card.style.filter = "brightness(2) blur(2px)";

    setTimeout(() => {
        shatter.remove();
        card.style.transition = "";
        card.style.transform = "";
        card.style.opacity = "";
        card.style.filter = "";
    }, 700);

    screenFlash("rgba(255,255,255,.15)");
}

/**
 * 治愈特效（增强版：绿色光环 + 粒子）
 */
export function playHealEffectV2(fieldSlot) {
    if (!isBrowser || !fieldSlot) return;

    const glow = createEffectElement("div");
    glow.className = "heal-glow";
    fieldSlot.appendChild(glow);
    removeAfter(glow, 750);

    // 绿色上升粒子
    for (let i = 0; i < 8; i++) {
        const p = createEffectElement("div");
        p.className = "buff-particle";
        const dx = (Math.random() - 0.5) * 40;
        p.style.cssText = `left:calc(50% + ${dx}px); top:calc(50%); animation-delay:${i * 0.05}s;`;
        fieldSlot.appendChild(p);
        removeAfter(p, 600);
    }

    screenFlash("rgba(92,224,178,.08)");
}

// =====================================================================
//  SSR / UR 魔法卡特效动画
// =====================================================================

/**
 * 回收手牌特效：手牌化为光点飞向墓地，再从牌库飞出新卡
 */
export function playRecycleEffect(handCards, isOpponent = false) {
    if (!isBrowser) return Promise.resolve();

    const container = document.querySelector(".battle-screen") || document.body;
    const color = isOpponent ? "rgba(80,180,255,.12)" : "rgba(92,224,178,.12)";

    // 屏幕闪光
    screenFlash(color);

    // 生成回收粒子（从手牌区域向上飘散）
    const handTray = isOpponent ? document.querySelector(".opponent-hand") : document.getElementById("hand-tray");
    if (handTray) {
        const rect = handTray.getBoundingClientRect();
        for (let i = 0; i < 12; i++) {
            const p = createEffectElement("div");
            p.className = "recycle-particle";
            const x = rect.left + Math.random() * rect.width;
            const y = rect.top + Math.random() * rect.height * 0.5;
            p.style.cssText = `left:${x}px; top:${y}px; --tx:${(Math.random() - 0.5) * 80}px; --ty:${-60 - Math.random() * 60}px;`;
            container.appendChild(p);
            removeAfter(p, 800);
        }
    }

    // 从牌库飞出新卡的光效
    const deckPile = document.getElementById(isOpponent ? "opponent-deck-pile" : "player-deck-pile");
    if (deckPile) {
        const rect = deckPile.getBoundingClientRect();
        for (let i = 0; i < 6; i++) {
            const p = createEffectElement("div");
            p.className = "draw-particle";
            p.style.cssText = `left:${rect.left + rect.width / 2}px; top:${rect.top + rect.height / 2}px; animation-delay:${i * 0.08}s;`;
            container.appendChild(p);
            removeAfter(p, 700);
        }
        deckPile.querySelector(".deck-card-back")?.classList.add("deck-pulse");
        setTimeout(() => deckPile.querySelector(".deck-card-back")?.classList.remove("deck-pulse"), 500);
    }

    return new Promise(resolve => setTimeout(resolve, 600));
}

/**
 * 抽取对方手牌特效：从对方手牌区飞出光束到己方
 */
export function playSnatchEffect(isSuccess) {
    if (!isBrowser) return Promise.resolve();

    const container = document.querySelector(".battle-screen") || document.body;

    if (isSuccess) {
        // 成功：金色光束 + 星形爆发
        screenFlash("rgba(255,211,107,.15)");
        for (let i = 0; i < 8; i++) {
            const p = createEffectElement("div");
            p.className = "snatch-particle success";
            const angle = (i / 8) * Math.PI * 2;
            const dist = 40 + Math.random() * 50;
            p.style.cssText = `left:calc(50% + ${Math.cos(angle) * dist}px); top:calc(45% + ${Math.sin(angle) * dist}px);`;
            container.appendChild(p);
            removeAfter(p, 700);
        }
    } else {
        // 失败：红色闪光 + 碎片
        screenFlash("rgba(255,111,141,.12)");
        for (let i = 0; i < 6; i++) {
            const p = createEffectElement("div");
            p.className = "snatch-particle fail";
            const dx = (Math.random() - 0.5) * 100;
            const dy = (Math.random() - 0.5) * 60;
            p.style.cssText = `left:calc(50% + ${dx}px); top:calc(45% + ${dy}px);`;
            container.appendChild(p);
            removeAfter(p, 500);
        }
    }

    return new Promise(resolve => setTimeout(resolve, 500));
}

/**
 * 增益+削弱特效：先绿色上升粒子，后红色下降粒子
 */
export function playBuffDebuffEffect(fieldSlot, buffValue, penaltyValue) {
    if (!isBrowser || !fieldSlot) return Promise.resolve();

    // 增益阶段（绿色上升）
    for (let i = 0; i < 6; i++) {
        const p = createEffectElement("div");
        p.className = "buff-particle";
        const dx = (Math.random() - 0.5) * 40;
        p.style.cssText = `left:calc(50% + ${dx}px); top:calc(50%); animation-delay:${i * 0.05}s;`;
        fieldSlot.appendChild(p);
        removeAfter(p, 600);
    }
    spawnParticles(fieldSlot, "heal-sparkle", 4, 20);
    screenFlash("rgba(92,224,178,.1)");

    // 延迟后削弱阶段（红色下降）
    return new Promise(resolve => {
        setTimeout(() => {
            for (let i = 0; i < 6; i++) {
                const p = createEffectElement("div");
                p.className = "debuff-particle";
                const dx = (Math.random() - 0.5) * 40;
                p.style.cssText = `left:calc(50% + ${dx}px); top:calc(50%); animation-delay:${i * 0.05}s;`;
                fieldSlot.appendChild(p);
                removeAfter(p, 600);
            }
            screenFlash("rgba(255,111,141,.08)");
            resolve();
        }, 800);
    });
}

/**
 * 回复大量生命特效：绿色光环扩展 + 数字飘出
 */
export function playBigHealEffect(playerHud, value) {
    if (!isBrowser) return;

    // 全屏绿色光效
    const container = document.querySelector(".battle-screen") || document.body;
    const glow = createEffectElement("div");
    glow.className = "big-heal-glow";
    glow.style.cssText = "position:fixed; left:0; top:0; right:0; bottom:0; z-index:150; pointer-events:none;";
    container.appendChild(glow);
    removeAfter(glow, 800);

    // 粒子上升
    for (let i = 0; i < 10; i++) {
        const p = createEffectElement("div");
        p.className = "heal-particle-big";
        const x = 20 + Math.random() * 60;
        p.style.cssText = `left:${x}%; bottom:10%; animation-delay:${i * 0.06}s;`;
        container.appendChild(p);
        removeAfter(p, 900);
    }

    screenFlash("rgba(92,224,178,.12)");

    // HUD发光
    if (playerHud) {
        playerHud.style.animation = "healGlow .7s ease-out";
        setTimeout(() => { playerHud.style.animation = ""; }, 750);
    }
}

/**
 * 弃牌魔法特效（畸变DNA风格）：DNA螺旋 + 红绿交替闪烁
 */
export function playMutationEffect(fieldSlot) {
    if (!isBrowser) return Promise.resolve();

    const container = document.querySelector(".battle-screen") || document.body;

    // DNA螺旋光效
    const helix = createEffectElement("div");
    helix.className = "mutation-helix";
    helix.style.cssText = "position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:200;";
    container.appendChild(helix);
    removeAfter(helix, 1200);

    // 绿色→红色闪烁
    screenFlash("rgba(92,224,178,.12)");
    setTimeout(() => screenFlash("rgba(255,111,141,.1)"), 600);

    // 粒子
    if (fieldSlot) {
        spawnParticles(fieldSlot, "mutation-particle", 8, 30);
    }

    return new Promise(resolve => setTimeout(resolve, 1000));
}

// ---- 工具函数 ----

/**
 * UR/SSR专属：时间减速效果 — 画面短暂冻结+慢动作感
 * 用于高稀有度卡牌发动时的震撼感
 */
export function playTimeSlowEffect(duration = 600) {
    if (!isBrowser) return;
    const container = document.querySelector(".battle-screen") || document.body;
    const bf = document.querySelector(".battlefield");

    // 画面冻结闪光
    const freeze = createEffectElement("div");
    freeze.style.cssText = `position:fixed; inset:0; z-index:268; pointer-events:none; background:rgba(255,255,255,.12); animation:timeSlowFreeze ${duration}ms ease-out forwards;`;
    container.appendChild(freeze);
    removeAfter(freeze, duration + 50);

    // 暗角加深
    const vig = createEffectElement("div");
    vig.style.cssText = `position:fixed; inset:0; z-index:267; pointer-events:none; background:radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,.5) 100%); animation:hitVignette ${duration}ms ease-out forwards;`;
    container.appendChild(vig);
    removeAfter(vig, duration + 50);

    // 镜头缓慢拉近
    if (bf) {
        bf.style.transition = `transform ${duration * 0.4}ms cubic-bezier(.25,.8,.25,1)`;
        bf.style.transform = "translateX(-50%) scale(1.06)";
        setTimeout(() => {
            bf.style.transition = `transform ${duration * 0.6}ms cubic-bezier(.25,.8,.25,1)`;
            bf.style.transform = "translateX(-50%)";
        }, duration * 0.4);
    }
}

/**
 * UR/SSR专属：色差爆发 — 红蓝分离+画面震颤
 */
export function playChromaticBurst() {
    if (!isBrowser) return;
    const container = document.querySelector(".battle-screen") || document.body;

    const chroma = createEffectElement("div");
    chroma.style.cssText = "position:fixed; inset:0; z-index:269; pointer-events:none; mix-blend-mode:screen; animation:chromaAberration .4s ease-out forwards;";
    container.appendChild(chroma);
    removeAfter(chroma, 450);

    // 白色闪光核心
    const core = createEffectElement("div");
    core.style.cssText = "position:fixed; left:50%; top:45%; width:100px; height:100px; margin:-50px; z-index:270; pointer-events:none; border-radius:50%; background:radial-gradient(circle, rgba(255,255,255,.8), rgba(200,180,255,.3) 40%, transparent 70%); animation:hitCoreFlash .35s cubic-bezier(.15,.9,.3,1) forwards;";
    container.appendChild(core);
    removeAfter(core, 400);
}

/**
 * UR/SSR专属：全屏粒子雨 — 大量光点从天而降
 */
export function playParticleRain(color = "rgba(255,211,107,.6)", count = 30) {
    if (!isBrowser) return;
    const container = document.querySelector(".battle-screen") || document.body;

    for (let i = 0; i < count; i++) {
        const p = createEffectElement("div");
        const x = Math.random() * window.innerWidth;
        const delay = Math.random() * 0.8;
        const dur = 0.6 + Math.random() * 0.6;
        const size = 2 + Math.random() * 4;
        p.style.cssText = `position:fixed; left:${x}px; top:-10px; z-index:205; pointer-events:none; width:${size}px; height:${size * 1.5}px; border-radius:50%; background:${color}; box-shadow:0 0 ${size * 2}px ${color}; animation:particleRainFall ${dur}s ease-in forwards; animation-delay:${delay}s;`;
        container.appendChild(p);
        removeAfter(p, (delay + dur) * 1000 + 100);
    }
}

/**
 * UR/SSR专属：镜头大回旋 — 360度旋转+缩放
 */
export function playCameraSwoop() {
    if (!isBrowser) return;
    const bf = document.querySelector(".battlefield");
    if (!bf) return;

    bf.style.transition = "transform 0.8s cubic-bezier(.25,.8,.25,1)";
    bf.style.transform = "translateX(-50%) scale(1.08) rotate(2deg)";
    setTimeout(() => {
        bf.style.transition = "transform 0.6s cubic-bezier(.25,.8,.25,1)";
        bf.style.transform = "translateX(-50%) scale(0.96) rotate(-1deg)";
        setTimeout(() => {
            bf.style.transition = "transform 0.5s cubic-bezier(.25,.8,.25,1)";
            bf.style.transform = "translateX(-50%)";
        }, 600);
    }, 800);
}

/**
 * UR/SSR专属：全屏能量脉冲 — 从中心扩散的多层能量波
 */
export function playEnergyPulse(color1 = "rgba(255,211,107,.5)", color2 = "rgba(199,125,255,.4)") {
    if (!isBrowser) return;
    const container = document.querySelector(".battle-screen") || document.body;

    for (let i = 0; i < 4; i++) {
        const ring = createEffectElement("div");
        ring.style.cssText = `position:fixed; left:50%; top:45%; z-index:200; pointer-events:none; width:40px; height:40px; margin:-20px; border:2px solid ${i % 2 === 0 ? color1 : color2}; border-radius:50%; box-shadow:0 0 15px ${i % 2 === 0 ? color1 : color2}; animation:energyPulseExpand 1s cubic-bezier(.25,.8,.25,1) forwards; animation-delay:${i * 0.12}s;`;
        container.appendChild(ring);
        removeAfter(ring, 1200);
    }
}

/**
 * 组合技：UR魔法卡发动全套运镜
 * 时间减速 → 色差爆发 → 镜头回旋 → 能量脉冲 → 粒子雨
 */
export function playURSpellCinematic(attribute = "none") {
    if (!isBrowser) return;

    const attrColors = {
        fire: "rgba(255,120,60,.6)", water: "rgba(80,180,255,.6)",
        wind: "rgba(120,255,160,.5)", earth: "rgba(200,170,80,.5)",
        light: "rgba(255,240,120,.6)", dark: "rgba(180,100,255,.6)",
    };
    const color = attrColors[attribute] || "rgba(255,211,107,.6)";

    playTimeSlowEffect(500);
    setTimeout(() => {
        playChromaticBurst();
        playParticleRain(color, 25);
    }, 200);
    setTimeout(() => playCameraSwoop(), 300);
    setTimeout(() => playEnergyPulse(color, "rgba(255,255,255,.4)"), 400);
}

/**
 * 组合技：SSR怪兽召唤全套运镜
 */
export function playSSRMonsterCinematic(attribute = "none") {
    if (!isBrowser) return;

    playTimeSlowEffect(400);
    setTimeout(() => {
        playChromaticBurst();
        playParticleRain("rgba(255,200,100,.5)", 20);
    }, 150);
    setTimeout(() => playCameraSwoop(), 250);
}

/**
 * 魔法卡发动前运镜 — 卡片飞到墓地后、效果触发前的电影级运镜
 * @param attribute - 卡牌属性，用于颜色
 * @param cardName - 卡牌名称
 * @param rarity - 卡牌稀有度 N/R/SR/SSR/UR
 * @returns Promise - 运镜完成后resolve，耗时约1000ms
 */
export function playSpellCinematic(attribute = "none", cardName = "", rarity = "N") {
    if (!isBrowser) return Promise.resolve();
    if (authoredScene(cardName, "spell")) return Promise.resolve();

    const container = document.querySelector(".battle-screen") || document.body;
    const battleScreen = document.querySelector(".battle-screen");
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight * 0.45;

    const attrGlow = {
        fire: "rgba(255,120,60,.15)", water: "rgba(80,180,255,.15)",
        wind: "rgba(120,255,160,.12)", earth: "rgba(200,170,80,.12)",
        light: "rgba(255,240,120,.15)", dark: "rgba(180,100,255,.15)",
    };
    const glowColor = attrGlow[attribute] || "rgba(85,216,229,.12)";

    // === 阶段1：镜头快速推进 + 暗角加深 (0-300ms) ===
    setBattleCamera(battleScreen, { scale: 1.12, duration: 300 });
    const vig = createEffectElement("div");
    vig.style.cssText = `position:fixed; inset:0; z-index:196; pointer-events:none; background:radial-gradient(ellipse at 50% 45%, transparent 30%, rgba(0,0,0,.55) 100%); animation:hitVignette .4s ease-out forwards;`;
    container.appendChild(vig);
    removeAfter(vig, 500);

    // === 阶段2：属性色能量从中心汇聚 (300-600ms) ===
    setTimeout(() => {
        const core = createEffectElement("div");
        core.style.cssText = `position:fixed; left:${cx}px; top:${cy}px; z-index:200; pointer-events:none; width:20px; height:20px; margin:-10px; border-radius:50%; background:radial-gradient(circle, ${glowColor}, transparent 70%); animation:spellCinematicCore .5s ease-out forwards;`;
        container.appendChild(core);
        removeAfter(core, 600);

        for (let i = 0; i < 12; i++) {
            const p = createEffectElement("div");
            const angle = (i / 12) * Math.PI * 2;
            const dist = 120 + Math.random() * 60;
            p.style.cssText = `position:fixed; left:${cx}px; top:${cy}px; z-index:201; pointer-events:none; width:4px; height:4px; border-radius:50%; background:${glowColor}; box-shadow:0 0 8px ${glowColor}; --tx:${Math.cos(angle) * dist}px; --ty:${Math.sin(angle) * dist}px; animation:spellCinematicConverge .5s cubic-bezier(.4,0,.2,1) forwards; animation-delay:${i * 0.02}s;`;
            container.appendChild(p);
            removeAfter(p, 600);
        }

        setBattleCamera(battleScreen, { y: -2, scale: 1.08, duration: 150 });
    }, 300);

    // === 阶段3：能量爆发 + 镜头回弹 (600-900ms) ===
    setTimeout(() => {
        const burst = createEffectElement("div");
        burst.style.cssText = `position:fixed; left:${cx}px; top:${cy}px; z-index:202; pointer-events:none; width:40px; height:40px; margin:-20px; border-radius:50%; background:radial-gradient(circle, rgba(255,255,255,.7), ${glowColor} 40%, transparent 70%); animation:spellCinematicBurst .4s ease-out forwards;`;
        container.appendChild(burst);
        removeAfter(burst, 500);

        for (let i = 0; i < 2; i++) {
            const ring = createEffectElement("div");
            ring.style.cssText = `position:fixed; left:${cx}px; top:${cy}px; z-index:201; pointer-events:none; width:30px; height:30px; margin:-15px; border:2px solid ${glowColor}; border-radius:50%; animation:spellCinematicRing .6s cubic-bezier(.25,.8,.25,1) forwards; animation-delay:${i * 0.1}s;`;
            container.appendChild(ring);
            removeAfter(ring, 700);
        }

        setBattleCamera(battleScreen, { duration: 300 });
        screenFlash(glowColor.replace(/[\d.]+\)$/, ".1)"));
    }, 600);

    // === 阶段4：残余粒子飘散 (900-1000ms) ===
    setTimeout(() => {
        for (let i = 0; i < 8; i++) {
            const p = createEffectElement("div");
            const angle = Math.random() * Math.PI * 2;
            const dist = 30 + Math.random() * 50;
            p.style.cssText = `position:fixed; left:${cx}px; top:${cy}px; z-index:200; pointer-events:none; width:3px; height:3px; border-radius:50%; background:${glowColor}; --tx:${Math.cos(angle)*dist}px; --ty:${Math.sin(angle)*dist - 30}px; animation:spellCinematicFade .5s ease-out forwards; animation-delay:${i*0.04}s;`;
            container.appendChild(p);
            removeAfter(p, 600);
        }
    }, 900);

    return new Promise(r => setTimeout(r, 1000));
}

function getAttributeColor(attr) {
    const colors = {
        fire: "rgba(255,120,60,.8)", water: "rgba(80,180,255,.8)",
        wind: "rgba(120,255,160,.8)", earth: "rgba(200,170,80,.8)",
        light: "rgba(255,240,120,.8)", dark: "rgba(180,100,255,.8)",
    };
    return colors[attr] || "rgba(85,216,229,.8)";
}

function getAttributeGlow(attr) {
    const glows = {
        fire: "rgba(255,120,60,.3)", water: "rgba(80,180,255,.3)",
        wind: "rgba(120,255,160,.3)", earth: "rgba(200,170,80,.3)",
        light: "rgba(255,240,120,.3)", dark: "rgba(180,100,255,.3)",
    };
    return glows[attr] || "rgba(85,216,229,.3)";
}

function spawnEffectParticles(container, cls, count) {
    for (let i = 0; i < count; i++) {
        const p = createEffectElement("div");
        p.className = cls;
        const dx = (Math.random() - 0.5) * 50;
        p.style.cssText = `left:calc(50% + ${dx}px); top:calc(50%); animation-delay:${i * 0.06}s;`;
        container.appendChild(p);
        removeAfter(p, 600);
    }
}

// =====================================================================
//  电影级破坏特效 —— 卡牌飞到屏幕中央 → 震动裂纹 → 粉碎飞散 → 墓地
// =====================================================================
export function animateCinematicDestroy(fieldSlot, card, htmlFn, graveyardId = "player-graveyard-pile") {
    if (!isBrowser || !fieldSlot || !card) return Promise.resolve();
    const epoch = motionGeneration();
    const source = getRect(fieldSlot);
    return playCardPerformance(card, "destroy", source).then(() => {
        if (epoch !== motionGeneration()) return;
        return playCardTransfer(card, htmlFn(card), source, document.getElementById(graveyardId), "destroy");
    });
}

// =====================================================================
//  电影级回卡组特效 —— 龙卷风漩涡 → 卡牌旋转吸入 → 飞回卡组
// =====================================================================
export function animateCinematicReturnToDeck(card, htmlFn, fromSlot, deckId = "player-deck-pile") {
    if (!isBrowser || !card) return Promise.resolve();
    return playCardTransfer(card, htmlFn(card), fromSlot, document.getElementById(deckId), "return-deck");
}

// =====================================================================
//  电影级返回手牌特效 —— 次元裂缝 → 卡牌螺旋吸入 → 消失在裂缝中
//  视觉风格：紫色/蓝色次元能量，螺旋上升，卡牌被扭曲吸入
// =====================================================================
export function animateCinematicReturnToHand(card, htmlFn, fromSlot, handId = "opponent-hand") {
    if (!isBrowser || !card) return Promise.resolve();
    return playCardTransfer(card, htmlFn(card), fromSlot, document.getElementById(handId), "return-hand");
}

// =====================================================================
//  领域展开演出
// =====================================================================

export const DOMAIN_CINEMATICS = {
    wuji:      { title: "領域展開 · 無量空處", subtitle: "五条悟", color: "#cfd6ff", accent: "#0c0d1a", style: "information" },
    za_warudo: { title: "スタープラチナ・ザ・ワールド", subtitle: "空条承太郎", color: "#ffe06b", accent: "#2b1f00", style: "clock" },
    rojin:     { title: "破壊殺・羅針", subtitle: "猗窩座", color: "#ff5d67", accent: "#2a0a0c", style: "compass" },
    ongaku:    { title: "苍穹音浪", subtitle: "初音未来", color: "#63ddff", accent: "#3a0b4f", style: "stage" },
};

export function playDomainCinematic(fieldId, cardName = "", ownerIndex = 0) {
    if (!isBrowser) return;
    const def = DOMAIN_CINEMATICS[fieldId] || DOMAIN_CINEMATICS.wuji;
    // 音效由 playRuleDrivenEffect 统一派发（action → "domain"），此处不再重复播放
    const reduced = Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
    // reduced-motion 只保留领域横幅 + 单次能量脉冲，跳过时间减速/色差爆发/粒子雨
    if (!reduced) playTimeSlowEffect(700);
    playEnergyPulse(def.color, "rgba(255,255,255,.35)");
    const overlay = createEffectElement("div");
    overlay.className = `domain-overlay domain-${def.style}`;
    overlay.style.setProperty("--domain-color", def.color);
    overlay.style.setProperty("--domain-accent", def.accent);
    overlay.innerHTML = `<div class="domain-vignette"></div><div class="domain-title"><small>${def.subtitle}</small><strong>${def.title}</strong></div>`;
    (document.querySelector(".battle-screen") || document.body).appendChild(overlay);
    removeAfter(overlay, 1700);
    if (def.style === "clock" && !reduced) playChromaticBurst();
    if (def.style === "stage" && !reduced) playParticleRain(def.color, 24);
    if (reduced) overlay.classList.add("reduced");
    // 领域存续徽记
    const chip = createEffectElement("div");
    chip.className = "domain-chip";
    chip.textContent = def.title;
    chip.style.setProperty("--domain-color", def.color);
    document.getElementById("battle-screen")?.appendChild(chip);
    removeAfter(chip, 20000);
}


