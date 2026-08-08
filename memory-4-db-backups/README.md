# memory-4-db-backups · 数据库备份

`sekai_friend` 数据库的备份文件集合。

## 内容

- `sekai_friend_before_commercialize_20260526-193918.sql`：商业化改造前（2026-05-26）的完整数据库备份

## 用途

- 作为 `memory-3`、`memory-4`、`memory-6`、`memory-7` 等项目（共用 `sekai_friend` 数据库）的数据恢复来源。
- 在数据库误操作或需要回退到商业化前状态时使用。

## 恢复方式

```powershell
mysql -uroot -p --default-character-set=utf8mb4 < sekai_friend_before_commercialize_20260526-193918.sql
```

## 注意

备份文件包含当时的完整业务数据，请勿泄露到公开环境。
