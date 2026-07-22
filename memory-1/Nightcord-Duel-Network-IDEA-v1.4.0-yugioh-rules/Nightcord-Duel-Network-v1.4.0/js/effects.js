/**
 * effects.js
 * 战斗特效系统 —— 召唤、魔法、陷阱、攻击、伤害、破坏、治愈
 * + 卡牌飞行动画系统（抽卡、出牌）
 */

const isBrowser = typeof document !== "undefined";

function removeAfter(el, ms) {
    setTimeout(() => el.remove(), ms);
}

function spawnParticles(container, cls, count, spread = 30) {
    for (let i = 0; i < count; i++) {
        const p = document.createElement("div");
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
    return el.getBoundingClientRect();
}

// =====================================================================
//  卡牌飞行动画系统
// =====================================================================

/**
 * 创建一个飞行卡牌克隆体
 */
function createFlyingCard(card, htmlFn) {
    const el = document.createElement("div");
    el.className = "flying-card";
    el.innerHTML = htmlFn(card);
    document.body.appendChild(el);
    return el;
}

/**
 * 抽卡动画：卡牌从牌库漂浮→斜向飞向镜头放大（维持1秒）→回退缩小→滑入手牌
 * 全程带光效拖尾、动态模糊、镜头晃动，流畅连贯帅气运镜
 */
export function animateDrawCard(card, htmlFn) {
    if (!isBrowser || !card) return Promise.resolve();

    const deckPile = document.getElementById("player-deck-pile");
    const handTray = document.getElementById("hand-tray");
    const battlefield = document.querySelector(".battlefield");
    if (!deckPile || !handTray) return Promise.resolve();

    const from = getRect(deckPile);
    const to = getRect(handTray);

    // 起点：牌库位置
    const startX = from.left + from.width / 2 - 71;
    const startY = from.top - 30;

    // 终点：手牌托盘中央
    const endX = to.left + to.width / 2 - 71;
    const endY = to.top + 20;

    // 镜头中心（画面中央偏上）
    const camX = window.innerWidth / 2 - 71;
    const camY = window.innerHeight * 0.35 - 101;

    // === 阶段1：创建飞行卡牌 ===
    const fly = createFlyingCard(card, htmlFn);
    fly.style.left = `${startX}px`;
    fly.style.top = `${startY}px`;
    fly.style.opacity = "0";
    fly.style.zIndex = "250";
    fly.classList.add("draw-cinematic");

    // === 光效拖尾 ===
    const trail = document.createElement("div");
    trail.className = "draw-light-trail";
    trail.style.cssText = `position:fixed; z-index:249; pointer-events:none; left:${startX}px; top:${startY}px; width:142px; height:202px;`;
    document.body.appendChild(trail);

    // === 牌库发光 ===
    const deckBack = deckPile.querySelector(".deck-card-back");
    if (deckBack) {
        deckBack.classList.add("deck-pulse-intense");
        setTimeout(() => deckBack.classList.remove("deck-pulse-intense"), 600);
    }

    // === 镜头晃动容器 ===
    const shakeTarget = battlefield || document.querySelector(".battle-screen");

    // === 动画序列 ===
    let resolve;
    const done = new Promise(r => { resolve = r; });

    // 阶段1：牌库漂浮升起 (0-400ms)
    fly.style.transition = "none";
    requestAnimationFrame(() => {
        fly.style.opacity = "1";
        fly.style.transition = "transform 0.4s cubic-bezier(.4,0,.2,1), opacity 0.3s ease";
        fly.style.transform = "translateY(-40px) rotate(-8deg) scale(0.7)";
        fly.style.filter = "brightness(1.5) blur(2px)";
    });

    // 阶段2：斜向高速飞向镜头，急剧放大 (400-1000ms = 600ms飞向镜头)
    setTimeout(() => {
        fly.style.transition = "transform 0.6s cubic-bezier(.1,.9,.2,1), filter 0.6s ease";
        fly.style.transform = `translate(${camX - startX}px, ${camY - startY}px) rotate(3deg) scale(3.2)`;
        fly.style.filter = "brightness(1.6) blur(0px)";
        fly.style.zIndex = "300";

        // 光效拖尾跟随
        trail.style.transition = "transform 0.6s cubic-bezier(.1,.9,.2,1), opacity 0.6s ease, filter 0.6s ease";
        trail.style.transform = `translate(${camX - startX}px, ${camY - startY}px) scale(3)`;
        trail.style.filter = "blur(4px)";
        trail.style.opacity = "0.6";

        // 镜头轻微晃动
        if (shakeTarget) {
            shakeTarget.style.transition = "none";
            shakeTarget.style.transform = "translateX(-50%) translateY(2px)";
            setTimeout(() => {
                shakeTarget.style.transition = "transform 0.15s ease-out";
                shakeTarget.style.transform = "translateX(-50%) translateY(-1px)";
                setTimeout(() => {
                    shakeTarget.style.transition = "transform 0.2s ease-out";
                    shakeTarget.style.transform = "translateX(-50%) translateY(0)";
                }, 150);
            }, 50);
        }
    }, 400);

    // 阶段3：近距离放大维持1秒 (1000-2000ms)

    // 阶段4：减速回退缩小 (2000-3200ms = 1200ms回退)
    setTimeout(() => {
        fly.style.transition = "transform 1.2s cubic-bezier(.25,.8,.25,1), filter 1.2s ease";
        fly.style.transform = `translate(${endX - startX}px, ${endY - startY}px) rotate(-2deg) scale(1)`;
        fly.style.filter = "brightness(1.1) blur(0px)";
        fly.style.zIndex = "250";

        // 拖尾跟随回退
        trail.style.transition = "transform 1.2s cubic-bezier(.25,.8,.25,1), opacity 1.2s ease, filter 1.2s ease";
        trail.style.transform = `translate(${endX - startX}px, ${endY - startY}px) scale(1)`;
        trail.style.filter = "blur(2px)";
        trail.style.opacity = "0.3";
    }, 2000);

    // 阶段5：平稳滑入手牌，消失 (3200-3600ms)
    setTimeout(() => {
        fly.style.transition = "transform 0.35s cubic-bezier(.4,0,.2,1), opacity 0.35s ease, filter 0.35s ease";
        fly.style.transform = `translate(${endX - startX}px, ${endY + 30 - startY}px) rotate(0deg) scale(0.95)`;
        fly.style.filter = "brightness(1) blur(0px)";
        fly.style.opacity = "0";

        // 拖尾消散
        trail.style.transition = "opacity 0.35s ease";
        trail.style.opacity = "0";

        // 入手闪光
        screenFlash("rgba(85,216,229,.08)");
    }, 3200);

    // 清理
    setTimeout(() => {
        fly.remove();
        trail.remove();
        resolve();
    }, 3700);

    return done;
}

/**
 * 出牌动画：卡牌从手牌冲向镜头→回退缩小→落入场位
 * 电影级运镜，与抽卡风格一致
 */
export function animatePlayCard(card, handCard, targetSlot, htmlFn) {
    if (!isBrowser || !handCard) return Promise.resolve();

    const from = getRect(handCard);
    const to = targetSlot ? getRect(targetSlot) : from;
    const battlefield = document.querySelector(".battlefield");

    const startX = from.left;
    const startY = from.top;
    const endX = to.left + to.width / 2 - 71;
    const endY = to.top + to.height / 2 - 101;

    // 镜头中心（画面中央偏下）
    const camX = window.innerWidth / 2 - 71;
    const camY = window.innerHeight * 0.4 - 101;

    // 手牌发光
    handCard.classList.add("play-glow");

    // 飞行卡牌
    const fly = createFlyingCard(card, htmlFn);
    fly.style.left = `${startX}px`;
    fly.style.top = `${startY}px`;
    fly.style.opacity = "0";
    fly.style.zIndex = "250";

    // 光效拖尾
    const trail = document.createElement("div");
    trail.className = "draw-light-trail";
    trail.style.cssText = `position:fixed; z-index:249; pointer-events:none; left:${startX}px; top:${startY}px; width:142px; height:202px; opacity:0;`;
    document.body.appendChild(trail);

    const shakeTarget = battlefield || document.querySelector(".battle-screen");
    const attr = card.attribute || card.element || "none";

    // === 阶段1：手牌高亮弹起 (0-200ms) ===
    requestAnimationFrame(() => {
        fly.style.opacity = "1";
        fly.style.transition = "transform 0.2s cubic-bezier(.4,0,.2,1), opacity 0.15s ease";
        fly.style.transform = "translateY(-30px) rotate(5deg) scale(1.1)";
        fly.style.filter = "brightness(2) blur(1px)";
    });

    // === 阶段2：冲向镜头放大 (200-450ms) ===
    setTimeout(() => {
        fly.style.transition = "transform 0.25s cubic-bezier(.1,.9,.2,1), filter 0.25s ease";
        fly.style.transform = `translate(${camX - startX}px, ${camY - startY}px) rotate(-3deg) scale(2.8)`;
        fly.style.filter = "brightness(2.5) blur(0px)";
        fly.style.zIndex = "300";

        // 拖尾跟随
        trail.style.transition = "transform 0.25s cubic-bezier(.1,.9,.2,1), opacity 0.2s ease, filter 0.25s ease";
        trail.style.transform = `translate(${camX - startX}px, ${camY - startY}px) scale(2.5)`;
        trail.style.filter = "blur(4px)";
        trail.style.opacity = "0.7";

        // 镜头微晃
        if (shakeTarget) {
            shakeTarget.style.transition = "none";
            shakeTarget.style.transform = "translateX(-50%) translateY(-2px)";
            setTimeout(() => {
                shakeTarget.style.transition = "transform 0.15s ease-out";
                shakeTarget.style.transform = "translateX(-50%) translateY(1px)";
                setTimeout(() => {
                    shakeTarget.style.transition = "transform 0.2s ease-out";
                    shakeTarget.style.transform = "translateX(-50%) translateY(0)";
                }, 150);
            }, 30);
        }
    }, 200);

    // === 阶段3：回退缩小到场位 (450-700ms) ===
    setTimeout(() => {
        fly.style.transition = "transform 0.25s cubic-bezier(.25,.8,.25,1), filter 0.25s ease";
        fly.style.transform = `translate(${endX - startX}px, ${endY - startY}px) rotate(2deg) scale(0.8)`;
        fly.style.filter = "brightness(1.3) blur(0px)";
        fly.style.zIndex = "250";

        // 拖尾跟随
        trail.style.transition = "transform 0.25s cubic-bezier(.25,.8,.25,1), opacity 0.3s ease, filter 0.25s ease";
        trail.style.transform = `translate(${endX - startX}px, ${endY - startY}px) scale(0.8)`;
        trail.style.filter = "blur(2px)";
        trail.style.opacity = "0.2";
    }, 450);

    // === 阶段4：落地定位 + 消散 (700-900ms) ===
    setTimeout(() => {
        fly.style.transition = "transform 0.15s cubic-bezier(.4,0,.2,1), opacity 0.2s ease, filter 0.15s ease";
        fly.style.transform = `translate(${endX - startX}px, ${endY - startY}px) rotate(0deg) scale(0.75)`;
        fly.style.filter = "brightness(1) blur(0px)";
        fly.style.opacity = "0";

        // 拖尾消散
        trail.style.transition = "opacity 0.2s ease";
        trail.style.opacity = "0";

        // 落地冲击
        if (targetSlot) {
            const sw = document.createElement("div");
            sw.className = `summon-shockwave ${attr}`;
            targetSlot.appendChild(sw);
            removeAfter(sw, 550);
        }
        screenFlash(getFlashColor(card));
    }, 700);

    // 清理
    setTimeout(() => {
        fly.remove();
        trail.remove();
        handCard.classList.remove("play-glow");
        resolve();
    }, 950);

    return new Promise(resolve => { setTimeout(resolve, 0); resolve; });
}

/**
 * 出牌飞向墓地动画：卡牌从手牌漂浮→斜向飞向镜头放大（维持1秒）→回退缩小→滑入墓区
 * 全程带光效拖尾、动态模糊、镜头晃动，流畅连贯帅气运镜
 */
export function animatePlayToGraveyard(card, handCard, htmlFn, graveyardId = "player-graveyard-pile") {
    if (!isBrowser || !handCard) return Promise.resolve();

    const from = getRect(handCard);
    const graveyardPile = document.getElementById(graveyardId);
    const battlefield = document.querySelector(".battlefield");

    const startX = from.left;
    const startY = from.top;

    // 终点：墓地区位置
    let endX, endY;
    if (graveyardPile) {
        const gyRect = getRect(graveyardPile);
        endX = gyRect.left + gyRect.width / 2 - 71;
        endY = gyRect.top + 20;
    } else {
        // 兜底：左边与牌库对称的位置
        endX = window.innerWidth * 0.2 - 71;
        endY = window.innerHeight * 0.65 - 101;
    }

    // 镜头中心（画面中央偏上）
    const camX = window.innerWidth / 2 - 71;
    const camY = window.innerHeight * 0.35 - 101;

    // 手牌发光
    handCard.classList.add("play-glow");

    // 飞行卡牌
    const fly = createFlyingCard(card, htmlFn);
    fly.style.left = `${startX}px`;
    fly.style.top = `${startY}px`;
    fly.style.opacity = "0";
    fly.style.zIndex = "250";

    // 光效拖尾
    const trail = document.createElement("div");
    trail.className = "draw-light-trail";
    trail.style.cssText = `position:fixed; z-index:249; pointer-events:none; left:${startX}px; top:${startY}px; width:142px; height:202px; opacity:0;`;
    document.body.appendChild(trail);

    const shakeTarget = battlefield || document.querySelector(".battle-screen");

    // === 动画序列 ===
    let resolve;
    const done = new Promise(r => { resolve = r; });

    // 阶段1：手牌漂浮升起 (0-400ms)
    requestAnimationFrame(() => {
        fly.style.opacity = "1";
        fly.style.transition = "transform 0.4s cubic-bezier(.4,0,.2,1), opacity 0.3s ease";
        fly.style.transform = "translateY(-30px) rotate(5deg) scale(1.1)";
        fly.style.filter = "brightness(1.5) blur(1px)";
    });

    // 阶段2：斜向高速飞向镜头，急剧放大 (400-1000ms)
    setTimeout(() => {
        fly.style.transition = "transform 0.6s cubic-bezier(.1,.9,.2,1), filter 0.6s ease";
        fly.style.transform = `translate(${camX - startX}px, ${camY - startY}px) rotate(-3deg) scale(3.2)`;
        fly.style.filter = "brightness(1.6) blur(0px)";
        fly.style.zIndex = "300";

        // 拖尾跟随
        trail.style.transition = "transform 0.6s cubic-bezier(.1,.9,.2,1), opacity 0.4s ease, filter 0.6s ease";
        trail.style.transform = `translate(${camX - startX}px, ${camY - startY}px) scale(3)`;
        trail.style.filter = "blur(4px)";
        trail.style.opacity = "0.6";

        // 镜头微晃
        if (shakeTarget) {
            shakeTarget.style.transition = "none";
            shakeTarget.style.transform = "translateX(-50%) translateY(-2px)";
            setTimeout(() => {
                shakeTarget.style.transition = "transform 0.15s ease-out";
                shakeTarget.style.transform = "translateX(-50%) translateY(1px)";
                setTimeout(() => {
                    shakeTarget.style.transition = "transform 0.2s ease-out";
                    shakeTarget.style.transform = "translateX(-50%) translateY(0)";
                }, 150);
            }, 30);
        }
    }, 400);

    // 阶段3：近距离放大维持1秒 (1000-2000ms)

    // 阶段4：减速回退缩小向墓区 (2000-3200ms)
    setTimeout(() => {
        fly.style.transition = "transform 1.2s cubic-bezier(.25,.8,.25,1), filter 1.2s ease";
        fly.style.transform = `translate(${endX - startX}px, ${endY - startY}px) rotate(2deg) scale(1)`;
        fly.style.filter = "brightness(1.1) blur(0px)";
        fly.style.zIndex = "250";

        // 拖尾跟随回退
        trail.style.transition = "transform 1.2s cubic-bezier(.25,.8,.25,1), opacity 1.2s ease, filter 1.2s ease";
        trail.style.transform = `translate(${endX - startX}px, ${endY - startY}px) scale(1)`;
        trail.style.filter = "blur(2px)";
        trail.style.opacity = "0.3";
    }, 2000);

    // 阶段5：平稳滑入墓区，消失 (3200-3600ms)
    setTimeout(() => {
        fly.style.transition = "transform 0.35s cubic-bezier(.4,0,.2,1), opacity 0.35s ease, filter 0.35s ease";
        fly.style.transform = `translate(${endX - startX}px, ${endY + 20 - startY}px) rotate(0deg) scale(0.8)`;
        fly.style.filter = "brightness(1) blur(0px)";
        fly.style.opacity = "0";

        // 拖尾消散
        trail.style.transition = "opacity 0.35s ease";
        trail.style.opacity = "0";

        // 墓区闪光
        if (graveyardPile) {
            graveyardPile.style.transition = "box-shadow 0.3s ease";
            graveyardPile.style.boxShadow = "0 0 40px rgba(255,180,80,.5)";
            setTimeout(() => {
                graveyardPile.style.boxShadow = "";
                graveyardPile.style.transition = "";
            }, 400);
        }

        screenFlash("rgba(255,180,80,.08)");
    }, 3200);

    // 清理
    setTimeout(() => {
        fly.remove();
        trail.remove();
        handCard.classList.remove("play-glow");
        resolve();
    }, 3700);

    return done;
}

function spawnTrailParticle(from, to) {
    const p = document.createElement("div");
    p.className = "fly-trail";
    const t = Math.random() * 0.6;
    const x = from.left + (to.left - from.left) * t + (Math.random() - 0.5) * 30;
    const y = from.top + (to.top - from.top) * t + (Math.random() - 0.5) * 30;
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.setProperty("--tx", `${(Math.random() - 0.5) * 20}px`);
    p.style.setProperty("--ty", `${-Math.random() * 15}px`);
    document.body.appendChild(p);
    removeAfter(p, 450);
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
    if (!isBrowser) return;
    const el = document.createElement("div");
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
 */
export function playSummonEffect(fieldSlot, attribute = "none", cardName = "", level = 0) {
    if (!isBrowser) return;

    // 先显示通告横幅
    showSummonBanner(attribute, cardName, level);

    // 在fieldSlot上播放（如果有的话），否则在屏幕中央
    const container = fieldSlot || document.querySelector(".battle-screen") || document.body;

    if (fieldSlot) {
        fieldSlot.classList.add("summoning");
        setTimeout(() => fieldSlot.classList.remove("summoning"), 500);
    }

    const ring = document.createElement("div");
    ring.className = `summon-ring ${attribute}`;
    ring.style.cssText = fieldSlot ? "" : "position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:200;";
    container.appendChild(ring);
    removeAfter(ring, 650);

    const flash = document.createElement("div");
    flash.className = "summon-flash";
    flash.style.cssText = fieldSlot ? "" : "position:fixed; left:0; top:0; right:0; bottom:0; z-index:199;";
    container.appendChild(flash);
    removeAfter(flash, 400);

    if (fieldSlot) spawnParticles(fieldSlot, "summon-spark", 8, 35);
    screenFlash(getFlashColor({ attribute }));
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

    const circle = document.createElement("div");
    circle.className = `spell-circle ${attribute}`;
    fieldSlot.appendChild(circle);
    removeAfter(circle, 900);

    const glow = document.createElement("div");
    glow.className = "spell-glow";
    fieldSlot.appendChild(glow);
    removeAfter(glow, 1000);

    const beam = document.createElement("div");
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

    const barrier = document.createElement("div");
    barrier.className = `trap-barrier ${subtype}`;
    fieldSlot.appendChild(barrier);
    removeAfter(barrier, 1100);

    const flash = document.createElement("div");
    flash.className = "trap-flash";
    fieldSlot.appendChild(flash);
    removeAfter(flash, 550);

    const hex = document.createElement("div");
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
    if (!s) return "";
    return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

/**
 * 攻击特效（在屏幕中央播放）
 */
export function playAttackEffect(attackerSlot, targetSlot = null) {
    if (!isBrowser) return;

    const container = document.querySelector(".battle-screen") || document.body;

    // 屏幕震动
    const bf = document.querySelector(".battle-screen");
    if (bf) {
        bf.classList.remove("shake");
        void bf.offsetWidth;
        bf.classList.add("shake");
        setTimeout(() => bf.classList.remove("shake"), 300);
    }

    // 星形冲击波（屏幕中央）
    const starburst = document.createElement("div");
    starburst.className = "impact-starburst";
    starburst.style.cssText = "position:fixed; left:50%; top:45%; z-index:200;";
    container.appendChild(starburst);
    removeAfter(starburst, 500);

    // 碎片爆裂（屏幕中央）
    const fragmentContainer = document.createElement("div");
    fragmentContainer.style.cssText = "position:fixed; left:50%; top:45%; width:0; height:0; z-index:201;";
    container.appendChild(fragmentContainer);
    for (let i = 0; i < 8; i++) {
        const f = document.createElement("div");
        f.className = "shatter-fragment";
        const angle = (i / 8) * Math.PI * 2;
        const dist = 30 + Math.random() * 40;
        const sx = Math.cos(angle) * dist;
        const sy = Math.sin(angle) * dist;
        const sr = 90 + Math.random() * 270;
        const w = 8 + Math.random() * 10;
        const h = 10 + Math.random() * 14;
        f.style.cssText = `
            left:${-w/2}px; top:${-h/2}px;
            --sx:${sx}px; --sy:${sy}px; --sr:${sr}deg;
            --w:${w}px; --h:${h}px;
            --bg:rgba(255,255,255,.15);
        `;
        fragmentContainer.appendChild(f);
        removeAfter(f, 650);
    }
    removeAfter(fragmentContainer, 700);

    screenFlash("rgba(255,100,80,.1)");
}

function spawnShatterFragments(container, count) {
    const colors = [
        "rgba(255,255,255,.12)", "rgba(255,200,100,.1)",
        "rgba(180,100,255,.08)", "rgba(85,216,229,.08)",
    ];
    for (let i = 0; i < count; i++) {
        const f = document.createElement("div");
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
    const el = document.createElement("div");
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
    const glow = document.createElement("div");
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
        const ring = document.createElement("div");
        ring.className = "flip-flash-ring";
        fieldSlot.appendChild(ring);
        removeAfter(ring, 650);

        // 防御表示额外护盾
        if (isDefense) {
            const shield = document.createElement("div");
            shield.className = "defense-shield";
            fieldSlot.appendChild(shield);
            removeAfter(shield, 1050);
        }
    }

    screenFlash("rgba(255,211,107,.12)");
}

function spawnGoldParticles(container, count) {
    for (let i = 0; i < count; i++) {
        const p = document.createElement("div");
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
 * 陷阱连锁发动特效（在屏幕中央播放）
 */
export function playTrapChainEffect(fieldSlot, cardName = "") {
    if (!isBrowser) return;

    // 全屏通告
    showAnnounceBanner("trap", "counter", cardName);

    const container = document.querySelector(".battle-screen") || document.body;

    // 紫色魔法阵（三层旋转）
    const circle = document.createElement("div");
    circle.className = "trap-magic-circle";
    circle.style.cssText = "position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:200;";
    container.appendChild(circle);
    removeAfter(circle, 1300);

    // 锁链（6条放射状）
    for (let i = 0; i < 6; i++) {
        const chain = document.createElement("div");
        chain.className = "trap-chain";
        chain.style.cssText = `position:fixed; left:50%; top:50%; z-index:200; transform:rotate(${i * 60}deg); animation-delay:${i * 0.04}s;`;
        container.appendChild(chain);
        removeAfter(chain, 900);
    }

    // 警告标志
    const warn = document.createElement("div");
    warn.className = "trap-warning-sign";
    warn.style.cssText = "position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:202;";
    container.appendChild(warn);
    removeAfter(warn, 1050);

    // 紫色爆发光晕
    const burst = document.createElement("div");
    burst.className = "trap-purple-burst";
    burst.style.cssText = "position:fixed; left:0; top:0; right:0; bottom:0; z-index:199;";
    container.appendChild(burst);
    removeAfter(burst, 1050);

    // 陷阱栏障
    const barrier = document.createElement("div");
    barrier.className = "trap-barrier counter";
    barrier.style.cssText = "position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); width:200px; height:200px; z-index:201;";
    container.appendChild(barrier);
    removeAfter(barrier, 1100);

    screenFlash("rgba(180,100,255,.15)");
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

    const overlay = document.createElement("div");
    overlay.className = "card-foil-overlay";
    const shimmer = document.createElement("div");
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
export function playDrawEffect() {
    if (!isBrowser) return;
    const glow = document.createElement("div");
    glow.className = "draw-glow";
    document.getElementById("battle-screen")?.appendChild(glow);
    removeAfter(glow, 650);
}

/**
 * 阶段转换闪光
 */
export function playPhaseFlash() {
    if (!isBrowser) return;
    const flash = document.createElement("div");
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
export function playMonsterEffect(fieldSlot, attribute = "none", effectType = "none") {
    if (!isBrowser || !fieldSlot) return;

    // 发动闪光
    fieldSlot.classList.add("effect-activate");
    setTimeout(() => fieldSlot.classList.remove("effect-activate"), 650);

    // 属性色魔法环
    const ring = document.createElement("div");
    ring.className = `magic-ring spell-effect-${attribute}`;
    ring.style.setProperty("--spell-color", getAttributeColor(attribute));
    ring.style.setProperty("--spell-glow", getAttributeGlow(attribute));
    fieldSlot.appendChild(ring);
    removeAfter(ring, 750);

    // 根据效果类型添加额外粒子
    if (effectType === "buff" || effectType === "buffSelfAttack" || effectType === "buffSelfDefense" || effectType === "buffAllAlliesAttack") {
        spawnEffectParticles(fieldSlot, "buff-particle", 6);
    } else if (effectType === "debuff" || effectType === "debuffEnemyAttack" || effectType === "debuffAllEnemyAttack") {
        spawnEffectParticles(fieldSlot, "debuff-particle", 6);
    } else if (effectType === "healPlayer" || effectType === "healAllAllies") {
        playHealEffect(fieldSlot);
    } else if (effectType === "drawCards") {
        spawnEffectParticles(fieldSlot, "draw-particle", 5);
    }

    screenFlash(getFlashColor({ attribute }));
}

/**
 * 魔法卡发动特效（在屏幕中央播放，不依赖特定DOM元素）
 */
export function playSpellEffectV2(fieldSlot, attribute = "none", cardName = "", effectType = "none") {
    if (!isBrowser) return;

    // 全屏通告
    showAnnounceBanner("spell", attribute, cardName);

    // 在battle-screen上播放特效（如果有的话），否则在body上
    const container = document.querySelector(".battle-screen") || document.body;

    // 属性色魔法阵
    const circle = document.createElement("div");
    circle.className = `spell-circle ${attribute}`;
    circle.style.cssText = "position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:200;";
    container.appendChild(circle);
    removeAfter(circle, 900);

    // 属性色扩散环（多层）
    for (let i = 0; i < 3; i++) {
        const ring = document.createElement("div");
        ring.className = `magic-ring spell-effect-${attribute}`;
        ring.style.cssText = `position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:200; animation-delay:${i * 0.1}s; --spell-color:${getAttributeColor(attribute)}; --spell-glow:${getAttributeGlow(attribute)};`;
        container.appendChild(ring);
        removeAfter(ring, 900 + i * 100);
    }

    const glow = document.createElement("div");
    glow.className = "screen-flash";
    glow.style.cssText = `--flash-color:${getFlashColor({ attribute })}; position:fixed; left:0; top:0; right:0; bottom:0; z-index:199;`;
    container.appendChild(glow);
    removeAfter(glow, 800);

    screenFlash(getFlashColor({ attribute }));

    // 根据效果类型追加专属特效
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    if (effectType === "drawCards") {
        // 抽卡：卡牌从上方飞入
        for (let i = 0; i < 5; i++) {
            const p = document.createElement("div");
            p.className = "spell-draw-particle";
            p.style.cssText = `left:${cx - 20 + (i - 2) * 30}px; top:${cy - 30}px; animation-delay:${i * 0.08}s;`;
            container.appendChild(p);
            removeAfter(p, 1000);
        }
    } else if (effectType === "reviveRecentGraveyard") {
        // 复活：光点从底部升起
        for (let i = 0; i < 12; i++) {
            const p = document.createElement("div");
            p.className = "spell-revive-particle";
            const ox = (Math.random() - 0.5) * 80;
            p.style.cssText = `left:${cx + ox}px; top:${cy + 40}px; animation-delay:${i * 0.06}s;`;
            container.appendChild(p);
            removeAfter(p, 1200);
        }
    } else if (effectType === "healPlayer" || effectType === "healAllAllies" || effectType === "healAndDrawV2" || effectType === "recoverRecentDamage") {
        // 回复：绿色光点上升
        for (let i = 0; i < 15; i++) {
            const p = document.createElement("div");
            p.className = "spell-heal-particle";
            const ox = (Math.random() - 0.5) * 120;
            const oy = Math.random() * 40;
            p.style.cssText = `left:${cx + ox}px; top:${cy + oy}px; animation-delay:${i * 0.05}s; width:${6 + Math.random() * 6}px; height:${6 + Math.random() * 6}px;`;
            container.appendChild(p);
            removeAfter(p, 1400);
        }
    } else if (effectType === "sacrificeDestroy" || effectType === "destroyTarget" || effectType === "destroyAllEnemyMonsters" || effectType === "damageAllEnemyMonsters") {
        // 破坏：红色碎片爆裂
        for (let i = 0; i < 16; i++) {
            const p = document.createElement("div");
            p.className = "spell-destroy-particle";
            const angle = (i / 16) * Math.PI * 2;
            const dist = 60 + Math.random() * 80;
            const dx = Math.cos(angle) * dist;
            const dy = Math.sin(angle) * dist;
            const rot = (Math.random() - 0.5) * 720;
            p.style.cssText = `left:${cx - 5}px; top:${cy - 7}px; --dx:${dx}px; --dy:${dy}px; --rot:${rot}deg; animation-delay:${i * 0.03}s;`;
            container.appendChild(p);
            removeAfter(p, 900);
        }
    } else if (effectType === "returnToHand") {
        // 回手：卡牌旋转飞走
        for (let i = 0; i < 4; i++) {
            const p = document.createElement("div");
            p.className = "spell-return-particle";
            const angle = Math.random() * Math.PI * 2;
            const dist = 100 + Math.random() * 60;
            p.style.cssText = `left:${cx - 18}px; top:${cy - 25}px; --dx:${Math.cos(angle) * dist}px; --dy:${Math.sin(angle) * dist - 80}px; animation-delay:${i * 0.1}s;`;
            container.appendChild(p);
            removeAfter(p, 1000);
        }
    } else if (effectType === "doubleAttack") {
        // 双重攻击：两道红色能量环
        for (let i = 0; i < 2; i++) {
            const r = document.createElement("div");
            r.className = "spell-double-ring";
            r.style.cssText = `position:fixed; left:50%; top:50%; z-index:210; animation-delay:${i * 0.15}s;`;
            container.appendChild(r);
            removeAfter(r, 800);
        }
    } else if (effectType === "swapHands") {
        // 交换手牌：循环箭头
        const orbit = document.createElement("div");
        orbit.className = "spell-swap-orbit";
        orbit.style.cssText = "position:fixed; left:50%; top:50%; z-index:210;";
        container.appendChild(orbit);
        removeAfter(orbit, 1100);
    } else if (effectType === "fusionSummon") {
        // 融合：两束光从两侧汇聚
        const offsets = [{ sx: -120, sy: -60 }, { sx: 120, sy: -60 }];
        offsets.forEach((off, i) => {
            const b = document.createElement("div");
            b.className = "spell-fusion-beam";
            b.style.cssText = `position:fixed; left:50%; top:50%; z-index:210; --sx:${off.sx}px; --sy:${off.sy}px; animation-delay:${i * 0.15}s;`;
            container.appendChild(b);
            removeAfter(b, 1000);
        });
    } else if (effectType === "snatchCards") {
        // 夺取：暗影之手
        const hand = document.createElement("div");
        hand.className = "spell-snatch-hand";
        hand.textContent = "🫳";
        hand.style.cssText = "position:fixed; left:50%; top:40%; z-index:210;";
        container.appendChild(hand);
        removeAfter(hand, 1000);
    } else if (effectType === "recycleAndDraw") {
        // 回收：卡牌旋转回收
        for (let i = 0; i < 6; i++) {
            const p = document.createElement("div");
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
            const p = document.createElement("div");
            p.className = "spell-heal-particle";
            const ox = (Math.random() - 0.5) * 100;
            p.style.cssText = `left:${cx + ox}px; top:${cy}px; background:radial-gradient(circle, rgba(255,220,100,.9), rgba(255,180,60,.4)); animation-delay:${i * 0.06}s;`;
            container.appendChild(p);
            removeAfter(p, 1000);
        }
        setTimeout(() => {
            for (let i = 0; i < 8; i++) {
                const p = document.createElement("div");
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
            const p = document.createElement("div");
            p.style.cssText = `position:fixed; z-index:210; pointer-events:none; left:${cx + (Math.random() - 0.5) * 160}px; top:${cy + (Math.random() - 0.5) * 100}px; font-size:${20 + Math.random() * 20}px; color:rgba(255,200,100,.8); text-shadow:0 0 10px rgba(255,200,100,.5); animation:spellHealFloat ${0.8 + Math.random() * 0.4}s ease-out forwards; animation-delay:${i * 0.08}s;`;
            p.textContent = "?";
            container.appendChild(p);
            removeAfter(p, 1400);
        }
    }
}

/**
 * 陷阱卡连锁发动特效（在屏幕中央播放）
 */
export function playTrapEffectV2(fieldSlot, subtype = "counter", cardName = "", effectType = "none") {
    if (!isBrowser) return;

    showAnnounceBanner("trap", subtype, cardName);

    const container = document.querySelector(".battle-screen") || document.body;

    // 紫色魔法阵
    const circle = document.createElement("div");
    circle.className = "trap-magic-circle";
    circle.style.cssText = "position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:200;";
    container.appendChild(circle);
    removeAfter(circle, 1300);

    // 锁链
    for (let i = 0; i < 6; i++) {
        const chain = document.createElement("div");
        chain.className = "trap-chain";
        chain.style.cssText = `position:fixed; left:50%; top:50%; z-index:200; transform:rotate(${i * 60}deg); animation-delay:${i * 0.04}s;`;
        container.appendChild(chain);
        removeAfter(chain, 900);
    }

    // 锁定符号
    const lock = document.createElement("div");
    lock.className = "trap-lock-symbol";
    lock.style.cssText = "position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:201;";
    container.appendChild(lock);
    removeAfter(lock, 700);

    // 警告标志
    const warn = document.createElement("div");
    warn.className = "trap-warning-sign";
    warn.style.cssText = "position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:202;";
    container.appendChild(warn);
    removeAfter(warn, 1050);

    // 紫色爆发
    const burst = document.createElement("div");
    burst.className = "trap-purple-burst";
    burst.style.cssText = "position:fixed; left:0; top:0; right:0; bottom:0; z-index:199;";
    container.appendChild(burst);
    removeAfter(burst, 1050);

    screenFlash("rgba(180,100,255,.15)");
}

/**
 * 破坏怪兽特效（增强版：碎片爆裂）
 */
export function playDestroyEffectV2(fieldSlot) {
    if (!isBrowser || !fieldSlot) return;
    const card = fieldSlot.querySelector(".card");
    if (card) {
        card.classList.add("destroying");
        setTimeout(() => card.classList.remove("destroying"), 500);
    }

    // 碎片爆裂
    const colors = ["#ff6f8d", "#ffd36b", "#c77dff", "#ff9f43", "#fff"];
    for (let i = 0; i < 12; i++) {
        const p = document.createElement("div");
        p.className = "destroy-particle-v2";
        const angle = (i / 12) * Math.PI * 2;
        const dist = 25 + Math.random() * 35;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;
        const dr = 90 + Math.random() * 270;
        const size = 4 + Math.random() * 6;
        p.style.cssText = `
            left:calc(50% - ${size/2}px); top:calc(50% - ${size/2}px);
            --dx:${dx}px; --dy:${dy}px; --dr:${dr}deg;
            --size:${size}px; --color:${colors[Math.floor(Math.random() * colors.length)]};
        `;
        fieldSlot.appendChild(p);
        removeAfter(p, 550);
    }

    screenFlash("rgba(255,80,100,.08)");
}

/**
 * 治愈特效（增强版：绿色光环 + 粒子）
 */
export function playHealEffectV2(fieldSlot) {
    if (!isBrowser || !fieldSlot) return;

    const glow = document.createElement("div");
    glow.className = "heal-glow";
    fieldSlot.appendChild(glow);
    removeAfter(glow, 750);

    // 绿色上升粒子
    for (let i = 0; i < 8; i++) {
        const p = document.createElement("div");
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
            const p = document.createElement("div");
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
            const p = document.createElement("div");
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
            const p = document.createElement("div");
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
            const p = document.createElement("div");
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
        const p = document.createElement("div");
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
                const p = document.createElement("div");
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
    const glow = document.createElement("div");
    glow.className = "big-heal-glow";
    glow.style.cssText = "position:fixed; left:0; top:0; right:0; bottom:0; z-index:150; pointer-events:none;";
    container.appendChild(glow);
    removeAfter(glow, 800);

    // 粒子上升
    for (let i = 0; i < 10; i++) {
        const p = document.createElement("div");
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
    const helix = document.createElement("div");
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
        const p = document.createElement("div");
        p.className = cls;
        const dx = (Math.random() - 0.5) * 50;
        p.style.cssText = `left:calc(50% + ${dx}px); top:calc(50%); animation-delay:${i * 0.06}s;`;
        container.appendChild(p);
        removeAfter(p, 600);
    }
}
