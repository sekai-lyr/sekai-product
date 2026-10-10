# Our Notes 风格沉浸式游戏化 UI 改造 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 把登录/首页/招募/图鉴/编成/手册/设置全部改造成《BanG Dream! Our Notes》式的深色沉浸游戏 UI，首页结构完全对齐参考布局。

**架构：** 不动 `css/style.css`（战斗界面与测试基线），全部视觉在 `css/game-shell.css` 重写；`index.html` 重排外壳（悬浮顶栏 + 右侧功能键列 + 底部 4 格导航）；`app.js` 各页面渲染模板换结构、保留全部 DOM id 与交互逻辑。

**技术栈：** 原生 HTML/CSS/ES Module；Node test（`node --test`）作为回归保障；`scripts/game-shell-qa.mjs`（CDP 无头 Chromium）作为视觉验证。

**说明：** 本仓库不是 git 仓库，计划中的"Commit"统一替换为"存档点"= 跑 `npm test` + 生成 QA 截图确认无回归。

**规格：** `docs/superpowers/specs/2026-09-27-ournotes-ui-redesign-design.md`（已获批准）

---

## 文件结构

- 修改：`src/main/resources/static/index.html` — Shell（顶栏/功能键列/底部导航）与登录页结构。
- 修改：`src/main/resources/static/css/game-shell.css` — 全量重写为深色沉浸式皮肤（唯一视觉变更入口）。
- 修改：`src/main/resources/static/js/app.js` — `bindGlobalEvents`、`renderTopbar`、`renderHome`、`renderShop`、`renderCollection`、`renderDeckEditor`、`renderRules`、`renderSettings`、`gameIcon`。
- 不改：`css/style.css`、`js/main.js`、其余业务模块（权限边界见规格"兼容约束"）。

---

### 任务 1：深色设计令牌与 Shell 基础皮肤

**文件：**
- 修改：`css/game-shell.css`（第 1–34 行的浅色覆盖层整体替换为深色令牌 + 组件基础）

- [ ] **步骤 1：重写文件头部令牌与基础组件样式**

```css
/* Illustrated game shell. Battle layout and recruitment retain their own styles. */
body .game-shell {
    --bg-0:#05070f; --bg-1:#090d1c; --bg-2:#0d1226;
    --panel:rgba(13,17,33,.82); --panel-strong:rgba(19,24,45,.94); --glass:rgba(255,255,255,.06);
    --line:rgba(140,160,220,.22); --line-strong:rgba(160,180,255,.42);
    --text:#eef1ff; --text-2:#a9b2d6; --text-3:#6f7899;
    --accent:#8b6cf0; --accent-2:#45d6e8; --gold:#e9c46a; --danger:#ff5d7e; --success:#43d6a5;
    --shadow:0 18px 50px rgba(0,0,0,.55); --topbar-h:74px; --nav-h:84px;
    position:fixed; inset:0; display:block; min-height:0; height:100dvh; overflow:hidden;
    background:var(--bg-0); color:var(--text); color-scheme:dark;
    font-family:"Segoe UI","Microsoft YaHei",sans-serif;
}
body .game-shell.is-hidden { display:none; }
body .game-shell button { cursor:pointer; }
body .game-shell button:disabled { cursor:not-allowed; opacity:.42; filter:saturate(.5); }
body .game-shell button:focus-visible,body .game-shell input:focus-visible,body .game-shell select:focus-visible { outline:2px solid var(--accent-2); outline-offset:2px; }
body .game-shell .primary-action { border:1px solid #9d82ff66; border-radius:999px; background:linear-gradient(135deg,#8b6cf0,#6a4fd0); color:#fff; box-shadow:0 6px 18px #8b6cf066,inset 0 1px 0 #ffffff2e; }
body .game-shell .secondary-action { border:1px solid var(--line-strong); border-radius:999px; background:var(--glass); color:var(--text-2); }
body .game-shell .text-action { color:var(--accent-2); }
body .game-shell input,body .game-shell select { background:rgba(8,11,24,.9); border:1px solid var(--line); color:var(--text); border-radius:10px; }
body .game-shell .empty-copy { color:var(--text-3); }
body .game-shell .screen-root { position:absolute; inset:var(--topbar-h) 0 var(--nav-h); width:100%; max-width:none; min-width:0; margin:0; padding:26px 4vw 36px; overflow:auto; overscroll-behavior:contain; scrollbar-color:#3b476e transparent; animation:screenFade .4s ease both; }
@keyframes screenFade { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:none; } }
```

