package com.ykd.claw.webui;

import com.ykd.claw.agent.DeepSeekRouter;
import com.ykd.claw.memory.ConversationService;
import com.ykd.claw.vision.VisionService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class WebChatControllerTest {
    private final DeepSeekRouter router = mock(DeepSeekRouter.class);
    private final VisionService vision = mock(VisionService.class);
    private final ConversationService conversations = mock(ConversationService.class);
    private final WebReminderInbox inbox = new WebReminderInbox();
    private WebChatController controller;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        controller = new WebChatController(router, vision, conversations, inbox);
        mvc = MockMvcBuilders.standaloneSetup(controller).setControllerAdvice(new WebApiExceptionHandler()).build();
    }

    @AfterEach
    void tearDown() { controller.close(); }

    @Test
    void webChatStreamsOriginalRouterWithScopedUserAndConversation() throws Exception {
        when(router.routeStreaming(eq("sekai:demo"), eq("web_travel:test"), eq("你好"), any())).thenAnswer(invocation -> {
            Consumer<String> chunks = invocation.getArgument(3);
            chunks.accept("旅行");
            chunks.accept("规划");
            return "旅行规划";
        });
        MvcResult pending = mvc.perform(post("/api/sekai/chat/stream").contentType(MediaType.APPLICATION_JSON).content("""
                        {"userId":"sekai:demo","conversationId":"web_travel:test","message":"你好"}
                        """))
                .andExpect(request().asyncStarted()).andReturn();
        pending.getAsyncResult(10000);
        mvc.perform(asyncDispatch(pending)).andExpect(content().string(containsString("data:旅行")))
                .andExpect(content().string(containsString("data:规划")))
                .andExpect(content().string(containsString("event:done")));
    }

    @Test
    void missingIdentityAndEmptyMessageAreRejected() throws Exception {
        mvc.perform(post("/api/sekai/chat").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"hello\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/sekai/chat").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"demo\",\"conversationId\":\"web_travel:test\",\"message\":\" \"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void photoIsStoredTemporarilyAndItsAnalysisSavedToTheSameConversation() throws Exception {
        when(vision.analyze(anyString(), contains("远行向导"))).thenAnswer(invocation -> {
            Path image = Path.of(invocation.getArgument(0, String.class));
            assertThat(Files.readAllBytes(image)).isEqualTo("hello".getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return "一处湖边景色。";
        });
        mvc.perform(post("/api/sekai/analyze-image").contentType(MediaType.APPLICATION_JSON).content("""
                        {"userId":"demo","conversationId":"web_travel:test","message":"哪里","image":"data:image/png;base64,aGVsbG8="}
                        """))
                .andExpect(jsonPath("$.content").value("一处湖边景色。"));
        verify(conversations).saveTurn(eq("demo"), eq("web_travel:test"), contains("用户上传图片"), eq("一处湖边景色。"));
        try (var uploads = Files.list(Path.of("data/web-uploads"))) { assertThat(uploads.count()).isZero(); }
    }

    @Test
    void reminderInboxIsIsolatedByUserAndConversationAndDrainedOnce() {
        inbox.publish("alice", "web_travel:a", "出发提醒");
        assertThat(inbox.drain("bob", "web_travel:a")).isEmpty();
        assertThat(inbox.drain("alice", "web_travel:b")).isEmpty();
        assertThat(inbox.drain("alice", "web_travel:a")).containsExactly("出发提醒");
        assertThat(inbox.drain("alice", "web_travel:a")).isEmpty();
    }
}
