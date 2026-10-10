# AnimeAI 项目简历口径与源码对齐续篇

## 这份续篇解决什么问题

简历把项目描述成“多模态 AI 智能助手平台”，当前 `memory-14` 工作树则明显更新成了“动漫 AI 助手”。两者不是完全矛盾，而是存在旧执行引擎、当前动漫业务引擎和历史模块并存的情况。

面试时最危险的不是不会背名词，而是把不同版本的实现拼成一条不存在的链路。本篇给出三种口径：

1. 简历为什么这样写。
2. 当前源码能证明什么。
3. 面试时如何既完整又不说过头。

## 一、简历内容拆解

### 1. 简历上的目标岗位

简历定位是 Java 后端开发 / AI 应用开发，实习项目名称是“多模态 AI 智能助手平台”。因此面试官大概率会从以下方向深挖：

- Java 并发、反射、线程池和超时控制。
- Spring Boot 分层、REST 接口、JPA、MySQL、Redis。
- Agent、Function Calling、工具注册、上下文记忆、RAG、Embedding。
- 图片、文件、语音等多模态输入输出。
- 认证、安全、上传校验和外部 API 稳定性。

当前项目的动漫模块可以作为具体业务场景，旧 Agent 模块可以作为平台化能力来源。回答时要先说“当前网页主链路”，再补充“历史/兼容执行引擎”。

### 2. 简历第一条：多模态 Agent 执行链路

简历写的是：

```text
System Prompt 规划
  -> 意图识别
  -> Function Calling
  -> 工具结果回填
  -> 最终响应
```

当前工作树中，这句话主要对应 `agent.AgentService`：

```text
runAgent(conversationId, userMessage, fileInfo)
  -> buildContextMessages
  -> buildToolsSchema
  -> LLM chatWithTools
  -> ToolCall.parseToolCalls
  -> BaseTool.execute
  -> role=tool 结果回填
  -> 最多 3 轮
  -> 最终 AgentResult
```

它能对上的具体参数是：

- `MAX_ITERATIONS = 3`：最多三轮。
- `TIMEOUT_SECONDS = 30`：外层异步 Agent 最多等待 30 秒。
- `PROGRESS_NOTIFY_SECONDS = 10`：超过 10 秒时通过回调通知进度。
- `consecutiveErrors >= 2`：同一次 Agent 执行里连续两次 LLM 返回异常或空响应时终止。

这里要纠正简历中“连续失败熔断”的说法：当前代码实现的是**单次请求内的连续错误终止**，不是跨请求、带半开状态和恢复探测的完整熔断器。面试官如果追问，可以主动说出这个边界。

### 3. 简历第二条：双层工具体系

简历写的是：

```text
统一 BaseTool 注册 9 类文件/图像/语音/搜索/天气工具
  + Spring AI @Tool 接入 23 个业务动作
```

当前源码可以还原成两个并存的执行引擎：

| 引擎 | 代表类 | 当前源码事实 | 当前网页是否直接使用 |
|---|---|---|---|
| 旧版通用多模态引擎 | `AgentService` + `BaseTool` | 7 个可直接确认的 `BaseTool` 实现，含文件、图片分析、图片生成、图片编辑、搜索、TTS、天气 | 否，当前没有 Controller 调用 `runAgent` |
| 当前动漫业务引擎 | `ToolCallingService` + `@Tool` | 23 个 `SpringAiTools` + 5 个 `AnimeLifestyleTools`，共 28 个 `@Tool` | 是，网页文本走 `/api/ai/chat-with-tools` |

因此“9 类”和“23 个”更像旧版本或按能力分类的简历口径；当前工作树直接统计是 7 个 BaseTool 实现和 28 个 `@Tool` 方法。面试时不要强行说两个数字都同时精确存在，建议说：

> “平台经历过从通用 BaseTool 到动漫业务 `@Tool` 的演进。旧引擎按多模态能力注册工具，当前网页主链路已经切到自定义的 `ToolCallingService`，它反射扫描 Spring AI 注解并注册动漫业务工具。早期简历统计是 23 个业务动作，当前更新版增加了 5 个动漫生活工具，所以源码里现在能看到 28 个。”

### 4. 简历第三条：多级对话记忆与 RAG

简历写的是 Redis、MySQL、内存三类仓库，以及缓存优先、数据库持久化和不可用降级。当前源码有对应实现：

```text
ChatMemoryRepository
  ├─ RedisChatMemoryRepository
  ├─ DatabaseChatMemoryRepository
  ├─ InMemoryChatMemoryRepository
  └─ CachedChatMemoryRepository（@Primary）
       ├─ Redis 优先
       └─ Redis 不可用或无数据时回源 MySQL/内存
```

