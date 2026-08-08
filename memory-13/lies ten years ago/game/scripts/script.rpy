# 游戏的脚本可置于此文件中。

# 声明此游戏使用的角色。颜色参数可使角色姓名着色。

default ai_sprite_mode = False
default event_cg_mode = False
default ai_sprite_outfit = "stage"
default ai_current_expression = "neutral"
default ai_sprite_position = "center"
default ai_last_sprite = None
default story_route = None

init python:
    import store

    def ai_expression_for(what):
        line = str(what)

        expression_keywords = (
            ("speak", ("等等", "走吧", "OK", "太好了", "哦！", "去完", "我和你", "选哪边", "真好啊", "嘻嘻", "嘿嘿", "秘密", "笨蛋", "可恨", "最坏", "错！", "有趣", "保持神秘", "不愧", "胆小", "一级棒", "了不起", "完美", "绝对", "真漂亮", "舒服", "哦～", "哈哈", "喔", "啦", "吧！", "呀", "给。", "拍照", "咔嚓", "太好吃", "全要", "全都", "全部", "贪婪", "美梦", "不行哝", "摇摇晃晃", "那边好香", "还有那家", "吃东西当然", "就那里", "我要这个", "美味的东西", "但会融化", "这个也很幸福", "下午去买蛋糕", "免费的东西", "独一无二", "现在落后了", "也可能", "又去锻炼了", "欢迎回来", "咖啡", "夏天再来", "买一朵", "向日葵", "魔法棒", "花语", "云场池")),
            ("shy", ("谢谢", "抱歉", "对不起", "信你", "嗯嗯", "可以吗", "真美", "难过", "害怕", "各种各样的爱", "诚实", "礼貌", "孤儿", "偶像", "没兴趣", "精神支柱", "记得", "希望", "高兴", "幸福会", "悲伤呢", "孩子也会幸福", "可是，我好像", "今天才不是我的生日", "这样就很好", "人更好看", "不讨厌", "星野的爱")),
            ("surprised", ("？", "?", "哪里", "怎么", "到了", "高崎", "越后汤泽", "为什么", "不饿", "谎言", "凿冰", "未成年", "坐车", "我唱出来了", "一不小心", "不行吗", "蛋糕？", "要。", "每天跑不累", "衣服好看还是人好看", "夏天吗", "八十克", "知道吗")),
        )

        for expression, keywords in expression_keywords:
            if any(keyword in line for keyword in keywords):
                return expression

        return "neutral"

    def ai_sprite_for(what):
        expression = ai_expression_for(what)

        if ai_sprite_outfit == "winter":
            return "heroine winter_%s" % expression

        if ai_sprite_outfit == "autumn":
            return "heroine autumn_%s" % expression

        if ai_sprite_outfit == "karuizawa":
            return "heroine karuizawa_%s" % expression

        # These are story-state sprites: the plot changes the outfit/prop, not keyword-based expression detection.
        fixed_story_sprites = {
            "ch12_hat": "heroine ch12_hat",
            "ch12_sunflower": "heroine ch12_sunflower",
            "ch13_smile": "heroine ch13_smile",
            "ch13_teary": "heroine ch13_teary",
            "ch14_quiet": "heroine ch14_quiet",
            "ch14_departure": "heroine ch14_departure",
            "ch20_spring": "heroine ch20_spring",
            "ch21_secret": "heroine ch21_secret",
            "ch29_practice": "heroine ch29_practice",
            "ch30_practice_tired": "heroine ch30_practice_tired",
        }
        if ai_sprite_outfit in fixed_story_sprites:
            return fixed_story_sprites[ai_sprite_outfit]

        if ai_sprite_outfit == "ch12":
            return "heroine ch12_sunflower"

        if ai_sprite_outfit == "ch13":
            return "heroine ch13_smile"

        if ai_sprite_outfit == "ch14":
            return "heroine ch14_quiet"

        return "heroine stage_%s" % expression

    def ai_sprite_transform():
        if ai_sprite_outfit == "winter":
            return heroine_winter_center

        if ai_sprite_outfit == "autumn":
            autumn_transforms = {
                "left": heroine_autumn_left,
                "right": heroine_autumn_right,
                "near": heroine_autumn_near,
                "far": heroine_autumn_far,
            }
            return autumn_transforms.get(ai_sprite_position, heroine_autumn_center)

        if ai_sprite_outfit == "karuizawa":
            karuizawa_transforms = {
                "left": heroine_karuizawa_left,
                "right": heroine_karuizawa_right,
                "near": heroine_karuizawa_near,
                "far": heroine_karuizawa_far,
            }
            return karuizawa_transforms.get(ai_sprite_position, heroine_karuizawa_center)

        if ai_sprite_outfit in ("ch12", "ch13", "ch14", "ch12_hat", "ch12_sunflower", "ch13_smile", "ch13_teary", "ch14_quiet", "ch14_departure", "ch20_spring", "ch21_secret", "ch29_practice", "ch30_practice_tired"):
            ch12_ch13_transforms = {
                "left": heroine_ch12_ch13_left,
                "right": heroine_ch12_ch13_right,
                "near": heroine_ch12_ch13_near,
                "far": heroine_ch12_ch13_far,
            }
            return ch12_ch13_transforms.get(ai_sprite_position, heroine_ch12_ch13_center)

        return heroine_bust_center

    def ai_stage_callback(event, interact=True, **kwargs):
        if event == "begin":
            expression = ai_expression_for(kwargs.get("what", ""))
            store.ai_current_expression = expression

        if event == "begin" and event_cg_mode:
            if renpy.showing("heroine", layer="master"):
                renpy.hide("heroine", layer="master")
            store.ai_last_sprite = None
            return

        if event == "begin" and ai_sprite_mode:
            sprite = ai_sprite_for(kwargs.get("what", ""))
            if renpy.showing("heroine", layer="master"):
                if store.ai_last_sprite != sprite:
                    renpy.show(sprite, layer="master")
            else:
                renpy.show(sprite, at_list=[ai_sprite_transform()], layer="master")
            store.ai_last_sprite = sprite

define taku = Character("顾天鹏", color="#9fd7ff")
define ai = Character("星野爱", color="#d9c4ff", callback=ai_stage_callback)
define conductor = Character("短发女乘务员", color="#ffe0a3")
define waitress = Character("侍应生", color="#ffe0a3")
define flower_child = Character("卖花的孩子", color="#ffe0a3")
define shop_owner = Character("饰品店老板娘", color="#ffe0a3")
define ai_letter = Character("星野爱的信", color="#d9c4ff")
define snow_staff = Character("工作人员", color="#c7e8ff")
define performer = Character("轻音少女", color="#f0c6ff")
define band_drummer_girl = Character("鼓手少女", color="#ffd6a8")
define band_bassist_girl = Character("贝斯手少女", color="#d5c5ff")
define audience = Character("观众", color="#ffffff")
define yuki = Character("小仓友希", color="#ffd6a8")
define koizumi = Character("小泉花海", color="#ffd6d9")
define maki = Character("寺本真姬", color="#c9e4ff")
define nishida = Character("西田秀树", color="#d5ead5")
define sanae = Character("高峰早苗", color="#ffe0a3")
define ritsuko = Character("二宫律子", color="#e7d5ff")
define mai = Character("渡边麻衣", color="#ffd1ea")
define narrator = Character(None)


transform live_bg_pan:
    subpixel True
    zoom 1.025
    xalign 0.5
    yalign 0.5
    parallel:
        ease 16.0 xalign 0.47
        ease 16.0 xalign 0.53
        repeat
    parallel:
        ease 22.0 yalign 0.49
        ease 22.0 yalign 0.51
        repeat

image bg station_train = At("images/backgrounds/station_train_1920.jpg", live_bg_pan)
image bg rural_station = At("images/backgrounds/rural_station_1920.jpg", live_bg_pan)
image bg station_sunbreak = At("images/backgrounds/bg_station_sunbreak_1920.png", live_bg_pan)
image cg station_hurry_suitcase = "images/backgrounds/cg_station_hurry_suitcase_1920.png"
image cg station_thanks_suitcase = "images/backgrounds/cg_station_thanks_suitcase_1920.png"
image cg train_find_seat = "images/backgrounds/cg_train_find_seat_1920.png"
image cg takasaki_rain_stop = "images/backgrounds/cg_takasaki_rain_stop_1920.png"
image cg train_open_window_rain = "images/backgrounds/cg_train_open_window_rain_1920.png"
image cg train_guidebook = "images/backgrounds/cg_train_guidebook_1920.png"
image cg train_karuizawa_invite = "images/backgrounds/cg_train_karuizawa_invite_1920.png"
image cg train_greedy_girl = "images/backgrounds/cg_train_greedy_girl_1920.png"
image cg train_bento_exchange = "images/backgrounds/cg_train_bento_exchange_1920.png"
image cg train_night_sleep = "images/backgrounds/cg_train_night_sleep_1920.png"
image cg yuzawa_morning_wake = "images/backgrounds/cg_yuzawa_morning_wake_1920.png"
image cg yuzawa_breakfast_crackers = "images/backgrounds/cg_yuzawa_breakfast_crackers_1920.png"
image cg yuzawa_lie_nose = "images/backgrounds/cg_yuzawa_lie_nose_1920.png"
image cg yuzawa_cracker_share = "images/backgrounds/cg_yuzawa_cracker_share_1920.png"
image cg yuzawa_guidebook_together = "images/backgrounds/cg_yuzawa_guidebook_together_1920.png"
image cg ch4_tatami_hiking = "images/backgrounds/cg_ch4_tatami_hiking_1920.png"
image cg ch4_gatsby_reading = "images/backgrounds/cg_ch4_gatsby_reading_1920.png"
image cg ch4_ryokan_lunch = "images/backgrounds/cg_ch4_ryokan_lunch_1920.png"
image cg ch4_genkan_wait = "images/backgrounds/cg_ch4_genkan_wait_1920.png"
image cg ch4_winter_outfit = "images/backgrounds/cg_ch4_winter_outfit_1920.png"
image cg ch4_snow_walk = "images/backgrounds/cg_ch4_snow_walk_1920.png"
image cg ch4_trail_choice = "images/backgrounds/cg_ch4_trail_choice_1920.png"
image cg ch5_summit_ai_sunset = "images/backgrounds/cg_ch5_summit_ai_sunset_1920.png"
image bg ch5_summit_sunset = At("images/backgrounds/bg_ch5_summit_sunset_1920.png", live_bg_pan)
image cg ch5_snow_confession = "images/backgrounds/cg_ch5_snow_confession_1920.png"
image bg ch6_ryokan_terrace_starry = At("images/backgrounds/bg_ch6_ryokan_terrace_starry_1920.png", live_bg_pan)
image cg ch6_ryokan_terrace_ai = "images/backgrounds/cg_ch6_ryokan_terrace_ai_1920.png"
image bg ch6_onsen_night = At("images/backgrounds/bg_ch6_onsen_night_1920.png", live_bg_pan)
image bg ch6_ryokan_genkan_night_snow = At("images/backgrounds/bg_ch6_ryokan_genkan_night_snow_1920.png", live_bg_pan)
image bg ch6_room_fire_warm = At("images/backgrounds/bg_ch6_room_fire_warm_1920.png", live_bg_pan)
image cg ch6_gatsby_reading_night = "images/backgrounds/cg_ch6_gatsby_reading_night_1920.png"
image bg ch6_snow_village_bridge = At("images/backgrounds/bg_ch6_snow_village_bridge_1920.png", live_bg_pan)
image cg ch6_snow_wish_ai = "images/backgrounds/cg_ch6_snow_wish_ai_v2_1920.png"
image bg ch6_soba_shop = At("images/backgrounds/bg_ch6_soba_shop_1920.png", live_bg_pan)
image bg ch6_strawberry_greenhouse = At("images/backgrounds/bg_ch6_strawberry_greenhouse_1920.png", live_bg_pan)
image bg ch6_onsen_street_moon = At("images/backgrounds/bg_ch6_onsen_street_moon_1920.png", live_bg_pan)
image bg ch6_summit_starry = At("images/backgrounds/bg_ch6_summit_starry_1920.png", live_bg_pan)
image bg ch6_village_moon = At("images/backgrounds/bg_ch6_village_moon_1920.png", live_bg_pan)
image cg ch6_moonlit_ai = "images/backgrounds/cg_ch6_moonlit_ai_v2_1920.png"
image cg ch6_starry_ai = "images/backgrounds/cg_ch6_starry_ai_1920.png"
image bg ch7_ryokan_breakfast = At("images/backgrounds/bg_ch7_ryokan_breakfast_1920.png", live_bg_pan)
image bg ch7_snowy_run_road = At("images/backgrounds/bg_ch7_snowy_run_road_1920.png", live_bg_pan)
image bg ch7_cafe = At("images/backgrounds/bg_ch7_cafe_1920.png", live_bg_pan)
image bg ch7_cafe_street = At("images/backgrounds/bg_ch7_cafe_street_1920.png", live_bg_pan)
image bg ch7_deer_snowfield = At("images/backgrounds/bg_ch7_deer_snowfield_1920.png", live_bg_pan)
image bg ch7_souvenir_shop = At("images/backgrounds/bg_ch7_souvenir_shop_1920.png", live_bg_pan)
image bg ch7_student_stage_night = At("images/backgrounds/bg_ch7_student_stage_night_1920.png", live_bg_pan)
image bg ch7_band_soundcheck = At("images/backgrounds/bg_ch7_band_soundcheck_1920.png", live_bg_pan)
image bg ch7_band_performance = At("images/backgrounds/bg_ch7_band_performance_1920.png", live_bg_pan)
image bg ch7_band_aftermath = At("images/backgrounds/bg_ch7_band_aftermath_1920.png", live_bg_pan)
image bg ch7_village_moon_path = At("images/backgrounds/bg_ch7_village_moon_path_1920.png", live_bg_pan)
image bg ch7_rainy_ryokan_room = At("images/backgrounds/bg_ch7_rainy_ryokan_room_1920.png", live_bg_pan)
image bg ch8_ryokan_breakfast = At("images/backgrounds/bg_ch8_ryokan_breakfast_1920.png", live_bg_pan)
image bg ch8_cafe = At("images/backgrounds/bg_ch8_cafe_1920.png", live_bg_pan)
image bg ch8_cafe_street = At("images/backgrounds/bg_ch8_cafe_street_1920.png", live_bg_pan)
image bg ch8_takoyaki_vending = At("images/backgrounds/bg_ch8_takoyaki_vending_1920.png", live_bg_pan)
image bg ch8_kite_field = At("images/backgrounds/bg_ch8_kite_field_1920.png", live_bg_pan)
image bg ch8_ski_slope = At("images/backgrounds/bg_ch8_ski_slope_1920.png", live_bg_pan)
image bg ch8_shrine_dusk = At("images/backgrounds/bg_ch8_shrine_dusk_1920.png", live_bg_pan)
image bg ch8_ryokan_room_moon = At("images/backgrounds/bg_ch8_ryokan_room_moon_1920.png", live_bg_pan)
image bg ch8_station_morning = At("images/backgrounds/bg_ch8_station_morning_1920.png", live_bg_pan)
image cg ch8_ryokan_breakfast_wave = "images/backgrounds/cg_ch8_ryokan_breakfast_wave_1920.png"
image cg ch8_cafe_photo = "images/backgrounds/cg_ch8_cafe_photo_1920.png"
image cg ch8_cafe_photo_alt = "images/backgrounds/cg_ch8_cafe_photo_alt_1920.png"
image cg ch8_takoyaki_ai = "images/backgrounds/cg_ch8_takoyaki_ai_1920.png"
image cg ch8_kite_run_ai = "images/backgrounds/cg_ch8_kite_run_ai_1920.png"
image cg ch8_moonlit_smile = "images/backgrounds/cg_ch8_moonlit_smile_1920.png"
image cg ch8_futon_talk_ai = "images/backgrounds/cg_ch8_futon_talk_ai_1920.png"
image bg ch9_yuzawa_last_night_room = At("images/backgrounds/bg_ch9_yuzawa_last_night_room_1920.png", live_bg_pan)
image bg ch9_train_autumn_window = At("images/backgrounds/bg_ch9_train_autumn_window_1920.png", live_bg_pan)
image bg ch9_karuizawa_bus_stop = At("images/backgrounds/bg_ch9_karuizawa_bus_stop_1920.png", live_bg_pan)
image bg ch9_forest_inn_path = At("images/backgrounds/bg_ch9_forest_inn_path_1920.png", live_bg_pan)
image bg ch9_bicycle_rental = At("images/backgrounds/bg_ch9_bicycle_rental_1920.png", live_bg_pan)
image bg ch9_autumn_cycling_lane = At("images/backgrounds/bg_ch9_autumn_cycling_lane_1920.png", live_bg_pan)
image bg ch9_roadside_steps = At("images/backgrounds/bg_ch9_roadside_steps_1920.png", live_bg_pan)
image cg ch9_futon_night_talk = "images/backgrounds/cg_ch9_futon_night_talk_1920.png"
image cg ch9_train_humming = "images/backgrounds/cg_ch9_train_humming_1920.png"
image cg ch9_autumn_arrival = "images/backgrounds/cg_ch9_autumn_arrival_1920.png"
image cg ch9_bicycle_ride = "images/backgrounds/cg_ch9_bicycle_ride_1920.png"
image cg ch9_leaf_sunlight = "images/backgrounds/cg_ch9_leaf_sunlight_1920.png"
image cg ch9_autumn_promise = "images/backgrounds/cg_ch9_autumn_promise_1920.png"
image bg ch10_old_karuizawa_street = At("images/backgrounds/bg_ch10_old_karuizawa_street_1920.png", live_bg_pan)
image bg ch10_ice_cream_shop = At("images/backgrounds/bg_ch10_ice_cream_shop_1920.png", live_bg_pan)
image cg ch10_ice_cream_walk = "images/backgrounds/cg_ch10_ice_cream_walk_1920.png"
image bg ch10_white_church_wedding = At("images/backgrounds/bg_ch10_white_church_wedding_1920.png", live_bg_pan)
image bg ch10_lunch_restaurant = At("images/backgrounds/bg_ch10_lunch_restaurant_1920.png", live_bg_pan)
image bg ch10_cake_shop = At("images/backgrounds/bg_ch10_cake_shop_1920.png", live_bg_pan)
image bg ch10_forest_sunset_path = At("images/backgrounds/bg_ch10_forest_sunset_path_1920.png", live_bg_pan)
image bg ch10_inn_evening_room = At("images/backgrounds/bg_ch10_inn_evening_room_1920.png", live_bg_pan)
image cg ch10_birthday_cake_candles = "images/backgrounds/cg_ch10_birthday_cake_candles_1920.png"
image cg ch10_night_cake_still = "images/backgrounds/cg_ch10_night_cake_still_1920.png"
image bg ch11_birch_morning_run = At("images/backgrounds/bg_ch11_birch_morning_run_1920.png", live_bg_pan)
image bg ch11_inn_morning_room = At("images/backgrounds/bg_ch11_inn_morning_room_1920.png", live_bg_pan)
image bg ch11_breakfast_cafe = At("images/backgrounds/bg_ch11_breakfast_cafe_1920.png", live_bg_pan)
image bg ch11_outlet_plaza = At("images/backgrounds/bg_ch11_outlet_plaza_1920.png", live_bg_pan)
image bg ch11_riverside_meadow = At("images/backgrounds/bg_ch11_riverside_meadow_1920.png", live_bg_pan)
image bg ch11_flower_stand = At("images/backgrounds/bg_ch11_flower_stand_1920.png", live_bg_pan)
image bg ch11_street_food_tomatoes = At("images/backgrounds/bg_ch11_street_food_tomatoes_1920.png", live_bg_pan)
image bg ch11_kumoba_pond_path = At("images/backgrounds/bg_ch11_kumoba_pond_path_1920.png", live_bg_pan)
image bg ch12_kumoba_pond = At("images/backgrounds/bg_ch12_kumoba_pond_1920.png", live_bg_pan)
image bg ch13_miharashidai_sunset = At("images/backgrounds/bg_ch13_miharashidai_sunset_1920.png", live_bg_pan)
image bg ch14_roadside_bench_night = At("images/backgrounds/bg_ch14_roadside_bench_night_1920.png", live_bg_pan)
image cg ch11_tshirt_tryon = "images/backgrounds/cg_ch11_tshirt_tryon_1920.png"
image cg ch11_sunflower_language = "images/backgrounds/cg_ch11_sunflower_language_1920.png"
image cg ch15_empty_room_letter = "images/backgrounds/cg_ch15_empty_room_letter_1920.png"
image cg ch16_photo_desk_night = "images/backgrounds/cg_ch16_photo_desk_night_1920.png"
image bg ch17_pet_shop = At("images/backgrounds/bg_ch17_pet_shop_1920.png", live_bg_pan)
image bg ch18_pet_shop_rain = At("images/backgrounds/bg_ch18_pet_shop_rain_1920.png", live_bg_pan)
image bg ch18_ice_cream_shop = At("images/backgrounds/bg_ch18_ice_cream_shop_1920.png", live_bg_pan)
image bg ch19_cinema_lobby = At("images/backgrounds/bg_ch19_cinema_lobby_1920.png", live_bg_pan)
image bg ch20_karuizawa_station_winter = At("images/backgrounds/bg_ch20_karuizawa_station_winter_1920.png", live_bg_pan)
image cg ch20_sakura_reunion = "images/backgrounds/cg_ch20_sakura_reunion_1920.png"
image bg ch20_sakura_slope = At("images/backgrounds/bg_ch20_sakura_slope_1920.png", live_bg_pan)
image bg ch22_shibuya_spring = At("images/backgrounds/bg_ch22_shibuya_spring_1920.png", live_bg_pan)
image bg ch23_tokyo_cafe_day = At("images/backgrounds/bg_ch23_tokyo_cafe_day_1920.png", live_bg_pan)
image bg ch23_tokyo_cafe_night = At("images/backgrounds/bg_ch23_tokyo_cafe_night_1920.png", live_bg_pan)
image bg ch25_library_sunset = At("images/backgrounds/bg_ch25_library_sunset_1920.png", live_bg_pan)
image bg ch28_music_street = At("images/backgrounds/bg_ch28_music_street_1920.png", live_bg_pan)
image bg ch28_ochanomizu_steps = At("images/backgrounds/bg_ch28_ochanomizu_steps_1920.png", live_bg_pan)
image bg ch30_apartment_phone = At("images/backgrounds/bg_ch30_apartment_phone_1920.png", live_bg_pan)
image cg ch17_yuki_coffee_cat = "images/backgrounds/cg_ch17_yuki_coffee_cat_1920.png"
image cg ch19_yuki_movie_tears = "images/backgrounds/cg_ch19_yuki_movie_tears_1920.png"
image cg ch20_yuki_station_gift = "images/backgrounds/cg_ch20_yuki_station_gift_1920.png"
image cg ch21_ai_photo_contact = "images/backgrounds/cg_ch21_ai_photo_contact_1920.png"
image cg ch26_ai_cafe_lie = "images/backgrounds/cg_ch26_ai_cafe_lie_1920.png"
image cg ch29_idol_practice = "images/backgrounds/cg_ch29_idol_practice_1920.png"
image cg ch30_ai_secret_training = "images/backgrounds/cg_ch30_ai_secret_training_1920.png"
image band_guitarist = "images/band/band_guitarist.png"
image band_bassist = "images/band/band_bassist.png"
image band_keyboardist = "images/band/band_keyboardist.png"
image band_drummer = "images/band/band_drummer.png"
image cg train_table_chat = "images/backgrounds/bg_train_table_chat_1920.png"
image bg train_car = At("images/backgrounds/bg_train_car_1920.png", live_bg_pan)
image bg train_table = At("images/backgrounds/bg_train_table_1920.png", live_bg_pan)
image bg train_table_window = At("images/backgrounds/bg_train_table_window_1920.png", live_bg_pan)
image bg train_table_rain = At("images/backgrounds/bg_train_table_rain_1920.png", live_bg_pan)
image bg train_table_night = At("images/backgrounds/bg_train_table_night_1920.png", live_bg_pan)
image bg train_table_snow_morning = At("images/backgrounds/bg_train_table_snow_morning_1920.png", live_bg_pan)
image bg lake_bridge = At("images/backgrounds/bg_lake_bridge_1920.png", live_bg_pan)
image bg train_mountains = At("images/backgrounds/bg_train_mountains_1920.png", live_bg_pan)
image bg ryokan_room = At("images/backgrounds/bg_ryokan_room_window_1920.png", live_bg_pan)
image bg ryokan_dining = At("images/backgrounds/bg_ryokan_dining_window_1920.png", live_bg_pan)
image bg ryokan_genkan = At("images/backgrounds/bg_ryokan_genkan_view_1920.png", live_bg_pan)
image bg snow_village_path = At("images/backgrounds/bg_snow_village_path_1920.png", live_bg_pan)
image bg forest_trail_left = At("images/backgrounds/bg_forest_trail_left_1920.png", live_bg_pan)
image bg forest_trail_right = At("images/backgrounds/bg_forest_trail_right_1920.png", live_bg_pan)
image bg ch5_forest_midtrail = At("images/backgrounds/bg_ch5_forest_midtrail_1920.png", live_bg_pan)
image bg ch5_forest_clearing = At("images/backgrounds/bg_ch5_forest_clearing_1920.png", live_bg_pan)
image heroine normal = "images/heroine.png"
image heroine travel_normal = "images/heroine/ai_travel_normal.png"
image heroine travel_surprised = "images/heroine/ai_travel_surprised.png"
image heroine travel_wave_suitcase = "images/heroine/ai_travel_wave_suitcase.png"
image heroine travel_shy = "images/heroine/ai_travel_shy.png"
image heroine travel_playful = "images/heroine/ai_travel_playful.png"
image heroine stage_neutral = "images/heroine/stage/ai_stage_neutral.png"
image heroine stage_speak = "images/heroine/stage/ai_stage_speak.png"
image heroine stage_shy = "images/heroine/stage/ai_stage_shy.png"
image heroine stage_surprised = "images/heroine/stage/ai_stage_surprised.png"

image heroine winter_neutral = "images/heroine/winter/ai_winter_bust_neutral.png"
image heroine winter_speak = "images/heroine/winter/ai_winter_bust_speak.png"
image heroine winter_shy = "images/heroine/winter/ai_winter_bust_shy.png"
image heroine winter_surprised = "images/heroine/winter/ai_winter_bust_surprised.png"

image heroine autumn_neutral = Crop((0, 0, 626, 690), "images/heroine/autumn_bust/ai_autumn_bust_neutral.png")
image heroine autumn_speak = Crop((0, 0, 746, 690), "images/heroine/autumn_bust/ai_autumn_bust_speak.png")
image heroine autumn_shy = Crop((0, 0, 815, 690), "images/heroine/autumn_bust/ai_autumn_bust_shy.png")
image heroine autumn_surprised = Crop((0, 0, 864, 690), "images/heroine/autumn_bust/ai_autumn_bust_surprised.png")

image heroine karuizawa_neutral = Crop((0, 0, 626, 690), "images/heroine/autumn_bust/ai_autumn_bust_neutral.png")
image heroine karuizawa_speak = Crop((0, 0, 746, 690), "images/heroine/autumn_bust/ai_autumn_bust_speak.png")
image heroine karuizawa_shy = Crop((0, 0, 815, 690), "images/heroine/autumn_bust/ai_autumn_bust_shy.png")
image heroine karuizawa_surprised = Crop((0, 0, 864, 690), "images/heroine/autumn_bust/ai_autumn_bust_surprised.png")

image heroine ch12_hat = "images/heroine/ch12_ch13/ai_ch12_hat_delighted.png"
image heroine ch12_sunflower = "images/heroine/ch12_ch13/ai_ch12_sunflower_soft.png"
image heroine ch13_smile = "images/heroine/ch12_ch13/ai_ch13_swing_smile.png"
image heroine ch13_teary = "images/heroine/ch12_ch13/ai_ch13_teary_apology.png"
image heroine ch14_quiet = "images/heroine/ch14_ch16/ai_ch14_moonlit_quiet.png"
image heroine ch14_departure = "images/heroine/ch14_ch16/ai_ch14_departure_suitcase.png"
image heroine ch20_spring = "images/heroine/ch17_ch30/ai_ch20_spring_casual.png"
image heroine ch21_secret = "images/heroine/ch17_ch30/ai_ch21_secret.png"
image heroine ch29_practice = Crop((0, 0, 885, 1120), "images/heroine/ch17_ch30/ai_ch29_practice.png")
image heroine ch30_practice_tired = Crop((0, 0, 853, 1120), "images/heroine/ch17_ch30/ai_ch30_practice_tired.png")
image yuki petshop = Crop((0, 0, 852, 1120), "images/heroine/ch17_ch30/yuki_petshop.png")
image yuki tissue = Crop((0, 0, 852, 1120), "images/heroine/ch17_ch30/yuki_petshop_tissue.png")
image yuki phone = Crop((0, 0, 864, 1120), "images/heroine/ch17_ch30/yuki_phone.png")
image koizumi cafe = Crop((0, 0, 852, 1120), "images/heroine/ch17_ch30/koizumi_cafe.png")
image koizumi tray = Crop((0, 0, 840, 1120), "images/heroine/ch17_ch30/koizumi_tray_shy.png")
image koizumi reach = Crop((0, 0, 887, 1120), "images/heroine/ch17_ch30/koizumi_reach.png")
image maki cafe = Crop((0, 0, 852, 1120), "images/heroine/ch17_ch30/maki_cafe.png")
image maki teach = Crop((0, 0, 850, 1120), "images/heroine/ch17_ch30/maki_teach.png")
image maki movie = Crop((0, 0, 864, 1120), "images/heroine/ch17_ch30/maki_movie.png")
image nishida cafe = Crop((0, 0, 832, 1120), "images/heroine/ch17_ch30/nishida_cafe.png")
image sanae practice = Crop((0, 0, 922, 1120), "images/heroine/ch17_ch30/sanae_practice.png")
image ritsuko practice = Crop((0, 0, 836, 1120), "images/heroine/ch17_ch30/ritsuko_practice.png")
image mai practice = Crop((0, 0, 838, 1120), "images/heroine/ch17_ch30/mai_practice.png")

transform cast_single_center:
    subpixel True
    zoom 1.05
    xalign 0.52
    yalign 1.0
    xoffset -4
    yoffset 82
    rotate -0.28
    parallel:
        easeout 0.32 yoffset 58
        ease 0.90 yoffset 54
        ease 0.78 yoffset 59
        ease 0.95 yoffset 56
        ease 1.10 yoffset 60
    parallel:
        ease 0.48 xoffset 3
        ease 0.82 xoffset -2
        ease 1.05 xoffset 2
        ease 1.00 xoffset 0
    parallel:
        ease 0.62 rotate 0.20
        ease 1.00 rotate -0.10
        ease 1.08 rotate 0.06
        ease 0.95 rotate 0
    parallel:
        ease 0.70 zoom 1.060
        ease 1.15 zoom 1.052
        ease 1.05 zoom 1.057
        ease 0.90 zoom 1.05

transform cast_left:
    subpixel True
    zoom 0.88
    xalign 0.22
    yalign 1.0
    xoffset -3
    yoffset 84
    rotate -0.22
    parallel:
        easeout 0.30 yoffset 70
        ease 0.82 yoffset 76
        ease 0.95 yoffset 74
    parallel:
        ease 0.48 xoffset 2
        ease 0.82 xoffset -1
        ease 1.00 xoffset 0
    parallel:
        ease 0.50 rotate 0.14
        ease 0.90 rotate 0
    parallel:
        ease 0.70 zoom 0.886
        ease 1.05 zoom 0.883
        ease 0.90 zoom 0.88

transform cast_center:
    subpixel True
    zoom 0.86
    xalign 0.52
    yalign 1.0
    xoffset -2
    yoffset 84
    rotate -0.18
    parallel:
        easeout 0.30 yoffset 70
        ease 0.80 yoffset 76
        ease 0.95 yoffset 74
    parallel:
        ease 0.48 xoffset 2
        ease 0.82 xoffset -1
        ease 1.00 xoffset 0
    parallel:
        ease 0.50 rotate 0.10
        ease 0.90 rotate 0
    parallel:
        ease 0.70 zoom 0.866
        ease 1.05 zoom 0.863
        ease 0.90 zoom 0.86

transform cast_right:
    subpixel True
    zoom 0.86
    xalign 0.74
    yalign 1.0
    xoffset 2
    yoffset 84
    rotate 0.22
    parallel:
        easeout 0.30 yoffset 70
        ease 0.80 yoffset 76
        ease 0.95 yoffset 74
    parallel:
        ease 0.48 xoffset -2
        ease 0.82 xoffset 1
        ease 1.00 xoffset 0
    parallel:
        ease 0.50 rotate -0.12
        ease 0.90 rotate 0
    parallel:
        ease 0.70 zoom 0.866
        ease 1.05 zoom 0.863
        ease 0.90 zoom 0.86

transform cast_far_right:
    subpixel True
    zoom 0.72
    xalign 0.98
    yalign 1.0
    xoffset 2
    yoffset 88
    rotate 0.20
    parallel:
        easeout 0.30 yoffset 74
        ease 0.80 yoffset 80
        ease 0.95 yoffset 78
    parallel:
        ease 0.48 xoffset -2
        ease 0.82 xoffset 1
        ease 1.00 xoffset 0
    parallel:
        ease 0.50 rotate -0.10
        ease 0.90 rotate 0
    parallel:
        ease 0.70 zoom 0.725
        ease 1.05 zoom 0.722
        ease 0.90 zoom 0.72

transform cast_group_left:
    subpixel True
    zoom 0.74
    xalign 0.10
    yalign 1.0
    xoffset -2
    yoffset 86
    rotate -0.14
    parallel:
        easeout 0.28 yoffset 74
        ease 0.78 yoffset 80
        ease 0.90 yoffset 78
    parallel:
        ease 0.46 xoffset 2
        ease 0.82 xoffset -1
        ease 0.92 xoffset 0
    parallel:
        ease 0.50 rotate 0.08
        ease 0.85 rotate 0
    parallel:
        ease 0.66 zoom 0.745
        ease 0.95 zoom 0.742
        ease 0.86 zoom 0.74

transform cast_group_midleft:
    subpixel True
    zoom 0.74
    xalign 0.36
    yalign 1.0
    xoffset -1
    yoffset 86
    rotate -0.08
    parallel:
        easeout 0.28 yoffset 74
        ease 0.78 yoffset 80
        ease 0.90 yoffset 78
    parallel:
        ease 0.46 xoffset 1
        ease 0.82 xoffset -1
        ease 0.92 xoffset 0
    parallel:
        ease 0.50 rotate 0.06
        ease 0.85 rotate 0
    parallel:
        ease 0.66 zoom 0.745
        ease 0.95 zoom 0.742
        ease 0.86 zoom 0.74

transform cast_group_midright:
    subpixel True
    zoom 0.74
    xalign 0.62
    yalign 1.0
    xoffset 1
    yoffset 86
    rotate 0.08
    parallel:
        easeout 0.28 yoffset 74
        ease 0.78 yoffset 80
        ease 0.90 yoffset 78
    parallel:
        ease 0.46 xoffset -1
        ease 0.82 xoffset 1
        ease 0.92 xoffset 0
    parallel:
        ease 0.50 rotate -0.06
        ease 0.85 rotate 0
    parallel:
        ease 0.66 zoom 0.745
        ease 0.95 zoom 0.742
        ease 0.86 zoom 0.74

