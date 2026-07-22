// Live2D Kanban - Interactive System
var app, currentModel, bubbleTimer, idleTimer, lastInteraction = Date.now();
var models2D = [], currentModelName = "", charId = 1;
var isDragging = false, dragStart = { x:0, y:0 }, modelStart = { x:0, y:0 }, tapCooldown = false;
var affection = 0;
var mousePos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
var followActive = true, lastExpression = "";
var isAiThinking = false;

function getTimeGreeting() {
    var h = new Date().getHours();
    if (h >= 5 && h < 9) return ["早上好呀~今天也要加油哦！", "早安！新的一天开始啦~", "早上好主人，睡得好吗？"][Math.floor(Math.random() * 3)];
    if (h >= 9 && h < 12) return ["上午好~有什么需要帮忙的吗？", "今天天气真不错呢~", "精神满满的一天开始啦！"][Math.floor(Math.random() * 3)];
    if (h >= 12 && h < 14) return ["中午好~该吃午饭啦！", "肚子饿了吗？一起去吃饭吧~", "午休时间到~"][Math.floor(Math.random() * 3)];
    if (h >= 14 && h < 18) return ["下午好~要加油工作哦！", "下午茶时间到了呢~", "阳光正好的下午~"][Math.floor(Math.random() * 3)];
    if (h >= 18 && h < 21) return ["晚上好~辛苦了一天呢！", "晚饭吃了什么呀？", "夜幕降临，放松一下吧~"][Math.floor(Math.random() * 3)];
    if (h >= 21 && h < 24) return ["夜深了，要早点休息哦~", "这么晚还不睡吗？", "熬夜对身体不好哦~"][Math.floor(Math.random() * 3)];
    return ["你好呀~很高兴见到你！", "欢迎回来~", "嘿！好久不见~"][Math.floor(Math.random() * 3)];
}

// --- Character Stats ---
var charStats = { level:1, exp:0, expToNext:100, hp:100, atk:20, def:10, freePoints:0 };
var _statsListeners = [];
function onStatsChange(fn) { _statsListeners.push(fn); }
function emitStatsChange() { _statsListeners.forEach(function(f) { try { f(charStats); } catch(e) {} }); }

function updateStatsUI() {
    document.getElementById("s-level").textContent = charStats.level;
    document.getElementById("s-hp").textContent = charStats.hp;
    document.getElementById("s-atk").textContent = charStats.atk;
    document.getElementById("s-def").textContent = charStats.def;
    document.getElementById("free-pts").textContent = charStats.freePoints;
    document.getElementById("aff-val").textContent = affection;
    var pct = charStats.expToNext > 0 ? (charStats.exp / charStats.expToNext * 100) : 100;
    document.getElementById("exp-bar-fill").style.width = pct + "%";
    document.getElementById("exp-text").textContent = "EXP " + charStats.exp + " / " + charStats.expToNext;
    ["btn-hp","btn-atk","btn-def"].forEach(function(id) {
        document.getElementById(id).disabled = charStats.freePoints <= 0;
    });
}
onStatsChange(updateStatsUI);

// --- Toast ---
function toast(msg) {
    var t = document.createElement("div"); t.className = "toast-msg"; t.textContent = msg;
    document.getElementById("toast-area").appendChild(t);
    setTimeout(function() { t.remove(); }, 2200);
}
function log(msg) { document.getElementById("status-text").textContent = msg; }

// --- Greetings list ---
var greetings = [
    "你好呀！今天心情怎么样？",
    "主人你来啦~",
    "好无聊啊，陪我玩一会儿吧！",
    "看板娘Haru为您服务~",
    "有什么有趣的事情发生吗？"
];

// --- Dialog panel ---
function showDialog(x, y) {
    hideDialog();
    var d = document.createElement("div");
    d.id = "dialog-panel";
    d.innerHTML = '<div class="dlg-item" onclick="doTrain()">⚔️ 训练</div>';
    d.style.left = Math.min(x, window.innerWidth - 160) + "px";
    d.style.top = Math.min(y, window.innerHeight - 160) + "px";
    document.body.appendChild(d);
    setTimeout(function() {
        document.addEventListener("click", closeDialogOutside);
    }, 50);
}
function hideDialog() {
    var d = document.getElementById("dialog-panel");
    if (d) d.remove();
    document.removeEventListener("click", closeDialogOutside);
}
function closeDialogOutside(e) {
    var d = document.getElementById("dialog-panel");
    if (d && !d.contains(e.target)) hideDialog();
}

// --- Interactions ---
function doTrain() {
    hideDialog();
    gainExp(10);
    affection += 2;
    saveAffection();
    if (!tapCooldown) { tapCooldown = true; setTimeout(function() { tapCooldown = false; }, 800); try { currentModel.motion("Tap"); } catch(e) {} }
    showBubble("训练辛苦了！EXP +10 ♥+2 ✨");
    showFloatText("+10 EXP +2 ♥", "#ffcc44");
    lastInteraction = Date.now();
}

