package com.sekai.draw.lots.service.impl;

import com.sekai.draw.lots.dataobject.SekaiDrawLotsFocusSessionDO;
import com.sekai.draw.lots.dataobject.SekaiDrawLotsTaskDO;
import com.sekai.draw.lots.mapper.SekaiDrawLotsFocusSessionMapper;
import com.sekai.draw.lots.mapper.SekaiDrawLotsTaskMapper;
import com.sekai.draw.lots.model.FocusSession;
import com.sekai.draw.lots.model.FocusStats;
import com.sekai.draw.lots.model.InsightMetric;
import com.sekai.draw.lots.model.Result;
import com.sekai.draw.lots.model.User;
import com.sekai.draw.lots.service.FocusService;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class FocusServiceImpl implements FocusService {

    private static final DateTimeFormatter EXPORT_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final DateTimeFormatter DAY_LABEL = DateTimeFormatter.ofPattern("MM-dd");
    private static final Set<String> ENERGY_LABELS = Set.of("专注", "深度", "学习", "创作", "代码", "复盘", "轻量");

    @Resource
    private SekaiDrawLotsFocusSessionMapper focusSessionMapper;

    @Resource
    private SekaiDrawLotsTaskMapper taskMapper;

    @Override
    public FocusStats stats(User user) {
        FocusStats stats = new FocusStats();
        if (user == null || user.getId() == null) {
            return stats;
        }
        LocalDate today = LocalDate.now();
        LocalDateTime todayStart = today.atStartOfDay();
        LocalDateTime weekStart = today.minusDays(6).atStartOfDay();
        stats.setTodayMinutes(nullToZero(focusSessionMapper.sumMinutesSince(user.getId(), todayStart)));
        stats.setWeekMinutes(nullToZero(focusSessionMapper.sumMinutesSince(user.getId(), weekStart)));
        stats.setTodaySessions(focusSessionMapper.countSince(user.getId(), todayStart));
        stats.setTotalSessions(focusSessionMapper.countAllByUserId(user.getId()));
        stats.setActiveDays(focusSessionMapper.countActiveDaysSince(user.getId(), today.minusDays(29).atStartOfDay()));
        return stats;
    }

    @Override
    public List<FocusSession> recentSessions(User user, int limit) {
        if (user == null || user.getId() == null) {
            return List.of();
        }
        return focusSessionMapper.selectRecentByUserId(user.getId(), Math.max(1, Math.min(limit, 100))).stream()
                .map(SekaiDrawLotsFocusSessionDO::convertToSession)
                .toList();
    }

    @Override
    public List<InsightMetric> dailyMinutes(User user, int days) {
        if (user == null || user.getId() == null) {
            return List.of();
        }
        int safeDays = Math.max(3, Math.min(days, 31));
        LocalDate start = LocalDate.now().minusDays(safeDays - 1L);
        Map<String, InsightMetric> series = new LinkedHashMap<>();
        for (int i = 0; i < safeDays; i++) {
            String label = DAY_LABEL.format(start.plusDays(i));
            InsightMetric metric = new InsightMetric();
            metric.setLabel(label);
            metric.setCount(0);
            metric.setScore(0);
            series.put(label, metric);
        }
        for (InsightMetric metric : focusSessionMapper.selectDailyMinutes(user.getId(), start.atStartOfDay())) {
            if (series.containsKey(metric.getLabel())) {
                series.put(metric.getLabel(), metric);
            }
        }
        return List.copyOf(series.values());
    }

    @Override
    @Transactional
    public Result<FocusSession> recordSession(User user,
                                              Long taskId,
                                              String taskTitle,
                                              Integer plannedMinutes,
                                              Integer actualMinutes,
                                              String energyLabel,
                                              String note,
                                              boolean completeTask) {
        if (user == null || user.getId() == null) {
            return Result.fail("请先登录");
        }
        int planned = clamp(plannedMinutes == null ? 25 : plannedMinutes, 5, 240);
        int actual = clamp(actualMinutes == null ? planned : actualMinutes, 1, 480);
        String normalizedEnergy = normalizeEnergy(energyLabel);
        String normalizedNote = limitText(trimToNull(note), 260);
        Long linkedTaskId = null;
        String resolvedTitle = trimToNull(taskTitle);

        if (taskId != null) {
            SekaiDrawLotsTaskDO taskDO = taskMapper.selectByIdForUser(taskId, user.getId());
            if (taskDO == null || "ARCHIVED".equals(taskDO.getStatus())) {
                return Result.fail("任务不存在或已搁置");
            }
            linkedTaskId = taskDO.getId();
            resolvedTitle = taskDO.getTitle();
        }
        if (trimToNull(resolvedTitle) == null) {
            resolvedTitle = "自由专注";
        }

        LocalDateTime now = LocalDateTime.now().withNano(0);
        SekaiDrawLotsFocusSessionDO sessionDO = new SekaiDrawLotsFocusSessionDO();
        sessionDO.setUserId(user.getId());
        sessionDO.setTaskId(linkedTaskId);
        sessionDO.setTaskTitle(limitText(resolvedTitle, 120));
        sessionDO.setPlannedMinutes(planned);
        sessionDO.setActualMinutes(actual);
        sessionDO.setEnergyLabel(normalizedEnergy);
        sessionDO.setNote(normalizedNote);
        sessionDO.setCompletedTime(now);
        focusSessionMapper.insert(sessionDO);

        if (completeTask && linkedTaskId != null) {
            taskMapper.updateStatusForUser(linkedTaskId, user.getId(), "DONE", now);
        }

        Result<FocusSession> result = Result.ok(focusSessionMapper.selectByPrimaryKey(sessionDO.getId()).convertToSession());
        result.setMessage(completeTask && linkedTaskId != null ? "专注已记录，关联任务已完成。" : "专注已记录。");
        return result;
    }

    @Override
    public String exportMarkdown(User user) {
        StringBuilder markdown = new StringBuilder();
        FocusStats focusStats = stats(user);
        markdown.append("# VIP 专注冲刺记录\n\n");
        markdown.append("导出时间：").append(EXPORT_TIME.format(LocalDateTime.now())).append("\n\n");
        markdown.append("- 今日专注：").append(focusStats.getTodayHoursText()).append("\n");
        markdown.append("- 7 日专注：").append(focusStats.getWeekHoursText()).append("\n");
        markdown.append("- 今日次数：").append(focusStats.getTodaySessions()).append("\n");
        markdown.append("- 总冲刺数：").append(focusStats.getTotalSessions()).append("\n");
        markdown.append("- 近 30 日活跃天数：").append(focusStats.getActiveDays()).append("\n\n");
        markdown.append("## 最近记录\n\n");
        for (FocusSession session : recentSessions(user, 100)) {
            markdown.append("- ")
                    .append(session.getCompletedText())
                    .append(" / ")
                    .append(session.getDurationText())
                    .append(" / ")
                    .append(session.getEnergyText())
                    .append(" / ")
                    .append(session.getTaskTitleText())
                    .append("\n");
            if (trimToNull(session.getNote()) != null) {
                markdown.append("  - ").append(session.getNote()).append("\n");
            }
        }
        return markdown.toString();
    }

    private String normalizeEnergy(String value) {
        String normalized = trimToNull(value);
        return normalized != null && ENERGY_LABELS.contains(normalized) ? normalized : "专注";
    }

    private int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(value, max));
    }

    private int nullToZero(Integer value) {
        return value == null ? 0 : value;
    }

    private String limitText(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