transform cast_group_right:
    subpixel True
    zoom 0.74
    xalign 0.88
    yalign 1.0
    xoffset 2
    yoffset 86
    rotate 0.14
    parallel:
        easeout 0.28 yoffset 74
        ease 0.78 yoffset 80
        ease 0.90 yoffset 78
    parallel:
        ease 0.46 xoffset -2
        ease 0.82 xoffset 1
        ease 0.92 xoffset 0
    parallel:
        ease 0.50 rotate -0.08
        ease 0.85 rotate 0
    parallel:
        ease 0.66 zoom 0.745
        ease 0.95 zoom 0.742
        ease 0.86 zoom 0.74

transform heroine_full:
    subpixel True
    zoom 0.55
    xalign 0.5
    yalign 1.0
    xoffset -4
    yoffset 72
    rotate -0.35
    parallel:
        easeout 0.32 yoffset 60
        ease 0.90 yoffset 56
        ease 0.78 yoffset 59
        ease 0.95 yoffset 57
        ease 1.10 yoffset 60
    parallel:
        ease 0.48 xoffset 2
        ease 0.82 xoffset -1
        ease 1.05 xoffset 1
        ease 1.00 xoffset 0
    parallel:
        ease 0.62 rotate 0.25
        ease 1.00 rotate -0.14
        ease 1.08 rotate 0.08
        ease 0.95 rotate 0
    parallel:
        ease 0.70 zoom 0.554
        ease 1.15 zoom 0.551
        ease 1.05 zoom 0.553
        ease 0.90 zoom 0.55

transform heroine_bust_center:
    subpixel True
    zoom 1.05
    xalign 0.56
    yalign 1.0
    xoffset -5
    yoffset 72
    rotate -0.38
    parallel:
        easeout 0.32 yoffset 60
        ease 0.90 yoffset 54
        ease 0.78 yoffset 59
        ease 0.95 yoffset 56
        ease 1.10 yoffset 60
    parallel:
        ease 0.48 xoffset 3
        ease 0.82 xoffset -2
        ease 1.05 xoffset 2
        ease 1.00 xoffset 0
    parallel:
        ease 0.62 rotate 0.28
        ease 1.00 rotate -0.16
        ease 1.08 rotate 0.10
        ease 0.95 rotate 0
    parallel:
        ease 0.70 zoom 1.058
        ease 1.15 zoom 1.052
        ease 1.05 zoom 1.056
        ease 0.90 zoom 1.05

transform heroine_winter_center:
    subpixel True
    zoom 1.05
    xalign 0.56
    yalign 1.0
    xoffset -5
    yoffset 72
    rotate -0.38
    parallel:
        easeout 0.32 yoffset 60
        ease 0.90 yoffset 54
        ease 0.78 yoffset 59
        ease 0.95 yoffset 56
        ease 1.10 yoffset 60
    parallel:
        ease 0.48 xoffset 3
        ease 0.82 xoffset -2
        ease 1.05 xoffset 2
        ease 1.00 xoffset 0
    parallel:
        ease 0.62 rotate 0.28
        ease 1.00 rotate -0.16
        ease 1.08 rotate 0.10
        ease 0.95 rotate 0
    parallel:
        ease 0.70 zoom 1.058
        ease 1.15 zoom 1.052
        ease 1.05 zoom 1.056
        ease 0.90 zoom 1.05

transform heroine_autumn_center:
    subpixel True
    zoom 1.45
    xalign 0.56
    yalign 1.0
    xoffset -5
    yoffset 72
    rotate -0.34
    parallel:
        easeout 0.32 yoffset 60
        ease 0.90 yoffset 54
        ease 0.78 yoffset 59
        ease 0.95 yoffset 56
        ease 1.10 yoffset 60
    parallel:
        ease 0.48 xoffset 3
        ease 0.82 xoffset -2
        ease 1.05 xoffset 2
        ease 1.00 xoffset 0
    parallel:
        ease 0.62 rotate 0.24
        ease 1.00 rotate -0.14
        ease 1.08 rotate 0.08
        ease 0.95 rotate 0
    parallel:
        ease 0.70 zoom 1.460
        ease 1.15 zoom 1.453
        ease 1.05 zoom 1.458
        ease 0.90 zoom 1.45

transform heroine_autumn_left:
    subpixel True
    zoom 1.36
    xalign 0.36
    yalign 1.0
    xoffset -5
    yoffset 72
    rotate -0.34
    parallel:
        easeout 0.32 yoffset 60
        ease 0.90 yoffset 54
        ease 0.78 yoffset 59
        ease 0.95 yoffset 56
        ease 1.10 yoffset 60
    parallel:
        ease 0.48 xoffset 3
        ease 0.82 xoffset -2
        ease 1.05 xoffset 2
        ease 1.00 xoffset 0
    parallel:
        ease 0.62 rotate 0.24
        ease 1.00 rotate -0.14
        ease 1.08 rotate 0.08
        ease 0.95 rotate 0
    parallel:
        ease 0.70 zoom 1.369
        ease 1.15 zoom 1.363
        ease 1.05 zoom 1.367
        ease 0.90 zoom 1.36

transform heroine_autumn_right:
    subpixel True
    zoom 1.36
    xalign 0.74
    yalign 1.0
    xoffset -5
    yoffset 72
    rotate -0.34
    parallel:
        easeout 0.32 yoffset 60
        ease 0.90 yoffset 54
        ease 0.78 yoffset 59
        ease 0.95 yoffset 56
        ease 1.10 yoffset 60
    parallel:
        ease 0.48 xoffset 3
        ease 0.82 xoffset -2
        ease 1.05 xoffset 2
        ease 1.00 xoffset 0
    parallel:
        ease 0.62 rotate 0.24
        ease 1.00 rotate -0.14
        ease 1.08 rotate 0.08
        ease 0.95 rotate 0
    parallel:
        ease 0.70 zoom 1.369
        ease 1.15 zoom 1.363
        ease 1.05 zoom 1.367
        ease 0.90 zoom 1.36

transform heroine_autumn_near:
    subpixel True
    zoom 1.54
    xalign 0.56
    yalign 1.0
    xoffset -5
    yoffset 72
    rotate -0.30
    parallel:
        easeout 0.32 yoffset 60
        ease 0.90 yoffset 54
        ease 0.78 yoffset 59
        ease 0.95 yoffset 56
        ease 1.10 yoffset 60
    parallel:
        ease 0.48 xoffset 3
        ease 0.82 xoffset -2
        ease 1.05 xoffset 2
        ease 1.00 xoffset 0
    parallel:
        ease 0.62 rotate 0.22
        ease 1.00 rotate -0.12
        ease 1.08 rotate 0.07
        ease 0.95 rotate 0
    parallel:
        ease 0.70 zoom 1.550
        ease 1.15 zoom 1.543
        ease 1.05 zoom 1.548
        ease 0.90 zoom 1.54

transform heroine_autumn_far:
    subpixel True
    zoom 1.28
    xalign 0.56
    yalign 1.0
    xoffset -4
    yoffset 66
    rotate -0.32
    parallel:
        easeout 0.32 yoffset 60
        ease 0.90 yoffset 56
        ease 0.78 yoffset 59
        ease 0.95 yoffset 57
        ease 1.10 yoffset 60
    parallel:
        ease 0.48 xoffset 2
        ease 0.82 xoffset -1
        ease 1.05 xoffset 1
        ease 1.00 xoffset 0
    parallel:
        ease 0.62 rotate 0.22
        ease 1.00 rotate -0.12
        ease 1.08 rotate 0.07
        ease 0.95 rotate 0
    parallel:
        ease 0.70 zoom 1.288
        ease 1.15 zoom 1.282
        ease 1.05 zoom 1.286
        ease 0.90 zoom 1.28

transform heroine_karuizawa_center:
    subpixel True
    zoom 1.45
    xalign 0.56
    yalign 1.0
    xoffset -5
    yoffset 72
    rotate -0.34
    parallel:
        easeout 0.32 yoffset 60
        ease 0.90 yoffset 54
        ease 0.78 yoffset 59
        ease 0.95 yoffset 56
        ease 1.10 yoffset 60
    parallel:
        ease 0.48 xoffset 3
        ease 0.82 xoffset -2
        ease 1.05 xoffset 2
        ease 1.00 xoffset 0
    parallel:
        ease 0.62 rotate 0.24
        ease 1.00 rotate -0.14
        ease 1.08 rotate 0.08
        ease 0.95 rotate 0
    parallel:
        ease 0.70 zoom 1.460
        ease 1.15 zoom 1.453
        ease 1.05 zoom 1.458
        ease 0.90 zoom 1.45

transform heroine_karuizawa_left:
    subpixel True
    zoom 1.36
    xalign 0.36
    yalign 1.0
    xoffset -5
    yoffset 72
    rotate -0.34
    parallel:
        easeout 0.32 yoffset 60
        ease 0.90 yoffset 54
        ease 0.78 yoffset 59
        ease 0.95 yoffset 56
        ease 1.10 yoffset 60
    parallel:
        ease 0.48 xoffset 3
        ease 0.82 xoffset -2
        ease 1.05 xoffset 2
        ease 1.00 xoffset 0
    parallel:
        ease 0.62 rotate 0.24
        ease 1.00 rotate -0.14
        ease 1.08 rotate 0.08
        ease 0.95 rotate 0
    parallel:
        ease 0.70 zoom 1.369
        ease 1.15 zoom 1.363
        ease 1.05 zoom 1.367
        ease 0.90 zoom 1.36

transform heroine_karuizawa_right:
    subpixel True
    zoom 1.36
    xalign 0.74
    yalign 1.0
    xoffset -5
    yoffset 72
    rotate -0.34
    parallel:
        easeout 0.32 yoffset 60
        ease 0.90 yoffset 54
        ease 0.78 yoffset 59
        ease 0.95 yoffset 56
        ease 1.10 yoffset 60
    parallel:
        ease 0.48 xoffset 3
        ease 0.82 xoffset -2
        ease 1.05 xoffset 2
        ease 1.00 xoffset 0
    parallel:
        ease 0.62 rotate 0.24
        ease 1.00 rotate -0.14
        ease 1.08 rotate 0.08
        ease 0.95 rotate 0
    parallel:
        ease 0.70 zoom 1.369
        ease 1.15 zoom 1.363
        ease 1.05 zoom 1.367
        ease 0.90 zoom 1.36

transform heroine_karuizawa_near:
    subpixel True
    zoom 1.54
    xalign 0.56
    yalign 1.0
    xoffset -5
    yoffset 72
    rotate -0.30
    parallel:
        easeout 0.32 yoffset 60
        ease 0.90 yoffset 54
        ease 0.78 yoffset 59
        ease 0.95 yoffset 56
        ease 1.10 yoffset 60
    parallel:
        ease 0.48 xoffset 3
        ease 0.82 xoffset -2
        ease 1.05 xoffset 2
        ease 1.00 xoffset 0
    parallel:
        ease 0.62 rotate 0.22
        ease 1.00 rotate -0.12
        ease 1.08 rotate 0.07
        ease 0.95 rotate 0
    parallel:
        ease 0.70 zoom 1.550
        ease 1.15 zoom 1.543
        ease 1.05 zoom 1.548
        ease 0.90 zoom 1.54

transform heroine_karuizawa_far:
    subpixel True
    zoom 1.28
    xalign 0.56
    yalign 1.0
    xoffset -4
    yoffset 66
    rotate -0.32
    parallel:
        easeout 0.32 yoffset 60
        ease 0.90 yoffset 56
        ease 0.78 yoffset 59
        ease 0.95 yoffset 57
        ease 1.10 yoffset 60
    parallel:
        ease 0.48 xoffset 2
        ease 0.82 xoffset -1
        ease 1.05 xoffset 1
        ease 1.00 xoffset 0
    parallel:
        ease 0.62 rotate 0.22
        ease 1.00 rotate -0.12
        ease 1.08 rotate 0.07
        ease 0.95 rotate 0
    parallel:
        ease 0.70 zoom 1.288
        ease 1.15 zoom 1.282
        ease 1.05 zoom 1.286
        ease 0.90 zoom 1.28

transform heroine_ch12_ch13_center:
    subpixel True
    zoom 0.63
    xalign 0.56
    yalign 1.0
    xoffset -4
    yoffset 72
    rotate -0.35
    parallel:
        easeout 0.32 yoffset 60
        ease 0.90 yoffset 56
        ease 0.78 yoffset 59
        ease 0.95 yoffset 57
        ease 1.10 yoffset 60
    parallel:
        ease 0.48 xoffset 2
        ease 0.82 xoffset -1
        ease 1.05 xoffset 1
        ease 1.00 xoffset 0
    parallel:
        ease 0.62 rotate 0.25
        ease 1.00 rotate -0.14
        ease 1.08 rotate 0.08
        ease 0.95 rotate 0
    parallel:
        ease 0.70 zoom 0.635
        ease 1.15 zoom 0.632
        ease 1.05 zoom 0.634
        ease 0.90 zoom 0.63

transform heroine_ch12_ch13_left:
    subpixel True
    zoom 0.63
    xalign 0.35
    yalign 1.0
    xoffset -4
    yoffset 72
    rotate -0.35
    parallel:
        easeout 0.32 yoffset 60
        ease 0.90 yoffset 56
        ease 0.78 yoffset 59
        ease 0.95 yoffset 57
        ease 1.10 yoffset 60
    parallel:
        ease 0.48 xoffset 2
        ease 0.82 xoffset -1
        ease 1.05 xoffset 1
        ease 1.00 xoffset 0
    parallel:
        ease 0.62 rotate 0.25
        ease 1.00 rotate -0.14
        ease 1.08 rotate 0.08
        ease 0.95 rotate 0
    parallel:
        ease 0.70 zoom 0.635
        ease 1.15 zoom 0.632
        ease 1.05 zoom 0.634
        ease 0.90 zoom 0.63

transform heroine_ch12_ch13_right:
    subpixel True
    zoom 0.63
    xalign 0.74
    yalign 1.0
    xoffset -4
    yoffset 72
    rotate -0.35
    parallel:
        easeout 0.32 yoffset 60
        ease 0.90 yoffset 56
        ease 0.78 yoffset 59
        ease 0.95 yoffset 57
        ease 1.10 yoffset 60
    parallel:
        ease 0.48 xoffset 2
        ease 0.82 xoffset -1
        ease 1.05 xoffset 1
        ease 1.00 xoffset 0
    parallel:
        ease 0.62 rotate 0.25
        ease 1.00 rotate -0.14
        ease 1.08 rotate 0.08
        ease 0.95 rotate 0
    parallel:
        ease 0.70 zoom 0.635
        ease 1.15 zoom 0.632
        ease 1.05 zoom 0.634
        ease 0.90 zoom 0.63

transform heroine_ch12_ch13_near:
    subpixel True
    zoom 0.70
    xalign 0.56
    yalign 1.0
    xoffset -4
    yoffset 72
    rotate -0.32
    parallel:
        easeout 0.32 yoffset 60
        ease 0.90 yoffset 56
        ease 0.78 yoffset 59
        ease 0.95 yoffset 57
        ease 1.10 yoffset 60
    parallel:
        ease 0.48 xoffset 2
        ease 0.82 xoffset -1
        ease 1.05 xoffset 1
        ease 1.00 xoffset 0
    parallel:
        ease 0.62 rotate 0.23
        ease 1.00 rotate -0.13
        ease 1.08 rotate 0.08
        ease 0.95 rotate 0
    parallel:
        ease 0.70 zoom 0.706
        ease 1.15 zoom 0.702
        ease 1.05 zoom 0.705
        ease 0.90 zoom 0.70

transform heroine_ch12_ch13_far:
    subpixel True
    zoom 0.56
    xalign 0.56
    yalign 1.0
    xoffset -4
    yoffset 66
    rotate -0.32
    parallel:
        easeout 0.32 yoffset 60
        ease 0.90 yoffset 56
        ease 0.78 yoffset 59
        ease 0.95 yoffset 57
        ease 1.10 yoffset 60
    parallel:
        ease 0.48 xoffset 2
        ease 0.82 xoffset -1
        ease 1.05 xoffset 1
        ease 1.00 xoffset 0
    parallel:
        ease 0.62 rotate 0.22
        ease 1.00 rotate -0.12
        ease 1.08 rotate 0.07
        ease 0.95 rotate 0
    parallel:
        ease 0.70 zoom 0.565
        ease 1.15 zoom 0.562
        ease 1.05 zoom 0.564
        ease 0.90 zoom 0.56

transform band_guitarist_stage:
    zoom 0.44
    xalign 0.37
    yalign 0.55

transform band_bassist_stage:
    zoom 0.40
    xalign 0.50
    yalign 0.55

transform band_keyboardist_stage:
    zoom 0.40
    xalign 0.66
    yalign 0.58

transform band_drummer_stage:
    zoom 0.40
    xalign 0.82
    yalign 0.58

# 游戏在此开始。

label start:
    if preferences.text_cps == 0:
        $ preferences.text_cps = 35

    $ ai_sprite_outfit = "stage"

    scene bg station_sunbreak

    narrator "穿过隧道，沿途的电线杆便被抛之身后。"
    narrator "隆隆作响的火车在信号所前缓缓停下，灰暗的云朵将太阳遮的密不透风。"
    narrator "车窗外，捏着报纸等待列车进站的乘客已经拿上行李站起身，几个身穿制服的车辆乘务员下车负责引导。"
    narrator "白茫茫的天空，十一月的冷风钻不进车厢。"
    narrator "第三节车厢，在靠近窗户的某个座位，顾天鹏望着窗外，叹了口气。"
    narrator "重生到岛国的第十七年，刚从神川私塾毕业的顾天鹏，在十一月的第二周伊始，下定决心出门远足。"
    narrator "和其他人的重生不同。"
    narrator "没有觉醒系统之类的金手指，也没有好用的经验面板。"
    narrator "唯一和别人不一样的地方，只是顾天鹏有个特殊的、难以派上用场的能力："
    narrator "只要在心里重复一遍对方说过的话，便能知道那句话是不是谎言。"
    narrator "放在军事、政治领域，或许称得上了不得。"
    narrator "但前提是别人会相信他能力确实存在，否则只会被当做开玩笑，或者中二过头了。"

    narrator "六岁那一年，父亲在建筑工地意外丧生，母亲不久也病倒离世，顾天鹏没有其他可以依靠的任何亲戚。"
    narrator "勉强靠社会资助完成了义务教育，不准备继续念大学。"
    narrator "这次出门，顾天鹏手里只剩可以维持半年生计的一些现金，行李也只有用来更换的另一套衣服。"
    narrator "他决定去越后汤泽放松一下。"
    narrator "在春天来临的时候，也同样是在他正式找工作之前。"
    narrator "合上德语杂志，顾天鹏靠在软软的靠背上，用手揉着眼皮放松。"
    narrator "四下传来交谈声，仿佛将车厢闷进了玻璃瓶里，声音忽远忽近。"
    narrator "行李箱的滚轮压过地板，发出清晰的吱咬声。"
    narrator "火车停靠很长时间，乘客大都上了车。"
    narrator "外面的乘务员正要收起方便残障人士进入的踏板，一个急匆匆的女声突然透过玻璃窗灌进来："
    ai "等等，等等！我还没上车！"

    $ ai_sprite_mode = False
    $ event_cg_mode = True
    scene cg station_hurry_suitcase with dissolve

    narrator "被这声音惊扰的顾天鹏，不怎么感兴趣地抬起半只眼睛瞄去。"
    narrator "只是一瞬间，能见的空气里，如同电影中一闪而过的某个画面。"
    narrator "久违的阳光穿透云层，温柔的金色闪现在少女的眼里。"
    narrator "秋日凄清荡然无存，凝眸望去，长空寥廓，白鸽掠过低空。"
    narrator "无论经过一年，三年，还是二十年，一辈子。"
    narrator "那副闯进灵魂的画面，顾天鹏永远记得真真切切。"

    narrator "吹进站台的风扬起少女的深蓝色长发。"
    narrator "她一手压低帽檐，一手拉着白色行李箱，碎花的连衣裙和羊绒围巾因风飘浮。"
    conductor "下次要早点在这等着哦。"
    narrator "短发女乘务员像是责怪孩子一样说她，顺手接过她的行李箱。"
    scene cg station_thanks_suitcase with dissolve
    ai "嗯嗯，谢谢！"
    narrator "少女漾出甜甜的笑，那笑容让人心情愉悦。"

    $ ai_sprite_mode = False
    $ event_cg_mode = True
    scene cg train_find_seat with fade

    narrator "不一会儿，火车缓缓启动，少女钻进车厢里，和顾天鹏在同一节。"
    narrator "她对着座位上的序号挨个查看过去，像是检查座位损坏程度似的，最后停在顾天鹏身边。"
    ai "找到了。"
    narrator "她眯细的眼睛终于舒展开，脸上挂着惊喜的表情。"
    narrator "听见声音，顾天鹏支着手臂看过去。"
    narrator "那是一双仿佛藏着星星的双眼。"
    narrator "光是对视一眼，就让人仿若置身大山里的深空之下，想到皎洁的月光，又想到闪亮的舞台。"
    narrator "即使没有阳光的点缀，那眼睛也美得让人失神，像是要把顾天鹏的气息全部夺走。"
    narrator "少女没有立刻坐下，反而望了一眼头顶的行李架，又刻意拖动行李箱的滚轮。"
    taku "要帮忙吗？"
    narrator "他犹豫了下问。"

    window hide
    menu:
        "主动伸手接过行李箱":
            narrator "顾天鹏没有等她第二次暗示，起身把白色行李箱接到手里。"
            ai "谢谢！那就拜托你了。"
            narrator "她退后半步，把过道让出来。于是这场原本独自开始的旅行，在第一件行李被举起来时就改变了形状。"

        "等她开口以后再动作":
            narrator "顾天鹏没有立刻表现得过分热心，只是把手停在半空，等她真的需要帮助时再伸过去。"
            narrator "他习惯给陌生人留出一点距离，即使对方有一双让人很难移开视线的眼睛。"
            ai "那个，可以帮我一下吗？"
            taku "当然。"
            narrator "等她把请求说出口，他才接过行李箱。这个短短的停顿，让两个人都确认了彼此愿意靠近的速度。"
            narrator "行李箱被稳稳推进行李架时，星野爱像验收工程一样抬头看了看，又把一只小兔子发卡从刘海边拨正。"
            ai "顾天鹏，你是不是那种一定要等别人开口，才会觉得不冒犯的人？"
            taku "差不多。"
            ai "那我要是不说，你就会一直看着？"
            taku "我会判断。"
            ai "判断失败的话呢？"
            taku "道歉。"
            narrator "她听见这个答案，忍不住笑起来，却没有继续追问他的名字、年龄和秘密。"
            narrator "两个人把话题停在车票、天气和下一站的时刻表上。那是一条更礼貌的路线，像在湿玻璃上画出的直线，清楚，却不够贪心。"
            narrator "后来乘务员推着小车经过，星野爱买了一瓶热茶，没有买便当。顾天鹏也没有把巧克力拿出来。"
            narrator "他们在同一张小桌前各自保留着一点空白，直到列车穿过县界，窗外的雨色慢慢压下来。"
            jump ch1_rain_stop

    narrator "等行李箱终于安置到头顶，少女整理好裙子，在他正对面的位置坐下。"

    scene bg train_table with dissolve
    $ ai_sprite_mode = True
    $ event_cg_mode = False
    show heroine stage_neutral at heroine_bust_center
    narrator "行李摆上架子，顾天鹏拍了拍手，重新坐好。"
    ai "谢谢，你叫什么呢？"
    narrator "少女的脸上很适合挂着笑容。"
    taku "顾天鹏。"
    ai "星野爱。"
    narrator "她把帽子摘下来，撩了下搭在脖颈和羊绒围巾交界处的长发。"
    narrator "一股淡淡的清香弥散到空气中，如同刚摘下的樱桃一般。"
    narrator "顾天鹏看愣神似的望着她。"
    $ ai_sprite_mode = False
    $ event_cg_mode = True
    scene cg train_table_chat with dissolve
    ai "看什么呢？"
    narrator "被盯了一阵子，星野爱才语调婉转地说。"
    taku "抱歉。"
    narrator "顾天鹏为自己不够绅士的表现道歉。"
    taku "星野小姐太好看了，一不小心就。"
    ai "你这人才是吧。"
    narrator "她完全没有生气，反倒前倾上半身，兴趣盎然地盯着顾天鹏的眼睛。"
    ai "长那么好看，莫非职业是演员？"
    taku "谬赞了。"
    ai "多大？"
    taku "十七。"
    narrator "说完他又补充。"
    taku "上个月刚满。"
    ai "是高中生啊？"
    taku "已经高中毕业。"
    ai "哦，我比你大一岁。"
    narrator "她仿佛在说一件很了不起的事情，把手搭在发育良好的胸前。"
    ai "我十八，算是你姐姐。"
    narrator "谎言。"
    narrator "这种简单的谎言，顾天鹏一下便能轻松识破。"
    ai "怎么可能是谎言嘛。"
    ai "这种事情哪有撒谎的必要。"
    narrator "顾天鹏没在意她解释了什么，径自问："
    taku "十七？"
    ai "十八！"
    taku "不过看长相又像是十六……"
    narrator "他托起下巴。"
    ai "真的是十八啦。"

    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg train_mountains with dissolve
    show heroine stage_neutral at heroine_bust_center

    narrator "火车开进住宅区，绿色的房子一闪而过，每隔几米便有塔台，电缆呈乱糟糟的直线。"
    taku "星野小姐。"
    narrator "顾天鹏把手里合上的德语杂志搭在桌面上，凝视星野爱的眼睛。"
    taku "你骗不了我，我可是能识破所有谎言的。"
    scene bg train_table with dissolve
    $ ai_sprite_mode = True
    $ event_cg_mode = False
    show heroine stage_surprised at heroine_bust_center
    ai "识破谎言？"
    narrator "星野爱眼睛都瞪的更大了。"
    taku "具体的原因。"
    narrator "顾天鹏思考片刻。"
    taku "我想你高中没毕业，现在又是十一月八号……逃学出来的？"
    ai "才不是！"
    taku "奇怪，这次没有撒谎。"
    ai "你这能力还真是好用啊。"
    narrator "她赌气似的鼓起脸颊朝外看去，顾天鹏也眼望远方。"

    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg lake_bridge with fade
    show heroine stage_neutral at heroine_bust_center

    narrator "风景变换到大桥之上。"
    narrator "脆弱的薄云像是被冻僵一样凝滞在天空，外面竟是白茫茫一片，连湖面都泛着冰冷的微光。"
    narrator "有人起身将车窗打开，十一月的北风从不大的缝隙涌进来。"
    narrator "冷倒是不冷，倒不如说，车厢内的空气还因此清新起来。"
    narrator "将视线从窗外拉回来，过了大约十几秒，星野爱边整理围巾边若无其事地说："
    scene bg train_table with dissolve
    $ ai_sprite_mode = True
    $ event_cg_mode = False
    show heroine stage_neutral at heroine_bust_center
    ai "我其实十六。"
    taku "猜到了。"
    narrator "顾天鹏仍看着窗外，思考海天交接的地方泛白的原因。"
    ai "不过没有逃学。"
    taku "嗯。"
    narrator "顾天鹏知道这不是谎言。"
    narrator "他把手支在窗边，摸着不存在胡须的下巴，等待对方继续往下说。"
    ai "我要是说我是个孤儿。"
    narrator "她抬起头。"
    ai "这你也相信吗？"
    narrator "顾天鹏听了，有点意外地扭头望着她。"
    narrator "他在心里将这句话重复一遍。"
    taku "我信。"
    ai "那我要是说我是离家出走的，你也信吗？"
    taku "这大概是谎言。"

    $ ai_sprite_mode = False
    $ event_cg_mode = True
    scene cg train_table_chat with dissolve
    ai "有趣！"
    narrator "她笑了。"
    narrator "这是顾天鹏在世界上见过的最美的笑容。"
    taku "不能实话实说？"
    ai "这个嘛……"
    narrator "她沉吟一下，仿佛把微笑用笔描了一遍，还娇俏地吐出舌头，样子可爱极了。"
    ai "是秘密！"
    taku "是秘密啊……"
    ai "嘻嘻。"
    narrator "顾天鹏装出忧伤的样子叹了口气。"
    taku "我可是连最宝贵的秘密都告诉你了，这样一点都不公平。"
    ai "啊，你别难过呀。"
    narrator "她看起来有些自责。"
    ai "你那不是逗我玩的吗？"
    taku "是真的。"
    ai "那简直是超能力了吧？"
    taku "所以我只和你一个人说过。"
    ai "怕被抓去做研究？"
    taku "别转移话题。"
    ai "嘿嘿。"
    narrator "她用小粉拳砸在自己的脑袋上。"
    narrator "这是顾天鹏在世界上见过的最可爱的少女。"

    scene bg train_table with dissolve
    $ ai_sprite_mode = True
    $ event_cg_mode = False
    show heroine stage_speak at heroine_bust_center
    taku "说吧。"
    ai "勉为其难告诉你哦。"
    narrator "她对着车窗玻璃哈了口气，在上面写上“星野爱”的字样，然后重新坐正身体。"
    ai "我的名字是星野爱，不是没毕业的高中生，也不是离家出走的任性少女。"
    ai "因为家里的监护人想让我当偶像出道，可我还没做好决定，就想着一个人出来旅行放松放松，回去再给他答复。就这么简单。"
    taku "嗯。"
    narrator "顾天鹏若有所思地点点头。"
    taku "不过刚开始为什么要撒谎呢？"
    ai "你问为什么……"
    narrator "星野爱摸了摸下唇，看着窗玻璃中倒影的影子。"
    ai "为什么……这我也说不清啦。"
    taku "笨蛋少女？"
    ai "保持神秘！"
    taku "可爱。"
    ai "可恨的帅哥！"
    taku "头发吃进嘴里了哦。"
    ai "哪里哪里？"

    narrator "十一月的秋色中，黑色的火车驶向前方，闯进未知的土地。"
    narrator "窗外的世界，山棱线模糊不清，鸟叫声由远及近。"

