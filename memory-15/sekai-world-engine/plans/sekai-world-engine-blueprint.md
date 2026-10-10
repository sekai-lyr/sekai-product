# Sekai World Engine 构建蓝图

## 目标与执行模式

本蓝图把 Sekai World Engine 拆成可以独立验证的增量步骤。当前工作区为空且没有 Git 元数据，因此采用 direct mode：所有步骤在 `sekai-world-engine/` 内直接实现，保留每一步的可运行状态，不假设分支或 PR 工作流。

第一阶段的成功定义是：一个用户可以注册、登录、进入唯一的种子城市，查看角色和事件，推进一天，处理一次选择，并从历史节点创建分支；模拟结果由显式规则和随机种子决定，状态变化可追溯到事件日志。

## 产品边界

### 第一阶段包含

- 单体后端、单页前端、MySQL 8 持久化和迁移。
- 一个种子世界：一座城市、5 个地点、3 个组织、12 个原创角色。
- 用户注册、登录、当前用户信息和私有世界隔离。
- 世界概览、地图、角色、关系、事件时间线和分支管理的最小可用界面。
- 确定性模拟：世界日推进、角色日程、规则评估、事件生成、事件效果、状态变化日志。
- 选择事件的条件判断、效果应用、重复操作防护和从历史节点 fork。

### 第一阶段不包含

- 微服务、Kafka、Redis、WebSocket、复杂 AI、多人实时协作、支付、原生移动端。
- 完整 Creator Studio；只保留领域接口和种子导入/导出的扩展位置。
- 复杂经济系统、开放式脚本引擎、几百个实体、真实 IP 数据。
- 生产级 OAuth、细粒度 RBAC、分布式锁和跨区域部署；这些在后续阶段按实际需要演进。

## 核心用户流程

1. 注册或登录，获得短期 Bearer token。
2. 世界选择页列出当前用户可访问的世界；首次用户可以创建种子世界。
3. 世界总览显示世界时间、城市状态、今日事件、待处理选择、最近模拟结果和当前分支。
4. 用户进入地图、地点、角色、关系网络或时间线查看状态和证据。
5. 用户点击“推进一天”；服务在同一事务中校验幂等键、执行角色日程、应用规则、生成事件、记录状态变化并推进时钟。
6. 用户打开待处理事件，选择一个合法选项；服务再次校验条件并记录选择及其效果。
7. 用户从时间线节点创建分支；分支复制该节点以前的快照和必要的事件上下文，之后独立推进。
8. 分支管理页展示当前分支及其父节点，后续阶段再加入差异比较。

## 领域模型

### 聚合与关键不变量

- `World`：世界元数据和所有者；同一用户不能访问不属于自己的私有世界。
- `WorldBranch`：从某个快照开始的独立历史；分支必须属于同一世界，且 fork 节点必须存在。
- `WorldClock`：分支的当前日期、最近一次 tick 的幂等键；同一分支同一幂等键只能成功一次。
- `Actor`：角色身份、属性、当前地点、组织、状态 JSON；行为通过日程和目标驱动。
- `Location` / `Faction`：城市、地点、连接、组织和容量。
- `Relationship`：有向角色关系以及信任、好感、敌意、影响力；每次变化都产生日志。
- `WorldRule` / `EventTemplate`：显式条件和效果，MVP 使用受控 JSON 表达，不执行任意代码。
- `WorldEvent`：发生在分支时间线上的事件；包括状态、来源模板、幂等键和选择状态。
- `WorldSnapshot`：分支节点的可恢复状态；MVP 使用 JSON 快照保证回溯简单，后续可改为事件溯源与快照混合。
- `TimelineEvent` / `StateChange`：不可变审计记录，解释某次变化的原因和前后值。

### 模拟不变量

- 输入为 `branchState + localDate + worldSeed + tickId` 时，输出事件顺序、随机抽样和状态变化稳定。
- 领域服务不依赖当前系统时间、不使用全局静态世界状态、不调用 AI 或网络服务。
- 每个 tick 在事务内写入 `simulation_tick` 唯一记录；失败整体回滚。
- 选择效果只能在事件处于 `PENDING`、条件满足且用户有权访问分支时应用一次。

## 模块边界

