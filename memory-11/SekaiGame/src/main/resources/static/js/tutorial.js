/**
 * tutorial.js
 * 新手教学：脚本化引导 + 分步教练提示。
 *
 * 为什么需要它：游戏规则深度接近游戏王（祭品召唤、表示形式、陷阱时机、起手重抽…），
 * 但此前**完全没有教程**，规则页是 19 段纯文字。对新玩家来说这是最大的流失点。
 *
 * 设计原则：
 * - **不新增一套规则引擎**：教学就是一局正常决斗，只是卡组、起手和提示被脚本固定住，
 *   所有操作仍然走真实的引擎，学到的东西与实战完全一致。
 * - **卡组按条件从卡池里挑**：而不是写死卡 id，卡池调整后教学依然可用；
 *   同时用测试保证"教学的起手一定包含这一步需要的手牌"。
 * - **随时可跳过**：任何一步都能点「跳过教学」直接回到大厅。
 * - **不惩罚乱操作**：玩家做了别的动作不会失败，教练只是继续等他做对的那一步。
 */

import { ALL_CARDS } from "./catalog.js";

const RARITY_RANK = { N: 0, R: 1, SR: 2, SSR: 3, UR: 4 };

/** 从卡池里按条件挑一张（优先低稀有度，避免教学用上花里胡哨的效果卡）。 */
function pickCard(predicate, { lowestRarity = true, score = null, descending = false } = {}) {
    const candidates = ALL_CARDS.filter(card => card?.id && card.enabled !== false && predicate(card));
    if (candidates.length === 0) return null;
    if (score) {
        return candidates.sort((a, b) => (descending ? score(b) - score(a) : score(a) - score(b)))[0];
    }
    return lowestRarity
        ? candidates.sort((a, b) => (RARITY_RANK[a.rarity] ?? 9) - (RARITY_RANK[b.rarity] ?? 9))[0]
        : candidates[0];
}

// 每张卡现在都带一项简单招牌效果；教学怪从入门卡里挑，效果固定、不会引入复杂规则。
const isTutorialLow = card => card.type === "monster" && (Number(card.level) || 0) <= 4
    && (card.series === "starter_ygo" || !(card.effects?.length));

/**
 * 教学用的关键卡。
 * - learner：4 星以下入门怪兽里攻击力最高的那只（招牌效果简单），保证第 2 步一定打得赢对手的假想怪；
 * - dummy：攻击力 ≤1000 的弱怪，作为被攻击的目标；
 * - trap：任意一张陷阱，用来演示盖放与响应。
 */
export const TUTORIAL_CARDS = {
    get learner() { return pickCard(isTutorialLow, { score: card => card.attack || 0, descending: true }); },
    get dummy() { return pickCard(card => card.type === "monster" && (Number(card.level) || 0) <= 4 && (card.attack || 0) <= 1000, { score: card => card.attack || 0 }); },
    get trap() { return pickCard(card => card.type === "trap"); },
    get filler() { return pickCard(isTutorialLow, { score: card => card.attack || 0, descending: true }); },
};

/**
 * 教学卡组：40 张合法卡组（同名 ≤3 张）。
 * 起手会被 arrangeOpeningHands 固定成"能完成当前这一步"的组合。
 */
export function buildTutorialDecks() {
    const fill = TUTORIAL_CARDS.filler || TUTORIAL_CARDS.learner;
    const build = (extra = []) => {
        const deck = [];
        const counts = new Map();
        const push = id => {
            const used = counts.get(id) || 0;
            if (used >= 3) return false;
            counts.set(id, used + 1);
            deck.push(id);
            return true;
        };
        for (const card of extra) push(card.id);
        for (const card of [TUTORIAL_CARDS.learner, TUTORIAL_CARDS.trap, TUTORIAL_CARDS.filler].filter(Boolean)) {
            while (deck.length < 6 && push(card.id)) { /* 关键卡各放满 3 张 */ }
        }
        let cursor = 0;
        while (deck.length < 40) {
            const card = ALL_CARDS[cursor++ % ALL_CARDS.length];
            if (!card?.id || card.enabled === false) continue;
            push(card.id);
        }
        return deck;
    };
    return {
        player: build([TUTORIAL_CARDS.learner, TUTORIAL_CARDS.trap].filter(Boolean)),
        opponent: build([TUTORIAL_CARDS.dummy].filter(Boolean)),
        fill,
    };
}

/**
 * 把教学需要的手牌排到卡组最前面。
 * 需要卡组按原顺序构建（Player 的 preserveDeckOrder = true），否则洗牌会打乱脚本。
 */
export function orderTutorialDeck(deckIds, wanted, handSize = 5) {
    const remaining = [...deckIds];
    const front = [];
    for (const card of wanted) {
        if (!card) continue;
        const index = remaining.indexOf(card.id);
        if (index < 0) continue;
        front.push(remaining.splice(index, 1)[0]);
    }
    // 保证起手 5 张里既有教学卡，也有可用的低星怪兽
    const lowStar = remaining.filter(id => {
        const card = ALL_CARDS.find(item => item.id === id);
        return card?.type === "monster" && (Number(card.level) || 0) <= 4;
    });
    while (front.length < handSize && lowStar.length > 0) {
        const id = lowStar.shift();
        front.push(remaining.splice(remaining.indexOf(id), 1)[0]);
    }
    return [...front, ...remaining];
}

/**
 * 教学步骤。每一步要么是纯信息（no waitFor，玩家点「下一步」继续），
 * 要么等待某个具体动作完成。
 * waitFor 的取值必须与 controller.notifyTutorial() 发出的动作名一致。
 */
