# 陷阱卡独立图集完成矩阵

生成时间基准：2026-10-05。陷阱卡总数 **45**，每张卡一套独立的 4×4（16 帧）透明 RGBA 图集。

## 规格

- 网格：4 列 × 4 行 = 16 帧，播放顺序从左到右、从上到下（`background-size:400% 400%`）。
- 单格 384×384，整图 1536×1536，RGBA（colorType 6），中心与四角为真透明。
- 帧序：0–4 起势蓄力 / 5–9 结界展开 / 10–13 封印命中 / 14–15 收束消散。
- 图集把卡面所在区域挖成空洞，运行时遮罩只做外缘羽化，结界永远只环绕卡牌。
- 每张卡独立定义：配色、环带语法、放射纹样、内印、场景地标、粒子语言、旋转方向与规模。

## 汇总

- 独立图集素材：**45** 张（`SekaiGame/src/main/resources/static/images/vfx/`）。
- 独立登记：**45** 条 `VFX_CARD_PROFILES`，与怪兽/魔法卡无任何 sheet 复用。
- 每张卡同时具备与图集同几何的矢量结界层（`TRAP_WARDS`）与独立的 `activate` 分镜。
- 生成入口：`.tools/vfx/trap-atlas/render.mjs`；登记生成：`.tools/vfx/trap-atlas/emit-registration.mjs`。
- 验收：`node --test test/trap-atlas.test.js`（逐像素 alpha、网格、串卡、分镜唯一性）。

## 逐卡清单