```text
identity  -> common/auth, world ownership checks
world     -> actor/location/relationship/simulation/timeline orchestration
actor     -> location/faction references; no controller coupling
location  -> city, location, connection queries
relationship -> actor references and change log
simulation -> world clock, actor schedules, rules, event templates, timeline writes
story     -> event choices, conditions, effects
timeline  -> immutable events, snapshots, fork/compare queries
creator   -> reserved interfaces only in MVP
```

每个模块按 `controller -> service/domain service -> mapper -> database` 分层。Controller 不得直接访问 mapper；跨模块调用使用 service 或稳定的 domain DTO。`world` 是用例编排入口，模拟算法放在 `simulation`，分支快照与审计放在 `timeline`。

## 数据库初稿

所有表使用 `sekai_` 前缀；主键为 `BIGINT`，业务唯一性由唯一索引保证，时间统一使用 UTC `DATETIME(6)`，世界游戏日期使用 `DATE`。

| 表 | 用途 | 第一阶段关键字段 |
| --- | --- | --- |
| `sekai_user` | 用户身份 | `id`, `email`, `password_hash`, `display_name`, `created_at` |
| `sekai_world` | 世界元数据 | `id`, `owner_id`, `name`, `seed`, `visibility`, `created_at` |
| `sekai_city` | 城市 | `id`, `world_id`, `name`, `description` |
| `sekai_location` | 地点 | `id`, `city_id`, `name`, `kind`, `capacity`, `description` |
| `sekai_location_connection` | 地点连接 | `id`, `from_location_id`, `to_location_id`, `travel_days` |
| `sekai_faction` | 组织 | `id`, `world_id`, `name`, `description` |
| `sekai_actor` | 角色 | `id`, `world_id`, `faction_id`, `location_id`, `name`, `role`, `profile_json`, `state_json` |
| `sekai_relationship` | 角色关系 | `id`, `world_id`, `from_actor_id`, `to_actor_id`, `affinity`, `trust`, `hostility`, `influence` |
| `sekai_actor_schedule` | 日程 | `id`, `actor_id`, `day_of_week`, `start_time`, `location_id`, `activity`, `priority` |
| `sekai_world_rule` | 规则 | `id`, `world_id`, `code`, `name`, `condition_json`, `effect_json`, `priority`, `enabled` |
| `sekai_event_template` | 事件模板 | `id`, `world_id`, `code`, `name`, `condition_json`, `payload_json`, `priority`, `enabled` |
| `sekai_world_branch` | 分支 | `id`, `world_id`, `parent_branch_id`, `fork_snapshot_id`, `name`, `status`, `created_at` |
| `sekai_world_clock` | 分支时钟 | `branch_id`, `current_date`, `last_tick_id`, `world_seed` |
| `sekai_simulation_tick` | tick 幂等/结果 | `id`, `branch_id`, `tick_key`, `from_date`, `to_date`, `result_json`, `created_at` |
| `sekai_world_event` | 可交互事件 | `id`, `branch_id`, `template_id`, `occurred_on`, `status`, `title`, `description`, `payload_json`, `idempotency_key` |
| `sekai_event_choice` | 事件选择 | `id`, `event_id`, `code`, `label`, `condition_json`, `effect_json`, `sort_order` |
| `sekai_timeline_event` | 不可变历史 | `id`, `branch_id`, `tick_id`, `event_id`, `event_type`, `summary`, `payload_json`, `occurred_on` |
| `sekai_state_change` | 状态差异 | `id`, `timeline_event_id`, `entity_type`, `entity_id`, `field_path`, `before_value`, `after_value` |
| `sekai_world_snapshot` | fork/replay 快照 | `id`, `branch_id`, `as_of_timeline_event_id`, `state_json`, `created_at` |

MVP 可先用 MyBatis 映射核心读写表，种子数据通过 `V2__seed_world.sql` 写入；后续 Creator Studio 再把规则和模板从 JSON 迁移到更强类型的配置表。

## API 初稿

认证：

- `POST /api/auth/register`：注册并返回 token 与用户。
- `POST /api/auth/login`：登录并返回 token 与用户。
- `GET /api/auth/me`：读取当前用户。

世界与模拟：

- `GET /api/worlds`、`POST /api/worlds`、`GET /api/worlds/{worldId}`
- `POST /api/worlds/{worldId}/advance`：body `{branchId, idempotencyKey}`，返回 tick、变化和新日期。
- `GET /api/worlds/{worldId}/state`：返回概览聚合。
- `GET /api/worlds/{worldId}/timeline`

角色、地点和事件：

