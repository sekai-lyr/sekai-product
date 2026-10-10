# AnimeAI / memory-14 面试深挖手册

> 版本口径：以下内容以 `D:\Sekai_two\memory-14` 当前工作树源码为准，不以旧版截图、旧 README 或历史类名为准。项目当前工作树有大量未提交改动，面试时只描述当前可从代码和运行结果证明的能力。

## 0. 先说清楚边界

我不能保证面试结果，但这份手册把项目最容易被追问的链路、技术选择、实现细节和当前缺口都拆开了。建议先背《面试速记卡》，再按本手册做两轮口述。

不要把没有亲自负责的内容说成“我独立设计”。更稳妥的表达是：

> “我复盘当前版本时确认，主链路是……；这部分我能讲清楚实现和取舍。若问到未覆盖的模块，我会明确它是现有代码能力，而不是我的个人贡献。”

## 1. 项目一句话定位

这是一个基于 Java 21、Spring Boot、Spring AI 生态和多个外部数据源的动漫 AI 助手平台。它把网页聊天做成一个带实时工具调用的 Agent：普通问题由 LLM 直接回答；需要实时信息时，由 LLM 选择工具查询番剧、电影、天气、地图、漫展、商城和提醒；图片识别则走独立的动漫识图流水线，最后把结果返回到网页。

它不是一个单纯的“调用大模型聊天 Demo”，真正可讲的工程点是：

1. OpenAI-compatible Function Calling 的自定义编排循环。
2. AniList/Jikan/trace.moe/视觉模型/本地 CLIP 的多源识图与降级。
3. MySQL 持久化 + Redis 热缓存的对话记忆设计。
4. Embedding + Redis 向量检索形成的 RAG 意图。
5. 追番提醒、天气、地图、电影购票、漫展情报等业务工具。

## 2. 90 秒项目介绍（可直接口述）

> “这是一个动漫 AI 助手平台，后端采用 Java 21 + Spring Boot，前端是静态 HTML/JavaScript，数据层使用 JPA 连接 MySQL，Redis 用于会话记忆缓存和向量索引。用户从网页发送文本后，请求进入 `/api/ai/chat-with-tools`，服务端根据 `@Tool` 注解反射生成 OpenAI-compatible tools schema，把用户消息和记忆、RAG 上下文交给 LLM。模型如果返回 tool call，服务端就在受控线程池中执行对应业务方法，把工具结果以 `role=tool` 放回消息列表，再请求模型生成最终回答，最多循环五轮。
>
> 图片识别没有硬塞进文本 Agent，而是使用专用链路：先用 trace.moe 做反向识图，能定位作品时再从 AniList 拉角色候选图交给视觉模型比对；如果相似度不足，则依次尝试可见标题、内置本地 CLIP 角色索引、近三年 AniList 目录和跨年代候选验证，并设置置信度阈值，证据不足就明确返回无法可靠确认。
>
> 对话记忆采用 Redis 优先、MySQL 持久化兜底，较长历史会做滚动摘要；对话问答还会把文本转成 embedding 写入 Redis 向量索引，检索相似历史后注入 prompt。提醒功能落 MySQL，浏览器每五秒轮询到期消息。当前版本编译通过，但真实启动仍依赖数据库、Redis、模型 API 和本地 CLIP 环境；SSE 流式接口在代码中还没有真正实现。”

## 3. 当前真实入口：网页到底走哪条链

### 3.1 网页访问链

登录后访问 `/chat`，`PageController` 先检查 `HttpSession` 中的 `user`，通过后转发到静态 `chat.html`。页面在 `localStorage` 生成 `animeConversationId`，这个 ID 不是服务端生成的用户会话对象，而是浏览器侧的字符串。

### 3.2 网页文本聊天：现在确实会调用 `@Tool`

```text
chat.html
  -> POST /api/ai/chat-with-tools
  -> AiController.chatWithTools
  -> SpringAiChatService.chatWithTools
  -> ToolCallingService.chatWithTools
  -> LlmService.chatWithTools
  -> DeepSeek-compatible /chat/completions
  -> 解析 tool_calls
  -> 反射执行 @Tool 方法
  -> role=tool 回传 LLM
  -> 最终 JSON 返回网页
```

证据在 `chat.html` 的 `send()`：没有图片时请求 `/api/ai/chat-with-tools`；`AiController` 的 `/chat-with-tools` 会调用 `ToolCallingService`。所以当前网页不是“只有普通 LLM 聊天”。

