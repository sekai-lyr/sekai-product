const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

function prefersReducedMotion() {
    return reduceMotionQuery.matches;
}

function setupPageMotion() {
    const targets = Array.from(document.querySelectorAll([
        "main.dashboard > section",
        ".panel",
        ".stats-grid > div",
        ".character-card",
        ".history-row",
        ".recommend-card",
        ".achievement-card",
        ".wheel-panel"
    ].join(",")));

    targets.forEach((target, index) => {
        target.classList.add("motion-target");
        target.style.setProperty("--reveal-delay", `${Math.min(index % 5, 4) * 55}ms`);
    });

    if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
        document.body.classList.add("motion-reduced");
        targets.forEach((target) => target.classList.add("is-visible"));
        return;
    }

    document.body.classList.add("motion-ready");
    const observer = new IntersectionObserver((entries, currentObserver) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) {
                return;
            }
            entry.target.classList.add("is-visible");
            currentObserver.unobserve(entry.target);
        });
    }, { threshold: 0.14, rootMargin: "0px 0px -8%" });

    targets.forEach((target) => observer.observe(target));
}

function setupButtonRipples() {
    document.addEventListener("pointerdown", (event) => {
        const host = event.target.closest("button, a.soft-link, a.primary-btn, a.secondary-btn");
        if (!host || host.disabled || prefersReducedMotion()) {
            return;
        }
        const bounds = host.getBoundingClientRect();
        const ripple = document.createElement("span");
        ripple.className = "ui-ripple";
        ripple.style.left = `${event.clientX - bounds.left}px`;
        ripple.style.top = `${event.clientY - bounds.top}px`;
        host.classList.add("ripple-host");
        host.appendChild(ripple);
        ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
    });
}

function animateResultEntry() {
    if (!resultStage || prefersReducedMotion()) {
        return;
    }
    const targets = resultStage.querySelectorAll(
        ".result-image img, .result-heading, .fortune-box, .lucky-row, .result-actions, .ritual-summary, .ritual-step, .ritual-advice"
    );
    targets.forEach((target, index) => {
        target.animate(
            [
                { opacity: 0, transform: "translateY(14px)" },
                { opacity: 1, transform: "translateY(0)" }
            ],
            {
                duration: 520,
                delay: index * 55,
                easing: "cubic-bezier(0.16, 1, 0.3, 1)",
                fill: "both"
            }
        );
    });
}

function showResultLoading(label) {
    if (!resultStage) {
        return;
    }
    resultStage.setAttribute("aria-busy", "true");
    resultStage.innerHTML = `
        <article class="result-card result-loading" role="status" aria-live="polite">
            <div class="result-image skeleton-block"></div>
            <div class="result-body">
                <span class="skeleton-line short"></span>
                <span class="skeleton-line title"></span>
                <span class="skeleton-line"></span>
                <div class="skeleton-box"></div>
                <span class="loading-caption">${escapeDrawText(label)}...</span>
            </div>
        </article>`;
}

function escapeDrawText(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

const drawButton = document.querySelector("#drawButton");
const dailyButton = document.querySelector("#dailyButton");
const ritualButton = document.querySelector("#ritualButton");
const resultStage = document.querySelector("#resultStage");
const wishTopicInput = document.querySelector("#wishTopic");
const focusSelect = document.querySelector("#focusSelect");
let drawEffectTimer;
let selectedMood = "平静";

document.querySelectorAll(".mood").forEach((button) => {
    button.addEventListener("click", () => {
        document.querySelectorAll(".mood").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        selectedMood = button.dataset.mood;
    });
});

async function requestDraw(endpoint, button, loadingText, doneText) {
    if (!button || !resultStage) {
        return;
    }
    button.disabled = true;
    button.classList.add("is-loading");
    const originalText = button.textContent;
    button.textContent = loadingText;
    showResultLoading(loadingText);
    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                mood: selectedMood,
                wishTopic: wishTopicInput?.value || "",
                focus: focusSelect?.value || ""
            })
        });
        const result = await response.json();
        if (!result.success) {
            resultStage.innerHTML = renderDrawFailure(result.message);
            resultStage.setAttribute("aria-busy", "false");
            return;
        }
        renderRecord(result.data);
    } catch (error) {
        resultStage.innerHTML = renderDrawFailure("抽签连接失败，请稍后再试");
        resultStage.setAttribute("aria-busy", "false");
    } finally {
        button.disabled = false;
        button.classList.remove("is-loading");
        button.textContent = doneText || originalText;
    }
}

async function requestRitual() {
    if (!ritualButton || !resultStage) {
        return;
    }
    ritualButton.disabled = true;
    ritualButton.classList.add("is-loading");
    ritualButton.textContent = "仪式展开中";
    showResultLoading("仪式展开中");
    try {
        const response = await fetch("/draw/ritual", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                mood: selectedMood,
                wishTopic: wishTopicInput?.value || "",
                focus: focusSelect?.value || ""
            })
        });
        const result = await response.json();
        if (!result.success) {
            resultStage.innerHTML = renderDrawFailure(result.message);
            resultStage.setAttribute("aria-busy", "false");
            return;
        }
        renderRitual(result.data);
    } catch (error) {
        resultStage.innerHTML = renderDrawFailure("仪式连接失败，请稍后再试");
        resultStage.setAttribute("aria-busy", "false");
    } finally {
        ritualButton.disabled = false;
        ritualButton.classList.remove("is-loading");
        ritualButton.textContent = "三连签仪式";
    }
}

