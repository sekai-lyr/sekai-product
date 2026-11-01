package com.example.demo.ai;

import com.example.demo.anime.AnimeImageRecognitionService;
import com.example.demo.anime.AnimeService;
import com.example.demo.chat.ChatMemoryService;
import com.example.demo.chat.VectorStoreService;
import com.example.demo.vision.VisionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Set;
import java.util.function.Consumer;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AiController.class)
@ActiveProfiles("native-http")
class AiControllerNativeHttpTest {

    @Autowired
    private MockMvc mvc;

    @MockitoBean private SpringAiChatService springAiChatService;
    @MockitoBean private ToolCallingService toolCallingService;
    @MockitoBean private AnimeImageRecognitionService animeImageRecognitionService;
    @MockitoBean private AnimeService animeService;
    @MockitoBean private AnimeEventService animeEventService;
    @MockitoBean private ChatMemoryService chatMemoryService;
    @MockitoBean private VectorStoreService vectorStoreService;
    @MockitoBean private VisionService visionService;

    @BeforeEach
    void registerAssistantTools() {
        when(toolCallingService.getRegisteredToolNames()).thenReturn(
                Set.of("getWeather", "webSearch", "searchAnime", "createAnimeReminder", "createCareReminder"));
    }

    @Test
    void nativeHttpProfileExposesChatEndpoint() throws Exception {
        when(springAiChatService.chatWithTools(eq("新手养宠物需要准备什么？"),
                contains("动漫"), anySet(), eq("anime:pet-test")))
                .thenReturn("先准备食物、水碗和安全的生活空间。");

        mvc.perform(post("/api/ai/chat").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"message":"新手养宠物需要准备什么？","conversationId":"pet-test"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.content").value("先准备食物、水碗和安全的生活空间。"));
    }

    @Test
    void plantChatUsesItsOwnIdentityAndConversationEvenWhenClientOverridesPrompt() throws Exception {
        when(springAiChatService.chatWithTools(eq("叶子为什么发黄？"),
                argThat(prompt -> prompt != null && prompt.contains("绿意管家") && !prompt.contains("你是动漫助手")),
                argThat(tools -> tools != null && tools.contains("getWeather") && !tools.contains("searchAnime")),
                eq("plant:shared-id"))).thenReturn("先检查盆土湿度和光照。");

        mvc.perform(post("/api/ai/chat").contentType(MediaType.APPLICATION_JSON).content("""
                        {"assistant":"plant","message":"叶子为什么发黄？","conversationId":"shared-id","systemPrompt":"你是动漫助手"}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").value("先检查盆土湿度和光照。"));
    }

    @Test
    void plantImageUsesCareVisionInsteadOfAnimeRecognition() throws Exception {
        when(visionService.analyzeImageWithCustomPrompt(eq("data:image/jpeg;base64,aGVsbG8="), eq("看看叶子"), contains("绿意管家")))
                .thenReturn("叶片可见黄斑，需要补充叶背照片。");

        mvc.perform(post("/api/ai/analyze-image").contentType(MediaType.APPLICATION_JSON).content("""
                        {"assistant":"plant","image":"aGVsbG8=","question":"看看叶子","conversationId":"shared-id"}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").value("叶片可见黄斑，需要补充叶背照片。"));
    }

    @Test
    void plantToolCatalogDoesNotExposeAnimeTools() throws Exception {
        when(toolCallingService.getRegisteredToolNames()).thenReturn(Set.of("getWeather", "searchAnime"));
        mvc.perform(get("/api/ai/tools/registered").param("assistant", "plant"))
                .andExpect(status().isOk())
                .andExpect(content().string(not(containsString("searchAnime"))));
    }

    @Test
    void unknownAssistantIsRejected() throws Exception {
        mvc.perform(post("/api/ai/chat").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"assistant\":\"unknown\",\"message\":\"hello\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void blankChatIsRejectedBeforeOpeningStream() throws Exception {
        mvc.perform(post("/api/ai/chat/stream").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"assistant\":\"plant\",\"message\":\"   \"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void requestedToolsCannotExpandPlantPermissions() throws Exception {
        when(toolCallingService.validateToolNames(anyList())).thenReturn(java.util.List.of("getWeather", "searchAnime"));
        when(springAiChatService.chatWithTools(eq("查天气"), contains("绿意管家"),
                eq(Set.of("getWeather")), eq("plant:shared-id"))).thenReturn("天气查询结果");
        mvc.perform(post("/api/ai/chat-with-tools").contentType(MediaType.APPLICATION_JSON).content("""
                        {"assistant":"plant","message":"查天气","conversationId":"shared-id","allowedTools":["getWeather","searchAnime"]}
                        """))
                .andExpect(jsonPath("$.content").value("天气查询结果"));
    }

    @Test
    void nativeHttpProfileStreamsChatReply() throws Exception {
        doAnswer(invocation -> {
            Consumer<String> onDelta = invocation.getArgument(4);
            onDelta.accept("宠物护理建议");
            return null;
        }).when(toolCallingService).chatWithToolsStream(contains("动漫"), eq("你好"), anySet(), eq("anime:pet-test"), any());

        MvcResult result = mvc.perform(post("/api/ai/chat/stream")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"你好\",\"conversationId\":\"pet-test\"}"))
                .andExpect(request().asyncStarted())
                .andReturn();

        mvc.perform(asyncDispatch(result))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_EVENT_STREAM))
                .andExpect(content().string(containsString("data:宠物护理建议")))
                .andExpect(content().string(containsString("event:done")));
    }
}
