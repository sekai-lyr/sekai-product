# SekaiGaLaGame · lies ten years ago（谎言十年）

将 Ren'Py 视觉小说《lies ten years ago》（memory-13）以 **Spring Boot Web 引擎**完整复现的版本。

## 项目特点

- **剧情引擎**：将 5343 行 Ren'Py 脚本解析为 3756 个剧情节点（对白/旁白/场景/立绘/选项/跳转/结局），数据库驱动
- **全量剧情**：序章 + 30 章 + 3 条路线 + 18 个结局
- **选项分支**：19 个选项节点、44 个选择分支，忠实还原原脚本跳转逻辑
- **存档系统**：每账号 10 个存档槽位（服务端持久化）
- **CG 图鉴**：游玩过程中自动解锁 CG（105 张）
- **结局记录**：达成的结局永久记录
- **章节选择**：31 个章节可任意开始游玩
- **资源还原**：全部 196 张背景/CG/立绘原图

## 技术栈

- Spring Boot 4.0.5 + Java 21 + MyBatis + MySQL + Thymeleaf
- 前端：原生 HTML/CSS/JS 视觉小说播放器
- 数据源：`sekai_friend`（与 sekai 系列其他项目一致）
- 表前缀：`sekai_GaLaGame_lies_`

## 目录结构

```
SekaiGaLaGame/
├── pom.xml
├── database/
│   ├── schema.sql          建表脚本
│   ├── story-meta.sql      章节/角色/结局/图片元数据
│   ├── story-nodes.sql     剧情节点 + 选项数据
│   └── story.json          剧情图 JSON（解析器产物，调试用）
├── data-build/
│   └── parse_rpy.py        Ren'Py 脚本 -> 数据库 解析器
└── src/main/
    ├── java/com/sekai/galagame/
    │   ├── control/        Auth / Game / Save / Library 接口
    │   ├── service/        剧情引擎、用户服务
    │   ├── mapper/         数据访问
    │   ├── dataobject/     持久化实体
    │   ├── model/          视图模型（StoryFrame 等）
    │   └── util/
    └── resources/
        ├── application.properties
        ├── com.sekai.galagame.mapper/   MyBatis XML
        └── static/          前端播放器 + 游戏资源
```

## 启动

1. 初始化数据库（需先启动 MySQL）：

   ```sql
   source database/schema.sql
   source database/story-meta.sql
   source database/story-nodes.sql
   ```

2. 启动服务：

   ```bash
   mvn spring-boot:run
   # 或
   mvn package && java -jar target/sekai-galagame-0.0.1-SNAPSHOT.jar
   ```

3. 浏览器访问：<http://localhost:8093>

## 主要接口

| 接口 | 说明 |
|---|---|
| POST `/api/register` / `/api/login` | 注册 / 登录 |
| POST `/api/game/start` | 开始游戏（可指定 chapterNo） |
| GET `/api/game/state` | 当前剧情帧 |
| POST `/api/game/advance` | 推进剧情 |
| POST `/api/game/choose` | 选项分支（nextKey） |
| POST `/api/save/{slot}` / POST `/api/load/{slot}` | 存档 / 读档 |
| GET `/api/chapters` | 章节列表 |
| GET `/api/gallery` | 已解锁 CG |
| GET `/api/endings` | 结局解锁情况 |

## 数据重建

修改剧情后重新生成数据：

```bash
python data-build/parse_rpy.py
```
