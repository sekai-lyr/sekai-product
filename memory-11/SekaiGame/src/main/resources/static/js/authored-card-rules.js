import { ACTION_TEXT, describeThemedAction } from "./themed-effects.js";
import { getMonsterCinematicProfile } from "./monster-cinematics.js?v=1.2.0";
import { pickSignatureAction, SIGNATURE_SKILL_NAMES } from "./signature-rules.js?v=1.0.0";
import { paramCandidatesFor, extendParamCandidates } from "./signature-tuning.js?v=1.0.0";
import { animeDirectionProfile, rarityPowerBudget, tuneParamsByRarity } from "./anime-direction-profiles.js?v=1.0.0";

// Each row is an authored card assignment, in printed catalogue order.
// S = normal summon, M = ignition, D = destroyed, E = own end phase.
// Similar characters share tools, but card variants use different timing/resources.
const RECIPES = {};
function rows(prefix, first, text) {
    text.trim().split("\n").forEach((row, index) => {
        RECIPES[`${prefix}${String(first + index).padStart(3, "0")}`] = row.trim();
    });
}
rows("picture_ssr7_", 1, `
S:token M:exchange D:inherit
S:scout M:charge M:burst
S:prepare M:revive E:chorus
S:sanctuary M:purify D:inherit
S:study M:exchange E:chorus
S:freeze M:recycle D:recover
S:charge M:burst D:prepare
S:charge M:bomb M:burst
S:token M:exchange D:recover
S:charge M:seal M:burst
S:freeze M:ward D:inherit
S:prepare M:twin D:recover
S:charge M:twin M:burst
S:study M:seal D:inherit
S:shelter M:pierce D:prepare
S:prepare M:bomb D:ambush
S:prepare M:sanctuary D:recover
S:scout M:deploy D:inherit
S:purify M:seal D:inherit
S:scout M:deploy E:chorus
S:ward M:pierce D:inherit
S:purify M:twin D:recover
S:study M:sleep D:recover
S:recover M:recycle E:chorus
S:charge M:pierce M:burst
S:scout M:deploy D:recover
S:token M:sanctuary D:revive
S:shelter M:poison D:inherit
S:prepare M:poison D:revive
S:deploy M:study E:chorus
S:recover M:exchange D:inherit
S:seal M:sleep D:recover
S:token M:exchange D:revive
S:shelter M:pierce D:recover
S:scout M:exchange E:chorus
S:study M:recycle D:recover
S:poison M:sleep D:purify
S:ward M:seal D:recover
S:charge M:twin D:inherit
S:recover M:shelter E:chorus
S:shelter M:recover D:inherit
S:prepare M:recover D:study
S:freeze M:study D:recover
S:purify M:recycle E:chorus
S:ward M:exchange D:recover
S:prepare M:study D:recycle
S:charge M:pierce D:inherit
S:study M:deploy D:recover
S:prepare M:revive D:recycle
S:sleep M:exchange D:recover
S:scout M:twin D:recover
S:shelter M:seal D:recover
S:prepare M:recall D:inherit
S:sleep M:recycle E:chorus
S:token M:deploy E:chorus
S:ambush M:study D:recover
S:recover M:sanctuary E:chorus
S:scout M:shelter E:chorus
S:ward M:purify D:inherit
`);
rows("picture_ex_", 1, `
M:revive M:shelter
M:purify M:recall
M:scout M:recover
M:prepare M:sanctuary
M:recycle M:scout
M:seal M:study
M:token M:exchange
M:deploy M:scout
M:study M:ambush
M:scout M:purify
S:charge M:freeze M:burst
S:prepare M:bomb D:ambush
S:freeze M:ward D:recover
S:charge M:twin M:burst
S:ward M:purify D:inherit
S:shelter M:sanctuary D:recover
S:token M:exchange D:inherit
S:shelter M:ward D:revive
S:charge M:pierce
S:seal M:poison
S:charge M:twin
S:shelter M:deploy
S:shelter M:purify
S:poison M:study
S:shelter M:freeze
S:scout M:pierce
S:prepare M:purify
S:ward M:sleep
S:scout M:twin
S:charge D:inherit
S:purify M:pierce
S:study M:charge
S:freeze M:shelter
S:ward M:poison
S:shelter M:pierce
S:sleep M:ward
S:prepare M:poison
S:recover M:shelter
S:charge M:burst
S:prepare M:sanctuary
S:purify D:inherit
S:charge M:burst
S:freeze M:pierce
S:purify M:seal
S:scout M:exchange
S:poison M:twin
S:charge M:bomb
S:charge M:burst
S:sleep M:exchange
S:charge M:burst
S:study M:scout
S:shelter M:ward
S:sleep M:poison
S:charge D:recover
S:freeze M:poison
S:study M:seal
S:poison D:purify
S:prepare M:sleep
S:scout M:twin
S:prepare M:recycle
S:shelter D:inherit
S:recover M:recycle
S:charge M:pierce
S:recover M:deploy
S:charge D:inherit
S:sleep M:study
S:charge M:bomb
S:charge M:burst
S:seal M:sleep
S:charge M:twin
D:inherit
D:returnSelf M:study
S:shelter M:ward
S:token M:sleep
S:charge M:burst
S:prepare M:revive
S:token M:shelter
S:charge M:pierce
S:sanctuary M:pierce
S:study M:seal
S:token M:exchange
S:deploy M:study E:chorus
S:sleep M:recall E:chorus
S:scout M:exchange E:chorus
S:seal M:study D:recover
S:prepare M:revive E:chorus
S:study M:recycle D:inherit
S:scout M:deploy E:chorus
S:ward M:exchange D:recover
S:charge M:burst D:purify
S:prepare M:sleep D:recover
S:scout M:exchange D:inherit
S:study M:recycle E:chorus
S:purify M:deploy E:chorus
S:recover M:shelter E:chorus
S:scout M:deploy D:recover
S:study M:prepare D:recover
S:prepare M:revive E:chorus
S:shelter M:sanctuary D:recover
S:token M:exchange E:chorus
S:prepare M:recycle E:chorus
S:charge M:burst D:purify
S:prepare M:bomb D:revive
S:charge M:burst D:inherit
S:prepare M:burst E:charge
S:purify M:pierce E:charge
S:deploy M:recycle E:chorus
M:scout M:deploy
M:study M:shelter
M:recover M:revive
M:deploy M:chorus
M:seal M:study
M:exchange M:shelter
M:study M:recover
M:shelter M:recycle
M:sleep M:recall
M:study M:ambush
M:recall M:revive M:shelter
M:recycle M:recover M:deploy
`);
rows("source_monster_", 1, `
M:seal
M:sleep
M:study
S:prepare M:bomb D:returnSelf
S:scout M:exchange D:inherit
S:shelter M:deploy D:recover
S:study M:seal D:recall
S:charge M:burst D:purify
S:study M:ward D:recover
S:ward M:seal D:inherit
S:charge M:burst E:charge
S:prepare M:bomb D:purify
S:charge M:burst D:inherit
S:charge M:pierce M:burst
S:seal M:freeze D:study
S:ward M:sanctuary D:inherit
S:prepare M:revive D:purify
S:purify M:recall E:charge
S:prepare M:burst E:charge
S:deploy M:recycle E:chorus
`);
rows("source_spell_", 21, `
M:freeze M:recover M:chorus
M:scout M:deploy M:shelter
`);
// 陷阱配方重做（见 OPTIMIZATION_REPORT.md 第五轮）：
// 之前 28/28 张都带"这次攻击无效"（intercept/mirror/rescue/reversal/retreat/reprisal），
// 导致全卡池 84% 的陷阱都是同一种效果、且无效化零代价 —— 平衡实验室里"堆陷阱"取向
// 胜率 92.5%。现在只保留 12 张无效化陷阱（每种无效化行动都仍有代表），
// 其余 16 张改成"不取消攻击、但确实赚到东西"的身份：检索、回收、消耗（毒/爆破）、干扰（封印）。
// 卡面文字由 ACTION_TEXT 生成，所以改配方 = 改卡面，不会出现文字与结算不一致。
rows("source_trap_", 23, `
M:intercept M:sleep
M:rescue M:shelter
M:mirror M:recover
M:seal M:study
M:seal M:purify
M:reversal M:recover
M:retreat M:scout
M:purify M:recycle
M:scout M:ambush
M:mirror M:freeze
M:poison M:recycle
M:study M:ambush
M:study M:scout
M:reprisal M:purify
M:purify M:seal M:study
M:seal M:shelter M:recover
M:study M:recycle M:recall
M:seal M:purify M:sanctuary
M:shelter M:sanctuary M:recover
M:seal M:purify M:recycle
M:sanctuary M:recover M:recycle
M:purify M:recycle M:study
M:recover M:recall M:sanctuary
M:scout M:study M:ambush
M:shelter M:recover M:study
M:purify M:sanctuary M:chorus
M:bomb M:recover M:purify
M:poison M:bomb
`);
rows("water_", 7, `
M:recover
M:shelter
M:study
S:prepare M:recycle E:chorus
S:sleep M:exchange D:recover
`);
RECIPES.dark_006 = "S:seal M:sleep E:charge";
rows("nc_sp_ur_", 1, `
M:prepare M:recall M:recover
M:scout M:deploy M:chorus
M:sleep M:exchange M:study
M:recover M:sanctuary M:shelter
M:prepare M:bomb M:purify
M:purify M:deploy M:chorus
M:sleep M:study M:shelter
M:prepare M:recover M:ambush
M:scout M:deploy M:shelter
M:study M:scout M:recycle
M:freeze M:recover M:recycle
M:prepare M:recall M:study
`);
rows("nc_sp_ss_", 1, `
M:prepare M:exchange
M:recover M:sanctuary
M:recycle M:ambush
M:prepare M:revive
M:deploy M:chorus
M:sleep M:study
`);
rows("nc_tr_", 1, `
M:study M:recover M:sanctuary
M:purify M:recall M:study
M:recover M:recall M:recycle
M:scout M:study M:purify
M:purify M:shelter M:sanctuary
`);
rows("gallery_spell_", 8, `
M:deploy M:chorus
M:exchange M:shelter
M:purify M:recall
M:recover M:ambush
M:scout M:exchange
M:study M:deploy
M:recall M:exchange
M:sleep M:shelter
M:scout M:deploy
M:exchange M:purify
M:study M:seal
M:recover M:recycle
M:prepare M:bomb
M:recover M:study
M:recall M:deploy
M:shelter M:exchange
M:sleep M:recall
M:scout M:shelter
M:study M:token
M:deploy M:chorus
M:purify M:recover
M:recover M:shelter
M:study M:exchange
M:study M:ambush
M:exchange M:seal
M:seal M:shelter
M:prepare M:revive
M:freeze M:recover
M:prepare M:sanctuary
M:recycle M:shelter
M:recover M:chorus
M:token M:shelter
M:scout M:chorus
M:deploy M:ambush
M:study M:scout
M:scout M:recover
M:token M:exchange
M:prepare M:recycle
M:purify M:ambush
M:prepare M:revive
M:scout M:deploy
M:deploy M:chorus
M:recall M:recover
`);
Object.assign(RECIPES, {
    picture_ex_017: "S:token M:devour D:inherit",
    picture_ex_086: "S:recover M:revive E:chorus",
    picture_ex_098: "S:prepare M:revive D:study",
    picture_ex_014: "S:charge M:twin D:ambush",
    picture_ex_012: "S:ambush M:bomb D:prepare",
    picture_ex_088: "S:study M:deploy E:chorus",
    source_monster_014: "S:charge M:bomb D:purify",
    picture_ex_096: "S:scout M:deploy D:recall",
    picture_ex_082: "S:token M:study E:chorus",
    picture_ex_084: "S:recover M:exchange E:chorus",
    picture_ex_095: "S:shelter M:recycle E:chorus",
    picture_ex_089: "S:ward M:exchange D:recall",
    water_011: "S:sleep M:exchange D:study",
    picture_ex_015: "S:ward M:ambush D:inherit",
    gallery_spell_010: "M:purify M:sleep",
    gallery_spell_043: "M:scout M:recall",
    gallery_spell_036: "M:sanctuary M:revive",
    picture_ex_112: "M:seal M:ambush",
    gallery_spell_044: "M:token M:scout",
    picture_ex_117: "M:study M:sleep",
    gallery_spell_031: "M:ambush M:study",
    picture_ex_099: "S:shelter M:recover D:recycle",
    picture_ex_063: "S:pierce D:inherit",
    picture_ex_078: "S:seal M:pierce",
    picture_ex_070: "M:charge M:twin",
    picture_ex_059: "S:prepare M:twin",
    picture_ex_065: "S:study D:inherit",
    picture_ex_042: "S:charge M:devour",
    picture_ex_048: "M:charge M:burst",
    picture_ex_050: "S:pierce M:charge",
    picture_ex_068: "E:charge M:burst",
    picture_ex_075: "S:charge M:timeStop",
    picture_ex_067: "S:ambush M:bomb",
    picture_ex_073: "S:ward M:shelter",
    picture_ex_080: "S:study M:bomb",
    picture_ex_102: "S:charge M:burst D:bomb",
    source_monster_008: "S:purify M:devour D:inherit",
    source_monster_005: "S:scout M:shelter D:inherit",
    water_010: "S:study M:recycle D:recall",
    source_monster_013: "S:charge M:burst D:study",
    source_monster_019: "S:prepare M:devour E:charge",
    source_monster_020: "S:scout M:recycle E:chorus",
    gallery_spell_016: "M:deploy M:recall",
    gallery_spell_048: "M:deploy M:sanctuary",
    nc_sp_ss_005: "M:recycle M:chorus",
    gallery_spell_008: "M:exchange M:chorus",
    gallery_spell_027: "M:deploy M:purify",
    gallery_spell_049: "M:token M:chorus",
    gallery_spell_009: "M:exchange M:recover",
    gallery_spell_024: "M:recall M:shelter",
    source_monster_003: "M:scout",
    source_spell_022: "M:study M:deploy M:shelter",
    gallery_spell_034: "M:revive M:purify",
    gallery_spell_047: "M:revive M:sanctuary",
    picture_ex_011: "S:charge M:timeStop M:twin",
    picture_ex_013: "S:charge M:timeStop D:recover",
    gallery_spell_058: "M:recover M:deploy M:chorus",
    gallery_spell_061: "M:recover M:recycle M:shelter",
    gallery_spell_062: "M:prepare M:revive M:chorus",
    gallery_spell_066: "M:recall M:recover M:deploy",
    gallery_spell_067: "M:scout M:deploy M:purify",
    gallery_spell_068: "M:freeze M:seal M:study",
    gallery_spell_069: "M:prepare M:recall M:revive",
    gallery_spell_070: "M:exchange M:shelter M:chorus",
    // 后场对策只放在 SR（rank 2）上：它是一次 1 换 1 的功能解，必须是零代价；
    // 放在高稀有度卡上、再收一笔费用，等于让这张卡变成废卡（见 SPELL_LIFE_COSTS 的设计说明）。
    picture_ex_003: "M:disarm M:recover",
    picture_ex_006: "M:disarm M:study",
    picture_ex_010: "M:disarm M:purify",
    picture_ex_108: "M:disarm M:deploy",
    picture_ex_113: "M:disarm M:shelter",
    picture_ex_115: "M:disarm M:recycle",
});