- `GET /api/worlds/{worldId}/actors`
- `GET /api/worlds/{worldId}/actors/{actorId}`
- `GET /api/worlds/{worldId}/actors/{actorId}/relationships`
- `GET /api/worlds/{worldId}/locations`
- `GET /api/worlds/{worldId}/events`
- `GET /api/worlds/{worldId}/events/{eventId}`
- `POST /api/worlds/{worldId}/events/{eventId}/choices`：body `{choiceCode}`。

分支：

- `GET /api/worlds/{worldId}/branches`
- `POST /api/worlds/{worldId}/branches`
- `POST /api/worlds/{worldId}/branches/{branchId}/fork`：body `{timelineEventId, name}`。
- `GET /api/worlds/{worldId}/branches/{branchId}/compare`：MVP 返回占位或基础差异。

所有错误使用 `{code, message, details, traceId}`；业务冲突映射到 409，权限问题映射到 404 以避免泄露私有世界是否存在。

## 第一阶段任务拆分

### Step 1 — 蓝图、目录与运行契约

依赖：无。模型级别：强模型审阅架构，默认模型执行文档与骨架。

上下文：工作区为空，目标是创建独立目录，不修改相邻 memory 项目。

任务：写入本蓝图、ADR、README、后端/前端/数据库目录；确定端口、配置、迁移版本和种子世界命名。

验证：目录存在；文档包含边界、模型、API、风险与路线图；启动命令有明确说明。

退出条件：新项目的空骨架可被后续步骤独立使用；回滚策略为删除新建目录内对应文件，不触碰工作区外内容。

### Step 2 — 后端应用与数据库迁移

依赖：Step 1。串行。

上下文：Java 21 目标、Spring Boot 4、Spring MVC、MyBatis、Flyway、MySQL 8；测试 profile 使用 H2 仅用于快速集成测试。

任务：建立 Maven、应用入口、统一响应/错误、配置、Flyway V1/V2、MyBatis 基础配置和健康检查。

验证：`mvn test`、`mvn package`；MySQL 可从零执行迁移；H2 测试上下文能启动。

退出条件：后端能启动并暴露健康端点；回滚为移除新增模块文件，数据库通过 Flyway 版本回退策略处理，不手工改已执行迁移。

### Step 3 — Identity 与 World/Actor/Location 读写

依赖：Step 2。串行。

上下文：实现最少身份和世界拥有权；密码使用 PBKDF2；token 使用 HMAC-SHA256；核心实体由 MyBatis mapper 持久化。

任务：注册、登录、me、Bearer 过滤器、世界创建/列表/详情、种子世界读取、角色/地点/组织查询。

验证：认证单测、权限隔离集成测、API 冒烟；注册后能创建世界并读取种子实体。

退出条件：没有认证无法访问私有世界；回滚为停用接口和删除本步骤 Java/SQL，保留迁移历史。

### Step 4 — 最小确定性模拟内核

依赖：Step 3。串行，最重要的领域步骤。

上下文：模拟只接受显式 `SimulationInput`，不读系统时间；固定 seed、日期和状态必须产出相同 `SimulationResult`。

任务：实现时钟推进、日程执行、规则条件、事件模板选择、事件效果、关系变化、tick 幂等记录和 timeline/state_change 写入。

验证：先写测试再实现：固定种子、日程、关系变化、条件、效果、重复 tick；再跑 Spring Boot 集成测试。

退出条件：推进一天可重复调用而不重复执行；所有重要变化有 timeline 记录；回滚为关闭 advance 入口，数据库记录保持可审计。

### Step 5 — Story choices、Snapshots 与 fork

依赖：Step 4。可与前端读页面并行，但数据库共享时合并前需验证。

上下文：事件选择通过条件/效果 DTO 执行；fork 从已存在 timeline 节点生成独立 branch 和 clock。

任务：事件详情、选择提交、状态前后对比、snapshot、fork、branch 列表和 compare 基础实现。

验证：选择条件和重复选择测试；分支复制和权限测试；fork 后父子分支推进结果互不污染。

退出条件：用户能完成“推进—选择—fork”闭环；回滚为隐藏 fork 写接口并保留 snapshot 数据。

### Step 6 — Vue 3 MVP 界面

依赖：Step 3 的查询 API；推进与选择页依赖 Step 4/5，可先用契约 stub 开发。

上下文：Vite + Vue 3 + TypeScript + Router + Axios；不使用静态假数据冒充完成，所有核心卡片从 API 获取。

