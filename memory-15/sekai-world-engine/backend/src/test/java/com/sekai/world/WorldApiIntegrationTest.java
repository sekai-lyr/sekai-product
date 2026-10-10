package com.sekai.world;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.sekai.world.common.auth.AuthenticationFilter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.context.WebApplicationContext;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

@SpringBootTest
@ActiveProfiles("test")
class WorldApiIntegrationTest {
    @Autowired ObjectMapper objectMapper;
    @Autowired WebApplicationContext webApplicationContext;
    @Autowired AuthenticationFilter authenticationFilter;
    private MockMvc mvc;

    @BeforeEach
    void setUp() { mvc = webAppContextSetup(webApplicationContext).addFilters(authenticationFilter).build(); }

    @Test
    void userCanCreateAdvanceAndRepeatAnIdempotentTick() throws Exception {
        String token = register("pilot@example.com");
        var worldResponse = mvc.perform(post("/api/worlds")
                        .header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"测试星港\",\"seed\":42}"))
                .andReturn().getResponse();
        assertThat(worldResponse.getStatus()).withFailMessage(worldResponse.getContentAsString()).isEqualTo(200);
        String worldBody = worldResponse.getContentAsString();
        assertThat(objectMapper.readTree(worldBody).get("name").asText()).isEqualTo("测试星港");
        long worldId = objectMapper.readTree(worldBody).get("id").asLong();

        var stateResponse = mvc.perform(get("/api/worlds/{worldId}/state", worldId)
                        .header("Authorization", bearer(token))).andReturn().getResponse();
        assertThat(stateResponse.getStatus()).isEqualTo(200);
        JsonNode state = objectMapper.readTree(stateResponse.getContentAsString());
        assertThat(state.get("actors").size()).isEqualTo(12);
        assertThat(state.get("overview").get("locations").size()).isEqualTo(5);
        long branchId = state.get("branchId").asLong();

        var advanceResponse = mvc.perform(post("/api/worlds/{worldId}/advance", worldId)
                        .header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"branchId\":" + branchId + ",\"idempotencyKey\":\"test-tick-1\"}"))
                .andReturn().getResponse();
        assertThat(advanceResponse.getStatus()).isEqualTo(200);
        JsonNode advanced = objectMapper.readTree(advanceResponse.getContentAsString());
        assertThat(advanced.get("idempotent").asBoolean()).isFalse();
        assertThat(advanced.get("result").get("toDate").asText()).isEqualTo("2026-01-02");

        var repeatResponse = mvc.perform(post("/api/worlds/{worldId}/advance", worldId)
                        .header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"branchId\":" + branchId + ",\"idempotencyKey\":\"test-tick-1\"}"))
                .andReturn().getResponse();
        assertThat(repeatResponse.getStatus()).isEqualTo(200);
        assertThat(objectMapper.readTree(repeatResponse.getContentAsString()).get("idempotent").asBoolean()).isTrue();

        var eventsResponse = mvc.perform(get("/api/worlds/{worldId}/events", worldId)
                        .param("branchId", String.valueOf(branchId)).header("Authorization", bearer(token)))
                .andReturn().getResponse();
        assertThat(eventsResponse.getStatus()).isEqualTo(200);
        JsonNode events = objectMapper.readTree(eventsResponse.getContentAsString());
        assertThat(events.size()).isGreaterThan(0);
        long eventId = events.get(0).get("id").asLong();

        var eventDetail = mvc.perform(get("/api/worlds/{worldId}/events/{eventId}", worldId, eventId)
                        .param("branchId", String.valueOf(branchId)).header("Authorization", bearer(token)))
                .andReturn().getResponse();
        assertThat(eventDetail.getStatus()).isEqualTo(200);
        assertThat(objectMapper.readTree(eventDetail.getContentAsString()).get("choices").size()).isEqualTo(2);

        var choiceResponse = mvc.perform(post("/api/worlds/{worldId}/events/{eventId}/choices", worldId, eventId)
                        .param("branchId", String.valueOf(branchId)).header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"choiceCode\":\"ACT\"}"))
                .andReturn().getResponse();
        assertThat(choiceResponse.getStatus()).isEqualTo(200);
        assertThat(objectMapper.readTree(choiceResponse.getContentAsString()).get("event").get("status").asText()).isEqualTo("RESOLVED");

        JsonNode timeline = objectMapper.readTree(mvc.perform(get("/api/worlds/{worldId}/timeline", worldId)
                        .param("branchId", String.valueOf(branchId)).header("Authorization", bearer(token)))
                .andReturn().getResponse().getContentAsString());
        long tickTimelineId = -1;
        for (JsonNode node : timeline) {
            if ("SIMULATION_TICK".equals(node.get("eventType").asText())) {
                tickTimelineId = node.get("id").asLong();
                break;
            }
        }
        assertThat(tickTimelineId).isPositive();
        var forkResponse = mvc.perform(post("/api/worlds/{worldId}/branches/{branchId}/fork", worldId, branchId)
                        .header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"timelineEventId\":" + tickTimelineId + ",\"name\":\"另一条线\"}"))
                .andReturn().getResponse();
        assertThat(forkResponse.getStatus()).withFailMessage(forkResponse.getContentAsString()).isEqualTo(200);
        long forkBranchId = objectMapper.readTree(forkResponse.getContentAsString()).get("branch").get("id").asLong();
        assertThat(forkBranchId).isNotEqualTo(branchId);
        JsonNode forkState = objectMapper.readTree(mvc.perform(get("/api/worlds/{worldId}/state", worldId)
                        .param("branchId", String.valueOf(forkBranchId)).header("Authorization", bearer(token)))
                .andReturn().getResponse().getContentAsString());
        assertThat(forkState.get("branchId").asLong()).isEqualTo(forkBranchId);
        assertThat(forkState.get("overview").get("clock").get("currentDate").asText()).isEqualTo("2026-01-02");
    }

    @Test
    void privateWorldIsolatedBetweenUsers() throws Exception {
        String ownerToken = register("owner@example.com");
        String otherToken = register("other@example.com");
        String body = mvc.perform(post("/api/worlds").header("Authorization", bearer(ownerToken))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"私有星港\",\"seed\":9}"))
                .andReturn().getResponse().getContentAsString();
        long worldId = objectMapper.readTree(body).get("id").asLong();

        assertThat(mvc.perform(get("/api/worlds/{worldId}", worldId).header("Authorization", bearer(otherToken)))
                .andReturn().getResponse().getStatus()).isEqualTo(404);
    }

    private String register(String email) throws Exception {
        var response = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"sekai-pass-123\",\"displayName\":\"测试者\"}"))
                .andReturn().getResponse();
        assertThat(response.getStatus()).withFailMessage(response.getContentAsString()).isEqualTo(200);
        String body = response.getContentAsString();
        JsonNode root = objectMapper.readTree(body);
        return root.get("token").asText();
    }

    private String bearer(String token) { return "Bearer " + token; }
}
