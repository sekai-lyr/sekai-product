# 卡牌攻击过程特效系统设计（attack-fx）

> 日期：2026-09-29
> 状态：视觉方向已确认（以炭治郎·火刀斩试验台 v2 为基准）
> 范围：只做「角色（怪兽）卡牌的攻击过程」演出；不改布局、不改规则。

## 1. 背景与目标

- 现状：`effects.js` 的 `playAttackAnimation` 是通用演出（卡牌飞冲 + 属性色拖尾 + 通用命中特效），所有角色几乎同一种表现。
- 目标：每张怪兽卡的攻击过程都有符合自身角色/属性的演出；形态标准以试验台 v2 炭治郎火刀为基准——
  多层形状（不是一条渐变线）、火焰舌状边缘（湍流描边）、命中反馈同帧结算。
- 覆盖：218 张怪兽卡全量覆盖；知名角色手工特调，其余按风格/属性/效果原型生成。

## 2. 边界（硬约束）

- 只改特效层：
  - 允许：`js/attack-fx*.js`（新增）、`effects.js`（只替换攻击演出的实现）、新增预览/测试页、测试文件。
  - 禁止：`index.html` 布局、`style.css` 布局坐标、`engine.js`/`controller.js` 规则与流程、卡牌数据。
- 分期：Web 先行；Godot 复用同一份 profiles 数据（后续期）。
- 当前不做：登场/召唤特效、魔法发动、陷阱发动（后续另立设计）。

## 3. 视觉语言（已确认）

- 形状生成器 + 参数化，每族形状由参数派生：
  - `blade`：由三点（起/止/曲率）+ 宽度曲线 + 舌状波动生成多层刀身；外焰（深橙）+ 中层（橙金）+ 内芯（白热）。
  - `bolt`：分叉折线雷（主雷 + 细分支），白芯/黄光/外辉三层。
  - `orb`：旋转火焰瓣 + 白芯，用于火球类弹道。
  - `crystal`：带切面的棱柱晶体（亮面/暗面/棱线），用于冰类。
  - `sphere/beam`：红蓝双环旋转 + 环绕光点 + 推进环光束，用于虚式/领域类。
  - `wave`：音波环 / 光环，用于音乐、光系。
  - `rush`：冲撞 + 冲击波 + 烟尘，用于体术/兽系。
- 滤镜：`feTurbulence + feDisplacementMap` 让边缘产生火焰舌状撕扯；强度按族参数。
- 命中：目标卡白闪 + 抖动 + 局部粒子 + 伤害数字；近战冲过去、命中后回合归位；远程站桩。
- 节奏：单招 1.5～2.2s；连续攻击自动进入 lightweight 简化（沿用现有 `attackVisualBusyUntil` 的降载思路）。
- 招式名以小标签形式挂在攻击者上方（可配置关闭）。

## 4. 架构

```
js/attack-fx-profiles.js   纯数据/映射（可跨端复用，无 DOM 依赖）
    ARCHETYPES        形状族定义：kind、层数、曲率范围、调色板、时长、命中附加效果
    STYLE_MAP         monster-cinematics style → 族 + 调色板
    ATTRIBUTE_FALLBACK 属性 → 族（最后兜底 arcane）
    OVERRIDES         卡 id / 名称正则 → {族, 参数覆盖, 招式名}（知名角色手工特调）

js/attack-fx.js            运行时（DOM/WAAPI/SVG）
    getAttackProfile(card)                → {archetype, palette, params, label, weight}
    playCardAttack(ctx)                   → Promise（近战/远程/术式分支）
    形状生成器 / 粒子 / 命中数字 / 清理

effects.js                 只改 playAttackAnimation 内部：调用 playCardAttack，
                           保留原函数签名与 Promise 返回；无 profile 时回退旧演出。

test/attack-fx-preview.html  预览/QA 页（开发用，可逐族回放、切换代表卡）
test/attack-fx.test.js       覆盖与参数合法性测试（Node）
```

## 5. 映射规则（确定性）

1. `OVERRIDES` 命中（按卡 id 优先、其次名称正则）；
2. `monster-cinematics` 的 `style` → `STYLE_MAP`；
3. 卡牌 `attribute` → `ATTRIBUTE_FALLBACK`；
4. 兜底 `arcane`。

示例（首批覆盖，参数可继续加）：

| 匹配 | 族 | 备注 |
| --- | --- | --- |
| 炭治郎 / 日之呼吸 / 缘壹 | fire-blade | 炭治郎基准；缘一为加大版 |
| 富冈义勇 / 水之呼吸 | water-arc | 水弧 + 水花 |
| 善逸 | thunder-dash | 瞬移 + 分叉雷 |
| 炼狱 / 炎柱 | flame-burst | 火焰爆燃斩 |
| 蝴蝶忍 | poison-butterfly | 蝶群 + 毒雾 |
| 五条悟·虚式茈 | void-beam | 红蓝球 + 光束 |
| 宿傩 / 伏魔御厨子 | domain-slash | 交错斩线领域 |
| 史尔特尔 / 熔核 | flame-tiger | 熔火爪 |
| 雪乃 / 冰 | ice-shard | 切面冰晶 |
| 能天使 / 铳火 | bullet | 弹幕弹道 |
| 初音 / 乐队系 | music-wave | 音波环 + 音符 |
| 其余按属性 | arcane / 属性族 | 通用能量斩或弹 |

## 6. 性能与降级

- 同屏大特效上限 2 层（沿用 `MAX_CONCURRENT_HIT_IMPACTS` 思路）；超出时自动 lightweight：
  简化形状层数、减少粒子、缩短时长。
- 尊重 `prefers-reduced-motion`：只保留白闪与伤害数字。
- 所有临时节点动画结束即移除；滤镜作用域限定在 fx 容器，不作用于全局。

## 7. 验收标准

1. 覆盖率：218/218 怪兽卡可解析出合法 profile（Node 测试）。
2. 参数合法性：各族的层数/宽度/时长在定义范围内（Node 测试）。
3. 预览页：每族可回放，代表角色形态通过人工确认。
4. 实机：在真实战斗流程中触发攻击演出（Playwright 截图验证 ≥ 6 个代表角色）。
5. 回归：`npm run check` 通过；现有测试不因本次改动新增失败。
6. 边界：diff 仅包含特效层文件、预览页、测试；不含布局与规则文件。

## 8. 后续（不在本期）

- 登场/召唤特效；魔法发动；陷阱发动。
- Godot 端消费同一份 `attack-fx-profiles.js` 数据。
- 与 `audio.js` 的招式音效对齐。