function showFloatText(txt, color) {
    var el = document.createElement("div");
    el.className = "float-text";
    el.textContent = txt;
    el.style.color = color || "#ffcc44";
    el.style.left = (window.innerWidth / 2 + 40) + "px";
    el.style.top = (window.innerHeight * 0.35) + "px";
    document.body.appendChild(el);
    setTimeout(function() { el.remove(); }, 1500);
}

// --- Keyboard shortcuts ---
document.addEventListener("keydown", function(e) {
    if (e.target.tagName === "INPUT" || isAiThinking) return;
    switch(e.code) {
        case "Space":
            e.preventDefault();
            if (tapCooldown || !currentModel) break;
            tapCooldown = true;
            setTimeout(function() { tapCooldown = false; }, 800);
            try { currentModel.motion("Tap"); } catch(_) {}
            showBubble("啊！吓我一跳~");
            break;
        case "KeyE":
            var g = greetings[Math.floor(Math.random() * greetings.length)];
            showBubble(g);
            if (currentModel) try { currentModel.motion("Idle"); } catch(_) {}
            break;
        case "Digit1":
            if (currentModel) try { currentModel.expression("Smile"); } catch(_) {}
            toast("表情: 微笑");
            break;
        case "Digit2":
            if (currentModel) try { currentModel.expression("Sad"); } catch(_) {}
            toast("表情: 悲伤");
            break;
        case "Digit3":
            if (currentModel) try { currentModel.expression("Angry"); } catch(_) {}
            toast("表情: 生气");
            break;
    }
});

// --- Character Stats API ---
async function loadCharStats() {
    try {
        var r = await fetch("/api/char-stats/" + charId);
        var j = await r.json();
        if (j.success && j.data) {
            Object.assign(charStats, j.data);
            if (j.data.affection !== undefined) affection = j.data.affection;
            charStats.expToNext = charStats.level * 100;
            emitStatsChange();
        }
    } catch(e) {}
}

async function saveAffection() {
    try {
        await fetch("/api/char-stats/" + charId + "/affection", {
            method: "POST", headers: {"Content-Type":"application/json"},
            body: JSON.stringify({affection: affection})
        });
    } catch(e) {}
}

async function gainExp(amount) {
    try {
        var r = await fetch("/api/char-stats/" + charId + "/exp", {
            method: "POST", headers: {"Content-Type":"application/json"},
            body: JSON.stringify({amount: amount})
        });
        var j = await r.json();
        if (j.success && j.data) {
            var wasLevel = charStats.level;
            Object.assign(charStats, j.data);
            charStats.expToNext = charStats.level * 100;
            emitStatsChange();
            if (j.data.levelUp) flashLevelUp(j.data.levelsGained || 1);
        }
    } catch(e) {}
}

async function allocPoint(stat) {
    if (charStats.freePoints <= 0) { toast("没有可用属性点了"); return; }
    try {
        var r = await fetch("/api/char-stats/" + charId + "/allocate", {
            method: "POST", headers: {"Content-Type":"application/json"},
            body: JSON.stringify({stat: stat})
        });
        var j = await r.json();
        if (j.success && j.data && j.data.success !== false) {
            Object.assign(charStats, j.data);
            charStats.expToNext = charStats.level * 100;
            emitStatsChange();
            toast(stat + " +1!");
        }
    } catch(e) {}
}

async function resetCharacter() {
    if (!confirm("确定要重置角色到Lv.1吗？所有属性点和经验将被清空。")) return;
    try {
        var r = await fetch("/api/char-stats/" + charId + "/reset", {method:"POST"});
        var j = await r.json();
        if (j.success && j.data) {
            Object.assign(charStats, j.data);
            charStats.expToNext = charStats.level * 100;
            affection = 0;
            emitStatsChange();
            toast("角色已重置！");
        }
    } catch(e) {}
}

function toggleStatsPanel() {
    var p = document.getElementById("stats-panel");
    var b = document.getElementById("stats-toggle");
    p.classList.toggle("collapsed");
    b.textContent = p.classList.contains("collapsed") ? "☰" : "◁";
}

function flashLevelUp(times) {
    var el = document.getElementById("level-up-flash");
    el.textContent = times > 1 ? "LEVEL UP x" + times + "!" : "LEVEL UP!";
    el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
}

// --- Bubble ---
var cannedReplies = [
    "嗯嗯~我在听呢！",
    "原来如此~",
    "好有意思呀！",
    "然后呢然后呢？",
    "真的吗？好厉害！",
    "嘿嘿~我也这么觉得！",
    "说的对呢~",
    "唔...让我想想",
    "是是是~主人说的都对！",
    "好呀好呀~",
    "诶？是这样吗？",
    "哇~好棒！",
    "有点不太懂呢...",
    "今天超开心的！",
    "主人最好了~"
];

