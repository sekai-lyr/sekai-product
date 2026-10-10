// 原作语义层：方向负责说明“这张卡为什么这样玩”，action 仍复用稳定的结算原语。
// 明确角色优先于关键词；景色/原创卡再按卡名意象归类。
export const ANIME_DESIGN_DIRECTIONS = Object.freeze([
    "毒印控制", "冰冻封锁", "灼烧爆发", "炸弹延迟", "硬币赌博", "骰子命运",
    "情报侦察", "预知观星", "心理博弈", "时间操控", "死亡回归", "领域压制",
    "护盾反击", "连击追击", "召唤替身", "墓地循环", "乐队合奏", "情绪觉醒",
    "变身解放", "双重人格", "羁绊联动", "宿敌对决", "指挥编队", "援护替伤",
    "献祭爆发", "复制模仿", "能力封印", "能力夺取", "标记追猎", "闪避残影",
    "蓄力咏唱", "超载透支", "伤害转化", "属性共鸣", "连锁反应", "天气场景",
    "地形领域", "剧情章节", "记忆碎片", "死亡遗言", "复仇执念", "治疗代价",
    "契约交换", "手札伪装", "反转控制", "时间轴行动", "观众应援", "最终回觉醒",
    "身份隐藏", "阵营背叛", "师徒传承", "家族血脉", "武器切换", "装备成长",
    "弱点识破", "完美格挡", "破防处决", "空间置换", "因果改写", "梦境入侵",
    "规则宣言", "能量资源", "情报档案", "同步演奏", "舞台返场", "日夜循环",
    "善恶抉择", "胜负执念",
    "多阶段Boss", "部位破坏", "弱点属性", "耐性适应", "招式冷却", "技能升级",
    "技能树抉择", "条件胜利", "倒计时危机", "护送任务", "营救任务", "捕获封印",
    "灵魂链接", "融合合体", "分裂增殖", "寄生附体", "感染扩散", "召唤仪式",
    "现实侵蚀", "平行世界", "存档读档", "台词回应", "情绪传染", "终局演出",
]);