label ch1_rain_stop:
    $ ai_sprite_mode = False
    $ event_cg_mode = True
    scene cg takasaki_rain_stop with fade
    narrator "穿过县界，霏霏细雨飘下空漠，附上车窗，抬眼不见晚霞。"
    narrator "临近黄昏，火车在沿站靠停。"
    narrator "下次发车大约是十五分钟后，顾天鹏合上翻了七遍的杂志，从包里取出宝特瓶喝水。"
    narrator "沉闷的车厢有乘客上来，周围响起零碎的对话声，一个妇女在安抚哭泣的小孩。"
    narrator "星野爱好奇地望向窗外，乘务员用温柔的声音提醒大家车内的灯光即将打开。"
    narrator "灯一亮，外面的世界好像突然暗了一分。"
    narrator "窗玻璃上倒影着星野爱的侧脸，在顾天鹏眼里，那双眼睛变得格外柔和、透明。"

    scene cg train_open_window_rain with dissolve
    narrator "她站起身，把胸前的围巾拨到脖子后面，用手推开车窗。"
    narrator "冷空气席卷进来，带着两三颗踪迹鲜明的雨点，但不足以打湿桌面。"
    narrator "和出发时相比，空气的温度降了不少。"
    narrator "星野爱把下巴缩进羊绒围巾之中，只露出鼻子和眼睛。"
    narrator "一口白气从柔软的布料钻出来，她将身子探到外边，好看的脸颊眺望远方。"
    narrator "似有似无的雾霭之中，乌鸦落在交错的电线上，灰色的橘猫从低矮的屋舍跳下来，转瞬消失不见。"
    ai "真美。"
    narrator "但这交谈没有对象，像是在自言自语。"
    narrator "视线从她微微泛红的脸上移开，顾天鹏将目光投向被雨水涂黑的大地，并行的铁轨生了锈。"
    taku "是高崎。"
    ai "高崎？"
    narrator "她回身。"
    taku "之后是越后汤泽。"
    ai "这我倒是知道。"
    scene bg train_table_rain with dissolve
    $ ai_sprite_mode = True
    $ event_cg_mode = False
    show heroine stage_neutral at heroine_bust_center
    taku "你要去哪？"
    narrator "他随口问，把宝特瓶收好，一手搭着桌子，一手托起下颚，眼睛凝视星野爱。"
    ai "越后汤泽吧……"
    narrator "星野爱将食指抵在唇上。"
    ai "其实去哪都一样，我只是想去一个可以放松的地方休息。"
    taku "只是这样？"
    ai "只是这样。"
    narrator "顾天鹏点头。"
    taku "温泉，赏雪，滑雪，吃草莓村的“越后姬”，体验手打荞麦面，享受热腾腾的炸天妇罗。我为这个来的。"
    ai "你很了解这一带嘛。"
    narrator "他晃了晃上车前买的旅行攻略。"
    ai "喔，竟然还有这种东西！"

    narrator "顾天鹏把册子递给她，她很自然地接过。"
    narrator "为了防止毛毛雨打湿纸张，她把窗户严严实实地关好，然后坐回位置翻了几页。"
    $ ai_sprite_mode = False
    $ event_cg_mode = True
    scene cg train_guidebook with dissolve
    ai "喔，喔～"
    narrator "她对着小册子时不时发出惊叹，偶尔还象征性地点头。"
    taku "还不错吧。"
    ai "东京外面还有这种地方。"
    narrator "星野爱啪的一声把册子合上，抬起头说。"
    ai "东京，真厉害！"
    taku "这和东京没关系了吧。"
    ai "日本那么小，全算进东京里也没问题啦。"
    taku "正常才不会这么想吧。"
    ai "这不就说明我和谁都不一样？"
    narrator "她露出有些得意，又有些搞怪的笑容。"
    narrator "顾天鹏想了想。"
    taku "算是。"
    narrator "在制服里面添了件厚衣服的乘务员从过道经过，被座位上的少年和少女吸引了视线。"
    narrator "但也只是匆匆看一眼，身影很快离开。"
    scene bg train_table_rain with dissolve
    $ ai_sprite_mode = True
    $ event_cg_mode = False
    show heroine stage_speak at heroine_bust_center
    narrator "星野爱继续打开册子翻阅。"
    ai "这个地方。"
    narrator "过了一会儿，她用那修长的手指对准攻略上的一幅插图。"
    ai "看起来很好玩的样子！"
    narrator "顾天鹏盯过去。"
    taku "轻井泽。"
    ai "也在那？"
    taku "你说越后汤泽？"
    narrator "他调整了下坐姿。"
    taku "离那不远，应该说是周边吧……东京的周边的周边？"
    ai "这个说法真有趣。"
    narrator "她声音让人安心。"
    narrator "顾天鹏揶揄她。"
    taku "这样子，我也是和谁都不一样的人了。"
    ai "不愧是你！"
    taku "过奖。"
    ai "但我们就一样了呢。"
    taku "总会有点相似的地方。"

    $ ai_sprite_mode = False
    $ event_cg_mode = True
    scene cg train_karuizawa_invite with dissolve
    ai "去完越后汤泽，就去轻井泽吧！"
    narrator "星野爱突然站起来说。"
    narrator "她脸上挂着期待的表情，连眼角都漾着笑意。"
    narrator "顾天鹏看着她，总感觉她像是天真的十岁小孩。"
    narrator "她也定定地注视顾天鹏，双手支在桌面，旅行攻略被她压在手心下面。"
    taku "嗯？"
    ai "我和你！"
    taku "怎么突然说这个。"
    narrator "他问。"
    ai "反正我们的目的地都一样。"
    ai "你不也是来旅行放松的吗，干脆一起玩个彻底！"

    window hide
    menu:
        "一起走吧":
            narrator "顾天鹏看着她压在攻略上的手，忽然觉得拒绝这样明亮的邀请，反倒像在对旅行本身撒谎。"
            taku "那就一起吧。路线你来挑，迷路算我的。"
            ai "成交！"

        "先把规则说清楚":
            narrator "顾天鹏没有被那份热情完全带走。他提醒自己，越是像命运一样突然降临的事，越需要好好确认。"
            narrator "同行可以，但要记得他们今天才刚认识。"
            taku "同行可以。不过住处、行程、钱，都先说清楚。"
            ai "好认真哦。"
            taku "认真是为了玩得安心。"
            ai "那也成交！"
            narrator "星野爱从包里翻出一支蓝色圆珠笔，把旅行攻略翻到空白页，煞有介事地写下“临时同行协议”。"
            ai "第一条，迷路时不许说‘我早就知道’。"
            taku "这种话本来就不礼貌。"
            ai "第二条，每天至少做一件贪心的事。"
            taku "第三条，危险的贪心要提前申报。"
            ai "第四条，顾天鹏不许把所有事都安排得像考试。"
            taku "第五条，星野小姐不许把所有事都变成突击测验。"
            narrator "他们一人写一条，把那张空白页写得像幼稚又认真的契约。星野爱最后还在角落画了一个歪歪扭扭的星星，旁边补上一句“违反者负责买热饮”。"
            narrator "规则让他们的同行变得清楚，也让之后的几站多了一种奇怪的秩序感。她每想绕路前都会举起攻略问“可以申报吗”，顾天鹏则认真到真的点头或摇头。"
            narrator "那晚的夜车没有便当交换，也没有甜食秘密，取而代之的是一本被写满规则的旅行攻略。"
            jump ch2_train_night_sleep

        "还是各走各的":
            narrator "顾天鹏看着她期待的眼睛，最终还是摇了摇头。"
            taku "抱歉。我还是习惯一个人旅行。"
            narrator "星野爱愣了一下，随即笑得和刚才一样明亮。"
            ai "这样啊。那祝你玩得开心。"
            narrator "她把攻略轻轻推回桌面，像把一条还没开始的路线折回原处。"
            jump ending_missed_companion

    scene bg train_table_window with dissolve
    $ ai_sprite_mode = True
    $ event_cg_mode = False
    show heroine stage_speak at heroine_bust_center
    narrator "同行这件事，就这样被列车驶过铁轨的声音钉牢了。"
    taku "不过你不怕？我们才刚认识。"
    ai "你才十七岁，我怕什么？"
    taku "十七怎么了。"
    ai "花一样的年龄，这种年龄怎么会犯罪嘛。"
    taku "犯罪者怎么能从年龄判断。"
    ai "怎么不行？毕竟那么年轻。世界上还有那么多人可以去见，还有那么多地方可以去玩，还有那么多……"
    narrator "她停下来，像是在寻找合适的词汇。"
    taku "还有那么多？"
    narrator "仿佛在怀念某种逝去东西一样，星野爱的眼神难得显得有些落寞。"
    narrator "她轻轻开阖樱花色的双唇，将声音放低。"
    ai "各种各样的爱。"
    taku "爱？"
    ai "是。"
    narrator "落寞之色转瞬即逝。"

    $ ai_sprite_mode = False
    $ event_cg_mode = True
    scene cg train_greedy_girl with dissolve
    ai "不管怎么说，总之看得出来……"
    narrator "没等顾天鹏先张口，星野爱突然把身子压上来，眯起眼睛和他对视。"
    ai "你，绝对是个好人！"
    narrator "一股比刚才更加强烈的香味钻进鼻尖，渗入顾天鹏的每一个毛孔，他感觉自己仿佛置身花海之中。"
    taku "谢谢。"
    ai "看吧，连这也要道谢。"
    narrator "星野爱坐回位置，像是有了新发现似的满面春风。"
    taku "我想你也一样。"
    narrator "顾天鹏笑着说。"
    ai "错！"
    narrator "塔台的远光闪在星野爱脸上。"
    narrator "窗外边，天色逐渐变暗，沿线的路灯像是早就准备好似的全部亮起。"
    narrator "星野爱了不起地回答："
    ai "我是星野爱，是这个世界上，最坏最坏，最最贪婪的少女！"
    scene bg train_table_night with dissolve
    $ ai_sprite_mode = True
    $ event_cg_mode = False
    show heroine stage_speak at heroine_bust_center
    narrator "这一刻，连迷人暮色也化作了背景。"
    narrator "她目不转睛地盯视顾天鹏。"
    narrator "那是一双拥有一切美好的眼睛。"
    narrator "在瞳仁的深处，流淌着一种近乎不可思议的彩色液体，旋转出难以置信的图形。"
    taku "了不起。"
    narrator "顾天鹏收回失神的目光。"
    ai "是吧！"
    narrator "星野爱温柔地拨开耳边的长发。"
    taku "那我就是世界上最礼貌的十七岁少年。"
    ai "好。"
    ai "顾天鹏是世界上最礼貌的十七岁少年！"
    taku "谢谢你认可。"

    $ ai_sprite_mode = False
    $ event_cg_mode = True
    scene cg train_bento_exchange with dissolve
    ai "对了，饿了吗？带吃的了？"
    taku "带了巧克力，饼干，面包。"
    ai "都是我爱吃的！"
    taku "是你饿了啊？"
    ai "我只买到一份便当。"
    narrator "她将用塑料盒和保鲜膜包装的即食便当从包里拿出来，放到桌面。"
    narrator "里面有白米饭，炸鸡块，章鱼烧，胡萝卜和几朵新鲜的西兰花。"
    taku "很丰盛嘛。"
    ai "那我和你交换。"
    taku "交换？"
    ai "用便当换你的巧克力。"
    taku "当然可以，送你也没问题。"
    narrator "顾天鹏将巧克力从包里取出来递给她。"
    scene bg train_table_night with dissolve
    $ ai_sprite_mode = True
    $ event_cg_mode = False
    show heroine stage_shy at heroine_bust_center
    taku "这么喜欢吃甜的？"
    narrator "星野爱接过一起送来的巧克力，苏打饼干，点了下头。"
    ai "嗯。"
    narrator "顾天鹏沉吟似的望着她。"
    ai "怎么了？"
    taku "谎言。"
    ai "什么谎言呀？"
    narrator "她若无其事地说。"
    narrator "顾天鹏看着她手里的巧克力包装。"
    taku "你不喜欢甜食，或者没那么喜欢？"
    ai "什么是喜欢呢？"
    narrator "她来回拨弄锡纸包装。"
    ai "不讨厌就算喜欢吧？"
    taku "哪有这样定义的……"
    ai "总而言之，是无关紧要的谎言。"
    taku "这倒是。"
    narrator "顾天鹏没再开口。"
    narrator "两人解决完晚饭的时候，火车已经启动很久。"
    narrator "正值十一月的天空早就黑成一片，抬眼望去，远方山体却泛着可爱的白色。"

label ch2_train_night_sleep:
    $ ai_sprite_mode = False
    $ event_cg_mode = True
    scene cg train_night_sleep with fade
    narrator "夜晚，用围巾枕着手臂的星野爱，趴在桌上乖巧地睡着了。"
    narrator "路途遥远，车身摇摇晃晃，在一片岑寂之中，火车运行的咣当声愈发明显。"
    narrator "车厢里的灯是不太耀眼的淡黄色，窗玻璃像块显示屏幕一样展现着外面的北国风光。"
    narrator "仔细看去时，这块玻璃又仿佛成了清晰的镜面，始终浮现出星野爱那淡淡的睡颜。"
    narrator "她是世界上最最贪婪的少女。"
    narrator "对少女而言，这句话不是谎言。"
    narrator "心里想着明天旅行的事情，顾天鹏收回视线。"
    narrator "他将有线耳机接上手机，用免费试听的音乐器播放了一首《圣诞快乐，劳伦斯先生》，选择单曲循环。"
    narrator "闭上眼睛，困意逐渐袭来，他靠在软垫上入睡。"

label chapter_3:
    $ ai_sprite_mode = False
    $ event_cg_mode = True
    scene cg yuzawa_morning_wake with fade
    narrator "越后汤泽的温泉旅馆"
    narrator "凌晨的时候，火车穿过隧道，开进山里，周围已经完全亮了起来。"
    narrator "窗外的景物像是蒙上了一层轻薄的白纱。"
    narrator "穿着深色风衣的扫雪工、点缀雪地的低矮木楼、路边三三两两的嫩绿青葱。"
    narrator "无论看到什么，心里总有一种跟着蓝天白云浮起来的梦幻之意，整个人都无比轻松。"

    $ ai_sprite_outfit = "stage"
    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg train_table_snow_morning with dissolve
    show heroine stage_surprised at heroine_bust_center
    narrator "车厢里，从睡梦中苏醒的星野爱呻吟一声，搓着眼睛抬起头，望着白色的冰天雪地，长长地伸了个懒腰。"
    ai "到了？"
    narrator "她用软软糯糯的声音问。"
    taku "三十分钟。"
    narrator "顾天鹏说。"

    scene bg train_table_snow_morning with dissolve
    show heroine stage_shy at heroine_bust_center
    narrator "他从包里拿出剩下半包的低糖苏打饼递过去。"
    taku "将就一下。早饭。"
    ai "谢谢。"
    narrator "星野爱轻声说，摊开双手接过，然后又忽然想起似的问。"
    ai "你自己呢，还有别的吃的吗？"
    taku "我不太饿。"
    ai "不饿？"
    narrator "她歪了下脑袋。"
    narrator "顾天鹏用不清不楚的音量嗯了一句。"

    $ ai_sprite_mode = False
    $ event_cg_mode = True
    scene cg yuzawa_lie_nose with dissolve
    narrator "他把背包的拉链拉上，抬起头，一只如白玉般洁净的手指点上他的鼻尖。"
    taku "干嘛呢。"
    ai "谎言！"
    narrator "星野爱笑嘻嘻地说。那是一种类似恶作剧般顽皮的笑。"

    window hide
    menu:
        "承认自己其实也饿了":
            narrator "顾天鹏把视线移开，终于承认胃里确实空得厉害。"
            $ ai_sprite_mode = True
            $ event_cg_mode = False
            scene bg train_table_snow_morning with dissolve
            show heroine stage_speak at heroine_bust_center
            taku "好吧，是假的。我也饿了。"
            ai "看吧，我赢了。"
            narrator "星野爱像真的赢了什么比赛一样笑起来，把饼干掰成两半。"
            taku "这算哪门子胜利。"
            ai "早餐分配权的胜利。"

        "继续维护不太成功的体面":
            narrator "顾天鹏试图保持平静，仿佛被戳破的不是谎言，而只是清晨车窗上的一层薄雾。"
            narrator "星野爱看着他，眼里写满了“你还要装到什么时候”。"
            $ ai_sprite_mode = True
            $ event_cg_mode = False
            scene bg train_table_snow_morning with dissolve
            show heroine stage_speak at heroine_bust_center
            taku "是真的。"
            narrator "顾天鹏将她的手指移开，又若无其事地说。"
            taku "况且，能看破谎言的只有我一个，并且世界上只有我一个，你不行。"
            ai "哪有这种赖皮的能力嘛。"
            narrator "星野爱嘟着嘴。"
            taku "很神奇吧。"
            ai "没人会信啦。"
            taku "当我开玩笑也没问题。"
            narrator "她没有再追问那句“饿不饿”。半块饼干最终还是被放回包装袋里，清晨的亲近也随之轻轻合上。"
            jump side_ch3_lie_game

    narrator "片刻后，顾天鹏拿出昨天看过的旅行攻略，利用桌面竖着敲了敲，准备到站前再温习一遍。"

    $ ai_sprite_mode = False
    $ event_cg_mode = True
    scene cg yuzawa_cracker_share with dissolve
    narrator "这时，旁边传来咔嚓一声，像是把什么东西掰断了一样。"
    narrator "顾天鹏疑惑着抬头，紧接着半块饼干递到他嘴边。"
    ai "给。"
    taku "谢谢。"

    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg train_table_snow_morning with dissolve
    show heroine stage_neutral at heroine_bust_center
    narrator "放弃了一口咬上去的打算，顾天鹏拿手接过。"
    narrator "两人吃完早餐，一起看了会儿攻略上的各种插画和文案。"
    narrator "因为纸张只能朝着一个方向，星野爱让他坐到自己旁边，和之前一样。"

label side_ch3_lie_game:
    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg train_table_snow_morning with fade
    show heroine stage_speak at heroine_bust_center

    narrator "列车临近越后汤泽时，星野爱忽然把包装袋推到桌子正中央。"
    ai "那我们来玩一个游戏。"
    taku "游戏？"
    ai "谎言裁判。你说三句话，我判断哪一句是假的。"
    taku "如果你输了呢？"
    ai "我承认顾天鹏是世界上最礼貌的十七岁少年。"
    taku "这不是已经承认过了？"
    ai "那就升级成最麻烦的十七岁少年。"
    narrator "顾天鹏看着她一本正经的表情，终于还是被逗得叹了口气。"
    taku "第一，我不饿。第二，我觉得你很吵。第三，我其实很期待接下来的旅馆。"
    narrator "星野爱盯着他的眼睛，像真要把谎言从里面抓出来。"
    ai "第一句是假的。第二句也是假的。第三句是真的。"
    taku "规则里不是只有一句假话吗？"
    ai "规则可以被最贪婪的裁判临时修改。"
    narrator "她把饼干掰开，仍旧没有递到他嘴边，只是放到桌面中央。顾天鹏拿起属于自己的那半块，两个人隔着一只包装袋吃完了早饭。"
    narrator "这不是原本会发生的亲近，却让他们多了一个谁也没写进攻略里的小游戏。"
    narrator "到站以后，星野爱把空袋折成小方块，塞进外套口袋。"
    ai "证物保留。以后你再撒谎，我就把这个拿出来。"
    taku "那证物最好保管好。"
    ai "当然。我可是裁判。"
    narrator "他们拖着行李走下列车，清晨的雪光从站台尽头铺过来。旅馆窗外的雪很快亮得刺眼，新的一天没有章名，也没有提示，只是自然地继续。"

    $ ai_sprite_outfit = "stage"
    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg ryokan_room with fade
    show heroine stage_speak at heroine_bust_center
    jump main_ryokan_morning


label chapter_4:
    $ ai_sprite_outfit = "stage"
    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg ryokan_room with fade
    show heroine stage_speak at heroine_bust_center
    narrator "从初冬漫步而来的春色"
label main_ryokan_morning:
    taku "登山？"
    narrator "顾天鹏说。"
    narrator "转头看去时，星野爱正目不转睛地望着他，眼里闪着期待的光。"
    narrator "她跪坐在榻榻米上，羊绒围巾搭着大腿。"
    narrator "清晨的阳光溜进屋子，光线绵延在她的侧脸，旋即拉出好看的虚影，消失在未沾染多少灰尘的地板之上。"
    narrator "金色的光柱旋转着近乎透明的颗粒，旭日东升时，少女连指尖都泛着神秘的色彩。"
    ai "可以吗？"
    taku "没问题。"
    ai "太好了！"
    narrator "星野爱笑着把围巾举过头，做出振臂高呼的动作。"
    narrator "面对这样的少女，顾天鹏总会产生亲切的好感——她从不吝啬自己的笑容。"

    scene bg ryokan_room with dissolve
    show heroine stage_neutral at heroine_bust_center
    narrator "一直到中午之前，顾天鹏继续看书，看《了不起的盖茨比》，把英语翻译过来。"
    narrator "翻译成中文，翻译成日语，最后碾碎了丢进思想的大海里。"
    narrator "这是一本无论看几遍都不会厌倦的书。"
    narrator "鲜活优美的文字，引人入胜的剧情，丝滑如抛光打磨后镜面一样的情节流畅程度，还有那个永远充满决心、生来便了不起的盖茨比。"
    narrator "每每翻开书页，顾天鹏总要再三阅读它的开篇，并且次次心怀澎湃。"
    narrator "“那就戴上金帽子吧，如果能让她心怡；如果能蹦高，蹦给她看又何妨，直到她大喊：‘情郎，戴金帽子蹦高的情郎，我一定要得到你！’”"
    narrator "为了充实自己，他也曾写下类似“计划表”的东西。"
    narrator "每天：蹲起一百次，伏地挺撑八十次，仰卧起坐一百次，长跑五公里。"
    narrator "长远：永远努力，永远礼貌。坚持看书，不喝酒，不吸烟。投资自己，为自己花钱。"
    narrator "至少学习三种球类运动。对母亲更好些——后来划掉，改成：平等地对待每一个人。"
    narrator "了不起的计划，即使在独自生活的今天，顾天鹏也从来没懈怠过半次。"
    ai "很深奥的书呢。"
    narrator "不知什么时候，围着围巾的星野爱跪坐到他身边，指尖触摸红唇，眼睛朝书页张望。"
    taku "伟大的杰作。"
    narrator "他干咳一声，从榻榻米上站起来。"
    taku "吃饭？"
    ai "嗯嗯。"
    narrator "星野爱古灵精怪地笑笑。"
    ai "难道你还想再看会儿？"
    taku "再看就一发不可收拾了。"
    narrator "星野爱也站起来。"
    ai "真有那么好看？"
    taku "毫无疑问。"
    ai "信你。"
    narrator "她换上迷人的笑容。"
    ai "回头也借我看看吧！"
    narrator "顾天鹏点头。"
    taku "当然可以。这本书，我恨不得全世界的人都去翻上几遍，如果行得通的话，让那些家伙全文背诵最好。"
    ai "哈哈，真有那么夸张嘛。"
    narrator "星野爱好笑似的开口。"
    ai "简直可以拿去做广告词了。"
    taku "代言费要多少好呢？"
    ai "一千万？"
    taku "够住好多好多个夜晚了。"
    ai "的确是呢。"
    taku "走吧。"
    ai "哦！"

    $ ai_sprite_mode = False
    $ event_cg_mode = True
    scene cg ch4_ryokan_lunch with dissolve
    narrator "两人吃罢旅馆免费提供的鳗鱼盖浇饭、金枪鱼寿司，都没要上一瓶威士忌或是日本清酒，只是喝了两杯温热的开水。"
    narrator "除此之外，饭后甜点也免费提供。"
    narrator "负责管理甜点的和服女子告诉他们拿多少都行，不要浪费就好。"
    narrator "他们点头答应，但只取了一个巴掌大的甜甜圈，上面铺满了彩色的巧克力碎。"
    narrator "两人各掰了一半，但顾天鹏到最后也没吃完。"

    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg ryokan_room with dissolve
    show heroine stage_neutral at heroine_bust_center
    narrator "下午一点三十，他们准备出门。"
    narrator "顾天鹏将《了不起的盖茨比》收进包里，星野爱则摘下围巾，对他说换套衣服再出去好了。"
    taku "好的，那我先出去。"
    narrator "顾天鹏抬一下手说。"
    ai "不想偷看？"
    taku "能克制住。"
    ai "哦～"
    narrator "星野爱转了转食指，最后指向他。"
    ai "诚实！"
    taku "礼貌，诚实。"
    narrator "顾天鹏叹气说。"
    taku "我到底还有多少优点。"
    ai "很帅！"
    taku "谢谢。"
    narrator "顾天鹏走出去，门关上，他的声音从走廊传进来。"
    taku "在门口等你。"
    ai "OK！"

    $ ai_sprite_mode = False
    $ event_cg_mode = False
    scene bg ryokan_genkan with fade
    narrator "门庭处，顾天鹏换好出门的运动鞋，又把来时路上买来的暖宝宝贴在衣服里。"
    narrator "走到门外，世界一片苍茫。"
    narrator "暖和的阳光撒下来，新葱闪闪发亮，门檐的积雪化成水滴落下来，一下一下敲出冬天的礼歌。"
    narrator "极目远眺，六七岁的顽童在放风筝，脚踏木屐的妇人在不远的地方交谈，男人砍了几捆柴背回来。"
    narrator "山的轮廓，太阳的形状，树叶的低语，风的高呼。"
    narrator "竟然连风都变得有迹可循了。"
    narrator "他靠在木壁上，听见犬吠声融进微寒的空气里。"
    narrator "没过一会儿，身后传来空灵的声音。"
    ai "顾天鹏，走吧！"
    taku "哦。"

    $ event_cg_mode = True
    scene cg ch4_winter_outfit with dissolve
    narrator "他回头望去，看见上身黑色棉袄，下身深蓝牛仔裤，脚踩一双棕褐色长筒靴的星野爱站在淡黄色的灯光之下。"
    narrator "她一边整理附两只有小兔子玩偶的御寒手套，一边抬眼看过来。"
    narrator "头上没戴帽子，但用了类似的兔子发饰装点秀发。"
    narrator "此刻正将头发拨到后面，露出那令人着迷的白皙耳朵。"
    narrator "那是怎样曼妙的身姿，连一袭白衫的北国风光在她面前都黯然失色。"
    narrator "整理好手套，星野爱迈着可以说是欢愉的步伐走过来。"
    narrator "直到到了顾天鹏身前，她止住脚步，手在身后交叠，脑袋倾斜一个可爱的角度，脸上挂着纯净的、毫无瑕疵的微笑。"

    $ ai_sprite_outfit = "winter"
    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg ryokan_genkan with dissolve
    show heroine winter_neutral at heroine_winter_center
    ai "有那么好看吗？盯了好久。"
    taku "抱歉。"
    ai "走啦。"
    narrator "顾天鹏点头，星野爱围好围巾、对着空气呼出口气，两人踩着积雪一起出了门。"

    $ ai_sprite_mode = False
    $ event_cg_mode = True
    scene cg ch4_snow_walk with dissolve
    narrator "一路上，微风和煦，阳光温暖。"
    narrator "如泡沫般的云朵翻涌在湛蓝色的天空之上，呼吸到的空气都染上初冬的色彩。"
    narrator "好像春天近了。其实春天还远着。"
    narrator "是星野爱让他觉得春天快来了。"
    narrator "顾天鹏想，那是一种完完全全属于春天的笑容了。"
    narrator "即使在晴空之下，积雪也难以完全消融，二人的脚印从旅馆延伸，一直到了山脚下。"

    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg forest_trail_left with dissolve
    show heroine winter_speak at heroine_winter_center
    narrator "登山有两条线路，一条稍急，一条稍缓。"
    ai "选哪边好呢？"

    window hide
    menu:
        "走标着路牌的左侧山道":
            narrator "顾天鹏先看路牌，又看了一眼雪地里被踩实的脚印。至少这条路能保证他们在天黑前回来。"
            narrator "星野爱左右看了看，最后把手套往上拽了拽。"
            ai "那就左边好了！"
            taku "那我走右边。"
            narrator "顾天鹏说。"
            taku "到时候在山顶汇合。"
            narrator "星野爱眯缝眼睛盯着他，发出一种奇妙的“嘁”的拟声。"
            taku "开玩笑的，那就左边吧。"

        "陪她往没有脚印的雪地多看一眼":
            narrator "顾天鹏顺着她的视线看向树与树之间。那里的雪面完整得像一张还没写字的纸。"
            narrator "他没有立刻否定，只把可能迷路这件事先放在心里。"
            ai "一点点就好。我们不走远。"
            narrator "他们往树影里踏了几步，脚下的雪发出很轻的碎裂声。新路确实被他们踩出来了，短得像一句还没说完的话。"
            taku "到这里。再往前就是迷路。"
            ai "冒险家撤退！"
            narrator "她朝没被踩乱的雪地敬了个不太标准的礼，然后沿着自己的脚印退回路牌前。"
            narrator "那段小小的偏离耗掉了一点时间，山道上的节奏也被打乱了。"
            narrator "他们还是回到左侧山道，只是原本轻快的脚步慢了些。"

    narrator "脚印延伸向左面，路边的杂草被消融的雪水压弯了腰。"

label chapter_5:
    $ ai_sprite_outfit = "winter"
    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg forest_trail_left with fade
    show heroine winter_speak at heroine_winter_center
    narrator "她说，无法成为偶像"
    narrator "风凉浸浸的，白色的松树叶落下水来，摔进雪里，像是沉到大海里的一滴墨一样消失的无影无踪。"
    ai "真好啊，天气，这种时候决定出来登山真是太合适了！"
    taku "是啊，如果我一个人的话，估计会先去泡泡温泉吧。毕竟坐了那么久火车。"
    ai "让你一起出来真是抱歉。"
    taku "还好。"
    ai "我问你啊。"
    narrator "她背过身来，动作优雅、灵动到不可思议，就像是精心准备好的一样。"
    narrator "从树梢间倾泻下来的阳光，晃过她精致的侧脸，在她的黑色皮袄上来回跳跃。"
    narrator "她背着手，身子面向顾天鹏，一步一步向后退。"
    ai "你喜欢登山吗？"
    taku "喜欢看书，锻炼，听歌，出门倒是难得，登山更不用说，但不讨厌。"
    ai "喜欢看书，锻炼，听歌，难得出门。"
    narrator "星野爱鹦鹉学舌。"
    ai "怎么想到出门远足呢，到这里。"
    taku "放松。"
    ai "放松。"
    narrator "她又学了一句，眨了下眼睛。"
    ai "之前心情很不好？"
    taku "为什么这么说。"
    ai "不然放松什么。"
    taku "不用理由，想做就做了。"
    ai "这样啊。"
    taku "就这么简单。"
    ai "就这么简单啊。"

    scene bg forest_trail_right with dissolve
    show heroine winter_neutral at heroine_winter_center
    narrator "她没再说话，又转身朝前，一步一步踏出脚印，凝眸望向蔚蓝如海湾的天空。"
    narrator "长长的云朵延伸到很远的地方，如同铺出了一条登上仙境的道路。"
    narrator "走在身后，顾天鹏默然无语。"
    narrator "看着星野爱那头亮紫色的秀发、自信挺拔的身影、缓缓移动的身姿。"
    narrator "他感觉自己的目光像是被强大的黑洞引力吸引了一般，怎么也挪不开。"
    narrator "消融的雪发出清晰的声音，叮咚叮咚的。"
    narrator "消逝的时间像是被微风吹到树林里，再也回不来。"
    narrator "良久，顾天鹏打破沉默。"
    taku "你呢。"
    ai "什么？"
    taku "喜欢登山？"
    ai "不讨厌。"
    taku "具体来说喜欢什么。"
    narrator "沉吟片刻，星野爱扭动腰肢，露出美好的侧脸，灿烂的笑颜。"
    narrator "她把手放在动人的唇前。"
    ai "是秘密！"
    taku "又来？"
    ai "嘻嘻。"
    narrator "她刻意放慢步调，等顾天鹏和她并排。"
    ai "若隐若现的秘密，这就是女孩子！"
    taku "神秘。"
    ai "并且完美！"
    taku "和我想的不太一样。"
    ai "你怎么想？"
    narrator "她有些好奇。"
    narrator "顾天鹏望着前方，道路出奇的明亮。"
    taku "Sugar and spice, and everything nice."
    ai "说这话我听不懂。"
    narrator "她大概是鼓起嘴嘟囔。"
    taku "女孩子是由砂糖、香辛料和一切美好的东西组成的。"
    narrator "她把食指依附在脸颊上。"
    ai "嗯……感觉甜甜的。"
    taku "是的。"
    ai "可是少了点什么。"
    taku "少了点什么？"
    ai "大概，神秘？"
    narrator "她盯着耷拉的树梢，又转向顾天鹏。"
    ai "想不到贴切的了，该怎么形容？"
    taku "谎言？"
    ai "没错！"
    ai "是这种感觉，既神秘又危险的女孩子，一级棒！"
    taku "了不起。"
    ai "了不起的星野爱！"
    taku "璀璨的星野爱。"
    ai "完美的星野爱！"
    taku "再说下去就是自负了哦。"
    narrator "她笑着吐了下舌头。"
    narrator "顾天鹏有些愕然：身旁的少女连装糊涂都如此令人怦然心动。"

    scene bg ch5_forest_midtrail with dissolve
    show heroine winter_shy at heroine_winter_center
    narrator "寂静的松树林里，两人继续向前。"
    narrator "顾天鹏只顾爬山，手也未从兜里伸出来。"
    narrator "星野爱则时不时跑向前方，触碰偶然飞来红蜻蜓、不知名的小鸟，时不时绕回来，挑逗路边的野花、杂草。"
    narrator "埋进雪里的脚印纵横交错，忽浅忽深，不分彼此，唯有前行的方向明确。"

    scene bg ch5_forest_clearing with dissolve
    show heroine winter_neutral at heroine_winter_center
    narrator "再往前，道路逐渐开阔，鸟叫声愈发清晰。"
    narrator "运动鞋也好，长筒靴也罢，无论是哪一种，踩上积雪的时候，都会发出抚慰心弦的沙沙声。"
    narrator "直到积雪层变厚，阳光变得更加温暖，清风便从山腰处了无踪迹了。"
    narrator "呼出的白气升到太阳里，藏到飘渺的云端。"
    narrator "耳边唯有心跳和脚步声长存，除此之外就空无一物了，视野是清新的白。"

    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg ch5_summit_sunset with fade
    show heroine winter_speak at heroine_winter_center
    narrator "登上山顶已近黄昏。"
    narrator "一路上，两个人停停歇歇，休息时便交谈。"
    narrator "从杉树叶聊到芭蕉，从无垠山脉聊到碧蓝之海。"
    narrator "聊了雪，聊了风，聊了鹿儿岛的樱花，聊了电视节目主持人的搞笑着装。"
    narrator "连几分熟的鸡蛋最好吃也聊，聊了很多很多，多到统计不完，多到文字写不下。"
    ai "是吧是吧！"
    narrator "站在山巅，星野爱微笑着说，那笑容很像是电影里的某个特写镜头。"
    ai "那个节目真的很不错呢！"
    taku "很难不赞同。"
    ai "绝对赞同！"
    ai "弘中绫香，田中美奈实啊什么的……你知道那个动作吧？超有名。"

    $ ai_sprite_mode = False
    $ event_cg_mode = True
    scene cg ch5_summit_ai_sunset with dissolve
    narrator "她面朝顾天鹏，落了雪的木栏在她之后，橙黄色的落日在木栏之后。"
    narrator "她仿佛背靠着夕阳，歪了下脑袋，手指触及下巴。"
    ai "‘有点心机又如何呢？’。绝对，绝对听过吧！"
    taku "听过。"

    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg ch5_summit_sunset with dissolve
    show heroine winter_neutral at heroine_winter_center
    narrator "这之后，他们爬上铺了层薄雪的小土丘，站在很高的地方朝山下俯瞰。"
    narrator "温泉旅馆变成了一个黑点般大小的存在，其他房屋亦是如此，行人已经完全看不清。"
    narrator "日暮笼罩的雪地上，墨黑墨黑的松树星罗棋布。"
    narrator "当斜阳散发出最后的光辉，那一道道阴影便被无限地拉长。"
    narrator "看厌了风景，他们从土丘上下来，星野爱一屁股坐进雪里。"
    taku "小心感冒。"
    ai "就这一次！"
    narrator "她撒娇似的说，一边对顾天鹏温和一笑，一边拍了拍身旁的雪地，示意他也坐下。"
    narrator "顾天鹏犹豫一下，她又像是催促似的扇动着手掌。"
    narrator "顾天鹏叹了口气，坐到她身边。"
    narrator "雪化的不快，但起身之后一定会有潮湿的感觉。"
    ai "好轻松。"
    taku "的的确确很轻松。"
    narrator "落日西沉，晚霞攀上二人的正脸，闯进他们双眸之中。"
    narrator "过了一会儿，顾天鹏突然问。"
    taku "你想当偶像？"
    ai "嗯？"
    taku "想当偶像？"
    ai "嗯——"
    narrator "她扬起脸，最后一头栽进雪地里。"

    $ ai_sprite_mode = False
    $ event_cg_mode = True
    scene cg ch5_snow_confession with dissolve
    taku "干嘛呢？"
    ai "舒服！"
    taku "不想回答问题？"
    ai "还在想嘛！"
    taku "好呢。"
    narrator "她把右手举高，眯起一边眼睛，从分开的指缝间观察绝美的黄昏。"
    ai "真漂亮！"
    ai "你也躺下来，怎么样？"
    taku "很冷吧。"
    ai "就这一次！"
    narrator "顾天鹏没办法似的呼出一口气。"
    narrator "两人的身体沉进雪地里，石灰色的云仿佛抬手便能抓进掌心。"
    narrator "他们默默无语，感受着时而飘过的一阵南风，风里全是雪和泥土的清香。"
    taku "其实想当偶像吧？"
    ai "不想。"
    narrator "星野爱这次没犹豫。"
    narrator "顾天鹏长长地嗯了一声。"
    taku "理由呢？"
    ai "我没兴趣。"
    taku "没兴趣啊……"
    ai "顾天鹏，我说过吧，我是孤儿这件事。"
    taku "嗯。"
    narrator "顾天鹏沉默一下。"
    taku "抱歉。"
    ai "嗯嗯——"
    narrator "她抿着嘴唇，又说。"
    ai "顾天鹏，你觉得什么是偶像呢？"
    taku "舞蹈，唱功，演技，好看的身材，脸。"
    ai "太直白了吧！"
    narrator "她好像被逗笑了。"
    taku "文艺点：精神支柱？"
    ai "嗯……精神支柱。"
    narrator "她字斟句酌重复道。"
    narrator "顾天鹏侧过脸，星野爱仍目视上方。"
    ai "从小在孤儿院长大的我，记忆中，从没爱过别人，也从来没被别人爱过。"
    narrator "从夕阳吹来的晚风掠过雪地，拨动她的刘海，旋即钻进松树林中。"
    narrator "等风停歇，她自嘲似的扬起嘴角，露出前所未有的，近乎可以用凄美来形容的微笑。"
    ai "这样的我，怎么能够成为偶像？"

    window hide
    menu:
        "急着告诉她你可以":
            narrator "顾天鹏几乎想立刻反驳。那不是出于安慰，而是因为他在她眼里看见了和舞台灯一样明亮的东西。"
            taku "能不能成为偶像，不该只由过去决定。"
            narrator "这句话像被雪地吸走一半，剩下一半却稳稳落到她身边。"
            ai "你说得好像很容易。"
            taku "不容易，所以才值得你去做。"
            narrator "她笑着点头，可那笑意没有在眼底停留太久。被安慰过后，有些话反而更难继续说下去。"
            narrator "山顶的风把沉默吹散，黄昏很快过去。"
            jump ending_empty_encouragement

        "先把她的话完整接住":
            narrator "顾天鹏没有急着把自己的判断塞过去。"
            narrator "她说出这句话已经用了很大力气，轻率的鼓励也许会显得太薄。"
            taku "我听见了。"
            ai "只是听见？"
            taku "先听见，再回答。"
            narrator "星野爱低下眼睛，像是第一次允许这句话在空气里停留得久一点。"

