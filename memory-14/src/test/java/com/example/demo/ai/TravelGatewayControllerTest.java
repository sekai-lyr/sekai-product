package com.example.demo.ai;

import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONObject;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.*;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class TravelGatewayControllerTest {
    private HttpServer backend;
    private TravelGatewayController gateway;
    private MockMvc mvc;
    private final List<JSONObject> received = new ArrayList<>();
    private String reply = "{\"success\":true,\"content\":\"远行向导回复\"}";
    private int backendStatus = 200;

    @BeforeAll
    static void configureSocketDirectory() {
        if (System.getProperty("os.name").startsWith("Windows")) {
            System.setProperty("jdk.net.unixdomain.tmpdir", Path.of("target").toAbsolutePath().toString());
        }
    }

    @BeforeEach
    void setUp() throws Exception {
        backend = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        backend.createContext("/api/sekai/", exchange -> {
            JSONObject body = JSON.parseObject(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            body.put("path", exchange.getRequestURI().getPath());
            received.add(body);
            byte[] bytes = reply.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", reply.startsWith("data:") ? "text/event-stream" : "application/json");
            exchange.sendResponseHeaders(backendStatus, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        backend.start();
        gateway = new TravelGatewayController("http://127.0.0.1:" + backend.getAddress().getPort());
        mvc = MockMvcBuilders.standaloneSetup(gateway).build();
    }

    @AfterEach
    void tearDown() {
        if (gateway != null) gateway.close();
        if (backend != null) backend.stop(0);
    }

    @Test
    void travelChatUsesBackendAndServerSessionIdentity() throws Exception {
        mvc.perform(post("/api/travel/chat").sessionAttr("user", "demo").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"conversationId":"shared","message":"你好","userId":"someone-else","systemPrompt":"你是动漫助手"}
                                """))
                .andExpect(jsonPath("$.content").value("远行向导回复"));
        assertThat(received).hasSize(1);
        assertThat(received.getFirst()).containsEntry("userId", "sekai:demo")
                .containsEntry("conversationId", "web_travel:shared")
                .containsEntry("path", "/api/sekai/chat").doesNotContainKey("systemPrompt");
    }

    @Test
    void anonymousChatCannotReachBackend() throws Exception {
        mvc.perform(post("/api/travel/chat").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"conversationId\":\"shared\",\"message\":\"hello\"}"))
                .andExpect(status().isUnauthorized());
        assertThat(received).isEmpty();
    }

    @Test
    void streamingPreservesMultilineTextAndCompletion() throws Exception {
        reply = "data: first\r\ndata: second\r\n\r\nevent: done\r\ndata: [DONE]\r\n\r\n";
        MvcResult pending = streamRequest();
        mvc.perform(asyncDispatch(pending)).andExpect(content().string(containsString("data:first\ndata:second")))
                .andExpect(content().string(containsString("event:done")));
        assertThat(received.getFirst()).containsEntry("path", "/api/sekai/chat/stream");
    }

    @Test
    void unavailableBackendProducesStreamErrorWithoutFallback() throws Exception {
        backendStatus = 503;
        MvcResult pending = streamRequest();
        mvc.perform(asyncDispatch(pending)).andExpect(content().string(containsString("event:error")))
                .andExpect(content().string(not(containsString("event:done"))));
        assertThat(received).hasSize(1);
    }

    @Test
    void synchronousBackendFailureReturnsBadGateway() throws Exception {
        backendStatus = 503;
        mvc.perform(post("/api/travel/chat").sessionAttr("user", "demo").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"conversationId\":\"shared\",\"message\":\"hello\"}"))
                .andExpect(status().isBadGateway());
    }

    @Test
    void imageQuestionAndReminderConversationReachTravelBackend() throws Exception {
        mvc.perform(post("/api/travel/analyze-image").sessionAttr("user", "demo").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"conversationId\":\"shared\",\"question\":\"哪里\",\"image\":\"data:image/png;base64,aGVsbG8=\"}"))
                .andExpect(status().isOk());
        assertThat(received.getFirst()).containsEntry("message", "哪里").containsEntry("path", "/api/sekai/analyze-image");
        mvc.perform(get("/api/travel/reminders/pending").sessionAttr("user", "demo").param("conversationId", "shared"))
                .andExpect(status().isOk());
        assertThat(received.getLast()).containsEntry("conversationId", "web_travel:shared")
                .containsEntry("path", "/api/sekai/reminders/pending");
    }

    private MvcResult streamRequest() throws Exception {
        MvcResult pending = mvc.perform(post("/api/travel/chat/stream").sessionAttr("user", "demo")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"conversationId\":\"shared\",\"message\":\"hello\"}"))
                .andExpect(request().asyncStarted()).andReturn();
        pending.getAsyncResult(10000);
        return pending;
    }
}
