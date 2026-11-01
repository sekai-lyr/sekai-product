package com.ykd.claw.webui;

import com.ykd.claw.knowledge.entity.KnowledgeDocumentEntity;
import com.ykd.claw.knowledge.repository.KnowledgeChunkJpaRepository;
import com.ykd.claw.knowledge.repository.KnowledgeDocumentJpaRepository;
import com.ykd.claw.knowledge.service.KnowledgeIngestionService;
import com.ykd.claw.memory.MemoryService;
import com.ykd.claw.memory.UserMemory;
import com.ykd.claw.reminder.ReminderRecord;
import com.ykd.claw.reminder.ReminderService;
import com.ykd.claw.webui.dto.ActivityEvent;
import com.ykd.claw.webui.dto.AgentExecutionDetailView;
import com.ykd.claw.webui.dto.AgentExecutionView;
import com.ykd.claw.webui.dto.KnowledgeDocumentView;
import com.ykd.claw.webui.dto.PerformanceData;
import com.ykd.claw.webui.dto.RetentionConfig;
import com.ykd.claw.webui.dto.StatsData;
import com.ykd.claw.webui.dto.SystemMetrics;
import com.ykd.claw.webui.dto.ToolExecutionView;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 监测台扩展模块 API:运行日志 / 异常 / 系统健康 / 提醒 / 记忆 / 知识库 / 统计。
 * 只读 + 管理操作,全部复用现有表,不改 Agent 核心逻辑。
 */
@RestController
@RequestMapping("/api/monitor")
@ConditionalOnProperty(prefix = "webui", name = "enabled", havingValue = "true", matchIfMissing = true)
public class ConsoleController {

    private final AuditMonitorService auditMonitorService;
    private final SystemMetricsService systemMetricsService;
    private final StatsMonitorService statsMonitorService;
    private final ReminderService reminderService;
    private final MemoryService memoryService;
    private final KnowledgeIngestionService knowledgeIngestionService;
    private final KnowledgeDocumentJpaRepository documentRepository;
    private final KnowledgeChunkJpaRepository chunkRepository;
    private final EventStreamService eventStreamService;
    private final RetentionService retentionService;

    public ConsoleController(AuditMonitorService auditMonitorService,
                             SystemMetricsService systemMetricsService,
                             StatsMonitorService statsMonitorService,
                             ReminderService reminderService,
                             MemoryService memoryService,
                             KnowledgeIngestionService knowledgeIngestionService,
                             KnowledgeDocumentJpaRepository documentRepository,
                             KnowledgeChunkJpaRepository chunkRepository,
                             EventStreamService eventStreamService,
                             RetentionService retentionService) {
        this.auditMonitorService = auditMonitorService;
        this.systemMetricsService = systemMetricsService;
        this.statsMonitorService = statsMonitorService;
        this.reminderService = reminderService;
        this.memoryService = memoryService;
        this.knowledgeIngestionService = knowledgeIngestionService;
        this.documentRepository = documentRepository;
        this.chunkRepository = chunkRepository;
        this.eventStreamService = eventStreamService;
        this.retentionService = retentionService;
    }

    // ==================== 运行日志 + 异常 ====================

    @GetMapping("/executions")
    public List<AgentExecutionView> executions(@RequestParam(defaultValue = "50") int limit,
                                               @RequestParam(required = false) String status,
                                               @RequestParam(required = false) String userId) {
        return auditMonitorService.listExecutions(limit, status, userId);
    }

    @GetMapping("/executions/{executionId}/tools")
    public List<ToolExecutionView> executionTools(@PathVariable String executionId) {
        return auditMonitorService.listTools(executionId);
    }

    @GetMapping("/errors")
    public List<AgentExecutionView> errors(@RequestParam(defaultValue = "50") int limit) {
        return auditMonitorService.listErrors(limit);
    }

    @GetMapping("/executions/{executionId}")
    public AgentExecutionDetailView executionDetail(@PathVariable String executionId) {
        return auditMonitorService.executionDetail(executionId);
    }

    // ==================== 实时动态流 ====================

    @GetMapping("/activity")
    public List<ActivityEvent> activity(@RequestParam(defaultValue = "50") int limit) {
        return eventStreamService.recentActivity(limit);
    }

    // ==================== 性能分析 ====================

    @GetMapping("/performance")
    public PerformanceData performance() {
        return statsMonitorService.performance();
    }

    // ==================== 数据保留 ====================

    @GetMapping("/retention")
    public RetentionConfig retention() {
        return retentionService.getRetention();
    }

    @PutMapping("/retention")
    public RetentionConfig updateRetention(@RequestBody RetentionRequest request) {
        return retentionService.setRetention(request.enabled(), request.days());
    }

    // ==================== 系统健康 ====================

    @GetMapping("/system")
    public SystemMetrics system() {
        return systemMetricsService.metrics();
    }

    // ==================== 提醒任务 ====================

    @GetMapping("/reminders")
    public List<ReminderRecord> reminders() {
        return reminderService.listAll();
    }

    @PostMapping("/reminders/{id}/cancel")
    public ReminderRecord cancelReminder(@PathVariable long id, @RequestBody UserRef user) {
        return reminderService.cancel(user.userId(), id);
    }

    @PostMapping("/reminders/{id}/retry")
    public ReminderRecord retryReminder(@PathVariable long id, @RequestBody UserRef user) {
        return reminderService.retryFailed(user.userId(), id);
    }

    // ==================== 长期记忆 ====================

    @GetMapping("/memories")
    public List<UserMemory> memories(@RequestParam(required = false) String userId,
                                     @RequestParam(defaultValue = "100") int limit) {
        return userId == null || userId.isBlank()
                ? memoryService.listAll(limit)
                : memoryService.listByUser(userId, limit);
    }

    @DeleteMapping("/memories/{id}")
    public void deleteMemory(@PathVariable long id, @RequestBody UserRef user) {
        memoryService.deleteMemory(user.userId(), id);
    }

    // ==================== 知识库 ====================

    @GetMapping("/knowledge")
    public List<KnowledgeDocumentView> knowledge() {
        return documentRepository.findAll(Sort.by(Sort.Direction.DESC, "createdTime")).stream()
                .map(this::toView)
                .toList();
    }

    @DeleteMapping("/knowledge/{id}")
    public void deleteKnowledge(@PathVariable Long id) {
        knowledgeIngestionService.deleteDocument(id);
    }

    private KnowledgeDocumentView toView(KnowledgeDocumentEntity doc) {
        return new KnowledgeDocumentView(doc.getId(), doc.getFileName(), doc.getSourcePath(),
                chunkRepository.countByDocumentId(doc.getId()), doc.getCreatedTime());
    }

    // ==================== 统计 ====================

    @GetMapping("/stats")
    public StatsData stats(@RequestParam(defaultValue = "14") int days) {
        return statsMonitorService.stats(days);
    }

    /** 请求体:带 userId 的操作。 */
    public record UserRef(String userId) {
    }

    /** 请求体:更新数据保留配置。 */
    public record RetentionRequest(boolean enabled, int days) {
    }
}
