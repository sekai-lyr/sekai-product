import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = path.resolve(import.meta.dirname, "..");
const signaturePath = path.resolve(projectRoot, "src/main/resources/card-data/ygo-starter-signatures.json");
const jsPath = path.resolve(projectRoot, "src/main/resources/static/js/ygo-starter.js");
const jsonPath = path.resolve(projectRoot, "src/main/resources/card-data/ygo-starter.json");

const signatures = JSON.parse(fs.readFileSync(signaturePath, "utf8"));
const { YGO_STARTER_CARDS } = await import(`${pathToFileURL(jsPath).href}?v=${Date.now()}`);

const missing = YGO_STARTER_CARDS.filter(card => card.type === "monster" && !signatures[card.id]);
if (missing.length) throw new Error(`缺少招牌效果：${missing.map(card => card.name).join("、")}`);
for (const id of Object.keys(signatures)) {
    const card = YGO_STARTER_CARDS.find(item => item.id === id);
    if (!card) throw new Error(`签名引用了不存在的卡：${id}`);
    if (signatures[id].length !== 1) throw new Error(`每张入门卡必须只有1个招牌效果：${id}`);
}

const next = YGO_STARTER_CARDS.map(card => {
    const effects = signatures[card.id];
    if (!effects) return card;
    return {
        ...card,
        description: effects.map(effect => effect.description).join("\n"),
        effectsJson: JSON.stringify(effects),
        effects,
    };
});

fs.writeFileSync(jsPath, `export const YGO_STARTER_CARDS = ${JSON.stringify(next, null, 2)};\n`, "utf8");

const rawPool = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const nextPool = rawPool.map(card => {
    const effects = signatures[card.id];
    if (!effects) return card;
    return { ...card, description: effects.map(effect => effect.description).join("\n"), effectsJson: JSON.stringify(effects) };
});
fs.writeFileSync(jsonPath, JSON.stringify(nextPool, null, 2), "utf8");

console.log(`入门卡招牌效果已写入：${Object.keys(signatures).length} 张卡，合计 ${YGO_STARTER_CARDS.length} 张入门卡。`);
