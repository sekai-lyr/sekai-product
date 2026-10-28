package com.sekai.song.control;

import com.sekai.song.model.Song;
import com.sekai.song.model.User;
import com.sekai.song.service.CommonsAssetService;
import com.sekai.song.service.SongService;
import com.sekai.song.util.UploadPathUtil;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Controller;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;
import java.net.URI;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Controller
public class SongAssetControl {
    @Resource private SongService songs;
    @Resource private CommonsAssetService commons;

    @GetMapping("/songs/{id}/edit")
    public String edit(@PathVariable Long id, HttpSession session, Model model) {
        User user = user(session);
        if (user == null) return "redirect:/login";
        Song song = songs.getByIdAndUserId(id, user.getId());
        if (song == null) return "redirect:/songs";
        model.addAttribute("loginUser", user);
        model.addAttribute("song", song);
        return "song-edit";
    }

    @GetMapping("/songs/{id}/assets")
    public String assets(@PathVariable Long id, HttpSession session, Model model) {
        User user = user(session);
        if (user == null) return "redirect:/login";
        Song song = songs.getByIdAndUserId(id, user.getId());
        if (song == null) return "redirect:/songs";
        model.addAttribute("loginUser", user);
        model.addAttribute("song", song);
        model.addAttribute("hasTitle", song.getTitle() != null && !song.getTitle().isBlank());
        model.addAttribute("hasCover", song.getCoverUrl() != null && !song.getCoverUrl().isBlank());
        model.addAttribute("sourceUrl", sourceUrl(song.getAudioUrl()));
        if (session.getAttribute("assetCsrf") == null) session.setAttribute("assetCsrf", UUID.randomUUID().toString());
        model.addAttribute("assetCsrf", session.getAttribute("assetCsrf"));
        model.addAttribute("hasFlac", stored(song.getLocalAudioUrl(), "audio", ".flac"));
        model.addAttribute("hasMp4", stored(song.getLocalVideoUrl(), "video", ".mp4"));
        model.addAttribute("hasPng", stored(song.getCoverUrl(), "covers", ".png"));
        model.addAttribute("hasLrc", song.getLyricText() != null && song.getLyricText().matches("(?s).*\\[\\d{1,3}:\\d{2}[^]]*].*"));
        try {
            model.addAttribute("candidates", commons.find(song.getTitle(), song.getArtist(), song.getAlbumName()));
        } catch (IOException e) {
            model.addAttribute("candidates", List.of());
            model.addAttribute("sourceError", "开放素材库暂时无法查询，请稍后重试");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            model.addAttribute("candidates", List.of());
            model.addAttribute("sourceError", "开放素材库查询已中断");
        }
        return "song-assets";
    }

    @PostMapping("/songs/{id}/assets/lyrics")
    public String saveLyrics(@PathVariable Long id, @RequestParam String lyricText, @RequestParam String token,
                             HttpSession session, RedirectAttributes notices) {
        User user = user(session);
        if (user == null) return "redirect:/login";
        Song song = songs.getByIdAndUserId(id, user.getId());
        if (song == null) return "redirect:/songs";
        if (!token.equals(session.getAttribute("assetCsrf"))) {
            notices.addFlashAttribute("error", "页面已失效，请刷新后重试");
        } else if (lyricText.length() > 100_000 || !lyricText.matches("(?s).*\\[\\d{1,3}:\\d{2}[^]]*].*")) {
            notices.addFlashAttribute("error", "请提供带时间戳且不超过 10 万字符的 LRC 歌词");
        } else if (songs.updateLyricMetadata(id, user.getId(), lyricText)) {
            notices.addFlashAttribute("message", "LRC 歌词已关联到歌曲");
        } else {
            notices.addFlashAttribute("error", "LRC 歌词关联失败");
        }
        return "redirect:/songs/" + id + "/assets";
    }

    @GetMapping("/songs/{id}/assets/lyrics.lrc")
    public ResponseEntity<byte[]> lyrics(@PathVariable Long id, HttpSession session) {
        User user = user(session);
        if (user == null) return ResponseEntity.status(401).build();
        Song song = songs.getByIdAndUserId(id, user.getId());
        if (song == null || song.getLyricText() == null || song.getLyricText().isBlank()) return ResponseEntity.notFound().build();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=lyrics-" + id + ".lrc")
                .contentType(MediaType.parseMediaType("text/plain;charset=UTF-8"))
                .body(song.getLyricText().getBytes(StandardCharsets.UTF_8));
    }

    @PostMapping("/songs/{id}/assets/attach")
    public String attach(@PathVariable Long id, @RequestParam String title, @RequestParam String type,
                         @RequestParam String token,
                         HttpSession session, RedirectAttributes notices) {
        User user = user(session);
        if (user == null) return "redirect:/login";
        Song song = songs.getByIdAndUserId(id, user.getId());
        if (song == null) return "redirect:/songs";
        if (!token.equals(session.getAttribute("assetCsrf")) || !List.of("flac", "mp4", "png").contains(type)
                || !(CommonsAssetService.matchesSong(title, song.getTitle(), song.getArtist())
                    || "png".equals(type) && CommonsAssetService.matchesSong(title, song.getAlbumName(), song.getArtist()))) {
            notices.addFlashAttribute("error", "素材类型不受支持");
            return "redirect:/songs/" + id + "/assets";
        }
        try {
            Path directory = UploadPathUtil.uploadRoot().resolve(type.equals("flac") ? "audio" : type.equals("mp4") ? "video" : "covers");
            Files.createDirectories(directory);
            String fileName = "commons-" + user.getId() + "-" + id + "-" + UUID.randomUUID() + "." + type;
            Path target = directory.resolve(fileName);
            commons.download(title, type, target);
            String url = "/uploads/" + directory.getFileName() + "/" + fileName;
            boolean saved = switch (type) {
                case "flac" -> songs.updateLocalAudioUrl(id, user.getId(), url);
                case "mp4" -> songs.updateLocalVideoUrl(id, user.getId(), url);
                case "png" -> songs.updateCoverUrl(id, user.getId(), url);
                default -> false;
            };
            if (!saved) {
                Files.deleteIfExists(target);
                throw new IOException("关联失败");
            }
            notices.addFlashAttribute("message", type.toUpperCase(Locale.ROOT) + " 已保存并关联到歌曲");
        } catch (IOException e) {
            notices.addFlashAttribute("error", e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            notices.addFlashAttribute("error", "素材下载已中断");
        }
        return "redirect:/songs/" + id + "/assets";
    }

    private static User user(HttpSession session) {
        return session.getAttribute("loginUser") instanceof User user && user.getId() != null ? user : null;
    }

    private static boolean stored(String url, String folder, String extension) {
        if (url == null || !url.toLowerCase(Locale.ROOT).endsWith(extension)) return false;
        return url.startsWith("/uploads/" + folder + "/") || url.startsWith("/external-uploads/" + folder + "/");
    }

    private static String sourceUrl(String value) {
        try {
            URI uri = URI.create(value);
            String host = uri.getHost();
            if (!"https".equals(uri.getScheme()) || host == null) return null;
            if (List.of("music.163.com", "y.qq.com", "www.bilibili.com", "bilibili.com").contains(host)) return value;
        } catch (RuntimeException ignored) {
            return null;
        }
        return null;
    }
}