function renderRecord(record) {
    const imageUrl = `/character/image/${record.character.id}?v=${Date.now()}`;
    const dailyBadge = record.wishTopic === "每日固定签" ? `<span class="daily-badge">今日固定签</span>` : "";
    const characterName = record.character.displayName || record.character.englishName || "守护伙伴";
    const animeTitle = record.character.japaneseName || record.character.displayAnimeTitle || record.character.animeTitle || "";
    resultStage.innerHTML = `
                <article class="result-card">
                    <div class="result-image">
                        <img src="${imageUrl}" alt="${characterName}">
                    </div>
                    <div class="result-body">
                        <div class="result-heading">
                            <span class="result-label">今日守护伙伴</span>
                            ${dailyBadge}
                            <h2>${characterName}</h2>
                            <p>${animeTitle}</p>
                        </div>
                        <div class="fortune-box">
                            <div class="fortune-topline">
                                <span class="score">${record.fortune.levelName} / ${record.luckScore}</span>
                                <strong>${record.fortune.title}</strong>
                            </div>
                            <p>${record.message || record.fortune.advice}</p>
                            <p>${record.fortune.advice}</p>
                        </div>
                        <div class="lucky-row">
                            <span>幸运色：${record.fortune.luckyColor}</span>
                            <span>幸运物：${record.fortune.luckyItem}</span>
                        </div>
                        <div class="result-actions">
                            <a href="/characters/${record.character.id}">查看伙伴详情</a>
                            <button class="favorite-toggle" type="button" data-id="${record.character.id}">收藏伙伴</button>
                            <button class="share-card-button" type="button" data-record-id="${record.id}">生成分享卡</button>
                        </div>
                    </div>
                </article>`;
    resultStage.setAttribute("aria-busy", "false");
    animateResultEntry();
    playDrawScreenEffect(record.luckScore);
}

function renderDrawFailure(message) {
    const safeMessage = escapeDrawText(message || "操作失败");
    return `<div class="empty-state" role="alert"><span>!</span><p>${safeMessage}</p></div>`;
}

function renderRitual(ritual) {
    const cards = ritual.cards || [];
    resultStage.innerHTML = `
        <article class="ritual-card">
            <div class="ritual-summary">
                <span class="result-label">三连签仪式</span>
                <h2>${ritual.rhythm} / ${ritual.overallScore}</h2>
                <p>${ritual.summary}</p>
            </div>
            <div class="ritual-path">
                ${cards.map((card) => renderRitualCard(card)).join("")}
            </div>
            <div class="fortune-box ritual-advice">
                <div class="fortune-topline">
                    <span class="score">${ritual.luckyColor}</span>
                    <strong>${ritual.luckyItem}</strong>
                </div>
                <p>${ritual.actionPlan}</p>
            </div>
        </article>`;
    resultStage.setAttribute("aria-busy", "false");
    animateResultEntry();
    playDrawScreenEffect(ritual.overallScore);
}

function playDrawScreenEffect(score) {
    if (!resultStage) {
        return;
    }
    if (prefersReducedMotion()) {
        return;
    }
    clearTimeout(drawEffectTimer);
    document.body.classList.remove("draw-effect-active", "draw-effect-gold", "draw-effect-cool", "draw-effect-warm");
    void document.body.offsetWidth;
    const numericScore = Number(score) || 0;
    const tone = numericScore >= 86 ? "draw-effect-gold" : numericScore >= 72 ? "draw-effect-cool" : "draw-effect-warm";
    document.body.classList.add("draw-effect-active", tone);

    const burst = document.createElement("div");
    burst.className = "draw-result-burst";
    burst.setAttribute("aria-hidden", "true");
    burst.innerHTML = Array.from({ length: 18 }, (_, index) => `<i style="--i:${index}"></i>`).join("");
    resultStage.appendChild(burst);

    drawEffectTimer = window.setTimeout(() => {
        document.body.classList.remove("draw-effect-active", "draw-effect-gold", "draw-effect-cool", "draw-effect-warm");
        burst.remove();
    }, 2800);
}
function renderRitualCard(card) {
    const record = card.record;
    const character = record.character;
    const characterName = character.displayName || character.englishName || "守护伙伴";
    return `
        <section class="ritual-step">
            <img src="/character/image/${character.id}?v=${Date.now()}" alt="${characterName}">
            <div>
                <span>${card.position} · ${card.theme}</span>
                <h3>${characterName}</h3>
                <p>${record.fortune.title} / ${record.luckScore}</p>
                <a href="/characters/${character.id}">详情</a>
                <button class="favorite-toggle" type="button" data-id="${character.id}">收藏</button>
                <button class="share-card-button" type="button" data-record-id="${record.id}">分享卡</button>
            </div>
        </section>`;
}

if (drawButton) {
    drawButton.addEventListener("click", () => requestDraw("/draw/roll", drawButton, "抽签中", "随机再抽"));
}

if (dailyButton) {
    dailyButton.addEventListener("click", () => requestDraw("/draw/daily", dailyButton, "读取今日签", "今日固定签"));
}

if (ritualButton) {
    ritualButton.addEventListener("click", requestRitual);
}

document.addEventListener("click", async (event) => {
    const shareButton = event.target.closest(".share-card-button");
    if (shareButton) {
        event.preventDefault();
        const recordId = shareButton.dataset.recordId;
        window.open(`/share/records/${recordId}.svg`, "_blank", "noopener");
        return;
    }

    const button = event.target.closest(".favorite-toggle");
    if (!button) {
        return;
    }
    event.preventDefault();
    button.disabled = true;
    try {
        const response = await fetch(`/characters/${button.dataset.id}/favorite`, { method: "POST" });
        const result = await response.json();
        if (result.success) {
            button.textContent = result.data ? "已收藏" : "收藏伙伴";
        } else {
            button.textContent = result.message || "操作失败";
        }
    } finally {
        button.disabled = false;
    }
});

setupPageMotion();
setupButtonRipples();
