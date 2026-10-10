import { storyboardScene } from "./card-scene-language.js?v=18-trap-atlas";
import { YGO_STORYBOARDS } from "./storyboards/ygo.js?v=15";
import { SSR7_STORYBOARDS } from "./storyboards/ssr7.js?v=15";
import { EXTENSION_STORYBOARDS } from "./storyboards/extension.js?v=15";
import { NIGHTCORD_STORYBOARDS } from "./storyboards/nightcord.js?v=15";
import { GALLERY_STORYBOARDS } from "./storyboards/gallery.js?v=15";
import { SOURCE_MONSTERS, SOURCE_SPELLS, SOURCE_TRAPS } from "./storyboards/source.js?v=15";

export const CARD_STORYBOARDS = {};
// Prefixes are explicit ID namespaces, not a runtime card classifier.
for (const [prefix, text] of [
    ["",YGO_STORYBOARDS], ["picture_ssr7_",SSR7_STORYBOARDS],
    ["picture_ex_",EXTENSION_STORYBOARDS], ["",NIGHTCORD_STORYBOARDS],
    ["gallery_spell_",GALLERY_STORYBOARDS], ["source_monster_",SOURCE_MONSTERS],
    ["source_spell_",SOURCE_SPELLS], ["source_trap_",SOURCE_TRAPS],
]) {
    for(const row of text.trim().split("\n")) {
        const [suffix, title, cues, attackTitle, attackCues, destroyTitle, destroyCues] = row.split("|");
        const id=prefix+suffix;
        if(CARD_STORYBOARDS[id]) throw new Error(`Duplicate storyboard ID: ${id}`);
        const monster=Boolean(attackTitle);
        CARD_STORYBOARDS[id]={
            basis:"card-art-adaptation",
            note:"依据卡面、卡名和角色意象独立编排；舞台与日常角色采用意象演出，卡面同人形态不视为原作战斗设定。",
            [monster?"summon":"activate"]:storyboardScene(title,cues,monster?"summon":"activate"),
            ...(monster?{attack:storyboardScene(attackTitle,attackCues,"attack")} : {}),
            ...(monster&&destroyTitle?{destroy:storyboardScene(destroyTitle,destroyCues,"destroy")} : {}),
        };
    }
}

// Provenance is separate from animation selection. These pages establish character
// identities/roles; they do not certify the fan-art outfits or invented camera shots.
const references = [
    ["https://jojo-portal.com/anime/sc/character/01/", ["picture_ex_011"]],
    ["https://jojo-portal.com/anime/gw/character/03/", ["picture_ex_014"]],
    ["https://kimetsu.com/anime/risshihen/character/", [
        ...Array.from({length:23},(_,i)=>`picture_ex_${String(i+19).padStart(3,"0")}`),
        ...[43,45,46,47,48,49,50,51,52,53,54,57,58,59,60,61,62,63,64,66,67,69,70].map(i=>`picture_ex_${String(i).padStart(3,"0")}`),
        "picture_ssr7_034","picture_ssr7_037",
    ]],
    ["https://jujutsukaisen.jp/character/",Array.from({length:9},(_,i)=>`source_monster_${String(i+8).padStart(3,"0")}`)],
    ["https://jujutsukaisen.jp/goods/goods5676.php",["source_monster_013"]],
    ["https://bocchi.rocks/tv/character/ryo.html",["water_010","picture_ssr7_046"]],
    ["https://girls-band-cry.com/character/",["picture_ssr7_044",...[92,93,94,95,96,98].map(i=>`picture_ex_${String(i).padStart(3,"0")}`)]],
    ["https://girls-band-cry.com/character/rupa/",["picture_ex_092","picture_ex_096"]],
    ["https://pjsekai.sega.jp/character/index.html",["dark_006","source_monster_001",...[80,85,86,87,89,100,101].map(i=>`picture_ex_${String(i).padStart(3,"0")}`)]],
];
for(const [source, ids] of references) for(const id of ids) {
    if(!CARD_STORYBOARDS[id])throw new Error(`Unknown provenance card: ${id}`);
    CARD_STORYBOARDS[id].source=source;
    CARD_STORYBOARDS[id].basis="character-identity-adaptation";
    CARD_STORYBOARDS[id].note="角色身份／意象参考官方资料；分镜、服装形态和决斗表现为游戏化演绎，不是原作逐帧复刻。";
}
