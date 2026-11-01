package com.ykd.claw.skill;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SkillManagerTest {
    @TempDir Path directory;

    @Test
    void discoversNewSkillWithoutJavaChangesAndReloadsModifiedFile() throws Exception {
        SkillManager manager = new SkillManager(new FileSystemSkillLoader(directory.toString()));
        manager.reload();
        assertTrue(manager.findAll().isEmpty());

        Path skillDirectory = Files.createDirectories(directory.resolve("custom"));
        Path file = skillDirectory.resolve("SKILL.md");
        Files.writeString(file, skill("custom", "处理合同文档", "合同,contract"));
        manager.reloadChangedFiles();

        assertEquals("custom", manager.match("帮我检查这份合同").orElseThrow().name());
        Files.writeString(file, skill("custom", "处理发票文档", "发票,invoice"));
        // SkillManager 以毫秒精度比较文件时间戳决定是否热重载;连续两次写入可能落在同一毫秒,
        // 导致重载被漏掉而读到旧描述。显式拨快 mtime 保证本次重载必然触发。
        Files.setLastModifiedTime(file, FileTime.fromMillis(System.currentTimeMillis() + 1000));
        manager.reloadChangedFiles();
        assertEquals("处理发票文档", manager.findByName("custom").orElseThrow().description());
    }

    @Test
    void matchesNaturalTravelExpressionsFromSkillKeywords() throws Exception {
        Path skillDirectory = Files.createDirectories(directory.resolve("travel"));
        Files.writeString(skillDirectory.resolve("SKILL.md"),
                skill("travel", "规划旅行", "旅游,周末去,周日去,明天去,想去,带孩子去"));
        SkillManager manager = new SkillManager(new FileSystemSkillLoader(directory.toString()));
        manager.reload();

        assertEquals("travel", manager.match("我周日去杭州西湖").orElseThrow().name());
        assertEquals("travel", manager.match("周末去苏州玩两天").orElseThrow().name());
        assertEquals("travel", manager.match("想去北京看看").orElseThrow().name());
    }

    @Test
    void travelFollowUpDoesNotGetCapturedByStudyPlanKeyword() throws Exception {
        Path travel = Files.createDirectories(directory.resolve("travel"));
        Files.writeString(travel.resolve("SKILL.md"),
                skill("travel", "规划旅行", "旅游,酒店,计划去,计划玩,玩三天"));
        Path study = Files.createDirectories(directory.resolve("study"));
        Files.writeString(study.resolve("SKILL.md"),
                skill("study", "制定学习计划", "学习,学习计划,复习计划,考试"));
        SkillManager manager = new SkillManager(new FileSystemSkillLoader(directory.toString()));
        manager.reload();

        assertEquals("travel", manager.match("从南京出发，计划玩三天").orElseThrow().name());
        assertEquals("travel", manager.match("帮我查杭州酒店").orElseThrow().name());
        assertEquals("study", manager.match("帮我制定学习计划").orElseThrow().name());
    }

    @Test
    void prefersTheMoreSpecificKeywordInAMixedRequest() throws Exception {
        Path travel = Files.createDirectories(directory.resolve("travel"));
        Files.writeString(travel.resolve("SKILL.md"),
                skill("travel", "规划旅行", "旅行,旅游,行程"));
        Path study = Files.createDirectories(directory.resolve("study"));
        Files.writeString(study.resolve("SKILL.md"),
                skill("study", "制定学习计划", "学习,学习计划,英语学习计划"));
        SkillManager manager = new SkillManager(new FileSystemSkillLoader(directory.toString()));
        manager.reload();

        assertEquals("study", manager.match("帮我制定旅行英语学习计划").orElseThrow().name());
    }

    private static String skill(String name, String description, String keywords) {
        return """
                ---
                name: %s
                description: %s
                keywords: %s
                ---

                ## Available tools
                - read_document
                ## Execution rules
                - 不虚构内容
                ## Required user information
                - 文档
                """.formatted(name, description, keywords);
    }
}