// 每个方向至少有一张代表卡。动作是现有规则引擎中最贴近该原作概念的结算原语。
const CARD_PROFILES = Object.freeze({
    picture_ex_037: ["毒印控制", "venom"],
    picture_ex_055: ["冰冻封锁", "freeze"],
    picture_ex_030: ["灼烧爆发", "ignite"],
    picture_ex_012: ["炸弹延迟", "detonate"],
    picture_ssr7_036: ["硬币赌博", "gamble"],
    nc_sp_ur_010: ["骰子命运", "dice"],
    picture_ex_073: ["情报侦察", "recon"],
    source_monster_009: ["预知观星", "scry"],
    gallery_spell_018: ["心理博弈", "mindgame"],
    picture_ex_013: ["时间操控", "timeStop"],
    picture_ex_072: ["死亡回归", "exile"],
    source_monster_015: ["领域压制", "domain"],
    source_monster_010: ["护盾反击", "infinity"],
    picture_ex_059: ["连击追击", "twin"],
    picture_ex_017: ["召唤替身", "token"],
    gallery_spell_069: ["墓地循环", "recall"],
    picture_ssr7_020: ["乐队合奏", "chorus"],
    picture_ex_085: ["情绪觉醒", "emotion"],
    picture_ssr7_038: ["变身解放", "burst"],
    picture_ssr7_033: ["双重人格", "exchange"],
    picture_ssr7_035: ["羁绊联动", "chorus"],
    picture_ex_011: ["宿敌对决", "twin"],
    picture_ssr7_014: ["指挥编队", "deploy"],
    picture_ex_077: ["援护替伤", "shelter"],
    picture_ssr7_007: ["献祭爆发", "devour"],
    picture_ex_078: ["复制模仿", "study"],
    picture_ssr7_032: ["能力封印", "seal"],
    source_monster_008: ["能力夺取", "devour"],
    source_monster_004: ["标记追猎", "bomb"],
    picture_ex_049: ["闪避残影", "ward"],
    picture_ssr7_005: ["蓄力咏唱", "charge"],
    picture_ssr7_010: ["超载透支", "burst"],
    picture_ex_056: ["伤害转化", "domain"],
    picture_ssr7_055: ["属性共鸣", "chorus"],
    picture_ex_060: ["连锁反应", "detonate"],
    source_spell_021: ["天气场景", "freeze"],
    source_trap_040: ["地形领域", "sanctuary"],
    picture_ex_001: ["剧情章节", "inherit"],
    gallery_spell_045: ["记忆碎片", "prepare"],
    picture_ex_050: ["死亡遗言", "inherit"],
    picture_ex_105: ["复仇执念", "charge"],
    picture_ex_086: ["治疗代价", "sanctuary"],
    gallery_spell_048: ["契约交换", "exchange"],
    picture_ex_117: ["手札伪装", "mindgame"],
    picture_ex_018: ["反转控制", "reversal"],
    picture_ex_118: ["时间轴行动", "scry"],
    picture_ssr7_030: ["观众应援", "chorus"],
    source_monster_011: ["最终回觉醒", "emotion"],
    picture_ex_080: ["身份隐藏", "ambush"],
    picture_ex_006: ["阵营背叛", "exchange"],
    picture_ex_065: ["师徒传承", "inherit"],
    picture_ex_003: ["家族血脉", "inherit"],
    picture_ex_047: ["武器切换", "twin"],
    picture_ssr7_012: ["装备成长", "charge"],
    picture_ex_039: ["弱点识破", "recon"],
    picture_ex_033: ["完美格挡", "shelter"],
    picture_ex_068: ["破防处决", "pierce"],
    picture_ex_075: ["空间置换", "exchange"],
    gallery_spell_014: ["因果改写", "scry"],
    picture_ex_083: ["梦境入侵", "sleep"],
    picture_ex_112: ["规则宣言", "seal"],
    picture_ex_054: ["能量资源", "charge"],
    picture_ex_074: ["情报档案", "recon"],
    picture_ssr7_039: ["同步演奏", "chorus"],
    picture_ex_101: ["舞台返场", "revive"],
    picture_ssr7_056: ["日夜循环", "scry"],
    picture_ex_104: ["善恶抉择", "exchange"],
    picture_ex_042: ["胜负执念", "charge"],
    picture_ex_103: ["多阶段Boss", "emotion"],
    source_monster_019: ["部位破坏", "detonate"],
    picture_ssr7_019: ["弱点属性", "scry"],
    picture_ex_061: ["耐性适应", "ward"],
    picture_ex_063: ["招式冷却", "charge"],
    picture_ex_070: ["技能升级", "charge"],
    picture_ex_102: ["技能树抉择", "exchange"],
    gallery_spell_067: ["条件胜利", "chorus"],
    nc_sp_ur_005: ["倒计时危机", "bomb"],
    gallery_spell_017: ["护送任务", "shelter"],
    picture_ex_110: ["营救任务", "revive"],
    source_trap_042: ["捕获封印", "seal"],
    picture_ssr7_001: ["灵魂链接", "shelter"],
    picture_ssr7_002: ["融合合体", "exchange"],
    picture_ssr7_009: ["分裂增殖", "token"],
    picture_ssr7_027: ["寄生附体", "curse"],
    nc_sp_ss_001: ["感染扩散", "venom"],
    picture_ssr7_017: ["召唤仪式", "revive"],
    picture_ssr7_059: ["现实侵蚀", "domain"],
    gallery_spell_013: ["平行世界", "scry"],
    picture_ex_119: ["存档读档", "returnSelf"],
    gallery_spell_031: ["台词回应", "mindgame"],
    nc_sp_ss_004: ["情绪传染", "emotion"],
    source_monster_020: ["终局演出", "chorus"],
});

