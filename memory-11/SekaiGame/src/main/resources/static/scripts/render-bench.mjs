/**
 * 渲染性能对照脚本（开发用，不参与打包）
 * 用法：node scripts/render-bench.mjs
 * 对比"增量 diff 渲染"与"每次全量重建"的单次耗时，验证改造收益。
 */
import { JSDOM } from "jsdom";

const PAGE = `<!DOCTYPE html><html><body>
<section id="app-shell"></section>
<section class="battle-screen" id="battle-screen"><div class="duel-particles"></div>
<section id="opponent-area"></section><section id="opponent-hand"></section>
<div class="phase-bar" id="phase-bar"></div><section id="battlefield"></section>
<div id="player-area"></div><div id="hand"></div><span id="turn-badge"></span><div id="log-body"></div>
<strong id="player-deck-count">0</strong><strong id="opponent-deck-count">0</strong>
<strong id="player-graveyard-count">0</strong><strong id="opponent-graveyard-count">0</strong>
<strong id="visible-hand-count">0</strong>
<div id="draw-banner"><span id="draw-banner-label"></span><span id="draw-banner-name"></span></div></section></body></html>`;

const dom = new JSDOM(PAGE, { pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.Element = dom.window.Element;
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);

const { GameUI } = await import("../js/ui.js");

const M = (id, n, a) => ({
    instanceId: id, id, name: n, type: "monster", attribute: "fire", rarity: "SR",
    level: 4, currentAttack: a, currentDefense: a - 500, position: "attack",
    faceUp: true, canAttack: true, member: "none",
});

const ui = new GameUI();
const players = [
    {
        name: "A", lp: 8000, maxLp: 8000,
        deck: Array.from({ length: 20 }, (_, i) => M("d" + i, "牌" + i, 1000)),
        hand: Array.from({ length: 6 }, (_, i) => M("h" + i, "手" + i, 1500)),
        graveyard: [],
        monsterZone: [M("m1", "甲", 1800), M("m2", "乙", 1500), M("m3", "丙", 1200)],
        spellTrapZone: [{ instanceId: "t1", name: "落穴", type: "trap", rarity: "N", faceDown: true }],
        fieldZone: null,
    },
    {
        name: "B", lp: 8000, maxLp: 8000,
        deck: Array.from({ length: 20 }, (_, i) => M("e" + i, "牌" + i, 1000)),
        hand: Array.from({ length: 6 }, (_, i) => M("g" + i, "手" + i, 1500)),
        graveyard: [],
        monsterZone: [M("n1", "丁", 1700), M("n2", "戊", 1400)],
        spellTrapZone: [],
        fieldZone: null,
    },
];
const gs = {
    players, turn: 4, phase: "battle", currentPlayerIndex: 0, firstTurn: false,
    gameOver: false, selectedAttacker: players[0].monsterZone[0], validTargets: [],
    get currentPlayer() { return players[this.currentPlayerIndex]; },
    get opponentPlayer() { return players[1 - this.currentPlayerIndex]; },
};
const noop = () => {};
const h = {
    onPlayCard: noop, onSetCard: noop, onActivateSetSpell: noop,
    canActivateSetSpell: () => false, onSummon: noop, onFlipSummon: noop,
    onChangePosition: noop, onActivateMonsterEffect: noop, onNextPhase: noop,
    onEndTurn: noop, onSelectAttacker: noop,
    onPreviewBattle: () => ({ outcome: "destroy", text: "会破坏" }),
    onPendingActions: () => [], onAttack: noop, onAttackPlayer: noop,
    onConfirmTarget: noop, onCancelTarget: noop, onSelectTribute: noop,
    onConfirmTribute: noop, onCancelTribute: noop,
};

ui.render(gs, h);
const bench = (label, fn, n) => {
    const t = process.hrtime.bigint();
    for (let i = 0; i < n; i++) fn();
    const ms = Number(process.hrtime.bigint() - t) / 1e6;
    console.log(label + ": " + (ms / n).toFixed(3) + " ms/次（" + n + " 次，共 " + ms.toFixed(1) + " ms）");
};

const N = 300;
bench("增量 diff 渲染（现在）  ", () => ui.render(gs, h), N);
bench("全量重建（改造前等价）", () => { ui.resetRenderCache(); ui.render(gs, h); }, N);
