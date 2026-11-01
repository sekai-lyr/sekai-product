package com.ykd.claw.webui;

import com.ykd.claw.memory.entity.ChatMessageEntity;
import com.ykd.claw.memory.repository.ConversationJpaRepository;
import com.ykd.claw.webui.dto.ConversationSummary;
import com.ykd.claw.webui.dto.WebUserSummary;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * 聚合 chat_message 表,产出监测看板所需的用户/会话目录。
 * 只列出有消息记录的用户,不触碰长时记忆。
 */
@Service
public class ConversationDirectoryService {

    private static final List<String> MESSAGE_ROLES = List.of("user", "assistant");
    private static final int PREVIEW_LENGTH = 60;

    private final ConversationJpaRepository repository;
    private final UserAliasService userAliasService;

    public ConversationDirectoryService(ConversationJpaRepository repository,
                                        UserAliasService userAliasService) {
        this.repository = repository;
        this.userAliasService = userAliasService;
    }

    /** 全部有消息记录的用户及其会话摘要,按最后活跃时间倒序。 */
    @Transactional(readOnly = true)
    public List<WebUserSummary> listUsers() {
        Map<String, String> aliases = userAliasService.allAliases();
        return repository.findDistinctUserIds().stream()
                .map(userId -> buildUserSummary(userId, aliases.get(userId)))
                .sorted(Comparator.comparing(WebUserSummary::lastMessageAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    /** 某用户的全部会话,按最后活跃时间倒序。 */
    @Transactional(readOnly = true)
    public List<ConversationSummary> listConversations(String userId) {
        List<ConversationSummary> result = new ArrayList<>();
        for (Object[] row : repository.summarizeConversations(require(userId))) {
            String conversationId = (String) row[0];
            Instant lastAt = (Instant) row[1];
            long count = ((Number) row[2]).longValue();
            ChatMessageEntity last = lastMessage(userId, conversationId);
            result.add(new ConversationSummary(conversationId, count, lastAt,
                    last == null ? null : last.getRole(),
                    previewText(last)));
        }
        result.sort(Comparator.comparing(ConversationSummary::lastMessageAt,
                Comparator.nullsLast(Comparator.reverseOrder())));
        return result;
    }

    /**
     * 按会话 ID / userId 前缀标注渠道:会话 ID 带 wx_ → 微信用户
     * (微信路由把 "wx_" 前缀放在 conversationId 上,userId 是原始微信 ID),
     * userId == cli → CLI,其余 other。
     */
    public static String channelOf(String userId, List<ConversationSummary> conversations) {
        if (conversations.stream().anyMatch(c -> c.conversationId().startsWith("wx_"))) {
            return "wechat";
        }
        if ("cli".equals(userId)) return "cli";
        return "other";
    }

    private WebUserSummary buildUserSummary(String userId, String alias) {
        List<ConversationSummary> conversations = listConversations(userId);
        long totalMessages = conversations.stream().mapToLong(ConversationSummary::messageCount).sum();
        Instant lastAt = conversations.stream()
                .map(ConversationSummary::lastMessageAt)
                .filter(Objects::nonNull)
                .max(Instant::compareTo)
                .orElse(null);
        ConversationSummary latest = conversations.stream()
                .filter(c -> c.lastMessagePreview() != null && !c.lastMessagePreview().isBlank())
                .findFirst()
                .orElse(null);
        String preview = latest == null ? "" : latest.lastMessagePreview();
        String previewRole = latest == null ? null : latest.lastMessageRole();
        return new WebUserSummary(userId, channelOf(userId, conversations), conversations.size(),
                totalMessages, lastAt, alias, previewRole, preview, conversations);
    }

    private ChatMessageEntity lastMessage(String userId, String conversationId) {
        List<ChatMessageEntity> last = repository
                .findByUserIdAndConversationIdAndRoleInOrderByCreatedTimeDescIdDesc(
                        userId, conversationId, MESSAGE_ROLES, PageRequest.of(0, 1));
        return last.isEmpty() ? null : last.get(0);
    }

    private static String previewText(ChatMessageEntity message) {
        if (message == null || message.getContent() == null) return "";
        String flat = message.getContent().replaceAll("\\s+", " ").trim();
        return flat.length() > PREVIEW_LENGTH ? flat.substring(0, PREVIEW_LENGTH) + "…" : flat;
    }

    private static String require(String value) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException("userId is required");
        return value;
    }
}
