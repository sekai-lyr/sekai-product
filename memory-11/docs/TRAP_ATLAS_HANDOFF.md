# 陷阱卡 4×4 独立图集：制作与交接说明

本文件说明「陷阱卡独立制作」这一批次的产出、管线与续作方式。适用于 2026-10-05 之后接手的人。

## 这一批做了什么

45 张可玩陷阱卡（`cards.json` 中 `type === "trap"`）此前只有「卡图电影 + cue 矢量分镜」，
没有像怪兽/魔法那样属于自己的 4×4 逐帧图集。本批次为**每一张**陷阱卡补齐：

1. 一套独立的 **1536×1536 RGBA 图集**（4 列 × 4 行 = 16 帧，单格 384×384）。
2. 一条独立的 `VFX_CARD_PROFILES` 登记（`ranges/size/rotate/mask/glow`），素材不与他人共用。
3. 一层与图集同几何的**矢量结界**（`TRAP_WARDS`），保证 DOM 层与逐帧素材说的是同一种语言。
4. 独立的 `activate` 分镜（沿用既有的逐卡 storyboard，图集叠加在其上并与矢量结界对齐）。

完成矩阵见 `docs/TRAP_ATLAS_MATRIX.md`（由脚本生成，不允许出现未完成行）。

## 目录与职责

```text
.tools/vfx/trap-atlas/
  core.mjs                 绘制核心：环带/纹样/内印/粒子/光束/地面 + 16 帧调度
  landmarks-ygo.mjs        游戏王 12 张（物件与术式语言）
  landmarks-nightcord.mjs  Nightcord 5 张（校园日常光景）
  specs-ygo.mjs            YGO 12 张规格
  specs-nightcord.mjs      Nightcord 5 张规格
  specs-source-a.mjs       source_trap_023-036（结界 SR）规格 + 地标 painter
  specs-source-b.mjs       source_trap_037-050（结界 SSR）规格 + 地标 painter
  specs.mjs                45 张总表 + 完整性自检
  render.mjs               渲染 + 逐帧 alpha/网格验收（playwright）
  preview.mjs              深色战场 + 运行时遮罩下的可读性预览
  measure.mjs              图集/截图亮度采样（判断"到底有多亮"）
  emit-registration.mjs    生成运行时登记模块
.tools/vfx/build-trap-matrix.mjs        生成 docs/TRAP_ATLAS_MATRIX.md
.tools/rules-qa/trap-atlas-scenes.mjs   双端演出验收（桌面 1365×768 / 手机 390×844）
```

运行时产物：

- `SekaiGame/src/main/resources/static/images/vfx/trap-*-sheet-v1.png`（45 张）
- `SekaiGame/src/main/resources/static/js/trap-atlas-profiles.js`（**生成物，不要手改**）

## 图集规范（不得违反）

- 4 列 × 4 行共 16 帧，播放顺序**从左到右、从上到下**，`background-size: 400% 400%`。
- 帧序语义：`0–4` 起势蓄力 / `5–9` 结界展开 / `10–13` 封印命中 / `14–15` 收束消散。
- **中心必须留空**：卡面在中心，图集把半径 `0.245 × 单格` 以内挖成真透明。
  注意这不是靠运行时遮罩擦掉，而是像素级真透明（`destination-out`），
  所以即使遮罩失效也不会挡住卡面。
- **四角与边中点为全透明**：不允许把底线、棋盘格或色块烘进图片。
- 规格里的半径写在 `0.15–0.43` 的「设计带」内，`R()` 会统一搬到 `0.245–0.45` 的实际环带。
- 地标必须完整落在单元格内：`LANDMARK_R()` 把落点收到 `0.295–0.355`，
  `LANDMARK_SCALE = 0.87`。**不要把地标放大或往外推**，否则顶部/底部的鸟居、山峰会被切掉
  （这在早期版本真实发生过）。
- 每张卡至少独立定义：配色 4 色、环带 style 组合、放射纹样、内印、场景地标、粒子语言、旋转方向。

## 重新生成

```powershell
cd D:\Sekai_two\memory-11
node .tools/vfx/trap-atlas/render.mjs                     # 渲染全部 45 张并逐张验收
node .tools/vfx/trap-atlas/render.mjs --only nc_tr_001    # 只重渲染指定卡
node .tools/vfx/trap-atlas/render.mjs --check             # 不重绘，只校验已有产物
node .tools/vfx/trap-atlas/emit-registration.mjs          # 生成运行时登记模块
node .tools/vfx/build-trap-matrix.mjs                     # 生成完成矩阵
node .tools/vfx/trap-atlas/preview.mjs grid 9             # 可读性预览总览
```

改了 `core.mjs` 或任何 `specs-*.mjs` 之后，**必须**重跑 `render.mjs` 与 `emit-registration.mjs`。
登记模块里的 `TRAP_ATLAS_MASK` 是生成时写死的，只改 `core.mjs` 不会生效（这一点也真实踩过）。

## 验收

