package com.ykd.claw.memory.repository;

import com.ykd.claw.memory.entity.ChatMessageEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface ConversationJpaRepository extends JpaRepository<ChatMessageEntity, Long> {
    List<ChatMessageEntity> findByUserIdAndConversationIdAndRoleInOrderByCreatedTimeDescIdDesc(
            String userId, String conversationId, List<String> roles, Pageable pageable);

    /** 取某会话在 beforeId 之前的更早消息(用于"加载更早"分页)。 */
    List<ChatMessageEntity> findByUserIdAndConversationIdAndRoleInAndIdLessThanOrderByCreatedTimeDescIdDesc(
            String userId, String conversationId, List<String> roles, Long beforeId, Pageable pageable);

    long countByUserIdAndConversationIdAndRoleIn(String userId, String conversationId, List<String> roles);

    void deleteByUserIdAndConversationId(String userId, String conversationId);

    /** All users that have at least one message (for the monitoring dashboard). */
    @Query("select distinct m.userId from ChatMessageEntity m order by m.userId")
    List<String> findDistinctUserIds();

    /** All conversation ids belonging to a user. */
    @Query("select distinct m.conversationId from ChatMessageEntity m where m.userId = :userId")
    List<String> findConversationIdsByUserId(@Param("userId") String userId);

    /** Per-conversation summary for a user: [conversationId, lastMessageTime, messageCount]. */
    @Query("select m.conversationId, max(m.createdTime), count(m) from ChatMessageEntity m " +
            "where m.userId = :userId and m.role in ('user', 'assistant') " +
            "group by m.conversationId order by max(m.createdTime) desc")
    List<Object[]> summarizeConversations(@Param("userId") String userId);

    /** Delete all messages of a user. */
    void deleteByUserId(String userId);

    /** 全文搜索:按消息内容或 userId 模糊匹配(监测看板"搜消息")。 */
    @Query("select m from ChatMessageEntity m where m.content like concat('%', :kw, '%') " +
            "or m.userId like concat('%', :kw, '%') order by m.createdTime desc, m.id desc")
    List<ChatMessageEntity> searchMessages(@Param("kw") String keyword, Pageable pageable);

    /** 取某时间之后的所有消息(供统计在 Java 侧按日聚合,SQLite/Postgres 通用)。 */
    List<ChatMessageEntity> findByCreatedTimeGreaterThanEqualOrderByCreatedTime(Instant since);

    /** 删除某时间之前的消息(数据保留清理)。 */
    long deleteByCreatedTimeBefore(Instant cutoff);
}
