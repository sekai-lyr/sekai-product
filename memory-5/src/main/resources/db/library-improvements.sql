CREATE TABLE IF NOT EXISTS sekai_song_import_task (
 id VARCHAR(36) PRIMARY KEY, user_id BIGINT NOT NULL, source VARCHAR(16) NOT NULL,
 playlist_id BIGINT NULL, state VARCHAR(16) NOT NULL DEFAULT 'queued',
 items_json JSON NOT NULL, created_ms BIGINT NOT NULL, updated_ms BIGINT NOT NULL,
 INDEX idx_import_owner(user_id,created_ms), INDEX idx_import_queue(state,created_ms)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