记忆限制来自 `ChatMemoryService`：

- 最多保留 10 条消息。
- 估算 token 上限 2000。
- 超过摘要阈值后，保留最近 5 组消息并生成滚动摘要。
- Redis 会话 key 前缀为 `chat:memory:`，默认 TTL 24 小时。

RAG 当前主路径是：

```text
用户问题
  -> EmbeddingService 调用 embedding API
  -> VectorStoreService 写入 Redis 向量 Hash
  -> 新问题向量检索
  -> 取最多 3 条相关结果
  -> 注入 # Relevant Knowledge (RAG)
  -> Agent 调用 LLM
```

但要注意：当前默认路径主要把**历史问答**向量化；README 提到的 `rag_knowledge.sqlite` 在当前主路径中没有被引用，SQLite 代码也处于 profile 分支。面试官问“知识库文档怎么入库”时，不要假装当前已经有完整的文档切片、批量 embedding 和知识库管理流程，应回答“当前实现重点是会话历史语义召回，文档知识库接入还需要补齐”。

### 5. 简历第四条：平台工程化交付

简历写 11 个 Web 控制器。当前工作树直接可见的 Controller 类是 7 个：

```text
AiController
AuthController
FileController
ProductController
CategoryController
MovieReminderController
PageController
```

因此“11 个”大概率来自更完整的旧版本、合并统计或曾经存在的控制器。安全说法是：

> “平台按 AI、认证、文件、商城、提醒和页面入口拆分 Controller；当前更新版能直接确认 7 个 Controller 类，历史版本统计口径更大。”

简历写的 7 类文件则能被当前 `FileParserService` 直接对上：

```text
txt / md / json / csv / log / pdf / docx
```

解析实现分别使用 UTF-8、PDFBox、Apache POI。需要注意，`FileController /process` 的图片/文本生成和 `FileController /qa` 的文件问答是两套行为；不是所有文件都自动进入当前网页动漫聊天 Agent。

## 二、双执行引擎深挖

### 1. 旧版 BaseTool 引擎

旧引擎的优点是工具接口统一：

```java
public abstract class BaseTool {
    public abstract String getName();
    public abstract ToolDefinition getDefinition();
    public abstract ToolResult<?> execute(JSONObject params);
}
```

`AgentService` 构造时接收 `List<BaseTool>`，放进 `ConcurrentHashMap`。它可以同时支持：

- `analyzeFile`：解析文件并交给模型处理。
- `analyzeImage`：视觉分析。
- `generateImage`：图片生成。
- `editImage`：图片编辑。
- `synthesizeSpeech`：语音合成。
- `webSearch`：网络搜索。
- `getWeather`：天气查询。

旧引擎还做了多模态补全：例如图片分析/编辑缺少 `userId` 时用 conversationId 补入，文件工具缺少 fileUrl/fileName 时尝试从 fileInfo 提取。这种设计说明 Agent 上下文不仅是用户文本，还包括文件和图片元数据。

旧引擎的执行逻辑可以这样答：

> “先把文件信息和用户问题合成 effectiveMessage，再加载对话上下文和工具 schema。每轮调用 LLM，如果有 tool call 就执行并回填工具消息；如果没有就结束。外层用 CompletableFuture 控制 30 秒总等待，单次执行内部最多三轮，连续两次 LLM 异常就终止。”

### 2. 当前动漫 `@Tool` 引擎

当前网页文本使用的是 `ToolCallingService`，不是旧 `AgentService`：

```text
AiController.chatWithTools
  -> SpringAiChatService.chatWithTools
  -> ToolCallingService.chatWithTools
  -> LlmService.chatWithTools
```

它的变化是：

- 工具声明写在普通 Spring Service 方法上。
- `@Tool` 提供工具名和描述。
- `@ToolParam` 提供参数描述和 required。
- 运行时反射生成 function schema。
- 同一轮多个 tool call 使用 CompletableFuture 在线程池中并行。
- 最多五轮，单个 Future 最多等待十秒。
- 返回 `ToolCallResponse`，包含文本、调用历史、生成文件、token 和 traceId。

### 3. 为什么要两个引擎

合理解释是“平台演进”，而不是“两个引擎串起来一起跑”：

1. 旧 `BaseTool` 适合文件、图片、TTS 等通用多模态动作，接口结构清晰，便于统一结果和异常。
2. 新 `@Tool` 适合动漫领域业务快速扩展，开发者只需要给 Service 方法加注解，就能生成工具 schema。
3. 当前网页已切到动漫场景的专用 Agent，旧引擎仍作为历史能力和兼容代码存在。
4. 真正生产化时会统一成一个 Tool Registry，保留通用工具接口，并把工具元数据、权限、超时、幂等性和执行器配置独立出来。