// 30 张试点卡（状态异常/领域/赌运）改为单动作配方，触发沿用各自角色设定；
// 具体数值由 signature-tuning.js 的候选池按目录顺序发放（见 §7 变更表）。
Object.assign(RECIPES, {
    picture_ex_030: "S:ignite", picture_ex_037: "M:venom", picture_ex_020: "M:bleed",
    picture_ex_048: "M:paralyze", picture_ex_027: "S:detonate", picture_ex_056: "M:domain",
    picture_ex_011: "M:domain", picture_ex_012: "M:detonate", picture_ex_013: "M:paralyze",
    picture_ex_014: "M:bleed", picture_ex_018: "M:exile",
    source_monster_015: "M:domain", source_monster_010: "S:infinity", source_monster_012: "M:bleed",
    source_monster_014: "M:ignite", source_monster_013: "M:detonate", source_monster_008: "M:curse",
    picture_ex_072: "D:exile",
    picture_ssr7_032: "S:curse", picture_ssr7_036: "S:gamble", picture_ssr7_043: "S:paralyze",
    picture_ssr7_026: "S:ignite", picture_ssr7_049: "M:bleed", picture_ex_107: "M:domain",
    picture_ssr7_007: "M:ignite", picture_ssr7_016: "M:detonate", picture_ssr7_003: "M:exile",
    picture_ssr7_013: "M:bleed", picture_ssr7_014: "M:curse", picture_ssr7_015: "M:bleed",
    // 原作语义复核：洞察/感知角色进入情报轴，靠运气与临场发挥的角色进入赌博轴。
    picture_ex_073: "S:recon", picture_ex_074: "M:recon", picture_ex_051: "S:recon",
    picture_ex_009: "M:gamble", picture_ex_117: "M:recon",
    gallery_spell_018: "M:recon", nc_sp_ur_010: "M:gamble",
    nc_sp_ur_010: "M:dice", gallery_spell_044: "M:dice",
    source_monster_009: "S:scry", gallery_spell_068: "M:scry",
    picture_ex_117: "M:mindgame", gallery_spell_018: "M:mindgame",
    picture_ssr7_031: "S:mindgame", picture_ssr7_042: "S:emotion",
    picture_ssr7_044: "S:emotion", picture_ssr7_050: "S:emotion",
    picture_ex_085: "S:emotion", picture_ex_086: "S:emotion", picture_ex_087: "S:emotion", picture_ex_089: "S:emotion",
});

