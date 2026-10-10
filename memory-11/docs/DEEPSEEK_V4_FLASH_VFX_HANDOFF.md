# DeepSeek V4 Flash Harness：全角色卡牌独立特效续作任务

你正在维护项目 `D:\Sekai_two\memory-11`。请直接修改代码和资源并持续执行，直到所有**角色怪兽卡**都完成独立的登场、攻击、被破坏动画；不要只输出方案，也不要中途要求确认。

## 已确认的产品标准

这是上线版本。效果必须符合卡牌封面、角色身份、卡名、招式和稀有度，视觉应接近高质量动漫战斗演出。每张卡至少有：

1. 登场动画：从卡牌位置发生，表现角色或能力的标志性视觉语言。
2. 攻击动画：动作方向从攻击方指向目标，主要冲击准确落在目标周围。
3. 被破坏动画：从被破坏卡的位置内收、碎裂或消散，不能误飞向攻击者。
4. 同角色的不同卡保持统一视觉语言，但依据具体卡名、招式和稀有度改变构图、颜色、节奏、规模和收束，不能只换标题。
5. 特效不得遮住卡面主体。主要环形/弧形效果应围绕卡牌或目标，中心保留透明区域。
6. 禁止廉价圆点粒子、简单几何占位、整屏色块、全屏乱飞火花、纯 CSS 发光冒充角色技能。
7. 桌面与手机使用不同合理尺寸，手机不溢出屏幕，桌面能清楚看到对方出牌和命中对象。
8. 动画应清楚表现起势、推进/命中、收束三个阶段；卡牌移动与特效方向一致。
9. 尊重原著视觉特征，但必须使用本项目原创游戏化演绎，不复制或下载影视片段、他人视频素材或受版权保护的逐帧画面。

## 已完成且不得降级的卡牌

### 2026-10-04 最新续作进度

以下 ID 已完成独立三阶段时间线并具有明确的角色素材映射，Harness 必须从它们之外继续，不要重新生成或覆盖：

```text
picture_ex_011-014
picture_ex_019-070（其中非怪兽/不存在的编号以 cards.json 为准）
picture_ex_072-080
picture_ssr7_034
```

具体映射以 `authored-card-scenes.js` 中的 `VFX_GROUPS`、`VFX_SHEETS` 和 `AUTHORED_CARD_SCENES` 为最终事实来源。当前已经覆盖鬼灭角色全批次、火影首批、菜月昴、朝比奈真冬，以及 JOJO 的承太郎、吉良吉影、迪亚哥、米斯达。下一优先起点是 `picture_ex_015` 至 `picture_ex_018`，随后从 `picture_ex_081` 向后自动盘点所有未完成怪兽卡。

以下卡牌已有用户认可的透明逐帧特效与独立场景：

- `picture_ex_019` 灶门炭治郎·火之神神乐
- `picture_ex_060` 炭治郎·水火轮转
- `picture_ssr7_034` 炭治郎·水之呼吸
- `picture_ex_027` 灶门祢豆子·爆血
- `picture_ex_021` 我妻善逸·霹雳一闪
- `picture_ex_029` 嘴平伊之助·兽之呼吸
- `picture_ex_025` 富冈义勇·水之呼吸
- `picture_ex_030` 炼狱杏寿郎·炎之呼吸
- `picture_ex_024` 蝴蝶忍·蝶之舞

现有逐帧资源位于：

`SekaiGame/src/main/resources/static/images/vfx/`

包括 `hinokami-kagura-sheet-v1.png`、`nezuko-exploding-blood-sheet-v1.png`、`zenitsu-thunder-sheet-v1.png`、`inosuke-beast-sheet-v1.png`、`giyu-water-sheet-v1.png`、`rengoku-flame-tiger-sheet-v1.png`、`shinobu-insect-sheet-v1.png`。

该目录现在还包含风、霞、恋、音、岩、蛇、罗针、冰莲、月虹、日轮、白眼、鼬、佩恩、水遁、佐助、卡卡西、纲手、死亡回归、雨夜狙击、白金之星、杀手皇后、THE WORLD、米斯达等已生成资源；请直接扫描目录并读取代码映射，不要依赖本段的简写列表判断是否完成。

不要覆盖这些资源；可复用同角色的基础素材，但不同卡必须有不同时间线、帧段、变换、标题和招式构图。SSR/UR 或终极形态应使用独立资源或明显升级的组合动画。

## 首先自动盘点剩余范围

卡牌数据源：

- `SekaiGame/src/main/resources/cards.json`
- `SekaiGame/src/main/resources/full-card-pool.json`
- `SekaiGame/src/main/resources/card-data/*.json`

以 `cards.json` 中 `type === "monster"` 且 `enabled !== false` 的卡为角色卡全集，以卡牌 `id` 去重。读取 `AUTHORED_CARD_SCENES`，若某张怪兽卡缺少 `summon`、`attack` 或 `destroy` 任一阶段，就视为未完成。生成并维护 `docs/VFX_COMPLETION_MATRIX.md`，每行包含：ID、卡名、稀有度、角色/作品、登场、攻击、破坏、素材文件、原著依据、验证状态。

不要假定“356”是怪兽卡数量；以数据实际结果为准，但最终必须覆盖当前可玩的全部角色怪兽卡。魔法和陷阱不是本任务主体，不要删除或破坏它们已有的发动动画。

## 制作方法

主要实现文件：

