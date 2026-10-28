package com.sekai.song.service;

import com.sekai.song.model.Song;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;

@Service
public class LibraryMergeService {
    private final JdbcTemplate jdbc;
    private final SongService songs;
    public LibraryMergeService(JdbcTemplate jdbc,SongService songs){this.jdbc=jdbc;this.songs=songs;}
    public List<Map<String,Object>> candidates(Long userId,int page) {
        return jdbc.queryForList("SELECT a.id keepId,b.id removeId,a.title,a.artist,a.album_name keepAlbum,b.album_name removeAlbum FROM sekai_song_track a JOIN sekai_song_track b ON a.user_id=b.user_id AND a.id<b.id AND LOWER(TRIM(a.title))=LOWER(TRIM(b.title)) AND LOWER(TRIM(COALESCE(a.artist,'')))=LOWER(TRIM(COALESCE(b.artist,''))) WHERE a.user_id=? ORDER BY a.id,b.id LIMIT 31 OFFSET ?",userId,(Math.max(1,Math.min(page,100000))-1)*30);
    }
    public Map<String,Object> preview(Long userId,Long keep,Long remove) {
        Song a=owned(userId,keep),b=owned(userId,remove);
        if(keep.equals(remove))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"请选择两首不同的歌曲");
        return Map.of("keep",a,"remove",b,"fingerprint",fingerprint(a,b));
    }
    @Transactional
    public void merge(Long userId,Long keep,Long remove,String fingerprint) {
        jdbc.queryForObject("SELECT id FROM sekai_song_user WHERE id=? FOR UPDATE",Long.class,userId);
        jdbc.queryForList("SELECT id FROM sekai_song_track WHERE user_id=? AND id IN (?,?) ORDER BY id FOR UPDATE",Long.class,userId,keep,remove);
        Song a=owned(userId,keep),b=owned(userId,remove);
        if(keep.equals(remove) || !fingerprint(a,b).equals(fingerprint))throw new ResponseStatusException(HttpStatus.CONFLICT,"歌曲已变化，请重新预览");
        jdbc.update("UPDATE sekai_song_track SET favorite=(favorite OR ?),lyric_text=COALESCE(NULLIF(lyric_text,''),?),cover_url=COALESCE(NULLIF(cover_url,''),?),tags=COALESCE(NULLIF(tags,''),?),anime_title=COALESCE(NULLIF(anime_title,''),?),album_name=COALESCE(NULLIF(album_name,''),?),duration_seconds=COALESCE(duration_seconds,?),local_audio_url=COALESCE(NULLIF(local_audio_url,''),?),local_video_url=COALESCE(NULLIF(local_video_url,''),?) WHERE id=? AND user_id=?",b.getFavorite(),b.getLyricText(),b.getCoverUrl(),b.getTags(),b.getAnimeTitle(),b.getAlbumName(),b.getDurationSeconds(),b.getLocalAudioUrl(),b.getLocalVideoUrl(),keep,userId);
        jdbc.update("INSERT IGNORE INTO sekai_song_playlist_song(playlist_id,song_id) SELECT ps.playlist_id,? FROM sekai_song_playlist_song ps JOIN sekai_song_playlist p ON p.id=ps.playlist_id WHERE ps.song_id=? AND p.user_id=?",keep,remove,userId);
        jdbc.update("INSERT INTO sekai_song_local_binding(song_id,user_id,file_name,file_size,last_modified,lyric_file_name,preferences_json) SELECT ?,source.user_id,source.file_name,source.file_size,source.last_modified,source.lyric_file_name,source.preferences_json FROM sekai_song_local_binding source WHERE source.song_id=? AND source.user_id=? ON DUPLICATE KEY UPDATE file_size=IF(sekai_song_local_binding.file_name IS NULL,VALUES(file_size),sekai_song_local_binding.file_size),last_modified=IF(sekai_song_local_binding.file_name IS NULL,VALUES(last_modified),sekai_song_local_binding.last_modified),file_name=COALESCE(sekai_song_local_binding.file_name,VALUES(file_name)),lyric_file_name=COALESCE(sekai_song_local_binding.lyric_file_name,VALUES(lyric_file_name)),preferences_json=IF(JSON_LENGTH(sekai_song_local_binding.preferences_json)=0,VALUES(preferences_json),sekai_song_local_binding.preferences_json)",keep,remove,userId);
        jdbc.update("UPDATE sekai_song_listen_session SET song_id=? WHERE song_id=? AND user_id=?",keep,remove,userId);
        songs.delete(remove,userId);
    }
    private Song owned(Long userId,Long id){var rows=jdbc.query("SELECT * FROM sekai_song_track WHERE id=? AND user_id=?",org.springframework.jdbc.core.BeanPropertyRowMapper.newInstance(Song.class),id,userId);Song song=rows.isEmpty()?null:rows.get(0);if(song==null)throw new ResponseStatusException(HttpStatus.NOT_FOUND,"歌曲不存在");return song;}
    private String fingerprint(Song a,Song b){
        try{return org.apache.commons.codec.digest.DigestUtils.sha256Hex(new com.fasterxml.jackson.databind.ObjectMapper().registerModule(new com.fasterxml.jackson.databind.module.SimpleModule().addSerializer(java.time.LocalDateTime.class,new com.fasterxml.jackson.databind.JsonSerializer<java.time.LocalDateTime>() {
            @Override public void serialize(java.time.LocalDateTime value,com.fasterxml.jackson.core.JsonGenerator output,com.fasterxml.jackson.databind.SerializerProvider provider) throws java.io.IOException {output.writeString(value.toString());}
        })).writeValueAsBytes(List.of(a,b)));}
        catch(java.io.IOException e){throw new IllegalStateException(e);}
    }
}