面试官问“这是不是重复建设”时，可以答：

> “是演进过程中形成的重复能力，当前主链路已经有明确归属，但长期应该收敛。收敛时不会简单删除旧引擎，而是把 BaseTool 的结果封装、异常处理和多模态上下文能力抽成公共层，再让 Spring AI ToolCallback 或统一 registry 负责声明和执行。”

## 三、简历技术点逐项可背答案

### Java 反射

> “我使用反射扫描带 `@Tool` 的方法，把注解里的 name、description 和参数元数据转换成 JSON Schema。执行时根据工具名找到目标对象和 Method，再将 JSON 参数转换为 Java 基本类型并 invoke。为了让参数名可被反射获取，编译器打开了 `-parameters`。生产里会减少任意反射调用，增加类型校验、权限校验和异常解包。”

### CompletableFuture 和线程池

> “同一轮中模型可能返回多个相互独立的工具调用，例如多个查询，我用 CompletableFuture 提交到固定线程池并行执行，减少总延迟；每个 Future 设置十秒等待。存在依赖关系的工具不应盲目并行，应该让模型分轮，或者由编排器维护依赖图。带副作用的工具还需要幂等键。”

### 超时和降级

> “旧 Agent 是 30 秒总超时、三轮上限和单次执行内两次连续错误终止；当前动漫工具编排器是五轮上限、单工具 Future 十秒。外部 API 失败时动漫数据有 AniList/Jikan 或 webSearch 的 fallback，图片识别按 trace.moe、标题、CLIP、目录、跨年代候选逐级降级。”

### Redis 缓存优先

> “读路径先 Redis，命中就直接返回；未命中回源 MySQL，并回填 Redis。写路径同时更新 Redis 和 MySQL，Redis 通过 TTL 控制短期会话生命周期。当前代码还有内存兜底，但生产需要解决多实例一致性、并发追加丢失、故障恢复探测和用户归属校验。”

### BCrypt

> “密码不保存明文，而是使用 BCrypt 生成带随机 salt 的单向摘要，登录时用 matches 校验。Session 只保存登录用户名，当前接口还需要进一步把认证用户绑定到 conversationId，不能把前端传入的 conversationId 当作身份认证。”

### 文件问答

> “FileParserService 根据扩展名选择 UTF-8 文本解析、PDFBox 或 Apache POI DOCX 解析，再把文本拼进问答 prompt。当前文件问答是直接把解析结果发给 LLM，不等于已经完成了大文档切分、向量入库和基于引用的 RAG。生产要加大小/类型/内容安全校验、分块、异步任务和 source 引用。”

## 四、面试官可能抓住的简历矛盾

| 简历表述 | 当前源码核对 | 面试安全口径 |
|---|---|---|
| 9 类 BaseTool | 当前可直接确认 7 个具体实现，包含 WeatherTool | 9 是能力分类或旧版本统计；当前源码以 7 个实现为证据 |
| 23 个 `@Tool` | 当前 23 个 `SpringAiTools` + 5 个 `AnimeLifestyleTools` | 旧版 23，更新版现在 28 |
| 3 轮推理、30 秒超时 | 对应旧 `AgentService` | 只说旧通用 Agent；当前动漫工具服务是 5 轮，没有相同的外层 30 秒控制 |
| 连续失败熔断 | 只有单次执行内连续两次错误终止 | 不称为完整熔断器，说明生产改进方向 |
| 异步事件更新摘要和向量 | 有事件类和监听器，但当前未找到事件发布调用；主路径有显式向量保存 | 说“保留异步监听结构/部分路径异步”，不要说全链路已经事件驱动 |
| 11 个 Web 控制器 | 当前可见 7 个 Controller 类 | 11 是旧版或统计口径差异 |
| SQLite RAG 知识库 | 当前默认是 MySQL，向量服务写 Redis；SQLite profile 默认不启用 | README 过时，当前主路径是会话历史向量召回 |
| 宠物/植物护理 | 当前源码核心业务是动漫；旧通用模块中没有对应当前网页入口证据 | 说明项目由通用助手演进到动漫助手，别把旧业务说成当前网页能力 |

## 五、如果面试官让你画架构图

