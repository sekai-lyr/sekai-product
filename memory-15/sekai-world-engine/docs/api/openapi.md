# API 草案

除注册和登录外，接口均要求：

```http
Authorization: Bearer <token>
```

错误统一返回：

```json
{"code":"...","message":"...","timestamp":"..."}
```

## 身份

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/auth/register` | 注册，body：`email/password/displayName` |
| `POST` | `/api/auth/login` | 登录，body：`email/password` |
| `GET` | `/api/auth/me` | 当前用户 |

注册和登录成功返回 `token`、`expiresAt` 与 `user`。

## 世界与模拟

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/worlds` | 当前用户的世界 |
| `POST` | `/api/worlds` | 创建种子世界，body：`name`、可选 `seed` |
| `GET` | `/api/worlds/{worldId}` | 世界概览 |
| `GET` | `/api/worlds/{worldId}/state?branchId=` | 当前分支完整状态 |
| `POST` | `/api/worlds/{worldId}/advance` | 推进一天，body：`branchId`、`idempotencyKey` |
| `GET` | `/api/worlds/{worldId}/timeline?branchId=` | 时间线 |
| `GET` | `/api/worlds/{worldId}/locations` | 地点列表 |

推进响应包含 `fromDate`、`toDate`、`tickKey`、摘要、角色状态变化与生成事件。相同 `branchId + idempotencyKey` 重复提交会返回第一次推进结果，不重复写入世界状态。

## 角色与故事

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/worlds/{worldId}/actors?branchId=` | 角色及分支状态 |
| `GET` | `/api/worlds/{worldId}/actors/{actorId}?branchId=` | 角色详情与关系 |
| `GET` | `/api/worlds/{worldId}/actors/{actorId}/relationships` | 关系列表 |
| `GET` | `/api/worlds/{worldId}/events?branchId=` | 分支事件 |
| `GET` | `/api/worlds/{worldId}/events/{eventId}?branchId=` | 事件与选项 |
| `POST` | `/api/worlds/{worldId}/events/{eventId}/choices?branchId=` | body：`choiceCode`，提交选择 |

## 分支

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/worlds/{worldId}/branches` | 分支列表 |
| `POST` | `/api/worlds/{worldId}/branches` | 从 body 的 `sourceBranchId` 和 `timelineEventId` 创建分支 |
| `POST` | `/api/worlds/{worldId}/branches/{branchId}/fork` | 从指定分支的时间线节点创建分支，body：`timelineEventId`、`name` |
| `GET` | `/api/worlds/{worldId}/branches/{branchId}/compare?otherBranchId=` | 分支摘要对比 |
