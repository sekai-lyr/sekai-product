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
};

export function paramCandidatesFor(action) {
    return PARAM_CANDIDATES[action] || [{}];
}
