package com.sekai.draw.lots.control;

import com.sekai.draw.lots.model.Result;
import com.sekai.draw.lots.model.User;
import com.sekai.draw.lots.service.MembershipService;
import com.sekai.draw.lots.service.TaskService;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpSession;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.concurrent.TimeUnit;

@Controller
public class TaskControl {

    @Resource
    private TaskService taskService;

    @Resource
    private MembershipService membershipService;

    @GetMapping("/tasks")
    public String tasks(HttpSession session,
                        Model model,
                        @RequestParam(value = "status", defaultValue = "ALL") String status) {
        User user = requireLogin(session);
        if (user == null) {
            return "redirect:/login";
        }
        if (!membershipService.isPremium(user)) {
            return "redirect:/membership?locked=tasks";
        }
        model.addAttribute("loginUser", user);
        model.addAttribute("membership", membershipService.getStatus(user));
        model.addAttribute("status", normalizeStatus(status));
        model.addAttribute("stats", taskService.stats(user));
        model.addAttribute("tasks", taskService.tasks(user, normalizeStatus(status), 200));
        return "tasks";
    }

    @PostMapping("/tasks")
    public String addTask(HttpSession session,
                          @RequestParam("title") String title,
                          @RequestParam(value = "detail", required = false) String detail,
                          @RequestParam(value = "priority", required = false) Integer priority,
                          @RequestParam(value = "dueDate", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dueDate,
                          RedirectAttributes redirectAttributes) {
        User user = requirePremiumUser(session, redirectAttributes);
        if (user == null) {
            return redirectAfterGuard(session);
        }
        addFlash(taskService.addTask(user, title, detail, priority, dueDate), redirectAttributes);
        return "redirect:/tasks";
    }

    @PostMapping("/tasks/import-coach")
    public String importCoachTasks(HttpSession session, RedirectAttributes redirectAttributes) {
        User user = requirePremiumUser(session, redirectAttributes);
        if (user == null) {
            return redirectAfterGuard(session);
        }
        addFlash(taskService.importCoachTasks(user), redirectAttributes);
        return "redirect:/tasks";
    }

    @PostMapping("/tasks/{id}/complete")
    public String complete(HttpSession session,
                           @PathVariable("id") Long id,
                           RedirectAttributes redirectAttributes) {
        User user = requirePremiumUser(session, redirectAttributes);
        if (user == null) {
            return redirectAfterGuard(session);
        }
        addFlash(taskService.complete(user, id), redirectAttributes);
        return "redirect:/tasks";
    }

    @PostMapping("/tasks/{id}/reopen")
    public String reopen(HttpSession session,
                         @PathVariable("id") Long id,
                         RedirectAttributes redirectAttributes) {
        User user = requirePremiumUser(session, redirectAttributes);
        if (user == null) {
            return redirectAfterGuard(session);
        }
        addFlash(taskService.reopen(user, id), redirectAttributes);
        return "redirect:/tasks?status=DONE";
    }

    @PostMapping("/tasks/{id}/archive")
    public String archive(HttpSession session,
                          @PathVariable("id") Long id,
                          RedirectAttributes redirectAttributes) {
        User user = requirePremiumUser(session, redirectAttributes);
        if (user == null) {
            return redirectAfterGuard(session);
        }
        addFlash(taskService.archive(user, id), redirectAttributes);
        return "redirect:/tasks";
    }

    @GetMapping("/tasks/export.md")
    public ResponseEntity<byte[]> exportMarkdown(HttpSession session) {
        User user = requireLogin(session);
        if (user == null || !membershipService.isPremium(user)) {
            return ResponseEntity.status(403).body("请先开通会员。".getBytes(StandardCharsets.UTF_8));
        }
        byte[] body = taskService.exportMarkdown(user).getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(1, TimeUnit.MINUTES))
                .contentType(MediaType.valueOf("text/markdown;charset=UTF-8"))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename("sekai-tasks.md", StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .body(body);
    }

    private User requirePremiumUser(HttpSession session, RedirectAttributes redirectAttributes) {
        User user = requireLogin(session);
        if (user == null) {
            return null;
        }
        if (!membershipService.isPremium(user)) {
            redirectAttributes.addFlashAttribute("error", "行动任务看板是会员功能，请先开通会员。");
            return null;
        }
        return user;
    }

    private String redirectAfterGuard(HttpSession session) {
        return requireLogin(session) == null ? "redirect:/login" : "redirect:/membership?locked=tasks";
    }

    private User requireLogin(HttpSession session) {
        Object loginUser = session.getAttribute("loginUser");
        return loginUser instanceof User user ? user : null;
    }

    private String normalizeStatus(String status) {
        if ("OPEN".equalsIgnoreCase(status) || "DONE".equalsIgnoreCase(status) || "ARCHIVED".equalsIgnoreCase(status)) {
            return status.toUpperCase();
        }
        return "ALL";
    }

    private void addFlash(Result<?> result, RedirectAttributes redirectAttributes) {
        if (result.isSuccess()) {
            redirectAttributes.addFlashAttribute("message", result.getMessage());
        } else {
            redirectAttributes.addFlashAttribute("error", result.getMessage());
        }
    }
}
