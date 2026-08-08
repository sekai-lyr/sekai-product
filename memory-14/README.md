# anime-ai · 动漫 AI 智能助手平台

![Java](https://img.shields.io/badge/Java-21-orange)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.5-brightgreen)
![Spring AI](https://img.shields.io/badge/Spring%20AI-1.0-purple)
![RAG](https://img.shields.io/badge/RAG-向量知识库-8A2BE2)
![ONNX](https://img.shields.io/badge/ONNX-视觉模型-005B96)
![TTS/ASR](https://img.shields.io/badge/TTS%2FASR-讯飞%20%7C%20DashScope-blue)
![Redis](https://img.shields.io/badge/Redis-聊天记忆-DC382D)

以**动漫为核心**的 AI 智能助手平台：截图识番、角色识别、番剧搜索推荐、追番提醒，并集成天气、地图、宠物护理、图片生成、语音等多模态 AI 能力。

## ✨ 核心功能

### 🎬 动漫 AI（平台核心）

- **截图识番**：上传动漫截图，自动识别出自哪部番、哪一集、哪个时间点
  - `trace.moe` 实时搜图匹配（相似度阈值 82%）
  - AniList GraphQL API 实时查询番剧/角色数据
  - 多级兜底识别：可见标题识别 → 本地角色索引 → 近两年番剧目录 → 当前季度 → 跨年代候选比对
- **角色识别**：识别图中角色，比对发型、瞳色、服装等特征，输出角色名、番剧、置信度
- **番剧服务**：搜索、按 ID 查询、当季/按年季度、即将开播、TOP 榜、角色搜索、番剧新闻
- **追番提醒**：番剧/电影新作上映提醒（定时任务 + 数据库持久化）

### 🐾 宠物 / 植物护理（AI 看护）

- 宠物档案（PetProfile）与植物档案（PlantProfile）管理
- 护理记录（CareRecord）、护理提醒（CareReminder）
- 医疗分诊（MedicalTriageService）、宠物食物安全查询（PetFoodSafetyService）
- 植物安全查询（PlantSafetyQueryService）、附近宠物医院搜索（高德地图 NearbyServiceSearch）
- AI 护理工作流（SpringAiCareWorkflowService）

### 🤖 通用 AI 能力

- **AI 对话**：Spring AI 流式聊天，支持工具调用（`/api/ai/chat-with-tools`）
- **Agent 工具链**：图片分析 / 图片编辑 / AI 画图 / 文件解析 / 网页搜索 / TTS 语音合成
- **天气查询**：接入天气 API（WeatherTool）
- **地图服务**：高德地图附近搜索
- **聊天记忆**：Redis + 数据库双层记忆，向量存储（SQLite VectorStore）RAG 知识库问答
- **多轮会话**：会话级 UserSession 管理，异步消息事件

### 🎙️ 多模态

- **TTS 语音合成**：讯飞语音（XfTtsService）
- **ASR 语音识别**：通义 DashScope（DashScopeAsrService）
- **视觉推理**：ONNX Runtime 视觉模型（VisionService，含 CUDA 支持）
- **图片生成**：ImageGenerationService

### 📦 其他模块

- 电商模块（ebusiness：商品/分类）、微信 ilink SDK 消息接入、敏感词过滤

## 🛠️ 技术栈

```text
后端        Java 21 · Spring Boot 3.5 · Spring AI (spring-ai-bom) · WebFlux
前端        Thymeleaf
数据        H2 · SQLite (VectorStore RAG) · Redis (聊天记忆) · MySQL 预留
AI 视觉     ONNX Runtime (CUDA) · trace.moe API · AniList GraphQL
AI 语音     讯飞 TTS · 通义 DashScope ASR
外部服务    高德地图 · 天气 API · AniList GraphQL · trace.moe
其他        Fastjson2 · OkHttp3 · HttpClient5 · Lombok
```

## 📐 项目结构

```text
memory-14
├── pom.xml
├── src/main/java/com/example/demo
│   ├── anime/          # 截图识番、角色识别、番剧服务（核心）
│   ├── ai/             # AI 对话、工具调用、动漫事件服务
│   ├── agent/          # Agent 工具链（图片/文件/搜索/TTS）
│   ├── aicare/         # 宠物/植物护理入口
│   ├── care/           # 护理服务（分诊、安全、提醒、附近医院）
│   ├── chat/           # 聊天记忆、会话、RAG 向量库
│   ├── vision/         # ONNX 视觉推理
│   ├── asr/ · tts/     # 语音识别 / 语音合成
│   ├── imagegen/       # AI 画图
│   ├── movie/          # 追番/电影提醒
│   ├── weather/        # 天气查询
│   ├── service/        # 高德地图
│   └── web/            # 页面控制器
├── rag_knowledge.sqlite   # RAG 知识库
└── data/                  # 数据库与视觉模型（大文件未上传）
```

## ▶️ 运行

```powershell
mvn spring-boot:run
```

## 📝 说明

- 外部 API（AniList / trace.moe / 讯飞 / DashScope / 高德 / 天气）需要自行配置 Key 环境变量
- `data/`：数据库文件与视觉模型（`vision_model.onnx` 等，大文件未上传）
- `.venv-clip/`：本地 CLIP 虚拟环境，未上传
