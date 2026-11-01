package com.ykd.claw.webui;

import com.ykd.claw.agent.entity.AgentExecutionEntity;
import com.ykd.claw.agent.repository.AgentExecutionJpaRepository;
import com.ykd.claw.agent.repository.ToolExecutionJpaRepository;
import com.ykd.claw.webui.dto.AgentExecutionDetailView;
import com.ykd.claw.webui.dto.AgentExecutionView;
import com.ykd.claw.webui.dto.ToolExecutionView;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Agent 执行与工具调用审计的只读监控。 */
@Service
public class AuditMonitorService {

    private final AgentExecutionJpaRepository agentRepository;
    private final ToolExecutionJpaRepository toolRepository;

    public AuditMonitorService(AgentExecutionJpaRepository agentRepository,
                               ToolExecutionJpaRepository toolRepository) {
        this.agentRepository = agentRepository;
        this.toolRepository = toolRepository;
    }

    /** 一次执行的完整详情(含上下文与工具明细)。 */
    @Transactional(readOnly = true)
    public AgentExecutionDetailView executionDetail(String executionId) {
        if (executionId == null || executionId.isBlank()) {
            throw new IllegalArgumentException("executionId is required");
        }
        AgentExecutionEntity entity = agentRepository.findByExecutionId(executionId)
                .orElseThrow(() -> new IllegalArgumentException("execution not found: " + executionId));
        return AgentExecutionDetailView.from(entity, listTools(executionId));
    }

    @Transactional(readOnly = true)
    public List<AgentExecutionView> listExecutions(int limit, String status, String userId) {
        List<AgentExecutionEntity> entities;
        if (status != null && !status.isBlank()) {
            entities = agentRepository.findByStatusOrderByStartedTimeDesc(status);
        } else if (userId != null && !userId.isBlank()) {
            entities = agentRepository.findByUserIdOrderByStartedTimeDesc(userId);
        } else {
            entities = agentRepository.findTop200ByOrderByStartedTimeDesc();
        }
        return entities.stream().limit(Math.max(1, limit)).map(AgentExecutionView::from).toList();
    }

    @Transactional(readOnly = true)
    public List<ToolExecutionView> listTools(String executionId) {
        if (executionId == null || executionId.isBlank()) {
            throw new IllegalArgumentException("executionId is required");
        }
        return toolRepository.findByExecutionIdOrderByStartedTimeAsc(executionId).stream()
                .map(ToolExecutionView::from)
                .toList();
    }

    /** 失败的执行(异常列表)。 */
    @Transactional(readOnly = true)
    public List<AgentExecutionView> listErrors(int limit) {
        return agentRepository.findByStatusOrderByStartedTimeDesc("failed").stream()
                .limit(Math.max(1, limit))
                .map(AgentExecutionView::from)
                .toList();
    }
}