| ID | 卡名 | 稀有度 | 系列 | 图集 | 素材文件 | 环带语法 | 内印 | 场景地标 | 粒子语言 | 矢量结界 | 验证状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| nc_tr_001 | 暮雨长街的独行 | UR | 世界计划・音乐企划 | ✔ | images/vfx/trap-dusk-rain-street-sheet-v1.png | 3 环 · 虚线环 | 方封印 | 3 处 · rainyStreet | 雨线+泡影 | ✔（112/90/65） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| nc_tr_002 | 寒岭汤泉的憩息 | UR | 世界计划・音乐企划 | ✔ | images/vfx/trap-hot-spring-rest-sheet-v1.png | 3 环 · 编绳环 | 莲华印 | 3 处 · hotSpring | 雾霭+雪晶 | ✔（112/88/66） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| nc_tr_003 | 澄湖栈桥的余晖 | UR | 世界计划・音乐企划 | ✔ | images/vfx/trap-lake-pier-glow-sheet-v1.png | 3 环 · 刻痕环 | 月门印 | 3 处 · lakePier | 水纹+火星 | ✔（112/90/65） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| nc_tr_004 | 夏空校舍的流云 | UR | 世界计划・音乐企划 | ✔ | images/vfx/trap-summer-school-cloud-sheet-v1.png | 3 环 · 虚线环 | 方封印 | 3 处 · summerSchool | 雾霭+花瓣 | ✔（112/88/65） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| nc_tr_005 | 星降神篱的祈愿 | UR | 世界计划・音乐企划 | ✔ | images/vfx/trap-star-shrine-vow-sheet-v1.png | 3 环 · 珠链环 | 八芒星印 | 3 处 · starShrine | 星芒+萤火 | ✔（112/88/67） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| source_trap_023 | 翡翠峰嶺の雲霧結界 | SR | 咒术回战×原创联动・结界档案 | ✔ | images/vfx/trap-jade-mist-ward-sheet-v1.png | 3 环 · 实线环 | 方封印 | 3 处 · jadeRidgeCloud | 雾霭+火星 | ✔（112/90/66） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| source_trap_024 | 富士桜花の結界 | SR | 咒术回战×原创联动・结界档案 | ✔ | images/vfx/trap-fuji-sakura-ward-sheet-v1.png | 3 环 · 虚线环 | 莲华印 | 3 处 · fujiSakura | 花瓣+蝶翼 | ✔（111/88/67） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| source_trap_025 | 花燈橋の夜桜結界 | SR | 咒术回战×原创联动・结界档案 | ✔ | images/vfx/trap-lantern-bridge-ward-sheet-v1.png | 3 环 · 珠链环 | 锁链印 | 3 处 · lanternBridge | 灯笼+花瓣 | ✔（112/90/64） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| source_trap_026 | 花園涼亭の星夜結界 | SR | 咒术回战×原创联动・结界档案 | ✔ | images/vfx/trap-garden-pavilion-star-ward-sheet-v1.png | 3 环 · 编绳环 | 八芒星印 | 3 处 · gardenPavilion | 星芒+萤火 | ✔（112/89/65） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| source_trap_027 | 神社参道の花灯結界 | SR | 咒术回战×原创联动・结界档案 | ✔ | images/vfx/trap-shrine-approach-ward-sheet-v1.png | 3 环 · 分段弧 | 鸟居印 | 3 处 · shrineSandou | 符纸+硬币 | ✔（112/89/66） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| source_trap_028 | 水鏡湖畔の桜花結界 | SR | 咒术回战×原创联动・结界档案 | ✔ | images/vfx/trap-mirror-lake-sakura-ward-sheet-v1.png | 3 环 · 排线环 | 镜面印 | 3 处 · mirrorLakeSakura | 花瓣+水纹 | ✔（111/88/65） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| source_trap_029 | 索道黄昏の都市結界 | SR | 咒术回战×原创联动・结界档案 | ✔ | images/vfx/trap-ropeway-dusk-ward-sheet-v1.png | 3 环 · 齿轮环 | 齿轮印 | 3 处 · ropewayDuskCity | 火星+硬币 | ✔（112/90/67） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| source_trap_030 | 夕映雪嶺の紅葉結界 | SR | 咒术回战×原创联动・结界档案 | ✔ | images/vfx/trap-snow-ridge-maple-ward-sheet-v1.png | 3 环 · 分段弧 | 圣杯印 | 3 处 · snowRidgeMaple | 落叶+雪晶 | ✔（112/89/66） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| source_trap_031 | 雪林曙光の結界 | SR | 咒术回战×原创联动・结界档案 | ✔ | images/vfx/trap-snow-cedar-dawn-ward-sheet-v1.png | 3 环 · 虚线环 | 增援矢印 | 3 处 · snowCedarDawn | 雪晶+火星 | ✔（111/88/65） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| source_trap_032 | 雪嶺白嶽の凍結結界 | SR | 咒术回战×原创联动・结界档案 | ✔ | images/vfx/trap-white-peak-freeze-ward-sheet-v1.png | 3 环 · 珠链环 | 双筒印 | 3 处 · whitePeakIce | 冰晶+碎晶 | ✔（112/89/66） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| source_trap_033 | 夜桜涼亭の花吹雪結界 | SR | 咒术回战×原创联动・结界档案 | ✔ | images/vfx/trap-night-sakura-snow-ward-sheet-v1.png | 3 环 · 编绳环 | 钳击印 | 3 处 · nightSakuraPavilion | 花瓣+雪晶 | ✔（112/88/64） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| source_trap_034 | 夜桜神籠の灯火結界 | SR | 咒术回战×原创联动・结界档案 | ✔ | images/vfx/trap-night-sakura-lamp-ward-sheet-v1.png | 3 环 · 齿轮环 | 封壶印 | 3 处 · sakuraKagoLamp | 萤火+灯笼 | ✔（111/88/66） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| source_trap_035 | 桜花結界の春霞神殿 | SR | 咒术回战×原创联动・结界档案 | ✔ | images/vfx/trap-spring-haze-temple-ward-sheet-v1.png | 3 环 · 刻痕环 | 城垛印 | 3 处 · springHazeTemple | 花瓣+雾霭 | ✔（112/89/65） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| source_trap_036 | 月光水鏡の幽玄結界 | SR | 咒术回战×原创联动・结界档案 | ✔ | images/vfx/trap-moonlight-water-ward-sheet-v1.png | 3 环 · 实线环 | 月门印 | 3 处 · moonMirrorWater | 泡影+水纹 | ✔（112/89/67） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| source_trap_037 | 百体地蔵的净罪之光 | SSR | 咒术回战×原创联动・结界档案 | ✔ | images/vfx/trap-jizo-purge-sheet-v1.png | 3 环 · 实线环 | 莲华印 | 3 处 · jizoStatues | 符纸+萤火 | ✔（112/90/66） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| source_trap_038 | 本町通尽头的灵峰 | SSR | 咒术回战×原创联动・结界档案 | ✔ | images/vfx/trap-street-peak-sheet-v1.png | 3 环 · 齿轮环 | 增援矢印 | 3 处 · streetPeak | 落叶+雾霭 | ✔（112/88/65） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| source_trap_039 | 翠林水车的清流结界 | SSR | 咒术回战×原创联动・结界档案 | ✔ | images/vfx/trap-waterwheel-stream-sheet-v1.png | 3 环 · 编绳环 | 齿轮印 | 3 处 · waterwheelStream | 泡影+水纹 | ✔（112/88/66） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| source_trap_040 | 稻荷神域的千本鸟居 | SSR | 咒术回战×原创联动・结界档案 | ✔ | images/vfx/trap-senbon-torii-sheet-v1.png | 3 环 · 分段弧 | 鸟居印 | 3 处 · toriiTunnel | 花瓣+火屑 | ✔（112/88/67） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| source_trap_041 | 富士灵峰的湖畔守望 | SSR | 咒术回战×原创联动・结界档案 | ✔ | images/vfx/trap-fuji-lakeside-sheet-v1.png | 3 环 · 虚线环 | 镜面印 | 3 处 · fujiLakeside | 雪晶+雾霭 | ✔（112/90/65） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| source_trap_042 | 古都暗影的五重封印 | SSR | 咒术回战×原创联动・结界档案 | ✔ | images/vfx/trap-five-pagoda-seal-sheet-v1.png | 3 环 · 齿轮环 | 方封印 | 3 处 · pagodaFivefold | 墨点+碎晶 | ✔（112/88/68） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| source_trap_043 | 古都塔影的黄昏小路 | SSR | 咒术回战×原创联动・结界档案 | ✔ | images/vfx/trap-pagoda-dusk-lane-sheet-v1.png | 3 环 · 编绳环 | 碎阵印 | 3 处 · pagodaDuskLane | 硬币+星芒 | ✔（112/88/66） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| source_trap_044 | 古寺五重的黄昏钟声 | SSR | 咒术回战×原创联动・结界档案 | ✔ | images/vfx/trap-temple-bell-sheet-v1.png | 3 环 · 珠链环 | 梵钟印 | 3 处 · templeBellTower | 电弧+火星 | ✔（112/88/66） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| source_trap_045 | 海中鸟居的神域结界 | SSR | 咒术回战×原创联动・结界档案 | ✔ | images/vfx/trap-sea-torii-sheet-v1.png | 3 环 · 实线环 | 六芒星印 | 3 处 · seaTorii | 水纹+雾霭 | ✔（112/88/67） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| source_trap_046 | 水田镜天的云映结界 | SSR | 咒术回战×原创联动・结界档案 | ✔ | images/vfx/trap-paddy-mirror-sky-sheet-v1.png | 3 环 · 虚线环 | 月门印 | 3 处 · paddyMirrorSky | 水纹+羽片 | ✔（112/88/66） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| source_trap_047 | 雪灵峰下的驿站 | SSR | 咒术回战×原创联动・结界档案 | ✔ | images/vfx/trap-snow-post-station-sheet-v1.png | 3 环 · 刻痕环 | 休战旗印 | 3 处 · snowPostStation | 雪晶+冰晶 | ✔（112/88/66） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| source_trap_048 | 岩间清瀑的结界之水 | SSR | 咒术回战×原创联动・结界档案 | ✔ | images/vfx/trap-rockfall-basin-sheet-v1.png | 3 环 · 编绳环 | 圣杯印 | 3 处 · rockfallBasin | 水纹+碎晶 | ✔（112/90/66） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| source_trap_049 | 夜樱灯笼的幽冥引路 | SSR | 咒术回战×原创联动・结界档案 | ✔ | images/vfx/trap-night-sakura-lantern-sheet-v1.png | 3 环 · 珠链环 | 双筒印 | 3 处 · nightSakuraLanterns | 灯笼+萤火 | ✔（112/88/66） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| source_trap_050 | 樱花光隙的幻惑结界 | SSR | 咒术回战×原创联动・结界档案 | ✔ | images/vfx/trap-sakura-light-gap-sheet-v1.png | 3 环 · 分段弧 | 八芒星印 | 3 处 · sakuraLightGap | 花瓣+蝶翼 | ✔（112/88/66） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| ygo_n_12607053 | 和睦的使者 | N | 游戏王（起始卡组） | ✔ | images/vfx/trap-waboku-sheet-v1.png | 3 环 · 编绳环 | 方封印 | 3 处 · wabokuMist | 雾霭+花瓣 | ✔（109/86/64） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| ygo_n_17814387 | 援军 | N | 游戏王（起始卡组） | ✔ | images/vfx/trap-reinforcements-sheet-v1.png | 3 环 · 分段弧 | 增援矢印 | 3 处 · reinforceArrow | 火星+硬币 | ✔（112/88/66） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| ygo_n_24068492 | 停战协定 | N | 游戏王（起始卡组） | ✔ | images/vfx/trap-ceasefire-sheet-v1.png | 3 环 · 刻痕环 | 休战旗印 | 3 处 · ceasefireBanner | 星芒+羽片 | ✔（112/90/67） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| ygo_n_4206964 | 落穴 | N | 游戏王（起始卡组） | ✔ | images/vfx/trap-pitfall-sheet-v1.png | 3 环 · 分段弧 | 齿轮印 | 3 处 · pitMaw | 碎晶+火星 | ✔（107/78/65） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| ygo_n_44095762 | 神圣防护罩－反射镜力－ | N | 游戏王（起始卡组） | ✔ | images/vfx/trap-mirror-force-sheet-v1.png | 3 环 · 珠链环 | 镜面印 | 3 处 · mirrorShield | 火星+碎晶 | ✔（112/91/68） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| ygo_n_44209392 | 城壁 | N | 游戏王（起始卡组） | ✔ | images/vfx/trap-castle-walls-sheet-v1.png | 3 环 · 齿轮环 | 城垛印 | 3 处 · castleWall | 碎晶+火星 | ✔（112/87/68） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| ygo_n_50045299 | 龙族封印之壶 | N | 游戏王（起始卡组） | ✔ | images/vfx/trap-dragon-capture-jar-sheet-v1.png | 3 环 · 珠链环 | 封龙壶印 | 3 处 · dragonJar | 锁链+泡影 | ✔（112/88/68） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| ygo_n_77414722 | 魔法干扰阵 | N | 游戏王（起始卡组） | ✔ | images/vfx/trap-magic-jammer-sheet-v1.png | 3 环 · 分段弧 | 碎阵印 | 3 处 · jammerSigil | 碎晶+电弧 | ✔（112/87/68） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| ygo_n_77622396 | 反转陷阱 | N | 游戏王（起始卡组） | ✔ | images/vfx/trap-reverse-trap-sheet-v1.png | 3 环 · 排线环 | 逆沙漏印 | 3 处 · reverseGear | 碎晶+火星 | ✔（109/86/68） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| ygo_n_80604091 | 血之代偿 | N | 游戏王（起始卡组） | ✔ | images/vfx/trap-blood-compensation-sheet-v1.png | 3 环 · 珠链环 | 圣杯印 | 3 处 · bloodVial | 火屑+火星 | ✔（109/86/67） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| ygo_n_83887306 | 夹击 | N | 游戏王（起始卡组） | ✔ | images/vfx/trap-pincer-attack-sheet-v1.png | 3 环 · 分段弧 | 钳击印 | 3 处 · pincerBlades | 火星+碎晶 | ✔（112/83/68） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
| ygo_n_96355986 | 魔法筒枪 | N | 游戏王（起始卡组） | ✔ | images/vfx/trap-magic-cylinder-sheet-v1.png | 3 环 · 编绳环 | 双筒印 | 3 处 · magicCylinder | 萤火+火星 | ✔（112/87/68） | 通过：素材/登记/分镜齐备，alpha 与网格自动验收见 test/trap-atlas.test.js |
