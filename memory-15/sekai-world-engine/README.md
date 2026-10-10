# Sekai World Engine / 世界引擎

一个以“可解释、可回放、可分支”为核心的原创确定性虚拟世界 MVP。

当前版本包含：用户注册与登录、创建种子世界、1 城市 / 5 地点 / 3 阵营 / 12 角色、规则与事件模板、按日推进、事件选择、时间线、快照、分支复制与分支对比，以及一个 Vue 3 世界控制台。

## 目录

- `backend/`：Java 21、Spring Boot 4、Spring MVC、MyBatis、Flyway
- `frontend/`：Vue 3、TypeScript、Vite、Vue Router、Axios
- `database/`：数据库初始化与种子说明
- `docs/`：蓝图、领域模型、API 草案、ADR
- `plans/`：Blueprint skill 产出的项目实施蓝图

## 本地运行

### 1. 准备 MySQL 8

创建数据库和账号：

```sql
CREATE DATABASE sekai_world CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'sekai'@'localhost' IDENTIFIED BY 'sekai';
GRANT ALL PRIVILEGES ON sekai_world.* TO 'sekai'@'localhost';
FLUSH PRIVILEGES;
```

后端默认连接：`jdbc:mysql://localhost:3306/sekai_world`，默认端口为 `8095`，也可以通过环境变量覆盖：

```powershell
$env:SEKAI_DB_URL = "jdbc:mysql://localhost:3306/sekai_world?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai"
$env:SEKAI_DB_USERNAME = "sekai"
$env:SEKAI_DB_PASSWORD = "sekai"
```

### 2. 启动后端

```powershell
cd backend
mvn spring-boot:run
```

Flyway 会自动执行 `backend/src/main/resources/db/migration/V1__create_schema.sql`。健康检查：`GET http://localhost:8095/api/health`。

### 3. 启动前端

```powershell
cd frontend
npm install
npm run dev
```

打开 `http://localhost:5173`。前端开发服务器将 `/api` 请求代理到 `http://localhost:8095`。

## 测试与构建

后端使用 H2 内存数据库执行 Flyway + API 集成测试：

```powershell
cd backend
mvn test '-Dspring.profiles.active=test'
```

前端类型检查与生产构建：

```powershell
cd frontend
npm run build
```

## 最小 API 流程

1. `POST /api/auth/register` 或 `POST /api/auth/login`
2. 携带 `Authorization: Bearer <token>` 调用 `POST /api/worlds`
3. `GET /api/worlds/{worldId}/state?branchId={branchId}` 获取当前状态
4. `POST /api/worlds/{worldId}/advance` 推进一天；`idempotencyKey` 用于幂等重放
5. `GET /api/worlds/{worldId}/events?branchId={branchId}` 查看事件
6. `POST /api/worlds/{worldId}/events/{eventId}/choices?branchId={branchId}` 提交选择
7. `POST /api/worlds/{worldId}/branches/{branchId}/fork` 从时间线节点创建分支

完整端点和请求体见 [`docs/api/openapi.md`](docs/api/openapi.md)。

## 当前边界

这是可运行的 MVP 基础，不包含生产部署、刷新令牌、邮件验证、细粒度权限、后台编辑器、WebSocket 实时推送和完整 OpenAPI 生成文件。这些内容已经记录在蓝图的后续路线图与风险清单中。
