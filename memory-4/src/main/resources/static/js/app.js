const moodMessages = {
    "平静": "不必急着赶往下一站。留一点时间，感受此刻的风。",
    "燃": "把这份热情留给你在乎的事。今天，先勇敢迈出一小步。",
    "想摆烂": "累了就歇一会儿。你的价值，不需要靠一直努力来证明。",
    "需要灵感": "暂时放下答案，看看窗外。新的可能，也许正在慢慢靠近。",
    "有点焦虑": "先慢慢呼一口气。你可以只处理眼前的一件小事。",
    "有点孤单": "想被理解，是很自然的事。愿这次相遇，给你一点暖意。"
};
const resultStage = document.querySelector("#resultStage");
const drawStatus = document.querySelector("#drawStatus");
const drawButtons = Array.from(document.querySelectorAll("#dailyButton, #drawButton, #ritualButton"));
let selectedMood = "平静";
let drawPending = false;
function escapeDrawText(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
const e = escapeDrawText;
function numericId(value) { return Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : 0; }
function status(message, error = false) {
    const target = drawStatus || document.querySelector("#pageFeedback") || (() => {
        const node = document.createElement("p"); node.id = "pageFeedback"; node.setAttribute("role", "status"); node.setAttribute("aria-live", "polite");
        document.querySelector("main")?.prepend(node); return node;
    })();
    target.textContent = message;
    target.className = drawStatus ? `inline-status${error ? " error" : ""}` : `notice${error ? " error" : ""}`;
}
function animateResultEntry() {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) resultStage?.firstElementChild?.animate(
        [{ opacity: .65, transform: "translateY(10px)" }, { opacity: 1, transform: "translateY(0)" }],
        { duration: 380, easing: "cubic-bezier(.16,1,.3,1)" });
}
function recordActions(record) {
    return `<div class="result-actions"><a href="/characters/${numericId(record.character.id)}">查看伙伴详情</a><button type="button" class="favorite-toggle" data-id="${numericId(record.character.id)}">${record.favorited ? "取消收藏" : "收藏伙伴"}</button><a href="/share/records/${numericId(record.id)}">制作分享卡</a></div>`;
}
function renderRecord(record, animate = true) {
    const name = record.character.displayName || record.character.englishName;
    const message = record.message || "";
    resultStage.innerHTML = `<article class="result-card"><div class="result-image"><img src="/character/image/${numericId(record.character.id)}" alt="${e(name)}"></div><div class="result-body"><div class="result-heading"><span class="result-label">今日守护伙伴</span>${record.drawType === "DAILY" ? '<span class="daily-badge">今日固定签</span>' : ""}<h2>${e(name)}</h2><p>${e(record.character.displayAnimeTitle || record.character.animeTitle)}</p></div><div class="fortune-box"><div class="fortune-topline"><span class="score">${e(record.fortune.levelName)} · ${e(record.luckScore)}</span><strong>${e(record.fortune.title)}</strong></div>${message && message !== record.fortune.advice ? `<p>${e(message)}</p>` : ""}<p>${e(record.fortune.advice)}</p></div><div class="lucky-row"><span>幸运色：${e(record.fortune.luckyColor)}</span><span>幸运物：${e(record.fortune.luckyItem)}</span></div><aside class="healing-note"><strong>留给此刻的你</strong><p>${e(moodMessages[record.mood] || moodMessages["平静"])}</p></aside>${recordActions(record)}</div></article>`;
    if (animate) animateResultEntry();
}
function renderRitual(ritual) {
    resultStage.innerHTML = `<article class="ritual-card"><div class="ritual-summary"><span class="result-label">三连签仪式</span><h2>${e(ritual.rhythm)} · ${e(ritual.overallScore)}</h2><p>${e(ritual.summary)}</p></div><div class="ritual-path">${(ritual.cards || []).map(card => {
        const record = card.record;
        return `<section class="ritual-step"><img src="/character/image/${numericId(record.character.id)}" alt=""><div><span>${e(card.position)} · ${e(card.theme)}</span><h3>${e(record.character.displayName || record.character.englishName)}</h3><p>${e(record.fortune.title)} · ${e(record.luckScore)}</p>${recordActions(record)}</div></section>`;
    }).join("")}</div><div class="fortune-box ritual-advice"><strong>下一步，可以这样做</strong><p>${e(ritual.actionPlan)}</p></div></article>`;
    animateResultEntry();
}
async function refreshDashboard() {
    if (!document.querySelector("[data-stat]")) return;
    try {
        const data = await (await apiFetch("/api/dashboard")).json();
        document.querySelectorAll("[data-stat]").forEach(node => node.textContent = data.stats[node.dataset.stat] ?? 0);
        const recent = document.querySelector("#recentRecords");
        if (recent) recent.innerHTML = data.recentRecords.map(record => `<article class="record"><img src="/character/image/${numericId(record.character.id)}" alt="" loading="lazy"><div><strong>${e(record.character.displayName)}</strong><span>${e(record.fortune.title)} · ${e(record.luckScore)}</span></div></article>`).join("");
        const achievements = document.querySelector("#achievementGrid");
        if (achievements) achievements.innerHTML = data.achievements.map(a => `<article class="achievement-card${a.unlocked ? " unlocked" : ""}"><div class="achievement-topline"><span>${a.unlocked ? "已点亮" : "正在靠近"}</span><strong>${e(a.progress)}/${e(a.target)}</strong></div><h3>${e(a.title)}</h3><p>${e(a.description)}</p><div class="achievement-progress"><span style="width:${Math.max(0, Math.min(100, Number(a.progressPercent) || 0))}%"></span></div><small>${e(a.unlocked ? "这次相遇已被记住" : a.hint)}</small></article>`).join("");
    } catch (_) { status("结果已保存，统计暂时未更新。刷新页面可查看最新记录。", true); }
}
async function requestDraw(button, endpoint, ritual = false) {
    if (drawPending || !resultStage) return;
    drawPending = true;
    drawButtons.forEach(node => node.disabled = true);
    resultStage.setAttribute("aria-busy", "true"); resultStage.classList.add("request-pending");
    const original = button.textContent; button.textContent = ritual ? "仪式展开中…" : "正在与你相遇…";
    status("正在读取签文，请稍候。上一张结果会保留到新签揭晓。");
    try {
        const response = await apiFetch(endpoint, { method: "POST", body: new URLSearchParams({ mood: selectedMood, wishTopic: document.querySelector("#wishTopic")?.value || "", focus: document.querySelector("#focusSelect")?.value || "" }) });
        const result = await response.json();
        if (!result.success) throw new Error(result.message || "抽签暂时失败");
        if (ritual) renderRitual(result.data); else renderRecord(result.data);
        status(ritual ? "三张签已揭晓，也已保存到相遇日历。" : `与${result.data.character.displayName || result.data.character.englishName}相遇，记录已保存。`);
        await refreshDashboard();
    } catch (error) {
        status(error.name === "TimeoutError" ? "等待超时。上一张签仍在，请先查看日历确认本次是否已保存。" : `${error.message || "连接失败"}。可以重试，上一张结果已保留。`, true);
    } finally {
        drawPending = false; drawButtons.forEach(node => node.disabled = false);
        resultStage.setAttribute("aria-busy", "false"); resultStage.classList.remove("request-pending"); button.textContent = original;
    }
}
for (const button of document.querySelectorAll(".mood")) button.addEventListener("click", () => {
    selectedMood = button.dataset.mood;
    document.querySelectorAll(".mood").forEach(node => { node.classList.toggle("active", node === button); node.setAttribute("aria-pressed", String(node === button)); });
});
for (const [id, endpoint, ritual] of [["dailyButton", "/draw/daily", false], ["drawButton", "/draw/roll", false], ["ritualButton", "/draw/ritual", true]]) {
    const button = document.getElementById(id); button?.addEventListener("click", () => requestDraw(button, endpoint, ritual));
}
document.addEventListener("click", async event => {
    const button = event.target.closest(".favorite-toggle");
    if (!button || button.disabled) return;
    event.preventDefault(); button.disabled = true;
    try {
        const result = await (await apiFetch(`/characters/${numericId(button.dataset.id)}/favorite`, { method: "POST" })).json();
        if (!result.success) throw new Error(result.message);
        document.querySelectorAll(`.favorite-toggle[data-id="${numericId(button.dataset.id)}"]`).forEach(node => node.textContent = result.data ? "取消收藏" : "收藏伙伴");
        status(result.data ? "已收藏这位伙伴。" : "已取消收藏。"); await refreshDashboard();
    } catch (error) { status(`${error.message || "收藏未成功"}，请点击原按钮重试。`, true); }
    finally { button.disabled = false; }
});
if (resultStage && window.sekaiTodayRecord) renderRecord(window.sekaiTodayRecord, false);
const initialWish = new URLSearchParams(location.search).get("wish");
if (initialWish && document.querySelector("#wishTopic")) { document.querySelector("#wishTopic").value = initialWish.slice(0, 40); document.querySelector(".draw-preferences").open = true; }
