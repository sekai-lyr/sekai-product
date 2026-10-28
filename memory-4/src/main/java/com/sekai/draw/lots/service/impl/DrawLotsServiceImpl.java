package com.sekai.draw.lots.service.impl;

import com.sekai.draw.lots.dataobject.SekaiDrawLotsCharacterDO;
import com.sekai.draw.lots.dataobject.SekaiDrawLotsFortuneDO;
import com.sekai.draw.lots.dataobject.SekaiDrawLotsRecordDO;
import com.sekai.draw.lots.mapper.SekaiDrawLotsCharacterMapper;
import com.sekai.draw.lots.mapper.SekaiDrawLotsFavoriteMapper;
import com.sekai.draw.lots.mapper.SekaiDrawLotsFortuneMapper;
import com.sekai.draw.lots.mapper.SekaiDrawLotsRecordMapper;
import com.sekai.draw.lots.model.Achievement;
import com.sekai.draw.lots.model.AnimeCharacter;
import com.sekai.draw.lots.model.CharacterRecommendation;
import com.sekai.draw.lots.model.DashboardStats;
import com.sekai.draw.lots.model.DrawRecord;
import com.sekai.draw.lots.model.Result;
import com.sekai.draw.lots.model.RitualCard;
import com.sekai.draw.lots.model.RitualResult;
import com.sekai.draw.lots.model.User;
import com.sekai.draw.lots.service.DrawLotsService;
import com.sekai.draw.lots.util.CharacterLocalizationUtil;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Predicate;

@Service
public class DrawLotsServiceImpl implements DrawLotsService {

    @Resource
    private SekaiDrawLotsCharacterMapper characterMapper;

    @Resource
    private SekaiDrawLotsFortuneMapper fortuneMapper;

    @Resource
    private SekaiDrawLotsRecordMapper recordMapper;

    @Resource
    private SekaiDrawLotsFavoriteMapper favoriteMapper;

    @Resource
    private com.sekai.draw.lots.mapper.SekaiDrawLotsUserMapper userMapper;
    @Resource
    private com.sekai.draw.lots.mapper.JournalMapper journalMapper;
    @Resource
    private com.sekai.draw.lots.service.JournalService journalService;

    @Override
    public DrawRecord todayRecord(User user) {
        DrawRecord record = recordMapper.selectTodayDaily(user.getId());
        if (record != null) record.setFavorited(isFavorite(user, record.getCharacterId()));
        return record;
    }

    @Override
    public DashboardStats getStats(User user) {
        DashboardStats stats = new DashboardStats();
        stats.setTotalCharacters(characterMapper.countAll());
        if (user != null && user.getId() != null) {
            stats.setTotalDraws(recordMapper.countByUserId(user.getId()));
            stats.setTodayDraws(recordMapper.countTodayByUserId(user.getId()));
            Integer maxScore = recordMapper.maxScoreByUserId(user.getId());
            stats.setBestScore(maxScore == null ? 0 : maxScore);
            stats.setFavoriteCharacters(favoriteMapper.countByUserId(user.getId()));
        }
        return stats;
    }

    @Override
    @Transactional
    public Result<DrawRecord> draw(User user, String mood) {
        return draw(user, mood, null, null);
    }

    @Override
    @Transactional
    public Result<DrawRecord> draw(User user, String mood, String wishTopic, String focus) {
        if (user == null || user.getId() == null) {
            return Result.fail("请先登录");
        }
        Result<DrawRecord> result = createDrawRecord(user, mood, wishTopic, focus, null, "RANDOM", null, null);
        if (result.isSuccess()) getAchievements(user);
        return result;
    }

