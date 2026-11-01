# OpenClaw

基于 Java 21 + Spring Boot 3.5 + Spring AI 1.1 的智能 AI 助手，通过 **CLI 命令行** 和 **微信（iLink SDK）** 双入口服务多用户。核心是由 `DeepSeekRouter` 驱动的 Agent：DeepSeek 模型负责工具决策，Spring AI 负责工具发现与调度，叠加技能（Skill）图谱、长期记忆、RAG 知识库、WebUI 监测看板，并集成天气/地图（高德）、媒体（阿里云百炼）、飞猪旅游产品（FlyAI CLI）、提醒等 40+ 项能力。

## 功能特性

- **AI Agent 对话**：基于 DeepSeek 的多轮上下文对话，支持流式响应与工具调用
- **双入口**：交互式 CLI + 微信 Bot（文本/图片/语音/文件消息）
- **多用户支持**：iLink Hub 多 Bot 实例，一致性哈希分配用户，会话隔离
- **技能系统**：Markdown 定义技能（当前有 `travel`），LLM 图谱编排自动补全信息并规划工具调用
- **旅行规划**：飞猪实时酒店/机票/火车/景点查询，酒店综合推荐，每日行程、餐饮推荐、预算，行程自动沉淀"我的行程"
- **长期记忆**：按用户提取偏好/兴趣，词项匹配召回，每轮对话后自动更新
- **RAG 知识库**：Tika 文档解析 → 分块 → DashScope Embedding → Java 层余弦相似度检索
- **提醒**：once/daily/weekly/monthly/cron 周期，重启后恢复并补发漏掉的提醒
- **多模态**：图片/视频生成（Wan）、视觉理解/OCR、语音识别（ASR）与合成（TTS，SILK 编解码）
- **文档**：PDF/Office 解析、文档生成与修改
- **联网能力**：Bing RSS 新闻、网页搜索与抓取（支持代理）
- **地图与天气**：高德 POI 搜索、地理编码、驾车路线、实时天气与预报
- **数学计算**：Symja 精确数值/符号计算
- **WebUI 监测看板**：Vue3 + Vite 前端，实时审计 Agent/工具执行、性能指标、消息流、用户会话管理
- **审计追踪**：每次 Agent 执行（输入、prompt、记忆、工具参数/结果、回复）写入 `logs/agent-trace.log` 与数据库

## 项目结构

```
├── src/main/java/com/ykd/claw/
│   ├── App.java                    # 主启动类（仅启动与基础初始化）
│   ├── agent/                      # Agent 核心
│   │   ├── DeepSeekRouter.java     # 路由：历史/记忆/技能选择/工具筛选/审计
│   │   ├── ToolProvider.java       # 工具提供者接口（@Tool 方法统一注册）
│   │   ├── PlannedToolExecutor.java# 技能图规划工具执行
│   │   └── ...                     # 审计（AgentAuditService）、执行追踪等
│   ├── graph/                      # 技能图谱编排（Spring AI Alibaba Graph Core）
│   │   ├── SkillGraphExecutor.java # analyze→task_analyzer→check_information→plan_tools→…
│   │   └── ...                     # 任务分析、信息需求评估、执行计划、校验、结果聚合
│   ├── skill/                      # 技能系统
│   │   ├── FileSystemSkillLoader.java # 解析 skills/<name>/SKILL.md
│   │   ├── SkillManager.java       # 关键词评分匹配 + 3s 热重载
│   │   └── SkillTool.java          # read_skill 工具
│   ├── channel/                    # 入口渠道
│   │   ├── cli/                    # CLI 命令（help/version/status/ai/ilink/ilinkhub/multi/exit）
│   │   └── wechat/                 # 微信渠道（ILinkBotService / ILinkHubService / 会话 Token 持久化）
│   ├── config/                     # 配置层（SecretsManager / ApplicationConfig / ILinkHubConfig）
│   ├── memory/                     # 长期记忆（提取、存储、按词项召回）
│   ├── knowledge/                  # RAG 知识库（入库、分块、Embedding、检索）
│   ├── travel/                     # 旅行域（行程规划、餐饮/预算、用户画像、行程持久化）
│   ├── flyai/                      # 飞猪实时旅游产品（CLI 调用 + 酒店预订/综合推荐）
│   ├── map/                        # 高德（POI/地理编码/路线/天气）
│   ├── media/                      # 图片/视频生成、语音 ASR/TTS、音视频处理
│   ├── vision/                     # 视觉理解与 OCR
│   ├── document/                   # 文档解析、生成、修改
│   ├── web/                        # Bing RSS 新闻、网页搜索与抓取
│   ├── reminder/                   # 提醒调度器（周期、重启恢复、补发）
│   ├── webui/                      # Web 监测看板后端（/api/monitor/*、SSE 事件流、微信登录）
│   ├── user/                       # 用户体系（注册、渠道、偏好）
│   ├── math/ time/ question/       # 数学计算 / 当前时间 / 学科分类
│   └── com/openilink/              # iLink 微信 Bot SDK（本地分叉）
├── src/main/resources/
│   ├── application.yml             # 主配置（全部 ${ENV:default} 注入，无硬编码密钥）
│   ├── application-{sqlite,postgres,dev,prod}.yml
│   ├── app.properties / logback.xml / db/
├── src/test/                       # 测试（目录镜像 main 包结构）
├── frontend/                       # WebUI 看板（Vue3 + Vite）
├── skills/travel/                  # 技能定义（SKILL.md）
└── docs/                           # 设计文档（MEMORY / SKILL_GRAPH_RAG / ADDING_TOOLS / TOOLS）
```

