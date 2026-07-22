const drawButton = document.querySelector("#drawButton");
const dailyButton = document.querySelector("#dailyButton");
const ritualButton = document.querySelector("#ritualButton");
const resultStage = document.querySelector("#resultStage");
const wishTopicInput = document.querySelector("#wishTopic");
const focusSelect = document.querySelector("#focusSelect");
const dashboard = document.querySelector(".dashboard");
const premiumActive = dashboard?.dataset.premium === "true";
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
    const originalText = button.textContent;
    button.textContent = loadingText;
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
            resultStage.innerHTML = renderFailure(result.message);
            return;
        }
        renderRecord(result.data);
    } finally {
        button.disabled = false;
        button.textContent = doneText || originalText;
    }
}

async function requestRitual() {
    if (!ritualButton || !resultStage) {
        return;
    }
    ritualButton.disabled = true;
    ritualButton.textContent = "仪式展开中";
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
            resultStage.innerHTML = renderFailure(result.message);
            return;
        }
        renderRitual(result.data);
    } finally {
        ritualButton.disabled = false;
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
    playDrawScreenEffect(record.luckScore);
}

function renderFailure(message) {
    const payLink = String(message || "").includes("会员")
        ? `<a class="paywall-link" href="/membership">开通会员</a>`
        : "";
    return `<div class="empty-state"><span>!</span><p>${message || "操作失败"}</p>${payLink}</div>`;
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
    playDrawScreenEffect(ritual.overallScore);
}

function playDrawScreenEffect(score) {
    if (!resultStage) {
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
        if (!premiumActive) {
            window.location.href = "/membership?locked=share";
            return;
        }
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