但要准确说：当前主链路使用的是**自定义 Function Calling 编排器**，并不是 Spring AI 自动把 `@Tool` 注册成回调。代码只是利用 Spring AI 的 `@Tool`、`@ToolParam` 注解读取名称、描述和参数，然后由 `ToolCallingService` 反射生成 schema、自己执行循环。

### 3.3 网页图片：不经过 Agent 工具循环

```text
chat.html 上传图片
  -> POST /api/ai/analyze-image
  -> AiController.analyzeImage
  -> AnimeImageRecognitionService.recognize
  -> trace.moe / AniList / 本地 CLIP / VisionService
  -> DashScope 视觉模型
  -> 返回识别结果
```

这是专用识图服务，不是 `@Tool`。当前页面如果“图片 + 文本”一起发送，JavaScript 只把图片发给 `/analyze-image`，附带文字不会一并传给后端；不要把当前网页描述成已经支持完整的图文联合对话。

### 3.4 `/api/ai/chat` 和旧代码的定位

- `/api/ai/chat` 也会调用 `chatWithTools`，但网页当前没有调用它。
- 最近动漫电影问题在两个 Controller 入口中都有提前分支，直接调用 `AnimeService.getRecentAnimeMoviesAniList`，不一定进入 Agent 循环；接口返回的 `toolsUsed=1` 是业务统计口径，并不代表真的执行了一个注册工具。
- `SpringAiChatService.chat()` 是普通 `ChatModel.call` 路径；当前网页不走它。
- `SpringAiChatService.chatWithToolsStream()` 只返回 `Stream mode not yet implemented.`，当前没有真正 SSE。
- `agent.AgentService` 和 `router.MessageRouter` 是旧的多模态/路由体系，当前没有 Controller 调用它们。它们存在于工程中，但不能作为网页当前主链路来讲。

## 4. Agent 工具调用：面试重点

### 4.1 工具注册

`ToolCallingService` 构造时扫描三个对象：

- `SpringAiTools`：23 个工具，覆盖时间、天气、网页搜索、番剧搜索、电影、季度番、角色、地图、购票、提醒、播放链接、关系和推荐。
- `AnimeLifestyleTools`：5 个工具，覆盖主题餐厅、漫展情报、周边商城、漫展行程、跨媒体游戏推荐。
- `WeatherService`：当前没有 `@Tool` 方法，因此扫描结果为 0。

源码统计当前共 28 个 `@Tool` 方法。注册信息放到 `LinkedHashMap<String, ToolInfo>`，`ToolInfo` 保存目标对象、反射方法和注解。

### 4.2 schema 如何生成

`buildToolsSchema()` 将每个注解方法转换为：

```json
{
  "type": "function",
  "function": {
    "name": "getWeather",
    "description": "Query real-time weather for a city",
    "parameters": {
      "type": "object",
      "properties": { "city": { "type": "string" } },
      "required": ["city"]
    }
  }
}
```

参数名来自 Java 反射的 `Parameter.getName()`，因此 `pom.xml` 中打开了编译器 `-parameters`。`@ToolParam` 提供描述和 required 标记。当前 schema 只粗略区分 string/integer/number/boolean/array/object，没有把日期格式、枚举、最大值等约束完整表达给模型。

### 4.3 ReAct / Function Calling 循环

当前循环最多五轮：

1. 组装 system prompt、运行时 conversationId、RAG 结果和对话历史。
2. 把 28 个工具 schema 放进请求，`tool_choice=auto`。
3. 调用 LLM。
4. 如果返回 `message.tool_calls`，先把 assistant 的 tool call 消息加入历史。
5. 同一轮的多个工具调用提交到固定线程池，单个 Future 最多等待十秒。
6. 每个结果转成 `role=tool`，带原 `tool_call_id`，加入消息列表。
7. 再请求 LLM，让它根据工具结果生成最终答案或继续调用工具。
8. 没有 tool call 时取 `message.content` 结束；如果最终文本为空，则取最后一次成功工具结果作为兜底。

这是典型的“模型决策、代码执行、结果回填、模型总结”闭环。工具本身不应该直接决定最终自然语言答案，只负责返回结构化或可读的业务事实。

### 4.4 工具分类与调用示例

```text
“北京今天的天气”
  -> getWeather(city=北京)

“搜索《某番》的评分和播放入口”
  -> searchAnime / getAnimeWatchLinks

“我在杭州，最近有什么漫展”
  -> searchAnimeEventsChina(city=杭州, keywords=最近...)

“某电影上映当天提醒我”
  -> getRecentAnimeMovies 或 searchAnimeMovie
  -> 缺少日期时追问
  -> createAnimeReminder(conversationId, title, date, time)

“推荐周边”
  -> recommendAnimeMerchandise
  -> 返回本地商城 productId 链接
```