    @Override
    @Transactional
    public Result<RitualResult> ritualDraw(User user, String mood, String wishTopic, String focus) {
        if (user == null || user.getId() == null) {
            return Result.fail("请先登录");
        }
        String topic = defaultText(wishTopic, "三连签仪式");
        List<RitualCard> cards = List.of(
                new RitualCard("第一签", "当前阻力", null),
                new RitualCard("第二签", "今日助力", null),
                new RitualCard("第三签", "下一步行动", null)
        );
        String ritualId = java.util.UUID.randomUUID().toString();
        for (RitualCard card : cards) {
            Result<DrawRecord> drawResult = createDrawRecord(user, mood, wishTopic, focus, card.getTheme(), "RITUAL", ritualId, null);
            if (!drawResult.isSuccess()) {
                throw new IllegalStateException(drawResult.getMessage());
            }
            card.setRecord(drawResult.getData());
        }

        getAchievements(user);
        RitualResult ritual = buildRitualResult(cards, topic);
        return Result.ok(ritual);
    }

    private Result<DrawRecord> createDrawRecord(User user, String mood, String wishTopic, String focus, String ritualTheme, String drawType, String ritualId, java.time.LocalDate dailyDate) {
        if (wishTopic != null && wishTopic.trim().length() > 40) return Result.fail("愿望不能超过 40 个字符");
        if (mood != null && !List.of("平静", "燃", "想摆烂", "需要灵感", "有点焦虑", "有点孤单").contains(mood)) return Result.fail("请选择有效心情");
        if (focus != null && !List.of("", "bright", "calm", "power", "healing", "main").contains(focus)) return Result.fail("请选择有效伙伴偏好");
        String normalizedFocus = focusKeyword(trimToNull(focus));
        SekaiDrawLotsCharacterDO characterDO = normalizedFocus == null
                ? characterMapper.selectRandom()
                : characterMapper.selectRandomByFocus(normalizedFocus);
        if (characterDO == null) {
            characterDO = characterMapper.selectRandom();
        }
        SekaiDrawLotsFortuneDO fortuneDO = fortuneMapper.selectRandom();
        if (characterDO == null || fortuneDO == null) {
            return Result.fail("伙伴库或运势库还没有初始化");
        }

        SekaiDrawLotsRecordDO recordDO = new SekaiDrawLotsRecordDO();
        recordDO.setUserId(user.getId());
        recordDO.setDrawType(drawType);
        recordDO.setRitualId(ritualId);
        recordDO.setDailyDate(dailyDate);
        if (!"DAILY".equals(drawType) && trimToNull(wishTopic) != null) {
            recordDO.setWishId(journalService.create(user.getId(), wishTopic).getId());
        }
        recordDO.setCharacterId(characterDO.getId());
        recordDO.setFortuneId(fortuneDO.getId());
        recordDO.setLuckScore(scoreWithWishBonus(fortuneDO.getLuckScore(), wishTopic, normalizedFocus));
        recordDO.setMood(trimToNull(mood));
        recordDO.setWishTopic(defaultText(wishTopic, "今日运势"));
        recordDO.setMessage(buildMessage(recordDO.getWishTopic(), CharacterLocalizationUtil.displayName(characterDO.getEnglishName()), fortuneDO.getLevelName(), normalizedFocus, ritualTheme));
        recordMapper.insert(recordDO);

        recordDO.setDrawTime(java.time.LocalDateTime.now(java.time.ZoneId.of("Asia/Shanghai")));
        DrawRecord record = recordDO.convertToRecord();
        record.setCharacter(characterDO.convertToCharacter());
        record.setFortune(fortuneDO.convertToFortune());
        record.setFavorited(isFavorite(user, characterDO.getId()));
        return Result.ok(record);
    }

    @Override
    @Transactional
    public Result<DrawRecord> dailyDraw(User user, String mood, String focus) {
        if (user == null || user.getId() == null) {
            return Result.fail("请先登录");
        }
        userMapper.lockById(user.getId());
        DrawRecord today = recordMapper.selectTodayDaily(user.getId());
        if (today != null) {
            today.setFavorited(isFavorite(user, today.getCharacterId()));
            return Result.ok(today);
        }
        Result<DrawRecord> result = createDrawRecord(user, mood, "每日固定签", focus, null, "DAILY", null,
                java.time.LocalDate.now(java.time.ZoneId.of("Asia/Shanghai")));
        if (result.isSuccess()) getAchievements(user);
        return result;
    }

