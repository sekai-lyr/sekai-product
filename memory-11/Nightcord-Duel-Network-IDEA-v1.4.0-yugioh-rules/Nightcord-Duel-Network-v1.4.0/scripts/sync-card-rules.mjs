/*
 * Synchronize the playable catalogue without routing UTF-8 SQL through the
 * Windows console (which would turn Chinese card names into question marks).
 * Usage: MYSQL_PASSWORD=... node scripts/sync-card-rules.mjs
 */
import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { ALL_CARDS } from "../js/catalog.js";

const password = process.env.MYSQL_PASSWORD;
if (!password) throw new Error("MYSQL_PASSWORD is required");
const imageRoot = process.env.CARD_IMAGE_SOURCE || resolve(import.meta.dirname, "..", "..", "..", "pricture");
const quote = value => `'${String(value ?? "").replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
const integer = value => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 0;
const normalizeName = value => String(value || "").normalize("NFKC").replace(/[\s\-_.]/g, "").replace(/^八千/, "8千").toLowerCase();
async function imageNames(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const nested = await Promise.all(entries.map(entry => entry.isDirectory() ? imageNames(resolve(dir, entry.name)) : [entry.name]));
    return nested.flat();
}
const availableImages = new Set((await imageNames(imageRoot)).map(name => normalizeName(name.replace(/\.[^.]+$/, ""))));
const cards = ALL_CARDS.filter(card => availableImages.has(normalizeName(card.name)));
const validIds = cards.map(card => card.id);
if (cards.length !== ALL_CARDS.length) console.warn(`Skipped ${ALL_CARDS.length - cards.length} card(s) without an image in ${imageRoot}.`);
const lines = ["SET NAMES utf8mb4;"];
for (const card of cards) {
    const fields = [quote(card.id), quote(card.name), quote(card.series), quote(card.member), quote(card.type), quote(card.attribute || "none"), integer(card.level), integer(card.attack), integer(card.defense), quote(card.rarity), integer(card.cost), quote(JSON.stringify(card.effects)), quote(card.description), quote(card.image), card.enabled === false ? 0 : 1];
    lines.push(`INSERT INTO sekai_card_cards (id,name,series,member,type,attribute,level,attack,defense,rarity,cost,effects_json,description,image,enabled,created_at,updated_at) VALUES (${fields.join(",")},NOW(),NOW()) ON DUPLICATE KEY UPDATE name=VALUES(name),series=VALUES(series),member=VALUES(member),type=VALUES(type),attribute=VALUES(attribute),level=VALUES(level),attack=VALUES(attack),defense=VALUES(defense),rarity=VALUES(rarity),cost=VALUES(cost),effects_json=VALUES(effects_json),description=VALUES(description),image=VALUES(image),enabled=VALUES(enabled),updated_at=NOW();`);
}
// Keep the database, collections, and deck entries inside the same whitelist.
const ids = validIds.map(quote).join(",") || "''";
lines.push(`DELETE FROM sekai_card_deck_cards WHERE card_id NOT IN (${ids});`);
lines.push(`DELETE FROM sekai_card_user_cards WHERE card_id NOT IN (${ids});`);
lines.push(`DELETE FROM sekai_card_cards WHERE id NOT IN (${ids});`);

const child = spawn("mysql", ["--default-character-set=utf8mb4", "-h", "localhost", "-u", "root", `-p${password}`, "sekai_friend"], { stdio: ["pipe", "inherit", "inherit"] });
child.stdin.end(lines.join("\n"));
await new Promise((resolve, reject) => child.once("exit", code => code === 0 ? resolve() : reject(new Error(`mysql exited with ${code}`))));
console.log(`Synchronized ${cards.length} whitelist-approved playable cards.`);
