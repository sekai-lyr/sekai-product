// attack-fx-profiles.js
// 角色攻击演出档案：卡 → 招式族 + 配色 + 招式名。
// 纯数据/映射，无 DOM 依赖（供 Web 画廊与后续正式接入复用）。
// 优先级：NAME_RULES（按卡名正则） → ATTRIBUTE_FALLBACK（按属性） → DEFAULT。

const P = {
  fire:      ["#ffe08a", "#ff8a3c", "#d23712"],
  sunfire:   ["#ffe3a8", "#ff5a24", "#8f1206"],
  blackfire: ["#ff6a2c", "#4a0a08", "#150101"],
  fireHot:   ["#fff6d8", "#ffd36b", "#ff7a1f"],
  crimson:   ["#ffb3c0", "#ff4d6d", "#8f1230"],
  water:     ["#e6f6ff", "#3f9bff", "#1248c0"],
  teal:      ["#d2fff2", "#43e0c8", "#0f6f7a"],
  wind:      ["#e4ffd6", "#7fe08f", "#1f8f4a"],
  thunder:   ["#fffbe0", "#ffe45e", "#c98a00"],
  cyan:      ["#e0fbff", "#5ad8ff", "#2058a8"],
  violet:    ["#efe0ff", "#b06cff", "#4a1a8f"],
  abyss:     ["#eaf2ff", "#5a7cff", "#0a1230"],
  moon:      ["#dcfff2", "#3fd6b8", "#2a2a3a"],
  dark:      ["#e2d2ff", "#8a5cf0", "#2a1050"],
  gold:      ["#fff8dc", "#ffd76b", "#a8701a"],
  light:     ["#ffffff", "#ffe9a0", "#d8a020"],
  ice:       ["#f4fdff", "#a5e2ff", "#3f8fc9"],
  pink:      ["#ffe6f2", "#ff8ac2", "#a83a78"],
  rose:      ["#ffe0e8", "#ff6d9f", "#9c2458"],
  sand:      ["#ffedc9", "#d8a35b", "#7a4a1f"],
  grey:      ["#f0f0f5", "#b8b8c8", "#4a4a5c"],
  lime:      ["#f0ffd6", "#b8ff5c", "#4a8f1a"],
  cream:     ["#fff6e0", "#ffd8a8", "#b8865a"],
  prism:     ["#ffffff", "#8fd8ff", "#c77dff"],
  green:     ["#d8ffe0", "#5fd88f", "#1a6f3a"],
  blue:      ["#e0f0ff", "#6fa8ff", "#1a3f9c"],
  orange:    ["#fff0d0", "#ff9a4c", "#b84a12"],
  white:     ["#ffffff", "#d8e8ff", "#7a8fc8"],
  rainbow:   ["#ffe0e0", "#8fd8ff", "#d8a0ff"],
};

// 招式族说明：
// slash      单/多道刀弧（火、水、风、暗、光、灵能都用它换参数）
// thunder    瞬移 + 分叉雷
// rush       冲刺撞击 + 冲击波
// butterfly  蝶群 + 毒雾
// music      音波环 + 音符粒子
// void       红蓝球汇聚 + 光束
// fireball   旋转火焰瓣火球
// ice        切面冰晶齐射
// bullet     枪口闪光 + 弹道
// whip       丝线/鞭/链 分段甩击
// spirit     魂火球 + 残影
// domain     多重交错斩线 + 暗场
// nova       定点大爆炸（尾兽玉 / 神罗天征 / 炸弹 / 原子）
const FAMILY_DEFAULT_PARAMS = {
  slash:      { arcs: 1, width: 30, curve: -130, tongue: 0.26, dash: true, speed: 1 },
  thunder:    { bolts: 2, dash: true },
  rush:       { rings: 2, dust: true, dash: true },
  butterfly:  { count: 7, mist: true, dash: false },
  music:      { rings: 3, notes: 8, dash: false },
  void:       { orbs: true, beam: true, dash: false },
  fireball:   { size: 26, arcY: -34, dash: false },
  ice:        { shards: 5, dash: false },
  bullet:     { rounds: 5, dash: false },
  whip:       { segments: 4, dash: true, reach: 0.72 },
  spirit:     { size: 24, wisps: 10, dash: false },
  domain:     { lines: 5, tint: true, dash: false },
  nova:       { dash: false },
};

