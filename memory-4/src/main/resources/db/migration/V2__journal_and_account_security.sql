ALTER TABLE sekai_Draw_lots_user
    ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN session_version INT NOT NULL DEFAULT 0,
    ADD COLUMN recovery_hash CHAR(64),
    ADD COLUMN reset_hash CHAR(64),
    ADD COLUMN reset_expires DATETIME;

ALTER TABLE sekai_Draw_lots_character ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT TRUE;
UPDATE sekai_Draw_lots_character SET enabled = FALSE WHERE role_type = 'archived';
ALTER TABLE sekai_Draw_lots_fortune ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE sekai_Draw_lots_wish (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    title VARCHAR(40) NOT NULL,
    review VARCHAR(1000) NOT NULL DEFAULT '',
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_wish_user_title (user_id, title),
    FOREIGN KEY (user_id) REFERENCES sekai_Draw_lots_user(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE sekai_Draw_lots_record
    ADD COLUMN draw_type VARCHAR(20) NOT NULL DEFAULT 'RANDOM',
    ADD COLUMN daily_date DATE,
    ADD COLUMN ritual_id CHAR(36),
    ADD COLUMN wish_id BIGINT,
    ADD CONSTRAINT fk_record_wish FOREIGN KEY (wish_id) REFERENCES sekai_Draw_lots_wish(id);

-- Keep all historical records; only the last daily result is canonical.
UPDATE sekai_Draw_lots_record SET draw_type = 'LEGACY_DAILY' WHERE wish_topic = '每日固定签';
UPDATE sekai_Draw_lots_record r
JOIN (SELECT * FROM (SELECT MAX(id) AS id, DATE(draw_time) AS day
      FROM sekai_Draw_lots_record WHERE draw_type = 'LEGACY_DAILY'
      GROUP BY user_id, DATE(draw_time)) canonical) d ON r.id = d.id
SET r.draw_type = 'DAILY', r.daily_date = d.day;
UPDATE sekai_Draw_lots_record SET draw_type = 'LEGACY_RITUAL'
WHERE draw_type = 'RANDOM' AND wish_topic LIKE '三连签仪式%';
ALTER TABLE sekai_Draw_lots_record
    ADD UNIQUE KEY uk_record_daily (user_id, daily_date),
    ADD INDEX idx_record_wish (user_id, wish_id);

CREATE TABLE sekai_Draw_lots_achievement (
    user_id BIGINT NOT NULL,
    code VARCHAR(40) NOT NULL,
    unlocked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, code),
    FOREIGN KEY (user_id) REFERENCES sekai_Draw_lots_user(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE sekai_Draw_lots_wheel_deck (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    name VARCHAR(40) NOT NULL,
    UNIQUE KEY uk_deck_user_name (user_id, name),
    FOREIGN KEY (user_id) REFERENCES sekai_Draw_lots_user(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO sekai_Draw_lots_wheel_deck (user_id, name)
SELECT id, '我的转盘' FROM sekai_Draw_lots_user;
ALTER TABLE sekai_Draw_lots_wheel_option ADD COLUMN deck_id BIGINT;
UPDATE sekai_Draw_lots_wheel_option o JOIN sekai_Draw_lots_wheel_deck d ON d.user_id = o.user_id SET o.deck_id = d.id;
ALTER TABLE sekai_Draw_lots_wheel_option MODIFY deck_id BIGINT NOT NULL,
    ADD CONSTRAINT fk_option_deck FOREIGN KEY (deck_id) REFERENCES sekai_Draw_lots_wheel_deck(id),
    ADD INDEX idx_option_deck_order (deck_id, sort_order);
ALTER TABLE sekai_Draw_lots_wheel_spin ADD COLUMN deck_id BIGINT;
UPDATE sekai_Draw_lots_wheel_spin s JOIN sekai_Draw_lots_wheel_deck d ON d.user_id = s.user_id SET s.deck_id = d.id;
ALTER TABLE sekai_Draw_lots_wheel_spin ADD CONSTRAINT fk_spin_deck FOREIGN KEY (deck_id) REFERENCES sekai_Draw_lots_wheel_deck(id);
