# Migration workspace

运行时使用的 Flyway SQL 位于 `backend/src/main/resources/db/migration/`，这是 Maven 打包时的 classpath 迁移源。本目录保留为数据库设计与后续迁移协作入口；新增迁移时应同步放入运行时目录并在这里登记说明。
