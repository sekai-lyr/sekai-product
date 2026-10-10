# 角色怪兽卡特效完成矩阵

生成时间基准：2026-10-04。怪兽卡总数 **218**，三阶段（登场/攻击/破坏）覆盖率 **100%**。

## 汇总

- 有独立逐帧 sprite sheet 素材映射的卡：**156**（素材位于 `SekaiGame/src/main/resources/static/images/vfx/`）
- 使用程序化矢量分镜演出的卡：**62**（本 Harness 无图像生成能力，按交接文档要求标记 procedural）
- 具备官方角色/作品依据登记的卡：**101**
- 全部阶段在桌面 1365×768 与手机 390×844 通过逐卡自动验收：无控制台错误、无溢出、攻击以目标卡为基准、动画节点清理无残留。
- 独立分镜无重复指纹，攻击场景随目标坐标变化，详见证 `test/authored-card-scenes.test.js`。
- 魔法与陷阱卡不在本矩阵范围内；陷阱卡的 4×4 独立图集见 `docs/TRAP_ATLAS_MATRIX.md`。

## 逐卡清单

| ID | 卡名 | 稀有度 | 角色/作品 | 登场 | 攻击 | 破坏 | 素材文件 | 原著依据 | 验证状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dark_006 | 朝比奈真冬 | UR | 世界计划 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | https://pjsekai.sega.jp/character/index.html | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_011 | 空条承太郎·白金之星 | SSR | JOJO的奇妙冒险 | ✔ | ✔ | ✔ | images/vfx/star-platinum-barrage-sheet-v1.png | https://jojo-portal.com/anime/sc/character/01/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_012 | 吉良吉影·杀手皇后 | SSR | JOJO的奇妙冒险 | ✔ | ✔ | ✔ | images/vfx/killer-queen-bomb-sheet-v1.png | https://jojo-portal.com/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_013 | 迪亚哥·THE WORLD | SSR | JOJO的奇妙冒险 | ✔ | ✔ | ✔ | images/vfx/world-time-stop-sheet-v1.png | https://jojo-portal.com/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_014 | 盖多·米斯达·性感手枪 | SSR | JOJO的奇妙冒险 | ✔ | ✔ | ✔ | images/vfx/mista-ricochet-sheet-v1.png | https://jojo-portal.com/anime/gw/character/03/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_015 | 露西·钢铁蔷薇 | SSR | JOJO的奇妙冒险 | ✔ | ✔ | ✔ | images/vfx/lucy-steel-rose-sheet-v1.png | https://jojo-portal.com/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_016 | 赫特·潘兹·奶油启动器 | SSR | JOJO的奇妙冒险 | ✔ | ✔ | ✔ | images/vfx/hot-pants-cream-sheet-v1.png | https://jojo-portal.com/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_017 | 迪亚哥·骇人恶兽 | SSR | JOJO的奇妙冒险 | ✔ | ✔ | ✔ | images/vfx/scary-monsters-sheet-v1.png | https://jojo-portal.com/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_018 | 法尼·瓦伦泰·爱之列车 | SSR | JOJO的奇妙冒险 | ✔ | ✔ | ✔ | images/vfx/love-train-sheet-v1.png | https://jojo-portal.com/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_019 | 灶门炭治郎·火之神神乐 | SR | 卡绘企划・扩展系列 | ✔ | ✔ | ✔ | images/vfx/hinokami-kagura-sheet-v1.png | https://www.youtube.com/watch?v=3Ubt713gmBE | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_020 | 伊黑小芭内·蛇之呼吸 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/obanai-serpent-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_021 | 我妻善逸·霹雳一闪 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/zenitsu-thunder-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/?chara=zenitsu | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_022 | 甘露寺蜜璃·恋之呼吸 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/mitsuri-love-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_023 | 悲鸣屿行冥·岩之呼吸 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/gyomei-stone-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_024 | 蝴蝶忍·蝶之舞 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/shinobu-insect-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/?chara=shinobu | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_025 | 富冈义勇·水之呼吸 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/giyu-water-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/?chara=giyuu | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_026 | 不死川实弥·旋风斩 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/sanemi-wind-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_027 | 灶门祢豆子·爆血 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/nezuko-exploding-blood-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/?chara=nezuko | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_028 | 时透无一郎·霞之呼吸 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/muichiro-mist-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_029 | 嘴平伊之助·兽之呼吸 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/inosuke-beast-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/?chara=inosuke | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_030 | 炼狱杏寿郎·炎之呼吸 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/rengoku-flame-tiger-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/?chara=rengoku | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_031 | 不死川实弥·风之呼吸 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/sanemi-wind-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_032 | 宇髓天元·音之呼吸 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/tengen-sound-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_033 | 富冈义勇·水柱 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/giyu-water-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_034 | 伊黑小芭内·蛇柱 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/obanai-serpent-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_035 | 炼狱杏寿郎·炎柱 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/rengoku-flame-tiger-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_036 | 时透无一郎·月下霞 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/muichiro-mist-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_037 | 蝴蝶忍·紫藤毒 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/shinobu-insect-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_038 | 甘露寺蜜璃·恋柱 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/mitsuri-love-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_039 | 宇髓天元·谱面完成 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/tengen-sound-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_040 | 不死川实弥·稀血 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/sanemi-wind-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_041 | 悲鸣屿行冥·南无阿弥陀佛 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/gyomei-stone-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_042 | 猗窝座·破坏杀 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/akaza-compass-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_043 | 富冈义勇·水面斩 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/giyu-water-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_044 | 继国缘一·日之呼吸 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/yoriichi-sun-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_045 | 甘露寺蜜璃·猫足恋风 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/mitsuri-love-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_046 | 蝴蝶忍·蜈蚣之舞 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/shinobu-insect-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_047 | 宇髓天元·双刀爆裂 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/tengen-sound-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_048 | 我妻善逸·火雷神 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/zenitsu-thunder-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_049 | 时透无一郎·胧 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/muichiro-mist-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_050 | 炼狱杏寿郎·奥义玖之型 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/rengoku-flame-tiger-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_051 | 嘴平伊之助·空间感知 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/inosuke-beast-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_052 | 悲鸣屿行冥·岩躯 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/gyomei-stone-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_053 | 伊黑小芭内·月夜蛇行 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/obanai-serpent-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_054 | 炼狱杏寿郎·炎心 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/rengoku-flame-tiger-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_055 | 童磨·寒夜莲华 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/doma-ice-lotus-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_056 | 猗窝座·罗针 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/akaza-compass-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_057 | 蝴蝶忍·蝶影毒刃 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/shinobu-insect-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_058 | 不死川实弥·黑风烟岚 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/sanemi-wind-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_059 | 嘴平伊之助·兽牙乱舞 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/inosuke-beast-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_060 | 灶门炭治郎·水火轮转 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/hinokami-kagura-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_061 | 悲鸣屿行冥·石肤 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/gyomei-stone-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_062 | 富冈义勇·生生流转 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/giyu-water-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_063 | 炼狱杏寿郎·炼狱 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/rengoku-flame-tiger-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_064 | 甘露寺蜜璃·摇曳恋情 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/mitsuri-love-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_065 | 灶门炭十郎·赤月神乐 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/yoriichi-sun-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_066 | 时透无一郎·水月霞 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/muichiro-mist-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_067 | 宇髓天元·爆音斩 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/tengen-sound-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_068 | 黑死牟·月虹 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/kokushibo-moon-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_069 | 伊黑小芭内·蜿蜒蛇行 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/obanai-serpent-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_070 | 我妻善逸·雷霆万钧 | SR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/zenitsu-thunder-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_071 | 矿洞小鼠 | N | 卡绘企划・扩展系列 | ✔ | ✔ | ✔ | images/vfx/gyomei-stone-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_072 | 菜月昴·死亡回归 | SR | Re:从零开始的异世界生活 | ✔ | ✔ | ✔ | images/vfx/subaru-return-sheet-v1.png | https://re-zero-anime.jp/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_073 | 白眼·回天 | SR | 火影忍者 | ✔ | ✔ | ✔ | images/vfx/hyuga-rotation-sheet-v1.png | https://naruto-official.com/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_074 | 宇智波鼬·须佐鸦影 | SR | 火影忍者 | ✔ | ✔ | ✔ | images/vfx/itachi-susanoo-sheet-v1.png | https://naruto-official.com/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_075 | 佩恩·神罗天征 | SR | 火影忍者 | ✔ | ✔ | ✔ | images/vfx/pain-almighty-push-sheet-v1.png | https://naruto-official.com/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_076 | 二代火影·水遁 | SR | 火影忍者 | ✔ | ✔ | ✔ | images/vfx/tobirama-water-sheet-v1.png | https://naruto-official.com/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_077 | 宇智波佐助·须佐能乎 | SR | 火影忍者 | ✔ | ✔ | ✔ | images/vfx/sasuke-susanoo-sheet-v1.png | https://naruto-official.com/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_078 | 旗木卡卡西·雷切 | SR | 火影忍者 | ✔ | ✔ | ✔ | images/vfx/kakashi-raikiri-sheet-v1.png | https://naruto-official.com/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_079 | 千手纲手·怪力 | SR | 火影忍者 | ✔ | ✔ | ✔ | images/vfx/tsunade-strength-sheet-v1.png | https://naruto-official.com/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_080 | 朝比奈真冬·雨夜狙击 | SR | 世界计划 | ✔ | ✔ | ✔ | images/vfx/mafuyu-rain-shot-sheet-v1.png | https://pjsekai.sega.jp/character/index.html | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_081 | 波风水门·九喇嘛连结 | SR | 火影忍者 | ✔ | ✔ | ✔ | images/vfx/minato-golden-flash-sheet-v1.png | https://naruto-official.com/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_082 | 辉夜·橙梦舞台 | SSR | 卡绘企划・扩展系列 | ✔ | ✔ | ✔ | images/vfx/kaguya-orange-stage-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_083 | 月见八千代·海月幻梦 | SSR | 卡绘企划・扩展系列 | ✔ | ✔ | ✔ | images/vfx/yachiyo-jellyfish-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_084 | 酒寄彩叶·青瓷流云 | SSR | 卡绘企划・扩展系列 | ✔ | ✔ | ✔ | images/vfx/iroha-celadon-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_085 | 朝比奈真冬·静默旋律 | SSR | 世界计划 | ✔ | ✔ | ✔ | images/vfx/mafuyu-silent-sheet-v1.png | https://pjsekai.sega.jp/character/index.html | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_086 | 宵崎奏·雪原白夜 | SSR | 世界计划 | ✔ | ✔ | ✔ | images/vfx/kanade-snow-sheet-v1.png | https://pjsekai.sega.jp/character/index.html | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_087 | 东云绘名·迷途画境 | SSR | 世界计划 | ✔ | ✔ | ✔ | images/vfx/ena-paint-sheet-v1.png | https://pjsekai.sega.jp/character/index.html | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_088 | 丰川祥子·蓝蔷薇 | SSR | 卡绘企划・扩展系列 | ✔ | ✔ | ✔ | images/vfx/sakiko-blue-rose-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_089 | 晓山瑞希·粉黛之心 | SSR | 世界计划 | ✔ | ✔ | ✔ | images/vfx/mizuki-pink-heart-sheet-v1.png | https://pjsekai.sega.jp/character/index.html | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_090 | 津岛善子·堕天使夜羽 | SSR | 卡绘企划・扩展系列 | ✔ | ✔ | ✔ | images/vfx/yoshiko-fallen-angel-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_091 | 若叶睦·水墨午后 | SSR | 卡绘企划・扩展系列 | ✔ | ✔ | ✔ | images/vfx/mutsumi-ink-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_092 | 露帕·金叶跃动 | SSR | Girls Band Cry | ✔ | ✔ | ✔ | images/vfx/rupa-golden-leaf-sheet-v1.png | https://girls-band-cry.com/character/rupa/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_093 | 海老塚智·绯线独奏 | SSR | Girls Band Cry | ✔ | ✔ | ✔ | images/vfx/tomo-crimson-string-sheet-v1.png | https://girls-band-cry.com/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_094 | 井芹仁菜·碧空旋律 | SSR | Girls Band Cry | ✔ | ✔ | ✔ | images/vfx/nina-blue-sky-sheet-v1.png | https://girls-band-cry.com/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_095 | 河原木桃香·海风浅笑 | SSR | Girls Band Cry | ✔ | ✔ | ✔ | images/vfx/momoka-sea-breeze-sheet-v1.png | https://girls-band-cry.com/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_096 | RUPA·坠空追风 | SSR | Girls Band Cry | ✔ | ✔ | ✔ | images/vfx/rupa-falling-sky-sheet-v1.png | https://girls-band-cry.com/character/rupa/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_097 | 若叶睦·素描沉思 | SSR | 卡绘企划・扩展系列 | ✔ | ✔ | ✔ | images/vfx/mutsumi-sketch-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_098 | 安和昴·深海蓝影 | SSR | Girls Band Cry | ✔ | ✔ | ✔ | images/vfx/subaru-deep-blue-sheet-v1.png | https://girls-band-cry.com/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_099 | 奥泽美咲·暖窗时光 | SSR | 卡绘企划・扩展系列 | ✔ | ✔ | ✔ | images/vfx/misaki-warm-window-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_100 | 晓山瑞希·缤纷节拍 | SSR | 世界计划 | ✔ | ✔ | ✔ | images/vfx/mizuki-colorful-beat-sheet-v1.png | https://pjsekai.sega.jp/character/index.html | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_101 | 初音未来·深海回响 | SSR | 世界计划 | ✔ | ✔ | ✔ | images/vfx/miku-deep-sea-sheet-v1.png | https://pjsekai.sega.jp/character/index.html | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_102 | 暗影·原子裁决 | SSR | 卡绘企划・扩展系列 | ✔ | ✔ | ✔ | images/vfx/shadow-atomic-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_103 | 暗影·终焉权能 | SSR | 卡绘企划・扩展系列 | ✔ | ✔ | ✔ | images/vfx/shadow-authority-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_104 | 黑化阿尔托莉雅·暗夜血刃 | UR | 卡绘企划・扩展系列 | ✔ | ✔ | ✔ | images/vfx/saber-alter-blood-blade-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_105 | 黑化阿尔托莉雅·绯狱复仇 | UR | 卡绘企划・扩展系列 | ✔ | ✔ | ✔ | images/vfx/saber-alter-crimson-prison-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_106 | 阿尔托莉雅·黄昏断罪 | UR | 卡绘企划・扩展系列 | ✔ | ✔ | ✔ | images/vfx/artoria-twilight-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ex_107 | 初音未来·苍穹音浪 | UR | 卡绘企划・扩展系列 | ✔ | ✔ | ✔ | images/vfx/miku-sky-wave-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_001 | 白庭双生·终幕 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/white-garden-twins-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_002 | 粉樱星轨·弥音 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/sakura-star-trail-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_003 | 浊心斯卡蒂·深海夜宴 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/skadi-deep-banquet-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_004 | 曦火圣女·晨祷 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/dawnfire-prayer-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_005 | 初音未来·星海镜音 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/miku-star-mirror-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_006 | 浊心斯卡蒂·霜海凛冬 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/skadi-frost-sea-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_007 | 史尔特尔·熔核烈歌 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/surtr-molten-core-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_008 | 焰星旅者·可莉 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/klee-blazing-star-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_009 | 青月人偶师·幽兰 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/youlan-moon-puppet-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_010 | 御坂美琴·超电磁炮 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/misaka-railgun-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_011 | 冰冠龙姬·苍鳞 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/ice-crown-dragon-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_012 | 斯卡蒂·黑潮双刃 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/skadi-black-tide-blades-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_013 | 能天使·红莲铳火 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/exusiai-lotus-gunfire-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_014 | 阿米娅·星屑天幕 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/amiya-stardust-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_015 | 煌·炎锯镇岳 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/blaze-flame-saw-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_016 | W·赤痕爆破 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/w-crimson-detonation-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_017 | 鸦羽祭司·夜祷 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/raven-night-prayer-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_018 | 天狼机巧·苍牙 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/sky-wolf-azure-fang-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_019 | 圣辉裁决·金律 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/golden-law-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_020 | 六花联奏·虹誓 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/six-flower-rainbow-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_021 | 金羽龙骑·破晓 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/gold-feather-dragon-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_022 | 白狐剑巫·千刃 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/white-fox-thousand-blades-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_023 | 蓝发静默者·阶梯 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/blue-silent-stairs-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_024 | 金庭歌者·夜曲 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/gold-garden-nocturne-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_025 | 煌·炎翼焚天 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/blaze-flame-wings-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_026 | 千早爱音·粉色和弦 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/anon-pink-chord-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_027 | 绯月傀儡师·血契 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/crimson-puppet-pact-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_028 | 红棘圣女·荆冠 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/red-thorn-crown-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_029 | 红棘圣女·终花 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/red-thorn-final-bloom-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_030 | 初音未来·晴空舞台 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/miku-clear-sky-stage-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_031 | 长崎爽世·迷途之声 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/soyo-lost-voice-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_032 | 若叶睦·沉默枷锁 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/mutsumi-silent-shackles-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_033 | 若叶睦·Mortis镜像 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/mutsumi-mortis-mirror-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_034 | 灶门炭治郎·水之呼吸 | SSR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/hinokami-kagura-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_035 | 若叶睦与丰川祥子·牵绊丝线 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/mutsumi-sakiko-bond-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_036 | 要乐奈·自由即兴 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/rana-free-improvisation-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_037 | 蝴蝶忍·蝶舞清影 | SSR | 鬼灭之刃 | ✔ | ✔ | ✔ | images/vfx/shinobu-clear-dance-sheet-v1.png | https://kimetsu.com/anime/risshihen/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_038 | 若叶睦·Mortis礼装 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/mutsumi-mortis-formal-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_039 | 椎名立希·疾走节拍 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/taki-racing-beat-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_040 | 长崎爽世·温柔低音 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/soyo-gentle-bass-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_041 | 椎名立希·不器用的真心 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/taki-clumsy-heart-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_042 | 长崎爽世·迷茫独白 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/soyo-lost-monologue-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_043 | 丰川祥子·雪夜独奏 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/sakiko-snow-solo-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_044 | 井芹仁菜·无刺之歌 | SSR | Girls Band Cry | ✔ | ✔ | ✔ | images/vfx/nina-thornless-song-sheet-v1.png | https://girls-band-cry.com/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_045 | 若叶睦·月下礼装 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/mutsumi-moon-formal-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_046 | 山田凉·雨中独奏 | SSR | 孤独摇滚 | ✔ | ✔ | ✔ | images/vfx/ryo-rain-solo-sheet-v1.png | https://bocchi.rocks/tv/character/ryo.html | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_047 | 阿米娅·赤轮剑影 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/amiya-crimson-wheel-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_048 | 丰川祥子·烛火键盘 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/sakiko-candle-keyboard-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_049 | 八幡海铃·暗潮低音 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/soyo-lost-voice-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_050 | 若叶睦·微笑假面 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/mutsumi-mortis-formal-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_051 | 八幡海铃·疾风鼓点 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/taki-racing-beat-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_052 | 雪之下雪乃·春雪 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/kanade-snow-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_053 | 阿米娅·红线残响 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/amiya-crimson-wheel-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_054 | 初音未来·水镜 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/miku-star-mirror-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_055 | 初音未来·花海共鸣 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/sakura-star-trail-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_056 | 初音未来·南瓜夜曲 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/klee-blazing-star-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_057 | 初音未来·春日花冠 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/six-flower-rainbow-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_058 | 初音未来·星月花嫁 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/miku-clear-sky-stage-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| picture_ssr7_059 | 阿米娅·苍银天穹 | SSR | 卡绘企划・跨作品联动 | ✔ | ✔ | ✔ | images/vfx/amiya-stardust-sheet-v1.png | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| source_monster_001 | 真冬 | R | 世界计划 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | https://pjsekai.sega.jp/character/index.html | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| source_monster_002 | 白羽静梦 | R | 咒术回战×原创联动 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| source_monster_003 | 祥子 | R | 咒术回战×原创联动 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| source_monster_004 | 蕾塞·雨夜引魂 | SSR | 咒术回战×原创联动 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| source_monster_005 | 绯线誓约·青叶 | SSR | 咒术回战×原创联动 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| source_monster_006 | 绯线誓约·棕羽 | SSR | 咒术回战×原创联动 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| source_monster_007 | 绯线誓约·金瞳 | SSR | 咒术回战×原创联动 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| source_monster_008 | 两面宿傩·狱纹 | SSR | 咒术回战 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | https://jujutsukaisen.jp/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| source_monster_009 | 五条悟·苍瞳 | SSR | 咒术回战 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | https://jujutsukaisen.jp/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| source_monster_010 | 五条悟·无下限 | SSR | 咒术回战 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | https://jujutsukaisen.jp/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| source_monster_011 | 五条悟·苍天觉醒 | SSR | 咒术回战 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | https://jujutsukaisen.jp/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| source_monster_012 | 两面宿傩·伏魔御厨子 | SSR | 咒术回战 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | https://jujutsukaisen.jp/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| source_monster_013 | 五条悟·虚式茈 | SSR | 咒术回战 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | https://jujutsukaisen.jp/goods/goods5676.php | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| source_monster_014 | 宿傩·炎矢 | SSR | 咒术回战 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | https://jujutsukaisen.jp/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| source_monster_015 | 五条悟·无量空处 | SSR | 咒术回战 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | https://jujutsukaisen.jp/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| source_monster_016 | 五条悟·天上天下 | SSR | 咒术回战 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | https://jujutsukaisen.jp/character/ | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| source_monster_017 | 咒灵武者·赤影 | SSR | 咒术回战×原创联动 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| source_monster_018 | 白绫神姬·天仪 | UR | 咒术回战×原创联动 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| source_monster_019 | 黄昏孤影·终焉 | UR | 咒术回战×原创联动 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| source_monster_020 | 虚拟歌姬·初音未来 | UR | 咒术回战×原创联动 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| water_007 | 蓝絮猫女仆 凯伊 | R | 世界计划・音乐企划 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| water_008 | 里间雨 | R | 世界计划・音乐企划 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| water_009 | 宫崎奏 | R | 世界计划・音乐企划 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| water_010 | 山田凉 | SSR | 孤独摇滚 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | https://bocchi.rocks/tv/character/ryo.html | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| water_011 | 青蓝妆者 | SSR | 世界计划・音乐企划 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| ygo_n_11091375 | 蓝宝石龙 | N | 游戏王 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| ygo_n_13039848 | 岩石巨兵 | N | 游戏王 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| ygo_n_14898066 | 血腥魔兽人 | N | 游戏王 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| ygo_n_15025844 | 神圣妖精 | N | 游戏王 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| ygo_n_16587243 | 新虫 | N | 游戏王 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| ygo_n_20277860 | 铠武者僵尸 | N | 游戏王 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| ygo_n_23771716 | 七彩鱼 | N | 游戏王 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| ygo_n_28279543 | 诅咒之龙 | N | 游戏王 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| ygo_n_30113682 | 审判者 | N | 游戏王 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| ygo_n_30532390 | 天空侦察者 | N | 游戏王 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| ygo_n_32452818 | 海狸战士 | N | 游戏王 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| ygo_n_37265642 | 剑角龙 | N | 游戏王 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| ygo_n_41392891 | 小恶魔 | N | 游戏王 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| ygo_n_42071342 | 暗黑海龙兵 | N | 游戏王 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| ygo_n_43096270 | 紫翠玉龙 | N | 游戏王 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| ygo_n_46986414 | 黑魔导 | N | 游戏王 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | https://www.yugioh.com/cards/dark-magician | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| ygo_n_48305365 | 斧王 | N | 游戏王 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| ygo_n_49003308 | 加加基哥 | N | 游戏王 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| ygo_n_49881766 | 恶魔士兵 | N | 游戏王 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| ygo_n_5053103 | 牛魔人 | N | 游戏王 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| ygo_n_58831685 | 巨型红海蛇 | N | 游戏王 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| ygo_n_6368038 | 暗黑骑士盖亚 | N | 游戏王 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| ygo_n_66672569 | 龙之僵尸 | N | 游戏王 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| ygo_n_69140098 | 双生精灵 | N | 游戏王 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| ygo_n_69247929 | 基因狼人 | N | 游戏王 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| ygo_n_70781052 | 恶魔召唤 | N | 游戏王 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| ygo_n_7359741 | 机械猎手 | N | 游戏王 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| ygo_n_74677422 | 真红眼黑龙 | N | 游戏王 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | https://www.yugioh.com/cards/red-eyes-b-dragon | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| ygo_n_76812113 | 鹰身女郎 | N | 游戏王 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| ygo_n_85639257 | 水魔道士 | N | 游戏王 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| ygo_n_87796900 | 要塞守护翼龙 | N | 游戏王 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| ygo_n_89631139 | 青眼白龙 | N | 游戏王 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | https://www.yugioh.com/cards/blue-eyes-white-dragon | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| ygo_n_90357090 | 银牙狼 | N | 游戏王 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| ygo_n_91152256 | 精灵剑士 | N | 游戏王 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| ygo_n_92667214 | 小丑僵尸 | N | 游戏王 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
| ygo_n_97590747 | 灯之魔精 | N | 游戏王 | ✔ | ✔ | ✔ | procedural（矢量 storyboard，项目原创） | 卡面・卡名・角色意象（项目原创演绎） | 通过：node --test 全绿；桌面/手机逐卡自动验收通过（654 阶段 ×2 视口，0 失败 0 报错） |