- `SekaiGame/src/main/resources/static/js/authored-card-scenes.js`
- `SekaiGame/src/main/resources/static/js/card-performance.js`
- `SekaiGame/src/main/resources/static/js/card-performance-fx.js`
- `SekaiGame/src/main/resources/static/js/effects.js`
- `SekaiGame/src/main/resources/static/tanjiro-preview.html`（可改名或扩展成通用验收页）

优先使用透明 RGBA 4×4、16 帧 sprite sheet，每格严格等宽等高，播放顺序从左到右、从上到下。空白区域必须是真透明，不允许把棋盘格、黑底或彩色底烘进图片。素材尺寸建议 1536×1024 或等比例网格；透明像素应占足够比例，四角 alpha 接近 0。

若当前 Harness 没有图像生成能力，使用 Canvas/WebGL/SVG 绘制高质量连续动画，但仍须满足：非简单几何、中心透明、方向正确、角色辨识明显。不要伪造已经生成 sprite sheet；在完成矩阵里如实标明 `procedural`。

每个角色先定义稳定的视觉语法，再为各卡派生招式：

- 炎：有刀路与火舌层次，不能是普通圆形火圈。
- 水：浮世绘浪峰、水龙、涟漪或静水，不能是蓝色圆环。
- 雷：低姿蓄力、单次高速贯穿、分叉电弧，不能满屏随机闪电。
- 虫/毒：细针突刺、蝶翼轨迹、紫藤毒纹，禁止大量散落蝴蝶遮卡。
- 风：锐利旋风刀轨与断层，不是半透明绿色圈。
- 岩：锁链、阔斧、碎岩重量感，避免普通落石粒子。
- 音：双刀、火药爆裂、谱面节拍要按时间组织。
- 恋：软剑长弧、粉绿轨迹、弹性回旋。
- 霞：多层残像、低饱和雾幕、错位斩线，但卡牌主体保持可辨。
- 月/日：新月刃阵或日轮刀路，终极形态需要更高层级镜头。
- 其他作品角色：从卡名、封面和角色设定提取独有符号，禁止套用上述鬼灭模板。

稀有度控制：N/R 动画约 500–750ms、单一主动作；SR 约 700–1050ms、两层组合；SSR/UR 约 900–1400ms，可增加一次镜头强调和第二段命中。无论稀有度，都不能盖住卡图或拖慢回合操作。

## 必须修正的通用实现限制

当前 `spriteFire()` 只按少量精确 ID 选择素材，未命中时会错误回退成炭治郎火焰。重构为明确的 `cardId -> VFX profile` 映射：未制作完成的卡使用已有通用系统，禁止默认显示炭治郎火焰。映射至少包含素材、色彩、帧区间、遮罩、尺寸倍率、旋转策略和三个阶段的时间。

攻击时坐标以目标卡中心为基准；登场和破坏以自身卡中心为基准。依据真实卡牌 DOM 尺寸计算特效，不要只用两点距离猜卡宽。移动中的角色卡残影不得重复显示成三张卡，攻击回位后状态必须清理。

所有动画节点须由现有 motion scope/animation owner 管理，回合取消、切页、快速连点、减少动态效果模式都能清理，不得残留 DOM、定时器或 requestAnimationFrame。

## 分批执行方式

按角色分批，每批 8–12 张卡：

1. 从矩阵选择同一作品或相关角色。
2. 读取卡名、描述、封面、稀有度和已有技能逻辑。
3. 为每张卡写三阶段 storyboard，再实现动画。
4. 更新明确的 ID 映射和缓存版本链。
5. 在桌面 1365×768 与手机 390×844 下逐卡截取登场、攻击、破坏中间帧。
6. 自动检查命中中心误差、屏幕溢出、卡面遮挡比例、透明通道、控制台错误、动画节点清理。
7. 验证通过后更新矩阵，再进入下一批，不要等待人工确认。

## 缓存版本链

修改特效后必须同步递增这些 import 查询版本，保证正式决斗加载新模块：

- `index.html -> main.js`
- `main.js -> app.js / ui.js / controller.js`
- `app.js -> card-performance.js / card-performance-fx.js`
- `controller.js / ui.js -> effects.js`
- `effects.js -> card-performance.js / card-performance-fx.js / authored-card-scenes.js`
- `card-performance.js / card-performance-fx.js -> authored-card-scenes.js`

不要只更新预览页。

## 验收与完成条件

每批至少运行：

```powershell
cd D:\Sekai_two\memory-11\SekaiGame\src\main\resources\static
node --check js/authored-card-scenes.js
node --test test/authored-card-scenes.test.js
cd D:\Sekai_two\memory-11
node .tools/rules-qa/tanjiro-cinematics.mjs
```

然后运行项目完整前端测试。若测试失败，先判断是否由本批改动引起；由本批引起的必须修复，不得只记录失败。

最终完成必须同时满足：

- 所有启用的怪兽卡都有 `summon`、`attack`、`destroy` 三阶段。
- 每张卡的 ID 映射明确，不存在误回退为炭治郎或其他角色特效。
- 所有新增图片有有效 alpha，四角透明，无背景矩形。
- 桌面和手机逐卡自动验收无控制台错误、无溢出、目标落点正确、卡面主体可见。
- 正式决斗入口已更新缓存版本并实际加载最新特效。
- `docs/VFX_COMPLETION_MATRIX.md` 中没有未完成项。
- 最终报告列出完成数量、资源数量、测试结果和仍存在的真实限制，不得把占位效果统计为完成。

保持改动聚焦于角色卡动画，不要顺便重构战斗规则、数值、页面主题或无关模块。
