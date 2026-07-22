package com.sekai.draw.lots.service.impl;

import com.sekai.draw.lots.dataobject.SekaiDrawLotsTaskDO;
import com.sekai.draw.lots.mapper.SekaiDrawLotsTaskMapper;
import com.sekai.draw.lots.model.ActionTask;
import com.sekai.draw.lots.model.CoachStep;
import com.sekai.draw.lots.model.Result;
import com.sekai.draw.lots.model.TaskBoardStats;
import com.sekai.draw.lots.model.User;
import com.sekai.draw.lots.model.VipCoachPlan;
import com.sekai.draw.lots.service.DrawLotsService;
import com.sekai.draw.lots.service.TaskService;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class TaskServiceImpl implements TaskService {

    private static final DateTimeFormatter EXPORT_DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    @Resource
    private SekaiDrawLotsTaskMapper taskMapper;

    @Resource
    private DrawLotsService drawLotsService;

    @Override
    public List<ActionTask> tasks(User user, String status, int limit) {
        if (user == null || user.getId() == null) {
            return List.of();
        }
        return taskMapper.selectByUser(user.getId(), normalizeStatus(status), Math.max(1, Math.min(limit, 300))).stream()
                .map(SekaiDrawLotsTaskDO::convertToTask)
                .toList();
    }

    @Override
    public TaskBoardStats stats(User user) {
        TaskBoardStats stats = new TaskBoardStats();
        for (ActionTask task : tasks(user, "ALL", 500)) {
            stats.setTotal(stats.getTotal() + 1);
            if (task.isOpen()) {
                stats.setOpen(stats.getOpen() + 1);
            }
            if (task.isDone()) {
                stats.setDone(stats.getDone() + 1);
            }
            if (task.isOverdue()) {
                stats.setOverdue(stats.getOverdue() + 1);
            }
            if (task.getPriority() != null && task.getPriority() >= 4 && task.isOpen()) {
                stats.setHighPriority(stats.getHighPriority() + 1);
            }
        }
        return stats;
    }

    @Override
    @Transactional
    public Result<ActionTask> addTask(User user, String title, String detail, Integer priority, LocalDate dueDate) {
        if (user == null || user.getId() == null) {
            return Result.fail("请先登录");
        }
        String normalizedTitle = trimToNull(title);
        if (normalizedTitle == null) {
            return Result.fail("任务标题不能为空");
        }
        if (normalizedTitle.length() > 100) {
            return Result.fail("任务标题不能超过 100 个字符");
        }
        String normalizedDetail = trimToNull(detail);
        if (normalizedDetail != null && normalizedDetail.length() > 300) {
            return Result.fail("任务说明不能超过 300 个字符");
        }

        SekaiDrawLotsTaskDO taskDO = new SekaiDrawLotsTaskDO();
        taskDO.setUserId(user.getId());
        taskDO.setTitle(normalizedTitle);
        taskDO.setDetail(normalizedDetail);
        taskDO.setSourceType("manual");
        taskDO.setPriority(clampPriority(priority));
        taskDO.setStatus("OPEN");
        taskDO.setDueDate(dueDate);
        taskMapper.insert(taskDO);

        Result<ActionTask> result = Result.ok(taskMapper.selectByIdForUser(taskDO.getId(), user.getId()).convertToTask());
        result.setMessage("任务已加入行动看板。");
        return result;
    }

    @Override
    @Transactional
    public Result<Integer> importCoachTasks(User user) {
        if (user == null || user.getId() == null) {
            return Result.fail("请先登录");
        }
        VipCoachPlan plan = drawLotsService.getVipCoachPlan(user);
        List<CoachStep> steps = plan == null || plan.getSteps() == null ? List.of() : plan.getSteps();
        if (steps.isEmpty()) {
            return Result.fail("行动计划还没有可导入的步骤，请先完成一次抽签。");
        }

        int added = 0;
        LocalDate today = LocalDate.now();
        for (CoachStep step : steps) {
            if (step == null || trimToNull(step.getTitle()) == null) {
                continue;
            }
            String title = "Day " + safeDay(step.getDayIndex()) + "：" + step.getTitle();
            if (taskMapper.countActiveTitle(user.getId(), title) > 0) {
                continue;
            }
            SekaiDrawLotsTaskDO taskDO = new SekaiDrawLotsTaskDO();
            taskDO.setUserId(user.getId());
            taskDO.setTitle(title);
            taskDO.setDetail(buildCoachDetail(step));
            taskDO.setSourceType("coach");
            taskDO.setPriority(step.getDayIndex() != null && step.getDayIndex() <= 2 ? 5 : 4);
            taskDO.setStatus("OPEN");
            taskDO.setDueDate(today.plusDays(Math.max(0, safeDay(step.getDayIndex()) - 1L)));
            taskMapper.insert(taskDO);
            added++;
        }

        Result<Integer> result = Result.ok(added);
        result.setMessage(added > 0 ? "已从行动计划导入 " + added + " 个任务。" : "行动计划任务已经在看板里了。");
        return result;
    }

    @Override
    @Transactional
    public Result<Boolean> complete(User user, Long id) {
        return changeStatus(user, id, "DONE", LocalDateTime.now(), "任务已完成。");
    }

    @Override
    @Transactional
    public Result<Boolean> reopen(User user, Long id) {
        return changeStatus(user, id, "OPEN", null, "任务已恢复进行中。");
    }

    @Override
    @Transactional
    public Result<Boolean> archive(User user, Long id) {
        return changeStatus(user, id, "ARCHIVED", null, "任务已搁置。");
    }

    @Override
    public String exportMarkdown(User user) {
        StringBuilder markdown = new StringBuilder();
        markdown.append("# VIP 行动任务看板\n\n");
        markdown.append("导出时间：").append(EXPORT_DATE.format(LocalDateTime.now())).append("\n\n");
        TaskBoardStats boardStats = stats(user);
        markdown.append("- 进行中：").append(boardStats.getOpen()).append("\n");
        markdown.append("- 已完成：").append(boardStats.getDone()).append("\n");
        markdown.append("- 已逾期：").append(boardStats.getOverdue()).append("\n");
        markdown.append("- 完成率：").append(boardStats.getCompletionPercent()).append("%\n\n");
        markdown.append("## 任务\n\n");
        for (ActionTask task : tasks(user, "ALL", 300)) {
            markdown.append(task.isDone() ? "- [x] " : "- [ ] ")
                    .append(task.getTitle())
                    .append("（").append(task.getStatusText())
                    .append(" / ").append(task.getPriorityText())
                    .append(" / ").append(task.getDueDateText())
                    .append("）\n");
            if (trimToNull(task.getDetail()) != null) {
                markdown.append("  - ").append(task.getDetail()).append("\n");
            }
        }
        return markdown.toString();
    }

    private Result<Boolean> changeStatus(User user, Long id, String status, LocalDateTime completedTime, String message) {
        if (user == null || user.getId() == null) {
            return Result.fail("请先登录");
        }
        if (id == null || taskMapper.selectByIdForUser(id, user.getId()) == null) {
            return Result.fail("任务不存在");
        }
        taskMapper.updateStatusForUser(id, user.getId(), status, completedTime);
        Result<Boolean> result = Result.ok(true);
        result.setMessage(message);
        return result;
    }

    private String buildCoachDetail(CoachStep step) {
        String action = trimToNull(step.getAction()) == null ? "完成一个可以收尾的小动作。" : step.getAction();
        String checkpoint = trimToNull(step.getCheckpoint()) == null ? "留下一个可见结果" : step.getCheckpoint();
        return action + " 检查点：" + checkpoint;
    }

    private int safeDay(Integer dayIndex) {
        return dayIndex == null ? 1 : Math.max(1, Math.min(dayIndex, 31));
    }

    private int clampPriority(Integer priority) {
        return Math.max(1, Math.min(priority == null ? 3 : priority, 5));
    }

    private String normalizeStatus(String status) {
        String normalized = trimToNull(status);
        if (normalized == null || "ALL".equalsIgnoreCase(normalized)) {
            return "ALL";
        }
        return switch (normalized.toUpperCase()) {
            case "OPEN" -> "OPEN";
            case "DONE" -> "DONE";
            case "ARCHIVED" -> "ARCHIVED";
            default -> "ALL";
        };
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
