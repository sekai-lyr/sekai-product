package com.sekai.song.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sekai.song.model.Song;
import jakarta.annotation.Resource;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import java.util.Map;

@Service
public class LocalLibraryService {
    @Resource private JdbcTemplate jdbc;
    @Resource private SongService songs;
    private final ObjectMapper json = new ObjectMapper();

    public record FileReference(
            @NotBlank @Size(max=255) @Pattern(regexp="(?i)[^/\\\\]+\\.(mp3|flac|m4a|wav|ogg|aac|opus|mp4|webm|mov)") String fileName,
            @NotNull @Min(1) @Max(1099511627776L) Long fileSize,
            @NotNull @Min(0) Long lastModified,
            @Size(max=255) @Pattern(regexp="(?i)(?:[^/\\\\]+\\.lrc)?") String lyricFileName) {}
    public record NewSong(@NotBlank @Size(max=160) String title, @Size(max=160) String artist,
                          @Size(max=160) String album, @NotNull @Valid FileReference file) {}
    public record Bookmark(@Min(0) @Max(86400) double time, @NotNull @Size(max=120) String label) {}
    public record Preferences(@NotBlank @Pattern(regexp=com.sekai.song.model.StageModes.PATTERN) String stageMode,
                              @NotBlank @Pattern(regexp="sequence|shuffle|repeat-one") String playMode,
                              @DecimalMin("0") @DecimalMax("1") double volume,
                              @DecimalMin("0.5") @DecimalMax("2") double rate,
                              @Min(0) @Max(86400) double position,
                              @NotNull @Size(max=30) List<@Valid Bookmark> bookmarks,
                              @DecimalMin("0") @DecimalMax("86400") Double loopA,
                              @DecimalMin("0") @DecimalMax("86400") Double loopB) {}
    public record Entry(Long id, String title, String artist, String album, boolean favorite,
                        String coverUrl, String lyrics, String fileName, Long fileSize, Long lastModified,
                        String lyricFileName, Map<String,Object> preferences, String videoFileName,
                        String serverAudioUrl, String serverVideoUrl) {}

    public List<Entry> list(Long userId) {
        return jdbc.query("""
                SELECT t.id,t.title,t.artist,t.album_name,t.favorite,t.cover_url,t.lyric_text,t.local_audio_url,t.local_video_url,
                       b.file_name,b.file_size,b.last_modified,b.lyric_file_name,b.preferences_json
                FROM sekai_song_track t LEFT JOIN sekai_song_local_binding b ON b.song_id=t.id AND b.user_id=t.user_id
                WHERE t.user_id=? ORDER BY t.favorite DESC,t.id
                """, (rs,n) -> {
            String name=rs.getString("file_name"), legacy=rs.getString("local_audio_url");
            if(name==null && legacy!=null && legacy.matches("^/(?:uploads|external-uploads)/audio/[^/%\\\\]+$")) name=legacy.substring(legacy.lastIndexOf('/')+1);
            String video=rs.getString("local_video_url"), videoName=null;
            if(video!=null && video.matches("^/(?:uploads|external-uploads)/video/[^/%\\\\]+$")) videoName=video.substring(video.lastIndexOf('/')+1);
            if(name==null)name=videoName;
            return new Entry(rs.getLong("id"),rs.getString("title"),rs.getString("artist"),rs.getString("album_name"),rs.getBoolean("favorite"),
                    rs.getString("cover_url"),rs.getString("lyric_text"),name,rs.getObject("file_size",Long.class),rs.getObject("last_modified",Long.class),
                    rs.getString("lyric_file_name"),readPreferences(rs.getString("preferences_json")),videoName,
                    legacy != null && legacy.matches("^/uploads/audio/commons-[^/]+\\.flac$") ? legacy : null,
                    video != null && video.matches("^/uploads/video/commons-[^/]+\\.mp4$") ? video : null);
        },userId);
    }

    public void bind(Long songId, Long userId, FileReference file) {
        requireOwned(songId,userId);
        if(file.fileName().indexOf((char)0)>=0 || (file.lyricFileName()!=null && file.lyricFileName().indexOf((char)0)>=0))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"文件名称不合法");
        jdbc.update("""
                INSERT INTO sekai_song_local_binding(song_id,user_id,file_name,file_size,last_modified,lyric_file_name,preferences_json)
                VALUES (?,?,?,?,?,?,JSON_OBJECT()) ON DUPLICATE KEY UPDATE file_name=VALUES(file_name),file_size=VALUES(file_size),
                last_modified=VALUES(last_modified),lyric_file_name=VALUES(lyric_file_name)
                """,songId,userId,file.fileName(),file.fileSize(),file.lastModified(),file.lyricFileName());
    }

    @Transactional
    public Long add(Long userId, NewSong input) {
        List<Long> existing=jdbc.queryForList("SELECT song_id FROM sekai_song_local_binding WHERE user_id=? AND file_name=? AND file_size=? LIMIT 1",Long.class,
                userId,input.file().fileName(),input.file().fileSize());
        if(!existing.isEmpty()){bind(existing.get(0),userId,input.file());return existing.get(0);}
        Song song=new Song();song.setUserId(userId);song.setTitle(input.title());song.setArtist(input.artist());song.setAlbumName(input.album());
        if(!songs.add(song)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"无法保存歌曲字段");
        bind(song.getId(),userId,input.file());return song.getId();
    }

    public void preferences(Long songId, Long userId, Preferences input) {
        requireOwned(songId,userId);
        if(!Double.isFinite(input.volume()) || !Double.isFinite(input.rate()) || !Double.isFinite(input.position())
                || input.bookmarks().stream().anyMatch(b -> !Double.isFinite(b.time()))
                || (input.loopA()!=null && !Double.isFinite(input.loopA())) || (input.loopB()!=null && !Double.isFinite(input.loopB()))
                || (input.loopA()!=null && input.loopB()!=null && input.loopB()<=input.loopA())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"播放设置不合法");
        }
        try {
            jdbc.update("INSERT INTO sekai_song_local_binding(song_id,user_id,preferences_json) VALUES (?,?,?) ON DUPLICATE KEY UPDATE preferences_json=VALUES(preferences_json)",
                    songId,userId,json.writeValueAsString(input));
        } catch(java.io.IOException error){throw new IllegalStateException("无法保存播放设置",error);}
    }

    public void favorite(Long songId,Long userId){requireOwned(songId,userId);songs.toggleFavorite(songId,userId);}
    public void lyrics(Long songId,Long userId,String lyrics){
        requireOwned(songId,userId);
        if(lyrics!=null && !lyrics.isBlank())jdbc.update("UPDATE sekai_song_track SET lyric_text=? WHERE id=? AND user_id=?",lyrics,songId,userId);
    }
    public void delete(Long songId,Long userId){requireOwned(songId,userId);songs.delete(songId,userId);}
    private void requireOwned(Long songId,Long userId){if(songs.getByIdAndUserId(songId,userId)==null)throw new ResponseStatusException(HttpStatus.NOT_FOUND);}
    @SuppressWarnings("unchecked")
    private Map<String,Object> readPreferences(String value){
        if(value==null)return Map.of();
        try{return json.readValue(value,Map.class);}catch(java.io.IOException error){throw new IllegalStateException("播放设置损坏",error);}
    }
}
