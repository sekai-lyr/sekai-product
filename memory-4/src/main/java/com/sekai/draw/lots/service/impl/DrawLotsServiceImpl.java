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
import com.sekai.draw.lots.model.CoachStep;
import com.sekai.draw.lots.model.DashboardStats;
import com.sekai.draw.lots.model.DrawRecord;
import com.sekai.draw.lots.model.FortuneInsight;
import com.sekai.draw.lots.model.FortuneReport;
import com.sekai.draw.lots.model.ReportPoint;
import com.sekai.draw.lots.model.Result;
import com.sekai.draw.lots.model.RitualCard;
import com.sekai.draw.lots.model.RitualResult;
import com.sekai.draw.lots.model.User;
import com.sekai.draw.lots.model.VipCoachPlan;
import com.sekai.draw.lots.service.DrawLotsService;
import com.sekai.draw.lots.util.CharacterLocalizationUtil;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
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
        return createDrawRecord(user, mood, wishTopic, focus, null);
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
        for (RitualCard card : cards) {
            Result<DrawRecord> drawResult = createDrawRecord(user, mood, topic + " · " + card.getTheme(), focus, card.getTheme());
            if (!drawResult.isSuccess()) {
                return Result.fail(drawResult.getMessage());
            }
            card.setRecord(drawResult.getData());
        }

        RitualResult ritual = buildRitualResult(cards, topic);
        return Result.ok(ritual);
    }

    private Result<DrawRecord> createDrawRecord(User user, String mood, String wishTopic, String focus, String ritualTheme) {
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
        recordDO.setCharacterId(characterDO.getId());
        recordDO.setFortuneId(fortuneDO.getId());
        recordDO.setLuckScore(scoreWithWishBonus(fortuneDO.getLuckScore(), wishTopic, normalizedFocus));
        recordDO.setMood(trimToNull(mood));
        recordDO.setWishTopic(defaultText(wishTopic, "今日运势"));
        recordDO.setMessage(buildMessage(recordDO.getWishTopic(), CharacterLocalizationUtil.displayName(characterDO.getEnglishName()), fortuneDO.getLevelName(), normalizedFocus, ritualTheme));
        recordMapper.insert(recordDO);

        DrawRecord record = recordDO.convertToRecord();
        record.setCharacter(characterDO.convertToCharacter());
        record.setFortune(fortuneDO.convertToFortune());
        return Result.ok(record);
    }

    @Override
    @Transactional
    public Result<DrawRecord> dailyDraw(User user, String mood, String focus) {
        if (user == null || user.getId() == null) {
            return Result.fail("请先登录");
        }
        DrawRecord today = recordMapper.selectTodayDaily(user.getId());
        if (today != null) {
            return Result.ok(today);
        }
        return draw(user, mood, "每日固定签", focus);
    }

    @Override
    public FortuneInsight getInsight(User user) {
        FortuneInsight insight = new FortuneInsight();
        if (user == null || user.getId() == null) {
            return insight;
        }
        Integer maxScore = recordMapper.maxScoreByUserId(user.getId());
        Integer avgScore = recordMapper.avgScoreByUserId(user.getId());
        insight.setTotalDraws(recordMapper.countByUserId(user.getId()));
        insight.setBestScore(maxScore == null ? 0 : maxScore);
        insight.setAverageScore(avgScore == null ? 0 : avgScore);
        insight.setStreakDays(recordMapper.countStreakDays(user.getId()));
        insight.setMoodStats(recordMapper.selectMoodStats(user.getId()));
        insight.setCharacterStats(recordMapper.selectCharacterStats(user.getId(), 8).stream()
                .peek(item -> item.setLabel(CharacterLocalizationUtil.displayName(item.getLabel())))
                .toList());
        insight.setWishStats(recordMapper.selectWishStats(user.getId(), 8));
        insight.setRecentHighScoreRecords(recordMapper.selectRecentByUserId(user.getId(), 12).stream()
                .filter(record -> record.getLuckScore() != null && record.getLuckScore() >= 86)
                .toList());
        return insight;
    }

    @Override
    public FortuneReport getReport(User user) {
        FortuneReport report = new FortuneReport();
        report.setTitle("最近运势报告");
        if (user == null || user.getId() == null) {
            report.setSummary("登录后会根据你的抽签历史生成报告。");
            report.setMomentum("暂无数据");
            report.setRiskLevel("低");
            report.setNextAction("先抽一签，建立第一条趋势记录。");
            return report;
        }

        List<DrawRecord> recent = recordMapper.selectRecentByUserId(user.getId(), 14).stream()
                .sorted(Comparator.comparing(DrawRecord::getDrawTime, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        if (recent.isEmpty()) {
            report.setSummary("还没有足够的抽签记录，先去首页抽几次签吧。");
            report.setMomentum("等待启动");
            report.setRiskLevel("低");
            report.setNextAction("从每日固定签开始，再补一次三连签仪式。");
            return report;
        }

        List<Integer> scores = recent.stream()
                .map(record -> record.getLuckScore() == null ? 0 : record.getLuckScore())
                .toList();
        int sum = scores.stream().mapToInt(Integer::intValue).sum();
        int highest = scores.stream().mapToInt(Integer::intValue).max().orElse(0);
        int lowest = scores.stream().mapToInt(Integer::intValue).min().orElse(0);
        int average = Math.round((float) sum / scores.size());
        int volatility = highest - lowest;
        int split = Math.max(1, scores.size() / 2);
        int earlyAverage = average(scores.subList(0, split));
        int lateAverage = average(scores.subList(split, scores.size()));

        report.setRecentAverage(average);
        report.setHighestScore(highest);
        report.setLowestScore(lowest);
        report.setVolatility(volatility);
        report.setMomentum(resolveMomentum(earlyAverage, lateAverage, scores.size()));
        report.setRiskLevel(resolveRisk(volatility, average));
        report.setSummary(buildReportSummary(report, recent));
        report.setNextAction(buildNextAction(report, recent.get(recent.size() - 1)));
        report.setPoints(buildReportPoints(recent));
        return report;
    }

    @Override
    public VipCoachPlan getVipCoachPlan(User user) {
        VipCoachPlan plan = new VipCoachPlan();
        plan.setTitle("7 天行动计划");
        if (user == null || user.getId() == null) {
            return buildStarterCoachPlan(plan);
        }

        List<DrawRecord> recent = recordMapper.selectRecentByUserId(user.getId(), 21).stream()
                .sorted(Comparator.comparing(DrawRecord::getDrawTime, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        if (recent.isEmpty()) {
            return buildStarterCoachPlan(plan);
        }

        List<Integer> scores = recent.stream()
                .map(record -> record.getLuckScore() == null ? 0 : record.getLuckScore())
                .toList();
        int averageScore = average(scores);
        int highScore = scores.stream().mapToInt(Integer::intValue).max().orElse(0);
        int lowScore = scores.stream().mapToInt(Integer::intValue).min().orElse(0);
        int volatility = highScore - lowScore;
        String primaryTheme = mostFrequentText(recent, DrawRecord::getWishTopic, "今日运势");
        String dominantMood = mostFrequentText(recent, DrawRecord::getMood, "平静");
        String rhythm = resolveCoachRhythm(averageScore, volatility, recent.size());
        String riskLevel = resolveCoachRisk(averageScore, volatility);
        DrawRecord latest = recent.get(recent.size() - 1);

        plan.setAverageScore(averageScore);
        plan.setHighScore(highScore);
        plan.setLowScore(lowScore);
        plan.setTotalSamples(recent.size());
        plan.setPrimaryTheme(primaryTheme);
        plan.setRhythm(rhythm);
        plan.setRiskLevel(riskLevel);
        plan.setSummary("基于最近 " + recent.size() + " 次抽签，当前最值得经营的主题是「" + primaryTheme
                + "」。整体节奏为「" + rhythm + "」，风险等级为「" + riskLevel + "」。");
        plan.setSignals(List.of(
                "最近均分 " + averageScore + "，最高 " + highScore + "，最低 " + lowScore,
                "常见心情是「" + dominantMood + "」，安排任务时要顺着这个状态，不要硬拧",
                "最新守护伙伴是 " + characterName(latest) + "，可把它当作本周行动锚点"
        ));
        plan.setSteps(buildCoachSteps(primaryTheme, rhythm, riskLevel, dominantMood, latest));
        plan.setBasisRecords(recent.stream()
                .sorted(Comparator.comparing(DrawRecord::getDrawTime, Comparator.nullsLast(Comparator.naturalOrder())).reversed())
                .limit(6)
                .toList());
        return plan;
    }

    @Override
    public List<Achievement> getAchievements(User user) {
        if (user == null || user.getId() == null) {
            return List.of();
        }
        DashboardStats stats = getStats(user);
        FortuneInsight insight = getInsight(user);
        List<DrawRecord> recentRecords = recordMapper.selectRecentByUserId(user.getId(), 80);
        int ritualRecords = countMatching(recentRecords, record -> containsText(record.getWishTopic(), "三连签仪式"));
        int uniqueWishTopics = (int) recentRecords.stream()
                .map(DrawRecord::getWishTopic)
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(topic -> !topic.isEmpty())
                .distinct()
                .count();
        int highScoreRecords = countMatching(recentRecords, record -> record.getLuckScore() != null && record.getLuckScore() >= 90);

        List<Achievement> achievements = new ArrayList<>();
        achievements.add(new Achievement("first-draw", "初次相遇", "完成第一次抽签", "bronze", stats.getTotalDraws(), 1, "去首页抽出第一位守护伙伴。"));
        achievements.add(new Achievement("daily-spark", "今日点火", "今天至少抽一签", "bronze", stats.getTodayDraws(), 1, "抽一次今日固定签即可点亮。"));
        achievements.add(new Achievement("ten-draws", "签文收集者", "累计完成 10 次抽签", "silver", stats.getTotalDraws(), 10, "继续抽签积累自己的角色轨迹。"));
        achievements.add(new Achievement("ritual-reader", "三连签读者", "完成一次三连签仪式", "silver", ritualRecords, 3, "首页点击三连签仪式，一次会生成三张签。"));
        achievements.add(new Achievement("high-score", "星光大吉", "至少出现 1 次 90 分以上签", "gold", highScoreRecords, 1, "高分签会自动点亮这个成就。"));
        achievements.add(new Achievement("collector", "羁绊收藏家", "收藏 5 位角色", "silver", stats.getFavoriteCharacters(), 5, "在角色详情或抽签结果里收藏喜欢的角色。"));
        achievements.add(new Achievement("theme-weaver", "愿望织线者", "记录 5 个不同许愿主题", "gold", uniqueWishTopics, 5, "在首页许愿主题里换几个不同目标。"));
        achievements.add(new Achievement("active-week", "七日观星", "近 30 天内活跃 7 天", "gold", insight.getStreakDays(), 7, "每天来抽一次固定签，慢慢点亮。"));
        achievements.add(new Achievement("hundred-club", "百签档案", "累计完成 100 次抽签", "platinum", stats.getTotalDraws(), 100, "长期记录后解锁。"));
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

    private String resolveMomentum(int earlyAverage, int lateAverage, int count) {
        if (count < 4) {
            return "样本积累中";
        }
        int delta = lateAverage - earlyAverage;
        if (delta >= 8) {
            return "明显上升";
        }
        if (delta <= -8) {
            return "短期回落";
        }
        if (Math.abs(delta) <= 3) {
            return "稳定横盘";
        }
        return delta > 0 ? "温和抬升" : "轻微降温";
    }

    private String resolveRisk(int volatility, int average) {
        if (volatility >= 36) {
            return "高波动";
        }
        if (average < 58) {
            return "偏低迷";
        }
        if (volatility >= 22) {
            return "中波动";
        }
        return "稳定";
    }

    private String buildReportSummary(FortuneReport report, List<DrawRecord> recent) {
        DrawRecord last = recent.get(recent.size() - 1);
        String lastCharacter = last.getCharacter() == null ? "最近的守护伙伴" : last.getCharacter().getDisplayName();
        return "最近 " + recent.size() + " 次抽签均分 " + report.getRecentAverage()
                + "，最高 " + report.getHighestScore()
                + "，最低 " + report.getLowestScore()
                + "。趋势为「" + report.getMomentum() + "」，由 " + lastCharacter + " 接住最新一签。";
    }

    private String buildNextAction(FortuneReport report, DrawRecord lastRecord) {
        String topic = defaultText(lastRecord.getWishTopic(), "今日运势");
        if ("高波动".equals(report.getRiskLevel())) {
            return "围绕「" + topic + "」先拆出一个 15 分钟内能完成的小动作，今天别同时推进太多线。";
        }
        if ("明显上升".equals(report.getMomentum())) {
            return "势头很好，适合把「" + topic + "」往前推一步，并记录一个明确结果。";
        }
        if ("短期回落".equals(report.getMomentum())) {
            return "先复盘最近一次低分签的提醒，把「" + topic + "」调整成更小、更稳的目标。";
        }
        return "维持节奏，给「" + topic + "」安排一个可完成的下一步。";
    }

    private List<ReportPoint> buildReportPoints(List<DrawRecord> records) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("MM-dd HH:mm");
        List<ReportPoint> points = new ArrayList<>();
        for (DrawRecord record : records) {
            String label = record.getDrawTime() == null ? "最近" : formatter.format(record.getDrawTime());
            String characterName = record.getCharacter() == null ? "角色" : record.getCharacter().getDisplayName();
            points.add(new ReportPoint(label, record.getLuckScore(), characterName, record.getWishTopic()));
        }
        return points;
    }

    private VipCoachPlan buildStarterCoachPlan(VipCoachPlan plan) {
        plan.setSummary("还没有足够的抽签记录。先完成一次每日固定签，再回来生成更贴近你的行动计划。");
        plan.setRhythm("等待启动");
        plan.setRiskLevel("低");
        plan.setPrimaryTheme("今日运势");
        plan.setAverageScore(0);
        plan.setHighScore(0);
        plan.setLowScore(0);
        plan.setTotalSamples(0);
        plan.setSignals(List.of("完成第一次抽签后，会自动生成个人节奏", "会员计划会根据你的历史记录持续变化", "建议先从一个很小的目标开始"));
        plan.setSteps(List.of(
                new CoachStep(1, "抽出第一签", "建立样本", "回到首页完成今日固定签，写下一个真实的许愿主题。", "拿到第一条历史记录", "启动"),
                new CoachStep(2, "补充主题", "明确方向", "围绕同一个主题再抽一次随机签，观察两次提示是否一致。", "确认本周主线", "校准")
        ));
        plan.setBasisRecords(List.of());
        return plan;
    }

    private List<CoachStep> buildCoachSteps(String primaryTheme, String rhythm, String riskLevel, String dominantMood, DrawRecord latest) {
        String partner = characterName(latest);
        String latestAdvice = latest == null || latest.getFortune() == null ? "先完成一个 15 分钟内能收尾的小动作。" : latest.getFortune().getAdvice();
        List<CoachStep> steps = new ArrayList<>();
        steps.add(new CoachStep(1, "校准目标", primaryTheme, "把「" + primaryTheme + "」写成一个本周能验证的结果，只保留最关键的一件事。", "目标能在一句话里说清楚", "校准"));
        steps.add(new CoachStep(2, "最小推进", rhythm, "按 " + partner + " 的提醒，完成一个 15 分钟动作：" + latestAdvice, "今天有一个可见产出", "推进"));
        steps.add(new CoachStep(3, "阻力拆解", riskLevel, "列出最容易卡住你的 3 个点，每个点只配一个应对动作，避免同时开太多线。", "阻力清单少于 3 条", "整理"));
        steps.add(new CoachStep(4, "能量补给", dominantMood, "根据最近常见心情「" + dominantMood + "」安排一次低负担补给：整理桌面、散步或提前休息。", "状态比前一天更轻", "恢复"));
        steps.add(new CoachStep(5, "高分复用", primaryTheme, "回看最近最高分签，把其中一句建议改写成今天的执行规则。", "形成一条个人规则", "复用"));
        steps.add(new CoachStep(6, "对外确认", rhythm, "把阶段成果发给一个可信的人，或给自己写一段复盘，验证方向是否还值得继续。", "得到一次反馈", "验证"));
        steps.add(new CoachStep(7, "收束复盘", primaryTheme, "复盘这一周：保留有效动作，删掉消耗动作，并为下周设置一个更小的主题。", "留下下周第一步", "收束"));
        return steps;
    }

    private String mostFrequentText(List<DrawRecord> records, Function<DrawRecord, String> extractor, String fallback) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (DrawRecord record : records) {
            String value = trimToNull(extractor.apply(record));
            if (value != null) {
                counts.put(value, counts.getOrDefault(value, 0) + 1);
            }
        }
        return counts.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(fallback);
    }

    private String resolveCoachRhythm(int averageScore, int volatility, int count) {
        if (count < 4) {
            return "样本积累中";
        }
        if (averageScore >= 86 && volatility <= 18) {
            return "高能冲刺";
        }
        if (averageScore >= 72) {
            return volatility >= 28 ? "稳中有波动" : "稳定推进";
        }
        if (averageScore >= 58) {
            return "先修复节奏";
        }
        return "低速恢复";
    }

    private String resolveCoachRisk(int averageScore, int volatility) {
        if (volatility >= 36) {
            return "高波动";
        }
        if (averageScore < 58) {
            return "偏低迷";
        }
        if (volatility >= 24) {
            return "中波动";
        }
        return "可控";
    }

    private String characterName(DrawRecord record) {
        if (record == null || record.getCharacter() == null || trimToNull(record.getCharacter().getDisplayName()) == null) {
            return "守护伙伴";
        }
        return record.getCharacter().getDisplayName();
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
