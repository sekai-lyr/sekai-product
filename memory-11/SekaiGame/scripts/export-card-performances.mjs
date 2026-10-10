import { writeFile } from "node:fs/promises";
import { CARD_PERFORMANCES, performanceGeometry } from "../src/main/resources/static/js/card-performance.js";

const signatures = new Set(CARD_PERFORMANCES.map(performanceGeometry));
if (signatures.size !== CARD_PERFORMANCES.length) throw new Error("存在完全重复的图形与编排组合");
const rows = CARD_PERFORMANCES.map(p => {
    const event = phase => p.type === "monster" || phase === "summon" ? `${p[phase].title}：${p[phase].beats.join(" → ")}` : "不适用（非怪兽卡）";
    return `|${p.id}|${p.name.replaceAll("|", "／")}|${p.rarity}|${event("summon")}|${event("attack")}|${event("tribute")}|${p.motif} / ${p.accent}；${p.choreography.lanes}轨；开角${p.choreography.sweep}；弯曲${p.choreography.bend}；间隔${p.choreography.stagger}ms；${p.choreography.reverse ? "逆序" : "顺序"}|${p.source ? `[官方身份依据](${p.source})；演出为改编` : "项目主题演绎，原著待核验"}|`;
});
const head = `# 逐卡演出清单\n\n共 ${CARD_PERFORMANCES.length} 张。由 export-card-performances.mjs 从运行时配置生成。\n\n图形与编排组合经过唯一性校验，但共用图形组件；不是368套独立制作的影视动画，也不代表已逐张核验原著。官方链接仅支持角色身份/能力主题，祭品仪式和分镜为游戏化设计。魔法/陷阱仅播放发动演出，不获得攻击或祭品能力。\n\n现有卡池没有 fusionSummon 卡；祭品汇聚已接入对局，真正融合卡组玩法尚未开放。\n\n|ID|卡牌|稀有度|登场／发动|攻击|祭品汇聚|图形与编排|考据状态|\n|---|---|---|---|---|---|---|---|\n`;
await writeFile(new URL("../../docs/card-performances-2026-10-01.md", import.meta.url), head + rows.join("\n") + "\n");
await writeFile(new URL("../../docs/card-performances-2026-10-01.json", import.meta.url), JSON.stringify(CARD_PERFORMANCES, null, 2) + "\n");
console.log(`${CARD_PERFORMANCES.length} card performance profiles exported; ${signatures.size} distinct geometry/choreography combinations.`);
