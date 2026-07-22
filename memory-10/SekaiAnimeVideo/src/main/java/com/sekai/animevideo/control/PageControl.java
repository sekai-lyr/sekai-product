package com.sekai.animevideo.control;

import com.sekai.animevideo.model.*;
import com.sekai.animevideo.service.AnimeSiteService;
import com.sekai.animevideo.service.CategoryService;
import com.sekai.animevideo.service.FavoriteService;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.util.List;

@Controller
public class PageControl {

    @Resource
    private CategoryService categoryService;

    @Resource
    private AnimeSiteService siteService;

    @Resource
    private FavoriteService favoriteService;

    @GetMapping("/")
    public String landing() {
        return "landing";
    }

    @GetMapping("/login")
    public String login() {
        return "login";
    }

    @GetMapping("/register")
    public String register() {
        return "register";
    }

    @GetMapping("/home")
    public String home(HttpSession session, Model model,
                       @RequestParam(value = "categoryId", required = false) Long categoryId,
                       @RequestParam(value = "keyword", required = false) String keyword,
                       @RequestParam(value = "page", defaultValue = "1") int page) {
        User user = getLoginUser(session);
        if (user == null) return "redirect:/login";

        int pageSize = 12;
        int total = siteService.countByUserId(user.getId(), categoryId, keyword);
        int totalPages = Math.max((int) Math.ceil(total / (double) pageSize), 1);
        int currentPage = Math.min(Math.max(page, 1), totalPages);
        List<AnimeSite> sites = siteService.listByUserId(user.getId(), categoryId, keyword, currentPage, pageSize);

        model.addAttribute("loginUser", user);
        model.addAttribute("categories", categoryService.listByUserId(user.getId()));
        model.addAttribute("sites", sites);
        model.addAttribute("hotSites", siteService.listHotByUserId(user.getId(), 5));
        model.addAttribute("stats", buildStats(user.getId()));
        model.addAttribute("categoryId", categoryId);
        model.addAttribute("keyword", keyword == null ? "" : keyword);
        model.addAttribute("currentPage", currentPage);
        model.addAttribute("totalPages", totalPages);
        model.addAttribute("totalCount", total);
        return "home";
    }

    @GetMapping("/dashboard")
    public String dashboard(HttpSession session, Model model) {
        User user = getLoginUser(session);
        if (user == null) return "redirect:/login";
        model.addAttribute("loginUser", user);
        model.addAttribute("stats", buildStats(user.getId()));
        model.addAttribute("hotSites", siteService.listHotByUserId(user.getId(), 10));
        model.addAttribute("categories", categoryService.listByUserId(user.getId()));
        return "dashboard";
    }

    @GetMapping("/anime")
    public String anime(HttpSession session, Model model,
                        @RequestParam(value = "url", required = false) String url,
                        @RequestParam(value = "title", required = false) String title,
                        @RequestParam(value = "episode", required = false) String episode) {
        User user = getLoginUser(session);
        if (user == null) return "redirect:/login";
        model.addAttribute("loginUser", user);
        model.addAttribute("categories", categoryService.listByUserId(user.getId()));
        model.addAttribute("hotSites", siteService.listHotByUserId(user.getId(), 10));
        model.addAttribute("stats", buildStats(user.getId()));
        if (url != null && !url.isEmpty()) {
            model.addAttribute("embedUrl", url);
            model.addAttribute("animeTitle", title != null ? title : "正在播放");
            model.addAttribute("animeEpisode", episode != null ? episode : "");
        }
        return "anime";
    }

    private static final java.util.Map<String, String> SITE_MAP = java.util.Map.ofEntries(
        java.util.Map.entry("fankuhub", "https://www.fankuhub.com"),
        java.util.Map.entry("yhhua", "https://app.yhhua.com.cn"),
        java.util.Map.entry("kanfantv", "https://www.kanfantv.com"),
        java.util.Map.entry("yhdm6", "https://yhdm6.top"),
        java.util.Map.entry("otage", "https://otage.cc"),
        java.util.Map.entry("fengchedmp", "https://fengchedmp.com")
    );
    private static final java.util.Map<String, String> SITE_NAMES = java.util.Map.ofEntries(
        java.util.Map.entry("fankuhub", "FankuHub"),
        java.util.Map.entry("yhhua", "樱花动漫"),
        java.util.Map.entry("kanfantv", "KanFanTV"),
        java.util.Map.entry("yhdm6", "樱花动漫"),
        java.util.Map.entry("otage", "AGE动漫"),
        java.util.Map.entry("fengchedmp", "FengChe动漫")
    );