label chapter_6:
    $ ai_sprite_mode = False
    $ event_cg_mode = True
    scene cg ch6_ryokan_terrace_ai with fade
    narrator "温泉、赏雪、约会"
    narrator "那天天黑的很快，太阳不经意就掉进了山脉的沟壑里。"
    narrator "黄昏远去，星星一股脑全跑了出来。"
    narrator "顾天鹏告诉她：这边是天琴座，那边是仙女座。"
    narrator "天空深蓝至极，如同将五千米下的太平洋翻转过来。风停了好久。"
    ai "需要向粉丝倾诉爱意的偶像……"
    narrator "望着夜空中最亮的那颗织女星，恍若隔世光景的微笑浮现在星野爱脸上。"
    ai "我怎么可能办得到嘛。"

    $ ai_sprite_outfit = "winter"
    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg ch6_ryokan_genkan_night_snow with fade
    show heroine winter_surprised at heroine_winter_center
    narrator "回到旅馆已是夜里七点十分，店里灯光微黄，人影攒动。"
    narrator "回头看去，门外恰好飘起雪来，雪势不大，但用一晚上的时间，大概足以淹没白日的足迹了。"
    narrator "二人先在玄关处换鞋。"
    ai "……阿秋！"
    taku "果然要感冒了吧。"
    ai "唔……你绝对也快了！"
    taku "那也是托你的福。"
    ai "嘿嘿，就这一次！"

    window hide
    menu:
        "把备用暖宝宝递给她":
            narrator "顾天鹏从口袋里摸出没用完的暖宝宝，递到她手心里。"
            narrator "星野爱低头看了看，又抬头看他，笑意比旅馆灯光还要暖。"
            ai "这个我收下了。明天还你一个更暖的。"
            taku "暖宝宝还能升级？"
            ai "当然，星野爱限定版。"
            narrator "这个玩笑让玄关变得热闹，也把刚才山顶残留的沉重暂时推远了一点。"

        "提醒她回房先换干衣服":
            narrator "顾天鹏没有顺着她的玩笑走，而是把声音压得认真了些。"
            taku "先回房换衣服。感冒了，明天的计划全会泡汤。"
            ai "收到，临时监护人先生。"
            narrator "她朝他敬礼，转身时却真的加快了脚步。"

    $ ai_sprite_outfit = "stage"
    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg ch6_room_fire_warm with dissolve
    show heroine stage_speak at heroine_bust_center
    narrator "他们简单吃过晚饭，又要了一碟花生，半碟兰花豆，半碟葡萄，半碟青提，一瓶手打橙汁。"
    taku "可乐要不要？"
    ai "算了，我不大喜欢喝碳酸饮料。"
    taku "好。"
    narrator "拿着吃的回到房间，他们把湿了一半的衣服挂到火炉边上烤干。"
    narrator "柴烧了不到三分之一，亮红色的火星子不时会从里面冒出来。"
    narrator "关上窗户后，冷风像是野兽一样拼命想往屋子里钻。"
    narrator "除了幽咽的风声、炉壁发出的噼里啪啦的声响，此外便万籁俱寂了。"
    narrator "这个时候，葡萄咬碎时的噗嗤声音都分外清亮。"
    ai "去洗澡吗？"
    narrator "星野爱把围巾也挂到炉壁旁边。"
    taku "一会儿再去。"
    ai "尽快哦，小心真的感冒……阿秋！"
    narrator "燃烧的木柴突然地响了，顾天鹏盯着她，她露出一副可爱的笑容。"
    ai "我先去了！"
    narrator "说完便夹着白色的浴巾离开。"

    $ ai_sprite_mode = False
    scene bg ch6_room_fire_warm with dissolve
    narrator "没有其他人的屋子，顾天鹏将上衣脱下。"
    narrator "前去洗浴之前，他先做了一百个蹲起，又做了八十个俯卧撑。"
    narrator "仰卧起坐做到第七十二个的时候，门被哐当一下推开。"
    ai "顾天鹏，再晚点的话……"
    narrator "刚带上门的星野爱注意到正在锻炼的顾天鹏，声音一下子顿住。"
    ai "你、你在干嘛？"
    taku "加强身体素质的练习。"
    narrator "顾天鹏说着，仰卧起坐又做一个。"
    ai "这么晚了还做？"
    taku "每天都做。"
    ai "这样……"
    narrator "她嬉皮笑脸走过来。"
    ai "不过该说不说，身材不错嘛。"
    taku "谢谢。我听过最动听的夸奖。"
    ai "是吗？"
    taku "毫无疑问。"
    narrator "做完仰卧起坐，顾天鹏深吁一口气。"
    narrator "聚精会神的时候，他才仔细打量起已经进来小半会儿的星野爱。"
    narrator "她用毛巾包住长发，旅馆浴衣松松裹着身体，几缕蓝紫色的鬓发从其间晃荡出来。"
    narrator "他礼貌地别开视线，星野爱像是感应到他转头动作似的抬头瞥他一眼，然后浅浅地笑了下。"
    ai "再晚点浴场就要关咯。"
    taku "现在就去。"

    $ event_cg_mode = False
    scene bg ch6_onsen_night with fade
    narrator "露天的浴场，人数已不过三个，大概是来的太晚的缘故，顾天鹏想。"
    narrator "他脱下衣物钻进温泉，一边感受着水池带来的暖意，一边靠在光滑的桑拿石上仰望月亮。"
    narrator "下起雪的时候，云也似乎变多了。"
    narrator "在山顶上看见过的星星如今不剩几个，唯独皎洁的月光依旧皎洁，月影如街灯一般。"
    narrator "从温泉上来，他用毛巾擦干身体，换上旅馆提供的棉质大短裤。"

    $ event_cg_mode = True
    scene cg ch6_gatsby_reading_night with dissolve
    narrator "回到房间之后，星野爱已经吹好头发，问他能不能翻一下《了不起的盖茨比》。"
    taku "当然没问题。"
    narrator "顾天鹏将书拿出来递过去，星野爱便照着他写在文字边的日语翻译认真阅读起来。"
    narrator "这是一个爱的幻灭的故事。"
    narrator "因为在任何时代任何国家，都会有始终抱着爱的梦想并为之不惜一切的人，虽然他们寥若晨星……"
    narrator "无声的雪飞扬在窗户外面。"

    $ event_cg_mode = False
    scene bg ch6_room_fire_warm with dissolve
    narrator "灯灭之前，顾天鹏去刷了牙，洗完脸。"
    narrator "重新回来的时候，他看见星野爱已经趴在桌子上睡着了。"
    narrator "鼾声微弱，《了不起的盖茨比》压在她脸下面。"
    narrator "他轻轻放平对方的身体，给她盖好被褥，自己在另一头侧身入睡。"

    $ ai_sprite_outfit = "stage"
    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg ryokan_room with fade
    show heroine stage_shy at heroine_bust_center
    narrator "第二天醒来，月影被暖阳替代，雪不知何时已经停了。"
    narrator "顾天鹏穿上衣服，沿着不容易积雪的长道来回跑了十公里，之后又擦干汗水冲了个澡。"
    narrator "九点多的时候，星野爱总算醒来。"
    narrator "顾天鹏给她带了早餐：抹了蓝莓酱的两块吐司面包，一瓶知名产地的纯牛奶，两节香蕉，用刀切半的半个苹果。"
    ai "谢谢。"
    narrator "星野爱有些意外。"
    taku "没什么。"
    narrator "顾天鹏继续看书。"
    narrator "吃完早饭，星野爱提出出门赏雪，顾天鹏点头，合上书，他们换上冬装出发。"

    $ ai_sprite_outfit = "winter"
    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg ch6_snow_village_bridge with dissolve
    show heroine winter_speak at heroine_winter_center
    narrator "这一天，阳光不如昨天强烈，温度也稍微降了一些。"
    ai "哈~"
    ai "明明还是十一月。"
    ai "不过比冬天还冬天！"
    narrator "她望着刚刚吐出的一口白气，看样子似乎很开心。"
    taku "大概雪下了一夜吧。"
    ai "白天怎么不继续呢？"
    taku "那该会有多冷啊。"
    ai "管他呢！"

    $ ai_sprite_mode = False
    $ event_cg_mode = True
    scene cg ch6_snow_wish_ai with dissolve
    narrator "戴着手套的星野爱蹲下身子，双手捧起一股雪，然后猛地起身往天上使劲撒。"
    ai "彻彻底底的，彻彻底底的，下一场超大超大的雪吧！"

    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg ch6_snow_village_bridge with dissolve
    show heroine winter_neutral at heroine_winter_center
    narrator "他们漫步在雪中，像是走进了克劳德·莫奈的油画里。"
    narrator "映入眼帘的皆是难以忘怀的特别景致：厚厚的积雪覆盖在房顶之上，十几米高树像是盛开的一朵巨大白花。"
    narrator "云朵丝丝缕缕，金色的阳光照向残破的木桥、孤零零的树墩，远处的炊烟冉冉而上。"
    narrator "看着不紧不慢的人影，一动不动的红色信箱，顾天鹏的身心也完全放松下来。"
    narrator "似乎不知不觉间，他远行的目的就已经达到了。"
    narrator "倘若天气更好些，又正好有阵暖暖的微风吹过，这种感觉便会更加清晰了。"

    $ ai_sprite_mode = False
    $ event_cg_mode = True
    scene bg ch6_soba_shop with dissolve
    narrator "中午的时候，他们走进那家旅行攻略提到过的店里，一起体验了一次手打荞麦面。"
    narrator "到了下午，他们又从温泉旅馆出发，乘上价格低廉的公交车，去草莓村吃了“越后姬”。"

    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg ch6_strawberry_greenhouse with dissolve
    show heroine winter_speak at heroine_winter_center
    ai "哦~好吃！"
    narrator "在草莓村的时候，星野爱由衷地赞叹道。"
    taku "真的很不错，应该没人会不喜欢吃这个吧？"
    ai "多亏了你的攻略！"
    taku "多亏了卖给我旅行攻略的大叔。"
    ai "也是！"

    scene bg ch6_onsen_street_moon with fade
    show heroine winter_neutral at heroine_winter_center
    narrator "转回温泉旅馆，他们提前下了车，六点多的时候，月光皎白凄清。"
    ai "今天很开心。"
    narrator "月色之下，星野爱的身影融进夜幕里。"
    taku "我也是。"
    narrator "顾天鹏慢慢地跟在她身后。"
    narrator "远处的房屋犹如星星点点，空漠是唯美的克莱因蓝。"
    ai "明天要去哪好呢？"
    taku "放风筝，滑雪，看麋鹿。"
    ai "不错嘛。"
    taku "还有很多呢。"
    ai "全都要玩个遍！"

    $ ai_sprite_mode = False
    $ event_cg_mode = True
    scene cg ch6_moonlit_ai with dissolve
    narrator "她开心地大喊一声，窈窕的身影在夜色下绕动、旋转。"
    narrator "这一刻，连月色都相形失色。"

label chapter_7:
    $ ai_sprite_outfit = "winter"
    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg ch7_ryokan_breakfast with fade
    show heroine winter_surprised at heroine_winter_center
    narrator "你比任何人都适合成为偶像"
    narrator "十一月十一日那天，天气晴得温和。"
    narrator "明晃晃的光线从窗户外透进来。"
    narrator "小鸟在树梢上啁啾，又扑腾着翅膀飞走，飞得比山还高。"
    taku "这么早就出门？"
    ai "稍微锻炼一下。"
    taku "不吃早饭吗？"
    ai "回来再吃。"
    narrator "柔软的身体横坐在被褥上，星野爱用手支着榻榻米，漂亮的眼睛朝窗外望去。"
    ai "也是呢，锻炼的好天气！"
    taku "要不要一起？"

    window hide
    menu:
        "认真邀请她一起晨跑":
            narrator "顾天鹏把这句话说得比玩笑更认真一点。"
            narrator "如果她真的愿意，他大概会放慢速度，陪她在雪地里跑到太阳升起来。"
            ai "一起？在雪地？"
            narrator "星野爱掀开被角，脚尖刚碰到榻榻米就被冷意劝退。"
            ai "不行，还是很冷！我就算啦。"
            taku "那我替你把晨跑额度用掉。"

        "只是开个不会被答应的玩笑":
            narrator "顾天鹏自己也知道，这更像一句清晨的寒暄。她不答应，他也不会意外。"
            ai "一起？在雪地？虽然开了太阳不过应该还是很冷！我就算啦。"
            narrator "她立马抬手拒绝。"
            narrator "顾天鹏也没想她会答应，于是微微点头，星野爱则露出不失温度的笑容。"
            taku "那我尽量摔在显眼的地方咯。"
            ai "那一定要很显眼才行。"
            taku "第三十三盏路灯之下怎么样？"
            ai "哈？坏了的那个？一点也不显眼！"
            taku "等路灯全亮了，黑暗的地方反倒显眼了吧。"
            ai "是哦，好像。"
            narrator "玩笑被玩笑带走，晨跑也只是晨跑。等他真的出门时，清晨的空气里少了一点刚才差点出现的认真。"

    ai "雪那么大，注意别脚滑了哦！"
    narrator "他离开之前，星野爱这么对他说。"
    ai "否则我还得一个人去外面找你，绝对很麻烦。"

    $ ai_sprite_mode = False
    $ event_cg_mode = False
    scene bg ch7_snowy_run_road with fade
    narrator "五公里的来回，身体完全热了起来。"
    narrator "跑完步，顾天鹏返回旅馆，像昨天一样冲了澡，擦拭身体，换上干净的衣服。"

    $ ai_sprite_outfit = "winter"
    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg ch7_ryokan_breakfast with fade
    show heroine winter_speak at heroine_winter_center
    narrator "他走进提供早餐的地方，头上戴着兔子发卡的星野爱坐在榻榻米上向他招手。"
    ai "顾天鹏，这边！"
    narrator "他点头，星野爱往旁边挪了一个屁股的空位，用手在上面拍了拍，示意他坐下来。"
    narrator "他走过去盘腿坐下。"
    ai "我看看……面包、蔬菜沙拉、牛奶、味噌汤，还有香蕉，苹果，橘子拿了两个，够不够吃？"
    taku "太多了吧？"
    narrator "顾天鹏望着桌上的那些东西。"
    ai "不多不多。"
    narrator "星野爱笑着拍了两下他的肩膀。"
    ai "刚刚锻炼完，又还是十七岁，不多吃点怎么长身体？"
    taku "都想那么周到了。"
    narrator "顾天鹏叹气说。"
    taku "唯独没想到有可能会浪费？"
    ai "没关系没关系，吃不完的就全交给我好了，我帮忙解决！"
    narrator "顾天鹏看向她，她只是好看的用微笑回应。"
    narrator "那笑容挥之不去，恬静的脸颊活像一道淡淡的虚影。"
    narrator "顾天鹏有种恍惚的错觉：仿佛那笑容要在时间上刻下鲜明的痕迹一样。"

    $ ai_sprite_mode = False
    $ event_cg_mode = False
    scene bg ch7_cafe with dissolve
    narrator "直到中午，阳光更灿烂了，树叶嫩绿，鸟叫叽喳，几处飘着炊烟。"
    narrator "他们吃完午饭，又去到附近的咖啡屋要了两杯热咖啡。"

    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg ch7_cafe with fade
    show heroine winter_neutral at heroine_winter_center
    narrator "侍应生是位年轻的女子，年龄大概也就二十岁上下。"
    narrator "她不紧不慢地将茶托放低，把两杯热咖啡取下来。"
    waitress "需要加糖吗？"
    narrator "顾天鹏用眼神询问星野爱。"
    ai "要的！"
    taku "麻烦了。"
    narrator "顾天鹏对侍应生点头。"
    narrator "那侍应生点头，白炽灯下的小脸有些泛红，估计难得看到像顾天鹏这种长相绝佳的少年。"
    narrator "等砂糖、方糖之类的东西拿上来，星野爱道了声谢谢，顾天鹏也是。"
    narrator "侍应生离开，顾天鹏把砂糖加进咖啡搅拌，然后一点点地呷了几口。"
    narrator "星野爱则对着杯面上的拉花观察一会儿，对着冒出来的白烟轻轻吹气。"
    ai "哦！拍照拍照！"

    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg ch7_cafe with dissolve
    show heroine winter_speak at heroine_winter_center
    narrator "这个时候，店里放起歌来，播的是 Elisa 的《Eppure Sentire》。"
    narrator "那音质听着不像是用现代的电子设备播放的，顾天鹏听了一会儿，感觉有点像唱片机。"
    narrator "他一边听歌一边啜口咖啡，面前的星野爱用手机咔嚓咔嚓连照三四张照片。"
    ai "完美！"
    taku "咖啡都要凉了。"
    ai "咦，不会吧。"
    narrator "她把手机摆在桌面，榉木桌一下子闯进镜头里，画面黑漆漆一片。"
    narrator "左下角刚拍好的那张照片有两杯咖啡，水仙花竖在一边。"
    narrator "她捧着杯子抿了一口，然后惊喜地抬起头，咽下咖啡。"
    ai "热着呢，而且味道很不错！"
    taku "我也挺喜欢的。"
    narrator "那天刻下的第二个笑容，顾天鹏想。"

    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg ch7_cafe_street with fade
    show heroine winter_speak at heroine_winter_center
    narrator "从咖啡屋离开，对面是一家酒店，左面邻着烤肉店，右边是便利店，再边上则是转角。"
    narrator "白色的电线杆立在自动贩卖机前面，橘黄色的垃圾桶上有雪悄悄融化。"
    narrator "身后传来的歌曲变化到蒸汽波风格，两人在门口商量。"
    taku "放风筝？"
    ai "现在好像没什么风啊。"
    narrator "星野爱托起一只手，眼睛望向蓝天，像是在感应风的方向。"
    taku "那就去滑雪好了。"
    narrator "她摸着下巴思索着什么，随后跳到两个台阶之下，背过手，面朝顾天鹏，上半身稍稍前倾。"
    ai "去看麋鹿吧！"
    taku "现在？"
    ai "嗯！"
    taku "好。"

    $ ai_sprite_mode = False
    $ event_cg_mode = False
    scene bg ch7_deer_snowfield with fade
    narrator "于是他们去看了麋鹿，在一个超大超大的雪场。"
    narrator "那里连树都很少，阳光毫无遮拦地扑向大地，头上的云朵竟一片也没有。"
    narrator "远远望去时，棕褐色的干草从雪地里刺出来，像极了自然生长在那里的麋鹿角。"
    narrator "他们坐上观光车，工作人员为他们介绍起麋鹿的长相、种类，如何区分麋鹿的性别，又说了麋鹿的迁徙路线。"
    snow_staff "每年都要迁徙，脖子上的项圈是用来帮助观察和研究的……"

    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg ch7_souvenir_shop with fade
    show heroine winter_neutral at heroine_winter_center
    narrator "下午四点，他们从雪场离开，公交车坐了三站便下。"
    narrator "路过一条没什么雪的大路时，星野爱指着附近的一家小店。"
    ai "这里有纪念品卖。"
    taku "纪念品？"
    ai "折扇，手帕之类的。"
    narrator "她扯着套在大拇指上的手套。"
    narrator "之后两人走进店里，收银员亲切地说了一声欢迎光临，他们开始挑选纪念品。"
    narrator "星野爱买了一个 Sankyo 的胡桃木质音乐盒，又买了一张印着兔子图案的粉色手帕。"
    narrator "从店里出来，她看到顾天鹏两手空空，一副对什么都不怎么感兴趣的样子。"
    narrator "她止住脚步，把手里的东西塞到顾天鹏手中。"
    ai "帮我拿一下，顾天鹏。"
    taku "东西忘拿了？"
    ai "一会儿就好！"
    narrator "她说完便折回店里，再次出来的时候，手里多了一个用来装纪念品的米白色纸袋。"
    ai "给。"
    narrator "她将挂在手指上的纸袋递到顾天鹏胸前。"
    narrator "顾天鹏一边把替她保管的东西还给她，一边接过纸袋，用眼神询问：什么东西？"
    ai "围巾。"
    taku "围巾？"
    ai "图案是男孩子用也不会害羞的，放心好啦！"
    taku "我倒不是想问这个……"
    ai "就当是谢礼收下，可以吧？"
    narrator "说完，也不等顾天鹏回应，星野爱已经背过身去。"
    narrator "她高举胳膊伸了个懒腰，露出短款棉袄下的白皙腰肢。"
    narrator "顾天鹏望着她的背影，她则用慵懒的声音呻吟一声。"
    ai "今天也很开心呢。"
    taku "谢谢，那我收下了。"

    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg ch7_souvenir_shop with dissolve
    show heroine winter_shy at heroine_winter_center
    narrator "黄昏的那阵风吹的悠悠然，将星野爱的围巾和长发吹到下沉的落日里。"
    narrator "夕晖映照到她迷人的侧脸上，远方的山麓笼罩着淡淡的光影。"
    narrator "往后的时间，他们折回旅馆。"
    narrator "黑暗一点点吞噬了山脚，眼望远方，山巅却变得愈发清晰。"
    narrator "直到道路旁的灯光亮起，限速牌的标志折射着类似金属的白光。"
    narrator "有人骑着越野自行车从马路经过，车身是黑还是红，教人根本分不清了。"
    narrator "走在路上的时候，顾天鹏总感觉天空都是冰凉而透明的。"

    $ ai_sprite_mode = False
    $ event_cg_mode = False
    scene bg ch7_rainy_ryokan_room with fade
    narrator "到越后汤泽的第四天，十一月十二日。"
    narrator "那一天，白天下了些小雨，中午的时候大了一点，下午却突然停了下来。"
    narrator "透过窗户向外看，天空阴沉沉一片，云里好像搅拌了混凝土一样。"
    narrator "傍晚的时候，一道不可思议的光线仿佛从云端劈下来似的。"
    narrator "尽管见不到太阳，但顾天鹏想不到比拨云见日更加合适的词汇来形容了。"
    narrator "那天夜里，没有风，没有雨，雪也没飘落一颗。"
    narrator "听旅馆的几个女孩子聊起，某个私塾的轻音部学生要来附近登台演出。"
    narrator "因为白天没怎么出门而郁闷的星野爱，就向其中一个女孩子仔细打听了一下，之后便拉着顾天鹏一起过去看表演。"

    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg ch7_student_stage_night with fade
    show heroine winter_surprised at heroine_winter_center
    ai "没开始吧？"
    taku "看样子没开始。"
    ai "太好了！"
    narrator "到了目的地的时候，由于跑得太急，星野爱这才呼出一口气。"
    narrator "附近的空地，有人把积雪扫去，在中间搭了木柴，点燃亮腾腾的篝火。"
    narrator "那群人又在后面立了块几米高的桦木板，盖上红幕，搭了平台和楼梯，造出一个不大不小、但却有模有样的舞台。"
    narrator "凭借可爱的相貌、甜美的笑容，星野爱一路道谢，拽着顾天鹏的手腕一直挤到第一排的位置。"

    $ ai_sprite_mode = False
    $ event_cg_mode = False
    scene bg ch7_band_soundcheck with dissolve
    show band_guitarist at band_guitarist_stage
    show band_bassist at band_bassist_stage
    show band_keyboardist at band_keyboardist_stage
    show band_drummer at band_drummer_stage
    narrator "过了一会儿，电吉他、架子鼓、贝斯、键盘，所有乐器通通就绪，接着是试音，然后试音结束。"
    narrator "众人望向台上，星野爱也紧盯着前方，几个个子不高的少女从右边楼梯上来。"
    narrator "当所有人都把注意力放在聚光灯之下的时候，唯独顾天鹏觑了一眼星野爱的侧脸。"
    narrator "那时，舞台的灯光照在她的脸颊，照上她精致的鼻尖。"
    narrator "她的双眸仿佛成了世间最亮的事物。"
    narrator "不需要任何妆容，她就已经是如此适合舞台的聚光灯了。"
    narrator "那是一幅怎样的画面，顾天鹏想了很久，但依旧找不到贴切的形容词。"
    narrator "呼之欲出的是一句话："
    narrator "这位名叫星野爱的少女，就像是一个天生的偶像一样。"

    hide band_guitarist
    hide band_bassist
    hide band_keyboardist
    hide band_drummer
    $ ai_sprite_mode = False
    $ event_cg_mode = False
    scene bg ch7_band_soundcheck with dissolve
    show band_guitarist at band_guitarist_stage
    show band_bassist at band_bassist_stage
    show band_keyboardist at band_keyboardist_stage
    show band_drummer at band_drummer_stage
    narrator "他别过视线，舞台上，几个轻音少女互相对视一眼。"
    narrator "演出开始。"
    narrator "以架子鼓手互击鼓槌，喊出指令为先："
    band_drummer_girl "one! two! three! four! one! two! three!"

    hide band_guitarist
    hide band_bassist
    hide band_keyboardist
    hide band_drummer
    $ ai_sprite_mode = False
    $ event_cg_mode = False
    scene bg ch7_band_performance with dissolve
    show band_guitarist at band_guitarist_stage
    show band_bassist at band_bassist_stage
    show band_keyboardist at band_keyboardist_stage
    show band_drummer at band_drummer_stage
    narrator "电吉他声紧随其后。"
    narrator "身兼电吉他手的褐色短发少女负责指挥，作为贝斯手的黑色长发少女则用快速的击掌声来打节奏。"
    narrator "几秒的前奏之后，两名少女同时用上手里的乐器开始表演，键盘手也几乎是同一时间开始演奏。"
    narrator "乐器声，主唱声，赞美声，应援声，心跳声，掌声。"
    narrator "夜晚的越后汤泽像是被赋予了无穷的生命力一般。篝火燃烧向黑色的天幕。"
    narrator "一曲终了，第二首歌不多时便接上，然后是第三曲。"
    narrator "直到演出落幕。"
    band_bassist_girl "谢谢大家！"
    audience "K-ON！！！！"
    audience "最喜欢了！！！"
    audience "喔！！"
    audience "最好的轻音！！"
    narrator "所有的声音，唯独心跳和掌声经久不息。"
    narrator "离场之前，贝斯手兼主唱的黑色长发少女对台下的观众微微鞠躬。"
    narrator "正当少女要迈开步子下台时，贝斯连接音箱的插线忽然将她绊倒。"
    band_bassist_girl "啊？"
    audience "诶？"
    narrator "几个队友望着她，台下的观众全都愣在原地。"
    narrator "随后是一声盖过心跳的尖叫。"
    narrator "就连十几米外的松树都难以幸免，树梢上覆盖的积雪啪地一声落到地面。"

    hide band_guitarist
    hide band_bassist
    hide band_keyboardist
    hide band_drummer

    $ ai_sprite_mode = False
    $ event_cg_mode = False
    scene bg ch7_band_aftermath with fade
    narrator "九点四十的时候，表演正式结束，大家帮忙收整舞台，篝火用雪水熄灭。"
    narrator "返回旅馆的路上，人们聊起“蓝白碗”的事情，交谈氛围和谐融洽，大家都有说有笑的。"
    narrator "如同深海般的静谧夜色下，一头蓝紫色长发的星野爱落在人群后面，顾天鹏则跟在她旁边，手插进衣服里。"
    narrator "两人从大路走进小道，踏入雪地，路过村庄，村庄的家家户户亮着微黄的灯光。"
    narrator "他们就这样慢慢地把脚踩进雪里，像是要试探雪的深浅似的，留下一路的脚印。"

    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg ch7_village_moon_path with dissolve
    show heroine winter_shy at heroine_winter_center
    ai "轻音部吗？"
    narrator "星野爱像是在自言自语一般。"
    narrator "她忽然向前跑了几步，抬起双臂保持平衡，眼睛望着深蓝色的雪地，试图走出一条长长的直线。"
    narrator "结果可想而知，东歪西倒。"
    ai "她们那样的人，或许才适合成为偶像吧？"
    narrator "她耳语一样地轻声说。"
    narrator "闻言，顾天鹏只是静静地抬眼望向她。"
    narrator "那天夜里，月光拨开重叠的云雾，忽然照在她的背上，把她的身影概括得如此清晰。"
    narrator "顾天鹏险些看得失神。"
    taku "怎么会呢。"
    ai "观众喜欢她们，她们也喜欢观众，这应该就足够证明了……"
    narrator "星野爱继续向前。"
    taku "喜欢还是不喜欢，光靠看是不行的吧？"
    ai "嗯……"
    narrator "她仿佛在思索着什么，半天没有回应。"
    narrator "夜色渐浓，所见一派冬日之色，路灯和皓月争相发出光亮。"
    narrator "良久，顾天鹏止步原地，望着蓝得发黑的天际线。"
    taku "我觉得，或许你比任何人都适合成为一名偶像。"
    narrator "在那条歪歪扭扭的直线上延伸的脚印，未到旅店便停了下来。"
    narrator "忽起的凉风吹过星野爱的侧脸。"
    ai "谢谢你能这么说，顾天鹏。"

    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg ch7_village_moon_path with dissolve
    show heroine winter_shy at heroine_winter_center
    narrator "回过身的时候，少女刘海轻扬，澄澈的眼里闪烁着特别的光点。"
    ai "我真的，很高兴！"
    narrator "她笑了，大概是那天第三个笑容。"
    narrator "连顾天鹏都忘了：原来前两个笑是在昨天。"

label chapter_8:
    $ ai_sprite_outfit = "winter"
    $ ai_sprite_mode = False
    $ event_cg_mode = True
    scene cg ch8_ryokan_breakfast_wave with fade
    narrator "最后一天的风筝"
    narrator "留在越后汤泽的最后一天，温柔的雪飘了整夜。"
    narrator "五点多时雪停下来，山野的树木如同披上了一件白色风衣。"
    narrator "坑坑洼洼的雪地像是被水泥匠仔细补满了一样，饱满得和加满驼绒的棉被无异。"
    narrator "白天，两人在旅馆各吃了一块三明治做早餐。"
    narrator "嘴干的时候，星野爱用吸管喝了瓶草莓味的牛奶，顾天鹏则喝干两杯水。"

    $ ai_sprite_mode = False
    $ event_cg_mode = False
    scene bg ch8_cafe with dissolve
    narrator "那之后，他们又到之前去过的咖啡屋喝了一杯咖啡，点了没吃过的甜点。"
    narrator "周围的顾客在轻声交谈，有人点了特产的清酒，玻璃杯碰在一起发出清脆的声音。"
    narrator "同样的座位，桌面上的水仙花叶嫩绿如初。屋内果然比室外要暖和。"

    $ ai_sprite_mode = False
    $ event_cg_mode = True
    scene cg ch8_cafe_photo with dissolve
    ai "拍照拍照！"
    narrator "说着，星野爱已经横着手机对准甜点。"
    taku "等等。"
    narrator "顾天鹏想要靠后一点，防止自己闯进镜头，结果没来得及。"
    scene cg ch8_cafe_photo_alt with Dissolve(0.18)
    ai "咔嚓！"
    narrator "两杯咖啡、用柠檬片装饰的甜点、长长的水仙花、不明不暗的光线，还有少年好看的手指骨节，无一不被留进画面。"

    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg ch8_cafe_street with fade
    show heroine winter_speak at heroine_winter_center
    narrator "出了咖啡屋，他们在附近的一家冒着白色烟气的店里买了一份章鱼小丸子，加了甜酱。"
    narrator "吃完之后，他们又去自动贩卖机买了两瓶矿泉水，把手里用来装小丸子的纸壳塞进垃圾桶里。"
    ai "……太好吃了吧。"
    narrator "嘴里的食物还没咽下去，星野爱如同仓鼠一般鼓着腮帮子不清不楚地说。"
    taku "接下来要干嘛？"
    narrator "顾天鹏靠在自动贩卖机边上问她。"

    window hide
    menu:
        "让她决定最后一天的安排":
            narrator "顾天鹏把选择权交给她。最后一天这种词听起来有点寂寞，所以更应该由最贪婪的人来填满。"
            ai "嗯……还有什么没做过？今天全都要玩一遍！"
            taku "当然没问题。"
            narrator "关于接下来要到哪去的问题，星野爱决定边走边想，顾天鹏自然没有意见。"

        "按攻略补完还没去过的地点":
            narrator "顾天鹏翻了翻攻略，把还没做过的项目在心里排成清单。"
            narrator "既然是最后一天，至少不要留下能被轻易弥补的空白。"
            taku "攻略上还剩风筝、滑雪和神社。按距离排，先去风筝店。"
            ai "听起来像任务清单。"
            taku "任务清单也可以很快乐。"
            ai "那就把快乐一项一项打勾！"
            jump side_ch8_checklist_day

    narrator "望着眼前的少女，他总觉得对方身上带着一股与生俱来的亲和力。"
    narrator "那种奇妙的感觉，让人想要亲近她，喜欢她。说是吸引力也好。"

    $ ai_sprite_mode = False
    $ event_cg_mode = True
    scene cg ch8_takoyaki_ai with dissolve
    narrator "她把最后一颗小丸子塞进嘴里，热气和笑意一同漫出来。"
    narrator "顾天鹏甚至能从那副鼓起腮帮子的表情里，看出她准备把这一天也吃得干干净净。"

    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg ch8_takoyaki_vending with dissolve
    show heroine winter_neutral at heroine_winter_center
    narrator "他们绕过拐角，踏上雪道。"
    narrator "夹杂着杉树叶和泥土芬芳的清风从左面呼啸而来，将星野爱的羊绒围巾吹得猎猎作响。"
    taku "起风了。"
    narrator "星野爱用双手按住飘飞的围巾，却只能任由发丝随风而舞。"
    narrator "分不清是洗发水的香气，还是身体自然的香味。"
    narrator "总之，那味道就像秋天，和掠过的风一起悄然远去了。"
    ai "起风了，那就去放风筝好了！"

    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg ch8_kite_field with fade
    show heroine winter_speak at heroine_winter_center
    narrator "他们没吃午饭，午休的时候到了距离旅馆三四百米远的空地上。"
    narrator "那里雪不太厚，阳光都被常驻的北风吹斜了身体，树影笔直地在雪中延长。"
    narrator "远远望去，几个七八岁左右的孩子在放长绳盘上的玻璃线，身影在雪地上来回跑动。"
    narrator "天上飞着蝴蝶、鲤鱼、海豚，甚至连哆啦 A 梦都有。"
    narrator "两人看了一会儿，到附近的店里租了一只深海鱼图样的风筝，找了片空地开始放长引线。"
    ai "这个！就要这条大鱼！"
    taku "看起来确实很适合今天。"

    $ ai_sprite_mode = False
    $ event_cg_mode = True
    scene cg ch8_kite_run_ai with dissolve
    narrator "放风筝的过程还算顺利。"
    narrator "随着引线一点点伸出去，深海鱼飞到天边，几乎要和缥缈的云朵绕在一起。"
    narrator "蔚蓝色的天空仿佛化身为东京湾的海面。"
    narrator "当星野爱在下面欢快地奔跑时，深海鱼风筝便游移向前。"
    narrator "跑得累了，她把风筝交给顾天鹏，由顾天鹏带着大鱼继续徘徊在蓝天。"

    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg ch8_kite_field with dissolve
    show heroine winter_shy at heroine_winter_center
    narrator "两人都累了，他们就到小山丘上，将风筝线绑到遮天蔽日的枫树下面，然后一起背靠着树干坐下。"
    narrator "风刮过雪地，压弯了青草。"
    narrator "耳边尽是风声，偶尔会有不知从何而起的犬吠声传来，那声音如同来自另一个世界。"
    ai "怎么玩都玩不够呢。"
    narrator "枫树下，星野爱抱着膝盖，望向一缕飘动的云彩。"
    taku "那么多事情，如果每件都想做一遍，时间好像突然就紧了。"
    ai "嗯……但是全都想要！"
    taku "太贪婪了吧？"
    ai "没错，独一无二的贪婪！"
    narrator "她也转向顾天鹏，用手在下巴处比出一个勾的手势，露出一张自信满满的可爱脸。"
    ai "别人做过的，别人没做过的。无论哪一个，我都想做一遍。"
    taku "的确像是你。"
    ai "我星野爱，就是这么贪得无厌！"
    narrator "风声大了些。看着她那张略显狡猾、却又颇为可爱的侧脸，顾天鹏若有所思。"
    narrator "其他人也许不确定，唯独他彻底了解：这句话并非谎言。"

