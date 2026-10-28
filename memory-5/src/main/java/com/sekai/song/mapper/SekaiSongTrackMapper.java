package com.sekai.song.mapper;

import com.sekai.song.model.Song;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface SekaiSongTrackMapper {
    @Select("SELECT COUNT(*) FROM sekai_song_track WHERE user_id = #{userId} AND local_audio_url = #{url}")
    int countOwnedAudio(@Param("userId") Long userId, @Param("url") String url);

    @Select("SELECT COUNT(*) FROM sekai_song_track WHERE user_id = #{userId} AND local_video_url = #{url}")
    int countOwnedVideo(@Param("userId") Long userId, @Param("url") String url);

    int insert(Song song);

    int update(Song song);

    int deleteByIdAndUserId(@Param("id") Long id, @Param("userId") Long userId);

    int updateFavorite(@Param("id") Long id, @Param("userId") Long userId, @Param("favorite") boolean favorite);

    int updateLocalAudioUrl(@Param("id") Long id, @Param("userId") Long userId, @Param("localAudioUrl") String localAudioUrl);

    int updateLocalAudioMetadata(@Param("id") Long id,
                                 @Param("userId") Long userId,
                                 @Param("localAudioUrl") String localAudioUrl,
                                 @Param("lyricText") String lyricText,
                                 @Param("durationSeconds") Integer durationSeconds);

    int updateLyricMetadata(@Param("id") Long id,
                            @Param("userId") Long userId,
                            @Param("lyricText") String lyricText,
                            @Param("durationSeconds") Integer durationSeconds);

    int updateLocalVideoUrl(@Param("id") Long id, @Param("userId") Long userId, @Param("localVideoUrl") String localVideoUrl);

    int updateCoverUrl(@Param("id") Long id, @Param("userId") Long userId, @Param("coverUrl") String coverUrl);

    Song findByIdAndUserId(@Param("id") Long id, @Param("userId") Long userId);

    Song findByAudioUrlAndUserId(@Param("audioUrl") String audioUrl, @Param("userId") Long userId);

    List<Song> listByUserId(@Param("userId") Long userId, @Param("keyword") String keyword,
                            @Param("offset") int offset, @Param("pageSize") int pageSize);

    List<Song> listAllByUserId(@Param("userId") Long userId);

    List<Song> listLibraryByUserId(@Param("userId") Long userId, @Param("keyword") String keyword,
                                   @Param("offset") int offset, @Param("pageSize") int pageSize);

    List<Song> listAllLibraryByUserId(@Param("userId") Long userId);

    List<Song> listFavoritesByUserId(@Param("userId") Long userId);

    int countByUserId(@Param("userId") Long userId, @Param("keyword") String keyword);

    int countLibraryByUserId(@Param("userId") Long userId, @Param("keyword") String keyword);
}
