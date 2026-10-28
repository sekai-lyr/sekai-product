CREATE TABLE IF NOT EXISTS sekai_Draw_lots_user (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(64) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    nickname VARCHAR(64) NOT NULL,
    avatar VARCHAR(500),
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sekai_Draw_lots_character (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    english_name VARCHAR(120) NOT NULL,
    anime_title VARCHAR(180) NOT NULL,
    role_type VARCHAR(40) NOT NULL DEFAULT 'main',
    tags VARCHAR(240),
    energy VARCHAR(60),
    image_url VARCHAR(500),
    popularity_score INT NOT NULL DEFAULT 50,
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_draw_lots_character_name (english_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sekai_Draw_lots_fortune (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    level_name VARCHAR(40) NOT NULL,
    score_min INT NOT NULL,
    score_max INT NOT NULL,
    lucky_color VARCHAR(60) NOT NULL,
    lucky_item VARCHAR(80) NOT NULL,
    summary VARCHAR(180) NOT NULL,
    advice VARCHAR(260) NOT NULL,
    UNIQUE KEY uk_draw_lots_fortune_level (level_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sekai_Draw_lots_record (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    character_id BIGINT NOT NULL,
    fortune_id BIGINT NOT NULL,
    mood VARCHAR(40) NOT NULL,
    wish_topic VARCHAR(120) NOT NULL,
    fortune_score INT NOT NULL,
    message VARCHAR(260) NOT NULL,
    draw_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_draw_lots_record_user_time (user_id, draw_time),
    CONSTRAINT fk_draw_lots_record_user FOREIGN KEY (user_id) REFERENCES sekai_Draw_lots_user(id),
    CONSTRAINT fk_draw_lots_record_character FOREIGN KEY (character_id) REFERENCES sekai_Draw_lots_character(id),
    CONSTRAINT fk_draw_lots_record_fortune FOREIGN KEY (fortune_id) REFERENCES sekai_Draw_lots_fortune(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sekai_Draw_lots_favorite (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    character_id BIGINT NOT NULL,
    note VARCHAR(160),
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_draw_lots_favorite_user_character (user_id, character_id),
    INDEX idx_draw_lots_favorite_user_time (user_id, create_time),
    CONSTRAINT fk_draw_lots_favorite_user FOREIGN KEY (user_id) REFERENCES sekai_Draw_lots_user(id),
    CONSTRAINT fk_draw_lots_favorite_character FOREIGN KEY (character_id) REFERENCES sekai_Draw_lots_character(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sekai_Draw_lots_wheel_option (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    title VARCHAR(80) NOT NULL,
    detail VARCHAR(180),
    weight INT NOT NULL DEFAULT 1,
    color VARCHAR(20) NOT NULL DEFAULT '#78e08f',
    sort_order INT NOT NULL DEFAULT 0,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_draw_lots_wheel_option_user_order (user_id, sort_order),
    CONSTRAINT fk_draw_lots_wheel_option_user FOREIGN KEY (user_id) REFERENCES sekai_Draw_lots_user(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sekai_Draw_lots_wheel_spin (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    option_id BIGINT,
    result_title VARCHAR(80) NOT NULL,
    result_detail VARCHAR(180),
    result_color VARCHAR(20) NOT NULL DEFAULT '#78e08f',
    mood_line VARCHAR(180),
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_draw_lots_wheel_spin_user_time (user_id, create_time),
    CONSTRAINT fk_draw_lots_wheel_spin_user FOREIGN KEY (user_id) REFERENCES sekai_Draw_lots_user(id),
    CONSTRAINT fk_draw_lots_wheel_spin_option FOREIGN KEY (option_id) REFERENCES sekai_Draw_lots_wheel_option(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO sekai_Draw_lots_fortune (level_name, score_min, score_max, lucky_color, lucky_item, summary, advice) VALUES
('星光大吉', 96, 100, '星光金', '热咖啡', '星光大吉', '适合主动推进重要的事情，今天你的直觉会很准。'),
('主角大吉', 86, 95, '樱粉色', '便签纸', '主角光环', '把第一个想法写下来，它可能就是今天最好的入口。'),
('稳定中吉', 72, 85, '晴空蓝', '耳机', '稳定展开', '按计划走就会有不错的结果，别被临时情绪带偏。'),
('补给小吉', 55, 71, '浅水蓝', '水杯', '补给日', '状态需要充电，整理房间或早点休息会比硬撑更赚。')
ON DUPLICATE KEY UPDATE
    score_min = VALUES(score_min),
    score_max = VALUES(score_max),
    lucky_color = VALUES(lucky_color),
    lucky_item = VALUES(lucky_item),
    summary = VALUES(summary),
    advice = VALUES(advice);

UPDATE sekai_Draw_lots_fortune
SET level_name = '满月大吉',
    score_min = 90,
    score_max = 100,
    lucky_color = '月光蓝',
    lucky_item = '星星挂件',
    summary = '满月加护',
    advice = '今天适合把拖住你的事情收束一下，先完成最亮的一步，后面会顺起来。'
WHERE level_name LIKE '%?%'
   OR lucky_color LIKE '%?%'
   OR lucky_item LIKE '%?%'
   OR summary LIKE '%?%'
   OR advice LIKE '%?%';