label side_ch8_checklist_day:
    $ ai_sprite_outfit = "winter"
    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg ch8_cafe_street with fade
    show heroine winter_speak at heroine_winter_center

    narrator "为了让任务清单不像作业，星野爱临时发明了“快乐盖章制度”。"
    ai "完成一个地点，就在攻略上画一个星星。"
    taku "没有印章？"
    ai "星野爱本人就是印章。"
    narrator "她用圆珠笔在攻略页边画下第一个歪星星，旁边写着“章鱼小丸子合格”。"
    narrator "风筝店的老板听见他们讨论任务清单，笑着从抽屉里拿出一张旧明信片，说如果能把风筝放到屋顶那么高，就送给他们。"
    scene bg ch8_kite_field with dissolve
    show heroine winter_speak at heroine_winter_center
    narrator "于是他们没有在枫树下坐很久，而是像两个被任务驱动的笨拙旅行者，在雪地上一次次放线、收线、再放线。"
    ai "再高一点！就差一点点！"
    taku "风向不稳定。"
    ai "那就拜托你和风谈判。"
    narrator "深海鱼风筝终于越过屋顶时，星野爱高兴得差点踩进雪堆。老板把明信片递给她，她立刻在背面写下第二颗星。"
    ai "风筝合格。顾天鹏谈判能力普通。"
    taku "普通已经很不错了。"
    narrator "接着是滑雪。她摔了两次，第三次终于滑过一小段平缓雪坡。顾天鹏没有笑，只在她站稳时鼓了两下掌。"
    ai "这个也要盖章。"
    narrator "神社前的石阶被雪水打湿，他们赶在闭门前买下御守。星野爱把最后一颗星画在攻略角落，盯着那一页看了很久。"
    ai "任务完成。"
    taku "开心吗？"
    ai "开心。"
    narrator "她回答得很快，却又轻轻补了一句。"
    ai "只是有点像把一天折成了很多小格子。"
    narrator "这条路线没有枫树下慢慢发酵的闲聊，却多了一张写满星星的攻略明信片。等他们回过神来，黄昏已经从神社的屋檐落下。"
    jump ch8_evening_after_tasks


label ch8_after_kite_rest:
    $ ai_sprite_mode = False
    $ event_cg_mode = False
    scene bg ch8_ski_slope with fade
    narrator "从枫树下离开，他们将租来的绳盘、风筝、玻璃线，全都收好还到店里。"
    narrator "下午的时候，他们去了专门的雪场滑雪，又尝了这里远近闻名的炸天妇罗。"
    narrator "雪道在黄昏前被余光照得发亮，连租来的滑雪板边缘都像镶着一圈淡金色。"

    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg ch8_shrine_dusk with fade
    show heroine winter_neutral at heroine_winter_center
    narrator "赶在黄昏之前，两个人又跑到附近的神社逛了一圈。"
    narrator "那里游客不算太多，空气竟然比外面还要清新不少。"
    narrator "他们祈福之后，买了交通安全御守、健康御守、事业御守和恋爱御守，一共花了不到两千日元。"
    taku "不要随便买御守送人，也不要擅自拆开御守的香囊，否则愿望就不灵验了。"
    narrator "神社里的工作人员这样跟他们说。"
    narrator "两人略感新奇地点头，样子几乎完全同步。"
    narrator "走出神社，一只乌鸦飞到出口的红色柱子上，用黑色的瞳孔注视大地，三只蝴蝶围绕着道路两边的紫花纷飞。"
    narrator "薄暮时分，天空被落日的余晖浸染，连雪都发黄发亮。"

label ch8_evening_after_tasks:
    $ ai_sprite_mode = False
    $ event_cg_mode = True
    scene cg ch8_moonlit_smile with dissolve
    ai "放风筝、滑雪、逛神社、吃你心心念念的炸天妇罗……"
    narrator "回去旅馆的路上，星野爱掰着手指念道。"
    ai "一样也没漏，这些都做完了！"
    taku "话是这么说，不过也不完全是我心心念念，你也喜欢得不得了嘛。"
    ai "不过，总感觉还差些什么。"
    taku "差些什么？"
    narrator "她低头沉思起来。"
    narrator "夕阳在她思考的间隙偷偷溜走，淡淡的白色重新笼罩着大地。"
    narrator "直到最后一颗雪球落下，夜幕深沉，山峦仿佛被困在冰冷的星空之中。"

    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg ch8_ryokan_room_moon with fade
    show heroine winter_shy at heroine_winter_center
    narrator "他们心满意足地返回旅馆，换了鞋。"
    narrator "星野爱带着浴巾去女性温泉，顾天鹏则一如既往坚持锻炼。"
    narrator "等顾天鹏也泡完温泉回来，星野爱已经在看他的《了不起的盖茨比》。"
    taku "还有什么想做的？"
    narrator "坐到榻榻米上，顾天鹏漾着笑意问她。"
    ai "什么？"
    taku "还有什么想做的没？要是还能想起什么的话，趁我们没睡着，估计还来得及。"
    ai "嗯……凿冰抓鱼？"
    taku "恐怕不太合理。"
    ai "那就喝一次这里的清酒咯？"
    taku "你不还是未成年吗？"
    ai "做一个美梦好了！"
    taku "今天晚上就可以。"
    ai "希望是这样。"
    narrator "她合上书，嘴角扬起一个好看的弧度。"
    narrator "旅馆的房间里，炉壁的火光摇摇晃晃。百叶窗外，天空暗得深邃，山体却泛着可爱的白光。"

    $ ai_sprite_mode = False
    $ event_cg_mode = True
    scene cg ch8_futon_talk_ai with fade
    narrator "火和灯都熄灭之后，两人睡在床的两侧，背对着背。"
    narrator "月光透过百叶窗的缝隙散射到地板，视野竟有些不可思议地亮了起来。"
    ai "顾天鹏。"
    taku "我在。"
    ai "顾天鹏。"
    taku "我在。"
    ai "顾天鹏。"
    taku "是。"
    ai "你要说我在。"
    taku "我在。"
    ai "我可以叫你顾天鹏吗？"
    taku "没问题，我不在意这些。"
    ai "顾天鹏。"
    taku "我在。"
    narrator "安静了一会儿，星野爱的声音再次传来。"
    ai "我其实不擅长记人的名字，你信吗？"
    taku "这句话不是谎言。"
    ai "但我还是记住了你。"
    narrator "她好像转过身来了。"
    ai "我记得你叫顾天鹏，全名叫做顾天鹏。虽然我一直用顾天鹏来叫你，但是我就是记得。"
    narrator "顾天鹏望着洒落到地面的银辉。"
    taku "谢谢，我也牢记着你的名字。"
    ai "说。"
    taku "星野爱。"
    ai "你一直都叫我星野小姐。"
    taku "但我就是记得。"
    ai "谢谢。"
    narrator "她似乎又转了个身。月光将百叶窗木栏投下来的阴影拉得老长。"
    ai "顾天鹏。"
    taku "我在。"
    ai "我对有才能的人，或许记得比较深。"
    taku "不瞒你说，我也时常觉得自己是个才华横溢的人。"
    ai "一点也不谦虚哦。"
    taku "受你影响了。"
    ai "你有什么才能？"
    taku "长得帅。"
    narrator "星野爱好听地笑了。"
    ai "就算是这样，长相也算不上是个才能。"
    taku "那我坚持锻炼，喜欢看书，为人礼貌，平等待人，从不懈怠，高中的时候成绩基本都是年级前五。这些算不算才能？"
    ai "你原来这么厉害？"
    taku "是。"
    ai "了不起！"
    taku "了不起的顾天鹏。"
    ai "了不起的顾天鹏！这么厉害的顾天鹏，在我看来，还有更厉害的地方！"
    taku "什么？"
    ai "秘密！"
    taku "我就知道。"
    ai "嘻嘻。"
    narrator "借着月色，他们漫无边际地说了又说，聊了又聊，仿佛真的要把一辈子的事情在今晚干完不可。"
    taku "你喜欢什么？"
    ai "秘密。"
    taku "喜欢的书是什么？"
    ai "这个也是秘密。"
    taku "喜欢吃什么？"
    ai "那个也是秘密。"
    taku "谈过恋爱？"
    ai "秘密。"
    taku "喜欢的类型是什么？"
    ai "秘密。"
    taku "全是秘密？"
    ai "全是秘密！"
    narrator "星野爱笑着说，那笑声比歌声都要动听。"
    taku "你会唱歌吗？"
    ai "唱歌？"
    taku "像昨天的那个轻音部那样。"
    ai "唱不到那么好吧，我不怎么喜欢唱歌。"
    taku "明明声音很好听。"
    ai "你的夸奖我很受用。"
    taku "可以唱一次吗？小声地唱一次。"
    ai "不行哝。"
    taku "可惜。"
    ai "连歌声都是秘密！"
    narrator "那时候，星星闪烁在天边，月亮一动不动。"

label chapter_9:
    $ ai_sprite_outfit = "winter"
    $ ai_sprite_mode = False
    $ event_cg_mode = False
    scene bg ch9_yuzawa_last_night_room with fade
    narrator "冬天之后，是秋天"
    narrator "留在越后汤泽的最后一晚，月色浸透整片雪原。"
    narrator "旅馆屋内暖炉温热，榻榻米上铺着柔软的被褥，窗外落雪安静无声，连风都刻意放轻了脚步。"

    $ event_cg_mode = True
    scene cg ch9_futon_night_talk with dissolve
    narrator "两人隔着一点距离躺下，背对着背，在静谧的夜色里轻声闲谈。"
    narrator "从童年琐事聊到喜好偏爱，从心底的秘密说到未曾表露的心事。"
    narrator "星野爱活泼轻快的嗓音，在安静的房间里轻轻回荡。"
    narrator "她藏着无数不为人知的心事，自幼孤身一人长大，无家人相伴，无依靠可寻，一路独自撑着自己前行。"
    narrator "心中怀揣着成为偶像的憧憬，却被现实的诸多条条框框死死束缚。"
    narrator "看似开朗明媚、永远笑意盎然的外表之下，藏着旁人从未窥见的孤独与敏感。"
    narrator "顾天鹏静静听着，一言不发，却将她所说的每一句话，都牢牢记在了心底。"

    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg ch9_yuzawa_last_night_room with dissolve
    show heroine winter_shy at heroine_winter_center
    ai "其实，我很少能这般放松。"
    narrator "黑暗中，星野爱的声音轻缓又柔和。"
    ai "可以肆无忌惮说话，不用伪装情绪，不用刻意迎合任何人…… 这般轻松自在的日子，真的太少了。"
    taku "在这里很放松吗？"
    ai "嗯。"
    narrator "她轻轻应声。"
    ai "和你在一起的时候，格外放松。"
    narrator "简短的一句话，悄然落进顾天鹏的心底。"
    narrator "一夜闲谈，直至深夜，倦意慢慢袭来，两人相继沉沉睡去。"

    $ ai_sprite_mode = False
    $ event_cg_mode = False
    scene bg ch9_train_autumn_window with fade
    narrator "次日破晓，天光微亮，皑皑白雪铺满山野，天地间一片洁白。"
    narrator "两人收拾好所有行李，告别待了数日的越后汤泽，搭乘列车启程离开。"
    narrator "列车一路前行，窗外的风景不断流转，雪白的雪景慢慢褪去，绿意与暖黄的色调渐渐铺满视野。"
    narrator "气温缓缓回升，凛冽的寒意消散，取而代之的，是独属于秋的温柔与慵懒。"
    narrator "路途漫漫，车厢内安静平和，星野爱戴着耳机，靠在窗边静静听歌，不自觉跟着旋律轻声哼唱。"
    narrator "细碎的歌声轻飘散开，落在一旁的顾天鹏耳中。"

    $ event_cg_mode = True
    scene cg ch9_train_humming with dissolve

    $ ai_sprite_mode = True
    $ event_cg_mode = False
    scene bg ch9_train_autumn_window with dissolve
    show heroine winter_surprised at heroine_winter_center
    taku "这不是唱的挺好吗？"
    ai "……"
    narrator "星野爱摘下耳机盯着他。"
    ai "我唱出来了？"
    taku "估计是了。"
    ai "哇，一不小心就……"
    taku "挺好的。"

    $ ai_sprite_mode = False
    $ event_cg_mode = False
    scene bg ch9_karuizawa_bus_stop with fade
    narrator "火车到站停下，他们带着行李走出车厢，又七拐八拐到巴士站台，乘上下一班公交车，公交车六分钟便来。"
    narrator "车子朝他们预约好的一家林间旅馆所在的方向开去。"
    narrator "车身摇摇晃晃，翻越碓冰岭，路过高尔夫球场和网球场，绕进被浅间山、留夫山、離山和鼻曲山包围的轻井泽。"
    narrator "这里是东京的西北方，位于长野县的东南部。"
    narrator "一年四季，薄雾弥漫山林，落叶松和白桦树展示着墨绿墨绿的繁盛枝叶。"
    narrator "不远处，枫树则如同燃烧的大鸟挥动翅膀。"
    narrator "梧桐满地，连地面都色彩缤纷，景观宛若仙境。"
    narrator "他们在终点站下了车，但还要步行几百米才能到旅馆。"

    $ ai_sprite_outfit = "karuizawa"
    $ ai_sprite_mode = True
    $ ai_sprite_position = "left"
    $ event_cg_mode = False
    scene bg ch9_forest_inn_path with fade
    show heroine karuizawa_neutral at heroine_karuizawa_left
    narrator "好在路途平缓，行李箱里也没装什么东西。"
    narrator "他们拖着行李漫步在由繁花落叶构成的特别大海之中。"
    narrator "一路上，阳光不时地从叶缝间洒落下来，跳上星野爱的牛仔外套，闪烁于她迷人的肩膀。"
    narrator "无论风的温度如何，光是看着她对一切事物都兴致盎然的身影，森林便显得温暖、充满生气了。"

    $ ai_sprite_mode = False
    $ event_cg_mode = True
    scene cg ch9_autumn_arrival with dissolve
    ai "秋天！"
    narrator "林间道上，星野爱停下脚步，望着漫天的树叶伸出双臂感叹。"
    taku "到秋天了。"
    narrator "顾天鹏在她身后说。"
    ai "诶，你说，我们是不是就像是从冬天穿越过来的一样！"
    taku "的确呢。"
    narrator "顾天鹏看着脚下的枫叶。"
    taku "从雪地一下子到了这里，很难想象。"
    narrator "火团似的小鸟鸣啭一声，混进枝头。"

    $ ai_sprite_mode = True
    $ ai_sprite_position = "right"
    $ event_cg_mode = False
    scene bg ch9_forest_inn_path with dissolve
    show heroine karuizawa_speak at heroine_karuizawa_right
    ai "原来冬天之后是秋天！"
    taku "是春天。"
    ai "是秋天！"
    taku "是是，是秋天。"

    $ ai_sprite_mode = False
    $ event_cg_mode = False
    scene bg ch9_forest_inn_path with dissolve
    narrator "飘到路面的树叶和夏末死去的知了干壳在脚底下发出异常清脆的声响。"
    narrator "他们一边拖着行李向前，一边踢飞脚下的松子或是快要碎裂的落叶。"
    narrator "直到旅馆清晰地出现在他们面前，他们办理好入住。"
    narrator "像在越后汤泽那样，他们将行李和未来几天的生活，全都安顿在这里。"

    $ ai_sprite_mode = False
    $ event_cg_mode = False
    scene bg ch9_bicycle_rental with fade
    $ ai_sprite_mode = True
    $ ai_sprite_position = "left"
    show heroine karuizawa_speak at heroine_karuizawa_left
    narrator "距离午餐之前的那段时间，他们从旅馆出来，步行到自行车出租店。"
    narrator "顾天鹏租了一辆黑色的越野，星野爱则选了一辆稍微休闲些的白色自行车。"
    $ ai_sprite_mode = False
    scene bg ch9_autumn_cycling_lane with dissolve
    narrator "他们从店门口出发，骑上车，听着耳边穿过的风声，感受来自头顶的闪烁着的金色光线。"
    narrator "时而加速超越，时而减速并行。"

    $ event_cg_mode = True
    scene cg ch9_bicycle_ride with dissolve
    narrator "自行车的车铃声像是上低音号一样徜徉在车道上，飘进幽静的空谷中。"
    narrator "轮胎碾过地面，杂乱散落的树叶如同森林的精灵一般追逐在车身后。"
    narrator "视野所见，一派秋日之息。"
    narrator "果然冬天之后是秋天，顾天鹏突然想起她说的话。"

    $ event_cg_mode = False
    scene bg ch9_roadside_steps with fade
    narrator "骑得累了，他们把车停在路边。"
    narrator "顾天鹏随意地坐在阶梯旁的地面，星野爱则蹲在附近观察蚂蚁的洞穴。"

    $ ai_sprite_mode = True
    $ ai_sprite_position = "far"
    show heroine karuizawa_neutral at heroine_karuizawa_far
    ai "你喜欢什么季节？"
    narrator "星野爱突然若无其事地问他。"

    window hide
    menu:
        "告诉她自己喜欢夏天":
            narrator "顾天鹏没有把答案藏太久。夏天这个词从舌尖落下时，连秋天的风都像停了一瞬。"
            taku "夏天。"
            ai "为什么？"
            taku "因为到了夏天，人会想把冬天没说完的话补上。"
            narrator "这个回答出口以后，顾天鹏自己也愣了一下。原来有些话并不是想好才说，只是被问到时刚好浮上来。"
            ai "听起来像秘密的一部分。"
            taku "那就先算一部分。"
            ai "我喜欢冬天。"

        "继续把理由留成秘密":
            narrator "顾天鹏决定只给出一半答案。秘密并不总是为了拒绝别人，有时只是为了让谈话继续往前走。"
            taku "夏天。"
            narrator "顾天鹏捡起红色的落叶，叶片一碰便碎裂开来。"
            ai "为什么？"
            taku "秘密。"
            narrator "星野爱回头望他。"
            taku "我不能有秘密？"
            ai "当然可以。"
            narrator "星野爱笑了。"
            ai "我喜欢冬天。"
            taku "理由是秘密。"
            narrator "秘密换来了秘密，谈话也停在安全的地方。"
            narrator "可她没有立刻走开，只是又捡起一片带孔的叶子，像还想把话题往前推一点。"
            narrator "顾天鹏把那片叶子接过来，夹进随身带着的书里。星野爱没有阻止，只是眯起眼睛。"
            ai "那这片叶子就是保证金。"
            taku "保证什么？"
            ai "保证有一天，你要把夏天的理由说出来。我也会把冬天的理由说出来。"
            narrator "这不是轻易说出口的约定。它太轻，也太绕，像两个人把真正的问题藏进叶脉里，故意让它晚一点发芽。"
            jump ending_leaf_bookmark

    narrator "星野爱摇头，直起身子，也不管地面脏不脏，径自在顾天鹏身边坐下。"
    narrator "她拾起一片红绿各半、满是孔洞的树叶。"
    ai "我喜欢那几天，在越后汤泽的那几天。"
    taku "因为雪？"
    narrator "她摇了摇头。"
    taku "因为麋鹿？"
    narrator "她还是否认。"
    taku "猜不到。"
    narrator "顾天鹏投降。"

    $ ai_sprite_mode = False
    $ event_cg_mode = True
    scene cg ch9_leaf_sunlight with dissolve
    narrator "星野爱把树叶伸向天空，微弱的阳光透过缝隙和小孔洒落下来。"
    narrator "她眯起眼睛望向光源。"
    ai "我觉得那几天很开心，很幸福！"
    taku "有多幸福？"
    ai "就像整个人都睡进了蜜糖里一样。又像是飘上了蓝天，钻进了最喜欢的那朵白色的云彩里面。"
    taku "果然喜欢甜食？"
    ai "笨蛋吗？"
    taku "开玩笑的。"
    ai "我知道。"
    narrator "树底下，他们静静地坐在那里，望着缓缓偏移的树影。"
    ai "从未有过的感觉。"
    narrator "良久，星野爱开口，语气带着几分茫然。"
    ai "我也描述不清了，为什么会很开心，很幸福。一想到冬天，我就想到鸟居，想到神社，想到炸天妇罗，想到滑雪和打雪仗，想到草莓村，想到温泉，想到月色，想到咖啡屋…… 你也记得那支水仙花吧？总之，就好像有电流划过身体一样，很喜欢，很幸福，可我却说不清缘由。"
    narrator "突如其来的一阵强风席卷而来，吹得满地树叶漫天飞舞。"
    narrator "星野爱抬手遮挡，片刻之后风便停歇。"

    $ ai_sprite_mode = True
    $ ai_sprite_position = "near"
    $ event_cg_mode = False
    scene bg ch9_roadside_steps with dissolve
    show heroine karuizawa_shy at heroine_karuizawa_near
    ai "但我连喜欢的理由是什么都不知道。"
    taku "那都不要紧。"
    narrator "她扭过头，看见穿过云层、穿过繁茂枝叶、穿过山间薄雾的日光，尽数落在少年的脸庞上，明亮又耀眼。"
    narrator "她心中早有察觉，却依旧忍不住心头一动。"
    ai "不要紧？"
    taku "你还会喜欢上秋天，还会喜欢上夏天，还会喜欢上春天。"
    ai "喜欢的太多了吧？"
    taku "你不是星野爱吗？"
    narrator "星野爱望着他。"
    taku "你是世界上最最贪婪的少女，多喜欢一点怎么了？"
    ai "我……"
    taku "了不起的、贪婪的星野爱，不是吗？"
    ai "也是。"
    narrator "星野爱的脸上绽放出前所未有的灿烂笑容。"
    narrator "树影斑驳，偶尔有行人驱车路过，清脆的车铃声在林间回荡不休。"
    ai "我想，我在越后汤泽喜欢上了冬天！"
    taku "其实是秋天。"
    ai "冬天！"
    taku "冬天。"

    $ ai_sprite_mode = False
    $ event_cg_mode = True
    scene cg ch9_autumn_promise with dissolve
    narrator "星野爱也站起身，抬手拂开耳边散落的长发，余风轻轻撩动她的发梢。"
    narrator "在顾天鹏眼中，此刻的她，宛若自林间仙境走来的花灵。"
    ai "顾天鹏。"
    narrator "她笑意盈盈，眉眼弯起，笑容比樱花烂漫，比梧桐温柔。"
    ai "接下来，我想在这个地方，在轻井泽，喜欢上秋天。"
    taku "你可是星野爱，喜欢便是了。"
    narrator "她微微侧头，眼眸亮如星辰。"
    ai "可以吗？"
    narrator "风声在林间喧嚣，树叶却只是轻轻颤动，隐约能听见彼此沉稳的心跳声。"
    narrator "顾天鹏回过神，扬起笑容。"

    $ ai_sprite_mode = True
    $ ai_sprite_position = "right"
    $ event_cg_mode = False
    scene bg ch9_roadside_steps with dissolve
    show heroine karuizawa_speak at heroine_karuizawa_right
    taku "可以，请在轻井泽喜欢上秋天。"
    ai "要怎么做？"
    taku "逛街、漫步河边、泛舟、在不冷不热的天气里吃上一口冰淇淋、尝一次世间难得的苹果派，这些都可以。"
    ai "还不够。"
    taku "钓鱼、逛书店、路过教堂，站在西式建筑前坦然说出：我喜欢这里，喜欢轻井泽的秋天。"
    ai "还不够！"
    taku "还有很多很多有趣的事。"
    narrator "顾天鹏柔声说道。"
    narrator "星野爱笑意更深。"
    ai "顾天鹏。"
    narrator "她背着手，身上淡淡的香气随着微风飘至少年身前，语气满是雀跃。"
    ai "请，让我喜欢上轻井泽的秋天。"
    taku "嗯，在冬天之后，喜欢上秋天。"
    narrator "顾天鹏轻笑出声。"
    taku "听起来怪怪的。"
    ai "不会。"
    narrator "星野爱笃定地摇头，眼底盛满温柔。"
    ai "因为冬天之后，是秋天。"

label chapter_10:
    $ ai_sprite_outfit = "karuizawa"
    $ ai_sprite_position = "center"
    $ ai_sprite_mode = False
    $ event_cg_mode = False
    scene bg ch10_old_karuizawa_street with fade
    narrator "祝你生日快乐"
    narrator "离开林间小道以后，旧轻井泽的街面在他们眼前缓缓铺开。"
    narrator "西式木屋、石板路、玻璃橱窗和一排排被秋色染亮的树冠，像是从某本旅行手账里翻出来的插画。"
    narrator "空气里有烘烤面包的香气，也有甜点、咖啡、烤鱼和热油交错在一起的味道。"
    narrator "顾天鹏还没来得及确认方向，星野爱已经被整条街夺走了注意力。"

    $ ai_sprite_mode = True
    $ ai_sprite_position = "left"
    show heroine karuizawa_speak at heroine_karuizawa_left
    ai "那边好香！"
    narrator "她指向街角冒着白烟的小摊。"
    ai "还有那家！那个看起来也很好吃！"
    taku "你刚才不是说要在轻井泽喜欢上秋天吗？"
    ai "吃东西当然也是喜欢秋天的一部分！"
    taku "这句话听起来很有说服力。"
    narrator "星野爱东张西望，眼睛像被橱窗里的糖果点亮。"
    ai "顾天鹏，我们先选哪一个？"
    taku "你先别把整条街都吃掉。"
    ai "我很克制的。"
    narrator "她说这话时，视线已经飘到斜对面的甜品店门口。"
    taku "那就先去那里？"
    ai "嗯，就那里！"

    $ ai_sprite_mode = True
    $ ai_sprite_position = "right"
    $ event_cg_mode = False
    scene bg ch10_ice_cream_shop with dissolve
    show heroine karuizawa_speak at heroine_karuizawa_right
    narrator "甜品店有两层，二楼露台摆着小圆桌，能看见街道尽头被山色托起的天空。"
    narrator "一楼的玻璃柜里陈列着各式蛋糕和冰淇淋，连空气都像被奶油和咖啡香浸软了。"
    waitress "欢迎光临。"
    ai "我要这个，咖啡果冻摩卡冰淇淋！"
    taku "你选得真快。"
    ai "美味的东西要趁它还没逃走之前抓住。"
    taku "冰淇淋不会逃走。"
    ai "但会融化。"
    narrator "她一本正经，仿佛刚说出了某种人生哲理。"

    $ ai_sprite_mode = False
    $ event_cg_mode = True
    scene cg ch10_ice_cream_walk with dissolve
    narrator "两人各自拿着一杯摩卡冰淇淋，沿着旧轻井泽的街道慢慢往前。"
    narrator "冰冷的甜味在舌尖散开，咖啡果冻微微发苦，反倒让奶油的香气变得更加鲜明。"
    narrator "星野爱小口小口吃着，像是在认真研究秋天到底是什么味道。"
    ai "这个也很幸福。"
    taku "你今天已经喜欢上好多东西了。"
    ai "不行吗？"
    taku "当然可以。"
    narrator "她满意地点头，发丝和围巾被街边的风轻轻拂起。"

    $ event_cg_mode = False
    scene bg ch10_old_karuizawa_street with dissolve
    narrator "他们继续沿着街道往前，路过橱窗、木质招牌和开在转角处的小花店。"
    narrator "旧轻井泽的秋天并不只在树上，也落在玻璃窗的反光里，落在行人慢慢放缓的步伐里。"

    $ event_cg_mode = False
    scene bg ch10_white_church_wedding with fade
    narrator "后来，他们在街道尽头附近看见一座白色教堂。"
    narrator "教堂前似乎刚办完婚礼，亲友们围在草坪边鼓掌，彩带和气球一起升向蓝天。"
    narrator "白鸽从屋檐上掠起，翅膀擦过阳光，木管乐器的声音混进风里。"
    narrator "星野爱停下脚步，手里的冰淇淋被她忘在一边。"

    $ ai_sprite_mode = True
    $ ai_sprite_position = "near"
    show heroine karuizawa_shy at heroine_karuizawa_near
    ai "真好啊。"
    taku "光是站在旁边看，好像也会被分到一点快乐。"
    ai "快乐会传给别人吗？"
    taku "我觉得会。"
    ai "那难过呢？"
    taku "大概也会。"
    narrator "星野爱望着被簇拥的新娘，目光温柔得不像是在看陌生人。"
    ai "恋爱以后会有婚礼，婚礼以后，会有属于两个人的孩子吧。"
    narrator "她像是在说很遥远的事，又像是在试探某扇不愿打开的门。"
    ai "顾天鹏。"
    taku "嗯？"
    ai "孩子也会幸福吗？"

    window hide
    menu:
        "认真回答她会的":
            narrator "顾天鹏知道这个问题不能用玩笑接住。"
            narrator "哪怕答案轻得没有分量，他也必须把它说得足够认真。"
            taku "会的。"
            narrator "话一出口，顾天鹏才发现自己的回答轻得像羽毛。"
            narrator "答案太快，像一张没有展开的纸。星野爱收下了它，却没有把真正的问题继续递出来。"
            narrator "他们在教堂前多站了一会儿，才把那阵掌声和阴影一起留在身后。"
            jump ending_light_answer

        "先问她为什么这么想":
            narrator "顾天鹏差点直接回答，却又在最后一刻停住。"
            narrator "有些问题表面上只要一个答案，真正需要的却是有人愿意追问。"
            taku "为什么突然这么想？"
            ai "因为我不知道。"
            narrator "她没有看他，指尖轻轻攥住外套袖口。"
            ai "我不知道幸福这种东西，会不会也需要有人先教。"
            taku "会的。至少不该由孩子来承担大人的空白。"
            narrator "这一次，答案不是直接落下去的，而是绕过她真正害怕的地方，慢慢放到她手边。"

        "把答案留给以后":
            narrator "顾天鹏看着白色教堂前被风吹起的彩带，忽然没有立刻回答。"
            taku "我不知道一句话能不能回答这个。"
            ai "那要怎么办？"
            taku "以后再确认。等你真的想知道的时候，我陪你一起看。"
            narrator "星野爱眨了眨眼，像是第一次听见有人把未来说得这么笨拙。"
            jump ending_white_church

    ai "可是，我好像没有那样觉得过。"
    narrator "周围的掌声仍在继续，然而顾天鹏却听见有什么细小的东西在她眼底碎开。"
    narrator "那不是谎言，也不是玩笑。"
    ai "啊。"
    narrator "下一秒，星野爱重新笑起来，笑容明亮得近乎匆忙。"
    ai "刚才那个是玩笑，别露出这种表情嘛。"
    taku "嗯。"
    narrator "顾天鹏没有拆穿她，也不知道该如何安慰。"

    $ ai_sprite_mode = False
    scene bg ch10_old_karuizawa_street with dissolve
    narrator "他们离开教堂时，街上的风突然变得有些吵。"
    narrator "边上经过了什么店，橱窗里摆着什么颜色的餐盘，谁也没有认真记住。"

    $ ai_sprite_mode = False
    $ event_cg_mode = False
    scene bg ch10_lunch_restaurant with fade
    narrator "午饭是在一家气派的西式餐厅里解决的。"
    narrator "星野爱点了比平常更多的东西，像是要把教堂前那片阴影全都塞进餐盘里，再连同甜味一起吃掉。"

    $ ai_sprite_mode = True
    $ ai_sprite_position = "left"
    show heroine karuizawa_speak at heroine_karuizawa_left
    ai "下午去买蛋糕，好不好？"
    taku "蛋糕？"
    ai "嗯，突然想吃。"
    narrator "她托着脸，语气轻快，眼底却还残留着一点散不去的雾。"
    taku "好。"
    ai "答应得这么快？"
    taku "你不是想喜欢上轻井泽的秋天吗？蛋糕应该也算。"
    ai "顾天鹏同学越来越懂我了。"
    taku "这是好事吗？"
    ai "当然是好事。"

    $ ai_sprite_mode = False
    scene bg ch10_old_karuizawa_street with dissolve
    narrator "午饭之后，下午的阳光变得更轻，街上的影子被树叶筛成细碎的形状。"
    narrator "他们绕过一处低矮的石墙，慢慢走向星野爱刚才记住的蛋糕店。"

    $ ai_sprite_mode = True
    $ ai_sprite_position = "right"
    $ event_cg_mode = False
    scene bg ch10_cake_shop with dissolve
    show heroine karuizawa_surprised at heroine_karuizawa_right
    narrator "下午，他们走进一家小小的蛋糕店。"
    narrator "店员把巧克力奶油蛋糕放进蓝色礼盒，又用红丝带扎成规整的蝴蝶结。"
    waitress "需要配蜡烛吗？"
    taku "不用也可以，今天不是谁的生日。"
    ai "要。"
    narrator "星野爱几乎立刻抢答。"
    taku "这么坚定？"
    ai "免费的东西不拿，很浪费。"
    taku "这也是贪婪的一部分？"
    ai "独一无二的贪婪。"
    narrator "她露出一口整齐洁白的牙，笑容干净得像刚刚被秋风洗过。"

    $ ai_sprite_mode = False
    scene bg ch10_forest_sunset_path with fade
    narrator "傍晚，他们沿着林间路返回旅馆。"
    narrator "太阳落到山后，影子被拉得很长，连装着蛋糕的礼盒都像染上了黄昏的颜色。"
    narrator "风开始变凉，树叶在脚边翻滚，旧轻井泽热闹的声音被一点点丢在身后。"

    $ ai_sprite_mode = True
    $ ai_sprite_position = "far"
    scene bg ch10_inn_evening_room with fade
    show heroine karuizawa_neutral at heroine_karuizawa_far
    narrator "回到房间后，两人打开电视看了一会儿棒球赛。"
    narrator "屏幕里的观众欢呼雀跃，比分却变化得毫无道理。"
    taku "刚才还领先。"
    ai "现在落后了。"
    taku "运动比赛真残酷。"
    ai "也可能只是我们没有看懂。"
    narrator "他们对视一眼，同时失去继续看的兴致。"
    narrator "电视被关掉以后，房间忽然安静下来，窗外的竹林被灯光照出一小片柔和的轮廓。"

    $ ai_sprite_mode = False
    $ event_cg_mode = True
    scene cg ch10_birthday_cake_candles with dissolve
    narrator "七点左右，他们拆开礼盒，把蛋糕放在矮桌中央。"
    narrator "蓝色盒子、红色丝带、塑料刀叉和一把细小的蜡烛，全部散在桌面上。"
    narrator "顾天鹏数了十六根蜡烛，一根一根插进巧克力奶油里。"
    narrator "火柴燃起，橘色的小火苗在房间里晃动。"
    taku "祝你生日快乐。"
    ai "今天才不是我的生日。"
    narrator "星野爱笑了。"
    narrator "不是白天教堂前那种仓促的笑，而是柔软、明亮，像被烛光慢慢照出来的笑。"
    narrator "蜡烛烧到一半，门缝里钻进一阵晚风，十六点火光几乎同时熄灭。"
    taku "我再点一次。"
    ai "不用了。"
    narrator "她伸手按住顾天鹏的手背，动作很轻。"
    ai "这样就很好。"
    narrator "两人切下一小块蛋糕，又把它分成两半。"
    narrator "甜味比下午的冰淇淋更浓，却没有人吃得太快。"

    scene cg ch10_night_cake_still with dissolve
    narrator "睡觉以前，蛋糕还剩下大半，安静地停在桌上。"
    narrator "熄灭的蜡烛歪在奶油里，红丝带落在一旁，像一条被夜色收起的小路。"
    narrator "那幅画面没有掌声，没有音乐，也没有生日歌。"
    narrator "但顾天鹏想，星野爱或许会记得。"
    narrator "至少，他会记得。"