### 4.5 当前实现的真实风险，以及被追问时怎么答

1. **工具参数解析风险**：`parseToolCalls()` 直接读取 `function.arguments` 为 `JSONObject`。OpenAI-compatible 协议中它通常是 JSON 字符串；生产实现应同时兼容字符串和对象，并在解析失败时返回可重试的工具错误，而不是默默使用空参数。

2. **线程上下文风险**：请求线程设置了 `UserContextHolder` 的 conversationId，但工具实际在线程池执行，普通 `ThreadLocal` 不会自动传递。当前提醒工具把 conversationId 作为显式参数，所以还能工作；真正依赖 `UserContextHolder` 的工具会有上下文丢失风险。生产做法是任务提交时显式携带上下文，或使用任务装饰器/Context Propagation。

3. **错误恢复不足**：单次工具异常会让循环退出，没有针对超时、参数错误、限流的分类重试。生产应采用有限重试、指数退避、熔断和 fallback，并给模型返回规范化的错误结构。

4. **迭代统计不准确**：返回的 `totalIterations` 使用 `history.size()`，它统计的是工具调用数量，不是 LLM 循环轮数。应单独记录 `i + 1`。

5. **工具白名单边界**：请求传入的 `allowedTools` 经过过滤后，如果全部是未知名称，结果为空，Controller 又将空集合转成“开放全部工具”的语义。生产应区分“未传白名单”和“传了但全部非法”，非法直接返回 400。

6. **强制业务路由**：漫展问题强制只开放 `searchAnimeEventsChina`，且单工具集合执行一次后清空 tools，能防止模型重复搜索或跑偏；代价是该类问题不能在同一 Agent 回合继续自动调用天气、地图和餐厅，需要用户下一轮选择活动再规划行程。这是一个可以解释的安全与可控性取舍。

7. **Prompt 注入**：RAG 内容、第三方搜索结果和用户文本都会进入模型上下文，生产系统需要把外部内容标记为不可信数据，限制其改变系统规则；工具参数也要做白名单校验，不能仅依赖模型。

### 4.6 “Spring AI 的 @Tool 是怎么工作的？”标准答案

> “在标准 Spring AI 用法里，可以把带 `@Tool` 的方法交给 ChatClient/ToolCallback 机制，由框架负责 schema 和回调；当前这个项目没有走完整的自动回调链。当前实现把 `@Tool` 当作元数据入口，自己反射扫描，自己生成 OpenAI function schema，LLM 仍然通过 `LlmService` 直接请求兼容 OpenAI 的 `/chat/completions`，收到 tool_calls 后再反射执行。因此项目同时用了 Spring AI 的注解和自定义 Agent 编排器，两者不能混为一谈。”

## 5. Embedding、记忆和 RAG

### 5.1 Embedding 是什么

Embedding 就是把一段文字转换成一串浮点数向量。语义相近的文本，在向量空间里的距离通常更近；所以“我想看热血番”和“推荐战斗类动漫”即使字面不同，也有机会检索到相近内容。

它不是生成答案，也不是关键词搜索。典型 RAG 流程是：

```text
文档/历史对话 -> embedding -> 向量库
用户问题      -> embedding -> 相似度检索 -> 相关片段 -> prompt -> LLM
```

### 5.2 当前代码声称做了什么

`EmbeddingService` 调用 DashScope-compatible `/embeddings` 接口，模型名是 `text-embedding-v2`，返回 `float[]`。`ToolCallingService` 在有 conversationId 时先调用 `VectorStoreService.searchSimilar()`，把最多三条结果拼到 `# Relevant Knowledge (RAG)` 中，再交给 Agent。

保存时把“用户问题 + 助手回答”拼成一条文本，写入 Redis Hash：

```text
key: vec:<uuid>
fields: vector / content / conversation_id / timestamp
```

理论上通过 RedisSearch 的 `FT.CREATE` 和 `FT.SEARCH` 做 KNN；代码设定 `FLAT`、`FLOAT32`、L2 距离、topK 默认 3。

### 5.3 当前版本不能过度宣传的地方

