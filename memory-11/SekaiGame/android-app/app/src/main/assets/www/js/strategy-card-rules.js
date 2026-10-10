import { describeThemedAction } from "./themed-effects.js";

// Stage-two pilot: explicit card IDs, with timing, cost and counterplay reviewed together.
const PILOT = {
    water_008: { role: "保护展开", tradeoff: "需要保留场上怪兽，保护不阻止回手与除外", counter: "绕过破坏保护或先处理保护者", effects: [["manual", "shelter", "雨幕庇护", { amount: 200 }]] },
    water_009: { role: "寻找配套魔法", tradeoff: "只检查顶3张，不保证命中", counter: "压制场面，使其无法持续提供资源", effects: [["manual", "study", "序奏检索", { count: 3 }]] },
    water_010: { role: "贝斯补给与多属性合奏", attack: 1900, tradeoff: "后续抽卡须维持不同属性队友", counter: "破坏多属性场面，切断结束阶段补给", effects: [["onSummon", "study", "低音寻谱", { count: 2 }], ["onTurnEnd", "chorus", "低音合奏", { count: 2, draw: 1, heal: 0 }]] },
    picture_ex_094: { role: "用攻击机会换取续航", attack: 1850, tradeoff: "需要墓地怪兽和两种属性，发动后转守备并放弃攻击", counter: "清理墓地或拆掉不同属性队友", effects: [["manual", "ensemble", "舞台接力", { count: 2, draw: 1 }], ["manual", "ward", "主唱的决意", { amount: 150 }]] },
    picture_ex_095: { role: "保护乐队与维持火属性", attack: 1850, tradeoff: "不能单卡提供高额攻击提升", counter: "以回手、除外或效果无效突破保护", effects: [["onSummon", "shelter", "吉他伴奏", { amount: 150 }], ["manual", "charge", "失真蓄音", { amount: 150 }]] },
    picture_ex_021: { role: "准备一回合后连续攻击", tradeoff: "蓄力回合放弃攻击，释放需支付400LP", counter: "在准备回合移除、冻结或封印它", effects: [["manual", "tempoStrike", "一闪蓄势", { cost: 400 }]] },
    picture_ex_032: { role: "持续蓄力的前排", tradeoff: "强化需要留场多个回合", counter: "回手或除外重置累积优势", effects: [["manual", "charge", "音律蓄势", { amount: 250 }]] },
    picture_ssr7_010: { role: "蓄力后的精准解场", tradeoff: "两次蓄力、700LP及对应攻击增益换取除外", counter: "蓄力完成前移除或封印，避免堆积单一大怪", effects: [["manual", "railgun", "超电磁炮", { charges: 2, cost: 700 }], ["manual", "charge", "电荷积蓄", { amount: 200 }]] },
    picture_ex_030: { role: "提供引爆前置灼烧", attack: 2000, tradeoff: "主动支付400LP点燃，需要留场与引爆角色配合", counter: "净化、回手或作为祭品离场清除灼烧", effects: [["manual", "ignite", "炎之点燃", { stacks: 2, damage: 250 }, { type: "payLife", value: 400 }]] },
    picture_ex_027: { role: "消耗灼烧立即引爆", attack: 1900, tradeoff: "不能自行点燃，移除层数后不再持续灼烧", counter: "提前净化或让带标记怪兽离场", effects: [["manual", "combust", "爆血引燃", { damage: 600 }]] },
    picture_ex_037: { role: "持续消耗与抑制回复", tradeoff: "上级召唤及400LP换取一层剧毒", counter: "净化或移除中毒怪兽，避免拖延", effects: [["manual", "venom", "紫藤毒刺", { stacks: 1, damage: 250 }, { type: "payLife", value: 400 }]] },
};

// Stage-four batch: support roles use existing actions with explicit resource budgets.
const SUPPORT = {
    water_007: { role: "低星伙伴回收", tradeoff: "放弃本回合攻击并转守备，只回收墓地3星以下怪兽，不额外抽卡", counter: "除外墓地目标或封印回收者", theme: "以女仆照料伙伴的卡名意象设计回收；角色能力来源待核验", effects: [["manual", "recover", "归途迎接", { limit: 3, count: 1, draw: 0, rest: true }]] },
    picture_ex_084: { role: "低星检索与多属性协奏", tradeoff: "只看顶2张且只取4星以下；结束补给需要3种属性", counter: "拆掉不同属性队友，压制检索者", theme: "以流云与合奏意象设计寻找伙伴；不视为原著能力复现", effects: [["onTurnEnd", "chorus", "流云协奏", { count: 3, draw: 1, heal: 350 }], ["manual", "scout", "青瓷寻伴", { count: 2, limit: 4 }]] },
    picture_ex_086: { role: "恢复与净化支援", tradeoff: "恢复消耗己方墓地；净化支付400LP，不能无限免费解状态", counter: "清理己方墓地、效果封印或持续消耗LP", theme: "以雪原白夜的安抚意象设计净化，替代与支援定位无关的蓄力；项目机制改编", effects: [["onSummon", "sanctuary", "白夜安魂", { heal: 1800 }], ["manual", "purify", "雪原澄音", { count: 1 }, { type: "payLife", value: 400 }]] },
    nc_sp_ss_003: { role: "中后期资源循环", tradeoff: "须有3张其他墓地卡，且最后3张含两种属性的怪兽；回收后抽2；与复活、除外费用争夺墓地", counter: "先除外墓地资源，或在其积累前压制", theme: "以永续热忱的循环意象设计回收；项目机制改编", effects: [["manual", "recycle", "热忱返场", { count: 3, draw: 2, attributes: 2 }]] },
};
export const STRATEGY_PILOT_IDS = Object.keys(PILOT);
export const STRATEGY_SUPPORT_IDS = Object.keys(SUPPORT);
export function applyStrategyRules(card) {
    const design = SUPPORT[card.id] || PILOT[card.id];
    if (!design) return card;
    const timings = { manual: "自己的主要阶段", onSummon: "通常召唤成功时", onTurnEnd: "自己的结束阶段" };
    const effects = design.effects.map(([trigger, action, skillName, params, cost]) => ({
        type: "themedAction", action, trigger, skillName, params, oncePerTurn: true, hardOncePerTurn: true,
        skillLabel: trigger === "manual" ? "主动技" : trigger === "onSummon" ? "登场技" : "结束阶段技",
        ...(cost ? { cost } : {}),
        description: `${timings[trigger]}，同名此效果每回合1次：${cost ? `支付${cost.value}LP；` : ""}${describeThemedAction({ action, params })}。`,
    }));
    return {
        ...card, effects, ...(design.attack ? { attack: design.attack } : {}),
        description: effects.map(e => `【${e.skillName}】${e.description}`).join("\n"),
        ruleSignature: `strategy-${SUPPORT[card.id] ? "v2" : "v1"}:${card.id}`, rulesVersion: SUPPORT[card.id] ? "2026-10-strategy-v2" : "2026-10-strategy-v1",
        strategyDesign: { role: design.role, tradeoff: design.tradeoff, counter: design.counter, ...(design.theme ? { adaptation: design.theme, sourceVerified: false } : {}) },
        designNotes: { ...card.designNotes, resourcePlan: design.tradeoff },
    };
}