// 名字规则：命中即采用（按顺序匹配，越特别越靠前）
export const NAME_RULES = [
  [/若叶睦.*丰川祥子|丰川祥子.*若叶睦/, "whip", "pink", "牵绊丝线"],
  [/月见八千代/, "clean-blade", "cyan", "月见神乐"],
  [/酒寄彩叶/, "piano-keys", "cyan", "彩叶编曲"],
  [/丰川祥子/, "piano-keys", "blue", "人偶键盘"],
  [/若叶睦/, "bass-pulse", "violet", "沉默琴弦"],
  [/祐天寺若麦/, "dj-equalizer", "pink", "假面鼓点"],
  [/八幡海铃/, "bass-pulse", "teal", "暗潮低音"],
  [/长崎爽世/, "bass-pulse", "cream", "温柔低音"],
  [/井芹仁菜/, "music", "crimson", "无刺之歌"],
  [/河原木桃香/, "piano-keys", "cream", "桃香和弦"],
  [/海老塚智/, "bass-pulse", "cyan", "智性键盘"],
  [/安和昴/, "idol-burst", "pink", "昴星鼓阵"],
  [/露帕|RUPA/i, "bass-pulse", "green", "静默低音"],
  [/灶门炭十郎/, "slash", "sunfire", "赤月神乐"],
  [/波风水门|水门/, "thunder", "gold", "飞雷神现身"],
  [/宇智波鼬|鼬/, "genjutsu-eye", "crimson", "写轮眼幻术"],
  [/黑馆羽留奈/, "bullet", "blue", "远距狙击"],
  [/花里实乃理/, "idol-burst", "pink", "舞台应援"],
  [/草薙宁宁/, "idol-burst", "cyan", "电子舞台"],
  [/日野森雫/, "idol-burst", "violet", "清澈歌声"],
  [/椎名真昼/, "slash", "gold", "天使羽光"],
  [/喜多川海梦/, "slash", "prism", "换装棱镜"],
  [/有马加奈/, "idol-burst", "rose", "聚光舞台"],
  [/奥泽美咲/, "dj-equalizer", "orange", "米歇尔节拍"],
  [/黑化阿尔托莉雅·暗夜血刃/, "cursed-blade", "rose", "血刃绽放"],
  [/黑化阿尔托莉雅·绯狱复仇/, "whip", "crimson", "绯狱锁链"],
  [/阿尔托莉雅·黄昏断罪/, "gold-beam", "gold", "黄昏断罪"],
  [/蓝絮猫女仆|凯伊/, "claw-gash", "pink", "猫爪连击"],
  [/里间雨/, "water-current", "water", "骤雨帘幕"],
  [/宫崎奏/, "music", "cyan", "奏鸣波纹"],
  [/青蓝妆者/, "slash", "blue", "青蓝妆彩"],
  [/白羽静梦/, "slash", "white", "白羽梦境"],
  [/祥子/, "piano-keys", "blue", "人偶钢琴"],
  [/蕾塞·雨夜引魂/, "nova", "crimson", "爆弹"],
  [/绯线誓约·青叶/, "whip", "green", "绯线蔷薇"],
  [/绯线誓约·棕羽/, "whip", "cream", "绯线羽阵"],
  [/绯线誓约·金瞳/, "whip", "gold", "绯线魔眼"],
  [/咒灵武者·赤影/, "cursed-blade", "crimson", "咒刃赤影"],
  [/白绫神姬·天仪/, "silk-ribbon", "white", "神仪白绫"],
  [/鸣人|九喇嘛/, "nova", "orange", "九喇嘛·尾兽玉"],
  [/宇智波佐助|须佐能乎/, "clean-blade", "violet", "须佐能乎·天照斩"],
  [/我爱罗|砂瀑/, "sand-tide", "sand", "砂瀑大葬"],
  [/佩恩|神罗天征/, "nova", "white", "神罗天征"],
  [/卡卡西|雷切/, "chidori", "cyan", "雷切"],
  [/纲手|怪力/, "rush", "green", "百豪怪力"],
  [/白眼|回天/, "rush", "white", "八卦掌·回天"],
  [/二代火影|水遁/, "whip", "water", "水遁·水龙弹"],
  [/日之呼吸|缘壹|缘一/, "sun-disk", "sunfire", "日之呼吸·十三之型"],
  [/初音未来/, "music", "cyan", "未来音浪"],
  [/雨夜狙击/, "bullet", "abyss", "雨夜狙击"],
  [/朝比奈真冬/, "piano-keys", "violet", "静默旋律"],
  [/宵崎奏/, "piano-keys", "abyss", "奏响的旋律"],
  [/东云绘名/, "paint-splash", "prism", "色彩冲击"],
  [/晓山瑞希/, "dj-equalizer", "prism", "缤纷幻境"],
  [/后藤一里|喜多郁代|高松灯/, "music", "pink", "舞台共鸣"],
  [/津岛善子|堕天使夜羽/, "domain", "violet", "堕天使召来"],
  [/暗影|终焉/, "nova", "violet", "原子裁决"],
  [/空条承太郎|白金之星/, "time-stop", "violet", "欧拉连打"],
  [/吉良吉影|杀手皇后/, "nova", "pink", "第一炸弹"],
  [/迪亚哥.*THE WORLD/, "time-stop", "gold", "世界·时停突袭"],
  [/迪亚哥|骇人恶兽/, "rush", "green", "恐龙撕裂"],
  [/米斯达|性感手枪/, "ricochet", "gold", "性感手枪·弹道折射"],
  [/露西|钢铁蔷薇/, "slash", "rose", "钢铁蔷薇"],
  [/赫特|奶油启动器/, "foam-spray", "cream", "奶油启动器"],
  [/瓦伦泰|爱之列车/, "void", "rainbow", "D4C·爱之列车"],
  [/灶门炭治郎|炭治郎/, "slash", "sunfire", "火之神神乐"],
  [/祢豆子/, "slash", "crimson", "爆血灼烧"],
  [/我妻善逸|善逸/, "thunder", "thunder", "霹雳一闪"],
  [/嘴平伊之助|伊之助/, "claw-gash", "teal", "兽之呼吸·乱裂"],
  [/义勇.*水车|水车/, "water-wheel", "water", "水之呼吸·水车"],
  [/冨冈义勇|富冈义勇|义勇/, "water-current", "water", "水之呼吸·水刃"],
  [/炼狱杏寿郎|炼狱/, "slash", "fire", "炎之呼吸·炼狱"],
  [/蜈蚣之舞/, "centipede", "violet", "蜈蚣之舞"],
  [/蝴蝶忍/, "butterfly", "violet", "虫之呼吸·毒刃"],
  [/甘露寺蜜璃|蜜璃/, "heart-whip", "pink", "恋之呼吸·猫足恋风"],
  [/伊黑/, "serpent", "violet", "蛇之呼吸·蜿蜒蛇行"],
  [/悲鸣屿/, "rock-spikes", "grey", "岩之呼吸·巨岩贯穿"],
  [/不死川实弥|实弥/, "wind-slash", "wind", "风之呼吸·黑风烟岚"],
  [/时透无一郎|无一郎/, "mist-veil", "white", "霞之呼吸·胧"],
  [/双刀爆裂/, "twin-blade", "gold", "双刀爆裂"],
  [/宇髓/, "nova", "gold", "音之呼吸·谱面斩"],
  [/猗窝座/, "rush", "crimson", "破坏杀·罗针"],
  [/童磨/, "ice-lotus", "ice", "血鬼术·寒烈白姬"],
  [/鬼舞辻无惨|无惨/, "rock-spikes", "crimson", "黑血枳棘"],
  [/黑死牟/, "moon-crescent", "moon", "月之呼吸·月虹"],
  [/五条悟.*虚式茈/, "void", "violet", "虚式·茈"],
  [/五条悟.*无量空处/, "domain", "abyss", "领域展开·无量空处"],
  [/五条悟/, "void", "violet", "术式顺转·苍"],
  [/两面宿傩.*伏魔御厨子|宿傩.*伏魔御厨子/, "cleave", "crimson", "领域展开·伏魔御厨子"],
  [/宿傩.*炎矢/, "flame-arrow", "sunfire", "开·炎矢"],
  [/宿傩/, "cleave", "crimson", "解·空间斩"],
  [/山田凉/, "bass-pulse", "pink", "低音过载"],
  [/斯卡蒂|浊心斯卡蒂|黑潮|深海夜宴|霜海/, "water-current", "teal", "深海潮歌"],
  [/史尔特尔|熔核/, "slash", "crimson", "莱万汀·熔核爆发"],
  [/能天使|铳火/, "bullet", "crimson", "过载模式·红莲弹幕"],
  [/阿米娅/, "spirit", "crimson", "奇美拉·意志共鸣"],
  [/煌|炎锯|炎翼/, "chainsaw", "fire", "沸腾爆裂·链锯强袭"],
  [/^W·|赤痕爆破/, "nova", "crimson", "D12·遥控爆破"],
  [/御坂美琴|超电磁炮/, "railgun", "cyan", "超电磁炮"],
  [/可莉|焰星旅者/, "nova", "orange", "轰轰火花"],
  [/冰冠龙姬/, "ice", "abyss", "冰冠吐息"],
  [/雪之下雪乃/, "spirit", "white", "心意绽放"],
  [/冰冠|冰晶|霜/, "ice", "ice", "冰晶领域"],
  [/白庭双生/, "holy-pillar", "white", "终幕圣仪"],
  [/曦火圣女/, "holy-pillar", "fire", "晨祷圣火"],
  [/圣辉裁决|金律/, "holy-pillar", "gold", "圣域裁决"],
  [/红棘圣女·荆冠/, "holy-pillar", "rose", "荆冠裁决"],
  [/红棘圣女·终花/, "holy-pillar", "crimson", "终花裁决"],
  [/白庭|圣辉|金律|圣女|神姬/, "holy-pillar", "gold", "圣域裁决"],
  [/青月人偶师/, "puppet-thread", "cyan", "幽兰傀儡"],
  [/绯月傀儡师/, "puppet-thread", "crimson", "血契傀儡"],
  [/天狼机巧/, "claw-gash", "abyss", "苍牙撕咬"],
  [/菜月昴/, "time-stop", "white", "死亡回归"],
  [/鸦羽祭司/, "genjutsu-eye", "violet", "夜羽幻视"],
  [/金庭歌者/, "idol-burst", "gold", "夜曲华彩"],
  [/辉夜/, "idol-burst", "orange", "橙梦舞台"],
  [/蓝发静默者/, "piano-keys", "teal", "阶梯旋律"],
  [/要乐奈/, "bass-pulse", "prism", "自由即兴"],
  [/椎名立希/, "dj-equalizer", "violet", "疾走节拍"],
  [/千早爱音/, "bass-pulse", "rose", "粉色和弦"],
  [/机巧|人偶师|傀儡师/, "void", "violet", "傀儡领域"],
  [/龙骑|龙姬|苍鳞/, "dragon-breath", "teal", "龙魂咆哮"],
  [/青眼白龙/, "dragon-breath", "light", "爆裂疾风弹"],
  [/黑魔导/, "dark-magic", "violet", "黑·魔·导"],
  [/真红眼黑龙/, "fireball", "blackfire", "黑炎弹"],
  [/恶魔召唤/, "dark-magic", "dark", "暗黑魔力"],
  [/鹰身女郎/, "feather-storm", "wind", "羽毛风暴"],
  [/机械猎手/, "cannon", "grey", "重炮轰击"],
  [/岩石巨兵/, "boulder", "grey", "巨岩投掷"],
  [/要塞守护翼龙/, "dragon-breath", "grey", "守护吐息"],
  [/暗黑海龙兵/, "dragon-breath", "abyss", "毁灭吐息"],
  [/诅咒之龙/, "dragon-breath", "violet", "诅咒吐息"],
  [/巨型红海蛇/, "serpent", "crimson", "海蛇绞杀"],
  [/加加基哥/, "feather-storm", "sand", "羽翼突袭"],
  [/天空侦察者/, "feather-storm", "light", "高空侦察击"],
  [/水魔道士/, "water-current", "water", "水镜之术"],
  [/神圣妖精/, "holy-pillar", "light", "圣辉祝福"],
  [/审判者/, "holy-pillar", "gold", "裁决之光"],
  [/小恶魔/, "dark-magic", "crimson", "暗黑咒火"],
  [/血腥魔兽人/, "claw-gash", "crimson", "血腥狂爪"],
  [/银牙狼/, "claw-gash", "white", "银牙咬碎"],
  [/基因狼人/, "claw-gash", "violet", "撕咬连击"],
  [/牛魔人|剑角龙/, "rush", "crimson", "蛮力冲撞"],
  [/海狸战士/, "rush", "sand", "齿刃突袭"],
  [/精灵剑士/, "clean-blade", "light", "精灵剑舞"],
  [/双生精灵/, "clean-blade", "green", "双生突袭"],
  [/恶魔士兵/, "cursed-blade", "dark", "恶魔斩击"],
  [/龙之僵尸/, "cursed-blade", "abyss", "尸龙爪"],
  [/铠武者僵尸/, "cursed-blade", "grey", "尸刃斩"],
  [/小丑僵尸/, "dark-magic", "rose", "诡笑咒火"],
  [/矿洞小鼠/, "claw-gash", "sand", "啮咬"],
  [/斧王/, "claw-gash", "grey", "斧断"],
  [/灯之魔精/, "fireball", "fire", "灯火魔法"],
  [/七彩鱼/, "water-current", "prism", "七色游波"],
  [/蓝宝石龙/, "dragon-breath", "blue", "蓝宝石吐息"],
  [/紫翠玉龙/, "dragon-breath", "teal", "紫翠吐息"],
  [/新虫/, "claw-gash", "green", "虫咬"],
  [/白狐剑巫/, "blade-storm", "white", "千刃斩"],
  [/粉樱星轨/, "petal-storm", "pink", "樱花星轨"],
  [/六花联奏/, "snowflake", "prism", "六花联奏·虹誓"],
  [/暗黑骑士盖亚/, "cursed-blade", "dark", "黑暗骑士斩"],
  [/火|焰|炎|熔|赤/, "slash", "fire", "烈焰终式"],
  [/雷|电|霹雳/, "thunder", "thunder", "雷霆终式"],
  [/海|潮|水镜|苍流|水/, "slash", "water", "苍海终式"],
  [/月|夜|暗|鸦羽/, "slash", "violet", "月影终式"],
  [/花|樱|羽|梦/, "slash", "pink", "花瓣终式"],
];