任务：登录、世界选择、总览、地图、角色、关系、时间线、事件、分支页；响应式布局；loading/error/success/empty 状态。

验证：`npm run build`；浏览器核心路径验证；窄屏检查主要操作可用。

退出条件：登录后可以浏览并执行核心动作；回滚为移除前端路由/组件，不影响后端。

### Step 7 — 全链路验证与交付门

依赖：Step 4、5、6。串行。

上下文：执行用户要求的 `/tdd` 与 `/verify` 意图，用仓库脚本/命令落地。

任务：后端编译、单测、集成测，前端构建，数据库从零初始化，核心用户流程验证；记录未完成项与风险。

验证：所有命令输出保存到交付报告；失败项必须归类为代码缺陷、环境缺失或明确未实现。

退出条件：完成项可演示，未完成项可追踪；交付报告和下一阶段建议齐全。

## 第二阶段路线图：创作与叙事扩展

- Creator Studio：角色、地点、规则、事件模板和剧情编辑器。
- 世界种子 JSON 导入/导出与 schema 校验。
- StoryArc、Quest、多条件选择、多结局和事件依赖图。
- 时间线分支 compare、replay 和更高效的快照策略。
- 可选 Redis 缓存、WebSocket 推送，但保持模拟核心无外部依赖。

## 第三阶段路线图：平台化与协作

- 多世界发布、分享、复制、版本和协作者权限。
- 规则包/内容包市场、审核、版本兼容和迁移。
- 事件生成辅助 API；AI 只生成候选文本和模板，经规则校验后落库。
- 可观测性、作业队列、水平扩展和分布式幂等锁。
- 移动端适配和离线只读历史。

## 主要技术风险与缓解

1. Spring Boot 4 与周边 starter 版本漂移：锁定 parent/starter 版本，CI 中固定 Maven 构建；优先使用官方兼容矩阵。
2. JSON 规则逐渐失控：MVP 限制为白名单操作和字段路径，所有规则由 Java evaluator 解释，不执行脚本。
3. 快照过大：MVP 以小世界换取可解释性，后续按 tick 或事件数压缩并引入增量快照。
4. 幂等与并发：数据库唯一键 + 事务先行；部署多实例前再引入分布式锁。
5. 前后端契约漂移：DTO 和 OpenAPI 文档同步，集成测试覆盖推进/选择/fork 三条写路径。
6. 私有世界泄露：所有 world-scoped service 先通过 owner/collaborator 检查，控制器只传 ID，不自行拼查询。
7. 事件不可解释：每个 effect 产生 timeline event 和 state change，测试断言前后值而非仅断言 HTTP 200。

## 架构决策记录清单

- ADR-001：第一阶段采用模块化单体。
- ADR-002：确定性模拟以显式 seed + 逻辑日期为输入。
- ADR-003：重要变化采用 timeline event + state change 审计。
- ADR-004：MVP 采用数据库 JSON 快照实现 fork，再评估事件溯源混合模型。
- ADR-005：MVP 使用 PBKDF2 + HMAC Bearer token，后续可替换为成熟身份提供商。
- ADR-006：测试 profile 使用 H2，生产/验收环境使用 MySQL 8。

## 反模式审查清单

- 不把世界状态放在静态变量、前端 store 或内存单例中。
- 不让 controller 直接调用 mapper。
- 不在一个 `WorldService` 中实现全部模拟、分支、认证和查询。
- 不用固定前端假数据掩盖未接通 API。
- 不把随机数调用散落在各处；所有随机决策从有序上下文生成。
- 不修改已执行 Flyway migration；新增变更必须增加版本。
- 不为未进入 MVP 的微服务、消息系统和 AI 接口提前创建无用途的类。

## 依赖图与并行性

```text
Step 1 -> Step 2 -> Step 3 -> Step 4 -> Step 5 -> Step 7
                         \-> Step 6 -----------/
```

Step 6 在 Step 3 的查询契约稳定后可与 Step 4/5 的后端实现并行；由于当前只有一个执行者和空仓库，本次采用串行落地以减少合并冲突。

## 蓝图审阅结论

已按边界、依赖正确性、可回滚性、验收可执行性和反模式清单进行 adversarial review。关键修正为：将模拟输入显式化、将 tick 幂等键落库、把 fork 所需 snapshot 纳入 MVP、将错误码与权限泄露策略写入 API 契约，并明确 H2 只用于测试而非替代 MySQL。
