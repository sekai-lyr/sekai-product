# 任务 1 报告：状态模块 `status-effects.js`

- **状态：DONE**
- **日期：** 2026-09-23
- **工作根目录：** `D:\Sekai_two\memory-16\SekaiGame\src\main\resources\static`

## 改动文件清单

| 操作 | 文件 | 说明 |
| --- | --- | --- |
| 新建 | `js/status-effects.js` | 按简报逐字实现：`AILMENTS`、`DOMAIN_DEFS`、`applyAilment`、`ailmentStacks`、`ailmentValue`、`removeAilment`、`cleanseAilments`、`tickAilments`、`activeDomain`；首行保留 `// js/status-effects.js` 作为文件头注释 |
| 新建 | `test/status-effects.test.js` | 按简报测试代码逐字落盘（2 个用例） |

未改动其他任何文件；未执行任何 git 命令（本项目非 git 仓库）。

## 测试命令与真实输出摘要

### 1. 步骤 2 —— 先验证失败

命令：`node --test test/status-effects.test.js`

真实输出（摘要）：

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
'D:\Sekai_two\memory-16\SekaiGame\src\main\resources\static\js\status-effects.js'
...
✖ failing tests:
✖ test\status-effects.test.js
ℹ tests 1  ℹ pass 0  ℹ fail 1
```

与简报预期一致（`Cannot find module '../js/status-effects.js'`）。

### 2. 步骤 4 —— 验证通过

命令：`node --test test/status-effects.test.js`

真实输出（摘要）：

```
✔ 异常状态按上限叠层并记录数值 (1.2353ms)
✔ 清除与净化移除状态 (0.1437ms)
ℹ tests 2
ℹ pass 2
ℹ fail 0
```

2 个用例全部 PASS，与简报预期一致。

### 3. 检查点 —— 语法检查

命令：`npm run check`

真实输出（摘要）：无任何 `语法错误:` 输出，退出码 `check exit code: 0`（仅 npm 自身的新版本提示）。

## 遗留疑虑

1. `tickAilments` 与 `activeDomain` 已按简报实现，但本任务的 2 个测试用例只覆盖叠层、数值记录、清除与净化；tick/领域逻辑尚未接入引擎，属于后续任务范围，此处无独立测试。
2. `tickAilments` 依赖 `endingPlayer.takeDamage` 与 `engine.emit` 的运行时契约，需在后续接入引擎时由集成测试覆盖（本任务未改动 engine.js，避免越界）。
3. 无其他阻塞项。

---

## 审查修复记录（2026-09-23）

针对审查的 2 条 Important 问题完成修复，仅改动 `js/status-effects.js` 与 `test/status-effects.test.js`，Minors 按指示延后未处理。

### Important 2 修复：清叠层时同步清数值字段

- `removeAilment(card, id)`：删除叠层的同时删除 `AILMENTS[id].valueKey` 对应的数值字段（灼烧衰减到 0 层离场时不再残留旧伤害值）。
- `cleanseAilments(card)`：删除全部状态叠层，并遍历 `AILMENTS` 清空四个数值字段（`burnDamage` / `venomDamage` / `bleedDamage` / `curseDamage`）。
- 两处均先判 `card?.themedState` 是否存在，行为与原有等价路径兼容。

### Important 1 修复：补 tickAilments / activeDomain 测试

新增 3 个用例（含假 player：`takeDamage` 直接减 `lp`；假 engine：`emit` 空函数）：

1. 「灼烧在结束阶段按数值×层数扣LP并逐层衰减」：2 层 500 数值 → 第一次 tick 扣 1000、剩 1 层；第二次 tick 再扣 500（累计 1500）、层数归 0 且 `ailmentValue` 归 0。
2. 「剧毒在结束阶段扣LP且不衰减」：2 层 450 → 连续两次 tick 各扣 900，层数与数值均保持 2 / 450。
3. 「activeDomain 按 until 与 key 过滤」：`until === state.turn` 返回领域（含 `card` 与 `DOMAIN_DEFS` 定义）；`until < turn` 返回 null；`key` 匹配/不匹配分别返回领域 / null。

原 2 个用例同步补充数值断言：`removeAilment` 后 `ailmentValue(c,"venom") === 0`；`cleanseAilments` 后 `ailmentValue(c,"curse") === 0`。

### 修复过程命令与真实输出

#### 1. 先补测试，验证对旧实现的失败（TDD）

命令：`node --test test/status-effects.test.js`

真实输出（摘要）：

```
✔ 异常状态按上限叠层并记录数值 (0.6389ms)
✖ 清除与净化移除状态 (0.6187ms)
✖ 灼烧在结束阶段按数值×层数扣LP并逐层衰减 (0.2495ms)
✔ 剧毒在结束阶段扣LP且不衰减 (0.1149ms)
✔ activeDomain 按 until 与 key 过滤 (0.1395ms)
ℹ tests 5  ℹ pass 3  ℹ fail 2
```

两处失败均为数值字段未清空的断言：`清除与净化移除状态` 中 `450 !== 0`（第 21 行）；`灼烧...` 中 `500 !== 0`（第 45 行）。其余 tick 与领域用例通过，证明新增用例确实捕获了 Important 2 的缺陷。

#### 2. 修复实现后验证

命令：`node --test test/status-effects.test.js`

真实输出（摘要）：

```
✔ 异常状态按上限叠层并记录数值 (0.6462ms)
✔ 清除与净化移除状态 (0.1411ms)
✔ 灼烧在结束阶段按数值×层数扣LP并逐层衰减 (0.1771ms)
✔ 剧毒在结束阶段扣LP且不衰减 (0.1105ms)
✔ activeDomain 按 until 与 key 过滤 (0.1364ms)
ℹ tests 5  ℹ pass 5  ℹ fail 0
```

5/5 全部 PASS。

#### 3. 语法检查

命令：`npm run check`

真实输出（摘要）：无任何 `语法错误:` 输出，退出码 `check exit code: 0`（仅 npm 自身版本提示）。

### 修复后遗留疑虑

- 原疑虑 1 已由本次新增用例消除（tick/领域实现已有直接单测，仍用轻量桩而非真实 GameEngine，符合审查要求）。
- 原疑虑 2 保留：与真实 `GameEngine` / `Player` 的集成契约仍待后续任务接入时验证。
- 无其他阻塞项。
