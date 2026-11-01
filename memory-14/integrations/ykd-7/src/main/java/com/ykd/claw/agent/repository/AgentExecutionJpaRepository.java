package com.ykd.claw.agent.repository;

import com.ykd.claw.agent.entity.AgentExecutionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface AgentExecutionJpaRepository extends JpaRepository<AgentExecutionEntity, Long> {
    Optional<AgentExecutionEntity> findByExecutionId(String executionId);

    List<AgentExecutionEntity> findTop200ByOrderByStartedTimeDesc();

    List<AgentExecutionEntity> findByStatusOrderByStartedTimeDesc(String status);

    List<AgentExecutionEntity> findByUserIdOrderByStartedTimeDesc(String userId);

    long countByStatus(String status);

    /** 删除某时间之前的执行记录(数据保留清理)。 */
    long deleteByStartedTimeBefore(Instant cutoff);
}
