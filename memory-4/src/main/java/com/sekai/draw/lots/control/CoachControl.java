package com.sekai.draw.lots.control;

import com.sekai.draw.lots.model.CoachStep;
import com.sekai.draw.lots.model.User;
import com.sekai.draw.lots.model.VipCoachPlan;
import com.sekai.draw.lots.service.DrawLotsService;
import com.sekai.draw.lots.service.MembershipService;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

@Controller
public class CoachControl {

    private static final ZoneId ZONE_ID = ZoneId.of("Asia/Shanghai");
    private static final DateTimeFormatter ICS_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss", Locale.ROOT);

    @Resource
    private DrawLotsService drawLotsService;

    @Resource
    private MembershipService membershipService;

    @GetMapping("/coach/export.md")
    public ResponseEntity<byte[]> exportMarkdown(HttpSession session) {
        User user = requireVipUser(session);
        if (user == null) {
            return forbiddenText("请先登录并开通会员。");
        }
        VipCoachPlan plan = drawLotsService.getVipCoachPlan(user);
        byte[] body = buildMarkdown(user, plan).getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .contentType(MediaType.valueOf("text/markdown;charset=UTF-8"))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename("sekai-vip-coach-plan.md", StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .body(body);
    }

    @GetMapping("/coach/calendar.ics")
    public ResponseEntity<byte[]> exportCalendar(HttpSession session) {
        User user = requireVipUser(session);
        if (user == null) {
            return forbiddenText("请先登录并开通会员。");
        }
        VipCoachPlan plan = drawLotsService.getVipCoachPlan(user);
        byte[] body = buildCalendar(user, plan).getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .contentType(MediaType.valueOf("text/calendar;charset=UTF-8"))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename("sekai-vip-coach-plan.ics", StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .body(body);
    }

    private String buildMarkdown(User user, VipCoachPlan plan) {
        StringBuilder builder = new StringBuilder();
        builder.append("# ").append(plan.getTitle()).append("\n\n");
        builder.append("> ").append(user.getNickName()).append(" 的会员行动计划\n\n");
        builder.append(plan.getSummary()).append("\n\n");
        builder.append("## 核心指标\n\n");
        builder.append("- 最近均分：").append(plan.getAverageScore()).append("\n");
        builder.append("- 最高分：").append(plan.getHighScore()).append("\n");
        builder.append("- 最低分：").append(plan.getLowScore()).append("\n");
        builder.append("- 参考样本：").append(plan.getTotalSamples()).append("\n");
        builder.append("- 节奏：").append(plan.getRhythm()).append("\n");
        builder.append("- 风险：").append(plan.getRiskLevel()).append("\n");
        builder.append("- 主题：").append(plan.getPrimaryTheme()).append("\n\n");
        builder.append("## 计划信号\n\n");
        for (String signal : plan.getSignals()) {
            builder.append("- ").append(signal).append("\n");
        }
        builder.append("\n## 7 天执行路径\n\n");
        for (CoachStep step : plan.getSteps()) {
            builder.append("### Day ").append(step.getDayIndex()).append(" · ").append(step.getTitle()).append("\n\n");
            builder.append("- 标签：").append(step.getEnergyLabel()).append(" / ").append(step.getTheme()).append("\n");
            builder.append("- 行动：").append(step.getAction()).append("\n");
            builder.append("- 检查点：").append(step.getCheckpoint()).append("\n\n");
        }
        return builder.toString();
    }

    private String buildCalendar(User user, VipCoachPlan plan) {
        LocalDate startDate = LocalDate.now(ZONE_ID);
        String nowStamp = ICS_FORMATTER.format(LocalDateTime.now(ZONE_ID));
        StringBuilder builder = new StringBuilder();
        builder.append("BEGIN:VCALENDAR\r\n");
        builder.append("VERSION:2.0\r\n");
        builder.append("PRODID:-//Sekai Fortune//VIP Coach//CN\r\n");
        builder.append("CALSCALE:GREGORIAN\r\n");
        builder.append("X-WR-CALNAME:灵感伙伴签 VIP 行动计划\r\n");
        for (CoachStep step : plan.getSteps()) {
            LocalDate day = startDate.plusDays(Math.max(0, step.getDayIndex() - 1));
            LocalDateTime start = LocalDateTime.of(day, LocalTime.of(9, 0));
            LocalDateTime end = start.plusMinutes(30);
            builder.append("BEGIN:VEVENT\r\n");
            builder.append("UID:sekai-coach-").append(user.getId()).append("-").append(step.getDayIndex()).append("-").append(nowStamp).append("@sekai\r\n");
            builder.append("DTSTAMP:").append(nowStamp).append("\r\n");
            builder.append("DTSTART;TZID=Asia/Shanghai:").append(ICS_FORMATTER.format(start)).append("\r\n");
            builder.append("DTEND;TZID=Asia/Shanghai:").append(ICS_FORMATTER.format(end)).append("\r\n");
            builder.append("SUMMARY:").append(escapeIcs("Day " + step.getDayIndex() + " · " + step.getTitle())).append("\r\n");
            builder.append("DESCRIPTION:").append(escapeIcs(step.getAction() + "\\n检查点：" + step.getCheckpoint())).append("\r\n");
            builder.append("CATEGORIES:").append(escapeIcs("灵感伙伴签," + step.getEnergyLabel())).append("\r\n");
            builder.append("END:VEVENT\r\n");
        }
        builder.append("END:VCALENDAR\r\n");
        return builder.toString();
    }

    private String escapeIcs(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("\\", "\\\\")
                .replace(";", "\\;")
                .replace(",", "\\,")
                .replace("\r", "")
                .replace("\n", "\\n");
    }

    private User requireVipUser(HttpSession session) {
        Object loginUser = session.getAttribute("loginUser");
        if (!(loginUser instanceof User user) || !membershipService.isPremium(user)) {
            return null;
        }
        return user;
    }

    private ResponseEntity<byte[]> forbiddenText(String message) {
        return ResponseEntity.status(403)
                .contentType(MediaType.valueOf("text/plain;charset=UTF-8"))
                .body(message.getBytes(StandardCharsets.UTF_8));
    }
}
