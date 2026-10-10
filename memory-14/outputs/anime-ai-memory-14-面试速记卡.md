# AnimeAI / memory-14 面试速记卡

## 一句话

Java 21 + Spring Boot 的动漫 AI 助手：网页文本走自定义 Agent 工具循环，图片走 trace.moe/AniList/本地 CLIP/视觉模型的专用识图流水线，记忆采用 Redis + MySQL，提醒采用 MySQL + 浏览器轮询。

## 90 秒介绍

> 这是一个动漫 AI 助手平台。网页文本请求进入 `/api/ai/chat-with-tools`，后端将 `@Tool` 方法反射生成 OpenAI-compatible tools schema，把 system prompt、历史记忆和 RAG 上下文交给 LLM。LLM 如果返回 tool call，服务端校验并执行对应工具，把结果以 `role=tool` 回填，最多五轮后生成最终答案。
>
> 当前有 28 个工具，覆盖番剧、天气、地图、漫展、电影、提醒和商城。图片请求不进入 Agent，而是先用 trace.moe 识别作品，再从 AniList 拉角色候选图，用视觉模型做角色比对；如果证据不足，通过本地 CLIP、近三年目录和跨年代候选逐级降级，仍不可靠就拒答。
>
> 对话历史是 Redis 热缓存、MySQL 持久化；embedding 写入 Redis 向量索引，检索相关历史后注入 prompt。提醒记录进 MySQL，浏览器每五秒轮询。当前编译通过，但 SSE 还未实现，生产化还要补齐鉴权、会话归属、向量格式和外部 API 稳定性。

## 必背主链路

```text
网页文字：chat.html
  -> /api/ai/chat-with-tools
  -> AiController
  -> SpringAiChatService
  -> ToolCallingService
  -> LlmService /chat/completions
  -> @Tool 反射执行
  -> 最终 JSON

网页图片：chat.html
  -> /api/ai/analyze-image
  -> AnimeImageRecognitionService
  -> trace.moe / AniList / 本地 CLIP / VisionService
  -> 结果 JSON

提醒：createAnimeReminder
  -> MySQL reminder
  -> 浏览器 /api/reminders/pending 每 5 秒轮询
```

## `@Tool` 必答

当前不是 Spring AI 自动回调。项目使用 Spring AI 的 `@Tool/@ToolParam` 作为元数据；`ToolCallingService` 反射扫描、生成 schema、请求 LLM、解析 `tool_calls`、反射执行方法，再把结果回填模型。

循环最多 5 轮；同一轮多个工具调用在线程池并行；单个 Future 最多等 10 秒。

## 工具数量和类型

- `SpringAiTools`：23 个。
- `AnimeLifestyleTools`：5 个。
- `WeatherService`：0 个 `@Tool`。
- 合计：28 个。

典型工具：`getWeather`、`webSearch`、`searchAnime`、`searchAnimeMovie`、`getRecentAnimeMovies`、`searchAnimeEventsChina`、`searchNearbyTheater`、`createAnimeReminder`、`getAnimeWatchLinks`、`getAnimeRecommendations`。

## 图片识别口诀

```text
反向识图 → 作品 ID → 角色候选图 → 视觉比对
失败后：可见标题 → 本地 CLIP → 近三年目录 → 当前目录 → 跨年代候选
阈值：trace.moe 0.82；CLIP 0.73 且领先 0.015；目录置信度 80/85
```

核心回答：不是让视觉模型自由猜，而是“先检索缩小候选，再让视觉模型做受限验证”，并保留 NONE/无法确认。

## Embedding / RAG 一句话

Embedding 是把文字变成浮点向量；语义相近的文字距离更近。当前 `EmbeddingService` 调 DashScope `text-embedding-v2`，把“用户问题 + 助手回答”写入 Redis 向量索引，查询时取相似结果注入 prompt。注意：当前代码的维度、二进制格式和 conversationId 过滤仍需生产化修正，README 的 SQLite 描述不是当前主链路。

## 记忆和提醒

- 记忆：Redis `chat:memory:`，TTL 24 小时；MySQL `conversations/messages` 持久化；Redis 失效回源 MySQL。
- 历史：最多 10 条、估算 2000 token，超长做滚动摘要。
- 提醒：MySQL `reminder` 表，前端 5 秒轮询并标记 sent；不是 WebSocket/服务端主动推送。

## 三个亮点

1. 自定义 Function Calling 编排闭环：模型决策、工具执行、结果回填分离。
2. 多源动漫识图：trace.moe、AniList、Vision、本地 CLIP 分层降级。
3. 实时事实工具：天气、地图、漫展、猫眼、番剧数据，降低模型凭记忆回答的风险。

## 三个必须主动承认的缺口

1. `chatWithToolsStream()` 只是占位，网页当前是同步 JSON，不是 SSE。
2. 前端生成 conversationId，当前 API 归属校验不足；需要绑定登录 userId。
3. 工具参数解析、Redis 向量维度/序列化/会话过滤和外部 API 限流需要加强。

## 高频短答

**普通聊天与 Agent？**

普通聊天是一次 LLM 调用；Agent 多了工具 schema、结构化 tool call、代码执行、结果回填和多轮循环。

**为什么实时信息必须调用工具？**

天气、上映和活动具有时效性，模型记忆可能过期；工具查事实，LLM 负责解释。

**RAG 和记忆区别？**

记忆按时间保留上下文，RAG 按语义相似度找相关片段。

**为什么图片不做成工具？**

图片识别需要上传、解码、反向检索、候选图比对和多级降级，是独立长链路；当前网页也确实直接调用 `/analyze-image`。

**能否上线？**

当前可演示，编译通过；上线前要外置并轮换凭据、补 API 鉴权和会话归属、修正向量格式和维度、兼容工具参数字符串、处理限流/缓存/监控，并实现真正的流式或异步任务。

## 面试雷区

```text
不要说：网页只做普通聊天
不要说：Spring AI 自动执行 @Tool
不要说：图片识别已经进入 Agent
不要说：已经有 SSE
不要说：当前 RAG 就是 SQLite
不要说：提醒是服务端主动推送
不要说：所有会话天然属于登录用户
```

## 面试前最后复述

```text
网页文字 = Agent + tools
网页图片 = 专用识图流水线
记忆 = Redis 热缓存 + MySQL 持久化
RAG = embedding + Redis 向量检索
提醒 = MySQL + 浏览器轮询
当前缺口 = SSE、鉴权归属、向量实现细节、外部 API 稳定性
```

## 更新版硬事实（2026-09-12）

```text
当前源码 = 101 Java / 8 HTML / 1 测试类，工作树有大量未提交改动
网页文本 = /api/ai/chat-with-tools，不是普通 chat，也不是 Spring AI 自动执行
网页图片 = /api/ai/analyze-image，不进入同一套 ToolCallingService
工具数量 = SpringAiTools 23 + AnimeLifestyleTools 5 = 当前扫描到 28 个 @Tool
工具循环 = 反射 + JSON Schema + 同轮并发 + 单工具 10 秒 + 最多 5 轮
iLink = 当前入口已删除，不要说成当前稳定上线能力
SSE = 尚未实现，网页等待完整 JSON
```

**被问“项目更新后到底是哪套架构”时：**

> “当前版本是新 `ToolCallingService` 作为网页文本主链，旧 `AgentService/BaseTool` 作为遗留能力保留；图片是独立识图链。工作树里 iLink 已删除，所以我只把它当历史尝试，不把它当当前可达链路。”
