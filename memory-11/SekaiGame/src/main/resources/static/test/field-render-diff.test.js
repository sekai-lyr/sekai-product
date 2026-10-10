/**
 * 战场增量渲染回归测试
 *
 * 背景：以前每次 checkAndRefresh 都会用 innerHTML 整体重建 22 个卡槽（含卡图
 * <img>），攻击动画期间连续刷新会掉帧。现在改为逐槽 diff + 事件委托，这里锁定
 * 三个关键不变量：
 *   1. 状态没变的槽位，DOM 节点必须复用（不能每次渲染都重建）
 *   2. 内容变化的槽位必须被替换（diff 不能漏更新）
 *   3. 多次渲染后点击仍只触发一次（委托不能累积监听器）
 *
 * jsdom 是 devDependency，但没有装进 static/node_modules（那会被打进 jar）。
 * 它装在仓库根 memory-16/node_modules，Node 会沿目录向上解析到。
 * 缺失时这些用例会自动跳过，不影响 `npm test`。
 */

import test from "node:test";
import assert from "node:assert/strict";

let JSDOM = null;
try {
    ({ JSDOM } = await import("jsdom"));
} catch {
    JSDOM = null;
}

const PAGE = `<!DOCTYPE html><html><body>
<section id="app-shell"></section>
<section class="battle-screen" id="battle-screen">
    <div class="duel-particles"></div>
    <section id="opponent-area"></section>
    <section id="opponent-hand"></section>
    <div class="phase-bar" id="phase-bar"></div>
    <section id="battlefield"></section>
    <div id="player-area"></div>
    <div id="hand"></div>
    <span id="turn-badge"></span>
    <div id="log-body"></div>
    <strong id="player-deck-count">0</strong>
    <strong id="opponent-deck-count">0</strong>
    <strong id="player-graveyard-count">0</strong>
    <strong id="opponent-graveyard-count">0</strong>
    <strong id="visible-hand-count">0</strong>
    <div id="draw-banner"><span id="draw-banner-label"></span><span id="draw-banner-name"></span></div>
</section>
</body></html>`;

function monster(id, name, atk) {
    return {
        instanceId: id, id, name, type: "monster", attribute: "fire", rarity: "N",
        level: 4, currentAttack: atk, currentDefense: atk - 500,
        position: "attack", faceUp: true, canAttack: true, member: "none",
    };
}

function makeState() {
    const players = [
        { name: "A", lp: 8000, maxLp: 8000, deck: [], hand: [], graveyard: [], monsterZone: [], spellTrapZone: [], fieldZone: null },
        { name: "B", lp: 8000, maxLp: 8000, deck: [], hand: [], graveyard: [], monsterZone: [], spellTrapZone: [], fieldZone: null },
    ];
    return {
        players,
        turn: 2,
        phase: "main_1",
        currentPlayerIndex: 0,
        firstTurn: false,
        gameOver: false,
        selectedAttacker: null,
        validTargets: [],
        get currentPlayer() { return players[this.currentPlayerIndex]; },
        get opponentPlayer() { return players[1 - this.currentPlayerIndex]; },
    };
}

function makeHandlers() {
    const calls = { changePosition: 0, attack: 0, selectAttacker: 0 };
    return {
        calls,
        onPlayCard: () => {}, onSetCard: () => {}, onActivateSetSpell: () => {},
        canActivateSetSpell: () => false,
        onSummon: () => {}, onFlipSummon: () => {},
        onChangePosition: () => { calls.changePosition++; },
        onActivateMonsterEffect: () => {}, onNextPhase: () => {}, onEndTurn: () => {},
        onSelectAttacker: () => { calls.selectAttacker++; },
        onPreviewBattle: () => ({ outcome: "destroy", text: "会破坏" }),
        onPendingActions: () => [],
        onAttack: () => { calls.attack++; }, onAttackPlayer: () => {},
        onConfirmTarget: () => {}, onCancelTarget: () => {},
        onSelectTribute: () => {}, onConfirmTribute: () => {}, onCancelTribute: () => {},
    };
}

async function setup() {
    const dom = new JSDOM(PAGE, { pretendToBeVisual: true });
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.Element = dom.window.Element;
    globalThis.HTMLElement = dom.window.HTMLElement;
    globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
    const { GameUI } = await import("../js/ui.js");
    return { dom, ui: new GameUI() };
}

test("战场槽位在状态未变化时复用 DOM 节点，变化时才替换", { skip: !JSDOM && "未安装 jsdom" }, async () => {
    const { ui } = await setup();
    const gs = makeState();
    gs.players[0].monsterZone = [monster("m_a", "甲", 1800), monster("m_b", "乙", 1500)];
    gs.players[1].monsterZone = [monster("m_c", "丙", 1200)];
    const h = makeHandlers();

    ui.render(gs, h);
    const myRow = document.querySelector('.monster-row[data-owner="0"]');
    const oppRow = document.querySelector('.monster-row[data-owner="1"]');
    const firstSlotBefore = myRow.children[0];
    const secondSlotBefore = myRow.children[1];
    const oppSlotBefore = oppRow.children[0];

    // 完全相同的状态再渲染一次：所有槽位都应原样保留
    ui.render(gs, h);
    assert.equal(myRow.children[0], firstSlotBefore, "未变化的己方卡槽不应重建");
    assert.equal(myRow.children[1], secondSlotBefore, "未变化的己方卡槽不应重建");
    assert.equal(oppRow.children[0], oppSlotBefore, "未变化的对方卡槽不应重建");

    // 只改一张卡：只有对应槽位被替换
    gs.players[0].monsterZone[0] = monster("m_d", "丁", 2100);
    ui.render(gs, h);
    assert.notEqual(myRow.children[0], firstSlotBefore, "变化的卡槽必须被替换");
    assert.equal(myRow.children[1], secondSlotBefore, "相邻卡槽不应被连带重建");
    assert.equal(oppRow.children[0], oppSlotBefore, "对方卡槽不应被连带重建");
    assert.equal(myRow.children[0].dataset.instanceId, "m_d");
});

