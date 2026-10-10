# Our Notes 风格沉浸式游戏化 UI 改造 — 设计规格

日期：2026-09-27
状态：已获用户批准（视觉方向：沉浸式深色游戏 UI；首页：完全对齐 Our Notes 布局）

## 背景与目标

当前前端是一个浅色纸感、低对比度的"网页式"大厅：卡片堆叠、宋体标题、白底面板、底部导航像网页标签页，整体观感偏"工具站"而不是游戏。

对标参考《BanG Dream! Our Notes》（交织的乐章）实机界面，改造目标：

1. 整个前端（登录、首页、招募、图鉴、编成、手册、设置）统一为**沉浸式深色游戏 UI**，打开即游戏。
2. 首页完全对齐 Our Notes 结构：全屏插画 + 顶部悬浮资源条 + 右侧竖排圆形功能键 + 底部悬浮导航 + 右下大徽章式主按钮。
3. 每个子页面拥有各自的场景底图与主色，形成"每个页面都有特色"的辨识度。
4. 与现有暗色决斗界面（`style.css` 战斗部分）视觉连贯。

## 非目标（明确不做）

- 不改动决斗界面（battle-screen）样式与逻辑。
- 不改动任何游戏逻辑、数据模型、接口、存档格式。
- 不新增内购/充值类功能；资源胶囊不放"+"号。
- 不改 `css/style.css`（385 个测试中的 `responsive-layout.test.js` 直接断言其中内容）。

## 设计语言（Design Tokens）

```
--bg-0:#05070f; --bg-1:#090d1c; --bg-2:#0d1226;
--panel:rgba(13,17,33,.82); --panel-strong:rgba(19,24,45,.94); --glass:rgba(255,255,255,.06);
--line:rgba(140,160,220,.22); --line-strong:rgba(160,180,255,.42);
--text:#eef1ff; --text-2:#a9b2d6; --text-3:#6f7899;
--accent:#8b6cf0;   /* 夜曲紫：主交互色 */
--accent-2:#45d6e8; /* 霓虹青：经验条/高亮 */
--gold:#e9c46a;     /* 次元币 */
--danger:#ff5d7e; --success:#43d6a5;
--shadow:0 18px 50px rgba(0,0,0,.55);
```

- 组件：深色磨砂玻璃（backdrop-filter blur + 半透明面板 + 1px 亮边），圆角胶囊（999px）与圆角方（14–18px）。
- 字体：正文 `"Segoe UI","Microsoft YaHei",sans-serif`；大标题用黑体粗体（字距 `.08em`）；"次元决斗"字标保留 SimSun 衬线作为品牌延续。
- 光效：主按钮内发光 + 外光晕；资源/卡牌 hover 时描边发光；页面切换淡入上移。
- 背景：页面级场景图（已有 `assets/duel-scenes/*.webp`）+ 深色渐变蒙层 + 暗角，页面各自不同。

## App Shell（index.html 结构）

```
body
└─ #app-shell.game-shell[data-page]
   ├─ topbar（悬浮玻璃条）
   │  ├─ #game-back（返回）+ #game-page-name
   │  ├─ .rank-chip：RANK 徽章 + #profile-level + 经验条（收集进度，真实数据）
   │  ├─ #coin-count / #shard-count 资源胶囊（样式重做，无+号）
   │  └─ .profile-chip（→设置，保留 id：#profile-name #profile-level）
   ├─ .hud-rail（右侧竖排圆形功能键，静态 HTML 内联 SVG）
   │  ├─ 每日首胜（状态点，红点=未达成）
   │  ├─ 游戏影像（PV）
   │  ├─ 新手教学
   │  ├─ 决斗手册（data-route=rules）
   │  └─ 游戏设置（data-route=settings）
   ├─ aside.sidebar（底部悬浮导航，仅 4 项）
   │  └─ 首页 / 卡片招募(shop) / 角色图鉴(collection) / 卡组编成(decks)
   └─ #screen-root
```

