/**
 * verify-controller-2d.mjs — 动态 2D 主控系统端到端验收
 *
 * 对已经跑起来的 Spring Boot（默认 http://127.0.0.1:8091）做两件事：
 *   A. 静态资源可达性：首页 / 主控脚本样式 / 角色原画 / 全部 4×4 图集。
 *   B. jsdom 交互验收：主控选择、localStorage 持久化、九种事件的 DOM 反应、
 *      优先级与去重、胜负锁定、LP 驱动的 hit/lowHp、资源失败占位。
 *
 * 用法：
 *   node SekaiGame/tools/verify-controller-2d.mjs [baseUrl]
 * 需要仓库根 node_modules 里的 jsdom（SekaiGame/tools 会向上解析到）。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = (process.argv[2] || "http://127.0.0.1:8091").replace(/\/+$/, "");
const STATIC_DIR = fileURLToPath(new URL("../src/main/resources/static/", import.meta.url));

const results = [];
const pass = (name, extra = "") => results.push({ ok: true, name, extra });
const fail = (name, extra = "") => results.push({ ok: false, name, extra });
const check = (condition, name, extra = "") => (condition ? pass(name, extra) : fail(name, extra));

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function head(url) {
    try {
        const res = await fetch(url, { method: "GET" });
        if (!res.ok) return { ok: false, status: res.status };
        const buf = await res.arrayBuffer();
        return { ok: true, status: res.status, bytes: buf.byteLength };
    } catch (error) {
        return { ok: false, status: 0, error: String(error?.message || error) };
    }
}

/* ------------------------------------------------------------------ *
 * A. 静态资源
 * ------------------------------------------------------------------ */
async function verifyStaticAssets() {
    const url = path => `${BASE}/${path.replace(/^\/+/, "")}`;
    const entries = [
        ["首页", ""],
        ["controller-2d.js", "js/controller-2d.js"],
        ["controller-2d.css", "css/controller-2d.css"],
        ["anime-theme.css", "css/anime-theme.css"],
        ["controller-blue-01.png", "assets/characters/controller-blue-01.png"],
        ["controller-lucia.png", "assets/characters/controller-lucia.png"],
    ];
    for (const [label, path] of entries) {
        const res = await head(url(path));
        check(res.ok && res.status === 200, `${label} 返回 HTTP 200`, res.ok ? `${res.bytes} bytes` : `status=${res.status}`);
    }

    // 首页必须已经引用新的主控样式表
    const html = await (await fetch(url(""))).text();
    check(html.includes("css/controller-2d.css"), "首页已引用 css/controller-2d.css");
    check(html.includes("duel-controller-fx-back") && html.includes("duel-controller-fx-front"), "首页含主控前后特效层");
    check(html.includes('id="duel-controller-fx-layer"'), "首页含跨屏特效层");

    // 4×4 图集：怪兽 / 魔法 / 陷阱，按当前运行的目录内容逐一探活
    const { readdirSync } = await import("node:fs");
    const vfxDir = `${STATIC_DIR}images/vfx`;
    const sheets = readdirSync(vfxDir).filter(name => name.endsWith("-sheet-v1.png") || name.endsWith("-sheet-v2.png"));
    check(sheets.length > 0, "vfx 目录存在 4×4 图集", `${sheets.length} 张`);
    const sample = sheets.filter((_, index) => index % Math.max(1, Math.floor(sheets.length / 12)) === 0).slice(0, 12);
    let sheetOk = 0;
    for (const sheet of sample) {
        const res = await head(url(`images/vfx/${sheet}`));
        if (res.ok) sheetOk++;
        else fail(`图集 ${sheet} 返回 HTTP 200`, `status=${res.status}`);
    }
    if (sheetOk === sample.length) pass(`4×4 图集抽样全部 200`, `${sheetOk}/${sample.length}（从 ${sheets.length} 张中抽取）`);
    // 陷阱 4×4 图集使用独立命名，单独抽一张
    const trapSheet = sheets.find(name => name.startsWith("trap-")) || "trap-pitfall-sheet-v2.png";
    const trapRes = await head(url(`images/vfx/${trapSheet}`));
    check(trapRes.ok, `陷阱 4×4 图集 ${trapSheet} 返回 HTTP 200`, `status=${trapRes.status}`);
    return sheets.length;
}