const TRIGGERS = { S: "onSummon", M: "manual", D: "onDestroyed", E: "onTurnEnd" };
const TIMING = {
    onSummon: "通常召唤成功时", manual: "主要阶段", onDestroyed: "被破坏送入墓地时",
    onTurnEnd: "自己的结束阶段", onAttacked: "对方攻击宣言时",
    onOpponentSummon: "对方召唤怪兽时", onOpponentSpell: "对方发动魔法时",
    onOpponentEffect: "对方发动怪兽效果时", onOpponentDraw: "对方在抽卡阶段外抽牌时",
    onCardDestroyed: "场上的卡被破坏送入墓地时",
};

const TRAP_TRIGGER_BY_ACTION = {
    intercept: "onAttacked", mirror: "onAttacked", rescue: "onAttacked", reversal: "onAttacked",
    retreat: "onAttacked", reprisal: "onAttacked", shelter: "onAttacked", freeze: "onOpponentSummon",
    sleep: "onOpponentSummon", poison: "onOpponentSummon", bomb: "onOpponentSummon", ignite: "onOpponentSummon",
    venom: "onOpponentSummon", bleed: "onOpponentSummon", curse: "onOpponentSummon", paralyze: "onOpponentSummon",
    disarm: "onOpponentSpell", ward: "onOpponentSpell", seal: "onOpponentEffect", infinity: "onOpponentEffect",
    recon: "onOpponentDraw", mindgame: "onOpponentDraw", gamble: "onOpponentDraw", dice: "onOpponentDraw",
    recover: "onCardDestroyed", revive: "onCardDestroyed", purify: "onCardDestroyed", inherit: "onCardDestroyed",
    ambush: "onCardDestroyed", recall: "onCardDestroyed", sanctuary: "onCardDestroyed",
};

