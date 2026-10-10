const wheelCanvas = document.querySelector("#taskWheel");
const spinButton = document.querySelector("#wheelSpinButton");
const wheelResult = document.querySelector("#wheelResult");
const wheelOptions = Array.isArray(window.sekaiWheelOptions) ? window.sekaiWheelOptions : [];
const wheelState = {
    rotation: 0,
    spinning: false,
    slices: []
};
const wheelReduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function drawWheel() {
    if (!wheelCanvas) {
        return;
    }
    const ctx = wheelCanvas.getContext("2d");
    const size = wheelCanvas.width;
    const center = size / 2;
    const radius = center - 12;
    ctx.clearRect(0, 0, size, size);

    if (!wheelOptions.length) {
        ctx.fillStyle = "#eef4ff";
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#475467";
        ctx.font = "900 28px Microsoft YaHei, Arial";
        ctx.textAlign = "center";
        ctx.fillText("先添加分区", center, center);
        return;
    }

    const totalWeight = wheelOptions.reduce((sum, option) => sum + Math.max(1, Number(option.weight) || 1), 0);
    let start = -Math.PI / 2;
    wheelState.slices = [];

    wheelOptions.forEach((option, index) => {
        const weight = Math.max(1, Number(option.weight) || 1);
        const angle = Math.PI * 2 * weight / totalWeight;
        const end = start + angle;
        const mid = start + angle / 2;
        wheelState.slices.push({
            id: Number(option.id),
            start,
            end,
            centerDeg: mid * 180 / Math.PI
        });

        ctx.beginPath();
        ctx.moveTo(center, center);
        ctx.arc(center, center, radius, start, end);
        ctx.closePath();
        ctx.fillStyle = option.color || defaultColor(index);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.78)";
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.save();
        ctx.translate(center, center);
        ctx.rotate(mid);
        ctx.textAlign = "right";
        ctx.fillStyle = "#111827";
        ctx.font = "900 20px Microsoft YaHei, Arial";
        ctx.fillText(truncate(option.title || "任务", 9), radius - 24, 8);
        ctx.restore();

        start = end;
    });

    ctx.beginPath();
    ctx.arc(center, center, 64, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "rgba(15,23,42,.12)";
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = "#172033";
    ctx.font = "900 23px Microsoft YaHei, Arial";
    ctx.textAlign = "center";
    ctx.fillText("SEKAI", center, center + 8);
}

async function spinWheel() {
    if (!spinButton || wheelState.spinning) {
        return;
    }
    wheelState.spinning = true;
    spinButton.disabled = true;
    spinButton.textContent = "世界线收束中";
    document.body.classList.add("wheel-spinning");
    wheelResult?.setAttribute("aria-busy", "true");
    try {
        const response = await fetch("/wheel/spin", { method: "POST" });
        const result = await response.json();
        if (!result.success) {
            renderFailure(result.message || "转盘失败");
            finishSpin("转动命运");
            return;
        }
        const option = result.data.option;
        const slice = wheelState.slices.find((item) => item.id === Number(option.id));
        const centerDeg = slice ? slice.centerDeg : -90;
        const turns = 6 + Math.floor(Math.random() * 3);
        const targetRotation = turns * 360 + (-90 - centerDeg);
        if (!wheelReduceMotion.matches) {
            wheelState.rotation += targetRotation;
            wheelCanvas.style.transform = `rotate(${wheelState.rotation}deg)`;
        }
        window.setTimeout(() => {
            renderResult(result.data);
            finishSpin("再转一次");
        }, wheelReduceMotion.matches ? 80 : 4300);
    } catch (error) {
        renderFailure("转盘连接失败，请稍后再试");
        finishSpin("转动命运");
    }
}

function finishSpin(buttonText) {
    wheelState.spinning = false;
    spinButton.disabled = false;
    spinButton.textContent = buttonText;
    document.body.classList.remove("wheel-spinning");
    wheelResult?.setAttribute("aria-busy", "false");
}

function renderResult(data) {
    if (!wheelResult) {
        return;
    }
    const option = data.option || {};
    const record = data.record || {};
    wheelResult.innerHTML = `
        <span>命运指针指向</span>
        <h2>${escapeHtml(option.title || "今日任务")}</h2>
        <p>${escapeHtml(option.detail || data.line || "先从这件事开始。")}</p>
        <small>${escapeHtml(record.moodLine || data.line || "主角请入场。")}</small>`;
    wheelResult.style.setProperty("--swatch", option.color || "#78e08f");
    wheelResult.classList.remove("is-revealing");
    void wheelResult.offsetWidth;
    wheelResult.classList.add("is-revealing");
}

function renderFailure(message) {
    if (!wheelResult) {
        return;
    }
    wheelResult.innerHTML = `<span>转盘卡住了</span><h2>!</h2><p>${escapeHtml(message)}</p>`;
    wheelResult.setAttribute("aria-busy", "false");
}

function truncate(value, limit) {
    return value.length > limit ? `${value.slice(0, limit)}…` : value;
}

function defaultColor(index) {
    const colors = ["#78e08f", "#ffe08a", "#ff8fc7", "#78d5ff", "#a7a3ff", "#ffb86b"];
    return colors[index % colors.length];
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

drawWheel();

if (spinButton) {
    spinButton.addEventListener("click", spinWheel);
}
