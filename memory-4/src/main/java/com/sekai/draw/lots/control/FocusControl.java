package com.sekai.draw.lots.control;

import com.sekai.draw.lots.model.FocusSession;
import com.sekai.draw.lots.model.Result;
import com.sekai.draw.lots.model.User;
import com.sekai.draw.lots.service.FocusService;
import com.sekai.draw.lots.service.MembershipService;
import com.sekai.draw.lots.service.TaskService;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;

@Controller
public class FocusControl {

    @Resource
    private FocusService focusService;

    @Resource
    private TaskService taskService;

    @Resource
    private MembershipService membershipService;

    @GetMapping("/focus")
    public String focus(HttpSession session, Model model) {
        User user = requireLogin(session);
        if (user == null) {
            return "redirect:/login";
        }
        if (!membershipService.isPremium(user)) {
            return "redirect:/membership?locked=focus";
        }
        model.addAttribute("loginUser", user);
        model.addAttribute("membership", membershipService.getStatus(user));
        model.addAttribute("stats", focusService.stats(user));
        model.addAttribute("dailyMinutes", focusService.dailyMinutes(user, 7));
        model.addAttribute("recentSessions", focusService.recentSessions(user, 30));
        model.addAttribute("openTasks", taskService.tasks(user, "OPEN", 80));
        return "focus";
    }

    @PostMapping("/focus/sessions")
    @ResponseBody
    public Result<FocusSession> recordSession(HttpSession session,
                                              @RequestParam(value = "taskId", required = false) Long taskId,
                                              @RequestParam(value = "taskTitle", required = false) String taskTitle,
                                              @RequestParam(value = "plannedMinutes", required = false) Integer plannedMinutes,
                                              @RequestParam(value = "actualMinutes", required = false) Integer actualMinutes,
                                              @RequestParam(value = "energyLabel", required = false) String energyLabel,
                                              @RequestParam(value = "note", required = false) String note,
                                              @RequestParam(value = "completeTask", defaultValue = "false") boolean completeTask) {
        User user = requireLogin(session);
        if (user == null) {
            return Result.fail("请先登录");
        }
        if (!membershipService.isPremium(user)) {
            return Result.fail("专注冲刺是会员功能，请先开通会员。");
        }
        return focusService.recordSession(user, taskId, taskTitle, plannedMinutes, actualMinutes, energyLabel, note, completeTask);
    }

    @GetMapping("/focus/export.md")
    public ResponseEntity<byte[]> exportMarkdown(HttpSession session) {
        User user = requireLogin(session);
        if (user == null || !membershipService.isPremium(user)) {
            return ResponseEntity.status(403).body("请先开通会员。".getBytes(StandardCharsets.UTF_8));
        }
        byte[] body = focusService.exportMarkdown(user).getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(1, TimeUnit.MINUTES))
                .contentType(MediaType.valueOf("text/markdown;charset=UTF-8"))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename("sekai-focus.md", StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .body(body);
    }

    private User requireLogin(HttpSession session) {
        Object loginUser = session.getAttribute("loginUser");
        return loginUser instanceof User user ? user : null;
    }
}