    @Override
    public List<Achievement> getAchievements(User user) {
        if (user == null || user.getId() == null) {
            return List.of();
        }
        DashboardStats stats = getStats(user);
        Map<String, Object> counts = journalMapper.achievementCounts(user.getId());
        int ritualRecords = ((Number) counts.get("rituals")).intValue();
        int uniqueWishTopics = ((Number) counts.get("topics")).intValue();
        int highScoreRecords = ((Number) counts.get("highs")).intValue();
        int dailyRecords = ((Number) counts.get("dailies")).intValue();
        int streakDays = recordMapper.countStreakDays(user.getId());

        List<Achievement> achievements = new ArrayList<>();
        achievements.add(new Achievement("first-draw", "初次相遇", "完成第一次抽签", "bronze", stats.getTotalDraws(), 1, "去首页抽出第一位守护伙伴。"));
        achievements.add(new Achievement("daily-spark", "今日点火", "完成第一次每日固定签", "bronze", dailyRecords, 1, "抽一次今日固定签即可点亮。"));
        achievements.add(new Achievement("ten-draws", "签文收集者", "累计完成 10 次抽签", "silver", stats.getTotalDraws(), 10, "继续抽签积累自己的角色轨迹。"));
        achievements.add(new Achievement("ritual-reader", "三连签读者", "完成一次三连签仪式", "silver", ritualRecords, 1, "首页点击三连签仪式，一次会生成三张签。"));
        achievements.add(new Achievement("high-score", "星光大吉", "至少出现 1 次 90 分以上签", "gold", highScoreRecords, 1, "高分签会自动点亮这个成就。"));
        achievements.add(new Achievement("collector", "羁绊收藏家", "收藏 5 位角色", "silver", stats.getFavoriteCharacters(), 5, "在角色详情或抽签结果里收藏喜欢的角色。"));
        achievements.add(new Achievement("theme-weaver", "愿望织线者", "记录 5 个不同许愿主题", "gold", uniqueWishTopics, 5, "在首页许愿主题里换几个不同目标。"));
        achievements.add(new Achievement("active-week", "七日观星", "近 30 天内活跃 7 天", "gold", streakDays, 7, "每天来抽一次固定签，慢慢点亮。"));
        achievements.add(new Achievement("hundred-club", "百签档案", "累计完成 100 次抽签", "platinum", stats.getTotalDraws(), 100, "长期记录后解锁。"));
        var unlocked = new java.util.HashSet<>(journalMapper.unlocked(user.getId()));
        for (Achievement achievement : achievements) {
            if (achievement.isUnlocked()) journalMapper.unlock(user.getId(), achievement.getCode());
            if (unlocked.contains(achievement.getCode())) {
                achievement.setUnlocked(true);
                achievement.setProgress(Math.max(achievement.getProgress(), achievement.getTarget()));
            }
        }
        return achievements;
    }

    @Override
    public List<DrawRecord> recentRecords(User user, int limit) {
        if (user == null || user.getId() == null) {
            return List.of();
        }
        return recordMapper.selectRecentByUserId(user.getId(), limit);
    }

    @Override
    public List<DrawRecord> filteredRecords(User user, String keyword, String mood, Integer minScore, int limit) {
        if (user == null || user.getId() == null) {
            return List.of();
        }
        List<String> terms = CharacterLocalizationUtil.searchTerms(keyword);
        if (terms.isEmpty()) {
            return recordMapper.selectByFilter(user.getId(), null, trimToNull(mood), minScore, limit);
        }

        Map<Long, DrawRecord> records = new LinkedHashMap<>();
        for (String term : terms) {
            for (DrawRecord record : recordMapper.selectByFilter(user.getId(), term, trimToNull(mood), minScore, limit)) {
                records.putIfAbsent(record.getId(), record);
                if (records.size() >= limit) {
                    return new ArrayList<>(records.values());
                }
            }
        }
        return new ArrayList<>(records.values());
    }

