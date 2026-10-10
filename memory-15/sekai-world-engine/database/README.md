# Database

数据库迁移由 Flyway 管理，应用启动时自动执行：

- 迁移源：`backend/src/main/resources/db/migration/`
- 当前迁移：`V1__create_schema.sql`
- 手工种子说明：`seed/seed-world.sql`

世界种子通过应用服务创建，以便同时生成世界、主分支、时钟、角色初始状态、规则和事件模板，并保证事务一致性。`seed-world.sql` 仅保留给需要脱离应用检查数据库结构的场景。

主要表族：

- 身份：`sekai_user`
- 世界与地图：`sekai_world`、`sekai_city`、`sekai_location`、`sekai_location_connection`
- 社会状态：`sekai_faction`、`sekai_actor`、`sekai_actor_schedule`、`sekai_relationship`
- 模拟：`sekai_world_rule`、`sekai_event_template`、`sekai_simulation_tick`
- 故事：`sekai_world_event`、`sekai_event_choice`
- 可回放性：`sekai_timeline_event`、`sekai_state_change`、`sekai_snapshot`
- 分支状态：`sekai_world_branch`、`sekai_world_clock`、`sekai_branch_actor_state`