- `app.js` 中 `bindGlobalEvents` 的 `.sidebar [data-route]` 图标注入逻辑保留；`.hud-rail` 的 `data-route` 按钮走通用点击绑定，图标直接写在 HTML。
- 原首页 `lobby-shortcuts` 里的新手教学/游戏影像入口迁移至 `.hud-rail`；`#home-tutorial`、`#home-pv` 的存在性与绑定改为在 `bindGlobalEvents` 一次性完成（可空守卫）。
- `renderTopbar()` 增加：经验条宽度 = 图鉴收集进度（已拥有卡数 / 全卡数，真实数据）；每日首胜状态点。
- 目标 1000px 以下：`.hud-rail` 变为底部导航上方横向小圆键；760px 以下进一步压缩，不遮挡内容。

## 首页（renderHome 重写）

```
.lobby（全屏，overflow hidden）
├─ .lobby-bg      场景图（默认 sakura-academy 夜色处理）+渐变+暗角
├─ .lobby-particles  CSS 粒子（少量 span，无 JS）
├─ .lobby-hero    出战卡组封面/默认卡立绘（沿用 cardArtHtml + heroCard 逻辑）
├─ .lobby-wordmark  SEKAI/ELEMENTAL DUEL + 次元决斗/元素召唤（左上）
├─ .lobby-hero-name 与你并肩 + 角色名 + 台词（左下）
├─ .lobby-actions（右下）
│  ├─ #home-start-duel  .lobby-live 大徽章按钮（START DUEL / 开始决斗 / 与 AI 对战）
│  └─ .lobby-sub 横排次级入口：#home-stage-duel 关卡挑战 / #home-pvp-create 创建房间 /
│     #home-pvp-join 加入房间 / 卡组(data-jump="decks"，显示当前卡组名与合法性)
├─ .lobby-banner（左下，常驻招募小横幅 data-jump="shop"，保留）
├─ .lobby-invalid（卡组非法时的提示条）
└─ .lobby-collection-count（收集数）
```

- 所有既有 id 保留（`#home-start-duel`、`#home-stage-duel`、`#home-pvp-create`、`#home-pvp-join`），QA 脚本可继续点击。
- 禁用态沿用 `validation.valid` 逻辑，样式改为"暗置+锁标"。

## 子页面特色

| 页面 | 场景底图 | 主色/氛围 | 结构调整要点 |
|---|---|---|---|
| 登录 | sakura-academy | 深色玻璃登录卡、黄昏蒙层 | 保留表单 id 与标签结构，仅换皮与布局 |
| 首页 | sakura-academy（夜色） | 紫/青 | 见上节 |
| 招募 shop | aurora-palace | 金 + 紫、发光抽取按钮 | 卡池大图加霓虹描边；概率/保底做成徽章条；按钮加光晕 |
| 图鉴 collection | abyssal-temple | 青蓝画廊 | 筛选玻璃条、卡片墙深色底、右侧详情"展示柜" |
| 编成 decks | gothic-castle | 苔绿+紫 | 双栏工作台，卡位槽发光边框；保留 #save-deck 等全部 id |
| 手册 rules | moon-shrine | 月白 | 左目录右章节，深色书页卡；保留 data-manual-target 与 #rule-08 |
| 设置 settings | spirit-forest | 灰蓝 | 深色面板 + 发光开关；保留 #setting-sound、#save-settings |

所有列表/卡牌/进度组件继续复用现有 class 语义（`catalog-card`、`deck-list-item` 等），只做视觉层重写。

## 动效

- 页面进入：`fade + translateY(12px)` 400ms。
- 按钮 hover：光晕增强 + 轻微上浮；active 回弹。
- 卡片 hover：上浮 + 描边发光（图鉴/编成）。
- 全部动效在 `prefers-reduced-motion` 或 `body.reduce-motion` 下禁用；沿用现有 reduce-motion 规则块。

## 兼容约束

