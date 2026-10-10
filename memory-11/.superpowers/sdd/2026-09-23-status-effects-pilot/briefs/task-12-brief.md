### 任务 12：领域展开演出 + 音效

**文件：**
- 修改：`js/effects.js`（`playDomainCinematic`、`DOMAIN_CINEMATICS` 导出）
- 修改：`js/audio.js`（10 个新音）
- 修改：`css/style.css`（领域 overlay / chip）
- 测试：`test/status-effects.test.js` 追加数据断言

- [ ] **步骤 1：编写失败的测试**

```js
import { DOMAIN_CINEMATICS } from "../js/effects.js";
import { playSound, _resetAudioForTests } from "../js/audio.js";

test("四个领域都有演出定义", () => {
    for (const id of ["wuji", "za_warudo", "rojin", "ongaku"]) {
        assert.ok(DOMAIN_CINEMATICS[id], `缺少领域演出：${id}`);
        assert.ok(DOMAIN_CINEMATICS[id].title?.length > 0);
        assert.ok(DOMAIN_CINEMATICS[id].color?.length > 0);
    }
});

test("Node 环境下新音效是安全空操作", () => {
    _resetAudioForTests();
    for (const name of ["ignite", "venom", "bleed", "curse", "exile", "paralyze", "detonate", "domain", "coin", "statusTick"]) {
        assert.doesNotThrow(() => playSound(name));
    }
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`node --test test/status-effects.test.js`
预期：FAIL

- [ ] **步骤 3：实现**

`effects.js` 追加：

```js
export const DOMAIN_CINEMATICS = {
    wuji:      { title: "領域展開 · 無量空處", subtitle: "五条悟", color: "#cfd6ff", accent: "#0c0d1a", style: "information" },
    za_warudo: { title: "スタープラチナ・ザ・ワールド", subtitle: "空条承太郎", color: "#ffe06b", accent: "#2b1f00", style: "clock" },
    rojin:     { title: "破壊殺・羅針", subtitle: "猗窩座", color: "#ff5d67", accent: "#2a0a0c", style: "compass" },
    ongaku:    { title: "苍穹音浪", subtitle: "初音未来", color: "#63ddff", accent: "#3a0b4f", style: "stage" },
};