function trapTrigger(card, action) {
    if (TRAP_TRIGGER_BY_ACTION[action]) return TRAP_TRIGGER_BY_ACTION[action];
    const windows = ["onAttacked", "onOpponentSummon", "onOpponentSpell", "onOpponentEffect", "onOpponentDraw", "onCardDestroyed"];
    const seed = [...`${card.id}|${card.name}`].reduce((value, char) => Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0, 2166136261);
    return windows[seed % windows.length];
}

// 魔法代价策略（面向大众可玩性）：
// - 正式配方的魔法默认免费。发动魔法本身已经消耗一张手牌，再叠加"随机弃牌"是双重
//   损失：玩家无法控制丢哪张，抽到 UR 反而不敢用，是最劝退新人的一种代价。
// - 只有真正需要限制的禁术级效果才收费，且一律使用可预期、不亏牌的 LP，
//   金额按效果强度分档（见 SPELL_LIFE_COSTS）——付不起时引擎不会发动、也不会
//   消耗这张卡（engine.activateSpell / activateSetSpell 的干跑校验）。
// - 陷阱不收费：45 张陷阱的强度已由攻击响应规则与"付不起不消耗"机制约束；
//   1 换 1 的实用魔法（例如拆后场 disarm）必须保持免费，否则会变成废卡。
const SPELL_LIFE_COSTS = {
    nc_sp_ur_005: 500,      // 碎穹：延迟破坏对方怪兽 + 900 伤害
    nc_sp_ur_012: 300,      // 寄往遥远彼岸的信：归还 1 张 + 抽 1 张 + 回复 400
    gallery_spell_066: 600, // 心印同框·八千年的契约：一次归还 3 张
    gallery_spell_069: 800, // 异世残绪：一次归还 3 张 + 回复 400
};

