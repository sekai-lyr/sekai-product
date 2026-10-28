// Borrowed practice decks never enter the player's collection or grant rewards.
const copies = rows => rows.flatMap(([id, count]) => Array(count).fill(id));
const support = copies([
    ["ygo_n_84257639", 2], ["ygo_n_83764718", 2], ["ygo_n_19159413", 2],
    ["ygo_n_25880422", 2], ["picture_ex_002", 2],
    ["ygo_n_12607053", 2], ["ygo_n_77622396", 2], ["ygo_n_80604091", 2], ["ygo_n_96355986", 2],
]);
export const STRATEGY_DECKS = [
    {
        id: "ensemble", name: "合奏续航", coverCardId: "picture_ex_094", difficulty: "normal",
        plan: "用不同属性的队友维持补给；主唱放弃攻击，回收墓地怪兽并抽卡。",
        opening: "先建立低星场面，再保留不同属性队友；墓地有怪兽后启动舞台接力。",
        counter: "拆掉不同属性队友、清理墓地，或趁核心转守备时突破。",
        core: ["water_009", "water_010", "picture_ex_094", "picture_ex_095"],
        main: [...copies([["picture_ex_094",3],["water_010",2],["water_009",3],["water_008",2],["picture_ex_095",2],["picture_ex_086",2],["picture_ex_084",2],["ygo_n_13039848",3],["water_007",1],["nc_sp_ss_003",2]]), ...support], extra: [], side: [],
    },
    {
        id: "charge", name: "蓄力突击", coverCardId: "picture_ssr7_010", difficulty: "normal",
        plan: "前排守住准备回合；善逸以攻击机会蓄力，美琴以两次蓄力换取精准除外。",
        opening: "先用低星角色铺场。准备与进攻择机切换，不要在能直接取胜时放弃攻击。",
        counter: "在蓄力阶段冻结、封印或让核心离场，迫使其重新投入资源。",
        core: ["picture_ex_021", "picture_ex_032", "picture_ssr7_010"],
        main: [...copies([["picture_ex_021",3],["picture_ex_032",3],["picture_ex_029",3],["picture_ex_047",2],["picture_ssr7_010",2],["ygo_n_13039848",3],["picture_ex_025",2],["ygo_n_5053103",2],["picture_ex_008",2]]), ...support], extra: [], side: [],
    },
    {
        id: "burn", name: "灼烧引爆", coverCardId: "picture_ex_027", difficulty: "normal",
        plan: "先点燃再引爆，用标记交换立即伤害；剧毒负责牵制回复。",
        opening: "先保留任一核心，另一名登场后让炼狱主动点燃，再由祢豆子立即引爆；没有灼烧时保留引爆技，注意召唤次数。",
        counter: "净化、回手或解放带标记的怪兽，打断两张核心之间的配合。",
        core: ["picture_ex_030", "picture_ex_027", "picture_ex_037"],
        main: [...copies([["picture_ex_030",3],["picture_ex_027",3],["picture_ex_025",3],["picture_ex_037",2],["picture_ex_029",3],["ygo_n_13039848",3],["picture_ex_041",1],["ygo_n_23771716",2],["picture_ex_007",2]]), ...support], extra: [], side: [],
    },
];
export function getStrategyDeck(id) { return STRATEGY_DECKS.find(deck => deck.id === id) || null; }
