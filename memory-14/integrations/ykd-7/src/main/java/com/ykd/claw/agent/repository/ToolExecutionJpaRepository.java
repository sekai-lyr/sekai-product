package com.ykd.claw.agent.repository;

import com.ykd.claw.agent.entity.ToolExecutionEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;

public interface ToolExecutionJpaRepository extends JpaRepository<ToolExecutionEntity, Long> {

    List<ToolExecutionEntity> findByExecutionIdOrderByStartedTimeAsc(String executionId);

    long countByStatus(String status);

    /** 按工具名统计调用次数(监测看板"工具排行")。 */
    @Query("select t.toolName, count(t) from ToolExecutionEntity t group by t.toolName order by count(t) desc")
    List<Object[]> countByToolName(Pageable pageable);

    /** 按工具名统计平均耗时(监测看板"性能分析")。 */
    @Query("select t.toolName, avg(t.durationMs), count(t) from ToolExecutionEntity t " +
            "where t.durationMs is not null group by t.toolName order by avg(t.durationMs) desc")
    List<Object[]> avgDurationByTool();

    /** 删除某时间之前的工具记录(数据保留清理)。 */
    long deleteByStartedTimeBefore(Instant cutoff);
}
