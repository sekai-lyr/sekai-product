package com.ykd.claw.agent;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ykd.claw.agent.entity.AgentExecutionEntity;
import com.ykd.claw.agent.entity.ToolExecutionEntity;
import com.ykd.claw.agent.repository.AgentExecutionJpaRepository;
import com.ykd.claw.agent.repository.ToolExecutionJpaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class AgentAuditService {
    private static final Logger LOGGER = LoggerFactory.getLogger("AGENT_FULL_TRACE");

    private final AgentExecutionJpaRepository agentRepository;
    private final ToolExecutionJpaRepository toolRepository;
    private final ObjectMapper objectMapper;
    private final List<Consumer<AuditActivity>> activityListeners = new CopyOnWriteArrayList<>();

    public AgentAuditService(AgentExecutionJpaRepository agentRepository,
                             ToolExecutionJpaRepository toolRepository,
                             ObjectMapper objectMapper) {
        this.agentRepository = agentRepository;
        this.toolRepository = toolRepository;
        this.objectMapper = objectMapper;
    }

    /** 一次 Agent/工具审计事件(供监测看板动态流与告警订阅)。 */
    public record AuditActivity(String type, String userId, String conversationId,
                                String summary, Instant timestamp) {
    }

    /** 订阅审计事件(动态流 / 桌面告警)。只读触发,不阻塞审计落库。 */
    public void addActivityListener(Consumer<AuditActivity> listener) {
        if (listener != null) {
            activityListeners.add(listener);
        }
    }

    private void emit(String type, String userId, String conversationId, String summary) {
        AuditActivity event = new AuditActivity(type, userId, conversationId, summary, Instant.now());
        for (Consumer<AuditActivity> listener : activityListeners) {
            try {
                listener.accept(event);
            } catch (RuntimeException ignored) {
                // 监听器失败不影响审计主流程
            }
        }
    }

    private void emitTool(String type, String executionId, String toolName, String summary) {
        agentRepository.findByExecutionId(executionId).ifPresentOrElse(
                entity -> emit(type, entity.getUserId(), entity.getConversationId(), summary),
                () -> emit(type, null, null, summary));
    }

    private static String excerpt(String text) {
        if (text == null || text.isBlank()) return "";
        String flat = text.replaceAll("\\s+", " ").trim();
        return flat.length() > 40 ? flat.substring(0, 40) + "…" : flat;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public String startAgent(String userId, String conversationId, int attempt, String userMessage,
                             String systemPrompt, Object history, Object memories, Object selectedTools) {
        String executionId = UUID.randomUUID().toString();
        String historyJson = json(history);
        String memoriesJson = json(memories);
        String toolsJson = json(selectedTools);
        agentRepository.save(new AgentExecutionEntity(executionId, userId, conversationId, attempt,
                userMessage, systemPrompt, historyJson, memoriesJson, toolsJson, Instant.now()));
        LOGGER.info("""
                AGENT_START executionId=%s userId=%s conversationId=%s attempt=%d
                USER_MESSAGE:
                %s
                SYSTEM_PROMPT:
                %s
                HISTORY:
                %s
                MEMORIES:
                %s
                SELECTED_TOOLS:
                %s""".formatted(executionId, userId, conversationId, attempt, userMessage,
                systemPrompt, historyJson, memoriesJson, toolsJson));
        emit("agent_start", userId, conversationId, "执行开始 · " + excerpt(userMessage));
        return executionId;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void agentSucceeded(String executionId, String response) {
        agentRepository.findByExecutionId(executionId).ifPresent(entity -> {
            entity.succeed(response, Instant.now());
            agentRepository.save(entity);
            emit("agent_success", entity.getUserId(), entity.getConversationId(), "执行成功");
        });
        LOGGER.info("AGENT_SUCCESS executionId=" + executionId + "\nRESPONSE:\n" + response);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void updateSystemPrompt(String executionId, String systemPrompt) {
        agentRepository.findByExecutionId(executionId).ifPresent(entity -> {
            entity.updateSystemPrompt(systemPrompt);
            agentRepository.save(entity);
        });
        LOGGER.info("AGENT_PROMPT_UPDATED executionId=" + executionId
                + "\nSYSTEM_PROMPT:\n" + systemPrompt);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void agentFailed(String executionId, Throwable error) {
        String detail = stackTrace(error);
        agentRepository.findByExecutionId(executionId).ifPresent(entity -> {
            entity.fail(detail, Instant.now());
            agentRepository.save(entity);
            emit("agent_failed", entity.getUserId(), entity.getConversationId(),
                    "执行失败 · " + excerpt(error == null ? "" : error.getMessage()));
        });
        LOGGER.error( "AGENT_FAILURE executionId=" + executionId, error);
    }

    public void performance(String executionId, AgentPerformanceTrace trace) {
        LOGGER.info("AGENT_PERFORMANCE executionId=" + executionId + " " + trace.summary());
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public ToolExecutionEntity startTool(String executionId, String toolName, String arguments) {
        ToolExecutionEntity entity = toolRepository.save(
                new ToolExecutionEntity(executionId, toolName, arguments, Instant.now()));
        emitTool("tool_start", executionId, toolName, "工具调用 · " + toolName + " " + excerpt(arguments));
        LOGGER.info("TOOL_START executionId=" + executionId + " tool=" + toolName
                + "\nARGUMENTS:\n" + arguments);
        return entity;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void toolSucceeded(String executionId, String toolName, ToolExecutionEntity entity, String result) {
        entity.succeed(result, Instant.now());
        toolRepository.save(entity);
        emitTool("tool_success", executionId, toolName, "工具成功 · " + toolName);
        LOGGER.info("TOOL_SUCCESS executionId=" + executionId + " tool=" + toolName
                + "\nRESULT:\n" + result);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void toolFailed(String executionId, String toolName, ToolExecutionEntity entity, Throwable error) {
        entity.fail(stackTrace(error), Instant.now());
        toolRepository.save(entity);
        emitTool("tool_failed", executionId, toolName, "工具失败 · " + toolName
                + (error == null ? "" : " · " + excerpt(error.getMessage())));
        LOGGER.error("TOOL_FAILURE executionId=" + executionId + " tool=" + toolName, error);
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            return String.valueOf(value);
        }
    }

    private static String stackTrace(Throwable error) {
        java.io.StringWriter writer = new java.io.StringWriter();
        error.printStackTrace(new java.io.PrintWriter(writer));
        return writer.toString();
    }
}
