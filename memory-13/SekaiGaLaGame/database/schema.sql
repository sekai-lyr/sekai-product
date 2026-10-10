-- ============================================================
-- SekaiGaLaGame · lies ten years ago（谎言十年）视觉小说数据表
-- 所有表位于共享数据源 sekai_friend 中，表前缀：sekai_GaLaGame_lies_
-- 生成脚本：data-build/parse_rpy.py
-- ============================================================

USE sekai_friend;

DROP TABLE IF EXISTS sekai_GaLaGame_lies_ending_records;
DROP TABLE IF EXISTS sekai_GaLaGame_lies_gallery;
DROP TABLE IF EXISTS sekai_GaLaGame_lies_saves;
DROP TABLE IF EXISTS sekai_GaLaGame_lies_choices;
DROP TABLE IF EXISTS sekai_GaLaGame_lies_story_nodes;
DROP TABLE IF EXISTS sekai_GaLaGame_lies_endings;
DROP TABLE IF EXISTS sekai_GaLaGame_lies_images;
DROP TABLE IF EXISTS sekai_GaLaGame_lies_characters;
DROP TABLE IF EXISTS sekai_GaLaGame_lies_chapters;
DROP TABLE IF EXISTS sekai_GaLaGame_lies_users;

-- 玩家账号
CREATE TABLE sekai_GaLaGame_lies_users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    nickname VARCHAR(50),
    avatar VARCHAR(255),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 章节
CREATE TABLE sekai_GaLaGame_lies_chapters (
    chapter_no INT PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    start_label VARCHAR(100) NOT NULL,
    summary VARCHAR(1000),
    sort_no INT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 登场角色
CREATE TABLE sekai_GaLaGame_lies_characters (
    char_key VARCHAR(50) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(20),
    role VARCHAR(50),
    sort_no INT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 图片资源清单（bg/cg/sprite 与文件路径映射）
CREATE TABLE sekai_GaLaGame_lies_images (
    image_key VARCHAR(100) PRIMARY KEY,
    image_type VARCHAR(20) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 剧情节点（对白/旁白/场景/立绘/选项/赋值/跳转/结局）
CREATE TABLE sekai_GaLaGame_lies_story_nodes (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    node_key VARCHAR(50) NOT NULL UNIQUE,
    label_name VARCHAR(100) NOT NULL,
    chapter_no INT DEFAULT 0,
    node_type VARCHAR(20) NOT NULL,
    seq_no INT NOT NULL,
    speaker_key VARCHAR(50),
    speaker_name VARCHAR(50),
    text TEXT,
    bg_image VARCHAR(100),
    sprites TEXT COMMENT 'JSON: [{"image":"","pos":""}]',
    set_var VARCHAR(50),
    set_value VARCHAR(255),
    next_key VARCHAR(50),
    ending_key VARCHAR(100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX idx_galagame_nodes_label ON sekai_GaLaGame_lies_story_nodes (label_name);
CREATE INDEX idx_galagame_nodes_chapter ON sekai_GaLaGame_lies_story_nodes (chapter_no);
CREATE INDEX idx_galagame_nodes_type ON sekai_GaLaGame_lies_story_nodes (node_type);

-- 选项
CREATE TABLE sekai_GaLaGame_lies_choices (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    node_key VARCHAR(50) NOT NULL,
    option_text VARCHAR(500) NOT NULL,
    next_key VARCHAR(50),
    order_no INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX idx_galagame_choices_node ON sekai_GaLaGame_lies_choices (node_key);

-- 结局
CREATE TABLE sekai_GaLaGame_lies_endings (
    ending_key VARCHAR(100) PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description VARCHAR(1000),
    bg_image VARCHAR(100),
    sort_no INT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 存档（每用户 10 个槽位）
CREATE TABLE sekai_GaLaGame_lies_saves (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    slot_no INT NOT NULL,
    state_json TEXT NOT NULL,
    chapter_no INT DEFAULT 0,
    progress VARCHAR(100),
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_galagame_save_user_slot (user_id, slot_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CG 图鉴解锁
CREATE TABLE sekai_GaLaGame_lies_gallery (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    image_key VARCHAR(100) NOT NULL,
    unlock_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_galagame_gallery_user_image (user_id, image_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 结局解锁记录
CREATE TABLE sekai_GaLaGame_lies_ending_records (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    ending_key VARCHAR(100) NOT NULL,
    unlock_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_galagame_ending_user_key (user_id, ending_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
