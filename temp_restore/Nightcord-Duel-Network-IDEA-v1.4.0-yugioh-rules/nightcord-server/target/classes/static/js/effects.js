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
export function animateDrawCard(card, htmlFn, isOpponent = false) {
    if (!isBrowser || !card) return Promise.resolve();

    const deckPileId = isOpponent ? "opponent-deck-pile" : "player-deck-pile";
    const handSelector = isOpponent ? ".opponent-hand" : "#hand-tray";
    const deckPile = document.getElementById(deckPileId);
    const handTray = document.querySelector(handSelector);
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

/**
 * 生成卡背HTML（里侧表示）
 */
export function createCardBackHtml(card) {
    const typeLabel = card?.type === "trap" ? "TRAP" : card?.type === "spell" ? "SPELL" : "NC";
    const label = card?.type === "monster" ? "" : "SET";
    return `<div class="card in-field"><div class="card-frame face-down-frame"><div class="card-back-icon">${typeLabel}</div><div class="card-back-label">${label}</div></div></div>`;
}

/**
 * 出牌到场上区域运镜动画（怪兽/魔法/陷阱通用）
 * 卡牌从手牌→飞向镜头放大→回退缩小→落入目标区域
 * options.isCardBack: true 时显示卡背（对手陷阱）
 * options.endScale: 落地缩放比例（魔法/陷阱区较小，用0.7）
 */
export function animatePlayToZone(card, fromEl, targetSlot, htmlFn, options = {}) {
    if (!isBrowser || !fromEl) return Promise.resolve();

    const from = getRect(fromEl);
    const to = targetSlot ? getRect(targetSlot) : from;

    const startX = from.left;
    const startY = from.top;
    const endX = to.left + to.width / 2 - 71;
    const endY = to.top + to.height / 2 - 101;

    // 镜头中心（画面中央偏上）
    const camX = window.innerWidth / 2 - 71;
    const camY = window.innerHeight * 0.38 - 101;

    const battlefield = document.querySelector(".battlefield");
    const shakeTarget = battlefield || document.querySelector(".battle-screen");
    const attr = card.attribute || card.element || "none";
    const endScale = options.endScale || 0.8;
    // 旋转：卡背默认360度旋转，卡面默认12度微旋
    const targetRotation = options.targetRotation !== undefined
        ? options.targetRotation
        : (options.isCardBack ? 360 : 12);

    // 选择显示卡面还是卡背
    const cardHtml = options.isCardBack ? createCardBackHtml(card) : htmlFn(card);

    // 手牌发光（如果不是临时元素）
    if (fromEl.classList) fromEl.classList.add("play-glow");

    // 飞行卡牌
    const fly = createFlyingCard(card, () => cardHtml);
    fly.style.left = `${startX}px`;
    fly.style.top = `${startY}px`;
    fly.style.opacity = "0";
    fly.style.zIndex = "250";
    fly.style.perspective = "800px";

    // 光效拖尾
    const trail = document.createElement("div");
    trail.className = "draw-light-trail";
    trail.style.cssText = `position:fixed; z-index:249; pointer-events:none; left:${startX}px; top:${startY}px; width:142px; height:202px; opacity:0;`;
    document.body.appendChild(trail);

    let resolve;
    const done = new Promise(r => { resolve = r; });

    // 阶段1：手牌高亮弹起 + 起始旋转 (0-200ms)
    requestAnimationFrame(() => {
        fly.style.opacity = "1";
        fly.style.transition = "transform 0.2s cubic-bezier(.4,0,.2,1), opacity 0.15s ease";
        fly.style.transform = `translateY(-30px) rotate(${targetRotation * 0.05}deg) scale(1.1)`;
        fly.style.filter = "brightness(2) blur(1px)";
    });

    // 阶段2：冲向镜头放大 + 中段旋转 (200-500ms)
    setTimeout(() => {
        fly.style.transition = "transform 0.3s cubic-bezier(.1,.9,.2,1), filter 0.3s ease";
        fly.style.transform = `translate(${camX - startX}px, ${camY - startY}px) rotate(${targetRotation * 0.4}deg) scale(2.8)`;
        fly.style.filter = "brightness(2.5) blur(0px)";
        fly.style.zIndex = "300";

        trail.style.transition = "transform 0.3s cubic-bezier(.1,.9,.2,1), opacity 0.2s ease, filter 0.3s ease";
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

    // 阶段3：回退缩小到场位 + 后段旋转 (500-800ms)
    setTimeout(() => {
        fly.style.transition = "transform 0.3s cubic-bezier(.25,.8,.25,1), filter 0.3s ease";
        fly.style.transform = `translate(${endX - startX}px, ${endY - startY}px) rotate(${targetRotation * 0.85}deg) scale(${endScale + 0.1})`;
        fly.style.filter = "brightness(1.3) blur(0px)";
        fly.style.zIndex = "250";

        trail.style.transition = "transform 0.3s cubic-bezier(.25,.8,.25,1), opacity 0.3s ease, filter 0.3s ease";
        trail.style.transform = `translate(${endX - startX}px, ${endY - startY}px) scale(${endScale + 0.1})`;
        trail.style.filter = "blur(2px)";
        trail.style.opacity = "0.2";
    }, 500);

    // 阶段4：落地定位 + 旋转归零 + 消散 (800-1000ms)
    setTimeout(() => {
        fly.style.transition = "transform 0.2s cubic-bezier(.4,0,.2,1), opacity 0.25s ease, filter 0.2s ease";
        fly.style.transform = `translate(${endX - startX}px, ${endY - startY}px) rotate(${targetRotation}deg) scale(${endScale})`;
        fly.style.filter = "brightness(1) blur(0px)";
        fly.style.opacity = "0";

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
    }, 800);

    // 清理
    setTimeout(() => {
        fly.remove();
        trail.remove();
        if (fromEl.classList) fromEl.classList.remove("play-glow");
        resolve();
    }, 1100);

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
    // 旧版兼容：直接播放碰撞特效
    if (!isBrowser) return;
    const container = document.querySelector(".battle-screen") || document.body;
    const bf = document.querySelector(".battle-screen");
    if (bf) { bf.classList.remove("shake"); void bf.offsetWidth; bf.classList.add("shake"); setTimeout(() => bf.classList.remove("shake"), 300); }
    const starburst = document.createElement("div");
    starburst.className = "impact-starburst";
    starburst.style.cssText = "position:fixed; left:50%; top:45%; z-index:200;";
    container.appendChild(starburst);
    removeAfter(starburst, 500);
    screenFlash("rgba(255,100,80,.1)");
}

/**
 * 新版攻击运镜：怪兽冲过去 → 碰撞 → 活了滑回来 / 死了碎裂消失
 * @param attackerSlot - 攻击怪兽的DOM槽位
 * @param targetSlot - 目标怪兽的DOM槽位（null = 直接攻击玩家）
 * @param attackerCard - 攻击怪兽的卡牌数据
 * @param attackerSurvived - 攻击后攻击方是否存活
 * @param playerHud - 直接攻击时的玩家HUD元素
 */
export function playAttackAnimation(attackerSlot, targetSlot, attackerCard, attackerSurvived, playerHud) {
    if (!isBrowser || !attackerSlot || !attackerCard) return Promise.resolve();

    const from = getRect(attackerSlot);
    const to = targetSlot ? getRect(targetSlot) : (playerHud ? getRect(playerHud) : from);
    const battlefield = document.querySelector(".battlefield");

    // 创建飞行克隆体
    const fly = document.createElement("div");
    fly.className = "flying-card attack-fly";
    fly.innerHTML = `<div class="card in-field rarity-${attackerCard.rarity || "N"}"><div class="card-frame elem-${attackerCard.attribute || "none"} type-monster"><div class="card-header"><span class="card-name">${escapeHtml(attackerCard.name)}</span><span class="card-level">Lv.${attackerCard.level || "?"}</span></div><div class="card-art"><div class="card-art-inner">${createFlyingCardInner(attackerCard)}</div></div><div class="card-footer"><span class="stat-atk"><span>ATK</span>${attackerCard.currentAttack || 0}</span></div></div></div>`;

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
        fly.style.filter = "brightness(1.4)";
    });

    // 阶段2：冲向目标 (150-450ms)
    setTimeout(() => {
        fly.style.transition = "transform 0.3s cubic-bezier(.2,.8,.3,1), filter 0.3s ease";
        fly.style.transform = `translate(${dx}px, ${dy}px) scale(0.9)`;
        fly.style.filter = "brightness(1.6) drop-shadow(0 0 8px rgba(255,200,100,.4))";

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
        // 碰撞冲击波
        const impact = document.createElement("div");
        impact.className = "impact-starburst";
        impact.style.cssText = `position:fixed; left:${endX + 48}px; top:${endY + 62}px; z-index:265; transform:translate(-50%,-50%);`;
        document.body.appendChild(impact);
        removeAfter(impact, 500);

        // 屏幕震动
        const bf = document.querySelector(".battle-screen");
        if (bf) { bf.classList.remove("shake"); void bf.offsetWidth; bf.classList.add("shake"); setTimeout(() => bf.classList.remove("shake"), 300); }

        // 碰撞闪光
        screenFlash("rgba(255,150,80,.12)");

        // 卡牌碰撞回弹
        fly.style.transition = "transform 0.1s ease-out, filter 0.1s ease";
        fly.style.transform = `translate(${dx * 0.85}px, ${dy * 0.85}px) scale(1.1)`;
        fly.style.filter = "brightness(2) blur(1px)";
    }, 450);

    // 阶段4：根据结果决定去向 (600ms)
    setTimeout(() => {
        if (attackerSurvived) {
            // 存活：滑回原位
            fly.style.transition = "transform 0.5s cubic-bezier(.25,.8,.25,1), filter 0.5s ease, opacity 0.5s ease";
            fly.style.transform = "translate(0, 0) scale(1)";
            fly.style.filter = "brightness(1.1)";
            fly.style.opacity = "1";

            // 回到原位后消失
            setTimeout(() => {
                fly.style.transition = "opacity 0.2s ease";
                fly.style.opacity = "0";
                setTimeout(() => { fly.remove(); resolve(); }, 250);
            }, 500);
        } else {
            // 被破坏：碎裂消失
            // 镜像破碎效果
            const shatter = document.createElement("div");
            shatter.className = "mirror-shatter";
            shatter.style.cssText = `position:fixed; left:${startX}px; top:${startY}px; width:96px; height:125px; z-index:265;`;

            // 裂纹
            const crack = document.createElement("div");
            crack.className = "mirror-crack";
            crack.style.cssText = `--a1:${30 + Math.random() * 30}deg; --a2:${120 + Math.random() * 40}deg; --a3:${200 + Math.random() * 30}deg;`;
            shatter.appendChild(crack);

            // 闪光
            const flash = document.createElement("div");
            flash.className = "mirror-flash";
            shatter.appendChild(flash);

            // 碎片
            for (let i = 0; i < 14; i++) {
                const shard = document.createElement("div");
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
            fly.style.filter = "brightness(2.5) blur(3px)";

            setTimeout(() => { shatter.remove(); fly.remove(); resolve(); }, 500);
        }
    }, 600);

    return done;
}

function createFlyingCardInner(card) {
    const img = card.thumbnail || card.image;
    if (img) return `<img src="${escapeHtml(img)}" alt="${escapeHtml(card.name)}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'">`;
    return `<div style="width:100%;height:100%;display:grid;place-items:center;font-size:28px;font-weight:900;color:rgba(255,255,255,.6)">${escapeHtml(card.name?.[0] || "?")}</div>`;
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
 * 陷阱连锁发动（旧版兼容包装 → V3）
 */
export function playTrapChainEffect(fieldSlot, cardName = "") {
    if (!isBrowser || !fieldSlot) return;
    const trapCard = { name: cardName || "陷阱", type: "trap", rarity: "R" };
    playTrapActivationV3(fieldSlot, trapCard);
}

/**
 * 陷阱卡连锁发动完整运镜 V3
 * 盖卡弹起→翻转→悬浮释放→碎裂入墓
 * @param trapSlot - 盖放陷阱卡的DOM槽位
 * @param trapCard - 陷阱卡数据
 * @param targetType - 效果目标类型 (null=无目标, "monster"=怪兽, "player"=玩家)
 * @param targetSlot - 目标DOM槽位
 */
export function playTrapActivationV3(trapSlot, trapCard, targetType = null, targetSlot = null) {
    if (!isBrowser || !trapSlot || !trapCard) return Promise.resolve();

    const container = document.querySelector(".battle-screen") || document.body;
    const battlefield = document.querySelector(".battlefield");
    const slotRect = getRect(trapSlot);

    let resolve;
    const done = new Promise(r => { resolve = r; });

    // 全屏暗紫底光
    const overlay = document.createElement("div");
    overlay.className = "trap-purple-overlay";
    container.appendChild(overlay);
    removeAfter(overlay, 1300);

    // 阶段1：盖卡弹起+翻转 (0-500ms)
    const cardEl = trapSlot.querySelector(".card-back-icon")?.closest(".field-slot") || trapSlot;
    trapSlot.classList.add("trap-flip-launch");
    setTimeout(() => trapSlot.classList.remove("trap-flip-launch"), 550);

    // 镜头快速下拉聚焦
    if (battlefield) {
        battlefield.style.transition = "transform 0.3s cubic-bezier(.25,.8,.25,1)";
        battlefield.style.transform = `translateX(-50%) translateY(${-(slotRect.top - window.innerHeight * 0.4)}px) scale(1.05)`;
        setTimeout(() => {
            battlefield.style.transition = "transform 0.5s cubic-bezier(.25,.8,.25,1)";
            battlefield.style.transform = "translateX(-50%)";
        }, 1200);
    }

    // 阶段2：卡牌悬浮到场地中央释放特效 (500-1500ms)
    setTimeout(() => {
        // 创建悬浮卡牌克隆
        const flyCard = document.createElement("div");
        flyCard.className = "trap-hover-float";
        flyCard.innerHTML = `<div class="card in-field rarity-${trapCard.rarity || "N"}" style="width:96px;height:125px"><div class="card-frame elem-dark type-trap"><div class="card-header"><span class="card-name">${escapeHtml(trapCard.name)}</span></div><div class="card-art"><div class="card-art-inner">${createFlyingCardInner(trapCard)}</div></div><div class="card-footer"><span class="stat-type">TRAP</span></div></div></div>`;
        flyCard.style.cssText = `left:${window.innerWidth / 2 - 48}px; top:${window.innerHeight * 0.4 - 62}px;`;
        container.appendChild(flyCard);
        removeAfter(flyCard, 1900);

        // 释放特效环
        const circle = document.createElement("div");
        circle.className = "trap-magic-circle";
        circle.style.cssText = "position:fixed; left:50%; top:40%; transform:translate(-50%,-50%); z-index:210;";
        container.appendChild(circle);
        removeAfter(circle, 1200);

        // 紫色扩散环
        for (let i = 0; i < 3; i++) {
            const ring = document.createElement("div");
            ring.className = "magic-ring spell-effect-dark";
            ring.style.cssText = `position:fixed; left:50%; top:40%; transform:translate(-50%,-50%); z-index:209; animation-delay:${i * 0.12}s; --spell-color:rgba(180,100,255,.7); --spell-glow:rgba(180,100,255,.3);`;
            container.appendChild(ring);
            removeAfter(ring, 1000 + i * 120);
        }

        // 锁链放射
        for (let i = 0; i < 6; i++) {
            const chain = document.createElement("div");
            chain.className = "trap-chain";
            chain.style.cssText = `position:fixed; left:50%; top:40%; z-index:211; transform:rotate(${i * 60}deg); animation-delay:${i * 0.04}s;`;
            container.appendChild(chain);
            removeAfter(chain, 900);
        }

        screenFlash("rgba(180,100,255,.12)");
    }, 500);

    // 阶段3：碎裂入墓 (1500-2100ms)
    setTimeout(() => {
        // 碎裂效果
        const shatter = document.createElement("div");
        shatter.className = "mirror-shatter";
        shatter.style.cssText = `position:fixed; left:${slotRect.left}px; top:${slotRect.top}px; width:${slotRect.width}px; height:${slotRect.height}px; z-index:265;`;
        const crack = document.createElement("div");
        crack.className = "mirror-crack";
        crack.style.cssText = `--a1:${30 + Math.random() * 30}deg; --a2:${120 + Math.random() * 40}deg; --a3:${200 + Math.random() * 30}deg;`;
        shatter.appendChild(crack);
        for (let i = 0; i < 10; i++) {
            const shard = document.createElement("div");
            shard.className = "mirror-shard";
            const angle = (i / 10) * Math.PI * 2;
            const dist = 30 + Math.random() * 40;
            shard.style.cssText = `left:${20 + Math.random() * 60}%; top:${20 + Math.random() * 60}%; width:${8 + Math.random() * 14}px; height:${10 + Math.random() * 16}px; --sx:${Math.cos(angle) * dist}px; --sy:${Math.sin(angle) * dist}px; --sr:${(Math.random()-0.5)*400}deg; clip-path:polygon(${Math.random()*30}% 0%, 100% ${Math.random()*30}%, ${70+Math.random()*30}% 100%, 0% ${70+Math.random()*30}%); animation-delay:${Math.random() * 0.05}s;`;
            shatter.appendChild(shard);
        }
        container.appendChild(shatter);
        removeAfter(shatter, 700);

        // 墓地闪光
        const graveyardPile = document.querySelector(".graveyard-pile-" + (trapSlot.dataset.owner === "0" ? "player" : "opponent"));
        if (graveyardPile) {
            graveyardPile.style.transition = "box-shadow 0.3s ease";
            graveyardPile.style.boxShadow = "0 0 30px rgba(180,100,255,.4)";
            setTimeout(() => { graveyardPile.style.boxShadow = ""; graveyardPile.style.transition = ""; }, 400);
        }

        screenFlash("rgba(180,100,255,.08)");
        setTimeout(() => resolve(), 300);
    }, 1500);

    return done;
}

/**
 * 反击型陷阱特写运镜 V3
 * 对方怪兽突进途中→陷阱翻开→屏障挡住→怪兽骤停→陷阱销毁
 * @param trapSlot - 盖放陷阱卡的DOM槽位
 * @param trapCard - 陷阱卡数据
 * @param attackerSlot - 正在攻击的对方怪兽DOM槽位
 * @param attackerCard - 攻击怪兽数据
 */
export function playCounterTrapV3(trapSlot, trapCard, attackerSlot = null, attackerCard = null) {
    if (!isBrowser || !trapSlot || !trapCard) return Promise.resolve();

    const container = document.querySelector(".battle-screen") || document.body;
    const battlefield = document.querySelector(".battlefield");
    const slotRect = getRect(trapSlot);

    let resolve;
    const done = new Promise(r => { resolve = r; });

    // 全屏暗紫底光
    const overlay = document.createElement("div");
    overlay.className = "trap-purple-overlay";
    container.appendChild(overlay);
    removeAfter(overlay, 1500);

    // 阶段1：镜头猛地切向后场 (0-200ms)
    if (battlefield) {
        battlefield.style.transition = "transform 0.15s ease-in";
        battlefield.style.transform = `translateX(-50%) translateY(${-(slotRect.top - window.innerHeight * 0.35)}px) scale(1.08)`;
    }

    // 阶段2：陷阱卡翻开 (200-500ms)
    setTimeout(() => {
        trapSlot.classList.add("trap-flip-launch");
        setTimeout(() => trapSlot.classList.remove("trap-flip-launch"), 550);

        // 翻开闪光
        const flash = document.createElement("div");
        flash.style.cssText = `position:fixed; left:${slotRect.left + slotRect.width/2}px; top:${slotRect.top + slotRect.height/2}px; width:0; height:0; z-index:265; background:radial-gradient(circle, rgba(180,100,255,.6), transparent 70%); border-radius:50%; transform:translate(-50%,-50%); animation:mirrorFlash .4s ease-out forwards;`;
        container.appendChild(flash);
        removeAfter(flash, 500);
    }, 200);

    // 阶段3：屏障特效挡在怪兽前 (500-800ms)
    setTimeout(() => {
        if (attackerSlot) {
            const atkRect = getRect(attackerSlot);
            const barrier = document.createElement("div");
            barrier.className = "trap-counter-barrier";
            barrier.style.cssText = `position:fixed; left:${atkRect.left + atkRect.width/2}px; top:${atkRect.top - 20}px; transform:translate(-50%,-50%);`;
            container.appendChild(barrier);
            removeAfter(barrier, 1300);

            // 怪兽骤停+后退
            if (attackerSlot) {
                attackerSlot.style.transition = "transform 0.15s ease-out";
                attackerSlot.style.transform = "translateY(5px) scale(0.95)";
                setTimeout(() => {
                    attackerSlot.style.transition = "transform 0.3s cubic-bezier(.25,.8,.25,1)";
                    attackerSlot.style.transform = "";
                }, 200);
            }
        }

        // 镜头左右微晃
        if (battlefield) {
            battlefield.classList.add("camera-shake-micro");
            setTimeout(() => battlefield.classList.remove("camera-shake-micro"), 300);
        }

        screenFlash("rgba(180,100,255,.15)");
    }, 500);

    // 阶段4：镜头回弹+陷阱销毁 (1000-1600ms)
    setTimeout(() => {
        if (battlefield) {
            battlefield.style.transition = "transform 0.5s cubic-bezier(.25,.8,.25,1)";
            battlefield.style.transform = "translateX(-50%)";
        }

        // 陷阱碎裂入墓
        const shatter = document.createElement("div");
        shatter.className = "mirror-shatter";
        shatter.style.cssText = `position:fixed; left:${slotRect.left}px; top:${slotRect.top}px; width:${slotRect.width}px; height:${slotRect.height}px; z-index:265;`;
        const crack = document.createElement("div");
        crack.className = "mirror-crack";
        crack.style.cssText = `--a1:${20 + Math.random() * 40}deg; --a2:${100 + Math.random() * 60}deg; --a3:${200 + Math.random() * 40}deg;`;
        shatter.appendChild(crack);
        for (let i = 0; i < 10; i++) {
            const shard = document.createElement("div");
            shard.className = "mirror-shard";
            const angle = (i / 10) * Math.PI * 2;
            const dist = 25 + Math.random() * 35;
            shard.style.cssText = `left:${20 + Math.random() * 60}%; top:${20 + Math.random() * 60}%; width:${8 + Math.random() * 12}px; height:${10 + Math.random() * 14}px; --sx:${Math.cos(angle) * dist}px; --sy:${Math.sin(angle) * dist}px; --sr:${(Math.random()-0.5)*360}deg; clip-path:polygon(${Math.random()*30}% 0%, 100% ${Math.random()*30}%, ${70+Math.random()*30}% 100%, 0% ${70+Math.random()*30}%); animation-delay:${Math.random() * 0.04}s;`;
            shatter.appendChild(shard);
        }
        container.appendChild(shatter);
        removeAfter(shatter, 700);

        // 陷阱槽位清空
        setTimeout(() => { trapSlot.innerHTML = `<div class="field-slot empty spell-trap-slot" data-owner="${trapSlot.dataset.owner}" data-zone="spell-trap"></div>`; }, 300);

        setTimeout(() => resolve(), 400);
    }, 1000);

    return done;
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
 * 破坏怪兽特效（增强版：卡牌镜像破碎）
 */
export function playDestroyEffectV2(fieldSlot) {
    if (!isBrowser || !fieldSlot) return;
    const card = fieldSlot.querySelector(".card");
    if (!card) return;

    // 卡牌镜像破碎容器
    const shatter = document.createElement("div");
    shatter.className = "mirror-shatter";

    // 裂纹线（3条交叉）
    const crack = document.createElement("div");
    crack.className = "mirror-crack";
    crack.style.cssText = `--a1:${30 + Math.random() * 30}deg; --a2:${120 + Math.random() * 40}deg; --a3:${200 + Math.random() * 30}deg;`;
    shatter.appendChild(crack);

    // 中心闪光
    const flash = document.createElement("div");
    flash.className = "mirror-flash";
    shatter.appendChild(flash);

    // 碎片（12-16块不规则镜面碎片）
    const shardCount = 12 + Math.floor(Math.random() * 5);
    for (let i = 0; i < shardCount; i++) {
        const shard = document.createElement("div");
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
