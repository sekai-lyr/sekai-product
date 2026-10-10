-- ============================================================
-- Sekai Data Object 二次元数据锡通
-- 图片素材本地化：从官方网站/维基百科/MAL 爬取，托管于 /uploads/images/
-- 执行：mysql -uroot -p123456520baba --default-character-set=utf8mb4 < build-data/update-images.sql
-- ============================================================

USE sekai_friend;

-- 1. 番剧封面（官网主视觉 / 官方海报）
UPDATE sekai_dataobject_anime_series SET cover_url = '/uploads/images/shingeki_poster.jpg'      WHERE id = 1;
UPDATE sekai_dataobject_anime_series SET cover_url = '/uploads/images/kimetsu_keyvisual.jpg'   WHERE id = 2;
UPDATE sekai_dataobject_anime_series SET cover_url = '/uploads/images/spy_poster.jpg'           WHERE id = 3;
UPDATE sekai_dataobject_anime_series SET cover_url = '/uploads/images/steins_poster.jpg'        WHERE id = 4;
UPDATE sekai_dataobject_anime_series SET cover_url = '/uploads/images/ghibli_poster.jpg'        WHERE id = 5;
UPDATE sekai_dataobject_anime_series SET cover_url = '/uploads/images/kiminona_poster.jpg'      WHERE id = 6;
UPDATE sekai_dataobject_anime_series SET cover_url = '/uploads/images/jujutsu_poster.jpg'       WHERE id = 7;
UPDATE sekai_dataobject_anime_series SET cover_url = '/uploads/images/hagaren_poster.png'       WHERE id = 8;

-- 2. 人物立绘（官网角色图 / MAL 官方角色图）
UPDATE sekai_dataobject_anime_character SET image_url = '/uploads/images/shingeki_eren.jpg'     WHERE id = 1;
UPDATE sekai_dataobject_anime_character SET image_url = '/uploads/images/shingeki_mikasa.png'   WHERE id = 2;
UPDATE sekai_dataobject_anime_character SET image_url = '/uploads/images/shingeki_levi.jpg'     WHERE id = 3;
UPDATE sekai_dataobject_anime_character SET image_url = '/uploads/images/shingeki_armin.jpg'    WHERE id = 4;
UPDATE sekai_dataobject_anime_character SET image_url = '/uploads/images/kimetsu_tanjiro.jpg'   WHERE id = 5;
UPDATE sekai_dataobject_anime_character SET image_url = '/uploads/images/kimetsu_nezuko.jpg'    WHERE id = 6;
UPDATE sekai_dataobject_anime_character SET image_url = '/uploads/images/kimetsu_zenitsu.jpg'   WHERE id = 7;
UPDATE sekai_dataobject_anime_character SET image_url = '/uploads/images/kimetsu_giyu.jpg'      WHERE id = 8;
UPDATE sekai_dataobject_anime_character SET image_url = '/uploads/images/spy_anya.jpg'          WHERE id = 9;
UPDATE sekai_dataobject_anime_character SET image_url = '/uploads/images/spy_loid.png'          WHERE id = 10;
UPDATE sekai_dataobject_anime_character SET image_url = '/uploads/images/spy_yor.jpg'           WHERE id = 11;
UPDATE sekai_dataobject_anime_character SET image_url = '/uploads/images/steins_okabe.jpg'      WHERE id = 12;
UPDATE sekai_dataobject_anime_character SET image_url = '/uploads/images/steins_kurisu.jpg'     WHERE id = 13;
UPDATE sekai_dataobject_anime_character SET image_url = '/uploads/images/ghibli_chihiro.jpg'    WHERE id = 14;
UPDATE sekai_dataobject_anime_character SET image_url = '/uploads/images/ghibli_haku.jpg'       WHERE id = 15;
UPDATE sekai_dataobject_anime_character SET image_url = '/uploads/images/kiminona_taki.png'     WHERE id = 16;
UPDATE sekai_dataobject_anime_character SET image_url = '/uploads/images/kiminona_mitsuha.png'  WHERE id = 17;
UPDATE sekai_dataobject_anime_character SET image_url = '/uploads/images/jujutsu_yuji.png'      WHERE id = 18;
UPDATE sekai_dataobject_anime_character SET image_url = '/uploads/images/jujutsu_megumi.png'    WHERE id = 19;
UPDATE sekai_dataobject_anime_character SET image_url = '/uploads/images/jujutsu_nobara.png'    WHERE id = 20;
UPDATE sekai_dataobject_anime_character SET image_url = '/uploads/images/hagaren_edward.jpg'    WHERE id = 21;
UPDATE sekai_dataobject_anime_character SET image_url = '/uploads/images/hagaren_alphonse.jpg'  WHERE id = 22;
UPDATE sekai_dataobject_anime_character SET image_url = '/uploads/images/hagaren_mustang.jpg'   WHERE id = 23;

