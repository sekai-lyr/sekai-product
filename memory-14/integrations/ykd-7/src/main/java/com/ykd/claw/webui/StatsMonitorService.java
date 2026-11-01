package com.ykd.claw.webui;

import com.ykd.claw.agent.entity.AgentExecutionEntity;
import com.ykd.claw.agent.repository.AgentExecutionJpaRepository;
import com.ykd.claw.agent.repository.ToolExecutionJpaRepository;
import com.ykd.claw.knowledge.repository.KnowledgeChunkJpaRepository;
import com.ykd.claw.knowledge.repository.KnowledgeDocumentJpaRepository;
import com.ykd.claw.memory.entity.ChatMessageEntity;
import com.ykd.claw.memory.repository.ConversationJpaRepository;
import com.ykd.claw.memory.repository.MemoryJpaRepository;
import com.ykd.claw.reminder.repository.ReminderJpaRepository;
import com.ykd.claw.webui.dto.PerformanceData;
import com.ykd.claw.webui.dto.StatsData;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** 统计面板:消息量趋势 / 工具使用排行 / 活跃用户 / 总量。 */
@Service
public class StatsMonitorService {

    private final ConversationJpaRepository conversationRepository;
    private final AgentExecutionJpaRepository agentRepository;
    private final ToolExecutionJpaRepository toolRepository;
    private final ReminderJpaRepository reminderRepository;
    private final MemoryJpaRepository memoryRepository;
    private final KnowledgeDocumentJpaRepository documentRepository;
    private final KnowledgeChunkJpaRepository chunkRepository;

    public StatsMonitorService(ConversationJpaRepository conversationRepository,
                               AgentExecutionJpaRepository agentRepository,
                               ToolExecutionJpaRepository toolRepository,
                               ReminderJpaRepository reminderRepository,
                               MemoryJpaRepository memoryRepository,
                               KnowledgeDocumentJpaRepository documentRepository,
                               KnowledgeChunkJpaRepository chunkRepository) {
        this.conversationRepository = conversationRepository;
        this.agentRepository = agentRepository;
        this.toolRepository = toolRepository;
        this.reminderRepository = reminderRepository;
        this.memoryRepository = memoryRepository;
        this.documentRepository = documentRepository;
        this.chunkRepository = chunkRepository;
    }

    @Transactional(readOnly = true)
    public StatsData stats(int days) {
        int window = Math.max(1, Math.min(90, days));
        Instant since = Instant.now().minus(window, ChronoUnit.DAYS);
        List<ChatMessageEntity> messages =
                conversationRepository.findByCreatedTimeGreaterThanEqualOrderByCreatedTime(since);

        Map<String, Long> volume = new LinkedHashMap<>();
        Map<String, Set<String>> active = new LinkedHashMap<>();
        for (ChatMessageEntity m : messages) {
            String date = dateOf(m.getCreatedTime());
            volume.merge(date, 1L, Long::sum);
            active.computeIfAbsent(date, k -> new HashSet<>()).add(m.getUserId());
        }
        List<StatsData.DateCount> volumeList = new ArrayList<>();
        List<StatsData.DateCount> activeList = new ArrayList<>();
        volume.forEach((date, count) -> volumeList.add(new StatsData.DateCount(date, count)));
        active.forEach((date, users) -> activeList.add(new StatsData.DateCount(date, (long) users.size())));

        List<StatsData.ToolCount> toolUsage = toolRepository.countByToolName(PageRequest.of(0, 10)).stream()
                .map(row -> new StatsData.ToolCount((String) row[0], ((Number) row[1]).longValue()))
                .toList();

        Map<String, Long> totals = new LinkedHashMap<>();
        totals.put("messages", conversationRepository.count());
        totals.put("users", (long) conversationRepository.findDistinctUserIds().size());
        totals.put("executions", agentRepository.count());
        totals.put("tools", toolRepository.count());
        totals.put("reminders", reminderRepository.count());
        totals.put("memories", memoryRepository.count());
        totals.put("documents", documentRepository.count());
        totals.put("chunks", chunkRepository.count());

        return new StatsData(volumeList, toolUsage, activeList, totals);
    }

    /** 响应性能:平均/中位耗时、最慢执行、工具耗时排行、每日平均。 */
    @Transactional(readOnly = true)
    public PerformanceData performance() {
        List<AgentExecutionEntity> completed = agentRepository.findTop200ByOrderByStartedTimeDesc().stream()
                .filter(e -> e.getDurationMs() != null)
                .toList();
        long[] durs = completed.stream().mapToLong(AgentExecutionEntity::getDurationMs).sorted().toArray();

        Double avg = durs.length > 0 ? Arrays.stream(durs).average().orElse(0) : null;
        Double median = durs.length > 0
                ? (durs.length % 2 == 1 ? (double) durs[durs.length / 2]
                : (durs[durs.length / 2 - 1] + durs[durs.length / 2]) / 2.0)
                : null;

        List<PerformanceData.SlowExecutionView> slowest = completed.stream()
                .sorted(Comparator.comparing(AgentExecutionEntity::getDurationMs, Comparator.reverseOrder()))
                .limit(10)
                .map(e -> new PerformanceData.SlowExecutionView(
                        e.getExecutionId(), e.getUserId(), e.getUserMessage(),
                        e.getDurationMs(), e.getStartedTime()))
                .toList();

        List<PerformanceData.ToolLatencyView> toolLatency = toolRepository.avgDurationByTool().stream()
                .map(row -> new PerformanceData.ToolLatencyView(
                        (String) row[0], ((Number) row[1]).doubleValue(), ((Number) row[2]).longValue()))
                .toList();

        Map<String, List<Long>> byDay = new HashMap<>();
        for (AgentExecutionEntity e : completed) {
            String date = dateOf(e.getStartedTime());
            byDay.computeIfAbsent(date, k -> new ArrayList<>()).add(e.getDurationMs());
        }
        List<PerformanceData.DailyLatencyView> dailyAvg = byDay.entrySet().stream()
                .map(e -> new PerformanceData.DailyLatencyView(e.getKey(),
                        e.getValue().stream().mapToLong(Long::longValue).average().orElse(0),
                        e.getValue().size()))
                .sorted(Comparator.comparing(PerformanceData.DailyLatencyView::date))
                .toList();

        return new PerformanceData(avg, median, slowest, toolLatency, dailyAvg);
    }

    private static String dateOf(Instant instant) {
        return LocalDate.ofInstant(instant, ZoneId.systemDefault()).toString();
    }
}