function updateBubblePosition() {
    if (!currentModel) return;
    var b = document.getElementById("bubble");
    var headY = null;

    // Strategy 1: Find head position from Cubism model face parts
    try {
        var internal = currentModel.internalModel;
        if (internal && internal._model) {
            var core = internal._model;
            var partIds = core._partIds || [];
            var faceIdx = {};
            var kw = ['FACE', 'HEAD', 'EYE', 'MOUTH', 'NOSE', 'BROW', 'EAR', 'HAIR_FRONT', 'HAIR_SIDE', 'HOHO'];
            for (var i = 0; i < partIds.length; i++) {
                var pid = (typeof partIds[i] === 'string' ? partIds[i] : (partIds[i] != null ? String(partIds[i]) : '')).toUpperCase();
                for (var k = 0; k < kw.length; k++) { if (pid.indexOf(kw[k]) >= 0) { faceIdx[i] = 1; break; } }
            }
            // Also try matching drawable IDs directly (some SDKs expose this at drawable level)
            var dc = typeof core.getDrawableCount === 'function' ? core.getDrawableCount() : 0;
            var totalMin = Infinity, totalMax = -Infinity;
            var faceMax = -Infinity, faceFound = false;
            for (var d = 0; d < dc; d++) {
                var verts = typeof core.getDrawableVertexPositions === 'function' ? core.getDrawableVertexPositions(d) : null;
                if (!verts) continue;
                var pi = typeof core.getDrawablePartIndex === 'function' ? core.getDrawablePartIndex(d) : -1;
                var isFace = faceIdx[pi] ? 1 : 0;
                // Also check drawable ID directly
                if (!isFace) {
                    try {
                        var did = typeof core.getDrawableId === 'function' ? core.getDrawableId(d) : null;
                        if (did) {
                            var ds = (typeof did === 'string' ? did : String(did)).toUpperCase();
                            for (var k2 = 0; k2 < kw.length; k2++) { if (ds.indexOf(kw[k2]) >= 0) { isFace = 1; break; } }
                        }
                    } catch(e2) {}
                }
                for (var j = 1; j < verts.length; j += 2) {
                    var vy = verts[j];
                    if (vy < totalMin) totalMin = vy;
                    if (vy > totalMax) totalMax = vy;
                    if (isFace && vy > faceMax) { faceMax = vy; faceFound = true; }
                }
            }
            if (faceFound && totalMax > totalMin) {
                var mh = currentModel.height;
                var r = (totalMax - faceMax) / (totalMax - totalMin);
                headY = currentModel.y - mh / 2 + r * mh;
            }
        }
    } catch(e) {}

    // Strategy 2: Use currentModel.height with per-model head ratio
    if (headY === null) {
        var mh = currentModel.height;
        if (mh && mh > 0) {
            var ratios = { "haru_ja": 0.35, "hiyori_en": 0.35, "aidang_2": 0.25, "biaoqiang_3": 0.25 };
            headY = currentModel.y - mh * (ratios[currentModelName] || 0.3);
        }
    }

    // Strategy 3: Estimate height from canvas info and scale, then use ratio
    if (headY === null) {
        var knownH = currentModel._knownCanvasH;
        if (knownH && knownH > 0) {
            var estH = knownH * (currentModel.scale ? currentModel.scale.y : (currentModel.scale || 0.15));
            var ratios = { "haru_ja": 0.35, "hiyori_en": 0.35, "aidang_2": 0.25, "biaoqiang_3": 0.25 };
            if (estH > 0) headY = currentModel.y - estH * (ratios[currentModelName] || 0.3);
        }
    }

    // Strategy 4: Hardcoded pixel offsets
    if (headY === null) {
        var off = { "haru_ja": 160, "hiyori_en": 160, "aidang_2": 120, "biaoqiang_3": 120 };
        headY = currentModel.y - (off[currentModelName] || 160);
    }

    b.style.left = currentModel.x + "px";
    b.style.top = (headY - 15) + "px";
}

function showBubble(t) {
    if (bubbleTimer) clearTimeout(bubbleTimer);
    var b = document.getElementById("bubble");
    b.textContent = t; b.classList.add("show");
    updateBubblePosition();
    bubbleTimer = setTimeout(function() { b.classList.remove("show"); }, 3000);
}

// --- Idle ---
function startIdle() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(function() {
        if (!currentModel) { startIdle(); return; }
        if (isAiThinking) { startIdle(); return; }
        if (Date.now() - lastInteraction < 15000) { startIdle(); return; }

        var r = Math.random();

        if (r < 0.1) {
            try {
                var exprs = ["Smile", "Angry", "Sad", "Surprised", "Normal"];
                var pick = exprs[Math.floor(Math.random() * exprs.length)];
                if (pick !== lastExpression) {
                    currentModel.expression(pick);
                    lastExpression = pick;
                    showBubble(["嘿嘿~", "唔...", "嗯？", "...唔"][Math.floor(Math.random() * 4)]);
                }
            } catch(_) {}
        } else if (r < 0.2) {
            showBubble(getTimeGreeting());
            try { currentModel.motion("Idle"); } catch(_) {}
        } else if (r < 0.3) {
            if (followActive) {
                var dx = mousePos.x - currentModel.x;
                var dy = (mousePos.y - 80) - currentModel.y;
                var dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 200) {
                    showBubble(cannedReplies[Math.floor(Math.random() * cannedReplies.length)]);
                }
            } else {
                showBubble(cannedReplies[Math.floor(Math.random() * cannedReplies.length)]);
            }
        } else {
            showBubble(cannedReplies[Math.floor(Math.random() * cannedReplies.length)]);
        }

        if (lastExpression && lastExpression !== "Normal" && Math.random() < 0.3) {
            try { currentModel.expression("Normal"); lastExpression = ""; } catch(_) {}
        }

        startIdle();
    }, 15000 + Math.random() * 25000);
}