- `VectorStoreService` 的注释仍写“基于 SQLite”，但实际依赖是 Redis；README 还写 `rag_knowledge.sqlite`，当前主路径没有引用这个文件。
- 当前配置默认 MySQL，不是 README 所说的 H2；SQLite 代码在 `sqlite` profile 下，默认不启用。
- Redis 向量索引维度硬编码为 1024，应该与实际 embedding 模型维度动态一致，否则写入或检索可能失败。
- 向量保存为文本形式的 `[0.1,...]`，而 RedisSearch 的 FLOAT32 向量字段通常应写入二进制浮点字节；这是当前实现需要重点验证的兼容性风险。
- `searchSimilar(query, conversationId)` 的查询没有把 conversationId 加入过滤条件，可能检索到其他会话的向量，存在隐私和相关性问题。
- `similarityThreshold` 字段当前没有参与结果过滤。
- 当前代码中主 Agent 会显式保存向量；旧的 `LlmService.chatWithMemory` 还有异步保存路径，且事件监听器存在但没有发现当前事件发布调用。不能说已经实现了完整事件驱动向量入库。

### 5.4 生产化回答

> “如果上线，我会把向量维度作为 embedding provider 的配置或启动时探测结果，使用 `ByteBuffer` 写标准 FLOAT32 二进制，向量检索增加 conversation/user 过滤，并使用 HNSW 或托管向量数据库。RAG 结果要保留 source、score、tenant/userId 和时间，先做阈值过滤，再注入模型；同时做 prompt injection 隔离和离线检索评估，不能只凭主观感觉说‘能召回’。”

## 6. 动漫图片识别：项目最有辨识度的技术点

### 6.1 主流程

```text
data:image/...;base64,...
  -> Base64 解码
  -> trace.moe 反向识图
  -> 相似度 >= 0.82 ?
       是：拿 AniList 作品 ID
       否：标题识别 -> 本地 CLIP -> 近三年标题目录 -> 当前目录 -> 跨年代候选
  -> AniList 查询作品和最多 12 个角色候选图
  -> DashScope Vision 对主图与候选图做视觉比对
  -> 输出角色、番剧、置信度、依据和其他候选
```

### 6.2 为什么不是一次视觉模型调用

直接问视觉模型“这是谁”容易出现幻觉，尤其是同人图、相似发型和非主流作品。当前设计把识别拆成两段：

1. **作品级检索**：尽量先把候选作品空间缩小。
2. **角色级验证**：从 AniList 拉真实角色名、别名、角色定位和图片，要求模型在受限候选中比较发型、瞳色、服装、脸部特征和配饰。

这是“检索候选 + 多模态重排/验证”，比让模型在全世界动漫角色中自由猜更容易控制错误。

### 6.3 降级顺序与阈值

- trace.moe 的可靠阈值：相似度 `0.82`。
- trace.moe 不可靠时，先让视觉模型读取图片中可见标题，再查 AniList。
- 本地 CLIP 服务运行在 `127.0.0.1:8095`，由 Java 启动 Python `tools/anime_index.py`；索引是角色图片 embedding，按动漫 ID 聚合最高分，并要求最佳分数至少 `0.73`、与第二名差距至少 `0.015`。
- 近三年目录识别要求置信度至少 `85`。
- 当前目录识别要求置信度至少 `80`。
- 跨年代候选验证要求置信度至少 `85`。
- 没有可靠结果时返回“无法可靠确认”，不强行给答案。

### 6.4 本地 CLIP 怎么讲

Python 脚本用 ONNX Runtime 加载视觉模型，把角色参考图预处理为 224×224，归一化后得到 embedding，保存到 `data/anime-index/vectors.npy`，同时保存角色和作品元数据 `metadata.json`。服务启动后，收到图片就计算 query vector，与索引做点积，返回 top-k 角色匹配。

当前脚本明确使用 `CPUExecutionProvider`；README 关于 CUDA 的描述不能直接当成当前已启用能力。可以说“保留 ONNX Runtime 扩展空间，当前脚本实际走 CPU”。

### 6.5 识图被追问时的取舍

**为什么 trace.moe 先行？**

它对正片截图有强先验，能直接提供作品 ID、集数、时间点，减少后续候选空间；但对同人图、裁剪图、非正片素材不一定可靠，所以必须有降级。

**为什么用 AniList？**

它提供统一 GraphQL 数据模型，能同时拿作品标题、角色、角色图、作品关系和 streaming links；Jikan 则作为旧 REST 数据源和 fallback。

**怎么控制幻觉？**

让模型只从候选中选、输出固定格式、校验 ID 必须属于候选、设置置信度阈值、核心特征冲突时选 NONE，并保留“无法确认”出口。

**缺点是什么？**

外部 API 延迟和限流会叠加；候选图片质量会影响比对；top-1 trace.moe 可能把错误作品带入后续；本地索引服务是进程内启动的单机依赖；需要缓存、超时、重试、指标和离线测试集。

