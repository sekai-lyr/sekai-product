package com.sekai.song.control;

import com.sekai.song.model.Playlist;
import com.sekai.song.model.Song;
import com.sekai.song.model.User;
import com.sekai.song.service.PlaylistService;
import com.sekai.song.service.SongService;
import com.sekai.song.util.NeteaseMusicLinkUtil;
import com.sekai.song.util.QqMusicLinkUtil;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;

@Controller
public class PageControl {

    @Resource
    private SongService songService;

    @Resource
    private PlaylistService playlistService;

    @Resource
    private com.sekai.song.service.LibraryQueryService libraryQueries;

    @GetMapping({"/", "/login"})
    public String login() {
        return "login";
    }

    @GetMapping("/register")
    public String register() {
        return "register";
    }

    @GetMapping("/user/register")
    public String registerFallback() {
        return "redirect:/register";
    }

    @GetMapping("/user/login")
    public String loginFallback() {
        return "redirect:/login";
    }

    @GetMapping("/home")
    public String home(HttpSession session, Model model) {
        User user = requireUser(session);
        if (user == null) {
            return "redirect:/login";
        }
        model.addAttribute("loginUser", user);
        model.addAttribute("stats", libraryQueries.stats(user.getId()));
        model.addAttribute("recentSongs", libraryQueries.recent(user.getId()));
        model.addAttribute("favoriteSongs", libraryQueries.favorites(user.getId()));
        model.addAttribute("playlists", libraryQueries.playlists(user.getId()));
        return "home";
    }

    @GetMapping("/songs")
    public String songs(HttpSession session,
                        Model model,
                        @RequestParam(value = "keyword", required = false) String keyword,
                        @RequestParam(value = "page", defaultValue = "1") int page,
                        @RequestParam(value = "view", defaultValue = "cover") String view) {
        User user = requireUser(session);
        if (user == null) {
            return "redirect:/login";
        }
        int pageSize = 30;
        int total = songService.countLibraryByUserId(user.getId(), keyword);
        int totalPages = Math.max((int) Math.ceil(total / (double) pageSize), 1);
        int currentPage = Math.min(Math.max(page, 1), totalPages);
        model.addAttribute("loginUser", user);
        model.addAttribute("songs", songService.listLibraryByUserId(user.getId(), keyword, currentPage, pageSize));
        model.addAttribute("playlists", playlistService.listByUserId(user.getId()));
        model.addAttribute("libraryView", "list".equals(view) ? "list" : "cover");
        model.addAttribute("keyword", keyword == null ? "" : keyword);
        model.addAttribute("currentPage", currentPage);
        model.addAttribute("totalPages", totalPages);
        model.addAttribute("totalCount", total);
        return "songs";
    }

    @GetMapping("/playlists")
    public String playlists(HttpSession session, Model model) {
        User user = requireUser(session);
        if (user == null) {
            return "redirect:/login";
        }
        model.addAttribute("loginUser", user);
        model.addAttribute("playlists", playlistService.listByUserId(user.getId()));
        model.addAttribute("songs", songService.listLibraryByUserId(user.getId()));
        return "playlists";
    }

    @GetMapping("/playlists/{id}")
    public String playlistDetail(@PathVariable Long id,
                                 @RequestParam(value = "page", defaultValue = "1") int page,
                                 HttpSession session,
                                 Model model) {
        User user = requireUser(session);
        if (user == null) {
            return "redirect:/login";
        }
        Playlist playlist = playlistService.getByIdAndUserId(id, user.getId());
        if (playlist == null) {
            return "redirect:/playlists";
        }
        int pageSize = 30;
        int total = libraryQueries.playlistCount(id, user.getId());
        int totalPages = Math.max((int) Math.ceil(total / (double) pageSize), 1);
        int currentPage = Math.min(Math.max(page, 1), totalPages);
        int pageOffset = Math.min((currentPage - 1) * pageSize, total);
        List<Song> playlistSongs = libraryQueries.playlistSongs(id, user.getId(), pageOffset, pageSize);
        model.addAttribute("loginUser", user);
        model.addAttribute("playlist", playlist);
        model.addAttribute("playlistSongs", playlistSongs);
        model.addAttribute("playlistSongTotal", total);
        model.addAttribute("currentPage", currentPage);
        model.addAttribute("totalPages", totalPages);
        model.addAttribute("pageOffset", pageOffset);
        return "playlist-detail";
    }

    @GetMapping("/playlists/{id}/edit")
    public String playlistEdit(@PathVariable Long id, HttpSession session, Model model) {
        User user = requireUser(session);
        if (user == null) {
            return "redirect:/login";
        }
        Playlist playlist = playlistService.getByIdAndUserId(id, user.getId());
        if (playlist == null) {
            return "redirect:/playlists";
        }
        model.addAttribute("loginUser", user);
        model.addAttribute("playlist", playlist);
        return "playlist-edit";
    }