1. `index.html` 必须保留 `<link rel="stylesheet" href="css/style.css?v=2.3.0-echo">` 原文，否则 `responsive-layout.test.js` 失败。
2. `css/style.css` 不修改；战斗界面不动。
3. 所有被测试/QA 脚本引用的 id 与 data 属性保持不变：`#screen-root`、`#app-shell`、`#coin-count`、`#shard-count`、`#profile-name`、`#profile-level`、`#game-back`、`#game-page-name`、`#home-start-duel`、`#home-stage-duel`、`#collection-search`、`#save-deck`、`#deck-name-input`、`#setting-sound`、`#save-settings`、`[data-manual-target]`、`#rule-08`、`[data-open-count]`、`#confirm-pack-open`、`#modal-root`、`#toast-root` 等。
4. `renderTopbar()` 等被单测以 stub 方式调用的方法签名不变。
5. 现有 385 条测试全部保持通过；`npm run check` 通过。

## 变更文件

- `src/main/resources/static/index.html` — Shell 与登录页结构重排。
- `src/main/resources/static/css/game-shell.css` — 全量重写为深色沉浸式（含移动端/横屏/低高度媒体查询与 reduce-motion）。
- `src/main/resources/static/js/app.js` — `renderTopbar` / `renderHome` / `renderShop` / `renderCollection` / `renderDeckEditor` / `renderRules` / `renderSettings` 的模板重排；`bindGlobalEvents` 增加 hud-rail 绑定；`gameIcon` 增补图标。
- `docs/superpowers/specs/2026-09-27-ournotes-ui-redesign-design.md`（本文件）；实现计划另见 plans/。

## 续作：主页"选择放映"（2026-09-27 追加）

- 首页字标下方新增"选择放映"胶囊按钮（`#home-change-art`），打开放映选择弹窗。
- 弹窗（`.lobby-picker`）以网格列出账户中**已拥有**的卡牌（稀有度降序），支持**多选**（角标显示轮播顺序），另有"默认放映"（跟随出战卡组封面）、"随机一张"、"清空"与"确认放映"。
- 选择写入 `collection.settings.lobbyCardIds`（数组，兼容旧的单张 `lobbyCardId`，`migrateSave` 自动迁移），仅本机保存；不再拥有的卡自动剔除。
- 主页轮播：列表 1 张=固定放映；≥2 张每 10 秒交叉淡入切换，主页字标下有圆点指示（可点击手动切换），角色名与"轮播 n/m"同步更新。
- 减少动态效果（设置项或系统 `prefers-reduced-motion`）时停止自动轮播，仅显示第一张。
- `renderHome` 放映优先级：`settings.lobbyCardIds`（须已拥有）→ 出战卡组封面 → 默认卡 `water_009`。

## 续作：主页背景"微风动态化"（2026-09-27 追加）

参照 `breeze-static-to-dynamic-light` 技能规范（本机无 AE/Breeze，不渲染视频，改为运行时实现同等美学）：低幅度、慢速、往复、局部运动 + 独立柔和光效、禁止整图同步闪烁。

- `.lobby-character`：`heroBreeze` 9s 往复摆动（±6px / ±0.4°，支点在底部，幅度低于可察觉变形阈值）。
- `.lobby-sheen`（角色图层内）：`sheenSweep` 13s 移动高光，`mix-blend-mode:screen`，与摆动不同周期，避免同步闪烁。
- `.lobby-breeze`：17s 环境风带呼吸光斑，与摆动轻微错相。
- `.lobby-scenery`：`sceneryDrift` 30s 极缓视差漂移（入场动画后接续）。
- 仅主页；全部动效受"减少动态效果"设置与 `prefers-reduced-motion` 统一禁用（`animation:none`）。
- 选任何已拥有卡牌放映时动效自动生效（作用于展示容器而非具体图片）。

## 续作：放映卡面自适应补全（2026-09-27 追加）

- 问题：368 张卡面中 290 张比背景容器更竖，`object-fit:cover` 会裁掉最多 60% 画面（"显示不全"）。
- 方案：`renderHome` 后由 `applyLobbySlideFit()` 按图片真实宽高比判断——比容器更竖且裁剪超过 12% 的卡面切换为 `object-fit:contain` 完整显示，并用双侧渐隐蒙版（`--art-left/--fade`，按实际绘制宽度计算）柔化边缘；比容器更宽的卡面保持满幅（只裁两侧，观感更自然）。
- 窗口尺寸变化时重新计算；横竖屏/移动端同样生效。

