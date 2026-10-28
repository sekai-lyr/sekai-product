-- QA fixture for mobile layout audit. Creates a dedicated QA user with a few library rows
-- cloned server-side from an existing library, plus one playlist. Safe to re-run.
SET NAMES utf8mb4;
START TRANSACTION;
DELETE FROM sekai_song_playlist_song WHERE playlist_id IN (SELECT id FROM sekai_song_playlist WHERE user_id IN (SELECT id FROM sekai_song_user WHERE user_name = 'qa_mobile_layout'));
DELETE FROM sekai_song_playlist WHERE user_id IN (SELECT id FROM sekai_song_user WHERE user_name = 'qa_mobile_layout');
DELETE FROM sekai_song_track WHERE user_id IN (SELECT id FROM sekai_song_user WHERE user_name = 'qa_mobile_layout');
DELETE FROM sekai_song_user WHERE user_name = 'qa_mobile_layout';

INSERT INTO sekai_song_user (user_name, password, nick_name)
VALUES ('qa_mobile_layout', 'fc32e479ff7c6fb690468680fd3b371f620ed7b9b93f259755b1beb8654253a0', 'QA Mobile');
SET @uid = LAST_INSERT_ID();

-- three audio tracks that have synced lyrics, so the lyric stage has content
INSERT INTO sekai_song_track (user_id, title, artist, anime_title, album_name, cover_url, audio_url, local_audio_url,
                              local_video_url, skin_url, tags, mood, lyric_text, duration_seconds, favorite)
SELECT @uid, title, artist, anime_title, album_name, cover_url, audio_url, local_audio_url, local_video_url,
       skin_url, tags, mood, lyric_text, duration_seconds, favorite
FROM sekai_song_track
WHERE user_id = 3 AND local_audio_url IS NOT NULL AND local_audio_url <> '' AND lyric_text IS NOT NULL
  AND (audio_url IS NULL OR audio_url NOT LIKE '%bilibili%')
ORDER BY id LIMIT 3;

-- one bilibili video track (tests the video stage path)
INSERT INTO sekai_song_track (user_id, title, artist, anime_title, album_name, cover_url, audio_url, local_audio_url,
                              local_video_url, skin_url, tags, mood, lyric_text, duration_seconds, favorite)
SELECT @uid, title, artist, anime_title, album_name, cover_url, audio_url, local_audio_url, local_video_url,
       skin_url, tags, mood, lyric_text, duration_seconds, favorite
FROM sekai_song_track
WHERE user_id = 3 AND local_video_url IS NOT NULL AND local_video_url <> ''
ORDER BY id LIMIT 1;

-- one local-audio track WITHOUT lyrics, to check the empty lyric stage state
INSERT INTO sekai_song_track (user_id, title, artist, anime_title, album_name, cover_url, audio_url, local_audio_url,
                              local_video_url, skin_url, tags, mood, lyric_text, duration_seconds, favorite)
SELECT @uid, title, artist, anime_title, album_name, cover_url, audio_url, local_audio_url, local_video_url,
       skin_url, tags, mood, lyric_text, duration_seconds, favorite
FROM sekai_song_track
WHERE user_id = 3 AND local_audio_url IS NOT NULL AND local_audio_url <> '' AND (lyric_text IS NULL OR lyric_text = '')
ORDER BY id LIMIT 1;

-- one track without any local media, to exercise the "no media" player state
INSERT INTO sekai_song_track (user_id, title, artist, anime_title, album_name, cover_url, audio_url, local_audio_url,
                              local_video_url, skin_url, tags, mood, lyric_text, duration_seconds, favorite)
SELECT @uid, title, artist, anime_title, album_name, cover_url, audio_url, local_audio_url, local_video_url,
       skin_url, tags, mood, lyric_text, duration_seconds, favorite
FROM sekai_song_track
WHERE user_id = 3 AND (local_audio_url IS NULL OR local_audio_url = '') AND (audio_url IS NULL OR audio_url NOT LIKE '%bilibili%')
ORDER BY id LIMIT 1;

INSERT INTO sekai_song_playlist (user_id, name, description, cover_url)
SELECT @uid, CONCAT(name, ' · QA'), description, cover_url
FROM sekai_song_playlist WHERE user_id = 3 ORDER BY id LIMIT 1;
SET @pid = LAST_INSERT_ID();

INSERT INTO sekai_song_playlist_song (playlist_id, song_id)
SELECT @pid, id FROM sekai_song_track WHERE user_id = @uid;

COMMIT;
SELECT @uid AS qa_user_id, @pid AS qa_playlist_id;
SELECT id, title, local_audio_url IS NOT NULL AS audio, local_video_url IS NOT NULL AS video, lyric_text IS NOT NULL AS lyric
FROM sekai_song_track WHERE user_id = @uid;
