### 任务 10：状态标签 UI

**文件：**
- 修改：`js/card-view.js:71-79`（`cardRuleStatusHtml`）
- 修改：`css/style.css`（`.card-rule-status` 相关，追加状态色）
- 测试：`test/status-effects.test.js` 追加

- [ ] **步骤 1：编写失败的测试**

```js
import { cardRuleStatusHtml } from "../js/card-view.js";

test("状态标签显示层数与异界/领域标记", () => {
    const c = createCardInstance({ id: "ui", name: "UI", type: "monster", level: 4, attack: 1, defense: 1, effects: [] });
    applyAilment(c, "burn", 2, 500);
    applyAilment(c, "venom", 1, 450);
    c.themedState.exile = { returnTurn: 5 };
    const html = cardRuleStatusHtml(c);
    assert.match(html, /灼烧 2/);
    assert.match(html, /剧毒 1/);
    assert.match(html, /异界归来/);
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`node --test test/status-effects.test.js`
预期：FAIL

- [ ] **步骤 3：实现**

`cardRuleStatusHtml` 的循环前追加：

```js
const statuses = state.statuses || {};
const ailmentNames = { burn: "灼烧", venom: "剧毒", bleed: "出血", curse: "诅咒" };
for (const [id, name] of Object.entries(ailmentNames)) {
    const stacks = Number(statuses[id]) || 0;
    if (stacks > 0) labels.push(`${name} ${stacks}`);
}
if (state.exile) labels.push("异界归来");
if (state.domain) labels.push(`领域·${state.domain.id === "wuji" ? "无量空处" : state.domain.id === "za_warudo" ? "白金之星" : state.domain.id === "rojin" ? "罗针" : "苍穹音浪"}`);
if (state.paralyzedUntil != null) labels.push("麻痹");
if (state.infinityUntil != null) labels.push("无下限");
```

`css/style.css` 在 `.card-rule-status`（6774 行）附近追加：

```css
.card-rule-status .status-burn { color:#ff8a4c; }
.card-rule-status .status-venom { color:#b07dff; }
.card-rule-status .status-bleed { color:#ff5d7a; }
.card-rule-status .status-curse { color:#a06bff; }
.card-rule-status .status-exile { color:#8fb8ff; }
.card-rule-status .status-domain { color:#63ddff; }
```

- [ ] **步骤 4：运行测试验证通过**

运行：`node --test test/status-effects.test.js`
预期：PASS

- [ ] **检查点：** `node --test test/*.test.js` 全绿。

---