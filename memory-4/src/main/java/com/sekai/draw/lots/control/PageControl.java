package com.sekai.draw.lots.control;

import com.sekai.draw.lots.model.User;
import com.sekai.draw.lots.service.DrawLotsService;
import com.sekai.draw.lots.service.MembershipService;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

@Controller
public class PageControl {

    @Resource
    private DrawLotsService drawLotsService;

    @Resource
    private MembershipService membershipService;

    @GetMapping({"/", "/login"})
    public String login() {
        return "login";
    }

    @GetMapping("/register")
    public String register() {
        return "register";
    }

    @GetMapping("/home")
    public String home(HttpSession session, Model model) {
        User user = requireLogin(session);
        if (user == null) {
            return "redirect:/login";
        }
        model.addAttribute("loginUser", user);
        model.addAttribute("stats", drawLotsService.getStats(user));
        model.addAttribute("membership", membershipService.getStatus(user));
        model.addAttribute("achievements", drawLotsService.getAchievements(user));
        model.addAttribute("recentRecords", drawLotsService.recentRecords(user, 6));
        model.addAttribute("topCharacters", drawLotsService.topCharacters(8));
        return "home";
    }

    @GetMapping("/insights")
    public String insights(HttpSession session, Model model) {
        User user = requireLogin(session);
        if (user == null) {
            return "redirect:/login";
        }
        if (!membershipService.isPremium(user)) {
            return "redirect:/membership?locked=insights";
        }
        model.addAttribute("loginUser", user);
        model.addAttribute("insight", drawLotsService.getInsight(user));
        model.addAttribute("report", drawLotsService.getReport(user));
        model.addAttribute("achievements", drawLotsService.getAchievements(user));
        return "insights";
    }

    @GetMapping("/coach")
    public String coach(HttpSession session, Model model) {
        User user = requireLogin(session);
        if (user == null) {
            return "redirect:/login";
        }
        if (!membershipService.isPremium(user)) {
            return "redirect:/membership?locked=coach";
        }
        model.addAttribute("loginUser", user);
        model.addAttribute("membership", membershipService.getStatus(user));
        model.addAttribute("coachPlan", drawLotsService.getVipCoachPlan(user));
        return "coach";
    }

    @GetMapping("/characters")
    public String characters(@RequestParam(value = "keyword", required = false) String keyword,
                             HttpSession session,
                             Model model) {
        User user = requireLogin(session);
        if (user == null) {
            return "redirect:/login";
        }
        model.addAttribute("loginUser", user);
        model.addAttribute("keyword", keyword);
        model.addAttribute("characters", drawLotsService.searchCharacters(keyword, 120));
        return "characters";
    }

    @GetMapping("/history")
    public String history(HttpSession session,
                          Model model,
                          @RequestParam(value = "keyword", required = false) String keyword,
                          @RequestParam(value = "mood", required = false) String mood,
                          @RequestParam(value = "minScore", required = false) Integer minScore) {
        User user = requireLogin(session);
        if (user == null) {
            return "redirect:/login";
        }
        model.addAttribute("loginUser", user);
        model.addAttribute("records", drawLotsService.filteredRecords(user, keyword, mood, minScore, 120));
        model.addAttribute("keyword", keyword == null ? "" : keyword);
        model.addAttribute("mood", mood == null ? "" : mood);
        model.addAttribute("minScore", minScore);
        return "history";
    }

    @GetMapping("/favorites")
    public String favorites(HttpSession session, Model model) {
        User user = requireLogin(session);
        if (user == null) {
            return "redirect:/login";
        }
        model.addAttribute("loginUser", user);
        model.addAttribute("characters", drawLotsService.favoriteCharacters(user));
        return "favorites";
    }

    @GetMapping("/characters/{id}")
    public String characterDetail(@PathVariable Long id, HttpSession session, Model model) {
        User user = requireLogin(session);
        if (user == null) {
            return "redirect:/login";
        }
        var character = drawLotsService.getCharacter(id);
        if (character == null) {
            return "redirect:/characters";
        }
        model.addAttribute("loginUser", user);
        model.addAttribute("character", character);
        model.addAttribute("favorite", drawLotsService.isFavorite(user, id));
        model.addAttribute("records", drawLotsService.filteredRecords(user, character.getEnglishName(), null, null, 20));
        model.addAttribute("recommendations", drawLotsService.recommendCharacters(user, id, 6));
        return "character-detail";
    }

    private User requireLogin(HttpSession session) {
        Object loginUser = session.getAttribute("loginUser");
        return loginUser instanceof User user ? user : null;
    }
}
