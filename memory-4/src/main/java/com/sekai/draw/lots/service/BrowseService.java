package com.sekai.draw.lots.service;

import com.sekai.draw.lots.mapper.BrowseMapper;
import com.sekai.draw.lots.model.*;
import com.sekai.draw.lots.util.CharacterLocalizationUtil;
import org.springframework.stereotype.Service;
import java.time.*;
import java.util.*;

@Service
public class BrowseService {
    private final BrowseMapper mapper;
    public BrowseService(BrowseMapper mapper) { this.mapper = mapper; }
    public PageResult<AnimeCharacter> characters(String keyword, String role, String energy, int page) {
        var terms = CharacterLocalizationUtil.searchTerms(keyword);
        int total = mapper.countCharacters(terms, role, energy);
        page = Math.max(1, Math.min(page, Math.max(1, (total + 23) / 24)));
        return new PageResult<>(mapper.characters(terms, role, energy, (page - 1) * 24, 24).stream().map(c -> c.convertToCharacter()).toList(), total, page, 24);
    }
    public PageResult<DrawRecord> history(Long userId, String keyword, String mood, Integer minScore, LocalDate start, LocalDate end, Long wishId, int page) {
        if (start != null && end != null && start.isAfter(end)) throw new IllegalArgumentException("开始日期不能晚于结束日期");
        var terms = CharacterLocalizationUtil.searchTerms(keyword);
        int total = mapper.countRecords(userId, terms, mood, minScore, start, end, wishId);
        page = Math.max(1, Math.min(page, Math.max(1, (total + 19) / 20)));
        return new PageResult<>(mapper.records(userId, terms, mood, minScore, start, end, wishId, (page - 1) * 20, 20), total, page, 20);
    }
    public List<Map<String, String>> roles() { return mapper.roles().stream().map(v -> Map.of("value", v, "label", CharacterLocalizationUtil.displayRoleType(v))).toList(); }
    public List<Map<String, String>> energies() { return mapper.energies().stream().map(v -> Map.of("value", v, "label", CharacterLocalizationUtil.displayEnergy(v))).toList(); }
    public List<Map<String, Object>> calendar(Long userId, YearMonth month) {
        Map<String, Map<String, Object>> counts = new HashMap<>();
        for (var day : mapper.calendar(userId, month.atDay(1), month.plusMonths(1).atDay(1))) counts.put(day.get("day").toString(), day);
        List<Map<String, Object>> cells = new ArrayList<>();
        LocalDate first = month.atDay(1).minusDays(month.atDay(1).getDayOfWeek().getValue() - 1);
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Shanghai"));
        for (int i = 0; i < 42; i++) {
            LocalDate day = first.plusDays(i);
            var count = counts.getOrDefault(day.toString(), Map.of("total", 0, "daily", 0));
            cells.add(Map.of("date", day.toString(), "number", day.getDayOfMonth(), "inMonth", YearMonth.from(day).equals(month),
                    "today", day.equals(today), "total", count.get("total"), "daily", ((Number) count.get("daily")).intValue() > 0));
        }
        return cells;
    }
}
