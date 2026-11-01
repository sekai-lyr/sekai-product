package com.example.demo.ai;

import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONArray;
import com.alibaba.fastjson2.JSONObject;
import com.example.demo.chat.ChatMemoryService;
import com.example.demo.chat.LlmService;
import com.example.demo.chat.VectorStoreService;
import com.example.demo.chat.repository.InMemoryChatMemoryRepository;
import com.example.demo.config.DashScopeConfig;
import com.example.demo.movie.MovieReminderController;
import com.example.demo.movie.Reminder;
import com.example.demo.movie.ReminderRepository;
import com.example.demo.movie.ReminderService;
import com.example.demo.vision.VisionService;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.LinkedBlockingQueue;

import static org.assertj.core.api.Assertions.*;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** 使用真实的路由、记忆、工具执行器和 HTTP 客户端，仅替换外部模型与数据库。 */
class AssistantChatIntegrationTest {
    private HttpServer modelServer;
    private final LinkedBlockingQueue<String> replies = new LinkedBlockingQueue<>();
    private final List<JSONObject> requests = new ArrayList<>();
    private final List<Reminder> reminders = new ArrayList<>();
    private ChatMemoryService memory;
    private LlmService llm;
    private MockMvc mvc;

    @BeforeAll
    static void useShortSocketDirectoryOnWindows() {
        // JDK 25 的 Windows NIO 使用 Unix socket；过长的 TEMP 路径会使本地 HTTP 服务无法启动。
        if (System.getProperty("os.name").startsWith("Windows")
                && System.getProperty("jdk.net.unixdomain.tmpdir") == null) {
            System.setProperty("jdk.net.unixdomain.tmpdir", Path.of("target").toAbsolutePath().toString());
        }
    }