label chapter_11:
    $ ai_sprite_mode = False
    $ ai_sprite_position = "center"
    $ ai_sprite_outfit = "autumn"
    $ event_cg_mode = False
    scene bg ch11_birch_morning_run with fade
    narrator "所有的一切，请记得真切"
    narrator "第二天，顾天鹏醒得很早。"
    narrator "旅馆外的林道还浸在清晨的蓝色里，桦木和落叶松一路向前延伸，薄雾贴着地面缓缓散开。"
    narrator "他沿着平坦的小路跑了几个来回。脚下的落叶被踩出轻响，呼吸在微凉的空气里变得清楚。"
    narrator "跑到第五公里时，天色终于亮起来。远处的山影被晨光镀上一层淡金色。"
    narrator "这种疲惫并不轻松，却让人确认自己还在一步一步向前。"

    $ ai_sprite_mode = True
    $ ai_sprite_position = "right"
    $ event_cg_mode = False
    scene bg ch11_inn_morning_room with fade
    show heroine autumn_neutral at heroine_autumn_right
    narrator "回到房间时，星野爱已经洗好头，正坐在窗边吹干长发。"
    narrator "粉色发圈放在矮桌上，吹风机的热风把她的发梢吹得轻轻晃动。"
    ai "又去锻炼了？"
    taku "嗯，趁你还没醒。"
    ai "每天跑不累吗？"
    taku "会累。"
    narrator "顾天鹏把外套挂到一边，忍不住笑了笑。"
    taku "不过我喜欢那种坚持下来的感觉。"
    ai "真厉害。"
    taku "和你一样。"
    ai "我？"
    taku "你也一直在努力。"
    narrator "星野爱没有立刻回答，只是把吹风机放下，将头发一点一点拢起。"
    narrator "她用粉色发圈扎好发尾，回头看向他。"
    ai "欢迎回来。"
    taku "我回来了。"

    $ ai_sprite_mode = False
    scene bg ch11_inn_morning_room with dissolve
    narrator "洗漱、换衣服、确认背包里的零钱和相机以后，两人骑上旅馆租来的自行车，沿着林间路慢慢驶向旧轻井泽。"
    narrator "路边的树影一段明一段暗，像有人把秋天剪成了长长的胶片。"

    $ ai_sprite_mode = True
    $ ai_sprite_position = "left"
    scene bg ch11_breakfast_cafe with fade
    show heroine autumn_speak at heroine_autumn_left
    narrator "早餐是在一间带露台的咖啡馆里解决的。"
    narrator "木头被阳光烘出温柔的香味，桌上摆着咖啡、鸡蛋三明治和刚切开的水果。"
    ai "这里的咖啡味道好温柔。"
    taku "咖啡也能温柔吗？"
    ai "能啊。现在这杯就是。"
    taku "那三明治呢？"
    ai "三明治是可靠。"
    narrator "她煞有介事地点头，像是在给早餐写人物设定。"
    taku "听起来我输给了三明治。"
    ai "顾天鹏也很可靠。"
    narrator "她补得很快，补完又捧起咖啡杯，把笑意藏进升起的白雾里。"

    $ ai_sprite_mode = False
    scene bg ch11_outlet_plaza with fade
    narrator "上午快结束时，他们从旧轻井泽的街道转向奥特莱斯。"
    narrator "广场上排列着明亮的橱窗，衣服、鞋子、餐厅和甜品店散在一条条步道两侧。"
    narrator "星野爱原本只是漫无目的地看，直到一件浅黄色 T 恤把她的脚步轻轻拽住。"

    $ event_cg_mode = True
    scene cg ch11_tshirt_tryon with dissolve
    narrator "试衣间外，星野爱换上那件印着小海豚的 T 恤，推开门时眼神有些得意。"
    ai "怎么样？"
    taku "很好看。"
    ai "衣服好看还是人好看？"
    taku "人更好看。"
    ai "谎言。"
    taku "这是事实。"
    ai "顾天鹏同学太礼貌了，礼貌到很可疑。"
    taku "那就当成不太可疑的事实。"
    narrator "星野爱低头看了看衣摆，唇角弯起。"
    ai "就算是谎言，我也不讨厌。"

    $ event_cg_mode = False
    $ ai_sprite_mode = True
    $ ai_sprite_position = "far"
    scene bg ch11_outlet_plaza with dissolve
    show heroine autumn_neutral at heroine_autumn_far
    narrator "最后，那件衣服并没有被买下。"
    ai "现在拿着袋子到处走太麻烦，而且这又不是夏天。"
    taku "那就夏天再来。"
    ai "夏天吗？"
    narrator "她重复了一遍这个词，像是在舌尖确认它的温度。"
    taku "到时候再买也不迟。"
    ai "嗯。"
    narrator "星野爱点点头，却又多看了一眼身后的橱窗。"

    $ ai_sprite_mode = False
    scene bg ch11_riverside_meadow with fade
    narrator "离开奥特莱斯以后，城市的轮廓渐渐退开。"
    narrator "他们沿着河岸慢慢走，草地在风里起伏，细小的白花铺得到处都是。"
    narrator "午前的阳光比早晨明亮，河水却仍旧清澈得像刚醒来。"

    $ ai_sprite_mode = True
    $ ai_sprite_position = "left"
    scene bg ch11_flower_stand with dissolve
    show heroine autumn_speak at heroine_autumn_left
    narrator "草地旁有个小小的花摊，木桶里插着几枝向日葵。"
    flower_child "哥哥姐姐，要买花吗？"
    ai "向日葵！"
    narrator "星野爱几乎立刻停下脚步。"
    taku "你喜欢这个？"
    ai "刚才那家咖啡馆的高玻璃瓶里也插着一枝。放在桌上一定很好看。"
    flower_child "漂亮姐姐和帅气哥哥，一人一枝会更好看。"
    taku "这孩子很会做生意。"
    ai "买一朵吧。"

    window hide
    menu:
        "只买一朵，按她说的来":
            narrator "顾天鹏点头，没有把好意变成负担。她说一朵，那就让那一朵被好好记住。"
            taku "只买一朵？"
            ai "向日葵看起来很重，拿多了会累。大概八十克。"
            taku "你连这个都能估出来？"
            ai "当然是气势。"
            narrator "最后，卖花的孩子把那枝最亮的向日葵递给星野爱，又认真提醒她不要让花瓣碰到地面。"

        "买两朵，把另一朵留给自己":
            narrator "顾天鹏看着桶里的向日葵，忽然觉得如果只有她拿着花，这幅画会少掉一处呼应。"
            narrator "他决定多买一枝，哪怕最后还是会被她笑太夸张。"
            taku "两枝吧。"
            ai "向日葵看起来很重哦。"
            taku "大概八十克？"
            ai "你怎么偷学我的气势估算法。"
            narrator "最后，卖花的孩子把两枝向日葵递给他们，只收了一枝的钱，说另一枝算作“气势折扣”。"
            jump side_ch11_two_sunflowers

    $ ai_sprite_mode = True
    $ ai_sprite_position = "right"
    scene bg ch11_riverside_meadow with dissolve
    show heroine autumn_speak at heroine_autumn_right
    narrator "星野爱举着向日葵，在草地上轻轻转了半圈。"
    ai "有点像魔法棒。"
    taku "会施什么魔法？"
    ai "让轻井泽的秋天变得更好吃、更好看、更幸福。"
    taku "听起来已经成功了。"
    narrator "向日葵在风里微微晃动。她走在前面，偶尔回头，像是确认顾天鹏有没有跟上。"

    $ ai_sprite_mode = False
    $ event_cg_mode = True
    scene cg ch11_sunflower_language with dissolve
    narrator "快走到草地尽头时，星野爱忽然转过身，把向日葵藏到背后。"
    ai "顾天鹏，你知道向日葵的花语吗？"
    taku "知道。"
    ai "这种时候应该说不知道。"
    taku "那我不知道。"
    narrator "她满意地点头，发丝被河风吹起，白色的小花从她脚边掠过。"
    ai "向日葵是沉默的爱，是没能说出口的爱，也是没有回音也会继续朝向太阳的爱。"
    narrator "那句话落下以后，周围的一切都变得格外真切。"
    narrator "风、草、河水、远山、她手里的花，像是终于在同一幅画里找到了自己的位置。"
    taku "各种各样的爱呢。"
    ai "是吧。"
    taku "你也叫爱。"
    ai "没错，星野爱。"
    narrator "顾天鹏望着她，声音轻得几乎被风带走。"
    taku "那有没有一种，名字叫星野的爱。"
    ai "什么？"
    taku "没什么。走吧。"
    ai "哦。"

label side_ch11_two_sunflowers:
    $ ai_sprite_mode = True
    $ ai_sprite_position = "right"
    $ event_cg_mode = False
    scene bg ch11_riverside_meadow with fade
    show heroine autumn_speak at heroine_autumn_right

    narrator "两枝向日葵让河岸变得像一个临时舞台。星野爱把其中一枝举到顾天鹏面前，认真调整高度。"
    ai "不行，你拿得太端正了。花不是奖状。"
    taku "那应该怎么拿？"
    ai "像这样。"
    narrator "她把自己的那枝斜斜搭在肩上，金色花瓣贴近脸颊，整个人明亮得像秋天刚刚被点燃。"
    narrator "卖花的孩子在后面追上来，手里拿着一张小小的卡片。"
    flower_child "姐姐，刚才忘记给你们这个了。写花语的小卡。"
    ai "花语？"
    narrator "星野爱接过卡片，却没有马上读。她把卡片夹进顾天鹏那枝向日葵的叶片里，像把秘密暂时寄存在他手上。"
    ai "先不看。等今天结束再拆。"
    taku "为什么？"
    ai "如果现在知道答案，路上的想象就会少很多。"
    narrator "他们沿着河岸继续走。每经过一处玻璃窗，星野爱都要确认两枝花在倒影里是不是对称；每经过一阵风，她又会用手护住花瓣，像护住某种容易被吹跑的玩笑。"
    narrator "途中有位推着轮椅的老人停下来，看着他们手里的向日葵笑了笑。星野爱犹豫片刻，把自己那枝递过去。"
    ai "要不要看一下？只借给您一分钟。"
    narrator "老人接过花，放在膝上看了很久。临走前，她把花还给星野爱，说年轻人拿着太阳走路的样子很好。"
    narrator "星野爱听完这句话，难得没有马上接玩笑。"
    ai "顾天鹏。"
    taku "嗯？"
    ai "如果花语是很沉重的东西，我们就晚点再知道吧。"
    narrator "于是关于花语的谈话没有在草地尽头自然发生。它被夹在叶片里，随着两枝向日葵一起，走向了另一个午后。"
    jump ch11_after_flower_language


label ch11_after_flower_language:
    $ event_cg_mode = False
    $ ai_sprite_mode = True
    $ ai_sprite_position = "near"
    scene bg ch11_street_food_tomatoes with fade
    show heroine autumn_speak at heroine_autumn_near
    narrator "中午，他们在街边吃了可丽饼、冷面和一小盒水果番茄。"
    narrator "星野爱把番茄含在嘴里，腮帮子鼓起一点，还要努力发表评价。"
    ai "这个很甜。"
    taku "先咽下去再说话。"
    ai "可是现在说才准确。"
    taku "食评也要注意安全。"
    narrator "她咽下番茄，认真想了想。"
    ai "下午去云场池吧。"
    taku "想看水？"
    ai "想看秋天倒在水里的样子。"
    taku "这个说法不错。"
    ai "那就决定了。"

    $ ai_sprite_mode = False
    $ ai_sprite_position = "center"
    scene bg ch11_kumoba_pond_path with fade
    narrator "通往云场池的小路安静地伸向树影深处。"
    narrator "水面在远处闪着光，红叶像一封封还没拆开的信，等着他们继续往前。"
    narrator "向日葵在他们身侧随着脚步轻轻晃动，顾天鹏忽然觉得今天发生的一切，都应该被好好记住。"
    narrator "不需要被解释，只要真切地存在过，就已经足够。"

label chapter_12:
    $ ai_sprite_outfit = "ch12_hat"
    $ ai_sprite_mode = True
    $ ai_sprite_position = "right"
    scene bg ch10_old_karuizawa_street with fade
    show heroine ch12_hat at heroine_ch12_ch13_right
    narrator "从画里走进另一幅画里"
    narrator "去云场池的路上，他们又被旧街旁一间小小的饰品店拦住。"
    narrator "木门开着，架子上摆满帽子、手链和细碎的银色饰物，阳光落进去，像把一整盒糖纸都撒开。"
    ai "顾天鹏，你看这个。"
    narrator "星野爱把橘色渔夫帽扣到头上，转过身时裙摆轻轻扬起。"
    ai "怎么样？是不是很有秋天的感觉？"
    taku "像把一小片枫叶戴在头上。"
    ai "这算夸奖吗？"
    taku "是。很适合你。"
    ai "那就合格。"
    narrator "她笑着把帽檐往下一压，又挑出一顶黑色帽子，隔着半步比到顾天鹏头顶。"
    ai "你也试试。"
    taku "我只是陪你看。"
    ai "陪看也要有参与感。"
    narrator "顾天鹏只好低头让她比划。她认真到像在给一幅画寻找最后一笔阴影。"
    shop_owner "你们两个站在一起真好看。要不要看看手链？"
    narrator "老板娘取出一对细银手链，坠子是小小的心形，价钱不贵，却被擦得很亮。"
    shop_owner "不买也没关系，就当给今天留个纪念。"

    window hide
    menu:
        "认真看看那对手链":
            narrator "顾天鹏把视线落到那对细银手链上。心形坠子太直白，直白到反而让人不知道该怎么开口。"
            ai "会不会太像恋爱纪念品了？"
            taku "所以才要认真看完再放回去。"
            narrator "星野爱把其中一条扣在手腕上比了比，银色坠子在灯下晃了一下，又被她小心解开。"
            ai "谢谢您。但我们只试一下。"
            narrator "她把手链放回托盘，动作轻得像怕惊动那一点银光。"
            narrator "那一点直白的银光让两个人都安静了一会儿。最后他们还是决定把纪念留在试戴的一瞬。"
            jump ending_silver_chain

        "把纪念留在试帽子的笑里":
            narrator "顾天鹏没有伸手去碰那对手链。"
            narrator "有些纪念一旦买下来，反而会变得太像纪念品。"
            ai "谢谢您。"

    taku "但我们收下的话，会像是把纪念偷走了。"
    narrator "星野爱跟着点头。"
    ai "所以我们只偷走试帽子的快乐。"
    shop_owner "那就多偷一点。"
    narrator "离开店时，橘色帽子重新回到架上。可顾天鹏总觉得，那抹颜色已经悄悄留在了她的笑里。"

    $ ai_sprite_mode = True
    $ ai_sprite_position = "left"
    $ ai_sprite_outfit = "ch12_sunflower"
    scene bg ch12_kumoba_pond with fade
    show heroine ch12_sunflower at heroine_ch12_ch13_left
    narrator "云场池比照片里更安静。"
    narrator "水把天空、枫叶和远山一并收了进去，连风经过时都像是在放轻脚步。"
    ai "真的像秋天掉进水里了。"
    taku "捞得起来吗？"
    ai "捞不起来。捞起来就不是这幅画了。"
    narrator "她抱着向日葵站在岸边，紫色长发被光照出柔软的亮边。"
    narrator "顾天鹏看着她，忽然明白为什么有人会在旅途中一次次停下脚步。"
    taku "想拍照吗？"
    ai "想，但又觉得不拍也可以。"
    taku "为什么？"
    ai "因为现在太完整了。相机会把它切成一小块。"
    narrator "她顿了顿，又把视线投向水面。"
    ai "可是如果不拍，又怕以后想不起来。人类真的很麻烦。"
    taku "那就记两份。一份交给相机，一份交给我们自己。"
    ai "顾天鹏偶尔也会说漂亮话。"
    taku "这句不是谎言。"
    ai "我知道。"
    narrator "两个人沿着池边慢慢走。鸟声、落叶声和远处不知名的水声混在一起，像一段没有歌词的歌。"
    ai "如果每天都这么开心，会不会有一天就分辨不出开心了？"
    taku "不会。"
    ai "答得好快。"
    taku "因为你现在问这个问题的时候，还是很开心。"
    ai "被发现了。"
    narrator "她低头笑了笑，向日葵的花盘在胸前轻轻晃动。"
    ai "那今天就继续开心下去。"
    taku "去哪？"
    ai "往前。只要还在画里，去哪都可以。"

    $ ai_sprite_mode = False
    scene bg ch13_miharashidai_sunset with fade
    narrator "他们穿过别墅间的小路，又踏上铺着落叶的木栈道。"
    narrator "等见晴台出现在眼前时，太阳已经贴近山线，云层被烧成橙红和深紫。"
    narrator "顾天鹏停在栏杆前，忽然有种错觉。"
    narrator "他们像是刚从一幅金色的画里走出，又被傍晚推入另一幅更大的画中。"

label chapter_13:
    $ ai_sprite_outfit = "ch13_smile"
    $ ai_sprite_mode = True
    $ ai_sprite_position = "near"
    show heroine ch13_smile at heroine_ch12_ch13_near
    narrator "请永远微笑着"
    narrator "大树下有一架藤木秋千。星野爱走过去，坐下时手里还握着那枝向日葵。"
    ai "这里好安静。"
    taku "刚才一路上你可不安静。"
    ai "那是为了不让秋天寂寞。"
    narrator "她轻轻晃动秋千，裙摆与落叶一起摇起来。"
    narrator "顾天鹏退到树旁，想把她、夕阳、向日葵和那片夸张得不像真实的天空一起记住。"
    ai "你躲那么远做什么？"
    taku "看画要退远一点。"
    ai "那我现在是画吗？"
    taku "是。"
    ai "会不会太贵？"
    taku "买不起。"
    ai "那只能免费展览了。"
    narrator "她笑起来。那笑容没有舞台灯，也没有镜头，却比任何一次表演都更让人移不开眼。"
    taku "你现在笑得很好看。"
    ai "又开始夸人了。"
    taku "这次不是漂亮话。"
    ai "嗯。"
    narrator "星野爱把向日葵举到眼前，金色花瓣挡住她半张脸。"
    ai "顾天鹏。"
    taku "怎么了？"
    ai "以后也请你这样笑着。"
    taku "我？"
    ai "嗯。不要总是露出好像把一切都看穿的表情。那样很累。"
    taku "我会尽量。"
    ai "不是尽量，是约定。"
    taku "好，约定。"
    narrator "风从山那边吹来，藤条发出很轻的声响。她看着他，像是终于把一句话从很深的地方拿出来。"
    ai "如果有一天，我又变得很难看懂。"
    taku "我会慢慢看。"
    ai "如果我笑得很假呢？"
    taku "那我就等到你不用假笑。"
    ai "你这个人，真的很狡猾。"
    narrator "她低下头，肩膀却忽然轻轻一颤。"

    $ ai_sprite_mode = True
    $ ai_sprite_position = "near"
    $ ai_sprite_outfit = "ch13_teary"
    show heroine ch13_teary at heroine_ch12_ch13_near
    narrator "夕阳最后一点光落进她眼里，像快要熄灭的星。"
    taku "爱？"
    ai "对不起。"
    taku "为什么道歉？"
    ai "不知道。"
    narrator "她试着笑，可那笑意刚到唇边就碎掉了。"
    ai "我只是突然觉得，今天太好了。好到像是不该属于我。"
    taku "没有这种事。"
    ai "可是我会害怕。"
    taku "害怕什么？"
    ai "害怕有一天，连这么好的事都会被我弄脏。"

    window hide
    menu:
        "走到她身边坐下":
            narrator "顾天鹏没有再让夕阳夹在两人之间。"
            narrator "他走到秋千旁，坐在她伸手就能碰到的位置。"
            narrator "坐下以后，他才把水瓶递过去，像是把沉默也放在她能握住的地方。"
            narrator "她一开始有些僵硬，像是不知道该不该允许这份靠近。顾天鹏没有继续逼近，只把水递到她手边。"
            jump ending_too_close

        "先把水递给她":
            narrator "顾天鹏先把水瓶递过去。"
            narrator "他不确定怎样的距离才不会让她更难过，只能先给她一个能握住的东西。"
            narrator "星野爱接住水以后，他才在秋千旁坐下，把剩下的距离慢慢补上。"

        "把向日葵放在她手边":
            narrator "顾天鹏没有立刻靠近，只把向日葵放到秋千旁。"
            narrator "金色花瓣在夕阳里亮了一瞬，像替他说了一句过分直白的话。"
            ai "你这是在把太阳交给我吗？"
            taku "太重的话，就放在中间。"
            narrator "星野爱低头看着那枝花，眼泪终于没有急着落下来。"
            jump ending_sunflower_between

    taku "那就不要一个人拿着。"
    ai "什么？"
    taku "害怕也好，开心也好，向日葵也好。重的时候，就分我一半。"
    narrator "星野爱握紧瓶身，眼泪终于落下来。"
    ai "对不起。"
    taku "嗯。"
    ai "对不起……"
    narrator "他没有说没关系。"
    narrator "因为那句话太轻，接不住她此刻的难过。"
    narrator "于是顾天鹏只是坐在她身边，陪她看见晴台的夕阳一点点暗下去。"
    narrator "山风安静，树影安静，连那枝向日葵也垂下头。"
    narrator "只有心跳声在黑暗里变得分外清楚。"

label chapter_14:
    $ ai_sprite_outfit = "ch14_quiet"
    $ ai_sprite_mode = True
    $ ai_sprite_position = "right"
    $ event_cg_mode = False
    scene bg ch14_roadside_bench_night with fade
    show heroine ch14_quiet at heroine_ch12_ch13_right
    narrator "从明天开始"
    narrator "后来，他们在路边的长椅上坐了很久。"
    narrator "谁也没有先开口，像是两个人都在看时间一点点流过去。"
    narrator "山路上隔很久才会有车经过，车灯把他们的脸照亮，又像潮水一样退开，只剩轮胎声在夜里滚远。"
    narrator "云层很薄，月亮从后面慢慢露出来。头顶的路灯响过两声，忽然不再闪烁。"
    narrator "一些像萤火虫的小虫在光里乱飞，轨迹没有任何规律。"
    ai "抱歉。"
    taku "喝口水？"
    ai "嗯。"
    narrator "星野爱只喝了一小口，又把瓶子和向日葵都抱在怀里。"
    ai "吓到你了？"
    taku "没有。"
    ai "那就好。"
    taku "你怎么了？"
    ai "对不起……我只是太高兴了。"
    taku "高兴的时候可不会道歉。"
    ai "也是呢。"
    narrator "她笑了一下，笑意浅得像浮在水面上。"
    ai "刚才你走开的时候，这里好安静。"
    narrator "她把瓶盖拧松，又下意识拧紧。"
    ai "人也没有，猫也没有，乌鸦也没有。车没有，风也听不见。什么都好，乱七八糟的声音也可以，总该有一点什么吧。"
    taku "没人喜欢那种感觉。"
    ai "嗯。就好像被丢掉了一样。"
    taku "大概是这种感觉。"
    ai "太讨厌了。"
    narrator "月亮又被薄云遮住，路灯把两个人的影子拖得很长。"
    ai "但仔细想想，好像又没什么。只是很黑，很安静而已。"
    narrator "她本来像是准备笑。可她看见顾天鹏坐在旁边，用很柔和的眼神望着自己，那点坚强便怎么也挂不住了。"
    ai "可是……可是……"
    narrator "眼泪从她眼角滑下来。她来不及放下花，只能用手背去擦。"
    taku "怎么哭了。"
    ai "没有。"
    taku "谎言。"
    ai "对不起。"
    taku "那就笑好了。"
    ai "怎么可能笑得出来啊。"
    taku "没关系。"
    narrator "他说得很慢，像是把每个字都放在她能听清的位置。"
    taku "没关系的。"
    ai "顾天鹏……"
    taku "我在。"
    narrator "那天晚上，向日葵的花瓣浸上眼泪，变得像纸一样轻。"
    narrator "后来他们又安静地坐了一会儿。路灯稳定地亮着，车声偶尔从山路尽头传来。"
    ai "顾天鹏。"
    taku "嗯。"
    ai "我刚才是不是很麻烦？"
    taku "没有。"
    ai "你回答得太快了。"
    taku "因为是真的。"
    narrator "星野爱低头看着花，花瓣在夜风里轻轻发抖。"
    ai "从明天开始，我会变得正常一点。"
    taku "正常一点？"
    ai "比如不突然哭，不突然道歉，不突然把很重的话丢给别人。"
    taku "那计划清单会不会太严格。"
    ai "严格一点才像计划。"
    taku "那我也从明天开始。"
    ai "开始什么？"

    window hide
    menu:
        "开始把她的计划打乱":
            narrator "顾天鹏决定用一个不太讲道理的答案，把她过分认真的清单揉皱。"
            taku "开始把你的计划打乱。"
            narrator "她愣了一下，随即笑出一点很轻的声音。"
            ai "你好坏。"
            taku "这句也不是谎言。"
            narrator "她确实笑了，可笑过以后，那张清单没有被任何人真正接住。"
            narrator "夜色把他们的沉默拉得很长。第二天清晨，她把告别写进信里，没有叫醒他。"
            jump ending_quiet_parting

        "开始陪她把计划写完":
            narrator "顾天鹏看着她，忽然觉得这份计划不该只被拿来否定。"
            narrator "如果她需要一张清单，那他至少可以陪她把明天写得不那么孤单。"
            taku "开始陪你把计划写完。"
            narrator "她愣了一下，像是不太习惯有人认真对待这种笨拙的约定。"
            ai "那第一条是什么？"
            taku "明天也不要一个人逞强。"
            ai "这条好难。"
            taku "所以写在最前面。"

        "什么都不改，只陪她坐着":
            narrator "顾天鹏没有急着替她否定计划，也没有急着把计划补完。"
            taku "那就从明天开始。"
            ai "开始什么？"
            taku "开始慢慢来。"
            narrator "星野爱望着他，像是听见了一句不像约定的约定。"
            narrator "他们没有再继续列清单，只是坐到路灯把影子拉得很长。"
            jump ending_bench_dawn

    narrator "沉默又回到他们之间。可这一次，沉默没有那么锋利。"
    ai "明天还有没有没做完的事？"
    taku "有。"
    ai "那就明天再做。"
    taku "好。"
    narrator "她闭上眼睛，像是在把这句话藏起来。"
    ai "从明天开始。"

    $ ai_sprite_mode = False
    scene bg ch11_birch_morning_run with fade
    narrator "第二天早上，顾天鹏照常出门跑步。"
    narrator "桦树林里晨光很淡，鞋底踩过潮湿的路面，空气冷得让人一下子清醒。"
    narrator "等他回到旅馆时，星野爱已经洗好头发，坐在房间里等他。"
    taku "我回来了。"
    ai "欢迎回来～"

    scene bg ch11_inn_morning_room with fade
    narrator "天气很好，两支向日葵被放在桌上。"
    narrator "他们上午几乎什么都没做，只是吃过早餐，又把前一天没完成的计划重新摊开。"
    ai "六点叫你起床，七点吃饭，八点出门。"
    taku "我通常醒得比六点早。"
    ai "那就谁先醒，谁叫另一个人。"
    narrator "她低头写得很认真，把上午、下午、晚上都塞进清单里，最后甚至写到十点回旅馆睡觉。"
    ai "大功告成！"
    taku "排得太满了吧。"
    ai "因为想做的事情太多了。"

    scene bg ch11_breakfast_cafe with fade
    narrator "中午过后，他们先把午饭吃完，又按照清单坐公交去白丝瀑布。"

    scene bg ch11_riverside_meadow with fade
    narrator "瀑布附近有老人卖烤鱼。两个人各买了一条，坐在湿润的石头上，一边吃一边看白色水流从高处落下来。"
    narrator "水声一直在耳边响，偶尔混进鸟叫。风从水边吹来，清爽得让人想闭上眼睡一会儿。"
    ai "感觉这里的空气有安眠药。"
    taku "这句听起来不是谎言。"
    ai "因为我现在真的好困。"

    scene bg ch11_outlet_plaza with fade
    narrator "两点多，他们离开瀑布，去了轻井泽千住博美术馆。"
    narrator "去美术馆的路上，红灯迟迟不变。车一辆辆驶过，有人把一群小鸭子引到人行道旁，松鼠钻进松林，割草机的声音从远处传来。"
    narrator "美术馆里到处都是清新的绿色和白色，像走进一片被整理得非常干净的森林。"
    narrator "他们把画一幅一幅看过去：瀑布、淡水湖、黑色的山、夜色里的小镇。大约一个小时以后才出来。"
    ai "好想拍照。"
    taku "拍照？"
    ai "拍我们两个。"
    taku "那不是随时都行吗。"
    ai "去用拍贴机吧。"
    narrator "拍贴机藏在一个不起眼的小房间里。照片最后只打印出一张。"
    ai "你表情也太淡了吧？"
    taku "我都这样。"
    ai "笑一下嘛。"
    taku "尽量。"
    narrator "照片里，星野爱靠得很近，对着镜头比了耶。顾天鹏脸上也有一点很淡的笑。"
    ai "还行吧～"
    taku "脸拍进去就可以了。"

    scene bg ch10_old_karuizawa_street with fade
    narrator "之后他们继续照着清单走。"
    narrator "他们租了鱼竿，在清澈的小河边扔石头，去尝新出的甜点，站在人群里看街头艺人表演。"

    scene bg ch7_souvenir_shop with fade
    narrator "傍晚前，他们又一起走进书店。"
    ai "顾天鹏喜欢什么书？"
    taku "秘密。"
    ai "我知道……《了不起的盖茨比》？"
    taku "那本最喜欢。"
    ai "还有别的？"
    taku "有。"
    ai "说嘛。"
    taku "秘密。"
    ai "我喜欢《小王子》。"
    narrator "顾天鹏看了她一眼，认真列了许多作家的名字，最后才说自己最喜欢的还是菲茨杰拉德。"
    ai "你这样会让人觉得看书很没劲。"
    taku "那就先看简单一点的。"
    ai "比如小王子？"
    taku "比如小王子。"

    scene bg ch13_miharashidai_sunset with fade
    narrator "太阳快落山时，他们走过一座桥。"
    narrator "风向变了。橘黄色的光把影子拉成几个，又在桥中央重新交叠到一起。"
    narrator "星野爱走在前面，像孩子一样踩着地上的影子。到桥中间时，她忽然停下。"
    narrator "她穿着白色长裙，外面披着淡蓝色牛仔外套。风把长发吹起来，让她看上去轻得像刚出现的云。"
    ai "顾天鹏。"
    taku "嗯？"
    ai "谢谢。"
    taku "突然道什么谢。"
    narrator "她没有回答，只是像在听风。"

    scene bg ch10_inn_evening_room with fade
    narrator "晚上十点多，他们回到旅馆。"
    narrator "星野爱把下午拍的照片压在一支向日葵下面。"
    narrator "他们洗过澡，没有立刻睡，只是坐在台灯旁边看天色暗下去，直到竹林外再没有一点光。"
    ai "计划清单上面的事情还没做完呢。"
    taku "那明天再做好了。"
    narrator "星野爱点点头，把《了不起的盖茨比》拿出来翻。"
    narrator "她翻到很晚，顾天鹏先睡着了。"

    $ ai_sprite_mode = True
    $ ai_sprite_position = "center"
    $ ai_sprite_outfit = "ch14_departure"
    show heroine ch14_departure at heroine_ch12_ch13_center
    narrator "清晨，星野爱只带着行李箱离开。"
    narrator "台灯关着，书还摆在桌上。"
    narrator "她没有叫醒顾天鹏。门轻轻合上，房间重新安静下来。"