## 7. 漫展、实时信息和业务工具

### 7.1 漫展情报工具

`searchAnimeEventsChina` 调用 `AnimeEventService.searchIntelligence`，当前组合了：

- 云漫展页面的 HTML 行解析：日期、场馆、票价、状态。
- Bilibili 搜索接口：活动、嘉宾、延期、票务等线索。
- Bilibili 用户搜索：尝试识别主办方账号和认证信息。
- B 站、微博、抖音、小红书等搜索入口链接。

它明确区分“结构化来源”和“待用户打开核验的搜索线索”，没有把社交平台搜索结果伪装成官方公告。没有确认日期时返回“尚未官宣”，Controller 还会清理“大概率”“按照往届”“预计”等推测性句子。

### 7.2 这个工具的生产风险

HTML 正则解析很容易因页面结构变化失效；第三方聚合站不等于官方来源；Bilibili 可能限流；多个实时请求会拉长尾延迟。上线应优先接稳定官方/票务 API，保留 source、抓取时间、来源等级，设置缓存和熔断，结果中展示“最后核验时间”。

### 7.3 提醒链路

```text
LLM tool createAnimeReminder
  -> ReminderService
  -> MySQL reminder 表
  -> 浏览器每 5 秒 GET /api/reminders/pending?conversationId=...
  -> 查询到期且 sent=false 的记录
  -> 标记 sent=true
  -> 返回 messages
  -> 页面展示，并在浏览器权限允许时 Notification
```

它不是服务端主动推送，也不是可靠的任务投递系统。浏览器页面关闭时无法把消息推到用户；`@Scheduled` 每五秒的任务只是统计待发送数量和打日志，真正交付仍靠前端轮询。

## 8. 记忆、缓存和数据层

### 8.1 对话短期记忆

`ChatMemoryService` 从 `ChatMemoryRepository` 读取消息，按 system/user/assistant 组成 prompt。当前配置是最多 10 条消息、最多 2000 个估算 token，超过阈值后保留最近消息，并让 LLM 生成滚动摘要。

### 8.2 Redis + MySQL 策略

`ChatMemoryConfig` 把：

```text
RedisChatMemoryRepository
  + DatabaseChatMemoryRepository
  -> CachedChatMemoryRepository（@Primary）
```

Redis key 前缀是 `chat:memory:`，默认 TTL 24 小时；MySQL 表是 `conversations` 和 `messages`。读 Redis 为空时回源 MySQL，再回填 Redis；写入先 Redis，数据库失败后会把 `databaseAvailable` 全局置为 false，后续请求长期只走 Redis/内存，这个降级策略需要更精细的恢复探测。

### 8.3 真实安全边界

当前聊天 Controller 没有把 HttpSession 用户名绑定到 conversationId；conversationId 由浏览器生成并直接传入，提醒和记忆主要按 conversationId 隔离。生产必须服务端生成会话 ID，并建立 `userId -> conversationId` 的归属校验，否则知道会话 ID 的请求可能读取或操作别人的数据。

## 9. 认证和 Web 层

- 注册：BCrypt 哈希密码后写用户表。
- 登录：校验 BCrypt，成功后把用户名放进 HttpSession。
- `/chat` 页面入口检查 session。
- `WebConfig` 暴露 `/uploads/**` 静态文件。
- CORS 当前是 `allowedOrigins("*")`，上线不应保持全开放。
- `AiController` 本身没有看到基于 session 的用户鉴权，前端的页面保护不能代替 API 鉴权。

被问“为什么不用 JWT”时可以答：

> “当前是单体网页应用，HttpSession 足够简单；如果拆分前后端或多实例部署，我会切换成带过期时间和刷新机制的 token，并配合 Redis/session store。无论选哪种，都要把认证用户绑定到 conversationId 和工具副作用，不能相信前端传来的 ID。”

## 10. 技术栈和合理解释

