package com.sekai.sekai_form.control;

import com.sekai.sekai_form.model.Result;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@RestController
@RequestMapping("/api/model")
public class SekaiFormModelControl {
    private static final Path MODEL_BASE;
    static {
        Path cwd = Paths.get("").toAbsolutePath();
        Path candidate = cwd.resolve("models");
        if (!Files.isDirectory(candidate)) candidate = cwd.resolve("SekaiForm").resolve("models");
        MODEL_BASE = candidate.normalize();
    }

    @GetMapping("/list") public Result<List<String>> listModels() {
        try {
            List<String> names = new ArrayList<>();
            Path dir3d = MODEL_BASE.resolve("3d");
            if (Files.isDirectory(dir3d)) {
                try (var stream = Files.list(dir3d)) {
                    stream.filter(Files::isDirectory).map(p -> p.getFileName().toString()).forEach(names::add);
                }
            }
            return Result.ok(names);
        } catch (IOException e) { return Result.fail(e.getMessage()); }
    }

    @GetMapping("/2d/list") public Result<List<String>> list2DModels() {
        try {
            List<String> names = new ArrayList<>();
            Path dir2d = MODEL_BASE.resolve("2d");
            if (Files.isDirectory(dir2d)) {
                try (var stream = Files.list(dir2d)) {
                    stream.filter(Files::isDirectory).map(p -> p.getFileName().toString()).forEach(names::add);
                }
            }
            return Result.ok(names);
        } catch (IOException e) { return Result.fail(e.getMessage()); }
    }

    @PostMapping("/upload") public Result<Map<String, String>> upload(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) return Result.fail("????");
        try {
            String name = file.getOriginalFilename();
            if (name == null) return Result.fail("?????");
            Path targetDir;
            if (name.endsWith(".zip")) {
                String baseName = name.replace(".zip", "");
                targetDir = MODEL_BASE.resolve("2d").resolve(baseName);
                Files.createDirectories(targetDir);
                try (ZipInputStream zis = new ZipInputStream(file.getInputStream())) {
                    ZipEntry entry;
                    while ((entry = zis.getNextEntry()) != null) {
                        Path out = targetDir.resolve(entry.getName()).normalize();
                        if (!out.startsWith(targetDir)) continue;
                        if (entry.isDirectory()) { Files.createDirectories(out); continue; }
                        Files.createDirectories(out.getParent());
                        try (OutputStream os = Files.newOutputStream(out)) { zis.transferTo(os); }
                    }
                }
            } else {
                targetDir = MODEL_BASE.resolve("3d").resolve(name);
                Files.createDirectories(targetDir.getParent());
                try (InputStream is = file.getInputStream()) {
                    Files.copy(is, targetDir, StandardCopyOption.REPLACE_EXISTING);
                }
            }
            Map<String, String> result = new HashMap<>();
            result.put("fileName", targetDir.getFileName().toString());
            return Result.ok("????", result);
        } catch (IOException e) { return Result.fail("????: " + e.getMessage()); }
    }

    @DeleteMapping("/delete") public Result<Void> delete(@RequestParam String fileName, @RequestParam(defaultValue="3d") String type) {
        try {
            Path path = MODEL_BASE.resolve(type).resolve(fileName);
            if (Files.isDirectory(path)) {
                try (var s = Files.walk(path)) { s.sorted(Comparator.reverseOrder()).map(Path::toFile).forEach(File::delete); }
            } else { Files.deleteIfExists(path); }
            return Result.ok("????", null);
        } catch (IOException e) { return Result.fail(e.getMessage()); }
    }
}