label chapter_15:
    $ ai_sprite_mode = False
    $ event_cg_mode = True
    scene cg ch15_empty_room_letter with fade
    narrator "没有你的明日和信"
    narrator "顾天鹏记不清自己发现星野爱离开的准确时间，只记得大概是凌晨五点四十左右。"
    narrator "醒来以后，房间静得不像有人住过。旁边的床单还有褶皱，行李箱却只剩下他自己的那个。"
    narrator "玻璃门外传来鸟叫，竹林顶端浮着灰色的云，好像随时会下雨。"
    taku "……爱？"
    narrator "没有回应。"
    narrator "他站了一会儿，还是像往常一样换鞋去桦树林里跑步。"

    $ event_cg_mode = False
    scene bg ch11_birch_morning_run with fade
    narrator "那天他跑了很久，肯定不止五公里。"
    narrator "六点四十多，雨忽然落下来。一开始只有几滴，很快就把白茫茫的清晨全部涂湿。"
    narrator "顾天鹏小跑回旅馆，头发只湿了一点。"

    scene bg ch10_inn_evening_room with fade
    narrator "推开门时，他下意识说了一句我回来了。"
    narrator "房间里没有人洗好头发等他，也没有人笑着说欢迎回来。"
    narrator "他觉得自己有点蠢，洗澡时打开手机，用歌声盖住淋浴声和外面的雨声。"
    narrator "洗完以后，雨下得更大，竹林在风里摇晃，窗玻璃上满是被吹斜的水痕。"
    narrator "顾天鹏喝了一杯水，喉咙才像重新恢复了说话的能力。"
    narrator "他坐到桌边，看见蛋糕、刀叉、没有拆封的手套、烧黑半截的蜡烛、倒在墙影里的两支向日葵，以及压在花茎下反光的照片。"
    narrator "所有东西都像照片一样被定格住了。"
    narrator "雨停了半个小时左右，他把玻璃门打开，风立刻灌进房间。"
    narrator "桌边的《了不起的盖茨比》被吹得翻页。顾天鹏过去想把书收好，却看见里面夹着一张折起来的信纸。"
    narrator "他拿起信，坐到床边，从头开始读。"
    ai_letter "对不起，我说谎了。"
    narrator "星野爱的字迹并不好看，却每一笔都尽量写清楚。"
    narrator "读到这里，风有点大。他把玻璃门重新关严，又去倒了一杯水。"
    ai_letter "说好的明天继续把计划清单里的事情做完，我却不辞而别了。非常抱歉。"
    ai_letter "我是在台灯旁边写这封信的。窗外没下雨，天黑得吓人，风声很大。"
    ai_letter "我还是更喜欢下午三点、有太阳的时候写信。你肯定忘了这句话吧？可是你说过喜欢夏天在桥边吹风散步，我帮你记着。"
    ai_letter "谢谢你陪我过生日，陪我看麋鹿、吃可丽饼、看斯巴鲁、去瀑布、美术馆、书店，还有那座桥。"
    ai_letter "还有好多好多，一张纸大概写不完。既然是离开，各种东西我就不带了。向日葵也留在这里，果然很重。"
    ai_letter "照片我想拿，可是只有一张。还是留给你吧。看到照片就会想起在一起，然后又分开，那多难受啊。麻烦你帮我难受好了。"
    ai_letter "顾天鹏，对不起，这次我想写你的全名。我会牢记你的全名。"
    ai_letter "你很帅，是个很好的人。相比之下，我觉得自己实在很恶劣，不过我不讨厌这样的自己。星野爱就是这样，可爱，贪婪，独一无二。"
    ai_letter "我要回东京了。东京其实也不远，说不定你读到这里的时候，我正晒着太阳看东京湾。"
    ai_letter "最后还有一件事。你说只要是说出来的话都能识破。那你猜猜，写在信里的有多少是谎言？"
    ai_letter "世界上最贪婪的少女，星野爱。"
    narrator "信写得很长，字又小又挤。顾天鹏读完以后，又从头读了一遍。"
    narrator "第二遍读完，他把杯子里的水全部喝光，喉咙却还是很干。"
    narrator "雨又下起来，风小了一些，竹林没有刚才那样混乱。"
    narrator "他坐到台灯旁读第三遍。读完后把信翻到背面，总觉得后面还应该写着什么，可那里什么都没有。"
    narrator "信纸干净得像她离开时那样决绝。吹风机放在旁边，上面还残留一点她洗过头发后的香气。"
    narrator "顾天鹏把信折好，夹回书里。"
    narrator "书自动弹到星野爱昨晚翻到的那一页，右上角用铅笔写着一行很小的字。"
    ai_letter "书太难懂了，想看简单一点的，小王子。"
    narrator "后面画了一个简略的哭脸，连句号也没有。"
    narrator "他想象她深夜坐在台灯下写信的样子，却猜不出那时她究竟是开心还是难过。"
    narrator "他把蛋糕、刀叉、蜡烛和手套都收起来丢到外面的垃圾桶。"
    narrator "回来以后，他拿起向日葵，仍旧觉得这花无论如何也不止八十克。"
    narrator "照片在花茎下面泛着白光。他捏起来看，好像时间又回到他们刚从美术馆出来的下午。"
    narrator "可那是不可能的。"
    narrator "他把和星野爱有关的东西都塞进抽屉，中午去外面吃了饭。"
    narrator "街上有零星几个行人，听不清对话声，只听见雨敲在伞面上。"
    narrator "回到旅馆后，他看了一会儿棒球赛。观众的喝彩声越来越远，他睡了一觉，醒来时已经接近傍晚。"
    narrator "雨停了，门檐上还在滴水。隔着玻璃，声音显得很遥远。"
    narrator "手机里播到一首熟悉的歌，他想起星野爱在火车上唱过的那几句。"
    narrator "她现在在做什么呢。大概已经到家了吧。东京一点也不小，分别之后，也许再也见不到了。"
    narrator "旅途中她总说自己贪婪，离开时却什么都没有带走。"
    narrator "这点的确太恶劣了，顾天鹏想。"
    narrator "她可爱、热情、纯粹，却又充满谎言，好像说谎就是她活下去的本能。"
    narrator "她没有待在阴影里。她本身就像一片巨大的阴影。"
    narrator "无论从哪个角度看，她都彻彻底底，是需要被人拯救的。"
    narrator "那天傍晚没有晚霞，竹林湿透了，夜幕一点点降下来。"

label chapter_16:
    $ event_cg_mode = False
    $ ai_sprite_mode = False
    scene bg ch10_inn_evening_room with fade
    narrator "如果能再相见"
    narrator "后面的几天，顾天鹏没有立刻回东京。"
    narrator "他仍然按照原来的计划留在轻井泽，准备等春天来临后再回去找工作。"
    narrator "星野爱离开得很突然，连联系方式都没有留下。"
    narrator "说到底，他不过是她在火车上偶然遇到的人。相遇和分别本来就是旅途中常有的事。"
    narrator "即使如此，他还是花了不少时间，才慢慢适应从两个人出门变成一个人旅行。"
    narrator "十一月十九日晚上，顾天鹏坐在台灯边翻书。"
    narrator "门外的竹叶停在灯光和黑暗的交界处，窗外传来不知名动物的叫声，安静得像在提醒人不要说话。"
    narrator "他合上书，关紧窗户，锻炼、洗澡，然后倒在床上睡着。"

    scene bg ch11_birch_morning_run with fade
    narrator "十一月二十日，他八点起床。"
    narrator "刷牙、用湿毛巾让自己清醒以后，他到旅馆外面跑步。"
    narrator "晨曦从林间一点点爬上来，树干上的白光亮得有些不真实。"
    narrator "几辆自行车从车道上驶过，车铃声却没有第一天抵达轻井泽时那样悦耳。"
    narrator "两个穿运动服的女生也在跑步，其中一个手机外放着熟悉的歌。"
    narrator "鸟叫声从高处传来，像布谷鸟，又像斑鸠或乌鸦。无论他跑多远，那声音都没有停下。"

    scene bg ch10_inn_evening_room with fade
    narrator "回到旅馆，他洗澡换衣服，然后去了书店。"

    scene bg ch7_souvenir_shop with fade
    narrator "书店里，一个母亲带着孩子挑书，有人推着新到的书往仓库送。"
    narrator "顾天鹏从留着胡茬的大叔身边走过，去文学读物区找出《源氏物语》。"
    narrator "他一看就看到中午。"
    narrator "离开时，两个少女在讨论要不要买《小王子》和《月亮与六便士》，说这样可以交换着看。"
    narrator "顾天鹏下意识看了她们一眼，然后转身离开。"

    scene bg ch7_cafe with fade
    narrator "中午十二点，他在外面的店里吃午餐。"
    narrator "咖喱鸡翅盖浇饭的味道不怎么样，拿铁也很普通。也许只是他没什么胃口，最后勉强才吃完。"

    scene bg ch10_old_karuizawa_street with fade
    narrator "走出店外时还不到一点，头顶的阳光却已经消失。"
    narrator "周围算不上暗沉，也不像要下雨，只是视野里的一切都显得脏兮兮的。"
    narrator "他漫无目的地走，在两个十字路口右转，不知不觉来到和星野爱最后一起走过的那座石桥。"
    narrator "路灯没有亮，地上没有影子，风连桥边的小旗帜都吹不动。桥下的水机械地流着，小草被压进泥土里。"
    narrator "每一处景致看起来都像死物。"
    narrator "想不到要去哪里，他绕到附近的宠物店逗了一会儿猫。"
    narrator "年轻的店员给他介绍各种猫的品种，又问他是不是来旅游，要待多久，以后有没有兴趣常来。"
    narrator "顾天鹏简单回答完，离开店里。"
    narrator "站在街边，他看见女人提着购物袋交谈，学生聊着游戏和美妆产品，老人散步，小孩追逐。"
    narrator "不知哪家店里传来轻柔的音乐，像飘在云上一样。"
    narrator "他忽然觉得这些事物都在按照某种既定程序运行。"
    narrator "恍惚间，他仿佛看见穿着裙子的星野爱回过身，对他笑了一下。"
    narrator "那笑容很快远去。"
    taku "这到底算什么。"

    scene bg ch10_inn_evening_room with fade
    narrator "晚上，顾天鹏在便利店吃了关东煮，又买了一瓶 MAX 咖啡。咖啡味道倒是不错。"
    narrator "回到旅馆后，他看新闻和天气预报。"
    narrator "东京基本是晴天，轻井泽却要连阴三天。"
    narrator "关上电视，外面的天色暗下来。他把灯打开，从包里翻出《了不起的盖茨比》。"
    narrator "他没有看书，只是又一次展开夹在里面的信。"
    narrator "那封信他已经读过很多遍，可每次读完，都觉得差了点什么。"
    narrator "它结束得太干脆，像有人突然剪断电话线。每句话后面似乎都应该还有一段长长的回忆，可那里什么都没有。"
    narrator "这次读完，顾天鹏提起笔，像只有把想法写下来才能平静。"
    narrator "他看着暮色里的竹林，最后埋头写下一句。"
    taku "你好，星野爱，我会牢记你的名字。"
    narrator "这句话后面，本该写夕阳、月色、秋天的枫叶、冬天的白雪。"
    narrator "但他最后什么都没有继续写。"
    narrator "没有她的地址，这只是一封寄不出去的信。"

    $ event_cg_mode = True
    scene cg ch16_photo_desk_night with fade
    narrator "顾天鹏把写了字的纸揉成一团，又把所有关于星野爱的东西收在一起：信、向日葵，以及那些轻得不像证据的回忆。"
    narrator "他把能丢的东西都丢掉。"
    narrator "照片其实也该丢。带着它继续旅行，总会让人难过。"
    narrator "要是难过，就和出门旅行的目的背道而驰了。"
    narrator "他拿着照片犹豫很久，最后还是把它摆回桌面。"
    narrator "十点多，他关掉台灯。"
    narrator "残留的微光让照片亮了一会儿，像有月色打在上面。"
    narrator "但今晚连月亮都没有。"
    narrator "第二天一大早，他把垃圾篓里的东西全部扔到外面。"

    $ ai_sprite_mode = False
    $ ai_sprite_position = "center"
    $ event_cg_mode = False

    window hide
    menu:
        "继续留在轻井泽，把生活过下去":
            $ story_route = "main_continue"
            jump chapter_17

        "追寻那封信的去向":
            $ story_route = "main_search"
            jump route_main_search

        "把那段旅行封存起来":
            $ story_route = "side_memory"
            jump route_side_memory


label chapter_17:
    $ ai_sprite_mode = False
    $ event_cg_mode = False
    scene bg ch10_inn_evening_room with fade
    narrator "后来"
    narrator "扔掉垃圾以后，顾天鹏继续留在轻井泽。"
    narrator "白天出门看书，下午去宠物店逗猫。天气好的时候，他就沿着街道走到黄昏，再坐进咖啡店听歌。"
    narrator "一个人的旅途逐渐变得轻松。空落落的感觉偶尔还会出现，却一天比一天淡。"
    narrator "他会对运输垃圾的大叔说辛苦了，也会在绿色信箱旁看见有人取信。"
    narrator "那些微小的动静把旅途重新填起来。不是热闹，只是说明世界还在正常运转。"
    narrator "十一月二十六日，天气好转后的第三天，他晨跑以后去小餐馆吃了芝士披萨和纳豆。"
    narrator "原本打算去便利店买 MAX 咖啡，经过宠物店时，柜台里的少女使劲朝他挥手。"

    scene bg ch17_pet_shop with fade
    show yuki petshop at cast_single_center
    narrator "十一月二十六日，开太阳的第三天，他经过宠物店时，被看店的少女叫住。"
    yuki "顾天鹏！"
    taku "下午好，小仓小姐。"
    yuki "叫友希小姐也没问题。进来坐吗？"
    $ event_cg_mode = True
    scene cg ch17_yuki_coffee_cat with dissolve
    narrator "她留着及肩的黑发，红色连帽卫衣配黑色百褶裙，脚上是一双运动鞋。"
    narrator "她看起来活泼，又像随时能把人拉进自己的节奏。"
    narrator "小仓友希把一只半梦半醒的橘黄色胖猫抱给他，又跑去小房间里泡咖啡。"
    yuki "今天很早嘛。"
    taku "不是被你喊进来的吗？"
    yuki "原来准备去哪？"
    taku "买咖啡。"
    yuki "本地的咖啡豆，我自己泡的。要不要喝？"
    taku "谢谢。"
    yuki "杯子是新的，牛奶和砂糖自己加。"
    yuki "想听什么歌？"
    taku "《五百英里》。"
    narrator "店里的音乐换成民谣，猫在他怀里低低叫了两声。"
    yuki "你喜欢民谣？"
    taku "不讨厌。"
    yuki "那《Love Story》呢？"
    taku "听过。"
    yuki "我很喜欢，一会儿有这首。"
    narrator "门框上的铃铛响了几声，有两个小女孩进来挑猫粮。小仓友希笑着招呼她们，回头又继续和顾天鹏说话。"
    yuki "今天又是运动、看书、欣赏风景？"
    taku "差不多。"
    yuki "这才叫旅行。看了什么书？"
    taku "《小王子》。"
    yuki "小孩子看的？"
    taku "开篇就请孩子们原谅把书献给一个大人。"
    yuki "那应该看漫画才对。"
    taku "也看过。"
    yuki "那种色色的漫画？"
    taku "色色的漫画？"
    yuki "你犹豫一秒就是看过。"
    taku "这算什么定律。"
    yuki "一秒定律。"
    narrator "顾天鹏笑了笑，侧身喝了一口咖啡。没加糖，味道有点苦。"
    narrator "店内的歌换成了另一首。他完全没听过歌词，只觉得猫的呼吸声比音乐更容易让人安心。"
    yuki "之前和你一起的那个漂亮女孩子呢？"
    taku "她回东京了。"
    yuki "你们原来不是一起的吗？"
    taku "只是偶然遇到的。"
    narrator "说出这句话时，他有种在谈几年前事情的错觉。"
    narrator "白裙子、兔子发饰、蓝紫色长发，还有那双摄人心魄的眼睛忽然清晰起来。"
    yuki "我还以为你们是情侣。毕竟你也挺帅的。"
    taku "谢谢。其实我也不是想让你夸我。"
    yuki "笨蛋。"
    narrator "店里来了寄养猫的客人。小仓友希把白色长毛猫抱进洗澡间，忙了很久才出来。"
    yuki "累死了。"
    narrator "顾天鹏从口袋里拿出纸巾递给她。"
    taku "擦汗？"
    yuki "谢谢。"
    narrator "他们又听了几首歌。小仓友希若无其事地问他家在哪里，准备在轻井泽待多久。"
    taku "差不多到春天。"
    yuki "春天啊。那你要不要来我这里打工？每天来几个小时，有工资。"
    taku "有多少？"
    yuki "一般人时薪一千。"
    taku "那我呢？"
    yuki "你这么帅，给两千。"
    taku "这是包养？"
    yuki "这算吗？"
    taku "我哪知道。"
    yuki "那就算。要是过意不去，就站在门口替我发传单揽客。"
    taku "你当我是吉祥物？"
    yuki "不错的想法嘛。"
    narrator "他们一直坐到下午四点。顾天鹏把怀里的猫放回软垫，小仓友希跳下椅子，说要送他到门口。"
    taku "不用。"
    yuki "那明天来吗？"
    narrator "她问得可怜兮兮，像店里的猫全都替她站在同一边。"
    taku "你开的工资那么多，没法拒绝。"
    yuki "说定了！"

    window hide
    menu:
        "接受这份短期兼职":
            narrator "顾天鹏看着店里安静的灯光和趴在笼子里的猫。"
            taku "你开的工资那么高，没法拒绝。"
            yuki "说定了！"
            jump chapter_18

        "礼貌拒绝，不再建立新联系":
            narrator "顾天鹏摇了摇头。"
            taku "算了。旅途里认识的人，还是停在旅途里比较好。"
            jump ending_karuizawa_fade

label chapter_18:
    $ ai_sprite_mode = False
    $ event_cg_mode = False
    scene bg ch18_pet_shop_rain with fade
    show yuki petshop at cast_single_center
    narrator "双人成行"
    narrator "十一月二十九日晚上八点，顾天鹏结束宠物店兼职，准备离开。"
    yuki "顾天鹏！明天……能不能陪我出去走走？店可以先不开。"
    narrator "她像下了很大决心才问出口。"
    narrator "店里的小动物大多睡了，只有几只猫不安分地叫了两声。"
    taku "最近不太想和别人一起出门，抱歉。"
    narrator "小仓友希怔怔看着他。门关上的瞬间，黑暗从缝隙里渗进店内。"
    narrator "十二月四日，外面下着大雨。顾天鹏收起伞，又一次走进宠物店。"
    yuki "来啦。外面雨很大？"
    taku "本来都打算不来了。"
    yuki "真是辛苦你咯。"
    narrator "猫粮、笼子、洗澡间和柜台的活大多由顾天鹏做完。小仓友希把时薪两千円说得理直气壮。"
    yuki "大部分活不是我在干吗？"
    taku "不是我吗？"
    yuki "时薪两千没白给。"
    narrator "两个人都放松地笑了一下。橱窗外雨声不停，店里反而显得更亮。"
    yuki "那个，明天能一起吃个饭吗？真的只是吃饭。"
    taku "我知道。"
    yuki "所以呢，可以吗？"
    narrator "顾天鹏有些犹豫。小仓友希没好气地看着他。"
    yuki "婆婆妈妈的，你是没走出失恋的阴影？"
    taku "啥？"
    yuki "是不是被女明星甩了，一直不好意思承认？"
    taku "一点也没猜对。"
    yuki "那女孩子叫什么？和你一起的那位超级无敌美少女。"
    taku "星野爱。"
    yuki "星野爱……名字也很漂亮。"
    yuki "这趟出门就是为了她吧？"
    taku "不是。"
    yuki "谎言？"
    taku "不是所有话都需要那么判断。"
    yuki "那就是更像真的谎言。"
    narrator "顾天鹏没有继续解释。"
    scene bg ch18_ice_cream_shop with fade
    show yuki tissue at cast_single_center
    narrator "第二天，他们先去了冰淇淋店。小仓友希点了一份咖啡果冻摩卡冰淇淋，吃得像在完成限时挑战。"
    yuki "我想吃冰淇淋。"
    taku "等会儿还要吃饭。"
    yuki "吃冰淇淋和吃饭不是一回事。"
    taku "我就不要了。"
    yuki "你不喜欢？"
    taku "只是后面还要吃饭。"
    scene bg ch10_lunch_restaurant with fade
    show yuki tissue at cast_single_center
    narrator "之后两人走进一家西式餐厅。小仓友希一口气点了很多东西，连服务员都忍不住提醒。"
    taku "点这么多没问题？"
    yuki "没问题。"
    narrator "她赌气似的又勾上一个餐后点心。"
    narrator "顾天鹏看着菜单上被她划出来的一串菜名，忽然觉得这顿饭不像吃饭，更像她在和某种看不见的东西较劲。"
    narrator "服务员端上来的盘子几乎摆满桌面。小仓友希吃得很快，偶尔抬头看他一眼，又装作什么都没发生地去切牛排。"
    taku "慢点也没关系。"
    yuki "我没有急。"
    taku "谎言。"
    yuki "这招不是只有你和她之间才能用吗？"
    narrator "顾天鹏没有回答。小仓友希把叉子戳进餐后点心里，像终于抓到可以出气的东西。"

label chapter_19:
    $ ai_sprite_mode = False
    $ event_cg_mode = False
    scene bg ch7_cafe with fade
    show yuki tissue at cast_single_center
    narrator "再见"
    narrator "吃完饭后，外面下了一层薄薄的雨。"
    yuki "难得出来，再多陪我一会儿？"
    taku "下次吧。今天下雨，我想早点回去。"
    narrator "小仓友希的表情有点失落。她看见顾天鹏望着雨帘，像在看某个并不在这里的人。"
    narrator "他说的那句下次很快被雨声淹没。她抬头看他侧脸的时候，忽然明白自己没法挤进那道视线。"
    narrator "平安夜那天，天气晴。两人坐进一间精致咖啡屋。"
    yuki "我要甜甜的。"
    taku "牛奶就好。"
    narrator "小仓友希凑过来看他手里的书。"
    yuki "这本好看吗？"
    taku "还挺喜欢。"
    yuki "下次借漫画来看吧。"
    taku "色色的漫画？"
    yuki "色色的漫画。"
    narrator "她笑起来，阳光正好落在她脸上。"
    yuki "晚上和我一起去看电影吧？"
    taku "算了。"
    yuki "又是算了。别逼我求你，好吗？"
    narrator "如果是在遇到星野爱之前，顾天鹏或许会答应。可现在他不太喜欢那种相处之后又注定分开的感觉。"
    taku "不行。"
    yuki "行。"
    taku "你完全不听别人讲话。"
    yuki "我不管。"
    narrator "最后他还是被小仓友希拖去了电影院。"
    scene bg ch19_cinema_lobby with fade
    show yuki tissue at cast_single_center
    narrator "影院大厅里有圣诞装饰，外面的冬夜被玻璃门隔开。"
    $ event_cg_mode = True
    scene cg ch19_yuki_movie_tears with fade
    narrator "电影很感人，她哭得一塌糊涂。后来他们吃了街边小吃、烤番薯，还去游乐厅抓娃娃，结果一个也没抓到。"
    yuki "呜呜……"
    taku "还要纸吗？"
    yuki "谢谢。"
    narrator "她哭得毫不遮掩，走出电影院以后又立刻恢复精神，像刚才痛哭的人不是她。"
    yuki "今天很开心。"
    narrator "十点多，顾天鹏把她送到家门口。月色和灯光落在她脸上，像一段快要消失的记忆。"
    yuki "虽然很过分，这一段回忆，勉强就让我占据吧。"
    narrator "十二月三十一日，一年的最后一天，晴。"
    yuki "准备什么时候回东京？"
    taku "明天晚上。"
    narrator "小仓友希没有立刻说话。她把手插进口袋，像在确认里面是否还装着能留下他的借口。"
    yuki "那今天算是最后一天？"
    taku "轻井泽的最后一天。"
    yuki "说得真冷淡。"
    taku "事实就是这样。"
    yuki "事实有时候也很讨厌。"
    narrator "两个人在晴朗的一年末站了很久。雪没有落下来，风也不算冷，可分别的轮廓已经提前出现在那里。"

label chapter_20:
    $ ai_sprite_mode = False
    $ event_cg_mode = False
    scene bg ch17_pet_shop with fade
    show yuki petshop at cast_single_center
    narrator "四月是你的谎言"
    yuki "不是说好了春天回去吗？"
    taku "我还是想早点回去。"
    yuki "理由呢？"
    taku "说不清。"
    yuki "哪有什么说不清的。"
    taku "那就当是秘密好了。"
    yuki "就不能晚点？一月底，二月中旬也行啊。"
    taku "原本有这个打算，后来改变主意了。"
    narrator "小仓友希抱着杯子，替他把电话和 LINE 加进手机。她家在东京也开了一家店。"
    yuki "回去找工作的时候，打上面的电话。"
    taku "宠物店？"
    yuki "星巴克。"
    taku "你家到底多有钱？"
    yuki "一点点。"
    narrator "她还翻出了面包店、健身房、游泳馆、家庭电话和高中班主任的联系方式。"
    yuki "你是外星人吗？怎么连朋友都没有？"
    taku "只是不喜欢乱交朋友。"
    yuki "居然连星野爱的联系方式也没有。"
    narrator "顾天鹏被咖啡呛了一下。"
    scene bg ch20_karuizawa_station_winter with fade
    narrator "车站灯光亮起来时，轻井泽的冬天像被提前装进行李。"
    $ event_cg_mode = True
    scene cg ch20_yuki_station_gift with fade
    narrator "离开轻井泽那天，小仓友希送他到车站，还把一盒游戏塞进他手里。"
    yuki "礼物！双人成行。等你有朋友一起玩的时候再拆。"
    narrator "冬天过去。电话里，小仓友希常常讲起轻井泽：石之教堂的婚礼、跑到街上的野猪、宠物店旁新开的咖啡屋。"
    narrator "她讲很多，顾天鹏听很多。电话挂断前，她说下次再来，就不用喝自己泡的难喝咖啡了。"
    yuki "到时候我们去旁边新开的那家坐。"
    taku "是。"
    narrator "顾天鹏回东京后开始按部就班生活：跑步、读书、准备工作，偶尔去小仓友希介绍的咖啡店试班。"
    narrator "冬天的轻井泽被电话线留在另一端。星野爱的名字则像夹在书页里的照片，不碰也知道还在那里。"
    narrator "三月末的某天，小仓友希又打来电话，问他是不是已经把她忘了。顾天鹏说没有。"
    yuki "那你说说第几次给你打电话了？"
    taku "不知道。"
    yuki "所以才需要纪念日。"
    scene bg ch20_sakura_slope with fade
    narrator "四月一日，顾天鹏从涩谷站下车，春日阳光比想象中还明媚。"
    narrator "高中制服的女生牵手经过，上班族提着黑色公文包匆匆走远，骑自行车的男生消失在拐角。"
    narrator "他扯了扯胸口的领结，一阵温暖的风从身后吹来，把他的衣角轻轻掀起。"
    narrator "粉色樱花沿着道路盛开，风吹过居民楼和坡道。"
    $ event_cg_mode = True
    scene cg ch20_sakura_reunion with fade
    narrator "他站在坡道下方抬头，看见那位少女站在坡道上。"
    narrator "清风拂过她的长发和裙角，世间一切美好仿佛都成了她的陪衬。"
    narrator "那一天是四月的伊始。星野爱站在坡道上方，顾天鹏站在坡道下面，中间是樱花雨。"

label chapter_21:
    $ event_cg_mode = False
    $ ai_sprite_mode = True
    $ ai_sprite_outfit = "ch20_spring"
    $ ai_sprite_position = "right"
    scene bg ch20_sakura_slope with fade
    show heroine ch20_spring at heroine_ch12_ch13_right
    narrator "电车驶过"
    ai "顾……天鹏？"
    narrator "风把她的头发吹到嘴边。她像第一次见面那样抬手拨开刘海。"
    taku "好久不见。"
    ai "嗯，好久不见！"
    narrator "那笑容太久违。顾天鹏差点忘了记忆里也曾经有过这样心动又真切的画面。"
    narrator "八点多，两个人沿着居民区散步，穿过铁道，路过公园。"
    narrator "公园里有不专业的棒球队在比赛，远处两个孩子玩滑梯和跷跷板，一个少女在树旁荡秋千。"
    ai "什么时候到东京的？"
    taku "年初就回来了。"
    ai "我还以为是最近。那怎么改变主意了？"
    taku "说不清。"
    narrator "他们在咖啡馆坐下。轻井泽提前离开的原因仍旧被她藏成秘密。"
    ai "之前相处得很开心呢。轻井泽也好，越后汤泽也是，真想一直玩下去。"
    taku "那为什么提前离开？"
    ai "说不定我和你一样，喜欢东京多一点。"
    taku "谎言。"
    ai "哈，又来？"
    taku "讨厌我？"
    ai "绝对不是！"
    taku "那到底是什么？"
    ai "秘密！早点习惯。"
    narrator "顾天鹏没有继续逼问。她的秘密像春天路边的阴影，看得见，却不能踩得太用力。"
    ai "你呢？刚才说找工作。"
    taku "还没有，不过可以有。"
    ai "你说的话太难懂了。"
    taku "可能吧。"
    taku "之前拍的那张照片，我又打印了一份。这样你也能留着。"
    ai "想得真周到。谢谢！"

    window hide
    menu:
        "把照片和联系方式都补上":
            narrator "顾天鹏把自己的手机拿出来。"
            ai "上次离开得太匆忙，忘记要你联系方式了。在车上我还一直犯愁呢。"
            taku "可以。"
            narrator "两个人交换了 LINE。"
            $ event_cg_mode = True
            scene cg ch21_ai_photo_contact with dissolve
            narrator "顾天鹏注意到她手机已经换了。手机壳、牌子都和旅行时不一样。"
            narrator "他没有问为什么。春天的重逢已经足够脆弱，没必要马上把每个缺口都挖开。"

        "只把照片递给她":
            narrator "顾天鹏把照片推过去，却没有拿出手机。"
            narrator "之后他们仍然会偶尔想起这天，只是没有任何一句消息能穿过春天。"
            jump ending_spring_no_line

    $ event_cg_mode = False
    scene bg ch20_sakura_slope with fade
    show heroine ch20_spring at heroine_ch12_ch13_right
    narrator "他们继续往前走。没有人提出目的地，也没有人急着停下来。"
    narrator "沥青路旁的树还没完全长满叶子，春风像刚刚醒来。"
    ai "不是什么非说不可的事。"
    taku "我想听。"
    $ ai_sprite_outfit = "ch21_secret"
    show heroine ch21_secret at heroine_ch12_ch13_right
    ai "那就不告诉你～"
    taku "这也太过分了吧？"
    ai "还好啦。只告诉你也行。"
    taku "那告诉我。"
    ai "为什么？你有什么特殊的？"
    taku "长得帅。"
    ai "这个不算。"
    narrator "他们走到电车轨道前。黄黑色栏杆落下，信号声叮叮响起。"
    narrator "轰隆隆的电车驶过，遮住了两人的视线。"
    ai "我决定，要成为偶像了。"
    narrator "她说这句话时，声音很轻，却像被电车驶过后的风完整留下来。"

label chapter_22:
    $ ai_sprite_mode = True
    $ ai_sprite_outfit = "ch20_spring"
    $ ai_sprite_position = "right"
    scene bg ch20_sakura_slope with fade
    show heroine ch20_spring at heroine_ch12_ch13_right
    narrator "KIA"
    taku "恭喜。"
    ai "谢谢。"
    narrator "她没有表现得特别高兴，只是认真地跨过轨道。"
    narrator "顾天鹏落后她一米多。经过家居量贩店时，她回头瞥了一眼，又放慢脚步等他到身边。"
    ai "我其实有点担心。担心自己做不好。"
    taku "这点最不用担心。你可是星野爱。"
    ai "可我不够善良，没什么朋友。"
    taku "有一个就不少。"
    ai "我讨厌别人，从来没喜欢过谁，没爱过谁。"
    taku "只是现在。"
    ai "我撒谎成性。"
    taku "否则就不是星野爱了。"
    narrator "树影在她脸上摇晃。她静静看着他，像有某种难以置信的东西在眼里发芽。"
    ai "顾天鹏，你讨厌谎言吗？"
    taku "不讨厌。"
    ai "即便是谎言，也会在某一天变成事实吗？"
    taku "或许吧。"
    ai "或许……"
    narrator "她低头思考。四月的风带着泥土和树叶的味道从两人之间经过。"
    narrator "午餐前分别时，星野爱站在涩谷街头向他挥手。"
    ai "顾天鹏，遇到你，今天很开心。"
    taku "我也一样。"
    ai "这次我先联系你。"
    taku "我等着你。"
    scene bg ch22_shibuya_spring with fade
    narrator "涩谷街头人流和车流交叠，春光落在玻璃幕墙上。"
    narrator "午餐前他们分开。顾天鹏接到小仓友希的电话，又赶去她家在东京开的咖啡店。"
    show yuki phone at cast_single_center
    yuki "你早上怎么不接电话？"
    taku "各种各样的事情。"
    yuki "约会是吧？"
    taku "没有。"
    yuki "快点去店里啦。找工作哪有你这种态度。"
    scene bg ch23_tokyo_cafe_day with fade
    show koizumi tray at cast_left
    show maki teach at cast_right
    narrator "店里装修明亮整齐，柜台前有两个女生和一个男生。"
    narrator "靠近门口的位置，有两个女生在聊偶像组合和自己喜欢的成员。顾天鹏从她们身旁走过，径直走向柜台。"
    narrator "她们把喜欢的偶像用奇怪的缩写称呼，笑得很认真。顾天鹏听着那些词，第一次觉得偶像离自己的生活并不遥远。"
    koizumi "友希姐姐跟我们说过了。顾天鹏，对吧。"
    taku "我是。"
    koizumi "那个，你就是顾天鹏吗？"
    show maki movie at cast_right
    maki "这么帅，肯定错不了啦。"

label chapter_23:
    $ ai_sprite_mode = False
    $ event_cg_mode = False
    scene bg ch23_tokyo_cafe_day with fade
    show koizumi tray at cast_left
    show maki teach at cast_right
    show nishida cafe at cast_far_right
    narrator "已读"
    narrator "洗完杯子的男生走过来，把顾天鹏误当成客人。小泉花海慌慌张张地解释。"
    nishida "你好，请问喝点什么？"
    show koizumi reach at cast_left
    koizumi "他不是客人啦。"
    narrator "小仓友希打电话过来，确认他已经到店，又隔着电话把他交给这里的人。"
    hide koizumi
    show yuki phone at cast_left
    yuki "好好教他，别让他偷懒。"
    show maki movie at cast_right
    maki "我认真的啊。"
    narrator "电话挂断后，寺本真姬又打了回去，隔着线路和小仓友希吵了几句。"
    maki "为什么你不来东京店里？"
    yuki "因为那边交给你们也没问题嘛。"
    maki "你真会使唤人。"
    hide yuki
    show koizumi reach at cast_left
    show maki teach at cast_right
    narrator "寺本真姬坚持要教咖啡流程，小泉花海则把简单的活交给顾天鹏。"
    narrator "小泉花海每次拜托他把东西放到上层架子时，都会先犹豫很久。她明明工作认真，却总担心自己显得没用。"
    narrator "顾天鹏没有点破，只把事情做好，再让她继续负责自己能做的部分。"
    narrator "傍晚离店前，店员们对他挥手。小泉花海低着头说辛苦了。"
    koizumi "友希姐姐说让你早点回去休息。"
    taku "你们晚点才下班？"
    koizumi "嗯。"
    taku "那我也晚点吧。"
    koizumi "不行。友希姐姐说了，就听她的吧。"
    narrator "她难得露出坚毅的眼神。顾天鹏只好点头。"
    narrator "傍晚，他买了一本《周刊少年 Jump》，回家做饭、锻炼、洗澡。"
    narrator "九点多，手机显示有一条未读消息。"
    ai_letter "顾天鹏，后天有没有空？能不能陪我出来。"

label chapter_24:
    scene bg ch30_apartment_phone with fade
    narrator "联络、工作、日常"
    narrator "顾天鹏回了具体时间。消息很快显示已读。"
    ai_letter "回了！！你决定就行！！"
    narrator "她又连着发来两个感叹号和一个兔子表情，好像单靠文字不够表达自己确实看见了回复。"
    narrator "星野爱问起他的工作，他也把排班大致告诉她。"
    ai_letter "工作怎么样？"
    taku "还在学。"
    ai_letter "咖啡店听起来好可靠。"
    taku "也可能只是打杂。"
    ai_letter "顾天鹏打杂也会很好看。"
    narrator "这句话显示已读以后，她又发来一句“这是夸奖”。"
    scene bg ch23_tokyo_cafe_day with dissolve
    show koizumi reach at cast_left
    show maki teach at cast_right
    show nishida cafe at cast_far_right
    narrator "第二天，顾天鹏照常到店。小泉花海笨手笨脚但认真，寺本真姬和西田秀树踩点上班，却干活利落。"
    narrator "咖啡店的工作逐渐变成日常：整理杯子、擦桌、确认库存、看寺本真姬演示不同单品的制作步骤。"
    narrator "小泉花海不太愿意把手里的活让出去。那不是排斥，只是害怕自己连简单的事都做不好。"
    narrator "九点整，寺本真姬和西田秀树几乎踩着秒针进门。寺本真姬总说电影至少看三遍，西田秀树则负责吐槽她。"
    show maki movie at cast_right
    maki "我还做过更过分的。"
    nishida "哈？"
    narrator "他们的吵闹让咖啡店多了一种稳定的日常感。顾天鹏逐渐能从那些无关紧要的斗嘴里判断一天是否正常。"
    maki "看电影看三遍才算看过。"
    nishida "哪有这样说的。"
    narrator "午饭时，西田秀树提到最近有个偶像选拔节目正在预热。"
    taku "等等，能跟我说说那个节目吗？"
    narrator "那一刻，他忽然对“偶像选拔”这几个字变得格外在意。"
    nishida "听说报名的人很多，最后能留下来的很少。"
    maki "那不是很正常吗？偶像这种东西本来就是筛出来的。"
    narrator "顾天鹏安静地听着，手里的乌冬面味道忽然像变淡了。"