```text
                         ┌──────────────────────┐
                         │  登录网页 chat.html   │
                         └──────────┬───────────┘
                                    │
                 ┌──────────────────┴──────────────────┐
                 │                                     │
        文本 /api/ai/chat-with-tools              图片 /api/ai/analyze-image
                 │                                     │
       AiController + SpringAiChatService       AnimeImageRecognitionService
                 │                                     │
       ToolCallingService                         trace.moe / AniList
                 │                                     │
       @Tool Registry + LlmService                Local CLIP / Vision
                 │                                     │
       DeepSeek-compatible LLM                    DashScope Vision
                 │
        ┌────────┴────────┐
        │                 │
   ChatMemory         Vector RAG
 Redis + MySQL       Embedding + Redis
        │                 │
        └────────┬────────┘
                 │
      Weather / Amap / Bilibili / Maoyan /
      AniList / Jikan / Reminder / Shop
```

图旁边主动补一句：

> “旧 `AgentService + BaseTool` 是并存的历史通用引擎，不在当前网页文本主路径上；当前网页图片也没有进入 `@Tool` 循环。”

## 六、生产化改造优先级

### P0 安全和数据隔离

- 所有 API 从 HttpSession 或 token 获取 userId。
- 服务端生成并校验 conversationId 归属。
- `searchSimilar` 必须按 conversationId/userId/tenant 过滤。
- 外部 API 密钥全部移到环境变量或密钥管理服务，并轮换当前配置中的硬编码凭据。
- CORS 不使用全开放 `*`；上传文件做 MIME、魔数、扩展名和内容安全校验。

### P1 让主链路真正稳定

- 统一工具执行引擎，兼容标准 Spring AI ToolCallback 或保留自定义 registry 但补齐类型系统。
- `function.arguments` 同时兼容 JSON 字符串和对象。
- 工具调用结果统一为结构化 JSON，区分参数错误、超时、限流、业务无数据和系统异常。
- 给外部 API 增加连接/读取超时、重试、熔断、缓存和指标。
- 对有副作用的提醒、下单等工具增加用户确认和幂等键。

### P2 让 RAG 可评估

- embedding 维度从实际模型配置读取，不硬编码。
- 使用标准 FLOAT32 二进制序列化，不把向量当普通文本存储。
- 选定 cosine/L2 后统一索引、归一化和阈值。
- 增加文档解析、分块、metadata/source、批量 embedding 和增量更新。
- 用标注问题集评估召回率、top-k、延迟和错误注入。

### P3 体验和可观察性

- 真正实现 SSE 或 WebSocket；当前页面不是流式。
- 长耗时识图和多源活动查询改成异步任务或可取消任务。
- traceId 贯穿请求、模型调用、工具调用、外部 API 和结果。
- 记录耗时、token、失败原因和工具命中率，但不记录密钥及不必要的原始图片/敏感文本。

## 七、最终版自我介绍

> “我实习期间主要接触的是 Java 后端和 AI 应用编排。项目是一个从通用多模态助手逐步演进到动漫 AI 助手的平台。平台保留了一个基于 BaseTool 的通用 Agent，支持文件、图片、语音、搜索和天气等动作；当前网页文本主链路则采用新的 `@Tool` 业务引擎，通过反射生成 Function Calling schema，执行工具并把结果回填模型。
>
> 在 Agent 侧，我重点理解了 system prompt、工具白名单、工具结果回填、多轮上限、并发执行、超时和错误降级。记忆侧使用 Redis 热缓存和 MySQL 持久化，长对话做摘要；RAG 则通过 embedding 检索相关历史，再注入模型上下文。
>
> 动漫识图是当前版本的特色：先通过 trace.moe 进行作品级反向识图，再从 AniList 拉角色候选图交给视觉模型验证；失败时降级到本地 CLIP 和候选目录，并设置置信度阈值，证据不足就不强行猜测。复盘源码后，我也能明确当前仍需完善的地方，例如真正的 SSE、会话归属、向量格式和外部 API 稳定性。”

## 八、14 号面试前必做的三轮复述

### 第一轮：只讲主链路

```text
网页文字 -> /chat-with-tools -> ToolCallingService -> @Tool -> LLM 最终回答
网页图片 -> /analyze-image -> trace.moe/AniList/CLIP/Vision
```

### 第二轮：只讲三个亮点

```text
1. 自定义 Function Calling 闭环
2. 多级候选约束式动漫识图
3. Redis/MySQL 记忆 + Embedding/RAG
```

### 第三轮：主动讲三个缺口

```text
1. 当前网页没有真正 SSE
2. conversationId 还需要和登录用户做服务端归属绑定
3. 向量维度、序列化和过滤条件需要生产化修正
```

能主动说出边界，通常比把所有模块都包装成“已经完美实现”更能体现后端工程判断力。