- [ ] **步骤 2：运行语法与回归检查**

运行：`npm run check`，然后 `npm test`
预期：check 无输出错误；385 条通过（此时旧浅色规则被替换，页面视觉尚未完成但功能不受影响）。

- [ ] **步骤 3：生成首屏截图确认服务可跑**

运行：`node scripts/game-shell-qa.mjs "C:\Users\ADMINI~1\AppData\Local\Temp\opencode\ui-redesign-t1"`
预期：输出 6 页无 runtimeErrors，`home` 截图已是深色底。

---

### 任务 2：Shell 结构重排（index.html）

**文件：**
- 修改：`index.html:50-74`（app-shell 内部结构）
- 修改：`index.html:12-48`（登录页仅加类名，结构留到任务 5）

- [ ] **步骤 1：替换 topbar 为 HUD 悬浮条**

```html
<header class="topbar">
    <button id="game-back" class="game-back" type="button" aria-label="返回主界面" hidden>‹</button>
    <div class="rank-chip" aria-label="决斗者等级与收集进度">
        <span class="rank-badge">RANK</span>
        <div class="rank-body"><strong id="profile-level-big">LV.1</strong><small id="collection-progress-label">收集 0%</small>
            <div class="rank-track"><span id="collection-progress-fill"></span></div></div>
    </div>
    <span id="game-page-name" class="game-page-name">主界面</span>
    <div class="topbar-spacer"></div>
    <div class="currency-chip"><span class="currency-icon coin"></span><strong id="coin-count">0</strong><small>次元币</small></div>
    <div class="currency-chip"><span class="currency-icon shard"></span><strong id="shard-count">0</strong><small>碎片</small></div>
    <button class="profile-chip" data-route="settings" type="button"><span class="profile-avatar">♪</span><span><strong id="profile-name">决斗者</strong><small id="profile-level">LV.1</small></span></button>
</header>
```

- [ ] **步骤 2：添加右侧功能键列（内联 SVG，静态绑定）**

```html
<aside class="hud-rail" aria-label="快捷功能">
    <button id="rail-daily" type="button" aria-label="每日首胜"><span class="rail-dot" id="rail-daily-dot"></span><svg viewBox="0 0 24 24"><path d="M12 3v3m0 12v3m9-9h-3M6 12H3m14.5-6.5-2 2m-7 7-2 2m11 0-2-2m-7-7-2-2"/><circle cx="12" cy="12" r="4"/></svg></button>
    <button id="home-pv" type="button" aria-label="游戏影像"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3Z"/></svg></button>
    <button id="home-tutorial" type="button" aria-label="新手教学"><svg viewBox="0 0 24 24"><path d="M12 5v16M12 5C8 2 4 3 2 4v15c4-1 7 0 10 2 3-2 6-3 10-2V4c-4-1-7-1-10 1Z"/></svg></button>
    <button data-route="rules" type="button" aria-label="决斗手册"><svg viewBox="0 0 24 24"><path d="M4 4h7v16H4Zm9 0h7v16h-7Z"/></svg></button>
    <button data-route="settings" type="button" aria-label="游戏设置"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M4.9 4.9l2.1 2.1m10 10 2.1 2.1M2 12h3m14 0h3M4.9 19.1 7 17m10-10 2.1-2.1"/></svg></button>
</aside>
```

- [ ] **步骤 3：底部导航只保留 4 项**

```html
<aside class="sidebar" aria-label="主要导航">
    <button data-route="home" class="nav-item active" type="button"><span>首页</span></button>
    <button data-route="shop" class="nav-item" type="button"><span>招募</span></button>
    <button data-route="collection" class="nav-item" type="button"><span>图鉴</span></button>
    <button data-route="decks" class="nav-item" type="button"><span>编成</span></button>
</aside>
```

（图标继续由 `app.js` 的 `.sidebar [data-route]` 注入逻辑填充；`nav-index` 序号删除。）

- [ ] **步骤 4：运行回归检查**

运行：`npm test`
预期：385 条通过（`responsive-layout.test.js` 断言 `style.css?v=2.3.0-echo` 存在——未被改动）。

- [ ] **步骤 5：存档点**

运行：`node scripts/game-shell-qa.mjs "C:\Users\ADMINI~1\AppData\Local\Temp\opencode\ui-redesign-t2"`
预期：`home/shop/...-desktop` 与 mobile 截图中导航可点、无溢出（脚本输出 `overflow:false`、`nav:true`）。

---

