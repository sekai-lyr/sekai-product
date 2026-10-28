package com.sekai.memory.book.service;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import java.nio.file.Files;
import java.nio.file.Path;
import static org.junit.jupiter.api.Assertions.*;

class AnimeTitleMatcherTest {
    private JsonNode fixture() throws Exception {
        return JsonMapper.builder().build().readTree(Files.readString(Path.of("src/test/resources/metadata/haikyu.json")));
    }

    @ParameterizedTest
    @CsvSource({"排球少年 第一季,84171", "排球少年 第1季,84171", "排球少年 S1,84171",
            "排球少年！！ 第一季,84171", "排球少年 第二季,120236", "排球少年 S2,120236",
            "Haikyuu Season 2,120236", "排球少年 第三季,173849", "排球少年 第四季,269918",
            "排球少年,84171", "ハイキュー!!,84171"})
    void understandsSeasonAliasesAndPunctuation(String title, long id) throws Exception {
        var matches = AnimeTitleMatcher.rank(fixture(), title);
        assertTrue(AnimeTitleMatcher.confident(matches), title);
        assertEquals(id, matches.getFirst().subject().path("id").asLong());
    }

    @Test
    void doesNotSubstituteWrongSeasonOrMovieAndOffersCandidates() throws Exception {
        var missingSeason = AnimeTitleMatcher.rank(fixture(), "排球少年 第九季");
        assertFalse(missingSeason.isEmpty());
        assertFalse(AnimeTitleMatcher.confident(missingSeason));
        var movie = AnimeTitleMatcher.rank(fixture(), "排球少年 垃圾场决战");
        assertTrue(AnimeTitleMatcher.confident(movie));
        assertEquals(394621, movie.getFirst().subject().path("id").asInt());
    }

    @Test
    void ambiguousNamesNeedSelectionAndTyposOnlyProduceSuggestions() throws Exception {
        JsonNode duplicated = JsonMapper.builder().build().readTree("""
                {"data":[{"id":1,"name_cn":"同名动画","platform":"TV"},
                         {"id":2,"name_cn":"同名动画","platform":"剧场版"}]}
                """);
        assertFalse(AnimeTitleMatcher.confident(AnimeTitleMatcher.rank(duplicated,"同名动画")));
        var typo = AnimeTitleMatcher.rank(fixture(), "排球少午");
        assertFalse(typo.isEmpty());
        assertFalse(AnimeTitleMatcher.confident(typo));
    }

    @ParameterizedTest
    @CsvSource({"亚托莉 -我挚爱的时光,397604", "选择项目,321190", "亲爱的弗兰克斯,218711",
            "我想要吃掉你的胰脏,221736", "新 狼与香辛料,372010", "辉夜大小姐想让我告白 -Ultra Romantic-,317613",
            "黑子的篮球剧场版：LAST GAME,147147", "堀与宫村,315069", "轻音少女,1424",
            "金牌得主,430699", "莉可丽丝 Friends are thieves of time.,504950", "瑠璃的宝石,512190",
            "夏洛特 Charlotte,120925", "鬼灭之刃 游郭篇 特别编辑版,422759"})
    void matchesRealArchiveRegressions(String title, long id) throws Exception {
        var source = JsonMapper.builder().build().readTree(Files.readString(Path.of("src/test/resources/metadata/sekai-titles.json")));
        var matches = AnimeTitleMatcher.rank(source, title);
        assertTrue(AnimeTitleMatcher.confident(matches), title);
        assertEquals(id, matches.getFirst().subject().path("id").asLong(), title);
    }

    @Test
    void ranksRequestedSeasonBeforeOriginalButKeepsSplitSeasonAmbiguous() throws Exception {
        var source = JsonMapper.builder().build().readTree(Files.readString(Path.of("src/test/resources/metadata/sekai-titles.json")));
        var matches = AnimeTitleMatcher.rank(source, "Re：从零开始的异世界生活 第四季");
        assertFalse(AnimeTitleMatcher.confident(matches));
        assertTrue(matches.getFirst().subject().path("name_cn").asText().contains("第四季"));
        assertTrue(AnimeTitleMatcher.rank(source, "鬼灭之刃 游郭篇 特别编辑版").stream()
                .noneMatch(m -> m.subject().path("name_cn").asText().equals("鬼")));
    }

    @Test
    void handlesOriginalTitlesWithoutChineseFieldAndInternationalSearchFallbacks() throws Exception {
        var source = JsonMapper.builder().build().readTree(Files.readString(Path.of("src/test/resources/metadata/sekai-titles.json")));
        var matches = AnimeTitleMatcher.rank(source, "全职法师 特别篇 神秘委托");
        assertTrue(AnimeTitleMatcher.confident(matches));
        assertEquals(449339L, matches.getFirst().subject().path("id").asLong());
        assertTrue(AnimeTitleMatcher.fallbackTerms("Example Chronicle: Lost Stars").contains("Example Chronicle"));
        assertTrue(AnimeTitleMatcher.fallbackTerms("架空アニメ：新たな旅").contains("架空アニメ"));
        assertTrue(AnimeTitleMatcher.fallbackTerms("某作品 第四季").contains("某作品 第四季"));
        assertTrue(AnimeTitleMatcher.rank(source, "我独自升级 第二季").stream()
                .noneMatch(m -> m.subject().path("name_cn").asText().contains("我叫MT")));
    }

    @Test
    void collectionSearchShowsMoviesWithoutInventingOneCombinedWork() throws Exception {
        var source = JsonMapper.builder().build().readTree(Files.readString(Path.of("src/test/resources/metadata/sekai-titles.json")));
        var matches = AnimeTitleMatcher.rank(source, "吹响！上低音号剧场版合集");
        assertFalse(AnimeTitleMatcher.confident(matches));
        assertEquals("剧场版", matches.getFirst().subject().path("platform").asText());
    }
}
