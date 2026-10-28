package com.sekai.song.control;

import com.sekai.song.model.User;
import com.sekai.song.model.Playlist;
import com.sekai.song.service.LocalLibraryService;
import com.sekai.song.service.PlaylistService;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/local-player/library")
public class LocalLibraryControl {
    @Resource private LocalLibraryService library;
    @Resource private PlaylistService playlists;
    public record PlaylistName(@NotBlank @Size(max=120) String name) {}
    public record LyricsText(@Size(max=50000) String lyrics) {}

    @PostMapping("/playlists")
    public Map<String,Long> createPlaylist(@RequestBody @Valid PlaylistName input,HttpSession session,
            @RequestHeader(value="X-Local-Library-CSRF",required=false) String token){
        User user=mutation(session,token);Playlist playlist=new Playlist();
        playlist.setUserId(user.getId());playlist.setName(input.name());
        if(!playlists.add(playlist))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"歌单创建失败");
        return Map.of("id",playlist.getId());
    }
    @PostMapping("/playlists/{playlistId}/songs/{songId}")
    public Map<String,Boolean> addToPlaylist(@PathVariable Long playlistId,@PathVariable Long songId,HttpSession session,
            @RequestHeader(value="X-Local-Library-CSRF",required=false) String token){
        User user=mutation(session,token);
        if(playlists.getByIdAndUserId(playlistId,user.getId())==null)throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        if(!playlists.addSong(playlistId,songId,user.getId()) && playlists.listSongs(playlistId,user.getId()).stream().noneMatch(song->songId.equals(song.getId())))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        return Map.of("saved",true);
    }
    @PostMapping("/songs/{id}/lyrics")
    public Map<String,Boolean> lyrics(@PathVariable Long id,@RequestBody @Valid LyricsText input,HttpSession session,
            @RequestHeader(value="X-Local-Library-CSRF",required=false) String token){
        User user=mutation(session,token);library.lyrics(id,user.getId(),input.lyrics());return Map.of("saved",true);
    }

    @GetMapping
    public Map<String,Object> list(HttpSession session){
        User user=user(session);
        if(session.getAttribute("localLibraryCsrf")==null)session.setAttribute("localLibraryCsrf",UUID.randomUUID().toString());
        var lists=playlists.listByUserId(user.getId()).stream().map(p -> Map.of("id",p.getId(),"name",p.getName(),
                "songIds",playlists.listSongs(p.getId(),user.getId()).stream().map(s -> s.getId()).toList())).toList();
        return Map.of("user",Map.of("id",user.getId(),"name",user.getUserName()),"songs",library.list(user.getId()),
                "playlists",lists,"csrf",session.getAttribute("localLibraryCsrf"));
    }
    @PostMapping("/songs")
    public Map<String,Long> add(@RequestBody @Valid LocalLibraryService.NewSong input,HttpSession session,
                               @RequestHeader(value="X-Local-Library-CSRF",required=false) String token){
        User user=mutation(session,token);return Map.of("id",library.add(user.getId(),input));
    }
    @PostMapping("/songs/{id}/binding")
    public Map<String,Boolean> bind(@PathVariable Long id,@RequestBody @Valid LocalLibraryService.FileReference input,HttpSession session,
                                   @RequestHeader(value="X-Local-Library-CSRF",required=false) String token){
        User user=mutation(session,token);library.bind(id,user.getId(),input);return Map.of("saved",true);
    }
    @PostMapping("/songs/{id}/preferences")
    public Map<String,Boolean> preferences(@PathVariable Long id,@RequestBody @Valid LocalLibraryService.Preferences input,HttpSession session,
                                          @RequestHeader(value="X-Local-Library-CSRF",required=false) String token){
        User user=mutation(session,token);library.preferences(id,user.getId(),input);return Map.of("saved",true);
    }
    @PostMapping("/songs/{id}/favorite")
    public Map<String,Boolean> favorite(@PathVariable Long id,HttpSession session,@RequestHeader(value="X-Local-Library-CSRF",required=false) String token){
        User user=mutation(session,token);library.favorite(id,user.getId());return Map.of("saved",true);
    }
    @DeleteMapping("/songs/{id}")
    public Map<String,Boolean> delete(@PathVariable Long id,HttpSession session,@RequestHeader(value="X-Local-Library-CSRF",required=false) String token){
        User user=mutation(session,token);library.delete(id,user.getId());return Map.of("deleted",true);
    }
    private User user(HttpSession session){
        if(session.getAttribute("loginUser") instanceof User user && user.getId()!=null)return user;
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"请先登录账户");
    }
    private User mutation(HttpSession session,String token){
        User user=user(session);
        if(token==null || !token.equals(session.getAttribute("localLibraryCsrf")))throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        return user;
    }
}