```powershell
cd D:\Sekai_two\memory-11\SekaiGame\src\main\resources\static
node --test test/trap-atlas.test.js     # 逐像素 alpha、4×4 网格、串卡、分镜唯一性
node --test test/*.test.js              # 全量前端测试
cd D:\Sekai_two\memory-11
node .tools/rules-qa/trap-atlas-scenes.mjs   # 双端演出验收 + 中间帧截图
```

`trap-atlas-scenes.mjs` 会把 `performance.now` 与 `requestAnimationFrame` 的时间戳一起冻住再截图。
**只暂停 WAAPI 是不够的**：图集帧号由 rAF 推进，只暂停动画只能拍到第一帧或最后一帧。

## Android APK（离线 WebView 壳）

APK 在 `SekaiGame/android-app/`，是一个 WebView 壳，通过 `appassets.androidplatform.net`
加载 `app/src/main/assets/www/index.html`（见 `MainActivity.java`）。

**`www` 不是 `static` 的纯拷贝**，它带三处移动端专属改动，任何同步都必须保留：

| 文件 | 移动端专属内容 |
| --- | --- |
| `www/index.html` | 额外引入 `css/mobile-perf.css` |
| `www/js/main.js` | 离线模式逻辑（`appassets.androidplatform.net` 免登录白名单等） |
| `www/js/authored-card-scenes.js` | 图集路径为 `images/vfx-mobile/<sheet>.webp`（不是 `/images/vfx/*.png`） |

同步与构建：

```powershell
cd D:\Sekai_two\memory-11\SekaiGame
node tools\sync-apk-www.mjs            # 同步 www + 校验移动端专属改动仍在（--check 只校验）
python tools\build-mobile-vfx.py       # 生成/补齐 images/vfx-mobile 的 webp
node tools\audit-apk-assets.mjs        # 校验每条图集登记都有对应 webp（权威：直接加载模块）
node tools\qa-apk-www.mjs              # 以 390×844 跑通内置副本，逐张确认 webp 可解码
powershell -NoProfile -File tools\build-apk.ps1 -Version 2.4.0
node tools\verify-apk.mjs              # 出厂校验：版本/图标/资源/是否误打包源 PNG
```

关键约束（都踩过）：

- **源 PNG 不打包**。`www/images/vfx` 有约 500MB 的 PNG，移动端只加载 `vfx-mobile` 的 webp。
  直接 `gradlew assembleRelease` 会把这些 PNG 一起打进 APK（历史上有 567MB 的产物就是这么来的）。
  `build-apk.ps1` 会在构建期间把该目录临时移出、构建后还原。
- **签名沿用 `android-app/build/apk-direct/sekai-debug.keystore`**（alias `sekai`，口令 `android`，
  证书 SHA-256 `b34d906e…`），与已发布版本同钥，可直接覆盖安装。
- **`res/` 下的启动图标与 `values/colors.xml` 必须存在**，否则应用没有图标。
  这两个曾被丢失过，现已从 v2.3.0 产物中取回（自适应图标底色 `#ffd7cebe`）。
- `tools/build-apk.ps1` 全为 ASCII 输出：本机是 Windows PowerShell 5.1，读无 BOM 的 UTF-8
  脚本会按 ANSI 解码，中文会变成乱码甚至破坏语法。
- build-tools 的 `.bat` 会把 JDK 警告写到 stderr，PowerShell 5.1 会把它当致命错误；
  脚本已改为经 `cmd /c … 2>nul` 调用，并且**不要**用 `Select-Object -First` 截断原生命令的管道
  （会提前杀掉进程、把 `$LASTEXITCODE` 变成 -1）。

当前产物：`SekaiGame/dist/SekaiGame-offline-v2.4.0.apk`（101.2 MB，versionCode 6）。
其中 `vfx-mobile` 252 张 webp 共 63.8 MB；本批次新增的 45 张陷阱图集占 15.1 MB。
v2.3.0 是 75.7 MB——差异除本批次的 15.1 MB 外，还来自磁盘上那 207 张旧 webp
（48.6 MB）本就比 v2.3.0 打包时的体积（39.6 MB）更大，属既有漂移，不是本批次引入。
想压体积可调 `tools/build-mobile-vfx.py` 的 `MAX_EDGE` / `QUALITY` 后加 `--all` 重转。

## 已知边界

- 图集是**程序化矢量绘制**后由真实浏览器 canvas 光栅化的，不是 AI 生图；
  每张卡的辨识度来自「场景地标 + 内印 + 环带语法 + 配色 + 粒子语言」的组合，而不是照片级插画。
- 地标尺寸受单元格约束（外侧只剩约 52px），主地标约占单格 26%。
  想再放大就必须同时改 `LANDMARK_R` 与 `LANDMARK_SCALE`，并重跑 `render.mjs --check` 看是否被裁。
- 陷阱卡发动时仍会播放既有的「整屏卡图电影」层（既有设计）。
  图集节点已被提到该层之上（仅对 `trap`/`spell` 阶段），保证 4×4 演出可见；
  矢量层与标题仍在图集之上。
- 陷阱格为 100×130px，图集显示尺寸取 `72 × size`（`size` 由稀有度决定：N/R 4.0、SR 4.2、SSR/UR 4.4），
  在手机上还会被 `innerWidth × 0.64` 收边。
