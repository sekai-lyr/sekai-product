package com.sekai.song.control;

import com.sekai.song.model.Song;
import com.sekai.song.model.User;
import com.sekai.song.service.CloudLyricService;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import java.util.List;
import java.util.Map;

@Controller
public class LocalPlayerControl {
    @Resource private CloudLyricService cloudLyricService;

    @GetMapping("/local-player")
    public String localPlayer(HttpSession session, Model model) {
        User user = session.getAttribute("loginUser") instanceof User loggedIn ? loggedIn : new User();
        if (user.getNickName() == null) user.setNickName("本地播放器");
        model.addAttribute("loginUser", user);
        return "local-player";
    }

    @GetMapping("/local-stage")
    public String localStage(@RequestParam(defaultValue = "disc") String mode, Model model) {
        String stageMode = com.sekai.song.model.StageModes.normalize(mode);
        Song song = new Song();
        song.setId(0L); song.setTitle("本地音乐"); song.setArtist(""); song.setAlbumName(""); song.setAnimeTitle("");
        song.setCoverUrl("/images/login-music-room.png"); song.setFavorite(false);
        User user = new User(); user.setNickName("本地播放器");
        model.addAttribute("song", song); model.addAttribute("loginUser", user);
        model.addAttribute("queue", List.of()); model.addAttribute("lyricLines", List.of());
        model.addAttribute("playableAudio", true); model.addAttribute("isBilibiliVideo", false);
        model.addAttribute("playableLocalVideo", false); model.addAttribute("startAutoplay", false);
        model.addAttribute("stageMode", stageMode); model.addAttribute("lyricMode", !"disc".equals(stageMode));
        model.addAttribute("browserLocal", true);
        return "player";
    }

    @GetMapping("/local-player/lyrics")
    public ResponseEntity<?> lyrics(@RequestParam String title, @RequestParam(defaultValue = "") String artist,
                                    HttpSession session) {
        if (!(session.getAttribute("loginUser") instanceof User)) {
            return ResponseEntity.status(401).body(Map.of("message", "请先登录后匹配云端歌词；本地播放不需要登录。"));
        }
        if (title.isBlank() || title.length() > 160 || artist.length() > 160) {
            return ResponseEntity.badRequest().body(Map.of("message", "歌曲名称或歌手信息不合法。"));
        }
        String lyric = cloudLyricService.fetchBestLyric(title, artist);
        return ResponseEntity.ok(Map.of("lyrics", lyric == null ? "" : lyric));
    }
}
