// Independently directed scenes. Shared drawing tools are not card-selection heuristics.
// Sources establish the card/art identity; these timelines are original game adaptations.
import { CARD_STORYBOARDS } from "./card-storyboards.js?v=18-trap-atlas";
import { TRAP_ATLAS_MASK, TRAP_ATLAS_PROFILES, TRAP_WARDS } from "./trap-atlas-profiles.js?v=3";
const official = slug => `https://www.yugioh.com/cards/${slug}`;
const scene = (title, beats, draw) => ({ title, beats, draw });
const wing = "M0 0 Q-30-65-125-95 L-88-22 -67-46 -43 0 -24-22Z";
const staff = "M0 65V-24 M0-24C-35-65 35-65 0-24 M-12-35H12";
const ankh = "M0-5C-45-35-25-75 0-75C25-75 45-35 0-5V65 M-36 12H36";
const KIMETSU_SOURCE = "https://kimetsu.com/anime/risshihen/character/";
const NARUTO_SOURCE = "https://naruto-official.com/";
const breathingScenes = (school, summonName, attackName, destroyName, color, timings=[900,980,800], source=KIMETSU_SOURCE) => ({
    ...(source ? { source } : {}),
    summon:scene(`${school}·${summonName}`,["呼吸纹理沿卡框聚合","标志性刀路展开","力量收束完成落位"],f=>{f.wash("#071016",0,700,.38);f.fireDance(f.from,f.from,0,timings[0],"summon");f.title(school,summonName,color,130,700)}),
    attack:Object.assign(scene(`${school}·${attackName}`,["刀路锁定目标","招式轨迹高速推进","核心斩击在目标边缘闭合"],f=>{f.wash("#060d13",0,800,.28);f.fireDance(f.from,f.to,0,timings[1],"attack");f.title(school,attackName,color,150,720)}),{cues:[{symbol:"sword",motion:"cast"}]}),
    destroy:scene(destroyName,["招式轮廓失去锋芒","残留刀路向内回卷","最后一道呼吸光贴卡消散"],f=>{f.wash("#060b11",0,640,.24);f.fireDance(f.from,f.from,0,timings[2],"destroy");f.title(destroyName,"呼吸暂歇",color,90,600)}),
});
const VFX_GROUPS = {
    sanemi:["picture_ex_026","picture_ex_031","picture_ex_040","picture_ex_058"], muichiro:["picture_ex_028","picture_ex_036","picture_ex_049","picture_ex_066"],
    mitsuri:["picture_ex_022","picture_ex_038","picture_ex_045","picture_ex_064"], tengen:["picture_ex_032","picture_ex_039","picture_ex_047","picture_ex_067"],
    gyomei:["picture_ex_023","picture_ex_041","picture_ex_052","picture_ex_061"], obanai:["picture_ex_020","picture_ex_034","picture_ex_053","picture_ex_069"], akaza:["picture_ex_042","picture_ex_056"],
    doma:["picture_ex_055"], kokushibo:["picture_ex_068"], yoriichi:["picture_ex_044","picture_ex_065"],
    giyu:["picture_ex_033","picture_ex_043","picture_ex_062"], rengoku:["picture_ex_035","picture_ex_050","picture_ex_054","picture_ex_063"],
    shinobu:["picture_ex_037","picture_ex_046","picture_ex_057"], zenitsu:["picture_ex_048","picture_ex_070"], inosuke:["picture_ex_051","picture_ex_059"],
    hyuga:["picture_ex_073"], itachi:["picture_ex_074"], pain:["picture_ex_075"], tobirama:["picture_ex_076"], sasuke:["picture_ex_077"], kakashi:["picture_ex_078"],
    tsunade:["picture_ex_079"], subaru:["picture_ex_072"], mafuyu:["picture_ex_080"],
    jotaro:["picture_ex_011"], kira:["picture_ex_012"], diego:["picture_ex_013"], mista:["picture_ex_014"],
    lucy:["picture_ex_015"], hotpants:["picture_ex_016"], scary:["picture_ex_017"], valentine:["picture_ex_018"],
};
const VFX_SHEETS = {sanemi:"sanemi-wind-sheet-v1.png",muichiro:"muichiro-mist-sheet-v1.png",mitsuri:"mitsuri-love-sheet-v1.png",tengen:"tengen-sound-sheet-v1.png",gyomei:"gyomei-stone-sheet-v1.png",obanai:"obanai-serpent-sheet-v1.png",akaza:"akaza-compass-sheet-v1.png",doma:"doma-ice-lotus-sheet-v1.png",kokushibo:"kokushibo-moon-sheet-v1.png",yoriichi:"yoriichi-sun-sheet-v1.png",hyuga:"hyuga-rotation-sheet-v1.png",itachi:"itachi-susanoo-sheet-v1.png",pain:"pain-almighty-push-sheet-v1.png",tobirama:"tobirama-water-sheet-v1.png",sasuke:"sasuke-susanoo-sheet-v1.png",kakashi:"kakashi-raikiri-sheet-v1.png",tsunade:"tsunade-strength-sheet-v1.png",subaru:"subaru-return-sheet-v1.png",mafuyu:"mafuyu-rain-shot-sheet-v1.png",jotaro:"star-platinum-barrage-sheet-v1.png",kira:"killer-queen-bomb-sheet-v1.png",diego:"world-time-stop-sheet-v1.png",mista:"mista-ricochet-sheet-v1.png",lucy:"lucy-steel-rose-sheet-v1.png",hotpants:"hot-pants-cream-sheet-v1.png",scary:"scary-monsters-sheet-v1.png",valentine:"love-train-sheet-v1.png",nezuko:"nezuko-exploding-blood-sheet-v1.png",zenitsu:"zenitsu-thunder-sheet-v1.png",inosuke:"inosuke-beast-sheet-v1.png",giyu:"giyu-water-sheet-v1.png",rengoku:"rengoku-flame-tiger-sheet-v1.png",shinobu:"shinobu-insect-sheet-v1.png",tanjiro:"hinokami-kagura-sheet-v1.png"};
const VFX_GLOWS = {sanemi:"#a8f1c4",muichiro:"#bfeeff",mitsuri:"#ff78b6",tengen:"#ff8fae",gyomei:"#d9a45d",obanai:"#c9b7ff",akaza:"#42bfff",doma:"#dff7ff",kokushibo:"#b758d2",yoriichi:"#ff5a1f",hyuga:"#d9d2ff",itachi:"#ff283d",pain:"#b074ff",tobirama:"#61d8ff",sasuke:"#8d5cff",kakashi:"#43bfff",tsunade:"#6dffa0",subaru:"#9b4dca",mafuyu:"#71cfff",jotaro:"#a779ff",kira:"#ff4daf",diego:"#ffd05e",mista:"#ffb33f",lucy:"#ffd27a",hotpants:"#ffb1bf",scary:"#a8e949",valentine:"#ffd05a",nezuko:"#ff296d",zenitsu:"#ffe34d",inosuke:"#a9d9e8",giyu:"#4fcfff",rengoku:"#ff7a24",shinobu:"#c87cff",tanjiro:"#ff4b16"};
Object.assign(VFX_GROUPS,{minato:["picture_ex_081"],kaguya:["picture_ex_082"],yachiyo:["picture_ex_083"],iroha:["picture_ex_084"],mafuyuSilent:["picture_ex_085"],kanade:["picture_ex_086"],ena:["picture_ex_087"],sakiko:["picture_ex_088"],mizuki:["picture_ex_089"],yoshiko:["picture_ex_090"],mutsumi:["picture_ex_091"]});
Object.assign(VFX_SHEETS,{minato:"minato-golden-flash-sheet-v1.png",kaguya:"kaguya-orange-stage-sheet-v1.png",yachiyo:"yachiyo-jellyfish-sheet-v1.png",iroha:"iroha-celadon-sheet-v1.png",mafuyuSilent:"mafuyu-silent-sheet-v1.png",kanade:"kanade-snow-sheet-v1.png",ena:"ena-paint-sheet-v1.png",sakiko:"sakiko-blue-rose-sheet-v1.png",mizuki:"mizuki-pink-heart-sheet-v1.png",yoshiko:"yoshiko-fallen-angel-sheet-v1.png",mutsumi:"mutsumi-ink-sheet-v1.png"});
Object.assign(VFX_GLOWS,{minato:"#ffd54f",kaguya:"#ffad66",yachiyo:"#8ddcff",iroha:"#91c9ad",mafuyuSilent:"#aabfff",kanade:"#d9f4ff",ena:"#e63b65",sakiko:"#315cff",mizuki:"#ff80bd",yoshiko:"#a85cff",mutsumi:"#91a579"});
Object.assign(VFX_GROUPS,{rupaLeaf:["picture_ex_092"],tomo:["picture_ex_093"],nina:["picture_ex_094"],momoka:["picture_ex_095"],rupaSky:["picture_ex_096"]});
Object.assign(VFX_SHEETS,{rupaLeaf:"rupa-golden-leaf-sheet-v1.png",tomo:"tomo-crimson-string-sheet-v1.png",nina:"nina-blue-sky-sheet-v1.png",momoka:"momoka-sea-breeze-sheet-v1.png",rupaSky:"rupa-falling-sky-sheet-v1.png"});
Object.assign(VFX_GLOWS,{rupaLeaf:"#ffc94f",tomo:"#ff303f",nina:"#61cfff",momoka:"#54d6dd",rupaSky:"#ffad35"});
Object.assign(VFX_GROUPS,{mutsumiSketch:["picture_ex_097"],subaruDeep:["picture_ex_098"],misaki:["picture_ex_099"],mizukiBeat:["picture_ex_100"],mikuDeep:["picture_ex_101"]});
Object.assign(VFX_SHEETS,{mutsumiSketch:"mutsumi-sketch-sheet-v1.png",subaruDeep:"subaru-deep-blue-sheet-v1.png",misaki:"misaki-warm-window-sheet-v1.png",mizukiBeat:"mizuki-colorful-beat-sheet-v1.png",mikuDeep:"miku-deep-sea-sheet-v1.png"});
Object.assign(VFX_GLOWS,{mutsumiSketch:"#b7aa91",subaruDeep:"#438bd5",misaki:"#ffbd73",mizukiBeat:"#ff65bc",mikuDeep:"#28e6e0"});
Object.assign(VFX_GROUPS,{shadowAtomic:["picture_ex_102"],shadowAuthority:["picture_ex_103"],saberAlterBlade:["picture_ex_104"],saberAlterPrison:["picture_ex_105"],artoriaTwilight:["picture_ex_106"]});
Object.assign(VFX_SHEETS,{shadowAtomic:"shadow-atomic-sheet-v1.png",shadowAuthority:"shadow-authority-sheet-v1.png",saberAlterBlade:"saber-alter-blood-blade-sheet-v1.png",saberAlterPrison:"saber-alter-crimson-prison-sheet-v1.png",artoriaTwilight:"artoria-twilight-sheet-v1.png"});
Object.assign(VFX_GLOWS,{shadowAtomic:"#8d4cff",shadowAuthority:"#7a37d9",saberAlterBlade:"#f01835",saberAlterPrison:"#ff2446",artoriaTwilight:"#ffd36a"});
Object.assign(VFX_GROUPS,{mikuSky:["picture_ex_107"]});
Object.assign(VFX_SHEETS,{mikuSky:"miku-sky-wave-sheet-v1.png"});
Object.assign(VFX_GLOWS,{mikuSky:"#62eaff"});
Object.assign(VFX_GROUPS,{whiteTwins:["picture_ssr7_001"],sakuraStar:["picture_ssr7_002"],skadiBanquet:["picture_ssr7_003"],dawnSaint:["picture_ssr7_004"],mikuMirror:["picture_ssr7_005"]});
Object.assign(VFX_SHEETS,{whiteTwins:"white-garden-twins-sheet-v1.png",sakuraStar:"sakura-star-trail-sheet-v1.png",skadiBanquet:"skadi-deep-banquet-sheet-v1.png",dawnSaint:"dawnfire-prayer-sheet-v1.png",mikuMirror:"miku-star-mirror-sheet-v1.png"});
Object.assign(VFX_GLOWS,{whiteTwins:"#f3d9a5",sakuraStar:"#ff91bd",skadiBanquet:"#1ab7bd",dawnSaint:"#ffd095",mikuMirror:"#5be8ed"});
Object.assign(VFX_GROUPS,{skadiWinter:["picture_ssr7_006"],surtr:["picture_ssr7_007"],klee:["picture_ssr7_008"],youlan:["picture_ssr7_009"],misaka:["picture_ssr7_010"]});
Object.assign(VFX_SHEETS,{skadiWinter:"skadi-frost-sea-sheet-v1.png",surtr:"surtr-molten-core-sheet-v1.png",klee:"klee-blazing-star-sheet-v1.png",youlan:"youlan-moon-puppet-sheet-v1.png",misaka:"misaka-railgun-sheet-v1.png"});
Object.assign(VFX_GLOWS,{skadiWinter:"#9fe9ff",surtr:"#ff571c",klee:"#ff8244",youlan:"#91b8ff",misaka:"#71b7ff"});
Object.assign(VFX_GROUPS,{iceDragon:["picture_ssr7_011"],skadiBlades:["picture_ssr7_012"],exusiai:["picture_ssr7_013"],amiyaStars:["picture_ssr7_014"],blazeSaw:["picture_ssr7_015"]});
Object.assign(VFX_SHEETS,{iceDragon:"ice-crown-dragon-sheet-v1.png",skadiBlades:"skadi-black-tide-blades-sheet-v1.png",exusiai:"exusiai-lotus-gunfire-sheet-v1.png",amiyaStars:"amiya-stardust-sheet-v1.png",blazeSaw:"blaze-flame-saw-sheet-v1.png"});
Object.assign(VFX_GLOWS,{iceDragon:"#8edcff",skadiBlades:"#21aeb1",exusiai:"#ff4b56",amiyaStars:"#9a8eff",blazeSaw:"#ff5b1f"});
Object.assign(VFX_GROUPS,{wBlast:["picture_ssr7_016"],ravenPriest:["picture_ssr7_017"],skyWolf:["picture_ssr7_018"],goldLaw:["picture_ssr7_019"],sixFlower:["picture_ssr7_020"]});
Object.assign(VFX_SHEETS,{wBlast:"w-crimson-detonation-sheet-v1.png",ravenPriest:"raven-night-prayer-sheet-v1.png",skyWolf:"sky-wolf-azure-fang-sheet-v1.png",goldLaw:"golden-law-sheet-v1.png",sixFlower:"six-flower-rainbow-sheet-v1.png"});
Object.assign(VFX_GLOWS,{wBlast:"#ff3348",ravenPriest:"#ac83ef",skyWolf:"#54d9ff",goldLaw:"#ffd57c",sixFlower:"#fff0c2"});
Object.assign(VFX_GROUPS,{goldDragon:["picture_ssr7_021"],foxSword:["picture_ssr7_022"],silentStairs:["picture_ssr7_023"],goldGarden:["picture_ssr7_024"],blazeWings:["picture_ssr7_025"]});
Object.assign(VFX_SHEETS,{goldDragon:"gold-feather-dragon-sheet-v1.png",foxSword:"white-fox-thousand-blades-sheet-v1.png",silentStairs:"blue-silent-stairs-sheet-v1.png",goldGarden:"gold-garden-nocturne-sheet-v1.png",blazeWings:"blaze-flame-wings-sheet-v1.png"});
Object.assign(VFX_GLOWS,{goldDragon:"#ffd36b",foxSword:"#b9dbff",silentStairs:"#4f8eea",goldGarden:"#ddb45d",blazeWings:"#ff5a1f"});
Object.assign(VFX_GROUPS,{anonChord:["picture_ssr7_026"],crimsonPuppet:["picture_ssr7_027"],thornCrown:["picture_ssr7_028"],thornBloom:["picture_ssr7_029"],mikuStage:["picture_ssr7_030"]});
Object.assign(VFX_SHEETS,{anonChord:"anon-pink-chord-sheet-v1.png",crimsonPuppet:"crimson-puppet-pact-sheet-v1.png",thornCrown:"red-thorn-crown-sheet-v1.png",thornBloom:"red-thorn-final-bloom-sheet-v1.png",mikuStage:"miku-clear-sky-stage-sheet-v1.png"});
Object.assign(VFX_GLOWS,{anonChord:"#ff78bd",crimsonPuppet:"#e72448",thornCrown:"#e85964",thornBloom:"#ff5360",mikuStage:"#76ebff"});
Object.assign(VFX_GROUPS,{soyoLost:["picture_ssr7_031"],mutsumiShackles:["picture_ssr7_032"]});
Object.assign(VFX_SHEETS,{soyoLost:"soyo-lost-voice-sheet-v1.png",mutsumiShackles:"mutsumi-silent-shackles-sheet-v1.png"});
Object.assign(VFX_GLOWS,{soyoLost:"#3cc9cf",mutsumiShackles:"#b2b870"});
Object.assign(VFX_GROUPS,{mutsumiMortis:["picture_ssr7_033"]});
Object.assign(VFX_SHEETS,{mutsumiMortis:"mutsumi-mortis-mirror-sheet-v1.png"});
Object.assign(VFX_GLOWS,{mutsumiMortis:"#a7eda4"});
Object.assign(VFX_GROUPS,{bondThreads:["picture_ssr7_035"],ranaImpro:["picture_ssr7_036"],shinobuClear:["picture_ssr7_037"]});
Object.assign(VFX_SHEETS,{bondThreads:"mutsumi-sakiko-bond-sheet-v1.png",ranaImpro:"rana-free-improvisation-sheet-v1.png",shinobuClear:"shinobu-clear-dance-sheet-v1.png"});
Object.assign(VFX_GLOWS,{bondThreads:"#819cff",ranaImpro:"#a7ff32",shinobuClear:"#d4a8ff"});
Object.assign(VFX_GROUPS,{mutsumiFormal:["picture_ssr7_038"]});
Object.assign(VFX_SHEETS,{mutsumiFormal:"mutsumi-mortis-formal-sheet-v1.png"});
Object.assign(VFX_GLOWS,{mutsumiFormal:"#c4efb7"});
Object.assign(VFX_GROUPS,{takiRace:["picture_ssr7_039"],soyoGentle:["picture_ssr7_040"],takiHeart:["picture_ssr7_041"]});
Object.assign(VFX_SHEETS,{takiRace:"taki-racing-beat-sheet-v1.png",soyoGentle:"soyo-gentle-bass-sheet-v1.png",takiHeart:"taki-clumsy-heart-sheet-v1.png"});
Object.assign(VFX_GLOWS,{takiRace:"#ff334c",soyoGentle:"#76d8c7",takiHeart:"#ff8c92"});
Object.assign(VFX_GROUPS,{soyoMonologue:["picture_ssr7_042"],sakikoSnow:["picture_ssr7_043"]});
Object.assign(VFX_SHEETS,{soyoMonologue:"soyo-lost-monologue-sheet-v1.png",sakikoSnow:"sakiko-snow-solo-sheet-v1.png"});
Object.assign(VFX_GLOWS,{soyoMonologue:"#3cd5dd",sakikoSnow:"#a8c9ff"});
Object.assign(VFX_GROUPS,{ninaThornless:["picture_ssr7_044"],mutsumiMoon:["picture_ssr7_045"],ryoRain:["picture_ssr7_046"]});
Object.assign(VFX_SHEETS,{ninaThornless:"nina-thornless-song-sheet-v1.png",mutsumiMoon:"mutsumi-moon-formal-sheet-v1.png",ryoRain:"ryo-rain-solo-sheet-v1.png"});
Object.assign(VFX_GLOWS,{ninaThornless:"#9ed8ff",mutsumiMoon:"#e7d9a5",ryoRain:"#5b91ff"});
Object.assign(VFX_GROUPS,{amiyaCrimson:["picture_ssr7_047"],sakikoCandle:["picture_ssr7_048"]});
Object.assign(VFX_SHEETS,{amiyaCrimson:"amiya-crimson-wheel-sheet-v1.png",sakikoCandle:"sakiko-candle-keyboard-sheet-v1.png"});
Object.assign(VFX_GLOWS,{amiyaCrimson:"#ff3048",sakikoCandle:"#ffd477"});
// 余下角色显式绑定到与其构图、材质和动作语义相符的项目内逐帧素材，避免落入通用演出。
Object.assign(VFX_GROUPS,{meilingTide:["picture_ssr7_049"],mutsumiSmile:["picture_ssr7_050"],meilingWind:["picture_ssr7_051"],yukinoSpring:["picture_ssr7_052"],amiyaRedline:["picture_ssr7_053"],mikuWaterMirror:["picture_ssr7_054"],mikuFlowerSea:["picture_ssr7_055"],mikuPumpkin:["picture_ssr7_056"],mikuSpringCrown:["picture_ssr7_057"],mikuStarBride:["picture_ssr7_058"],amiyaSilverSky:["picture_ssr7_059"],tanjiroDual:["picture_ex_060"],mineMouse:["picture_ex_071"]});
Object.assign(VFX_SHEETS,{meilingTide:"soyo-lost-voice-sheet-v1.png",mutsumiSmile:"mutsumi-mortis-formal-sheet-v1.png",meilingWind:"taki-racing-beat-sheet-v1.png",yukinoSpring:"kanade-snow-sheet-v1.png",amiyaRedline:"amiya-crimson-wheel-sheet-v1.png",mikuWaterMirror:"miku-star-mirror-sheet-v1.png",mikuFlowerSea:"sakura-star-trail-sheet-v1.png",mikuPumpkin:"klee-blazing-star-sheet-v1.png",mikuSpringCrown:"six-flower-rainbow-sheet-v1.png",mikuStarBride:"miku-clear-sky-stage-sheet-v1.png",amiyaSilverSky:"amiya-stardust-sheet-v1.png",tanjiroDual:"hinokami-kagura-sheet-v1.png",mineMouse:"gyomei-stone-sheet-v1.png"});
Object.assign(VFX_GLOWS,{meilingTide:"#265d84",mutsumiSmile:"#c6dda4",meilingWind:"#6de0d5",yukinoSpring:"#f2d9eb",amiyaRedline:"#e9435e",mikuWaterMirror:"#66e7eb",mikuFlowerSea:"#ff93c8",mikuPumpkin:"#ff9b3e",mikuSpringCrown:"#a7e88b",mikuStarBride:"#c9b6ff",amiyaSilverSky:"#7fc7ff",tanjiroDual:"#ff7134",mineMouse:"#c7a36d"});
// 明确登记每一张使用逐帧素材的卡：素材、色彩、帧区间、遮罩、尺寸倍率、旋转策略与三阶段帧段。
// 未登记的角色卡不进入 spriteFire，而是使用通用程序化演出，绝不再默认回退到炭治郎火焰。
const VFX_SHEET_DEFAULTS = {
    ranges:{summon:[0,5],attack:[3,11],destroy:[10,15]},
    size:{attack:2.35,other:2.55},
    rotate:"travel",
    mask:"radial-gradient(ellipse 27% 38% at 50% 50%,transparent 0 72%,#000 88%)",
};
export const VFX_CARD_PROFILES = {};
// These six original YGO spells use dedicated procedural renderers instead of sprite textures.
// Keeping the registration explicit makes full spell coverage auditable without duplicating art.
export const DEDICATED_PROCEDURAL_SPELLS = Object.freeze({
    ygo_n_53129443:"blackHole",
    ygo_n_83764718:"spellCinematic:rebirth",
    ygo_n_66788016:"spellCinematic:fissure",
    ygo_n_55144522:"spellCinematic:greed",
    ygo_n_72302403:"spellCinematic:swords",
    ygo_n_4031928:"spellCinematic:heart",
});
const registerVfxCards = (theme, ids) => {
    for (const id of ids) {
        if (VFX_CARD_PROFILES[id]) continue;
        VFX_CARD_PROFILES[id] = {
            id, theme, sheet:VFX_SHEETS[theme], glow:VFX_GLOWS[theme],
            ...VFX_SHEET_DEFAULTS,
        };
    }
};
for (const [theme, ids] of Object.entries(VFX_GROUPS)) registerVfxCards(theme, ids);
registerVfxCards("tanjiro", ["picture_ex_019","picture_ssr7_034"]);
registerVfxCards("nezuko", ["picture_ex_027"]);
registerVfxCards("zenitsu", ["picture_ex_021"]);
registerVfxCards("inosuke", ["picture_ex_029"]);
registerVfxCards("giyu", ["picture_ex_025"]);
registerVfxCards("rengoku", ["picture_ex_030"]);
registerVfxCards("shinobu", ["picture_ex_024"]);
VFX_CARD_PROFILES.gallery_spell_014={
    id:"gallery_spell_014",theme:"worldLineBond",sheet:"world-line-bond-sheet-v1.png",glow:"#ff9a43",
    ranges:{summon:[0,3],attack:[0,15],destroy:[12,15]},size:{attack:3.15,other:2.8},rotate:"static",
    mask:"radial-gradient(ellipse 48% 48% at 50% 50%,#000 0 58%,transparent 92%)",
};
for(const [id,theme,sheet,glow,size] of [
    ["ygo_n_19159413","deSpell","de-spell-sheet-v1.png","#9f73ff",2.65],
    ["ygo_n_51482758","trapRemoval","trap-removal-sheet-v1.png","#e3a94d",2.75],
    ["ygo_n_79571449","gracefulCharity","graceful-charity-sheet-v1.png","#ffe5a1",2.85],
    ["ygo_n_19523799","hinotama","hinotama-sheet-v1.png","#ff641f",2.45],
    ["ygo_n_84257639","dianKeto","dian-keto-heal-sheet-v1.png","#8cff73",2.7],
    ["ygo_n_25880422","stopDefense","stop-defense-sheet-v1.png","#ff3948",2.6],
    ["picture_ex_001","diamondWill","diamond-will-sheet-v1.png","#4fe8ee",2.8],
    ["picture_ex_002","goldenResolve","golden-wind-resolve-sheet-v1.png","#ffd13f",2.85],
    ["picture_ex_003","joestarBlood","joestar-bloodline-sheet-v1.png","#e62b4c",2.75],
    ["picture_ex_004","phantomBlood","phantom-blood-sheet-v1.png","#e53447",2.75],
    ["picture_ex_005","legacyStars","legacy-stars-sheet-v1.png","#61baff",2.95],
    ["picture_ex_006","jojolionGospel","jojolion-gospel-sheet-v1.png","#e854d3",2.8],
    ["picture_ex_007","stoneOceanBond","stone-ocean-bond-sheet-v1.png","#4deeff",2.8],
    ["picture_ex_008","steelBallRun","steel-ball-run-sheet-v1.png","#e9b64b",2.75],
    ["picture_ex_009","battleTendency","battle-tendency-sheet-v1.png","#ff714f",2.85],
    ["picture_ex_010","stardustCrusade","stardust-crusade-sheet-v1.png","#b985ff",2.95],
    ["picture_ex_108","youthClassroom","youth-classroom-promise-sheet-v1.png","#ffc77d",2.75],
    ["picture_ex_109","komiCourage","komi-courage-sheet-v1.png","#f7a8d7",2.7],
    ["picture_ex_110","rezeroBond","rezero-bond-sheet-v1.png","#80c9ff",2.85],
    ["picture_ex_111","yukinoHachiman","yukino-hachiman-side-by-side-sheet-v1.png","#82c8ff",2.8],
    ["picture_ex_112","wickedEyeSeal","wicked-eye-declaration-sheet-v1.png","#a45cff",2.65],
    ["picture_ex_113","marinCosplay","marin-cosplay-disarm-sheet-v1.png","#ff78ac",2.75],
    ["picture_ex_114","yamadaAfterSchool","yamada-after-school-sheet-v1.png","#ffae71",2.75],
    ["picture_ex_115","megumiGentleTime","megumi-gentle-time-sheet-v1.png","#f3a2ad",2.75],
    ["picture_ex_116","naoHeartbeat","nao-heartbeat-viewfinder-sheet-v1.png","#79d9ff",2.65],
    ["picture_ex_117","takagiPrank","takagi-prank-sheet-v1.png","#62e6e6",2.7],
    ["picture_ex_118","pinkWorldLine","pink-world-line-miracle-sheet-v1.png","#ff6cae",3.0],
    ["picture_ex_119","rezeroBlessing","rezero-otherworld-blessing-sheet-v1.png","#a9d7ff",2.95],
    ["nc_sp_ur_001","eightThousandMemory","eight-thousand-years-memory-sheet-v1.png","#f2c46c",3.0],
    ["nc_sp_ur_002","paleOverture","pale-overture-sheet-v1.png","#a9e5ff",2.9],
    ["nc_sp_ur_003","schoolRefusalFuture","school-refusal-future-sheet-v1.png","#9bb1ca",2.9],
    ["nc_sp_ur_004","afterSchoolTea","after-school-tea-party-sheet-v1.png","#f1ad7d",2.95],
    ["nc_sp_ur_005","shatteredSky","shattered-sky-mark-sheet-v1.png","#9b62ff",3.05],
    ["nc_sp_ur_006","thornlessHarmony","thornless-harmony-sheet-v1.png","#ff4658",3.0],
    ["nc_sp_ur_007","socialAnxiety","social-anxiety-lock-sheet-v1.png","#dc8dac",2.85],
    ["nc_sp_ur_008","moonMessage","moon-message-trap-sheet-v1.png","#b5a8ff",2.9],
    ["nc_sp_ur_009","bestPartner","best-partner-scout-sheet-v1.png","#77caff",2.9],
    ["nc_sp_ur_010","gameThrone","game-throne-study-sheet-v1.png","#e9bd52",3.05],
    ["nc_sp_ur_011","shallowTide","shallow-tide-freeze-sheet-v1.png","#73e1e5",2.9],
    ["nc_sp_ur_012","distantLetter","letter-distant-shore-sheet-v1.png","#f2d689",3.0],
    ["nc_sp_ss_001","mutantDna","mutant-dna-exchange-sheet-v1.png","#9c68ff",2.95],
    ["nc_sp_ss_002","summerStepsTea","summer-steps-tea-sheet-v1.png","#9fd16d",2.9],
    ["nc_sp_ss_003","nightEchoPassion","night-echo-passion-sheet-v1.png","#d25cff",3.0],
    ["nc_sp_ss_004","oldPaintingPrayer","old-painting-butterfly-prayer-sheet-v1.png","#a688e8",2.95],
    ["nc_sp_ss_005","lightSkyConcert","light-the-sky-concert-sheet-v1.png","#ffd55d",3.05],
    ["nc_sp_ss_006","sleepingBlues","sleeping-blues-sheet-v1.png","#477dff",2.9],
    ["gallery_spell_008","nightDance","night-dance-sheet-v1.png","#b886ff",3.0],
    ["gallery_spell_009","tailoredAffection","tailored-affection-sheet-v1.png","#ed5c77",2.9],
    ["gallery_spell_010","oddityBond","oddity-bond-purify-sheet-v1.png","#e1a03f",2.95],
    ["gallery_spell_011","homeCovenant","home-corner-covenant-sheet-v1.png","#e6ae62",2.9],
    ["gallery_spell_012","eveningBreezeVow","evening-breeze-vow-sheet-v1.png","#75d8c5",2.9],
    ["gallery_spell_013","acceleratedAlley","old-alley-accelerated-road-sheet-v1.png","#47baff",3.05],
    ["gallery_spell_015","phantomSyndromeVow","phantom-syndrome-vow-sheet-v1.png","#d5b5ff",2.9],
    ["gallery_spell_016","blueSeaPact","blue-sea-pirate-pact-sheet-v1.png","#39cfff",3.05],
    ["gallery_spell_017","bladeEscapeVow","blade-life-escape-vow-sheet-v1.png","#e04b62",2.95],
    ["gallery_spell_018","loveBrainBattle","love-brain-battle-sheet-v1.png","#e73343",2.95],
    ["gallery_spell_019","sunsetHomecoming","sunset-letter-homecoming-sheet-v1.png","#f1ad47",2.95],
    ["gallery_spell_020","duskFireCovenant","dusk-street-fire-covenant-sheet-v1.png","#ff6328",2.9],
    ["gallery_spell_021","twistedYouthHeart","twisted-youth-true-heart-sheet-v1.png","#d75b62",2.95],
    ["gallery_spell_022","sunnySlopeReunion","sunny-slope-reunion-sheet-v1.png","#ffb36d",2.9],
    ["gallery_spell_023","cuteShelter","cute-girlfriend-shelter-sheet-v1.png","#ff92c1",2.85],
    ["gallery_spell_024","adolescenceVow","adolescence-syndrome-vow-sheet-v1.png","#b9b4ff",2.95],
    ["gallery_spell_025","youngAffection","young-affection-scout-sheet-v1.png","#ef9fb1",2.85],
    ["gallery_spell_026","digitalInvite","digital-invitation-token-sheet-v1.png","#48dcff",2.9],
    ["gallery_spell_027","dualSwordPact","dual-sword-pact-sheet-v1.png","#5e9fff",2.95],
    ["gallery_spell_028","shatteredLight","shattered-light-purify-sheet-v1.png","#dbeeff",3.0],
    ["gallery_spell_029","lifelongVow","lifelong-marriage-vow-sheet-v1.png","#f1bfca",2.95],
    ["gallery_spell_030","playfulHeartStudy","playful-heart-study-sheet-v1.png","#ff86c0",3.0],
    ["gallery_spell_031","playfulWordsAmbush","playful-words-ambush-sheet-v1.png","#b563d9",2.95],
    ["gallery_spell_032","narrowRoadExchange","narrow-road-exchange-sheet-v1.png","#e85145",3.0],
    ["gallery_spell_033","evilEyeHeartVow","evil-eye-heart-vow-sheet-v1.png","#8d49c9",2.9],
    ["gallery_spell_034","wastelandRally","wasteland-rally-sheet-v1.png","#c6a56e",3.0],
    ["gallery_spell_035","snowPathHands","snow-path-hands-sheet-v1.png","#b9ddff",2.95],
    ["gallery_spell_036","bloodBondSanctuary","blood-bond-sanctuary-sheet-v1.png","#d9293b",3.0],
    ["gallery_spell_037","incenseFlowerRecycle","incense-flower-recycle-sheet-v1.png","#e88296",3.0],
    ["gallery_spell_038","eavesHarmony","eaves-harmony-recover-sheet-v1.png","#68cfff",2.95],
    ["gallery_spell_039","eavesMochiToken","eaves-mochi-token-sheet-v1.png","#b8d38b",2.85],
    ["gallery_spell_040","youthMusicInvite","youth-music-invitation-sheet-v1.png","#6acfff",2.95],
    ["gallery_spell_041","vongolaFlame","vongola-family-flame-sheet-v1.png","#ff772e",3.0],
    ["gallery_spell_042","youthBrushStudy","youth-brush-study-sheet-v1.png","#536fa8",3.0],
    ["gallery_spell_043","sakuraInvitation","sakura-invitation-sheet-v1.png","#ff9cbc",2.95],
    ["gallery_spell_044","travelBondToken","travel-bond-token-sheet-v1.png","#55dff2",2.9],
    ["gallery_spell_045","finiteEternalMemory","finite-eternal-memory-sheet-v1.png","#c88dff",3.0],
    ["gallery_spell_046","duskRuinOath","dusk-ruin-oath-sheet-v1.png","#ff6a32",3.05],
    ["gallery_spell_047","terminalRebirth","terminal-rebirth-vow-sheet-v1.png","#62e6d0",3.0],
    ["gallery_spell_048","masterServantPact","master-servant-pact-sheet-v1.png","#df3f55",3.0],
    ["gallery_spell_049","companionsJourney","companions-journey-token-sheet-v1.png","#62d9ff",2.95],
    ["gallery_spell_050","belongingBond","belonging-bond-vow-sheet-v1.png","#e276a1",3.0],
    ["gallery_spell_058","grasslandSerenade","grassland-serenade-sheet-v1.png","#a8d55f",2.95],
    ["gallery_spell_061","streetKindness","street-corner-kindness-sheet-v1.png","#f0ad70",2.95],
    ["gallery_spell_062","rippleEnsemble","ripple-ensemble-sheet-v1.png","#55dce8",3.0],
    ["gallery_spell_066","eightMillenniaFrame","eight-millennia-heart-frame-sheet-v1.png","#d7a34e",3.0],
    ["gallery_spell_067","starVictoryOath","star-victory-oath-sheet-v1.png","#79bfff",3.05],
    ["gallery_spell_068","astralInstant","astral-instant-freeze-sheet-v1.png","#8fbfff",2.95],
    ["gallery_spell_069","otherworldRemnants","otherworld-remnants-sheet-v1.png","#a68ed8",3.0],
    ["gallery_spell_070","sakuraKimonoDance","sakura-kimono-dance-sheet-v1.png","#ff91b8",3.05],
    ["source_spell_021","twinSwanStarSong","twin-swan-star-song-sheet-v1.png","#9eeaff",3.0],
    ["source_spell_022","staffSwordCovenant","staff-sword-covenant-sheet-v1.png","#dce9ff",2.95],
]) VFX_CARD_PROFILES[id]={id,theme,sheet,glow,ranges:{summon:[0,3],attack:[0,15],destroy:[12,15]},size:{attack:size,other:size},rotate:"static",mask:"radial-gradient(ellipse 49% 49% at 50% 50%,#000 0 60%,transparent 94%)"};
export function getCardVfxProfile(cardId){ return VFX_CARD_PROFILES[cardId] || null; }