    @BeforeEach
    void setUp() throws Exception {
        modelServer = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        modelServer.createContext("/chat/completions", exchange -> {
            requests.add(JSON.parseObject(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8)));
            String reply = replies.poll();
            byte[] body = (reply == null ? "Missing model fixture" : reply).getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", reply != null && reply.startsWith("data:")
                    ? "text/event-stream;charset=UTF-8" : "application/json;charset=UTF-8");
            exchange.sendResponseHeaders(reply == null ? 500 : 200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        modelServer.start();
        DashScopeConfig config = new DashScopeConfig();
        config.setBaseUrl("http://127.0.0.1:" + modelServer.getAddress().getPort());
        config.setApiKey("test-only");
        config.setModel("test-model");
        config.getVision().setBaseUrl(config.getBaseUrl());
        config.getVision().setApiKey("test-only");

        memory = new ChatMemoryService(new InMemoryChatMemoryRepository());
        memory.setMaxMessages(20);
        memory.setMaxTokens(10000);
        ReflectionTestUtils.setField(memory, "summaryThreshold", 20000L);
        llm = new LlmService(config, memory, event -> {});

        ReminderRepository repository = mock(ReminderRepository.class);
        when(repository.save(any(Reminder.class))).thenAnswer(invocation -> {
            Reminder reminder = invocation.getArgument(0);
            reminders.add(reminder);
            return reminder;
        });
        when(repository.findByConversationIdAndSentFalseAndRemindTimeBeforeOrderByRemindTimeAsc(any(), any()))
                .thenAnswer(invocation -> reminders.stream()
                        .filter(reminder -> reminder.getConversationId().equals(invocation.getArgument(0)))
                        .filter(reminder -> !reminder.isSent() && reminder.getRemindTime().isBefore(invocation.getArgument(1)))
                        .toList());
        ReminderService reminderService = new ReminderService(repository);
        SpringAiTools tools = new SpringAiTools(null, null, null, null, null, null,
                reminderService, null, null);
        ToolCallingService toolCalling = new ToolCallingService(llm, tools, memory, null, event -> {});
        AiController controller = new AiController(new SpringAiChatService(toolCalling), toolCalling,
                null, null, null, memory, mock(VectorStoreService.class), new VisionService(config));
        mvc = MockMvcBuilders.standaloneSetup(controller, new MovieReminderController(reminderService)).build();
    }

    @AfterEach
    void tearDown() {
        if (modelServer != null) modelServer.stop(0);
    }

    @Test
    void sameClientIdKeepsAnimeAndPlantHistoryAndToolsSeparate() throws Exception {
        replies.add(text("记住了猫咪小白。"));
        stream("plant", "我的猫叫小白");
        replies.add(text("一起聊动漫吧。"));
        stream("anime", "推荐动画");
        replies.add(text("小白最近怎么样？"));
        stream("plant", "我的猫叫什么？");

        assertThat(requests.get(0).getJSONArray("messages").getJSONObject(0).getString("content")).contains("绿意管家");
        assertThat(requests.get(0).getJSONArray("tools").toJSONString()).contains("createCareReminder").doesNotContain("searchAnime");
        assertThat(requests.get(1).getJSONArray("messages").toJSONString()).doesNotContain("小白").contains("天空放映室");
        assertThat(requests.get(1).getJSONArray("tools").toJSONString()).contains("searchAnime").doesNotContain("createCareReminder");
        assertThat(requests.get(2).getJSONArray("messages").toJSONString()).contains("小白").doesNotContain("推荐动画");
        assertThat(memory.getConversationHistory("plant:shared")).hasSize(4);
        assertThat(memory.getConversationHistory("anime:shared")).hasSize(2);
    }

    @Test
    void streamedCareToolArgumentsAreMergedAndReminderStaysInPlantChat() throws Exception {
        replies.add(tool("createCareReminder", "{\"title\":\"检查盆土\",\"date\":\"2020-01-01\",\"time\":\"08:00\"}"));
        replies.add(text("护理提醒已设置。"));
        stream("plant", "提醒我检查盆土");

        assertThat(reminders).hasSize(1);
        assertThat(reminders.getFirst().getConversationId()).isEqualTo("plant:shared");
        assertThat(reminders.getFirst().getTitle()).isEqualTo("检查盆土");
        assertThat(requests.get(1).getJSONArray("messages").toJSONString()).contains("tool_call_id", "call_1", "提醒已创建");
        mvc.perform(get("/api/reminders/pending").param("assistant", "anime").param("conversationId", "shared"))
                .andExpect(jsonPath("$.messages").isEmpty());
        mvc.perform(get("/api/reminders/pending").param("assistant", "plant").param("conversationId", "shared"))
                .andExpect(jsonPath("$.messages[0]").value(containsString("检查盆土")));
    }

    @Test
    void unavailableToolIsRejectedEvenIfModelRequestsIt() throws Exception {
        // searchAnime 的依赖在本测试中为空，若越权执行将得到 NullPointerException，而非拒绝结果。
        replies.add(tool("searchAnime", "{\"query\":\"test\",\"type\":\"tv\",\"page\":1,\"limit\":1}"));
        replies.add(text("我可以帮你排查植物养护问题。"));
        stream("plant", "帮我看看");
        assertThat(requests.get(1).getJSONArray("messages").getLast().toString())
                .contains("Tool is not available for this assistant: searchAnime").doesNotContain("NullPointerException");
    }

    @Test
    void plantPhotoAndFollowUpShareCareMemory() throws Exception {
        replies.add(JSONObject.of("choices", JSONArray.of(JSONObject.of("message",
                JSONObject.of("content", "叶片有黄斑，请检查叶背。")))).toJSONString());
        mvc.perform(post("/api/ai/analyze-image").contentType(MediaType.APPLICATION_JSON).content("""
                        {"assistant":"plant","image":"data:image/png;base64,aGVsbG8=","conversationId":"shared","question":"看看叶子"}
                        """))
                .andExpect(jsonPath("$.content").value("叶片有黄斑，请检查叶背。"));
        replies.add(text("刚才看到叶片有黄斑。"));
        stream("plant", "刚才照片有什么问题？");
        assertThat(requests.get(0).getJSONArray("messages").getJSONObject(0).getString("content")).contains("绿意管家");
        assertThat(requests.get(0).getJSONArray("messages").toJSONString()).contains("绿意管家", "image_url");
        assertThat(requests.get(1).getJSONArray("messages").toJSONString()).contains("叶片有黄斑，请检查叶背。");
    }

    @Test
    void clientDisconnectStopsStreamInsteadOfBeingSwallowed() {
        replies.add(text("第一段"));
        assertThatThrownBy(() -> llm.streamChat(new JSONArray(), delta -> {
            throw new IllegalStateException("client disconnected");
        })).isInstanceOf(IllegalStateException.class).hasMessage("client disconnected");
    }

    @Test
    void upstreamStreamFailureIsAnErrorEventAndDoesNotSaveReply() throws Exception {
        replies.add("data: {\"error\":{\"message\":\"model unavailable\"}}\n\n");
        MvcResult pending = mvc.perform(post("/api/ai/chat/stream").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"assistant\":\"plant\",\"conversationId\":\"shared\",\"message\":\"你好\"}"))
                .andExpect(request().asyncStarted()).andReturn();
        pending.getAsyncResult(10000);
        mvc.perform(asyncDispatch(pending))
                .andExpect(content().string(containsString("event:error")));
        assertThat(memory.getConversationHistory("plant:shared")).isEmpty();
    }

    private void stream(String assistant, String message) throws Exception {
        MvcResult pending = mvc.perform(post("/api/ai/chat/stream").contentType(MediaType.APPLICATION_JSON)
                        .content(JSONObject.of("assistant", assistant, "conversationId", "shared", "message", message).toJSONString()))
                .andExpect(request().asyncStarted()).andReturn();
        pending.getAsyncResult(10000);
        mvc.perform(asyncDispatch(pending)).andExpect(status().isOk())
                .andExpect(content().string(containsString("event:done")));
    }

    private String text(String text) {
        return delta(JSONObject.of("content", text)) + "data: [DONE]\n\n";
    }

    private String tool(String name, String arguments) {
        int split = arguments.length() / 2;
        return delta(JSONObject.of("tool_calls", JSONArray.of(JSONObject.of("index", 0, "id", "call_1", "type", "function",
                "function", JSONObject.of("name", name, "arguments", arguments.substring(0, split))))))
                + delta(JSONObject.of("tool_calls", JSONArray.of(JSONObject.of("index", 0,
                "function", JSONObject.of("arguments", arguments.substring(split)))))) + "data: [DONE]\n\n";
    }

    private String delta(JSONObject delta) {
        return "data: " + JSONObject.of("choices", JSONArray.of(JSONObject.of("delta", delta))).toJSONString() + "\n\n";
    }
}
