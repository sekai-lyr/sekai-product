package com.sekai.draw.lots.control;

import com.sekai.draw.lots.model.User;
import com.sekai.draw.lots.service.DrawLotsService;
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
    private com.sekai.draw.lots.service.BrowseService browseService;
    @Resource
    private com.sekai.draw.lots.service.JournalService journalService;

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
        model.addAttribute("achievements", drawLotsService.getAchievements(user));
        model.addAttribute("recentRecords", drawLotsService.recentRecords(user, 6));
        model.addAttribute("topCharacters", drawLotsService.topCharacters(8));
        model.addAttribute("wishes", journalService.wishes(user.getId()));
        model.addAttribute("todayRecord", drawLotsService.todayRecord(user));
        return "home";
    }

    @GetMapping("/characters")
    public String characters(@RequestParam(value = "keyword", required = false) String keyword,
                             @RequestParam(value = "role", required = false) String role,
                             @RequestParam(value = "energy", required = false) String energy,
                             @RequestParam(defaultValue = "1") int page,
                             HttpSession session,
                             Model model) {
        User user = requireLogin(session);
        if (user == null) {
            return "redirect:/login";
        }
        model.addAttribute("loginUser", user);
        model.addAttribute("keyword", keyword);
        var result = browseService.characters(keyword, role, energy, page);
        model.addAttribute("characters", result.getItems());
        model.addAttribute("pagination", result);
        model.addAttribute("role", role);
        model.addAttribute("energy", energy);
        model.addAttribute("roles", browseService.roles());
        model.addAttribute("energies", browseService.energies());
        return "characters";
    }

    @GetMapping("/history")
    public String history(HttpSession session,
                          Model model,
                          @RequestParam(value = "keyword", required = false) String keyword,
                          @RequestParam(value = "mood", required = false) String mood,
                          @RequestParam(value = "minScore", required = false) Integer minScore,
                          @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate start,
                          @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate end,
                          @RequestParam(required = false) String month,
                          @RequestParam(required = false) Long wishId,
                          @RequestParam(defaultValue = "1") int page) {
        User user = requireLogin(session);
        if (user == null) {
            return "redirect:/login";
        }
        model.addAttribute("loginUser", user);
        var selectedMonth = month == null || month.isBlank() ? java.time.YearMonth.now(java.time.ZoneId.of("Asia/Shanghai")) : java.time.YearMonth.parse(month);
        if (wishId != null) model.addAttribute("wish", journalService.get(user.getId(), wishId));
        var result = browseService.history(user.getId(), keyword, mood, minScore, start, end, wishId, page);
        model.addAttribute("records", result.getItems());
        model.addAttribute("pagination", result);
        model.addAttribute("calendar", browseService.calendar(user.getId(), selectedMonth));
        model.addAttribute("month", selectedMonth.toString());
        model.addAttribute("previousMonth", selectedMonth.minusMonths(1).toString());
        model.addAttribute("nextMonth", selectedMonth.plusMonths(1).toString());
        model.addAttribute("start", start);
        model.addAttribute("end", end);
        model.addAttribute("wishId", wishId);
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
