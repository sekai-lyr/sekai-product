/* Print an idempotent UTF-8 import for the Spring/MySQL card catalogue. */
import { ALL_CARDS } from "../js/catalog.js";

const quote = value => `'${String(value ?? "").replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
const integer = value => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 0;

console.log("SET NAMES utf8mb4;");
for (const card of ALL_CARDS) {
    const fields = [
        quote(card.id), quote(card.name), quote(card.series), quote(card.member), quote(card.type),
        quote(card.attribute || "none"), integer(card.level), integer(card.attack), integer(card.defense),
        quote(card.rarity), integer(card.cost), quote(JSON.stringify(card.effects)), quote(card.description),
        quote(card.image), card.enabled === false ? 0 : 1,
    ];
    console.log(`INSERT INTO sekai_card_cards (id,name,series,member,type,attribute,level,attack,defense,rarity,cost,effects_json,description,image,enabled,created_at,updated_at) VALUES (${fields.join(",")},NOW(),NOW()) ON DUPLICATE KEY UPDATE name=VALUES(name),series=VALUES(series),member=VALUES(member),type=VALUES(type),attribute=VALUES(attribute),level=VALUES(level),attack=VALUES(attack),defense=VALUES(defense),rarity=VALUES(rarity),cost=VALUES(cost),effects_json=VALUES(effects_json),description=VALUES(description),image=VALUES(image),enabled=VALUES(enabled),updated_at=NOW();`);
}