// 45 张陷阱卡：每张一套独立的 4×4 图集（16 帧），素材、登记与矢量结界三者一一对应。
// 图集本身已经把中心（卡面位置）挖成真透明，遮罩只在外缘做羽化，因此结界只环绕卡牌。
for (const [id, theme, sheet, glow, size] of TRAP_ATLAS_PROFILES) {
    VFX_CARD_PROFILES[id] = {
        id, theme, sheet, glow,
        ranges:{ trap:[0,15], attack:[0,15] },
        size:{ attack:size, other:size },
        rotate:"static",
        mask:TRAP_ATLAS_MASK,
        ward:TRAP_WARDS[id] || null,
    };
}

export const AUTHORED_CARD_SCENES = {
    ...CARD_STORYBOARDS,
    gallery_spell_014: {
        source:"https://steinsgate.jp/",
        note:"依据《STEINS;GATE》官方世界线、手机改变历史与实验室成员设定制作；镜头为本项目原创游戏化演绎。",
        activate:scene("跨越世界线的羁绊·命运石之门",["秋叶原记忆被世界线撕成时间切片","D-Mail穿过因果噪声改写过去","偏差值停在1.048596后同伴记忆重新合流"],f=>{
            f.fireDance(f.from,f.to,0,2400,"attack");
            f.title("跨越世界线的羁绊","1.048596 · STEINS;GATE","#ffb76b",240,1900);
        }),
    },
    ygo_n_19159413:{source:official("de-spell"),activate:scene("除魔·术式剥离",["反魔法阵锁定后场","净化裂痕逐层撕开术式","青白消除十字抹去残留"],f=>{f.fireDance(f.from,f.to,0,2050,"attack");f.title("除魔","术式剥离 · DE-SPELL","#a987ff",180,1600)})},
    ygo_n_51482758:{activate:scene("陷阱拆除·断线解除",["黄铜探针展开扫描","机械足锁住三条触发线路","剪钳逐线切断并折叠陷阱外壳"],f=>{f.fireDance(f.from,f.to,0,2200,"attack");f.title("陷阱拆除","断线解除 · DISARM","#e7af54",180,1700)})},
    ygo_n_79571449:{source:official("graceful-charity"),activate:scene("天使的施舍·三羽赐福",["三翼在金色圣光中展开","三张赐福光牌垂落","两道余光归还后主光留存"],f=>{f.fireDance(f.from,f.to,0,2250,"attack");f.title("天使的施舍","三羽赐福 · GRACEFUL CHARITY","#ffe8ad",180,1750)})},
    ygo_n_19523799:{source:official("hinotama"),activate:scene("火刑·灼热火球",["火种压缩成白热核心","火球沿短弧扑向对方","落点爆燃后只留下灼烧环"],f=>{f.fireDance(f.from,f.to,0,1850,"attack");f.title("火刑","灼热火球 · 500 DAMAGE","#ff6c25",150,1400)})},
    ygo_n_84257639:{source:official("dian-keto-the-cure-master"),activate:scene("迪安·凯特·翠液疗愈",["双叶交叉形成药师纹章","翠色药液沿光带倾注","生命光柱回流并封成叶印"],f=>{f.fireDance(f.from,f.to,0,2150,"attack");f.title("治愈之神迪安·凯特","翠液疗愈 · LP +800","#9bff7c",170,1650)})},
    ygo_n_25880422:{source:official("stop-defense"),activate:scene("守备封禁·盾阵强制解除",["赤红准星锁住守备目标","重型拘束器从两侧夹合","盾面被迫竖起并烙下禁止刻印"],f=>{f.fireDance(f.from,f.to,0,2050,"attack");f.title("守备封禁","盾阵强制解除 · STOP DEFENSE","#ff4655",170,1550)})},
    picture_ex_001:{source:"https://jojo-portal.com/anime/du/",activate:scene("不灭钻石的意志·完全修复",["碎裂钻石映出受损记忆","粉色复原能量沿裂缝逆行","全部碎片倒转重组为完整心钻"],f=>{f.fireDance(f.from,f.to,0,2250,"attack");f.title("不灭钻石的意志","完全修复 · CRAZY DIAMOND","#66eef0",170,1700)})},
    picture_ex_002:{source:"https://jojo-portal.com/anime/gw/",activate:scene("黄金之风的觉悟·生命净化",["金色瓢虫纹章唤醒生命力","黄金叶脉缠住墓地残响","污浊记忆化为叶片后被净化"],f=>{f.fireDance(f.from,f.to,0,2250,"attack");f.title("黄金之风的觉悟","生命净化 · GOLDEN WIND","#ffe05c",170,1700)})},
    picture_ex_003:{source:"https://jojo-portal.com/",activate:scene("乔斯达血脉·星痕重逢",["血滴在星形胎记上唤醒契约","历代星痕沿血脉依次点亮","失落卡牌随祖传星光回归"],f=>{f.fireDance(f.from,f.to,0,2350,"attack");f.title("乔斯达血脉","星痕重逢 · JOESTAR LEGACY","#ff4f62",180,1800)})},
    picture_ex_004:{source:"https://jojo-portal.com/anime/pb-bt/",activate:scene("幻影之血·石鬼面献祭",["石鬼面从月雾中浮现","鲜血灌入刻槽开启古老机关","幽蓝生命力化作恢复光后沉寂"],f=>{f.fireDance(f.from,f.to,0,2350,"attack");f.title("幻影之血","石鬼面献祭 · PHANTOM BLOOD","#e83b50",180,1800)})},
    picture_ex_005:{source:"https://jojo-portal.com/",activate:scene("群星的传承·命运轮转",["历代星之记忆形成家族星座","三段记忆沿轨道回到卡组","新的卡牌星光从传承中心升起"],f=>{f.fireDance(f.from,f.to,0,2400,"attack");f.title("群星的传承","命运轮转 · STARDUST LEGACY","#69c5ff",180,1850)})},
    picture_ex_006:{source:"https://jojo-portal.com/about/jj/",activate:scene("乔乔福音·软湿灾厄拆解",["双重泡影承载光暗两面","旋转泡泡截断灾厄轨迹","隐藏后场在泡膜中显形并崩解"],f=>{f.fireDance(f.from,f.to,0,2350,"attack");f.title("乔乔福音·定助与透龙","软湿灾厄拆解 · JOJOLION","#ec70dc",180,1800)})},
    picture_ex_007:{source:"https://jojo-portal.com/anime/so/",activate:scene("石之海的羁绊·蝶线替身",["碧蓝蝶结唤醒线之能力","发光丝线编织守护替身轮廓","牢笼崩开后线网完成守备落位"],f=>{f.fireDance(f.from,f.to,0,2300,"attack");f.title("石之海的羁绊","蝶线替身 · STONE OCEAN","#63f3ff",180,1750)})},
    picture_ex_008:{source:"https://jojo-portal.com/about/jj/",activate:scene("飙马野郎·黄金回旋入场",["钢球刻槽开始高速旋转","黄金回旋沿赛道弧线推进","旋转门开启守备落位并释放恢复波"],f=>{f.fireDance(f.from,f.to,0,2300,"attack");f.title("飙马野郎","黄金回旋入场 · STEEL BALL RUN","#efc25d",180,1750)})},
    picture_ex_009:{source:"https://jojo-portal.com/anime/pb-bt/",activate:scene("战斗潮流·下一句预判",["红石与波纹泡泡化作两条策略路径","金色波纹预演卡组顶端未来","选中卡牌被拉出而余路封回牌库"],f=>{f.fireDance(f.from,f.to,0,2300,"attack");f.title("战斗潮流","下一句预判 · BATTLE TENDENCY","#ff825e",180,1750)})},
    picture_ex_010:{source:"https://jojo-portal.com/anime/sc/",activate:scene("星尘远征·白金破阵",["五色星轨穿越沙漠夜路","紫色时钟短暂停摆锁定后场","白金拳星击碎盖卡并返还微量生命"],f=>{f.fireDance(f.from,f.to,0,2350,"attack");f.title("星尘远征","白金破阵 · STARDUST CRUSADERS","#c297ff",180,1800)})},
    picture_ex_108:{activate:scene("青春教室的约定·放学后登台",["夕阳越过教室窗格照亮空桌","纸笺约定沿两张课桌之间展开","守备身影从折纸光中走出并落位"],f=>{f.fireDance(f.from,f.to,0,2200,"attack");f.title("青春教室的约定","放学后登台","#ffd08a",170,1650)})},
    picture_ex_109:{source:"https://komisan-official.com/",activate:scene("古见同学的勇气·无声选择",["空白对话框克服颤动后展开","猫耳笔记本展示三张候选卡","粉色选择光带回目标并合上书页"],f=>{f.fireDance(f.from,f.to,0,2200,"attack");f.title("古见同学的勇气","无声选择 · COMMUNICATION","#f6afd8",170,1650)})},
    picture_ex_110:{source:"https://re-zero.com/",activate:scene("从零开始的羁绊·记忆回溯",["破碎存档晶体在寒光中苏醒","墓地记忆卡逆流穿过死亡阴影","新卡光与归来记忆被蓝色缎带相连"],f=>{f.fireDance(f.from,f.to,0,2300,"attack");f.title("从零开始的羁绊","记忆回溯 · RE:ZERO","#8dd3ff",180,1750)})},
    picture_ex_111:{activate:scene("雪乃与八幡的并肩·侍奉部的答案",["冷色雪晶与暖色咖啡蒸汽在两盏台灯下分别亮起","侍奉部教室门打开，两条互不相同的心路穿过门扉","双灯在目标落点合流，形成并肩守护与回复光环"],f=>{f.fireDance(f.from,f.to,0,2300,"attack");f.title("雪乃与八幡的并肩","侍奉部的答案","#91d4ff",180,1750)})},
    picture_ex_112:{activate:scene("邪王真眼的宣言·不可视境界封印",["紫金邪王真眼在目标上方睁开并展开多重眼阵","黑紫缎带缠住目标，交叉符文锁链压制其效果","力量被抽离后眼阵收束为落在目标上的封印刻印"],f=>{f.fireDance(f.from,f.to,0,2150,"attack");f.title("邪王真眼的宣言","不可视境界封印 · ATK −400","#b77aff",170,1650)})},
    picture_ex_113:{activate:scene("喜多川海梦的笑容·双装拆解",["相机闪光与卷尺展开，粉线为两张盖卡分别画出纸样框","金针固定目标，缎带逐层包裹后由双快门剪切","两张盖卡化作无害布样，红线在落点打成心形结"],f=>{f.fireDance(f.from,f.to,0,2250,"attack");f.title("喜多川海梦的笑容","双装拆解 · DESTROY 2 SET CARDS","#ff90ba",175,1700)})},
    picture_ex_114:{activate:scene("山田杏奈的放学后·四页构思",["夕阳教室与零食包装的反光打开涂鸦笔记","四张灵感卡依次接受放大镜检视，其中一张被暖光选中","其余三页按顺序飘向卡组底，选中灵感飞入手牌并留下铅笔星印"],f=>{f.fireDance(f.from,f.to,0,2300,"attack");f.title("山田杏奈的放学后","四页构思 · SELECT 1 OF 4","#ffc080",175,1750)})},
    picture_ex_115:{activate:scene("加藤惠的温柔时光·无声改稿",["红色贝雷帽缎带掠过，剧本页在春风中展开","柔光丝带标出两张盖卡的触发线，两道纸刃安静切断","盖卡折成空白稿页散去，茶金回复环回到己方并留下花瓣帽印"],f=>{f.fireDance(f.from,f.to,0,2250,"attack");f.title("加藤惠的温柔时光","无声改稿 · 2 CARDS / LP +300","#ffc0c8",175,1700)})},
    picture_ex_116:{activate:scene("友利奈绪的悸动·不可视取景",["摄像机镜头开启，青色取景框锁定攻击力最高的目标","扫描线找出能力盲区，透明光带抹去轮廓并以心电波触发翻转","快门闭合后目标伏为里侧，三段防御光被抽离并留下取景心印"],f=>{f.fireDance(f.from,f.to,0,2200,"attack");f.title("友利奈绪的悸动","不可视取景 · FACE-DOWN / DEF −300","#8de2ff",175,1680)})},
    picture_ex_117:{activate:scene("高木同学的恶作剧·猜错方向",["海边教室的粉笔笑脸画下问题，左右箭头故意给出假提示","写着笑脸的纸条贴上最强目标，清风从反方向突然翻面","目标伏为里侧后四道粉笔刻痕削去防御，最后留下猫笑封印"],f=>{f.fireDance(f.from,f.to,0,2150,"attack");f.title("高木同学的恶作剧","猜错方向 · FACE-DOWN / DEF −400","#78eeee",170,1630)})},
    picture_ex_118:{source:"https://steinsgate.jp/",activate:scene("世界线的粉色奇迹·越界归来",["赤红生命代价滴入复古电话，粉色分歧环开始改写世界线","时间钥匙穿过黑色边界，只钩住除外区的一张失落卡牌","卡牌越过事件视界归来，绿粉回复环反流并收束成齿轮心印"],f=>{f.fireDance(f.from,f.to,0,2450,"attack");f.title("世界线的粉色奇迹","越界归来 · PAY 1000 / RECALL 1","#ff83bd",190,1880)})},
    picture_ex_119:{source:"https://re-zero.com/",activate:scene("从零开始的异世界祝福·存档往复",["冰蓝存档晶体承受赤红生命代价后裂开","墓地两段记忆被银色精灵带净化，并沿检查点时间环倒流","两张记忆沉入卡组底，随即有两张新光卡从封印上方升起"],f=>{f.fireDance(f.from,f.to,0,2450,"attack");f.title("从零开始的异世界祝福","存档往复 · RETURN 2 / DRAW 2","#b9e1ff",190,1880)})},
    nc_sp_ur_001:{activate:scene("八千年的思念·星砂归信",["古老沙漏承受生命代价，八重记忆星环逐层亮起","封蜡旧信指向星界边界，金线将一张失落卡牌牵回","沙漏倒转后再吐出一张新光卡，最终合成无限心形时印"],f=>{f.fireDance(f.from,f.to,0,2500,"attack");f.title("八千年的思念","星砂归信 · RECALL 1 / DRAW 1","#f6d17f",195,1920)})},
    nc_sp_ur_002:{activate:scene("薄采序奏·双色和声",["苍白晨音响起，音叉承受赤红生命代价开始振动","水蓝与琥珀两种属性旋律从两侧进入并合成双声部谱环","和声节点凝成一张光卡飞回手牌，尾音收束为双音符印"],f=>{f.fireDance(f.from,f.to,0,2350,"attack");f.title("薄采序奏","双色和声 · 2 ATTRIBUTES / DRAW 1","#bcecff",185,1800)})},
    nc_sp_ur_003:{activate:scene("不登校的未来·闭锁教室",["空教室时钟停摆，赤红生命代价盖上缺席印章","无限延伸的走廊把最强目标隔在五道窗影中，窗帘逐层闭合","桌椅翻折成里侧卡牌，五格冷光抽走防御并封成上锁教室门"],f=>{f.fireDance(f.from,f.to,0,2400,"attack");f.title("不登校的未来","闭锁教室 · FACE-DOWN / DEF −500","#aec2d7",185,1820)})},
    nc_sp_ur_004:{activate:scene("放学后的茶会·三杯重逢",["夕照落入茶杯，赤红生命代价将茶汤染出一圈涟漪","两柄灵匙从墓地请回两张低星怪兽卡，蒸汽把它们洗成暖金色","茶壶再斟一杯化为新卡，三只茶杯最终合成重逢苜蓿印"],f=>{f.fireDance(f.from,f.to,0,2450,"attack");f.title("放学后的茶会","三杯重逢 · RECOVER 2 / DRAW 1","#f5bd8c",190,1880)})},
    nc_sp_ur_005:{activate:scene("碎穹·七星延爆",["暗夜穹顶展开，生命代价击裂中心星并锁定最强目标","七枚星锋围绕目标装配成碎穹标记，延时轨道保持旋转等待回合结束","倒计时闭合后穹顶向内崩裂，七星落击造成伤害并粉碎目标"],f=>{f.fireDance(f.from,f.to,0,2500,"attack");f.title("碎穹","七星延爆 · END PHASE / 700 DAMAGE","#b383ff",195,1900)})},
    nc_sp_ur_006:{activate:scene("有刺无刺·荆棘合奏",["黑荆棘承受生命代价，赤红弦音与水蓝歌声从两侧进入","两种属性在交点同步，荆棘只在和声通过处退去并形成舞台波形","和弦凝成新卡，三次翠绿回复心跳回流，最终开出无刺音符玫瑰"],f=>{f.fireDance(f.from,f.to,0,2450,"attack");f.title("有刺无刺","荆棘合奏 · DRAW 1 / LP +300","#ff6570",190,1860)})},
    nc_sp_ur_007:{activate:scene("社恐的焦虑·失语包围",["颤抖的粉色话框承受生命代价，杂音话框从四周逼近目标","六道焦虑裂线收紧，沉默兜帽遮住目标并切断外界轮廓","目标蜷缩翻为里侧，六枚防御刻度熄灭，最后锁成禁言话框"],f=>{f.fireDance(f.from,f.to,0,2400,"attack");f.title("社恐的焦虑","失语包围 · FACE-DOWN / DEF −600","#e6a0ba",185,1820)})},
    nc_sp_ur_008:{activate:scene("月下传讯·闭月伏线",["新月升起，生命代价触响风铃并唤醒墓地最后一张陷阱","纸笺月带把紫色陷阱带出月井，在银色月光下洗去墓尘","陷阱伏盖后由银线缠上闭月锁，明确封闭至下一回合"],f=>{f.fireDance(f.from,f.to,0,2400,"attack");f.title("月下传讯","闭月伏线 · SET TRAP / LOCK 1 TURN","#c6bcff",185,1820)})},
    nc_sp_ur_009:{activate:scene("最好的伙伴·二选同行",["蓝金与珊瑚色友情坠饰分成两半，生命代价点亮共同核心","卡组顶两张卡并肩升起，握手爪星选择其一，另一张标记回底箭头","伙伴卡飞入手牌，余卡沿蓝弧沉到卡组底，坠饰重新合为双星徽章"],f=>{f.fireDance(f.from,f.to,0,2350,"attack");f.title("最好的伙伴","二选同行 · SELECT 1 OF 2","#8ad4ff",185,1780)})},
    nc_sp_ur_010:{activate:scene("游戏王座·六策择一",["黑金王座承受生命代价，六张卡在蓝晶王冠上展开","战略之眼逐张审视，选中的一张升为金色，余下五张组成有序回底螺旋","选择卡飞回手牌，五张依次沉入卡组底，王座封成单卡冠印"],f=>{f.fireDance(f.from,f.to,0,2500,"attack");f.title("游戏王座","六策择一 · SELECT 1 OF 6","#f2cb65",195,1900)})},
    nc_sp_ur_011:{activate:scene("浅海浮汐·月潮静止",["浅青潮线接住生命代价，海玻璃准星锁定最强目标","温和潮水托起目标并转为守备，透明潮膜凝成不伤害目标的静止笼","月相潮钟绕行一周并抽去一格攻击光，最后封成贝壳暂停印"],f=>{f.fireDance(f.from,f.to,0,2400,"attack");f.title("浅海浮汐","月潮静止 · DEFENSE / LOCK","#8be9eb",185,1820)})},
    nc_sp_ur_012:{activate:scene("寄往遥远彼岸的信·星海回函",["白色信封在暗岸接受生命代价并封上赤蜡，折成纸舟驶过星海","彼岸失落卡牌回应，金色信线将它越界牵回己方","信封打开再释放一张新光卡，三层翠金回复涟漪送回回函"],f=>{f.fireDance(f.from,f.to,0,2500,"attack");f.title("寄往遥远彼岸的信","星海回函 · RECALL / DRAW / HEAL","#f6dc98",195,1900)})},
    nc_sp_ss_001:{activate:scene("畸变DNA·低阶交换",["紫青双螺旋吸收六百生命代价，扫描己方攻击最低的身影","旧身影编码成卡牌返回手牌，螺旋另一半打开低阶卡囊","新怪兽以守备姿态落入六角护盾，双向箭头封成基因交换印"],f=>{f.fireDance(f.from,f.to,0,2400,"attack");f.title("畸变DNA","低阶交换 · RETURN / SPECIAL SUMMON","#ae82ff",185,1820)})},
    nc_sp_ss_002:{activate:scene("夏风石阶的挚友茶会·风铃归席",["树荫石阶亮起，六道生命脉冲化作两杯冰茶的碰杯声","墓地的一张低星怪兽卡被风铃与绿叶唤醒，沿日光石阶上行","茶色清光洗净卡面后送回手牌，最终留下双杯绿叶友情印"],f=>{f.fireDance(f.from,f.to,0,2350,"attack");f.title("夏风石阶的挚友茶会","风铃归席 · RECOVER 1","#b4df7f",185,1780)})},
    nc_sp_ss_003:{activate:scene("夜刻萦音的永续热忱·四拍回转",["午夜节拍器吸收六百生命代价，四张墓地记忆各自套上不同色声纹","黑胶夜钟按一至四的顺序排列卡牌并依次送入卡组底转盘","唱针落下后一张新光卡随延音升起，尾声封成无限节拍印"],f=>{f.fireDance(f.from,f.to,0,2450,"attack");f.title("夜刻萦音的永续热忱","四拍回转 · RETURN 4 / DRAW 1","#df78ff",190,1860)})},
    nc_sp_ss_004:{activate:scene("幽蝶旧画的沉郁祈愿·画中再演",["残旧画框吸收六百生命代价，幽紫蝶从颜料深处飞出","幽蝶找到墓地低星卡，画中双手补全其轮廓并引导它走出画面","怪兽以守备姿态落位并套上灰色效果封印，三层翠光完成回复"],f=>{f.fireDance(f.from,f.to,0,2450,"attack");f.title("幽蝶旧画的沉郁祈愿","画中再演 · REVIVE / NEGATE / HEAL","#b79af0",190,1860)})},
    nc_sp_ss_005:{activate:scene("奏响点亮天空·双声开灯",["暗色舞台吸收六百生命代价，六个节拍依次按下琴键","水蓝歌声与金黄琴声由两端攀升，合奏谱线逐盏点亮天空灯架","最亮音符落下一张新卡，六枚翠金回复星向己方展开并封成天际谱号"],f=>{f.fireDance(f.from,f.to,0,2500,"attack");f.title("奏响点亮天空","双声开灯 · DRAW 1 / LP +600","#ffdf73",195,1900)})},
    nc_sp_ss_006:{activate:scene("沉睡的蓝调·七拍夜眠",["午夜蓝音符吹响，六道生命代价沉入低音涟漪","七条钴蓝谱线逐层压低最强目标，靛色烟雾与眼帘月将它包裹","目标缓慢伏为里侧，七枚防御蓝灯下沉，尾声收成沉睡月音印"],f=>{f.fireDance(f.from,f.to,0,2400,"attack");f.title("沉睡的蓝调","七拍夜眠 · FACE-DOWN / DEF −700","#6798ff",185,1820)})},
    gallery_spell_008:{activate:scene("Night Dance·双月开场",["紫色新月从空舞台升起，银色五线谱沿月光织开","洋红与青蓝两条舞带代表不同属性，绕月交错完成双声舞步","交汇中心凝成一张光卡，舞台开启后收束为双带月音印"],f=>{f.fireDance(f.from,f.to,0,2400,"attack");f.title("Night Dance","双月开场 · CHORUS DRAW","#c39aff",185,1820)})},
    gallery_spell_009:{activate:scene("裁布牵情·换装缝合",["红色布带铺开，银剪裁下己方最弱身影并折成卡牌返回手中","红银双线交叉，从新纸样中裁出另一张低阶怪兽卡","新身影被缝合成守备姿态，收针时形成剪刀丝线心印"],f=>{f.fireDance(f.from,f.to,0,2350,"attack");f.title("裁布牵情","换装缝合 · RETURN / DEPLOY","#f4778d",185,1780)})},
    gallery_spell_010:{activate:scene("怪异诡缘·双线祓除",["琥珀怪异眼在暗处睁开，红蓝缘线分开扭曲阴影","纸符显出隐藏诅咒，两条缘线交织收紧并抽离黑色污迹","污迹被压入白色十字封印，最后结成怪异眼缘结印"],f=>{f.fireDance(f.from,f.to,0,2400,"attack");f.title("怪异诡缘","双线祓除 · PURIFY","#e9ad55",185,1820)})},
    gallery_spell_011:{activate:scene("家隅旧契·炉边归还",["昏暗家门升起，旧账簿在木桌上打开，瓷杯蒸汽唤醒角落记忆","金色书脊线找到一张褪色卡牌，修复卡面并牵引它穿过门槛","卡牌回到手中，炉光合成门、书与茶杯的守心旧契印"],f=>{f.fireDance(f.from,f.to,0,2350,"attack");f.title("家隅旧契","炉边归还 · RECOVER","#efbd74",185,1780)})},
    gallery_spell_012:{activate:scene("借晚风缔结的青涩誓约·三叶择心",["青绿晚风掠过草地托起折叠信笺，三张叶框候选卡随风展开","风流逐张检视，其中一张被珊瑚暖光选中，余卡沿叶弧回到卡组","选中卡随握手缎带回到手牌，尾声结成信叶青涩誓印"],f=>{f.fireDance(f.from,f.to,0,2350,"attack");f.title("借晚风缔结的青涩誓约","三叶择心 · SCOUT","#8ce3d2",185,1780)})},
    gallery_spell_013:{activate:scene("旧街巷连通现实与加速世界的路途·双轨研判",["雨夜旧巷铺开，机械时钟与青色网格同时覆盖石板路","时间指针停住后道路分成琥珀现实轨和电蓝加速轨，候选卡开始竞速","胜出卡沿金轨进入手牌，余卡按序沉入卡组底，双轨封成时路印"],f=>{f.fireDance(f.from,f.to,0,2500,"attack");f.title("旧街巷连通现实与加速世界的路途","双轨研判 · STUDY","#68c8ff",195,1900)})},
    gallery_spell_015:{activate:scene("跨越虚幻病症的相守誓约·双视安眠",["碎裂监测眼分成冷暖双重视角，苍白病雾罩住最强目标","蓝粉双手缎带穿过雾层相握，稳定心跳并软化目标的敌意轮廓","目标安静伏为里侧，守护心波覆盖卡面，尾声结成双眼握手心印"],f=>{f.fireDance(f.from,f.to,0,2400,"attack");f.title("跨越虚幻病症的相守誓约","双视安眠 · FACE-DOWN","#dfc5ff",185,1820)})},
    gallery_spell_016:{activate:scene("蓝海起航的海贼盟约·日轮守航",["青蓝海浪托起旧航图，双刃罗盘在图上划出起航路线","日轮从海平面升起，一张低阶伙伴卡乘浪驶向己方怪兽区","舵轮光将伙伴展开为守备身影，白帆护盾与盟旗完成落位"],f=>{f.fireDance(f.from,f.to,0,2450,"attack");f.title("蓝海起航的海贼盟约","日轮守航 · DEFENSE DEPLOY","#62ddff",190,1860)})},
    gallery_spell_017:{activate:scene("利刃与性命立下的逃亡誓约·月路换防",["双银刃在月下交叉，暗色逃亡道路向远处扫开","受伤伙伴沿赤色命线折成封蜡卡牌退回手中，另一张低阶卡沿窄路驰入","新伙伴展开破损盾牌守备落位，双刃在后方闭合为撤退护印"],f=>{f.fireDance(f.from,f.to,0,2400,"attack");f.title("利刃与性命立下的逃亡誓约","月路换防 · EXCHANGE","#ec6678",185,1820)})},
    gallery_spell_018:{activate:scene("恋爱头脑战开幕·心局制胜",["红心棋子落上黑白策略盘，王冠沙漏启动倒计时","冷暖双眼审视候选卡，墨色佯攻逐一排除错误选择","制胜卡戴上赤金王冠飞回手牌，棋盘盖下将军心印"],f=>{f.fireDance(f.from,f.to,0,2400,"attack");f.title("恋爱头脑战开幕","心局制胜 · STUDY","#ef4c59",185,1820)})},
    gallery_spell_019:{activate:scene("落晖下的信约归途·夕路回函",["橙金落日照亮漫长乡间路，封蜡信从路旁草丛升起","远方褪色卡牌回应信件，夕光丝线将它沿归途牵回","双手光弧护送卡牌进入手中，落日与信封合成归途誓印"],f=>{f.fireDance(f.from,f.to,0,2400,"attack");f.title("落晖下的信约归途","夕路回函 · RECOVER","#f6bd5b",185,1820)})},
    gallery_spell_020:{activate:scene("暮街火契·余烬伏笔",["暮色旧街显形，街灯点燃一束受控火苗照亮封缄信件","道路纹理组成准备术式，火线绕信一周并烙下余烬契印","信件伏置在术式中心，火焰降为持续待命的小灯芯"],f=>{f.fireDance(f.from,f.to,0,2350,"attack");f.title("暮街火契","余烬伏笔 · PREPARE","#ff7540",185,1780)})},
    gallery_spell_021:{activate:scene("扭曲青春中寻得真心的相守誓约·解结归心",["黑白社交面具背向裂开，旧笔记本翻出纠缠的黑白关系线","唯一的真红线从乱结中浮现，牵起一张褪色记忆卡并解开虚假绳结","卡牌沿真线回到手中，双手守住赤金心脏并封成面具书心印"],f=>{f.fireDance(f.from,f.to,0,2400,"attack");f.title("扭曲青春中寻得真心的相守誓约","解结归心 · RECOVER","#e16d72",185,1820)})},
    gallery_spell_022:{activate:scene("暖阳坡道上的再度相识·樱阶重逢",["晨阳照亮长坡石阶，樱瓣描出曾经走过的两条足迹","遗失卡牌在坡顶出现，双路金光相交后引导它沿台阶归来","卡牌落入手中，握手暖光与樱枝封成坡道重逢印"],f=>{f.fireDance(f.from,f.to,0,2350,"attack");f.title("暖阳坡道上的再度相识","樱阶重逢 · RECALL","#ffc07f",185,1780)})},
    gallery_spell_023:{activate:scene("女友不止这么可爱·心结护幕",["粉色缎带绕己方目标升起并勾出心形轮廓","青白透明盾贴近目标形成护幕，暗色来袭轨迹被盾面偏转","缎带在盾前系成守护蝴蝶结，星芒只沿边缘收束而不遮挡卡面"],f=>{f.fireDance(f.from,f.to,0,2250,"attack");f.title("女友不止这么可爱","心结护幕 · SHELTER","#ffa8cd",175,1700)})},
    gallery_spell_024:{activate:scene("青春期综合征的相守誓约·观测归来",["怀表在零点停住，白兔观测影出现在碎裂现实框前","遗失卡牌从玻璃另一侧显形，粉色心线穿过观测边界将其牵回","卡牌进入手中后时间重新行走，白兔、怀表与心线合成观测誓印"],f=>{f.fireDance(f.from,f.to,0,2400,"attack");f.title("青春期综合征的相守誓约","观测归来 · RECALL","#cbc6ff",185,1820)})},
    gallery_spell_025:{activate:scene("青涩情愫·三笺择心",["薄荷叶雨掠过害羞笔记本，三张花笺候选卡从书页升起","暖色心形指针逐张审视并选中樱粉花笺，余卡沿叶路回到底部","选择卡进入手牌，笔记本与嫩叶合成青涩心笺印"],f=>{f.fireDance(f.from,f.to,0,2300,"attack");f.title("青涩情愫","三笺择心 · SCOUT","#f4b2bf",180,1750)})},
    gallery_spell_026:{activate:scene("数码邀约·星包具现",["青色像素网格启动传送门，星形邀请包被投向战场","握手认证通过后，数据方块逐层拼成一名小型光体伙伴","伙伴以守备姿态落位，传送门关闭并留下像素星握手印"],f=>{f.fireDance(f.from,f.to,0,2350,"attack");f.title("数码邀约","星包具现 · CREATE TOKEN","#66e5ff",185,1780)})},
    gallery_spell_027:{activate:scene("双剑盟约·交锋守门",["钴蓝剑与银白剑分别从左右升起，交叉光线织成召唤门","一张低阶手牌进入双剑之间，被剑光展开为守备伙伴身影","双剑绕伙伴旋转并合为交叉盾面，契约光环完成守备落位"],f=>{f.fireDance(f.from,f.to,0,2400,"attack");f.title("双剑盟约","交锋守门 · DEFENSE DEPLOY","#7aaeff",185,1820)})},
    gallery_spell_028:{activate:scene("碎光偕行·三星越界",["冰晶画框从中心裂开，敌方墓地三张暗色记忆卡同时显形","三枚白金星印逐张标记，碎光道路将它们从阴影中托起","十字净光开启边界，三张卡依次消散到界外并留下三星碎框印"],f=>{f.fireDance(f.from,f.to,0,2400,"attack");f.title("碎光偕行","三星越界 · BANISH 3","#ecf6ff",185,1820)})},
    gallery_spell_029:{activate:scene("托付一生的婚姻誓约·冠戒归人",["珍珠缎带织开，金色冠戒在誓光中成形并唤醒墓地记忆","双手光弧托起一张五星以下怪兽卡，粉金光逐层修复卡面","卡牌回到手中，冠戒、握手与心形誓光合成终身盟印"],f=>{f.fireDance(f.from,f.to,0,2400,"attack");f.title("托付一生的婚姻誓约","冠戒归人 · RECOVER","#f5ccd4",185,1820)})},
    gallery_spell_030:{activate:scene("嬉闹之中的倾心誓约·九星挑心",["粉蓝嬉闹缎带掀开卡组，九张星卡组成三乘三候选阵","俏皮眼形指针逐格跳跃，选中的一张被粉心盖印并升起","选择卡进入手牌，余下八张按序组成回底旋涡，尾声结成九星心印"],f=>{f.fireDance(f.from,f.to,0,2450,"attack");f.title("嬉闹之中的倾心誓约","九星挑心 · SELECT 1 OF 9","#ff9aca",190,1860)})},
    gallery_spell_031:{activate:scene("戏语藏情·双伏闭锁",["笑面假面与秘密书同时打开，墓地两张紫色陷阱被折射眼逐一辨认","酒红缎带分别运送两张陷阱到后场左右槽位并伏盖","两枚银色心锁同时扣住盖卡，明确封闭到下一回合"],f=>{f.fireDance(f.from,f.to,0,2400,"attack");f.title("戏语藏情","双伏闭锁 · SET 2 TRAPS","#c078e2",185,1820)})},
    gallery_spell_032:{activate:scene("狭路心契·换防添牌",["赤线狭路分叉，交叉双刃拦住己方最弱身影并由握手光确认交换","旧身影折成卡牌返回手中，另一张五星以下卡沿心路进入并展开盾姿","新伙伴守备落位后再升起一张金色光卡，三步结算封成狭路心印"],f=>{f.fireDance(f.from,f.to,0,2450,"attack");f.title("狭路心契","换防添牌 · RETURN / SUMMON / DRAW","#f06a59",190,1860)})},
    gallery_spell_033:{activate:scene("邪眼心诺·五星蚀力",["紫金邪眼睁开并托起荆月，准星锁定对方最强目标","五枚赤黑封星沿荆链收紧，中心邪印压制目标效果","力量以五段脉冲流失，荆棘心环闭合后留下本回合封印"],f=>{f.fireDance(f.from,f.to,0,2400,"attack");f.title("邪眼心诺","五星蚀力 · NEGATE / ATK −500","#a15bd7",185,1820)})},
    gallery_spell_034:{activate:scene("墟野集结·双兽守阵",["荒墟岩柱升起并裂开青色地门，两张低阶墓地卡同时浮现","双重金白护环修复两道小型身影，使其以守备姿态跪地落位","灰色禁效锁分别扣住两体，星环稳定废墟并封成双盾集结印"],f=>{f.fireDance(f.from,f.to,0,2450,"attack");f.title("墟野集结","双兽守阵 · REVIVE 2 / NEGATE","#d4b87f",190,1860)})},
    gallery_spell_035:{activate:scene("雪径执手·双灯冰月",["雪径在弯月下展开，冷暖两道手光于目标两侧相握","冰潮将最强目标转为守备，月形冰笼封住攻击与表示变更","两格攻击光熄灭，霜钟绕行一周后留下雪径执手印"],f=>{f.fireDance(f.from,f.to,0,2400,"attack");f.title("雪径执手","双灯冰月 · LOCK / ATK −200","#cbe6ff",185,1820)})},
    gallery_spell_036:{activate:scene("血绊之契·十六脉祈愿",["赤晶心脏与荆棘契环成形，一张己方墓地卡被白色祭坛十字接纳","卡牌化作四乘四排列的十六枚生命星并越界消散","翠金回复阵从祭坛向己方扩张，赤线守住中心并封成血绊圣印"],f=>{f.fireDance(f.from,f.to,0,2450,"attack");f.title("血绊之契","十六脉祈愿 · BANISH 1 / LP +1600","#e5424f",190,1860)})},
    gallery_spell_037:{activate:scene("熏香花朵凌然绽放·四瓣往复",["熏香玫瑰从卡组上方抽芽，四张墓地卡带着不同花瓣印环绕花苞","花朵盛放并将四卡按顺时针顺序送入卡组底","两张新光卡从花心并肩绽出，尾声收成四瓣双光花印"],f=>{f.fireDance(f.from,f.to,0,2450,"attack");f.title("熏香花朵凌然绽放","四瓣往复 · RETURN 4 / DRAW 2","#ee9cab",190,1860)})},
    gallery_spell_038:{activate:scene("檐下和鸣·雨铃双笺",["雨中神社屋檐亮起，檐铃把水滴敲成蓝色音符","墓地的一张怪兽卡从水镜中升起并由金蓝和声送回手中","檐铃再落下一张新光卡，两张卡在水心护环中收束为双音印"],f=>{f.fireDance(f.from,f.to,0,2400,"attack");f.title("檐下和鸣","雨铃双笺 · RECOVER 1 / DRAW 1","#82d9ff",185,1820)})},
    gallery_spell_039:{activate:scene("檐下糯缘·糯猫守门",["暖檐门与茶杯升起，糯米白带在蒸汽中揉成小猫替身","糯猫抱着圆盾以守备姿态落位，五枚赤珠与八枚蓝珠分别确认攻守","破碎祭品冠盖下禁止印，最终收成门杯糯猫缘印"],f=>{f.fireDance(f.from,f.to,0,2300,"attack");f.title("檐下糯缘","糯猫守门 · TOKEN 500/800","#c7df9d",180,1750)})},
    gallery_spell_040:{activate:scene("以乐曲镌刻的青春邀约·五声选奏",["青春谱环展开，五张乐器候选卡组成五角舞台","金星指挥依次试听，选中的麦克风卡升为金色并沿副歌轨道进入手牌","余下四张按演奏顺序回到底部，尾声收成五星谱号印"],f=>{f.fireDance(f.from,f.to,0,2400,"attack");f.title("以乐曲镌刻的青春邀约","五声选奏 · SELECT 1 OF 5","#83d9ff",185,1820)})},
    gallery_spell_041:{activate:scene("以彭格列之焰起誓的家族盟约·家徽守阵",["橙色死气之炎点燃家族冠徽，一张五星以下手牌投入炎门","家族指环围绕光体完成伙伴轮廓，伙伴持盾以守备姿态落位","灰链封住本回合效果，三枚翠色生命火回流并封成家徽盾印"],f=>{f.fireDance(f.from,f.to,0,2450,"attack");f.title("以彭格列之焰起誓的家族盟约","家徽守阵 · SUMMON / NEGATE / HEAL","#ff8b45",190,1860)})},
    gallery_spell_042:{activate:scene("以青春执笔的相逢誓约·十景择色",["深蓝速写本打开，画笔沿墨路带出两排各五张候选画卡","笔锋逐张着色，选中的海景卡被珊瑚心印确认并飞入手牌","余下九张按原顺序化作墨旋回到卡组底，尾声留下十点笔心印"],f=>{f.fireDance(f.from,f.to,0,2500,"attack");f.title("以青春执笔的相逢誓约","十景择色 · SELECT 1 OF 10","#7189ba",195,1900)})},
    gallery_spell_043:{activate:scene("樱下相邀·六瓣择缘",["月下樱枝掀开邀请笺，六张候选卡沿花瓣风弧依次显形","玫瑰金缎带锁定选中的一张并将其送入手牌","其余五张随樱旋按原序回到卡组底，目标处合成樱花双结印"],f=>{f.fireDance(f.from,f.to,0,2350,"attack");f.title("樱下相邀","六瓣择缘 · SELECT 1 OF 6","#ff9cbc",180,1800)})},
    gallery_spell_044:{activate:scene("游缘升契·旅伴成形",["象牙骰穿过青蓝旅门，金币与地图轨道向中心收拢","旅缘光点构筑700/700的随行衍生物并落入目标怪兽区","王冠被禁祭锁链封住，明确显示本回合不可作为祭品"],f=>{f.fireDance(f.from,f.to,0,2250,"attack");f.title("游缘升契","旅伴衍生物 · 700 / 700","#55dff2",170,1750)})},
    gallery_spell_045:{activate:scene("有限时光里缔结的永恒回忆·二页沉忆",["停摆怀表裂成暖色记忆相框，卡组顶端浮出两张光卡","两张卡化作纸羽沿紫色弧线沉入墓地入口","永恒环与心印在落点闭合，逐张对应送墓结算"],f=>{f.fireDance(f.from,f.to,0,2300,"attack");f.title("有限时光里缔结的永恒回忆","二页沉忆 · MILL 2","#c88dff",180,1800)})},
    gallery_spell_046:{activate:scene("于黄昏废墟缔结的弑恶之誓·四影放逐",["血橙黄昏照亮废墟，银色誓剑从光柱中坠下","对方墓地最近四张卡升起并被四道交错剑光逐一切离","黑红放逐门吞没四影，目标处留下紧凑的剑誓封印"],f=>{f.fireDance(f.from,f.to,0,2400,"attack");f.title("于黄昏废墟缔结的弑恶之誓","四影放逐 · BANISH 4","#ff6a32",185,1850)})},
    gallery_spell_047:{activate:scene("于终末黄昏寻求新生的誓约·双生守备",["破碎终末天际中张开青绿莲形新生门","两张低等级怪兽卡横向复苏到守备位，并被灰白静默印封住效果","三道暖光回到己方生命槽，完成300点回复"],f=>{f.fireDance(f.from,f.to,0,2450,"attack");f.title("于终末黄昏寻求新生的誓约","双生守备 · 效果无效 · LP +300","#62e6d0",190,1900)})},
    gallery_spell_048:{activate:scene("御主与从者的盟约·令印应召",["三弧红色令印在盟约纸上点燃，蓝色召唤阵回应剑光","一张五星以下怪兽从手牌横向落入守备位","灰色封效环扣住卡框，六束金光回流完成600点回复"],f=>{f.fireDance(f.from,f.to,0,2400,"attack");f.title("御主与从者的盟约","守备应召 · 效果无效 · LP +600","#df3f55",185,1850)})},
    gallery_spell_049:{activate:scene("众伴同旅·群星成伴",["星夜旅路从发动点向目标弯曲，多色伙伴灯依次加入","所有同行轨迹编成900/600的旅伴衍生物徽记","银色禁祭扣锁在徽记外圈，显示本回合不可作为祭品"],f=>{f.fireDance(f.from,f.to,0,2250,"attack");f.title("众伴同旅","旅伴衍生物 · 900 / 600","#62d9ff",170,1750)})},
    gallery_spell_050:{activate:scene("追寻归属的羁绊誓约·归途三响",["靛蓝归家门在红线之环中开启，两张除外卡沿双缎带回到手牌","卡组再升起一张新卡完成抽取","三枚绿金心光回流生命槽，归家形羁绊印在落点闭合"],f=>{f.fireDance(f.from,f.to,0,2450,"attack");f.title("追寻归属的羁绊誓约","回收 2 · 抽 1 · LP +300","#e276a1",190,1900)})},
    gallery_spell_058:{activate:scene("草野闲奏·双谱归手",["千点生命化作深红节拍，草野与木吉他的暖光随和弦展开","两张低等级墓地卡沿两道绿金谱带回到手牌","风压倒草尖，叶形高音谱号在发动点收束"],f=>{f.fireDance(f.from,f.to,0,2300,"attack");f.title("草野闲奏","LP -1000 · 回收 2","#a8d55f",175,1800)})},
    gallery_spell_061:{activate:scene("街角的温柔日常·灯窗归页",["千点生命化作雨夜红环，街角灯窗与热饮蒸汽亮起","两张墓地卡从倒影中温和上升回到手牌","卡组再送出一张新卡，窗光折成小型归家心印"],f=>{f.fireDance(f.from,f.to,0,2350,"attack");f.title("街角的温柔日常","LP -1000 · 回收 2 · 抽 1","#f0ad70",180,1850)})},
    gallery_spell_062:{activate:scene("涟声合奏·双色回响",["千点生命凝成红色起拍，两圈水波击中漂浮谱线","两种属性光流并奏，卡组的两张光卡随涟漪送入手牌","三枚青绿音符回流生命槽，完成300点回复"],f=>{f.fireDance(f.from,f.to,0,2400,"attack");f.title("涟声合奏","LP -1000 · 抽 2 · LP +300","#55dce8",185,1850)})},
    gallery_spell_066:{activate:scene("心印同框·八千年的契约·三线归框",["千点生命化作深红心搏，古老钟框与封缄信笺同时显影","三张除外卡分别被三道金红心线捕获并穿过相框门","三卡依次回到手牌，八千年心印压在发动点"],f=>{f.fireDance(f.from,f.to,0,2400,"attack");f.title("心印同框·八千年的契约","LP -1000 · 回收 3","#d7a34e",185,1850)})},
    gallery_spell_067:{activate:scene("星轨重逢·胜利之誓·七星择冠",["千点生命化成七点星轨，卡组顶七张候选卡沿轨道显形","冠剑光选中其中一张送入手牌，其余六张按序折返卡组底","胜利誓约星座在发动点完成闭环"],f=>{f.fireDance(f.from,f.to,0,2450,"attack");f.title("星轨重逢·胜利之誓","LP -1000 · SELECT 1 OF 7","#79bfff",190,1900)})},
    gallery_spell_068:{activate:scene("星界瞬刻·目标时锁",["千点生命触发星界钟停，蓝白裂星线直达指定怪兽","晶体眼印将目标横置冻结，攻击力下降轨迹清晰落下","三枚刻度碎片锁定-300，时锁封印紧贴目标收束"],f=>{f.fireDance(f.from,f.to,0,2250,"attack");f.title("星界瞬刻","守备冻结 · ATK -300","#8fbfff",170,1750)})},
    gallery_spell_069:{activate:scene("异世残绪·裂界归痕",["千点生命撕开月下异世门，信纸碎片沿裂隙翻飞","三张除外卡拖着淡羽轨迹依次返回手牌","三枚绿光回到生命槽，月函封印缝合裂界"],f=>{f.fireDance(f.from,f.to,0,2400,"attack");f.title("异世残绪","LP -1000 · 回收 3 · LP +300","#a68ed8",185,1850)})},
    gallery_spell_070:{activate:scene("樱时之契·和服共舞·双彩回旋",["千点生命化作樱红腰带，两种属性光流绕带共舞","卡组两张光卡随双扇轨迹进入手牌","六瓣暖樱回流生命槽，完成600点回复并结成樱扇契印"],f=>{f.fireDance(f.from,f.to,0,2450,"attack");f.title("樱时之契·和服共舞","LP -1000 · 抽 2 · LP +600","#ff91b8",190,1900)})},
    source_spell_021:{activate:scene("冰原双天鹅的星咏·双翼冰锁",["千点生命在月照冰原上扩散，双天鹅交翼奏出霜星","目标怪兽被横向防御冰晶包裹并冻结行动","五道冰刻压下500攻击，双鹅雪印紧贴目标闭合"],f=>{f.fireDance(f.from,f.to,0,2300,"attack");f.title("冰原双天鹅的星咏","LP -1000 · 冻结 · ATK -500","#9eeaff",175,1800)})},
    source_spell_022:{activate:scene("杖与剑的契约·双环守召",["千点生命点燃象牙法杖与钢剑交叉契印","两环召唤阵从手牌引出二星以下怪兽并横置为守备","灰白静默符锁住其效果，杖剑徽记在落点收束"],f=>{f.fireDance(f.from,f.to,0,2250,"attack");f.title("杖与剑的契约","LP -1000 · 守备应召 · 效果无效","#dce9ff",170,1750)})},
    picture_ex_019: {
        source:"https://www.youtube.com/watch?v=3Ubt713gmBE",
        note:"角色与招式依据官方《火之神血风谭》角色演示核对；镜头和粒子为本项目原创游戏化演绎。",
        summon:scene("火之神神乐·圆舞", ["暗场中日轮吐息", "神乐火环绕身成形", "炭治郎踏火落位"], f => {
            f.fireDance(f.from,f.from,0,1050,"summon");
            f.wash("#140603",0,760,.72); f.line(f.offset(f.from,0,-145),f.offset(f.from,0,55),"#fff0bd",5,360,360);
            f.title("火之神神乐","圆舞 · HINOKAMI KAGURA","#ffb44f",250,900);
        }),
        attack:Object.assign(scene("火之神神乐·碧罗之天", ["压低身位蓄势", "火轮沿刀路完整成圆", "斩线穿越目标后爆燃"], f => {
            f.fireDance(f.from,f.to,0,1320,"attack");
            f.wash("#090203",0,1120,.58);
            f.title("火之神神乐","碧罗之天","#ffac45",360,900);
        }),{cues:[{symbol:"sword",motion:"cast"},{symbol:"flame",motion:"cross"}]}),
        destroy:scene("余火·日轮不灭", ["刀火迸裂", "余烬逆风上升", "日轮纹在暗处熄灭"], f => {
            f.fireDance(f.from,f.from,0,980,"destroy");
            f.wash("#130506",0,760,.48); f.title("余火未熄","意志仍将延续","#df6840",120,720);
        }),
    },
    picture_ex_027: {
        ...CARD_STORYBOARDS.picture_ex_027,
        source:"https://kimetsu.com/anime/risshihen/character/?chara=nezuko",
        note:"依据官方角色资料与爆血的血焰意象制作；逐帧血焰为本项目原创游戏化演绎。",
        summon:scene("血鬼术·爆血觉醒",["暗红血纹沿卡框苏醒","血焰向中心卷曲","粉白燃点完成显现"],f=>{f.wash("#16030b",0,760,.6);f.fireDance(f.from,f.from,0,980,"summon");f.title("血鬼术","爆血觉醒","#ff5f8e",180,760)}),
        attack:Object.assign(scene("血鬼术·爆血",["血纹锁定目标","爆血在目标周围点燃","粉白焰心瞬间绽放"],f=>{f.wash("#120208",0,900,.42);f.fireDance(f.from,f.to,0,1100,"attack");f.title("血鬼术","爆血","#ff4f83",210,760)}),{cues:[{symbol:"flame",motion:"cast"}]}),
        destroy:scene("血焰残响",["爆血焰心破碎","暗红血焰向内塌缩","余温在卡框熄灭"],f=>{f.wash("#100208",0,760,.4);f.fireDance(f.from,f.from,0,900,"destroy");f.title("血焰残响","羁绊不灭","#c93662",120,680)}),
    },
    picture_ex_021: {
        ...CARD_STORYBOARDS.picture_ex_021, source:"https://kimetsu.com/anime/risshihen/character/?chara=zenitsu",
        summon:scene("雷之呼吸·蓄势",["低位雷光压缩","足下刀光向前聚束","霹雳轨迹完成显现"],f=>{f.wash("#171203",0,700,.5);f.fireDance(f.from,f.from,0,850,"summon");f.title("雷之呼吸","壹之型 · 霹雳一闪","#ffe55d",130,680)}),
        attack:Object.assign(scene("霹雳一闪",["低姿蓄力锁定目标","单次高速雷切贯穿","金色刀痕在目标边缘闭合"],f=>{f.wash("#111006",0,820,.36);f.fireDance(f.from,f.to,0,900,"attack");f.title("雷之呼吸","霹雳一闪","#ffe45b",150,680)}),{cues:[{symbol:"bolt",motion:"cast"}]}),
        destroy:scene("雷痕消散",["雷切失去白热核心","金色刀痕逐段断开","残留电光贴近卡框熄灭"],f=>{f.wash("#100e04",0,660,.3);f.fireDance(f.from,f.from,0,760,"destroy");f.title("雷痕消散","再次沉入静息","#d8ba38",100,600)}),
    },
    picture_ex_029: {
        ...CARD_STORYBOARDS.picture_ex_029, source:"https://kimetsu.com/anime/risshihen/character/?chara=inosuke",
        summon:scene("兽之呼吸·獠牙出鞘",["双侧兽牙刀痕显现","锯齿斩轨交叉咬合","野性刀阵完成落位"],f=>{f.wash("#07121a",0,700,.42);f.fireDance(f.from,f.from,0,900,"summon");f.title("兽之呼吸","獠牙出鞘","#bdeeff",140,680)}),
        attack:Object.assign(scene("兽牙·乱裂",["双刀从相反方向切入","锯齿刀痕在目标外圈交叉","空间被野性斩轨撕开"],f=>{f.wash("#061018",0,820,.32);f.fireDance(f.from,f.to,0,960,"attack");f.title("兽之呼吸","兽牙 · 乱裂","#c8f2ff",160,700)}),{cues:[{symbol:"claw",motion:"cross"}]}),
        destroy:scene("兽牙崩解",["交叉刀痕失去锋芒","锯齿边缘向外断裂","墨蓝残痕贴卡消散"],f=>{f.wash("#061019",0,660,.3);f.fireDance(f.from,f.from,0,780,"destroy");f.title("兽牙崩解","野性暂歇","#91b9ca",100,600)}),
    },
    picture_ex_025: {
        ...CARD_STORYBOARDS.picture_ex_025, source:"https://kimetsu.com/anime/risshihen/character/?chara=giyuu",
        summon:scene("水之呼吸·水车",["静水纹从足下升起","浪峰绕卡框完成水车","白色浪沫收束落位"],f=>{f.wash("#031322",0,740,.46);f.fireDance(f.from,f.from,0,960,"summon");f.title("水之呼吸","贰之型 · 水车","#76d9ff",150,720)}),
        attack:Object.assign(scene("水之呼吸·水车",["水纹沿刀锋加速","水车围绕目标完整回旋","浪峰从目标边缘斩落"],f=>{f.wash("#03111f",0,850,.34);f.fireDance(f.from,f.to,0,1020,"attack");f.title("水之呼吸","水车","#70d7ff",170,720)}),{cues:[{symbol:"water",motion:"orbit"}]}),
        destroy:scene("静水归流",["浪峰失去冲力","水车降低为平静涟漪","最后一圈水纹贴卡退去"],f=>{f.wash("#03101c",0,700,.3);f.fireDance(f.from,f.from,0,840,"destroy");f.title("静水归流","止水无声","#6eaec7",110,620)}),
    },
    picture_ex_030: {
        ...CARD_STORYBOARDS.picture_ex_030, source:"https://kimetsu.com/anime/risshihen/character/?chara=rengoku",
        summon:scene("炎之呼吸·不知火",["赤焰沿刀锷点燃","金红炎轨绕卡升起","炎柱踏火完成落位"],f=>{f.wash("#190704",0,720,.5);f.fireDance(f.from,f.from,0,940,"summon");f.title("炎之呼吸","壹之型 · 不知火","#ffb54b",140,720)}),
        attack:Object.assign(scene("炎之呼吸·炎虎",["刀锋压缩金红烈焰","炎虎沿斩击轨迹扑向目标","獠牙状火弧在目标边缘咬合"],f=>{f.wash("#170603",0,850,.38);f.fireDance(f.from,f.to,0,1040,"attack");f.title("炎之呼吸","伍之型 · 炎虎","#ffae3d",170,760)}),{cues:[{symbol:"sword",motion:"cast"},{symbol:"flame",motion:"cross"}]}),
        destroy:scene("炎心余烬",["炎虎轮廓崩散","金红火舌向刀锷回卷","最后一线炎光贴卡熄灭"],f=>{f.wash("#120403",0,680,.32);f.fireDance(f.from,f.from,0,820,"destroy");f.title("炎心余烬","燃烧的意志仍在延续","#d86b30",100,620)}),
    },
    picture_ex_024: {
        ...CARD_STORYBOARDS.picture_ex_024, source:"https://kimetsu.com/anime/risshihen/character/?chara=shinobu",
        summon:scene("虫之呼吸·蝶之舞",["紫藤毒光沿蝶翼展开","细刃轨迹从翼心穿出","蝶影合拢完成落位"],f=>{f.wash("#10071d",0,700,.42);f.fireDance(f.from,f.from,0,900,"summon");f.title("虫之呼吸","蝶之舞 · 戏弄","#d9a7ff",140,700)}),
        attack:Object.assign(scene("虫之呼吸·蜂牙之舞",["针锋凝聚紫藤毒素","细直突刺高速贯穿目标","蝶翼毒纹在命中处绽开"],f=>{f.wash("#0e0719",0,800,.3);f.fireDance(f.from,f.to,0,940,"attack");f.title("虫之呼吸","蜂牙之舞 · 真曳","#dfa9ff",150,720)}),{cues:[{symbol:"sword",motion:"cast"}]}),
        destroy:scene("蝶影归藤",["毒刃光失去锋线","蝶翼弧向中心折叠","紫藤余光贴近卡框消散"],f=>{f.wash("#0d0617",0,650,.28);f.fireDance(f.from,f.from,0,780,"destroy");f.title("蝶影归藤","轻羽无声","#a97bce",90,600)}),
    },
    picture_ex_026: breathingScenes("风之呼吸","旋风起势","旋风斩","风刃散华","#b8ffd2",[820,900,720]),
    picture_ex_031: breathingScenes("风之呼吸","风柱临阵","壹之型·尘旋风·削斩","风柱止息","#a6f5c3",[900,980,760]),
    picture_ex_040: breathingScenes("稀血觉醒","血风聚刃","稀血·狂风刃","稀血消散","#d7ffdd",[940,1040,800]),
    picture_ex_058: breathingScenes("风之呼吸","黑风压境","黑风烟岚","烟岚崩解","#91dbae",[980,1100,850]),
    picture_ex_028: breathingScenes("霞之呼吸","霞幕初生","壹之型·垂天远霞","霞隐","#c9f4ff",[820,900,740]),
    picture_ex_036: breathingScenes("霞之呼吸","月下霞生","月下霞斩","月影归霞","#bdeaff",[900,980,780]),
    picture_ex_049: breathingScenes("霞之呼吸","无相起势","柒之型·胧","胧散","#d9f8ff",[960,1080,820]),
    picture_ex_066: breathingScenes("霞之呼吸","水月映霞","水月霞","水月无痕","#a8e8f3",[1000,1120,860]),
    picture_ex_022: breathingScenes("恋之呼吸","恋刃舒展","壹之型·初恋的战栗","恋刃回旋","#ff86bd",[820,920,720]),
    picture_ex_038: breathingScenes("恋之呼吸","恋柱登场","伍之型·摇摆不定的恋情·乱爪","恋心未熄","#ff77b1",[900,1020,780]),
    picture_ex_045: breathingScenes("恋之呼吸","猫足蓄势","陆之型·猫足恋风","恋风收束","#ff91c7",[940,1060,800]),
    picture_ex_064: breathingScenes("恋之呼吸","柔刃摇曳","摇曳恋情·连斩","恋情余韵","#ff6cac",[980,1120,840]),
    picture_ex_032: breathingScenes("音之呼吸","双刀鸣动","壹之型·轰","余音收束","#ffb14a",[860,960,740]),
    picture_ex_039: breathingScenes("音之呼吸","谱面展开","谱面完成·节奏斩","谱面终止","#ff77bf",[940,1060,800]),
    picture_ex_047: breathingScenes("音之呼吸","双刀交响","双刀爆裂","爆音余响","#ff9a45",[980,1100,830]),
    picture_ex_067: breathingScenes("音之呼吸","华丽开幕","爆音斩·连奏","祭典落幕","#ffc05b",[1020,1160,860]),
    picture_ex_023: breathingScenes("岩之呼吸","岩躯镇地","壹之型·蛇纹岩·双极","岩阵归寂","#d9ae72",[880,1000,780]),
    picture_ex_041: breathingScenes("岩之呼吸","念珠结界","南无阿弥陀佛·岩轮","念珠静止","#e2bd82",[940,1060,820]),
    picture_ex_052: breathingScenes("岩之呼吸","岩躯不动","岩躯·碎岳","岩躯沉降","#c99b61",[980,1100,840]),
    picture_ex_061: breathingScenes("岩之呼吸","石肤镇守","石肤·铁链轮转","石肤崩解","#b98b55",[1020,1160,880]),
    picture_ex_020: breathingScenes("蛇之呼吸","蛇刃蜿蜒","壹之型·委蛇斩","蛇影退鳞","#d7c8ff",[840,940,740]),
    picture_ex_034: breathingScenes("蛇之呼吸","蛇柱临阵","贰之型·狭头之毒牙","蛇柱潜行","#cbb7ff",[900,1020,780]),
    picture_ex_053: breathingScenes("蛇之呼吸","月夜盘蛇","月夜蛇行","月蛇归影","#bfa8ef",[960,1080,820]),
    picture_ex_069: breathingScenes("蛇之呼吸","蜿蜒起势","蜿蜒蛇行·连牙","蛇痕消隐","#d8c4ff",[1000,1140,860]),
    picture_ex_042: breathingScenes("破坏杀","罗针展开","空式·乱式","斗气崩散","#5bd4ff",[940,1080,820]),
    picture_ex_056: breathingScenes("破坏杀","术式展开·罗针","终式·青银乱残光","罗针熄灭","#42c6ff",[1040,1200,900]),
    picture_ex_055: breathingScenes("血鬼术","寒夜冰莲","寒夜莲华·散冰","冰莲碎华","#dff7ff",[980,1140,860]),
    picture_ex_068: breathingScenes("月之呼吸","月虹显现","拾陆之型·月虹·片割月","月轮崩散","#f0ba61",[1060,1240,920]),
    picture_ex_044: breathingScenes("日之呼吸","日轮初升","十三之型·日轮连斩","日轮余辉","#ff9a40",[1080,1260,940]),
    picture_ex_033: breathingScenes("水之呼吸","水柱静立","拾壹之型·凪","止水归静","#70d7ff",[900,1020,780]),
    picture_ex_043: breathingScenes("水之呼吸","水面起势","壹之型·水面斩","水痕消退","#79dcff",[880,980,760]),
    picture_ex_062: breathingScenes("水之呼吸","水龙盘旋","拾之型·生生流转","水龙散华","#65d9ff",[1020,1160,860]),
    picture_ex_035: breathingScenes("炎之呼吸","炎柱临阵","肆之型·盛炎之涡卷","炎柱余烬","#ff9a3d",[920,1040,800]),
    picture_ex_050: breathingScenes("炎之呼吸","奥义蓄势","奥义·玖之型·炼狱","炎虎散华","#ffb14c",[1080,1260,940]),
    picture_ex_054: breathingScenes("炎之呼吸","炎心不灭","炎心·燃魂斩","炎心余辉","#ff8735",[980,1120,840]),
    picture_ex_063: breathingScenes("炎之呼吸","炼狱显现","炼狱·终焰","炼狱余火","#ffc05b",[1060,1220,920]),
    picture_ex_037: breathingScenes("虫之呼吸","紫藤毒雾","蜂牙之舞·真曳","紫藤残香","#d79cff",[900,1020,780]),
    picture_ex_046: breathingScenes("虫之呼吸","百足起势","蜈蚣之舞·百足蛇腹","百足退影","#ca8cff",[960,1100,820]),
    picture_ex_057: breathingScenes("虫之呼吸","蝶影藏刃","蝶影毒刃·复眼六角","蝶毒散华","#e0abff",[1020,1160,860]),
    picture_ex_048: breathingScenes("雷之呼吸","雷神蓄势","柒之型·火雷神","雷龙消隐","#ffe35a",[1020,1160,860]),
    picture_ex_070: breathingScenes("雷之呼吸","万钧聚雷","雷霆万钧·神速","雷鸣止息","#fff075",[1080,1240,920]),
    picture_ex_051: breathingScenes("兽之呼吸","空间感知","柒之牙·空间识觉","兽感平息","#bdeeff",[900,1020,780]),
    picture_ex_059: breathingScenes("兽之呼吸","双刀獠牙","兽牙乱舞","兽牙崩解","#c8f2ff",[1000,1140,850]),
    picture_ex_065: breathingScenes("日之呼吸","赤月神乐","赤月神乐·圆舞","赤月余火","#ff7040",[1040,1200,900]),
    picture_ex_073: breathingScenes("白眼","八卦阵展开","八卦掌·回天","查克拉归脉","#d9d2ff",[900,1040,800],NARUTO_SOURCE),
    picture_ex_074: breathingScenes("万花筒写轮眼","鸦影幻术","须佐鸦影·十拳斩","鸦羽归瞳","#ff4052",[1040,1200,900],NARUTO_SOURCE),
    picture_ex_075: breathingScenes("轮回眼","引力锁定","神罗天征","斥力消散","#b980ff",[1020,1180,880],NARUTO_SOURCE),
    picture_ex_076: breathingScenes("水遁","水阵凝形","水龙弹·高速切流","水纹归流","#61d8ff",[920,1080,820],NARUTO_SOURCE),
    picture_ex_077: breathingScenes("须佐能乎","紫铠显现","须佐之箭·千鸟贯穿","紫铠消散","#9b65ff",[1040,1220,900],NARUTO_SOURCE),
    picture_ex_078: breathingScenes("雷切","雷核压缩","雷切·贯手","雷痕断灭","#4bc8ff",[900,1040,800],NARUTO_SOURCE),
    picture_ex_079: breathingScenes("百豪之术","百豪印解放","怪力·地裂拳","百豪归印","#70ffa2",[940,1100,840],NARUTO_SOURCE),
    picture_ex_072: breathingScenes("死亡回归","禁忌时钟","死亡回归·检查点重置","时间线闭合","#d1435d",[1020,1180,880],"https://re-zero-anime.jp/"),
    picture_ex_080: breathingScenes("雨夜狙击","雨幕校准","静默音轨·精准射击","雨声渐止","#79ceff",[920,1060,820],null),
    picture_ex_011: breathingScenes("白金之星","精密显现","欧拉连打","星芒收拳","#b08aff",[960,1120,840],"https://jojo-portal.com/anime/sc/character/01/"),
    picture_ex_012: breathingScenes("杀手皇后","第一爆弹装填","触碰爆破","爆痕抹除","#ff62bd",[980,1140,860],"https://jojo-portal.com/"),
    picture_ex_013: breathingScenes("THE WORLD","时间停止","时停飞刀·世界","时间复流","#ffd466",[1040,1200,900],"https://jojo-portal.com/"),
    picture_ex_014: breathingScenes("性感手枪","六弹列阵","弹道折射·齐射","弹壳落幕","#ffbd4f",[900,1060,800],"https://jojo-portal.com/anime/gw/character/03/"),
    picture_ex_015: breathingScenes("钢铁蔷薇","蔷薇旋转","幸运屏障·钢铁花环","花瓣归钢","#ffd27a",[920,1080,820],"https://jojo-portal.com/"),
    picture_ex_016: breathingScenes("奶油启动器","修复喷流","奶油织带·重构","织带收束","#ffc0cb",[900,1040,800],"https://jojo-portal.com/"),
    picture_ex_017: breathingScenes("骇人恶兽","恐龙化觉醒","迅猛龙·猎杀撕咬","鳞爪退化","#b2e84f",[960,1120,840],"https://jojo-portal.com/"),
    picture_ex_018: breathingScenes("爱之列车","次元壁开启","爱之列车·厄运转移","次元闭合","#ffd466",[1040,1220,900],"https://jojo-portal.com/"),
    picture_ex_081: breathingScenes("飞雷神","九喇嘛连结","黄金闪光·螺旋丸","术式闪灭","#ffd54f",[1020,1180,880],NARUTO_SOURCE),
    picture_ex_082: breathingScenes("橙梦舞台","暖光开幕","橙梦舞台·聚光回旋","帷幕落光","#ffad66",[900,1040,800],null),
    picture_ex_083: breathingScenes("海月幻梦","月海浮游","海月幻梦·潮汐脉冲","海月归潮","#8ddcff",[920,1060,820],null),
    picture_ex_084: breathingScenes("青瓷流云","釉云聚墨","青瓷流云·玉带回环","流云收笔","#91c9ad",[900,1040,800],null),
    picture_ex_085: breathingScenes("静默旋律","无声谱线","静默旋律·碎音环","旋律归零","#aabfff",[920,1060,820],null),
    picture_ex_086: breathingScenes("雪原白夜","雪音初落","白夜旋律·雪环","雪线消融","#d9f4ff",[940,1080,820],null),
    picture_ex_087: breathingScenes("迷途画境","炭线起稿","迷途画境·裂帛","颜料褪尽","#e63b65",[940,1080,820],null),
    picture_ex_088: breathingScenes("蓝蔷薇","蔷薇序曲","蓝蔷薇·棘冠乐章","花瓣静止","#315cff",[960,1100,840],null),
    picture_ex_089: breathingScenes("粉黛之心","缎带裁形","粉黛之心·缝光","心结收束","#ff80bd",[900,1040,800],null),
    picture_ex_090: breathingScenes("堕天使夜羽","逆光降临","夜羽·堕天圆舞","黑羽归环","#a85cff",[980,1120,850],null),
    picture_ex_091: breathingScenes("水墨午后","墨弦落笔","水墨弦音·回锋","墨迹归纸","#91a579",[900,1040,800],null),
    picture_ex_092: breathingScenes("金叶跃动","低音起拍","金叶跃动·重拍","金叶落弦","#ffc94f",[920,1060,820],null),
    picture_ex_093: breathingScenes("绯线独奏","绯弦绷紧","绯线独奏·裂音","绯弦回振","#ff303f",[940,1080,820],null),
    picture_ex_094: breathingScenes("碧空旋律","晴空起奏","碧空旋律·升调","云线归晴","#61cfff",[920,1060,820],null),
    picture_ex_095: breathingScenes("海风浅笑","海风和弦","海风浅笑·潮声","潮线归平","#54d6dd",[900,1040,800],null),
    picture_ex_096: breathingScenes("坠空追风","低音坠势","坠空追风·落击","低频回弹","#ffad35",[960,1120,840],null),
    picture_ex_097: breathingScenes("素描沉思","铅线起稿","素描沉思·交错排线","纸屑归白","#b7aa91",[900,1040,800],null),
    picture_ex_098: breathingScenes("深海蓝影","蓝影下潜","深海蓝影·潮压重奏","深蓝退潮","#438bd5",[940,1080,820],null),
    picture_ex_099: breathingScenes("暖窗时光","窗光初照","暖窗时光·日色回旋","余晖合窗","#ffbd73",[900,1040,800],null),
    picture_ex_100: breathingScenes("缤纷节拍","彩拍预备","缤纷节拍·虹光切分","彩音收束","#ff65bc",[940,1080,820],null),
    picture_ex_101: breathingScenes("深海回响","潮声采样","深海回响·双尾声波","回声沉潜","#28e6e0",[960,1120,840],null),
    picture_ex_102: breathingScenes("原子裁决","原子核聚合","I AM ATOMIC·裁决斩","核光归零","#8d4cff",[1040,1220,900],null),
    picture_ex_103: breathingScenes("终焉权能","暗影日蚀","终焉权能·四极闭锁","权能归影","#7a37d9",[1060,1240,920],null),
    picture_ex_104: breathingScenes("暗夜血刃","黑赤魔力显锋","暗夜血刃·断罪","血刃熄灭","#f01835",[1000,1180,880],null),
    picture_ex_105: breathingScenes("绯狱复仇","绯链成狱","绯狱复仇·锁剑穿心","绯链断解","#ff2446",[1040,1220,900],null),
    picture_ex_106: breathingScenes("黄昏断罪","风王结界解放","黄昏断罪·圣剑裁光","暮光归鞘","#ffd36a",[1020,1200,900],null),
    picture_ex_107: breathingScenes("苍穹音浪","晴空开声","苍穹音浪·云谱脉冲","音轨归晴","#62eaff",[940,1100,820],null),
    picture_ssr7_001: breathingScenes("白庭双生·终幕","双生花开幕","终幕·双绫交斩","花幕闭合","#f3d9a5",[980,1140,860],null),
    picture_ssr7_002: breathingScenes("粉樱星轨","樱星入轨","粉樱星轨·彗花","星樱退轨","#ff91bd",[940,1100,820],null),
    picture_ssr7_003: breathingScenes("深海夜宴","腐海睁瞳","深海夜宴·潮压噬咬","宴潮沉没","#1ab7bd",[1020,1180,880],null),
    picture_ssr7_004: breathingScenes("曦火晨祷","圣焰合掌","晨祷·六芒曦光","曦火闭蕊","#ffd095",[980,1140,860],null),
    picture_ssr7_005: breathingScenes("星海镜音","双镜共鸣","星海镜音·折射","镜潮沉音","#5be8ed",[1000,1160,860],null),
    picture_ssr7_006: breathingScenes("霜海凛冬","冰潮成冠","霜海凛冬·压冻","冰冠沉海","#9fe9ff",[1000,1160,860],null),
    picture_ssr7_007: breathingScenes("熔核烈歌","玄岩启刃","熔核烈歌·断岳","熔核冷却","#ff571c",[1020,1200,900],null),
    picture_ssr7_008: breathingScenes("焰星旅者","四叶引信","蹦蹦炸弹·焰星绽放","焰星收烟","#ff8244",[940,1100,820],null),
    picture_ssr7_009: breathingScenes("青月人偶","银弦悬月","青月人偶·交弦斩","月偶断弦","#91b8ff",[980,1140,860],null),
    picture_ssr7_010: breathingScenes("超电磁炮","硬币校轨","超电磁炮·轨道贯穿","电轨失谐","#71b7ff",[960,1120,840],null),
    picture_ssr7_011: breathingScenes("冰冠龙姬","苍鳞成冠","冰息龙枪·苍鳞噬","龙冠解鳞","#8edcff",[980,1140,860],null),
    picture_ssr7_012: breathingScenes("黑潮双刃","双刃出潮","黑潮双刃·交汐","双刃退潮","#21aeb1",[1000,1160,860],null),
    picture_ssr7_013: breathingScenes("红莲铳火","六铳入环","红莲铳火·齐射","红莲退膛","#ff4b56",[960,1120,840],null),
    picture_ssr7_014: breathingScenes("星屑天幕","源石成幕","星屑天幕·折晶射线","天幕归晶","#9a8eff",[980,1140,860],null),
    picture_ssr7_015: breathingScenes("炎锯镇岳","锯齿升温","炎锯镇岳·断轮","炎锯冷却","#ff5b1f",[1000,1180,880],null),
    picture_ssr7_016: breathingScenes("赤痕爆破","三点布雷","赤痕爆破·连锁起爆","赤痕解除","#ff3348",[980,1140,860],null),
    picture_ssr7_017: breathingScenes("鸦羽夜祷","三羽成祷","夜祷·鸦羽回锋","祷环熄月","#ac83ef",[960,1120,840],null),
    picture_ssr7_018: breathingScenes("天狼机巧","机牙组装","苍牙·涡轮噬咬","机牙解锁","#54d9ff",[980,1140,860],null),
    picture_ssr7_019: breathingScenes("圣辉金律","天平立律","金律·圣辉裁决","律印归衡","#ffd57c",[1000,1160,860],null),
    picture_ssr7_020: breathingScenes("六花联奏","六音调律","虹誓·六花合奏","六音静默","#fff0c2",[1020,1180,880],null),
    picture_ssr7_021: breathingScenes("金羽龙骑","金羽成枪","破晓·龙枪贯日","金羽归晓","#ffd36b",[1000,1180,880],null),
    picture_ssr7_022: breathingScenes("白狐剑巫","狐面启刃","千刃·狐尾交斩","千刃归一","#b9dbff",[980,1140,860],null),
    picture_ssr7_023: breathingScenes("静默阶梯","阶梯升光","静默阶梯·矩形静场","门光闭合","#4f8eea",[920,1080,820],null),
    picture_ssr7_024: breathingScenes("金庭夜曲","金庭开匣","夜曲·蓝蔷薇和弦","金庭合匣","#ddb45d",[980,1140,860],null),
    picture_ssr7_025: breathingScenes("炎翼焚天","炎翼展开","焚天·俯冲裂空","炎翼冷却","#ff5a1f",[1020,1200,900],null),
    picture_ssr7_026: breathingScenes("粉色和弦","拨片调弦","粉色和弦·上行扫弦","和弦松弦","#ff78bd",[920,1080,820],null),
    picture_ssr7_027: breathingScenes("绯月血契","绯月缔约","血契·傀儡交缚","血契断线","#e72448",[1000,1160,860],null),
    picture_ssr7_028: breathingScenes("红棘荆冠","棘环成冠","荆冠·收束惩戒","荆冠解环","#e85964",[980,1140,860],null),
    picture_ssr7_029: breathingScenes("红棘终花","棘蕊初开","终花·贯刺绽放","终花合蕊","#ff5360",[1000,1180,880],null),
    picture_ssr7_030: breathingScenes("晴空舞台","云台升幕","晴空舞台·聚光节拍","云台落幕","#76ebff",[940,1100,820],null),
    picture_ssr7_031: breathingScenes("迷途之声","断弦浮现","迷途之声·低频回涡","断弦沉默","#3cc9cf",[940,1100,820],null),
    picture_ssr7_032: breathingScenes("沉默枷锁","银铐连弦","沉默枷锁·交弦闭锁","枷锁松弦","#b2b870",[960,1120,840],null),
    picture_ssr7_033: breathingScenes("Mortis镜像","双面合镜","Mortis·逆弦镜斩","镜像先逝","#a7eda4",[1000,1160,860],null),
    picture_ssr7_035: breathingScenes("牵绊丝线","双色结弦","牵绊丝线·双音结","双线缓释","#819cff",[960,1120,840],null),
    picture_ssr7_036: breathingScenes("自由即兴","猫爪试音","自由即兴·折线Riff","即兴收音","#a7ff32",[920,1080,820],null),
    picture_ssr7_037: breathingScenes("蝶舞清影","蝶翼启锋","虫之呼吸·蝶影突刺","蝶毒归点","#d4a8ff",[980,1140,860],KIMETSU_SOURCE),
    picture_ssr7_038: breathingScenes("Mortis礼装","礼花系结","Mortis·礼刃合幕","礼花闭蕊","#c4efb7",[980,1140,860],null),
    picture_ssr7_039: breathingScenes("疾走节拍","鼓环校拍","疾走节拍·三连击","节拍减速","#ff334c",[920,1080,820],null),
    picture_ssr7_040: breathingScenes("温柔低音","暖弦调音","温柔低音·守护共振","低音归静","#76d8c7",[920,1080,820],null),
    picture_ssr7_041: breathingScenes("不器用的真心","错拍对齐","真心·同频鼓动","心拍安定","#ff8c92",[940,1100,820],null),
    picture_ssr7_042: breathingScenes("迷茫独白","独白启声","迷茫独白·无答回音","独白消隐","#3cd5dd",[940,1100,820],null),
    picture_ssr7_043: breathingScenes("雪夜独奏","雪键升台","雪夜独奏·六键和弦","雪键落音","#a8c9ff",[960,1120,840],null),
    picture_ssr7_044: breathingScenes("无刺之歌","清声开花","无刺之歌·真声绽放","歌声归线","#9ed8ff",[940,1100,820],null),
    picture_ssr7_045: breathingScenes("月下礼装","月弦披纱","月下礼装·弦月合斩","月纱落幕","#e7d9a5",[960,1120,840],null),
    picture_ssr7_046: breathingScenes("雨中独奏","雨弦落拍","雨中独奏·水镜低音","雨声归静","#5b91ff",[940,1100,820],null),
    picture_ssr7_047: breathingScenes("赤轮剑影","源石剑启轮","赤轮剑影·圆环断罪","赤轮归晶","#ff3048",[1000,1180,880],null),
    picture_ssr7_048: breathingScenes("烛火键盘","蓝烛点键","烛火键盘·金色琶音","烛焰落键","#ffd477",[960,1120,840],null),
    picture_ssr7_049: breathingScenes("暗潮低音","暗潮起弦","暗潮低音·深潜重拍","暗潮退弦","#265d84",[960,1120,840],null),
    picture_ssr7_050: breathingScenes("微笑假面","假面系笑","微笑假面·弦刃反相","笑面褪色","#c6dda4",[980,1140,860],null),
    picture_ssr7_051: breathingScenes("疾风鼓点","风鼓起拍","疾风鼓点·四连风压","鼓风止拍","#6de0d5",[940,1100,820],null),
    picture_ssr7_052: breathingScenes("春雪","春枝承雪","春雪·融光六瓣","雪融归春","#f2d9eb",[940,1100,820],null),
    picture_ssr7_053: breathingScenes("红线残响","红线结晶","红线残响·源石回声","红线断响","#e9435e",[980,1140,860],null),
    picture_ssr7_054: breathingScenes("水镜","镜水成台","水镜·双音折射","镜水归平","#66e7eb",[960,1120,840],null),
    picture_ssr7_055: breathingScenes("花海共鸣","花音成环","花海共鸣·六瓣合声","花音归蕊","#ff93c8",[960,1120,840],null),
    picture_ssr7_056: breathingScenes("南瓜夜曲","夜灯启拍","南瓜夜曲·幽光切分","夜灯熄曲","#ff9b3e",[980,1140,860],null),
    picture_ssr7_057: breathingScenes("春日花冠","春冠编花","春日花冠·晴风和弦","花冠合拢","#a7e88b",[940,1100,820],null),
    picture_ssr7_058: breathingScenes("星月花嫁","星月披纱","星月花嫁·誓约共振","星纱落幕","#c9b6ff",[1000,1160,860],null),
    picture_ssr7_059: breathingScenes("苍银天穹","苍银结晶","苍银天穹·源石天矛","天穹归晶","#7fc7ff",[1020,1180,880],null),
    picture_ex_071: breathingScenes("矿洞小鼠","矿灯探路","碎石飞扑","钻入矿洞","#c7a36d",[700,820,680],null),
    picture_ex_060: {
        ...CARD_STORYBOARDS.picture_ex_060,
        source:"https://kimetsu.com/anime/risshihen/character/",
        summon:scene("水火轮转·呼吸切换", ["水纹先行展开", "水流沿圆弧升温", "蓝焰交界后落位"], f => {
            f.wash("#03111b",0,820,.55); f.ring(f.from,"#66dbff",100,0,760);
            f.path("M-145 26Q-70-95 2-8T145-22M-132 56Q-45-42 24 28T132 20",f.from,"#65d8ff",{rotate:-22,scale:.3,opacity:0},{rotate:16,scale:1,opacity:1},40,760);
            f.path("M-125 30C-72-92 70-99 130 6C66-31 12-18-8 30C-31 76-82 82-125 30Z",f.from,"#ff6a2d",{rotate:-55,scale:.2,opacity:0},{rotate:24,scale:.92,opacity:1},270,760);
            f.burst(f.from,"#fff0b5",10,115,520,360); f.title("火之神神乐","水火轮转","#8de8ff",220,850);
        }),
        attack:Object.assign(scene("水火轮转·生生流转", ["水龙轨迹加速", "刀路中段转为日轮火", "水火双弧夹击"], f => {
            f.wash("#041018",0,1050,.48); f.projectile(f.from,f.to,"#58d8ff",22,80,560,-105); f.projectile(f.from,f.to,"#ff5d28",26,310,500,95);
            f.trail(f.from,f.to,"#3dccff","#fff6c7",470,420,-72); f.burst(f.to,"#ff9b45",13,125,650,400); f.ring(f.to,"#6be1ff",96,620,430);
            f.title("水火轮转","生生流转","#8eeeff",250,850);
        }),{cues:[{symbol:"sword",motion:"cast"},{symbol:"water",motion:"wave"}]}),
        destroy:scene("呼吸中断·水火散华", ["蓝焰分离", "水珠与余烬向两侧散去", "中央刀光收束"], f => {
            f.burst(f.from,"#69dcff",10,115,0,650); f.burst(f.from,"#ff7134",10,135,100,650); f.line(f.offset(f.from,0,-90),f.offset(f.from,0,75),"#fff4d2",5,180,420);
        }),
    },
    picture_ssr7_034: {
        ...CARD_STORYBOARDS.picture_ssr7_034,
        source:"https://kimetsu.com/anime/risshihen/character/",
        summon:scene("水之呼吸·静水拔刀", ["水面涟漪铺开", "刀锋从浪纹中显现", "水沫收束于落位点"], f => {
            f.wash("#031321",0,760,.5); f.ring(f.from,"#79dcff",112,0,760);
            f.path("M-150 12Q-95-82-25-14T72-18T150-24M-145 44Q-70-35 0 32T145 18",f.from,"#62d6ff",{x:-45,scale:.35,opacity:0},{x:0,rotate:12,scale:1.05,opacity:1},80,780);
            f.line(f.offset(f.from,-52,45),f.offset(f.from,58,-58),"#e9fcff",6,340,380); f.burst(f.from,"#a8edff",11,110,460,340);
            f.title("水之呼吸","水面斩","#83dfff",220,820);
        }),
        attack:Object.assign(scene("水之呼吸·生生流转", ["水流缠绕刀身", "回旋次数逐段加速", "水龙头部咬合目标"], f => {
            f.wash("#02111d",0,1040,.48); f.ring(f.from,"#65d9ff",55,0,400,true);
            f.projectile(f.from,f.to,"#4acaff",25,170,560,-118); f.trail(f.from,f.to,"#28bce9","#ddfbff",360,480,-96);
            f.path("M-42 22C-22-24 16-34 39-10L24-4 43 11 26 8C12 39-18 42-42 22ZM24-4 36-22 49-6",f.to,"#7ee4ff",{rotate:-45,scale:.2,opacity:0},{rotate:18,scale:1.7,opacity:1},570,480);
            f.burst(f.to,"#c9f8ff",12,125,680,370); f.title("水之呼吸","拾之型 · 生生流转","#82e3ff",280,840);
        }),{cues:[{symbol:"sword",motion:"cast"},{symbol:"water",motion:"orbit"}]}),
        destroy:scene("水沫散华", ["水龙失去轮廓", "刀光碎成水滴", "涟漪归于平静"], f => {
            f.burst(f.from,"#70dfff",14,125,0,620); f.ring(f.from,"#b9f4ff",105,150,650); f.title("呼吸止息","流水终将再度汇聚","#83ddf4",100,680);
        }),
    },
    ygo_n_55144522: {
        source:official("pot-of-greed"),
        activate:scene("强欲之壶·贪欲开口", ["翡翠壶像占据画面", "黄金纹路沿笑口点亮", "两张光牌从壶中喷出"], f => {
            f.spellCinematic?.("greed",f.to,0,2350);
            f.title("强欲之壶","贪欲开口 · DRAW TWO","#9cff83",120,1900);
        }),
    },
    ygo_n_72302403: {
        source:official("swords-of-revealing-light"),
        activate:scene("光之护封剑·三剑镇锁", ["天幕裂开三道圣光", "巨剑依次贯入战场", "光之结界封锁攻击"], f => {
            f.spellCinematic?.("swords",f.to,0,2500);
            f.title("光之护封剑","三剑镇锁 · ATTACK SEALED","#fff0a6",160,2000);
        }),
    },
    ygo_n_4206964: {
        source:official("trap-hole"),
        activate:scene("落穴·地层陷落", ["锯齿裂缝撑开", "暗色坑洞出现", "岩片逐层坠入"], f => {
            f.disc(f.from,"#0c0806",82,100,800);
            f.path("M-100-10-73-39-31-26 0-44 40-23 74-30 100 7 78 37 31 28 0 46-38 26-80 30Z",f.from,"#c99560",{scale:.1,opacity:0},{scale:1,opacity:1},0,950);
            for(let i=0;i<6;i++) f.path("M-12-8 10-12 17 5 0 15-13 5Z",f.offset(f.from,(i-2.5)*27,0),"#b58a64",{y:-30,rotate:i*35,opacity:0},{y:70,scale:.1,rotate:i*65,opacity:1},170+i*65,530);
        }),
    },
    ygo_n_66788016: {
        source:official("fissure"),
        activate:scene("地裂·断层撕开", ["战场地表先行震动", "熔光裂隙贯穿目标", "岩层外翻后陷落"], f => {
            f.spellCinematic?.("fissure",f.to,0,2250);
            f.title("地裂","断层撕开 · FISSURE","#ffbd72",110,1750);
        }),
    },
    ygo_n_4031928: {
        source:official("change-of-heart"),
        activate:scene("心变·光暗易位", ["圣羽与暗翼分割画面", "两颗心跨越阵营交换", "契约印记在目标处闭合"], f => {
            f.spellCinematic?.("heart",f.to,0,2400);
            f.title("心变","光暗易位 · CHANGE OF HEART","#ffaccb",140,1900);
        }),
    },
    ygo_n_96355986: {
        source:official("magic-cylinder"),
        activate:scene("魔法筒·双筒折返", ["双筒错位展开", "光弹吸入左筒", "右筒转向返射"], f => {
            const left=f.offset(f.from,-55,0),right=f.offset(f.from,55,0);
            const cylinder="M-23-36C-23-50 23-50 23-36V36C23 50-23 50-23 36Z M-23-36C-23-22 23-22 23-36 M-23 22H23";
            f.path(cylinder,left,"#eb9af4",{y:40,opacity:0},{y:0,rotate:-20,opacity:1},0,970);
            f.path(cylinder,right,"#ffe287",{y:40,opacity:0},{y:0,rotate:20,opacity:1},80,970);
            f.projectile(f.offset(left,-60,-110),left,"#f3d8ff",16,180,350,0);
            f.line(right,f.offset(right,90,-120),"#ffe599",14,570,400);
        }),
    },
    ygo_n_89631139: {
        source:official("blue-eyes-white-dragon"),
        summon:scene("青眼·银翼降临", ["银翼自两侧展开", "蓝色龙瞳点亮", "白色光柱收束落位"], f => {
            f.path(wing,f.from,"#b6ecff",{scale:.25,opacity:0},{scale:1.2,opacity:1},0,460);
            f.path(wing,f.from,"#b6ecff",{scale:.25,rotate:180,opacity:0},{scale:1.2,rotate:180,opacity:1},80,460);
            f.orb(f.offset(f.from,-23,-18),"#24a8ff",11,230,480);
            f.orb(f.offset(f.from,23,-18),"#24a8ff",11,230,480);
            f.line(f.offset(f.from,0,-150),f.from,"#eaffff",16,440,380);
            f.ring(f.from,"#72cbff",90,570,430);
        }),
        attack:scene("毁灭的爆裂疾风弹", ["龙口蓝白能量压缩", "贯穿式白色吐息", "冲击环扩散"], f => {
            f.orb(f.from,"#71cfff",38,0,430);
            f.ring(f.from,"#c7f6ff",62,60,360,true);
            f.line(f.from,f.to,"#208fff",32,310,440);
            f.line(f.from,f.to,"#f3ffff",10,350,420);
            f.ring(f.to,"#c9f8ff",95,610,390);
        }),
        destroy:scene("银翼凋落", ["银翼失去蓝光", "白色灵光向内塌缩", "龙瞳熄灭于暗处"], f => {
            f.wash("#040814",0,640,.4);
            f.path(wing,f.from,"#b6ecff",{scale:1.2,rotate:-8,opacity:.95},{scale:.72,rotate:24,opacity:0},0,560);
            f.path(wing,f.from,"#b6ecff",{scale:1.2,rotate:188,opacity:.95},{scale:.72,rotate:156,opacity:0},60,560);
            f.orb(f.offset(f.from,-23,-18),"#24a8ff",8,180,520);
            f.orb(f.offset(f.from,23,-18),"#24a8ff",8,220,520);
            f.line(f.offset(f.from,0,-150),f.from,"#eaffff",11,120,460);
            f.burst(f.from,"#bfeaff",8,80,420,480);
            f.ring(f.from,"#72cbff",92,540,420,true);
            f.title("银翼凋落","青眼暂眠","#72cbff",120,700);
        }),
    },
    ygo_n_46986414: {
        source:official("dark-magician"),
        summon:scene("黑魔导·法阵之门", ["双重法阵逆转", "魔杖自阵中升起", "紫色轮廓显现"], f => {
            f.ring(f.from,"#ad72ff",95,0,750);
            f.sigil(f.from,"#db9cff",78,6,100,780);
            f.path(staff,f.from,"#b7fff0",{y:70,opacity:0},{y:0,opacity:1},250,580);
        }),
        attack:scene("黑·魔·导", ["杖端汇光", "螺旋魔弹穿过术式环", "目标处魔印闭合"], f => {
            f.path(staff,f.from,"#b7fff0",{rotate:-20,opacity:0},{rotate:10,opacity:1},0,400);
            f.sigil(f.from,"#bb70ff",58,6,100,650);
            f.projectile(f.from,f.to,"#b663ff",22,250,450,60);
            f.projectile(f.from,f.to,"#efc1ff",9,310,430,-60);
            f.sigil(f.to,"#e3a2ff",78,6,650,350);
        }),
        destroy:scene("法阵熄灭", ["紫色术式停止回转", "魔杖沉回阵心", "最后一线魔力灭于暗处"], f => {
            f.wash("#0b0518",0,620,.42);
            f.path(staff,f.from,"#b7fff0",{rotate:-6,opacity:.9},{y:66,opacity:0},0,560);
            f.disc(f.from,"#1a0b2a",78,160,560);
            for(let i=0;i<4;i++){
                const a=i*Math.PI/2+Math.PI/4;
                f.projectile(f.offset(f.from,Math.cos(a)*95,Math.sin(a)*75),f.from,i%2?"#bb70ff":"#e3a2ff",6,120+i*70,520,0);
            }
            f.ring(f.from,"#8d4fd8",86,520,380,true);
            f.title("法阵熄灭","暗之魔术休止","#bb70ff",110,680);
        }),
    },
    ygo_n_74677422: {
        source:official("red-eyes-b-dragon"),
        summon:scene("真红眼·黑焰苏醒", ["地面赤色裂隙", "黑翼掠过", "双眼从暗处燃起"], f => {
            f.path("M-100 65-42 30-20 52 5 0 25 24 85-58",f.from,"#ff513f",{scale:.2,opacity:0},{scale:1,opacity:1},0,600);
            f.path("M-115-65-40-30 0 5 45-45 120-80 68 5 20 40 0 15-30 30Z",f.from,"#b63144",{y:-65,opacity:0},{y:0,opacity:1},120,620);
            f.orb(f.offset(f.from,-18,-12),"#ff233e",8,380,400);
            f.orb(f.offset(f.from,18,-12),"#ff233e",8,420,400);
        }),
        attack:scene("黑炎弹", ["暗红火核凝结", "黑焰火球推进", "赤色火舌向外撕开"], f => {
            f.orb(f.from,"#ff354b",28,0,350);
            f.projectile(f.from,f.to,"#a90e32",32,240,450,-22);
            f.projectile(f.from,f.to,"#ff984c",11,280,410,22);
            f.burst(f.to,"#ff573e",9,100,610,400);
        }),
        destroy:scene("黑炎熄核", ["黑焰失去火心", "赤色裂光向内收束", "龙瞳余烬沉入暗处"], f => {
            f.wash("#0d0306",0,620,.4);
            f.burst(f.from,"#ff513f",8,95,0,560);
            f.path("M-100 65-42 30-20 52 5 0 25 24 85-58",f.from,"#ff513f",{scale:1,opacity:.9},{scale:.62,opacity:.25},120,520);
            f.path("M-115-65-40-30 0 5 45-45 120-80 68 5 20 40 0 15-30 30Z",f.from,"#b63144",{y:-8,scale:1,opacity:.85},{y:26,scale:.8,opacity:0},180,520);
            f.orb(f.offset(f.from,-18,-12),"#ff233e",7,260,460);
            f.orb(f.offset(f.from,18,-12),"#ff233e",7,300,460);
            f.disc(f.from,"#160309",64,420,480);
            f.title("黑炎熄核","真红眼暂合","#ff5a4a",110,680);
        }),
    },
    ygo_n_53129443: {
        source:official("dark-hole"),
        activate:scene("黑洞·终焉引力场", ["星空被引力扭曲", "吸积盘切开战场", "目标越过事件视界后坍缩"], f => {
            f.blackHole?.(f.to,0,2600);
            f.title("黑洞","终焉引力场 · DARK HOLE","#cdb7ff",170,2050);
        }),
    },
    ygo_n_83764718: {
        source:official("monster-reborn"),
        activate:scene("死者苏生·生命之钥", ["墓地化作幽蓝水面", "生命之钥贯通生死边界", "灵魂逆流凝成复苏光柱"], f => {
            f.spellCinematic?.("rebirth",f.to,0,2650);
            f.title("死者苏生","生命之钥 · MONSTER REBORN","#75f7ea",150,2150);
        }),
    },
    ygo_n_44095762: {
        source:official("mirror-force"),
        activate:scene("反射镜力·镜面反击", ["六面晶镜拼合", "入射光在镜面折返", "镜力波向外展开"], f => {
            for(let i=0;i<6;i++) {
                const a=i*Math.PI/3;
                f.path("M0-38 33-19 33 19 0 38-33 19-33-19Z",f.offset(f.from,Math.cos(a)*58,Math.sin(a)*58),"#b3ecff",{scale:0,rotate:45,opacity:0},{scale:1,rotate:0,opacity:1},i*45,650);
            }
            f.line(f.offset(f.from,-120,-90),f.from,"#fff5d0",6,300,280);
            f.line(f.from,f.offset(f.from,120,-90),"#a6f3ff",13,540,340);
            f.ring(f.from,"#eaffff",125,660,350);
        }),
    },
};