    @Override
    public List<AnimeCharacter> topCharacters(int limit) {
        return characterMapper.selectTop(limit).stream()
                .map(SekaiDrawLotsCharacterDO::convertToCharacter)
                .toList();
    }

    @Override
    public List<AnimeCharacter> searchCharacters(String keyword, int limit) {
        List<String> terms = CharacterLocalizationUtil.searchTerms(keyword);
        if (terms.isEmpty()) {
            return characterMapper.search(null, limit).stream()
                    .map(SekaiDrawLotsCharacterDO::convertToCharacter)
                    .toList();
        }

        Map<Long, AnimeCharacter> characters = new LinkedHashMap<>();
        for (String term : terms) {
            for (SekaiDrawLotsCharacterDO characterDO : characterMapper.search(term, limit)) {
                AnimeCharacter character = characterDO.convertToCharacter();
                characters.putIfAbsent(character.getId(), character);
                if (characters.size() >= limit) {
                    return new ArrayList<>(characters.values());
                }
            }
        }
        return new ArrayList<>(characters.values());
    }

    @Override
    public AnimeCharacter getCharacter(Long id) {
        if (id == null) {
            return null;
        }
        SekaiDrawLotsCharacterDO characterDO = characterMapper.selectByPrimaryKey(id);
        return characterDO == null ? null : characterDO.convertToCharacter();
    }

    @Override
    public List<CharacterRecommendation> recommendCharacters(User user, Long characterId, int limit) {
        if (characterId == null) {
            return List.of();
        }
        AnimeCharacter base = getCharacter(characterId);
        if (base == null) {
            return List.of();
        }
        Long userId = user == null ? null : user.getId();
        return characterMapper.selectRelated(characterId, userId, limit).stream()
                .map(SekaiDrawLotsCharacterDO::convertToCharacter)
                .map(character -> buildRecommendation(base, character))
                .toList();
    }

    @Override
    public List<AnimeCharacter> favoriteCharacters(User user) {
        if (user == null || user.getId() == null) {
            return List.of();
        }
        return favoriteMapper.listByUserId(user.getId()).stream()
                .map(SekaiDrawLotsCharacterDO::convertToCharacter)
                .toList();
    }

    @Override
    @Transactional
    public Result<Boolean> toggleFavorite(User user, Long characterId) {
        if (user == null || user.getId() == null) {
            return Result.fail("请先登录");
        }
        if (characterMapper.selectByPrimaryKey(characterId) == null) {
            return Result.fail("角色不存在");
        }
        boolean exists = favoriteMapper.exists(user.getId(), characterId) > 0;
        if (exists) {
            favoriteMapper.delete(user.getId(), characterId);
            return Result.ok(false);
        }
        favoriteMapper.insert(user.getId(), characterId, "抽签收藏");
        getAchievements(user);
        return Result.ok(true);
    }

