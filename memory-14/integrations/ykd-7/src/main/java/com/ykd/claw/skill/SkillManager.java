package com.ykd.claw.skill;

import jakarta.annotation.PostConstruct;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.FileSystems;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.PathMatcher;
import java.util.Collection;
import java.util.Comparator;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class SkillManager implements SkillRegistry {
    private static final Logger LOGGER = LoggerFactory.getLogger(SkillManager.class.getName());
    private final FileSystemSkillLoader loader;
    private final AtomicReference<Map<String, SkillDefinition>> skills = new AtomicReference<>(Map.of());
    private volatile long lastReloadTimestamp = 0;

    public SkillManager(FileSystemSkillLoader loader) {
        this.loader = loader;
    }

    @PostConstruct
    @Override
    public void reload() {
        skills.set(loader.load());
        lastReloadTimestamp = latestSkillTimestamp();
    }

    @Scheduled(fixedDelayString = "${skills.reload-interval-ms:3000}")
    public void reloadChangedFiles() {
        long currentLatest = latestSkillTimestamp();
        if (currentLatest > lastReloadTimestamp) {
            LOGGER.info("Skill files changed, reloading...");
            reload();
        }
    }

    private long latestSkillTimestamp() {
        try {
            PathMatcher matcher = FileSystems.getDefault().getPathMatcher("glob:**.md");
            Path skillsDir = loader.skillsDirectory();
            if (!Files.isDirectory(skillsDir)) return 0;
            try (var stream = Files.walk(skillsDir, 3)) {
                return stream
                        .filter(Files::isRegularFile)
                        .filter(p -> matcher.matches(p.getFileName()))
                        .mapToLong(p -> {
                            try { return Files.getLastModifiedTime(p).toMillis(); }
                            catch (IOException e) { return 0; }
                        })
                        .max()
                        .orElse(0);
            }
        } catch (IOException e) {
            LOGGER.debug( "Failed to check skill file timestamps", e);
            return lastReloadTimestamp + 1; // force reload on error
        }
    }

    @Override
    public Collection<SkillDefinition> findAll() {
        return skills.get().values();
    }

    @Override
    public Optional<SkillDefinition> findByName(String name) {
        if (name == null) return Optional.empty();
        return Optional.ofNullable(skills.get().get(name.toLowerCase(Locale.ROOT)));
    }

    @Override
    public Optional<SkillDefinition> match(String userMessage) {
        if (userMessage == null || userMessage.isBlank()) return Optional.empty();
        String normalized = userMessage.toLowerCase(Locale.ROOT);
        return findAll().stream()
                .map(skill -> Map.entry(skill, score(skill, normalized)))
                .filter(entry -> entry.getValue() > 0)
                .max(Comparator.<Map.Entry<SkillDefinition, Integer>>comparingInt(Map.Entry::getValue)
                        .thenComparing(entry -> entry.getKey().name(), Comparator.reverseOrder()))
                .map(Map.Entry::getKey);
    }

    private static int score(SkillDefinition skill, String message) {
        int score = message.contains(skill.name().toLowerCase(Locale.ROOT)) ? 60 : 0;
        for (String keyword : skill.keywords()) {
            String normalizedKeyword = keyword.toLowerCase(Locale.ROOT).trim();
            if (!normalizedKeyword.isBlank() && message.contains(normalizedKeyword)) {
                score += 20 + Math.min(normalizedKeyword.length(), 12) * 5;
            }
        }
        for (String word : skill.description().toLowerCase(Locale.ROOT).split("[\\s、，。,.；;：:]+")) {
            if (word.length() >= 2 && message.contains(word)) score++;
        }
        return score;
    }
}
