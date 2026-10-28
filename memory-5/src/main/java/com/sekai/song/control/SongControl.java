package com.sekai.song.control;

import com.sekai.song.model.Song;
import com.sekai.song.model.User;
import com.sekai.song.service.SongService;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.WebDataBinder;
import org.springframework.web.bind.annotation.InitBinder;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Controller
public class SongControl {
    private final SongService songService;

    public SongControl(SongService songService) {
        this.songService = songService;
    }

    @InitBinder
    public void restrictMediaBinding(WebDataBinder binder) {
        binder.setDisallowedFields("localAudioUrl", "localVideoUrl");
    }

    @PostMapping("/songs/add")
    public String addSong(Song song, HttpSession session, RedirectAttributes redirectAttributes) {
        User user = requireUser(session);
        if (user == null) {
            return "redirect:/login";
        }
        song.setUserId(user.getId());
        boolean success = songService.add(song);
        redirectAttributes.addFlashAttribute(success ? "message" : "error",
                success ? "歌曲已经加入你的动漫歌单" : "歌曲名不能为空");
        return "redirect:/songs";
    }

    @PostMapping("/songs/update/{id}")
    public String updateSong(@PathVariable Long id, Song song, HttpSession session, RedirectAttributes redirectAttributes) {
        User user = requireUser(session);
        if (user == null) {
            return "redirect:/login";
        }
        song.setId(id);
        boolean success = songService.update(song, user.getId());
        redirectAttributes.addFlashAttribute(success ? "message" : "error",
                success ? "歌曲信息已更新" : "更新失败，请检查歌曲名");
        return "redirect:/songs";
    }

    @PostMapping("/songs/delete/{id}")
    public String deleteSong(@PathVariable Long id, HttpSession session) {
        User user = requireUser(session);
        if (user == null) {
            return "redirect:/login";
        }
        songService.delete(id, user.getId());
        return "redirect:/songs";
    }

    @PostMapping("/songs/favorite/{id}")
    public String favoriteSong(@PathVariable Long id,
                               HttpSession session,
                               @RequestParam(value = "returnTo", required = false) String returnTo) {
        User user = requireUser(session);
        if (user == null) {
            return "redirect:/login";
        }
        songService.toggleFavorite(id, user.getId());
        return redirectTo(returnTo, "/songs");
    }

    private String redirectTo(String returnTo, String fallback) {
        if (returnTo != null && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
            return "redirect:" + returnTo;
        }
        return "redirect:" + fallback;
    }

    private User requireUser(HttpSession session) {
        Object loginUser = session.getAttribute("loginUser");
        return loginUser instanceof User user ? user : null;
    }
}