function authoredEffectCost(card) {
    if (card.type !== "spell") return undefined;
    const life = SPELL_LIFE_COSTS[card.id];
    return life ? { type: "payLife", value: life } : undefined;
}
const LABELS = {
    scout: "寻找伙伴", study: "构思", prepare: "积累记忆", recover: "重逢", recycle: "往复", deploy: "登台", revive: "再演", recall: "越界归来",
    shelter: "庇护", seal: "封印", sleep: "幻梦", freeze: "静止", poison: "毒蝶", bomb: "引爆", charge: "蓄势", burst: "解放",
    twin: "连击", pierce: "贯穿", ward: "界限", ambush: "伏线", token: "替身", exchange: "交替", chorus: "合奏", sanctuary: "献祭祈愿",
    purify: "净化", intercept: "阻断", mirror: "映照", rescue: "救援", reversal: "反转", retreat: "撤离", reprisal: "追偿", returnSelf: "死亡回归", inherit: "传承", devour: "吞噬", timeStop: "时间停止",
    disarm: "拆解", recon: "洞察", gamble: "命运判定", dice: "命运骰", scry: "观星", mindgame: "心理战", emotion: "情绪觉醒",
};
const LEGACY_DESIGN_DIRECTIONS = {
    poison: "毒印控制", venom: "毒印控制", bleed: "毒印控制", curse: "毒印控制", purify: "毒印控制", reprisal: "毒印控制",
    freeze: "冰冻封锁", sleep: "冰冻封锁", seal: "冰冻封锁", paralyze: "冰冻封锁",
    ignite: "灼烧爆发", detonate: "灼烧爆发",
    bomb: "炸弹延迟", burst: "炸弹延迟",
    gamble: "硬币赌博", dice: "骰子命运",
    recon: "情报侦察", disarm: "情报侦察", ambush: "情报侦察",
    scry: "预知观星", scout: "预知观星", study: "预知观星", prepare: "预知观星",
    mindgame: "心理博弈",
    timeStop: "时间操控", exile: "时间操控",
    returnSelf: "死亡回归", revive: "死亡回归",
    domain: "领域压制",
    infinity: "护盾反击", ward: "护盾反击", shelter: "护盾反击", mirror: "护盾反击", intercept: "护盾反击", reversal: "护盾反击",
    twin: "连击追击", charge: "连击追击", pierce: "连击追击", devour: "连击追击",
    token: "召唤替身", exchange: "召唤替身", deploy: "召唤替身",
    recover: "墓地循环", recycle: "墓地循环", recall: "墓地循环", sanctuary: "墓地循环", inherit: "墓地循环", rescue: "墓地循环", retreat: "墓地循环",
    chorus: "乐队合奏",
    emotion: "情绪觉醒",
};
const CHARACTER_SKILLS = {
    picture_ex_017: { token: "恐龙化", devour: "群猎本能", inherit: "兽群传承" },
    picture_ex_011: { charge: "白金蓄势", timeStop: "白金之星·世界", twin: "欧拉连打" },
    picture_ex_012: { ambush: "无声布置", bomb: "第一炸弹", prepare: "败者伏线" },
    picture_ex_072: { returnSelf: "死亡回归", study: "记忆推演" },
    source_monster_010: { ward: "无下限", seal: "术式干涉", inherit: "术式传承" },
    source_monster_013: { charge: "苍与赫", burst: "虚式茈", study: "六眼推演" },
};
// 30 张试点卡的技能名固定在这里，动作变化时不会漂移到通用模板名。
Object.assign(CHARACTER_SKILLS, {
    picture_ex_030: { ignite: "炎之呼吸·不知火" },
    picture_ex_037: { venom: "虫之呼吸·毒刃·紫藤毒" },
    picture_ex_020: { bleed: "蛇之呼吸·委蛇斩" },
    picture_ex_048: { paralyze: "霹雳一闪·火雷神" },
    picture_ex_027: { detonate: "血鬼术·爆血" },
    picture_ex_056: { domain: "破坏杀·罗针" },
    picture_ex_011: { domain: "白金之星·世界" },
    picture_ex_012: { detonate: "第一炸弹" },
    picture_ex_013: { paralyze: "世界·时停突袭·THE WORLD" },
    picture_ex_014: { bleed: "性感手枪·弹道折射" },
    picture_ex_018: { exile: "D4C·爱之列车" },
    source_monster_015: { domain: "领域展开·无量空处" },
    source_monster_010: { infinity: "无下限" },
    source_monster_012: { bleed: "伏魔御厨子·解" },
    source_monster_014: { ignite: "开·炎矢" },
    source_monster_013: { detonate: "虚式茈" },
    source_monster_008: { curse: "解·空间斩·狱纹" },
    picture_ex_072: { exile: "死亡回归" },
    picture_ssr7_032: { curse: "沉默琴弦·沉默枷锁" },
    picture_ssr7_036: { gamble: "自由即兴·即兴曲" },
    picture_ssr7_043: { paralyze: "人偶键盘·雪夜独奏" },
    picture_ssr7_026: { ignite: "粉色和弦·点燃全场" },
    picture_ssr7_049: { bleed: "暗潮低音" },
    picture_ex_107: { domain: "未来音浪·苍穹音浪" },
    picture_ssr7_007: { ignite: "莱万汀·熔核烈歌" },
    picture_ssr7_016: { detonate: "D12·赤痕爆破" },
    picture_ssr7_003: { exile: "深海潮歌·深海夜宴" },
    picture_ssr7_013: { bleed: "过载模式·红莲铳火" },
    picture_ssr7_014: { curse: "奇美拉·星屑天幕" },
    picture_ssr7_015: { bleed: "沸腾爆裂·炎锯镇岳" },
    picture_ex_073: { recon: "白眼·洞察" },
    picture_ex_074: { recon: "写轮眼·看破" },
    picture_ex_051: { recon: "兽之呼吸·空间感知" },
    picture_ex_009: { gamble: "战斗潮流·下一句话" },
    picture_ex_117: { recon: "高木同学的恶作剧·看穿" },
    gallery_spell_018: { recon: "恋爱头脑战·心理读取" },
    nc_sp_ur_010: { gamble: "游戏王座·命运抽选" },
    nc_sp_ur_010: { dice: "游戏王座·命运骰" },
    gallery_spell_044: { dice: "游缘升契·命运骰" },
    source_monster_009: { scry: "六眼·苍瞳观测" },
    gallery_spell_068: { scry: "星界瞬刻·未来观测" },
    picture_ex_117: { mindgame: "高木同学的恶作剧·猜心" },
    gallery_spell_018: { mindgame: "恋爱头脑战·先手宣言" },
    picture_ssr7_031: { mindgame: "迷途之声·表里低音" },
    picture_ssr7_042: { emotion: "迷茫独白·决意" },
    picture_ssr7_044: { emotion: "无刺之歌·呐喊" },
    picture_ssr7_050: { emotion: "微笑假面·裂痕" },
    picture_ex_085: { emotion: "静默旋律·自我寻找" },
    picture_ex_086: { emotion: "雪原白夜·救赎之曲" },
    picture_ex_087: { emotion: "迷途画境·执笔" },
    picture_ex_089: { emotion: "粉黛之心·真我" },
});
export function hasAuthoredRules(id) { return Object.hasOwn(RECIPES, id); }