    @GetMapping("/playlists/{id}/play")
    public String playPlaylist(@PathVariable Long id, HttpSession session) {
        User user = requireUser(session);
        if (user == null) {
            return "redirect:/login";
        }
        Playlist playlist = playlistService.getByIdAndUserId(id, user.getId());
        if (playlist == null) {
            return "redirect:/playlists";
        }
        List<Song> playlistSongs = playlistService.listSongs(id, user.getId());
        if (playlistSongs.isEmpty()) {
            return "redirect:/playlists/" + id;
        }
        return "redirect:/player/" + playlistSongs.get(0).getId() + "?playlistId=" + id + "&autoplay=1";
    }

    @GetMapping("/player/{id}")
    public String player(@PathVariable Long id,
                         @RequestParam(value = "playlistId", required = false) Long playlistId,
                         @RequestParam(value = "autoplay", required = false) String autoplay,
                         @RequestParam(value = "mode", defaultValue = "disc") String mode,
                         HttpSession session,
                         Model model) {
        User user = requireUser(session);
        if (user == null) {
            return "redirect:/login";
        }
        Song song = songService.getByIdAndUserId(id, user.getId());
        if (song == null) {
            return "redirect:/songs";
        }
        String stageMode = com.sekai.song.model.StageModes.normalize(mode);
        model.addAttribute("loginUser", user);
        model.addAttribute("playbackPage", true);
        model.addAttribute("requestedSongId", id);
        model.addAttribute("stageMode", stageMode);
        model.addAttribute("startAutoplay", "1".equals(autoplay));
        if (playlistId != null && playlistService.getByIdAndUserId(playlistId, user.getId()) != null) {
            model.addAttribute("requestedPlaylistId", playlistId);
        }
        return "local-player";
    }

    @GetMapping("/favorites")
    public String favorites(HttpSession session, Model model) {
        User user = requireUser(session);
        if (user == null) {
            return "redirect:/login";
        }
        model.addAttribute("loginUser", user);
        model.addAttribute("songs", songService.listFavoritesByUserId(user.getId()));
        return "favorites";
    }

    @GetMapping("/search")
    public String search(HttpSession session, Model model,
                         @RequestParam(value = "q", required = false) String q,
                         @RequestParam(value = "type", defaultValue = "all") String type,
                         @RequestParam(value = "page", defaultValue = "1") int page) {
        User user = requireUser(session);
        if (user == null) {
            return "redirect:/login";
        }
        String query = q == null ? "" : q.strip();
        String filter = "song".equals(type) || "playlist".equals(type) ? type : "all";
        boolean tooLong = query.length() > 160;
        boolean searched = !query.isBlank() && !tooLong;
        int songCount = searched ? libraryQueries.searchCount(user.getId(), query, "song") : 0;
        int playlistCount = searched ? libraryQueries.searchCount(user.getId(), query, "playlist") : 0;
        int total = "all".equals(filter) ? songCount + playlistCount : "song".equals(filter) ? songCount : playlistCount;
        int totalPages = Math.max(1, (total + 19) / 20);
        int currentPage = Math.min(Math.max(page, 1), totalPages);
        int offset = (currentPage - 1) * 20;
        model.addAttribute("loginUser", user);
        model.addAttribute("q", query);
        model.addAttribute("type", filter);
        model.addAttribute("searchError", tooLong ? "关键词最多 160 个字符，请缩短后再搜索。" : "");
        model.addAttribute("searched", !query.isBlank() && !tooLong);
        model.addAttribute("allCount", songCount + playlistCount);
        model.addAttribute("songCount", songCount);
        model.addAttribute("playlistCount", playlistCount);
        model.addAttribute("totalCount", total);
        model.addAttribute("currentPage", currentPage);
        model.addAttribute("totalPages", totalPages);
        model.addAttribute("results", searched ? libraryQueries.search(user.getId(), query, filter, offset, 20) : List.of());
        return "search";
    }

    @GetMapping("/netease")
    public String netease(HttpSession session,
                          Model model,
                          @RequestParam(value = "link", required = false) String link) {
        User user = requireUser(session);
        if (user == null) {
            return "redirect:/login";
        }
        model.addAttribute("loginUser", user);
        model.addAttribute("link", link == null ? "" : link);
        if (!model.containsAttribute("songIds")) {
            model.addAttribute("songIds", "");
        }
        model.addAttribute("playlists", playlistService.listByUserId(user.getId()));
        model.addAttribute("neteaseLink", NeteaseMusicLinkUtil.parse(link));
        return "netease";
    }

    @GetMapping("/qq")
    public String qq(HttpSession session,
                     Model model,
                     @RequestParam(value = "link", required = false) String link) {
        User user = requireUser(session);
        if (user == null) {
            return "redirect:/login";
        }
        model.addAttribute("loginUser", user);
        model.addAttribute("link", link == null ? "" : link);
        if (!model.containsAttribute("songIds")) {
            model.addAttribute("songIds", "");
        }
        model.addAttribute("playlists", playlistService.listByUserId(user.getId()));
        model.addAttribute("qqLink", QqMusicLinkUtil.parse(link));
        return "qq";
    }

    @GetMapping("/logout")
    public String logout(HttpSession session) {
        session.invalidate();
        return "redirect:/login";
    }

    private User requireUser(HttpSession session) {
        Object loginUser = session.getAttribute("loginUser");
        if (loginUser instanceof User user) {
            return user;
        }
        return null;
    }

}
