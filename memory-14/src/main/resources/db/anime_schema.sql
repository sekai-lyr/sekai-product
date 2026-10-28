-- Anime AI Assistant 数据库初始化脚本 (SQLite兼容版本)
-- 动漫角色档案表
CREATE TABLE IF NOT EXISTS anime_character_profile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    series_name VARCHAR(200),
    role VARCHAR(100),
    ai_image_url VARCHAR(500),
    traits TEXT,
    voice_actor VARCHAR(100),
    create_time TEXT
);

-- 动漫番剧档案表
CREATE TABLE IF NOT EXISTS anime_series_profile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(200) NOT NULL,
    genre VARCHAR(200),
    episodes INTEGER,
    rating VARCHAR(10),
    studio VARCHAR(100),
    ai_image_url VARCHAR(500),
    synopsis TEXT,
    recommend_reason TEXT,
    create_time TEXT
);

-- 动漫目标表（用户关注的动漫角色或番剧）
CREATE TABLE IF NOT EXISTS anime_targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id VARCHAR(100) NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('CHARACTER','SERIES')),
    series_name VARCHAR(200),
    genre VARCHAR(100),
    avatar_url VARCHAR(500),
    status VARCHAR(50),
    description TEXT,
    metadata TEXT,
    created_at TEXT,
    updated_at TEXT
);

-- 追番记录表
CREATE TABLE IF NOT EXISTS anime_watch_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id VARCHAR(100) NOT NULL,
    target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('CHARACTER','SERIES')),
    target_id INTEGER NOT NULL,
    record_type VARCHAR(20) NOT NULL CHECK (record_type IN ('WATCH','REVIEW','RECOMMEND','REMINDER','NOTE','RATING','FAVORITE')),
    title VARCHAR(200),
    content TEXT,
    metadata TEXT,
    is_completed INTEGER DEFAULT 0,
    reminder_time TEXT,
    created_at TEXT
);
