CREATE TABLE IF NOT EXISTS sekai_song_local_binding (
    song_id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    file_name VARCHAR(255),
    file_size BIGINT,
    last_modified BIGINT,
    lyric_file_name VARCHAR(255),
    preferences_json JSON NOT NULL,
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_song_local_binding_user (user_id),
    CONSTRAINT fk_song_local_binding_song FOREIGN KEY (song_id) REFERENCES sekai_song_track(id) ON DELETE CASCADE,
    CONSTRAINT fk_song_local_binding_user FOREIGN KEY (user_id) REFERENCES sekai_song_user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
