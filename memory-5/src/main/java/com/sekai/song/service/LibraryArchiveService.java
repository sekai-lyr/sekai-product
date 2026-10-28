package com.sekai.song.service;

import com.sekai.song.model.Song;
import com.sekai.song.model.Playlist;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import jakarta.validation.Validator;
import jakarta.validation.constraints.*;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;

@Service
public class LibraryArchiveService {
    public record Track(@NotNull @Positive Long key, @NotBlank @Size(max=160) String title,
                        @Size(max=160) String artist, @Size(max=160) String album, @Size(max=160) String anime,
                        @Size(max=300) String tags, @Size(max=80) String mood, @Size(max=800) String cover,
                        @Size(max=50000) String lyrics, @Min(0) @Max(86400) Integer duration, boolean favorite,
                        @Valid LocalLibraryService.Preferences preferences) {}
    public record Collection(@NotBlank @Size(max=120) String name, @Size(max=500) String description,
                             @NotNull @Size(max=5000) List<@NotNull @Positive Long> tracks) {}
    public record Archive(@Min(1) @Max(1) int version, @NotNull @Size(max=5000) List<@NotNull @Valid Track> tracks,
                          @NotNull @Size(max=500) List<@NotNull @Valid Collection> playlists) {}
    public record Preview(int songs, int playlists, int conflicts, List<String> conflictTitles) {}
    public record Restored(int added, int matched, int playlists) {}
    private final JdbcTemplate jdbc;
    private final SongService songs;
    private final PlaylistService playlists;
    private final LocalLibraryService local;
    private final Validator validator;
    private final ObjectMapper json=new ObjectMapper();
    public LibraryArchiveService(JdbcTemplate jdbc,SongService songs,PlaylistService playlists,LocalLibraryService local,Validator validator) {
        this.jdbc=jdbc;this.songs=songs;this.playlists=playlists;this.local=local;this.validator=validator;
    }
    @Transactional(readOnly=true)
    public Archive export(Long userId) {
        int count=jdbc.queryForObject("SELECT COUNT(*) FROM sekai_song_track WHERE user_id=?",Integer.class,userId);
        if(count>5000)throw bad("单次备份最多 5000 首歌曲");
        List<Track> tracks=jdbc.query("SELECT t.*,b.preferences_json FROM sekai_song_track t LEFT JOIN sekai_song_local_binding b ON b.song_id=t.id AND b.user_id=t.user_id WHERE t.user_id=? ORDER BY t.id",(rs,n)-> {
            LocalLibraryService.Preferences preferences=null;
            String value=rs.getString("preferences_json");
            if(value!=null && !value.equals("{}")) {
                try { preferences=json.readValue(value,LocalLibraryService.Preferences.class); }
                catch(java.io.IOException e) { throw bad("歌曲偏好格式损坏，请先修复后备份"); }
                if(!validator.validate(preferences).isEmpty()) preferences=null;
            }
            return new Track(rs.getLong("id"),rs.getString("title"),rs.getString("artist"),rs.getString("album_name"),rs.getString("anime_title"),rs.getString("tags"),rs.getString("mood"),safeCover(rs.getString("cover_url")),rs.getString("lyric_text"),rs.getObject("duration_seconds",Integer.class),rs.getBoolean("favorite"),preferences);
        },userId);
        List<Collection> collections=playlists.listByUserId(userId).stream().map(p->new Collection(p.getName(),p.getDescription(),jdbc.queryForList("SELECT ps.song_id FROM sekai_song_playlist_song ps JOIN sekai_song_track t ON t.id=ps.song_id WHERE ps.playlist_id=? AND t.user_id=? ORDER BY ps.id",Long.class,p.getId(),userId))).toList();
        Archive archive=new Archive(1,tracks,collections);validate(archive);
        try {if(json.writeValueAsBytes(archive).length>8*1024*1024)throw bad("资料备份超过 8 MB，请先减少单次备份的资料量");}
        catch(java.io.IOException e){throw new IllegalStateException(e);}
        return archive;
    }
    public Preview preview(Long userId,Archive archive) {
        validate(archive);
        List<String> conflicts=new ArrayList<>();
        Set<String> seen=new HashSet<>();
        for(Track track:archive.tracks()) {
            String key=String.join("\u0000",track.title().strip(),Objects.toString(track.artist(),"").strip(),Objects.toString(track.album(),"").strip()).toLowerCase(Locale.ROOT);
            if(!seen.add(key) || !matching(userId,track).isEmpty())conflicts.add(track.title());
        }
        return new Preview(archive.tracks().size(),archive.playlists().size(),conflicts.size(),conflicts.stream().limit(100).toList());
    }
    @Transactional
    public Restored restore(Long userId,Archive archive,String mode) {
        validate(archive);
        if(!Set.of("skip","fill").contains(mode))throw bad("请选择跳过已有歌曲或补充空白字段");
        // Serialize restores and merges for this account, including empty libraries.
        jdbc.queryForObject("SELECT id FROM sekai_song_user WHERE id=? FOR UPDATE",Long.class,userId);
        Map<Long,Long> mapping=new HashMap<>();int added=0,matched=0;
        for(Track track:archive.tracks()) {
            List<Song> existing=matching(userId,track);
            Song song;
            if(existing.isEmpty()) {
                song=new Song();song.setUserId(userId);song.setTitle(track.title());song.setArtist(track.artist());song.setAlbumName(track.album());
                song.setAnimeTitle(track.anime());song.setTags(track.tags());song.setMood(track.mood());song.setCoverUrl(safeCover(track.cover()));song.setLyricText(track.lyrics());song.setDurationSeconds(track.duration());song.setFavorite(track.favorite());
                if(!songs.add(song))throw bad("无法恢复歌曲资料");added++;
                if(track.preferences()!=null)local.preferences(song.getId(),userId,track.preferences());
            } else {
                song=existing.get(0);matched++;
                if(mode.equals("fill")) {
                    jdbc.update("UPDATE sekai_song_track SET anime_title=COALESCE(NULLIF(anime_title,''),?),tags=COALESCE(NULLIF(tags,''),?),mood=COALESCE(NULLIF(mood,''),?),cover_url=COALESCE(NULLIF(cover_url,''),?),lyric_text=COALESCE(NULLIF(lyric_text,''),?),duration_seconds=COALESCE(duration_seconds,?),favorite=(favorite OR ?) WHERE id=? AND user_id=?",
                            track.anime(),track.tags(),track.mood(),safeCover(track.cover()),track.lyrics(),track.duration(),track.favorite(),song.getId(),userId);
                    if(track.preferences()!=null) {
                        Integer has=jdbc.queryForObject("SELECT COUNT(*) FROM sekai_song_local_binding WHERE song_id=? AND user_id=? AND JSON_LENGTH(preferences_json)>0",Integer.class,song.getId(),userId);
                        if(has==0)local.preferences(song.getId(),userId,track.preferences());
                    }
                }
            }
            mapping.put(track.key(),song.getId());
        }
        for(Collection collection:archive.playlists()) {
            List<Long> ids=jdbc.queryForList("SELECT id FROM sekai_song_playlist WHERE user_id=? AND name=? ORDER BY id LIMIT 1",Long.class,userId,collection.name());
            Long id;
            if(ids.isEmpty()) {
                Playlist p=new Playlist();p.setUserId(userId);p.setName(collection.name());p.setDescription(collection.description());
                if(!playlists.add(p))throw bad("无法恢复歌单");id=p.getId();
            } else id=ids.get(0);
            for(Long key:collection.tracks())jdbc.update("INSERT IGNORE INTO sekai_song_playlist_song(playlist_id,song_id) VALUES (?,?)",id,mapping.get(key));
        }
        return new Restored(added,matched,archive.playlists().size());
    }
    private List<Song> matching(Long userId,Track track) {
        return jdbc.query("SELECT * FROM sekai_song_track WHERE user_id=? AND LOWER(TRIM(title))=LOWER(TRIM(?)) AND LOWER(TRIM(COALESCE(artist,'')))=LOWER(TRIM(?)) AND LOWER(TRIM(COALESCE(album_name,'')))=LOWER(TRIM(?)) ORDER BY id LIMIT 1",BeanPropertyRowMapper.newInstance(Song.class),userId,track.title(),Objects.toString(track.artist(),""),Objects.toString(track.album(),""));
    }
    private void validate(Archive archive) {
        if(archive==null || !validator.validate(archive).isEmpty())throw bad("备份格式或字段长度不正确（版本 1，最多 5000 首歌曲、500 张歌单）");
        Set<Long> keys=new HashSet<>();
        for(Track track:archive.tracks()) {
            if(!keys.add(track.key()))throw bad("备份包含重复歌曲编号");
            if(track.preferences()!=null) {
                var p=track.preferences();
                if(!Double.isFinite(p.position()) || !Double.isFinite(p.rate()) || !Double.isFinite(p.volume()) || p.bookmarks().stream().anyMatch(b->!Double.isFinite(b.time())) || (p.loopA()!=null && !Double.isFinite(p.loopA())) || (p.loopB()!=null && !Double.isFinite(p.loopB())) || (p.loopA()!=null && p.loopB()!=null && p.loopB()<=p.loopA()))throw bad("播放偏好不合法");
            }
        }
        for(Collection p:archive.playlists())if(!keys.containsAll(p.tracks()))throw bad("歌单引用了备份中不存在的歌曲");
    }
    private String safeCover(String cover) {
        if(cover==null)return null;
        if(cover.startsWith("/images/") && !cover.contains(".."))return cover;
        try {var uri=java.net.URI.create(cover);if(Set.of("https","http").contains(Objects.toString(uri.getScheme(),"")) && uri.getHost()!=null && uri.getUserInfo()==null)return cover;}catch(IllegalArgumentException ignored){}
        return null;
    }
    private ResponseStatusException bad(String message) {return new ResponseStatusException(HttpStatus.BAD_REQUEST,message);}
}