// --- Proximity / hover awareness ---
var proximityCheck = null;
function startProximityCheck() {
    if (proximityCheck) clearInterval(proximityCheck);
    proximityCheck = setInterval(function() {
        if (!currentModel || isDragging || isAiThinking) return;
        var dx = mousePos.x - currentModel.x;
        var dy = (mousePos.y - 80) - currentModel.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120 && Date.now() - lastInteraction > 5000) {
            lastInteraction = Date.now();
            showBubble(["嘿嘿，你在看我吗？", "嗯？", "想摸摸我吗？", "一直盯着我看呢~"][Math.floor(Math.random() * 4)]);
            try { currentModel.motion("Tap"); } catch(_) {}
            try {
                if (currentModel.expression && lastExpression !== "Smile") {
                    currentModel.expression("Smile");
                    lastExpression = "Smile";
                    setTimeout(function() {
                        try { currentModel.expression("Normal"); lastExpression = ""; } catch(_) {}
                    }, 2000);
                }
            } catch(_) {}
        }
    }, 3000);
}

// --- Init ---
async function init() {
    log("Starting...");
    var canvas = document.getElementById("live2d-canvas");

    app = new PIXI.Application({
        view: canvas, resizeTo: window, backgroundAlpha: 0,
        antialias: true, resolution: window.devicePixelRatio || 1
    });

    log("Starting Cubism4...");
    try {
        PIXI.live2d.startUpCubism4();
        await PIXI.live2d.cubism4Ready;
        log("Cubism4 ready");
    } catch(e) { log("Cubism4 fail: " + e.message); return; }
    await loadCharStats();
    await loadModelList();

    window.addEventListener("resize", function() {
        if (currentModel) {
            currentModel.x = window.innerWidth / 2;
            currentModel.y = (window.innerHeight - 80) / 2;
            updateBubblePosition();
        }
    });

    document.addEventListener("mousemove", function(e) {
        mousePos.x = e.clientX;
        mousePos.y = e.clientY;
        if (currentModel && followActive && !isDragging) {
            try {
                var nx = e.clientX / window.innerWidth;
                var ny = e.clientY / window.innerHeight;
                if (currentModel.focus) {
                    currentModel.focus.set(nx, ny);
                }
            } catch(_) {}
        }
    });
}

// --- Model loading ---
async function loadModelList() {
    try {
        var r = await fetch("/api/model/2d/list");
        var j = await r.json();
        var sel = document.getElementById("model-select");
        sel.innerHTML = "";
        if (j.success && j.data && j.data.length) {
            models2D = j.data;
            models2D.forEach(function(n) { sel.innerHTML += "<option value=\""+n+"\">"+n+"</option>"; });
            sel.value = models2D[0];
            await switchModel(models2D[0]);
        } else { sel.innerHTML = "<option value=\"\">No models</option>"; log("No models"); }
    } catch(e) { log("Error: "+e.message); }
}

async function reloadModels(selectName) {
    try {
        var r = await fetch("/api/model/2d/list");
        var j = await r.json();
        var sel = document.getElementById("model-select");
        sel.innerHTML = "";
        if (j.success && j.data && j.data.length) {
            models2D = j.data;
            models2D.forEach(function(n) { sel.innerHTML += "<option value=\""+n+"\">"+n+"</option>"; });
            var target = selectName && models2D.indexOf(selectName) >= 0 ? selectName : models2D[0];
            sel.value = target;
            await switchModel(target);
        } else { sel.innerHTML = "<option value=\"\">No models</option>"; log("No models"); }
    } catch(e) { log("Error: "+e.message); }
}

