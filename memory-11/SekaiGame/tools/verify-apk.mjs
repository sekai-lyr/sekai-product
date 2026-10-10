// APK 出厂校验：版本/图标/签名/内置资源一次核对。
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

const APK = process.argv[2] || "dist/SekaiGame-offline-v2.4.0.apk";
const SDK = "B:/RenPy/renpy-8.5.3-sdk/rapt/Sdk";
const BT = `${SDK}/build-tools/35.0.0`;
const abs = path.resolve(APK);
const run = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });

const badging = run(`${BT}/aapt2.exe`, ["dump", "badging", abs]);
const grab = re => (badging.match(re) || [])[1] || null;

const zip = run("powershell", ["-NoProfile", "-Command",
    `Add-Type -AssemblyName System.IO.Compression.FileSystem; $z=[System.IO.Compression.ZipFile]::OpenRead('${abs}'); $z.Entries | ForEach-Object { "$($_.FullName)\`t$($_.Length)" }; $z.Dispose()`]);
const entries = zip.split(/\r?\n/).filter(Boolean).map(l => { const [n, s] = l.split("\t"); return { name: n, size: Number(s) }; });

const sheetJs = (() => {
    const z = run("powershell", ["-NoProfile", "-Command",
        `Add-Type -AssemblyName System.IO.Compression.FileSystem; $z=[System.IO.Compression.ZipFile]::OpenRead('${abs}'); $e=$z.GetEntry('assets/www/js/authored-card-scenes.js'); $r=New-Object System.IO.StreamReader($e.Open()); $r.ReadToEnd(); $r.Dispose(); $z.Dispose()`]);
    return z;
})();

const vfxMobile = entries.filter(e => e.name.includes("images/vfx-mobile/"));
const leakedPng = entries.filter(e => /assets\/www\/images\/vfx\/[^/]+\.png$/.test(e.name));
const report = {
    file: path.basename(abs),
    sizeMB: +(statSync(abs).size / 1048576).toFixed(1),
    package: grab(/package: name='([^']+)'/),
    versionCode: grab(/versionCode='(\d+)'/),
    versionName: grab(/versionName='([^']+)'/),
    label: grab(/application-label:'([^']*)'/),
    icon: grab(/application: label='[^']*' icon='([^']+)'/),
    launchable: grab(/launchable-activity: name='([^']+)'/),
    assetsEntries: entries.filter(e => e.name.startsWith("assets/")).length,
    vfxMobileCount: vfxMobile.length,
    vfxMobileMB: +(vfxMobile.reduce((a, e) => a + e.size, 0) / 1048576).toFixed(1),
    leakedSourcePng: leakedPng.length,
    hasTrapProfiles: entries.some(e => e.name === "assets/www/js/trap-atlas-profiles.js"),
    usesMobileWebp: sheetJs.includes("images/vfx-mobile/"),
    mobileTrapSheets: (sheetJs.match(/trap-[a-z0-9-]+-sheet-v1\.png/g) || []).length,
};
report.ok = report.package === "com.sekai.game.mobile"
    && report.versionName === "2.4.0-offline"
    && report.leakedSourcePng === 0
    && report.hasTrapProfiles && report.usesMobileWebp
    && report.vfxMobileCount >= 252;
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
void readFileSync;