| 技术 | 当前用途 | 面试解释 |
|---|---|---|
| Java 21 | 后端语言 | records、现代 HTTP Client、长期支持版本生态 |
| Spring Boot 3.5.x | IoC、Web、JPA、调度 | 组件化和配置管理 |
| Spring AI 1.0.x | ChatModel、AI 注解生态 | 当前工具主循环仍是自定义实现 |
| Spring MVC/WebFlux | Controller + WebClient 自动配置 | 当前网页返回同步 JSON，不是 SSE |
| JPA/MySQL | 用户、消息、提醒、商城实体 | 事务和持久化 |
| Redis/Lettuce | 会话热缓存、向量索引 | 降低历史读取延迟，但需解决可用性和一致性 |
| DashScope | embedding、视觉模型 | 文本向量化和多模态识别 |
| DeepSeek-compatible API | Agent 文本决策 | 直接使用 OpenAI-compatible chat completions |
| AniList GraphQL | 动漫作品和角色知识 | 字段统一、实时查询、候选验证 |
| Jikan | REST fallback | 外部主数据不可用时降级 |
| trace.moe | 正片截图反向识图 | 先做作品级检索 |
| ONNX Runtime + Python | 本地 CLIP 角色索引 | 本地检索、减少完全依赖远端模型 |
| Amap、天气、猫眼、Bilibili | 业务实时工具 | 将答案落到地点、天气、购票和活动事实 |

## 11. 高频面试追问与答案

### Q1：你的 Agent 和普通聊天有什么区别？

普通聊天只有 `messages -> LLM -> content`。Agent 会给模型工具 schema，模型可以返回结构化 tool call；后端验证工具名和参数、执行实际业务、把结果回填，再由模型总结。核心是“决策和执行分离”，不是让模型自己假装查到了数据。

### Q2：为什么不用模型直接回答天气和上映日期？

这些信息时效性强，模型参数可能过期。系统 prompt 对实时问题要求使用工具，工具负责查事实，模型只负责解释和组织，减少幻觉。

### Q3：为什么一个请求可能调用多个工具？

因为工具之间有依赖。例如先识别作品，再查播放入口；先查电影，再根据用户地点查影院。独立工具可并行，存在依赖时必须分轮顺序执行。当前实现对同一轮 tool_calls 使用线程池并行。

### Q4：并行调用有什么坑？

共享上下文、数据库写冲突、限流和顺序都要考虑。当前工具池最多四个线程、单 Future 等待十秒；生产需传递 trace/user context、做隔离和超时取消，对有副作用的工具要幂等。

### Q5：RAG 和对话记忆有什么区别？

短期记忆按时间顺序保留最近对话，让模型理解上下文；RAG 按语义相似度找相关历史或知识片段，不要求它们相邻。一个解决“刚才说了什么”，一个解决“历史中哪些内容与当前问题相关”。当前实现主要把对话问答写成向量，知识库文档链路在当前默认配置里并不完整。

### Q6：向量相似度怎么选？

需要和 embedding 归一化方式、索引配置一致。当前意图使用 RedisSearch FLAT + L2；如果向量归一化，则 cosine 和 L2 有固定关系，但生产仍要统一 metric、维度、序列化格式，并用标注集评估 top-k、召回率和阈值。

### Q7：图片识别为什么设置“无法确认”？

识图错误比承认不确定更影响用户信任。当前用多个外部证据、候选约束、阈值和 NONE 输出降低误识；上线还要用真实截图、同人图、裁剪图建立评测集。

### Q8：如何保证工具安全？

工具分级：查询类可以自动执行，创建提醒/下单等副作用类需要确认；服务端校验用户身份、会话归属、参数范围和幂等键；外部搜索结果视为不可信文本；对每次调用记录 traceId、工具名、耗时、成功状态，但不能记录密钥和完整敏感内容。

### Q9：怎么解决模型重复调用、死循环？

限制最大轮数和每轮工具数，给工具结果加去重 key，记录已调用工具，针对同一参数命中缓存；达到上限返回可解释的部分结果。当前代码最大五轮，但“同一工具重复调用”的细粒度去重还可以增强。

### Q10：这个项目能不能直接上线？

> “当前更接近可演示版本，核心链路已实现，但我不会把它描述成无条件生产就绪。上线前至少要处理凭据外置与轮换、API 鉴权和会话归属、Redis 向量格式/维度、工具参数解析、SSE 或异步任务、外部 API 缓存限流、可观测性、测试数据集和隐私合规。”

## 12. 面试时不要说错的内容

| 不要说 | 更准确的说法 |
|---|---|
| 网页只走普通 LLM | 网页文本走 `/chat-with-tools`，进入自定义 Agent 工具循环 |
| Spring AI 自动执行所有 `@Tool` | 当前用 `@Tool` 做反射元数据，自定义循环负责 schema 和执行 |
| 图片识别也是一个 Agent 工具 | 当前图片走独立 `/analyze-image` 识图服务 |
| 已经 SSE 流式输出 | 当前前端等待完整 JSON，stream 方法是占位 |
| 用 SQLite 做当前 RAG | 当前向量实现写 Redis；README/注释有历史描述，需以工作树源码为准 |
| 已经接入微信 iLink | 当前工作树没有可达的 iLink 主链路，相关旧文件处于删除/遗留状态 |
| 提醒是服务端主动推送 | 当前是浏览器每 5 秒轮询，页面关闭不能交付 |
| 任何会话都和登录用户绑定 | 当前 conversationId 由前端生成，API 归属校验还不充分 |

