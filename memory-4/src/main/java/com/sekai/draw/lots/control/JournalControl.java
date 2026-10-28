package com.sekai.draw.lots.control;

import com.sekai.draw.lots.model.User;
import com.sekai.draw.lots.service.JournalService;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Controller
public class JournalControl {
    private final JournalService service;
    public JournalControl(JournalService service) { this.service = service; }
    @GetMapping("/wishes")
    public String wishes(HttpSession session, Model model) {
        var user = (User) session.getAttribute("loginUser");
        model.addAttribute("wishes", service.wishes(user.getId()));
        return "wishes";
    }
    @PostMapping("/wishes")
    public String create(@RequestParam String title, HttpSession session, RedirectAttributes redirect) {
        try { service.create(((User) session.getAttribute("loginUser")).getId(), title); redirect.addFlashAttribute("message", "愿望已记下，可以在抽签时选择它。"); }
        catch (IllegalArgumentException e) { redirect.addFlashAttribute("error", e.getMessage()); }
        return "redirect:/wishes";
    }
    @PostMapping("/wishes/{id}")
    public String update(@PathVariable Long id, @RequestParam(defaultValue = "false") boolean completed, @RequestParam(defaultValue = "") String review, HttpSession session, RedirectAttributes redirect) {
        try { service.update(((User) session.getAttribute("loginUser")).getId(), id, completed, review); redirect.addFlashAttribute("message", "愿望回顾已保存"); }
        catch (IllegalArgumentException e) { redirect.addFlashAttribute("error", e.getMessage()); }
        return "redirect:/wishes";
    }
}