label chapter_25:
    $ ai_sprite_mode = False
    scene bg ch25_library_sunset with fade
    narrator "于是，星野爱做出决定"
    narrator "下午四点多，顾天鹏一个人坐在图书馆看《伊豆的舞女》。"
    narrator "图书馆安静得能听见自己的呼吸。手机震动时，他很快把书合上。"
    ai_letter "昨天没说完的那件事，明天见面说。"
    narrator "他离开图书馆时，落日沉在两栋高楼之间，鱼鳞般的云被染成橘红。"
    scene bg ch23_tokyo_cafe_night with fade
    show nishida cafe at cast_left
    show maki movie at cast_right
    narrator "晚上交班前，寺本真姬问他是不是在等消息。顾天鹏说只是普通联络。"
    maki "普通联络也可以让人看起来不普通。"
    nishida "这话你从电影里学来的？"
    maki "至少看三遍才算学会。"
    scene bg ch30_apartment_phone with fade
    narrator "当天晚上，他又把偶像选拔节目的资料看了一遍。赛制、报名人数、前几届出道者名单，全都被他划进记忆里。"
    narrator "这些信息并不能让他更接近星野爱的决定，却能让那个决定变得不再只是一个词。"
    narrator "第二天上午，他跑步、吃早餐、听英语广播，然后按约定去车站。"
    $ ai_sprite_mode = True
    $ ai_sprite_outfit = "ch20_spring"
    $ ai_sprite_position = "right"
    scene bg ch20_sakura_slope with fade
    show heroine ch20_spring at heroine_ch12_ch13_right
    narrator "星野爱穿着白色长裙赶到他身边，气息还有些乱。"
    ai "对不起，来晚了！"
    taku "没关系，我也刚到。"
    narrator "他们沿着街道边走边聊。春日阳光明亮，面包房飘出香气，唱片店刚刚营业。"
    narrator "路边有人在画画，唱片店里飘出音乐。她像是真的很享受这段路，步子轻得几乎要跳起来。"
    ai "昨天没说完的那件事。"
    ai "我参加了。B小町，我们组合的名字。"
    taku "B小町。"
    ai "事务所一开始只找到三个人，不过，我决定加入了。"
    narrator "她说出“决定加入”的时候，表情比前一天更稳，像已经把某个沉重的念头按进心里。"
    ai "其实我本来还在想，要不要拒绝。"
    taku "现在不想了？"
    ai "嗯。至少现在不想。"
    taku "那就去做。"
    ai "你说得好轻松。"
    taku "因为我不是你。"
    ai "这句倒是很诚实。"

label chapter_26:
    $ ai_sprite_mode = True
    $ ai_sprite_outfit = "ch20_spring"
    $ ai_sprite_position = "right"
    scene bg ch20_sakura_slope with fade
    show heroine ch20_spring at heroine_ch12_ch13_right
    narrator "谎言"
    taku "挺好的。"
    ai "挺好的？没有别的感想？或者没有什么想问我的？"
    taku "你估计也不想回答吧。那不是秘密？"
    ai "这次不是。特地找你出来，就是想告诉你。"
    narrator "她说另外三个人大概叫高峰、二宫、渡边。名字还没完全记熟，却已经被她放进同一张未来的表里。"
    ai "昨天白天就在忙这些。没回消息不是故意的，真的不是谎言。"
    taku "这倒无所谓。"
    ai "还是解释一下比较放心。"
    narrator "他们穿过斑马线，路过电影院、甜品店和忠犬八公。附近有人发传单，也有人推广自己的账号。"
    narrator "因为要参加选秀，组合成员之后要多在一起训练。"
    ai "可能很少有时间再像这样出来了。今天也是我特别申请的假。"
    narrator "她说“假”这个字的时候，语气像刚拿到一件很短暂的礼物。"
    taku "我很期待。选秀那天我一定去捧场。"
    ai "那不还是不确定吗？"
    taku "口渴吗？"
    ai "还好。"
    taku "快到我工作的地方了。要不要去看看？"
    ai "不会打扰到吧？"
    taku "只是正常光顾，顺便请你喝咖啡。"
    ai "我更想喝你做的。"
    taku "下次在上班时间来找我就行。"
    ai "好！只要训练结束，一有空我绝对来找你。"
    scene bg ch23_tokyo_cafe_day with fade
    show koizumi tray at cast_left
    show maki movie at cast_right
    narrator "十一点左右，他们走进顾天鹏工作的咖啡店。值班的人看见星野爱，忍不住问他们是不是男女朋友。"
    narrator "星野爱一道谢便露出明亮笑容，男生女生都愣了一下。那是一种训练前就已经接近本能的光。"
    hide koizumi
    hide maki
    show heroine ch20_spring at heroine_ch12_ch13_right
    ai "是呢，我很喜欢他，当初就是我追的顾天鹏。"
    taku "没这回事。刚才那句是玩笑，我们是朋友。"
    narrator "他们坐到靠窗的位置。阳光透过玻璃照在桌上。"
    $ event_cg_mode = True
    scene cg ch26_ai_cafe_lie with dissolve
    narrator "外面有人在街边跳舞，玻璃把音乐和人声都隔得很远。"
    taku "又说谎了。"
    ai "偶像要学会表达爱意，正好在你这里先试一下。"
    ai "喜欢啊，爱啊什么的，好像也没那么难说出口。"
    taku "对其他人来说可能不是这么回事。"
    ai "搞不好我有当偶像的天赋？"
    taku "让我说的话，肯定会说有。"
    ai "你觉得是什么？"
    taku "说不过来。"
    ai "我觉得是谎言。"
    taku "不排除这个。"
    ai "喂，顾天鹏，我们现在是什么关系？你觉得。"

    window hide
    menu:
        "朋友":
            taku "朋友。"
            jump chapter_27

        "恋人":
            narrator "顾天鹏把这个词说出口的瞬间，星野爱的笑容停住了。"
            jump ending_overclear_relationship

        "说不清":
            narrator "顾天鹏没有回答。那份暧昧被留在咖啡店的阳光里，后来再也没有被认真捡起。"
            jump ending_overclear_relationship

label chapter_27:
    $ event_cg_mode = False
    $ ai_sprite_mode = True
    $ ai_sprite_outfit = "ch20_spring"
    $ ai_sprite_position = "right"
    scene bg ch23_tokyo_cafe_day with fade
    show heroine ch20_spring at heroine_ch12_ch13_right
    narrator "我推的舞女"
    ai "还有吗？"
    taku "没了。"
    ai "未免也太诚实了。"
    narrator "店员送来两杯抹茶星冰乐。星野爱低头插吸管，像在说天气一样平静。"
    ai "顾天鹏，我还挺喜欢你的。"
    taku "谎言。"
    narrator "她把喝进嘴里的饮料憋住，脸鼓起来。"
    taku "骗别人没问题，在我这里一点也行不通。"
    narrator "店员又送来一份草莓冰淇淋圣代，还自顾自判断他们处在“那种阶段”。星野爱笑着把误会收下。"
    ai "只是一句话而已，还有免费的圣代。就不能默默承受吗？"
    taku "我倒还好。"
    ai "那不就行咯。"
    narrator "两人喝完星冰乐。圣代几乎全被星野爱吃掉。顾天鹏问她偶像是否不需要身材管理。"
    ai "就一次而已，难得的机会，不会怎么样啦。"
    narrator "她把勺子放下，忽然像想起一直没问出口的问题。"
    ai "训练的地方很普通，也不是正式练习室。大家刚开始磨合，可能会有点乱。"
    taku "我可以坐远一点。"
    ai "倒也不用这么正式。"
    ai "有件事情一直没问。训练的时候，你能不能来？"

    window hide
    menu:
        "答应有时间就去":
            taku "那行。有时间我就去。"
            ai "不用那么经常啦。"
            taku "那去的时候联系你。"

        "担心打扰而拒绝":
            narrator "顾天鹏摇了摇头。"
            taku "你们刚开始训练，我还是不要打扰。"
            jump ending_unvisited_training

    narrator "星野爱笑着说这样一来，平常也可以互相接触了。"
    taku "互相打扰。"
    ai "到底叫什么都没关系吧。"
    narrator "那天晚上，顾天鹏在网上查了偶像选秀节目。报名者很多，能出道的几乎只有极少数。"
    narrator "他想到星野爱，总觉得她就是万里挑一的那个人。"
    narrator "屏幕上的资料一页页往下翻，他没有把那句话发给她。"
    narrator "他只是把手机扣在桌面上，开始想象她和另外三个名字站在同一个队形里的样子。"

label chapter_28:
    $ ai_sprite_mode = False
    $ event_cg_mode = False
    scene bg ch30_apartment_phone with fade
    show yuki phone at cast_single_center
    narrator "从御茶之水开始"
    narrator "翌日清晨，顾天鹏跑步、洗澡、吃早餐。小仓友希给他打来电话，模仿他说“我是顾天鹏”。"
    yuki "今天是第八次给你打电话的纪念日！"
    taku "那算什么纪念日？"
    yuki "每次都设一个纪念日，就永远不会忘记一共打了几次电话。"
    taku "这本来也没什么好记。"
    yuki "你不了解。"
    narrator "她又问他有没有和星野爱联系，语气装得随意。顾天鹏没有隐瞒。"
    yuki "那今天也要去见她？"
    taku "下午去看训练。"
    yuki "你还挺忙。"
    taku "工作也要去。"
    yuki "那就更忙了。"
    narrator "小仓友希沉默几秒，又故作轻松地说别在路上迷路。"
    yuki "御茶之水那边乐器店很多，看到吉他别傻站着。"
    taku "我不会。"
    yuki "你会。"
    scene bg ch23_tokyo_cafe_day with fade
    show koizumi reach at cast_left
    show maki teach at cast_right
    show nishida cafe at cast_far_right
    narrator "上午的咖啡店一如往常。小泉花海把够不到的东西拜托给他，寺本真姬继续教他咖啡制作，西田秀树照常和她斗嘴。"
    narrator "中午营业结束，几个人脱下制服围裙离开。寺本真姬他们在阳光下商量去哪吃饭，顾天鹏说自己没什么胃口。"
    scene bg ch25_library_sunset with fade
    narrator "中午结束营业后，顾天鹏一个人去书店。他给星野爱发消息，询问下午能不能过去看训练。"
    ai_letter "你下午要来吗？"
    taku "可以过去。"
    ai_letter "两点钟过来吧，那时候我们肯定在。"
    narrator "一点二十，他从涩谷站出发，在御茶之水下车。"
    scene bg ch28_music_street with fade
    narrator "他沿着神田川前进，穿过挂满吉他和宣传海报的乐器街，绕过公园，爬上几十级石阶。"
    narrator "路边宣传海报琳琅满目，某家店门口摆着醒目的角色立牌。他没有停留。"
    scene bg ch28_ochanomizu_steps with fade
    narrator "他绕过公园时，城市的声音像被树荫一层层削薄。石阶上方只剩风、叶子和远处少女数拍子的声音。"
    narrator "人烟逐渐变少。不远处的树荫底下，有少女的声音传来。"

label chapter_29:
    $ event_cg_mode = True
    $ ai_sprite_mode = False
    scene cg ch29_idol_practice with fade
    narrator "一切因你而起"
    narrator "四个少女在树荫下练习步伐。星野爱站在后方，认真跟着节拍。"
    narrator "右上角的女生注意到顾天鹏，动作慢了一拍。练习停下来，节拍声也跟着断掉。"
    $ event_cg_mode = False
    scene bg ch28_ochanomizu_steps with dissolve
    show sanae practice at cast_group_left
    show ritsuko practice at cast_group_midleft
    show heroine ch29_practice at cast_group_midright
    show mai practice at cast_group_right
    sanae "精神集中一点啦。我们时间不多，动作不整齐的话，到时候会被淘汰。"
    mai "早上练了那么久，中午吃完饭又练到现在，稍微休息一下比较合适吧。"
    ritsuko "对不起，都怪我。"
    ai "没办法的吧。社长和京子小姐也很希望我们成功。"
    mai "小爱，你又把社长名字叫错了。"
    ai "咦？"
    narrator "短暂的插科打诨让气氛松了一点。星野爱这才发现顾天鹏已经到了。"
    ai "什么时候来的？"
    taku "刚刚才到。"
    ai "是不是看到我训练了？"
    taku "来晚了，什么都没看见。"
    ai "真可惜。"
    taku "有点。"
    ai "要不去那边坐？今天没涂防晒，还是尽量不要晒太阳比较好。"
    taku "会打扰训练吧？"
    ai "现在是休息时间。"
    narrator "她说完便很自然地拽住他的手腕。那动作太快，顾天鹏连拒绝的姿势都没摆出来。"
    narrator "休息时，星野爱把顾天鹏拉到树荫下，介绍给其他三个人。"
    ai "这就是我提过的顾天鹏，顾天鹏。"
    sanae "多亏了你，B小町才有小爱加入。谢谢。"
    ritsuko "你、你好。"
    mai "少年，有没有兴趣加入莓Pro事务所？"
    narrator "渡边麻衣拎着一袋饮料回来，把椰子水、矿泉水和绿茶分给大家。"
    mai "这是早苗的，这是小爱的，这是律子的。"
    narrator "最后只剩一瓶无糖绿茶。渡边麻衣看了看顾天鹏，又看了看自己手里的饮料。"
    mai "给你，我下去再买。"
    taku "谢谢，不用了。"
    mai "真不用？"
    narrator "她立刻拧开瓶盖喝了一大口。"
    mai "你真是个好人！"
    taku "谢谢你的夸奖。"
    mai "你就是小爱说过的那个人呀？"
    narrator "顾天鹏看向星野爱。她歪头一笑。"
    ai "因为你的那句话，我才决定成为偶像。"
    narrator "顾天鹏一时间没有理解。她说得太自然，像早就决定把这句话在这里说给他听。"
    narrator "高峰早苗、二宫律子和渡边麻衣都看向他们。那几秒里，树荫下安静得能听见瓶盖被拧紧的声音。"

label chapter_30:
    $ event_cg_mode = False
    $ ai_sprite_mode = True
    $ ai_sprite_outfit = "ch29_practice"
    $ ai_sprite_position = "right"
    scene bg ch28_ochanomizu_steps with fade
    show sanae practice at cast_group_left
    show ritsuko practice at cast_group_midleft
    show heroine ch29_practice at cast_group_midright
    show mai practice at cast_group_right
    narrator "一成不变"
    taku "因为我？"
    ai "嗯，没错。"
    narrator "四月的温度恰到好处。高峰早苗和二宫律子都察觉到气氛微妙，渡边麻衣却毫不客气地插嘴。"
    mai "多亏了你！让小爱答应加入 B 小町可费了社长好大功夫。"
    sanae "笨蛋渡边，这个时候说什么呢。"
    ritsuko "我也过去好了……"
    $ event_cg_mode = True
    scene cg ch30_ai_secret_training with dissolve
    narrator "其他人离开后，星野爱靠近一点，把手指放在唇边。"
    ai "那就当是秘密咯。"
    narrator "她笑得很自然，声音干净到像透明的水。"
    narrator "可那句话是谎言。一个毫无疑问的谎言。"
    narrator "顾天鹏甚至险些以为它是真的。也许连星野爱自己，都在那一瞬间相信了那句话。"
    narrator "他张开嘴，想问清楚那句话究竟指什么，最后却什么也没有说。"
    narrator "风吹进阳光里，橡树叶在头顶簌簌响。远处有人交谈，落在地上的叶片被踩碎。"
    narrator "星野爱却像什么都没发生，拿出手机给他看舞蹈视频。她指着屏幕讲解队形，语气认真得像在讲一件极其普通的事。"
    ai "这里要转身，然后第四拍要对齐。"
    taku "看起来很难。"
    ai "是吧？所以她们才一直说要练。"
    $ event_cg_mode = False
    $ ai_sprite_mode = True
    $ ai_sprite_outfit = "ch30_practice_tired"
    scene bg ch28_ochanomizu_steps with fade
    show sanae practice at cast_group_left
    show ritsuko practice at cast_group_midleft
    show heroine ch30_practice_tired at cast_group_midright
    show mai practice at cast_group_right
    narrator "两点四十多，B小町的休息结束。星野爱回去训练，顾天鹏坐在远处看着。"
    ai "还没准备走吧？"
    taku "时间还早。"
    ai "要是不嫌无聊，就留下来陪着我们训练，怎么样？"
    taku "没问题。本来也是因为这个来的。"
    ai "好的～"
    sanae "小爱这里的问题比较大，要多注意。渡边，第四拍没跟上。"
    mai "我已经尽力啦。"
    ritsuko "抱歉。"
    narrator "临近五点，训练结束。"
    ai "要不要一起吃饭？"
    taku "不用了。晚上还有工作，现在差不多要回去了。"
    ai "那我送你。"
    taku "训练那么久，怎么可能不饿。就这样吧，我先走了。"
    narrator "星野爱望着他离开的方向，欲言又止。"
    narrator "送他一程是借口，不饿也是谎言。她只是想在路上多说点话而已。"
    narrator "但这种想法又显得莫名其妙。直到顾天鹏已经走远，她也没想明白刚才究竟想说什么。"
    narrator "她只知道今天相处的时间太短，短到连一句普通的再见都显得不够。"
    scene bg ch23_tokyo_cafe_night with fade
    narrator "顾天鹏提前十分钟回到咖啡店。六点换上制服，工作一直持续到九点。"
    scene bg ch30_apartment_phone with fade
    narrator "回到家里，十一点三十多，他做完每天该做的事，换上干净短袖坐到书桌旁。"
    narrator "手机振动了一下。"
    show yuki phone at cast_single_center
    yuki "晚安。"
    narrator "消息很简单。"
    return


label ending_karuizawa_fade:
    $ ai_sprite_mode = False
    $ event_cg_mode = False
    scene bg ch17_pet_shop with fade
    narrator "顾天鹏没有接受那份兼职。"
    narrator "轻井泽的冬天仍然安静，猫、咖啡、书店和街景都只是旅途里经过的东西。"
    narrator "春天到来以前，他回了东京。后来某个四月，他路过一条开满樱花的坡道，却没有在那里停下。"
    return


label ending_spring_no_line:
    $ ai_sprite_mode = False
    $ event_cg_mode = False
    scene bg ch20_sakura_slope with fade
    narrator "照片被她收下了，联系方式却没有交换。"
    narrator "樱花仍旧落在他们之间，电车也照常驶过。只是春天再明亮，也没有办法替沉默发送消息。"
    return


label ending_overclear_relationship:
    $ ai_sprite_mode = False
    $ event_cg_mode = False
    scene bg ch23_tokyo_cafe_night with fade
    narrator "那个答案太快，也太明确。"
    narrator "星野爱笑着把话题带过去，像什么都没有发生。可之后的联系变得礼貌，训练邀请也没有再出现。"
    narrator "有些关系不是不能靠近，只是不能用错误的名字靠近。"
    return


label ending_unvisited_training:
    $ ai_sprite_mode = False
    $ event_cg_mode = False
    scene bg ch28_ochanomizu_steps with fade
    narrator "顾天鹏没有去御茶之水。"
    narrator "星野爱仍然开始训练，B小町也仍然向选秀节目靠近。只是她没有机会在树荫下对他说，那一切因他而起。"
    return


label ending_summer_promise:
    $ ai_sprite_mode = False
    $ ai_sprite_position = "center"
    $ event_cg_mode = False

    scene bg ch10_old_karuizawa_street with fade
    narrator "顾天鹏没有立刻追去车站，也没有把那封信当成故事的结尾。"
    narrator "他在旧轻井泽的街上走了很久，最后停在那家他们曾经路过的服装店前。"
    narrator "橱窗里，夏天的裙子已经换到更显眼的位置。"
    taku "到时候再买也不迟。"
    narrator "他说过这句话。"
    narrator "于是他推开门，把那件衣服买了下来。"
    narrator "不是为了替她决定什么，只是为了把一个还没来得及抵达的季节，好好留住。"

    scene bg station_sunbreak with fade
    narrator "后来，冬天过去，春天也过去。"
    narrator "顾天鹏开始工作，按时吃饭，继续跑步，也继续读那本被她翻过的书。"
    narrator "他没有把她变成必须追回来的目标。"
    narrator "只是每到下雨的列车，每到甜点店的橱窗，每到有人说起夏天，他都会想起她。"
    narrator "七月的第一个周末，他收到一张没有署名的明信片。"
    ai_letter "夏天到了。那件衣服，还在吗？"
    narrator "字迹很轻，像害怕把什么惊醒。"
    narrator "顾天鹏看了很久，终于笑出来。"

    scene bg ch10_ice_cream_shop with fade
    narrator "他们在夏天的轻井泽重逢。"
    narrator "星野爱戴着帽子，站在冰淇淋店门口，像只是迟到了几分钟。"
    ai "顾天鹏。"
    taku "我在。"
    narrator "她听见这句话，眼睛弯起来。"
    ai "衣服呢？"
    taku "在。"
    ai "那就好。"
    narrator "她没有解释自己为什么离开，也没有立刻把所有难过都说清楚。"
    narrator "顾天鹏也没有催。"
    narrator "夏天很长，长到足够让他们把没说完的话慢慢补上。"
    narrator "夏天的风从街角吹来，把他们没说完的话轻轻往前推。"

    return


label route_main_search:
    $ ai_sprite_mode = False
    $ ai_sprite_position = "center"
    $ event_cg_mode = False

    scene bg ch10_inn_evening_room with fade
    narrator "顾天鹏没有把退房手续立刻办完。"
    narrator "他先去前台询问清晨最早离开的客人，又把车站方向、出租车乘车点和旅馆门前被雨水打湿的石阶，一处一处重新走过。"
    narrator "星野爱留下的话很清楚。不要来找我。"
    narrator "可越是清楚，那句话就越像一扇被人从里面反锁的门。"
    taku "如果这也是谎言呢。"
    narrator "他轻声说出口。"
    narrator "能力没有回应。因为那句话不是她亲口说给他听的，只是一行落在纸上的字。"
    narrator "顾天鹏把信纸贴回胸口。"
    taku "那我只能自己判断。"

    scene bg ch9_karuizawa_bus_stop with fade
    narrator "公交站台上还残留着昨夜的雨。"
    narrator "他从时刻表上确认最早一班车的方向，又向站务员描述清晨拖着行李箱的少女。"
    narrator "得到的答案并不完整：白色裙子，浅色外套，很安静，似乎没有买去东京的票。"
    narrator "不是东京。"
    narrator "这个结论让他心脏缓慢地跳了一下。"
    narrator "轻井泽之外，还有长野、还有高崎、还有更远的某个站台。"
    narrator "她并不是凭空消失。只是把自己藏进了无数可能性里。"

    scene bg train_table_rain with fade
    narrator "午后，顾天鹏坐上离开轻井泽的列车。"
    narrator "车窗外的雨线不断后退，像有人把这几天的风景一格一格卷回胶片。"
    narrator "他摊开随身带着的地图，在每一个可能换乘的车站旁做下记号。"
    narrator "这不是浪漫的追逐。"
    narrator "也不是笃定能抵达结局的冒险。"
    narrator "只是他第一次不愿把一个人的离开，轻易理解成故事的句号。"
    taku "爱。"
    narrator "名字落在车厢的低声轰鸣里。"
    taku "如果还能再相见，我会先问你过得好不好。"
    narrator "他顿了顿，把笔尖按在纸上。"
    taku "然后再问，你到底想不想被找到。"
    narrator "列车驶入隧道，窗外短暂地黑了下去。"
    narrator "黑暗中，顾天鹏看见自己的倒影。"
    narrator "那张脸不再像一个被留在原地的人。"
    narrator "列车驶出隧道时，远处露出一线很淡的天光。"

    return


label route_side_memory:
    $ ai_sprite_mode = False
    $ ai_sprite_position = "center"
    $ event_cg_mode = False

    scene bg ch10_inn_evening_room with fade
    narrator "顾天鹏最后还是没有去车站询问。"
    narrator "这并不是因为他真的相信那封信里的每一个字。"
    narrator "只是他忽然意识到，追上去并不一定意味着靠近。"
    narrator "有些人离开时已经用尽了力气。如果连这点距离都不肯留给她，也许反而会把那几天一起弄坏。"
    narrator "他把信收好，替她退掉了没有用完的早餐券。"
    narrator "旅馆老板娘问他是否还要续住一天。"
    narrator "顾天鹏想了想，点头。"

    scene bg ch12_kumoba_pond with fade
    narrator "他一个人去了云场池。"
    narrator "水面仍旧明亮，秋天仍旧倒在里面，像昨天没有发生过任何告别。"
    narrator "他站在岸边，把那张没有丢掉的照片举到眼前。"
    narrator "照片里的她笑得很好看。"
    narrator "现实里只剩风吹过水面，细小的波纹把天空切成无数碎片。"
    taku "你看。"
    narrator "顾天鹏对着空无一人的身旁说。"
    taku "今天的秋天也掉进水里了。"
    narrator "没有人回答他。"
    narrator "但这一次，沉默没有把他推回原地。"

    scene bg ch13_miharashidai_sunset with fade
    narrator "傍晚，他又去了见晴台。"
    narrator "秋千还在那里，藤条在风里轻轻晃动。"
    narrator "顾天鹏坐上去，只晃了一下就停住。"
    narrator "他终于明白，一个人完成两个人的旅行，并不是为了假装她还在。"
    narrator "而是为了确认她确实来过。"
    narrator "确认那几天的开心、害怕、向日葵和拙劣的玩笑，都不是可以被一封信完全带走的东西。"
    narrator "夕阳落下去以前，他把那张照片放回书页。"
    taku "如果还能再相见。"
    narrator "他望着远处的山线，声音很轻。"
    taku "我会告诉你，轻井泽的秋天，我替你走完了。"
    narrator "风吹过树梢。"
    narrator "夕阳完全落下去的时候，他终于能把那几天称作回忆。"

    return


label ending_leaf_bookmark:
    $ ai_sprite_mode = False
    $ ai_sprite_position = "center"
    $ event_cg_mode = False

    scene bg ch9_roadside_steps with fade
    narrator "那天之后，他们没有立刻把喜欢的理由说清楚。"
    narrator "红色落叶被夹进《了不起的盖茨比》里，叶脉薄得像一张不敢寄出的信。"
    narrator "星野爱偶尔会问一句："
    ai "保证金还在吗？"
    narrator "顾天鹏每次都把书拿出来给她看。叶子越来越干，颜色却没有完全褪掉。"
    narrator "旅行后来还是走到了分别。只是这一次，她留下的信里多了一行字。"
    ai_letter "冬天的理由，我想起来了。因为那几天，有人把我的秘密当成秘密保管。"
    narrator "很久以后，顾天鹏在夏天打开那本书。落叶已经脆得不能再碰，夹在书页里的影子却还完整。"
    narrator "他终于把自己的答案写在空白处："
    taku "因为夏天适合重逢。"
    narrator "窗外蝉声渐起，夏天终于替那片叶子补上了迟来的回答。"

    return


label ending_missed_companion:
    $ ai_sprite_mode = False
    $ ai_sprite_position = "center"
    $ event_cg_mode = False

    scene bg train_table_night with fade
    narrator "夜色降下来以后，两个人之间重新变得安静。"
    narrator "星野爱没有再提出同行，也没有表现出失望。"
    narrator "她只是把攻略收回包里，趴在桌上睡着了。"
    narrator "顾天鹏看着窗玻璃里的倒影，忽然意识到，有些故事并不会因为相遇就自动开始。"
    narrator "第二天清晨，他们在越后汤泽的站台分别。"
    narrator "她拖着白色行李箱走进人群，没有回头。"
    narrator "顾天鹏后来一个人泡温泉、看雪、吃荞麦面。"
    narrator "那些风景都很好，只是再也没有谁站在旁边说自己是世界上最贪婪的少女。"
    narrator "后来他再想起那趟列车，只记得窗外的雪很白，身边的位置很空。"

    return


label ending_empty_encouragement:
    $ ai_sprite_mode = False
    $ ai_sprite_position = "center"
    $ event_cg_mode = False

    scene bg ch5_summit_sunset with fade
    narrator "黄昏把雪地染成温柔的金色。"
    narrator "星野爱听完那句鼓励，笑着点了点头。"
    narrator "那笑容没有错，却也没有真正抵达她心里。"
    narrator "顾天鹏很久以后才明白，有些时候，急着把人从难过里拉出来，反而会让对方更确信自己不该开口。"
    narrator "下山以后，她仍然活泼，仍然会开玩笑。"
    narrator "只是那些更深的话，再也没有被她拿出来过。"
    narrator "旅行结束那天，她礼貌地道谢，像谢过一位偶然同行的好人。"
    narrator "那些没能继续说下去的话，最终和山顶的风一起散在雪里。"

    return


label ending_light_answer:
    $ ai_sprite_mode = False
    $ ai_sprite_position = "center"
    $ event_cg_mode = False

    scene bg ch10_white_church_wedding with fade
    narrator "掌声渐渐远去，白鸽也飞过屋檐。"
    narrator "顾天鹏给出了一个很认真的答案，可它太轻了。"
    narrator "星野爱把那句“会的”收下，像收下一张漂亮却没有重量的明信片。"
    narrator "他们仍然去吃午饭，仍然买蛋糕，也仍然在夜里分掉那块巧克力奶油。"
    narrator "可那扇门已经重新关上。"
    narrator "第二天早晨，她离开得很早，信里只写着一句："
    ai_letter "谢谢你。你是个温柔的人。"
    narrator "温柔有时并不够。"
    narrator "信纸被他折回原样，轻得几乎拿不住。"

    return


label ending_too_close:
    $ ai_sprite_mode = False
    $ ai_sprite_position = "center"
    $ event_cg_mode = False

    scene bg ch13_miharashidai_sunset with fade
    narrator "顾天鹏靠近得太快。"
    narrator "星野爱没有躲开，只是把水瓶握得很紧，指节一点点泛白。"
    ai "对不起，我没事。"
    narrator "她笑起来，笑得比刚才更像没事。"
    narrator "顾天鹏停在她身边，却忽然发现自己已经错过了最该停下来的距离。"
    narrator "那天晚上，她没有再哭。"
    narrator "第二天，她也没有留下那封更长的信。"
    narrator "桌上只有一张便签，字迹工整得像练习过很多遍。"
    ai_letter "我先走了。祝你之后旅行顺利。"
    narrator "那张便签在桌上停了很久，像一扇再也没有被敲响的门。"

    return


label ending_white_church:
    $ ai_sprite_mode = False
    $ ai_sprite_position = "center"
    $ event_cg_mode = False

    scene bg ch10_white_church_wedding with fade
    narrator "那天他们没有继续站在教堂前看别人的婚礼。"
    narrator "星野爱拉着他绕到教堂后面，那里没有掌声，只有一排被风吹得发亮的树。"
    ai "以后再确认，听起来像拖延。"
    taku "也可以叫预约。"
    narrator "她笑了很久。"
    narrator "后来那句话没有马上兑现。她仍然离开，仍然留下信。"
    narrator "可很多年后，顾天鹏收到一张白色教堂的照片。"
    ai_letter "预约还算数吗？"
    narrator "照片背面没有地址，只盖着轻井泽的邮戳。"
    narrator "顾天鹏把照片翻过来，指尖停在那枚轻井泽邮戳上。"

    return


label ending_silver_chain:
    $ ai_sprite_mode = False
    $ ai_sprite_position = "center"
    $ event_cg_mode = False

    scene bg ch10_old_karuizawa_street with fade
    narrator "离开饰品店时，星野爱没有买下那对手链。"
    narrator "可是走出几步以后，她又回头看了一眼。"
    ai "那个真的有点太直白了。"
    taku "嗯。"
    ai "所以才会记住。"
    narrator "傍晚时，顾天鹏偷偷折回去，把其中一条买了下来。"
    narrator "他没有送出去，只把它放进书页里，和那张云场池的照片夹在一起。"
    narrator "很多年后，银色坠子仍然没有氧化，像某个始终没有说出口的答案。"
    narrator "书页合上时，银光仍在很深的地方静静亮着。"

    return


label ending_sunflower_between:
    $ ai_sprite_mode = False
    $ ai_sprite_position = "center"
    $ event_cg_mode = False

    scene bg ch13_miharashidai_sunset with fade
    narrator "向日葵被放在两个人中间。"
    narrator "它不属于谁，也没有替谁承担所有重量。"
    narrator "星野爱看着那枝花，终于慢慢低下头。"
    ai "这样的话，好像就不会弄脏了。"
    taku "嗯。"
    ai "因为不是我一个人的东西。"
    narrator "他们在夕阳里坐到很晚。"
    narrator "之后的某一天，顾天鹏收到一张照片。照片里只有一枝向日葵，插在透明玻璃瓶里。"
    ai_letter "它还在朝着太阳。"
    narrator "那一刻，他才明白，有些太阳确实可以被好好保存下来。"

    return


label ending_bench_dawn:
    $ ai_sprite_mode = False
    $ ai_sprite_position = "center"
    $ event_cg_mode = False

    scene bg ch14_roadside_bench_night with fade
    narrator "那一晚，他们真的坐了很久。"
    narrator "没有人急着许诺，也没有人急着把明天安排成某种正确答案。"
    narrator "星野爱靠在长椅另一端，闭着眼睛，像只是想确认身旁还有人。"
    ai "顾天鹏。"
    taku "我在。"
    ai "明天如果我还是很麻烦呢？"
    taku "那就明天再说。"
    narrator "天快亮的时候，她没有离开。"
    narrator "她只是把那封写了一半的信揉成很小的一团，塞进口袋里。"
    narrator "晨光从路尽头慢慢漫过来，把那张没有寄出的信照得很亮。"

    return


label ending_quiet_parting:
    $ ai_sprite_mode = False
    $ ai_sprite_position = "center"
    $ event_cg_mode = True

    scene cg ch15_empty_room_letter with fade
    narrator "顾天鹏醒来时，窗外的竹林被晨雾压得很低。"
    narrator "旁边的被褥已经冷了，桌上只剩一封折好的信。"
    narrator "信里没有责怪，也没有请求，只写着一句很轻的话："
    ai_letter "谢谢你陪我走到这里。接下来的路，我想一个人试试看。"
    narrator "他把那句话读了很久。"
    narrator "如果昨晚多停一会儿，如果没有把她的计划当成玩笑，也许故事还会继续。"
    narrator "可是选择已经落下，像清晨合上的门。"
    narrator "她没有等到明天。"
    narrator "清晨的门缝里没有回声，只剩信纸在桌上安静地等他醒来。"

    return



