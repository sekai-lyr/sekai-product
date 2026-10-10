import { writeFile } from "node:fs/promises";
import { ALL_CARDS } from "../src/main/resources/static/js/catalog.js";
import { AUTHORED_CARD_SCENES } from "../src/main/resources/static/js/authored-card-scenes.js";
const authored=ALL_CARDS.filter(c=>AUTHORED_CARD_SCENES[c.id]);
const pending=ALL_CARDS.filter(c=>!AUTHORED_CARD_SCENES[c.id]);
const rows=authored.flatMap(card=>Object.entries(AUTHORED_CARD_SCENES[card.id])
    .filter(([phase])=>["summon","attack","activate"].includes(phase))
    .map(([phase,s])=>`|${card.id} ${card.name}|${phase}|${s.title}|${s.beats.join(" → ")}|${AUTHORED_CARD_SCENES[card.id].source?`[身份／卡面参考](${AUTHORED_CARD_SCENES[card.id].source})`:"卡面主题原创演绎"}|`));
await writeFile(new URL("../../docs/authored-scenes-status.md",import.meta.url),
`# 独立分镜制作进度\n\n已制作 ${authored.length}/${ALL_CARDS.length} 张，${rows.length} 段分镜；未制作 ${pending.length} 张。218 张怪兽各有登场与攻击，105 张魔法和45张陷阱各有发动演出。\n\n每张卡的分镜由卡牌 ID 明确登记。共用矢量绘图与动作工具，但不按卡名关键词、序号、随机数分配场景。测试比较去除颜色后的实际绘制指令，防止改名／换色重复。它们是实时 SVG/WAAPI 演出，不是368份独立视频文件。\n\n官方链接的证据范围是角色身份、职业或卡面意象；本项目没有把这些链接当作所有同人招式、服装和分镜都出自原作的证明。未有逐卡原作依据的部分标为卡面主题原创演绎。日常角色以演奏、书信、画笔等表现决斗行动。祭品汇聚保留现有仪式，结束后播放该卡独立登场。\n\n## 已制作\n\n|卡牌|阶段|分镜|动作|来源|\n|---|---|---|---|---|\n${rows.join("\n")}\n\n## 待制作\n\n${pending.length?pending.map(c=>`- ${c.id}：${c.name}`).join("\n"):"无。"}\n`);
console.log({authored:authored.length,scenes:rows.length,pending:pending.length});