async function switchModel(name) {
    if (!name) return;
    log("Loading "+name+"...");
    if (currentModel) { try { app.stage.removeChild(currentModel); currentModel.destroy(); } catch(e) {} currentModel = null; }
    currentModelName = name;

    var url = "/live2d-models/" + name + "/" + name + ".model3.json";

    try {
        currentModel = await PIXI.live2d.Live2DModel.from(url, { autoInteract: true });
        var modelScales = {
            "haru_ja": 0.15,
            "hiyori_en": 0.15,
            "aidang_2": 0.10,
            "biaoqiang_3": 0.10
        };
        currentModel.scale.set(modelScales[name] || 0.15);
        currentModel.anchor.set(0.5, 0.5);
        currentModel.x = window.innerWidth / 2;
        currentModel.y = (window.innerHeight - 80) / 2;
        currentModel.interactive = true;
        currentModel.cursor = "pointer";

        currentModel.on("pointerdown", function(e) {
            if (isDragging || isAiThinking) return;
            if (tapCooldown) return;
            tapCooldown = true;
            setTimeout(function() { tapCooldown = false; }, 800);
            lastInteraction = Date.now();
            try { currentModel.motion("Tap"); } catch(_) {}
            showBubble(cannedReplies[Math.floor(Math.random() * cannedReplies.length)]);
            showDialog(e.data.global.x, e.data.global.y - 120);
        });

        currentModel.on("pointerdown", function(e) { onDragStart(e); });
        currentModel.on("pointermove", function(e) { onDragMove(e); });
        currentModel.on("pointerup", function(e) { onDragEnd(e); });
        currentModel.on("pointerupoutside", function(e) { onDragEnd(e); });

        app.stage.addChild(currentModel);
        log(name + " ready!");

        try {
            var canvasInfo = currentModel.internalModel && currentModel.internalModel._canvasInfo;
            if (canvasInfo) {
                currentModel._knownCanvasH = canvasInfo.height;
            } else {
                var intModel = currentModel.internalModel;
                if (intModel && intModel._model && intModel._model._canvasInfo) {
                    currentModel._knownCanvasH = intModel._model._canvasInfo.height;
                }
            }
        } catch(e) {}
        updateBubblePosition();
        // Wait for first render so bounds become available
        setTimeout(function() { updateBubblePosition(); }, 50);

        try { currentModel.motion("Idle"); } catch(e) {}
        startIdle();
        startProximityCheck();

        try {
            if (currentModel.expression) {
                currentModel.expression("Normal");
                lastExpression = "";
            }
        } catch(_) {}
    } catch(e) { log("Fail: " + e.message); }
}

// --- Drag ---
function onDragStart(e) {
    isDragging = true;
    dragStart = { x: e.data.global.x, y: e.data.global.y };
    modelStart = { x: currentModel.x, y: currentModel.y };
    currentModel.alpha = 0.8;
}
function onDragMove(e) {
    if (!isDragging) return;
    var dx = e.data.global.x - dragStart.x;
    var dy = e.data.global.y - dragStart.y;
    currentModel.x = modelStart.x + dx;
    currentModel.y = modelStart.y + dy;
    updateBubblePosition();
}
function onDragEnd(e) {
    if (!isDragging) return;
    isDragging = false;
    currentModel.alpha = 1;
}

// --- Upload / Delete ---
function uploadWithRetry(url, formData, retriesLeft) {
    var ctrl = new AbortController();
    var timer = setTimeout(function() { ctrl.abort(); }, 600000);
    return fetch(url, { method: "POST", body: formData, signal: ctrl.signal }).then(function(r) {
        clearTimeout(timer);
        if (!r.ok) throw new Error("Server " + r.status);
        return r.json();
    }).catch(function(e) {
        clearTimeout(timer);
        if (retriesLeft > 0 && (e.name === "AbortError" || e.message.indexOf("fetch") !== -1)) {
            console.warn("Upload retry, left: " + retriesLeft);
            return uploadWithRetry(url, formData, retriesLeft - 1);
        }
        throw e;
    });
}

function onUpload2D(input) {
    var f = input.files[0]; if (!f) return;
    var fd = new FormData(); fd.append("file", f); fd.append("type", "2D");
    log("Uploading " + f.name + "...");
    toast("Uploading: " + f.name + " (" + (f.size / 1024 / 1024).toFixed(1) + " MB)...");
    uploadWithRetry("/api/model/upload", fd, 2).then(function(j) {
        if (j.success) {
            var name = j.data.fileName;
            toast("Uploaded: " + name);
            log("Upload OK: " + name);
            return reloadModels(name);
        } else {
            var msg = j.message || "Unknown error";
            log("Upload failed: " + msg);
            toast("Upload failed: " + msg);
        }
    }).catch(function(e) {
        if (e.name === "AbortError") {
            log("Upload timeout - file too large?");
            toast("Upload timeout - file too large?");
        } else {
            log("Upload error: " + (e.message || "Network failure"));
            toast("Upload error: " + (e.message || "Network failure"));
        }
    });
    input.value = "";
}
function delete2DModel() {
    var s = document.getElementById("model-select");
    if (!s.value) return;
    if (!confirm("确定要删除这个模型吗？")) return;
    fetch("/api/model/delete?fileName=" + encodeURIComponent(s.value) + "&type=2D", { method: "DELETE" })
        .then(function(r) { return r.json(); })
        .then(function(j) { if (j.success) { toast("删除成功！"); loadModelList(); } });
}

function getModelName() {
    var nameMap = {
        "haru_ja": "Haru",
        "hiyori_en": "Hiyori",
        "aidang_2": "小爱",
        "biaoqiang_3": "小标"
    };
    return nameMap[currentModelName] || currentModelName || "看板娘";
}

// --- Chat Window ---
var chatWindowOpen = false;
var chatHistory = [];

function toggleChatWindow() {
    var win = document.getElementById("chat-window");
    var btn = document.getElementById("chat-window-toggle");
    chatWindowOpen = !chatWindowOpen;
    if (chatWindowOpen) {
        win.classList.remove("hidden");
        btn.classList.add("active");
        btn.textContent = "✕";
        scrollChatToBottom();
    } else {
        win.classList.add("hidden");
        btn.classList.remove("active");
        btn.textContent = "💬";
    }
}

