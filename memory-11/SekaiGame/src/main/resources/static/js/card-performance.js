import { ALL_CARDS } from "./catalog.js";
import { getAttackProfile } from "./attack-fx-profiles.js";
import { AUTHORED_CARD_SCENES, getCardVfxProfile } from "./authored-card-scenes.js?v=25-card-atlas-4x4";

// 原著身份与本项目美术演绎分开登记，不能把关键词猜测标记为原著考据。
const CHARACTER_DIRECTIONS = [
    [/空条承太郎|白金之星/, "fist", "替身轮廓显现", "白金之星·拳击连打", "拳影交错汇聚", "https://jojo-portal.com/en/anime/sc/character/01/"],
    [/宵崎奏/, "note", "旋律逐声点亮", "救赎旋律", "声部汇入主旋律", "https://pjsekai.sega.jp/character/unite05/kanade/index.html"],
    [/冨冈义勇|富冈义勇/, "wave", "静水涟漪", "水之呼吸·水刃", "水纹合流", "https://kimetsu.com/anime/risshihen/character/?chara=giyuu"],
    [/迪亚哥.*THE WORLD/i, "clock", "时钟停摆", "时停突进", "时间刻度收束"],
    [/迪亚哥|骇人恶兽/, "claw", "爪痕破开剪影", "恐龙撕裂", "兽群足迹汇聚"],
    [/蝴蝶忍/, "butterfly", "蝶翼与紫藤", "蝶群毒刃", "蝶群归巢"],
    [/善逸/, "bolt", "雷纹蓄势", "霹雳一闪", "雷线汇流"],
    [/宇智波鼬/, "eye", "鸦羽与眼纹", "幻术视线", "鸦羽环收束"],
    [/五条悟/, "orbit", "无下限环面", "术式交汇", "双轨合流"],
    [/米斯达|性感手枪/, "bullet", "弹巢展开", "折射弹道", "弹道集束"],
    [/吉良吉影|杀手皇后|蕾塞|可莉/, "spark", "引信逐级点燃", "定点爆破", "火星聚核"],
    [/雪之下雪乃|椎名真昼|喜多川海梦/, "petal", "日常光影", "心意绽放", "花瓣合页"],
    [/初音|朝比奈真冬|东云绘名|晓山瑞希|后藤一里|高松灯|祥子|若叶睦|山田凉|海铃|实乃理|宁宁|有马加奈|井芹|桃香|露帕|安和昴/, "note", "舞台分轨点亮", "乐句共鸣", "声部合奏"],
];
const FAMILY_MOTIFS = { music:"note", butterfly:"butterfly", thunder:"bolt", bullet:"bullet", ice:"crystal", whip:"thread", void:"orbit", domain:"eye", rush:"fist", fireball:"flame", spirit:"petal", nova:"star", slash:"blade" };
const ATTRIBUTE_MOTIFS = { fire:"flame", water:"wave", wind:"leaf", earth:"stone", light:"star", dark:"moon" };
const ACTION_MOTIFS = { token:"claw", bomb:"spark", ignite:"flame", venom:"butterfly", bleed:"blade", curse:"eye", scry:"star", freeze:"crystal", sleep:"moon", charge:"orbit", chorus:"note", shelter:"shield", ward:"shield", exile:"orbit", disarm:"blade", recon:"eye", recover:"petal", recycle:"leaf", domain:"orbit" };
const MOTIF_NAMES = { fist:"拳影", note:"音符", wave:"水纹", clock:"时钟", claw:"爪痕", butterfly:"蝶翼", bolt:"雷线", eye:"眼纹", orbit:"双环", bullet:"弹道", spark:"火星", petal:"花瓣", crystal:"冰晶", thread:"丝线", flame:"火焰", star:"星芒", blade:"刀弧", leaf:"叶片", stone:"岩片", moon:"月弧", shield:"护盾" };
const MOTIFS = Object.keys(MOTIF_NAMES);
const profiles = new Map();
const byName = new Map();
const groupCounts = new Map();
for (const card of ALL_CARDS) {
    const attack = getAttackProfile(card);
    const direction = CHARACTER_DIRECTIONS.find(([pattern]) => pattern.test(card.name));
    const action = card.effects?.find(effect => effect.action)?.action;
    const motif = direction?.[1] || ACTION_MOTIFS[action] || FAMILY_MOTIFS[attack.family] || ATTRIBUTE_MOTIFS[card.attribute] || "star";
    const accent = ACTION_MOTIFS[action] || ATTRIBUTE_MOTIFS[card.attribute] || motif;
    const groupKey = `${motif}:${accent}`;
    const variation = groupCounts.get(groupKey) || 0;
    groupCounts.set(groupKey, variation + 1);
    // 每组的镜头组合明确分配：扇形开角、声部/轨道数、顺逆序和交替节拍，非仅换色/改名。
    const choreography = {
        lanes: 2 + variation % 4,
        sweep: 24 + Math.floor(variation / 4) * 13,
        reverse: variation % 2 === 1,
        stagger: 38 + variation % 3 * 22,
        bend: 26 + Math.floor(variation / 3) * 11,
    };
    const profile = {
        id:card.id, name:card.name, type:card.type, rarity:card.rarity, image:card.fullImage || card.image,
        motif, accent, colors:attack.colors, choreography,
        evidence:direction?.[5] ? "official-character-adaptation" : "project-art-adaptation",
        source:direction?.[5] || null,
        note:direction?.[5] ? "官方角色身份依据；镜头、祭品仪式及游戏化招式由本项目设计" : "依据卡名、技能和角色主题创作；尚未逐项完成原著核验",
        summon: { title:direction?.[2] || `${MOTIF_NAMES[motif]}显现`, beats:[`${MOTIF_NAMES[accent]}预兆`, `${MOTIF_NAMES[motif]}分层展开`, "角色落位"] },
        attack: { title:direction?.[3] || card.effects?.[0]?.skillName || `${MOTIF_NAMES[motif]}突袭`, beats:[`${MOTIF_NAMES[motif]}蓄势`, `${choreography.lanes}路交错推进`, `${MOTIF_NAMES[accent]}收束命中`] },
        tribute: { title:direction?.[4] || `${MOTIF_NAMES[motif]}汇聚`, beats:["素材位置点亮", `${MOTIF_NAMES[motif]}沿轨道汇入`, `${MOTIF_NAMES[accent]}核心展开`] },
        applicable:card.type === "monster" ? ["summon","attack","tribute"] : ["activate"],
    };
    const authored = AUTHORED_CARD_SCENES[card.id];
    profile.production = authored ? "authored" : "template";
    // 陷阱卡的矢量结界参数来自图集登记表；不带上它，DOM 层就只剩图集、没有环绕结构。
    const authoredVfx = getCardVfxProfile(card.id);
    if (authoredVfx?.ward) profile.ward = authoredVfx.ward;
    if (authored) {
        for (const phase of ["summon", "attack", "destroy", "activate"]) {
            if (authored[phase]) profile[phase] = { title:authored[phase].title, beats:authored[phase].beats };
        }
        profile.source = authored.source || null;
        profile.evidence = authored.source ? "official-character-adaptation" : "project-art-adaptation";
        profile.note = authored.note || "独立分镜已制作；官方资料用于核对卡牌身份与卡面，动画镜头为本项目原创演绎。";
    } else {
        profile.note = `待逐卡独立制作，目前使用主题模板。${profile.note}`;
    }
    profiles.set(card.id, profile);
    byName.set(card.name, profile);
}

export const CARD_PERFORMANCES = [...profiles.values()];
export { MOTIFS };
export function getCardPerformance(card) {
    return profiles.get(card?.id) || byName.get(typeof card === "string" ? card : card?.name) || null;
}

export function performanceGeometry(profile) {
    return JSON.stringify([profile.motif, profile.accent, profile.choreography]);
}


