import { ALL_CARDS } from "../js/catalog.js";
import { VFX_CARD_PROFILES, DEDICATED_PROCEDURAL_SPELLS } from "../js/authored-card-scenes.js";

const byType = {};
for (const c of ALL_CARDS) {
    byType[c.type] = byType[c.type] || { total: 0, prof: 0, proc: 0, none: [] };
    byType[c.type].total++;
    if (VFX_CARD_PROFILES[c.id]) byType[c.type].prof++;
    else if (DEDICATED_PROCEDURAL_SPELLS[c.id]) byType[c.type].proc++;
    else byType[c.type].none.push(c.id);
}
for (const [type, s] of Object.entries(byType)) {
    console.log(`== ${type}: total=${s.total} sheet=${s.prof} procedural=${s.proc} none=${s.none.length}`);
    if (s.none.length) console.log("none: " + s.none.join(", "));
}
const sheets = new Set(Object.values(VFX_CARD_PROFILES).map(p => p.sheet));
console.log("unique sheets used by cards:", sheets.size);