-- 3. 补充更多官方人物（鬼灭之刃：伊之助/蝴蝶忍/炼狱杏寿郎/宇髄天元；咒术回战：五条悟/两面宿傩）
INSERT INTO sekai_dataobject_anime_character
(series_id, name, original_name, role, voice_actor, description, image_url) VALUES
(2, '嘴平伊之助', '嘴平伊之助', '主角', '松冈祯丞',
 '鬼杀队成员，使用兽之呼吸。头戴野猪头套、性格粗暴直率，双刀流使用者，拥有野兽般的直觉。',
 '/uploads/images/kimetsu_inosuke.jpg'),
(2, '蝴蝶忍', '胡蝶しのぶ', '配角', '早见沙织',
 '鬼杀队虫柱，使用虫之呼吸。表面温柔笑对一切，实际是内心背负深仇的医者，专门研究鬼的弱点。',
 '/uploads/images/kimetsu_shinobu.jpg'),
(2, '炼狱杏寿郎', '煉󠄁獄杏寿郎', '配角', '日野聪',
 '鬼杀队炎柱，使用炎之呼吸。性格豪迈热情、光明磊落，是炭治郎等人尊敬的兄长般的存在。',
 '/uploads/images/kimetsu_rengoku.jpg'),
(2, '宇髄天元', '宇髄天元', '配角', '小西克幸',
 '鬼杀队音柱，使用音之呼吸。自称"华丽"的忍者，曾活跃于忍者界，重视同伴与妻子。',
 '/uploads/images/kimetsu_uzui.jpg'),
(7, '五条悟', '五条悟', '配角', '中村悠一',
 '东京都立咒术高等专门学校教师，现代最强的咒术师。拥有无下限术式与六眼，性格自由奔放。',
 '/uploads/images/jujutsu_gojo.png'),
(7, '两面宿傩', '両面宿傩', '反派', '诹访部顺一',
 '千年前的咒之王，被封印在特级咒物中的存在。以虎杖悠仁的身体为器皿，追求极致的战斗与杀戮。',
 '/uploads/images/jujutsu_sukuna.png');

-- 4. 补充更多官方台词（含原声提示）
INSERT INTO sekai_dataobject_anime_quote
(series_id, character_id, character_name, content, episode, time_point, audio_url) VALUES
(2, 24, '嘴平伊之助', '猪突猛进！猪突猛进！', 2, 420.0, NULL),
(2, 25, '蝴蝶忍', '鬼是有极限的，而我对鬼的憎恨没有极限。', 24, 880.0, NULL),
(2, 26, '炼狱杏寿郎', '心を燃やせ！（燃烧吧，心！）', 25, 600.0, NULL),
(7, 28, '五条悟', '身为最强的我，让一切变得有趣起来吧。', 7, 520.0, NULL),
(4, 12, '冈部伦太郎', '我不是中二病，我是疯狂科学家！', 1, 480.0, NULL),
(3, 11, '约尔·福杰', '只要是为了家人，我会化身为最强。', 1, 900.0, NULL);
