package com.sekai.memory.book.service;

import com.sekai.memory.book.model.Anime;
import jakarta.annotation.PostConstruct;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;

@Service
public class AnimeOrderService {
    private final JdbcTemplate jdbc;
    private final AnimeService animeService;

    public AnimeOrderService(JdbcTemplate jdbc, AnimeService animeService) {
        this.jdbc = jdbc;
        this.animeService = animeService;
    }

    @PostConstruct
    public void initialize() {
        jdbc.execute("""
                CREATE TABLE IF NOT EXISTS sekai_memory_book_anime_order (
                    user_id BIGINT NOT NULL,
                    anime_id BIGINT NOT NULL,
                    position_index INT NOT NULL,
                    PRIMARY KEY (user_id, anime_id)
                )
                """);
    }

    public List<Anime> sort(Long userId, List<Anime> anime) {
        Map<Long, Integer> positions = new HashMap<>();
        jdbc.query("SELECT anime_id, position_index FROM sekai_memory_book_anime_order WHERE user_id = ?",
                (org.springframework.jdbc.core.RowCallbackHandler) row ->
                        positions.put(row.getLong("anime_id"), row.getInt("position_index")), userId);
        return anime.stream().sorted(Comparator.comparingInt(
                item -> positions.getOrDefault(item.getId(), Integer.MAX_VALUE))).toList();
    }

    @Transactional
    public boolean save(Long userId, List<Long> ids) {
        if (userId == null || ids == null || ids.stream().anyMatch(java.util.Objects::isNull)
                || new HashSet<>(ids).size() != ids.size()) {
            return false;
        }
        List<Long> ownedIds = animeService.listByUserId(userId).stream().map(Anime::getId).toList();
        if (!new HashSet<>(ownedIds).equals(new HashSet<>(ids))) {
            return false;
        }
        jdbc.update("DELETE FROM sekai_memory_book_anime_order WHERE user_id = ?", userId);
        List<Object[]> positions = new ArrayList<>();
        for (int index = 0; index < ids.size(); index++) {
            positions.add(new Object[]{userId, ids.get(index), index});
        }
        jdbc.batchUpdate("INSERT INTO sekai_memory_book_anime_order (user_id, anime_id, position_index) VALUES (?, ?, ?)", positions);
        return true;
    }
}
