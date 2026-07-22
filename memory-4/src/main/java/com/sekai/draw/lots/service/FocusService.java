package com.sekai.draw.lots.service;

import com.sekai.draw.lots.model.FocusSession;
import com.sekai.draw.lots.model.FocusStats;
import com.sekai.draw.lots.model.InsightMetric;
import com.sekai.draw.lots.model.Result;
import com.sekai.draw.lots.model.User;

import java.util.List;

public interface FocusService {
    FocusStats stats(User user);
    List<FocusSession> recentSessions(User user, int limit);
    List<InsightMetric> dailyMinutes(User user, int days);
    Result<FocusSession> recordSession(User user,
                                       Long taskId,
                                       String taskTitle,
                                       Integer plannedMinutes,
                                       Integer actualMinutes,
                                       String energyLabel,
                                       String note,
                                       boolean completeTask);
    String exportMarkdown(User user);
}