## 13. 当前验证结果

- `mvnw -q -DskipTests compile`：通过，退出码 0。
- `mvnw -q test`：失败在唯一的 `contextLoads` 测试；日志显示 MySQL 连接成功，但 Spring WebFlux/Reactor Netty 创建子事件循环时出现 loopback selector 错误，Redis 连接也不可用。这个是当前环境/依赖启动验证问题，不是编译错误。
- 项目默认启动还依赖：MySQL、Redis、LLM/视觉/embedding 外部服务，以及本地 Python CLIP 环境。

## 14. 9 月 12 日到 14 日准备计划

### 9 月 12 日

1. 背速记卡里的 90 秒介绍和四条主链路。
2. 手写一次 Agent loop：schema → tool call → execute → role=tool → final answer。
3. 解释 embedding、短期记忆、RAG 的区别。
4. 记住当前三个硬事实：网页文本有工具调用、图片不进 Agent、没有真正 SSE。

### 9 月 13 日

1. 重点口述图片识别降级链路和阈值。
2. 重点口述 Redis/MySQL、一致性、会话归属和提醒轮询。
3. 用“当前实现风险 + 生产改法”回答十个追问。
4. 不要临时把旧 AgentService、README 的 SQLite 或截图架构混进当前版本。

### 9 月 14 日面试前

只复习速记卡、项目 90 秒介绍、三个真实缺口和两个你能深入讲的亮点：自定义工具循环、候选约束式动漫识图。回答未知问题时回到“源码证据 + 取舍 + 生产改进”。

## 15. 2026-09-12 更新版源码复核

### 15.1 这次复核的结论

当前工作树不是一个干净的单一版本，而是包含大量已修改、删除和未跟踪文件的更新态。源码计数为 101 个 Java 文件、8 个静态 HTML 页面、1 个测试类；因此面试时应以当前工作树的可达入口为准，不要只照搬旧 README、截图或历史类名。

当前最稳的总判断是：

```text
网页文本 -> /api/ai/chat-with-tools -> ToolCallingService -> 自定义工具循环 -> 最终 JSON
网页图片 -> /api/ai/analyze-image -> AnimeImageRecognitionService -> trace.moe/AniList/本地 CLIP/视觉模型
记忆     -> Redis 热缓存 + MySQL 持久化
语义检索 -> Embedding -> Redis 向量索引
旧 Agent -> AgentService + BaseTool，仍在代码中，但不是当前网页文本主链
```

### 15.2 更新后必须修正的简历口径

1. **不要再说当前已经接入微信 iLink。** 当前工作树中 `ILinkMessageListener` 已删除，相关旧 SDK/class 文件也被删除；如果面试官看到简历里的微信能力，应该说它属于历史尝试或未纳入当前可达主链，不能说成现在稳定上线的入口。
2. **不要说网页聊天只是普通 LLM。** `chat.html` 的无图片发送明确调用 `/api/ai/chat-with-tools`，文本请求会进入工具选择、工具执行和结果回填循环。
3. **不要说 Spring AI 自动替你执行所有 `@Tool`。** 当前 `@Tool` 主要被扫描成元数据和 JSON Schema，真正的 `tool_calls` 解析、反射执行、并发、超时和迭代上限由 `ToolCallingService` 自己控制。
4. **不要说图片识别已经进入同一套 Tool Calling。** 当前网页图片直接调用 `/api/ai/analyze-image`，识图服务自己做反向检索、候选约束和视觉比对。
5. **不要说已经实现 SSE。** 当前网页使用 `fetch` 等待完整 JSON；`chatWithToolsStream()` 仍返回占位提示，不能把它讲成已经上线的流式输出。
6. **不要把 SQLite 说成当前 RAG 存储。** 当前向量代码使用 Redis，`SQLiteConfig` 是 profile 配置，README 中的 SQLite 描述与当前主路径不完全一致。

### 15.3 更新后的网页文本请求，逐行怎么讲

面试官如果问“用户发一句话以后发生什么”，可以按下面顺序回答：

