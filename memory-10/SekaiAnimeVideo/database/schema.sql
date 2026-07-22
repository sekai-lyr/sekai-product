USE sekai_friend;

CREATE TABLE IF NOT EXISTS sekai_anime_mode_user (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_name VARCHAR(64) NOT NULL UNIQUE,
    password VARCHAR(128) NOT NULL,
    nick_name VARCHAR(64) NOT NULL,
    avatar_url VARCHAR(500),
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sekai_anime_mode_category (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    name VARCHAR(64) NOT NULL,
    description VARCHAR(255),
    cover_url VARCHAR(500),
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_category_name (user_id, name),
    KEY idx_category_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sekai_anime_mode_site (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    category_id BIGINT,
    site_name VARCHAR(120) NOT NULL,
    site_url VARCHAR(500) NOT NULL,
    description VARCHAR(500),
    tags VARCHAR(255),
    click_count INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_site_user (user_id),
    KEY idx_site_category (category_id),
    KEY idx_site_keyword (site_name, tags)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sekai_anime_mode_favorite (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    site_id BIGINT NOT NULL,
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_site (user_id, site_id),
    KEY idx_favorite_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO sekai_anime_mode_user (user_name, password, nick_name, avatar_url)
VALUES ('sekai', '123456', 'Sekai', NULL);

SET @anime_user_id = (SELECT id FROM sekai_anime_mode_user WHERE user_name = 'sekai' LIMIT 1);

INSERT IGNORE INTO sekai_anime_mode_category (user_id, name, description, cover_url) VALUES
(@anime_user_id, '🎬 在线看番', '在线观看动漫的网站', NULL),
(@anime_user_id, '📥 下载资源', '动漫下载资源站点', NULL),
(@anime_user_id, '📖 漫画阅读', '在线漫画阅读网站', NULL),
(@anime_user_id, '🎵 动漫音乐', '动漫音乐资源站点', NULL);

INSERT IGNORE INTO sekai_anime_mode_site (user_id, category_id, site_name, site_url, description, tags, click_count, status)
VALUES
(@anime_user_id, (SELECT id FROM sekai_anime_mode_category WHERE user_id = @anime_user_id AND name = '🎬 在线看番' LIMIT 1), '囧次元', 'https://www.jiongciyuan.com', '囧次元动漫 - 在线看番平台', '在线观看,番剧,囧次元', 0, 'ACTIVE');