export const ATTRIBUTE_FALLBACK = {
  fire:  { family: "slash", palette: "fire", label: "烈焰冲击" },
  water: { family: "slash", palette: "water", label: "苍流斩" },
  wind:  { family: "slash", palette: "wind", label: "疾风连斩" },
  earth: { family: "rush", palette: "sand", label: "大地震击" },
  light: { family: "slash", palette: "gold", label: "光耀突袭" },
  dark:  { family: "slash", palette: "dark", label: "暗影终结" },
  none:  { family: "slash", palette: "prism", label: "灵能冲击" },
};

const RARITY_SCALE = { N: 0.88, R: 0.96, SR: 1.04, SSR: 1.12, UR: 1.22 };
// 稀有度档位：特效规模按档位分（N 最简 → UR 带终结层）
const RARITY_TIER = { N: 1, R: 2, SR: 3, SSR: 4, UR: 5 };

function hashSeed(str) {
  let seed = 2166136261;
  for (const ch of String(str)) {
    seed ^= ch.codePointAt(0);
    seed = Math.imul(seed, 16777619) >>> 0;
  }
  return seed >>> 0;
}
function seededRnd(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const lerp = (r, lo, hi) => lo + (hi - lo) * r;

export function getAttackProfile(card) {
  const name = String(card?.name || "");
  let hit = null;
  for (const [re, family, palette, label] of NAME_RULES) {
    if (re.test(name)) { hit = { family, palette, label }; break; }
  }
  if (!hit) {
    const attr = String(card?.attribute || card?.element || "none");
    hit = ATTRIBUTE_FALLBACK[attr] || ATTRIBUTE_FALLBACK.none;
  }
  const rarity = String(card?.rarity || "N").toUpperCase();
  const scale = RARITY_SCALE[rarity] || 1;
  const tier = RARITY_TIER[rarity] || 3;
  // R 卡不做新特效：沿用旧版攻击演出（只按属性配色）
  if (rarity === "R") {
    const attr = String(card?.attribute || card?.element || "none");
    const fb = ATTRIBUTE_FALLBACK[attr] || ATTRIBUTE_FALLBACK.none;
    return {
      family: "legacy",
      label: "普通攻击",
      palette: fb.palette,
      colors: P[fb.palette] || P.prism,
      params: {},
      rarity,
      scale,
      tier,
      legacy: true,
    };
  }
  const base = FAMILY_DEFAULT_PARAMS[hit.family] || FAMILY_DEFAULT_PARAMS.slash;
  const params = Object.assign({}, base, { scale });

  // 逐卡参数差异化：同一族的两张卡形状参数也不同（宽度/弧数/曲率方向/数量等）
  const rnd = seededRnd(hashSeed(`${card?.id || ""}:${name}`));
  if (hit.family === "slash") {
    params.width = lerp(rnd(), 22, 38) * scale;
    params.arcs = 1 + (rnd() < (scale > 1.05 ? .75 : .38) ? 1 : 0);
    params.curve = lerp(rnd(), -170, -100) * (rnd() < .3 ? -1 : 1);
    params.tongue = lerp(rnd(), .18, .34);
  } else if (hit.family === "fireball") {
    params.size = lerp(rnd(), 22, 32) * scale;
    params.arcY = lerp(rnd(), -46, -22);
  } else if (hit.family === "ice") {
    params.shards = Math.round(lerp(rnd(), 4, 7));
  } else if (hit.family === "bullet") {
    params.rounds = Math.round(lerp(rnd(), 4, 8));
  } else if (hit.family === "music") {
    params.rings = Math.round(lerp(rnd(), 2, 4));
    params.notes = Math.round(lerp(rnd(), 6, 12));
  } else if (hit.family === "thunder") {
    params.bolts = Math.round(lerp(rnd(), 1, 2.6));
  } else if (hit.family === "rush") {
    params.rings = Math.round(lerp(rnd(), 2, 3.6));
  } else if (hit.family === "whip") {
    params.segments = Math.round(lerp(rnd(), 3, 5));
  } else if (hit.family === "nova") {
    params.coreScale = Number(lerp(rnd(), .85, 1.32).toFixed(3));
  } else if (hit.family === "void") {
    params.orbSize = Math.round(lerp(rnd(), 62, 92));
  } else if (hit.family === "spirit") {
    params.size = Math.round(lerp(rnd(), 20, 34) * scale);
  } else if (hit.family === "domain") {
    params.lines = Math.round(lerp(rnd(), 4, 7));
  }
  const colors = P[hit.palette] || P.prism;
  return {
    family: hit.family,
    label: hit.label || "攻击",
    palette: hit.palette,
    colors,
    params,
    rarity,
    scale,
    tier,
  };
}

export { P as PALETTES, FAMILY_DEFAULT_PARAMS };
