# 领域模型

## 世界层级

```text
World
└── City
    ├── Location × 5
    └── LocationConnection
```

`World` 是用户隔离和种子隔离的边界；`City`、`Location` 与连接构成可视化地图。MVP 中每个世界创建一个城市和五个地点。

## 社会层

- `Faction`：阵营及颜色、公共描述。
- `Actor`：角色的基础身份、所属阵营、初始位置。
- `ActorSchedule`：按星期定义角色移动与状态影响。
- `Relationship`：角色之间有向关系，包含关系类型、强度和信任度。

基础角色资料属于世界模板；`BranchActorState` 保存角色在某个分支中的位置、能量、心情和状态，避免分支之间互相污染。

## 模拟层

`WorldRule` 负责可解释的条件与效果；`EventTemplate` 负责概率、优先级与双选项模板；`SimulationTick` 是一个分支的一次幂等推进记录。

确定性输入为：

```text
worldSeed + currentDate + idempotencyKey + stable actor/rule/template ordering
```

同一输入得到相同日期、角色变化、事件集合和摘要。规则效果在模拟引擎中按优先级应用，并对能量、心情进行边界裁剪。

## 故事与时间线

- `WorldEvent`：推进生成的待处理故事事件。
- `EventChoice`：事件选项及前置心情条件、状态效果。
- `TimelineEvent`：模拟推进、选择、分支等可回放节点。
- `StateChange`：节点对应的字段级变化摘要。
- `Snapshot`：在推进或选择后记录分支状态，用于分支复制。

核心不变量：

1. 所有世界、分支和角色查询必须先通过当前用户归属校验。
2. 分支推进只写入该分支的 `BranchActorState`、时钟、事件和时间线。
3. 事件选择只能处理 `PENDING` 事件，且选项条件不满足时拒绝。
4. 时间线节点不可被静默覆盖；分支从节点复制快照后继续演化。