    @Override
    public boolean isFavorite(User user, Long characterId) {
        return user != null && user.getId() != null && characterId != null
                && favoriteMapper.exists(user.getId(), characterId) > 0;
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String defaultText(String value, String fallback) {
        String trimmed = trimToNull(value);
        return trimmed == null ? fallback : trimmed;
    }

    private CharacterRecommendation buildRecommendation(AnimeCharacter base, AnimeCharacter candidate) {
        int score = 42;
        List<String> reasons = new ArrayList<>();
        if (sameText(base.getAnimeTitle(), candidate.getAnimeTitle())) {
            score += 26;
            reasons.add("同系列");
        }
        if (sameText(base.getArchetype(), candidate.getArchetype())) {
            score += 16;
            reasons.add("角色类型接近");
        }
        if (sameText(base.getElement(), candidate.getElement())) {
            score += 12;
            reasons.add("能量标签一致");
        }
        if (containsText(candidate.getQuote(), base.getArchetype()) || containsText(base.getQuote(), candidate.getArchetype())) {
            score += 8;
            reasons.add("标签互相呼应");
        }
        score += Math.min(10, Math.max(0, candidate.getPopularity() == null ? 0 : candidate.getPopularity() / 12));

        String reason = reasons.isEmpty()
                ? "人气和标签综合相性较高"
                : String.join("、", reasons);
        String signal = score >= 88 ? "强羁绊" : score >= 72 ? "高相性" : score >= 58 ? "可尝试" : "轻连接";
        return new CharacterRecommendation(candidate, Math.min(100, score), reason, signal);
    }

    private boolean sameText(String left, String right) {
        String leftText = trimToNull(left);
        String rightText = trimToNull(right);
        return leftText != null && leftText.equalsIgnoreCase(rightText);
    }

    private boolean containsText(String text, String keyword) {
        String normalizedText = trimToNull(text);
        String normalizedKeyword = trimToNull(keyword);
        return normalizedText != null && normalizedKeyword != null
                && normalizedText.toLowerCase().contains(normalizedKeyword.toLowerCase());
    }

    private String focusKeyword(String focus) {
        if (focus == null) {
            return null;
        }
        return switch (focus) {
            case "bright" -> "Sun";
            case "calm" -> "Moon";
            case "power" -> "Thunder";
            case "healing" -> "Dream";
            case "main" -> "main";
            default -> focus;
        };
    }

    private int scoreWithWishBonus(Integer baseScore, String wishTopic, String focus) {
        int score = baseScore == null ? 60 : baseScore;
        if (trimToNull(wishTopic) != null) {
            score += 3;
        }
        if (focus != null) {
            score += 2;
        }
        return Math.min(100, score);
    }

    private int average(List<Integer> scores) {
        if (scores == null || scores.isEmpty()) {
            return 0;
        }
        return Math.round((float) scores.stream().mapToInt(Integer::intValue).sum() / scores.size());
    }

    private int countMatching(List<DrawRecord> records, Predicate<DrawRecord> predicate) {
        if (records == null || records.isEmpty()) {
            return 0;
        }
        return (int) records.stream().filter(predicate).count();
    }

    private RitualResult buildRitualResult(List<RitualCard> cards, String topic) {
        RitualResult result = new RitualResult();
        result.setCards(cards);
        int overallScore = (int) Math.round(cards.stream()
                .map(RitualCard::getRecord)
                .filter(Objects::nonNull)
                .mapToInt(record -> record.getLuckScore() == null ? 0 : record.getLuckScore())
                .average()
                .orElse(0));
        result.setOverallScore(overallScore);
        result.setRhythm(resolveRhythm(overallScore));

        DrawRecord support = cards.size() > 1 ? cards.get(1).getRecord() : null;
        DrawRecord action = cards.size() > 2 ? cards.get(2).getRecord() : null;
        String supportName = support == null || support.getCharacter() == null ? "守护伙伴" : support.getCharacter().getDisplayName();
        String actionAdvice = action == null || action.getFortune() == null ? "先完成一个最小行动，再观察反馈。" : action.getFortune().getAdvice();
        result.setSummary("围绕「" + topic + "」，三张签给出的节奏是：" + result.getRhythm() + "。"
                + supportName + " 是这次仪式的核心助力。");
        result.setActionPlan(actionAdvice);
        result.setLuckyColor(support == null || support.getFortune() == null ? "晨光白" : support.getFortune().getLuckyColor());
        result.setLuckyItem(action == null || action.getFortune() == null ? "便签" : action.getFortune().getLuckyItem());
        return result;
    }

    private String resolveRhythm(int score) {
        if (score >= 88) {
            return "高能推进";
        }
        if (score >= 72) {
            return "稳步展开";
        }
        if (score >= 58) {
            return "先整理再出发";
        }
        return "放低速度，保留余地";
    }

    private String buildMessage(String wishTopic, String characterName, String levelName, String focus, String ritualTheme) {
        String focusText = focus == null ? "随机相遇" : "偏好：" + focus;
        String themeText = ritualTheme == null ? "" : "在「" + ritualTheme + "」这一位上，";
        return themeText + "愿望「" + wishTopic + "」由 " + characterName + " 接住，签位是「" + levelName + "」，" + focusText + "。";
    }
}
