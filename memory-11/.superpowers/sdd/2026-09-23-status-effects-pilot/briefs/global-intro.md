# 30 张试点卡 · 状态异常引擎 + 领域 + 演出 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。
>
> **注意：** 本项目不是 git 仓库（`git status` 报 not a git repository），因此所有"Commit"步骤替换为"检查点"：测试命令必须真实运行并获得预期输出后才能勾选。

**目标：** 为 Web 端 30 张代表卡新增状态异常系统（灼烧/剧毒/出血/诅咒/异界流放/麻痹/引爆/赌运/无下限/领域）与配套动作特效、领域展开演出、合成音效。

**架构：** 新状态逻辑集中在新模块 `js/status-effects.js`；动作定义/结算沿用 `js/themed-effects.js` 的"卡面=结算"三件套（DEFAULTS/TEMPLATES/handlers）；引擎在 `js/engine.js` 的事件点接入钩子；演出在 `js/effects.js`（rule-fx 体系 + 电影级运镜）与 `js/audio.js` 扩展；30 张卡的配方在 `js/authored-card-rules.js` + `js/signature-tuning.js` 声明。

**技术栈：** 原生 ES Modules（无构建步骤）、Node `node --test`、Spring Boot 静态资源打包（jar 重建 + 重启 8091）。

**规格：** `docs/superpowers/specs/2026-09-23-status-effects-pilot-design.md`（所有数值/文本以此为准）。

---