## 快速开始

### 环境要求

- JDK 21+（系统已装 Maven 3.9+；仓库内 `mvnw` wrapper 已损坏，请直接使用系统 `mvn`）
- Node.js 18+（FlyAI 官方 CLI，用于酒店、机票、火车票和景点链接）

安装 FlyAI CLI：

```bash
npm i -g @fly-ai/flyai-cli
flyai --help
```

### 配置密钥

```bash
# 方式1：环境变量（推荐）
set DEEPSEEK_API_KEY=sk-your-key-here      # DeepSeek AI（必填，Agent 决策与对话）
set DASHSCOPE_API_KEY=sk-your-key-here      # 阿里云百炼：图片/视频/视觉/OCR/语音/Embedding
set AMAP_API_KEY=your-key-here              # 高德：地点、路线、地理编码、天气
set FLYAI_API_KEY=your-key-here             # 飞猪 FlyAI：旅游商品实时结果（试用可留空）
set ILINK_TOKEN=your-token-here             # 微信 Bot（可选，留空使用扫码登录）

# 方式2：文件配置
copy secrets.properties.example secrets.properties
# 编辑 secrets.properties 填入真实密钥
```

### 配置 iLink Hub（多 Bot 多用户）

```bash
# 方式1：配置文件（推荐）
copy ilinkhub.properties.example ilinkhub.properties
# 编辑 ilinkhub.properties，填入多个 Bot Token（bot.N.id / bot.N.token / description / maxMessages）

# 方式2：命令行动态管理
# 启动后使用 ilinkhub add/login/start 等命令添加和管理 Bot 实例
```

### 构建 & 运行

```bash
# 构建（fat JAR）
mvn clean package

# 运行（默认 sqlite profile，数据落 openclaw.db，零配置）
java -jar target/claw-1.0.0.jar

# 切换 PostgreSQL（需在 secrets.properties 配置 postgres.* 连接）
set SPRING_PROFILES_ACTIVE=postgres
```

### 前端看板（可选）

```bash
cd frontend
npm install
npm run build        # 产物输出到 src/main/resources/static，随应用启动提供
```

启动后浏览器访问 **http://localhost:8080/** 打开 WebUI 监测看板（Agent 执行审计、性能指标、消息流、记忆/提醒/知识库管理、微信登录等）。

## CLI 使用示例

```
openclaw> 你好，介绍一下你自己        # 直接输入文字 → AI 对话
openclaw> help                        # 查看命令列表
openclaw> status                      # 查看运行状态
openclaw> weather 杭州                # 查询天气（自然语言亦可）
openclaw> ai clear                    # 清除对话历史
openclaw> ilink login                 # 微信扫码登录（单 Bot 模式）
openclaw> ilinkhub status             # 查看 Hub 状态（多 Bot 模式）
openclaw> ilinkhub users              # 查看用户分配情况
openclaw> multi                       # 多用户测试命令
openclaw> exit                        # 退出
```

## AI 工具调用示例

```
# 天气
用户：杭州天气怎么样？
AI：杭州: 晴, 25℃ (20~30℃) 湿60% 东风3级

# 新闻
用户：搜索最新的科技新闻
AI：1. AI 技术突破：GPT-5 发布... 2. 中国芯片产业取得重大进展...

# 旅行规划（触发 travel 技能）
用户：帮我规划一个杭州三日游
AI：（技能图谱自动补全出发地/日期等信息）每日行程 + 景点 + 餐饮 + 预算

# 图片识别 / 文档总结 / 语音交互
用户：[发送图片]  / [发送 PDF]  / [发送语音]
AI：这张图片显示的是一只可爱的猫咪... / 文档主要内容：... / 自动转文字并语音回复

# 提醒
用户：每天早上 9 点提醒我打卡
AI：已创建提醒（daily 09:00），重启后自动恢复
```

## 工具清单（40+）