// 这些代表卡可以安全地采用方向专属结算；其余卡保留已锁定的角色招牌技或陷阱身份。
const SAFE_ACTION_OVERRIDES = new Set([
    "picture_ssr7_005", "picture_ssr7_033", "picture_ssr7_035", "picture_ssr7_038",
    "picture_ex_049", "picture_ex_060", "picture_ex_077",
    "picture_ex_078", "picture_ex_086", "picture_ex_105", "picture_ex_118", "gallery_spell_048",
    "source_monster_011",
    "picture_ex_065", "picture_ex_047", "picture_ssr7_012",
    "picture_ex_039", "picture_ex_033", "picture_ex_068", "picture_ex_075",
    "gallery_spell_014", "picture_ex_083", "picture_ex_112", "picture_ex_054",
    "picture_ssr7_039", "picture_ex_101", "picture_ssr7_056", "picture_ex_104", "picture_ex_042",
    "picture_ex_103", "source_monster_019", "picture_ssr7_019", "picture_ex_061",
    "picture_ex_063", "picture_ex_070", "picture_ex_102", "gallery_spell_067",
    "nc_sp_ur_005", "gallery_spell_017", "picture_ex_110", "picture_ssr7_001",
    "picture_ssr7_002", "picture_ssr7_009", "picture_ssr7_027", "nc_sp_ss_001",
    "picture_ssr7_017", "gallery_spell_013",
    "gallery_spell_031", "source_monster_020",
]);

const ACTION_DIRECTIONS = Object.freeze({
    poison: "毒印控制", venom: "毒印控制", bleed: "标记追猎", curse: "能力封印", purify: "净化祈愿", reprisal: "复仇执念",
    freeze: "冰冻封锁", sleep: "手札伪装", seal: "能力封印", paralyze: "超载透支",
    ignite: "灼烧爆发", detonate: "连锁反应", bomb: "炸弹延迟", burst: "献祭爆发",
    gamble: "硬币赌博", dice: "骰子命运", recon: "情报侦察", disarm: "能力封印", ambush: "标记追猎",
    scry: "预知观星", scout: "情报侦察", study: "复制模仿", prepare: "记忆碎片", mindgame: "心理博弈",
    timeStop: "时间操控", exile: "时间轴行动", returnSelf: "死亡回归", revive: "死亡回归", domain: "领域压制",
    infinity: "护盾反击", ward: "闪避残影", shelter: "援护替伤", mirror: "反转控制", intercept: "护盾反击", reversal: "反转控制",
    twin: "连击追击", charge: "蓄力咏唱", pierce: "连击追击", devour: "能力夺取",
    token: "召唤替身", exchange: "契约交换", deploy: "指挥编队", recover: "墓地循环", recycle: "墓地循环", recall: "墓地循环",
    sanctuary: "治疗代价", inherit: "死亡遗言", rescue: "援护替伤", retreat: "闪避残影", chorus: "乐队合奏", emotion: "情绪觉醒",
});

const KEYWORD_PROFILES = [
    [/终焉权能|终焉|魔王|狱纹/, "多阶段Boss", "emotion"],
    [/石肤|岩躯|无下限/, "耐性适应", "ward"],
    [/升级|研习|修炼|万钧/, "技能升级", "charge"],
    [/胜利|集齐|五重/, "条件胜利", "chorus"],
    [/碎穹|危机|爆破/, "倒计时危机", "bomb"],
    [/逃亡|守望|护送/, "护送任务", "shelter"],
    [/救援|祝福|从零开始/, "营救任务", "revive"],
    [/双生|心契|血契/, "灵魂链接", "shelter"],
    [/融合|轮转|共鸣/, "融合合体", "exchange"],
    [/DNA|毒|感染/, "感染扩散", "venom"],
    [/仪式|祈祷|祈愿|祭司/, "召唤仪式", "revive"],
    [/异世界|加速世界|虚幻/, "平行世界", "scry"],
    [/终幕|终曲|夜宴/, "终局演出", "chorus"],
    [/乔斯达|宇智波|灶门/, "家族血脉", "inherit"],
    [/师父|传承|炭十郎/, "师徒传承", "inherit"],
    [/狙击|暗影|伪装|秘密/, "身份隐藏", "ambush"],
    [/双刀|双刃|剑影|血刃/, "武器切换", "twin"],
    [/谱面|洞察|感知|苍瞳/, "弱点识破", "recon"],
    [/梦|幻梦|幻惑|人偶/, "梦境入侵", "sleep"],
    [/宣言|金律|裁决/, "规则宣言", "seal"],
    [/返场|重逢|归途|归来/, "舞台返场", "revive"],
    [/昼|夜|黄昏|破晓|晨/, "日夜循环", "scry"],
    [/Mortis|假面|黑化|堕天使/, "双重人格", "exchange"],
    [/觉醒|终焉|终幕|奥义|天上天下/, "最终回觉醒", "emotion"],
    [/羁绊|牵绊|伙伴|同旅|并肩|相守|盟约|誓约|契约/, "羁绊联动", "chorus"],
    [/复仇|裁决|断罪/, "复仇执念", "charge"],
    [/爆|炸弹|爆裂|可莉/, "炸弹延迟", "bomb"],
    [/炎|火|焚|熔核|红莲/, "灼烧爆发", "ignite"],
    [/冰|雪|霜|寒|凍結/, "冰冻封锁", "freeze"],
    [/毒|蝶|紫藤/, "毒印控制", "venom"],
    [/雷|电磁|霹雳|雷霆/, "超载透支", "burst"],
    [/镜|映照|反转/, "反转控制", "mirror"],
    [/世界线|瞬刻|时光|永恒/, "时间轴行动", "scry"],
    [/星|月|预知|苍瞳/, "预知观星", "scry"],
    [/雨|风|云|海|湖|水|霞/, "天气场景", "ward"],
    [/神域|结界|领域|空处|罗针/, "地形领域", "domain"],
    [/舞台|歌|曲|旋律|和弦|独奏|合奏|鼓点|音浪/, "观众应援", "chorus"],
    [/回忆|思念|旧|残响|信|记忆/, "记忆碎片", "prepare"],
    [/心|迷茫|焦虑|沉郁|真我/, "情绪觉醒", "emotion"],
];