function scrollChatToBottom() {
    var el = document.getElementById("chat-messages");
    setTimeout(function() { el.scrollTop = el.scrollHeight; }, 50);
}

function addChatMessage(role, text, extra) {
    var el = document.createElement("div");
    el.className = "msg " + role;
    if (text) el.textContent = text;
    if (extra) {
        if (typeof extra === "string") {
            var img = document.createElement("img");
            img.src = extra;
            img.onload = function() { scrollChatToBottom(); };
            img.onerror = function() { img.remove(); };
            el.appendChild(document.createElement("br"));
            el.appendChild(img);
        } else {
            el.appendChild(extra);
        }
    }
    document.getElementById("chat-messages").appendChild(el);
    scrollChatToBottom();
    return el;
}

function addThinkingMessage() {
    return addChatMessage("ai", "思考中...");
}

function removeElement(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
}

function clearChatHistory() {
    document.getElementById("chat-messages").innerHTML = "";
    chatHistory = [];
}

// --- Image Upload for Chat ---
function onChatImageUpload(input) {
    var f = input.files[0];
    if (!f) return;
    input.value = "";
    handleChatImage(f);
}

async function handleChatImage(file) {
    var reader = new FileReader();
    reader.onload = async function(e) {
        // 显示用户发送的图片
        var userImg = document.createElement("img");
        userImg.src = e.target.result;
        userImg.className = "msg-user-img";
        addChatMessage("user", "", userImg);

        // 在bubble上也显示
        showBubble("正在识别图片...");

        var thinkEl = addThinkingMessage();

        try {
            var formData = new FormData();
            formData.append("image", file);
            formData.append("question", "");

            var resp = await fetch("/api/live2d/chat/1/recognize", {
                method: "POST",
                body: formData
            });
            var json = await resp.json();
            removeElement(thinkEl);

            if (json.success && json.data && json.data.reply) {
                addChatMessage("ai", json.data.reply);
                showBubble(json.data.reply);
                chatHistory.push({role: "user", content: "[发送了一张图片]"});
                chatHistory.push({role: "assistant", content: json.data.reply});
            } else {
                var errMsg = json.message || "识别失败";
                addChatMessage("ai", "图片识别失败: " + errMsg);
                showBubble("图片识别失败: " + errMsg);
            }
        } catch(err) {
            removeElement(thinkEl);
            addChatMessage("ai", "图片识别出错: " + err.message);
            showBubble("图片识别出错");
        }

        if (currentModel) try { currentModel.motion("Tap"); } catch(e) {}
        lastInteraction = Date.now();
        startIdle();
    };
    reader.readAsDataURL(file);
}

// --- Image Generation ---
async function handleImageGeneration(prompt) {
    showBubble("正在生成图片，请稍候...");
    var thinkEl = addChatMessage("ai", "正在生成图片: " + prompt + "...");

    try {
        var resp = await fetch("/api/live2d/chat/1/generate", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({prompt: prompt})
        });
        var json = await resp.json();
        removeElement(thinkEl);

        if (json.success && json.data && json.data.imageUrl) {
            var genImg = document.createElement("img");
            genImg.src = json.data.imageUrl;
            genImg.className = "msg-gen-img";
            genImg.onclick = function() { window.open(this.src, "_blank"); };
            addChatMessage("ai", json.data.reply || "图片已生成~", genImg);
            showBubble("图片已生成~");
            chatHistory.push({role: "user", content: "画图: " + prompt});
            chatHistory.push({role: "assistant", content: "[生成了一张图片]"});
        } else {
            var errMsg = json.message || "生成失败";
            addChatMessage("ai", "图片生成失败: " + errMsg);
            showBubble("图片生成失败: " + errMsg);
        }
    } catch(err) {
        removeElement(thinkEl);
        addChatMessage("ai", "图片生成出错: " + err.message);
        showBubble("图片生成出错");
    }

    if (currentModel) try { currentModel.motion("Tap"); } catch(e) {}
    lastInteraction = Date.now();
    startIdle();
}

function isImageGenCommand(text) {
    return text.startsWith("画图") || text.startsWith("生图") || text.startsWith("生成图片");
}

function extractImagePrompt(text) {
    return text.replace(/^(画图|生图|生成图片)[:：,，\s]*/, "").trim();
}

// --- Chat Window Send ---
async function sendFromChatWindow() {
    var input = document.getElementById("chat-win-input-text");
    var m = input.value.trim();
    if (!m) return;
    input.value = "";

    addChatMessage("user", m);

    if (isImageGenCommand(m)) {
        var prompt = extractImagePrompt(m);
        if (!prompt) {
            addChatMessage("ai", "请输入图片描述，例如：画图 一只可爱的猫咪");
            return;
        }
        await handleImageGeneration(prompt);
    } else {
        await doAiChat(m);
    }
}

