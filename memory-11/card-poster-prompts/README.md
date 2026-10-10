# SEKAI ARCHIVE — 卡牌视觉档案海报系统

把 `SekaiGameGodot/data/cards.json` 里的 **368 张卡**，每张做成一张 16:9 横幅
「实验性动漫角色编辑画报 / 视觉档案」海报。**已全部产出，无需任何 API。**

## 两条产出路线

| 路线 | 脚本 | 是否需要 API | 状态 |
|---|---|---|---|
| **A. 程序化排版（已采用）** | `render_posters.py` | **不需要**，全程离线 | ✅ 368/368 已产出 |
| B. AI 出图 | `generate_posters.py` | 需要图像 API key | 备用，提示词已就绪 |

路线 A 用 PIL/numpy 直接把版面画出来，并且**复用项目里已有的 368 张卡面原图**
（`SekaiGame/src/main/resources/static/assets/cards/`）作为人物底版 —— 角色识别性
来自真实原图，解构设计来自程序。文字由字体渲染，**结构上不可能出现乱码**。

## 这个系统要解决的问题

368 张图如果各自设计，会变成 368 张互不相干的图。
所以这里反过来做：**一套完全一致的艺术指导底盘 + 每张卡各自推导出的变量**。
底盘保证它们是一套系统，变量保证每张卡只属于它自己。

底盘固定不变：页边距、双线框、刻度尺、比例尺、档案数据块、标题字级、纸纹颗粒。
每张卡变量：母题几何、人物裁切与错位、强调色、材质、左右构图、放大切片。

## 文件

| 文件 | 作用 |
|---|---|
| `render_posters.py` | **主产出脚本**：离线渲染 368 张海报（并发、断点续跑、确定性种子） |
| `build_prompts.py` | 从卡牌数据推导母题/配色/材质/文字，生成 368 条提示词（路线 B 用，也是设计推导的唯一规则源） |
| `manifest.json` | 368 条结构化记录，含每条最终提示词全文 |
| `prompts/<卡牌id>.txt` | 每张卡一条独立提示词 |
| `generate_posters.py` | 路线 B 批量出图器 |
| `export_jpeg.py` | 轻量版导出：缩放 + JPEG 重编码（网页/分享用） |
| `make_contact_sheet.py` | 生成 368 张总览图（一张图看完全部，按系列分组带卡名） |
| `00-总览-contact-sheet.jpg` | 总览图成品 |
| `out/` | 渲染输出（368 张 2560×1440 PNG，母版） |
| `out-jpg-1920/` | 轻量版输出（368 张 1920×1080 JPEG q93） |

## 每张卡的推导链

```
母题 motifs      : 项目视觉风格表(122张) → 卡名母题 → 效果文本母题 → 种族母题
识别特征 anchors : 卡名特征 → 种族特征（解构后仍需认得出的东西）
强调色 accent    : 属性 → 低饱和专色（光=淡金 / 暗=墨紫 / 水=灰青 / 火=砖朱 / 风=青瓷 / 地=赭石）
材质 material    : 种族优先，其次系列
文字版式         : 卡名 + 档案编号 + 等级行 + 数值行 + 系列行
构图方向 side    : 由卡牌 id 哈希决定左右，避免整批看起来像镜像复制
```

## 人物解构手法（全部程序化实现）

- **双色调印刷化**：原图压成 墨→纸 两色阶，拉低对比，去掉写实感。
- **亮度驱动融图**：用原图自身明度调制的 alpha，**亮部背景直接溶进纸面**，
  只留人物体量 —— 这是「人物与背景不是两个图层」的关键。
- **切片位移**：整幅切成 4–8 条横带，每条横向错位，人物被切裂而非摆放。
- **网格冲孔**：挖掉 2–5 个模块矩形，纸面从身体里透出来。
- **线稿与色块分离**：边缘提取成独立线稿图层，与色块**反向错位**叠加。
- **重复残影**：整版副本低透明度偏移几毫米。
- **放大切片**：面部/局部方形放大窗，配十字套准标记。
- **结构线穿透**：版式横线与竖线**画在人物之上**，网格穿过身体。
- **边缘裁切**：原图先内缩 5.5% —— 顺带裁掉原图自带的画师署名/水印。

三种卡型区别处理：**怪兽** = 解构人物；**魔法** = 仪式装置档案（人物溶解为残片）；
**陷阱** = 待发机构档案（大片平静场 + 一个触发记号）。

## 用法

```powershell
# 全量渲染（离线，约 3 分钟 / 6 并发；已存在的 PNG 自动跳过）
python render_posters.py --workers 6

# 指定输出目录
python render_posters.py --out 'D:\Sekai\_Picture\AI-generated' --workers 6

# 试点 / 筛选
python render_posters.py --only picture_ex_011 water_010 --out .\pilot
python render_posters.py --type trap --limit 10
python render_posters.py --force          # 全部重出

# 尺寸
python render_posters.py --width 1920 --height 1080
```

路线 B（需要图像 API key，二选一）：

```powershell
$env:OPENAI_API_KEY = "sk-..."      # --provider openai（默认 gpt-image-2）
$env:STABILITY_API_KEY = "sk-..."   # --provider stability
python generate_posters.py --workers 4 --quality high
```

## 产出

`D:\Sekai\_Picture\AI-generated\`

```
AI-generated\
├── <卡牌id>.png              368 张 2560×1440 母版 (1.11 GB)
└── 1920x1080-jpg\
    └── <卡牌id>.jpg          368 张 1920×1080 q93 (181 MB, 约 503 KB/张)
```

两套文件名都是卡牌 id，可直接与 `manifest.json` 对照。

### 导出轻量版

```powershell
python export_jpeg.py                                    # 1920×1080 q93（默认）
python export_jpeg.py --long-edge 1280 --quality 90 --out .\out-jpg-1280
python export_jpeg.py --long-edge 0                      # 保持 2560×1440，仅重编码
```

## 版权提示

`starter_ygo`（游戏王起始卡组）、`picture` / `picture_ssr7` / `source_archive` /
`nightcord` 中的角色与作品名属于既有 IP（游戏王、JOJO、鬼灭之刃、火影、咒术回战、
Fate、Project Sekai、孤独摇滚、明日方舟等）。当前产出沿用项目原有卡面素材，
仅供个人使用；正式发布前需替换版权素材（项目 `README.md` 已注明）。