export function animeDirectionProfile(card, fallbackAction) {
    const explicit = CARD_PROFILES[card?.id];
    if (explicit) return { direction: explicit[0], action: SAFE_ACTION_OVERRIDES.has(card?.id) ? explicit[1] : fallbackAction, suggestedAction: explicit[1], evidence: "角色/招式专属映射" };
    const name = String(card?.name || "");
    const keyword = KEYWORD_PROFILES.find(([pattern]) => pattern.test(name));
    if (keyword) return { direction: keyword[1], action: fallbackAction, suggestedAction: keyword[2], evidence: "卡名与场景意象映射" };
    return { direction: ACTION_DIRECTIONS[fallbackAction] || "剧情章节", action: fallbackAction, evidence: "既有技能语义映射" };
}

// 稀有度只改变数值预算，不改变触发时点和基础规则。SR 为基准，SSR/UR 更强，R 更克制。
export function tuneParamsByRarity(action, params, rarity) {
    const factor = { N: 0.78, R: 0.88, SR: 1, SSR: 1.12, UR: 1.25 }[rarity] || 1;
    const tuned = { ...params };
    // 已逐卡锁定数值的招牌动作保留其专属表；其余通用动作走统一稀有度预算。
    if (["ignite", "venom", "bleed", "curse", "paralyze", "detonate", "exile", "infinity", "domain", "gamble", "recon", "dice", "scry", "mindgame", "emotion"].includes(action)) return tuned;
    for (const key of ["damage", "amount", "heal", "reduce", "attack", "defense", "penalty"]) {
        if (typeof tuned[key] === "number" && tuned[key] > 0) tuned[key] = Math.max(100, Math.round(tuned[key] * factor / 50) * 50);
    }
    if (rarity === "UR" && typeof tuned.count === "number" && ["recon", "scry", "prepare", "purify"].includes(action)) tuned.count += 1;
    if (rarity === "UR" && typeof tuned.draw === "number" && ["gamble", "emotion", "chorus"].includes(action)) tuned.draw += 1;
    return tuned;
}

export function rarityPowerBudget(rarity) {
    return { N: 0.78, R: 0.88, SR: 1, SSR: 1.12, UR: 1.25 }[rarity] || 1;
}

export function directionCoverage(cards, signatureFor) {
    const present = new Set(cards.map(card => animeDirectionProfile(card, signatureFor(card).action).direction));
    return { present, missing: ANIME_DESIGN_DIRECTIONS.filter(direction => !present.has(direction)) };
}