/* ------------------------------------------------------------------ *
 * B. jsdom 交互
 * ------------------------------------------------------------------ */
async function makeDom() {
    const { JSDOM } = await import("jsdom");
    const html = await (await fetch(`${BASE}/`)).text();
    const dom = new JSDOM(html, { url: `${BASE}/`, runScripts: "outside-only", pretendToBeVisual: true });
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.Element = dom.window.Element;
    globalThis.HTMLElement = dom.window.HTMLElement;
    globalThis.Node = dom.window.Node;
    globalThis.CustomEvent = dom.window.CustomEvent;
    globalThis.Event = dom.window.Event;
    globalThis.localStorage = dom.window.localStorage;
    if (dom.window.Image) globalThis.Image = dom.window.Image;
    try { Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true }); } catch { /* Node 只读 navigator：忽略 */ }
    globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
    globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
    return dom;
}

function fire(type, detail = {}) {
    window.dispatchEvent(new window.CustomEvent("sekai:controller-action", { detail: { type, ...detail } }));
}

async function verifyControllerDom() {
    const dom = await makeDom();
    const errors = [];
    window.addEventListener("error", event => errors.push(String(event.message)));
    const originalError = console.error;
    console.error = (...args) => { errors.push(args.map(String).join(" ")); originalError(...args); };

    const root = () => document.querySelector("#player-controller-2d");
    const status = () => document.querySelector("#controller-status")?.textContent;

    const mod = await import(new URL("../src/main/resources/static/js/controller-2d.js", import.meta.url).href);
    const initialized = mod.initializeController2D();
    check(!!initialized, "initializeController2D() 成功绑定");

    // --- 默认主控 ---
    check(root().dataset.controllerId === "blue-01", "默认应用 CONTROLLER 01", root().dataset.controllerId);

    // --- 选择界面：打开 / 关闭 / 使用中 / 保存 ---
    document.querySelector("#btn-controller-select").click();
    const picker = document.querySelector("#controller-picker");
    check(picker.classList.contains("active"), "主控选择界面可以打开");
    const activeBadge = picker.querySelector(".controller-choice.selected .controller-choice-badge")?.textContent;
    check(activeBadge === "使用中", "选择界面显示「使用中」状态", String(activeBadge));
    document.querySelector("#controller-picker-close").click();
    check(!picker.classList.contains("active"), "主控选择界面可以关闭");

    document.querySelector("#btn-controller-select").click();
    const second = picker.querySelector('[data-controller-id="lucia"]');
    check(!!second, "选择界面里存在第二个主控（一条配置注册）");
    second.click();
    await sleep(420);
    check(window.localStorage.getItem("sekai_selected_controller") === "lucia", "选择已写入 localStorage",
        String(window.localStorage.getItem("sekai_selected_controller")));
    check(root().dataset.controllerId === "lucia", "选择立即生效", root().dataset.controllerId);
    check(root().querySelector("img").getAttribute("src").includes("controller-lucia.png"), "角色原画已切换到第二个主控");
    check(document.querySelector("#controller-picker").classList.contains("active") === false, "选择后自动关闭选择界面");

    // --- 刷新页面后恢复选择（重建模块实例，模拟整页刷新） ---
    mod.destroyController2D();
    const reloaded = await import(new URL("../src/main/resources/static/js/controller-2d.js?v=refresh-sim", import.meta.url).href);
    reloaded.initializeController2D();
    check(root().dataset.controllerId === "lucia", "刷新后恢复上次选择", root().dataset.controllerId);

    // --- 切回 01 便于后续断言 ---
    reloaded.selectController("blue-01");
    window.localStorage.setItem("sekai_selected_controller", "blue-01");

    const expectState = async (type, className, expectStatus, extra = {}) => {
      fire(type, extra);
      const cls = root().classList.contains(className);
      check(cls, `事件 ${type} → 类名 ${className}`);
      check(status() === expectStatus, `事件 ${type} → 状态文字「${expectStatus}」`, String(status()));
      return cls;
    };

    // --- 一次性动作 ---
    await expectState("draw", "is-draw", "DRAW LINK", { playerIndex: 0, cardId: "c1", cardType: "monster" });
    check(document.querySelector("#duel-controller-fx-layer .ctl-draw-beam") !== null, "抽卡生成指向手牌的光线");
    await sleep(900);
    check(!root().classList.contains("is-draw"), "抽卡动画结束后回到 idle");
    check(status() === "TACTICAL LINK", "抽卡结束后状态文字复位", String(status()));

    await expectState("summon", "is-summon", "SUMMON LINK", { playerIndex: 0, cardType: "monster" });
    check(root().querySelectorAll(".duel-controller-fx-back .ctl-summon-ring").length >= 1, "召唤生成背后的召唤环");
    await sleep(1150);

    await expectState("spell", "is-spell", "SPELL LINK", { playerIndex: 0, cardType: "spell" });
    check(root().querySelectorAll(".ctl-spell-orb").length > 0, "魔法生成蓝紫能量环绕");
    check(document.querySelector("#duel-controller-fx-layer .ctl-draw-beam") === null, "魔法不会侵入手牌区域");
    await sleep(1050);

    await expectState("trap", "is-trap", "TRAP ALERT", { playerIndex: 0, cardType: "trap" });
    check(root().querySelector(".ctl-trap-scanlines") !== null, "陷阱生成警戒扫描线");
    await sleep(950);

    await expectState("attack", "is-attack", "ATTACK LINK", { playerIndex: 0, cardType: "monster" });
    await sleep(700);

    await expectState("hit", "is-hit", "DAMAGE ALERT", { playerIndex: 0, damage: 1200 });
    check(root().querySelector(".ctl-hit-flash") !== null, "受击生成红色边缘闪光");
    await sleep(650);
    check(!root().classList.contains("is-hit"), "受击动画结束后回到 idle");

    // --- 优先级：高优先级打断低优先级 ---
    fire("summon");
    const highPriority = root().classList.contains("is-summon");
    fire("hit");
    check(highPriority && root().classList.contains("is-hit") && !root().classList.contains("is-summon"),
        "hit 打断 summon（高优先级可中断低优先级）");
    fire("draw");
    check(!root().classList.contains("is-draw"), "draw 不能打断正在播放的 hit（低优先级被拒）");
    check(reloaded.getController2DState().lastDecision === "lower-priority", "被拒原因记录为 lower-priority",
        String(reloaded.getController2DState().lastDecision));
    await sleep(650);

    // --- 去重 ---
    fire("attack");
    fire("attack", {});
    check(reloaded.getController2DState().lastDecision === "duplicate", "同一次操作重复派发被去重",
        String(reloaded.getController2DState().lastDecision));
    await sleep(700);

    // --- 低 LP：持续状态，不覆盖一次性动作 ---
    fire("lowHp", { lp: 1800, maxLp: 8000 });
    check(root().classList.contains("is-low-hp"), "低 LP 进入持续状态 is-low-hp");
    fire("summon");
    check(root().classList.contains("is-summon") && root().classList.contains("is-low-hp"),
        "低 LP 是持续状态，不覆盖同时发生的一次性动作");
    await sleep(1150);
    fire("lowHpEnd", { lp: 4200, maxLp: 8000 });
    check(!root().classList.contains("is-low-hp"), "退出低 LP 后恢复普通 idle");

    // --- 胜负锁定 ---
    fire("win", { playerIndex: 0 });
    check(root().classList.contains("is-win"), "胜利触发 is-win 最终姿态");
    check(status() === "VICTORY LINK", "胜利状态文字 VICTORY LINK", String(status()));
    fire("hit");
    fire("attack");
    fire("lose");
    check(root().classList.contains("is-win") && !root().classList.contains("is-lose"),
        "win 状态锁定，直到新决斗开始");
    fire("duelStart");
    check(!root().classList.contains("is-win"), "新决斗开始后解锁 win 最终姿态");
    check(status() === mod.getDefaultController().title || status() !== "VICTORY LINK", "新决斗后状态文字复位", String(status()));

    fire("lose", { playerIndex: 1 });
    check(root().classList.contains("is-lose") && status() === "LINK LOST", "失败触发 is-lose / LINK LOST");
    fire("duelStart");

    // --- 资源加载失败的安全占位 ---
    root().querySelector("img").dispatchEvent(new window.Event("error"));
    check(root().classList.contains("is-link-broken"), "角色图加载失败时进入安全占位");
    fire("draw");
    check(root().classList.contains("is-draw"), "占位状态下决斗事件仍可用（不影响决斗）");
    await sleep(900);
    root().querySelector("img").dispatchEvent(new window.Event("load"));
    check(!root().classList.contains("is-link-broken"), "图片恢复后退出占位");

    // --- 离开决斗的清理 ---
    fire("duelEnd");
    const state = reloaded.getController2DState();
    check(state.timers === 0 && state.fxNodes === 0, "离开决斗时清除计时器与特效节点",
        `timers=${state.timers} fx=${state.fxNodes}`);
    check(state.active === null && state.locked === false, "离开决斗时清空动画状态类名");

    console.error = originalError;
    check(errors.length === 0, "主控流程无新增控制台错误", errors.slice(0, 3).join(" | "));
    dom.window.close();
}