async function doAiChat(m) {
    var thinkEl = addThinkingMessage();
    var reply = null;

    try {
        var resp = await fetch("/api/live2d/chat/1", {
            method: "POST", headers: {"Content-Type":"application/json"},
            body: JSON.stringify({message: m, history: chatHistory.slice(-20)})
        });
        var json = await resp.json();
        if (json.success && json.data && json.data.reply &&
            json.data.reply.indexOf("not configured") === -1 &&
            json.data.reply.indexOf("Chat not") === -1) {
            reply = json.data.reply;
            if (json.data.motion && currentModel) try { currentModel.motion(json.data.motion); } catch(e) {}
        }
    } catch(e) {}

    removeElement(thinkEl);

    if (!reply) reply = smartReply(m);
    addChatMessage("ai", reply);
    showBubble(reply);

    chatHistory.push({role: "user", content: m});
    chatHistory.push({role: "assistant", content: reply});
}

function smartReply(msg) {
    var m = msg.toLowerCase();
    var name = getModelName();
    var pick = function(arr) { return arr[Math.floor(Math.random() * arr.length)]; };

    if (m.indexOf("你好")>=0 || m.indexOf("hello")>=0 || m.indexOf("hi")>=0 || m.indexOf("嗨")>=0)
        return pick(["你好呀~今天过得怎么样？", "哈喽！很高兴见到你~", "你好你好！有什么可以帮你的吗？", "嗨~等你半天了呢！"]);
    if (m.indexOf("你是谁")>=0 || m.indexOf("你叫")>=0 || m.indexOf("是你")>=0)
        return pick(["我是" + name + "~你的专属看板娘！", "我叫" + name + "，请多指教哦~", name + "就是我啦！和你聊天好开心~"]);
    if (m.indexOf("名字")>=0 || m.indexOf("叫什么")>=0)
        return pick(["我叫" + name + "，是一个可爱的小助手~", name + "！记得要叫我这个名字哦~", "名字是" + name + "~是不是很好听？"]);
    if (m.indexOf("喜欢")>=0 && (m.indexOf("你")>=0 || m.indexOf("什么")>=0))
        return pick(["我喜欢和主人聊天！最喜欢你了~", "喜欢的东西？嗯...喜欢吃甜点！", "最喜欢看到主人开心的样子啦~"]);
    if (m.indexOf("喜欢")>=0)
        return pick(["诶嘿~被你喜欢好开心！", "我也喜欢你哦~", "嘻嘻，好害羞~"]);
    if (m.indexOf("饿")>=0 || m.indexOf("吃饭")>=0 || m.indexOf("吃")>=0)
        return pick(["饿了？我也想吃东西了~", "一起去吃饭吧！我知道一家不错的店~", "吃饭时间到！要吃什么呢？"]);
    if (m.indexOf("谢谢")>=0 || m.indexOf("thank")>=0 || m.indexOf("感谢")>=0)
        return pick(["不客气~能帮到你就好！", "不用谢啦~你开心我就开心！", "嘿嘿，不用客气哦！"]);
    if (m.indexOf("再见")>=0 || m.indexOf("bye")>=0 || m.indexOf("拜拜")>=0 || m.indexOf("晚安")>=0)
        return pick(["再见啦~记得常来找我玩！", "拜拜！我会想你的~", "下次见！等你回来哦~", "晚安~做个好梦！"]);
    if (m.indexOf("可爱")>=0 || m.indexOf("萌")>=0 || m.indexOf("好看")>=0 || m.indexOf("漂亮")>=0)
        return pick(["诶嘿~被夸可爱了有点不好意思呢", "真的吗？我还会更可爱哦！", "谢谢夸奖~我会继续努力的！"]);
    if (m.indexOf("聪明")>=0 || m.indexOf("厉害")>=0 || m.indexOf("棒")>=0)
        return pick(["那当然啦~我可是很厉害的！", "嘻嘻~再多夸夸我！", "谢谢！我会更努力的~"]);
    if (m.indexOf("笑")>=0 || m.indexOf("哈哈")>=0 || m.indexOf("hh")>=0)
        return pick(["嘻嘻~好好笑哦！", "哈哈哈太有意思了~", "你笑起来真好看！"]);
    if (m.indexOf("嗯")>=0 || m.indexOf("哦")>=0 || m.indexOf("这样")>=0 || m.indexOf("原来")>=0)
        return pick(["嘿嘿~", "哦哦！原来是这样~", "嗯嗯~我在听呢！", "对的哦~"]);
    if (m.indexOf("在吗")>=0 || m.indexOf("在不在")>=0)
        return pick(["在呀在呀~一直在这里等你呢！", "当然在啦~想我了吗？", "在的！有什么吩咐？"]);
    if (m.indexOf("无聊")>=0 || m.indexOf("没意思")>=0)
        return pick(["无聊的话我们来聊天吧！", "那我来陪你玩~想聊什么？", "别无聊啦~我在这里呢！"]);
    if (m.indexOf("累")>=0 || m.indexOf("辛苦")>=0)
        return pick(["辛苦啦~要好好休息哦！", "累了就歇一会儿吧，我陪着你~", "抱抱~今天辛苦了呢！"]);
    if (m.indexOf("开心")>=0 || m.indexOf("高兴")>=0)
        return pick(["太好啦~我也很开心！", "开心就对了！要保持好心情哦~", "你开心我就开心！"]);
    if (m.indexOf("难过")>=0 || m.indexOf("伤心")>=0 || m.indexOf("哭")>=0)
        return pick(["别难过啦~有我在呢！", "抱抱~一切都会好起来的！", "不要伤心了，我给你讲个笑话吧？"]);
    if (m.indexOf("天气")>=0)
        return pick(["今天天气不错呢~要出去走走吗？", "天气好心情也要好哦！", "下雨了也没关系，有我在呢~"]);
    if (m.indexOf("音乐")>=0 || m.indexOf("歌")>=0)
        return pick(["我喜欢听歌！你推荐一首给我吧~", "哼哼~我唱歌还挺好听的哦！", "音乐能让人心情变好呢！"]);
    if (m.indexOf("游戏")>=0 || m.indexOf("玩")>=0)
        return pick(["玩游戏吗？带我一起！", "好呀好呀~玩什么游戏？", "我也喜欢玩游戏！"]);
    if (m.indexOf("工作")>=0 || m.indexOf("上班")>=0 || m.indexOf("学习")>=0)
        return pick(["加油哦~我会在这里支持你的！", "认真工作/学习的人最棒了！", "累了就看看我，给你充充电~"]);
    if (m.indexOf("对不起")>=0 || m.indexOf("抱歉")>=0 || m.indexOf("不好意思")>=0)
        return pick(["没关系的~不用道歉！", "没事没事~我原谅你啦！", "不要这么说嘛~你对我最好了！"]);
    if (m.indexOf("想你")>=0 || m.indexOf("想我")>=0)
        return pick(["我也好想你呀~", "真的吗？我也一直在想你！", "嘻嘻~想我就多来找我聊天！"]);
    if (m.indexOf("吗")>=0 || m.indexOf("呀")>=0 || m.indexOf("？")>=0)
        return pick(["嗯嗯！当然啦~", "是的呀~", "对呀对呀~", "当然可以啦！"]);
    if (m.indexOf("?")>=0)
        return pick(["嗯...让我想想", "这个问题有点难呢~", "你觉得呢？", "好问题！不过我也不知道诶~"]);

    var defs = [
        "嗯嗯~原来是这样！",
        "说得对呢~",
        "嘿嘿，是的是的！",
        "好有意思~继续说！",
        "我也这么觉得！",
        "唔...有道理",
        "嗯？怎么啦？",
        "好呀好呀~",
        "诶~这样啊！",
        "真好呀~",
        "真的吗？好厉害！",
        "然后呢然后呢？"
    ];
    return pick(defs);
}

