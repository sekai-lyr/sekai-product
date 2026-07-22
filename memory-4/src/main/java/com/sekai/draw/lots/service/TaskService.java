package com.sekai.draw.lots.service;

import com.sekai.draw.lots.model.ActionTask;
import com.sekai.draw.lots.model.Result;
import com.sekai.draw.lots.model.TaskBoardStats;
import com.sekai.draw.lots.model.User;

import java.time.LocalDate;
import java.util.List;

public interface TaskService {
    List<ActionTask> tasks(User user, String status, int limit);
    TaskBoardStats stats(User user);
    Result<ActionTask> addTask(User user, String title, String detail, Integer priority, LocalDate dueDate);
    Result<Integer> importCoachTasks(User user);
    Result<Boolean> complete(User user, Long id);
    Result<Boolean> reopen(User user, Long id);
    Result<Boolean> archive(User user, Long id);
    String exportMarkdown(User user);
}
