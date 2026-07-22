package com.sekai.draw.lots.util;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public final class CharacterLocalizationUtil {

    private static final Map<String, String> CHARACTER_NAMES = Map.ofEntries(
            Map.entry("Luffy Monkey D.", "蒙奇·D·路飞"),
            Map.entry("Monkey D. Luffy", "蒙奇·D·路飞"),
            Map.entry("Levi", "利威尔"),
            Map.entry("Levi Ackerman", "利威尔·阿克曼"),
            Map.entry("Zoro Roronoa", "罗罗诺亚·索隆"),
            Map.entry("Roronoa Zoro", "罗罗诺亚·索隆"),
            Map.entry("Guts", "格斯"),
            Map.entry("Kurisu Makise", "牧濑红莉栖"),
            Map.entry("Makise Kurisu", "牧濑红莉栖"),
            Map.entry("Satoru Gojou", "五条悟"),
            Map.entry("Gojo Satoru", "五条悟"),
            Map.entry("Ken Kaneki", "金木研"),
            Map.entry("Hachiman Hikigaya", "比企谷八幡"),
            Map.entry("Joseph Joestar", "乔瑟夫·乔斯达"),
            Map.entry("Arataka Reigen", "灵幻新隆"),
            Map.entry("Reigen Arataka", "灵幻新隆"),
            Map.entry("Hitagi Senjougahara", "战场原黑仪"),
            Map.entry("Kazuto Kirigaya", "桐谷和人"),
            Map.entry("Kirito", "桐人"),
            Map.entry("Mai Sakurajima", "樱岛麻衣"),
            Map.entry("Yato", "夜斗"),
            Map.entry("Kiyotaka Ayanokouji", "绫小路清隆"),
            Map.entry("Osamu Dazai", "太宰治"),
            Map.entry("Thorfinn", "托尔芬"),
            Map.entry("Kamina", "卡米那"),
            Map.entry("Eikichi Onizuka", "鬼冢英吉"),
            Map.entry("Shinobu Oshino", "忍野忍"),
            Map.entry("Asuka Langley Souryuu", "明日香·兰格雷"),
            Map.entry("Asuka Langley Soryu", "明日香·兰格雷"),
            Map.entry("Koyomi Araragi", "阿良良木历"),
            Map.entry("Gokuu Son", "孙悟空"),
            Map.entry("Askeladd", "阿谢拉特"),
            Map.entry("Alucard", "阿卡多"),
            Map.entry("Holo", "赫萝"),
            Map.entry("Erwin Smith", "埃尔文·史密斯"),
            Map.entry("Johan Liebert", "约翰·利贝尔特"),
            Map.entry("Joutarou Kuujou", "空条承太郎"),
            Map.entry("Subaru Natsuki", "菜月昴"),
            Map.entry("Tanjirou Kamado", "灶门炭治郎"),
            Map.entry("Tanjiro Kamado", "灶门炭治郎"),
            Map.entry("Kaori Miyazono", "宫园薰"),
            Map.entry("Shouto Todoroki", "轰焦冻"),
            Map.entry("Shoto Todoroki", "轰焦冻"),
            Map.entry("Rin Toosaka", "远坂凛"),
            Map.entry("Rin Tohsaka", "远坂凛"),
            Map.entry("Kusuo Saiki", "齐木楠雄"),
            Map.entry("Katsuki Bakugou", "爆豪胜己"),
            Map.entry("Katsuki Bakugo", "爆豪胜己"),
            Map.entry("Rimuru Tempest", "利姆露·坦佩斯特"),
            Map.entry("Senkuu Ishigami", "石神千空"),
            Map.entry("Senku Ishigami", "石神千空"),
            Map.entry("Robin Nico", "妮可·罗宾"),
            Map.entry("Nico Robin", "妮可·罗宾"),
            Map.entry("Maomao", "猫猫"),
            Map.entry("Emilia", "爱蜜莉雅"),
            Map.entry("Yukino Yukinoshita", "雪之下雪乃"),
            Map.entry("Power", "帕瓦"),
            Map.entry("Revy", "莱薇"),
            Map.entry("Denji", "电次"),
            Map.entry("Houtarou Oreki", "折木奉太郎"),
            Map.entry("Izaya Orihara", "折原临也"),
            Map.entry("Miku Nakano", "中野三玖"),
            Map.entry("Yuu Ishigami", "石上优"),
            Map.entry("Law Trafalgar", "特拉法尔加·罗"),
            Map.entry("Trafalgar Law", "特拉法尔加·罗"),
            Map.entry("Vegeta", "贝吉塔"),
            Map.entry("Kazuma Satou", "佐藤和真"),
            Map.entry("Koro-sensei", "杀老师"),
            Map.entry("Musashi Miyamoto", "宫本武藏"),
            Map.entry("Rikka Takanashi", "小鸟游六花"),
            Map.entry("Gyro Zeppeli", "杰洛·齐贝林"),
            Map.entry("Shouyou Hinata", "日向翔阳"),
            Map.entry("Jin-Woo Sung", "成振宇"),
            Map.entry("Takumi Usui", "碓冰拓海"),
            Map.entry("Meruem", "梅路艾姆"),
            Map.entry("Makima", "玛奇玛"),
            Map.entry("Yuuji Itadori", "虎杖悠仁"),
            Map.entry("Yuji Itadori", "虎杖悠仁"),
            Map.entry("Mikoto Misaka", "御坂美琴"),
            Map.entry("Hitori Gotou", "后藤一里"),
            Map.entry("Hitori Gotoh", "后藤一里"),
            Map.entry("Simon", "西蒙"),
            Map.entry("Kiritsugu Emiya", "卫宫切嗣"),
            Map.entry("Souma Yukihira", "幸平创真"),
            Map.entry("Chopper Tony Tony", "托尼托尼·乔巴"),
            Map.entry("Tony Tony Chopper", "托尼托尼·乔巴"),
            Map.entry("Hei", "黑"),
            Map.entry("Ginko", "银古"),
            Map.entry("Karma Akabane", "赤羽业"),
            Map.entry("Izumi Miyamura", "宫村伊澄"),
            Map.entry("Sakuta Azusagawa", "梓川咲太"),
            Map.entry("Rias Gremory", "莉雅丝·吉蒙里"),
            Map.entry("Yoruichi Shihouin", "四枫院夜一"),
            Map.entry("Erza Scarlet", "艾露莎·舒卡勒托"),
            Map.entry("Hatsune Miku", "初音未来"),
            Map.entry("Akeno Himejima", "姬岛朱乃"),
            Map.entry("Rukia Kuchiki", "朽木露琪亚"),
            Map.entry("Orihime Inoue", "井上织姬"),
            Map.entry("Asuna Yuuki", "结城明日奈"),
            Map.entry("Nami", "娜美"),
            Map.entry("Konata Izumi", "泉此方"),
            Map.entry("Kurumi Tokisaki", "时崎狂三"),
            Map.entry("Sebastian Michaelis", "塞巴斯蒂安·米卡利斯"),
            Map.entry("L Lawliet", "L"),
            Map.entry("Hinata Hyuga", "日向雏田"),
            Map.entry("C.C.", "C.C."),
            Map.entry("Mikasa Ackerman", "三笠·阿克曼"),
            Map.entry("Haruhi Suzumiya", "凉宫春日"),
            Map.entry("Kanade Tachibana", "立华奏"),
            Map.entry("Yuno Gasai", "我妻由乃"),
            Map.entry("Taiga Aisaka", "逢坂大河"),
            Map.entry("Lelouch Lamperouge", "鲁路修·兰佩路基"),
            Map.entry("Saber", "阿尔托莉雅"),
            Map.entry("Boa Hancock", "波雅·汉库克"),
            Map.entry("Rem", "蕾姆"),
            Map.entry("Natsu Dragneel", "纳兹·多拉格尼尔"),
            Map.entry("Yoko Littner", "优子·利特纳"),
            Map.entry("Kakashi Hatake", "旗木卡卡西"),
            Map.entry("Ichigo Kurosaki", "黑崎一护"),
            Map.entry("Marin Kitagawa", "喜多川海梦"),
            Map.entry("Mio Akiyama", "秋山澪"),
            Map.entry("Rei Ayanami", "绫波丽"),
            Map.entry("Megumin", "惠惠"),
            Map.entry("Albedo", "雅儿贝德"),
            Map.entry("Ryuuko Matoi", "缠流子"),
            Map.entry("Juvia Lockser", "朱比亚·洛克丝"),
            Map.entry("Sanji", "山治"),
            Map.entry("Shanks", "香克斯"),
            Map.entry("Naruto Uzumaki", "漩涡鸣人"),
            Map.entry("Sasuke Uchiha", "宇智波佐助"),
            Map.entry("Sakura Haruno", "春野樱"),
            Map.entry("Itachi Uchiha", "宇智波鼬"),
            Map.entry("Shikamaru Nara", "奈良鹿丸"),
            Map.entry("Jiraiya", "自来也"),
            Map.entry("Nezuko Kamado", "灶门祢豆子"),
            Map.entry("Zenitsu Agatsuma", "我妻善逸"),
            Map.entry("Inosuke Hashibira", "嘴平伊之助"),
            Map.entry("Kyojuro Rengoku", "炼狱杏寿郎"),
            Map.entry("Giyu Tomioka", "富冈义勇"),
            Map.entry("Shinobu Kocho", "蝴蝶忍"),
            Map.entry("Eren Yeager", "艾伦·耶格尔"),
            Map.entry("Armin Arlert", "阿尔敏·阿诺德"),
            Map.entry("Hange Zoe", "韩吉·佐耶"),
            Map.entry("Megumi Fushiguro", "伏黑惠"),
            Map.entry("Nobara Kugisaki", "钉崎野蔷薇"),
            Map.entry("Sukuna", "两面宿傩"),
            Map.entry("Killua Zoldyck", "奇犽·揍敌客"),
            Map.entry("Gon Freecss", "小杰·富力士"),
            Map.entry("Kurapika", "酷拉皮卡"),
            Map.entry("Hisoka Morow", "西索"),
            Map.entry("Edward Elric", "爱德华·艾尔利克"),
            Map.entry("Alphonse Elric", "阿尔冯斯·艾尔利克"),
            Map.entry("Roy Mustang", "罗伊·马斯坦"),
            Map.entry("Rintarou Okabe", "冈部伦太郎"),
            Map.entry("Light Yagami", "夜神月"),
            Map.entry("Misa Amane", "弥海砂"),
            Map.entry("Violet Evergarden", "薇尔莉特·伊芙加登"),
            Map.entry("Frieren", "芙莉莲"),
            Map.entry("Fern", "菲伦"),
            Map.entry("Stark", "休塔尔克"),
            Map.entry("Anya Forger", "阿尼亚·福杰"),
            Map.entry("Loid Forger", "劳埃德·福杰"),
            Map.entry("Yor Forger", "约尔·福杰"),
            Map.entry("Chika Fujiwara", "藤原千花"),
            Map.entry("Kaguya Shinomiya", "四宫辉夜"),
            Map.entry("Miyuki Shirogane", "白银御行"),
            Map.entry("Ai Hayasaka", "早坂爱"),
            Map.entry("Nijika Ijichi", "伊地知虹夏"),
            Map.entry("Ryo Yamada", "山田凉"),
            Map.entry("Ikuyo Kita", "喜多郁代"),
            Map.entry("Tohru Honda", "本田透"),
            Map.entry("Kyo Sohma", "草摩夹"),
            Map.entry("Yuki Sohma", "草摩由希"),
            Map.entry("Izuku Midoriya", "绿谷出久"),
            Map.entry("Ochaco Uraraka", "丽日御茶子"),
            Map.entry("All Might", "欧尔麦特"),
            Map.entry("Sailor Moon", "月野兔"),
            Map.entry("Ami Mizuno", "水野亚美"),
            Map.entry("Homura Akemi", "晓美焰"),
            Map.entry("Madoka Kaname", "鹿目圆"),
            Map.entry("Mami Tomoe", "巴麻美"),
            Map.entry("Shinji Ikari", "碇真嗣"),
            Map.entry("Misato Katsuragi", "葛城美里"),
            Map.entry("Spike Spiegel", "斯派克·斯皮格尔"),
            Map.entry("Faye Valentine", "菲·瓦伦坦"),
            Map.entry("Edward Wong", "爱德"),
            Map.entry("Gintoki Sakata", "坂田银时"),
            Map.entry("Kagura", "神乐"),
            Map.entry("Shinra Kusakabe", "森罗日下部"),
            Map.entry("Arthur Boyle", "亚瑟·波义耳"),
            Map.entry("Gen Asagiri", "浅雾幻"),
            Map.entry("Shigeo Kageyama", "影山茂夫"),
            Map.entry("Saitama", "埼玉"),
            Map.entry("Genos", "杰诺斯"),
            Map.entry("Maka Albarn", "玛嘉·阿尔班"),
            Map.entry("Soul Eater Evans", "噬魂·埃文斯"),
            Map.entry("Yumeko Jabami", "蛇喰梦子"),
            Map.entry("Vash the Stampede", "瓦修"),
            Map.entry("Inuyasha", "犬夜叉"),
            Map.entry("Kagome Higurashi", "日暮戈薇"),
            Map.entry("Kikyo", "桔梗"),
            Map.entry("Zero Two", "02"),
            Map.entry("Satoru Fujinuma", "藤沼悟"),
            Map.entry("Kayo Hinazuki", "雏月加代"),
            Map.entry("Tomoya Okazaki", "冈崎朋也"),
            Map.entry("Nagisa Furukawa", "古河渚"),
            Map.entry("Shouko Nishimiya", "西宫硝子"),
            Map.entry("Shouya Ishida", "石田将也"),
            Map.entry("Mitsuha Miyamizu", "宫水三叶"),
            Map.entry("Taki Tachibana", "立花泷"),
            Map.entry("Sophie Hatter", "苏菲·哈特"),
            Map.entry("Howl Jenkins Pendragon", "哈尔")
    );

    private static final Map<String, String> ANIME_TITLES = Map.ofEntries(
            Map.entry("MyAnimeList Top Character", "人气角色榜"),
            Map.entry("High School DxD", "恶魔高校 DxD"),
            Map.entry("Bleach", "死神"),
            Map.entry("Fairy Tail", "妖精的尾巴"),
            Map.entry("Project SEKAI", "世界计划"),
            Map.entry("Sword Art Online", "刀剑神域"),
            Map.entry("One Piece", "航海王"),
            Map.entry("Lucky Star", "幸运星"),
            Map.entry("Date A Live", "约会大作战"),
            Map.entry("Black Butler", "黑执事"),
            Map.entry("Death Note", "死亡笔记"),
            Map.entry("Naruto", "火影忍者"),
            Map.entry("Code Geass", "反叛的鲁路修"),
            Map.entry("Attack on Titan", "进击的巨人"),
            Map.entry("The Melancholy of Haruhi Suzumiya", "凉宫春日的忧郁"),
            Map.entry("Angel Beats", "Angel Beats!"),
            Map.entry("Future Diary", "未来日记"),
            Map.entry("Toradora", "龙与虎"),
            Map.entry("Neon Genesis Evangelion", "新世纪福音战士"),
            Map.entry("Fate Stay Night", "Fate/stay night"),
            Map.entry("Re:Zero", "Re:从零开始的异世界生活"),
            Map.entry("Demon Slayer", "鬼灭之刃"),
            Map.entry("Jujutsu Kaisen", "咒术回战"),
            Map.entry("Hunter x Hunter", "全职猎人"),
            Map.entry("Fullmetal Alchemist", "钢之炼金术师"),
            Map.entry("Steins Gate", "命运石之门"),
            Map.entry("Violet Evergarden", "紫罗兰永恒花园"),
            Map.entry("Frieren Beyond Journeys End", "葬送的芙莉莲"),
            Map.entry("Spy x Family", "间谍过家家"),
            Map.entry("Kaguya-sama Love Is War", "辉夜大小姐想让我告白"),
            Map.entry("Bocchi the Rock", "孤独摇滚"),
            Map.entry("Fruits Basket", "水果篮子"),
            Map.entry("My Hero Academia", "我的英雄学院"),
            Map.entry("Sailor Moon", "美少女战士"),
            Map.entry("Madoka Magica", "魔法少女小圆"),
            Map.entry("Cowboy Bebop", "星际牛仔"),
            Map.entry("Gintama", "银魂"),
            Map.entry("Fire Force", "炎炎消防队"),
            Map.entry("Dr. Stone", "石纪元"),
            Map.entry("Mob Psycho 100", "灵能百分百"),
            Map.entry("One Punch Man", "一拳超人"),
            Map.entry("Soul Eater", "噬魂师"),
            Map.entry("Kakegurui", "狂赌之渊"),
            Map.entry("Trigun", "枪神"),
            Map.entry("Inuyasha", "犬夜叉"),
            Map.entry("Darling in the Franxx", "DARLING in the FRANXX"),
            Map.entry("Erased", "只有我不存在的城市"),
            Map.entry("Clannad", "CLANNAD"),
            Map.entry("A Silent Voice", "声之形"),
            Map.entry("Your Name", "你的名字"),
            Map.entry("Howls Moving Castle", "哈尔的移动城堡"),
            Map.entry("K-On!", "轻音少女"),
            Map.entry("My Dress-Up Darling", "更衣人偶坠入爱河"),
            Map.entry("KonoSuba", "为美好的世界献上祝福"),
            Map.entry("Overlord", "不死者之王"),
            Map.entry("Kill la Kill", "斩服少女"),
            Map.entry("Gurren Lagann", "天元突破")
    );

    private static final Map<String, String> ROLE_TYPES = Map.ofEntries(
            Map.entry("main", "主角"),
            Map.entry("support", "助力伙伴"),
            Map.entry("adventurer", "冒险型"),
            Map.entry("guardian", "守护型"),
            Map.entry("swordsman", "剑士型"),
            Map.entry("mage", "魔法型"),
            Map.entry("detective", "洞察型"),
            Map.entry("assassin", "奇袭型"),
            Map.entry("inventor", "创造型"),
            Map.entry("pilot", "驾驶型"),
            Map.entry("leader", "领袖型"),
            Map.entry("strategist", "策略型"),
            Map.entry("antihero", "反英雄型"),
            Map.entry("alchemist", "炼成型")
    );

    private static final Map<String, String> ENERGY_LABELS = Map.ofEntries(
            Map.entry("Sun", "日光"),
            Map.entry("Steel", "钢铁"),
            Map.entry("Wind", "疾风"),
            Map.entry("Snow", "雪境"),
            Map.entry("Shadow", "暗影"),
            Map.entry("Thunder", "雷鸣"),
            Map.entry("Dream", "梦境"),
            Map.entry("Ocean", "海潮"),
            Map.entry("Time", "时间"),
            Map.entry("Flame", "火焰"),
            Map.entry("Star", "星光"),
            Map.entry("Moon", "月影"),
            Map.entry("bold", "大胆"),
            Map.entry("sharp", "敏锐"),
            Map.entry("heroic", "英勇"),
            Map.entry("bright", "明亮"),
            Map.entry("mystic", "神秘"),
            Map.entry("cool", "冷静"),
            Map.entry("warm", "温暖"),
            Map.entry("focused", "专注"),
            Map.entry("clever", "机敏"),
            Map.entry("playful", "活泼"),
            Map.entry("mysterious", "谜样"),
            Map.entry("elegant", "优雅"),
            Map.entry("analytical", "分析"),
            Map.entry("gentle", "温柔"),
            Map.entry("wise", "智慧"),
            Map.entry("enigmatic", "深邃"),
            Map.entry("steady", "沉稳"),
            Map.entry("electric", "电光"),
            Map.entry("serene", "宁静"),
            Map.entry("intense", "强烈"),
            Map.entry("commanding", "掌控"),
            Map.entry("fierce", "凌厉"),
            Map.entry("noble", "高贵"),
            Map.entry("radiant", "耀眼"),
            Map.entry("devoted", "忠诚"),
            Map.entry("burning", "燃烧"),
            Map.entry("calm", "平静"),
            Map.entry("spark", "火花"),
            Map.entry("precise", "精准"),
            Map.entry("resolute", "坚定"),
            Map.entry("sunny", "晴朗"),
            Map.entry("soft", "柔和"),
            Map.entry("still", "静谧"),
            Map.entry("explosive", "爆裂"),
            Map.entry("majestic", "威仪"),
            Map.entry("wild", "野性"),
            Map.entry("flowing", "流动"),
            Map.entry("free", "自由"),
            Map.entry("iron", "铁意"),
            Map.entry("flame", "焰心"),
            Map.entry("healing", "治愈"),
            Map.entry("balanced", "均衡"),
            Map.entry("bittersweet", "苦甜"),
            Map.entry("blazing", "炽热"),
            Map.entry("brilliant", "闪耀"),
            Map.entry("bubbly", "元气"),
            Map.entry("careful", "谨慎"),
            Map.entry("chaotic", "混沌"),
            Map.entry("clear", "澄澈"),
            Map.entry("cold", "冷峻"),
            Map.entry("composed", "从容"),
            Map.entry("curious", "好奇"),
            Map.entry("dangerous", "危险"),
            Map.entry("delicate", "纤细"),
            Map.entry("determined", "决意"),
            Map.entry("diligent", "勤勉"),
            Map.entry("dramatic", "戏剧"),
            Map.entry("dry", "冷幽默"),
            Map.entry("earnest", "认真"),
            Map.entry("eccentric", "中二"),
            Map.entry("fiery", "火爆"),
            Map.entry("fragile", "脆弱"),
            Map.entry("fresh", "清新"),
            Map.entry("gentle-chaos", "温柔混沌"),
            Map.entry("glimmering", "流光"),
            Map.entry("glowing", "发光"),
            Map.entry("graceful", "优雅"),
            Map.entry("honest", "坦率"),
            Map.entry("hopeful", "希望"),
            Map.entry("human", "人情味"),
            Map.entry("ignited", "点燃"),
            Map.entry("inventive", "发明"),
            Map.entry("lazy-brave", "懒散勇气"),
            Map.entry("legendary", "传说"),
            Map.entry("light", "轻盈"),
            Map.entry("luminous", "月光"),
            Map.entry("melancholy", "忧郁"),
            Map.entry("ominous", "不祥"),
            Map.entry("persistent", "执着"),
            Map.entry("polished", "精密"),
            Map.entry("protective", "守护"),
            Map.entry("quick", "迅捷"),
            Map.entry("quiet", "安静"),
            Map.entry("quiet-power", "静默强力"),
            Map.entry("quirky", "古灵精怪"),
            Map.entry("refined", "清雅"),
            Map.entry("repentant", "悔悟"),
            Map.entry("restless", "躁动"),
            Map.entry("searching", "寻觅"),
            Map.entry("serious", "认真"),
            Map.entry("silver-tongue", "能言善辩"),
            Map.entry("simple", "朴素"),
            Map.entry("slick", "圆滑"),
            Map.entry("smart", "聪慧"),
            Map.entry("solemn", "肃穆"),
            Map.entry("sparkly", "闪闪发亮"),
            Map.entry("stormy", "风暴"),
            Map.entry("strong", "强韧"),
            Map.entry("stylish", "有型"),
            Map.entry("sudden", "瞬发"),
            Map.entry("tender", "柔软"),
            Map.entry("thoughtful", "深思"),
            Map.entry("tranquil", "静水"),
            Map.entry("unpredictable", "不可预测"),
            Map.entry("volatile", "爆裂"),
            Map.entry("wild-sweet", "野性甜味"),
            Map.entry("wistful", "怅然")
    );

    private static final Map<String, String> TAG_LABELS = Map.ofEntries(
            Map.entry("confident", "自信"),
            Map.entry("leader", "领袖"),
            Map.entry("noble", "高贵"),
            Map.entry("fast", "迅捷"),
            Map.entry("mentor", "导师"),
            Map.entry("clever", "机敏"),
            Map.entry("knight", "骑士"),
            Map.entry("discipline", "自律"),
            Map.entry("brave", "勇敢"),
            Map.entry("music", "音乐"),
            Map.entry("virtual singer", "虚拟歌姬"),
            Map.entry("hope", "希望"),
            Map.entry("elegant", "优雅"),
            Map.entry("powerful", "强大"),
            Map.entry("charm", "魅力"),
            Map.entry("soul reaper", "死神"),
            Map.entry("loyal", "忠诚"),
            Map.entry("calm", "冷静"),
            Map.entry("kind", "温柔"),
            Map.entry("healing", "治愈"),
            Map.entry("gentle", "柔和"),
            Map.entry("sword", "剑"),
            Map.entry("courage", "勇气"),
            Map.entry("partner", "伙伴"),
            Map.entry("navigator", "航海士"),
            Map.entry("weather", "天气"),
            Map.entry("otaku", "宅力"),
            Map.entry("playful", "活泼"),
            Map.entry("games", "游戏"),
            Map.entry("time", "时间"),
            Map.entry("gothic", "哥特"),
            Map.entry("mystery", "谜团"),
            Map.entry("butler", "执事"),
            Map.entry("dark", "暗色"),
            Map.entry("detective", "侦探"),
            Map.entry("logic", "逻辑"),
            Map.entry("sweets", "甜食"),
            Map.entry("growth", "成长"),
            Map.entry("pilot", "驾驶员"),
            Map.entry("strategy", "策略"),
            Map.entry("rebellion", "反叛"),
            Map.entry("mask", "面具"),
            Map.entry("devotion", "奉献"),
            Map.entry("blue", "蓝色"),
            Map.entry("maid", "女仆")
    );

    private static final Map<String, String> SEARCH_ALIASES = Map.ofEntries(
            Map.entry("彩月昂", "Subaru Natsuki"),
            Map.entry("菜月昂", "Subaru Natsuki"),
            Map.entry("菜月昴", "Subaru Natsuki"),
            Map.entry("昴", "Subaru Natsuki"),
            Map.entry("路飞", "Monkey D. Luffy"),
            Map.entry("索隆", "Roronoa Zoro"),
            Map.entry("五条", "Gojo Satoru"),
            Map.entry("蕾姆", "Rem"),
            Map.entry("爱蜜莉雅", "Emilia"),
            Map.entry("初音", "Hatsune Miku"),
            Map.entry("桐人", "Kirito"),
            Map.entry("明日奈", "Asuna Yuuki")
    );

    private CharacterLocalizationUtil() {
    }

    public static String displayName(String englishName) {
        return displayFrom(CHARACTER_NAMES, englishName);
    }

    public static String displayAnimeTitle(String animeTitle) {
        return displayFrom(ANIME_TITLES, animeTitle);
    }

    public static String displayRoleType(String roleType) {
        return displayFrom(ROLE_TYPES, roleType);
    }

    public static String displayEnergy(String energy) {
        return displayFrom(ENERGY_LABELS, energy);
    }

    public static String displayTags(String tags, String roleType, String energy) {
        String trimmed = trimToNull(tags);
        if (trimmed == null || trimmed.contains("?")) {
            return displayRoleType(roleType) + " / " + displayEnergy(energy);
        }
        List<String> labels = new ArrayList<>();
        for (String tag : trimmed.split(",")) {
            String normalized = trimToNull(tag);
            if (normalized != null) {
                String label = TAG_LABELS.get(normalized);
                if (label != null) {
                    labels.add(label);
                }
            }
        }
        return labels.isEmpty() ? displayRoleType(roleType) + " / " + displayEnergy(energy) : String.join("、", labels);
    }

    public static List<String> searchTerms(String keyword) {
        String normalized = trimToNull(keyword);
        if (normalized == null) {
            return List.of();
        }
        String lower = normalized.toLowerCase(Locale.ROOT);
        Set<String> terms = new LinkedHashSet<>();
        terms.add(normalized);
        addAlias(terms, normalized);
        collectMatching(terms, lower, CHARACTER_NAMES);
        collectMatching(terms, lower, ANIME_TITLES);
        collectMatching(terms, lower, ROLE_TYPES);
        collectMatching(terms, lower, ENERGY_LABELS);
        return List.copyOf(terms);
    }

    private static void addAlias(Set<String> terms, String keyword) {
        String alias = SEARCH_ALIASES.get(keyword);
        if (alias != null) {
            terms.add(alias);
        }
    }

    private static void collectMatching(Set<String> terms, String lowerKeyword, Map<String, String> dictionary) {
        for (Map.Entry<String, String> entry : dictionary.entrySet()) {
            if (entry.getKey().toLowerCase(Locale.ROOT).contains(lowerKeyword)
                    || entry.getValue().toLowerCase(Locale.ROOT).contains(lowerKeyword)) {
                terms.add(entry.getKey());
                terms.add(entry.getValue());
            }
        }
    }

    private static String displayFrom(Map<String, String> dictionary, String value) {
        String trimmed = trimToNull(value);
        if (trimmed == null) {
            return "";
        }
        return dictionary.getOrDefault(trimmed, trimmed);
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