async function sendChat() {
    var m = document.getElementById("chat-input").value.trim(); if (!m) return;
    document.getElementById("chat-input").value = ""; document.getElementById("chat-send").disabled = true;
    isAiThinking = true;
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
    showBubble("思考中...");
    if (currentModel) try { currentModel.motion("Tap"); } catch(e) {}

    // 在聊天窗口中也显示用户消息
    addChatMessage("user", m);

    // 图片生成命令
    if (isImageGenCommand(m)) {
        var prompt = extractImagePrompt(m);
        isAiThinking = false;
        document.getElementById("chat-send").disabled = false;
        if (!prompt) {
            addChatMessage("ai", "请输入图片描述，例如：画图 一只可爱的猫咪");
            showBubble("请输入图片描述");
            startIdle();
            return;
        }
        await handleImageGeneration(prompt);
        gainExp(10);
        document.getElementById("chat-send").disabled = false;
        return;
    }

    var reply = null;
    try {
        var resp = await fetch("/api/live2d/chat/1", {
            method: "POST", headers: {"Content-Type":"application/json"},
            body: JSON.stringify({message: m, history: chatHistory.slice(-20)})
        });
        var json = await resp.json();
        if (json.success && json.data && json.data.reply &&
            json.data.reply.indexOf("not configured") === -1 &&
            json.data.reply.indexOf("Chat not") === -1) {
            reply = json.data.reply;
            if (json.data.motion) try { currentModel.motion(json.data.motion); } catch(e) {}
        }
    } catch(e) {}

    isAiThinking = false;
    if (!reply) reply = smartReply(m);
    showBubble(reply);
    addChatMessage("ai", reply);

    chatHistory.push({role: "user", content: m});
    chatHistory.push({role: "assistant", content: reply});

    if (currentModel) try { currentModel.motion("Tap"); } catch(e) {}
    lastInteraction = Date.now();

    // Chat increases affection and EXP
    var affectionGain = Math.max(1, Math.floor(m.length / 5));
    affection += affectionGain;
    showFloatText("+" + affectionGain + " ♥", "#ff9999");
    saveAffection();

    var expGain = 3 + Math.floor(m.length / 10);
    gainExp(expGain);

    startIdle();
    document.getElementById("chat-send").disabled = false;
}

document.addEventListener("DOMContentLoaded", init);
