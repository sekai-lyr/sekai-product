### 任务 11：动作特效映射 + 技能横幅 + 状态徽记 + 硬币演出（effects.js / controller.js）

**文件：**
- 修改：`js/effects.js`（`THEMED_ACTION_VISUALS` 导出、`ruleVisualKey`、`resolveRuleTargets`、`playRuleDrivenEffect`、`showSkillBanner`、`playCoinFlip`）
- 修改：`js/controller.js:32`（构造函数订阅 `onCoinFlip`）
- 测试：`test/status-effects.test.js` 追加数据断言

- [ ] **步骤 1：编写失败的测试**

```js
import { THEMED_ACTION_VISUALS } from "../js/effects.js";

test("10 个新动作都有特效映射且键唯一", () => {
    const actions = ["ignite", "venom", "bleed", "curse", "exile", "paralyze", "detonate", "infinity", "domain", "gamble"];
    const visuals = actions.map(a => THEMED_ACTION_VISUALS[a]);
    for (const v of visuals) assert.ok(v && v.motion && v.color, "缺少视觉定义");
    assert.equal(new Set(visuals.map(v => v.motion + v.color)).size, actions.length);
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`node --test test/status-effects.test.js`
预期：FAIL（`THEMED_ACTION_VISUALS` 未导出）

- [ ] **步骤 3：实现**

`effects.js` 追加（数据 + 行为）：

```js
export const THEMED_ACTION_VISUALS = {
    ignite:   { label: "IGNITE", motion: "rise", color: "#ff7a3c", accent: "#ffd36b" },
    venom:    { label: "VENOM", motion: "fall", color: "#9d6bff", accent: "#7dffa8" },
    bleed:    { label: "BLEED", motion: "sweep", color: "#ff4f70", accent: "#ff9b8a" },
    curse:    { label: "CURSE", motion: "shield", color: "#8c5cff", accent: "#2a1740" },
    exile:    { label: "EXILE", motion: "void", color: "#7b5cff", accent: "#1b1035" },
    paralyze: { label: "STUN", motion: "impact", color: "#ffe06b", accent: "#70dcff" },
    detonate: { label: "DETONATE", motion: "impact", color: "#ff5d67", accent: "#ffb04a" },
    infinity: { label: "INFINITY", motion: "shield", color: "#d7e6ff", accent: "#8fb8ff" },
    domain:   { label: "DOMAIN", motion: "wave", color: "#cfd6ff", accent: "#8f7cff" },
    gamble:   { label: "GAMBLE", motion: "spiral", color: "#ffd76b", accent: "#fff6c9" },
};

function themedVisualKey(effect) {
    if (effect?.type === "themedAction" && THEMED_ACTION_VISUALS[effect.action]) return effect.action;
    return ruleVisualKey(effect?.type);
}
```

`resolveRuleTargets(effect, origin, ownerIndex)` 第一行改为：

```js
const key = themedVisualKey(effect);
```

`playRuleDrivenEffect` 中：`RULE_VISUALS[key]` 改为 `RULE_VISUALS[key] || THEMED_ACTION_VISUALS[key]`；并在循环前追加：

```js
if (effect.type === "themedAction" && effect.skillName) showSkillBanner(effect.skillName, effect.skillLabel, effect.action);
if (effect.type === "themedAction" && effect.action === "domain") playDomainCinematic(effect.params?.field, cardOrEffect?.name, ownerIndex);
```

新增函数：

```js
export function showSkillBanner(skillName, label = "主动技", action = "") {
    if (!isBrowser || !skillName) return;
    const banner = document.createElement("div");
    banner.className = "skill-banner";
    banner.innerHTML = `<small>【${label}】</small><strong>${skillName}</strong>`;
    (document.querySelector(".battle-screen") || document.body).appendChild(banner);
    removeAfter(banner, 950);
}

export function playCoinFlip(result = "pending") {
    if (!isBrowser) return;
    const coin = document.createElement("div");
    coin.className = `coin-flip ${result}`;
    coin.innerHTML = `<div class="coin-face"></div><strong>${result === "heads" ? "正面" : result === "tails" ? "反面" : "抛硬币"}</strong>`;
    (document.querySelector(".battle-screen") || document.body).appendChild(coin);
    removeAfter(coin, 950);
}
```

`controller.js` 构造函数（第 32 行 `constructor(gameState, engine, ui) {` 内）追加：

```js
this.engine?.eventBus?.on?.("onCoinFlip", ({ result }) => playCoinFlip(result));
```

并在文件顶部 import 中补 `playCoinFlip`。

`css/style.css` 追加：

```css
.skill-banner { position:absolute; left:50%; top:12%; transform:translateX(-50%); z-index:206; display:grid; justify-items:center; pointer-events:none; animation:skillBannerIn .9s ease-out forwards; }
.skill-banner small { color:rgba(255,255,255,.75); letter-spacing:.4em; font-size:11px; }
.skill-banner strong { color:#fff; font-size:clamp(18px,2.6vw,32px); letter-spacing:.1em; text-shadow:0 0 18px rgba(255,215,107,.8); }
.coin-flip { position:fixed; left:50%; top:38%; transform:translate(-50%,-50%); z-index:272; display:grid; justify-items:center; gap:8px; pointer-events:none; animation:coinFlipSpin .9s ease-out forwards; }
.coin-face { width:74px; height:74px; border-radius:50%; background:radial-gradient(circle at 35% 30%, #fff6c9, #d9a441 60%, #7a5a1a 100%); box-shadow:0 0 30px rgba(255,215,107,.85); }
.coin-flip.tails .coin-face { background:radial-gradient(circle at 35% 30%, #e8f1ff, #8fa8c9 60%, #40506b 100%); }
.coin-flip strong { color:#fff; letter-spacing:.3em; }
@keyframes skillBannerIn { 0%{opacity:0; transform:translateX(-50%) translateY(-14px);} 15%{opacity:1;} 80%{opacity:1;} 100%{opacity:0; transform:translateX(-50%) translateY(-4px);} }
@keyframes coinFlipSpin { 0%{opacity:0; transform:translate(-50%,-50%) rotateY(0) scale(.7);} 20%{opacity:1;} 70%{transform:translate(-50%,-50%) rotateY(720deg) scale(1);} 100%{opacity:0; transform:translate(-50%,-50%) rotateY(900deg) scale(1);} }
```

- [ ] **步骤 4：运行测试验证通过**

运行：`node --test test/status-effects.test.js`
预期：PASS

- [ ] **检查点：** 浏览器打开 `http://127.0.0.1:8091` 打一局，任一新动作能看到横幅与粒子；控制台无报错。

---