const SIGNATURE_PARAMS = new Map();

/** SSR/UR 怪兽的第二条"支援余响"：低强度、可控、无目标选择，用于增加组合与手感。 */
const SECONDARY_SUPPORT = [
    { action: "scout", params: { count: 2 }, name: "余响·寻找" },
    { action: "study", params: { count: 2 }, name: "余响·构思" },
    { action: "charge", params: { amount: 150 }, name: "余响·蓄势" },
    { action: "ward", params: { amount: 300 }, name: "余响·守护" },
];

function stableHash(text) {
    let hash = 2166136261;
    for (const character of String(text)) {
        hash ^= character.codePointAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash);
}

/** 同一动作的每张卡按目录顺序领取不同参数，保证全卡池参数唯一；角色画像改写动作后仍能在新动作组内领到参数。 */
export function prepareSignatureParams(cards) {
    SIGNATURE_PARAMS.clear();
    const byId = new Map(cards.map(card => [card?.id, card]));
    // 按“最终动作”（应用角色画像后）整组发放：被改写动作的卡不再落入空参数默认值。
    const groups = new Map();
    for (const card of cards) {
        if (!card || card.series === "starter_ygo" || !hasAuthoredRules(card.id)) continue;
        const { action } = signatureTarget(card);
        if (!action) continue;
        if (!groups.has(action)) groups.set(action, []);
        groups.get(action).push(card.id);
    }
    const COUNT_KEYS = new Set(["count", "limit", "stacks", "turns", "draw"]);
    for (const [action, ids] of groups) {
        const base = paramCandidatesFor(action);
        const candidates = ids.length > base.length ? extendParamCandidates(base, ids.length) : base;
        if (ids.length > candidates.length) console.warn(`[signature] 参数候选不足：${action}（${ids.length} 张）`);
        // 稀有度缩放/四舍五入可能把两个候选压成同一个有效值，这里按最终生效值去重微调。
        const used = new Set();
        ids.forEach((id, index) => {
            const card = byId.get(id);
            const candidate = { ...(candidates[index % candidates.length] || {}) };
            let effective = tuneParamsByRarity(action, candidate, card?.rarity);
            let guard = 0;
            while (used.has(JSON.stringify(effective)) && guard++ < 60) {
                const numericKey = Object.keys(candidate).find(key => typeof candidate[key] === "number");
                if (numericKey === undefined) break;
                const step = COUNT_KEYS.has(numericKey) ? 1 : 50;
                candidate[numericKey] = Number(candidate[numericKey]) + step * guard;
                effective = tuneParamsByRarity(action, candidate, card?.rarity);
            }
            used.add(JSON.stringify(effective));
            SIGNATURE_PARAMS.set(id, candidate);
        });
    }
}

