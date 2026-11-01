package com.ykd.claw.skill;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

@Component
public class FileSystemSkillLoader {
    private final Path skillsDirectory;

    public FileSystemSkillLoader(@Value("${skills.directory:skills}") String skillsDirectory) {
        this.skillsDirectory = Path.of(skillsDirectory).toAbsolutePath().normalize();
    }

    public Path skillsDirectory() {
        return skillsDirectory;
    }

    public Map<String, SkillDefinition> load() {
        if (!Files.isDirectory(skillsDirectory)) return Map.of();
        Map<String, SkillDefinition> result = new LinkedHashMap<>();
        try (Stream<Path> files = Files.walk(skillsDirectory, 2)) {
            files.filter(path -> path.getFileName().toString().equalsIgnoreCase("SKILL.md"))
                    .sorted()
                    .map(this::parse)
                    .forEach(skill -> result.put(skill.name().toLowerCase(), skill));
        } catch (IOException e) {
            throw new IllegalStateException("Unable to scan skills directory: " + skillsDirectory, e);
        }
        return Map.copyOf(result);
    }

    SkillDefinition parse(Path path) {
        try {
            String raw = Files.readString(path, StandardCharsets.UTF_8);
            Map<String, String> metadata = frontMatter(raw);
            String name = required(metadata, "name", path);
            String description = required(metadata, "description", path);
            return new SkillDefinition(name, description, csv(metadata.get("keywords")),
                    section(raw, "Available tools"), section(raw, "Execution rules"),
                    section(raw, "Required user information"), raw, path.toAbsolutePath().normalize());
        } catch (IOException e) {
            throw new IllegalStateException("Unable to read skill: " + path, e);
        }
    }

    private static Map<String, String> frontMatter(String raw) {
        Map<String, String> values = new LinkedHashMap<>();
        String[] lines = raw.replace("\r\n", "\n").split("\n");
        if (lines.length == 0 || !lines[0].trim().equals("---")) return values;
        for (int i = 1; i < lines.length && !lines[i].trim().equals("---"); i++) {
            int separator = lines[i].indexOf(':');
            if (separator > 0) {
                values.put(lines[i].substring(0, separator).trim().toLowerCase(),
                        lines[i].substring(separator + 1).trim());
            }
        }
        return values;
    }

    private static List<String> section(String raw, String heading) {
        List<String> result = new ArrayList<>();
        boolean active = false;
        for (String line : raw.replace("\r\n", "\n").split("\n")) {
            if (line.startsWith("## ")) {
                active = line.substring(3).trim().equalsIgnoreCase(heading);
            } else if (active && line.trim().startsWith("- ")) {
                result.add(line.trim().substring(2).trim());
            }
        }
        return List.copyOf(result);
    }

    private static List<String> csv(String value) {
        if (value == null || value.isBlank()) return List.of();
        return Stream.of(value.split(",")).map(String::trim).filter(item -> !item.isBlank()).toList();
    }

    private static String required(Map<String, String> metadata, String key, Path path) {
        String value = metadata.get(key);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(path + " is missing front-matter field: " + key);
        }
        return value;
    }
}