export const TUTORIAL_STEPS = [
    {
        id: "welcome",
        title: "欢迎来到决斗",
        text: "这一局是教学：我会一步一步告诉你要做什么。两边都是 8000 LP，把对方打到 0 就赢。先看看你的起手手牌——下面那排就是。",
        hint: "随时可以点右上角的「跳过教学」回到大厅。",
    },
    {
        id: "summon",
        title: "第 1 步 · 通常召唤",
        text: "点击手牌里的怪兽，选择「攻击表示召唤」，把它放到场上。每回合只能通常召唤 1 次，4 星以下不需要祭品。",
        hint: "也可以直接把卡拖到自己的怪兽区。",
        waitFor: "summon",
    },
    {
        id: "setTrap",
        title: "第 2 步 · 盖放陷阱",
        text: "点击手牌里的陷阱卡，选择「盖放陷阱」，把它放到自己的后场。盖放的陷阱要经过一次回合交换才能发动——所以本回合它还不能用。",
        hint: "盖放不占通常召唤次数，可以同一回合既召唤又盖牌。",
        waitFor: "set",
    },
    {
        id: "endTurn",
        title: "第 3 步 · 结束回合",
        text: "点右下角的「结束回合」。注意：先攻的第一个回合不能攻击，所以这一回合做完召唤和盖牌就该交棒了。",
        hint: "如果还有能召唤的怪兽，游戏会先跟你确认一次。",
        waitFor: "endTurn",
    },
    {
        id: "trapResponse",
        title: "第 4 步 · 陷阱在对手回合发动",
        text: "对手回合开始，他向你的怪兽发起攻击。你上回合盖下的陷阱这时会自动响应——陷阱的价值就在这里：它是你在对手回合唯一的反击手段。",
        hint: "战斗日志里能看到陷阱的发动与结算。",
        waitFor: "trap",
    },
    {
        id: "attack",
        title: "第 5 步 · 现在可以攻击了",
        text: "轮到你，而且不再是首回合——这正是攻击的时机。点击自己场上的怪兽会自动进入战斗阶段，再点对方的怪兽完成攻击：攻击力低的一方被破坏，双方差值的伤害由控制者承受。",
        hint: "选中攻击者后，对方怪兽上会直接显示这一击的结果。",
        waitFor: "attack",
    },
    {
        id: "mulligan",
        title: "第 6 步 · 起手重抽",
        text: "每局开局都可以重抽一次起手：把 5 张手牌洗回卡组重新抽。手里没有能立刻打出的牌时，别犹豫——重抽必定换到不同的牌。",
        hint: "AI 也只在自己没有可出牌时才重抽，规则对双方一致。",
    },
    {
        id: "finish",
        title: "教学结束",
        text: "你已经掌握了召唤、盖放陷阱、结束回合、陷阱时机、攻击和重抽。剩下的规则（祭品召唤、翻转、效果连锁）都能在「决斗规则」里查到，也可以在实战里边打边学。",
        hint: "祝你决斗顺利。",
        finish: true,
    },
];

const ACTION_LABELS = {
    summon: "召唤",
    set: "盖放",
    attack: "攻击",
    endTurn: "结束回合",
    turnStart: "回合开始",
    trap: "陷阱响应",
};

/**
 * 教练：负责显示当前步骤、监听玩家动作并推进。
 * 只依赖一个很小的 ui 接口（showCoach / hideCoach），便于在测试里替换。
 */
export class TutorialCoach {
    constructor({ ui, onFinish = null } = {}) {
        this.ui = ui;
        this.onFinish = onFinish;
        this.stepIndex = 0;
        this.finished = false;
        this.skipped = false;
        /** 教学需要 AI 主动进攻（第 5 步），由 controller 读取 */
        this.forceAiAttack = false;
    }

    get step() { return TUTORIAL_STEPS[this.stepIndex] || null; }

    get totalSteps() { return TUTORIAL_STEPS.length; }

    start() {
        this.stepIndex = 0;
        this.finished = false;
        this.skipped = false;
        this._render();
    }

    _render() {
        const step = this.step;
        if (!step) { this.hide(); return; }
        this.forceAiAttack = step.id === "trapResponse";
        this.ui?.showCoach?.({
            index: this.stepIndex + 1,
            total: this.totalSteps,
            title: step.title,
            text: step.text,
            hint: step.hint,
            waiting: Boolean(step.waitFor),
            finish: Boolean(step.finish),
            onNext: () => this.advance(),
            onSkip: () => this.skip(),
        });
    }

    /** 纯信息步骤（没有 waitFor）需要玩家点「下一步」；有 waitFor 的步骤由动作推进。 */
    advance() {
        const step = this.step;
        if (!step) return false;
        if (step.finish) { this.complete(); return true; }
        this.stepIndex = Math.min(this.stepIndex + 1, TUTORIAL_STEPS.length - 1);
        this._render();
        return true;
    }

    /** 玩家动作回调：只有当前步骤等待的动作才会推进。 */
    notify(action) {
        if (this.finished || this.skipped) return false;
        const step = this.step;
        if (!step?.waitFor || step.waitFor !== action) return false;
        this.stepIndex = Math.min(this.stepIndex + 1, TUTORIAL_STEPS.length - 1);
        this._render();
        return true;
    }

    skip() {
        this.skipped = true;
        this.hide();
        this.onFinish?.({ completed: false, skipped: true });
    }

    complete() {
        this.finished = true;
        this.hide();
        this.onFinish?.({ completed: true, skipped: false });
    }

    hide() {
        this.ui?.hideCoach?.();
    }

    /** 供测试/调试：当前是否在等待某个动作。 */
    get currentExpectation() {
        return this.step?.waitFor || null;
    }
}

export function actionLabel(action) {
    return ACTION_LABELS[action] || action;
}
