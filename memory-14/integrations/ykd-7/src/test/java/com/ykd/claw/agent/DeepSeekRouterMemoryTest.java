package com.ykd.claw.agent;

import com.ykd.claw.memory.MemoryCandidate;
import com.ykd.claw.memory.ConversationService;
import com.ykd.claw.memory.MemoryService;
import com.ykd.claw.memory.TestJpaRepositories;
import com.ykd.claw.travel.service.ItineraryService;
import com.ykd.claw.media.image.ImageGenerationTool;
import com.ykd.claw.media.video.VideoGenerationTool;
import com.ykd.claw.media.video.VideoGenerationService;
import com.ykd.claw.web.WebContentSelector;
import com.ykd.claw.web.WebPageTool;
import com.ykd.claw.web.WebPageService;
import com.ykd.claw.document.DocumentGenerationTool;
import com.ykd.claw.graph.SkillGraphExecutor;
import com.ykd.claw.graph.SkillGraphResult;
import com.ykd.claw.skill.SkillDefinition;
import com.ykd.claw.skill.SkillRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.tool.annotation.Tool;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.nio.file.Path;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DeepSeekRouterMemoryTest {

    @Test
    void loadsHistoryAndLongTermMemoryThenPersistsTheNewTurn() throws Exception {
        RecordingModel model = new RecordingModel();
        ConversationService conversations =
                new ConversationService(TestJpaRepositories.conversationRepository(), 20);
        MemoryService memories = new MemoryService(TestJpaRepositories.memoryRepository(),
                (user, assistant) -> List.of(new MemoryCandidate("technology_stack", "Uses Java 21", 9)),
                true, 8);
        DeepSeekRouter router = new DeepSeekRouter(ChatClient.builder(model), conversations, memories,
                List.of(), new GeneratedArtifacts(), mock(AgentAuditService.class));

        assertEquals("reply-1", router.route("user-1", "conversation-1", "Remember my stack"));
        assertEquals("reply-2", router.route("user-1", "conversation-1", "What Java project should I build?"));

        assertEquals(4, conversations.count("user-1", "conversation-1"));
        Prompt second = model.prompts.get(1);
        assertTrue(second.getSystemMessage().getText().contains("Uses Java 21"));
        assertTrue(second.getInstructions().stream().anyMatch(message -> message.getText().equals("Remember my stack")));
        assertTrue(second.getInstructions().stream().anyMatch(message -> message.getText().equals("reply-1")));
    }

    @Test
    void excludesTheConflictingMediaToolForExplicitGenerationRequests() {
        GeneratedArtifacts artifacts = new GeneratedArtifacts();
        List<ToolProvider> providers = List.of(new ImageGenerationTool(artifacts),
                new VideoGenerationTool(artifacts, mock(VideoGenerationService.class)));

        List<Object> forVideo = List.of(DeepSeekRouter.selectTools(providers, "生成一个小猫的视频"));
        assertTrue(forVideo.stream().anyMatch(VideoGenerationTool.class::isInstance));
        assertFalse(forVideo.stream().anyMatch(ImageGenerationTool.class::isInstance));

        List<Object> forImage = List.of(DeepSeekRouter.selectTools(providers, "生成一张小猫图片"));
        assertTrue(forImage.stream().anyMatch(ImageGenerationTool.class::isInstance));
        assertFalse(forImage.stream().anyMatch(VideoGenerationTool.class::isInstance));
    }

    @Test
    void selectsOnlyWebPageToolForAStandaloneUrl() {
        GeneratedArtifacts artifacts = new GeneratedArtifacts();
        List<ToolProvider> providers = List.of(new ImageGenerationTool(artifacts),
                new WebPageTool(mock(WebPageService.class), new WebContentSelector(8_000, 1_200, 6)));

        List<Object> selected = List.of(DeepSeekRouter.selectTools(providers, "https://www.wikipedia.org"));

        assertEquals(1, selected.size());
        assertTrue(selected.getFirst() instanceof WebPageTool);
    }

    @Test
    void exposesDocumentGenerationOnlyForAnExplicitFileRequest() {
        DocumentGenerationTool documentTool = new DocumentGenerationTool(new GeneratedArtifacts());

        assertTrue(List.of(DeepSeekRouter.selectTools(List.of(documentTool),
                "帮我规划杭州三日游")).isEmpty());
        assertEquals(1, DeepSeekRouter.selectTools(List.of(documentTool),
                "把杭州三日游导出成PDF文件").length);
        assertEquals(1, DeepSeekRouter.selectTools(List.of(documentTool),
                "把刚才的旅游流程整理为文档").length);
        assertEquals(1, DeepSeekRouter.selectTools(List.of(documentTool),
                "把这个行程保存成Word").length);
    }

    @Test
    void exposesKnowledgeIndexingOnlyForAnExplicitImportRequest() {
        assertFalse(DeepSeekRouter.isToolAllowedForMessage(
                "index_knowledge_document", "这个项目怎么创建提醒？"));
        assertTrue(DeepSeekRouter.isToolAllowedForMessage(
                "index_knowledge_document", "把 docs/travel.pdf 导入知识库"));
        assertTrue(DeepSeekRouter.isToolAllowedForMessage("search_knowledge", "查一下项目文档"));
    }

    @Test
    void restrictsPlannedToolsToTheSelectedSkillWhitelist() {
        var result = new SkillGraphResult("travel", "ready", List.of(), List.of(
                new com.ykd.claw.graph.PlannedToolCall("query_weather", Map.of()),
                new com.ykd.claw.graph.PlannedToolCall("generate_document", Map.of())));

        var restricted = DeepSeekRouter.restrictPlannedTools(result, Set.of("query_weather"));

        assertEquals(List.of("query_weather"), restricted.plannedToolCalls().stream()
                .map(call -> call.toolName()).toList());
    }

    @Test
    void exposesNoToolsWhileGraphWaitsAndKeepsWrappedCallbacksAfterPlannedToolsFinish() {
        Object[] providers = {new SampleTravelTools()};
        var waiting = new com.ykd.claw.graph.SkillGraphResult(
                "travel", "ask for destination", List.of("destination"));
        assertTrue(DeepSeekRouter.responseToolCallbacks(providers, waiting, false).isEmpty());

        var ready = new com.ykd.claw.graph.SkillGraphResult(
                "travel", "ready", List.of(),
                List.of(new com.ykd.claw.graph.PlannedToolCall("query_weather", Map.of("city", "杭州"))));
        var remaining = DeepSeekRouter.responseToolCallbacks(providers, ready, true);
        // 执行过的计划工具保留在回调列表中,但被 AlreadyExecutedToolCallback 包裹,
        // 防止模型重复调用;未执行的工具(如 search_place)仍可调用。
        assertEquals(2, remaining.size());
        assertTrue(remaining.stream().anyMatch(callback ->
                callback instanceof AlreadyExecutedToolCallback
                        && "query_weather".equals(callback.getToolDefinition().name())));
        assertEquals("为了继续处理，请补充：日期、入住人数。",
                DeepSeekRouter.clarificationReply(new com.ykd.claw.graph.SkillGraphResult(
                        "travel", "waiting", List.of("日期", "入住人数"))));
    }

    @Test
    void keepsExecutedGraphToolsCallableSoTheModelCanReuseSearchPlace() throws Exception {
        RecordingModel model = new RecordingModel();
        ConversationService conversations =
                new ConversationService(TestJpaRepositories.conversationRepository(), 20);
        MemoryService memories = new MemoryService(TestJpaRepositories.memoryRepository(),
                (user, assistant) -> List.of(), false, 8);
        SkillDefinition travel = new SkillDefinition("travel", "旅游", List.of("美食", "西湖"),
                List.of("search_place", "search_web", "search_knowledge", "query_weather"),
                List.of(), List.of(), "", Path.of("SKILL.md"));
        SkillRegistry registry = mock(SkillRegistry.class);
        when(registry.match("西湖有什么美食")).thenReturn(Optional.of(travel));
        when(registry.findByName("travel")).thenReturn(Optional.of(travel));
        SkillGraphExecutor graph = mock(SkillGraphExecutor.class);
        var planned = List.of(
                new com.ykd.claw.graph.PlannedToolCall("search_place", Map.of("keyword", "餐厅", "city", "西湖")),
                new com.ykd.claw.graph.PlannedToolCall("search_web", Map.of("keyword", "西湖 餐厅 评价")),
                new com.ykd.claw.graph.PlannedToolCall("search_knowledge", Map.of("query", "西湖 美食")));
        var ready = new SkillGraphResult("travel", "ready", List.of(), planned);
        when(graph.execute(travel, "u", "c", "西湖有什么美食")).thenReturn(ready);
        when(graph.executePlannedTools(org.mockito.ArgumentMatchers.eq(ready),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any())).thenReturn(ready);
        DeepSeekRouter router = new DeepSeekRouter(ChatClient.builder(model), conversations, memories,
                List.of(new SampleTravelTools()), new GeneratedArtifacts(), mock(AgentAuditService.class),
                registry, graph, mock(PlannedToolExecutor.class));

        router.route("u", "c", "西湖有什么美食");

        Prompt last = model.prompts.getLast();
        var options = (org.springframework.ai.model.tool.ToolCallingChatOptions) last.getOptions();
        Set<String> names = options.getToolCallbacks().stream()
                .map(callback -> callback.getToolDefinition().name())
                .collect(java.util.stream.Collectors.toSet());
        assertTrue(names.contains("search_place"),
                "search_place must remain callable after the Graph executes it; got: " + names);
        assertTrue(names.contains("query_weather"));
    }

    @Test
    void graphWaitingReturnsARealClarificationInsteadOfLettingTheModelPromiseASearch() throws Exception {
        RecordingModel model = new RecordingModel();
        ConversationService conversations =
                new ConversationService(TestJpaRepositories.conversationRepository(), 20);
        MemoryService memories = new MemoryService(TestJpaRepositories.memoryRepository(),
                (user, assistant) -> List.of(), false, 8);
        SkillRegistry registry = mock(SkillRegistry.class);
        SkillGraphExecutor graph = mock(SkillGraphExecutor.class);
        SkillDefinition travel = new SkillDefinition("travel", "travel", List.of("酒店"),
                List.of(), List.of(), List.of(), "", Path.of("SKILL.md"));
        when(registry.match("帮我查酒店")).thenReturn(Optional.of(travel));
        when(graph.execute(travel, "u", "c", "帮我查酒店"))
                .thenReturn(new SkillGraphResult("travel", "waiting", List.of("日期", "入住人数")));
        DeepSeekRouter router = new DeepSeekRouter(ChatClient.builder(model), conversations, memories,
                List.of(), new GeneratedArtifacts(), mock(AgentAuditService.class), registry, graph);

        String reply = router.route("u", "c", "帮我查酒店");

        assertEquals("为了继续处理，请补充：日期、入住人数。", reply);
        assertTrue(model.prompts.isEmpty());
    }

    @Test
    void autoSavesACompletedTravelItineraryToTheUsersItineraries() throws Exception {
        RecordingModel model = new RecordingModel();
        ConversationService conversations =
                new ConversationService(TestJpaRepositories.conversationRepository(), 20);
        MemoryService memories = new MemoryService(TestJpaRepositories.memoryRepository(),
                (user, assistant) -> List.of(), false, 8);
        SkillDefinition travel = new SkillDefinition("travel", "旅游", List.of("杭州", "行程"),
                List.of("query_weather"), List.of(), List.of(), "", Path.of("SKILL.md"));
        SkillRegistry registry = mock(SkillRegistry.class);
        when(registry.match("规划杭州三日游")).thenReturn(Optional.of(travel));
        when(registry.findByName("travel")).thenReturn(Optional.of(travel));
        SkillGraphExecutor graph = mock(SkillGraphExecutor.class);
        var planned = List.of(new com.ykd.claw.graph.PlannedToolCall(
                "query_weather", Map.of("city", "杭州")));
        var planningContext = Map.<String, Object>of(
                "taskType", "itinerary", "destination", "杭州",
                "startDate", "2026-08-10", "endDate", "2026-08-13", "days", 3);
        var ready = new SkillGraphResult("travel", "ready", List.of(), planned, planningContext);
        when(graph.execute(travel, "u", "c", "规划杭州三日游")).thenReturn(ready);
        when(graph.executePlannedTools(org.mockito.ArgumentMatchers.eq(ready),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any())).thenReturn(ready);
        ItineraryService itineraries = mock(ItineraryService.class);
        DeepSeekRouter router = new DeepSeekRouter(ChatClient.builder(model), conversations, memories,
                List.of(new SampleTravelTools()), new GeneratedArtifacts(), mock(AgentAuditService.class),
                registry, graph, mock(PlannedToolExecutor.class), null, itineraries, null);

        router.route("u", "c", "规划杭州三日游");

        org.mockito.Mockito.verify(itineraries).upsertFromPlan(
                org.mockito.ArgumentMatchers.eq("u"), org.mockito.ArgumentMatchers.eq("c"),
                org.mockito.ArgumentMatchers.eq("杭州"),
                org.mockito.ArgumentMatchers.eq(java.time.LocalDate.of(2026, 8, 10)),
                org.mockito.ArgumentMatchers.eq(java.time.LocalDate.of(2026, 8, 13)),
                org.mockito.ArgumentMatchers.eq(3),
                org.mockito.ArgumentMatchers.eq("杭州 3日游"),
                org.mockito.ArgumentMatchers.contains("reply-1"));
    }

    private static final class RecordingModel implements ChatModel {
        private final List<Prompt> prompts = new ArrayList<>();

        @Override
        public ChatResponse call(Prompt prompt) {
            prompts.add(prompt);
            return new ChatResponse(List.of(new Generation(new AssistantMessage("reply-" + prompts.size()))));
        }
    }

    private static final class SampleTravelTools implements ToolProvider {
        @Tool(name = "query_weather", description = "weather")
        public String weather(String city) {
            return city;
        }

        @Tool(name = "search_place", description = "place")
        public String place(String keyword) {
            return keyword;
        }
    }
}
