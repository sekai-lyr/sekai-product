package com.sekai.song.control;

import com.sekai.song.model.MusicImportResult;
import com.sekai.song.model.User;
import com.sekai.song.service.MusicImportCoordinator;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Controller
public class MusicImportControl {
    private final MusicImportCoordinator importer;

    public MusicImportControl(MusicImportCoordinator importer) {
        this.importer = importer;
    }

    @PostMapping("/netease/import")
    public String importNeteaseSongs(@RequestParam(value = "songIds", required = false) String songIds,
                                     @RequestParam(value = "link", required = false) String link,
                                     @RequestParam(value = "playlistId", required = false) Long playlistId,
                                     HttpSession session,
                                     RedirectAttributes redirectAttributes) {
        return importSongs("netease", songIds, link, playlistId, session, redirectAttributes);
    }

    @PostMapping("/qq/import")
    public String importQqSongs(@RequestParam(value = "songIds", required = false) String songIds,
                                @RequestParam(value = "link", required = false) String link,
                                @RequestParam(value = "playlistId", required = false) Long playlistId,
                                HttpSession session,
                                RedirectAttributes redirectAttributes) {
        return importSongs("qq", songIds, link, playlistId, session, redirectAttributes);
    }

    private String importSongs(String source, String songIds, String link, Long playlistId,
                               HttpSession session, RedirectAttributes redirectAttributes) {
        Object loginUser = session.getAttribute("loginUser");
        User user = loginUser instanceof User currentUser ? currentUser : null;
        if (user == null || user.getId() == null) {
            return "redirect:/login";
        }
        String input = (songIds == null || songIds.isBlank()) && link != null ? link : songIds;
        MusicImportResult result = importer.importSongs(source, input, playlistId, user.getId());
        if (result.isSuccess()) {
            redirectAttributes.addFlashAttribute("message", result.getMessage());
            return "redirect:/playlists/" + result.getPlaylistId();
        }
        redirectAttributes.addFlashAttribute("error", result.getMessage());
        redirectAttributes.addFlashAttribute("songIds", input);
        return "redirect:/" + source;
    }
}
