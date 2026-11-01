package com.ykd.claw.memory;

import com.ykd.claw.memory.entity.ChatMessageEntity;
import com.ykd.claw.memory.repository.ConversationJpaRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Service
public class ConversationService {
    private static final List<String> CONVERSATION_ROLES = List.of("user", "assistant");

    private final ConversationJpaRepository repository;
    private final int historyLimit;

    public ConversationService(ConversationJpaRepository repository,
                               @Value("${memory.history-limit:20}") int historyLimit) {
        this.repository = repository;
        this.historyLimit = Math.max(2, historyLimit);
    }

    @Transactional(readOnly = true)
    public List<ChatMessageRecord> getHistory(String userId, String conversationId) {
        return getHistory(userId, conversationId, null, historyLimit);
    }

    /**
     * 按游标分页取会话历史。
     *
     * @param beforeId 只取 id 小于该值的更早消息;为 null 表示取最近 limit 条
     */
    @Transactional(readOnly = true)
    public List<ChatMessageRecord> getHistory(String userId, String conversationId, Long beforeId, int limit) {
        PageRequest page = PageRequest.of(0, Math.max(1, limit));
        List<ChatMessageRecord> history;
        if (beforeId == null) {
            history = repository
                    .findByUserIdAndConversationIdAndRoleInOrderByCreatedTimeDescIdDesc(
                            required(userId, "userId"), required(conversationId, "conversationId"),
                            CONVERSATION_ROLES, page)
                    .stream().map(ConversationService::toRecord).toList();
        } else {
            history = repository
                    .findByUserIdAndConversationIdAndRoleInAndIdLessThanOrderByCreatedTimeDescIdDesc(
                            required(userId, "userId"), required(conversationId, "conversationId"),
                            CONVERSATION_ROLES, beforeId, page)
                    .stream().map(ConversationService::toRecord).toList();
        }
        List<ChatMessageRecord> ascending = new ArrayList<>(history);
        Collections.reverse(ascending);
        return ascending;
    }

    @Transactional
    public void saveTurn(String userId, String conversationId, String userMessage, String assistantMessage) {
        ChatMessageRecord user = ChatMessageRecord.user(
                required(userId, "userId"), required(conversationId, "conversationId"),
                required(userMessage, "userMessage"));
        ChatMessageRecord assistant = ChatMessageRecord.assistant(
                userId, conversationId, required(assistantMessage, "assistantMessage"));
        repository.saveAll(List.of(toEntity(user), toEntity(assistant)));
    }

    @Transactional
    public void saveToolExecution(String userId, String conversationId, String toolName,
                                  String result, String metadata) {
        repository.save(toEntity(ChatMessageRecord.tool(
                required(userId, "userId"), required(conversationId, "conversationId"),
                required(toolName, "toolName"), result == null ? "" : result, metadata)));
    }

    /** 全文搜索消息内容 / userId(监测看板"搜消息")。 */
    @Transactional(readOnly = true)
    public List<ChatMessageRecord> search(String keyword, int limit) {
        return repository.searchMessages(required(keyword, "keyword"),
                        PageRequest.of(0, Math.max(1, limit)))
                .stream()
                .map(ConversationService::toRecord)
                .toList();
    }

    @Transactional
    public void clear(String userId, String conversationId) {
        repository.deleteByUserIdAndConversationId(
                required(userId, "userId"), required(conversationId, "conversationId"));
    }

    /** 删除某用户的全部会话消息(不动长时记忆)。 */
    @Transactional
    public void deleteAll(String userId) {
        repository.deleteByUserId(required(userId, "userId"));
    }

    @Transactional(readOnly = true)
    public int count(String userId, String conversationId) {
        return Math.toIntExact(repository.countByUserIdAndConversationIdAndRoleIn(
                required(userId, "userId"), required(conversationId, "conversationId"), CONVERSATION_ROLES));
    }

    private static String required(String value, String name) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(name + " is required");
        return value;
    }

    private static ChatMessageEntity toEntity(ChatMessageRecord record) {
        return new ChatMessageEntity(record.userId(), record.conversationId(), record.role(),
                record.content(), record.createdTime(), record.toolName(), record.metadata());
    }

    private static ChatMessageRecord toRecord(ChatMessageEntity entity) {
        return new ChatMessageRecord(entity.getId(), entity.getUserId(), entity.getConversationId(),
                entity.getRole(), entity.getContent(), entity.getCreatedTime(),
                entity.getToolName(), entity.getMetadata());
    }
}