    @GetMapping("/anime-hub")
    public String animeHub(HttpSession session, Model model,
                           @RequestParam(value = "url", required = false) String url,
                           @RequestParam(value = "site", required = false) String site) {
        User user = getLoginUser(session);
        if (user == null) return "redirect:/login";

        String rawUrl;
        if (url != null && !url.isEmpty()) {
            rawUrl = url;
        } else if (site != null && SITE_MAP.containsKey(site.toLowerCase())) {
            rawUrl = SITE_MAP.get(site.toLowerCase());
        } else {
            rawUrl = "https://www.fankuhub.com";
        }

        if (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
            rawUrl = "https://" + rawUrl;
        }
        final String targetUrl = rawUrl;

        String siteName = SITE_MAP.entrySet().stream()
            .filter(e -> e.getValue().equals(targetUrl))
            .findFirst()
            .map(e -> SITE_NAMES.getOrDefault(e.getKey(), targetUrl))
            .orElse(targetUrl);

        model.addAttribute("site", site != null ? site.toLowerCase() : "fankuhub");
        model.addAttribute("siteUrl", targetUrl);
        model.addAttribute("siteName", siteName);
        model.addAttribute("loginUser", user);
        return "anime-hub";
    }

    @GetMapping("/redirect")
    public String redirect(@RequestParam("id") Long id, HttpSession session) {
        User user = getLoginUser(session);
        if (user == null) return "redirect:/login";
        AnimeSite site = siteService.getById(id);
        if (site == null) return "redirect:/home";
        siteService.incrementClick(id);
        return "redirect:" + site.getSiteUrl();
    }

    @PostMapping("/site/add")
    public String addSite(@ModelAttribute AnimeSite site, HttpSession session, RedirectAttributes redirectAttributes) {
        User user = getLoginUser(session);
        if (user == null) return "redirect:/login";
        site.setUserId(user.getId());
        Result<AnimeSite> result = siteService.create(site);
        if (!result.isSuccess()) {
            redirectAttributes.addFlashAttribute("error", result.getMessage());
        } else {
            redirectAttributes.addFlashAttribute("message", "站点添加成功");
        }
        return "redirect:/home";
    }

    @PostMapping("/site/delete")
    public String deleteSite(@RequestParam("id") Long id, HttpSession session, RedirectAttributes redirectAttributes) {
        User user = getLoginUser(session);
        if (user == null) return "redirect:/login";
        Result<Void> result = siteService.deleteById(id, user.getId());
        redirectAttributes.addFlashAttribute(result.isSuccess() ? "message" : "error", result.getMessage());
        return "redirect:/home";
    }

    @PostMapping("/category/add")
    public String addCategory(@ModelAttribute Category category, HttpSession session, RedirectAttributes redirectAttributes) {
        User user = getLoginUser(session);
        if (user == null) return "redirect:/login";
        category.setUserId(user.getId());
        Result<Category> result = categoryService.create(category);
        redirectAttributes.addFlashAttribute(result.isSuccess() ? "message" : "error", result.getMessage());
        return "redirect:/home";
    }

    @PostMapping("/favorite/toggle")
    public String toggleFavorite(@RequestParam("siteId") Long siteId, HttpSession session, RedirectAttributes redirectAttributes) {
        User user = getLoginUser(session);
        if (user == null) return "redirect:/login";
        Result<Favorite> result = favoriteService.toggle(user.getId(), siteId);
        redirectAttributes.addFlashAttribute("message", result.getMessage());
        return "redirect:/home";
    }

    @GetMapping("/logout")
    public String logout(HttpSession session) {
        session.invalidate();
        return "redirect:/login";
    }

    private HubStats buildStats(Long userId) {
        HubStats stats = new HubStats();
        stats.setSiteCount(siteService.countByUserId(userId, null, null));
        stats.setCategoryCount(categoryService.countByUserId(userId));
        stats.setFavoriteCount(favoriteService.countByUserId(userId));
        stats.setTotalClicks(siteService.countTotalClicksByUserId(userId));
        return stats;
    }

    private User getLoginUser(HttpSession session) {
        Object loginUser = session.getAttribute("loginUser");
        if (loginUser instanceof User user) return user;
        return null;
    }
}