### 任务 3：交互接线与顶栏真实数据（app.js）

**文件：**
- 修改：`js/app.js`：`bindGlobalEvents`（约 116–135 行）、`renderTopbar`（207–213 行）、`gameIcon`（33–52 行）

- [ ] **步骤 1：`bindGlobalEvents` 增加 hud-rail 一次性绑定**

```js
document.getElementById("home-pv")?.addEventListener("click", () => this.showPvModal());
document.getElementById("home-tutorial")?.addEventListener("click", () => this.startTutorial());
```

（`data-route` 按钮已被通用 `[data-route]` 循环覆盖，无需额外绑定。）

- [ ] **步骤 2：`renderTopbar` 写入收集进度与每日首胜状态**

```js
const ownedCount = Object.values(this.collection.cards || {}).filter(count => count > 0).length;
const totalCount = ALL_PLAYABLE_CARDS.length || 1;
const percent = Math.min(100, Math.round(ownedCount / totalCount * 100));
const fill = document.getElementById("collection-progress-fill");
if (fill) fill.style.width = `${percent}%`;
const label = document.getElementById("collection-progress-label");
if (label) label.textContent = `收集 ${percent}%`;
const big = document.getElementById("profile-level-big");
if (big) big.textContent = `LV.${profile.level || 1}`;
const firstWin = this.collection.statistics?.firstWinToday === new Date().toDateString();
document.getElementById("rail-daily-dot")?.classList.toggle("done", firstWin);
```

- [ ] **步骤 3：`renderHome` 中删除对 `#home-tutorial/#home-pv` 的重复绑定**（保留其余绑定与 `bindJumpButtons`），避免双触发。

- [ ] **步骤 4：运行回归检查**

运行：`npm test`
预期：385 条通过。

---

### 任务 4：首页 Lobby 重写

**文件：**
- 修改：`js/app.js`：`renderHome`（215–252 行）
- 修改：`css/game-shell.css`：Lobby 段落（原 35–51 行全部替换）

- [ ] **步骤 1：重写 `renderHome` 模板（保留全部 id 与数据逻辑）**

```js
this.screenRoot.innerHTML = `
    <section class="game-lobby" aria-label="游戏主界面">
        <div class="lobby-scenery" aria-hidden="true"></div>
        <div class="lobby-particles" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <div class="lobby-character" aria-hidden="true">${cardArtHtml(heroCard, "lobby-character-art", true).replace('loading="lazy"', 'loading="eager"')}</div>
        <div class="lobby-light" aria-hidden="true"></div>
        <div class="lobby-chapter"><span>SEKAI / ELEMENTAL DUEL</span><h1>次元决斗</h1><p>元素召唤</p><i></i></div>
        <div class="lobby-character-name"><span>与你并肩</span><strong>${escapeHtml(heroCard?.name || "世界的伙伴")}</strong><p>准备好了吗？下一场决斗，一起出发。</p></div>
        <div class="lobby-actions">
            <div class="lobby-daily"><span>每日首胜</span><strong>${firstWin ? "已达成" : "+300 次元币"}</strong><small>${firstWin ? "明天继续并肩作战" : "赢得一场 AI 决斗"}</small></div>
            <button class="lobby-battle" id="home-start-duel" ${validation.valid ? "" : "disabled"}><span class="live-glow" aria-hidden="true"></span>${gameIcon("duel")}<span><small>START DUEL</small><strong>开始决斗</strong><em>与 AI 对战</em></span><b>›</b></button>
            <div class="lobby-sub">
                <button class="lobby-adventure" id="home-stage-duel" ${validation.valid ? "" : "disabled"}>${gameIcon("stage")}<span><strong>关卡挑战</strong><small>跨越试炼</small></span></button>
                <button id="home-pvp-create" ${validation.valid ? "" : "disabled"}>${gameIcon("room")}<span><strong>创建房间</strong><small>好友对战</small></span></button>
                <button id="home-pvp-join">${gameIcon("play")}<span><strong>加入房间</strong><small>输入房号</small></span></button>
                <button class="lobby-deck" data-jump="decks"><span><small>出战卡组</small><strong>${escapeHtml(deck?.name || "尚未选择")}</strong></span><em>${deck?.main?.length || 0} 张 · ${validation.valid ? "就绪" : "调整"} →</em></button>
            </div>
            ${validation.valid ? "" : `<p class="lobby-invalid">${escapeHtml(validation.errors[0])}</p>`}
        </div>
        <button class="lobby-banner" data-jump="shop"><span class="lobby-banner-art" aria-hidden="true">${cardArtHtml(hydrateCardArt(getCardById("water_012") || heroCard), "", true)}</span><span><small>常驻招募</small><strong>世界回响</strong><em>十连必得 SR 或以上</em></span><b>›</b></button>
        <div class="lobby-collection-count"><strong>${owned}</strong><span>已收集角色与卡牌</span></div>
    </section>`;
```