| 工具 | 说明 |
|------|------|
| `query_weather` / `query_weather_forecast` | 高德实时天气 / 未来预报 |
| `search_place` / `geocode` / `get_route` | 高德 POI 搜索 / 地址编码 / 驾车路线 |
| `search_news` / `get_top_headlines` | Bing RSS 新闻搜索 / 头条 |
| `search_web` / `fetch_web_page` | 网页搜索 / 网页抓取（支持代理） |
| `generate_image` / `generate_video` | 文生图（Wan）/ 文生视频（异步轮询） |
| `analyze_image` / `ocr_extract` | 视觉理解 / OCR 文字提取 |
| `recognize_speech` / `speak_text` | 语音识别 / 文本转语音 |
| `read_document` / `generate_document` / `modify_document` | 文档解析 / 生成 / 修改 |
| `search_knowledge` / `index_knowledge_document` | RAG 知识检索 / 文档入库 |
| `create_reminder` / `list_reminders` / `cancel_reminder` / `pause_reminder` / `resume_reminder` / `retry_reminder` | 提醒全生命周期管理 |
| `flyai_search_hotel` / `flyai_book_hotel` / `flyai_recommend_hotel` | 飞猪酒店搜索 / 预订链接 / 综合推荐（价格·评分·距离·交通） |
| `flyai_search_flight` / `flyai_search_train` / `flyai_search_poi` / `flyai_ai_search` | 机票 / 火车 / 景点 / 自然语言旅游搜索 |
| `list_my_itineraries` / `get_my_itinerary` / `delete_my_itinerary` | 我的行程（按用户隔离） |
| `math_compute` | Symja 精确数值/符号计算 |
| `get_current_time` | 当前时间（时区感知） |
| `classify_subject` | 学科问题分类 |
| `read_skill` | 读取技能定义 |

> 新增工具无需修改 `DeepSeekRouter`：实现 `ToolProvider` 接口 + `@Tool` 注解即可自动注册（见 `docs/ADDING_TOOLS.md`）。

## 微信 Bot 功能

登录微信 Bot 后，可通过微信发送：

- **文本消息**：直接发送文字，AI 自动回复
- **图片消息**：发送图片，AI 自动识别并描述
- **语音消息**：发送语音，AI 自动转文字并回复（支持 TTS 语音回复）
- **文件消息**：发送文档（PDF/Word/Excel 等），AI 自动提取内容并总结

### iLink Hub 多用户原理

- 多个 Bot 实例并行运行（配置文件或命令行动态管理）
- **一致性哈希**将用户分配到固定 Bot，保证会话连续性
- 自动负载均衡，支持动态添加/移除 Bot 实例
- 会话 Token 持久化（JPA），重启后自动探活与监听自愈

## 核心架构（从入口到回复）

```
用户消息 → channel（cli / wechat iLink）
  → DeepSeekRouter.route(userId, conversationId, message)   ← Agent 核心
      ├─ ConversationService 取历史
      ├─ MemoryService.queryMemory 取长期记忆
      ├─ 技能选择：SkillRegistry.match（skill 技能图谱）
      ├─ 若选中技能且有 planned tools：SkillGraphExecutor.executePlannedTools
      │    在模型前执行计划内工具，结果聚合进 Graph context
      ├─ ChatClient.call（AuditedToolCallback 包装所有工具，防重复执行）
      ├─ ConversationService.saveTurn + MemoryService.extractMemory
  → 回复返回渠道（CLI 打印 / 微信消息）
```

- **技能图谱**：`analyze → task_analyzer → check_information →（缺信息？await_user → 返回澄清问题）→ plan_tools → validate_planning_information → END`，checkpoint 持久化在 `data/graph-checkpoints`，支持多轮补全信息
- **审计**：每次执行的输入、prompt、历史、记忆、工具参数/结果、回复、异常写入 `logs/agent-trace.log` 与 `agent_execution` / `tool_execution` 表，WebUI 实时展示

## 架构规范

- **分层架构**：common → config → model → repository → service → tool → handler
- **Service 层不处理 JSON/XML**：解析逻辑在 repository（输出）或 handler（输入）
- **密钥管理**：所有外部依赖通过 application.yml + 环境变量注入，代码中无硬编码
- **主类纯粹**：App.java 只做启动和基础初始化
- **Tool 机制**：`@Tool` 注解 + `ToolProvider` 接口统一管理，新增功能零改动路由
- **技能系统**：Markdown 定义（YAML front-matter + 执行规则），图编排可插拔扩展点
- **持久化**：Spring Data JPA，默认 SQLite（零配置），可切换 PostgreSQL
- **多会话隔离**：userId + conversationId（微信用户 `wx_` 前缀）
- **异步处理**：视频生成等长任务异步执行，不阻塞对话
- **外部数据安全**：搜索结果/网页/文档/记忆一律视为 untrusted data

## 技术栈

- Java 21 / Spring Boot 3.5.8 / Spring AI 1.1.2 / Spring AI Alibaba Graph Core 1.1.2.2
- Maven（fat JAR 打包）· Lombok · SLF4J + Logback
- DeepSeek API（Agent 对话与工具决策）
- 阿里云百炼 DashScope（图片/视频/视觉/OCR/语音/Embedding）
- 高德 Web API（地点、路线、地理编码、天气）
- FlyAI CLI（飞猪实时旅游产品）
- iLink 微信 Bot SDK（本地分叉）
- Spring Data JPA + SQLite（默认）/ PostgreSQL
- Apache Tika（文档解析）· SILK Codec（语音编解码）· Symja（数学计算）
- Gson / Jackson · Java HttpClient
- Vue 3 + Vite（WebUI 监测看板）
