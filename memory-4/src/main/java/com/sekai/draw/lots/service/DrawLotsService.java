package com.sekai.draw.lots.service;

import com.sekai.draw.lots.model.AnimeCharacter;
import com.sekai.draw.lots.model.Achievement;
import com.sekai.draw.lots.model.CharacterRecommendation;
import com.sekai.draw.lots.model.DashboardStats;
import com.sekai.draw.lots.model.DrawRecord;
import com.sekai.draw.lots.model.Result;
import com.sekai.draw.lots.model.RitualResult;
import com.sekai.draw.lots.model.User;

import java.util.List;

public interface DrawLotsService {
    DashboardStats getStats(User user);
    Result<DrawRecord> draw(User user, String mood);
    Result<DrawRecord> draw(User user, String mood, String wishTopic, String focus);
    Result<DrawRecord> dailyDraw(User user, String mood, String focus);
    Result<RitualResult> ritualDraw(User user, String mood, String wishTopic, String focus);
    List<Achievement> getAchievements(User user);
    List<DrawRecord> recentRecords(User user, int limit);
    List<DrawRecord> filteredRecords(User user, String keyword, String mood, Integer minScore, int limit);
    List<AnimeCharacter> topCharacters(int limit);
    List<AnimeCharacter> searchCharacters(String keyword, int limit);
    AnimeCharacter getCharacter(Long id);
    List<CharacterRecommendation> recommendCharacters(User user, Long characterId, int limit);
    List<AnimeCharacter> favoriteCharacters(User user);
    Result<Boolean> toggleFavorite(User user, Long characterId);
    boolean isFavorite(User user, Long characterId);
}
