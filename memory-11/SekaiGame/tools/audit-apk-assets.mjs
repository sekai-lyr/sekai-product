// 权威校验：直接加载运行时模块读取 VFX_CARD_PROFILES，检查每一条登记的图集
// 在 APK 的 vfx-mobile 目录里都有对应 webp（缺一张，那张卡在手机上就是空白演出）。
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const GAME = "D:/Sekai_two/memory-11/SekaiGame";
const WWW = path.join(GAME, "android-app/app/src/main/assets/www");
const MOBILE = path.join(WWW, "images/vfx-mobile");

const { VFX_CARD_PROFILES } = await import(pathToFileURL(path.join(WWW, "js/authored-card-scenes.js")).href);
const { ALL_CARDS } = await import(pathToFileURL(path.join(WWW, "js/catalog.js")).href);

const profiles = Object.values(VFX_CARD_PROFILES);
const sheets = new Set(profiles.map(p => p.sheet));
const missing = [...sheets].filter(s => !existsSync(path.join(MOBILE, s.replace(/\.png$/, ".webp"))));
const onDisk = new Set(readdirSync(MOBILE));
const orphan = [...onDisk].filter(f => f.endsWith(".webp") && !sheets.has(f.replace(/\.webp$/, ".png")));
const traps = ALL_CARDS.filter(c => c.type === "trap");
const trapsWithoutProfile = traps.filter(c => !VFX_CARD_PROFILES[c.id]).map(c => c.id);
const trapsWithoutWebp = traps
    .filter(c => VFX_CARD_PROFILES[c.id])
    .filter(c => !existsSync(path.join(MOBILE, VFX_CARD_PROFILES[c.id].sheet.replace(/\.png$/, ".webp"))))
    .map(c => c.id);

console.log(JSON.stringify({
    registeredProfiles: profiles.length,
    uniqueSheets: sheets.size,
    vfxMobileFiles: onDisk.size,
    missingWebp: missing.length,
    missingSample: missing.slice(0, 10),
    orphanWebp: orphan.length,
    trapsInCatalog: traps.length,
    trapsWithoutProfile,
    trapsWithoutWebp,
}, null, 2));
if (missing.length || trapsWithoutProfile.length || trapsWithoutWebp.length) process.exitCode = 1;
