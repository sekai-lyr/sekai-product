package com.sekai.dataobject.control;

import com.sekai.dataobject.model.CharacterInfo;
import com.sekai.dataobject.model.DashboardStats;
import com.sekai.dataobject.model.Quote;
import com.sekai.dataobject.model.Series;
import com.sekai.dataobject.model.User;
import com.sekai.dataobject.service.CharacterService;
import com.sekai.dataobject.service.QuoteService;
import com.sekai.dataobject.service.SeriesService;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

@Controller
public class PageControl {

    @Resource
    private SeriesService seriesService;

    @Resource
    private CharacterService characterService;

    @Resource
    private QuoteService quoteService;

    @GetMapping({"/", "/login"})
    public String login() {
        return "login";
    }

    @GetMapping("/register")
    public String register() {
        return "register";
    }

    @GetMapping("/user/register")
    public String registerFallback() {
        return "redirect:/register";
    }

    @GetMapping("/user/login")
    public String loginFallback() {
        return "redirect:/login";
    }

    @GetMapping("/home")
    public String home(HttpSession session, Model model) {
        User user = getLoginUser(session);
        if (user == null) {
            return "redirect:/login";
        }
        List<Series> seriesList = seriesService.listAll();
        List<CharacterInfo> characterList = characterService.listAll();
        List<Quote> quoteList = quoteService.listAll();
        DashboardStats stats = new DashboardStats();
        stats.setSeriesCount(seriesList.size());
        stats.setCharacterCount(characterList.size());
        stats.setQuoteCount(quoteList.size());
        stats.setAudioCount(quoteList.stream()
                .filter(quote -> quote.getAudioUrl() != null && !quote.getAudioUrl().isBlank())
                .count());
        model.addAttribute("loginUser", user);
        model.addAttribute("stats", stats);
        model.addAttribute("recentSeriesList", seriesList.stream().limit(6).toList());
        model.addAttribute("topCharacterList", characterList.stream().limit(8).toList());
        model.addAttribute("recentQuoteList", quoteList.stream().limit(6).toList());
        model.addAttribute("seriesById", buildSeriesById(seriesList));
        return "home";
    }

    @GetMapping("/series")
    public String series(HttpSession session,
                         Model model,
                         @RequestParam(value = "keyword", required = false) String keyword,
                         @RequestParam(value = "page", defaultValue = "1") int page) {
        User user = getLoginUser(session);
        if (user == null) {
            return "redirect:/login";
        }
        int pageSize = 8;
        int total = seriesService.count(keyword);
        int totalPages = Math.max((int) Math.ceil(total / (double) pageSize), 1);
        int currentPage = Math.min(Math.max(page, 1), totalPages);
        model.addAttribute("loginUser", user);
        model.addAttribute("seriesList", seriesService.listPage(keyword, currentPage, pageSize));
        model.addAttribute("keyword", keyword == null ? "" : keyword);
        model.addAttribute("currentPage", currentPage);
        model.addAttribute("totalPages", totalPages);
        model.addAttribute("totalCount", total);
        return "series";
    }

    @GetMapping("/series/{id}")
    public String seriesDetail(@PathVariable Long id, HttpSession session, Model model) {
        User user = getLoginUser(session);
        if (user == null) {
            return "redirect:/login";
        }
        Series series = seriesService.getById(id);
        if (series == null) {
            return "redirect:/series";
        }
        List<CharacterInfo> characters = characterService.listBySeriesId(id);
        List<Quote> quotes = quoteService.listBySeriesId(id);
        model.addAttribute("loginUser", user);
        model.addAttribute("series", series);
        model.addAttribute("characterList", characters);
        model.addAttribute("quoteList", quotes);
        model.addAttribute("tagList", splitTags(series.getTags()));
        return "series-detail";
    }

    @GetMapping("/characters")
    public String characters(HttpSession session,
                             Model model,
                             @RequestParam(value = "keyword", required = false) String keyword,
                             @RequestParam(value = "seriesId", required = false) Long seriesId,
                             @RequestParam(value = "page", defaultValue = "1") int page) {
        User user = getLoginUser(session);
        if (user == null) {
            return "redirect:/login";
        }
        int pageSize = 8;
        int total = characterService.count(keyword, seriesId);
        int totalPages = Math.max((int) Math.ceil(total / (double) pageSize), 1);
        int currentPage = Math.min(Math.max(page, 1), totalPages);
        List<CharacterInfo> characterList = characterService.listPage(keyword, seriesId, currentPage, pageSize);
        Map<Long, Series> seriesById = buildSeriesById(seriesService.listAll());
        model.addAttribute("loginUser", user);
        model.addAttribute("seriesOptions", seriesService.listAll());
        model.addAttribute("characterList", characterList);
        model.addAttribute("seriesById", seriesById);
        model.addAttribute("keyword", keyword == null ? "" : keyword);
        model.addAttribute("filterSeriesId", seriesId);
        model.addAttribute("currentPage", currentPage);
        model.addAttribute("totalPages", totalPages);
        model.addAttribute("totalCount", total);
        return "characters";
    }

    @GetMapping("/quotes")
    public String quotes(HttpSession session,
                         Model model,
                         @RequestParam(value = "keyword", required = false) String keyword,
                         @RequestParam(value = "seriesId", required = false) Long seriesId,
                         @RequestParam(value = "page", defaultValue = "1") int page) {
        User user = getLoginUser(session);
        if (user == null) {
            return "redirect:/login";
        }
        int pageSize = 8;
        int total = quoteService.count(keyword, seriesId, null);
        int totalPages = Math.max((int) Math.ceil(total / (double) pageSize), 1);
        int currentPage = Math.min(Math.max(page, 1), totalPages);
        List<Quote> quoteList = quoteService.listPage(keyword, seriesId, null, currentPage, pageSize);
        Map<Long, Series> seriesById = buildSeriesById(seriesService.listAll());
        model.addAttribute("loginUser", user);
        model.addAttribute("seriesOptions", seriesService.listAll());
        model.addAttribute("quoteList", quoteList);
        model.addAttribute("seriesById", seriesById);
        model.addAttribute("keyword", keyword == null ? "" : keyword);
        model.addAttribute("filterSeriesId", seriesId);
        model.addAttribute("currentPage", currentPage);
        model.addAttribute("totalPages", totalPages);
        model.addAttribute("totalCount", total);
        return "quotes";
    }

    @GetMapping("/logout")
    public String logout(HttpSession session) {
        session.invalidate();
        return "redirect:/login";
    }

    private Map<Long, Series> buildSeriesById(List<Series> seriesList) {
        return seriesList.stream()
                .collect(Collectors.toMap(Series::getId, Function.identity(), (a, b) -> a));
    }

    private List<String> splitTags(String tags) {
        if (tags == null || tags.isBlank()) {
            return List.of();
        }
        return List.of(tags.split(",")).stream()
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .toList();
    }

    private User getLoginUser(HttpSession session) {
        Object loginUser = session.getAttribute("loginUser");
        if (loginUser instanceof User user) {
            return user;
        }
        return null;
    }
}
