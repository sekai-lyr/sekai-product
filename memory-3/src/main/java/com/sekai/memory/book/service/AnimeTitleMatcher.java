package com.sekai.memory.book.service;

import tools.jackson.databind.JsonNode;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.regex.Pattern;

final class AnimeTitleMatcher {
    private static final Pattern SEASON = Pattern.compile(
            "第\\s*([0-9一二三四五六七八九十两]+)\\s*[季期部]|(?:season\\s*|s)([0-9]+)\\b|\\b([0-9]+)(?:st|nd|rd|th)\\s*season\\b|\\b(first|second|third|fourth|fifth)\\s*season\\b",
            Pattern.CASE_INSENSITIVE);

    // Common translated titles that the upstream search does not reliably index.
    private static final Map<String, String> SEARCH_ALIASES = Map.of(
            "亚托莉", "ATRI", "选择项目", "SELECTION PROJECT",
            "亲爱的弗兰克斯", "DARLING in the FRANXX", "新 狼与香辛料", "狼与香辛料 行商邂逅贤狼",
            "我想要吃掉你的胰脏", "我想吃掉你的胰脏");

    static List<String> fallbackTerms(String title) {
        var terms = new LinkedHashSet<String>();
        SEARCH_ALIASES.forEach((alias, canonical) -> { if (title.contains(alias)) terms.add(canonical); });
        String clean = title.replaceAll("剧场版合集|剧场总集篇|剧场版|合集", " ").trim();
        if (!searchTerm(title).equals(title.trim())) terms.add(title.trim());
        if (!clean.equals(title)) terms.add(clean);
        var chunks = Pattern.compile("[\\p{IsHan}]{3,}").matcher(searchTerm(title));
        while (chunks.find()) terms.add(chunks.group());
        // Split punctuation across scripts, preserving whole names instead of individual words.
        for (String part : clean.split("[：:！!？?～~·・—–]|\\s+-\\s*")) {
            if (part.trim().length() >= 3) terms.add(part.trim());
        }
        terms.remove(searchTerm(title));
        return terms.stream().limit(3).toList();
    }

    record Match(JsonNode subject, int score, String reason) {}

    static String searchTerm(String title) {
        String value = Normalizer.normalize(title, Normalizer.Form.NFKC);
        return SEASON.matcher(value).replaceAll(" ").replaceAll("\\s+", " ").trim();
    }

    static String normalize(String title) {
        String value = Normalizer.normalize(title, Normalizer.Form.NFKC).toLowerCase(Locale.ROOT);
        for (var alias : SEARCH_ALIASES.entrySet()) value = value.replace(alias.getKey().toLowerCase(Locale.ROOT), alias.getValue().toLowerCase(Locale.ROOT));
        value = value.replace("ultra romantic", "超级浪漫").replace("特別编集版", "特别编辑版").replace("瑠璃", "琉璃");
        var matcher = SEASON.matcher(value);
        StringBuilder canonical = new StringBuilder();
        while (matcher.find()) {
            String number = matcher.group(1) != null ? matcher.group(1)
                    : matcher.group(2) != null ? matcher.group(2)
                    : matcher.group(3) != null ? matcher.group(3) : matcher.group(4);
            matcher.appendReplacement(canonical, "season" + seasonNumber(number));
        }
        matcher.appendTail(canonical);
        return canonical.toString().replaceAll("[\\p{P}\\p{Z}\\s]", "");
    }

    private static int seasonNumber(String value) {
        return switch (value.toLowerCase(Locale.ROOT)) {
            case "first", "一" -> 1;
            case "second", "二", "两" -> 2;
            case "third", "三" -> 3;
            case "fourth", "四" -> 4;
            case "fifth", "五" -> 5;
            default -> {
                if (value.matches("[0-9]+")) yield value.length() < 4 ? Integer.parseInt(value) : 999;
                int tens = value.indexOf('十');
                if (tens >= 0) yield (tens == 0 ? 1 : "一二三四五六七八九".indexOf(value.charAt(0)) + 1) * 10
                        + (tens == value.length() - 1 ? 0 : "一二三四五六七八九".indexOf(value.charAt(tens + 1)) + 1);
                yield "一二三四五六七八九".indexOf(value.charAt(0)) + 1;
            }
        };
    }

