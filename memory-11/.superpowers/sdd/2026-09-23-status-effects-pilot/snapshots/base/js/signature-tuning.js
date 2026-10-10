// 每个主题动作的“可多样性参数”候选池：同一动作的每张卡按顺序取一个不同参数，
// 让 368 张卡的卡面文字与结算数值都各不相同。候选按“温和→激进”排序。
function range(start, end, step = 1) {
    const values = [];
    if (step > 0) for (let value = start; value <= end; value += step) values.push(value);
    else for (let value = start; value >= end; value += step) values.push(value);
    return values;
}

function combos(...dimensions) {
    let out = [{}];
    for (const [key, values] of dimensions) {
        const next = [];
        for (const base of out) for (const value of values) next.push({ ...base, [key]: value });
        out = next;
    }
    return out;
}

export const PARAM_CANDIDATES = {
    scout: range(2, 15).map(count => ({ count })),
    study: range(2, 15).map(count => ({ count })),
    prepare: range(1, 6).map(count => ({ count })),
    recover: combos(["limit", [4, 3, 5, 2]], ["count", [1, 2]], ["draw", [0, 1]]),
    recycle: combos(["count", [3, 2, 4, 5]], ["draw", [1, 2]]),
    deploy: combos(["limit", [4, 3, 5, 2]], ["heal", [0, 300, 600]]),
    revive: combos(["limit", [4, 3, 5, 2]], ["count", [1, 2]], ["heal", [0, 300]]),
    recall: combos(["count", [1, 2, 3]], ["draw", [0, 1]], ["heal", [0, 300]]),
    shelter: range(0, 900, 100).map(amount => ({ amount })),
    seal: range(0, 800, 100).map(amount => ({ amount })),
    sleep: range(0, 900, 100).map(amount => ({ amount })),
    freeze: range(0, 600, 100).map(amount => ({ amount })),
    poison: [600, 500, 700, 400, 800, 450, 550].map(damage => ({ damage })),
    bomb: range(0, 1000, 100).map(damage => ({ damage })),
    charge: [200, 250, 300, 150, 350].map(amount => ({ amount })),
    burst: [700, 600, 800, 500, 900, 550, 650, 750, 850, 950, 450, 1000, 1050, 1100].map(cost => ({ cost })),
    twin: [600, 500, 700, 400, 800, 450, 550, 650, 750].map(cost => ({ cost })),
    pierce: range(0, 1000, 100).map(amount => ({ amount })),
    ward: range(0, 800, 100).map(amount => ({ amount })),
    ambush: range(1, 2).map(count => ({ count })),
    token: [
        { attack: 0, defense: 1000 },
        { attack: 300, defense: 900 },
        { attack: 500, defense: 800 },
        { attack: 700, defense: 700 },
        { attack: 900, defense: 600 },
        { attack: 1100, defense: 500 },
        { attack: 1300, defense: 400 },
    ],
    exchange: combos(["limit", [4, 3, 5]], ["draw", [0, 1]]),
    chorus: combos(["count", [2, 3, 4]], ["draw", [1, 2]], ["heal", [0, 300, 600]]),
    sanctuary: [1000, 800, 1200, 1400, 1600].map(heal => ({ heal })),
    purify: range(1, 4).map(count => ({ count })),
    disarm: combos(["count", [1, 2, 3]], ["heal", [0, 300]]),
    mirror: [{ amount: 0 }, { amount: 300 }, { amount: 500 }],
    timeStop: [1200, 1000, 1400].map(cost => ({ cost })),
    devour: [800, 700, 900].map(cost => ({ cost })),
    inherit: range(4, 2, -1).map(limit => ({ limit })),
    // 30 张试点卡（状态异常/领域/赌运）：候选按“同动作卡在 catalog 中的出现顺序”排列，
    // 前 N 项即 §7 表的目标数值（N=该动作试点卡数），其余为后续扩展保留。
    // 顺序由 src/test/js/pilot-roster.test.js 的唯一性断言锁定。
    ignite: [
        { stacks: 3, damage: 400 }, // picture_ssr7_007
        { stacks: 1, damage: 700 }, // picture_ssr7_026
        { stacks: 2, damage: 500 }, // picture_ex_030
        { stacks: 1, damage: 800 }, // source_monster_014
        { stacks: 2, damage: 600 }, { stacks: 2, damage: 450 }, { stacks: 3, damage: 500 }, { stacks: 1, damage: 900 },
    ],
    venom: [
        { stacks: 2, damage: 450 }, // picture_ex_037
        { stacks: 1, damage: 600 }, { stacks: 3, damage: 400 },
    ],
    bleed: [
        { stacks: 2, damage: 500 }, // picture_ssr7_013
        { stacks: 1, damage: 700 }, // picture_ssr7_015
        { stacks: 1, damage: 650 }, // picture_ssr7_049
        { stacks: 3, damage: 300 }, // picture_ex_014
        { stacks: 2, damage: 400 }, // picture_ex_020
        { stacks: 2, damage: 600 }, // source_monster_012
        { stacks: 3, damage: 450 },
    ],
    curse: [
        { stacks: 2, damage: 500 }, // picture_ssr7_014
        { stacks: 1, damage: 600 }, // picture_ssr7_032
        { stacks: 1, damage: 800 }, // source_monster_008
        { stacks: 1, damage: 700 },
    ],
    paralyze: [
        { count: 1, amount: 0, gamble: false }, // picture_ssr7_043
        { count: "all", amount: 0, gamble: false }, // picture_ex_013
        { gamble: true, amount: 600 }, // picture_ex_048
        { count: 1, amount: 400, gamble: false },
    ],
    domain: [
        { field: "za_warudo", cost: 1000 }, // picture_ex_011
        { field: "rojin", cost: 800 }, // picture_ex_056
        { field: "ongaku", cost: 600 }, // picture_ex_107
        { field: "wuji", cost: 1200 }, // source_monster_015
    ],
    detonate: [
        { stacks: 1, damage: 750 }, // picture_ssr7_016
        { stacks: 1, damage: 800 }, // picture_ex_012
        { stacks: 2, damage: 650 }, // picture_ex_027
        { stacks: 3, damage: 500 }, // source_monster_013
    ],
    exile: [
        { turns: 1, penalty: 300, self: false }, // picture_ssr7_003
        { turns: 2, penalty: 500, self: false }, // picture_ex_018
        { turns: 1, penalty: 500, self: true }, // picture_ex_072
    ],
    infinity: [
        { reduce: 1000 }, // source_monster_010
        { reduce: 1200 }, { reduce: 800 },
    ],
    gamble: [
        { draw: 2, heal: 800 }, // picture_ssr7_036
        { draw: 3, heal: 1000 }, { draw: 1, heal: 600 },
    ],
};

export function paramCandidatesFor(action) {
    return PARAM_CANDIDATES[action] || [{}];
}