export function getAuthoredScene(cardId, phase) {
    const key = phase === "spell" || phase === "trap" ? "activate" : phase;
    return AUTHORED_CARD_SCENES[cardId]?.[key] || null;
}

// All geometry uses viewport pixels and the existing animation owner handles cleanup.
let sceneSequence=0;
export function drawAuthoredScene(spec, layer, animations, from, to, reduced, options={}) {
    const NS="http://www.w3.org/2000/svg";
    const svg=document.createElementNS(NS,"svg");
    const instance=++sceneSequence;
    svg.setAttribute("width","100%"); svg.setAttribute("height","100%");
    svg.style.cssText="position:absolute;inset:0;overflow:visible";
    layer.appendChild(svg);
    layer.dataset.authoredScene=spec.title;
    const defs=document.createElementNS(NS,"defs");svg.appendChild(defs);
    const gradients=new Map();
    const energyFill=color=>{
        if(gradients.has(color))return gradients.get(color);
        const id=`scene-energy-${instance}-${gradients.size}`;
        const gradient=document.createElementNS(NS,"radialGradient");gradient.id=id;
        for(const [offset,tint,opacity] of [[0,"#ffffff",1],[.22,"#ffffff",.95],[.48,color,.95],[1,color,0]]){
            const stop=document.createElementNS(NS,"stop");stop.setAttribute("offset",String(offset));stop.setAttribute("stop-color",tint);stop.setAttribute("stop-opacity",String(opacity));gradient.appendChild(stop);
        }
        defs.appendChild(gradient);const value=`url(#${id})`;gradients.set(color,value);return value;
    };
    const scale=Math.min(1,window.innerWidth/650);
    const offset=(p,x,y)=>({x:p.x+x*scale,y:p.y+y*scale});
    const element=(name,attrs,color)=>{
        const node=document.createElementNS(NS,name);
        for(const [key,value] of Object.entries(attrs)) node.setAttribute(key,String(value));
        node.setAttribute("stroke",color);node.setAttribute("fill","none");
        node.setAttribute("stroke-linecap","round");node.setAttribute("stroke-linejoin","round");
        node.style.filter=options.quality === "low" ? "none" : `drop-shadow(0 0 5px ${color})`;
        svg.appendChild(node);return node;
    };
    const animate=(node,frames,delay,duration)=>animations.push(node.animate(frames,{delay,duration,fill:"both",easing:"linear"}));
    const transform=(p,v)=>`translate(${p.x+(v.x||0)*scale}px,${p.y+(v.y||0)*scale}px) rotate(${v.rotate||0}deg) scale(${(v.scale??1)*scale})`;
    const path=(d,p,color,start,end,delay,duration)=>{
        const node=element("path",{d,"stroke-width":2.5},color);
        animate(node,[{transform:transform(p,start),opacity:start.opacity??0},{transform:transform(p,end),opacity:end.opacity??1,offset:.45},{transform:transform(p,end),opacity:end.opacity??1,offset:.8},{transform:transform(p,end),opacity:0}],delay,duration);
        return node;
    };
    const ring=(p,color,r,delay,duration,inward=false)=>{
        const node=element("circle",{cx:0,cy:0,r,"stroke-width":2},color);
        animate(node,[{transform:transform(p,{scale:inward?1.3:.15}),opacity:0},{transform:transform(p,{scale:inward?.8:.85}),opacity:.9,offset:.35},{transform:transform(p,{scale:inward?0:1.3}),opacity:0}],delay,duration);
    };
    const orb=(p,color,r,delay,duration)=>{
        const node=element("circle",{cx:p.x,cy:p.y,r:r*scale,"stroke-width":4},color);
        node.setAttribute("fill",energyFill(color));node.setAttribute("stroke","none");node.style.transformOrigin=`${p.x}px ${p.y}px`;
        animate(node,[{transform:"scale(.1)",opacity:0},{transform:"scale(1)",opacity:.8,offset:.6},{transform:"scale(.4)",opacity:0}],delay,duration);
    };
    const line=(a,b,color,width,delay,duration)=>{
        const node=element("path",{d:`M${a.x} ${a.y}L${b.x} ${b.y}`,"stroke-width":width*scale,pathLength:1,"stroke-dasharray":1},color);
        animate(node,[{strokeDashoffset:1,opacity:0},{strokeDashoffset:0,opacity:.9,offset:.45},{strokeDashoffset:0,opacity:0}],delay,duration);
    };
    const projectile=(a,b,color,r,delay,duration,curve=0)=>{
        const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
        const mid={x:(a.x+b.x)/2-dy/len*curve*scale,y:(a.y+b.y)/2+dx/len*curve*scale};
        const node=element("circle",{cx:0,cy:0,r:r*scale,"stroke-width":3},color);
        node.setAttribute("fill",energyFill(color));node.setAttribute("stroke","none");
        animate(node,[{transform:`translate(${a.x}px,${a.y}px)`,opacity:0},{transform:`translate(${mid.x}px,${mid.y}px)`,opacity:.9,offset:.5},{transform:`translate(${b.x}px,${b.y}px)`,opacity:0}],delay,duration);
    };
    const sigil=(p,color,r,sides,delay,duration)=>{
        const points=Array.from({length:sides},(_,i)=>{const a=i*Math.PI*2/sides;return `${Math.cos(a)*r},${Math.sin(a)*r}`;});
        path(`M${points.join("L")}Z`,p,color,{scale:.3,rotate:-60,opacity:0},{scale:1,rotate:40,opacity:1},delay,duration);
        ring(p,color,r*1.15,delay,duration);
    };
    const burst=(p,color,n,r,delay,duration)=>{
        const count=options.quality === "low" ? Math.max(3,Math.ceil(n*.4)) : n;
        for(let i=0;i<count;i++){const a=i*Math.PI*2/count;line(offset(p,Math.cos(a)*15,Math.sin(a)*15),offset(p,Math.cos(a)*r,Math.sin(a)*r),color,3,delay+i*12,duration);}
    };
    const disc=(p,color,r,delay,duration)=>{
        const node=element("circle",{cx:p.x,cy:p.y,r:r*scale},color);node.setAttribute("fill",color);
        node.style.transformOrigin=`${p.x}px ${p.y}px`;
        animate(node,[{transform:"scale(0)",opacity:0},{transform:"scale(1)",opacity:.9,offset:.35},{transform:"scale(0)",opacity:0}],delay,duration);
    };
    const wash=(color,delay,duration,opacity=.55)=>{
        const node=document.createElement("div");
        node.style.cssText=`position:absolute;inset:0;background:radial-gradient(circle at ${from.x}px ${from.y}px,${color} 0,${color}cc 22%,#02030a 72%);mix-blend-mode:screen;opacity:0`;
        layer.insertBefore(node,svg); animate(node,[{opacity:0},{opacity,offset:.22},{opacity:opacity*.8,offset:.72},{opacity:0}],delay,duration);
    };
    const title=(main,sub,color,delay,duration)=>{
        const node=document.createElement("div");
        node.style.cssText=`position:absolute;left:50%;top:${Math.max(18,Math.min(innerHeight-100,to.y-130))}px;transform:translateX(-50%);min-width:min(420px,82vw);text-align:center;color:white;text-shadow:0 0 12px ${color},0 2px 2px #000;font-family:'Microsoft YaHei',sans-serif;letter-spacing:.16em`;
        node.innerHTML=`<strong style="display:block;font-size:clamp(18px,3.2vw,34px)">${main}</strong><span style="display:block;margin-top:5px;font-size:10px;color:${color};letter-spacing:.3em">${sub}</span>`;
        layer.appendChild(node); animate(node,[{transform:"translateX(-50%) translateY(12px) scale(.92)",opacity:0},{transform:"translateX(-50%) translateY(0) scale(1)",opacity:1,offset:.22},{transform:"translateX(-50%) translateY(0) scale(1)",opacity:1,offset:.72},{transform:"translateX(-50%) translateY(-8px) scale(1.04)",opacity:0}],delay,duration);
    };
    const trail=(a,b,outer,core,delay,duration,curve=0)=>{
        const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
        const mx=(a.x+b.x)/2-dy/len*curve*scale,my=(a.y+b.y)/2+dx/len*curve*scale;
        const d=`M${a.x} ${a.y}Q${mx} ${my} ${b.x} ${b.y}`;
        for(const [color,width,lag] of [[outer,34,0],[outer,19,24],[core,6,52]]){
            const node=element("path",{d,"stroke-width":width*scale,pathLength:1,"stroke-dasharray":1},color);
            node.style.filter=options.quality === "low" ? "none" : `drop-shadow(0 0 ${Math.max(5,width/2)}px ${color})`;
            animate(node,[{strokeDashoffset:1,opacity:0},{strokeDashoffset:0,opacity:.98,offset:.55},{strokeDashoffset:0,opacity:.72,offset:.76},{strokeDashoffset:-1,opacity:0}],delay+lag,duration);
        }
        const sparks=options.quality === "low" ? 4 : 11;
        for(let i=0;i<sparks;i++){
            const t=(i+1)/(sparks+1),omt=1-t;
            const p={x:omt*omt*a.x+2*omt*t*mx+t*t*b.x,y:omt*omt*a.y+2*omt*t*my+t*t*b.y};
            const side=(i%2?1:-1)*(12+(i%3)*7);
            projectile(p,{x:p.x-dy/len*side,y:p.y+dx/len*side+18},i%3?outer:core,2.5+i%2,delay+80+i*28,250,0);
        }
    };
    const blackHole=(p,delay,duration)=>{
        const canvas=document.createElement("canvas"),ratio=options.quality==="low"?1:Math.min(2,devicePixelRatio||1);
        canvas.width=innerWidth*ratio;canvas.height=innerHeight*ratio;
        canvas.style.cssText="position:absolute;inset:0;width:100%;height:100%;opacity:0";
        layer.insertBefore(canvas,svg);const ctx=canvas.getContext("2d");ctx.scale(ratio,ratio);
        const start=performance.now()+delay,seed=n=>{const x=Math.sin(n*9187.41)*43758.54;return x-Math.floor(x)};
        const stars=Array.from({length:options.quality==="low"?34:82},(_,i)=>({x:seed(i)*innerWidth,y:seed(i+91)*innerHeight,r:.35+seed(i+217)*1.3,a:.25+seed(i+401)*.65}));
        const maxR=Math.min(innerWidth*.43,innerHeight*.55,390),coreR=Math.max(38,Math.min(76,maxR*.23));
        const frame=now=>{if(!canvas.isConnected)return;const t=Math.max(0,Math.min(1,(now-start)/duration));ctx.clearRect(0,0,innerWidth,innerHeight);
            const fade=Math.min(1,t/.12)*Math.min(1,(1-t)/.14),open=Math.min(1,t/.28),collapse=t<.78?1:Math.max(0,1-(t-.78)/.22);
            ctx.fillStyle=`rgba(1,2,8,${.82*fade})`;ctx.fillRect(0,0,innerWidth,innerHeight);
            for(const s of stars){const dx=s.x-p.x,dy=s.y-p.y,d=Math.hypot(dx,dy)||1,pull=Math.max(0,1-d/(maxR*2.5))*open,spin=t*2.4+pull*.7,x=s.x-dx*pull*.2+(-dy/d)*pull*24,y=s.y-dy*pull*.2+(dx/d)*pull*24;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-dx/d*pull*18,y-dy/d*pull*18);ctx.strokeStyle=`rgba(205,218,255,${s.a*fade})`;ctx.lineWidth=s.r;ctx.stroke()}
            ctx.save();ctx.translate(p.x,p.y);ctx.scale(1,.34);ctx.rotate(t*2.8);
            for(let i=0;i<7;i++){const rr=coreR+(maxR-coreR)*(i+1)/7*open*collapse,g=ctx.createRadialGradient(0,0,rr*.25,0,0,rr);g.addColorStop(0,"rgba(255,255,255,0)");g.addColorStop(.42,i%2?"rgba(132,73,255,.06)":"rgba(255,114,45,.05)");g.addColorStop(.72,i%2?"rgba(185,132,255,.52)":"rgba(255,154,74,.6)");g.addColorStop(.88,"rgba(255,238,205,.88)");g.addColorStop(1,"rgba(80,36,145,0)");ctx.beginPath();ctx.arc(0,0,rr,0,Math.PI*2);ctx.strokeStyle=g;ctx.lineWidth=Math.max(2,14-i);ctx.stroke()}
            ctx.restore();
            const halo=ctx.createRadialGradient(p.x,p.y,coreR*.55,p.x,p.y,coreR*1.55);halo.addColorStop(0,"#000");halo.addColorStop(.6,"#000");halo.addColorStop(.76,"rgba(211,188,255,.82)");halo.addColorStop(.84,"rgba(102,56,181,.24)");halo.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=halo;ctx.beginPath();ctx.arc(p.x,p.y,coreR*1.6*open*collapse,0,Math.PI*2);ctx.fill();
            ctx.fillStyle="#000";ctx.shadowBlur=28;ctx.shadowColor="#9d6cff";ctx.beginPath();ctx.arc(p.x,p.y,coreR*open*collapse,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
            if(t>.78){const q=(t-.78)/.22,r=maxR*(1-q)*.55;ctx.strokeStyle=`rgba(235,224,255,${1-q})`;ctx.lineWidth=3+10*q;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.stroke();if(q>.66){ctx.fillStyle=`rgba(255,255,255,${Math.sin((q-.66)/.34*Math.PI)*.92})`;ctx.fillRect(0,0,innerWidth,innerHeight)}}
            if(t<1)requestAnimationFrame(frame);
        };requestAnimationFrame(frame);animate(canvas,[{opacity:0},{opacity:1,offset:.08},{opacity:1,offset:.9},{opacity:0}],delay,duration);
    };
    const spellCinematic=(kind,p,delay,duration)=>{
        const canvas=document.createElement("canvas"),ratio=options.quality==="low"?1:Math.min(2,devicePixelRatio||1),W=innerWidth,H=innerHeight;
        canvas.width=W*ratio;canvas.height=H*ratio;canvas.style.cssText="position:absolute;inset:0;width:100%;height:100%;opacity:0";
        layer.insertBefore(canvas,svg);const ctx=canvas.getContext("2d");ctx.scale(ratio,ratio);const started=performance.now()+delay;
        const glow=(color,blur,draw)=>{ctx.save();ctx.shadowColor=color;ctx.shadowBlur=blur;draw();ctx.restore()};
        const heart=(x,y,s,fill)=>{ctx.beginPath();ctx.moveTo(x,y+s*.28);ctx.bezierCurveTo(x-s,y-s*.38,x-s*.42,y-s,x,y-s*.45);ctx.bezierCurveTo(x+s*.42,y-s,x+s,y-s*.38,x,y+s*.28);ctx.fillStyle=fill;ctx.fill()};
        const sword=(x,y,s)=>{ctx.beginPath();ctx.moveTo(x,y-s*.7);ctx.lineTo(x+s*.08,y+s*.25);ctx.lineTo(x+s*.23,y+s*.25);ctx.lineTo(x+s*.23,y+s*.34);ctx.lineTo(x+s*.06,y+s*.34);ctx.lineTo(x+s*.06,y+s*.62);ctx.lineTo(x-s*.06,y+s*.62);ctx.lineTo(x-s*.06,y+s*.34);ctx.lineTo(x-s*.23,y+s*.34);ctx.lineTo(x-s*.23,y+s*.25);ctx.lineTo(x-s*.08,y+s*.25);ctx.closePath();ctx.fill()};
        const render=now=>{if(!canvas.isConnected)return;const t=Math.max(0,Math.min(1,(now-started)/duration)),fade=Math.min(1,t/.1)*Math.min(1,(1-t)/.12);ctx.clearRect(0,0,W,H);
            if(kind==="rebirth"){
                ctx.fillStyle=`rgba(0,16,24,${.78*fade})`;ctx.fillRect(0,0,W,H);const rise=Math.min(1,t/.7);
                for(let i=0;i<9;i++){const x=p.x+(i-4)*W*.045+Math.sin(t*8+i)*18,y=H-(H*.76*rise*(.55+(i%4)*.12));const g=ctx.createLinearGradient(x,H,x,y);g.addColorStop(0,"rgba(44,255,220,0)");g.addColorStop(1,"rgba(190,255,248,.9)");ctx.strokeStyle=g;ctx.lineWidth=2+(i%3);ctx.beginPath();ctx.moveTo(x,H);ctx.quadraticCurveTo(x+Math.sin(i)*45,(H+y)/2,x,y);ctx.stroke()}
                ctx.save();ctx.translate(p.x,p.y);ctx.scale(.82+rise*.35,.82+rise*.35);ctx.strokeStyle="#8ffff0";ctx.lineWidth=9;ctx.beginPath();ctx.arc(0,-48,35,0,Math.PI*2);ctx.moveTo(0,-13);ctx.lineTo(0,95);ctx.moveTo(-48,25);ctx.lineTo(48,25);glow("#51f3e4",28,()=>ctx.stroke());ctx.restore();
                const beam=ctx.createLinearGradient(p.x-90,0,p.x+90,0);beam.addColorStop(0,"transparent");beam.addColorStop(.5,`rgba(190,255,245,${.35*rise})`);beam.addColorStop(1,"transparent");ctx.fillStyle=beam;ctx.fillRect(p.x-90,0,180,H);
            }else if(kind==="greed"){
                ctx.fillStyle=`rgba(12,3,25,${.8*fade})`;ctx.fillRect(0,0,W,H);const open=Math.min(1,t/.32),cx=p.x,cy=p.y+15;
                const g=ctx.createRadialGradient(cx,cy,12,cx,cy,Math.min(W,H)*.38);g.addColorStop(0,"rgba(245,211,82,.6)");g.addColorStop(.32,"rgba(72,214,95,.3)");g.addColorStop(1,"transparent");ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
                ctx.save();ctx.translate(cx,cy);ctx.scale(open,open);ctx.fillStyle="#28793f";ctx.strokeStyle="#b9ff88";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-70,-92);ctx.lineTo(70,-92);ctx.quadraticCurveTo(118,15,72,103);ctx.quadraticCurveTo(0,145,-72,103);ctx.quadraticCurveTo(-118,15,-70,-92);ctx.fill();glow("#70ff78",20,()=>ctx.stroke());ctx.fillStyle="#08170b";ctx.beginPath();ctx.ellipse(0,45,55,30,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#e4ff9c";ctx.beginPath();ctx.arc(-30,-20,9,0,Math.PI*2);ctx.arc(30,-20,9,0,Math.PI*2);ctx.stroke();ctx.restore();
                for(let i=0;i<2;i++){const q=Math.max(0,Math.min(1,(t-.38-i*.08)/.38)),x=cx+(i?1:-1)*q*W*.28,y=cy-20-q*H*.28;ctx.save();ctx.translate(x,y);ctx.rotate((i?1:-1)*q*.45);ctx.fillStyle="#f7df8a";ctx.fillRect(-24,-35,48,70);ctx.strokeStyle="#fff7c9";ctx.lineWidth=3;ctx.strokeRect(-24,-35,48,70);ctx.restore()}
            }else if(kind==="swords"){
                ctx.fillStyle=`rgba(4,9,24,${.76*fade})`;ctx.fillRect(0,0,W,H);for(let i=0;i<3;i++){const q=Math.max(0,Math.min(1,(t-i*.1)/.32)),x=p.x+(i-1)*Math.min(150,W*.18),y=-120+q*(p.y+120);const beam=ctx.createLinearGradient(x-40,0,x+40,0);beam.addColorStop(0,"transparent");beam.addColorStop(.5,`rgba(255,239,150,${.45*q})`);beam.addColorStop(1,"transparent");ctx.fillStyle=beam;ctx.fillRect(x-45,0,90,H);ctx.save();ctx.translate(x,y);ctx.fillStyle="#fff3a8";glow("#ffd95d",35,()=>sword(0,0,135));ctx.restore()}
                const lock=Math.max(0,Math.min(1,(t-.48)/.2));ctx.strokeStyle=`rgba(255,228,112,${lock})`;ctx.lineWidth=5;ctx.setLineDash([18,12]);ctx.lineDashOffset=-t*130;ctx.strokeRect(Math.max(18,p.x-W*.34),p.y-145,Math.min(W-36,W*.68),290);ctx.setLineDash([]);
            }else if(kind==="heart"){
                ctx.fillStyle=`rgba(16,5,20,${.72*fade})`;ctx.fillRect(0,0,W,H);const q=Math.min(1,t/.45),split=W*(.5-q*.5);ctx.fillStyle=`rgba(255,244,216,${.18*q})`;ctx.fillRect(0,0,W/2+split,H);ctx.fillStyle=`rgba(69,30,104,${.28*q})`;ctx.fillRect(W/2-split,0,W,H);
                for(let i=0;i<14;i++){const a=i/14*Math.PI*2+t*2.2,r=Math.min(W,H)*(.12+i%4*.025),x=p.x+Math.cos(a)*r,y=p.y+Math.sin(a)*r*.55;ctx.fillStyle=i%2?"rgba(255,244,218,.78)":"rgba(171,112,229,.78)";ctx.beginPath();ctx.ellipse(x,y,5,16,a,0,Math.PI*2);ctx.fill()}
                const pulse=.86+Math.sin(t*24)*.07;glow("#ff79b4",32,()=>heart(p.x,p.y,120*q*pulse,"#ff9fc7"));heart(p.x,p.y,69*q*pulse,"#fff1f6");
            }else if(kind==="fissure"){
                ctx.fillStyle=`rgba(18,8,4,${.74*fade})`;ctx.fillRect(0,0,W,H);const q=Math.min(1,t/.55),points=[[0,H*.68],[W*.18,H*.58],[W*.31,H*.7],[W*.48,H*.46],[W*.64,H*.61],[W*.8,H*.38],[W,H*.48]];ctx.beginPath();ctx.moveTo(...points[0]);for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],x=a[0]+(b[0]-a[0])*q,y=a[1]+(b[1]-a[1])*q;ctx.lineTo(x,y)}ctx.strokeStyle="#2a0700";ctx.lineWidth=34;ctx.stroke();ctx.strokeStyle="#ff6b18";ctx.lineWidth=12;glow("#ff3b00",30,()=>ctx.stroke());ctx.strokeStyle="#ffd079";ctx.lineWidth=3;ctx.stroke();
                for(let i=0;i<12;i++){const x=(i+.3)/12*W,y=H*(.42+(i%4)*.08),drop=Math.max(0,t-.35)*H*(.4+(i%3)*.18);ctx.save();ctx.translate(x,y+drop);ctx.rotate(t*(i%2?3:-3));ctx.fillStyle="#8b5334";ctx.fillRect(-10-i%3*4,-7,20+i%3*8,14);ctx.restore()}
            }
            if(t<1)requestAnimationFrame(render);
        };requestAnimationFrame(render);animate(canvas,[{opacity:0},{opacity:1,offset:.06},{opacity:1,offset:.9},{opacity:0}],delay,duration);
    };
    const artCinematic=(cues,p,delay,duration)=>{
        const image=options.profile?.image;if(!image)return;const host=document.createElement("div");
        host.style.cssText="position:absolute;inset:0;overflow:hidden;background:#02040b;opacity:0";layer.insertBefore(host,svg);
        const motion=cues.map(c=>c.motion),split=motion.includes("split")||motion.includes("refract"),rain=motion.includes("rain")||motion.includes("fall");
        const bands=options.quality==="low"?2:split?7:4;
        for(let i=0;i<bands;i++){const art=document.createElement("div"),top=i*100/bands,bottom=100-(i+1)*100/bands,drift=(i-(bands-1)/2)*(split?18:7);
            art.style.cssText=`position:absolute;inset:-5%;background:url('${image}') center 35%/cover no-repeat;clip-path:inset(${top}% 0 ${bottom}% 0);filter:saturate(${1.05+i*.04}) contrast(1.08) brightness(.72);`;
            host.appendChild(art);animate(art,[{transform:`translate(${split?-drift:0}px,${rain?-26:8}px) scale(1.12)`,opacity:0},{transform:`translate(${drift}px,0) scale(1.04)`,opacity:.9,offset:.24},{transform:`translate(${drift*.25}px,${rain?18:-5}px) scale(1.09)`,opacity:.82,offset:.76},{transform:`translate(${-drift*.35}px,${rain?34:-9}px) scale(1.13)`,opacity:0}],delay+i*24,duration);
        }
        const shade=document.createElement("div");shade.style.cssText="position:absolute;inset:0;background:linear-gradient(90deg,rgba(1,3,9,.9),transparent 35%,transparent 65%,rgba(1,3,9,.88)),linear-gradient(0deg,rgba(1,3,9,.9),transparent 46%);";host.appendChild(shade);
        animate(host,[{opacity:0},{opacity:.94,offset:.1},{opacity:.94,offset:.88},{opacity:0}],delay,duration);
    };
    const worldLineCinematic=(p,delay,duration)=>{
        const image=options.profile?.image,host=document.createElement("div");host.style.cssText="position:absolute;inset:0;overflow:hidden;background:#080704;opacity:0";layer.insertBefore(host,svg);
        for(let i=0;i<11;i++){const band=document.createElement("div"),top=i*100/11,bottom=100-(i+1)*100/11,dir=i%2?1:-1;
            band.style.cssText=`position:absolute;inset:-4%;background:url('${image}') center 38%/cover no-repeat;clip-path:inset(${top}% 0 ${bottom}% 0);filter:sepia(.42) contrast(1.12) brightness(.72);`;
            host.appendChild(band);animate(band,[{transform:`translateX(${dir*90}px) scale(1.1)`,opacity:0},{transform:`translateX(${dir*18}px) scale(1.04)`,opacity:.9,offset:.18},{transform:"translateX(0) scale(1.02)",opacity:.94,offset:.72},{transform:`translateX(${dir*-12}px) scale(1.06)`,opacity:0}],delay+i*18,duration);
        }
        const noise=document.createElement("div");noise.style.cssText="position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent 0 3px,rgba(255,190,95,.08) 4px 5px),radial-gradient(circle at 50% 48%,transparent 0 28%,rgba(0,0,0,.82) 78%);mix-blend-mode:screen";host.appendChild(noise);
        const meter=document.createElement("div");meter.innerHTML='<small>WORLD LINE DIVERGENCE</small><strong>1.048596</strong><span>STEINS;GATE</span>';meter.style.cssText="position:absolute;right:clamp(18px,7vw,110px);top:18%;padding:18px 22px;border:1px solid #cc8b45;background:#100b05dd;color:#ffb15e;box-shadow:0 0 26px #ff8b374d;font-family:Consolas,monospace;letter-spacing:.16em;text-align:right";meter.querySelector('small').style.cssText="display:block;font-size:9px;color:#bc9b75";meter.querySelector('strong').style.cssText="display:block;font-size:clamp(26px,5vw,64px);text-shadow:0 0 12px #ff7c2c";meter.querySelector('span').style.cssText="font-size:10px;color:#f6ddbe";host.appendChild(meter);
        animate(meter,[{transform:"translateY(-15px)",filter:"blur(8px)",opacity:0},{transform:"translateY(0)",filter:"blur(0)",opacity:1,offset:.35},{transform:"translateY(0)",filter:"blur(0)",opacity:1,offset:.82},{transform:"translateY(-8px)",opacity:0}],delay+420,duration-420);
        animate(noise,[{transform:"translateY(-12px)",opacity:.2},{transform:"translateY(8px)",opacity:.8,offset:.35},{transform:"translateY(-4px)",opacity:.45,offset:.72},{transform:"translateY(12px)",opacity:0}],delay,duration);
        animate(host,[{opacity:0},{opacity:1,offset:.08},{opacity:1,offset:.9},{opacity:0}],delay,duration);
    };
    const storyboardStage=(cues,p,delay,duration)=>{
        const canvas=document.createElement("canvas"),ratio=options.quality==="low"?1:Math.min(2,devicePixelRatio||1),W=innerWidth,H=innerHeight;
        canvas.width=W*ratio;canvas.height=H*ratio;canvas.style.cssText="position:absolute;inset:0;width:100%;height:100%;opacity:0";
        layer.insertBefore(canvas,svg);const ctx=canvas.getContext("2d");ctx.scale(ratio,ratio);const id=options.profile?.id||cues.map(c=>c.symbol).join("-");
        const hash=text=>{let h=2166136261;for(const ch of text)h=Math.imul(h^ch.charCodeAt(0),16777619);return h>>>0},seed=hash(id),hue=seed%360,hue2=(hue+65+(seed>>8)%90)%360;
        const color=(h,s=82,l=66,a=1)=>`hsla(${h} ${s}% ${l}% / ${a})`,started=performance.now()+delay;
        const render=now=>{if(!canvas.isConnected)return;const t=Math.max(0,Math.min(1,(now-started)/duration)),fade=Math.min(1,t/.1)*Math.min(1,(1-t)/.14),cx=p.x,cy=p.y;
            ctx.clearRect(0,0,W,H);const bg=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(W,H)*.72);bg.addColorStop(0,color(hue,65,22,.84*fade));bg.addColorStop(.42,color(hue2,58,11,.75*fade));bg.addColorStop(1,`rgba(1,3,9,${.9*fade})`);ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
            cues.forEach((cue,i)=>{const enter=Math.max(0,Math.min(1,(t-i*.09)/.35)),phase=t*2.4+i*.73,primary=color((hue+i*37)%360,88,68,.72*fade*enter),secondary=color((hue2+i*29)%360,92,82,.46*fade*enter);ctx.save();ctx.translate(cx,cy);ctx.strokeStyle=primary;ctx.fillStyle=secondary;ctx.lineWidth=1.5+i%3;ctx.shadowColor=primary;ctx.shadowBlur=12;
                if(["orbit","weave","wave","form","guard"].includes(cue.motion)){const r=Math.min(W,H)*(.13+i*.035)*enter;ctx.rotate(phase*(i%2?-.7:.7));ctx.beginPath();ctx.ellipse(0,0,r,r*(cue.motion==="weave"?.42:.72),0,0,Math.PI*2);ctx.stroke();for(let k=0;k<6;k++){const a=k*Math.PI/3;ctx.beginPath();ctx.arc(Math.cos(a)*r,Math.sin(a)*r*.72,2.5+i%2,0,Math.PI*2);ctx.fill()}}
                if(["rise","fall","rain","cast","beam"].includes(cue.motion)){for(let k=0;k<7;k++){const x=(k-3)*W*.075+Math.sin(phase+k)*18,y0=cue.motion==="rise"?H*.46:-H*.46,y1=cue.motion==="rise"?-H*.38:H*.42,progress=(enter+k*.08)%1;ctx.beginPath();ctx.moveTo(x,y0+(y1-y0)*progress);ctx.lineTo(x,y0+(y1-y0)*progress+(cue.motion==="beam"?120:42));ctx.stroke()}}
                if(["cross","sweep","split","refract"].includes(cue.motion)){const reach=Math.max(W,H)*.72*enter;ctx.rotate((i%2?-.55:.55)+Math.sin(phase)*.06);ctx.beginPath();ctx.moveTo(-reach,0);ctx.lineTo(reach,0);ctx.stroke();ctx.rotate(Math.PI/2.7);ctx.beginPath();ctx.moveTo(-reach*.7,0);ctx.lineTo(reach*.7,0);ctx.stroke()}
                if(["stamp","halt","converge"].includes(cue.motion)){const r=Math.min(W,H)*(.3-.2*enter);ctx.beginPath();ctx.arc(0,0,Math.max(12,r),0,Math.PI*2);ctx.stroke();ctx.beginPath();for(let k=0;k<8;k++){const a=k*Math.PI/4,rr=Math.min(W,H)*.24;ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr)}ctx.closePath();ctx.stroke()}
                if(cue.motion==="scatter"){for(let k=0;k<18;k++){const a=k/18*Math.PI*2+phase,r=(35+(k%5)*24)*enter;ctx.save();ctx.translate(Math.cos(a)*r,Math.sin(a)*r);ctx.rotate(a);ctx.fillRect(-7,-1,14,2);ctx.restore()}}
                ctx.restore();
            });
            const vignette=ctx.createRadialGradient(cx,cy,Math.min(W,H)*.22,cx,cy,Math.max(W,H)*.68);vignette.addColorStop(0,"transparent");vignette.addColorStop(1,`rgba(0,0,0,${.74*fade})`);ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);
            if(t<1)requestAnimationFrame(render);
        };requestAnimationFrame(render);animate(canvas,[{opacity:0},{opacity:1,offset:.06},{opacity:1,offset:.9},{opacity:0}],delay,duration);
    };
    const webglFire=(canvas,a,b,delay,duration,mode)=>{
        const gl=canvas.getContext("webgl",{alpha:true,premultipliedAlpha:false});if(!gl)return false;
        const vertex=`attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
        const fragment=`precision highp float;uniform vec2 r,a,b;uniform float time,progress,kind;float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}float fbm(vec2 p){float v=0.,w=.5;for(int i=0;i<5;i++){v+=w*n(p);p=p*2.03+17.1;w*=.5;}return v;}vec2 q(float t){vec2 d=b-a;float l=max(length(d),1.);vec2 m=(a+b)*.5+vec2(-d.y,d.x)/l*95.;float o=1.-t;return o*o*a+2.*o*t*m+t*t*b;}void main(){vec2 uv=vec2(gl_FragCoord.x,r.y-gl_FragCoord.y),p=uv;float d=1e4,along=0.;if(kind<.5){for(int i=0;i<48;i++){float t=float(i)/47.;if(t<=progress){float z=length(p-q(t));if(z<d){d=z;along=t;}}}}else{float rad=75.;d=abs(length(p-a)-rad);along=atan(p.y-a.y,p.x-a.x)/6.283+.5;}float flow=fbm(vec2(along*9.-time*1.7,(p.y+time*85.)/95.));float fine=fbm(vec2(along*23.+time*2.1,p.x/75.-time));float edge=20.+22.*flow+8.*fine;float body=smoothstep(edge,2.,d);float core=smoothstep(8.+5.*fine,0.,d);float lick=smoothstep(edge+13.*flow,edge-3.,d)*(1.-core);float endFade=kind>1.5?1.-progress:sin(min(progress,1.)*3.14159);vec3 col=mix(vec3(.22,.008,.002),vec3(1.,.055,.005),body);col=mix(col,vec3(1.,.39,.025),smoothstep(.25,.72,body));col=mix(col,vec3(1.,.92,.48),core*.72);float alpha=(body*.82+lick*.35)*endFade;gl_FragColor=vec4(col*alpha,alpha);}`;
        const fragmentSource=options.quality==="low"
            ? fragment.replace("i<48","i<32").replace("/47.","/31.")
            : fragment.replace("i<48","i<128").replace("/47.","/127.");
        const compile=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);return s},program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragmentSource));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))return false;gl.useProgram(program);const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const pos=gl.getAttribLocation(program,"p");gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
        const uniform=(name,x,y)=>{const u=gl.getUniformLocation(program,name);y===undefined?gl.uniform1f(u,x):gl.uniform2f(u,x,y)};uniform("r",innerWidth,innerHeight);uniform("a",a.x,a.y);uniform("b",b.x,b.y);uniform("kind",mode==="attack"?0:mode==="summon"?1:2);const started=performance.now()+delay;const render=now=>{if(!canvas.isConnected)return;const p=Math.max(0,Math.min(1,(now-started)/duration));uniform("time",now/1000);uniform("progress",p);gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,6);if(p<1)requestAnimationFrame(render)};requestAnimationFrame(render);return true;
    };
    let spritePlayed=false, spriteNode=null;
    const spriteFire=(a,b,delay,duration,mode)=>{
        if(spritePlayed)return true;
        const vfx=VFX_CARD_PROFILES[options.profile?.id || ""];
        // 未登记逐帧素材的卡走通用程序化演出；禁止回退到任何其他角色（尤其炭治郎）的素材。
        if(!vfx)return false;
        spritePlayed=true;
        const node=document.createElement("div"),attack=mode==="attack",cardWidth=Math.max(72,Math.min(132,Math.hypot(b.x-a.x)*.16)),size=Math.min(cardWidth*(attack?vfx.size.attack:vfx.size.other),innerWidth*.64),angle=attack&&vfx.rotate==="travel"?Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI:0,x=attack?b.x:a.x,y=attack?b.y:a.y,sheet=vfx.sheet,glow=vfx.glow;
        node.style.cssText=`position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${size}px;background:url('/images/vfx-mobile/${sheet.replace(".png",".webp")}?v=card-atlas-4x4-desktop') 0 0/400% 400% no-repeat;transform:translate(-50%,-50%) rotate(${angle}deg);filter:drop-shadow(0 0 ${options.quality==="low"?3:9}px ${glow});opacity:0;mask-image:${vfx.mask};-webkit-mask-image:${vfx.mask}`;
        layer.insertBefore(node,svg);spriteNode=node;const [first,last]=vfx.ranges[mode]||vfx.ranges.attack,started=performance.now()+delay;
        const render=now=>{if(!node.isConnected)return;const p=Math.max(0,Math.min(1,(now-started)/duration)),frame=Math.min(last,first+Math.floor(p*(last-first+1))),column=frame%4,row=Math.floor(frame/4);node.style.backgroundPosition=`${column*100/3}% ${row*100/3}%`;if(p<1)requestAnimationFrame(render)};requestAnimationFrame(render);
        animate(node,[{opacity:0,transform:`translate(-50%,-50%) rotate(${angle-12}deg) scale(.68)`},{opacity:.92,transform:`translate(-50%,-50%) rotate(${angle}deg) scale(.94)`,offset:.18},{opacity:.86,transform:`translate(-50%,-50%) rotate(${angle+4}deg) scale(1)`,offset:.78},{opacity:0,transform:`translate(-50%,-50%) rotate(${angle+7}deg) scale(.88)`}],delay,duration);return true;
    };
    const fireDance=(a,b,delay,duration,mode="attack")=>{
        if(spriteFire(a,b,delay,duration,mode))return;
        const canvas=document.createElement("canvas");
        const ratio=options.quality==="low"?1:Math.min(2,devicePixelRatio||1); canvas.width=innerWidth*ratio;canvas.height=innerHeight*ratio; canvas.style.cssText="position:absolute;inset:0;width:100%;height:100%;mix-blend-mode:screen;opacity:0";
        layer.insertBefore(canvas,svg); if(webglFire(canvas,a,b,delay,duration,mode)){animate(canvas,[{opacity:0},{opacity:1,offset:.1},{opacity:1,offset:.86},{opacity:0}],delay,duration);return;}const ctx=canvas.getContext("2d");ctx.scale(ratio,ratio);
        const start=performance.now()+delay;
        const curvePoint=t=>{if(mode!=="attack")return{x:a.x+Math.cos(t*Math.PI*2)*75*scale,y:a.y+Math.sin(t*Math.PI*2)*75*scale};const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,mx=(a.x+b.x)/2-dy/len*95*scale,my=(a.y+b.y)/2+dx/len*95*scale,o=1-t;return{x:o*o*a.x+2*o*t*mx+t*t*b.x,y:o*o*a.y+2*o*t*my+t*t*b.y}};
        const draw=now=>{if(!canvas.isConnected)return;const p=Math.max(0,Math.min(1,(now-start)/duration));ctx.clearRect(0,0,innerWidth,innerHeight);ctx.globalCompositeOperation="lighter";
            const visible=mode==="attack"?Math.min(1,p*1.55):1,fade=mode==="destroy"?1-p:Math.sin(Math.min(1,p)*Math.PI);
            for(let j=0;j<4;j++){ctx.beginPath();const steps=mode==="attack"?54:76;for(let i=0;i<=steps*visible;i++){const t=i/steps,q=curvePoint(t),w=Math.sin(t*31+p*16+j*1.7)*(2.5+j*1.8)*fade;ctx.lineTo(q.x+w,q.y-w*.48)}ctx.strokeStyle=["#9f160b","#f23812","#ff861f","#fff1a3"][j];ctx.lineWidth=[34,23,12,3.5][j]*scale;ctx.lineCap="round";ctx.lineJoin="round";ctx.shadowBlur=[30,24,15,7][j];ctx.shadowColor=ctx.strokeStyle;ctx.globalAlpha=[.28,.55,.78,.9][j]*fade;ctx.stroke()}
            const tongues=options.quality==="low"?9:17;for(let i=1;i<tongues;i++){const t=i/tongues;if(t>visible)continue;const q=curvePoint(t),next=curvePoint(Math.min(1,t+.015)),dx=next.x-q.x,dy=next.y-q.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;const pulse=.35+.65*Math.abs(Math.sin(i*2.37+p*19)),side=i%2?1:-1,height=(8+26*pulse)*scale*fade,base=(5+7*pulse)*scale;ctx.beginPath();ctx.moveTo(q.x-dx/len*base,q.y-dy/len*base);ctx.quadraticCurveTo(q.x+nx*height*side+dx/len*base*.3,q.y+ny*height*side+dy/len*base*.3,q.x+dx/len*base,q.y+dy/len*base);ctx.quadraticCurveTo(q.x+nx*height*.22*side,q.y+ny*height*.22*side,q.x-dx/len*base,q.y-dy/len*base);const g=ctx.createLinearGradient(q.x,q.y,q.x+nx*height*side,q.y+ny*height*side);g.addColorStop(0,"#ffd36a");g.addColorStop(.42,"#ff5a16");g.addColorStop(1,"rgba(126,13,5,0)");ctx.fillStyle=g;ctx.shadowBlur=12;ctx.shadowColor="#ff4815";ctx.globalAlpha=.72*fade;ctx.fill()}
            if(p<1)requestAnimationFrame(draw);};requestAnimationFrame(draw); animate(canvas,[{opacity:0},{opacity:1,offset:.12},{opacity:1,offset:.82},{opacity:0}],delay,duration);
    };
    // Every registered card sheet is part of the authored performance. Play it
    // before the vector storyboard; fireDance() then reuses this invocation.
    const hasPrimarySprite=spriteFire(from,to,40,reduced?720:Math.max(1050,Math.min(1750,spec.duration||1450)),options.phase||"attack");
    // 陷阱卡：图集之外再叠一层与图集同几何的矢量结界，
    // 这样即便素材尚未解码完成，卡牌周围也已经有可读的环带、内印与粒子语言。
    const ward=options.profile?.ward;
    if(ward && !reduced && options.quality!=="low" && (options.phase==="trap" || options.phase==="spell")){
        wash(ward.wash,0,1500,.30);
        ring(from,ward.color,ward.r[0],0,900);
        ring(from,ward.accent,ward.r[1],120,820,true);
        sigil(from,ward.color,ward.r[2],ward.sides,160,860);
        for(let i=0;i<ward.spokes;i++){
            const a=i*Math.PI*2/ward.spokes+ward.phase;
            projectile(offset(from,Math.cos(a)*ward.r[0],Math.sin(a)*ward.r[0]*.92),from,i%2?ward.accent:ward.color,5,110+i*45,440,0);
        }
        burst(from,ward.accent,ward.parts,ward.r[0]*1.05,560,340);
    }
    if(reduced){const node=element("circle",{cx:to.x,cy:to.y,r:24,"stroke-width":2},"#bfe9f2");animate(node,[{opacity:.6},{opacity:0}],0,180);}
    else if (!(options.quality==="low" && hasPrimarySprite)) {
        const {profile,phase}=options;
        const melee=phase==="attack" && spec.cues?.some(c=>["fist","claw","fang","sword","axe","spear","saw"].includes(c.symbol)) && !spec.cues.some(c=>c.motion==="beam");
        if(profile?.image && melee){
            const ghost=document.createElement("img");ghost.src=profile.image;ghost.alt="";
            ghost.dataset.sceneAttacker=profile.id;
            const width=Math.min(78,window.innerWidth*.15),height=width*1.4;
            ghost.style.cssText=`position:absolute;left:${from.x-width/2}px;top:${from.y-height/2}px;width:${width}px;height:${height}px;object-fit:cover;border:1px solid #dcf5ff;border-radius:5px;filter:drop-shadow(0 0 10px #92d9e8);opacity:0`;
            layer.insertBefore(ghost,svg);
            const dx=to.x-from.x,dy=to.y-from.y;
            animate(ghost,[{transform:"translate(0,0) scale(.95)",opacity:0},{transform:"translate(0,0) scale(1.08)",opacity:.85,offset:.2},{transform:`translate(${dx*.85}px,${dy*.85}px) scale(1.1)`,opacity:.8,offset:.55},{transform:`translate(${dx*.9}px,${dy*.9}px) scale(1.02)`,opacity:.7,offset:.67},{transform:"translate(0,0) scale(.95)",opacity:0}],0,1250);
        }
        if(profile?.image && phase!=="attack"){
            const width=Math.min(210,window.innerWidth*.42),height=width*.58;
            const portrait=document.createElement("div");
            portrait.dataset.scenePortrait=profile.id;
            portrait.style.cssText=`position:absolute;left:${Math.max(8,Math.min(window.innerWidth-width-8,from.x-width/2))}px;top:${Math.max(8,Math.min(window.innerHeight-height-8,from.y-height*.8))}px;width:${width}px;height:${height}px;overflow:hidden;clip-path:polygon(8% 0,100% 0,92% 100%,0 100%);border-top:2px solid #c9f5ff;border-bottom:2px solid #c9f5ff;background:#14243a;box-shadow:0 0 22px #91d9ef55`;
            const art=document.createElement("img");art.src=profile.image;art.alt="";
            art.style.cssText="width:100%;height:100%;object-fit:cover;object-position:center 32%;opacity:.8";
            portrait.appendChild(art);
            const title=document.createElement("span");title.textContent=spec.title;
            title.style.cssText="position:absolute;inset:auto 0 0;padding:15px 18px 6px;color:#fff;font:bold 12px sans-serif;background:linear-gradient(transparent,#102033);white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
            portrait.appendChild(title);layer.insertBefore(portrait,svg);
            const opening=profile.type==="trap"?"perspective(500px) rotateY(90deg) scale(.8)":"translateX(-25px) scaleX(.5)";
            animate(portrait,[{transform:opening,opacity:0},{transform:"translateX(0) scaleX(1)",opacity:.95,offset:.2},{transform:"translateX(0) scaleX(1)",opacity:.95,offset:.7},{transform:"translateX(25px) scaleX(.9)",opacity:0}],0,600);
        }
        spec.draw({from,to,offset,path,ring,orb,line,projectile,sigil,burst,disc,wash,title,trail,blackHole,spellCinematic,artCinematic,worldLineCinematic,storyboardStage,fireDance});
    }
    // 图集是魔法/陷阱卡的独立主体演出：脚本里的整屏卡图电影层会盖住它，
    // 因此把图集节点提到卡图电影之上（仍低于矢量层与标题），保证 4×4 逐帧演出真的可见。
    if(spriteNode && (options.phase==="trap" || options.phase==="spell")) layer.insertBefore(spriteNode,svg);
}