test("手牌未变化时跳过重建", { skip: !JSDOM && "未安装 jsdom" }, async () => {
    const { ui } = await setup();
    const gs = makeState();
    gs.players[0].hand = [monster("h_1", "手牌一", 1000)];
    const h = makeHandlers();

    ui.render(gs, h);
    const cardBefore = document.querySelector("#hand").firstElementChild;

    ui.render(gs, h);
    assert.equal(document.querySelector("#hand").firstElementChild, cardBefore, "手牌没变不应重建");

    gs.players[0].hand.push(monster("h_2", "手牌二", 1100));
    ui.render(gs, h);
    assert.notEqual(document.querySelector("#hand").firstElementChild, cardBefore, "手牌变化后必须重建");
    assert.equal(document.querySelector("#hand").children.length, 2);
});

test("多次渲染后点击仍只触发一次（事件委托不累积监听器）", { skip: !JSDOM && "未安装 jsdom" }, async () => {
    const { dom, ui } = await setup();
    const gs = makeState();
    gs.players[0].monsterZone = [monster("m_a", "甲", 1800)];
    const h = makeHandlers();

    ui.render(gs, h);
    ui.render(gs, h);
    ui.render(gs, h);

    const btn = document.querySelector("[data-pos-switch]");
    assert.ok(btn, "主要阶段己方表侧怪兽应有守备/攻击切换按钮");
    btn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
    assert.equal(h.calls.changePosition, 1, "连渲染三次后点击仍应只触发一次切换");
});

test("遍历各阶段/场地魔法/直接攻击预览都不报错且结构完整", { skip: !JSDOM && "未安装 jsdom" }, async () => {
    const { ui } = await setup();
    const gs = makeState();
    gs.players[0].monsterZone = [monster("m_a", "甲", 1800)];
    gs.players[1].monsterZone = [monster("m_c", "丙", 1200)];
    gs.players[0].spellTrapZone = [{ instanceId: "t_1", name: "落穴", type: "trap", rarity: "N", faceDown: true }];
    gs.players[1].fieldZone = { instanceId: "f_1", name: "夜曲舞台", type: "spell", rarity: "N" };
    const h = makeHandlers();

    for (const phase of ["draw", "standby", "main_1", "battle", "main_2", "end", "target_select"]) {
        for (const selected of [null, gs.players[0].monsterZone[0]]) {
            gs.phase = phase;
            gs.selectedAttacker = selected;
            gs.validTargets = phase === "target_select" ? [gs.players[1].monsterZone[0]] : [];
            ui.render(gs, h);
        }
    }

    const bf = document.querySelector("#battlefield");
    assert.ok(bf.querySelector('.monster-row[data-owner="0"]'), "己方怪兽行存在");
    assert.ok(bf.querySelector('.monster-row[data-owner="1"]'), "对方怪兽行存在");
    assert.ok(bf.querySelector('.spell-trap-row[data-owner="0"]'), "己方魔陷行存在");
    assert.ok(bf.querySelector('.field-zone-slot[data-owner="1"].has-card'), "对方场地魔法槽标记为 has-card");

    // 战斗阶段 + 已选攻击者 + 对方空场 → 直接攻击预览条应出现
    gs.phase = "battle";
    gs.selectedAttacker = gs.players[0].monsterZone[0];
    gs.players[1].monsterZone = [];
    ui.render(gs, h);
    assert.match(bf.querySelector(".battle-preview-host").textContent, /对方玩家/);

    // 取消选择后预览条要收回去
    gs.selectedAttacker = null;
    ui.render(gs, h);
    assert.equal(bf.querySelector(".battle-preview-host").textContent.trim(), "");
});

test("切换对局会重置渲染缓存", { skip: !JSDOM && "未安装 jsdom" }, async () => {
    const { ui } = await setup();
    const gs = makeState();
    gs.players[0].monsterZone = [monster("m_a", "甲", 1800)];
    ui.render(gs, makeHandlers());
    const slotBefore = document.querySelector('.monster-row[data-owner="0"]').children[0];

    ui.resetRenderCache();
    ui.render(gs, makeHandlers());
    const row = document.querySelector('.monster-row[data-owner="0"]');
    assert.ok(row.isConnected, "重置缓存后战场骨架必须重新挂上");
    assert.notEqual(row.children[0], slotBefore, "重置缓存后应整体重建");
    assert.equal(row.children[0].dataset.instanceId, "m_a", "重建后内容仍要正确");
});