/* ------------------------------------------------------------------ *
 * C. Phase 4：真实游戏节点 → 主控事件
 * ------------------------------------------------------------------ */
async function verifyRealGameNodes() {
    const dom = await makeDom();
    const received = [];
    window.addEventListener("sekai:controller-action", event => received.push(event.detail));
    const take = type => received.filter(item => item.type === type).length;

    const [{ GameState, Player }, { GameEngine }, { GameController }, { PHASE }] = await Promise.all([
        import(new URL("../src/main/resources/static/js/model.js", import.meta.url).href),
        import(new URL("../src/main/resources/static/js/engine.js", import.meta.url).href),
        import(new URL("../src/main/resources/static/js/controller.js", import.meta.url).href),
        import(new URL("../src/main/resources/static/js/constants.js", import.meta.url).href),
    ]);

    const monster = (id, level = 4) => ({
        instanceId: `i_${id}`, id, name: `测试怪兽${id}`, type: "monster", attribute: "dark", race: "warrior",
        level, attack: 1800, defense: 1200, rarity: "N", effects: [], description: "测试卡牌",
    });
    const spell = id => ({
        instanceId: `i_${id}`, id, name: `测试魔法${id}`, type: "spell", subtype: "normal", attribute: "light",
        rarity: "N", effects: [{ trigger: "manual", type: "healPlayer", params: { value: 500 }, description: "回复500" }],
        description: "测试魔法",
    });
    const trap = id => ({
        instanceId: `i_${id}`, id, name: `测试陷阱${id}`, type: "trap", subtype: "normal", attribute: "dark",
        rarity: "N", effects: [{ trigger: "manual", type: "healPlayer", params: { value: 300 }, description: "回复300" }],
        description: "测试陷阱",
    });

    const ui = {
        logs: [], renders: 0,
        render() { this.renders++; },
        addLog(message) { this.logs.push(message); },
        showDrawAnimation() {}, showGameOver() {}, showHandoff(_n, cb) { cb(); },
        showTrapConfirm(_traps, finish) { finish([]); },
        cardHTML() { return ""; },
    };

    const state = new GameState();
    state.players = [
        new Player("P1", Array.from({ length: 20 }, (_, i) => monster(`d1_${i}`))),
        new Player("P2", Array.from({ length: 20 }, (_, i) => monster(`d2_${i}`))),
    ];
    const controller = new GameController(state, new GameEngine(state), ui);
    controller.mode = "ai";
    state.turn = 2;
    state.firstTurn = false;
    state.currentPlayerIndex = 0;
    state.phase = PHASE.MAIN_1;

    // 演出锁在无头环境里不会自然释放（DOM 动画不跑），每个动作后手动解锁，
    // 否则后续 _canInteract() 一律为 false，测不到真实派发点。
    const unlock = async () => {
        await sleep(30);
        controller._releaseEffectLocks();
        controller._animationLocks.clear();
        controller._interactionLocks.clear();
        controller.trapConfirmOpen = false;
        controller.effectBusy = false;
    };

    // 召唤
    state.players[0].hand = [monster("summon_a")];
    controller.summonMonster(0, "attack", false);
    check(take("summon") === 1, "怪兽成功召唤 → summon", `count=${take("summon")} logs=${ui.logs.at(-1) || ""}`);
    check(received.find(item => item.type === "summon")?.cardType === "monster", "summon 事件带卡牌类型");
    check(received.find(item => item.type === "summon")?.playerIndex === 0, "summon 事件带玩家索引");
    await unlock();

    // 失败的召唤不能触发动画
    state.players[0].normalSummonUsed = true;
    state.players[0].hand = [monster("summon_b")];
    controller.summonMonster(0, "attack", false);
    check(take("summon") === 1, "召唤失败不触发 summon 动画（无效操作不播成功动画）", `count=${take("summon")}`);
    state.players[0].normalSummonUsed = false;
    await unlock();

    // 盖放
    state.players[0].hand = [trap("set_a")];
    controller.setCard(0);
    check(take("play") === 1, "卡牌盖放成功 → play", `count=${take("play")} logs=${ui.logs.at(-1) || ""}`);
    await unlock();

    // 魔法发动
    state.phase = PHASE.MAIN_1;
    state.players[0].hand = [spell("spell_a")];
    controller.activateSpell(0);
    check(take("spell") === 1, "魔法成功发动 → spell", `count=${take("spell")} logs=${ui.logs.at(-1) || ""}`);
    check(received.find(item => item.type === "spell")?.cardType === "spell", "spell 事件带卡牌类型");
    await unlock();

    // 魔法发动失败（非主要阶段）不触发。注意 BATTLE 会被控制器自动推进到主要阶段 2，
    // 所以这里用真正非法的抽卡阶段。
    state.phase = PHASE.DRAW;
    state.players[0].hand = [spell("spell_b")];
    controller.activateSpell(0);
    check(take("spell") === 1, "非主要阶段发动魔法不触发 spell 动画", `count=${take("spell")}`);
    state.phase = PHASE.MAIN_1;
    await unlock();

    // 陷阱主动发动（引擎 onTrapActivated）
    const trapCard = trap("trap_a");
    state.players[0].spellTrapZone = [trapCard];
    trapCard.faceDown = true;
    trapCard.setTurn = 1;
    controller.activateSetTrap(trapCard);
    check(take("trap") === 1, "陷阱成功发动 → trap", `count=${take("trap")} logs=${ui.logs.at(-1) || ""}`);
    check(received.find(item => item.type === "trap")?.playerIndex === 0, "trap 事件带玩家索引");
    await unlock();

    // 攻击
    state.phase = PHASE.BATTLE;
    const attacker = monster("atk_a");
    attacker.faceUp = true;
    attacker.faceDown = false;
    attacker.position = "attack";
    attacker.setTurn = 1;
    attacker.hasAttackedThisTurn = false;
    attacker.canAttack = true;
    attacker.currentAttack = 1800;
    attacker.currentDefense = 1200;
    attacker.statuses = {};
    state.players[0].monsterZone = [attacker];
    state.players[1].monsterZone = [];
    state.selectedAttacker = attacker;
    controller.attackTarget("player");
    check(take("attack") === 1, "攻击真正成立 → attack", `count=${take("attack")} logs=${ui.logs.at(-1) || ""}`);
    check(received.find(item => item.type === "attack")?.targetType === "player", "attack 事件带目标类型");
    await unlock();

    // 取消攻击不触发
    state.selectedAttacker = null;
    controller.attackTarget("player");
    check(take("attack") === 1, "未选中攻击者时不触发 attack 动画", `count=${take("attack")}`);
    await unlock();

    // 抽卡 / LP / 胜负：走 GameUI 的真实渲染路径
    const { GameUI } = await import(new URL("../src/main/resources/static/js/ui.js", import.meta.url).href);
    const gameUi = new GameUI();
    const gs = {
        players: [
            { name: "A", lp: 8000, maxLp: 8000, deck: [], hand: [], graveyard: [], monsterZone: [], spellTrapZone: [], fieldZone: null },
            { name: "B", lp: 8000, maxLp: 8000, deck: [], hand: [], graveyard: [], monsterZone: [], spellTrapZone: [], fieldZone: null },
        ],
        turn: 2, phase: PHASE.MAIN_1, currentPlayerIndex: 0, firstTurn: false, gameOver: false,
        selectedAttacker: null, validTargets: [],
        get currentPlayer() { return this.players[this.currentPlayerIndex]; },
        get opponentPlayer() { return this.players[1 - this.currentPlayerIndex]; },
    };
    const handlers = {
        onPlayCard: () => {}, onSetCard: () => {}, onActivateSetSpell: () => {}, canActivateSetSpell: () => false,
        onSummon: () => {}, onFlipSummon: () => {}, onChangePosition: () => {}, onActivateMonsterEffect: () => {},
        onNextPhase: () => {}, onEndTurn: () => {}, onSelectAttacker: () => {}, onPendingActions: () => [],
        onAttack: () => {}, onAttackPlayer: () => {}, onConfirmTarget: () => {}, onCancelTarget: () => {},
        onSelectTribute: () => {}, onConfirmTribute: () => {}, onCancelTribute: () => {},
    };

    gameUi.showBattle();
    check(take("duelStart") === 1, "进入决斗 → duelStart（重置主控状态）", `count=${take("duelStart")}`);
    gameUi.render(gs, handlers);            // 首帧只建立 LP 基线
    check(take("hit") === 0, "首帧不误判为掉血", `count=${take("hit")}`);

    gs.players[0].lp = 6200;
    gameUi.render(gs, handlers);
    check(take("hit") === 1, "玩家 LP 实际降低 → hit", `count=${take("hit")}`);
    check(received.filter(item => item.type === "hit")[0]?.damage === 1800, "hit 事件带真实伤害值",
        String(received.filter(item => item.type === "hit")[0]?.damage));

    gs.players[0].lp = 8000;                // 治疗：不应触发 hit
    gameUi.render(gs, handlers);
    check(take("hit") === 1, "LP 回升不触发 hit", `count=${take("hit")}`);

    gs.players[0].lp = 1900;                // 8000 的 25% = 2000
    gameUi.render(gs, handlers);
    check(take("lowHp") === 1, "LP 低于 25% → lowHp", `count=${take("lowHp")}`);
    gameUi.render(gs, handlers);
    check(take("lowHp") === 1, "同一低 LP 状态不重复触发", `count=${take("lowHp")}`);

    gs.players[0].lp = 5200;
    gameUi.render(gs, handlers);
    check(take("lowHpEnd") === 1, "LP 回到 25% 以上 → lowHpEnd", `count=${take("lowHpEnd")}`);

    gameUi.showDrawAnimation(monster("draw_a"), 0, "DRAW");
    check(take("draw") === 1, "玩家抽卡成功 → draw", `count=${take("draw")}`);
    gameUi.showDrawAnimation(monster("draw_b"), 1, "DRAW");
    check(take("draw") === 1, "对手抽卡不触发玩家主控动画", `count=${take("draw")}`);

    gameUi.showGameOver(0, ["A", "B"], false, "");
    check(take("win") === 1, "决斗胜利 → win", `count=${take("win")}`);
    // 锁定本身是 controller-2d 的职责，已在 B 段验证；这里只验证结算一定会派发。
    gameUi.showBattle();
    gameUi.showGameOver(1, ["A", "B"], false, "LP归零");
    check(take("lose") === 1, "决斗败北 → lose", `count=${take("lose")}`);
    gameUi.showBattle();
    gameUi.showGameOver(null, ["A", "B"], true, "");
    check(take("drawGame") === 1, "平局 → drawGame", `count=${take("drawGame")}`);
    gameUi.hideGameOver();
    gameUi.showMenu();
    check(take("duelEnd") >= 1, "离开决斗 → duelEnd（清理）", `count=${take("duelEnd")}`);

    dom.window.close();
}

/* ------------------------------------------------------------------ *
 * 主流程
 * ------------------------------------------------------------------ */
console.log(`▶ 验收目标：${BASE}\n`);
let sheetCount = 0;
try {
    sheetCount = await verifyStaticAssets();
    await verifyControllerDom();
    await verifyRealGameNodes();
} catch (error) {
    fail("验收脚本异常中断", String(error?.stack || error));
}

console.log("─ A/B/C 验收结果 ─");
for (const item of results) {
    console.log(`${item.ok ? "  ✔" : "  ✖"} ${item.name}${item.extra ? `  [${item.extra}]` : ""}`);
}
const failed = results.filter(item => !item.ok);
console.log(`\n合计 ${results.length} 项：通过 ${results.length - failed.length}，失败 ${failed.length}（探活图集目录共 ${sheetCount} 张）`);
process.exit(failed.length === 0 ? 0 : 1);
