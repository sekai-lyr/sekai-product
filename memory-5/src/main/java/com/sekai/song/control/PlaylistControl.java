package com.sekai.song.control;

import com.sekai.song.model.Playlist;
import com.sekai.song.model.User;
import com.sekai.song.service.PlaylistService;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Controller
public class PlaylistControl {
    private final PlaylistService playlistService;

    public PlaylistControl(PlaylistService playlistService) {
        this.playlistService = playlistService;
    }

    @PostMapping("/playlists/add")
    public String addPlaylist(Playlist playlist, HttpSession session, RedirectAttributes redirectAttributes) {
        User user = requireUser(session);
        if (user == null) {
            return "redirect:/login";
        }
        playlist.setUserId(user.getId());
        boolean success = playlistService.add(playlist);
        redirectAttributes.addFlashAttribute(success ? "message" : "error",
                success ? "专属歌单创建完成" : "歌单名称不能为空");
        return "redirect:/playlists";
    }

    @PostMapping("/playlists/update/{id}")
    public String updatePlaylist(@PathVariable Long id,
                                 Playlist playlist,
                                 HttpSession session,
                                 RedirectAttributes redirectAttributes) {
        User user = requireUser(session);
        if (user == null) {
            return "redirect:/login";
        }
        playlist.setId(id);
        boolean success = playlistService.update(playlist, user.getId());
        redirectAttributes.addFlashAttribute(success ? "message" : "error",
                success ? "歌单信息已更新" : "歌单更新失败，请检查歌单名称");
        return success ? "redirect:/playlists/" + id : "redirect:/playlists/" + id + "/edit";
    }

    @PostMapping("/playlists/delete/{id}")
    public String deletePlaylist(@PathVariable Long id, HttpSession session) {
        User user = requireUser(session);
        if (user == null) {
            return "redirect:/login";
        }
        playlistService.delete(id, user.getId());
        return "redirect:/playlists";
    }

    @PostMapping("/playlists/{playlistId}/songs/add")
    public String addSongToPlaylist(@PathVariable Long playlistId,
                                    @RequestParam("songId") Long songId,
                                    HttpSession session) {
        User user = requireUser(session);
        if (user == null) {
            return "redirect:/login";
        }
        playlistService.addSong(playlistId, songId, user.getId());
        return "redirect:/playlists/" + playlistId;
    }

    @PostMapping("/playlists/{playlistId}/songs/remove/{songId}")
    public String removeSongFromPlaylist(@PathVariable Long playlistId,
                                         @PathVariable Long songId,
                                         HttpSession session) {
        User user = requireUser(session);
        if (user == null) {
            return "redirect:/login";
        }
        playlistService.removeSong(playlistId, songId, user.getId());
        return "redirect:/playlists/" + playlistId;
    }

    private User requireUser(HttpSession session) {
        Object loginUser = session.getAttribute("loginUser");
        return loginUser instanceof User user ? user : null;
    }
}