    static List<Match> rank(JsonNode result, String title) {
        List<Match> matches = new ArrayList<>();
        for (JsonNode subject : result.path("data")) {
            if (subject.path("type").asInt(2) != 2) continue;
            List<String> names = new ArrayList<>();
            names.add(subject.path("name_cn").asText("").isBlank()
                    ? subject.path("name").asText("") : subject.path("name_cn").asText());
            names.add(subject.path("name").asText(""));
            for (JsonNode item : subject.path("infobox")) {
                if (List.of("别名", "中文名", "简体中文名", "英文名").contains(item.path("key").asText())) {
                    JsonNode aliases = item.path("value");
                    if (aliases.isArray()) {
                        for (JsonNode alias : aliases) names.add(alias.path("v").asText(""));
                    } else if (aliases.isTextual()) names.add(aliases.asText());
                }
            }
            String query = normalize(title);
            String base = normalize(searchTerm(title));
            int score = 0;
            String reason = "相关作品，请确认季数和版本";
            boolean firstSeason = query.equals(base + "season1")
                    && names.stream().map(AnimeTitleMatcher::normalize).noneMatch(name -> name.matches(".*season(?:[2-9]|[1-9][0-9]+).*"));
            boolean serial = List.of("TV", "WEB").contains(subject.path("platform").asText());
            for (String name : names) {
                String candidate = normalize(name);
                if (candidate.isBlank()) continue;
                if (query.equals(candidate)) {
                    score = Math.max(score, name.equals(names.getFirst()) ? (title.trim().equals(name) ? 120 : 110) : 100);
                    reason = "名称或别名匹配";
                    continue;
                }
                if (firstSeason && serial && candidate.equals(base)) {
                    score = Math.max(score, 96);
                    reason = "第一季名称匹配";
                } else if (score < 96 && base.length() >= 3 && candidate.length() >= 3
                        && (candidate.contains(base) || base.contains(candidate))) {
                    score = Math.max(score, 60 + (int) (20.0 * Math.min(candidate.length(), query.length()) / Math.max(candidate.length(), query.length())));
                } else if (score < 60 && query.length() >= 4) {
                    double similarity = 1 - distance(query, candidate) / (double) Math.max(query.length(), candidate.length());
                    if (similarity >= 0.65) score = Math.max(score, (int) (similarity * 70));
                }
            }
            String canonical = normalize(names.getFirst());
            String querySeason = seasonToken(query);
            if (!querySeason.isEmpty() && names.stream().map(AnimeTitleMatcher::normalize)
                    .noneMatch(n -> n.contains(querySeason)) && !firstSeason) score = Math.min(score, 35);
            if (title.contains("剧场") && !subject.path("platform").asText().equals("剧场版")) score = Math.min(score, 25);
            String withoutMovie = query.replace("剧场版", "");
            String candidateWithoutMovie = canonical.replace("剧场版", "");
            if (!withoutMovie.isBlank() && (title.contains("剧场") || !candidateWithoutMovie.equals(canonical))
                    && names.stream().map(AnimeTitleMatcher::normalize).anyMatch(n -> withoutMovie.equals(n.replace("剧场版", "")))
                    && (!title.contains("剧场") || subject.path("platform").asText().equals("剧场版"))) {
                score = Math.max(score, title.contains("剧场") ? 105 : 96);
                reason = "作品名称与版本匹配";
            }
            // Small grammatical differences are suggestions, never a license to ignore a season.
            if (score < 95 && querySeason.equals(seasonToken(canonical)) && query.length() >= 5
                    && query.replaceAll("[的之]", "").equals(canonical.replaceAll("[的之]", ""))) {
                score = 96;
                reason = "名称用词差异匹配";
            }
            var pieces = Pattern.compile("[\\p{IsHan}]{3,}|[A-Za-z][A-Za-z .!]+[A-Za-z!]").matcher(title.replace("剧场版", ""));
            List<String> parts = new ArrayList<>();
            while (pieces.find()) parts.add(normalize(pieces.group()));
            if (parts.size() >= 2 && title.matches(".*[\\p{IsHan}].*") && title.matches(".*[A-Za-z].*") && querySeason.isEmpty()
                    && parts.stream().allMatch(part -> names.stream().map(AnimeTitleMatcher::normalize).anyMatch(n -> n.contains(part)))
                    && (!title.contains("剧场") || subject.path("platform").asText().equals("剧场版"))) {
                score = Math.max(score, 98);
                reason = "中外文名称与副标题匹配";
            }
            // A subtitle must contribute to ranking; the shorter parent series is not a better match.
            if (score > 0 && score < 95 && canonical.contains(query) && query.length() >= 4) {
                score = Math.max(score, 80);
            }
            // Do not let a shared season number make unrelated series look similar.
            if (!querySeason.isEmpty() && score > 0 && score < 95) {
                String candidateBase = canonical.replaceAll("season[0-9]+", "");
                if (!candidateBase.contains(base) && !base.contains(candidateBase)
                        && distance(base, candidateBase) > Math.max(base.length(), candidateBase.length()) * 0.45) score = 0;
            }
            if (title.contains("合集") && subject.path("platform").asText().equals("剧场版")) {
                String series = normalize(title.replace("剧场版合集", "").replace("合集", ""));
                if (series.length() >= 3 && names.stream().map(AnimeTitleMatcher::normalize)
                        .anyMatch(n -> n.contains(series))) {
                    score = Math.max(score, 85);
                    reason = "合集中的电影，请选择具体篇章";
                }
            }
            if (score > 0) matches.add(new Match(subject, score, reason));
        }
        return matches.stream().sorted(Comparator.comparingInt(Match::score).reversed()
                .thenComparing(m -> m.subject().path("date").asText("9999")))
                .limit(8).toList();
    }

    private static String seasonToken(String value) {
        var matcher = Pattern.compile("season[0-9]+").matcher(value);
        return matcher.find() ? matcher.group() : "";
    }

    static boolean confident(List<Match> matches) {
        return !matches.isEmpty() && matches.getFirst().score() >= 95
                && (matches.size() == 1 || matches.getFirst().score() - matches.get(1).score() >= 8);
    }

    private static int distance(String left, String right) {
        int[] previous = new int[right.length() + 1];
        for (int j = 0; j <= right.length(); j++) previous[j] = j;
        for (int i = 1; i <= left.length(); i++) {
            int[] current = new int[right.length() + 1];
            current[0] = i;
            for (int j = 1; j <= right.length(); j++) {
                current[j] = Math.min(Math.min(current[j - 1] + 1, previous[j] + 1),
                        previous[j - 1] + (left.charAt(i - 1) == right.charAt(j - 1) ? 0 : 1));
            }
            previous = current;
        }
        return previous[right.length()];
    }
}
