/**
 * anime-cards.js
 * 二次元角色卡牌数据 —— 各种动漫 / 游戏角色魔法卡
 */

export const ANIME_CARDS = [
    // ================================================================
    //  UR魔法卡
    // ================================================================

    // 1. 八千年的思念 — 复活2个回合前或者1个回合前的怪兽卡（不限星数）
    {
        id: "nc_sp_ur_001", name: "八千年的思念", series: "nightcord", member: null,
        type: "spell", attribute: "dark", level: 0, attack: 0, defense: 0,
        rarity: "UR", cost: 5,
        effects: [{ trigger: "manual", type: "reviveRecentGraveyard", value: 2,
            description: "从墓地复活1只2回合以内送入墓地的怪兽卡到场上（不限星数）。" }],
        description: "从墓地复活1只2回合以内送入墓地的怪兽卡到场上（不限星数）。",
        image: "./assets/cards/spells/ur/8千年的思念.jpg",
    },

    // 2. 薄采序奏 — 指定一个怪兽在发动回合内发动两次攻击
    {
        id: "nc_sp_ur_002", name: "薄采序奏", series: "nightcord", member: null,
        type: "spell", attribute: "dark", level: 0, attack: 0, defense: 0,
        rarity: "UR", cost: 4,
        effects: [{ trigger: "manual", type: "doubleAttack", value: 0,
            target: { owner: "self", zone: "monster", selector: "highestAttack", count: 1 },
            description: "指定己方1只怪兽，本回合内可以发动两次攻击。" }],
        description: "指定己方1只怪兽，本回合内可以发动两次攻击。",
        image: "./assets/cards/spells/ur/薄采序奏.jpg",
    },

    // 3. 不登校的未来 — 指定对方一个怪兽返回手卡
    {
        id: "nc_sp_ur_003", name: "不登校的未来", series: "nightcord", member: null,
        type: "spell", attribute: "dark", level: 0, attack: 0, defense: 0,
        rarity: "UR", cost: 3,
        effects: [{ trigger: "manual", type: "returnToHand", value: 0,
            target: { owner: "opponent", zone: "monster", selector: "highestAttack", count: 1 },
            description: "指定对方1只怪兽返回手牌。" }],
        description: "指定对方1只怪兽返回手牌。",
        image: "./assets/cards/spells/ur/不登校的未来.jpg",
    },

    // 4. 放学后的茶会 — 回复前三个回合丢失的生命值并抽一张卡
    {
        id: "nc_sp_ur_004", name: "放学后的茶会", series: "nightcord", member: null,
        type: "spell", attribute: "dark", level: 0, attack: 0, defense: 0,
        rarity: "UR", cost: 3,
        effects: [{ trigger: "manual", type: "recoverRecentDamage", value: 3,
            description: "回复前3个回合内失去的生命值，并抽1张卡。" }],
        description: "回复前3个回合内失去的生命值，并抽1张卡。",
        image: "./assets/cards/spells/ur/放学后的茶会.jpg",
    },

    // 5. 碎穹 — 损失90%的生命破坏对方任意两只怪兽卡
    {
        id: "nc_sp_ur_005", name: "碎穹", series: "nightcord", member: null,
        type: "spell", attribute: "dark", level: 0, attack: 0, defense: 0,
        rarity: "UR", cost: 6,
        effects: [{ trigger: "manual", type: "sacrificeDestroy", value: 90,
            description: "支付90%当前生命值，破坏对方场上任意2只怪兽卡。" }],
        description: "支付90%当前生命值，破坏对方场上任意2只怪兽卡。",
        image: "./assets/cards/spells/ur/碎穹.jpg",
    },

    // 6. 有刺无刺 — 对方2选1，猜对发动者摸1张，猜错双方怪兽区全破坏
    {
        id: "nc_sp_ur_006", name: "有刺无刺", series: "nightcord", member: null,
        type: "spell", attribute: "dark", level: 0, attack: 0, defense: 0,
        rarity: "UR", cost: 4,
        effects: [{ trigger: "manual", type: "guessGame", value: 0,
            description: "对方选择'有刺'或'无刺'。猜对：发动者抽1张卡。猜错：双方怪兽区全部破坏。" }],
        description: "对方选择'有刺'或'无刺'。猜对：发动者抽1张卡。猜错：双方怪兽区全部破坏。",
        image: "./assets/cards/spells/ur/有刺无刺.jpg",
    },

    // 7. 社恐的焦虑 — 交换双方的手牌
    {
        id: "nc_sp_ur_007", name: "社恐的焦虑", series: "nightcord", member: null,
        type: "spell", attribute: "dark", level: 0, attack: 0, defense: 0,
        rarity: "UR", cost: 4,
        effects: [{ trigger: "manual", type: "swapHands", value: 0,
            description: "交换双方的手牌。" }],
        description: "交换双方的手牌。",
        image: "./assets/cards/spells/ur/社恐的焦虑.jpg",
    },

    // 8. 月下传讯 — 抽三张卡
    {
        id: "nc_sp_ur_008", name: "月下传讯", series: "nightcord", member: null,
        type: "spell", attribute: "dark", level: 0, attack: 0, defense: 0,
        rarity: "UR", cost: 4,
        effects: [{ trigger: "manual", type: "drawCards", value: 3,
            description: "抽3张卡。" }],
        description: "抽3张卡。",
        image: "./assets/cards/spells/ur/月下传讯.jpg",
    },

    // 9. 最好的伙伴 — 融合两只特定怪兽
    {
        id: "nc_sp_ur_009", name: "最好的伙伴", series: "nightcord", member: null,
        type: "spell", attribute: "dark", level: 0, attack: 0, defense: 0,
        rarity: "UR", cost: 5,
        effects: [{ trigger: "manual", type: "fusionSummon", value: 0,
            description: "将手牌或场上两只特定怪兽融合，从牌组或手牌特殊召唤融合怪兽。" }],
        description: "将手牌或场上两只特定怪兽融合，从牌组或手牌特殊召唤融合怪兽。",
        image: "./assets/cards/spells/ur/最好的伙伴.jpg",
    },

    // ================================================================
    //  SSR魔法卡
    // ================================================================

    // 10. 畸变 DNA — 本回合增加怪兽400攻击力，回合结束永久削弱怪兽攻击力700
    {
        id: "nc_sp_ss_001", name: "畸变DNA", series: "nightcord", member: null,
        type: "spell", attribute: "dark", level: 0, attack: 0, defense: 0,
        rarity: "SSR", cost: 4,
        effects: [{ trigger: "manual", type: "buffThenDebuff", value: 400, penalty: 700,
            target: { owner: "self", zone: "monster", selector: "all" },
            description: "本回合己方所有怪兽攻击力+400，回合结束时永久-700。" }],
        description: "本回合己方所有怪兽攻击力+400，回合结束时永久-700。",
        image: "./assets/cards/spells/ssr/畸变DNA.jpg",
    },

    // 11. 夏风石阶的挚友茶会 — 抽两张牌
    {
        id: "nc_sp_ss_002", name: "夏风石阶的挚友茶会", series: "nightcord", member: null,
        type: "spell", attribute: "light", level: 0, attack: 0, defense: 0,
        rarity: "SSR", cost: 3,
        effects: [{ trigger: "manual", type: "drawCards", value: 2,
            description: "抽2张卡。" }],
        description: "抽2张卡。",
        image: "./assets/cards/spells/ssr/夏风石阶的挚友茶会.jpg",
    },

    // 12. 夜刻萦音的永续热忱 — 增加生命值两千并抽一张卡
    {
        id: "nc_sp_ss_003", name: "夜刻萦音的永续热忱", series: "nightcord", member: null,
        type: "spell", attribute: "light", level: 0, attack: 0, defense: 0,
        rarity: "SSR", cost: 4,
        effects: [{ trigger: "manual", type: "healAndDrawV2", value: 2000, draw: 1,
            description: "回复2000生命值，并抽1张卡。" }],
        description: "回复2000生命值，并抽1张卡。",
        image: "./assets/cards/spells/ssr/夜刻萦音的永续热忱.jpg",
    },

    // 13. 幽蝶旧画的沉郁祈愿 — 抽对面两张卡，同类型还回去魔法失败，不同类型归自己魔法成功
    {
        id: "nc_sp_ss_004", name: "幽蝶旧画的沉郁祈愿", series: "nightcord", member: null,
        type: "spell", attribute: "dark", level: 0, attack: 0, defense: 0,
        rarity: "SSR", cost: 5,
        effects: [{ trigger: "manual", type: "snatchCards", value: 2,
            description: "随机抽取对方手牌2张。若两张卡类型相同（都是怪兽/魔法/陷阱），则归还对方，魔法失败；若类型不同，则归你所有，魔法成功。" }],
        description: "随机抽取对方手牌2张。若两张卡类型相同，归还对方（魔法失败）；若类型不同，归你所有（魔法成功）。",
        image: "./assets/cards/spells/ssr/幽蝶旧画的沉郁祈愿.jpg",
    },

    // 14. 奏响点亮天空 — 将手牌都回收墓区，再抽和回收手牌相同数量的牌
    {
        id: "nc_sp_ss_005", name: "奏响点亮天空", series: "nightcord", member: null,
        type: "spell", attribute: "light", level: 0, attack: 0, defense: 0,
        rarity: "SSR", cost: 4,
        effects: [{ trigger: "manual", type: "recycleAndDraw", owner: "self",
            description: "将己方所有手牌送入墓地，然后抽取相同数量的卡。" }],
        description: "将己方所有手牌送入墓地，然后抽取相同数量的卡。",
        image: "./assets/cards/spells/ssr/奏响点亮天空.jpg",
    },

    // 15. 沉睡的蓝调 — 让对方将手牌都回收墓区，再抽和回收手牌相同数量的牌
    {
        id: "nc_sp_ss_006", name: "沉睡的蓝调", series: "nightcord", member: null,
        type: "spell", attribute: "water", level: 0, attack: 0, defense: 0,
        rarity: "SSR", cost: 4,
        effects: [{ trigger: "manual", type: "recycleAndDraw", owner: "opponent",
            description: "将对方所有手牌送入墓地，然后对方抽取相同数量的卡。" }],
        description: "将对方所有手牌送入墓地，然后对方抽取相同数量的卡。",
        image: "./assets/cards/spells/ssr/沉睡的蓝调.jpg",
    },
];

// 稀有度统计
export const ANIME_RARITY_COUNTS = { N: 0, R: 0, SR: 0, SSR: 6, UR: 9 };
