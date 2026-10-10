### 任务 9：30 张卡配方与技能名

**文件：**
- 修改：`js/signature-tuning.js`（新动作候选池）
- 修改：`js/authored-card-rules.js`（RECIPES + CHARACTER_SKILLS）
- 修改：`test/themed-gameplay.test.js`（死亡回归用例）
- 创建：`src/test/js/pilot-roster.test.js`

- [ ] **步骤 1：编写失败的测试**

```js
// src/test/js/pilot-roster.test.js
import assert from "node:assert/strict";
import test from "node:test";
import { ALL_CARDS } from "../../main/resources/static/js/catalog.js";

const ROSTER = {
    picture_ex_030: "ignite", picture_ex_037: "venom", picture_ex_020: "bleed",
    picture_ex_048: "paralyze", picture_ex_027: "detonate", picture_ex_056: "domain",
    picture_ex_011: "domain", picture_ex_012: "detonate", picture_ex_013: "paralyze",
    picture_ex_014: "bleed", picture_ex_018: "exile",
    source_monster_015: "domain", source_monster_010: "infinity", source_monster_012: "bleed",
    source_monster_014: "ignite", source_monster_013: "detonate", source_monster_008: "curse",
    picture_ex_072: "exile",
    picture_ssr7_032: "curse", picture_ssr7_036: "gamble", picture_ssr7_043: "paralyze",
    picture_ssr7_026: "ignite", picture_ssr7_049: "bleed", picture_ex_107: "domain",
    picture_ssr7_007: "ignite", picture_ssr7_016: "detonate", picture_ssr7_003: "exile",
    picture_ssr7_013: "bleed", picture_ssr7_014: "curse", picture_ssr7_015: "bleed",
};

test("30 张试点卡动作映射正确且卡面可渲染", () => {
    assert.equal(Object.keys(ROSTER).length, 30);
    for (const [id, action] of Object.entries(ROSTER)) {
        const card = ALL_CARDS.find(item => item.id === id);
        assert.ok(card, `缺少卡：${id}`);
        assert.deepEqual(card.effects.map(e => e.action), [action], `${id} 动作不符`);
        assert.ok(card.effects[0].skillName?.length > 0, `${id} 缺技能名`);
        assert.ok((card.description || "").includes(card.effects[0].description.replace(/^.*?：/u, "")), `${id} 卡面与效果不一致`);
    }
});

test("30 张试点卡参数互不相同（同动作内）", () => {
    const groups = new Map();
    for (const id of Object.keys(ROSTER)) {
        const card = ALL_CARDS.find(item => item.id === id);
        const e = card.effects[0];
        const key = `${e.trigger}|${e.action}`;
        const params = JSON.stringify(e.params || {});
        if (!groups.has(key)) groups.set(key, new Map());
        assert.equal(groups.get(key).has(params), false, `${id} 参数重复`);
        groups.get(key).set(params, id);
    }
});
```

`themed-gameplay.test.js` 的死亡回归用例改为：

```js
test("死亡回归：破坏时支付800LP进入异界区并在结束阶段归来", () => {
    const { e, p } = setup(); const c = createCardInstance(getCardById("picture_ex_072"));
    p.monsterZone.push(c); e.destroyFieldMonster(p, c);
    assert.equal(p.lp, 7200);
    assert.ok(p.banished.includes(c));
    e.endTurn();
    assert.ok(p.monsterZone.includes(c));
    assert.equal(c.position, "defense");
});
```

- [ ] **步骤 2：运行测试验证失败**

运行（在 `SekaiGame` 目录）：`node --test src/test/js/pilot-roster.test.js`
预期：FAIL（多数卡动作仍是旧动作）
运行（在 `static`）：`node --test test/themed-gameplay.test.js`
预期：FAIL（死亡回归旧行为断言不成立）

- [ ] **步骤 3：实现**

1. `signature-tuning.js` 的 `PARAM_CANDIDATES` 追加（候选顺序需与 §7 数值一致；按 catalog 中同动作卡出现顺序排列）：

```js
ignite: [{ stacks: 2, damage: 500 }, { stacks: 1, damage: 800 }, { stacks: 1, damage: 700 }, { stacks: 3, damage: 400 }, { stacks: 2, damage: 600 }, { stacks: 2, damage: 450 }, { stacks: 3, damage: 500 }, { stacks: 1, damage: 900 }],
venom: [{ stacks: 2, damage: 450 }, { stacks: 1, damage: 600 }, { stacks: 3, damage: 400 }],
bleed: [{ stacks: 2, damage: 400 }, { stacks: 3, damage: 300 }, { stacks: 2, damage: 600 }, { stacks: 1, damage: 650 }, { stacks: 2, damage: 500 }, { stacks: 1, damage: 700 }, { stacks: 3, damage: 450 }],
curse: [{ stacks: 1, damage: 700 }, { stacks: 1, damage: 800 }, { stacks: 1, damage: 600 }, { stacks: 2, damage: 500 }],
paralyze: [{ count: 1, amount: 0, gamble: false }, { count: "all", amount: 0, gamble: false }, { gamble: true, amount: 600 }, { count: 1, amount: 400, gamble: false }],
domain: [{ field: "rojin", cost: 800 }, { field: "za_warudo", cost: 1000 }, { field: "wuji", cost: 1200 }, { field: "ongaku", cost: 600 }],
detonate: [{ stacks: 2, damage: 650 }, { stacks: 1, damage: 800 }, { stacks: 3, damage: 500 }, { stacks: 1, damage: 750 }],
exile: [{ turns: 2, penalty: 500, self: false }, { turns: 1, penalty: 300, self: false }, { turns: 1, penalty: 500, self: true }],
infinity: [{ reduce: 1000 }, { reduce: 1200 }, { reduce: 800 }],
gamble: [{ draw: 2, heal: 800 }, { draw: 3, heal: 1000 }, { draw: 1, heal: 600 }],
```

> 实现者注意：执行 `node -e` 脚本按 catalog 顺序打印每个动作分组的卡 id 顺序，对照 §7 调整候选数组顺序，使每张卡拿到表内数值；随后由 `pilot-roster` 的"参数互不相同"断言锁定唯一性。

2. `authored-card-rules.js` 的 RECIPES：把 30 张卡改为单动作配方（触发按 §7）。例如：

```js
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
});
```

3. `CHARACTER_SKILLS` 固定技能名（防止动作变化后名称漂移；均为 §7 表名）：

```js
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
});
```

- [ ] **步骤 4：运行测试验证通过**

运行（`SekaiGame`）：`node --test src/test/js/pilot-roster.test.js src/test/js/effect-diversity.test.js src/test/js/premium-monster-rule-uniqueness.test.js`
预期：PASS
运行（`static`）：`node --test test/themed-gameplay.test.js`
预期：PASS

- [ ] **检查点：** 运行（`SekaiGame`）`node --test src/test/js/*.test.js`，全部通过（包括既有 15 个测试文件）。

---