- [ ] **步骤 2：替换 Lobby CSS 段落**

要点（完整写入 `game-shell.css`）：
- `.lobby-scenery`：`sakura-academy.webp` + 三层渐变蒙层（底部深、右侧深、顶部轻），`filter:saturate(.8) brightness(.72)`；
- `.lobby-character`：右 60% 区域、底部对齐、`mask-image` 柔边、`filter:drop-shadow(0 0 60px #8b6cf066)`；
- `.lobby-actions`：右下角纵向栈（宽度 `clamp(260px,24vw,360px)`），玻璃面板；
- `.lobby-battle`：大徽章按钮——`border-radius:20px 20px 20px 6px`、紫渐变、内描边亮线、外发光 `.live-glow` 呼吸动画；
- `.lobby-sub`：2×2 玻璃胶囊小按钮（`grid-template-columns:1fr 1fr`），卡组按钮横跨两列；
- `.lobby-banner`：左下角 `20px` 圆角玻璃卡，保留原点击跳转；
- `.lobby-particles i`：6 个 `@keyframes floatDust` 缓慢上浮光点。

- [ ] **步骤 3：运行回归检查**

运行：`npm test`，然后 `node scripts/game-shell-qa.mjs "C:\Users\ADMINI~1\AppData\Local\Temp\opencode\ui-redesign-t4"`
预期：385 通过；QA 中 `home-desktop`、`home-mobile`、`home-landscape` 截图正常，`landscape` 输出的 `#home-start-duel` 矩形仍在视口内（`right<=844`）。

---

### 任务 5：登录页深色化

**文件：**
- 修改：`index.html:12-48`（加类名，结构微调）
- 修改：`css/game-shell.css`：`#auth-screen` 段落（原 78–89 行替换）

- [ ] **步骤 1：给登录结构补类名**（`.auth-ignition-copy`/`.auth-panel` 保留），加入品牌渐变字标与底部装饰线；表单 id 与 `data-auth-mode` 不动。

- [ ] **步骤 2：重写登录 CSS**

要点：全屏 `sakura-academy.webp` + 深蓝蒙层；左侧标语白色大字（SimSun 字标 + 阴影）；右侧 `.auth-panel` 为 `--panel-strong` 玻璃卡（`border-radius:24px`、`box-shadow:var(--shadow)`、顶边 1px 亮线）；`.auth-tabs` 变暗色分段控件；`.auth-submit` 紫渐变发光。

- [ ] **步骤 3：运行检查**

运行：`npm test`；QA 截图确认 `login-desktop.png` 为深色卡片、表单未溢出。

---

### 任务 6：招募页（renderShop）

**文件：**
- 修改：`js/app.js`：`renderShop`（286–315 行）
- 修改：`css/game-shell.css`：shop 段落（原 53–61 行替换）

- [ ] **步骤 1：模板换结构**：`section.screen-heading` → `header.shop-hero`（eyebrow/h1/p 保留文字）；`.featured-pack` 内左右两栏 class 不变（`featured-pack-image`/`featured-pack-content`）；概率列表 `.probability-list` 保留 `[data-open-count]` 按钮与数字 id 全不动。
- [ ] **步骤 2：CSS**：`[data-page="shop"] .screen-root` 背景 = `aurora-palace.webp` 深蒙层 + 极光紫光晕；卡池大图 `box-shadow:0 0 80px #8b6cf044` 发光描边；`.pack-buy.featured` 金紫渐变 + 呼吸光。
- [ ] **步骤 3：运行 QA 确认开包流程截图（`purchase-desktop`）与 385 测试通过。**

---

### 任务 7：图鉴页（renderCollection）

**文件：**
- 修改：`js/app.js`：`renderCollection`（540–684 行，仅模板结构/类名层）
- 修改：`css/game-shell.css`：collection 段落（原 63–67 行替换）

