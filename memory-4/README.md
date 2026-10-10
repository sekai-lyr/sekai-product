# Sekai Fortune

统一角色库抽签与今日运势 Web 应用。普通用户不能新增角色，只能从数据库已有角色里抽签、收藏、查看历史；角色库由项目种子数据维护。

项目保留 `control / model / dataobject / mapper / service` 分层，数据表使用 `sekai_Draw_lots_` 前缀。

## 功能范围

- 抽签：今日固定签、随机再抽、三连签仪式（免费开放）。
- 转盘：自建分区转盘 + 智能补全分区（根据最近抽签历史生成，免费开放）。
- 伙伴库 / 历史 / 收藏 / 成就徽章。
- 抽签结果可生成分享卡（免费开放）。

## 初始化数据库

先创建数据库：

```sql
CREATE DATABASE IF NOT EXISTS sekai_friend DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

在项目根目录执行：

```powershell
mysql -uroot -p --default-character-set=utf8mb4 -D sekai_friend < build-data/init.sql
```

## 运行

设置数据库环境变量：

```powershell
$env:DB_URL="jdbc:mysql://127.0.0.1:3306/sekai_friend?serverTimezone=Asia/Shanghai&useUnicode=true&characterEncoding=utf-8&useSSL=false&allowPublicKeyRetrieval=true"
$env:DB_USERNAME="root"
$env:DB_PASSWORD="你的数据库密码"
$env:SERVER_PORT="8084"
```

启动应用：

```powershell
mvn spring-boot:run
```

默认端口：`8084`。
