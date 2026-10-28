-- Run with the database administrator before upgrading an existing cloud deployment.
-- Existing comments and user/music tables are preserved.
SET @sekai_plaza_ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sekai_song_feedback' AND column_name='parent_id'), 'SELECT 1', 'ALTER TABLE sekai_song_feedback ADD COLUMN parent_id BIGINT NULL');
PREPARE sekai_plaza_statement FROM @sekai_plaza_ddl;
EXECUTE sekai_plaza_statement;
DEALLOCATE PREPARE sekai_plaza_statement;
SET @sekai_plaza_ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sekai_song_feedback' AND column_name='reply_to_id'), 'SELECT 1', 'ALTER TABLE sekai_song_feedback ADD COLUMN reply_to_id BIGINT NULL');
PREPARE sekai_plaza_statement FROM @sekai_plaza_ddl;
EXECUTE sekai_plaza_statement;
DEALLOCATE PREPARE sekai_plaza_statement;
SET @sekai_plaza_ddl = IF(EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='sekai_song_feedback' AND index_name='idx_feedback_parent_status'), 'SELECT 1', 'CREATE INDEX idx_feedback_parent_status ON sekai_song_feedback(parent_id,status,id)');
PREPARE sekai_plaza_statement FROM @sekai_plaza_ddl;
EXECUTE sekai_plaza_statement;
DEALLOCATE PREPARE sekai_plaza_statement;
CREATE TABLE IF NOT EXISTS sekai_song_feedback_like (
 feedback_id BIGINT NOT NULL, user_id BIGINT NOT NULL,
 PRIMARY KEY(feedback_id,user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
