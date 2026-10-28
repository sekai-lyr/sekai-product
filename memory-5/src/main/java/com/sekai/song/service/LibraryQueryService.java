package com.sekai.song.service;

import com.sekai.song.model.*;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class LibraryQueryService {
    private final JdbcTemplate jdbc;
    private static final String LIBRARY = "(NULLIF(TRIM(t.local_audio_url),'') IS NOT NULL OR NULLIF(TRIM(t.local_video_url),'') IS NOT NULL OR EXISTS (SELECT 1 FROM sekai_song_local_binding b WHERE b.song_id=t.id AND b.user_id=t.user_id AND b.file_name IS NOT NULL))";
    private static final String SONG_MATCH = " FROM sekai_song_track t WHERE t.user_id=? AND " + LIBRARY + " AND LOCATE(LOWER(?),LOWER(CONCAT_WS(' ',t.title,t.artist,t.anime_title,t.tags,t.mood)))>0";
    private static final String PLAYLIST_MATCH = " FROM sekai_song_playlist p WHERE p.user_id=? AND LOCATE(LOWER(?),LOWER(CONCAT_WS(' ',p.name,p.description)))>0";
    public LibraryQueryService(JdbcTemplate jdbc) { this.jdbc=jdbc; }

    public DashboardStats stats(Long userId) {
        DashboardStats result=new DashboardStats();
        jdbc.query("SELECT COUNT(*) total,COALESCE(SUM(t.favorite),0) favorites FROM sekai_song_track t WHERE t.user_id=? AND "+LIBRARY,
                rs->{result.setSongCount(rs.getInt("total"));result.setFavoriteCount(rs.getInt("favorites"));},userId);
        result.setPlaylistCount(jdbc.queryForObject("SELECT COUNT(*) FROM sekai_song_playlist WHERE user_id=?",Integer.class,userId));
        List<String> top=jdbc.queryForList("SELECT t.anime_title FROM sekai_song_track t JOIN sekai_song_listen_session l ON l.song_id=t.id AND l.user_id=t.user_id WHERE t.user_id=? AND l.played_ms>0 AND NULLIF(TRIM(t.anime_title),'') IS NOT NULL GROUP BY t.anime_title ORDER BY SUM(l.played_ms) DESC,t.anime_title LIMIT 1",String.class,userId);
        result.setTopAnime(top.isEmpty()?"暂无":top.get(0));
        return result;
    }
    public List<Song> recent(Long userId) {
        return songs("SELECT t.* FROM sekai_song_track t JOIN (SELECT song_id,MAX(last_ms) latest FROM sekai_song_listen_session WHERE user_id=? AND played_ms>0 GROUP BY song_id) l ON l.song_id=t.id WHERE t.user_id=? ORDER BY l.latest DESC,t.id DESC LIMIT 6",userId,userId);
    }
    public List<Song> favorites(Long userId) {
        return songs("SELECT * FROM sekai_song_track WHERE user_id=? AND favorite=1 ORDER BY update_time DESC,id DESC LIMIT 5",userId);
    }
    public List<Playlist> playlists(Long userId) {
        return jdbc.query("SELECT * FROM sekai_song_playlist WHERE user_id=? ORDER BY update_time DESC,id DESC LIMIT 4",BeanPropertyRowMapper.newInstance(Playlist.class),userId);
    }
    public int playlistCount(Long id,Long userId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM sekai_song_playlist_song ps JOIN sekai_song_playlist p ON p.id=ps.playlist_id JOIN sekai_song_track t ON t.id=ps.song_id WHERE p.id=? AND p.user_id=? AND t.user_id=?",Integer.class,id,userId,userId);
    }
    public List<Song> playlistSongs(Long id,Long userId,int offset,int limit) {
        return songs("SELECT t.* FROM sekai_song_track t JOIN sekai_song_playlist_song ps ON ps.song_id=t.id JOIN sekai_song_playlist p ON p.id=ps.playlist_id WHERE p.id=? AND p.user_id=? AND t.user_id=? ORDER BY ps.id LIMIT ? OFFSET ?",id,userId,userId,limit,offset);
    }
    public int searchCount(Long userId,String q,String type) {
        return jdbc.queryForObject("SELECT COUNT(*)"+(type.equals("song")?SONG_MATCH:PLAYLIST_MATCH),Integer.class,userId,q);
    }
    public List<SearchResult> search(Long userId,String q,String type,int offset,int limit) {
        String song="SELECT '歌曲' type,t.title,CONCAT_WS(' · ',NULLIF(t.artist,''),NULLIF(t.anime_title,''),NULLIF(t.mood,'')) subtitle,CONCAT('/player/',t.id) href,t.id sort_id,0 sort_type"+SONG_MATCH;
        String playlist="SELECT '歌单' type,p.name title,p.description subtitle,CONCAT('/playlists/',p.id) href,p.id sort_id,1 sort_type"+PLAYLIST_MATCH;
        Object[] args=type.equals("all")?new Object[]{userId,q,userId,q,limit,offset}:new Object[]{userId,q,limit,offset};
        String sql=type.equals("all")?song+" UNION ALL "+playlist:type.equals("song")?song:playlist;
        return jdbc.query("SELECT * FROM ("+sql+") matches ORDER BY sort_type,sort_id DESC LIMIT ? OFFSET ?",(rs,n)->new SearchResult(rs.getString("type"),rs.getString("title"),rs.getString("subtitle"),rs.getString("href")),args);
    }
    public List<Song> smart(Long userId,String rule,int page) {
        String where=switch(rule) {
            case "missing-lyrics" -> "NULLIF(TRIM(t.lyric_text),'') IS NULL";
            case "unlinked" -> "NOT "+LIBRARY;
            case "recent" -> "t.create_time>=DATE_SUB(NOW(),INTERVAL 30 DAY)";
            case "frequent" -> "EXISTS (SELECT 1 FROM sekai_song_listen_session l WHERE l.user_id=t.user_id AND l.song_id=t.id AND l.played_ms>0 AND l.start_day>=DATE_SUB(CURRENT_DATE,INTERVAL 30 DAY))";
            default -> throw new IllegalArgumentException("未知智能歌单");
        };
        String order=rule.equals("frequent")?"(SELECT SUM(l.played_ms) FROM sekai_song_listen_session l WHERE l.user_id=t.user_id AND l.song_id=t.id AND l.start_day>=DATE_SUB(CURRENT_DATE,INTERVAL 30 DAY)) DESC,t.id DESC":"t.create_time DESC,t.id DESC";
        return songs("SELECT t.* FROM sekai_song_track t WHERE t.user_id=? AND "+where+" ORDER BY "+order+" LIMIT 31 OFFSET ?",userId,(Math.max(1,Math.min(page,100000))-1)*30);
    }
    private List<Song> songs(String sql,Object... args) { return jdbc.query(sql,BeanPropertyRowMapper.newInstance(Song.class),args); }
}