- [ ] **步骤 1：保留 `#collection-search`、`.collection-grid`、`.catalog-card`、`.collection-detail` 与所有筛选 id；把外层换成 `.collection-layout` 新视觉层级（不改 JS 事件绑定选择器）。
- [ ] **步骤 2：CSS**：`abyssal-temple.webp` 深青蒙层；筛选条 `.filter-bar` 玻璃胶囊；卡片墙背景加 `populate` 网格微光；详情面板 `radius 20px` 展示柜样式（顶图渐隐、属性徽章发光）。
- [ ] **步骤 3：QA 截图 `collection-desktop/mobile` + `npm test` 通过。**

---

### 任务 8：编成页（renderDeckEditor）

**文件：**
- 修改：`js/app.js`：`renderDeckEditor`（685–966 行）
- 修改：`css/game-shell.css`：decks 段落（原 68–70 行替换）

- [ ] **步骤 1：保留 `#save-deck`、`#deck-name-input`、`[data-source-level]`、`.deck-list-item`、`.deck-count-control` 等全部钩子，仅重排容器类名。
- [ ] **步骤 2：CSS**：`gothic-castle.webp` 深蒙层 + 苔绿描边；来源/工作区双玻璃面板；卡位槽 hover 发光；保存按钮紫渐变。
- [ ] **步骤 3：QA 断言 `deckControls true` + 截图 + `npm test` 通过。**

---

### 任务 9：手册与设置（renderRules / renderSettings）

**文件：**
- 修改：`js/app.js`：`renderRules`（967–1000 行）、`renderSettings`（1001–1048 行）
- 修改：`css/game-shell.css`：rules/settings 段落（原 71–76 行替换）

- [ ] **步骤 1：保留 `[data-manual-target]`、`#rule-08`、`#setting-sound`、`#save-settings` 与所有 `setting-row` 结构；仅包一层新容器类。
- [ ] **步骤 2：CSS**：rules = `moon-shrine.webp` 月白蒙层 + 深色书页；settings = `spirit-forest.webp` 灰蓝蒙层 + 玻璃面板 + 发光开关（保留 `input[type=checkbox]` 自绘）。
- [ ] **步骤 3：QA 断言 `manual true`、`settings true` + 截图 + `npm test` 通过。**

---

### 任务 10：模态/浮层/响应式/动效收尾与全量验证

**文件：**
- 修改：`css/game-shell.css`（追加：modal/toast/detail/gameover/pack 浮层深色覆盖、媒体查询、reduce-motion）

- [ ] **步骤 1：浮层深色覆盖**：`body:has(.game-shell:not(.is-hidden)) .modal-panel/.stage-modal/.stage-card/.toast`、`#detail-overlay .detail-panel`、`#gameover-overlay .gameover-panel`、`.pv-modal-frame` 统一玻璃暗色 + 亮边。
- [ ] **步骤 2：响应式**：`@media(max-width:1000px)` 功能键列横排到导航上方；`@media(max-width:759px)` 压缩顶栏/徽章；`@media(max-width:759px)` 与 `@media(max-height:520px) and (orientation:landscape)` 下 lobby 布局改为"角色居中、按钮拾起"。
- [ ] **步骤 3：reduce-motion**：保留并扩展 `prefers-reduced-motion` 与 `body.reduce-motion` 的 `animation:none!important` 块（覆盖新加的呼吸/粒子动效）。
- [ ] **步骤 4：全量验证**

运行：`npm run check; if ($?) { npm test }`
预期：385/385 通过。

运行：`node scripts/game-shell-qa.mjs "C:\Users\ADMINI~1\AppData\Local\Temp\opencode\ui-redesign-final"`
预期：6 页桌面 + 6 页移动 + 横屏截图全部生成；输出中 `overflow:false`、`nav:true`、`broken:0`、`runtimeErrors []`。

- [ ] **步骤 5：人工走查清单**（对照截图逐项勾选）
  - 登录页深色玻璃卡、无浅色残留；
  - 首页：全屏插画 + 顶部资源条 + 右侧功能键列 + 底部 4 格导航 + 右下大"开始决斗"徽章；
  - 招募/图鉴/编成/手册/设置 5 页各有独立场景底图与主色；
  - 决斗界面与改造前一致（`style.css` 未动，抽一张 battle 截图比对）；
  - 移动端与横屏无溢出、按钮不遮挡。

---

## 风险与回滚

- 视觉改动集中在 `game-shell.css` 单文件：如出现严重观感问题，回滚该文件即可恢复旧皮肤（`app.js`/`index.html` 的结构改动向后兼容旧类名）。
- `app.js` 仅改渲染模板，不改状态与事件契约；任何页面渲染异常都能由 385 条测试与 QA `runtimeErrors` 立刻暴露。