function signatureTargetIn(recipes, card, applyProfile = true) {
    const recipe = recipes[card.id];
    if (!recipe) return { action: null, trigger: null };
    const parts = recipe.split(" ");
    const actions = parts.map(part => part.split(":")[1]);
    const baseAction = pickSignatureAction(card.id, actions);
    const [timing] = parts.find(part => part.endsWith(`:${baseAction}`)).split(":");
    const profile = applyProfile ? animeDirectionProfile(card, baseAction) : { action: baseAction };
    return { action: profile.action, baseAction, trigger: card.type === "trap" ? trapTrigger(card, profile.action) : TRIGGERS[timing] };
}

export function signatureTarget(card) {
    return signatureTargetIn(RECIPES, card);
}

function signatureSkillName(card, action, motif) {
    if (card.type === "monster") {
        const profile = getMonsterCinematicProfile(card);
        if (profile?.characterSpecific) {
            const move = profile.signatureMove;
            return move.includes(motif) ? move : `${move}·${motif}`;
        }
    }
    return `${motif}·${LABELS[action]}`;
}

export function authoredCardRules(card) {
    if (card.series === "starter_ygo") return card;
    const recipe = RECIPES[card.id];
    if (!recipe) throw new Error(`缺少逐卡设计：${card.id} ${card.name}`);
    const rank = { N: 0, R: 1, SR: 2, SSR: 3, UR: 4 }[card.rarity];
    const motif = card.name.split(/[·・]/).at(-1);
    const { action, baseAction, trigger } = signatureTarget(card);
    const rawParams = SIGNATURE_PARAMS.get(card.id) || {};
    const params = tuneParamsByRarity(action, rawParams, card.rarity);
    const directionProfile = animeDirectionProfile(card, action);
    const skillName = CHARACTER_SKILLS[card.id]?.[action] || SIGNATURE_SKILL_NAMES[card.id] || signatureSkillName(card, action, motif);
    // 登场即强控的回合（冻结/睡眠/中毒/灼烧/诅咒/放逐等）必须支付 LP 代价：
    // 零代价的群体/单体控制是旧卡池"免费强控"问题的主要来源。
    const SUMMON_COST_ACTIONS = new Set(["freeze", "sleep", "poison", "bomb", "ignite", "venom", "bleed", "curse", "detonate", "paralyze", "seal", "exile"]);
    const onSummonCost = trigger === "onSummon" && card.type === "monster" && SUMMON_COST_ACTIONS.has(action)
        ? { type: "payLife", value: 300 + rank * 100 }
        : null;
    const cost = authoredEffectCost(card) || onSummonCost;
    const costText = cost?.type === "discard" ? `丢弃${cost.value}张手牌；` : cost?.type === "payLife" ? `支付${cost.value}LP；` : "";
    const description = `${TIMING[trigger]}，同名此效果每回合1次：${costText}${describeThemedAction({ action, params })}。`;
    const skillLabel = {
        onSummon: "登场技", manual: "主动技", onDestroyed: "遗志技", onTurnEnd: "结束阶段技",
        onAttacked: "攻击陷阱", onOpponentSummon: "召唤陷阱", onOpponentSpell: "魔法陷阱",
        onOpponentEffect: "效果陷阱", onOpponentDraw: "情报陷阱", onCardDestroyed: "墓地陷阱",
    }[trigger];
    const effects = [{ type: "themedAction", action, trigger, skillName, skillLabel, description, oncePerTurn: true, hardOncePerTurn: true, params, ...(cost ? { cost } : {}) }];
    // SSR/UR 怪兽额外获得一条通用支援余响：稀有度不再只等于数值，而是多一个可组合的行动。
    if (card.type === "monster" && (card.rarity === "SSR" || card.rarity === "UR")) {
        const support = SECONDARY_SUPPORT[stableHash(card.id) % SECONDARY_SUPPORT.length];
        effects.push({
            type: "themedAction", action: support.action, trigger: "manual",
            skillName: support.name, skillLabel: "辅助技",
            description: `${TIMING.manual}，同名此效果每回合1次：${describeThemedAction({ action: support.action, params: support.params })}。`,
            oncePerTurn: true, hardOncePerTurn: true, params: { ...support.params },
        });
    }
    // Printed rarity does not silently inflate level-4 bodies into tribute bosses.
    const level = Number(card.level) || 1;
    const cap = level <= 4 ? 1900 + rank * 50 : level <= 6 ? 2400 + rank * 50 : 2800 + rank * 100;
    const duelPowerTier = Math.min(7, rank + Math.floor((level - 1) / 3));
    return {
        ...card, effects, effect: undefined, isFieldSpell: false,
        ...(card.type === "monster"
            ? { attack: Math.min(Number(card.attack) || 0, cap), defense: Math.min(Number(card.defense) || 0, cap + 200), duelPowerTier }
            : {}),
        description: effects.map(e => `【${e.skillName}】${e.description}`).join("\n"),
        ruleSignature: `${recipe} => ${action}`, ruleTier: card.rarity, rulesVersion: "2026-09-anime-directions-v5",
        designNotes: { cardName: card.name, artwork: card.image, motif, direction: directionProfile.direction || LEGACY_DESIGN_DIRECTIONS[action] || "乐队合奏", source: card.lore || "依据本项目卡名、卡面主题与原作角色资料设计；不是原作台词或技能的逐字复制", evidence: directionProfile.evidence, rarityBudget: rarityPowerBudget(card.rarity), resourcePlan: effects.map(e => LABELS[e.action]).join(" → ") },
        aiHints: { ...card.aiHints, role: effects.some(e => ["seal", "sleep", "freeze", "disarm"].includes(e.action)) ? "control" : effects.some(e => ["deploy", "revive", "recover"].includes(e.action)) ? "support" : "attacker" },
    };
}
