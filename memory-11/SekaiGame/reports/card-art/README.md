# 卡图评分与稀有度重分配

当前状态：已按用户要求撤销全部审美评级与效果重分配。运行卡池和后端数据均恢复 baseline.json。下方评分资料仅为历史审计，不参与游戏。

使用原始卡图；模型在本地 CPU 推理。模型及依赖放在工作区 `.tools`，没有进入前端包。

分类独立评分（v2）：角色卡 = 动漫模型 × 0.5 + 通用模型 × 0.3 + 技术可读性 × 0.2；魔法卡 = 通用模型 × 0.8 + 技术可读性 × 0.2；陷阱卡 = 通用模型 × 0.85 + 技术可读性 × 0.15。
魔法卡和陷阱卡不采用动漫人物模型分数。它们的技术项只采用尺寸和边缘细节，保留暗部、阴影和强光表现，不按曝光截断扣分。现有模型没有经过本项目的分类型人工偏好训练，因此这些是分类评分策略，不应宣称能准确测量氛围、构图或视觉张力。
固定门槛：N <4，R ≥4，SR ≥5，SSR ≥6，UR ≥7。没有百分位、排名或数量配额。
技术可读性由原图短边分辨率、256px 灰度图 Laplacian 方差及极端曝光像素占比计算；它不检测水印、构图或人体错误。审美评分仍带模型偏好。

模型来源：
- https://github.com/CoffeeVampir3/easy-aesthetic-predictor
- https://huggingface.co/Blackroot/Anime-Aesthetic-Predictor-Medium
- https://github.com/LAION-AI/aesthetic-predictor
- CLIP ViT-B-32 OpenAI 权重，使用匹配的 QuickGELU 架构。

`scores.json` 保存逐模型分、综合分、原图哈希、模型哈希和推理版本。
`baseline.json` 是变更前卡池快照，请保留用于审计。
`changes.csv`、`review.html` 是完整前后对比。
`review.html` 分角色、魔法、陷阱三个章节；`category-ratings.json` 保存三类独立评分结果与策略。

运行顺序（在 SekaiGame 目录）：

```powershell
& '..\.tools\aesthetic-venv\Scripts\python.exe' scripts/score-card-art.py --model '..\.tools\aesthetic-models\anime-main.pth' --input reports/card-art/baseline.json --output reports/card-art/scores.json
& '..\.tools\aesthetic-venv\Scripts\python.exe' scripts/score-card-art-general.py --head '..\.tools\aesthetic-models\laion-b32.pth' --cache '..\.tools\aesthetic-models\clip'
node scripts/apply-art-ratings.mjs
```

新卡加入后，将新卡原始记录追加至评分输入，再重新运行。同分门槛不随卡池人数变化。
生成器保存评级配置后，由 catalog 在规则生成之前应用稀有度：现有逐卡技能主题保留，数值预算、登场代价、辅助技能和卡面文字按现有规则重新计算。手工校准的策略卡保留其组合、代价与反制。游戏王入门系列保留基础数值与原有效果，收藏稀有度独立重评。
生成器把最终运行卡池写回 full-card-pool.json，Spring Boot 启动时同步数据库卡牌记录。卡牌 ID、玩家收藏数量、卡组内容与抽卡概率未迁移。
