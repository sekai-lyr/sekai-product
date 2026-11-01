package com.ykd.claw.web;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Selects question-relevant web page chunks before content is sent back to the model. */
@Service
public class WebContentSelector {
    private static final Pattern TOKEN = Pattern.compile("[\\p{L}\\p{N}]+", Pattern.UNICODE_CHARACTER_CLASS);
    private static final Pattern URL = Pattern.compile("(?i)https?://\\S+");
    private static final Set<String> STOP_WORDS = Set.of(
            "the", "and", "for", "with", "what", "this", "that", "from", "about", "page", "website",
            "网页", "页面", "网站", "链接", "内容",
            "一个", "帮我", "看看", "总结", "介绍", "什么");

    private final int contextMaxChars;
    private final int chunkChars;
    private final int maxChunks;

    public WebContentSelector(
            @Value("${webpage.context-max-chars:8000}") int contextMaxChars,
            @Value("${webpage.chunk-chars:1200}") int chunkChars,
            @Value("${webpage.max-chunks:6}") int maxChunks) {
        this.contextMaxChars = Math.max(1_000, contextMaxChars);
        this.chunkChars = Math.max(300, chunkChars);
        this.maxChunks = Math.max(1, Math.min(20, maxChunks));
    }

    public Selection select(String content, String focus) {
        String source = content == null ? "" : content.trim();
        if (source.length() <= contextMaxChars) {
            return new Selection(source, source.length(), source.length(), false, source.isEmpty() ? 0 : 1);
        }

        List<Chunk> chunks = chunks(source);
        Set<String> terms = terms(focus);
        List<Chunk> ranked = chunks.stream()
                .sorted(Comparator.<Chunk>comparingInt(chunk -> score(chunk, terms)).reversed()
                        .thenComparingInt(Chunk::index))
                .limit(maxChunks)
                .sorted(Comparator.comparingInt(Chunk::index))
                .toList();

        StringBuilder selected = new StringBuilder(Math.min(contextMaxChars, source.length()));
        int usedChunks = 0;
        for (Chunk chunk : ranked) {
            int separator = selected.isEmpty() ? 0 : 2;
            int remaining = contextMaxChars - selected.length() - separator;
            if (remaining <= 0) break;
            if (separator > 0) selected.append("\n\n");
            selected.append(chunk.text(), 0, Math.min(remaining, chunk.text().length()));
            usedChunks++;
        }
        return new Selection(selected.toString(), source.length(), selected.length(),
                selected.length() < source.length(), usedChunks);
    }

    private List<Chunk> chunks(String content) {
        List<Chunk> result = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        for (String paragraph : content.replace("\r\n", "\n").split("\\n{2,}")) {
            String clean = paragraph.replaceAll("[\\t\\r ]+", " ").trim();
            if (clean.isEmpty()) continue;
            int offset = 0;
            while (offset < clean.length()) {
                int end = Math.min(clean.length(), offset + chunkChars);
                String part = clean.substring(offset, end);
                if (!current.isEmpty() && current.length() + part.length() + 2 > chunkChars) {
                    result.add(new Chunk(result.size(), current.toString()));
                    current.setLength(0);
                }
                if (!current.isEmpty()) current.append("\n\n");
                current.append(part);
                if (current.length() >= chunkChars) {
                    result.add(new Chunk(result.size(), current.toString()));
                    current.setLength(0);
                }
                offset = end;
            }
        }
        if (!current.isEmpty()) result.add(new Chunk(result.size(), current.toString()));
        return result;
    }

    private static int score(Chunk chunk, Set<String> terms) {
        if (terms.isEmpty()) return Math.max(0, 100 - chunk.index());
        String text = chunk.text().toLowerCase(Locale.ROOT);
        int relevance = 0;
        for (String term : terms) {
            int from = 0;
            int matches = 0;
            while (matches < 3 && (from = text.indexOf(term, from)) >= 0) {
                matches++;
                from += term.length();
            }
            relevance += matches * Math.min(20, term.length() * 3);
        }
        return relevance * 100 + Math.max(0, 50 - chunk.index());
    }

    private static Set<String> terms(String focus) {
        if (focus == null || focus.isBlank()) return Set.of();
        String cleaned = URL.matcher(focus.toLowerCase(Locale.ROOT)).replaceAll(" ");
        Matcher matcher = TOKEN.matcher(cleaned);
        Set<String> terms = new HashSet<>();
        while (matcher.find()) {
            String token = matcher.group();
            if (token.length() < 2 || STOP_WORDS.contains(token)) continue;
            terms.add(token);
            if (containsCjk(token) && token.length() > 2) {
                for (int index = 0; index < token.length() - 1; index++) {
                    terms.add(token.substring(index, index + 2));
                }
            }
        }
        addBilingualExpansions(cleaned, terms);
        return terms;
    }

    private static void addBilingualExpansions(String query, Set<String> terms) {
        if (containsAny(query, "价格", "费用", "收费", "多少钱")) {
            terms.addAll(Set.of("price", "pricing", "cost", "fee"));
        }
        if (containsAny(query, "安装", "部署")) {
            terms.addAll(Set.of("install", "installation", "setup", "deploy", "deployment"));
        }
        if (containsAny(query, "功能", "能力", "特性")) {
            terms.addAll(Set.of("feature", "features", "capability", "capabilities"));
        }
        if (containsAny(query, "时间", "日期", "什么时候")) {
            terms.addAll(Set.of("time", "date", "schedule"));
        }
    }

    private static boolean containsAny(String value, String... terms) {
        for (String term : terms) {
            if (value.contains(term)) return true;
        }
        return false;
    }

    private static boolean containsCjk(String value) {
        return value.codePoints().anyMatch(codePoint -> Character.UnicodeScript.of(codePoint)
                == Character.UnicodeScript.HAN);
    }

    public record Selection(String content, int originalChars, int selectedChars,
                            boolean truncated, int selectedChunks) { }

    private record Chunk(int index, String text) { }
}
