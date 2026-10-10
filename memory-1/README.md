# Sekai Data Object - 二次元数据锡通

二次元数据锡通（Sekai Data Object）是一个二次元数据中心项目：收录**番剧**、**人物**、**角色台词**及**台词原声音频**，所有信息以官方数据为准，统一存储于大数据中心。

## 数据规模（全量版）

| 数据 | 数量 | 来源 |
| --- | --- | --- |
| 番剧 | **200 部**（AniList 评分 TOP200，含 TV / 剧场版 / 网络动画） | AniList 官方数据 |
| 人物 | **11,278 位**（含官方简介、声优、日文原名、立绘） | AniList 官方角色数据 |
| 台词 | **7,920 条**（日文原版台词 + 英文台词 + 精选名台词） | 公开台词数据集 |
| 封面/立绘 | 全部 200 封面 + 11,278 立绘本地托管 | 本地 `uploads/images/` |
| 台词原声音频 | 0（支持上传，MP3/WAV/OGG/M4A/FLAC/AAC ≤100MB） | 用户上传 |

## 项目信息

| 项目 | 值 |
| --- | --- |
| 项目名称 | SekaiDataObject |
| 端口 | 8081 |
| 数据源 | sekai_friend（与 memory-2 ~ memory-8 相同配置） |
| 表前缀 | `sekai_dataobject_anime_` |
| Session Cookie | JSESSIONID_M1 |
| 主题 | 二次元数据锡通 |

## 功能

- `/login` 登录页、`/register` 注册页
- 首页数据看板（番剧 / 人物 / 台词 / 原声统计）
- 番剧档案库：官方名称、原名、类型、制作公司、首播日期、集数、官方评分、简介、封面、官网
- 人物图鉴：官方姓名、原名、定位、声优（CV）、官方简介、立绘
- 台词原声库：官方台词原文、集数、时间点、**原声音频上传与在线播放**
- 全站搜索与分页

## 图片素材（本地托管）

全部 200 部番剧封面与 11,278 张人物立绘均来自 AniList 官方图源，已下载至 `uploads/images/` 本地托管，页面通过 `/uploads/images/*` 访问，不依赖外网，永不失效。

全量数据构建脚本位于 `build-data/`：

```bash
python build-data/build_full_data.py   # 阶段A：AniList 全量角色/简介/声优抓取 + 图片下载
python build-data/gen_final_sql.py     # 阶段B：中文译名校对 + 台词匹配 + 生成 init.sql 并导入 MySQL
```

数据源文件：`build-data/data/anilist_top200.json`（番剧 TOP200）、`full_data.json`（角色 + 台词全量）、台词数据集（日文 10388 条 + 英文 8612 条）。

初始化数据库后全部数据已写入 `init.sql`，全新环境执行 `mysql -uroot -p123456520baba < build-data/init.sql` 即可同步获得全部数据。

## 运行

1. 初始化数据库（使用 MySQL，root / 123456520baba）：

```bash
mysql -uroot -p123456520baba < build-data/init.sql
```

2. 启动项目：

```bash
mvn spring-boot:run
```

3. 访问 http://localhost:8081/login

默认演示账号：`admin` / `sekai123`

## 目录结构

```
src/main/java/com/sekai/dataobject/
├── SekaiDataObjectApplication.java   # 启动类
├── config/                           # 上传资源映射、桌面浏览器启动
├── control/                          # 页面路由、用户注册登录、数据 CRUD
├── dataobject/                       # DO（数据库对象）
├── mapper/                           # MyBatis Mapper 接口
├── model/                            # 业务模型
├── service/ + service/impl/          # 业务服务
└── util/                             # 密码哈希、上传路径工具
src/main/resources/
├── application.properties
├── com.sekai.dataobject.mapper/      # MyBatis XML
├── static/                           # CSS / JS
└── templates/                        # Thymeleaf 页面
build-data/init.sql                   # 建表 + 官方种子数据
uploads/                              # 上传的图片与原声音频
```

## 音频格式支持

上传原音频支持：`mp3`、`wav`、`ogg`、`m4a`、`flac`、`aac`，最大 100MB。