export function playDomainCinematic(fieldId, cardName = "", ownerIndex = 0) {
    if (!isBrowser) return;
    const def = DOMAIN_CINEMATICS[fieldId] || DOMAIN_CINEMATICS.wuji;
    playSound("domain");
    playTimeSlowEffect(700);
    playEnergyPulse(def.color, "rgba(255,255,255,.35)");
    const overlay = document.createElement("div");
    overlay.className = `domain-overlay domain-${def.style}`;
    overlay.style.setProperty("--domain-color", def.color);
    overlay.style.setProperty("--domain-accent", def.accent);
    overlay.innerHTML = `<div class="domain-vignette"></div><div class="domain-title"><small>${def.subtitle}</small><strong>${def.title}</strong></div>`;
    (document.querySelector(".battle-screen") || document.body).appendChild(overlay);
    removeAfter(overlay, 1700);
    if (def.style === "clock") playChromaticBurst();
    if (def.style === "stage") playParticleRain(def.color, 24);
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) overlay.classList.add("reduced");
    // 领域存续徽记
    const chip = document.createElement("div");
    chip.className = "domain-chip";
    chip.textContent = def.title;
    chip.style.setProperty("--domain-color", def.color);
    document.getElementById("battle-screen")?.appendChild(chip);
    removeAfter(chip, 20000);
}
```

`audio.js` 的 `playSound` switch 追加：

```js
case "ignite": noise(ctx, { duration: 0.32, volume: 0.24, filterType: "bandpass", frequency: 900, sweepTo: 2400 }); tone(ctx, { type: "sawtooth", from: 160, to: 60, duration: 0.3, volume: 0.18 }); break;
case "venom": [0, 0.1, 0.2].forEach((offset, i) => tone(ctx, { type: "sine", from: (1400 - i * 260) * pitch, to: (700 - i * 120) * pitch, duration: 0.12, start: offset, volume: 0.14 })); noise(ctx, { duration: 0.3, volume: 0.12, filterType: "highpass", frequency: 1800 }); break;
case "bleed": noise(ctx, { duration: 0.14, volume: 0.28, filterType: "highpass", frequency: 2600, sweepTo: 800 }); break;
case "curse": tone(ctx, { type: "sawtooth", from: 420, to: 90, duration: 0.5, volume: 0.2 }); break;
case "exile": tone(ctx, { type: "sine", from: 180, to: 1100, duration: 0.45, volume: 0.2 }); noise(ctx, { duration: 0.4, volume: 0.16, filterType: "bandpass", frequency: 500, sweepTo: 2600 }); break;
case "paralyze": [0, 0.05, 0.1].forEach(offset => tone(ctx, { type: "square", from: 2200, to: 1500, duration: 0.06, start: offset, volume: 0.12 })); break;
case "detonate": noise(ctx, { duration: 0.5, volume: 0.34, filterType: "lowpass", frequency: 1600, sweepTo: 120 }); tone(ctx, { type: "sine", from: 180, to: 40, duration: 0.45, volume: 0.3 }); break;
case "domain": tone(ctx, { type: "sine", from: 110, to: 220, duration: 1.0, volume: 0.22 }); tone(ctx, { type: "triangle", from: 330, to: 440, duration: 1.0, start: 0.08, volume: 0.14 }); break;
case "coin": [0, 0.07, 0.14].forEach((offset, i) => tone(ctx, { type: "triangle", from: (1200 + i * 300) * pitch, to: (900 + i * 200) * pitch, duration: 0.1, start: offset, volume: 0.16 })); break;
case "statusTick": tone(ctx, { type: "square", from: 500 * pitch, to: 320 * pitch, duration: 0.09, volume: 0.1 }); break;
```

`css/style.css` 追加：

```css
.domain-overlay { position:fixed; inset:0; z-index:266; pointer-events:none; animation:domainIn 1.7s ease-out forwards; }
.domain-overlay .domain-vignette { position:absolute; inset:0; background:radial-gradient(ellipse at center, transparent 26%, var(--domain-accent) 100%); }
.domain-overlay .domain-title { position:absolute; left:50%; top:34%; transform:translate(-50%,-50%); display:grid; justify-items:center; gap:6px; text-align:center; }
.domain-overlay .domain-title small { color:var(--domain-color); letter-spacing:.5em; font-size:12px; }
.domain-overlay .domain-title strong { color:#fff; font-size:clamp(26px,4.6vw,58px); letter-spacing:.18em; text-shadow:0 0 26px var(--domain-color); }
.domain-overlay.reduced { animation-duration:.4s; }
.domain-overlay.reduced .domain-title strong { font-size:clamp(20px,3vw,36px); }
.domain-information .domain-vignette { background:linear-gradient(180deg, rgba(5,5,12,.85), rgba(5,5,12,.4)); }
.domain-clock .domain-vignette { background:repeating-conic-gradient(from 0deg, rgba(255,224,107,.08) 0deg 6deg, transparent 6deg 30deg); }
.domain-compass .domain-vignette { background:repeating-conic-gradient(from 0deg, rgba(255,93,103,.12) 0deg 4deg, transparent 4deg 24deg); }
.domain-stage .domain-vignette { background:linear-gradient(180deg, rgba(99,221,255,.18), transparent 55%, rgba(255,127,225,.16)); }
.domain-chip { position:absolute; right:14px; top:64px; z-index:206; padding:4px 10px; border:1px solid var(--domain-color); border-radius:999px; color:var(--domain-color); font-size:11px; letter-spacing:.18em; background:rgba(8,8,16,.55); pointer-events:none; animation:domainChipIn .5s ease-out; }
@keyframes domainIn { 0%{opacity:0;} 12%{opacity:1;} 78%{opacity:1;} 100%{opacity:0;} }
@keyframes domainChipIn { from{opacity:0; transform:translateY(-8px);} to{opacity:1; transform:none;} }
```

- [ ] **步骤 4：运行测试验证通过**

运行：`node --test test/status-effects.test.js`
预期：PASS
运行：`npm run check`
预期：全部模块语法通过

- [ ] **检查点：** 浏览器实测四张领域卡（五条悟无量空处 / 承太郎 / 猗窝座罗针 / 初音苍穹音浪），确认全屏演出与领域 chip；`onStatus` 相关控制台无错误。

---