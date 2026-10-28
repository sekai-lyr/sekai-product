CREATE TABLE IF NOT EXISTS sekai_song_feedback (
 id BIGINT PRIMARY KEY AUTO_INCREMENT, user_id BIGINT NOT NULL,
 usability TINYINT NULL, innovation TINYINT NULL, content VARCHAR(1000) NOT NULL,
 status VARCHAR(16) NOT NULL DEFAULT 'pending', created_ms BIGINT NOT NULL, reviewed_ms BIGINT,
 parent_id BIGINT NULL, reply_to_id BIGINT NULL,
 INDEX idx_feedback_status (status,id), INDEX idx_feedback_user (user_id,created_ms), INDEX idx_feedback_parent_status(parent_id,status,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sekai_song_feedback_like (
 feedback_id BIGINT NOT NULL, user_id BIGINT NOT NULL,
 PRIMARY KEY(feedback_id,user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sekai_song_login_daily (
 user_id BIGINT NOT NULL, day DATE NOT NULL, login_count INT NOT NULL DEFAULT 0, last_ms BIGINT NOT NULL,
 PRIMARY KEY(user_id,day), INDEX idx_login_day(day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sekai_song_listen_session (
 id VARCHAR(36) PRIMARY KEY, user_id BIGINT NOT NULL, song_id BIGINT NOT NULL, start_day DATE NOT NULL,
 played_ms BIGINT NOT NULL DEFAULT 0, reported_ms BIGINT NOT NULL DEFAULT 0, last_ms BIGINT NOT NULL,
 INDEX idx_listen_user(user_id,start_day), INDEX idx_listen_day(start_day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sekai_song_listen_daily (
 user_id BIGINT NOT NULL, day DATE NOT NULL, stage VARCHAR(24) NOT NULL, played_ms BIGINT NOT NULL DEFAULT 0,
 PRIMARY KEY(user_id,day,stage), INDEX idx_listen_daily_day(day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