1. 页面生成或读取 `conversationId`，向 `/api/ai/chat-with-tools` 发送 `message + conversationId`。
2. Controller 对动漫电影、漫展等部分意图做特殊处理；普通请求交给 `SpringAiChatService.chatWithTools`。
3. `ToolCallingService` 先取历史消息，再按 `conversationId` 做相似记忆检索，把召回内容拼进本轮上下文。
4. 服务把 `@Tool` 方法的名称、描述和参数描述构造成工具 Schema，调用兼容 OpenAI Chat Completions 的大模型接口。
5. 如果模型返回 `tool_calls`，服务解析函数名和参数，通过反射定位注册工具；同一轮多个工具调用会提交到固定线程池并行执行，单个 Future 最多等待 10 秒。
6. 工具结果以 `role=tool` 和对应 `tool_call_id` 回填消息，再次请求模型生成自然语言答案；最多 5 次循环。
7. 最终结果返回网页 JSON，并保存聊天记忆和向量记录。

一句话版：

> “当前网页文字不是直连普通聊天，而是一个自定义的 Function Calling Agent；Spring AI 的 `@Tool` 负责声明工具能力，我自己的服务负责 Schema、循环、反射执行、并发、超时和结果回填。”

### 15.4 更新后最容易被追问的 6 个问题

**问：为什么图片没有复用工具调用？**

答：图片入口需要处理 Base64 解码、trace.moe 反向检索、AniList 候选拉取、本地 CLIP 降级和视觉模型多图比对，它是一个有明确候选约束的长链路。当前把它做成专用服务更容易控制超时和识别置信度；如果要统一架构，可以在 Agent 层把“识图”注册成异步工具，但上传和长耗时任务仍建议独立任务化。

**问：既然用了 Spring AI，为什么不直接让框架执行工具？**

答：当前实现需要统一控制工具白名单、漫展问题的强制工具、同轮并发、每工具 10 秒超时、最多 5 轮和 trace，所以选择保留 Spring AI 的模型/注解能力，自己实现执行编排。代价是要自己兼容参数格式、错误重试和安全校验。

**问：工具调用失败怎么办？**

答：当前单次执行异常会转成工具结果或中断本轮循环，整体没有成熟的重试/熔断/降级体系。生产版会给工具定义幂等性，按错误类型做有限重试，对外部 API 使用超时、限流、熔断和缓存，并把失败原因映射成用户可理解的答案。

**问：记忆和 RAG 是不是一回事？**

答：不是。Redis/MySQL 保存的是会话消息，解决“最近聊过什么”；Embedding 把对话转成向量，再按语义相似度召回历史，解决“以前有没有相似内容”。当前代码已经有两条能力，但向量二进制格式、会话过滤和失败降级仍需生产化校验。

**问：登录后会话是否安全隔离？**

答：页面受 Session 保护，但 AI API 的 `conversationId` 由前端生成，当前没有在每次请求中严格校验“会话属于当前登录用户”。这是上线前必须补的授权边界：服务端从认证上下文取得 userId，查询会话归属后才能读写记忆、提醒和向量。

**问：当前能不能说已经上线？**

答：更准确地说是“当前版本可以编译和演示，具备主要业务链路；距离生产上线还要补安全配置、会话鉴权、向量实现验证、外部 API 稳定性、真正流式输出和可观测性”。本次复核中 `mvnw -q -DskipTests compile` 通过；完整测试仍受本机 Redis/网络事件循环环境影响，唯一 `contextLoads` 没有通过。

### 15.5 面试时的更新版 60 秒项目介绍

> “这是一个 Java 21 + Spring Boot + Spring AI 的动漫 AI 助手。当前网页文字请求进入自定义 Tool Calling Agent：我扫描 `@Tool` 方法生成 JSON Schema，把会话记忆和语义召回结果拼进上下文，再调用兼容 Chat Completions 的模型；模型返回工具调用后，我通过反射执行工具，同轮工具并发执行，单工具 10 秒超时，最多 5 轮，并把 `role=tool` 结果回填给模型生成最终答案。工具覆盖动漫检索、电影、天气、地图、漫展、商品和提醒。图片请求没有硬塞进同一循环，而是走专用识图链：trace.moe 优先，AniList 反向约束，本地 CLIP 和视觉模型降级。记忆采用 Redis 热缓存加 MySQL 持久化，另外用 Embedding 做语义召回。当前需要继续生产化的点是 API 会话归属、向量字段校验、外部服务稳定性和真正 SSE 流式输出。”

这段介绍的价值在于：每个数字和判断都能落到当前源码入口，不会把旧 iLink、旧 SQLite 或未实现的 SSE 说成已上线能力。