## 执行记录：卡牌效果与角斗场优化（2026-09-27，P0→P2 全部执行）

**P0-1 参数去同质化**：`prepareSignatureParams` 改为按"最终动作"（角色画像改写后）整组发放参数 + 有效值去重微调；47 张空参数清零（仅剩 5 张无参数设计的陷阱）；effect-diversity 测试转绿（主效果唯一 + 整卡说明唯一；支援余响允许共用模板）。
**P0-2 平衡约束生效**：authored 层补回 `duelPowerTier = min(7, rarityRank+floor((lv-1)/3))`；monster-power-curve 改为独立公式校验并新增"主题动作越级"断言；`npm test` 现在串联 static 396 + src/test/js 40 + AI 关卡测试。
**P0-3**：修复净化后出血结算 `themedState.statuses` 空引用崩溃。
**P0-4 关卡配牌**：主题匹配同时读旧式 type 与 themedAction.action；章节限制主题池；3 张越级 N 卡（青眼/黑魔导/圣防）移出关卡池；极限篇改为 SR/SSR/UR。主题协同 43%~73%，章节强度单调递增。
**P1-5 目标选择**：13 组单体主题动作（冻结/睡眠/中毒/爆破/灼烧/剧毒/出血/诅咒/引爆/麻痹/封印/除外/连锁爆破）支持玩家手选目标；AI 保持默认"最高攻"；PvP 增加 targetId 中继；卡面文案同步改为"一只可取对象"。
**P1-6 登场强控代价**：20 张"登场即控制"怪兽新增 400~700LP 代价（按稀有度），引擎在自闭触发路径支付；LP 不足则不发动也不扣血。
**P1-7 稀有度机制**：SSR/UR 怪兽追加一条"支援余响"（寻找/构思/蓄势/守护），稀有度不再只是数值；对应测试放宽为 ≤2 条效果并锁定余响名称集合。
**P1-8 连锁与陷阱**：同一响应窗口可连锁 2 张陷阱；陷阱发动可被对方 `onOpponentEffect` 陷阱连锁（≤3 层防循环）；盖放一回合后可在主要阶段主动翻开（规则 #06 文案已更新）。
**P1-9 AI**：新增主题动作估值表（替代一律 +120）；AI 会汇总手牌/墓地/后场/血量情境估分、为单体效果选靶、主动翻开盖放魔法、把本回合用不出的高价值魔法盖下去。
**P2-11 数据与经济**：member 归类补齐（kanade/mafuyu/ena/mizuki/group，共 87 张），图鉴成员筛选与"共鸣"真正可用；抽卡概率从 N 62% 调整为 N5%/R10%/SR45%/SSR30%/UR10%（与卡池构成对齐），商店概率显示改为动态读取。
**P2-10 清理**：删除无引用的 `starter-n.js`（约 60 卡）、`BASE_RECIPES` 死快照、ygo 数据的 60 条重复 `effectsJson`。

**验证**：`npm run check` 通过；`npm test` = static 396 + src/test/js 40 + AI 关卡测试 全绿；fuzz 120 局 0 异常；self-play 20 局平均 12.1 回合；themed self-play 60 局通过；QA 截图无 JS 报错、无布局回归。

**已知遗留（下一轮建议）**：① self-play-balance 中"大怪取向"胜率仍极低、先手胜率约 58%，属卡组取向与先后手平衡，需要专门的构筑层调整；② 15 个 §7 招牌动作（ignite/domain 等）数值按设计表冻结，不参与稀有度缩放；③ 战斗内"陷阱响应陷阱"仅在非战斗响应链实现，攻击响应仍按原 2 张上限设计。

## 验证方式

1. `npm run check`（语法）与 `npm test`（385 条全部通过）。
2. `node scripts/game-shell-qa.mjs <dir>` 生成 6 页桌面/移动/横屏截图与断言语义输出（overflow、broken、nav 可见性），人工逐页检查。
3. 本地 `npm start`（8080）实际打开走一遍：登录 → 首页 → 招募开包 → 图鉴 → 编成保存 → 手册 → 设置保存。
4. 与改造前截图对比，确认"网页感"消除、各页辨识度成立、决斗界面未受影响。
