package com.sekai.draw.lots.service.impl;

import com.sekai.draw.lots.dataobject.SekaiDrawLotsWheelOptionDO;
import com.sekai.draw.lots.dataobject.SekaiDrawLotsWheelSpinDO;
import com.sekai.draw.lots.mapper.SekaiDrawLotsWheelOptionMapper;
import com.sekai.draw.lots.mapper.SekaiDrawLotsWheelSpinMapper;
import com.sekai.draw.lots.model.DrawRecord;
import com.sekai.draw.lots.model.Result;
import com.sekai.draw.lots.model.User;
import com.sekai.draw.lots.model.WheelOption;
import com.sekai.draw.lots.model.WheelSpinRecord;
import com.sekai.draw.lots.model.WheelSpinResult;
import com.sekai.draw.lots.model.WheelSuggestion;
import com.sekai.draw.lots.service.DrawLotsService;
import com.sekai.draw.lots.service.WheelService;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class WheelServiceImpl implements WheelService {

    private static final List<String> SAFE_COLORS = List.of(
            "#78e08f", "#ffe08a", "#ff8fc7", "#78d5ff", "#a7a3ff", "#ffb86b", "#7dd3fc", "#f0abfc"
    );

    @Resource
    private SekaiDrawLotsWheelOptionMapper optionMapper;

    @Resource
    private SekaiDrawLotsWheelSpinMapper spinMapper;

    @Resource
    private DrawLotsService drawLotsService;

    @Override
    @Transactional
    public List<WheelOption> options(User user) {
        if (user == null || user.getId() == null) {
            return List.of();
        }
        List<SekaiDrawLotsWheelOptionDO> options = optionMapper.selectByUserId(user.getId());
        if (options.isEmpty()) {
            seedDefaultOptions(user.getId());
            options = optionMapper.selectByUserId(user.getId());
        }
        return options.stream().map(SekaiDrawLotsWheelOptionDO::convertToOption).toList();
    }

    @Override
    public List<WheelSpinRecord> recentSpins(User user, int limit) {
        if (user == null || user.getId() == null) {
            return List.of();
        }
        return spinMapper.selectRecentByUserId(user.getId(), Math.max(1, Math.min(limit, 20))).stream()
                .map(SekaiDrawLotsWheelSpinDO::convertToRecord)
                .toList();
    }

    @Override
    public List<WheelSuggestion> suggestions(User user) {
        if (user == null || user.getId() == null) {
            return List.of();
        }
        return buildSuggestions(drawLotsService.recentRecords(user, 21));
    }

    @Override
    @Transactional
    public Result<Integer> importSuggestions(User user) {
        if (user == null || user.getId() == null) {
            return Result.fail("请先登录");
        }
        List<SekaiDrawLotsWheelOptionDO> existingOptions = optionMapper.selectByUserId(user.getId());
        Set<String> existingTitles = new LinkedHashSet<>();
        for (SekaiDrawLotsWheelOptionDO option : existingOptions) {
            String key = normalizeTitle(option.getTitle());
            if (key != null) {
                existingTitles.add(key);
            }
        }

        int sortOrder = existingOptions.size() + 1;
        int added = 0;
        for (WheelSuggestion suggestion : suggestions(user)) {
            String key = normalizeTitle(suggestion.getTitle());
            if (key == null || existingTitles.contains(key)) {
                continue;
            }
            insertSuggestion(user.getId(), suggestion, sortOrder++);
            existingTitles.add(key);
            added++;
        }

        Result<Integer> result = Result.ok(added);
        result.setMessage(added > 0 ? "已导入 " + added + " 个智能分区。" : "智能分区已经在转盘里，不需要重复导入。");
        return result;
    }

    @Override
    @Transactional
    public Result<WheelOption> addOption(User user, String title, String detail, Integer weight, String color) {
        if (user == null || user.getId() == null) {
            return Result.fail("请先登录");
        }
        String normalizedTitle = trimToNull(title);
        if (normalizedTitle == null) {
            return Result.fail("分区名称不能为空");
        }
        if (normalizedTitle.length() > 80) {
            return Result.fail("分区名称不能超过 80 个字符");
        }
        String normalizedDetail = trimToNull(detail);
        if (normalizedDetail != null && normalizedDetail.length() > 180) {
            return Result.fail("说明不能超过 180 个字符");
        }

        SekaiDrawLotsWheelOptionDO optionDO = new SekaiDrawLotsWheelOptionDO();
        optionDO.setUserId(user.getId());
        optionDO.setTitle(normalizedTitle);
        optionDO.setDetail(normalizedDetail);
        optionDO.setWeight(Math.max(1, Math.min(weight == null ? 1 : weight, 10)));
        optionDO.setColor(resolveColor(color, optionMapper.selectByUserId(user.getId()).size()));
        optionDO.setSortOrder(optionMapper.selectByUserId(user.getId()).size() + 1);
        optionDO.setEnabled(true);
        optionMapper.insert(optionDO);

        Result<WheelOption> result = Result.ok(optionMapper.selectByIdForUser(optionDO.getId(), user.getId()).convertToOption());
        result.setMessage("转盘分区已添加。");
        return result;
    }

    @Override
    @Transactional
    public Result<Boolean> deleteOption(User user, Long optionId) {
        if (user == null || user.getId() == null) {
            return Result.fail("请先登录");
        }
        if (optionId == null || optionMapper.selectByIdForUser(optionId, user.getId()) == null) {
            return Result.fail("分区不存在");
        }
        optionMapper.deleteForUser(optionId, user.getId());
        Result<Boolean> result = Result.ok(true);
        result.setMessage("转盘分区已删除。");
        return result;
    }

    @Override
    @Transactional
    public Result<WheelSpinResult> spin(User user) {
        if (user == null || user.getId() == null) {
            return Result.fail("请先登录");
        }
        List<WheelOption> enabledOptions = optionMapper.selectEnabledByUserId(user.getId()).stream()
                .map(SekaiDrawLotsWheelOptionDO::convertToOption)
                .toList();
        if (enabledOptions.isEmpty()) {
            seedDefaultOptions(user.getId());
            enabledOptions = optionMapper.selectEnabledByUserId(user.getId()).stream()
                    .map(SekaiDrawLotsWheelOptionDO::convertToOption)
                    .toList();
        }
        if (enabledOptions.isEmpty()) {
            return Result.fail("请先添加至少一个转盘分区");
        }

        WheelOption chosen = chooseWeighted(enabledOptions);
        String line = buildMoodLine(chosen);

        SekaiDrawLotsWheelSpinDO spinDO = new SekaiDrawLotsWheelSpinDO();
        spinDO.setUserId(user.getId());
        spinDO.setOptionId(chosen.getId());
        spinDO.setResultTitle(chosen.getTitle());
        spinDO.setResultDetail(chosen.getDetail());
        spinDO.setResultColor(chosen.getColor());
        spinDO.setMoodLine(line);
        spinMapper.insert(spinDO);

        WheelSpinRecord record = spinMapper.selectByPrimaryKey(spinDO.getId()).convertToRecord();
        Result<WheelSpinResult> result = Result.ok(new WheelSpinResult(chosen, record, line));
        result.setMessage("命运转盘已经停下。");
        return result;
    }

    private void seedDefaultOptions(Long userId) {
        addSeed(userId, "补番 1 集", "把想看的番推进一集，允许自己认真快乐一下。", 2, "#ff8fc7", 1);
        addSeed(userId, "写 15 分钟代码", "只开一个小任务，先提交一个能跑的小改动。", 3, "#78d5ff", 2);
        addSeed(userId, "整理桌面", "清掉一个角落，给下一段状态腾位置。", 1, "#78e08f", 3);
        addSeed(userId, "背 20 个词", "开计时器，像刷副本一样打一小关。", 2, "#ffe08a", 4);
        addSeed(userId, "画一张设定草图", "随便画一个角色设定，不追求完成度。", 1, "#a7a3ff", 5);
        addSeed(userId, "喝水休息 10 分钟", "恢复也是主线任务，不算偷懒。", 1, "#ffb86b", 6);
    }

    private void addSeed(Long userId, String title, String detail, int weight, String color, int sortOrder) {
        SekaiDrawLotsWheelOptionDO optionDO = new SekaiDrawLotsWheelOptionDO();
        optionDO.setUserId(userId);
        optionDO.setTitle(title);
        optionDO.setDetail(detail);
        optionDO.setWeight(weight);
        optionDO.setColor(color);
        optionDO.setSortOrder(sortOrder);
        optionDO.setEnabled(true);
        optionMapper.insert(optionDO);
    }

    private void insertSuggestion(Long userId, WheelSuggestion suggestion, int sortOrder) {
        SekaiDrawLotsWheelOptionDO optionDO = new SekaiDrawLotsWheelOptionDO();
        optionDO.setUserId(userId);
        optionDO.setTitle(suggestion.getTitle());
        optionDO.setDetail(suggestion.getDetail());
        optionDO.setWeight(Math.max(1, Math.min(suggestion.getWeight() == null ? 1 : suggestion.getWeight(), 10)));
        optionDO.setColor(resolveColor(suggestion.getColor(), sortOrder));
        optionDO.setSortOrder(sortOrder);
        optionDO.setEnabled(true);
        optionMapper.insert(optionDO);
    }

    private List<WheelSuggestion> buildSuggestions(List<DrawRecord> records) {
        List<DrawRecord> recent = records == null ? List.of() : records;
        List<WheelSuggestion> suggestions = new ArrayList<>();

        DrawRecord best = null;
        int sum = 0;
        int highest = 0;
        int lowest = Integer.MAX_VALUE;
        for (DrawRecord record : recent) {
            int score = record.getLuckScore() == null ? 0 : record.getLuckScore();
            sum += score;
            if (score > highest) {
                highest = score;
                best = record;
            }
            if (score < lowest) {
                lowest = score;
            }
        }
        int count = recent.size();
        int average = count == 0 ? 0 : Math.round((float) sum / count);
        int volatility = count == 0 ? 0 : highest - lowest;
        DrawRecord latest = count == 0 ? null : recent.get(0);
        String theme = mostFrequentText(recent, "今日运势");
        String rhythm = rhythmLabel(average, volatility, count);
        String risk = riskLabel(average, volatility);

        suggestions.add(suggestion(
                "推进「" + theme + "」15 分钟",
                "把主题写成一个今天能交付的小动作，先计时 15 分钟开局。",
                3,
                "#78d5ff",
                "来自最近抽签主线"
        ));
        if (best != null) {
            String bestAdvice = best.getFortune() == null ? "先完成一个能收尾的小动作。" : best.getFortune().getAdvice();
            suggestions.add(suggestion(
                    "复盘最高分签",
                    "回看最近最高分「" + scoreText(best) + "」的建议：" + bestAdvice,
                    2,
                    "#ffe08a",
                    "来自抽签高分回顾"
            ));
        }
        suggestions.add(suggestion(
                "阻力清单 3 条",
                "列出最容易卡住的 3 个点，每个点只写一个应对动作。",
                "高波动".equals(risk) ? 3 : 2,
                "#a7a3ff",
                "风险等级：" + risk
        ));
        suggestions.add(suggestion(
                "能量补给 10 分钟",
                "按「" + rhythm + "」节奏安排一次低负担恢复：喝水、整理桌面或提前休息。",
                1,
                "#78e08f",
                "根据当前节奏调整"
        ));
        if (latest != null) {
            String partnerName = latest.getCharacter() == null ? "守护伙伴" : latest.getCharacter().getDisplayName();
            String latestAdvice = latest.getFortune() == null ? "先完成一个能收尾的小动作。" : latest.getFortune().getAdvice();
            suggestions.add(suggestion(
                    partnerName + " 的提醒",
                    "「" + theme + "」按 " + partnerName + " 的建议做一次最小推进：" + latestAdvice,
                    2,
                    SAFE_COLORS.get(5),
                    "来自最新守护伙伴"
            ));
        }

        if (suggestions.size() < 6) {
            suggestions.add(suggestion(
                    "抽一签校准方向",
                    "回到首页抽一次固定签，让今天的转盘有一个新的二次元锚点。",
                    1,
                    "#ff8fc7",
                    "样本不足时自动补位"
            ));
        }
        return suggestions.stream().limit(6).toList();
    }

    private String scoreText(DrawRecord record) {
        return record.getLuckScore() == null ? "高分签" : record.getLuckScore() + " 分";
    }

    private String rhythmLabel(int averageScore, int volatility, int count) {
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

    private String riskLabel(int averageScore, int volatility) {
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

    private String mostFrequentText(List<DrawRecord> records, String fallback) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (DrawRecord record : records) {
            String value = trimToNull(record.getWishTopic());
            if (value != null) {
                counts.put(value, counts.getOrDefault(value, 0) + 1);
            }
        }
        return counts.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(fallback);
    }

    private WheelSuggestion suggestion(String title, String detail, Integer weight, String color, String reason) {
        return new WheelSuggestion(limitText(defaultText(title, "今日小任务"), 80),
                limitText(defaultText(detail, "完成一个可以收尾的小动作。"), 180),
                Math.max(1, Math.min(weight == null ? 1 : weight, 10)),
                color,
                limitText(defaultText(reason, "智能建议"), 80));
    }

    private WheelOption chooseWeighted(List<WheelOption> options) {
        int totalWeight = options.stream()
                .mapToInt(option -> Math.max(1, option.getWeight() == null ? 1 : option.getWeight()))
                .sum();
        int cursor = ThreadLocalRandom.current().nextInt(totalWeight);
        for (WheelOption option : options) {
            cursor -= Math.max(1, option.getWeight() == null ? 1 : option.getWeight());
            if (cursor < 0) {
                return option;
            }
        }
        return options.get(options.size() - 1);
    }

    private String buildMoodLine(WheelOption option) {
        String title = option.getTitle() == null ? "这件事" : option.getTitle();
        String[] lines = {
                "今日任务已被选中，主角请入场。",
                "命运指针落下，先做「" + title + "」。",
                "这不是随机，这是世界线给你的提示。",
                "先完成这一小段，后面的剧情自然会展开。"
        };
        return lines[ThreadLocalRandom.current().nextInt(lines.length)];
    }

    private String resolveColor(String color, int index) {
        String trimmed = trimToNull(color);
        if (trimmed != null && SAFE_COLORS.contains(trimmed)) {
            return trimmed;
        }
        return SAFE_COLORS.get(Math.floorMod(index, SAFE_COLORS.size()));
    }

    private String normalizeTitle(String title) {
        String trimmed = trimToNull(title);
        return trimmed == null ? null : trimmed.toLowerCase(Locale.ROOT);
    }

    private String defaultText(String value, String fallback) {
        String trimmed = trimToNull(value);
        return trimmed == null ? fallback : trimmed;
    }

    private String limitText(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        if (maxLength <= 3) {
            return value.substring(0, maxLength);
        }
        return value.substring(0, maxLength - 3) + "...";
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
